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
    if (!product.trim()) return;

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

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error || "AI optimization failed."
        );
      }

      setResult(data);
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

  const optimization = result?.optimization;
  const analysis = result?.analysis;
  const score = result?.score;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">

        <header className="mb-8">
          <p className="text-sm font-semibold tracking-widest text-cyan-400">
            VIRELLO AI
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
            Virello AI Optimizer
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
            AI-powered product optimization for stronger ecommerce
            content, SEO, clarity and conversion potential.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-7">
          <h2 className="text-xl font-semibold">
            Product Optimizer
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Enter the product title and available product information.
            Virello AI will analyze and optimize it.
          </p>

          <textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Paste product title, description, features, specifications and other product details..."
            className="mt-5 min-h-48 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-white outline-none transition focus:border-cyan-500"
          />

          <button
            onClick={optimizeProduct}
            disabled={loading || !product.trim()}
            className="mt-4 w-full rounded-xl bg-cyan-500 px-6 py-3.5 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading ? "AI Optimizing..." : "Optimize Product"}
          </button>

          {error && (
            <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {result && (
          <div className="mt-6 space-y-6">

            {score && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
                <h2 className="text-xl font-semibold">
                  AI Product Score
                </h2>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ["Overall", score.overall],
                    ["Title", score.title],
                    ["Description", score.description],
                    ["SEO", score.seo],
                    ["Clarity", score.productClarity],
                    ["Conversion", score.conversionPotential],
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

            {optimization && (
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
                      {optimization.title || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Product Type
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {optimization.productType || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Product Description
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {optimization.description || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Features
                    </p>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                      {(optimization.features || []).map(
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
                      {(optimization.specifications || []).map(
                        (item, index) => (
                          <li key={index}>{item}</li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      SEO Title — Max 50 Characters
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {optimization.seoTitle || "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(optimization.seoTitle || "").length}/50
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Meta Description — Max 150 Characters
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {optimization.metaDescription || "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {(optimization.metaDescription || "").length}/150
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      SEO Tags
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(optimization.tags || []).map(
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

            {analysis && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
                <h2 className="text-xl font-semibold">
                  AI Should Return
                </h2>

                <div className="mt-5 space-y-5 text-sm">

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Target Customer
                    </p>
                    <p className="mt-1 text-slate-300">
                      {analysis.targetCustomer || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      Purchase Motivation
                    </p>
                    <p className="mt-1 text-slate-300">
                      {analysis.purchaseMotivation || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-cyan-400">
                      SEO Opportunities
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
                      {(analysis.seoOpportunities || []).map(
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
                      {(analysis.conversionOpportunities || []).map(
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
