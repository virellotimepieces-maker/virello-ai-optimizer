"use client";

import { useMemo, useState } from "react";

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
          rows={5}
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

  async function copy() {
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
    <button className="copyButton" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
}

function words(text: string) {
  return cleanText(text)
    .split(/\s+/)
    .filter(Boolean);
}

function limit(text: string, max: number) {
  return text.trim().slice(0, max).trim();
}

function makeHandle(title: string) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

function removeSupplierLanguage(text: string) {
  return cleanText(text)
    .replace(/\b(aliexpress|alibaba|supplier|wholesale|dropshipping|drop shipping)\b/gi, "")
    .replace(/\b(free shipping|cheap|hot sale|best seller|2025|2026)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(text: string) {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export default function ProductOptimizer() {
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("Horizon Timepieces");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [collection, setCollection] = useState("");

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

  const seoCount = seoTitle.length;
  const metaCount = metaDescription.length;

  const sourceText = useMemo(() => {
    return cleanText(
      `${originalTitle} ${originalDescription} ${features} ${productType}`
    );
  }, [originalTitle, originalDescription, features, productType]);

  function optimizeProduct() {
    const cleanedTitle = removeSupplierLanguage(originalTitle);
    const cleanedDescription = removeSupplierLanguage(originalDescription);
    const cleanedFeatures = removeSupplierLanguage(features);

    const baseType =
      cleanText(productType) ||
      cleanText(cleanedTitle) ||
      "Premium Timepiece";

    const titleWords = words(cleanedTitle);

    let generatedTitle = "";

    if (titleWords.length > 0) {
      generatedTitle = titleWords.slice(0, 9).join(" ");
    } else {
      generatedTitle = titleCase(baseType);
    }

    generatedTitle = generatedTitle
      .replace(/\bLuxury\b/gi, "")
      .replace(/\bPremium\b/gi, "")
      .replace(/\bOfficial\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!generatedTitle) {
      generatedTitle = "Refined Automatic Timepiece";
    }

    if (generatedTitle.length > 85) {
      generatedTitle = generatedTitle.slice(0, 85).trim();
    }

    const finalDescription =
      cleanedDescription ||
      `A refined ${baseType.toLowerCase()} designed for a polished everyday look. Thoughtful details, a versatile profile, and a timeless aesthetic make it easy to wear from day to evening.`;

    const featureList = cleanedFeatures
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const defaultFeatures = [
      "Refined, versatile design",
      "Designed for everyday wear",
      "Comfort-focused construction",
      "Timeless styling",
    ];

    const finalFeatures =
      featureList.length > 0 ? featureList : defaultFeatures;

    const benefitList = [
      "Adds a polished finishing touch to everyday outfits",
      "Easy to style for both casual and refined occasions",
      "Designed with a timeless look that stays versatile",
      "Makes choosing an elevated everyday accessory simple",
    ];

    const primaryKeyword =
      cleanText(productType) ||
      words(generatedTitle).slice(0, 4).join(" ") ||
      "timepiece";

    const seo = limit(
      `${generatedTitle} | ${titleCase(primaryKeyword)}`,
      70
    );

    const meta = limit(
      `Discover ${generatedTitle.toLowerCase()}, designed for a refined everyday look. Explore thoughtful details, versatile styling and timeless appeal at ${brand}.`,
      160
    );

    const keywordList = [
      primaryKeyword,
      generatedTitle,
      `${primaryKeyword} for men`,
      "men's watches",
      "automatic watch",
      "stainless steel watch",
      "refined timepiece",
      "everyday watch",
      "classic watch",
      "modern timepiece",
    ]
      .map(cleanText)
      .filter(Boolean);

    const tagList = [
      "Watches",
      "Men's Watches",
      "Timepieces",
      "Automatic Watches",
      "Stainless Steel",
      "Everyday Style",
      collection,
    ]
      .map(cleanText)
      .filter(Boolean);

    const generatedAlt = limit(
      `${generatedTitle} ${brand} watch`,
      125
    );

    const generatedHandle = makeHandle(generatedTitle);

    setProductTitle(generatedTitle);
    setDescription(finalDescription);
    setBenefits(benefitList.join("\n"));
    setSpecifications(finalFeatures.join("\n"));
    setSeoTitle(seo);
    setMetaDescription(meta);
    setKeywords([...new Set(keywordList)].join(", "));
    setTags([...new Set(tagList)].join(", "));
    setAltText(generatedAlt);
    setHandle(generatedHandle);

    setOptimized(true);
  }

  function clearAll() {
    setOriginalTitle("");
    setOriginalDescription("");
    setFeatures("");
    setProductType("");
    setPrice("");
    setImageUrl("");
    setCollection("");

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

    setOptimized(false);
  }

  return (
    <main>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f4f1;
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

        main {
          min-height: 100vh;
          padding-bottom: 80px;
        }

        .topBar {
          background: #111111;
          color: #ffffff;
          padding: 44px 20px 42px;
        }

        .topInner {
          width: min(1180px, 100%);
          margin: auto;
        }

        .eyebrow {
          color: #c9d63b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .topBar h1 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(42px, 7vw, 76px);
          font-weight: 400;
          line-height: 0.98;
        }

        .topBar p {
          margin: 18px 0 0;
          max-width: 650px;
          color: #d5d5d5;
          font-size: 17px;
          line-height: 1.65;
        }

        .page {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 28px 18px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 22px;
          align-items: start;
        }

        .card {
          background: #ffffff;
          border: 1px solid #deddd8;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.05);
        }

        .cardTitle {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .cardTitle h2 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 34px;
          font-weight: 400;
        }

        .cardTitle p {
          margin: 6px 0 0;
          color: #777777;
          line-height: 1.5;
          font-size: 14px;
        }

        .badge {
          border: 1px solid #cfcfcf;
          padding: 8px 10px;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: 800;
          white-space: nowrap;
        }

        .field {
          margin-bottom: 19px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #333333;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #cfcfcf;
          background: #ffffff;
          color: #171717;
          border-radius: 10px;
          padding: 14px 15px;
          outline: none;
          transition: 0.2s;
        }

        input {
          min-height: 50px;
        }

        textarea {
          min-height: 120px;
          resize: vertical;
          line-height: 1.55;
        }

        input::placeholder,
        textarea::placeholder {
          color: #929292;
        }

        input:focus,
        textarea:focus {
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08);
        }

        .buttonRow {
          display: flex;
          gap: 10px;
          margin-top: 24px;
        }

        .primaryButton {
          flex: 1;
          border: 0;
          border-radius: 10px;
          background: #111111;
          color: #ffffff;
          padding: 15px 20px;
          cursor: pointer;
          font-weight: 800;
        }

        .primaryButton:hover {
          background: #292929;
        }

        .secondaryButton {
          border: 1px solid #cfcfcf;
          border-radius: 10px;
          background: #ffffff;
          color: #222222;
          padding: 15px 20px;
          cursor: pointer;
          font-weight: 700;
        }

        .outputBlock {
          margin-bottom: 22px;
        }

        .outputHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .outputHeader h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .counter {
          color: #777777;
          font-size: 12px;
        }

        .counter.good {
          color: #26733c;
          font-weight: 700;
        }

        .outputBox {
          position: relative;
          border: 1px solid #d4d4d4;
          background: #fafafa;
          color: #181818;
          border-radius: 10px;
          padding: 15px 80px 15px 15px;
          min-height: 52px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .copyButton {
          position: absolute;
          top: 9px;
          right: 9px;
          border: 1px solid #d0d0d0;
          background: #ffffff;
          color: #111111;
          border-radius: 7px;
          padding: 7px 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .empty {
          color: #888888;
          font-style: italic;
        }

        .preview {
          margin-top: 28px;
          border-top: 1px solid #e0e0e0;
          padding-top: 24px;
        }

        .previewLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #777777;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .googlePreview {
          background: #ffffff;
          border: 1px solid #dddddd;
          border-radius: 12px;
          padding: 18px;
        }

        .googleTitle {
          color: #1a0dab;
          font-size: 19px;
          line-height: 1.3;
          margin-bottom: 5px;
        }

        .googleUrl {
          color: #188038;
          font-size: 13px;
          margin-bottom: 6px;
          word-break: break-all;
        }

        .googleDescription {
          color: #4d5156;
          font-size: 14px;
          line-height: 1.45;
        }

        .tips {
          margin-top: 20px;
          background: #f1f1ed;
          border-radius: 12px;
          padding: 17px;
        }

        .tips strong {
          display: block;
          margin-bottom: 8px;
        }

        .tips ul {
          margin: 0;
          padding-left: 19px;
          color: #555555;
          line-height: 1.65;
          font-size: 13px;
        }

        .success {
          margin-bottom: 20px;
          background: #eef6ee;
          border: 1px solid #cfe4cf;
          color: #245f2c;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
        }

        @media (max-width: 850px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 20px;
          }
        }

        @media (max-width: 520px) {
          .topBar {
            padding: 34px 18px;
          }

          .page {
            padding: 18px 12px;
          }

          .cardTitle h2 {
            font-size: 29px;
          }

          .buttonRow {
            flex-direction: column;
          }

          .secondaryButton {
            width: 100%;
          }
        }
      `}</style>

      <header className="topBar">
        <div className="topInner">
          <div className="eyebrow">Product Content Studio</div>
          <h1>Product Optimizer</h1>
          <p>
            Create polished, original product content designed for customers,
            search engines and a premium storefront experience.
          </p>
        </div>
      </header>

      <div className="page">
        <div className="layout">
          <section className="card">
            <div className="cardTitle">
              <div>
                <h2>Product Information</h2>
                <p>
                  Add the product information you have. The optimizer will
                  clean up supplier-style wording and create customer-focused
                  copy.
                </p>
              </div>

              <div className="badge">SEO READY</div>
            </div>

            <Field
              label="Original Product Title"
              value={originalTitle}
              onChange={setOriginalTitle}
              placeholder="Example: PAGANI DESIGN Automatic Men's Watch..."
            />

            <Field
              label="Original Description"
              value={originalDescription}
              onChange={setOriginalDescription}
              textarea
              placeholder="Paste the supplier or product description here..."
            />

            <Field
              label="Features / Specifications"
              value={features}
              onChange={setFeatures}
              textarea
              placeholder={`One feature per line
Automatic movement
Stainless steel case
Sapphire crystal`}
            />

            <Field
              label="Product Type"
              value={productType}
              onChange={setProductType}
              placeholder="Example: Automatic Watch"
            />

            <Field
              label="Brand"
              value={brand}
              onChange={setBrand}
              placeholder="Horizon Timepieces"
            />

            <Field
              label="Collection"
              value={collection}
              onChange={setCollection}
              placeholder="Example: Signature Collection"
            />

            <Field
              label="Price"
              value={price}
              onChange={setPrice}
              placeholder="229.00"
            />

            <Field
              label="Product Image URL"
              value={imageUrl}
              onChange={setImageUrl}
              placeholder="https://example.com/product-image.jpg"
            />

            <div className="buttonRow">
              <button
                className="primaryButton"
                onClick={optimizeProduct}
              >
                Optimize Product
              </button>

              <button
                className="secondaryButton"
                onClick={clearAll}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="card">
            <div className="cardTitle">
              <div>
                <h2>Optimized Content</h2>
                <p>
                  Customer-focused copy with clean SEO fields and a more
                  premium brand presentation.
                </p>
              </div>

              <div className="badge">PREMIUM</div>
            </div>

            {optimized && (
              <div className="success">
                Product content optimized successfully.
              </div>
            )}

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Product Title</h3>
              </div>

              <div className="outputBox">
                {productTitle || (
                  <span className="empty">
                    Your optimized product title will appear here.
                  </span>
                )}

                {productTitle && <CopyButton value={productTitle} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Product Description</h3>
              </div>

              <div className="outputBox">
                {description || (
                  <span className="empty">
                    Your product description will appear here.
                  </span>
                )}

                {description && <CopyButton value={description} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Benefits</h3>
              </div>

              <div className="outputBox">
                {benefits || (
                  <span className="empty">
                    Product benefits will appear here.
                  </span>
                )}

                {benefits && <CopyButton value={benefits} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Features / Specifications</h3>
              </div>

              <div className="outputBox">
                {specifications || (
                  <span className="empty">
                    Product specifications will appear here.
                  </span>
                )}

                {specifications && (
                  <CopyButton value={specifications} />
                )}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>SEO Title</h3>

                <span
                  className={`counter ${
                    seoCount <= 70 ? "good" : ""
                  }`}
                >
                  {seoCount}/70
                </span>
              </div>

              <div className="outputBox">
                {seoTitle || (
                  <span className="empty">
                    SEO title will appear here.
                  </span>
                )}

                {seoTitle && <CopyButton value={seoTitle} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Meta Description</h3>

                <span
                  className={`counter ${
                    metaCount <= 160 ? "good" : ""
                  }`}
                >
                  {metaCount}/160
                </span>
              </div>

              <div className="outputBox">
                {metaDescription || (
                  <span className="empty">
                    Meta description will appear here.
                  </span>
                )}

                {metaDescription && (
                  <CopyButton value={metaDescription} />
                )}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Keywords</h3>
              </div>

              <div className="outputBox">
                {keywords || (
                  <span className="empty">
                    Keywords will appear here.
                  </span>
                )}

                {keywords && <CopyButton value={keywords} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Product Tags</h3>
              </div>

              <div className="outputBox">
                {tags || (
                  <span className="empty">
                    Product tags will appear here.
                  </span>
                )}

                {tags && <CopyButton value={tags} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>Image Alt Text</h3>
              </div>

              <div className="outputBox">
                {altText || (
                  <span className="empty">
                    Image alt text will appear here.
                  </span>
                )}

                {altText && <CopyButton value={altText} />}
              </div>
            </div>

            <div className="outputBlock">
              <div className="outputHeader">
                <h3>URL Handle</h3>
              </div>

              <div className="outputBox">
                {handle || (
                  <span className="empty">
                    Product URL handle will appear here.
                  </span>
                )}

                {handle && <CopyButton value={handle} />}
              </div>
            </div>

            <div className="preview">
              <div className="previewLabel">Search Preview</div>

              <div className="googlePreview">
                <div className="googleTitle">
                  {seoTitle || "Your SEO Title"}
                </div>

                <div className="googleUrl">
                  yourstore.com/products/
                  {handle || "product-name"}
                </div>

                <div className="googleDescription">
                  {metaDescription ||
                    "Your optimized meta description will appear here."}
                </div>
              </div>
            </div>

            <div className="tips">
              <strong>Optimization notes</strong>

              <ul>
                <li>
                  Product copy focuses on the customer rather than the
                  supplier.
                </li>
                <li>
                  Supplier and marketplace-style wording is removed where
                  possible.
                </li>
                <li>
                  SEO title is kept within the 70-character field limit.
                </li>
                <li>
                  Meta description is kept within the 160-character field
                  limit.
                </li>
                <li>
                  Benefits are written around style, usability and customer
                  value.
                </li>
                <li>
                  Image alt text describes the product naturally instead of
                  keyword stuffing.
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
