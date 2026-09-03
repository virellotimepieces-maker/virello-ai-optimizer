import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ensureDatabaseSchema } from "../_lib/database";
import { deleteShopifyData } from "../_lib/shopify-auth";
import { verifyShopifyWebhookHmac } from "../_lib/shopify-security";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../_lib/webhook-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const body = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!verifyShopifyWebhookHmac(body, hmacHeader)) {
    console.error("Shopify webhook HMAC verification failed");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") || "unknown";
  const shop = request.headers.get("x-shopify-shop-domain") || "";
  const eventId = shopifyEventId(request, body, topic, shop);

  try {
    await ensureDatabaseSchema();
    const claim = await claimWebhookEvent({
      provider: "shopify",
      eventId,
      eventType: topic,
      shop,
    });

    if (claim !== "duplicate") {
      try {
        switch (topic) {
          case "app/uninstalled":
          case "shop/redact":
            if (shop) await deleteShopifyData(shop);
            break;
          case "customers/data_request":
          case "customers/redact":
            break;
          default:
            break;
        }
        await markWebhookEvent("shopify", eventId, "processed");
      } catch (error) {
        await markWebhookEvent("shopify", eventId, "failed");
        console.error("Webhook side effects failed:", error);
      }
    }
  } catch (error) {
    console.error("Webhook persistence failed:", error);
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
