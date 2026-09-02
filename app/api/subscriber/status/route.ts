import { NextRequest, NextResponse } from "next/server";
import { ensureAppSessionCookie } from "../../_lib/app-session";
import { getActiveSubscriberStatus } from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const subscriber = await getActiveSubscriberStatus(request);
    const response = NextResponse.json(
      {
        success: true,
        active: subscriber.active,
        customerId: subscriber.customerId,
        subscriptionId: subscriber.subscriptionId,
        status: subscriber.status,
      },
      { headers: { "Cache-Control": "no-store" } }
    );

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
        customerId: null,
        subscriptionId: null,
        status: null,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
