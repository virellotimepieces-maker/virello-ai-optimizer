import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const SHOPIFY_API_VERSION = "2026-07";

const SHOP_REGEX =
  /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i;

export const SHOPIFY_ACCESS_TOKEN_COOKIE =
  "virello_shopify_access_token";

export const SHOPIFY_SHOP_COOKIE = "virello_shopify_shop";

export const SHOPIFY_OAUTH_NONCE_COOKIE =
  "virello_shopify_oauth_nonce";

const DEFAULT_REDIRECT_URI =
  "https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback";

type OAuthStatePayload = {
  shop: string;
  nonce: string;
  timestamp: number;
};

export type AuthenticatedShopifySession = {
  shop: string;
  accessToken: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function cleanShopDomain(value: string): string {
  let normalized = value.trim().toLowerCase();

  if (normalized.startsWith("https://")) {
    normalized = normalized.slice("https://".length);
  } else if (normalized.startsWith("http://")) {
    normalized = normalized.slice("http://".length);
  }

  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  const duplicateSuffix =
    ".myshopify.com.myshopify.com";

  if (normalized.endsWith(duplicateSuffix)) {
    normalized = `${normalized.slice(
      0,
      -duplicateSuffix.length
    )}.myshopify.com`;
  }

  return normalized;
}

export function isValidShopDomain(shop: string): boolean {
  return SHOP_REGEX.test(shop);
}

export function getShopifyRedirectUri(): string {
  return process.env.SHOPIFY_REDIRECT_URI || DEFAULT_REDIRECT_URI;
}

export function createOAuthState(
  shop: string,
  apiSecret: string
): { state: string; nonce: string } {
  const nonce = randomBytes(24).toString("base64url");

  const payload: OAuthStatePayload = {
    shop,
    nonce,
    timestamp: Date.now(),
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");

  const signature = createHmac("sha256", apiSecret)
    .update(encodedPayload)
    .digest("base64url");

  return {
    state: `${encodedPayload}.${signature}`,
    nonce,
  };
}

export function verifyOAuthState(
  state: string,
  apiSecret: string,
  expectedNonce: string
): OAuthStatePayload | null {
  try {
    const [encodedPayload, signature] = state.split(".");

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = createHmac("sha256", apiSecret)
      .update(encodedPayload)
      .digest("base64url");

    const signatureBuffer = Buffer.from(
      signature,
      "base64url"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "base64url"
    );

    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (
      !timingSafeEqual(
        signatureBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8")
    ) as OAuthStatePayload;

    if (
      !payload ||
      typeof payload.shop !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.timestamp !== "number"
    ) {
      return null;
    }

    const age = Date.now() - payload.timestamp;

    if (age < 0 || age > 10 * 60 * 1000) {
      return null;
    }

    if (!isValidShopDomain(payload.shop)) {
      return null;
    }

    const receivedNonce = Buffer.from(payload.nonce);
    const expectedNonceBuffer = Buffer.from(expectedNonce);

    if (
      receivedNonce.length !==
      expectedNonceBuffer.length
    ) {
      return null;
    }

    if (
      !timingSafeEqual(
        receivedNonce,
        expectedNonceBuffer
      )
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyOAuthHmac(
  searchParams: URLSearchParams,
  apiSecret: string
): boolean {
  const hmac = searchParams.get("hmac");

  if (!hmac) {
    return false;
  }

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const digest = createHmac("sha256", apiSecret)
    .update(message)
    .digest("hex");

  const received = Buffer.from(hmac, "utf8");
  const expected = Buffer.from(digest, "utf8");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export function getSessionToken(
  request: NextRequest
): string {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    request.headers
      .get("x-shopify-session-token")
      ?.trim() ||
    ""
  );
}

function getShopFromToken(token: string): string {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    if (typeof payload.dest !== "string") {
      return "";
    }

    return cleanShopDomain(new URL(payload.dest).hostname);
  } catch {
    return "";
  }
}

function getShopFromRequest(
  request: NextRequest,
  token: string
): string {
  const headerShop = cleanShopDomain(
    request.headers.get("x-shopify-shop") || ""
  );

  if (headerShop) {
    return headerShop;
  }

  return getShopFromToken(token);
}

export async function exchangeSessionToken(
  shop: string,
  idToken: string
): Promise<string> {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new ApiError(
      "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel.",
      500
    );
  }

  const response = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: apiKey,
        client_secret: apiSecret,
        grant_type:
          "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: idToken,
        subject_token_type:
          "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type:
          "urn:shopify:params:oauth:token-type:online-access-token",
      }).toString(),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      `Shopify token exchange returned non-JSON response (${response.status}).`,
      502
    );
  }

  if (!response.ok || !data?.access_token) {
    throw new ApiError(
      data?.error_description ||
        data?.error ||
        data?.errors?.[0]?.message ||
        "Shopify token exchange failed.",
      response.status === 401 || response.status === 403
        ? 401
        : 502,
      response.status === 401 || response.status === 403
        ? "SHOPIFY_TOKEN_EXPIRED"
        : undefined
    );
  }

  return data.access_token as string;
}

