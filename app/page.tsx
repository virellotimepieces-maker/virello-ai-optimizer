"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

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
   GLOBAL HELPERS
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

  const shortened = text.slice(0, max + 1);
  const lastSpace = shortened.lastIndexOf(" ");

  return clean(
    shortened.slice(
      0,
      lastSpace > 0 ? lastSpace : max,
    ),
  ).replace(/[.,;:!?-]+$/, "");
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
   PRODUCT DETECTION
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

function detectAudience(
  product: ShopifyProduct,
): Audience {
  const text = getProductText(product).toLowerCase();

  if (/\bwomen|women's|ladies|lady\b/.test(text)) {
    return "Women";
  }

  if (/\bmen|men's|gentlemen|gents\b/.test(text)) {
    return "Men";
  }

  return "Unisex";
}

function detectStyle(
  product: ShopifyProduct,
): Style {
  const text = getProductText(product).toLowerCase();

  if (
    /luxury|premium|elegant|sapphire|automatic|mechanical|formal/.test(
      text,
    )
  ) {
    return "Premium / Luxury";
  }

  if (
    /sport|sports|diving|diver|racing|athletic/.test(
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

function toProduct(
  product: ShopifyProduct,
): Product {
  return {
    ...product,
    audience: detectAudience(product),
    style: detectStyle(product),
  };
}

/* =========================================================
   PRODUCT TYPE
========================================================= */

function buildProductType(
  product: Product,
) {
  const existing = clean(product.productType);

  if (existing) {
    return existing;
  }

  const text = getProductText(product).toLowerCase();

  if (/watch|timepiece/.test(text)) {
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

  if (/jewelry|jewellery|necklace|bracelet|ring/.test(text)) {
    return "Jewelry";
  }

  return "Products";
}

/* =========================================================
   TITLE
========================================================= */

function removeBadWords(value: string) {
  return clean(value)
    .replace(
      /\b(elevate|dropshipping|wholesale|supplier|cheap|hot sale|hot selling|free shipping|best seller|new arrival)\b/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function buildProductTitle(
  product: Product,
) {
  let source = removeBadWords(product.title);

  source = source
    .replace(/[|:;,()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = source
    .split(/\s+/)
    .filter(Boolean);

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

  return limitWords(
    filtered.join(" "),
    8,
  );
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

  if (/watch|timepiece/.test(text)) {
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

  if (/sport|racing/.test(text)) {
    add("sport");
  }

  if (/luxury|premium|elegant/.test(text)) {
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
   * Keep existing useful Shopify tags.
   * Remove obvious supplier / spam terms.
   */
  for (const tag of product.tags) {
    if (
      !/elevate|dropshipping|wholesale|supplier|cheap|hot sale/i.test(
        tag,
      )
    ) {
      add(tag);
    }
  }

  return unique(result).slice(0, 15);
}

/* =========================================================
   SPECIFICATIONS
========================================================= */

const SPEC_LABELS = [
  "Material",
  "Movement",
  "Case Material",
  "Case Size",
  "Water Resistance",
  "Strap Material",
  "Band Material",
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
] as const;

function normalizeLabel(value: string) {
  const normalized = clean(value).toLowerCase();

  return SPEC_LABELS.find(
    (label) =>
      label.toLowerCase() === normalized,
  );
}

function extractSpecifications(
  description: string,
) {
  const text = stripHtml(description);

  const specs: string[] = [];

  const lines = text
    .split(/\n|•/)
    .map(clean)
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(
      /^([A-Za-z][A-Za-z0-9 /_-]{1,35})\s*[:：-]\s*(.+)$/i,
    );

    if (!match) {
      continue;
    }

    const label = normalizeLabel(
      match[1],
    );

    if (!label) {
      continue;
    }

    const value = clean(match[2]);

    if (
      !value ||
      value.length > 120
    ) {
      continue;
    }

    specs.push(
      `${label}: ${value}`,
    );
  }

  return unique(specs).slice(0, 20);
}

/* =========================================================
   DESCRIPTION
========================================================= */

function buildDescription(
  product: Product,
  title: string,
  specifications: string[],
) {
  const original = stripHtml(
    product.description,
  );

  /*
   * Remove existing specification lines
   * so specifications are not duplicated
   * inside the new description.
   */
  const cleanOriginal = original
    .split(/\n/)
    .map(clean)
    .filter(Boolean)
    .filter((line) => {
      const match = line.match(
        /^([A-Za-z][A-Za-z0-9 /_-]{1,35})\s*[:：-]\s*(.+)$/i,
      );

      if (!match) {
        return true;
      }

      return !normalizeLabel(match[1]);
    })
    .join(" ");

  const source =
    cleanOriginal.length > 40
      ? limitCharacters(
          cleanOriginal,
          700,
        )
      : `Designed with a clean and versatile look, ${title} is suited to everyday use and personal style.`;

  let html =
    `<p>${escapeHtml(source)}</p>`;

  /*
   * Specifications are shown separately.
   * They are NOT repeated in the main paragraph.
   */
  if (specifications.length > 0) {
    html +=
      "<h3>Specifications</h3><ul>";

    for (const spec of specifications) {
      html += `<li>${escapeHtml(
        spec,
      )}</li>`;
    }

    html += "</ul>";
  }

  return html;
}

/* =========================================================
   SEO
========================================================= */

function buildSeoTitle(
  title: string,
  productType: string,
) {
  /*
   * Intentionally different from Product Title.
   * No store name is hard-coded.
   */
  const candidate =
    `${title} | ${productType}`;

  return limitCharacters(
    candidate,
    60,
  );
}

function buildMetaDescription(
  product: Product,
  title: string,
  productType: string,
) {
  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  /*
   * Completely separate wording from
   * Product Title and SEO Title.
   */
  const candidate =
    `Explore this ${productType.toLowerCase()} for ${audience}. View product details, available specifications, and design features before you buy.`;

  return limitCharacters(
    candidate,
    155,
  );
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
    );

  const description =
    buildDescription(
      product,
      title,
      specifications,
    );

  const seoTitle =
    buildSeoTitle(
      title,
      productType,
    );

  const metaDescription =
    buildMetaDescription(
      product,
      title,
      productType,
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
              Authorization: `Bearer ${token}`,
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
              (product) =>
                toProduct(product),
            )
          : [];

      setProducts(normalized);

      if (normalized.length > 0) {
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
          product.tags.some(
            (tag) =>
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
    if (!selected) {
      return;
    }

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

      /*
       * Put generated values directly
       * into their corresponding editor fields.
       */
      setTitle(result.title);
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
        "Optimization complete. Review the separate fields before saving to Shopify.",
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

    const finalDescription =
      description.trim();

    const finalSeoTitle =
      clean(seoTitle);

    const finalMetaDescription =
      clean(metaDescription);

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

    if (finalSeoTitle.length > 60) {
      setError(
        "SEO Title must be 60 characters or fewer.",
      );
      return;
    }

    if (
      finalMetaDescription.length >
      155
    ) {
      setError(
        "Meta Description must be 155 characters or fewer.",
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
                finalDescription,
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

      setProducts((current) =>
        current.map((product) =>
          product.id === selected.id
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

        body {
          margin: 0;
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
          height: 72px;
          background: #ffffff;
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
          color: white;
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
        }

        .subtitle {
          color: #777;
          margin-top: 6px;
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
        }

        .button.primary {
          background: #171717;
          color: white;
          border-color: #171717;
        }

        .button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .notice {
          padding: 14px 16px;
          border-radius: 12px;
          margin-bottom: 18px;
          font-size: 14px;
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
        }

        textarea {
          min-height: 180px;
          resize: vertical;
          line-height: 1.5;
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: #777;
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
          line-height: 1.5;
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
          }

          .button {
            flex: 1;
          }
        }
      `}</style>

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
        <aside className="card">
          <div className="sidebar-head">
            <h2>Shopify Products</h2>

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
                    key={product.id}
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
                      {product.title}
                    </div>

                    <div className="product-info">
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
                Select a Shopify product.
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

                <div className="editor-head">
                  <div>
                    <h1>
                      Product Optimizer
                    </h1>

                    <div className="subtitle">
                      Review every field
                      before saving to
                      Shopify.
                    </div>
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
                        : "Optimize"}
                    </button>

                    <button
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

                <div className="two">
                  <div className="field">
                    <label>
                      Audience
                    </label>

                    <select
                      value={
                        audience
                      }
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
                    onChange={(event) =>
                      setProductType(
                        event.target.value,
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
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="field">
                  <label>
                    Product Description
                  </label>

                  <textarea
                    value={
                      description
                    }
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <div className="section">
                  <div className="section-title">
                    Google SEO
                  </div>

                  <div className="field">
                    <label>
                      SEO Title
                    </label>

                    <input
                      maxLength={60}
                      value={
                        seoTitle
                      }
                      onChange={(event) =>
                        setSeoTitle(
                          event.target.value,
                        )
                      }
                    />

                    <div className="counter">
                      {seoTitle.length}
                      /60
                    </div>
                  </div>

                  <div className="field">
                    <label>
                      Meta Description
                    </label>

                    <textarea
                      maxLength={155}
                      value={
                        metaDescription
                      }
                      onChange={(event) =>
                        setMetaDescription(
                          event.target.value,
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

                {optimized && (
                  <div className="section">
                    <div className="section-title">
                      Generated Content
                    </div>

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Product Title
                        </strong>
                      </div>

                      <div className="generated-content">
                        {optimized.title}
                      </div>
                    </div>

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

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Product Description
                        </strong>
                      </div>

                      <div className="generated-content">
                        {stripHtml(
                          optimized.description,
                        )}
                      </div>
                    </div>

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Specifications
                        </strong>
                      </div>

                      {optimized
                        .specifications
                        .length > 0 ? (
                        <ul className="specs">
                          {optimized.specifications.map(
                            (spec) => (
                              <li key={spec}>
                                {spec}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="generated-content">
                          No explicit
                          specifications
                          were found in
                          the supplied
                          Shopify data.
                        </div>
                      )}
                    </div>

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
