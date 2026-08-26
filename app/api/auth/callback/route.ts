import { NextRequest, NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "crypto";

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(
      /\.myshopify\.com\.myshopify\.com$/,
      ".myshopify.com"
    );
}

function verifyOAuthState(
  state: string,
  secret: string
) {
  try {
    const parts = state.split(".");

    if (parts.length !== 2) {
      console.error(
        "SHOPIFY_STATE_DIAGNOSTIC: invalid parts count",
        {
          stateLength: state.length,
          stateParts: parts.length,
        }
      );

      return null;
    }

    const [
      encodedPayload,
      receivedSignature,
    ] = parts;

    const expectedSignature =
      createHmac("sha256", secret)
        .update(encodedPayload)
        .digest("base64url");

    const receivedBuffer =
      Buffer.from(
        receivedSignature
      );

    const expectedBuffer =
      Buffer.from(
        expectedSignature
      );

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      console.error(
        "SHOPIFY_STATE_DIAGNOSTIC: signature length mismatch",
        {
          receivedSignatureLength:
            receivedBuffer.length,
          expectedSignatureLength:
            expectedBuffer.length,
        }
      );

      return null;
    }

    if (
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      console.error(
        "SHOPIFY_STATE_DIAGNOSTIC: signature mismatch"
      );

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
      typeof payload.nonce !== "string" ||
      typeof payload.timestamp !== "number"
    ) {
      console.error(
        "SHOPIFY_STATE_DIAGNOSTIC: invalid payload structure",
        {
          hasShop:
            typeof payload?.shop ===
            "string",
          hasNonce:
            typeof payload?.nonce ===
            "string",
          hasTimestamp:
            typeof payload?.timestamp ===
            "number",
        }
      );

      return null;
    }

    const stateAge =
      Date.now() - payload.timestamp;

    if (
      stateAge < 0 ||
      stateAge > 10 * 60 * 1000
    ) {
      console.error(
        "SHOPIFY_STATE_DIAGNOSTIC: state expired",
        {
          stateAge,
        }
      );

      return null;
    }

    return payload;
  } catch (error) {
    console.error(
      "SHOPIFY_STATE_VERIFY_ERROR:",
      error
    );

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

    /*
     * ================================================
     * TEMPORARY OAUTH DIAGNOSTIC
     *
     * IMPORTANT:
     * We intentionally DO NOT log the actual
     * authorization code, state, API secret,
     * or access token.
     * ================================================
     */

    console.log(
      "SHOPIFY_OAUTH_DIAGNOSTIC:",
      {
        hasCode:
          Boolean(code),

        hasShop:
          Boolean(shop),

        hasState:
          Boolean(state),

        shop,

        stateLength:
          state.length,

        stateParts:
          state.split(".").length,

        signatureLength:
          state.includes(".")
            ? state.split(".")[1]
                ?.length || 0
            : 0,
      }
    );

    /*
     * ================================================
     * 1. Validate Shopify response
     * ================================================
     */

    if (
      !code ||
      !shop ||
      !state
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify authorization response is incomplete.",
        },
        { status: 400 }
      );
    }

    /*
     * ================================================
     * 2. Validate Shopify shop domain
     * ================================================
     */

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

    /*
     * ================================================
     * 3. Shopify credentials
     * ================================================
     */

    const apiKey =
      process.env.SHOPIFY_API_KEY;

    const apiSecret =
      process.env.SHOPIFY_API_SECRET;

    if (
      !apiKey ||
      !apiSecret
    ) {
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
     * ================================================
     * 4. VERIFY SIGNED OAUTH STATE
     *
     * The Shopify OAuth start route creates:
     *
     * encodedPayload.signature
     *
     * using SHOPIFY_API_SECRET.
     *
     * This callback verifies that signature.
     * ================================================
     */

    const statePayload =
      verifyOAuthState(
        state,
        apiSecret
      );

    if (!statePayload) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid or expired Shopify OAuth state.",
        },
        { status: 400 }
      );
    }

    /*
     * ================================================
     * 5. Make sure state belongs to this shop
     * ================================================
     */

    const stateShop =
      cleanShopDomain(
        statePayload.shop
      );

    if (
      !stateShop ||
      stateShop !== shop
    ) {
      console.error(
        "SHOPIFY_STATE_DIAGNOSTIC: shop mismatch",
        {
          callbackShop: shop,
          stateShop,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Shopify OAuth store does not match the authorized store.",
        },
        { status: 400 }
      );
    }

    /*
     * ================================================
     * 6. Exchange authorization code for token
     * ================================================
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
              client_id:
                apiKey,

              client_secret:
                apiSecret,

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
        JSON.parse(
          responseText
        );
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

    /*
     * ================================================
     * 7. Check access token
     * ================================================
     */

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
     * ================================================
     * 8. Redirect to connected screen
     * ================================================
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
     * ================================================
     * 9. Store Shopify access token
     * ================================================
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
     * ================================================
     * 10. Store connected shop
     * ================================================
     */

    result.cookies.set(
      "virello_shopify_shop",
      shop,
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
     * ================================================
     * 11. Remove old OAuth cookies if they exist
     * ================================================
     */

    result.cookies.delete(
      "virello_shopify_oauth_state"
    );

    result.cookies.delete(
      "virello_shopify_oauth_shop"
    );

    /*
     * ================================================
     * 12. SUCCESS
     * ================================================
     */

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
