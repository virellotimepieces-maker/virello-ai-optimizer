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
  value: string,
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
   AUDIENCE DETECTION
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

  /*
   * Strong men's signals first.
   * This prevents a men's watch from being
   * incorrectly classified as women/unisex.
   */

  if (
    /\bmen\b|\bmen's\b|\bmens\b|\bgentlemen\b|\bgents\b|\bmale\b|\bman\b/.test(
      text,
    )
  ) {
    return "Men";
  }

  if (
    /\bwomen\b|\bwomen's\b|\bwomens\b|\bladies\b|\blady\b|\bfemale\b|\bwoman\b/.test(
      text,
    )
  ) {
    return "Women";
  }

  return "Unisex";
}

/* =========================================================
   STYLE DETECTION
========================================================= */

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

  if (
    /business|office|professional/.test(text)
  ) {
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

  const [aiResult, setAiResult] =
    useState<AIResult | null>(null);

  const [title, setTitle] =
    useState("");

  const [productType, setProductType] =
    useState("");

  const [tags, setTags] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [features, setFeatures] =
    useState<string[]>([]);

  const [specifications, setSpecifications] =
    useState<string[]>([]);

  const [seoTitle, setSeoTitle] =
    useState("");

  const [metaDescription, setMetaDescription] =
    useState("");

  const [audience, setAudience] =
    useState<Audience>("Unisex");

  const [style, setStyle] =
    useState<Style>("Everyday");

  /* =======================================================
     SHOPIFY SESSION TOKEN
  ======================================================= */

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
      await window.shop
