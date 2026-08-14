"use client";

import { useState } from "react";

type ProductInfo = {
  description: string;
  features: string[];
  productType: string;
  collection: string;
};

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
  collection: string;
};

function cleanText(text: string) {
  return text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\b(2026|2025|2024)\b/gi, "")
    .replace(
      /\b(top luxury|best quality|hot sale|new arrival|free shipping|wholesale|official)\b/gi,
      ""
    )
    .replace(/\b(dear customer|welcome to our store)\b/gi, "")
    .replace(/\b(no reason to return)\b/gi, "")
    .replace(/\b(guaranteed for \d+ years?)\b/gi, "")
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

function detectProductType(title: string) {
  const text = title.toLowerCase();

  if (
    /\b(watch|watches|wristwatch|chronograph|timepiece|quartz|automatic|mechanical)\b/i.test(
      text
    )
  ) {
    return "Watches";
  }

  if (
    /\b(shirt|dress|jacket|pants|jeans|hoodie|blouse|skirt|romper|shorts|top|sweater|cardigan|tshirt|t-shirt)\b/i.test(
      text
    )
  ) {
    return "Apparel";
  }

  if (
    /\b(shoe|shoes|sneaker|sneakers|sandals|boots|loafer|loafers|slippers)\b/i.test(
      text
    )
  ) {
    return "Footwear";
  }

  if (
    /\b(faucet|shower|bathroom|mirror|bathtub|sink|tap|vanity|toilet)\b/i.test(
      text
    )
  ) {
    return "Bathroom";
  }

  if (
    /\b(organizer|storage|drawer|closet|shelf|rack|container|storage box|packing cube)\b/i.test(
      text
    )
  ) {
    return "Home Organization";
  }

  if (
    /\b(phone|charger|usb|electronic|keyboard|fan|speaker|headphone|wireless|earbuds|laser projection|solar panel)\b/i.test(
      text
    )
  ) {
    return "Electronics";
  }

  if (
    /\b(kitchen|peeler|sealer|bottle|thermos|utensil|cookware|grinder|food vacuum)\b/i.test(
      text
    )
  ) {
    return "Kitchen";
  }

  if (
    /\b(car|vehicle|automotive|dashboard|trunk|seat|auto|car accessory|ashtray)\b/i.test(
      text
    )
  ) {
    return "Automotive";
  }

  if (
    /\b(ring|necklace|bracelet|earring|jewelry|jewellery)\b/i.test(text)
  ) {
    return "Jewelry";
  }

  if (
    /\b(baby|infant|toddler|kids|children|nail clipper)\b/i.test(text)
  ) {
    return "Baby & Kids";
  }

  return "Lifestyle";
}

function detectCollection(productType: string) {
  switch (productType) {
    case "Watches":
      return "Watches";
    case "Apparel":
      return "Apparel";
    case "Footwear":
      return "Footwear";
    case "Bathroom":
      return "Bathroom";
    case "Home Organization":
      return "Home Organization";
    case "Electronics":
      return "Electronics";
    case "Kitchen":
      return "Kitchen";
    case "Automotive":
      return "Automotive";
    case "Jewelry":
      return "Jewelry";
    case "Baby & Kids":
      return "Baby & Kids";
    default:
      return "Lifestyle";
  }
}

