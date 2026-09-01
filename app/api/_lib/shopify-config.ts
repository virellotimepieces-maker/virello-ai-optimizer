function cleanEnvironmentValue(value?: string): string {
  const trimmed = value?.trim() || "";

  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

const SHOPIFY_APP_CLIENT_ID = "99a9fad60d48cb24828f243360fffc40";

export function getShopifyClientId(): string {
  // This public identifier must match shopify.app.toml exactly. Keeping the
  // canonical app ID here prevents a mistyped Vercel value from sending the
  // embedded iframe to accounts.shopify.com.
  return SHOPIFY_APP_CLIENT_ID;
}

export function getShopifyClientSecret(): string {
  return cleanEnvironmentValue(
    process.env.SHOPIFY_API_SECRET ||
      process.env.SHOPIFY_CLIENT_SECRET
  );
}
