import { NextRequest, NextResponse } from "next/server";
import { getActiveSubscriberStatus } from "../../_lib/subscriber";

export const runtime = "nodejs";

function getStripeSecret(): string {
  const secret = process.env.STRIPE_SECRET_KEY;

  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return secret;
}

async function stripeRequest(
  path: string,
  body: URLSearchParams
) {
  const response = await fetch(
    `https://api.stripe.com/v1/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getStripeSecret()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Stripe request failed."
    );
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    const status = await getActiveSubscriberStatus(request);

    if (
      !status?.active ||
      !status?.customerId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Active subscriber could not be verified.",
        },
        { status: 401 }
      );
    }

    const body = new URLSearchParams();

    body.set("customer", status.customerId);
    body.set("return_url", request.nextUrl.origin);

    const portal = await stripeRequest(
      "billing_portal/sessions",
      body
    );

    if (!portal?.url) {
      throw new Error(
        "Stripe did not return a billing portal URL."
      );
    }

    return NextResponse.json({
      success: true,
      url: portal.url,
    });
  } catch (error) {
    console.error("STRIPE_PORTAL_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to open subscription management.",
      },
      { status: 500 }
    );
  }
}