function removeSupplierWords(text: string) {
  return text
    .replace(/\b(2026|2025|2024)\b/gi, "")
    .replace(
      /\b(new|latest|top|best|hot sale|free shipping|wholesale|official)\b/gi,
      ""
    )
    .replace(/\bfor men\b/gi, "Men's")
    .replace(/\bfor women\b/gi, "Women's")
    .replace(/\bwatches\b/gi, "Watch")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractGender(source: string) {
  if (/\bmen'?s\b|\bmen\b|\bmale\b/i.test(source)) {
    return "Men's";
  }

  if (
    /\bwomen'?s\b|\bwomen\b|\bladies\b|\bfemale\b/i.test(source)
  ) {
    return "Women's";
  }

  return "";
}

function extractWatchMovement(source: string) {
  if (/\bchronograph\b/i.test(source)) return "Chronograph";
  if (/\bautomatic\b/i.test(source)) return "Automatic";
  if (/\bmechanical\b/i.test(source)) return "Mechanical";
  if (/\bquartz\b/i.test(source)) return "Quartz";

  return "";
}

function buildWatchTitle(originalTitle: string) {
  const source = removeSupplierWords(cleanText(originalTitle));

  const gender = extractGender(source);
  const movement = extractWatchMovement(source);

  const modelMatch = source.match(
    /\b(PAGANI DESIGN|PAGANI|PD-\d+|V\d+(?:\s?[A-Z]?\d*)?|Moon)\b/gi
  );

  const model =
    modelMatch && modelMatch.length
      ? Array.from(new Set(modelMatch.map((item) => item.trim()))).join(" ")
      : "";

  let details = source
    .replace(/\bPAGANI DESIGN\b/gi, "")
    .replace(/\bPAGANI\b/gi, "")
    .replace(/\bmen'?s\b/gi, "")
    .replace(/\bwomen'?s\b/gi, "")
    .replace(/\bmen\b/gi, "")
    .replace(/\bwomen\b/gi, "")
    .replace(/\bmale\b/gi, "")
    .replace(/\bfemale\b/gi, "")
    .replace(/\bwatch\b/gi, "")
    .replace(/\bwristwatch\b/gi, "")
    .replace(/\bquartz\b/gi, "")
    .replace(/\bautomatic\b/gi, "")
    .replace(/\bmechanical\b/gi, "")
    .replace(/\bchronograph\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const parts = [
    model,
    details,
    gender,
    movement,
    "Watch",
  ].filter(Boolean);

  let result = parts.join(" ");

  result = result
    .replace(/\bWatch Watch\b/gi, "Watch")
    .replace(/\bMoon Moon\b/gi, "Moon")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!result) {
    result = "Classic Watch";
  }

  return limit(result, 65);
}

function buildApparelTitle(originalTitle: string) {
  const source = removeSupplierWords(cleanText(originalTitle));
  const gender = extractGender(source);

  let item = "Apparel";

  if (/\bdress\b/i.test(source)) item = "Dress";
  else if (/\bblouse\b/i.test(source)) item = "Blouse";
  else if (/\bshirt\b|\bt-shirt\b|\btshirt\b/i.test(source)) item = "Shirt";
  else if (/\bjacket\b/i.test(source)) item = "Jacket";
  else if (/\bjeans\b/i.test(source)) item = "Jeans";
  else if (/\bpants\b/i.test(source)) item = "Pants";
  else if (/\bskirt\b/i.test(source)) item = "Skirt";
  else if (/\bhoodie\b/i.test(source)) item = "Hoodie";
  else if (/\bsweater\b/i.test(source)) item = "Sweater";
  else if (/\bcardigan\b/i.test(source)) item = "Cardigan";

  const details = source
    .replace(/\bmen'?s\b/gi, "")
    .replace(/\bwomen'?s\b/gi, "")
    .replace(/\bmen\b/gi, "")
    .replace(/\bwomen\b/gi, "")
    .replace(
      /\b(dress|blouse|shirt|jacket|jeans|pants|skirt|hoodie|sweater|cardigan|t-shirt|tshirt)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return limit(
    `${gender} ${details} ${item}`.replace(/\s{2,}/g, " ").trim(),
    65
  );
}

function buildFootwearTitle(originalTitle: string) {
  const source = removeSupplierWords(cleanText(originalTitle));

  let item = "Footwear";

  if (/sneaker/i.test(source)) item = "Sneakers";
  else if (/sandal/i.test(source)) item = "Sandals";
  else if (/boot/i.test(source)) item = "Boots";
  else if (/loafer/i.test(source)) item = "Loafers";
  else if (/slipper/i.test(source)) item = "Slippers";
  else if (/shoe/i.test(source)) item = "Shoes";

  const details = source
    .replace(
      /\b(shoes?|sneakers?|sandals?|boots?|loafers?|slippers?)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return limit(`${details} ${item}`.trim(), 65);
}

function buildBathroomTitle(originalTitle: string) {
  const source = removeSupplierWords(cleanText(originalTitle));

  let item = "Bathroom Fixture";

  if (/\bfaucet\b|\btap\b/i.test(source)) item = "Faucet";
  else if (/\bshower\b/i.test(source)) item = "Shower Fixture";
  else if (/\bmirror\b/i.test(source)) item = "Bathroom Mirror";
  else if (/\bsink\b/i.test(source)) item = "Bathroom Sink";
  else if (/\btoilet\b/i.test(source)) item = "Toilet Fixture";

  const details = source
    .replace(
      /\b(faucet|tap|shower|mirror|bathroom|sink|toilet)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return limit(`${details} ${item}`.trim(), 65);
}

function buildGenericTitle(
  originalTitle: string,
  productType: string
) {
  const source = removeSupplierWords(cleanText(originalTitle));

  const suffixMap: Record<string, string> = {
    "Home Organization": "Organizer",
    Electronics: "Device",
    Kitchen: "Kitchen Tool",
    Automotive: "Car Accessory",
    Jewelry: "Jewelry",
    "Baby & Kids": "Accessory",
    Lifestyle: "Essential",
  };

  const suffix = suffixMap[productType] || "";

  const cleaned = source
    .replace(
      /\b(product|item|goods|new|latest|best|hot|sale)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) {
    return productType === "Lifestyle"
      ? "Everyday Essential"
      : suffix || productType;
  }

  return limit(
    `${cleaned}${suffix ? ` ${suffix}` : ""}`.trim(),
    65
  );
}

function buildTitle(
  originalTitle: string,
  productType: string
) {
  switch (productType) {
    case "Watches":
      return buildWatchTitle(originalTitle);

    case "Apparel":
      return buildApparelTitle(originalTitle);

    case "Footwear":
      return buildFootwearTitle(originalTitle);

    case "Bathroom":
      return buildBathroomTitle(originalTitle);

    default:
      return buildGenericTitle(originalTitle, productType);
  }
}

function buildFeatures(
  sourceTitle: string,
  productType: string
) {
  const text = sourceTitle.toLowerCase();
  const features: string[] = [];

  if (productType === "Watches") {
    if (text.includes("quartz"))
      features.push("Quartz movement");

    if (text.includes("automatic"))
      features.push("Automatic movement");

    if (text.includes("mechanical"))
      features.push("Mechanical movement");

    if (text.includes("chronograph"))
      features.push("Chronograph function");

    if (text.includes("steel"))
      features.push("Stainless steel construction");

    if (text.includes("moon"))
      features.push("Moon-inspired design");

    if (text.includes("men"))
      features.push("Men's styling");

    if (text.includes("women"))
      features.push("Women's styling");

    features.push(
      "Refined timepiece design",
      "Versatile everyday wear"
    );
  } else if (productType === "Apparel") {
    features.push(
      "Versatile everyday styling",
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
      "Clean modern styling",
      "Practical everyday functionality",
      "Designed for bathroom use"
    );
  } else if (productType === "Home Organization") {
    features.push(
      "Space-conscious design",
      "Practical organization",
      "Convenient everyday use"
    );
  } else if (productType === "Electronics") {
    features.push(
      "Practical everyday functionality",
      "Convenient design",
      "Easy everyday use"
    );
  } else if (productType === "Kitchen") {
    features.push(
      "Practical kitchen functionality",
      "Convenient everyday use",
      "Simple useful design"
    );
  } else if (productType === "Automotive") {
    features.push(
      "Practical vehicle accessory",
      "Convenient everyday use",
      "Functional design"
    );
  } else if (productType === "Jewelry") {
    features.push(
      "Refined accessory styling",
      "Versatile everyday wear",
      "Easy to pair with different looks"
    );
  } else if (productType === "Baby & Kids") {
    features.push(
      "Practical everyday design",
      "Convenient to use",
      "Designed for everyday needs"
    );
  } else {
    features.push(
      "Clean and versatile design",
      "Practical everyday functionality",
      "Convenient everyday use"
    );
  }

  return Array.from(new Set(features));
}

function buildDescription(
  title: string,
  productType: string,
  features: string[]
) {
  let opening = "";

  switch (productType) {
    case "Watches":
      opening =
        `${title} combines refined styling with practical timekeeping for everyday wear.`;
      break;

    case "Apparel":
      opening =
        `${title} offers versatile styling designed for comfortable everyday wear.`;
      break;

    case "Footwear":
      opening =
        `${title} combines everyday comfort with versatile styling for casual use.`;
      break;

    case "Bathroom":
      opening =
        `${title} brings practical functionality and clean modern styling to the bathroom.`;
      break;

    case "Home Organization":
      opening =
        `${title} is designed to make everyday organization simple, practical, and convenient.`;
      break;

    case "Electronics":
      opening =
        `${title} provides practical functionality in a convenient design for everyday use.`;
      break;

    case "Kitchen":
      opening =
        `${title} is designed to provide convenient functionality for everyday kitchen tasks.`;
      break;

    case "Automotive":
      opening =
        `${title} provides practical functionality for convenient everyday vehicle use.`;
      break;

    case "Jewelry":
      opening =
        `${title} adds refined styling to everyday looks with a versatile accessory design.`;
      break;

    case "Baby & Kids":
      opening =
        `${title} is designed with practical everyday use and convenience in mind.`;
      break;

    default:
      opening =
        `${title} is designed for customers who value practical function, clean style, and everyday usability.`;
  }

  return [
    opening,
    "",
    "Key features:",
    ...features.map((feature) => `• ${feature}`),
    "",
    `A versatile ${productType.toLowerCase()} choice designed for customers who appreciate useful functionality and a polished look.`,
  ].join("\n");
}

function buildProductInfo(
  originalTitle: string
): ProductInfo {
  const productType = detectProductType(originalTitle);
  const collection = detectCollection(productType);

  const title = buildTitle(
    originalTitle,
    productType
  );

  const features = buildFeatures(
    originalTitle,
    productType
  );

  const description = buildDescription(
    title,
    productType,
    features
  );

  return {
    description,
    features,
    productType,
    collection,
  };
}

function buildSeoTitle(title: string) {
  return limit(title, 50);
}

function buildMetaDescription(
  title: string,
  productType: string
) {
  const sentence =
    `Shop ${title} with refined design and practical features. ` +
    `A versatile ${productType.toLowerCase()} choice for everyday use.`;

  return limit(sentence, 160);
}

function buildKeywords(
  title: string,
  productType: string
) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const keywords = Array.from(
    new Set([
      ...words,
      productType.toLowerCase(),
      "quality design",
      "everyday use",
    ])
  );

  return keywords.join(", ");
}

function buildTags(
  title: string,
  productType: string
) {
  const text = title.toLowerCase();
  const tags = new Set<string>();

  tags.add(productType.toLowerCase());

  if (productType === "Watches") {
    tags.add("watches");
    tags.add("timepieces");

    if (text.includes("quartz"))
      tags.add("quartz");

    if (text.includes("automatic"))
      tags.add("automatic");

    if (text.includes("chronograph"))
      tags.add("chronograph");

    if (text.includes("steel"))
      tags.add("stainless steel");

    if (text.includes("men"))
      tags.add("men's watches");

    if (text.includes("women"))
      tags.add("women's watches");
  }

  if (productType === "Apparel") {
    tags.add("fashion");
    tags.add("clothing");
  }

  if (productType === "Bathroom") {
    tags.add("bathroom");
    tags.add("home");
  }

  if (productType === "Electronics") {
    tags.add("electronics");
    tags.add("tech");
  }

  return Array.from(tags).join(", ");
}

function buildAltText(title: string) {
  return limit(`${title} product`, 125);
}

function generateResult(
  originalTitle: string,
  productInfo: ProductInfo
): Result {
  const title = buildTitle(
    originalTitle,
    productInfo.productType
  );

  return {
    title,
    description: productInfo.description,
    seoTitle: buildSeoTitle(title),
    metaDescription: buildMetaDescription(
      title,
      productInfo.productType
    ),
    keywords: buildKeywords(
      title,
      productInfo.productType
    ),
    tags: buildTags(
      title,
      productInfo.productType
    ),
    altText: buildAltText(title),
    handle: makeHandle(title),
    productType: productInfo.productType,
    collection: productInfo.collection,
  };
}

function CopyButton({
  value,
}: {
  value: string;
}) {
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
    <button
      type="button"
      onClick={copyText}
      className="copyButton"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ResultCard({
  label,
  value,
  counter,
}: {
  label: string;
  value: string;
  counter?: string;
}) {
  return (
    <div className="resultCard">
      <div className="resultHeader">
        <div>
          <div className="resultLabel">
            {label}
          </div>

          {counter && (
            <div className="counter">
              {counter}
            </div>
          )}
        </div>

        <CopyButton value={value} />
      </div>

      <div className="resultValue">
        {value || "—"}
      </div>
    </div>
  );
}

export default function Home() {
  const [originalTitle, setOriginalTitle] =
    useState("");

  const [productInfo, setProductInfo] =
    useState<ProductInfo | null>(null);

  const [result, setResult] =
    useState<Result | null>(null);

  const [autoFilled, setAutoFilled] =
    useState(false);

  function autoFillProductInformation() {
    const title = originalTitle.trim();

    if (!title) return;

    const info = buildProductInfo(title);

    setProductInfo(info);
    setAutoFilled(true);
  }

  function optimizeProduct() {
    const title = originalTitle.trim();

    if (!title) return;

    const info =
      productInfo || buildProductInfo(title);

    setProductInfo(info);
    setResult(generateResult(title, info));
    setAutoFilled(true);
  }

  function clearAll() {
    setOriginalTitle("");
    setProductInfo(null);
    setResult(null);
    setAutoFilled(false);
  }

  return (
    <main className="page">
      <header className="header">
        <div className="brandMark">V</div>

        <div>
          <div className="brandName">
            Virello
          </div>

          <div className="brandSub">
            AI OPTIMIZER
          </div>
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
          content from a single product title.
        </p>
      </section>

      <section className="panel">
        <div className="sectionNumber">
          01
        </div>

        <h2>Product information</h2>

        <div className="divider" />

        <label className="fieldLabel">
          ORIGINAL PRODUCT TITLE *
        </label>

        <input
          value={originalTitle}
          onChange={(event) => {
            setOriginalTitle(event.target.value);
            setAutoFilled(false);
            setProductInfo(null);
          }}
          placeholder="Paste the original product title"
          className="titleInput"
          type="text"
          autoComplete="off"
        />

        <button
          type="button"
          onClick={
            autoFillProductInformation
          }
          disabled={!originalTitle.trim()}
          className="autoFillButton"
        >
          {autoFilled
            ? "Product Information Ready"
            : "Auto-Fill Product Information"}
        </button>

        <p className="helper">
          Enter the product title only. Virello
          automatically derives the description,
          features, product type, and collection from
          the title.
        </p>

        <button
          type="button"
          onClick={optimizeProduct}
          disabled={!originalTitle.trim()}
          className="primaryButton"
        >
          Optimize Product
        </button>

        <button
          type="button"
          onClick={clearAll}
          className="clearButton"
        >
          Clear
        </button>
      </section>

      {result && (
        <section className="panel">
          <div className="sectionNumber">
            02
          </div>

          <div className="readyRow">
            <h2>Optimized listing</h2>

            <span className="ready">
              READY
            </span>
          </div>

          <div className="divider" />

          <ResultCard
            label="PRODUCT TITLE"
            counter={`${result.title.length}/65`}
            value={result.title}
          />

          <ResultCard
            label="DESCRIPTION"
            value={result.description}
          />

          <ResultCard
            label="SEO TITLE"
            counter={`${result.seoTitle.length}/50`}
            value={result.seoTitle}
          />

          <ResultCard
            label="META DESCRIPTION"
            counter={`${result.metaDescription.length}/160`}
            value={result.metaDescription}
          />

          <ResultCard
            label="KEYWORDS"
            value={result.keywords}
          />

          <ResultCard
            label="TAGS"
            value={result.tags}
          />

          <ResultCard
            label="ALT TEXT"
            value={result.altText}
          />

          <ResultCard
            label="HANDLE"
            value={result.handle}
          />

          <ResultCard
            label="PRODUCT TYPE"
            value={result.productType}
          />

          <ResultCard
            label="COLLECTION"
            value={result.collection}
          />
        </section>
      )}

      <footer>
        <strong>Virello</strong> AI Optimizer
      </footer>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .page {
          min-height: 100vh;
          background: #f5f5f3;
          color: #101014;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          padding-bottom: 70px;
        }

        .header {
          min-height: 100px;
          background: #101010;
          color: white;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 22px 28px;
        }

        .brandMark {
          width: 48px;
          height: 48px;
          border: 1px solid #555;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
          font-weight: 800;
        }

        .brandName {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.4px;
        }

        .brandSub {
          font-size: 10px;
          letter-spacing: 4px;
          color: #aaa;
          margin-top: 4px;
        }

        .hero {
          max-width: 900px;
          margin: 0 auto;
          padding: 72px 24px 46px;
        }

        .eyebrow {
          display: inline-block;
          border: 1px solid #dededb;
          border-radius: 999px;
          background: white;
          padding: 12px 18px;
          color: #60636a;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        h1 {
          font-size: clamp(48px, 9vw, 92px);
          line-height: 0.93;
          letter-spacing: -5px;
          margin: 36px 0 28px;
        }

        h1 span {
          color: #858585;
        }

        .hero p {
          max-width: 680px;
          color: #6d6d70;
          font-size: 20px;
          line-height: 1.7;
          margin: 0;
        }

        .panel {
          max-width: 900px;
          margin: 0 auto 30px;
          background: white;
          border: 1px solid #dededb;
          border-radius: 28px;
          padding: 34px;
          box-shadow:
            0 8px 35px rgba(0, 0, 0, 0.04);
        }

        .sectionNumber {
          color: #777;
          font-size: 12px;
          letter-spacing: 3px;
          margin-bottom: 16px;
        }

        h2 {
          margin: 0;
          font-size: 34px;
          letter-spacing: -1.5px;
        }

        .divider {
          height: 1px;
          background: #e7e7e5;
          margin: 28px 0 34px;
        }

        .fieldLabel,
        .resultLabel {
          display: block;
          color: #69696c;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2.5px;
        }

        .titleInput {
          width: 100%;
          margin-top: 14px;
          padding: 21px 22px;
          border: 1px solid #cfcfcd;
          border-radius: 18px;
          outline: none;
          background: #fff;
          color: #151519;
          font-size: 18px;
        }

        .titleInput:focus {
          border-color: #111;
          box-shadow:
            0 0 0 3px
            rgba(0, 0, 0, 0.06);
        }

        .helper {
          color: #777;
          font-size: 14px;
          line-height: 1.6;
          margin: 14px 2px 28px;
        }

        .autoFillButton,
        .primaryButton,
        .clearButton {
          width: 100%;
          border-radius: 16px;
          padding: 18px;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
        }

        .autoFillButton {
          margin-top: 16px;
          background: white;
          color: #111;
          border: 1px solid #111;
        }

        .autoFillButton:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .primaryButton {
          border: 0;
          background: #111;
          color: white;
        }

        .primaryButton:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .clearButton {
          margin-top: 12px;
          background: white;
          color: #111;
          border: 1px solid #d4d4d2;
        }

        .readyRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .ready {
          color: #666;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .resultCard {
          border: 1px solid #dededb;
          border-radius: 20px;
          overflow: hidden;
          margin-bottom: 18px;
          background: #fff;
        }

        .resultHeader {
          min-height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 20px;
          background: #fafaf9;
          border-bottom: 1px solid #e5e5e3;
        }

        .counter {
          color: #858589;
          font-size: 12px;
          margin-top: 7px;
        }

        .copyButton {
          border: 1px solid #d0d0ce;
          background: white;
          color: #111;
          border-radius: 12px;
          padding: 10px 17px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .resultValue {
          white-space: pre-wrap;
          word-break: break-word;
          padding: 24px 22px;
          font-size: 17px;
          line-height: 1.75;
          min-height: 70px;
        }

        footer {
          max-width: 900px;
          margin: 50px auto 0;
          padding: 0 24px;
          color: #888;
          font-size: 13px;
          text-align: center;
        }

        @media (max-width: 650px) {
          .header {
            padding: 20px;
          }

          .hero {
            padding: 55px 20px 35px;
          }

          h1 {
            font-size: 54px;
            letter-spacing: -3px;
          }

          .hero p {
            font-size: 17px;
          }

          .panel {
            margin-left: 16px;
            margin-right: 16px;
            padding: 24px;
            border-radius: 24px;
          }

          h2 {
            font-size: 29px;
          }

          .resultValue {
            font-size: 16px;
          }
        }
      `}</style>
    </main>
  );
}
