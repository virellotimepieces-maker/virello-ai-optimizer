"use client";

import { useState } from "react";

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function limit(value: string, max: number) {
  const text = clean(value);

  if (text.length <= max) return text;

  return text
    .slice(0, max)
    .replace(/\s+\S*$/, "")
    .trim();
}

function slugify(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function unique(values: string[]) {
  return Array.from(
    new Set(values.map(clean).filter(Boolean))
  );
}

export default function Home() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");
  const [collection, setCollection] = useState("");
  const [audience, setAudience] = useState("");

  const [result, setResult] = useState({
    title: "",
    description: "",
    seoTitle: "",
    meta: "",
    type: "",
    tags: "",
    keywords: "",
    alt: "",
    handle: "",
  });

  function optimize() {
    const originalTitle =
      clean(title) || "New Product";

    const originalDescription =
      clean(description);

    const type =
      clean(productType) || "Product";

    const brandName =
      clean(brand);

    const featureList = features
      .split(/[\n,;•]+/)
      .map(clean)
      .filter(Boolean)
      .slice(0, 8);

    let newTitle = originalTitle
      .replace(/[|•·]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (brandName) {
      const pattern = new RegExp(
        brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi"
      );

      newTitle = newTitle.replace(pattern, "").trim();
    }

    newTitle = limit(newTitle, 65);

    if (!newTitle) {
      newTitle = `${brandName || "Premium"} ${type}`;
    }

    const descriptionText =
      originalDescription ||
      `Discover a thoughtfully designed ${type.toLowerCase()} made for everyday use.`;

    const audienceText = audience
      ? `Designed with ${clean(audience).toLowerCase()} in mind.`
      : "Designed for customers who value quality, style, and everyday practicality.";

    const featuresText =
      featureList.length > 0
        ? featureList.map((item) => `• ${item}`).join("\n")
        : [
            "• Thoughtful design",
            "• Practical everyday use",
            "• Versatile styling",
            "• Easy to use",
          ].join("\n");

    const finalDescription = [
      descriptionText,
      "",
      audienceText,
      "",
      "Key features:",
      featuresText,
      "",
      "A polished choice for customers looking for quality, useful features, and dependable everyday appeal.",
    ].join("\n");

    const seoBase = brandName
      ? `${newTitle} | ${brandName}`
      : newTitle;

    const seoTitle = limit(seoBase, 50);

    const meta = limit(
      `Shop ${newTitle.toLowerCase()} with thoughtful design, useful features, and everyday appeal. Explore this product and discover quality made for your needs.`,
      160
    );

    const keywordValues = unique([
      newTitle,
      type,
      brandName,
      collection,
      ...featureList,
    ]);

    const tagValues = unique([
      type,
      brandName,
      collection,
      ...featureList,
      "new arrival",
      "featured",
    ]);

    const alt = limit(
      `${newTitle}${brandName ? ` by ${brandName}` : ""}`,
      125
    );

    setResult({
      title: newTitle,
      description: finalDescription,
      seoTitle,
      meta,
      type,
      tags: tagValues.slice(0, 12).join(", "),
      keywords: keywordValues.slice(0, 15).join(", "),
      alt,
      handle: slugify(newTitle),
    });
  }

  function clearAll() {
    setTitle("");
    setDescription("");
    setFeatures("");
    setProductType("");
    setBrand("");
    setCollection("");
    setAudience("");

    setResult({
      title: "",
      description: "",
      seoTitle: "",
      meta: "",
      type: "",
      tags: "",
      keywords: "",
      alt: "",
      handle: "",
    });
  }

  async function copy(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  }

  return (
    <main className="app">
      <header className="header">
        <div className="logo">V</div>

        <div>
          <div className="brand">Virello</div>
          <div className="sub">AI OPTIMIZER</div>
        </div>

        <div className="badge">
          ALL PRODUCT TYPES
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          VIRELLO AI OPTIMIZER
        </div>

        <h1>
          Optimize every
          <span> product listing.</span>
        </h1>

        <p>
          Create polished, professional product content
          without supplier-style wording.
        </p>
      </section>

      <section className="workspace">

        <div className="card">
          <div className="heading">
            <small>01</small>
            <h2>Product information</h2>
          </div>

          <label>ORIGINAL PRODUCT TITLE *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Paste original product title"
          />

          <label>PRODUCT DESCRIPTION</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste original product description"
            rows={7}
          />

          <label>FEATURES</label>
          <textarea
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Materials, size, functions, specifications, etc."
            rows={6}
          />

          <div className="grid">
            <div>
              <label>PRODUCT TYPE</label>
              <input
                value={productType}
                onChange={(e) =>
                  setProductType(e.target.value)
                }
                placeholder="Any product type"
              />
            </div>

            <div>
              <label>BRAND</label>
              <input
                value={brand}
                onChange={(e) =>
                  setBrand(e.target.value)
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid">
            <div>
              <label>COLLECTION</label>
              <input
                value={collection}
                onChange={(e) =>
                  setCollection(e.target.value)
                }
                placeholder="Optional"
              />
            </div>

            <div>
              <label>TARGET CUSTOMER</label>
              <input
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value)
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="buttons">
            <button
              className="primary"
              onClick={optimize}
              type="button"
            >
              Optimize Product
            </button>

            <button
              className="secondary"
              onClick={clearAll}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="card">
          <div className="heading resultHeading">
            <div>
              <small>02</small>
              <h2>Optimized listing</h2>
            </div>

            {result.title && (
              <span className="ready">
                READY
              </span>
            )}
          </div>

          {!result.title ? (
            <div className="empty">
              <div className="emptyLogo">
                V
              </div>

              <h3>
                Your optimized listing will appear here
              </h3>

              <p>
                Add your product information and select
                Optimize Product.
              </p>
            </div>
          ) : (
            <div>

              <Output
                label="PRODUCT TITLE"
                value={result.title}
                max={65}
                copy={copy}
              />

              <Output
                label="DESCRIPTION"
                value={result.description}
                copy={copy}
                large
              />

              <Output
                label="SEO TITLE"
                value={result.seoTitle}
                max={50}
                copy={copy}
              />

              <Output
                label="META DESCRIPTION"
                value={result.meta}
                max={160}
                copy={copy}
              />

              <Output
                label="PRODUCT TYPE"
                value={result.type}
                copy={copy}
              />

              <Output
                label="SEO KEYWORDS"
                value={result.keywords}
                copy={copy}
              />

              <Output
                label="PRODUCT TAGS"
                value={result.tags}
                copy={copy}
              />

              <Output
                label="IMAGE ALT TEXT"
                value={result.alt}
                max={125}
                copy={copy}
              />

              <Output
                label="URL HANDLE"
                value={result.handle}
                max={70}
                copy={copy}
              />

            </div>
          )}
        </div>

      </section>

      <footer>
        <strong>Virello AI Optimizer</strong>
        <span>
          Universal product content optimization
        </span>
      </footer>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f5f3;
          color: #171717;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
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

        .app {
          min-height: 100vh;
        }

        .header {
          height: 72px;
          padding: 0 32px;
          background: #111;
          color: white;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo {
          width: 38px;
          height: 38px;
          border: 1px solid #555;
          border-radius: 10px;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 19px;
        }

        .brand {
          font-weight: 800;
          font-size: 18px;
        }

        .sub {
          color: #999;
          font-size: 9px;
          letter-spacing: 2px;
          margin-top: 2px;
        }

        .badge {
          margin-left: auto;
          border: 1px solid #444;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 9px;
          letter-spacing: 1px;
          color: #bbb;
        }

        .hero {
          max-width: 1180px;
          margin: auto;
          padding: 65px 28px 45px;
        }

        .eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 16px;
        }

        .hero h1 {
          max-width: 800px;
          margin: 0;
          font-size: clamp(42px, 7vw, 76px);
          line-height: .98;
          letter-spacing: -4px;
        }

        .hero h1 span {
          display: block;
          color: #777;
        }

        .hero p {
          max-width: 650px;
          color: #666;
          font-size: 17px;
          line-height: 1.6;
          margin-top: 25px;
        }

        .workspace {
          max-width: 1180px;
          margin: auto;
          padding: 0 28px 60px;
          display: grid;
          grid-template-columns: .9fr 1.1fr;
          gap: 22px;
        }

        .card {
          background: white;
          border: 1px solid #deded9;
          border-radius: 17px;
          padding: 25px;
          box-shadow:
            0 8px 30px rgba(0,0,0,.04);
        }

        .heading {
          border-bottom: 1px solid #ededeb;
          padding-bottom: 20px;
          margin-bottom: 22px;
        }

        .heading small {
          font-size: 9px;
          color: #888;
          letter-spacing: 2px;
        }

        .heading h2 {
          margin: 5px 0 0;
          font-size: 22px;
          letter-spacing: -.5px;
        }

        .resultHeading {
          display: flex;
          justify-content: space-between;
        }

        .ready {
          font-size: 9px;
          letter-spacing: 1px;
          font-weight: 800;
          color: #555;
        }

        label {
          display: block;
          margin: 0 0 7px;
          font-size: 9px;
          letter-spacing: 1.3px;
          font-weight: 800;
          color: #555;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #d6d6d2;
          border-radius: 9px;
          background: #fafaf9;
          padding: 12px;
          margin-bottom: 17px;
          outline: none;
          color: #171717;
        }

        input {
          min-height: 45px;
        }

        textarea {
          resize: vertical;
          line-height: 1.5;
        }

        input:focus,
        textarea:focus {
          border-color: #111;
          background: white;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .buttons {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 9px;
          margin-top: 8px;
        }

        .primary,
        .secondary {
          min-height: 47px;
          border-radius: 9px;
          cursor: pointer;
          font-weight: 800;
          padding: 0 17px;
        }

        .primary {
          background: #111;
          color: white;
          border: 1px solid #111;
        }

        .secondary {
          background: white;
          color: #222;
          border: 1px solid #ccc;
        }

        .empty {
          min-height: 500px;
          border: 1px dashed #d7d7d2;
          border-radius: 13px;
          display: grid;
          place-items: center;
          align-content: center;
          text-align: center;
          padding: 30px;
        }

        .emptyLogo {
          width: 55px;
          height: 55px;
          border-radius: 14px;
          background: #111;
          color: white;
          display: grid;
          place-items: center;
          font-size: 23px;
          font-weight: 800;
          margin-bottom: 17px;
        }

        .empty h3 {
          margin: 0;
          font-size: 18px;
        }

        .empty p {
          max-width: 370px;
          color: #777;
          line-height: 1.6;
        }

        .output {
          border: 1px solid #deded9;
          border-radius: 11px;
          overflow: hidden;
          margin-bottom: 13px;
        }

        .outputTop {
          min-height: 45px;
          padding: 8px 10px 8px 13px;
          background: #fafaf9;
          border-bottom: 1px solid #e8e8e5;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .outputTop label {
          margin: 0;
        }

        .counter {
          font-size: 9px;
          color: #888;
          margin-left: 7px;
        }

        .copy {
          border: 1px solid #ccc;
          background: white;
          border-radius: 7px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .output textarea {
          border: 0;
          border-radius: 0;
          background: white;
          margin: 0;
          resize: vertical;
        }

        footer {
          max-width: 1180px;
          margin: auto;
          padding: 25px 28px 45px;
          border-top: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          color: #888;
          font-size: 11px;
        }

        @media (max-width: 850px) {
          .workspace {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .header {
            padding: 0 16px;
          }

          .badge {
            display: none;
          }

          .hero,
          .workspace {
            padding-left: 15px;
            padding-right: 15px;
          }

          .hero h1 {
            letter-spacing: -2px;
          }

          .grid,
          .buttons {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 18px;
          }

          footer {
            padding-left: 15px;
            padding-right: 15px;
            flex-direction: column;
            gap: 8px;
          }
        }
      `}</style>
    </main>
  );
}

function Output({
  label,
  value,
  max,
  copy,
  large,
}: {
  label: string;
  value: string;
  max?: number;
  copy: (value: string) => void;
  large?: boolean;
}) {
  return (
    <div className="output">
      <div className="outputTop">
        <div>
          <label>{label}</label>

          {max !== undefined && (
            <span className="counter">
              {value.length}/{max}
            </span>
          )}
        </div>

        <button
          type="button"
          className="copy"
          onClick={() => copy(value)}
        >
          Copy
        </button>
      </div>

      <textarea
        value={value}
        readOnly
        rows={large ? 9 : 4}
      />
    </div>
  );
}
