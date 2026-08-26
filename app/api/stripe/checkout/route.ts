import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "STRIPE_SECRET_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        {
          success: false,
          error: "STRIPE_PRICE_ID is not configured.",
        },
        { status: 500 }
      );
    }

    const origin =
      request.headers.get("origin") ||
      new URL(request.url).origin;

    const body = new URLSearchParams();

    body.append("mode", "subscription");
    body.append("line_items[0][price]", priceId);
    body.append("line_items[0][quantity]", "1");

    body.append(
      "success_url",
      `${origin}/?checkout=success`
    );

    body.append(
      "cancel_url",
      `${origin}/?checkout=cancelled`
    );

    body.append(
      "billing_address_collection",
      "auto"
    );

    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error?.message ||
            "Unable to create Stripe checkout session.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      url: data.url,
    });
  } catch (error) {
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
