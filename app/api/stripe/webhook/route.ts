import {
  NextResponse,
} from "next/server";
import { database, ensureDatabaseSchema } from "../../_lib/database";
import { normalizeShop } from "../../_lib/shopify-auth";
import { verifyStripeSignature } from "../../_lib/stripe-signature";
import {
  getCheckoutSubscription,
  saveShopSubscription,
  saveStripeSubscriptionPayload,
} from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request
) {
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(
      "STRIPE_WEBHOOK_SECRET is missing."
    );

    return NextResponse.json(
      {
        received: false,
        error:
          "Webhook is not configured.",
      },
      {
        status: 500,
      }
    );
  }

  const rawBody =
    await request.text();

  const signature =
    request.headers.get(
      "stripe-signature"
    ) || "";

  if (
    !verifyStripeSignature(
      rawBody,
      signature,
      webhookSecret
    )
  ) {
    return NextResponse.json(
      {
        received: false,
        error:
          "Invalid Stripe signature.",
      },
      {
        status: 400,
      }
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
        error:
          "Invalid webhook body.",
      },
      {
        status: 400,
      }
    );
  }

  const object =
    event.data?.object;

  if (!event.id || !event.type || !object) {
    return NextResponse.json({ received: false, error: "Incomplete Stripe event." }, { status: 400 });
  }

  const sql = database();
  await ensureDatabaseSchema();
  const duplicate = await sql`
    SELECT event_id FROM stripe_webhook_events WHERE event_id = ${event.id} LIMIT 1
  `;
  if (duplicate.length) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed":
      if (!object.id) throw new Error("Stripe checkout event has no session ID.");
      const checkout = await getCheckoutSubscription(object.id);
      await saveShopSubscription(checkout.shop, checkout.subscription);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      const shop = normalizeShop(object.metadata?.shop || "");
      if (!shop) throw new Error("Stripe subscription is not linked to a Shopify store.");
      await saveStripeSubscriptionPayload(shop, object);
      break;

    default:
      console.log(
        "STRIPE_EVENT_IGNORED",
        {
          eventId: event.id,
          type: event.type,
        }
      );
  }

  await sql`
    INSERT INTO stripe_webhook_events (event_id)
    VALUES (${event.id})
    ON CONFLICT (event_id) DO NOTHING
  `;

  return NextResponse.json(
    {
      received: true,
    },
    {
      status: 200,
    }
  );
}
