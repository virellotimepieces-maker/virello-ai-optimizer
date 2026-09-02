import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../../../_lib/origin-guard";
import {
  applySessionCookie,
  issueAppSession,
  readSessionId,
} from "../../../_lib/app-session";
import {
  getSessionBinding,
  rehomeUninstalledBilling,
} from "../../../_lib/shop-binding";
import {
  authenticateShopifyRequest,
  ShopifyAuthError,
} from "../../../_lib/shopify-auth";
import { billingForShop } from "../../../_lib/stripe-billing";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../../../_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const { shop } = await authenticateShopifyRequest(request, true);
    await assertRateLimit(tenantRateKey(request, "session", shop), 30);

    const binding = await getSessionBinding(request);
    if (binding?.installedShop && binding.installedShop !== shop) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          error:
            "This Virello session is already linked to a different Shopify store. Use Change Store to disconnect it first.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (binding?.sessionShop && binding.sessionShop !== shop && !binding.installedShop) {
      await rehomeUninstalledBilling(binding.sessionShop, shop);
    }

    const billing = await billingForShop(shop);
    const sessionId = await issueAppSession({
      shop,
      stripeCustomerId: billing?.customerId || binding?.stripeCustomerId || null,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const response = NextResponse.json(
      { success: true, connected: true, shop },
      { headers: { "Cache-Control": "no-store" } }
    );
    applySessionCookie(response, sessionId, request);
    return response;
  } catch (error) {
    const status =
      error instanceof OriginGuardError ||
      error instanceof RateLimitError ||
      error instanceof ShopifyAuthError
        ? error.status
        : 500;
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete Shopify Admin session.",
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
