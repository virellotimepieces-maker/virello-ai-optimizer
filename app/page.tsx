"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Product = {
  title: string;
  description: string;
  price: string;
  images: string[];
  productType: string;
  tags: string;
  audience: string;
  style: string;
};

type Result = {
  title: string;
  description: string;
  bullets: string[];
  specs: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  metaDescription: string;
};

const clean = (value: string) =>
  value.replace(/\s+/g, " ").replace(/[|]+/g, " ").trim();

const limit = (value: string, max: number) => {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const end = cut.lastIndexOf(" ");
  return `${cut.slice(0, end > 0 ? end : max).replace(/[.,;:!?-]+$/, "")}`;
};

function buildTitle(title: string, audience: string, style: string) {
  const source = clean(title)
    .replace(/\b(official|wholesale|dropshipping|free shipping)\b/gi, "")
    .replace(/[|,:;()[\]{}]+/g, " ");

  const words = source.split(/\s+/).filter(Boolean);
  const base = words.slice(0, 7).join(" ");

  if (/watch|timepiece|chronograph/i.test(source)) {
    const gender =
      audience === "Women"
        ? "Women's"
        : audience === "Men"
          ? "Men's"
          : "Unisex";
    const luxury = style === "Premium / Luxury" ? "Luxury" : "";
    return clean(`${base} ${luxury} ${gender} Watch`);
  }

  return clean(`${base} ${style === "Premium / Luxury" ? "Premium" : ""}`);
}

