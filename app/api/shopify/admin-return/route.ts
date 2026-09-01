import { NextRequest, NextResponse } from "next/server";
import { getShopForSubscriberCookie } from "../../_lib/subscriber";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const shop = await getShopForSubscriberCookie(request);

  if (!shop) {
    return NextResponse.json(
      {
        success: false,
        url: null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const storeHandle = shop.replace(
    /\.myshopify\.com$/i,
    ""
  );
  const appHandle =
    process.env.SHOPIFY_APP_HANDLE?.trim() ||
    "virello-ai-optimizer";
  const url = new URL(
    `/store/${encodeURIComponent(
      storeHandle
    )}/apps/${encodeURIComponent(
      appHandle
    )}`,
    "https://admin.shopify.com"
  );
  url.searchParams.set("shop", shop);

  return NextResponse.json(
    {
      success: true,
      url: url.toString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
