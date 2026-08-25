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
        cleanText(analysis.purchaseMotivation),

      strongestFeatures:
        cleanArray(
          analysis.strongestFeatures
        ),

      weaknesses:
        cleanArray(analysis.weaknesses),

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
      title: clampScore(score.title),
      description: clampScore(
        score.description
      ),
      seo: clampScore(score.seo),
      productClarity:
        clampScore(score.productClarity),
      conversionPotential:
        clampScore(
          score.conversionPotential
        ),
      overall:
        clampScore(score.overall),
    },

    optimization: {
      title: cleanText(optimization.title),

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
        cleanArray(optimization.tags),
    },

    reasoning:
      cleanText(data.reasoning),
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
  const cleaned = value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
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
        { status: 500 }
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
        { status: 400 }
      );
    }

    const audience: Audience =
      product.audience ??
      inferAudience(product);

    const productPayload = {
      id: cleanText(product.id),

      title:
        cleanText(product.title),

      description:
        cleanText(product.description),

      productType:
        cleanText(product.productType),

      vendor:
        cleanText(product.vendor),

      tags:
        cleanArray(product.tags),

      price:
        cleanText(product.price),

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

Virello is a PLATFORM-INDEPENDENT
ecommerce product optimization
application.

It is NOT Shopify-only.

It can work with different ecommerce
stores, platforms, marketplaces,
catalog systems and dropshipping
businesses.

PRIMARY OBJECTIVE:

Create HIGH-CONVERTING ecommerce
product listings.

The final content must help a
qualified shopper:

- understand the product
- understand its benefits
- understand who it is for
- see why it is worth considering
- feel confident about the product
- move closer to purchase

AUDIENCE RULES:

The supplied audience is authoritative.

If audience = "Men":

- Target men.
- Use men's positioning.
- NEVER call the product unisex.
- NEVER change Men's into Unisex.

If audience = "Women":

- Target women.
- Use women's positioning.
- NEVER call the product unisex.
- NEVER change Women's into Unisex.

If audience = "Unisex":

- Keep gender-neutral positioning.

Never override an explicit audience.

SOURCE OF TRUTH:

Use only supplied product
information.

Never invent:

- materials
- movement specifications
- dimensions
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

If information is missing,
report it under missingInformation.

DESCRIPTION:

The optimized description MUST NOT
be empty.

Even when the original description
is empty, create a useful ecommerce
description using the available
product information.

HIGH-CONVERSION DESCRIPTION:

1. Start with the strongest supported
   reason for the shopper to care.

2. Clearly identify the product.

3. Highlight the strongest supported
   features.

4. Turn features into useful buyer
   benefits.

5. Match the stated audience.

6. Create purchase motivation
   without exaggeration.

7. End naturally with a
   purchase-oriented statement.

Do not simply repeat specifications.

Example:

Weak:
"Moon phase display."

Better:
"The moon phase display adds
distinctive detail to the dial,
giving the watch a more refined
visual character."

Only make claims supported by the
product information.

Avoid generic AI filler such as:

"elevate your lifestyle"
"perfect for everyone"
"the ultimate choice"
"designed to impress"
"unparalleled quality"

unless supported by actual data.

CONVERSION SCORING:

Score the FINAL OPTIMIZED LISTING.

Do NOT punish the product simply
because the original seller omitted
optional information.

Missing:

- original description
- price
- variants
- images
- technical details

should NOT automatically force a
very low conversion score.

Evaluate conversion using:

- value proposition
- buyer relevance
- purchase motivation
- benefit clarity
- audience alignment
- feature presentation
- differentiation
- persuasive strength
- trustworthiness
- readability
- objection reduction
- buying appeal

If the available information supports
a strong optimized listing, the
conversionPotential and overall score
should normally be 70 or higher.

Do not intentionally score a strong
optimized listing below 40.

Do not inflate scores without
justification.

SCORING:

Return every score from 0 to 100.

TITLE:

Evaluate:

- clarity
- relevance
- specificity
- readability

DESCRIPTION:

Evaluate:

- usefulness
- clarity
- benefits
- natural language

SEO:

Evaluate:

- search intent
- keyword relevance
- SEO title
- meta description
- natural keyword placement

PRODUCT CLARITY:

Evaluate:

- buyer understanding
- product type
- audience
- important attributes

CONVERSION:

Evaluate:

- purchase motivation
- benefit clarity
- audience fit
- trust
- persuasive quality
- usefulness of final listing

OVERALL:

Represent the quality of the
FINAL optimized listing.

TITLE RULES:

Create a concise natural ecommerce
title.

Avoid keyword stuffing.

Preserve important model numbers.

Do not unnecessarily repeat keywords.

SEO TITLE:

Maximum 60 characters.

META DESCRIPTION:

Maximum 160 characters.

Make it natural and
purchase-oriented.

TAGS:

Use relevant search and catalog
terms only.

FEATURES:

Return concise feature-to-benefit
statements.

SPECIFICATIONS:

Only include specifications that
are actually supported.

ANALYSIS:

Target customer:
Describe the actual likely buyer.

Purchase motivation:
Explain why that buyer would want
the product.

Strongest features:
List strongest supported selling
points.

Weaknesses:
Identify real listing weaknesses.

Missing information:
List information that would improve
the listing.

SEO opportunities:
Give useful search opportunities.

Conversion opportunities:
Give practical improvements that
can increase purchase confidence.

REASONING:

Briefly explain the important
optimization decisions.

Never mention Shopify unless Shopify
is explicitly present in the supplied
product information.

Return only the requested structured
JSON.
`;

    const userPrompt = `
Optimize this ecommerce product
for HIGH CONVERSION.

PRODUCT DATA:

${JSON.stringify(
  productPayload,
  null,
  2
)}

Return the complete structured
optimization.
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
              `Bearer ${apiKey}`,
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
          errorData?.error
            ?.message ??
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
      !result.optimization
        .description
    ) {
      result.optimization
        .description =
        `Discover the ${title}, presented with clear product benefits and a focused ecommerce description based on the supplied information.`;
    }

    if (
      !result.optimization
        .title
    ) {
      result.optimization
        .title =
        title;
    }

    if (
      !result.optimization
        .productType
    ) {
      result.optimization
        .productType =
        cleanText(
          product.productType
        ) ||
        "Product";
    }

    if (
      !result.optimization
        .seoTitle
    ) {
      result.optimization
        .seoTitle =
        limitCharacters(
          result.optimization
            .title,
          60
        );
    }

    if (
      !result.optimization
        .metaDescription
    ) {
      result.optimization
        .metaDescription =
        limitCharacters(
          result.optimization
            .description,
          160
        );
    }

    if (
      audience === "Men" &&
      /\bunisex\b/i.test(
        result.analysis
          .targetCustomer
      )
    ) {
      result.analysis
        .targetCustomer =
        "Men seeking this type of product based on the supplied product information.";
    }

    if (
      audience === "Women" &&
      /\bunisex\b/i.test(
        result.analysis
          .targetCustomer
      )
    ) {
      result.analysis
        .targetCustomer =
        "Women seeking this type of product based on the supplied product information.";
    }

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
          `Virello AI could not optimize this product: ${message}`,
      },
      {
        status: 500,
      }
    );
  }
}
