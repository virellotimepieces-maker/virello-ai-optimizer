export const MERCHANT_FACT_FIELDS = [
  "material",
  "dimensions",
  "movement",
  "waterResistance",
  "warranty",
  "intendedUse",
] as const;

export type MerchantFactField = (typeof MERCHANT_FACT_FIELDS)[number];

export type MerchantFacts = Partial<Record<MerchantFactField, string>>;

const LABELS: Record<MerchantFactField, string> = {
  material: "Material",
  dimensions: "Dimensions",
  movement: "Movement",
  waterResistance: "Water resistance",
  warranty: "Warranty",
  intendedUse: "Intended use",
};

function cleanFactValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function parseMerchantFacts(raw: unknown): MerchantFacts {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const facts: MerchantFacts = {};
  for (const field of MERCHANT_FACT_FIELDS) {
    const value = cleanFactValue(source[field]);
    if (value) facts[field] = value;
  }
  return facts;
}

export function merchantFactHaystack(facts?: MerchantFacts): string {
  if (!facts) return "";
  return MERCHANT_FACT_FIELDS.map((field) => {
    const value = facts[field] || "";
    if (!value) return "";
    return `${LABELS[field]} ${value}`;
  })
    .filter(Boolean)
    .join(" \n ");
}

export function merchantFactValue(field: MerchantFactField, value: string): string {
  const text = cleanFactValue(value);
  if (!text) return "";
  if (field === "movement" && !/\bmovement\b/i.test(text)) {
    return `${text} movement`;
  }
  return text;
}

export function merchantFactLines(facts?: MerchantFacts): string[] {
  if (!facts) return [];
  const lines: string[] = [];
  for (const field of MERCHANT_FACT_FIELDS) {
    const value = facts[field];
    if (!value) continue;
    const customer = merchantFactValue(field, value);
    if (customer) lines.push(customer);
  }
  return lines;
}

export function merchantFactFieldPresent(facts: MerchantFacts | undefined, field: MerchantFactField): boolean {
  return Boolean(cleanFactValue(facts?.[field] || ""));
}

export function merchantFactTokens(value: string): string[] {
  return cleanFactValue(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 || /^\d/.test(token));
}

function factNumberTokens(value: string): string[] {
  return [...cleanFactValue(value).matchAll(/\d+(?:\.\d+)?/g)].map((match) => match[0]);
}

function escapeFactToken(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function haystackHasNumber(hay: string, num: string): boolean {
  if (!num) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escapeFactToken(num)}(?:[^a-z0-9]|$)`, "i").test(hay);
}

export function merchantFactsMissingFromText(
  facts: MerchantFacts | undefined,
  text: string
): MerchantFactField[] {
  if (!facts) return [];
  const hay = (text || "").toLowerCase();
  const missing: MerchantFactField[] = [];
  for (const field of MERCHANT_FACT_FIELDS) {
    const value = facts[field];
    if (!value) continue;
    const tokens = merchantFactTokens(value);
    if (!tokens.length) continue;
    const numbers = factNumberTokens(value);
    if (numbers.length && !numbers.some((num) => haystackHasNumber(hay, num))) {
      missing.push(field);
      continue;
    }
    const wordTokens = [...new Set(tokens.filter((token) => token.length >= 4 && !/^\d/.test(token)))];
    if (wordTokens.length) {
      const hits = wordTokens.filter((token) => hay.includes(token)).length;
      const needed = numbers.length ? 1 : Math.min(2, wordTokens.length);
      if (hits < needed) missing.push(field);
      continue;
    }
    if (!numbers.length && !tokens.some((token) => hay.includes(token))) {
      missing.push(field);
    }
  }
  return missing;
}

export function hasMerchantFacts(facts?: MerchantFacts): boolean {
  return Boolean(facts && MERCHANT_FACT_FIELDS.some((field) => facts[field]));
}

export { LABELS as MERCHANT_FACT_LABELS };
