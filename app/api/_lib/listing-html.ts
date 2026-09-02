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
