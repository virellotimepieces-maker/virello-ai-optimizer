import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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
   HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return String(value || "")
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

function unique(values: string[]): string[] {
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
  value: string,
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
   AUDIENCE DETECTION
========================================================= */

function detectAudience(
  product: ProductInput,
): "Men" | "Women" | "Unisex" {
  const title = clean(product.title).toLowerCase();

  const productType = clean(
    product.productType,
  ).toLowerCase();

  const tags = Array.isArray(product.tags)
    ? product.tags.join(" ").toLowerCase()
    : "";

  const description = stripHtml(
    clean(product.description),
  ).toLowerCase();

  const primaryText = [
    title,
    productType,
    tags,
  ].join(" ");

  const menStrong =
    /\bmen\b|\bmen's\b|\bmens\b|\bgentlemen\b|\bgents\b|\bmale\b|\bman\b/.test(
      primaryText,
    );

  const womenStrong =
    /\bwomen\b|\bwomen's\b|\bwomens\b|\bladies\b|\blady\b|\bfemale\b|\bwoman\b/.test(
      primaryText,
    );

  if (menStrong && !womenStrong) {
    return "Men";
  }

  if (womenStrong && !menStrong) {
    return "Women";
  }

  const menDescription =
    /\bmen\b|\bmen's\b|\bmens\b|\bgentlemen\b|\bgents\b|\bmale\b|\bman\b/.test(
      description,
    );

  const womenDescription =
    /\bwomen\b|\bwomen's\b|\bwomens\b|\bladies\b|\blady\b|\bfemale\b|\bwoman\b/.test(
      description,
    );

  if (menDescription && !womenDescription) {
    return "Men";
  }

  if (womenDescription && !menDescription) {
    return "Women";
  }

  return "Unisex";
}

/* =========================================================
   OPENAI OUTPUT EXTRACTION
========================================================= */

