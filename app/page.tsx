"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
    };
  }
}

type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  productType: string;
  tags: string[];
  status: string;
  vendor: string;
  price: string;
  images?: {
    url: string;
    altText: string | null;
  }[];
  featuredImage: string | null;
};

type Audience = "Women" | "Men" | "Unisex";

type Style =
  | "Premium / Luxury"
  | "Professional"
  | "Everyday"
  | "Casual"
  | "Sport"
  | "Gift";

type Product = ShopifyProduct & {
  audience: Audience;
  style: Style;
};

type OptimizedProduct = {
  title: string;
  productType: string;
  tags: string[];
  description: string;
  seoTitle: string;
  metaDescription: string;
  specifications: string[];
};

/* =========================================================
   HELPERS
========================================================= */

function clean(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = clean(value).toLowerCase();

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function limitWords(value: string, maxWords: number) {
  return clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function limitCharacters(value: string, max: number) {
  const text = clean(value);

  if (text.length <= max) {
    return text;
  }

  let result = text.slice(0, max);

  const lastSpace = result.lastIndexOf(" ");

  if (lastSpace > Math.floor(max * 0.65)) {
    result = result.slice(0, lastSpace);
  }

  return result
    .trim()
    .replace(/[.,;:!?-]+$/, "");
}

function escapeHtml(value: string) {
  return String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char] || char,
  );
}

/* =========================================================
   PRODUCT TEXT
========================================================= */

function getProductText(product: ShopifyProduct) {
  return [
    product.title,
    product.productType,
    product.vendor,
    product.tags.join(" "),
    stripHtml(product.description),
  ].join(" ");
}

/* =========================================================
   AUDIENCE
========================================================= */

function detectAudience(product: ShopifyProduct): Audience {
  const text = getProductText(product).toLowerCase();

  if (
    /\bwomen\b|\bwomen's\b|\bladies\b|\blady\b|\bfemale\b/.test(
      text,
    )
  ) {
    return "Women";
  }

  if (
    /\bmen\b|\bmen's\b|\bgentlemen\b|\bgents\b|\bmale\b/.test(
      text,
    )
  ) {
    return "Men";
  }

  return "Unisex";
}

/* =========================================================
   STYLE
========================================================= */

function detectStyle(product: ShopifyProduct): Style {
  const text = getProductText(product).toLowerCase();

  if (
    /luxury|premium|elegant|sapphire|automatic|mechanical|formal|dress watch/.test(
      text,
    )
  ) {
    return "Premium / Luxury";
  }

  if (
    /sport|sports|diving|diver|racing|athletic|chronograph/.test(
      text,
    )
  ) {
    return "Sport";
  }

  if (/casual|fashion|street/.test(text)) {
    return "Casual";
  }

  if (/gift|present/.test(text)) {
    return "Gift";
  }

  if (/business|office|professional/.test(text)) {
    return "Professional";
  }

  return "Everyday";
}

function toProduct(product: ShopifyProduct): Product {
  return {
    ...product,
    audience: detectAudience(product),
    style: detectStyle(product),
  };
}

/* =========================================================
   PRODUCT TYPE
========================================================= */

function buildProductType(product: Product) {
  const existing = clean(product.productType);

  /*
   * Preserve a useful existing Shopify product type.
   */
  if (
    existing &&
    !/^product$/i.test(existing) &&
    !/^products$/i.test(existing)
  ) {
    return existing;
  }

  const text = getProductText(product).toLowerCase();

  if (
    /watch|timepiece|chronograph|quartz|automatic|mechanical/.test(
      text,
    )
  ) {
    return "Watches";
  }

  if (/shoe|sneaker|footwear/.test(text)) {
    return "Shoes";
  }

  if (/shirt|blouse|top/.test(text)) {
    return "Tops";
  }

  if (/dress/.test(text)) {
    return "Dresses";
  }

  if (/bag|handbag|purse/.test(text)) {
    return "Bags";
  }

  if (
    /jewelry|jewellery|necklace|bracelet|ring/.test(text)
  ) {
    return "Jewelry";
  }

  return "Products";
}

/* =========================================================
   TITLE CLEANUP
========================================================= */

