import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { database, ensureDatabaseSchema } from "./database";
import {
  decryptShopifyToken,
  encryptShopifyToken,
  SHOPIFY_TOKEN_COOKIE,
} from "./shopify-session";

const SHOPIFY_SUFFIX = ".myshopify.com";

export class ShopifyAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = "ShopifyAuthError";
  }
}

export function normalizeShop(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host.endsWith(SHOPIFY_SUFFIX) && host !== SHOPIFY_SUFFIX
      ? host
      : "";
  } catch {
    return "";
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

export function verifyShopifyIdToken(token: string): { shop: string; userId: string } {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
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

  const expected = createHmac("sha256", apiSecret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const received = Buffer.from(parts[2], "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
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
  };
}

export async function saveShopifySession(
  shop: string,
  accessToken: string,
  scope = ""
): Promise<void> {
  const normalized = normalizeShop(shop);
  if (!normalized || !accessToken) {
    throw new ShopifyAuthError("Cannot save an invalid Shopify session.", 400);
  }

  const sql = database();
  await ensureDatabaseSchema();
  const encrypted = encryptShopifyToken(accessToken);
  await sql`
    INSERT INTO shopify_sessions (shop, encrypted_access_token, scope, updated_at)
    VALUES (${normalized}, ${encrypted}, ${scope}, NOW())
    ON CONFLICT (shop) DO UPDATE SET
      encrypted_access_token = EXCLUDED.encrypted_access_token,
      scope = EXCLUDED.scope,
      updated_at = NOW()
  `;
}

async function storedAccessToken(shop: string): Promise<string> {
  const sql = database();
  await ensureDatabaseSchema();
  const rows = await sql`
    SELECT encrypted_access_token
    FROM shopify_sessions
    WHERE shop = ${shop}
    LIMIT 1
  `;
  return decryptShopifyToken(String(rows[0]?.encrypted_access_token || ""));
}

async function exchangeOfflineToken(shop: string, idToken: string): Promise<string> {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new ShopifyAuthError("Shopify credentials are not configured.", 500);
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: apiKey,
      client_secret: apiSecret,
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

  if (idToken) {
    const identity = verifyShopifyIdToken(idToken);
    if (!requireAccessToken) return { ...identity, accessToken: "" };

    const saved = await storedAccessToken(identity.shop);
    return {
      ...identity,
      accessToken: saved || await exchangeOfflineToken(identity.shop, idToken),
    };
  }

  // Compatibility for merchants using Virello outside the embedded admin.
  const shop = normalizeShop(request.cookies.get("virello_shopify_shop")?.value || "");
  const accessToken = decryptShopifyToken(
    request.cookies.get(SHOPIFY_TOKEN_COOKIE)?.value || ""
  );
  if (!shop || (requireAccessToken && !accessToken)) {
    throw new ShopifyAuthError("Shopify connection is missing. Please open Virello from Shopify Admin.");
  }

  if (requireAccessToken) {
    const persisted = await storedAccessToken(shop).catch(() => "");
    if (!persisted) await saveShopifySession(shop, accessToken);
  }

  return { shop, accessToken, userId: "" };
}

export async function deleteShopifyData(shop: string): Promise<void> {
  const normalized = normalizeShop(shop);
  if (!normalized) return;
  const sql = database();
  await ensureDatabaseSchema();
  await sql`DELETE FROM shopify_sessions WHERE shop = ${normalized}`;
  await sql`DELETE FROM shop_subscriptions WHERE shop = ${normalized}`;
}
