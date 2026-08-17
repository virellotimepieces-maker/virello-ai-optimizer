import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type Audience = "Men" | "Women" | "Unisex";

type ProductInput = {
  id?: string;
  title?: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
  audience?: string;
  style?: string;
};

type AnalyzeBody = {
  product?: ProductInput;
  existingProductTitles?: string[];
};

/* =========================================================
   RESPONSE SCHEMA
========================================================= */

const responseSchema = {
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
} as const;

/* =========================================================
   BASIC HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = clean(value);

    if (!text) {
      continue;
    }

    const key = text.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(text);
    }
  }

  return result;
}

function limit(value: unknown, max: number): string {
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
    .replace(/[.,;:!?-]+$/, "")
    .trim();
}

function wordCount(value: unknown): number {
  const text = clean(value);

  if (!text) {
    return 0;
  }

  return text.split(/\s+/).length;
}

function clampScore(value: number): number {
  return Math.max(
    0,
    Math.min(100, Math.round(value)),
  );
}

/* =========================================================
   AUDIENCE DETECTION
========================================================= */

/*
  Important rule:

  Men/Women explicitly selected by the application
  are respected.

  "Unisex" is treated as a fallback when the product
  itself contains a clear gender signal.

  This prevents a men's watch from becoming unisex
  simply because the UI default was Unisex.
*/

function detectAudienceFromText(
  product: ProductInput,
): Audience {
  const title = clean(product.title).toLowerCase();
  const description = clean(product.description).toLowerCase();
  const productType = clean(product.productType).toLowerCase();
  const vendor = clean(product.vendor).toLowerCase();

  const tags = Array.isArray(product.tags)
    ? product.tags
        .map((tag) => clean(tag).toLowerCase())
        .join(" ")
    : "";

  const source = [
    title,
    description,
    productType,
    vendor,
    tags,
  ].join(" ");

  const maleStrongPatterns = [
    /\bmen's\b/,
    /\bmens\b/,
    /\bmen\b/,
    /\bfor men\b/,
    /\bmale\b/,
    /\bgentleman\b/,
    /\bgentlemen\b/,
    /\bgents\b/,
    /\bfor him\b/,
    /\bboy's\b/,
    /\bboys\b/,
  ];

  const femaleStrongPatterns = [
    /\bwomen's\b/,
    /\bwomens\b/,
    /\bwomen\b/,
    /\bfor women\b/,
    /\bfemale\b/,
    /\bladies\b/,
    /\blady\b/,
    /\bfor her\b/,
    /\bgirl's\b/,
    /\bgirls\b/,
  ];

  const maleScore = maleStrongPatterns.reduce(
    (score, pattern) =>
      score + (pattern.test(source) ? 1 : 0),
    0,
  );

  const femaleScore = femaleStrongPatterns.reduce(
    (score, pattern) =>
      score + (pattern.test(source) ? 1 : 0),
    0,
  );

  if (maleScore > femaleScore && maleScore > 0) {
    return "Men";
  }

  if (femaleScore > maleScore && femaleScore > 0) {
    return "Women";
  }

  return "Unisex";
}

/* =========================================================
   AUTHORITATIVE AUDIENCE
========================================================= */

function resolveAudience(
  product: ProductInput,
): Audience {
  const supplied = clean(product.audience)
    .toLowerCase();

  /*
    Explicit Men/Women selections always win.
  */

  if (supplied === "men") {
    return "Men";
  }

  if (supplied === "women") {
    return "Women";
  }

  /*
    If UI supplied Unisex/default, inspect actual
    Shopify product information.
  */

  const detected =
    detectAudienceFromText(product);

  return detected;
}

/* =========================================================
   PRODUCT NORMALIZATION
========================================================= */

function safeProduct(
  product: ProductInput,
): Record<string, unknown> {
  return {
    id: clean(product.id),

    title: clean(product.title),

    description: clean(product.description),

    productType: clean(product.productType),

    vendor: clean(product.vendor),

    tags: unique(
      Array.isArray(product.tags)
        ? product.tags
        : [],
    ),

    price: clean(product.price),

    audience: resolveAudience(product),

    style: clean(product.style),
  };
}

/* =========================================================
   AUDIENCE INSTRUCTIONS
========================================================= */

