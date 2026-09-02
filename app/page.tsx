"use client";

import { useEffect, useMemo, useState } from "react";
import { shopifyFetch } from "./shopify-fetch";
import { COPY } from "./i18n";
import type { AppLocale } from "./api/_lib/locales";
import { normalizeShop } from "./api/_lib/shop-domain";

type Product = {
  id: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  price?: string;
  status?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
};

type Optimization = {
  title: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  conversionCopy: string;
};

type AnalyzePayload = {
  success?: boolean;
  error?: string;
  result?: {
    analysis?: { conversionCopy?: string; missingInformation?: string[] };
    optimization?: Optimization;
  };
  usage?: { used: number; limit: number; remaining: number };
};

function normalizeShopInput(value: string) {
  return normalizeShop(value);
}

export default function Home() {
  const [ui, setUi] = useState<AppLocale>("en");
  const [output, setOutput] = useState<AppLocale>("en");
  const copy = useMemo(() => COPY[ui], [ui]);

  const [canManage, setCanManage] = useState(false);
  const [productAccess, setProductAccess] = useState(false);
  const [shopInstalled, setShopInstalled] = useState(false);
  const [shop, setShop] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [checking, setChecking] = useState(true);

  const [shopInput, setShopInput] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<"" | "quota" | "payment" | "shopify" | "ai" | "validation">("");
  const [message, setMessage] = useState("");

  const selected = products.find((product) => product.id === selectedId) || null;

  function showError(kind: typeof errorKind, text: string) {
    setErrorKind(kind);
    setError(text);
  }

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
    const shopFromUrl = params.get("shop") || "";
    const embedded = params.get("embedded") === "1" || Boolean(params.get("host"));
    const checkout = params.get("checkout");
    if (
      embedded &&
      window.top === window.self &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/i.test(shopFromUrl)
    ) {
      const handle = shopFromUrl.toLowerCase().replace(/\.myshopify\.com$/i, "");
      const admin = new URL(`/store/${handle}/apps/virello-ai-optimizer`, "https://admin.shopify.com");
      admin.searchParams.set("shop", shopFromUrl.toLowerCase());
      if (checkout) admin.searchParams.set("checkout", checkout);
      window.location.replace(admin.toString());
      return;
    }

    if (params.get("connected") === "1") setMessage(copy.connected);
    if (shopFromUrl) setShopInput(normalizeShopInput(shopFromUrl));

    async function bootstrap() {
      try {
        const [prefRes, statusRes] = await Promise.all([
          shopifyFetch("/api/preferences", { cache: "no-store" }),
          shopifyFetch("/api/subscriber/status", { cache: "no-store" }),
        ]);
        const pref = await prefRes.json().catch(() => null);
        const status = await statusRes.json().catch(() => null);
        if (pref?.ui) setUi(pref.ui === "fil" ? "fil" : "en");
        if (pref?.output) setOutput(pref.output === "fil" ? "fil" : "en");
        setCanManage(Boolean(status?.canManage));
        setProductAccess(Boolean(status?.active));
        setShopInstalled(Boolean(status?.shopInstalled));
        setShop(typeof status?.shop === "string" ? status.shop : "");
        setUsage(status?.usage ?? null);
        if (typeof status?.appUrl === "string" && status.appUrl && window.location.origin !== status.appUrl) {
          setCanonicalUrl(status.appUrl);
        }
        if (checkout === "success" && status?.canManage) {
          setMessage(copy.subscriptionActivated);
        }
      } catch {
        setCanManage(false);
      } finally {
        setChecking(false);
      }
    }
    bootstrap();
  }, [copy.connected]);

  async function startCheckout() {
    if (checkoutLoading || canManage) return;
    const cleaned = normalizeShopInput(shopInput || shop);
    if (!cleaned) {
      showError("shopify", copy.checkoutNeedShop);
      return;
    }
    setCheckoutLoading(true);
    setError("");
    try {
      const response = await shopifyFetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: cleaned,
          flow: new URLSearchParams(window.location.search).get("embedded") === "1" ? "embedded" : "standalone",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        showError(response.status === 402 ? "payment" : "", data?.error || copy.paymentError);
        return;
      }
      window.location.assign(data.url);
    } catch {
      showError("payment", copy.paymentError);
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function openPortal() {
    if (!canManage || portalLoading) return;
    setPortalLoading(true);
    try {
      const response = await shopifyFetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error(data?.error || copy.paymentError);
      window.location.assign(data.url);
    } catch (err) {
      showError("payment", err instanceof Error ? err.message : copy.paymentError);
      setPortalLoading(false);
    }
  }

  async function connectShopify() {
    if (connecting) return;
    const cleaned = normalizeShopInput(shopInput || shop);
    if (!cleaned) {
      showError("shopify", copy.invalidShop);
      return;
    }
    setShopInput(cleaned);
    setConnecting(true);
    setError("");
    try {
      const response = await shopifyFetch(
        `/api/auth/shopify?shop=${encodeURIComponent(cleaned)}&flow=standalone`,
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      showError("shopify", err instanceof Error ? err.message : copy.shopifyError);
    } finally {
      setConnecting(false);
    }
  }

  async function importProducts(nextCursor = "") {
    setImporting(true);
    setError("");
    try {
      const url = nextCursor
        ? `/api/shopify/products?cursor=${encodeURIComponent(nextCursor)}`
        : "/api/shopify/products";
      const response = await shopifyFetch(url, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.status === 402) {
        showError("payment", data?.error || copy.paymentError);
        return;
      }
      if (response.status === 403 || response.status === 401) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      if (!response.ok || !data?.success) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      const incoming: Product[] = Array.isArray(data.products) ? data.products : [];
      setProducts((current) => (nextCursor ? [...current, ...incoming] : incoming));
      setHasNextPage(Boolean(data.pageInfo?.hasNextPage));
      setCursor(data.pageInfo?.endCursor || null);
      setShop(data.shop || shop);
      setShopInstalled(true);
      setMessage(
        incoming.length ? `${incoming.length} ${copy.productsLoaded}` : copy.emptyProducts
      );
    } catch (err) {
      showError("shopify", err instanceof Error ? err.message : copy.shopifyError);
    } finally {
      setImporting(false);
    }
  }

  async function optimizeSelected() {
    if (!selected) {
      showError("validation", copy.selectProduct);
      return;
    }
    setOptimizing(true);
    setApproved(false);
    setError("");
    try {
      const response = await shopifyFetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputLocale: output,
          product: {
            id: selected.id,
            title: selected.title,
            description: selected.description,
            productType: selected.productType,
            vendor: selected.vendor,
            tags: selected.tags,
            price: selected.price,
          },
        }),
      });
      const data = (await response.json().catch(() => null)) as AnalyzePayload | null;
      if (response.status === 429) {
        showError("quota", data?.error || copy.quotaError);
        return;
      }
      if (response.status === 402) {
        showError("payment", data?.error || copy.paymentError);
        return;
      }
      if (response.status === 403 || response.status === 401) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      if (!response.ok || !data?.result?.optimization) {
        showError("ai", data?.error || copy.aiError);
        return;
      }
      setOptimization(data.result.optimization);
      setMissing(data.result.analysis?.missingInformation || []);
      if (data.usage) setUsage(data.usage);
      setMessage(copy.reviewChanges);
    } catch {
      showError("ai", copy.aiError);
    } finally {
      setOptimizing(false);
    }
  }

  async function saveProduct() {
    if (!selected || !optimization) {
      showError("validation", copy.emptyReview);
      return;
    }
    if (!approved) {
      showError("validation", copy.approve);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await shopifyFetch("/api/shopify/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          title: optimization.title,
          description: optimization.description,
          tags: optimization.tags,
          seoTitle: optimization.seoTitle,
          seoDescription: optimization.metaDescription,
          confirmed: true,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        const kind = response.status === 402 ? "payment" : response.status === 403 ? "shopify" : "validation";
        showError(kind, data?.error || copy.validationError);
        return;
      }
      setMessage(copy.saved);
    } catch {
      showError("shopify", copy.shopifyError);
    } finally {
      setSaving(false);
    }
  }

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
          {canManage ? (
            <button type="button" className="subscribe-button" onClick={openPortal} disabled={checking || portalLoading}>
              {portalLoading ? copy.opening : copy.manage}
            </button>
          ) : (
            <button type="button" className="subscribe-button" onClick={startCheckout} disabled={checking || checkoutLoading}>
              {checking ? copy.checking : checkoutLoading ? copy.opening : copy.subscribe}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className={`error-bar error-${errorKind || "generic"}`}>
          {errorKind === "quota" ? copy.quotaError : error}
        </div>
      )}
      {canonicalUrl && (
        <div className="error-bar">
          {copy.wrongHost} <a href={canonicalUrl}>{canonicalUrl}</a>
        </div>
      )}
      {message && !error && <div className="success-bar">{message}</div>}

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>{copy.headline}</h1>
          <p>{copy.subhead}</p>
          <p className="hero-hint">{copy.standaloneHint}</p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid dashboard-grid">
          <article className="content-card">
            <h2>{copy.connectShopify}</h2>
            <p>{shopInstalled && shop ? `${copy.connected}: ${shop}` : copy.notConnected}</p>
            <input
              className="shop-input"
              value={shopInput}
              onChange={(event) => setShopInput(event.target.value)}
              placeholder={copy.shopPlaceholder}
            />
            <button type="button" className="subscribe-button" onClick={connectShopify} disabled={connecting}>
              {connecting ? copy.connecting : shopInstalled ? copy.reconnect : copy.connectShopify}
            </button>
          </article>

          <article className="content-card">
            <h2>{copy.outputLanguage}</h2>
            <div className="lang-toggle">
              <button type="button" className={output === "en" ? "lang-button active" : "lang-button"} onClick={() => saveLocales(ui, "en")}>
                EN
              </button>
              <button type="button" className={output === "fil" ? "lang-button active" : "lang-button"} onClick={() => saveLocales(ui, "fil")}>
                FIL
              </button>
            </div>
            <p>{copy.usage}: {usage ? `${usage.used} / ${usage.limit}` : "0 / 1000"}</p>
            <button type="button" className="subscribe-button" onClick={() => importProducts()} disabled={importing || !productAccess}>
              {importing ? copy.importing : copy.importProducts}
            </button>
            {hasNextPage && (
              <button type="button" className="secondary-button" onClick={() => importProducts(cursor || "")} disabled={importing}>
                {copy.loadMore}
              </button>
            )}
          </article>

          <article className="content-card">
            <h2>{copy.selectProduct}</h2>
            {products.length === 0 ? (
              <p className="empty-copy">{copy.emptyProducts}</p>
            ) : (
              <select
                className="shop-input"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setOptimization(null);
                  setApproved(false);
                }}
              >
                <option value="">{copy.selectProduct}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="subscribe-button" onClick={optimizeSelected} disabled={optimizing || !selected || !productAccess}>
              {optimizing ? copy.optimizing : copy.optimize}
            </button>
          </article>
        </div>

        <article className="content-card review-card">
          <h2>{copy.reviewChanges}</h2>
          {!selected || !optimization ? (
            <p className="empty-copy">{copy.emptyReview}</p>
          ) : (
            <>
              <div className="review-grid">
                <section>
                  <h3>{copy.original}</h3>
                  <p><strong>{selected.title}</strong></p>
                  <p>{selected.description || "—"}</p>
                </section>
                <section>
                  <h3>{copy.proposed}</h3>
                  <p><strong>{optimization.title}</strong></p>
                  <p>{optimization.description}</p>
                  <p>{optimization.seoTitle}</p>
                  <p>{optimization.metaDescription}</p>
                  <p>{optimization.tags.join(", ")}</p>
                  <p>{optimization.conversionCopy}</p>
                </section>
              </div>
              {missing.length > 0 && (
                <p className="empty-copy">{missing.join(" · ")}</p>
              )}
              <label className="approve-box">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(event) => setApproved(event.target.checked)}
                />
                {copy.approve}
              </label>
              <button type="button" className="subscribe-button" onClick={saveProduct} disabled={saving || !approved}>
                {saving ? copy.saving : copy.saveShopify}
              </button>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
