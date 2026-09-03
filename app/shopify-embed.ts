"use client";

const EMBED_QUERY_KEYS = [
  "embedded",
  "host",
  "shop",
  "hmac",
  "timestamp",
  "session",
  "locale",
  "id_token",
] as const;

export function isShopifyAdminIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  if (window.frameElement) return true;
  const ancestors = window.location.ancestorOrigins;
  return Boolean(ancestors && ancestors.length > 0);
}

export function copyEmbedQuery(from: URLSearchParams, to: URL): URL {
  for (const key of EMBED_QUERY_KEYS) {
    const value = from.get(key);
    if (value && !to.searchParams.has(key)) {
      to.searchParams.set(key, value);
    }
  }
  return to;
}

/** OAuth, Stripe, and Admin URLs must leave the Admin iframe. */
export function assignTopLevel(url: string): void {
  if (!url) return;
  if (isShopifyAdminIframe()) {
    try {
      window.open(url, "_top");
      return;
    } catch {
      /* sandbox may block window.open */
    }
    try {
      window.top?.location.assign(url);
      return;
    } catch {
      /* cross-origin sandbox */
    }
  }
  window.location.assign(url);
}
