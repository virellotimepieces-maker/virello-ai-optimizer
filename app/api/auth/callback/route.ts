import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com\.myshopify\.com$/, ".myshopify.com");
}

function verifyOAuthState(
  state: string,
  secret: string
): { shop: string } | null {
  try {
    const parts = state.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, receivedSignature] = parts;

    if (!encodedPayload || !receivedSignature) {
      return null;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(encodedPayload)
      .digest("base64url");

    const receivedBuffer = Buffer.from(
      receivedSignature,
      "utf8"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "utf8"
    );

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payloadText = Buffer.from(
      encodedPayload,
      "base64url"
    ).toString("utf8");

    const payload = JSON.parse(payloadText);

    if (
      !payload?.shop ||
      !payload?.nonce ||
      !payload?.timestamp
    ) {
      return null;
    }

    const age = Date.now() - Number(payload.timestamp);

    if (age < 0 || age > 10 * 60 * 1000) {
      return null;
    }

    const shop = cleanShopDomain(payload.shop);

    if (!shop.endsWith(".myshopify.com")) {
      return null;
    }

    return { shop };
  } catch (error) {
    console.error(
      "SHOPIFY_OAUTH_STATE_VERIFY_ERROR:",
      error
    );

    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const code = params.get("code") || "";
    const shop = cleanShopDomain(
      params.get("shop") || ""
    );
    const state = params.get("state") || "";

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

    const verifiedState = verifyOAuthState(
      state,
      apiSecret
    );

    if (!verifiedState) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Shopify OAuth state.",
        },
        { status: 400 }
      );
    }

    if (verifiedState.shop !== shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify OAuth store does not match the original store.",
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

    if (
      !tokenResponse.ok ||
      !data?.access_token
    ) {
      console.error(
        "SHOPIFY_TOKEN_ERROR:",
        data
      );

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
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    result.cookies.set(
      "virello_shopify_shop",
      shop,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
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
