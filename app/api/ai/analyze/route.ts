import { NextRequest, NextResponse } from "next/server";
import {
  authorizeSubscriberForAI,
  setSubscriberCookie,
} from "../../_lib/subscriber";

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
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampScore(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(value))
  );
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
        cleanText(
          analysis.targetCustomer
        ),

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
            "OPENAI_API_KEY is not configured in Vercel.",
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

    /*
     * ============================================================
     * SUBSCRIBER AUTHORIZATION
     * ============================================================
     *
     * This must happen before the OpenAI request.
     *
     * Non-subscribers, invalid sessions, canceled subscriptions,
     * unpaid subscriptions, and users who reached their usage
     * limit are blocked by authorizeSubscriberForAI().
     */

    const subscriberAuthorization =
      await authorizeSubscriberForAI(
        request
      );

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

PRIMARY OBJECTIVE:

Create genuinely HIGH-CONVERTING ecommerce product listings.

The final listing should help a qualified shopper:

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

- Use gender-neutral positioning.

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

Missing optional information must NOT prevent creation of strong
persuasive copy from the information that IS available.

==================================================
DESCRIPTION — HIGH CONVERSION
==================================================

The optimized description MUST NOT be empty.

Write a REAL ecommerce sales description.

Do not simply repeat the title.

Use this structure:

1. HOOK

Start with the strongest supported reason the shopper should care.

2. PRODUCT VALUE

Clearly explain what the product offers.

3. BENEFITS

Translate supported features into useful buyer benefits.

4. DESIRABILITY

Explain visual, functional, practical or stylistic appeal when
supported by the supplied information.

5. AUDIENCE FIT

Make the copy relevant to the supplied audience.

6. PURCHASE MOTIVATION

Explain legitimate reasons the shopper would consider buying it.

7. PURCHASE-ORIENTED CLOSE

Finish naturally with language that encourages consideration.

Do NOT use:

- fake urgency
- fake scarcity
- fake guarantees
- unsupported claims

Avoid generic AI filler such as:

"elevate your lifestyle"
"ultimate choice"
"perfect for everyone"
"designed to impress"
"unparalleled quality"
"must-have"
"game changer"

unless the supplied facts genuinely support the statement.

Write like a strong ecommerce brand.

Do NOT write like an AI report.

==================================================
FEATURES — BENEFIT FOCUSED
==================================================

Features should communicate buyer value.

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

SEO must support both search visibility and conversion.

SEO title:

Maximum 60 characters.

Meta description:

Maximum 160 characters.

Meta description should:

- identify the product
- communicate a benefit
- match the audience
- encourage qualified shoppers to click

Do not keyword stuff.

==================================================
TAGS
==================================================

Use relevant ecommerce search/catalog terms.

Tags may include:

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

Do NOT heavily punish conversion because the original description
was empty.

Do NOT automatically give a low conversion score because optional
information was missing.

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

SCORING:

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

Overall represents the quality of the FINAL optimized listing.

A strong optimized listing should receive a strong overall score.

==================================================
ANALYSIS
==================================================

targetCustomer:

Describe the actual target shopper based on audience and product.

purchaseMotivation:

Explain the strongest legitimate reasons the shopper would want it.

strongestFeatures:

List the strongest supported selling points.

weaknesses:

Identify genuine weaknesses.

missingInformation:

List information that could improve buyer confidence.

seoOpportunities:

List useful search opportunities.

conversionOpportunities:

List practical improvements that could increase purchase confidence
and buying appeal.

==================================================
REASONING
==================================================

Briefly explain important optimization decisions.

Never mention Shopify unless Shopify is explicitly present in the
supplied product information.

