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

type AIAnalysis = {
  targetCustomer: string;
  purchaseMotivation: string;
  strongestFeatures: string[];
  weaknesses: string[];
  missingInformation: string[];
  seoOpportunities: string[];
  conversionOpportunities: string[];
};

type AIScore = {
  title: number;
  description: number;
  seo: number;
  productClarity: number;
  conversionPotential: number;
  overall: number;
};

type AIOptimization = {
  title: string;
  description: string;
  features: string[];
  specifications: string[];
  seoTitle: string;
  metaDescription: string;
  tags: string[];
};

type AIResult = {
  analysis: AIAnalysis;
  score: AIScore;
  optimization: AIOptimization;
  reasoning: string;
};

/* =========================================================
   HELPERS
========================================================= */

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
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

function unique(values: string[]): string[] {
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

function limitCharacters(
  value: unknown,
  max: number,
): string {
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

function normalizeScore(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  /*
   * Backend schema is 0–100.
   *
   * If an older AI response returns 0–10,
   * convert it to the new 0–100 display.
   */
  const normalized =
    number > 0 && number <= 10
      ? number * 10
      : number;

  return Math.max(
    0,
    Math.min(100, Math.round(normalized)),
  );
}

function normalizeAIResult(
  result: AIResult,
): AIResult {
  return {
    ...result,

    score: {
      title: normalizeScore(result.score?.title),
      description: normalizeScore(
        result.score?.description,
      ),
      seo: normalizeScore(result.score?.seo),
      productClarity: normalizeScore(
        result.score?.productClarity,
      ),
      conversionPotential: normalizeScore(
        result.score?.conversionPotential,
      ),
      overall: normalizeScore(
        result.score?.overall,
      ),
    },

    analysis: {
      ...result.analysis,
      targetCustomer: clean(
        result.analysis?.targetCustomer,
      ),
      purchaseMotivation: clean(
        result.analysis?.purchaseMotivation,
      ),
      strongestFeatures: unique(
        Array.isArray(
          result.analysis?.strongestFeatures,
        )
          ? result.analysis.strongestFeatures.map(clean)
          : [],
      ),
      weaknesses: unique(
        Array.isArray(result.analysis?.weaknesses)
          ? result.analysis.weaknesses.map(clean)
          : [],
      ),
      missingInformation: unique(
        Array.isArray(
          result.analysis?.missingInformation,
        )
          ? result.analysis.missingInformation.map(clean)
          : [],
      ),
      seoOpportunities: unique(
        Array.isArray(
          result.analysis?.seoOpportunities,
        )
          ? result.analysis.seoOpportunities.map(clean)
          : [],
      ),
      conversionOpportunities: unique(
        Array.isArray(
          result.analysis?.conversionOpportunities,
        )
          ? result.analysis.conversionOpportunities.map(
              clean,
            )
          : [],
      ),
    },

    optimization: {
      ...result.optimization,

      title: clean(result.optimization?.title),

      description: clean(
        result.optimization?.description,
      ),

      features: unique(
        Array.isArray(result.optimization?.features)
          ? result.optimization.features.map(clean)
          : [],
      ),

      specifications: unique(
        Array.isArray(
          result.optimization?.specifications,
        )
          ? result.optimization.specifications.map(clean)
          : [],
      ),

      seoTitle: limitCharacters(
        result.optimization?.seoTitle,
        50,
      ),

      metaDescription: limitCharacters(
        result.optimization?.metaDescription,
        150,
      ),

      tags: unique(
        Array.isArray(result.optimization?.tags)
          ? result.optimization.tags.map(clean)
          : [],
      ),
    },

    reasoning: clean(result.reasoning),
  };
}

function escapeHtml(value: string): string {
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

function descriptionToHtml(
  description: string,
): string {
  return description
    .split(/\n\s*\n/)
    .map(clean)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph)}</p>`,
    )
    .join("");
}

/* =========================================================
   AUDIENCE / STYLE
========================================================= */

function detectAudience(
  product: ShopifyProduct,
): Audience {
  const text = [
    product.title,
    product.productType,
    product.vendor,
    product.tags.join(" "),
    stripHtml(product.description),
  ]
    .join(" ")
    .toLowerCase();

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

function detectStyle(
  product: ShopifyProduct,
): Style {
  const text = [
    product.title,
    product.productType,
    product.vendor,
    product.tags.join(" "),
    stripHtml(product.description),
  ]
    .join(" ")
    .toLowerCase();

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
   PAGE
========================================================= */

export default function Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [aiResult, setAiResult] =
    useState<AIResult | null>(null);

  const [title, setTitle] = useState("");
  const [productType, setProductType] =
    useState("");
  const [tags, setTags] = useState("");
  const [description, setDescription] =
    useState("");

  const [features, setFeatures] =
    useState<string[]>([]);

  const [specifications, setSpecifications] =
    useState<string[]>([]);

  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] =
    useState("");

  const [audience, setAudience] =
    useState<Audience>("Unisex");

  const [style, setStyle] =
    useState<Style>("Everyday");

  /* =========================================================
     SHOPIFY SESSION
  ========================================================= */

  async function getSessionToken(): Promise<string> {
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

  /* =========================================================
     LOAD PRODUCTS
  ========================================================= */

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
          ? data.products.map(toProduct)
          : [];

      setProducts(normalized);

      if (normalized.length > 0) {
        setSelectedId(normalized[0].id);
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

  /* =========================================================
     SELECTED PRODUCT
  ========================================================= */

  const selected = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === selectedId,
      ) || null,
    [products, selectedId],
  );

  /* =========================================================
     FILTER
  ========================================================= */

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
          product.tags.some((tag) =>
            tag
              .toLowerCase()
              .includes(query),
          ),
      );
    }, [products, search]);

  /* =========================================================
     LOAD SELECTED PRODUCT
  ========================================================= */

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAudience(selected.audience);
    setStyle(selected.style);

    setTitle(
      stripHtml(selected.title),
    );

    setProductType(
      stripHtml(selected.productType),
    );

    setTags(
      selected.tags.join(", "),
    );

    setDescription(
      stripHtml(selected.description),
    );

    setFeatures([]);
    setSpecifications([]);
    setSeoTitle("");
    setMetaDescription("");
    setAiResult(null);
    setMessage("");
    setError("");
  }, [selected]);

  /* =========================================================
     REAL AI ANALYSIS
  ========================================================= */

  async function handleOptimize() {
    if (!selected) {
      return;
    }

    setOptimizing(true);
    setError("");
    setMessage("");
    setAiResult(null);

    try {
      const token =
        await getSessionToken();

      /*
       * IMPORTANT:
       * Send ALL existing Shopify titles.
       * This enables the backend duplicate protection.
       */
      const existingProductTitles =
        products
          .filter(
            (product) =>
              product.id !== selected.id,
          )
          .map((product) =>
            stripHtml(product.title),
          )
          .filter(Boolean);

      const response = await fetch(
        "/api/ai/analyze",
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
            product: {
              id: selected.id,

              title:
                stripHtml(
                  selected.title,
                ),

              description:
                stripHtml(
                  selected.description,
                ),

              productType:
                selected.productType,

              vendor:
                selected.vendor,

              tags:
                selected.tags,

              price:
                selected.price,

              audience,
              style,
            },

            /*
             * THIS WAS MISSING BEFORE.
             * Now the AI backend knows what
             * titles already exist in Shopify.
             */
            existingProductTitles,
          }),
        },
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Virello AI analysis failed.",
        );
      }

      const rawResult =
        (data.result ||
          data.data ||
          data.analysis) as
          | AIResult
          | undefined;

      if (
        !rawResult ||
        !rawResult.optimization
      ) {
        throw new Error(
          "Virello AI returned an incomplete optimization.",
        );
      }

      const result =
        normalizeAIResult(rawResult);

      setAiResult(result);

      setTitle(
        result.optimization.title,
      );

      setProductType(
        selected.productType ||
          "Products",
      );

      setTags(
        result.optimization.tags.join(
          ", ",
        ),
      );

      setDescription(
        result.optimization.description,
      );

      setFeatures(
        result.optimization.features,
      );

      setSpecifications(
        result.optimization
          .specifications,
      );

      setSeoTitle(
        result.optimization.seoTitle,
      );

      setMetaDescription(
        result.optimization
          .metaDescription,
      );

      setMessage(
        "Virello AI completed a real product analysis using the Shopify product data.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Virello AI optimization failed.",
      );
    } finally {
      setOptimizing(false);
    }
  }

  /* =========================================================
     SAVE TO SHOPIFY
  ========================================================= */

  async function handleSave() {
    if (!selected) {
      return;
    }

    const finalTitle =
      clean(title);

    const finalProductType =
      clean(productType);

    const finalTags = unique(
      tags
        .split(",")
        .map(clean)
        .filter(Boolean),
    );

    const finalDescription =
      clean(description);

    const finalSeoTitle =
      limitCharacters(
        seoTitle,
        50,
      );

    const finalMetaDescription =
      limitCharacters(
        metaDescription,
        150,
      );

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

    if (
      finalSeoTitle.length > 50
    ) {
      setError(
        "SEO Title must be 50 characters or fewer.",
      );
      return;
    }

    if (!finalMetaDescription) {
      setError(
        "Meta Description is required.",
      );
      return;
    }

    if (
      finalMetaDescription.length >
      150
    ) {
      setError(
        "Meta Description must be 150 characters or fewer.",
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
            productId:
              selected.id,

            title:
              finalTitle,

            productType:
              finalProductType,

            tags:
              finalTags,

            description:
              descriptionToHtml(
                finalDescription,
              ),

            seoTitle:
              finalSeoTitle,

            metaDescription:
              finalMetaDescription,
          }),
        },
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Shopify rejected the save.",
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
        "Successfully saved the AI-optimized product to Shopify.",
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

  /* =========================================================
     RENDER
  ========================================================= */

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

        .editor-head h1 {
          margin: 0;
          font-size: 28px;
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
          box-shadow:
            0 0 0 2px
            rgba(0, 0, 0, 0.04);
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

        .details-grid,
        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .detail-card,
        .analysis-card {
          border: 1px solid #dedede;
          border-radius: 14px;
          padding: 18px;
          background: #fafafa;
        }

        .detail-title {
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 13px;
        }

        .detail-list,
        .specs {
          margin: 0;
          padding-left: 20px;
          line-height: 1.7;
        }

        .detail-list li,
        .specs li {
          margin-bottom: 6px;
        }

        .empty-detail,
        .empty {
          color: #777;
          font-size: 14px;
          line-height: 1.5;
        }

        .analysis-card h3 {
          margin: 0 0 10px;
          font-size: 16px;
        }

        .analysis-card p {
          margin: 0;
          color: #444;
          line-height: 1.55;
        }

        .score-grid {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }

        .score {
          border: 1px solid #dedede;
          border-radius: 12px;
          padding: 14px;
          text-align: center;
          background: #fafafa;
        }

        .score-number {
          font-size: 25px;
          font-weight: 800;
        }

        .score-label {
          font-size: 11px;
          color: #777;
          margin-top: 3px;
        }

        .generated {
          border: 1px solid #dedede;
          border-radius: 14px;
          padding: 17px;
          margin-top: 16px;
          background: #fafafa;
        }

        .generated-head {
          font-weight: 800;
          margin-bottom: 10px;
        }

        .generated-content {
          white-space: pre-wrap;
          line-height: 1.55;
          color: #444;
        }

        .small-note {
          color: #777;
          font-size: 12px;
          line-height: 1.45;
          margin-top: 7px;
        }

        .ai-badge {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 999px;
          background: #171717;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .empty {
          padding: 45px 20px;
          text-align: center;
        }

        @media (max-width: 950px) {
          .container {
            grid-template-columns: 1fr;
          }

          .products {
            max-height: 300px;
          }
        }

        @media (max-width: 700px) {
          .details-grid,
          .analysis-grid {
            grid-template-columns: 1fr;
          }

          .score-grid {
            grid-template-columns:
              repeat(2, 1fr);
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

          .editor-head h1 {
            font-size: 25px;
          }

          .description-textarea {
            min-height: 360px;
          }
        }
      `}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

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

        {/* ===================================================
            PRODUCT LIST
        =================================================== */}

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

        {/* ===================================================
            EDITOR
        =================================================== */}

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
                    <div className="ai-badge">
                      REAL AI ANALYSIS
                    </div>

                    <h1>
                      Product Optimizer
                    </h1>

                    <div className="subtitle">
                      Virello AI analyzes
                      the actual Shopify
                      product data before
                      generating optimized
                      content.
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
                        ? "AI Analyzing..."
                        : "Analyze with AI"}
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

                {selected.featuredImage && (
                  <img
                    className="image"
                    src={
                      selected.featuredImage
                    }
                    alt={selected.title}
                  />
                )}

                {/* AUDIENCE / STYLE */}

                <div className="two">
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

                {/* PRODUCT TITLE */}

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

                  <div className="small-note">
                    AI-generated and checked
                    against existing Shopify
                    product titles.
                  </div>
                </div>

                {/* PRODUCT TYPE */}

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

                {/* TAGS */}

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
                    placeholder="watch, chronograph, stainless steel"
                  />

                  <div className="small-note">
                    AI-generated tags based
                    only on actual product
                    information.
                  </div>
                </div>

                {/* DESCRIPTION */}

                <div className="field">
                  <label>
                    Product Description
                  </label>

                  <textarea
                    className="description-textarea"
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                    placeholder="AI-generated conversion-focused product description..."
                  />

                  <div className="small-note">
                    Customer-facing product
                    copy generated by Virello AI.
                  </div>
                </div>

                {/* FEATURES / SPECIFICATIONS */}

                <div className="section">
                  <div className="section-title">
                    Product Details
                  </div>

                  <div className="details-grid">
                    <div className="detail-card">
                      <div className="detail-title">
                        Key Features
                      </div>

                      {features.length > 0 ? (
                        <ul className="detail-list">
                          {features.map(
                            (feature, index) => (
                              <li
                                key={`${feature}-${index}`}
                              >
                                {feature}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="empty-detail">
                          Run AI analysis to
                          generate verified
                          features.
                        </div>
                      )}
                    </div>

                    <div className="detail-card">
                      <div className="detail-title">
                        Specifications
                      </div>

                      {specifications.length >
                      0 ? (
                        <ul className="detail-list">
                          {specifications.map(
                            (
                              specification,
                              index,
                            ) => (
                              <li
                                key={`${specification}-${index}`}
                              >
                                {specification}
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="empty-detail">
                          Only specifications
                          supplied in the
                          product data will
                          appear here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SEO */}

                <div className="section">
                  <div className="section-title">
                    Google SEO
                  </div>

                  <div className="field">
                    <label>
                      SEO Title · Max 50
                    </label>

                    <input
                      maxLength={50}
                      value={seoTitle}
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
                      Meta Description · Max 150
                    </label>

                    <textarea
                      maxLength={150}
                      value={metaDescription}
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

                {/* =================================================
                    AI ANALYSIS
                ================================================= */}

                {aiResult && (
                  <div className="section">
                    <div className="section-title">
                      Virello AI Analysis
                    </div>

                    <div className="score-grid">
                      <div className="score">
                        <div className="score-number">
                          {
                            aiResult.score
                              .overall
                          }
                        </div>
                        <div className="score-label">
                          Overall / 100
                        </div>
                      </div>

                      <div className="score">
                        <div className="score-number">
                          {
                            aiResult.score
                              .conversionPotential
                          }
                        </div>
                        <div className="score-label">
                          Conversion / 100
                        </div>
                      </div>

                      <div className="score">
                        <div className="score-number">
                          {
                            aiResult.score
                              .seo
                          }
                        </div>
                        <div className="score-label">
                          SEO / 100
                        </div>
                      </div>

                      <div className="score">
                        <div className="score-number">
                          {
                            aiResult.score
                              .title
                          }
                        </div>
                        <div className="score-label">
                          Title / 100
                        </div>
                      </div>

                      <div className="score">
                        <div className="score-number">
                          {
                            aiResult.score
                              .description
                          }
                        </div>
                        <div className="score-label">
                          Description / 100
                        </div>
                      </div>

                      <div className="score">
                        <div className="score-number">
                          {
                            aiResult.score
                              .productClarity
                          }
                        </div>
                        <div className="score-label">
                          Clarity / 100
                        </div>
                      </div>
                    </div>

                    <div className="analysis-grid">
                      <div className="analysis-card">
                        <h3>
                          Target Customer
                        </h3>

                        <p>
                          {
                            aiResult.analysis
                              .targetCustomer
                          }
                        </p>
                      </div>

                      <div className="analysis-card">
                        <h3>
                          Purchase Motivation
                        </h3>

                        <p>
                          {
                            aiResult.analysis
                              .purchaseMotivation
                          }
                        </p>
                      </div>

                      <div className="analysis-card">
                        <h3>
                          Strongest Features
                        </h3>

                        {aiResult.analysis
                          .strongestFeatures
                          .length > 0 ? (
                          <ul className="specs">
                            {aiResult.analysis
                              .strongestFeatures
                              .map(
                                (
                                  item,
                                  index,
                                ) => (
                                  <li
                                    key={`${item}-${index}`}
                                  >
                                    {item}
                                  </li>
                                ),
                              )}
                          </ul>
                        ) : (
                          <p>
                            No verified
                            features
                            identified.
                          </p>
                        )}
                      </div>

                      <div className="analysis-card">
                        <h3>
                          Weaknesses
                        </h3>

                        {aiResult.analysis
                          .weaknesses
                          .length > 0 ? (
                          <ul className="specs">
                            {aiResult.analysis
                              .weaknesses
                              .map(
                                (
                                  item,
                                  index,
                                ) => (
                                  <li
                                    key={`${item}-${index}`}
                                  >
                                    {item}
                                  </li>
                                ),
                              )}
                          </ul>
                        ) : (
                          <p>
                            No major
                            weaknesses
                            identified.
                          </p>
                        )}
                      </div>

                      <div className="analysis-card">
                        <h3>
                          Missing Information
                        </h3>

                        {aiResult.analysis
                          .missingInformation
                          .length > 0 ? (
                          <ul className="specs">
                            {aiResult.analysis
                              .missingInformation
                              .map(
                                (
                                  item,
                                  index,
                                ) => (
                                  <li
                                    key={`${item}-${index}`}
                                  >
                                    {item}
                                  </li>
                                ),
                              )}
                          </ul>
                        ) : (
                          <p>
                            No important
                            missing
                            information
                            detected.
                          </p>
                        )}
                      </div>

                      <div className="analysis-card">
                        <h3>
                          Conversion Opportunities
                        </h3>

                        {aiResult.analysis
                          .conversionOpportunities
                          .length > 0 ? (
                          <ul className="specs">
                            {aiResult.analysis
                              .conversionOpportunities
                              .map(
                                (
                                  item,
                                  index,
                                ) => (
                                  <li
                                    key={`${item}-${index}`}
                                  >
                                    {item}
                                  </li>
                                ),
                              )}
                          </ul>
                        ) : (
                          <p>
                            No additional
                            opportunities
                            identified.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="generated">
                      <div className="generated-head">
                        AI Reasoning
                      </div>

                      <div className="generated-content">
                        {
                          aiResult.reasoning
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
