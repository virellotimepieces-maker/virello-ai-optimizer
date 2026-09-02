import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { issueAppSession, LEGACY_COOKIES } from "../app/api/_lib/app-session";
import { dbQuery } from "../app/api/_lib/database";
import { signLegacySubscriberCookieForTests } from "../app/api/_lib/legacy-subscriber-cookie";
import {
  isValidPortalReturnUrl,
  portalReturnUrl,
  resolvedPortalReturnUrl,
} from "../app/api/_lib/origin-guard";
import {
  ProductAccessError,
  requirePaidProductAccess,
} from "../app/api/_lib/product-access";
import { saveShopifySession, ShopifyAuthError } from "../app/api/_lib/shopify-auth";
import {
  isShopifyInstallationActive,
  revokeShopifyInstallation,
} from "../app/api/_lib/shops";
import { productAccessDecision } from "../app/api/_lib/stripe-access";
import { billingForShop } from "../app/api/_lib/stripe-billing";
import {
  applyInvoiceEvent,
  applyStripeObjectEvent,
  applySubscriptionEvent,
} from "../app/api/_lib/stripe-events";
import {
  assertStripeMode,
  assertWebhookSecretConfigured,
  configuredStripeMode,
  StripeModeError,
  stripeModeFromSecret,
} from "../app/api/_lib/stripe-mode";
import {
  assertStripePrice,
  assertSubscriptionPriceId,
  StripePriceError,
  VIRELLO_PRICE_UNIT_AMOUNT,
} from "../app/api/_lib/stripe-price";
import { verifyStripeSignature } from "../app/api/_lib/stripe-signature";
import {
  getShopForSubscriberCookie,
  storedSubscriberStatus,
} from "../app/api/_lib/subscriber";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../app/api/_lib/webhook-events";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const SHOP = "store-alpha.myshopify.com";

const validPrice = {
  id: "price_monthly",
  active: true,
  type: "recurring" as const,
  unit_amount: VIRELLO_PRICE_UNIT_AMOUNT,
  currency: "usd",
  recurring: { interval: "month", interval_count: 1 },
  livemode: false,
};

