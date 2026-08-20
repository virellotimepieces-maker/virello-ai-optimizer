import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ProductInput = {
  id?: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
  audience?: "Women" | "Men" | "Unisex";
  style?:
    | "Premium / Luxury"
    | "Professional"
    | "Everyday"
    | "Casual"
    | "Sport"
    | "Gift";
  variants?: Array<{
    id?: string;
    title?: string;
    price?: string;
    sku?: string | null;
    available?: boolean;
  }>;
  images?: Array<{
    url?: string;
    altText?: string | null;
  }>;
  featuredImage?: string | null;
};

type AIResult = {
  analysis: {
    targetCustomer: string;
    purchaseMotivation: string;
    strongestFeatures: string[];
    weaknesses: string[];
    missingInformation: string[];
    seoOpportunities: string[];
    conversionOpportunities: string[];
  };
  score: {
    title: number;
    description: number;
    seo: number;
    productClarity: number;
    conversionPotential: number;
    overall: number;
  };
  optimization: {
    title: string;
    productType: string;
    description: string;
    features: string[];
    specifications: string[];
    seoTitle: string;
    metaDescription: string;
    tags: string[];
  };
  reasoning: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function limitCharacters(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function normalizeResult(raw: unknown): AIResult {
  const data =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const analysis =
    data.analysis && typeof data.analysis === "object"
      ? (data.analysis as Record<string, unknown>)
      : {};

  const score =
    data.score && typeof data.score === "object"
      ? (data.score as Record<string, unknown>)
      : {};

  const optimization =
    data.optimization && typeof data.optimization === "object"
      ? (data.optimization as Record<string, unknown>)
      : {};

  const numberValue = (value: unknown, fallback = 0): number => {
    return typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, Math.round(value)))
      : fallback;
  };

  return {
    analysis: {
      targetCustomer: cleanText(analysis.targetCustomer),
      purchaseMotivation: cleanText(analysis.purchaseMotivation),
      strongestFeatures: cleanArray(analysis.strongestFeatures),
      weaknesses: cleanArray(analysis.weaknesses),
      missingInformation: cleanArray(analysis.missingInformation),
      seoOpportunities: cleanArray(analysis.seoOpportunities),
      conversionOpportunities: cleanArray(
        analysis.conversionOpportunities
      ),
    },

    score: {
      title: numberValue(score.title),
      description: numberValue(score.description),
      seo: numberValue(score.seo),
      productClarity: numberValue(score.productClarity),
      conversionPotential: numberValue(
        score.conversionPotential
      ),
      overall: numberValue(score.overall),
    },

    optimization: {
      title: cleanText(optimization.title),
      productType: cleanText(optimization.productType),
      description: cleanText(optimization.description),
      features: cleanArray(optimization.features),
      specifications: cleanArray(optimization.specifications),

      // Hard limits requested for the app.
      seoTitle: limitCharacters(
        cleanText(optimization.seoTitle),
        50
      ),

      metaDescription: limitCharacters(
        cleanText(optimization.metaDescription),
        150
      ),

      tags: cleanArray(optimization.tags),
    },

    reasoning: cleanText(data.reasoning),
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured. Add it to the server environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const product: ProductInput =
      body?.product && typeof body.product === "object"
        ? body.product
        : body;

    if (!product || typeof product !== "object") {
      return NextResponse.json(
        {
          error: "Product information is required.",
        },
        { status: 400 }
      );
    }

    const title = cleanText(product.title);

    if (!title) {
      return NextResponse.json(
        {
          error: "Product title is required for AI analysis.",
        },
        { status: 400 }
      );
    }

    const productPayload = {
      title,
      description: cleanText(product.description),
      productType: cleanText(product.productType),
      vendor: cleanText(product.vendor),
      tags: cleanArray(product.tags),
      price: cleanText(product.price),
      audience: product.audience ?? "Unisex",
      style: product.style ?? "Everyday",
      variants: Array.isArray(product.variants)
        ? product.variants
        : [],
      images: Array.isArray(product.images)
        ? product.images
        : [],
      featuredImage: product.featuredImage ?? null,
    };

    const systemPrompt = `
You are Virello AI Optimizer, an expert ecommerce conversion,
SEO and product merchandising AI.

Your job is to improve ecommerce product listings for real
online stores.

IMPORTANT:
- Do not invent technical specifications that are not supported
  by the supplied product information.
- Do not invent materials, certifications, dimensions,
  guarantees, warranties, shipping promises or performance claims.
- Make the copy persuasive without making false claims.
- Write naturally, professionally and clearly.
- Optimize for search intent AND purchase conversion.
- Avoid keyword stuffing.
- Avoid repetitive wording.
- Make the product sound premium and trustworthy.
- The output must work for different ecommerce stores and niches.
- Never hard-code a particular store, brand or product category.
- Use the supplied product information as the source of truth.

SEO LIMITS:
- seoTitle MUST be 50 characters or fewer.
- metaDescription MUST be 150 characters or fewer.
- These limits are strict.

TITLE:
Create a concise, high-converting product title.
Prioritize the product identity, important differentiator and
commercial search intent.

DESCRIPTION:
Write a conversion-focused ecommerce description.
Use a strong opening, clear benefits and natural persuasion.
Do not make unsupported claims.

FEATURES:
Return useful customer-facing features based only on the input.

SPECIFICATIONS:
Return only specifications that are actually supported.

TAGS:
Generate relevant Shopify-style search tags.
Do not use spammy or duplicate tags.

AI ANALYSIS:
Explain the target customer, purchase motivation, strengths,
weaknesses, missing information, SEO opportunities and
conversion opportunities.

SCORING:
Score each category from 0 to 100:
title
description
seo
productClarity
conversionPotential
overall

REASONING:
Briefly explain the most important optimization decisions.

RETURN ONLY VALID JSON.
Do not use Markdown.
Do not wrap the JSON in code fences.

Use exactly this structure:

{
  "analysis": {
    "targetCustomer": "string",
    "purchaseMotivation": "string",
    "strongestFeatures": ["string"],
    "weaknesses": ["string"],
    "missingInformation": ["string"],
    "seoOpportunities": ["string"],
    "conversionOpportunities": ["string"]
  },
  "score": {
    "title": 0,
    "description": 0,
    "seo": 0,
    "productClarity": 0,
    "conversionPotential": 0,
    "overall": 0
  },
  "optimization": {
    "title": "string",
    "productType": "string",
    "description": "string",
    "features": ["string"],
    "specifications": ["string"],
    "seoTitle": "string",
    "metaDescription": "string",
    "tags": ["string"]
  },
  "reasoning": "string"
}
`.trim();

    const userPrompt = `
Analyze and optimize this ecommerce product:

${JSON.stringify(productPayload, null, 2)}

Remember:
seoTitle <= 50 characters
metaDescription <= 150 characters

Return JSON only.
`.trim();

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_output_tokens: 5000,
        }),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      const apiError =
        responseData?.error?.message ||
        "OpenAI API request failed.";

      return NextResponse.json(
        {
          error: apiError,
        },
        { status: response.status }
      );
    }

    const outputText =
      typeof responseData?.output_text === "string"
        ? responseData.output_text.trim()
        : "";

    if (!outputText) {
      return NextResponse.json(
        {
          error:
            "The AI returned an empty optimization result.",
        },
        { status: 502 }
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      const cleaned = outputText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          {
            error:
              "The AI returned an invalid JSON response.",
          },
          { status: 502 }
        );
      }
    }

    const result = normalizeResult(parsed);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Virello AI Optimizer error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while optimizing the product.",
      },
      { status: 500 }
    );
  }
}
