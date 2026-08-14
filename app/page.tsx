"use client";

import { useState } from "react";

type Result = {
  title: string;
  description: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  tags: string;
  altText: string;
  handle: string;
  productType: string;
};

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\b(2026|2025|2024)\b/gi, "")
    .replace(/\b(top luxury|best quality|hot sale|new arrival|free shipping)\b/gi, "")
    .replace(/\b(dear customer|welcome to our store)\b/gi, "")
    .replace(/\b(no reason to return)\b/gi, "")
    .replace(/\b(guaranteed for \d+ years?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
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
    .slice(0, 70)
    .replace(/-$/, "");
}

function detectProductType(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes("watch") ||
    text.includes("wristwatch") ||
    text.includes("chronograph")
  ) {
    return "Watches";
  }

  if (
    text.includes("shirt") ||
    text.includes("dress") ||
    text.includes("jacket") ||
    text.includes("pants") ||
    text.includes("jeans") ||
    text.includes("hoodie")
  ) {
    return "Apparel";
  }

  if (
    text.includes("shoe") ||
    text.includes("sneaker") ||
    text.includes("sandals")
  ) {
    return "Footwear";
  }

  if (
    text.includes("faucet") ||
    text.includes("shower") ||
    text.includes("bathroom") ||
    text.includes("mirror")
  ) {
    return "Bathroom";
  }

  if (
    text.includes("organizer") ||
    text.includes("storage") ||
    text.includes("box")
  ) {
    return "Home Organization";
  }

  if (
    text.includes("phone") ||
    text.includes("charger") ||
    text.includes("usb") ||
    text.includes("electronic")
  ) {
    return "Electronics";
  }

  return "General";
}

function buildTitle(
  originalTitle: string,
  description: string,
  productType: string
) {
  const text = cleanText(`${originalTitle} ${description}`);

  if (productType === "Watches") {
    const gender =
      /\bmen'?s?\b/i.test(text) ? "Men's" :
      /\bwomen'?s?\b|\bladies\b/i.test(text) ? "Women's" :
      "";

    const style =
      /\bchronograph\b/i.test(text)
        ? "Chronograph"
        : /\bautomatic\b/i.test(text)
        ? "Automatic"
        : /\bquartz\b/i.test(text)
        ? "Quartz"
        : "Classic";

    return limit(
      `${gender} ${style} Watch`.replace(/\s+/g, " ").trim(),
      65
    );
  }

  if (productType === "Apparel") {
    if (/\bdress\b/i.test(text)) return "Women's Everyday Dress";
    if (/\bshirt\b/i.test(text)) return "Classic Everyday Shirt";
    if (/\bjacket\b/i.test(text)) return "Classic Casual Jacket";
    if (/\bjeans\b/i.test(text)) return "Classic Everyday Jeans";
    if (/\bpants\b/i.test(text)) return "Modern Everyday Pants";
    return "Modern Everyday Apparel";
  }

  if (productType === "Footwear") {
    if (/\bsneaker\b/i.test(text)) return "Classic Everyday Sneakers";
    if (/\bsandal\b/i.test(text)) return "Comfort Casual Sandals";
    return "Classic Everyday Footwear";
  }

  if (productType === "Bathroom") {
    if (/\bfaucet\b/i.test(text)) return "Modern Bathroom Faucet";
    if (/\bshower\b/i.test(text)) return "Modern Shower Fixture";
    if (/\bmirror\b/i.test(text)) return "Modern Bathroom Mirror";
    return "Modern Bathroom Fixture";
  }

  if (productType === "Home Organization") {
    if (/\bstorage\b/i.test(text)) return "Practical Storage Organizer";
    return "Practical Home Organizer";
  }

  if (productType === "Electronics") {
    if (/\bcharger\b/i.test(text)) return "Portable Charging Device";
    return "Smart Everyday Device";
  }

  return "Modern Everyday Product";
}

