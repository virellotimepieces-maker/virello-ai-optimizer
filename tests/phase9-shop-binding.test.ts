import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueAppSession, SESSION_COOKIE } from "../app/api/_lib/app-session";
import { dbQuery } from "../app/api/_lib/database";
import {
  recoverUninstalledSessionBindings,
  rehomeUninstalledBilling,
  setPendingShop,
  ShopBindingError,
} from "../app/api/_lib/shop-binding";
import { authenticateShopifyRequest, saveShopifySession } from "../app/api/_lib/shopify-auth";
import { createSignedOAuthState } from "../app/api/_lib/shopify-security";
import { upsertStripeCustomer, billingForShop, saveShopSubscription } from "../app/api/_lib/stripe-billing";
import {
  isShopifyInstallationActive,
  revokeShopifyInstallation,
  upsertShop,
} from "../app/api/_lib/shops";
import { COPY } from "../app/i18n";
import { resolveStoreBindingDisplay } from "../app/api/_lib/shop-domain";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP_FAILED = "gfd1cp-1v.myshopify.com";
const SHOP_NEXT = "bcya1v-xp.myshopify.com";
const SECRET = "shopify-client-secret-value";
const ORIGIN = "https://app.virello.example";

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

function hmacParams(params: URLSearchParams, secret: string): string {
  const message = [...params.entries()]
    .filter(([key]) => key !== "hmac")
    .sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHmac("sha256", secret).update(message).digest("hex");
}

function callbackRequest(input: {
  shop: string;
  code?: string;
  state?: string;
  hmac?: string;
  cookie?: string;
}): NextRequest {
  const state =
    input.state ?? createSignedOAuthState(input.shop, SECRET, "standalone");
  const params = new URLSearchParams({
    code: input.code ?? "auth-code",
    shop: input.shop,
    state,
  });
  params.set("hmac", input.hmac ?? hmacParams(params, SECRET));
  const headers: Record<string, string> = {};
  if (input.cookie) headers.cookie = input.cookie;
  return new NextRequest(`${ORIGIN}/api/auth/shopify/callback?${params}`, {
    headers,
  });
}

