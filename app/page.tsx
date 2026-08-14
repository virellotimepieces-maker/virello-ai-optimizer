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

function limit(text: string, max: number) {
  return text.trim().slice(0, max).trim();
}

function cleanText(text: string) {
  return text
    .replace(/\b(19|20)\d{2}\b/gi, "")
    .replace(/\bnew\b/gi, "")
    .replace(/\bnewest\b/gi, "")
    .replace(/\blatest\b/gi, "")
    .replace(/\bhot\b/gi, "")
    .replace(/\btop\b/gi, "")
    .replace(/\bbest seller\b/gi, "")
    .replace(/\bbest selling\b/gi, "")
    .replace(/\btop selling\b/gi, "")
    .replace(/\bhigh quality\b/gi, "")
    .replace(/\bpremium quality\b/gi, "")
    .replace(/\bpremium\b/gi, "")
    .replace(/\bluxury\b/gi, "")
    .replace(/\bcheap\b/gi, "")
    .replace(/\bwholesale\b/gi, "")
    .replace(/\bfree shipping\b/gi, "")
    .replace(/\bfor men\b/gi, "Men's")
    .replace(/\bfor women\b/gi, "Women's")
    .replace(/\bmen's watches\b/gi, "Men's Watch")
    .replace(/\bwomen's watches\b/gi, "Women's Watch")
    .replace(/\bwatches\b/gi, "Watch")
    .replace(/\s+/g, " ")
    .replace(/\s*[-|–—:]+\s*/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}

function makeCleanTitle(
  name: string,
  productType: string,
  brand: string
) {
  let title = cleanText(name);

  const lower = title.toLowerCase();

  const genericWords = [
    "product",
    "item",
    "fashion",
    "style",
    "design",
  ];

  genericWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    title = title.replace(regex, "");
  });

  title = title.replace(/\s+/g, " ").trim();

  /*
   * Keep the meaningful supplier title.
   * The brand field is intentionally NOT automatically
   * added to the title so the optimizer stays generic.
   */
  if (!title) {
    title = productType.trim() || "Product";
  }

  /*
   * Remove obvious duplicated words.
   */
  const words = title.split(" ");
  const seen = new Set<string>();

  const uniqueWords = words.filter((word) => {
    const key = word.toLowerCase().replace(/[^\w']/g, "");

    if (!key) return false;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  title = uniqueWords.join(" ").trim();

  /*
   * If the title is still empty, use the product type.
   */
  if (!title) {
    title = productType.trim() || "Product";
  }

  /*
   * Keep product titles readable and under 65 characters.
   */
  if (title.length > 65) {
    title = title
      .slice(0, 65)
      .replace(/\s+\S*$/, "")
      .trim();
  }

  return title;
}

function makeSeoTitle(title: string, productType: string) {
  let seo = cleanText(title);

  /*
   * Do not add Virello or Horizon to the SEO title.
   * Keep it focused on the actual product.
   */
  if (!seo) {
    seo = productType.trim() || "Product";
  }

  return limit(seo, 50);
}

function makeMetaDescription(
  title: string,
  productType: string
) {
  const base =
    title ||
    productType ||
    "quality products";

  const description =
    `Shop ${base} with a clean design, practical features, and everyday appeal.`;

  return limit(description, 160);
}

function makeKeywords(
  title: string,
  productType: string,
  brand: string
) {
  const source = `${title} ${productType} ${brand}`;

  const words = source
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "new",
    "top",
    "best",
    "product",
    "item",
    "of",
    "to",
    "a",
    "an",
  ]);

  const unique: string[] = [];

  for (const word of words) {
    if (stopWords.has(word)) continue;
    if (word.length < 3) continue;

    if (!unique.includes(word)) {
      unique.push(word);
    }
  }

  return unique.slice(0, 12).join(", ");
}

function makeTags(
  title: string,
  productType: string,
  collection: string
) {
  const source = `${title}, ${productType}, ${collection}`;

  const tags = source
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const unique = Array.from(
    new Set(
      tags.map((item) =>
        item
          .replace(/\s+/g, " ")
          .trim()
      )
    )
  );

  return unique.slice(0, 10).join(", ");
}

function makeAltText(title: string) {
  return limit(
    `Product image of ${title || "product"}`,
    125
  );
}

function makeHandle(title: string) {
  return cleanText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

export default function ProductOptimizer() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [productType, setProductType] = useState("");
  const [brand, setBrand] = useState("");
  const [collection, setCollection] = useState("");
  const [price, setPrice] = useState("");

  const [optimized, setOptimized] = useState(false);

  const result = useMemo(() => {
    const title = makeCleanTitle(
      name,
      productType,
      brand
    );

    const seoTitle = makeSeoTitle(
      title,
      productType
    );

    const metaDescription = makeMetaDescription(
      title,
      productType
    );

    const keywords = makeKeywords(
      title,
      productType,
      brand
    );

    const tags = makeTags(
      title,
      productType,
      collection
    );

    const altText = makeAltText(title);

    const handle = makeHandle(title);

    const cleanedDescription =
      description.trim() ||
      `Designed for customers who value quality, practical features, and a polished everyday experience.`;

    const featureLines = features
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);

    const finalDescription = [
      cleanedDescription,
      "",
      featureLines.length
        ? "Key features:"
        : "",
      ...featureLines.map(
        (feature) => `• ${feature}`
      ),
      "",
      `A practical choice for customers looking for ${title || "this product"}.`,
    ]
      .filter((line) => line !== "")
      .join("\n");

    return {
      title,
      description: finalDescription,
      seoTitle,
      metaDescription,
      keywords,
      tags,
      altText,
      handle,
    };
  }, [
    name,
    description,
    features,
    productType,
    brand,
    collection,
    price,
  ]);

  function optimizeProduct() {
    if (!name.trim()) {
      setOptimized(false);
      return;
    }

    setOptimized(true);

    setTimeout(() => {
      document
        .getElementById("results")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  function clearAll() {
    setName("");
    setDescription("");
    setFeatures("");
    setProductType("");
    setBrand("");
    setCollection("");
    setPrice("");
    setOptimized(false);
  }

  return (
    <>
      <main className="page">
        <header className="header">
          <div className="brandMark">V</div>

          <div>
            <div className="brandName">Virello</div>
            <div className="brandSub">AI OPTIMIZER</div>
          </div>
        </header>

        <section className="hero">
          <div className="eyebrow">
            VIRELLO AI OPTIMIZER
          </div>

          <h1>
            Optimize every
            <br />
            <span>product listing.</span>
          </h1>

          <p>
            Create polished, professional product
            content without supplier-style wording.
          </p>
        </section>

        <section className="card">
          <div className="step">01</div>

          <h2>Product information</h2>

          <div className="divider" />

          <Field
            label="ORIGINAL PRODUCT TITLE *"
            value={name}
            onChange={setName}
            placeholder="Paste the original supplier product title"
          />

          <Field
            label="PRODUCT DESCRIPTION"
            value={description}
            onChange={setDescription}
            placeholder="Paste original product description"
            textarea
          />

          <Field
            label="FEATURES"
            value={features}
            onChange={setFeatures}
            placeholder="Materials, functions, size, style, etc."
            textarea
          />

          <div className="twoColumns">
            <Field
              label="PRODUCT TYPE"
              value={productType}
              onChange={setProductType}
              placeholder="e.g. Men's Watch"
            />

            <Field
              label="BRAND"
              value={brand}
              onChange={setBrand}
              placeholder="e.g. Pagani Design"
            />

            <Field
              label="COLLECTION"
              value={collection}
              onChange={setCollection}
              placeholder="Optional"
            />

            <Field
              label="PRICE"
              value={price}
              onChange={setPrice}
              placeholder="Optional"
            />
          </div>

          <div className="actions">
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

        {optimized && (
          <section
            id="results"
            className="card resultsCard"
          >
            <div className="step">02</div>

            <div className="resultHeading">
              <div>
                <div className="status">READY</div>
                <h2>Optimized listing</h2>
              </div>
            </div>

            <div className="divider" />

            <OutputBox
              label="PRODUCT TITLE"
              value={result.title}
              max={65}
            />

            <OutputBox
              label="DESCRIPTION"
              value={result.description}
            />

            <OutputBox
              label="SEO TITLE"
              value={result.seoTitle}
              max={50}
            />

            <OutputBox
              label="META DESCRIPTION"
              value={result.metaDescription}
              max={160}
            />

            <OutputBox
              label="SEO KEYWORDS"
              value={result.keywords}
            />

            <OutputBox
              label="PRODUCT TAGS"
              value={result.tags}
            />

            <OutputBox
              label="IMAGE ALT TEXT"
              value={result.altText}
              max={125}
            />

            <OutputBox
              label="URL HANDLE"
              value={result.handle}
              max={70}
            />

            <div className="preview">
              <span className="previewLabel">
                STORE PREVIEW
              </span>

              <h3>{result.title}</h3>

              <p>{result.description}</p>

              <div className="checks">
                <div>
                  ✓ <span>TITLE</span>
                </div>
                <div>
                  ✓ <span>SEO</span>
                </div>
                <div>
                  ✓ <span>META</span>
                </div>
                <div>
                  ✓ <span>CLEANED</span>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer>
          Virello AI Optimizer · Built for cleaner,
          more professional ecommerce listings.
        </footer>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #f5f5f3;
          color: #101522;
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

        .page {
          min-height: 100vh;
          padding-bottom: 70px;
        }

        .header {
          min-height: 86px;
          background: #0d0d0d;
          color: white;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 28px;
        }

        .brandMark {
          width: 48px;
          height: 48px;
          border: 1px solid #666;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 27px;
          font-weight: 800;
        }

        .brandName {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .brandSub {
          margin-top: 2px;
          font-size: 10px;
          letter-spacing: 5px;
          color: #aaa;
        }

        .hero {
          max-width: 760px;
          margin: 0 auto;
          padding: 90px 24px 55px;
        }

        .eyebrow {
          display: inline-block;
          border: 1px solid #ddd;
          border-radius: 999px;
          padding: 10px 18px;
          background: white;
          color: #59616d;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 3px;
        }

        .hero h1 {
          margin: 34px 0 28px;
          font-size: clamp(48px, 8vw, 82px);
          line-height: 0.94;
          letter-spacing: -4px;
        }

        .hero h1 span {
          color: #777;
        }

        .hero p {
          max-width: 650px;
          margin: 0;
          color: #62666d;
          font-size: 21px;
          line-height: 1.6;
        }

        .card {
          width: min(760px, calc(100% - 32px));
          margin: 0 auto 28px;
          padding: 32px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 28px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.04);
        }

        .step {
          color: #8a9098;
          font-size: 12px;
          letter-spacing: 3px;
          margin-bottom: 12px;
        }

        .card h2 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .divider {
          height: 1px;
          background: #e6e6e6;
          margin: 30px 0;
        }

        .field {
          margin-bottom: 22px;
        }

        .field label {
          display: block;
          margin-bottom: 9px;
          color: #5e646c;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .field input,
        .field textarea {
          width: 100%;
          border: 1px solid #d7d7d7;
          border-radius: 14px;
          background: #fafafa;
          color: #111;
          padding: 15px 16px;
          outline: none;
          transition: 0.2s ease;
        }

        .field textarea {
          min-height: 145px;
          resize: vertical;
          line-height: 1.5;
        }

        .field input:focus,
        .field textarea:focus {
          background: white;
          border-color: #222;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06);
        }

        .twoColumns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 18px;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .primaryButton,
        .secondaryButton {
          border-radius: 14px;
          padding: 15px 20px;
          cursor: pointer;
          font-weight: 800;
        }

        .primaryButton {
          flex: 1;
          border: 1px solid #111;
          background: #111;
          color: white;
        }

        .secondaryButton {
          border: 1px solid #d2d2d2;
          background: white;
          color: #111;
        }

        .primaryButton:active,
        .secondaryButton:active,
        .copyButton:active {
          transform: scale(0.98);
        }

        .resultHeading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .status {
          color: #555;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }

        .outputBox {
          margin-bottom: 22px;
          border: 1px solid #ddd;
          border-radius: 18px;
          overflow: hidden;
          background: #fff;
        }

        .outputHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          background: #fafafa;
          border-bottom: 1px solid #e3e3e3;
        }

        .outputLabel {
          color: #5d6269;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .counter {
          margin-top: 5px;
          color: #8a8f96;
          font-size: 11px;
        }

        .copyButton {
          flex-shrink: 0;
          border: 1px solid #ccc;
          background: white;
          color: #111;
          border-radius: 10px;
          padding: 9px 15px;
          cursor: pointer;
          font-weight: 800;
        }

        .outputValue {
          min-height: 70px;
          padding: 20px 16px;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.55;
        }

        .preview {
          margin-top: 30px;
          padding: 22px;
          border-radius: 18px;
          background: #f7f7f5;
          border: 1px solid #e1e1df;
        }

        .previewLabel {
          color: #777;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .preview h3 {
          margin: 15px 0 10px;
          font-size: 23px;
        }

        .preview p {
          margin: 0;
          color: #60656c;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .checks {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 22px;
        }

        .checks div {
          padding: 10px;
          border-radius: 10px;
          background: white;
          border: 1px solid #ddd;
          color: #333;
          font-size: 12px;
        }

        .checks span {
          margin-left: 5px;
          font-weight: 800;
        }

        footer {
          width: min(760px, calc(100% - 32px));
          margin: 45px auto 0;
          text-align: center;
          color: #777;
          font-size: 13px;
        }

        @media (max-width: 600px) {
          .header {
            padding: 16px 20px;
          }

          .hero {
            padding: 65px 20px 40px;
          }

          .hero h1 {
            font-size: 52px;
            letter-spacing: -2.5px;
          }

          .hero p {
            font-size: 18px;
          }

          .card {
            padding: 22px;
            border-radius: 22px;
          }

          .twoColumns {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .actions {
            flex-direction: column;
          }

          .checks {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </>
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
  const count = value.length;

  return (
    <div className="outputBox">
      <div className="outputHeader">
        <div>
          <div className="outputLabel">{label}</div>

          {typeof max === "number" && (
            <div className="counter">
              {count}/{max}
            </div>
          )}
        </div>

        <CopyButton value={value} />
      </div>

      <div className="outputValue">
        {value || "—"}
      </div>
    </div>
  );
}
