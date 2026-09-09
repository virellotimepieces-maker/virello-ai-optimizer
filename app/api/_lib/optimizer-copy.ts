import { stripHtml } from "./listing-html";
import { normalizeShop } from "./shop-domain";
import type { BrandVoice } from "./brand-voice";
import { DEFAULT_BRAND_VOICE } from "./brand-voice";
import type { OptimizationResult, OptimizerProduct } from "./optimizer";
import {
  merchantFactFieldPresent,
  merchantFactHaystack,
  merchantFactLines,
  hasMerchantFacts,
  parseMerchantFacts,
} from "./merchant-facts";
import { repairCopyQuality, rewriteMerchantInsight, isVagueBrandIdentityWarning } from "./copy-quality";
import { clipAtWordLimit, META_DESCRIPTION_MAX, SEO_TITLE_MAX } from "./listing-score";

const STOP_WORDS = new Set([
  "with",
  "from",
  "this",
  "that",
  "these",
  "those",
  "the",
  "and",
  "for",
  "your",
  "you",
  "our",
  "shop",
  "store",
  "myshopify",
  "com",
  "www",
  "http",
  "https",
  "html",
  "product",
  "products",
  "item",
  "items",
  "sale",
  "new",
]);

export const DROPSHIPPING_LANGUAGE =
  /\b(elevate your (?:game|look|style|wardrobe|everyday)|your new favorite|must[- ]have|game[- ]changer|affordable luxury|affordable elegance|budget[- ]friendly|without breaking the bank|won'?t break the bank|perfect for everyone|perfect for any(?:one|body| occasion)|shop now|buy now|order now|hot deal|unbeatable(?: price| value)?|steal of a deal|to the next level|next[- ]level|trust us|don'?t miss|wow factor|amazing deal|best quality|premium quality|high[- ]end|world[- ]class|ultimate|stunning|exclusive deal)\b/gi;

export const VALUE_HYPE_LANGUAGE =
  /\b(affordable elegance|affordable luxury|affordable style|affordable look|affordable timepiece|budget[- ]friendly|priced at just|priced at only|luxury for less|elegance at (?:an? )?price|value for money|bargain price)\b/gi;

export const PRICE_LEAD_LANGUAGE =
  /\b(affordable|budget[- ]friendly|budget|priced at|price of just|only \$\d|just \$\d|bargain)\b/gi;

export const UNVERIFIED_QUALITY =
  /\b(durable|durability|built to last|indestructible|unbreakable|heavy[- ]duty)\b/gi;

export const CHEAP_LANGUAGE =
  /\b(cheap(?:ly)?|low[- ]quality|poor quality|questionable|lacking durability|flimsy|knock[- ]?off|replica|bargain bin|poorly made|cheaply made|inferior|not durable|won'?t last|low[- ]grade)\b/gi;

export const REVIEW_SUGGESTION =
  /\b(customer reviews?|verified reviews?|display reviews?|add reviews?|show reviews?|social proof|\d+\s*[- ]stars?|star ratings?|leave a review|see (?:our|the) reviews|rated \d|customers love|highly rated|top rated)\b/gi;

export const LIFESTYLE_FILLER =
  /\b(everyday wear|daily wear|date night|weekend wear|office (?:or|and) weekend|perfect gift|gift for (?:him|her|them)|any occasion|various occasions|versatile design|transitions seamlessly|gym (?:or|and) street|workout|versatility(?:\s+and\s+style)?)\b/gi;

const GENERIC_FILLER =
  /\b(best|premium|amazing|quality|stunning|exclusive|must[- ]have|perfect gift|top rated|shop now|buy now|deal of|hot sale|luxury(?: lifestyle)?|affordable|high[- ]end|unbeatable|world[- ]class|ultimate|elegance|sophistication)\b/gi;

const ROMAN_SLASH = /\b[ivxlcdm]{1,6}\/[a-z][\w-]*/gi;
const INCOMPLETE_TAIL = /\b(with|and|for|the|a|an|of|from|to|in|on)\s*$/i;
const TRAILING_JUNK = /[\s|:;,.–—/-]+$/g;
const PLACEHOLDER_TITLE = /^(default title|untitled|home page|welcome|example product|lorem ipsum)$/i;
const TEMPLATE_JUNK =
  /\b(home page|welcome to our store|lorem ipsum|click here|insert description|product description here)\b/gi;
const INTERNAL_INSTRUCTION =
  /\b(use these (?:listed )?facts(?: in the customer copy)?|keep the listing factual|system prompt|internal (?:instruction|note|label)|validation note|return json only|write all customer-facing)\b/i;
const INTERNAL_LEAD =
  /^\s*(?:customer copy|use these facts|listed facts|internal note|system message|validation(?: failures?)?)\s*[:.\-–—]+\s*/i;

export function cleanCopyText(value: unknown): string {
  return typeof value === "string" ? stripHtml(value).replace(/\s+/g, " ").trim() : "";
}

export function polishPunctuation(value: string): string {
  let text = cleanCopyText(value);
  if (!text) return "";
  text = text.replace(/\s+/g, " ");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/([,.;:!?])\1+/g, "$1");
  text = text.replace(/,\s*\./g, ".");
  text = text.replace(/\.\s*\./g, ".");
  text = text.replace(/\s+\./g, ".");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[,.;:!?]+/, "").replace(/[,:;]+$/, "").trim();
  return text;
}

export function stripInternalInstructions(value: unknown): string {
  let text = cleanCopyText(value);
  if (!text) return "";
  text = text.replace(INTERNAL_LEAD, "");
  text = text.replace(new RegExp(INTERNAL_INSTRUCTION.source, "gi"), " ");
  text = text.replace(/[:.\-–—]\s*$/g, " ");
  return polishPunctuation(text);
}

export function hasInternalInstruction(value: string): boolean {
  const text = cleanCopyText(value);
  if (!text) return false;
  return INTERNAL_LEAD.test(text) || INTERNAL_INSTRUCTION.test(text);
}

export function shopContentLeakTokens(shop?: string): string[] {
  const tokens = new Set<string>(["virello-dev", "myshopify", "myshopify.com"]);
  const normalized = normalizeShop(shop || "");
  const extras = [normalized, (shop || "").trim().toLowerCase()];
  for (const extra of extras) {
    if (!extra) continue;
    tokens.add(extra);
    const handle = extra.replace(/\.myshopify\.com$/i, "");
    tokens.add(handle);
    for (const part of handle.split(/[-_.]+/)) {
      if (part.length >= 3) tokens.add(part);
    }
  }
  return [...tokens].filter((token) => token.length >= 3);
}

