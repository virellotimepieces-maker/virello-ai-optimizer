import { NextResponse } from "next/server";
import { ensureDatabaseSchema } from "../../_lib/database";
import { normalizeShop } from "../../_lib/shopify-auth";
import { revokeAppSessionsForShop } from "../../_lib/shops";
import { verifyStripeSignature } from "../../_lib/stripe-signature";
import {
  getCheckoutSubscription,
  saveShopSubscription,
  saveStripeSubscriptionPayload,
} from "../../_lib/subscriber";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../../_lib/webhook-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is missing.");

    return NextResponse.json(
      {
        received: false,
        error: "Webhook is not configured.",
      },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json(
      {
        received: false,
        error: "Invalid Stripe signature.",
      },
      { status: 400 }
    );
  }

  let event: {
    id?: string;
    type?: string;
    data?: {
      object?: {
        id?: string;
        customer?: string;
        status?: string;
        client_reference_id?: string;
        metadata?: { shop?: string };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        received: false,
        error: "Invalid webhook body.",
      },
      { status: 400 }
    );
  }

  const object = event.data?.object;

  if (!event.id || !event.type || !object) {
    return NextResponse.json(
      { received: false, error: "Incomplete Stripe event." },
      { status: 400 }
    );
  }

  await ensureDatabaseSchema();

  const claim = await claimWebhookEvent({
    provider: "stripe",
    eventId: event.id,
    eventType: event.type,
    shop: object.metadata?.shop || object.client_reference_id,
  });

  if (claim === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (!object.id) {
          throw new Error("Stripe checkout event has no session ID.");
        }
        const checkout = await getCheckoutSubscription(object.id);
        await saveShopSubscription(checkout.shop, checkout.subscription);
        await revokeAppSessionsForShop(checkout.shop);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const shop = normalizeShop(object.metadata?.shop || "");
        if (!shop) {
          throw new Error("Stripe subscription is not linked to a Shopify store.");
        }
        await saveStripeSubscriptionPayload(shop, object);
        break;

      default:
        console.log("STRIPE_EVENT_IGNORED", {
          eventId: event.id,
          type: event.type,
        });
    }

    await markWebhookEvent("stripe", event.id, "processed");
  } catch (error) {
    await markWebhookEvent("stripe", event.id, "failed");
    throw error;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
