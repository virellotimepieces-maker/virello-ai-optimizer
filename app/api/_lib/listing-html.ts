export type ListingCopy = {
  description: string;
  benefitBullets: string[];
  callToAction: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripHtml(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildShopifyDescriptionHtml(copy: ListingCopy): string {
  const paragraphs = copy.description
    .split(/\n{2,}/)
    .map((part) => part.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
  const bullets = copy.benefitBullets.filter(Boolean).slice(0, 8);
  const cta = copy.callToAction.trim();
  const parts: string[] = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`);
  if (bullets.length) {
    parts.push(
      `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
    );
  }
  if (cta) parts.push(`<p><strong>${escapeHtml(cta)}</strong></p>`);
  return parts.join("") || `<p>${escapeHtml(copy.description)}</p>`;
}
