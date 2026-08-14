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
    .replace(
      /\b(top luxury|best quality|hot sale|new arrival|free shipping|official)\b/gi,
      ""
    )
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

function detectProductType(title: string, description = "", features = "") {
  const text = `${title} ${description} ${features}`.toLowerCase();

  if (
    /\b(watch|watches|wristwatch|chronograph|timepiece|quartz|automatic movement)\b/i.test(
      text
    )
  ) {
    return "Watches";
  }

  if (
    /\b(shirt|dress|jacket|pants|jeans|hoodie|blouse|skirt|romper|shorts|top|sweater)\b/i.test(
      text
    )
  ) {
    return "Apparel";
  }

  if (/\b(shoe|shoes|sneaker|sneakers|sandals|boots|loafer)\b/i.test(text)) {
    return "Footwear";
  }

  if (
    /\b(faucet|shower|bathroom|mirror|bathtub|sink|tap|vanity)\b/i.test(text)
  ) {
    return "Bathroom";
  }

  if (
    /\b(organizer|storage|storage box|drawer|closet|shelf|rack|container)\b/i.test(
      text
    )
  ) {
    return "Home Organization";
  }

  if (
    /\b(phone|charger|usb|electronic|keyboard|fan|speaker|headphone|wireless)\b/i.test(
      text
    )
  ) {
    return "Electronics";
  }

  if (
    /\b(kitchen|peeler|sealer|bottle|thermos|utensil|cookware)\b/i.test(text)
  ) {
    return "Kitchen";
  }

  if (
    /\b(car|vehicle|automotive|dashboard|trunk|seat|auto)\b/i.test(text)
  ) {
    return "Automotive";
  }

  return "General";
}

