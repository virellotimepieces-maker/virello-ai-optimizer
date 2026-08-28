import { NextRequest, NextResponse } from "next/server";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(
      /(\.myshopify\.com){2,}$/,
      ".myshopify.com"
    );
}

function isValidShopDomain(shop: string) {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
    shop
  );
}

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(
      request.cookies.get(
        "virello_shopify_shop"
      )?.value || ""
    );

    const accessToken =
      request.cookies.get(
        "virello_shopify_access_token"
      )?.value || "";

    if (
      !shop ||
      !isValidShopDomain(shop) ||
      !accessToken
    ) {
      return NextResponse.json({
        success: true,
        connected: false,
        platform: "shopify",
      });
    }

    const response = await fetch(
      `https://${shop}/admin/api/2025-10/shop.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token":
            accessToken,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        success: true,
        connected: false,
        platform: "shopify",
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      platform: "shopify",
      shop,
    });
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
        error:
          "Unable to verify Shopify connection.",
      },
      { status: 500 }
    );
  }
}
