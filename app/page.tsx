"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type Product = {
  id: string;
  title: string;
  description: string;
  price: string;
  images: string[];
  productType: string;
  tags: string;
  audience: "Women" | "Men" | "Unisex";
  style:
    | "Premium / Luxury"
    | "Professional"
    | "Everyday"
    | "Casual"
    | "Sport"
    | "Gift";
  vendor: string;
};

type Result = {
  title: string;
  description: string;
  bullets: string[];
  specs: string[];
  faq: {
    q: string;
    a: string;
  }[];
  seoTitle: string;
  metaDescription: string;
};

const clean = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();

const limit = (value: string, max: number) => {
  const text = clean(value);

  if (text.length <= max) {
    return text;
  }

  const cut = text.slice(0, max + 1);
  const end = cut.lastIndexOf(" ");

  return cut
    .slice(0, end > 0 ? end : max)
    .replace(/[.,;:!?-]+$/, "");
};

function uniqueWords(value: string) {
  const words = clean(value)
    .split(/\s+/)
    .filter(Boolean);

  const result: string[] = [];
  const seen = new Set<string>();

  for (const word of words) {
    const normalized = word
      .toLowerCase()
      .replace(/[^a-z0-9']/g, "");

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(word);
  }

  return result;
}

function isWatchProduct(product: Product) {
  return /watch|timepiece|chronograph|automatic|quartz|mechanical/i.test(
    `${product.title} ${product.productType} ${product.tags}`
  );
}

function buildTitle(
  sourceTitle: string,
  audience: Product["audience"],
  productType: string
) {
  const isWatch =
    /watch|timepiece|chronograph|automatic|quartz/i.test(
      `${sourceTitle} ${productType}`
    );

  let source = clean(sourceTitle)
    .replace(
      /\b(official|wholesale|dropshipping|free shipping|cheap|hot sale|new arrival|2024|2025|2026)\b/gi,
      ""
    )
    .replace(/[|,:;()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = uniqueWords(source);

  if (isWatch) {
    const gender =
      audience === "Women"
        ? "Women's"
        : audience === "Men"
          ? "Men's"
          : "Unisex";

    const filtered = words.filter(
      (word) =>
        !/\b(men|men's|women|women's|unisex|watch|timepiece)\b/i.test(
          word
        )
    );

    const base = filtered.slice(0, 6).join(" ");

    return clean(`${base} ${gender} Watch`);
  }

  return clean(words.slice(0, 8).join(" "));
}

/* ---------------------------------------
   BETTER SPEC EXTRACTION
--------------------------------------- */

function extractSpecs(description: string) {
  const text = stripHtml(description);
  const specs: string[] = [];

  const patterns = [
    {
      label: "Movement",
      regex:
        /\b(?:movement|mechanism|caliber|calibre)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Case Material",
      regex:
        /\bcase\s*material\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Case Size",
      regex:
        /\b(?:case\s*size|case\s*diameter|dial\s*diameter|diameter)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Water Resistance",
      regex:
        /\b(?:water\s*resistance|water\s*resistant|waterproof)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Strap",
      regex:
        /\b(?:strap|band|bracelet)(?:\s*material)?\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Crystal",
      regex:
        /\b(?:crystal|glass)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Power Reserve",
      regex:
        /\bpower\s*reserve\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Dial Color",
      regex:
        /\b(?:dial\s*color|dial\s*colour)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Case Color",
      regex:
        /\b(?:case\s*color|case\s*colour)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Band Color",
      regex:
        /\b(?:band\s*color|band\s*colour|strap\s*color|strap\s*colour)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Clasp",
      regex:
        /\b(?:clasp|buckle)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
    {
      label: "Functions",
      regex:
        /\b(?:functions|features|function)\s*[:\-]?\s*([^.;,\n]+)/i,
    },
  ];

  for (const item of patterns) {
    const match = text.match(item.regex);

    if (match?.[1]) {
      const value = clean(match[1]);

      if (
        value &&
        value.length > 1 &&
        value.length < 100
      ) {
        specs.push(`${item.label}: ${value}`);
      }
    }
  }

  return specs;
}

/* ---------------------------------------
   TAG HELPERS
--------------------------------------- */

function getTags(product: Product) {
  return product.tags
    .split(",")
    .map((tag) => clean(tag))
    .filter(Boolean);
}

function hasKeyword(
  product: Product,
  keywords: string[]
) {
  const source =
    `${product.title} ${product.productType} ${product.tags} ${product.description}`.toLowerCase();

  return keywords.some((keyword) =>
    source.includes(keyword.toLowerCase())
  );
}

/* ---------------------------------------
   DESCRIPTION
--------------------------------------- */

function buildDescription(product: Product) {
  const title = buildTitle(
    product.title,
    product.audience,
    product.productType
  );

  const original = stripHtml(
    product.description
  );

  const audience =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  if (original.length > 40) {
    return limit(
      `${title}. ${original}`,
      520
    );
  }

  if (isWatchProduct(product)) {
    return limit(
      `${title} offers a refined look for ${audience}, combining versatile styling with a polished presence that works across everyday and more dressed-up occasions.`,
      520
    );
  }

  return limit(
    `${title} is designed for ${audience} with a ${product.style.toLowerCase()} presentation suited to everyday use and personal style.`,
    520
  );
}

/* ---------------------------------------
   BULLETS
--------------------------------------- */

function buildBullets(product: Product) {
  const watch = isWatchProduct(product);

  const bullets = watch
    ? [
        "Refined design with a polished presence",
        "Versatile styling for everyday and dressier occasions",
        "A practical choice for personal wear or gifting",
        "Product details presented from the available listing information",
      ]
    : [
        "Clean and versatile design",
        "Easy to incorporate into everyday use",
        "Suitable for personal use or gifting",
        "Product details presented from the available listing information",
      ];

  if (
    hasKeyword(product, [
      "automatic",
      "mechanical",
    ])
  ) {
    bullets[2] =
      "Automatic-style movement featured in the product listing";
  }

  if (
    hasKeyword(product, [
      "chronograph",
    ])
  ) {
    bullets[1] =
      "Chronograph-inspired styling with a versatile wrist presence";
  }

  if (
    hasKeyword(product, [
      "water resistant",
      "water resistance",
    ])
  ) {
    bullets[3] =
      "Water-resistance information is presented when specified in the listing";
  }

  return bullets;
}

/* ---------------------------------------
   FAQ
--------------------------------------- */

function buildFaq(
  product: Product,
  factualSpecs: string[]
) {
  const title = buildTitle(
    product.title,
    product.audience,
    product.productType
  );

  const audienceText =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  const watch = isWatchProduct(product);

  const faq: Result["faq"] = [];

  /* 1 */
  faq.push({
    q: "What type of product is this?",
    a: product.productType
      ? `This is a ${clean(
          product.productType
        )}, presented as ${title}.`
      : `This product is presented as ${title}.`,
  });

  /* 2 */
  faq.push({
    q: "Who is this product designed for?",
    a: `This style is intended for ${audienceText}, making it a versatile choice for personal wear and everyday styling.`,
  });

  /* 3 */
  if (watch) {
    faq.push({
      q: "What makes this watch a versatile choice?",
      a: `The ${title} is designed with a polished look that can complement both everyday outfits and more refined occasions.`,
    });
  } else {
    faq.push({
      q: "What makes this product useful?",
      a: `${title} is presented as a ${product.style.toLowerCase()} option designed to fit naturally into everyday use.`,
    });
  }

  /* 4 */
  if (factualSpecs.length > 0) {
    faq.push({
      q: "What product details are available?",
      a: `The available listing information includes ${factualSpecs
        .slice(0, 4)
        .map((item) => item.replace(/^.*?:\s*/, ""))
        .join(", ")}. These details come directly from the supplied product information.`,
    });
  } else {
    faq.push({
      q: "What product details are available?",
      a: `The listing provides the product title, product type, presentation details and the available product description. Technical specifications are only shown when they are supplied with the product information.`,
    });
  }

  /* 5 */
  faq.push({
    q: "Can this product be given as a gift?",
    a: `Yes. Its ${product.style.toLowerCase()} presentation makes it suitable to consider as a gift for someone who appreciates this style.`,
  });

  /* 6 */
  faq.push({
    q: "Are the product specifications verified?",
    a: `The specifications shown by Virello are taken from the supplied product listing. Virello does not add technical measurements or performance claims that are not present in the available product information.`,
  });

  return faq;
}

/* ---------------------------------------
   MAIN GENERATOR
--------------------------------------- */

function generateResult(
  product: Product
): Result {
  const title = buildTitle(
    product.title,
    product.audience,
    product.productType
  );

  const factualSpecs = extractSpecs(
    product.description
  );

  const description =
    buildDescription(product);

  const bullets =
    buildBullets(product);

  const specs = [
    `Product Type: ${
      product.productType || "Product"
    }`,
    `Audience: ${product.audience}`,
    `Style: ${product.style}`,
  ];

  if (product.vendor) {
    specs.push(
      `Brand / Vendor: ${product.vendor}`
    );
  }

  if (product.price) {
    specs.push(
      `Price: $${product.price}`
    );
  }

  if (product.tags) {
    const tags = getTags(product);

    if (tags.length > 0) {
      specs.push(
        `Product Tags: ${tags
          .slice(0, 8)
          .join(", ")}`
      );
    }
  }

  if (factualSpecs.length) {
    specs.push(
      ...factualSpecs
    );
  }

  const faq = buildFaq(
    product,
    factualSpecs
  );

  const seoTitle = limit(
    title || "Product",
    70
  );

  const audiencePhrase =
    product.audience === "Unisex"
      ? "men and women"
      : product.audience.toLowerCase();

  const metaDescription = limit(
    `Shop ${title}. Explore the design, product details and available specifications for ${audiencePhrase}.`,
    160
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

/* ---------------------------------------
   SHOPIFY TOKEN
--------------------------------------- */

function getShopFromToken(
  token: string
) {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return "";
    }

    const base64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded =
      base64 +
      "=".repeat(
        (4 -
          (base64.length % 4)) %
          4
      );

    const payload = JSON.parse(
      atob(padded)
    );

    if (
      typeof payload.dest !==
      "string"
    ) {
      return "";
    }

    return new URL(
      payload.dest
    ).hostname;
  } catch {
    return "";
  }
}

/* ---------------------------------------
   IMAGE UPLOAD
--------------------------------------- */

function readImage(
  file: File
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result ===
          "string"
        ) {
          resolve(
            reader.result
          );
        } else {
          reject(
            new Error(
              "Could not read image."
            )
          );
        }
      };

      reader.onerror = () =>
        reject(
          new Error(
            "Could not read image."
          )
        );

      reader.readAsDataURL(file);
    }
  );
}

/* ---------------------------------------
   EMPTY PRODUCT
--------------------------------------- */

const emptyProduct: Product = {
  id: "",
  title: "",
  description: "",
  price: "",
  images: [],
  productType: "Watch",
  tags: "",
  audience: "Men",
  style: "Premium / Luxury",
  vendor: "",
};

/* ---------------------------------------
   APP
--------------------------------------- */

export default function Home() {
  const [products, setProducts] =
    useState<ShopifyProduct[]>([]);

  const [
    loadingProducts,
    setLoadingProducts,
  ] = useState(false);

  const [
    shopifyConnected,
    setShopifyConnected,
  ] = useState(false);

  const [
    connectionMessage,
    setConnectionMessage,
  ] = useState("");

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [product, setProduct] =
    useState<Product>(
      emptyProduct
    );

  const [result, setResult] =
    useState<Result | null>(
      null
    );

  const [generated, setGenerated] =
    useState(false);

  const [activeImage, setActiveImage] =
    useState(0);

  const [copied, setCopied] =
    useState("");

  const liveResult = useMemo(
    () =>
      product.title.trim()
        ? generateResult(product)
        : null,
    [product]
  );

  const active =
    result ?? liveResult;

  const update = <
    K extends keyof Product
  >(
    key: K,
    value: Product[K]
  ) => {
    setProduct(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  };

  /* ---------------------------------------
     SHOPIFY SESSION TOKEN
  --------------------------------------- */

  async function getShopifySessionToken() {
    if (
      typeof window ===
        "undefined" ||
      !window.shopify?.idToken
    ) {
      throw new Error(
        "Shopify session token is unavailable. Open Virello from Shopify Admin."
      );
    }

    return window.shopify.idToken();
  }

  /* ---------------------------------------
     LOAD PRODUCTS
  --------------------------------------- */

  async function loadShopifyProducts() {
    setLoadingProducts(true);
    setConnectionMessage("");

    try {
      const token =
        await getShopifySessionToken();

      const shop =
        getShopFromToken(
          token
        );

      if (!shop) {
        throw new Error(
          "Could not determine the Shopify store."
        );
      }

      const response =
        await fetch(
          "/api/shopify/products",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "x-shopify-shop":
                shop,
            },
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        data.success !== true
      ) {
        throw new Error(
          data.error ||
            "Unable to load Shopify products."
        );
      }

      const loadedProducts =
        Array.isArray(
          data.products
        )
          ? data.products
          : [];

      setProducts(
        loadedProducts
      );

      setShopifyConnected(
        true
      );

      setConnectionMessage(
        `${loadedProducts.length} product${
          loadedProducts.length ===
          1
            ? ""
            : "s"
        } loaded.`
      );
    } catch (error) {
      setShopifyConnected(
        false
      );

      setConnectionMessage(
        error instanceof
          Error
          ? error.message
          : "Connection failed."
      );
    } finally {
      setLoadingProducts(
        false
      );
    }
  }

  useEffect(() => {
    void loadShopifyProducts();
  }, []);

  /* ---------------------------------------
     SELECT SHOPIFY PRODUCT
  --------------------------------------- */

  function selectShopifyProduct(
    productId: string
  ) {
    const selected =
      products.find(
        (item) =>
          item.id ===
          productId
      );

    if (!selected) {
      return;
    }

    const images =
      selected.images?.length
        ? selected.images.map(
            (image) =>
              image.url
          )
        : selected.featuredImage
          ? [
              selected.featuredImage,
            ]
          : [];

    let audience:
      Product["audience"] =
      "Men";

    if (
      /women|female|ladies/i.test(
        `${selected.title} ${selected.productType} ${selected.tags.join(
          " "
        )}`
      )
    ) {
      audience =
        "Women";
    } else if (
      /unisex/i.test(
        `${selected.title} ${selected.productType}`
      )
    ) {
      audience =
        "Unisex";
    }

    let style:
      Product["style"] =
      "Professional";

    if (
      /luxury|premium|chronograph|automatic|mechanical/i.test(
        `${selected.title} ${selected.productType}`
      )
    ) {
      style =
        "Premium / Luxury";
    }

    setSelectedProductId(
      productId
    );

    setProduct({
      id: selected.id,
      title:
        selected.title ||
        "",
      description:
        selected.description ||
        "",
      price:
        selected.price ||
        "",
      images,
      productType:
        selected.productType ||
        "Watch",
      tags:
        Array.isArray(
          selected.tags
        )
          ? selected.tags.join(
              ", "
            )
          : "",
      audience,
      style,
      vendor:
        selected.vendor ||
        "",
    });

    setActiveImage(0);
    setGenerated(false);
    setResult(null);
  }

  /* ---------------------------------------
     UPLOAD IMAGES
  --------------------------------------- */

  async function uploadImages(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        e.target.files ?? []
      )
        .filter((file) =>
          file.type.startsWith(
            "image/"
          )
        )
        .slice(0, 6);

    if (!files.length) {
      return;
    }

    try {
      const images =
        await Promise.all(
          files.map(
            readImage
          )
        );

      update(
        "images",
        images
      );

      setActiveImage(0);
    } catch {
      alert(
        "Unable to read one or more images."
      );
    } finally {
      e.target.value = "";
    }
  }

  function removeImage(
    index: number
  ) {
    const images =
      product.images.filter(
        (_, i) =>
          i !== index
      );

    update(
      "images",
      images
    );

    setActiveImage(
      Math.max(
        0,
        Math.min(
          activeImage,
          Math.max(
            images.length -
              1,
            0
          )
        )
      )
    );
  }

  /* ---------------------------------------
     GENERATE
  --------------------------------------- */

  function generate() {
    if (!product.title.trim()) {
      alert(
        "Select a product first."
      );
      return;
    }

    const generatedResult =
      generateResult(
        product
      );

    setResult(
      generatedResult
    );

    setGenerated(true);

    window.setTimeout(
      () => {
        document
          .getElementById(
            "preview"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",
          });
      },
      50
    );
  }

  /* ---------------------------------------
     COPY
  --------------------------------------- */

  async function copyText(
    label: string,
    text: string
  ) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(label);

      window.setTimeout(
        () =>
          setCopied(""),
        1500
      );
    } catch {
      setCopied("");
    }
  }

  /* ---------------------------------------
     RESET
  --------------------------------------- */

  function reset() {
    setGenerated(false);
    setResult(null);
    setActiveImage(0);

    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }

  /* ---------------------------------------
     UI
  --------------------------------------- */

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <div className="logo">
            VIRELLO
          </div>

          <div className="micro">
            AI PRODUCT OPTIMIZER
          </div>
        </div>

        <div className="status">
          <span
            className={
              shopifyConnected
                ? "connected"
                : ""
            }
          />

          {shopifyConnected
            ? "Connected"
            : "Not Connected"}
        </div>
      </header>

      {!generated ? (
        <section className="workspace">
          <div className="hero">
            <div className="eyebrow">
              PRODUCT OPTIMIZATION
            </div>

            <h1>
              Build product pages
              shoppers understand
              and want.
            </h1>

            <p>
              Turn your product
              information into
              clear, persuasive
              and search-ready
              product copy without
              inventing specifications.
            </p>
          </div>

          <section className="card shopify-card">
            <div className="shopify-head">
              <div>
                <div className="eyebrow">
                  STORE PRODUCTS
                </div>

                <h2>
                  Your products
                </h2>

                <p>
                  Select a product
                  directly from your
                  store.
                </p>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void loadShopifyProducts()
                }
                disabled={
                  loadingProducts
                }
              >
                {loadingProducts
                  ? "Loading..."
                  : "Refresh Products"}
              </button>
            </div>

            {connectionMessage && (
              <div
                className={
                  shopifyConnected
                    ? "connection success"
                    : "connection"
                }
              >
                {connectionMessage}
              </div>
            )}

            <div className="productPicker">
              <select
                className="input"
                value={
                  selectedProductId
                }
                onChange={(e) =>
                  selectShopifyProduct(
                    e.target
                      .value
                  )
                }
                disabled={
                  loadingProducts ||
                  products.length ===
                    0
                }
              >
                <option value="">
                  {products.length
                    ? "Select a product..."
                    : "No products loaded"}
                </option>

                {products.map(
                  (item) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {
                        item.title
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          </section>

          <div className="layout">
            <section className="card form-card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">
                    01 / PRODUCT
                  </div>

                  <h2>
                    Product information
                  </h2>
                </div>

                <span className="badge">
                  Ready
                </span>
              </div>

              <label>
                Product Title
              </label>

              <textarea
                value={
                  product.title
                }
                onChange={(e) =>
                  update(
                    "title",
                    e.target
                      .value
                  )
                }
                placeholder="Select a product"
              />

              <label>
                Original Description{" "}
                <span className="optional">
                  From product listing
                </span>
              </label>

              <textarea
                value={stripHtml(
                  product.description
                )}
                onChange={(e) =>
                  update(
                    "description",
                    e.target
                      .value
                  )
                }
                placeholder="Product description"
              />

              <div className="grid2">
                <div>
                  <label>
                    Price
                  </label>

                  <div className="input money">
                    <span>
                      $
                    </span>

                    <input
                      value={
                        product.price
                      }
                      onChange={(
                        e
                      ) =>
                        update(
                          "price",
                          e.target
                            .value
                        )
                      }
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div>
                  <label>
                    Product Type
                  </label>

                  <input
                    className="input"
                    value={
                      product.productType
                    }
                    onChange={(
                      e
                    ) =>
                      update(
                        "productType",
                        e.target
                          .value
                      )
                    }
                  />
                </div>
              </div>

              <label>
                Product Tags
              </label>

              <input
                className="input"
                value={
                  product.tags
                }
                onChange={(e) =>
                  update(
                    "tags",
                    e.target
                      .value
                  )
                }
                placeholder="Product tags"
              />

              {product.vendor && (
                <>
                  <label>
                    Vendor
                  </label>

                  <input
                    className="input"
                    value={
                      product.vendor
                    }
                    readOnly
                  />
                </>
              )}

              <div className="grid2">
                <div>
                  <label>
                    Target Audience
                  </label>

                  <div className="pills">
                    {[
                      "Women",
                      "Men",
                      "Unisex",
                    ].map(
                      (
                        item
                      ) => (
                        <button
                          type="button"
                          className={
                            product.audience ===
                            item
                              ? "pill selected"
                              : "pill"
                          }
                          onClick={() =>
                            update(
                              "audience",
                              item as Product["audience"]
                            )
                          }
                          key={
                            item
                          }
                        >
                          {
                            item
                          }
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label>
                    Writing Style
                  </label>

                  <select
                    className="input select"
                    value={
                      product.style
                    }
                    onChange={(
                      e
                    ) =>
                      update(
                        "style",
                        e.target
                          .value as Product["style"]
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
              </div>

              <label>
                Product Images
              </label>

              <div className="shopify-images">
                {product.images
                  .length ? (
                  product.images.map(
                    (
                      image,
                      index
                    ) => (
                      <div
                        className="shop-image"
                        key={`${image}-${index}`}
                      >
                        <img
                          src={image}
                          alt={`Product ${
                            index +
                            1
                          }`}
                        />
                      </div>
                    )
                  )
                ) : (
                  <div className="no-image">
                    No product
                    images found.
                  </div>
                )}
              </div>

              <details className="manual">
                <summary>
                  Manual image upload
                </summary>

                <div className="upload">
                  <input
                    id="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={
                      uploadImages
                    }
                  />

                  <label
                    htmlFor="images"
                    className="uploadButton"
                  >
                    + Add Product
                    Images
                  </label>

                  <p>
                    Optional fallback
                    for local testing.
                  </p>
                </div>

                {product.images
                  .length >
                  0 && (
                  <div className="thumbGrid">
                    {product.images.map(
                      (
                        image,
                        index
                      ) => (
                        <div
                          className="thumb"
                          key={`${image}-${index}`}
                        >
                          <img
                            src={
                              image
                            }
                            alt={`Product ${
                              index +
                              1
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeImage(
                                index
                              )
                            }
                            aria-label={`Remove image ${
                              index +
                              1
                            }`}
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </details>

              <button
                type="button"
                className="primary"
                onClick={
                  generate
                }
              >
                Generate Optimized
                Product Page
                <span>
                  →
                </span>
              </button>
            </section>

            <aside className="card live-card">
              <div className="section-head">
                <div>
                  <div className="eyebrow">
                    LIVE PREVIEW
                  </div>

                  <h2>
                    Product preview
                  </h2>
                </div>
              </div>

              <div className="mini-product">
                <div className="mini-image">
                  {product
                    .images[0] ? (
                    <img
                      src={
                        product
                          .images[0]
                      }
                      alt="Product"
                    />
                  ) : (
                    <span>
                      Product Image
                    </span>
                  )}
                </div>

                <div className="mini-kicker">
                  PRODUCT PREVIEW
                </div>

                <h3>
                  {liveResult?.title ||
                    "Select a product"}
                </h3>

                <strong>
                  $
                  {product.price ||
                    "0.00"}
                </strong>

                <p>
                  {liveResult?.description ||
                    "Your product information will appear here."}
                </p>

                <div className="mini-checks">
                  <span>
                    ✓ Product Data
                  </span>

                  <span>
                    ✓ Product Images
                  </span>

                  <span>
                    ✓ SEO Copy
                  </span>

                  <span>
                    ✓ FAQ
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <section
          id="preview"
          className="preview"
        >
          <div className="previewTop">
            <button
              type="button"
              className="back"
              onClick={
                reset
              }
            >
              ← Edit Product
            </button>

            <div className="eyebrow">
              OPTIMIZED PRODUCT PAGE
            </div>
          </div>

          <div className="productHero">
            <div className="gallery">
              <div className="mainPhoto">
                {product
                  .images[
                  activeImage
                ] ? (
                  <img
                    src={
                      product
                        .images[
                        activeImage
                      ]
                    }
                    alt={
                      active?.title ||
                      "Product"
                    }
                  />
                ) : (
                  <span>
                    Product Image
                  </span>
                )}
              </div>

              {product.images
                .length >
                0 && (
                <div className="galleryThumbs">
                  {product.images.map(
                    (
                      image,
                      index
                    ) => (
                      <button
                        type="button"
                        key={`${image}-${index}`}
                        className={
                          index ===
                          activeImage
                            ? "galleryThumb active"
                            : "galleryThumb"
                        }
                        onClick={() =>
                          setActiveImage(
                            index
                          )
                        }
                      >
                        <img
                          src={
                            image
                          }
                          alt={`View ${
                            index +
                            1
                          }`}
                        />
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="heroCopy">
              <div className="eyebrow">
                PRODUCT COLLECTION
              </div>

              <h2>
                {
                  active?.title
                }
              </h2>

              <div className="priceLarge">
                $
                {
                  product.price
                }
              </div>

              <p className="lead">
                {
                  active?.description
                }
              </p>

              <div className="benefits">
                {active?.bullets.map(
                  (item) => (
                    <div
                      key={
                        item
                      }
                    >
                      ✓{" "}
                      {item}
                    </div>
                  )
                )}
              </div>

              <div className="trust">
                <span>
                  Product information
                  sourced from
                  your listing
                </span>

                <span>
                  Original product
                  images
                </span>
              </div>
            </div>
          </div>

          {/* BENEFITS */}

          <section className="resultSection">
            <div className="eyebrow">
              PRODUCT BENEFITS
            </div>

            <h3>
              Clear reasons to keep
              reading.
            </h3>

            <div className="fourCards">
              {active?.bullets.map(
                (
                  item,
                  index
                ) => (
                  <article
                    className="feature"
                    key={
                      item
                    }
                  >
                    <small>
                      0
                      {index +
                        1}
                    </small>

                    <h4>
                      {
                        [
                          "Refined Design",
                          "Versatile Styling",
                          "Product Details",
                          "Gift Worthy",
                        ][
                          index
                        ]
                      }
                    </h4>

                    <p>
                      {
                        item
                      }
                    </p>
                  </article>
                )
              )}
            </div>
          </section>

          {/* SPECIFICATIONS */}

          <section className="resultSection">
            <div className="eyebrow">
              PRODUCT INFORMATION
            </div>

            <h3>
              Simple, useful
              product details.
            </h3>

            <div className="specList">
              {active?.specs.map(
                (
                  spec
                ) => {
                  const [
                    key,
                    ...rest
                  ] =
                    spec.split(
                      ":"
                    );

                  return (
                    <div
                      className="spec"
                      key={
                        spec
                      }
                    >
                      <span>
                        {
                          key
                        }
                      </span>

                      <strong>
                        {rest
                          .join(
                            ":"
                          )
                          .trim()}
                      </strong>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {/* FAQ */}

          <section className="resultSection">
            <div className="eyebrow">
              FREQUENTLY ASKED QUESTIONS
            </div>

            <h3>
              Helpful answers for
              shoppers.
            </h3>

            <div className="faq">
              {active?.faq.map(
                (
                  item
                ) => (
                  <details
                    key={
                      item.q
                    }
                  >
                    <summary>
                      {
                        item.q
                      }
                    </summary>

                    <p>
                      {
                        item.a
                      }
                    </p>
                  </details>
                )
              )}
            </div>
          </section>

          {/* SEO */}

          <section className="resultSection">
            <div className="eyebrow">
              SEO
            </div>

            <h3>
              Search-ready content.
            </h3>

            <div className="seoGrid">
              <div className="seoBox">
                <div className="seoTop">
                  <strong>
                    SEO Title
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        "title",
                        active?.seoTitle ||
                          ""
                      )
                    }
                  >
                    {copied ===
                    "title"
                      ? "Copied"
                      : "Copy"}
                  </button>
                </div>

                <p>
                  {
                    active?.seoTitle
                  }
                </p>

                <small>
                  {
                    active
                      ?.seoTitle
                      .length
                  }
                  /70 characters
                </small>
              </div>

              <div className="seoBox">
                <div className="seoTop">
                  <strong>
                    Meta Description
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        "meta",
                        active?.metaDescription ||
                          ""
                      )
                    }
                  >
                    {copied ===
                    "meta"
                      ? "Copied"
                      : "Copy"}
                  </button>
                </div>

                <p>
                  {
                    active?.metaDescription
                  }
                </p>

                <small>
                  {
                    active
                      ?.metaDescription
                      .length
                  }
                  /160 characters
                </small>
              </div>
            </div>
          </section>

          {/* FINAL */}

          <section className="resultSection finalCallout">
            <div className="eyebrow">
              READY
            </div>

            <h3>
              Your product page is
              ready to refine.
            </h3>

            <p>
              Virello builds the
              optimized copy from
              the product information
              available in your
              listing, while avoiding
              unsupported technical
              claims.
            </p>

            <button
              type="button"
              className="primary"
              onClick={
                reset
              }
            >
              OPTIMIZE ANOTHER
              PRODUCT →
            </button>
          </section>
        </section>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f5f5f2;
          color: #151515;
          font-family:
            Inter,
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

        button {
          cursor: pointer;
        }

        .app {
          min-height: 100vh;
        }

        .topbar {
          min-height: 82px;
          padding: 0 5vw;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #deded9;
          background: #fff;
        }

        .logo {
          font-weight: 800;
          letter-spacing: .12em;
          font-size: 19px;
        }

        .micro,
        .eyebrow {
          font-size: 11px;
          letter-spacing: .13em;
          font-weight: 700;
          color: #777;
        }

        .micro {
          margin-top: 3px;
          font-weight: 500;
        }

        .status {
          font-size: 13px;
          color: #666;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .status span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #999;
          display: inline-block;
        }

        .status span.connected {
          background: #111;
        }

        .workspace,
        .preview {
          width: min(1220px, 90vw);
          margin: auto;
        }

        .workspace {
          padding: 70px 0 100px;
        }

        .hero {
          max-width: 900px;
          margin-bottom: 52px;
        }

        .hero h1 {
          font-size: clamp(48px, 7vw, 86px);
          line-height: .96;
          letter-spacing: -.055em;
          margin: 22px 0;
        }

        .hero p {
          max-width: 720px;
          font-size: 19px;
          line-height: 1.55;
          color: #555;
          margin: 0;
        }

        .layout {
          display: grid;
          grid-template-columns: 1.35fr .65fr;
          gap: 22px;
          margin-top: 22px;
        }

        .card {
          background: #fff;
          border: 1px solid #deded9;
          border-radius: 22px;
          padding: 32px;
        }

        .shopify-card {
          margin-bottom: 22px;
        }

        .shopify-head {
          display: flex;
          justify-content: space-between;
          gap: 25px;
          align-items: flex-start;
        }

        .shopify-head h2 {
          margin: 9px 0 5px;
          font-size: 25px;
        }

        .shopify-head p {
          margin: 0;
          color: #777;
          font-size: 14px;
        }

        .secondary {
          border: 1px solid #d5d5d0;
          background: #fff;
          border-radius: 9px;
          padding: 12px 16px;
          font-weight: 650;
        }

        .secondary:disabled {
          opacity: .5;
          cursor: wait;
        }

        .connection {
          margin-top: 20px;
          padding: 12px 14px;
          border-radius: 9px;
          background: #f1f1ed;
          color: #666;
          font-size: 13px;
        }

        .connection.success {
          background: #f0f0ec;
          color: #222;
        }

        .productPicker {
          margin-top: 18px;
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 30px;
        }

        .section-head h2 {
          font-size: 25px;
          margin: 9px 0 0;
          letter-spacing: -.03em;
        }

        .badge {
          border: 1px solid #ddd;
          border-radius: 99px;
          padding: 8px 11px;
          font-size: 11px;
          color: #666;
        }

        label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin: 22px 0 8px;
        }

        .optional {
          font-weight: 400;
          color: #999;
        }

        textarea,
        .input {
          width: 100%;
          border: 1px solid #d7d7d2;
          background: #fafaf8;
          border-radius: 11px;
          outline: none;
        }

        textarea {
          min-height: 105px;
          padding: 14px;
          resize: vertical;
        }

        textarea:focus,
        .input:focus {
          border-color: #111;
          background: #fff;
        }

        .input {
          height: 48px;
          padding: 0 13px;
        }

        .money {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .money input {
          border: 0;
          outline: 0;
          background: transparent;
          width: 100%;
          height: 100%;
        }

        .select {
          appearance: auto;
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .pills {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .pill {
          border: 1px solid #d7d7d2;
          background: #fff;
          border-radius: 99px;
          padding: 11px 14px;
        }

        .pill.selected {
          background: #151515;
          color: #fff;
          border-color: #151515;
        }

        .shopify-images {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .shop-image {
          aspect-ratio: 1;
          border-radius: 10px;
          overflow: hidden;
          background: #eee;
          border: 1px solid #ddd;
        }

        .shop-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .no-image {
          grid-column: 1 / -1;
          border: 1px dashed #ccc;
          padding: 25px;
          text-align: center;
          color: #888;
          border-radius: 10px;
        }

        .manual {
          margin-top: 18px;
          border-top: 1px solid #ddd;
          padding-top: 16px;
        }

        .manual summary {
          font-size: 13px;
          font-weight: 700;
        }

        .upload {
          border: 1px dashed #c9c9c3;
          background: #fafaf8;
          border-radius: 14px;
          text-align: center;
          padding: 22px;
          margin-top: 14px;
        }

        .upload input {
          display: none;
        }

        .uploadButton {
          display: inline-flex !important;
          margin: 0 !important;
          align-items: center;
          justify-content: center;
          background: #151515;
          color: #fff;
          border-radius: 9px;
          padding: 13px 17px;
          cursor: pointer;
        }

        .upload p {
          font-size: 12px;
          color: #888;
          margin: 10px 0 0;
        }

        .thumbGrid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-top: 12px;
        }

        .thumb {
          position: relative;
          aspect-ratio: 1;
          border-radius: 9px;
          overflow: hidden;
          border: 1px solid #ddd;
        }

        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .thumb button {
          position: absolute;
          right: 4px;
          top: 4px;
          border: 0;
          border-radius: 50%;
          width: 23px;
          height: 23px;
          background: #111;
          color: #fff;
          line-height: 1;
        }

        .primary {
          width: 100%;
          min-height: 56px;
          border: 0;
          border-radius: 10px;
          background: #151515;
          color: #fff;
          font-weight: 750;
          margin-top: 28px;
        }

        .primary span {
          margin-left: 7px;
        }

        .live-card {
          height: max-content;
          position: sticky;
          top: 20px;
        }

        .mini-product {
          border: 1px solid #e1e1dc;
          border-radius: 16px;
          padding: 16px;
        }

        .mini-image {
          aspect-ratio: 1;
          background: #eee;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          overflow: hidden;
        }

        .mini-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mini-kicker {
          font-size: 10px;
          letter-spacing: .12em;
          color: #777;
          margin-top: 20px;
        }

        .mini-product h3 {
          font-size: 25px;
          line-height: 1.05;
          letter-spacing: -.035em;
          margin: 10px 0 13px;
        }

        .mini-product > strong {
          font-size: 18px;
        }

        .mini-product p {
          font-size: 13px;
          line-height: 1.55;
          color: #666;
        }

        .mini-checks {
          display: grid;
          gap: 7px;
          font-size: 12px;
          color: #555;
        }

        .preview {
          padding: 35px 0 100px;
        }

        .previewTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 38px;
        }

        .back {
          background: #fff;
          border: 1px solid #d7d7d2;
          border-radius: 9px;
          padding: 11px 14px;
        }

        .productHero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 70px;
        }

        .mainPhoto {
          aspect-ratio: 1;
          background: #eee;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: #999;
        }

        .mainPhoto img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .galleryThumbs {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          margin-top: 9px;
        }

        .galleryThumb {
          border: 1px solid #ddd;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          padding: 0;
          aspect-ratio: 1;
        }

        .galleryThumb.active {
          border: 2px solid #111;
        }

        .galleryThumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .heroCopy {
          padding-top: 25px;
        }

        .heroCopy h2 {
          font-size: clamp(42px, 5vw, 70px);
          line-height: 1;
          letter-spacing: -.055em;
          margin: 18px 0;
        }

        .priceLarge {
          font-size: 24px;
          font-weight: 700;
          margin: 24px 0;
        }

        .lead {
          font-size: 18px;
          line-height: 1.65;
          color: #4d4d4d;
          max-width: 650px;
        }

        .benefits {
          display: grid;
          gap: 10px;
          margin-top: 28px;
          line-height: 1.45;
        }

        .trust {
          display: flex;
          gap: 17px;
          flex-wrap: wrap;
          color: #777;
          font-size: 12px;
          margin-top: 14px;
        }

        .resultSection {
          border-top: 1px solid #d4d4cf;
          margin-top: 100px;
          padding-top: 44px;
        }

        .resultSection h3 {
          font-size: clamp(40px, 5vw, 64px);
          line-height: 1;
          letter-spacing: -.05em;
          max-width: 850px;
          margin: 18px 0 34px;
        }

        .fourCards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 13px;
        }

        .feature {
          background: #fff;
          border: 1px solid #deded9;
          border-radius: 17px;
          padding: 23px;
        }

        .feature small {
          color: #888;
        }

        .feature h4 {
          font-size: 19px;
          margin: 28px 0 9px;
        }

        .feature p {
          font-size: 13px;
          line-height: 1.55;
          color: #666;
          margin: 0;
        }

        .specList {
          border-top: 1px solid #ccc;
        }

        .spec {
          display: flex;
          justify-content: space-between;
          padding: 18px 0;
          border-bottom: 1px solid #ccc;
          gap: 20px;
        }

        .spec span {
          color: #777;
        }

        .spec strong {
          text-align: right;
        }

        .faq details {
          border-top: 1px solid #ccc;
          padding: 21px 0;
        }

        .faq details:last-child {
          border-bottom: 1px solid #ccc;
        }

        summary {
          font-weight: 700;
          cursor: pointer;
        }

        .faq p {
          max-width: 750px;
          color: #666;
          line-height: 1.6;
          margin-top: 13px;
        }

        .seoGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .seoBox {
          background: #fff;
          border: 1px solid #deded9;
          border-radius: 17px;
          padding: 22px;
        }

        .seoTop {
          display: flex;
          justify-content: space-between;
        }

        .seoTop button {
          border: 0;
          background: transparent;
          text-decoration: underline;
        }

        .seoBox p {
          line-height: 1.5;
        }

        .seoBox small {
          color: #38805a;
        }

        .finalCallout {
          padding-bottom: 20px;
        }

        .finalCallout p {
          max-width: 720px;
          color: #666;
          line-height: 1.6;
          font-size: 18px;
        }

        @media (max-width: 900px) {
          .layout,
          .productHero {
            grid-template-columns: 1fr;
          }

          .live-card {
            position: static;
          }

          .fourCards {
            grid-template-columns: 1fr 1fr;
          }

          .shopify-head {
            flex-direction: column;
          }
        }

        @media (max-width: 600px) {
          .topbar {
            padding: 0 4vw;
          }

          .workspace,
          .preview {
            width: 92vw;
          }

          .workspace {
            padding-top: 40px;
          }

          .grid2,
          .seoGrid {
            grid-template-columns: 1fr;
          }

          .card {
            padding: 21px;
          }

          .thumbGrid {
            grid-template-columns: repeat(3, 1fr);
          }

          .shopify-images {
            grid-template-columns: 1fr 1fr;
          }

          .productHero {
            gap: 35px;
          }

          .heroCopy {
            padding-top: 0;
          }

          .fourCards {
            grid-template-columns: 1fr;
          }

          .spec {
            flex-direction: column;
          }

          .spec strong {
            text-align: left;
          }

          .previewTop {
            align-items: flex-start;
            gap: 15px;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
