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

type ShopifyVariant = {
id?: string;
title?: string;
price?: string;
sku?: string | null;
available?: boolean;
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
images?: ShopifyImage[];
featuredImage: string | null;
variants?: ShopifyVariant[];
[key: string]: unknown;
};

type AIAnalysis = {
targetCustomer: string;
purchaseMotivation: string;
strongestFeatures: string[];
weaknesses: string[];
missingInformation: string[];
seoOpportunities: string[];
conversionOpportunities: string[];
detectedProductType?: string;
detectedAudience?: string;
detectedStyle?: string;
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

/*

AI MUST return a Product Type.

No hard-coded classification is performed

by the frontend.
*/
productType: string;


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
SEO LIMITS
========================================================= */

const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;

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
.replace(/<br\s*/?>/gi, "\n")
.replace(/</(p|div|li|h[1-6])>/gi, "\n")
.replace(/<[^>]*>/g, " ")
.replace(/ /gi, " ")
.replace(/&/gi, "&")
.replace(/"/gi, '"')
.replace(/'|'/gi, "'")
.replace(/–/gi, "–")
.replace(/—/gi, "—")
.replace(/\s+/g, " ")
.trim();
}

function unique(values: unknown[]): string[] {
const seen = new Set<string>();

return values
.map(clean)
.filter((value) => {
const normalized = value.toLowerCase();

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

function escapeHtml(value: string): string {
return value.replace(
/[&<>'"]/g,
(char) =>
({
"&": "&",
"<": "<",
">": ">",
"'": "'",
'"': """,
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
<p>${escapeHtml(paragraph)}</p>,
)
.join("");
}

/* =========================================================
PAGE
========================================================= */

export default function Page() {
const [products, setProducts] =
useState<ShopifyProduct[]>([]);

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
  await window.shopify.idToken();  

if (!token) {  
  throw new Error(  
    "Shopify session token unavailable. Reopen the app from Shopify Admin.",  
  );  
}  

return token;

}

/* =======================================================
LOAD SHOPIFY PRODUCTS
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
      ? data.products  
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
product.id ===
selectedId,
) || null,
[products, selectedId],
);

/* =======================================================
FILTER
======================================================= */

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

/* =======================================================
LOAD SELECTED PRODUCT
======================================================= */

useEffect(() => {
if (!selected) {
return;
}

setTitle(  
  stripHtml(selected.title),  
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
setAiResult(null);  
setMessage("");  
setError("");

}, [selected]);

/* =======================================================
REAL AI ANALYSIS
======================================================= */

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
   * ACTUAL SHOPIFY PRODUCT DATA  
   *  
   * No frontend classification.  
   * No gender guessing.  
   * No product-type guessing.  
   */  

  const productPayload = {  
    ...selected,  

    title:  
      stripHtml(selected.title),  

    description:  
      stripHtml(  
        selected.description,  
      ),  

    productType:  
      clean(  
        selected.productType,  
      ),  

    vendor:  
      clean(selected.vendor),  

    tags:  
      Array.isArray(  
        selected.tags,  
      )  
        ? selected.tags  
        : [],  

    price:  
      clean(selected.price),  

    images:  
      Array.isArray(  
        selected.images,  
      )  
        ? selected.images  
        : [],  

    featuredImage:  
      selected.featuredImage,  

    variants:  
      Array.isArray(  
        selected.variants,  
      )  
        ? selected.variants  
        : [],  
  };  

  const response =  
    await fetch(  
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
          product:  
            productPayload,  

          instructions: {  
            /*  
             * SOURCE OF TRUTH  
             */  

            sourceOfTruth:  
              "Use the supplied Shopify product data as the source of truth.",  

            /*  
             * PRODUCT TYPE  
             *  
             * AI determines it from the  
             * actual product information.  
             *  
             * No hard-coded frontend rule.  
             */  

            determineProductTypeWithAI:  
              true,  

            productTypeRequired:  
              true,  

            productTypeMustNotBeBlank:  
              true,  

            /*  
             * AUDIENCE  
             */  

            determineAudienceWithAI:  
              true,  

            doNotAssumeGender:  
              true,  

            /*  
             * CONTENT  
             */  

            rewriteExistingInformation:  
              true,  

            improveConversion:  
              true,  

            improveSEO:  
              true,  

            /*  
             * FACTUAL ACCURACY  
             */  

            doNotInventFacts:  
              true,  

            doNotInventSpecifications:  
              true,  

            detectAndReportConflicts:  
              true,  

            preserveAccurateProductFacts:  
              true,  

            /*  
             * SEO LIMITS  
             */  

            seoTitleMaximumCharacters:  
              SEO_TITLE_MAX,  

            metaDescriptionMaximumCharacters:  
              META_DESCRIPTION_MAX,  

            seoTitleMustFitLimit:  
              true,  

            metaDescriptionMustFitLimit:  
              true,  

            /*  
             * OUTPUT QUALITY  
             */  

            avoidKeywordStuffing:  
              true,  

            avoidDuplicateTags:  
              true,  

            writeNaturalSearchFriendlyCopy:  
              true,  

            prioritizeProductRelevance:  
              true,  
          },  
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

  const result =  
    (data.result ||  
      data.data ||  
      data.analysis) as  
      | AIResult  
      | undefined;  

  if (  
    !result ||  
    !result.optimization ||  
    !result.analysis ||  
    !result.score  
  ) {  
    throw new Error(  
      "Virello AI returned an incomplete result.",  
    );  
  }  

  const optimization =  
    result.optimization;  

  /* ===================================================  
     PRODUCT TYPE  
       
     AI must return this.  
     We do NOT classify it here.  
  =================================================== */  

  const normalizedProductType =  
    clean(  
      optimization.productType,  
    );  

  if (!normalizedProductType) {  
    throw new Error(  
      "Virello AI did not return a Product Type. The AI backend must return a valid Product Type based on the actual Shopify product data.",  
    );  
  }  

  /* ===================================================  
     NORMALIZE AI OUTPUT  
  =================================================== */  

  const normalizedTitle =  
    clean(  
      optimization.title,  
    );  

  const normalizedDescription =  
    clean(  
      optimization.description,  
    );  

  const normalizedFeatures =  
    unique(  
      Array.isArray(  
        optimization.features,  
      )  
        ? optimization.features  
        : [],  
    );  

  const normalizedSpecifications =  
    unique(  
      Array.isArray(  
        optimization.specifications,  
      )  
        ? optimization.specifications  
        : [],  
    );  

  const normalizedTags =  
    unique(  
      Array.isArray(  
        optimization.tags,  
      )  
        ? optimization.tags  
        : [],  
    );  

  /*  
   * SEO TITLE  
   * Maximum 60 characters.  
   */  

  const normalizedSeoTitle =  
    limitCharacters(  
      optimization.seoTitle,  
      SEO_TITLE_MAX,  
    );  

  /*  
   * META DESCRIPTION  
   * Maximum 160 characters.  
   */  

  const normalizedMetaDescription =  
    limitCharacters(  
      optimization.metaDescription,  
      META_DESCRIPTION_MAX,  
    );  

  const normalizedResult: AIResult =  
    {  
      ...result,  

      optimization: {  
        ...optimization,  

        title:  
          normalizedTitle,  

        description:  
          normalizedDescription,  

        productType:  
          normalizedProductType,  

        features:  
          normalizedFeatures,  

        specifications:  
          normalizedSpecifications,  

        seoTitle:  
          normalizedSeoTitle,  

        metaDescription:  
          normalizedMetaDescription,  

        tags:  
          normalizedTags,  
      },  
    };  

  setAiResult(  
    normalizedResult,  
  );  

  setTitle(  
    normalizedTitle,  
  );  

  /*  
   * Product Type comes directly  
   * from AI.  
   */  

  setProductType(  
    normalizedProductType,  
  );  

  setTags(  
    normalizedTags.join(", "),  
  );  

  setDescription(  
    normalizedDescription,  
  );  

  setFeatures(  
    normalizedFeatures,  
  );  

  setSpecifications(  
    normalizedSpecifications,  
  );  

  setSeoTitle(  
    normalizedSeoTitle,  
  );  

  setMetaDescription(  
    normalizedMetaDescription,  
  );  

  setMessage(  
    "Virello AI analyzed the actual Shopify product data and generated the optimization.",  
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
      .map(clean),  
  );  

const finalDescription =  
  clean(description);  

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
    "Product Type is required. Run AI Analysis first so Virello can determine it from the actual product data.",  
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
  finalSeoTitle.length >  
  SEO_TITLE_MAX  
) {  
  setError(  
    `SEO Title must be ${SEO_TITLE_MAX} characters or fewer.`,  
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
  META_DESCRIPTION_MAX  
) {  
  setError(  
    `Meta Description must be ${META_DESCRIPTION_MAX} characters or fewer.`,  
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
    textarea {  
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
    textarea:focus {  
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
    .analysis-card,  
    .generated {  
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

    .empty-detail {  
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
      margin-top: 16px;  
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

    .ai-fact {  
      border: 1px solid #dedede;  
      border-radius: 14px;  
      padding: 16px;  
      background: #fafafa;  
      margin-bottom: 16px;  
    }  

    .ai-fact strong {  
      display: block;  
      margin-bottom: 6px;  
    }  

    .ai-fact span {  
      color: #555;  
      line-height: 1.5;  
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
        PRODUCTS  
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
                  {product.title}  
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
                <div className="ai-badge">  
                  REAL AI OPTIMIZER  
                </div>  

                <h1>  
                  Product Optimizer  
                </h1>  

                <div className="subtitle">  
                  AI reads the actual  
                  Shopify product  
                  information, then  
                  rewrites and  
                  optimizes it for  
                  conversion and SEO.  
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
                alt=""  
              />  
            )}  

            {/* AI SOURCE */}  

            <div className="ai-fact">  
              <strong>  
                AI Source  
              </strong>  

              <span>  
                Virello AI analyzes the  
                actual Shopify product  
                data. Product Type,  
                audience, features,  
                specifications and SEO  
                are determined from the  
                supplied product data,  
                not from hard-coded  
                frontend product rules.  
              </span>  
            </div>  

            {/* TITLE */}  

            <div className="field">  
              <label>  
                Product Title  
              </label>  

              <input  
                value={title}  
                onChange={(event) =>  
                  setTitle(  
                    event.target  
                      .value,  
                  )  
                }  
              />  
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
                placeholder="AI-determined product type"  
              />  

              <div className="small-note">  
                Determined by Virello AI  
                from the actual Shopify  
                product data.  
              </div>  
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
                placeholder="AI-generated tags"  
              />  
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
                placeholder="AI-generated conversion-focused description..."  
              />  
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
                            {feature}  
                          </li>  
                        ),  
                      )}  
                    </ul>  
                  ) : (  
                    <div className="empty-detail">  
                      AI analysis has not  
                      generated features  
                      yet.  
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
                      Only specifications  
                      supported by the  
                      source product data  
                      should be returned.  
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
                  SEO Title · Max{" "}  
                  {SEO_TITLE_MAX}  
                </label>  

                <input  
                  maxLength={  
                    SEO_TITLE_MAX  
                  }  
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
                  {seoTitle.length}  
                  /{SEO_TITLE_MAX}  
                </div>  
              </div>  

              <div className="field">  
                <label>  
                  Meta Description ·  
                  Max{" "}  
                  {  
                    META_DESCRIPTION_MAX  
                  }  
                </label>  

                <textarea  
                  maxLength={  
                    META_DESCRIPTION_MAX  
                  }  
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
                  /  
                  {  
                    META_DESCRIPTION_MAX  
                  }  
                </div>  
              </div>  
            </div>  

            {/* AI RESULT */}  

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
                      Overall  
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
                      Conversion  
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
                      SEO  
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
                      Title  
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
                      Description  
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
                      Clarity  
                    </div>  
                  </div>  

                </div>  

                {/* AI CLASSIFICATION */}  

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
                        None identified.  
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
                        No major weaknesses  
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
                        No important missing  
                        information detected.  
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
                        None identified.  
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
