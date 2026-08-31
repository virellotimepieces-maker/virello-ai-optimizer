import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  NextResponse,
} from "next/server";

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

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.paid":
    case "invoice.payment_failed":
      console.log(
        "STRIPE_SUBSCRIPTION_EVENT",
        {
          eventId: event.id,
          type: event.type,
          objectId: object?.id,
          customer: object?.customer,
          status: object?.status,
        }
      );
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

  return NextResponse.json(
    {
      received: true,
    },
    {
      status: 200,
    }
  );
}
