import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const key = text.toLowerCase();

    if (text && !seen.has(key)) {
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

    audience: clean(
      product.audience,
    ),

    style: clean(product.style),
  };
}

export async function POST(
  request: NextRequest,
) {
  try {
    /*
     * ==========================================
     * OPENAI API KEY
     * ==========================================
     */

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

    /*
     * ==========================================
     * SHOPIFY SESSION
     * ==========================================
     */

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

    /*
     * ==========================================
     * REQUEST DATA
     * ==========================================
     */

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

    /*
     * ==========================================
     * EXISTING SHOPIFY TITLES
     * ==========================================
     */

    const existingTitles =
      unique(
        Array.isArray(
          body.existingProductTitles,
        )
          ? body.existingProductTitles
          : [],
      );

    /*
     * ==========================================
     * CLEAN PRODUCT DATA
     * ==========================================
     */

    const productData =
      safeProduct(product);

    /*
     * ==========================================
     * AI MODEL
     * ==========================================
     */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

    /*
     * ==========================================
     * VIRELLO AI SYSTEM PROMPT
     * ==========================================
     */

    const systemPrompt = `
You are Virello AI Optimizer.

You are an expert ecommerce product strategist,
SEO specialist, merchandising specialist,
and conversion-copywriter for a premium online
watch store targeting United States shoppers.

Your job is to analyze the ACTUAL Shopify
product information provided and then create
a significantly stronger product listing.

IMPORTANT:

This must be REAL AI ANALYSIS.

Do NOT use hard-coded product assumptions.

Do NOT invent product facts.

Do NOT invent specifications.

Do NOT invent materials.

Do NOT invent movement type.

Do NOT invent water resistance.

Do NOT invent dimensions.

Do NOT invent warranty.

Do NOT invent certifications.

Do NOT invent gemstone information.

Do NOT invent country of origin.

Do NOT invent shipping times.

Do NOT invent performance claims.

If information is missing, identify it in
missingInformation.

==================================================
TITLE RULES
==================================================

Create a concise premium product title.

Normally use approximately 4–8 meaningful words.

The title must:

- sound premium
- sound natural
- be easy to understand
- contain useful search language
- avoid keyword stuffing
- avoid excessive punctuation
- avoid ALL CAPS
- avoid generic marketplace wording
- avoid repetitive wording
- avoid fake luxury claims
- avoid unsupported brand claims

The title must NOT exactly match an existing
Shopify product title.

It must also avoid near-duplicates.

A near-duplicate includes changing only:

- punctuation
- one adjective
- color
- capitalization
- pluralization

Create a genuinely differentiated title.

==================================================
DESCRIPTION RULES
==================================================

Create a premium ecommerce description.

The description should:

1. Start with the main customer value.
2. Explain why the product is appealing.
3. Highlight verified features.
4. Use natural SEO language.
5. Encourage purchase without making false claims.
6. Sound like a premium boutique brand.
7. Avoid dropshipping-style wording.
8. Avoid keyword stuffing.
9. Avoid repetitive sentences.
10. Avoid unsupported claims.

==================================================
FEATURE RULES
==================================================

Only list features supported by the supplied
product information.

Never invent features.

==================================================
SPECIFICATION RULES
==================================================

Only list specifications explicitly supplied
by the Shopify product information.

If there are no verified specifications,
return an empty array.

==================================================
SEO RULES
==================================================

SEO title:

Maximum 50 characters.

It should contain the strongest relevant
search phrase naturally.

Meta description:

Maximum 150 characters.

It should be persuasive, natural, and
relevant to the actual product.

==================================================
TAG RULES
==================================================

Generate useful Shopify tags.

Tags should be:

- relevant
- specific
- natural
- based on actual product information
- non-repetitive

Never create unsupported specifications
just to create a tag.

==================================================
SCORING RULES
==================================================

Scores must be from 0 to 100.

The score represents the QUALITY of the
OPTIMIZED RESULT.

Do not artificially give high scores.

However, if the optimized content is genuinely
strong, premium, differentiated, clear,
SEO-friendly, and conversion-focused,
scores should normally be in the 80–95 range.

Do not give 95+ unless the result is genuinely
excellent.

Overall score should consider:

- title quality
- description quality
- SEO
- product clarity
- conversion potential

Conversion and clarity should receive strong
weight.

==================================================
ANALYSIS RULES
==================================================

Analyze:

- target customer
- purchase motivation
- strongest features
- weaknesses
- missing information
- SEO opportunities
- conversion opportunities

The optimization should directly address the
weaknesses and opportunities.

==================================================
FINAL RULE
==================================================

Return ONLY the requested structured JSON
object.

Do not explain these instructions.
`;

    /*
     * ==========================================
     * USER PROMPT
     * ==========================================
     */

    const userPrompt =
      JSON.stringify(
        {
          product: productData,

          existingProductTitles:
            existingTitles,

          task:
            "Analyze the current Shopify product and create the strongest factual premium optimization. Score the quality of the optimized result.",
        },
        null,
        2,
      );

    /*
     * ==========================================
     * OPENAI REQUEST
     * ==========================================
     */

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

    /*
     * ==========================================
     * OPENAI RESPONSE
     * ==========================================
     */

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

    /*
     * ==========================================
     * EXTRACT AI TEXT
     * ==========================================
     */

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

    /*
     * ==========================================
     * PARSE JSON
     * ==========================================
     */

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

    /*
     * ==========================================
     * VALIDATE RESULT
     * ==========================================
     */

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

    /*
     * ==========================================
     * NORMALIZE OPTIMIZATION
     * ==========================================
     */

    result.optimization.title =
      clean(
        result.optimization.title,
      );

    result.optimization.description =
      clean(
        result.optimization
          .description,
      );

    result.optimization.seoTitle =
      limit(
        result.optimization
          .seoTitle,
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
          result.optimization
            .tags,
        )
          ? result.optimization
              .tags
          : [],
      );

    /*
     * ==========================================
     * NORMALIZE ANALYSIS
     * ==========================================
     */

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

    /*
     * ==========================================
     * NORMALIZE SCORES
     * ==========================================
     */

    const scoreKeys = [
      "title",
      "description",
      "seo",
      "productClarity",
      "conversionPotential",
      "overall",
    ];

    for (
      const key of scoreKeys
    ) {
      const value =
        Number(
          result.score[key],
        );

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

    /*
     * ==========================================
     * NORMALIZE REASONING
     * ==========================================
     */

    result.reasoning =
      clean(
        result.reasoning,
      );

    /*
     * ==========================================
     * FINAL RESPONSE
     * ==========================================
     */

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
