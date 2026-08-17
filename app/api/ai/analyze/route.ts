import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Virello AI, an advanced ecommerce product optimization analyst.

Analyze the ACTUAL Shopify product data supplied by the store and generate a better ecommerce presentation based only on verified information.

Think like an ecommerce conversion specialist, SEO specialist, product merchandising specialist, Shopify copywriter, and customer psychology analyst.

CORE OBJECTIVES
1. Understand what the product actually is.
2. Determine the most likely target customer.
3. Identify legitimate purchase motivations.
4. Identify verified benefits.
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
15. Create relevant Shopify product tags.

FACTUAL ACCURACY
Never invent materials, dimensions, weight, colors, certifications, warranty, compatibility, battery capacity, voltage, power, performance, durability, waterproof ratings, safety claims, medical claims, health claims, technical specifications, shipping claims, guarantees, or included accessories.

If information is missing, do not guess. Put important missing information in missingInformation.

TITLE
Create a natural, professional ecommerce product title. Clearly identify the product, use important search keywords naturally, avoid keyword stuffing, excessive adjectives, generic marketplace wording, repeated words, fake brand names, and unsupported supplier claims.

Do not force a fixed number of words.

Make it suitable for a premium Shopify store.

DESCRIPTION
Create conversion-focused product copy.

Explain:
- what the product is
- why the customer would want it
- the verified benefits
- the practical value
- the best use cases when supported by the supplied information

Use natural persuasive language.

Make it easy to scan.

Avoid generic supplier language.

Avoid unsupported claims.

Sound like a professional ecommerce brand.

FEATURES
Only include features that can be verified from the supplied product data.

Do not assume features simply because they are common for this product category.

SPECIFICATIONS
Only include specifications supplied in the product data.

If none are supplied, return an empty array.

SEO TITLE
Maximum 50 characters.

Include the most useful product keyword naturally.

Avoid keyword stuffing.

META DESCRIPTION
Maximum 150 characters.

Explain the product clearly.

Include a useful keyword naturally.

Give the searcher a reason to click without unsupported claims.

TAGS
Create relevant, specific Shopify tags based on actual product information.

Do not create random, duplicate, or unsupported tags.

DUPLICATE PREVENTION
Do not blindly reuse the original title.

Do not repeat identical features, specifications, tags, or near-identical phrases simply to increase the number of results.

The AI must make decisions dynamically from the supplied product data.

Do not use a fixed template that produces the same answer for every product.

Return only valid JSON matching the supplied schema.
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
  const seen = new Set<string>();

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

  return result.slice(0, 30);
}

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
    .trim()
    .replace(/[.,;:!?-]+$/, "");
}

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

    const key =
      cleaned.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

/* =========================================================
   OPENAI OUTPUT EXTRACTION

   This is the important fix for:

   "Virello AI returned no analysis."

   OpenAI Responses API can return generated text inside
   output[].content[].text.

   We check both output_text and output[].content[].
========================================================= */

function extractOutputText(
  data: any,
): string {
  if (
    typeof data?.output_text ===
      "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const output = Array.isArray(
    data?.output,
  )
    ? data.output
    : [];

  const chunks: string[] = [];

  for (const item of output) {
    if (
      !Array.isArray(
        item?.content,
      )
    ) {
      continue;
    }

    for (const content of item.content) {
      if (
        typeof content?.text ===
          "string" &&
        (
          content?.type ===
            "output_text" ||
          !content?.type
        )
      ) {
        chunks.push(
          content.text,
        );
      }
    }
  }

  return chunks
    .join("\n")
    .trim();
}

/* =========================================================
   OPENAI ERROR
========================================================= */

function getErrorMessage(
  data: any,
): string {
  return (
    clean(
      data?.error?.message,
    ) ||
    clean(data?.message) ||
    "Virello AI analysis failed."
  );
}

/* =========================================================
   NORMALIZE AI RESULT
========================================================= */

