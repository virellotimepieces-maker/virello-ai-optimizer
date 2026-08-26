import { NextRequest, NextResponse } from "next/server";

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
    const params = request.nextUrl.searchParams;

    const code = params.get("code") || "";
    const shop = cleanShopDomain(params.get("shop") || "");
    const state = params.get("state") || "";

    const savedState =
      request.cookies.get(
        "virello_shopify_oauth_state"
      )?.value || "";

    const savedShop =
      request.cookies.get(
        "virello_shopify_oauth_shop"
      )?.value || "";

    if (!code || !shop || !state) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify authorization response is incomplete.",
          debug: {
            hasCode: Boolean(code),
            hasShop: Boolean(shop),
            hasState: Boolean(state),
          },
        },
        { status: 400 }
      );
    }

    if (!shop.endsWith(".myshopify.com")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Shopify store domain.",
        },
        { status: 400 }
      );
    }

    if (!savedState || savedState !== state) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Shopify OAuth state.",
        },
        { status: 400 }
      );
    }

    if (savedShop && savedShop !== shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify OAuth store does not match the original store.",
        },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.SHOPIFY_API_KEY;

    const apiSecret =
      process.env.SHOPIFY_API_SECRET;

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
        }).toString(),
        cache: "no-store",
      }
    );

    const responseText =
      await tokenResponse.text();

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify returned an invalid authorization response.",
        },
        { status: 502 }
      );
    }

    if (
      !tokenResponse.ok ||
      !data?.access_token
    ) {
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

    const accessToken =
      data.access_token;

    const redirectUrl =
      new URL("/connect", request.url);

    redirectUrl.searchParams.set(
      "shop",
      shop
    );

    redirectUrl.searchParams.set(
      "connected",
      "1"
    );

    const result =
      NextResponse.redirect(
        redirectUrl
      );

    result.cookies.set(
      "virello_shopify_access_token",
      accessToken,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    result.cookies.set(
      "virello_shopify_shop",
      shop,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    result.cookies.delete(
      "virello_shopify_oauth_state"
    );

    result.cookies.delete(
      "virello_shopify_oauth_shop"
    );

    return result;
  } catch (error) {
    console.error(
      "SHOPIFY_CALLBACK_ERROR:",
      error
    );

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
