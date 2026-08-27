import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

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

    const apiKey = process.env.SHOPIFY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SHOPIFY_API_KEY is missing in Vercel Environment Variables.",
        },
        { status: 500 }
      );
    }

    const state = randomBytes(32).toString("hex");

    const redirectUri =
      process.env.SHOPIFY_REDIRECT_URI ||
      "https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback";

    const scopes =
      process.env.SHOPIFY_SCOPES ||
      "read_products,write_products";

    const params = new URLSearchParams({
      client_id: apiKey,
      scope: scopes,
      redirect_uri: redirectUri,
      state,
    });

    const authorizationUrl =
      `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    const response = NextResponse.redirect(
      authorizationUrl
    );

    response.cookies.set(
      "virello_shopify_oauth_state",
      state,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      }
    );

    response.cookies.set(
      "virello_shopify_oauth_shop",
      shop,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      }
    );

    console.log(
      "SHOPIFY_OAUTH_START",
      {
        shop,
        redirectUri,
        scopes,
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
