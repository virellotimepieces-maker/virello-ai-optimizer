import { NextResponse } from "next/server";

export const runtime = "nodejs";

/* =========================================================
   VIRELLO AI SYSTEM PROMPT
========================================================= */

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

=========================================================
FACTUAL ACCURACY
=========================================================

Only use information supported by the supplied product data.

Never invent:

- materials
- dimensions
- weight
- colors
- certifications
- warranty
- compatibility
- battery capacity
- voltage
- power
- performance
- durability
- waterproof ratings
- water resistance
- safety claims
- medical claims
- health claims
- technical specifications
- shipping claims
- guarantees
- included accessories
- movement/caliber
- crystal type
- case size
- strap material
- clasp
- packaging

If information is missing, do not guess.

Put important missing information in missingInformation.

=========================================================
PRODUCT TITLE
=========================================================

Create a natural, professional ecommerce product title.

The title must:

- clearly identify the actual product
- use important search terms naturally
- be easy for a shopper to understand
- sound appropriate for a premium Shopify store
- avoid keyword stuffing
- avoid excessive adjectives
- avoid generic marketplace wording
- avoid supplier wording
- avoid fake brand names
- avoid unsupported claims
- avoid unnecessary repetition

Do NOT force a fixed number of words.

Do NOT blindly reuse the original title.

The title should be specific to this product.

=========================================================
DUPLICATE TITLE PREVENTION
=========================================================

The store may contain many products.

The existing store titles supplied with the request are competitors that already exist inside the same store.

The new Product Title MUST NOT:

- exactly duplicate an existing title
- closely copy an existing title
- reorder the same words from an existing title
- change only one insignificant word
- use the same distinctive phrase as an existing title
- create a title that looks like another store product

Avoid near-duplicates.

For example, if an existing title is:

"Pagani Design Retro Chronograph Watch"

do NOT create:

"Pagani Retro Chronograph Watch"

"Pagani Design Chronograph Retro Watch"

"Pagani Design Classic Chronograph Watch"

Instead, create a genuinely differentiated title based on the actual product information.

IMPORTANT:

Do not make the title different merely by adding random adjectives.

The title must remain accurate and commercially useful.

=========================================================
DESCRIPTION
=========================================================

Create conversion-focused product copy.

Explain:

- what the product is
- why the customer would want it
- verified benefits
- practical value
- supported use cases

Use natural persuasive language.

Make it easy to scan.

Avoid generic supplier language.

Avoid unsupported claims.

Sound like a professional ecommerce brand.

=========================================================
FEATURES
=========================================================

Only include features that can be verified from supplied product data.

Do not assume features simply because they are common for the product category.

=========================================================
SPECIFICATIONS
=========================================================

Only include specifications supplied in the product data.

If none are supplied, return an empty array.

Never manufacture specifications.

=========================================================
SEO TITLE
=========================================================

Maximum 50 characters.

Include the most useful product keyword naturally.

Do not copy the Product Title blindly.

Do not keyword stuff.

=========================================================
META DESCRIPTION
=========================================================

Maximum 150 characters.

Explain the product clearly.

Include a useful keyword naturally.

Give the searcher a reason to click without unsupported claims.

Do not simply copy the Product Description.

=========================================================
TAGS
=========================================================

Create relevant and specific Shopify tags based on actual product information.

Do not create:

- random tags
- unsupported tags
- duplicate tags
- supplier spam
- keyword stuffing

=========================================================
AI DECISION MAKING
=========================================================

Do not use a fixed template that produces the same answer for every product.

Make decisions dynamically from the actual product data.

The result should be meaningfully different when the product data is different.

Return only valid JSON matching the supplied schema.
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

type AnalyzeRequest = {
  product?: ProductInput;

  /*
   * Existing titles from the Shopify store.
   *
   * This is optional so the API remains backward-compatible
   * with the current frontend.
   */
  existingProductTitles?: string[];

  /*
   * Alternative name accepted for compatibility.
   */
  existingTitles?: string[];
};

/* =========================================================
   BASIC HELPERS
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

  return result.slice(0, 50);
}

/* =========================================================
   TITLE NORMALIZATION
========================================================= */

function normalizeTitle(
  value: string,
): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   STOP WORDS
========================================================= */

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
]);

/* =========================================================
   TITLE TOKENS
========================================================= */

