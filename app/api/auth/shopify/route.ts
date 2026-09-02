import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import { normalizeShop } from "../../_lib/shop-domain";
import {
  buildShopifyAuthorizeUrl,
  shopifyAdminAppUrl,
} from "../../_lib/shopify-oauth";
import { getShopifyClientId } from "../../_lib/shopify-config";

export async function GET(request: NextRequest) {
  try {
    const shop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
    if (!shop) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Shopify store domain. Use your .myshopify.com domain.",
        },
        { status: 400 }
      );
    }

    const apiKey = getShopifyClientId();
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SHOPIFY_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const embedded =
      request.nextUrl.searchParams.get("embedded") === "1" ||
      Boolean(request.nextUrl.searchParams.get("host"));
    const flowParam = request.nextUrl.searchParams.get("flow");
    const flow =
      flowParam === "standalone"
        ? "standalone"
        : flowParam === "embedded" || embedded
          ? "embedded"
          : "standalone";

    if (flow === "embedded") {
      const response = NextResponse.redirect(shopifyAdminAppUrl(shop));
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    const authorize = buildShopifyAuthorizeUrl({
      shop,
      flow: "standalone",
      fallbackOrigin: getAppUrl(request.nextUrl.origin),
    });
    const response = NextResponse.redirect(authorize.url);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    console.error("SHOPIFY_OAUTH_START_ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Shopify authorization.",
      },
      { status: 500 }
    );
  }
}
