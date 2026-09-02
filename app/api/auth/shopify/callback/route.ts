import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../../_lib/app-url";
import {
  applySessionCookie,
  issueAppSession,
  readSessionId,
} from "../../../_lib/app-session";
import {
  getSessionBinding,
  rehomeUninstalledBilling,
} from "../../../_lib/shop-binding";
import { saveShopifySession } from "../../../_lib/shopify-auth";
import { billingForShop } from "../../../_lib/stripe-billing";
import {
  getShopifyClientId,
  getShopifyClientSecrets,
} from "../../../_lib/shopify-config";
import { normalizeShop } from "../../../_lib/shop-domain";
import {
  parseSignedOAuthState,
  verifyShopifyCallbackHmac,
} from "../../../_lib/shopify-security";
import { shopifyAdminAppUrl, shopifyCallbackUrl } from "../../../_lib/shopify-oauth";
import { hasRequiredShopifyScopes } from "../../../_lib/shopify-scopes";

function redirectError(origin: string, message: string) {
  console.error("SHOPIFY_OAUTH_CALLBACK_REJECTED", { message });
  const url = new URL("/connect", origin);
  url.searchParams.set("status", "error");
  url.searchParams.set("error_description", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const returnOrigin = getAppUrl();

  try {
    const params = request.nextUrl.searchParams;
    const code = params.get("code") || "";
    const shop = normalizeShop(params.get("shop") || "");
    const state = params.get("state") || "";
    const oauthError = params.get("error") || "";
    const oauthErrorDescription = params.get("error_description") || "";

    const apiKey = getShopifyClientId();
    const secrets = getShopifyClientSecrets();
    if (!apiKey || secrets.length === 0) {
      return redirectError(returnOrigin, "Shopify credentials are not configured.");
    }

    const suppliedHmac = params.get("hmac") || "";
    if (!suppliedHmac) {
      console.error("SHOPIFY_OAUTH_CALLBACK_REJECTED", {
        message: "Shopify authorization was cancelled or did not complete.",
        paramKeys: [...params.keys()].sort(),
        hasCode: Boolean(code),
        hasShop: Boolean(shop),
        hasState: Boolean(state),
        hasError: Boolean(oauthError),
      });
      return redirectError(
        returnOrigin,
        "Shopify authorization was cancelled or did not complete. The store is still disconnected."
      );
    }

    const verifiedSecret = secrets.find((secret) =>
      verifyShopifyCallbackHmac(request, secret)
    );
    if (!verifiedSecret) {
      console.error("SHOPIFY_OAUTH_CALLBACK_REJECTED", {
        message: "Shopify authorization signature is invalid.",
        paramKeys: [...params.keys()].sort(),
        hasCode: Boolean(code),
        hasShop: Boolean(shop),
        hasState: Boolean(state),
        hasError: Boolean(oauthError),
      });
      return redirectError(returnOrigin, "Shopify authorization signature is invalid.");
    }

    if (oauthError) {
      return redirectError(
        returnOrigin,
        oauthErrorDescription || oauthError
      );
    }

    if (!code || !shop || !state) {
      return redirectError(returnOrigin, "Shopify authorization response is incomplete.");
    }

    const signed = secrets
      .map((secret) => parseSignedOAuthState(state, shop, secret))
      .find(Boolean);
    if (!signed) {
      return redirectError(
        returnOrigin,
        "Invalid Shopify OAuth state. Please start the connection again."
      );
    }

    const binding = await getSessionBinding(request);
    if (binding?.installedShop && binding.installedShop !== shop) {
      return redirectError(
        returnOrigin,
        "This Virello session is already linked to a different Shopify store. Use Change Store to disconnect it first."
      );
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: apiKey,
        client_secret: verifiedSecret,
        code,
      }).toString(),
      cache: "no-store",
    });

    const data = (await tokenResponse.json().catch(() => null)) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    } | null;

    if (!tokenResponse.ok || !data?.access_token) {
      return redirectError(
        returnOrigin,
        data?.error_description || data?.error || "Shopify authorization failed."
      );
    }

    if (!hasRequiredShopifyScopes(data.scope || "")) {
      return redirectError(
        returnOrigin,
        "Virello needs read_products and write_products. Reinstall and approve those scopes."
      );
    }

    if (binding?.sessionShop && binding.sessionShop !== shop && !binding.installedShop) {
      await rehomeUninstalledBilling(binding.sessionShop, shop);
    }

    await saveShopifySession(shop, data.access_token, data.scope || "");
    const billing = await billingForShop(shop);
    const sessionId = await issueAppSession({
      shop,
      stripeCustomerId: billing?.customerId || binding?.stripeCustomerId || null,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const redirectUrl =
      signed.flow === "embedded"
        ? shopifyAdminAppUrl(shop, { connected: "1" })
        : new URL("/?connected=1", returnOrigin);
    if (signed.flow !== "embedded") {
      redirectUrl.searchParams.set("shop", shop);
    }

    const expectedCallback = shopifyCallbackUrl(returnOrigin);
    if (!request.nextUrl.pathname.endsWith("/api/auth/shopify/callback")) {
      return redirectError(returnOrigin, "Unexpected Shopify callback path.");
    }
    void expectedCallback;

    const response = NextResponse.redirect(redirectUrl);
    applySessionCookie(response, sessionId, request);
    response.cookies.delete("virello_shopify_oauth_state");
    response.cookies.delete("virello_shopify_oauth_shop");
    response.cookies.delete("virello_return_origin");
    response.cookies.delete("virello_shopify_access_token");
    response.cookies.delete("virello_shopify_shop");
    response.cookies.delete("virello_subscriber");
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error) {
    console.error("SHOPIFY_CALLBACK_ERROR:", error);
    return redirectError(
      returnOrigin,
      error instanceof Error ? error.message : "Unable to complete Shopify connection."
    );
  }
}
