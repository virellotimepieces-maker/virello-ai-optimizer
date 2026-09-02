export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 32;

const APP_URL_ERROR = "APP_URL is not configured.";

/**
 * Canonical public origin from APP_URL only.
 * Does not use the browser Origin/Referer or the incoming request host.
 */
export function getAppUrl(_fallbackOrigin = ""): string {
  void _fallbackOrigin;
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "") || "";
  if (!configured) {
    throw new Error(APP_URL_ERROR);
  }

  try {
    const url = new URL(configured);
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    ) {
      return url.origin;
    }
  } catch {
    // Invalid APP_URL is a configuration error, not a request-origin fallback.
  }

  throw new Error(APP_URL_ERROR);
}

function originFromHost(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).origin;
  } catch {
    return "";
  }
}

export function listAllowedAppOrigins(fallbackOrigin = ""): string[] {
  const origins = new Set<string>();
  try {
    origins.add(getAppUrl());
  } catch {
    // APP_URL may be unset in some unit tests.
  }
  const fallback = originFromHost(fallbackOrigin);
  if (fallback) origins.add(fallback);
  const vercel = originFromHost(process.env.VERCEL_URL || "");
  if (vercel) origins.add(vercel);
  const production = originFromHost(process.env.VERCEL_PROJECT_PRODUCTION_URL || "");
  if (production) origins.add(production);
  for (const extra of (process.env.ALLOWED_APP_ORIGINS || "").split(",")) {
    const origin = originFromHost(extra);
    if (origin) origins.add(origin);
  }
  return [...origins];
}

export function isSecureAppUrl(): boolean {
  try {
    return new URL(getAppUrl()).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}
