"use client";

import { useMemo, useState } from "react";

type ProductData = {
  title: string;
  price: string;
  description: string;
  benefits: string[];
  features: string[];
  faq: { question: string; answer: string }[];
};

const defaultProduct: ProductData = {
  title: "Premium Automatic Watch",
  price: "$129.99",
  description:
    "A refined timepiece designed for a polished everyday look, combining versatile styling with details made to complement business, casual, and special-occasion outfits.",
  benefits: [
    "Refined design for a polished appearance",
    "Versatile style for everyday and business wear",
    "Comfort-focused design for extended wear",
    "A timeless choice for personal use or gifting",
  ],
  features: [
    "Premium-inspired watch design",
    "Classic and versatile styling",
    "Easy-to-read dial presentation",
    "Designed for everyday versatility",
    "Suitable for business and occasion wear",
  ],
  faq: [
    {
      question: "Is this watch suitable for everyday wear?",
      answer:
        "Its versatile design is intended to complement everyday, business, and occasion-ready outfits.",
    },
    {
      question: "Can I wear it with formal clothing?",
      answer:
        "Yes. The refined styling makes it easy to pair with business and more formal outfits.",
    },
    {
      question: "Is it suitable as a gift?",
      answer:
        "Its classic and versatile appearance makes it a thoughtful option for birthdays, anniversaries, holidays, and other occasions.",
    },
  ],
};

function cleanTitle(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}

function createProductTitle(title: string) {
  const cleaned = cleanTitle(title);

  if (!cleaned) return "Premium Automatic Watch";

  if (cleaned.length <= 50) return cleaned;

  const words = cleaned.split(" ");
  let result = "";

  for (const word of words) {
    const next = result ? `${result} ${word}` : word;

    if (next.length > 50) break;

    result = next;
  }

  return result || cleaned.substring(0, 50).trim();
}

function createSeoTitle(title: string) {
  const base = createProductTitle(title);

  if (base.length <= 50) return base;

  return base.substring(0, 50).trim();
}

function createMetaDescription(product: ProductData) {
  const text =
    `${product.title}. ${product.description} ` +
    "Shop with confidence and discover a refined style for everyday wear.";

  if (text.length <= 160) return text;

  return text.substring(0, 157).trimEnd() + "...";
}

function generateContent(title: string, price: string): ProductData {
  const optimizedTitle = createProductTitle(title);

  const lower = optimizedTitle.toLowerCase();

  const isWatch =
    lower.includes("watch") ||
    lower.includes("automatic") ||
    lower.includes("quartz") ||
    lower.includes("chronograph");

  if (isWatch) {
    return {
      title: optimizedTitle,
      price: price || "$129.99",
      description:
        `A refined ${optimizedTitle.toLowerCase()} designed for a polished everyday look. Its versatile styling makes it easy to pair with business attire, casual outfits, and special-occasion looks.`,
      benefits: [
        "Refined design for a polished appearance",
        "Versatile styling for business and casual wear",
        "Comfort-focused design for everyday use",
        "A timeless option for personal wear or gifting",
      ],
      features: [
        "Refined watch presentation",
        "Classic versatile styling",
        "Easy-to-read dial",
        "Designed for everyday versatility",
        "Suitable for business and occasions",
      ],
      faq: [
        {
          question: "Is this watch suitable for everyday wear?",
          answer:
            "The versatile styling makes it suitable for everyday outfits, business looks, and special occasions.",
        },
        {
          question: "Can it be worn with formal clothing?",
          answer:
            "Yes. The refined appearance pairs naturally with business and formal clothing.",
        },
        {
          question: "Is it suitable as a gift?",
          answer:
            "Its classic styling makes it a versatile gift option for birthdays, anniversaries, holidays, and other occasions.",
        },
      ],
    };
  }

  return {
    title: optimizedTitle,
    price: price || "$49.99",
    description:
      `Discover the ${optimizedTitle.toLowerCase()} designed to combine practical everyday use with a clean, polished presentation.`,
    benefits: [
      "Designed for practical everyday use",
      "Clean and versatile presentation",
      "Easy to incorporate into daily routines",
      "A thoughtful option for personal use or gifting",
    ],
    features: [
      "Practical everyday design",
      "Clean modern presentation",
      "Versatile styling",
      "Designed for convenient use",
      "Suitable for everyday needs",
    ],
    faq: [
      {
        question: "Is this suitable for everyday use?",
        answer:
          "Yes. The product is presented as a practical option for everyday use.",
      },
      {
        question: "Who is this product for?",
        answer:
          "Its versatile design makes it suitable for customers looking for a practical and polished everyday option.",
      },
      {
        question: "Is it suitable as a gift?",
        answer:
          "Its versatile presentation makes it suitable for a variety of gifting occasions.",
      },
    ],
  };
}

