import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com\.myshopify\.com$/, ".myshopify.com");
}

function createOAuthState(shop: string, secret: string) {
  const payload = JSON.stringify({
    shop,
    nonce: randomBytes(32).toString("hex"),
    timestamp: Date.now(),
  });

  const encodedPayload = Buffer.from(payload).toString("base64url");

  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export async function GET(request: NextRequest) {
  try {
    const shop = cleanShopDomain(
      request.nextUrl.searchParams.get("shop") || ""
    );

    if (!shop || !shop.endsWith(".myshopify.com")) {
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

    const state = createOAuthState(shop, apiSecret);

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

    return NextResponse.redirect(authorizationUrl);
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
