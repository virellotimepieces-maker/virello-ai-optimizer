"use client";

import { useEffect, useRef, useState } from "react";
import { shopifyFetch } from "./shopify-fetch";
import { COPY } from "./i18n";
import { normalizeShop, isAllowedShopifyConnectUrl, resolveStoreBindingDisplay } from "./api/_lib/shop-domain";
import { assignTopLevel, isShopifyAdminIframe } from "./shopify-embed";
import { buildShopifyDescriptionHtml, stripHtml } from "./api/_lib/listing-html";
import { scoreListing, scoreLimitExplanation, META_DESCRIPTION_MAX, SEO_TITLE_MAX, type ListingGrade } from "./api/_lib/listing-score";
import {
  BRAND_VOICES,
  DEFAULT_BRAND_VOICE,
  parseBrandVoice,
  type BrandVoice,
} from "./api/_lib/brand-voice";
import {
  MERCHANT_FACT_FIELDS,
  parseMerchantFacts,
  type MerchantFactField,
} from "./api/_lib/merchant-facts";

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
  handle?: string;
  options?: string[];
  variants?: string[];
};

type Optimization = {
  title: string;
  description: string;
  benefitBullets: string[];
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  keywords: string[];
  callToAction: string;
  conversionCopy: string;
};

type Analysis = {
  targetCustomer: string;
  purchaseMotivation: string;
  strongestFeatures: string[];
  weaknesses: string[];
  missingInformation: string[];
  objections: { objection: string; response: string }[];
  conversionOpportunities: string[];
  warnings: string[];
};

type AnalyzePayload = {
  success?: boolean;
  error?: string;
  result?: {
    analysis?: Analysis;
    optimization?: Optimization;
  };
  usage?: { used: number; limit: number; remaining: number };
};

