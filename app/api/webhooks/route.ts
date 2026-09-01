import { NextResponse } from "next/server";
import crypto from "crypto";
import { deleteShopifyData } from "../_lib/shopify-auth";

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
    .digest();

  const receivedHmac = Buffer.from(
    hmacHeader,
    "base64"
  );

  if (receivedHmac.length !== calculatedHmac.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedHmac,
    calculatedHmac
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.text();

    const hmacHeader = request.headers.get(
      "x-shopify-hmac-sha256"
    );

    if (!verifyShopifyHmac(body, hmacHeader)) {
      console.error(
        "Shopify webhook HMAC verification failed"
      );

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const topic = request.headers.get(
      "x-shopify-topic"
    );

    const shop = request.headers.get(
      "x-shopify-shop-domain"
    );

    console.log(
      `Received verified Shopify webhook: ${
        topic ?? "unknown"
      } from ${shop ?? "unknown"}`
    );

    switch (topic) {
      case "app/uninstalled":
      case "shop/redact":
        if (shop) await deleteShopifyData(shop);
        break;

      case "customers/data_request":
      case "customers/redact":
        // Virello does not store Shopify customer data.
        break;

      default:
        break;
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Webhook processing failed:",
      error
    );

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
