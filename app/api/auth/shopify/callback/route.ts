import {
  NextRequest,
  NextResponse,
} from "next/server";

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

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl.searchParams;

    const code =
      params.get("code") || "";

    const shop =
      cleanShopDomain(
        params.get("shop") || ""
      );

    const state =
      params.get("state") || "";

    const savedState =
      request.cookies.get(
        "virello_shopify_oauth_state"
      )?.value || "";

    const savedShop =
      request.cookies.get(
        "virello_shopify_oauth_shop"
      )?.value || "";

    /*
     * Check required OAuth values.
     */
    if (!code || !shop || !state) {
      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              "Shopify authorization response is incomplete."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    /*
     * Validate Shopify domain.
     */
    if (!isValidShopDomain(shop)) {
      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              "Invalid Shopify store domain."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    /*
     * Validate OAuth state.
     */
    if (
      !savedState ||
      savedState !== state
    ) {
      console.error(
        "SHOPIFY_OAUTH_STATE_MISMATCH"
      );

      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              "Invalid Shopify OAuth state. Please start the connection again."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    /*
     * Validate the store against
     * the store used to start OAuth.
     */
    if (
      !savedShop ||
      savedShop !== shop
    ) {
      console.error(
        "SHOPIFY_OAUTH_SHOP_MISMATCH",
        {
          savedShop,
          shop,
        }
      );

      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              "Shopify store does not match the original store."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    const apiKey =
      process.env.SHOPIFY_API_KEY;

    const apiSecret =
      process.env.SHOPIFY_API_SECRET;

    if (
      !apiKey ||
      !apiSecret
    ) {
      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel Environment Variables."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    /*
     * Exchange authorization code
     * for Shopify access token.
     */
    const tokenResponse =
      await fetch(
        `https://${shop}/admin/oauth/access_token`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            new URLSearchParams({
              client_id: apiKey,
              client_secret: apiSecret,
              code,
            }).toString(),
          cache: "no-store",
        }
      );

    const responseText =
      await tokenResponse.text();

    let data: any;

    try {
      data =
        JSON.parse(responseText);
    } catch {
      console.error(
        "SHOPIFY_TOKEN_RESPONSE:",
        responseText
      );

      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              "Shopify returned an invalid authorization response."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    /*
     * Check token response.
     */
    if (
      !tokenResponse.ok ||
      !data?.access_token
    ) {
      console.error(
        "SHOPIFY_TOKEN_ERROR:",
        data
      );

      return NextResponse.redirect(
        new URL(
          "/connect?status=error&error_description=" +
            encodeURIComponent(
              data?.error_description ||
                data?.error ||
                "Shopify authorization failed."
            ),
          "https://virello-ai-optimizer.vercel.app"
        )
      );
    }

    const accessToken =
      data.access_token;

    /*
     * Redirect back to Virello.
     */
    const redirectUrl =
      new URL(
        "/connect",
        "https://virello-ai-optimizer.vercel.app"
      );

    redirectUrl.searchParams.set(
      "shop",
      shop
    );

    redirectUrl.searchParams.set(
      "connected",
      "1"
    );

    const response =
      NextResponse.redirect(
        redirectUrl
      );

    /*
     * Store Shopify access token.
     */
    response.cookies.set(
      "virello_shopify_access_token",
      accessToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
      }
    );

    /*
     * Store connected shop.
     */
    response.cookies.set(
      "virello_shopify_shop",
      shop,
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
      }
    );

    /*
     * Remove temporary OAuth cookies.
     */
    response.cookies.delete(
      "virello_shopify_oauth_state"
    );

    response.cookies.delete(
      "virello_shopify_oauth_shop"
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    console.log(
      "SHOPIFY_OAUTH_SUCCESS",
      {
        shop,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "SHOPIFY_CALLBACK_ERROR:",
      error
    );

    return NextResponse.redirect(
      new URL(
        "/connect?status=error&error_description=" +
          encodeURIComponent(
            error instanceof Error
              ? error.message
              : "Unable to complete Shopify connection."
          ),
        "https://virello-ai-optimizer.vercel.app"
      )
    );
  }
}