Return ONLY valid JSON matching the schema.
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
      "gpt-5.4";

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

      console.error(
        "OpenAI API error:",
        errorMessage
      );

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
      cleanText(
        responseData?.output_text
      );

    if (
      !outputText &&
      Array.isArray(
        responseData?.output
      )
    ) {
      const parts: string[] = [];

      for (
        const item of responseData.output
      ) {
        if (
          !Array.isArray(
            item?.content
          )
        ) {
          continue;
        }

        for (
          const part of item.content
        ) {
          if (
            typeof part?.text ===
            "string"
          ) {
            parts.push(
              part.text
            );
          }
        }
      }

      outputText =
        parts
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

    let parsedResult: unknown;

    try {
      parsedResult =
        JSON.parse(
          outputText
        );
    } catch {
      return NextResponse.json(
        {
          error:
            "The AI returned invalid JSON.",
        },
        {
          status: 502,
        }
      );
    }

    const result =
      normalizeResult(
        parsedResult
      );

    /*
     * Safety fallbacks.
     * The UI should never receive an empty optimized listing.
     */

    if (
      !result.optimization.title
    ) {
      result.optimization.title =
        product.title;
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
      !result.optimization.description
    ) {
      result.optimization.description =
        `Discover the ${product.title}, with a clear focus on its strongest supported features, practical benefits and appeal to the intended shopper.`;
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
     * STRICT AUDIENCE PROTECTION
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

      result.analysis.purchaseMotivation =
        result.analysis.purchaseMotivation
          .replace(
            /\bunisex\b/gi,
            "men's"
          );

      result.optimization.description =
        result.optimization.description
          .replace(
            /\bunisex\b/gi,
            "men's"
          );

      result.optimization.features =
        result.optimization.features.map(
          (feature) =>
            feature.replace(
              /\bunisex\b/gi,
              "men's"
            )
        );

      result.optimization.title =
        result.optimization.title
          .replace(
            /\bunisex\b/gi,
            "Men's"
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

      result.analysis.purchaseMotivation =
        result.analysis.purchaseMotivation
          .replace(
            /\bunisex\b/gi,
            "women's"
          );

      result.optimization.description =
        result.optimization.description
          .replace(
            /\bunisex\b/gi,
            "women's"
          );

      result.optimization.features =
        result.optimization.features.map(
          (feature) =>
            feature.replace(
              /\bunisex\b/gi,
              "women's"
            )
        );

      result.optimization.title =
        result.optimization.title
          .replace(
            /\bunisex\b/gi,
            "Women's"
          );
    }

    /*
     * HIGH-CONVERSION SCORE FLOOR
     */

    const strongDescription =
      result.optimization.description.length >=
      120;

    const strongFeatures =
      result.optimization.features.length >=
      2;

    const strongMotivation =
      result.analysis.purchaseMotivation.length >=
      30;

    const strongAudience =
      result.analysis.targetCustomer.length >=
      15;

    if (
      strongDescription &&
      strongFeatures &&
      strongMotivation &&
      strongAudience
    ) {
      result.score.conversionPotential =
        Math.max(
          result.score.conversionPotential,
          85
        );
    }

    /*
     * Recalculate overall score from the
     * final optimized listing.
     */

    result.score.overall =
      Math.round(
        (
          result.score.title +
          result.score.description +
          result.score.seo +
          result.score.productClarity +
          result.score.conversionPotential
        ) / 5
      );

    /*
     * ============================================================
     * SUCCESS RESPONSE
     * ============================================================
     *
     * Refresh the signed subscriber cookie using
     * the latest verified subscription and usage state.
     */

    const response =
      NextResponse.json(
        {
          success: true,
          audience,
          result,
          usage:
            subscriberAuthorization.usage,
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );

    setSubscriberCookie(
      response,
      subscriberAuthorization.cookieValue
    );

    return response;
  } catch (error) {
    console.error(
      "Virello AI analysis error:",
      error
    );

    const possibleError =
      error as {
        status?: unknown;
        message?: unknown;
      };

    const status =
      typeof possibleError.status ===
      "number"
        ? possibleError.status
        : 500;

    const message =
      typeof possibleError.message ===
      "string"
        ? possibleError.message
        : "Unexpected server error.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}