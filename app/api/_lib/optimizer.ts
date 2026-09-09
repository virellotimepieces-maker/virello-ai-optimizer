import { parseAppLocale, type AppLocale } from "./locales";
import { stripHtml } from "./listing-html";
import { scoreListing, META_DESCRIPTION_MAX, SEO_TITLE_MAX, capFallbackScores, capBrokenGrammarScores, clipAtWordLimit, type ListingScores } from "./listing-score";
import {
  applyCopyGuards,
  factualConversionCopy,
  genuineProductHaystack,
  hasCheapLanguage,
  hasDropshippingLanguage,
  hasInternalInstruction,
  hasReviewSuggestion,
  hasValueHypeLanguage,
  listingFacts,
  publishableCopy,
  sanitizeProductSource,
  shopContentLeakTokens,
  stripShopLeaks,
} from "./optimizer-copy";
import {
  collectCopyQualityIssues,
  detectCopyQualityIssues,
  resultQualityFields,
} from "./copy-quality";
import {
  merchantFactHaystack,
  merchantFactsMissingFromText,
  hasMerchantFacts,
  parseMerchantFacts,
  type MerchantFacts,
} from "./merchant-facts";
import {
  brandVoiceInstruction,
  DEFAULT_BRAND_VOICE,
  parseBrandVoice,
  type BrandVoice,
} from "./brand-voice";

export { buildShopifyDescriptionHtml } from "./listing-html";
export type { ListingScores } from "./listing-score";
export { META_DESCRIPTION_MAX, SEO_TITLE_MAX } from "./listing-score";
export type { BrandVoice } from "./brand-voice";
export { DEFAULT_BRAND_VOICE, parseBrandVoice } from "./brand-voice";

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
  merchantFacts?: MerchantFacts;
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
  /\b(best|premium|amazing|quality|stunning|exclusive|must[- ]have|perfect gift|top rated|shop now|buy now|deal of|hot sale|luxury lifestyle|elevate your|game changer|budget[- ]friendly|affordable elegance|affordable luxury|priced at just)\b/i;

function clipAtLimit(value: string, max: number): string {
  return clipAtWordLimit(value, max);
}

function sourceTokens(product?: OptimizerProduct, shop?: string): string[] {
  if (!product) return [];
  const leaks = new Set(shopContentLeakTokens(shop).map((item) => item.toLowerCase()));
  return uniqueTexts(
    [product.vendor, product.title, product.productType, ...(product.tags || [])]
      .flatMap((item) => cleanText(item).split(/[^a-zA-Z0-9]+/))
      .filter((token) => token.length >= 4 && !leaks.has(token.toLowerCase()))
  );
}

function listingVendor(product?: OptimizerProduct, shop?: string): string {
  return stripShopLeaks(cleanText(product?.vendor || ""), product, shop);
}

function looksGenericSeo(
  value: string,
  product?: OptimizerProduct,
  shop?: string
): boolean {
  const text = cleanText(value);
  if (!text) return true;
  if (GENERIC_SEO.test(text)) return true;
  const tokens = sourceTokens(product, shop);
  if (!tokens.length) return false;
  const lower = text.toLowerCase();
  return !tokens.some((token) => lower.includes(token.toLowerCase()));
}

function productFactLines(product?: OptimizerProduct, shop?: string, includePrice = false): string[] {
  return listingFacts(product, shop, includePrice);
}

