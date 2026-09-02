import { NextRequest, NextResponse } from "next/server";
import { normalizeShop } from "../../api/_lib/shop-domain";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shop: string }> }
) {
  const { shop: rawShop } = await context.params;
  const shop = normalizeShop(decodeURIComponent(rawShop));

  if (!shop) {
    return NextResponse.redirect(new URL("/connect?error=invalid-shop", request.url));
  }

  const target = new URL("/api/auth/shopify", request.url);
  target.searchParams.set("shop", shop);
  target.searchParams.set("flow", "standalone");
  return NextResponse.redirect(target);
}
