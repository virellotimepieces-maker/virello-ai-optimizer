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
  | "Premium"
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
  specs: string[];
};

/* =========================================================
   HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
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

function limit(value: string, max: number): string {
  const text = clean(value);

  if (text.length <= max) return text;

  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");

  return cut
    .slice(0, space > 0 ? space : max)
    .replace(/[.,;:!?-]+$/, "")
    .trim();
}

function escapeHtml(value: string): string {
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

function uniqueStrings(values: string[]): string[] {
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

function productText(product: ShopifyProduct): string {
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

  if (/\bwomen\b|\bwomen's\b|\bladies\b|\blady\b/.test(source)) {
    return "Women";
  }

  if (/\bmen\b|\bmen's\b|\bgents\b|\bgentlemen\b/.test(source)) {
    return "Men";
  }

  return "Unisex";
}

function detectStyle(product: ShopifyProduct): Style {
  const source = productText(product).toLowerCase();

  if (
    /luxury|premium|elegant|sapphire|automatic|mechanical|formal/.test(
      source,
    )
  ) {
    return "Premium";
  }

  if (/sport|sports|racing|diving|outdoor|fitness/.test(source)) {
    return "Sport";
  }

  if (/office|business|professional|work/.test(source)) {
    return "Professional";
  }

  if (/gift|present/.test(source)) {
    return "Gift";
  }

  if (/casual|fashion|street/.test(source)) {
    return "Casual";
  }

  return "Everyday";
}

function normalizeProduct(product: ShopifyProduct): Product {
  return {
    ...product,
    audience: detectAudience(product),
    style: detectStyle(product),
  };
}

/* =========================================================
   SPECIFICATION EXTRACTION
   ONLY USE INFORMATION ALREADY SUPPLIED
========================================================= */

const SPEC_LABELS = [
  "Material",
  "Color",
  "Colour",
  "Size",
  "Dimensions",
  "Length",
  "Width",
  "Height",
  "Weight",
  "Capacity",
  "Volume",
  "Movement",
  "Case Material",
  "Case Size",
  "Water Resistance",
  "Strap Material",
  "Band Material",
  "Crystal",
  "Power Reserve",
  "Dial Color",
  "Dial Colour",
  "Case Color",
  "Case Colour",
  "Band Color",
  "Band Colour",
  "Clasp",
  "Battery",
  "Voltage",
  "Wattage",
  "Compatibility",
  "Model",
  "Style",
  "Features",
  "Functions",
];

function normalizeLabel(value: string): string {
  const normalized = clean(value).toLowerCase();

  const aliases: Record<string, string> = {
    colour: "Color",
    material: "Material",
    mechanism: "Movement",
    caliber: "Movement",
    calibre: "Movement",
    glass: "Crystal",
    strap: "Strap Material",
    band: "Band Material",
    bracelet: "Band Material",
    features: "Features",
    function: "Functions",
  };

  return (
    aliases[normalized] ||
    SPEC_LABELS.find(
      (label) => label.toLowerCase() === normalized,
    ) ||
    clean(value)
  );
}

function extractSpecifications(description: string): string[] {
  const text = stripHtml(description);

  if (!text) return [];

  const results: string[] = [];

  const lines = text
    .split(/\n|•|·/)
    .map(clean)
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(
      /^([A-Za-z][A-Za-z0-9 /_-]{1,40})\s*[:：]\s*(.+)$/i,
    );

    if (!match) continue;

    const label = normalizeLabel(match[1]);
    const value = clean(match[2]);

    if (!value || value.length > 150) continue;

    results.push(`${label}: ${value}`);
  }

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
      /\bdimensions?\s*[:：]\s*([^.;\n]+)/i,
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
      "Movement",
      /\b(?:movement|mechanism|caliber|calibre)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Case Material",
      /\bcase\s+material\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Case Size",
      /\b(?:case\s+size|case\s+diameter)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Water Resistance",
      /\b(?:water\s+resistance|water\s+resistant)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Strap Material",
      /\bstrap\s+material\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Band Material",
      /\bband\s+material\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Crystal",
      /\b(?:crystal|glass)\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Power Reserve",
      /\bpower\s+reserve\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Battery",
      /\bbattery\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Voltage",
      /\bvoltage\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Wattage",
      /\bwattage\s*[:：]\s*([^.;\n]+)/i,
    ],
    [
      "Compatibility",
      /\bcompatibility\s*[:：]\s*([^.;\n]+)/i,
    ],
  ];

  for (const [label, regex] of patterns) {
    const match = text.match(regex);

    if (match?.[1]) {
      results.push(`${label}: ${clean(match[1])}`);
    }
  }

  return uniqueStrings(results).slice(0, 20);
}

