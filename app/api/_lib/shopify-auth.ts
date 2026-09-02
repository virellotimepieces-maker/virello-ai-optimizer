import { NextRequest } from "next/server";
import { shopFromSessionCookie } from "./app-session";
import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";
import { revokeShopifyInstallation, upsertShop } from "./shops";
import { decryptShopifyToken, encryptShopifyToken } from "./shopify-session";
import {
  getShopifyIdToken,
  ShopifySecurityError,
  verifyShopifySessionToken,
} from "./shopify-security";
import {
  getShopifyClientId,
  getShopifyClientSecret,
} from "./shopify-config";

export { normalizeShop } from "./shop-domain";
export { getShopifyIdToken, verifyShopifySessionToken } from "./shopify-security";

export class ShopifyAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = "ShopifyAuthError";
  }
}

function asAuthError(error: unknown): ShopifyAuthError {
  if (error instanceof ShopifyAuthError) return error;
  if (error instanceof ShopifySecurityError) {
    return new ShopifyAuthError(error.message, error.status);
  }
  return new ShopifyAuthError(
    error instanceof Error ? error.message : "Shopify authorization failed."
  );
}

export function verifyShopifyIdToken(token: string): { shop: string; userId: string } {
  const { shop, userId } = verifyShopifySessionToken(token);
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
      const identity = verifyShopifySessionToken(idToken);
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
      idTokenError = error;
    }
  }

  const sessionShop = await shopFromSessionCookie(request);
  if (sessionShop) {
    const accessToken = requireAccessToken
      ? await storedAccessToken(sessionShop)
      : "";
    if (!requireAccessToken || accessToken) {
      return { shop: sessionShop, accessToken, userId: "" };
    }
  }

  throw asAuthError(
    idTokenError ||
      new ShopifyAuthError(
        "Shopify connection is missing. Please open Virello from Shopify Admin."
      )
  );
}

export async function deleteShopifyData(shop: string): Promise<void> {
  await revokeShopifyInstallation(shop);
}
