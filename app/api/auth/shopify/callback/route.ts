import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  encryptShopifyToken,
  SHOPIFY_TOKEN_COOKIE,
} from "../../../_lib/shopify-session";
import { saveShopifySession } from "../../../_lib/shopify-auth";
import { getShopifyClientId, getShopifyClientSecret } from "../../../_lib/shopify-config";

function hasValidShopifyHmac(request: NextRequest, secret: string): boolean {
  const supplied = request.nextUrl.searchParams.get("hmac") || "";
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;

  const message = [...request.nextUrl.searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = createHmac("sha256", secret).update(message).digest("hex");

  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}

function getShopFromSignedState(state: string, secret: string): string {
  try {
    const [payload, suppliedSignature, extra] = state.split(".");
    if (!payload || !suppliedSignature || extra) return "";
    const expectedSignature = createHmac("sha256", secret).update(payload).digest("base64url");
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return "";
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { shop?: string; timestamp?: number };
    if (!parsed.shop || !parsed.timestamp || Date.now() - parsed.timestamp > 10 * 60 * 1000) return "";
    return cleanShopDomain(parsed.shop);
  } catch {
    return "";
  }
}

function cleanShopDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .replace(
      /(\.myshopify\.com){2,}$/,
      ".myshopify.com"
    );
}

function isValidShopDomain(shop: string) {
  return /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
    shop
  );
}

function getReturnOrigin(request: NextRequest) {
  const savedOrigin =
    request.cookies.get(
      "virello_return_origin"
    )?.value || "";

  if (
    savedOrigin &&
    /^https?:\/\//i.test(savedOrigin)
  ) {
    return savedOrigin.replace(/\/+$/, "");
  }

  return request.nextUrl.origin;
}

function redirectError(
  origin: string,
  message: string
) {
  console.error("SHOPIFY_OAUTH_CALLBACK_REJECTED", { message });

  const url = new URL(
    "/connect",
    origin
  );

  url.searchParams.set(
    "status",
    "error"
  );

  url.searchParams.set(
    "error_description",
    message
  );

  return NextResponse.redirect(url);
}

export async function GET(
  request: NextRequest
) {
  const returnOrigin =
    getReturnOrigin(request);

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

    const savedState =
      request.cookies.get(
        "virello_shopify_oauth_state"
      )?.value || "";

    const savedShop =
      request.cookies.get(
        "virello_shopify_oauth_shop"
      )?.value || "";

    if (!code || !shop || !state) {
      return redirectError(
        returnOrigin,
        "Shopify authorization response is incomplete."
      );
    }

    if (!isValidShopDomain(shop)) {
      return redirectError(
        returnOrigin,
        "Invalid Shopify store domain."
      );
    }

    const apiKey = getShopifyClientId();
    const apiSecret = getShopifyClientSecret();

    if (!apiKey || !apiSecret) {
      return redirectError(
        returnOrigin,
        "SHOPIFY_API_KEY or SHOPIFY_API_SECRET is missing in Vercel Environment Variables."
      );
    }

    const cookieStateIsValid = Boolean(
      savedState && savedState === state && savedShop === shop
    );
    const signedStateIsValid =
      getShopFromSignedState(state, apiSecret) === shop;

    if (!cookieStateIsValid && !signedStateIsValid) {
      console.error("SHOPIFY_OAUTH_STATE_MISMATCH");
      return redirectError(
        returnOrigin,
        "Invalid Shopify OAuth state. Please start the connection again."
      );
    }

    if (!hasValidShopifyHmac(request, apiSecret)) {
      return redirectError(returnOrigin, "Shopify authorization signature is invalid.");
    }

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

    let data: {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

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

      return redirectError(
        returnOrigin,
        "Shopify returned an invalid authorization response."
      );
    }

    if (
      !tokenResponse.ok ||
      !data.access_token
    ) {
      console.error(
        "SHOPIFY_TOKEN_ERROR:",
        data
      );

      return redirectError(
        returnOrigin,
        data.error_description ||
          data.error ||
          "Shopify authorization failed."
      );
    }

    // The database is the durable source of truth. Cookies are kept only
    // as a standalone-browser compatibility path.
    await saveShopifySession(shop, data.access_token, data.scope || "");

    // Return to the embedded Shopify Admin app after OAuth. Returning to
    // the standalone Vercel page loses Shopify's App Bridge session on mobile.
    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
    const appHandle =
      process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
    const redirectUrl = new URL(
      `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
      "https://admin.shopify.com"
    );
    redirectUrl.searchParams.set("shop", shop);
    redirectUrl.searchParams.set("connected", "1");

    const response =
      NextResponse.redirect(
        redirectUrl
      );

    response.cookies.set(
      SHOPIFY_TOKEN_COOKIE,
      encryptShopifyToken(data.access_token),
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
      }
    );

    response.cookies.set(
      "virello_shopify_shop",
      shop,
      {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
      }
    );

    response.cookies.delete(
      "virello_shopify_oauth_state"
    );

    response.cookies.delete(
      "virello_shopify_oauth_shop"
    );

    response.cookies.delete(
      "virello_return_origin"
    );

    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    console.log(
      "SHOPIFY_OAUTH_SUCCESS",
      {
        shop,
        returnOrigin,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "SHOPIFY_CALLBACK_ERROR:",
      error
    );

    return redirectError(
      returnOrigin,
      error instanceof Error
        ? error.message
        : "Unable to complete Shopify connection."
    );
  }
}
