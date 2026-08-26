"use client";

import { useEffect, useState } from "react";

type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "wix";

type EcommerceProduct = {
  id: string;
  title: string;
  description?: string;
  productType?: string;
  tags?: string[];
  status?: string;
  vendor?: string;
  price?: string;
  images?: {
    url: string;
    altText?: string | null;
  }[];
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

const platforms: {
  value: Platform;
  label: string;
}[] = [
  {
    value: "shopify",
    label: "Shopify",
  },
  {
    value: "woocommerce",
    label: "WooCommerce",
  },
  {
    value: "bigcommerce",
    label: "BigCommerce",
  },
  {
    value: "wix",
    label: "Wix",
  },
];

export default function Home() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [vendor, setVendor] = useState("");
  const [price, setPrice] = useState("");

  const [result, setResult] =
    useState<AIResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [checkoutLoading, setCheckoutLoading] =
    useState(false);

  const [productsLoading, setProductsLoading] =
    useState(false);

  const [products, setProducts] =
    useState<EcommerceProduct[]>([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [platform, setPlatform] =
    useState<Platform>("shopify");

  const [storeConnected, setStoreConnected] =
    useState(false);

  const [error, setError] =
    useState("");

  const [productMessage, setProductMessage] =
    useState("");

  /*
   * CHECKOUT
   */
  async function startCheckout() {
    setCheckoutLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.url
      ) {
        throw new Error(
          data.error ||
            "Unable to start subscription checkout."
        );
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start subscription checkout."
      );

      setCheckoutLoading(false);
    }
  }

  /*
   * CONNECT STORE
   *
   * The existing /app/connect route remains
   * responsible for the actual platform connection.
   */
  function connectStore() {
    setError("");
    setProductMessage("");

    window.location.href =
      `/connect?platform=${platform}`;
  }

  /*
   * LOAD PRODUCTS
   *
   * Uses the universal products endpoint:
   *
   * /api/stores/products?platform=...
   */
  async function loadProducts() {
    setProductsLoading(true);
    setError("");
    setProductMessage("");

    try {
      const response = await fetch(
        `/api/stores/products?platform=${platform}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            `Unable to load ${platform} products.`
        );
      }

      const loadedProducts =
        Array.isArray(data.products)
          ? data.products
          : [];

      setProducts(loadedProducts);
      setStoreConnected(true);

      if (!loadedProducts.length) {
        setProductMessage(
          "No products were returned from the connected store."
        );
      } else {
        setProductMessage(
          `${loadedProducts.length} products loaded.`
        );
      }
    } catch (err) {
      setStoreConnected(false);

      setError(
        err instanceof Error
          ? err.message
          : `Unable to load ${platform} products.`
      );
    } finally {
      setProductsLoading(false);
    }
  }

  /*
   * WHEN A PRODUCT IS SELECTED
   */
  function selectProduct(
    product: EcommerceProduct
  ) {
    setSelectedProductId(product.id);

    setTitle(product.title || "");
    setDescription(
      product.description || ""
    );
    setProductType(
      product.productType || ""
    );
    setVendor(product.vendor || "");
    setPrice(product.price || "");

    setResult(null);
    setError("");
  }

  /*
   * OPTIMIZE PRODUCT
   */
  async function optimize() {
    if (!title.trim()) {
      setError(
        "Select a product or enter a product title first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        "/api/ai/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            product: {
              title: title.trim(),
              description:
                description.trim(),
              productType:
                productType.trim(),
              vendor: vendor.trim(),
              price: price.trim(),
              platform,
              productId:
                selectedProductId || null,
            },
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "AI optimization failed."
        );
      }

      setResult(data.result);
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

  /*
   * COPY
   */
  async function copyText(
    value?: string
  ) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );
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
      ? items
          .map(
            (item) => `• ${item}`
          )
          .join("\n")
      : "";
  }

  /*
   * LOAD PRODUCTS AFTER PAGE LOAD
   *
   * This does not force Shopify.
   * It only attempts to load the selected
   * platform when the user has a connection.
   */
  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const connectedPlatform =
      params.get("platform");

    if (
      connectedPlatform === "shopify" ||
      connectedPlatform ===
        "woocommerce" ||
      connectedPlatform ===
        "bigcommerce" ||
      connectedPlatform === "wix"
    ) {
      setPlatform(
        connectedPlatform
      );
    }
  }, []);

  return (
    <main className="app-shell">

      {/* TOP BAR */}
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

          <div className="shop-pill">
            Ecommerce & Dropshipping
          </div>

          <button
            type="button"
            className="subscribe-button"
            onClick={
              startCheckout
            }
            disabled={
              checkoutLoading
            }
          >
            {checkoutLoading
              ? "Opening checkout..."
              : "Subscribe to Virello"}
          </button>

        </div>

      </header>

      {/* HERO */}
      <section className="hero">

        <div className="hero-inner">

          <div className="eyebrow">
            AI PRODUCT INTELLIGENCE
          </div>

          <h1>
            Optimize any ecommerce
            product{" "}
            <span>with AI.</span>
          </h1>

          <p>
            Create stronger product
            listings, SEO copy and
            conversion-focused content
            for ecommerce and
            dropshipping businesses.
          </p>

        </div>

      </section>

      {/* WORKSPACE */}
      <section className="workspace">

        <div className="workspace-grid">

          <section className="optimizer-panel">

            {/* STORE CONNECTION */}
            <div className="content-card">

              <div className="step-label">
                CONNECT YOUR STORE
              </div>

              <h2>
                Import your ecommerce
                products
              </h2>

              <p>
                Connect your store and
                bring your existing
                products into Virello.
              </p>

              <div
                className="score-grid"
                style={{
                  marginTop: "20px",
                }}
              >

                <select
                  className="search-input"
                  value={platform}
                  onChange={(e) =>
                    setPlatform(
                      e.target
                        .value as Platform
                    )
                  }
                >
                  {platforms.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>

                <button
                  type="button"
                  className="generate-button"
                  onClick={
                    connectStore
                  }
                >
                  Connect Store
                </button>

              </div>

              <button
                type="button"
                className="small-button"
                onClick={
                  loadProducts
                }
                disabled={
                  productsLoading
                }
                style={{
                  marginTop: "15px",
                }}
              >
                {productsLoading
                  ? "Loading products..."
                  : `Load ${platforms.find(
                      (item) =>
                        item.value ===
                        platform
                    )?.label || "Store"} Products`}
              </button>

              {productMessage && (
                <div
                  className="alert"
                  style={{
                    marginTop: "15px",
                  }}
                >
                  {productMessage}
                </div>
              )}

            </div>

            {/* PRODUCT LIST */}
            {products.length >
              0 && (
              <div className="content-card">

                <div className="step-label">
                  YOUR PRODUCTS
                </div>

                <h2>
                  Select a product
                </h2>

                <p>
                  Choose a product to
                  automatically fill the
                  optimizer.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    marginTop: "20px",
                  }}
                >

                  {products.map(
                    (product) => (
                      <button
                        type="button"
                        key={
                          product.id
                        }
                        onClick={() =>
                          selectProduct(
                            product
                          )
                        }
                        style={{
                          width:
                            "100%",
                          textAlign:
                            "left",
                          padding:
                            "16px",
                          border:
                            selectedProductId ===
                            product.id
                              ? "2px solid #111"
                              : "1px solid #ddd",
                          borderRadius:
                            "12px",
                          background:
                            selectedProductId ===
                            product.id
                              ? "#f5f5f5"
                              : "#fff",
                          cursor:
                            "pointer",
                        }}
                      >

                        <strong>
                          {product.title ||
                            "Untitled product"}
                        </strong>

                        {product.vendor && (
                          <div
                            style={{
                              marginTop:
                                "5px",
                              fontSize:
                                "13px",
                              opacity:
                                0.65,
                            }}
                          >
                            {product.vendor}
                          </div>
                        )}

                        {product.price && (
                          <div
                            style={{
                              marginTop:
                                "5px",
                              fontSize:
                                "14px",
                            }}
                          >
                            {product.price}
                          </div>
                        )}

                      </button>
                    )
                  )}

                </div>

              </div>
            )}

            {/* PRODUCT HEADER */}
            <div className="selected-product">

              <div>

                <div className="step-label">
                  PRODUCT INFORMATION
                </div>

                <h2>
                  Tell Virello about
                  your product
                </h2>

                <p>
                  Select an imported
                  product or add your
                  product details below.
                </p>

              </div>

              <button
                type="button"
                className="generate-button"
                onClick={
                  optimize
                }
                disabled={loading}
              >
                {loading
                  ? "Optimizing..."
                  : "Optimize with AI"}
              </button>

            </div>

            <div className="results">

              {/* ERROR */}
              {error && (
                <div className="alert error">
                  {error}
                </div>
              )}

              {/* PRODUCT FORM */}
              <div className="content-card">

                {/* PRODUCT TITLE */}
                <div className="result-field">

                  <div className="field-header">
                    <label>
                      Product title *
                    </label>
                  </div>

                  <input
                    className="search-input"
                    value={title}
                    onChange={(e) =>
                      setTitle(
                        e.target.value
                      )
                    }
                    placeholder="Example: Portable Mini Blender"
                  />

                </div>

                {/* DESCRIPTION */}
                <div className="result-field">

                  <div className="field-header">
                    <label>
                      Description
                      (optional)
                    </label>
                  </div>

                  <textarea
                    className="search-input"
                    value={
                      description
                    }
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    placeholder="Paste your current product description (optional)"
                  />

                </div>

                {/* OPTIONAL DETAILS */}
                <div className="score-grid">

                  <input
                    className="search-input"
                    value={
                      productType
                    }
                    onChange={(e) =>
                      setProductType(
                        e.target.value
                      )
                    }
                    placeholder="Product type (optional)"
                  />

                  <input
                    className="search-input"
                    value={vendor}
                    onChange={(e) =>
                      setVendor(
                        e.target.value
                      )
                    }
                    placeholder="Brand / supplier (optional)"
                  />

                  <input
                    className="search-input"
                    value={price}
                    onChange={(e) =>
                      setPrice(
                        e.target.value
                      )
                    }
                    placeholder="Price (optional)"
                  />

                </div>

              </div>

              {/* AI RESULTS */}
              {result && (
                <>

                  {/* OVERALL SCORE */}
                  <div className="score-overview">

                    <div>

                      <div className="step-label light">
                        VIRELLO SCORE
                      </div>

                      <h2>
                        Product
                        optimization
                        score
                      </h2>

                      <p>
                        Based on listing
                        quality, SEO,
                        clarity and
                        conversion
                        potential.
                      </p>

                    </div>

                    <div className="overall-score">

                      <strong>
                        {
                          result.score
                            ?.overall ??
                          0
                        }
                      </strong>

                      <span>
                        /100
                      </span>

                    </div>

                  </div>

                  {/* SCORE CARDS */}
                  <div className="score-grid">

                    {[
                      [
                        "Title",
                        result.score
                          ?.title,
                      ],
                      [
                        "Description",
                        result.score
                          ?.description,
                      ],
                      [
                        "SEO",
                        result.score
                          ?.seo,
                      ],
                      [
                        "Clarity",
                        result.score
                          ?.productClarity,
                      ],
                      [
                        "Conversion",
                        result.score
                          ?.conversionPotential,
                      ],
                    ].map(
                      ([
                        label,
                        value,
                      ]) => {

                        const score =
                          typeof value ===
                          "number"
                            ? value
                            : 0;

                        return (
                          <div
                            className="score-card"
                            key={String(
                              label
                            )}
                          >

                            <div className="score-header">

                              <span>
                                {label}
                              </span>

                              <strong>
                                {score}
                                /100
                              </strong>

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
                      }
                    )}

                  </div>

                  {/* OPTIMIZED LISTING */}
                  <div className="content-card">

                    <div className="card-title">

                      <div>

                        <div className="step-label">
                          OPTIMIZED
                          LISTING
                        </div>

                        <h2>
                          Ready-to-use
                          content
                        </h2>

                      </div>

                    </div>

                    {/* TITLE */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Product title
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              result
                                .optimization
                                ?.title
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div className="field-value">
                        {
                          result
                            .optimization
                            ?.title ||
                          "No output"
                        }
                      </div>

                    </div>

                    {/* PRODUCT TYPE */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Product type
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              result
                                .optimization
                                ?.productType
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div className="field-value">
                        {
                          result
                            .optimization
                            ?.productType ||
                          "No output"
                        }
                      </div>

                    </div>

                    {/* DESCRIPTION */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Product
                          description
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              result
                                .optimization
                                ?.description
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div className="field-value multiline">
                        {
                          result
                            .optimization
                            ?.description ||
                          "No output"
                        }
                      </div>

                    </div>

                    {/* FEATURES */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Features
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              listToText(
                                result
                                  .optimization
                                  ?.features
                              )
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div className="field-value multiline">
                        {listToText(
                          result
                            .optimization
                            ?.features
                        ) ||
                          "No output"}
                      </div>

                    </div>

                    {/* SPECIFICATIONS */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Specifications
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              listToText(
                                result
                                  .optimization
                                  ?.specifications
                              )
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div className="field-value multiline">
                        {listToText(
                          result
                            .optimization
                            ?.specifications
                        ) ||
                          "No output"}
                      </div>

                    </div>

                    {/* SEO TITLE */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          SEO title
                        </label>

                        <div className="field-actions">

                          <span className="character-count">
                            {
                              result
                                .optimization
                                ?.seoTitle
                                ?.length ??
                              0
                            }
                            /50
                          </span>

                          <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                              copyText(
                                result
                                  .optimization
                                  ?.seoTitle
                              )
                            }
                          >
                            Copy
                          </button>

                        </div>

                      </div>

                      <div className="field-value">
                        {
                          result
                            .optimization
                            ?.seoTitle ||
                          "No output"
                        }
                      </div>

                    </div>

                    {/* META DESCRIPTION */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Meta
                          description
                        </label>

                        <div className="field-actions">

                          <span className="character-count">
                            {
                              result
                                .optimization
                                ?.metaDescription
                                ?.length ??
                              0
                            }
                            /150
                          </span>

                          <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                              copyText(
                                result
                                  .optimization
                                  ?.metaDescription
                              )
                            }
                          >
                            Copy
                          </button>

                        </div>

                      </div>

                      <div className="field-value multiline">
                        {
                          result
                            .optimization
                            ?.metaDescription ||
                          "No output"
                        }
                      </div>

                    </div>

                    {/* TAGS */}
                    <div className="result-field">

                      <div className="field-header">

                        <label>
                          Tags
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              result
                                .optimization
                                ?.tags
                                ?.join(", ")
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div className="field-value multiline">
                        {
                          result
                            .optimization
                            ?.tags
                            ?.length
                            ? result
                                .optimization
                                .tags
                                .join(
                                  ", "
                                )
                            : "No output"
                        }
                      </div>

                    </div>

                  </div>

                  {/* AI ANALYSIS */}
                  {result.analysis && (
                    <div className="content-card">

                      <div className="step-label">
                        AI ANALYSIS
                      </div>

                      <h2 className="analysis-title">
                        What Virello found
                      </h2>

                      {result.analysis
                        .targetCustomer && (
                        <div className="analysis-block">

                          <strong>
                            Target customer
                          </strong>

                          <p>
                            {
                              result
                                .analysis
                                .targetCustomer
                            }
                          </p>

                        </div>
                      )}

                      {result.analysis
                        .purchaseMotivation && (
                        <div className="analysis-block">

                          <strong>
                            Purchase
                            motivation
                          </strong>

                          <p>
                            {
                              result
                                .analysis
                                .purchaseMotivation
                            }
                          </p>

                        </div>
                      )}

                      {result.analysis
                        .strongestFeatures
                        ?.length ? (
                        <div className="analysis-block">

                          <strong>
                            Strongest
                            features
                          </strong>

                          <ul>
                            {result
                              .analysis
                              .strongestFeatures
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                          </ul>

                        </div>
                      ) : null}

                      {result.analysis
                        .weaknesses
                        ?.length ? (
                        <div className="analysis-block">

                          <strong>
                            Weaknesses
                          </strong>

                          <ul>
                            {result
                              .analysis
                              .weaknesses
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                          </ul>

                        </div>
                      ) : null}

                      {result.analysis
                        .missingInformation
                        ?.length ? (
                        <div className="analysis-block">

                          <strong>
                            Missing
                            information
                          </strong>

                          <ul>
                            {result
                              .analysis
                              .missingInformation
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                          </ul>

                        </div>
                      ) : null}

                      {result.analysis
                        .seoOpportunities
                        ?.length ? (
                        <div className="analysis-block">

                          <strong>
                            SEO
                            opportunities
                          </strong>

                          <ul>
                            {result
                              .analysis
                              .seoOpportunities
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
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
                            Conversion
                            opportunities
                          </strong>

                          <ul>
                            {result
                              .analysis
                              .conversionOpportunities
                              .map(
                                (
                                  item,
                                  index
                                ) => (
                                  <li
                                    key={
                                      index
                                    }
                                  >
                                    {item}
                                  </li>
                                )
                              )}
                          </ul>

                        </div>
                      ) : null}

                    </div>
                  )}

                  {/* AI REASONING */}
                  {result.reasoning && (
                    <div className="content-card">

                      <div className="step-label">
                        AI REASONING
                      </div>

                      <p className="reasoning-text">
                        {
                          result.reasoning
                        }
                      </p>

                    </div>
                  )}

                </>
              )}

            </div>

          </section>

        </div>

      </section>

    </main>
  );
                            }
