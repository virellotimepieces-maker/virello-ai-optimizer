"use client";

import { useEffect, useMemo, useState } from "react";
import { shopifyFetch } from "../shopify-fetch";
import { COPY } from "../i18n";
import type { AppLocale } from "../api/_lib/locales";

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
  const [subscriberActive, setSubscriberActive] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [shop, setShop] = useState("");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [error, setError] = useState("");

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
    if (oauthError) setError(oauthError);
    if (shopFromUrl) setShop(cleanShopDomain(shopFromUrl));

    async function bootstrap() {
      try {
        const [prefRes, statusRes] = await Promise.all([
          shopifyFetch("/api/preferences", { cache: "no-store" }),
          shopifyFetch("/api/subscriber/status", { cache: "no-store" }),
        ]);
        const pref = await prefRes.json().catch(() => null);
        const billing = await statusRes.json().catch(() => null);
        if (pref?.ui) setUi(pref.ui === "fil" ? "fil" : "en");
        if (pref?.output) setOutput(pref.output === "fil" ? "fil" : "en");
        setSubscriberActive(
          Boolean(billing?.success && (billing?.canManage === true || billing?.active === true))
        );
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
      if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(cleaned)) {
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
        window.location.assign(data.url);
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
      window.location.assign(data.url);
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
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }

  function connectShopify() {
    if (connecting) return;
    const cleanedShop = cleanShopDomain(shop);
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(cleanedShop)) {
      setError(copy.invalidShop);
      return;
    }
    setConnecting(true);
    setError("");
    window.open(
      `${window.location.origin}/api/auth/shopify?shop=${encodeURIComponent(cleanedShop)}&flow=standalone`,
      "_top"
    );
  }

  function continueToVirello() {
    const target = new URL("/", window.location.origin);
    if (shop) target.searchParams.set("shop", cleanShopDomain(shop));
    window.location.assign(target.toString());
  }

  const connected = status?.connected === true;

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
            <button
              type="button"
              className="subscribe-button"
              onClick={connectShopify}
              disabled={connecting}
            >
              {connecting ? copy.connecting : copy.connectShopify}
            </button>
          </article>
        </section>
      )}
    </main>
  );
}
