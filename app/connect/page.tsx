"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = {
  success?: boolean;
  connected?: boolean;
  platform?: string;
  shop?: string;
  error?: string;
};

type Product = {
  id: string | number;
  title: string;
  price?: string | number;
  image?: string;
};

type Optimization = {
  title: number;
  description: number;
  seo: number;
  clarity: number;
  conversion: number;
};

const fallbackProducts: Product[] = [
  {
    id: "1",
    title: "Luxury Chronograph Watch",
    price: "$199.00",
  },
  {
    id: "2",
    title: "Premium Automatic Watch",
    price: "$249.00",
  },
  {
    id: "3",
    title: "Classic Leather Watch",
    price: "$159.00",
  },
  {
    id: "4",
    title: "Stainless Steel Watch",
    price: "$189.00",
  },
  {
    id: "5",
    title: "Business Quartz Watch",
    price: "$129.00",
  },
];

export default function HomePage() {
  const [status, setStatus] =
    useState<ConnectionStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [products, setProducts] =
    useState<Product[]>(fallbackProducts);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(fallbackProducts[0]);

  const [productTitle, setProductTitle] = useState(
    fallbackProducts[0].title
  );

  const [description, setDescription] = useState(
    "Premium watch designed for everyday wear with a refined look and reliable performance."
  );

  const [productType, setProductType] =
    useState("Watch");

  const [brand, setBrand] =
    useState("");

  const [price, setPrice] =
    useState("199.00");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [scores, setScores] =
    useState<Optimization>({
      title: 88,
      description: 84,
      seo: 82,
      clarity: 86,
      conversion: 86,
    });

  useEffect(() => {
    checkShopifyConnection();
  }, []);

  async function checkShopifyConnection() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/shopify/status",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (response.ok && data?.connected) {
        setStatus({
          ...data,
          connected: true,
          platform: "shopify",
        });
      } else {
        setStatus({
          connected: false,
          platform: "shopify",
        });
      }
    } catch (err) {
      console.error(
        "SHOPIFY_CONNECTION_STATUS_ERROR:",
        err
      );

      setStatus({
        connected: false,
        platform: "shopify",
      });
    } finally {
      setLoading(false);
    }
  }

  function connectShopify() {
    if (connecting) return;

    setConnecting(true);
    setError("");

    window.location.assign(
      "/api/shopify/connect"
    );
  }

  async function importShopifyProducts() {
    setImporting(true);
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

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to import Shopify products."
        );
      }

      const imported =
        data?.products ||
        data?.data?.products ||
        [];

      if (Array.isArray(imported) && imported.length) {
        const normalized: Product[] =
          imported.map(
            (item: any, index: number) => ({
              id:
                item.id ??
                item.product_id ??
                index,
              title:
                item.title ??
                "Untitled Product",
              price:
                item.price ??
                item.variants?.[0]?.price ??
                "",
              image:
                item.image ??
                item.images?.[0]?.src ??
                "",
            })
          );

        setProducts(normalized);
        setSelectedProduct(normalized[0]);

        setProductTitle(
          normalized[0].title
        );

        setPrice(
          String(normalized[0].price || "")
        );

        setMessage(
          "Products loaded successfully."
        );
      } else {
        setMessage(
          "Shopify is connected. No products were returned."
        );
      }
    } catch (err) {
      console.error(
        "SHOPIFY_IMPORT_ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to import Shopify products."
      );
    } finally {
      setImporting(false);
    }
  }

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductTitle(product.title);
    setPrice(String(product.price || ""));
    setMessage("");
    setError("");
  }

  async function optimizeProduct() {
    if (optimizing) return;

    setOptimizing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai/optimize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            product: {
              id: selectedProduct?.id,
              title: productTitle,
              description,
              productType,
              brand,
              price,
            },
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to optimize product."
        );
      }

      const optimized =
        data?.product ||
        data?.optimized ||
        data?.data;

      if (optimized?.title) {
        setProductTitle(
          optimized.title
        );
      }

      if (optimized?.description) {
        setDescription(
          optimized.description
        );
      }

      if (optimized?.productType) {
        setProductType(
          optimized.productType
        );
      }

      if (optimized?.brand) {
        setBrand(
          optimized.brand
        );
      }

      if (optimized?.price) {
        setPrice(
          String(optimized.price)
        );
      }

      if (data?.scores) {
        setScores({
          title:
            Number(data.scores.title) || 88,
          description:
            Number(data.scores.description) || 84,
          seo:
            Number(data.scores.seo) || 82,
          clarity:
            Number(data.scores.clarity) || 86,
          conversion:
            Number(data.scores.conversion) || 86,
        });
      }

      setMessage(
        "Product optimized successfully."
      );
    } catch (err) {
      console.error(
        "AI_OPTIMIZATION_ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to optimize product."
      );
    } finally {
      setOptimizing(false);
    }
  }

  async function saveToShopify() {
    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/shopify/products",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            id: selectedProduct?.id,
            title: productTitle,
            description,
            productType,
            brand,
            price,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save product to Shopify."
        );
      }

      setMessage(
        "Changes saved to Shopify."
      );
    } catch (err) {
      console.error(
        "SHOPIFY_SAVE_ERROR:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save product to Shopify."
      );
    } finally {
      setSaving(false);
    }
  }

  async function startCheckout() {
    setError("");

    try {
      const response = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response
        .json()
        .catch(() => null);

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
    }
  }

  const connected =
    status?.connected === true;

  const averageScore = Math.round(
    (
      scores.title +
      scores.description +
      scores.seo +
      scores.clarity +
      scores.conversion
    ) / 5
  );

  return (
    <main className="page-shell">
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
        >
          Subscribe
        </button>
      </header>

      {error && (
        <div className="message error">
          {error}
        </div>
      )}

      {message && (
        <div className="message success">
          {message}
        </div>
      )}

      {loading ? (
        <section className="loading-section">
          <div className="loading-card">
            <div className="spinner" />
            <span>
              Checking Shopify connection...
            </span>
          </div>
        </section>
      ) : (
        <>
          {connected ? (
            <section className="connected-banner">
              <div className="connected-check">
                ✓
              </div>

              <div className="connected-copy">
                <div className="connected-label">
                  SHOPIFY CONNECTED
                </div>

                <h1>
                  Your Shopify store is{" "}
                  <span>connected.</span>
                </h1>

                <p>
                  Your Shopify store has been
                  successfully connected to
                  Virello AI Optimizer.
                </p>
              </div>

              <div className="connected-store">
                <div className="shopify-logo">
                  S
                </div>

                <div>
                  <div className="store-caption">
                    Connected Store
                  </div>

                  <strong>
                    {status?.shop ||
                      "Shopify Store"}
                  </strong>

                  <div className="connected-tag">
                    <span>●</span>
                    Connected
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="not-connected-banner">
              <div>
                <div className="connected-label">
                  SHOPIFY
                </div>

                <h1>
                  Connect your Shopify store
                </h1>

                <p>
                  Connect Shopify to import and
                  optimize your products with AI.
                </p>
              </div>

              <button
                type="button"
                onClick={connectShopify}
                disabled={connecting}
              >
                {connecting
                  ? "Connecting..."
                  : "Connect Shopify"}
              </button>
            </section>
          )}

          <section className="dashboard">
            <div className="left-column">
              <div className="card">
                <div className="card-label">
                  SHOPIFY CONNECTION
                </div>

                <h2>
                  Connect your Shopify store
                </h2>

                <p>
                  Connect your Shopify store to
                  import products and optimize
                  them with Virello AI.
                </p>

                <div className="connection-status">
                  <div className="status-icon">
                    {connected ? "✓" : "!"}
                  </div>

                  <div>
                    <strong>
                      {connected
                        ? "Shopify Connected"
                        : "Shopify Not Connected"}
                    </strong>

                    <span>
                      {connected
                        ? "Your store is connected"
                        : "Connect your store to continue"}
                    </span>
                  </div>

                  {connected && (
                    <span className="status-check">
                      ✓
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    connected
                      ? checkShopifyConnection
                      : connectShopify
                  }
                  disabled={connecting}
                >
                  {connected
                    ? "Refresh Connection"
                    : connecting
                    ? "Connecting..."
                    : "Connect Shopify"}
                </button>
              </div>

              <div className="card import-card">
                <div className="card-label">
                  IMPORT PRODUCTS
                </div>

                <h2>
                  Import your products
                </h2>

                <p>
                  Import your products from your
                  Shopify store.
                </p>

                <button
                  type="button"
                  className="dark-button"
                  onClick={importShopifyProducts}
                  disabled={
                    importing || !connected
                  }
                >
                  {importing
                    ? "Importing..."
                    : "⇩  Import Shopify Products"}
                </button>

                <div className="import-status">
                  <span>✓</span>
                  <div>
                    <strong>
                      {products.length} products
                    </strong>
                    <small>
                      {connected
                        ? "Ready to optimize"
                        : "Connect Shopify first"}
                    </small>
                  </div>
                </div>
              </div>
            </div>

            <div className="center-column">
              <div className="card optimizer-card">
                <div className="card-label">
                  AI OPTIMIZER
                </div>

                <h2>
                  Optimize your product
                </h2>

                <p>
                  Select an imported Shopify
                  product or enter product
                  information manually.
                </p>

                <label>
                  Product title *
                </label>

                <input
                  value={productTitle}
                  onChange={(e) =>
                    setProductTitle(
                      e.target.value
                    )
                  }
                  placeholder="Enter product title"
                />

                <label>
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  placeholder="Enter product description"
                  rows={5}
                />

                <div className="field-grid">
                  <div>
                    <label>
                      Product type
                    </label>

                    <input
                      value={productType}
                      onChange={(e) =>
                        setProductType(
                          e.target.value
                        )
                      }
                      placeholder="Enter type"
                    />
                  </div>

                  <div>
                    <label>
                      Brand / Supplier
                    </label>

                    <input
                      value={brand}
                      onChange={(e) =>
                        setBrand(
                          e.target.value
                        )
                      }
                      placeholder="Enter brand"
                    />
                  </div>

                  <div>
                    <label>
                      Price
                    </label>

                    <input
                      value={price}
                      onChange={(e) =>
                        setPrice(
                          e.target.value
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="dark-button optimize-button"
                  onClick={optimizeProduct}
                  disabled={optimizing}
                >
                  {optimizing
                    ? "Optimizing..."
                    : "✦  Optimize with AI"}
                </button>
              </div>

              <div className="card results-card">
                <div className="card-label">
                  AI OPTIMIZATION RESULTS
                </div>

                <div className="results-row">
                  <div className="overall-score">
                    <span>
                      Virello Score
                    </span>

                    <strong>
                      {averageScore}
                      <small>/100</small>
                    </strong>
                  </div>

                  <Score
                    value={scores.title}
                    label="Title"
                  />

                  <Score
                    value={scores.description}
                    label="Description"
                  />

                  <Score
                    value={scores.seo}
                    label="SEO"
                  />

                  <Score
                    value={scores.clarity}
                    label="Clarity"
                  />

                  <Score
                    value={scores.conversion}
                    label="Conversion"
                  />
                </div>
              </div>
            </div>

            <div className="right-column">
              <div className="card products-card">
                <div className="products-heading">
                  <div>
                    <div className="card-label">
                      IMPORTED PRODUCTS
                    </div>

                    <p>
                      Select a product to optimize
                    </p>
                  </div>

                  <button
                    type="button"
                    className="refresh-button"
                    onClick={
                      importShopifyProducts
                    }
                  >
                    ↻
                  </button>
                </div>

                <div className="product-list">
                  {products
                    .slice(0, 5)
                    .map((product) => (
                      <button
                        type="button"
                        className={`product-item ${
                          selectedProduct?.id ===
                          product.id
                            ? "selected"
                            : ""
                        }`}
                        key={product.id}
                        onClick={() =>
                          selectProduct(
                            product
                          )
                        }
                      >
                        <div className="product-image">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt=""
                            />
                          ) : (
                            <span>⌚</span>
                          )}
                        </div>

                        <div className="product-info">
                          <strong>
                            {product.title}
                          </strong>

                          <span>
                            {product.price
                              ? `$${String(
                                  product.price
                                ).replace(
                                  /^\$/,
                                  ""
                                )}`
                              : "—"}
                          </span>
                        </div>

                        <div className="radio">
                          {selectedProduct?.id ===
                          product.id
                            ? "✓"
                            : ""}
                        </div>
                      </button>
                    ))}
                </div>

                <button
                  type="button"
                  className="view-button"
                  onClick={
                    importShopifyProducts
                  }
                >
                  View All Products
                </button>
              </div>

              <div className="card actions-card">
                <div className="card-label">
                  QUICK ACTIONS
                </div>

                <button
                  type="button"
                  className="action-item"
                  onClick={optimizeProduct}
                >
                  <div className="action-icon">
                    ✦
                  </div>

                  <div>
                    <strong>
                      Optimize Product
                    </strong>

                    <span>
                      Generate AI-optimized content
                    </span>
                  </div>

                  <b>›</b>
                </button>

                <button
                  type="button"
                  className="action-item"
                  onClick={saveToShopify}
                  disabled={saving}
                >
                  <div className="action-icon">
                    ↑
                  </div>

                  <div>
                    <strong>
                      {saving
                        ? "Saving..."
                        : "Save to Shopify"}
                    </strong>

                    <span>
                      Apply changes to your store
                    </span>
                  </div>

                  <b>›</b>
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

function Score({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="score">
      <div className="score-circle">
        {value}
      </div>

      <span>{label}</span>
    </div>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .page-shell {
    min-height: 100vh;
    background: #f4f5f6;
    color: #111318;
  }

  .topbar {
    min-height: 70px;
    padding: 12px 28px;
    background: #fff;
    border-bottom: 1px solid #e1e3e6;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .brand-small {
    color: #999ea5;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .17em;
  }

  .brand-name {
    margin-top: 3px;
    font-size: 18px;
    font-weight: 850;
    letter-spacing: -.035em;
  }

  .subscribe-button {
    min-height: 42px;
    padding: 0 22px;
    border: 0;
    border-radius: 10px;
    background: #111318;
    color: #fff;
    font-size: 12px;
    font-weight: 850;
    cursor: pointer;
  }

  .message {
    max-width: 1280px;
    margin: 12px auto 0;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 12px;
  }

  .message.error {
    background: #fff5f5;
    border: 1px solid #ebd0d0;
    color: #9a4d4d;
  }

  .message.success {
    background: #f1fbf3;
    border: 1px solid #ccebd2;
    color: #34844b;
  }

  .connected-banner {
    max-width: 1280px;
    margin: 22px auto 0;
    padding: 23px 28px;
    border: 1px solid #cfe8d4;
    border-radius: 14px;
    background: #f5fcf6;
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .connected-check {
    width: 58px;
    height: 58px;
    flex: 0 0 58px;
    border-radius: 50%;
    background: #31a852;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 31px;
    font-weight: 500;
  }

  .connected-copy {
    flex: 1;
    min-width: 0;
  }

  .connected-label,
  .card-label {
    color: #91969d;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .16em;
  }

  .connected-label {
    color: #43a05a;
  }

  .connected-copy h1 {
    margin: 5px 0 5px;
    font-size: 26px;
    line-height: 1.1;
    letter-spacing: -.04em;
  }

  .connected-copy h1 span {
    color: #369a4d;
  }

  .connected-copy p {
    margin: 0;
    color: #727981;
    font-size: 11px;
    line-height: 1.5;
  }

  .connected-store {
    min-width: 245px;
    padding: 14px 16px;
    border-radius: 9px;
    background: #fff;
    border: 1px solid #e2e6e3;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .shopify-logo {
    width: 43px;
    height: 48px;
    border-radius: 6px;
    background: #73b34c;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 25px;
    font-weight: 900;
  }

  .store-caption {
    color: #747a81;
    font-size: 8px;
    margin-bottom: 3px;
  }

  .connected-store strong {
    display: block;
    font-size: 11px;
  }

  .connected-tag {
    margin-top: 5px;
    color: #39954e;
    font-size: 8px;
    font-weight: 800;
  }

  .not-connected-banner {
    max-width: 1280px;
    margin: 22px auto 0;
    padding: 24px 28px;
    border: 1px solid #dfe2e6;
    border-radius: 14px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .not-connected-banner h1 {
    margin: 7px 0 5px;
    font-size: 25px;
    letter-spacing: -.04em;
  }

  .not-connected-banner p {
    margin: 0;
    color: #747a82;
    font-size: 12px;
  }

  .not-connected-banner button {
    min-height: 43px;
    padding: 0 20px;
    border: 0;
    border-radius: 8px;
    background: #111318;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
  }

  .dashboard {
    max-width: 1280px;
    margin: 16px auto 40px;
    padding: 0 0;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr) 300px;
    gap: 16px;
    align-items: start;
  }

  .left-column,
  .center-column,
  .right-column {
    min-width: 0;
  }

  .card {
    border: 1px solid #dfe2e6;
    border-radius: 13px;
    background: #fff;
    padding: 19px;
  }

  .card + .card {
    margin-top: 14px;
  }

  .card h2 {
    margin: 8px 0 6px;
    font-size: 18px;
    line-height: 1.15;
    letter-spacing: -.035em;
  }

  .card p {
    margin: 0;
    color: #747a82;
    font-size: 10px;
    line-height: 1.55;
  }

  .connection-status {
    margin-top: 17px;
    padding: 11px;
    border: 1px solid #cfe8d4;
    border-radius: 8px;
    background: #f1fbf3;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-icon {
    width: 21px;
    height: 21px;
    border-radius: 50%;
    background: #3aaa58;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 900;
  }

  .connection-status > div:nth-child(2) {
    flex: 1;
  }

  .connection-status strong {
    display: block;
    color: #31894a;
    font-size: 9px;
  }

  .connection-status span {
    display: block;
    margin-top: 2px;
    color: #6d8974;
    font-size: 8px;
  }

  .status-check {
    color: #399a50;
    font-size: 13px !important;
    font-weight: 900;
  }

  .secondary-button,
  .view-button {
    width: 100%;
    min-height: 39px;
    margin-top: 10px;
    border: 1px solid #e0e2e5;
    border-radius: 7px;
    background: #fff;
    color: #272a2f;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
  }

  .import-card h2 {
    margin-bottom: 5px;
  }

  .dark-button {
    width: 100%;
    min-height: 40px;
    margin-top: 15px;
    border: 0;
    border-radius: 7px;
    background: #111318;
    color: #fff;
    font-size: 9px;
    font-weight: 850;
    cursor: pointer;
  }

  .dark-button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .import-status {
    margin-top: 10px;
    padding: 8px;
    border-radius: 7px;
    background: #f2faf4;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .import-status > span {
    color: #3ba357;
    font-size: 12px;
  }

  .import-status strong,
  .import-status small {
    display: block;
  }

  .import-status strong {
    font-size: 8px;
  }

  .import-status small {
    margin-top: 2px;
    color: #778079;
    font-size: 7px;
  }

  .optimizer-card label {
    display: block;
    margin: 14px 0 5px;
    color: #33363b;
    font-size: 8px;
    font-weight: 800;
  }

  .optimizer-card input,
  .optimizer-card textarea {
    width: 100%;
    border: 1px solid #dfe2e5;
    border-radius: 6px;
    background: #fff;
    padding: 9px 10px;
    outline: none;
    color: #17191d;
    font-family: inherit;
    font-size: 9px;
  }

  .optimizer-card textarea {
    resize: vertical;
    line-height: 1.45;
  }

  .optimizer-card input:focus,
  .optimizer-card textarea:focus {
    border-color: #aeb3b9;
  }

  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 90px;
    gap: 8px;
  }

  .field-grid label {
    margin-top: 11px;
  }

  .optimize-button {
    margin-top: 14px;
  }

  .results-card {
    padding: 17px 19px;
  }

  .results-row {
    margin-top: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 13px;
  }

  .overall-score {
    min-width: 105px;
  }

  .overall-score span {
    display: block;
    color: #747a82;
    font-size: 8px;
  }

  .overall-score strong {
    display: block;
    margin-top: 3px;
    color: #34984d;
    font-size: 28px;
    letter-spacing: -.05em;
  }

  .overall-score small {
    color: #858b91;
    font-size: 10px;
    font-weight: 500;
  }

  .score {
    text-align: center;
  }

  .score-circle {
    width: 43px;
    height: 43px;
    border: 2px solid #45ae61;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #318f49;
    font-size: 10px;
    font-weight: 850;
  }

  .score span {
    display: block;
    margin-top: 5px;
    color: #747a82;
    font-size: 7px;
  }

  .products-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .products-heading p {
    margin-top: 5px;
  }

  .refresh-button {
    width: 27px;
    height: 27px;
    border: 1px solid #dfe2e5;
    border-radius: 6px;
    background: #fff;
    color: #50555b;
    cursor: pointer;
  }

  .product-list {
    margin-top: 13px;
  }

  .product-item {
    width: 100%;
    min-height: 53px;
    padding: 7px;
    border: 1px solid #e4e6e8;
    border-radius: 7px;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    cursor: pointer;
  }

  .product-item + .product-item {
    margin-top: 5px;
  }

  .product-item.selected {
    border-color: #20242a;
  }

  .product-image {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    overflow: hidden;
    border-radius: 5px;
    background: #eee;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .product-info {
    min-width: 0;
    flex: 1;
  }

  .product-info strong {
    display: block;
    overflow: hidden;
    color: #202329;
    font-size: 8px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-info span {
    display: block;
    margin-top: 3px;
    color: #70767d;
    font-size: 8px;
  }

  .radio {
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
    border: 1px solid #aeb3b8;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: #fff;
    font-size: 8px;
    font-weight: 900;
  }

  .selected .radio {
    border-color: #111318;
    background: #111318;
  }

  .view-button {
    margin-top: 9px;
  }

  .actions-card {
    padding-bottom: 8px;
  }

  .action-item {
    width: 100%;
    padding: 12px 0;
    border: 0;
    border-bottom: 1px solid #eceef0;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    cursor: pointer;
  }

  .action-item:last-child {
    border-bottom: 0;
  }

  .action-icon {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    border-radius: 6px;
    background: #f1f2f3;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  }

  .action-item > div:nth-child(2) {
    flex: 1;
  }

  .action-item strong {
    display: block;
    font-size: 8px;
  }

  .action-item span {
    display: block;
    margin-top: 3px;
    color: #7a8087;
    font-size: 7px;
  }

  .action-item b {
    color: #777d83;
    font-size: 16px;
    font-weight: 400;
  }

  .loading-section {
    padding: 35px 20px;
  }

  .loading-card {
    max-width: 1280px;
    min-height: 220px;
    margin: 0 auto;
    border: 1px solid #dfe2e6;
    border-radius: 14px;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    color: #777d84;
    font-size: 11px;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid #e4e6e9;
    border-top-color: #111318;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1050px) {
    .dashboard,
    .connected-banner,
    .not-connected-banner {
      margin-left: 16px;
      margin-right: 16px;
    }

    .dashboard {
      grid-template-columns: 240px minmax(0, 1fr);
    }

    .right-column {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .right-column .card + .card {
      margin-top: 0;
    }

    .connected-store {
      min-width: 210px;
    }
  }

  @media (max-width: 760px) {
    .topbar {
      min-height: 65px;
      padding: 10px 16px;
    }

    .brand-name {
      font-size: 15px;
    }

    .subscribe-button {
      min-height: 38px;
      padding: 0 16px;
      font-size: 10px;
    }

    .connected-banner {
      margin-top: 12px;
      padding: 17px;
      flex-wrap: wrap;
    }

    .connected-check {
      width: 45px;
      height: 45px;
      flex-basis: 45px;
      font-size: 24px;
    }

    .connected-copy {
      width: calc(100% - 65px);
      flex: 1;
    }

    .connected-copy h1 {
      font-size: 20px;
    }

    .connected-store {
      width: 100%;
    }

    .not-connected-banner {
      margin-top: 12px;
      padding: 18px;
      flex-direction: column;
      align-items: stretch;
    }

    .not-connected-banner h1 {
      font-size: 21px;
    }

    .dashboard {
      margin: 12px 12px 30px;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .right-column {
      grid-column: auto;
      display: block;
    }

    .right-column .card + .card {
      margin-top: 12px;
    }

    .card {
      padding: 17px;
    }

    .field-grid {
      grid-template-columns: 1fr;
      gap: 0;
    }

    .results-row {
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .overall-score {
      width: 100%;
    }

    .score-circle {
      width: 40px;
      height: 40px;
    }
  }

  @media (max-width: 430px) {
    .topbar {
      padding-left: 13px;
      padding-right: 13px;
    }

    .brand-name {
      font-size: 14px;
    }

    .connected-copy h1 {
      font-size: 18px;
    }

    .connected-copy p {
      font-size: 9px;
    }

    .dashboard {
      margin-left: 9px;
      margin-right: 9px;
    }
  }
`;