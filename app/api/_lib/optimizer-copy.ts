import { stripHtml } from "./listing-html";
import { normalizeShop } from "./shop-domain";
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

const GENERIC_FILLER =
  /\b(best|premium|amazing|quality|stunning|exclusive|must[- ]have|perfect gift|top rated|shop now|buy now|deal of|hot sale|luxury(?: lifestyle)?|affordable|high[- ]end|unbeatable|world[- ]class|ultimate)\b/gi;

const ROMAN_SLASH = /\b[ivxlcdm]{1,6}\/[a-z][\w-]*/gi;
const INCOMPLETE_TAIL = /\b(with|and|for|the|a|an|of|from|to|in|on)\s*$/i;
const TRAILING_JUNK = /[\s|:;,.–—/-]+$/g;

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

function stripGenericFiller(value: string, product?: OptimizerProduct): string {
  return value.replace(GENERIC_FILLER, (match) =>
    tokenAllowedInProduct(match, product) ? match : " "
  );
}

export function normalizeGeneratedText(
  value: unknown,
  product?: OptimizerProduct,
  shop?: string,
  kind: "plain" | "title" = "plain"
): string {
  let text = stripShopLeaks(cleanCopyText(value), product, shop);
  text = text.replace(ROMAN_SLASH, " ");
  text = stripGenericFiller(text, product);
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
  const phrases = uniqueTexts(
    [
      cleanCopyText(product.productType),
      cleanCopyText(product.vendor),
      [cleanCopyText(product.vendor), cleanCopyText(product.productType)]
        .filter(Boolean)
        .join(" "),
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
      [cleanCopyText(product.title).split(" ").slice(0, 4).join(" "), cleanCopyText(product.productType)]
        .filter(Boolean)
        .join(" "),
      ...phrases,
      ...tokens,
    ]
      .map((item) => stripShopLeaks(item, product, shop))
      .filter((item) => item.length >= 3 && item.length <= 48)
  ).slice(0, 12);
  return {
    tags: tags.filter((item) => !shopContentLeakTokens(shop).some((leak) => item.toLowerCase().includes(leak))),
    keywords: keywords.filter(
      (item) => !shopContentLeakTokens(shop).some((leak) => item.toLowerCase().includes(leak))
    ),
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

function factualCta(product?: OptimizerProduct, shop?: string): string {
  const title = stripShopLeaks(cleanCopyText(product?.title || "this product"), product, shop);
  const type = stripShopLeaks(cleanCopyText(product?.productType || ""), product, shop);
  return ["Choose", title, type ? `as listed (${type}).` : "from the facts on this listing."]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);
}

export function applyCopyGuards(
  result: OptimizationResult,
  source?: OptimizerProduct,
  shop?: string
): OptimizationResult {
  const title = normalizeGeneratedText(result.optimization.title, source, shop, "title").slice(0, 120);
  let description = normalizeGeneratedText(result.optimization.description, source, shop);
  if (!description || description.toLowerCase() === title.toLowerCase()) {
    description = normalizeGeneratedText(
      [source?.title, source?.description, source?.productType, source?.vendor]
        .map((item) => cleanCopyText(item))
        .filter(Boolean)
        .join(". "),
      source,
      shop
    ).slice(0, 900);
  }

  const inferred = tagsAndKeywordsFromProduct(source, shop);
  const bullets = uniqueTexts(
    result.optimization.benefitBullets
      .map((item) => normalizeGeneratedText(item, source, shop))
      .filter((item) => item.length >= 4)
  ).slice(0, 8);
  if (!bullets.length) {
    bullets.push(...inferred.tags.slice(0, 4));
  }
  const tags = uniqueTexts([
    ...sanitizeLabelList(result.optimization.tags, source, shop),
    ...inferred.tags,
  ]).slice(0, 20);
  const keywords = uniqueTexts([
    ...sanitizeLabelList(result.optimization.keywords, source, shop),
    ...inferred.keywords,
  ]).slice(0, 20);

  let callToAction = normalizeGeneratedText(result.optimization.callToAction, source, shop);
  if (
    !callToAction ||
    callToAction.toLowerCase() === description.toLowerCase() ||
    callToAction.length > 160
  ) {
    callToAction = factualCta(source, shop);
  }

  let conversionCopy = normalizeGeneratedText(result.optimization.conversionCopy, source, shop);
  if (!conversionCopy || conversionCopy.toLowerCase() === title.toLowerCase()) {
    conversionCopy = bullets.slice(0, 2).join(" ") || description;
  }

  result.optimization.title = title || cleanCopyText(source?.title || "");
  result.optimization.description = description;
  result.optimization.benefitBullets = bullets;
  result.optimization.tags = tags;
  result.optimization.keywords = keywords;
  result.optimization.callToAction = callToAction;
  result.optimization.conversionCopy = conversionCopy;
  result.optimization.seoTitle = normalizeGeneratedText(
    result.optimization.seoTitle,
    source,
    shop,
    "title"
  ).slice(0, 60);
  result.optimization.metaDescription = normalizeGeneratedText(
    result.optimization.metaDescription,
    source,
    shop
  ).slice(0, 160);

  result.analysis.targetCustomer = normalizeGeneratedText(
    result.analysis.targetCustomer,
    source,
    shop
  );
  result.analysis.purchaseMotivation = normalizeGeneratedText(
    result.analysis.purchaseMotivation,
    source,
    shop
  );
  result.analysis.strongestFeatures = uniqueTexts(
    result.analysis.strongestFeatures
      .map((item) => normalizeGeneratedText(item, source, shop))
      .filter(Boolean)
  ).slice(0, 8);
  result.analysis.weaknesses = uniqueTexts(
    result.analysis.weaknesses
      .map((item) => normalizeGeneratedText(item, source, shop))
      .filter(Boolean)
  ).slice(0, 8);
  result.analysis.conversionOpportunities = uniqueTexts(
    result.analysis.conversionOpportunities
      .map((item) => normalizeGeneratedText(item, source, shop))
      .filter(Boolean)
  ).slice(0, 8);
  result.analysis.benefitBullets = uniqueTexts([
    ...result.optimization.benefitBullets,
    ...result.analysis.benefitBullets.map((item) => normalizeGeneratedText(item, source, shop)),
  ]).slice(0, 8);
  result.analysis.objections = result.analysis.objections
    .map((row) => ({
      objection: normalizeGeneratedText(row.objection, source, shop),
      response: normalizeGeneratedText(row.response, source, shop),
    }))
    .filter((row) => row.objection && row.response);

  return result;
}
