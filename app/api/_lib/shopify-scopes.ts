export const REQUIRED_SHOPIFY_SCOPES = ["read_products", "write_products"] as const;

export const SHOPIFY_OAUTH_SCOPE = REQUIRED_SHOPIFY_SCOPES.join(",");

export function parseShopifyScopes(scope: string): Set<string> {
  return new Set(
    scope
      .split(/[,\s]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function hasRequiredShopifyScopes(scope: string): boolean {
  const granted = parseShopifyScopes(scope);
  const canWrite = granted.has("write_products");
  const canRead = granted.has("read_products") || canWrite;
  return canRead && canWrite;
}

export function missingShopifyScopes(scope: string): string[] {
  const granted = parseShopifyScopes(scope);
  const missing: string[] = [];
  if (!granted.has("write_products")) missing.push("write_products");
  if (!granted.has("read_products") && !granted.has("write_products")) {
    missing.push("read_products");
  }
  return missing;
}
