import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COPY } from "../app/i18n";
import { parseAppLocale } from "../app/api/_lib/locales";
import {
  assertGroundedResult,
  inventedClaimsIn,
  optimizeProduct,
  runOptimizeProduct,
  setOptimizerFetchForTests,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import { peekAiUsage } from "../app/api/_lib/usage";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import { getShopLocales, saveShopLocales } from "../app/api/_lib/shops";
import { seedShopifyBilling } from "./helpers/shopify-billing";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const product = {
  title: "Virello Gold Watch",
  description: "Stainless steel case. Japanese quartz movement.",
  productType: "Watch",
  vendor: "Virello",
  tags: ["watch", "gold"],
  price: "29.99",
};

const validJson = {
  analysis: {
    targetCustomer: "Watch buyers",
    purchaseMotivation: "Daily wear",
    strongestFeatures: ["Stainless steel case"],
    missingInformation: ["Water resistance is not listed"],
    conversionCopy: "Stainless steel case with Japanese quartz movement.",
  },
  optimization: {
    title: "Virello Gold Watch",
    description: "Stainless steel case. Japanese quartz movement.",
    seoTitle: "Virello Gold Watch",
    metaDescription: "Stainless steel case and Japanese quartz movement.",
    tags: ["watch", "gold"],
    conversionCopy: "Stainless steel case with Japanese quartz movement.",
  },
  reasoning: "Used only supplied facts.",
};

describe("Phase 6 language and copy", () => {
  it("parses EN/FIL locales and has matching dictionaries", () => {
    expect(parseAppLocale("FIL")).toBe("fil");
    expect(parseAppLocale("en-US")).toBe("en");
    expect(Object.keys(COPY.en).sort()).toEqual(Object.keys(COPY.fil).sort());
    expect(COPY.fil.connectShopify).toMatch(/Shopify/);
    expect(COPY.en.subscribe).toBe("Subscribe");
  });
});

describe("Phase 6 optimizer grounding", () => {
  it("rejects invented warranties, certifications, prices, and fake urgency", () => {
    const source = "gold watch stainless steel";
    expect(inventedClaimsIn(source, "lifetime warranty included").length).toBeGreaterThanOrEqual(1);
    expect(inventedClaimsIn(source, "FDA certified").length).toBeGreaterThanOrEqual(1);
    expect(inventedClaimsIn(source, "Now only $199").length).toBeGreaterThanOrEqual(1);
    expect(inventedClaimsIn(source, "Hurry, limited time offer").length).toBeGreaterThanOrEqual(1);
    expect(inventedClaimsIn("price 29.99 gold watch", "Gold watch for 29.99")).toHaveLength(0);
  });

  it("validates structured output", () => {
    const result = validateOptimizationResult(validJson);
    expect(result.optimization.seoTitle.length).toBeLessThanOrEqual(60);
    expect(result.optimization.metaDescription.length).toBeLessThanOrEqual(160);
    expect(result.analysis.missingInformation.some((warning) => /Water resistance/i.test(warning))).toBe(true);
    expect(() =>
      assertGroundedResult(product, {
        ...result,
        optimization: { ...result.optimization, description: "Certified waterproof guarantee" },
      })
    ).toThrow(/invented/i);
  });

  it("retries invalid JSON then returns a grounded result", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let calls = 0;
    setOptimizerFetchForTests(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({ choices: [{ message: { content: "not-json" } }] });
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            choices: [{ message: { content: JSON.stringify(validJson) } }],
          });
        },
      };
    });
    const result = await optimizeProduct(product, "en");
    expect(calls).toBe(2);
    expect(result.optimization.title).toBe("Virello Gold Watch");
    setOptimizerFetchForTests(null);
  });

  it("returns a safe factual fallback without consuming quota when the model is down", async () => {
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.OPENAI_API_KEY = "test-openai-key";
    await usePglite();
    await saveShopifySession("store-alpha.myshopify.com", "token", "write_products");
    await seedShopifyBilling("store-alpha.myshopify.com", {
      subscriptionGid: "sub_1",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });
    setOptimizerFetchForTests(async () => ({
      ok: false,
      status: 500,
      async text() {
        return JSON.stringify({ error: { message: "down" } });
      },
    }));
    const outcome = await runOptimizeProduct(product, "en");
    expect(outcome.chargeUsage).toBe(false);
    expect(outcome.result.optimization.title).toMatch(/Gold Watch/i);
    expect(() => assertGroundedResult(product, outcome.result)).not.toThrow();
    const usage = await peekAiUsage("store-alpha.myshopify.com", "sub_1", 100);
    expect(usage.used).toBe(0);
    setOptimizerFetchForTests(null);
    clearTestDatabase();
  });

  it("persists UI and product-output locales on the shop", async () => {
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    await usePglite();
    await saveShopifySession("store-alpha.myshopify.com", "token", "write_products");
    await saveShopLocales("store-alpha.myshopify.com", "fil", "en");
    const saved = await getShopLocales("store-alpha.myshopify.com");
    expect(saved).toMatchObject({ uiLocale: "fil", outputLocale: "en" });
    clearTestDatabase();
  });
});
