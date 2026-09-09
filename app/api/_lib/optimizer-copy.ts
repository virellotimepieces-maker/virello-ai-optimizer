import { stripHtml } from "./listing-html";
import { normalizeShop } from "./shop-domain";
import type { BrandVoice } from "./brand-voice";
import { DEFAULT_BRAND_VOICE } from "./brand-voice";
import type { OptimizationResult, OptimizerProduct } from "./optimizer";

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
  /\b(elevate your (?:game|look|style|wardrobe|everyday)|your new favorite|must[- ]have|game[- ]changer|affordable luxury|budget[- ]friendly|without breaking the bank|won'?t break the bank|perfect for everyone|perfect for any(?:one|body| occasion)|shop now|buy now|order now|hot deal|unbeatable(?: price| value)?|steal of a deal|to the next level|next[- ]level|trust us|don'?t miss|wow factor|amazing deal|best quality|premium quality|high[- ]end|world[- ]class|ultimate|stunning|exclusive deal)\b/gi;

export const CHEAP_LANGUAGE =
  /\b(cheap(?:ly)?|low[- ]quality|poor quality|questionable|lacking durability|flimsy|knock[- ]?off|replica|bargain bin|poorly made|cheaply made|inferior|not durable|won'?t last|low[- ]grade)\b/gi;

export const REVIEW_SUGGESTION =
  /\b(customer reviews?|verified reviews?|display reviews?|add reviews?|show reviews?|social proof|\d+\s*[- ]stars?|star ratings?|leave a review|see (?:our|the) reviews|rated \d|customers love|highly rated|top rated)\b/gi;

export const LIFESTYLE_FILLER =
  /\b(everyday wear|daily wear|date night|weekend wear|office (?:or|and) weekend|perfect gift|gift for (?:him|her|them)|any occasion|gym (?:or|and) street|workout)\b/gi;

const GENERIC_FILLER =
  /\b(best|premium|amazing|quality|stunning|exclusive|must[- ]have|perfect gift|top rated|shop now|buy now|deal of|hot sale|luxury(?: lifestyle)?|affordable|high[- ]end|unbeatable|world[- ]class|ultimate)\b/gi;

const ROMAN_SLASH = /\b[ivxlcdm]{1,6}\/[a-z][\w-]*/gi;
const INCOMPLETE_TAIL = /\b(with|and|for|the|a|an|of|from|to|in|on)\s*$/i;
const TRAILING_JUNK = /[\s|:;,.–—/-]+$/g;
const PLACEHOLDER_TITLE = /^(default title|untitled|home page|welcome|example product|lorem ipsum)$/i;
const TEMPLATE_JUNK =
  /\b(home page|welcome to our store|lorem ipsum|click here|insert description|product description here)\b/gi;

export function cleanCopyText(value: unknown): string {
  return typeof value === "string" ? stripHtml(value).replace(/\s+/g, " ").trim() : "";
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

export function genuineProductHaystack(product?: OptimizerProduct): string {
  if (!product) return "";
  return [
    product.title,
    product.description,
    product.productType,
    ...(product.tags || []),
    ...(product.options || []),
    ...(product.variants || []),
  ]
    .map((item) => cleanCopyText(item))
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
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
  product?: OptimizerProduct
): string {
  return value.replace(pattern, (match) =>
    tokenAllowedInProduct(match, product) ? match : " "
  );
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

function stripBannedRetail(value: string, product?: OptimizerProduct): string {
  let text = value;
  text = stripPattern(text, DROPSHIPPING_LANGUAGE, product);
  text = stripPattern(text, CHEAP_LANGUAGE, product);
  text = stripPattern(text, REVIEW_SUGGESTION, product);
  text = stripPattern(text, LIFESTYLE_FILLER, product);
  text = stripPattern(text, GENERIC_FILLER, product);
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeGeneratedText(
  value: unknown,
  product?: OptimizerProduct,
  shop?: string,
  kind: "plain" | "title" = "plain"
): string {
  let text = stripShopLeaks(cleanCopyText(value), product, shop);
  text = text.replace(ROMAN_SLASH, " ");
  text = text.replace(TEMPLATE_JUNK, " ");
  text = dedupeRepeatedPrices(text);
  text = stripBannedRetail(text, product);
  text = text.replace(/[|]{2,}/g, " ").replace(/\s*\/\s*/g, " ");
  text = dedupeSentences(text);
  if (kind === "title") {
    text = text.split(/[.!\n]/)[0] || text;
    text = text.replace(TRAILING_JUNK, "").trim();
    text = text.replace(INCOMPLETE_TAIL, "").trim();
    text = text.replace(TRAILING_JUNK, "").trim();
    if (text.length < 8 && product?.title) {
      text = stripShopLeaks(cleanCopyText(product.title), product, shop);
    }
  }
  return text.replace(/\s+/g, " ").trim();
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
  if (INCOMPLETE_TAIL.test(text)) return true;
  if (/^(with|and|for|the|a|an|of|this|it|is)\b/i.test(text) && words < 8) return true;
  if (/\b(is and|and the|with this|this is)\b/i.test(text) && words < 10) return true;
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
  return `Listed as ${kind.toLowerCase() === "watch" ? "a watch" : kind}`;
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
  return uniqueTexts(
    [
      stripShopLeaks(cleanCopyText(product.vendor || ""), product, shop),
      stripShopLeaks(cleanCopyText(product.productType || ""), product, shop),
      includePrice ? cleanCopyText(product.price || "") : "",
      ...sentences.map((item) => stripShopLeaks(item, product, shop)),
      ...(product.options || []).map((item) => stripShopLeaks(cleanCopyText(item), product, shop)),
      ...(product.tags || []).map((item) => stripShopLeaks(cleanCopyText(item), product, shop)),
      ...(product.variants || [])
        .slice(0, 4)
        .map((item) => stripShopLeaks(cleanCopyText(item), product, shop)),
    ]
      .map((item) => item.replace(ROMAN_SLASH, " ").replace(TEMPLATE_JUNK, " ").trim())
      .filter((item) => item.length >= 3 && (includePrice || !looksLikePrice(item)))
  ).slice(0, 8);
}

export function sanitizeProductSource(
  product: OptimizerProduct,
  shop?: string
): OptimizerProduct {
  const cleanField = (value: unknown, kind: "plain" | "title" = "plain"): string => {
    let text = stripShopLeaks(cleanCopyText(value), product, shop);
    text = text.replace(ROMAN_SLASH, " ");
    text = text.replace(TEMPLATE_JUNK, " ");
    text = dedupeRepeatedPrices(text);
    text = dedupeSentences(text);
    if (kind === "title") {
      text = text.split(/[.!\n]/)[0] || text;
      text = text.replace(TRAILING_JUNK, "").trim();
    }
    return text.replace(/\s+/g, " ").trim();
  };

  let title = cleanField(product.title, "title");
  if (PLACEHOLDER_TITLE.test(title)) {
    const fromDescription = cleanField(product.description).split(/[.!]/)[0] || "";
    title = fromDescription || title;
  }

  return {
    ...product,
    title,
    description: cleanField(product.description),
    productType: cleanField(product.productType),
    vendor: stripShopLeaks(cleanCopyText(product.vendor || ""), product, shop),
    tags: uniqueTexts((product.tags || []).map((item) => cleanField(item)).filter(Boolean)),
    price: cleanCopyText(product.price || ""),
    handle: cleanCopyText(product.handle || ""),
    options: uniqueTexts((product.options || []).map((item) => cleanField(item)).filter(Boolean)),
    variants: uniqueTexts((product.variants || []).map((item) => cleanField(item)).filter(Boolean)),
  };
}

function sparseMissingDetails(product?: OptimizerProduct): string[] {
  if (!product) return ["Product specifications are not listed."];
  const hay = genuineProductHaystack(product);
  const missing: string[] = [];
  if (!cleanCopyText(product.description) || cleanCopyText(product.description).length < 24) {
    missing.push("A detailed product description is not listed.");
  }
  if (!/\b(steel|leather|gold|silver|titanium|brass|ceramic|nylon|silicone)\b/i.test(hay)) {
    missing.push("Materials are not listed.");
  }
  if (!/\b(quartz|automatic|mechanical|movement|battery)\b/i.test(hay)) {
    missing.push("Movement or power details are not listed.");
  }
  if (!/\b(water|atm|waterproof|resistance)\b/i.test(hay)) {
    missing.push("Water resistance is not listed.");
  }
  if (!/\b(mm|cm|size|diameter|length|width)\b/i.test(hay)) {
    missing.push("Dimensions are not listed.");
  }
  if (!/\b(warranty|guarantee)\b/i.test(hay)) {
    missing.push("Warranty terms are not listed.");
  }
  return missing.slice(0, 6);
}

function factualTitle(product?: OptimizerProduct, shop?: string): string {
  const title = stripShopLeaks(cleanCopyText(product?.title || ""), product, shop);
  const type = stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop);
  const vendor = stripShopLeaks(cleanCopyText(product?.vendor || ""), product, shop);
  if (title && type && !title.toLowerCase().includes(type.toLowerCase())) {
    return [vendor && !title.toLowerCase().includes(vendor.toLowerCase()) ? vendor : "", title, type]
      .filter(Boolean)
      .join(" ")
      .slice(0, 120)
      .trim();
  }
  return (title || type || "Product").slice(0, 120);
}

function factualDescription(
  product?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): string {
  const title = stripShopLeaks(cleanCopyText(product?.title || "This product"), product, shop);
  const type = stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop);
  const facts = listingFacts(product, shop, voice === "value").filter(
    (item) =>
      item.toLowerCase() !== title.toLowerCase() &&
      item.toLowerCase() !== type.toLowerCase()
  );
  const named = facts;
  if (!named.length) {
    const asType = type ? ` listed as ${type.toLowerCase() === "watch" ? "a watch" : type}` : "";
    return `${title} is${asType}. Further specifications are not provided on this listing.`;
  }
  const lead = type ? `${title} is listed as ${type.toLowerCase() === "watch" ? "a watch" : type}` : title;
  return `${lead}, with ${named.slice(0, 3).join(", ")}. Details beyond these listed facts are not provided.`;
}

function factualCta(product?: OptimizerProduct, shop?: string): string {
  const title = stripShopLeaks(cleanCopyText(product?.title || "this product"), product, shop);
  return `Review the listed details for ${title}.`.slice(0, 120);
}

function factualMeta(
  product?: OptimizerProduct,
  shop?: string,
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): string {
  const title = stripShopLeaks(cleanCopyText(product?.title || "This product"), product, shop);
  const type = stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop);
  const facts = listingFacts(product, shop, voice === "value").filter(
    (item) =>
      item.toLowerCase() !== title.toLowerCase() &&
      item.toLowerCase() !== type.toLowerCase()
  );
  const body = facts.length
    ? `${title}${type ? ` is listed as ${type}` : ""}. ${facts.slice(0, 2).join(". ")}.`
    : `${title}${type ? ` is listed as ${type.toLowerCase() === "watch" ? "a watch" : type}` : ""}. Specifications beyond the product name are not provided.`;
  return body.slice(0, 160);
}

function factualSeoTitle(product?: OptimizerProduct, shop?: string): string {
  const title = factualTitle(product, shop);
  return title.slice(0, 60);
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

function neutralizeAnalysisLine(value: string, product?: OptimizerProduct, shop?: string): string {
  let text = normalizeGeneratedText(value, product, shop);
  text = stripPattern(text, CHEAP_LANGUAGE, product);
  text = stripPattern(text, DROPSHIPPING_LANGUAGE, product);
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
  voice: BrandVoice = DEFAULT_BRAND_VOICE
): OptimizationResult {
  const includePrice = voice === "value";
  const facts = listingFacts(source, shop, includePrice);
  const inferred = tagsAndKeywordsFromProduct(source, shop);

  let title = normalizeGeneratedText(result.optimization.title, source, shop, "title").slice(0, 120);
  if (!includePrice) {
    title = title.replace(/(?:php|usd|\$|€|₱)\s?\d[\d,]*(?:\.\d+)?/gi, " ").replace(/\s+/g, " ").trim();
  }
  if (!title || hasDropshippingLanguage(title) || hasCheapLanguage(title)) {
    title = factualTitle(source, shop);
  }

  let description = normalizeGeneratedText(result.optimization.description, source, shop);
  const descriptionWords = description.split(/\s+/).filter(Boolean);
  const titleToken = stripShopLeaks(cleanCopyText(source?.title || ""), source, shop)
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (
    !description ||
    descriptionWords.length < 8 ||
    looksLikeRemnant(description) ||
    (titleToken && titleToken.length >= 4 && !description.toLowerCase().includes(titleToken)) ||
    description.toLowerCase() === title.toLowerCase() ||
    hasDropshippingLanguage(description) ||
    hasCheapLanguage(description) ||
    hasReviewSuggestion(description)
  ) {
    description = factualDescription(source, shop, voice);
  }
  if (!includePrice && /(?:php|usd|\$|€|₱)\s?\d/.test(description) && !/(?:php|usd|\$|€|₱)\s?\d/.test(cleanCopyText(source?.description || ""))) {
    description = factualDescription(source, shop, voice);
  }

  const bullets = uniqueTexts(
    result.optimization.benefitBullets
      .map((item) => normalizeGeneratedText(item, source, shop))
      .map((item) => item.replace(/\b(with|and|for|the|a|an|of|from|to|in|on)\s*$/i, "").trim())
      .map((item) => (isTypeOnlyFact(item, source) ? listedAsLine(source?.productType || item) : item))
      .filter((item) => item.length >= 4)
      .filter((item) => includePrice || !looksLikePrice(item))
      .filter((item) => !looksLikeRemnant(item))
      .filter((item) => !hasDropshippingLanguage(item) && !hasCheapLanguage(item))
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
  if (
    !callToAction ||
    looksLikeRemnant(callToAction) ||
    sharesSentence(callToAction, description) ||
    hasDropshippingLanguage(callToAction) ||
    /\b(shop now|buy now)\b/i.test(callToAction) ||
    callToAction.length > 160
  ) {
    callToAction = factualCta(source, shop);
  }

  const extraFacts = facts.filter((item) => !isTypeOnlyFact(item, source));
  let conversionCopy = normalizeGeneratedText(result.optimization.conversionCopy, source, shop);
  if (
    !conversionCopy ||
    looksLikeRemnant(conversionCopy) ||
    sharesSentence(conversionCopy, title) ||
    sharesSentence(conversionCopy, description) ||
    hasDropshippingLanguage(conversionCopy)
  ) {
    conversionCopy = extraFacts.length
      ? `Keep the listing factual: ${extraFacts.slice(0, 2).join("; ")}.`
      : `Keep the listing factual: ${title} has no further listed specifications.`;
  }

  let seoTitle = normalizeGeneratedText(result.optimization.seoTitle, source, shop, "title").slice(0, 60);
  if (
    !seoTitle ||
    looksLikeRemnant(seoTitle) ||
    hasDropshippingLanguage(seoTitle) ||
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
    const typed = `${title} ${productType}`.slice(0, 60).trim();
    if (!sharesSentence(typed, title)) seoTitle = typed;
  }

  let metaDescription = normalizeGeneratedText(
    result.optimization.metaDescription,
    source,
    shop
  ).slice(0, 160);
  if (
    !metaDescription ||
    looksLikeRemnant(metaDescription) ||
    sharesSentence(metaDescription, description) ||
    hasDropshippingLanguage(metaDescription) ||
    hasReviewSuggestion(metaDescription)
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
  result.optimization.seoTitle = seoTitle.slice(0, 60);
  result.optimization.metaDescription = metaDescription.slice(0, 160);

  const missing = uniqueTexts([
    ...result.analysis.missingInformation.map((item) => neutralizeAnalysisLine(item, source, shop)),
    ...sparseMissingDetails(source),
  ]).filter(Boolean);
  result.analysis.missingInformation = missing.slice(0, 8);
  result.analysis.warnings = uniqueTexts([
    ...result.analysis.warnings.map((item) => neutralizeAnalysisLine(item, source, shop)),
    ...missing.map((item) => `Missing product information: ${item}`),
  ]).filter(Boolean).slice(0, 12);
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
    result.analysis.purchaseMotivation = facts[0]
      ? `The listed facts include ${facts[0]}.`
      : "Only the product name is listed, so the copy stays factual.";
  }
  result.analysis.strongestFeatures = uniqueTexts(
    result.analysis.strongestFeatures
      .map((item) => neutralizeAnalysisLine(item, source, shop))
      .filter(Boolean)
  ).slice(0, 8);
  if (!result.analysis.strongestFeatures.length) {
    result.analysis.strongestFeatures = facts.slice(0, 4);
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
