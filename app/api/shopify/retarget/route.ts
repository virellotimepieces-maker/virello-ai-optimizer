import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import {
  getSessionBinding,
  retargetUninstalledShop,
  setPendingShop,
  ShopBindingError,
} from "../../_lib/shop-binding";
import { normalizeShop } from "../../_lib/shop-domain";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../../_lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const binding = await getSessionBinding(request);
    if (!binding) {
      return NextResponse.json(
        { success: false, error: "Active subscriber could not be verified." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await request.json().catch(() => null)) as { shop?: unknown } | null;
    const shop = normalizeShop(typeof body?.shop === "string" ? body.shop : "");
    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Invalid Shopify store domain. Use your .myshopify.com domain." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (binding.installedShop && binding.installedShop !== shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This Virello session is already linked to a different Shopify store. Use Change Store to disconnect it first.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    await assertRateLimit(tenantRateKey(request, "retarget", shop), 15);
    const billedShop = await retargetUninstalledShop(
      binding.sessionShop,
      shop,
      binding.stripeCustomerId
    );
    await setPendingShop(binding.sessionId, shop);

    return NextResponse.json(
      {
        success: true,
        shop: billedShop,
        billedShop,
        pendingShop: shop,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("SHOPIFY_RETARGET_ERROR:", error);
    const status =
      error instanceof OriginGuardError ||
      error instanceof RateLimitError ||
      error instanceof ShopBindingError
        ? error.status
        : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to move billing to this Shopify store.",
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
