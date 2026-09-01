import { NextRequest, NextResponse } from "next/server";
import { authenticateShopifyRequest } from "../app/api/_lib/shopify-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const candidate = error as {
      message?: unknown;
      status?: unknown;
    };

    const message =
      typeof candidate?.message === "string"
        ? candidate.message
        : "Unable to verify Shopify connection.";

    const status =
      typeof candidate?.status === "number"
        ? candidate.status
        : 401;

    console.error("SHOPIFY_STATUS_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        connected: false,
        platform: "shopify",
        error: message,
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
