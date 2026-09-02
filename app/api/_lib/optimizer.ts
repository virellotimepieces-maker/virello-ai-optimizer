import { parseAppLocale, type AppLocale } from "./locales";

export { buildShopifyDescriptionHtml } from "./listing-html";

export type OptimizerProduct = {
  id?: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  price?: string;
  handle?: string;
  options?: string[];
  variants?: string[];
};

export type ObjectionResponse = {
  objection: string;
  response: string;
};

export type OptimizationResult = {
  analysis: {
    targetCustomer: string;
    purchaseMotivation: string;
    strongestFeatures: string[];
    benefitBullets: string[];
    weaknesses: string[];
    missingInformation: string[];
    objections: ObjectionResponse[];
    conversionOpportunities: string[];
    warnings: string[];
  };
  optimization: {
    title: string;
    description: string;
    benefitBullets: string[];
    seoTitle: string;
    metaDescription: string;
    tags: string[];
    keywords: string[];
    callToAction: string;
    conversionCopy: string;
  };
  reasoning: string;
};

export class OptimizerError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "OptimizerError";
    this.status = status;
  }
}

type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

let optimizerFetch: FetchLike = fetch as FetchLike;

export function setOptimizerFetchForTests(fn: FetchLike | null): void {
  optimizerFetch = fn ?? (fetch as FetchLike);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanObjections(value: unknown): ObjectionResponse[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const [objection, ...rest] = item.split(":");
        return {
          objection: cleanText(objection),
          response: cleanText(rest.join(":")),
        };
      }
      if (!item || typeof item !== "object") return { objection: "", response: "" };
      const row = item as Record<string, unknown>;
      return {
        objection: cleanText(row.objection || row.concern),
        response: cleanText(row.response || row.answer),
      };
    })
    .filter((row) => row.objection && row.response)
    .slice(0, 8);
}

