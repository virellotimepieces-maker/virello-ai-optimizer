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

/** App Store listing / production app. One Shopify app per deployment. */
export const SHOPIFY_PRODUCTION_CLIENT_ID = "059b113acaba78d855be9bc9500e421a";

/** Retired live-app Client ID that must not share this production URL. */
export const RETIRED_LIVE_SHOPIFY_CLIENT_ID = "99a9fda60d48cb24828f243360fffc40";

export function getShopifyClientId(): string {
  const fromEnv = cleanShopifyCredential(
    readEnv("SHOPIFY_API_KEY") || readEnv("SHOPIFY_CLIENT_ID")
  );
  if (fromEnv === RETIRED_LIVE_SHOPIFY_CLIENT_ID) {
    return SHOPIFY_PRODUCTION_CLIENT_ID;
  }
  return fromEnv;
}

export function getShopifyClientIds(): string[] {
  const primary = getShopifyClientId();
  return primary ? [primary] : [];
}

/** App Bridge meta key: only the app this deployment is configured for. */
export function resolveShopifyAppBridgeApiKey(_search = ""): string {
  void _search;
  return getShopifyClientId();
}

export function shopifyCredentialPresence(): {
  apiKey: boolean;
  apiSecret: boolean;
  clientSecret: boolean;
  previous: boolean;
} {
  return {
    apiKey: Boolean(getShopifyClientId()),
    apiSecret: Boolean(cleanShopifyCredential(readEnv("SHOPIFY_API_SECRET"))),
    clientSecret: Boolean(cleanShopifyCredential(readEnv("SHOPIFY_CLIENT_SECRET"))),
    previous: Boolean(cleanShopifyCredential(readEnv("SHOPIFY_API_SECRET_PREVIOUS"))),
  };
}

export function getShopifyClientSecret(): string {
  return (
    cleanShopifyCredential(readEnv("SHOPIFY_API_SECRET") || readEnv("SHOPIFY_CLIENT_SECRET")) ||
    getShopifyClientSecrets()[0] ||
    ""
  );
}

export function getShopifySecretForClientId(clientId: string): string {
  const wanted = cleanShopifyCredential(clientId);
  const primaryId = getShopifyClientId();
  if (wanted && primaryId && wanted !== primaryId) return "";
  return getShopifyClientSecret();
}

export function getShopifyAppCredentials(): Array<{ clientId: string; secret: string }> {
  const pairs: Array<{ clientId: string; secret: string }> = [];
  const seen = new Set<string>();
  const clientId = getShopifyClientId();
  const add = (secret: string) => {
    if (!clientId || !secret) return;
    const key = `${clientId}:${secret}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ clientId, secret });
  };
  add(getShopifyClientSecret());
  add(cleanShopifyCredential(readEnv("SHOPIFY_API_SECRET_PREVIOUS")));
  return pairs;
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
