import { createHash } from "node:crypto";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "../_lib/database";
import { deleteShopifyData } from "../_lib/shopify-auth";
import { getShopifyClientSecret } from "../_lib/shopify-config";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../_lib/webhook-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyShopifyHmac(
  body: string,
  hmacHeader: string | null
): boolean {
  const secret = getShopifyClientSecret();

  if (!secret || !hmacHeader) {
    return false;
  }

  const calculatedHmac = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest();

  const receivedHmac = Buffer.from(hmacHeader, "base64");

  if (receivedHmac.length !== calculatedHmac.length) {
    return false;
  }

  return crypto.timingSafeEqual(receivedHmac, calculatedHmac);
}

function shopifyEventId(
  request: Request,
  body: string,
  topic: string,
  shop: string
): string {
  const headerId = request.headers.get("x-shopify-webhook-id")?.trim();
  if (headerId) return headerId;
  return createHash("sha256")
    .update(`${topic}\n${shop}\n${body}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

    if (!verifyShopifyHmac(body, hmacHeader)) {
      console.error("Shopify webhook HMAC verification failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const topic = request.headers.get("x-shopify-topic") || "unknown";
    const shop = request.headers.get("x-shopify-shop-domain") || "";
    const eventId = shopifyEventId(request, body, topic, shop);

    await ensureDatabaseSchema();

    const claim = await claimWebhookEvent({
      provider: "shopify",
      eventId,
      eventType: topic,
      shop,
    });

    if (claim === "duplicate") {
      return NextResponse.json({ success: true, duplicate: true });
    }

    try {
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

      await markWebhookEvent("shopify", eventId, "processed");
    } catch (error) {
      await markWebhookEvent("shopify", eventId, "failed");
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