function exactShopIdentityTokens(shop?: string): string[] {
  const tokens = new Set<string>(["myshopify", "myshopify.com", "virello-dev"]);
  const normalized = normalizeShop(shop || "");
  if (normalized) {
    tokens.add(normalized);
    const handle = normalized.replace(/\.myshopify\.com$/i, "");
    if (handle) tokens.add(handle);
  }
  return [...tokens].filter((token) => token.length >= 3);
}

export function listedVendorName(value: string, shop?: string): string {
  let text = cleanCopyText(value);
  if (!text) return "";
  text = text.replace(/\b[\w-]+\.myshopify\.com\b/gi, " ");
  text = text.replace(/\.?myshopify\.com\b/gi, " ");
  for (const token of exactShopIdentityTokens(shop)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

export function genuineProductHaystack(product?: OptimizerProduct): string {
  if (!product) return "";
  return [
    product.title,
    product.description,
    product.productType,
    product.vendor,
    ...(product.tags || []),
    ...(product.options || []),
    ...(product.variants || []),
    merchantFactHaystack(product.merchantFacts),
  ]
    .map((item) => cleanCopyText(item))
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

function verifiedAllowlistHaystack(product?: OptimizerProduct): string {
  if (!product) return "";
  return [
    product.title,
    product.productType,
    product.vendor,
    ...(product.tags || []),
    ...(product.options || []),
    ...(product.variants || []),
    merchantFactHaystack(product.merchantFacts),
  ]
    .map((item) => cleanCopyText(item))
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

function lifestyleAllowedInProduct(match: string, product?: OptimizerProduct): boolean {
  const needle = match.toLowerCase().trim();
  if (!needle) return false;
  const hay = verifiedAllowlistHaystack(product);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(hay);
}

function tokenAllowedInProduct(token: string, product?: OptimizerProduct): boolean {
  const needle = token.toLowerCase().trim();
  if (!needle) return false;
  const hay = genuineProductHaystack(product);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(hay);
}

export function stripShopLeaks(
  value: string,
  product?: OptimizerProduct,
  shop?: string
): string {
  let text = cleanCopyText(value);
  if (!text) return "";
  for (const token of shopContentLeakTokens(shop)) {
    if (tokenAllowedInProduct(token, product)) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }
  text = text.replace(/\b[\w-]+\.myshopify\.com\b/gi, (match) =>
    tokenAllowedInProduct(match, product) ? match : " "
  );
  text = text.replace(/\.?myshopify\.com\b/gi, (match) =>
    tokenAllowedInProduct(match, product) ? match : " "
  );
  text = text.replace(/\b(from|at|on|visit)\s+\.+/gi, " ");
  text = text.replace(/\s+\./g, ".").replace(/\.\s*\./g, ".");
  return text.replace(/\s+/g, " ").trim();
}

function dedupeSentences(value: string): string {
  const text = cleanCopyText(value);
  if (!text) return "";
  const parts = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function dedupeRepeatedPrices(value: string): string {
  return value.replace(
    /((?:php|usd|\$|€|₱)?\s?\d[\d,]*(?:\.\d+)?)(?:\s+\1)+/gi,
    "$1"
  );
}

function stripPattern(
  value: string,
  pattern: RegExp,
  product?: OptimizerProduct,
  allowed: (match: string, product?: OptimizerProduct) => boolean = tokenAllowedInProduct
): string {
  return value.replace(pattern, (match) => (allowed(match, product) ? match : " "));
}

function matches(pattern: RegExp, value: string): boolean {
  return new RegExp(pattern.source, "i").test(value);
}

export function hasDropshippingLanguage(value: string): boolean {
  return matches(DROPSHIPPING_LANGUAGE, value);
}

export function hasCheapLanguage(value: string): boolean {
  return matches(CHEAP_LANGUAGE, value);
}

export function hasReviewSuggestion(value: string): boolean {
  return matches(REVIEW_SUGGESTION, value);
}

export function hasValueHypeLanguage(value: string): boolean {
  return matches(VALUE_HYPE_LANGUAGE, value);
}

export function hasPriceLeadLanguage(value: string): boolean {
  return matches(PRICE_LEAD_LANGUAGE, value);
}

export function hasDirtyMarketingLanguage(value: string): boolean {
  return (
    hasDropshippingLanguage(value) ||
    hasValueHypeLanguage(value) ||
    hasCheapLanguage(value) ||
    hasReviewSuggestion(value) ||
    hasPriceLeadLanguage(value)
  );
}

function stripAlways(value: string, pattern: RegExp): string {
  return value.replace(new RegExp(pattern.source, "gi"), " ");
}

export function stripDirtyMarketing(value: string, product?: OptimizerProduct): string {
  let text = cleanCopyText(value);
  if (!text) return "";
  text = stripAlways(text, VALUE_HYPE_LANGUAGE);
  text = stripAlways(text, DROPSHIPPING_LANGUAGE);
  text = stripAlways(text, CHEAP_LANGUAGE);
  text = stripAlways(text, REVIEW_SUGGESTION);
  text = stripPattern(text, LIFESTYLE_FILLER, product, lifestyleAllowedInProduct);
  text = stripAlways(text, GENERIC_FILLER);
  text = stripAlways(text, PRICE_LEAD_LANGUAGE);
  text = stripPattern(text, UNVERIFIED_QUALITY, product, lifestyleAllowedInProduct);
  text = text.replace(/[|]{2,}/g, " ");
  text = text.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
  text = text.replace(INCOMPLETE_TAIL, "").replace(TRAILING_JUNK, "").trim();
  return text.replace(/\s+/g, " ").trim();
}

function stripBannedRetail(value: string, product?: OptimizerProduct): string {
  let text = value;
  text = stripAlways(text, VALUE_HYPE_LANGUAGE);
  text = stripAlways(text, DROPSHIPPING_LANGUAGE);
  text = stripAlways(text, CHEAP_LANGUAGE);
  text = stripAlways(text, REVIEW_SUGGESTION);
  text = stripPattern(text, LIFESTYLE_FILLER, product, lifestyleAllowedInProduct);
  text = stripAlways(text, GENERIC_FILLER);
  text = stripAlways(text, PRICE_LEAD_LANGUAGE);
  text = stripPattern(text, UNVERIFIED_QUALITY, product, lifestyleAllowedInProduct);
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeGeneratedText(
  value: unknown,
  product?: OptimizerProduct,
  shop?: string,
  kind: "plain" | "title" = "plain"
): string {
  let text = stripShopLeaks(cleanCopyText(value), product, shop);
  text = stripInternalInstructions(text);
  text = text.replace(ROMAN_SLASH, " ");
  text = text.replace(TEMPLATE_JUNK, " ");
  text = dedupeRepeatedPrices(text);
  text = stripBannedRetail(text, product);
  text = text.replace(/[|]{2,}/g, " ");
  text = dedupeSentences(text);
  if (kind === "title") {
    text = text.split(/[.!\n]/)[0] || text;
    text = text.replace(TRAILING_JUNK, "").trim();
    text = text.replace(INCOMPLETE_TAIL, "").trim();
    text = text.replace(TRAILING_JUNK, "").trim();
    if (text.length < 8 && product?.title) {
      text = stripShopLeaks(cleanCopyText(product.title), product, shop);
    }
    return repairCopyQuality(text, "title").text;
  }
  return repairCopyQuality(text).text;
}

function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function productTokens(product?: OptimizerProduct, shop?: string): string[] {
  if (!product) return [];
  const leaks = new Set(shopContentLeakTokens(shop).map((item) => item.toLowerCase()));
  const chunks = [
    product.vendor,
    product.title,
    product.productType,
    ...(product.tags || []),
    ...(product.options || []),
    ...(product.variants || []),
    merchantFactHaystack(product.merchantFacts),
  ]
    .flatMap((item) => cleanCopyText(item).split(/[^a-zA-Z0-9]+/))
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOP_WORDS.has(token.toLowerCase()) &&
        !leaks.has(token.toLowerCase()) &&
        !/^\d+$/.test(token)
    );
  return uniqueTexts(chunks);
}

export function tagsAndKeywordsFromProduct(
  product?: OptimizerProduct,
  shop?: string
): { tags: string[]; keywords: string[] } {
  if (!product) return { tags: [], keywords: [] };
  const tokens = productTokens(product, shop);
  const titleHead = cleanCopyText(product.title).split(" ").slice(0, 4).join(" ");
  const type = cleanCopyText(product.productType);
  const titleWithType = type && !typeAlreadyInTitle(titleHead, type) ? `${titleHead} ${type}` : titleHead;
  const phrases = uniqueTexts(
    [
      type,
      cleanCopyText(product.vendor),
      [cleanCopyText(product.vendor), type].filter(Boolean).join(" "),
      ...(product.tags || []).map((item) => cleanCopyText(item)),
      ...(product.options || []).map((item) => cleanCopyText(item)),
      ...merchantFactLines(product.merchantFacts),
    ]
      .map((item) => stripShopLeaks(item, product, shop))
      .filter((item) => item.length >= 3 && item.length <= 40 && !item.includes("."))
  );
  const tags = uniqueTexts([...phrases, ...tokens]).slice(0, 12);
  const keywords = uniqueTexts(
    [
      [cleanCopyText(product.vendor), cleanCopyText(product.title).split(" ").slice(0, 3).join(" ")]
        .filter(Boolean)
        .join(" "),
      titleWithType,
      ...phrases,
      ...tokens,
    ]
      .map((item) => stripShopLeaks(item, product, shop))
      .filter((item) => item.length >= 3 && item.length <= 48)
  ).slice(0, 12);
  const leaks = shopContentLeakTokens(shop);
  return {
    tags: tags.filter((item) => !leaks.some((leak) => item.toLowerCase().includes(leak))),
    keywords: keywords.filter((item) => !leaks.some((leak) => item.toLowerCase().includes(leak))),
  };
}

function looksLikeSentence(value: string): boolean {
  return /[.!?]/.test(value) || value.split(/\s+/).length > 8 || value.length > 48;
}

function sanitizeLabelList(
  values: string[],
  product?: OptimizerProduct,
  shop?: string
): string[] {
  return uniqueTexts(
    values
      .map((item) => normalizeGeneratedText(item, product, shop))
      .filter((item) => item.length >= 2 && !looksLikeSentence(item))
  );
}

function looksLikePrice(value: string): boolean {
  return /(?:php|usd|\$|€|₱)\s?\d|^\d[\d,]*(?:\.\d+)?$/.test(value.trim());
}

function wordCount(value: string): number {
  return cleanCopyText(value).split(/\s+/).filter(Boolean).length;
}

function looksLikeRemnant(value: string): boolean {
  const text = cleanCopyText(value).replace(/[.!?,;:]+$/g, "").trim();
  if (!text) return true;
  const words = wordCount(text);
  if (/\d\s*in$/i.test(text)) {
    return false;
  }
  if (INCOMPLETE_TAIL.test(text)) return true;
  if (/^(with|and|for|the|a|an|of|this|it|is)\b/i.test(text) && words < 8) return true;
  if (/\b(is and|and the|with this|this is)\b/i.test(text) && words < 10) return true;
  if (words <= 14 && repairCopyQuality(text).issues.length > 0) return true;
  return false;
}

function isTypeOnlyFact(item: string, product?: OptimizerProduct): boolean {
  const type = cleanCopyText(product?.productType || "");
  const title = cleanCopyText(product?.title || "");
  const value = cleanCopyText(item).toLowerCase();
  if (!value) return true;
  if (type && value === type.toLowerCase()) return true;
  if (title && value === title.toLowerCase()) return true;
  return false;
}

function typeAlreadyInTitle(title: string, type: string): boolean {
  const t = cleanCopyText(title).toLowerCase();
  const kind = cleanCopyText(type).toLowerCase();
  return Boolean(t && kind && t.includes(kind));
}

function listedAsLine(type: string): string {
  const kind = cleanCopyText(type);
  if (!kind) return "";
  return `Listed as ${withArticle(kind)}`;
}

function withArticle(noun: string): string {
  const text = cleanCopyText(noun).toLowerCase();
  if (!text) return "";
  const last = text.split(/\s+/).pop() || text;
  if (/s$/i.test(last) && !/^(glass|brass|canvas|watch|dress|bus|plus|lens|gas)$/i.test(last)) {
    return text;
  }
  const first = text.split(/\s+/)[0] || text;
  return `${/^[aeiou]/i.test(first) ? "an" : "a"} ${text}`;
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function naturalizeFact(item: string): string {
  const labeled = item.match(/^([^:]{2,32}):\s*(.+)$/);
  if (labeled?.[1] && labeled[2]) {
    return `${labeled[2].trim()} ${labeled[1].trim().toLowerCase()}`;
  }
  return item.replace(/\s+[·|]\s+/g, " ").trim();
}

function withoutPriceTokens(value: string, includePrice: boolean): string {
  if (includePrice) return value;
  return value
    .replace(/(?:php|usd|\$|€|₱)\s?\d[\d,]*(?:\.\d+)?/gi, " ")
    .replace(/\s+[·|]\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function verifiedMerchantLines(product?: OptimizerProduct, shop?: string): string[] {
  if (!product) return [];
  return uniqueTexts(
    merchantFactLines(product.merchantFacts)
      .map((item) => stripShopLeaks(item, product, shop))
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item.length >= 3)
  );
}

export function listingFacts(
  product?: OptimizerProduct,
  shop?: string,
  includePrice = false
): string[] {
  if (!product) return [];
  const sentences = cleanCopyText(product.description || "")
    .split(/[.!\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8);
  const merchant = verifiedMerchantLines(product, shop);
  const rest = uniqueTexts(
    [
      includePrice ? cleanCopyText(product.price || "") : "",
      ...sentences.map((item) => stripDirtyMarketing(stripShopLeaks(item, product, shop), product)),
      ...(product.options || []).map((item) =>
        stripDirtyMarketing(stripShopLeaks(cleanCopyText(item), product, shop), product)
      ),
      ...(product.tags || []).map((item) =>
        stripDirtyMarketing(stripShopLeaks(cleanCopyText(item), product, shop), product)
      ),
      ...(product.variants || [])
        .slice(0, 6)
        .map((item) => stripDirtyMarketing(stripShopLeaks(cleanCopyText(item), product, shop), product)),
    ]
      .map((item) => withoutPriceTokens(item.replace(ROMAN_SLASH, " ").replace(TEMPLATE_JUNK, " ").trim(), includePrice))
      .map((item) => naturalizeFact(item))
      .filter((item) => item.length >= 3 && (includePrice || !looksLikePrice(item)))
      .filter((item) => !hasDirtyMarketingLanguage(item))
      .filter((item) => !looksLikeRemnant(item))
      .filter((item) => !/^(with|and|or|for|to|of)\s+(this|that|it)$/i.test(item))
      .filter((item) => !/\b(introducing the|transitions seamlessly|versatile design)\b/i.test(item))
      .filter((item) => !merchant.some((fact) => fact.toLowerCase() === item.toLowerCase()))
  );
  return uniqueTexts(
    [
      stripShopLeaks(cleanCopyText(product.vendor || ""), product, shop),
      stripShopLeaks(cleanCopyText(product.productType || ""), product, shop),
      ...merchant,
      ...rest,
    ].filter((item) => item.length >= 3)
  ).slice(0, 16);
}

function skipVendorAndType(product?: OptimizerProduct, shop?: string, facts: string[] = []): string[] {
  const vendor = listedVendorName(product?.vendor || "", shop).toLowerCase();
  const type = cleanCopyText(product?.productType || "").toLowerCase();
  return facts.filter((item) => {
    const lower = item.toLowerCase();
    if (vendor && lower === vendor) return false;
    if (type && (lower === type || lower === `listed as ${withArticle(type)}`)) return false;
    return true;
  });
}

function skipVendorName(product?: OptimizerProduct, shop?: string, facts: string[] = []): string[] {
  const vendor = listedVendorName(product?.vendor || "", shop).toLowerCase();
  if (!vendor) return facts;
  return facts.filter((item) => item.toLowerCase() !== vendor);
}

export function sanitizeProductSource(
  product: OptimizerProduct,
  shop?: string
): OptimizerProduct {
  const vendor = listedVendorName(product.vendor || "", shop);
  const source = { ...product, vendor };
  const cleanField = (value: unknown, kind: "plain" | "title" = "plain"): string => {
    let text = stripShopLeaks(cleanCopyText(value), source, shop);
    text = text.replace(ROMAN_SLASH, " ");
    text = text.replace(TEMPLATE_JUNK, " ");
    text = dedupeRepeatedPrices(text);
    text = stripDirtyMarketing(text, product);
    text = dedupeSentences(text);
    if (kind === "title") {
      text = text.split(/[.!\n]/)[0] || text;
      text = text.replace(TRAILING_JUNK, "").trim();
      text = text.replace(INCOMPLETE_TAIL, "").trim();
      text = text.replace(TRAILING_JUNK, "").trim();
    }
    return text.replace(/\s+/g, " ").trim();
  };

  let title = cleanField(product.title, "title");
  if (PLACEHOLDER_TITLE.test(title) || !title) {
    const fromDescription = cleanField(product.description).split(/[.!]/)[0] || "";
    title = fromDescription || cleanField(product.productType, "title") || title;
  }

  return {
    ...product,
    title,
    description: cleanField(product.description),
    productType: cleanField(product.productType),
    vendor,
    tags: uniqueTexts((product.tags || []).map((item) => cleanField(item)).filter(Boolean)),
    price: cleanCopyText(product.price || ""),
    handle: cleanCopyText(product.handle || ""),
    options: uniqueTexts((product.options || []).map((item) => cleanField(item)).filter(Boolean)),
    variants: uniqueTexts((product.variants || []).map((item) => cleanField(item)).filter(Boolean)),
    merchantFacts: parseMerchantFacts(product.merchantFacts),
  };
}

function isOptionalVariantGap(line: string): boolean {
  return /\b(?:style|color|colour)s?\s+options\b|\badditional\s+(?:style|color|colour|options)\b|\bvariant options\b|\bno additional style\b|\bmissing style options\b|\bcolor options listed\b|\bstyle or color\b|\bcolour or style\b/i.test(
    line
  );
}

function isFalseVendorGap(line: string, product?: OptimizerProduct): boolean {
  if (!cleanCopyText(product?.vendor)) return false;
  return (
    /\b(?:vendor|brand name)\b/i.test(line) &&
    /\b(not provided|not listed|lack of|missing)\b/i.test(line)
  );
}

function isNonScoringListingGap(line: string, product?: OptimizerProduct): boolean {
  return isOptionalVariantGap(line) || isFalseVendorGap(line, product);
}

function sparseMissingDetails(product?: OptimizerProduct): string[] {
  if (!product) return ["Product specifications are not listed."];
  const hay = genuineProductHaystack(product);
  const facts = parseMerchantFacts(product.merchantFacts);
  const missing: string[] = [];
  if (
    !hasMerchantFacts(product.merchantFacts) &&
    (!cleanCopyText(product.description) || cleanCopyText(product.description).length < 24)
  ) {
    missing.push("A detailed product description is not listed.");
  }
  if (!merchantFactFieldPresent(facts, "material") && !/\b(steel|leather|gold|silver|titanium|brass|ceramic|nylon|silicone|cotton|wool|wood|glass|plastic|linen|canvas)\b/i.test(hay)) {
    missing.push("Materials are not listed.");
  }
  if (!merchantFactFieldPresent(facts, "dimensions") && !/\b(mm|cm|in(?:ch(?:es)?)?|size|diameter|length|width|height)\b/i.test(hay)) {
    missing.push("Dimensions are not listed.");
  }
  if (!merchantFactFieldPresent(facts, "warranty") && !/\b(warranty|guarantee)\b/i.test(hay)) {
    missing.push("Warranty terms are not listed.");
  }
  if (
    !merchantFactFieldPresent(facts, "intendedUse") &&
    !/\b(intended use|everyday|daily wear|dress|sport|office|kitchen|outdoor)\b/i.test(hay)
  ) {
    missing.push("Intended use is not listed.");
  }
  const mentionsMovementContext = /\b(watch|clock|timepiece|motor|engine|quartz|automatic|mechanical|movement)\b/i.test(
    `${hay} ${product.productType || ""} ${product.title || ""}`
  );
  if (
    mentionsMovementContext &&
    !merchantFactFieldPresent(facts, "movement") &&
    !/\b(quartz|automatic|mechanical|movement|battery|motor|engine)\b/i.test(hay)
  ) {
    missing.push("Movement or power details are not listed.");
  }
  const mentionsWaterContext = /\b(watch|dive|outdoor|jacket|coat|boot|speaker|camera|phone)\b/i.test(
    `${hay} ${product.productType || ""} ${product.title || ""}`
  );
  if (
    mentionsWaterContext &&
    !merchantFactFieldPresent(facts, "waterResistance") &&
    !/\b(water|atm|waterproof|resistance)\b/i.test(hay)
  ) {
    missing.push("Water resistance is not listed.");
  }
  return missing.slice(0, 7);
}

function extraFacts(
  product?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): string[] {
  const title = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.title || ""), product, shop),
    product
  ).toLowerCase();
  const type = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop),
    product
  ).toLowerCase();
  const vendor = stripShopLeaks(cleanCopyText(product?.vendor || ""), product, shop).toLowerCase();
  const merchant = verifiedMerchantLines(product, shop);
  const extra = listingFacts(product, shop, voice === "value").filter((item) => {
    const lower = item.toLowerCase();
    return lower !== title && lower !== type && lower !== vendor;
  });
  return uniqueTexts([...merchant, ...extra]);
}

function embedFactValue(value: string): string {
  return cleanCopyText(value).replace(/[.]+$/g, "");
}

function listedWithFacts(values: string[]): string {
  const embedded = values.map(embedFactValue).filter(Boolean);
  if (!embedded.length) return "";
  return `listed with ${joinList(embedded)}`;
}

function composeVerifiedCopy(
  product?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): { lead: string; sentences: string[] } {
  const title = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.title || "This product"), product, shop),
    product
  );
  const type = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop),
    product
  );
  const vendor = stripShopLeaks(cleanCopyText(product?.vendor || ""), product, shop);
  const typePhrase = type ? withArticle(type) : "";
  const facts = parseMerchantFacts(product?.merchantFacts);
  const cleanFact = (field: keyof typeof facts): string =>
    stripShopLeaks(cleanCopyText(facts[field] || ""), product, shop).replace(/[.]+$/g, "");
  const material = cleanFact("material");
  const dimensions = cleanFact("dimensions");
  const movement = cleanFact("movement");
  const water = cleanFact("waterResistance");
  const warranty = cleanFact("warranty");
  const intendedUse = cleanFact("intendedUse");

  const sentences: string[] = [];
  if (vendor && typePhrase && !title.toLowerCase().includes(vendor.toLowerCase())) {
    sentences.push(`${title} is ${typePhrase} from ${vendor}.`);
  } else if (typePhrase) {
    sentences.push(`${title} is ${typePhrase}.`);
  } else {
    sentences.push(`${title} is the product named on this listing.`);
  }

  const physical = [material, dimensions, movement].filter(Boolean);
  if (physical.length) {
    sentences.push(`It is ${listedWithFacts(physical)}.`);
  }
  if (water) {
    sentences.push(`Water resistance is listed as ${embedFactValue(water)}.`);
  }
  if (intendedUse && warranty) {
    sentences.push(
      `It is listed for ${embedFactValue(intendedUse)}, and includes ${embedFactValue(warranty)}.`
    );
  } else if (intendedUse) {
    sentences.push(`It is listed for ${embedFactValue(intendedUse)}.`);
  } else if (warranty) {
    sentences.push(`It includes ${embedFactValue(warranty)}.`);
  }

  if (sentences.length <= 1) {
    const named = extraFacts(product, shop, voice).filter((item) => !looksLikeRemnant(item));
    if (named.length) {
      sentences.push(`It is ${listedWithFacts(named.slice(0, 6))}.`);
    } else {
      sentences.push("No further specifications are provided on this listing.");
    }
  }

  return { lead: title, sentences };
}

