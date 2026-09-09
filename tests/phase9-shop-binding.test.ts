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
import { billingForShop } from "../app/api/_lib/shopify-billing";
import { seedShopifyBilling } from "./helpers/shopify-billing";
import {
  isShopifyInstallationActive,
  revokeShopifyInstallation,
  upsertShop,
} from "../app/api/_lib/shops";
import { COPY } from "../app/i18n";
import { resolveStoreBindingDisplay } from "../app/api/_lib/shop-domain";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP_FAILED = "gfd1cp-1v.myshopify.com";
const SHOP_PAID = "gfd1cp-1y.myshopify.com";
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

  it("retargets the session shop without moving Shopify billing", async () => {
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/pending",
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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
    expect(row?.shop).toBe(SHOP_NEXT);
    expect(row?.pending_shop).toBe(SHOP_NEXT);
    const expires = new Date(String(row?.pending_shop_expires_at)).getTime();
    expect(expires).toBeGreaterThan(Date.now() + 8 * 60 * 1000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 11 * 60 * 1000);
    expect(await isShopifyInstallationActive(SHOP_FAILED)).toBe(false);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/pending"
    );
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBeUndefined();
  });

  it("treats abandoned OAuth as replaceable after pending_shop expires", async () => {
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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
    expect(row?.shop).toBe(SHOP_NEXT);
    expect(row?.pending_shop).toBe(SHOP_NEXT);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
  });

  it("completes installation when Shopify accepts the code even if callback HMAC does not match", async () => {
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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
    expect(response.headers.get("location") || "").toMatch(/connected=1/);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(true);
  });

  it("does not install from a forged HMAC callback without a pending shop binding", async () => {
    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const params = new URLSearchParams({
      code: "auth-code",
      shop: SHOP_NEXT,
      state: "not-a-signed-state",
      hmac: "0".repeat(64),
    });
    const response = await callback(
      new NextRequest(`${ORIGIN}/api/auth/shopify/callback?${params}`)
    );
    expect(response.headers.get("location") || "").toMatch(/signature.+invalid|Client.+secret/i);
    expect(response.headers.get("location") || "").not.toMatch(/connected=1/);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
  });

  it("keeps the store disconnected when HMAC and Shopify token exchange both fail", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/oauth/access_token")) {
          return jsonFetch({ error: "invalid_client" }, 401);
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    );
    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const response = await callback(
      callbackRequest({
        shop: SHOP_NEXT,
        hmac: "0".repeat(64),
      })
    );
    const location = response.headers.get("location") || "";
    expect(location).toMatch(/signature(\+|%20)is(\+|%20)invalid|does(\+|%20)not(\+|%20)match(\+|%20)this(\+|%20)Shopify(\+|%20)app/i);
    expect(location).not.toMatch(/oauth_diag=/);
    expect(location).toMatch(/shop=bcya1v-xp\.myshopify\.com|shop%3Dbcya1v-xp/);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(false);
  });

  it("tells App Bridge to reauthorize at the top window when token exchange fails", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/admin/oauth/access_token")) {
          return jsonFetch({ error: "invalid_grant" }, 400);
        }
        throw new Error(`unexpected fetch ${url}`);
      }
    );
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(
      {
        aud: "shopify-client-id",
        dest: `https://${SHOP_NEXT}`,
        iss: `https://${SHOP_NEXT}/admin`,
        sub: "user-1",
        exp: now + 60,
        nbf: now - 10,
      },
      SECRET
    );
    const { POST } = await import("../app/api/auth/shopify/session/route");
    const response = await POST(
      new NextRequest(`${ORIGIN}/api/auth/shopify/session`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
      })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("X-Shopify-Retry-Invalid-Session-Request")).toBe("1");
    const reauth = response.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url") || "";
    expect(reauth).toContain("https://admin.shopify.com/store/");
    expect(reauth).toContain("/apps/virello-ai-optimizer");
    expect(reauth).not.toContain("/admin/oauth/authorize");
    expect(reauth).not.toContain("accounts.shopify.com");
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
    expect((await sessionRow(sessionId))?.shop).toBe(SHOP_NEXT);
  });

  it("connects a replacement shop without moving Shopify billing", async () => {
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/replace",
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBeUndefined();
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/replace"
    );
  });

  it("keeps existing Shopify billing on a shop that already subscribed", async () => {
    await seedShopifyBilling(SHOP_NEXT, {
      subscriptionGid: "gid://shopify/AppSubscription/paid",
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
    });
    const { GET: callback } = await import("../app/api/auth/shopify/callback/route");
    const done = await callback(
      callbackRequest({ shop: SHOP_NEXT, cookie: cookieHeader(sessionId) })
    );
    expect(done.headers.get("location") || "").toMatch(/connected=1/);
    expect(await isShopifyInstallationActive(SHOP_NEXT)).toBe(true);
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/paid"
    );
  });

  it("does not copy Shopify billing when rehoming an uninstalled session", async () => {
    await seedShopifyBilling(SHOP_NEXT, {
      subscriptionGid: "gid://shopify/AppSubscription/target",
    });
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/source",
    });
    await rehomeUninstalledBilling(SHOP_FAILED, SHOP_NEXT);
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/target"
    );
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/source"
    );
  });

  it("retargets the session to the typed shop without swapping subscriptions", async () => {
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/mine",
    });
    await seedShopifyBilling(SHOP_PAID, {
      subscriptionGid: "gid://shopify/AppSubscription/other",
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
    });
    const { POST } = await import("../app/api/shopify/retarget/route");
    const moved = await POST(
      new NextRequest(`${ORIGIN}/api/shopify/retarget`, {
        method: "POST",
        headers: {
          origin: ORIGIN,
          cookie: cookieHeader(sessionId),
          "content-type": "application/json",
        },
        body: JSON.stringify({ shop: SHOP_PAID }),
      })
    );
    expect(moved.status).toBe(200);
    const body = (await moved.json()) as { success?: boolean; billedShop?: string };
    expect(body.success).toBe(true);
    expect(body.billedShop).toBe(SHOP_PAID);
    expect((await billingForShop(SHOP_PAID))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/other"
    );
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/mine"
    );
    expect((await sessionRow(sessionId))?.shop).toBe(SHOP_PAID);
    expect((await sessionRow(sessionId))?.pending_shop).toBe(SHOP_PAID);
  });

  it("blocks a different shop after a completed installation until Change Store", async () => {
    await saveShopifySession(SHOP_FAILED, "offline-token-installed", "write_products");
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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

  it("disconnects a completed install, keeps Shopify billing on that store, and allows reconnect", async () => {
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/reconnect",
    });
    await saveShopifySession(SHOP_FAILED, "offline-token-reconnect", "write_products");
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/reconnect"
    );
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
    expect((await billingForShop(SHOP_NEXT))?.subscriptionId).toBeUndefined();
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/reconnect"
    );
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
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/lock",
    });
    await expect(rehomeUninstalledBilling(SHOP_FAILED, SHOP_NEXT)).rejects.toBeInstanceOf(
      ShopBindingError
    );
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/lock"
    );
  });

  it("recovers uninstalled checkout sessions onto pending_shop without a new subscription", async () => {
    await upsertShop(SHOP_FAILED, { markInstalled: false });
    await seedShopifyBilling(SHOP_FAILED, {
      subscriptionGid: "gid://shopify/AppSubscription/recovery",
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
    });
    const recovered = await recoverUninstalledSessionBindings();
    expect(recovered).toBeGreaterThanOrEqual(1);
    const row = await sessionRow(sessionId);
    expect(row?.pending_shop).toBe(SHOP_FAILED);
    expect(new Date(String(row?.pending_shop_expires_at)).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
    expect((await billingForShop(SHOP_FAILED))?.subscriptionId).toBe(
      "gid://shopify/AppSubscription/recovery"
    );
  });

  it("exposes pending vs connected shops on subscriber status", async () => {
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
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

  it("does not expose another shop's Shopify billing on a leftover session domain", async () => {
    await seedShopifyBilling(SHOP_NEXT, {
      subscriptionGid: "gid://shopify/AppSubscription/paid-domain",
    });
    const sessionId = await issueAppSession({
      shop: SHOP_FAILED,
    });
    const { GET } = await import("../app/api/subscriber/status/route");
    const response = await GET(
      new NextRequest(`${ORIGIN}/api/subscriber/status`, {
        headers: { cookie: cookieHeader(sessionId) },
      })
    );
    const body = (await response.json()) as {
      shop?: string;
      billedShop?: string | null;
      pendingShop?: string | null;
    };
    expect(body.shop).toBe(SHOP_FAILED);
    expect(body.billedShop).toBeNull();
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