function audienceInstructions(
  audience: Audience,
): string {
  if (audience === "Men") {
    return `
==================================================
STRICT TARGET AUDIENCE: MEN
==================================================

The authoritative target audience is MEN.

This is a men's product.

Every major marketing decision must reflect male
shopping intent.

targetCustomer MUST describe male shoppers.

purchaseMotivation MUST be relevant to men.

conversionOpportunities MUST be relevant to men.

The product title must remain appropriate for men.

The product description must remain appropriate for men.

SEO content must reflect men's search intent.

Do NOT target women.

Do NOT describe women as the target customer.

Do NOT say:
- men and women
- women and men
- unisex
- women's
- ladies
- female
- for her

unless the term is necessary inside
missingInformation to identify conflicting
source data.

Never silently convert a men's product to women
or unisex.
`;
  }

  if (audience === "Women") {
    return `
==================================================
STRICT TARGET AUDIENCE: WOMEN
==================================================

The authoritative target audience is WOMEN.

This is a women's product.

Every major marketing decision must reflect female
shopping intent.

targetCustomer MUST describe female shoppers.

purchaseMotivation MUST be relevant to women.

conversionOpportunities MUST be relevant to women.

The product title must remain appropriate for women.

The product description must remain appropriate for women.

SEO content must reflect women's search intent.

Do NOT target men.

Do NOT describe men as the target customer.

Do NOT say:
- men and women
- women and men
- men's
- gentlemen
- male
- for him

unless the term is necessary inside
missingInformation to identify conflicting
source data.
`;
  }

  return `
==================================================
TARGET AUDIENCE: UNISEX
==================================================

The product may be marketed to both men and women.

Use inclusive language.

Only use unisex positioning when the actual product
data does not contain a stronger gender signal.
`;
}

/* =========================================================
   FORBIDDEN AUDIENCE LANGUAGE
========================================================= */

function containsForbiddenAudienceLanguage(
  value: unknown,
  audience: Audience,
): boolean {
  const text = clean(value).toLowerCase();

  if (!text) {
    return false;
  }

  if (audience === "Men") {
    return (
      /\bwomen\b/.test(text) ||
      /\bwomen's\b/.test(text) ||
      /\bladies\b/.test(text) ||
      /\bfemale\b/.test(text) ||
      /\bfor her\b/.test(text) ||
      /\bunisex\b/.test(text)
    );
  }

  if (audience === "Women") {
    return (
      /\bmen\b/.test(text) ||
      /\bmen's\b/.test(text) ||
      /\bgentlemen\b/.test(text) ||
      /\bmale\b/.test(text) ||
      /\bfor him\b/.test(text) ||
      /\bunisex\b/.test(text)
    );
  }

  return false;
}

/* =========================================================
   VALIDATE AUDIENCE
========================================================= */

function validateAudienceResult(
  result: any,
  audience: Audience,
): string | null {
  const analysis = result?.analysis || {};
  const optimization = result?.optimization || {};

  const fields = [
    analysis.targetCustomer,
    analysis.purchaseMotivation,

    ...(Array.isArray(
      analysis.conversionOpportunities,
    )
      ? analysis.conversionOpportunities
      : []),

    ...(Array.isArray(
      analysis.seoOpportunities,
    )
      ? analysis.seoOpportunities
      : []),

    optimization.title,
    optimization.description,
    optimization.seoTitle,
    optimization.metaDescription,

    ...(Array.isArray(optimization.tags)
      ? optimization.tags
      : []),
  ];

  for (const field of fields) {
    if (
      containsForbiddenAudienceLanguage(
        field,
        audience,
      )
    ) {
      if (audience === "Men") {
        return (
          "AI generated female or unisex positioning for a men's product."
        );
      }

      if (audience === "Women") {
        return (
          "AI generated male or unisex positioning for a women's product."
        );
      }
    }
  }

  return null;
}

/* =========================================================
   DUPLICATE TITLE HELPERS
========================================================= */

