import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ensureDatabaseSchema } from "../_lib/database";
import { deleteShopifyData, redactShopifyData } from "../_lib/shopify-auth";
import { applyAppSubscriptionWebhook } from "../_lib/shopify-billing";
import { verifyShopifyWebhookHmac } from "../_lib/shopify-security";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../_lib/webhook-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPLIANCE_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

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

async function processTopic(topic: string, shop: string, body: string): Promise<void> {
  switch (topic) {
    case "app/uninstalled":
      if (shop) await deleteShopifyData(shop);
      break;
    case "shop/redact":
      if (shop) await redactShopifyData(shop);
      break;
    case "app_subscriptions/update":
      if (shop) {
        await applyAppSubscriptionWebhook(shop, JSON.parse(body) as unknown);
      }
      break;
    case "customers/data_request":
    case "customers/redact":
      break;
    default:
      break;
  }
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
  const compliance = COMPLIANCE_TOPICS.has(topic);

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
        await processTopic(topic, shop, body);
        await markWebhookEvent("shopify", eventId, "processed");
      } catch (error) {
        await markWebhookEvent("shopify", eventId, "failed").catch(() => undefined);
        console.error("Webhook side effects failed:", error);
        if (!compliance) {
          return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
        }
      }
    }
  } catch (error) {
    console.error("Webhook persistence failed:", error);
    if (!compliance) {
      return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { success: true },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
