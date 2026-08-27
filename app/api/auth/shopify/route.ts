import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/(\.myshopify\.com){2,}$/, ".myshopify.com");
}

function isValidShopDomain(shop: string) {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
    shop
  );
}

function createOAuthState(shop: string, apiSecret: string) {
  const payload = {
    shop,
    nonce: randomBytes(16).toString("hex"),
    timestamp: Date.now(),
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const signature = createHmac(
    "sha256",
    apiSecret
  )
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
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
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey) {
      console.error(
        "SHOPIFY_API_KEY is missing."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "SHOPIFY_API_KEY is missing in Vercel Environment Variables.",
        },
        { status: 500 }
      );
    }

    if (!apiSecret) {
      console.error(
        "SHOPIFY_API_SECRET is missing."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "SHOPIFY_API_SECRET is missing in Vercel Environment Variables.",
        },
        { status: 500 }
      );
    }

    const redirectUri =
      process.env.SHOPIFY_REDIRECT_URI ||
      "https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback";

    const scopes =
      process.env.SHOPIFY_SCOPES ||
      "read_products,write_products";

    const state = createOAuthState(
      shop,
      apiSecret
    );

    const params = new URLSearchParams();

    params.set("client_id", apiKey);
    params.set("scope", scopes);
    params.set("redirect_uri", redirectUri);
    params.set("state", state);

    const authorizationUrl =
      `https://${shop}/admin/oauth/authorize?` +
      params.toString();

    console.log(
      "SHOPIFY_OAUTH_START",
      {
        shop,
        redirectUri,
        scopes,
      }
    );

    return NextResponse.redirect(
      authorizationUrl
    );
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
