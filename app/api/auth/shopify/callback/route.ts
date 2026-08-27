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
  apiSecret: string
) {
  try {
    const parts = state.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, receivedSignature] = parts;

    const expectedSignature = createHmac(
      "sha256",
      apiSecret
    )
      .update(encodedPayload)
      .digest("base64url");

    const receivedBuffer =
      Buffer.from(receivedSignature);

    const expectedBuffer =
      Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const payloadText =
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8");

    const payload =
      JSON.parse(payloadText);

    if (
      !payload ||
      typeof payload.shop !== "string" ||
      typeof payload.timestamp !== "number"
    ) {
      return null;
    }

    /*
     * State expires after 10 minutes.
     */
    const age =
      Date.now() - payload.timestamp;

    if (
      age < 0 ||
      age > 10 * 60 * 1000
    ) {
      return null;
    }

    return {
      shop: cleanShopDomain(payload.shop),
    };
  } catch {
    return null;
  }
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

    if (
      !/^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
        shop
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid Shopify store domain.",
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

    /*
     * Verify the signed OAuth state.
     * No browser cookie is required.
     */
    const stateData =
      verifyOAuthState(
        state,
        apiSecret
      );

    if (!stateData) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired Shopify OAuth state.",
        },
        { status: 400 }
      );
    }

    if (stateData.shop !== shop) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify OAuth store does not match the original store.",
        },
        { status: 400 }
      );
    }

    /*
     * Exchange Shopify authorization code
     * for an access token.
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

    /*
     * Send the user back to Virello.
     */
    const redirectUrl =
      new URL(
        "/connect",
        request.url
      );

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

    /*
     * Store the Shopify access token.
     *
     * IMPORTANT:
     * This remains HttpOnly so client-side
     * JavaScript cannot read the access token.
     */
    result.cookies.set(
      "virello_shopify_access_token",
      accessToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
      }
    );

    /*
     * Store the connected Shopify shop.
     *
     * IMPORTANT:
     * This cookie must be readable by the
     * connect page so the frontend can detect
     * the persisted connected state.
     */
    result.cookies.set(
      "virello_shopify_shop",
      shop,
      {
        httpOnly: false,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
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