function titleTokens(
  value: string,
): string[] {
  return normalizeTitle(value)
    .split(" ")
    .filter(Boolean)
    .filter(
      (word) =>
        !TITLE_STOP_WORDS.has(word),
    );
}

/* =========================================================
   JACCARD SIMILARITY
========================================================= */

function titleSimilarity(
  a: string,
  b: string,
): number {
  const aTokens = new Set(
    titleTokens(a),
  );

  const bTokens = new Set(
    titleTokens(b),
  );

  if (
    aTokens.size === 0 ||
    bTokens.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection++;
    }
  }

  const union =
    new Set([
      ...aTokens,
      ...bTokens,
    ]).size;

  return union === 0
    ? 0
    : intersection / union;
}

/* =========================================================
   DISTINCTIVE PHRASE CHECK
========================================================= */

function hasDistinctivePhraseOverlap(
  candidate: string,
  existing: string,
): boolean {
  const candidateTokens =
    titleTokens(candidate);

  const existingTokens =
    titleTokens(existing);

  if (
    candidateTokens.length < 3 ||
    existingTokens.length < 3
  ) {
    return false;
  }

  const candidateSet =
    new Set(candidateTokens);

  let common = 0;

  for (const token of existingTokens) {
    if (candidateSet.has(token)) {
      common++;
    }
  }

  /*
   * If most meaningful words are shared,
   * treat it as too similar.
   */
  const smaller =
    Math.min(
      candidateSet.size,
      new Set(existingTokens).size,
    );

  if (
    smaller >= 3 &&
    common / smaller >= 0.75
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   DUPLICATE / NEAR DUPLICATE DETECTION
========================================================= */

function findSimilarTitle(
  candidate: string,
  existingTitles: string[],
): {
  duplicate: boolean;
  matchedTitle: string;
  similarity: number;
} {
  const normalizedCandidate =
    normalizeTitle(candidate);

  if (!normalizedCandidate) {
    return {
      duplicate: false,
      matchedTitle: "",
      similarity: 0,
    };
  }

  let highestSimilarity = 0;
  let matchedTitle = "";

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
      matchedTitle = existing;
    }

    /*
     * 0.78+ is intentionally strict.
     *
     * We do not want products in the same
     * store to look like duplicates.
     */
    if (
      similarity >= 0.78 ||
      hasDistinctivePhraseOverlap(
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

/* =========================================================
   TITLE LENGTH
========================================================= */

function enforceTitleLength(
  value: string,
  max = 90,
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

/* =========================================================
   DUPLICATE ARRAY CLEANUP
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

    const key =
      cleaned
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result.slice(0, 30);
}

/* =========================================================
   OPENAI OUTPUT EXTRACTION
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
   NORMALIZE RESULT
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
    enforceTitleLength(
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
   TITLE FALLBACK

   Used only if the AI accidentally returns a title
   that is too similar to an existing store title.
========================================================= */

function buildFallbackTitle(
  product: ProductInput,
  existingTitles: string[],
): string {
  const original =
    clean(product.title);

  const productType =
    clean(product.productType);

  const vendor =
    clean(product.vendor);

  const description =
    clean(product.description);

  /*
   * Extract useful words from the original title.
   */
  const words =
    original
      .replace(
        /[|:;,()[\]{}]+/g,
        " ",
      )
      .split(/\s+/)
      .filter(Boolean)
      .filter(
        (word) =>
          word.length > 2 &&
          !/^(new|sale|hot|best|fashion|style|product|item)$/i.test(
            word,
          ),
      );

  const candidates: string[] = [];

  /*
   * Candidate 1:
   * Use product type + strongest title words.
   */
  if (words.length >= 2) {
    candidates.push(
      `${words
        .slice(0, 3)
        .join(" ")}${
        productType
          ? ` ${productType}`
          : ""
      }`,
    );
  }

  /*
   * Candidate 2:
   * Vendor + product type.
   */
  if (
    vendor &&
    productType
  ) {
    candidates.push(
      `${vendor} ${productType}`,
    );
  }

  /*
   * Candidate 3:
   * Product type + useful title words.
   */
  if (productType) {
    candidates.push(
      `${productType}${
        words.length
          ? ` ${words
              .slice(0, 2)
              .join(" ")}`
          : ""
      }`,
    );
  }

  /*
   * Candidate 4:
   * Original title, cleaned.
   */
  if (original) {
    candidates.push(
      original,
    );
  }

  /*
   * Candidate 5:
   * Product type only.
   */
  if (productType) {
    candidates.push(
      productType,
    );
  }

  /*
   * Test candidates against existing titles.
   */
  for (const candidate of candidates) {
    const cleanCandidate =
      enforceTitleLength(
        candidate,
        90,
      );

    if (!cleanCandidate) {
      continue;
    }

    const check =
      findSimilarTitle(
        cleanCandidate,
        existingTitles,
      );

    if (!check.duplicate) {
      return cleanCandidate;
    }
  }

  /*
   * Last-resort fallback.
   *
   * We do NOT invent product claims.
   */
  if (productType) {
    return enforceTitleLength(
      productType,
      90,
    );
  }

  if (original) {
    return enforceTitleLength(
      original,
      90,
    );
  }

  if (description) {
    return enforceTitleLength(
      description,
      90,
    );
  }

  return "Product";
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

    /* =====================================================
       EXISTING STORE TITLES
    ===================================================== */

    const existingTitles =
      cleanList(
        body?.existingProductTitles ??
          body?.existingTitles ??
          [],
      )
        .filter(
          (existingTitle) =>
            normalizeTitle(
              existingTitle,
            ) !==
            normalizeTitle(
              product.title ??
                "",
            ),
        )
        .slice(0, 500);

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
       EXISTING TITLES CONTEXT
    ===================================================== */

    const duplicateContext =
      existingTitles.length > 0
        ? `
=========================================================
EXISTING STORE TITLES
=========================================================

These are titles already used by products in this store.

You MUST avoid exact duplicates and near-duplicates.

${existingTitles
  .map(
    (title, index) =>
      `${index + 1}. ${title}`,
  )
  .join("\n")}

=========================================================
END EXISTING STORE TITLES
=========================================================
`
        : `
No existing store title list was supplied.

Still create a unique, product-specific title and do not
blindly reuse the original title.
`;

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

${duplicateContext}

=========================================================
CURRENT PRODUCT
=========================================================

${JSON.stringify(
  productData,
  null,
  2,
)}

=========================================================
TITLE REQUIREMENT
=========================================================

Create a product title that is:

- accurate
- natural
- premium
- conversion-focused
- product-specific
- not keyword stuffed
- not copied from the original title
- not identical to any existing store title
- not a near-duplicate of any existing store title

If the original title contains supplier-style wording,
rewrite it professionally.

Do not create unsupported claims merely to make the
title different.
`,
                  },
                ],
              },
            ],

            /* =================================================
               STRUCTURED OUTPUT
            ================================================= */

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
       SERVER-SIDE TITLE VALIDATION
       
       Even if the AI ignores the duplicate instruction,
       Virello checks the title again before returning it.
    ===================================================== */

    let generatedTitle =
      clean(
        result.optimization
          .title,
      );

    let titleDuplicateCheck =
      findSimilarTitle(
        generatedTitle,
        existingTitles,
      );

    if (
      titleDuplicateCheck.duplicate
    ) {
      console.warn(
        "AI generated duplicate/near-duplicate title:",
        {
          generatedTitle,
          matchedTitle:
            titleDuplicateCheck.matchedTitle,
          similarity:
            titleDuplicateCheck.similarity,
        },
      );

      /*
       * Ask the same AI result to be corrected by using
       * a deterministic fallback only if necessary.
       *
       * This prevents a duplicate from reaching the UI.
       */
      const fallbackTitle =
        buildFallbackTitle(
          productData,
          existingTitles,
        );

      const fallbackCheck =
        findSimilarTitle(
          fallbackTitle,
          existingTitles,
        );

      if (
        !fallbackCheck.duplicate
      ) {
        generatedTitle =
          fallbackTitle;
      }
    }

    result.optimization.title =
      enforceTitleLength(
        generatedTitle,
        90,
      );

    /* =====================================================
       FINAL DUPLICATE CHECK
    ===================================================== */

    titleDuplicateCheck =
      findSimilarTitle(
        result.optimization
          .title,
        existingTitles,
      );

    /*
     * If there is still a duplicate and we actually have
     * an existing title list, do not silently return a
     * known duplicate.
     */
    if (
      titleDuplicateCheck.duplicate &&
      existingTitles.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Virello could not safely create a sufficiently unique product title. Please try Analyze again.",
        },

        {
          status: 422,
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
