import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Audience = "Women" | "Men" | "Unisex";

type Style =
  | "Premium / Luxury"
  | "Professional"
  | "Everyday"
  | "Casual"
  | "Sport"
  | "Gift";

type ProductInput = {
  id?: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
  audience?: Audience;
  style?: Style;

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

function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function limitCharacters(
  value: string,
  max: number
): string {
  return value.trim().slice(0, max);
}

function inferAudience(
  product: ProductInput
): Audience {
  const combined = [
    product.title,
    product.description,
    product.productType,
    product.vendor,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /\b(men's|mens|men|man's|mans|male|gentlemen|gentleman)\b/.test(
      combined
    )
  ) {
    return "Men";
  }

  if (
    /\b(women's|womens|women|woman's|womans|female|ladies|lady)\b/.test(
      combined
    )
  ) {
    return "Women";
  }

  if (
    /\b(unisex|gender[- ]?neutral)\b/.test(
      combined
    )
  ) {
    return "Unisex";
  }

  return "Unisex";
}

function normalizeResult(
  raw: unknown
): AIResult {
  const data =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const analysis =
    data.analysis &&
    typeof data.analysis === "object"
      ? (data.analysis as Record<string, unknown>)
      : {};

  const score =
    data.score &&
    typeof data.score === "object"
      ? (data.score as Record<string, unknown>)
      : {};

  const optimization =
    data.optimization &&
    typeof data.optimization === "object"
      ? (data.optimization as Record<string, unknown>)
      : {};

  return {
    analysis: {
      targetCustomer:
        cleanText(analysis.targetCustomer),

      purchaseMotivation:
        cleanText(
          analysis.purchaseMotivation
        ),

      strongestFeatures:
        cleanArray(
          analysis.strongestFeatures
        ),

      weaknesses:
        cleanArray(
          analysis.weaknesses
        ),

      missingInformation:
        cleanArray(
          analysis.missingInformation
        ),

      seoOpportunities:
        cleanArray(
          analysis.seoOpportunities
        ),

      conversionOpportunities:
        cleanArray(
          analysis.conversionOpportunities
        ),
    },

    score: {
      title:
        clampScore(score.title),

      description:
        clampScore(
          score.description
        ),

      seo:
        clampScore(score.seo),

      productClarity:
        clampScore(
          score.productClarity
        ),

      conversionPotential:
        clampScore(
          score.conversionPotential
        ),

      overall:
        clampScore(score.overall),
    },

    optimization: {
      title:
        cleanText(
          optimization.title
        ),

      productType:
        cleanText(
          optimization.productType
        ),

      description:
        cleanText(
          optimization.description
        ),

      features:
        cleanArray(
          optimization.features
        ),

      specifications:
        cleanArray(
          optimization.specifications
        ),

      seoTitle:
        limitCharacters(
          cleanText(
            optimization.seoTitle
          ),
          60
        ),

      metaDescription:
        limitCharacters(
          cleanText(
            optimization.metaDescription
          ),
          160
        ),

      tags:
        cleanArray(
          optimization.tags
        ),
    },

    reasoning:
      cleanText(
        data.reasoning
      ),
  };
}

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

        productType: {
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
        "productType",
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

function parseModelOutput(
  value: string
): unknown {
  const cleaned =
    value
      .trim()
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  if (!cleaned) {
    throw new Error(
      "The AI returned an empty response."
    );
  }

  return JSON.parse(cleaned);
}

export async function POST(
  request: NextRequest
) {
  try {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured in the server environment.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const product: ProductInput =
      body?.product &&
      typeof body.product === "object"
        ? body.product
        : body;

    if (
      !product ||
      typeof product !== "object" ||
      !cleanText(product.title)
    ) {
      return NextResponse.json(
        {
          error:
            "Product title is required for AI optimization.",
        },
        {
          status: 400,
        }
      );
    }

    const audience: Audience =
      product.audience ??
      inferAudience(product);

    const productPayload = {
      id:
        cleanText(
          product.id
        ),

      title:
        cleanText(
          product.title
        ),

      description:
        cleanText(
          product.description
        ),

      productType:
        cleanText(
          product.productType
        ),

      vendor:
        cleanText(
          product.vendor
        ),

      tags:
        cleanArray(
          product.tags
        ),

      price:
        cleanText(
          product.price
        ),

      audience,

      style:
        product.style ??
        "Everyday",

      variants:
        Array.isArray(
          product.variants
        )
          ? product.variants
          : [],

      images:
        Array.isArray(
          product.images
        )
          ? product.images
          : [],

      featuredImage:
        product.featuredImage ??
        null,
    };

    const systemPrompt = `
You are Virello AI Optimizer.

Virello is a PLATFORM-INDEPENDENT ecommerce product optimization application.

Virello is NOT Shopify-only.

Virello can work with:
- Shopify
- WooCommerce
- BigCommerce
- Wix
- marketplaces
- custom ecommerce stores
- catalog systems
- dropshipping businesses
- other ecommerce platforms

Your PRIMARY OBJECTIVE is to create HIGH-CONVERTING ecommerce product listings.

The final listing must help a qualified shopper:

- understand the product
- understand who it is for
- understand the strongest benefits
- understand why it is useful or desirable
- understand what makes it worth considering
- feel confident about the product
- move closer to purchase

==================================================
AUDIENCE — STRICT
==================================================

The supplied audience is authoritative.

If audience = "Men":

- Target men.
- Use men's positioning naturally.
- NEVER call the product unisex.
- NEVER change Men's into Unisex.
- NEVER use "for everyone".
- NEVER use gender-neutral positioning.

If audience = "Women":

- Target women.
- Use women's positioning naturally.
- NEVER call the product unisex.
- NEVER change Women's into Unisex.

If audience = "Unisex":

- Keep gender-neutral positioning.

NEVER override an explicit audience.

==================================================
SOURCE OF TRUTH
==================================================

Use supplied product information as the factual source.

NEVER invent:

- materials
- dimensions
- movement specifications
- water resistance
- warranty
- certifications
- technical performance
- shipping times
- manufacturing claims
- care instructions
- prices
- variants
- availability
- guarantees
- battery life
- power reserve
- gemstone authenticity
- unsupported luxury claims

If information is missing, report it under missingInformation.

Missing optional information must NOT prevent you from creating
strong persuasive copy from the information that IS available.

==================================================
DESCRIPTION — HIGH CONVERSION
==================================================

The optimized description MUST NOT be empty.

The description must NOT simply repeat the title.

Create a real ecommerce sales description.

Use this structure:

1. HOOK
Start with the strongest supported reason the shopper would care.

2. PRODUCT VALUE
Clearly identify what the product offers.

3. BENEFITS
Translate supported features into useful buyer benefits.

4. DESIRABILITY
Explain the visual, functional, practical, or stylistic appeal
when supported by the product information.

5. AUDIENCE FIT
Make the copy relevant to the supplied audience.

6. PURCHASE MOTIVATION
Explain why the product is worth considering.

7. PURCHASE-ORIENTED CLOSE
End naturally with language that encourages the shopper to consider
the product.

Do not use fake urgency.

Do not use fake scarcity.

Do not make unsupported guarantees.

Avoid generic AI filler such as:

"elevate your lifestyle"
"ultimate choice"
"perfect for everyone"
"designed to impress"
"unparalleled quality"
"must-have"
"game changer"

unless actually supported.

Write like a strong ecommerce brand.

Do NOT write like an AI report.

==================================================
FEATURES
==================================================

Features should be feature-to-benefit statements whenever supported.

Weak:

"Moon phase display."

Better:

"Moon phase display — adds distinctive visual detail to the dial."

Only make supported claims.

==================================================
TITLE
==================================================

Create a concise natural ecommerce title.

Preserve important:

- brand
- model number
- product type
- defining feature
- audience when useful

Avoid keyword stuffing.

Do not unnecessarily remove Men's or Women's.

Do not automatically add Unisex.

==================================================
SEO
==================================================

SEO must support conversion.

Use natural search intent.

SEO title:
Maximum 60 characters.

Meta description:
Maximum 160 characters.

The meta description should:

- identify the product
- communicate a benefit
- match the audience
- encourage qualified shoppers to click

Do not keyword stuff.

==================================================
TAGS
==================================================

Use relevant ecommerce search/catalog terms.

Relevant tags may include:

- product type
- important feature
- audience
- model
- style
- use case

Do not create irrelevant tags.

==================================================
CONVERSION SCORING
==================================================

IMPORTANT:

Score the FINAL OPTIMIZED LISTING.

Do NOT score only the original input.

The AI is responsible for improving the listing.

Do NOT heavily punish the conversion score because the original
description was empty.

Do NOT automatically give a low conversion score because the
original seller omitted optional information.

Missing:

- original description
- price
- variants
- images
- optional technical details

may be listed under missingInformation, but must NOT automatically
destroy the conversion score.

Evaluate conversion using:

- value proposition
- benefit clarity
- purchase motivation
- audience alignment
- persuasive strength
- feature-to-benefit quality
- differentiation
- readability
- trustworthiness
- product clarity
- objection reduction
- purchase appeal
- usefulness of the final listing

SCORING GUIDELINE:

90-100:
Exceptional ecommerce listing with strong value, benefits,
specificity, audience fit, persuasive power and purchase motivation.

80-89:
Strong high-converting listing with clear value, benefits,
audience alignment and purchase motivation.

70-79:
Good listing with some opportunities for improvement.

60-69:
Moderate listing with meaningful conversion weaknesses.

Below 60:
Use only when the FINAL optimized listing genuinely has
substantial conversion problems.

If the FINAL optimized listing contains:

- clear product title
- complete useful description
- meaningful benefits
- audience alignment
- strong features
- purchase motivation
- natural persuasive language

then conversionPotential should normally be 80 or higher.

Do NOT intentionally lower conversionPotential simply because
the original listing was incomplete.

Do NOT inflate the score without justification.

==================================================
OVERALL SCORE
==================================================

Overall must represent the quality of the FINAL optimized listing.

A strong optimized listing should receive a strong overall score.

Do not punish the final result simply because the original product
information was incomplete.

==================================================
ANALYSIS
==================================================

targetCustomer:
Describe the actual target shopper based on the supplied audience
and product information.

purchaseMotivation:
Explain the strongest legitimate reasons that shopper would want
the product.

strongestFeatures:
List the strongest supported selling points.

weaknesses:
Identify genuine weaknesses.

missingInformation:
List information that would improve buyer confidence.

seoOpportunities:
List useful search opportunities.

conversionOpportunities:
List practical improvements that can increase purchase confidence
and buying appeal.

==================================================
REASONING
==================================================

Briefly explain the important optimization decisions.

Never mention Shopify unless Shopify is explicitly present in the
supplied product information.

Return ONLY valid structured JSON matching the requested schema.
`;

    const userPrompt = `
Optimize this ecommerce product for HIGH CONVERSION.

PRODUCT DATA:

${JSON.stringify(
  productPayload,
  null,
  2
)}

Return the complete structured optimization.
`;

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6-luna";

    const openAIResponse =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              \`Bearer ${apiKey}\`,
          },

          body: JSON.stringify({
            model,

            input: [
              {
                role: "system",

                content: [
                  {
                    type:
                      "input_text",

                    text:
                      systemPrompt,
                  },
                ],
              },

              {
                role: "user",

                content: [
                  {
                    type:
                      "input_text",

                    text:
                      userPrompt,
                  },
                ],
              },
            ],

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "virello_product_optimization",

                strict: true,

                schema:
                  AI_SCHEMA,
              },
            },
          }),
        }
      );

    const responseText =
      await openAIResponse.text();

    if (
      !openAIResponse.ok
    ) {
      let errorMessage =
        "OpenAI request failed.";

      try {
        const errorData =
          JSON.parse(
            responseText
          );

        errorMessage =
          errorData?.error?.message ??
          errorMessage;
      } catch {
        if (responseText) {
          errorMessage =
            responseText.slice(
              0,
              500
            );
        }
      }

      return NextResponse.json(
        {
          error:
            errorMessage,
        },
        {
          status:
            openAIResponse.status >=
            400
              ? openAIResponse.status
              : 500,
        }
      );
    }

    let responseData: any;

    try {
      responseData =
        JSON.parse(
          responseText
        );
    } catch {
      return NextResponse.json(
        {
          error:
            "OpenAI returned an invalid response.",
        },
        {
          status: 502,
        }
      );
    }

    let outputText =
      typeof responseData?.output_text ===
      "string"
        ? responseData.output_text.trim()
        : "";

    if (!outputText) {
      const output =
        Array.isArray(
          responseData?.output
        )
          ? responseData.output
          : [];

      const parts: string[] = [];

      for (
        const item of output
      ) {
        if (
          !item ||
          typeof item !==
            "object"
        ) {
          continue;
        }

        const content =
          Array.isArray(
            item.content
          )
            ? item.content
            : [];

        for (
          const part of content
        ) {
          if (
            part &&
            typeof part ===
              "object" &&
            typeof part.text ===
              "string"
          ) {
            parts.push(
              part.text.trim()
            );
          }
        }
      }

      outputText =
        parts
          .filter(Boolean)
          .join("\n")
          .trim();
    }

    if (!outputText) {
      return NextResponse.json(
        {
          error:
            "The AI returned no optimization result.",
        },
        {
          status: 502,
        }
      );
    }

    const rawResult =
      parseModelOutput(
        outputText
      );

    const result =
      normalizeResult(
        rawResult
      );

    const title =
      cleanText(
        product.title
      );

    if (
      !result.optimization.description
    ) {
      result.optimization.description =
        \`Discover the ${title}, with a clear focus on its strongest supported features, practical benefits, and appeal to the intended shopper.\`;
    }

    if (
      !result.optimization.title
    ) {
      result.optimization.title =
        title;
    }

    if (
      !result.optimization.productType
    ) {
      result.optimization.productType =
        cleanText(
          product.productType
        ) ||
        "Product";
    }

    if (
      !result.optimization.seoTitle
    ) {
      result.optimization.seoTitle =
        limitCharacters(
          result.optimization.title,
          60
        );
    }

    if (
      !result.optimization.metaDescription
    ) {
      result.optimization.metaDescription =
        limitCharacters(
          result.optimization.description,
          160
        );
    }

    /*
     * FINAL AUDIENCE SAFETY CHECK
     *
     * Prevents Men's and Women's products
     * from being returned as Unisex.
     */

    if (
      audience === "Men"
    ) {
      result.analysis.targetCustomer =
        result.analysis.targetCustomer
          .replace(
            /\bunisex\b/gi,
            "men"
          );

      result.optimization.description =
        result.optimization.description
          .replace(
            /\bunisex\b/gi,
            "men's"
          );

      result.optimization.features =
        result.optimization.features.map(
          (item) =>
            item.replace(
              /\bunisex\b/gi,
              "men's"
            )
        );
    }

    if (
      audience === "Women"
    ) {
      result.analysis.targetCustomer =
        result.analysis.targetCustomer
          .replace(
            /\bunisex\b/gi,
            "women"
          );

      result.optimization.description =
        result.optimization.description
          .replace(
            /\bunisex\b/gi,
            "women's"
          );

      result.optimization.features =
        result.optimization.features.map(
          (item) =>
            item.replace(
              /\bunisex\b/gi,
              "women's"
            )
        );
    }

    /*
     * CONVERSION FLOOR
     *
     * If the final listing is complete and
     * persuasive, do not allow the AI to
     * return an artificially low conversion
     * score.
     */

    const hasStrongDescription =
      result.optimization.description.length >=
      120;

    const hasFeatures =
      result.optimization.features.length >=
      2;

    const hasPurchaseMotivation =
      result.analysis.purchaseMotivation.length >=
      30;

    const hasTargetCustomer =
      result.analysis.targetCustomer.length >=
      20;

    if (
      hasStrongDescription &&
      hasFeatures &&
      hasPurchaseMotivation &&
      hasTargetCustomer
    ) {
      result.score.conversionPotential =
        Math.max(
          result.score.conversionPotential,
          80
        );
    }

    /*
     * Recalculate the overall score from
     * the final optimized listing components.
     */

    const calculatedOverall =
      Math.round(
        (
          result.score.title +
          result.score.description +
          result.score.seo +
          result.score.productClarity +
          result.score.conversionPotential
        ) / 5
      );

    result.score.overall =
      Math.max(
        result.score.overall,
        calculatedOverall
      );

    return NextResponse.json(
      {
        success: true,

        audience,

        result,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Virello AI analysis error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected server error.";

    return NextResponse.json(
      {
        error:
          \`Virello AI could not optimize this product: ${message}\`,
      },
      {
        status: 500,
      }
    );
  }
}
