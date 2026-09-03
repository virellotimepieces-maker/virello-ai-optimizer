"use client";

import { useEffect, useMemo, useState } from "react";
import { shopifyFetch } from "../shopify-fetch";
import { COPY } from "../i18n";
import type { AppLocale } from "../api/_lib/locales";
import { normalizeShop, isShopifyAdminAuthorizeUrl, resolveStoreBindingDisplay, shopifyAdminAppHref } from "../api/_lib/shop-domain";
import { assignTopLevel, copyEmbedQuery, isShopifyAdminIframe } from "../shopify-embed";

type ConnectionStatus = {
  success?: boolean;
  connected?: boolean;
  platform?: string;
  shop?: string;
  error?: string;
};

export default function ConnectPage() {
  const [ui, setUi] = useState<AppLocale>("en");
  const [output, setOutput] = useState<AppLocale>("en");
  const copy = useMemo(() => COPY[ui], [ui]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [changingStore, setChangingStore] = useState(false);
  const [subscriberActive, setSubscriberActive] = useState(false);
  const [shopInstalled, setShopInstalled] = useState(false);
  const [pendingShop, setPendingShop] = useState("");
  const [billingShop, setBillingShop] = useState("");
  const [billedShop, setBilledShop] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [shop, setShop] = useState("");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [error, setError] = useState("");
  const [oauthDiag, setOauthDiag] = useState("");
  const [secretStatus, setSecretStatus] = useState<{
    configured?: boolean;
    clientId?: string;
    secretKind?: string;
    secretLength?: number;
    looksLikeClientId?: boolean;
    apiSecret?: boolean;
    previous?: boolean;
  } | null>(null);

  async function saveLocales(nextUi: AppLocale, nextOutput: AppLocale) {
    setUi(nextUi);
    setOutput(nextOutput);
    await shopifyFetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ui: nextUi, output: nextOutput }),
    }).catch(() => null);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopFromUrl = params.get("shop");
    const oauthError = params.get("error_description");
    const diag = params.get("oauth_diag");
    if (oauthError) setError(oauthError);
    if (diag) setOauthDiag(diag);
    if (shopFromUrl) setShop(cleanShopDomain(shopFromUrl));

    async function bootstrap() {
      try {
        const [prefRes, statusRes, secretRes] = await Promise.all([
          shopifyFetch("/api/preferences", { cache: "no-store" }),
          shopifyFetch("/api/subscriber/status", { cache: "no-store" }),
          shopifyFetch("/api/auth/shopify/secret-status", { cache: "no-store" }),
        ]);
        const pref = await prefRes.json().catch(() => null);
        const billing = await statusRes.json().catch(() => null);
        const secret = await secretRes.json().catch(() => null);
        if (secret?.success) setSecretStatus(secret);
        if (pref?.ui) setUi(pref.ui === "fil" ? "fil" : "en");
        if (pref?.output) setOutput(pref.output === "fil" ? "fil" : "en");
        setSubscriberActive(
          Boolean(billing?.success && (billing?.canManage === true || billing?.active === true))
        );
        const installed = Boolean(billing?.shopInstalled);
        const nextBillingShop = typeof billing?.shop === "string" ? billing.shop : "";
        const nextPending = typeof billing?.pendingShop === "string" ? billing.pendingShop : "";
        const nextBilled = typeof billing?.billedShop === "string" ? billing.billedShop : "";
        setShopInstalled(installed);
        setBillingShop(nextBillingShop);
        setPendingShop(nextPending);
        setBilledShop(nextBilled);
        if (!shopFromUrl) {
          const display = resolveStoreBindingDisplay({
            shopInstalled: installed,
            shop: nextBillingShop,
            pendingShop: nextPending,
          });
          if (!installed && nextPending) setShop(nextPending);
          else if (display.domain) setShop(display.domain);
          else if (!installed && nextBilled) setShop(nextBilled);
        }
      } catch {
        setSubscriberActive(false);
      }
      await checkShopifyConnection();
    }
    bootstrap();
  }, []);

  async function handleSubscription() {
    if (billingLoading) return;

    if (!subscriberActive) {
      const cleaned = cleanShopDomain(shop);
      if (!cleaned) {
        setError(copy.checkoutNeedShop);
        return;
      }
      setBillingLoading(true);
      setError("");
      try {
        const response = await shopifyFetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop: cleaned, flow: "standalone" }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.url) {
          throw new Error(data?.error || copy.paymentError);
        }
        assignTopLevel(data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.paymentError);
        setBillingLoading(false);
      }
      return;
    }

    setBillingLoading(true);
    setError("");
    try {
      const response = await shopifyFetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || copy.portalError);
      }
      assignTopLevel(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.portalError);
      setBillingLoading(false);
    }
  }

  async function checkShopifyConnection() {
    setLoading(true);
    try {
      const response = await shopifyFetch("/status", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.connected) {
        setStatus({ ...data, connected: true, platform: "shopify" });
        if (data.shop) setShop(data.shop);
        return;
      }
      setStatus({ connected: false, platform: "shopify" });
    } catch (err) {
      console.error("SHOPIFY_CONNECTION_STATUS_ERROR:", err);
      setStatus({ connected: false, platform: "shopify" });
    } finally {
      setLoading(false);
    }
  }

  function cleanShopDomain(value: string) {
    return normalizeShop(value);
  }

  async function connectShopify() {
    if (connecting) return;
    const cleanedShop = cleanShopDomain(shop);
    if (!cleanedShop) {
      setError(copy.invalidShop);
      return;
    }
    if (shopInstalled && billingShop && cleanedShop !== billingShop) {
      setError(copy.alreadyLinkedInstalled);
      return;
    }
    setShop(cleanedShop);
    setConnecting(true);
    setError("");
    try {
      const response = await shopifyFetch(
        `/api/auth/shopify?shop=${encodeURIComponent(cleanedShop)}&flow=standalone`,
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        setError(data?.error || copy.shopifyError);
        setConnecting(false);
        return;
      }
      if (!isShopifyAdminAuthorizeUrl(data.url)) {
        setError(data?.error || copy.invalidAuthorizeUrl);
        setConnecting(false);
        return;
      }
      assignTopLevel(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.shopifyError);
      setConnecting(false);
    }
  }

  async function changeStore() {
    if (changingStore) return;
    if (shopInstalled && !window.confirm(copy.changeStoreConfirm)) return;
    setChangingStore(true);
    setError("");
    try {
      const response = await shopifyFetch("/api/shopify/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        setError(data?.error || copy.shopifyError);
        return;
      }
      setShopInstalled(false);
      setPendingShop("");
      setStatus({ connected: false, platform: "shopify" });
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.shopifyError);
    } finally {
      setChangingStore(false);
    }
  }

  function openInShopifyAdmin() {
    const cleaned = cleanShopDomain(shop);
    if (!cleaned) {
      setError(copy.invalidShop);
      return;
    }
    const href = shopifyAdminAppHref(cleaned);
    if (!href) {
      setError(copy.invalidShop);
      return;
    }
    if (isShopifyAdminIframe()) return;
    assignTopLevel(href);
  }

  function continueToVirello() {
    const target = copyEmbedQuery(
      new URLSearchParams(window.location.search),
      new URL("/", window.location.origin)
    );
    if (shop) target.searchParams.set("shop", cleanShopDomain(shop));
    window.location.assign(target.toString());
  }

  const connected = status?.connected === true;
  const storeBinding = resolveStoreBindingDisplay({
    shopInstalled: connected || shopInstalled,
    shop: status?.shop || billingShop,
    pendingShop,
  });
  const showChangeStore = Boolean(
    subscriberActive || billingShop || pendingShop || shopInstalled || connected
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-small">{copy.brandSmall}</div>
          <div className="brand-name">{copy.brand}</div>
        </div>
        <div className="topbar-actions">
          <div className="lang-toggle" role="group" aria-label={copy.uiLanguage}>
            <button
              type="button"
              className={ui === "en" ? "lang-button active" : "lang-button"}
              onClick={() => saveLocales("en", output)}
            >
              EN
            </button>
            <button
              type="button"
              className={ui === "fil" ? "lang-button active" : "lang-button"}
              onClick={() => saveLocales("fil", output)}
            >
              FIL
            </button>
          </div>
          <button
            type="button"
            className="subscribe-button"
            onClick={handleSubscription}
            disabled={billingLoading}
          >
            {billingLoading ? copy.opening : subscriberActive ? copy.manage : copy.subscribe}
          </button>
        </div>
      </header>

      {error && <div className="error-bar">{error}</div>}
      {error &&
        /credentials are not configured|SHOPIFY_API_SECRET is missing/i.test(error) && (
          <div className="error-bar error-shopify">{copy.secretStatusMissing}</div>
        )}
      {error &&
        /signature is invalid|Client ID, not the Client secret|does not match this Shopify app/i.test(
          error
        ) && (
          <div className="error-bar error-shopify" data-testid="hmac-retry-help">
            {copy.hmacRetryNow}
          </div>
        )}
      {error && oauthDiag && (
        <div className="oauth-diag" data-testid="oauth-diag">
          <div className="oauth-diag-title">Signature check</div>
          {oauthDiag.split(/[|;]/).filter(Boolean).map((part) => (
            <div key={part} className="oauth-diag-row">
              {part}
            </div>
          ))}
        </div>
      )}
      {error && /unauthorized access/i.test(error) && (
        <div className="error-bar error-shopify">{copy.oauthUnauthorizedHelp}</div>
      )}
      {error &&
        /signature is invalid|Client ID, not the Client secret|does not match this Shopify app/i.test(
          error
        ) && <div className="error-bar error-shopify">{copy.oauthHmacHelp}</div>}
      {error && /already has a Stripe subscription/i.test(error) && (
        <div className="error-bar error-shopify" data-testid="already-billed-help">
          {copy.alreadyBilledHelp}
        </div>
      )}
      {error && /different Stripe customer/i.test(error) && (
        <div className="error-bar error-shopify" data-testid="different-customer-help">
          {copy.differentCustomerHelp}
        </div>
      )}
      {error &&
        /signature is invalid|Client ID, not the Client secret|does not match this Shopify app/i.test(
          error
        ) &&
        Boolean(cleanShopDomain(shop)) && (
          <div className="workspace" style={{ paddingTop: 0 }}>
            <button
              type="button"
              className="subscribe-button"
              data-testid="open-shopify-admin-top"
              onClick={openInShopifyAdmin}
              disabled={connecting || changingStore}
            >
              {copy.openInShopifyAdmin}
            </button>
          </div>
        )}

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>{copy.headline}</h1>
          <p>{copy.subhead}</p>
        </div>
      </section>

      {loading && (
        <section className="workspace">
          <article className="content-card">
            <p>{copy.checkingShopify}</p>
          </article>
        </section>
      )}

      {!loading && connected && (
        <section className="workspace">
          <div className="success-bar">{copy.connectedHeadline}</div>
          <article className="content-card">
            <h2>{copy.shopifyConnectedSuccessfully}</h2>
            <p>{copy.connectedBody}</p>
            <p>
              {copy.connectedStore}: <strong>{status?.shop || copy.connectShopify}</strong>
            </p>
            <button type="button" className="subscribe-button" onClick={continueToVirello}>
              {copy.continueToVirello}
            </button>
            {showChangeStore && (
              <button
                type="button"
                className="secondary-button"
                data-testid="change-store"
                onClick={changeStore}
                disabled={changingStore}
              >
                {changingStore ? copy.opening : copy.changeStore}
              </button>
            )}
          </article>
          <article className="content-card">
            <div className="eyebrow">{copy.whatsNext}</div>
            <h2>{copy.startOptimizing}</h2>
            <p>{copy.nextBody}</p>
            <div className="review-grid">
              <section>
                <strong>{copy.stepImport}</strong>
                <p>{copy.stepImportBody}</p>
              </section>
              <section>
                <strong>{copy.stepOptimize}</strong>
                <p>{copy.stepOptimizeBody}</p>
              </section>
              <section>
                <strong>{copy.stepReview}</strong>
                <p>{copy.stepReviewBody}</p>
              </section>
              <section>
                <strong>{copy.stepApply}</strong>
                <p>{copy.stepApplyBody}</p>
              </section>
            </div>
          </article>
        </section>
      )}

      {!loading && !connected && (
        <section className="workspace">
          <article className="content-card">
            <h2>{copy.connectHeadline}</h2>
            <p>{copy.connectSubhead}</p>
            {secretStatus && (
              <p data-testid="shopify-secret-status">
                {secretStatus.looksLikeClientId
                  ? copy.secretStatusWrong
                  : secretStatus.apiSecret
                    ? copy.secretStatusReady
                        .replace("{id}", secretStatus.clientId || "—")
                        .replace("{kind}", secretStatus.secretKind || "missing")
                        .replace("{length}", String(secretStatus.secretLength || 0))
                    : copy.secretStatusMissing}
              </p>
            )}
            <p data-testid="store-binding-status">
              {storeBinding.kind === "connected"
                ? `${copy.connected}: ${storeBinding.domain}`
                : storeBinding.kind === "pending"
                  ? `${copy.pendingStore}: ${storeBinding.domain}. ${copy.notConnected}`
                  : copy.notConnected}
            </p>
            {Boolean(billedShop) && (
              <p data-testid="billed-store">{copy.billedStore.replace("{shop}", billedShop)}</p>
            )}
            <label htmlFor="shop" className="input-label">
              {copy.shopDomainLabel}
            </label>
            <input
              id="shop"
              type="text"
              value={shop}
              onChange={(event) => {
                setShop(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") connectShopify();
              }}
              placeholder={copy.shopPlaceholder}
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              className="shop-input"
            />
            <p className="oauth-admin-help" data-testid="domain-hint">
              {copy.domainHint}
            </p>
            {Boolean(billedShop) &&
              Boolean(cleanShopDomain(shop)) &&
              cleanShopDomain(shop) !== billedShop && (
                <div className="error-bar error-shopify" data-testid="domain-mismatch">
                  {copy.domainMismatch.replace("{shop}", billedShop)}
                </div>
              )}
            <button
              type="button"
              className="subscribe-button"
              onClick={connectShopify}
              disabled={connecting || changingStore}
            >
              {connecting ? copy.connecting : copy.connectShopify}
            </button>
            {Boolean(cleanShopDomain(shop)) && (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  data-testid="open-shopify-admin"
                  onClick={openInShopifyAdmin}
                  disabled={connecting || changingStore}
                >
                  {copy.openInShopifyAdmin}
                </button>
                <p className="oauth-admin-help">{copy.openInShopifyAdminHelp}</p>
              </>
            )}
            {showChangeStore && (
              <button
                type="button"
                className="secondary-button"
                data-testid="change-store"
                onClick={changeStore}
                disabled={changingStore || connecting}
              >
                {changingStore ? copy.opening : copy.changeStore}
              </button>
            )}
          </article>
        </section>
      )}
    </main>
  );
}
