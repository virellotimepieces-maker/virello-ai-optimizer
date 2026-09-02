import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

function shopifyHmacEscapeAll(value: string): string {
  return value.replace(/%/g, "%25").replace(/&/g, "%26").replace(/=/g, "%3D");
}

function shopifyHmacEscapeValueLegacy(value: string): string {
  return value.replace(/%/g, "%25").replace(/&/g, "%26");
}

function hmacHexEqual(suppliedHex: string, expectedHex: string): boolean {
  const supplied = Buffer.from(suppliedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return (
    supplied.length === 32 &&
    expected.length === 32 &&
    hmacEqual(supplied, expected)
  );
}

function splitRawQuery(search: string): Array<[string, string]> {
  const query = search.replace(/^\?/, "");
  if (!query) return [];
  return query
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      if (index === -1) return [part, ""];
      return [part.slice(0, index), part.slice(index + 1)];
    });
}

function decodeQueryKeepPlus(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeQueryForm(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, "%20"));
  } catch {
    return value;
  }
}

function isHmacOrSignature(key: string): boolean {
  const decoded = decodeQueryKeepPlus(key);
  return decoded === "hmac" || decoded === "signature" || key === "hmac" || key === "signature";
}

function sortedOAuthMessage(
  pairs: Array<[string, string]>,
  escapeMode: "none" | "values-and-keys" | "keys-eq-only"
): string {
  return pairs
    .filter(([key]) => !isHmacOrSignature(key))
    .map(([key, value]) => {
      if (escapeMode === "none") return `${key}=${value}`;
      if (escapeMode === "keys-eq-only") {
        return `${shopifyHmacEscapeAll(key)}=${shopifyHmacEscapeValueLegacy(value)}`;
      }
      return `${shopifyHmacEscapeAll(key)}=${shopifyHmacEscapeAll(value)}`;
    })
    .sort()
    .join("&");
}

function shopifyApiJsAdminMessage(pairs: Array<[string, string]>): string {
  const grouped = new Map<string, string[]>();
  for (const [rawKey, rawValue] of pairs) {
    if (isHmacOrSignature(rawKey)) continue;
    const key = decodeQueryKeepPlus(rawKey);
    const values = grouped.get(key) || [];
    values.push(decodeQueryKeepPlus(rawValue));
    grouped.set(key, values);
  }
  const processed = new URLSearchParams();
  [...grouped.keys()]
    .sort((left, right) => left.localeCompare(right))
    .forEach((key) => {
      const values = grouped.get(key) || [];
      processed.append(key, values.length > 1 ? values.join(",") : values[0] || "");
    });
  return processed.toString().replace(/\+/g, "%20");
}

function addPairSetMessages(
  messages: Set<string>,
  pairs: Array<[string, string]>
): void {
  if (!pairs.length) return;
  const decodedKeepPlus = pairs.map(
    ([key, value]) => [decodeQueryKeepPlus(key), decodeQueryKeepPlus(value)] as [string, string]
  );
  const decodedForm = pairs.map(
    ([key, value]) => [decodeQueryForm(key), decodeQueryForm(value)] as [string, string]
  );
  for (const decoded of [pairs, decodedKeepPlus, decodedForm]) {
    messages.add(sortedOAuthMessage(decoded, "none"));
    messages.add(sortedOAuthMessage(decoded, "values-and-keys"));
    messages.add(sortedOAuthMessage(decoded, "keys-eq-only"));
    const apiJs = shopifyApiJsAdminMessage(decoded);
    if (apiJs) messages.add(apiJs);
  }
  const raw = pairs
    .filter(([key]) => !isHmacOrSignature(key))
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("&");
  if (raw) messages.add(raw);
}

function pairsFromInvokeQuery(header: string | null): Array<[string, string]> {
  if (!header) return [];
  const candidates = [header.trim()];
  try {
    candidates.push(decodeURIComponent(header).trim());
  } catch {
    /* keep the raw header */
  }
  for (const candidate of candidates) {
    if (!candidate.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const pairs: Array<[string, string]> = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (Array.isArray(value)) {
          for (const item of value) pairs.push([key, String(item)]);
        } else if (value != null) {
          pairs.push([key, String(value)]);
        }
      }
      if (pairs.length) return pairs;
    } catch {
      /* not JSON */
    }
  }
  return [];
}

function callbackQueryStrings(request: NextRequest): string[] {
  const found = new Set<string>();
  const add = (value?: string | null) => {
    if (!value) return;
    let query = value.trim();
    if (query.startsWith("?")) query = query.slice(1);
    const uriIndex = query.indexOf("?");
    if (uriIndex >= 0 && (query.startsWith("/") || query.startsWith("http"))) {
      query = query.slice(uriIndex + 1);
    }
    if (query) found.add(query);
  };

  add(request.nextUrl.search);
  try {
    add(new URL(request.url).search);
  } catch {
    /* ignore invalid request URLs */
  }

  const invokeQuery = request.headers.get("x-invoke-query");
  add(invokeQuery);
  if (invokeQuery) {
    try {
      add(decodeURIComponent(invokeQuery));
    } catch {
      /* ignore */
    }
  }

  for (const header of ["x-forwarded-uri", "x-original-uri", "x-invoke-path"]) {
    add(request.headers.get(header));
  }

  return [...found];
}

export function shopifyCallbackHmacMessages(request: NextRequest): string[] {
  const messages = new Set<string>();
  addPairSetMessages(messages, [...request.nextUrl.searchParams.entries()]);
  addPairSetMessages(messages, pairsFromInvokeQuery(request.headers.get("x-invoke-query")));
  for (const search of callbackQueryStrings(request)) {
    addPairSetMessages(messages, splitRawQuery(search));
  }
  return [...messages].filter(Boolean);
}

export function verifyShopifyCallbackHmac(
  request: NextRequest,
  secret: string
): boolean {
  if (!secret) return false;
  let hmac = (request.nextUrl.searchParams.get("hmac") || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hmac)) {
    const invokeHmac = pairsFromInvokeQuery(request.headers.get("x-invoke-query")).find(
      ([key]) => decodeQueryKeepPlus(key) === "hmac"
    )?.[1];
    const decodedInvoke = decodeQueryKeepPlus(invokeHmac || "").trim().toLowerCase();
    if (/^[a-f0-9]{64}$/.test(decodedInvoke)) {
      hmac = decodedInvoke;
    }
  }
  if (!/^[a-f0-9]{64}$/.test(hmac)) {
    for (const search of callbackQueryStrings(request)) {
      const found = splitRawQuery(search).find(
        ([key]) => decodeQueryKeepPlus(key) === "hmac"
      )?.[1];
      if (!found) continue;
      const decoded = decodeQueryKeepPlus(found).toLowerCase();
      if (/^[a-f0-9]{64}$/.test(decoded)) {
        hmac = decoded;
        break;
      }
    }
  }
  if (!/^[a-f0-9]{64}$/.test(hmac)) return false;

  return shopifyCallbackHmacMessages(request).some((message) => {
    const expected = createHmac("sha256", secret).update(message).digest("hex");
    return hmacHexEqual(hmac, expected);
  });
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
    JSON.stringify({
      shop: normalized,
      timestamp: Date.now(),
      flow,
      nonce: randomBytes(16).toString("hex"),
    })
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
