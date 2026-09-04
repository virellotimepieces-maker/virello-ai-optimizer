import { NextRequest, NextResponse } from "next/server";
import { OriginGuardError, assertSafeMutation } from "../../_lib/origin-guard";
import { ProductAccessError, requirePaidProductAccess } from "../../_lib/product-access";
import {
  mintShopifyAccessToken,
  ShopifyAuthError,
  shopifyAuthErrorHeaders,
} from "../../_lib/shopify-auth";
import {
  ShopifyRateLimitError,
  ShopifyTokenExpiredError,
} from "../../_lib/shopify-admin";
import {
  importProductPage,
  parseSaveProductInput,
  saveReviewedProduct,
  ShopifyProductError,
} from "../../_lib/shopify-products";
import { assertRateLimit, RateLimitError, tenantRateKey } from "../../_lib/rate-limit";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: status === 401 ? shopifyAuthErrorHeaders() : { "Cache-Control": "no-store" },
    }
  );
}

function statusFor(error: unknown): number {
  if (
    error instanceof OriginGuardError ||
    error instanceof ProductAccessError ||
    error instanceof ShopifyAuthError ||
    error instanceof ShopifyProductError ||
    error instanceof ShopifyRateLimitError ||
    error instanceof ShopifyTokenExpiredError ||
    error instanceof RateLimitError
  ) {
    return error.status;
  }
  return 500;
}

async function recoverExpiredToken(
  request: NextRequest,
  shop: string,
  previousToken: string
): Promise<string> {
  const fresh = await mintShopifyAccessToken(request, shop);
  if (!fresh || fresh === previousToken) {
    throw new ShopifyTokenExpiredError();
  }
  return fresh;
}

export async function GET(request: NextRequest) {
  try {
    const { shop, accessToken } = await requirePaidProductAccess(request);
    await assertRateLimit(tenantRateKey(request, "import", shop), 30);
    const cursor = request.nextUrl.searchParams.get("cursor") || "";
    let token = accessToken;
    try {
      const page = await importProductPage(shop, token, cursor);
      return NextResponse.json(
        {
          success: true,
          connected: true,
          platform: "shopify",
          shop: page.shop,
          count: page.products.length,
          products: page.products,
          pageInfo: page.pageInfo,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      if (!(error instanceof ShopifyTokenExpiredError)) throw error;
      token = await recoverExpiredToken(request, shop, token);
      const page = await importProductPage(shop, token, cursor);
      return NextResponse.json(
        {
          success: true,
          connected: true,
          platform: "shopify",
          shop: page.shop,
          count: page.products.length,
          products: page.products,
          pageInfo: page.pageInfo,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (error) {
    const status = statusFor(error);
    if (status >= 500) console.error("SHOPIFY_IMPORT_ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to import Shopify products.",
      status
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutation(request);
    const { shop, accessToken } = await requirePaidProductAccess(request);
    await assertRateLimit(tenantRateKey(request, "save", shop), 20);
    const body = await request.json().catch(() => null);
    const input = parseSaveProductInput(body);
    let token = accessToken;
    try {
      const product = await saveReviewedProduct(shop, token, input);
      return NextResponse.json(
        {
          success: true,
          message: "Product saved to Shopify successfully.",
          product,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      if (!(error instanceof ShopifyTokenExpiredError)) throw error;
      token = await recoverExpiredToken(request, shop, token);
      const product = await saveReviewedProduct(shop, token, input);
      return NextResponse.json(
        {
          success: true,
          message: "Product saved to Shopify successfully.",
          product,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (error) {
    const status = statusFor(error);
    if (status >= 500) console.error("SHOPIFY_SAVE_PRODUCT_ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to save product to Shopify.",
      status
    );
  }
}