function buildDescription(
  title: string,
  description: string,
  features: string
) {
  const source = cleanText(`${description}\n${features}`);

  const usefulLines = source
    .split(/\n|•|;/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter(
      (x) =>
        !/mainland china|china|supplier|wholesale|dropship|pagani design/i.test(
          x
        )
    )
    .slice(0, 6);

  const featureText =
    usefulLines.length > 0
      ? usefulLines.map((x) => `• ${limit(x, 120)}`).join("\n")
      : "• Practical design\n• Everyday functionality\n• Clean, versatile style";

  return [
    `${title} is designed for customers who value practical function, clean style, and dependable everyday use.`,
    "",
    "Key features:",
    featureText,
    "",
    "A versatile choice for everyday use with a polished, professional look."
  ].join("\n");
}

function buildSeoTitle(title: string) {
  return limit(title, 50);
}

function buildMeta(title: string, productType: string) {
  return limit(
    `Shop ${title} with a clean design and practical features. A versatile ${productType.toLowerCase()} choice for everyday use.`,
    160
  );
}

function buildKeywords(title: string, productType: string) {
  return Array.from(
    new Set([
      title.toLowerCase(),
      productType.toLowerCase(),
      "quality design",
      "everyday use",
      "modern style",
    ])
  ).join(", ");
}

function buildTags(productType: string) {
  return Array.from(
    new Set([
      productType,
      "New Arrival",
      "Everyday",
      "Modern Style",
      "Featured",
    ])
  ).join(", ");
}

function buildAltText(title: string) {
  return limit(`${title} product image`, 125);
}

export default function ProductOptimizer() {
  const [originalTitle, setOriginalTitle] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [productType, setProductType] = useState("");
  const [collection, setCollection] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function optimizeProduct() {
    if (!originalTitle.trim()) return;

    const detectedType =
      productType.trim() ||
      detectProductType(originalTitle, `${description} ${features}`);

    const title = buildTitle(
      originalTitle,
      `${description} ${features}`,
      detectedType
    );

    const optimizedDescription = buildDescription(
      title,
      description,
      features
    );

    const seoTitle = buildSeoTitle(title);
    const metaDescription = buildMeta(title, detectedType);

    setResult({
      title,
      description: optimizedDescription,
      seoTitle,
      metaDescription,
      keywords: buildKeywords(title, detectedType),
      tags: buildTags(detectedType),
      altText: buildAltText(title),
      handle: makeHandle(title),
      productType: detectedType,
    });
  }

  function clearAll() {
    setOriginalTitle("");
    setDescription("");
    setFeatures("");
    setProductType("");
    setCollection("");
    setPrice("");
    setResult(null);
  }

  return (
    <main className="page">
      <header className="header">
        <div className="brand">
          <div className="logo">V</div>
          <div>
            <strong>Virello</strong>
            <span>AI OPTIMIZER</span>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="badge">VIRELLO AI OPTIMIZER</div>
        <h1>
          Optimize every
          <br />
          <span>product listing.</span>
        </h1>
        <p>
          Create polished, professional product content without
          supplier-style wording.
        </p>
      </section>

      <section className="card">
        <div className="sectionNumber">01</div>
        <h2>Product information</h2>

        <label>ORIGINAL PRODUCT TITLE *</label>
        <input
          value={originalTitle}
          onChange={(e) => setOriginalTitle(e.target.value)}
          placeholder="Paste the original supplier product title"
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
          placeholder="Materials, movement, size, functions, style, etc."
          rows={6}
        />

        <label>PRODUCT TYPE</label>
        <input
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          placeholder="Leave blank for automatic detection"
        />

        <label>COLLECTION</label>
        <input
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          placeholder="Optional"
        />

        <label>PRICE</label>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Optional"
        />

        <button className="primary" onClick={optimizeProduct}>
          Optimize Product
        </button>

        <button className="secondary" onClick={clearAll}>
          Clear
        </button>
      </section>

      <section className="card">
        <div className="sectionNumber">02</div>
        <div className="ready">READY</div>
        <h2>Optimized listing</h2>

        {!result ? (
          <div className="empty">
            <h3>Your optimized listing will appear here</h3>
            <p>
              Add your product information above, then select Optimize
              Product.
            </p>
          </div>
        ) : (
          <>
            <OutputBox label="PRODUCT TITLE" value={result.title} />

            <OutputBox
              label="DESCRIPTION"
              value={result.description}
              textarea
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
              <span>STORE PREVIEW</span>
              <h3>{result.title}</h3>
              <p>{result.description}</p>
              <div className="checks">
                <div>✓ TITLE</div>
                <div>✓ SEO</div>
                <div>✓ META</div>
                <div>✓ CLEANED</div>
              </div>
            </div>
          </>
        )}
      </section>

      <footer>Virello AI Optimizer · Product content workflow</footer>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f5f3;
          color: #101010;
          font-family: Arial, Helvetica, sans-serif;
        }

        .page {
          min-height: 100vh;
          background: #f5f5f3;
        }

        .header {
          background: #101010;
          color: white;
          padding: 28px 6%;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo {
          width: 52px;
          height: 52px;
          border: 1px solid #777;
          border-radius: 15px;
          display: grid;
          place-items: center;
          font-size: 28px;
          font-weight: 800;
        }

        .brand strong {
          display: block;
          font-size: 22px;
          letter-spacing: 1px;
        }

        .brand span {
          display: block;
          font-size: 11px;
          letter-spacing: 4px;
          color: #aaa;
          margin-top: 4px;
        }

        .hero {
          max-width: 900px;
          margin: auto;
          padding: 90px 6% 55px;
        }

        .badge {
          display: inline-block;
          padding: 12px 18px;
          border: 1px solid #ddd;
          border-radius: 30px;
          letter-spacing: 3px;
          font-size: 12px;
          font-weight: 700;
          background: white;
        }

        .hero h1 {
          font-size: clamp(48px, 8vw, 88px);
          line-height: 0.98;
          margin: 35px 0 30px;
          letter-spacing: -4px;
        }

        .hero h1 span {
          color: #777;
        }

        .hero p {
          font-size: 22px;
          line-height: 1.55;
          color: #666;
          max-width: 720px;
        }

        .card {
          max-width: 900px;
          margin: 25px auto;
          padding: 45px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 28px;
          position: relative;
        }

        .sectionNumber {
          color: #777;
          font-size: 13px;
          letter-spacing: 3px;
          margin-bottom: 15px;
        }

        .ready {
          position: absolute;
          top: 45px;
          right: 45px;
          color: #555;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        h2 {
          font-size: 36px;
          margin: 0 0 35px;
        }

        label {
          display: block;
          margin: 25px 0 9px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #666;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #d5d5d5;
          border-radius: 14px;
          padding: 17px;
          font-size: 17px;
          font-family: inherit;
          background: #fff;
          color: #111;
        }

        textarea {
          resize: vertical;
          line-height: 1.55;
        }

        button {
          width: 100%;
          padding: 18px;
          border-radius: 14px;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 22px;
        }

        .primary {
          background: #101010;
          color: white;
          border: 1px solid #101010;
        }

        .secondary {
          background: white;
          color: #111;
          border: 1px solid #ccc;
        }

        .empty {
          padding: 50px 20px;
          text-align: center;
          border: 1px dashed #ccc;
          border-radius: 18px;
        }

        .empty p {
          color: #777;
        }

        .ready + h2 {
          padding-right: 100px;
        }

        .output {
          margin-top: 28px;
          border: 1px solid #ddd;
          border-radius: 18px;
          overflow: hidden;
        }

        .outputHead {
          padding: 17px 20px;
          background: #fafafa;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .outputLabel {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #666;
        }

        .counter {
          font-size: 12px;
          color: #888;
          margin-left: 10px;
        }

        .copy {
          width: auto;
          margin: 0;
          padding: 8px 16px;
          border: 1px solid #ccc;
          background: white;
          color: #111;
          font-size: 14px;
        }

        .outputValue {
          padding: 22px;
          white-space: pre-wrap;
          line-height: 1.6;
          font-size: 18px;
        }

        .preview {
          margin-top: 35px;
          padding: 25px;
          border: 1px solid #ddd;
          border-radius: 18px;
        }

        .preview > span {
          font-size: 11px;
          letter-spacing: 2px;
          color: #777;
        }

        .preview h3 {
          font-size: 25px;
          margin-bottom: 10px;
        }

        .preview p {
          color: #555;
          white-space: pre-wrap;
          line-height: 1.55;
        }

        .checks {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 20px;
          font-size: 12px;
          letter-spacing: 1px;
        }

        footer {
          max-width: 900px;
          margin: 40px auto;
          padding: 30px 6%;
          text-align: center;
          color: #777;
          font-size: 13px;
        }

        @media (max-width: 600px) {
          .card {
            margin: 18px;
            padding: 25px;
            border-radius: 22px;
          }

          .hero {
            padding: 60px 25px 35px;
          }

          .hero h1 {
            font-size: 52px;
            letter-spacing: -3px;
          }

          .hero p {
            font-size: 18px;
          }

          .ready {
            top: 30px;
            right: 25px;
          }
        }
      `}</style>
    </main>
  );
}

function OutputBox({
  label,
  value,
  max,
  textarea = false,
}: {
  label: string;
  value: string;
  max?: number;
  textarea?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="output">
      <div className="outputHead">
        <div>
          <span className="outputLabel">{label}</span>
          {max ? (
            <span className="counter">
              {value.length}/{max}
            </span>
          ) : null}
        </div>

        <button className="copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="outputValue">{value}</div>
    </div>
  );
}
