"use client";

import { useState } from "react";

type AIResult = {
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
    description?: string;
    seoTitle?: string;
    metaDescription?: string;
    tags?: string[];
  };

  reasoning?: string;
};

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

  const [error, setError] =
    useState("");

  async function optimize() {
    const requiredFields = [
      {
        value: title,
        label: "product title",
      },
      {
        value: description,
        label: "product description",
      },
      {
        value: productType,
        label: "product type",
      },
      {
        value: vendor,
        label: "brand / supplier",
      },
      {
        value: price,
        label: "price",
      },
    ];

    const missing = requiredFields.find(
      (field) => !field.value.trim()
    );

    if (missing) {
      setError(
        `Enter a ${missing.label} first.`
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
    } catch {
      setError(
        "Unable to copy text."
      );
    }
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

        <div className="shop-pill">
          Ecommerce & Dropshipping
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">
            AI PRODUCT INTELLIGENCE
          </div>

          <h1>
            Optimize any ecommerce product{" "}
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

      <section className="workspace">
        <div className="workspace-grid">
          <section className="optimizer-panel">

            <div className="selected-product">
              <div>
                <div className="step-label">
                  PRODUCT INFORMATION
                </div>

                <h2>
                  Tell Virello about
                  your product
                </h2>
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

            <div className="results">

              {error && (
                <div className="alert error">
                  {error}
                </div>
              )}

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
                      setTitle(
                        e.target.value
                      )
                    }
                    placeholder="Example: Portable Mini Blender *"
                  />
                </div>

                <div className="result-field">
                  <div className="field-header">
                    <label>
                      Description *
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
                    placeholder="Paste your current product description... *"
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
                    placeholder="Product type *"
                  />

                  <input
                    className="search-input"
                    value={vendor}
                    onChange={(e) =>
                      setVendor(
                        e.target.value
                      )
                    }
                    placeholder="Brand / supplier *"
                  />

                  <input
                    className="search-input"
                    value={price}
                    onChange={(e) =>
                      setPrice(
                        e.target.value
                      )
                    }
                    placeholder="Price *"
                  />

                </div>
              </div>

              {result && (
                <>
                  <div className="score-overview">
                    <div>
                      <div className="step-label light">
                        VIRELLO SCORE
                      </div>

                      <h2>
                        Product optimization
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
                        {result.score
                          ?.overall ?? 0}
                      </strong>

                      <span>/100</span>
                    </div>
                  </div>

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
                      ([label, value]) => (
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
                              {value ??
                                0}
                              /100
                            </strong>
                          </div>

                          <div className="score-track">
                            <div
                              className="score-fill"
                              style={{
                                width: `${
                                  value ??
                                  0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    )}

                  </div>

                  <div className="content-card">

                    <div className="card-title">
                      <div>
                        <div className="step-label">
                          OPTIMIZED LISTING
                        </div>

                        <h2>
                          Ready-to-use
                          content
                        </h2>
                      </div>
                    </div>

                    {[
                      [
                        "Product title",
                        result
                          .optimization
                          ?.title,
                      ],

                      [
                        "Product description",
                        result
                          .optimization
                          ?.description,
                      ],

                      [
                        "SEO title",
                        result
                          .optimization
                          ?.seoTitle,
                      ],

                      [
                        "Meta description",
                        result
                          .optimization
                          ?.metaDescription,
                      ],

                      [
                        "Tags",
                        result
                          .optimization
                          ?.tags
                          ?.join(
                            ", "
                          ),
                      ],
                    ].map(
                      ([label, value]) => (
                        <div
                          className="result-field"
                          key={String(
                            label
                          )}
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
                                  value
                                )
                              }
                            >
                              Copy
                            </button>
                          </div>

                          <div className="field-value multiline">
                            {value ||
                              "No output"}
                          </div>
                        </div>
                      )
                    )}

                  </div>

                  {result.reasoning && (
                    <div className="content-card">

                      <div className="step-label">
                        AI REASONING
                      </div>

                      <p>
                        {result.reasoning}
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
