"use client";

import { useMemo, useState } from "react";

type ProductResult = {
  title: string;
  description: string;
  benefits: string[];
  features: string[];
  faq: { question: string; answer: string }[];
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  handle: string;
  tags: string[];
  productType: string;
  collection: string;
  altText: string;
  sellingAngle: string;
  cta: string;
};

const cleanText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const removeYears = (value: string) =>
  value
    .replace(/\b(19|20)\d{2}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const removeOrigin = (value: string) =>
  value
    .replace(
      /\b(country of origin|origin|made in|place of origin)\b\s*[:\-]?\s*[^,.;|]+/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

const cleanSupplierText = (value: string) =>
  removeOrigin(removeYears(value))
    .replace(
      /\b(waterproof|luxury|luxurious|high quality|top quality|best seller|new arrival|hot sale|fashion)\b/gi,
      (match) => match
    )
    .replace(/[|{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const limitText = (value: string, max: number) => {
  const clean = cleanText(value);

  if (clean.length <= max) return clean;

  const shortened = clean.slice(0, max + 1);
  const lastSpace = shortened.lastIndexOf(" ");

  return shortened
    .slice(0, lastSpace > 0 ? lastSpace : max)
    .replace(/[.,;:!?|-]+$/, "")
    .trim();
};

const slugify = (value: string) =>
  removeYears(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function detectProductType(original: string) {
  const text = original.toLowerCase();

  if (
    text.includes("watch") ||
    text.includes("timepiece") ||
    text.includes("chronograph")
  ) {
    return "Watches";
  }

  if (
    text.includes("shirt") ||
    text.includes("blouse") ||
    text.includes("dress") ||
    text.includes("jacket")
  ) {
    return "Apparel";
  }

  if (
    text.includes("mirror") ||
    text.includes("faucet") ||
    text.includes("shower")
  ) {
    return "Home & Bathroom";
  }

  if (
    text.includes("bag") ||
    text.includes("wallet") ||
    text.includes("purse")
  ) {
    return "Accessories";
  }

  return "General Merchandise";
}

function createProductTitle(original: string) {
  const cleaned = cleanSupplierText(original);
  const lower = cleaned.toLowerCase();

  const modelMatch = cleaned.match(/\bv\s?\d+\b/i);

  const model = modelMatch?.[0]
    ? modelMatch[0]
        .replace(/\s+/g, "")
        .toUpperCase()
    : "";

  const isWatch =
    lower.includes("watch") ||
    lower.includes("timepiece") ||
    lower.includes("chronograph") ||
    lower.includes("pagani");

  if (isWatch) {
    const parts: string[] = [];

    if (lower.includes("pagani")) {
      parts.push("Pagani");
    }

    if (model) {
      parts.push(model);
    }

    if (lower.includes("moon")) {
      parts.push("Moon");
    }

    parts.push("Men's Watch");

    return parts.join(" ");
  }

  const words = cleaned
    .replace(
      /\b(stainless steel|quartz|waterproof|sport|fashion|casual|new|men|women|for men|for women)\b/gi,
      ""
    )
    .replace(/[|,:;()[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function createDescription(
  title: string,
  audience: string,
  style: string
) {
  const audienceText =
    audience === "Women"
      ? "women"
      : audience === "Men"
      ? "men"
      : "anyone seeking versatile everyday style";

  const styleText =
    style === "Premium / Luxury"
      ? "a refined and premium look"
      : style === "Professional"
      ? "a polished professional look"
      : style === "Sport"
      ? "a versatile sport-inspired look"
      : style === "Gift"
      ? "a thoughtful gifting option"
      : style === "Casual"
      ? "an effortless casual look"
      : "a versatile everyday look";

  return `${title} is designed for ${audienceText} who appreciate ${styleText}. Its clean styling makes it easy to pair with different outfits and occasions, giving you a polished look without unnecessary details.`;
}

function createBenefits(style: string) {
  if (style === "Sport") {
    return [
      "Versatile design for active everyday styling",
      "Easy to pair with casual and sport-inspired outfits",
      "Comfort-focused design for regular wear",
      "Suitable for everyday use and gifting",
    ];
  }

  if (style === "Professional") {
    return [
      "Polished design suited to professional settings",
      "Pairs naturally with business and formal attire",
      "Versatile enough for everyday wear",
      "Refined choice for personal use or gifting",
    ];
  }

  if (style === "Gift") {
    return [
      "Refined design suitable for gifting",
      "Versatile style for different occasions",
      "Easy to pair with casual or formal outfits",
      "A thoughtful option for someone special",
    ];
  }

  return [
    "Clean and refined design",
    "Versatile styling for different occasions",
    "Easy to pair with everyday outfits",
    "Suitable for personal wear or gifting",
  ];
}

function createFeatures(original: string) {
  const lower = original.toLowerCase();

  const features: string[] = [];

  if (lower.includes("quartz")) {
    features.push("Quartz movement");
  }

  if (lower.includes("chronograph")) {
    features.push("Chronograph styling");
  }

  if (lower.includes("stainless steel")) {
    features.push("Stainless steel construction");
  }

  if (lower.includes("waterproof") || lower.includes("water resistant")) {
    features.push("Water-resistant design");
  }

  if (lower.includes("leather")) {
    features.push("Leather strap");
  }

  if (lower.includes("automatic")) {
    features.push("Automatic movement");
  }

  if (!features.length) {
    features.push(
      "Refined product design",
      "Versatile everyday styling",
      "Designed for practical everyday use"
    );
  }

  return features.slice(0, 5);
}

function createSeoTitle(title: string) {
  const candidates = [
    title,
    `${title} | Premium Watch`,
    `${title} | Luxury Timepiece`,
    `${title} | Premium Timepiece`,
  ];

  return (
    candidates.find((item) => item.length <= 60) ||
    limitText(candidates[0], 60)
  );
}

function createMetaDescription(
  title: string,
  style: string
) {
  const styleText =
    style === "Premium / Luxury"
      ? "refined luxury styling"
      : style === "Professional"
      ? "a polished professional look"
      : style === "Sport"
      ? "sport-inspired versatility"
      : style === "Gift"
      ? "an elegant gifting option"
      : "versatile everyday styling";

  const candidates = [
    `Discover the ${title}, designed with ${styleText}. A versatile choice for everyday wear, business looks and special occasions.`,

    `Shop the ${title}, featuring ${styleText} for everyday wear and special occasions. Explore the collection today.`,

    `Explore the ${title}, created for ${styleText}. A refined choice for everyday outfits and thoughtful gifting.`,
  ];

  return (
    candidates.find((item) => item.length <= 160) ||
    limitText(candidates[0], 160)
  );
}

function createKeywords(title: string, type: string) {
  const base = title
    .replace(/[|,:;()[\]{}]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const keywords = [
    ...base,
    type,
    `${type} online`,
    `premium ${type.toLowerCase()}`,
  ];

  return Array.from(
    new Set(
      keywords
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  ).slice(0, 8);
}

function createTags(
  title: string,
  type: string,
  style: string
) {
  const tags = [
    type,
    style,
    ...title
      .replace(/['’]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 5),
  ];

  return Array.from(
    new Set(tags.map(cleanText))
  ).slice(0, 8);
}

function createFaq(
  title: string,
  features: string[]
) {
  return [
    {
      question: `Is the ${title} suitable for everyday wear?`,
      answer:
        "Yes. Its versatile design makes it suitable for everyday outfits, business looks and a variety of occasions.",
    },
    {
      question: "What are the main product features?",
      answer:
        features.slice(0, 3).join(", ") + ".",
    },
    {
      question: "Can it be given as a gift?",
      answer:
        "Yes. The clean and versatile design makes it a practical and thoughtful gifting option.",
    },
  ];
}

function createSellingAngle(
  audience: string,
  style: string
) {
  if (style === "Premium / Luxury") {
    return `Position this product around refined style, versatility and a premium appearance for ${audience.toLowerCase()} shoppers.`;
  }

  if (style === "Professional") {
    return `Position this product as a polished everyday choice for ${audience.toLowerCase()} customers who want a professional look.`;
  }

  if (style === "Sport") {
    return `Position this product around versatility and active everyday styling for ${audience.toLowerCase()} shoppers.`;
  }

  return `Position this product around practical design, versatility and everyday value for ${audience.toLowerCase()} shoppers.`;
}

function createCta(style: string) {
  if (style === "Premium / Luxury") {
    return "Explore the Collection";
  }

  if (style === "Gift") {
    return "Find the Perfect Gift";
  }

  return "Shop Now";
}

function createResult(
  original: string,
  audience: string,
  style: string
): ProductResult {
  const title = createProductTitle(original);
  const type = detectProductType(original);
  const features = createFeatures(original);

  return {
    title,
    description: createDescription(
      title,
      audience,
      style
    ),
    benefits: createBenefits(style),
    features,
    faq: createFaq(title, features),
    seoTitle: createSeoTitle(title),
    metaDescription: createMetaDescription(
      title,
      style
    ),
    keywords: createKeywords(title, type),
    handle: slugify(title),
    tags: createTags(
      title,
      type,
      style
    ),
    productType: type,
    collection:
      type === "Watches"
        ? "Watches"
        : type,
    altText: `${title} product image`,
    sellingAngle: createSellingAngle(
      audience,
      style
    ),
    cta: createCta(style),
  };
}

function scoreSeo(result: ProductResult) {
  let score = 70;

  if (result.seoTitle.length <= 60) score += 8;
  if (result.metaDescription.length <= 160) score += 8;
  if (result.title.length <= 70) score += 5;
  if (result.keywords.length >= 4) score += 4;
  if (result.handle.length <= 60) score += 5;

  return Math.min(score, 100);
}

function scoreContent(result: ProductResult) {
  let score = 75;

  if (result.description.length >= 120) score += 7;
  if (result.benefits.length >= 4) score += 5;
  if (result.features.length >= 3) score += 5;
  if (result.faq.length >= 3) score += 4;

  return Math.min(score, 100);
}

function scoreConversion(result: ProductResult) {
  let score = 72;

  if (result.benefits.length >= 4) score += 7;
  if (result.sellingAngle) score += 7;
  if (result.cta) score += 5;
  if (result.faq.length >= 3) score += 4;
  if (result.description.length >= 120) score += 5;

  return Math.min(score, 100);
}

export default function Home() {
  const [productTitle, setProductTitle] =
    useState("");

  const [currentDescription, setCurrentDescription] =
    useState("");

  const [price, setPrice] =
    useState("129.99");

  const [vendor, setVendor] =
    useState("");

  const [productCategory, setProductCategory] =
    useState("");

  const [audience, setAudience] =
    useState("Men");

  const [style, setStyle] =
    useState("Premium / Luxury");

  const [imageCount, setImageCount] =
    useState(4);

  const [generated, setGenerated] =
    useState(false);

  const [result, setResult] =
    useState<ProductResult | null>(null);

  const [copied, setCopied] =
    useState("");

  const generatedResult =
    useMemo<ProductResult | null>(() => {
      if (!productTitle.trim()) return null;

      return createResult(
        productTitle,
        audience,
        style
      );
    }, [
      productTitle,
      audience,
      style,
    ]);

  const activeResult =
    result || generatedResult;

  function generateProductPage() {
    if (!productTitle.trim()) {
      alert(
        "Please enter the original product title."
      );
      return;
    }

    if (!generatedResult) return;

    setResult(generatedResult);
    setGenerated(true);

    setTimeout(() => {
      document
        .getElementById("preview")
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }, 50);
  }

  function regenerate() {
    if (!productTitle.trim()) return;

    setResult(
      createResult(
        productTitle,
        audience,
        style
      )
    );
  }

  function editProduct() {
    setGenerated(false);
    setResult(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function copyText(
    label: string,
    text: string
  ) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);

      setTimeout(() => {
        setCopied("");
      }, 1600);
    } catch {
      alert(
        "Copy is not available on this browser."
      );
    }
  }

  const seoScore = activeResult
    ? scoreSeo(activeResult)
    : 0;

  const contentScore = activeResult
    ? scoreContent(activeResult)
    : 0;

  const conversionScore = activeResult
    ? scoreConversion(activeResult)
    : 0;

  return (
    <main className="page">

      <header className="header">

        <div>
          <div className="brand-name">
            VIRELLO
          </div>

          <div className="brand-subtitle">
            AI PRODUCT OPTIMIZER
          </div>
        </div>

        <div className="header-status">
          PRODUCT OPTIMIZER
        </div>

      </header>

      {!generated ? (

        <section className="editor">

          <div className="eyebrow">
            Virello AI
          </div>

          <h1>
            Turn product data into
            better product pages.
          </h1>

          <p className="intro">
            Optimize your product content,
            SEO and conversion messaging
            from one workspace.
          </p>

          <div className="panel">

            <div className="section-heading">
              <span>01</span>
              Product Information
            </div>

            <label htmlFor="product-title">
              Original Product Title
            </label>

            <textarea
              id="product-title"
              className="input title-input"
              value={productTitle}
              onChange={(e) =>
                setProductTitle(
                  e.target.value
                )
              }
              placeholder="Paste the full supplier or Shopify product title"
              rows={4}
            />

            <label htmlFor="description">
              Current Description
            </label>

            <textarea
              id="description"
              className="input"
              value={currentDescription}
              onChange={(e) =>
                setCurrentDescription(
                  e.target.value
                )
              }
              placeholder="Optional — paste the current product description"
              rows={5}
            />

            <div className="form-grid">

              <div>

                <label htmlFor="price">
                  Product Price
                </label>

                <div className="price-input">

                  <span>$</span>

                  <input
                    id="price"
                    value={price}
                    onChange={(e) =>
                      setPrice(
                        e.target.value
                      )
                    }
                    inputMode="decimal"
                  />

                </div>

              </div>

              <div>

                <label htmlFor="vendor">
                  Vendor / Brand
                </label>

                <input
                  id="vendor"
                  className="simple-input"
                  value={vendor}
                  onChange={(e) =>
                    setVendor(
                      e.target.value
                    )
                  }
                  placeholder="Optional"
                />

              </div>

            </div>

            <label htmlFor="category">
              Product Category
            </label>

            <input
              id="category"
              className="simple-input"
              value={productCategory}
              onChange={(e) =>
                setProductCategory(
                  e.target.value
                )
              }
              placeholder="Optional — e.g. Watches"
            />

            <div className="section-heading section-gap">
              <span>02</span>
              Optimization Settings
            </div>

            <label>
              Target Audience
            </label>

            <div className="button-row">

              {[
                "Women",
                "Men",
                "Unisex",
              ].map((item) => (

                <button
                  type="button"
                  key={item}
                  className={
                    audience === item
                      ? "choice active"
                      : "choice"
                  }
                  onClick={() =>
                    setAudience(item)
                  }
                >
                  {item}
                </button>

              ))}

            </div>

            <label>
              Copywriting Style
            </label>

            <div className="button-row">

              {[
                "Premium / Luxury",
                "Professional",
                "Everyday",
                "Casual",
                "Sport",
                "Gift",
              ].map((item) => (

                <button
                  type="button"
                  key={item}
                  className={
                    style === item
                      ? "choice active"
                      : "choice"
                  }
                  onClick={() =>
                    setStyle(item)
                  }
                >
                  {item}
                </button>

              ))}

            </div>

            <label>
              Product Images
            </label>

            <div className="button-row">

              {[0, 1, 2, 3, 4, 5, 6].map(
                (number) => (

                  <button
                    type="button"
                    key={number}
                    className={
                      imageCount === number
                        ? "image-choice active"
                        : "image-choice"
                    }
                    onClick={() =>
                      setImageCount(
                        number
                      )
                    }
                  >
                    {number}
                  </button>

                )
              )}

            </div>

            <div className="rules-box">

              <div className="rules-title">
                Virello Content Rules
              </div>

              <div className="rule">
                ✓ No years in product titles
              </div>

              <div className="rule">
                ✓ No origin information in specs
              </div>

              <div className="rule">
                ✓ No supplier-style keyword stuffing
              </div>

              <div className="rule">
                ✓ SEO title kept within 60 characters
              </div>

              <div className="rule">
                ✓ Meta description kept within 160 characters
              </div>

            </div>

            <button
              type="button"
              className="generate"
              onClick={
                generateProductPage
              }
            >
              Generate Full Optimization
              <span>→</span>
            </button>

          </div>

        </section>

      ) : (

        <section
          id="preview"
          className="preview-page"
        >

          <div className="top-actions">

            <button
              type="button"
              className="edit-button"
              onClick={editProduct}
            >
              ← Edit Product
            </button>

            <button
              type="button"
              className="regenerate-button"
              onClick={regenerate}
            >
              Regenerate
            </button>

          </div>

          <div className="preview-brand">
            VIRELLO
          </div>

          <div className="preview-title-row">

            <div>
              <div className="eyebrow">
                Optimization Preview
              </div>

              <h2>
                Product Optimization
              </h2>
            </div>

          </div>

          <div className="score-grid">

            <div className="score-card">
              <span>SEO</span>
              <strong>
                {seoScore}
              </strong>
              <small>/ 100</small>
            </div>

            <div className="score-card">
              <span>CONTENT</span>
              <strong>
                {contentScore}
              </strong>
              <small>/ 100</small>
            </div>

            <div className="score-card">
              <span>CONVERSION</span>
              <strong>
                {conversionScore}
              </strong>
              <small>/ 100</small>
            </div>

          </div>

          <section className="optimization-section">

            <div className="section-heading">
              <span>01</span>
              Optimized Product
            </div>

            <div className="product-layout">

              <div className="visual-column">

                <div className="image-main">
                  {imageCount > 0
                    ? "Product Image"
                    : "No Image"}
                </div>

                {Array.from({
                  length: Math.max(
                    0,
                    imageCount - 1
                  ),
                }).map((_, index) => (

                  <div
                    className="image-small"
                    key={index}
                  >
                    Product View
                  </div>

                ))}

              </div>

              <div className="product-info">

                <div className="collection">
                  {activeResult?.collection}
                </div>

                <h3>
                  {activeResult?.title}
                </h3>

                <CopyButton
                  label="Product Title"
                  value={
                    activeResult?.title ||
                    ""
                  }
                  copied={copied}
                  onCopy={copyText}
                />

                <div className="product-price">
                  ${price || "0.00"}
                </div>

                <p className="description">
                  {activeResult?.description}
                </p>

                <CopyButton
                  label="Description"
                  value={
                    activeResult?.description ||
                    ""
                  }
                  copied={copied}
                  onCopy={copyText}
                />

                <div className="subheading">
                  Key Benefits
                </div>

                <div className="benefits">

                  {activeResult?.benefits.map(
                    (item) => (

                      <div
                        className="benefit"
                        key={item}
                      >
                        <span>✓</span>
                        {item}
                      </div>

                    )
                  )}

                </div>

                <div className="subheading">
                  Features
                </div>

                <div className="features">

                  {activeResult?.features.map(
                    (item) => (

                      <div
                        className="feature"
                        key={item}
                      >
                        {item}
                      </div>

                    )
                  )}

                </div>

                <button
                  type="button"
                  className="cart-button"
                >
                  {activeResult?.cta}
                </button>

              </div>

            </div>

          </section>

          <section className="optimization-section">

            <div className="section-heading">
              <span>02</span>
              SEO Optimization
            </div>

            <div className="seo-grid">

              <OutputCard
                title="SEO Title"
                value={
                  activeResult?.seoTitle ||
                  ""
                }
                counter={
                  `${activeResult?.seoTitle.length || 0}/60`
                }
                good={
                  (activeResult?.seoTitle.length ||
                    0) <= 60
                }
                copied={copied}
                onCopy={copyText}
              />

              <OutputCard
                title="Meta Description"
                value={
                  activeResult?.metaDescription ||
                  ""
                }
                counter={
                  `${activeResult?.metaDescription.length || 0}/160`
                }
                good={
                  (activeResult?.metaDescription.length ||
                    0) <= 160
                }
                copied={copied}
                onCopy={copyText}
              />

            </div>

            <div className="seo-grid">

              <OutputCard
                title="URL Handle"
                value={
                  activeResult?.handle ||
                  ""
                }
                copied={copied}
                onCopy={copyText}
              />

              <OutputCard
                title="Image Alt Text"
                value={
                  activeResult?.altText ||
                  ""
                }
                copied={copied}
                onCopy={copyText}
              />

            </div>

            <div className="keyword-card">

              <div className="card-title">
                Suggested Keywords
              </div>

              <div className="tag-list">

                {activeResult?.keywords.map(
                  (keyword) => (

                    <span
                      className="tag"
                      key={keyword}
                    >
                      {keyword}
                    </span>

                  )
                )}

              </div>

            </div>

          </section>

          <section className="optimization-section">

            <div className="section-heading">
              <span>03</span>
              Shopify Product Fields
            </div>

            <div className="field-grid">

              <OutputCard
                title="Product Type"
                value={
                  activeResult?.productType ||
                  ""
                }
                copied={copied}
                onCopy={copyText}
              />

              <OutputCard
                title="Collection"
                value={
                  activeResult?.collection ||
                  ""
                }
                copied={copied}
                onCopy={copyText}
              />

            </div>

            <div className="keyword-card">

              <div className="card-title">
                Product Tags
              </div>

              <div className="tag-list">

                {activeResult?.tags.map(
                  (tag) => (

                    <span
                      className="tag"
                      key={tag}
                    >
                      {tag}
                    </span>

                  )
                )}

              </div>

            </div>

            <div className="important-note">
              Origin / Country of Origin is
              intentionally excluded from
              Virello product specifications.
            </div>

          </section>

          <section className="optimization-section">

            <div className="section-heading">
              <span>04</span>
              Conversion Strategy
            </div>

            <div className="strategy-card">

              <div className="card-title">
                Selling Angle
              </div>

              <p>
                {activeResult?.sellingAngle}
              </p>

              <CopyButton
                label="Selling Angle"
                value={
                  activeResult?.sellingAngle ||
                  ""
                }
                copied={copied}
                onCopy={copyText}
              />

            </div>

          </section>

          <section className="optimization-section">

            <div className="section-heading">
              <span>05</span>
              Frequently Asked Questions
            </div>

            <div className="faq">

              {activeResult?.faq.map(
                (item) => (

                  <details key={item.question}>

                    <summary>
                      {item.question}
                    </summary>

                    <p>
                      {item.answer}
                    </p>

                  </details>

                )
              )}

            </div>

          </section>

          <section className="final-actions">

            <div>
              <div className="section-kicker">
                Ready for Shopify
              </div>

              <h3>
                Review everything before
                applying the changes.
              </h3>
            </div>

            <div className="action-row">

              <button
                type="button"
                className="edit-button large"
                onClick={editProduct}
              >
                Edit Optimization
              </button>

              <button
                type="button"
                className="generate large"
              >
                Apply to Shopify →
              </button>

            </div>

            <p className="connection-note">
              Shopify connection will be
              activated through the secure
              app/API integration in the
              next step.
            </p>

          </section>

        </section>

      )}

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #f6f6f3;
          color: #171717;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .page {
          min-height: 100vh;
          overflow-x: hidden;
        }

        .header {
          width: min(1280px, 90vw);
          margin: auto;
          padding: 28px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .brand-name {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: .09em;
        }

        .brand-subtitle {
          margin-top: 4px;
          font-size: 11px;
          letter-spacing: .12em;
          color: #666;
        }

        .header-status {
          font-size: 11px;
          letter-spacing: .1em;
          color: #777;
        }

        .editor,
        .preview-page {
          width: min(1180px, 90vw);
          margin: auto;
        }

        .editor {
          padding: 70px 0 120px;
        }

        .eyebrow {
          font-size: 13px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: #777;
          margin-bottom: 24px;
        }

        h1 {
          max-width: 950px;
          margin: 0;
          font-size: clamp(
            48px,
            7vw,
            88px
          );
          line-height: .97;
          letter-spacing: -.055em;
        }

        .intro {
          max-width: 720px;
          margin: 30px 0 50px;
          color: #555;
          font-size: 19px;
          line-height: 1.6;
        }

        .panel {
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 24px;
          padding: clamp(
            22px,
            4vw,
            44px
          );
          box-shadow:
            0 18px 60px
            rgba(0,0,0,.045);
        }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 13px;
          font-size: 22px;
          font-weight: 750;
          margin-bottom: 28px;
        }

        .section-heading span {
          color: #999;
          font-size: 12px;
          letter-spacing: .08em;
        }

        .section-gap {
          margin-top: 45px;
        }

        label {
          display: block;
          margin: 22px 0 9px;
          font-size: 14px;
          font-weight: 700;
        }

        .input,
        .simple-input,
        .price-input {
          width: 100%;
          border: 1px solid #d8d8d4;
          border-radius: 12px;
          background: #fafaf9;
        }

        .input {
          padding: 15px;
          outline: none;
          resize: vertical;
          line-height: 1.5;
        }

        .input:focus,
        .simple-input:focus,
        .price-input:focus-within {
          border-color: #171717;
          background: #fff;
        }

        .title-input {
          min-height: 120px;
        }

        .simple-input {
          min-height: 52px;
          padding: 0 15px;
          outline: none;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 24px;
        }

        .price-input {
          min-height: 52px;
          display: flex;
          align-items: center;
          padding: 0 14px;
        }

        .price-input span {
          color: #555;
          font-weight: 700;
        }

        .price-input input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 0 8px;
        }

        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .choice,
        .image-choice {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid #d7d7d3;
          background: #fff;
          border-radius: 999px;
          color: #222;
        }

        .image-choice {
          width: 42px;
          padding: 0;
        }

        .choice.active,
        .image-choice.active {
          color: #fff;
          background: #171717;
          border-color: #171717;
        }

        .rules-box {
          margin-top: 30px;
          padding: 20px;
          border-radius: 15px;
          background: #f5f5f2;
        }

        .rules-title {
          font-weight: 750;
          margin-bottom: 12px;
        }

        .rule {
          margin-top: 7px;
          font-size: 14px;
          color: #555;
        }

        .generate {
          border: 0;
          background: #171717;
          color: #fff;
          min-height: 56px;
          padding: 0 23px;
          border-radius: 10px;
          font-weight: 750;
        }

        .panel > .generate {
          width: 100%;
          margin-top: 30px;
        }

        .generate span {
          margin-left: 8px;
        }

        .top-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .edit-button,
        .regenerate-button {
          min-height: 43px;
          padding: 0 15px;
          border-radius: 9px;
          border: 1px solid #d5d5d1;
          background: #fff;
        }

        .regenerate-button {
          background: #171717;
          color: #fff;
          border-color: #171717;
        }

        .preview-page {
          padding: 25px 0 110px;
        }

        .preview-brand {
          margin-top: 38px;
          font-weight: 800;
          letter-spacing: .1em;
          font-size: 14px;
        }

        .preview-title-row {
          margin-top: 30px;
        }

        .preview-title-row h2 {
          margin: 0;
          font-size: clamp(
            42px,
            6vw,
            70px
          );
          letter-spacing: -.05em;
        }

        .score-grid {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 14px;
          margin: 35px 0 80px;
        }

        .score-card {
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 17px;
          padding: 22px;
        }

        .score-card span {
          display: block;
          font-size: 11px;
          letter-spacing: .08em;
          color: #777;
        }

        .score-card strong {
          font-size: 48px;
          letter-spacing: -.05em;
        }

        .score-card small {
          color: #888;
        }

        .optimization-section {
          margin-top: 85px;
          border-top: 1px solid #d6d6d1;
          padding-top: 40px;
        }

        .product-layout {
          display: grid;
          grid-template-columns:
            minmax(0, .9fr)
            minmax(0, 1.1fr);
          gap: 70px;
        }

        .visual-column {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .image-main,
        .image-small {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: #e9e9e6;
          color: #777;
          border-radius: 17px;
          min-height: 160px;
          padding: 20px;
        }

        .image-main {
          grid-column: 1 / -1;
          aspect-ratio: 1 / 1;
        }

        .image-small {
          aspect-ratio: 1 / 1;
          font-size: 13px;
        }

        .product-info {
          min-width: 0;
        }

        .collection {
          font-size: 13px;
          color: #777;
          margin-bottom: 18px;
          text-transform: uppercase;
          letter-spacing: .07em;
        }

        .product-info h3 {
          margin: 0;
          font-size: clamp(
            38px,
            5vw,
            68px
          );
          line-height: 1.02;
          letter-spacing: -.05em;
        }

        .product-price {
          margin-top: 22px;
          font-size: 23px;
          font-weight: 650;
        }

        .description {
          margin: 26px 0 0;
          color: #444;
          font-size: 17px;
          line-height: 1.65;
        }

        .subheading {
          margin-top: 30px;
          margin-bottom: 13px;
          font-size: 14px;
          font-weight: 750;
        }

        .benefits {
          display: grid;
          gap: 9px;
        }

        .benefit {
          display: flex;
          gap: 9px;
          line-height: 1.45;
        }

        .benefit span {
          font-weight: 800;
        }

        .features {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .feature {
          border: 1px solid #d8d8d4;
          border-radius: 999px;
          padding: 9px 12px;
          font-size: 13px;
        }

        .cart-button {
          margin-top: 28px;
          min-height: 50px;
          border: 0;
          border-radius: 9px;
          padding: 0 22px;
          background: #171717;
          color: #fff;
          font-weight: 750;
        }

        .copy-row {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 10px;
        }

        .copy-button {
          min-height: 32px;
          border: 1px solid #d5d5d1;
          border-radius: 7px;
          padding: 0 10px;
          background: #fff;
          font-size: 12px;
        }

        .copied {
          font-size: 12px;
          color: #26734d;
        }

        .seo-grid,
        .field-grid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 15px;
          margin-top: 15px;
        }

        .output-card,
        .keyword-card,
        .strategy-card {
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 17px;
          padding: 22px;
        }

        .output-card {
          min-width: 0;
        }

        .card-title {
          font-weight: 750;
          margin-bottom: 12px;
        }

        .output-value {
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .counter {
          margin-top: 12px;
          font-size: 12px;
        }

        .counter.good {
          color: #26734d;
        }

        .counter.bad {
          color: #b42318;
        }

        .keyword-card {
          margin-top: 15px;
        }

        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          padding: 8px 11px;
          background: #f0f0ed;
          border-radius: 999px;
          font-size: 13px;
        }

        .important-note {
          margin-top: 15px;
          padding: 17px;
          border-radius: 13px;
          background: #f5f5f2;
          color: #555;
          font-size: 14px;
        }

        .strategy-card p {
          max-width: 800px;
          color: #555;
          line-height: 1.6;
        }

        .faq details {
          border-top: 1px solid #d4d4d0;
          padding: 20px 0;
        }

        .faq details:last-child {
          border-bottom: 1px solid #d4d4d0;
        }

        .faq summary {
          cursor: pointer;
          font-weight: 700;
        }

        .faq p {
          max-width: 800px;
          color: #555;
          line-height: 1.6;
        }

        .final-actions {
          margin-top: 100px;
          padding: 45px;
          border-radius: 24px;
          background: #171717;
          color: #fff;
        }

        .section-kicker {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .1em;
          opacity: .65;
        }

        .final-actions h3 {
          max-width: 700px;
          margin: 15px 0 30px;
          font-size: clamp(
            34px,
            5vw,
            58px
          );
          line-height: 1;
          letter-spacing: -.045em;
        }

        .action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .large {
          min-height: 52px;
        }

        .final-actions .edit-button {
          color: #171717;
        }

        .connection-note {
          margin: 22px 0 0;
          color: #aaa;
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 850px) {

          .product-layout {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .form-grid,
          .seo-grid,
          .field-grid {
            grid-template-columns: 1fr;
          }

          .score-grid {
            grid-template-columns: 1fr;
            margin-bottom: 55px;
          }

        }

        @media (max-width: 560px) {

          .header {
            width: 92vw;
            padding: 20px 0;
          }

          .header-status {
            display: none;
          }

          .editor,
          .preview-page {
            width: 92vw;
          }

          .editor {
            padding-top: 40px;
          }

          h1 {
            font-size: 47px;
          }

          .intro {
            font-size: 17px;
          }

          .panel {
            border-radius: 18px;
            padding: 20px;
          }

          .product-info h3 {
            font-size: 42px;
          }

          .preview-title-row h2 {
            font-size: 45px;
          }

          .final-actions {
            padding: 25px;
            border-radius: 18px;
          }

          .final-actions h3 {
            font-size: 38px;
          }

          .action-row {
            flex-direction: column;
          }

          .action-row button {
            width: 100%;
          }

          .top-actions {
            flex-wrap: wrap;
          }

          .top-actions button {
            flex: 1;
          }

        }

      `}</style>

    </main>
  );
}

function CopyButton({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (
    label: string,
    value: string
  ) => void;
}) {
  return (
    <div className="copy-row">

      <button
        type="button"
        className="copy-button"
        onClick={() =>
          onCopy(label, value)
        }
      >
        Copy {label}
      </button>

      {copied === label && (
        <span className="copied">
          Copied
        </span>
      )}

    </div>
  );
}

function OutputCard({
  title,
  value,
  counter,
  good = true,
  copied,
  onCopy,
}: {
  title: string;
  value: string;
  counter?: string;
  good?: boolean;
  copied: string;
  onCopy: (
    label: string,
    value: string
  ) => void;
}) {
  return (
    <div className="output-card">

      <div className="card-title">
        {title}
      </div>

      <div className="output-value">
        {value}
      </div>

      {counter && (
        <div
          className={
            good
              ? "counter good"
              : "counter bad"
          }
        >
          {counter}
        </div>
      )}

      <CopyButton
        label={title}
        value={value}
        copied={copied}
        onCopy={onCopy}
      />

    </div>
  );
}
