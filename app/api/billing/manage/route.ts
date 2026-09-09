import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { authenticateShopifyRequest, ShopifyAuthError } from "../../_lib/shopify-auth";
import {
  billingForShop,
  shopifyBillingManageUrl,
  syncShopifyBillingFromAdmin,
  ShopifyBillingError,
} from "../../_lib/shopify-billing";
import { getActiveSubscriberStatus } from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const status = await getActiveSubscriberStatus(request);
    if (!status.canManage || !status.shop) {
      return NextResponse.json(
        {
          success: false,
          error: "Approve or start a Shopify app subscription first.",
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    let billing = await billingForShop(status.shop);
    try {
      const { accessToken } = await authenticateShopifyRequest(request, true);
      billing = (await syncShopifyBillingFromAdmin(status.shop, accessToken)) || billing;
    } catch {
      // Stored confirmation / Admin billing URL is enough to manage.
    }

    const url = shopifyBillingManageUrl(status.shop, billing);
    return NextResponse.json(
      { success: true, url, shop: status.shop, status: billing?.status || status.status },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("SHOPIFY_BILLING_MANAGE_ERROR:", error);
    const status =
      error instanceof OriginGuardError ||
      error instanceof ShopifyAuthError ||
      error instanceof ShopifyBillingError
        ? error.status
        : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to open Shopify subscription management.",
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