/* =========================================================
   TITLE
   NO ARBITRARY WATCH-ONLY LOGIC
========================================================= */

function buildTitle(product: Product): string {
  const source = clean(product.title);

  if (!source) {
    return "Product";
  }

  const words = source
    .replace(
      /\b(official|wholesale|dropshipping|cheap|free shipping|hot sale|hot selling|new arrival|best seller|2024|2025|2026)\b/gi,
      "",
    )
    .replace(/[|,:;()[\]{}]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const result: string[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    const key = word
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(word);
  }

  /*
   * Keep the original product meaning.
   * No artificial 6/7 word limit.
   */
  return clean(result.join(" ")) || source;
}

/* =========================================================
   PRODUCT TYPE
   DO NOT FORCE WATCHES
========================================================= */

function buildProductType(product: Product): string {
  const existing = clean(product.productType);

  if (existing) {
    return existing;
  }

  const source = productText(product).toLowerCase();

  if (/watch|timepiece/.test(source)) return "Watches";
  if (/shirt|blouse|top/.test(source)) return "Tops";
  if (/dress/.test(source)) return "Dresses";
  if (/shoe|sneaker|footwear/.test(source)) return "Footwear";
  if (/bag|handbag|purse/.test(source)) return "Bags";
  if (/jewelry|jewellery|necklace|bracelet|ring|earring/.test(source)) {
    return "Jewelry";
  }

  return "Products";
}

/* =========================================================
   TAGS
   PRESERVE EXISTING TAGS + REMOVE DUPLICATES
========================================================= */

function buildTags(product: Product): string[] {
  const source = productText(product).toLowerCase();

  const tags: string[] = [];

  const add = (value: string) => {
    const tag = clean(value);

    if (tag) tags.push(tag);
  };

  /*
   * Existing Shopify tags remain.
   * We only remove duplicates.
   */
  product.tags.forEach(add);

  /*
   * Add useful category tags only when clearly
   * supported by the existing product information.
   */

  if (/watch|timepiece/.test(source)) add("watches");
  if (/chronograph/.test(source)) add("chronograph");
  if (/automatic/.test(source)) add("automatic");
  if (/mechanical/.test(source)) add("mechanical");
  if (/quartz/.test(source)) add("quartz");

  if (product.audience === "Men") add("men");
  if (product.audience === "Women") add("women");
  if (product.audience === "Unisex") add("unisex");

  return uniqueStrings(tags).slice(0, 20);
}

/* =========================================================
   DESCRIPTION
   NO FAQ
   NO DUPLICATE DESCRIPTION
========================================================= */

function removeSpecificationLines(text: string): string {
  const lines = text
    .split(/\n|•/)
    .map(clean)
    .filter(Boolean);

  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(
      /^([A-Za-z][A-Za-z0-9 /_-]{1,40})\s*[:：]\s*(.+)$/i,
    );

    if (match) {
      const label = match[1].toLowerCase();

      const isSpec = SPEC_LABELS.some(
        (item) => item.toLowerCase() === label,
      );

      if (isSpec) continue;
    }

    result.push(line);
  }

  return result.join(" ").replace(/\s+/g, " ").trim();
}

function buildDescription(
  product: Product,
  title: string,
  specs: string[],
): string {
  const original = removeSpecificationLines(
    stripHtml(product.description),
  );

  /*
   * If the supplier already supplied a meaningful
   * description, improve the readability without
   * replacing it with unrelated invented claims.
   */

  let intro = original;

  if (!intro) {
    intro = `${title} is designed for versatile everyday use, with details presented from the supplied product information.`;
  }

  /*
   * Prevent duplicated title/description.
   */
  const normalizedTitle = title.toLowerCase();

  if (
    intro.toLowerCase() === normalizedTitle ||
    intro.length < 20
  ) {
    intro = `${title} is designed for versatile everyday use.`;
  }

  let html = `<p>${escapeHtml(
    limit(intro, 1200),
  )}</p>`;

  if (specs.length > 0) {
    html += `<h3>Specifications</h3><ul>`;

    for (const spec of specs) {
      html += `<li>${escapeHtml(spec)}</li>`;
    }

    html += `</ul>`;
  }

  return html;
}

