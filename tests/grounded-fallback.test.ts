import { afterEach, describe, expect, it } from "vitest";
import {
  assertGroundedResult,
  buildSafeFallbackResult,
  runOptimizeProduct,
  setOptimizerFetchForTests,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import {
  hasInternalInstruction,
  listingFacts,
  publishableCopy,
  sanitizeProductSource,
} from "../app/api/_lib/optimizer-copy";
import { parseMerchantFacts } from "../app/api/_lib/merchant-facts";

const canvasTote = {
  title: "Harbor Supply Weekender Tote",
  description: "Cotton canvas body with a zip top.",
  productType: "Tote bag",
  vendor: "Harbor Supply",
  tags: ["bag", "canvas"],
  merchantFacts: {
    material: "16 oz cotton canvas",
    dimensions: "18 x 14 x 6 in",
    warranty: "1 year limited",
    intendedUse: "Weekend travel",
  },
};

const leakedPayload = {
  analysis: { missingInformation: [] },
  optimization: {
    title: "Harbor Supply Weekender Tote",
    description: "Use these listed facts in the customer copy: 16 oz cotton canvas.",
    benefitBullets: ["Customer copy: Weekend travel", "16 oz cotton canvas"],
    seoTitle: "Harbor Supply Weekender Tote",
    metaDescription: "Keep the listing factual: cotton canvas zip top tote.",
    tags: ["bag", "canvas"],
    keywords: ["canvas tote"],
    callToAction: "Review the listed details for Harbor Supply Weekender Tote.",
    conversionCopy: "Use these listed facts in the customer copy: 16 oz cotton canvas; 18 x 14 x 6 in.",
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

describe("Leaked instructions never reach customer-facing fields", () => {
  it("strips prompt labels from High-conversion copy and other generated fields", () => {
    const result = validateOptimizationResult(leakedPayload, canvasTote);
    const pub = publishableCopy(result);
    expect(hasInternalInstruction(pub)).toBe(false);
    expect(pub).not.toMatch(/use these listed facts|customer copy:|keep the listing factual/i);
    expect(result.optimization.conversionCopy).toMatch(/cotton canvas|18 x 14|Weekend travel/i);
    expect(result.optimization.description).toMatch(/cotton canvas|Harbor Supply/i);
    expect(result.optimization.description).not.toMatch(/use these listed facts/i);
    expect(() => assertGroundedResult(canvasTote, result)).not.toThrow();
  });
});

describe("Failed-grounding fallback uses merchant facts for any product category", () => {
  it("preserves merchant-entered facts through sanitization", () => {
    const cleaned = sanitizeProductSource(canvasTote);
    expect(cleaned.merchantFacts).toMatchObject({
      material: "16 oz cotton canvas",
      dimensions: "18 x 14 x 6 in",
      warranty: "1 year limited",
      intendedUse: "Weekend travel",
    });
    expect(parseMerchantFacts(cleaned.merchantFacts).material).toBe("16 oz cotton canvas");
    expect(listingFacts(cleaned).join(" ")).toMatch(/16 oz cotton canvas/i);
    expect(listingFacts(cleaned).join(" ")).toMatch(/18 x 14 x 6 in/i);
    expect(listingFacts(cleaned).join(" ")).not.toMatch(/quartz|watch|sample watch/i);
  });

  it("builds a clean deterministic fallback from Shopify data and merchant facts", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let calls = 0;
    setOptimizerFetchForTests(async () => {
      calls += 1;
      return modelReply(
        {
          analysis: { missingInformation: [] },
          optimization: {
            title: "Harbor Supply Weekender Tote",
            description: "Waterproof titanium shell with lifetime warranty and sapphire crystal.",
            conversionCopy: "Use these listed facts in the customer copy: titanium.",
          },
        }
      );
    });
    const outcome = await runOptimizeProduct(canvasTote, "en");
    expect(calls).toBe(2);
    expect(outcome.chargeUsage).toBe(false);
    const result = outcome.result;
    const pub = publishableCopy(result);
    expect(pub).not.toMatch(/use these listed facts|customer copy:|keep the listing factual/i);
    expect(pub).not.toMatch(/titanium|sapphire|waterproof/i);
    expect(result.optimization.title).toMatch(/Weekender Tote/i);
    expect(result.optimization.description).toMatch(/16 oz cotton canvas/i);
    expect(result.optimization.description).toMatch(/18 x 14 x 6 in/i);
    expect(result.optimization.description).toMatch(/1 year limited/i);
    expect(result.optimization.description).toMatch(/Weekend travel/i);
    expect(result.optimization.benefitBullets.join(" ")).toMatch(/cotton canvas/i);
    expect(result.optimization.callToAction).toMatch(/listed details/i);
    expect(result.optimization.seoTitle).toBeTruthy();
    expect(result.optimization.metaDescription).toMatch(/cotton canvas|18 x 14/i);
    expect(result.optimization.tags.join(" ")).toMatch(/tote|canvas|bag/i);
    expect(result.optimization.keywords.join(" ")).toMatch(/tote|canvas|harbor/i);
    expect(result.optimization.conversionCopy).toMatch(/cotton canvas|18 x 14|Weekend travel/i);
    expect(result.optimization.description).not.toMatch(/[,:;]{2}|\.\./);
    expect(result.analysis.missingInformation.join(" ")).not.toMatch(/movement or power|water resistance/i);
    expect(result.scores.grade).not.toBe("strong");
    expect(result.scores.grade).not.toBe("excellent");
    expect(result.scores.overall).toBeLessThan(80);
    expect(() => assertGroundedResult(canvasTote, result)).not.toThrow();
  });

  it("caps a sparse fallback so it cannot claim Strong or Excellent", () => {
    const result = buildSafeFallbackResult({
      title: "Plain Desk Lamp",
      productType: "Lamp",
      vendor: "North Desk",
    });
    expect(result.optimization.description).toMatch(/Lamp|North Desk|Plain Desk Lamp/i);
    expect(result.optimization.description).not.toMatch(/watch|quartz|sample watch/i);
    expect(publishableCopy(result)).not.toMatch(/use these listed facts|customer copy:/i);
    expect(result.scores.overall).toBeLessThanOrEqual(69);
    expect(result.scores.grade).toBe("needs_work");
  });
});
