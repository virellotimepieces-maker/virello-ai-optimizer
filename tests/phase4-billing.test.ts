import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import {
  isValidPortalReturnUrl,
  portalReturnUrl,
  resolvedPortalReturnUrl,
} from "../app/api/_lib/origin-guard";
import {
  ProductAccessError,
  requirePaidProductAccess,
} from "../app/api/_lib/product-access";
import { productAccessDecision } from "../app/api/_lib/billing-access";
import { saveShopifySession, ShopifyAuthError } from "../app/api/_lib/shopify-auth";
import { setShopifyAdminFetchForTests } from "../app/api/_lib/shopify-admin";
import {
  applyAppSubscriptionWebhook,
  billingForShop,
  billingReturnAppUrl,
  createShopifyAppSubscription,
  shopifyBillingIsTest,
  shopifyBillingManageUrl,
  VIRELLO_PRICE_AMOUNT,
  VIRELLO_PRICE_CENTS,
} from "../app/api/_lib/shopify-billing";
import {
  isShopifyInstallationActive,
  revokeShopifyInstallation,
} from "../app/api/_lib/shops";
import {
  getShopForSubscriberCookie,
  storedSubscriberStatus,
} from "../app/api/_lib/subscriber";
import { claimWebhookEvent, markWebhookEvent } from "../app/api/_lib/webhook-events";
import { clearTestDatabase, usePglite } from "./helpers/pglite";
import {
  mockShopifyBillingGraphql,
  seedShopifyBilling,
  TEST_CONFIRMATION_URL,
  TEST_SUBSCRIPTION_GID,
} from "./helpers/shopify-billing";

const SHOP = "store-alpha.myshopify.com";
const SECRET = "shopify-client-secret-value";

function paidRequest(cookie?: string) {
  return new NextRequest("https://app.virello.example/api/ai/analyze", {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
  });
}

describe("Phase 4 Shopify billing price and test charges", () => {
  it("bills $29.99 USD every 30 days", () => {
    expect(VIRELLO_PRICE_AMOUNT).toBe("29.99");
    expect(VIRELLO_PRICE_CENTS).toBe(2999);
  });

  it("defaults to test charges and always tests partner development stores", () => {
    delete process.env.SHOPIFY_BILLING_TEST;
    expect(shopifyBillingIsTest()).toBe(true);
    expect(shopifyBillingIsTest(true)).toBe(true);
    process.env.SHOPIFY_BILLING_TEST = "false";
    expect(shopifyBillingIsTest(false)).toBe(false);
    expect(shopifyBillingIsTest(true)).toBe(true);
    process.env.SHOPIFY_BILLING_TEST = "true";
    expect(shopifyBillingIsTest(false)).toBe(true);
    delete process.env.SHOPIFY_BILLING_TEST;
  });
});

describe("Phase 4 return URLs", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://app.virello.example";
  });

  it("keeps portal-style return URLs on APP_URL", () => {
    expect(isValidPortalReturnUrl("https://app.virello.example/connect")).toBe(true);
    expect(isValidPortalReturnUrl("https://evil.example")).toBe(false);
    expect(resolvedPortalReturnUrl("https://app.virello.example/from-browser")).toBe(
      "https://app.virello.example"
    );
  });

  it("requires APP_URL for billing return URLs", () => {
    delete process.env.APP_URL;
    expect(() => portalReturnUrl()).toThrow(/APP_URL is not configured/);
    process.env.APP_URL = "https://app.virello.example";
  });

  it("returns merchants to Admin after embedded billing confirmation", () => {
    expect(billingReturnAppUrl(SHOP, "standalone")).toContain("checkout=success");
    expect(billingReturnAppUrl(SHOP, "embedded")).toContain("admin.shopify.com");
  });
});

