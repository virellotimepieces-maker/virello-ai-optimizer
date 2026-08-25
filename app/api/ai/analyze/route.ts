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

function limitCharacters(
  value: string,
  max: number
): string {
  return value.trim().slice(0, max);
}

/**
 * Determines the intended audience from the supplied
 * product information when Connect does not explicitly
 * provide an audience.
 *
 * Explicit gender words are checked before Unisex.
 */
function inferAudience(
  product: ProductInput
): Audience {
  const text = [
    product.title,
    product.description,
    product.productType,
    product.vendor,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  /*
   * Explicit unisex wording takes priority.
   */
  if (
    /\b(unisex|gender[- ]?neutral)\b/.test(
      text
    )
  ) {
    return "Unisex";
  }

  /*
   * Men's products.
   */
  if (
    /\b(
      men's|
      mens|
      men|
      man's|
      mans|
      man|
      male|
      gentlemen|
      gentleman
    )\b/x.test(text)
  ) {
    return "Men";
  }

  /*
   * Women's products.
   */
  if (
    /\b(
      women's|
      womens|
      women|
      woman's|
      womans|
      woman|
      female|
      ladies|
      lady
    )\b/x.test(text)
  ) {
    return "Women";
  }

  return "Unisex";
}

/**
 * JavaScript does not support the /x flag used in some
 * regex engines. This helper performs the same matching
 * using normal JavaScript regex.
 */
function inferAudienceSafe(
  product: ProductInput
): Audience {
  const text = [
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
    /\b(unisex|gender[- ]?neutral)\b/.test(
      text
    )
  ) {
    return "Unisex";
  }

  if (
    /\b(men's|mens|men|man's|mans|man|male|gentlemen|gentleman)\b/.test(
      text
    )
  ) {
    return "Men";
  }

  if (
    /\b(women's|womens|women|woman's|womans|woman|female|ladies|lady)\b/.test(
      text
    )
  ) {
    return "Women";
  }

  return "Unisex";
}

function normalizeResult(
  raw: unknown
): AIResult {
  const data =
    raw &&
    typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const analysis =
    data.analysis &&
    typeof data.analysis === "object"
      ? (data.analysis as Record<
          string,
          unknown
        >)
      : {};

  const score =
    data.score &&
    typeof data.score === "object"
      ? (data.score as Record<
          string,
          unknown
        >)
      : {};

  const optimization =
    data.optimization &&
    typeof data.optimization === "object"
      ? (data.optimization as Record<
          string,
          unknown
        >)
      : {};

  const numberValue = (
    value: unknown,
    fallback = 0
  ): number => {
    return typeof value === "number" &&
      Number.isFinite(value)
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(value)
          )
        )
      : fallback;
  };

  return {
    analysis: {
      targetCustomer: cleanText(
        analysis.targetCustomer
      ),

      purchaseMotivation: cleanText(
        analysis.purchaseMotivation
      ),

      strongestFeatures: cleanArray(
        analysis.strongestFeatures
      ),

      weaknesses: cleanArray(
        analysis.weaknesses
      ),

      missingInformation: cleanArray(
        analysis.missingInformation
      ),

      seoOpportunities: cleanArray(
        analysis.seoOpportunities
      ),

      conversionOpportunities:
        cleanArray(
          analysis.conversionOpportunities
        ),
    },

    score: {
      title: numberValue(
        score.title
      ),

      description: numberValue(
        score.description
      ),

      seo: numberValue(
        score.seo
      ),

      productClarity: numberValue(
        score.productClarity
      ),

      conversionPotential:
        numberValue(
          score.conversionPotential
        ),

      overall: numberValue(
        score.overall
      ),
    },

    optimization: {
      title: cleanText(
        optimization.title
      ),

      productType: cleanText(
        optimization.productType
      ),

      description: cleanText(
        optimization.description
      ),

      features: cleanArray(
        optimization.features
      ),

      specifications: cleanArray(
        optimization.specifications
      ),

      seoTitle: limitCharacters(
        cleanText(
          optimization.seoTitle
        ),
        50
      ),

      metaDescription:
        limitCharacters(
          cleanText(
            optimization.metaDescription
          ),
          150
        ),

      tags: cleanArray(
        optimization.tags
      ),
    },

    reasoning: cleanText(
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

function extractResponseText(
  responseData: any
): string {
  if (
    typeof responseData?.output_text ===
      "string" &&
    responseData.output_text.trim()
  ) {
    return responseData.output_text.trim();
  }

  const output = Array.isArray(
    responseData?.output
  )
    ? responseData.output
    : [];

  const parts: string[] = [];

  for (const item of output) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const content = Array.isArray(
      item.content
    )
      ? item.content
      : [];

    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        typeof part.text ===
          "string" &&
        part.text.trim()
      ) {
        parts.push(
          part.text.trim()
        );
      }
    }
  }

  return parts.join("\n").trim();
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
            "OPENAI_API_KEY is not configured. Add it to the server environment variables.",
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
      typeof body.product ===
        "object"
        ? body.product
        : body;

    if (
      !product ||
      typeof product !==
        "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Product information is required.",
        },
        {
          status: 400,
        }
      );
    }

    const title =
      cleanText(
        product.title
      );

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Product title is required for AI analysis.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * IMPORTANT:
     *
     * If Connect explicitly supplies Men or Women,
     * use that value.
     *
     * If Connect does not supply audience,
     * determine it from the product information.
     */
    const detectedAudience: Audience =
      product.audience ??
      inferAudienceSafe(product);

    const productPayload = {
      title,

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

      audience:
        detectedAudience,

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

You are an expert ecommerce conversion,
SEO and product merchandising AI.

Your job is to improve ecommerce product
listings for real online stores.

The application is designed to work with
different ecommerce platforms, stores,
products and niches.

IMPORTANT RULES:

- Use the supplied product information
  as the source of truth.
- Do not invent technical specifications.
- Do not invent materials.
- Do not invent certifications.
- Do not invent dimensions.
- Do not invent guarantees.
- Do not invent warranties.
- Do not invent shipping promises.
- Do not invent performance claims.
- Do not make unsupported claims.
- Write naturally and professionally.
- Optimize for search intent.
- Optimize for purchase conversion.
- Avoid keyword stuffing.
- Avoid repetitive wording.
- Make the product sound trustworthy.
- Never hard-code a particular store.
- Never hard-code a particular brand.
- Never hard-code a particular product category.

AUDIENCE RULES:

The supplied audience is authoritative.

If audience is "Men":
- Write the product specifically for men.
- Treat the product as a men's product.
- Do NOT describe it as unisex.
- Do NOT say "unisex styling".
- Do NOT say "unisex design".
- Do NOT say "for both men and women".
- Do NOT change Men to Unisex.

If audience is "Women":
- Write the product specifically for women.
- Treat the product as a women's product.
- Do NOT describe it as unisex.
- Do NOT say "unisex styling".
- Do NOT say "unisex design".
- Do NOT say "for both men and women".
- Do NOT change Women to Unisex.

If audience is "Unisex":
- Keep the product positioned as unisex.
- Do not force a men's or women's audience.

If audience was inferred from the title,
follow that audience consistently.

SEO LIMITS:

- seoTitle MUST be 50 characters or fewer.
- metaDescription MUST be 150 characters or fewer.
- These limits are strict.

TITLE:

Create a concise, high-converting product title.

Prioritize:
1. Product identity
2. Important differentiator
3. Commercial search intent
4. Audience when relevant

Do not unnecessarily repeat words.

DESCRIPTION:

Write a conversion-focused ecommerce
product description.

Use:
- Strong opening
- Product benefits
- Important features
- Natural persuasion
- Clear customer value

Do not make unsupported claims.

FEATURES:

Return useful customer-facing features
based only on supplied information.

SPECIFICATIONS:

Return only specifications actually
supported by the supplied information.

Do not invent missing specifications.

TAGS:

Generate relevant ecommerce search tags.

Avoid:
- Spammy tags
- Duplicate tags
- Irrelevant tags
- Unsupported claims

AI ANALYSIS:

Explain:
- Target customer
- Purchase motivation
- Strongest features
- Weaknesses
- Missing information
- SEO opportunities
- Conversion opportunities

SCORING:

Score each category from 0 to 100:

title
description
seo
productClarity
conversionPotential
overall

REASONING:

Briefly explain the most important
optimization decisions.

Return only the requested structured data.
`.trim();

    const userPrompt = `
Analyze and optimize this ecommerce product.

PRODUCT DATA:

${JSON.stringify(
  productPayload,
  null,
  2
)}

IMPORTANT:

The audience is:

${detectedAudience}

Follow this audience exactly.

If the audience is Men,
the resulting content must remain men's
content and must not call the product
unisex.

If the audience is Women,
the resulting content must remain women's
content and must not call the product
unisex.

If the audience is Unisex,
keep the product unisex.

Remember:

seoTitle <= 50 characters

metaDescription <= 150 characters

Only use information supported by
the supplied product data.
`.trim();

    const response =
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
            model:
              "gpt-5.6-luna",

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
                type:
                  "json_schema",

                name:
                  "virello_ai_optimization",

                description:
                  "Structured ecommerce product optimization result.",

                strict: true,

                schema:
                  AI_SCHEMA,
              },
            },

            max_output_tokens:
              5000,
          }),
        }
      );

    const responseData =
      await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        JSON.stringify(
          responseData,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          error:
            responseData?.error
              ?.message ||
            "OpenAI API request failed.",
        },
        {
          status:
            response.status ||
            500,
        }
      );
    }

    const outputText =
      extractResponseText(
        responseData
      );

    if (!outputText) {
      console.error(
        "OpenAI returned no readable text:",
        JSON.stringify(
          responseData,
          null,
          2
        )
      );

      return NextResponse.json(
        {
          error:
            responseData
              ?.incomplete_details
              ?.reason ||
            responseData?.error
              ?.message ||
            "The AI returned no readable text output.",
        },
        {
          status: 502,
        }
      );
    }

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(
          outputText
        );
    } catch {
      const cleaned =
        outputText
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

      try {
        parsed =
          JSON.parse(
            cleaned
          );
      } catch (parseError) {
        console.error(
          "Invalid AI JSON:",
          parseError,
          outputText
        );

        return NextResponse.json(
          {
            error:
              "The AI returned an invalid JSON response.",
          },
          {
            status: 502,
          }
        );
      }
    }

    const result =
      normalizeResult(
        parsed
      );

    /*
     * Final safety correction.
     *
     * This prevents the AI from accidentally
     * returning unisex wording for an explicitly
     * identified men's or women's product.
     */
    if (
      detectedAudience ===
      "Men"
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
      detectedAudience ===
      "Women"
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

    return NextResponse.json({
      success: true,

      audience:
        detectedAudience,

      result,
    });
  } catch (error) {
    console.error(
      "Virello AI Optimizer error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while optimizing the product.",
      },
      {
        status: 500,
      }
    );
  }
}
