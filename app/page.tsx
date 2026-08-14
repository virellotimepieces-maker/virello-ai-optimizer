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
    <button type="button" className="copyButton" onClick={copyText}>
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

function removeMarketplaceWords(text: string) {
  return cleanText(text)
    .replace(
      /\b(aliexpress|alibaba|dropshipping|drop shipping|supplier|wholesale|factory direct|factory price|cheap|hot sale|best seller|free shipping|2025|2026)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
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

  function optimizeProduct() {
    const cleanTitle = removeMarketplaceWords(originalTitle);
    const cleanDescription = removeMarketplaceWords(originalDescription);
    const cleanFeatures = removeMarketplaceWords(features);

    let finalTitle = cleanTitle;

    if (!finalTitle) {
      finalTitle =
        productType.trim() || "Refined Everyday Timepiece";
    }

    finalTitle = finalTitle
      .replace(/\b(luxury|premium|official)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    finalTitle = limit(finalTitle, 70);

    if (!finalTitle) {
      finalTitle = "Refined Everyday Timepiece";
    }

    const type =
      productType.trim() ||
      "timepiece";

    const finalDescription =
      cleanDescription ||
      `Designed with a refined profile and versatile character, this ${type.toLowerCase()} brings a polished finish to everyday styling. Its considered details make it easy to wear from relaxed daytime looks to more elevated occasions.`;

    const featureLines = cleanFeatures
      .split(/\n|•/)
      .map((item) => cleanText(item))
      .filter(Boolean);

    const finalSpecifications =
      featureLines.length > 0
        ? featureLines.slice(0, 8)
        : [
            "Refined, versatile design",
            "Designed for everyday wear",
            "Comfort-focused construction",
            "Timeless styling",
          ];

    const finalBenefits = [
      "Creates a polished finishing touch for everyday looks",
      "Easy to style across casual, business and evening occasions",
      "Versatile design that works with different outfits",
      "Thoughtful details give the product a refined appearance",
    ];

    const keywordBase = type.toLowerCase();

    const finalSeoTitle = limit(
      `${finalTitle} | ${keywordBase}`,
      70
    );

    const finalMetaDescription = limit(
      `Discover ${finalTitle.toLowerCase()}, designed for a refined everyday look with versatile styling and timeless appeal.`,
      160
    );

    const finalKeywords = unique([
      keywordBase,
      finalTitle,
      "timepiece",
      "classic watch",
      "everyday watch",
      "modern watch",
      "refined watch",
      "timeless style",
      "men's watch",
      "stainless steel watch",
    ]);

    const finalTags = unique([
      "Watches",
      "Timepieces",
      "Men's Watches",
      "Everyday Style",
      "Classic Design",
      "Modern Style",
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
    setAltText(limit(`${finalTitle} ${brand}`, 125));
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
          background: #f5f4f1;
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

        .hero {
          background: #111111;
          color: white;
          padding: 42px 20px 46px;
        }

        .heroInner {
          width: min(1180px, 100%);
          margin: 0 auto;
        }

        .eyebrow {
          color: #d4df42;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .hero h1 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(42px, 8vw, 74px);
          line-height: 0.98;
          font-weight: 400;
          letter-spacing: -1px;
        }

        .hero p {
          max-width: 720px;
          margin: 18px 0 0;
          color: #d8d8d8;
          font-size: 16px;
          line-height: 1.65;
        }

        .page {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 26px 18px;
        }

        .layout {
          display: grid;
          grid-template-columns:
            minmax(0, 0.9fr)
            minmax(0, 1.1fr);
          gap: 22px;
          align-items: start;
        }

        .card {
          background: #ffffff;
          border: 1px solid #dfded9;
          border-radius: 18px;
          padding: 25px;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.05);
        }

        .cardHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 24px;
        }

        .cardHeader h2 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 32px;
          font-weight: 400;
        }

        .cardHeader p {
          margin: 7px 0 0;
          color: #707070;
          font-size: 13px;
          line-height: 1.5;
        }

        .badge {
          flex-shrink: 0;
          border: 1px solid #cccccc;
          padding: 8px 10px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .notice {
          margin-bottom: 22px;
          padding: 13px 14px;
          border-radius: 10px;
          background: #f5f5f1;
          color: #626262;
          font-size: 12px;
          line-height: 1.55;
        }

        .field {
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: #333333;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }

        input,
        textarea {
          width: 100%;
          display: block;
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
          box-shadow:
            0 0 0 3px rgba(17, 17, 17, 0.08) !important;
        }

        .twoColumns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
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
          padding: 13px 18px;
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
          background: #2a2a2a;
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
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
        }

        .counter {
          color: #777777;
          font-size: 11px;
        }

        .counter.good {
          color: #26733c;
          font-weight: 800;
        }

        .outputBox {
          position: relative;
          min-height: 55px;
          border: 1px solid #d4d4d4;
          border-radius: 10px;
          background: #fafafa;
          color: #171717;
          padding: 15px 80px 15px 15px;
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
          font-size: 11px;
          font-weight: 800;
        }

        .emptyState {
          padding: 45px 15px;
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
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .preview h4 {
          margin: 8px 0 10px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 25px;
          font-weight: 400;
        }

        .preview p {
          color: #555555;
          line-height: 1.65;
          font-size: 14px;
          margin: 0;
        }

        .previewPrice {
          margin-top: 14px;
          font-size: 18px;
          font-weight: 800;
        }

        .score {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 18px;
        }

        .scoreItem {
          padding: 12px 8px;
          border: 1px solid #dedede;
          border-radius: 9px;
          background: #fafafa;
          text-align: center;
        }

        .scoreItem strong {
          display: block;
          font-size: 18px;
        }

        .scoreItem span {
          display: block;
          margin-top: 3px;
          color: #777777;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .footerNote {
          margin-top: 18px;
          color: #858585;
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 850px) {
          .layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .hero {
            padding: 34px 17px 38px;
          }

          .page {
            padding: 18px 12px;
          }

          .card {
            padding: 19px;
            border-radius: 15px;
          }

          .cardHeader {
            display: block;
          }

          .badge {
            display: inline-block;
            margin-top: 13px;
          }

          .twoColumns {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .score {
            grid-template-columns: 1fr 1fr;
          }

          .buttonRow {
            flex-direction: column;
          }

          .secondaryButton {
            width: 100%;
          }
        }
      `}</style>

      <section className="hero">
        <div className="heroInner">
          <div className="eyebrow">
            Virello AI Optimizer
          </div>

          <h1>
            Product
            <br />
            Optimizer
          </h1>

          <p>
            Turn raw product information into polished,
            store-ready content designed to look professional
            and avoid marketplace-style wording.
          </p>
        </div>
      </section>

      <div className="page">
        <div className="layout">
          <section className="card">
            <div className="cardHeader">
              <div>
                <h2>Product Input</h2>
                <p>
                  Add the original product information and
                  let Virello clean and structure it.
                </p>
              </div>

              <div className="badge">INPUT</div>
            </div>

            <div className="notice">
              Remove supplier-style wording, unnecessary
              claims and marketplace language while keeping
              useful product information.
            </div>

            <Field
              label="Original Product Title"
              value={originalTitle}
              onChange={setOriginalTitle}
              placeholder="Paste the original product title"
            />

            <Field
              label="Original Description"
              value={originalDescription}
              onChange={setOriginalDescription}
              placeholder="Paste the original product description"
              textarea
            />

            <Field
              label="Product Features / Specifications"
              value={features}
              onChange={setFeatures}
              placeholder={
                "Example:\nAutomatic movement\nStainless steel case\nWater resistant\nMineral crystal"
              }
              textarea
            />

            <div className="twoColumns">
              <Field
                label="Product Type"
                value={productType}
                onChange={setProductType}
                placeholder="Example: Automatic Watch"
              />

              <Field
                label="Collection"
                value={collection}
                onChange={setCollection}
                placeholder="Example: Heritage"
              />
            </div>

            <div className="twoColumns">
              <Field
                label="Brand"
                value={brand}
                onChange={setBrand}
                placeholder="Brand name"
              />

              <Field
                label="Price"
                value={price}
                onChange={setPrice}
                placeholder="Example: $189"
              />
            </div>

            <div className="buttonRow">
              <button
                type="button"
                className="primaryButton"
                onClick={optimizeProduct}
              >
                Optimize Product
              </button>

              <button
                type="button"
                className="secondaryButton"
                onClick={clearAll}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="card">
            <div className="cardHeader">
              <div>
                <h2>Optimized Content</h2>
                <p>
                  Ready-to-use product content for your
                  online store.
                </p>
              </div>

              <div className="badge">OUTPUT</div>
            </div>

            {!optimized ? (
              <div className="emptyState">
                Add your product information on the left,
                then select <strong>Optimize Product</strong>.
              </div>
            ) : (
              <>
                <OutputBox
                  label="Product Title"
                  value={productTitle}
                  max={70}
                />

                <OutputBox
                  label="Product Description"
                  value={description}
                />

                <OutputBox
                  label="Key Benefits"
                  value={benefits}
                />

                <OutputBox
                  label="Specifications"
                  value={specifications}
                />

                <OutputBox
                  label="SEO Title"
                  value={seoTitle}
                  max={70}
                />

                <OutputBox
                  label="Meta Description"
                  value={metaDescription}
                  max={160}
                />

                <OutputBox
                  label="SEO Keywords"
                  value={keywords}
                />

                <OutputBox
                  label="Product Tags"
                  value={tags}
                />

                <OutputBox
                  label="Image Alt Text"
                  value={altText}
                  max={125}
                />

                <OutputBox
                  label="URL Handle"
                  value={handle}
                  max={70}
                />

                <div className="preview">
                  <div className="previewLabel">
                    Store Preview
                  </div>

                  <h4>{productTitle}</h4>

                  <p>{description}</p>

                  {price && (
                    <div className="previewPrice">
                      {price}
                    </div>
                  )}

                  <div className="score">
                    <div className="scoreItem">
                      <strong>
                        {productTitle.length <= 70
                          ? "✓"
                          : "!"}
                      </strong>
                      <span>Title</span>
                    </div>

                    <div className="scoreItem">
                      <strong>
                        {seoTitle.length <= 70
                          ? "✓"
                          : "!"}
                      </strong>
                      <span>SEO</span>
                    </div>

                    <div className="scoreItem">
                      <strong>
                        {metaDescription.length <= 160
                          ? "✓"
                          : "!"}
                      </strong>
                      <span>Meta</span>
                    </div>

                    <div className="scoreItem">
                      <strong>✓</strong>
                      <span>Cleaned</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="footerNote">
          Virello AI Optimizer · Product content workflow
        </div>
      </div>
    </main>
  );
}
