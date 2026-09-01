import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  NextResponse,
} from "next/server";
import { database, ensureDatabaseSchema } from "../../_lib/database";
import { normalizeShop } from "../../_lib/shopify-auth";
import {
  getCheckoutSubscription,
  saveShopSubscription,
  saveStripeSubscriptionPayload,
} from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNATURE_TOLERANCE_SECONDS = 300;

function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  const parts =
    signatureHeader.split(",");

  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] =
      part.split("=", 2);

    if (key === "t" && value) {
      timestamp = value;
    }

    if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (
    !timestamp ||
    signatures.length === 0
  ) {
    return false;
  }

  const timestampNumber =
    Number(timestamp);

  if (
    !Number.isFinite(timestampNumber)
  ) {
    return false;
  }

  const currentTime =
    Math.floor(Date.now() / 1000);

  if (
    Math.abs(
      currentTime - timestampNumber
    ) >
    SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const expectedSignature =
    createHmac(
      "sha256",
      webhookSecret
    )
      .update(
        `${timestamp}.${rawBody}`
      )
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  return signatures.some(
    (signature) => {
      const receivedBuffer =
        Buffer.from(
          signature,
          "utf8"
        );

      if (
        receivedBuffer.length !==
        expectedBuffer.length
      ) {
        return false;
      }

      return timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      );
    }
  );
}

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
