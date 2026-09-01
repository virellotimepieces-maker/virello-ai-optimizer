import { NextRequest, NextResponse } from "next/server";
import { decryptShopifyToken, SHOPIFY_TOKEN_COOKIE } from "../api/_lib/shopify-session";

function cleanShopDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(/\/.*$/, "")
    .replace(
      /(\.myshopify\.com){2,}$/,
      ".myshopify.com"
    );
}

function isValidShopDomain(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/i.test(
    value
  );
}

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(
      request.cookies.get(
        "virello_shopify_shop"
      )?.value || ""
    );

    const accessToken = decryptShopifyToken(
      request.cookies.get(SHOPIFY_TOKEN_COOKIE)?.value || ""
    );

    if (
      !shop ||
      !isValidShopDomain(shop) ||
      !accessToken
    ) {
      return NextResponse.json(
        {
          success: false,
          connected: false,
          platform: "shopify",
          error:
            "Shopify connection is missing. Please connect your store again.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

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
        error:
          "Unable to verify Shopify connection. Please reconnect the store.",
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
