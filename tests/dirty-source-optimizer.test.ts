import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertGroundedResult,
  runOptimizeProduct,
  setOptimizerFetchForTests,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import {
  hasDropshippingLanguage,
  hasValueHypeLanguage,
  listingFacts,
  publishableCopy,
  sanitizeProductSource,
} from "../app/api/_lib/optimizer-copy";
import { COPY } from "../app/i18n";
import { consumeAiUsage, peekAiUsage } from "../app/api/_lib/usage";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import { seedShopifyBilling } from "./helpers/shopify-billing";
import { clearTestDatabase, usePglite } from "./helpers/pglite";

const dirtyWatch = {
  title: "Harbor Field Watch",
  description:
    "Elevate your look with this affordable elegance must-have. Budget-friendly and priced at just $19. Shop now. Perfect for everyone.",
  productType: "Watch",
  vendor: "Harbor",
  tags: ["watch", "must-have"],
};

const listedWatch = {
  title: "Virello Gold Watch",
  description: "Stainless steel case. Japanese quartz movement.",
  productType: "Watch",
  vendor: "Virello",
  tags: ["watch", "gold"],
  price: "29.99",
};

const groundedPayload = {
  analysis: {
    missingInformation: ["Water resistance is not listed"],
  },
  optimization: {
    title: "Virello Gold Watch",
    description: "Virello Gold Watch has a stainless steel case and Japanese quartz movement.",
    seoTitle: "Virello Gold Watch steel",
    metaDescription: "Virello Gold Watch with stainless steel case and Japanese quartz movement.",
    tags: ["watch", "gold"],
    conversionCopy: "Stainless steel case with Japanese quartz movement.",
  },
};

const inventedPayload = {
  analysis: { missingInformation: [] },
  optimization: {
    title: "Virello Gold Watch",
    description:
      "Virello Gold Watch has a stainless steel case and a waterproof titanium shell with Japanese quartz movement.",
    seoTitle: "Virello Gold Watch titanium",
    metaDescription: "Virello Gold Watch with waterproof titanium shell and Japanese quartz movement.",
    tags: ["watch", "gold", "titanium"],
    conversionCopy: "Waterproof titanium shell with Japanese quartz movement.",
  },
};

const echoedDirtyPayload = {
  analysis: { missingInformation: [] },
  optimization: {
    title: "Harbor Field Watch — elevate your look, affordable elegance",
    description:
      "Elevate your look with this affordable elegance must-have. Budget-friendly and priced at just $19. Shop now.",
    benefitBullets: ["Must-have", "Shop now", "Affordable elegance"],
    seoTitle: "Buy now Harbor Field Watch",
    metaDescription: "Shop now for this budget-friendly must-have. Affordable elegance.",
    tags: ["must-have"],
    callToAction: "Shop now",
    conversionCopy: "Affordable elegance. Shop now.",
  },
};

function modelReply(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      if (!ok) return JSON.stringify({ error: { message: "down" } });
      return JSON.stringify({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      });
    },
  };
}

afterEach(() => {
  setOptimizerFetchForTests(null);
});

describe("Dirty source text is sanitized, not treated as product facts", () => {
  it("strips dropshipping and value-hype from imported source fields", () => {
    const cleaned = sanitizeProductSource(dirtyWatch);
    expect(cleaned.description || "").not.toMatch(
      /elevate your look|affordable elegance|shop now|budget-friendly|priced at just|must-have|perfect for everyone/i
    );
    expect(listingFacts(dirtyWatch).join(" ")).not.toMatch(
      /elevate your look|affordable elegance|shop now|budget-friendly|priced at just/i
    );
    expect(listingFacts(dirtyWatch).join(" ")).toMatch(/Harbor|Watch/i);
  });

  it("returns a grounded proposed result when the model copies dirty source marketing", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    setOptimizerFetchForTests(async () => modelReply(echoedDirtyPayload));
    const outcome = await runOptimizeProduct(dirtyWatch, "en");
    const pub = publishableCopy(outcome.result);
    expect(outcome.result.optimization.title).toBeTruthy();
    expect(outcome.result.optimization.description).toBeTruthy();
    expect(hasDropshippingLanguage(pub)).toBe(false);
    expect(hasValueHypeLanguage(pub)).toBe(false);
    expect(pub).not.toMatch(/shop now|buy now|affordable elegance|budget-friendly|priced at just/i);
    expect(() => assertGroundedResult(dirtyWatch, outcome.result)).not.toThrow();
    expect(outcome.chargeUsage).toBe(true);
  });

  it("validates dirty imported copy without throwing a blocking grounding error", () => {
    const result = validateOptimizationResult(echoedDirtyPayload, dirtyWatch);
    expect(() => assertGroundedResult(dirtyWatch, result)).not.toThrow();
    expect(hasDropshippingLanguage(publishableCopy(result))).toBe(false);
    expect(hasValueHypeLanguage(publishableCopy(result))).toBe(false);
  });
});

