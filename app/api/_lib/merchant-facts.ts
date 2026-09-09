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
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
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
  return MERCHANT_FACT_FIELDS.map((field) => facts[field] || "")
    .filter(Boolean)
    .join(" \n ");
}

export function merchantFactLines(facts?: MerchantFacts): string[] {
  if (!facts) return [];
  const lines: string[] = [];
  for (const field of MERCHANT_FACT_FIELDS) {
    const value = facts[field];
    if (!value) continue;
    if (field === "movement" && !/\bmovement\b/i.test(value)) {
      lines.push(`${value} movement`);
    } else {
      lines.push(`${LABELS[field]} ${value}`);
    }
  }
  return lines;
}

export function hasMerchantFacts(facts?: MerchantFacts): boolean {
  return Boolean(facts && MERCHANT_FACT_FIELDS.some((field) => facts[field]));
}
