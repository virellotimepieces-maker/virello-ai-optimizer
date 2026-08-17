import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ProductInput = {
  id?: string;
  title?: string;
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
};

type AIAnalysis = {
  targetCustomer: string;
  purchaseMotivation: string;
  strongestFeatures: string[];
  weaknesses: string[];
  missingInformation: string[];
  seoOpportunities: string[];
  conversionOpportunities: string[];
};

type AIScore = {
  title: number;
  description: number;
  seo: number;
  productClarity: number;
  conversionPotential: number;
  overall: number;
};

type AIOptimization = {
  title: string;
  description: string;
  features: string[];
  specifications: string[];
  seoTitle: string;
  metaDescription: string;
  tags: string[];
};

type AIResult = {
  analysis: AIAnalysis;
  score: AIScore;
  optimization: AIOptimization;
  reasoning: string;
};

/* =========================================================
   HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();

  return values
    .map(clean)
    .filter((value) => {
      const normalized = value.toLowerCase();

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
}

function limitCharacters(
  value: string,
  max: number,
): string {
  const text = clean(value);

  if (text.length <= max) {
    return text;
  }

  let result = text.slice(0, max);

  const lastSpace = result.lastIndexOf(" ");

  if (lastSpace > Math.floor(max * 0.65)) {
    result = result.slice(0, lastSpace);
  }

  return result
    .trim()
    .replace(/[.,;:!?-]+$/, "");
}

/* =========================================================
   AUDIENCE SIGNALS
========================================================= */

/*
 * This is deliberately NOT used to generate the content.
 * It gives the AI stronger context about the actual product.
 *
 * Men's signals are checked before women's signals so that
 * a men's watch is not accidentally classified as women's
 * because of generic words such as "fashion", "elegant",
 * "gift", etc.
 */

function detectAudience(
  product: ProductInput,
): "Men" | "Women" | "Unisex" {
  const title = clean(product.title).toLowerCase();
  const productType = clean(product.productType).toLowerCase();
  const tags = Array.isArray(product.tags)
    ? product.tags.join(" ").toLowerCase()
    : "";
  const description = stripHtml(
    clean(product.description),
  ).toLowerCase();

  const primaryText = [
    title,
    productType,
    tags,
  ].join(" ");

  const menStrong =
    /\bmen\b|\bmen's\b|\bmens\b|\bgentlemen\b|\bgents\b|\bmale\b|\bman\b/.test(
      primaryText,
    );

  const womenStrong =
    /\bwomen\b|\bwomen's\b|\bwomens\b|\bladies\b|\blady\b|\bfemale\b|\bwoman\b/.test(
      primaryText,
    );

  if (menStrong && !womenStrong) {
    return "Men";
  }

  if (womenStrong && !menStrong) {
    return "Women";
  }

  /*
   * If title/product type/tags are ambiguous, inspect the
   * description as secondary evidence.
   */
  const menDescription =
    /\bmen\b|\bmen's\b|\bmens\b|\bgentlemen\b|\bgents\b|\bmale\b|\bman\b/.test(
      description,
    );

  const womenDescription =
    /\bwomen\b|\bwomen's\b|\bwomens\b|\bladies\b|\blady\b|\bfemale\b|\bwoman\b/.test(
      description,
    );

  if (menDescription && !womenDescription) {
    return "Men";
  }

  if (womenDescription && !menDescription) {
    return "Women";
  }

  return "Unisex";
}

/* =========================================================
   OPENAI RESPONSE EXTRACTION
========================================================= */

