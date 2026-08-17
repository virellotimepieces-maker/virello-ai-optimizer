import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Virello AI, an expert ecommerce product optimization analyst.

Analyze the actual product information before making recommendations.

Your responsibilities:
- Understand the product.
- Identify the ideal target customer.
- Identify purchase motivations.
- Identify the strongest product benefits.
- Identify weaknesses that can reduce conversion.
- Identify SEO opportunities.
- Identify conversion opportunities.
- Create a professional ecommerce product title.
- Create a conversion-focused product description.
- Organize verified features and specifications.
- Create an SEO title of 50 characters or fewer.
- Create a meta description of 150 characters or fewer.
- Recommend relevant product tags.

STRICT RULES:
- Never invent product specifications.
- Never invent materials, dimensions, certifications, warranty,
  compatibility, performance claims, or features.
- Do not make unsupported medical, safety, or technical claims.
- Do not copy generic supplier wording.
- Do not keyword stuff.
- Do not make the product sound like a generic marketplace listing.
- Keep the writing natural, premium, persuasive, and conversion-focused.
- Preserve factual information supplied by the store.
- If important information is missing, report it instead of guessing.

Return ONLY valid JSON matching the requested schema.
`;

type ProductInput = {
  id?: string;
  title?: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
  features?: string[];
  specifications?: string[];
};

function clean(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\s+/g, " ")
    .trim();
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => clean(item))
    .filter(Boolean)
    .slice(0, 30);
}

function enforceLimit(value: unknown, max: number): string {
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

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY is not configured.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    const product = (body?.product ?? body) as ProductInput;

    if (!product || !clean(product.title)) {
      return NextResponse.json(
        {
          success: false,
          error: "A product title is required.",
        },
        { status: 400 },
      );
    }

    const productData = {
      id: clean(product.id),
      title: clean(product.title),
      description: clean(product.description),
      productType: clean(product.productType),
      vendor: clean(product.vendor),
      tags: cleanList(product.tags),
      price: clean(product.price),
      features: cleanList(product.features),
      specifications: cleanList(product.specifications),
    };

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model: process.env.VIRELLO_AI_MODEL || "gpt-5.6",

          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: SYSTEM_PROMPT,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(productData),
                },
              ],
            },
          ],

          text: {
            format: {
              type: "json_schema",

              name: "virello_product_analysis",

              strict: true,

              schema: {
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
              },
            },
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);

      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.message ||
            "Virello AI analysis failed.",
        },
        { status: response.status },
      );
    }

    const outputText =
      typeof data?.output_text === "string"
        ? data.output_text
        : "";

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,
          error: "Virello AI returned no analysis.",
        },
        { status: 502 },
      );
    }

    let result: any;

    try {
      result = JSON.parse(outputText);
    } catch (error) {
      console.error(
        "Invalid Virello AI JSON:",
        outputText,
        error,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Virello AI returned an invalid response.",
        },
        { status: 502 },
      );
    }

    if (result?.optimization) {
      result.optimization.seoTitle =
        enforceLimit(
          result.optimization.seoTitle,
          50,
        );

      result.optimization.metaDescription =
        enforceLimit(
          result.optimization.metaDescription,
          150,
        );

      result.optimization.title =
        clean(result.optimization.title);

      result.optimization.description =
        clean(result.optimization.description);

      result.optimization.features =
        cleanList(result.optimization.features);

      result.optimization.specifications =
        cleanList(
          result.optimization.specifications,
        );

      result.optimization.tags =
        cleanList(result.optimization.tags);
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "Virello AI unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Unexpected server error while analyzing the product.",
      },
      { status: 500 },
    );
  }
}
