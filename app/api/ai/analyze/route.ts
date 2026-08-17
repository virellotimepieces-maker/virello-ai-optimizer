import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type Audience = "Men" | "Women" | "Unisex";

type ProductInput = {
  id?: string;
  title?: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
  audience?: string;
  style?: string;
};

type AnalyzeBody = {
  product?: ProductInput;
  existingProductTitles?: string[];
};

/* =========================================================
   RESPONSE SCHEMA
========================================================= */

const responseSchema = {
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
          type: "integer",
          minimum: 0,
          maximum: 100,
        },

        description: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },

        seo: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },

        productClarity: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },

        conversionPotential: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },

        overall: {
          type: "integer",
          minimum: 0,
          maximum: 100,
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
} as const;

/* =========================================================
   HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = clean(value);

    if (!text) {
      continue;
    }

    const key = text.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }

  return result;
}

function limit(
  value: unknown,
  max: number,
): string {
  const text = clean(value);

  if (text.length <= max) {
    return text;
  }

  let result = text.slice(0, max);

  const lastSpace =
    result.lastIndexOf(" ");

  if (
    lastSpace >
    Math.floor(max * 0.65)
  ) {
    result =
      result.slice(0, lastSpace);
  }

  return result
    .replace(/[.,;:!?-]+$/, "")
    .trim();
}

function normalizeAudience(
  value: unknown,
): Audience {
  const audience =
    clean(value).toLowerCase();

  if (audience === "men") {
    return "Men";
  }

  if (audience === "women") {
    return "Women";
  }

  return "Unisex";
}

function safeProduct(
  product: ProductInput,
): Record<string, unknown> {
  return {
    id: clean(product.id),

    title: clean(product.title),

    description: clean(
      product.description,
    ),

    productType: clean(
      product.productType,
    ),

    vendor: clean(product.vendor),

    tags: unique(
      Array.isArray(product.tags)
        ? product.tags
        : [],
    ),

    price: clean(product.price),

    audience: normalizeAudience(
      product.audience,
    ),

    style: clean(product.style),
  };
}

/* =========================================================
   AUDIENCE RULES
========================================================= */

function audienceInstructions(
  audience: Audience,
): string {
  if (audience === "Men") {
    return `
==================================================
STRICT AUDIENCE: MEN
==================================================

The authoritative target audience is MEN.

This instruction has the highest priority.

The product MUST be positioned as a men's product.

targetCustomer MUST describe men.

purchaseMotivation MUST be relevant to male shoppers.

conversionOpportunities MUST be relevant to male shoppers.

The title must remain appropriate for a men's product.

The description must remain appropriate for a men's product.

SEO content must remain appropriate for men's search intent.

Do NOT target women.

Do NOT describe women as the target customer.

Do NOT say "women and men".

Do NOT say "men and women".

Do NOT use:
- women's
- women
- ladies
- female
- for her

unless the term appears only inside missingInformation
to explicitly explain conflicting source data.

If the source product data contains conflicting
female-oriented wording, prioritize the authoritative
audience value supplied by the application and identify
the conflict in missingInformation.

Never silently change MEN into women or unisex.
`;
  }

  if (audience === "Women") {
    return `
==================================================
STRICT AUDIENCE: WOMEN
==================================================

The authoritative target audience is WOMEN.

The product MUST be positioned as a women's product.

targetCustomer MUST describe women.

purchaseMotivation MUST be relevant to female shoppers.

conversionOpportunities MUST be relevant to female shoppers.

Do NOT target men.

Do NOT describe men as the target customer.

Do NOT say "men and women".

Do NOT use male-oriented positioning.
`;
  }

  return `
==================================================
STRICT AUDIENCE: UNISEX
==================================================

The authoritative target audience is UNISEX.

The product may be positioned for both men and women.

Do not force a gender-specific positioning unless
the source data clearly supports it.

Use inclusive language.
`;
}

/* =========================================================
   AUDIENCE VALIDATION
========================================================= */

function containsForbiddenAudienceLanguage(
  value: unknown,
  audience: Audience,
): boolean {
  const text = clean(value).toLowerCase();

  if (!text) {
    return false;
  }

  if (audience === "Men") {
    return /\bwomen\b|\bwomen's\b|\bladies\b|\bfemale\b|\bfor her\b/.test(
      text,
    );
  }

  if (audience === "Women") {
    return /\bmen\b|\bmen's\b|\bgentlemen\b|\bmale\b|\bfor him\b/.test(
      text,
    );
  }

  return false;
}

