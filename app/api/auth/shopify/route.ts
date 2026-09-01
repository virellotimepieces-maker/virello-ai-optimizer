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

function getShopifyRedirectUri(request: NextRequest) {
  const configured =
    process.env.SHOPIFY_REDIRECT_URI?.trim();

  if (configured) {
    return configured;
  }

  return new URL(
    "/api/auth/shopify/callback",
    request.nextUrl.origin
  ).toString();
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

    const apiKey =
      process.env.SHOPIFY_API_KEY;

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

    const state =
      randomBytes(32).toString("hex");

    const redirectUri =
      getShopifyRedirectUri(request);

    const scopes =
      process.env.SHOPIFY_SCOPES ||
      "read_products,write_products";

    const params =
      new URLSearchParams({
        client_id: apiKey,
        scope: scopes,
        redirect_uri: redirectUri,
        state,
      });

    const authorizationUrl =
      `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    const response =
      NextResponse.redirect(
        authorizationUrl
      );

    /*
     * OAuth state
     */
    response.cookies.set(
      "virello_shopify_oauth_state",
      state,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 600,
      }
    );

    /*
     * Store used to start OAuth
     */
    response.cookies.set(
      "virello_shopify_oauth_shop",
      shop,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 600,
      }
    );

    /*
     * Remember the Virello origin that
     * started the connection.
     *
     * This lets the callback return to
     * the same production domain.
     */
    response.cookies.set(
      "virello_return_origin",
      request.nextUrl.origin,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 600,
      }
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    console.log(
      "SHOPIFY_OAUTH_START",
      {
        shop,
        redirectUri,
        scopes,
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
