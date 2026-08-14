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
