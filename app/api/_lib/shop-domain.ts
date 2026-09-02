const SHOPIFY_SUFFIX = ".myshopify.com";

export function normalizeShop(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host.endsWith(SHOPIFY_SUFFIX) && host !== SHOPIFY_SUFFIX
      ? host
      : "";
  } catch {
    return "";
  }
}
