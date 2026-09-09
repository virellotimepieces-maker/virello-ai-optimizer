import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../_lib/app-url";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { authenticateShopifyRequest, ShopifyAuthError } from "../../_lib/shopify-auth";
import { isShopifyInstallationActive } from "../../_lib/shops";
import {
  createShopifyAppSubscription,
  ShopifyBillingError,
} from "../../_lib/shopify-billing";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../../_lib/rate-limit";
import { publicErrorMessage } from "../../_lib/public-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const { shop, accessToken } = await authenticateShopifyRequest(request, true);
    await assertRateLimit(tenantRateKey(request, "billing", shop), 15);
    if (!(await isShopifyInstallationActive(shop))) {
      return NextResponse.json(
        {
          success: false,
          error: "Open Virello from Shopify Admin and finish connecting the store first.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    const body = (await request.json().catch(() => null)) as { flow?: string } | null;
    const embedded =
      body?.flow === "embedded" ||
      request.nextUrl.searchParams.get("embedded") === "1" ||
      Boolean(request.nextUrl.searchParams.get("host"));
    const returnUrl = `${getAppUrl()}/api/billing/return?shop=${encodeURIComponent(shop)}${
      embedded ? "&embedded=1" : ""
    }`;
    const created = await createShopifyAppSubscription({ shop, accessToken, returnUrl });
    return NextResponse.json(
      {
        success: true,
        url: created.confirmationUrl,
        shop,
        test: created.test,
        status: created.billing.status,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("SHOPIFY_BILLING_SUBSCRIBE_ERROR:", error);
    const status =
      error instanceof OriginGuardError ||
      error instanceof RateLimitError ||
      error instanceof ShopifyAuthError ||
      error instanceof ShopifyBillingError
        ? error.status
        : 500;
    return NextResponse.json(
      {
        success: false,
        error: publicErrorMessage(error, "Unable to start Shopify billing."),
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
