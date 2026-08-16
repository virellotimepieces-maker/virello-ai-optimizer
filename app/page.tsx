"use client";

import { useEffect, useMemo, useState } from "react";

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

type Optimized = {
  title: string;
  description: string;
  bullets: string[];
  specs: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  metaDescription: string;
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\n\s*\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
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

function uniqueWords(value: string) {
  const seen = new Set<string>();

  return clean(value)
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => {
      const normalized = word
        .toLowerCase()
        .replace(/[^a-z0-9']/g, "");

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
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

/* =========================================================
   PRODUCT HELPERS
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
  const source = `${product.title} ${product.productType} ${product.tags.join(
    " ",
  )}`.toLowerCase();

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

  if (/sport|sports|diving|diver|chronograph/.test(source)) {
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
   SPEC EXTRACTION
========================================================= */

function extractSpecs(description: string) {
  const text = stripHtml(description);

  const patterns: Array<[string, RegExp]> = [
    [
      "Movement",
      /\b(?:movement|mechanism|caliber|calibre)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Case Material",
      /\bcase\s*material\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Case Size",
      /\b(?:case\s*size|case\s*diameter|dial\s*diameter|diameter)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Water Resistance",
      /\b(?:water\s*resistance|water\s*resistant|waterproof)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Strap / Band",
      /\b(?:strap|band|bracelet)(?:\s*material)?\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Crystal",
      /\b(?:crystal|glass)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Power Reserve",
      /\bpower\s*reserve\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Dial Color",
      /\b(?:dial\s*color|dial\s*colour)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Case Color",
      /\b(?:case\s*color|case\s*colour)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Band Color",
      /\b(?:band\s*color|band\s*colour|strap\s*color|strap\s*colour)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Clasp",
      /\b(?:clasp|buckle)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
    [
      "Functions",
      /\b(?:functions|features|function)\s*[:\-]?\s*([^.;,\n]+)/i,
    ],
  ];

  const specs: string[] = [];

  for (const [label, regex] of patterns) {
    const match = text.match(regex);

    if (match?.[1]) {
      const value = clean(match[1]);

      if (value.length > 1 && value.length < 100) {
        specs.push(`${label}: ${value}`);
      }
    }
  }

  const lines = text
    .split(/\n|•|\r/)
    .map(clean)
    .filter((line) => line.length > 3 && line.length < 120);

  for (const line of lines) {
    if (/^[A-Za-z][A-Za-z /_-]{2,30}\s*[:：]\s*.+$/.test(line)) {
      const normalized = line
        .replace(/：/g, ": ")
        .replace(/\s*:\s*/, ": ");

      if (
        !specs.some(
          (item) => item.toLowerCase() === normalized.toLowerCase(),
        )
      ) {
        specs.push(normalized);
      }
    }
  }

  return specs.slice(0, 16);
}

/* =========================================================
   TITLE OPTIMIZATION
========================================================= */

function buildTitle(product: Product) {
  const watch = isWatch(product);

  let source = clean(product.title)
    .replace(
      /\b(official|wholesale|dropshipping|free shipping|cheap|hot sale|new arrival|best seller|2024|2025|2026)\b/gi,
      "",
    )
    .replace(/[|,:;()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = uniqueWords(source).filter(
    (word) =>
      !/^(watch|timepiece|men|men's|women|women's|unisex)$/i.test(word),
  );

  if (watch) {
    const gender =
      product.audience === "Women"
        ? "Women's"
        : product.audience === "Men"
          ? "Men's"
          : "Unisex";

    const base = words.slice(0, 7).join(" ");

    return clean(`${base} ${gender} Watch`) || `${gender} Watch`;
  }

  return words.slice(0, 8).join(" ") || clean(product.title) || "Product";
}

/* =========================================================
   DESCRIPTION
========================================================= */

function buildDescription(
  product: Product,
  title: string,
  specs: string[],
) {
  const original = stripHtml(product.description);

  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  let opening = isWatch(product)
    ? `${title} brings a refined, versatile presence to the wrist, designed for ${audience} who value distinctive style and everyday wearability.`
    : `${title} is designed for ${audience} with a ${product.style.toLowerCase()} look suited to everyday use.`;

  if (original.length > 60) {
    opening = `${title}. ${limit(original, 520)}`;
  }

  const specText = specs.length
    ? `\n\nSpecifications\n${specs
        .map((spec) => `• ${spec}`)
        .join("\n")}`
    : "";

  return `${limit(opening, 520)}${specText}`.trim();
}

/* =========================================================
   SELLING POINTS
========================================================= */

function buildBullets(product: Product) {
  const source = productText(product).toLowerCase();

  const bullets = isWatch(product)
    ? [
        "Refined design with a polished wrist presence",
        "Versatile styling for everyday and dressier occasions",
        "Suitable for personal wear or gifting",
        "Product details are based on the supplied listing information",
      ]
    : [
        "Clean, versatile design for everyday use",
        "Easy to style and incorporate into daily routines",
        "Practical option for personal use or gifting",
        "Product details are based on the supplied listing information",
      ];

  if (/automatic|mechanical/.test(source)) {
    bullets[2] =
      "Automatic or mechanical movement information is retained when supplied";
  }

  if (/chronograph/.test(source)) {
    bullets[1] =
      "Chronograph styling for a distinctive, versatile look";
  }

  if (/water resistance|water resistant|waterproof/.test(source)) {
    bullets[3] =
      "Water-resistance details are shown only when supplied in the listing";
  }

  return bullets;
}

/* =========================================================
   FAQ
========================================================= */

function buildFaq(
  product: Product,
  title: string,
  specs: string[],
) {
  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  return [
    {
      q: "What type of product is this?",
      a: product.productType
        ? `This is a ${clean(product.productType)}, presented as ${title}.`
        : `This product is presented as ${title}.`,
    },
    {
      q: "Who is this product designed for?",
      a: `This style is intended for ${audience} and is suitable for personal wear and everyday styling.`,
    },
    {
      q: isWatch(product)
        ? "What makes this watch versatile?"
        : "What makes this product useful?",
      a: isWatch(product)
        ? `${title} has a polished look that can work with everyday outfits as well as more refined occasions.`
        : `${title} offers a practical, ${product.style.toLowerCase()} option designed for everyday use.`,
    },
    {
      q: "What specifications are available?",
      a: specs.length
        ? `The supplied listing includes ${specs
            .slice(0, 5)
            .map((s) => s.replace(/^.*?:\s*/, ""))
            .join(", ")}. Only supplied product information is used.`
        : "Technical specifications are displayed only when they are present in the supplied product information.",
    },
    {
      q: "Can it be given as a gift?",
      a: `Yes. The ${product.style.toLowerCase()} presentation makes it suitable to consider as a gift.`,
    },
    {
      q: "Are technical claims invented by Virello?",
      a: "No. Virello only uses technical specifications found in the supplied product listing and does not invent measurements or performance claims.",
    },
  ];
}

/* =========================================================
   OPTIMIZER
========================================================= */

function optimize(product: Product): Optimized {
  const title = buildTitle(product);
  const specs = extractSpecs(product.description);
  const description = buildDescription(
    product,
    title,
    specs,
  );

  const bullets = buildBullets(product);
  const faq = buildFaq(product, title, specs);

  const seoTitle = limit(title, 50);

  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  const metaDescription = limit(
    `Shop ${title}. Explore the design and available specifications for ${audience}.`,
    150,
  );

  return {
    title,
    description,
    bullets,
    specs,
    faq,
    seoTitle,
    metaDescription,
  };
}

/* =========================================================
   DESCRIPTION HTML
========================================================= */

function descriptionToHtml(value: string) {
  const blocks = value
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (
        lines.length > 0 &&
        /^Specifications$/i.test(lines[0])
      ) {
        const items = lines
          .slice(1)
          .map((line) => line.replace(/^•\s*/, ""))
          .filter(Boolean)
          .map(
            (line) =>
              `<li>${escapeHtml(line)}</li>`,
          )
          .join("");

        return `<h3>Specifications</h3><ul>${items}</ul>`;
      }

      return `<p>${escapeHtml(block).replace(
        /\n/g,
        "<br />",
      )}</p>`;
    })
    .join("");
}

/* =========================================================
   SHOPIFY SESSION
========================================================= */

async function getSessionToken() {
  if (!window.shopify?.idToken) {
    throw new Error(
      "Open Virello from Shopify Admin so Shopify can provide a session token.",
    );
  }

  const token = await window.shopify.idToken();

  if (!token) {
    throw new Error(
      "Shopify session token is unavailable. Refresh the app inside Shopify Admin.",
    );
  }

  return token;
}

/* =========================================================
   API REQUEST
========================================================= */

async function shopifyFetch(
  path: string,
  init: RequestInit = {},
) {
  const token = await getSessionToken();

  const headers = new Headers(
    init.headers || {},
  );

  headers.set(
    "Authorization",
    `Bearer ${token}`,
  );

  headers.set(
    "X-Shopify-Session-Token",
    token,
  );

  const response = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.error ||
        `Request failed (${response.status}).`,
    );
  }

  return data;
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Page() {
  const [products, setProducts] = useState<Product[]>(
    [],
  );

  const [selectedId, setSelectedId] =
    useState("");

  const [search, setSearch] = useState("");

  const [audience, setAudience] =
    useState<Audience>("Unisex");

  const [style, setStyle] =
    useState<Style>("Premium / Luxury");

  const [title, setTitle] = useState("");

  const [description, setDescription] =
    useState("");

  const [productType, setProductType] =
    useState("");

  const [tags, setTags] = useState("");

  const [seoTitle, setSeoTitle] =
    useState("");

  const [metaDescription, setMetaDescription] =
    useState("");

  const [optimized, setOptimized] =
    useState<Optimized | null>(null);

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

  /* =======================================================
     SELECTED PRODUCT
  ======================================================= */

  const selected = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === selectedId,
      ) || null,
    [products, selectedId],
  );

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredProducts = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [
        product.title,
        product.productType,
        product.vendor,
        product.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [products, search]);

  /* =======================================================
     LOAD SHOPIFY PRODUCTS
  ======================================================= */

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const data = await shopifyFetch(
          "/api/shopify/products",
        );

        if (!active) {
          return;
        }

        const nextProducts: Product[] =
          (data.products || []).map(
            (product: ShopifyProduct) =>
              toProduct(product),
          );

        setProducts(nextProducts);

        if (nextProducts.length > 0) {
          setSelectedId(
            nextProducts[0].id,
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Shopify products.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  /* =======================================================
     LOAD SELECTED PRODUCT INTO EDITOR
  ======================================================= */

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAudience(selected.audience);
    setStyle(selected.style);
    setTitle(selected.title);
    setDescription(
      stripHtml(selected.description),
    );
    setProductType(selected.productType);
    setTags(selected.tags.join(", "));
    setSeoTitle("");
    setMetaDescription("");
    setOptimized(null);
    setMessage("");
    setError("");
  }, [selected]);

  /* =======================================================
     CURRENT EDITED PRODUCT
  ======================================================= */

  function currentProduct(): Product | null {
    if (!selected) {
      return null;
    }

    return {
      ...selected,
      audience,
      style,
      title,
      description,
      productType,
      tags: tags
        .split(",")
        .map(clean)
        .filter(Boolean),
    };
  }

  /* =======================================================
     OPTIMIZE
  ======================================================= */

  function handleOptimize() {
    const product = currentProduct();

    if (!product) {
      return;
    }

    setOptimizing(true);
    setError("");
    setMessage("");

    window.setTimeout(() => {
      try {
        const result = optimize(product);

        setOptimized(result);

        setTitle(result.title);
        setDescription(
          result.description,
        );
        setSeoTitle(
          result.seoTitle,
        );
        setMetaDescription(
          result.metaDescription,
        );

        if (!product.productType && isWatch(product)) {
          setProductType("Watches");
        }
      } finally {
        setOptimizing(false);
      }
    }, 150);
  }

  /* =======================================================
     SAVE BACK TO SHOPIFY
  ======================================================= */

  async function handleSave() {
    if (!selected) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const cleanTags = tags
        .split(",")
        .map(clean)
        .filter(Boolean);

      const data = await shopifyFetch(
        "/api/shopify/save-product",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            productId: selected.id,
            title: clean(title),
            description:
              descriptionToHtml(
                description,
              ),
            productType: clean(
              productType,
            ),
            tags: cleanTags,
            seoTitle: limit(
              seoTitle,
              50,
            ),
            metaDescription: limit(
              metaDescription,
              150,
            ),
          }),
        },
      );

      setMessage(
        data.message ||
          "Product saved to Shopify successfully.",
      );

      setProducts((current) =>
        current.map((product) =>
          product.id === selected.id
            ? {
                ...product,
                title: clean(title),
                description,
                productType:
                  clean(productType),
                tags: cleanTags,
              }
            : product,
        ),
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
     APPLY OPTIMIZED FIELD
  ======================================================= */

  function applyOptimizedField(
    field: keyof Optimized,
  ) {
    if (!optimized) {
      return;
    }

    if (field === "title") {
      setTitle(optimized.title);
    }

    if (field === "description") {
      setDescription(
        optimized.description,
      );
    }

    if (field === "seoTitle") {
      setSeoTitle(
        optimized.seoTitle,
      );
    }

    if (
      field === "metaDescription"
    ) {
      setMetaDescription(
        optimized.metaDescription,
      );
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f6f6f3;
          color: #171717;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          padding: 28px;
        }

        .shell {
          max-width: 1440px;
          margin: 0 auto;
        }

        .top {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 22px;
        }

        .brand h1 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.03em;
        }

        .brand p {
          margin: 6px 0 0;
          color: #6b6b67;
        }

        .status {
          padding: 9px 13px;
          border: 1px solid #dddcd6;
          border-radius: 999px;
          background: #fff;
          font-size: 13px;
        }

        .layout {
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 20px;
        }

        .panel {
          background: #fff;
          border: 1px solid #deddd7;
          border-radius: 18px;
          box-shadow:
            0 4px 18px rgba(0, 0, 0, 0.04);
        }

        .sidebar {
          padding: 16px;
        }

        .search {
          width: 100%;
          padding: 12px 13px;
          border: 1px solid #d8d7d0;
          border-radius: 10px;
          outline: none;
          background: #fff;
        }

        .list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          max-height: calc(100vh - 190px);
          overflow: auto;
        }

        .item {
          width: 100%;
          text-align: left;
          border: 1px solid transparent;
          background: #fafaf8;
          border-radius: 12px;
          padding: 12px;
          cursor: pointer;
        }

        .item.active {
          border-color: #191919;
          background: #f1f1ed;
        }

        .item strong {
          display: block;
          font-size: 14px;
        }

        .item span {
          display: block;
          margin-top: 4px;
          color: #77756e;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .editor {
          padding: 22px;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .toolbar h2 {
          margin: 0;
          font-size: 20px;
        }

        .actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .button {
          border: 1px solid #d0cfc8;
          border-radius: 10px;
          padding: 10px 14px;
          background: #fff;
          cursor: pointer;
          font-weight: 650;
        }

        .button.primary {
          background: #171717;
          color: #fff;
          border-color: #171717;
        }

        .button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 12px;
          font-weight: 700;
          color: #5f5e58;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .input,
        .textarea,
        .select {
          width: 100%;
          border: 1px solid #d8d7d0;
          border-radius: 10px;
          padding: 11px 12px;
          background: #fff;
          outline: none;
        }

        .textarea {
          min-height: 150px;
          resize: vertical;
        }

        .counter {
          font-size: 11px;
          color: #777;
        }

        .section {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid #e8e7e1;
        }

        .section h3 {
          margin: 0 0 12px;
          font-size: 15px;
        }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .chip {
          border: 1px solid #deddd7;
          border-radius: 999px;
          padding: 8px 10px;
          background: #fafaf8;
          font-size: 12px;
        }

        .result {
          background: #f8f8f5;
          border: 1px solid #e3e2dc;
          border-radius: 14px;
          padding: 14px;
        }

        .result + .result {
          margin-top: 10px;
        }

        .result-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .result-head strong {
          font-size: 13px;
        }

        .small {
          font-size: 12px;
          color: #6c6b65;
        }

        .error {
          margin-bottom: 14px;
          padding: 12px;
          border-radius: 10px;
          background: #fff0f0;
          color: #9d2020;
          border: 1px solid #efcaca;
        }

        .success {
          margin-bottom: 14px;
          padding: 12px;
          border-radius: 10px;
          background: #eef9ef;
          color: #176b2a;
          border: 1px solid #cbe5cf;
        }

        .empty {
          padding: 30px;
          text-align: center;
          color: #777;
        }

        .preview {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 16px;
        }

        .preview img {
          width: 160px;
          height: 160px;
          object-fit: cover;
          border-radius: 12px;
          background: #eee;
        }

        .muted {
          color: #777;
        }

        .faq {
          display: grid;
          gap: 9px;
        }

        .faq details {
          border: 1px solid #deddd7;
          border-radius: 10px;
          padding: 10px 12px;
          background: #fff;
        }

        .faq summary {
          cursor: pointer;
          font-weight: 650;
        }

        .notice {
          font-size: 12px;
          color: #6d6c66;
          margin-top: 8px;
          line-height: 1.5;
        }

        @media (max-width: 900px) {
          .page {
            padding: 14px;
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .list {
            max-height: 260px;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .preview {
            grid-template-columns: 1fr;
          }

          .preview img {
            width: 100%;
            height: 220px;
          }

          .top {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="shell">
        <header className="top">
          <div className="brand">
            <h1>
              Virello AI Optimizer
            </h1>

            <p>
              Shopify product optimization
              for Horizon Timepieces
            </p>
          </div>

          <div className="status">
            {loading
              ? "Connecting to Shopify…"
              : `${products.length} products loaded`}
          </div>
        </header>

        <div className="layout">
          <aside className="panel sidebar">
            <input
              className="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search Shopify products…"
            />

            <div className="list">
              {loading ? (
                <div className="empty">
                  Loading products…
                </div>
              ) : filteredProducts.length ===
                0 ? (
                <div className="empty">
                  No products found.
                </div>
              ) : (
                filteredProducts.map(
                  (product) => (
                    <button
                      key={product.id}
                      className={`item ${
                        product.id ===
                        selectedId
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedId(
                          product.id,
                        )
                      }
                    >
                      <strong>
                        {product.title}
                      </strong>

                      <span>
                        {product.productType ||
                          "Product"}{" "}
                        · {product.status}
                      </span>
                    </button>
                  ),
                )
              )}
            </div>
          </aside>

          <section className="panel editor">
            {error && (
              <div className="error">
                {error}
              </div>
            )}

            {message && (
              <div className="success">
                {message}
              </div>
            )}

            {!selected ? (
              <div className="empty">
                Select a Shopify product to
                begin.
              </div>
            ) : (
              <>
                <div className="toolbar">
                  <div>
                    <h2>
                      Edit product
                    </h2>

                    <div className="small">
                      Changes stay in Virello
                      until you press Save to
                      Shopify.
                    </div>
                  </div>

                  <div className="actions">
                    <button
                      className="button primary"
                      onClick={
                        handleOptimize
                      }
                      disabled={
                        optimizing
                      }
                    >
                      {optimizing
                        ? "Optimizing…"
                        : "Optimize with Virello AI"}
                    </button>

                    <button
                      className="button"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving…"
                        : "Save to Shopify"}
                    </button>
                  </div>
                </div>

                <div className="preview">
                  {selected.featuredImage ? (
                    <img
                      src={
                        selected.featuredImage
                      }
                      alt={
                        selected.title
                      }
                    />
                  ) : (
                    <div
                      className="panel"
                      style={{
                        display: "grid",
                        placeItems:
                          "center",
                        minHeight: 160,
                      }}
                    >
                      No image
                    </div>
                  )}

                  <div>
                    <strong>
                      {selected.title}
                    </strong>

                    <p className="muted">
                      {selected.vendor ||
                        "No vendor"}{" "}
                      ·{" "}
                      {selected.price
                        ? `$${selected.price}`
                        : "Price unavailable"}
                    </p>

                    <div className="chips">
                      <span className="chip">
                        {selected.status}
                      </span>

                      <span className="chip">
                        {
                          selected.images
                            .length
                        }{" "}
                        images
                      </span>
                    </div>
                  </div>
                </div>

                <div className="section">
                  <div className="grid">
                    <div className="field">
                      <label>
                        Audience
                      </label>

                      <select
                        className="select"
                        value={audience}
                        onChange={(event) =>
                          setAudience(
                            event.target
                              .value as Audience,
                          )
                        }
                      >
                        <option>
                          Women
                        </option>
                        <option>
                          Men
                        </option>
                        <option>
                          Unisex
                        </option>
                      </select>
                    </div>

                    <div className="field">
                      <label>
                        Style
                      </label>

                      <select
                        className="select"
                        value={style}
                        onChange={(event) =>
                          setStyle(
                            event.target
                              .value as Style,
                          )
                        }
                      >
                        <option>
                          Premium / Luxury
                        </option>
                        <option>
                          Professional
                        </option>
                        <option>
                          Everyday
                        </option>
                        <option>
                          Casual
                        </option>
                        <option>
                          Sport
                        </option>
                        <option>
                          Gift
                        </option>
                      </select>
                    </div>

                    <div className="field full">
                      <label>
                        Product title
                      </label>

                      <input
                        className="input"
                        value={title}
                        onChange={(event) =>
                          setTitle(
                            event.target
                              .value,
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <label>
                        Product type
                      </label>

                      <input
                        className="input"
                        value={productType}
                        onChange={(event) =>
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
                        className="input"
                        value={tags}
                        onChange={(event) =>
                          setTags(
                            event.target
                              .value,
                          )
                        }
                      />
                    </div>

                    <div className="field full">
                      <label>
                        Description
                      </label>

                      <textarea
                        className="textarea"
                        value={description}
                        onChange={(event) =>
                          setDescription(
                            event.target
                              .value,
                          )
                        }
                      />

                      <div className="counter">
                        {description.length}{" "}
                        characters
                      </div>
                    </div>
                  </div>
                </div>

                <div className="section">
                  <h3>
                    SEO
                  </h3>

                  <div className="grid">
                    <div className="field">
                      <label>
                        SEO title · max 50
                      </label>

                      <input
                        className="input"
                        maxLength={50}
                        value={seoTitle}
                        onChange={(event) =>
                          setSeoTitle(
                            event.target
                              .value,
                          )
                        }
                      />

                      <div className="counter">
                        {seoTitle.length}/50
                      </div>
                    </div>

                    <div className="field">
                      <label>
                        Meta description · max
                        150
                      </label>

                      <input
                        className="input"
                        maxLength={150}
                        value={
                          metaDescription
                        }
                        onChange={(event) =>
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
                </div>

                {optimized && (
                  <div className="section">
                    <h3>
                      Generated content
                    </h3>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Title
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            applyOptimizedField(
                              "title",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>
                        {optimized.title}
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
                            applyOptimizedField(
                              "description",
                            )
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p
                        style={{
                          whiteSpace:
                            "pre-wrap",
                        }}
                      >
                        {
                          optimized.description
                        }
                      </p>
                    </div>

                    <div className="result">
                      <strong>
                        Key selling points
                      </strong>

                      <ul>
                        {optimized.bullets.map(
                          (bullet) => (
                            <li
                              key={bullet}
                            >
                              {bullet}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="result">
                      <strong>
                        Specifications —
                        supplied data only
                      </strong>

                      {optimized.specs
                        .length ? (
                        <ul>
                          {optimized.specs.map(
                            (spec) => (
                              <li
                                key={spec}
                              >
                                {spec}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p className="small">
                          No technical
                          specifications
                          were found in
                          the supplied
                          description.
                        </p>
                      )}
                    </div>

                    <div className="result">
                      <strong>
                        FAQ
                      </strong>

                      <div className="faq">
                        {optimized.faq.map(
                          (item) => (
                            <details
                              key={item.q}
                            >
                              <summary>
                                {item.q}
                              </summary>

                              <p>
                                {item.a}
                              </p>
                            </details>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          SEO title
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            applyOptimizedField(
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
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Meta description
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            applyOptimizedField(
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
                    </div>

                    <div className="notice">
                      Virello does not invent
                      technical measurements,
                      materials, water
                      resistance, movement
                      specifications, or other
                      factual claims that are
                      not present in the supplied
                      Shopify product
                      information.
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
