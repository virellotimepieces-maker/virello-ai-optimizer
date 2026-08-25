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

function clampScore(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function limitCharacters(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/**
 * Detect audience from the actual product information.
 *
 * Explicit audience from Connect is always preferred.
 * This fallback is used only when audience was not supplied.
 */
function inferAudience(product: ProductInput): Audience {
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
   * Check explicit men's wording first.
   */
  if (
    /\b(men's|mens|men|man's|mans|man|male|gentlemen|gentleman)\b/.test(
      text
    )
  ) {
    return "Men";
  }

  /*
   * Check explicit women's wording.
   */
  if (
    /\b(women's|womens|women|woman's|womans|woman|female|ladies|lady)\b/.test(
      text
    )
  ) {
    return "Women";
  }

  /*
   * Only use Unisex when the product actually says
   * unisex / gender-neutral or no gender can be determined.
   */
  if (/\b(unisex|gender[- ]?neutral)\b/.test(text)) {
    return "Unisex";
  }

  return "Unisex";
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
      title: clampScore(score.title),
      description: clampScore(score.description),
      seo: clampScore(score.seo),
      productClarity: clampScore(score.productClarity),
      conversionPotential: clampScore(score.conversionPotential),
      overall: clampScore(score.overall),
    },

    optimization: {
      title: cleanText(optimization.title),
      productType: cleanText(optimization.productType),
      description: cleanText(optimization.description),
      features: cleanArray(optimization.features),
      specifications: cleanArray(optimization.specifications),

      seoTitle: limitCharacters(
        cleanText(optimization.seoTitle),
        60
      ),

      metaDescription: limitCharacters(
        cleanText(optimization.metaDescription),
        160
      ),

      tags: cleanArray(optimization.tags),
    },

    reasoning: cleanText(data.reasoning),
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

function parseModelOutput(text: string): unknown {
  const cleaned = text.trim();

  if (!cleaned) {
    throw new Error("The AI returned an empty response.");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    /*
     * Fallback if the model wraps JSON in markdown.
     */
    const withoutFence = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      return JSON.parse(withoutFence);
    } catch {
      throw new Error(
        "The AI returned invalid structured data."
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not configured in the server environment.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const product: ProductInput =
      body?.product &&
      typeof body.product === "object"
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
          error:
            "Product title is required for AI optimization.",
        },
        { status: 400 }
      );
    }

    /*
     * IMPORTANT:
     *
     * If the connected ecommerce platform sends an
     * explicit audience, that value wins.
     *
     * Otherwise Virello determines it from the
     * product title/details.
     */
    const audience: Audience =
      product.audience ??
      inferAudience(product);

    const productPayload = {
      id: cleanText(product.id),

      title,

      description: cleanText(
        product.description
      ),

      productType: cleanText(
        product.productType
      ),

      vendor: cleanText(
        product.vendor
      ),

      tags: cleanArray(
        product.tags
      ),

      price: cleanText(
        product.price
      ),

      audience,

      style:
        product.style ??
        "Everyday",

      variants: Array.isArray(
        product.variants
      )
        ? product.variants
        : [],

      images: Array.isArray(
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

Virello is a PLATFORM-INDEPENDENT ecommerce
product optimization application.

It can be used with different ecommerce
stores, ecommerce platforms, marketplaces,
catalog systems and dropshipping businesses.

Do NOT assume the product is from Shopify.

Your job is to transform raw product information
into high-quality ecommerce listing content.

PRIMARY GOALS:

1. Increase product clarity.
2. Improve search relevance.
3. Improve buyer confidence.
4. Improve purchase motivation.
5. Improve conversion potential.
6. Produce ready-to-use ecommerce copy.

AUDIENCE RULES:

The supplied audience is authoritative.

If audience = "Men":
- The target customer must be men.
- The optimized listing must be men's positioning.
- Do NOT describe the product as unisex.
- Do NOT output "unisex" as the target audience.

If audience = "Women":
- The target customer must be women.
- The optimized listing must be women's positioning.
- Do NOT describe the product as unisex.

If audience = "Unisex":
- Keep the product gender-neutral.

IMPORTANT:
Never change Men's into Unisex.
Never change Women's into Unisex.
Never ignore an explicit audience.

PRODUCT INFORMATION RULES:

Use supplied information as the source of truth.

Do not invent:
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

If technical information is missing,
say that it is missing instead of inventing it.

DESCRIPTION RULES:

The optimized description must NOT be empty.

Write a useful ecommerce description even
when the original description is empty.

Use only facts supported by the product title,
product information and safe general positioning.

Do not use exaggerated claims such as:
"best in the world"
"guaranteed"
"number one"
"premium quality"
unless the supplied information actually supports them.

CONVERSION RULES:

The conversion score must evaluate the QUALITY
OF THE OPTIMIZED LISTING, not simply punish the
product because the original seller forgot to
provide optional fields.

A missing original description should NOT
automatically force conversion to a very low score.

Judge conversion using:
- clarity
- relevance
- purchase motivation
- benefit communication
- audience fit
- feature communication
- trustworthiness
- search intent
- usefulness of the final description

If the optimized listing is strong based on
the available information, its conversion score
can be strong.

Do not artificially give a low conversion score
just because price, variants or images were not
provided.

SCORING:

Return scores from 0 to 100.

Title:
- clarity
- keyword relevance
- specificity
- readability

Description:
- usefulness
- clarity
- benefits
- natural language

SEO:
- search intent
- keyword relevance
- natural placement
- title/meta quality

Product clarity:
- buyer understanding
- product type
- audience
- key attributes

Conversion:
- purchase motivation
- benefit clarity
- audience fit
- trust
- persuasive quality
- usefulness of the final listing

Overall should represent the quality of the
optimized listing, not simply the quality of the
original input.

TITLE RULES:

Create a natural ecommerce product title.

Avoid keyword stuffing.

Keep titles concise.

Do not unnecessarily repeat the same keyword.

Preserve important model numbers when supplied.

SEO TITLE:
Create a concise search-friendly title.
Maximum 60 characters.

META DESCRIPTION:
Create a natural search-friendly meta description.
Maximum 160 characters.

TAGS:
Return useful search/catalog tags.
Do not stuff irrelevant keywords.

FEATURES:
Return concise bullet-style feature statements.

SPECIFICATIONS:
Only include specifications that are actually
supported by supplied information.

ANALYSIS:

Target customer:
Describe the actual likely buyer.

Purchase motivation:
Explain why that buyer would want the product.

Strongest features:
List the strongest supported selling points.

Weaknesses:
Identify real listing weaknesses.

Missing information:
List information that would improve the listing.

SEO opportunities:
Give useful search opportunities.

Conversion opportunities:
Give practical improvements that can increase
purchase confidence.

REASONING:
Briefly explain the main optimization decisions.

Remember:
Virello is not Shopify-only.
Do not mention Shopify unless Shopify was explicitly
included in the supplied product information.
`;

    const userPrompt = `
Optimize this ecommerce product.

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

    const openAIResponse = await fetch(
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
                  type: "input_text",
                  text: systemPrompt,
                },
              ],
            },

            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: userPrompt,
                },
              ],
            },
          ],

          text: {
            format: {
              type: "json_schema",

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

    if (!openAIResponse.ok) {
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
          error: errorMessage,
        },
        {
          status:
            openAIResponse.status >= 400
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

    /*
     * Responses API normally exposes the
     * generated text as output_text.
     */
    let outputText =
      typeof responseData?.output_text ===
      "string"
        ? responseData.output_text.trim()
        : "";

    /*
     * Fallback parser for response objects.
     */
    if (!outputText) {
      const output =
        Array.isArray(
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

        const content =
          Array.isArray(
            item.content
          )
            ? item.content
            : [];

        for (const part of content) {
          if (
            part &&
            typeof part === "object" &&
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

    /*
     * Safety fallback:
     * Never allow the UI to display an empty
     * optimized description.
     */
    if (
      !result.optimization.description
    ) {
      result.optimization.description =
        `Discover the ${title}, designed with a clear focus on its key features and everyday use.`;
    }

    /*
     * Safety fallback for product type.
     */
    if (
      !result.optimization.productType
    ) {
      result.optimization.productType =
        cleanText(
          product.productType
        ) ||
        "Product";
    }

    /*
     * Safety fallback for title.
     */
    if (
      !result.optimization.title
    ) {
      result.optimization.title =
        title;
    }

    /*
     * Safety fallback for SEO title.
     */
    if (
      !result.optimization.seoTitle
    ) {
      result.optimization.seoTitle =
        limitCharacters(
          result.optimization.title,
          60
        );
    }

    /*
     * Safety fallback for meta description.
     */
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
     * Make sure the final audience analysis
     * follows the actual supplied audience.
     */
    if (
      audience === "Men" &&
      result.analysis.targetCustomer
        .toLowerCase()
        .includes("unisex")
    ) {
      result.analysis.targetCustomer =
        "Men seeking this type of product based on the supplied product information.";
    }

    if (
      audience === "Women" &&
      result.analysis.targetCustomer
        .toLowerCase()
        .includes("unisex")
    ) {
      result.analysis.targetCustomer =
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
  } catch (error) {
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
