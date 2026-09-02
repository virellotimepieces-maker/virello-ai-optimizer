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

export function isSecureAppUrl(fallbackOrigin = ""): boolean {
  try {
    return new URL(getAppUrl(fallbackOrigin)).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}
