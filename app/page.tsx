"use client";

import { useMemo, useState } from "react";

type ProductResult = {
  title: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  bullets: string[];
  specs: string[];
};

const cleanText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const removeYear = (value: string) =>
  cleanText(
    value
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(/\s+/g, " ")
  );

const removeOrigin = (value: string) =>
  cleanText(
    value
      .replace(
        /\b(country of origin|origin|made in|place of origin)\s*[:\-]?\s*[a-zA-Z ,.-]+/gi,
        ""
      )
      .replace(/\s+/g, " ")
  );

const sanitizeText = (value: string) =>
  removeYear(removeOrigin(value));

const limitText = (value: string, max: number) => {
  const clean = sanitizeText(value);

  if (clean.length <= max) return clean;

  const shortened = clean.slice(0, max + 1);
  const lastSpace = shortened.lastIndexOf(" ");

  return shortened
    .slice(0, lastSpace > 0 ? lastSpace : max)
    .replace(/[.,;:!?|-]+$/, "")
    .trim();
};

function createProductTitle(original: string) {
  const text = sanitizeText(original);
  const lower = text.toLowerCase();

  const modelMatch = text.match(/\bv\s?\d+\b/i);

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

    if (
      lower.includes("chronograph") &&
      !parts.includes("Chronograph")
    ) {
      parts.push("Chronograph");
    }

    parts.push("Men's Watch");

    return sanitizeText(parts.join(" "));
  }

  const cleaned = text
    .replace(
      /\b(country of origin|origin|made in|place of origin)\b/gi,
      ""
    )
    .replace(/[|,:;()[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");

  return sanitizeText(cleaned);
}

function createDescription(
  title: string,
  audience: string,
  style: string
) {
  const cleanTitle = sanitizeText(title);

  const audienceText =
    audience === "Women"
      ? "women"
      : audience === "Men"
      ? "men"
      : "everyday wear";

  const styleText =
    style === "Premium / Luxury"
      ? "a refined, premium look"
      : style === "Professional"
      ? "a polished professional look"
      : style === "Sport"
      ? "a versatile sport-inspired look"
      : style === "Gift"
      ? "a thoughtful gifting option"
      : style === "Casual"
      ? "an easy casual look"
      : "an easy everyday style";

  return sanitizeText(
    `${cleanTitle} is designed for ${styleText}, with a clean and versatile profile for ${audienceText}. Its balanced styling makes it easy to pair with business attire, casual outfits, and special occasions.`
  );
}

function createSeoTitle(title: string) {
  const cleanTitle = sanitizeText(title);

  const candidates = [
    `${cleanTitle} | Men's Luxury Watch`,
    `${cleanTitle} | Men's Premium Watch`,
    `${cleanTitle} | Luxury Timepiece`,
    `${cleanTitle} | Premium Timepiece`,
    cleanTitle,
  ];

  const valid = candidates.find(
    (item) =>
      sanitizeText(item).length <= 60
  );

  return limitText(
    valid || cleanTitle,
    60
  );
}

function createMetaDescription(
  title: string,
  style: string
) {
  const cleanTitle = sanitizeText(title);

  const styleText =
    style === "Premium / Luxury"
      ? "refined luxury styling"
      : style === "Professional"
      ? "a polished professional look"
      : style === "Sport"
      ? "versatile sport-inspired styling"
      : style === "Gift"
      ? "an elegant gifting option"
      : "versatile everyday styling";

  const candidates = [
    `Discover the ${cleanTitle}, designed with ${styleText}. A versatile timepiece for business, everyday wear and special occasions.`,

    `Shop the ${cleanTitle}, featuring ${styleText} for business and everyday wear. Discover a polished timepiece today.`,

    `Explore the ${cleanTitle}, created for ${styleText}. A refined choice for everyday outfits and special occasions.`,
  ];

  const valid = candidates.find(
    (item) =>
      sanitizeText(item).length <= 160
  );

  return limitText(
    valid || candidates[0],
    160
  );
}

function createBullets(
  style: string,
  audience: string
) {
  if (style === "Sport") {
    return [
      "Versatile design for active everyday styling",
      "Easy to pair with casual and sport-inspired outfits",
      "Comfort-focused design for regular wear",
      "A practical choice for personal use or gifting",
    ];
  }

  if (style === "Professional") {
    return [
      "Polished design suited to professional settings",
      "Easy to pair with business and formal attire",
      "Versatile enough for everyday wear",
      "A refined option for personal use or gifting",
    ];
  }

  if (style === "Gift") {
    return [
      "Refined design suitable for gifting",
      "Versatile style for different occasions",
      "Easy to pair with casual or formal outfits",
      "A timeless choice for someone special",
    ];
  }

  if (audience === "Women") {
    return [
      "Refined design for a polished appearance",
      "Versatile styling for everyday and special occasions",
      "Easy to pair with a range of outfits",
      "A thoughtful option for personal wear or gifting",
    ];
  }

  return [
    "Refined design for a polished appearance",
    "Versatile styling for business and casual wear",
    "Comfort-focused design for everyday use",
    "A timeless option for personal wear or gifting",
  ];
}

function createSpecs(
  style: string,
  audience: string
) {
  const specs = [
    `Style: ${style}`,
    `Designed for: ${
      audience === "Unisex"
        ? "Men & Women"
        : audience
    }`,
    "Use: Everyday & Special Occasions",
    "Design: Refined & Versatile",
  ];

  return specs.filter(
    (item) =>
      !/origin|made in|country/i.test(item)
  );
}

export default function Home() {
  const [productTitle, setProductTitle] =
    useState("");

  const [price, setPrice] =
    useState("129.99");

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

  const generatedResult =
    useMemo<ProductResult | null>(() => {
      if (!productTitle.trim()) {
        return null;
      }

      const title =
        createProductTitle(productTitle);

      return {
        title,
        description:
          createDescription(
            title,
            audience,
            style
          ),
        seoTitle:
          createSeoTitle(title),
        metaDescription:
          createMetaDescription(
            title,
            style
          ),
        bullets:
          createBullets(
            style,
            audience
          ),
        specs:
          createSpecs(
            style,
            audience
          ),
      };
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
        "Please enter your original product title."
      );
      return;
    }

    if (!generatedResult) {
      return;
    }

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

  function editProduct() {
    setGenerated(false);
    setResult(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

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
      </header>

      {!generated ? (

        <section className="editor">

          <div className="eyebrow">
            Virello AI
          </div>

          <h1>
            Create a better product page.
          </h1>

          <p className="intro">
            Turn a supplier product title into
            a cleaner, more professional product
            page with natural copy and
            search-ready SEO information.
          </p>

          <div className="panel">

            <div className="section-title">
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
              placeholder="Paste the full supplier product title here"
              rows={4}
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
                        setAudience(
                          item
                        )
                      }
                    >
                      {item}
                    </button>

                  ))}

                </div>

              </div>

            </div>

            <label>
              Copywriting Style
            </label>

            <div className="button-row wrap">

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

            <button
              type="button"
              className="generate"
              onClick={
                generateProductPage
              }
            >
              Generate AI Product Page
              <span> →</span>
            </button>

          </div>

        </section>

      ) : (

        <section
          id="preview"
          className="preview-page"
        >

          <button
            type="button"
            className="edit-button"
            onClick={editProduct}
          >
            ← Edit Product
          </button>

          <div className="preview-brand">
            VIRELLO
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
                  Additional Product View
                </div>

              ))}

            </div>

            <div className="product-info">

              <div className="collection">
                Premium Collection
              </div>

              <h2>
                {activeResult?.title}
              </h2>

              <div className="product-price">
                $
                {price || "0.00"}
              </div>

              <p className="description">
                {
                  activeResult?.description
                }
              </p>

              <div className="bullets">

                {activeResult?.bullets.map(
                  (bullet) => (

                    <div key={bullet}>
                      ✓ {bullet}
                    </div>

                  )
                )}

              </div>

              <button
                type="button"
                className="cart-button"
              >
                ADD TO CART
              </button>

              <div className="trust">

                <span>
                  Secure Checkout
                </span>

                <span>
                  Easy Returns
                </span>

                <span>
                  Support
                </span>

              </div>

            </div>

          </div>

          <section className="features-section">

            <div className="section-kicker">
              Product Details
            </div>

            <h3>
              Details that help customers
              buy with confidence.
            </h3>

            <div className="feature-grid">

              <div className="feature-card">

                <div className="feature-number">
                  01
                </div>

                <h4>
                  Refined Design
                </h4>

                <p>
                  A clean and polished style
                  designed to complement
                  different outfits and
                  occasions.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-number">
                  02
                </div>

                <h4>
                  Versatile Styling
                </h4>

                <p>
                  Easy to wear with business,
                  casual and occasion-ready
                  looks.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-number">
                  03
                </div>

                <h4>
                  Everyday Appeal
                </h4>

                <p>
                  Designed to fit naturally
                  into everyday personal style.
                </p>

              </div>

              <div className="feature-card">

                <div className="feature-number">
                  04
                </div>

                <h4>
                  Gift Ready
                </h4>

                <p>
                  A polished choice for personal
                  wear or a thoughtful gift.
                </p>

              </div>

            </div>

          </section>

          <section className="specs-section">

            <div className="section-kicker">
              Product Information
            </div>

            <h3>
              Product specifications.
            </h3>

            <div className="spec-list">

              {activeResult?.specs.map(
                (spec) => {

                  const parts =
                    spec.split(":");

                  return (
                    <div
                      className="spec-row"
                      key={spec}
                    >

                      <span>
                        {parts[0]}
                      </span>

                      <strong>
                        {parts
                          .slice(1)
                          .join(":")
                          .trim()}
                      </strong>

                    </div>
                  );
                }
              )}

            </div>

          </section>

          <section className="standout">

            <div className="section-kicker">
              Virello Product Experience
            </div>

            <h3>
              Make the product easier
              to understand.
              Easier to want.
            </h3>

            <button
              type="button"
              className="cart-button"
            >
              ADD TO CART
            </button>

          </section>

          <section className="faq">

            <div className="section-kicker">
              Frequently Asked Questions
            </div>

            <h3>
              Questions, answered.
            </h3>

            <details>

              <summary>
                Is this product suitable
                for everyday use?
              </summary>

              <p>
                Yes. Its versatile styling
                makes it suitable for
                everyday outfits and
                regular use.
              </p>

            </details>

            <details>

              <summary>
                Can it be worn with
                formal clothing?
              </summary>

              <p>
                Yes. The refined design
                pairs well with business
                and formal clothing.
              </p>

            </details>

            <details>

              <summary>
                Is it suitable as a gift?
              </summary>

              <p>
                Yes. Its versatile and
                polished design makes it
                a thoughtful gifting option.
              </p>

            </details>

            <details>

              <summary>
                Is this suitable for
                different occasions?
              </summary>

              <p>
                Yes. The clean styling makes
                it easy to transition between
                everyday, business and
                special occasions.
              </p>

            </details>

          </section>

          <section className="seo-section">

            <h3>
              SEO Information
            </h3>

            <div className="seo-card">

              <div className="seo-label">
                SEO Title
              </div>

              <div className="seo-value">
                {activeResult?.seoTitle}
              </div>

              <div
                className={
                  (activeResult?.seoTitle
                    .length || 0) <= 60
                    ? "counter good"
                    : "counter bad"
                }
              >
                {activeResult?.seoTitle.length ||
                  0}
                /60
              </div>

            </div>

            <div className="seo-card">

              <div className="seo-label">
                Meta Description
              </div>

              <div className="seo-value">
                {
                  activeResult?.metaDescription
                }
              </div>

              <div
                className={
                  (activeResult
                    ?.metaDescription
                    .length || 0) <= 160
                    ? "counter good"
                    : "counter bad"
                }
              >
                {activeResult
                  ?.metaDescription
                  .length || 0}
                /160
              </div>

            </div>

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
          background: #f7f7f5;
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
          width: 100%;
          overflow-x: hidden;
        }

        .header {
          width: 100%;
          padding: 28px 5vw 18px;
        }

        .brand-name {
          font-size: 20px;
          font-weight: 750;
          letter-spacing: .08em;
        }

        .brand-subtitle {
          margin-top: 4px;
          font-size: 13px;
          letter-spacing: .06em;
        }

        .editor,
        .preview-page {
          width: min(1180px, 90vw);
          margin: 0 auto;
        }

        .editor {
          padding: 70px 0 110px;
        }

        .eyebrow {
          font-size: 15px;
          margin-bottom: 28px;
          color: #666;
        }

        h1 {
          max-width: 900px;
          margin: 0;
          font-size: clamp(
            52px,
            8vw,
            92px
          );
          line-height: .96;
          letter-spacing: -.055em;
        }

        .intro {
          max-width: 700px;
          margin: 32px 0 52px;
          font-size: 20px;
          line-height: 1.5;
          color: #4d4d4d;
        }

        .panel {
          background: #fff;
          border: 1px solid #e4e4e0;
          border-radius: 24px;
          padding: clamp(
            22px,
            4vw,
            42px
          );
          box-shadow:
            0 12px 40px
            rgba(0,0,0,.04);
        }

        .section-title {
          font-size: 21px;
          font-weight: 700;
          margin-bottom: 28px;
        }

        label {
          display: block;
          font-size: 15px;
          font-weight: 650;
          margin: 22px 0 9px;
        }

        .input,
        .price-input {
          width: 100%;
          border: 1px solid #d8d8d4;
          border-radius: 12px;
          background: #fafaf9;
        }

        .input {
          padding: 15px 16px;
          outline: none;
          resize: vertical;
          min-height: 58px;
        }

        .input:focus,
        .price-input:focus-within {
          border-color: #171717;
          background: #fff;
        }

        .title-input {
          min-height: 112px;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            minmax(180px, 260px)
            1fr;
          gap: 30px;
          align-items: start;
        }

        .price-input {
          display: flex;
          align-items: center;
          padding: 0 14px;
        }

        .price-input span {
          font-weight: 650;
          color: #555;
        }

        .price-input input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 15px 8px;
        }

        .button-row {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .choice,
        .image-choice {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid #d7d7d3;
          border-radius: 999px;
          background: #fff;
          color: #222;
        }

        .image-choice {
          width: 42px;
          padding: 0;
        }

        .choice.active,
        .image-choice.active {
          background: #171717;
          border-color: #171717;
          color: #fff;
        }

        .generate {
          width: 100%;
          min-height: 58px;
          margin-top: 34px;
          border: 0;
          border-radius: 12px;
          background: #171717;
          color: #fff;
          font-weight: 700;
        }

        .generate:hover,
        .cart-button:hover {
          opacity: .88;
        }

        .preview-page {
          padding: 20px 0 100px;
        }

        .edit-button {
          border: 1px solid #d5d5d1;
          background: #fff;
          border-radius: 10px;
          min-height: 42px;
          padding: 0 15px;
        }

        .preview-brand {
          margin: 36px 0 24px;
          font-size: 14px;
          font-weight: 750;
          letter-spacing: .1em;
        }

        .product-layout {
          display: grid;
          grid-template-columns:
            minmax(0, .9fr)
            minmax(0, 1.1fr);
          gap: clamp(
            35px,
            6vw,
            80px
          );
          align-items: start;
        }

        .visual-column {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .image-main,
        .image-small {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: #ededed;
          color: #777;
          border-radius: 18px;
          min-height: 180px;
          padding: 20px;
        }

        .image-main {
          grid-column: 1 / -1;
          aspect-ratio: 1 / 1;
          font-size: 18px;
        }

        .image-small {
          aspect-ratio: 1 / 1;
          font-size: 14px;
        }

        .product-info {
          min-width: 0;
        }

        .collection {
          color: #777;
          font-size: 15px;
          margin-bottom: 20px;
        }

        .product-info h2 {
          max-width: 680px;
          margin: 0;
          font-size: clamp(
            38px,
            5vw,
            68px
          );
          line-height: 1.02;
          letter-spacing: -.045em;
        }

        .product-price {
          margin-top: 25px;
          font-size: 24px;
          font-weight: 600;
        }

        .description {
          max-width: 650px;
          margin-top: 28px;
          font-size: 18px;
          line-height: 1.6;
          color: #3f3f3f;
        }

        .bullets {
          display: grid;
          gap: 9px;
          margin-top: 25px;
          font-size: 16px;
          line-height: 1.45;
        }

        .cart-button {
          min-height: 50px;
          margin-top: 27px;
          padding: 0 24px;
          border: 0;
          border-radius: 9px;
          background: #171717;
          color: #fff;
          font-weight: 700;
        }

        .trust {
          display: flex;
          flex-wrap: wrap;
          gap: 15px 22px;
          margin-top: 17px;
          color: #666;
          font-size: 14px;
        }

        .features-section,
        .specs-section,
        .standout,
        .faq,
        .seo-section {
          margin-top: 100px;
          border-top: 1px solid #d5d5d1;
          padding-top: 44px;
        }

        .section-kicker {
          color: #777;
          font-size: 15px;
        }

        .features-section h3,
        .specs-section h3,
        .standout h3,
        .faq h3,
        .seo-section > h3 {
          max-width: 900px;
          margin: 20px 0 32px;
          font-size: clamp(
            38px,
            5vw,
            64px
          );
          line-height: 1;
          letter-spacing: -.045em;
        }

        .feature-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .feature-card {
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 20px;
          padding: 28px;
        }

        .feature-number {
          color: #888;
          font-size: 13px;
          letter-spacing: .08em;
        }

        .feature-card h4 {
          margin: 22px 0 10px;
          font-size: 23px;
        }

        .feature-card p {
          margin: 0;
          color: #555;
          line-height: 1.6;
        }

        .spec-list {
          border-top: 1px solid #ccc;
        }

        .spec-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 19px 0;
          border-bottom: 1px solid #ccc;
        }

        .spec-row span {
          color: #666;
        }

        .spec-row strong {
          text-align: right;
        }

        details {
          border-top: 1px solid #ccc;
          padding: 20px 0;
        }

        details:last-child {
          border-bottom: 1px solid #ccc;
        }

        summary {
          cursor: pointer;
          font-size: 17px;
          font-weight: 600;
        }

        details p {
          max-width: 700px;
          margin-bottom: 0;
          line-height: 1.6;
          color: #555;
        }

        .seo-card {
          margin-top: 22px;
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 18px;
          padding: 24px;
        }

        .seo-label {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 13px;
        }

        .seo-value {
          font-size: 17px;
          line-height: 1.5;
          overflow-wrap: break-word;
        }

        .counter {
          margin-top: 11px;
          font-size: 13px;
        }

        .counter.good {
          color: #26734d;
        }

        .counter.bad {
          color: #b42318;
          font-weight: 700;
        }

        @media (max-width: 800px) {

          .header {
            padding: 20px 5vw 10px;
          }

          .editor {
            padding-top: 45px;
          }

          .intro {
            font-size: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .product-layout {
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .visual-column {
            order: 1;
          }

          .product-info {
            order: 2;
          }

          .product-info h2 {
            font-size: clamp(
              38px,
              10vw,
              56px
            );
          }

          .description {
            font-size: 17px;
          }

          .feature-grid {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 520px) {

          .editor,
          .preview-page {
            width: 92vw;
          }

          .editor {
            padding-top: 35px;
          }

          h1 {
            font-size: 48px;
          }

          .panel {
            border-radius: 18px;
            padding: 20px;
          }

          .visual-column {
            grid-template-columns:
              1fr 1fr;
          }

          .image-main {
            grid-column: 1 / -1;
          }

          .product-info h2 {
            font-size: 40px;
            line-height: 1.04;
          }

          .product-price {
            font-size: 22px;
          }

          .features-section,
          .specs-section,
          .standout,
          .faq,
          .seo-section {
            margin-top: 70px;
            padding-top: 34px;
          }

          .features-section h3,
          .specs-section h3,
          .standout h3,
          .faq h3,
          .seo-section > h3 {
            font-size: 40px;
          }

          .feature-card {
            padding: 22px;
          }

          .spec-row {
            flex-direction: column;
            gap: 7px;
          }

          .spec-row strong {
            text-align: left;
          }

          .seo-card {
            padding: 18px;
          }

          .seo-value {
            font-size: 16px;
          }

        }

      `}</style>

    </main>
  );
}
