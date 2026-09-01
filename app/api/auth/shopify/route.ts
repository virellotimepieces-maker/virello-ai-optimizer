import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { getShopifyClientId, getShopifyClientSecret } from "../../_lib/shopify-config";

function createSignedOAuthState(shop: string, secret: string) {
  const payload = Buffer.from(
    JSON.stringify({ shop, nonce: randomBytes(24).toString("hex"), timestamp: Date.now() })
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

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

function getShopifyRedirectUri() {
  return "https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback";
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
    const apiSecret = getShopifyClientSecret();

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel Environment Variables.",
        },
        { status: 500 }
      );
    }

    // Signed state remains verifiable when mobile browsers partition OAuth cookies.
    const state = createSignedOAuthState(shop, apiSecret);

    const redirectUri =
      getShopifyRedirectUri();

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
