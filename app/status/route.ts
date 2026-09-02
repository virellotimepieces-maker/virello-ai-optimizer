import { NextRequest, NextResponse } from "next/server";
import { authenticateShopifyRequest, ShopifyAuthError } from "../api/_lib/shopify-auth";

export async function GET(request: NextRequest) {
  try {
    const { shop } = await authenticateShopifyRequest(request);

    return NextResponse.json(
      {
        success: true,
        connected: true,
        platform: "shopify",
        shop,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const expectedDisconnected = error instanceof ShopifyAuthError && error.status === 401;
    if (!expectedDisconnected) {
      console.error("SHOPIFY_STATUS_ERROR:", error);
    }

    return NextResponse.json(
      {
        success: false,
        connected: false,
        platform: "shopify",
          error: error instanceof Error
            ? error.message
            : "Unable to verify Shopify connection.",
      },
      {
        status: expectedDisconnected ? 200 : 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
