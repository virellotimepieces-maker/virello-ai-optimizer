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

export default function Home() {
  const [product, setProduct] = useState("");
  const [result, setResult] = useState<AIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function optimizeProduct() {
    if (!product.trim()) {
      setError("Enter product information first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product: {
            title: product.trim(),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || data?.success !== true) {
        throw new Error(
          data?.error || "AI optimization failed."
        );
      }

      setResult(data.result);
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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">

        <header className="mb-8">
          <p className="text-sm font-bold tracking-[0.25em] text-cyan-400">
            VIRELLO AI
          </p>

          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">
            Virello AI Optimizer
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            AI-powered ecommerce product optimization for stronger
            product content, SEO and conversion potential.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-7">

          <h2 className="text-xl font-semibold">
            Product Optimizer
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Paste the product title, description, features,
            specifications and available product information.
          </p>

          <textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Paste your product information here..."
            className="mt-5 min-h-48 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-white outline-none focus:border-cyan-500"
          />

          <button
            type="button"
            onClick={optimizeProduct}
            disabled={loading || !product.trim()}
            className="mt-4 w-full rounded-xl bg-cyan-400 px-6 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading ? "AI Optimizing..." : "Optimize Product"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {result && (
          <div className="mt-6 space-y-6">

            {result.score && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">

                <h2 className="text-xl font-semibold">
                  AI Product Score
                </h2>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">

                  {[
                    ["Overall", result.score.overall],
                    ["Title", result.score.title],
                    ["Description", result.score.description],
                    ["SEO", result.score.seo],
                    ["Clarity", result.score.productClarity],
                    ["Conversion", result.score.conversionPotential],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <p className="text-xs text-slate-500">
                        {label}
                      </p>

                      <p className="mt-1 text-2xl font-bold text-cyan-400">
                        {value ?? 0}/100
                      </p>
                    </div>
                  ))}

                </div>
              </section>
            )}

            {result.optimization && (
              <section className="rounded-2xl border border-cyan-900/50 bg-slate-900 p-5 sm:p-7">

                <h2 className="text-xl font-semibold">
                  AI Optimization Result
                </h2>

                <div className="mt-6 space-y-6">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Optimized Product Title
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {result.optimization.title || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Product Type
                    </p>

                    <p className="mt-2 text-sm text-slate-300">
                      {result.optimization.productType || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Product Description
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {result.optimization.description || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Features
                    </p>

                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {(result.optimization.features || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Specifications
                    </p>

                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {(result.optimization.specifications || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      SEO Title — Maximum 50 Characters
                    </p>

                    <p className="mt-2 text-sm text-slate-300">
                      {result.optimization.seoTitle || "—"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {(result.optimization.seoTitle || "").length}/50
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Meta Description — Maximum 150 Characters
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {result.optimization.metaDescription || "—"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {(result.optimization.metaDescription || "").length}/150
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      SEO Tags
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(result.optimization.tags || []).map(
                        (tag, index) => (
                          <span
                            key={index}
                            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                </div>
              </section>
            )}

            {result.analysis && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">

                <h2 className="text-xl font-semibold">
                  AI Should Return
                </h2>

                <div className="mt-5 space-y-6 text-sm">

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Target Customer
                    </p>

                    <p className="mt-1 text-slate-300">
                      {result.analysis.targetCustomer || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Purchase Motivation
                    </p>

                    <p className="mt-1 text-slate-300">
                      {result.analysis.purchaseMotivation || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Strongest Features
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(result.analysis.strongestFeatures || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Weaknesses
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(result.analysis.weaknesses || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Missing Information
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(result.analysis.missingInformation || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      SEO Opportunities
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(result.analysis.seoOpportunities || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Conversion Opportunities
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(result.analysis.conversionOpportunities || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                </div>
              </section>
            )}

            {result.reasoning && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">

                <h2 className="text-xl font-semibold">
                  AI Reasoning
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-400">
                  {result.reasoning}
                </p>

              </section>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
