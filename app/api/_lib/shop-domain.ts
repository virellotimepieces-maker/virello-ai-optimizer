const SHOP_HANDLE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SHOP_NAME =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;

export function isValidShopHandle(handle: string): boolean {
  return handle.length >= 1 && handle.length <= 60 && SHOP_HANDLE.test(handle);
}

export function isValidShopDomain(shop: string): boolean {
  return SHOP_NAME.test(shop);
}

export function shopHandleToDomain(handle: string): string {
  const normalized = handle.trim().toLowerCase();
  return isValidShopHandle(normalized) ? `${normalized}.myshopify.com` : "";
}

export function normalizeShop(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  if (!raw.includes(".") && !raw.includes("/")) {
    return shopHandleToDomain(raw);
  }

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.username || url.password) return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "admin.shopify.com") {
      const store = url.pathname.match(/^\/store\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)/i);
      return store ? shopHandleToDomain(store[1]) : "";
    }

    if (isValidShopDomain(host)) return host;
    return "";
  } catch {
    return "";
  }
}

export function isShopifyStorefrontHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host.endsWith(".myshopify.com") && host !== ".myshopify.com";
}

/**
 * Official standalone authorization-code URL:
 * https://{shop}.myshopify.com/admin/oauth/authorize
 * Never the public storefront root, and never admin.shopify.com/store/...
 */
export function shopifyAdminAppHref(
  shop: string,
  extra: Record<string, string> = {},
  appHandle = "virello-ai-optimizer"
): string {
  const normalized = normalizeShop(shop);
  if (!normalized) return "";
  const storeHandle = normalized.replace(/\.myshopify\.com$/i, "");
  const url = new URL(
    `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
    "https://admin.shopify.com"
  );
  url.searchParams.set("shop", normalized);
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function isShopifyAdminAuthorizeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (!isValidShopDomain(url.hostname)) return false;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return path === "/admin/oauth/authorize";
  } catch {
    return false;
  }
}

/** Standalone Connect opens the Admin app URL, not oauth/authorize. */
export function isShopifyAdminAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.hostname !== "admin.shopify.com") return false;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return /^\/store\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/apps\/[a-z0-9-]+$/i.test(path);
  } catch {
    return false;
  }
}

export function isAllowedShopifyConnectUrl(value: string): boolean {
  return isShopifyAdminAuthorizeUrl(value) || isShopifyAdminAppUrl(value);
}

export function shopFromShopifyHostParam(host: string): string {
  const raw = host.trim();
  if (!raw) return "";
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : atob(padded);
    const text = decoded.trim();
    if (!text) return "";
    return normalizeShop(text.includes("://") ? text : `https://${text}`);
  } catch {
    return "";
  }
}

export type StoreBindingKind = "connected" | "pending" | "none";

export function resolveStoreBindingDisplay(input: {
  shopInstalled?: boolean;
  shop?: string | null;
  pendingShop?: string | null;
}): { domain: string; kind: StoreBindingKind } {
  const installed = Boolean(input.shopInstalled);
  const connected = installed ? normalizeShop(input.shop || "") : "";
  if (connected) return { domain: connected, kind: "connected" };
  const pending =
    normalizeShop(input.pendingShop || "") || normalizeShop(input.shop || "");
  if (pending) return { domain: pending, kind: "pending" };
  return { domain: "", kind: "none" };
}
