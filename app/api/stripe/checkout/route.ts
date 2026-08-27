import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
} from "../../_lib/shopify";
import {
  buildSubscriberCookieValue,
  clearSubscriberCookie,
  createStripeCheckoutSession,
  getCheckoutSubscription,
  setSubscriberCookie,
} from "../../_lib/subscriber";

function getRequestOrigin(request: NextRequest): string {
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  try {
    const checkoutUrl = await createStripeCheckoutSession(
      getRequestOrigin(request)
    );

    return NextResponse.json({
      success: true,
      url: checkoutUrl,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.status }
      );
    }

    console.error("Stripe checkout error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to create checkout session.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionId =
    request.nextUrl.searchParams.get("session_id") ||
    "";

  if (!sessionId) {
    return NextResponse.redirect(
      new URL("/?checkout=cancelled", request.url)
    );
  }

  try {
    const subscription = await getCheckoutSubscription(
      sessionId
    );

    const cookieValue =
      buildSubscriberCookieValue(subscription);

    const redirectUrl = new URL(
      "/?checkout=success",
      request.url
    );

    const response = NextResponse.redirect(redirectUrl);

    setSubscriberCookie(response, cookieValue);

    return response;
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Unable to verify subscription checkout.";

    const redirectUrl = new URL(
      "/connect",
      request.url
    );

    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("error", message);

    const response = NextResponse.redirect(redirectUrl);

    clearSubscriberCookie(response);

    return response;
  }
}
