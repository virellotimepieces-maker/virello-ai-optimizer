import { NextRequest, NextResponse } from "next/server";
import { authenticateShopifyRequest } from "../api/_lib/shopify-auth";

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
    console.error(
      "SHOPIFY_STATUS_ERROR:",
      error
    );

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
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
