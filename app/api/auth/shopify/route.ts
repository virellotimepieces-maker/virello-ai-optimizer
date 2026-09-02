import { NextRequest, NextResponse } from "next/server";
import { getShopifyClientId } from "../../_lib/shopify-config";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(/(\.myshopify\.com){2,}$/, ".myshopify.com");
}

function isValidShopDomain(shop: string) {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
    shop
  );
}

export async function GET(request: NextRequest) {
  try {
    const rawShop =
      request.nextUrl.searchParams.get("shop") || "";

    const shop = cleanShopDomain(rawShop);

    if (!shop || !isValidShopDomain(shop)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid Shopify store domain. Use your .myshopify.com domain.",
        },
        { status: 400 }
      );
    }

    const apiKey = getShopifyClientId();
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SHOPIFY_API_KEY is missing in Vercel Environment Variables.",
        },
        { status: 500 }
      );
    }

    // This app uses Shopify managed installation. Launch the installed Admin
    // app and let App Bridge issue an ID token; server APIs then exchange that
    // ID token for the durable offline access token. Starting the legacy
    // authorization-code flow here conflicts with managed installation and is
    // especially fragile in Shopify's partitioned mobile browser.
    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
    const appHandle =
      process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
    const authorizationUrl = new URL(
      `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
      "https://admin.shopify.com"
    );
    authorizationUrl.searchParams.set("shop", shop);

    const response =
      NextResponse.redirect(
        authorizationUrl
      );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    console.log(
      "SHOPIFY_ADMIN_LAUNCH",
      {
        shop,
        appHandle,
        origin: request.nextUrl.origin,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "SHOPIFY_OAUTH_START_ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Shopify authorization.",
      },
      { status: 500 }
    );
  }
}
