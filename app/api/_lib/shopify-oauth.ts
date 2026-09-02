import { getAppUrl } from "./app-url";
import {
  isShopifyAdminAuthorizeUrl,
  normalizeShop,
  shopHandleFromDomain,
} from "./shop-domain";
import { getShopifyClientId, getShopifyClientSecret } from "./shopify-config";
import {
  createSignedOAuthState,
  type ShopifyOAuthFlow,
} from "./shopify-security";
import { SHOPIFY_OAUTH_SCOPE } from "./shopify-scopes";

export function shopifyCallbackUrl(fallbackOrigin = ""): string {
  return `${getAppUrl(fallbackOrigin)}/api/auth/shopify/callback`;
}

export function shopifyAdminAppUrl(shop: string, extra: Record<string, string> = {}): URL {
  const normalized = normalizeShop(shop);
  if (!normalized) {
    throw new Error("Invalid Shopify store.");
  }
  const storeHandle = normalized.replace(/\.myshopify\.com$/i, "");
  const appHandle =
    process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
  const url = new URL(
    `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
    "https://admin.shopify.com"
  );
  url.searchParams.set("shop", normalized);
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export function buildShopifyAuthorizeUrl(input: {
  shop: string;
  flow?: ShopifyOAuthFlow;
  fallbackOrigin?: string;
}): { url: string; shop: string; state: string } {
  const shop = normalizeShop(input.shop);
  if (!shop) {
    throw new Error("Invalid Shopify store domain.");
  }
  const apiKey = getShopifyClientId();
  const secret = getShopifyClientSecret();
  if (!apiKey || !secret) {
    throw new Error("Shopify credentials are not configured.");
  }
  const flow = input.flow === "embedded" ? "embedded" : "standalone";
  const state = createSignedOAuthState(shop, secret, flow);
  const handle = shopHandleFromDomain(shop);
  if (!handle) {
    throw new Error("Invalid Shopify store domain.");
  }
  // Unified Admin OAuth. Do not use https://{shop}/admin/oauth/authorize —
  // unpublished and new shops serve the public storefront 404 there.
  const url = new URL(
    `/store/${encodeURIComponent(handle)}/oauth/authorize`,
    "https://admin.shopify.com"
  );
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("scope", SHOPIFY_OAUTH_SCOPE);
  url.searchParams.set("redirect_uri", shopifyCallbackUrl(input.fallbackOrigin));
  url.searchParams.set("state", state);
  url.searchParams.set("shop", shop);
  const authorizeUrl = url.toString();
  if (!isShopifyAdminAuthorizeUrl(authorizeUrl)) {
    throw new Error(
      "Shopify authorization must start on admin.shopify.com, not the storefront."
    );
  }
  return { url: authorizeUrl, shop, state };
}
