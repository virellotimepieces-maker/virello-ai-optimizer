"use client";

import { useState } from "react";

type ProductData = {
  title: string;
  price: string;
  audience: string;
  style: string;
  imageCount: number;
};

type ProductResult = {
  productTitle: string;
  seoTitle: string;
  description: string;
  metaDescription: string;
  highlights: string[];
  faqs: { q: string; a: string }[];
};

const STOP_WORDS = new Set([
  "2026",
  "2025",
  "new",
  "design",
  "top",
  "best",
  "original",
  "fashion",
  "luxury",
  "men",
  "mens",
  "men's",
  "women",
  "womens",
  "women's",
  "unisex",
  "watch",
  "watches",
  "clock",
  "for",
  "the",
  "and",
  "with",
  "stainless",
  "steel",
  "waterproof",
  "sport",
  "quartz",
  "chronograph",
]);

function cleanText(value: string) {
  return value
    .replace(/[|,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildShortProductTitle(
  sourceTitle: string,
  audience: string
) {
  const source = cleanText(sourceTitle);
  const lower = source.toLowerCase();
  const parts: string[] = [];

  if (/\bpagani\b/i.test(source)) {
    parts.push("Pagani");
  }

  const model = source.match(
    /\bV\d+(?:\s+[A-Za-z]+)?\b/i
  );

  if (model) {
    parts.push(titleCase(model[0]));
  }

  if (/\bmoon\b/i.test(source)) {
    parts.push("Moon");
  }

  for (const feature of [
    "Chronograph",
    "Automatic",
    "Mechanical",
    "Solar",
    "GMT",
  ]) {
    if (lower.includes(feature.toLowerCase())) {
      parts.push(feature);
      break;
    }
  }

  const audienceLabel =
    audience === "Women"
      ? "Women's"
      : audience === "Unisex"
      ? "Unisex"
      : "Men's";

  if (
    !parts.some((part) =>
      /men's|women's|unisex/i.test(part)
    )
  ) {
    parts.push(audienceLabel);
  }

  if (!parts.some((part) => /watch/i.test(part))) {
    parts.push("Watch");
  }

  if (parts.length >= 3) {
    return Array.from(new Set(parts))
      .slice(0, 6)
      .join(" ");
  }

  const fallback = source
    .split(" ")
    .map((word) =>
      word.replace(/[^a-zA-Z0-9'’/-]/g, "")
    )
    .filter(Boolean)
    .filter(
      (word) =>
        !STOP_WORDS.has(word.toLowerCase())
    )
    .slice(0, 4)
    .map(titleCase);

  return Array.from(
    new Set([
      ...fallback,
      audienceLabel,
      "Watch",
    ])
  )
    .slice(0, 6)
    .join(" ");
}

function makeSeoTitle(
  productTitle: string,
  audience: string
) {
  const gender =
    audience === "Women"
      ? "for Women"
      : audience === "Unisex"
      ? "for Everyone"
      : "for Men";

  const base = productTitle
    .replace(
      /\bMen's\b|\bWomen's\b|\bUnisex\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  const candidates = [
    `${base} ${gender} | Virello`,
    `${base} ${gender}`,
    `Shop ${base} ${gender}`,
  ];

  return (
    candidates.find(
      (text) => text.length <= 60
    ) ??
    candidates[1]
      .slice(0, 60)
      .trim()
  );
}

function makeMetaDescription(
  productTitle: string,
  audience: string,
  style: string
) {
  const stylePhrase =
    style === "Premium / Luxury"
      ? "a refined, premium look"
      : style === "Professional"
      ? "a polished professional look"
      : style === "Sport"
      ? "a versatile sport-ready look"
      : style === "Gift"
      ? "a thoughtful gift option"
      : "an easy everyday style";

  const audiencePhrase =
    audience === "Women"
      ? "women"
      : audience === "Unisex"
      ? "any wearer"
      : "men";

  const text =
    `Shop the ${productTitle.toLowerCase()} for ${audiencePhrase}, ` +
    `featuring ${stylePhrase}. ` +
    `A versatile timepiece for business, everyday wear ` +
    `and special occasions. Discover the collection today.`;

  if (text.length <= 160) {
    return text;
  }

  return `${text
    .slice(0, 157)
    .replace(/\s+\S*$/, "")}...`;
}

function buildProduct(
  data: ProductData
): ProductResult {
  const productTitle =
    buildShortProductTitle(
      data.title,
      data.audience
    );

  const seoTitle =
    makeSeoTitle(
      productTitle,
      data.audience
    );

  const metaDescription =
    makeMetaDescription(
      productTitle,
      data.audience,
      data.style
    );

  const audienceText =
    data.audience === "Women"
      ? "women who appreciate understated style"
      : data.audience === "Unisex"
      ? "anyone who values a polished accessory"
      : "men who appreciate a refined timepiece";

  const description =
    `Designed for ${audienceText}, this timepiece ` +
    `brings a polished finish to your wardrobe ` +
    `without feeling overdone. The balanced dial ` +
    `and versatile profile make it easy to pair with ` +
    `tailored business looks, smart-casual outfits ` +
    `and evening wear.\n\n` +
    `Wear it as a dependable everyday accessory ` +
    `or choose it for a special occasion when you ` +
    `want a clean, sophisticated finishing touch.`;

  return {
    productTitle,
    seoTitle,
    description,
    metaDescription,

    highlights: [
      "Refined styling for a polished appearance",
      "Versatile design for business and casual outfits",
      "Comfort-focused profile for everyday wear",
      "A sophisticated option for personal wear or gifting",
    ],

    faqs: [
      {
        q: "Is this watch suitable for everyday wear?",
        a:
          "Yes. The versatile profile works well " +
          "with everyday outfits as well as more " +
          "polished occasions.",
      },
      {
        q: "Can it be worn with formal clothing?",
        a:
          "Yes. Its refined styling pairs naturally " +
          "with business attire, dress shirts and " +
          "formal looks.",
      },
      {
        q: "Is it suitable as a gift?",
        a:
          "Yes. The clean, versatile styling makes " +
          "it a thoughtful choice for birthdays, " +
          "anniversaries and other occasions.",
      },
    ],
  };
}

export default function Home() {
  const [mode, setMode] =
    useState<"edit" | "preview">("edit");

  const [title, setTitle] =
    useState("");

  const [price, setPrice] =
    useState("129.99");

  const [audience, setAudience] =
    useState("Men");

  const [style, setStyle] =
    useState("Premium / Luxury");

  const [imageCount, setImageCount] =
    useState(4);

  const [product, setProduct] =
    useState<ProductResult | null>(null);

  function generateProduct() {
    if (!title.trim()) {
      alert(
        "Please enter a product title."
      );
      return;
    }

    setProduct(
      buildProduct({
        title,
        price,
        audience,
        style,
        imageCount,
      })
    );

    setMode("preview");
  }

  return (
    <main className="app">

      <header className="siteHeader">
        <div className="container headerInner">
          <div className="brand">
            VIRELLO
          </div>

          <div className="brandSub">
            AI PRODUCT OPTIMIZER
          </div>
        </div>
      </header>

      {mode === "edit" && (
        <section className="container editorPage">

          <div className="heroCopy">
            <div className="eyebrow">
              Virello AI
            </div>

            <h1>
              Create a better product page.
            </h1>

            <p>
              Enter your product information
              and generate a complete,
              product-specific ecommerce page.
            </p>
          </div>

          <div className="editorCard">

            <h2>
              Product Information
            </h2>

            <label className="label">
              Product Title
            </label>

            <input
              className="input"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Paste your original product title"
            />

            <label className="label">
              Product Price
            </label>

            <div className="priceWrap">

              <span>$</span>

              <input
                className="input priceInput"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value)
                }
                inputMode="decimal"
              />

            </div>

            <label className="label">
              Target Audience
            </label>

            <div className="choiceGroup">

              {[
                "Women",
                "Men",
                "Unisex",
              ].map((item) => (

                <button
                  key={item}
                  onClick={() =>
                    setAudience(item)
                  }
                  className={
                    `choice${
                      audience === item
                        ? " active"
                        : ""
                    }`
                  }
                >
                  {item}
                </button>

              ))}

            </div>

            <label className="label">
              Copywriting
            </label>

            <div className="choiceGroup">

              {[
                "Premium / Luxury",
                "Professional",
                "Everyday",
                "Casual",
                "Sport",
                "Gift",
              ].map((item) => (

                <button
                  key={item}
                  onClick={() =>
                    setStyle(item)
                  }
                  className={
                    `choice${
                      style === item
                        ? " active"
                        : ""
                    }`
                  }
                >
                  {item}
                </button>

              ))}

            </div>

            <label className="label">
              Visuals
            </label>

            <div className="muted">
              Number of Product Images
            </div>

            <div className="choiceGroup">

              {[0, 1, 2, 3, 4, 5, 6].map(
                (number) => (

                  <button
                    key={number}
                    onClick={() =>
                      setImageCount(number)
                    }
                    className={
                      `choice${
                        imageCount === number
                          ? " active"
                          : ""
                      }`
                    }
                  >
                    {number}
                  </button>

                )
              )}

            </div>

            <button
              className="primaryButton"
              onClick={generateProduct}
            >
              Generate AI Product Page →
            </button>

          </div>
        </section>
      )}

      {mode === "preview" &&
        product && (

        <section className="container previewPage">

          <button
            className="backButton"
            onClick={() =>
              setMode("edit")
            }
          >
            ← Edit Product
          </button>

          <div className="previewHeader">
            VIRELLO
          </div>

          <div className="productGrid">

            <div className="visualColumn">

              {imageCount > 0 ? (
                <div className="mainImage">
                  Product Image
                </div>
              ) : (
                <div className="mainImage noImage">
                  No product images selected
                </div>
              )}

              {Array.from({
                length:
                  Math.max(
                    0,
                    imageCount - 1
                  ),
              }).map(
                (_, index) => (

                  <div
                    className="additionalImage"
                    key={index}
                  >
                    Additional Product View
                  </div>

                )
              )}

            </div>

            <div className="productInfo">

              <div className="collectionLabel">
                Premium Collection
              </div>

              <h1 className="productTitle">
                {product.productTitle}
              </h1>

              <div className="price">
                ${price}
              </div>

              <p className="description">
                {product.description}
              </p>

              <div className="highlights">

                {product.highlights.map(
                  (item) => (

                    <div key={item}>
                      ✓ {item}
                    </div>

                  )
                )}

              </div>

              <button className="addButton">
                ADD TO CART
              </button>

              <div className="trustRow">

                <span>
                  Secure Checkout
                </span>

                <span>
                  Easy Returns
                </span>

                <span>
                  Support
                </span>

              </div>

            </div>
          </div>

          <section className="contentSection">

            <h2>
              Why it stands out
            </h2>

            <p>
              A versatile timepiece designed
              to complement your wardrobe
              with a polished and confident finish.
            </p>

          </section>

          <section className="contentSection">

            <h2>
              Frequently Asked Questions
            </h2>

            {product.faqs.map(
              (faq) => (

                <details
                  key={faq.q}
                  className="faqItem"
                >

                  <summary>
                    {faq.q}
                  </summary>

                  <p>
                    {faq.a}
                  </p>

                </details>

              )
            )}

          </section>

          <section className="seoSection">

            <h2>
              SEO Information
            </h2>

            <div className="seoBlock">

              <h3>
                SEO Title
              </h3>

              <div className="seoBox">
                {product.seoTitle}
              </div>

              <div
                className={
                  `counter${
                    product.seoTitle.length > 60
                      ? " over"
                      : ""
                  }`
                }
              >
                {product.seoTitle.length}/60
              </div>

              <div className="helper">
                Short search-focused title.
                Kept separate from the
                product description.
              </div>

            </div>

            <div className="seoBlock">

              <h3>
                Meta Description
              </h3>

              <div className="seoBox">
                {product.metaDescription}
              </div>

              <div
                className={
                  `counter${
                    product.metaDescription.length > 160
                      ? " over"
                      : ""
                  }`
                }
              >
                {product.metaDescription.length}/160
              </div>

              <div className="helper">
                Unique search snippet with
                different wording and clear
                shopping intent.
              </div>

            </div>

          </section>

          <section className="finalCta">

            <div className="eyebrow">
              VIRELLO PRODUCT EXPERIENCE
            </div>

            <h2>
              Make the product easier
              to understand. Easier to want.
            </h2>

            <button className="addButton">
              ADD TO CART
            </button>

          </section>

        </section>
      )}

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          background: #ffffff;
          color: #18181b;
        }

        button,
        input {
          font: inherit;
        }

        .app {
          min-height: 100vh;
          background: #fff;
          color: #18181b;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .container {
          width: min(
            1100px,
            calc(100% - 48px)
          );
          margin: 0 auto;
        }

        .siteHeader {
          border-bottom:
            1px solid #e5e7eb;
        }

        .headerInner {
          padding: 22px 0;
        }

        .brand {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .16em;
        }

        .brandSub {
          margin-top: 4px;
          font-size: 12px;
          color: #71717a;
          letter-spacing: .08em;
        }

        .editorPage {
          padding: 70px 0;
          max-width: 900px;
        }

        .heroCopy {
          margin-bottom: 45px;
        }

        .eyebrow {
          font-size: 14px;
          font-weight: 700;
          color: #71717a;
        }

        .heroCopy h1 {
          margin: 18px 0 0;
          max-width: 760px;
          font-size:
            clamp(42px, 7vw, 76px);
          line-height: .98;
          letter-spacing: -.055em;
        }

        .heroCopy p {
          max-width: 650px;
          margin: 28px 0 0;
          color: #52525b;
          font-size: 18px;
          line-height: 1.6;
        }

        .editorCard {
          padding: 28px;
          border:
            1px solid #e4e4e7;
          border-radius: 20px;
          background: #fafafa;
        }

        .editorCard h2 {
          margin: 0;
          font-size: 22px;
        }

        .label {
          display: block;
          margin: 24px 0 9px;
          font-size: 14px;
          font-weight: 700;
        }

        .input {
          width: 100%;
          min-width: 0;
          padding: 14px 15px;
          border:
            1px solid #d4d4d8;
          border-radius: 10px;
          background: #fff;
          color: #18181b;
          font-size: 16px;
        }

        .input:focus {
          outline:
            2px solid #18181b;
          outline-offset: 1px;
        }

        .priceWrap {
          position: relative;
        }

        .priceWrap > span {
          position: absolute;
          left: 15px;
          top: 14px;
          color: #71717a;
        }

        .priceInput {
          padding-left: 30px;
        }

        .choiceGroup {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .choice {
          padding: 10px 15px;
          border-radius: 9px;
          border:
            1px solid #d4d4d8;
          background: #fff;
          color: #18181b;
          cursor: pointer;
          font-size: 14px;
        }

        .choice.active {
          border-color: #18181b;
          background: #18181b;
          color: #fff;
          font-weight: 700;
        }

        .muted {
          margin-bottom: 10px;
          color: #71717a;
          font-size: 14px;
        }

        .primaryButton,
        .addButton {
          border: 0;
          border-radius: 10px;
          background: #18181b;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .primaryButton {
          width: 100%;
          margin-top: 32px;
          padding: 17px 22px;
          font-size: 16px;
        }

        .previewPage {
          padding: 24px 0 80px;
        }

        .backButton {
          margin-bottom: 35px;
          padding: 10px 16px;
          border:
            1px solid #d4d4d8;
          border-radius: 10px;
          background: #fff;
          color: #18181b;
          cursor: pointer;
        }

        .previewHeader {
          padding-top: 30px;
          border-top:
            1px solid #e4e4e7;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .14em;
        }

        .productGrid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
          gap:
            clamp(32px, 5vw, 55px);
          margin-top: 35px;
          align-items: start;
        }

        .visualColumn,
        .productInfo {
          min-width: 0;
        }

        .mainImage,
        .additionalImage {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 18px;
          background:
            linear-gradient(
              135deg,
              #f4f4f5,
              #e4e4e7
            );
          color: #71717a;
          text-align: center;
        }

        .mainImage {
          aspect-ratio: 1 / 1;
        }

        .mainImage.noImage {
          background: #fafafa;
          border:
            1px dashed #d4d4d8;
        }

        .additionalImage {
          aspect-ratio: 1 / 1;
          margin-top: 12px;
          border-radius: 14px;
          background: #f4f4f5;
          font-size: 13px;
        }

        .collectionLabel {
          margin-bottom: 18px;
          color: #71717a;
          font-size: 14px;
        }

        .productTitle {
          margin: 0 0 25px;
          max-width: 680px;
          font-size:
            clamp(36px, 5vw, 62px);
          line-height: 1.02;
          letter-spacing: -.045em;
          overflow-wrap: anywhere;
        }

        .price {
          margin-bottom: 28px;
          font-size: 25px;
          font-weight: 600;
        }

        .description {
          margin: 0;
          color: #52525b;
          font-size: 18px;
          line-height: 1.7;
          white-space: pre-line;
        }

        .highlights {
          margin-top: 30px;
        }

        .highlights div {
          margin-bottom: 12px;
          font-size: 16px;
        }

        .addButton {
          margin-top: 25px;
          padding: 16px 28px;
          font-size: 16px;
        }

        .trustRow {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 12px;
          margin-top: 25px;
          padding-top: 20px;
          border-top:
            1px solid #e4e4e7;
          color: #52525b;
          font-size: 13px;
        }

        .contentSection,
        .seoSection {
          margin-top: 65px;
          padding-top: 45px;
          border-top:
            1px solid #e4e4e7;
        }

        .contentSection h2,
        .seoSection h2 {
          margin: 0 0 15px;
          font-size:
            clamp(30px, 4vw, 36px);
          letter-spacing: -.03em;
        }

        .contentSection > p {
          max-width: 720px;
          margin: 0;
          color: #52525b;
          font-size: 17px;
          line-height: 1.7;
        }

        .faqItem {
          padding: 20px 0;
          border-bottom:
            1px solid #e4e4e7;
        }

        .faqItem summary {
          cursor: pointer;
          font-size: 17px;
          font-weight: 600;
        }

        .faqItem p {
          margin: 12px 0 0;
          color: #52525b;
          line-height: 1.6;
        }

        .seoBlock {
          margin-top: 30px;
        }

        .seoBlock h3 {
          margin: 0 0 8px;
          font-size: 20px;
        }

        .seoBox {
          padding: 18px;
          border-radius: 10px;
          background: #f4f4f5;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .counter {
          margin-top: 7px;
          color: #71717a;
          font-size: 13px;
        }

        .counter.over {
          color: #b91c1c;
          font-weight: 700;
        }

        .helper {
          margin-top: 6px;
          color: #71717a;
          font-size: 12px;
          line-height: 1.5;
        }

        .finalCta {
          margin-top: 30px;
          padding: 50px 0 0;
          border-top:
            1px solid #e4e4e7;
          text-align: center;
        }

        .finalCta h2 {
          max-width: 700px;
          margin: 20px auto;
          font-size:
            clamp(34px, 5vw, 56px);
          line-height: 1.02;
          letter-spacing: -.04em;
        }

        @media (max-width: 760px) {

          .container {
            width:
              min(
                100% - 28px,
                1100px
              );
          }

          .headerInner {
            padding: 18px 0;
          }

          .editorPage {
            padding: 42px 0;
          }

          .heroCopy {
            margin-bottom: 30px;
          }

          .heroCopy h1 {
            font-size:
              clamp(
                42px,
                13vw,
                58px
              );
          }

          .heroCopy p {
            font-size: 16px;
          }

          .editorCard {
            padding: 20px;
            border-radius: 16px;
          }

          .productGrid {
            grid-template-columns: 1fr;
            gap: 34px;
          }

          .productTitle {
            font-size:
              clamp(
                38px,
                12vw,
                54px
              );
          }

          .description {
            font-size: 17px;
          }

          .trustRow {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .trustRow span {
            padding: 5px 0;
          }

          .seoBox {
            font-size: 15px;
          }

          .finalCta h2 {
            font-size: 40px;
          }
        }

        @media (max-width: 420px) {

          .container {
            width:
              calc(100% - 22px);
          }

          .editorCard {
            padding: 16px;
          }

          .choice {
            padding: 9px 12px;
          }

          .primaryButton,
          .addButton {
            width: 100%;
          }

          .productTitle {
            font-size: 40px;
          }
        }

      `}</style>

    </main>
  );
}
