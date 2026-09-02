import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  issueAppSession,
  isSessionIdShape,
  loadValidAppSession,
  newSessionId,
  rejectForgedOrMismatchedSession,
  sessionCookieOptions,
} from "../app/api/_lib/app-session";
import { getAppUrl } from "../app/api/_lib/app-url";
import {
  cleanupAppSessions,
  createAppSession,
  getActiveAppSession,
  getAppSessionById,
  revokeAppSessionsForShop,
  revokeShopifyInstallation,
  upsertShop,
} from "../app/api/_lib/shops";
import {
  assertSafeMutation,
  isAllowedRedirectUrl,
  OriginGuardError,
} from "../app/api/_lib/origin-guard";
import {
  createSignedOAuthState,
  verifyShopifyCallbackHmac,
  verifyShopifySessionToken,
  verifyShopifyWebhookHmac,
  verifySignedOAuthState,
} from "../app/api/_lib/shopify-security";
import {
  saveShopSubscription,
  storedSubscriberStatus,
  subscriptionPrivilegeChanged,
} from "../app/api/_lib/subscriber";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP_A = "store-alpha.myshopify.com";
const SHOP_B = "store-beta.myshopify.com";

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("Phase 3 Shopify security module", () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = "shopify-client-secret-value";
    process.env.APP_URL = "https://app.virello.example";
  });

  it("accepts a valid Shopify session JWT and rejects a forged one", () => {
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
      "shopify-client-secret-value"
    );
    expect(verifyShopifySessionToken(token).shop).toBe(SHOP_A);
    const [header, payload, signature] = token.split(".");
    const forgedSig =
      (signature[0] === "a" ? "b" : "a") + signature.slice(1);
    expect(() =>
      verifyShopifySessionToken(`${header}.${payload}.${forgedSig}`)
    ).toThrow(/signature/i);
  });

  it("verifies Shopify webhook HMAC and callback HMAC", () => {
    const body = '{"id":1}';
    const hmac = createHmac("sha256", "shopify-client-secret-value")
      .update(body, "utf8")
      .digest("base64");
    expect(verifyShopifyWebhookHmac(body, hmac)).toBe(true);
    expect(verifyShopifyWebhookHmac(body, "aaaa")).toBe(false);

    const params = new URLSearchParams({
      shop: SHOP_A,
      timestamp: "1700000000",
      code: "abc",
    });
    const message = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    params.set(
      "hmac",
      createHmac("sha256", "shopify-client-secret-value")
        .update(message)
        .digest("hex")
    );
    const request = new NextRequest(
      `https://app.virello.example/api/auth/shopify/callback?${params.toString()}`
    );
    expect(
      verifyShopifyCallbackHmac(request, "shopify-client-secret-value")
    ).toBe(true);
  });

  it("signs and verifies OAuth state for the expected shop only", () => {
    const state = createSignedOAuthState(
      SHOP_A,
      "shopify-client-secret-value"
    );
    expect(
      verifySignedOAuthState(state, SHOP_A, "shopify-client-secret-value")
    ).toBe(true);
    expect(
      verifySignedOAuthState(state, SHOP_B, "shopify-client-secret-value")
    ).toBe(false);
  });

  it("allowlists APP_URL and Shopify admin redirects and rejects others", () => {
    expect(
      isAllowedRedirectUrl("https://app.virello.example/connect")
    ).toBe(true);
    expect(
      isAllowedRedirectUrl(
        `https://admin.shopify.com/store/alpha/apps/virello-ai-optimizer`
      )
    ).toBe(true);
    expect(isAllowedRedirectUrl("https://evil.example/steal")).toBe(false);
    expect(isAllowedRedirectUrl("https://gfd1cp-1v.myshopify.com/")).toBe(false);
    expect(
      isAllowedRedirectUrl(
        "https://admin.shopify.com/store/gfd1cp-1v/oauth/authorize"
      )
    ).toBe(true);
  });

  it("rejects cross-origin POST mutations", () => {
    const request = new NextRequest("https://app.virello.example/api/stripe/portal", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSafeMutation(request)).toThrow(OriginGuardError);
  });
});

describe("Phase 3 cookie settings", () => {
  it("uses HttpOnly Secure SameSite=None with partitioned embedded cookies", () => {
    const embedded = sessionCookieOptions({ mode: "embedded", secure: true });
    const standalone = sessionCookieOptions({ mode: "standalone", secure: true });
    expect(embedded.httpOnly).toBe(true);
    expect(embedded.secure).toBe(true);
    expect(embedded.sameSite).toBe("none");
    expect(embedded.path).toBe("/");
    expect(embedded.partitioned).toBe(true);
    expect(standalone.partitioned).toBe(false);
    expect(isSessionIdShape(newSessionId())).toBe(true);
    expect(isSessionIdShape("not-a-session")).toBe(false);
  });
});

