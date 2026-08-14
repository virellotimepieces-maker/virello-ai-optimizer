"use client";

import { useRef, useState } from "react";

type Product = {
  id: string;
  title: string;
  description: string;
  keywords: string;
  seoTitle: string;
  metaDescription: string;
  imageUrl: string;
};

const starter: Product = {
  id: "1",
  title: "Luxury Stainless Steel Automatic Watch",
  description:
    "A refined automatic watch designed with a stainless steel case, clean dial and timeless styling for everyday wear.",
  keywords: "automatic watch, stainless steel watch, luxury watch",
  seoTitle: "Luxury Stainless Steel Automatic Watch",
  metaDescription:
    "Discover a refined stainless steel automatic watch with timeless styling, a clean dial and an elegant everyday design.",
  imageUrl: "",
};

function makeUnique(text: string, index: number) {
  const endings = [
    "with Timeless Style",
    "for Everyday Wear",
    "with Refined Detail",
    "for Modern Looks",
    "with Premium Appeal",
    "for Effortless Style",
    "with Classic Character",
    "for a Polished Finish",
  ];

  const clean = text.trim() || "Premium Product";
  return `${clean} ${endings[index % endings.length]}`;
}

function optimizeProduct(product: Product, index: number): Product {
  const baseTitle = product.title.trim() || "Premium Product";
  const uniqueTitle = makeUnique(baseTitle, index);

  const descriptionTemplates = [
    `Discover ${baseTitle}, thoughtfully styled for a polished everyday look. Designed with a refined appearance and practical appeal, it is an easy choice for modern shoppers.`,
    `Upgrade your collection with ${baseTitle}. Its clean design and versatile character make it suitable for everyday use, special occasions and effortless styling.`,
    `${baseTitle} combines a refined look with versatile everyday appeal. A stylish choice for shoppers looking for quality-inspired design and a polished finish.`,
    `Add ${baseTitle} to your collection for a distinctive and sophisticated look. Its versatile styling makes it easy to pair with a wide range of outfits and occasions.`,
  ];

  const description =
    descriptionTemplates[index % descriptionTemplates.length];

  const keywords = [
    baseTitle,
    "luxury",
    "premium design",
    "elegant style",
    "everyday wear",
    `style ${index + 1}`,
  ].join(", ");

  const seoTitle = uniqueTitle.slice(0, 70);

  const meta = `${description} Shop online today.`.slice(0, 160);

  return {
    ...product,
    title: uniqueTitle,
    description,
    keywords,
    seoTitle,
    metaDescription: meta,
  };
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([starter]);
  const [selected, setSelected] = useState("1");
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  const selectedProduct =
    products.find((p) => p.id === selected) || products[0];

  function updateProduct(field: keyof Product, value: string) {
    setProducts((current) =>
      current.map((p) =>
        p.id === selected ? { ...p, [field]: value } : p
      )
    );
  }

  function addProduct() {
    const id = Date.now().toString();

    const newProduct: Product = {
      id,
      title: "New Product",
      description: "",
      keywords: "",
      seoTitle: "",
      metaDescription: "",
      imageUrl: "",
    };

    setProducts((current) => [...current, newProduct]);
    setSelected(id);
  }

  function deleteProduct() {
    if (products.length === 1) return;

    const remaining = products.filter((p) => p.id !== selected);
    setProducts(remaining);
    setSelected(remaining[0].id);
  }

  function optimizeCurrent() {
    if (!selectedProduct) return;

    setProducts((current) =>
      current.map((p, index) =>
        p.id === selected ? optimizeProduct(p, index) : p
      )
    );
  }

  function optimizeAll() {
    setProducts((current) =>
      current.map((p, index) => optimizeProduct(p, index))
    );
  }

  function exportCSV() {
    const headers = [
      "title",
      "description",
      "keywords",
      "seoTitle",
      "metaDescription",
      "imageUrl",
    ];

    const rows = products.map((p) =>
      headers
        .map((h) => `"${String(p[h as keyof Product]).replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "virello-products.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  function importCSV(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r?\n/).filter(Boolean);

      if (lines.length < 2) return;

      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/^"|"$/g, "").trim());

      const imported: Product[] = lines.slice(1).map((line, index) => {
        const values =
          line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((v) =>
            v.replace(/^"|"$/g, "").replace(/""/g, '"')
          ) || [];

        const get = (name: string) =>
          values[headers.indexOf(name)] || "";

        return {
          id: `${Date.now()}-${index}`,
          title: get("title"),
          description: get("description"),
          keywords: get("keywords"),
          seoTitle: get("seoTitle"),
          metaDescription: get("metaDescription"),
          imageUrl: get("imageUrl"),
        };
      });

      if (imported.length) {
        setProducts(imported);
        setSelected(imported[0].id);
      }
    };

    reader.readAsText(file);
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Virello AI Optimizer</h1>
          <p>Product content and SEO optimization</p>
        </div>
      </header>

      <section className="toolbar">
        <button onClick={addProduct}>+ Add Product</button>
        <button onClick={optimizeCurrent}>Optimize</button>
        <button onClick={optimizeAll}>Optimize All</button>
        <button onClick={deleteProduct}>Delete Product</button>

        <button onClick={() => fileRef.current?.click()}>
          Import CSV
        </button>

        <button onClick={exportCSV}>Export CSV</button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importCSV(file);
            e.currentTarget.value = "";
          }}
        />
      </section>

      <section className="searchBox">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
        />
      </section>

      <div className="layout">
        <aside className="products">
          <h2>Products ({products.length})</h2>

          {filtered.map((product) => (
            <button
              key={product.id}
              className={
                product.id === selected ? "product active" : "product"
              }
              onClick={() => setSelected(product.id)}
            >
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" />
              ) : (
                <div className="placeholder">IMG</div>
              )}

              <span>{product.title || "Untitled Product"}</span>
            </button>
          ))}
        </aside>

        {selectedProduct && (
          <section className="editor">
            <h2>Edit Product</h2>

            <label>Product Title</label>
            <input
              value={selectedProduct.title}
              onChange={(e) => updateProduct("title", e.target.value)}
            />

            <label>Description</label>
            <textarea
              rows={7}
              value={selectedProduct.description}
              onChange={(e) =>
                updateProduct("description", e.target.value)
              }
            />

            <label>Keywords</label>
            <textarea
              rows={3}
              value={selectedProduct.keywords}
              onChange={(e) => updateProduct("keywords", e.target.value)}
            />

            <label>
              SEO Title
              <small>{selectedProduct.seoTitle.length}/70</small>
            </label>
            <input
              value={selectedProduct.seoTitle}
              maxLength={70}
              onChange={(e) =>
                updateProduct("seoTitle", e.target.value)
              }
            />

            <label>
              Meta Description
              <small>{selectedProduct.metaDescription.length}/160</small>
            </label>
            <textarea
              rows={4}
              maxLength={160}
              value={selectedProduct.metaDescription}
              onChange={(e) =>
                updateProduct("metaDescription", e.target.value)
              }
            />

            <label>Product Image URL</label>
            <input
              value={selectedProduct.imageUrl}
              placeholder="https://example.com/product-image.jpg"
              onChange={(e) =>
                updateProduct("imageUrl", e.target.value)
              }
            />

            {selectedProduct.imageUrl && (
              <div className="imagePreview">
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.title}
                />
              </div>
            )}

            <div className="googlePreview">
              <h3>Search Preview</h3>
              <div className="googleTitle">
                {selectedProduct.seoTitle || selectedProduct.title}
              </div>
              <div className="googleUrl">
                virello-timepieces.com
              </div>
              <div className="googleDescription">
                {selectedProduct.metaDescription ||
                  selectedProduct.description}
              </div>
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 24px;
          background: #f5f6f8;
          color: #171717;
          font-family: Arial, sans-serif;
        }

        .header {
          background: #111;
          color: white;
          padding: 22px;
          border-radius: 14px;
          margin-bottom: 16px;
        }

        h1,
        h2,
        h3 {
          margin-top: 0;
        }

        .header p {
          margin-bottom: 0;
          opacity: 0.75;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        button {
          border: 0;
          border-radius: 9px;
          padding: 11px 14px;
          cursor: pointer;
          background: #111;
          color: white;
          font-weight: 600;
        }

        button:hover {
          opacity: 0.85;
        }

        .searchBox input,
        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d6d8dc;
          border-radius: 9px;
          padding: 12px;
          font-size: 15px;
          background: white;
        }

        .searchBox {
          margin-bottom: 16px;
        }

        .layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 16px;
        }

        .products,
        .editor {
          background: white;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .product {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          margin-bottom: 8px;
          background: #f1f2f4;
          color: #111;
        }

        .product.active {
          outline: 2px solid #111;
        }

        .product img,
        .placeholder {
          width: 45px;
          height: 45px;
          object-fit: cover;
          border-radius: 7px;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }

        .editor label {
          display: block;
          margin: 16px 0 7px;
          font-weight: 700;
        }

        .editor small {
          float: right;
          font-weight: 400;
          color: #777;
        }

        .imagePreview {
          margin-top: 12px;
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 10px;
          text-align: center;
        }

        .imagePreview img {
          max-width: 100%;
          max-height: 280px;
          object-fit: contain;
        }

        .googlePreview {
          margin-top: 20px;
          border: 1px solid #ddd;
          border-radius: 10px;
          padding: 16px;
        }

        .googleTitle {
          color: #1a0dab;
          font-size: 19px;
          margin-bottom: 4px;
        }

        .googleUrl {
          color: #188038;
          font-size: 13px;
          margin-bottom: 5px;
        }

        .googleDescription {
          color: #444;
          font-size: 14px;
          line-height: 1.5;
        }

        @media (max-width: 700px) {
          .page {
            padding: 12px;
          }

          .layout {
            grid-template-columns: 1fr;
          }

          .toolbar button {
            flex: 1 1 45%;
          }
        }
        .page input,
.page textarea,
.page .searchBox input {
  color: #171717 !important;
  background: #fff !important;
}

.page label {
  color: #222 !important;
}

.page input::placeholder,
.page textarea::placeholder {
  color: #777 !important;
}
      `}</style>
    </main>
  );
           }
