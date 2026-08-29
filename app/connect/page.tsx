"use client";

import { useEffect, useState } from "react";

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

type ConnectionStatus = {
  success?: boolean;
  connected?: boolean;
  platform?: string;
  shop?: string;
  error?: string;
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
  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [productType, setProductType] =
    useState("");
  const [vendor, setVendor] = useState("");
  const [price, setPrice] = useState("");

  const [result, setResult] =
    useState<AIResult | null>(null);

  const [connected, setConnected] =
    useState(false);

  const [connectionChecking, setConnectionChecking] =
    useState(true);

  const [connecting, setConnecting] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [productsLoading, setProductsLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [savedToShopify, setSavedToShopify] =
    useState(false);

  const [checkoutLoading, setCheckoutLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkShopifyConnection();
  }, []);

  async function checkShopifyConnection() {
    setConnectionChecking(true);

    try {
      const response = await fetch(
        "/api/shopify/status",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data =
        await response.json().catch(() => null);

      const isConnected =
        response.ok &&
        data?.connected === true;

      setConnected(isConnected);

      if (isConnected) {
        setMessage(
          "Shopify store connected successfully."
        );
      }
    } catch (err) {
      console.error(
        "SHOPIFY_STATUS_ERROR:",
        err
      );

      setConnected(false);
    } finally {
      setConnectionChecking(false);
    }
  }

  function connectShopify() {
    if (connecting) return;

    setConnecting(true);
    setError("");
    setMessage("");

    window.location.assign(
      "/connect?platform=shopify"
    );
  }

  async function startCheckout() {
    if (checkoutLoading) return;

    setCheckoutLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        !data?.success ||
        !data?.url
      ) {
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

  async function loadProducts() {
    if (!connected) {
      setError(
        "Connect your Shopify store first."
      );
      return;
    }

    setProductsLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/shopify/products",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "Unable to load Shopify products."
        );
      }

      const rawProducts =
        Array.isArray(data.products)
          ? data.products
          : [];

      const normalizedProducts: Product[] =
        rawProducts.map(
          (product: any) => {
            const firstVariant =
              Array.isArray(
                product?.variants
              )
                ? product.variants[0]
                : null;

            const rawTags =
              Array.isArray(product?.tags)
                ? product.tags
                : typeof product?.tags ===
                  "string"
                ? product.tags
                    .split(",")
                    .map((tag: string) =>
                      tag.trim()
                    )
                    .filter(Boolean)
                : [];

            return {
              id: String(
                product?.id ?? ""
              ),
              title:
                product?.title ||
                "Untitled product",
              description:
                product?.description ??
                product?.body_html ??
                "",
              productType:
                product?.productType ??
                product?.product_type ??
                "",
              vendor:
                product?.vendor ?? "",
              price:
                product?.price ??
                firstVariant?.price ??
                "",
              status:
                product?.status ?? "",
              tags: rawTags,
            };
          }
        );

      setProducts(
        normalizedProducts
      );

      setSelectedProductId("");
      setResult(null);
      setSavedToShopify(false);

      if (
        normalizedProducts.length === 0
      ) {
        setMessage(
          "No Shopify products were returned."
        );
        return;
      }

      setMessage(
        `${normalizedProducts.length} Shopify products loaded successfully.`
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

  function selectProduct(
    product: Product
  ) {
    setSelectedProductId(
      product.id
    );

    setTitle(
      product.title || ""
    );

    setDescription(
      product.description || ""
    );

    setProductType(
      product.productType || ""
    );

    setVendor(
      product.vendor || ""
    );

    setPrice(
      product.price || ""
    );

    setResult(null);
    setSavedToShopify(false);
    setError("");
    setMessage("");
  }

  async function optimize() {
    if (!title.trim()) {
      setError(
        "Enter a product title first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setResult(null);
    setSavedToShopify(false);

    try {
      const response = await fetch(
        "/api/ai/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            product: {
              id:
                selectedProductId ||
                null,
              title:
                title.trim(),
              description:
                description.trim(),
              productType:
                productType.trim(),
              vendor:
                vendor.trim(),
              price:
                price.trim(),
              platform:
                "shopify",
            },
          }),
        }
      );

      const data =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "AI optimization failed."
        );
      }

      setResult(
        data.result
      );

      setMessage(
        "AI optimization completed."
      );
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
      setError(
        "Optimize the product first."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const optimization =
        result.optimization;

      const response = await fetch(
        "/api/shopify/save-product",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            productId:
              selectedProductId,

            title:
              optimization.title ||
              title,

            description:
              optimization.description ||
              description,

            productType:
              optimization.productType ||
              productType,

            tags:
              optimization.tags ||
              [],

            seoTitle:
              optimization.seoTitle ||
              "",

            metaDescription:
              optimization.metaDescription ||
              "",
          }),
        }
      );

      const data =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        !data?.success
      ) {
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

  async function copyText(
    value?: string
  ) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );

      setError("");
      setMessage("Copied.");
    } catch {
      setError(
        "Unable to copy text."
      );
    }
  }

  function listToText(
    items?: string[]
  ) {
    return items?.length
      ? items.join("\n")
      : "";
  }

  const optimization =
    result?.optimization;

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

        <button
          type="button"
          className="subscribe-button"
          onClick={startCheckout}
          disabled={checkoutLoading}
        >
          {checkoutLoading
            ? "Opening..."
            : "Subscribe"}
        </button>
      </header>

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

      <section className="hero">
        <div className="hero-inner">

          <div className="eyebrow">
            SHOPIFY AI OPTIMIZATION
          </div>

          <h1>
            Optimize Shopify
            <br />
            products{" "}
            <span>with AI.</span>
          </h1>

          <p>
            Connect your Shopify store,
            import products and create
            conversion-focused listings,
            SEO content and product
            intelligence with Virello AI.
          </p>

        </div>
      </section>

      <section className="workspace">

        {/* CONNECTION */}

        <section className="content-card connection-card">

          <div className="step-label">
            SHOPIFY CONNECTION
          </div>

          <h2>
            {connectionChecking
              ? "Checking your Shopify store"
              : connected
              ? "Shopify store connected"
              : "Connect your Shopify store"}
          </h2>

          <p className="section-description">

            {connectionChecking
              ? "Checking your current Shopify connection."
              : connected
              ? "Your Shopify store is connected and ready to use with Virello AI."
              : "Connect your Shopify store to import products and optimize them with Virello AI."}

          </p>

          {connectionChecking ? (
            <div className="connection-status">
              <div className="spinner" />
              <span>
                Checking Shopify connection...
              </span>
            </div>
          ) : connected ? (
            <div className="connected-box">
              <div className="connected-icon">
                ✓
              </div>

              <div>
                <strong>
                  Shopify connected
                </strong>

                <span>
                  Your store is ready.
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="generate-button full-button"
              onClick={connectShopify}
              disabled={connecting}
            >
              {connecting
                ? "Connecting..."
                : "Connect Shopify"}
            </button>
          )}

          {connected && (
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
          )}

        </section>

        {/* PRODUCTS */}

        {products.length > 0 && (
          <section className="content-card">

            <div className="step-label">
              IMPORTED PRODUCTS
            </div>

            <h2>
              Select a product
            </h2>

            <div className="product-list">

              {products.map(
                (product) => {

                  const selected =
                    selectedProductId ===
                    product.id;

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
                        selectProduct(
                          product
                        )
                      }
                    >

                      <div className="product-main">

                        <strong>
                          {product.title ||
                            "Untitled product"}
                        </strong>

                        {product.vendor && (
                          <span>
                            {product.vendor}
                          </span>
                        )}

                      </div>

                      {product.price && (
                        <span className="product-price">
                          {product.price}
                        </span>
                      )}

                    </button>
                  );
                }
              )}

            </div>

          </section>
        )}

        {/* OPTIMIZER */}

        <section className="content-card optimizer-card">

          <div>
            <div className="step-label">
              AI OPTIMIZER
            </div>

            <h2>
              Optimize your product
            </h2>

            <p className="section-description">
              Select an imported Shopify
              product or enter product
              information manually.
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

        {/* INPUT */}

        <section className="content-card">

          <div className="result-field first-field">

            <div className="field-header">
              <label>
                Product title *
              </label>
            </div>

            <input
              className="search-input"
              value={title}
              onChange={(e) => {
                setTitle(
                  e.target.value
                );
                setSavedToShopify(false);
              }}
              placeholder="Enter product title"
            />

          </div>

          <div className="result-field">

            <div className="field-header">
              <label>
                Description
              </label>
            </div>

            <textarea
              className="search-input textarea"
              value={description}
              onChange={(e) => {
                setDescription(
                  e.target.value
                );
                setSavedToShopify(false);
              }}
              placeholder="Current product description"
            />

          </div>

          <div className="input-grid">

            <input
              className="search-input"
              value={productType}
              onChange={(e) => {
                setProductType(
                  e.target.value
                );
                setSavedToShopify(false);
              }}
              placeholder="Product type"
            />

            <input
              className="search-input"
              value={vendor}
              onChange={(e) => {
                setVendor(
                  e.target.value
                );
                setSavedToShopify(false);
              }}
              placeholder="Brand / supplier"
            />

            <input
              className="search-input"
              value={price}
              onChange={(e) => {
                setPrice(
                  e.target.value
                );
                setSavedToShopify(false);
              }}
              placeholder="Price"
            />

          </div>

        </section>

        {/* RESULTS */}

        {result && (
          <>

            <section className="score-overview">

              <div>
                <div className="step-label light">
                  VIRELLO SCORE
                </div>

                <h2>
                  Product optimization
                </h2>

                <p>
                  Listing quality, SEO,
                  clarity and conversion
                  potential.
                </p>
              </div>

              <div className="overall-score">

                <strong>
                  {result.score?.overall ??
                    0}
                </strong>

                <span>
                  / 100
                </span>

              </div>

            </section>

            {result.analysis && (
              <section className="content-card">

                <div className="step-label">
                  PRODUCT INTELLIGENCE
                </div>

                <h2>
                  AI analysis
                </h2>

                <div className="analysis-grid">

                  {result.analysis
                    .targetCustomer && (
                    <div className="analysis-item">
                      <strong>
                        Target customer
                      </strong>

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
                    <div className="analysis-item">
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

                </div>

              </section>
            )}

            {optimization && (
              <section className="content-card">

                <div className="step-label">
                  AI OPTIMIZATION
                </div>

                <h2>
                  Optimized listing
                </h2>

                <div className="result-field">

                  <div className="field-header">
                    <label>
                      Optimized title
                    </label>

                    <button
                      type="button"
                      className="copy-button"
                      onClick={() =>
                        copyText(
                          optimization.title
                        )
                      }
                    >
                      Copy
                    </button>
                  </div>

                  <div className="result-box">
                    {optimization.title ||
                      ""}
                  </div>

                </div>

                <div className="result-field">

                  <div className="field-header">
                    <label>
                      Product type
                    </label>
                  </div>

                  <div className="result-box">
                    {optimization.productType ||
                      ""}
                  </div>

                </div>

                <div className="result-field">

                  <div className="field-header">
                    <label>
                      Description
                    </label>

                    <button
                      type="button"
                      className="copy-button"
                      onClick={() =>
                        copyText(
                          optimization.description
                        )
                      }
                    >
                      Copy
                    </button>
                  </div>

                  <div className="result-box multiline">
                    {optimization.description ||
                      ""}
                  </div>

                </div>

                {optimization.features &&
                  optimization.features.length >
                    0 && (
                    <div className="result-field">

                      <div className="field-header">
                        <label>
                          Features
                        </label>

                        <button
                          type="button"
                          className="copy-button"
                          onClick={() =>
                            copyText(
                              listToText(
                                optimization.features
                              )
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="result-box multiline">
                        {listToText(
                          optimization.features
                        )}
                      </div>

                    </div>
                  )}

                {optimization.specifications &&
                  optimization.specifications.length >
                    0 && (
                    <div className="result-field">

                      <div className="field-header">
                        <label>
                          Specifications
                        </label>

                        <button
                          type="button"
                          className="copy-button"
                          onClick={() =>
                            copyText(
                              listToText(
                                optimization.specifications
                              )
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="result-box multiline">
                        {listToText(
                          optimization.specifications
                        )}
                      </div>

                    </div>
                  )}

              </section>
            )}

            {optimization && (
              <section className="content-card">

                <div className="step-label">
                  SEO
                </div>

                <h2>
                  Search optimization
                </h2>

                <div className="result-field">

                  <div className="field-header">
                    <label>
                      SEO title
                    </label>

                    <span>
                      {
                        (
                          optimization.seoTitle ||
                          ""
                        ).length
                      } / 60
                    </span>
                  </div>

                  <div className="result-box">
                    {
                      optimization.seoTitle ||
                      ""
                    }
                  </div>

                </div>

                <div className="result-field">

                  <div className="field-header">
                    <label>
                      Meta description
                    </label>

                    <span>
                      {
                        (
                          optimization.metaDescription ||
                          ""
                        ).length
                      } / 160
                    </span>
                  </div>

                  <div className="result-box multiline">
                    {
                      optimization.metaDescription ||
                      ""
                    }
                  </div>

                </div>

                {optimization.tags &&
                  optimization.tags.length >
                    0 && (
                    <div className="result-field">

                      <div className="field-header">
                        <label>
                          Tags
                        </label>
                      </div>

                      <div className="tags">
                        {optimization.tags.map(
                          (tag) => (
                            <span
                              key={tag}
                              className="tag"
                            >
                              {tag}
                            </span>
                          )
                        )}
                      </div>

                    </div>
                  )}

              </section>
            )}

            {optimization && (
              <section className="save-card">

                <div>
                  <div className="step-label light">
                    SHOPIFY
                  </div>

                  <h2>
                    Apply optimization
                  </h2>

                  <p>
                    Save the optimized
                    product content directly
                    to your Shopify store.
                  </p>
                </div>

                <button
                  type="button"
                  className="save-button"
                  onClick={saveToShopify}
                  disabled={
                    saving ||
                    savedToShopify
                  }
                >
                  {savedToShopify
                    ? "Saved to Shopify"
                    : saving
                    ? "Saving..."
                    : "Save to Shopify"}
                </button>

              </section>
            )}

          </>
        )}

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
    background: #f5f6f7;
    color: #111318;
  }

  .topbar {
    min-height: 72px;
    padding: 12px 34px;
    background: #fff;
    border-bottom: 1px solid #e4e6e9;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .brand-small {
    color: #9a9fa6;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .16em;
  }

  .brand-name {
    margin-top: 3px;
    font-size: 18px;
    line-height: 1.1;
    font-weight: 850;
    letter-spacing: -.025em;
  }

  .subscribe-button {
    min-height: 42px;
    padding: 0 19px;
    border: 0;
    border-radius: 9px;
    background: #111318;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .subscribe-button:disabled {
    opacity: .55;
    cursor: wait;
  }

  .hero {
    background: #fff;
    border-bottom: 1px solid #e4e6e9;
  }

  .hero-inner {
    max-width: 1020px;
    margin: 0 auto;
    padding: 52px 34px 48px;
  }

  .eyebrow,
  .step-label {
    color: #92979e;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 850;
    letter-spacing: .16em;
  }

  .hero h1 {
    max-width: 780px;
    margin: 13px 0 16px;
    font-size: clamp(40px, 6vw, 62px);
    line-height: .99;
    letter-spacing: -.055em;
    font-weight: 900;
  }

  .hero h1 span {
    color: #969ca4;
  }

  .hero p {
    max-width: 720px;
    margin: 0;
    color: #747a82;
    font-size: 16px;
    line-height: 1.6;
  }

  .workspace {
    max-width: 1020px;
    margin: 0 auto;
    padding: 26px 22px 60px;
  }

  .alert {
    margin-bottom: 16px;
    padding: 12px 15px;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.5;
  }

  .alert.error {
    border: 1px solid #e5cccc;
    background: #fffafa;
    color: #984d4d;
  }

  .alert.success {
    border: 1px solid #d6ded8;
    background: #fbfdfb;
    color: #526459;
  }

  .content-card {
    margin-bottom: 16px;
    padding: 29px;
    border: 1px solid #dfe2e6;
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 8px 25px rgba(17, 19, 24, .035);
  }

  .connection-card {
    margin-bottom: 16px;
  }

  .content-card h2 {
    margin: 10px 0 8px;
    font-size: 27px;
    line-height: 1.12;
    letter-spacing: -.035em;
  }

  .section-description {
    max-width: 680px;
    margin: 0 0 22px;
    color: #777d85;
    font-size: 14px;
    line-height: 1.6;
  }

  .generate-button {
    min-height: 52px;
    padding: 0 22px;
    border: 0;
    border-radius: 9px;
    background: #111318;
    color: #fff;
    font-size: 12px;
    font-weight: 850;
    cursor: pointer;
  }

  .generate-button:hover,
  .save-button:hover {
    background: #292d34;
  }

  .generate-button:disabled {
    opacity: .5;
    cursor: wait;
  }

  .full-button {
    width: 100%;
  }

  .small-button {
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid #d9dce0;
    border-radius: 9px;
    background: #fff;
    color: #646a72;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }

  .small-button:hover {
    background: #f7f7f8;
  }

  .import-button {
    margin-top: 12px;
  }

  .small-button:disabled {
    opacity: .55;
    cursor: wait;
  }

  .connection-status {
    min-height: 52px;
    padding: 0 16px;
    border: 1px solid #dfe2e6;
    border-radius: 9px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #747a82;
    font-size: 12px;
    font-weight: 700;
  }

  .spinner {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    border: 2px solid #e3e5e8;
    border-top-color: #111318;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  .connected-box {
    min-height: 62px;
    padding: 10px 15px;
    border: 1px solid #dfe2e6;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fbfcfb;
  }

  .connected-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #111318;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    font-weight: 700;
  }

  .connected-box strong {
    display: block;
    font-size: 12px;
  }

  .connected-box span {
    display: block;
    margin-top: 3px;
    color: #777d85;
    font-size: 10px;
  }

  .product-list {
    margin-top: 20px;
    display: grid;
    gap: 8px;
  }

  .product-card {
    width: 100%;
    padding: 14px 15px;
    border: 1px solid #e0e2e5;
    border-radius: 9px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    text-align: left;
    cursor: pointer;
  }

  .product-card:hover {
    background: #fafafa;
  }

  .selected-product-card {
    border-color: #111318;
    background: #fafafa;
  }

  .product-main {
    min-width: 0;
  }

  .product-main strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }

  .product-main span {
    display: block;
    margin-top: 4px;
    color: #858b92;
    font-size: 10px;
  }

  .product-price {
    flex: 0 0 auto;
    color: #111318;
    font-size: 11px;
    font-weight: 800;
  }

  .optimizer-card {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 25px;
  }

  .search-input {
    width: 100%;
    min-height: 48px;
    padding: 12px 14px;
    border: 1px solid #d9dce0;
    border-radius: 9px;
    outline: none;
    background: #fafafa;
    color: #111318;
    font-family: inherit;
    font-size: 13px;
  }

  .search-input:focus {
    border-color: #aeb3b9;
    background: #fff;
  }

  .textarea {
    min-height: 150px;
    resize: vertical;
    line-height: 1.6;
  }

  .result-field {
    margin-top: 19px;
  }

  .first-field {
    margin-top: 0;
  }

  .field-header {
    min-height: 22px;
    margin-bottom: 7px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .field-header label {
    color: #4d535b;
    font-size: 11px;
    font-weight: 800;
  }

  .field-header span {
    color: #8a9097;
    font-size: 10px;
  }

  .input-grid {
    margin-top: 16px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .score-overview {
    margin-bottom: 16px;
    padding: 27px 29px;
    border-radius: 17px;
    background: #111318;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 25px;
  }

  .step-label.light {
    color: #a4a8ae;
  }

  .score-overview h2 {
    margin: 9px 0 6px;
    font-size: 25px;
    line-height: 1.15;
    letter-spacing: -.035em;
  }

  .score-overview p {
    margin: 0;
    color: #a4a8ae;
    font-size: 12px;
    line-height: 1.5;
  }

  .overall-score {
    flex: 0 0 auto;
    display: flex;
    align-items: baseline;
  }

  .overall-score strong {
    font-size: 50px;
    line-height: 1;
    letter-spacing: -.05em;
  }

  .overall-score span {
    margin-left: 3px;
    color: #a4a8ae;
    font-size: 12px;
  }

  .analysis-grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .analysis-item {
    padding: 17px;
    border: 1px solid #e3e5e8;
    border-radius: 10px;
    background: #fafafa;
  }

  .analysis-item strong {
    display: block;
    font-size: 11px;
  }

  .analysis-item p {
    margin: 7px 0 0;
    color: #747a82;
    font-size: 11px;
    line-height: 1.6;
  }

  .result-box {
    min-height: 48px;
    padding: 13px 14px;
    border: 1px solid #e0e2e5;
    border-radius: 9px;
    background: #fafafa;
    color: #17191d;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .multiline {
    min-height: 100px;
  }

  .copy-button {
    padding: 5px 9px;
    border: 1px solid #d9dce0;
    border-radius: 6px;
    background: #fff;
    color: #656b73;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
  }

  .copy-button:hover {
    background: #f5f5f6;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .tag {
    padding: 7px 10px;
    border-radius: 999px;
    background: #f0f1f2;
    color: #5e646c;
    font-size: 10px;
    font-weight: 700;
  }

  .save-card {
    margin-bottom: 16px;
    padding: 27px 29px;
    border-radius: 17px;
    background: #111318;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 25px;
  }

  .save-card h2 {
    margin: 9px 0 6px;
    font-size: 24px;
    line-height: 1.15;
    letter-spacing: -.035em;
  }

  .save-card p {
    max-width: 600px;
    margin: 0;
    color: #a4a8ae;
    font-size: 12px;
    line-height: 1.6;
  }

  .save-button {
    min-height: 50px;
    padding: 0 22px;
    border: 0;
    border-radius: 9px;
    background: #fff;
    color: #111318;
    font-size: 11px;
    font-weight: 850;
    cursor: pointer;
  }

  .save-button:hover {
    background: #eeeeef;
  }

  .save-button:disabled {
    opacity: .55;
    cursor: default;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {

    .topbar {
      min-height: 66px;
      padding: 10px 17px;
    }

    .brand-name {
      font-size: 15px;
    }

    .subscribe-button {
      min-height: 38px;
      padding: 0 15px;
      font-size: 10px;
    }

    .hero-inner {
      padding: 40px 22px 38px;
    }

    .hero h1 {
      margin-top: 12px;
      font-size: 38px;
      line-height: .99;
    }

    .hero p {
      font-size: 13px;
      line-height: 1.65;
    }

    .workspace {
      padding: 18px 14px 35px;
    }

    .content-card {
      padding: 22px;
      border-radius: 14px;
    }

    .content-card h2 {
      font-size: 23px;
    }

    .section-description {
      font-size: 13px;
    }

    .optimizer-card {
      display: block;
    }

    .optimizer-card .generate-button {
      width: 100%;
      margin-top: 17px;
    }

    .input-grid {
      grid-template-columns: 1fr;
    }

    .score-overview {
      padding: 22px;
      border-radius: 14px;
    }

    .score-overview h2 {
      font-size: 22px;
    }

    .overall-score strong {
      font-size: 40px;
    }

    .analysis-grid {
      grid-template-columns: 1fr;
    }

    .save-card {
      display: block;
      padding: 22px;
      border-radius: 14px;
    }

    .save-button {
      width: 100%;
      margin-top: 18px;
    }

  }

  @media (max-width: 430px) {

    .hero h1 {
      font-size: 35px;
    }

    .overall-score strong {
      font-size: 35px;
    }

    .content-card {
      padding: 20px;
    }

    .product-card {
      padding: 12px;
    }

  }
`;