function factualTitle(product?: OptimizerProduct, shop?: string): string {
  const title = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.title || ""), product, shop),
    product
  );
  const type = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop),
    product
  );
  const vendor = stripShopLeaks(cleanCopyText(product?.vendor || ""), product, shop);
  if (vendor && title && !title.toLowerCase().includes(vendor.toLowerCase())) {
    return `${vendor} ${title}`.slice(0, 120).trim();
  }
  if (title && type && !title.toLowerCase().includes(type.toLowerCase())) {
    return `${title} ${type}`.slice(0, 120).trim();
  }
  return (title || type || "Product").slice(0, 120);
}

function factualDescription(
  product?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): string {
  return polishPunctuation(composeVerifiedCopy(product, shop, voice).sentences.join(" "));
}

function factualCta(product?: OptimizerProduct, shop?: string): string {
  const title = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.title || "this product"), product, shop),
    product
  );
  return `Review the listed details for ${title}.`.slice(0, 120);
}

export function factualConversionCopy(
  product?: OptimizerProduct,
  shop?: string
): string {
  const title = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.title || "This product"), product, shop),
    product
  );
  const type = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop),
    product
  );
  const facts = parseMerchantFacts(product?.merchantFacts);
  const cleanFact = (field: "material" | "dimensions" | "movement" | "waterResistance" | "warranty" | "intendedUse"): string =>
    stripShopLeaks(cleanCopyText(facts[field] || ""), product, shop).replace(/[.]+$/g, "");
  const physical = [cleanFact("material"), cleanFact("dimensions"), cleanFact("movement")].filter(Boolean);
  const water = cleanFact("waterResistance");
  const warranty = cleanFact("warranty");
  const intendedUse = cleanFact("intendedUse");
  const vendor = listedVendorName(
    stripShopLeaks(cleanCopyText(product?.vendor || ""), product, shop),
    shop
  );
  const named =
    vendor && !title.toLowerCase().includes(vendor.toLowerCase()) ? `${title} from ${vendor}` : title;
  const sentences: string[] = [];
  if (physical.length) {
    sentences.push(`${named} is ${listedWithFacts(physical)}.`);
  } else if (type) {
    sentences.push(
      vendor && !title.toLowerCase().includes(vendor.toLowerCase())
        ? `${title} is listed as ${withArticle(type)} from ${vendor}.`
        : `${title} is listed as ${withArticle(type)}.`
    );
  }
  if (water) {
    sentences.push(`Water resistance is listed as ${embedFactValue(water)}.`);
  }
  if (intendedUse && warranty) {
    sentences.push(
      `It is listed for ${embedFactValue(intendedUse)}, and includes ${embedFactValue(warranty)}.`
    );
  } else if (intendedUse) {
    sentences.push(`It is listed for ${embedFactValue(intendedUse)}.`);
  } else if (warranty) {
    sentences.push(`It includes ${embedFactValue(warranty)}.`);
  }
  if (!sentences.length) {
    return type
      ? polishPunctuation(`${title} is listed as ${withArticle(type)}.`)
      : "Only the product name and type are listed, so this draft stays factual.";
  }
  return polishPunctuation(sentences.join(" "));
}

