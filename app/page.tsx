"use client";

import { useEffect, useState } from "react";
import { shopifyFetch } from "./shopify-fetch";

type Product = {
  id: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  price?: string;
  status?: string;
  tags?: string[];
};

type AIResult = {
  analysis?: {
    targetCustomer?: string;
    purchaseMotivation?: string;
    strongestFeatures?: string[];
    weaknesses?: string[];
    missingInformation?: string[];
    seoOpportunities?: string[];
    conversionOpportunities?: string[];
  };
  score?: {
    title?: number;
    description?: number;
    seo?: number;
    productClarity?: number;
    conversionPotential?: number;
    overall?: number;
  };
  optimization?: {
    title?: string;
    productType?: string;
    description?: string;
    features?: string[];
    specifications?: string[];
    seoTitle?: string;
    metaDescription?: string;
    tags?: string[];
  };
  reasoning?: string;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [vendor, setVendor] = useState("");
  const [price, setPrice] = useState("");

  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToShopify, setSavedToShopify] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const [subscriberActive, setSubscriberActive] = useState(false);
  const [subscriberChecking, setSubscriberChecking] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connection = params.get("connected");
    const checkout = params.get("checkout");

    if (connection === "success") {
      setMessage("Shopify store connected successfully.");
    }

    async function loadSubscriberStatus() {
      try {
        const response = await shopifyFetch("/api/subscriber/status", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        const active =
          response.ok &&
          data?.success &&
          data?.active === true;

        setSubscriberActive(active);

        if (checkout === "success" && active) {
          setMessage("Subscription activated successfully.");
        }
      } catch {
        setSubscriberActive(false);
      } finally {
        setSubscriberChecking(false);
      }
    }

    loadSubscriberStatus();
  }, []);

  async function startCheckout() {
    if (checkoutLoading || subscriberActive) return;

    setCheckoutLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await shopifyFetch("/api/stripe/checkout", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.url) {
        throw new Error(
          data?.error ||
            "Unable to start subscription checkout."
        );
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start subscription checkout."
      );

      setCheckoutLoading(false);
    }
  }

  async function openBillingPortal() {
    if (portalLoading || !subscriberActive) return;

    setPortalLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await shopifyFetch("/api/stripe/portal", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.url) {
        throw new Error(
          data?.error ||
            "Unable to open subscription management."
        );
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open subscription management."
      );

      setPortalLoading(false);
    }
  }

  function connectShopify() {
    setError("");
    setMessage("");

    const current = new URLSearchParams(window.location.search);
    const shop = current.get("shop") || "";
    const target = new URL("/connect", window.location.origin);
    target.searchParams.set("platform", "shopify");
    if (shop) target.searchParams.set("shop", shop);

    window.location.assign(target.toString());
  }

  async function loadProducts() {
    setProductsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await shopifyFetch(
        "/api/stores/products?platform=shopify",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            "Unable to load Shopify products."
        );
      }

      const imported = Array.isArray(data.products)
        ? data.products
        : [];

      setProducts(imported);
      setSelectedProductId("");
      setResult(null);
      setSavedToShopify(false);

      if (!imported.length) {
        setMessage("No Shopify products were returned.");
        return;
      }

      setMessage(
        `${imported.length} products loaded successfully.`
      );
    } catch (err) {
      setProducts([]);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Shopify products."
      );
    } finally {
      setProductsLoading(false);
    }
  }

  function selectProduct(product: Product) {
    setSelectedProductId(product.id);
    setTitle(product.title || "");
    setDescription(product.description || "");
    setProductType(product.productType || "");
    setVendor(product.vendor || "");
    setPrice(product.price || "");

    setResult(null);
    setSavedToShopify(false);
    setError("");
    setMessage("");
  }

  async function optimize() {
    if (!title.trim()) {
      setError("Enter a product title first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setResult(null);
    setSavedToShopify(false);

    try {
      const response = await shopifyFetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          product: {
            id: selectedProductId || null,
            title: title.trim(),
            description: description.trim(),
            productType: productType.trim(),
            vendor: vendor.trim(),
            price: price.trim(),
            platform: "shopify",
          },
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error || "AI optimization failed."
        );
      }

      setResult(data.result);
      setMessage("AI optimization completed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI optimization failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveToShopify() {
    if (savedToShopify) return;

    if (!selectedProductId) {
      setError(
        "Select an imported Shopify product before saving."
      );
      return;
    }

    if (!result?.optimization) {
      setError("Optimize the product first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const optimization = result.optimization;

      const response = await shopifyFetch(
        "/api/shopify/save-product",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            productId: selectedProductId,
            title: optimization.title || title,
            description:
              optimization.description || description,
            productType:
              optimization.productType || productType,
            tags: optimization.tags || [],
            seoTitle: optimization.seoTitle || "",
            metaDescription:
              optimization.metaDescription || "",
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.error ||
            "Unable to save product to Shopify."
        );
      }

      setSavedToShopify(true);
      setMessage(
        "Product saved to Shopify successfully."
      );
    } catch (err) {
      setSavedToShopify(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save product to Shopify."
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyText(value?: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setMessage("Copied.");
    } catch {
      setError("Unable to copy text.");
    }
  }

  function listToText(items?: string[]) {
    return items?.length ? items.join("\n") : "";
  }

  const optimization = result?.optimization;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-small">
            VIRELLO AI
          </div>

          <div className="brand-name">
            Virello AI Optimizer
          </div>
        </div>

        <div className="topbar-actions">
          {subscriberActive ? (
            <button
              type="button"
              className="subscribe-button"
              onClick={openBillingPortal}
              disabled={
                subscriberChecking || portalLoading
              }
            >
              {portalLoading
                ? "Opening..."
                : "Manage Subscription"}
            </button>
          ) : (
            <button
              type="button"
              className="subscribe-button"
              onClick={startCheckout}
              disabled={
                subscriberChecking || checkoutLoading
              }
            >
              {subscriberChecking
                ? "Checking..."
                : checkoutLoading
                  ? "Opening..."
                  : "Subscribe"}
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">
            AI PRODUCT INTELLIGENCE
          </div>

          <h1>
            Optimize Shopify products{" "}
            <span>with AI.</span>
          </h1>

          <p>
            Connect your Shopify store, import products
            and create conversion-focused listings, SEO
            content and product intelligence with
            Virello AI.
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid">
          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {message && !error && (
            <div className="alert success">
              {message}
            </div>
          )}

          <section className="content-card">
            <div className="step-label">
              SHOPIFY CONNECTION
            </div>

            <h2>Connect your Shopify store</h2>

            <p className="section-description">
              Connect your Shopify store to import
              products and optimize them with
              Virello AI.
            </p>

            <button
              type="button"
              className="generate-button full-button"
              onClick={connectShopify}
            >
              Connect Shopify
            </button>

            <button
              type="button"
              className="small-button import-button"
              onClick={loadProducts}
              disabled={productsLoading}
            >
              {productsLoading
                ? "Loading..."
                : "Import Shopify Products"}
            </button>
          </section>

          {products.length > 0 && (
            <section className="content-card">
              <div className="step-label">
                IMPORTED PRODUCTS
              </div>

              <h2>Select a product</h2>

              <div className="product-list">
                {products.map((product) => {
                  const selected =
                    selectedProductId === product.id;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={
                        selected
                          ? "product-card selected-product-card"
                          : "product-card"
                      }
                      onClick={() =>
                        selectProduct(product)
                      }
                    >
                      <div className="product-main">
                        <strong>
                          {product.title ||
                            "Untitled product"}
                        </strong>

                        {product.vendor && (
                          <span>{product.vendor}</span>
                        )}
                      </div>

                      {product.price && (
                        <span className="product-price">
                          {product.price}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="content-card optimizer-card">
            <div>
              <div className="step-label">
                AI OPTIMIZER
              </div>

              <h2>Optimize your product</h2>

              <p className="section-description">
                Select an imported Shopify product or
                enter product information manually.
              </p>
            </div>

            <button
              type="button"
              className="generate-button"
              onClick={optimize}
              disabled={loading}
            >
              {loading
                ? "Optimizing..."
                : "Optimize with AI"}
            </button>
          </section>

          <section className="content-card">
            <div className="result-field first-field">
              <div className="field-header">
                <label>Product title *</label>
              </div>

              <input
                className="search-input"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSavedToShopify(false);
                }}
                placeholder="Enter product title"
              />
            </div>

            <div className="result-field">
              <div className="field-header">
                <label>Description</label>
              </div>

              <textarea
                className="search-input textarea"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setSavedToShopify(false);
                }}
                placeholder="Current product description"
              />
            </div>

            <div className="score-grid input-grid">
              <input
                className="search-input"
                value={productType}
                onChange={(event) => {
                  setProductType(event.target.value);
                  setSavedToShopify(false);
                }}
                placeholder="Product type"
              />

              <input
                className="search-input"
                value={vendor}
                onChange={(event) => {
                  setVendor(event.target.value);
                  setSavedToShopify(false);
                }}
                placeholder="Brand / supplier"
              />

              <input
                className="search-input"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setSavedToShopify(false);
                }}
                placeholder="Price"
              />
            </div>
          </section>

          {result && (
            <>
              <section className="score-overview">
                <div>
                  <div className="step-label light">
                    VIRELLO SCORE
                  </div>

                  <h2>Product optimization</h2>

                  <p>
                    Listing quality, SEO, clarity and
                    conversion potential.
                  </p>
                </div>

                <div className="overall-score">
                  <strong>
                    {result.score?.overall ?? 0}
                  </strong>
                  <span>/100</span>
                </div>
              </section>

              <section className="score-grid">
                {[
                  ["Title", result.score?.title],
                  [
                    "Description",
                    result.score?.description,
                  ],
                  ["SEO", result.score?.seo],
                  [
                    "Clarity",
                    result.score?.productClarity,
                  ],
                  [
                    "Conversion",
                    result.score?.conversionPotential,
                  ],
                ].map(([label, value]) => {
                  const score =
                    typeof value === "number"
                      ? value
                      : 0;

                  return (
                    <div
                      className="score-card"
                      key={String(label)}
                    >
                      <div className="score-header">
                        <span>{label}</span>
                        <strong>{score}/100</strong>
                      </div>

                      <div className="score-track">
                        <div
                          className="score-fill"
                          style={{
                            width: `${score}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="content-card">
                <div className="listing-header">
                  <div>
                    <div className="step-label">
                      OPTIMIZED LISTING
                    </div>

                    <h2>Ready-to-use content</h2>
                  </div>

                  {selectedProductId && (
                    <button
                      type="button"
                      className={
                        savedToShopify
                          ? "save-button saved"
                          : "save-button"
                      }
                      onClick={saveToShopify}
                      disabled={
                        saving || savedToShopify
                      }
                    >
                      {saving
                        ? "Saving..."
                        : savedToShopify
                          ? "Saved to Shopify ✓"
                          : "Save to Shopify"}
                    </button>
                  )}
                </div>

                {[
                  [
                    "Product title",
                    optimization?.title,
                  ],
                  [
                    "Product type",
                    optimization?.productType,
                  ],
                  [
                    "Product description",
                    optimization?.description,
                  ],
                  [
                    "Features",
                    listToText(
                      optimization?.features
                    ),
                  ],
                  [
                    "Specifications",
                    listToText(
                      optimization?.specifications
                    ),
                  ],
                  [
                    "SEO title",
                    optimization?.seoTitle,
                  ],
                  [
                    "Meta description",
                    optimization?.metaDescription,
                  ],
                  [
                    "Tags",
                    optimization?.tags?.join(", "),
                  ],
                ].map(([label, value]) => {
                  const text = String(value || "");

                  return (
                    <div
                      className="result-field"
                      key={String(label)}
                    >
                      <div className="field-header">
                        <label>{label}</label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(text)
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div
                        className={
                          text.includes("\n")
                            ? "field-value multiline"
                            : "field-value"
                        }
                      >
                        {text || "No output"}
                      </div>
                    </div>
                  );
                })}

                {savedToShopify && (
                  <div className="saved-confirmation">
                    <strong>Saved to Shopify</strong>

                    <span>
                      The optimized product content has
                      been successfully updated in your
                      Shopify store.
                    </span>
                  </div>
                )}

                {!selectedProductId && (
                  <div className="save-note">
                    Select an imported Shopify product
                    to enable Save to Shopify.
                  </div>
                )}
              </section>

              {result.analysis && (
                <section className="content-card">
                  <div className="step-label">
                    AI ANALYSIS
                  </div>

                  <h2>What Virello found</h2>

                  {result.analysis.targetCustomer && (
                    <div className="analysis-block">
                      <strong>Target customer</strong>
                      <p>
                        {
                          result.analysis
                            .targetCustomer
                        }
                      </p>
                    </div>
                  )}

                  {result.analysis
                    .purchaseMotivation && (
                    <div className="analysis-block">
                      <strong>
                        Purchase motivation
                      </strong>
                      <p>
                        {
                          result.analysis
                            .purchaseMotivation
                        }
                      </p>
                    </div>
                  )}

                  {result.analysis.strongestFeatures
                    ?.length ? (
                    <div className="analysis-block">
                      <strong>
                        Strongest features
                      </strong>
                      <ul>
                        {result.analysis.strongestFeatures.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {result.analysis.weaknesses
                    ?.length ? (
                    <div className="analysis-block">
                      <strong>Weaknesses</strong>
                      <ul>
                        {result.analysis.weaknesses.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {result.analysis.missingInformation
                    ?.length ? (
                    <div className="analysis-block">
                      <strong>
                        Missing information
                      </strong>
                      <ul>
                        {result.analysis.missingInformation.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {result.analysis.seoOpportunities
                    ?.length ? (
                    <div className="analysis-block">
                      <strong>
                        SEO opportunities
                      </strong>
                      <ul>
                        {result.analysis.seoOpportunities.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}

                  {result.analysis
                    .conversionOpportunities
                    ?.length ? (
                    <div className="analysis-block">
                      <strong>
                        Conversion opportunities
                      </strong>
                      <ul>
                        {result.analysis.conversionOpportunities.map(
                          (item, index) => (
                            <li key={index}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  ) : null}
                </section>
              )}

              {result.reasoning && (
                <section className="content-card">
                  <div className="step-label">
                    AI REASONING
                  </div>

                  <h2>
                    Why Virello made these changes
                  </h2>

                  <p className="reasoning-text">
                    {result.reasoning}
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .app-shell {
    min-height: 100vh;
    background: #f4f5f7;
    color: #111318;
  }

  .topbar {
    min-height: 72px;
    padding: 12px 22px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .brand-small {
    color: #969ba3;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .14em;
  }

  .brand-name {
    margin-top: 2px;
    font-size: 15px;
    font-weight: 850;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .subscribe-button {
    min-height: 35px;
    padding: 0 15px;
    border: 0;
    border-radius: 8px;
    background: #111318;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
  }

  .subscribe-button:disabled {
    opacity: .7;
    cursor: default;
  }

  .hero {
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
  }

  .hero-inner {
    max-width: 1020px;
    margin: 0 auto;
    padding: 42px 22px 38px;
  }

  .eyebrow,
  .step-label {
    color: #8c929a;
    font-size: 8px;
    font-weight: 850;
    letter-spacing: .14em;
  }

  .hero h1 {
    max-width: 720px;
    margin: 11px 0;
    font-size: clamp(31px, 4.5vw, 49px);
    line-height: 1;
    letter-spacing: -.045em;
    font-weight: 900;
  }

  .hero h1 span {
    color: #949aa2;
  }

  .hero p {
    max-width: 680px;
    margin: 0;
    color: #727880;
    font-size: 13px;
    line-height: 1.6;
  }

  .workspace {
    padding: 18px 22px 35px;
  }

  .workspace-grid {
    max-width: 1020px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .alert {
    padding: 10px 13px;
    border: 1px solid #dfe2e6;
    border-radius: 9px;
    background: #fff;
    color: #555b63;
    font-size: 11px;
  }

  .alert.error {
    border-color: #e3caca;
    background: #fffafa;
    color: #9a4545;
  }

  .alert.success {
    border-color: #d8e2da;
    background: #fafcfb;
    color: #4f6b57;
  }

  .content-card {
    padding: 21px;
    border: 1px solid #e0e3e7;
    border-radius: 15px;
    background: #fff;
    box-shadow: 0 7px 20px rgba(17, 19, 24, .03);
  }

  .content-card h2 {
    margin: 8px 0 7px;
    font-size: 20px;
    letter-spacing: -.025em;
  }

  .section-description {
    margin: 0 0 16px;
    color: #7a8088;
    font-size: 12px;
    line-height: 1.55;
  }

  .generate-button {
    min-height: 42px;
    padding: 0 16px;
    border: 0;
    border-radius: 8px;
    background: #111318;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .generate-button:hover {
    background: #292d34;
  }

  .generate-button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .full-button {
    width: 100%;
    margin-top: 3px;
  }

  .small-button {
    min-height: 29px;
    padding: 0 9px;
    border: 1px solid #dfe2e6;
    border-radius: 6px;
    background: #fff;
    color: #555b63;
    font-size: 9px;
    font-weight: 750;
    cursor: pointer;
  }

  .small-button:hover {
    border-color: #bfc4ca;
  }

  .small-button:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .import-button {
    margin-top: 10px;
  }

  .product-list {
    display: grid;
    gap: 7px;
    margin-top: 13px;
  }

  .product-card {
    width: 100%;
    min-height: 56px;
    padding: 10px 12px;
    border: 1px solid #e0e3e7;
    border-radius: 9px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    text-align: left;
    cursor: pointer;
  }

  .product-card:hover {
    border-color: #bfc4ca;
  }

  .selected-product-card {
    border: 2px solid #111318;
    background: #f7f7f8;
  }

  .product-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .product-main strong {
    font-size: 12px;
    line-height: 1.35;
  }

  .product-main span {
    color: #858b93;
    font-size: 9px;
  }

  .product-price {
    flex: 0 0 auto;
    color: #111318;
    font-size: 11px;
    font-weight: 750;
  }

  .optimizer-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .optimizer-card .section-description {
    margin-bottom: 0;
  }

  .result-field {
    margin-top: 14px;
  }

  .first-field {
    margin-top: 0;
  }

  .field-header {
    min-height: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
  }

  .field-header label {
    color: #3f444b;
    font-size: 10px;
    font-weight: 800;
  }

  .search-input {
    width: 100%;
    min-height: 42px;
    padding: 0 12px;
    border: 1px solid #d9dce0;
    border-radius: 8px;
    background: #fff;
    color: #111318;
    font: inherit;
    font-size: 12px;
    outline: none;
  }

  textarea.search-input {
    min-height: 105px;
    padding: 11px 12px;
    resize: vertical;
  }

  .search-input:focus {
    border-color: #111318;
    box-shadow: 0 0 0 3px rgba(17, 19, 24, .06);
  }

  .input-grid {
    margin-top: 13px;
  }

  .score-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
  }

  .score-overview {
    padding: 20px;
    border-radius: 15px;
    background: #111318;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .score-overview h2 {
    margin: 7px 0;
    font-size: 19px;
    letter-spacing: -.025em;
  }

  .score-overview p {
    margin: 0;
    color: #b9bdc3;
    font-size: 10px;
  }

  .step-label.light {
    color: #9da2a9;
  }

  .overall-score {
    display: flex;
    align-items: baseline;
    gap: 2px;
    flex: 0 0 auto;
  }

  .overall-score strong {
    font-size: 38px;
    line-height: 1;
  }

  .overall-score span {
    color: #aeb3ba;
    font-size: 11px;
  }

  .score-card {
    padding: 13px;
    border: 1px solid #e0e3e7;
    border-radius: 10px;
    background: #fff;
  }

  .score-header {
    display: flex;
    justify-content: space-between;
    gap: 7px;
    font-size: 10px;
  }

  .score-header strong {
    font-size: 10px;
  }

  .score-track {
    height: 4px;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: #e8eaed;
  }

  .score-fill {
    height: 100%;
    border-radius: inherit;
    background: #111318;
  }

  .listing-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
  }

  .save-button {
    min-height: 40px;
    padding: 0 15px;
    border: 0;
    border-radius: 8px;
    background: #111318;
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }

  .save-button:hover {
    background: #292d34;
  }

  .save-button:disabled {
    opacity: .55;
    cursor: default;
  }

  .save-button.saved {
    background: #555b63;
  }

  .field-value {
    min-height: 41px;
    padding: 10px 12px;
    border: 1px solid #e0e3e7;
    border-radius: 8px;
    background: #fafafa;
    color: #34383e;
    font-size: 11px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .field-value.multiline {
    min-height: 82px;
  }

  .saved-confirmation {
    margin-top: 14px;
    padding: 11px 13px;
    border: 1px solid #dfe4e0;
    border-radius: 8px;
    background: #fafcfb;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .saved-confirmation strong {
    color: #45594a;
    font-size: 11px;
  }

  .saved-confirmation span {
    color: #777d85;
    font-size: 10px;
    line-height: 1.5;
  }

  .save-note {
    margin-top: 14px;
    padding: 10px 12px;
    border: 1px solid #e0e3e7;
    border-radius: 8px;
    background: #f8f9fa;
    color: #777d85;
    font-size: 10px;
    line-height: 1.5;
  }

  .analysis-block {
    margin-top: 15px;
    padding-top: 13px;
    border-top: 1px solid #eceef0;
  }

  .analysis-block strong {
    font-size: 11px;
  }

  .analysis-block p,
  .analysis-block li {
    color: #70767e;
    font-size: 10px;
    line-height: 1.55;
  }

  .analysis-block p {
    margin: 5px 0 0;
  }

  .analysis-block ul {
    margin: 6px 0 0;
    padding-left: 17px;
  }

  .reasoning-text {
    margin: 10px 0 0;
    color: #70767e;
    font-size: 10px;
    line-height: 1.65;
  }

  @media (max-width: 760px) {
    .topbar {
      padding: 12px 15px;
    }

    .brand-name {
      font-size: 14px;
    }

    .hero-inner {
      padding: 35px 17px 32px;
    }

    .hero h1 {
      font-size: 34px;
    }

    .hero p {
      font-size: 12px;
    }

    .workspace {
      padding: 13px 15px 25px;
    }

    .content-card {
      padding: 18px;
      border-radius: 13px;
    }

    .content-card h2 {
      font-size: 19px;
    }

    .score-grid {
      grid-template-columns: 1fr;
    }

    .optimizer-card {
      align-items: stretch;
      flex-direction: column;
    }

    .optimizer-card .generate-button {
      width: 100%;
    }

    .listing-header {
      flex-direction: column;
    }

    .save-button {
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .hero h1 {
      font-size: 31px;
    }

    .product-card {
      min-height: 54px;
    }
  }
`;