function linesOf(values: string[]): string {
  return values.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeShopInput(value: string) {
  return normalizeShop(value);
}

function gradeCopy(copy: (typeof COPY)["en"], grade: ListingGrade) {
  if (grade === "excellent") return copy.gradeExcellent;
  if (grade === "strong") return copy.gradeStrong;
  if (grade === "good") return copy.gradeGood;
  return copy.gradeNeedsWork;
}

const EMPTY_MERCHANT_FACTS: Record<MerchantFactField, string> = {
  material: "",
  dimensions: "",
  movement: "",
  waterResistance: "",
  warranty: "",
  intendedUse: "",
};

const FACT_COPY_KEYS: Record<MerchantFactField, "factMaterial" | "factDimensions" | "factMovement" | "factWaterResistance" | "factWarranty" | "factIntendedUse"> = {
  material: "factMaterial",
  dimensions: "factDimensions",
  movement: "factMovement",
  waterResistance: "factWaterResistance",
  warranty: "factWarranty",
  intendedUse: "factIntendedUse",
};

const REVIEW_FIXTURE_PRODUCT: Product = {
  id: "gid://shopify/Product/e2e-review",
  title:
    "Pagani Design PD-1701 Stainless Steel Quartz Chronograph Watch With Sapphire Crystal And A Very Long Title For Mobile Wrapping",
  description: "Stainless steel case. Japanese quartz movement. Sapphire crystal.",
  productType: "Watch",
  vendor: "Pagani Design",
  price: "89.00",
  tags: ["watch", "chronograph"],
  handle: "pagani-design-pd-1701",
  options: ["Color: Silver"],
  variants: ["Silver · 89.00"],
};

const REVIEW_FIXTURE_OPTIMIZATION: Optimization = {
  title: REVIEW_FIXTURE_PRODUCT.title,
  description:
    "A Pagani Design PD-1701 chronograph with a stainless steel case, Japanese quartz movement, and sapphire crystal. Choose the listed facts on this product page.",
  benefitBullets: [
    "Stainless steel case",
    "Japanese quartz movement",
    "Sapphire crystal",
  ],
  seoTitle: "Pagani Design PD-1701 Quartz Chronograph",
  metaDescription:
    "Pagani Design PD-1701 stainless steel quartz chronograph with sapphire crystal. Review the listed specs before you choose this watch.",
  tags: ["watch", "chronograph", "pagani", "quartz"],
  keywords: ["pagani design watch", "quartz chronograph", "sapphire crystal"],
  callToAction: "Choose this Pagani Design chronograph from the listed specs.",
  conversionCopy:
    "Lead with the stainless steel case, quartz movement, and sapphire crystal from the listing.",
};

const REVIEW_FIXTURE_ANALYSIS: Analysis = {
  targetCustomer: "Watch buyers who want a quartz chronograph",
  purchaseMotivation: "Stainless steel case and sapphire crystal for daily wear",
  strongestFeatures: [
    "Stainless steel case",
    "Japanese quartz movement",
    "Sapphire crystal",
  ],
  weaknesses: ["Water resistance is not listed"],
  missingInformation: ["Water resistance is not listed"],
  objections: [
    {
      objection: "Is it waterproof?",
      response: "Water resistance is not listed on this product.",
    },
  ],
  conversionOpportunities: ["Lead with sapphire crystal", "Name the quartz chronograph"],
  warnings: ["Missing product information: Water resistance is not listed"],
};

export default function Home({
  embeddedInstall = false,
  reviewFixture = false,
}: {
  embeddedInstall?: boolean;
  reviewFixture?: boolean;
}) {
  const copy = COPY.en;

  const [canManage, setCanManage] = useState(false);
  const [productAccess, setProductAccess] = useState(false);
  const [shopInstalled, setShopInstalled] = useState(false);
  const [pendingShop, setPendingShop] = useState("");
  const [billedShop, setBilledShop] = useState("");
  const [canReplaceShop, setCanReplaceShop] = useState(true);
  const [shop, setShop] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [checking, setChecking] = useState(!reviewFixture);

  const [shopInput, setShopInput] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [products, setProducts] = useState<Product[]>(
    reviewFixture ? [REVIEW_FIXTURE_PRODUCT] : []
  );
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedId, setSelectedId] = useState(reviewFixture ? REVIEW_FIXTURE_PRODUCT.id : "");
  const [optimization, setOptimization] = useState<Optimization | null>(
    reviewFixture ? REVIEW_FIXTURE_OPTIMIZATION : null
  );
  const [analysis, setAnalysis] = useState<Analysis | null>(
    reviewFixture ? REVIEW_FIXTURE_ANALYSIS : null
  );
  const [missing, setMissing] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [adminIframe, setAdminIframe] = useState(false);
  const [billingTest, setBillingTest] = useState(false);
  const [embeddedSessionReady, setEmbeddedSessionReady] = useState(!embeddedInstall);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [changingStore, setChangingStore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const optimizingLock = useRef(false);
  const [brandVoice, setBrandVoice] = useState<BrandVoice>(DEFAULT_BRAND_VOICE);
  const [merchantFacts, setMerchantFacts] = useState(EMPTY_MERCHANT_FACTS);

  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<"" | "quota" | "payment" | "shopify" | "ai" | "validation">("");
  const [message, setMessage] = useState("");

  const selected = products.find((product) => product.id === selectedId) || null;
  const storeBinding = resolveStoreBindingDisplay({
    shopInstalled,
    shop,
    pendingShop,
  });
  const showChangeStore = Boolean(canManage || shop || pendingShop || shopInstalled);
  const listingScores =
    selected && optimization && analysis
      ? scoreListing({
          sourceTitle: selected.title,
          title: optimization.title,
          description: optimization.description,
          benefitBullets: optimization.benefitBullets,
          seoTitle: optimization.seoTitle,
          metaDescription: optimization.metaDescription,
          tags: optimization.tags,
          callToAction: optimization.callToAction,
          conversionCopy: optimization.conversionCopy,
          conversionOpportunities: analysis.conversionOpportunities,
          objections: analysis.objections.length,
          targetCustomer: analysis.targetCustomer,
          missingInformation: analysis.missingInformation.length,
        })
      : null;

  function showError(kind: typeof errorKind, text: string) {
    setErrorKind(kind);
    setError(text);
  }

  function clearError() {
    setError("");
    setErrorKind("");
  }

  useEffect(() => {
    function onSession(event: Event) {
      const detail = (event as CustomEvent<{
        connected?: boolean;
        shop?: string;
        authenticating?: boolean;
      }>).detail;
      if (detail?.shop) {
        setShop(detail.shop);
        setShopInput(detail.shop);
      }
      if (detail?.connected) {
        setShopInstalled(true);
        setEmbeddedSessionReady(true);
        return;
      }
      if (embeddedInstall && !detail?.authenticating) {
        setEmbeddedSessionReady(true);
      }
    }
    window.addEventListener("virello-shopify-session", onSession);
    return () => window.removeEventListener("virello-shopify-session", onSession);
  }, [embeddedInstall]);

  useEffect(() => {
    setAdminIframe(isShopifyAdminIframe());
    const params = new URLSearchParams(window.location.search);
    const shopFromUrl = params.get("shop") || "";
    const checkout = params.get("checkout");
    if (params.get("connected") === "1") setMessage(copy.connected);
    if (shopFromUrl) setShopInput(normalizeShopInput(shopFromUrl));

    async function bootstrap() {
      try {
        const [statusRes] = await Promise.all([
          shopifyFetch("/api/subscriber/status", { cache: "no-store" }),
        ]);
        const status = await statusRes.json().catch(() => null);
        setCanManage(Boolean(status?.canManage));
        setBillingTest(Boolean(status?.billingTest));
        setProductAccess(Boolean(status?.active));
        setShopInstalled(Boolean(status?.shopInstalled));
        setPendingShop(typeof status?.pendingShop === "string" ? status.pendingShop : "");
        setBilledShop(typeof status?.billedShop === "string" ? status.billedShop : "");
        setCanReplaceShop(status?.canReplaceShop !== false);
        setShop(typeof status?.shop === "string" ? status.shop : "");
        setUsage(status?.usage ?? null);
        if (!shopFromUrl) {
          const display = resolveStoreBindingDisplay({
            shopInstalled: Boolean(status?.shopInstalled),
            shop: typeof status?.shop === "string" ? status.shop : "",
            pendingShop: typeof status?.pendingShop === "string" ? status.pendingShop : "",
          });
          if (display.domain) setShopInput(display.domain);
        }
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
      showError("shopify", embeddedInstall ? copy.shopifyError : copy.checkoutNeedShop);
      return;
    }
    setCheckoutLoading(true);
    clearError();
    try {
      const response = await shopifyFetch("/api/billing/subscribe", {
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
      assignTopLevel(data.url);
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
      const response = await shopifyFetch("/api/billing/manage", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error(data?.error || copy.portalError);
      assignTopLevel(data.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : copy.portalError;
      showError("payment", message);
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
    if (shopInstalled && shop && cleaned !== shop) {
      showError("shopify", copy.alreadyLinkedInstalled);
      return;
    }
    setShopInput(cleaned);
    setConnecting(true);
    clearError();
    try {
      if (billedShop && cleaned !== billedShop) {
        const moved = await shopifyFetch("/api/shopify/retarget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop: cleaned }),
        });
        const movedBody = await moved.json().catch(() => null);
        if (!moved.ok || !movedBody?.success) {
          showError("shopify", movedBody?.error || copy.shopifyError);
          return;
        }
        setBilledShop(cleaned);
        setPendingShop(cleaned);
        setShop(cleaned);
      }
      const oauthFlow = embeddedInstall || adminIframe ? "embedded" : "standalone";
      const response = await shopifyFetch(
        `/api/auth/shopify?shop=${encodeURIComponent(cleaned)}&flow=${oauthFlow}`,
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      if (!isAllowedShopifyConnectUrl(data.url)) {
        showError("shopify", data?.error || copy.invalidAuthorizeUrl);
        return;
      }
      assignTopLevel(data.url);
    } catch (err) {
      showError("shopify", err instanceof Error ? err.message : copy.shopifyError);
    } finally {
      setConnecting(false);
    }
  }

  async function useThisStore() {
    if (changingStore || connecting) return;
    const cleaned = normalizeShopInput(shopInput || shop);
    if (!cleaned) {
      showError("shopify", copy.invalidShop);
      return;
    }
    if (shopInstalled) {
      showError("shopify", copy.alreadyLinkedInstalled);
      return;
    }
    setChangingStore(true);
    clearError();
    try {
      const response = await shopifyFetch("/api/shopify/retarget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: cleaned }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      setShopInput(cleaned);
      setShop(cleaned);
      setBilledShop(typeof data.billedShop === "string" ? data.billedShop : cleaned);
      setPendingShop(typeof data.pendingShop === "string" ? data.pendingShop : cleaned);
      setMessage(copy.alreadyBilledHelp);
    } catch (err) {
      showError("shopify", err instanceof Error ? err.message : copy.shopifyError);
    } finally {
      setChangingStore(false);
    }
  }

  async function changeStore() {
    if (changingStore) return;
    if (shopInstalled && !window.confirm(copy.changeStoreConfirm)) return;
    setChangingStore(true);
    clearError();
    try {
      const response = await shopifyFetch("/api/shopify/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        showError("shopify", data?.error || copy.shopifyError);
        return;
      }
      setShopInstalled(false);
      setPendingShop("");
      setCanReplaceShop(true);
      setProductAccess(false);
      setMessage(copy.disconnectSuccess);
    } catch (err) {
      showError("shopify", err instanceof Error ? err.message : copy.shopifyError);
    } finally {
      setChangingStore(false);
    }
  }

  async function importProducts(nextCursor = "") {
    setImporting(true);
    clearError();
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
      clearError();
      if (!nextCursor && incoming.length === 1 && !data.pageInfo?.hasNextPage) {
        setMessage(copy.singleProductImported);
      } else {
        setMessage(
          incoming.length ? `${incoming.length} ${copy.productsLoaded}` : copy.emptyProducts
        );
      }
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
    if (optimizingLock.current) return;
    optimizingLock.current = true;
    const idempotencyKey =
      globalThis.crypto?.randomUUID?.() ||
      `opt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setOptimizing(true);
    setApproved(false);
    clearError();
    try {
      const response = await shopifyFetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          outputLocale: "en",
          idempotencyKey,
          brandVoice,
          merchantFacts: parseMerchantFacts(merchantFacts),
          product: {
            id: selected.id,
            title: selected.title,
            description: stripHtml(selected.description || ""),
            productType: selected.productType,
            vendor: selected.vendor,
            tags: selected.tags,
            price: selected.price,
            handle: selected.handle,
            options: selected.options,
            variants: selected.variants,
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
      setOptimization({
        title: data.result.optimization.title || "",
        description: data.result.optimization.description || "",
        benefitBullets: data.result.optimization.benefitBullets || [],
        seoTitle: data.result.optimization.seoTitle || "",
        metaDescription: data.result.optimization.metaDescription || "",
        tags: data.result.optimization.tags || [],
        keywords: data.result.optimization.keywords || [],
        callToAction: data.result.optimization.callToAction || "",
        conversionCopy: data.result.optimization.conversionCopy || "",
      });
      setAnalysis({
        targetCustomer: data.result.analysis?.targetCustomer || "",
        purchaseMotivation: data.result.analysis?.purchaseMotivation || "",
        strongestFeatures: data.result.analysis?.strongestFeatures || [],
        weaknesses: data.result.analysis?.weaknesses || [],
        missingInformation: data.result.analysis?.missingInformation || [],
        objections: data.result.analysis?.objections || [],
        conversionOpportunities: data.result.analysis?.conversionOpportunities || [],
        warnings: data.result.analysis?.warnings || [],
      });
      setMissing(data.result.analysis?.missingInformation || data.result.analysis?.warnings || []);
      if (data.usage) setUsage(data.usage);
      clearError();
      setMessage(copy.reviewChanges);
    } catch {
      showError("ai", copy.aiError);
    } finally {
      optimizingLock.current = false;
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
    clearError();
    try {
      const response = await shopifyFetch("/api/shopify/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.id,
          title: optimization.title,
          description: buildShopifyDescriptionHtml({
            description: optimization.description,
            benefitBullets: optimization.benefitBullets,
            callToAction: optimization.callToAction,
          }),
          tags: [...optimization.tags, ...optimization.keywords.filter((keyword) => !optimization.tags.includes(keyword))],
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

  function renderSaveDock() {
    return (
      <div
        className={`save-dock${adminIframe ? " save-dock-admin" : ""}`}
        data-testid="save-dock"
      >
        <label className="approve-box">
          <input
            type="checkbox"
            data-testid="approve-save"
            checked={approved}
            onChange={(event) => setApproved(event.target.checked)}
          />
          {copy.approve}
        </label>
        <button
          type="button"
          className="subscribe-button"
          data-testid="save-shopify"
          onClick={saveProduct}
          disabled={saving || !approved}
        >
          {saving ? copy.saving : copy.saveShopify}
        </button>
      </div>
    );
  }

  return (
    <main className="app-shell">
      {embeddedInstall && !embeddedSessionReady ? (
        <>
          <header className="topbar">
            <div>
              <div className="brand-small">
                {copy.brandSmall}
                <span className="live-badge" data-testid="live-badge">
                  {copy.liveBadge}
                </span>
              </div>
              <div className="brand-name">{copy.brand}</div>
            </div>
          </header>
          <section className="hero" data-testid="embedded-authenticating">
            <div className="hero-inner">
              <div className="eyebrow">{copy.eyebrow}</div>
              <h1>{copy.checkingShopify}</h1>
              <p>{copy.connecting}</p>
            </div>
          </section>
        </>
      ) : (
        <>
      <header className="topbar">
        <div>
          <div className="brand-small">
            {copy.brandSmall}
            <span className="live-badge" data-testid="live-badge">
              {copy.liveBadge}
            </span>
          </div>
          <div className="brand-name">{copy.brand}</div>
        </div>
        <div className="topbar-actions">
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
        <div className={`error-bar error-${errorKind || "generic"}`} data-testid="app-error">
          {errorKind === "quota" ? copy.quotaError : error}
        </div>
      )}
      {error && /unauthorized access/i.test(error) && (
        <div className="error-bar error-shopify">{copy.oauthUnauthorizedHelp}</div>
      )}
      {billingTest && (
        <div className="error-bar error-shopify" data-testid="test-mode-banner">
          {copy.testModeBanner}
        </div>
      )}
      {canonicalUrl && (
        <div className="error-bar">
          {copy.wrongHost} <a href={canonicalUrl}>{canonicalUrl}</a>
        </div>
      )}
      {message && !error && (
        <div className="success-bar" data-testid="import-status">
          {message}
        </div>
      )}

      <section className={shopInstalled ? "hero hero-compact" : "hero"}>
        <div className="hero-inner">
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>{copy.headline}</h1>
          {!shopInstalled && (
            <>
              <p>{copy.subhead}</p>
              <p className="hero-hint">{copy.standaloneHint}</p>
            </>
          )}
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid dashboard-grid">
          <article className="content-card">
            <h2>{copy.connectShopify}</h2>
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
            {storeBinding.kind === "connected" || embeddedInstall ? (
              <p className="shop-pill connected-shop" data-testid="connected-shop">
                {storeBinding.domain || shop || copy.notConnected}
              </p>
            ) : (
              <input
                className="shop-input"
                value={shopInput}
                onChange={(event) => setShopInput(event.target.value)}
                placeholder={copy.shopPlaceholder}
              />
            )}
            {Boolean(billedShop) &&
              Boolean(normalizeShopInput(shopInput)) &&
              normalizeShopInput(shopInput) !== billedShop &&
              canReplaceShop && (
                <div className="error-bar error-shopify" data-testid="domain-mismatch">
                  {copy.domainMismatch.replace("{shop}", billedShop)}
                  <button
                    type="button"
                    className="subscribe-button"
                    data-testid="use-this-store"
                    onClick={useThisStore}
                    disabled={connecting || changingStore}
                    style={{ marginTop: 12 }}
                  >
                    {changingStore ? copy.opening : copy.useThisStore}
                  </button>
                </div>
              )}
            {!embeddedInstall && (
            <button type="button" className="subscribe-button" onClick={connectShopify} disabled={connecting || changingStore}>
              {connecting ? copy.connecting : shopInstalled ? copy.reconnect : copy.connectShopify}
            </button>
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

          <article className="content-card">
            <h2>{copy.outputLanguage}</h2>
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
                  setAnalysis(null);
                  setApproved(false);
                  setMerchantFacts(EMPTY_MERCHANT_FACTS);
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
            <label className="input-label" htmlFor="brand-voice">{copy.brandVoice}</label>
            <select
              id="brand-voice"
              className="shop-input"
              data-testid="brand-voice"
              value={brandVoice}
              onChange={(event) => setBrandVoice(parseBrandVoice(event.target.value))}
            >
              {BRAND_VOICES.map((voice) => (
                <option key={voice} value={voice}>
                  {voice === "refined"
                    ? copy.voiceRefined
                    : voice === "minimal"
                      ? copy.voiceMinimal
                      : voice === "warm"
                        ? copy.voiceWarm
                        : voice === "bold"
                          ? copy.voiceBold
                          : copy.voiceValue}
                </option>
              ))}
            </select>
            <div data-testid="product-facts">
              <label className="input-label">{copy.productFacts}</label>
              <p className="empty-copy">{copy.productFactsHint}</p>
              {MERCHANT_FACT_FIELDS.map((field) => (
                <label className="input-label" htmlFor={`fact-${field}`} key={field}>
                  {copy[FACT_COPY_KEYS[field]]}
                  <input
                    id={`fact-${field}`}
                    className="shop-input"
                    value={merchantFacts[field]}
                    onChange={(event) =>
                      setMerchantFacts({ ...merchantFacts, [field]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <button type="button" className="subscribe-button" onClick={optimizeSelected} disabled={optimizing || !selected || !productAccess}>
              {optimizing ? copy.optimizing : copy.optimize}
            </button>
          </article>
        </div>

        <article className="content-card review-card">
          <h2>{copy.reviewChanges}</h2>
          {!selected || !optimization || !analysis ? (
            <p className="empty-copy">{copy.emptyReview}</p>
          ) : (
            <>
              <p className="empty-copy">{copy.reviewHint}</p>
              {listingScores && (
                <div className="results listing-scores" data-testid="listing-scores">
                  <div className="score-overview">
                    <div>
                      <div className="step-label light">{copy.listingScores}</div>
                      <h2>{gradeCopy(copy, listingScores.grade)}</h2>
                      <p>{copy.conversionHighlight}</p>
                    </div>
                    <div className="overall-score">
                      <strong>{listingScores.overall}</strong>
                      <span>{copy.outOf100}</span>
                    </div>
                  </div>
                  <div className="score-grid">
                    {(
                      [
                        { label: copy.scoreTitle, value: listingScores.title },
                        { label: copy.scoreDescription, value: listingScores.description },
                        { label: copy.scoreSeo, value: listingScores.seo },
                        { label: copy.scoreConversion, value: listingScores.conversion },
                      ] as const
                    ).map((row) => (
                      <div className="score-card" key={row.label}>
                        <div className="score-header">
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                        </div>
                        <div className="score-track">
                          <div className="score-fill" style={{ width: `${row.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {scoreLimitExplanation(analysis.missingInformation).length > 0 && (
                    <ul className="warning-list" data-testid="score-limit">
                      {scoreLimitExplanation(analysis.missingInformation).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  <div className="conversion-highlight" data-testid="conversion-highlight">
                    <div className="eyebrow">{copy.conversionHighlight}</div>
                    <p>{optimization.conversionCopy || copy.emptyReview}</p>
                  </div>
                </div>
              )}
              {(analysis.warnings.length > 0 || missing.length > 0) && (
                <ul className="warning-list">
                  {(analysis.warnings.length ? analysis.warnings : missing).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <div className="review-grid">
                <section>
                  <h3>{copy.original}</h3>
                  <p><strong>{selected.title}</strong></p>
                  <p>{stripHtml(selected.description || "") || "—"}</p>
                  {selected.vendor ? <p>{selected.vendor}</p> : null}
                  {selected.variants?.length ? <p>{selected.variants.join(" · ")}</p> : null}
                </section>
                <section>
                  <h3>{copy.proposed}</h3>
                  <label className="input-label" htmlFor="opt-title">{copy.fieldTitle}</label>
                  <textarea
                    id="opt-title"
                    className="review-input"
                    rows={2}
                    value={optimization.title}
                    onChange={(event) => setOptimization({ ...optimization, title: event.target.value })}
                  />
                  <label className="input-label" htmlFor="opt-description">{copy.fieldDescription}</label>
                  <textarea
                    id="opt-description"
                    className="review-input tall"
                    value={optimization.description}
                    onChange={(event) => setOptimization({ ...optimization, description: event.target.value })}
                  />
                  <label className="input-label" htmlFor="opt-bullets">{copy.benefitBullets}</label>
                  <textarea
                    id="opt-bullets"
                    className="review-input tall"
                    value={linesOf(optimization.benefitBullets)}
                    placeholder={copy.onePerLine}
                    onChange={(event) =>
                      setOptimization({ ...optimization, benefitBullets: fromLines(event.target.value) })
                    }
                  />
                  <label className="input-label" htmlFor="opt-cta">{copy.callToAction}</label>
                  <textarea
                    id="opt-cta"
                    className="review-input"
                    rows={2}
                    value={optimization.callToAction}
                    onChange={(event) => setOptimization({ ...optimization, callToAction: event.target.value })}
                  />
                  <label className="input-label" htmlFor="opt-seo-title">
                    {copy.seoTitle} ({optimization.seoTitle.length}/{SEO_TITLE_MAX})
                  </label>
                  <input
                    id="opt-seo-title"
                    className="review-input"
                    maxLength={SEO_TITLE_MAX}
                    value={optimization.seoTitle}
                    onChange={(event) =>
                      setOptimization({
                        ...optimization,
                        seoTitle: event.target.value.slice(0, SEO_TITLE_MAX),
                      })
                    }
                  />
                  <label className="input-label" htmlFor="opt-seo-description">
                    {copy.seoDescription} ({optimization.metaDescription.length}/{META_DESCRIPTION_MAX})
                  </label>
                  <textarea
                    id="opt-seo-description"
                    className="review-input"
                    maxLength={META_DESCRIPTION_MAX}
                    value={optimization.metaDescription}
                    onChange={(event) =>
                      setOptimization({
                        ...optimization,
                        metaDescription: event.target.value.slice(0, META_DESCRIPTION_MAX),
                      })
                    }
                  />
                  <label className="input-label" htmlFor="opt-tags">{copy.tagsLabel}</label>
                  <textarea
                    id="opt-tags"
                    className="review-input"
                    value={linesOf(optimization.tags)}
                    placeholder={copy.onePerLine}
                    onChange={(event) => setOptimization({ ...optimization, tags: fromLines(event.target.value) })}
                  />
                  <label className="input-label" htmlFor="opt-keywords">{copy.keywords}</label>
                  <textarea
                    id="opt-keywords"
                    className="review-input"
                    value={linesOf(optimization.keywords)}
                    placeholder={copy.onePerLine}
                    onChange={(event) => setOptimization({ ...optimization, keywords: fromLines(event.target.value) })}
                  />
                  <label className="input-label" htmlFor="opt-conversion">{copy.conversionCopy}</label>
                  <textarea
                    id="opt-conversion"
                    className="review-input"
                    value={optimization.conversionCopy}
                    onChange={(event) => setOptimization({ ...optimization, conversionCopy: event.target.value })}
                  />
                </section>
              </div>
              <div className="review-grid" data-testid="merchant-insights">
                <section className="insight-block">
                  <h3>{copy.merchantInsights}</h3>
                  <p className="empty-copy">{copy.merchantInsightsHint}</p>
                  <label className="input-label" htmlFor="an-customer">{copy.targetCustomer}</label>
                  <textarea
                    id="an-customer"
                    className="review-input"
                    value={analysis.targetCustomer}
                    onChange={(event) => setAnalysis({ ...analysis, targetCustomer: event.target.value })}
                  />
                  <label className="input-label" htmlFor="an-motivation">{copy.purchaseMotivation}</label>
                  <textarea
                    id="an-motivation"
                    className="review-input"
                    value={analysis.purchaseMotivation}
                    onChange={(event) => setAnalysis({ ...analysis, purchaseMotivation: event.target.value })}
                  />
                  <label className="input-label" htmlFor="an-features">{copy.strongestFeatures}</label>
                  <textarea
                    id="an-features"
                    className="review-input tall"
                    value={linesOf(analysis.strongestFeatures)}
                    placeholder={copy.onePerLine}
                    onChange={(event) => setAnalysis({ ...analysis, strongestFeatures: fromLines(event.target.value) })}
                  />
                  <label className="input-label" htmlFor="an-weak">{copy.weaknesses}</label>
                  <textarea
                    id="an-weak"
                    className="review-input"
                    value={linesOf(analysis.weaknesses)}
                    placeholder={copy.onePerLine}
                    onChange={(event) => setAnalysis({ ...analysis, weaknesses: fromLines(event.target.value) })}
                  />
                </section>
                <section className="insight-block">
                  <label className="input-label" htmlFor="an-missing">{copy.missingInformation}</label>
                  <textarea
                    id="an-missing"
                    className="review-input"
                    value={linesOf(analysis.missingInformation)}
                    placeholder={copy.onePerLine}
                    onChange={(event) => setAnalysis({ ...analysis, missingInformation: fromLines(event.target.value) })}
                  />
                  <label className="input-label" htmlFor="an-opps">{copy.conversionOpportunities}</label>
                  <textarea
                    id="an-opps"
                    className="review-input"
                    value={linesOf(analysis.conversionOpportunities)}
                    placeholder={copy.onePerLine}
                    onChange={(event) =>
                      setAnalysis({ ...analysis, conversionOpportunities: fromLines(event.target.value) })
                    }
                  />
                  <label className="input-label">{copy.objections}</label>
                  {analysis.objections.map((row, index) => (
                    <div key={`${row.objection}-${index}`}>
                      <input
                        className="review-input"
                        value={row.objection}
                        aria-label={copy.objections}
                        onChange={(event) => {
                          const objections = analysis.objections.slice();
                          objections[index] = { ...row, objection: event.target.value };
                          setAnalysis({ ...analysis, objections });
                        }}
                      />
                      <textarea
                        className="review-input"
                        value={row.response}
                        aria-label={copy.objectionResponse}
                        onChange={(event) => {
                          const objections = analysis.objections.slice();
                          objections[index] = { ...row, response: event.target.value };
                          setAnalysis({ ...analysis, objections });
                        }}
                      />
                    </div>
                  ))}
                </section>
              </div>
              {renderSaveDock()}
            </>
          )}
        </article>
      </section>
        </>
      )}
    </main>
  );
}
