import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import { applySessionCookie, issueAppSession, readSessionId } from "../../_lib/app-session";
import { authenticateShopifyRequest } from "../../_lib/shopify-auth";
import { normalizeShop } from "../../_lib/shop-domain";
import {
  billingReturnAppUrl,
  syncShopifyBillingFromAdmin,
} from "../../_lib/shopify-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const shop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
  const appUrl = getAppUrl();
  if (!shop) {
    return NextResponse.redirect(new URL("/?checkout=cancelled", appUrl));
  }

  try {
    const { accessToken } = await authenticateShopifyRequest(request, true);
    await syncShopifyBillingFromAdmin(shop, accessToken);
    const sessionId = await issueAppSession({
      shop,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });
    const embedded =
      request.nextUrl.searchParams.get("embedded") === "1" ||
      Boolean(request.nextUrl.searchParams.get("host"));
    const response = NextResponse.redirect(
      billingReturnAppUrl(shop, embedded ? "embedded" : "standalone")
    );
    applySessionCookie(response, sessionId, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("SHOPIFY_BILLING_RETURN_ERROR:", error);
    const fallback = NextResponse.redirect(billingReturnAppUrl(shop, "embedded"));
    fallback.headers.set("Cache-Control", "no-store");
    return fallback;
  }
}