function factualMeta(
  product?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): string {
  const title = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.title || "This product"), product, shop),
    product
  );
  const type = stripDirtyMarketing(
    stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop),
    product
  );
  const vendor = stripShopLeaks(cleanCopyText(product?.vendor || ""), product, shop);
  const lines = verifiedMerchantLines(product, shop);
  const named = lines.length ? lines : extraFacts(product, shop, voice);
  const lead = vendor && !title.toLowerCase().includes(vendor.toLowerCase()) ? `${title} from ${vendor}` : title;
  if (!named.length) {
    const kind = type ? withArticle(type) : "a listed product";
    return clipAtWordLimit(
      `${title} appears as ${kind} on this product page, with no further specifications.`,
      META_DESCRIPTION_MAX
    );
  }
  const facts = named.map(embedFactValue).filter(Boolean);
  const chosen: string[] = [];
  for (const fact of facts) {
    const candidate = `${lead} is listed with ${joinList([...chosen, fact])}.`;
    if (candidate.length > META_DESCRIPTION_MAX) break;
    chosen.push(fact);
  }
  if (!chosen.length) {
    return clipAtWordLimit(`${lead} is listed with ${facts[0]}.`, META_DESCRIPTION_MAX);
  }
  return `${lead} is listed with ${joinList(chosen)}.`;
}

