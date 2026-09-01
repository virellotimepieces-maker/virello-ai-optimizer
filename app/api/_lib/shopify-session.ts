import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const SHOPIFY_TOKEN_COOKIE = "virello_shopify_access_token";

function encryptionKey(): Buffer {
  // Use the Shopify app secret as the stable encryption root. This removes
  // the separate encryption-key setting that previously broke reconnects
  // when it was missing, changed, or configured only in one environment.
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SHOPIFY_API_SECRET must be configured before Shopify tokens can be encrypted."
    );
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptShopifyToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptShopifyToken(value: string): string {
  try {
    const [version, ivValue, tagValue, encryptedValue] = value.split(".");
    if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) return "";

    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}
