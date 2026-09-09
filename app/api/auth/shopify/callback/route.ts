import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "../../../_lib/app-url";
import {
  applySessionCookie,
  issueAppSession,
  readSessionId,
} from "../../../_lib/app-session";
import {
  getSessionBinding,
  retargetUninstalledShop,
} from "../../../_lib/shop-binding";
import {
  classifyShopifyTokenError,
  exchangeShopifyAuthorizationCode,
  saveShopifySession,
  type ShopifyCodeExchangeResult,
} from "../../../_lib/shopify-auth";
import {
  getShopifyAppCredentials,
  getShopifyClientId,
  getShopifyClientSecrets,
  classifyShopifySecretKind,
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
  },
  shop = ""
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
  const attempted = normalizeShop(shop);
  if (attempted) url.searchParams.set("shop", attempted);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const returnOrigin = getAppUrl();
  const callbackShop = normalizeShop(request.nextUrl.searchParams.get("shop") || "");
  const fail = (
    message: string,
    diag?: Parameters<typeof redirectError>[2]
  ) => redirectError(returnOrigin, message, diag, callbackShop);

  try {
    const params = request.nextUrl.searchParams;
    const code = params.get("code") || "";
    const shop = normalizeShop(params.get("shop") || "");
    const state = params.get("state") || "";
    const oauthError = params.get("error") || "";
    const oauthErrorDescription = params.get("error_description") || "";

    const apiKey = getShopifyClientId();
    const secrets = getShopifyClientSecrets();
    const apps = getShopifyAppCredentials();
    if (!apiKey || secrets.length === 0) {
      return fail("Shopify credentials are not configured.");
    }

    const suppliedHmac = params.get("hmac") || "";
    if (!suppliedHmac) {
      return fail(
        "Shopify authorization was cancelled or did not complete. The store is still disconnected.",
        shopifyCallbackHmacDiagnostics(request)
      );
    }

    let verifiedSecret = secrets.find((secret) =>
      verifyShopifyCallbackHmac(request, secret)
    );
    const hmacOk = Boolean(verifiedSecret);
    let exchanged: Extract<ShopifyCodeExchangeResult, { ok: true }> | null = null;
    let tokenDiag = "none";

    if (!verifiedSecret && code && shop) {
      for (const app of apps.length ? apps : secrets.map((secret) => ({ clientId: apiKey, secret }))) {
        const result = await exchangeShopifyAuthorizationCode({
          shop,
          apiKey: app.clientId,
          secret: app.secret,
          code,
        });
        if (result.ok) {
          exchanged = result;
          tokenDiag = "ok";
          break;
        }
        tokenDiag = classifyShopifyTokenError(result.error, result.errorCode);
      }
    }

    const signed = secrets
      .map((secret) => parseSignedOAuthState(state, shop, secret))
      .find(Boolean);
    const binding = await getSessionBinding(request);
    const pendingMatches = Boolean(shop && binding?.pendingShop === shop);
    const canRecoverHmac = Boolean(exchanged && (signed || pendingMatches));

    if (!hmacOk && !canRecoverHmac) {
      const secretKind = classifyShopifySecretKind(secrets[0], apiKey);
      const usedClientId = secrets.some((secret) =>
        shopifySecretLooksLikeClientId(secret, apiKey)
      );
      const hmacError = usedClientId
        ? "Shopify Client secret is not configured correctly."
        : "Shopify authorization signature is invalid.";
      return fail(hmacError, {
        ...shopifyCallbackHmacDiagnostics(request),
        secretCount: secrets.length,
        secretLengths: secrets.map((value) => value.length).sort((a, b) => a - b),
        secretKind,
        token: tokenDiag,
      });
    }

    if (!hmacOk && canRecoverHmac) {
      console.error("SHOPIFY_OAUTH_HMAC_RECOVERED", {
        shop,
        pendingMatches,
        signed: Boolean(signed),
        officialKeys: shopifyCallbackHmacDiagnostics(request).officialKeys,
      });
      verifiedSecret = apps[0]?.secret || secrets[0];
    }

    if (oauthError && !exchanged) {
      return fail(oauthErrorDescription || oauthError);
    }

    if (!code || !shop) {
      return fail("Shopify authorization response is incomplete.");
    }

    if (binding?.installedShop && binding.installedShop !== shop) {
      return fail(
        "This Virello session is already linked to a different Shopify store. Use Change Store to disconnect it first."
      );
    }

    if (!exchanged) {
      const pairs = apps.length ? apps : [{ clientId: apiKey, secret: verifiedSecret || secrets[0] }];
      let lastError = "Shopify authorization failed.";
      for (const app of pairs) {
        const result = await exchangeShopifyAuthorizationCode({
          shop,
          apiKey: app.clientId,
          secret: verifiedSecret || app.secret,
          code,
        });
        if (result.ok) {
          exchanged = result;
          break;
        }
        lastError = result.error || lastError;
      }
      if (!exchanged) {
        return fail(lastError);
      }
    }

    if (!hasRequiredShopifyScopes(exchanged.scope)) {
      return fail(
        "Virello needs read_products and write_products. Reinstall and approve those scopes."
      );
    }

    if (binding && !binding.installedShop) {
      await retargetUninstalledShop(binding.sessionShop, shop);
    }

    await saveShopifySession(shop, exchanged.accessToken, exchanged.scope, {
      refreshToken: exchanged.refreshToken,
      expiresIn: exchanged.expiresIn,
      refreshExpiresIn: exchanged.refreshExpiresIn,
    });
    const sessionId = await issueAppSession({
      shop,
      previousSessionId: readSessionId(request),
      revokeShopSessions: true,
    });

    const flow =
      signed?.flow === "embedded" ||
      params.get("embedded") === "1" ||
      Boolean(params.get("host"))
        ? "embedded"
        : "standalone";
    const redirectUrl =
      flow === "embedded"
        ? shopifyAdminAppUrl(shop, { connected: "1" })
        : new URL("/?connected=1", returnOrigin);
    if (flow !== "embedded") {
      redirectUrl.searchParams.set("shop", shop);
    }

    const expectedCallback = shopifyCallbackUrl(returnOrigin);
    if (!request.nextUrl.pathname.endsWith("/api/auth/shopify/callback")) {
      return fail("Unexpected Shopify callback path.");
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
    return fail("Unable to complete Shopify connection.");
  }
}
