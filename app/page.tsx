"use client";

import { useState } from "react";

export default function Home() {
  const [product, setProduct] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function optimizeProduct() {
    if (!product.trim()) return;

    setLoading(true);
    setResult("");

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Optimization failed.");
      }

      setResult(
        typeof data === "string"
          ? data
          : JSON.stringify(data, null, 2)
      );
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="text-sm font-medium text-cyan-400">
            VIRELLO AI
          </p>

          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            Virello AI Optimizer
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Optimize e-commerce product content with AI.
            Improve titles, descriptions, keywords and SEO.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="text-xl font-semibold">
            Product Optimizer
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Paste your product information below.
          </p>

          <textarea
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Paste your product title, description and product details here..."
            className="mt-5 min-h-48 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
          />

          <button
            onClick={optimizeProduct}
            disabled={loading || !product.trim()}
            className="mt-4 rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Optimizing..." : "Optimize Product"}
          </button>
        </section>

        {result && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">
              AI Optimization Result
            </h2>

            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-5 text-sm text-slate-300">
              {result}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}
