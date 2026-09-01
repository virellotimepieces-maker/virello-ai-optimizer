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

export function getShopifyClientId(): string {
  return cleanEnvironmentValue(
    process.env.SHOPIFY_API_KEY ||
      process.env.SHOPIFY_CLIENT_ID
  );
}

export function getShopifyClientSecret(): string {
  return cleanEnvironmentValue(
    process.env.SHOPIFY_API_SECRET ||
      process.env.SHOPIFY_CLIENT_SECRET
  );
}
