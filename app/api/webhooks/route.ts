import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const hmacHeader = request.headers.get(
      "x-shopify-hmac-sha256"
    );

    if (!verifyShopifyHmac(body, hmacHeader)) {
      console.error("Shopify webhook HMAC verification failed");

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const topic = request.headers.get("x-shopify-topic");
    const shop = request.headers.get(
      "x-shopify-shop-domain"
    );

    console.log(
      `Received verified Shopify webhook: ${
        topic ?? "unknown"
      } from ${shop ?? "unknown"}`
    );

    switch (topic) {
      case "customers/data_request":
      case "customers/redact":
      case "shop/redact":
        break;

      default:
        break;
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Webhook processing failed:", error);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
