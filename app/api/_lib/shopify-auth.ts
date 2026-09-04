import { NextRequest } from "next/server";
import { shopFromSessionCookie } from "./app-session";
import { dbQuery } from "./database";
import { normalizeShop } from "./shop-domain";
import { revokeShopifyInstallation, upsertShop, isShopifyInstallationActive } from "./shops";
import { decryptShopifyToken, encryptShopifyToken } from "./shopify-session";
import {
  getShopifyIdToken,
  ShopifySecurityError,
  verifyShopifySessionToken,
  type VerifiedShopifyIdentity,
} from "./shopify-security";
import {
  getShopifyAppCredentials,
  getShopifyClientId,
  getShopifyClientSecret,
  getShopifySecretForClientId,
} from "./shopify-config";

export { normalizeShop } from "./shop-domain";
export { getShopifyIdToken, verifyShopifySessionToken } from "./shopify-security";

export const SHOPIFY_RETRY_SESSION_HEADER = "X-Shopify-Retry-Invalid-Session-Request";
export const SHOPIFY_REAUTHORIZE_HEADER = "X-Shopify-API-Request-Failure-Reauthorize-Url";

const ACCESS_TOKEN_SKEW_MS = 30_000;

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

export function shopifyAuthErrorHeaders(reauthorizeUrl = ""): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    [SHOPIFY_RETRY_SESSION_HEADER]: "1",
  };
  if (reauthorizeUrl) {
    headers[SHOPIFY_REAUTHORIZE_HEADER] = reauthorizeUrl;
  }
  return headers;
}

export function verifyShopifyIdToken(token: string): { shop: string; userId: string } {
  const { shop, userId } = verifyShopifySessionToken(token);
  return { shop, userId };
}

export type ShopifySessionSecrets = {
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
};

function expiryTimestamp(seconds?: number): string | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function isExpired(value: string | Date | null | undefined, skewMs = ACCESS_TOKEN_SKEW_MS): boolean {
  if (!value) return false;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return time <= Date.now() + skewMs;
}

export async function saveShopifySession(
  shop: string,
  accessToken: string,
  scope = "",
  secrets: ShopifySessionSecrets = {}
): Promise<void> {
  const normalized = await upsertShop(shop, { scopes: scope });
  if (!accessToken) {
    throw new ShopifyAuthError("Cannot save an invalid Shopify session.", 400);
  }

  const encrypted = encryptShopifyToken(accessToken);
  const encryptedRefresh = secrets.refreshToken
    ? encryptShopifyToken(secrets.refreshToken)
    : "";
  await dbQuery(
    `INSERT INTO shopify_sessions (
       shop, encrypted_access_token, encrypted_refresh_token, scope, token_version,
       encryption_kid, access_token_expires_at, refresh_token_expires_at,
       revoked_at, installed_at, updated_at
     ) VALUES ($1, $2, $3, $4, 1, 'v1', $5, $6, NULL, NOW(), NOW())
     ON CONFLICT (shop) DO UPDATE SET
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       encrypted_refresh_token = CASE
         WHEN EXCLUDED.encrypted_refresh_token = '' THEN shopify_sessions.encrypted_refresh_token
         ELSE EXCLUDED.encrypted_refresh_token
       END,
       scope = EXCLUDED.scope,
       token_version = shopify_sessions.token_version + 1,
       encryption_kid = 'v1',
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       refresh_token_expires_at = CASE
         WHEN EXCLUDED.encrypted_refresh_token = '' THEN shopify_sessions.refresh_token_expires_at
         ELSE EXCLUDED.refresh_token_expires_at
       END,
       revoked_at = NULL,
       updated_at = NOW()`,
    [
      normalized,
      encrypted,
      encryptedRefresh,
      scope,
      expiryTimestamp(secrets.expiresIn),
      expiryTimestamp(secrets.refreshExpiresIn),
    ]
  );
}

export async function storedShopifyScope(shop: string): Promise<string> {
  const normalized = normalizeShop(shop);
  const rows = await dbQuery<{ scope: string }>(
    `SELECT scope
     FROM shopify_sessions
     WHERE shop = $1
       AND revoked_at IS NULL
     LIMIT 1`,
    [normalized]
  );
  return String(rows[0]?.scope || "");
}

