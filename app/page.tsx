"use client";

import { useState } from "react";

type AIResult = {
  analysis?: {
    targetCustomer?: string;
    purchaseMotivation?: string;
    strongestFeatures?: string[];
    weaknesses?: string[];
    missingInformation?: string[];
    seoOpportunities?: string[];
    conversionOpportunities?: string[];
  };

  score?: {
    title?: number;
    description?: number;
    seo?: number;
    productClarity?: number;
    conversionPotential?: number;
    overall?: number;
  };

  optimization?: {
    title?: string;
    productType?: string;
    description?: string;
    features?: string[];
    specifications?: string[];
    seoTitle?: string;
    metaDescription?: string;
    tags?: string[];
  };

  reasoning?: string;
};

type APIResponse = {
  success?: boolean;
  result?: AIResult;
  error?: string;
};

function ScoreCard({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  const score =
    typeof value === "number"
      ? Math.max(0, Math.min(100, value))
      : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-600">
          {label}
        </span>

        <span className="text-lg font-bold text-slate-950">
          {score}/100
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ResultList({
  items,
}: {
  items?: string[];
}) {
  if (!items?.length) {
    return (
      <p className="text-sm text-slate-500">
        No verified information returned.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex gap-3 text-sm leading-6 text-slate-700"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CopyButton({
  value,
  label = "Copy",
}: {
  value?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export default function Home() {
  const [product, setProduct] = useState("");
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function optimizeProduct() {
    if (!product.trim()) {
      setError("Enter product information first.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: product.trim(),
        }),
      });

      const data: APIResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "AI optimization failed."
        );
      }

      setResult(data.result || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setProduct("");
    setResult(null);
    setError("");
  }

  const overallScore =
    result?.score?.overall ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-900">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/60">
              Virello AI
            </div>

            <div className="mt-1 text-lg font-bold tracking-tight text-white">
              Virello AI Optimizer
            </div>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80">
            AI Ecommerce Tools
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/70">
              Product Intelligence
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              Optimize every product
              <span className="block text-white/60">
                with AI.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Analyze product information and generate
              premium ecommerce content, SEO opportunities,
              conversion improvements and structured
              product data.
            </p>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <section className="rounded-t-[2rem] bg-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            {/* INPUT PANEL */}
            <div className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Step 01
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-950">
                    Product information
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Paste the product information you
                    already have. Let AI determine what
                    needs to be improved.
                  </p>
                </div>

                <div className="hidden rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white sm:block">
                  AI
                </div>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="product"
                  className="mb-2 block text-sm font-semibold text-slate-800"
                >
                  Product title, description & details
                </label>

                <textarea
                  id="product"
                  value={product}
                  onChange={(e) =>
                    setProduct(e.target.value)
                  }
                  placeholder={`Example:

Luxury Quartz Watch

Classic men's watch with a clean,
elegant design.

Material: Stainless steel
Dial: Black
Style: Casual / dress
`}
                  className="min-h-[300px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={optimizeProduct}
                  disabled={loading}
                  className="flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "AI is analyzing..."
                    : "Optimize with AI"}
                </button>

                <button
                  type="button"
                  onClick={clearAll}
                  disabled={loading}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-400">
                    AI analysis
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    Product-specific
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-400">
                    Output
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    Shopify ready
                  </div>
                </div>
              </div>
            </div>

            {/* RESULTS */}
            <div className="space-y-6">
              {!result && !loading && (
                <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-white">
                      AI
                    </div>

                    <h2 className="mt-5 text-2xl font-bold text-slate-950">
                      AI Optimization Result
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Enter a product on the left and
                      Virello AI will analyze the current
                      listing before generating optimized
                      ecommerce content.
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center">
                  <div>
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

                    <h2 className="mt-5 text-xl font-bold text-slate-950">
                      Virello AI is working
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      Analyzing your actual product
                      information...
                    </p>
                  </div>
                </div>
              )}

              {result && !loading && (
                <>
                  {/* OVERALL SCORE */}
                  <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-7">
                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                          Current listing score
                        </p>

                        <h2 className="mt-2 text-2xl font-bold">
                          Conversion readiness
                        </h2>

                        <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                          This score evaluates the current
                          product listing before optimization.
                        </p>
                      </div>

                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-8 border-white/10">
                        <span className="text-2xl font-black">
                          {overallScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SCORE GRID */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ScoreCard
                      label="Title"
                      value={result.score?.title}
                    />

                    <ScoreCard
                      label="Description"
                      value={result.score?.description}
                    />

                    <ScoreCard
                      label="SEO"
                      value={result.score?.seo}
                    />

                    <ScoreCard
                      label="Product clarity"
                      value={
                        result.score?.productClarity
                      }
                    />

                    <ScoreCard
                      label="Conversion potential"
                      value={
                        result.score?.conversionPotential
                      }
                    />
                  </div>

                  {/* OPTIMIZED CONTENT */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Step 02
                      </p>

                      <h2 className="mt-2 text-2xl font-bold text-slate-950">
                        Optimized product
                      </h2>
                    </div>

                    {/* TITLE */}
                    <div className="mt-7">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-sm font-bold text-slate-800">
                          Product title
                        </label>

                        <CopyButton
                          value={
                            result.optimization?.title
                          }
                        />
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-semibold leading-7 text-slate-950">
                        {result.optimization?.title ||
                          "No title returned."}
                      </div>
                    </div>

                    {/* PRODUCT TYPE */}
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-sm font-bold text-slate-800">
                          Product type
                        </label>

                        <CopyButton
                          value={
                            result.optimization
                              ?.productType
                          }
                        />
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
                        {result.optimization
                          ?.productType ||
                          "No product type returned."}
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-sm font-bold text-slate-800">
                          Product description
                        </label>

                        <CopyButton
                          value={
                            result.optimization
                              ?.description
                          }
                        />
                      </div>

                      <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                        {result.optimization
                          ?.description ||
                          "No description returned."}
                      </div>
                    </div>

                    {/* FEATURES */}
                    <div className="mt-7">
                      <h3 className="text-sm font-bold text-slate-800">
                        Verified features
                      </h3>

                      <div className="mt-3 rounded-2xl bg-slate-50 p-5">
                        <ResultList
                          items={
                            result.optimization
                              ?.features
                          }
                        />
                      </div>
                    </div>

                    {/* SPECIFICATIONS */}
                    <div className="mt-7">
                      <h3 className="text-sm font-bold text-slate-800">
                        Specifications
                      </h3>

                      <div className="mt-3 rounded-2xl bg-slate-50 p-5">
                        <ResultList
                          items={
                            result.optimization
                              ?.specifications
                          }
                        />
                      </div>
                    </div>

                    {/* SEO */}
                    <div className="mt-7 border-t border-slate-200 pt-7">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Search optimization
                          </p>

                          <h3 className="mt-1 text-lg font-bold text-slate-950">
                            SEO content
                          </h3>
                        </div>
                      </div>

                      {/* SEO TITLE */}
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="text-sm font-bold text-slate-800">
                            SEO title
                          </label>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400">
                              {(
                                result.optimization
                                  ?.seoTitle || ""
                              ).length}
                              /50
                            </span>

                            <CopyButton
                              value={
                                result.optimization
                                  ?.seoTitle
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900">
                          {result.optimization
                            ?.seoTitle ||
                            "No SEO title returned."}
                        </div>
                      </div>

                      {/* META DESCRIPTION */}
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="text-sm font-bold text-slate-800">
                            Meta description
                          </label>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-400">
                              {(
                                result.optimization
                                  ?.metaDescription ||
                                ""
                              ).length}
                              /150
                            </span>

                            <CopyButton
                              value={
                                result.optimization
                                  ?.metaDescription
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                          {result.optimization
                            ?.metaDescription ||
                            "No meta description returned."}
                        </div>
                      </div>

                      {/* TAGS */}
                      <div className="mt-5">
                        <h3 className="mb-3 text-sm font-bold text-slate-800">
                          Shopify tags
                        </h3>

                        <div className="flex flex-wrap gap-2">
                          {result.optimization
                            ?.tags?.length ? (
                            result.optimization.tags.map(
                              (tag, index) => (
                                <span
                                  key={`${tag}-${index}`}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                >
                                  {tag}
                                </span>
                              )
                            )
                          ) : (
                            <span className="text-sm text-slate-500">
                              No tags returned.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI ANALYSIS */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Step 03
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-slate-950">
                      AI analysis
                    </h2>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          Target customer
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {result.analysis
                            ?.targetCustomer ||
                            "Not determined."}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          Purchase motivation
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {result.analysis
                            ?.purchaseMotivation ||
                            "Not determined."}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          Strongest features
                        </h3>

                        <div className="mt-4">
                          <ResultList
                            items={
                              result.analysis
                                ?.strongestFeatures
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          Weaknesses
                        </h3>

                        <div className="mt-4">
                          <ResultList
                            items={
                              result.analysis
                                ?.weaknesses
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          Missing information
                        </h3>

                        <div className="mt-4">
                          <ResultList
                            items={
                              result.analysis
                                ?.missingInformation
                            }
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          SEO opportunities
                        </h3>

                        <div className="mt-4">
                          <ResultList
                            items={
                              result.analysis
                                ?.seoOpportunities
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
                      <h3 className="text-sm font-bold">
                        Conversion opportunities
                      </h3>

                      <div className="mt-4">
                        <ul className="space-y-2">
                          {result.analysis
                            ?.conversionOpportunities
                            ?.length ? (
                            result.analysis.conversionOpportunities.map(
                              (item, index) => (
                                <li
                                  key={`${item}-${index}`}
                                  className="flex gap-3 text-sm leading-6 text-white/75"
                                >
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                                  <span>{item}</span>
                                </li>
                              )
                            )
                          ) : (
                            <li className="text-sm text-white/50">
                              No conversion opportunities
                              returned.
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {result.reasoning && (
                      <div className="mt-5 rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-bold text-slate-900">
                          AI reasoning
                        </h3>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                          {result.reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-white">
            Virello AI Optimizer
          </p>

          <p className="mt-1 text-xs text-white/40">
            AI-powered ecommerce product optimization
          </p>
        </div>
      </footer>
    </main>
  );
}
