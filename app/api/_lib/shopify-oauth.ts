import { getAppUrl } from "./app-url";
import {
  isShopifyAdminAuthorizeUrl,
  normalizeShop,
  shopifyAdminAppHref,
} from "./shop-domain";
import { getShopifyClientId, getShopifyClientSecret } from "./shopify-config";
import {
  createSignedOAuthState,
  type ShopifyOAuthFlow,
} from "./shopify-security";
import { SHOPIFY_OAUTH_SCOPE } from "./shopify-scopes";

export function shopifyCallbackUrl(_fallbackOrigin = ""): string {
  void _fallbackOrigin;
  return `${getAppUrl()}/api/auth/shopify/callback`;
}

export function shopifyAdminAppUrl(shop: string, extra: Record<string, string> = {}): URL {
  const appHandle =
    process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
  const href = shopifyAdminAppHref(shop, extra, appHandle);
  if (!href) {
    throw new Error("Invalid Shopify store.");
  }
  return new URL(href);
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
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", apiKey);
  url.searchParams.set("scope", SHOPIFY_OAUTH_SCOPE);
  url.searchParams.set("redirect_uri", shopifyCallbackUrl(input.fallbackOrigin));
  url.searchParams.set("state", state);
  const authorizeUrl = url.toString();
  if (!isShopifyAdminAuthorizeUrl(authorizeUrl)) {
    throw new Error(
      "Shopify authorization must start at {shop}.myshopify.com/admin/oauth/authorize."
    );
  }
  return { url: authorizeUrl, shop, state };
}
