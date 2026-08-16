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

type ShopifyImage = {
  url: string;
  altText: string | null;
};

type ShopifyProduct = {
  id: string;
  title: string;
  description: string;
  productType: string;
  tags: string[];
  status: string;
  vendor: string;
  price: string;
  images: ShopifyImage[];
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

type FAQ = {
  q: string;
  a: string;
};

type Optimized = {
  title: string;
  productType: string;
  tags: string[];
  description: string;
  bullets: string[];
  specs: string[];
  faq: FAQ[];
  seoTitle: string;
  metaDescription: string;
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
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limit(value: string, max: number) {
  const text = clean(value);

  if (text.length <= max) {
    return text;
  }

  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");

  return cut
    .slice(0, lastSpace > 0 ? lastSpace : max)
    .replace(/[.,;:!?-]+$/, "")
    .trim();
}

function escapeHtml(value: string) {
  return value.replace(
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

function uniqueStrings(values: string[]) {
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

/* =========================================================
   PRODUCT DETECTION
========================================================= */

function productText(product: Product) {
  return [
    product.title,
    product.productType,
    product.vendor,
    product.tags.join(" "),
    product.description,
  ].join(" ");
}

function isWatch(product: Product) {
  return /watch|timepiece|chronograph|automatic|mechanical|quartz/i.test(
    productText(product),
  );
}

function detectAudience(product: ShopifyProduct): Audience {
  const source = [
    product.title,
    product.productType,
    product.tags.join(" "),
    product.description,
  ]
    .join(" ")
    .toLowerCase();

  if (/\bwomen|women's|ladies|lady\b/.test(source)) {
    return "Women";
  }

  if (/\bmen|men's|gentlemen|gents\b/.test(source)) {
    return "Men";
  }

  return "Unisex";
}

function detectStyle(product: ShopifyProduct): Style {
  const source = [
    product.title,
    product.productType,
    product.vendor,
    product.tags.join(" "),
    product.description,
  ]
    .join(" ")
    .toLowerCase();

  if (
    /luxury|premium|elegant|dress|sapphire|automatic|mechanical/.test(
      source,
    )
  ) {
    return "Premium / Luxury";
  }

  if (/sport|sports|diving|diver|chronograph|racing/.test(source)) {
    return "Sport";
  }

  if (/casual|fashion|street/.test(source)) {
    return "Casual";
  }

  if (/gift|present/.test(source)) {
    return "Gift";
  }

  if (/business|office|professional|formal/.test(source)) {
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
   SPECIFICATIONS
========================================================= */

type SpecLabel =
  | "Movement"
  | "Case Material"
  | "Case Size"
  | "Water Resistance"
  | "Strap / Band"
  | "Crystal"
  | "Power Reserve"
  | "Dial Color"
  | "Case Color"
  | "Band Color"
  | "Clasp"
  | "Functions";

const SPEC_ALIASES: Record<string, SpecLabel> = {
  movement: "Movement",
  mechanism: "Movement",
  caliber: "Movement",
  calibre: "Movement",
  "movement type": "Movement",

  "case material": "Case Material",
  "case size": "Case Size",
  "case diameter": "Case Size",
  "dial diameter": "Case Size",

  "water resistance": "Water Resistance",
  "water resistant": "Water Resistance",

  strap: "Strap / Band",
  band: "Strap / Band",
  bracelet: "Strap / Band",
  "strap material": "Strap / Band",
  "band material": "Strap / Band",

  crystal: "Crystal",
  glass: "Crystal",

  "power reserve": "Power Reserve",

  "dial color": "Dial Color",
  "dial colour": "Dial Color",

  "case color": "Case Color",
  "case colour": "Case Color",

  "band color": "Band Color",
  "band colour": "Band Color",
  "strap color": "Band Color",
  "strap colour": "Band Color",

  clasp: "Clasp",
  buckle: "Clasp",

  function: "Functions",
  functions: "Functions",
  features: "Functions",
};

function normalizeSpecLabel(value: string): SpecLabel | null {
  return SPEC_ALIASES[clean(value).toLowerCase()] || null;
}

function movementValue(value: string) {
  const match = clean(value).match(
    /\b(automatic|mechanical|quartz|solar|kinetic|manual\s+winding|self[-\s]?winding)\b/i,
  );

  return match ? clean(match[1]) : "";
}

function numericSpecValue(
  value: string,
  type: "size" | "water" | "reserve",
) {
  const source = clean(value);

  if (type === "size") {
    const match = source.match(
      /\b\d+(?:\.\d+)?\s*(?:mm|cm|in)\b/i,
    );

    return match ? clean(match[0]) : "";
  }

  if (type === "water") {
    const match = source.match(
      /\b\d+(?:\.\d+)?\s*(?:m|meter|meters|ft|feet|atm|bar)\b/i,
    );

    return match ? clean(match[0]) : "";
  }

  const match = source.match(
    /\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b/i,
  );

  return match ? clean(match[0]) : "";
}

function simpleSpecValue(value: string) {
  const result = clean(value)
    .replace(
      /\s+(?:and|with)\s+(?:a\s+)?(?:timeless|classic|elegant|stylish|premium|luxury)\b.*$/i,
      "",
    )
    .replace(
      /\s+(?:for|to)\s+(?:everyday|office|work|gifting)\b.*$/i,
      "",
    )
    .trim();

  if (!result || result.length > 80) {
    return "";
  }

  return result;
}

function parseSpecValue(label: SpecLabel, value: string) {
  switch (label) {
    case "Movement":
      return movementValue(value);

    case "Case Size":
      return numericSpecValue(value, "size");

    case "Water Resistance":
      return numericSpecValue(value, "water");

    case "Power Reserve":
      return numericSpecValue(value, "reserve");

    default:
      return simpleSpecValue(value);
  }
}

function addSpec(
  specs: string[],
  label: SpecLabel,
  rawValue: string,
) {
  const value = parseSpecValue(label, rawValue);

  if (!value) {
    return;
  }

  const item = `${label}: ${value}`;

  if (
    !specs.some(
      (existing) =>
        existing.toLowerCase() === item.toLowerCase(),
    )
  ) {
    specs.push(item);
  }
}

function extractSpecs(description: string) {
  const text = stripHtml(description);
  const specs: string[] = [];

  const lines = text
    .split(/\n|•/)
    .map(clean)
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(
      /^([A-Za-z][A-Za-z /_-]{1,35})\s*[:：-]\s*(.+)$/i,
    );

    if (!match) {
      continue;
    }

    const label = normalizeSpecLabel(match[1]);

    if (!label) {
      continue;
    }

    addSpec(specs, label, match[2]);
  }

  const patterns: Array<[SpecLabel, RegExp]> = [
    [
      "Movement",
      /\b(?:movement|mechanism|caliber|calibre)(?:\s+type)?\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Case Material",
      /\bcase\s+material\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Case Size",
      /\b(?:case\s+size|case\s+diameter|dial\s+diameter)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Water Resistance",
      /\b(?:water\s+resistance|water\s+resistant)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Strap / Band",
      /\b(?:strap|band|bracelet)(?:\s+material)?\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Crystal",
      /\b(?:crystal|glass)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Power Reserve",
      /\bpower\s+reserve\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Dial Color",
      /\bdial\s+(?:color|colour)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Case Color",
      /\bcase\s+(?:color|colour)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Band Color",
      /\b(?:band|strap)\s+(?:color|colour)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Clasp",
      /\b(?:clasp|buckle)\s*[:：-]\s*([^.;\n]+)/i,
    ],
    [
      "Functions",
      /\b(?:functions|function|features)\s*[:：-]\s*([^.;\n]+)/i,
    ],
  ];

  for (const [label, regex] of patterns) {
    const match = text.match(regex);

    if (match?.[1]) {
      addSpec(specs, label, match[1]);
    }
  }

  return uniqueStrings(specs).slice(0, 16);
}

/* =========================================================
   TITLE / PRODUCT TYPE / TAGS
========================================================= */

function removeGenericTitleWords(value: string) {
  return clean(value)
    .replace(
      /\b(official|wholesale|dropshipping|free shipping|cheap|hot sale|hot selling|new arrival|best seller|2024|2025|2026)\b/gi,
      "",
    )
    .replace(/[|,:;()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTitle(product: Product) {
  const source = removeGenericTitleWords(product.title);

  const rawWords = source.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();

  const words = rawWords.filter((word) => {
    const normalized = word
      .toLowerCase()
      .replace(/[^a-z0-9']/g, "");

    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });

  let result = words.slice(0, 7).join(" ");

  if (isWatch(product)) {
    result = result
      .replace(/\bwatch\b/gi, "")
      .replace(/\btimepiece\b/gi, "")
      .trim();

    result = `${result} Watch`;
  }

  return clean(result || product.title || "Product");
}

function buildProductType(product: Product) {
  const source = productText(product).toLowerCase();

  if (/chronograph/.test(source)) {
    return "Chronograph Watches";
  }

  if (/automatic|mechanical/.test(source)) {
    return "Automatic Watches";
  }

  if (/quartz/.test(source)) {
    return "Quartz Watches";
  }

  if (/watch|timepiece/.test(source)) {
    return "Watches";
  }

  return product.productType || "Watches";
}

function buildTags(product: Product) {
  const source = productText(product).toLowerCase();
  const tags: string[] = [];

  const add = (tag: string) => {
    const value = clean(tag);

    if (!value) {
      return;
    }

    if (
      !tags.some(
        (existing) =>
          existing.toLowerCase() === value.toLowerCase(),
      )
    ) {
      tags.push(value);
    }
  };

  if (/watch|timepiece/.test(source)) {
    add("watches");
  }

  if (/chronograph/.test(source)) {
    add("chronograph");
  }

  if (/automatic/.test(source)) {
    add("automatic watch");
  }

  if (/mechanical/.test(source)) {
    add("mechanical watch");
  }

  if (/quartz/.test(source)) {
    add("quartz watch");
  }

  if (/sport|racing/.test(source)) {
    add("sport watch");
  }

  if (/dress|elegant|formal/.test(source)) {
    add("dress watch");
  }

  if (product.audience === "Men") {
    add("men's watches");
  }

  if (product.audience === "Women") {
    add("women's watches");
  }

  if (product.audience === "Unisex") {
    add("unisex watches");
  }

  if (product.style === "Premium / Luxury") {
    add("luxury watches");
  }

  for (const tag of product.tags) {
    add(tag);
  }

  return tags.slice(0, 15);
}

/* =========================================================
   DESCRIPTION
========================================================= */

function removeExistingSpecLines(value: string) {
  const text = stripHtml(value);

  const lines = text
    .split(/\n|•/)
    .map(clean)
    .filter(Boolean);

  const result: string[] = [];

  for (const line of lines) {
    if (/^specifications?$/i.test(line)) {
      continue;
    }

    const match = line.match(
      /^([A-Za-z][A-Za-z /_-]{1,35})\s*[:：-]\s*(.+)$/i,
    );

    if (match && normalizeSpecLabel(match[1])) {
      continue;
    }

    result.push(line);
  }

  return clean(result.join(" "));
}

function buildDescription(
  product: Product,
  title: string,
  specs: string[],
  bullets: string[],
  faq: FAQ[],
) {
  const original = removeExistingSpecLines(
    product.description,
  );

  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  let introduction = "";

  if (original.length >= 50) {
    introduction = limit(original, 650);
  } else if (isWatch(product)) {
    introduction =
      `${title} brings a refined, versatile look to the wrist for ${audience} who appreciate distinctive watch design.`;
  } else {
    introduction =
      `${title} offers a practical and refined option for ${audience}.`;
  }

  let html = `<p>${escapeHtml(introduction)}</p>`;

  if (bullets.length > 0) {
    html += `<h3>Key Features</h3><ul>`;

    for (const bullet of bullets) {
      html += `<li>${escapeHtml(bullet)}</li>`;
    }

    html += `</ul>`;
  }

  if (specs.length > 0) {
    html += `<h3>Specifications</h3><ul>`;

    for (const spec of specs) {
      html += `<li>${escapeHtml(spec)}</li>`;
    }

    html += `</ul>`;
  }

  if (faq.length > 0) {
    html += `<h3>FAQ</h3>`;

    for (const item of faq) {
      html += `<p><strong>${escapeHtml(
        item.q,
      )}</strong><br />${escapeHtml(item.a)}</p>`;
    }
  }

  return html;
}

/* =========================================================
   BULLETS / FAQ / SEO
========================================================= */

function buildBullets(product: Product) {
  const bullets: string[] = [];

  if (isWatch(product)) {
    bullets.push(
      "Refined design with a polished wrist presence",
    );

    if (/chronograph/i.test(productText(product))) {
      bullets.push(
        "Chronograph styling for a distinctive, versatile look",
      );
    }

    if (/automatic|mechanical/i.test(productText(product))) {
      bullets.push(
        "Movement information presented only from supplied product data",
      );
    }

    bullets.push(
      "Suitable for personal wear or gifting",
    );
  } else {
    bullets.push(
      "Clean design suited to everyday use",
    );

    bullets.push(
      "Practical styling for versatile use",
    );

    bullets.push(
      "Suitable for personal use or gifting",
    );
  }

  return bullets.slice(0, 5);
}

function buildFaq(
  product: Product,
  title: string,
  specs: string[],
): FAQ[] {
  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  return [
    {
      q: "What type of product is this?",
      a: isWatch(product)
        ? `${title} is a watch designed for ${audience}.`
        : `${title} is a product designed for ${audience}.`,
    },
    {
      q: "Who is this product designed for?",
      a: `This product is positioned for ${audience}, based on the supplied product information.`,
    },
    {
      q: "What specifications are available?",
      a:
        specs.length > 0
          ? `The supplied listing includes: ${specs.join("; ")}.`
          : "No explicit technical specifications were found in the supplied Shopify product data.",
    },
    {
      q: "Can it be given as a gift?",
      a: "Yes. The product can be considered for gifting based on its presentation and intended use.",
    },
  ];
}

function buildSeoTitle(title: string) {
  const candidates = [
    `${title} | Horizon Timepieces`,
    `${title} - Horizon Timepieces`,
    title,
  ];

  for (const candidate of candidates) {
    if (candidate.length <= 50) {
      return clean(candidate);
    }
  }

  return limit(title, 50);
}

function buildMetaDescription(
  title: string,
  product: Product,
) {
  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  return limit(
    `Shop ${title}. Explore refined watch style for ${audience}, with product details and specifications based on supplied data.`,
    150,
  );
}

/* =========================================================
   OPTIMIZER
========================================================= */

function optimize(product: Product): Optimized {
  const title = buildTitle(product);
  const productType = buildProductType(product);
  const tags = buildTags(product);
  const specs = extractSpecs(product.description);
  const bullets = buildBullets(product);
  const faq = buildFaq(product, title, specs);

  const description = buildDescription(
    product,
    title,
    specs,
    bullets,
    faq,
  );

  return {
    title,
    productType,
    tags,
    description,
    bullets,
    specs,
    faq,
    seoTitle: buildSeoTitle(title),
    metaDescription: buildMetaDescription(
      title,
      product,
    ),
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

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [optimized, setOptimized] =
    useState<Optimized | null>(null);

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

  const [metaDescription, setMetaDescription] =
    useState("");

  const [audience, setAudience] =
    useState<Audience>("Unisex");

  const [style, setStyle] =
    useState<Style>("Everyday");

  /* =======================================================
     SESSION
  ======================================================= */

  async function getSessionToken() {
    if (
      typeof window === "undefined" ||
      !window.shopify?.idToken
    ) {
      throw new Error(
        "Shopify session is unavailable. Open Virello from Shopify Admin.",
      );
    }

    const token =
      await window.shopify.idToken();

    if (!token) {
      throw new Error(
        "Shopify session token is unavailable. Reopen Virello from Shopify Admin.",
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
              Authorization: `Bearer ${token}`,
              "x-shopify-session-token": token,
            },
            cache: "no-store",
          },
        );

      const data: unknown =
        await response.json();

      const result = data as {
        success?: boolean;
        error?: string;
        products?: ShopifyProduct[];
      };

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Unable to load Shopify products.",
        );
      }

      /*
       * FIX:
       * Explicitly type the Shopify response
       * before mapping. This prevents the
       * implicit-any error from Vercel.
       */
      const normalized: Product[] =
        Array.isArray(result.products)
          ? result.products.map(
              (
                product: ShopifyProduct,
              ): Product =>
                toProduct(product),
            )
          : [];

      setProducts(normalized);

      if (normalized.length > 0) {
        setSelectedId((current) =>
          current &&
          normalized.some(
            (
              product: Product,
            ) =>
              product.id === current,
          )
            ? current
            : normalized[0].id,
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
    loadProducts();
  }, []);

  /* =======================================================
     SELECTED PRODUCT
  ======================================================= */

  const selected =
    useMemo(
      () =>
        products.find(
          (
            product: Product,
          ) =>
            product.id === selectedId,
        ) || null,
      [products, selectedId],
    );

  const filteredProducts =
    useMemo(() => {
      const query =
        search.toLowerCase().trim();

      if (!query) {
        return products;
      }

      return products.filter(
        (
          product: Product,
        ) =>
          product.title
            .toLowerCase()
            .includes(query) ||
          product.vendor
            .toLowerCase()
            .includes(query) ||
          product.productType
            .toLowerCase()
            .includes(query) ||
          product.tags.some(
            (
              tag: string,
            ) =>
              tag
                .toLowerCase()
                .includes(query),
          ),
      );
    }, [products, search]);

  /* =======================================================
     RESET EDITOR
  ======================================================= */

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAudience(selected.audience);
    setStyle(selected.style);
    setTitle(selected.title);
    setProductType(selected.productType);
    setTags(selected.tags.join(", "));
    setDescription(selected.description);

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
      const result = optimize({
        ...selected,
        audience,
        style,
      });

      setOptimized(result);

      setMessage(
        "Optimization complete. Review the generated content before saving.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to optimize product.",
      );
    } finally {
      setOptimizing(false);
    }
  }

  /* =======================================================
     USE GENERATED CONTENT
  ======================================================= */

  function useGenerated(
    field:
      | "title"
      | "productType"
      | "tags"
      | "description"
      | "seoTitle"
      | "metaDescription",
  ) {
    if (!optimized) {
      return;
    }

    switch (field) {
      case "title":
        setTitle(optimized.title);
        break;

      case "productType":
        setProductType(
          optimized.productType,
        );
        break;

      case "tags":
        setTags(
          optimized.tags.join(", "),
        );
        break;

      case "description":
        setDescription(
          optimized.description,
        );
        break;

      case "seoTitle":
        setSeoTitle(
          optimized.seoTitle,
        );
        break;

      case "metaDescription":
        setMetaDescription(
          optimized.metaDescription,
        );
        break;
    }

    setMessage(
      "Generated content applied. Press Save to Shopify when ready.",
    );
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
      uniqueStrings(
        tags
          .split(",")
          .map(clean)
          .filter(Boolean),
      );

    const finalDescription =
      description.trim();

    const finalSeoTitle =
      limit(seoTitle, 50);

    const finalMetaDescription =
      limit(metaDescription, 150);

    if (!finalTitle) {
      setError(
        "Product title is required.",
      );
      return;
    }

    if (!finalDescription) {
      setError(
        "Product description is required.",
      );
      return;
    }

    if (finalSeoTitle.length > 50) {
      setError(
        "SEO title must be 50 characters or fewer.",
      );
      return;
    }

    if (
      finalMetaDescription.length >
      150
    ) {
      setError(
        "Meta description must be 150 characters or fewer.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token =
        await getSessionToken();

      const payload = {
        productId:
          selected.id,

        title:
          finalTitle,

        productType:
          finalProductType,

        tags:
          finalTags,

        description:
          finalDescription,

        seoTitle:
          finalSeoTitle,

        metaDescription:
          finalMetaDescription,
      };

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

            body: JSON.stringify(
              payload,
            ),
          },
        );

      const data: unknown =
        await response.json();

      const result = data as {
        success?: boolean;
        error?: string;
      };

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Shopify rejected the product save.",
        );
      }

      setProducts(
        (
          current: Product[],
        ) =>
          current.map(
            (
              product: Product,
            ) =>
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

      setTitle(finalTitle);

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
        "Saved successfully to Shopify.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save product to Shopify.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f4f5f7;
          color: #171717;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Helvetica,
            Arial,
            sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        .page {
          min-height: 100vh;
          background: #f4f5f7;
          padding-bottom: 80px;
        }

        .topbar {
          min-height: 76px;
          background: #fff;
          border-bottom: 1px solid #e3e3e3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 19px;
          font-weight: 700;
        }

        .brand-icon {
          width: 34px;
          height: 34px;
          border: 1px solid #d5d5d5;
          border-radius: 9px;
          display: grid;
          place-items: center;
        }

        .status {
          color: #666;
          font-size: 14px;
        }

        .hero {
          max-width: 1400px;
          margin: 0 auto;
          padding: 42px 28px 24px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 28px;
          align-items: end;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(38px, 6vw, 64px);
          line-height: 0.98;
          letter-spacing: -2.5px;
        }

        .hero p {
          margin: 12px 0 0;
          color: #666;
          font-size: 18px;
        }

        .count {
          justify-self: end;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 999px;
          padding: 12px 18px;
          color: #555;
        }

        .content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 28px;
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: 24px;
        }

        .card {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 24px;
          overflow: hidden;
        }

        .card-header {
          padding: 22px;
          border-bottom: 1px solid #e8e8e8;
        }

        .card-header h2 {
          margin: 0 0 14px;
          font-size: 20px;
        }

        .search,
        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #d6d6d6;
          background: #fff;
          border-radius: 14px;
          padding: 14px;
          outline: none;
        }

        .search:focus,
        .field input:focus,
        .field textarea:focus,
        .field select:focus {
          border-color: #777;
        }

        .product-list {
          max-height: 720px;
          overflow-y: auto;
          padding: 10px;
        }

        .product-row {
          width: 100%;
          border: 0;
          background: transparent;
          text-align: left;
          border-radius: 16px;
          padding: 15px;
          cursor: pointer;
          margin-bottom: 4px;
        }

        .product-row:hover {
          background: #f5f5f5;
        }

        .product-row.active {
          background: #171717;
          color: #fff;
        }

        .product-name {
          font-weight: 700;
          line-height: 1.3;
        }

        .product-meta {
          margin-top: 5px;
          font-size: 13px;
          color: #777;
        }

        .product-row.active .product-meta {
          color: #cfcfcf;
        }

        .editor {
          padding: 24px;
        }

        .notice {
          border-radius: 16px;
          padding: 15px 17px;
          margin-bottom: 20px;
          line-height: 1.45;
          font-size: 14px;
        }

        .notice.success {
          background: #eef9f0;
          border: 1px solid #cde5d0;
          color: #236b2d;
        }

        .notice.error {
          background: #fff1f1;
          border: 1px solid #efc8c8;
          color: #a12525;
        }

        .editor-title {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .editor-title h2 {
          margin: 0;
          font-size: 27px;
        }

        .editor-title p {
          margin: 5px 0 0;
          color: #777;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .button {
          border: 1px solid #d2d2d2;
          background: #fff;
          color: #171717;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 700;
          cursor: pointer;
        }

        .button:hover {
          background: #f6f6f6;
        }

        .button.primary {
          background: #171717;
          color: #fff;
          border-color: #171717;
        }

        .button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .image-wrap {
          border-radius: 20px;
          overflow: hidden;
          background: #f2f2f2;
          margin-bottom: 25px;
        }

        .image-wrap img {
          width: 100%;
          max-height: 430px;
          object-fit: cover;
          display: block;
        }

        .grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .field textarea {
          min-height: 160px;
          resize: vertical;
          line-height: 1.5;
        }

        .counter {
          margin-top: 5px;
          color: #777;
          font-size: 12px;
          text-align: right;
        }

        .section {
          margin-top: 28px;
          padding-top: 26px;
          border-top: 1px solid #e7e7e7;
        }

        .section h3 {
          margin: 0 0 16px;
          font-size: 20px;
        }

        .result {
          border: 1px solid #dedede;
          background: #fafaf8;
          border-radius: 18px;
          padding: 18px;
          margin-bottom: 14px;
        }

        .result-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 12px;
        }

        .result p {
          margin: 0;
          line-height: 1.55;
        }

        .result ul {
          margin: 0;
          padding-left: 22px;
          line-height: 1.6;
        }

        .faq {
          border: 1px solid #ddd;
          border-radius: 14px;
          background: white;
          margin-bottom: 9px;
          overflow: hidden;
        }

        .faq summary {
          padding: 15px 17px;
          cursor: pointer;
          font-weight: 700;
        }

        .faq-answer {
          padding: 0 17px 17px;
          color: #666;
          line-height: 1.5;
        }

        .empty,
        .loading {
          padding: 45px 20px;
          text-align: center;
          color: #777;
        }

        .saved-box {
          margin-top: 25px;
          padding: 18px;
          border-radius: 16px;
          background: #f5f5f5;
          color: #555;
          font-size: 14px;
          line-height: 1.5;
        }

        @media (max-width: 1000px) {
          .content {
            grid-template-columns: 1fr;
          }

          .product-list {
            max-height: 320px;
          }

          .hero-grid {
            grid-template-columns: 1fr;
          }

          .count {
            justify-self: start;
          }
        }

        @media (max-width: 700px) {
          .topbar {
            padding: 0 16px;
          }

          .hero {
            padding: 30px 16px 20px;
          }

          .content {
            padding: 0 16px;
          }

          .hero h1 {
            font-size: 44px;
          }

          .grid-two {
            grid-template-columns: 1fr;
          }

          .editor {
            padding: 18px;
          }

          .editor-title {
            display: block;
          }

          .actions {
            margin-top: 16px;
          }

          .actions .button {
            flex: 1;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            ✦
          </div>

          <span>
            Virello AI Optimizer
          </span>
        </div>

        <div className="status">
          {loading
            ? "Loading Shopify..."
            : `${products.length} products`}
        </div>
      </header>

      <section className="hero">
        <div className="hero-grid">
          <div>
            <h1>
              Virello AI
              <br />
              Optimizer
            </h1>

            <p>
              Shopify product optimization
              for Horizon Timepieces
            </p>
          </div>

          <div className="count">
            {products.length} products loaded
          </div>
        </div>
      </section>

      <section className="content">
        <aside className="card">
          <div className="card-header">
            <h2>
              Shopify Products
            </h2>

            <input
              className="search"
              placeholder="Search Shopify products..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />
          </div>

          {loading ? (
            <div className="loading">
              Loading products...
            </div>
          ) : filteredProducts.length ===
            0 ? (
            <div className="empty">
              No Shopify products found.
            </div>
          ) : (
            <div className="product-list">
              {filteredProducts.map(
                (
                  product: Product,
                ) => (
                  <button
                    key={product.id}
                    className={`product-row ${
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
                      {product.title}
                    </div>

                    <div className="product-meta">
                      {product.productType ||
                        "Product"}{" "}
                      · {product.status}
                    </div>
                  </button>
                ),
              )}
            </div>
          )}
        </aside>

        <section className="card">
          <div className="editor">
            {!selected ? (
              <div className="empty">
                Select a Shopify product to begin.
              </div>
            ) : (
              <>
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

                <div className="editor-title">
                  <div>
                    <h2>
                      Edit product
                    </h2>

                    <p>
                      Changes stay in
                      Virello until you
                      press Save to
                      Shopify.
                    </p>
                  </div>

                  <div className="actions">
                    <button
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
                        : "Optimize with Virello AI"}
                    </button>

                    <button
                      className="button"
                      disabled={
                        saving ||
                        optimizing
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

                {selected.featuredImage && (
                  <div className="image-wrap">
                    <img
                      src={
                        selected.featuredImage
                      }
                      alt={
                        selected.title
                      }
                    />
                  </div>
                )}

                <div className="grid-two">
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
                          event
                            .target
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
                      value={style}
                      onChange={(
                        event,
                      ) =>
                        setStyle(
                          event
                            .target
                            .value as Style,
                        )
                      }
                    >
                      <option value="Premium / Luxury">
                        Premium / Luxury
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

                <div className="field">
                  <label>
                    Product Title
                  </label>

                  <input
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                  />
                </div>

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

                <div className="field">
                  <label>
                    Tags
                  </label>

                  <input
                    value={tags}
                    onChange={(event) =>
                      setTags(
                        event.target
                          .value,
                      )
                    }
                    placeholder="watches, chronograph, luxury watches"
                  />
                </div>

                <div className="field">
                  <label>
                    Description
                  </label>

                  <textarea
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
                  />
                </div>

                <div className="section">
                  <h3>
                    SEO
                  </h3>

                  <div className="field">
                    <label>
                      SEO Title · MAX 50
                    </label>

                    <input
                      value={
                        seoTitle
                      }
                      maxLength={50}
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

                  <div className="field">
                    <label>
                      Meta Description · MAX 150
                    </label>

                    <textarea
                      value={
                        metaDescription
                      }
                      maxLength={
                        150
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

                {optimized && (
                  <div className="section">
                    <h3>
                      Generated Content
                    </h3>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Title
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated(
                              "title",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {
                          optimized.title
                        }
                      </p>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Product Type
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated(
                              "productType",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {
                          optimized.productType
                        }
                      </p>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Tags
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated(
                              "tags",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {optimized.tags.join(
                          ", ",
                        )}
                      </p>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Description
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated(
                              "description",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {stripHtml(
                          optimized.description,
                        )}
                      </p>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Specifications
                        </strong>
                      </div>

                      {optimized.specs
                        .length >
                      0 ? (
                        <ul>
                          {optimized.specs.map(
                            (
                              spec: string,
                              index: number,
                            ) => (
                              <li
                                key={
                                  index
                                }
                              >
                                {spec}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p>
                          No explicit
                          technical
                          specifications
                          were found in
                          the supplied
                          Shopify data.
                        </p>
                      )}
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Key Selling Points
                        </strong>
                      </div>

                      <ul>
                        {optimized.bullets.map(
                          (
                            bullet: string,
                            index: number,
                          ) => (
                            <li
                              key={
                                index
                              }
                            >
                              {bullet}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          FAQ
                        </strong>
                      </div>

                      {optimized.faq.map(
                        (
                          item: FAQ,
                          index: number,
                        ) => (
                          <details
                            className="faq"
                            key={
                              index
                            }
                          >
                            <summary>
                              {item.q}
                            </summary>

                            <div className="faq-answer">
                              {item.a}
                            </div>
                          </details>
                        ),
                      )}
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          SEO Title
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated(
                              "seoTitle",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {
                          optimized.seoTitle
                        }
                      </p>

                      <div className="counter">
                        {
                          optimized
                            .seoTitle
                            .length
                        }
                        /50
                      </div>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Meta Description
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated(
                              "metaDescription",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {
                          optimized.metaDescription
                        }
                      </p>

                      <div className="counter">
                        {
                          optimized
                            .metaDescription
                            .length
                        }
                        /150
                      </div>
                    </div>

                    <div className="saved-box">
                      Technical
                      specifications are
                      taken only from the
                      supplied product
                      information. Virello
                      does not invent missing
                      measurements, materials,
                      movement specifications,
                      water resistance, or
                      performance claims.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
