import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import {
  checkoutSuccessUrl,
  resolveCheckoutShop,
  CheckoutShopError,
} from "../app/api/_lib/checkout-shop";
import { dbQuery } from "../app/api/_lib/database";
import { rollbackPhase8RateLimits } from "../app/api/_lib/migrate";
import {
  assertRateLimit,
  cleanupExpiredRateLimits,
  RateLimitError,
  resetRateLimitForTests,
  shopRateKey,
} from "../app/api/_lib/rate-limit";
import { upsertStripeCustomer } from "../app/api/_lib/stripe-billing";
import { upsertShop } from "../app/api/_lib/shops";
import { COPY } from "../app/i18n";
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

  it("lets standalone checkout use a typed shop and rejects a mismatched session shop", async () => {
    const standalone = originRequest("https://app.virello.example/api/stripe/checkout", {
      method: "POST",
    });
    const identity = await resolveCheckoutShop(standalone, {
      shop: SHOP_A,
      flow: "standalone",
    });
    expect(identity).toMatchObject({ shop: SHOP_A, flow: "standalone", source: "body" });

    const sessionId = await issueAppSession({ shop: SHOP_A });
    const withSession = originRequest("https://app.virello.example/api/stripe/checkout", {
      method: "POST",
      headers: { cookie: `virello_sid=${sessionId}` },
    });
    await expect(
      resolveCheckoutShop(withSession, { shop: SHOP_B, flow: "standalone" })
    ).rejects.toBeInstanceOf(CheckoutShopError);

    const sameShop = await resolveCheckoutShop(withSession, {
      shop: SHOP_A,
      flow: "standalone",
    });
    expect(sameShop.source).toBe("session");
  });

  it("lets embedded JWT win and rejects a body shop for a different tenant", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        aud: "shopify-client-id",
        dest: `https://${SHOP_A}`,
        iss: `https://${SHOP_A}/admin`,
        sub: "user-1",
        exp: now + 60,
        nbf: now - 10,
      },
      SECRET
    );
    const request = originRequest("https://app.virello.example/api/stripe/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const identity = await resolveCheckoutShop(request, { shop: SHOP_A, flow: "standalone" });
    expect(identity).toMatchObject({ shop: SHOP_A, flow: "embedded", source: "jwt" });
    await expect(
      resolveCheckoutShop(request, { shop: SHOP_B })
    ).rejects.toMatchObject({ status: 403 });
    expect(checkoutSuccessUrl("https://app.virello.example", SHOP_A, "standalone")).toContain(
      "checkout=success"
    );
    expect(checkoutSuccessUrl("https://app.virello.example", SHOP_A, "embedded")).toContain(
      "admin.shopify.com"
    );
  });

  it("does not move a Stripe customer to another shop", async () => {
    await upsertShop(SHOP_A, { markInstalled: false });
    await upsertStripeCustomer({
      customerId: "cus_bound",
      shop: SHOP_A,
      livemode: false,
    });
    await expect(
      upsertStripeCustomer({
        customerId: "cus_bound",
        shop: SHOP_B,
        livemode: false,
      })
    ).rejects.toThrow(/different Shopify store/);
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
    expect(COPY.en.invalidAuthorizeUrl).toMatch(/myshopify\.com\/admin\/oauth\/authorize/);
    expect(COPY.fil.invalidAuthorizeUrl).toMatch(/myshopify\.com\/admin\/oauth\/authorize/);
    expect(COPY.en.oauthHmacHelp).toMatch(/Client secret/);
    expect(COPY.fil.oauthHmacHelp).toMatch(/Client secret/);
    expect(COPY.en.openInShopifyAdmin).toMatch(/Shopify Admin/);
    expect(COPY.fil.openInShopifyAdmin).toMatch(/Shopify Admin/);
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toMatch(/cdn\.shopify\.com\/shopifycloud\/app-bridge\.js/);
    expect(layout).toMatch(/beforeInteractive/);
    expect(connect).toMatch(/openInShopifyAdmin/);
  });
});
