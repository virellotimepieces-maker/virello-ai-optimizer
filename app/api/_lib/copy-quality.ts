const CONNECTOR_TAIL =
  /\b(?:and|or|but|with|for|the|a|an|of|from|to|in|on|at|by|as|and\/or)\s*$/i;
const STACKED_CONNECTOR =
  /\b(?:for|with|to|of|from|in|on|at|by|as)\s+(?:and|or)\b/i;
const DUPLICATE_CONNECTOR = /\b(and|or|for|with|to|of|the|a)\s+\1\b/i;
const DUPLICATE_PUNCT = /[,.;:!?]\s*[,.;:!?]+/;
const ARTICLE_GAP = /\b(a|an|the)\s+and\s+(a|an|the)\b/i;
const FRAGMENT_LEAD = /^(?:and|or|but|with|for|to|of|from|nor)\b/i;
const BARE_FOR =
  /\b(?:ideal|perfect|suitable|designed|made|great|best)\s+for\s*$/i;
const GENERIC_OCCASION =
  /\b(?:ideal|perfect|suitable|great)\s+for(?:\s+and)?\s+(?:various|any)\s+occasions\b/i;
const EMPTY_POINTING = /\b(?:with|for)\s+(?:this|that|it)(?=\s*[.!?]|,$|$)/i;
const VAGUE_BRAND =
  /\b(?:comprehensive\s+brand\s+identity|lack of comprehensive brand|limited product details may affect purchasing(?: decisions)?)\b/i;

export type CopyQualityReport = {
  text: string;
  issues: string[];
  uncertain: boolean;
};

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function cleanQualityText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function sentences(value: string): string[] {
  const text = cleanQualityText(value);
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function clipSentence(value: string): string {
  return cleanQualityText(value).replace(/[.!?,;:]+$/g, "").trim();
}

function isInchMeasurement(value: string): boolean {
  return /\d(?:[\d./]*\s*)?(?:x\s*\d[\d./]*\s*)*in$/i.test(clipSentence(value));
}

function hasDanglingTail(value: string): boolean {
  const clipped = clipSentence(value);
  if (!clipped || isInchMeasurement(clipped)) return false;
  return CONNECTOR_TAIL.test(clipped);
}

function wordCount(value: string): number {
  return clipSentence(value).split(/\s+/).filter(Boolean).length;
}

export function isVagueBrandIdentityWarning(value: string): boolean {
  return VAGUE_BRAND.test(cleanQualityText(value));
}

export function detectCopyQualityIssues(value: string): string[] {
  const text = cleanQualityText(value);
  if (!text) return [];
  const issues: string[] = [];
  if (DUPLICATE_PUNCT.test(text)) issues.push("Duplicated punctuation");
  if (DUPLICATE_CONNECTOR.test(text)) issues.push("Duplicated connectors");
  if (ARTICLE_GAP.test(text)) issues.push("Empty phrase");
  if (GENERIC_OCCASION.test(text)) issues.push("Incomplete phrase: ideal for and various occasions");
  if (EMPTY_POINTING.test(text)) issues.push("Empty phrase");
  if (STACKED_CONNECTOR.test(text) && !/\bto and from\b/i.test(text)) {
    issues.push("Dangling and/or after a preposition");
  }
  for (const sentence of sentences(text)) {
    const clipped = clipSentence(sentence);
    if (!clipped) {
      issues.push("Sentence fragment");
      continue;
    }
    if (hasDanglingTail(clipped)) issues.push("Dangling and/or or preposition");
    if (BARE_FOR.test(clipped)) issues.push("Incomplete phrase");
    const words = wordCount(clipped);
    if (words <= 4 && FRAGMENT_LEAD.test(clipped)) issues.push("Sentence fragment");
    if (words <= 3 && /^(?:this|it|the product)\s+\w+$/i.test(clipped)) {
      issues.push("Sentence fragment");
    }
  }
  return unique(issues);
}

function polish(value: string): string {
  let text = cleanQualityText(value);
  if (!text) return "";
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/([,.;:!?])\1+/g, "$1");
  text = text.replace(/,\s*\./g, ".");
  text = text.replace(/\.\s*\./g, ".");
  text = text.replace(/\s+\./g, ".");
  text = text.replace(/^[,.;:!?]+/, "").replace(/[,:;]+$/, "").trim();
  return text.replace(/\s+/g, " ").trim();
}

function repairPass(value: string): string {
  let text = cleanQualityText(value);
  if (!text) return "";
  text = text.replace(/\bto and from\b/gi, "TO_AND_FROM");
  text = text.replace(GENERIC_OCCASION, " ");
  text = text.replace(EMPTY_POINTING, " ");
  text = text.replace(/([,.;:!?])\s*\1+/g, "$1");
  text = text.replace(/\b(and|or|for|with|to|of|the|a)\s+\1\b/gi, "$1");
  text = text.replace(/\b(a|an|the)\s+and\s+(a|an|the)\b/gi, "$2");
  text = text.replace(/\b(?:for|with|to|of|from|in|on|at|by|as)\s+(?:and|or)\b/gi, (match) => {
    return match.split(/\s+/)[0] || match;
  });
  text = text.replace(/TO_AND_FROM/g, "to and from");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  return polish(text);
}

