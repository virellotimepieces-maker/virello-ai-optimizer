import { NextRequest, NextResponse } from "next/server";
import {
  clearLegacyCookies,
  ensureAppSessionCookie,
} from "../../_lib/app-session";
import { getAppUrl } from "../../_lib/app-url";
import { getActiveSubscriberStatus } from "../../_lib/subscriber";
import { configuredStripeMode } from "../../_lib/stripe-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentStripeMode(): "live" | "test" | null {
  try {
    return configuredStripeMode();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const subscriber = await getActiveSubscriberStatus(request);
    const stripeMode = currentStripeMode();
    let appUrl = "";
    try {
      appUrl = getAppUrl();
    } catch {
      appUrl = "";
    }
    const response = NextResponse.json(
      {
        success: true,
        active: subscriber.active,
        canManage: subscriber.canManage,
        shopInstalled: subscriber.shopInstalled,
        billedShop: subscriber.billedShop,
        pendingShop: subscriber.pendingShop,
        canReplaceShop: subscriber.canReplaceShop,
        customerId: subscriber.customerId,
        subscriptionId: subscriber.subscriptionId,
        status: subscriber.status,
        shop: subscriber.shop,
        usage: subscriber.usage ?? null,
        reason: subscriber.reason ?? null,
        appUrl,
        stripeMode,
        live: stripeMode === "live",
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    clearLegacyCookies(response);

    if (subscriber.shop) {
      await ensureAppSessionCookie({
        request,
        response,
        shop: subscriber.shop,
        stripeCustomerId: subscriber.customerId,
        rotate: false,
      });
    }

    return response;
  } catch (error) {
    console.error("SUBSCRIBER_STATUS_ROUTE_ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        active: false,
        canManage: false,
        shopInstalled: false,
        billedShop: null,
        pendingShop: null,
        canReplaceShop: true,
        customerId: null,
        subscriptionId: null,
        status: null,
        stripeMode: null,
        live: false,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
