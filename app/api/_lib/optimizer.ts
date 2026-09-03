import { parseAppLocale, type AppLocale } from "./locales";
import { stripHtml } from "./listing-html";
import { scoreListing, META_DESCRIPTION_MAX, SEO_TITLE_MAX, type ListingScores } from "./listing-score";

export { buildShopifyDescriptionHtml } from "./listing-html";
export type { ListingScores } from "./listing-score";
export { META_DESCRIPTION_MAX, SEO_TITLE_MAX } from "./listing-score";

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
  scores: ListingScores;
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
  return typeof value === "string" ? stripHtml(value).trim() : "";
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const GENERIC_SEO =
  /\b(best|premium|amazing|quality|stunning|exclusive|must[- ]have|perfect gift|top rated|shop now|buy now|deal of|hot sale|luxury lifestyle)\b/i;

function clipAtLimit(value: string, max: number): string {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const sliced = text.slice(0, max).trim();
  const space = sliced.lastIndexOf(" ");
  if (space >= Math.min(36, Math.floor(max * 0.6))) {
    return sliced.slice(0, space).replace(/[,:;.-]+$/, "").trim();
  }
  return sliced.replace(/[,:;.-]+$/, "").trim();
}

function sourceTokens(product?: OptimizerProduct): string[] {
  if (!product) return [];
  return uniqueTexts(
    [product.vendor, product.title, product.productType, ...(product.tags || [])]
      .flatMap((item) => cleanText(item).split(/[^a-zA-Z0-9]+/))
      .filter((token) => token.length >= 4)
  );
}

function looksGenericSeo(value: string, product?: OptimizerProduct): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (GENERIC_SEO.test(text)) return true;
  const tokens = sourceTokens(product);
  if (!tokens.length) return false;
  const lower = text.toLowerCase();
  return !tokens.some((token) => lower.includes(token.toLowerCase()));
}

