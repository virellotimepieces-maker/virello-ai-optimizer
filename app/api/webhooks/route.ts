import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

function verifyShopifyHmac(
  rawBody: Buffer,
  hmacHeader: string | null
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret || !hmacHeader) {
    return false;
  }

  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
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
    const rawBody = Buffer.from(
      await request.arrayBuffer()
    );

    const hmacHeader = request.headers.get(
      "x-shopify-hmac-sha256"
    );

    if (!verifyShopifyHmac(rawBody, hmacHeader)) {
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

    let payload: any = null;

    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      payload = null;
    }

    if (topic && REQUIRED_TOPICS.has(topic)) {
      console.log(
        `Processed compliance webhook ${topic} from ${shop ?? "unknown"}`,
        payload?.id ? { id: payload.id } : undefined
      );

      return NextResponse.json(
        { success: true },
        { status: 200 }
      );
    }

    console.log(
      `Received verified Shopify webhook: ${
        topic ?? "unknown"
      } from ${shop ?? "unknown"}`
    );

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
