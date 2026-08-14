"use client";

import { useState } from "react";

const audiences = ["Women", "Men", "Unisex"];

const angles = [
  "Premium / Luxury",
  "Everyday",
  "Professional",
  "Casual",
  "Sport",
  "Gift",
  "Custom",
];

const templates = [
  {
    id: "luxury",
    name: "Luxury",
    description: "Premium presentation for luxury products and timepieces.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, modern layout with a simple shopping experience.",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Elegant presentation with a timeless product-store feel.",
  },
  {
    id: "sport",
    name: "Sport",
    description: "Bold presentation for sport and performance products.",
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "High-end visual storytelling for premium products.",
  },
];

export default function Page() {
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("English");
  const [audience, setAudience] = useState("Unisex");
  const [angle, setAngle] = useState("Premium / Luxury");
  const [customAngle, setCustomAngle] = useState("");
  const [images, setImages] = useState(3);
  const [template, setTemplate] = useState("luxury");

  function handleNext() {
    if (!url.trim()) {
      alert("Please enter a product URL.");
      return;
    }

    const settings = {
      productUrl: url,
      language,
      audience,
      angle: angle === "Custom" ? customAngle : angle,
      aiImages: images,
      template,
    };

    localStorage.setItem(
      "virello_product_settings",
      JSON.stringify(settings)
    );

    alert("Virello product setup saved.");
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#111]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-xl font-black tracking-[0.22em]">
              VIRELLO
            </div>
            <div className="mt-1 text-[9px] font-bold tracking-[0.25em] text-gray-500">
              AI PRODUCT OPTIMIZER
            </div>
          </div>

          <div className="text-sm font-medium text-gray-500">
            Product Page Generator
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-10">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
            STEP 01
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Create your
            <br />
            product page.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
            Add your product information and let Virello prepare a
            professional, conversion-focused product page.
          </p>
        </div>

        <div className="space-y-6">
          {/* PRODUCT URL */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold">Product URL</h2>
              <p className="mt-1 text-sm text-gray-500">
                Paste the URL of the product you want to optimize.
              </p>
            </div>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/product"
              className="w-full rounded-2xl border border-gray-300 px-5 py-4 text-base outline-none transition focus:border-black"
            />
          </section>

          {/* LANGUAGE */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold">Language</h2>

            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-5 w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 outline-none focus:border-black"
            >
              <option>English</option>
              <option>French</option>
              <option>Spanish</option>
              <option>German</option>
            </select>
          </section>

          {/* TARGET AUDIENCE */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold">Target Audience</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {audiences.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAudience(item)}
                  className={`rounded-2xl border px-5 py-4 text-sm font-bold transition ${
                    audience === item
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white hover:border-gray-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          {/* COPYWRITING ANGLE */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold">Copywriting Angle</h2>

            <p className="mt-1 text-sm text-gray-500">
              Choose the angle Virello should use when creating the copy.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {angles.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAngle(item)}
                  className={`rounded-2xl border px-5 py-4 text-left text-sm font-bold transition ${
                    angle === item
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white hover:border-gray-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            {angle === "Custom" && (
              <textarea
                value={customAngle}
                onChange={(e) => setCustomAngle(e.target.value)}
                placeholder="Describe the selling angle you want..."
                className="mt-4 min-h-28 w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-black"
              />
            )}
          </section>

          {/* AI PRODUCT IMAGES */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">AI Product Images</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Choose how many AI-generated product images to create.
                </p>
              </div>

              <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold">
                {images}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((number) => (
                <button
                  key={number}
                  type="button"
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
          </section>

          {/* TEMPLATE */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Product Page Style</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select the visual style for the generated product page.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    template === item.id
                      ? "border-black bg-black text-white"
                      : "border-gray-200 bg-white hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{item.name}</span>

                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                        template === item.id
                          ? "border-white bg-white text-black"
                          : "border-gray-300"
                      }`}
                    >
                      {template === item.id ? "✓" : ""}
                    </span>
                  </div>

                  <p
                    className={`mt-2 text-sm leading-6 ${
                      template === item.id
                        ? "text-white/70"
                        : "text-gray-500"
                    }`}
                  >
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* NEXT */}
          <section className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex flex-col items-center justify-between gap-5 sm:flex-row">
              <div>
                <div className="text-sm font-bold">
                  Ready to generate?
                </div>

                <div className="mt-1 text-sm text-gray-500">
                  Virello will use your selections for the next step.
                </div>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-2xl bg-black px-8 py-4 font-bold text-white transition hover:bg-gray-800 sm:w-auto"
              >
                Next →
              </button>
            </div>
          </section>
        </div>

        <div className="py-10 text-center text-xs font-medium text-gray-400">
          Virello AI Optimizer
        </div>
      </div>
    </main>
  );
}
