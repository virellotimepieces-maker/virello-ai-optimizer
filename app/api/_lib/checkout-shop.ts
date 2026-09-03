import { NextRequest } from "next/server";
import { shopFromSessionCookie } from "./app-session";
import { isShopifyInstallationActive } from "./shops";
import { normalizeShop } from "./shop-domain";
import { accessStateForShop } from "./stripe-events";
import {
  getShopifyIdToken,
  ShopifySecurityError,
  verifyShopifySessionToken,
} from "./shopify-security";

export class CheckoutShopError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutShopError";
    this.status = status;
  }
}

export type CheckoutFlow = "embedded" | "standalone";

export type CheckoutIdentity = {
  shop: string;
  flow: CheckoutFlow;
  source: "jwt" | "session" | "body";
};

function requestedShop(body: { shop?: unknown } | null): string {
  if (!body || typeof body.shop !== "string") return "";
  return normalizeShop(body.shop);
}

function requestedFlow(body: { flow?: unknown } | null): CheckoutFlow | "" {
  if (!body || typeof body.flow !== "string") return "";
  if (body.flow === "embedded" || body.flow === "standalone") return body.flow;
  return "";
}

export async function resolveCheckoutShop(
  request: NextRequest,
  body: { shop?: unknown; flow?: unknown } | null = null
): Promise<CheckoutIdentity> {
  const bodyShop = requestedShop(body);
  const idToken = getShopifyIdToken(request);

  if (idToken) {
    try {
      const identity = verifyShopifySessionToken(idToken);
      if (bodyShop && bodyShop !== identity.shop) {
        throw new CheckoutShopError(
          "Checkout shop does not match the signed Shopify session.",
          403
        );
      }
      const sessionShop = await shopFromSessionCookie(request);
      if (sessionShop && sessionShop !== identity.shop) {
        throw new CheckoutShopError(
          "This Virello session is already linked to a different Shopify store.",
          403
        );
      }
      return { shop: identity.shop, flow: "embedded", source: "jwt" };
    } catch (error) {
      if (error instanceof CheckoutShopError) throw error;
      if (error instanceof ShopifySecurityError) {
        throw new CheckoutShopError(error.message, error.status);
      }
      throw new CheckoutShopError("Shopify session token is invalid.", 401);
    }
  }

  const sessionShop = await shopFromSessionCookie(request);
  if (sessionShop) {
    const flow = requestedFlow(body) || "standalone";
    if (bodyShop && bodyShop !== sessionShop) {
      if (await isShopifyInstallationActive(sessionShop)) {
        throw new CheckoutShopError(
          "This Virello session is already linked to a connected Shopify store. Use Change Store first.",
          403
        );
      }
      const { billing } = await accessStateForShop(sessionShop, false);
      if (billing) {
        throw new CheckoutShopError(
          `Your $29.99 is still on ${sessionShop}. Keep that store, or tap Use this store to move billing, then Subscribe.`,
          403
        );
      }
      return { shop: bodyShop, flow, source: "body" };
    }
    return { shop: sessionShop, flow, source: "session" };
  }

  if (!bodyShop) {
    throw new CheckoutShopError(
      "Enter your Shopify .myshopify.com domain before subscribing."
    );
  }

  return {
    shop: bodyShop,
    flow: requestedFlow(body) || "standalone",
    source: "body",
  };
}

export function checkoutCancelUrl(
  appUrl: string,
  shop: string,
  flow: CheckoutFlow
): string {
  if (flow === "embedded") {
    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
    const appHandle =
      process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
    const url = new URL(
      `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
      "https://admin.shopify.com"
    );
    url.searchParams.set("shop", shop);
    url.searchParams.set("checkout", "cancelled");
    return url.toString();
  }
  return `${appUrl}/?checkout=cancelled`;
}

export function checkoutSuccessUrl(
  appUrl: string,
  shop: string,
  flow: CheckoutFlow
): string {
  if (flow === "embedded") {
    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
    const appHandle =
      process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
    const url = new URL(
      `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
      "https://admin.shopify.com"
    );
    url.searchParams.set("shop", shop);
    url.searchParams.set("checkout", "success");
    return url.toString();
  }
  const url = new URL("/", appUrl);
  url.searchParams.set("checkout", "success");
  url.searchParams.set("shop", shop);
  return url.toString();
}
