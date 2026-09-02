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
  classifyShopifySecretKind,
  getShopifyClientId,
  getShopifyClientSecrets,
  shopifySecretLooksLikeClientId,
} from "../../../_lib/shopify-config";
import { normalizeShop } from "../../../_lib/shop-domain";
import {
  parseSignedOAuthState,
  shopifyCallbackHmacDiagnostics,
  verifyShopifyCallbackHmac,
} from "../../../_lib/shopify-security";
import { shopifyAdminAppUrl, shopifyCallbackUrl } from "../../../_lib/shopify-oauth";
import { hasRequiredShopifyScopes } from "../../../_lib/shopify-scopes";

function redirectError(
  origin: string,
  message: string,
  diag?: ReturnType<typeof shopifyCallbackHmacDiagnostics> & {
    secretCount?: number;
    secretLengths?: number[];
    secretKind?: string;
  }
) {
  console.error("SHOPIFY_OAUTH_CALLBACK_REJECTED", {
    message,
    ...(diag
      ? {
          paramKeys: diag.paramKeys,
          hasHost: diag.hasHost,
          hostKind: diag.hostKind,
          hostLength: diag.hostLength,
          stateLength: diag.stateLength,
          codeLength: diag.codeLength,
          hmacLength: diag.hmacLength,
          hmacHex: diag.hmacHex,
          secretCount: diag.secretCount,
          secretLengths: diag.secretLengths,
          secretKind: diag.secretKind,
          messageCount: diag.messageCount,
          hasInvokeQuery: diag.hasInvokeQuery,
        }
      : {}),
  });
  const url = new URL("/connect", origin);
  url.searchParams.set("status", "error");
  url.searchParams.set("error_description", message);
  if (diag) {
    url.searchParams.set(
      "oauth_diag",
      [
        `keys=${diag.paramKeys.join(",")}`,
        `hmac=${diag.hmacLength}${diag.hmacHex ? "hex" : ""}`,
        `secrets=${(diag.secretLengths || []).join(".")}`,
        `secret=${diag.secretKind || "n"}`,
        `host=${diag.hostKind}:${diag.hostLength}`,
        `state=${diag.stateLength}`,
        `code=${diag.codeLength}`,
        `msgs=${diag.messageCount}`,
        `invoke=${diag.hasInvokeQuery ? "1" : "0"}`,
      ].join("|")
    );
  }
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
      return redirectError(
        returnOrigin,
        "Shopify authorization was cancelled or did not complete. The store is still disconnected.",
        {
          ...shopifyCallbackHmacDiagnostics(request),
          secretCount: secrets.length,
          secretLengths: secrets.map((value) => value.length).sort((a, b) => a - b),
        }
      );
    }

    const verifiedSecret = secrets.find((secret) =>
      verifyShopifyCallbackHmac(request, secret)
    );
    if (!verifiedSecret) {
      const secretKind = classifyShopifySecretKind(secrets[0], apiKey);
      const usedClientId = secrets.some((secret) =>
        shopifySecretLooksLikeClientId(secret, apiKey)
      );
      return redirectError(
        returnOrigin,
        usedClientId
          ? "SHOPIFY_API_SECRET is the Client ID, not the Client secret. Paste the Client secret from Shopify Dev Dashboard → this app → Settings."
          : "Shopify authorization signature is invalid.",
        {
          ...shopifyCallbackHmacDiagnostics(request),
          secretCount: secrets.length,
          secretLengths: secrets.map((value) => value.length).sort((a, b) => a - b),
          secretKind,
        }
      );
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
