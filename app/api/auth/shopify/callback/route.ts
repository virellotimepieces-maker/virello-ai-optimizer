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
import {
  classifyShopifyTokenError,
  exchangeShopifyAuthorizationCode,
  saveShopifySession,
} from "../../../_lib/shopify-auth";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectError(
  origin: string,
  message: string,
  diag?: ReturnType<typeof shopifyCallbackHmacDiagnostics> & {
    secretCount?: number;
    secretLengths?: number[];
    secretKind?: string;
    token?: string;
  }
) {
  console.error("SHOPIFY_OAUTH_CALLBACK_REJECTED", {
    message,
    ...(diag
      ? {
          paramKeys: diag.paramKeys,
          officialKeys: diag.officialKeys,
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
          token: diag.token,
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
        `inmsg=${(diag.officialKeys || []).join(",") || "none"}`,
        `hmac=${diag.hmacLength}${diag.hmacHex ? "hex" : ""}`,
        `secrets=${(diag.secretLengths || []).join(".")}`,
        `secret=${diag.secretKind || "n"}`,
        `host=${diag.hostKind}:${diag.hostLength}`,
        `state=${diag.stateLength}`,
        `code=${diag.codeLength}`,
        `msgs=${diag.messageCount}`,
        `invoke=${diag.hasInvokeQuery ? "1" : "0"}`,
        `token=${diag.token || "none"}`,
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

    let verifiedSecret = secrets.find((secret) =>
      verifyShopifyCallbackHmac(request, secret)
    );
    let exchanged:
      | { accessToken: string; scope: string }
      | null = null;
    let tokenDiag = "none";

    if (!verifiedSecret) {
      if (code && shop) {
        for (const secret of secrets) {
          const result = await exchangeShopifyAuthorizationCode({
            shop,
            apiKey,
            secret,
            code,
          });
          if (result.ok) {
            console.error("SHOPIFY_OAUTH_HMAC_RECOVERED", {
              shop,
              officialKeys: shopifyCallbackHmacDiagnostics(request).officialKeys,
            });
            verifiedSecret = secret;
            exchanged = { accessToken: result.accessToken, scope: result.scope };
            tokenDiag = "ok";
            break;
          }
          tokenDiag = classifyShopifyTokenError(result.error, result.errorCode);
        }
      }

      if (!verifiedSecret) {
        const secretKind = classifyShopifySecretKind(secrets[0], apiKey);
        const usedClientId = secrets.some((secret) =>
          shopifySecretLooksLikeClientId(secret, apiKey)
        );
        const hmacError =
          usedClientId
            ? "SHOPIFY_API_SECRET is the Client ID, not the Client secret. Paste the Client secret from Shopify Dev Dashboard → this app → Settings."
            : tokenDiag === "client"
              ? "SHOPIFY_API_SECRET does not match this Shopify app. Paste the Client secret from Dev Dashboard → virello-ai-optimizer → Settings."
              : "Shopify authorization signature is invalid.";
        return redirectError(returnOrigin, hmacError, {
          ...shopifyCallbackHmacDiagnostics(request),
          secretCount: secrets.length,
          secretLengths: secrets.map((value) => value.length).sort((a, b) => a - b),
          secretKind,
          token: tokenDiag,
        });
      }
    }

    if (oauthError && !exchanged) {
      return redirectError(
        returnOrigin,
        oauthErrorDescription || oauthError
      );
    }

    if (!code || !shop) {
      return redirectError(returnOrigin, "Shopify authorization response is incomplete.");
    }

    const signed = secrets
      .map((secret) => parseSignedOAuthState(state, shop, secret))
      .find(Boolean);
    if (!signed && !exchanged) {
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

    if (!exchanged) {
      const result = await exchangeShopifyAuthorizationCode({
        shop,
        apiKey,
        secret: verifiedSecret,
        code,
      });
      if (!result.ok) {
        return redirectError(
          returnOrigin,
          result.error || "Shopify authorization failed."
        );
      }
      exchanged = { accessToken: result.accessToken, scope: result.scope };
    }

    if (!hasRequiredShopifyScopes(exchanged.scope)) {
      return redirectError(
        returnOrigin,
        "Virello needs read_products and write_products. Reinstall and approve those scopes."
      );
    }

    if (binding?.sessionShop && binding.sessionShop !== shop && !binding.installedShop) {
      await rehomeUninstalledBilling(
        binding.sessionShop,
        shop,
        binding.stripeCustomerId
      );
    }

    await saveShopifySession(shop, exchanged.accessToken, exchanged.scope);
    const billing = await billingForShop(shop);
    const sessionId = await issueAppSession({
      shop,
      stripeCustomerId: billing?.customerId || binding?.stripeCustomerId || null,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const flow = signed?.flow === "embedded" ? "embedded" : "standalone";
    const redirectUrl =
      flow === "embedded"
        ? shopifyAdminAppUrl(shop, { connected: "1" })
        : new URL("/?connected=1", returnOrigin);
    if (flow !== "embedded") {
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
