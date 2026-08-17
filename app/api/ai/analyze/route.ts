import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You are Virello AI, an advanced ecommerce product optimization analyst.

Analyze the ACTUAL Shopify product data supplied by the store. Your job is to make commercially useful decisions from that data, not to fill a template.

Think like an ecommerce conversion specialist, SEO specialist, product merchandiser, Shopify copywriter, and customer-psychology analyst.

FACTUAL ACCURACY IS REQUIRED.

Use only information supported by the supplied product data. You may infer reasonable customer intent or positioning from the supplied facts, but you must never invent product facts.

Never invent or assume materials, dimensions, weight, colors, certifications, warranty, compatibility, battery capacity, voltage, power, performance, durability, waterproofing, water resistance, safety claims, medical claims, health claims, technical specifications, shipping promises, guarantees, included accessories, movement/caliber, crystal type, case size, strap material, clasp, packaging, or other specifications that were not supplied.

If important information is absent, put it in missingInformation instead of guessing.

BRAND / VENDOR ACCURACY:
If the product title contains a brand or designer name but the vendor field conflicts with it or does not confirm the relationship, do not present the brand relationship as verified. Flag the ambiguity in weaknesses or missingInformation when relevant.

PRODUCT TITLE:
- Clearly identify the actual product.
- Use useful search terms naturally.
- Sound professional and premium for Shopify.
- Be specific to the product.
- Avoid keyword stuffing, marketplace-style wording, supplier wording, fake brand claims, and unsupported claims.
- Do not blindly reuse the original title.
- Do not force a fixed word count.

DUPLICATE TITLE PREVENTION:
Existing store titles are provided in the user message. The new title must be genuinely different from them. Do not copy, reorder, slightly modify, or reproduce distinctive phrases from an existing title. Do not make a title different merely by adding random adjectives. Choose another accurate way to describe the same product using the supplied facts.

DESCRIPTION:
Write conversion-focused copy that explains what the product is, why the likely customer may want it, verified benefits, practical value, and supported use cases. Keep it natural, specific, easy to scan, and free of supplier filler.

FEATURES:
Only include features supported by the supplied product data.

SPECIFICATIONS:
Only include specifications actually supplied. If none are supplied, return an empty array. Never manufacture specifications.

SEO TITLE:
Maximum 50 characters. Use the most useful product keyword naturally. Do not simply copy the product title.

META DESCRIPTION:
Maximum 150 characters. Clearly explain the product and give the searcher a reason to click without making unsupported claims.

TAGS:
Create specific Shopify tags from actual product information. No random, duplicate, supplier-spam, or unsupported tags.

SCORING:
Scores must reflect the quality of the supplied listing. Do not give high scores merely because the product sounds attractive. Missing critical information should reduce product clarity and conversion potential.

AI DECISION MAKING:
The result must change meaningfully when the product data changes. Do not use one fixed answer for every product.

Return only JSON matching the supplied schema.
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

type AnalyzeRequest = {
  product?: ProductInput;
  existingProductTitles?: string[];
  existingTitles?: string[];
};

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function cleanList(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const text = clean(item);

    if (!text) continue;

    const key = text.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(text);
  }

  return result.slice(0, max);
}

const TITLE_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "and",
  "with",
  "of",
  "to",
  "in",
  "on",
  "by",
  "from",
  "new",
  "style",
  "design",
  "classic",
  "premium",
  "modern",
  "elegant",
  "fashion",
  "watch",
  "men",
  "women",
  "unisex",
]);

function normalizeTitle(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(value: string): string[] {
  return normalizeTitle(value)
    .split(" ")
    .filter(Boolean)
    .filter((word) => !TITLE_STOP_WORDS.has(word));
}

function titleSimilarity(a: string, b: string): number {
  const aSet = new Set(titleTokens(a));
  const bSet = new Set(titleTokens(b));

  if (!aSet.size || !bSet.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of aSet) {
    if (bSet.has(token)) {
      intersection++;
    }
  }

  const union = new Set([
    ...aSet,
    ...bSet,
  ]).size;

  return union ? intersection / union : 0;
}

function hasDistinctiveOverlap(
  candidate: string,
  existing: string,
): boolean {
  const a = titleTokens(candidate);
  const b = titleTokens(existing);

  if (a.length < 3 || b.length < 3) {
    return false;
  }

  const aSet = new Set(a);
  const bSet = new Set(b);

  let common = 0;

  for (const token of bSet) {
    if (aSet.has(token)) {
      common++;
    }
  }

  const smaller = Math.min(
    aSet.size,
    bSet.size,
  );

  return (
    smaller >= 3 &&
    common / smaller >= 0.75
  );
}

function findSimilarTitle(
  candidate: string,
  existingTitles: string[],
) {
  const normalizedCandidate =
    normalizeTitle(candidate);

  let highestSimilarity = 0;
  let matchedTitle = "";

  if (!normalizedCandidate) {
    return {
      duplicate: false,
      matchedTitle,
      similarity: 0,
    };
  }

  for (const existing of existingTitles) {
    const normalizedExisting =
      normalizeTitle(existing);

    if (!normalizedExisting) {
      continue;
    }

    if (
      normalizedCandidate ===
      normalizedExisting
    ) {
      return {
        duplicate: true,
        matchedTitle: existing,
        similarity: 1,
      };
    }

    const similarity =
      titleSimilarity(
        candidate,
        existing,
      );

    if (
      similarity >
      highestSimilarity
    ) {
      highestSimilarity =
        similarity;

      matchedTitle =
        existing;
    }

    if (
      similarity >= 0.78 ||
      hasDistinctiveOverlap(
        candidate,
        existing,
      )
    ) {
      return {
        duplicate: true,
        matchedTitle: existing,
        similarity,
      };
    }
  }

  return {
    duplicate: false,
    matchedTitle,
    similarity:
      highestSimilarity,
  };
}

function enforceLimit(
  value: unknown,
  max: number,
): string {
  const text = clean(value);

  if (!text || text.length <= max) {
    return text;
  }

  let result =
    text.slice(0, max);

  const lastSpace =
    result.lastIndexOf(" ");

  if (
    lastSpace >
    Math.floor(max * 0.65)
  ) {
    result =
      result.slice(
        0,
        lastSpace,
      );
  }

  return result
    .trim()
    .replace(
      /[.,;:!?-]+$/,
      "",
    );
}

function removeDuplicateStrings(
  value: unknown,
  max = 30,
): string[] {
  return cleanList(
    value,
    max,
  );
}

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

  const output =
    Array.isArray(data?.output)
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

  for (
    const key of [
      "title",
      "description",
      "seo",
      "productClarity",
      "conversionPotential",
      "overall",
    ]
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
              Math.round(
                value,
              ),
            ),
          )
        : 0;
  }

  result.optimization.title =
    enforceLimit(
      result.optimization
        .title,
      90,
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

  result.optimization.tags =
    removeDuplicateStrings(
      result.optimization.tags,
      20,
    );

  result.reasoning =
    clean(
      result.reasoning,
    );

  return result;
}

