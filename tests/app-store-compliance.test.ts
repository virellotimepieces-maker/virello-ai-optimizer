import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("Shopify App Store billing compliance", () => {
  it("hosts a public privacy policy", () => {
    expect(existsSync("app/privacy/page.tsx")).toBe(true);
    expect(read("app/privacy/page.tsx")).toMatch(/Privacy Policy/);
    expect(read("app/privacy/page.tsx")).toMatch(/shop\/redact/);
    expect(read("app/home-client.tsx")).toMatch(/\/privacy/);
  });

  it("has no Stripe checkout, portal, or webhook routes", () => {
    expect(existsSync("app/api/stripe/checkout/route.ts")).toBe(false);
    expect(existsSync("app/api/stripe/portal/route.ts")).toBe(false);
    expect(existsSync("app/api/stripe/webhook/route.ts")).toBe(false);
    expect(existsSync("app/api/_lib/stripe-billing.ts")).toBe(false);
    expect(existsSync("app/api/_lib/stripe-events.ts")).toBe(false);
  });

  it("creates paid app subscriptions through the GraphQL Admin API", () => {
    const billing = read("app/api/_lib/shopify-billing.ts");
    expect(billing).toMatch(/appSubscriptionCreate/);
    expect(billing).toMatch(/confirmationUrl/);
    expect(billing).toMatch(/EVERY_30_DAYS/);
    expect(billing).toMatch(/29\.99/);
    expect(billing).toMatch(/replacementBehavior: APPLY_IMMEDIATELY/);
    expect(billing).toMatch(/shopifyBillingIsTest/);
    expect(billing).toMatch(/ACTIVE|PENDING|DECLINED|CANCELLED|FROZEN|EXPIRED/);
    expect(read("app/api/billing/subscribe/route.ts")).toMatch(
      /createShopifyAppSubscription/
    );
    expect(read("app/api/billing/manage/route.ts")).toMatch(/shopifyBillingManageUrl/);
    expect(read("app/api/billing/return/route.ts")).toMatch(/syncShopifyBillingFromAdmin/);
  });

  it("keeps Subscribe and Manage working inside the embedded Admin iframe", () => {
    const home = read("app/home-client.tsx");
    const connect = read("app/connect/page.tsx");
    expect(home).toMatch(/\/api\/billing\/subscribe/);
    expect(home).toMatch(/\/api\/billing\/manage/);
    expect(home).toMatch(/assignTopLevel/);
    expect(connect).toMatch(/\/api\/billing\/subscribe/);
    expect(connect).toMatch(/\/api\/billing\/manage/);
    expect(connect).toMatch(/assignTopLevel/);
    expect(read("app/shopify-embed.ts")).toMatch(/window\.open\(url, "_top"\)/);
  });

  it("declares app subscription and mandatory GDPR webhooks", () => {
    const toml = read("shopify.app.toml");
    expect(toml).toMatch(/app_subscriptions\/update/);
    expect(toml).toMatch(/customers\/data_request/);
    expect(toml).toMatch(/customers\/redact/);
    expect(toml).toMatch(/shop\/redact/);
    expect(toml).toMatch(/app\/uninstalled/);
    expect(toml).not.toMatch(/use_legacy_install_flow\s*=/);
    expect(read("app/api/webhooks/route.ts")).toMatch(/app_subscriptions\/update/);
  });

  it("gates AI and Shopify product access on Shopify subscription status", () => {
    expect(read("app/api/_lib/product-access.ts")).toMatch(/accessStateForShop/);
    expect(read("app/api/_lib/subscriber.ts")).toMatch(/authorizeSubscriberForAI/);
    expect(read("app/api/_lib/subscriber.ts")).not.toMatch(/stripe/i);
    expect(read("app/api/ai/analyze/route.ts")).toMatch(/authorizeSubscriberForAI/);
    expect(read("app/api/_lib/shopify-products.ts")).toMatch(/ProductUpdateInput/);
    expect(read("app/api/shopify/products/route.ts")).toMatch(/requirePaidProductAccess/);
  });

  it("keeps expiring offline tokens and listing-app Client ID", () => {
    expect(read("app/api/_lib/shopify-auth.ts")).toMatch(/expiring/);
    expect(read("app/api/_lib/shopify-auth.ts")).toMatch(/refresh_token/);
    expect(read("shopify.app.toml")).toMatch(/059b113acaba78d855be9bc9500e421a/);
    expect(read("app/api/_lib/shopify-config.ts")).toMatch(
      /059b113acaba78d855be9bc9500e421a/
    );
  });
});