function normalizeResult(
  result: any,
) {
  if (
    !result ||
    typeof result !==
      "object"
  ) {
    throw new Error(
      "Virello AI returned an invalid analysis object.",
    );
  }

  if (
    !result.analysis ||
    !result.score ||
    !result.optimization
  ) {
    throw new Error(
      "Virello AI returned an incomplete analysis.",
    );
  }

  /* -------------------------
     ANALYSIS
  ------------------------- */

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
    removeDuplicateStrings(
      result.analysis
        .strongestFeatures,
    );

  result.analysis.weaknesses =
    removeDuplicateStrings(
      result.analysis
        .weaknesses,
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

  /* -------------------------
     SCORES
  ------------------------- */

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
    const numberValue =
      Number(
        result.score[key],
      );

    result.score[key] =
      Number.isFinite(
        numberValue,
      )
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                numberValue,
              ),
            ),
          )
        : 0;
  }

  /* -------------------------
     OPTIMIZATION
  ------------------------- */

  result.optimization.title =
    clean(
      result.optimization
        .title,
    );

  result.optimization.description =
    clean(
      result.optimization
        .description,
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
      result.optimization
        .tags,
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

  result.reasoning =
    clean(
      result.reasoning,
    );

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

    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    const product =
      (body?.product ??
        body) as ProductInput;

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
       PRODUCT DATA
    ===================================================== */

    const productData = {
      id: clean(product.id),

      title: clean(
        product.title,
      ),

      description: clean(
        product.description,
      ),

      productType: clean(
        product.productType,
      ),

      vendor: clean(
        product.vendor,
      ),

      tags: cleanList(
        product.tags,
      ),

      price: clean(
        product.price,
      ),

      features: cleanList(
        product.features,
      ),

      specifications:
        cleanList(
          product.specifications,
        ),
    };

    /* =====================================================
       MODEL
    ===================================================== */

    const model =
      process.env.VIRELLO_AI_MODEL ||
      "gpt-5.6";

    /* =====================================================
       OPENAI REQUEST
    ===================================================== */

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
            model,

            input: [
              {
                role: "system",

                content: [
                  {
                    type:
                      "input_text",

                    text:
                      SYSTEM_PROMPT,
                  },
                ],
              },

              {
                role: "user",

                content: [
                  {
                    type:
                      "input_text",

                    text: `
Analyze this Shopify product using only the supplied information.

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

            /* =============================================
               STRUCTURED OUTPUT
            ============================================= */

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "virello_product_analysis",

                strict: true,

                schema: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    analysis: {
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        targetCustomer:
                          {
                            type:
                              "string",
                          },

                        purchaseMotivation:
                          {
                            type:
                              "string",
                          },

                        strongestFeatures:
                          {
                            type:
                              "array",

                            items: {
                              type:
                                "string",
                            },
                          },

                        weaknesses:
                          {
                            type:
                              "array",

                            items: {
                              type:
                                "string",
                            },
                          },

                        missingInformation:
                          {
                            type:
                              "array",

                            items: {
                              type:
                                "string",
                            },
                          },

                        seoOpportunities:
                          {
                            type:
                              "array",

                            items: {
                              type:
                                "string",
                            },
                          },

                        conversionOpportunities:
                          {
                            type:
                              "array",

                            items: {
                              type:
                                "string",
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
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        title: {
                          type:
                            "integer",
                          minimum: 0,
                          maximum: 100,
                        },

                        description: {
                          type:
                            "integer",
                          minimum: 0,
                          maximum: 100,
                        },

                        seo: {
                          type:
                            "integer",
                          minimum: 0,
                          maximum: 100,
                        },

                        productClarity:
                          {
                            type:
                              "integer",
                            minimum: 0,
                            maximum: 100,
                          },

                        conversionPotential:
                          {
                            type:
                              "integer",
                            minimum: 0,
                            maximum: 100,
                          },

                        overall: {
                          type:
                            "integer",
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
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        title: {
                          type:
                            "string",
                        },

                        description: {
                          type:
                            "string",
                        },

                        features: {
                          type:
                            "array",

                          items: {
                            type:
                              "string",
                          },
                        },

                        specifications: {
                          type:
                            "array",

                          items: {
                            type:
                              "string",
                          },
                        },

                        seoTitle: {
                          type:
                            "string",
                        },

                        metaDescription:
                          {
                            type:
                              "string",
                          },

                        tags: {
                          type:
                            "array",

                          items: {
                            type:
                              "string",
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
                      type:
                        "string",
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
       READ OPENAI RESPONSE
    ===================================================== */

    const data =
      await response.json();

    /* =====================================================
       OPENAI ERROR
    ===================================================== */

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        data,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            getErrorMessage(
              data,
            ),
        },
        {
          status:
            response.status,
        },
      );
    }

    /* =====================================================
       EXTRACT AI TEXT

       THIS FIXES:
       "Virello AI returned no analysis."
    ===================================================== */

    const outputText =
      extractOutputText(
        data,
      );

    if (!outputText) {
      console.error(
        "OpenAI returned no readable output:",
        data,
      );

      const refusal =
        clean(
          data?.output?.[0]?.content?.find(
            (item: any) =>
              item?.type ===
              "refusal",
          )?.refusal,
        );

      return NextResponse.json(
        {
          success: false,

          error:
            refusal ||
            "Virello AI returned no readable analysis output.",
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
        JSON.parse(
          outputText,
        );
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
            "Virello AI returned an invalid structured response.",
        },

        {
          status: 502,
        },
      );
    }

    /* =====================================================
       NORMALIZE
    ===================================================== */

    try {
      result =
        normalizeResult(
          result,
        );
    } catch (error) {
      console.error(
        "Virello AI normalization error:",
        error,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            error instanceof
            Error
              ? error.message
              : "Virello AI returned an incomplete analysis.",
        },

        {
          status: 502,
        },
      );
    }

    /* =====================================================
       SUCCESS
    ===================================================== */

    return NextResponse.json({
      success: true,

      result,

      meta: {
        model,

        aiGenerated: true,

        seoTitleMaxLength:
          50,

        metaDescriptionMaxLength:
          150,
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
          error instanceof
          Error
            ? error.message
            : "Unexpected server error while analyzing the product.",
      },

      {
        status: 500,
      },
    );
  }
}
