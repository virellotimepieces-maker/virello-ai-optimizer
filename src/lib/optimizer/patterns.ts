export const PLACEHOLDER_RE =
  /\b(lorem ipsum|dolor sit amet|consectetur adipiscing|placeholder|dummy text|sample text|coming soon|insert (here|text|copy)|tk tk|xxx+|tbd|todo:|fixme|your (company|brand|product) here)\b/i;

export const FRAMER_RE =
  /create a free website with framer|framer\.website|website builder loved by startups/i;

export const HEALTH_BLEED_RE =
  /preventable health crises|health (crisis|crises)|patient outcomes|clinical trial/i;

export const SOCIAL_TEMPLATE_RE =
  /ai-powered social intelligence|measure your social performance|#aicontent|#createreconomy|#shortform|#techtrok|live ranking updates every 60 seconds|track 50\+ competitors/i;

export const FAKE_PROOF_RE =
  /trusted by (leading |early adopters|150k|thousands)|join thousands of (teams|creators)|millions of people|used by 150k/i;

export const ZERO_METRIC_RE =
  /\b0%|\b0M\b|\+0K\b|reach,\s*0|engage,\s*0%/i;

export const FLUFF_RE =
  /leverage cutting-edge|transform your (business|workflow)|drive innovation across|bank-level encryption|trained on billions of data points|seamless(ly)? (integration|connected)|next-generation ai|unlock (the )?(full )?potential/i;

export const LANGUAGE_POLICY_RE =
  /language policy|reply in|sumagot sa|default language|tagalog|filipino|always (answer|respond) in/i;

export const OUTPUT_FORMAT_RE =
  /output format|response format|sumagot sa format|json schema|markdown headings|structured output|gamitin ang format/i;

export const REFUSAL_RE =
  /\b(never|do not|don't|huwag|ayaw|must not|you must not|refusal|out of scope)\b/i;

export const IDENTITY_RE =
  /you are\s+[^.\n]{3,80}|ikaw ay\s+[^.\n]{3,80}|your (name|role|job) is/i;

export const TYPO_RE =
  /\b(countires|techtrok|nilalamanlaman|sucess|recieve|seperate|enviroment)\b/i;

export const INVENTED_FEATURE_RE =
  /predictive performance|shopper insights \(powered by|amazon marketing cloud|walmart connect|faceless video/i;

export const PROBLEM_SYMPTOMS = [
  {
    id: "wrong_answers",
    fil: "Mali o gawa-gawa ang sagot",
    en: "Wrong or invented answers",
  },
  {
    id: "template",
    fil: "May leftover template / placeholder",
    en: "Leftover template or placeholder copy",
  },
  {
    id: "mixed_identity",
    fil: "Halo-halo ang identity ng product",
    en: "Product identity is mixed or unclear",
  },
  {
    id: "ignores_rules",
    fil: "Hindi sinusunod ang instructions",
    en: "Ignores instructions",
  },
  {
    id: "empty_faq",
    fil: "FAQ o knowledge walang sagot",
    en: "FAQ or knowledge has no answers",
  },
  {
    id: "fake_metrics",
    fil: "May fake na metrics o social proof",
    en: "Fake metrics or social proof",
  },
  {
    id: "language",
    fil: "Walang clear na language policy",
    en: "No clear language policy",
  },
  {
    id: "off_brand",
    fil: "Off-brand ang tono",
    en: "Tone is off-brand",
  },
] as const;

export const AI_KINDS: {
  id: import("./types").AIKind;
  fil: string;
  en: string;
}[] = [
  { id: "system_prompt", fil: "System prompt", en: "System prompt" },
  { id: "custom_gpt", fil: "Custom GPT / Assistant", en: "Custom GPT / Assistant" },
  { id: "chatbot", fil: "Website chatbot", en: "Website chatbot" },
  { id: "knowledge", fil: "Knowledge base / RAG", en: "Knowledge base / RAG" },
  { id: "faq", fil: "FAQ", en: "FAQ" },
  { id: "cursor_rules", fil: "Cursor / coding agent rules", en: "Cursor / coding agent rules" },
  { id: "brand_voice", fil: "Brand voice", en: "Brand voice" },
];
