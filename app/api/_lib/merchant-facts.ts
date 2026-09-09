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
    const hits = tokens.filter((token) => hay.includes(token)).length;
    if (hits < Math.min(2, tokens.length)) missing.push(field);
  }
  return missing;
}

export function hasMerchantFacts(facts?: MerchantFacts): boolean {
  return Boolean(facts && MERCHANT_FACT_FIELDS.some((field) => facts[field]));
}

export { LABELS as MERCHANT_FACT_LABELS };
