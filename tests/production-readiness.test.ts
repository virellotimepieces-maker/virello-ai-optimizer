import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueAppSession, sessionCookieOptions } from "../app/api/_lib/app-session";
import { envIsReady, envReadiness } from "../app/api/_lib/env-status";
import { publicErrorMessage } from "../app/api/_lib/public-error";
import { isAllowedAppOrigin } from "../app/api/_lib/origin-guard";
import { authenticateShopifyRequest, saveShopifySession } from "../app/api/_lib/shopify-auth";
import {
  billingForShop,
  usagePeriodStart,
} from "../app/api/_lib/shopify-billing";
import { dbQuery } from "../app/api/_lib/database";
import { consumeAiUsage, peekAiUsage } from "../app/api/_lib/usage";
import { upsertShop } from "../app/api/_lib/shops";
import { createSignedOAuthState } from "../app/api/_lib/shopify-security";
import { clearTestDatabase, usePglite } from "./helpers/pglite";
import { seedShopifyBilling, TEST_SUBSCRIPTION_GID } from "./helpers/shopify-billing";

const SHOP = "store-alpha.myshopify.com";
const SECRET = "shopify-client-secret-value";
const ORIGIN = "https://app.virello.example";

function hmacParams(params: URLSearchParams, secret: string): string {
  const message = [...params.entries()]
    .filter(([key]) => key !== "hmac")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHmac("sha256", secret).update(message).digest("hex");
}