describe("Phase 4 access matrix", () => {
  it("defines product access and Manage Subscription from Shopify status", () => {
    expect(productAccessDecision({ shopInstalled: true, status: "ACTIVE" })).toMatchObject({
      productAccess: true,
      canManage: true,
      reason: "ok",
    });
    expect(productAccessDecision({ shopInstalled: true, status: "PENDING" })).toMatchObject({
      productAccess: false,
      canManage: true,
      reason: "pending",
    });
    expect(productAccessDecision({ shopInstalled: true, status: "FROZEN" })).toMatchObject({
      productAccess: false,
      canManage: true,
      reason: "frozen",
    });
    expect(productAccessDecision({ shopInstalled: true, status: "DECLINED" })).toMatchObject({
      productAccess: false,
      canManage: false,
      reason: "declined",
    });
    expect(productAccessDecision({ shopInstalled: true, status: "CANCELLED" })).toMatchObject({
      productAccess: false,
      canManage: false,
      reason: "cancelled",
    });
    expect(productAccessDecision({ shopInstalled: true, status: "EXPIRED" })).toMatchObject({
      productAccess: false,
      canManage: false,
      reason: "expired",
    });
    expect(productAccessDecision({ shopInstalled: true, status: null })).toMatchObject({
      productAccess: false,
      canManage: false,
      reason: "no_subscription",
    });
    expect(productAccessDecision({ shopInstalled: false, status: "ACTIVE" })).toMatchObject({
      productAccess: false,
      reason: "not_installed",
      canManage: true,
    });
  });
});

