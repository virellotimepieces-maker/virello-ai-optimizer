import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* =========================================================
   VIRELLO AI SYSTEM PROMPT
========================================================= */

const SYSTEM_PROMPT = `
You are Virello AI, an advanced ecommerce product optimization analyst.

Your job is to analyze the ACTUAL product data supplied by the store and
generate a better ecommerce presentation based only on verified information.

You must think like:
- Ecommerce conversion specialist
- SEO specialist
- Product merchandising specialist
- Shopify product copywriter
- Customer psychology analyst

IMPORTANT:
The product data comes from Shopify and may contain supplier information.
You must analyze it before generating recommendations.

=========================================================
CORE OBJECTIVES
=========================================================

For every product:

1. Understand what the product actually is.
2. Determine the most likely target customer.
3. Identify the strongest legitimate purchase motivations.
4. Identify the strongest verified benefits.
5. Identify weaknesses that may reduce conversions.
6. Identify missing information.
7. Identify SEO opportunities.
8. Identify conversion opportunities.
9. Create a professional ecommerce product title.
10. Create a persuasive product description.
11. Organize verified product features.
12. Organize verified specifications.
13. Create an SEO title of 50 characters or fewer.
14. Create a meta description of 150 characters or fewer.
15. Create relevant product tags.

=========================================================
FACTUAL ACCURACY RULES
=========================================================

NEVER invent:

- Materials
- Dimensions
- Weight
- Colors not supplied
- Certifications
- Warranty
- Compatibility
- Battery capacity
- Voltage
- Power
- Performance
- Durability
- Waterproof ratings
- Safety claims
- Medical claims
- Health claims
- Technical specifications
- Shipping claims
- Guarantees
- Included accessories

If information is not provided, do not guess.

If an important piece of information is missing, place it in
missingInformation.

=========================================================
TITLE RULES
=========================================================

Create a natural, professional ecommerce product title.

The title should:

- Clearly identify the product.
- Use important search keywords naturally.
- Focus on the product rather than supplier wording.
- Avoid unnecessary keyword stuffing.
- Avoid excessive adjectives.
- Avoid generic marketplace-style titles.
- Avoid repeating the same words.
- Avoid fake brand names.
- Avoid supplier names unless they are legitimate product information.
- Be suitable for a premium Shopify store.

Do NOT force a fixed number of words.

The title can be short or longer when necessary.

=========================================================
DESCRIPTION RULES
=========================================================

Create a conversion-focused product description.

The description should:

- Explain what the product is.
- Explain why the customer would want it.
- Highlight verified benefits.
- Use natural persuasive language.
- Be easy to scan.
- Avoid generic supplier language.
- Avoid unsupported claims.
- Avoid exaggerated promises.
- Avoid keyword stuffing.
- Sound like a professional ecommerce brand.

Use the actual product information supplied.

=========================================================
FEATURE RULES
=========================================================

Only include features that can be verified from the supplied product data.

Do not create features simply because they are common for this type
of product.

=========================================================
SPECIFICATION RULES
=========================================================

Specifications must come from the supplied product information.

If specifications are missing, return an empty array.

Never manufacture specifications.

=========================================================
SEO RULES
=========================================================

SEO TITLE:

Maximum 50 characters.

It must:
- Contain the most useful product keyword.
- Read naturally.
- Avoid keyword stuffing.
- Be suitable for Google search results.

META DESCRIPTION:

Maximum 150 characters.

It must:
- Explain the product clearly.
- Include a useful keyword naturally.
- Give the customer a reason to click.
- Avoid keyword stuffing.
- Avoid unsupported claims.

=========================================================
TAG RULES
=========================================================

Create relevant Shopify product tags.

Tags should be:
- Relevant
- Specific
- Useful for organization and search
- Based on actual product information

Do not create random tags.

Do not repeat identical tags.

Do not create unsupported claims as tags.

=========================================================
DUPLICATE PREVENTION
=========================================================

Do NOT blindly reuse the original title as the optimized title.

Do NOT repeat identical features.

Do NOT repeat identical specifications.

Do NOT repeat identical tags.

Do NOT create multiple variations of the same phrase simply to increase
the number of results.

Analyze the product first and then create the best result.

=========================================================
IMPORTANT
=========================================================

The AI must make decisions dynamically from the supplied product data.

Do not use fixed templates that produce the same answer for every product.

Return ONLY valid JSON matching the supplied schema.
`;

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
  features?: string[];
  specifications?: string[];
};

