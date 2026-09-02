import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { dbQuery } from "./database";
import {
  getShopifyClientId,
  getShopifyClientSecret,
  getShopifyClientSecrets,
} from "./shopify-config";
import {
  decryptShopifyToken,
  encryptShopifyToken,
  SHOPIFY_TOKEN_COOKIE,
} from "./shopify-session";
import { normalizeShop } from "./shop-domain";
import { revokeShopifyInstallation, upsertShop } from "./shops";

export { normalizeShop } from "./shop-domain";

export class ShopifyAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = "ShopifyAuthError";
  }
}

function decodeJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function getShopifyIdToken(request: NextRequest): string {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-shopify-session-token")?.trim() ||
    ""
  );
}

type VerifiedShopifyIdentity = {
  shop: string;
  userId: string;
  credentialSecret: string;
};

function verifyShopifyIdTokenCredential(token: string): VerifiedShopifyIdentity {
  const apiKey = getShopifyClientId();
  const apiSecrets = getShopifyClientSecrets();
  if (!apiKey || apiSecrets.length === 0) {
    throw new ShopifyAuthError("Shopify credentials are not configured.", 500);
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new ShopifyAuthError("A valid Shopify session is required.");
  }

  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (!header || !payload || header.alg !== "HS256") {
    throw new ShopifyAuthError("Invalid Shopify session token.");
  }

  const received = Buffer.from(parts[2], "base64url");
  const credentialSecret = apiSecrets.find((secret) => {
    const expected = createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!credentialSecret) {
    throw new ShopifyAuthError("Invalid Shopify session signature.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== apiKey ||
    typeof payload.exp !== "number" ||
    payload.exp <= now ||
    (typeof payload.nbf === "number" && payload.nbf > now + 60) ||
    typeof payload.dest !== "string"
  ) {
    throw new ShopifyAuthError("Shopify session is expired or invalid.");
  }

  const shop = normalizeShop(payload.dest);
  if (!shop) throw new ShopifyAuthError("Shopify session has an invalid store.");

  return {
    shop,
    userId: typeof payload.sub === "string" ? payload.sub : "",
    credentialSecret,
  };
}

export function verifyShopifyIdToken(token: string): { shop: string; userId: string } {
  const { shop, userId } = verifyShopifyIdTokenCredential(token);
  return { shop, userId };
}

export async function saveShopifySession(
  shop: string,
  accessToken: string,
  scope = ""
): Promise<void> {
  const normalized = await upsertShop(shop, { scopes: scope });
  if (!accessToken) {
    throw new ShopifyAuthError("Cannot save an invalid Shopify session.", 400);
  }

  const encrypted = encryptShopifyToken(accessToken);
  await dbQuery(
    `INSERT INTO shopify_sessions (
       shop, encrypted_access_token, scope, token_version, encryption_kid,
       revoked_at, installed_at, updated_at
     ) VALUES ($1, $2, $3, 1, 'v1', NULL, NOW(), NOW())
     ON CONFLICT (shop) DO UPDATE SET
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       scope = EXCLUDED.scope,
       token_version = shopify_sessions.token_version + 1,
       encryption_kid = 'v1',
       revoked_at = NULL,
       updated_at = NOW()`,
    [normalized, encrypted, scope]
  );
}

async function storedAccessToken(shop: string): Promise<string> {
  const normalized = normalizeShop(shop);
  const rows = await dbQuery<{ encrypted_access_token: string }>(
    `SELECT encrypted_access_token
     FROM shopify_sessions
     WHERE shop = $1
       AND revoked_at IS NULL
     LIMIT 1`,
    [normalized]
  );
  return decryptShopifyToken(String(rows[0]?.encrypted_access_token || ""));
}

async function exchangeOfflineToken(
  shop: string,
  idToken: string,
  credentialSecret = getShopifyClientSecret()
): Promise<string> {
  const apiKey = getShopifyClientId();
  if (!apiKey || !credentialSecret) {
    throw new ShopifyAuthError("Shopify credentials are not configured.", 500);
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: apiKey,
      client_secret: credentialSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }).toString(),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new ShopifyAuthError(
      data?.error_description || data?.error || "Shopify token exchange failed.",
      response.status === 400 ? 401 : 502
    );
  }

  await saveShopifySession(shop, data.access_token, data.scope || "");
  return data.access_token;
}

export async function authenticateShopifyRequest(
  request: NextRequest,
  requireAccessToken = true
): Promise<{ shop: string; accessToken: string; userId: string }> {
  const idToken = getShopifyIdToken(request);
  let idTokenError: unknown = null;

  if (idToken) {
    try {
      const identity = verifyShopifyIdTokenCredential(idToken);
      if (!requireAccessToken) return { ...identity, accessToken: "" };

      const saved = await storedAccessToken(identity.shop);
      return {
        ...identity,
        accessToken:
          saved ||
          await exchangeOfflineToken(
            identity.shop,
            idToken,
            identity.credentialSecret
          ),
      };
    } catch (error) {
      // An older Shopify app configuration can send an ID token signed for a
      // different app secret. Preserve secure standalone OAuth compatibility:
      // use the encrypted, server-issued connection cookies when available.
      idTokenError = error;
    }
  }

  // Compatibility for merchants using Virello outside the embedded admin.
  const shop = normalizeShop(request.cookies.get("virello_shopify_shop")?.value || "");
  const accessToken = decryptShopifyToken(
    request.cookies.get(SHOPIFY_TOKEN_COOKIE)?.value || ""
  );
  if (!shop || (requireAccessToken && !accessToken)) {
    if (idTokenError instanceof Error) {
      throw idTokenError;
    }
    throw new ShopifyAuthError("Shopify connection is missing. Please open Virello from Shopify Admin.");
  }

  if (requireAccessToken) {
    const persisted = await storedAccessToken(shop).catch(() => "");
    if (!persisted) await saveShopifySession(shop, accessToken);
  }

  return { shop, accessToken, userId: "" };
}

export async function deleteShopifyData(shop: string): Promise<void> {
  await revokeShopifyInstallation(shop);
}
