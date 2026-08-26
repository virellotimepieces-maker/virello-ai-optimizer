import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com\.myshopify\.com$/, ".myshopify.com");
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

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SHOPIFY_API_KEY is missing in Vercel.",
        },
        { status: 500 }
      );
    }

    /*
     * Create a fresh OAuth state for this authorization attempt.
     */
    const state = randomBytes(32).toString("hex");

    /*
     * This URL MUST exactly match the redirect URL
     * configured in Shopify Dev Dashboard.
     */
    const redirectUri =
      "https://virello-ai-optimizer.vercel.app/api/auth/callback";

    const scopes =
      process.env.SHOPIFY_SCOPES ||
      "read_products,write_products";

    /*
     * Build Shopify authorization URL.
     */
    const params = new URLSearchParams();

    params.set("client_id", apiKey);
    params.set("scope", scopes);
    params.set("redirect_uri", redirectUri);
    params.set("state", state);

    const authorizationUrl =
      `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    /*
     * Redirect to Shopify.
     */
    const response =
      NextResponse.redirect(authorizationUrl);

    /*
     * IMPORTANT:
     * Save the exact state so the callback can verify it.
     */
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

    /*
     * Save the original Shopify store as well.
     */
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