function keepSentence(sentence: string): string {
  const repaired = repairPass(sentence);
  const clipped = clipSentence(repaired);
  if (!clipped) return "";
  if (hasDanglingTail(clipped)) return "";
  if (BARE_FOR.test(clipped)) return "";
  if (GENERIC_OCCASION.test(clipped)) return "";
  const words = wordCount(clipped);
  if (words <= 4 && FRAGMENT_LEAD.test(clipped)) return "";
  if (detectCopyQualityIssues(repaired).length) return "";
  return polish(repaired);
}

export function repairCopyQuality(value: unknown, kind: "plain" | "title" = "plain"): CopyQualityReport {
  const original = cleanQualityText(value);
  if (!original) return { text: "", issues: [], uncertain: false };
  const firstPass = repairPass(original);
  if (kind === "title") {
    let title = firstPass
      .split(/[.!\n]/)[0]
      || firstPass;
    title = title.replace(/\b(?:and|or|but|with|for|the|a|an|of|from|to|at|by|as|and\/or)\s*$/i, "").trim();
    if (!/\d\s*in$/i.test(title)) {
      title = title.replace(/\b(?:in|on)\s*$/i, "").trim();
    }
    title = polish(title);
    const issues = detectCopyQualityIssues(title);
    return { text: title, issues, uncertain: issues.length > 0 };
  }
  const kept = sentences(firstPass).map(keepSentence).filter(Boolean);
  const text = polish(kept.join(" "));
  const issues = detectCopyQualityIssues(text);
  return { text, issues, uncertain: issues.length > 0 };
}

export function copyHasBrokenGrammar(value: string): boolean {
  return detectCopyQualityIssues(value).length > 0;
}

export type QualityScanField = {
  name: string;
  text: string;
};

export function collectCopyQualityIssues(
  fields: QualityScanField[],
  product?: { vendor?: string; productType?: string }
): string[] {
  const issues: string[] = [];
  const vendor = cleanQualityText(product?.vendor);
  const type = cleanQualityText(product?.productType);
  for (const field of fields) {
    for (const issue of detectCopyQualityIssues(field.text)) {
      issues.push(`${field.name}: ${issue}`);
    }
    if (isVagueBrandIdentityWarning(field.text) && vendor && type) {
      issues.push(`${field.name}: vague brand-identity warning while vendor and product type are listed`);
    }
  }
  return unique(issues);
}

export function resultQualityFields(result: {
  optimization: {
    title: string;
    description: string;
    benefitBullets: string[];
    seoTitle: string;
    metaDescription: string;
    callToAction: string;
    conversionCopy: string;
  };
  analysis: {
    targetCustomer: string;
    purchaseMotivation: string;
    strongestFeatures: string[];
    weaknesses: string[];
    missingInformation: string[];
    conversionOpportunities: string[];
    warnings: string[];
    objections: Array<{ objection: string; response: string }>;
  };
}): QualityScanField[] {
  return [
    { name: "title", text: result.optimization.title },
    { name: "description", text: result.optimization.description },
    { name: "benefit bullets", text: result.optimization.benefitBullets.join(" ") },
    { name: "CTA", text: result.optimization.callToAction },
    { name: "SEO title", text: result.optimization.seoTitle },
    { name: "meta description", text: result.optimization.metaDescription },
    { name: "high-conversion summary", text: result.optimization.conversionCopy },
    { name: "target customer", text: result.analysis.targetCustomer },
    { name: "purchase motivation", text: result.analysis.purchaseMotivation },
    { name: "strongest features", text: result.analysis.strongestFeatures.join(" ") },
    { name: "weaknesses", text: result.analysis.weaknesses.join(" ") },
    { name: "missing information", text: result.analysis.missingInformation.join(" ") },
    { name: "conversion opportunities", text: result.analysis.conversionOpportunities.join(" ") },
    { name: "warnings", text: result.analysis.warnings.join(" ") },
    ...result.analysis.objections.flatMap((row, index) => [
      { name: `objection ${index + 1}`, text: row.objection },
      { name: `objection response ${index + 1}`, text: row.response },
    ]),
  ];
}

export function rewriteMerchantInsight(
  value: string,
  product?: { vendor?: string; productType?: string }
): string {
  const original = cleanQualityText(value);
  if (!original) return "";
  if (isVagueBrandIdentityWarning(original)) {
    const vendor = cleanQualityText(product?.vendor);
    const type = cleanQualityText(product?.productType);
    if (vendor && type) return "";
    if (!vendor) {
      return "Vendor or brand name is not listed. Add it on the Shopify product before optimizing.";
    }
    if (!type) {
      return "Product type is not listed. Add it on the Shopify product before optimizing.";
    }
    return "";
  }
  const repaired = repairCopyQuality(original);
  if (repaired.uncertain || !repaired.text) return "";
  if (isVagueBrandIdentityWarning(repaired.text)) return "";
  return repaired.text;
}
