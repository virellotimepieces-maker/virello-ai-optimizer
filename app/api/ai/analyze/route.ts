import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  audience?: "Women" | "Men" | "Unisex";

  style?:
    | "Premium / Luxury"
    | "Professional"
    | "Everyday"
    | "Casual"
    | "Sport"
    | "Gift";

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

type AIAnalysis = {
  targetCustomer: string;
  purchaseMotivation: string;
  strongestFeatures: string[];
  weaknesses: string[];
  missingInformation: string[];
  seoOpportunities: string[];
  conversionOpportunities: string[];
};

type AIScore = {
  title: number;
  description: number;
  seo: number;
  productClarity: number;
  conversionPotential: number;
  overall: number;
};

type AIOptimization = {
  title: string;
  productType: string;
  description: string;
  features: string[];
  specifications: string[];
  seoTitle: string;
  metaDescription: string;
  tags: string[];
};

type AIResult = {
  analysis: AIAnalysis;
  score: AIScore;
  optimization: AIOptimization;
  reasoning: string;
};

/* =========================================================
   SEO LIMITS
========================================================= */

const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;

/* =========================================================
   HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: unknown[]): string[] {
  const seen = new Set<string>();

  return values
    .map(clean)
    .filter((value) => {
      const normalized = value.toLowerCase();

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);

      return true;
    });
}

function limitCharacters(
  value: unknown,
  max: number,
): string {
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

function clampScore(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(number)),
  );
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

  const parts: string[] = [];

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
        content?.type ===
          "output_text" &&
        typeof content?.text ===
          "string"
      ) {
        parts.push(
          content.text,
        );
      }
    }
  }

  return parts
    .join("\n")
    .trim();
}

/* =========================================================
   NORMALIZE RESULT
========================================================= */

function normalizeResult(
  raw: any,
): AIResult {
  const analysis =
    raw?.analysis || {};

  const score =
    raw?.score || {};

  const optimization =
    raw?.optimization || {};

  const normalizedScore: AIScore = {
    title: clampScore(
      score.title,
    ),

    description: clampScore(
      score.description,
    ),

    seo: clampScore(
      score.seo,
    ),

    productClarity:
      clampScore(
        score.productClarity,
      ),

    conversionPotential:
      clampScore(
        score.conversionPotential,
      ),

    overall: clampScore(
      score.overall,
    ),
  };

  const normalizedOptimization:
    AIOptimization = {
    title: clean(
      optimization.title,
    ),

    productType: clean(
      optimization.productType,
    ),

    description: clean(
      optimization.description,
    ),

    features: unique(
      Array.isArray(
        optimization.features,
      )
        ? optimization.features
        : [],
    ),

    specifications: unique(
      Array.isArray(
        optimization.specifications,
      )
        ? optimization.specifications
        : [],
    ),

    seoTitle: limitCharacters(
      optimization.seoTitle,
      SEO_TITLE_MAX,
    ),

    metaDescription:
      limitCharacters(
        optimization.metaDescription,
        META_DESCRIPTION_MAX,
      ),

    tags: unique(
      Array.isArray(
        optimization.tags,
      )
        ? optimization.tags
        : [],
    ),
  };

  return {
    analysis: {
      targetCustomer: clean(
        analysis.targetCustomer,
      ),

      purchaseMotivation:
        clean(
          analysis.purchaseMotivation,
        ),

      strongestFeatures:
        unique(
          Array.isArray(
            analysis.strongestFeatures,
          )
            ? analysis.strongestFeatures
            : [],
        ),

      weaknesses: unique(
        Array.isArray(
          analysis.weaknesses,
        )
          ? analysis.weaknesses
          : [],
      ),

      missingInformation:
        unique(
          Array.isArray(
            analysis.missingInformation,
          )
            ? analysis.missingInformation
            : [],
        ),

      seoOpportunities:
        unique(
          Array.isArray(
            analysis.seoOpportunities,
          )
            ? analysis.seoOpportunities
            : [],
        ),

      conversionOpportunities:
        unique(
          Array.isArray(
            analysis.conversionOpportunities,
          )
            ? analysis.conversionOpportunities
            : [],
        ),
    },

    score:
      normalizedScore,

    optimization:
      normalizedOptimization,

    reasoning: clean(
      raw?.reasoning,
    ),
  };
}