function generateResult(product: Product): Result {
  const title = buildTitle(product.title, product.audience, product.style);

  const stylePhrase =
    product.style === "Premium / Luxury"
      ? "a refined premium look"
      : product.style === "Professional"
        ? "a polished professional look"
        : product.style === "Sport"
          ? "a confident sport-inspired look"
          : product.style === "Gift"
            ? "a thoughtful gifting option"
            : "an effortless everyday look";

  const audiencePhrase =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  const bullets =
    product.style === "Professional"
      ? [
          "Refined styling that complements business and formal outfits",
          "A polished look that transitions from workdays to evenings",
          "Versatile design that pairs easily with different outfits",
          "A strong option for personal wear or gifting",
        ]
      : [
          "Refined design for a polished appearance",
          "Versatile styling for everyday and special occasions",
          "Easy to pair with a wide range of outfits",
          "A thoughtful option for personal wear or gifting",
        ];

  const specs = [
    `Product Type: ${product.productType || "Premium Timepiece"}`,
    `Audience: ${product.audience}`,
    `Style: ${product.style}`,
    `Use: Everyday & Special Occasions`,
    product.tags ? `Tags: ${product.tags}` : "Presentation: Clean & Refined",
  ];

  const faq = [
    {
      q: "Is this suitable for everyday wear?",
      a: "Yes. Its versatile styling is designed to work naturally with everyday outfits.",
    },
    {
      q: "Can it be worn for formal occasions?",
      a: "Yes. The refined presentation pairs naturally with business and dressier clothing.",
    },
    {
      q: "Is it suitable as a gift?",
      a: "Yes. The polished and versatile design makes it a thoughtful gifting option.",
    },
    {
      q: "What makes the design versatile?",
      a: "Its clean profile makes it easy to pair with casual, professional and special-occasion looks.",
    },
  ];

  return {
    title,
    description: `${title} is designed for ${stylePhrase}, offering a clean and versatile profile for ${audiencePhrase}. Its balanced presentation makes it easy to pair with business attire, casual outfits and special occasions.`,
    bullets,
    specs,
    faq,
    seoTitle: limit(`${title} | Premium Timepiece`, 60),
    metaDescription: limit(
      `Discover ${title}, designed for ${stylePhrase}. A versatile timepiece for ${audiencePhrase}, everyday wear, business and special occasions.`,
      160
    ),
  };
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image"));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [product, setProduct] = useState<Product>({
    title: "",
    description: "",
    price: "129.99",
    images: [],
    productType: "Watch",
    tags: "",
    audience: "Men",
    style: "Premium / Luxury",
  });

  const [result, setResult] = useState<Result | null>(null);
  const [generated, setGenerated] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [copied, setCopied] = useState("");

  const liveResult = useMemo(
    () => (product.title.trim() ? generateResult(product) : null),
    [product]
  );

  const update = <K extends keyof Product>(
    key: K,
    value: Product[K]
  ) => setProduct((current) => ({ ...current, [key]: value }));

  async function uploadImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 6);

    if (!files.length) return;

    const images = await Promise.all(files.map(readImage));
    update("images", images);
    setActiveImage(0);
    e.target.value = "";
  }

  function removeImage(index: number) {
    const images = product.images.filter((_, i) => i !== index);
    update("images", images);
    setActiveImage(Math.max(0, Math.min(activeImage, images.length - 1)));
  }

  function generate() {
    if (!product.title.trim()) {
      alert("Enter the original product title first.");
      return;
    }

    setResult(liveResult);
    setGenerated(true);

    window.setTimeout(
      () =>
        document
          .getElementById("preview")
          ?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  function reset() {
    setGenerated(false);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const active = result ?? liveResult;

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <div className="logo">VIRELLO</div>
          <div className="micro">AI PRODUCT OPTIMIZER</div>
        </div>

        <div className="status">
          <span /> Optimizer Ready
        </div>
      </header>

      {!generated ? (
        <section className="workspace">
          <div className="hero">
            <div className="eyebrow">PRODUCT OPTIMIZATION</div>

            <h1>
              Build product pages shoppers understand and want.
            </h1>

            <p>
              Turn raw product information into polished titles, persuasive
              descriptions, benefits, specifications, FAQs and SEO-ready copy.
            </p>
          </div>

          <div className="layout">
            <section className="card form-card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">01 / PRODUCT</div>
                  <h2>Product information</h2>
                </div>

                <span className="badge">6 images max</span>
              </div>

              <label>Original Product Title</label>

              <textarea
                value={product.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Paste the original product title"
              />

              <label>
                Original Description{" "}
                <span className="optional">Optional</span>
              </label>

              <textarea
                value={product.description}
                onChange={(e) =>
                  update("description", e.target.value)
                }
                placeholder="Paste the current product description if you have one"
              />

              <div className="grid2">
                <div>
                  <label>Price</label>

                  <div className="input money">
                    <span>$</span>

                    <input
                      value={product.price}
                      onChange={(e) =>
                        update("price", e.target.value)
                      }
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div>
                  <label>Product Type</label>

                  <input
                    className="input"
                    value={product.productType}
                    onChange={(e) =>
                      update("productType", e.target.value)
                    }
                    placeholder="Watch"
                  />
                </div>
              </div>

              <label>
                Product Tags{" "}
                <span className="optional">Optional</span>
              </label>

              <input
                className="input"
                value={product.tags}
                onChange={(e) =>
                  update("tags", e.target.value)
                }
                placeholder="luxury, watch, men's watch"
              />

              <div className="grid2">
                <div>
                  <label>Target Audience</label>

                  <div className="pills">
                    {["Women", "Men", "Unisex"].map((item) => (
                      <button
                        type="button"
                        className={
                          product.audience === item
                            ? "pill selected"
                            : "pill"
                        }
                        onClick={() =>
                          update("audience", item)
                        }
                        key={item}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label>Writing Style</label>

                  <select
                    className="input select"
                    value={product.style}
                    onChange={(e) =>
                      update("style", e.target.value)
                    }
                  >
                    <option>Premium / Luxury</option>
                    <option>Professional</option>
                    <option>Everyday</option>
                    <option>Casual</option>
                    <option>Sport</option>
                    <option>Gift</option>
                  </select>
                </div>
              </div>

              <label>Product Images</label>

              <div className="upload">
                <input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={uploadImages}
                />

                <label
                  htmlFor="images"
                  className="uploadButton"
                >
                  + Add Product Images
                </label>

                <p>
                  Testing mode: add up to 6 images. Shopify will supply
                  these automatically after integration.
                </p>
              </div>

              {product.images.length > 0 && (
                <div className="thumbGrid">
                  {product.images.map((image, index) => (
                    <div
                      className="thumb"
                      key={`${image}-${index}`}
                    >
                      <img
                        src={image}
                        alt={`Product ${index + 1}`}
                      />

                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="primary"
                onClick={generate}
              >
                Generate Optimized Product Page <span>→</span>
              </button>
            </section>

            <aside className="card live-card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">LIVE PREVIEW</div>
                  <h2>Product preview</h2>
                </div>
              </div>

              <div className="mini-product">
                <div className="mini-image">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt="Preview"
                    />
                  ) : (
                    <span>Product Image</span>
                  )}
                </div>

                <div className="mini-kicker">
                  PREMIUM COLLECTION
                </div>

                <h3>
                  {liveResult?.title ||
                    "Your optimized title will appear here"}
                </h3>

                <strong>
                  ${product.price || "0.00"}
                </strong>

                <p>
                  {liveResult?.description ||
                    "Enter your product information to preview optimized copy."}
                </p>

                <div className="mini-checks">
                  <span>✓ Benefits</span>
                  <span>✓ SEO</span>
                  <span>✓ FAQ</span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section id="preview" className="preview">
          <div className="previewTop">
            <button
              type="button"
              className="back"
              onClick={reset}
            >
              ← Edit Product
            </button>

            <div className="eyebrow">
              OPTIMIZED PRODUCT PAGE
            </div>
          </div>

          <div className="productHero">
            <div className="gallery">
              <div className="mainPhoto">
                {product.images[activeImage] ? (
                  <img
                    src={product.images[activeImage]}
                    alt={active?.title || "Product"}
                  />
                ) : (
                  <span>Product Image</span>
                )}
              </div>

              {product.images.length > 0 && (
                <div className="galleryThumbs">
                  {product.images.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={
                        index === activeImage
                          ? "galleryThumb active"
                          : "galleryThumb"
                      }
                      onClick={() =>
                        setActiveImage(index)
                      }
                    >
                      <img
                        src={image}
                        alt={`View ${index + 1}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="heroCopy">
              <div className="eyebrow">
                PREMIUM COLLECTION
              </div>

              <h2>{active?.title}</h2>

              <div className="priceLarge">
                ${product.price}
              </div>

              <p className="lead">
                {active?.description}
              </p>

              <div className="benefits">
                {active?.bullets.map((item) => (
                  <div key={item}>
                    ✓ {item}
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="primary"
              >
                ADD TO CART
              </button>

              <div className="trust">
                <span>Secure Checkout</span>
                <span>Easy Returns</span>
                <span>Customer Support</span>
              </div>
            </div>
          </div>

          <section className="resultSection">
            <div className="eyebrow">
              WHY IT STANDS OUT
            </div>

            <h3>
              Clear reasons to keep reading.
            </h3>

            <div className="fourCards">
              {active?.bullets.map((item, index) => (
                <article
                  className="feature"
                  key={item}
                >
                  <small>
                    0{index + 1}
                  </small>

                  <h4>
                    {
                      [
                        "Refined Design",
                        "Versatile Styling",
                        "Everyday Appeal",
                        "Gift Ready",
                      ][index]
                    }
                  </h4>

                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="resultSection">
            <div className="eyebrow">
              PRODUCT INFORMATION
            </div>

            <h3>
              Simple, useful specifications.
            </h3>

            <div className="specList">
              {active?.specs.map((spec) => {
                const [key, ...rest] =
                  spec.split(":");

                return (
                  <div
                    className="spec"
                    key={spec}
                  >
                    <span>{key}</span>

                    <strong>
                      {rest.join(":").trim()}
                    </strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="resultSection">
            <div className="eyebrow">
              FREQUENTLY ASKED QUESTIONS
            </div>

            <h3>
              Questions shoppers may have.
            </h3>

            <div className="faq">
              {active?.faq.map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                  </summary>

                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="resultSection">
            <div className="eyebrow">
              SEO
            </div>

            <h3>
              Search-ready content.
            </h3>

            <div className="seoGrid">
              <div className="seoBox">
                <div className="seoTop">
                  <strong>
                    SEO Title
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        "title",
                        active?.seoTitle || ""
                      )
                    }
                  >
                    {copied === "title"
                      ? "Copied"
                      : "Copy"}
                  </button>
                </div>

                <p>
                  {active?.seoTitle}
                </p>

                <small>
                  {active?.seoTitle.length}/60
                  {" "}characters
                </small>
              </div>

              <div className="seoBox">
                <div className="seoTop">
                  <strong>
                    Meta Description
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        "meta",
                        active?.metaDescription || ""
                      )
                    }
                  >
                    {copied === "meta"
                      ? "Copied"
                      : "Copy"}
                  </button>
                </div>

                <p>
                  {active?.metaDescription}
                </p>

                <small>
                  {active?.metaDescription.length}/160
                  {" "}characters
                </small>
              </div>
            </div>
          </section>

          <section className="resultSection finalCallout">
            <div className="eyebrow">
              VIRELLO
            </div>

            <h3>
              From raw product data to a clearer
              buying decision.
            </h3>

            <p>
              This preview is designed as the
              optimizer layer. In the Shopify
              version, the product data and images
              will be supplied directly by the
              connected store.
            </p>

            <button
              type="button"
              className="primary"
            >
              READY FOR SHOPIFY INTEGRATION →
            </button>
          </section>
        </section>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f5f2;
          color: #151515;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
        }

        .topbar {
          height: 82px;
          padding: 0 5vw;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #deded9;
          background: #fff;
        }

        .logo {
          font-weight: 800;
          letter-spacing: .12em;
          font-size: 19px;
        }

        .micro,
        .eyebrow {
          font-size: 11px;
          letter-spacing: .13em;
          font-weight: 700;
          color: #777;
        }

        .micro {
          margin-top: 3px;
          font-weight: 500;
        }

        .status {
          font-size: 13px;
          color: #666;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .status span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #111;
          display: inline-block;
        }

        .workspace,
        .preview {
          width: min(1220px, 90vw);
          margin: auto;
        }

        .workspace {
          padding: 70px 0 100px;
        }

        .hero {
          max-width: 900px;
          margin-bottom: 52px;
        }

        .hero h1 {
          font-size: clamp(48px, 7vw, 86px);
          line-height: .96;
          letter-spacing: -.055em;
          margin: 22px 0;
        }

        .hero p {
          max-width: 720px;
          font-size: 19px;
          line-height: 1.55;
          color: #555;
          margin: 0;
        }

        .layout {
          display: grid;
          grid-template-columns: 1.35fr .65fr;
          gap: 22px;
        }

        .card {
          background: #fff;
          border: 1px solid #deded9;
          border-radius: 22px;
          padding: 32px;
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 30px;
        }

        .section-head h2 {
          font-size: 25px;
          margin: 9px 0 0;
          letter-spacing: -.03em;
        }

        .badge {
          border: 1px solid #ddd;
          border-radius: 99px;
          padding: 8px 11px;
          font-size: 11px;
          color: #666;
        }

        label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin: 22px 0 8px;
        }

        .optional {
          font-weight: 400;
          color: #999;
        }

        textarea,
        .input {
          width: 100%;
          border: 1px solid #d7d7d2;
          background: #fafaf8;
          border-radius: 11px;
          outline: none;
        }

        textarea {
          min-height: 105px;
          padding: 14px;
          resize: vertical;
        }

        textarea:focus,
        .input:focus {
          border-color: #111;
          background: #fff;
        }

        .input {
          height: 48px;
          padding: 0 13px;
        }

        .money {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .money input {
          border: 0;
          outline: 0;
          background: transparent;
          width: 100%;
          height: 100%;
        }

        .select {
          appearance: auto;
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .pills {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .pill {
          border: 1px solid #d7d7d2;
          background: #fff;
          border-radius: 99px;
          padding: 11px 14px;
        }

        .pill.selected {
          background: #151515;
          color: #fff;
          border-color: #151515;
        }

        .upload {
          border: 1px dashed #c9c9c3;
          background: #fafaf8;
          border-radius: 14px;
          text-align: center;
          padding: 22px;
        }

        .upload input {
          display: none;
        }

        .uploadButton {
          display: inline-flex !important;
          margin: 0 !important;
          align-items: center;
          justify-content: center;
          background: #151515;
          color: #fff;
          border-radius: 9px;
          padding: 13px 17px;
          cursor: pointer;
        }

        .upload p {
          font-size: 12px;
          color: #888;
          margin: 10px 0 0;
        }

        .thumbGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .thumb {
          position: relative;
          aspect-ratio: 1;
          border-radius: 9px;
          overflow: hidden;
          border: 1px solid #ddd;
        }

        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumb button {
          position: absolute;
          right: 4px;
          top: 4px;
          border: 0;
          border-radius: 50%;
          width: 23px;
          height: 23px;
          background: #111;
          color: #fff;
          line-height: 1;
        }

        .primary {
          width: 100%;
          min-height: 56px;
          border: 0;
          border-radius: 10px;
          background: #151515;
          color: #fff;
          font-weight: 750;
          margin-top: 28px;
        }

        .primary span {
          margin-left: 7px;
        }

        .live-card {
          height: max-content;
          position: sticky;
          top: 20px;
        }

        .mini-product {
          border: 1px solid #e1e1dc;
          border-radius: 16px;
          padding: 16px;
        }

        .mini-image {
          aspect-ratio: 1;
          background: #eee;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          overflow: hidden;
        }

        .mini-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mini-kicker {
          font-size: 10px;
          letter-spacing: .12em;
          color: #777;
          margin-top: 20px;
        }

        .mini-product h3 {
          font-size: 25px;
          line-height: 1.05;
          letter-spacing: -.035em;
          margin: 10px 0 13px;
        }

        .mini-product > strong {
          font-size: 18px;
        }

        .mini-product p {
          font-size: 13px;
          line-height: 1.55;
          color: #666;
        }

        .mini-checks {
          display: grid;
          gap: 7px;
          font-size: 12px;
          color: #555;
        }

        .preview {
          padding: 35px 0 100px;
        }

        .previewTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 38px;
        }

        .back {
          background: #fff;
          border: 1px solid #d7d7d2;
          border-radius: 9px;
          padding: 11px 14px;
        }

        .productHero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 70px;
        }

        .mainPhoto {
          aspect-ratio: 1;
          background: #eee;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: #999;
        }

        .mainPhoto img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .galleryThumbs {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-top: 9px;
        }

        .galleryThumb {
          border: 1px solid #ddd;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          padding: 0;
          aspect-ratio: 1;
        }

        .galleryThumb.active {
          border: 2px solid #111;
        }

        .galleryThumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .heroCopy {
          padding-top: 25px;
        }

        .heroCopy h2 {
          font-size: clamp(42px, 5vw, 70px);
          line-height: 1;
          letter-spacing: -.055em;
          margin: 18px 0;
        }

        .priceLarge {
          font-size: 24px;
          font-weight: 700;
          margin: 24px 0;
        }

        .lead {
          font-size: 18px;
          line-height: 1.65;
          color: #4d4d4d;
          max-width: 650px;
        }

        .benefits {
          display: grid;
          gap: 10px;
          margin-top: 28px;
          line-height: 1.45;
        }

        .trust {
          display: flex;
          gap: 17px;
          flex-wrap: wrap;
          color: #777;
          font-size: 12px;
          margin-top: 14px;
        }

        .resultSection {
          border-top: 1px solid #d4d4cf;
          margin-top: 100px;
          padding-top: 44px;
        }

        .resultSection h3 {
          font-size: clamp(40px, 5vw, 64px);
          line-height: 1;
          letter-spacing: -.05em;
          max-width: 850px;
          margin: 18px 0 34px;
        }

        .fourCards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
        }

        .feature {
          background: #fff;
          border: 1px solid #deded9;
          border-radius: 17px;
          padding: 23px;
        }

        .feature small {
          color: #888;
        }

        .feature h4 {
          font-size: 19px;
          margin: 28px 0 9px;
        }

        .feature p {
          font-size: 13px;
          line-height: 1.55;
          color: #666;
          margin: 0;
        }

        .specList {
          border-top: 1px solid #ccc;
        }

        .spec {
          display: flex;
          justify-content: space-between;
          padding: 18px 0;
          border-bottom: 1px solid #ccc;
          gap: 20px;
        }

        .spec span {
          color: #777;
        }

        .spec strong {
          text-align: right;
        }

        .faq details {
          border-top: 1px solid #ccc;
          padding: 21px 0;
        }

        .faq details:last-child {
          border-bottom: 1px solid #ccc;
        }

        summary {
          font-weight: 700;
          cursor: pointer;
        }

        .faq p {
          max-width: 700px;
          color: #666;
          line-height: 1.6;
        }

        .seoGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .seoBox {
          background: #fff;
          border: 1px solid #deded9;
          border-radius: 17px;
          padding: 22px;
        }

        .seoTop {
          display: flex;
          justify-content: space-between;
        }

        .seoTop button {
          border: 0;
          background: transparent;
          text-decoration: underline;
        }

        .seoBox p {
          line-height: 1.5;
        }

        .seoBox small {
          color: #38805a;
        }

        .finalCallout {
          padding-bottom: 20px;
        }

        .finalCallout p {
          max-width: 720px;
          color: #666;
          line-height: 1.6;
          font-size: 18px;
        }

        @media (max-width: 900px) {
          .layout,
          .productHero {
            grid-template-columns: 1fr;
          }

          .live-card {
            position: static;
          }

          .fourCards {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .topbar {
            padding: 0 4vw;
          }

          .workspace,
          .preview {
            width: 92vw;
          }

          .workspace {
            padding-top: 40px;
          }

          .grid2,
          .seoGrid {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 21px;
          }

          .thumbGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .productHero {
            gap: 35px;
          }

          .heroCopy {
            padding-top: 0;
          }

          .fourCards {
            grid-template-columns: 1fr;
          }

          .spec {
            flex-direction: column;
          }

          .spec strong {
            text-align: left;
          }

          .previewTop {
            align-items: flex-start;
            gap: 15px;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
