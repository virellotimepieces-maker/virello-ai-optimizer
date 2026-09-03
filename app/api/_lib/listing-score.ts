export type ListingGrade = "high" | "good" | "needs_work";

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
  if (overall >= 68) return "high";
  if (overall >= 52) return "good";
  return "needs_work";
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
    input.title.trim().toLowerCase() !== input.sourceTitle.trim().toLowerCase()
  ) {
    title += 16;
  }

  const descriptionWords = wordCount(input.description);
  let description = 22;
  if (descriptionWords >= 60) description += 28;
  else if (descriptionWords >= 30) description += 18;
  else if (descriptionWords >= 12) description += 8;
  if (input.benefitBullets.length >= 3) description += 22;
  else if (input.benefitBullets.length >= 1) description += 10;
  description -= Math.min(18, Math.max(0, input.missingInformation) * 6);

  const seoTitleLength = input.seoTitle.trim().length;
  const metaLength = input.metaDescription.trim().length;
  let seo = 16;
  if (seoTitleLength >= 45 && seoTitleLength <= 70) seo += 32;
  else if (seoTitleLength >= 20) seo += 14;
  if (metaLength >= 120 && metaLength <= 160) seo += 32;
  else if (metaLength >= 70) seo += 14;
  if (input.tags.length >= 4) seo += 12;
  else if (input.tags.length >= 1) seo += 6;

  let conversion = 16;
  if (input.conversionCopy.trim().length >= 50) conversion += 22;
  else if (input.conversionCopy.trim().length >= 20) conversion += 10;
  if (input.callToAction.trim().length >= 12) conversion += 16;
  if (input.conversionOpportunities.length >= 2) conversion += 16;
  else if (input.conversionOpportunities.length >= 1) conversion += 8;
  if (input.objections >= 1) conversion += 14;
  if (input.targetCustomer.trim()) conversion += 10;

  const scores = {
    title: clampScore(title),
    description: clampScore(description),
    seo: clampScore(seo),
    conversion: clampScore(conversion),
  };
  const overall = clampScore(
    scores.title * 0.2 + scores.description * 0.3 + scores.seo * 0.2 + scores.conversion * 0.3 +
      (scores.title >= 50 && scores.description >= 50 && scores.seo >= 50 && scores.conversion >= 50
        ? 10
        : 0)
  );
  return { ...scores, overall, grade: gradeForScore(overall) };
}