function normalizeTitle(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(
  first: string,
  second: string,
): number {
  const a = new Set(
    normalizeTitle(first)
      .split(" ")
      .filter(Boolean),
  );

  const b = new Set(
    normalizeTitle(second)
      .split(" ")
      .filter(Boolean),
  );

  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;

  for (const word of a) {
    if (b.has(word)) {
      intersection++;
    }
  }

  const union = new Set([
    ...a,
    ...b,
  ]).size;

  return union
    ? intersection / union
    : 0;
}

function isDuplicateTitle(
  generated: string,
  existingTitles: string[],
): boolean {
  const normalizedGenerated =
    normalizeTitle(generated);

  for (const existing of existingTitles) {
    const normalizedExisting =
      normalizeTitle(existing);

    if (
      normalizedExisting ===
      normalizedGenerated
    ) {
      return true;
    }

    /*
      Prevent near-duplicate titles.
    */

    if (
      normalizedGenerated.length > 12 &&
      normalizedExisting.length > 12 &&
      titleSimilarity(
        normalizedGenerated,
        normalizedExisting,
      ) >= 0.82
    ) {
      return true;
    }
  }

  return false;
}

/* =========================================================
   RESULT NORMALIZATION
========================================================= */

function normalizeResult(result: any): any {
  if (!result.analysis) {
    result.analysis = {};
  }

  if (!result.score) {
    result.score = {};
  }

  if (!result.optimization) {
    result.optimization = {};
  }

  result.optimization.title =
    clean(result.optimization.title);

  result.optimization.description =
    clean(result.optimization.description);

  result.optimization.seoTitle =
    limit(
      result.optimization.seoTitle,
      50,
    );

  result.optimization.metaDescription =
    limit(
      result.optimization.metaDescription,
      150,
    );

  result.optimization.features =
    unique(
      Array.isArray(
        result.optimization.features,
      )
        ? result.optimization.features
        : [],
    );

  result.optimization.specifications =
    unique(
      Array.isArray(
        result.optimization.specifications,
      )
        ? result.optimization.specifications
        : [],
    );

  result.optimization.tags =
    unique(
      Array.isArray(
        result.optimization.tags,
      )
        ? result.optimization.tags
        : [],
    );

  result.analysis.targetCustomer =
    clean(
      result.analysis.targetCustomer,
    );

  result.analysis.purchaseMotivation =
    clean(
      result.analysis.purchaseMotivation,
    );

  result.analysis.strongestFeatures =
    unique(
      Array.isArray(
        result.analysis.strongestFeatures,
      )
        ? result.analysis.strongestFeatures
        : [],
    );

  result.analysis.weaknesses =
    unique(
      Array.isArray(
        result.analysis.weaknesses,
      )
        ? result.analysis.weaknesses
        : [],
    );

  result.analysis.missingInformation =
    unique(
      Array.isArray(
        result.analysis.missingInformation,
      )
        ? result.analysis.missingInformation
        : [],
    );

  result.analysis.seoOpportunities =
    unique(
      Array.isArray(
        result.analysis.seoOpportunities,
      )
        ? result.analysis.seoOpportunities
        : [],
    );

  result.analysis.conversionOpportunities =
    unique(
      Array.isArray(
        result.analysis.conversionOpportunities,
      )
        ? result.analysis.conversionOpportunities
        : [],
    );

  result.reasoning =
    clean(result.reasoning);

  return result;
}

/* =========================================================
   QUALITY SCORING
========================================================= */

/*
  The AI provides its analysis, but Virello calculates
  a second quality score from the actual optimized result.

  This prevents random low scores and makes the score
  consistent with the quality of the generated listing.
*/

function calculateQualityScores(
  result: any,
  audience: Audience,
  product: ProductInput,
) {
  const title =
    clean(result.optimization?.title);

  const description =
    clean(result.optimization?.description);

  const seoTitle =
    clean(result.optimization?.seoTitle);

  const metaDescription =
    clean(result.optimization?.metaDescription);

  const targetCustomer =
    clean(result.analysis?.targetCustomer);

  const purchaseMotivation =
    clean(result.analysis?.purchaseMotivation);

  const features = Array.isArray(
    result.optimization?.features,
  )
    ? result.optimization.features
    : [];

  const tags = Array.isArray(
    result.optimization?.tags,
  )
    ? result.optimization.tags
    : [];

  const sourceText = [
    clean(product.title),
    clean(product.description),
    clean(product.productType),
    clean(product.vendor),
    ...(Array.isArray(product.tags)
      ? product.tags
      : []),
  ]
    .join(" ")
    .toLowerCase();

  const titleLower = title.toLowerCase();
  const descriptionLower =
    description.toLowerCase();

  const audienceWord =
    audience === "Men"
      ? /\bmen\b|\bmen's\b|\bmens\b/
      : audience === "Women"
        ? /\bwomen\b|\bwomen's\b|\bwomens\b/
        : /\bmen\b|\bwomen\b|\bunisex\b/;

  /* =======================================================
     TITLE SCORE
  ======================================================= */

  let titleScore = 70;

  const titleWords = wordCount(title);

  if (
    titleWords >= 4 &&
    titleWords <= 8
  ) {
    titleScore += 8;
  }

  if (
    title.length >= 25 &&
    title.length <= 65
  ) {
    titleScore += 7;
  }

  if (audienceWord.test(titleLower)) {
    titleScore += 5;
  }

  if (
    /\bwatch\b|\bchronograph\b|\bquartz\b|\bautomatic\b|\bbracelet\b/
      .test(titleLower)
  ) {
    titleScore += 5;
  }

  if (
    !/[!?]{2,}/.test(title) &&
    !/[A-Z]{5,}/.test(title)
  ) {
    titleScore += 3;
  }

  titleScore = clampScore(titleScore);

  /* =======================================================
     DESCRIPTION SCORE
  ======================================================= */

  let descriptionScore = 68;

  if (description.length >= 250) {
    descriptionScore += 8;
  }

  if (description.length >= 400) {
    descriptionScore += 5;
  }

  if (description.length <= 1400) {
    descriptionScore += 3;
  }

  if (
    /\bdesigned\b|\bfeatures\b|\bideal\b|\bstyle\b|\bcrafted\b|\bwear\b/
      .test(descriptionLower)
  ) {
    descriptionScore += 5;
  }

  if (
    audienceWord.test(descriptionLower)
  ) {
    descriptionScore += 4;
  }

  if (
    features.length >= 3
  ) {
    descriptionScore += 4;
  }

  descriptionScore = clampScore(
    descriptionScore,
  );

  /* =======================================================
     SEO SCORE
  ======================================================= */

  let seoScore = 68;

  if (
    seoTitle.length >= 25 &&
    seoTitle.length <= 50
  ) {
    seoScore += 8;
  }

  if (
    metaDescription.length >= 110 &&
    metaDescription.length <= 150
  ) {
    seoScore += 8;
  }

  const seoWords =
    normalizeTitle(seoTitle)
      .split(" ")
      .filter(Boolean);

  const matchingSeoWords =
    seoWords.filter((word) =>
      sourceText.includes(word),
    ).length;

  if (matchingSeoWords >= 2) {
    seoScore += 5;
  }

  if (tags.length >= 4) {
    seoScore += 4;
  }

  if (tags.length >= 6) {
    seoScore += 3;
  }

  seoScore = clampScore(seoScore);

  /* =======================================================
     PRODUCT CLARITY
  ======================================================= */

  let clarityScore = 70;

  if (title) {
    clarityScore += 5;
  }

  if (targetCustomer) {
    clarityScore += 5;
  }

  if (purchaseMotivation) {
    clarityScore += 5;
  }

  if (features.length >= 3) {
    clarityScore += 5;
  }

  if (
    Array.isArray(
      result.optimization?.specifications,
    ) &&
    result.optimization.specifications
      .length >= 1
  ) {
    clarityScore += 3;
  }

  if (
    result.analysis?.missingInformation &&
    result.analysis.missingInformation.length <= 4
  ) {
    clarityScore += 2;
  }

  clarityScore = clampScore(
    clarityScore,
  );

  /* =======================================================
     CONVERSION SCORE
  ======================================================= */

  let conversionScore = 70;

  if (purchaseMotivation) {
    conversionScore += 6;
  }

  if (description.length >= 250) {
    conversionScore += 5;
  }

  if (features.length >= 3) {
    conversionScore += 5;
  }

  if (targetCustomer) {
    conversionScore += 4;
  }

  if (
    Array.isArray(
      result.analysis?.conversionOpportunities,
    ) &&
    result.analysis.conversionOpportunities
      .length >= 2
  ) {
    conversionScore += 3;
  }

  if (
    audienceWord.test(
      (
        targetCustomer +
        " " +
        purchaseMotivation
      ).toLowerCase(),
    )
  ) {
    conversionScore += 4;
  }

  conversionScore = clampScore(
    conversionScore,
  );

  /* =======================================================
     OVERALL
  ======================================================= */

  const overall =
    clampScore(
      titleScore * 0.18 +
        descriptionScore * 0.20 +
        seoScore * 0.20 +
        clarityScore * 0.20 +
        conversionScore * 0.22,
    );

  return {
    title: titleScore,
    description: descriptionScore,
    seo: seoScore,
    productClarity: clarityScore,
    conversionPotential: conversionScore,
    overall,
  };
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    /* =====================================================
       OPENAI KEY
    ===================================================== */

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY is missing in Vercel Environment Variables.",
        },
        {
          status: 500,
        },
      );
    }

    /* =====================================================
       SHOPIFY SESSION
    ===================================================== */

    const authorization =
      request.headers.get(
        "authorization",
      );

    const sessionToken =
      request.headers.get(
        "x-shopify-session-token",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      ) ||
      !sessionToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify session is required. Reopen Virello from Shopify Admin.",
        },
        {
          status: 401,
        },
      );
    }

    /* =====================================================
       REQUEST BODY
    ===================================================== */

    const body =
      (await request.json()) as AnalyzeBody;

    const product =
      body.product;

    if (!product?.title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product data is required.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       EXISTING TITLES
    ===================================================== */

    const existingTitles =
      unique(
        Array.isArray(
          body.existingProductTitles,
        )
          ? body.existingProductTitles
          : [],
      );

    /* =====================================================
       RESOLVE AUDIENCE
    ===================================================== */

    const authoritativeAudience =
      resolveAudience(product);

    const productData =
      safeProduct(product);

    /*
      Make sure the actual resolved audience is included
      in the data sent to the AI.
    */

    productData.audience =
      authoritativeAudience;

    /* =====================================================
       MODEL
    ===================================================== */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

    /* =====================================================
       SYSTEM PROMPT
    ===================================================== */

    const systemPrompt = `
You are Virello AI Optimizer.

You are an advanced ecommerce product strategist,
SEO specialist, merchandising specialist,
and conversion copywriter for a premium online
watch store.

Your job is to analyze the ACTUAL Shopify product
data and create a stronger product listing.

This is REAL AI ANALYSIS.

Do not use hard-coded product information.

Do not invent facts.

Do not invent specifications.

Do not invent materials.

Do not invent movement type.

Do not invent water resistance.

Do not invent dimensions.

Do not invent warranty.

Do not invent certifications.

Do not invent gemstone information.

Do not invent country of origin.

Do not invent shipping times.

Do not invent performance claims.

Do not invent brand claims.

If information is unavailable,
identify it in missingInformation.

${audienceInstructions(
  authoritativeAudience,
)}

==================================================
CORE PRODUCT ANALYSIS
==================================================

Analyze the actual product using:

- title
- description
- product type
- vendor
- tags
- price
- audience
- style

The authoritative audience is:

${authoritativeAudience}

Do not allow generic ecommerce assumptions
to override the authoritative audience.

Use the actual product information to determine:

- what the product is
- who it is for
- why the customer would want it
- strongest verified features
- missing information
- SEO opportunities
- conversion opportunities

==================================================
TITLE
==================================================

Create a premium ecommerce title.

Use approximately 4–8 meaningful words.

The title must:

- identify the actual product
- use relevant search language
- sound premium
- sound natural
- fit the audience
- avoid keyword stuffing
- avoid unnecessary punctuation
- avoid generic marketplace wording
- avoid fake luxury claims
- avoid unsupported claims
- avoid repetitive wording

Do not exactly copy an existing Shopify title.

Avoid near duplicates.

==================================================
DESCRIPTION
==================================================

Create persuasive customer-facing copy.

The description should:

- lead with customer value
- explain the product appeal
- highlight verified features
- match the target audience
- use natural SEO language
- create purchase motivation
- sound like a premium boutique brand
- avoid dropshipping language
- avoid keyword stuffing
- avoid repetitive sentences
- avoid unsupported claims

Do not use fake urgency.

Do not claim scarcity unless supplied.

Do not claim:
- best
- number one
- guaranteed
- premium quality
- luxury
- waterproof
- scratch-proof
- medical
- certified

unless supported by the actual source data.

==================================================
FEATURES
==================================================

Only include verified features.

Never invent features.

==================================================
SPECIFICATIONS
==================================================

Only include specifications explicitly supported
by the supplied product information.

If reliable specifications are unavailable,
return an empty array.

Never guess.

==================================================
SEO TITLE
==================================================

Maximum 50 characters.

Use the strongest relevant search phrase.

Make it natural.

Do not keyword stuff.

==================================================
META DESCRIPTION
==================================================

Maximum 150 characters.

Make it:

- relevant
- persuasive
- natural
- audience-specific
- search-friendly

==================================================
TAGS
==================================================

Generate useful Shopify tags based on:

- actual product category
- audience
- style
- design
- verified features
- search intent

Avoid unsupported technical claims.

Avoid repeated concepts.

==================================================
ANALYSIS
==================================================

The analysis must be product-specific.

Target customer must clearly identify the correct
audience.

Purchase motivation must explain why that customer
would want this exact product.

Strongest features must be based on actual data.

Weaknesses must identify real listing limitations.

Missing information must identify information that
would improve customer confidence.

SEO opportunities must identify useful search terms.

Conversion opportunities must explain practical
ways to improve purchase intent.

==================================================
SCORING
==================================================

Provide an honest quality assessment.

The optimized result should be evaluated on:

Title:
- relevance
- clarity
- search intent
- differentiation
- audience fit

Description:
- persuasion
- clarity
- benefits
- verified features
- audience fit

SEO:
- keyword relevance
- SEO title
- meta description
- tags
- search intent

Product clarity:
- what it is
- who it is for
- why it matters
- available details

Conversion:
- value communication
- purchase motivation
- clarity
- trust
- audience fit

Do not randomly lower scores.

Do not randomly inflate scores.

A strong optimized listing can score in the
80–95 range.

==================================================
FINAL OUTPUT
==================================================

Return ONLY the structured JSON object.
No markdown.
No explanation outside the JSON.
`;

    /* =====================================================
       USER PROMPT
    ===================================================== */

    const userPrompt =
      JSON.stringify(
        {
          authoritativeAudience:
            authoritativeAudience,

          audienceDetection:
            "The application resolved the target audience from explicit selection and actual Shopify product signals.",

          product:
            productData,

          existingProductTitles:
            existingTitles,

          task:
            "Analyze this actual Shopify product and create a stronger factual premium optimization. Keep the target audience accurate and avoid unsupported claims.",
        },
        null,
        2,
      );

    /* =====================================================
       OPENAI REQUEST
    ===================================================== */

    const aiResponse =
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

          body: JSON.stringify(
            {
              model,

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
                  type: "json_schema",

                  name:
                    "virello_ai_result",

                  strict: true,

                  schema:
                    responseSchema,
                },
              },

              max_output_tokens:
                5000,
            },
          ),
        },
      );

    /* =====================================================
       READ OPENAI RESPONSE
    ===================================================== */

    const raw =
      (await aiResponse.json()) as {
        error?: {
          message?: string;
        };

        output_text?: string;

        output?: Array<{
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
      };

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          success: false,

          error:
            raw.error?.message ||
            `OpenAI request failed with status ${aiResponse.status}.`,
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       EXTRACT OUTPUT
    ===================================================== */

    const outputText =
      raw.output_text ||
      raw.output
        ?.flatMap(
          (item) =>
            item.content || [],
        )
        .find(
          (item) =>
            item.type ===
            "output_text",
        )?.text ||
      "";

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,

          error:
            "OpenAI returned no analysis output.",
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
    } catch {
      return NextResponse.json(
        {
          success: false,

          error:
            "OpenAI returned invalid structured output.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       BASIC VALIDATION
    ===================================================== */

    if (
      !result?.analysis ||
      !result?.score ||
      !result?.optimization
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "AI returned an incomplete optimization.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       NORMALIZE
    ===================================================== */

    result =
      normalizeResult(result);

    /* =====================================================
       STRICT AUDIENCE VALIDATION
    ===================================================== */

    const audienceError =
      validateAudienceResult(
        result,
        authoritativeAudience,
      );

    if (audienceError) {
      console.error(
        "Virello audience validation failed:",
        {
          audience:
            authoritativeAudience,

          product:
            productData,

          error:
            audienceError,
        },
      );

      return NextResponse.json(
        {
          success: false,

          error:
            `${audienceError} Please run the AI analysis again.`,
        },
        {
          status: 422,
        },
      );
    }

    /* =====================================================
       TITLE VALIDATION
    ===================================================== */

    if (
      !result.optimization.title
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "AI generated an empty product title.",
        },
        {
          status: 422,
        },
      );
    }

    /* =====================================================
       DUPLICATE TITLE CHECK
    ===================================================== */

    if (
      isDuplicateTitle(
        result.optimization.title,
        existingTitles,
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "AI generated a product title that is already used or too similar to an existing Shopify title. Please run the analysis again.",
        },
        {
          status: 422,
        },
      );
    }

    /* =====================================================
       FINAL QUALITY SCORE
    ===================================================== */

    result.score =
      calculateQualityScores(
        result,
        authoritativeAudience,
        product,
      );

    /* =====================================================
       FINAL RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      audience:
        authoritativeAudience,

      result,
    });
  } catch (error) {
    console.error(
      "Virello AI analyze error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Virello AI analysis failed.",
      },
      {
        status: 500,
      },
    );
  }
}
