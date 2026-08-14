"use client";

import { useState } from "react";

type Product = {
  title: string;
  price: string;
  description: string;
  benefits: string[];
  features: string[];
  faq: { q: string; a: string }[];
};

const demoProduct: Product = {
  title: "Premium Automatic Watch",
  price: "$129.99",
  description:
    "A refined timepiece designed to bring a polished, confident finish to everyday looks. Its balanced design, comfortable fit, and timeless presentation make it an easy choice for work, evenings, and special occasions.",
  benefits: [
    "Premium-looking design",
    "Comfortable everyday wear",
    "Easy-to-style classic appearance",
    "Designed for work and special occasions",
  ],
  features: [
    "Refined watch design",
    "Comfort-focused construction",
    "Easy-to-read dial",
    "Versatile everyday styling",
    "Gift-ready presentation",
  ],
  faq: [
    {
      q: "Is this watch suitable for everyday wear?",
      a: "Yes. The design is intended to work comfortably with everyday, business, and occasion-ready outfits.",
    },
    {
      q: "How does the watch fit?",
      a: "The adjustable design allows the wearer to achieve a comfortable fit.",
    },
    {
      q: "Is it suitable as a gift?",
      a: "Yes. Its versatile design makes it a strong choice for birthdays, anniversaries, holidays, and other occasions.",
    },
  ],
};

function createOptimizedTitle(input: string) {
  const clean = input.trim();

  if (!clean) return "Premium Automatic Watch";

  const short = clean
    .replace(/\s+/g, " ")
    .replace(/[-–—|]+/g, " ")
    .trim();

  if (short.length <= 50) return short;

  const words = short.split(" ");
  let result = "";

  for (const word of words) {
    const next = result ? `${result} ${word}` : word;

    if (next.length > 50) break;

    result = next;
  }

  return result || short.slice(0, 50).trim();
}

function createSeoTitle(title: string) {
  const base = createOptimizedTitle(title);

  const suffix = " | Virello";

  if ((base + suffix).length <= 50) {
    return base + suffix;
  }

  return base.slice(0, 50 - suffix.length).trim() + suffix;
}

function createMetaDescription(product: Product) {
  const text = `${product.title}. Discover a refined, versatile design made for everyday wear, business looks, special occasions, and thoughtful gifting.`;

  return text.length <= 160
    ? text
    : text.slice(0, 157).trimEnd() + "...";
}

