import { copyHasBrokenGrammar } from "./copy-quality";

export const SEO_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 160;

export type ListingGrade = "needs_work" | "good" | "strong" | "excellent";

export type ListingScores = {
  overall: number;
  title: number;
  description: number;
  seo: number;
  conversion: number;
  grade: ListingGrade;
};

export type ScoredListing = {
  sourceTitle: string;
  title: string;
  description: string;
  benefitBullets: string[];
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  callToAction: string;
  conversionCopy: string;
  conversionOpportunities: string[];
  objections: number;
  targetCustomer: string;
  missingInformation: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function wordCount(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function gradeForScore(overall: number): ListingGrade {
  if (overall >= 90) return "excellent";
  if (overall >= 80) return "strong";
  if (overall >= 70) return "good";
  return "needs_work";
}

export function scoreLimitExplanation(missing: string[]): string[] {
  const gaps = missing.map((item) => item.trim()).filter(Boolean);
  if (gaps.length < 2) return [];
  return [
    "This score is limited by missing product facts. It cannot honestly reach Strong or Excellent until those details are provided.",
    ...gaps.map((item) => `Would improve the score: ${item}`),
  ];
}

function isGenericMerchantNote(value: string): boolean {
  return /keep the listing factual|no further listed specifications|score is limited|use these listed facts|customer copy|only the product name and type are listed|\bthis product has\b|\blists introducing\b|\w+\s+lists\s+(?:introducing|the)\b/i.test(
    value
  );
}

export function scoreListing(input: ScoredListing): ListingScores {
  const titleLength = input.title.trim().length;
  const titleWords = wordCount(input.title);
  let title = 26;
  if (titleLength >= 24 && titleLength <= 90) title += 30;
  else if (titleLength >= 12) title += 14;
  if (titleWords >= 5) title += 12;
  if (/\b(with|for|from)\b/i.test(input.title)) title += 8;
  if (
    input.title.trim() &&
    input.sourceTitle.trim() &&
    input.title.trim().toLowerCase() !== input.sourceTitle.trim().toLowerCase()
  ) {
    title += 16;
  }

  const descriptionWords = wordCount(input.description);
  let description = 18;
  if (descriptionWords >= 60) description += 28;
  else if (descriptionWords >= 30) description += 16;
  else if (descriptionWords >= 12) description += 8;
  if (input.benefitBullets.length >= 3) description += 22;
  else if (input.benefitBullets.length >= 1) description += 10;
  description -= Math.min(24, Math.max(0, input.missingInformation) * 5);

  const seoTitleLength = input.seoTitle.trim().length;
  const metaLength = input.metaDescription.trim().length;
  let seo = 16;
  if (seoTitleLength >= 45 && seoTitleLength <= 60) seo += 32;
  else if (seoTitleLength >= 20 && seoTitleLength <= 60) seo += 14;
  if (seoTitleLength > 60) seo -= 20;
  if (metaLength >= 120 && metaLength <= 160) seo += 32;
  else if (metaLength >= 70) seo += 14;
  if (input.tags.length >= 4) seo += 12;
  else if (input.tags.length >= 1) seo += 6;

  const conversionCopy = input.conversionCopy.trim();
  let conversion = 12;
  if (descriptionWords >= 40) conversion += 16;
  else if (descriptionWords >= 20) conversion += 8;
  if (input.benefitBullets.length >= 3) conversion += 14;
  else if (input.benefitBullets.length >= 1) conversion += 6;
  if (input.callToAction.trim().length >= 12) conversion += 12;
  if (conversionCopy.length >= 50 && !isGenericMerchantNote(conversionCopy)) conversion += 10;
  if (input.conversionOpportunities.length >= 2) conversion += 8;
  else if (input.conversionOpportunities.length >= 1) conversion += 4;
  if (input.objections >= 1) conversion += 8;
  if (input.targetCustomer.trim()) conversion += 6;
  conversion -= Math.min(20, Math.max(0, input.missingInformation) * 4);

  const scores = {
    title: clampScore(title),
    description: clampScore(description),
    seo: clampScore(seo),
    conversion: clampScore(conversion),
  };
  const overall = clampScore(
    scores.title * 0.2 + scores.description * 0.3 + scores.seo * 0.2 + scores.conversion * 0.3
  );
  const graded = { ...scores, overall, grade: gradeForScore(overall) };
  if (
    copyHasBrokenGrammar(input.description) ||
    copyHasBrokenGrammar(input.conversionCopy) ||
    copyHasBrokenGrammar(input.callToAction) ||
    copyHasBrokenGrammar(input.title) ||
    copyHasBrokenGrammar(input.metaDescription) ||
    input.benefitBullets.some((item) => copyHasBrokenGrammar(item))
  ) {
    return capBrokenGrammarScores(graded);
  }
  return graded;
}

export function capFallbackScores(
  scores: ListingScores,
  missingInformation: number
): ListingScores {
  const maxOverall = missingInformation >= 2 ? 69 : 79;
  const overall = Math.min(scores.overall, maxOverall);
  return {
    ...scores,
    overall,
    grade: gradeForScore(overall),
  };
}

export function capBrokenGrammarScores(scores: ListingScores): ListingScores {
  const overall = Math.min(scores.overall, 69);
  return {
    ...scores,
    overall,
    grade: gradeForScore(overall),
  };
}
