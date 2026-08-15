"use client";

import { ChangeEvent, useMemo, useState } from "react";

type ProductResult = {
  title: string;
  description: string;
  bullets: string[];
  specs: string[];
  seoTitle: string;
  metaDescription: string;
};

const MAX_IMAGES = 6;

const clean = (s: string) =>
  s.replace(/\s+/g, " ").replace(/[|]+/g, " ").trim();

const stripSupplierNoise = (s: string) =>
  clean(
    s
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(
        /\b(country of origin|place of origin|origin|made in)\s*[:\-]?\s*[a-zA-Z ,.-]+/gi,
        ""
      )
  );

const limit = (s: string, max: number) => {
  const value = stripSupplierNoise(s);
  if (value.length <= max) return value;

  const cut = value.slice(0, max + 1);
  const i = cut.lastIndexOf(" ");

  return cut
    .slice(0, i > 0 ? i : max)
    .replace(/[.,;:!?|-]+$/, "")
    .trim();
};

function makeTitle(input: string) {
  const source = stripSupplierNoise(input);
  const lower = source.toLowerCase();

  const model = source
    .match(/\bv\s?\d+\b/i)?.[0]
    ?.replace(/\s+/g, "")
    .toUpperCase();

  if (/(watch|timepiece|chronograph|pagani)/i.test(source)) {
    const parts = [
      lower.includes("pagani") ? "Pagani" : "",
      model || "",
      lower.includes("moon") ? "Moon" : "",
      lower.includes("chronograph") ? "Chronograph" : "",
      "Men's Watch",
    ].filter(Boolean);

    return clean(parts.join(" "));
  }

  return source
    .replace(/[,:;()[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");
}

function makeCopy(
  title: string,
  audience: string,
  style: string
): ProductResult {
  const audienceText =
    audience === "Women"
      ? "women"
      : audience === "Men"
        ? "men"
        : "men and women";

  const styleText =
    style === "Premium / Luxury"
      ? "a refined premium look"
      : style === "Professional"
        ? "a polished professional look"
        : style === "Sport"
          ? "a confident sport-inspired look"
          : style === "Gift"
            ? "a thoughtful gifting option"
            : style === "Casual"
              ? "an effortless casual look"
              : "a versatile everyday style";

  const bullets =
    style === "Professional"
      ? [
          "Refined styling that complements business and formal outfits",
          "Versatile enough for workdays, evenings and special occasions",
          "Clean presentation that feels polished without being overstated",
          "A strong choice for personal wear or gifting",
        ]
      : style === "Sport"
        ? [
            "Confident sport-inspired styling for an active wardrobe",
            "Easy to pair with casual and everyday outfits",
            "Versatile design made for regular wear",
            "A practical option for personal use or gifting",
          ]
        : [
            "Refined design for a polished appearance",
            "Versatile styling for business, casual and special occasions",
            "Easy to pair with a wide range of outfits",
            "A thoughtful option for personal wear or gifting",
          ];

  const specs = [
    `Style: ${style}`,
    `Designed for: ${audience === "Unisex" ? "Men & Women" : audience}`,
    "Use: Everyday & Special Occasions",
    "Design: Refined & Versatile",
  ];

  const seoTitle = limit(`${title} | Men's Luxury Watch`, 60);

  const metaDescription = limit(
    `Discover the ${title}, designed for ${styleText}. A versatile timepiece for ${audienceText}, business, everyday wear and special occasions.`,
    160
  );

  return {
    title,
    description: `${title} is designed for ${styleText}, with a clean and versatile profile for ${audienceText}. Its balanced styling makes it easy to pair with business attire, casual outfits and special occasions.`,
    bullets,
    specs,
    seoTitle,
    metaDescription,
  };
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Image could not be read."));

    reader.onerror = () =>
      reject(new Error("Image could not be read."));

    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [productTitle, setProductTitle] = useState("");
  const [price, setPrice] = useState("129.99");
  const [audience, setAudience] = useState("Men");
  const [style, setStyle] = useState("Premium / Luxury");
  const [imageCount, setImageCount] = useState(4);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [result, setResult] = useState<ProductResult | null>(null);

  const previewResult = useMemo(
    () =>
      productTitle.trim()
        ? makeCopy(makeTitle(productTitle), audience, style)
        : null,
    [productTitle, audience, style]
  );

  const activeResult = result ?? previewResult;

  async function uploadImages(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(e.target.files ?? [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, MAX_IMAGES);

    if (!files.length) return;

    try {
      const images = await Promise.all(files.map(readImage));

      setUploadedImages(images);
      setImageCount(images.length);
    } catch {
      alert(
        "One or more images could not be uploaded. Please try again."
      );
    }

    e.target.value = "";
  }

  function removeImage(index: number) {
    const next = uploadedImages.filter(
      (_, i) => i !== index
    );

    setUploadedImages(next);
    setImageCount(
      Math.min(next.length, MAX_IMAGES)
    );
  }

  function generate() {
    if (!previewResult) {
      alert(
        "Please enter the original product title first."
      );
      return;
    }

    setResult(previewResult);
    setGenerated(true);

    setTimeout(
      () =>
        document
          .getElementById("preview")
          ?.scrollIntoView({
            behavior: "smooth",
          }),
      50
    );
  }

  return (
    <main className="page">
      <header className="header">
        <div className="brand">VIRELLO</div>

        <div className="subtitle">
          AI PRODUCT OPTIMIZER
        </div>
      </header>

      {!generated ? (
        <section className="editor">
          <div className="eyebrow">
            Virello AI
          </div>

          <h1>
            Turn product information into a page
            built to convert.
          </h1>

          <p className="intro">
            Create cleaner product copy, stronger
            benefits, natural positioning and
            search-ready SEO without supplier-style
            wording.
          </p>

          <div className="panel">
            <h2>Product Information</h2>

            <label htmlFor="title">
              Original Product Title
            </label>

            <textarea
              id="title"
              value={productTitle}
              onChange={(e) =>
                setProductTitle(e.target.value)
              }
              placeholder="Paste the full supplier product title here"
            />

            <div className="two-col">
              <div>
                <label htmlFor="price">
                  Product Price
                </label>

                <div className="price">
                  <span>$</span>

                  <input
                    id="price"
                    value={price}
                    onChange={(e) =>
                      setPrice(e.target.value)
                    }
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div>
                <label>
                  Target Audience
                </label>

                <div className="choices">
                  {[
                    "Women",
                    "Men",
                    "Unisex",
                  ].map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        audience === item
                          ? "choice active"
                          : "choice"
                      }
                      onClick={() =>
                        setAudience(item)
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label>
              Copywriting Style
            </label>

            <div className="choices">
              {[
                "Premium / Luxury",
                "Professional",
                "Everyday",
                "Casual",
                "Sport",
                "Gift",
              ].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={
                    style === item
                      ? "choice active"
                      : "choice"
                  }
                  onClick={() =>
                    setStyle(item)
                  }
                >
                  {item}
                </button>
              ))}
            </div>

            <label>
              Product Images
            </label>

            <div className="upload">
              <input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={uploadImages}
              />

              <label
                htmlFor="images"
                className="upload-button"
              >
                + Upload Product Images
              </label>

              <p>
                Upload up to 6 product images.
              </p>
            </div>

            {uploadedImages.length > 0 && (
              <div className="uploaded">
                <div className="uploaded-top">
                  <strong>
                    {uploadedImages.length} image(s)
                    uploaded
                  </strong>

                  <button
                    type="button"
                    className="clear"
                    onClick={() => {
                      setUploadedImages([]);
                      setImageCount(0);
                    }}
                  >
                    Clear All
                  </button>
                </div>

                <div className="thumbs">
                  {uploadedImages.map(
                    (image, index) => (
                      <div
                        className="thumb"
                        key={`${image}-${index}`}
                      >
                        <img
                          src={image}
                          alt={`Product image ${
                            index + 1
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            removeImage(index)
                          }
                        >
                          ×
                        </button>

                        <small>
                          Image {index + 1}
                        </small>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <label>
              Number of Product Images
            </label>

            <div className="number-row">
              {[0, 1, 2, 3, 4, 5, 6].map(
                (number) => (
                  <button
                    type="button"
                    key={number}
                    className={
                      imageCount === number
                        ? "number active"
                        : "number"
                    }
                    onClick={() =>
                      setImageCount(
                        uploadedImages.length
                          ? Math.min(
                              number,
                              uploadedImages.length
                            )
                          : number
                      )
                    }
                  >
                    {number}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="generate"
              onClick={generate}
            >
              Generate AI Product Page{" "}
              <span>→</span>
            </button>
          </div>
        </section>
      ) : (
        <section
          id="preview"
          className="preview"
        >
          <button
            type="button"
            className="edit"
            onClick={() => {
              setGenerated(false);
              setResult(null);

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
          >
            ← Edit Product
          </button>

          <div className="preview-brand">
            THE VIRELLO EDIT
          </div>

          <div className="product-grid">
            <div className="gallery">
              {imageCount > 0 ? (
                <>
                  <div className="main-image">
                    {uploadedImages[0] ? (
                      <img
                        src={uploadedImages[0]}
                        alt={
                          activeResult?.title ||
                          "Product"
                        }
                      />
                    ) : (
                      <span>
                        Upload a product image
                      </span>
                    )}
                  </div>

                  {Array.from({
                    length: Math.max(
                      0,
                      imageCount - 1
                    ),
                  }).map((_, index) => {
                    const image =
                      uploadedImages[index + 1];

                    return (
                      <div
                        className="small-image"
                        key={index}
                      >
                        {image ? (
                          <img
                            src={image}
                            alt={`Product view ${
                              index + 2
                            }`}
                          />
                        ) : (
                          <span>
                            Additional Product
                            View
                          </span>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="main-image empty">
                  No Product Images Selected
                </div>
              )}
            </div>

            <div className="product-copy">
              <div className="kicker">
                PREMIUM COLLECTION
              </div>

              <h2>
                {activeResult?.title}
              </h2>

              <div className="product-price">
                ${price || "0.00"}
              </div>

              <p className="description">
                {activeResult?.description}
              </p>

              <div className="benefits">
                {activeResult?.bullets.map(
                  (bullet) => (
                    <div key={bullet}>
                      ✓ {bullet}
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                className="cart"
              >
                ADD TO CART
              </button>

              <div className="trust">
                <span>
                  Secure Checkout
                </span>

                <span>
                  Easy Returns
                </span>

                <span>
                  Customer Support
                </span>
              </div>
            </div>
          </div>

          <section className="section">
            <div className="kicker">
              WHY IT STANDS OUT
            </div>

            <h3>
              Give shoppers the reasons they
              need to keep reading.
            </h3>

            <div className="cards">
              {[
                [
                  "01",
                  "Refined Design",
                  "A polished presentation designed to complement different outfits and occasions.",
                ],
                [
                  "02",
                  "Versatile Styling",
                  "Easy to position for business, casual and special-occasion looks.",
                ],
                [
                  "03",
                  "Everyday Appeal",
                  "A clean, wearable aesthetic that fits naturally into personal style.",
                ],
                [
                  "04",
                  "Gift Ready",
                  "A refined option for personal wear or a thoughtful gift.",
                ],
              ].map(
                ([number, title, text]) => (
                  <article
                    className="card"
                    key={number}
                  >
                    <small>{number}</small>

                    <h4>{title}</h4>

                    <p>{text}</p>
                  </article>
                )
              )}
            </div>
          </section>

          <section className="section">
            <div className="kicker">
              PRODUCT INFORMATION
            </div>

            <h3>
              Clear details. No unnecessary
              noise.
            </h3>

            <div className="specs">
              {activeResult?.specs.map(
                (spec) => {
                  const [
                    key,
                    ...rest
                  ] = spec.split(":");

                  return (
                    <div
                      className="spec"
                      key={spec}
                    >
                      <span>{key}</span>

                      <strong>
                        {rest
                          .join(":")
                          .trim()}
                      </strong>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          <section className="section callout">
            <div className="kicker">
              THE VIRELLO EXPERIENCE
            </div>

            <h3>
              Make the product easier to
              understand. Easier to want.
            </h3>

            <p>
              Strong product pages make the
              value clear, remove unnecessary
              friction and give shoppers a
              simple next step.
            </p>

            <button
              type="button"
              className="cart"
            >
              ADD TO CART
            </button>
          </section>

          <section className="section faq">
            <div className="kicker">
              FREQUENTLY ASKED QUESTIONS
            </div>

            <h3>
              Questions, answered.
            </h3>

            <details>
              <summary>
                Is this suitable for everyday
                wear?
              </summary>

              <p>
                Yes. The versatile styling is
                designed to work naturally with
                everyday outfits.
              </p>
            </details>

            <details>
              <summary>
                Can it be worn with formal
                clothing?
              </summary>

              <p>
                Yes. The refined presentation
                pairs naturally with business
                and dressier clothing.
              </p>
            </details>

            <details>
              <summary>
                Is it suitable as a gift?
              </summary>

              <p>
                Yes. The polished, versatile
                design makes it a thoughtful
                gifting option.
              </p>
            </details>

            <details>
              <summary>
                Is it suitable for different
                occasions?
              </summary>

              <p>
                Yes. The clean styling
                transitions easily between
                everyday, business and special
                occasions.
              </p>
            </details>
          </section>

          <section className="section">
            <div className="kicker">
              SEO INFORMATION
            </div>

            <div className="seo">
              <div>
                <strong>
                  SEO Title
                </strong>

                <p>
                  {activeResult?.seoTitle}
                </p>

                <small>
                  {activeResult?.seoTitle
                    .length}
                  /60
                </small>
              </div>

              <div>
                <strong>
                  Meta Description
                </strong>

                <p>
                  {
                    activeResult?.metaDescription
                  }
                </p>

                <small>
                  {
                    activeResult
                      ?.metaDescription
                      .length
                  }
                  /160
                </small>
              </div>
            </div>
          </section>
        </section>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #f7f7f5;
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

        button {
          cursor: pointer;
        }

        .page {
          min-height: 100vh;
          overflow-x: hidden;
        }

        .header {
          padding: 28px 5vw 18px;
        }

        .brand {
          font-size: 20px;
          font-weight: 750;
          letter-spacing: 0.08em;
        }

        .subtitle {
          margin-top: 4px;
          font-size: 13px;
          letter-spacing: 0.06em;
        }

        .editor,
        .preview {
          width: min(1180px, 90vw);
          margin: auto;
        }

        .editor {
          padding: 70px 0 110px;
        }

        .eyebrow,
        .kicker {
          color: #666;
          font-size: 14px;
          letter-spacing: 0.06em;
        }

        h1 {
          max-width: 980px;
          margin: 26px 0 30px;
          font-size: clamp(
            48px,
            7vw,
            88px
          );
          line-height: 0.96;
          letter-spacing: -0.055em;
        }

        .intro {
          max-width: 720px;
          font-size: 20px;
          line-height: 1.5;
          color: #4d4d4d;
          margin-bottom: 52px;
        }

        .panel {
          background: #fff;
          border: 1px solid #e3e3df;
          border-radius: 24px;
          padding: clamp(
            22px,
            4vw,
            42px
          );
          box-shadow:
            0 12px 40px
            rgba(0, 0, 0, 0.04);
        }

        .panel h2 {
          margin: 0 0 28px;
          font-size: 22px;
        }

        label {
          display: block;
          font-size: 15px;
          font-weight: 650;
          margin: 22px 0 9px;
        }

        textarea,
        .price {
          width: 100%;
          border: 1px solid #d8d8d4;
          border-radius: 12px;
          background: #fafaf9;
        }

        textarea {
          min-height: 115px;
          padding: 15px;
          resize: vertical;
          outline: none;
        }

        textarea:focus,
        .price:focus-within {
          border-color: #171717;
          background: #fff;
        }

        .two-col {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 30px;
        }

        .price {
          display: flex;
          align-items: center;
          padding: 0 14px;
        }

        .price span {
          font-weight: 650;
          color: #555;
        }

        .price input {
          width: 100%;
          padding: 15px 8px;
          border: 0;
          outline: 0;
          background: transparent;
        }

        .choices,
        .number-row {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .choice,
        .number {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid #d7d7d3;
          border-radius: 999px;
          background: #fff;
        }

        .number {
          width: 42px;
          padding: 0;
        }

        .choice.active,
        .number.active {
          background: #171717;
          color: #fff;
          border-color: #171717;
        }

        .upload {
          border: 1px dashed #c9c9c4;
          border-radius: 16px;
          background: #fafaf8;
          padding: 22px;
          text-align: center;
        }

        .upload input {
          display: none;
        }

        .upload-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          margin: 0;
          padding: 0 20px;
          border-radius: 10px;
          background: #171717;
          color: #fff;
          cursor: pointer;
        }

        .upload p {
          margin: 10px 0 0;
          color: #777;
          font-size: 13px;
        }

        .uploaded {
          margin-top: 22px;
        }

        .uploaded-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .clear {
          border: 0;
          background: transparent;
          text-decoration: underline;
          color: #666;
        }

        .thumbs {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 12px;
        }

        .thumb {
          position: relative;
          overflow: hidden;
          border: 1px solid #ddd;
          border-radius: 14px;
          background: #fff;
        }

        .thumb img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }

        .thumb button {
          position: absolute;
          top: 7px;
          right: 7px;
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 50%;
          background: rgba(
            0,
            0,
            0,
            0.75
          );
          color: #fff;
          font-size: 20px;
        }

        .thumb small {
          display: block;
          padding: 8px 10px;
          color: #666;
        }

        .generate,
        .cart {
          width: 100%;
          min-height: 56px;
          margin-top: 32px;
          border: 0;
          border-radius: 10px;
          background: #171717;
          color: #fff;
          font-weight: 700;
        }

        .generate span {
          margin-left: 7px;
        }

        .preview {
          padding: 20px 0 100px;
        }

        .edit {
          border: 1px solid #d5d5d1;
          background: #fff;
          border-radius: 10px;
          min-height: 42px;
          padding: 0 15px;
        }

        .preview-brand {
          margin: 36px 0 24px;
          font-size: 14px;
          font-weight: 750;
          letter-spacing: 0.1em;
        }

        .product-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 0.9fr)
            minmax(0, 1.1fr);
          gap: clamp(
            35px,
            6vw,
            80px
          );
        }

        .gallery {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .main-image,
        .small-image {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          overflow: hidden;
          background: #ededed;
          color: #777;
          border-radius: 18px;
          min-height: 180px;
        }

        .main-image {
          grid-column: 1 / -1;
          aspect-ratio: 1;
        }

        .small-image {
          aspect-ratio: 1;
        }

        .main-image img,
        .small-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .product-copy h2 {
          max-width: 680px;
          margin: 20px 0 0;
          font-size: clamp(
            40px,
            5vw,
            68px
          );
          line-height: 1.02;
          letter-spacing: -0.045em;
        }

        .product-price {
          margin-top: 24px;
          font-size: 24px;
          font-weight: 650;
        }

        .description {
          max-width: 650px;
          font-size: 18px;
          line-height: 1.6;
          color: #3f3f3f;
          margin-top: 28px;
        }

        .benefits {
          display: grid;
          gap: 10px;
          line-height: 1.45;
        }

        .trust {
          display: flex;
          flex-wrap: wrap;
          gap: 15px 22px;
          margin-top: 15px;
          color: #666;
          font-size: 14px;
        }

        .section {
          margin-top: 100px;
          border-top: 1px solid #d5d5d1;
          padding-top: 44px;
        }

        .section h3 {
          max-width: 900px;
          margin: 20px 0 32px;
          font-size: clamp(
            38px,
            5vw,
            64px
          );
          line-height: 1;
          letter-spacing: -0.045em;
        }

        .cards {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 16px;
        }

        .card {
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 20px;
          padding: 28px;
        }

        .card small {
          color: #888;
        }

        .card h4 {
          font-size: 23px;
          margin: 22px 0 10px;
        }

        .card p,
        .callout p {
          color: #555;
          line-height: 1.6;
          margin: 0;
        }

        .specs {
          border-top: 1px solid #ccc;
        }

        .spec {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 19px 0;
          border-bottom: 1px solid #ccc;
        }

        .spec span {
          color: #666;
        }

        .spec strong {
          text-align: right;
        }

        .callout p {
          max-width: 720px;
          font-size: 18px;
        }

        .faq details {
          border-top: 1px solid #ccc;
          padding: 20px 0;
        }

        .faq details:last-child {
          border-bottom: 1px solid #ccc;
        }

        summary {
          cursor: pointer;
          font-weight: 650;
        }

        details p {
          max-width: 700px;
          color: #555;
          line-height: 1.6;
        }

        .seo {
          display: grid;
          gap: 18px;
        }

        .seo > div {
          background: #fff;
          border: 1px solid #e2e2de;
          border-radius: 18px;
          padding: 24px;
        }

        .seo p {
          font-size: 17px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .seo small {
          color: #26734d;
        }

        @media (max-width: 800px) {
          .two-col,
          .product-grid {
            grid-template-columns: 1fr;
          }

          .product-copy {
            order: 2;
          }

          .cards {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .editor,
          .preview {
            width: 92vw;
          }

          .editor {
            padding-top: 35px;
          }

          h1 {
            font-size: 48px;
          }

          .panel {
            padding: 20px;
            border-radius: 18px;
          }

          .thumbs {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .section {
            margin-top: 70px;
            padding-top: 34px;
          }

          .section h3 {
            font-size: 40px;
          }

          .spec {
            flex-direction: column;
            gap: 7px;
          }

          .spec strong {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