export default function Page() {
  const [mode, setMode] = useState<"input" | "preview">("input");
  const [productUrl, setProductUrl] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [audience, setAudience] = useState("Unisex");
  const [angle, setAngle] = useState("Premium / Luxury");
  const [language, setLanguage] = useState("English");
  const [images, setImages] = useState(4);
  const [template, setTemplate] = useState("Luxury");
  const [product, setProduct] = useState<Product>(demoProduct);

  function generatePage() {
    const optimizedTitle = createOptimizedTitle(productTitle);

    const updatedProduct: Product = {
      ...demoProduct,
      title: optimizedTitle,
      description:
        angle === "Premium / Luxury"
          ? `Designed for ${audience.toLowerCase()} customers who appreciate refined details and timeless presentation. This ${optimizedTitle.toLowerCase()} brings a polished finish to business looks, everyday outfits, and special occasions.`
          : `A versatile ${optimizedTitle.toLowerCase()} designed for ${audience.toLowerCase()} customers. A practical choice for everyday wear, work, special occasions, and gifting.`,
    };

    setProduct(updatedProduct);
    setMode("preview");
  }

  function resetPage() {
    setMode("input");
  }

  const seoTitle = createSeoTitle(product.title);
  const metaDescription = createMetaDescription(product);

  return (
    <main className="min-h-screen bg-[#f5f5f3] text-[#111]">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xl font-black tracking-[0.22em]">
              VIRELLO
            </div>
            <div className="text-[9px] font-bold tracking-[0.28em] text-gray-500">
              AI PRODUCT OPTIMIZER
            </div>
          </div>

          {mode === "preview" && (
            <button
              onClick={resetPage}
              className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-gray-50"
            >
              ← Edit Product
            </button>
          )}
        </div>
      </header>

      {/* INPUT SCREEN */}
      {mode === "input" && (
        <section className="mx-auto max-w-5xl px-5 py-12">
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
              Virello AI
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
              Build a better
              <br />
              product page.
            </h1>

            <p className="mt-5 max-w-2xl leading-7 text-gray-600">
              Enter your product information and Virello will prepare a
              professional, conversion-focused product page.
            </p>
          </div>

          <div className="space-y-5">
            {/* PRODUCT */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Product
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Product URL
              </h2>

              <input
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="Paste product URL"
                className="mt-4 w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-black"
              />

              <div className="mt-4 text-center text-xs font-semibold text-gray-400">
                OR
              </div>

              <input
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                placeholder="Enter product title"
                className="mt-4 w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-black"
              />
            </div>

            {/* LANGUAGE */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Content
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Language
              </h2>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-4 w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 outline-none focus:border-black"
              >
                <option>English</option>
                <option>French</option>
                <option>Spanish</option>
                <option>German</option>
              </select>
            </div>

            {/* AUDIENCE */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Audience
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Target Audience
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {["Women", "Men", "Unisex"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setAudience(item)}
                    className={`rounded-2xl border px-4 py-4 font-semibold ${
                      audience === item
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-gray-400"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* ANGLE */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Copywriting
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Copywriting Angle
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  "Premium / Luxury",
                  "Everyday",
                  "Professional",
                  "Casual",
                  "Sport",
                  "Gift",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => setAngle(item)}
                    className={`rounded-2xl border px-4 py-4 text-sm font-semibold ${
                      angle === item
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-gray-400"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* IMAGES */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Visuals
              </p>

              <h2 className="mt-2 text-xl font-bold">
                AI Product Images
              </h2>

              <div className="mt-5 grid grid-cols-7 gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((number) => (
                  <button
                    key={number}
                    onClick={() => setImages(number)}
                    className={`rounded-xl border py-3 text-sm font-bold ${
                      images === number
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>

            {/* TEMPLATE */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Design
              </p>

              <h2 className="mt-2 text-xl font-bold">
                Product Page Style
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {["Luxury", "Minimal", "Classic", "Sport", "Editorial"].map(
                  (item) => (
                    <button
                      key={item}
                      onClick={() => setTemplate(item)}
                      className={`rounded-2xl border p-5 text-left ${
                        template === item
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-white hover:border-gray-400"
                      }`}
                    >
                      <div className="font-bold">{item}</div>
                      <div
                        className={`mt-1 text-sm ${
                          template === item
                            ? "text-white/65"
                            : "text-gray-500"
                        }`}
                      >
                        {item === "Luxury"
                          ? "Premium presentation for refined products."
                          : "Professional product-page layout."}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* GENERATE */}
            <button
              onClick={generatePage}
              className="w-full rounded-2xl bg-black px-6 py-5 text-lg font-bold text-white shadow-lg transition hover:bg-gray-800"
            >
              Generate Product Page →
            </button>
          </div>
        </section>
      )}

      {/* PREVIEW */}
      {mode === "preview" && (
        <section className="mx-auto max-w-7xl px-5 py-8">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
                Generated Preview
              </p>

              <h1 className="mt-2 text-3xl font-black">
                {template} Product Page
              </h1>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              {language} · {audience} · {angle} · {images} images
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-xl">
            {/* HERO */}
            <div className="grid gap-10 p-7 md:grid-cols-2 md:p-12">
              <div className="flex min-h-[430px] items-center justify-center rounded-3xl bg-[#f2f2f0]">
                <div className="text-center">
                  <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full border-[18px] border-gray-800 bg-white shadow-2xl">
                    <div className="text-center">
                      <div className="text-2xl font-black">V</div>
                      <div className="mt-1 text-[9px] font-bold tracking-widest">
                        VIRELLO
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 text-xs font-bold tracking-[0.2em] text-gray-400">
                    PRODUCT PREVIEW
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  Premium Collection
                </p>

                <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                  {product.title}
                </h2>

                <p className="mt-5 text-2xl font-bold">
                  {product.price}
                </p>

                <p className="mt-6 leading-8 text-gray-600">
                  {product.description}
                </p>

                <div className="mt-7 space-y-3">
                  {product.benefits.slice(0, 3).map((benefit) => (
                    <div
                      key={benefit}
                      className="flex items-center gap-3 text-sm font-semibold"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs text-white">
                        ✓
                      </span>
                      {benefit}
                    </div>
                  ))}
                </div>

                <button className="mt-8 rounded-2xl bg-black px-6 py-5 font-bold text-white">
                  Add to Cart
                </button>

                <div className="mt-4 text-center text-xs text-gray-400">
                  Secure checkout · Easy returns · Customer support
                </div>
              </div>
            </div>

            {/* BENEFITS */}
            <div className="border-t border-gray-100 bg-[#fafaf8] px-7 py-14 md:px-12">
              <div className="mx-auto max-w-4xl text-center">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                  Why choose it
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Designed to make an impression.
                </h2>

                <div className="mt-10 grid gap-5 md:grid-cols-4">
                  {product.benefits.map((benefit) => (
                    <div
                      key={benefit}
                      className="rounded-2xl bg-white p-6 shadow-sm"
                    >
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                        ✓
                      </div>

                      <h3 className="mt-4 font-bold">
                        {benefit}
                      </h3>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* FEATURES */}
            <div className="grid gap-10 px-7 py-14 md:grid-cols-2 md:px-12">
              <div className="rounded-3xl bg-[#ededeb] p-10">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  Product Details
                </p>

                <h2 className="mt-3 text-3xl font-black">
                  Made for everyday confidence.
                </h2>

                <p className="mt-5 leading-8 text-gray-600">
                  A balanced design created to complement modern wardrobes
                  while maintaining a refined, timeless appearance.
                </p>
              </div>

              <div className="flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  Features
                </p>

                <div className="mt-5 divide-y divide-gray-200">
                  {product.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center justify-between py-4"
                    >
                      <span className="font-semibold">
                        {feature}
                      </span>

                      <span className="text-gray-400">
                        ✓
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* TRUST */}
            <div className="border-y border-gray-100 px-7 py-12 md:px-12">
              <div className="grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl bg-[#fafaf8] p-6 text-center">
                  <div className="text-lg font-black">
                    Secure Checkout
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Safe and protected payment experience.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fafaf8] p-6 text-center">
                  <div className="text-lg font-black">
                    Easy Returns
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Clear return information for customers.
                  </p>
                </div>

                <div className="rounded-2xl bg-[#fafaf8] p-6 text-center">
                  <div className="text-lg font-black">
                    Customer Support
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Support when customers need assistance.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="px-7 py-14 md:px-12">
              <div className="mx-auto max-w-3xl">
                <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                  FAQ
                </p>

                <h2 className="mt-3 text-center text-3xl font-black">
                  Questions, answered.
                </h2>

                <div className="mt-8 divide-y divide-gray-200">
                  {product.faq.map((item) => (
                    <details
                      key={item.q}
                      className="group py-5"
                    >
                      <summary className="cursor-pointer list-none font-bold">
                        {item.q}
                      </summary>

                      <p className="mt-3 leading-7 text-gray-600">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            </div>

            {/* FINAL CTA */}
            <div className="bg-black px-7 py-16 text-center text-white md:px-12">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50">
                Ready when you are
              </p>

              <h2 className="mt-4 text-3xl font-black md:text-5xl">
                Make it part of your everyday style.
              </h2>

              <button className="mt-8 rounded-2xl bg-white px-8 py-4 font-bold text-black">
                Add to Cart
              </button>
            </div>
          </div>

          {/* SEO OUTPUT */}
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-white p-7">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">SEO Title</h3>
                <span
                  className={`text-sm font-bold ${
                    seoTitle.length > 50
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  {seoTitle.length}/50
                </span>
              </div>

              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
                {seoTitle}
              </p>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white p-7">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Meta Description</h3>
                <span
                  className={`text-sm font-bold ${
                    metaDescription.length > 160
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  {metaDescription.length}/160
                </span>
              </div>

              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
                {metaDescription}
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