function specificSeoTitle(
  candidate: string,
  listingTitle: string,
  product?: OptimizerProduct,
  shop?: string
): string {
  const preferred = clipAtLimit(candidate, SEO_TITLE_MAX);
  if (preferred && !looksGenericSeo(preferred, product, shop) && preferred.length >= 18) {
    return preferred;
  }
  const listing = cleanText(listingTitle || product?.title || "");
  const type = cleanText(product?.productType || "");
  return clipAtLimit(
    [listingVendor(product, shop), listing, type && !listing.toLowerCase().includes(type.toLowerCase()) ? type : ""]
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
  product?: OptimizerProduct,
  shop?: string
): string {
  const preferred = clipAtLimit(candidate, META_DESCRIPTION_MAX);
  const preferredWords = preferred.split(/\s+/).filter(Boolean).length;
  if (preferred && !looksGenericSeo(preferred, product, shop) && preferredWords >= 8) {
    return preferred;
  }
  if (preferred && preferredWords >= 8 && preferred.length >= 40) {
    return preferred;
  }
  const fallback = clipAtLimit(
    [listingTitle, listingVendor(product, shop), product?.productType]
      .map((item) => cleanText(item))
      .filter(Boolean)
      .join(" "),
    META_DESCRIPTION_MAX
  );
  return preferredWords >= wordCountSafe(fallback) ? preferred || fallback : fallback || preferred;
}

function wordCountSafe(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function ensureHighConversionFields(
  result: OptimizationResult,
  source?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): void {
  const facts = productFactLines(source, shop, voice === "value");
  if (result.analysis.strongestFeatures.length === 0 && facts.length) {
    result.analysis.strongestFeatures = facts.slice(0, 6);
  }
  if (!result.optimization.benefitBullets.length && facts.length) {
    result.optimization.benefitBullets = facts.slice(0, 4);
  }
  result.analysis.benefitBullets = result.optimization.benefitBullets.slice(0, 8);
  if (!result.analysis.targetCustomer) {
    result.analysis.targetCustomer = clipAtLimit(
      ["Shoppers considering", source?.productType || source?.title || "this product", "from the listed facts."]
        .filter(Boolean)
        .join(" "),
      160
    );
  }
  if (!result.analysis.purchaseMotivation) {
    result.analysis.purchaseMotivation =
      result.optimization.benefitBullets[0] || facts[0] || "Only listed product facts are available.";
  }
  if (result.analysis.conversionOpportunities.length === 0) {
    result.analysis.conversionOpportunities = [
      "Lead with verified product facts only.",
      "Keep missing specifications in merchant notes.",
    ];
  }
  if (!result.optimization.callToAction) {
    result.optimization.callToAction = clipAtLimit(
      ["Review the listed details for", listingVendor(source, shop) || source?.title || "this product."].join(" "),
      120
    );
  }
  if (!result.optimization.conversionCopy || hasInternalInstruction(result.optimization.conversionCopy) || /\blists\s+(?:introducing|the)\b/i.test(result.optimization.conversionCopy) || /^this product has\b/i.test(result.optimization.conversionCopy)) {
    result.optimization.conversionCopy = factualConversionCopy(source, shop);
  }
  if (result.analysis.objections.length === 0) {
    const gap = result.analysis.missingInformation[0] || result.analysis.weaknesses[0];
    if (gap) {
      result.analysis.objections = [
        {
          objection: gap,
          response: `${gap} It is not claimed in the customer-facing copy.`,
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
    merchantFactHaystack(product.merchantFacts),
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
    merchantFactHaystack(product.merchantFacts),
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

const INVENTED_CLAIM =
  /\b(certified|certification|warranty|guarantee|guaranteed|fda|iso\s*\d+|clinically|award[- ]winning|best[- ]seller|#1|star review|verified review|doctor[- ]recommended|medical|clinically proven|money[- ]back|lifetime)\b/i;
const URGENCY_CLAIM =
  /\b(limited time|hurry|act now|while supplies last|only \d+ left|selling fast|in high demand|free shipping|ships today|arrives tomorrow|in stock|low stock|scarce|24[- ]hour)\b/i;
const DURABILITY_CLAIM =
  /\b(durable|durability|scratch[- ]proof|waterproof|water[- ]resistant|rust[- ]proof|unbreakable|built to last|heavy[- ]duty|indestructible)\b/i;
const REVIEW_CLAIM =
  /\b(\d+\s*[- ]star|customers love|highly rated|top rated|bestseller|best seller|reviews? say)\b/i;
const MATERIAL_CLAIM =
  /\b(titanium|ceramic|carbon fiber|platinum|sterling silver|genuine leather|solid gold|18k|14k|sapphire crystal|mineral glass|stainless steel|brass|bronze|nylon|silicone|gold plated)\b/i;
const QUALITY_CLAIM =
  /\b(high[- ]quality|premium quality|superior quality|excellent quality|top quality|finest quality)\b/i;
const LIFESTYLE_CLAIM =
  /\b(everyday wear|daily wear|date night|weekend wear|perfect gift|gift for (?:him|her|them)|any occasion)\b/i;
const PRICE_CLAIM = /(?:php|usd|\$|€|₱)\s?\d[\d,]*(?:\.\d+)?/gi;

function normalizeClaimText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function claimSupportedBySource(claim: string, source: string): boolean {
  const hay = normalizeClaimText(source);
  const needle = normalizeClaimText(claim);
  if (!needle) return true;
  if (hay.includes(needle)) return true;
  const stem = needle.replace(/(?:ing|ed|s|ant|ance|ent|ence)$/g, "").trim();
  if (stem.length >= 8 && hay.includes(stem)) return true;
  if (/water\s*resist/.test(needle) && /water\s*resist|splash\s*resist|\batm\b|\bmetres?\b|\bmeters?\b/.test(hay)) {
    return true;
  }
  if (/splash\s*resist/.test(needle) && /splash\s*resist|water\s*resist|\batm\b|\bmetres?\b|\bmeters?\b/.test(hay)) {
    return true;
  }
  if (needle === "waterproof") return /\bwaterproof\b/.test(hay);
  return false;
}

export function inventedClaimsIn(source: string, generated: string): string[] {
  const issues: string[] = [];
  const generatedLower = generated.toLowerCase();
  for (const pattern of [
    INVENTED_CLAIM,
    URGENCY_CLAIM,
    DURABILITY_CLAIM,
    REVIEW_CLAIM,
    MATERIAL_CLAIM,
    QUALITY_CLAIM,
    LIFESTYLE_CLAIM,
  ]) {
    const matches = generatedLower.match(new RegExp(pattern, "gi")) || [];
    for (const claim of matches) {
      if (!claimSupportedBySource(claim, source)) {
        issues.push(`Invented claim: ${claim}`);
      }
    }
  }
  const sourceLower = source.toLowerCase();
  const prices = generated.match(PRICE_CLAIM) || [];
  for (const price of prices) {
    if (!sourceLower.includes(price.toLowerCase()) && !sourceLower.includes(price.replace(/[^\d.]/g, ""))) {
      issues.push(`Invented price: ${price}`);
    }
  }
  return uniqueTexts(issues);
}

export function validateOptimizationResult(
  raw: unknown,
  source?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE,
  options: { fallback?: boolean } = {}
): OptimizationResult {
  const cleanedSource = source ? sanitizeProductSource(source, shop) : source;
  const data = recordOf(raw);
  const analysis = recordOf(data.analysis);
  const optimization = recordOf(data.optimization);

  const missingInformation = cleanArray(analysis.missingInformation);
  const benefitBullets = uniqueTexts(cleanArray(optimization.benefitBullets)).slice(0, 8);
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
    cleanedSource?.title
  ).slice(0, 120);
  const recoveredDescription = options.fallback
    ? pickText(recoveredTitle, cleanedSource?.title, "Product")
    : pickText(
        optimization.description,
        optimization.body,
        optimization.productDescription,
        data.description,
        cleanedSource?.description,
        fallbackDescription(cleanedSource)
      );
  if (
    !options.fallback &&
    !hasMerchantFacts(cleanedSource?.merchantFacts) &&
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
    cleanedSource,
    shop
  );
  const metaDescription = specificMetaDescription(
    pickText(optimization.metaDescription, data.metaDescription, description),
    title,
    description,
    cleanedSource,
    shop
  );
  const callToAction = pickText(optimization.callToAction, data.callToAction);
  const conversionCopy = pickText(
    optimization.conversionCopy,
    data.conversionCopy
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
  applyCopyGuards(result, cleanedSource, shop, voice, options);
  ensureHighConversionFields(result, cleanedSource, shop, voice);
  applyCopyGuards(result, cleanedSource, shop, voice, options);
  result.optimization.seoTitle = specificSeoTitle(
    result.optimization.seoTitle,
    result.optimization.title,
    cleanedSource,
    shop
  );
  result.optimization.metaDescription = specificMetaDescription(
    result.optimization.metaDescription,
    result.optimization.title,
    result.optimization.description,
    cleanedSource,
    shop
  );
  applyCopyGuards(result, cleanedSource, shop, voice, options);
  result.scores = scoreListing({
    sourceTitle: cleanedSource?.title || result.optimization.title,
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
  if (options.fallback) {
    result.scores = capFallbackScores(
      result.scores,
      result.analysis.missingInformation.length
    );
  }
  if (collectCopyQualityIssues(resultQualityFields(result), cleanedSource).length) {
    result.scores = capBrokenGrammarScores(result.scores);
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

function rawPublishableText(raw: unknown): string {
  const data = recordOf(raw);
  const optimization = recordOf(data.optimization);
  const asLines = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return [
    optimization.title,
    optimization.description,
    ...asLines(optimization.benefitBullets),
    optimization.seoTitle,
    optimization.metaDescription,
    ...asLines(optimization.tags),
    ...asLines(optimization.keywords),
    optimization.callToAction,
    optimization.conversionCopy,
  ]
    .map((item) => cleanText(item))
    .filter(Boolean)
    .join(" \n ");
}

function assertRawModelCopy(product: OptimizerProduct, raw: unknown): void {
  const generated = rawPublishableText(raw);
  const issues = inventedClaimsIn(sourceFactText(product), generated).filter(
    (issue) => !/^Invented price:/i.test(issue)
  );
  if (hasInternalInstruction(generated)) {
    issues.push("Internal instruction leaked into customer copy");
  }
  const qualityIssues = detectCopyQualityIssues(generated);
  if (qualityIssues.length) {
    issues.push(`Copy quality failed: ${qualityIssues.join("; ")}`);
  }
  const omitted = merchantFactsMissingFromText(product.merchantFacts, generated);
  if (omitted.length) {
    issues.push(`Omitted listed specifications: ${omitted.join(", ")}`);
  }
  if (issues.length) {
    throw new OptimizerError(
      `The AI invented details that are not in the product data: ${issues.join("; ")}`,
      422
    );
  }
}

export function assertGroundedResult(
  product: OptimizerProduct,
  result: OptimizationResult,
  shop?: string
): void {
  const cleaned = sanitizeProductSource(product, shop);
  const source = sourceFactText(cleaned);
  const generated = publishableCopy(result);
  const qualityIssues = collectCopyQualityIssues(resultQualityFields(result), cleaned);
  if (qualityIssues.length) {
    throw new OptimizerError(`Copy quality failed: ${qualityIssues.join("; ")}`, 422);
  }
  const issues = inventedClaimsIn(source, generated);
  if (hasInternalInstruction(generated)) {
    issues.push("Internal instruction leaked into customer copy");
  }
  if (hasDropshippingLanguage(generated)) {
    issues.push("Dropshipping language");
  }
  if (hasCheapLanguage(generated)) {
    issues.push("Negative cheap-quality language");
  }
  if (hasReviewSuggestion(generated) && !/\breview/i.test(source)) {
    issues.push("Review suggestion without review data");
  }
  if (hasValueHypeLanguage(generated)) {
    issues.push("Generic value-hype language");
  }
  const hay = genuineProductHaystack(cleaned);
  for (const token of shopContentLeakTokens(shop)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const leak = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
    if (leak.test(generated) && !hay.includes(token.toLowerCase())) {
      issues.push(`Invented claim: ${token}`);
    }
  }
  const omitted = merchantFactsMissingFromText(cleaned.merchantFacts, generated);
  if (omitted.length) {
    issues.push(`Omitted listed specifications: ${omitted.join(", ")}`);
  }
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
  outputLocale: AppLocale,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): { system: string; user: string } {
  return {
    system: `You are Virello AI Optimizer, writing customer-facing copy for an established specialty retailer.
Optimize only the supplied Shopify product. Use every valid fact in the product title, description, type, vendor, tags, price, options, variants, and merchantFacts. Never invent a fact that is not in that source.
Dropshipping language, value-hype, shop-now CTAs, and similar marketing filler already present in the source are dirty text to ignore, not verified product facts.
Default to polished, credible, brand-neutral retail English. Never sound like dropshipping, marketplace spam, or hype ads.
${brandVoiceInstruction(voice)}
Never invent materials, specifications, discounts, prices, reviews, guarantees, shipping times, stock scarcity, certifications, medical claims, lifestyle uses, quality judgments, or fake urgency.
Never describe the product as cheap, low-quality, questionable, lacking durability, or similar. Merchant objections must be neutral notes about missing facts, never insults to the product.
Do not make low price the main benefit unless the brand voice is value-focused, and even then mention a listed price at most once.
For refined, minimal, warm, or bold voice, never use price-led or generic value phrasing, including affordable elegance, affordable luxury, budget-friendly, priced at just, and close variants.
Never suggest displaying customer reviews or ratings unless review data is in the source.
If a shopper-facing claim is not in the source, omit it and list it under missingInformation and warnings.
Repeat every merchantFacts value in optimization.description and optimization.conversionCopy. Numeric facts (sizes, ATM, warranty years) must keep at least one listed number.
Do not list vendor or brand name as missing when product.vendor is present. Do not treat style, color, or variant options as score-limiting missing facts.
If the listing is sparse, write concise factual copy, name the missing details in analysis.missingInformation, and warn that the listing score is limited by those gaps. Do not pad copy to inflate scores.
Never use a Shopify shop domain, a *.myshopify.com handle, or "virello-dev" as a brand, feature, benefit, CTA, tag, or keyword unless that exact text appears in the product title, description, type, tags, options, variants, or merchantFacts.
Banned phrases and close variants include: elevate your game/look, your new favorite, must-have, game changer, affordable elegance, affordable luxury, budget-friendly, priced at just, without breaking the bank, perfect for everyone, shop now, buy now.
Do not emit malformed fragments (for example roman-numeral slash phrases like "II/Affordable"), duplicated sentences, truncated titles, or copy pasted into the wrong field.
Write optimization.title, description, benefitBullets, callToAction, seoTitle, metaDescription, tags, and keywords independently. Do not copy the same sentence across those fields.
analysis.* fields are internal merchant notes only and must never be repeated in optimization.* customer copy.
Never write "Use these listed facts in the customer copy", "Customer copy:", "Use these facts", system messages, or validation notes inside optimization.* fields.
Every customer-facing sentence must be complete. Never write dangling conjunctions or prepositions, duplicated connectors, duplicated punctuation, or fragments such as "Ideal for and various occasions."
Merchant warnings must name a specific missing field the merchant can add. Never write vague notes such as "lack of comprehensive brand identity" or "limited product details may affect purchasing decisions" when vendor or product type is already listed.
Fill optimization.tags and optimization.keywords with useful terms from stated product facts. Do not leave them empty when the product has a title, vendor, type, tags, options, or variants.
SEO title: HARD MAX 60 characters. Prefer 50-60 only when enough stated facts exist. Never pad with generic words.
SEO meta description: HARD MAX 160 characters. Prefer 140-160 only when two stated facts exist. Never invent or pad.
optimization.callToAction must be restrained (for example "Review the listed details") and must not use shop now or buy now.
${languageInstruction(outputLocale)}
Return JSON only with:
analysis.targetCustomer,
analysis.purchaseMotivation,
analysis.strongestFeatures (verified facts only),
analysis.benefitBullets,
analysis.weaknesses (neutral missing-fact notes, never cheap/low-quality language),
analysis.missingInformation,
analysis.objections (objects with objection and a neutral response that does not invent facts or disparage the product),
analysis.conversionOpportunities,
analysis.warnings,
optimization.title,
optimization.description (restrained retail paragraphs from verified facts only),
optimization.benefitBullets,
optimization.seoTitle,
optimization.metaDescription,
optimization.tags,
optimization.keywords,
optimization.callToAction,
optimization.conversionCopy (merchant-facing summary of listed facts, not dropshipping),
reasoning.`,
    user: JSON.stringify(product),
  };
}

function retrySystemPrompt(
  system: string,
  error: unknown,
  product: OptimizerProduct
): string {
  const reason =
    error instanceof Error
      ? error.message.replace(/\s+/g, " ").trim().slice(0, 500)
      : "The previous result failed schema or grounding validation.";
  const verified = {
    title: product.title,
    description: product.description,
    productType: product.productType,
    vendor: product.vendor,
    tags: product.tags || [],
    options: product.options || [],
    variants: product.variants || [],
    merchantFacts: parseMerchantFacts(product.merchantFacts),
  };
  return `${system}
Retry: the previous result failed validation.
Validation failures: ${reason}
Verified product facts: ${JSON.stringify(verified)}
Ignore dropshipping or value-hype language in the source; it is not a product fact. Use only verified title, type, vendor, description facts, options, variants, tags, and merchantFacts. Do not invent details. Do not use dropshipping, affordable elegance, budget-friendly, priced at just, shop now, or buy now.
Do not put prompts, system messages, validation notes, or labels such as "Use these facts" or "Customer copy" in optimization.* fields.
Rewrite incomplete phrases, dangling and/or, sentence fragments, and duplicated punctuation. Do not use vague brand-identity warnings.`;
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
    throw new OptimizerError("AI optimization is not configured.", 500);
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

export function buildSafeFallbackResult(
  product: OptimizerProduct,
  shop = "",
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): OptimizationResult {
  const cleaned = sanitizeProductSource(
    { ...product, merchantFacts: parseMerchantFacts(product.merchantFacts) },
    shop
  );
  const result = validateOptimizationResult(
    {
      analysis: {
        warnings: [
          "The AI could not produce grounded copy, so Virello wrote a factual draft from listed product data only.",
        ],
        missingInformation: [],
      },
      optimization: {
        title: cleaned.title,
        description: cleaned.title,
      },
    },
    cleaned,
    shop,
    voice,
    { fallback: true }
  );
  if (
    !result.analysis.warnings.some((item) => /could not produce grounded copy/i.test(item))
  ) {
    result.analysis.warnings = uniqueTexts([
      "The AI could not produce grounded copy, so Virello wrote a factual draft from listed product data only.",
      ...result.analysis.warnings,
    ]).slice(0, 8);
  }
  const missingFacts = merchantFactsMissingFromText(
    cleaned.merchantFacts,
    publishableCopy(result)
  );
  if (missingFacts.length) {
    result.analysis.warnings = uniqueTexts([
      ...result.analysis.warnings,
      `Some listed specifications could not be repeated in this draft: ${missingFacts.join(", ")}.`,
    ]).slice(0, 8);
  }
  try {
    assertGroundedResult(cleaned, result, shop);
  } catch {
    // A factual draft is still more useful than failing Optimize after the model invented details.
  }
  return result;
}

export type OptimizeProductOutcome = {
  result: OptimizationResult;
  chargeUsage: boolean;
};

export async function runOptimizeProduct(
  product: OptimizerProduct,
  outputLocale: AppLocale = "en",
  shop = "",
  brandVoice: BrandVoice | string = DEFAULT_BRAND_VOICE
): Promise<OptimizeProductOutcome> {
  if (!cleanText(product.title)) {
    throw new OptimizerError("Product title is required for AI optimization.", 400);
  }
  const locale = parseAppLocale(outputLocale);
  const voice = parseBrandVoice(brandVoice);
  const cleaned = sanitizeProductSource(
    { ...product, merchantFacts: parseMerchantFacts(product.merchantFacts) },
    shop
  );
  if (!cleanText(cleaned.title)) {
    throw new OptimizerError("Product title is required for AI optimization.", 400);
  }
  const { system, user } = buildOptimizerMessages(cleaned, locale, voice);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await callModel(
        attempt === 0 ? system : retrySystemPrompt(system, lastError, cleaned),
        user
      );
      const parsed = parseModelText(content);
      assertRawModelCopy(cleaned, parsed);
      const result = validateOptimizationResult(parsed, cleaned, shop, voice);
      assertGroundedResult(cleaned, result, shop);
      return { result, chargeUsage: true };
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return { result: buildSafeFallbackResult(cleaned, shop, voice), chargeUsage: false };
  } catch {
    try {
      const result = validateOptimizationResult(
        {
          analysis: {
            warnings: [
              "The AI could not produce grounded copy, so Virello wrote a factual draft from listed product data only.",
            ],
            missingInformation: [],
          },
          optimization: {
            title: cleaned.title,
            description: cleaned.title,
          },
        },
        cleaned,
        shop,
        voice,
        { fallback: true }
      );
      return { result, chargeUsage: false };
    } catch {
      throw new OptimizerError("The AI optimizer could not produce a valid result.", 502);
    }
  }
}

export async function optimizeProduct(
  product: OptimizerProduct,
  outputLocale: AppLocale = "en",
  shop = "",
  brandVoice: BrandVoice | string = DEFAULT_BRAND_VOICE
): Promise<OptimizationResult> {
  return (await runOptimizeProduct(product, outputLocale, shop, brandVoice)).result;
}
