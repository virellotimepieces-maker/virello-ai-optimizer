const SHOPIFY_SUFFIX = ".myshopify.com";
const SHOP_NAME =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;

export function isValidShopDomain(shop: string): boolean {
  return SHOP_NAME.test(shop);
}

export function normalizeShop(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.username || url.password) return "";
    return isValidShopDomain(host) ? host : "";
  } catch {
    return "";
  }
}
