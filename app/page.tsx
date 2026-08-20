"use client";

import { useEffect, useMemo, useState } from "react";

type ShopifyProduct = {
  id: string;
  title: string;
  description?: string;
  productType?: string;
  tags?: string[];
  status?: string;
  vendor?: string;
  price?: string;
  featuredImage?: string | null;
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

type ShopifyResponse = {
  success?: boolean;
  products?: ShopifyProduct[];
  shop?: string;
  error?: string;
};

type AIResponse = {
  success?: boolean;
  result?: AIResult;
  error?: string;
};

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  const score =
    typeof value === "number"
      ? Math.max(0, Math.min(100, Math.round(value)))
      : 0;

  return (
    <div className="score-card">
      <div className="score-header">
        <span>{label}</span>
        <strong>{score}/100</strong>
      </div>

      <div className="score-track">
        <div
          className="score-fill"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function CopyButton({ value }: { value?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="small-button"
      disabled={!value}
      onClick={copy}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ResultField({
  label,
  value,
  multiline = false,
  limit,
}: {
  label: string;
  value?: string;
  multiline?: boolean;
  limit?: number;
}) {
  const text = value || "";

  return (
    <div className="result-field">
      <div className="field-header">
        <label>{label}</label>

        <div className="field-actions">
          {limit !== undefined && (
            <span
              className={
                text.length > limit
                  ? "character-count danger"
                  : "character-count"
              }
            >
              {text.length}/{limit}
            </span>
          )}

          <CopyButton value={text} />
        </div>
      </div>

      <div
        className={
          multiline
            ? "field-value multiline"
            : "field-value"
        }
      >
        {text || "No AI output yet."}
      </div>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  const [result, setResult] = useState<AIResult | null>(null);

  const [loadingProducts, setLoadingProducts] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [shop, setShop] = useState("");

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) => product.id === selectedId
    );
  }, [products, selectedId]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(query) ||
        product.productType
          ?.toLowerCase()
          .includes(query) ||
        product.vendor
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [products, search]);

  async function getShopifyToken() {
    if (
      typeof window === "undefined" ||
      !window.shopify?.idToken
    ) {
      throw new Error(
        "Open Virello AI Optimizer from Shopify Admin."
      );
    }

    const token = await window.shopify.idToken();

    if (!token) {
      throw new Error(
        "Shopify session token could not be created."
      );
    }

    return token;
  }

  async function loadProducts() {
    setLoadingProducts(true);
    setError("");

    try {
      const token = await getShopifyToken();

      const response = await fetch(
        "/api/shopify/products",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data: ShopifyResponse =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to load Shopify products."
        );
      }

      const loadedProducts = data.products || [];

      setProducts(loadedProducts);
      setShop(data.shop || "");

      if (loadedProducts.length > 0) {
        setSelectedId(loadedProducts[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Shopify products."
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function selectProduct(product: ShopifyProduct) {
    setSelectedId(product.id);
    setResult(null);
    setMessage("");
    setError("");
  }

  async function generateWithAI() {
    if (!selectedProduct) {
      setError("Select a Shopify product first.");
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/ai/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product: {
              id: selectedProduct.id,
              title: selectedProduct.title,
              description:
                selectedProduct.description || "",
              productType:
                selectedProduct.productType || "",
              vendor:
                selectedProduct.vendor || "",
              tags:
                selectedProduct.tags || [],
              price:
                selectedProduct.price || "",
              featuredImage:
                selectedProduct.featuredImage ||
                null,
            },
          }),
        }
      );

      const data: AIResponse =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "AI optimization failed."
        );
      }

      setResult(data.result || null);

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI optimization failed."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function saveToShopify() {
    if (!selectedProduct) {
      setError("Select a Shopify product first.");
      return;
    }

    if (!result?.optimization) {
      setError(
        "Generate the product with AI first."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token = await getShopifyToken();

      const optimization =
        result.optimization;

      const seoTitle =
        (optimization.seoTitle || "").slice(
          0,
          50
        );

      const metaDescription =
        (optimization.metaDescription || "").slice(
          0,
          150
        );

      const response = await fetch(
        "/api/shopify/save-product",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: selectedProduct.id,
            title:
              optimization.title ||
              selectedProduct.title,
            description:
              optimization.description ||
              selectedProduct.description ||
              "",
            productType:
              optimization.productType ||
              selectedProduct.productType ||
              "",
            tags:
              optimization.tags ||
              selectedProduct.tags ||
              [],
            seoTitle,
            metaDescription,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to save product to Shopify."
        );
      }

      setMessage(
        "Product successfully saved to Shopify."
      );

      setProducts((current) =>
        current.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                title:
                  optimization.title ||
                  product.title,
                description:
                  optimization.description ||
                  product.description,
                productType:
                  optimization.productType ||
                  product.productType,
                tags:
                  optimization.tags ||
                  product.tags,
              }
            : product
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save product to Shopify."
      );
    } finally {
      setSaving(false);
    }
  }

  function clearResult() {
    setResult(null);
    setError("");
    setMessage("");
  }

  const overall =
    result?.score?.overall ?? 0;

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

        <div className="shop-pill">
          {shop || "Shopify Store"}
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">
            AI PRODUCT INTELLIGENCE
          </div>

          <h1>
            Optimize your Shopify products
            <span> with AI.</span>
          </h1>

          <p>
            Select any product from your Shopify
            store, generate conversion-focused
            content, review the AI score and save
            the optimized listing directly back to
            Shopify.
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid">
          <aside className="products-panel">
            <div className="panel-heading">
              <div>
                <div className="step-label">
                  STORE PRODUCTS
                </div>

                <h2>Products</h2>
              </div>

              <button
                type="button"
                className="refresh-button"
                onClick={loadProducts}
                disabled={loadingProducts}
              >
                Refresh
              </button>
            </div>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
              className="search-input"
            />

            {loadingProducts ? (
              <div className="empty-panel">
                <div className="spinner" />
                <strong>
                  Loading Shopify products...
                </strong>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-panel">
                <strong>
                  No products found.
                </strong>

                <p>
                  Make sure the app is opened from
                  your Shopify Admin.
                </p>
              </div>
            ) : (
              <div className="product-list">
                {filteredProducts.map(
                  (product) => {
                    const active =
                      product.id === selectedId;

                    return (
                      <button
                        type="button"
                        key={product.id}
                        className={
                          active
                            ? "product-row active"
                            : "product-row"
                        }
                        onClick={() =>
                          selectProduct(product)
                        }
                      >
                        <div className="product-image">
                          {product.featuredImage ? (
                            <img
                              src={
                                product.featuredImage
                              }
                              alt=""
                            />
                          ) : (
                            <span>
                              {product.title
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="product-row-info">
                          <strong>
                            {product.title}
                          </strong>

                          <small>
                            {product.productType ||
                              product.vendor ||
                              "Product"}
                          </small>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </aside>

          <section className="optimizer-panel">
            <div className="selected-product">
              <div>
                <div className="step-label">
                  SELECTED PRODUCT
                </div>

                <h2>
                  {selectedProduct?.title ||
                    "Select a product"}
                </h2>

                {selectedProduct && (
                  <p>
                    {selectedProduct.productType ||
                      "Shopify product"}
                    {selectedProduct.vendor
                      ? ` · ${selectedProduct.vendor}`
                      : ""}
                  </p>
                )}
              </div>

              {selectedProduct && (
                <button
                  type="button"
                  className="generate-button"
                  onClick={generateWithAI}
                  disabled={generating}
                >
                  {generating
                    ? "Generating..."
                    : "Generate with AI"}
                </button>
              )}
            </div>

            {error && (
              <div className="alert error">
                {error}
              </div>
            )}

            {message && (
              <div className="alert success">
                {message}
              </div>
            )}

            {!result && !generating && (
              <div className="empty-result">
                <div className="ai-icon">
                  AI
                </div>

                <h2>
                  Ready to optimize
                </h2>

                <p>
                  Select a Shopify product and tap
                  <strong>
                    {" "}
                    Generate with AI
                  </strong>
                  . Virello will analyze the actual
                  product information and generate
                  the optimized listing.
                </p>
              </div>
            )}

            {generating && (
              <div className="empty-result">
                <div className="spinner large" />

                <h2>
                  Virello AI is working
                </h2>

                <p>
                  Analyzing product data and
                  generating the optimized listing...
                </p>
              </div>
            )}

            {result && !generating && (
              <div className="results">
                <div className="score-overview">
                  <div>
                    <div className="step-label light">
                      AI SCORE
                    </div>

                    <h2>
                      Conversion readiness
                    </h2>

                    <p>
                      AI evaluation of the product
                      listing and its optimization
                      potential.
                    </p>
                  </div>

                  <div className="overall-score">
                    <strong>{overall}</strong>
                    <span>/100</span>
                  </div>
                </div>

                <div className="score-grid">
                  <ScoreBar
                    label="Title"
                    value={
                      result.score?.title
                    }
                  />

                  <ScoreBar
                    label="Description"
                    value={
                      result.score?.description
                    }
                  />

                  <ScoreBar
                    label="SEO"
                    value={
                      result.score?.seo
                    }
                  />

                  <ScoreBar
                    label="Product clarity"
                    value={
                      result.score
                        ?.productClarity
                    }
                  />

                  <ScoreBar
                    label="Conversion potential"
                    value={
                      result.score
                        ?.conversionPotential
                    }
                  />
                </div>

                <div className="content-card">
                  <div className="card-title">
                    <div>
                      <div className="step-label">
                        GENERATED CONTENT
                      </div>

                      <h2>
                        Shopify-ready listing
                      </h2>
                    </div>

                    <button
                      type="button"
                      className="save-button"
                      onClick={saveToShopify}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : "Save to Shopify"}
                    </button>
                  </div>

                  <ResultField
                    label="Product title"
                    value={
                      result.optimization
                        ?.title
                    }
                  />

                  <ResultField
                    label="Product type"
                    value={
                      result.optimization
                        ?.productType
                    }
                  />

                  <ResultField
                    label="Tags"
                    value={
                      result.optimization
                        ?.tags?.join(", ")
                    }
                  />

                  <ResultField
                    label="Description"
                    value={
                      result.optimization
                        ?.description
                    }
                    multiline
                  />

                  <ResultField
                    label="SEO title"
                    value={
                      result.optimization
                        ?.seoTitle
                    }
                    limit={50}
                  />

                  <ResultField
                    label="Meta description"
                    value={
                      result.optimization
                        ?.metaDescription
                    }
                    limit={150}
                  />

                  <div className="two-column">
                    <div className="mini-card">
                      <h3>
                        Features
                      </h3>

                      <ul>
                        {(
                          result.optimization
                            ?.features || []
                        ).map(
                          (item, index) => (
                            <li
                              key={`${item}-${index}`}
                            >
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div className="mini-card">
                      <h3>
                        Specifications
                      </h3>

                      <ul>
                        {(
                          result.optimization
                            ?.specifications ||
                          []
                        ).map(
                          (item, index) => (
                            <li
                              key={`${item}-${index}`}
                            >
                              {item}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="analysis-grid">
                  <div className="analysis-card">
                    <h3>
                      Target customer
                    </h3>

                    <p>
                      {result.analysis
                        ?.targetCustomer ||
                        "Not available."}
                    </p>
                  </div>

                  <div className="analysis-card">
                    <h3>
                      Purchase motivation
                    </h3>

                    <p>
                      {result.analysis
                        ?.purchaseMotivation ||
                        "Not available."}
                    </p>
                  </div>

                  <div className="analysis-card">
                    <h3>
                      SEO opportunities
                    </h3>

                    <ul>
                      {(
                        result.analysis
                          ?.seoOpportunities ||
                        []
                      ).map(
                        (item, index) => (
                          <li
                            key={`${item}-${index}`}
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  <div className="analysis-card">
                    <h3>
                      Conversion opportunities
                    </h3>

                    <ul>
                      {(
                        result.analysis
                          ?.conversionOpportunities ||
                        []
                      ).map(
                        (item, index) => (
                          <li
                            key={`${item}-${index}`}
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>

                <div className="reasoning-card">
                  <h3>
                    AI reasoning
                  </h3>

                  <p>
                    {result.reasoning ||
                      "No additional reasoning returned."}
                  </p>
                </div>

                <div className="bottom-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={clearResult}
                  >
                    Clear generated result
                  </button>

                  <button
                    type="button"
                    className="save-button"
                    onClick={saveToShopify}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save optimized product"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
