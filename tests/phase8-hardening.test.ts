import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import { billingReturnAppUrl } from "../app/api/_lib/shopify-billing";
import { dbQuery } from "../app/api/_lib/database";
import { rollbackPhase8RateLimits } from "../app/api/_lib/migrate";
import {
  assertRateLimit,
  cleanupExpiredRateLimits,
  RateLimitError,
  resetRateLimitForTests,
  shopRateKey,
} from "../app/api/_lib/rate-limit";
import { seedShopifyBilling } from "./helpers/shopify-billing";
import { COPY } from "../app/i18n";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP_A = "store-alpha.myshopify.com";
const SHOP_B = "store-beta.myshopify.com";
const SECRET = "shopify-client-secret-value";

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function originRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, {
    ...init,
    headers: {
      origin: "https://app.virello.example",
      ...(init?.headers || {}),
    },
  });
}

describe("Phase 8 hardening", () => {
  beforeEach(async () => {
    process.env.APP_URL = "https://app.virello.example";
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    await usePglite();
    await resetRateLimitForTests();
  });

  afterEach(() => {
    clearTestDatabase();
  });

  it("enforces Neon rate limits atomically per tenant and cleans expired windows", async () => {
    const keyA = shopRateKey("ai", SHOP_A);
    const keyB = shopRateKey("ai", SHOP_B);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => assertRateLimit(keyA, 8, 60_000))
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(8);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(12);
    await assertRateLimit(keyB, 8, 60_000);

    await dbQuery(
      `UPDATE rate_limit_buckets SET expires_at_ms = $1`,
      [Date.now() - 1]
    );
    expect(await cleanupExpiredRateLimits()).toBeGreaterThan(0);
    await assertRateLimit(keyA, 8, 60_000);
  });

  it("rolls rate-limit buckets back", async () => {
    await assertRateLimit("oauth:ip:local", 5, 60_000);
    const { exec } = await import("../app/api/_lib/database").then((mod) => {
      const { neonSql } = mod;
      return neonSql();
    });
    await rollbackPhase8RateLimits(exec);
    const tables = await dbQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets'`
    );
    expect(tables).toHaveLength(0);
  });

  it("keeps embedded billing return URLs on Shopify Admin", async () => {
    expect(billingReturnAppUrl(SHOP_A, "standalone")).toContain("checkout=success");
    expect(billingReturnAppUrl(SHOP_A, "embedded")).toContain("admin.shopify.com");
  });

  it("rejects billing subscribe mutations without an allowed origin", async () => {
    const { POST } = await import("../app/api/billing/subscribe/route");
    const blocked = await POST(
      new NextRequest("https://app.virello.example/api/billing/subscribe", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      })
    );
    expect(blocked.status).toBe(403);

    const leftover = await issueAppSession({ shop: SHOP_A });
    const leftoverRequest = originRequest("https://app.virello.example/api/billing/subscribe", {
      method: "POST",
      headers: { cookie: `virello_sid=${leftover}` },
    });
    const leftoverResponse = await POST(leftoverRequest);
    expect(leftoverResponse.status).toBeGreaterThanOrEqual(400);

    await saveShopifySession(SHOP_A, "offline-token-alpha", "read_products,write_products");
    const installed = await issueAppSession({ shop: SHOP_A });
    const jwtNow = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        aud: "shopify-client-id",
        dest: `https://${SHOP_B}`,
        iss: `https://${SHOP_B}/admin`,
        sub: "user-1",
        exp: jwtNow + 60,
        nbf: jwtNow - 10,
      },
      SECRET
    );
    const jwtRequest = originRequest("https://app.virello.example/api/billing/subscribe", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        cookie: `virello_sid=${installed}`,
      },
    });
    const jwtResponse = await POST(jwtRequest);
    expect(jwtResponse.status).toBeGreaterThanOrEqual(400);
  });

  it("keeps Shopify billing on the shop that owns the subscription", async () => {
    await seedShopifyBilling(SHOP_A, {
      subscriptionGid: "gid://shopify/AppSubscription/bound",
    });
    await seedShopifyBilling(SHOP_B, {
      subscriptionGid: "gid://shopify/AppSubscription/other",
    });
    const { billingForShop } = await import("../app/api/_lib/shopify-billing");
    expect((await billingForShop(SHOP_A))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/bound"
    );
    expect((await billingForShop(SHOP_B))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/other"
    );
  });

  it("keeps one canonical save endpoint and full FIL/EN copy", async () => {
    expect(existsSync("app/api/shopify/save-product/route.ts")).toBe(false);
    expect(existsSync("app/api/stores/products/route.ts")).toBe(false);
    const connect = readFileSync("app/connect/page.tsx", "utf8");
    expect(connect).toMatch(/copy\.manage/);
    expect(connect).toMatch(/copy\.subscribe/);
    expect(connect).toMatch(/copy\.connectHeadline/);
    expect(connect).not.toMatch(/Unable to open subscription management/);
    expect(COPY.fil.manage).toMatch(/I-manage/);
    expect(COPY.fil.emptyProducts).toBeTruthy();
    expect(COPY.en.checkoutNeedShop).toMatch(/myshopify\.com/);
    expect(COPY.en.invalidAuthorizeUrl).toMatch(/Shopify Admin/);
    expect(COPY.fil.invalidAuthorizeUrl).toMatch(/Shopify Admin/);
    expect(COPY.en.oauthHmacHelp).toMatch(/Client ID 059b113acaba78d855be9bc9500e421a/);
    expect(COPY.fil.oauthHmacHelp).toMatch(/Client ID 059b113acaba78d855be9bc9500e421a/);
    expect(COPY.en.openInShopifyAdmin).toMatch(/Shopify Admin/);
    expect(COPY.fil.openInShopifyAdmin).toMatch(/Shopify Admin/);
    expect(COPY.en.hmacRetryNow).toMatch(/Shopify Admin/);
    expect(COPY.fil.hmacRetryNow).toMatch(/Shopify Admin/);
    expect(COPY.en.secretStatusMissing).toMatch(/Production-only/);
    expect(COPY.fil.secretStatusMissing).toMatch(/Production-only/);
    expect(COPY.en.alreadyBilledHelp).toMatch(/Shopify subscription/);
    expect(COPY.fil.alreadyBilledHelp).toMatch(/Shopify Admin/);
    expect(COPY.en.emptyReview).toMatch(/conversion scores/);
    expect(COPY.fil.emptyReview).toMatch(/conversion scores/);
    expect(COPY.en.gradeNeedsWork).toBe("Needs work");
    expect(COPY.en.gradeGood).toBe("Good foundation");
    expect(COPY.en.gradeStrong).toBe("Strong");
    expect(COPY.en.gradeExcellent).toBe("Excellent");
    expect(COPY.en.differentCustomerHelp).toMatch(/one store/);
    expect(COPY.fil.differentCustomerHelp).toMatch(/isang store/);
    expect(COPY.en.billedStore).toMatch(/\$29\.99/);
    expect(COPY.fil.billedStore).toMatch(/\$29\.99/);
    expect(COPY.en.domainHint).toMatch(/myshopify\.com/);
    expect(COPY.fil.domainHint).toMatch(/myshopify\.com/);
    expect(COPY.en.liveBadge).toBe("Live");
    expect(COPY.en.testBadge).toBe("Test");
    expect(COPY.fil.liveBadge).toBe("Live");
    expect(COPY.en.sandboxBillingBanner).toMatch(/Approve the Shopify/);
    expect(COPY.fil.sandboxBillingBanner).toMatch(/Aprubahan/);
    expect(COPY.en.useThisStore).toBe("Use this store");
    expect(COPY.fil.useThisStore).toBe("Gamitin ang store na ito");
    expect(COPY.en.domainMismatch).toMatch(/Change Store/);
    expect(COPY.fil.domainMismatch).toMatch(/Palitan ang store/);
    expect(COPY.en.domainMismatch).not.toMatch(/Connect gfd1cp-1v/);
    expect(COPY.fil.domainMismatch).not.toMatch(/Connect gfd1cp-1v/);
    expect(connect).toMatch(/alreadyBilledHelp/);
    expect(connect).toMatch(/differentCustomerHelp/);
    expect(connect).toMatch(/billedStore/);
    expect(connect).toMatch(/nextPending/);
    expect(connect).toMatch(/domainHint/);
    expect(connect).toMatch(/useThisStore/);
    expect(connect).toMatch(/use-this-store/);
    expect(connect).toMatch(/\/api\/shopify\/retarget/);
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toMatch(/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js/);
    expect(layout).toMatch(/<script src=\{APP_BRIDGE_CDN\}/);
    expect(layout).not.toMatch(/next\/script/);
    expect(layout).not.toMatch(/beforeInteractive/);
    expect(connect).toMatch(/openInShopifyAdmin/);
    const home = readFileSync("app/home-client.tsx", "utf8");
    expect(home).toMatch(/use-this-store/);
    expect(home).toMatch(/\/api\/shopify\/retarget/);
    expect(home).not.toMatch(/window\.location\.replace\(admin/);
    expect(home).toMatch(/live-badge/);
    expect(home).toMatch(/save-dock/);
    expect(home.match(/data-testid="save-dock"/g)).toHaveLength(1);
    expect(home).not.toMatch(/save-dock-top/);
    expect(home).toMatch(/brand-voice/);
    expect(home).toMatch(/merchant-insights/);
    expect(home).toMatch(/product-facts/);
    expect(home).toMatch(/score-limit/);
    expect(home).toMatch(/Idempotency-Key/);
    expect(home).toMatch(/SEO_TITLE_MAX/);
    expect(home).toMatch(/META_DESCRIPTION_MAX/);
    expect(readFileSync("app/shopify-app-bridge.tsx", "utf8")).toMatch(/copyEmbedQuery/);
    expect(readFileSync("app/shopify-embed.ts", "utf8")).toMatch(/window\.open\(url, "_top"\)/);
  });
});
