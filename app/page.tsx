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

type Audience = "Women" | "Men" | "Unisex" | "All";

type Style =
  | "Premium"
  | "Professional"
  | "Everyday"
  | "Casual"
  | "Sport"
  | "Gift"
  | "General";

type Product = ShopifyProduct & {
  audience: Audience;
  style: Style;
};

type Specification = {
  label: string;
  value: string;
};

type FAQ = {
  question: string;
  answer: string;
};

type Optimized = {
  title: string;
  productType: string;
  tags: string[];
  description: string;
  specifications: Specification[];
  sellingPoints: string[];
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

function productText(product: ShopifyProduct) {
  return [
    product.title,
    product.productType,
    product.vendor,
    product.tags.join(" "),
    stripHtml(product.description),
  ].join(" ");
}

function detectAudience(product: ShopifyProduct): Audience {
  const source = productText(product).toLowerCase();

  if (/\bwomen|women's|ladies|lady\b/.test(source)) {
    return "Women";
  }

  if (/\bmen|men's|gentlemen|gents\b/.test(source)) {
    return "Men";
  }

  return "All";
}

function detectStyle(product: ShopifyProduct): Style {
  const source = productText(product).toLowerCase();

  if (
    /luxury|premium|elegant|exclusive|high[- ]?end/.test(
      source,
    )
  ) {
    return "Premium";
  }

  if (
    /sport|sports|racing|athletic|fitness|outdoor/.test(
      source,
    )
  ) {
    return "Sport";
  }

  if (
    /casual|fashion|streetwear|street/.test(source)
  ) {
    return "Casual";
  }

  if (/gift|present|gifting/.test(source)) {
    return "Gift";
  }

  if (
    /business|office|professional|formal/.test(
      source,
    )
  ) {
    return "Professional";
  }

  if (/everyday|daily|home|general/.test(source)) {
    return "Everyday";
  }

  return "General";
}

function toProduct(product: ShopifyProduct): Product {
  return {
    ...product,
    audience: detectAudience(product),
    style: detectStyle(product),
  };
}

/* =========================================================
   SPECIFICATION EXTRACTION
   IMPORTANT:
   Only use information already supplied by Shopify.
========================================================= */

const SPEC_LABELS: Record<string, string> = {
  sku: "SKU",
  brand: "Brand",
  material: "Material",
  materials: "Materials",
  color: "Color",
  colour: "Color",
  size: "Size",
  dimensions: "Dimensions",
  weight: "Weight",
  capacity: "Capacity",
  length: "Length",
  width: "Width",
  height: "Height",
  diameter: "Diameter",
  volume: "Volume",
  "product type": "Product Type",
  model: "Model",
  modelnumber: "Model Number",
  "model number": "Model Number",
  warranty: "Warranty",
  "country of origin": "Country of Origin",
  origin: "Country of Origin",
  compatibility: "Compatibility",
  "compatible with": "Compatibility",
  power: "Power",
  voltage: "Voltage",
  wattage: "Wattage",
  battery: "Battery",
  "battery life": "Battery Life",
  connectivity: "Connectivity",
  "connection type": "Connection Type",
  "water resistance": "Water Resistance",
  "water resistant": "Water Resistance",
  movement: "Movement",
  mechanism: "Movement",
  "case material": "Case Material",
  "case size": "Case Size",
  crystal: "Crystal",
  "strap material": "Strap Material",
  "band material": "Band Material",
  "dial color": "Dial Color",
  "case color": "Case Color",
  "band color": "Band Color",
  "screen size": "Screen Size",
  "storage capacity": "Storage Capacity",
  "operating system": "Operating System",
  "item dimensions": "Dimensions",
  "item weight": "Weight",
};

function normalizeSpecLabel(label: string) {
  const normalized = clean(label)
    .toLowerCase()
    .replace(/\s+/g, " ");

  return (
    SPEC_LABELS[normalized] ||
    clean(label)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      )
  );
}

