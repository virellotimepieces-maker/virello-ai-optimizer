"use client";

import { useState } from "react";

type ProductInfo = {
  description: string;
  benefits: string[];
  features: string[];
  productType: string;
  collection: string;
};

type Result = {
  title: string;
  description: string;
  benefits: string[];
  features: string[];
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
    .replace(
      /\b(2026|2025|2024|new arrival|hot sale|best quality|free shipping|wholesale|official)\b/gi,
      ""
    )
    .trim();
}

function limit(text: string, max: number) {
  return text.trim().slice(0, max).trim();
}

function smartLimit(text: string, max: number) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= max) {
    return cleaned;
  }

  const cut = cleaned.slice(0, max);

  const lastSpace = cut.lastIndexOf(" ");

  if (lastSpace > max * 0.65) {
    return cut.slice(0, lastSpace).trim();
  }

  return cut.trim();
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
    /\b(phone|charger|usb|electronic|keyboard|fan|speaker|headphone|wireless|earbuds|solar panel)\b/i.test(
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
    /\b(car|vehicle|automotive|dashboard|trunk|seat|auto|ashtray)\b/i.test(
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
  return productType;
}

function extractGender(source: string) {
  if (/\b(men|men's|male)\b/i.test(source)) {
    return "Men's";
  }

  if (/\b(women|women's|ladies|female)\b/i.test(source)) {
    return "Women's";
  }

  return "";
}

function extractMovement(source: string) {
  if (/chronograph/i.test(source)) return "Chronograph";
  if (/automatic/i.test(source)) return "Automatic";
  if (/mechanical/i.test(source)) return "Mechanical";
  if (/quartz/i.test(source)) return "Quartz";

  return "";
}

function buildWatchTitle(originalTitle: string) {
  const source = cleanText(originalTitle);

  const gender = extractGender(source);
  const movement = extractMovement(source);

  let cleaned = source
    .replace(/\bPAGANI DESIGN\b/gi, "Pagani")
    .replace(/\bPAGANI\b/gi, "Pagani")
    .replace(/\bmen'?s\b/gi, "")
    .replace(/\bwomen'?s\b/gi, "")
    .replace(/\bmen\b/gi, "")
    .replace(/\bwomen\b/gi, "")
    .replace(/\bwatch(es)?\b/gi, "")
    .replace(/\bwristwatch\b/gi, "")
    .replace(/\bquartz\b/gi, "")
    .replace(/\bautomatic\b/gi, "")
    .replace(/\bmechanical\b/gi, "")
    .replace(/\bchronograph\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const parts = [
    cleaned,
    gender,
    movement,
    "Watch",
  ].filter(Boolean);

  let title = parts.join(" ");

  title = title
    .replace(/\bWatch Watch\b/gi, "Watch")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!title) {
    title = "Classic Watch";
  }

  return smartLimit(title, 65);
}

function buildApparelTitle(originalTitle: string) {
  const source = cleanText(originalTitle);
  const gender = extractGender(source);

  let item = "Apparel";

  if (/dress/i.test(source)) item = "Dress";
  else if (/blouse/i.test(source)) item = "Blouse";
  else if (/shirt|t-shirt|tshirt/i.test(source)) item = "Shirt";
  else if (/jacket/i.test(source)) item = "Jacket";
  else if (/jeans/i.test(source)) item = "Jeans";
  else if (/pants/i.test(source)) item = "Pants";
  else if (/skirt/i.test(source)) item = "Skirt";
  else if (/hoodie/i.test(source)) item = "Hoodie";
  else if (/sweater/i.test(source)) item = "Sweater";
  else if (/cardigan/i.test(source)) item = "Cardigan";

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

  return smartLimit(
    `${gender} ${details} ${item}`.replace(/\s{2,}/g, " ").trim(),
    65
  );
}

function buildFootwearTitle(originalTitle: string) {
  const source = cleanText(originalTitle);

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

  return smartLimit(`${details} ${item}`.trim(), 65);
}

function buildBathroomTitle(originalTitle: string) {
  const source = cleanText(originalTitle);

  let item = "Bathroom Fixture";

  if (/faucet|tap/i.test(source)) item = "Faucet";
  else if (/shower/i.test(source)) item = "Shower Fixture";
  else if (/mirror/i.test(source)) item = "Bathroom Mirror";
  else if (/sink/i.test(source)) item = "Bathroom Sink";
  else if (/toilet/i.test(source)) item = "Toilet Fixture";

  const details = source
    .replace(
      /\b(faucet|tap|shower|mirror|bathroom|sink|toilet)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return smartLimit(`${details} ${item}`.trim(), 65);
}

function buildGenericTitle(
  originalTitle: string,
  productType: string
) {
  const source = cleanText(originalTitle);

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
    .replace(/\b(product|item|goods|new|latest|best|hot|sale)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) {
    return suffix || productType;
  }

  return smartLimit(
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
    if (text.includes("quartz")) {
      features.push("Reliable quartz movement");
    }

    if (text.includes("automatic")) {
      features.push("Automatic mechanical movement");
    }

    if (text.includes("chronograph")) {
      features.push("Chronograph functionality");
    }

    if (text.includes("steel")) {
      features.push("Stainless steel construction");
    }

    if (text.includes("waterproof") || text.includes("water resistant")) {
      features.push("Water-resistant design");
    }

    if (text.includes("moon")) {
      features.push("Moon-inspired dial design");
    }

    if (text.includes("sport")) {
      features.push("Sport-inspired styling");
    }

    features.push("Refined timepiece design");
    features.push("Versatile everyday wear");
  }

  if (productType === "Apparel") {
    features.push("Versatile everyday styling");
    features.push("Comfort-focused design");
    features.push("Easy to pair with different outfits");
    features.push("Suitable for casual occasions");
  }

  if (productType === "Footwear") {
    features.push("Comfort-focused construction");
    features.push("Versatile everyday styling");
    features.push("Easy-to-wear design");
    features.push("Suitable for casual occasions");
  }

  if (productType === "Bathroom") {
    features.push("Functional everyday design");
    features.push("Modern appearance");
    features.push("Practical bathroom use");
    features.push("Designed for convenient installation");
  }

  if (productType === "Home Organization") {
    features.push("Space-saving design");
    features.push("Practical storage solution");
    features.push("Easy organization");
    features.push("Suitable for everyday home use");
  }

  if (productType === "Electronics") {
    features.push("Practical everyday functionality");
    features.push("Compact and convenient design");
    features.push("Easy to use");
    features.push("Designed for everyday convenience");
  }

  if (productType === "Kitchen") {
    features.push("Practical kitchen functionality");
    features.push("Convenient everyday design");
    features.push("Easy to use");
    features.push("Suitable for regular kitchen tasks");
  }

  if (productType === "Automotive") {
    features.push("Practical vehicle accessory");
    features.push("Convenient everyday use");
    features.push("Functional design");
    features.push("Easy to integrate into daily driving");
  }

  if (productType === "Jewelry") {
    features.push("Refined appearance");
    features.push("Versatile styling");
    features.push("Easy to pair with different looks");
    features.push("Suitable for everyday wear");
  }

  if (productType === "Baby & Kids") {
    features.push("Practical everyday design");
    features.push("Easy to use");
    features.push("Designed for convenience");
    features.push("Suitable for everyday routines");
  }

  if (productType === "Lifestyle") {
    features.push("Practical everyday design");
    features.push("Versatile use");
    features.push("Convenient functionality");
    features.push("Designed for everyday living");
  }

  return Array.from(new Set(features)).slice(0, 6);
}

function buildBenefits(
  productType: string
) {
  if (productType === "Watches") {
    return [
      "Adds a polished finishing touch to everyday outfits",
      "Combines practical timekeeping with refined style",
      "Easy to wear from casual days to dressed-up occasions",
      "A versatile choice for customers who value style and function",
    ];
  }

  if (productType === "Apparel") {
    return [
      "Makes everyday outfits easier to style",
      "Offers versatile wear across different occasions",
      "Helps create a polished look with minimal effort",
      "Designed for practical everyday wardrobe use",
    ];
  }

  if (productType === "Footwear") {
    return [
      "Adds practical comfort to everyday routines",
      "Easy to style with different outfits",
      "Suitable for a range of casual occasions",
      "A versatile addition to an everyday wardrobe",
    ];
  }

  if (productType === "Bathroom") {
    return [
      "Helps create a cleaner and more modern bathroom look",
      "Adds practical functionality to everyday routines",
      "Designed to combine useful performance with style",
      "A convenient upgrade for everyday bathroom use",
    ];
  }

  if (productType === "Home Organization") {
    return [
      "Helps reduce everyday clutter",
      "Makes items easier to organize and access",
      "Helps maximize available storage space",
      "Creates a cleaner and more organized home",
    ];
  }

  if (productType === "Electronics") {
    return [
      "Makes everyday tasks more convenient",
      "Provides practical functionality when you need it",
      "Designed for simple and convenient everyday use",
      "A useful addition to modern daily routines",
    ];
  }

  if (productType === "Kitchen") {
    return [
      "Helps make everyday kitchen tasks easier",
      "Adds practical convenience to meal preparation",
      "Designed for simple and efficient everyday use",
      "A useful addition to a functional kitchen",
    ];
  }

  if (productType === "Automotive") {
    return [
      "Adds convenience to everyday driving",
      "Helps improve practical vehicle organization or use",
      "Designed for simple everyday installation and use",
      "A useful upgrade for daily drivers",
    ];
  }

  if (productType === "Jewelry") {
    return [
      "Adds a refined finishing touch to your look",
      "Easy to style with different outfits",
      "Works well for everyday wear and occasions",
      "Helps create a polished personal style",
    ];
  }

  return [
    "Adds practical value to everyday routines",
    "Designed for convenient everyday use",
    "Easy to incorporate into daily life",
    "A versatile choice for modern lifestyles",
  ];
}

function buildDescription(
  title: string,
  productType: string,
  features: string[]
) {
  const featureText = features
    .slice(0, 3)
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");

  if (productType === "Watches") {
    return `${title} combines refined styling with practical timekeeping for everyday wear. Designed with ${featureText || "a polished look and versatile functionality"}, it brings together useful performance and timeless appeal. A versatile choice for customers looking for a polished timepiece that works across everyday occasions.`;
  }

  return `${title} is designed to combine practical functionality with a polished, versatile look. Featuring ${featureText || "a practical everyday design"}, it is made for convenient everyday use. A smart choice for customers looking for useful performance, easy styling, and lasting everyday value.`;
}

function buildSeoTitle(title: string) {
  let seo = title;

  seo = seo
    .replace(/\bWatch\b/gi, "Watch")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (seo.length > 60) {
    seo = smartLimit(seo, 60);
  }

  return seo;
}

function buildMetaDescription(
  title: string,
  productType: string
) {
  const base =
    productType === "Watches"
      ? `Shop ${title} with refined styling, practical features and versatile everyday appeal. Discover a polished timepiece designed for modern wear.`
      : `Shop ${title} with practical features, versatile styling and everyday convenience. Discover a useful design made for modern lifestyles.`;

  return smartLimit(base, 160);
}

function buildKeywords(
  title: string,
  productType: string
) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 2 &&
        !["the", "and", "for", "with"].includes(word)
    );

  const categoryWords: Record<string, string[]> = {
    Watches: [
      "watches",
      "timepieces",
      "wristwatch",
      "everyday watch",
    ],
    Apparel: [
      "apparel",
      "fashion",
      "everyday wear",
    ],
    Footwear: [
      "footwear",
      "shoes",
      "everyday footwear",
    ],
    Bathroom: [
      "bathroom",
      "bathroom fixture",
      "home improvement",
    ],
    "Home Organization": [
      "home organization",
      "storage",
      "organizer",
    ],
    Electronics: [
      "electronics",
      "device",
      "everyday tech",
    ],
    Kitchen: [
      "kitchen",
      "kitchen tool",
      "home essentials",
    ],
    Automotive: [
      "automotive",
      "car accessory",
      "vehicle accessory",
    ],
    Jewelry: [
      "jewelry",
      "accessories",
      "fashion jewelry",
    ],
    "Baby & Kids": [
      "baby",
      "kids",
      "everyday essentials",
    ],
    Lifestyle: [
      "lifestyle",
      "home essentials",
      "everyday essentials",
    ],
  };

  const combined = [
    ...words,
    ...(categoryWords[productType] || []),
  ];

  return Array.from(new Set(combined))
    .slice(0, 12)
    .join(", ");
}

function buildTags(productType: string) {
  const tags: Record<string, string[]> = {
    Watches: [
      "watches",
      "timepieces",
      "stainless steel",
      "everyday watch",
    ],
    Apparel: [
      "apparel",
      "fashion",
      "everyday wear",
    ],
    Footwear: [
      "footwear",
      "shoes",
      "everyday footwear",
    ],
    Bathroom: [
      "bathroom",
      "bathroom fixtures",
      "home improvement",
    ],
    "Home Organization": [
      "home organization",
      "storage",
      "organizers",
    ],
    Electronics: [
      "electronics",
      "tech",
      "everyday devices",
    ],
    Kitchen: [
      "kitchen",
      "kitchen tools",
      "home essentials",
    ],
    Automotive: [
      "automotive",
      "car accessories",
      "vehicle accessories",
    ],
    Jewelry: [
      "jewelry",
      "accessories",
      "fashion",
    ],
    "Baby & Kids": [
      "baby",
      "kids",
      "essentials",
    ],
    Lifestyle: [
      "lifestyle",
      "essentials",
      "everyday",
    ],
  };

  return (tags[productType] || tags.Lifestyle).join(", ");
}

function buildAltText(title: string) {
  return smartLimit(
    `${title} product`,
    125
  );
}

function generateProductInfo(
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

  const benefits = buildBenefits(productType);

  const description = buildDescription(
    title,
    productType,
    features
  );

  return {
    description,
    benefits,
    features,
    productType,
    collection,
  };
}

function generateResult(
  originalTitle: string,
  info: ProductInfo
): Result {
  const title = buildTitle(
    originalTitle,
    info.productType
  );

  return {
    title,
    description: info.description,
    benefits: info.benefits,
    features: info.features,
    seoTitle: buildSeoTitle(title),
    metaDescription: buildMetaDescription(
      title,
      info.productType
    ),
    keywords: buildKeywords(
      title,
      info.productType
    ),
    tags: buildTags(info.productType),
    altText: buildAltText(title),
    handle: makeHandle(title),
    productType: info.productType,
    collection: info.collection,
  };
}

function CopyButton({
  value,
}: {
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="copyButton"
      onClick={copy}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ResultField({
  label,
  value,
  max,
  multiline = false,
}: {
  label: string;
  value: string;
  max?: number;
  multiline?: boolean;
}) {
  return (
    <div className="resultField">
      <div className="resultFieldTop">
        <div>
          <div className="resultLabel">
            {label}
          </div>

          {max ? (
            <div className="counter">
              {value.length}/{max}
            </div>
          ) : null}
        </div>

        <CopyButton value={value} />
      </div>

      <div
        className={
          multiline
            ? "resultValue multiline"
            : "resultValue"
        }
      >
        {value}
      </div>
    </div>
  );
}

function ListResultField({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  const value = items
    .map((item) => `• ${item}`)
    .join("\n");

  return (
    <ResultField
      label={label}
      value={value}
      multiline
    />
  );
}

export default function Home() {
  const [originalTitle, setOriginalTitle] =
    useState("");

  const [productInfo, setProductInfo] =
    useState<ProductInfo | null>(null);

  const [result, setResult] =
    useState<Result | null>(null);

  const [loading, setLoading] =
    useState(false);

  function optimizeProduct() {
    const title = originalTitle.trim();

    if (!title) return;

    setLoading(true);

    setTimeout(() => {
      const info = generateProductInfo(title);
      const generated = generateResult(
        title,
        info
      );

      setProductInfo(info);
      setResult(generated);

      setLoading(false);
    }, 250);
  }

  function clearAll() {
    setOriginalTitle("");
    setProductInfo(null);
    setResult(null);
  }

  const ready = originalTitle.trim().length > 0;

  return (
    <main>
      <header className="header">
        <div className="brand">
          VIRELLO
        </div>

        <div className="brandSub">
          AI PRODUCT OPTIMIZER
        </div>
      </header>

      <section className="hero">
        <div className="eyebrow">
          PRODUCT CONTENT
        </div>

        <h1>
          Build a better
          <br />
          product listing.
        </h1>

        <p>
          Create polished, professional
          product content from a single
          supplier product title.
        </p>
      </section>

      <section className="panel">
        <div className="sectionNumber">
          01
        </div>

        <h2>
          Product information
        </h2>

        <div className="divider" />

        <label className="fieldLabel">
          ORIGINAL PRODUCT TITLE *
        </label>

        <input
          className="titleInput"
          value={originalTitle}
          onChange={(event) =>
            setOriginalTitle(
              event.target.value
            )
          }
          placeholder="Paste supplier product title"
        />

        <p className="helper">
          Enter the supplier product title
          only. Virello automatically derives
          the product information from it.
        </p>

        <button
          className="primaryButton"
          type="button"
          disabled={!ready || loading}
          onClick={optimizeProduct}
        >
          {loading
            ? "Generating..."
            : "Optimize Product"}
        </button>

        <button
          className="clearButton"
          type="button"
          onClick={clearAll}
        >
          Clear
        </button>
      </section>

      {productInfo ? (
        <section className="panel infoPanel">
          <div className="sectionNumber">
            PRODUCT INFO
          </div>

          <div className="readyRow">
            <h2>
              Generated product information
            </h2>

            <span className="ready">
              READY
            </span>
          </div>

          <div className="divider" />

          <ResultField
            label="PRODUCT DESCRIPTION"
            value={
              productInfo.description
            }
            multiline
          />

          <ListResultField
            label="CUSTOMER BENEFITS"
            items={
              productInfo.benefits
            }
          />

          <ListResultField
            label="KEY FEATURES"
            items={
              productInfo.features
            }
          />

          <ResultField
            label="PRODUCT TYPE"
            value={
              productInfo.productType
            }
          />

          <ResultField
            label="COLLECTION"
            value={
              productInfo.collection
            }
          />
        </section>
      ) : null}

      {result ? (
        <section className="panel">
          <div className="sectionNumber">
            02
          </div>

          <div className="readyRow">
            <h2>
              Optimized listing
            </h2>

            <span className="ready">
              READY
            </span>
          </div>

          <div className="divider" />

          <ResultField
            label="PRODUCT TITLE"
            value={result.title}
            max={65}
          />

          <ResultField
            label="DESCRIPTION"
            value={result.description}
            multiline
          />

          <ListResultField
            label="CUSTOMER BENEFITS"
            items={result.benefits}
          />

          <ListResultField
            label="KEY FEATURES"
            items={result.features}
          />

          <ResultField
            label="SEO TITLE"
            value={result.seoTitle}
            max={60}
          />

          <ResultField
            label="META DESCRIPTION"
            value={result.metaDescription}
            max={160}
            multiline
          />

          <ResultField
            label="KEYWORDS"
            value={result.keywords}
            multiline
          />

          <ResultField
            label="TAGS"
            value={result.tags}
            multiline
          />

          <ResultField
            label="ALT TEXT"
            value={result.altText}
            multiline
          />

          <ResultField
            label="HANDLE"
            value={result.handle}
            multiline
          />

          <ResultField
            label="PRODUCT TYPE"
            value={result.productType}
          />

          <ResultField
            label="COLLECTION"
            value={result.collection}
          />
        </section>
      ) : null}

      <footer>
        Virello AI Optimizer
      </footer>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        main {
          min-height: 100vh;
          background: #f5f5f3;
          color: #111;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          padding-bottom: 80px;
        }

        .header {
          max-width: 1000px;
          margin: 0 auto;
          padding: 28px 24px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 20px;
        }

        .brand {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 3px;
        }

        .brandSub {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          color: #777;
        }

        .hero {
          max-width: 1000px;
          margin: 0 auto;
          padding: 75px 24px 55px;
        }

        .eyebrow {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #777;
          margin-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: 76px;
          line-height: 0.95;
          letter-spacing: -5px;
          font-weight: 900;
          max-width: 850px;
        }

        .hero p {
          margin: 30px 0 0;
          max-width: 650px;
          font-size: 20px;
          line-height: 1.6;
          color: #686868;
        }

        .panel {
          max-width: 900px;
          margin: 0 auto 22px;
          padding: 34px;
          background: white;
          border: 1px solid #dededb;
          border-radius: 28px;
        }

        .sectionNumber {
          color: #777;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 3px;
          margin-bottom: 22px;
        }

        h2 {
          margin: 0;
          font-size: 36px;
          line-height: 1;
          letter-spacing: -1.5px;
          font-weight: 900;
        }

        .divider {
          height: 1px;
          background: #e7e7e5;
          margin: 28px 0 34px;
        }

        .fieldLabel,
        .resultLabel {
          display: block;
          color: #666;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2.2px;
        }

        .titleInput {
          width: 100%;
          margin-top: 14px;
          padding: 21px 22px;
          border: 1px solid #cfcfcd;
          border-radius: 18px;
          outline: none;
          background: white;
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

        .primaryButton,
        .clearButton {
          width: 100%;
          border-radius: 16px;
          padding: 18px;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
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
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          white-space: nowrap;
        }

        .resultField {
          border: 1px solid #e1e1df;
          border-radius: 18px;
          overflow: hidden;
          margin-bottom: 16px;
          background: #fff;
        }

        .resultFieldTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 15px 18px;
          background: #fafaf9;
          border-bottom: 1px solid #e7e7e5;
        }

        .counter {
          color: #999;
          font-size: 11px;
          margin-top: 5px;
        }

        .copyButton {
          border: 1px solid #d0d0ce;
          background: white;
          color: #111;
          border-radius: 10px;
          padding: 9px 15px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .resultValue {
          padding: 20px;
          font-size: 17px;
          line-height: 1.65;
          min-height: 60px;
          word-break: normal;
          overflow-wrap: anywhere;
        }

        .multiline {
          white-space: pre-line;
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

          .brandSub {
            display: none;
          }

          .hero {
            padding: 55px 20px 35px;
          }

          h1 {
            font-size: 52px;
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

          .resultFieldTop {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
