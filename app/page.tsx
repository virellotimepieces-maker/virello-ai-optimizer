"use client";

import { useState } from "react";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [vendor, setVendor] = useState("");
  const [price, setPrice] = useState("");

  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function optimize() {
    // ONLY PRODUCT TITLE IS REQUIRED
    if (!title.trim()) {
      setError("Enter a product title first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: {
            title: title.trim(),
            description: description.trim(),
            productType: productType.trim(),
            vendor: vendor.trim(),
            price: price.trim(),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "AI optimization failed."
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

  async function copyText(value?: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Unable to copy text.");
    }
  }

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

        <div className="shop-pill">
          Ecommerce & Dropshipping
        </div>
      </header>

      {/* HERO */}
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
            Create stronger product listings, SEO copy
            and conversion-focused content for ecommerce
            and dropshipping businesses.
          </p>
        </div>
      </section>

      {/* WORKSPACE */}
      <section className="workspace">
        <div className="workspace-grid">
          <section className="optimizer-panel">

            {/* PRODUCT HEADER */}
            <div className="selected-product">
              <div>
                <div className="step-label">
                  PRODUCT INFORMATION
                </div>

                <h2>
                  Tell Virello about your product
                </h2>

                <p>
                  Add your product details below.
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

            {/* FORM + RESULTS */}
            <div className="results">

              {/* ERROR */}
              {error && (
                <div className="alert error">
                  {error}
                </div>
              )}

              {/* PRODUCT FORM */}
              <div className="content-card">

                {/* TITLE */}
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
                    placeholder="Example: Portable Mini Blender"
                  />
                </div>

                {/* DESCRIPTION */}
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
                      setDescription(e.target.value)
                    }
                    placeholder="Paste your current product description (optional)"
                  />
                </div>

                {/* OPTIONAL DETAILS */}
                <div className="score-grid">

                  <input
                    className="search-input"
                    value={productType}
                    onChange={(e) =>
                      setProductType(e.target.value)
                    }
                    placeholder="Product type (optional)"
                  />

                  <input
                    className="search-input"
                    value={vendor}
                    onChange={(e) =>
                      setVendor(e.target.value)
                    }
                    placeholder="Brand / supplier (optional)"
                  />

                  <input
                    className="search-input"
                    value={price}
                    onChange={(e) =>
                      setPrice(e.target.value)
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
                        Product optimization score
                      </h2>

                      <p>
                        Based on listing quality, SEO,
                        clarity and conversion potential.
                      </p>
                    </div>

                    <div className="overall-score">
                      <strong>
                        {result.score?.overall ?? 0}
                      </strong>

                      <span>/100</span>
                    </div>

                  </div>

                  {/* SCORE CARDS */}
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
                        result.score?.conversionPotential,
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="score-card"
                        key={String(label)}
                      >
                        <div className="score-header">
                          <span>
                            {label}
                          </span>

                          <strong>
                            {value ?? 0}/100
                          </strong>
                        </div>

                        <div className="score-track">
                          <div
                            className="score-fill"
                            style={{
                              width: `${value ?? 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}

                  </div>

                  {/* OPTIMIZED LISTING */}
                  <div className="content-card">

                    <div className="card-title">
                      <div>
                        <div className="step-label">
                          OPTIMIZED LISTING
                        </div>

                        <h2>
                          Ready-to-use content
                        </h2>
                      </div>
                    </div>

                    {/* OPTIMIZED TITLE */}
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
                              result.optimization?.title
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="field-value">
                        {result.optimization?.title ||
                          "No output"}
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
                              result.optimization?.productType
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="field-value">
                        {result.optimization?.productType ||
                          "No output"}
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div className="result-field">
                      <div className="field-header">
                        <label>
                          Product description
                        </label>

                        <button
                          type="button"
                          className="small-button"
                          onClick={() =>
                            copyText(
                              result.optimization?.description
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="field-value multiline">
                        {result.optimization?.description ||
                          "No output"}
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
                              result.optimization?.features?.join(
                                "\n"
                              )
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="field-value multiline">
                        {result.optimization?.features?.length
                          ? result.optimization.features
                              .map(
                                (item) => `• ${item}`
                              )
                              .join("\n")
                          : "No output"}
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
                              result.optimization?.specifications?.join(
                                "\n"
                              )
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="field-value multiline">
                        {result.optimization?.specifications?.length
                          ? result.optimization.specifications
                              .map(
                                (item) => `• ${item}`
                              )
                              .join("\n")
                          : "No output"}
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
                              result.optimization?.seoTitle
                                ?.length ?? 0
                            }
                            /50
                          </span>

                          <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                              copyText(
                                result.optimization?.seoTitle
                              )
                            }
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="field-value">
                        {result.optimization?.seoTitle ||
                          "No output"}
                      </div>
                    </div>

                    {/* META DESCRIPTION */}
                    <div className="result-field">
                      <div className="field-header">
                        <label>
                          Meta description
                        </label>

                        <div className="field-actions">
                          <span className="character-count">
                            {
                              result.optimization
                                ?.metaDescription
                                ?.length ?? 0
                            }
                            /150
                          </span>

                          <button
                            type="button"
                            className="small-button"
                            onClick={() =>
                              copyText(
                                result.optimization
                                  ?.metaDescription
                              )
                            }
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="field-value multiline">
                        {result.optimization
                          ?.metaDescription ||
                          "No output"}
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
                              result.optimization?.tags?.join(
                                ", "
                              )
                            )
                          }
                        >
                          Copy
                        </button>
                      </div>

                      <div className="field-value multiline">
                        {result.optimization?.tags?.length
                          ? result.optimization.tags.join(
                              ", "
                            )
                          : "No output"}
                      </div>
                    </div>

                  </div>

                  {/* ANALYSIS */}
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
                        .strongestFeatures?.length ? (
                        <div className="analysis-block">
                          <strong>
                            Strongest features
                          </strong>

                          <ul>
                            {result.analysis.strongestFeatures.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {result.analysis
                        .weaknesses?.length ? (
                        <div className="analysis-block">
                          <strong>
                            Weaknesses
                          </strong>

                          <ul>
                            {result.analysis.weaknesses.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {result.analysis
                        .missingInformation?.length ? (
                        <div className="analysis-block">
                          <strong>
                            Missing information
                          </strong>

                          <ul>
                            {result.analysis.missingInformation.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {result.analysis
                        .seoOpportunities?.length ? (
                        <div className="analysis-block">
                          <strong>
                            SEO opportunities
                          </strong>

                          <ul>
                            {result.analysis.seoOpportunities.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}

                      {result.analysis
                        .conversionOpportunities?.length ? (
                        <div className="analysis-block">
                          <strong>
                            Conversion opportunities
                          </strong>

                          <ul>
                            {result.analysis.conversionOpportunities.map(
                              (item, index) => (
                                <li key={index}>
                                  {item}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      ) : null}

                    </div>
                  )}

                  {/* REASONING */}
                  {result.reasoning && (
                    <div className="content-card">

                      <div className="step-label">
                        AI REASONING
                      </div>

                      <p className="reasoning">
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
