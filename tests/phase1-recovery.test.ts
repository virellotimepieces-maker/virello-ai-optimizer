import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeShop } from "../app/api/_lib/shopify-auth";
import { verifyStripeSignature } from "../app/api/_lib/stripe-signature";
import { getUsageLimit } from "../app/api/_lib/subscriber";
import {
  decryptShopifyToken,
  encryptShopifyToken,
} from "../app/api/_lib/shopify-session";

describe("recovered Shopify baseline", () => {
  it("normalizes myshopify domains and rejects others", () => {
    expect(normalizeShop("Store-One.myshopify.com")).toBe(
      "store-one.myshopify.com"
    );
    expect(normalizeShop("https://store-one.myshopify.com/admin")).toBe(
      "store-one.myshopify.com"
    );
    expect(normalizeShop("example.com")).toBe("");
    expect(normalizeShop("")).toBe("");
  });

  it("exposes a public live health check", async () => {
    const { GET } = await import("../app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok?: boolean; live?: boolean };
    expect(body.ok).toBe(true);
    expect(body.live).toBe(true);
  });

  it("uses a monthly AI allowance of 1000 by default", () => {
    delete process.env.AI_SUBSCRIBER_USAGE_LIMIT;
    expect(getUsageLimit()).toBe(1000);
  });

  it("accepts a positive integer AI_SUBSCRIBER_USAGE_LIMIT", () => {
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "1000";
    expect(getUsageLimit()).toBe(1000);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "0";
    expect(getUsageLimit()).toBe(1000);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "nope";
    expect(getUsageLimit()).toBe(1000);
    delete process.env.AI_SUBSCRIBER_USAGE_LIMIT;
  });
});

describe("Stripe webhook signatures", () => {
  const secret = "test-webhook-signing-secret";
  const body = '{"id":"evt_test","type":"checkout.session.completed"}';

  function headerFor(payload: string, ts: number) {
    const signature = createHmac("sha256", secret)
      .update(`${ts}.${payload}`)
      .digest("hex");
    return `t=${ts},v1=${signature}`;
  }

  it("accepts a current valid signature", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(body, headerFor(body, ts), secret)).toBe(
      true
    );
  });

  it("rejects a tampered body", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(
      verifyStripeSignature(`${body} `, headerFor(body, ts), secret)
    ).toBe(false);
  });

  it("rejects an expired timestamp", () => {
    const ts = Math.floor(Date.now() / 1000) - 400;
    expect(verifyStripeSignature(body, headerFor(body, ts), secret)).toBe(
      false
    );
  });
});

describe("Shopify token encryption", () => {
  beforeEach(() => {
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
  });

  it("round-trips an offline access token", () => {
    const token = "offline-token-fixture";
    const encrypted = encryptShopifyToken(token);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain(token);
    expect(decryptShopifyToken(encrypted)).toBe(token);
  });
});
