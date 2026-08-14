"use client";

import { useMemo, useState } from "react";

type ProductResult = {
  title: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  bullets: string[];
};

const cleanText = (value: string) =>
  value.replace(/\s+/g, " ").trim();

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

function createProductTitle(original: string) {
  const text = cleanText(original);

  const lower = text.toLowerCase();

  let model = "";

  const modelMatch = text.match(/\b(?:v\d+|v\s?\d+)\b/i);
  if (modelMatch) model = modelMatch[0].replace(/\s+/g, "").toUpperCase();

  let year = "";
  const yearMatch = text.match(/\b20\d{2}\b/);
  if (yearMatch) year = yearMatch[0];

  const isWatch =
    lower.includes("watch") ||
    lower.includes("timepiece") ||
    lower.includes("chronograph");

  if (isWatch) {
    const parts = [];

    if (year) parts.push(year);
    parts.push("Pagani");

    if (model) parts.push(model);

    if (lower.includes("moon")) {
      parts.push("Moon");
    }

    parts.push("Men's Watch");

    return parts.join(" ");
  }

  const words = text
    .replace(/[|,:;()[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  return words.slice(0, 7).join(" ");
}

function createDescription(title: string, audience: string, style: string) {
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
      ? "an active, versatile look"
      : style === "Gift"
      ? "a thoughtful gifting option"
      : "an easy everyday style";

  return `${title} is designed for ${styleText}, offering a clean and versatile look for ${audienceText}. Its balanced design makes it easy to pair with business attire, casual outfits, and special occasions.`;
}

function createSeoTitle(title: string) {
  const candidates = [
    `${title} | Men's Luxury Watch`,
    `${title} | Men's Premium Watch`,
    `${title} | Luxury Men's Timepiece`,
    `${title} | Premium Men's Timepiece`,
  ];

  for (const candidate of candidates) {
    if (candidate.length <= 60) {
      return candidate;
    }
  }

  return limitText(title, 60);
}

function createMetaDescription(title: string, style: string) {
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
    `Discover the ${title}, designed with ${styleText}. A versatile timepiece for business, everyday wear and special occasions.`,
    `Shop the ${title}, featuring ${styleText} for business, everyday wear and special occasions. Discover a polished timepiece today.`,
    `Explore the ${title}, created for ${styleText}. An easy choice for everyday outfits, business looks and special occasions.`,
  ];

  for (const candidate of candidates) {
    if (candidate.length <= 160) {
      return candidate;
    }
  }

  return limitText(candidates[0], 160);
}

function createBullets(style: string) {
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

  return [
    "Refined design for a polished appearance",
    "Versatile styling for business and casual wear",
    "Comfort-focused design for everyday use",
    "A timeless option for personal wear or gifting",
  ];
}

export default function Home() {
  const [productTitle, setProductTitle] = useState("");
  const [price, setPrice] = useState("129.99");
  const [audience, setAudience] = useState("Men");
  const [style, setStyle] = useState("Premium / Luxury");
  const [imageCount, setImageCount] = useState(4);

  const [result, setResult] = useState<ProductResult | null>(null);
  const [generated, setGenerated] = useState(false);

  const generatedResult = useMemo(() => {
    if (!productTitle.trim()) return null;

    const title = createProductTitle(productTitle);
    const description = createDescription(title, audience, style);
    const seoTitle = createSeoTitle(title);
    const metaDescription = createMetaDescription(title, style);
    const bullets = createBullets(style);

    return {
      title,
      description,
      seoTitle,
      metaDescription,
      bullets,
    };
  }, [productTitle, audience, style]);

  function generateProductPage() {
    if (!productTitle.trim()) {
      alert("Please enter your original product title.");
      return;
    }

    if (!generatedResult) return;

    setResult(generatedResult);
    setGenerated(true);

    setTimeout(() => {
      document
        .getElementById("preview")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  function editProduct() {
    setGenerated(false);
    setResult(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const activeResult = result || generatedResult;

  return (
    <main className="page">
      <header className="header">
        <div className="brand">
          <div className="brand-name">VIRELLO</div>
          <div className="brand-subtitle">AI PRODUCT OPTIMIZER</div>
        </div>
      </header>

      {!generated ? (
        <section className="editor">
          <div className="eyebrow">Virello AI</div>

          <h1>
            Create a better
            <br />
            product page.
          </h1>

          <p className="intro">
            Enter your product information and generate a complete,
            product-specific ecommerce page.
          </p>

          <div className="section-title">Product Information</div>

          <label>Product Title</label>
          <input
            className="input"
            value={productTitle}
            onChange={(e) => setProductTitle(e.target.value)}
            placeholder="Paste your original product title"
          />

          <label>Product Price</label>
          <div className="price-input">
            <span>$</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <label>Target Audience</label>
          <div className="button-row">
            {["Women", "Men", "Unisex"].map((item) => (
              <button
                key={item}
                className={audience === item ? "choice active" : "choice"}
                onClick={() => setAudience(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label>Copywriting</label>
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
                key={item}
                className={style === item ? "choice active" : "choice"}
                onClick={() => setStyle(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <label>Visuals</label>

          <div className="visual-label">
            Number of Product Images
          </div>

          <div className="button-row">
            {[0, 1, 2, 3, 4, 5, 6].map((number) => (
              <button
                key={number}
                className={
                  imageCount === number
                    ? "image-choice active"
                    : "image-choice"
                }
                onClick={() => setImageCount(number)}
              >
                {number}
              </button>
            ))}
          </div>

          <button className="generate" onClick={generateProductPage}>
            Generate AI Product Page →
          </button>
        </section>
      ) : (
        <section id="preview" className="preview-page">
          <button className="edit-button" onClick={editProduct}>
            ← Edit Product
          </button>

          <div className="preview-brand">VIRELLO</div>

          <div className="product-layout">
            <div className="visual-column">
              <div className="image-main">
                {imageCount > 0 ? "Product Image" : "No Image"}
              </div>

              {Array.from({ length: Math.max(0, imageCount - 1) }).map(
                (_, index) => (
                  <div className="image-small" key={index}>
                    Additional Product View
                  </div>
                )
              )}
            </div>

            <div className="product-info">
              <div className="collection">Premium Collection</div>

              <h2>{activeResult?.title}</h2>

              <div className="product-price">${price}</div>

              <p className="description">
                {activeResult?.description}
              </p>

              <div className="bullets">
                {activeResult?.bullets.map((bullet) => (
                  <div key={bullet}>✓ {bullet}</div>
                ))}
              </div>

              <button className="cart-button">ADD TO CART</button>

              <div className="trust">
                <span>Secure Checkout</span>
                <span>Easy Returns</span>
                <span>Support</span>
              </div>
            </div>
          </div>

          <section className="standout">
            <div className="section-kicker">Virello Product Experience</div>

            <h3>
              Make the product easier to
              <br className="desktop-break" />
              understand. Easier to want.
            </h3>

            <button className="cart-button">ADD TO CART</button>
          </section>

          <section className="faq">
            <div className="section-kicker">
              Frequently Asked Questions
            </div>

            <h3>Questions, answered.</h3>

            <details>
              <summary>
                Is this watch suitable for everyday wear?
              </summary>
              <p>
                Yes. Its versatile styling makes it suitable for
                everyday outfits and regular use.
              </p>
            </details>

            <details>
              <summary>
                Can it be worn with formal clothing?
              </summary>
              <p>
                Yes. The refined design pairs well with business
                and formal clothing.
              </p>
            </details>

            <details>
              <summary>Is it suitable as a gift?</summary>
              <p>
                Yes. Its versatile and polished design makes it a
                thoughtful gifting option.
              </p>
            </details>
          </section>

          <section className="seo-section">
            <h3>SEO Information</h3>

            <div className="seo-card">
              <div className="seo-label">SEO Title</div>

              <div className="seo-value">
                {activeResult?.seoTitle}
              </div>

              <div
                className={
                  (activeResult?.seoTitle.length || 0) <= 60
                    ? "counter good"
                    : "counter bad"
                }
              >
                {activeResult?.seoTitle.length || 0}/60
              </div>
            </div>

            <div className="seo-card">
              <div className="seo-label">Meta Description</div>

              <div className="seo-value">
                {activeResult?.metaDescription}
              </div>

              <div
                className={
                  (activeResult?.metaDescription.length || 0) <= 160
                    ? "counter good"
                    : "counter bad"
                }
              >
                {activeResult?.metaDescription.length || 0}/160
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
        input {
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
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .brand-subtitle {
          margin-top: 4px;
          font-size: 13px;
          letter-spacing: 0.06em;
        }

        .editor {
          width: min(900px, 90vw);
          margin: 60px auto 100px;
        }

        .eyebrow {
          font-size: 17px;
          margin-bottom: 36px;
        }

        h1 {
          margin: 0;
          font-size: clamp(48px, 8vw, 92px);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .intro {
          max-width: 720px;
          margin: 38px 0 55px;
          font-size: 21px;
          line-height: 1.45;
        }

        .section-title {
          font-size: 21px;
          font-weight: 600;
          margin-bottom: 28px;
        }

        label,
        .visual-label {
          display: block;
          font-size: 17px;
          margin: 22px 0 9px;
        }

        .input,
        .price-input {
          width: 100%;
          min-height: 54px;
          border: 1px solid #bdbdbd;
          background: white;
          border-radius: 8px;
          padding: 0 16px;
          font-size: 17px;
          outline: none;
        }

        .input:focus,
        .price-input:focus-within {
          border-color: #111;
        }

        .price-input {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .price-input input {
          border: 0;
          outline: 0;
          width: 100%;
          font-size: 17px;
        }

        .button-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .choice,
        .image-choice {
          min-height: 44px;
          padding: 7px 15px;
          border: 1px solid #999;
          border-radius: 7px;
          background: white;
        }

        .choice.active,
        .image-choice.active {
          background: #171717;
          color: white;
          border-color: #171717;
        }

        .generate {
          margin-top: 45px;
          min-height: 56px;
          padding: 0 24px;
          border: 0;
          border-radius: 8px;
          background: #171717;
          color: white;
          font-weight: 600;
          font-size: 17px;
        }

        .generate:hover {
          opacity: 0.9;
        }

        .preview-page {
          width: min(1200px, 92vw);
          margin: 25px auto 100px;
        }

        .edit-button {
          background: white;
          border: 1px solid #999;
          border-radius: 7px;
          padding: 10px 17px;
        }

        .preview-brand {
          margin: 35px 0 25px;
          font-size: 13px;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .product-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: clamp(30px, 6vw, 90px);
          align-items: start;
        }

        .visual-column {
          min-width: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .image-main {
          grid-column: 1 / -1;
          aspect-ratio: 1 / 1;
          background: #e9e9e9;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #777;
          font-size: 18px;
        }

        .image-small {
          aspect-ratio: 1 / 1;
          background: #ededed;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #777;
          font-size: 14px;
          text-align: center;
          padding: 10px;
        }

        .product-info {
          min-width: 0;
        }

        .collection {
          font-size: 18px;
          color: #777;
          margin-bottom: 20px;
        }

        .product-info h2 {
          margin: 0;
          max-width: 650px;
          font-size: clamp(40px, 5vw, 76px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          overflow-wrap: anywhere;
        }

        .product-price {
          margin-top: 28px;
          font-size: 24px;
        }

        .description {
          margin-top: 30px;
          max-width: 650px;
          font-size: 19px;
          line-height: 1.6;
        }

        .bullets {
          margin-top: 28px;
          display: grid;
          gap: 9px;
          font-size: 17px;
          line-height: 1.45;
        }

        .cart-button {
          margin-top: 28px;
          min-height: 48px;
          padding: 0 22px;
          background: #171717;
          color: white;
          border: 0;
          border-radius: 7px;
          font-weight: 600;
        }

        .trust {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 20px;
          color: #555;
          font-size: 14px;
        }

        .standout,
        .faq,
        .seo-section {
          margin-top: 100px;
          border-top: 1px solid #d5d5d5;
          padding-top: 45px;
        }

        .section-kicker {
          color: #666;
          font-size: 17px;
        }

        .standout h3,
        .faq h3,
        .seo-section > h3 {
          margin: 25px 0;
          font-size: clamp(38px, 5vw, 68px);
          line-height: 1;
          letter-spacing: -0.045em;
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
          font-size: 18px;
          font-weight: 500;
        }

        details p {
          max-width: 700px;
          line-height: 1.6;
          color: #555;
        }

        .seo-card {
          margin-top: 28px;
          background: white;
          border-radius: 18px;
          padding: 28px;
        }

        .seo-label {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 18px;
        }

        .seo-value {
          font-size: 18px;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .counter {
          margin-top: 14px;
          font-size: 14px;
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
            width: 90vw;
            margin-top: 45px;
          }

          .intro {
            font-size: 18px;
          }

          .product-layout {
            grid-template-columns: 1fr;
            gap: 45px;
          }

          .visual-column {
            order: 1;
          }

          .product-info {
            order: 2;
          }

          .product-info h2 {
            font-size: clamp(42px, 12vw, 64px);
          }

          .description {
            font-size: 17px;
          }

          .standout,
          .faq,
          .seo-section {
            margin-top: 70px;
          }
        }

        @media (max-width: 480px) {
          h1 {
            font-size: 48px;
          }

          .preview-page {
            width: 92vw;
          }

          .visual-column {
            grid-template-columns: 1fr;
          }

          .image-main {
            grid-column: auto;
          }

          .image-small {
            aspect-ratio: 1.2 / 1;
          }

          .product-info h2 {
            font-size: 43px;
            line-height: 1.02;
          }

          .standout h3,
          .faq h3,
          .seo-section > h3 {
            font-size: 42px;
          }

          .desktop-break {
            display: none;
          }

          .seo-card {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}
