import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(
      /\.myshopify\.com\.myshopify\.com$/,
      ".myshopify.com"
    );
}

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(
      request.nextUrl.searchParams.get("shop") || ""
    );

    if (
      !shop ||
      !/^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
        shop
      )
    ) {
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

    /*
     * OAuth state is stored in an HttpOnly cookie.
     * This matches the callback flow.
     */
    const state = randomBytes(32).toString("hex");

    const redirectUri =
      "https://virello-ai-optimizer.vercel.app/api/auth/callback";

    const scopes =
      process.env.SHOPIFY_SCOPES ||
      "read_products,write_products";

    const params = new URLSearchParams();

    params.set("client_id", apiKey);
    params.set("scope", scopes);
    params.set("redirect_uri", redirectUri);
    params.set("state", state);

    const authorizationUrl =
      `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    const response =
      NextResponse.redirect(authorizationUrl);

    response.cookies.set(
      "virello_shopify_oauth_state",
      state,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 10 * 60,
      }
    );

    response.cookies.set(
      "virello_shopify_oauth_shop",
      shop,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 10 * 60,
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
