import { NextRequest, NextResponse } from "next/server";
import {
  SHOPIFY_ACCESS_TOKEN_COOKIE,
  SHOPIFY_OAUTH_NONCE_COOKIE,
  SHOPIFY_SHOP_COOKIE,
  cleanShopDomain,
  getShopifyRedirectUri,
  isValidShopDomain,
  verifyOAuthHmac,
  verifyOAuthState,
} from "../../../_lib/shopify";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const code = params.get("code") || "";
    const shop = cleanShopDomain(params.get("shop") || "");
    const state = params.get("state") || "";

    if (!code || !shop || !state) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify authorization response is incomplete.",
        },
        { status: 400 }
      );
    }

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

    if (!verifyOAuthHmac(params, apiSecret)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Shopify OAuth HMAC.",
        },
        { status: 400 }
      );
    }

    const cookieNonce =
      request.cookies.get(SHOPIFY_OAUTH_NONCE_COOKIE)
        ?.value || "";

    if (!cookieNonce) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify OAuth state could not be verified.",
        },
        { status: 400 }
      );
    }

    const stateData = verifyOAuthState(
      state,
      apiSecret,
      cookieNonce
    );

    if (!stateData || stateData.shop !== shop) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired Shopify OAuth state.",
        },
        { status: 400 }
      );
    }

    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
          redirect_uri: getShopifyRedirectUri(),
        }).toString(),
        cache: "no-store",
      }
    );

    const responseText = await tokenResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(
        "SHOPIFY_TOKEN_RESPONSE:",
        responseText
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify returned an invalid authorization response.",
        },
        { status: 502 }
      );
    }

    if (!tokenResponse.ok || !data?.access_token) {
      console.error("SHOPIFY_TOKEN_ERROR:", data);

      return NextResponse.json(
        {
          success: false,
          error:
            data?.error_description ||
            data?.error ||
            "Shopify authorization failed.",
        },
        { status: 400 }
      );
    }

    const redirectUrl = new URL(
      "/connect",
      request.url
    );

    redirectUrl.searchParams.set("shop", shop);
    redirectUrl.searchParams.set("connected", "1");

    const result = NextResponse.redirect(redirectUrl);

    result.cookies.set(
      SHOPIFY_ACCESS_TOKEN_COOKIE,
      data.access_token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    result.cookies.set(SHOPIFY_SHOP_COOKIE, shop, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    result.cookies.set(
      SHOPIFY_OAUTH_NONCE_COOKIE,
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return result;
  } catch (error) {
    console.error("SHOPIFY_CALLBACK_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete Shopify connection.",
      },
      { status: 500 }
    );
  }
}
