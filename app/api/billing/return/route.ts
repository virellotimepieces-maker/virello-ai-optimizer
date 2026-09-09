import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import { applySessionCookie, issueAppSession, readSessionId } from "../../_lib/app-session";
import { isPaidSubscriptionStatus } from "../../_lib/billing-access";
import { authenticateShopifyRequest } from "../../_lib/shopify-auth";
import { normalizeShop } from "../../_lib/shop-domain";
import {
  billingForShop,
  billingReturnAppUrl,
  syncShopifyBillingFromAdmin,
} from "../../_lib/shopify-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const shop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
  const appUrl = getAppUrl();
  const embedded =
    request.nextUrl.searchParams.get("embedded") === "1" ||
    Boolean(request.nextUrl.searchParams.get("host"));
  const flow = embedded ? "embedded" : "standalone";
  if (!shop) {
    return NextResponse.redirect(new URL("/?checkout=cancelled", appUrl));
  }

  try {
    const { accessToken } = await authenticateShopifyRequest(request, true);
    const billing =
      (await syncShopifyBillingFromAdmin(shop, accessToken)) || (await billingForShop(shop));
    const sessionId = await issueAppSession({
      shop,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });
    const checkout =
      billing && isPaidSubscriptionStatus(billing.status) ? "success" : "cancelled";
    const response = NextResponse.redirect(billingReturnAppUrl(shop, flow, checkout));
    applySessionCookie(response, sessionId, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("SHOPIFY_BILLING_RETURN_ERROR:", error);
    const fallback = NextResponse.redirect(billingReturnAppUrl(shop, flow, "cancelled"));
    fallback.headers.set("Cache-Control", "no-store");
    return fallback;
  }
}
