export type Severity = "critical" | "warning" | "info";
export type UILang = "fil" | "en";
export type ReplyLang = "fil" | "en" | "both";

export type AIKind =
  | "system_prompt"
  | "custom_gpt"
  | "chatbot"
  | "knowledge"
  | "faq"
  | "cursor_rules"
  | "brand_voice";

export type IssueCode =
  | "empty_contents"
  | "too_short"
  | "placeholder_lorem"
  | "template_leftover"
  | "framer_watermark"
  | "health_template_bleed"
  | "empty_faq"
  | "fake_social_proof"
  | "zeroed_metrics"
  | "contradictory_identity"
  | "off_topic_content"
  | "generic_saas_fluff"
  | "missing_identity"
  | "missing_language_policy"
  | "missing_output_format"
  | "missing_refusal"
  | "duplicate_blocks"
  | "typos_and_gibberish"
  | "unstructured_wall"
  | "invented_features"
  | "wrong_product";

export interface Localized {
  fil: string;
  en: string;
}

export interface Issue {
  code: IssueCode;
  severity: Severity;
  title: Localized;
  detail: Localized;
  excerpt?: string;
  fix: Localized;
}

export interface ExtractedFact {
  kind: "email" | "url" | "name" | "metric" | "question" | "identity" | "feature";
  value: string;
  trusted: boolean;
}

export interface OptimizeInput {
  kind: AIKind;
  contents: string;
  problems: string;
  symptoms: string[];
  language: ReplyLang;
  productName: string;
  productJob: string;
}

export interface Artifact {
  id: string;
  title: Localized;
  filename: string;
  body: string;
}

export interface Identity {
  name: string;
  job: string;
  audience: string;
}

export interface OptimizeResult {
  score: number;
  issues: Issue[];
  summary: Localized;
  identity: Identity;
  extracted: ExtractedFact[];
  artifacts: Artifact[];
  discarded: string[];
}
