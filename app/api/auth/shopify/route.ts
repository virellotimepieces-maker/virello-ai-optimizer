import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import { normalizeShop } from "../../_lib/shop-domain";
import {
  buildShopifyAuthorizeUrl,
  shopifyAdminAppUrl,
} from "../../_lib/shopify-oauth";
import { getShopifyClientId } from "../../_lib/shopify-config";
import { shopFromSessionCookie } from "../../_lib/app-session";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../../_lib/rate-limit";

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get("accept") || "";
  return (
    request.nextUrl.searchParams.get("format") === "json" ||
    (accept.includes("application/json") && !accept.includes("text/html"))
  );
}

function oauthStartResponse(
  request: NextRequest,
  payload: { success: boolean; error?: string; url?: string; shop?: string },
  status: number
) {
  if (payload.success && payload.url && !wantsJson(request)) {
    const response = NextResponse.redirect(payload.url, 307);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  }
  return NextResponse.json(payload, {
    status: payload.success ? 200 : status,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const shop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
    const sessionShop = await shopFromSessionCookie(request);
    if (sessionShop && shop && sessionShop !== shop) {
      return oauthStartResponse(
        request,
        {
          success: false,
          error: "This Virello session is already linked to a different Shopify store.",
        },
        403
      );
    }
    await assertRateLimit(tenantRateKey(request, "oauth", shop || sessionShop), 30);
    if (!shop) {
      return oauthStartResponse(
        request,
        {
          success: false,
          error: "Invalid Shopify store domain. Use your .myshopify.com domain.",
        },
        400
      );
    }

    const apiKey = getShopifyClientId();
    if (!apiKey) {
      return oauthStartResponse(
        request,
        {
          success: false,
          error: "SHOPIFY_API_KEY is not configured.",
        },
        500
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
      return oauthStartResponse(
        request,
        {
          success: true,
          url: shopifyAdminAppUrl(shop).toString(),
          shop,
        },
        307
      );
    }

    const authorize = buildShopifyAuthorizeUrl({
      shop,
      flow: "standalone",
      fallbackOrigin: getAppUrl(request.nextUrl.origin),
    });
    return oauthStartResponse(
      request,
      { success: true, url: authorize.url, shop },
      307
    );
  } catch (error) {
    console.error("SHOPIFY_OAUTH_START_ERROR:", error);
    const status = error instanceof RateLimitError ? error.status : 500;
    return oauthStartResponse(
      request,
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Shopify authorization.",
      },
      status
    );
  }
}
