import { NextRequest } from "next/server";
import { authenticateShopifyRequest } from "./shopify-auth";
import { isShopifyInstallationActive } from "./shops";
import {
  productAccessDeniedMessage,
  type ProductAccessDecision,
} from "./stripe-access";
import { accessStateForShop } from "./stripe-events";
import type { BillingSnapshot } from "./stripe-billing";

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
  billing: BillingSnapshot;
  access: ProductAccessDecision;
}> {
  const { shop, accessToken } = await authenticateShopifyRequest(request, true);
  const shopInstalled = await isShopifyInstallationActive(shop);
  const { access, billing } = await accessStateForShop(shop, shopInstalled);

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

  return { shop, accessToken, billing, access };
}
