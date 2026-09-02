import { NextRequest } from "next/server";
import { getAppUrl } from "./app-url";

export class OriginGuardError extends Error {
  status = 403;

  constructor(message = "Request origin is not allowed.") {
    super(message);
    this.name = "OriginGuardError";
  }
}

function hostnameOf(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function originOf(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function isAllowedAppOrigin(
  candidate: string,
  fallbackOrigin = ""
): boolean {
  const origin = originOf(candidate);
  if (!origin) return false;

  const allowed = new Set<string>();
  try {
    allowed.add(getAppUrl(fallbackOrigin));
  } catch {
    if (fallbackOrigin) allowed.add(new URL(fallbackOrigin).origin);
  }

  if (allowed.has(origin)) return true;

  const host = hostnameOf(candidate);
  return (
    host === "admin.shopify.com" ||
    (host.endsWith(".myshopify.com") && host !== ".myshopify.com")
  );
}

export function isAllowedRedirectUrl(
  candidate: string,
  fallbackOrigin = ""
): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;

  if (url.hostname === "admin.shopify.com") return true;
  if (
    url.hostname.endsWith(".myshopify.com") &&
    url.hostname !== ".myshopify.com"
  ) {
    return true;
  }

  return isAllowedAppOrigin(url.origin, fallbackOrigin);
}

export function isValidPortalReturnUrl(
  candidate: string,
  fallbackOrigin = ""
): boolean {
  try {
    const parsed = new URL(candidate);
    const allowed = new URL(getAppUrl(fallbackOrigin));
    return (
      parsed.origin === allowed.origin &&
      !parsed.username &&
      !parsed.password &&
      (parsed.protocol === "https:" || parsed.protocol === "http:")
    );
  } catch {
    return false;
  }
}

export function portalReturnUrl(fallbackOrigin = ""): string {
  return getAppUrl(fallbackOrigin);
}

export function resolvedPortalReturnUrl(
  requested: string | null | undefined,
  fallbackOrigin = ""
): string {
  void requested;
  return portalReturnUrl(fallbackOrigin);
}

export function assertSafeMutation(
  request: NextRequest,
  fallbackOrigin = request.nextUrl.origin
): void {
  if (request.method === "GET" || request.method === "HEAD") return;

  const origin = request.headers.get("origin") || "";
  const referer = request.headers.get("referer") || "";

  if (origin) {
    if (!isAllowedAppOrigin(origin, fallbackOrigin)) {
      throw new OriginGuardError();
    }
    return;
  }

  if (referer && isAllowedAppOrigin(referer, fallbackOrigin)) return;

  throw new OriginGuardError();
}