/* =========================================================
   CLEANING HELPERS
========================================================= */

function clean(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim();
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];

  for (const item of value) {
    const cleaned = clean(item);

    if (!cleaned) {
      continue;
    }

    if (!result.includes(cleaned)) {
      result.push(cleaned);
    }
  }

  return result.slice(0, 30);
}

/* =========================================================
   CHARACTER LIMIT
========================================================= */

function enforceLimit(
  value: unknown,
  max: number,
): string {
  const text = clean(value);

  if (!text) {
    return "";
  }

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
   REMOVE DUPLICATES
========================================================= */

function removeDuplicateStrings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const cleaned = clean(item);

    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: Request,
) {
  try {
    /* =====================================================
       API KEY
    ===================================================== */

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY is not configured.",
        },
        {
          status: 500,
        },
      );
    }

    /* =====================================================
       REQUEST BODY
    ===================================================== */

    const body = await request.json();

    const product =
      (body?.product ?? body) as ProductInput;

    if (
      !product ||
      !clean(product.title)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A product title is required.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       NORMALIZE PRODUCT DATA
    ===================================================== */

    const productData = {
      id: clean(product.id),

      title: clean(product.title),

      description:
        clean(product.description),

      productType:
        clean(product.productType),

      vendor:
        clean(product.vendor),

      tags:
        cleanList(product.tags),

      price:
        clean(product.price),

      features:
        cleanList(product.features),

      specifications:
        cleanList(product.specifications),
    };

    /* =====================================================
       OPENAI REQUEST
    ===================================================== */

    const response = await fetch(
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
            process.env.VIRELLO_AI_MODEL ||
            "gpt-5.6",

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

                  text:
                    `
Analyze this Shopify product.

IMPORTANT:
Use only the supplied information.
Do not invent specifications.

PRODUCT DATA:

${JSON.stringify(
  productData,
  null,
  2,
)}
`,
                },
              ],
            },
          ],

          text: {
            format: {
              type: "json_schema",

              name:
                "virello_product_analysis",

              strict: true,

              schema: {
                type: "object",

                additionalProperties:
                  false,

                properties: {
                  analysis: {
                    type: "object",

                    additionalProperties:
                      false,

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

                    additionalProperties:
                      false,

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

                    additionalProperties:
                      false,

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

    /* =====================================================
       OPENAI RESPONSE
    ===================================================== */

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            data?.error?.message ||
            "Virello AI analysis failed.",
        },

        {
          status:
            response.status,
        },
      );
    }

    /* =====================================================
       OUTPUT TEXT
    ===================================================== */

    const outputText =
      typeof data?.output_text ===
      "string"
        ? data.output_text
        : "";

    if (!outputText) {
      console.error(
        "OpenAI returned no output:",
        data,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI returned no analysis.",
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

        {
          status: 502,
        },
      );
    }

    /* =====================================================
       NORMALIZE AI OUTPUT
    ===================================================== */

    if (result?.analysis) {
      result.analysis.strongestFeatures =
        removeDuplicateStrings(
          result.analysis
            .strongestFeatures,
        );

      result.analysis.weaknesses =
        removeDuplicateStrings(
          result.analysis.weaknesses,
        );

      result.analysis.missingInformation =
        removeDuplicateStrings(
          result.analysis
            .missingInformation,
        );

      result.analysis.seoOpportunities =
        removeDuplicateStrings(
          result.analysis
            .seoOpportunities,
        );

      result.analysis.conversionOpportunities =
        removeDuplicateStrings(
          result.analysis
            .conversionOpportunities,
        );
    }

    /* =====================================================
       NORMALIZE OPTIMIZATION
    ===================================================== */

    if (result?.optimization) {
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
        enforceLimit(
          result.optimization
            .seoTitle,
          50,
        );

      result.optimization.metaDescription =
        enforceLimit(
          result.optimization
            .metaDescription,
          150,
        );

      result.optimization.features =
        removeDuplicateStrings(
          result.optimization
            .features,
        );

      result.optimization.specifications =
        removeDuplicateStrings(
          result.optimization
            .specifications,
        );

      result.optimization.tags =
        removeDuplicateStrings(
          result.optimization.tags,
        );
    }

    /* =====================================================
       FINAL RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      result,

      meta: {
        model:
          process.env.VIRELLO_AI_MODEL ||
          "gpt-5.6",

        aiGenerated: true,

        seoTitleMaxLength: 50,

        metaDescriptionMaxLength: 150,
      },
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

      {
        status: 500,
      },
    );
  }
}
