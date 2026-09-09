import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import {
  buildSafeFallbackResult,
  inventedClaimsIn,
  runOptimizeProduct,
  setOptimizerFetchForTests,
  sourceFactText,
  validateOptimizationResult,
} from "../app/api/_lib/optimizer";
import { listingFacts, publishableCopy, sanitizeProductSource } from "../app/api/_lib/optimizer-copy";
import { merchantFactsMissingFromText, parseMerchantFacts } from "../app/api/_lib/merchant-facts";
import { scoreLimitExplanation } from "../app/api/_lib/listing-score";
import { clearTestDatabase, usePglite } from "./helpers/pglite";
import { seedShopifyBilling, mockShopifyBillingGraphql } from "./helpers/shopify-billing";

const SHOP = "store-alpha.myshopify.com";
const ORIGIN = "https://app.virello.example";
const SECRET = "shopify-client-secret-value";

const PRODUCTION_FACTS = {
  material: "Stainless steel case with genuine leather strap",
  dimensions: "40 mm case diameter, 8 mm case thickness, 20 mm strap width",
  movement: "Japanese quartz movement",
  waterResistance: "3 ATM / 30 metres, splash resistant only",
  warranty: "1-year limited manufacturer warranty",
  intendedUse: "Everyday wear, office, casual outings, and formal occasions",
};

const productionUiPayload = {
  outputLocale: "en",
  idempotencyKey: "opt-prod-route-test",
  brandVoice: "refined",
  merchantFacts: parseMerchantFacts(PRODUCTION_FACTS),
  product: {
    id: "gid://shopify/Product/421",
    title: "Sample Watch: for Everyday Style",
    description:
      "Introducing the Sample Watch. Its versatile design transitions seamlessly from office to evening.",
    productType: "Watch",
    vendor: "Harbor Supply",
    tags: ["watch"],
    price: "",
    handle: "sample-watch",
    options: [],
    variants: [],
    merchantFacts: parseMerchantFacts(PRODUCTION_FACTS),
  },
};

function modelReply(payload: unknown) {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      });
    },
  };
}

async function postAnalyze(body: unknown) {
  await saveShopifySession(SHOP, "offline-stored-token", "read_products,write_products", {
    expiresIn: 3600,
  });
  await seedShopifyBilling(SHOP, { status: "ACTIVE" });
  const sessionId = await issueAppSession({ shop: SHOP });
  const { POST } = await import("../app/api/ai/analyze/route");
  return POST(
    new NextRequest(`${ORIGIN}/api/ai/analyze`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        cookie: `virello_sid=${sessionId}`,
        "content-type": "application/json",
        "Idempotency-Key": "opt-prod-route-test",
      },
      body: JSON.stringify(body),
    })
  );
}