function isLikelySpecificationLine(line: string) {
  const match = line.match(
    /^([A-Za-z][A-Za-z0-9 /_-]{1,45})\s*[:：]\s*(.+)$/,
  );

  if (!match) {
    return null;
  }

  const label = clean(match[1]);
  const value = clean(match[2]);

  if (!value || value.length > 250) {
    return null;
  }

  const normalizedLabel = label
    .toLowerCase()
    .replace(/\s+/g, " ");

  const known = Boolean(SPEC_LABELS[normalizedLabel]);

  const genericSpecificationWords =
    /^(spec|specs|specification|specifications|feature|features|details|details?)$/i.test(
      label,
    );

  if (genericSpecificationWords) {
    return null;
  }

  /*
   * Accept known specification labels and reasonable
   * label:value pairs from supplier/product data.
   */
  if (
    known ||
    /material|size|color|colour|weight|dimension|capacity|power|battery|voltage|compatib|warranty|model|origin|connection|movement|water|strap|band|crystal|diameter|length|width|height|volume|storage|screen|display|resolution|function|feature/i.test(
      label,
    )
  ) {
    return {
      label: normalizeSpecLabel(label),
      value,
    };
  }

  return null;
}

function extractSpecifications(
  description: string,
  product: ShopifyProduct,
) {
  const text = stripHtml(description);

  const candidates: Specification[] = [];

  const lines = text
    .split(/\n|•/)
    .map(clean)
    .filter(Boolean);

  for (const line of lines) {
    const result = isLikelySpecificationLine(line);

    if (result) {
      candidates.push(result);
    }
  }

  /*
   * Also check the original product text for common
   * supplier-style specification patterns.
   */
  const patterns: Array<[string, RegExp]> = [
    [
      "Material",
      /\bmaterial\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Color",
      /\b(?:color|colour)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Size",
      /\bsize\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Dimensions",
      /\b(?:dimensions|dimension)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Weight",
      /\bweight\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Capacity",
      /\bcapacity\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Voltage",
      /\bvoltage\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Battery",
      /\bbattery\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Compatibility",
      /\bcompatib(?:ility|le\s+with)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Warranty",
      /\bwarranty\s*[:：]\s*([^.;\n]+)/i,
    ],
  ];

  for (const [label, regex] of patterns) {
    const match = text.match(regex);

    if (match?.[1]) {
      candidates.push({
        label,
        value: clean(match[1]),
      });
    }
  }

  /*
   * Vendor is existing Shopify data, so it can be displayed
   * as a specification only when it actually exists.
   */
  if (clean(product.vendor)) {
    candidates.push({
      label: "Brand",
      value: clean(product.vendor),
    });
  }

  const seen = new Set<string>();

  return candidates.filter((item) => {
    const key =
      `${item.label}:${item.value}`.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, 20);
}

/* =========================================================
   REMOVE SPECIFICATION LINES FROM DESCRIPTION
   so specifications remain in their own section.
========================================================= */

function removeSpecificationLines(
  description: string,
) {
  const text = stripHtml(description);

  return text
    .split(/\n/)
    .map(clean)
    .filter(Boolean)
    .filter((line) => {
      return !isLikelySpecificationLine(line);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   TITLE
========================================================= */

function buildTitle(product: Product) {
  const original = clean(product.title);

  if (!original) {
    return "Product";
  }

  /*
   * Generic cleanup only.
   * No niche-specific words are inserted.
   */
  let result = original
    .replace(
      /\b(official|wholesale|dropshipping|free shipping|cheap|hot sale|hot selling|new arrival|best seller|2024|2025|2026)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  const words = result
    .split(/\s+/)
    .filter(Boolean);

  const seen = new Set<string>();

  const uniqueWords = words.filter((word) => {
    const key = word
      .toLowerCase()
      .replace(/[^\w]/g, "");

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  result = uniqueWords
    .slice(0, 10)
    .join(" ");

  return clean(result || original);
}

/* =========================================================
   PRODUCT TYPE
========================================================= */

function buildProductType(product: Product) {
  /*
   * Preserve the Shopify product type whenever it exists.
   * Do not force a niche-specific type.
   */
  return clean(product.productType) || "Product";
}

/* =========================================================
   TAGS
========================================================= */

function buildTags(product: Product) {
  const result: string[] = [];

  for (const tag of product.tags) {
    const value = clean(tag);

    if (value) {
      result.push(value);
    }
  }

  /*
   * Only add a product type when it is not already
   * represented by the existing tags.
   */
  const type = clean(product.productType);

  if (
    type &&
    !result.some(
      (tag) =>
        tag.toLowerCase() ===
        type.toLowerCase(),
    )
  ) {
    result.push(type);
  }

  return uniqueStrings(result).slice(0, 20);
}

/* =========================================================
   SELLING POINTS
========================================================= */

function buildSellingPoints(
  product: Product,
  specifications: Specification[],
) {
  const points: string[] = [];

  const original = removeSpecificationLines(
    product.description,
  );

  if (original) {
    points.push(
      limit(original, 140),
    );
  }

  /*
   * Use actual supplied specifications as selling points,
   * without inventing benefits.
   */
  for (const spec of specifications.slice(0, 4)) {
    points.push(
      `${spec.label}: ${spec.value}`,
    );
  }

  if (points.length === 0) {
    points.push(
      "Product information available from the Shopify listing.",
    );
  }

  return uniqueStrings(points).slice(0, 5);
}

/* =========================================================
   DESCRIPTION
   IMPORTANT:
   FAQ is NOT inserted here.
========================================================= */

function buildDescription(
  product: Product,
  title: string,
  sellingPoints: string[],
  specifications: Specification[],
) {
  const original = removeSpecificationLines(
    product.description,
  );

  let introduction = "";

  if (original.length >= 40) {
    introduction = limit(original, 900);
  } else {
    introduction =
      `${title} is presented with the product information supplied in the Shopify listing.`;
  }

  let html =
    `<p>${escapeHtml(introduction)}</p>`;

  if (sellingPoints.length > 0) {
    html += `<h3>Key Features</h3><ul>`;

    for (const point of sellingPoints) {
      html += `<li>${escapeHtml(point)}</li>`;
    }

    html += `</ul>`;
  }

  /*
   * Specifications are shown separately in the UI,
   * but NOT duplicated inside the description.
   */
  if (specifications.length > 0) {
    html += `<p>See the Specifications section for the product details supplied with this listing.</p>`;
  }

  return html;
}

/* =========================================================
   FAQ
   FAQ remains separate from product description.
========================================================= */

function buildFaq(
  product: Product,
  title: string,
  specifications: Specification[],
): FAQ[] {
  const type =
    clean(product.productType) ||
    "product";

  const faq: FAQ[] = [
    {
      question: "What is this product?",
      answer: `${title} is listed as a ${type}.`,
    },
    {
      question: "What information is available?",
      answer:
        specifications.length > 0
          ? `The available product information includes ${specifications
              .slice(0, 5)
              .map(
                (item) =>
                  `${item.label}: ${item.value}`,
              )
              .join("; ")}.`
          : "The Shopify listing does not contain explicit technical specifications that could be extracted.",
    },
    {
      question: "Is the product information verified?",
      answer:
        "The specifications shown by Virello are taken from the product information supplied to Shopify and are not invented by the optimizer.",
    },
  ];

  return faq;
}

/* =========================================================
   SEO
========================================================= */

function buildSeoTitle(title: string) {
  /*
   * No store name and no niche-specific text.
   */
  return limit(title, 60);
}

function buildMetaDescription(
  title: string,
  product: Product,
) {
  const type =
    clean(product.productType) ||
    "product";

  return limit(
    `Explore ${title}, a ${type} with product details and specifications based on the information supplied in the Shopify listing.`,
    155,
  );
}

/* =========================================================
   OPTIMIZER
========================================================= */

function optimize(product: Product): Optimized {
  const title = buildTitle(product);
  const productType =
    buildProductType(product);
  const tags = buildTags(product);

  const specifications =
    extractSpecifications(
      product.description,
      product,
    );

  const sellingPoints =
    buildSellingPoints(
      product,
      specifications,
    );

  const description =
    buildDescription(
      product,
      title,
      sellingPoints,
      specifications,
    );

  const faq = buildFaq(
    product,
    title,
    specifications,
  );

  return {
    title,
    productType,
    tags,
    description,
    specifications,
    sellingPoints,
    faq,
    seoTitle: buildSeoTitle(title),
    metaDescription:
      buildMetaDescription(
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
    useState<Audience>("All");

  const [style, setStyle] =
    useState<Style>("General");

  /* =======================================================
     SHOPIFY SESSION
  ======================================================= */

  async function getSessionToken() {
    if (
      typeof window === "undefined" ||
      !window.shopify?.idToken
    ) {
      throw new Error(
        "Shopify session is unavailable. Open Virello AI Optimizer from Shopify Admin.",
      );
    }

    const token =
      await window.shopify.idToken();

    if (!token) {
      throw new Error(
        "Shopify session token is unavailable. Reopen Virello AI Optimizer from Shopify Admin.",
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

      const normalized: Product[] =
        Array.isArray(result.products)
          ? result.products.map(
              (product) =>
                toProduct(product),
            )
          : [];

      setProducts(normalized);

      if (normalized.length > 0) {
        setSelectedId(
          (current) =>
            current &&
            normalized.some(
              (product) =>
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
          (product) =>
            product.id ===
            selectedId,
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
        (product) =>
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
            (tag) =>
              tag
                .toLowerCase()
                .includes(query),
          ),
      );
    }, [products, search]);

  /* =======================================================
     RESET EDITOR WHEN PRODUCT CHANGES
  ======================================================= */

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAudience(
      selected.audience,
    );

    setStyle(selected.style);

    setTitle(selected.title);

    setProductType(
      selected.productType,
    );

    setTags(
      selected.tags.join(", "),
    );

    setDescription(
      selected.description,
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
        optimize({
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

    if (field === "title") {
      setTitle(
        optimized.title,
      );
    }

    if (field === "productType") {
      setProductType(
        optimized.productType,
      );
    }

    if (field === "tags") {
      setTags(
        optimized.tags.join(", "),
      );
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
      limit(seoTitle, 60);

    const finalMetaDescription =
      limit(
        metaDescription,
        155,
      );

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

        .spec-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 10px 0;
          border-bottom: 1px solid #e5e5e5;
        }

        .spec-row:last-child {
          border-bottom: 0;
        }

        .spec-label {
          font-weight: 700;
        }

        .spec-value {
          text-align: right;
          color: #555;
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

          .spec-row {
            display: block;
          }

          .spec-value {
            text-align: left;
            margin-top: 4px;
          }
        }
      `}</style>

      {/* =====================================================
          TOP BAR
      ===================================================== */}

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

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero">
        <div className="hero-grid">
          <div>
            <h1>
              Virello AI
              <br />
              Optimizer
            </h1>

            <p>
              All-in-one Shopify product
              optimization
            </p>
          </div>

          <div className="count">
            {products.length} products loaded
          </div>
        </div>
      </section>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <section className="content">
        {/* ===================================================
            PRODUCT LIST
        =================================================== */}

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
                (product) => (
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

        {/* ===================================================
            EDITOR
        =================================================== */}

        <section className="card">
          <div className="editor">
            {!selected ? (
              <div className="empty">
                Select a Shopify product
                to begin.
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
                      Edit Product
                    </h2>

                    <p>
                      Review and edit
                      the content before
                      saving it to
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

                {/* =================================================
                    PRODUCT CONTEXT
                ================================================= */}

                <div className="grid-two">
                  <div className="field">
                    <label>
                      Audience
                    </label>

                    <select
                      value={audience}
                      onChange={(event) =>
                        setAudience(
                          event.target
                            .value as Audience,
                        )
                      }
                    >
                      <option value="All">
                        All
                      </option>

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
                      onChange={(event) =>
                        setStyle(
                          event.target
                            .value as Style,
                        )
                      }
                    >
                      <option value="General">
                        General
                      </option>

                      <option value="Premium">
                        Premium
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

                {/* =================================================
                    TITLE
                ================================================= */}

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

                {/* =================================================
                    PRODUCT TYPE
                ================================================= */}

                <div className="field">
                  <label>
                    Product Type
                  </label>

                  <input
                    value={productType}
                    onChange={(event) =>
                      setProductType(
                        event.target.value,
                      )
                    }
                  />
                </div>

                {/* =================================================
                    TAGS
                ================================================= */}

                <div className="field">
                  <label>
                    Tags
                  </label>

                  <input
                    value={tags}
                    onChange={(event) =>
                      setTags(
                        event.target.value,
                      )
                    }
                    placeholder="product tags separated by commas"
                  />
                </div>

                {/* =================================================
                    DESCRIPTION
                ================================================= */}

                <div className="field">
                  <label>
                    Product Description
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                  />
                </div>

                {/* =================================================
                    SEO
                ================================================= */}

                <div className="section">
                  <h3>
                    SEO
                  </h3>

                  <div className="field">
                    <label>
                      SEO Title · MAX 60
                    </label>

                    <input
                      value={seoTitle}
                      maxLength={60}
                      onChange={(event) =>
                        setSeoTitle(
                          event.target.value,
                        )
                      }
                    />

                    <div className="counter">
                      {
                        seoTitle.length
                      }
                      /60
                    </div>
                  </div>

                  <div className="field">
                    <label>
                      Meta Description · MAX 155
                    </label>

                    <textarea
                      value={
                        metaDescription
                      }
                      maxLength={155}
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
                      /155
                    </div>
                  </div>
                </div>

                {/* =================================================
                    GENERATED CONTENT
                ================================================= */}

                {optimized && (
                  <div className="section">
                    <h3>
                      Generated Content
                    </h3>

                    {/* TITLE */}

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Product Title
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

                    {/* PRODUCT TYPE */}

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

                    {/* TAGS */}

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

                    {/* DESCRIPTION */}

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Product Description
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

                    {/* SPECIFICATIONS */}

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Specifications
                        </strong>
                      </div>

                      {optimized
                        .specifications
                        .length > 0 ? (
                        optimized.specifications.map(
                          (
                            spec,
                            index,
                          ) => (
                            <div
                              className="spec-row"
                              key={`${spec.label}-${index}`}
                            >
                              <div className="spec-label">
                                {
                                  spec.label
                                }
                              </div>

                              <div className="spec-value">
                                {
                                  spec.value
                                }
                              </div>
                            </div>
                          ),
                        )
                      ) : (
                        <p>
                          No explicit
                          specifications
                          were found in
                          the supplied
                          Shopify product
                          information.
                        </p>
                      )}
                    </div>

                    {/* SELLING POINTS */}

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Key Selling Points
                        </strong>
                      </div>

                      <ul>
                        {optimized.sellingPoints.map(
                          (
                            point,
                            index,
                          ) => (
                            <li
                              key={
                                index
                              }
                            >
                              {point}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    {/* FAQ
                        SEPARATE — NOT PART OF DESCRIPTION
                    */}

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          FAQ
                        </strong>
                      </div>

                      {optimized.faq.map(
                        (
                          item,
                          index,
                        ) => (
                          <details
                            className="faq"
                            key={
                              index
                            }
                          >
                            <summary>
                              {
                                item.question
                              }
                            </summary>

                            <div className="faq-answer">
                              {
                                item.answer
                              }
                            </div>
                          </details>
                        ),
                      )}
                    </div>

                    {/* SEO TITLE */}

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
                        /60
                      </div>
                    </div>

                    {/* META DESCRIPTION */}

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
                        /155
                      </div>
                    </div>

                    <div className="saved-box">
                      Virello uses the
                      product information
                      supplied by Shopify.
                      It does not invent
                      missing measurements,
                      materials,
                      specifications,
                      compatibility,
                      performance claims,
                      or other technical
                      details.
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
