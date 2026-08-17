import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Audience = "Men" | "Women" | "Unisex";
type Style =
  | "Luxury"
  | "Classic"
  | "Dress"
  | "Sport"
  | "Casual"
  | "Minimal"
  | "Vintage"
  | "Modern"
  | "Fashion"
  | "Other";

type ProductInput = {
  id?: string;
  title?: string;
  description?: string;
  productType?: string;
  tags?: string[] | string;
  vendor?: string;
  status?: string;
  price?: string | number;
  compareAtPrice?: string | number;
  imageUrl?: string;
  image?: string;
  images?: string[];
};

type AnalysisResult = {
  audience: Audience;
  style: Style;

  productTitle: string;
  seoTitle: string;
  metaDescription: string;

  tags: string[];
  productDescription: string;

  targetCustomer: string;
  purchaseMotivation: string;

  keyFeatures: string[];

  scores: {
    overall: number;
    conversion: number;
    seo: number;
    title: number;
    description: number;
    clarity: number;
  };

  reasons: string[];
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function cleanString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

function clampScore(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) return 70;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeAudience(value: unknown): Audience {
  const audience = String(value || "").trim().toLowerCase();

  if (
    audience === "men" ||
    audience === "male" ||
    audience === "men's" ||
    audience === "mens" ||
    audience.includes("men")
  ) {
    return "Men";
  }

  if (
    audience === "women" ||
    audience === "female" ||
    audience === "women's" ||
    audience === "womens" ||
    audience.includes("women")
  ) {
    return "Women";
  }

  return "Unisex";
}

function normalizeStyle(value: unknown): Style {
  const style = String(value || "").trim().toLowerCase();

  const styles: Style[] = [
    "Luxury",
    "Classic",
    "Dress",
    "Sport",
    "Casual",
    "Minimal",
    "Vintage",
    "Modern",
    "Fashion",
    "Other",
  ];

  const match = styles.find(
    (item) => item.toLowerCase() === style
  );

  return match || "Other";
}

/*
 * This function is intentionally conservative.
 *
 * If the original product data clearly says Men's / Men / Male,
 * we do NOT allow the AI to turn it into Women or Unisex.
 */
function detectStrongAudienceSignals(product: ProductInput): Audience | null {
  const text = [
    product.title,
    product.description,
    product.productType,
    product.vendor,
    normalizeTags(product.tags).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const men'sSignals = [
    "men's",
    "mens",
    "men ",
    "for men",
    "male",
    "gentlemen",
    "gentleman's",
    "gents",
    "his watch",
    "men watch",
    "mens watch",
    "men's watch",
  ];

  const women'sSignals = [
    "women's",
    "womens",
    "women ",
    "for women",
    "female",
    "ladies",
    "lady's",
    "her watch",
    "women watch",
    "womens watch",
    "women's watch",
  ];

  const hasMen = men'sSignals.some((signal) => text.includes(signal));
  const hasWomen = women'sSignals.some((signal) => text.includes(signal));

  if (hasMen && !hasWomen) return "Men";
  if (hasWomen && !hasMen) return "Women";

  return null;
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      const possibleJson = cleaned.slice(start, end + 1);
      return JSON.parse(possibleJson) as Record<string, unknown>;
    }

    throw new Error("AI returned invalid JSON.");
  }
}

function fallbackAnalysis(product: ProductInput): AnalysisResult {
  const title = cleanString(product.title) || "Premium Watch";

  const lockedAudience =
    detectStrongAudienceSignals(product) || "Unisex";

  const audiencePhrase =
    lockedAudience === "Men"
      ? "Style-conscious men"
      : lockedAudience === "Women"
        ? "Style-conscious women"
        : "Style-conscious adults";

  const productTitle =
    lockedAudience === "Men"
      ? `${title} Men's Watch`
      : lockedAudience === "Women"
        ? `${title} Women's Watch`
        : `${title} Unisex Watch`;

  const seoTitle = productTitle.slice(0, 50);

  const metaDescription =
    `${audiencePhrase} seeking a refined watch with distinctive styling, reliable quartz movement and versatile everyday appeal.`.slice(
      0,
      150
    );

  return {
    audience: lockedAudience,
    style: "Classic",

    productTitle,
    seoTitle,
    metaDescription,

    tags: [
      lockedAudience === "Men"
        ? "Men's Watch"
        : lockedAudience === "Women"
          ? "Women's Watch"
          : "Unisex Watch",
      "Quartz Watch",
      "Chronograph Watch",
      "Classic Watch",
      "Luxury Style",
    ],

    productDescription:
      `Designed for ${audiencePhrase.toLowerCase()}, this watch combines refined detailing with versatile styling for work, smart-casual outfits and evenings.`,

    targetCustomer:
      `${audiencePhrase} who value polished design, versatile styling and a refined timepiece that works across everyday and dressier occasions.`,

    purchaseMotivation:
      `The customer wants a watch that looks polished and distinctive while remaining versatile enough for regular wear and special occasions.`,

    keyFeatures: [
      "Refined watch design",
      "Versatile everyday styling",
      "Detailed dial presentation",
      "Comfortable bracelet or strap styling",
      "Suitable for multiple occasions",
    ],

    scores: {
      overall: 80,
      conversion: 80,
      seo: 80,
      title: 80,
      description: 80,
      clarity: 80,
    },

    reasons: [
      "Audience classification was based on available product signals.",
      "Content is written around buyer intent rather than keyword stuffing.",
      "SEO fields are kept concise and customer-focused.",
    ],
  };
}

