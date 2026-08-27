import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyShopifyHmac(
  body: Buffer,
  hmacHeader: string | null
): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;

  if (!secret || !hmacHeader) {
    return false;
  }

  const normalizedHeader = hmacHeader.trim();
  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64");

  const receivedBuffer = Buffer.from(
    normalizedHeader,
    "utf8"
  );
  const calculatedBuffer = Buffer.from(
    calculatedHmac,
    "utf8"
  );

  if (
    receivedBuffer.length !==
    calculatedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    calculatedBuffer
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

    if (
      !verifyShopifyHmac(
        rawBody,
        hmacHeader
      )
    ) {
      console.error(
        "Shopify webhook HMAC verification failed"
      );

      return new NextResponse(
        "Unauthorized",
        {
          status: 401,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        }
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

    if (
      topic !== "customers/data_request" &&
      topic !== "customers/redact" &&
      topic !== "shop/redact"
    ) {
      return new NextResponse(null, {
        status: 200,
      });
    }

    JSON.parse(rawBody.toString("utf8"));

    return new NextResponse(null, {
      status: 200,
    });
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
