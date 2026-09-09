export const BRAND_VOICES = [
  "refined",
  "minimal",
  "warm",
  "bold",
  "value",
] as const;

export type BrandVoice = (typeof BRAND_VOICES)[number];

export const DEFAULT_BRAND_VOICE: BrandVoice = "refined";

const VOICE_ALIASES: Record<string, BrandVoice> = {
  refined: "refined",
  premium: "refined",
  "refined-premium": "refined",
  "refined & premium": "refined",
  minimal: "minimal",
  clean: "minimal",
  "clean-minimal": "minimal",
  "clean & minimal": "minimal",
  warm: "warm",
  approachable: "warm",
  "warm-approachable": "warm",
  "warm & approachable": "warm",
  bold: "bold",
  modern: "bold",
  "bold-modern": "bold",
  "bold & modern": "bold",
  value: "value",
  "value-focused": "value",
  "value focused": "value",
};

export function parseBrandVoice(value: unknown): BrandVoice {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return VOICE_ALIASES[key] || DEFAULT_BRAND_VOICE;
}

export function brandVoiceInstruction(voice: BrandVoice): string {
  switch (voice) {
    case "minimal":
      return "Brand voice: Clean & minimal. Short sentences, little ornament, no hype. Name only verified facts.";
    case "warm":
      return "Brand voice: Warm & approachable. Plain, courteous retail English. No slang, no urgency, no fake familiarity.";
    case "bold":
      return "Brand voice: Bold & modern. Direct and contemporary, still restrained. Do not shout, boast, or use dropshipping clichés.";
    case "value":
      return "Brand voice: Value-focused. You may mention a listed price once as a practical detail. Never call the product cheap, budget, or low-quality, and never make price the only benefit.";
    default:
      return "Brand voice: Refined & premium. Calm, precise, unhurried specialty-retail tone. Do not call the product premium, luxury, high-end, affordable, or elegant unless those words are in the source. Never lead with price or use phrases such as affordable elegance, budget-friendly, or priced at just.";
  }
}
