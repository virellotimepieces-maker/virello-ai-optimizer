import { NextRequest, NextResponse } from "next/server";
import {
  clearLegacyCookies,
  ensureAppSessionCookie,
} from "../../_lib/app-session";
import { getAppUrl } from "../../_lib/app-url";
import { getActiveSubscriberStatus } from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const subscriber = await getActiveSubscriberStatus(request);
    let appUrl = "";
    try {
      appUrl = getAppUrl(request.nextUrl.origin);
    } catch {
      appUrl = request.nextUrl.origin;
    }
    const response = NextResponse.json(
      {
        success: true,
        active: subscriber.active,
        canManage: subscriber.canManage,
        shopInstalled: subscriber.shopInstalled,
        customerId: subscriber.customerId,
        subscriptionId: subscriber.subscriptionId,
        status: subscriber.status,
        shop: subscriber.shop,
        usage: subscriber.usage ?? null,
        reason: subscriber.reason ?? null,
        appUrl,
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
        customerId: null,
        subscriptionId: null,
        status: null,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