/* =========================================================
   VALIDATE AUDIENCE RESULT
========================================================= */

function validateAudienceResult(
  result: any,
  audience: Audience,
): string | null {
  const analysis =
    result?.analysis || {};

  const optimization =
    result?.optimization || {};

  const fields = [
    analysis.targetCustomer,
    analysis.purchaseMotivation,

    ...(Array.isArray(
      analysis.conversionOpportunities,
    )
      ? analysis.conversionOpportunities
      : []),

    ...(Array.isArray(
      analysis.seoOpportunities,
    )
      ? analysis.seoOpportunities
      : []),

    optimization.title,
    optimization.description,
    optimization.seoTitle,
    optimization.metaDescription,

    ...(Array.isArray(
      optimization.tags,
    )
      ? optimization.tags
      : []),
  ];

  for (const field of fields) {
    if (
      containsForbiddenAudienceLanguage(
        field,
        audience,
      )
    ) {
      if (audience === "Men") {
        return (
          "AI returned female-oriented positioning for a Men's product."
        );
      }

      if (audience === "Women") {
        return (
          "AI returned male-oriented positioning for a Women's product."
        );
      }
    }
  }

  return null;
}

/* =========================================================
   NORMALIZE RESULT
========================================================= */

function normalizeResult(
  result: any,
): any {
  result.optimization.title =
    clean(
      result.optimization.title,
    );

  result.optimization.description =
    clean(
      result.optimization.description,
    );

  result.optimization.seoTitle =
    limit(
      result.optimization.seoTitle,
      50,
    );

  result.optimization.metaDescription =
    limit(
      result.optimization
        .metaDescription,
      150,
    );

  result.optimization.features =
    unique(
      Array.isArray(
        result.optimization
          .features,
      )
        ? result.optimization
            .features
        : [],
    );

  result.optimization.specifications =
    unique(
      Array.isArray(
        result.optimization
          .specifications,
      )
        ? result.optimization
            .specifications
        : [],
    );

  result.optimization.tags =
    unique(
      Array.isArray(
        result.optimization.tags,
      )
        ? result.optimization.tags
        : [],
    );

  result.analysis.targetCustomer =
    clean(
      result.analysis
        .targetCustomer,
    );

  result.analysis.purchaseMotivation =
    clean(
      result.analysis
        .purchaseMotivation,
    );

  result.analysis.strongestFeatures =
    unique(
      Array.isArray(
        result.analysis
          .strongestFeatures,
      )
        ? result.analysis
            .strongestFeatures
        : [],
    );

  result.analysis.weaknesses =
    unique(
      Array.isArray(
        result.analysis
          .weaknesses,
      )
        ? result.analysis
            .weaknesses
        : [],
    );

  result.analysis.missingInformation =
    unique(
      Array.isArray(
        result.analysis
          .missingInformation,
      )
        ? result.analysis
            .missingInformation
        : [],
    );

  result.analysis.seoOpportunities =
    unique(
      Array.isArray(
        result.analysis
          .seoOpportunities,
      )
        ? result.analysis
            .seoOpportunities
        : [],
    );

  result.analysis.conversionOpportunities =
    unique(
      Array.isArray(
        result.analysis
          .conversionOpportunities,
      )
        ? result.analysis
            .conversionOpportunities
        : [],
    );

  const scoreKeys = [
    "title",
    "description",
    "seo",
    "productClarity",
    "conversionPotential",
    "overall",
  ];

  for (const key of scoreKeys) {
    const value =
      Number(result.score[key]);

    result.score[key] =
      Number.isFinite(value)
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(value),
            ),
          )
        : 0;
  }

  result.reasoning =
    clean(result.reasoning);

  return result;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    /* =====================================================
       OPENAI KEY
    ===================================================== */

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

    /* =====================================================
       SHOPIFY SESSION
    ===================================================== */

    const authorization =
      request.headers.get(
        "authorization",
      );

    const sessionToken =
      request.headers.get(
        "x-shopify-session-token",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      ) ||
      !sessionToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify session is required. Reopen Virello from Shopify Admin.",
        },
        {
          status: 401,
        },
      );
    }

    /* =====================================================
       REQUEST BODY
    ===================================================== */

    const body =
      (await request.json()) as AnalyzeBody;

    const product =
      body.product;

    if (!product?.title) {
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

    /* =====================================================
       EXISTING TITLES
    ===================================================== */

    const existingTitles =
      unique(
        Array.isArray(
          body.existingProductTitles,
        )
          ? body.existingProductTitles
          : [],
      );

    /* =====================================================
       PRODUCT DATA
    ===================================================== */

    const productData =
      safeProduct(product);

    const authoritativeAudience =
      normalizeAudience(
        product.audience,
      );

    /* =====================================================
       MODEL
    ===================================================== */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

    /* =====================================================
       SYSTEM PROMPT
    ===================================================== */

    const systemPrompt = `
You are Virello AI Optimizer.

You are an advanced ecommerce product strategist,
SEO specialist, merchandising specialist,
and conversion copywriter for a premium online
watch store.

Your job is to analyze the ACTUAL Shopify product
data and create a stronger product listing.

This is REAL AI ANALYSIS.

Do not use fake hard-coded product information.

Do not invent facts.

Do not invent specifications.

Do not invent materials.

Do not invent movement type.

Do not invent water resistance.

Do not invent dimensions.

Do not invent warranty.

Do not invent certifications.

Do not invent gemstone information.

Do not invent country of origin.

Do not invent shipping times.

Do not invent performance claims.

Do not invent brand claims.

If information is unavailable,
identify it in missingInformation.

${audienceInstructions(
  authoritativeAudience,
)}

==================================================
PRODUCT POSITIONING
==================================================

The supplied audience is authoritative.

The supplied style is authoritative as a
marketing direction.

Analyze the product according to:

- actual product title
- actual description
- actual product type
- actual vendor
- actual tags
- actual price
- selected audience
- selected style

Do not allow unrelated words in the source
description to override the authoritative audience.

==================================================
TITLE
==================================================

Create a concise premium ecommerce title.

Target approximately 4–8 meaningful words.

The title should:

- clearly identify the product
- sound premium
- sound natural
- use relevant search language
- avoid keyword stuffing
- avoid excessive punctuation
- avoid ALL CAPS
- avoid generic marketplace wording
- avoid repetitive wording
- avoid fake luxury claims
- avoid unsupported claims
- fit the selected audience

The title must NOT exactly match an existing
Shopify title.

Avoid near duplicates.

A near duplicate includes changing only:

- punctuation
- capitalization
- one adjective
- pluralization
- minor word order

Create a genuinely differentiated title.

==================================================
DESCRIPTION
==================================================

Write customer-facing premium product copy.

The description should:

1. Lead with the main customer value.
2. Explain the product's appeal.
3. Highlight verified features.
4. Use natural SEO language.
5. Support purchase intent.
6. Match the selected audience.
7. Match the selected style.
8. Sound like a premium boutique brand.
9. Avoid dropshipping-style language.
10. Avoid keyword stuffing.
11. Avoid repetitive sentences.
12. Avoid unsupported claims.

Do not use fake urgency.

Do not claim scarcity unless supplied.

Do not claim "best", "number one",
"guaranteed", or similar unsupported claims.

==================================================
FEATURES
==================================================

Only include features supported by actual
product information.

Never invent a feature.

==================================================
SPECIFICATIONS
==================================================

Only include specifications explicitly
supported by the supplied product data.

If no reliable specifications are available,
return an empty array.

Do not guess.

==================================================
SEO TITLE
==================================================

Maximum 50 characters.

Use the strongest relevant search phrase.

Keep it natural.

Do not keyword stuff.

==================================================
META DESCRIPTION
==================================================

Maximum 150 characters.

Make it:

- relevant
- persuasive
- natural
- audience-specific
- search-friendly

==================================================
TAGS
==================================================

Generate useful Shopify tags.

Tags must be based on actual product data.

Use relevant product category,
style, audience, design, and verified features.

Do not create unsupported technical tags.

Do not repeat the same concept unnecessarily.

==================================================
ANALYSIS
==================================================

Analyze:

- target customer
- purchase motivation
- strongest features
- weaknesses
- missing information
- SEO opportunities
- conversion opportunities

The analysis should explain what makes this
specific product commercially attractive.

Do not give generic ecommerce advice.

==================================================
SCORING
==================================================

Score the QUALITY of the optimized result
from 0 to 100.

Do not artificially inflate scores.

Use these approximate standards:

90–100 = exceptional
80–89 = strong
70–79 = good
60–69 = moderate
50–59 = weak
below 50 = poor

A genuinely strong optimized listing should
normally land in the 80–95 range.

Do not give 95+ unless the result is genuinely
excellent.

Consider:

Title:
- relevance
- clarity
- search intent
- differentiation

Description:
- persuasion
- clarity
- verified benefits
- audience fit
- premium tone

SEO:
- keyword relevance
- natural language
- search intent
- title/meta quality

Product clarity:
- what it is
- who it is for
- why it matters
- important verified details

Conversion:
- value communication
- trust
- clarity
- purchase motivation
- audience fit

Overall should be a balanced assessment of
all categories.

Missing information should NOT automatically
destroy the score if the listing remains strong.

==================================================
FINAL OUTPUT
==================================================

Return ONLY the requested structured JSON object.

No markdown.

No explanation outside the JSON.
`;

    /* =====================================================
       USER PROMPT
    ===================================================== */

    const userPrompt =
      JSON.stringify(
        {
          authoritativeAudience:
            authoritativeAudience,

          product:
            productData,

          existingProductTitles:
            existingTitles,

          task:
            "Analyze this actual Shopify product and create a stronger factual premium optimization while strictly following the authoritative audience.",
        },
        null,
        2,
      );

    /* =====================================================
       OPENAI REQUEST
    ===================================================== */

    const aiResponse =
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

          body: JSON.stringify(
            {
              model,

              input: [
                {
                  role: "system",
                  content:
                    systemPrompt,
                },

                {
                  role: "user",
                  content:
                    userPrompt,
                },
              ],

              text: {
                format: {
                  type: "json_schema",

                  name:
                    "virello_ai_result",

                  strict: true,

                  schema:
                    responseSchema,
                },
              },

              max_output_tokens:
                5000,
            },
          ),
        },
      );

    /* =====================================================
       READ OPENAI RESPONSE
    ===================================================== */

    const raw =
      (await aiResponse.json()) as {
        error?: {
          message?: string;
        };

        output_text?: string;

        output?: Array<{
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
      };

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          success: false,

          error:
            raw.error?.message ||
            `OpenAI request failed with status ${aiResponse.status}.`,
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       EXTRACT TEXT
    ===================================================== */

    const outputText =
      raw.output_text ||
      raw.output
        ?.flatMap(
          (item) =>
            item.content || [],
        )
        .find(
          (item) =>
            item.type ===
            "output_text",
        )?.text ||
      "";

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,

          error:
            "OpenAI returned no analysis output.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       PARSE JSON
    ===================================================== */

    let result: any;

    try {
      result =
        JSON.parse(outputText);
    } catch {
      return NextResponse.json(
        {
          success: false,

          error:
            "OpenAI returned invalid structured output.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    if (
      !result?.analysis ||
      !result?.score ||
      !result?.optimization
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "AI returned an incomplete optimization.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       NORMALIZE
    ===================================================== */

    result =
      normalizeResult(result);

    /* =====================================================
       STRICT AUDIENCE VALIDATION
    ===================================================== */

    const audienceError =
      validateAudienceResult(
        result,
        authoritativeAudience,
      );

    if (audienceError) {
      console.error(
        "Virello audience validation failed:",
        {
          audience:
            authoritativeAudience,

          product:
            productData,

          error:
            audienceError,
        },
      );

      return NextResponse.json(
        {
          success: false,

          error:
            `${audienceError} Please run the AI analysis again.`,
        },
        {
          status: 422,
        },
      );
    }

    /* =====================================================
       FINAL TITLE VALIDATION
    ===================================================== */

    if (
      !result.optimization.title
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "AI generated an empty product title.",
        },
        {
          status: 422,
        },
      );
    }

    /* =====================================================
       DUPLICATE TITLE CHECK
    ===================================================== */

    const generatedTitle =
      clean(
        result.optimization.title,
      ).toLowerCase();

    const normalizedGeneratedTitle =
      generatedTitle
        .replace(
          /[^a-z0-9\s]/gi,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();

    const duplicateTitle =
      existingTitles.find(
        (existingTitle) => {
          const normalizedExisting =
            clean(
              existingTitle,
            )
              .toLowerCase()
              .replace(
                /[^a-z0-9\s]/gi,
                "",
              )
              .replace(
                /\s+/g,
                " ",
              )
              .trim();

          return (
            normalizedExisting ===
              normalizedGeneratedTitle ||
            normalizedExisting ===
              generatedTitle
          );
        },
      );

    if (duplicateTitle) {
      return NextResponse.json(
        {
          success: false,

          error:
            "AI generated a product title that already exists in Shopify. Please run the analysis again to generate a different title.",
        },
        {
          status: 422,
        },
      );
    }

    /* =====================================================
       FINAL RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      result,
    });
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
            : "Virello AI analysis failed.",
      },
      {
        status: 500,
      },
    );
  }
}
