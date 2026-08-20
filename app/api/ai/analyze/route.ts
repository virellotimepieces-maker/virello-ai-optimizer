import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/* =========================================================
   VIRELLO AI OPTIMIZER
   - AI product analysis
   - AI high-converting optimization
   - Shopify-ready product fields
   - SEO title: MAX 50 characters
   - Meta description: MAX 150 characters
   - No hard-coded product content
   - Image cleanup / watermark-removal action
========================================================= */

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/edits";

const AI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6-luna";

const IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

const SEO_TITLE_MAX = 50;
const META_DESCRIPTION_MAX = 150;

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
  success?: boolean;
  analysis: AIAnalysis;
  score: AIScore;
  optimization: AIOptimization;
  reasoning: string;
};

/* =========================================================
   BASIC HELPERS
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
      const key = value.toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
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

  if (lastSpace >= Math.floor(max * 0.65)) {
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
   OPENAI RESPONSE TEXT
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
   SAFE JSON PARSER
========================================================= */

function parseAIJson(text: string): any {
  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanedText);
  } catch {
    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");

    if (
      firstBrace >= 0 &&
      lastBrace > firstBrace
    ) {
      return JSON.parse(
        cleanedText.slice(
          firstBrace,
          lastBrace + 1,
        ),
      );
    }

    throw new Error(
      "AI returned invalid JSON.",
    );
  }
}

/* =========================================================
   NORMALIZE AI RESULT
========================================================= */

function normalizeResult(raw: any): AIResult {
  const analysis = raw?.analysis || {};
  const score = raw?.score || {};
  const optimization =
    raw?.optimization || {};

  return {
    success: true,

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

      conversionOpportunities: unique(
        Array.isArray(
          analysis.conversionOpportunities,
        )
          ? analysis.conversionOpportunities
          : [],
      ),
    },

    score: {
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
    },

    optimization: {
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
    },

    reasoning: clean(
      raw?.reasoning,
    ),
  };
}

/* =========================================================
   AI SCHEMA
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
   AI INSTRUCTIONS
========================================================= */

function buildInstructions(
  product: ProductInput,
): string {
  return `
You are Virello AI Optimizer.

You are an expert ecommerce product analyst,
Shopify SEO specialist, conversion copywriter,
and premium ecommerce merchandising specialist.

Your job is to analyze the supplied Shopify product
and create a stronger, clearer, more persuasive,
high-converting product listing.

The supplied product information is the SOURCE OF TRUTH.

DO NOT invent specifications, materials, dimensions,
certifications, warranty claims, technical features,
brand claims, water resistance ratings, movement types,
shipping claims, or other facts that are not supported.

If information is missing, identify it as missing instead
of making it up.

========================================================
CORE GOAL
========================================================

Improve:

1. Product clarity
2. Customer appeal
3. Purchase motivation
4. SEO relevance
5. Conversion potential
6. Shopify merchandising quality

The writing should feel premium, natural and trustworthy.

Avoid:

- keyword stuffing
- fake claims
- exaggerated guarantees
- repetitive wording
- spammy titles
- generic AI filler
- unnecessary emojis
- fake urgency
- unsupported technical claims

========================================================
PRODUCT TYPE
========================================================

optimization.productType MUST be specific and useful.

It must describe WHAT THE PRODUCT IS.

Examples only when supported by the product data:

- Men's Watch
- Women's Watch
- Unisex Watch
- Quartz Watch
- Automatic Watch
- Chronograph Watch
- Leather Watch
- Stainless Steel Watch
- Bathroom Faucet
- LED Bathroom Mirror

Do not select an example unless the supplied data supports it.

========================================================
MAIN PRODUCT TITLE
========================================================

Create a natural, premium, high-converting Shopify product title.

Keep it concise.

Lead with the product identity and strongest supported
selling characteristic.

Do not stuff keywords.

========================================================
DESCRIPTION
========================================================

Create a persuasive ecommerce description.

Structure it naturally around:

- what the product is
- why it is appealing
- strongest supported benefits
- important features
- ideal customer/use case
- purchase motivation

Do not invent facts.

========================================================
FEATURES
========================================================

Return only features supported by the supplied information.

Each feature should be concise and useful.

========================================================
SPECIFICATIONS
========================================================

Return only specifications supported by the supplied information.

Do not manufacture measurements or technical details.

========================================================
SEO TITLE
========================================================

IMPORTANT:

seoTitle MUST be 50 CHARACTERS OR LESS.

This is a HARD LIMIT.

Do not exceed 50 characters.

Make it useful for search and attractive to shoppers.

========================================================
META DESCRIPTION
========================================================

IMPORTANT:

metaDescription MUST be 150 CHARACTERS OR LESS.

This is a HARD LIMIT.

Write a natural search snippet with a clear value proposition.

Do not keyword stuff.

========================================================
TAGS
========================================================

Generate relevant Shopify-style product tags.

Use useful search and merchandising concepts.

Avoid duplicate tags.

Avoid meaningless filler tags.

========================================================
ANALYSIS
========================================================

Analyze:

- target customer
- purchase motivation
- strongest features
- weaknesses
- missing information
- SEO opportunities
- conversion opportunities

========================================================
SCORING
========================================================

Score from 0 to 100:

- title
- description
- seo
- productClarity
- conversionPotential
- overall

The score should reflect the CURRENT listing before optimization,
not simply give a high score because the product exists.

========================================================
REASONING
========================================================

Explain briefly why the optimization should improve
clarity, SEO and conversion potential.

Do not expose hidden chain-of-thought.
Return only a concise business explanation.

========================================================
PRODUCT DATA
========================================================

${JSON.stringify(product, null, 2)}
`;
}