function removeBadWords(value: string) {
  return clean(value)
    .replace(
      /\b(elevate|dropshipping|wholesale|supplier|cheap|hot sale|hot selling|free shipping|best seller|new arrival|new product|fashion men|fashion women)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   PRODUCT TITLE
========================================================= */

function buildProductTitle(product: Product) {
  let source = removeBadWords(product.title);

  source = source
    .replace(/[|:;,()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = source.split(/\s+/).filter(Boolean);

  const seen = new Set<string>();

  const filtered = words.filter((word) => {
    const key = word
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  /*
   * Product title is kept concise, but there is
   * no character max restriction in the editor.
   */
  let title = limitWords(
    filtered.join(" "),
    8,
  );

  title = title
    .replace(/\bDesign\s+Design\b/gi, "Design")
    .replace(/\bWatch\s+Watch\b/gi, "Watch")
    .replace(/\bMen's\s+Men's\b/gi, "Men's")
    .replace(/\bWomen’s\s+Women’s\b/gi, "Women’s")
    .replace(/\s+/g, " ")
    .trim();

  return title || "Premium Timepiece";
}

/* =========================================================
   TAGS
========================================================= */

function buildTags(product: Product) {
  const text = getProductText(product).toLowerCase();

  const result: string[] = [];

  const add = (value: string) => {
    const tag = clean(value);

    if (tag) {
      result.push(tag);
    }
  };

  if (
    /watch|timepiece|chronograph|quartz|automatic|mechanical/.test(
      text,
    )
  ) {
    add("watches");
  }

  if (/automatic/.test(text)) {
    add("automatic watch");
  }

  if (/mechanical/.test(text)) {
    add("mechanical watch");
  }

  if (/quartz/.test(text)) {
    add("quartz watch");
  }

  if (/chronograph/.test(text)) {
    add("chronograph");
  }

  if (/stainless steel/.test(text)) {
    add("stainless steel");
  }

  if (/sport|racing/.test(text)) {
    add("sport watch");
  }

  if (/luxury|premium|elegant|refined/.test(text)) {
    add("luxury");
  }

  if (product.audience === "Men") {
    add("men");
  }

  if (product.audience === "Women") {
    add("women");
  }

  if (product.audience === "Unisex") {
    add("unisex");
  }

  /*
   * Preserve useful original Shopify tags.
   */
  for (const tag of product.tags) {
    const cleanedTag = clean(tag);

    if (
      !cleanedTag ||
      /elevate|dropshipping|wholesale|supplier|cheap|hot sale|hot selling|best seller|new arrival/i.test(
        cleanedTag,
      )
    ) {
      continue;
    }

    add(cleanedTag);
  }

  return unique(result).slice(0, 15);
}

/* =========================================================
   SPECIFICATION LABELS
========================================================= */

const SPEC_LABELS = [
  "Material",
  "Movement",
  "Case Material",
  "Case Size",
  "Case Diameter",
  "Case Thickness",
  "Water Resistance",
  "Strap Material",
  "Band Material",
  "Strap Width",
  "Band Width",
  "Crystal",
  "Dial Color",
  "Case Color",
  "Band Color",
  "Power Reserve",
  "Battery",
  "Dimensions",
  "Weight",
  "Capacity",
  "Size",
  "Color",
  "Finish",
  "Clasp Type",
  "Dial Type",
  "Display Type",
  "Functions",
  "Features",
  "Closure Type",
  "Style",
] as const;

/* =========================================================
   NORMALIZE SPEC LABEL
========================================================= */

function normalizeLabel(value: string) {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/\s+/g, " ");

  return SPEC_LABELS.find(
    (label) =>
      label.toLowerCase() === normalized,
  );
}

/* =========================================================
   SPECIFICATION EXTRACTION
========================================================= */

function extractSpecifications(
  description: string,
  product: ShopifyProduct,
) {
  const original = stripHtml(description);

  const specs: string[] = [];

  /*
   * Traditional specification format:
   *
   * Movement: Quartz
   * Case Material: Stainless Steel
   */
  const labelPattern =
    /(Material|Movement|Case Material|Case Size|Case Diameter|Case Thickness|Water Resistance|Strap Material|Band Material|Strap Width|Band Width|Crystal|Dial Color|Case Color|Band Color|Power Reserve|Battery|Dimensions|Weight|Capacity|Size|Color|Finish|Clasp Type|Dial Type|Display Type|Functions|Features|Closure Type)\s*[:：-]\s*([^,.;\n]{1,100})/gi;

  let match: RegExpExecArray | null;

  while (
    (match = labelPattern.exec(original)) !== null
  ) {
    const label = normalizeLabel(match[1]);
    const value = clean(match[2]);

    if (
      label &&
      value &&
      value.length <= 120
    ) {
      specs.push(`${label}: ${value}`);
    }
  }

  /*
   * Inspect Shopify product title,
   * tags and product type for explicit information.
   */
  const productText = getProductText(product);
  const lower = productText.toLowerCase();

  if (/quartz/.test(lower)) {
    specs.push("Movement: Quartz");
  }

  if (/automatic/.test(lower)) {
    specs.push("Movement: Automatic");
  }

  if (/mechanical/.test(lower)) {
    specs.push("Movement: Mechanical");
  }

  if (/chronograph/.test(lower)) {
    specs.push("Functions: Chronograph");
  }

  if (/stainless steel/.test(lower)) {
    specs.push(
      "Case Material: Stainless Steel",
    );
  }

  if (/water resistant/.test(lower)) {
    const waterMatch = lower.match(
      /(\d+\s*(?:m|meter|meters|atm|bar))\s*(?:water resistant|water resistance)/i,
    );

    if (waterMatch) {
      specs.push(
        `Water Resistance: ${waterMatch[1]}`,
      );
    }
  }

  return unique(specs).slice(0, 20);
}

/* =========================================================
   SENTENCE CLEANUP
========================================================= */

function removeDuplicateSentences(value: string) {
  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map(clean)
    .filter(Boolean);

  const seen = new Set<string>();

  return sentences
    .filter((sentence) => {
      const key = sentence
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(" ");
}

/* =========================================================
   ORIGINAL DESCRIPTION CLEANUP
========================================================= */

function cleanOriginalDescription(
  description: string,
) {
  let original = stripHtml(description);

  original = original
    .replace(
      /\b(shop now|buy now|upgrade your|elevate your|free shipping|order now|click here)\b[^.?!]*[.?!]?/gi,
      "",
    )
    .replace(
      /\b(key features|specifications|product details|product description)\b:?/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  original = original
    .replace(
      /\b(high quality|high-quality|top quality|premium quality)\b/gi,
      "quality",
    )
    .replace(
      /\b(must have|must-have)\b/gi,
      "",
    )
    .replace(
      /\b(perfect for everyone)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  return removeDuplicateSentences(
    original,
  );
}

/* =========================================================
   DESCRIPTION
========================================================= */

function buildDescription(
  product: Product,
  title: string,
  specifications: string[],
) {
  const productText =
    getProductText(product).toLowerCase();

  const isWatch =
    /watch|timepiece|chronograph|quartz|automatic|mechanical/.test(
      productText,
    );

  const isChronograph =
    /chronograph/.test(productText);

  const isQuartz =
    /quartz/.test(productText);

  const isAutomatic =
    /automatic/.test(productText);

  const audienceText =
    product.audience === "Men"
      ? "men"
      : product.audience === "Women"
        ? "women"
        : "men and women";

  let intro = "";

  if (isWatch) {
    if (isChronograph) {
      intro =
        `Designed for ${audienceText} who appreciate refined details, the ${title} brings a distinctive chronograph-inspired look to everyday style. Its detailed dial, balanced proportions, and polished finish create a confident appearance that transitions naturally from professional settings to evenings out.`;
    } else if (isAutomatic) {
      intro =
        `The ${title} combines classic watchmaking style with a refined and versatile design. Created for ${audienceText}, it brings a polished finishing touch to everyday outfits while remaining well suited to professional settings and special occasions.`;
    } else if (isQuartz) {
      intro =
        `The ${title} combines a clean, refined design with dependable quartz movement for effortless everyday wear. Designed for ${audienceText}, it adds a polished finishing touch to professional looks, casual outfits, and special occasions.`;
    } else {
      intro =
        `The ${title} is designed for ${audienceText} who want a refined timepiece with versatile everyday appeal. Carefully considered design details create a polished look that transitions easily from work to evenings and special occasions.`;
    }
  } else {
    intro =
      `The ${title} is designed for ${audienceText} who appreciate thoughtful design and everyday versatility. Its practical details and refined appearance make it an easy addition to a well-considered lifestyle.`;
  }

  const original =
    cleanOriginalDescription(
      product.description,
    );

  let body = "";

  if (original.length >= 60) {
    body = limitCharacters(
      original,
      650,
    );
  } else if (isWatch) {
    body =
      `The carefully coordinated dial, case, and bracelet create a cohesive appearance without relying on excessive styling. The versatile design makes it easy to pair with tailored workwear, smart-casual outfits, and evening looks.`;
  } else {
    body =
      `Thoughtfully designed for versatility, this piece is easy to incorporate into everyday use while maintaining a polished appearance.`;
  }

  let features: string[] = [];

  if (isWatch) {
    if (isChronograph) {
      features.push(
        "Chronograph-inspired dial for a distinctive look",
      );
    }

    if (isQuartz) {
      features.push(
        "Quartz movement for dependable everyday timekeeping",
      );
    }

    if (isAutomatic) {
      features.push(
        "Automatic movement for a classic mechanical experience",
      );
    }

    if (/stainless steel/.test(productText)) {
      features.push(
        "Stainless steel construction",
      );
    }

    features.push(
      "Refined design suited to professional and casual styling",
    );

    features.push(
      "Versatile choice for everyday wear and special occasions",
    );
  } else {
    features.push(
      "Refined design for everyday use",
    );

    features.push(
      "Versatile styling for different occasions",
    );

    features.push(
      "Designed with practicality and presentation in mind",
    );
  }

  features = unique(features);

  const sections: string[] = [];

  sections.push(intro);
  sections.push(body);

  if (features.length > 0) {
    sections.push(
      `Key Features\n${features
        .map(
          (feature) =>
            `• ${feature}`,
        )
        .join("\n")}`,
    );
  }

  if (specifications.length > 0) {
    sections.push(
      `Specifications\n${specifications
        .map(
          (specification) =>
            `• ${specification}`,
        )
        .join("\n")}`,
    );
  }

  return sections
    .join("\n\n")
    .trim();
}

/* =========================================================
   DESCRIPTION -> SHOPIFY HTML
========================================================= */

function descriptionToHtml(
  description: string,
) {
  const paragraphs = description
    .split(/\n\s*\n/)
    .map((part) =>
      part
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter(
      (lines) => lines.length > 0,
    );

  const htmlParts: string[] = [];

  for (const lines of paragraphs) {
    if (
      lines.length > 0 &&
      /^(Key Features|Specifications)$/i.test(
        lines[0],
      )
    ) {
      const heading =
        escapeHtml(lines[0]);

      const items = lines
        .slice(1)
        .map((line) =>
          line
            .replace(/^•\s*/, "")
            .trim(),
        )
        .filter(Boolean);

      if (items.length > 0) {
        htmlParts.push(
          `<h3>${heading}</h3><ul>${items
            .map(
              (item) =>
                `<li>${escapeHtml(
                  item,
                )}</li>`,
            )
            .join("")}</ul>`,
        );
      }

      continue;
    }

    const paragraphText =
      lines
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    if (paragraphText) {
      htmlParts.push(
        `<p>${escapeHtml(
          paragraphText,
        )}</p>`,
      );
    }
  }

  return htmlParts.join("");
}

/* =========================================================
   SEO TITLE
   MAXIMUM = 50 CHARACTERS
========================================================= */

function buildSeoTitle(
  product: Product,
  title: string,
  productType: string,
) {
  const text =
    getProductText(product).toLowerCase();

  let keyword = productType;

  if (/chronograph/.test(text)) {
    keyword = "Chronograph Watch";
  } else if (/automatic/.test(text)) {
    keyword = "Automatic Watch";
  } else if (/mechanical/.test(text)) {
    keyword = "Mechanical Watch";
  } else if (/quartz/.test(text)) {
    keyword = "Quartz Watch";
  } else if (/watch|timepiece/.test(text)) {
    keyword = "Watch";
  }

  const candidate =
    `${keyword} - ${title}`;

  /*
   * SEO title target is 50 characters.
   */
  return limitCharacters(
    candidate,
    50,
  );
}

/* =========================================================
   META DESCRIPTION
   MAXIMUM = 150 CHARACTERS
   NEVER INTENTIONALLY CUT A SENTENCE
========================================================= */

function buildMetaDescription(
  product: Product,
  title: string,
  specifications: string[],
) {
  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  const productText =
    getProductText(product).toLowerCase();

  /*
   * Keep the title reasonably short inside
   * the meta description.
   */
  const shortTitle =
    limitCharacters(title, 48);

  const candidates: string[] = [];

  /*
   * Chronograph
   */
  if (/chronograph/.test(productText)) {
    candidates.push(
      `Shop the ${shortTitle} for ${audience}. Distinctive chronograph styling with versatile appeal for everyday wear and special occasions.`,
    );
  }

  /*
   * Automatic
   */
  if (/automatic/.test(productText)) {
    candidates.push(
      `Shop the ${shortTitle} for ${audience}. Classic automatic movement and refined styling for everyday wear and special occasions.`,
    );
  }

  /*
   * Quartz
   */
  if (/quartz/.test(productText)) {
    candidates.push(
      `Shop the ${shortTitle} for ${audience}. Dependable quartz movement and refined styling for everyday wear and special occasions.`,
    );
  }

  /*
   * Specification-aware option.
   *
   * Only use the specification when it is
   * short enough to keep the sentence complete.
   */
  if (specifications.length > 0) {
    const firstSpec = clean(
      specifications[0]
        .replace(/^[^:]+:\s*/, ""),
    );

    if (
      firstSpec &&
      firstSpec.length <= 28
    ) {
      candidates.push(
        `Shop the ${shortTitle} for ${audience}. Refined design with ${firstSpec.toLowerCase()} for versatile everyday wear.`,
      );
    }
  }

  /*
   * General option.
   */
  candidates.push(
    `Shop the ${shortTitle} for ${audience}. Refined design and versatile styling for everyday wear and special occasions.`,
  );

  /*
   * Shorter general option.
   */
  candidates.push(
    `Discover the ${shortTitle}, designed for ${audience} with refined style and versatile everyday appeal.`,
  );

  /*
   * Shortest complete option.
   */
  candidates.push(
    `Discover the ${shortTitle} for ${audience}. Refined style for everyday wear.`,
  );

  /*
   * Select the longest useful COMPLETE sentence
   * that fits within 150 characters.
   *
   * This prevents:
   *
   * "Features quartz"
   *
   * from being left at the end.
   */
  const validCandidates =
    candidates.filter(
      (candidate) =>
        clean(candidate).length <= 150,
    );

  if (validCandidates.length > 0) {
    return validCandidates.reduce(
      (best, current) =>
        current.length > best.length
          ? current
          : best,
    );
  }

  /*
   * If the product title itself is unusually long,
   * progressively shorten only the title.
   *
   * We do NOT cut the completed sentence.
   */
  for (
    let titleLength = 45;
    titleLength >= 20;
    titleLength -= 5
  ) {
    const shorterTitle =
      limitCharacters(
        title,
        titleLength,
      );

    const fallbackCandidates = [
      `Shop the ${shorterTitle} for ${audience}. Refined style for everyday wear and special occasions.`,
      `Discover the ${shorterTitle} for ${audience}. Refined style for everyday wear.`,
      `Shop the ${shorterTitle}. Refined style for everyday wear.`,
    ];

    const fitting =
      fallbackCandidates.filter(
        (candidate) =>
          candidate.length <= 150,
      );

    if (fitting.length > 0) {
      return fitting.reduce(
        (best, current) =>
          current.length > best.length
            ? current
            : best,
      );
    }
  }

  /*
   * Extremely safe fallback.
   */
  return "Discover refined style designed for everyday wear.";
}

/* =========================================================
   OPTIMIZER
========================================================= */

function optimizeProduct(
  product: Product,
): OptimizedProduct {
  const title =
    buildProductTitle(product);

  const productType =
    buildProductType(product);

  const tags =
    buildTags(product);

  const specifications =
    extractSpecifications(
      product.description,
      product,
    );

  const description =
    buildDescription(
      product,
      title,
      specifications,
    );

  const seoTitle =
    buildSeoTitle(
      product,
      title,
      productType,
    );

  const metaDescription =
    buildMetaDescription(
      product,
      title,
      specifications,
    );

  return {
    title,
    productType,
    tags,
    description,
    seoTitle,
    metaDescription,
    specifications,
  };
}

/* =========================================================
   PAGE
========================================================= */

export default function Page() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [optimizing, setOptimizing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [optimized, setOptimized] =
    useState<OptimizedProduct | null>(
      null,
    );

  const [title, setTitle] =
    useState("");

  const [productType, setProductType] =
    useState("");

  const [tags, setTags] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [seoTitle, setSeoTitle] =
    useState("");

  const [
    metaDescription,
    setMetaDescription,
  ] = useState("");

  const [audience, setAudience] =
    useState<Audience>("Unisex");

  const [style, setStyle] =
    useState<Style>("Everyday");

  /* =======================================================
     SHOPIFY SESSION
  ======================================================= */

  async function getSessionToken() {
    if (
      typeof window === "undefined" ||
      !window.shopify?.idToken
    ) {
      throw new Error(
        "Shopify session unavailable. Open Virello AI Optimizer from Shopify Admin.",
      );
    }

    const token =
      await window.shopify.idToken();

    if (!token) {
      throw new Error(
        "Shopify session token unavailable. Reopen the app from Shopify Admin.",
      );
    }

    return token;
  }

  /* =======================================================
     LOAD PRODUCTS
  ======================================================= */

  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const token =
        await getSessionToken();

      const response =
        await fetch(
          "/api/shopify/products",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,

              "x-shopify-session-token":
                token,
            },
            cache: "no-store",
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
          products?: ShopifyProduct[];
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to load Shopify products.",
        );
      }

      const normalized =
        Array.isArray(data.products)
          ? data.products.map(
              toProduct,
            )
          : [];

      setProducts(normalized);

      if (
        normalized.length > 0
      ) {
        setSelectedId(
          normalized[0].id,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Shopify products.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  /* =======================================================
     SELECTED PRODUCT
  ======================================================= */

  const selected =
    useMemo(
      () =>
        products.find(
          (product) =>
            product.id ===
            selectedId,
        ) || null,
      [
        products,
        selectedId,
      ],
    );

  /* =======================================================
     FILTERED PRODUCTS
  ======================================================= */

  const filteredProducts =
    useMemo(() => {
      const query =
        search
          .toLowerCase()
          .trim();

      if (!query) {
        return products;
      }

      return products.filter(
        (product) => {
          return (
            product.title
              .toLowerCase()
              .includes(query) ||
            product.productType
              .toLowerCase()
              .includes(query) ||
            product.vendor
              .toLowerCase()
              .includes(query) ||
            product.tags.some(
              (tag) =>
                tag
                  .toLowerCase()
                  .includes(query),
            )
          );
        },
      );
    }, [
      products,
      search,
    ]);

  /* =======================================================
     LOAD SELECTED PRODUCT
  ======================================================= */

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAudience(
      selected.audience,
    );

    setStyle(
      selected.style,
    );

    setTitle(
      stripHtml(
        selected.title,
      ),
    );

    setProductType(
      stripHtml(
        selected.productType,
      ),
    );

    setTags(
      selected.tags.join(", "),
    );

    /*
     * Always show clean text in textarea.
     */
    setDescription(
      stripHtml(
        selected.description,
      ),
    );

    setSeoTitle("");
    setMetaDescription("");
    setOptimized(null);
    setMessage("");
    setError("");
  }, [selected]);

  /* =======================================================
     OPTIMIZE
  ======================================================= */

  function handleOptimize() {
    if (!selected) {
      return;
    }

    setOptimizing(true);
    setError("");
    setMessage("");

    try {
      const result =
        optimizeProduct({
          ...selected,
          audience,
          style,
        });

      setOptimized(result);

      setTitle(
        result.title,
      );

      setProductType(
        result.productType,
      );

      setTags(
        result.tags.join(", "),
      );

      setDescription(
        result.description,
      );

      setSeoTitle(
        result.seoTitle,
      );

      setMetaDescription(
        result.metaDescription,
      );

      setMessage(
        "Optimization complete. Review the content before saving to Shopify.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Optimization failed.",
      );
    } finally {
      setOptimizing(false);
    }
  }

  /* =======================================================
     SAVE TO SHOPIFY
  ======================================================= */

  async function handleSave() {
    if (!selected) {
      return;
    }

    const finalTitle =
      clean(title);

    const finalProductType =
      clean(productType);

    const finalTags =
      unique(
        tags
          .split(",")
          .map(clean)
          .filter(Boolean),
      );

    /*
     * Textarea contains plain text.
     */
    const finalDescription =
      description.trim();

    /*
     * Convert plain text to Shopify HTML
     * only when saving.
     */
    const finalDescriptionHtml =
      descriptionToHtml(
        finalDescription,
      );

    const finalSeoTitle =
      clean(seoTitle);

    const finalMetaDescription =
      clean(metaDescription);

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!finalTitle) {
      setError(
        "Product Title is required.",
      );
      return;
    }

    if (!finalProductType) {
      setError(
        "Product Type is required.",
      );
      return;
    }

    if (!finalDescription) {
      setError(
        "Product Description is required.",
      );
      return;
    }

    if (!finalSeoTitle) {
      setError(
        "SEO Title is required.",
      );
      return;
    }

    if (!finalMetaDescription) {
      setError(
        "Meta Description is required.",
      );
      return;
    }

    /*
     * SEO Title = MAX 50.
     */
    if (
      finalSeoTitle.length >
      50
    ) {
      setError(
        "SEO Title must be 50 characters or fewer.",
      );
      return;
    }

    /*
     * Meta Description = MAX 150.
     */
    if (
      finalMetaDescription.length >
      150
    ) {
      setError(
        "Meta Description must be 150 characters or fewer.",
      );
      return;
    }

    if (
      finalDescriptionHtml.length ===
      0
    ) {
      setError(
        "Product Description could not be formatted.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token =
        await getSessionToken();

      const response =
        await fetch(
          "/api/shopify/save-product",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,

              "x-shopify-session-token":
                token,
            },

            body: JSON.stringify({
              productId:
                selected.id,

              title:
                finalTitle,

              productType:
                finalProductType,

              tags:
                finalTags,

              description:
                finalDescriptionHtml,

              seoTitle:
                finalSeoTitle,

              metaDescription:
                finalMetaDescription,
            }),
          },
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Shopify rejected the save.",
        );
      }

      /*
       * Keep local editor state as plain text.
       */
      setProducts(
        (current) =>
          current.map(
            (product) =>
              product.id ===
              selected.id
                ? {
                    ...product,

                    title:
                      finalTitle,

                    productType:
                      finalProductType,

                    tags:
                      finalTags,

                    description:
                      finalDescription,
                  }
                : product,
          ),
      );

      setTitle(
        finalTitle,
      );

      setProductType(
        finalProductType,
      );

      setTags(
        finalTags.join(", "),
      );

      setDescription(
        finalDescription,
      );

      setSeoTitle(
        finalSeoTitle,
      );

      setMetaDescription(
        finalMetaDescription,
      );

      setMessage(
        "Successfully saved to Shopify.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save to Shopify.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="app">
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
          background: #f5f5f5;
          color: #171717;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Arial,
            sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        .app {
          min-height: 100vh;
        }

        .header {
          min-height: 72px;
          background: #fff;
          border-bottom: 1px solid #e1e1e1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .logo {
          font-size: 19px;
          font-weight: 800;
          letter-spacing: -0.2px;
        }

        .status {
          color: #666;
          font-size: 14px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 30px 24px 70px;
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 22px;
        }

        .card {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 20px;
          overflow: hidden;
        }

        .sidebar-head {
          padding: 20px;
          border-bottom: 1px solid #e5e5e5;
        }

        .sidebar-head h2 {
          margin: 0 0 14px;
          font-size: 19px;
        }

        .search {
          width: 100%;
          padding: 13px;
          border: 1px solid #d4d4d4;
          border-radius: 12px;
          outline: none;
          background: #fff;
        }

        .products {
          max-height: 700px;
          overflow-y: auto;
          padding: 9px;
        }

        .product {
          width: 100%;
          border: 0;
          background: transparent;
          padding: 14px;
          text-align: left;
          border-radius: 13px;
          cursor: pointer;
          margin-bottom: 3px;
        }

        .product:hover {
          background: #f2f2f2;
        }

        .product.active {
          background: #171717;
          color: #fff;
        }

        .product-name {
          font-weight: 700;
          line-height: 1.35;
        }

        .product-info {
          margin-top: 5px;
          color: #777;
          font-size: 12px;
        }

        .product.active .product-info {
          color: #ccc;
        }

        .editor {
          padding: 25px;
        }

        .editor-head {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 25px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          color: #777;
          margin-top: 6px;
          line-height: 1.45;
        }

        .actions {
          display: flex;
          gap: 10px;
        }

        .button {
          border: 1px solid #d2d2d2;
          background: #fff;
          padding: 12px 17px;
          border-radius: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .button.primary {
          background: #171717;
          color: #fff;
          border-color: #171717;
        }

        .button:hover:not(:disabled) {
          opacity: 0.88;
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .notice {
          padding: 14px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 14px;
          line-height: 1.45;
        }

        .success {
          background: #edf8ef;
          border: 1px solid #cce5cf;
          color: #246b2d;
        }

        .error {
          background: #fff0f0;
          border: 1px solid #e8c5c5;
          color: #9e2020;
        }

        .image {
          display: block;
          width: 100%;
          max-height: 400px;
          object-fit: cover;
          border-radius: 16px;
          margin-bottom: 22px;
        }

        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .field {
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 800;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        input,
        textarea,
        select {
          width: 100%;
          border: 1px solid #d5d5d5;
          border-radius: 11px;
          padding: 13px;
          outline: none;
          background: #fff;
          color: #171717;
        }

        input {
          min-height: 48px;
        }

        textarea {
          min-height: 210px;
          resize: vertical;
          line-height: 1.55;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #777;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.04);
        }

        .description-textarea {
          min-height: 330px;
        }

        .counter {
          text-align: right;
          color: #777;
          font-size: 12px;
          margin-top: 5px;
        }

        .section {
          border-top: 1px solid #e5e5e5;
          margin-top: 28px;
          padding-top: 25px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .generated {
          border: 1px solid #dedede;
          border-radius: 14px;
          padding: 17px;
          margin-bottom: 12px;
          background: #fafafa;
        }

        .generated-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }

        .generated-content {
          white-space: pre-wrap;
          line-height: 1.55;
          color: #444;
        }

        .specs {
          margin: 0;
          padding-left: 20px;
          line-height: 1.7;
        }

        .empty {
          padding: 45px 20px;
          text-align: center;
          color: #777;
        }

        .small-note {
          color: #777;
          font-size: 12px;
          line-height: 1.45;
          margin-top: 7px;
        }

        @media (max-width: 950px) {
          .container {
            grid-template-columns: 1fr;
          }

          .products {
            max-height: 300px;
          }
        }

        @media (max-width: 650px) {
          .header {
            padding: 0 15px;
          }

          .logo {
            font-size: 16px;
          }

          .status {
            font-size: 12px;
          }

          .container {
            padding: 18px 12px 50px;
          }

          .editor {
            padding: 18px;
          }

          .two {
            grid-template-columns: 1fr;
          }

          .editor-head {
            display: block;
          }

          .actions {
            margin-top: 15px;
            width: 100%;
          }

          .button {
            flex: 1;
          }

          h1 {
            font-size: 25px;
          }

          .description-textarea {
            min-height: 360px;
          }
        }
      `}</style>

      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="header">
        <div className="logo">
          Virello AI Optimizer
        </div>

        <div className="status">
          {loading
            ? "Loading Shopify..."
            : `${products.length} products`}
        </div>
      </header>

      <div className="container">
        {/* =================================================
            PRODUCT LIST
        ================================================= */}

        <aside className="card">
          <div className="sidebar-head">
            <h2>
              Shopify Products
            </h2>

            <input
              className="search"
              placeholder="Search products..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />
          </div>

          {loading ? (
            <div className="empty">
              Loading products...
            </div>
          ) : filteredProducts.length ===
            0 ? (
            <div className="empty">
              No products found.
            </div>
          ) : (
            <div className="products">
              {filteredProducts.map(
                (product) => (
                  <button
                    key={
                      product.id
                    }
                    type="button"
                    className={`product ${
                      selectedId ===
                      product.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedId(
                        product.id,
                      )
                    }
                  >
                    <div className="product-name">
                      {
                        product.title
                      }
                    </div>

                    <div className="product-info">
                      {product.productType ||
                        "Product"}{" "}
                      ·{" "}
                      {product.status}
                    </div>
                  </button>
                ),
              )}
            </div>
          )}
        </aside>

        {/* =================================================
            EDITOR
        ================================================= */}

        <section className="card">
          <div className="editor">
            {!selected ? (
              <div className="empty">
                Select a Shopify
                product.
              </div>
            ) : (
              <>
                {/* -----------------------------------------
                    NOTICES
                ----------------------------------------- */}

                {message && (
                  <div className="notice success">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="notice error">
                    {error}
                  </div>
                )}

                {/* -----------------------------------------
                    EDITOR HEADER
                ----------------------------------------- */}

                <div className="editor-head">
                  <div>
                    <h1>
                      Product Optimizer
                    </h1>

                    <div className="subtitle">
                      Optimize, review,
                      and save your
                      product directly
                      to Shopify.
                    </div>
                  </div>

                  <div className="actions">
                    <button
                      type="button"
                      className="button primary"
                      disabled={
                        optimizing ||
                        saving
                      }
                      onClick={
                        handleOptimize
                      }
                    >
                      {optimizing
                        ? "Optimizing..."
                        : "Optimize"}
                    </button>

                    <button
                      type="button"
                      className="button"
                      disabled={
                        optimizing ||
                        saving
                      }
                      onClick={
                        handleSave
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save to Shopify"}
                    </button>
                  </div>
                </div>

                {/* -----------------------------------------
                    IMAGE
                ----------------------------------------- */}

                {selected.featuredImage && (
                  <img
                    className="image"
                    src={
                      selected.featuredImage
                    }
                    alt={
                      selected.title
                    }
                  />
                )}

                {/* -----------------------------------------
                    AUDIENCE / STYLE
                ----------------------------------------- */}

                <div className="two">
                  <div className="field">
                    <label>
                      Audience
                    </label>

                    <select
                      value={
                        audience
                      }
                      onChange={(
                        event,
                      ) =>
                        setAudience(
                          event.target
                            .value as Audience,
                        )
                      }
                    >
                      <option value="Women">
                        Women
                      </option>

                      <option value="Men">
                        Men
                      </option>

                      <option value="Unisex">
                        Unisex
                      </option>
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Style
                    </label>

                    <select
                      value={
                        style
                      }
                      onChange={(
                        event,
                      ) =>
                        setStyle(
                          event.target
                            .value as Style,
                        )
                      }
                    >
                      <option value="Premium / Luxury">
                        Premium /
                        Luxury
                      </option>

                      <option value="Professional">
                        Professional
                      </option>

                      <option value="Everyday">
                        Everyday
                      </option>

                      <option value="Casual">
                        Casual
                      </option>

                      <option value="Sport">
                        Sport
                      </option>

                      <option value="Gift">
                        Gift
                      </option>
                    </select>
                  </div>
                </div>

                {/* -----------------------------------------
                    PRODUCT TITLE
                ----------------------------------------- */}

                <div className="field">
                  <label>
                    Product Title
                  </label>

                  <input
                    value={title}
                    onChange={(
                      event,
                    ) =>
                      setTitle(
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                {/* -----------------------------------------
                    PRODUCT TYPE
                ----------------------------------------- */}

                <div className="field">
                  <label>
                    Product Type
                  </label>

                  <input
                    value={
                      productType
                    }
                    onChange={(
                      event,
                    ) =>
                      setProductType(
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                {/* -----------------------------------------
                    TAGS
                ----------------------------------------- */}

                <div className="field">
                  <label>
                    Tags
                  </label>

                  <input
                    value={tags}
                    onChange={(
                      event,
                    ) =>
                      setTags(
                        event.target
                          .value,
                      )
                    }
                    placeholder="watch, luxury, chronograph"
                  />

                  <div className="small-note">
                    Separate tags with
                    commas.
                  </div>
                </div>

                {/* -----------------------------------------
                    DESCRIPTION
                ----------------------------------------- */}

                <div className="field">
                  <label>
                    Product Description
                  </label>

                  <textarea
                    className="description-textarea"
                    value={
                      description
                    }
                    onChange={(
                      event,
                    ) =>
                      setDescription(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Your optimized product description will appear here..."
                  />

                  <div className="small-note">
                    The editor uses
                    clean text. HTML
                    formatting is added
                    automatically when
                    you save to Shopify.
                  </div>
                </div>

                {/* -----------------------------------------
                    GOOGLE SEO
                ----------------------------------------- */}

                <div className="section">
                  <div className="section-title">
                    Google SEO
                  </div>

                  {/* SEO TITLE MAX 50 */}

                  <div className="field">
                    <label>
                      SEO Title · Max 50
                    </label>

                    <input
                      maxLength={50}
                      value={
                        seoTitle
                      }
                      onChange={(
                        event,
                      ) =>
                        setSeoTitle(
                          event.target
                            .value,
                        )
                      }
                    />

                    <div className="counter">
                      {
                        seoTitle.length
                      }
                      /50
                    </div>
                  </div>

                  {/* META DESCRIPTION MAX 150 */}

                  <div className="field">
                    <label>
                      Meta Description ·
                      Max 150
                    </label>

                    <textarea
                      maxLength={150}
                      value={
                        metaDescription
                      }
                      onChange={(
                        event,
                      ) =>
                        setMetaDescription(
                          event.target
                            .value,
                        )
                      }
                    />

                    <div className="counter">
                      {
                        metaDescription.length
                      }
                      /150
                    </div>
                  </div>
                </div>

                {/* -----------------------------------------
                    GENERATED CONTENT
                ----------------------------------------- */}

                {optimized && (
                  <div className="section">
                    <div className="section-title">
                      Generated Content
                    </div>

                    {/* TITLE */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Product Title
                        </strong>
                      </div>

                      <div className="generated-content">
                        {
                          optimized.title
                        }
                      </div>
                    </div>

                    {/* PRODUCT TYPE */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Product Type
                        </strong>
                      </div>

                      <div className="generated-content">
                        {
                          optimized.productType
                        }
                      </div>
                    </div>

                    {/* TAGS */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Tags
                        </strong>
                      </div>

                      <div className="generated-content">
                        {optimized.tags.join(
                          ", ",
                        )}
                      </div>
                    </div>

                    {/* DESCRIPTION */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Product
                          Description
                        </strong>
                      </div>

                      <div className="generated-content">
                        {
                          optimized.description
                        }
                      </div>
                    </div>

                    {/* SPECIFICATIONS */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Specifications
                        </strong>
                      </div>

                      {optimized
                        .specifications
                        .length >
                      0 ? (
                        <ul className="specs">
                          {optimized.specifications.map(
                            (
                              spec,
                            ) => (
                              <li
                                key={
                                  spec
                                }
                              >
                                {
                                  spec
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="generated-content">
                          No explicit
                          specifications
                          were found
                          in the
                          supplied
                          Shopify
                          data.
                        </div>
                      )}
                    </div>

                    {/* SEO TITLE */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          SEO Title
                        </strong>
                      </div>

                      <div className="generated-content">
                        {
                          optimized.seoTitle
                        }
                      </div>
                    </div>

                    {/* META DESCRIPTION */}

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Meta Description
                        </strong>
                      </div>

                      <div className="generated-content">
                        {
                          optimized.metaDescription
                        }
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
