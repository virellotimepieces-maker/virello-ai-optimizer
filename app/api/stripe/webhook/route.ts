import { NextResponse } from "next/server";
import { ensureDatabaseSchema, withDbTransaction } from "../../_lib/database";
import { normalizeShop } from "../../_lib/shopify-auth";
import { verifyStripeSignature } from "../../_lib/stripe-signature";
import {
  assertLivemodeMatchesSecret,
  assertWebhookSecretConfigured,
  configuredStripeMode,
} from "../../_lib/stripe-mode";
import {
  applyStripeObjectEvent,
  applySubscriptionEvent,
  type StripeEventObject,
} from "../../_lib/stripe-events";
import { getCheckoutSubscription } from "../../_lib/subscriber";
import {
  claimWebhookEvent,
  markWebhookEvent,
} from "../../_lib/webhook-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    assertWebhookSecretConfigured(webhookSecret);
    configuredStripeMode();
  } catch (error) {
    console.error("STRIPE_WEBHOOK_CONFIG_ERROR", error);
    return NextResponse.json(
      { received: false, error: "Webhook is not configured." },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (!verifyStripeSignature(rawBody, signature, webhookSecret || "")) {
    return NextResponse.json(
      { received: false, error: "Invalid Stripe signature." },
      { status: 400 }
    );
  }

  let event: {
    id?: string;
    type?: string;
    created?: number;
    livemode?: boolean;
    data?: { object?: StripeEventObject };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { received: false, error: "Invalid webhook body." },
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

  try {
    assertLivemodeMatchesSecret(event.livemode, "webhook event");
  } catch (error) {
    return NextResponse.json(
      {
        received: false,
        error: error instanceof Error ? error.message : "Stripe mode mismatch.",
      },
      { status: 400 }
    );
  }

  await ensureDatabaseSchema();

  try {
    const result = await withDbTransaction(async () => {
      const claim = await claimWebhookEvent({
        provider: "stripe",
        eventId: event.id!,
        eventType: event.type,
        shop: object.metadata?.shop || object.client_reference_id,
        providerCreated: typeof event.created === "number" ? event.created : undefined,
      });

      if (claim === "duplicate") {
        return { duplicate: true as const };
      }

      const eventCreated = typeof event.created === "number" ? event.created : 0;

      try {
        if (
          event.type === "checkout.session.completed" &&
          (!object.subscription || typeof object.subscription === "string")
        ) {
          const shop = normalizeShop(
            object.client_reference_id || object.metadata?.shop || ""
          );
          if (!shop) {
            throw new Error("Stripe checkout is not linked to a Shopify store.");
          }
          if (!object.id) throw new Error("Stripe checkout event has no session ID.");
          const checkout = await getCheckoutSubscription(object.id);
          await applySubscriptionEvent({
            shop: checkout.shop,
            object: {
              id: checkout.subscription.subscriptionId,
              customer: checkout.subscription.customerId,
              status: checkout.subscription.status,
              current_period_start: checkout.subscription.currentPeriodStart,
              current_period_end: checkout.subscription.currentPeriodEnd,
              livemode: event.livemode,
            },
            eventCreated,
            livemode: event.livemode,
          });
        } else {
          await applyStripeObjectEvent({
            type: event.type!,
            object,
            eventCreated,
            livemode: event.livemode === true,
          });
        }

        await markWebhookEvent("stripe", event.id!, "processed");
        return { duplicate: false as const };
      } catch (error) {
        await markWebhookEvent("stripe", event.id!, "failed");
        throw error;
      }
    });

    if (result.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (error) {
    console.error("STRIPE_WEBHOOK_PROCESS_ERROR", error);
    return NextResponse.json(
      { received: false, error: "Webhook processing failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