/* =========================================================
   ANALYZE PRODUCT
========================================================= */

async function analyzeProduct(
  apiKey: string,
  product: ProductInput,
): Promise<AIResult> {
  const response = await fetch(
    OPENAI_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Authorization:
          `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: AI_MODEL,

        input: [
          {
            role: "system",
            content:
              "You are Virello AI Optimizer. Return only the requested structured JSON.",
          },

          {
            role: "user",
            content:
              buildInstructions(product),
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "virello_product_optimizer",
            strict: true,
            schema: AI_SCHEMA,
          },
        },
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "OpenAI product optimization failed.",
    );
  }

  const outputText =
    extractOutputText(data);

  if (!outputText) {
    throw new Error(
      "OpenAI returned an empty optimization result.",
    );
  }

  const parsed =
    parseAIJson(outputText);

  return normalizeResult(parsed);
}

/* =========================================================
   IMAGE INPUT
========================================================= */

async function imageUrlToFile(
  imageUrl: string,
): Promise<Blob> {
  const response = await fetch(
    imageUrl,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Unable to download the product image.",
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) || "image/png";

  const arrayBuffer =
    await response.arrayBuffer();

  return new Blob(
    [arrayBuffer],
    {
      type: contentType,
    },
  );
}

/* =========================================================
   IMAGE WATERMARK REMOVAL
========================================================= */

async function removeWatermark(
  apiKey: string,
  image: File | Blob,
): Promise<any> {
  const formData = new FormData();

  formData.append(
    "model",
    IMAGE_MODEL,
  );

  formData.append(
    "image",
    image,
    image instanceof File
      ? image.name
      : "product-image.png",
  );

  formData.append(
    "prompt",
    `
Edit this ecommerce product image.

Remove visible text watermarks, supplier branding,
seller logos, promotional overlays, or watermark marks
that are present on the image.

Preserve the actual product exactly as much as possible.

Do not change:
- product shape
- product identity
- product color
- product materials
- product proportions
- product details

Reconstruct the background naturally where watermark
elements were removed.

Do not add a new logo.
Do not add text.
Do not add promotional graphics.

The result should look like a clean professional
ecommerce product photograph.
`,
  );

  formData.append(
    "quality",
    "high",
  );

  const response = await fetch(
    OPENAI_IMAGE_URL,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${apiKey}`,
      },

      body: formData,
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        "Image cleanup failed.",
    );
  }

  return data;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest,
) {
  try {
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

    const body =
      await request.json();

    const action =
      clean(body?.action) ||
      "analyze";

    /* =====================================================
       IMAGE WATERMARK REMOVER
    ===================================================== */

    if (
      action ===
      "remove-watermark"
    ) {
      const imageUrl =
        clean(body?.imageUrl);

      const uploadedImage =
        body?.image;

      let imageFile:
        | File
        | Blob
        | null = null;

      if (
        uploadedImage instanceof File
      ) {
        imageFile =
          uploadedImage;
      }

      if (
        !imageFile &&
        imageUrl
      ) {
        imageFile =
          await imageUrlToFile(
            imageUrl,
          );
      }

      if (!imageFile) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Product image is required.",
          },
          {
            status: 400,
          },
        );
      }

      const result =
        await removeWatermark(
          apiKey,
          imageFile,
        );

      return NextResponse.json(
        {
          success: true,
          action:
            "remove-watermark",
          result,
        },
      );
    }

    /* =====================================================
       PRODUCT OPTIMIZER
    ===================================================== */

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

    const normalizedProduct:
      ProductInput = {
      ...product,

      title:
        clean(product.title),

      description:
        stripHtml(
          product.description,
        ),

      productType:
        clean(
          product.productType,
        ),

      vendor:
        clean(product.vendor),

      price:
        clean(product.price),

      tags:
        unique(
          Array.isArray(
            product.tags,
          )
            ? product.tags
            : [],
        ),

      variants:
        Array.isArray(
          product.variants,
        )
          ? product.variants
          : [],

      images:
        Array.isArray(
          product.images,
        )
          ? product.images
          : [],
    };

    if (
      !normalizedProduct.title
    ) {
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

    const result =
      await analyzeProduct(
        apiKey,
        normalizedProduct,
      );

    /* =====================================================
       FINAL HARD SAFETY LIMITS
    ===================================================== */

    result.optimization.seoTitle =
      limitCharacters(
        result.optimization.seoTitle,
        SEO_TITLE_MAX,
      );

    result.optimization.metaDescription =
      limitCharacters(
        result.optimization
          .metaDescription,
        META_DESCRIPTION_MAX,
      );

    return NextResponse.json(
      result,
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Virello AI Optimizer error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while running Virello AI Optimizer.",
      },
      {
        status: 500,
      },
    );
  }
}
