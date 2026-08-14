"use client";

import { useMemo, useState } from "react";

type ProductInput = {
  title: string;
  description: string;
  features: string;
  productType: string;
  brand: string;
  material: string;
  color: string;
  movement: string;
  caseSize: string;
  waterResistance: string;
  targetCustomer: string;
  price: string;
};

function clean(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();
}

function limit(value: string, max: number) {
  return value.length <= max ? value : value.slice(0, max).replace(/\s+\S*$/, "").trim();
}

function slugify(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(items: string[]) {
  return [...new Set(items.map(clean).filter(Boolean))];
}

function generateOptimizedProduct(input: ProductInput) {
  const title = clean(input.title);
  const description = clean(input.description);
  const features = unique(
    input.features
      .split(/\n|,|•|;/)
      .map(clean)
      .filter(Boolean)
  );

  const productType = clean(input.productType) || "Timepiece";
  const brand = clean(input.brand);
  const material = clean(input.material);
  const color = clean(input.color);
  const movement = clean(input.movement);
  const caseSize = clean(input.caseSize);
  const waterResistance = clean(input.waterResistance);

  /*
   * IMPORTANT:
   * Only supplied specifications are used.
   * The optimizer does not invent technical claims.
   */

  const titleParts = unique([
    brand && brand !== "Generic" ? brand : "",
    title,
  ]);

  let optimizedTitle = titleParts.join(" ");

  if (optimizedTitle.length > 65) {
    optimizedTitle = limit(title, 65);
  }

  const benefitPool = [
    movement ? `Powered by a ${movement.toLowerCase()} movement` : "",
    material ? `Crafted with ${material.toLowerCase()}` : "",
    color ? `${color} finish for a refined look` : "",
    caseSize ? `${caseSize} case size` : "",
    waterResistance ? `${waterResistance} water resistance` : "",
    features[0] ? clean(features[0]) : "",
    features[1] ? clean(features[1]) : "",
  ];

  const benefits = unique(benefitPool).slice(0, 6);

  const specificationLines = unique([
    movement ? `Movement: ${movement}` : "",
    material ? `Material: ${material}` : "",
    color ? `Color: ${color}` : "",
    caseSize ? `Case Size: ${caseSize}` : "",
    waterResistance ? `Water Resistance: ${waterResistance}` : "",
    ...features.slice(0, 8),
  ]);

  const opening = [
    `Designed for a refined everyday presence, the ${optimizedTitle} brings together considered styling and the specifications that matter.`,
    description,
  ]
    .filter(Boolean)
    .join(" ");

  const descriptionParagraphs = [
    opening,
    benefits.length
      ? `Key highlights include ${benefits.slice(0, 3).join(", ")}${benefits.length > 3 ? ", and more." : "."}`
      : "",
    `A clean, versatile design makes this ${productType.toLowerCase()} easy to pair with both polished and everyday looks.`,
  ].filter(Boolean);

  const seoTitle = limit(
    `${optimizedTitle} | ${brand || "Horizon Timepieces"}`,
    60
  );

  const metaDescription = limit(
    `${optimizedTitle}. Explore the design, features and specifications of this refined ${productType.toLowerCase()} from ${brand || "Horizon Timepieces"}.`,
    160
  );

  const altText = limit(
    `${optimizedTitle}${color ? ` in ${color}` : ""}${material ? ` ${material}` : ""}`,
    125
  );

  const tags = unique([
    "timepiece",
    "watches",
    productType,
    brand,
    color,
    material,
    movement,
    ...features.slice(0, 5),
  ])
    .map((tag) => tag.toLowerCase())
    .filter((tag) => tag.length >= 2)
    .slice(0, 15);

  return {
    optimizedTitle,
    description: descriptionParagraphs.join("\n\n"),
    benefits,
    specifications: specificationLines,
    seoTitle,
    metaDescription,
    urlHandle: slugify(optimizedTitle),
    imageAltText: altText,
    tags,
    productType,
  };
}

export default function ProductOptimizer() {
  const [input, setInput] = useState<ProductInput>({
    title: "",
    description: "",
    features: "",
    productType: "Luxury Watch",
    brand: "",
    material: "",
    color: "",
    movement: "",
    caseSize: "",
    waterResistance: "",
    targetCustomer: "",
    price: "",
  });

  const [optimized, setOptimized] = useState<ReturnType<
    typeof generateOptimizedProduct
  > | null>(null);

  const [copied, setCopied] = useState<string | null>(null);

  const update = (key: keyof ProductInput, value: string) => {
    setInput((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const optimize = () => {
    if (!input.title.trim()) return;
    setOptimized(generateOptimizedProduct(input));
  };

  const copy = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const seoCount = useMemo(
    () => optimized?.seoTitle.length ?? 0,
    [optimized]
  );

  const metaCount = useMemo(
    () => optimized?.metaDescription.length ?? 0,
    [optimized]
  );

  return (
    <main className="optimizer">
      <header className="top">
        <div>
          <p className="eyebrow">HORIZON TIMEPIECES</p>
          <h1>Product Optimizer</h1>
          <p className="subtitle">
            Create polished, unique product content built for customers and
            search engines.
          </p>
        </div>
      </header>

      <section className="workspace">
        <div className="panel inputPanel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">PRODUCT DATA</p>
              <h2>Product Information</h2>
            </div>
            <span className="badge">AI READY</span>
          </div>

          <Field
            label="Original Product Title"
            value={input.title}
            onChange={(v) => update("title", v)}
            placeholder="Example: PAGANI DESIGN Automatic Men's Watch"
          />

          <Field
            label="Original Description"
            value={input.description}
            onChange={(v) => update("description", v)}
            textarea
            placeholder="Paste the supplier/product description here..."
          />

          <Field
            label="Features / Specifications"
            value={input.features}
            onChange={(v) => update("features", v)}
            textarea
            placeholder={"One feature per line\nAutomatic movement\nStainless steel case\nSapphire crystal"}
          />

          <div className="grid">
            <Field
              label="Product Type"
              value={input.productType}
              onChange={(v) => update("productType", v)}
              placeholder="Luxury Watch"
            />

            <Field
              label="Brand"
              value={input.brand}
              onChange={(v) => update("brand", v)}
              placeholder="Brand if applicable"
            />

            <Field
              label="Material"
              value={input.material}
              onChange={(v) => update("material", v)}
              placeholder="Stainless Steel"
            />

            <Field
              label="Color"
              value={input.color}
              onChange={(v) => update("color", v)}
              placeholder="Black"
            />

            <Field
              label="Movement"
              value={input.movement}
              onChange={(v) => update("movement", v)}
              placeholder="Automatic"
            />

            <Field
              label="Case Size"
              value={input.caseSize}
              onChange={(v) => update("caseSize", v)}
              placeholder="40mm"
            />

            <Field
              label="Water Resistance"
              value={input.waterResistance}
              onChange={(v) => update("waterResistance", v)}
              placeholder="5 ATM"
            />

            <Field
              label="Price"
              value={input.price}
              onChange={(v) => update("price", v)}
              placeholder="$249.00"
            />
          </div>

          <Field
            label="Target Customer"
            value={input.targetCustomer}
            onChange={(v) => update("targetCustomer", v)}
            placeholder="Men looking for a refined everyday timepiece"
          />

          <button
            className="optimizeButton"
            onClick={optimize}
            disabled={!input.title.trim()}
          >
            Optimize Product
          </button>

          <p className="note">
            Technical claims are only generated from information you provide.
            No specifications are invented.
          </p>
        </div>

        <div className="panel resultPanel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">OPTIMIZED OUTPUT</p>
              <h2>Product Content</h2>
            </div>
          </div>

          {!optimized ? (
            <div className="empty">
              <div className="emptyIcon">✦</div>
              <h3>Ready to optimize</h3>
              <p>
                Enter the product information on the left, then optimize it
                into clean, customer-focused content.
              </p>
            </div>
          ) : (
            <div className="results">
              <Output
                title="Product Title"
                value={optimized.optimizedTitle}
                onCopy={() => copy("title", optimized.optimizedTitle)}
                copied={copied === "title"}
              />

              <Output
                title="Product Description"
                value={optimized.description}
                multiline
                onCopy={() => copy("description", optimized.description)}
                copied={copied === "description"}
              />

              <div className="resultBlock">
                <div className="resultHeader">
                  <h3>Key Benefits</h3>
                  <button
                    onClick={() =>
                      copy("benefits", optimized.benefits.join("\n"))
                    }
                  >
                    {copied === "benefits" ? "Copied" : "Copy"}
                  </button>
                </div>

                <ul className="benefits">
                  {optimized.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="resultBlock">
                <div className="resultHeader">
                  <h3>Specifications</h3>
                  <button
                    onClick={() =>
                      copy(
                        "specs",
                        optimized.specifications.join("\n")
                      )
                    }
                  >
                    {copied === "specs" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="specs">
                  {optimized.specifications.map((spec) => (
                    <div key={spec}>{spec}</div>
                  ))}
                </div>
              </div>

              <Output
                title={`SEO Title · ${seoCount}/60`}
                value={optimized.seoTitle}
                onCopy={() => copy("seo", optimized.seoTitle)}
                copied={copied === "seo"}
              />

              <Output
                title={`Meta Description · ${metaCount}/160`}
                value={optimized.metaDescription}
                onCopy={() =>
                  copy("meta", optimized.metaDescription)
                }
                copied={copied === "meta"}
              />

              <Output
                title="URL Handle"
                value={optimized.urlHandle}
                onCopy={() => copy("url", optimized.urlHandle)}
                copied={copied === "url"}
              />

              <Output
                title="Image Alt Text"
                value={optimized.imageAltText}
                onCopy={() => copy("alt", optimized.imageAltText)}
                copied={copied === "alt"}
              />

              <div className="resultBlock">
                <div className="resultHeader">
                  <h3>Product Tags</h3>
                  <button
                    onClick={() =>
                      copy("tags", optimized.tags.join(", "))
                    }
                  >
                    {copied === "tags" ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="tags">
                  {optimized.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <Output
                title="Product Type"
                value={optimized.productType}
                onCopy={() =>
                  copy("type", optimized.productType)
                }
                copied={copied === "type"}
              />
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .optimizer {
          min-height: 100vh;
          background: #f6f6f4;
          color: #151515;
          padding: 44px 5% 80px;
          font-family: Arial, sans-serif;
        }

        .top {
          max-width: 1450px;
          margin: 0 auto 32px;
        }

        .eyebrow {
          margin: 0 0 8px;
          font-size: 10px;
          letter-spacing: 0.2em;
          font-weight: 700;
          color: #777;
        }

        h1 {
          margin: 0;
          font: 500 clamp(38px, 5vw, 64px) / 1 Georgia, serif;
        }

        .subtitle {
          color: #666;
          max-width: 650px;
          line-height: 1.7;
          margin-top: 15px;
        }

        .workspace {
          max-width: 1450px;
          margin: auto;
          display: grid;
          grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
          gap: 22px;
          align-items: start;
        }

        .panel {
          background: white;
          border: 1px solid #e5e5e1;
          border-radius: 8px;
          padding: 28px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
        }

        .panelTitle {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: start;
          margin-bottom: 25px;
        }

        h2 {
          margin: 0;
          font: 500 28px Georgia, serif;
        }

        .badge {
          border: 1px solid #ddd;
          padding: 6px 9px;
          font-size: 9px;
          letter-spacing: 0.1em;
        }

        .field {
          margin-bottom: 17px;
        }

        .field label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 7px;
          letter-spacing: 0.04em;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #d7d7d2;
          background: #fff;
          border-radius: 4px;
          padding: 12px;
          font: inherit;
          outline: none;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color: #777;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 12px;
        }

        .optimizeButton {
          width: 100%;
          border: 0;
          background: #111;
          color: white;
          padding: 15px;
          border-radius: 4px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 5px;
        }

        .optimizeButton:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .note {
          color: #777;
          font-size: 11px;
          line-height: 1.6;
          margin-bottom: 0;
        }

        .empty {
          min-height: 620px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          color: #777;
          padding: 40px;
        }

        .emptyIcon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border: 1px solid #ddd;
          border-radius: 50%;
          color: #222;
          margin-bottom: 18px;
        }

        .empty h3 {
          color: #222;
          font: 500 25px Georgia, serif;
          margin: 0 0 8px;
        }

        .empty p {
          max-width: 400px;
          line-height: 1.7;
          font-size: 13px;
        }

        .results {
          display: grid;
          gap: 14px;
        }

        .resultBlock {
          border: 1px solid #e5e5e1;
          padding: 17px;
          border-radius: 5px;
        }

        .resultHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 10px;
        }

        .resultHeader h3 {
          margin: 0;
          font-size: 12px;
        }

        .resultHeader button {
          border: 1px solid #ddd;
          background: white;
          padding: 6px 10px;
          font-size: 10px;
          cursor: pointer;
        }

        .output {
          border: 1px solid #e5e5e1;
          padding: 17px;
          border-radius: 5px;
        }

        .outputTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .outputTop h3 {
          margin: 0;
          font-size: 12px;
        }

        .outputTop button {
          border: 1px solid #ddd;
          background: white;
          padding: 6px 10px;
          font-size: 10px;
          cursor: pointer;
        }

        .outputValue {
          margin-top: 11px;
          white-space: pre-wrap;
          line-height: 1.7;
          color: #444;
          font-size: 13px;
          word-break: break-word;
        }

        .benefits {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 9px;
        }

        .benefits li {
          font-size: 13px;
          padding-left: 19px;
          position: relative;
        }

        .benefits li:before {
          content: "✓";
          position: absolute;
          left: 0;
          font-weight: 700;
        }

        .specs {
          display: grid;
          gap: 8px;
          font-size: 13px;
          color: #555;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .tags span {
          background: #f2f2ef;
          border: 1px solid #e2e2de;
          padding: 7px 9px;
          font-size: 11px;
          border-radius: 3px;
        }

        @media (max-width: 1000px) {
          .workspace {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .optimizer {
            padding: 28px 4% 60px;
          }

          .panel {
            padding: 20px;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .empty {
            min-height: 400px;
          }
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
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

function Output({
  title,
  value,
  onCopy,
  copied,
  multiline = false,
}: {
  title: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="output">
      <div className="outputTop">
        <h3>{title}</h3>
        <button onClick={onCopy}>{copied ? "Copied" : "Copy"}</button>
      </div>

      <div className={`outputValue ${multiline ? "multiline" : ""}`}>
        {value}
      </div>
    </div>
  );
}
