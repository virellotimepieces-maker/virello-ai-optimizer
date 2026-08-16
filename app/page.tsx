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
  features: string[];
  specifications: string[];
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
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
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
   PRODUCT SOURCE DATA
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

function detectAudience(
  product: ShopifyProduct,
): Audience {
  const text =
    getProductText(product).toLowerCase();

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

function detectStyle(
  product: ShopifyProduct,
): Style {
  const text =
    getProductText(product).toLowerCase();

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

  if (
    /casual|fashion|street/.test(text)
  ) {
    return "Casual";
  }

  if (
    /gift|present/.test(text)
  ) {
    return "Gift";
  }

  if (
    /business|office|professional/.test(
      text,
    )
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
   PRODUCT TYPE
========================================================= */

function buildProductType(
  product: Product,
) {
  const existing =
    clean(product.productType);

  if (
    existing &&
    !/^product$/i.test(existing) &&
    !/^products$/i.test(existing)
  ) {
    return existing;
  }

  const text =
    getProductText(product).toLowerCase();

  if (
    /watch|timepiece|chronograph|quartz|automatic|mechanical/.test(
      text,
    )
  ) {
    return "Watches";
  }

  if (
    /shoe|sneaker|footwear/.test(text)
  ) {
    return "Shoes";
  }

  if (
    /shirt|blouse|top/.test(text)
  ) {
    return "Tops";
  }

  if (/dress/.test(text)) {
    return "Dresses";
  }

  if (
    /bag|handbag|purse/.test(text)
  ) {
    return "Bags";
  }

  if (
    /jewelry|jewellery|necklace|bracelet|ring/.test(
      text,
    )
  ) {
    return "Jewelry";
  }

  return "Products";
}

/* =========================================================
   SUPPLIER NOISE
========================================================= */

function removeSupplierNoise(
  value: string,
) {
  return clean(value)
    .replace(
      /\b(elevate|dropshipping|wholesale|supplier|cheap|hot sale|hot selling|free shipping|best seller|new arrival|new product|2024|2025|2026)\b/gi,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

/* =========================================================
   PRODUCT TITLE
   CONVERSION FIRST
   NOT AN SEO TITLE
========================================================= */

function buildProductTitle(
  product: Product,
) {
  const source =
    removeSupplierNoise(
      product.title,
    );

  const text =
    getProductText(product).toLowerCase();

  const type =
    /chronograph/.test(text)
      ? "Chronograph Watch"
      : /automatic/.test(text)
        ? "Automatic Watch"
        : /mechanical/.test(text)
          ? "Mechanical Watch"
          : /quartz/.test(text)
            ? "Quartz Watch"
            : /watch|timepiece/.test(text)
              ? "Watch"
              : clean(
                    product.productType,
                  ) || "Product";

  const audience =
    product.audience === "Men"
      ? "Men's"
      : product.audience === "Women"
        ? "Women's"
        : "";

  const premium =
    /luxury|premium|elegant|refined|sapphire/.test(
      text,
    );

  const sport =
    /sport|racing|diving|diver/.test(
      text,
    );

  let positioning = "Classic";

  if (premium) {
    positioning = "Refined";
  } else if (sport) {
    positioning = "Sport";
  }

  const sourceWords =
    source
      .replace(
        /[|:;,()[\]{}]+/g,
        " ",
      )
      .split(/\s+/)
      .filter(Boolean);

  const usefulWords =
    sourceWords
      .filter(
        (word) =>
          !/^(men|women|mens|womens|watch|watches|fashion|luxury|premium)$/i.test(
            word,
          ),
      )
      .slice(0, 4);

  const candidates = [
    `${usefulWords.join(" ")} ${type}`,
    `${positioning} ${type} ${audience}`,
    `${positioning} ${type}`,
    `${type} ${audience}`,
  ];

  for (const candidate of candidates) {
    const result = clean(candidate);

    if (
      result.length >= 15 &&
      result.length <= 70
    ) {
      return result;
    }
  }

  return `${positioning} ${type}`;
}

/* =========================================================
   TAGS
========================================================= */

function buildTags(
  product: Product,
) {
  const text =
    getProductText(product).toLowerCase();

  const result: string[] = [];

  const add = (value: string) => {
    result.push(value);
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

  if (/sapphire/.test(text)) {
    add("sapphire crystal");
  }

  if (/sport|racing/.test(text)) {
    add("sport watch");
  }

  if (
    /luxury|premium|elegant|refined/.test(
      text,
    )
  ) {
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

  for (const tag of product.tags) {
    const cleanedTag =
      removeSupplierNoise(tag);

    if (
      cleanedTag &&
      !/elevate|dropshipping|wholesale|supplier|cheap|hot sale|hot selling|best seller|new arrival/i.test(
        cleanedTag,
      )
    ) {
      add(cleanedTag);
    }
  }

  return unique(result).slice(
    0,
    15,
  );
}

/* =========================================================
   SPECIFICATIONS
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
  "Closure Type",
] as const;

function normalizeLabel(
  value: string,
) {
  const normalized =
    clean(value).toLowerCase();

  return SPEC_LABELS.find(
    (label) =>
      label.toLowerCase() ===
      normalized,
  );
}

function extractSpecifications(
  description: string,
  product: ShopifyProduct,
) {
  const source =
    stripHtml(description);

  const specifications: string[] =
    [];

  const pattern =
    /(Material|Movement|Case Material|Case Size|Case Diameter|Case Thickness|Water Resistance|Strap Material|Band Material|Strap Width|Band Width|Crystal|Dial Color|Case Color|Band Color|Power Reserve|Battery|Dimensions|Weight|Capacity|Size|Color|Finish|Clasp Type|Dial Type|Display Type|Functions|Closure Type)\s*[:：-]\s*([^,.;\n]{1,100})/gi;

  let match: RegExpExecArray | null;

  while (
    (match =
      pattern.exec(source)) !==
    null
  ) {
    const label =
      normalizeLabel(match[1]);

    const value =
      clean(match[2]);

    if (
      label &&
      value &&
      value.length <= 120
    ) {
      specifications.push(
        `${label}: ${value}`,
      );
    }
  }

  const text =
    getProductText(product).toLowerCase();

  if (/automatic/.test(text)) {
    specifications.push(
      "Movement: Automatic",
    );
  }

  if (/mechanical/.test(text)) {
    specifications.push(
      "Movement: Mechanical",
    );
  }

  if (/quartz/.test(text)) {
    specifications.push(
      "Movement: Quartz",
    );
  }

  if (/chronograph/.test(text)) {
    specifications.push(
      "Functions: Chronograph",
    );
  }

  if (/stainless steel/.test(text)) {
    specifications.push(
      "Case Material: Stainless Steel",
    );
  }

  if (/sapphire/.test(text)) {
    specifications.push(
      "Crystal: Sapphire",
    );
  }

  const waterMatch =
    text.match(
      /(\d+\s*(?:m|meter|meters|atm|bar))\s*(?:water resistant|water resistance)/i,
    );

  if (waterMatch) {
    specifications.push(
      `Water Resistance: ${waterMatch[1]}`,
    );
  }

  return unique(
    specifications,
  ).slice(0, 20);
}

/* =========================================================
   FEATURES
========================================================= */

function buildFeatures(
  product: Product,
) {
  const text =
    getProductText(product).toLowerCase();

  const features: string[] = [];

  const add = (value: string) => {
    features.push(value);
  };

  const isWatch =
    /watch|timepiece|chronograph|quartz|automatic|mechanical/.test(
      text,
    );

  if (isWatch) {
    if (/chronograph/.test(text)) {
      add(
        "Chronograph styling adds a distinctive, functional look",
      );
    }

    if (/automatic/.test(text)) {
      add(
        "Automatic movement delivers a classic mechanical experience",
      );
    } else if (/mechanical/.test(text)) {
      add(
        "Mechanical movement brings traditional watchmaking appeal",
      );
    } else if (/quartz/.test(text)) {
      add(
        "Quartz movement provides dependable everyday timekeeping",
      );
    }

    if (/stainless steel/.test(text)) {
      add(
        "Stainless steel construction for a polished, versatile finish",
      );
    }

    if (/sapphire/.test(text)) {
      add(
        "Sapphire crystal adds a premium watchmaking detail",
      );
    }

    if (
      /sport|racing|diving|diver/.test(
        text,
      )
    ) {
      add(
        "Sport-inspired design suited to active styling",
      );
    }

    if (
      /luxury|premium|elegant|refined/.test(
        text,
      )
    ) {
      add(
        "Refined finishing designed for polished everyday wear",
      );
    }

    add(
      "Versatile styling for work, weekends, and evenings",
    );
  } else {
    add(
      "Refined design for everyday use",
    );

    add(
      "Versatile styling for different occasions",
    );

    add(
      "Thoughtful details designed for practical everyday use",
    );
  }

  return unique(features).slice(
    0,
    7,
  );
}

/* =========================================================
   ORIGINAL DESCRIPTION CLEANUP
========================================================= */

function cleanOriginalDescription(
  value: string,
) {
  let result =
    stripHtml(value);

  result = result
    .replace(
      /\b(shop now|buy now|upgrade your|elevate your|free shipping|order now|click here)\b[^.?!]*[.?!]?/gi,
      "",
    )
    .replace(
      /\b(key features|specifications|product details|product description)\b:?/gi,
      "",
    )
    .replace(
      /\b(high quality|high-quality|top quality|premium quality)\b/gi,
      "quality",
    )
    .replace(
      /\b(must have|must-have)\b/gi,
      "",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();

  const seen = new Set<string>();

  return result
    .split(
      /(?<=[.!?])\s+/,
    )
    .map(clean)
    .filter((sentence) => {
      const key =
        sentence
          .toLowerCase()
          .replace(
            /[^a-z0-9 ]/g,
            "",
          )
          .trim();

      if (
        !key ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(" ");
}

/* =========================================================
   HIGH-CONVERTING PRODUCT DESCRIPTION

   IMPORTANT:
   This is NOT the SEO title.
   This is NOT the meta description.
   This is NOT a list of specifications.
========================================================= */

function buildDescription(
  product: Product,
  title: string,
) {
  const text =
    getProductText(product).toLowerCase();

  const isWatch =
    /watch|timepiece|chronograph|quartz|automatic|mechanical/.test(
      text,
    );

  const audience =
    product.audience === "Men"
      ? "men"
      : product.audience === "Women"
        ? "women"
        : "those who appreciate refined style";

  const original =
    cleanOriginalDescription(
      product.description,
    );

  let opening = "";

  if (isWatch) {
    opening =
      `Make a sharper impression with the ${title}. Designed for ${audience}, this timepiece brings confident detail and polished style to the moments that matter.`;
  } else {
    opening =
      `Bring a more considered finish to everyday life with the ${title}. Designed for ${audience}, it combines useful details with a polished, versatile look.`;
  }

  let benefit = "";

  if (/automatic/.test(text)) {
    benefit =
      "The automatic movement gives the watch a traditional mechanical character, while the considered design makes it easy to wear beyond formal occasions.";
  } else if (/chronograph/.test(text)) {
    benefit =
      "The chronograph-inspired design adds visual depth and a distinctive presence without making the overall look difficult to style.";
  } else if (/quartz/.test(text)) {
    benefit =
      "Quartz movement provides dependable everyday timekeeping, making the watch a practical choice when reliability and presentation both matter.";
  } else if (/stainless steel/.test(text)) {
    benefit =
      "The polished case and stainless steel detailing create a versatile appearance that works naturally with tailored, smart-casual, and evening looks.";
  } else if (isWatch) {
    benefit =
      "The balanced combination of case, dial, and bracelet creates a polished look that transitions naturally from professional settings to weekends and evenings.";
  } else {
    benefit =
      "Thoughtful construction and versatile styling make it easy to incorporate into everyday routines while keeping the overall look polished.";
  }

  let sourceSection = "";

  if (original.length >= 80) {
    sourceSection =
      limitCharacters(
        original,
        500,
      );
  }

  const closing = isWatch
    ? "A versatile choice when you want one timepiece that feels appropriate for workdays, weekends, and special occasions."
    : "A practical choice when you want everyday function without a generic appearance.";

  return [
    opening,
    benefit,
    sourceSection,
    closing,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/* =========================================================
   HTML DESCRIPTION
========================================================= */

function descriptionToHtml(
  description: string,
) {
  return description
    .split(/\n\s*\n/)
    .map(clean)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(
          paragraph,
        )}</p>`,
    )
    .join("");
}

/* =========================================================
   SEO TITLE

   MAX 50 CHARACTERS.

   PURPOSE:
   Search intent, not storefront conversion copy.
========================================================= */

function buildSeoTitle(
  product: Product,
) {
  const text =
    getProductText(product).toLowerCase();

  let keyword =
    "Luxury Watch";

  if (/chronograph/.test(text)) {
    keyword =
      "Chronograph Watch";
  } else if (/automatic/.test(text)) {
    keyword =
      "Automatic Watch";
  } else if (/mechanical/.test(text)) {
    keyword =
      "Mechanical Watch";
  } else if (/quartz/.test(text)) {
    keyword =
      "Quartz Watch";
  } else if (/watch|timepiece/.test(text)) {
    keyword =
      "Luxury Watch";
  } else {
    keyword =
      clean(product.productType) ||
      "Product";
  }

  const audience =
    product.audience === "Men"
      ? "Men"
      : product.audience === "Women"
        ? "Women"
        : "";

  const style =
    product.style ===
    "Premium / Luxury"
      ? "Premium"
      : product.style ===
          "Sport"
        ? "Sport"
        : "Refined";

  const candidates = [
    `${keyword} ${style} Style`,
    `${audience} ${keyword}`.trim(),
    `${keyword} for ${audience}`.trim(),
    `${style} ${keyword}`,
    `${keyword} Online`,
    keyword,
  ];

  const valid =
    unique(candidates).filter(
      (candidate) =>
        candidate.length <= 50,
    );

  if (valid.length) {
    return valid.sort(
      (a, b) =>
        b.length - a.length,
    )[0];
  }

  return limitCharacters(
    keyword,
    50,
  );
}

/* =========================================================
   META DESCRIPTION

   MAX 150 CHARACTERS.

   PURPOSE:
   Convince the searcher to click.

   It deliberately does NOT copy:
   - Product Title
   - SEO Title
   - Product Description
========================================================= */

function buildMetaDescription(
  product: Product,
) {
  const text =
    getProductText(product).toLowerCase();

  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  let benefit =
    "refined everyday styling";

  if (/automatic/.test(text)) {
    benefit =
      "classic automatic movement";
  } else if (/chronograph/.test(text)) {
    benefit =
      "distinctive chronograph styling";
  } else if (/quartz/.test(text)) {
    benefit =
      "dependable quartz timekeeping";
  } else if (/sapphire/.test(text)) {
    benefit =
      "premium sapphire crystal";
  } else if (/stainless steel/.test(text)) {
    benefit =
      "polished stainless steel design";
  }

  let occasion =
    "work, weekends, and evenings";

  if (
    /sport|racing|diving|diver/.test(
      text,
    )
  ) {
    occasion =
      "active days and weekends";
  }

  if (
    /formal|dress|professional|office/.test(
      text,
    )
  ) {
    occasion =
      "work and special occasions";
  }

  const candidates = [
    `Find refined style for ${audience} with ${benefit}. A versatile choice for ${occasion}.`,
    `Discover ${benefit} in a versatile design made for ${occasion}.`,
    `Choose ${benefit} designed for ${audience}, from everyday wear to special occasions.`,
    `Refined timekeeping with ${benefit}, designed for everyday wear.`,
  ];

  const valid =
    candidates.filter(
      (candidate) =>
        candidate.length <= 150,
    );

  if (valid.length) {
    return valid.sort(
      (a, b) =>
        b.length - a.length,
    )[0];
  }

  return limitCharacters(
    candidates[
      candidates.length - 1
    ],
    150,
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
      product,
    );

  const features =
    buildFeatures(product);

  const description =
    buildDescription(
      product,
      title,
    );

  const seoTitle =
    buildSeoTitle({
      ...product,
      title,
    });

  const metaDescription =
    buildMetaDescription({
      ...product,
      title,
    });

  return {
    title,
    productType,
    tags,
    description,
    features,
    specifications,
    seoTitle,
    metaDescription,
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

  const [features, setFeatures] =
    useState<string[]>([]);

  const [
    specifications,
    setSpecifications,
  ] = useState<string[]>([]);

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
      typeof window ===
        "undefined" ||
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

      if (normalized.length) {
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
     SEARCH
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
    }, [
      products,
      search,
    ]);

  /* =======================================================
     LOAD SELECTED PRODUCT INTO EDITOR
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

    setDescription(
      stripHtml(
        selected.description,
      ),
    );

    setFeatures([]);
    setSpecifications([]);
    setSeoTitle("");
    setMetaDescription("");
    setOptimized(null);
    setMessage("");
    setError("");
  }, [selected]);

  /* =======================================================
     TITLE CHANGE
     SEO + META UPDATE AUTOMATICALLY
  ======================================================= */

  function syncSeoMeta(
    nextTitle: string,
  ) {
    if (!selected) {
      return;
    }

    const context: Product = {
      ...selected,
      title: nextTitle,
      audience,
      style,
    };

    setSeoTitle(
      buildSeoTitle(context),
    );

    setMetaDescription(
      buildMetaDescription(
        context,
      ),
    );
  }

  function handleTitleChange(
    nextTitle: string,
  ) {
    setTitle(nextTitle);

    syncSeoMeta(
      nextTitle,
    );
  }

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

      setFeatures(
        result.features,
      );

      setSpecifications(
        result.specifications,
      );

      setSeoTitle(
        result.seoTitle,
      );

      setMetaDescription(
        result.metaDescription,
      );

      setMessage(
        "Optimization complete. Product Title, SEO Title, Meta Description, Product Description, Features and Specifications are separately optimized.",
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

    const context: Product = {
      ...selected,
      title: finalTitle,
      productType:
        finalProductType,
      audience,
      style,
    };

    const finalSeoTitle =
      buildSeoTitle(context);

    const finalMetaDescription =
      buildMetaDescription(
        context,
      );

    if (
      finalSeoTitle.length >
      50
    ) {
      setError(
        "SEO Title must be 50 characters or fewer.",
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

              /*
               * IMPORTANT:
               * Only the Product Description
               * is sent here.
               *
               * Features and Specifications
               * remain separate in Virello.
               */

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

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .detail-card {
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

        .detail-list {
          margin: 0;
          padding-left: 20px;
          line-height: 1.7;
        }

        .detail-list li {
          margin-bottom: 6px;
        }

        .empty-detail {
          color: #777;
          font-size: 14px;
          line-height: 1.5;
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

        .specs li {
          margin-bottom: 5px;
        }

        .empty {
          padding: 45px 20px;
          text-align: center;
          color: #777;
          font-size: 14px;
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

        @media (max-width: 700px) {
          .details-grid {
            grid-template-columns: 1fr;
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
                      Virello creates
                      separate
                      conversion copy
                      for the
                      storefront,
                      Google SEO,
                      meta snippet,
                      description,
                      features, and
                      specifications.
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

                {/* AUDIENCE / STYLE */}

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

                {/* PRODUCT TITLE */}

                <div className="field">
                  <label>
                    Product Title
                  </label>

                  <input
                    value={title}
                    onChange={(event) =>
                      handleTitleChange(
                        event.target
                          .value,
                      )
                    }
                  />

                  <div className="small-note">
                    Storefront title
                    focused on
                    product appeal.
                    It is NOT used
                    as the SEO Title.
                  </div>
                </div>

                {/* PRODUCT TYPE */}

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
                        event.target
                          .value,
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
                        event.target
                          .value,
                      )
                    }
                    placeholder="watch, luxury, chronograph"
                  />

                  <div className="small-note">
                    Separate tags
                    with commas.
                  </div>
                </div>

                {/* DESCRIPTION */}

                <div className="field">
                  <label>
                    Product Description
                  </label>

                  <textarea
                    className="description-textarea"
                    value={
                      description
                    }
                    onChange={(event) =>
                      setDescription(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Your conversion-focused product description will appear here..."
                  />

                  <div className="small-note">
                    The description
                    is selling copy.
                    It is separate
                    from the SEO
                    Title, Meta
                    Description,
                    Features, and
                    Specifications.
                  </div>
                </div>

                {/* FEATURES / SPECS */}

                <div className="section">
                  <div className="section-title">
                    Product Details
                  </div>

                  <div className="details-grid">

                    <div className="detail-card">
                      <div className="detail-title">
                        Key Features
                      </div>

                      {features.length >
                      0 ? (
                        <ul className="detail-list">
                          {features.map(
                            (
                              feature,
                              index,
                            ) => (
                              <li
                                key={`${feature}-${index}`}
                              >
                                {
                                  feature
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="empty-detail">
                          Features will
                          appear after
                          optimization.
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
                                {
                                  specification
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="empty-detail">
                          Supplier
                          specifications
                          will appear
                          here when
                          detected from
                          the source
                          product data.
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
                      value={
                        seoTitle
                      }
                      onChange={(event) =>
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

                    <div className="small-note">
                      Search-intent
                      title. This is
                      intentionally
                      different from
                      the Product
                      Title.
                    </div>
                  </div>

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

                    <div className="small-note">
                      Written to
                      improve search
                      result
                      click-through.
                      It is not a
                      copy of the
                      Product
                      Description.
                    </div>
                  </div>
                </div>

                {/* GENERATED CONTENT */}

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
                        {
                          optimized.title
                        }
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

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Key Features
                        </strong>
                      </div>

                      {optimized.features.length >
                      0 ? (
                        <ul className="specs">
                          {optimized.features.map(
                            (
                              feature,
                              index,
                            ) => (
                              <li
                                key={`${feature}-${index}`}
                              >
                                {
                                  feature
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="generated-content">
                          No features
                          generated.
                        </div>
                      )}
                    </div>

                    <div className="generated">
                      <div className="generated-head">
                        <strong>
                          Specifications
                        </strong>
                      </div>

                      {optimized.specifications.length >
                      0 ? (
                        <ul className="specs">
                          {optimized.specifications.map(
                            (
                              specification,
                              index,
                            ) => (
                              <li
                                key={`${specification}-${index}`}
                              >
                                {
                                  specification
                                }
                              </li>
                            ),
                          )}
                        </ul>
                      ) : (
                        <div className="generated-content">
                          No explicit
                          supplier
                          specifications
                          were found.
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
