export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 32;

export function getAppUrl(fallbackOrigin = ""): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "") || "";
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // Fall through to the request origin when APP_URL is malformed.
    }
  }

  if (fallbackOrigin) {
    return new URL(fallbackOrigin).origin;
  }

  throw new Error("APP_URL is not configured.");
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
    origins.add(getAppUrl(fallbackOrigin));
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

export function isSecureAppUrl(fallbackOrigin = ""): boolean {
  try {
    return new URL(getAppUrl(fallbackOrigin)).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}
