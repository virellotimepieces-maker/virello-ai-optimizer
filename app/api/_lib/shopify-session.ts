import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getShopifyClientSecret } from "./shopify-config";

export const SHOPIFY_TOKEN_COOKIE = "virello_shopify_access_token";

function cleanValue(value?: string): string {
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

function encryptionKeys(): Buffer[] {
  // Tokens created by the original release used SHOPIFY_TOKEN_ENCRYPTION_KEY.
  // Later releases used SHOPIFY_API_SECRET. Keep both so existing merchants
  // remain connected while new tokens continue to be encrypted securely.
  const candidates = [
    cleanValue(process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY),
    getShopifyClientSecret(),
  ].filter((value, index, values) =>
    value.length >= 32 && values.indexOf(value) === index
  );

  if (!candidates.length) {
    throw new Error(
      "SHOPIFY_TOKEN_ENCRYPTION_KEY or SHOPIFY_API_SECRET must be configured."
    );
  }

  return candidates.map((secret) =>
    createHash("sha256").update(secret, "utf8").digest()
  );
}

export function encryptShopifyToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKeys()[0], iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptShopifyToken(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) return "";

  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(ivValue, "base64url")
      );
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      // Try the next configured historical key.
    }
  }

  return "";
}