function cookieHeader(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}`;
}

async function sessionRow(sessionId: string) {
  const rows = await dbQuery<{
    shop: string;
    pending_shop: string | null;
    pending_shop_expires_at: string | Date | null;
    stripe_customer_id: string | null;
    revoked_at: string | Date | null;
  }>(
    `SELECT shop, pending_shop, pending_shop_expires_at, stripe_customer_id, revoked_at
     FROM app_sessions
     WHERE id = $1
     LIMIT 1`,
    [sessionId]
  );
  return rows[0] ?? null;
}

async function sessionCount(): Promise<number> {
  const rows = await dbQuery<{ n: number }>("SELECT COUNT(*)::int AS n FROM app_sessions");
  return Number(rows[0]?.n ?? 0);
}

describe("Phase 9 shop-binding lifecycle", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    process.env.APP_URL = ORIGIN;
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/oauth/access_token")) {
          return jsonFetch({
            access_token: "offline-token-value",
            scope: "read_products,write_products",
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
  });

  it("does not create an app session when OAuth starts without a subscriber cookie", async () => {
    const { GET } = await import("../app/api/auth/shopify/route");
    const before = await sessionCount();
    const response = await GET(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_FAILED}&flow=standalone`,
        { headers: { accept: "application/json" } }
      )
    );
    expect(response.status).toBe(200);
    expect(await sessionCount()).toBe(before);
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(false);
  });

  it("stores an expiring pending_shop on OAuth start and leaves billing shop unchanged", async () => {
    await upsertStripeCustomer({
      customerId: "cus_pending",
      shop: SHOP_FAILED,
      livemode: false,
    });
    await saveShopSubscription({
      shop: SHOP_FAILED,
      customerId: "cus_pending",
      subscriptionId: "sub_pending",
      status: "active",
      currentPeriodStart: 1_700_000_000,
      currentPeriodEnd: 1_702_592_000,
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_pending",
    });
    const { GET } = await import("../app/api/auth/shopify/route");
    const response = await GET(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; shop?: string };
    expect(body.success).toBe(true);
    expect(body.shop).toBe(SHOP_NEXT);

    const row = await sessionRow(sessionId);
    expect(row?.shop).toBe(SHOP_FAILED);
    expect(row?.pending_shop).toBe(SHOP_NEXT);
    expect(row?.stripe_customer_id).toBe("cus_pending");
    const expires = new Date(String(row?.pending_shop_expires_at)).getTime();
    expect(expires).toBeGreaterThan(Date.now() + 8 * 60 * 1000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 11 * 60 * 1000);
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(false);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
    expect((await billingForShop(SHOP_FAILED))?.customerId).toBe("cus_pending");
  });

  it("treats abandoned OAuth as replaceable after pending_shop expires", async () => {
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_abandoned",
    });
    await setPendingShop(sessionId, SHOP_FAILED);
    await dbQuery(
      `UPDATE app_sessions
       SET pending_shop_expires_at = NOW() - INTERVAL '1 minute'
       WHERE id = $1`,
      [sessionId]
    );

    const { GET } = await import("../app/api/auth/shopify/route");
    const response = await GET(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    expect(response.status).toBe(200);
    const row = await sessionRow(sessionId);
    expect(row?.shop).toBe(SHOP_FAILED);
    expect(row?.pending_shop).toBe(SHOP_NEXT);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
  });

  it("does not persist an installation when the OAuth callback HMAC fails", async () => {
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_hmac",
    });
    const { GET: start } = await import("../app/api/auth/shopify/route");
    await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );

    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const response = await callback(
      callbackRequest({
        shop: SHOP_NEXT,
        hmac: "0".repeat(64),
        cookie: cookieHeader(sessionId),
      })
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location") || "").toMatch(/error_description=/);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
    const row = await sessionRow(sessionId);
    expect(row?.shop).toBe(SHOP_FAILED);
    expect(row?.pending_shop).toBe(SHOP_NEXT);
    expect(row?.revoked_at).toBeNull();
  });

  it("does not persist an installation when token exchange fails", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/oauth/access_token")) {
          return jsonFetch({ error: "invalid_request", error_description: "bad code" }, 400);
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    );
    const sessionId = await issueAppSession({ shop: SHOP_FAILED });
    const { GET: start } = await import("../app/api/auth/shopify/route");
    await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const response = await callback(
      callbackRequest({ shop: SHOP_NEXT, cookie: cookieHeader(sessionId) })
    );
    expect(response.headers.get("location") || "").toMatch(/bad(?:\+|%20)code|authorization failed/i);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
    expect((await sessionRow(sessionId))?.shop).toBe(SHOP_FAILED);
  });

  it("replaces a pending shop without opening another Stripe customer", async () => {
    await upsertStripeCustomer({
      customerId: "cus_replace",
      shop: SHOP_FAILED,
      livemode: false,
    });
    await saveShopSubscription({
      shop: SHOP_FAILED,
      customerId: "cus_replace",
      subscriptionId: "sub_replace",
      status: "active",
      currentPeriodStart: 10,
      currentPeriodEnd: 20,
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_replace",
    });
    const { GET: start } = await import("../app/api/auth/shopify/route");
    await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_FAILED}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    const replaced = await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    expect(replaced.status).toBe(200);
    expect((await sessionRow(sessionId))?.pending_shop).toBe(SHOP_NEXT);

    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const done = await callback(
      callbackRequest({ shop: SHOP_NEXT, cookie: cookieHeader(sessionId) })
    );
    expect(done.status).toBe(307);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(true);
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(false);
    expect((await billingForShop(SHOP_NEXT))?.customerId).toBe("cus_replace");
    expect((await billingForShop(SHOP_FAILED))?.customerId).toBeUndefined();
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBe("sub_replace");
  });

  it("blocks a different shop after a completed installation until Change Store", async () => {
    await saveShopifySession(SHOP_FAILED, "offline-token-installed", "write_products");
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_installed",
    });
    const { GET: start } = await import("../app/api/auth/shopify/route");
    const blocked = await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    expect(blocked.status).toBe(403);
    const body = (await blocked.json()) as { error?: string };
    expect(body.error).toMatch(/already linked/i);
    expect(body.error).toMatch(/Change Store/i);

    const sameShop = await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_FAILED}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    expect(sameShop.status).toBe(200);

    const { POST } = await import("../app/api/shopify/disconnect/route");
    const unconfirmed = await POST(
      new NextRequest(`${ORIGIN}/api/shopify/disconnect`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          cookie: cookieHeader(sessionId),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      })
    );
    expect(unconfirmed.status).toBe(400);
    const unconfirmedBody = (await unconfirmed.json()) as { requiresConfirm?: boolean };
    expect(unconfirmedBody.requiresConfirm).toBe(true);
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(true);
  });

  it("disconnects a completed install, keeps Stripe billing, and allows reconnect", async () => {
    await upsertStripeCustomer({
      customerId: "cus_reconnect",
      shop: SHOP_FAILED,
      livemode: false,
    });
    await saveShopSubscription({
      shop: SHOP_FAILED,
      customerId: "cus_reconnect",
      subscriptionId: "sub_reconnect",
      status: "active",
      currentPeriodStart: 10,
      currentPeriodEnd: 20,
    });
    await saveShopifySession(SHOP_FAILED, "offline-token-reconnect", "write_products");
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_reconnect",
    });

    const { POST } = await import("../app/api/shopify/disconnect/route");
    const disconnected = await POST(
      new NextRequest(`${ORIGIN}/api/shopify/disconnect`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          cookie: cookieHeader(sessionId),
          "content-type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      })
    );
    expect(disconnected.status).toBe(200);
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(false);
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe("sub_reconnect");
    expect((await sessionRow(sessionId))?.revoked_at).toBeNull();
    expect((await sessionRow(sessionId))?.pending_shop).toBeNull();

    const { GET: start } = await import("../app/api/auth/shopify/route");
    const nextStart = await start(
      new NextRequest(
        `${ORIGIN}/api/auth/shopify?shop=${SHOP_NEXT}&flow=standalone`,
        {
          headers: {
            accept: "application/json",
            cookie: cookieHeader(sessionId),
          },
        }
      )
    );
    expect(nextStart.status).toBe(200);

    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const done = await callback(
      callbackRequest({ shop: SHOP_NEXT, cookie: cookieHeader(sessionId) })
    );
    expect(done.status).toBe(307);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(true);
    expect((await billingForShop(SHOP_NEXT))?.customerId).toBe("cus_reconnect");
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBe("sub_reconnect");
  });

  it("does not let one active installation use another store's token", async () => {
    await saveShopifySession(SHOP_FAILED, "offline-token-tenant-a", "write_products");
    await saveShopifySession(SHOP_NEXT, "offline-token-tenant-b", "write_products");
    const sessionA = await issueAppSession({ shop: SHOP_FAILED });
    const sessionB = await issueAppSession({ shop: SHOP_NEXT });

    const authA = await authenticateShopifyRequest(
      new NextRequest(`${ORIGIN}/api/shopify/products`, {
        headers: { cookie: cookieHeader(sessionA) },
      }),
      true
    );
    const authB = await authenticateShopifyRequest(
      new NextRequest(`${ORIGIN}/api/shopify/products`, {
        headers: { cookie: cookieHeader(sessionB) },
      }),
      true
    );
    expect(authA.shop).toBe(SHOP_FAILED);
    expect(authA.accessToken).toBe("offline-token-tenant-a");
    expect(authB.shop).toBe(SHOP_NEXT);
    expect(authB.accessToken).toBe("offline-token-tenant-b");
    await expect(
      authenticateShopifyRequest(
        new NextRequest(`${ORIGIN}/api/shopify/products`, {
          headers: { cookie: cookieHeader(sessionA) },
        }),
        true
      ).then((result) => result.shop === SHOP_NEXT)
    ).resolves.toBe(false);
  });

  it("refuses to rehome billing while a Shopify installation is still active", async () => {
    await saveShopifySession(SHOP_FAILED, "offline-token-lock", "write_products");
    await upsertStripeCustomer({
      customerId: "cus_lock",
      shop: SHOP_FAILED,
      livemode: false,
    });
    await expect(rehomeUninstalledBilling(SHOP_FAILED, SHOP_NEXT)).rejects.toBeInstanceOf(
      ShopBindingError
    );
    expect((await billingForShop(SHOP_FAILED)) == null).toBe(true);
  });

  it("recovers uninstalled checkout sessions onto pending_shop without a new subscription", async () => {
    await upsertShop(SHOP_FAILED, { markInstalled: false });
    await upsertStripeCustomer({
      customerId: "cus_recovery",
      shop: SHOP_FAILED,
      livemode: false,
    });
    await saveShopSubscription({
      shop: SHOP_FAILED,
      customerId: "cus_recovery",
      subscriptionId: "sub_recovery",
      status: "active",
      currentPeriodStart: 10,
      currentPeriodEnd: 20,
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_recovery",
    });
    const recovered = await recoverUninstalledSessionBindings();
    expect(recovered).toBeGreaterThanOrEqual(1);
    const row = await sessionRow(sessionId);
    expect(row?.pending_shop).toBe(SHOP_FAILED);
    expect(new Date(String(row?.pending_shop_expires_at)).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe("sub_recovery");
  });

  it("exposes pending vs connected shops on subscriber status", async () => {
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
      stripeCustomerId: "cus_status",
    });
    await setPendingShop(sessionId, SHOP_NEXT);
    const { GET } = await import("../app/api/subscriber/status/route");
    const response = await GET(
      new NextRequest(`${ORIGIN}/api/subscriber/status`, {
        headers: { cookie: cookieHeader(sessionId) },
      })
    );
    const body = (await response.json()) as {
      shop?: string;
      pendingShop?: string | null;
      shopInstalled?: boolean;
      canReplaceShop?: boolean;
    };
    expect(body.shop).toBe(SHOP_FAILED);
    expect(body.pendingShop).toBe(SHOP_NEXT);
    expect(body.shopInstalled).toBe(false);
    expect(body.canReplaceShop).toBe(true);

    const display = resolveStoreBindingDisplay(body);
    expect(display).toEqual({ domain: SHOP_NEXT, kind: "pending" });
    expect(COPY.en.pendingStore).toMatch(/Pending store/);
    expect(COPY.fil.changeStore).toMatch(/Palitan/);
  });

  it("clears a pending shop without confirm when no installation exists", async () => {
    const sessionId = await issueAppSession({ shop: SHOP_FAILED });
    await setPendingShop(sessionId, SHOP_FAILED);
    const { POST } = await import("../app/api/shopify/disconnect/route");
    const response = await POST(
      new NextRequest(`${ORIGIN}/api/shopify/disconnect`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          cookie: cookieHeader(sessionId),
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(200);
    expect((await sessionRow(sessionId))?.pending_shop).toBeNull();
    expect((await sessionRow(sessionId))?.shop).toBe(SHOP_FAILED);
  });

  it("keeps uninstall default behavior of revoking app sessions", async () => {
    await saveShopifySession(SHOP_FAILED, "offline-token-uninstall", "write_products");
    const sessionId = await issueAppSession({ shop: SHOP_FAILED });
    await revokeShopifyInstallation(SHOP_FAILED);
    expect((await sessionRow(sessionId))?.revoked_at).toBeTruthy();
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(false);
  });
});