type StoredShopifySession = {
  accessToken: string;
  refreshToken: string;
  scope: string;
  accessExpiresAt: string | Date | null;
  refreshExpiresAt: string | Date | null;
};

async function storedShopifySession(shop: string): Promise<StoredShopifySession | null> {
  const normalized = normalizeShop(shop);
  const rows = await dbQuery<{
    encrypted_access_token: string;
    encrypted_refresh_token: string | null;
    scope: string | null;
    access_token_expires_at: string | Date | null;
    refresh_token_expires_at: string | Date | null;
  }>(
    `SELECT encrypted_access_token, encrypted_refresh_token, scope,
            access_token_expires_at, refresh_token_expires_at
     FROM shopify_sessions
     WHERE shop = $1
       AND revoked_at IS NULL
     LIMIT 1`,
    [normalized]
  );
  const row = rows[0];
  if (!row) return null;
  const accessToken = decryptShopifyToken(String(row.encrypted_access_token || ""));
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: decryptShopifyToken(String(row.encrypted_refresh_token || "")),
    scope: String(row.scope || ""),
    accessExpiresAt: row.access_token_expires_at ?? null,
    refreshExpiresAt: row.refresh_token_expires_at ?? null,
  };
}

export async function storedAccessToken(shop: string): Promise<string> {
  return (await storedShopifySession(shop))?.accessToken || "";
}

export type ShopifyCodeExchangeResult =
  | {
      ok: true;
      accessToken: string;
      scope: string;
      refreshToken: string;
      expiresIn: number;
      refreshExpiresIn: number;
    }
  | { ok: false; error: string; errorCode: string; status: number };

export function classifyShopifyTokenError(
  error?: string | null,
  errorCode?: string | null
): string {
  const value = `${errorCode || ""} ${error || ""}`.toLowerCase();
  if (value.includes("invalid_client")) return "client";
  if (value.includes("invalid_grant")) return "grant";
  if (value.includes("invalid_request")) return "request";
  if (value.includes("redirect_uri")) return "redirect";
  if (value.trim()) return "token";
  return "none";
}

function tokenBody(data: {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
} | null): ShopifyCodeExchangeResult {
  if (!data?.access_token) {
    return {
      ok: false,
      error: data?.error_description || data?.error || "Shopify authorization failed.",
      errorCode: data?.error || "",
      status: 401,
    };
  }
  return {
    ok: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    scope: data.scope || "",
    expiresIn: Number(data.expires_in) || 0,
    refreshExpiresIn: Number(data.refresh_token_expires_in) || 0,
  };
}

async function postShopifyAccessToken(
  shop: string,
  body: URLSearchParams
): Promise<ShopifyCodeExchangeResult> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;
  const parsed = tokenBody(data);
  if (!response.ok || !parsed.ok) {
    return {
      ok: false,
      error:
        (!parsed.ok && parsed.error) ||
        data?.error_description ||
        data?.error ||
        "Shopify authorization failed.",
      errorCode: (!parsed.ok && parsed.errorCode) || data?.error || "",
      status: response.status,
    };
  }
  return parsed;
}

async function persistExchangedSession(
  shop: string,
  result: Extract<ShopifyCodeExchangeResult, { ok: true }>
): Promise<string> {
  await saveShopifySession(shop, result.accessToken, result.scope, {
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
    refreshExpiresIn: result.refreshExpiresIn,
  });
  return result.accessToken;
}

export async function exchangeShopifyAuthorizationCode(input: {
  shop: string;
  apiKey: string;
  secret: string;
  code: string;
}): Promise<ShopifyCodeExchangeResult> {
  return postShopifyAccessToken(
    input.shop,
    new URLSearchParams({
      client_id: input.apiKey,
      client_secret: input.secret,
      code: input.code,
      expiring: "1",
    })
  );
}