function fitSeoTitleParts(base: string, extra: string, max: number): string {
  const lead = clipAtWordLimit(base, max);
  const extraText = extra.replace(/\s+/g, " ").trim();
  if (!extraText) return lead;
  const words = extraText.split(/\s+/).filter(Boolean);
  let fitted = lead;
  for (let i = 1; i <= words.length; i += 1) {
    const candidate = `${lead} ${words.slice(0, i).join(" ")}`.replace(/\s+/g, " ").trim();
    if (candidate.length > max) break;
    fitted = candidate;
  }
  return fitted;
}

function factualSeoTitle(product?: OptimizerProduct, shop?: string): string {
  const base = clipAtWordLimit(factualTitle(product, shop), SEO_TITLE_MAX);
  const named = extraFacts(product, shop, "refined");
  const spec = named.find((item) => {
    const short = item.split(/\s+/).slice(0, 3).join(" ");
    return short.length >= 4 && !base.toLowerCase().includes(short.toLowerCase());
  });
  if (spec && base.length < 50) {
    const short = spec.split(/\s+/).slice(0, 3).join(" ");
    const combined = fitSeoTitleParts(base, short, SEO_TITLE_MAX);
    if (combined.toLowerCase() !== base.toLowerCase()) return combined;
  }
  return base;
}

function sentenceKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sharesSentence(left: string, right: string): boolean {
  const a = sentenceKey(left);
  const b = sentenceKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 18 && b.includes(a)) return true;
  if (b.length >= 18 && a.includes(b)) return true;
  return false;
}

function canonicalAnalysisLine(value: string): string {
  const text = cleanCopyText(value).replace(/[.]+$/g, "").trim();
  return text ? `${text}.` : "";
}

function neutralizeAnalysisLine(value: string, product?: OptimizerProduct, shop?: string): string {
  if (/could not produce grounded copy/i.test(value)) return cleanCopyText(value);
  if (isVagueBrandIdentityWarning(value)) {
    return rewriteMerchantInsight(value, product);
  }
  let text = normalizeGeneratedText(value, product, shop);
  text = stripAlways(text, CHEAP_LANGUAGE);
  text = stripAlways(text, DROPSHIPPING_LANGUAGE);
  text = rewriteMerchantInsight(text, product);
  text = text.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
  if (!text || looksLikeRemnant(text)) return "";
  if (hasCheapLanguage(text) || /lacking|cheap|low-quality|questionable/i.test(text)) {
    return "This detail is not specified on the listing.";
  }
  return text;
}

export function publishableCopy(result: OptimizationResult): string {
  return [
    result.optimization.title,
    result.optimization.description,
    result.optimization.benefitBullets.join(" "),
    result.optimization.seoTitle,
    result.optimization.metaDescription,
    result.optimization.tags.join(" "),
    result.optimization.keywords.join(" "),
    result.optimization.callToAction,
    result.optimization.conversionCopy,
  ].join(" \n ");
}