function extractOutputText(data: any): string {
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output)
    ? data.output
    : [];

  const parts: string[] = [];

  for (const item of output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

/* =========================================================
   VALIDATE AI RESULT
========================================================= */

function normalizeResult(
  raw: any,
): AIResult {
  const analysis = raw?.analysis || {};
  const score = raw?.score || {};
  const optimization =
    raw?.optimization || {};

  const normalizedScore: AIScore = {
    title: Math.max(
      0,
      Math.min(
        100,
        Number(score.title) || 0,
      ),
    ),

    description: Math.max(
      0,
      Math.min(
        100,
        Number(score.description) || 0,
      ),
    ),

    seo: Math.max(
      0,
      Math.min(
        100,
        Number(score.seo) || 0,
      ),
    ),

    productClarity: Math.max(
      0,
      Math.min(
        100,
        Number(score.productClarity) || 0,
      ),
    ),

    conversionPotential: Math.max(
      0,
      Math.min(
        100,
        Number(score.conversionPotential) || 0,
      ),
    ),

    overall: Math.max(
      0,
      Math.min(
        100,
        Number(score.overall) || 0,
      ),
    ),
  };

  const normalizedOptimization: AIOptimization = {
    title: clean(
      optimization.title,
    ),

    description: clean(
      optimization.description,
    ),

    features: unique(
      Array.isArray(
        optimization.features,
      )
        ? optimization.features
        : [],
    ),

    specifications: unique(
      Array.isArray(
        optimization.specifications,
      )
        ? optimization.specifications
        : [],
    ),

    seoTitle: limitCharacters(
      clean(
        optimization.seoTitle,
      ),
      50,
    ),

    metaDescription:
      limitCharacters(
        clean(
          optimization.metaDescription,
        ),
        160,
      ),

    tags: unique(
      Array.isArray(
        optimization.tags,
      )
        ? optimization.tags
        : [],
    ),
  };

  return {
    analysis: {
      targetCustomer: clean(
        analysis.targetCustomer,
      ),

      purchaseMotivation: clean(
        analysis.purchaseMotivation,
      ),

      strongestFeatures: unique(
        Array.isArray(
          analysis.strongestFeatures,
        )
          ? analysis.strongestFeatures
          : [],
      ),

      weaknesses: unique(
        Array.isArray(
          analysis.weaknesses,
        )
          ? analysis.weaknesses
          : [],
      ),

      missingInformation: unique(
        Array.isArray(
          analysis.missingInformation,
        )
          ? analysis.missingInformation
          : [],
      ),

      seoOpportunities: unique(
        Array.isArray(
          analysis.seoOpportunities,
        )
          ? analysis.seoOpportunities
          : [],
      ),

      conversionOpportunities:
        unique(
          Array.isArray(
            analysis.conversionOpportunities,
          )
            ? analysis.conversionOpportunities
            : [],
        ),
    },

    score: normalizedScore,

    optimization:
      normalizedOptimization,

    reasoning: clean(
      raw?.reasoning,
    ),
  };
}

/* =========================================================
   POST /api/ai/analyze
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * -------------------------------------------------------
     * 1. CHECK OPENAI KEY
     * -------------------------------------------------------
     */

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY is missing in Vercel environment variables.",
        },
        { status: 500 },
      );
    }

    /*
     * -------------------------------------------------------
     * 2. READ REQUEST
     * -------------------------------------------------------
     */

    const body = await request.json();

    const product =
      body?.product as
        | ProductInput
        | undefined;

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product data is required.",
        },
        { status: 400 },
      );
    }

    const title = clean(
      product.title,
    );

    const description = stripHtml(
      clean(product.description),
    );

    const productType = clean(
      product.productType,
    );

    const vendor = clean(
      product.vendor,
    );

    const tags = unique(
      Array.isArray(product.tags)
        ? product.tags
        : [],
    );

    const price = clean(
      product.price,
    );

    /*
     * -------------------------------------------------------
     * 3. DETERMINE PRODUCT AUDIENCE
     * -------------------------------------------------------
     */

    const detectedAudience =
      detectAudience(product);

    /*
     * The frontend value is only a hint.
     * The backend detection is prioritized.
     */

    const suppliedAudience =
      product.audience ||
      detectedAudience;

    /*
     * -------------------------------------------------------
     * 4. PREPARE PRODUCT CONTEXT
     * -------------------------------------------------------
     */

    const productContext = {
      id: clean(product.id),

      title,

      description,

      productType,

      vendor,

      tags,

      price,

      detectedAudience,

      suppliedAudience,

      suppliedStyle:
        clean(product.style),
    };

    /*
     * -------------------------------------------------------
     * 5. AI INSTRUCTIONS
     * -------------------------------------------------------
     */

    const instructions = `
You are Virello AI Optimizer, an expert ecommerce product
optimization system for Shopify stores.

Your job is to analyze the REAL product information supplied
by the merchant and create better ecommerce content.

IMPORTANT:

1. ACTUAL PRODUCT FIRST
Never invent product specifications.

2. AUDIENCE ACCURACY
The target customer must match the actual product.

If the product is explicitly a men's watch, classify it as
MEN even if the product description contains generic words
such as:
- fashion
- elegant
- gift
- jewelry
- style
- luxury

Do NOT change a men's product into a women's product.

If the product is explicitly women's, classify it as WOMEN.

If there is genuinely no gender signal, use UNISEX.

3. WATCH PRODUCTS
For watches, pay special attention to:
- men's vs women's
- automatic vs quartz
- mechanical movement
