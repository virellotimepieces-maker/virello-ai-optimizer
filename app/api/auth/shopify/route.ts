import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
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

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "SHOPIFY_API_KEY is missing in Vercel.",
      },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString("hex");

  const redirectUri = new URL(
    ""/api/auth/callback",
    request.url
  ).toString();

  const scopes =
    process.env.SHOPIFY_SCOPES ||
    "read_products,write_products";

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  const response = NextResponse.redirect(
    `https://${shop}/admin/oauth/authorize?${params.toString()}`
  );

  response.cookies.set(
    "virello_shopify_oauth_state",
    state,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    }
  );

  return response;
}
