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

type Trend = "BULLISH" | "BEARISH" | "NEUTRAL";
type TradeSignal = "LONG" | "SHORT" | "WAIT";

type BTCTimeframe = {
  price: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  support: number;
  resistance: number;
  trend: Trend;
  elliottWave: {
    wave: string;
    bias: Trend;
    confidence: number;
  };
};

type BTCAnalysis = {
  success: boolean;
  live?: boolean;
  symbol: string;
  generatedAt: string;
  signal: TradeSignal;
  confidence: number;

  timeframes: {
    "15m": BTCTimeframe;
    "1h": BTCTimeframe;
    "4h": BTCTimeframe;
  };

  tradePlan: {
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    riskDistance?: number;
  };

  elliottWave: unknown;
  liquidationHeatmap: unknown;

  riskManagement?: {
    stopLossRequired?: boolean;
    leverage?: string;
    riskPerTrade?: string;
    warning?: string;
  };

  analysis?: {
    trend?: string;
    price?: number;
    rsi14?: number;
    atr14?: number;
    support?: number;
    resistance?: number;
    ema20?: number;
    ema50?: number;
    ema200?: number;
  };
};

const SEO_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;

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

  const [btcAnalysis, setBtcAnalysis] =
    useState<BTCAnalysis | null>(null);

  const [btcLoading, setBtcLoading] =
    useState(false);

  const [btcError, setBtcError] =
    useState("");

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

  async function loadBTCAnalysis() {
    setBtcLoading(true);
    setBtcError("");

    try {
      const response = await fetch(
        "/api/btcusd",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data =
        (await response.json()) as
          BTCAnalysis & {
            error?: string;
          };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "BTCUSD live analysis failed.",
        );
      }

      setBtcAnalysis(data);
    } catch (err) {
      setBtcError(
        err instanceof Error
          ? err.message
          : "BTCUSD live analysis failed.",
      );
    } finally {
      setBtcLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadBTCAnalysis();

    const interval =
      window.setInterval(() => {
        void loadBTCAnalysis();
      }, 30000);

    return () =>
      window.clearInterval(interval);
  }, []);

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
          product.tags.some((tag) =>
            tag
              .toLowerCase()
              .includes(query),
          ),
      );
    }, [products, search]);

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

      const productPayload = {
        ...selected,
        title:
          stripHtml(selected.title),
        description:
          stripHtml(
            selected.description,
          ),
        productType:
          clean(selected.productType),
        vendor:
          clean(selected.vendor),
        tags:
          Array.isArray(selected.tags)
            ? selected.tags
            : [],
        price:
          clean(selected.price),
        images:
          Array.isArray(selected.images)
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
                sourceOfTruth:
                  "Use the supplied Shopify product data as the source of truth.",

                determineProductTypeWithAI:
                  true,

                productTypeRequired:
                  true,

                productTypeMustNotBeBlank:
                  true,

                determineAudienceWithAI:
                  true,

                doNotAssumeGender:
                  true,

                rewriteExistingInformation:
                  true,

                improveConversion:
                  true,

                improveSEO:
                  true,

                doNotInventFacts:
                  true,

                doNotInventSpecifications:
                  true,

                detectAndReportConflicts:
                  true,

                preserveAccurateProductFacts:
                  true,

                seoTitleMaximumCharacters:
                  SEO_TITLE_MAX,

                metaDescriptionMaximumCharacters:
                  META_DESCRIPTION_MAX,

                seoTitleMustFitLimit:
                  true,

                metaDescriptionMustFitLimit:
                  true,

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

      const normalizedProductType =
        clean(
          optimization.productType,
        );

      if (!normalizedProductType) {
        throw new Error(
          "Virello AI did not return a Product Type.",
        );
      }

      const normalizedTitle =
        limitCharacters(
          optimization.title,
          120,
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

      const normalizedSeoTitle =
        limitCharacters(
          optimization.seoTitle,
          SEO_TITLE_MAX,
        );

      const normalizedMetaDescription =
        limitCharacters(
          optimization.metaDescription,
          META_DESCRIPTION_MAX,
        );

      const normalizedResult: AIResult = {
        ...result,

        optimization: {
          title:
            normalizedTitle,
          description:
            normalizedDescription,
          features:
            normalizedFeatures,
          specifications:
            normalizedSpecifications,
          productType:
            normalizedProductType,
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

      setDescription(
        normalizedDescription,
      );

      setProductType(
        normalizedProductType,
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

      setTags(
        normalizedTags.join(", "),
      );

      setMessage(
        "AI optimization completed successfully.",
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

  async function handleSave() {
    if (!selected) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const token =
        await getSessionToken();

      const finalDescription =
        descriptionToHtml(
          description,
        );

      const response =
        await fetch(
          "/api/shopify/products",
          {
            method: "PUT",
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
                clean(title),

              description:
                finalDescription,

              productType:
                clean(productType),

              tags:
                unique(
                  tags.split(","),
                ),
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
            "Unable to save product.",
        );
      }

      setMessage(
        "Product saved successfully.",
      );

      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save product.",
      );
    } finally {
      setSaving(false);
    }
  }

  const btc1h =
    btcAnalysis?.timeframes?.["1h"];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#f7f7f8",
        color: "#111",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 30,
            }}
          >
            Virello AI Optimizer
          </h1>

          <p
            style={{
              marginTop: 8,
              color: "#666",
            }}
          >
            Shopify product optimization
            and live BTCUSD analysis.
          </p>
        </header>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 8,
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 8,
              background: "#dcfce7",
              color: "#166534",
            }}
          >
            {message}
          </div>
        )}

        <section
          style={{
            marginBottom: 24,
            padding: 20,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #ddd",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: 16,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                }}
              >
                BTCUSD Live Analysis
              </h2>

              <p
                style={{
                  margin:
                    "6px 0 0",
                  color: "#666",
                }}
              >
                Live market data from the
                BTCUSD API.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadBTCAnalysis()
              }
              disabled={btcLoading}
              style={{
                padding:
                  "10px 16px",
                border: 0,
                borderRadius: 8,
                cursor:
                  btcLoading
                    ? "not-allowed"
                    : "pointer",
                background:
                  "#111",
                color: "#fff",
              }}
            >
              {btcLoading
                ? "Updating..."
                : "Refresh BTC"}
            </button>
          </div>

          {btcError && (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                borderRadius: 8,
                background: "#fff7ed",
                color: "#9a3412",
              }}
            >
              {btcError}
            </div>
          )}

          {btcLoading &&
            !btcAnalysis && (
              <p>
                Loading live BTCUSD
                analysis...
              </p>
            )}

          {btcAnalysis && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <Metric
                  label="Price"
                  value={`$${btcAnalysis.timeframes["1h"].price.toLocaleString()}`}
                />

                <Metric
                  label="Signal"
                  value={
                    btcAnalysis.signal
                  }
                />

                <Metric
                  label="Confidence"
                  value={`${btcAnalysis.confidence}%`}
                />

                <Metric
                  label="Trend"
                  value={
                    btcAnalysis.timeframes[
                      "1h"
                    ].trend
                  }
                />

                <Metric
                  label="RSI 14"
                  value={String(
                    btcAnalysis.timeframes[
                      "1h"
                    ].rsi14,
                  )}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {(
                  [
                    ["15m", btcAnalysis.timeframes["15m"]],
                    ["1h", btcAnalysis.timeframes["1h"]],
                    ["4h", btcAnalysis.timeframes["4h"]],
                  ] as const
                ).map(
                  ([name, timeframe]) => (
                    <div
                      key={name}
                      style={{
                        padding: 16,
                        border:
                          "1px solid #ddd",
                        borderRadius: 10,
                      }}
                    >
                      <h3
                        style={{
                          margin:
                            "0 0 12px",
                        }}
                      >
                        {name}
                      </h3>

                      <p>
                        Price: $
                        {timeframe.price.toLocaleString()}
                      </p>

                      <p>
                        EMA 20:{" "}
                        {timeframe.ema20.toLocaleString()}
                      </p>

                      <p>
                        EMA 50:{" "}
                        {timeframe.ema50.toLocaleString()}
                      </p>

                      <p>
                        EMA 200:{" "}
                        {timeframe.ema200.toLocaleString()}
                      </p>

                      <p>
                        RSI:{" "}
                        {timeframe.rsi14}
                      </p>

                      <p>
                        Trend:{" "}
                        {timeframe.trend}
                      </p>

                      <p>
                        Support: $
                        {timeframe.support.toLocaleString()}
                      </p>

                      <p>
                        Resistance: $
                        {timeframe.resistance.toLocaleString()}
                      </p>

                      <p>
                        Elliott:{" "}
                        {
                          timeframe
                            .elliottWave
                            .wave
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 10,
                  background: "#f7f7f8",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                  }}
                >
                  Trade Plan
                </h3>

                <p>
                  Entry: $
                  {btcAnalysis.tradePlan.entry.toLocaleString()}
                </p>

                <p>
                  Stop Loss: $
                  {btcAnalysis.tradePlan.stopLoss.toLocaleString()}
                </p>

                <p>
                  Take Profit 1: $
                  {btcAnalysis.tradePlan.takeProfit1.toLocaleString()}
                </p>

                <p>
                  Take Profit 2: $
                  {btcAnalysis.tradePlan.takeProfit2.toLocaleString()}
                </p>
              </div>

              <p
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  color: "#777",
                }}
              >
                Last update:{" "}
                {new Date(
                  btcAnalysis.generatedAt,
                ).toLocaleString()}
              </p>
            </>
          )}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "300px 1fr",
            gap: 20,
          }}
        >
          <aside
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#fff",
              border:
                "1px solid #ddd",
              minHeight: 500,
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Products
            </h2>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search products..."
              style={{
                width: "100%",
                boxSizing:
                  "border-box",
                padding: 10,
                borderRadius: 8,
                border:
                  "1px solid #ccc",
                marginBottom: 12,
              }}
            />

            {loading ? (
              <p>
                Loading products...
              </p>
            ) : filteredProducts.length ===
              0 ? (
              <p>
                No products found.
              </p>
            ) : (
              <div>
                {filteredProducts.map(
                  (product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          product.id,
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign:
                          "left",
                        padding: 12,
                        marginBottom: 8,
                        borderRadius: 8,
                        border:
                          product.id ===
                          selectedId
                            ? "2px solid #111"
                            : "1px solid #ddd",
                        background:
                          product.id ===
                          selectedId
                            ? "#f1f1f1"
                            : "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      <strong>
                        {product.title}
                      </strong>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "#777",
                        }}
                      >
                        {product.productType ||
                          "No product type"}
                      </div>
                    </button>
                  ),
                )}
              </div>
            )}
          </aside>

          <section
            style={{
              padding: 20,
              borderRadius: 12,
              background: "#fff",
              border:
                "1px solid #ddd",
            }}
          >
            {!selected ? (
              <p>
                Select a product.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: 12,
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        marginTop: 0,
                      }}
                    >
                      Product Optimizer
                    </h2>

                    <p
                      style={{
                        color: "#666",
                      }}
                    >
                      {selected.vendor}
                    </p>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        void handleOptimize()
                      }
                      disabled={
                        optimizing ||
                        saving
                      }
                      style={{
                        padding:
                          "10px 16px",
                        border: 0,
                        borderRadius:
                          8,
                        background:
                          "#111",
                        color:
                          "#fff",
                        cursor:
                          "pointer",
                      }}
                    >
                      {optimizing
                        ? "Optimizing..."
                        : "AI Optimize"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleSave()
                      }
                      disabled={
                        saving ||
                        optimizing
                      }
                      style={{
                        padding:
                          "10px 16px",
                        border:
                          "1px solid #111",
                        borderRadius:
                          8,
                        background:
                          "#fff",
                        color:
                          "#111",
                        cursor:
                          "pointer",
                      }}
                    >
                      {saving
                        ? "Saving..."
                        : "Save Product"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gap: 16,
                    marginTop: 20,
                  }}
                >
                  <Field
                    label="Title"
                    value={title}
                    onChange={
                      setTitle
                    }
                  />

                  <Field
                    label="Product Type"
                    value={
                      productType
                    }
                    onChange={
                      setProductType
                    }
                  />

                  <Field
                    label="Tags"
                    value={tags}
                    onChange={
                      setTags
                    }
                  />

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontWeight:
                          600,
                        marginBottom:
                          6,
                      }}
                    >
                      Description
                    </label>

                    <textarea
                      value={
                        description
                      }
                      onChange={(
                        event,
                      ) =>
                        setDescription(
                          event.target
                            .value,
                        )
                      }
                      rows={12}
                      style={{
                        width:
                          "100%",
                        boxSizing:
                          "border-box",
                        padding: 12,
                        borderRadius:
                          8,
                        border:
                          "1px solid #ccc",
                        resize:
                          "vertical",
                      }}
                    />
                  </div>

                  <Field
                    label="SEO Title"
                    value={
                      seoTitle
                    }
                    onChange={
                      setSeoTitle
                    }
                    maxLength={
                      SEO_TITLE_MAX
                    }
                  />

                  <Field
                    label="Meta Description"
                    value={
                      metaDescription
                    }
                    onChange={
                      setMetaDescription
                    }
                    maxLength={
                      META_DESCRIPTION_MAX
                    }
                  />
                </div>

                {features.length >
                  0 && (
                  <div
                    style={{
                      marginTop: 20,
                    }}
                  >
                    <h3>
                      Features
                    </h3>

                    <ul>
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
                  </div>
                )}

                {specifications.length >
                  0 && (
                  <div
                    style={{
                      marginTop: 20,
                    }}
                  >
                    <h3>
                      Specifications
                    </h3>

                    <ul>
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
                  </div>
                )}

                {aiResult && (
                  <div
                    style={{
                      marginTop: 24,
                      padding: 16,
                      borderRadius: 10,
                      background:
                        "#f7f7f8",
                    }}
                  >
                    <h3>
                      AI Analysis
                    </h3>

                    <p>
                      <strong>
                        Target Customer:
                      </strong>{" "}
                      {
                        aiResult
                          .analysis
                          .targetCustomer
                      }
                    </p>

                    <p>
                      <strong>
                        Purchase Motivation:
                      </strong>{" "}
                      {
                        aiResult
                          .analysis
                          .purchaseMotivation
                      }
                    </p>

                    <p>
                      <strong>
                        Overall Score:
                      </strong>{" "}
                      {
                        aiResult
                          .score
                          .overall
                      }
                    </p>

                    <p>
                      <strong>
                        Reasoning:
                      </strong>{" "}
                      {
                        aiResult
                          .reasoning
                      }
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </section>

        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: "#777",
          }}
        >
          Virello AI Optimizer uses live
          API responses. API keys are
          kept server-side and must not
          be placed in this client file.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {label}
      </label>

      <input
        value={value}
        maxLength={maxLength}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      />

      {maxLength !==
        undefined && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color:
              value.length >
              maxLength
                ? "#b91c1c"
                : "#777",
          }}
        >
          {value.length}/
          {maxLength}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: "1px solid #ddd",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#777",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: 18,
        }}
      >
        {value}
      </strong>
    </div>
  );
}
