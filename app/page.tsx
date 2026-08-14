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
    <button className="copyButton" onClick={copyText}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function cleanText(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeDropshippingWords(text: string) {
  return cleanText(text)
    .replace(
      /\b(aliexpress|alibaba|supplier|wholesale|dropshipping|drop shipping|factory direct)\b/gi,
      ""
    )
    .replace(
      /\b(hot sale|cheap|best seller|2025|2026)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
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

export default function ProductOptimizer() {
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalDescription, setOriginalDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("Horizon Timepieces");
  const [collection, setCollection] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

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

  function optimizeProduct() {
    const title = removeDropshippingWords(originalTitle);
    const originalDescriptionClean =
      removeDropshippingWords(originalDescription);
    const cleanFeatures = removeDropshippingWords(features);

    let finalTitle = title;

    if (!finalTitle) {
      finalTitle = productType || "Refined Automatic Timepiece";
    }

    finalTitle = finalTitle
      .replace(/\b(luxury|premium|official)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    finalTitle = limit(finalTitle, 70);

    if (!finalTitle) {
      finalTitle = "Refined Automatic Timepiece";
    }

    const finalDescription =
      originalDescriptionClean ||
      `A refined ${(
        productType || "timepiece"
      ).toLowerCase()} designed for a polished everyday look. Thoughtful details, versatile styling and a timeless profile make it easy to wear from day to evening.`;

    const featureLines = cleanFeatures
      .split("\n")
      .map((item) => cleanText(item))
      .filter(Boolean);

    const finalSpecifications =
      featureLines.length > 0
        ? featureLines
        : [
            "Refined and versatile design",
            "Designed for everyday wear",
            "Comfort-focused construction",
            "Timeless styling",
          ];

    const finalBenefits = [
      "Adds a polished finishing touch to everyday outfits",
      "Easy to style for casual, business and evening occasions",
      "Versatile design that works across different looks",
      "Thoughtful details create a refined and confident appearance",
    ];

    const keywordBase =
      productType ||
      finalTitle.split(" ").slice(0, 4).join(" ") ||
      "watch";

    const finalSeoTitle = limit(
      `${finalTitle} | ${keywordBase}`,
      70
    );

    const finalMetaDescription = limit(
      `Discover ${finalTitle.toLowerCase()}, designed for a refined everyday look. Explore thoughtful details, versatile styling and timeless appeal at ${brand}.`,
      160
    );

    const finalKeywords = unique([
      keywordBase,
      finalTitle,
      "men's watches",
      "automatic watch",
      "stainless steel watch",
      "classic watch",
      "everyday watch",
      "refined timepiece",
      "modern watch",
      "timeless watch",
    ]);

    const finalTags = unique([
      "Watches",
      "Men's Watches",
      "Timepieces",
      "Automatic Watches",
      "Stainless Steel",
      "Everyday Style",
      collection,
    ]);

    setProductTitle(finalTitle);
    setDescription(finalDescription);
    setBenefits(finalBenefits.join("\n"));
    setSpecifications(finalSpecifications.join("\n"));
    setSeoTitle(finalSeoTitle);
    setMetaDescription(finalMetaDescription);
    setKeywords(finalKeywords.join(", "));
    setTags(finalTags.join(", "));
    setAltText(limit(`${finalTitle} ${brand} watch`, 125));
    setHandle(makeHandle(finalTitle));

    setOptimized(true);
  }

  function clearAll() {
    setOriginalTitle("");
    setOriginalDescription("");
    setFeatures("");
    setProductType("");
    setCollection("");
    setPrice("");
    setImageUrl("");

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

        html,
        body {
          margin: 0;
          padding: 0;
          background: #f4f3f0;
          color: #171717;
          font-family:
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        body {
          min-width: 320px;
        }

        button,
        input,
        textarea {
          font: inherit;
        }

        main {
          min-height: 100vh;
          padding-bottom: 70px;
        }

        .topBar {
          background: #111111;
          color: #ffffff;
          padding: 42px 20px;
        }

        .topInner {
          width: min(1180px, 100%);
          margin: 0 auto;
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
          max-width: 700px;
          color: #dddddd;
          font-size: 17px;
          line-height: 1.6;
        }

        .page {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 28px 18px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
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
          line-height: 1.05;
          font-weight: 400;
        }

        .cardTitle p {
          margin: 7px 0 0;
          color: #666666;
          font-size: 14px;
          line-height: 1.5;
        }

        .badge {
          border: 1px solid #cccccc;
          background: #ffffff;
          color: #222222;
          padding: 8px 10px;
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: 800;
          white-space: nowrap;
        }

        .notice {
          margin-bottom: 20px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #f7f7f4;
          color: #666666;
          font-size: 12px;
          line-height: 1.5;
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

        /*
          IMPORTANT:
          These rules force the fields to have a white background
          and dark readable text.
        */

        input,
        textarea {
          display: block;
          width: 100%;
          border: 1px solid #cfcfcf !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: #171717 !important;
          -webkit-text-fill-color: #171717 !important;
          padding: 14px 15px;
          outline: none;
          box-shadow: none !important;
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
          color: #888888 !important;
          -webkit-text-fill-color: #888888 !important;
          opacity: 1 !important;
        }

        input:focus,
        textarea:focus {
          border-color: #111111 !important;
          box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.08) !important;
        }

        .buttonRow {
          display: flex;
          gap: 10px;
          margin-top: 24px;
        }

        .primaryButton,
        .secondaryButton {
          min-height: 52px;
          border-radius: 10px;
          padding: 14px 20px;
          cursor: pointer;
          font-weight: 800;
        }

        .primaryButton {
          flex: 1;
          border: 0;
          background: #111111;
          color: #ffffff;
        }

        .primaryButton:hover {
          background: #292929;
        }

        .secondaryButton {
          border: 1px solid #cccccc;
          background: #ffffff;
          color: #222222;
        }

        .outputBlock {
          margin-bottom: 22px;
        }

        .outputHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .outputHeader h3 {
          margin: 0;
          color: #333333;
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
          font-weight: 800;
        }

        .outputBox {
          position: relative;
          min-height: 54px;
          border: 1px solid #d4d4d4;
          border-radius: 10px;
          background: #fafafa;
          color: #181818;
          padding: 15px 82px 15px 15px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .copyButton {
          position: absolute;
          top: 9px;
          right: 9px;
          border: 1px solid #d0d0d0;
          border-radius: 7px;
          background: #ffffff;
          color: #111111;
          padding: 7px 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .emptyState {
          padding: 35px 10px;
          text-align: center;
          color: #777777;
          line-height: 1.6;
        }

        .preview {
          margin-top: 28px;
          border-top: 1px solid #e1e1e1;
          padding-top: 24px;
        }

        .previewLabel {
          color: #777777;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .preview h4 {
          margin: 8px 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 30px;
          font-weight: 400;
          line-height: 1.1;
        }

        .preview p {
          margin: 0;
          color: #666666;
          line-height: 1.65;
        }

        @media (max-width: 820px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .topBar {
            padding: 34px 18px;
          }

          .topBar h1 {
            font-size: 48px;
          }

          .card {
            padding: 20px;
          }
        }

        @media (max-width: 520px) {
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
          <div className="eyebrow">PRODUCT CONTENT STUDIO</div>

          <h1>Product Optimizer</h1>

          <p>
            Create polished, original product content built for customers,
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
                <p>Paste the original product information here.</p>
              </div>

              <div className="badge">AI READY</div>
            </div>

            <div className="notice">
              Marketplace and dropshipping wording is automatically removed
              from the generated content.
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
              placeholder="Paste the original product description here..."
              textarea
            />

            <Field
              label="Features / Specifications"
              value={features}
              onChange={setFeatures}
              placeholder={
                "One feature per line\nAutomatic movement\nStainless steel case\nSapphire crystal"
              }
              textarea
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
                  Customer-focused copy, benefits and SEO fields.
                </p>
              </div>

              <div className="badge">PREMIUM</div>
            </div>

            {!optimized ? (
              <div className="emptyState">
                Enter your product information, then tap
                <strong> Optimize Product</strong>.
              </div>
            ) : (
              <>
                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Product Title</h3>
                  </div>

                  <div className="outputBox">
                    {productTitle}
                    <CopyButton value={productTitle} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Product Description</h3>
                  </div>

                  <div className="outputBox">
                    {description}
                    <CopyButton value={description} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Key Benefits</h3>
                  </div>

                  <div className="outputBox">
                    {benefits}
                    <CopyButton value={benefits} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Specifications</h3>
                  </div>

                  <div className="outputBox">
                    {specifications}
                    <CopyButton value={specifications} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>SEO Title</h3>

                    <span
                      className={
                        seoTitle.length <= 70
                          ? "counter good"
                          : "counter"
                      }
                    >
                      {seoTitle.length}/70
                    </span>
                  </div>

                  <div className="outputBox">
                    {seoTitle}
                    <CopyButton value={seoTitle} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Meta Description</h3>

                    <span
                      className={
                        metaDescription.length <= 160
                          ? "counter good"
                          : "counter"
                      }
                    >
                      {metaDescription.length}/160
                    </span>
                  </div>

                  <div className="outputBox">
                    {metaDescription}
                    <CopyButton value={metaDescription} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Search Keywords</h3>
                  </div>

                  <div className="outputBox">
                    {keywords}
                    <CopyButton value={keywords} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Product Tags</h3>
                  </div>

                  <div className="outputBox">
                    {tags}
                    <CopyButton value={tags} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>Image Alt Text</h3>
                  </div>

                  <div className="outputBox">
                    {altText}
                    <CopyButton value={altText} />
                  </div>
                </div>

                <div className="outputBlock">
                  <div className="outputHeader">
                    <h3>URL Handle</h3>
                  </div>

                  <div className="outputBox">
                    {handle}
                    <CopyButton value={handle} />
                  </div>
                </div>

                <div className="preview">
                  <div className="previewLabel">
                    Storefront Preview
                  </div>

                  <h4>{productTitle}</h4>

                  <p>{description}</p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
  }