function tokenExchangePairs(identity: VerifiedShopifyIdentity): Array<{
  clientId: string;
  secret: string;
}> {
  const pairs: Array<{ clientId: string; secret: string }> = [];
  const seen = new Set<string>();
  const add = (clientId: string, secret: string) => {
    if (!clientId || !secret) return;
    const key = `${clientId}:${secret}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ clientId, secret });
  };
  add(identity.clientId, getShopifySecretForClientId(identity.clientId));
  add(identity.clientId, identity.credentialSecret);
  for (const app of getShopifyAppCredentials()) add(app.clientId, app.secret);
  add(getShopifyClientId(), getShopifyClientSecret());
  return pairs;
}

async function exchangeOfflineToken(
  shop: string,
  idToken: string,
  identity: VerifiedShopifyIdentity
): Promise<string> {
  const pairs = tokenExchangePairs(identity);
  if (!pairs.length) {
    throw new ShopifyAuthError("Shopify credentials are not configured.", 500);
  }

  let lastError = "Shopify token exchange failed.";
  let lastStatus = 502;
  for (const pair of pairs) {
    const result = await postShopifyAccessToken(
      shop,
      new URLSearchParams({
        client_id: pair.clientId,
        client_secret: pair.secret,
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: idToken,
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
        expiring: "1",
      })
    );
    if (result.ok) return persistExchangedSession(shop, result);
    lastError = result.error;
    lastStatus = result.status;
    console.error("SHOPIFY_TOKEN_EXCHANGE_FAILED", {
      shop,
      status: result.status,
      error: classifyShopifyTokenError(result.error, result.errorCode),
      clientIdSuffix: pair.clientId.slice(-6),
    });
  }

  throw new ShopifyAuthError(lastError, lastStatus === 400 ? 401 : lastStatus >= 500 ? 502 : 401);
}

async function refreshStoredOfflineToken(
  shop: string,
  preferred?: VerifiedShopifyIdentity
): Promise<string> {
  const stored = await storedShopifySession(shop);
  if (!stored?.refreshToken) return "";
  if (stored.refreshExpiresAt && isExpired(stored.refreshExpiresAt, 0)) return "";

  const pairs = preferred
    ? tokenExchangePairs(preferred)
    : getShopifyAppCredentials();
  for (const pair of pairs) {
    const result = await postShopifyAccessToken(
      shop,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: pair.clientId,
        client_secret: pair.secret,
        refresh_token: stored.refreshToken,
      })
    );
    if (result.ok) return persistExchangedSession(shop, result);
  }
  return "";
}

async function usableStoredAccessToken(
  shop: string,
  options: { allowUnexpiring?: boolean } = {}
): Promise<string> {
  const stored = await storedShopifySession(shop);
  if (!stored?.accessToken) return "";
  if (stored.accessExpiresAt) {
    return isExpired(stored.accessExpiresAt) ? "" : stored.accessToken;
  }
  return options.allowUnexpiring ? stored.accessToken : "";
}

export async function mintShopifyAccessToken(
  request: NextRequest,
  shop: string
): Promise<string> {
  const idToken = getShopifyIdToken(request);
  if (idToken) {
    const identity = verifyShopifySessionToken(idToken);
    if (identity.shop !== shop) {
      throw new ShopifyAuthError("Shopify session shop mismatch.");
    }
    try {
      return await exchangeOfflineToken(identity.shop, idToken, identity);
    } catch (error) {
      const refreshed = await refreshStoredOfflineToken(identity.shop, identity);
      if (refreshed) return refreshed;
      throw error;
    }
  }

  const refreshed = await refreshStoredOfflineToken(shop);
  if (refreshed) return refreshed;
  throw new ShopifyAuthError("Shopify access expired. Reconnect the store.");
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

      try {
        const accessToken = await exchangeOfflineToken(identity.shop, idToken, identity);
        return { ...identity, accessToken };
      } catch (exchangeError) {
        const refreshed = await refreshStoredOfflineToken(identity.shop, identity);
        if (refreshed) return { ...identity, accessToken: refreshed };
        const saved = await usableStoredAccessToken(identity.shop);
        if (saved) return { ...identity, accessToken: saved };
        throw exchangeError;
      }
    } catch (error) {
      idTokenError = error;
    }
  }

  const sessionShop = await shopFromSessionCookie(request);
  if (sessionShop) {
    if (!requireAccessToken) {
      return { shop: sessionShop, accessToken: "", userId: "" };
    }
    const refreshed = await refreshStoredOfflineToken(sessionShop);
    const accessToken = refreshed || (await usableStoredAccessToken(sessionShop, { allowUnexpiring: true }));
    if (accessToken) {
      if (!(await isShopifyInstallationActive(sessionShop))) {
        throw new ShopifyAuthError(
          "Shopify connection is missing. Please open Virello from Shopify Admin."
        );
      }
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