function jsonFetch(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("Production release readiness", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    process.env.APP_URL = ORIGIN;
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "1000";
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/oauth/access_token")) {
          return jsonFetch({
            access_token: "offline-token-value",
            scope: "read_products,write_products",
            expires_in: 3600,
            refresh_token: "shprt_refresh",
            refresh_token_expires_in: 7_776_000,
          });
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    );
    await usePglite();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    clearTestDatabase();
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SHOPIFY_BILLING_TEST;
  });

  it("completes managed-install callback HMAC without an app-signed state", async () => {
    const params = new URLSearchParams({
      code: "auth-code",
      shop: SHOP,
      state: "0.6784241404160823",
      timestamp: "1337178173",
    });
    params.set("hmac", hmacParams(params, SECRET));
    const { GET } = await import("../app/api/auth/shopify/callback/route");
    const response = await GET(
      new NextRequest(`${ORIGIN}/api/auth/shopify/callback?${params}`)
    );
    expect(response.headers.get("location") || "").toMatch(/connected=1/);
  });

  it("does not put OAuth secret diagnostics in the redirect URL", async () => {
    const { GET } = await import("../app/api/auth/shopify/callback/route");
    const response = await GET(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify/callback?code=auth-code&shop=${SHOP}&hmac=${"0".repeat(64)}&state=x`
      )
    );
    const location = response.headers.get("location") || "";
    expect(location).toContain("/connect");
    expect(location).not.toMatch(/oauth_diag=/);
    expect(location).not.toMatch(/secrets=/);
  });

  it("prefers a stored unexpired offline token over token exchange", async () => {
    await saveShopifySession(SHOP, "offline-stored-token", "read_products,write_products", {
      expiresIn: 3600,
      refreshToken: "shprt_stored",
      refreshExpiresIn: 7_776_000,
    });
    const sessionId = await issueAppSession({ shop: SHOP });
    let exchanges = 0;
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/oauth/access_token")) {
          exchanges += 1;
          return jsonFetch({ access_token: "should-not-use" });
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    );
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url"
    );
    const body = Buffer.from(
      JSON.stringify({
        aud: "shopify-client-id",
        dest: `https://${SHOP}`,
        iss: `https://${SHOP}/admin`,
        sub: "user-1",
        exp: now + 60,
        nbf: now - 10,
      })
    ).toString("base64url");
    const signature = createHmac("sha256", SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    const result = await authenticateShopifyRequest(
      new NextRequest(`${ORIGIN}/api/shopify/products`, {
        headers: {
          authorization: `Bearer ${header}.${body}.${signature}`,
          cookie: `virello_sid=${sessionId}`,
        },
      }),
      true
    );
    expect(result.accessToken).toBe("offline-stored-token");
    expect(exchanges).toBe(0);
  });

  it("fills an ACTIVE billing period and rolls usage into the next 30-day window", async () => {
    const start = await seedShopifyBilling(SHOP, {
      status: "ACTIVE",
      currentPeriodStart: 0,
      currentPeriodEnd: 0,
    });
    expect(start.currentPeriodStart).toBeGreaterThan(0);
    expect(start.currentPeriodEnd).toBeGreaterThan(start.currentPeriodStart);

    const now = Math.floor(Date.now() / 1000);
    const staleStart = now - 40 * 24 * 60 * 60;
    const staleEnd = now - 10 * 24 * 60 * 60;
    expect(usagePeriodStart({ currentPeriodStart: staleStart, currentPeriodEnd: staleEnd }, now)).toBe(
      staleStart + 30 * 24 * 60 * 60
    );

    await upsertShop(SHOP);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "2";
    await consumeAiUsage(SHOP, "sub_roll", staleStart);
    await consumeAiUsage(SHOP, "sub_roll", staleStart);
    await expect(consumeAiUsage(SHOP, "sub_roll", staleStart)).rejects.toMatchObject({
      status: 429,
    });
    const rolled = await consumeAiUsage(
      SHOP,
      "sub_roll",
      usagePeriodStart({ currentPeriodStart: staleStart, currentPeriodEnd: staleEnd }, now)
    );
    expect(rolled.used).toBe(1);
    expect(rolled.remaining).toBe(1);
  });

  it("does not treat a failed idempotent consume as success on retry", async () => {
    await upsertShop(SHOP);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "1";
    await consumeAiUsage(SHOP, "sub_idemp", 100);
    await expect(
      consumeAiUsage(SHOP, "sub_idemp", 100, "limit-key-01")
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      consumeAiUsage(SHOP, "sub_idemp", 100, "limit-key-01")
    ).rejects.toMatchObject({ status: 429 });
    expect((await peekAiUsage(SHOP, "sub_idemp", 100)).used).toBe(1);
  });

  it("returns 500 and leaves billing webhooks unprocessed when apply fails", async () => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    await seedShopifyBilling(SHOP, { status: "PENDING" });
    const { POST } = await import("../app/api/webhooks/route");
    const body = "{not-json";
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    const response = await POST(
      new Request(`${ORIGIN}/api/webhooks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": hmac,
          "x-shopify-topic": "app_subscriptions/update",
          "x-shopify-shop-domain": SHOP,
          "x-shopify-webhook-id": "wh_billing_fail",
        },
        body,
      })
    );
    expect(response.status).toBe(500);
    expect((await billingForShop(SHOP))?.status).toBe("PENDING");
    const events = await dbQuery<{ status: string }>(
      `SELECT status FROM webhook_events WHERE event_id = $1`,
      ["wh_billing_fail"]
    );
    expect(events[0]?.status).toBe("failed");
  });

  it("acks shop/redact after HMAC and deletes shop-scoped data", async () => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    await seedShopifyBilling(SHOP, { status: "ACTIVE" });
    await consumeAiUsage(SHOP, TEST_SUBSCRIPTION_GID, 100);
    const { POST } = await import("../app/api/webhooks/shop/redact/route");
    const body = JSON.stringify({ shop_domain: SHOP });
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    const response = await POST(
      new Request(`${ORIGIN}/api/webhooks/shop/redact`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": hmac,
          "x-shopify-topic": "shop/redact",
          "x-shopify-shop-domain": SHOP,
        },
        body,
      })
    );
    expect(response.status).toBe(200);
    expect(await billingForShop(SHOP)).toBeNull();
    const shops = await dbQuery<{ shop: string }>(`SELECT shop FROM shops WHERE shop = $1`, [SHOP]);
    expect(shops).toHaveLength(0);
  });

  it("reports required env names as booleans and never values", async () => {
    process.env.DATABASE_URL = "postgres://example";
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    const { GET } = await import("../app/api/health/route");
    const response = await GET();
    const body = (await response.json()) as {
      ok?: boolean;
      ready?: boolean;
      env?: Record<string, boolean>;
    };
    expect(body.ok).toBe(true);
    expect(body.env?.APP_URL).toBe(true);
    expect(body.env?.DATABASE_URL).toBe(true);
    expect(body.env?.OPENAI_API_KEY).toBe(true);
    expect(body.env?.SHOPIFY_API_SECRET).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/sk-test-not-a-real-key/);
    expect(JSON.stringify(body)).not.toMatch(SECRET);
    expect(envIsReady(envReadiness())).toBe(true);
    expect(
      publicErrorMessage(new Error("OPENAI_API_KEY is not configured."), "Unable to optimize.")
    ).toBe("Unable to optimize.");
  });

  it("rejects storefront CSRF origins while allowing Admin and the app origin", () => {
    expect(isAllowedAppOrigin("https://attacker.myshopify.com", ORIGIN)).toBe(false);
    expect(isAllowedAppOrigin("https://admin.shopify.com", ORIGIN)).toBe(true);
    expect(isAllowedAppOrigin(ORIGIN, ORIGIN)).toBe(true);
    expect(sessionCookieOptions({ mode: "standalone", secure: true }).sameSite).toBe("lax");
    expect(sessionCookieOptions({ mode: "embedded", secure: true }).sameSite).toBe("none");
  });

  it("keeps HMAC recovery available when Connect already bound pending_shop", async () => {
    const sessionId = await issueAppSession({ shop: SHOP });
    const { GET: start } = await import("../app/api/auth/shopify/route");
    await start(
      new NextRequest(`${ORIGIN}/api/auth/shopify?shop=${SHOP}&flow=standalone`, {
        headers: {
          accept: "application/json",
          cookie: `virello_sid=${sessionId}`,
        },
      })
    );
    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const params = new URLSearchParams({
      code: "auth-code",
      shop: SHOP,
      state: createSignedOAuthState(SHOP, SECRET, "standalone"),
      hmac: "0".repeat(64),
    });
    const response = await callback(
      new NextRequest(`${ORIGIN}/api/auth/shopify/callback?${params}`, {
        headers: { cookie: `virello_sid=${sessionId}` },
      })
    );
    expect(response.headers.get("location") || "").toMatch(/connected=1/);
  });
});
