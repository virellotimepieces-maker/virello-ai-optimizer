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
        "Product details