function extractOutputText(
  data: any,
): string {
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output)
    ? data.output
    : [];

  const parts: string[] = [];

  for (const item of output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
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

    productClarity: clampScore(
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
      clean(
        optimization.seoTitle,
      ),
      50,
    ),

    metaDescription:
      limitCharacters(
        clean(
          optimization.metaDescription,
        ),
        160,
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

      purchaseMotivation: clean(
        analysis.purchaseMotivation,
      ),

      strongestFeatures: unique(
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

      missingInformation: unique(
        Array.isArray(
          analysis.missingInformation,
        )
          ? analysis.missingInformation
          : [],
      ),

      seoOpportunities: unique(
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

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
    /* -----------------------------------------------------
       1. API KEY
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       2. REQUEST BODY
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       3. CLEAN PRODUCT DATA
    ----------------------------------------------------- */

    const title =
      clean(product.title);

    const description =
      stripHtml(
        clean(
          product.description,
        ),
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

    /* -----------------------------------------------------
       4. AUDIENCE
    ----------------------------------------------------- */

    const detectedAudience =
      detectAudience(
        product,
      );

    const suppliedAudience =
      product.audience ||
      detectedAudience;

    /* -----------------------------------------------------
       5. PRODUCT CONTEXT
    ----------------------------------------------------- */

    const productContext = {
      id:
        clean(product.id),

      title,

      description,

      productType,

      vendor,

      tags,

      price,

      detectedAudience,

      suppliedAudience,

      suppliedStyle:
        clean(
          product.style,
        ),
    };

    /* -----------------------------------------------------
       6. AI INSTRUCTIONS
    ----------------------------------------------------- */

    const instructions = `
You are Virello AI Optimizer.

You are an expert ecommerce product analyst,
Shopify SEO specialist, conversion copywriter,
and luxury watch merchandising assistant.

Your job is to analyze the REAL product information
provided by the merchant and generate optimized
Shopify product content.

The product information is authoritative.

========================================================
CRITICAL AUDIENCE RULE
========================================================

Audience classification must be accurate.

The detected audience supplied by the backend is:

${detectedAudience}

If detectedAudience is "Men":

You MUST treat the product as a MEN'S product.

Never classify it as Women's because of generic terms
such as:

fashion
elegant
gift
style
jewelry
luxury
beautiful
classic

If the product is explicitly men's, keep the customer
positioning male.

If detectedAudience is "Women", keep the positioning
female.

If detectedAudience is "Unisex", do not force a gender
unless the actual product information supports it.

========================================================
WATCH-SPECIFIC RULES
========================================================

For watches, inspect the real product information for:

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
- luxury positioning
- premium positioning

NEVER invent any of these specifications.

If the information is not provided,
do not claim that the product has it.

========================================================
TITLE RULES
========================================================

Create a clean, premium ecommerce title.

Prefer approximately 4–8 meaningful words.

Do not keyword stuff.

Do not repeat the same word unnecessarily.

Do not use supplier names unless they are part of
the legitimate product information.

Do not make the title sound like a dropshipping listing.

For men's watches, the title should make the men's
positioning clear when supported by the product.

========================================================
DESCRIPTION RULES
========================================================

Write a premium Shopify product description.

Focus on:

- what the product is
- who it is for
- strongest verified benefits
- important verified features
- style
- practical use
- purchase motivation

The description should help a shopper make a
purchase decision.

Use clear, confident, premium language.

Do not invent specifications.

Do not make unsupported medical,
performance, durability, or certification claims.

Avoid supplier language.

Avoid phrases such as:

"Dear customer"
"best seller guaranteed"
"cheap"
"factory direct"
"AliExpress"
"wholesale"
"dropshipping"

========================================================
SEO RULES
========================================================

SEO title:

- concise
- natural
- keyword relevant
- maximum 50 characters

Meta description:

- maximum 160 characters
- natural
- compelling
- accurately describes the product

Tags:

Create relevant Shopify tags.

Avoid duplicate tags.

Avoid irrelevant keywords.

========================================================
CONVERSION SCORING FRAMEWORK
========================================================

Score the CURRENT product listing honestly from 0 to 100.

The conversion score must measure how effectively
the CURRENT listing could persuade a qualified shopper
to consider purchasing.

Do NOT give a high score simply because the product
sounds premium.

Evaluate all of the following:

1. PRODUCT VALUE CLARITY

Does the shopper quickly understand:

- what the product is
- who it is for
- why it is desirable
- what makes it useful or distinctive

2. BUYER RELEVANCE

Does the listing clearly speak to the correct audience?

For a men's watch:

- keep the positioning male
- do not describe the target customer as women
- do not use generic unisex positioning when the product
  information clearly identifies it as men's

3. BENEFIT COMMUNICATION

Does the listing explain meaningful buyer benefits
rather than simply listing features?

4. TRUST

Does the available product information give shoppers
confidence?

Only use information actually provided.

Never invent:

- warranty
- certifications
- reviews
- ratings
- guarantees
- shipping promises
- durability claims
- water resistance
- materials
- movement
- performance numbers

5. PURCHASE MOTIVATION

Does the listing provide a legitimate reason for the
target shopper to want the product?

For watches, possible motivations include:

- refined everyday style
- professional appearance
- occasion wear
- gift suitability
- classic styling
- versatile wardrobe pairing

Only use motivations supported by the actual product.

6. PRODUCT CLARITY

Can a shopper understand the product without guessing?

7. INFORMATION COMPLETENESS

Identify important missing information that could prevent
a confident purchase.

8. EMOTIONAL APPEAL

Does the copy communicate the style, identity, or lifestyle
benefit relevant to the actual target customer?

9. PURCHASE READINESS

Does the listing naturally move the shopper toward purchase
without aggressive or misleading claims?

10. DIFFERENTIATION

Does the listing communicate what makes the product
distinctive based on the real product information?

========================================================
CONVERSION SCORE INTERPRETATION
========================================================

90–100:
Exceptional listing with strong clarity, relevance,
verified benefits, trust, differentiation, and purchase
motivation.

80–89:
Strong listing with only minor conversion gaps.

70–79:
Good listing but several improvements are possible.

60–69:
Average listing with noticeable conversion weaknesses.

50–59:
Weak listing with important missing information or
weak purchase motivation.

40–49:
Poor conversion readiness. The shopper may understand
the product but lacks enough compelling information,
clarity, trust, differentiation, or purchase motivation.

0–39:
Very poor listing with major problems preventing
purchase confidence.

Do not automatically give 80–100.

Be honest about the current listing.

========================================================
PRODUCT CLARITY SCORING
========================================================

Product clarity should evaluate whether a shopper can
quickly understand:

- what the product is
- who it is for
- its main verified features
- its intended style or use
- why the shopper should care

If important product information is missing,
reduce the clarity score.

========================================================
OVERALL SCORE
========================================================

The overall score must represent the CURRENT product
listing.

Consider:

- title quality
- description quality
- SEO quality
- product clarity
- conversion potential

Do not inflate the overall score.

========================================================
ANALYSIS
========================================================

Identify:

- target customer
- purchase motivation
- strongest features
- weaknesses
- missing information
- SEO opportunities
- conversion opportunities

Be specific to this actual product.

Do not give generic advice when product-specific
information is available.

========================================================
CONVERSION OPPORTUNITIES
========================================================

Provide specific improvements that could increase
purchase confidence and conversion potential.

Prioritize the biggest weaknesses first.

Do not give generic advice such as:

"make it better"
"add more details"
"improve SEO"

Instead explain exactly what information or copy
should be improved based on the actual product.

========================================================
NO HALLUCINATION
========================================================

Never invent:

- materials
- dimensions
- movement type
- water resistance
- certifications
- warranty
- country of origin
- battery life
- power source
- included accessories
- compatibility
- performance numbers
- reviews
- ratings
- shipping times
- guarantees

Only use information present in the product context.

========================================================
OPTIMIZATION
========================================================

The optimized product content must improve:

- clarity
- buyer relevance
- benefits
- purchase motivation
- SEO
- premium presentation

The optimized version must still use only verified
product information.

Never add unsupported specifications simply to make
the listing sound more impressive.

========================================================
OUTPUT
========================================================

Return only the requested structured data.
`;

    /* -----------------------------------------------------
       7. USER INPUT
    ----------------------------------------------------- */

    const userInput = `
Analyze this Shopify product.

PRODUCT CONTEXT:

${JSON.stringify(
  productContext,
  null,
  2,
)}

Remember:

Detected audience = ${detectedAudience}

The detected audience must not be overridden by
generic words in the description.

The conversion score must evaluate the CURRENT
product listing, not the optimized version.

Identify the biggest actual barriers to purchase
confidence.
`;

    /* -----------------------------------------------------
       8. OPENAI REQUEST
    ----------------------------------------------------- */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";

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

    /* -----------------------------------------------------
       9. OPENAI ERROR
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       10. READ OPENAI RESPONSE
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       11. PARSE JSON
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       12. NORMALIZE RESULT
    ----------------------------------------------------- */

    const result =
      normalizeResult(
        rawResult,
      );

    /* -----------------------------------------------------
       13. SAFETY CHECKS
    ----------------------------------------------------- */

    if (
      detectedAudience ===
        "Men" &&
      /women|female|ladies|woman/i.test(
        result.analysis
          .targetCustomer,
      )
    ) {
      result.analysis
        .targetCustomer =
        "Men looking for a premium watch suited to their style and everyday or occasion-based wear.";
    }

    if (
      detectedAudience ===
        "Women" &&
      /men|male|gentlemen|man/i.test(
        result.analysis
          .targetCustomer,
      )
    ) {
      result.analysis
        .targetCustomer =
        "Women looking for a stylish watch suited to their personal style and everyday or occasion-based wear.";
    }

    /* -----------------------------------------------------
       14. RETURN
    ----------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        result,

        detectedAudience,

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
