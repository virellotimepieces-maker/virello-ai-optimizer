import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import {
  applySessionCookie,
  issueAppSession,
  readSessionId,
} from "../../_lib/app-session";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { authenticateShopifyRequest } from "../../_lib/shopify-auth";
import { revokeAppSessionsForShop } from "../../_lib/shops";
import {
  clearSubscriberCookie,
  createStripeCheckoutSession,
  getCheckoutSubscription,
  saveShopSubscription,
} from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEmbeddedShopifyAppUrl(shop: string, checkout: "success"): URL {
  const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
  const appHandle =
    process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
  const url = new URL(
    `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
    "https://admin.shopify.com"
  );
  url.searchParams.set("shop", shop);
  url.searchParams.set("checkout", checkout);
  return url;
}

function getErrorDetails(error: unknown): { message: string; status: number } {
  const candidate = error as { message?: unknown; status?: unknown };
  return {
    message:
      typeof candidate?.message === "string"
        ? candidate.message
        : "Unexpected Stripe error.",
    status:
      typeof candidate?.status === "number" ? candidate.status : 500,
  };
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const origin = getAppUrl(new URL(request.url).origin);
    const { shop } = await authenticateShopifyRequest(request, false);
    const checkoutUrl = await createStripeCheckoutSession(origin, shop);

    return NextResponse.json(
      { success: true, url: checkoutUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const details = getErrorDetails(error);
    const status =
      error instanceof OriginGuardError ? error.status : details.status;
    return NextResponse.json(
      { success: false, error: details.message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") || "";

  if (!sessionId) {
    return NextResponse.redirect(new URL("/?checkout=cancelled", request.url));
  }

  try {
    const checkout = await getCheckoutSubscription(sessionId);
    await saveShopSubscription(checkout.shop, checkout.subscription);
    await revokeAppSessionsForShop(checkout.shop);

    const appSessionId = await issueAppSession({
      shop: checkout.shop,
      stripeCustomerId: checkout.subscription.customerId,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const response = NextResponse.redirect(
      getEmbeddedShopifyAppUrl(checkout.shop, "success")
    );
    applySessionCookie(response, appSessionId, request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Stripe checkout verification error:", error);
    const details = getErrorDetails(error);
    const redirectUrl = new URL("/", getAppUrl(request.nextUrl.origin));
    redirectUrl.searchParams.set("checkout", "verification_failed");
    redirectUrl.searchParams.set("error", details.message);
    const response = NextResponse.redirect(redirectUrl);
    clearSubscriberCookie(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
