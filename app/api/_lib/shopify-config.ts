const QUOTE_CHARS = `"'` + "\u201C\u201D\u2018\u2019";

function readEnv(name: string): string | undefined {
  const env = process.env as NodeJS.ProcessEnv;
  return env[name];
}

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

  while (
    trimmed.length >= 2 &&
    QUOTE_CHARS.includes(trimmed[0]) &&
    QUOTE_CHARS.includes(trimmed[trimmed.length - 1])
  ) {
    trimmed = trimmed.slice(1, -1).replace(/^\uFEFF/, "").trim();
  }

  return trimmed;
}

function cleanShopifyCredential(value?: string): string {
  return cleanEnvironmentValue(value).replace(/[^\x21-\x7E]/g, "");
}

export function getShopifyClientId(): string {
  return cleanShopifyCredential(
    readEnv("SHOPIFY_API_KEY") || readEnv("SHOPIFY_CLIENT_ID")
  );
}

export function getShopifyClientSecret(): string {
  return cleanShopifyCredential(
    readEnv("SHOPIFY_API_SECRET") || readEnv("SHOPIFY_CLIENT_SECRET")
  );
}

export function getShopifyClientSecrets(): string[] {
  return [
    readEnv("SHOPIFY_API_SECRET"),
    readEnv("SHOPIFY_CLIENT_SECRET"),
    readEnv("SHOPIFY_API_SECRET_PREVIOUS"),
  ]
    .map(cleanShopifyCredential)
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

export function shopifySecretLooksLikeClientId(
  secret: string,
  clientId = getShopifyClientId()
): boolean {
  if (!secret || !clientId) return false;
  if (secret === clientId) return true;
  for (const prefix of ["shpss_", "shpca_"]) {
    if (secret === `${prefix}${clientId}`) return true;
  }
  return false;
}

export function classifyShopifySecretKind(
  secret: string,
  clientId = getShopifyClientId()
): "id" | "shpss" | "hex" | "other" {
  if (shopifySecretLooksLikeClientId(secret, clientId)) return "id";
  if (secret.startsWith("shpss_") || secret.startsWith("shpca_")) return "shpss";
  if (/^[a-f0-9]+$/i.test(secret)) return "hex";
  return "other";
}
