import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation, resolvedPortalReturnUrl } from "../../_lib/origin-guard";
import { getActiveSubscriberStatus } from "../../_lib/subscriber";
import {
  assertLivemodeMatchesSecret,
  configuredStripeMode,
} from "../../_lib/stripe-mode";

export const runtime = "nodejs";

function getStripeSecret(): string {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return secret;
}

async function stripeRequest(path: string, body?: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${getStripeSecret()}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe request failed.");
  }
  if (typeof data?.livemode === "boolean") {
    assertLivemodeMatchesSecret(data.livemode, path);
  }
  return data;
}

async function assertPortalConfigurationMode(): Promise<void> {
  const configs = await stripeRequest("billing_portal/configurations?active=true&limit=10");
  const items = Array.isArray(configs?.data) ? configs.data : [];
  for (const config of items) {
    if (typeof config?.livemode === "boolean") {
      assertLivemodeMatchesSecret(
        config.livemode,
        "Customer Portal configuration"
      );
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    configuredStripeMode();
    const status = await getActiveSubscriberStatus(request);

    if (!status?.canManage || !status?.customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Active subscriber could not be verified.",
        },
        { status: 401 }
      );
    }

    let requestedReturnUrl: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.return_url === "string") {
        requestedReturnUrl = body.return_url;
      }
    } catch {
      requestedReturnUrl = undefined;
    }

    const returnUrl = resolvedPortalReturnUrl(requestedReturnUrl);
    await assertPortalConfigurationMode();

    const body = new URLSearchParams();
    body.set("customer", status.customerId);
    body.set("return_url", returnUrl);

    const portal = await stripeRequest("billing_portal/sessions", body);
    if (typeof portal?.livemode === "boolean") {
      assertLivemodeMatchesSecret(portal.livemode, "Customer Portal session");
    }
    if (!portal?.url) {
      throw new Error("Stripe did not return a billing portal URL.");
    }

    return NextResponse.json({ success: true, url: portal.url });
  } catch (error) {
    console.error("STRIPE_PORTAL_ERROR:", error);
    const status = error instanceof OriginGuardError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to open subscription management.",
      },
      { status }
    );
  }
}
