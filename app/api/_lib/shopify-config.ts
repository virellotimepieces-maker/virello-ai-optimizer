import { normalizeShop, shopFromShopifyHostParam } from "./shop-domain";

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

/** Public Client ID of the App Store listing app (org Virello AI Optimizer). */
export const SHOPIFY_LISTING_CLIENT_ID = "059b113acaba78d855be9bc9500e421a";

export function getShopifyClientId(): string {
  return cleanShopifyCredential(
    readEnv("SHOPIFY_API_KEY") || readEnv("SHOPIFY_CLIENT_ID")
  );
}

export function getShopifyClientIds(): string[] {
  return [
    getShopifyClientId(),
    cleanShopifyCredential(
      readEnv("SHOPIFY_API_KEY_PREVIOUS") || readEnv("SHOPIFY_CLIENT_ID_PREVIOUS")
    ),
    SHOPIFY_LISTING_CLIENT_ID,
  ].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

function sessionTokenAudience(token: string): string {
  const parts = token.split(".");
  if (parts.length < 2) return "";
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      aud?: unknown;
    };
    return typeof payload.aud === "string" ? payload.aud.trim() : "";
  } catch {
    return "";
  }
}

function isListingDevShop(shop: string): boolean {
  const normalized = normalizeShop(shop) || shop.trim().toLowerCase();
  return (
    normalized === "virello-dev.myshopify.com" ||
    normalized === "virello-dev"
  );
}

/** App Bridge meta key for this request: listing app vs live app. */
export function resolveShopifyAppBridgeApiKey(search = ""): string {
  const primary = getShopifyClientId();
  const allowed = getShopifyClientIds();
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const audience = sessionTokenAudience(params.get("id_token") || "");
  if (audience && allowed.includes(audience)) return audience;

  const shop =
    normalizeShop(params.get("shop") || "") ||
    shopFromShopifyHostParam(params.get("host") || "");
  if (isListingDevShop(shop) && allowed.includes(SHOPIFY_LISTING_CLIENT_ID)) {
    return SHOPIFY_LISTING_CLIENT_ID;
  }

  return primary;
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
