import { NextRequest } from "next/server";
import { authenticateShopifyRequest, storedShopifyScope } from "./shopify-auth";
import { isShopifyInstallationActive } from "./shops";
import { hasRequiredShopifyScopes } from "./shopify-scopes";
import {
  productAccessDeniedMessage,
  type ProductAccessDecision,
} from "./billing-access";
import { accessStateForShop, billingPeriodIsStale, syncShopifyBillingFromAdmin, type ShopifyBillingSnapshot } from "./shopify-billing";

export class ProductAccessError extends Error {
  status: number;
  reason: ProductAccessDecision["reason"];

  constructor(message: string, status: number, reason: ProductAccessDecision["reason"]) {
    super(message);
    this.name = "ProductAccessError";
    this.status = status;
    this.reason = reason;
  }
}

export async function requirePaidProductAccess(request: NextRequest): Promise<{
  shop: string;
  accessToken: string;
  billing: ShopifyBillingSnapshot;
  access: ProductAccessDecision;
}> {
  const { shop, accessToken } = await authenticateShopifyRequest(request, true);
  const shopInstalled = await isShopifyInstallationActive(shop);
  let { access, billing } = await accessStateForShop(shop, shopInstalled);
  if (accessToken && billing && billingPeriodIsStale(billing)) {
    try {
      billing = (await syncShopifyBillingFromAdmin(shop, accessToken)) || billing;
      const refreshed = await accessStateForShop(shop, shopInstalled);
      access = refreshed.access;
      billing = refreshed.billing || billing;
    } catch {
      // Use stored billing when Shopify Admin is unreachable.
    }
  }

  if (!shopInstalled || !access.productAccess || !billing) {
    throw new ProductAccessError(
      productAccessDeniedMessage(access.reason),
      access.reason === "not_installed" ? 403 : 402,
      access.reason
    );
  }

  if (!accessToken) {
    throw new ProductAccessError(
      "Shopify connection is missing. Reconnect the store to continue.",
      403,
      "not_installed"
    );
  }

  const scope = await storedShopifyScope(shop);
  if (!hasRequiredShopifyScopes(scope)) {
    throw new ProductAccessError(
      productAccessDeniedMessage("missing_scopes"),
      403,
      "missing_scopes"
    );
  }

  return { shop, accessToken, billing, access };
}