const RESPONSE_SCHEMA = {
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
};

async function callOpenAI(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<any> {
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
                "virello_product_analysis",

              strict: true,

              schema:
                RESPONSE_SCHEMA,
            },
          },
        }),
      },
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
      ),
    );
  }

  const outputText =
    extractOutputText(
      data,
    );

  if (!outputText) {
    const refusal =
      clean(
        data?.output
          ?.flatMap?.(
            (
              item: any,
            ) =>
              item?.content ??
              [],
          )
          ?.find?.(
            (
              item: any,
            ) =>
              item?.type ===
              "refusal",
          )
          ?.refusal,
      );

    throw new Error(
      refusal ||
        "Virello AI returned no readable analysis output.",
    );
  }

  try {
    return JSON.parse(
      outputText,
    );
  } catch {
    throw new Error(
      "Virello AI returned an invalid structured response.",
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
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

    let body: AnalyzeRequest;

    try {
      body =
        (await request.json()) as AnalyzeRequest;
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

    const existingTitles =
      cleanList(
        body?.existingProductTitles ??
          body?.existingTitles ??
          [],
        500,
      ).filter(
        (title) =>
          normalizeTitle(
            title,
          ) !==
          normalizeTitle(
            product.title ??
              "",
          ),
      );

    const productData = {
      id: clean(
        product.id,
      ),

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

    const model =
      process.env.VIRELLO_AI_MODEL ||
      "gpt-5.6";

    const existingTitlesContext =
      existingTitles.length
        ? `
EXISTING STORE PRODUCT TITLES:

${existingTitles
  .map(
    (
      title,
      index,
    ) =>
      `${index + 1}. ${title}`,
  )
  .join("\n")}
`
        : `
No existing title list was supplied.

Still create a product-specific title.
`;

    const basePrompt = `
Analyze this Shopify product using ONLY the supplied information.

CURRENT PRODUCT DATA:

${JSON.stringify(
  productData,
  null,
  2,
)}

${existingTitlesContext}

IMPORTANT:

- Do not invent missing specifications.
- Treat the vendor field and product title as separate pieces of evidence.
- If a brand/product-name relationship is unclear, say so instead of pretending it is verified.
- Create a genuinely useful, premium, product-specific title.
- The Product Title must not be an exact or near duplicate of an existing store title.
- The description should be persuasive but factual.
- Return empty specifications when no specifications were supplied.
- SEO title must be 50 characters or fewer.
- Meta description must be 150 characters or fewer.
`;

    let result =
      normalizeResult(
        await callOpenAI(
          apiKey,
          model,
          basePrompt,
        ),
      );

    let duplicateCheck =
      findSimilarTitle(
        result.optimization
          .title,
        existingTitles,
      );

    /*
     * If the AI generated a title too similar
     * to an existing store title, ask the AI
     * to generate a genuinely different one.
     */

    if (
      duplicateCheck.duplicate &&
      existingTitles.length > 0
    ) {
      const repairPrompt = `
${basePrompt}

TITLE REPAIR REQUIRED:

The previous AI-generated title was:

"${result.optimization.title}"

It was rejected because it is too similar to this existing store title:

"${duplicateCheck.matchedTitle}"

Generate a DIFFERENT title for the same product.

Do NOT merely:
- add an adjective
- remove one word
- reorder words
- replace one insignificant word

Use another accurate product-specific phrasing based ONLY on the supplied product data.

Keep the product factual and commercially useful.

All other optimization decisions must remain factual.
`;

      result =
        normalizeResult(
          await callOpenAI(
            apiKey,
            model,
            repairPrompt,
          ),
        );

      duplicateCheck =
        findSimilarTitle(
          result.optimization
            .title,
          existingTitles,
        );
    }

    if (
      duplicateCheck.duplicate &&
      existingTitles.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI could not create a sufficiently unique product title. Please analyze again.",

          meta: {
            aiGenerated: true,

            duplicateProtection:
              true,

            matchedTitle:
              duplicateCheck.matchedTitle,
          },
        },

        {
          status: 422,
        },
      );
    }

    result.optimization.title =
      enforceLimit(
        result.optimization
          .title,
        90,
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

    return NextResponse.json({
      success: true,

      result,

      meta: {
        model,

        aiGenerated: true,

        duplicateProtection:
          existingTitles.length >
          0,

        existingTitlesChecked:
          existingTitles.length,

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
