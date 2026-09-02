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

export function shopHandleFromDomain(shop: string): string {
  const normalized = normalizeShop(shop);
  if (!normalized) return "";
  return normalized.replace(/\.myshopify\.com$/i, "");
}

export function isShopifyStorefrontHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host.endsWith(".myshopify.com") && host !== ".myshopify.com";
}

/**
 * Standalone OAuth must start on Shopify Admin, never the public storefront.
 * `{shop}.myshopify.com/admin/oauth/authorize` 404s to the password page on
 * unified-admin / unpublished shops such as gfd1cp-1v.myshopify.com.
 */
export function isShopifyAdminAuthorizeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.hostname !== "admin.shopify.com") return false;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/oauth/authorize" || path === "/admin/oauth/authorize") {
      return true;
    }
    return /^\/store\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/oauth\/authorize$/i.test(
      path
    );
  } catch {
    return false;
  }
}
