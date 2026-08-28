"use client";

import { useEffect, useState } from "react";

type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "wix";

type Product = {
  id: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  price?: string;
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
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "bigcommerce", label: "BigCommerce" },
  { value: "wix", label: "Wix" },
];

export default function Home() {
  const [platform, setPlatform] =
    useState<Platform>("shopify");

  const [products, setProducts] =
    useState<Product[]>([]);

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

  const [loading, setLoading] =
    useState(false);

  const [productsLoading, setProductsLoading] =
    useState(false);

  const [checkoutLoading, setCheckoutLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const value = params.get("platform");

    if (
      value === "shopify" ||
      value === "woocommerce" ||
      value === "bigcommerce" ||
      value === "wix"
    ) {
      setPlatform(value);
    }
  }, []);

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

  function connectStore() {
    setError("");
    setMessage("");

    window.location.href =
      `/connect?platform=${platform}`;
  }

  async function loadProducts() {
    setProductsLoading(true);
    setError("");
    setMessage("");

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

      const imported =
        Array.isArray(data.products)
          ? data.products
          : [];

      setProducts(imported);

      setMessage(
        imported.length
          ? `${imported.length} products loaded successfully.`
          : "No products were returned from the connected store."
      );
    } catch (err) {
      setProducts([]);

      setError(
        err instanceof Error
          ? err.message
          : `Unable to load ${platform} products.`
      );
    } finally {
      setProductsLoading(false);
    }
  }

  function selectProduct(product: Product) {
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

  async function optimize() {
    if (!title.trim()) {
      setError(
        "Enter a product title first."
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
              id:
                selectedProductId || null,
              title: title.trim(),
              description:
                description.trim(),
              productType:
                productType.trim(),
              vendor: vendor.trim(),
              price: price.trim(),
              platform,
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

  async function copyText(
    value?: string
  ) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        value
      );
      setMessage("Copied.");
    } catch {
      setError("Unable to copy text.");
    }
  }

  function listToText(
    items?: string[]
  ) {
    return items?.length
      ? items.join("\n")
      : "";
  }

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

          <div className="shop-pill">
            All Ecommerce
          </div>

          <button
            type="button"
            className="subscribe-button"
            onClick={startCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading
              ? "Opening checkout..."
              : "Subscribe to Virello"}
          </button>

        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">

          <div className="eyebrow">
            AI PRODUCT INTELLIGENCE
          </div>

          <h1>
            Optimize your ecommerce
            products{" "}
            <span>with AI.</span>
          </h1>

          <p>
            Connect your ecommerce store,
            import products and create
            conversion-focused listings,
            SEO content and product
            intelligence with Virello AI.
          </p>

        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid">

          <section className="optimizer-panel">

            {error && (
              <div className="alert error">
                {error}
              </div>
            )}

            {message && !error && (
              <div className="alert">
                {message}
              </div>
            )}

            {/* STORE CONNECTION */}

            <div className="content-card">

              <div className="step-label">
                STORE CONNECTION
              </div>

              <h2>
                Connect your ecommerce store
              </h2>

              <p>
                Virello supports multiple
                ecommerce platforms for
                subscriber accounts.
              </p>

              <div
                className="score-grid"
                style={{
                  marginTop: 20,
                }}
              >

                <select
                  className="search-input"
                  value={platform}
                  onChange={(e) => {
                    setPlatform(
                      e.target.value as Platform
                    );
                    setProducts([]);
                    setSelectedProductId("");
                    setResult(null);
                  }}
                >
                  {platforms.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="generate-button"
                  onClick={connectStore}
                >
                  Connect Store
                </button>

              </div>

              <button
                type="button"
                className="small-button"
                onClick={loadProducts}
                disabled={productsLoading}
                style={{
                  marginTop: 15,
                }}
              >
                {productsLoading
                  ? "Loading products..."
                  : `Import ${platforms.find(
                      (item) =>
                        item.value === platform
                    )?.label} Products`}
              </button>

            </div>

            {/* PRODUCTS */}

            {products.length > 0 && (
              <div className="content-card">

                <div className="step-label">
                  IMPORTED PRODUCTS
                </div>

                <h2>
                  Select a product
                </h2>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    marginTop: 20,
                  }}
                >

                  {products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        selectProduct(product)
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: 16,
                        border:
                          selectedProductId ===
                          product.id
                            ? "2px solid #111"
                            : "1px solid #ddd",
                        borderRadius: 12,
                        background:
                          selectedProductId ===
                          product.id
                            ? "#f5f5f5"
                            : "#fff",
                        cursor: "pointer",
                      }}
                    >

                      <strong>
                        {product.title ||
                          "Untitled product"}
                      </strong>

                      {product.vendor && (
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 13,
                            opacity: 0.65,
                          }}
                        >
                          {product.vendor}
                        </div>
                      )}

                      {product.price && (
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 14,
                          }}
                        >
                          {product.price}
                        </div>
                      )}

                    </button>
                  ))}

                </div>

              </div>
            )}

            {/* OPTIMIZER */}

            <div className="selected-product">

              <div>

                <div className="step-label">
                  AI OPTIMIZER
                </div>

                <h2>
                  Optimize your product
                </h2>

                <p>
                  Import a product or enter
                  the product information
                  manually.
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

            </div>

            {/* INPUT */}

            <div className="content-card">

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
                    setTitle(e.target.value)
                  }
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
                  className="search-input"
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  placeholder="Current product description"
                />

              </div>

              <div className="score-grid">

                <input
                  className="search-input"
                  value={productType}
                  onChange={(e) =>
                    setProductType(
                      e.target.value
                    )
                  }
                  placeholder="Product type"
                />

                <input
                  className="search-input"
                  value={vendor}
                  onChange={(e) =>
                    setVendor(
                      e.target.value
                    )
                  }
                  placeholder="Brand / supplier"
                />

                <input
                  className="search-input"
                  value={price}
                  onChange={(e) =>
                    setPrice(
                      e.target.value
                    )
                  }
                  placeholder="Price"
                />

              </div>

            </div>

            {/* RESULTS */}

            {result && (
              <>

                <div className="score-overview">

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
                      /100
                    </span>

                  </div>

                </div>

                <div className="score-grid">

                  {[
                    [
                      "Title",
                      result.score?.title,
                    ],
                    [
                      "Description",
                      result.score?.description,
                    ],
                    [
                      "SEO",
                      result.score?.seo,
                    ],
                    [
                      "Clarity",
                      result.score?.productClarity,
                    ],
                    [
                      "Conversion",
                      result.score
                        ?.conversionPotential,
                    ],
                  ].map(([label, value]) => {

                    const score =
                      typeof value ===
                      "number"
                        ? value
                        : 0;

                    return (
                      <div
                        className="score-card"
                        key={String(label)}
                      >

                        <div className="score-header">

                          <span>
                            {label}
                          </span>

                          <strong>
                            {score}/100
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
                  })}

                </div>

                <div className="content-card">

                  <div className="step-label">
                    OPTIMIZED LISTING
                  </div>

                  <h2>
                    Ready-to-use content
                  </h2>

                  {[
                    [
                      "Product title",
                      result.optimization?.title,
                    ],
                    [
                      "Product type",
                      result.optimization?.productType,
                    ],
                    [
                      "Product description",
                      result.optimization?.description,
                    ],
                    [
                      "Features",
                      listToText(
                        result.optimization
                          ?.features
                      ),
                    ],
                    [
                      "Specifications",
                      listToText(
                        result.optimization
                          ?.specifications
                      ),
                    ],
                    [
                      "SEO title",
                      result.optimization?.seoTitle,
                    ],
                    [
                      "Meta description",
                      result.optimization
                        ?.metaDescription,
                    ],
                    [
                      "Tags",
                      result.optimization?.tags?.join(
                        ", "
                      ),
                    ],
                  ].map(([label, value]) => (

                    <div
                      className="result-field"
                      key={String(label)}
                    >

                      <div className="field-header">

                        <label>
                          {label}
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              String(
                                value || ""
                              )
                            )
                          }
                        >
                          Copy
                        </button>

                      </div>

                      <div
                        className={
                          String(value).includes(
                            "\n"
                          )
                            ? "field-value multiline"
                            : "field-value"
                        }
                      >
                        {value || "No output"}
                      </div>

                    </div>

                  ))}

                </div>

                {result.analysis && (
                  <div className="content-card">

                    <div className="step-label">
                      AI ANALYSIS
                    </div>

                    <h2>
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

                    {result.analysis
                      .strongestFeatures
                      ?.length && (
                      <div className="analysis-block">
                        <strong>
                          Strongest features
                        </strong>
                        <ul>
                          {result.analysis
                            .strongestFeatures
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <li
                                  key={index}
                                >
                                  {item}
                                </li>
                              )
                            )}
                        </ul>
                      </div>
                    )}

                    {result.analysis
                      .weaknesses
                      ?.length && (
                      <div className="analysis-block">
                        <strong>
                          Weaknesses
                        </strong>
                        <ul>
                          {result.analysis
                            .weaknesses
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <li
                                  key={index}
                                >
                                  {item}
                                </li>
                              )
                            )}
                        </ul>
                      </div>
                    )}

                    {result.analysis
                      .missingInformation
                      ?.length && (
                      <div className="analysis-block">
                        <strong>
                          Missing information
                        </strong>
                        <ul>
                          {result.analysis
                            .missingInformation
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <li
                                  key={index}
                                >
                                  {item}
                                </li>
                              )
                            )}
                        </ul>
                      </div>
                    )}

                    {result.analysis
                      .seoOpportunities
                      ?.length && (
                      <div className="analysis-block">
                        <strong>
                          SEO opportunities
                        </strong>
                        <ul>
                          {result.analysis
                            .seoOpportunities
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <li
                                  key={index}
                                >
                                  {item}
                                </li>
                              )
                            )}
                        </ul>
                      </div>
                    )}

                    {result.analysis
                      .conversionOpportunities
                      ?.length && (
                      <div className="analysis-block">
                        <strong>
                          Conversion opportunities
                        </strong>
                        <ul>
                          {result.analysis
                            .conversionOpportunities
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <li
                                  key={index}
                                >
                                  {item}
                                </li>
                              )
                            )}
                        </ul>
                      </div>
                    )}

                  </div>
                )}

                {result.reasoning && (
                  <div className="content-card">

                    <div className="step-label">
                      AI REASONING
                    </div>

                    <p className="reasoning-text">
                      {result.reasoning}
                    </p>

                  </div>
                )}

              </>
            )}

          </section>

        </div>
      </section>

    </main>
  );
}
