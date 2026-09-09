const SENSITIVE =
  /OPENAI_API_KEY|SHOPIFY_API_(?:KEY|SECRET)|SHOPIFY_CLIENT_SECRET|SHOPIFY_TOKEN_ENCRYPTION_KEY|DATABASE_URL|client_secret|sk_live_|sk_test_|whsec_|shpat_|shpss_|shpca_|Bearer\s+[A-Za-z0-9._-]+/i;

export function publicErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message || SENSITIVE.test(message)) return fallback;
  if (message.length > 240) return fallback;
  return message;
}

export function knownStatus(error: unknown): number | undefined {
  const status = (error as { status?: number })?.status;
  return typeof status === "number" && status >= 400 && status < 600 ? status : undefined;
}