describe("Phase 4 billing persistence", () => {
  beforeEach(async () => {
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.APP_URL = "https://app.virello.example";
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    delete process.env.SHOPIFY_BILLING_TEST;
    await usePglite();
  });

  afterEach(() => {
    setShopifyAdminFetchForTests(null);
    clearTestDatabase();
    delete process.env.SHOPIFY_BILLING_TEST;
  });

  it("creates a recurring app subscription and stores the confirmation URL", async () => {
    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    mockShopifyBillingGraphql();
    const created = await createShopifyAppSubscription({
      shop: SHOP,
      accessToken: "offline-token-alpha",
    });
    expect(created.confirmationUrl).toBe(TEST_CONFIRMATION_URL);
    expect(created.test).toBe(true);
    expect(created.billing.status).toBe("PENDING");
    expect(created.billing.amountCents).toBe(2999);
    expect(shopifyBillingManageUrl(SHOP, created.billing)).toBe(TEST_CONFIRMATION_URL);
  });

  it("forces test charges on partner development stores even when live is requested", async () => {
    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    process.env.SHOPIFY_BILLING_TEST = "false";
    let createdTest = true;
    mockShopifyBillingGraphql({
      partnerDevelopment: true,
      created: {
        confirmationUrl: TEST_CONFIRMATION_URL,
        appSubscription: {
          id: "gid://shopify/AppSubscription/dev",
          name: "Virello AI Optimizer",
          status: "PENDING",
          test: true,
        },
        userErrors: [],
      },
    });
    setShopifyAdminFetchForTests(async (_url, init) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const query = String(body.query || "");
      if (query.includes("appSubscriptionCreate")) {
        createdTest = Boolean(body.variables?.test);
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          async text() {
            return JSON.stringify({
              data: {
                appSubscriptionCreate: {
                  confirmationUrl: TEST_CONFIRMATION_URL,
                  appSubscription: {
                    id: "gid://shopify/AppSubscription/dev",
                    name: "Virello AI Optimizer",
                    status: "PENDING",
                    test: true,
                  },
                  userErrors: [],
                },
              },
            });
          },
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        async text() {
          return JSON.stringify({
            data: {
              shop: { plan: { partnerDevelopment: true } },
              currentAppInstallation: { activeSubscriptions: [] },
            },
          });
        },
      };
    });
    const created = await createShopifyAppSubscription({
      shop: SHOP,
      accessToken: "offline-token-alpha",
    });
    expect(createdTest).toBe(true);
    expect(created.test).toBe(true);
  });

  it("applies app subscription webhook statuses and keeps Manage after refresh", async () => {
    await seedShopifyBilling(SHOP, {
      status: "PENDING",
      confirmationUrl: TEST_CONFIRMATION_URL,
    });
    await applyAppSubscriptionWebhook(SHOP, {
      app_subscription: {
        admin_graphql_api_id: TEST_SUBSCRIPTION_GID,
        name: "Virello AI Optimizer",
        status: "ACTIVE",
      },
    });
    let status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(false);
    expect(status.canManage).toBe(true);
    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(true);
    expect(status.canManage).toBe(true);
    expect(status.subscriptionId).toBe(TEST_SUBSCRIPTION_GID);
    expect(status.billingTest).toBe(true);

    await applyAppSubscriptionWebhook(SHOP, {
      app_subscription: {
        admin_graphql_api_id: TEST_SUBSCRIPTION_GID,
        status: "CANCELLED",
      },
    });
    const canceled = await storedSubscriberStatus(SHOP);
    expect(canceled.active).toBe(false);
    expect(canceled.canManage).toBe(false);
    expect(canceled.status).toBe("CANCELLED");
  });

  it("acks app_subscriptions/update after HMAC", async () => {
    process.env.SHOPIFY_API_SECRET = SECRET;
    await seedShopifyBilling(SHOP, { status: "PENDING" });
    const { POST } = await import("../app/api/webhooks/route");
    const body = JSON.stringify({
      app_subscription: {
        admin_graphql_api_id: TEST_SUBSCRIPTION_GID,
        status: "ACTIVE",
      },
    });
    const hmac = createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
    const response = await POST(
      new Request("https://app.virello.example/api/webhooks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-hmac-sha256": hmac,
          "x-shopify-topic": "app_subscriptions/update",
          "x-shopify-shop-domain": SHOP,
        },
        body,
      })
    );
    expect(response.status).toBe(200);
    expect((await billingForShop(SHOP))?.status).toBe("ACTIVE");
  });

  it("revokes product access on uninstall while keeping Shopify billing, then restores after reinstall", async () => {
    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    await seedShopifyBilling(SHOP, { status: "ACTIVE" });
    expect(await isShopifyInstallationActive(SHOP)).toBe(true);
    let status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(true);
    expect(status.canManage).toBe(true);

    await revokeShopifyInstallation(SHOP);
    expect(await isShopifyInstallationActive(SHOP)).toBe(false);
    status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(false);
    expect(status.canManage).toBe(true);
    expect(status.subscriptionId).toBe(TEST_SUBSCRIPTION_GID);

    await saveShopifySession(SHOP, "offline-token-reinstall", "write_products");
    status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(true);
    expect(status.shopInstalled).toBe(true);
  });

  it("denies unauthorized paid API access without an eligible subscription", async () => {
    await expect(requirePaidProductAccess(paidRequest())).rejects.toBeInstanceOf(
      ShopifyAuthError
    );

    await saveShopifySession(SHOP, "offline-token-alpha", "write_products");
    const sessionId = await issueAppSession({ shop: SHOP });
    await expect(
      requirePaidProductAccess(paidRequest(`virello_sid=${sessionId}`))
    ).rejects.toBeInstanceOf(ProductAccessError);

    await seedShopifyBilling(SHOP, { status: "PENDING" });
    await expect(
      requirePaidProductAccess(paidRequest(`virello_sid=${sessionId}`))
    ).rejects.toMatchObject({ status: 402 });

    await seedShopifyBilling(SHOP, { status: "ACTIVE" });
    const allowed = await requirePaidProductAccess(
      paidRequest(`virello_sid=${sessionId}`)
    );
    expect(allowed.shop).toBe(SHOP);
    expect(allowed.billing.status).toBe("ACTIVE");
  });

  it("reads the shop from the app session cookie", async () => {
    const sessionId = await issueAppSession({ shop: SHOP });
    const request = paidRequest(`virello_sid=${sessionId}`);
    expect(await getShopForSubscriberCookie(request)).toBe(SHOP);
  });

  it("does not treat duplicate Shopify webhook ids as new work", async () => {
    const first = await claimWebhookEvent({
      provider: "shopify",
      eventId: "wh_billing_1",
      eventType: "app_subscriptions/update",
      shop: SHOP,
    });
    expect(first).toBe("claimed");
    await markWebhookEvent("shopify", "wh_billing_1", "processed");
    const second = await claimWebhookEvent({
      provider: "shopify",
      eventId: "wh_billing_1",
      eventType: "app_subscriptions/update",
      shop: SHOP,
    });
    expect(second).toBe("duplicate");
  });
});
