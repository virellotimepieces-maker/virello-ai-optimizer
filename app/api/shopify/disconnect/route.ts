import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import {
  clearPendingShop,
  getSessionBinding,
} from "../../_lib/shop-binding";
import { revokeShopifyInstallation } from "../../_lib/shops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const binding = await getSessionBinding(request);
    if (!binding) {
      return NextResponse.json(
        {
          success: false,
          error: "Active subscriber could not be verified.",
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      confirm?: unknown;
    } | null;
    const confirm = body?.confirm === true;

    if (binding.installedShop) {
      if (!confirm) {
        return NextResponse.json(
          {
            success: false,
            requiresConfirm: true,
            shop: binding.installedShop,
            shopInstalled: true,
            pendingShop: binding.pendingShop,
            canReplaceShop: false,
            error:
              "Confirm Change Store to disconnect the installed Shopify store. Stripe billing is kept.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      await revokeShopifyInstallation(binding.installedShop, {
        revokeAppSessions: false,
        exceptSessionId: binding.sessionId,
      });
    }

    await clearPendingShop(binding.sessionId);

    return NextResponse.json(
      {
        success: true,
        shop: binding.sessionShop,
        shopInstalled: false,
        pendingShop: null,
        canReplaceShop: true,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("SHOPIFY_DISCONNECT_ERROR:", error);
    const status = error instanceof OriginGuardError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to change the Shopify store.",
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