function productFactLines(product?: OptimizerProduct): string[] {
  if (!product) return [];
  const sentences = cleanText(product.description || "")
    .split(/[.!\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
  return uniqueTexts(
    [
      product.vendor,
      product.productType,
      product.price,
      ...sentences,
      ...(product.options || []),
      ...(product.tags || []),
      ...(product.variants || []).slice(0, 4),
    ]
      .map((item) => cleanText(item))
      .filter((item) => item.length >= 3)
  ).slice(0, 8);
}

function specificSeoTitle(
  candidate: string,
  listingTitle: string,
  product?: OptimizerProduct
): string {
  const preferred = clipAtLimit(candidate, SEO_TITLE_MAX);
  if (preferred && !looksGenericSeo(preferred, product) && preferred.length >= 18) {
    return preferred;
  }
  return clipAtLimit(
    [product?.vendor, listingTitle || product?.title, product?.productType]
      .map((item) => cleanText(item))
      .filter(Boolean)
      .join(" "),
    SEO_TITLE_MAX
  );
}

function specificMetaDescription(
  candidate: string,
  listingTitle: string,
  description: string,
  product?: OptimizerProduct
): string {
  const preferred = clipAtLimit(candidate, META_DESCRIPTION_MAX);
  if (preferred && !looksGenericSeo(preferred, product) && preferred.length >= 70) {
    return preferred;
  }
  return clipAtLimit(
    [listingTitle, description, product?.vendor, product?.productType, product?.price]
      .map((item) => cleanText(item))
      .filter(Boolean)
      .join(". "),
    META_DESCRIPTION_MAX
  );
}

function ensureHighConversionFields(
  result: OptimizationResult,
  source?: OptimizerProduct
): void {
  const facts = productFactLines(source);
  if (result.analysis.strongestFeatures.length === 0 && facts.length) {
    result.analysis.strongestFeatures = facts.slice(0, 6);
  }
  if (result.optimization.benefitBullets.length < 3 && facts.length) {
    result.optimization.benefitBullets = uniqueTexts([
      ...result.optimization.benefitBullets,
      ...facts,
    ]).slice(0, 8);
  }
  result.analysis.benefitBullets = uniqueTexts([
    ...result.optimization.benefitBullets,
    ...result.analysis.benefitBullets,
  ]).slice(0, 8);
  if (!result.analysis.targetCustomer) {
    result.analysis.targetCustomer = clipAtLimit(
      [source?.productType || "Shopify", "shoppers looking for", source?.title || source?.vendor || "this product"]
        .filter(Boolean)
        .join(" "),
      160
    );
  }
  if (!result.analysis.purchaseMotivation) {
    result.analysis.purchaseMotivation =
      result.optimization.benefitBullets[0] || facts[0] || result.optimization.description;
  }
  if (result.analysis.conversionOpportunities.length === 0) {
    result.analysis.conversionOpportunities = uniqueTexts(
      [result.optimization.benefitBullets[0], facts[0], facts[1]].filter(
        (item): item is string => Boolean(item)
      )
    ).slice(0, 4);
  }
  if (!result.optimization.callToAction) {
    result.optimization.callToAction = clipAtLimit(
      ["Choose", source?.vendor || source?.title || "this product", "from the facts on this listing."].join(" "),
      120
    );
  }
  if (!result.optimization.conversionCopy) {
    result.optimization.conversionCopy =
      result.optimization.benefitBullets.slice(0, 2).join(" ") || result.optimization.description;
  }
  if (result.analysis.objections.length === 0) {
    const gap = result.analysis.missingInformation[0] || result.analysis.weaknesses[0];
    if (gap) {
      result.analysis.objections = [
        {
          objection: gap,
          response: `${gap} is not listed on this product, so it is not claimed here.`,
        },
      ];
    }
  }
}

function fallbackDescription(product?: OptimizerProduct): string {
  if (!product) return "";
  const facts = [
    cleanText(product.title),
    cleanText(product.description),
    product.vendor ? `${product.vendor}` : "",
    product.productType,
    product.price ? `${product.price}` : "",
    ...(product.options ?? []).slice(0, 4),
    ...(product.variants ?? []).slice(0, 3),
  ].filter(Boolean);
  return uniqueTexts(facts.filter((item): item is string => Boolean(item))).join(". ").slice(0, 900);
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

export function validateOptimizationResult(
  raw: unknown,
  source?: OptimizerProduct
): OptimizationResult {
  const data = recordOf(raw);
  const analysis = recordOf(data.analysis);
  const optimization = recordOf(data.optimization);

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

  const recoveredTitle = pickText(
    optimization.title,
    optimization.productTitle,
    optimization.listingTitle,
    data.title,
    data.productTitle,
    source?.title
  ).slice(0, 120);
  const recoveredDescription = pickText(
    optimization.description,
    optimization.body,
    optimization.productDescription,
    data.description,
    source?.description,
    fallbackDescription(source)
  );
  if (
    (!cleanText(optimization.title) || !cleanText(optimization.description)) &&
    recoveredTitle &&
    recoveredDescription
  ) {
    warnings.push("AI omitted the title or description; Virello filled it from the product listing.");
  }

  const title = recoveredTitle;
  const description = recoveredDescription;
  const seoTitle = specificSeoTitle(
    pickText(optimization.seoTitle, data.seoTitle, title),
    title,
    source
  );
  const metaDescription = specificMetaDescription(
    pickText(optimization.metaDescription, data.metaDescription, description),
    title,
    description,
    source
  );
  const callToAction = pickText(optimization.callToAction, data.callToAction);
  const conversionCopy = pickText(
    optimization.conversionCopy,
    analysis.conversionCopy,
    data.conversionCopy,
    callToAction,
    benefitBullets[0],
    description
  );

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
      title,
      description,
      benefitBullets,
      seoTitle,
      metaDescription,
      tags: uniqueTexts(cleanArray(optimization.tags)).slice(0, 20),
      keywords: uniqueTexts(cleanArray(optimization.keywords)).slice(0, 20),
      callToAction,
      conversionCopy,
    },
    reasoning: cleanText(data.reasoning),
    scores: {
      overall: 0,
      title: 0,
      description: 0,
      seo: 0,
      conversion: 0,
      grade: "needs_work",
    },
  };

  if (!result.optimization.title || !result.optimization.description) {
    throw new OptimizerError("AI result is missing a product title or description.", 502);
  }
  ensureHighConversionFields(result, source);
  result.optimization.seoTitle = specificSeoTitle(
    result.optimization.seoTitle,
    result.optimization.title,
    source
  );
  result.optimization.metaDescription = specificMetaDescription(
    result.optimization.metaDescription,
    result.optimization.title,
    result.optimization.description,
    source
  );
  result.scores = scoreListing({
    sourceTitle: source?.title || result.optimization.title,
    title: result.optimization.title,
    description: result.optimization.description,
    benefitBullets: result.optimization.benefitBullets,
    seoTitle: result.optimization.seoTitle,
    metaDescription: result.optimization.metaDescription,
    tags: result.optimization.tags,
    callToAction: result.optimization.callToAction,
    conversionCopy: result.optimization.conversionCopy,
    conversionOpportunities: result.analysis.conversionOpportunities,
    objections: result.analysis.objections.length,
    targetCustomer: result.analysis.targetCustomer,
    missingInformation: result.analysis.missingInformation.length,
  });
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
Avoid generic filler such as "best quality", "premium watch", "amazing deal", or "shop now".
SEO title: 50-60 characters, HARD MAX 60. Include the brand or model plus one stated spec. Never generic.
SEO meta description: 140-160 characters, HARD MAX 160. Include two stated facts and a specific CTA with no fake urgency.
analysis.strongestFeatures and optimization.benefitBullets: at least 3 non-empty items from stated facts. Never return empty feature fields when the product has a title, vendor, type, tags, options, or variants.
optimization.title, description, seoTitle, metaDescription, conversionCopy, and callToAction must be non-empty.
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
      const result = validateOptimizationResult(parseModelText(content), product);
      assertGroundedResult(product, result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof OptimizerError) throw lastError;
  throw new OptimizerError("The AI optimizer could not produce a valid result.", 502);
}