/* =========================================================
   SEO
   ONLY SEO FIELDS
========================================================= */

function buildSeoTitle(
  title: string,
  productType: string,
): string {
  const base = clean(title);

  if (base.length <= 50) {
    return base;
  }

  return limit(base, 50);
}

function buildMetaDescription(
  title: string,
  productType: string,
  specs: string[],
): string {
  const detail =
    specs.length > 0
      ? ` Explore ${productType.toLowerCase()} details and specifications.`
      : ` Explore ${productType.toLowerCase()} details.`;

  return limit(
    `Shop ${title}.${detail}`,
    150,
  );
}

/* =========================================================
   OPTIMIZER
========================================================= */

function optimizeProduct(
  product: Product,
  audience: Audience,
  style: Style,
): OptimizedProduct {
  const workingProduct: Product = {
    ...product,
    audience,
    style,
  };

  const title = buildTitle(workingProduct);
  const productType =
    buildProductType(workingProduct);

  const tags = buildTags(workingProduct);

  const specs = extractSpecifications(
    workingProduct.description,
  );

  const description = buildDescription(
    workingProduct,
    title,
    specs,
  );

  const seoTitle = buildSeoTitle(
    title,
    productType,
  );

  const metaDescription =
    buildMetaDescription(
      title,
      productType,
      specs,
    );

  return {
    title,
    productType,
    tags,
    description,
    seoTitle,
    metaDescription,
    specs,
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

  async function getSessionToken(): Promise<string> {
    if (
      typeof window === "undefined" ||
      !window.shopify?.idToken
    ) {
      throw new Error(
        "Shopify session unavailable. Open Virello from Shopify Admin.",
      );
    }

    const token =
      await window.shopify.idToken();

    if (!token) {
      throw new Error(
        "Shopify session token unavailable. Reopen Virello from Shopify Admin.",
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

      const response = await fetch(
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

      const normalized =
        Array.isArray(result.products)
          ? result.products.map(
              normalizeProduct,
            )
          : [];

      setProducts(normalized);

      if (normalized.length > 0) {
        setSelectedId(
          (current) =>
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

  const selected = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === selectedId,
      ) || null,
    [products, selectedId],
  );

  const filteredProducts =
    useMemo(() => {
      const query =
        search.toLowerCase().trim();

      if (!query) return products;

      return products.filter(
        (product) =>
          product.title
            .toLowerCase()
            .includes(query) ||
          product.productType
            .toLowerCase()
            .includes(query) ||
          product.vendor
            .toLowerCase()
            .includes(query) ||
          product.tags.some((tag) =>
            tag
              .toLowerCase()
              .includes(query),
          ),
      );
    }, [products, search]);

  /* =======================================================
     LOAD SELECTED PRODUCT INTO EDITOR
  ======================================================= */

  useEffect(() => {
    if (!selected) return;

    setAudience(selected.audience);
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
    if (!selected) return;

    setOptimizing(true);
    setMessage("");
    setError("");

    try {
      const result =
        optimizeProduct(
          selected,
          audience,
          style,
        );

      setOptimized(result);

      setMessage(
        "Optimization complete. Review the changes before saving.",
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
     APPLY GENERATED FIELD
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
    if (!optimized) return;

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
      "Applied. Press Save to Shopify when ready.",
    );
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSave() {
    if (!selected) return;

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
      limit(
        metaDescription,
        150,
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

      const response = await fetch(
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
            productId: selected.id,
            title: finalTitle,
            productType:
              finalProductType,
            tags: finalTags,
            description:
              finalDescription,
            seoTitle:
              finalSeoTitle,
            metaDescription:
              finalMetaDescription,
          }),
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
            "Shopify rejected the save.",
        );
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === selected.id
            ? {
                ...product,
                title: finalTitle,
                productType:
                  finalProductType,
                tags: finalTags,
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
      setSeoTitle(finalSeoTitle);
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
          padding-bottom: 70px;
        }

        .topbar {
          min-height: 72px;
          background: #fff;
          border-bottom: 1px solid #e2e2e2;
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
          margin: auto;
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
          line-height: .98;
          letter-spacing: -2.5px;
        }

        .hero p {
          margin: 13px 0 0;
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
          margin: auto;
          padding: 0 28px;
          display: grid;
          grid-template-columns: 350px minmax(0, 1fr);
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
          opacity: .55;
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
          letter-spacing: .04em;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .field textarea {
          min-height: 170px;
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
          white-space: pre-wrap;
        }

        .result ul {
          margin: 0;
          padding-left: 22px;
          line-height: 1.6;
        }

        .empty,
        .loading {
          padding: 45px 20px;
          text-align: center;
          color: #777;
        }

        .safe-note {
          margin-top: 18px;
          padding: 16px;
          background: #f5f5f5;
          border-radius: 14px;
          color: #666;
          font-size: 13px;
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
          <div className="brand-icon">✦</div>
          <span>Virello AI Optimizer</span>
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
              Optimize Shopify product content,
              SEO and product data in one place.
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
            <h2>Shopify Products</h2>

            <input
              className="search"
              placeholder="Search Shopify products..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          {loading ? (
            <div className="loading">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty">
              No Shopify products found.
            </div>
          ) : (
            <div className="product-list">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  className={`product-row ${
                    selectedId === product.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedId(product.id)
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
              ))}
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
                    <h2>Edit product</h2>

                    <p>
                      Review every change before
                      saving it back to Shopify.
                    </p>
                  </div>

                  <div className="actions">
                    <button
                      className="button primary"
                      disabled={
                        optimizing || saving
                      }
                      onClick={handleOptimize}
                    >
                      {optimizing
                        ? "Optimizing..."
                        : "Optimize with Virello AI"}
                    </button>

                    <button
                      className="button"
                      disabled={
                        saving || optimizing
                      }
                      onClick={handleSave}
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
                      src={selected.featuredImage}
                      alt={selected.title}
                    />
                  </div>
                )}

                <div className="grid-two">
                  <div className="field">
                    <label>Audience</label>

                    <select
                      value={audience}
                      onChange={(event) =>
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
                    <label>Style</label>

                    <select
                      value={style}
                      onChange={(event) =>
                        setStyle(
                          event.target
                            .value as Style,
                        )
                      }
                    >
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

                <div className="field">
                  <label>Product Title</label>

                  <input
                    value={title}
                    onChange={(event) =>
                      setTitle(event.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label>Product Type</label>

                  <input
                    value={productType}
                    onChange={(event) =>
                      setProductType(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>Tags</label>

                  <input
                    value={tags}
                    onChange={(event) =>
                      setTags(event.target.value)
                    }
                    placeholder="Separate tags with commas"
                  />
                </div>

                <div className="field">
                  <label>Product Description</label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="section">
                  <h3>SEO</h3>

                  <div className="field">
                    <label>
                      SEO Title · MAX 50
                    </label>

                    <input
                      value={seoTitle}
                      maxLength={50}
                      onChange={(event) =>
                        setSeoTitle(
                          event.target.value,
                        )
                      }
                    />

                    <div className="counter">
                      {seoTitle.length}/50
                    </div>
                  </div>

                  <div className="field">
                    <label>
                      Meta Description · MAX 150
                    </label>

                    <textarea
                      value={metaDescription}
                      maxLength={150}
                      onChange={(event) =>
                        setMetaDescription(
                          event.target.value,
                        )
                      }
                    />

                    <div className="counter">
                      {metaDescription.length}/150
                    </div>
                  </div>
                </div>

                {optimized && (
                  <div className="section">
                    <h3>
                      Virello AI Suggestions
                    </h3>

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Optimized Product Title
                        </strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated("title")
                          }
                        >
                          Use
                        </button>
                      </div>

                      <p>{optimized.title}</p>
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
                        {optimized.productType}
                      </p>
                    </div>

                    <div className="result">
                      <div className="result-head">
                        <strong>Tags</strong>

                        <button
                          className="button"
                          onClick={() =>
                            useGenerated("tags")
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

                    <div className="result">
                      <div className="result-head">
                        <strong>
                          Specifications Found
                        </strong>
                      </div>

                      {optimized.specs.length >
                      0 ? (
                        <ul>
                          {optimized.specs.map(
                            (spec, index) => (
                              <li key={index}>
                                {spec}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <p>
                          No explicit
                          specifications were
                          found in the supplied
                          Shopify data.
                        </p>
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
                        {optimized.seoTitle}
                      </p>

                      <div className="counter">
                        {
                          optimized.seoTitle
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

                    <div className="safe-note">
                      Virello only uses product
                      information available in
                      the Shopify listing when
                      generating specifications.
                      It does not invent missing
                      measurements, materials,
                      technical specifications,
                      certifications, or performance
                      claims.
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
