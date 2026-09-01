import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  buildSubscriberCookieValue,
  clearSubscriberCookie,
  createStripeCheckoutSession,
  getCheckoutSubscription,
  saveShopSubscription,
  setSubscriberCookie,
} from "../../_lib/subscriber";
import { authenticateShopifyRequest } from "../../_lib/shopify-auth";

function getErrorDetails(error: unknown): {
  message: string;
  status: number;
} {
  const candidate = error as {
    message?: unknown;
    status?: unknown;
  };

  return {
    message:
      typeof candidate?.message === "string"
        ? candidate.message
        : "Unexpected Stripe error.",

    status:
      typeof candidate?.status === "number"
        ? candidate.status
        : 500,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const origin = new URL(request.url).origin;
    const { shop } = await authenticateShopifyRequest(request, false);

    const checkoutUrl =
      await createStripeCheckoutSession(
        origin,
        shop
      );

    return NextResponse.json(
      {
        success: true,
        url: checkoutUrl,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Stripe checkout error:",
      error
    );

    const details =
      getErrorDetails(error);

    return NextResponse.json(
      {
        success: false,
        error: details.message,
      },
      {
        status: details.status,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

export async function GET(
  request: NextRequest
) {
  const sessionId =
    request.nextUrl.searchParams.get(
      "session_id"
    ) || "";

  if (!sessionId) {
    return NextResponse.redirect(
      new URL(
        "/?checkout=cancelled",
        request.url
      )
    );
  }

  try {
    const checkout =
      await getCheckoutSubscription(
        sessionId
      );

    await saveShopSubscription(checkout.shop, checkout.subscription);

    const cookieValue =
      buildSubscriberCookieValue(
        checkout.subscription
      );

    const redirectUrl =
      new URL(
        "/?checkout=success",
        request.url
      );

    const response =
      NextResponse.redirect(
        redirectUrl
      );

    setSubscriberCookie(
      response,
      cookieValue
    );

    response.headers.set(
      "Cache-Control",
      "no-store"
    );

    return response;
  } catch (error) {
    console.error(
      "Stripe checkout verification error:",
      error
    );

    const details =
      getErrorDetails(error);

    const redirectUrl =
      new URL(
        "/",
        request.url
      );

    redirectUrl.searchParams.set(
      "checkout",
      "verification_failed"
    );

    redirectUrl.searchParams.set(
      "error",
      details.message
    );

    const response =
      NextResponse.redirect(
        redirectUrl
      );

    clearSubscriberCookie(
      response
    );

    response.headers.set(
      "Cache-Control",
      "no-store"
    );

    return response;
  }
}