describe("Automatic retry, safe fallback, and one usage charge", () => {
  it("retries once when the first model result fails grounding", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let calls = 0;
    setOptimizerFetchForTests(async (_url, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body || "{}")) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      if (calls === 1) return modelReply(inventedPayload);
      expect(body.messages?.[0]?.content || "").toMatch(/Retry:/i);
      expect(body.messages?.[0]?.content || "").toMatch(/Validation failures:/i);
      expect(body.messages?.[0]?.content || "").toMatch(/Verified product facts:/i);
      expect(body.messages?.[0]?.content || "").toMatch(/not a product fact/i);
      return modelReply(groundedPayload);
    });
    const outcome = await runOptimizeProduct(listedWatch, "en");
    expect(calls).toBe(2);
    expect(outcome.chargeUsage).toBe(true);
    expect(publishableCopy(outcome.result)).not.toMatch(/titanium|waterproof/i);
    expect(() => assertGroundedResult(listedWatch, outcome.result)).not.toThrow();
  });

  it("returns a safe factual fallback and does not charge when both attempts fail", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    await usePglite();
    await saveShopifySession("store-alpha.myshopify.com", "token", "write_products");
    await seedShopifyBilling("store-alpha.myshopify.com", {
      subscriptionGid: "sub_fallback",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });
    let calls = 0;
    setOptimizerFetchForTests(async () => {
      calls += 1;
      return modelReply({}, false, 500);
    });
    const outcome = await runOptimizeProduct(listedWatch, "en");
    expect(calls).toBe(2);
    expect(outcome.chargeUsage).toBe(false);
    expect(outcome.result.optimization.title).toMatch(/Gold Watch/i);
    expect(hasDropshippingLanguage(publishableCopy(outcome.result))).toBe(false);
    expect(() => assertGroundedResult(listedWatch, outcome.result)).not.toThrow();
    const usage = outcome.chargeUsage
      ? await consumeAiUsage("store-alpha.myshopify.com", "sub_fallback", 100, "opt-fallback-key")
      : await peekAiUsage("store-alpha.myshopify.com", "sub_fallback", 100);
    expect(usage.used).toBe(0);
    clearTestDatabase();
  });

  it("charges exactly once when a valid proposed result comes from a successful model response", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    await usePglite();
    await saveShopifySession("store-alpha.myshopify.com", "token", "write_products");
    await seedShopifyBilling("store-alpha.myshopify.com", {
      subscriptionGid: "sub_ok",
      currentPeriodStart: 100,
      currentPeriodEnd: 200,
    });
    let calls = 0;
    setOptimizerFetchForTests(async () => {
      calls += 1;
      if (calls === 1) return modelReply(inventedPayload);
      return modelReply(groundedPayload);
    });
    const outcome = await runOptimizeProduct(listedWatch, "en");
    expect(calls).toBe(2);
    expect(outcome.chargeUsage).toBe(true);
    const first = await consumeAiUsage(
      "store-alpha.myshopify.com",
      "sub_ok",
      100,
      "opt-success-key"
    );
    const second = await consumeAiUsage(
      "store-alpha.myshopify.com",
      "sub_ok",
      100,
      "opt-success-key"
    );
    expect(first.used).toBe(1);
    expect(second.used).toBe(1);
    expect((await peekAiUsage("store-alpha.myshopify.com", "sub_ok", 100)).used).toBe(1);
    clearTestDatabase();
  });

  it("does not charge failed attempts and only records usage after a chargeable result", () => {
    const analyze = readFileSync("app/api/ai/analyze/route.ts", "utf8");
    const optimizer = readFileSync("app/api/_lib/optimizer.ts", "utf8");
    expect(analyze).toMatch(/outcome\.chargeUsage/);
    expect(analyze).toMatch(/recordSuccessfulAiOptimization/);
    expect(analyze).toMatch(/usage: subscriber\.usage/);
    expect(analyze.lastIndexOf("runOptimizeProduct")).toBeLessThan(
      analyze.lastIndexOf("recordSuccessfulAiOptimization")
    );
    expect(optimizer).toMatch(/chargeUsage: true/);
    expect(optimizer).toMatch(/chargeUsage: false/);
    expect(optimizer).toMatch(/buildSafeFallbackResult/);
    expect(optimizer).not.toMatch(/consumeAiUsage|recordSuccessfulAiOptimization/);
  });
});

describe("Stale errors, single-product import, and optional facts", () => {
  it("clears stale error banners after a successful import or optimization", () => {
    const home = readFileSync("app/home-client.tsx", "utf8");
    expect(home).toMatch(/function clearError\(\)/);
    expect(home).toMatch(/data-testid="app-error"/);
    expect(home).toMatch(/data-testid="import-status"/);
    expect(home).toMatch(/message && !error/);
    const importFn = home.slice(home.indexOf("async function importProducts"));
    const importBody = importFn.slice(0, importFn.indexOf("async function optimizeSelected"));
    expect(importBody).toMatch(/clearError\(\)/);
    expect(importBody).toMatch(/singleProductImported/);
    const optimizeFn = home.slice(home.indexOf("async function optimizeSelected"));
    const optimizeBody = optimizeFn.slice(0, optimizeFn.indexOf("async function saveProduct"));
    expect(optimizeBody).toMatch(/clearError\(\)/);
    expect(optimizeBody).toMatch(/setMessage\(copy\.reviewChanges\)/);
  });

  it("explains a one-product catalog as a complete import, not a failure", () => {
    expect(COPY.en.singleProductImported).toMatch(/only one product/i);
    expect(COPY.en.singleProductImported).toMatch(/not a failure/i);
    expect(COPY.en.singleProductImported).not.toMatch(/Sample Watch/i);
    expect(COPY.fil.singleProductImported).not.toMatch(/Sample Watch/i);
    expect(COPY.en.productFactsHint).toMatch(/Optional/i);
    expect(COPY.fil.productFactsHint).toMatch(/Opsyonal/i);
    const home = readFileSync("app/home-client.tsx", "utf8");
    expect(home).toMatch(/merchantFacts: parseMerchantFacts\(merchantFacts\)/);
    expect(home).not.toMatch(/if \(!merchantFacts/);
  });
});
