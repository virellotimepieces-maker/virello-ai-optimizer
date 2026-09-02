import { describe, expect, it } from "vitest";
import {
  assertGroundedResult,
  buildOptimizerMessages,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import { buildShopifyDescriptionHtml } from "../app/api/_lib/listing-html";
import { parseSaveProductInput } from "../app/api/_lib/shopify-products";
import { COPY } from "../app/i18n";

const product = {
  title: "Virello Gold Watch",
  description: "Stainless steel case. Japanese quartz movement.",
  productType: "Watch",
  vendor: "Virello",
  tags: ["watch", "gold"],
  price: "29.99",
  options: ["Color: Gold"],
  variants: ["Gold · 29.99"],
};

describe("Conversion-focused AI listing output", () => {
  it("keeps EN and FIL copy keys aligned for the review fields", () => {
    expect(Object.keys(COPY.en).sort()).toEqual(Object.keys(COPY.fil).sort());
    expect(COPY.en.benefitBullets).toMatch(/benefit/i);
    expect(COPY.fil.saveShopify).toMatch(/Shopify/);
    expect(COPY.en.reviewHint).toMatch(/Save to Shopify/);
  });

  it("asks the model for conversion fields and forbids invented facts", () => {
    const { system } = buildOptimizerMessages(product, "en");
    expect(system).toMatch(/benefitBullets/);
    expect(system).toMatch(/objections/);
    expect(system).toMatch(/callToAction/);
    expect(system).toMatch(/Never invent/);
    expect(system).toMatch(/Filipino|English/);
  });

  it("normalizes conversion fields, SEO lengths, and missing-info warnings", () => {
    const result = validateOptimizationResult({
      analysis: {
        targetCustomer: "Watch buyers who want a daily Virello piece",
        purchaseMotivation: "A stainless steel case and Japanese quartz movement for everyday wear",
        strongestFeatures: ["Stainless steel case → stays sturdy for daily wear"],
        benefitBullets: ["Stainless steel case for everyday wear"],
        weaknesses: ["Water resistance is not listed"],
        missingInformation: ["Water resistance is not listed"],
        objections: [{ objection: "Is it waterproof?", response: "Water resistance is not listed on this product." }],
        conversionOpportunities: ["Lead with the stainless steel case and quartz movement"],
      },
      optimization: {
        title: "Virello Gold Watch with Stainless Steel Case",
        description: "A Virello gold watch with a stainless steel case and Japanese quartz movement.",
        benefitBullets: ["Stainless steel case for everyday wear", "Japanese quartz movement"],
        seoTitle: "A".repeat(90),
        metaDescription: "B".repeat(200),
        tags: ["watch", "gold", "virello"],
        keywords: ["gold watch", "stainless steel"],
        callToAction: "Choose this Virello gold watch for daily wear.",
        conversionCopy: "Stainless steel case and Japanese quartz movement, without extra claims.",
      },
      reasoning: "Used only supplied facts.",
    });
    expect(result.optimization.seoTitle).toHaveLength(70);
    expect(result.optimization.metaDescription).toHaveLength(160);
    expect(result.optimization.benefitBullets.length).toBeGreaterThan(0);
    expect(result.analysis.objections[0]?.response).toMatch(/not listed/i);
    expect(result.analysis.warnings[0]).toMatch(/Missing product information/i);
    expect(() => assertGroundedResult(product, result)).not.toThrow();
  });

  it("composes mobile-friendly Shopify HTML from edited listing fields", () => {
    const html = buildShopifyDescriptionHtml({
      description: "A Virello gold watch with a stainless steel case.\n\nJapanese quartz movement.",
      benefitBullets: ["Stainless steel case for everyday wear", "Japanese quartz movement"],
      callToAction: "Choose this Virello gold watch for daily wear.",
    });
    expect(html).toContain("<p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Stainless steel case for everyday wear</li>");
    expect(html).toContain("<strong>Choose this Virello gold watch for daily wear.</strong>");
    expect(html).not.toContain("limited time");
  });

  it("does not treat a save as confirmed unless confirmed is true", () => {
    expect(parseSaveProductInput({ productId: "gid://shopify/Product/9" }).confirmed).toBe(false);
    expect(parseSaveProductInput({ productId: "gid://shopify/Product/9", confirmed: true }).confirmed).toBe(true);
  });
});
