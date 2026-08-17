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

function limitCharacters(value: string, max: number): string {
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

  return Math.max(0, Math.min(100, Math.round(number)));
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

  /*
   * Strong fields have priority.
   */

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

  /*
   * Description is secondary evidence.
   */

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

function extractOutputText(data: any): string {
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

function normalizeResult(raw: any): AIResult {
  const analysis = raw?.analysis || {};
  const score = raw?.score || {};
  const optimization = raw?.optimization || {};

  const normalizedScore: AIScore = {
    title: clampScore(score.title),

    description: clampScore(
      score.description,
    ),

    seo: clampScore(score.seo),

    productClarity: clampScore(
      score.productClarity,
    ),

    conversionPotential: clampScore(
      score.conversionPotential,
    ),

    overall: clampScore(score.overall),
  };

  const normalizedOptimization: AIOptimization = {
    title: clean(
      optimization.title,
    ),

    description: clean(
      optimization.description,
    ),

    features: unique(
      Array.isArray(optimization.features)
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
      clean(optimization.seoTitle),
      50,
    ),

    metaDescription: limitCharacters(
      clean(
        optimization.metaDescription,
      ),
      160,
    ),

    tags: unique(
      Array.isArray(optimization.tags)
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
        Array.isArray(analysis.weaknesses)
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

      conversionOpportunities: unique(
        Array.isArray(
          analysis.conversionOpportunities,
        )
          ? analysis.conversionOpportunities
          : [],
      ),
    },

    score: normalizedScore,

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

    const title = clean(
      product.title,
    );

    const description =
      stripHtml(
        clean(product.description),
      );

    const productType =
      clean(product.productType);

    const vendor =
      clean(product.vendor);

    const tags = unique(
      Array.isArray(product.tags)
        ? product.tags
        : [],
    );

    const price =
      clean(product.price);

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
      detectAudience(product);

    /*
     * Backend audience detection is authoritative.
     *
     * Men's watch = Men
     * Women's watch = Women
     * Unknown = Unisex
     */

    const suppliedAudience =
      product.audience ||
      detectedAudience;

    /* -----------------------------------------------------
       5. PRODUCT CONTEXT
    ----------------------------------------------------- */

    const productContext = {
      id: clean(product.id),

      title,

      description,

      productType,

      vendor,

      tags,

      price,

      detectedAudience,

      suppliedAudience,

      suppliedStyle:
        clean(product.style),
    };

    /* -----------------------------------------------------
       6. AI INSTRUCTIONS
    ----------------------------------------------------- */

    const instructions = `
You are Virello AI Optimizer.

You are an expert ecommerce product analyst,
Shopify SEO specialist, conversion copywriter,
and luxury watch merchandising assistant.

Analyze the REAL product information provided
by the merchant.

Do not invent product facts.

========================================================
CRITICAL AUDIENCE RULE
========================================================

The backend detected audience is:

${detectedAudience}

This value is authoritative.

If detectedAudience is "Men":

The product MUST be treated as a MEN'S product.

Never classify it as Women's because of generic
words such as:

fashion
elegant
gift
style
jewelry
luxury
beautiful
classic

If detectedAudience is "Women":

The product MUST be treated as a WOMEN'S product.

If detectedAudience is "Unisex":

Do not force a gender unless the actual product
information supports it.

========================================================
WATCH ANALYSIS
========================================================

For watches, inspect the actual product information
for:

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

NEVER invent specifications.

If a specification is not provided,
do not claim that the product has it.

========================================================
TITLE
========================================================

Create a premium ecommerce title.

Prefer approximately 4–8 meaningful words.

Do not keyword stuff.

Do not unnecessarily repeat words.

Do not use supplier names unless legitimately
present in the product information.

Do not make the title sound like a dropshipping listing.

For men's watches, make the men's positioning
clear when supported by the actual product data.

========================================================
DESCRIPTION
========================================================

Write a premium Shopify description.

Focus on:

- what the product is
- who it is for
- verified benefits
- verified features
- style
- practical use
- purchase motivation

Do not invent specifications.

Do not make unsupported medical,
performance, durability, or certification claims.

Avoid supplier language.

Never use:

Dear customer
best seller guaranteed
cheap
factory direct
AliExpress
wholesale
dropshipping

========================================================
SEO
========================================================

SEO title:

- natural
- concise
- keyword relevant
- maximum 50 characters

Meta description:

- maximum 160 characters
- natural
- compelling
- accurate

Tags:

Create relevant Shopify tags.

Avoid duplicates.

Avoid irrelevant keywords.

========================================================
SCORING
========================================================

Score the current product from 0 to 100.

Evaluate:

Title:
clarity, relevance, readability.

Description:
quality, persuasion, useful information.

SEO:
search relevance and natural keyword usage.

Product clarity:
whether shoppers understand the product.

Conversion potential:
whether the listing gives shoppers enough
confidence and motivation to purchase.

Overall:
overall assessment.

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

Be specific to the actual product.

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

Only use information present in the product context.

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

IMPORTANT:

Detected audience = ${detectedAudience}

The detected audience must not be overridden
by generic words in the description.
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

            input: userInput,

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
        JSON.parse(outputText);
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
       13. AUDIENCE SAFETY CHECK
    ----------------------------------------------------- */

    if (
      detectedAudience === "Men" &&
      /women|female|ladies|woman/i.test(
        result.analysis.targetCustomer,
      )
    ) {
      result.analysis.targetCustomer =
        "Men looking for a premium watch suited to their style and everyday or occasion-based wear.";
    }

    if (
      detectedAudience === "Women" &&
      /men|male|gentlemen|man/i.test(
        result.analysis.targetCustomer,
      )
    ) {
      result.analysis.targetCustomer =
        "Women looking for a stylish watch suited to their personal style and everyday or occasion-based wear.";
    }

    /* -----------------------------------------------------
       14. RETURN RESULT
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