describe("Phase 3 app sessions", () => {
  beforeEach(async () => {
    process.env.APP_URL = "https://app.virello.example";
    await usePglite();
  });

  afterEach(() => {
    clearTestDatabase();
  });

  it("turns an active subscription into Manage-Subscription status", async () => {
    await upsertShop(SHOP_A);
    await saveShopSubscription(SHOP_A, {
      customerId: "cus_a",
      subscriptionId: "sub_a",
      status: "active",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });
    const sessionId = await issueAppSession({
      shop: SHOP_A,
      stripeCustomerId: "cus_a",
    });
    const session = await loadValidAppSession(sessionId, SHOP_A);
    expect(session?.shop).toBe(SHOP_A);
    const status = await storedSubscriberStatus(SHOP_A);
    expect(status.canManage).toBe(true);
    expect(status.subscriptionId).toBe("sub_a");
  });

  it("keeps a valid session across refresh and a simulated browser restart", async () => {
    const sessionId = await issueAppSession({ shop: SHOP_A });
    expect((await loadValidAppSession(sessionId, SHOP_A))?.id).toBe(sessionId);
    expect((await getActiveAppSession(sessionId, SHOP_A))?.id).toBe(sessionId);
  });

  it("issues distinct cookie modes for embedded and standalone without sharing payloads", async () => {
    const embedded = sessionCookieOptions({ mode: "embedded" });
    const standalone = sessionCookieOptions({ mode: "standalone" });
    expect(embedded.partitioned).not.toBe(standalone.partitioned);
    const sessionId = await issueAppSession({ shop: SHOP_A });
    expect(sessionId).not.toContain("cus_");
    expect(sessionId).not.toContain("sub_");
    expect(sessionId).not.toContain(SHOP_A);
  });

  it("rejects expired sessions", async () => {
    const id = newSessionId();
    await createAppSession({
      id,
      shop: SHOP_A,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await loadValidAppSession(id, SHOP_A)).toBeNull();
    expect(await rejectForgedOrMismatchedSession(id, SHOP_A)).toBe("expired");
  });

  it("rejects revoked sessions and rotates to a new id", async () => {
    const first = await issueAppSession({ shop: SHOP_A });
    const second = await issueAppSession({
      shop: SHOP_A,
      previousSessionId: first,
    });
    expect(second).not.toBe(first);
    expect(await loadValidAppSession(first, SHOP_A)).toBeNull();
    expect((await loadValidAppSession(second, SHOP_A))?.id).toBe(second);
    expect(await rejectForgedOrMismatchedSession(first, SHOP_A)).toBe("revoked");
  });

  it("revokes sessions on uninstall without deleting billing", async () => {
    await saveShopSubscription(SHOP_A, {
      customerId: "cus_keep",
      subscriptionId: "sub_keep",
      status: "active",
      currentPeriodStart: 1,
      currentPeriodEnd: 2,
    });
    const sessionId = await issueAppSession({
      shop: SHOP_A,
      stripeCustomerId: "cus_keep",
    });
    await revokeShopifyInstallation(SHOP_A);
    expect(await loadValidAppSession(sessionId, SHOP_A)).toBeNull();
    expect((await storedSubscriberStatus(SHOP_A)).subscriptionId).toBe(
      "sub_keep"
    );

    const reissued = await issueAppSession({
      shop: SHOP_A,
      stripeCustomerId: "cus_keep",
    });
    expect(await loadValidAppSession(reissued, SHOP_A)).toBeTruthy();
  });

  it("rejects forged cookies and tenant mismatches", async () => {
    const sessionId = await issueAppSession({ shop: SHOP_A });
    expect(await rejectForgedOrMismatchedSession("totally-forged", SHOP_A)).toBe(
      "forged"
    );
    expect(await rejectForgedOrMismatchedSession(newSessionId(), SHOP_A)).toBe(
      "forged"
    );
    expect(await rejectForgedOrMismatchedSession(sessionId, SHOP_B)).toBe(
      "mismatch"
    );
    expect(await loadValidAppSession(sessionId, SHOP_B)).toBeNull();
  });

  it("treats canceled Stripe subscriptions as inactive", async () => {
    await saveShopSubscription(SHOP_A, {
      customerId: "cus_a",
      subscriptionId: "sub_a",
      status: "canceled",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });
    const status = await storedSubscriberStatus(SHOP_A);
    expect(status.active).toBe(false);
    expect(status.status).toBe("canceled");
    expect(
      subscriptionPrivilegeChanged(
        {
          customerId: "cus_a",
          subscriptionId: "sub_a",
          status: "active",
          currentPeriodStart: 100,
          currentPeriodEnd: 200,
        },
        {
          customerId: "cus_a",
          subscriptionId: "sub_a",
          status: "canceled",
          currentPeriodStart: 100,
          currentPeriodEnd: 200,
        }
      )
    ).toBe(true);
  });

  it("cleans up expired and old revoked sessions", async () => {
    const expiredId = newSessionId();
    await createAppSession({
      id: expiredId,
      shop: SHOP_A,
      expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    const live = await issueAppSession({ shop: SHOP_A });
    await revokeAppSessionsForShop(SHOP_A);
    await cleanupAppSessions();
    expect(await getAppSessionById(expiredId)).toBeNull();
    expect(await getActiveAppSession(live, SHOP_A)).toBeNull();
  });
});

describe("APP_URL", () => {
  it("uses the configured public origin", () => {
    process.env.APP_URL = "https://app.virello.example/";
    expect(getAppUrl()).toBe("https://app.virello.example");
  });
});
