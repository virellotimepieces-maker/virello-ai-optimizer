"use client";

import { useState } from "react";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
}: FieldProps) {
  return (
    <div className="field">
      <label>{label}</label>

      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={6}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="copyButton" onClick={copyText} type="button">
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function Home() {
  const [productName, setProductName] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [audience, setAudience] = useState("");
  const [price, setPrice] = useState("");
  const [generated, setGenerated] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [tags, setTags] = useState("");

  function optimizeProduct() {
    const name =
      productName.trim() || "Premium Everyday Product";

    const details =
      productDetails.trim() ||
      "Designed with practical features, a refined look, and everyday usability.";

    const target =
      audience.trim() || "customers looking for quality and convenience";

    const optimizedTitle =
      name.length > 65
        ? name.slice(0, 65).trim()
        : name;

    const optimizedDescription = `${details}

Designed for ${target}, this product combines practical functionality with a clean, considered design.

Key features:
• Thoughtful, everyday functionality
• Clean and versatile design
• Easy to use
• Made for convenient everyday use
• A practical addition to your routine

A simple choice for customers who value quality, functionality, and a polished shopping experience.`;

    const seo =
      `${optimizedTitle} | Virello`;

    const meta =
      `Discover ${optimizedTitle.toLowerCase()} with practical features, refined design, and everyday functionality. Shop with confidence.`;

    const type =
      name.toLowerCase().includes("watch")
        ? "Watches"
        : name.toLowerCase().includes("shirt") ||
          name.toLowerCase().includes("dress") ||
          name.toLowerCase().includes("jacket")
        ? "Apparel"
        : name.toLowerCase().includes("bath") ||
          name.toLowerCase().includes("shower") ||
          name.toLowerCase().includes("faucet")
        ? "Bathroom"
        : "Lifestyle";

    const generatedTags = [
      "featured",
      "new arrival",
      "best seller",
      "everyday essentials",
      type.toLowerCase(),
    ].join(", ");

    setTitle(optimizedTitle);
    setDescription(optimizedDescription);
    setSeoTitle(seo.slice(0, 70));
    setMetaDescription(meta.slice(0, 160));
    setProductType(type);
    setTags(generatedTags);
    setGenerated(true);
  }

  function clearAll() {
    setProductName("");
    setProductDetails("");
    setAudience("");
    setPrice("");
    setTitle("");
    setDescription("");
    setSeoTitle("");
    setMetaDescription("");
    setProductType("");
    setTags("");
    setGenerated(false);
  }

  return (
    <main className="page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f6f7f9;
          color: #17181a;
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

        .page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top right,
              rgba(30, 41, 59, 0.06),
              transparent 34%
            ),
            #f6f7f9;
        }

        .topbar {
          height: 72px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 34px;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .brandMark {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          background: #111827;
          color: #ffffff;
          display: grid;
          place-items: center;
          font-size: 16px;
        }

        .brandName {
          font-size: 18px;
        }

        .brandSub {
          color: #8a8f98;
          font-weight: 500;
          font-size: 13px;
          margin-left: 3px;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #5f6670;
          font-size: 13px;
        }

        .statusDot {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
        }

        .container {
          width: min(1180px, calc(100% - 32px));
          margin: 0 auto;
          padding: 54px 0 80px;
        }

        .hero {
          margin-bottom: 34px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 11px;
          border-radius: 999px;
          background: #ffffff;
          border: 1px solid #e4e7eb;
          color: #59616d;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .hero h1 {
          font-size: clamp(34px, 5vw, 58px);
          line-height: 1.02;
          letter-spacing: -2.8px;
          max-width: 760px;
          margin: 18px 0 14px;
        }

        .hero p {
          max-width: 680px;
          color: #68707b;
          font-size: 17px;
          line-height: 1.65;
          margin: 0;
        }

        .layout {
          display: grid;
          grid-template-columns: 0.88fr 1.12fr;
          gap: 22px;
          align-items: start;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e2e5e9;
          border-radius: 18px;
          box-shadow: 0 8px 30px rgba(15, 23, 42, 0.045);
        }

        .cardHeader {
          padding: 23px 24px 18px;
          border-bottom: 1px solid #eceef1;
        }

        .cardHeader h2 {
          font-size: 18px;
          margin: 0 0 6px;
          letter-spacing: -0.4px;
        }

        .cardHeader p {
          color: #747b85;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
        }

        .cardBody {
          padding: 24px;
        }

        .field {
          margin-bottom: 19px;
        }

        .field:last-child {
          margin-bottom: 0;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #30353b;
        }

        .field input,
        .field textarea {
          width: 100%;
          border: 1px solid #dfe3e8;
          background: #fbfcfd;
          color: #17181a;
          border-radius: 11px;
          padding: 12px 13px;
          outline: none;
          transition: 0.15s ease;
        }

        .field input {
          height: 46px;
        }

        .field textarea {
          resize: vertical;
          min-height: 125px;
          line-height: 1.55;
        }

        .field input:focus,
        .field textarea:focus {
          border-color: #9ca3af;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .actions {
          display: flex;
          gap: 10px;
          margin-top: 23px;
        }

        .primaryButton,
        .secondaryButton {
          border: 0;
          border-radius: 11px;
          height: 46px;
          padding: 0 18px;
          cursor: pointer;
          font-weight: 750;
        }

        .primaryButton {
          flex: 1;
          background: #111827;
          color: #ffffff;
        }

        .primaryButton:hover {
          background: #202938;
        }

        .secondaryButton {
          background: #f1f3f5;
          color: #343941;
        }

        .resultGrid {
          display: grid;
          gap: 16px;
        }

        .resultBox {
          border: 1px solid #e4e7eb;
          border-radius: 13px;
          background: #fcfcfd;
          overflow: hidden;
        }

        .resultTop {
          min-height: 47px;
          padding: 12px 13px;
          border-bottom: 1px solid #e8eaed;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .resultLabel {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #707781;
        }

        .copyButton {
          border: 1px solid #dfe3e8;
          background: #ffffff;
          color: #3d434b;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .copyButton:hover {
          background: #f3f4f6;
        }

        .resultContent {
          padding: 14px;
          font-size: 14px;
          line-height: 1.65;
          white-space: pre-wrap;
          color: #252a31;
          min-height: 48px;
        }

        .emptyState {
          min-height: 410px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 35px;
        }

        .emptyIcon {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          background: #f0f2f4;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          font-size: 23px;
        }

        .emptyState h3 {
          margin: 0 0 7px;
          font-size: 17px;
        }

        .emptyState p {
          max-width: 360px;
          margin: 0 auto;
          color: #7a818b;
          line-height: 1.6;
          font-size: 13px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 17px;
        }

        .stat {
          background: #f7f8f9;
          border: 1px solid #e8eaed;
          border-radius: 11px;
          padding: 12px;
        }

        .stat strong {
          display: block;
          font-size: 17px;
          margin-bottom: 3px;
        }

        .stat span {
          color: #7b828c;
          font-size: 11px;
        }

        .tips {
          margin-top: 22px;
          padding: 16px;
          border-radius: 13px;
          background: #f7f8fa;
          border: 1px solid #e7e9ec;
        }

        .tipsTitle {
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .tips ul {
          margin: 0;
          padding-left: 18px;
          color: #707780;
          font-size: 12px;
          line-height: 1.7;
        }

        .footer {
          margin-top: 34px;
          text-align: center;
          color: #969ca5;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .hero h1 {
            letter-spacing: -1.8px;
          }
        }

        @media (max-width: 600px) {
          .topbar {
            padding: 0 17px;
          }

          .brandSub {
            display: none;
          }

          .container {
            width: min(100% - 22px, 1180px);
            padding-top: 35px;
          }

          .hero p {
            font-size: 15px;
          }

          .cardHeader,
          .cardBody {
            padding: 18px;
          }

          .stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brandMark">V</div>
          <div className="brandName">
            Virello <span className="brandSub">AI Optimizer</span>
          </div>
        </div>

        <div className="status">
          <span className="statusDot" />
          Ready
        </div>
      </header>

      <div className="container">
        <section className="hero">
          <div className="eyebrow">Product Optimization</div>

          <h1>
            Turn product information into a stronger store listing.
          </h1>

          <p>
            Create polished product titles, descriptions, SEO metadata,
            product types, and tags from one simple workspace.
          </p>
        </section>

        <div className="layout">
          <section className="card">
            <div className="cardHeader">
              <h2>Product details</h2>
              <p>
                Enter the information you already have. Virello will organize
                it into a cleaner product listing.
              </p>
            </div>

            <div className="cardBody">
              <Field
                label="Product name"
                value={productName}
                onChange={setProductName}
                placeholder="Example: Automatic Stainless Steel Watch"
              />

              <Field
                label="Product details"
                value={productDetails}
                onChange={setProductDetails}
                placeholder="Describe materials, features, design, functions, size, finish, or anything important about the product."
                textarea
              />

              <Field
                label="Target customer"
                value={audience}
                onChange={setAudience}
                placeholder="Example: customers looking for a refined everyday watch"
              />

              <Field
                label="Price"
                value={price}
                onChange={setPrice}
                placeholder="Example: $129.00"
              />

              <div className="actions">
                <button
                  className="primaryButton"
                  onClick={optimizeProduct}
                  type="button"
                >
                  Optimize Product
                </button>

                <button
                  className="secondaryButton"
                  onClick={clearAll}
                  type="button"
                >
                  Clear
                </button>
              </div>

              <div className="tips">
                <div className="tipsTitle">For better results</div>

                <ul>
                  <li>Include the main product material.</li>
                  <li>Mention important functions or features.</li>
                  <li>Describe who the product is designed for.</li>
                  <li>Avoid copying the supplier's original wording.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="cardHeader">
              <h2>Optimized listing</h2>
              <p>
                Ready-to-use content for your storefront and search results.
              </p>
            </div>

            {generated ? (
              <div className="cardBody">
                <div className="resultGrid">
                  <div className="resultBox">
                    <div className="resultTop">
                      <span className="resultLabel">
                        Product title
                      </span>

                      <CopyButton value={title} />
                    </div>

                    <div className="resultContent">
                      {title}
                    </div>
                  </div>

                  <div className="resultBox">
                    <div className="resultTop">
                      <span className="resultLabel">
                        Product description
                      </span>

                      <CopyButton value={description} />
                    </div>

                    <div className="resultContent">
                      {description}
                    </div>
                  </div>

                  <div className="resultBox">
                    <div className="resultTop">
                      <span className="resultLabel">
                        SEO title
                      </span>

                      <CopyButton value={seoTitle} />
                    </div>

                    <div className="resultContent">
                      {seoTitle}
                    </div>
                  </div>

                  <div className="resultBox">
                    <div className="resultTop">
                      <span className="resultLabel">
                        Meta description
                      </span>

                      <CopyButton value={metaDescription} />
                    </div>

                    <div className="resultContent">
                      {metaDescription}
                    </div>
                  </div>

                  <div className="resultBox">
                    <div className="resultTop">
                      <span className="resultLabel">
                        Product type
                      </span>

                      <CopyButton value={productType} />
                    </div>

                    <div className="resultContent">
                      {productType}
                    </div>
                  </div>

                  <div className="resultBox">
                    <div className="resultTop">
                      <span className="resultLabel">
                        Product tags
                      </span>

                      <CopyButton value={tags} />
                    </div>

                    <div className="resultContent">
                      {tags}
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <div className="stat">
                    <strong>
                      {title.length}
                    </strong>
                    <span>Title characters</span>
                  </div>

                  <div className="stat">
                    <strong>
                      {seoTitle.length}
                    </strong>
                    <span>SEO title characters</span>
                  </div>

                  <div className="stat">
                    <strong>
                      {metaDescription.length}
                    </strong>
                    <span>Meta characters</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="emptyState">
                <div>
                  <div className="emptyIcon">✦</div>

                  <h3>Your optimized listing will appear here</h3>

                  <p>
                    Add your product information on the left, then select
                    Optimize Product to generate the complete listing.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="footer">
          Virello AI Optimizer · Built for cleaner, more professional
          ecommerce listings.
        </div>
      </div>
    </main>
  );
}

function limit(text: string, max: number) {
  return text.trim().slice(0, max).trim();
}

function makeHandle(text: string) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

function unique(items: string[]) {
  return Array.from(
    new Set(items.map((item) => cleanText(item)).filter(Boolean))
  );
}

function CharacterCount({
  value,
  max,
}: {
  value: string;
  max: number;
}) {
  const good = value.length > 0 && value.length <= max;

  return (
    <span className={`counter ${good ? "good" : ""}`}>
      {value.length}/{max}
    </span>
  );
}

function OutputBox({
  label,
  value,
  max,
}: {
  label: string;
  value: string;
  max?: number;
}) {
  return (
    <div className="outputBlock">
      <div className="outputHeader">
        <h3>{label}</h3>

        {max ? (
          <CharacterCount value={value} max={max} />
        ) : (
          <span className="counter">{value.length} characters</span>
        )}
      </div>

      <div className="outputBox">
        {value || "Your optimized content will appear here."}
        {value && <CopyButton value={value} />}
      </div>
    </div>
  );
}

export default function ProductOptimizer() {
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("Horizon Timepieces");
  const [collection, setCollection] = useState("");
  const [price, setPrice] = useState("");

  const [optimized, setOptimized] = useState(false);

  const [productTitle, setProductTitle] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tags, setTags] = useState("");
  const [altText, setAltText] = useState("");
  const [handle, setHandle] = useState("");

  function cleanText(text: string) {
    return text
      .replace(/\b(new|hot|sale|top|cheap|best|2024|2025|2026)\b/gi, "")
      .replace(/\bwholesale\b/gi, "")
      .replace(/\bfree shipping\b/gi, "")
      .replace(/\bfor men\b/gi, "")
      .replace(/\bfor women\b/gi, "")
      .replace(/\bmen's watches\b/gi, "Men's Watch")
      .replace(/\bwatches\b/gi, "Watch")
      .replace(/\s+/g, " ")
      .replace(/^[\s\-|,:]+|[\s\-|,:]+$/g, "")
      .trim();
  }

  function shortenTitle(text: string, max = 70) {
    let result = text.replace(/\s+/g, " ").trim();

    if (result.length <= max) return result;

    const words = result.split(" ");
    let shortened = "";

    for (const word of words) {
      const next = shortened ? `${shortened} ${word}` : word;

      if (next.length > max) break;

      shortened = next;
    }

    return shortened.replace(/[\s\-|,:]+$/g, "").trim();
  }

  function makeHandle(text: string) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70);
  }

  function optimizeProduct() {
    const rawTitle = cleanText(originalTitle);
    const rawDescription = cleanText(originalDescription);
    const rawFeatures = cleanText(features);

    const source = `${rawTitle} ${rawDescription} ${rawFeatures}`
      .replace(/\s+/g, " ")
      .trim();

    const lowerSource = source.toLowerCase();

    const isWatch =
      lowerSource.includes("watch") ||
      lowerSource.includes("timepiece") ||
      productType.toLowerCase().includes("watch");

    let finalTitle = rawTitle;

    if (!finalTitle) {
      finalTitle = productType.trim() || "Classic Everyday Watch";
    }

    if (isWatch) {
      finalTitle = finalTitle
        .replace(/\bmen's\b/gi, "Men's")
        .replace(/\bmens\b/gi, "Men's")
        .replace(/\bquartz watch\b/gi, "Quartz Watch")
        .replace(/\bwatch for men\b/gi, "Men's Watch")
        .trim();

      if (!/\bwatch\b/i.test(finalTitle)) {
        finalTitle += " Watch";
      }
    }

    finalTitle = shortenTitle(finalTitle, 70);

    const polishedDescription =
      isWatch
        ? `${finalTitle} is designed for a clean, refined look that works effortlessly from everyday wear to more polished occasions. Its balanced design makes it an easy addition to a modern wardrobe.`
        : `${finalTitle} is designed with a clean, refined look and versatile character. A considered choice for everyday use, it brings a polished finish to your personal style.`;

    const benefitLines = isWatch
      ? [
          "Refined design for a polished everyday look",
          "Easy to style with casual and smart outfits",
          "Versatile enough for work, weekends and evenings",
          "Timeless styling that complements a modern wardrobe",
        ]
      : [
          "Clean, refined design",
          "Easy to style for everyday use",
          "Versatile for different occasions",
          "Designed to complement a modern lifestyle",
        ];

    const specLines: string[] = [];

    if (productType.trim()) {
      specLines.push(`Product type: ${productType.trim()}`);
    }

    if (brand.trim()) {
      specLines.push(`Brand: ${brand.trim()}`);
    }

    if (collection.trim()) {
      specLines.push(`Collection: ${collection.trim()}`);
    }

    if (rawFeatures.trim()) {
      rawFeatures
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5)
        .forEach((item) => specLines.push(item));
    }

    if (specLines.length === 0) {
      specLines.push(
        "Refined design",
        "Versatile everyday styling",
        "Comfort-focused wear",
        "Timeless appearance"
      );
    }

    const seo = shortenTitle(finalTitle, 70);

    const metaBase = isWatch
      ? `Shop ${finalTitle}. A refined men's watch designed for versatile everyday styling, polished looks and timeless appeal.`
      : `Discover ${finalTitle}, designed for versatile everyday styling with a clean, refined look and timeless appeal.`;

    const meta = metaBase.slice(0, 160).trim();

    const keywordList = isWatch
      ? [
          "men's watch",
          "quartz watch",
          "classic watch",
          "modern watch",
          "everyday watch",
          "dress watch",
          "timepiece",
          "men's timepiece",
          "refined watch",
          "Horizon Timepieces",
        ]
      : [
          "everyday style",
          "modern design",
          "classic style",
          "refined design",
          "quality style",
          "Horizon Timepieces",
        ];

    if (brand.trim()) {
      keywordList.unshift(brand.trim());
    }

    const uniqueKeywords = Array.from(
      new Set(keywordList.map((item) => item.trim()).filter(Boolean))
    );

    const tagList = isWatch
      ? [
          "Watches",
          "Men's Watches",
          "Timepieces",
          "Quartz Watch",
          "Everyday Style",
          "Classic Design",
          "Modern Style",
        ]
      : [
          "Everyday Style",
          "Modern Design",
          "Classic Style",
          "Refined Design",
        ];

    const imageAlt = shortenTitle(
      `${finalTitle}${brand ? ` ${brand}` : ""}`,
      125
    );

    setProductTitle(finalTitle);
    setDescription(polishedDescription);
    setBenefits(benefitLines.join("\n"));
    setSpecifications(specLines.join("\n"));
    setSeoTitle(seo);
    setMetaDescription(meta);
    setKeywords(uniqueKeywords.join(", "));
    setTags(tagList.join(", "));
    setAltText(imageAlt);
    setHandle(makeHandle(finalTitle));

    setOptimized(true);
  }

  function clearAll() {
    setOriginalTitle("");
    setOriginalDescription("");
    setFeatures("");
    setProductType("");
    setBrand("Horizon Timepieces");
    setCollection("");
    setPrice("");

    setOptimized(false);

    setProductTitle("");
    setDescription("");
    setBenefits("");
    setSpecifications("");
    setSeoTitle("");
    setMetaDescription("");
    setKeywords("");
    setTags("");
    setAltText("");
    setHandle("");
  }

  return (
    <main className="container">
      <section className="hero">
        <p className="eyebrow">HORIZON TIMEPIECES</p>
        <h1>Virello AI Optimizer</h1>
        <p className="subtitle">
          Create polished, conversion-focused product content without
          supplier-style wording.
        </p>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="label">PRODUCT INPUT</span>
            <h2>Product details</h2>
          </div>
        </div>

        <Field
          label="Original Product Title"
          value={originalTitle}
          onChange={setOriginalTitle}
          placeholder="Paste the original supplier product title"
        />

        <Field
          label="Product Description"
          value={originalDescription}
          onChange={setOriginalDescription}
          placeholder="Paste the original product description"
          textarea
        />

        <Field
          label="Features"
          value={features}
          onChange={setFeatures}
          placeholder="Materials, movement, size, functions, style, etc."
          textarea
        />

        <div className="grid">
          <Field
            label="Product Type"
            value={productType}
            onChange={setProductType}
            placeholder="Men's Watch"
          />

          <Field
            label="Brand"
            value={brand}
            onChange={setBrand}
            placeholder="Horizon Timepieces"
          />
        </div>

        <div className="grid">
          <Field
            label="Collection"
            value={collection}
            onChange={setCollection}
            placeholder="Optional"
          />

          <Field
            label="Price"
            value={price}
            onChange={setPrice}
            placeholder="Optional"
          />
        </div>

        <div className="actions">
          <button className="primaryButton" onClick={optimizeProduct}>
            Optimize Product
          </button>

          <button className="secondaryButton" onClick={clearAll}>
            Clear
          </button>
        </div>
      </section>

      {optimized && (
        <section className="card">
          <div className="sectionHeader">
            <div>
              <span className="label">OUTPUT</span>
              <h2>Optimized Content</h2>
              <p>Ready-to-use product content for your online store.</p>
            </div>
          </div>

          <OutputBox
            label="PRODUCT TITLE"
            value={productTitle}
            max={70}
          />

          <OutputBox
            label="PRODUCT DESCRIPTION"
            value={description}
          />

          <OutputBox
            label="KEY BENEFITS"
            value={benefits}
          />

          <OutputBox
            label="SPECIFICATIONS"
            value={specifications}
          />

          <OutputBox
            label="SEO TITLE"
            value={seoTitle}
            max={70}
          />

          <OutputBox
            label="META DESCRIPTION"
            value={metaDescription}
            max={160}
          />

          <OutputBox
            label="SEO KEYWORDS"
            value={keywords}
          />

          <OutputBox
            label="PRODUCT TAGS"
            value={tags}
          />

          <OutputBox
            label="IMAGE ALT TEXT"
            value={altText}
            max={125}
          />

          <OutputBox
            label="URL HANDLE"
            value={handle}
            max={70}
          />

          <div className="preview">
            <span className="label">STORE PREVIEW</span>
            <h2>{productTitle}</h2>
            <p>{description}</p>

            <div className="checks">
              <div>✓<span>TITLE</span></div>
              <div>✓<span>SEO</span></div>
              <div>✓<span>META</span></div>
              <div>✓<span>CLEANED</span></div>
            </div>
          </div>
        </section>
      )}

      <footer>
        Virello AI Optimizer · Product content workflow
      </footer>
    </main>
  );
}
