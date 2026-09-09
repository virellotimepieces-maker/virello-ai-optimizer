import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { issueAppSession } from "../app/api/_lib/app-session";
import { saveShopifySession } from "../app/api/_lib/shopify-auth";
import {
  buildSafeFallbackResult,
  inventedClaimsIn,
  setOptimizerFetchForTests,
  sourceFactText,
} from "../app/api/_lib/optimizer";
import { listingFacts, publishableCopy } from "../app/api/_lib/optimizer-copy";
import { merchantFactsMissingFromText, parseMerchantFacts } from "../app/api/_lib/merchant-facts";
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
    expect(readFileSync("app/api/_lib/optimizer-copy.ts", "utf8")).not.toMatch(/\$\{[^}]*\}\s*lists\s*\$\{/);
    expect(readFileSync("app/api/_lib/optimizer.ts", "utf8")).not.toMatch(/\$\{[^}]*\}\s*lists\s*\$\{/);
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
});