/* =========================================================
   AI JSON SCHEMA
========================================================= */

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

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    /* =====================================================
       1. API KEY
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
       2. REQUEST BODY
    ===================================================== */

    const body =
      await request.json();

    const product =
      body?.product as
        | ProductInput
        | undefined;

    if (!product) {
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
       3. CLEAN PRODUCT DATA
    ===================================================== */

    const title =
      clean(product.title);

    const description =
      stripHtml(
        product.description,
      );

    const productType =
      clean(
        product.productType,
      );

    const vendor =
      clean(
        product.vendor,
      );

    const tags =
      unique(
        Array.isArray(
          product.tags,
        )
          ? product.tags
          : [],
      );

    const price =
      clean(
        product.price,
      );

    const variants =
      Array.isArray(
        product.variants,
      )
        ? product.variants.map(
            (variant) => ({
              title: clean(
                variant?.title,
              ),

              price: clean(
                variant?.price,
              ),

              sku: clean(
                variant?.sku,
              ),

              available:
                variant?.available,
            }),
          )
        : [];

    const imageAltTexts =
      Array.isArray(
        product.images,
      )
        ? product.images
            .map((image) =>
              clean(
                image?.altText,
              ),
            )
            .filter(Boolean)
        : [];

    if (!title) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Product title is required for AI analysis.",
        },
        {
          status: 400,
        },
      );
    }

    /* =====================================================
       4. AUDIENCE CONTEXT
    ===================================================== */

    const suppliedAudience =
      product.audience || "";

    /* =====================================================
       5. PRODUCT CONTEXT
    ===================================================== */

    const productContext = {
      id: clean(product.id),

      title,

      description,

      existingShopifyProductType:
        productType,

      vendor,

      tags,

      price,

      suppliedAudience,

      suppliedStyle:
        clean(
          product.style,
        ),

      variants,

      imageAltTexts,
    };

    /* =====================================================
       6. AI INSTRUCTIONS
    ===================================================== */

    const instructions = `
You are Virello AI Optimizer.

You are an expert ecommerce product analyst,
Shopify SEO specialist, conversion copywriter,
and premium watch merchandising specialist.

Your job is to analyze the CURRENT Shopify product
listing and then create an improved version.

The supplied Shopify product information is the
SOURCE OF TRUTH.

Never invent product facts.

========================================================
PRODUCT TYPE — IMPORTANT
========================================================

You MUST return a non-empty optimization.productType.

Determine the Product Type from the actual product
information.

The Product Type must describe WHAT THE PRODUCT IS,
not merely its marketing style.

For example, if the actual product is a watch, use a
specific useful type only when supported by the actual
product information, such as:

"Men's Watch"
"Women's Watch"
"Automatic Watch"
"Men's Chronograph Watch"
"Quartz Watch"
"Luxury Watch"

Do not blindly copy the existing Shopify Product Type
if it is obviously inaccurate.

Do not create a Product Type that depends on an
unsupported specification.

Bad examples:

"Premium"
"Elegant"
"Luxury Style"
"Fashion"

Good examples when supported:

"Men's Watch"
"Automatic Watch"
"Men's Chronograph Watch"
"Stainless Steel Watch"

========================================================
AUDIENCE ANALYSIS
========================================================

Determine the target customer from the ACTUAL PRODUCT
INFORMATION provided in PRODUCT CONTEXT.

Use all relevant evidence available in:

- product title
- product description
- existing Shopify Product Type
- vendor
- Shopify tags
- supplied audience, if present
- product variants
- image alt text
- verified product characteristics

Do NOT determine audience from generic marketing words
alone.

Words such as:

fashion
elegant
luxury
gift
style
beautiful
classic
premium
jewelry

are NOT sufficient by themselves to classify a product
as Men or Women.

If the actual product information clearly identifies the
product as Men's, use male/men positioning.

If the actual product information clearly identifies the
product as Women's, use female/women positioning.

If the evidence supports both or does not clearly support
one audience, use Unisex positioning.

Do not force an audience classification when the product
data does not support it.

The AI analysis is the source of truth for the target
customer.

========================================================
WATCH ANALYSIS
========================================================

When the product is a watch, inspect the provided data
for verified information about:

- men's or women's positioning
- automatic movement
- mechanical movement
- quartz movement
- chronograph
- sapphire crystal
- mineral crystal
- stainless steel
- case diameter
- bracelet
- leather strap
- water resistance
- dial
- bezel
- complications
- dress style
- sport style
- everyday style
- premium positioning
- luxury positioning

NEVER invent these specifications.

If not provided, do not claim them.

========================================================
CURRENT LISTING SCORE
========================================================

The score is for the CURRENT listing BEFORE optimization.

Do NOT score the rewritten version.

Evaluate:

1. Title quality
2. Description quality
3. SEO quality
4. Product clarity
5. Conversion potential

The score should reflect what a qualified shopper can
actually understand from the CURRENT listing.

Do not automatically give 80, 90, or 100.

However, do not artificially punish a product simply
because the supplier provided information in a short
format.

Missing information should reduce the score only when
that information is genuinely important for purchase
confidence.

========================================================
TITLE SCORE
========================================================

Evaluate whether the CURRENT title:

- clearly identifies the product
- contains useful search terms
- identifies the audience when supported
- avoids supplier wording
- avoids keyword stuffing
- sounds like a legitimate premium ecommerce store

========================================================
DESCRIPTION SCORE
========================================================

Evaluate whether the CURRENT description:

- explains what the product is
- communicates meaningful benefits
- identifies the right customer
- explains style/use
- gives enough information to support purchase
- avoids unsupported claims

========================================================
SEO SCORE
========================================================

Evaluate the CURRENT listing's:

- keyword relevance
- title clarity
- search intent
- natural wording
- meta/SEO readiness
- tag relevance

Do not give a high SEO score simply because keywords
exist.

========================================================
PRODUCT CLARITY
========================================================

The shopper should understand:

- what it is
- who it is for
- its important verified features
- its intended style/use
- why it may be desirable

========================================================
CONVERSION POTENTIAL
========================================================

Evaluate:

- buyer relevance
- benefit communication
- purchase motivation
- trust
- information completeness
- emotional appeal
- differentiation
- purchase readiness

Do not invent:

- reviews
- ratings
- warranties
- guarantees
- certifications
- shipping promises
- durability claims
- water resistance
- movement
- materials
- dimensions

========================================================
SCORE GUIDELINES
========================================================

90–100 = exceptional current listing

80–89 = strong current listing

70–79 = good listing with meaningful improvements

60–69 = average listing with noticeable weaknesses

50–59 = weak listing

40–49 = poor conversion readiness

0–39 = major problems preventing purchase confidence

Use the actual evidence.

========================================================
OVERALL SCORE
========================================================

Overall should represent the CURRENT listing.

Use this approximate weighting:

Title: 20%
Description: 20%
SEO: 15%
Product Clarity: 20%
Conversion Potential: 25%

Do not score the optimized content.

========================================================
TITLE OPTIMIZATION
========================================================

Create a premium ecommerce title.

Prefer approximately 4–8 meaningful words.

Avoid unnecessary repetition.

Avoid supplier names unless legitimately part of the
product identity.

Do not make the title sound like a dropshipping listing.

For men's watches, make the men's positioning clear
when supported by the actual product.

For women's watches, make the women's positioning clear
when supported by the actual product.

For unisex watches, use neutral positioning.

========================================================
DESCRIPTION OPTIMIZATION
========================================================

Create a premium Shopify description.

Focus on:

- what the product is
- who it is for
- verified features
- meaningful benefits
- style
- practical use
- purchase motivation

Use only verified information.

Do not use supplier language.

Never say:

"Dear customer"
"factory direct"
"cheap"
"wholesale"
"AliExpress"
"dropshipping"
"best seller guaranteed"

========================================================
FEATURES
========================================================

Return only verified product features.

Do not turn marketing adjectives into specifications.

========================================================
SPECIFICATIONS
========================================================

Return only specifications explicitly supported by
the product information.

If there are not enough verified specifications,
return fewer specifications rather than inventing them.

========================================================
SEO TITLE
========================================================

Maximum 60 characters.

Must be natural.

Must be relevant to the actual product.

No keyword stuffing.

========================================================
META DESCRIPTION
========================================================

Maximum 160 characters.

Make it useful and compelling.

Accurately describe the actual product.

========================================================
TAGS
========================================================

Return relevant Shopify tags.

Avoid duplicates.

Avoid irrelevant keywords.

Use natural search terms.

========================================================
NO HALLUCINATION
========================================================

Never invent:

- materials
- dimensions
- movement
- water resistance
- certifications
- warranty
- country of origin
- battery life
- power source
- accessories
- compatibility
- performance numbers
- reviews
- ratings
- shipping times
- guarantees

Only use information present in the product context.

========================================================
ANALYSIS
========================================================

Be specific to the actual product.

Identify:

- target customer
- purchase motivation
- strongest verified features
- weaknesses
- missing information
- SEO opportunities
- conversion opportunities

Prioritize the biggest actual problems.

Do not give generic advice such as:

"improve SEO"
"add more details"
"make it better"

Explain exactly what should be improved.

========================================================
OUTPUT
========================================================

Return ONLY the structured JSON object matching the
provided schema.
`;

    /* =====================================================
       7. USER INPUT
    ===================================================== */

    const userInput = `
Analyze this Shopify product.

PRODUCT CONTEXT:

${JSON.stringify(
  productContext,
  null,
  2,
)}

IMPORTANT:

Supplied audience, if provided:
${suppliedAudience || "(not provided)"}

Existing Shopify Product Type:
${productType || "(blank)"}

The Product Type in the optimized result MUST NOT be blank.

The score MUST evaluate the CURRENT listing BEFORE
optimization.

Do not confuse missing information with unsupported
facts.

Determine the target customer from the complete product
evidence.

Do not use generic marketing adjectives as proof of
gender.

Identify the actual barriers to purchase confidence.
`;

    /* =====================================================
       8. MODEL
    ===================================================== */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

    /* =====================================================
       9. OPENAI REQUEST
    ===================================================== */

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

            instructions,

            input:
              userInput,

            text: {
              format: {
                type:
                  "json_schema",

                name:
                  "virello_product_optimization",

                strict:
                  true,

                schema:
                  AI_SCHEMA,
              },
            },
          }),
        },
      );

    /* =====================================================
       10. OPENAI ERROR
    ===================================================== */

    if (!openAIResponse.ok) {
      const errorText =
        await openAIResponse.text();

      console.error(
        "OpenAI API error:",
        errorText,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI could not complete the analysis.",

          details:
            process.env.NODE_ENV ===
            "development"
              ? errorText
              : undefined,
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       11. READ RESPONSE
    ===================================================== */

    const openAIData =
      await openAIResponse.json();

    const outputText =
      extractOutputText(
        openAIData,
      );

    if (!outputText) {
      console.error(
        "OpenAI returned no output:",
        openAIData,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI returned an empty response.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       12. PARSE JSON
    ===================================================== */

    let rawResult: any;

    try {
      rawResult =
        JSON.parse(
          outputText,
        );
    } catch (parseError) {
      console.error(
        "Failed to parse OpenAI JSON:",
        parseError,
        outputText,
      );

      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI returned invalid structured data.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       13. NORMALIZE
    ===================================================== */

    const result =
      normalizeResult(
        rawResult,
      );

    /* =====================================================
       14. PRODUCT TYPE VALIDATION
    ===================================================== */

    if (
      !result.optimization
        .productType
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Virello AI did not return a Product Type.",
        },
        {
          status: 502,
        },
      );
    }

    /* =====================================================
       15. FINAL SEO LIMITS
    ===================================================== */

    result.optimization
      .seoTitle =
      limitCharacters(
        result.optimization
          .seoTitle,
        SEO_TITLE_MAX,
      );

    result.optimization
      .metaDescription =
      limitCharacters(
        result.optimization
          .metaDescription,
        META_DESCRIPTION_MAX,
      );

    /* =====================================================
       16. RETURN
    ===================================================== */

    return NextResponse.json(
      {
        success: true,

        result,

        suppliedAudience,

        productId:
          clean(product.id),

        model,
      },
      {
        status: 200,
      },
    );
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
            : "Unexpected Virello AI error.",
      },
      {
        status: 500,
      },
    );
  }
}
