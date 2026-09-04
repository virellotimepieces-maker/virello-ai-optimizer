import { NextRequest, NextResponse } from "next/server";
import { normalizeShop } from "../../_lib/shop-domain";
import { shopifyAdminAppUrl } from "../../_lib/shopify-oauth";
import { getShopifyClientId, getShopifyClientSecret } from "../../_lib/shopify-config";
import { getSessionBinding, retargetUninstalledShop, setPendingShop, ShopBindingError } from "../../_lib/shop-binding";
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
    const binding = await getSessionBinding(request);
    if (binding?.installedShop && shop && binding.installedShop !== shop) {
      return oauthStartResponse(
        request,
        {
          success: false,
          error:
            "This Virello session is already linked to a different Shopify store. Use Change Store to disconnect it first.",
        },
        403
      );
    }
    await assertRateLimit(
      tenantRateKey(request, "oauth", shop || binding?.sessionShop),
      30
    );
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
    if (!getShopifyClientSecret()) {
      return oauthStartResponse(
        request,
        {
          success: false,
          error:
            "SHOPIFY_API_SECRET is missing. In Vercel add it as Production only, then Redeploy Production without build cache.",
        },
        500
      );
    }

    if (binding && !binding.installedShop) {
      await retargetUninstalledShop(
        binding.sessionShop,
        shop,
        binding.stripeCustomerId
      );
    }
    if (binding?.sessionId) {
      await setPendingShop(binding.sessionId, shop);
    }
    return oauthStartResponse(
      request,
      {
        success: true,
        url: shopifyAdminAppUrl(shop).toString(),
        shop,
      },
      307
    );
  } catch (error) {
    console.error("SHOPIFY_OAUTH_START_ERROR:", error);
    const status =
      error instanceof RateLimitError || error instanceof ShopBindingError
        ? error.status
        : 500;
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
