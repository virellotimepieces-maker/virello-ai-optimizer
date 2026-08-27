import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/(\.myshopify\.com){2,}$/, ".myshopify.com");
}

function createOAuthState(shop: string, apiSecret: string) {
  const payload = {
    shop,
    timestamp: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signature = createHmac("sha256", apiSecret).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function resolveAppOrigin(request: NextRequest) {
  const configuredUrl =
    process.env.SHOPIFY_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL;

  if (configuredUrl) {
    const normalizedUrl = /^https?:\/\//i.test(configuredUrl)
      ? configuredUrl
      : `https://${configuredUrl}`;

    try {
      return new URL(normalizedUrl).origin;
    } catch {
      // Fall through to request origin.
    }
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(request.nextUrl.searchParams.get("shop") || "");

    if (
      !shop ||
      !/^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(shop)
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
          error: "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel.",
        },
        { status: 500 }
      );
    }

    const state = createOAuthState(shop, apiSecret);

    const redirectUri = new URL(
      "/api/auth/shopify/callback",
      resolveAppOrigin(request)
    ).toString();

    const scopes = process.env.SHOPIFY_SCOPES || "read_products,write_products";

    const params = new URLSearchParams();
    params.set("client_id", apiKey);
    params.set("scope", scopes);
    params.set("redirect_uri", redirectUri);
    params.set("state", state);

    const authorizationUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error("SHOPIFY_OAUTH_START_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to start Shopify authorization.",
      },
      { status: 500 }
    );
  }
}
