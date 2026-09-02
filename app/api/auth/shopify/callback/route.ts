import {
  NextRequest,
  NextResponse,
} from "next/server";
import { getAppUrl } from "../../../_lib/app-url";
import {
  applySessionCookie,
  issueAppSession,
  readSessionId,
} from "../../../_lib/app-session";
import { isAllowedRedirectUrl } from "../../../_lib/origin-guard";
import { saveShopifySession } from "../../../_lib/shopify-auth";
import {
  getShopifyClientId,
  getShopifyClientSecret,
  getShopifyClientSecrets,
} from "../../../_lib/shopify-config";
import { normalizeShop } from "../../../_lib/shop-domain";
import {
  verifyShopifyCallbackHmac,
  verifySignedOAuthState,
} from "../../../_lib/shopify-security";
import { revokeAppSessionsForShop } from "../../../_lib/shops";

function isValidShopDomain(shop: string) {
  return Boolean(normalizeShop(shop));
}

function getReturnOrigin(request: NextRequest) {
  const fallback = getAppUrl(request.nextUrl.origin);
  const savedOrigin =
    request.cookies.get("virello_return_origin")?.value || "";

  if (savedOrigin && isAllowedRedirectUrl(savedOrigin, fallback)) {
    return new URL(savedOrigin).origin;
  }

  return fallback;
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

    const shop = normalizeShop(params.get("shop") || "");

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
      savedState && savedState === state && normalizeShop(savedShop) === shop
    );
    const signedStateIsValid = getShopifyClientSecrets().some((secret) =>
      verifySignedOAuthState(state, shop, secret)
    );

    if (!cookieStateIsValid && !signedStateIsValid) {
      console.error("SHOPIFY_OAUTH_STATE_MISMATCH");
      return redirectError(
        returnOrigin,
        "Invalid Shopify OAuth state. Please start the connection again."
      );
    }

    const hmacSecrets = getShopifyClientSecrets();
    const verifiedSecret = hmacSecrets.find((secret) =>
      verifyShopifyCallbackHmac(request, secret)
    );
    if (!verifiedSecret) {
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
              // The same credential that verified Shopify's callback must be
              // used to redeem its authorization code. This matters during a
              // controlled secret rotation while both credentials are valid.
              client_secret: verifiedSecret,
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

    await saveShopifySession(shop, data.access_token, data.scope || "");
    await revokeAppSessionsForShop(shop);
    const sessionId = await issueAppSession({
      shop,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
    const appHandle =
      process.env.SHOPIFY_APP_HANDLE?.trim() || "virello-ai-optimizer";
    const redirectUrl = new URL(
      `/store/${encodeURIComponent(storeHandle)}/apps/${encodeURIComponent(appHandle)}`,
      "https://admin.shopify.com"
    );
    redirectUrl.searchParams.set("shop", shop);
    redirectUrl.searchParams.set("connected", "1");

    const response = NextResponse.redirect(redirectUrl);
    applySessionCookie(response, sessionId, request);

    response.cookies.delete("virello_shopify_oauth_state");
    response.cookies.delete("virello_shopify_oauth_shop");
    response.cookies.delete("virello_return_origin");
    response.cookies.delete("virello_shopify_access_token");
    response.cookies.delete("virello_shopify_shop");
    response.cookies.delete("virello_subscriber");

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
