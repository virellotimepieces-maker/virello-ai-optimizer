function cleanEnvironmentValue(value?: string): string {
  let trimmed = (value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  if (trimmed.includes("\n")) {
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    trimmed = lines[lines.length - 1] || trimmed;
  }

  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).replace(/^\uFEFF/, "").trim();
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

export function getShopifyClientSecrets(): string[] {
  return [
    process.env.SHOPIFY_API_SECRET,
    process.env.SHOPIFY_CLIENT_SECRET,
    process.env.SHOPIFY_API_SECRET_PREVIOUS,
  ]
    .map(cleanEnvironmentValue)
    .filter((value, index, values) => value && values.indexOf(value) === index);
}
