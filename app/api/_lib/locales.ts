export type AppLocale = "en" | "fil";

export const UI_LANG_COOKIE = "virello_ui_lang";
export const OUTPUT_LANG_COOKIE = "virello_output_lang";

export function parseAppLocale(value: unknown): AppLocale {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "fil" || raw === "tl" || raw === "fil-ph") return "fil";
  return "en";
}

export function localeLabel(locale: AppLocale): string {
  return locale === "fil" ? "FIL" : "EN";
}
