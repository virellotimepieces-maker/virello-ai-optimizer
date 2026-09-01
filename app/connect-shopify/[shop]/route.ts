import { NextRequest, NextResponse } from "next/server";

function normalizeShop(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shop: string }> }
) {
  const { shop: rawShop } = await context.params;
  const shop = normalizeShop(decodeURIComponent(rawShop));

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    return NextResponse.redirect(new URL("/connect?error=invalid-shop", request.url));
  }

  return NextResponse.redirect(
    new URL(`/api/auth/shopify?shop=${encodeURIComponent(shop)}`, request.url)
  );
}
