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
