import { NextRequest, NextResponse } from "next/server";
import {
  SHOPIFY_OAUTH_NONCE_COOKIE,
  cleanShopDomain,
  createOAuthState,
  getShopifyRedirectUri,
  isValidShopDomain,
} from "../../_lib/shopify";

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(
      request.nextUrl.searchParams.get("shop") || ""
    );

    if (!isValidShopDomain(shop)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Shopify store domain.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel.",
        },
        { status: 500 }
      );
    }

    const { state, nonce } = createOAuthState(
      shop,
      apiSecret
    );

    const redirectUri = getShopifyRedirectUri();

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
      SHOPIFY_OAUTH_NONCE_COOKIE,
      nonce,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error("SHOPIFY_OAUTH_START_ERROR:", error);

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