describe("Production Optimize request path", () => {
  beforeEach(async () => {
    process.env.APP_URL = ORIGIN;
    process.env.SHOPIFY_API_KEY = "shopify-client-id";
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = "x".repeat(32);
    process.env.AI_SUBSCRIBER_USAGE_LIMIT = "1000";
    process.env.OPENAI_API_KEY = "test-openai-key";
    mockShopifyBillingGraphql({ partnerDevelopment: true });
    await usePglite();
  });

  afterEach(() => {
    setOptimizerFetchForTests(null);
    clearTestDatabase();
  });

  it("uses the current /api/ai/analyze route from the production UI", () => {
    const home = readFileSync("app/home-client.tsx", "utf8");
    expect(home).toMatch(/shopifyFetch\("\/api\/ai\/analyze"/);
    expect(home.match(/shopifyFetch\("\/api\/[^"]+"/g)?.filter((item) => /ai\//.test(item))).toEqual([
      'shopifyFetch("/api/ai/analyze"',
    ]);
    expect(home).toMatch(/merchantFacts: parseMerchantFacts\(merchantFacts\)/);
    expect(home).toMatch(/product: \{[\s\S]*merchantFacts: parseMerchantFacts\(merchantFacts\)/);
    expect(home).toMatch(/capFallbackScores/);
    expect(home).toMatch(/invented details\|invented claim/);
    expect(readFileSync("app/api/_lib/optimizer-copy.ts", "utf8")).not.toMatch(/\$\{[^}]*\}\s*lists\s*\$\{/);
    expect(readFileSync("app/api/_lib/optimizer.ts", "utf8")).toMatch(/Omitted listed specifications/);
    expect(readFileSync("app/api/_lib/optimizer.ts", "utf8")).toMatch(/Do not treat style, color, or variant options/);
  });

  it("puts merchant-entered facts in the listing fact list ahead of Shopify description filler", () => {
    const facts = listingFacts({
      title: productionUiPayload.product.title,
      description: productionUiPayload.product.description,
      productType: productionUiPayload.product.productType,
      vendor: productionUiPayload.product.vendor,
      tags: productionUiPayload.product.tags,
      merchantFacts: PRODUCTION_FACTS,
    });
    const blob = facts.join(" ");
    expect(blob).toMatch(/stainless steel case with genuine leather strap/i);
    expect(blob).toMatch(/40 mm case diameter/i);
    expect(blob).toMatch(/japanese quartz/i);
    expect(blob).not.toMatch(/transitions seamlessly/i);
    const merchantIndex = blob.toLowerCase().indexOf("stainless steel");
    const introIndex = blob.toLowerCase().indexOf("introducing");
    expect(merchantIndex).toBeGreaterThanOrEqual(0);
    if (introIndex >= 0) expect(merchantIndex).toBeLessThan(introIndex);
  });

  it("keeps water-resistant paraphrases when splash resistance is listed", () => {
    const source = sourceFactText({
      title: "Harbor Field Chronograph",
      description: "Steel case.",
      merchantFacts: PRODUCTION_FACTS,
    });
    expect(
      inventedClaimsIn(
        source,
        "Harbor Field Chronograph is water-resistant to 3 ATM and made for everyday wear."
      )
    ).toEqual([]);
    expect(inventedClaimsIn(source, "Waterproof titanium shell.")).toEqual(
      expect.arrayContaining([expect.stringMatching(/titanium|waterproof/i)])
    );
  });

  it("builds fallback copy from the six verified merchant facts without lists-concatenation", () => {
    const result = buildSafeFallbackResult({
      title: "Harbor Field Chronograph",
      description: "Introducing the product. Its versatile design transitions seamlessly.",
      productType: "Chronograph",
      vendor: "Harbor Supply",
      merchantFacts: PRODUCTION_FACTS,
    });
    const pub = publishableCopy(result);
    expect(pub).not.toMatch(/\blists introducing\b/i);
    expect(pub).not.toMatch(/its transitions seamlessly/i);
    expect(pub).toMatch(/stainless steel case with genuine leather strap/i);
    expect(pub).toMatch(/40 mm case diameter/i);
    expect(pub).toMatch(/japanese quartz/i);
    expect(pub).toMatch(/3 ATM/i);
    expect(pub).toMatch(/1-year limited manufacturer warranty/i);
    expect(pub).toMatch(/everyday wear/i);
    expect(result.optimization.conversionCopy).not.toMatch(/^this product has\b/i);
    expect(result.optimization.conversionCopy).toMatch(/listed with/i);
    expect(result.optimization.conversionCopy).toMatch(/1-year limited manufacturer warranty/i);
    expect(result.optimization.conversionCopy).toMatch(/everyday wear/i);
    expect(result.optimization.conversionCopy).toMatch(/[.!?]/);
    expect(result.optimization.description).not.toMatch(/the listed material is/i);
    expect(result.analysis.warnings.join(" ")).not.toMatch(/omitted the title or description/i);
    expect(result.analysis.warnings.join(" ")).not.toMatch(/comprehensive vendor|enhance credibility/i);
    expect(merchantFactsMissingFromText(PRODUCTION_FACTS, pub)).toEqual([]);
    expect(result.scores.grade).not.toBe("strong");
    expect(result.scores.grade).not.toBe("excellent");
    expect(result.scores.overall).toBeLessThan(80);
  });

  it("keeps an imported Virello vendor on the virello-dev shop instead of treating it as missing", () => {
    expect(
      sanitizeProductSource(
        { title: "Sample Watch: for Everyday Style", vendor: "Virello" },
        "virello-dev.myshopify.com"
      ).vendor
    ).toBe("Virello");
    expect(
      sanitizeProductSource(
        { title: "Sample Watch: for Everyday Style", vendor: "virello-dev" },
        "virello-dev.myshopify.com"
      ).vendor
    ).toBe("");
    const result = buildSafeFallbackResult(
      {
        title: "Sample Watch: for Everyday Style",
        description: "Introducing the product.",
        productType: "Watch",
        vendor: "Virello",
        merchantFacts: PRODUCTION_FACTS,
      },
      "virello-dev.myshopify.com"
    );
    const gaps = [
      ...result.analysis.missingInformation,
      ...scoreLimitExplanation(result.analysis.missingInformation),
    ].join(" ");
    expect(result.optimization.conversionCopy).toMatch(/from Virello/i);
    expect(result.optimization.description).toMatch(/Virello/i);
    expect(gaps).not.toMatch(/vendor name is not provided/i);
    expect(scoreLimitExplanation(result.analysis.missingInformation).filter((item) => /vendor/i.test(item))).toEqual(
      []
    );
  });

  it("does not duplicate a vendor-missing score cap when the model repeats the same gap", () => {
    const result = validateOptimizationResult(
      {
        analysis: {
          missingInformation: ["Vendor name is not provided", "Vendor name is not provided."],
          warnings: ["Listing score is limited by the lack of a vendor name and missing style options"],
        },
        optimization: {
          title: "Sample Watch: for Everyday Style",
          description:
            "Sample Watch: for Everyday Style from Virello is listed with a stainless steel case with genuine leather strap, 40 mm case diameter, and Japanese quartz movement. Water resistance is listed as 3 ATM / 30 metres, splash resistant only. It is listed for everyday wear, office, casual outings, and formal occasions, and includes 1-year limited manufacturer warranty.",
          conversionCopy:
            "Sample Watch: for Everyday Style from Virello is listed with a stainless steel case with genuine leather strap, 40 mm case diameter, and Japanese quartz movement.",
        },
      },
      {
        title: "Sample Watch: for Everyday Style",
        productType: "Watch",
        vendor: "Virello",
        merchantFacts: PRODUCTION_FACTS,
      },
      "virello-dev.myshopify.com"
    );
    const vendorGaps = result.analysis.missingInformation.filter((item) => /vendor name is not provided/i.test(item));
    expect(vendorGaps).toEqual([]);
    expect(scoreLimitExplanation(result.analysis.missingInformation).join(" ")).not.toMatch(
      /vendor name is not provided/i
    );
  });

  it(
    "returns all six merchant facts from the production UI payload after failed grounding",
    async () => {
    let calls = 0;
    const userBodies: string[] = [];
    const systemBodies: string[] = [];
    setOptimizerFetchForTests(async (_url, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body || "{}")) as {
        messages?: Array<{ role?: string; content?: string }>;
      };
      userBodies.push(body.messages?.[1]?.content || "");
      systemBodies.push(body.messages?.[0]?.content || "");
      return modelReply({
        analysis: { warnings: [], missingInformation: [] },
        optimization: {
          title: "Sample Watch: for Everyday Style",
          description:
            "Sample Watch: for Everyday Style lists Introducing the Sample Watch. Its transitions seamlessly from office to evening. Waterproof titanium shell.",
          conversionCopy:
            "Sample Watch: for Everyday Style lists Introducing the Sample Watch. Its transitions seamlessly.",
        },
      });
    });
    const response = await postAnalyze(productionUiPayload);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success?: boolean;
      result?: {
        analysis?: { warnings?: string[] };
        optimization?: {
          title?: string;
          description?: string;
          conversionCopy?: string;
          benefitBullets?: string[];
        };
        scores?: { overall: number; grade: string };
      };
    };
    expect(body.success).toBe(true);
    const blob = JSON.stringify(body.result);
    expect(blob).not.toMatch(/lists Introducing/i);
    expect(blob).not.toMatch(/Its transitions seamlessly/i);
    expect(blob).not.toMatch(/waterproof titanium/i);
    expect(body.result?.optimization?.description).toMatch(/stainless steel case with genuine leather strap/i);
    expect(body.result?.optimization?.description).toMatch(/40 mm case diameter/i);
    expect(body.result?.optimization?.description).toMatch(/8 mm case thickness/i);
    expect(body.result?.optimization?.description).toMatch(/japanese quartz/i);
    expect(body.result?.optimization?.description).toMatch(/3 ATM/i);
    expect(body.result?.optimization?.description).toMatch(/30 metres/i);
    expect(body.result?.optimization?.description).toMatch(/1-year limited manufacturer warranty/i);
    expect(body.result?.optimization?.description).toMatch(/everyday wear/i);
    expect(body.result?.optimization?.conversionCopy).toMatch(/stainless steel/i);
    expect(body.result?.optimization?.conversionCopy).toMatch(/40 mm/i);
    expect(body.result?.optimization?.conversionCopy).toMatch(/quartz/i);
    expect(body.result?.optimization?.conversionCopy).toMatch(/1-year limited manufacturer warranty/i);
    expect(body.result?.optimization?.conversionCopy).toMatch(/everyday wear/i);
    expect(body.result?.optimization?.conversionCopy).not.toMatch(/\blists\b/i);
    expect(body.result?.optimization?.conversionCopy).not.toMatch(/^this product has\b/i);
    expect(body.result?.optimization?.conversionCopy).not.toMatch(/this product has stainless/i);
    expect(body.result?.analysis?.warnings?.join(" ") || "").toMatch(/factual draft from listed product data/i);
    expect(body.result?.analysis?.warnings?.join(" ") || "").not.toMatch(/omitted the title or description/i);
    expect(body.result?.analysis?.warnings?.join(" ") || "").not.toMatch(/comprehensive vendor|enhance credibility/i);
    expect(body.result?.scores?.grade).not.toBe("strong");
    expect(body.result?.scores?.grade).not.toBe("excellent");
    expect(body.result?.scores?.overall).toBeLessThan(80);
    expect(calls).toBe(2);
    expect(userBodies[0]).toMatch(/stainless steel case with genuine leather strap/i);
    expect(userBodies[0]).toMatch(/Japanese quartz movement/i);
    expect(userBodies[1]).toMatch(/3 ATM \/ 30 metres/i);
    expect(systemBodies[1]).toMatch(/Retry:/i);
    expect(systemBodies[1]).toMatch(/Verified product facts:/i);
    expect(systemBodies[1]).toMatch(/stainless steel case with genuine leather strap/i);
    expect(systemBodies[1]).toMatch(/Everyday wear, office, casual outings, and formal occasions/i);
    expect(
      merchantFactsMissingFromText(
        PRODUCTION_FACTS,
        `${body.result?.optimization?.description || ""} ${body.result?.optimization?.conversionCopy || ""} ${
          body.result?.optimization?.benefitBullets?.join(" ") || ""
        }`
      )
    ).toEqual([]);
  },
  20_000
);

  it("does not fail Optimize when the model invents durable on a virello-dev shop", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    setOptimizerFetchForTests(async () =>
      modelReply({
        analysis: { warnings: [], missingInformation: [] },
        optimization: {
          title: "Sample Watch: for Everyday Style",
          description:
            "A durable watch for everyday wear with a stainless steel case and genuine leather strap.",
          conversionCopy: "Durable everyday style for any occasion.",
        },
      })
    );
    const outcome = await runOptimizeProduct(
      {
        ...productionUiPayload.product,
        merchantFacts: PRODUCTION_FACTS,
      },
      "en",
      "virello-dev.myshopify.com"
    );
    expect(outcome.chargeUsage).toBe(false);
    const pub = publishableCopy(outcome.result);
    expect(pub).not.toMatch(/\bdurable\b/i);
    expect(pub).toMatch(/stainless steel/i);
    expect(outcome.result.analysis.warnings.join(" ")).toMatch(/factual draft from listed product data/i);
  });

  it(
    "returns fallback from /api/ai/analyze instead of an invented-durable error",
    async () => {
      setOptimizerFetchForTests(async () =>
        modelReply({
          analysis: { warnings: [], missingInformation: [] },
          optimization: {
            title: "Sample Watch: for Everyday Style",
            description: "A durable timepiece with waterproof titanium and everyday wear.",
            conversionCopy: "Durable and waterproof.",
          },
        })
      );
      const response = await postAnalyze(productionUiPayload);
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        result?: {
          analysis?: { warnings?: string[] };
          optimization?: { description?: string; conversionCopy?: string };
        };
      };
      expect(body.success).toBe(true);
      expect(body.error || "").not.toMatch(/invented claim: durable/i);
      expect(JSON.stringify(body.result)).not.toMatch(/\bdurable\b/i);
      expect(body.result?.optimization?.description).toMatch(/stainless steel/i);
      expect(body.result?.analysis?.warnings?.join(" ") || "").toMatch(/factual draft from listed product data/i);
    },
    20_000
  );

  it("accepts a grounded model response that paraphrases listed water resistance", async () => {
    setOptimizerFetchForTests(async () =>
      modelReply({
        analysis: {
          targetCustomer: "Shoppers who want a listed everyday chronograph",
          missingInformation: [],
          warnings: [],
        },
        optimization: {
          title: "Harbor Supply Sample Watch",
          description:
            "Harbor Supply Sample Watch has a stainless steel case with a genuine leather strap, 40 mm case diameter, Japanese quartz movement, and is water-resistant to 3 ATM / 30 metres, splash resistant only. The listed warranty is a 1-year limited manufacturer warranty for everyday wear, office, casual outings, and formal occasions.",
          benefitBullets: [
            "Stainless steel case with genuine leather strap",
            "40 mm case diameter",
            "Japanese quartz movement",
          ],
          seoTitle: "Harbor Supply Sample Watch steel",
          metaDescription:
            "Harbor Supply Sample Watch with stainless steel, 40 mm case, Japanese quartz, and 3 ATM splash resistance.",
          tags: ["watch", "quartz"],
          keywords: ["harbor supply watch"],
          callToAction: "Review the listed details for Harbor Supply Sample Watch.",
          conversionCopy:
            "Stainless steel case, 40 mm diameter, Japanese quartz movement, and 3 ATM splash resistance.",
        },
      })
    );
    const response = await postAnalyze({
      ...productionUiPayload,
      product: {
        ...productionUiPayload.product,
        title: "Harbor Supply Sample Watch",
        description: "Steel case with a leather strap.",
      },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      result?: { analysis?: { warnings?: string[] }; optimization?: { description?: string } };
    };
    expect(body.result?.analysis?.warnings?.join(" ") || "").not.toMatch(/could not produce grounded copy/i);
    expect(body.result?.optimization?.description).toMatch(/water-resistant to 3 ATM|3 ATM/i);
    expect(body.result?.optimization?.description).toMatch(/everyday wear/i);
  },
  20_000
);

  const screenshotCopy =
    "The Sample Watch is a refined everyday accessory with a stainless steel case, genuine leather strap, and Japanese quartz movement, offering versatility and style";

  it("rejects thin screenshot copy that omits listed numbers and does not treat vendor or style options as score gaps", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    setOptimizerFetchForTests(async () =>
      modelReply({
        analysis: {
          warnings: ["Listing score is limited by the lack of a vendor name and missing style options"],
          missingInformation: [
            "Vendor name is not provided",
            "No additional style or color options listed",
          ],
        },
        optimization: {
          title: "Sample Watch: for Everyday Style",
          description: screenshotCopy,
          benefitBullets: ["Stainless steel case", "Genuine leather strap", "Japanese quartz movement"],
          seoTitle: "Sample Watch Everyday Style",
          metaDescription: screenshotCopy.slice(0, 160),
          tags: ["watch"],
          keywords: ["sample watch"],
          callToAction: "Review the listed details for Sample Watch.",
          conversionCopy: screenshotCopy,
        },
      })
    );
    const outcome = await runOptimizeProduct(
      {
        ...productionUiPayload.product,
        merchantFacts: PRODUCTION_FACTS,
      },
      "en",
      "virello-dev.myshopify.com"
    );
    expect(outcome.chargeUsage).toBe(false);
    const pub = publishableCopy(outcome.result);
    const gaps = [
      ...(outcome.result.analysis.missingInformation || []),
      ...(outcome.result.analysis.warnings || []),
    ].join(" ");
    expect(merchantFactsMissingFromText(PRODUCTION_FACTS, pub)).toEqual([]);
    expect(pub).toMatch(/40 mm/i);
    expect(pub).toMatch(/3 ATM/i);
    expect(pub).toMatch(/1-year limited manufacturer warranty/i);
    expect(pub).toMatch(/everyday wear/i);
    expect(pub).not.toMatch(/versatility and style/i);
    expect(outcome.result.optimization.conversionCopy).toMatch(/[.!?]/);
    expect(outcome.result.optimization.conversionCopy).not.toMatch(/refined everyday accessory/i);
    expect(gaps).not.toMatch(/vendor name is not provided/i);
    expect(gaps).not.toMatch(/style or color options/i);
    expect(gaps).not.toMatch(/lack of a vendor name/i);
    expect(scoreLimitExplanation(outcome.result.analysis.missingInformation).join(" ")).not.toMatch(
      /vendor name is not provided|style or color options/i
    );
    expect(outcome.result.scores.grade).not.toBe("strong");
    expect(outcome.result.scores.grade).not.toBe("excellent");
    expect(outcome.result.scores.overall).toBeLessThan(80);
  });

  it("returns a factual draft from /api/ai/analyze for the live screenshot payload", async () => {
    setOptimizerFetchForTests(async () =>
      modelReply({
        analysis: {
          warnings: ["Listing score is limited by the lack of a vendor name and missing style options"],
          missingInformation: [
            "Vendor name is not provided",
            "No additional style or color options listed",
          ],
        },
        optimization: {
          title: "Sample Watch: for Everyday Style",
          description: screenshotCopy,
          conversionCopy: screenshotCopy,
        },
      })
    );
    const response = await postAnalyze(productionUiPayload);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success?: boolean;
      result?: {
        analysis?: { warnings?: string[]; missingInformation?: string[] };
        optimization?: { description?: string; conversionCopy?: string };
        scores?: { overall?: number; grade?: string; description?: number };
      };
    };
    expect(body.success).toBe(true);
    const pub = `${body.result?.optimization?.description || ""} ${body.result?.optimization?.conversionCopy || ""}`;
    expect(merchantFactsMissingFromText(PRODUCTION_FACTS, pub)).toEqual([]);
    expect(pub).toMatch(/40 mm/i);
    expect(pub).toMatch(/Japanese quartz/i);
    expect(pub).not.toMatch(/versatility and style/i);
    const notes = [
      ...(body.result?.analysis?.missingInformation || []),
      ...(body.result?.analysis?.warnings || []),
    ].join(" ");
    expect(notes).not.toMatch(/vendor name is not provided/i);
    expect(notes).not.toMatch(/style or color options/i);
    expect(scoreLimitExplanation(body.result?.analysis?.missingInformation || []).join(" ")).not.toMatch(
      /Would improve the score: Vendor name/i
    );
    expect(body.result?.scores?.grade).not.toBe("strong");
    expect(body.result?.scores?.grade).not.toBe("excellent");
  }, 20_000);

  it("keeps grounded copy when the model only invents vendor and style-option gaps", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const groundedDescription =
      "Harbor Supply Sample Watch has a stainless steel case with a genuine leather strap, 40 mm case diameter, Japanese quartz movement, and is water-resistant to 3 ATM / 30 metres, splash resistant only. The listed warranty is a 1-year limited manufacturer warranty for everyday wear, office, casual outings, and formal occasions.";
    setOptimizerFetchForTests(async () =>
      modelReply({
        analysis: {
          missingInformation: [
            "Vendor name is not provided",
            "No additional style or color options listed",
          ],
          warnings: ["Listing score is limited by the lack of a vendor name and missing style options"],
        },
        optimization: {
          title: "Harbor Supply Sample Watch",
          description: groundedDescription,
          benefitBullets: [
            "Stainless steel case with genuine leather strap",
            "40 mm case diameter",
            "Japanese quartz movement",
          ],
          seoTitle: "Harbor Supply Sample Watch steel",
          metaDescription:
            "Harbor Supply Sample Watch with stainless steel, 40 mm case, Japanese quartz, and 3 ATM splash resistance.",
          tags: ["watch", "quartz"],
          keywords: ["harbor supply watch"],
          callToAction: "Review the listed details for Harbor Supply Sample Watch.",
          conversionCopy:
            "Stainless steel case, 40 mm diameter, Japanese quartz movement, and 3 ATM splash resistance with a 1-year limited manufacturer warranty for everyday wear.",
        },
      })
    );
    const outcome = await runOptimizeProduct(
      {
        ...productionUiPayload.product,
        title: "Harbor Supply Sample Watch",
        description: "Steel case with a leather strap.",
        merchantFacts: PRODUCTION_FACTS,
      },
      "en"
    );
    expect(outcome.chargeUsage).toBe(true);
    const gaps = outcome.result.analysis.missingInformation.join(" ");
    const warnings = outcome.result.analysis.warnings.join(" ");
    expect(gaps).not.toMatch(/vendor name is not provided/i);
    expect(gaps).not.toMatch(/style or color options/i);
    expect(warnings).not.toMatch(/lack of a vendor name/i);
    expect(outcome.result.optimization.description).toMatch(/40 mm/i);
    expect(scoreLimitExplanation(outcome.result.analysis.missingInformation)).toEqual([]);
  });
});