export async function resolveShopifySession(
  request: NextRequest
): Promise<AuthenticatedShopifySession> {
  const cookieAccessToken =
    request.cookies.get(SHOPIFY_ACCESS_TOKEN_COOKIE)?.value || "";

  const cookieShop = cleanShopDomain(
    request.cookies.get(SHOPIFY_SHOP_COOKIE)?.value || ""
  );

  if (
    cookieAccessToken &&
    cookieShop &&
    isValidShopDomain(cookieShop)
  ) {
    return {
      shop: cookieShop,
      accessToken: cookieAccessToken,
    };
  }

  const sessionToken = getSessionToken(request);

  if (!sessionToken) {
    throw new ApiError(
      "Shopify session token is missing. Open Virello from Shopify Admin.",
      401,
      "SHOPIFY_SESSION_MISSING"
    );
  }

  const shop = cleanShopDomain(
    getShopFromRequest(request, sessionToken)
  );

  if (!isValidShopDomain(shop)) {
    throw new ApiError(
      "Shopify store could not be determined.",
      400
    );
  }

  const accessToken = await exchangeSessionToken(
    shop,
    sessionToken
  );

  return { shop, accessToken };
}

function isAuthFailure(
  status: number,
  errors: any[]
): boolean {
  if (status === 401 || status === 403) {
    return true;
  }

  return errors.some((error) => {
    const message =
      typeof error?.message === "string"
        ? error.message.toLowerCase()
        : "";

    return (
      message.includes("invalid api key") ||
      message.includes("invalid access token") ||
      message.includes("access denied") ||
      message.includes("token")
    );
  });
}

export async function shopifyGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );

  const text = await response.text();
  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(
      `Shopify returned a non-JSON response (${response.status}).`,
      502
    );
  }

  const errors = Array.isArray(data?.errors)
    ? data.errors
    : [];

  if (!response.ok || errors.length) {
    if (isAuthFailure(response.status, errors)) {
      throw new ApiError(
        "Shopify authentication expired or was revoked. Reconnect your store.",
        401,
        "SHOPIFY_TOKEN_EXPIRED"
      );
    }

    throw new ApiError(
      errors
        .map((error: any) => error?.message)
        .filter(Boolean)
        .join("; ") ||
        `Shopify API request failed (${response.status}).`,
      response.status >= 400 ? response.status : 500
    );
  }

  if (!data?.data) {
    throw new ApiError(
      "Shopify did not return GraphQL data.",
      502
    );
  }

  return data.data as T;
}

export function clearShopifyCookies(
  response: NextResponse
) {
  response.cookies.set(SHOPIFY_ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(SHOPIFY_SHOP_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
