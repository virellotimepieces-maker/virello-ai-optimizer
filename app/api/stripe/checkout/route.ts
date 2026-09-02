import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import {
  applySessionCookie,
  issueAppSession,
  readSessionId,
} from "../../_lib/app-session";
import {
  CheckoutShopError,
  checkoutSuccessUrl,
  resolveCheckoutShop,
} from "../../_lib/checkout-shop";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { assertRateLimit, tenantRateKey } from "../../_lib/rate-limit";
import { applySubscriptionEvent } from "../../_lib/stripe-events";
import { revokeAppSessionsForShop } from "../../_lib/shops";
import {
  clearSubscriberCookie,
  createStripeCheckoutSession,
  getCheckoutSubscription,
} from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const body = await request.json().catch(() => ({}));
    const identity = await resolveCheckoutShop(request, body);
    await assertRateLimit(tenantRateKey(request, "checkout", identity.shop), 15);
    const origin = getAppUrl(new URL(request.url).origin);
    const checkoutUrl = await createStripeCheckoutSession(
      origin,
      identity.shop,
      identity.flow
    );

    return NextResponse.json(
      { success: true, url: checkoutUrl, shop: identity.shop, flow: identity.flow },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const details = getErrorDetails(error);
    const status =
      error instanceof OriginGuardError || error instanceof CheckoutShopError
        ? error.status
        : details.status;
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
    await applySubscriptionEvent({
      shop: checkout.shop,
      object: {
        id: checkout.subscription.subscriptionId,
        customer: checkout.subscription.customerId,
        status: checkout.subscription.status,
        current_period_start: checkout.subscription.currentPeriodStart,
        current_period_end: checkout.subscription.currentPeriodEnd,
        livemode: checkout.livemode,
        metadata: { shop: checkout.shop },
      },
      eventCreated: Math.floor(Date.now() / 1000),
      livemode: checkout.livemode,
    });
    await revokeAppSessionsForShop(checkout.shop);

    const appSessionId = await issueAppSession({
      shop: checkout.shop,
      stripeCustomerId: checkout.subscription.customerId,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const appUrl = getAppUrl(request.nextUrl.origin);
    const response = NextResponse.redirect(
      checkoutSuccessUrl(appUrl, checkout.shop, checkout.flow)
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