function subscriptionObject(status: string, createdExtra: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status,
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
    livemode: false,
    metadata: { shop: SHOP },
    items: {
      data: [
        {
          price: { id: "price_monthly" },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
    ...createdExtra,
  };
}

function paidRequest(cookie?: string) {
  return new NextRequest("https://app.virello.example/api/ai/analyze", {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
  });
}

describe("Phase 4 Stripe price and mode", () => {
  it("accepts a $29.99 USD monthly recurring Price and rejects others", () => {
    expect(() => assertStripePrice(validPrice, "test")).not.toThrow();
    expect(() =>
      assertStripePrice({ ...validPrice, unit_amount: 1999 }, "test")
    ).toThrow(StripePriceError);
    expect(() =>
      assertStripePrice({ ...validPrice, recurring: null }, "test")
    ).toThrow(/monthly|recurring/i);
    expect(() =>
      assertStripePrice(
        { ...validPrice, type: "one_time", recurring: { interval: "month", interval_count: 1 } },
        "test"
      )
    ).toThrow(/one-time/i);
    expect(() =>
      assertStripePrice({ ...validPrice, active: false }, "test")
    ).toThrow(/active/i);
    expect(() =>
      assertStripePrice({ ...validPrice, recurring: { interval: "year", interval_count: 1 } }, "test")
    ).toThrow(/month/i);
    expect(() =>
      assertStripePrice({ ...validPrice, recurring: { interval: "month", interval_count: 2 } }, "test")
    ).toThrow(/1 month/i);
    expect(() =>
      assertStripePrice({ ...validPrice, currency: "eur" }, "test")
    ).toThrow(/USD/i);
  });

  it("fails closed when Stripe test and live modes are mixed", () => {
    expect(stripeModeFromSecret("sk_test_abc")).toBe("test");
    expect(stripeModeFromSecret("sk_live_abc")).toBe("live");
    expect(() => stripeModeFromSecret("rk_test_abc")).toThrow(StripeModeError);
    expect(() => assertStripeMode("live", "test", "Price")).toThrow(/live/);
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(configuredStripeMode()).toBe("test");
    expect(() =>
      assertStripePrice({ ...validPrice, livemode: true }, "test")
    ).toThrow(/live/);
    expect(() => assertWebhookSecretConfigured("not-a-secret")).toThrow(/WEBHOOK/);
    expect(() => assertWebhookSecretConfigured("whsec_abc")).not.toThrow();
    process.env.STRIPE_PRICE_ID = "price_monthly";
    expect(() => assertSubscriptionPriceId("price_other")).toThrow(StripePriceError);
    delete process.env.STRIPE_PRICE_ID;
  });

  it("rejects Customer Portal return URLs that are not APP_URL and ignores browser-supplied URLs", () => {
    process.env.APP_URL = "https://app.virello.example";
    expect(portalReturnUrl()).toBe("https://app.virello.example");
    expect(isValidPortalReturnUrl("https://app.virello.example/")).toBe(true);
    expect(isValidPortalReturnUrl("https://evil.example/return")).toBe(false);
    expect(isValidPortalReturnUrl("https://app.virello.example/ok")).toBe(true);
    expect(resolvedPortalReturnUrl("https://evil.example/steal")).toBe(
      "https://app.virello.example"
    );
    expect(resolvedPortalReturnUrl("https://app.virello.example/from-browser")).toBe(
      "https://app.virello.example"
    );
  });
});

describe("Phase 4 access matrix", () => {
  it("defines product access and Manage Subscription from Stripe status", () => {
    expect(productAccessDecision({ shopInstalled: true, status: "active" })).toMatchObject({
      productAccess: true,
      canManage: true,
    });
    expect(productAccessDecision({ shopInstalled: true, status: "trialing" }).productAccess).toBe(true);
    expect(productAccessDecision({ shopInstalled: true, status: "past_due" })).toMatchObject({
      productAccess: false,
      canManage: true,
      reason: "past_due",
    });
    expect(productAccessDecision({ shopInstalled: true, status: "unpaid" }).productAccess).toBe(false);
    expect(productAccessDecision({ shopInstalled: true, status: "incomplete" }).productAccess).toBe(false);
    expect(productAccessDecision({ shopInstalled: true, status: "paused" }).productAccess).toBe(false);
    expect(productAccessDecision({ shopInstalled: true, status: "canceled" }).canManage).toBe(false);
    expect(
      productAccessDecision({ shopInstalled: true, status: "incomplete_expired" }).canManage
    ).toBe(false);
    expect(productAccessDecision({ shopInstalled: false, status: "active" })).toMatchObject({
      productAccess: false,
      reason: "not_installed",
      canManage: true,
    });
    expect(
      productAccessDecision({
        shopInstalled: true,
        status: "active",
        lastInvoiceStatus: "failed",
      }).productAccess
    ).toBe(false);
  });
});

describe("Phase 4 billing persistence", () => {
  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.APP_URL = "https://app.virello.example";
    process.env.SUBSCRIBER_COOKIE_SECRET = "legacy-secret";
    await usePglite();
  });

  afterEach(() => {
    clearTestDatabase();
    delete process.env.STRIPE_PRICE_ID;
  });

  it("applies checkout and subscription lifecycle events and keeps Manage state after refresh", async () => {
    await applyStripeObjectEvent({
      type: "checkout.session.completed",
      object: {
        id: "cs_1",
        client_reference_id: SHOP,
        livemode: false,
        subscription: subscriptionObject("active"),
      },
      eventCreated: 10,
      livemode: false,
    });
    await applyStripeObjectEvent({
      type: "customer.subscription.created",
      object: subscriptionObject("active"),
      eventCreated: 11,
      livemode: false,
    });
    await applyStripeObjectEvent({
      type: "customer.subscription.updated",
      object: subscriptionObject("active"),
      eventCreated: 12,
      livemode: false,
    });

    const first = await storedSubscriberStatus(SHOP);
    expect(first.canManage).toBe(true);
    expect(first.subscriptionId).toBe("sub_1");
    const again = await storedSubscriberStatus(SHOP);
    expect(again.canManage).toBe(true);
    expect(again.customerId).toBe("cus_1");

    const customers = await dbQuery<{ stripe_customer_id: string }>(
      "SELECT stripe_customer_id FROM stripe_customers WHERE shop = $1",
      [SHOP]
    );
    expect(customers[0]?.stripe_customer_id).toBe("cus_1");
  });

  it("ignores stale out-of-order subscription events and duplicate webhook ids", async () => {
    await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("active"),
      eventCreated: 200,
      livemode: false,
    });
    const stale = await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("incomplete"),
      eventCreated: 50,
      livemode: false,
    });
    expect(stale.applied).toBe(false);
    expect((await billingForShop(SHOP))?.status).toBe("active");

    const first = await claimWebhookEvent({
      provider: "stripe",
      eventId: "evt_dup",
      eventType: "customer.subscription.updated",
      shop: SHOP,
      providerCreated: 200,
    });
    expect(first).toBe("claimed");
    await markWebhookEvent("stripe", "evt_dup", "processed");
    const again = await claimWebhookEvent({
      provider: "stripe",
      eventId: "evt_dup",
      eventType: "customer.subscription.updated",
      shop: SHOP,
      providerCreated: 200,
    });
    expect(again).toBe("duplicate");
  });

  it("records failed payments, cancellation, and renewal", async () => {
    await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("active"),
      eventCreated: 10,
      livemode: false,
    });
    await applyStripeObjectEvent({
      type: "invoice.payment_failed",
      object: {
        id: "in_fail",
        customer: "cus_1",
        subscription: "sub_1",
        status: "open",
        paid: false,
        livemode: false,
        metadata: { shop: SHOP },
      },
      eventCreated: 11,
      livemode: false,
    });
    expect((await storedSubscriberStatus(SHOP)).active).toBe(false);
    expect((await billingForShop(SHOP))?.lastInvoiceStatus).toBe("failed");

    const invoices = await dbQuery<{ stripe_invoice_id: string; paid: boolean }>(
      "SELECT stripe_invoice_id, paid FROM stripe_invoices WHERE shop = $1 ORDER BY stripe_invoice_id",
      [SHOP]
    );
    expect(invoices.map((row) => row.stripe_invoice_id)).toContain("in_fail");

    await applyStripeObjectEvent({
      type: "invoice.paid",
      object: {
        id: "in_paid",
        customer: "cus_1",
        subscription: "sub_1",
        status: "paid",
        paid: true,
        livemode: false,
        metadata: { shop: SHOP },
      },
      eventCreated: 12,
      livemode: false,
    });
    const staleFailed = await applyInvoiceEvent({
      object: {
        id: "in_fail",
        customer: "cus_1",
        subscription: "sub_1",
        status: "open",
        paid: false,
        livemode: false,
        metadata: { shop: SHOP },
      },
      eventType: "invoice.payment_failed",
      eventCreated: 11,
      livemode: false,
    });
    expect(staleFailed.applied).toBe(false);
    expect((await billingForShop(SHOP))?.lastInvoiceStatus).toBe("paid");

    await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("active"),
      eventCreated: 13,
      livemode: false,
    });
    expect((await storedSubscriberStatus(SHOP)).canManage).toBe(true);

    await applyStripeObjectEvent({
      type: "customer.subscription.deleted",
      object: subscriptionObject("canceled", { canceled_at: 14 }),
      eventCreated: 14,
      livemode: false,
    });
    const canceled = await storedSubscriberStatus(SHOP);
    expect(canceled.active).toBe(false);
    expect(canceled.canManage).toBe(false);
  });

  it("revokes product access on uninstall while keeping Stripe billing, then restores after reinstall", async () => {
    await saveShopifySession(SHOP, "offline-token-alpha", "read_products");
    await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("active"),
      eventCreated: 20,
      livemode: false,
    });
    expect(await isShopifyInstallationActive(SHOP)).toBe(true);
    let status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(true);
    expect(status.canManage).toBe(true);

    await revokeShopifyInstallation(SHOP);
    expect(await isShopifyInstallationActive(SHOP)).toBe(false);
    status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(false);
    expect(status.canManage).toBe(true);
    expect(status.subscriptionId).toBe("sub_1");

    await saveShopifySession(SHOP, "offline-token-reinstall", "read_products");
    status = await storedSubscriberStatus(SHOP);
    expect(status.active).toBe(true);
    expect(status.shopInstalled).toBe(true);
  });

  it("denies unauthorized paid API access without an eligible subscription", async () => {
    await expect(requirePaidProductAccess(paidRequest())).rejects.toBeInstanceOf(
      ShopifyAuthError
    );

    await saveShopifySession(SHOP, "offline-token-alpha", "read_products");
    const sessionId = await issueAppSession({ shop: SHOP });
    await expect(
      requirePaidProductAccess(paidRequest(`virello_sid=${sessionId}`))
    ).rejects.toBeInstanceOf(ProductAccessError);

    await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("past_due"),
      eventCreated: 30,
      livemode: false,
    });
    await expect(
      requirePaidProductAccess(paidRequest(`virello_sid=${sessionId}`))
    ).rejects.toMatchObject({ status: 402 });
  });

  it("migrates a valid legacy subscriber cookie into the current shop without writing it again", async () => {
    await applySubscriptionEvent({
      shop: SHOP,
      object: subscriptionObject("active"),
      eventCreated: 40,
      livemode: false,
    });
    const payload = signLegacySubscriberCookieForTests(
      { v: 1, subscriptionId: "sub_1", customerId: "cus_1" },
      "legacy-secret"
    );
    const request = new NextRequest("https://app.virello.example/api/subscriber/status", {
      headers: { cookie: `virello_subscriber=${payload}` },
    });
    expect(await getShopForSubscriberCookie(request)).toBe(SHOP);

    const subscriberSource = readFileSync("app/api/_lib/subscriber.ts", "utf8");
    expect(subscriberSource).not.toMatch(/cookies\.set\(\s*["']virello_subscriber["']/);
    expect(LEGACY_COOKIES).toEqual([
      "virello_subscriber",
      "virello_shopify_shop",
      "virello_shopify_access_token",
    ]);
  });
});

describe("Phase 4 webhook signatures stay replay-bounded", () => {
  it("rejects a future-dated signature outside tolerance", () => {
    const secret = "whsec_abc";
    const body = '{"id":"evt_1"}';
    const ts = Math.floor(Date.now() / 1000) + 400;
    const signature = createHmac("sha256", secret)
      .update(`${ts}.${body}`)
      .digest("hex");
    expect(verifyStripeSignature(body, `t=${ts},v1=${signature}`, secret)).toBe(false);
  });
});