/*
  Removes common supplier words but keeps useful product information.
*/
function removeSupplierWords(text: string) {
  return text
    .replace(/\b(2026|2025|2024)\b/gi, "")
    .replace(
      /\b(new|latest|top|best|luxury|hot sale|fashion|free shipping|wholesale)\b/gi,
      ""
    )
    .replace(/\bfor men\b/gi, "Men's")
    .replace(/\bfor women\b/gi, "Women's")
    .replace(/\bwatches\b/gi, "Watch")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/*
  Creates a specific product title from the original title.
  It does NOT replace everything with a generic title.
*/
function buildTitle(originalTitle: string, productType: string) {
  let source = cleanText(originalTitle);

  source = removeSupplierWords(source);

  if (!source) {
    return productType === "Watches"
      ? "Classic Watch"
      : productType === "Apparel"
      ? "Everyday Apparel"
      : productType === "Footwear"
      ? "Everyday Footwear"
      : "Everyday Product";
  }

  if (productType === "Watches") {
    const gender =
      /\bmen'?s\b/i.test(source)
        ? "Men's"
        : /\bwomen'?s\b|\bladies\b/i.test(source)
        ? "Women's"
        : "";

    const movement =
      /\bchronograph\b/i.test(source)
        ? "Chronograph"
        : /\bautomatic\b/i.test(source)
        ? "Automatic"
        : /\bquartz\b/i.test(source)
        ? "Quartz"
        : "";

    const modelMatch = source.match(
      /\b(PAGANI DESIGN|PAGANI|V\d+|[A-Z]{1,5}\s?\d{1,5}|Moon)\b/gi
    );

    const modelWords = modelMatch
      ? Array.from(new Set(modelMatch.map((x) => x.trim()))).join(" ")
      : "";

    const cleanParts = source
      .replace(/\bmen'?s\b/gi, "")
      .replace(/\bwomen'?s\b/gi, "")
      .replace(/\bwatch\b/gi, "")
      .replace(/\bquartz\b/gi, "")
      .replace(/\bautomatic\b/gi, "")
      .replace(/\bchronograph\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    let titleParts = [
      modelWords,
      cleanParts,
      gender,
      movement,
      "Watch",
    ].filter(Boolean);

    let result = titleParts.join(" ").replace(/\s{2,}/g, " ").trim();

    result = result
      .replace(/\bWatch Watch\b/gi, "Watch")
      .replace(/\bPAGANI DESIGN PAGANI DESIGN\b/gi, "PAGANI DESIGN")
      .replace(/\bMoon Moon\b/gi, "Moon");

    return limit(result, 65);
  }

  if (productType === "Apparel") {
    const gender =
      /\bmen'?s\b/i.test(source)
        ? "Men's"
        : /\bwomen'?s\b|\bladies\b/i.test(source)
        ? "Women's"
        : "";

    const item =
      /\bdress\b/i.test(source)
        ? "Dress"
        : /\bshirt\b/i.test(source)
        ? "Shirt"
        : /\bblouse\b/i.test(source)
        ? "Blouse"
        : /\bjacket\b/i.test(source)
        ? "Jacket"
        : /\bjeans\b/i.test(source)
        ? "Jeans"
        : /\bpants\b/i.test(source)
        ? "Pants"
        : /\bskirt\b/i.test(source)
        ? "Skirt"
        : "Apparel";

    const important = source
      .replace(/\bmen'?s\b/gi, "")
      .replace(/\bwomen'?s\b/gi, "")
      .replace(/\b(dress|shirt|blouse|jacket|jeans|pants|skirt)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return limit(
      `${gender} ${important} ${item}`.replace(/\s{2,}/g, " ").trim(),
      65
    );
  }

  if (productType === "Footwear") {
    const item = /\bsneaker/i.test(source)
      ? "Sneakers"
      : /\bsandal/i.test(source)
      ? "Sandals"
      : /\bboot/i.test(source)
      ? "Boots"
      : /\bloafer/i.test(source)
      ? "Loafers"
      : "Footwear";

    return limit(`${source.replace(/\b(shoes?|sneakers?)\b/gi, "").trim()} ${item}`, 65);
  }

  if (productType === "Bathroom") {
    const item = /\bfaucet|tap\b/i.test(source)
      ? "Faucet"
      : /\bshower\b/i.test(source)
      ? "Shower Fixture"
      : /\bmirror\b/i.test(source)
      ? "Bathroom Mirror"
      : "Bathroom Fixture";

    const base = source
      .replace(/\b(faucet|tap|shower|mirror|bathroom)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return limit(`${base} ${item}`.trim(), 65);
  }

  if (productType === "Home Organization") {
    const item = /\bstorage/i.test(source)
      ? "Storage Organizer"
      : /\bshoe/i.test(source)
      ? "Shoe Organizer"
      : /\bcloset/i.test(source)
      ? "Closet Organizer"
      : "Home Organizer";

    return limit(`${source} ${item}`.trim(), 65);
  }

  if (productType === "Electronics") {
    const item = /\bcharger/i.test(source)
      ? "Charger"
      : /\bfan/i.test(source)
      ? "Portable Fan"
      : /\bkeyboard/i.test(source)
      ? "Wireless Keyboard"
      : /\bspeaker/i.test(source)
      ? "Wireless Speaker"
      : "Device";

    return limit(`${source} ${item}`.trim(), 65);
  }

  return limit(source, 65);
}

/*
  AUTO-GENERATES DESCRIPTION FROM TITLE ONLY.
*/
function autoDescription(title: string, productType: string) {
  const cleanTitle = title.trim();

  const intro =
    productType === "Watches"
      ? `${cleanTitle} combines a refined look with practical everyday functionality.`
      : productType === "Apparel"
      ? `${cleanTitle} offers a polished style designed for comfortable everyday wear.`
      : productType === "Footwear"
      ? `${cleanTitle} combines everyday comfort with a versatile, polished look.`
      : productType === "Bathroom"
      ? `${cleanTitle} brings practical functionality and a clean, modern look to the bathroom.`
      : productType === "Electronics"
      ? `${cleanTitle} is designed to provide practical functionality with convenient everyday use.`
      : `${cleanTitle} is designed for customers who value practical function, clean style, and everyday usability.`;

  return [
    intro,
    "",
    "Key features:",
    "• Clean and versatile design",
    "• Practical everyday functionality",
    "• Easy to use",
    "• Designed for convenient everyday use",
    "",
    `A versatile choice for customers looking for a polished ${productType.toLowerCase()} product.`
  ].join("\n");
}

/*
  AUTO-GENERATES FEATURES FROM TITLE.
*/
function autoFeatures(title: string, productType: string) {
  const text = title.toLowerCase();

  const features: string[] = [];

  if (productType === "Watches") {
    if (text.includes("quartz")) features.push("Quartz movement");
    if (text.includes("automatic")) features.push("Automatic movement");
    if (text.includes("chronograph")) features.push("Chronograph function");
    if (text.includes("steel")) features.push("Stainless steel construction");
    if (text.includes("moon")) features.push("Moon-inspired design");
    if (text.includes("men")) features.push("Men's styling");
    if (text.includes("women")) features.push("Women's styling");

    features.push(
      "Classic timepiece design",
      "Designed for everyday wear"
    );
  } else if (productType === "Apparel") {
    features.push(
      "Versatile everyday style",
      "Comfort-focused design",
      "Easy to pair with different outfits"
    );
  } else if (productType === "Footwear") {
    features.push(
      "Comfort-focused design",
      "Versatile everyday styling",
      "Suitable for casual wear"
    );
  } else if (productType === "Bathroom") {
    features.push(
      "Modern bathroom design",
      "Practical everyday functionality",
      "Clean and versatile styling"
    );
  } else if (productType === "Electronics") {
    features.push(
      "Practical everyday functionality",
      "Convenient design",
      "Easy to use"
    );
  } else {
    features.push(
      "Practical everyday functionality",
      "Clean and versatile design",
      "Easy to use"
    );
  }

  return Array.from(new Set(features))
    .map((x) => `• ${x}`)
    .join("\n");
}

/*
  Uses the original description/features when available.
  If they are blank, generated information is used.
*/
function buildDescription(
  title: string,
  description: string,
  features: string[],
  productType: string
) {
  const original = cleanText(description);

  const cleanedOriginal = original
    .split(/\n|•|;/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter(
      (x) =>
        !/mainland china|supplier|wholesale|dropship|dear customer|welcome to our store/i.test(
          x
        )
    )
    .slice(0, 5);

  const featureText =
    features.length > 0
      ? features.map((x) => `• ${limit(x, 120)}`).join("\n")
      : autoFeatures(title, productType);

  if (cleanedOriginal.length > 0) {
    return [
      `${title} is designed for customers who value quality, style, and practical everyday use.`,
      "",
      cleanedOriginal.map((x) => limit(x, 180)).join("\n\n"),
      "",
      "Key features:",
      featureText,
    ].join("\n");
  }

  return autoDescription(title, productType);
}

function buildSeoTitle(title: string) {
  return limit(title, 50);
}

function buildMeta(title: string, productType: string) {
  const text =
    `Shop ${title} with a clean design and practical features. ` +
    `A versatile ${productType.toLowerCase()} choice for everyday use.`;

  return limit(text, 160);
}

function buildKeywords(title: string, productType: string) {
  const words = title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((x) => x.length > 2);

  return Array.from(
    new Set([
      title.toLowerCase(),
      productType.toLowerCase(),
      ...words,
      "quality design",
      "everyday use",
    ])
  ).join(", ");
}

function buildTags(title: string, productType: string) {
  const tags = [
    productType,
    "New Arrival",
    "Everyday",
    "Modern Style",
    "Featured",
  ];

  const lower = title.toLowerCase();

  if (lower.includes("men")) tags.push("Men");
  if (lower.includes("women")) tags.push("Women");
  if (lower.includes("quartz")) tags.push("Quartz");
  if (lower.includes("automatic")) tags.push("Automatic");
  if (lower.includes("chronograph")) tags.push("Chronograph");

  return Array.from(new Set(tags)).join(", ");
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

  /*
    THIS IS THE NEW AUTO-FILL FUNCTION.
    Title only -> Description + Features + Product Type.
  */
  function autoFillProductInfo() {
    if (!originalTitle.trim()) return;

    const detectedType = detectProductType(originalTitle);

    const generatedTitle = buildTitle(
      originalTitle,
      detectedType
    );

    setProductType(detectedType);

    setFeatures(autoFeatures(generatedTitle, detectedType));

    setDescription(
      autoDescription(generatedTitle, detectedType)
    );
  }

  function optimizeProduct() {
    if (!originalTitle.trim()) return;

    const detectedType =
      productType.trim() ||
      detectProductType(originalTitle, description, features);

    const title = buildTitle(
      originalTitle,
      detectedType
    );

    const featureList = features
      .split(/\n|•|;/)
      .map((x) => x.trim())
      .filter(Boolean);

    const optimizedDescription = buildDescription(
      title,
      description,
      featureList,
      detectedType
    );

    const seoTitle = buildSeoTitle(title);
    const metaDescription = buildMeta(title, detectedType);

    setResult({
      title,
      description: optimizedDescription,
      seoTitle,
      metaDescription,
      keywords: buildKeywords(title, detectedType),
      tags: buildTags(title, detectedType),
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
          placeholder="Paste the original product title"
        />

        <button
          className="autoFill"
          type="button"
          onClick={autoFillProductInfo}
        >
          Auto-Fill Product Information
        </button>

        <p className="hint">
          Enter the product title first, then tap Auto-Fill. Description,
          features, and product type will be generated automatically.
        </p>

        <label>PRODUCT DESCRIPTION</label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Automatically generated from product title"
          rows={7}
        />

        <label>FEATURES</label>

        <textarea
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          placeholder="Automatically generated from product title"
          rows={6}
        />

        <label>PRODUCT TYPE</label>

        <input
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          placeholder="Automatically detected"
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

        <button
          className="primary"
          type="button"
          onClick={optimizeProduct}
        >
          Optimize Product
        </button>

        <button
          className="secondary"
          type="button"
          onClick={clearAll}
        >
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
              Add your product title, auto-fill the information, then
              select Optimize Product.
            </p>
          </div>
        ) : (
          <>
            <OutputBox
              label="PRODUCT TITLE"
              value={result.title}
              max={65}
            />

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

      <footer>
        Virello AI Optimizer · Product content workflow
      </footer>

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

        .autoFill {
          background: white;
          color: #111;
          border: 1px solid #111;
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

        .hint {
          color: #777;
          font-size: 14px;
          line-height: 1.5;
          margin: 12px 0 0;
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
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
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

        <button className="copy" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="outputValue">
        {textarea ? value : value}
      </div>
    </div>
  );
        }
