import { afterEach, describe, expect, it } from "vitest";
import {
  capBrokenGrammarScores,
  scoreListing,
} from "../app/api/_lib/listing-score";
import {
  detectCopyQualityIssues,
  repairCopyQuality,
  rewriteMerchantInsight,
} from "../app/api/_lib/copy-quality";
import {
  assertGroundedResult,
  runOptimizeProduct,
  setOptimizerFetchForTests,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import { hasInternalInstruction, publishableCopy } from "../app/api/_lib/optimizer-copy";

const kettle = {
  title: "North Kettle Electric Kettle",
  description: "Stainless steel body with a genuine leather handle wrap.",
  productType: "Kettle",
  vendor: "North Kettle",
  tags: ["kettle", "steel"],
  merchantFacts: {
    material: "Stainless steel",
    intendedUse: "Boiling water",
  },
};

const brokenConversion =
  "The North Kettle Electric Kettle features a versatile design and a stainless steel body with a genuine leather handle wrap. Ideal for and various occasions.";

const vagueBrandWarning =
  "Limited product details may affect purchasing decisions due to lack of comprehensive brand identity";

function modelReply(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 502,
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

describe("Copy quality detection and repair", () => {
  it("repairs Ideal for and various occasions without watch-specific copy", () => {
    const repaired = repairCopyQuality(brokenConversion);
    expect(repaired.text).not.toMatch(/ideal for and/i);
    expect(repaired.text).not.toMatch(/various occasions/i);
    expect(repaired.text).toMatch(/stainless steel/i);
    expect(repaired.text).not.toMatch(/sample watch/i);
    expect(detectCopyQualityIssues(repaired.text)).toEqual([]);
  });

  it("detects dangling and/or", () => {
    expect(detectCopyQualityIssues("Cotton canvas tote with.")).toContain("Dangling and/or or preposition");
    expect(detectCopyQualityIssues("A canvas tote for and weekend travel.")).toContain(
      "Dangling and/or after a preposition"
    );
    const repaired = repairCopyQuality("Harbor tote with and or.");
    expect(repaired.text).not.toMatch(/\bwith and\b/i);
    expect(repaired.text).not.toMatch(/\band or\b/i);
  });

  it("drops sentence fragments", () => {
    const repaired = repairCopyQuality("Canvas tote with a zip top. And. For.");
    expect(repaired.text).toMatch(/canvas tote/i);
    expect(repaired.text).not.toMatch(/^(and|for)\b/i);
    expect(detectCopyQualityIssues("And the.")).toContain("Sentence fragment");
  });

  it("fixes duplicated punctuation and connectors", () => {
    const repaired = repairCopyQuality("The kettle is steel and and ready..");
    expect(repaired.text).not.toMatch(/and and/i);
    expect(repaired.text).not.toMatch(/\.\./);
    expect(detectCopyQualityIssues("Steel,, with a wrap.")).toContain("Duplicated punctuation");
    expect(detectCopyQualityIssues("Steel and and leather.")).toContain("Duplicated connectors");
  });

  it("rewrites vague brand-identity warnings when vendor is present", () => {
    expect(
      rewriteMerchantInsight(vagueBrandWarning, { vendor: "North Kettle", productType: "Kettle" })
    ).toBe("");
    expect(rewriteMerchantInsight(vagueBrandWarning, { vendor: "", productType: "Kettle" })).toMatch(
      /vendor or brand name is not listed/i
    );
  });
});

describe("Post-generation quality gate for all product categories", () => {
  it("strips the production broken phrase from every customer-facing field", () => {
    const result = validateOptimizationResult(
      {
        analysis: {
          warnings: [vagueBrandWarning],
          targetCustomer: "Shoppers considering a kettle for and various occasions.",
        },
        optimization: {
          title: "North Kettle Electric Kettle for and",
          description: brokenConversion,
          benefitBullets: ["Ideal for and various occasions", "Stainless steel body"],
          seoTitle: "North Kettle for and",
          metaDescription: "Ideal for and various occasions with a stainless steel body.",
          tags: ["kettle", "steel"],
          keywords: ["electric kettle"],
          callToAction: "Review the listed details for and.",
          conversionCopy: brokenConversion,
        },
      },
      kettle
    );
    const pub = publishableCopy(result);
    const insights = [
      result.analysis.targetCustomer,
      result.analysis.warnings.join(" "),
      result.analysis.weaknesses.join(" "),
    ].join(" ");
    expect(pub).not.toMatch(/ideal for and/i);
    expect(pub).not.toMatch(/various occasions/i);
    expect(insights).not.toMatch(/comprehensive brand identity/i);
    expect(insights).not.toMatch(/limited product details may affect purchasing/i);
    expect(result.optimization.description).toMatch(/stainless steel/i);
    expect(result.optimization.conversionCopy).toMatch(/stainless steel|kettle/i);
    expect(result.optimization.benefitBullets.join(" ")).not.toMatch(/ideal for and/i);
    expect(result.optimization.callToAction).toMatch(/listed details/i);
    expect(hasInternalInstruction(pub)).toBe(false);
    expect(pub).not.toMatch(/sample watch/i);
    expect(() => assertGroundedResult(kettle, result)).not.toThrow();
  });

  it("does not score unrepaired broken grammar as Strong or Excellent", () => {
    const scored = scoreListing({
      sourceTitle: "North Kettle Electric Kettle",
      title: "North Kettle Electric Kettle",
      description: brokenConversion,
      benefitBullets: ["Stainless steel body", "Genuine leather handle wrap", "Listed as a kettle"],
      seoTitle: "North Kettle Electric Kettle Stainless",
      metaDescription:
        "North Kettle electric kettle with a stainless steel body and genuine leather handle wrap for boiling water.",
      tags: ["kettle", "steel", "north", "electric"],
      callToAction: "Review the listed details for North Kettle Electric Kettle.",
      conversionCopy: brokenConversion,
      conversionOpportunities: ["Lead with verified product facts only.", "Name missing specifications in merchant notes."],
      objections: 1,
      targetCustomer: "Shoppers considering kettle from the facts on this listing.",
      missingInformation: 0,
    });
    expect(scored.overall).toBeLessThan(80);
    expect(scored.grade).not.toBe("strong");
    expect(scored.grade).not.toBe("excellent");
    expect(capBrokenGrammarScores({ ...scored, overall: 82, grade: "strong" }).grade).toBe("needs_work");
    expect(capBrokenGrammarScores({ ...scored, overall: 82, grade: "strong" }).overall).toBeLessThanOrEqual(69);
  });

  it("retries once on remaining copy-quality failures then writes a factual fallback", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let calls = 0;
    setOptimizerFetchForTests(async () => {
      calls += 1;
      return modelReply({
        analysis: { warnings: [vagueBrandWarning], missingInformation: [] },
        optimization: {
          title: "North Kettle Electric Kettle",
          description:
            "North Kettle Electric Kettle has a stainless steel body and a waterproof titanium shell. Ideal for and various occasions.",
          conversionCopy: brokenConversion,
        },
      });
    });
    const outcome = await runOptimizeProduct(kettle, "en");
    expect(calls).toBe(2);
    expect(outcome.chargeUsage).toBe(false);
    const pub = publishableCopy(outcome.result);
    expect(pub).not.toMatch(/ideal for and|various occasions|titanium|sample watch/i);
    expect(pub).toMatch(/stainless steel|kettle/i);
    expect(outcome.result.analysis.warnings.join(" ")).not.toMatch(/comprehensive brand identity/i);
    expect(outcome.result.scores.grade).not.toBe("strong");
    expect(outcome.result.scores.grade).not.toBe("excellent");
    expect(() => assertGroundedResult(kettle, outcome.result)).not.toThrow();
  });
});
