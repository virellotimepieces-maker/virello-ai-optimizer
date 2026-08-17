import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* =========================================================
   TYPES
========================================================= */

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
   CONSTANTS
========================================================= */

const SEO_TITLE_MAX = 50;
const META_DESCRIPTION_MAX = 150;

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

function clampScore(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(number)),
  );
}

/* =========================================================
   AUDIENCE DETECTION
========================================================= */

function detectAudience(
  product: ProductInput,
): "Men" | "Women" | "Unisex" {
  const title = clean(product.title).toLowerCase();

  const productType = clean(
    product.productType,
  ).toLowerCase();

  const tags = Array.isArray(product.tags)
    ? product.tags.join(" ").toLowerCase()
    : "";

  const description = stripHtml(
    clean(product.description),
  ).toLowerCase();

  /*
   * We prioritize title, product type and tags.
   * This prevents generic words inside a description
   * from incorrectly changing the audience.
   */

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

  if (menStrong && womenStrong) {
    /*
     * If both appear in the strongest fields,
     * treat as Unisex rather than guessing.
     */
    return "Unisex";
  }

  /*
   * Only use the description if the stronger fields
   * contain no gender information.
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
   OPENAI OUTPUT EXTRACTION
========================================================= */

function extractOutputText(
  data: any,
): string {
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
   NORMALIZE RESULT
========================================================= */

function normalizeResult(
  raw: any,
): AIResult {
  const analysis =
    raw?.analysis || {};

  const score =
    raw?.score || {};

  const optimization =
    raw?.optimization || {};

  const normalizedScore: AIScore = {
    title: clampScore(score.title),
    description: clampScore(score.description),
    seo: clampScore(score.seo),
    productClarity: clampScore(
      score.productClarity,
    ),
    conversionPotential: clampScore(
      score.conversionPotential,
    ),
    overall: clampScore(score.overall),
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
      SEO_TITLE_MAX,
    ),

    metaDescription: limitCharacters(
      clean(
        optimization.metaDescription,
      ),
      META_DESCRIPTION_MAX,
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
   AI JSON SCHEMA
========================================================= */

const AI_SCHEMA = {
  type: "object",

  additionalProperties: false,

  properties: {
    analysis: {
      type: "object",

      additionalProperties: false,

      properties: {
        targetCustomer: {
          type: "string",
        },

        purchaseMotivation: {
          type: "string",
        },

        strongestFeatures: {
          type: "array",
          items: {
            type: "string",
          },
        },

        weaknesses: {
          type: "array",
          items: {
            type: "string",
          },
        },

        missingInformation: {
          type: "array",
          items: {
            type: "string",
          },
        },

        seoOpportunities: {
          type: "array",
          items: {
            type: "string",
          },
        },

        conversionOpportunities: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },

      required: [
        "targetCustomer",
        "purchaseMotivation",
        "strongestFeatures",
        "weaknesses",
        "missingInformation",
        "seoOpportunities",
        "conversionOpportunities",
      ],
    },

    score: {
      type: "object",

      additionalProperties: false,

      properties: {
        title: {
          type: "number",
        },

        description: {
          type: "number",
        },

        seo: {
          type: "number",
        },

        productClarity: {
          type: "number",
        },

        conversionPotential: {
          type: "number",
        },

        overall: {
          type: "number",
        },
      },

      required: [
        "title",
        "description",
        "seo",
        "productClarity",
        "conversionPotential",
        "overall",
      ],
    },

    optimization: {
      type: "object",

      additionalProperties: false,

      properties: {
        title: {
          type: "string",
        },

        description: {
          type: "string",
        },

        features: {
          type: "array",
          items: {
            type: "string",
          },
        },

        specifications: {
          type: "array",
          items: {
            type: "string",
          },
        },

        seoTitle: {
          type: "string",
        },

        metaDescription: {
          type: "string",
        },

        tags: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },

      required: [
        "title",
        "description",
        "features",
        "specifications",
        "seoTitle",
        "metaDescription",
        "tags",
      ],
    },

    reasoning: {
      type: "string",
    },
  },

  required: [
    "analysis",
    "score",
    "optimization",
    "reasoning",
  ],
};

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    /* -----------------------------------------------------
       1. API KEY
    ----------------------------------------------------- */

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY is missing in Vercel Environment Variables.",
        },
        {
          status: 500,
        },
      );
    }

    /* -----------------------------------------------------
       2. REQUEST BODY
    ----------------------------------------------------- */

    const body =
      await request.json();

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
        {
          status: 400,
        },
      );
    }

    /* -----------------------------------------------------
       3. CLEAN PRODUCT DATA
    ----------------------------------------------------- */

    const title =
      clean(product.title);

    const description =
      stripHtml(
        clean(
          product.description,
        ),
      );

    const productType =
      clean(
        product.productType,
      );

    const vendor =
      clean(
        product.vendor,
      );

    const tags =
      unique(
        Array.isArray(
          product.tags,
        )
          ? product.tags
          : [],
      );

    const price =
      clean(
        product.price,
      );

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product title is required for AI analysis.",
        },
        {
          status: 400,
        },
      );
    }

    /* -----------------------------------------------------
       4. AUDIENCE
    ----------------------------------------------------- */

    const detectedAudience =
      detectAudience(
        product,
      );

    const suppliedAudience =
      product.audience ||
      detectedAudience;

    /* -----------------------------------------------------
       5. PRODUCT CONTEXT
    ----------------------------------------------------- */

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
        clean(
          product.style,
        ),
    };

    /* -----------------------------------------------------
       6. AI INSTRUCTIONS
    ----------------------------------------------------- */

    const instructions = `
You are Virello AI Optimizer.

You are an expert ecommerce product analyst,
Shopify SEO specialist, conversion copywriter,
and premium watch merchandising specialist.

Your task is to analyze the ACTUAL Shopify product
information and produce a better product listing.

The supplied product data is authoritative.

========================================================
AUDIENCE
========================================================

Backend detected audience:

${detectedAudience}

This value is authoritative.

If it is Men:
- Keep the product positioned for men.
- Do not describe the target customer as women.
- Do not change it to unisex.
- Generic words such as luxury, elegant, gift,
  fashion, style, premium or classic do NOT override it.

If it is Women:
- Keep the product positioned for women.

If it is Unisex:
- Use unisex positioning unless the actual product
  information clearly proves otherwise.

========================================================
WATCH ANALYSIS
========================================================

When the product is a watch, inspect the actual
information for:

- automatic movement
- mechanical movement
- quartz movement
- chronograph
- sapphire crystal
- mineral crystal
- stainless steel
- case diameter
- case material
- bracelet
- leather strap
- water resistance
- dial
- bezel
- lume
- date display
- screw-down crown
- screw-down case back
- dress styling
- sport styling
- everyday styling
- professional styling

Only mention specifications that are actually present
in the supplied product information.

NEVER guess specifications.

========================================================
PRODUCT TITLE
========================================================

Create a premium ecommerce product title.

The product title has NO technical character limit
from this backend.

However, keep it concise and easy to read.

Prefer approximately 4–8 meaningful words when possible.

Use the most important product identity first.

Avoid:
- keyword stuffing
- repeated words
- supplier-style wording
- long keyword chains
- unnecessary promotional phrases
- "cheap"
- "best"
- "hot sale"
- "factory direct"
- "wholesale"
- "dropshipping"

If a legitimate brand is present in the actual product
information, it may be retained when useful.

Do not remove a legitimate product brand merely because
it is a brand.

========================================================
DESCRIPTION
========================================================

Create a premium Shopify description.

The description should explain:

1. What the product is
2. Who it is for
3. Why the shopper may want it
4. The strongest verified features
5. The practical or style benefits
6. The purchase motivation

Use natural premium ecommerce language.

Do not sound like a supplier listing.

Do not invent specifications.

Do not make unsupported claims about:
- durability
- performance
- certification
- warranty
- quality grades
- shipping
- guarantees
- reviews

========================================================
SEO TITLE
========================================================

Maximum 50 characters.

Make it:
- natural
- relevant
- concise
- keyword focused
- readable

Do not stuff keywords.

========================================================
META DESCRIPTION
========================================================

Maximum 150 characters.

Make it:
- compelling
- natural
- product-specific
- conversion focused

Do not exceed 150 characters.

========================================================
TAGS
========================================================

Create relevant Shopify tags.

Use actual product characteristics.

Avoid:
- duplicates
- irrelevant keywords
- supplier names unless legitimately part of the product
- generic spam tags

========================================================
CURRENT LISTING SCORE
========================================================

Score the CURRENT product listing BEFORE optimization.

Do not score the optimized result.

Be honest.

Evaluate:

1. Title
2. Description
3. SEO
4. Product clarity
5. Buyer relevance
6. Benefit communication
7. Trust
8. Purchase motivation
9. Information completeness
10. Differentiation
11. Conversion readiness

Do not automatically give high scores.

A listing with missing important information should
receive a lower score.

========================================================
SCORING
========================================================

90–100 = exceptional
80–89 = strong
70–79 = good
60–69 = average
50–59 = weak
40–49 = poor
0–39 = very poor

The score must represent the CURRENT listing.

========================================================
MISSING INFORMATION
========================================================

Identify information that is actually missing and could
prevent a shopper from confidently purchasing.

For watches, examples may include:
- case diameter
- movement
- crystal
- case material
- strap material
- water resistance
- warranty

Only list something as missing when it is genuinely
not provided.

========================================================
CONVERSION OPPORTUNITIES
========================================================

Give specific improvements.

Do NOT say:
"Improve the description."

Instead say what should be added or changed.

Example:

"Add the verified case diameter because shoppers
considering a watch need to understand its wrist presence."

Only recommend information that can reasonably be
verified from the actual product data.

========================================================
NO HALLUCINATION
========================================================

Never invent:

- materials
- dimensions
- movement
- water resistance
- certifications
- warranty
- origin
- battery life
- compatibility
- accessories
- performance numbers
- reviews
- ratings
- shipping times
- guarantees

========================================================
OUTPUT
========================================================

Return only the structured JSON requested by the schema.
`;

    /* -----------------------------------------------------
       7. USER INPUT
    ----------------------------------------------------- */

    const userInput = `
Analyze this Shopify product.

PRODUCT CONTEXT:

${JSON.stringify(
  productContext,
  null,
  2,
)}

IMPORTANT:

Detected audience = ${detectedAudience}

The detected audience must remain authoritative.

The score must evaluate the CURRENT listing,
not the optimized listing.

SEO title maximum = ${SEO_TITLE_MAX} characters.

Meta description maximum = ${META_DESCRIPTION_MAX} characters.

Product title has no backend character limit,
but should remain concise and premium.

Use only verified information from the product context.
`;

    /* -----------------------------------------------------
       8. MODEL
    ----------------------------------------------------- */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

    /* -----------------------------------------------------
       9. OPENAI REQUEST
    ----------------------------------------------------- */

    const openAIResponse =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },

          body: JSON.stringify({
            model,

            instructions,

            input:
              userInput,

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "virello_product_optimization",

                strict:
                  true,

                schema:
                  AI_SCHEMA,
              },
            },
          }),
        },
      );

    /* -----------------------------------------------------
       10. OPENAI ERROR
    ----------------------------------------------------- */

    if (!openAIResponse.ok) {
      const errorText =
        await openAIResponse.text();

      console.error(
        "OpenAI API error:",
        errorText,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI could not complete the analysis.",

          details:
            process.env.NODE_ENV ===
            "development"
              ? errorText
              : undefined,
        },
        {
          status: 502,
        },
      );
    }

    /* -----------------------------------------------------
       11. READ RESPONSE
    ----------------------------------------------------- */

    const openAIData =
      await openAIResponse.json();

    const outputText =
      extractOutputText(
        openAIData,
      );

    if (!outputText) {
      console.error(
        "OpenAI returned no output:",
        openAIData,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI returned an empty response.",
        },
        {
          status: 502,
        },
      );
    }

    /* -----------------------------------------------------
       12. PARSE JSON
    ----------------------------------------------------- */

    let rawResult: any;

    try {
      rawResult =
        JSON.parse(
          outputText,
        );
    } catch (parseError) {
      console.error(
        "Failed to parse OpenAI JSON:",
        parseError,
        outputText,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI returned invalid structured data.",
        },
        {
          status: 502,
        },
      );
    }

    /* -----------------------------------------------------
       13. NORMALIZE
    ----------------------------------------------------- */

    const result =
      normalizeResult(
        rawResult,
      );

    /* -----------------------------------------------------
       14. FINAL AUDIENCE SAFETY
    ----------------------------------------------------- */

    if (
      detectedAudience === "Men" &&
      /women|female|ladies|woman/i.test(
        result.analysis.targetCustomer,
      )
    ) {
      result.analysis.targetCustomer =
        "Men looking for a premium watch suited to their personal style, everyday wear, professional settings, or special occasions.";
    }

    if (
      detectedAudience === "Women" &&
      /men|male|gentlemen|man/i.test(
        result.analysis.targetCustomer,
      )
    ) {
      result.analysis.targetCustomer =
        "Women looking for a stylish watch suited to their personal style, everyday wear, professional settings, or special occasions.";
    }

    /* -----------------------------------------------------
       15. FINAL CHARACTER SAFETY
    ----------------------------------------------------- */

    result.optimization.seoTitle =
      limitCharacters(
        result.optimization.seoTitle,
        SEO_TITLE_MAX,
      );

    result.optimization.metaDescription =
      limitCharacters(
        result.optimization.metaDescription,
        META_DESCRIPTION_MAX,
      );

    /* -----------------------------------------------------
       16. RETURN
    ----------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        result,

        detectedAudience,

        productId:
          clean(product.id),

        model,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Virello AI analyze error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected Virello AI error.",
      },
      {
        status: 500,
      },
    );
  }
}
