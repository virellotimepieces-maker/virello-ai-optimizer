import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSecureAppUrl } from "./app-url";
import {
  cleanupAppSessions,
  createAppSession,
  getActiveAppSession,
  getAppSessionById,
  revokeAppSession,
  revokeAppSessionsForShop,
  type AppSessionRecord,
} from "./shops";
import { normalizeShop } from "./shop-domain";

export const SESSION_COOKIE = "virello_sid";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 32;
export const LEGACY_COOKIES = [
  "virello_subscriber",
  "virello_shopify_shop",
  "virello_shopify_access_token",
] as const;

export function clearLegacyCookies(response: NextResponse): void {
  for (const name of LEGACY_COOKIES) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 0,
    });
  }
}

export type CookieMode = "embedded" | "standalone";

export function newSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export function isSessionIdShape(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function requestCookieMode(request: NextRequest): CookieMode {
  const params = request.nextUrl.searchParams;
  if (params.get("embedded") === "1" || params.get("host")) return "embedded";
  if (request.headers.get("sec-fetch-dest") === "iframe") return "embedded";
  return "standalone";
}

export function sessionCookieOptions(input: {
  mode: CookieMode;
  secure?: boolean;
}): {
  httpOnly: true;
  secure: boolean;
  sameSite: "none";
  path: "/";
  maxAge: number;
  partitioned: boolean;
} {
  return {
    httpOnly: true,
    secure: input.secure ?? true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    partitioned: input.mode === "embedded",
  };
}

export function readSessionId(request: NextRequest): string {
  const raw = request.cookies.get(SESSION_COOKIE)?.value?.trim() || "";
  return isSessionIdShape(raw) ? raw : "";
}

export async function loadValidAppSession(
  sessionId: string,
  expectedShop = ""
): Promise<AppSessionRecord | null> {
  if (!isSessionIdShape(sessionId)) return null;
  const normalized = expectedShop ? normalizeShop(expectedShop) : "";
  const row = await getActiveAppSession(sessionId, normalized || undefined);
  if (!row) return null;
  if (normalized && row.shop !== normalized) return null;
  return {
    ...row,
    revoked_at: null,
  };
}

export async function rejectForgedOrMismatchedSession(
  sessionId: string,
  expectedShop: string
): Promise<"missing" | "forged" | "expired" | "revoked" | "mismatch" | "ok"> {
  if (!sessionId) return "missing";
  if (!isSessionIdShape(sessionId)) return "forged";
  const row = await getAppSessionById(sessionId);
  if (!row) return "forged";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= Date.now()) return "expired";
  const shop = normalizeShop(expectedShop);
  if (shop && row.shop !== shop) return "mismatch";
  return "ok";
}

export async function issueAppSession(input: {
  shop: string;
  stripeCustomerId?: string | null;
  previousSessionId?: string;
  revokeShopSessions?: boolean;
}): Promise<string> {
  await cleanupAppSessions();
  if (input.revokeShopSessions) {
    await revokeAppSessionsForShop(input.shop);
  } else if (input.previousSessionId) {
    await revokeAppSession(input.previousSessionId);
  }

  const id = newSessionId();
  await createAppSession({
    id,
    shop: input.shop,
    stripeCustomerId: input.stripeCustomerId ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
  });
  return id;
}

export function applySessionCookie(
  response: NextResponse,
  sessionId: string,
  request: NextRequest
): void {
  const options = sessionCookieOptions({
    mode: requestCookieMode(request),
    secure: isSecureAppUrl(request.nextUrl.origin) || process.env.NODE_ENV === "production",
  });
  response.cookies.set(SESSION_COOKIE, sessionId, options);
  clearLegacyCookies(response);
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 0,
  });
  clearLegacyCookies(response);
}

export async function ensureAppSessionCookie(input: {
  request: NextRequest;
  response: NextResponse;
  shop: string;
  stripeCustomerId?: string | null;
  rotate?: boolean;
}): Promise<string> {
  const currentId = readSessionId(input.request);
  if (!input.rotate && currentId) {
    const existing = await loadValidAppSession(currentId, input.shop);
    if (existing) {
      applySessionCookie(input.response, currentId, input.request);
      return currentId;
    }
  }

  const sessionId = await issueAppSession({
    shop: input.shop,
    stripeCustomerId: input.stripeCustomerId,
    previousSessionId: currentId,
    revokeShopSessions: input.rotate,
  });
  applySessionCookie(input.response, sessionId, input.request);
  return sessionId;
}

export async function shopFromSessionCookie(
  request: NextRequest
): Promise<string> {
  const sessionId = readSessionId(request);
  if (!sessionId) return "";
  const session = await loadValidAppSession(sessionId);
  return session?.shop || "";
}