export default function Page() {
  const [productTitle, setProductTitle] = useState("");
  const [price, setPrice] = useState("");
  const [audience, setAudience] = useState("Men");
  const [angle, setAngle] = useState("Premium / Luxury");
  const [images, setImages] = useState(4);
  const [generated, setGenerated] = useState<ProductData | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const product = generated || defaultProduct;

  const seoTitle = useMemo(
    () => createSeoTitle(product.title),
    [product.title]
  );

  const metaDescription = useMemo(
    () => createMetaDescription(product),
    [product]
  );

  const imagePlaceholders = [
    "Product Image",
    "Detail View",
    "Lifestyle View",
    "Close-up View",
    "Alternate View",
    "Packaging",
    "Product Detail",
  ];

  function generate() {
    const result = generateContent(
      productTitle || "Premium Automatic Watch",
      price
    );

    setGenerated(result);
    setActiveImage(0);
    setOpenFaq(null);
  }

  return (
    <main className="min-h-screen bg-[#f6f6f3] text-[#171717]">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }
      `}</style>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-xl font-black tracking-[0.25em]">
              VIRELLO
            </div>
            <div className="mt-1 text-[9px] font-bold tracking-[0.28em] text-gray-400">
              AI PRODUCT OPTIMIZER
            </div>
          </div>

          {generated && (
            <button
              onClick={() => setGenerated(null)}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold"
            >
              ← Edit Product
            </button>
          )}
        </div>
      </header>

      {!generated ? (
        /* GENERATOR */
        <section className="mx-auto max-w-5xl px-5 py-12">
          <div className="mb-10">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
              Virello AI
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
              Create a better
              <br />
              product page.
            </h1>

            <p className="mt-5 max-w-2xl leading-7 text-gray-600">
              Enter your product information and generate a complete,
              product-specific ecommerce page.
            </p>
          </div>

          <div className="space-y-5">
            {/* PRODUCT */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                Product Information
              </p>

              <label className="mt-5 block text-sm font-bold">
                Product Title
              </label>

              <input
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
                placeholder="Paste your original product title"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-black"
              />

              <label className="mt-5 block text-sm font-bold">
                Product Price
              </label>

              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="$129.99"
                className="mt-2 w-full rounded-2xl border border-gray-300 px-5 py-4 outline-none focus:border-black"
              />
            </div>

            {/* AUDIENCE */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                Target Audience
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {["Women", "Men", "Unisex"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setAudience(item)}
                    className={`rounded-2xl border px-4 py-4 font-semibold ${
                      audience === item
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* ANGLE */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                Copywriting
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {[
                  "Premium / Luxury",
                  "Professional",
                  "Everyday",
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
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* IMAGES */}
            <div className="rounded-3xl border border-black/10 bg-white p-7 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                Visuals
              </p>

              <label className="mt-4 block text-sm font-bold">
                Number of Product Images
              </label>

              <div className="mt-4 grid grid-cols-7 gap-2">
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

            {/* GENERATE */}
            <button
              onClick={generate}
              className="w-full rounded-2xl bg-black px-6 py-5 text-lg font-bold text-white transition hover:bg-gray-800"
            >
              Generate AI Product Page →
            </button>
          </div>
        </section>
      ) : (
        /* GENERATED PAGE */
        <>
          {/* HERO */}
          <section className="mx-auto grid max-w-7xl gap-12 px-5 py-10 md:grid-cols-2 md:py-16">
            <div>
              <div className="overflow-hidden rounded-3xl bg-[#ecece8]">
                <div className="flex aspect-square items-center justify-center p-10">
                  <div className="flex h-64 w-64 items-center justify-center rounded-full border-[18px] border-gray-800 bg-white shadow-2xl md:h-80 md:w-80">
                    <div className="text-center">
                      <div className="text-3xl font-black">V</div>
                      <div className="mt-2 text-[9px] font-bold tracking-[0.3em]">
                        VIRELLO
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-3">
                {Array.from({ length: Math.max(1, images) }).map(
                  (_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveImage(index)}
                      className={`aspect-square rounded-xl border bg-white text-xs font-semibold ${
                        activeImage === index
                          ? "border-2 border-black"
                          : "border-gray-200"
                      }`}
                    >
                      {imagePlaceholders[index] || "Product View"}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                Premium Collection
              </p>

              <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-tight md:text-6xl">
                {product.title}
              </h1>

              <div className="mt-6 flex items-center gap-3">
                <span className="text-2xl font-bold">{product.price}</span>
              </div>

              <p className="mt-6 text-lg leading-8 text-gray-600">
                {product.description}
              </p>

              <div className="mt-7 divide-y border-y">
                {product.benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-center gap-3 py-4 text-sm font-semibold"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-xs text-white">
                      ✓
                    </span>
                    {benefit}
                  </div>
                ))}
              </div>

              <button className="mt-7 rounded-2xl bg-black px-6 py-5 font-bold tracking-wide text-white">
                ADD TO CART
              </button>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {["Secure Checkout", "Easy Returns", "Support"].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border bg-white p-3 text-center text-[10px] font-bold uppercase text-gray-500"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* BENEFITS */}
          <section className="border-y bg-white px-5 py-20">
            <div className="mx-auto max-w-7xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                Why it stands out
              </p>

              <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
                Designed around what customers actually want.
              </h2>

              <div className="mt-10 grid gap-4 md:grid-cols-4">
                {product.benefits.map((benefit, index) => (
                  <div
                    key={benefit}
                    className="rounded-2xl border bg-[#fafaf8] p-6"
                  >
                    <div className="text-xs font-bold text-gray-400">
                      0{index + 1}
                    </div>

                    <h3 className="mt-12 text-lg font-bold leading-tight">
                      {benefit}
                    </h3>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section className="px-5 py-20">
            <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
              <div className="flex aspect-square items-center justify-center rounded-3xl bg-[#e9e9e5]">
                <div className="flex h-56 w-56 items-center justify-center rounded-full border-[15px] border-gray-800 bg-white shadow-xl md:h-72 md:w-72">
                  <span className="text-2xl font-black">V</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                  Product Details
                </p>

                <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Details that complete the experience.
                </h2>

                <p className="mt-5 leading-8 text-gray-600">
                  Virello organizes the available product information into
                  clear sections so customers can understand the product
                  without digging through a wall of text.
                </p>

                <div className="mt-7 divide-y border-y">
                  {product.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center justify-between py-5 font-semibold"
                    >
                      <span>{feature}</span>
                      <span>✓</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="border-t bg-white px-5 py-20">
            <div className="mx-auto max-w-4xl">
              <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                Frequently Asked Questions
              </p>

              <h2 className="mt-3 text-center text-4xl font-black">
                Questions, answered.
              </h2>

              <div className="mt-10 divide-y border-y">
                {product.faq.map((item, index) => (
                  <div key={item.question}>
                    <button
                      onClick={() =>
                        setOpenFaq(openFaq === index ? null : index)
                      }
                      className="flex w-full items-center justify-between py-6 text-left font-bold"
                    >
                      {item.question}
                      <span className="ml-4 text-xl">
                        {openFaq === index ? "−" : "+"}
                      </span>
                    </button>

                    {openFaq === index && (
                      <p className="pb-6 pr-10 leading-7 text-gray-600">
                        {item.answer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="bg-black px-5 py-24 text-center text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">
              Virello Product Experience
            </p>

            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
              Make the product easier to understand. Easier to want.
            </h2>

            <button className="mt-8 rounded-2xl bg-white px-8 py-4 font-bold text-black">
              ADD TO CART
            </button>
          </section>

          {/* SEO */}
          <section className="border-t bg-[#f6f6f3] px-5 py-16">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-2xl font-black">SEO Information</h2>

              <div className="mt-7 rounded-2xl border bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold">SEO Title</h3>
                  <span
                    className={
                      seoTitle.length > 50
                        ? "font-bold text-red-600"
                        : "text-sm font-bold text-gray-500"
                    }
                  >
                    {seoTitle.length}/50
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
                  {seoTitle}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-bold">Meta Description</h3>
                  <span
                    className={
                      metaDescription.length > 160
                        ? "font-bold text-red-600"
                        : "text-sm font-bold text-gray-500"
                    }
                  >
                    {metaDescription.length}/160
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm leading-6">
                  {metaDescription}
                </div>
              </div>
            </div>
          </section>

          <footer className="border-t bg-white px-5 py-8 text-center text-xs font-bold tracking-[0.2em] text-gray-400">
            VIRELLO AI OPTIMIZER
          </footer>
        </>
      )}
    </main>
  );
                  }