function calculateOverall(scores: {
  conversion: number;
  seo: number;
  title: number;
  description: number;
  clarity: number;
}): number {
  /*
   * Conversion receives the highest weight because a product can have
   * excellent SEO but still have weak selling copy.
   */
  const weighted =
    scores.conversion * 0.25 +
    scores.seo * 0.2 +
    scores.title * 0.15 +
    scores.description * 0.2 +
    scores.clarity * 0.2;

  return clampScore(weighted);
}

function validateAndNormalize(
  raw: Record<string, unknown>,
  product: ProductInput
): AnalysisResult {
  const strongAudience = detectStrongAudienceSignals(product);

  /*
   * IMPORTANT:
   * If source product data clearly identifies gender,
   * that classification wins over the AI.
   */
  const audience = strongAudience || normalizeAudience(raw.audience);

  const rawTags = Array.isArray(raw.tags)
    ? raw.tags
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 12)
    : normalizeTags(raw.tags);

  const genderTag =
    audience === "Men"
      ? "Men's Watch"
      : audience === "Women"
        ? "Women's Watch"
        : "Unisex Watch";

  const tags = Array.from(
    new Set(
      [genderTag, ...rawTags]
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  ).slice(0, 12);

  let productTitle =
    cleanString(raw.productTitle) ||
    cleanString(product.title) ||
    "Premium Watch";

  let seoTitle =
    cleanString(raw.seoTitle) ||
    productTitle;

  /*
   * Never allow an AI title to contradict a locked audience.
   */
  if (audience === "Men") {
    seoTitle = seoTitle
      .replace(/\b(women|women's|womens|ladies|female)\b/gi, "")
      .replace(/\bunisex\b/gi, "Men's")
      .replace(/\s+/g, " ")
      .trim();

    productTitle = productTitle
      .replace(/\b(women|women's|womens|ladies|female)\b/gi, "")
      .replace(/\bunisex\b/gi, "Men's")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\bmen('|’)?s\b/i.test(productTitle)) {
      productTitle = `${productTitle} Men's Watch`;
    }

    if (!/\bmen('|’)?s\b/i.test(seoTitle)) {
      seoTitle = `${seoTitle} Men's`;
    }
  }

  if (audience === "Women") {
    seoTitle = seoTitle
      .replace(/\b(men|men's|mens|gentlemen|male)\b/gi, "")
      .replace(/\bunisex\b/gi, "Women's")
      .replace(/\s+/g, " ")
      .trim();

    productTitle = productTitle
      .replace(/\b(men|men's|mens|gentlemen|male)\b/gi, "")
      .replace(/\bunisex\b/gi, "Women's")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\b(women('|’)?s|ladies)\b/i.test(productTitle)) {
      productTitle = `${productTitle} Women's Watch`;
    }

    if (!/\b(women('|’)?s|ladies)\b/i.test(seoTitle)) {
      seoTitle = `${seoTitle} Women's`;
    }
  }

  if (audience === "Unisex") {
    seoTitle = seoTitle
      .replace(/\b(men|men's|mens|women|women's|womens|ladies|male|female)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    productTitle = productTitle
      .replace(/\b(men|men's|mens|women|women's|womens|ladies|male|female)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!/\bunisex\b/i.test(productTitle)) {
      productTitle = `${productTitle} Unisex Watch`;
    }
  }

  productTitle = productTitle
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  seoTitle = seoTitle
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);

  let metaDescription =
    cleanString(raw.metaDescription) ||
    `Shop a refined ${audience.toLowerCase()} watch designed with versatile styling and polished detailing.`;

  metaDescription = metaDescription
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);

  const scores = {
    conversion: clampScore(
      (raw.scores as Record<string, unknown> | undefined)?.conversion
    ),
    seo: clampScore(
      (raw.scores as Record<string, unknown> | undefined)?.seo
    ),
    title: clampScore(
      (raw.scores as Record<string, unknown> | undefined)?.title
    ),
    description: clampScore(
      (raw.scores as Record<string, unknown> | undefined)?.description
    ),
    clarity: clampScore(
      (raw.scores as Record<string, unknown> | undefined)?.clarity
    ),
  };

  scores.conversion = Math.max(scores.conversion, 0);
  scores.seo = Math.max(scores.seo, 0);
  scores.title = Math.max(scores.title, 0);
  scores.description = Math.max(scores.description, 0);
  scores.clarity = Math.max(scores.clarity, 0);

  const overall = calculateOverall(scores);

  return {
    audience,
    style: normalizeStyle(raw.style),

    productTitle,
    seoTitle,
    metaDescription,

    tags,

    productDescription:
      cleanString(raw.productDescription) ||
      cleanString(product.description) ||
      `A refined ${audience.toLowerCase()} watch designed for versatile everyday styling.`,

    targetCustomer:
      cleanString(raw.targetCustomer) ||
      `Style-conscious ${audience.toLowerCase()} shoppers seeking a versatile and polished timepiece.`,

    purchaseMotivation:
      cleanString(raw.purchaseMotivation) ||
      "The customer wants polished styling, versatility and strong perceived value.",

    keyFeatures: Array.isArray(raw.keyFeatures)
      ? raw.keyFeatures
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],

    scores: {
      overall,
      conversion: scores.conversion,
      seo: scores.seo,
      title: scores.title,
      description: scores.description,
      clarity: scores.clarity,
    },

    reasons: Array.isArray(raw.reasons)
      ? raw.reasons
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY is missing. Add your OpenAI API key to the Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const product: ProductInput =
      body?.product && typeof body.product === "object"
        ? body.product
        : body;

    if (!product || typeof product !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: "Product data is required.",
        },
        { status: 400 }
      );
    }

    const originalAudience = detectStrongAudienceSignals(product);

    const productData = {
      id: product.id || "",
      title: cleanString(product.title),
      description: cleanString(product.description),
      productType: cleanString(product.productType),
      tags: normalizeTags(product.tags),
      vendor: cleanString(product.vendor),
      status: cleanString(product.status),
      price: product.price ?? "",
      compareAtPrice: product.compareAtPrice ?? "",
      imageUrl: cleanString(product.imageUrl || product.image),
      images: Array.isArray(product.images)
        ? product.images.slice(0, 5)
        : [],
    };

    const audienceLockInstruction = originalAudience
      ? `
HARD AUDIENCE RULE:

The original product data contains a strong ${originalAudience} audience signal.

You MUST classify this product as "${originalAudience}".

Do NOT classify it as Women or Unisex if the source clearly indicates Men.
Do NOT classify it as Men or Unisex if the source clearly indicates Women.

Audience accuracy is more important than generic assumptions.
`
      : `
AUDIENCE RULE:

Determine the audience from the actual product evidence.

Use:
- title
- description
- product type
- tags
- vendor
- product context

Do not default to Unisex just because the audience is not explicitly stated.

Only use Unisex when the evidence genuinely supports both genders or does not reasonably support a gender-specific audience.
`;

    const systemPrompt = `
You are Virello AI Optimizer, an expert ecommerce product optimization engine.

Your job is to analyze Shopify products and produce accurate, commercially useful product content.

You are NOT allowed to simply make scores high.
Scores must reflect the actual quality of the generated content.

${audienceLockInstruction}

IMPORTANT AUDIENCE BEHAVIOR:

For watches:
- "Men's", "Mens", "Men", "Male", "Gentlemen", "Gents" strongly indicate Men.
- "Women's", "Womens", "Women", "Female", "Ladies" strongly indicate Women.
- Chronograph, bracelet, stainless steel, sport, luxury or quartz alone do NOT determine gender.
- Never change a clearly men's product into women's content.
- Never write "women" anywhere in a men's target customer profile.
- Never write "men" anywhere in a women's target customer profile.
- If audience is Men, all buyer-facing content must naturally fit men.
- If audience is Women, all buyer-facing content must naturally fit women.
- If Unisex, content must genuinely fit both.

CONTENT RULES:

1. Product title:
   - Clear.
   - Natural.
   - Not keyword stuffed.
   - Prefer 5-10 meaningful words.
   - Put the most important product term early.
   - Include audience when it materially improves clarity.
   - Do not invent technical specifications.

2. SEO title:
   - Maximum 50 characters.
   - Concise.
   - Search-friendly.
   - Avoid keyword stuffing.
   - Do not use unnecessary punctuation.

3. Meta description:
   - Maximum 150 characters.
   - Natural and persuasive.
   - Include important search intent.
   - Do not make unsupported claims.

4. Product description:
   - Customer-facing.
   - Clear.
   - Persuasive but not exaggerated.
   - Focus on benefits and use cases.
   - Do not invent warranty, water resistance, movement type, materials or specifications unless supplied.

5. Tags:
   - Relevant search/category phrases.
   - No duplicates.
   - No irrelevant gender tags.
   - Maximum 12.

6. Target customer:
   - Describe a realistic buyer.
   - Include audience, style preference, occasion and shopping intent.
   - Never contradict the detected audience.

7. Purchase motivation:
   - Explain WHY this customer would buy.
   - Mention style, practicality, versatility, gifting or perceived value only when supported.

8. Key features:
   - Only use information present in the source product data.
   - Never invent specifications.

9. Scores:
   Score each category from 0-100:
   - conversion
   - seo
   - title
   - description
   - clarity

Use these standards:

90-100 = excellent and commercially strong
80-89 = very good
70-79 = acceptable but improvable
60-69 = weak
0-59 = poor

Do not give 90+ simply because the content sounds good.
A score above 90 requires strong evidence that the corresponding field is highly optimized.

10. Overall:
   Overall should represent the combined quality of the five scores.
`;

    const userPrompt = `
Analyze this Shopify product.

PRODUCT DATA:

${JSON.stringify(productData, null, 2)}

Return ONLY valid JSON.

Use exactly this structure:

{
  "audience": "Men | Women | Unisex",
  "style": "Luxury | Classic | Dress | Sport | Casual | Minimal | Vintage | Modern | Fashion | Other",

  "productTitle": "string",
  "seoTitle": "string",
  "metaDescription": "string",

  "tags": [
    "string"
  ],

  "productDescription": "string",

  "targetCustomer": "string",

  "purchaseMotivation": "string",

  "keyFeatures": [
    "string"
  ],

  "scores": {
    "conversion": 0,
    "seo": 0,
    "title": 0,
    "description": 0,
    "clarity": 0
  },

  "reasons": [
    "string"
  ]
}

Remember:
- Audience accuracy is critical.
- If the source clearly says Men's, return "Men".
- Never turn a men's watch into Women or Unisex.
- Never invent product specifications.
- Do not keyword stuff.
- Keep SEO title at 50 characters or less.
- Keep meta description at 150 characters or less.
`;

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:
            process.env.OPENAI_MODEL || "gpt-5.6-luna",
          input: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      }
    );

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();

      console.error(
        "OpenAI API error:",
        openAIResponse.status,
        errorText
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The AI analysis service returned an error.",
          details:
            process.env.NODE_ENV === "development"
              ? errorText
              : undefined,
        },
        { status: 502 }
      );
    }

    const data = await openAIResponse.json();

    const outputText =
      typeof data?.output_text === "string"
        ? data.output_text
        : Array.isArray(data?.output)
          ? data.output
              .flatMap((item: any) =>
                Array.isArray(item?.content)
                  ? item.content
                  : []
              )
              .map((content: any) => content?.text || "")
              .filter(Boolean)
              .join("\n")
          : "";

    if (!outputText) {
      console.error(
        "OpenAI returned no output:",
        JSON.stringify(data)
      );

      return NextResponse.json(
        {
          success: false,
          error: "AI returned an empty analysis.",
        },
        { status: 502 }
      );
    }

    let parsed: Record<string, unknown>;

    try {
      parsed = extractJson(outputText);
    } catch (error) {
      console.error(
        "Failed to parse AI JSON:",
        outputText,
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "AI returned an invalid analysis format.",
        },
        { status: 502 }
      );
    }

    const result = validateAndNormalize(parsed, product);

    /*
     * Final safety check:
     *
     * If source data clearly says Men's, force all gender-sensitive
     * fields to remain Men's.
     */
    if (originalAudience === "Men") {
      result.audience = "Men";

      result.targetCustomer =
        result.targetCustomer
          .replace(
            /\b(women|women's|womens|ladies|female|unisex)\b/gi,
            "men"
          )
          .trim();

      result.purchaseMotivation =
        result.purchaseMotivation
          .replace(
            /\b(women|women's|womens|ladies|female|unisex)\b/gi,
            "men"
          )
          .trim();
    }

    if (originalAudience === "Women") {
      result.audience = "Women";

      result.targetCustomer =
        result.targetCustomer
          .replace(
            /\b(men|men's|mens|gentlemen|male|unisex)\b/gi,
            "women"
          )
          .trim();

      result.purchaseMotivation =
        result.purchaseMotivation
          .replace(
            /\b(men|men's|mens|gentlemen|male|unisex)\b/gi,
            "women"
          )
          .trim();
    }

    return NextResponse.json({
      success: true,
      analysis: result,
    });
  } catch (error) {
    console.error("Virello AI analysis error:", error);

    /*
     * Do not expose internal server details to customers.
     */
    return NextResponse.json(
      {
        success: false,
        error: "Unable to analyze this product.",
      },
      { status: 500 }
    );
  }
}
