import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertGroundedResult,
  buildOptimizerMessages,
  optimizeProduct,
  setOptimizerFetchForTests,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import {
  hasCheapLanguage,
  hasDropshippingLanguage,
  hasReviewSuggestion,
  publishableCopy,
  sanitizeProductSource,
} from "../app/api/_lib/optimizer-copy";
import { DEFAULT_BRAND_VOICE, parseBrandVoice } from "../app/api/_lib/brand-voice";
import { buildShopifyDescriptionHtml } from "../app/api/_lib/listing-html";
import { parseSaveProductInput } from "../app/api/_lib/shopify-products";
import { COPY } from "../app/i18n";

const sampleWatch = {
  title: "Sample Watch",
  productType: "Watch",
};

describe("Retail copy quality", () => {
  it("defaults brand voice to refined and premium", () => {
    expect(parseBrandVoice(undefined)).toBe(DEFAULT_BRAND_VOICE);
    expect(parseBrandVoice("refined")).toBe("refined");
    expect(parseBrandVoice("Value-focused")).toBe("value");
    expect(COPY.en.voiceRefined).toBe("Refined & premium");
  });

  it("cleans store domains, placeholder titles, repeated prices, and II/Affordable fragments from source", () => {
    const cleaned = sanitizeProductSource(
      {
        title: "II/Affordable Sample Watch $19 $19 Default Title",
        description:
          "Welcome to our store. Sample Watch. Sample Watch. virello-dev.myshopify.com. $19 $19.",
        productType: "Watch",
        vendor: "virello-dev",
        tags: ["watch", "virello-dev"],
      },
      "virello-dev.myshopify.com"
    );
    expect(cleaned.title).not.toMatch(/II\/Affordable/i);
    expect(cleaned.title).not.toMatch(/\$19 \$19/);
    expect(cleaned.description || "").not.toMatch(/myshopify|welcome to our store/i);
    expect((cleaned.description || "").toLowerCase().split("sample watch").length - 1).toBeLessThanOrEqual(1);
  });

  it("turns dropshipping Sample Watch output into restrained factual copy", () => {
    const result = validateOptimizationResult(
      {
        analysis: {
          weaknesses: ["This cheap watch is low-quality and lacking durability."],
          objections: [
            {
              objection: "Is this cheap?",
              response: "It is a cheap, low-quality watch.",
            },
          ],
          conversionOpportunities: ["Display customer reviews and 5-star ratings."],
        },
        optimization: {
          title: "Sample Watch — elevate your look, your new favorite must-have",
          description:
            "This affordable luxury game changer is budget-friendly without breaking the bank. Perfect for everyone. Shop now. Display customer reviews.",
          benefitBullets: ["Elevate your game", "Must-have daily wear", "Cheap everyday wear"],
          seoTitle: "Buy now Sample Watch game changer",
          metaDescription: "Shop now for this budget-friendly must-have. Customers love it.",
          tags: ["must-have", "cheap"],
          keywords: ["elevate your look"],
          callToAction: "Shop now",
          conversionCopy: "Elevate your look with this game changer.",
        },
      },
      sampleWatch
    );
    const pub = publishableCopy(result);
    expect(hasDropshippingLanguage(pub)).toBe(false);
    expect(hasCheapLanguage(pub)).toBe(false);
    expect(hasReviewSuggestion(pub)).toBe(false);
    expect(pub).not.toMatch(/shop now|buy now|must-have|game changer|elevate your/i);
    expect(pub).not.toMatch(/\bcheap\b|low-quality|lacking durability/i);
    expect(result.optimization.title).toMatch(/Sample Watch/i);
    expect(result.optimization.description).toMatch(/watch/i);
    expect(result.optimization.description).toMatch(/not provided|not listed|listed as/i);
    expect(result.optimization.description).not.toMatch(/^this is\.|with this|watch watch/i);
    expect(result.optimization.callToAction).toMatch(/listed details|Sample Watch/i);
    expect(result.optimization.seoTitle).not.toMatch(/watch watch/i);
    expect(result.optimization.metaDescription).not.toMatch(/watch\. watch/i);
    expect(result.optimization.conversionCopy).not.toMatch(/with this/i);
    expect(result.optimization.benefitBullets.join(" ")).toMatch(/listed as a watch/i);
    expect(result.optimization.tags.join(" ")).toMatch(/watch/i);
    expect(result.optimization.keywords.join(" ")).toMatch(/watch/i);
    expect(result.optimization.keywords.join(" ")).not.toMatch(/watch watch/i);
    expect(result.analysis.missingInformation.length).toBeGreaterThan(0);
    expect(result.analysis.weaknesses.join(" ")).not.toMatch(/cheap|low-quality|is and/i);
    expect(result.analysis.objections.map((row) => `${row.objection} ${row.response}`).join(" ")).not.toMatch(
      /cheap|low-quality/
    );
    expect(result.analysis.conversionOpportunities.join(" ")).not.toMatch(
      /customer reviews|star rating|ratings?|display and/i
    );
    expect(() => assertGroundedResult(sampleWatch, result)).not.toThrow();
  });

  it("does not copy the same sentence across title, description, CTA, and meta", () => {
    const result = validateOptimizationResult(
      {
        optimization: {
          title: "Sample Watch",
          description: "Sample Watch",
          callToAction: "Sample Watch",
          metaDescription: "Sample Watch",
          conversionCopy: "Sample Watch",
          seoTitle: "Sample Watch",
        },
      },
      sampleWatch
    );
    expect(result.optimization.description).not.toBe(result.optimization.title);
    expect(result.optimization.callToAction).not.toBe(result.optimization.description);
    expect(result.optimization.metaDescription).not.toBe(result.optimization.description);
    expect(result.optimization.conversionCopy).not.toBe(result.optimization.description);
  });

  it("does not lead with price unless the merchant chose value-focused voice", () => {
    const priced = {
      title: "Sample Watch",
      productType: "Watch",
      price: "19.00",
    };
    const refined = validateOptimizationResult(
      {
        optimization: {
          title: "Sample Watch $19.00",
          description: "Only $19.00. Sample Watch.",
          benefitBullets: ["$19.00", "Watch"],
        },
      },
      priced,
      "",
      "refined"
    );
    expect(refined.optimization.title).not.toMatch(/19/);
    expect(refined.optimization.benefitBullets.join(" ")).not.toMatch(/19/);
    const value = validateOptimizationResult(
      {
        optimization: {
          title: "Sample Watch",
          description: "Sample Watch is listed as a watch, with the listed price 19.00.",
          benefitBullets: ["Listed as a watch", "19.00"],
        },
      },
      priced,
      "",
      "value"
    );
    expect(value.optimization.description + value.optimization.benefitBullets.join(" ")).toMatch(/19/);
  });

  it("never writes analysis notes into Shopify HTML or the save payload parser", () => {
    const html = buildShopifyDescriptionHtml({
      description: "Sample Watch is listed as a watch.",
      benefitBullets: ["Listed as a watch"],
      callToAction: "Review the listed details for Sample Watch.",
    });
    expect(html).not.toMatch(/target customer|purchase motivation|weakness|objection|conversion opportunity/i);
    const parsed = parseSaveProductInput({
      productId: "gid://shopify/Product/1",
      title: "Sample Watch",
      description: html,
      confirmed: true,
      targetCustomer: "should not parse",
      weaknesses: ["ignored"],
    });
    expect(parsed).not.toHaveProperty("targetCustomer");
    expect(parsed).not.toHaveProperty("weaknesses");
    const home = readFileSync("app/home-client.tsx", "utf8");
    const saveAt = home.indexOf("async function saveProduct");
    const saveBlock = home.slice(saveAt, home.indexOf("function renderSaveDock"));
    expect(saveBlock).toMatch(/optimization\.title/);
    expect(saveBlock).not.toMatch(/analysis\.targetCustomer/);
    expect(saveBlock).not.toMatch(/analysis\.weaknesses/);
    expect(saveBlock).not.toMatch(/analysis\.objections/);
  });

  it("asks the model for refined retail copy and keeps analysis advisory", () => {
    const { system } = buildOptimizerMessages(sampleWatch, "en");
    expect(system).toMatch(/dropshipping/i);
    expect(system).toMatch(/Brand voice: Refined/);
    expect(system).toMatch(/internal merchant notes/);
    expect(system).toMatch(/shop now/);
  });

  it("rejects leftover dropshipping after a mocked model response by normalizing Sample Watch", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    setOptimizerFetchForTests(async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  optimization: {
                    title: "Sample Watch must-have",
                    description: "Elevate your look. Shop now.",
                    callToAction: "Buy now",
                  },
                }),
              },
            },
          ],
        });
      },
    }));
    const result = await optimizeProduct(sampleWatch, "en");
    const pub = publishableCopy(result);
    expect(hasDropshippingLanguage(pub)).toBe(false);
    expect(result.optimization.title).toMatch(/Sample Watch/i);
    expect(result.optimization.description).toMatch(/listed as a watch|not provided/i);
    setOptimizerFetchForTests(null);
  });
});
