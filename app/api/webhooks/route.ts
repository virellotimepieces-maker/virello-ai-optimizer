import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function verifyShopifyHmac(
  body: string,
  hmacHeader: string | null
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret || !hmacHeader) {
    return false;
  }

  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");

  const received = Buffer.from(hmacHeader, "utf8");
  const calculated = Buffer.from(calculatedHmac, "utf8");

  if (received.length !== calculated.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, calculated);
}

export async function POST(request: NextRequest) {
  try {
    // Shopify sends the webhook as JSON.
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { success: false, error: "Invalid content type" },
        { status: 400 }
      );
    }

    // IMPORTANT: Read the raw body before parsing JSON.
    // HMAC must be calculated from the exact raw request body.
    const body = await request.text();

    const hmac = request.headers.get("x-shopify-hmac-sha256");

    // Verify Shopify's HMAC signature.
    if (!verifyShopifyHmac(body, hmac)) {
      console.error("Invalid Shopify webhook HMAC");
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    let payload: unknown = {};

    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const topic =
      request.headers.get("x-shopify-topic")?.toLowerCase() || "";

    const shop =
      request.headers.get("x-shopify-shop-domain") || "";

    console.log("Shopify webhook received:", {
      topic,
      shop,
    });

    switch (topic) {
      case "customers/data_request":
        console.log(
          "Customer data request received.",
          payload
        );
        break;

      case "customers/redact":
        console.log(
          "Customer redact request received.",
          payload
        );
        break;

      case "shop/redact":
        console.log(
          "Shop redact request received.",
          payload
        );
        break;

      default:
        console.log(
          "Unhandled Shopify webhook topic:",
          topic
        );
        break;
    }

    // Shopify requires a successful 2xx response.
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("SHOPIFY_WEBHOOK_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}