export function applyCopyGuards(
  result: OptimizationResult,
  source?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE,
  options: { fallback?: boolean } = {}
): OptimizationResult {
  const includePrice = voice === "value";
  const facts = listingFacts(source, shop, includePrice);
  const inferred = tagsAndKeywordsFromProduct(source, shop);
  const rawTitle = cleanCopyText(result.optimization.title);
  const rawDescription = cleanCopyText(result.optimization.description);

  if (options.fallback) {
    const factBullets = verifiedMerchantLines(source, shop).filter((item) => !looksLikeRemnant(item));
    result.optimization.title = factualTitle(source, shop);
    result.optimization.description = factualDescription(source, shop, voice);
    result.optimization.benefitBullets = uniqueTexts(
      factBullets.length
        ? factBullets
        : facts
            .filter((item) => includePrice || !looksLikePrice(item))
            .map((item) => (isTypeOnlyFact(item, source) ? listedAsLine(source?.productType || item) : item))
            .filter((item) => !looksLikeRemnant(item))
            .slice(0, 4)
    ).slice(0, 8);
    result.optimization.tags = inferred.tags.slice(0, 20);
    result.optimization.keywords = inferred.keywords
      .filter((item) => !inferred.tags.includes(item) || item.split(" ").length > 1)
      .slice(0, 20);
    if (!result.optimization.keywords.length) {
      result.optimization.keywords = result.optimization.tags.slice(0, 8);
    }
    result.optimization.callToAction = factualCta(source, shop);
    result.optimization.conversionCopy = factualConversionCopy(source, shop);
    result.optimization.seoTitle = clipAtWordLimit(factualSeoTitle(source, shop), SEO_TITLE_MAX);
    result.optimization.metaDescription = clipAtWordLimit(factualMeta(source, shop, voice), META_DESCRIPTION_MAX);
  } else {
  let title = normalizeGeneratedText(result.optimization.title, source, shop, "title").slice(0, 120);
  if (!includePrice) {
    title = title.replace(/(?:php|usd|\$|€|₱)\s?\d[\d,]*(?:\.\d+)?/gi, " ").replace(/\s+/g, " ").trim();
  }
  title = repairCopyQuality(title, "title").text.slice(0, 120);
  if (
    !title ||
    repairCopyQuality(title, "title").issues.length > 0 ||
    hasDropshippingLanguage(title) ||
    hasCheapLanguage(title) ||
    hasValueHypeLanguage(title) ||
    hasValueHypeLanguage(rawTitle) ||
    (!includePrice && (hasPriceLeadLanguage(title) || hasPriceLeadLanguage(rawTitle)))
  ) {
    title = factualTitle(source, shop);
  }

  let description = normalizeGeneratedText(result.optimization.description, source, shop);
  const descriptionQuality = repairCopyQuality(description);
  description = descriptionQuality.text;
  const descriptionWords = description.split(/\s+/).filter(Boolean);
  const titleToken = stripShopLeaks(cleanCopyText(source?.title || ""), source, shop)
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (
    !description ||
    descriptionQuality.uncertain ||
    descriptionWords.length < 8 ||
    looksLikeRemnant(description) ||
    (titleToken && titleToken.length >= 4 && !description.toLowerCase().includes(titleToken)) ||
    description.toLowerCase() === title.toLowerCase() ||
    hasDropshippingLanguage(description) ||
    hasCheapLanguage(description) ||
    hasReviewSuggestion(description) ||
    hasValueHypeLanguage(description) ||
    hasValueHypeLanguage(rawDescription) ||
    (!includePrice && (hasPriceLeadLanguage(description) || hasPriceLeadLanguage(rawDescription)))
  ) {
    description = factualDescription(source, shop, voice);
  }
  if (!includePrice && /(?:php|usd|\$|€|₱)\s?\d/.test(description) && !/(?:php|usd|\$|€|₱)\s?\d/.test(cleanCopyText(source?.description || ""))) {
    description = factualDescription(source, shop, voice);
  }

  const bullets = uniqueTexts(
    result.optimization.benefitBullets
      .map((item) => normalizeGeneratedText(item, source, shop))
      .map((item) => repairCopyQuality(item).text)
      .map((item) => item.replace(/\b(with|and|for|the|a|an|of|from|to|in|on)\s*$/i, "").trim())
      .map((item) => (isTypeOnlyFact(item, source) ? listedAsLine(source?.productType || item) : item))
      .filter((item) => item.length >= 4)
      .filter((item) => includePrice || !looksLikePrice(item))
      .filter((item) => !looksLikeRemnant(item))
      .filter((item) => repairCopyQuality(item).issues.length === 0)
      .filter(
        (item) =>
          !hasDropshippingLanguage(item) &&
          !hasCheapLanguage(item) &&
          !hasValueHypeLanguage(item) &&
          (includePrice || !hasPriceLeadLanguage(item))
      )
  ).slice(0, 8);
  if (!bullets.length) {
    bullets.push(
      ...uniqueTexts(
        facts
          .filter((item) => includePrice || !looksLikePrice(item))
          .map((item) => (isTypeOnlyFact(item, source) ? listedAsLine(source?.productType || item) : item))
          .filter((item) => !looksLikeRemnant(item))
          .slice(0, 4)
      )
    );
  }
  if (!bullets.length) {
    const listed = listedAsLine(source?.productType || "");
    if (listed) bullets.push(listed);
  }

  const tags = uniqueTexts([
    ...sanitizeLabelList(result.optimization.tags, source, shop),
    ...inferred.tags,
  ]).slice(0, 20);
  const keywords = uniqueTexts([
    ...sanitizeLabelList(result.optimization.keywords, source, shop),
    ...inferred.keywords,
  ])
    .filter((item) => !tags.includes(item) || item.split(" ").length > 1)
    .filter((item) => !/\b(\w+)\s+\1\b/i.test(item))
    .slice(0, 20);

  let callToAction = normalizeGeneratedText(result.optimization.callToAction, source, shop);
  callToAction = repairCopyQuality(callToAction).text;
  if (
    !callToAction ||
    looksLikeRemnant(callToAction) ||
    repairCopyQuality(callToAction).issues.length > 0 ||
    sharesSentence(callToAction, description) ||
    hasDropshippingLanguage(callToAction) ||
    hasValueHypeLanguage(callToAction) ||
    /\b(shop now|buy now)\b/i.test(callToAction) ||
    callToAction.length > 160
  ) {
    callToAction = factualCta(source, shop);
  }

  const usableFacts = facts.filter((item) => !isTypeOnlyFact(item, source));
  let conversionCopy = normalizeGeneratedText(result.optimization.conversionCopy, source, shop);
  conversionCopy = stripInternalInstructions(conversionCopy);
  conversionCopy = repairCopyQuality(conversionCopy).text;
  if (
    !conversionCopy ||
    wordCount(conversionCopy) < 4 ||
    looksLikeRemnant(conversionCopy) ||
    repairCopyQuality(conversionCopy).issues.length > 0 ||
    hasInternalInstruction(conversionCopy) ||
    /\blists\s+(?:introducing|the)\b/i.test(conversionCopy) ||
    /^this product has\b/i.test(conversionCopy) ||
    sharesSentence(conversionCopy, title) ||
    sharesSentence(conversionCopy, description) ||
    hasDropshippingLanguage(conversionCopy) ||
    hasValueHypeLanguage(conversionCopy)
  ) {
    conversionCopy = factualConversionCopy(source, shop);
  }

  let seoTitle = clipAtWordLimit(
    normalizeGeneratedText(result.optimization.seoTitle, source, shop, "title"),
    SEO_TITLE_MAX
  );
  seoTitle = clipAtWordLimit(repairCopyQuality(seoTitle, "title").text, SEO_TITLE_MAX);
  if (
    !seoTitle ||
    looksLikeRemnant(seoTitle) ||
    repairCopyQuality(seoTitle, "title").issues.length > 0 ||
    hasDropshippingLanguage(seoTitle) ||
    hasValueHypeLanguage(seoTitle) ||
    (!includePrice && hasPriceLeadLanguage(seoTitle)) ||
    (sharesSentence(seoTitle, title) && seoTitle.length < 18)
  ) {
    seoTitle = factualSeoTitle(source, shop);
  }
  const productType = cleanCopyText(source?.productType || "");
  if (
    productType &&
    !typeAlreadyInTitle(title, productType) &&
    (seoTitle.toLowerCase() === title.toLowerCase() || sharesSentence(seoTitle, title))
  ) {
    const typed = clipAtWordLimit(`${title} ${productType}`, SEO_TITLE_MAX);
    if (!sharesSentence(typed, title)) seoTitle = typed;
  }

  let metaDescription = clipAtWordLimit(
    normalizeGeneratedText(result.optimization.metaDescription, source, shop),
    META_DESCRIPTION_MAX
  );
  metaDescription = clipAtWordLimit(repairCopyQuality(metaDescription).text, META_DESCRIPTION_MAX);
  const descKey = sentenceKey(description).slice(0, 36);
  if (
    !metaDescription ||
    looksLikeRemnant(metaDescription) ||
    repairCopyQuality(metaDescription).issues.length > 0 ||
    wordCount(metaDescription) < 12 ||
    sharesSentence(metaDescription, description) ||
    (descKey.length >= 18 && sentenceKey(metaDescription).includes(descKey)) ||
    hasDropshippingLanguage(metaDescription) ||
    hasReviewSuggestion(metaDescription) ||
    hasValueHypeLanguage(metaDescription) ||
    (!includePrice && hasPriceLeadLanguage(metaDescription))
  ) {
    metaDescription = factualMeta(source, shop, voice);
  }

  result.optimization.title = title || cleanCopyText(source?.title || "");
  result.optimization.description = description;
  result.optimization.benefitBullets = bullets;
  result.optimization.tags = tags;
  result.optimization.keywords = keywords.length ? keywords : tags.slice(0, 8);
  result.optimization.callToAction = callToAction;
  result.optimization.conversionCopy = conversionCopy;
  result.optimization.seoTitle = clipAtWordLimit(seoTitle, SEO_TITLE_MAX);
  result.optimization.metaDescription = clipAtWordLimit(metaDescription, META_DESCRIPTION_MAX);
  }

  const missing = uniqueTexts([
    ...result.analysis.missingInformation
      .map((item) => neutralizeAnalysisLine(item, source, shop))
      .map((item) => canonicalAnalysisLine(item))
      .filter((item) => !isNonScoringListingGap(item, source)),
    ...sparseMissingDetails(source),
  ]).filter(Boolean);
  result.analysis.missingInformation = missing.slice(0, 8);
  result.analysis.warnings = uniqueTexts(
    result.analysis.warnings
      .map((item) => neutralizeAnalysisLine(item, source, shop))
      .map((item) => canonicalAnalysisLine(item))
      .filter(Boolean)
      .filter((item) => !isNonScoringListingGap(item, source))
      .filter((item) => !missing.some((gap) => item.toLowerCase().includes(gap.toLowerCase())))
      .filter((item) => !/missing product information:/i.test(item))
      .filter((item) => !/limited by missing product facts/i.test(item))
      .filter((item) => !/would improve the score:/i.test(item))
      .filter((item) => !/omitted the title or description/i.test(item))
      .filter(
        (item) =>
          !isVagueBrandIdentityWarning(item) ||
          !(cleanCopyText(source?.vendor) && cleanCopyText(source?.productType))
      )
  ).slice(0, 8);
  result.analysis.targetCustomer = neutralizeAnalysisLine(
    result.analysis.targetCustomer,
    source,
    shop
  );
  if (!result.analysis.targetCustomer) {
    const type = cleanCopyText(source?.productType || "this product");
    result.analysis.targetCustomer = `Shoppers considering ${type.toLowerCase()} from the facts on this listing.`;
  }
  result.analysis.purchaseMotivation = neutralizeAnalysisLine(
    result.analysis.purchaseMotivation,
    source,
    shop
  );
  if (!result.analysis.purchaseMotivation) {
    const notable = skipVendorAndType(source, shop, facts);
    result.analysis.purchaseMotivation = notable[0]
      ? `The listed facts include ${notable[0]}.`
      : "Only the product name is listed, so the copy stays factual.";
  }
  result.analysis.strongestFeatures = uniqueTexts(
    result.analysis.strongestFeatures
      .map((item) => neutralizeAnalysisLine(item, source, shop))
      .filter(Boolean)
  ).slice(0, 8);
  if (!result.analysis.strongestFeatures.length) {
    const merchant = verifiedMerchantLines(source, shop);
    const notable = skipVendorName(source, shop, facts);
    result.analysis.strongestFeatures = (merchant.length ? merchant : notable.length ? notable : facts).slice(0, 4);
  }
  result.analysis.weaknesses = uniqueTexts(
    result.analysis.weaknesses
      .map((item) => neutralizeAnalysisLine(item, source, shop))
      .filter(Boolean)
      .filter((item) => !hasCheapLanguage(item))
  ).slice(0, 8);
  if (!result.analysis.weaknesses.length && missing.length) {
    result.analysis.weaknesses = missing.slice(0, 3);
  }
  result.analysis.conversionOpportunities = uniqueTexts(
    result.analysis.conversionOpportunities
      .map((item) => neutralizeAnalysisLine(item, source, shop))
      .filter(Boolean)
      .filter(
        (item) =>
          !hasReviewSuggestion(item) &&
          !hasDropshippingLanguage(item) &&
          !/\b(reviews?|ratings?|stars?|social proof)\b/i.test(item)
      )
  ).slice(0, 8);
  if (!result.analysis.conversionOpportunities.length) {
    result.analysis.conversionOpportunities = [
      "Lead with verified product facts only.",
      "Name missing specifications in merchant notes, not in the listing.",
    ];
  }
  result.analysis.benefitBullets = result.optimization.benefitBullets.slice();
  result.analysis.objections = result.analysis.objections
    .map((row) => ({
      objection: neutralizeAnalysisLine(row.objection, source, shop),
      response: neutralizeAnalysisLine(row.response, source, shop),
    }))
    .filter((row) => row.objection && row.response && !hasCheapLanguage(row.objection + " " + row.response));
  if (!result.analysis.objections.length && missing[0]) {
    result.analysis.objections = [
      {
        objection: missing[0],
        response: `${missing[0]} It is not claimed in the customer-facing copy.`,
      },
    ];
  }

  return result;
}
