import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { assertSafeMutation, OriginGuardError } from "../app/api/_lib/origin-guard";
import { parseSaveProductInput } from "../app/api/_lib/shopify-products";
import { assertStripeMode, configuredStripeMode } from "../app/api/_lib/stripe-mode";
import { resolvedPortalReturnUrl } from "../app/api/_lib/origin-guard";
import { clearTestDatabase, usePglite } from "./helpers/pglite";
import {
  assertRateLimit,
  resetRateLimitForTests,
  RateLimitError,
} from "../app/api/_lib/rate-limit";

describe("Phase 7 authorization and abuse controls", () => {
  beforeEach(async () => {
    process.env.APP_URL = "https://app.virello.example";
    await usePglite();
    await resetRateLimitForTests();
  });

  afterEach(() => {
    clearTestDatabase();
  });

  it("rate-limits repeated clients", async () => {
    await assertRateLimit("ai:1", 2, 60_000);
    await assertRateLimit("ai:1", 2, 60_000);
    await expect(assertRateLimit("ai:1", 2, 60_000)).rejects.toBeInstanceOf(RateLimitError);
    await assertRateLimit("ai:2", 2, 60_000);
  });

  it("rejects mutation requests without an allowed origin", () => {
    const request = new NextRequest("https://app.virello.example/api/ai/analyze", {
      method: "POST",
    });
    expect(() => assertSafeMutation(request)).toThrow(OriginGuardError);
    const allowed = new NextRequest("https://app.virello.example/api/ai/analyze", {
      method: "POST",
      headers: { origin: "https://app.virello.example" },
    });
    expect(() => assertSafeMutation(allowed)).not.toThrow();
    process.env.ALLOWED_APP_ORIGINS = "https://alias.vercel.app";
    const alias = new NextRequest("https://app.virello.example/api/ai/analyze", {
      method: "POST",
      headers: { origin: "https://alias.vercel.app" },
    });
    expect(() => assertSafeMutation(alias)).not.toThrow();
    delete process.env.ALLOWED_APP_ORIGINS;
  });

  it("rejects unconfirmed saves and non-Shopify product IDs", () => {
    expect(() => parseSaveProductInput({ productId: "https://evil.example/1", confirmed: true })).toThrow(
      /Product ID/
    );
    const parsed = parseSaveProductInput({ productId: "123", confirmed: true });
    expect(parsed.productId).toBe("gid://shopify/Product/123");
    expect(parseSaveProductInput({ productId: "gid://shopify/Product/9", confirmed: true }).confirmed).toBe(true);
  });

  it("never mixes Stripe test and live secrets", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(configuredStripeMode()).toBe("test");
    expect(() => assertStripeMode("live", "test", "webhook")).toThrow(/live/);
    expect(resolvedPortalReturnUrl("https://evil.example")).toBe("https://app.virello.example");
  });

  it("keeps paid routes behind origin and access helpers", () => {
    const analyze = readFileSync("app/api/ai/analyze/route.ts", "utf8");
    const products = readFileSync("app/api/_lib/shopify-products.ts", "utf8");
    const route = readFileSync("app/api/shopify/products/route.ts", "utf8");
    const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
    const shopifyHook = readFileSync("app/api/webhooks/route.ts", "utf8");
    expect(analyze).toMatch(/assertSafeMutation/);
    expect(analyze).toMatch(/authorizeSubscriberForAI/);
    expect(route).toMatch(/requirePaidProductAccess/);
    expect(products).toMatch(/confirmed/);
    expect(webhook).toMatch(/verifyStripeSignature/);
    expect(shopifyHook).toMatch(/verifyShopifyWebhookHmac/);
  });

  it("does not ship clinic or template leftovers in app routes", () => {
    const files = readdirSync("app", { recursive: true }) as string[];
    for (const file of files) {
      if (!/\.(ts|tsx|md|css)$/.test(file)) continue;
      const text = readFileSync(join("app", file), "utf8").toLowerCase();
      expect(text).not.toMatch(/content clinic|framer|health-crisis|prompt clinic/);
    }
  });
});
