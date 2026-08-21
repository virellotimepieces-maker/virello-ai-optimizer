import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifyShopifyHmac(body: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret || !hmacHeader) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");

  const received = Buffer.from(hmacHeader, "utf8");
  const calculated = Buffer.from(digest, "utf8");

  if (received.length !== calculated.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, calculated);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!verifyShopifyHmac(body, hmac)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const topic = request.headers.get("x-shopify-topic") || "";
    const shop = request.headers.get("x-shopify-shop-domain") || "";

    console.log("Shopify webhook received:", {
      topic,
      shop,
    });

    switch (topic) {
      case "customers/data_request":
        console.log("Customer data request received.");
        break;

      case "customers/redact":
        console.log("Customer redact request received.");
        break;

      case "shop/redact":
        console.log("Shop redact request received.");
        break;

      default:
        console.log("Unhandled Shopify webhook topic:", topic);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SHOPIFY_WEBHOOK_ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
