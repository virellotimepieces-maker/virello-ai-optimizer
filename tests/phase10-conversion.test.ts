import { describe, expect, it } from "vitest";
import {
  assertGroundedResult,
  buildOptimizerMessages,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import { buildShopifyDescriptionHtml, stripHtml } from "../app/api/_lib/listing-html";
import { scoreListing } from "../app/api/_lib/listing-score";
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
    expect(COPY.en.gradeHigh).toMatch(/High conversion/);
    expect(COPY.fil.conversionHighlight).toMatch(/High-conversion/);
  });

  it("asks the model for conversion fields and forbids invented facts", () => {
    const { system } = buildOptimizerMessages(product, "en");
    expect(system).toMatch(/benefitBullets/);
    expect(system).toMatch(/objections/);
    expect(system).toMatch(/callToAction/);
    expect(system).toMatch(/Never invent/);
    expect(system).toMatch(/virello-dev/);
    expect(system).toMatch(/optimization\.tags/);
    expect(system).toMatch(/HARD MAX 60/);
    expect(system).toMatch(/HARD MAX 160/);
    expect(system).not.toMatch(/never over 70/);
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
    expect(result.optimization.seoTitle).toHaveLength(60);
    expect(result.optimization.seoTitle.length).toBeLessThanOrEqual(60);
    expect(result.optimization.metaDescription).toHaveLength(160);
    expect(result.optimization.benefitBullets.length).toBeGreaterThan(0);
    expect(result.scores.overall).toBeGreaterThanOrEqual(60);
    expect(result.scores.grade).toMatch(/high|good/);
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

  it("strips Shopify HTML and recovers a title when the model omits listing fields", () => {
    expect(stripHtml("<p>Swiss movement</p>")).toBe("Swiss movement");
    const recovered = validateOptimizationResult(
      {
        analysis: { conversionOpportunities: ["Lead with sapphire crystal"] },
        optimization: {},
      },
      {
        title: "Pagani Design Sapphire Quartz Chronograph Watch",
        description: "<p>Sapphire crystal. Quartz chronograph.</p>",
        vendor: "Pagani Design",
        productType: "Watch",
      }
    );
    expect(recovered.optimization.title).toMatch(/Pagani Design/);
    expect(recovered.optimization.description).toMatch(/Sapphire|Quartz/i);
    expect(recovered.optimization.conversionCopy).toBeTruthy();
    expect(recovered.optimization.seoTitle.length).toBeLessThanOrEqual(60);
    expect(recovered.optimization.metaDescription.length).toBeLessThanOrEqual(160);
    expect(recovered.analysis.strongestFeatures.length).toBeGreaterThanOrEqual(3);
    expect(recovered.optimization.benefitBullets.length).toBeGreaterThanOrEqual(3);
    expect(recovered.optimization.callToAction).toBeTruthy();
    expect(recovered.scores.overall).toBeGreaterThan(0);
  });

  it("replaces generic SEO copy and keeps title at 60 and meta at 160", () => {
    const result = validateOptimizationResult(
      {
        optimization: {
          title: "Virello Gold Watch with Stainless Steel Case",
          description: "A Virello gold watch with a stainless steel case and Japanese quartz movement.",
          seoTitle: "Best Premium Quality Watch Sale",
          metaDescription: "Shop now for amazing deals on luxury lifestyle watches today buy now.",
        },
      },
      product
    );
    expect(result.optimization.seoTitle.length).toBeLessThanOrEqual(60);
    expect(result.optimization.seoTitle).toMatch(/Virello/i);
    expect(result.optimization.seoTitle).not.toMatch(/best premium|shop now/i);
    expect(result.optimization.metaDescription.length).toBeLessThanOrEqual(160);
    expect(result.optimization.metaDescription).toMatch(/Virello|stainless|quartz/i);
    expect(result.analysis.strongestFeatures.length).toBeGreaterThan(0);
    expect(result.optimization.benefitBullets.length).toBeGreaterThanOrEqual(3);
  });

  it("scores a complete listing higher than a thin listing", () => {
    const strong = scoreListing({
      sourceTitle: "Pagani Watch",
      title: "Pagani Design Sapphire Quartz Chronograph for daily wear",
      description:
        "A Pagani Design chronograph with a sapphire crystal and quartz movement for everyday wear. The listing leads with the crystal and movement a shopper can verify.",
      benefitBullets: [
        "Sapphire crystal for a clear dial",
        "Quartz chronograph movement",
        "Built for daily wear",
      ],
      seoTitle: "Pagani Design Sapphire Quartz Chronograph",
      metaDescription:
        "Pagani Design sapphire quartz chronograph with a clear crystal and everyday wear focus, written from the listing facts only.",
      tags: ["watch", "pagani", "chronograph", "sapphire"],
      callToAction: "Choose this Pagani Design chronograph for daily wear.",
      conversionCopy:
        "Lead with the sapphire crystal and quartz chronograph so shoppers see the two facts that make this watch worth opening.",
      conversionOpportunities: ["Lead with sapphire crystal", "Name the quartz chronograph"],
      objections: 1,
      targetCustomer: "Watch buyers who want a sapphire chronograph",
      missingInformation: 0,
    });
    const thin = scoreListing({
      sourceTitle: "Pagani Watch",
      title: "Pagani Watch",
      description: "Watch.",
      benefitBullets: [],
      seoTitle: "Watch",
      metaDescription: "Watch",
      tags: [],
      callToAction: "",
      conversionCopy: "",
      conversionOpportunities: [],
      objections: 0,
      targetCustomer: "",
      missingInformation: 3,
    });
    expect(strong.overall).toBeGreaterThan(thin.overall);
    expect(strong.grade).toBe("high");
    expect(thin.grade).toBe("needs_work");
  });

  it("does not treat a save as confirmed unless confirmed is true", () => {
    expect(parseSaveProductInput({ productId: "gid://shopify/Product/9" }).confirmed).toBe(false);
    expect(parseSaveProductInput({ productId: "gid://shopify/Product/9", confirmed: true }).confirmed).toBe(true);
  });

  it("normalizes malformed and generic AI copy and fills tags and keywords from product facts", () => {
    const result = validateOptimizationResult(
      {
        analysis: {
          targetCustomer: "Shoppers",
          purchaseMotivation: "Daily wear",
        },
        optimization: {
          title: "II/Affordable Gold Watch with",
          description:
            "Stainless steel case. Stainless steel case. Japanese quartz movement. Japanese quartz movement.",
          benefitBullets: ["II/Affordable daily wear", "Stainless steel case"],
          seoTitle: "Best Premium Quality Watch",
          metaDescription: "Shop now for amazing affordable deals.",
          tags: ["This entire description sentence does not belong in tags."],
          keywords: [],
          callToAction:
            "Stainless steel case. Stainless steel case. Japanese quartz movement. Japanese quartz movement.",
          conversionCopy: "II/Affordable Gold Watch with",
        },
      },
      product
    );
    expect(result.optimization.title).not.toMatch(/II\/Affordable/i);
    expect(result.optimization.title).not.toMatch(/\bwith\s*$/i);
    expect(result.optimization.title).toMatch(/Virello|Gold Watch/i);
    expect(result.optimization.description.toLowerCase().split("stainless steel case").length - 1).toBe(1);
    expect(result.optimization.tags.length).toBeGreaterThan(0);
    expect(result.optimization.keywords.length).toBeGreaterThan(0);
    expect(result.optimization.tags.join(" ")).toMatch(/watch|gold|virello|quartz|steel/i);
    expect(result.optimization.keywords.join(" ")).toMatch(/watch|gold|virello|quartz|steel/i);
    expect(result.optimization.tags.some((tag) => /entire description/i.test(tag))).toBe(false);
    expect(result.optimization.callToAction).not.toBe(result.optimization.description);
    expect(result.optimization.seoTitle).not.toMatch(/best premium|shop now|affordable/i);
    expect(result.optimization.benefitBullets.join(" ")).not.toMatch(/II\/Affordable/i);
  });

  it("does not use the shop domain or virello-dev unless that text is in the listing", () => {
    const listing = {
      title: "Gold Chronograph Watch",
      description: "Quartz movement. Stainless steel case.",
      productType: "Watch",
      vendor: "virello-dev",
      tags: [] as string[],
      options: ["Color: Gold"],
      variants: ["Gold"],
    };
    const result = validateOptimizationResult(
      {
        optimization: {
          title: "virello-dev Gold Chronograph Watch",
          description: "Buy from virello-dev.myshopify.com. Quartz movement. Stainless steel case.",
          benefitBullets: ["virello-dev exclusive quartz", "Stainless steel case"],
          tags: ["virello-dev", "myshopify"],
          keywords: ["virello-dev watch"],
          callToAction: "Shop virello-dev now",
          conversionCopy: "virello-dev is the brand to trust.",
        },
      },
      listing,
      "virello-dev.myshopify.com"
    );
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/virello-dev/i);
    expect(blob).not.toMatch(/myshopify/i);
    expect(result.optimization.tags.length).toBeGreaterThan(0);
    expect(result.optimization.keywords.length).toBeGreaterThan(0);
    expect(result.optimization.tags.join(" ")).toMatch(/watch|gold|quartz|steel|chronograph/i);
    expect(() => assertGroundedResult(listing, result, "virello-dev.myshopify.com")).not.toThrow();
  });

  it("keeps virello-dev when that text is actually in the product title", () => {
    const listing = {
      title: "Virello-Dev Limited Strap",
      description: "Leather strap sold as Virello-Dev.",
      productType: "Strap",
      vendor: "Virello",
    };
    const result = validateOptimizationResult(
      {
        optimization: {
          title: "Virello-Dev Limited Strap",
          description: "Leather strap sold as Virello-Dev.",
          tags: ["Virello-Dev"],
          keywords: ["Virello-Dev strap"],
        },
      },
      listing,
      "other-store.myshopify.com"
    );
    expect(result.optimization.title).toMatch(/Virello-Dev/i);
    expect(result.optimization.tags.join(" ")).toMatch(/Virello-Dev/i);
  });

  it("rejects invented durability, reviews, and materials that are not in the product", () => {
    const result = validateOptimizationResult(
      {
        optimization: {
          title: "Virello Gold Watch",
          description: "Stainless steel case. Japanese quartz movement. Waterproof titanium shell.",
        },
      },
      product
    );
    expect(() => assertGroundedResult(product, result)).toThrow(/invented/i);
  });
});