export function sourceFactText(product: OptimizerProduct): string {
  return [
    product.title,
    product.description,
    product.productType,
    product.vendor,
    product.price,
    product.handle,
    ...(product.tags ?? []),
    ...(product.options ?? []),
    ...(product.variants ?? []),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

const INVENTED_CLAIM =
  /\b(certified|certification|warranty|guarantee|guaranteed|fda|iso\s*\d+|clinically|award[- ]winning|best[- ]seller|#1|star review|verified review|doctor[- ]recommended|medical|clinically proven|money[- ]back|lifetime)\b/i;
const URGENCY_CLAIM =
  /\b(limited time|hurry|act now|while supplies last|only \d+ left|selling fast|in high demand|free shipping|ships today|arrives tomorrow|in stock|low stock|scarce|24[- ]hour)\b/i;
const PRICE_CLAIM = /(?:php|usd|\$|€|₱)\s?\d[\d,]*(?:\.\d+)?/gi;

export function inventedClaimsIn(source: string, generated: string): string[] {
  const issues: string[] = [];
  const sourceLower = source.toLowerCase();
  const generatedLower = generated.toLowerCase();
  for (const pattern of [INVENTED_CLAIM, URGENCY_CLAIM]) {
    const claim = generatedLower.match(pattern);
    if (claim && !sourceLower.includes(claim[0].toLowerCase())) {
      issues.push(`Invented claim: ${claim[0]}`);
    }
  }
  const prices = generated.match(PRICE_CLAIM) || [];
  for (const price of prices) {
    if (!sourceLower.includes(price.toLowerCase()) && !sourceLower.includes(price.replace(/[^\d.]/g, ""))) {
      issues.push(`Invented price: ${price}`);
    }
  }
  return issues;
}

export function validateOptimizationResult(raw: unknown): OptimizationResult {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const analysis = data.analysis && typeof data.analysis === "object" ? (data.analysis as Record<string, unknown>) : {};
  const optimization =
    data.optimization && typeof data.optimization === "object"
      ? (data.optimization as Record<string, unknown>)
      : {};

  const missingInformation = cleanArray(analysis.missingInformation);
  const benefitBullets = uniqueTexts([
    ...cleanArray(optimization.benefitBullets),
    ...cleanArray(analysis.benefitBullets),
  ]).slice(0, 8);
  const warnings = uniqueTexts([
    ...cleanArray(analysis.warnings),
    ...missingInformation.map(
      (item) => `Missing product information: ${item}`
    ),
  ]).slice(0, 12);

  const seoTitle = cleanText(optimization.seoTitle).slice(0, 70);
  const metaDescription = cleanText(optimization.metaDescription).slice(0, 160);

  const result: OptimizationResult = {
    analysis: {
      targetCustomer: cleanText(analysis.targetCustomer),
      purchaseMotivation: cleanText(analysis.purchaseMotivation),
      strongestFeatures: cleanArray(analysis.strongestFeatures).slice(0, 8),
      benefitBullets,
      weaknesses: cleanArray(analysis.weaknesses).slice(0, 8),
      missingInformation,
      objections: cleanObjections(analysis.objections),
      conversionOpportunities: cleanArray(analysis.conversionOpportunities).slice(0, 8),
      warnings,
    },
    optimization: {
      title: cleanText(optimization.title).slice(0, 120),
      description: cleanText(optimization.description),
      benefitBullets,
      seoTitle,
      metaDescription,
      tags: uniqueTexts(cleanArray(optimization.tags)).slice(0, 20),
      keywords: uniqueTexts(cleanArray(optimization.keywords)).slice(0, 20),
      callToAction: cleanText(optimization.callToAction),
      conversionCopy: cleanText(optimization.conversionCopy),
    },
    reasoning: cleanText(data.reasoning),
  };

  if (!result.optimization.title || !result.optimization.description) {
    throw new OptimizerError("AI result is missing a product title or description.", 502);
  }
  return result;
}

function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

export function assertGroundedResult(
  product: OptimizerProduct,
  result: OptimizationResult
): void {
  const source = sourceFactText(product);
  const generated = [
    result.optimization.title,
    result.optimization.description,
    result.optimization.seoTitle,
    result.optimization.metaDescription,
    result.optimization.conversionCopy,
    result.optimization.callToAction,
    result.optimization.tags.join(" "),
    result.optimization.keywords.join(" "),
    result.optimization.benefitBullets.join(" "),
    result.analysis.strongestFeatures.join(" "),
    result.analysis.targetCustomer,
    result.analysis.purchaseMotivation,
    result.analysis.weaknesses.join(" "),
    result.analysis.conversionOpportunities.join(" "),
    result.analysis.objections.map((row) => `${row.objection} ${row.response}`).join(" "),
  ].join(" \n ");
  const issues = inventedClaimsIn(source, generated);
  if (issues.length) {
    throw new OptimizerError(
      `The AI invented details that are not in the product data: ${issues.join("; ")}`,
      422
    );
  }
}

function languageInstruction(outputLocale: AppLocale): string {
  return outputLocale === "fil"
    ? "Write all customer-facing product copy in clear Filipino (Tagalog). Keep brand names and SKUs unchanged."
    : "Write all customer-facing product copy in clear English. Keep brand names and SKUs unchanged.";
}

export function buildOptimizerMessages(
  product: OptimizerProduct,
  outputLocale: AppLocale
): { system: string; user: string } {
  return {
    system: `You are Virello AI Optimizer, a conversion-focused Shopify listing strategist.
Optimize only the supplied Shopify product. Use only facts present in the product title, description, type, vendor, tags, price, options, and variants.
Never invent materials, specifications, discounts, prices, reviews, guarantees, shipping times, stock scarcity, certifications, medical claims, or fake urgency.
If a shopper-facing claim is not in the source, omit it and list it under missingInformation and warnings.
Translate stated features into customer benefits without adding new specs.
Preserve vendor, brand names, and important variant facts.
Avoid generic filler and repetition. Make copy specific to this product and the likely buyer.
Write short mobile-friendly paragraphs and scannable benefit bullets.
SEO title: aim 50-60 characters, never over 70. SEO meta description: aim 140-160 characters, never over 160.
${languageInstruction(outputLocale)}
Return JSON only with:
analysis.targetCustomer,
analysis.purchaseMotivation,
analysis.strongestFeatures (feature → customer benefit, only from stated facts),
analysis.benefitBullets,
analysis.weaknesses,
analysis.missingInformation,
analysis.objections (objects with objection and an honest response that does not invent facts),
analysis.conversionOpportunities,
analysis.warnings,
optimization.title (benefit-driven, not keyword stuffing),
optimization.description (persuasive, short paragraphs),
optimization.benefitBullets,
optimization.seoTitle,
optimization.metaDescription,
optimization.tags,
optimization.keywords,
optimization.callToAction (product-specific, no fake urgency),
optimization.conversionCopy,
reasoning.`,
    user: JSON.stringify(product),
  };
}

function parseModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced?.[1]?.trim() || trimmed;
  return JSON.parse(jsonText);
}

async function callModel(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OptimizerError("OPENAI_API_KEY is not configured.", 500);
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await optimizerFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new OptimizerError("The AI optimizer is unavailable right now.", response.status >= 400 ? response.status : 502);
  }
  let payload: { choices?: Array<{ message?: { content?: string } }> };
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    throw new OptimizerError("The AI optimizer returned an invalid response.", 502);
  }
  const content = payload.choices?.[0]?.message?.content?.trim() || "";
  if (!content) throw new OptimizerError("The AI optimizer returned no optimization result.", 502);
  return content;
}

export async function optimizeProduct(
  product: OptimizerProduct,
  outputLocale: AppLocale = "en"
): Promise<OptimizationResult> {
  if (!cleanText(product.title)) {
    throw new OptimizerError("Product title is required for AI optimization.", 400);
  }
  const locale = parseAppLocale(outputLocale);
  const { system, user } = buildOptimizerMessages(product, locale);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callModel(
        attempt === 0 ? system : `${system}\nRetry: return valid JSON and do not invent facts.`,
        user
      );
      const result = validateOptimizationResult(parseModelText(content));
      assertGroundedResult(product, result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof OptimizerError) throw lastError;
  throw new OptimizerError("The AI optimizer could not produce a valid result.", 502);
}
