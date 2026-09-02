import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { normalizeShop } from "./shop-domain";
import {
  getShopifyClientId,
  getShopifyClientSecret,
  getShopifyClientSecrets,
} from "./shopify-config";

export class ShopifySecurityError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = "ShopifySecurityError";
  }
}

function decodeJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function hmacEqual(receivedHexOrRaw: Buffer, expected: Buffer): boolean {
  return (
    receivedHexOrRaw.length === expected.length &&
    timingSafeEqual(receivedHexOrRaw, expected)
  );
}

export function getShopifyIdToken(request: NextRequest): string {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-shopify-session-token")?.trim() ||
    ""
  );
}

export type VerifiedShopifyIdentity = {
  shop: string;
  userId: string;
  credentialSecret: string;
};

export function verifyShopifySessionToken(
  token: string
): VerifiedShopifyIdentity {
  const apiKey = getShopifyClientId();
  const apiSecrets = getShopifyClientSecrets();
  if (!apiKey || apiSecrets.length === 0) {
    throw new ShopifySecurityError("Shopify credentials are not configured.", 500);
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new ShopifySecurityError("A valid Shopify session is required.");
  }

  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (!header || !payload || header.alg !== "HS256") {
    throw new ShopifySecurityError("Invalid Shopify session token.");
  }

  const received = Buffer.from(parts[2], "base64url");
  const credentialSecret = apiSecrets.find((secret) => {
    const expected = createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    return hmacEqual(received, expected);
  });
  if (!credentialSecret) {
    throw new ShopifySecurityError("Invalid Shopify session signature.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== apiKey ||
    typeof payload.exp !== "number" ||
    payload.exp <= now ||
    (typeof payload.nbf === "number" && payload.nbf > now + 60) ||
    typeof payload.dest !== "string"
  ) {
    throw new ShopifySecurityError("Shopify session is expired or invalid.");
  }

  const destShop = normalizeShop(payload.dest);
  if (!destShop) {
    throw new ShopifySecurityError("Shopify session has an invalid store.");
  }

  if (typeof payload.iss === "string") {
    const issuerShop = normalizeShop(payload.iss);
    if (issuerShop && issuerShop !== destShop) {
      throw new ShopifySecurityError("Shopify session shop mismatch.");
    }
  }

  return {
    shop: destShop,
    userId: typeof payload.sub === "string" ? payload.sub : "",
    credentialSecret,
  };
}

export function verifyShopifyWebhookHmac(
  body: string,
  hmacHeader: string | null
): boolean {
  const secrets = getShopifyClientSecrets();
  if (!hmacHeader || secrets.length === 0) return false;

  let received: Buffer;
  try {
    received = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(body, "utf8").digest();
    return hmacEqual(received, expected);
  });
}

export function verifyShopifyCallbackHmac(
  request: NextRequest,
  secret: string
): boolean {
  const supplied = (request.nextUrl.searchParams.get("hmac") || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;

  const suppliedBuffer = Buffer.from(supplied);

  const matches = (message: string) => {
    const expected = createHmac("sha256", secret).update(message).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    return hmacEqual(suppliedBuffer, expectedBuffer);
  };

  const allDecodedEntries = [...request.nextUrl.searchParams.entries()]
    .filter(([key]) => key !== "hmac")
    .sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
    );

  const decodedMessage = allDecodedEntries
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  if (matches(decodedMessage)) return true;

  const legacyDecodedMessage = allDecodedEntries
    .filter(([key]) => key !== "signature")
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  if (legacyDecodedMessage !== decodedMessage && matches(legacyDecodedMessage)) {
    return true;
  }

  const rawMessage = request.nextUrl.search
    .replace(/^\?/, "")
    .split("&")
    .filter(Boolean)
    .filter((part) => {
      const rawKey = part.split("=", 1)[0];
      try {
        return decodeURIComponent(rawKey) !== "hmac";
      } catch {
        return rawKey !== "hmac";
      }
    })
    .sort()
    .join("&");

  if (rawMessage !== decodedMessage && matches(rawMessage)) return true;

  const legacyRawMessage = rawMessage
    .split("&")
    .filter((part) => {
      const rawKey = part.split("=", 1)[0];
      try {
        return decodeURIComponent(rawKey) !== "signature";
      } catch {
        return rawKey !== "signature";
      }
    })
    .join("&");

  return legacyRawMessage !== rawMessage && matches(legacyRawMessage);
}

export type ShopifyOAuthFlow = "standalone" | "embedded";

export type SignedOAuthState = {
  shop: string;
  timestamp: number;
  flow: ShopifyOAuthFlow;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function createSignedOAuthState(
  shop: string,
  secret = getShopifyClientSecret(),
  flow: ShopifyOAuthFlow = "standalone"
): string {
  if (!secret) {
    throw new ShopifySecurityError("Shopify credentials are not configured.", 500);
  }
  const normalized = normalizeShop(shop);
  if (!normalized) {
    throw new ShopifySecurityError("Invalid Shopify store.", 400);
  }
  const payload = Buffer.from(
    JSON.stringify({ shop: normalized, timestamp: Date.now(), flow })
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function parseSignedOAuthState(
  state: string,
  expectedShop: string,
  secret: string
): SignedOAuthState | null {
  try {
    const [payload, suppliedSignature, extra] = state.split(".");
    if (!payload || !suppliedSignature || extra) return null;
    const expectedSignature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (!hmacEqual(supplied, expected)) return null;
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { shop?: string; timestamp?: number; flow?: string };
    if (!parsed.shop || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > OAUTH_STATE_TTL_MS) return null;
    const shop = normalizeShop(parsed.shop);
    if (!shop || shop !== normalizeShop(expectedShop)) return null;
    return {
      shop,
      timestamp: parsed.timestamp,
      flow: parsed.flow === "embedded" ? "embedded" : "standalone",
    };
  } catch {
    return null;
  }
}

export function verifySignedOAuthState(
  state: string,
  expectedShop: string,
  secret: string
): boolean {
  return Boolean(parseSignedOAuthState(state, expectedShop, secret));
}
