"use client";

import { useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  price: string;
  image: string;
  collection: string;
  description: string;
};

const initialProducts: Product[] = [
  {
    id: 1,
    name: "Automatic Steel Timepiece",
    price: "249.00",
    image:
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80",
    collection: "Automatic",
    description:
      "A refined automatic timepiece with a clean dial and polished stainless steel case.",
  },
  {
    id: 2,
    name: "Classic Chronograph",
    price: "289.00",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    collection: "Chronographs",
    description:
      "A sophisticated chronograph designed with balanced proportions and timeless appeal.",
  },
  {
    id: 3,
    name: "Minimal Steel Watch",
    price: "199.00",
    image:
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80",
    collection: "Everyday",
    description:
      "A versatile steel watch with understated styling for everyday wear.",
  },
  {
    id: 4,
    name: "Refined Black Dial",
    price: "229.00",
    image:
      "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=900&q=80",
    collection: "Signature",
    description:
      "A polished timepiece featuring a deep dial and refined modern character.",
  },
];

export default function Home() {
  const [products, setProducts] = useState(initialProducts);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [announcement, setAnnouncement] = useState(
    "Complimentary shipping on orders over $100"
  );
  const [brand, setBrand] = useState("Horizon Timepieces");
  const [heroTitle, setHeroTitle] = useState("Timeless Timepieces");
  const [heroText, setHeroText] = useState(
    "Refined watches designed to bring understated sophistication to every occasion."
  );
  const [heroImage, setHeroImage] = useState(
    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1800&q=85"
  );
  const [accent, setAccent] = useState("#111111");
  const [showBuilder, setShowBuilder] = useState(true);
  const [activeCollection, setActiveCollection] = useState("All");

  const cartCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0
  );

  const cartTotal = Object.entries(cart).reduce(
    (sum, [id, quantity]) => {
      const product = products.find(
        (item) => item.id === Number(id)
      );

      return sum + (product ? Number(product.price) * quantity : 0);
    },
    0
  );

  function addToCart(id: number) {
    setCart((current) => ({
      ...current,
      [id]: (current[id] || 0) + 1,
    }));
  }

  function changeQuantity(id: number, amount: number) {
    setCart((current) => {
      const next = Math.max(0, (current[id] || 0) + amount);
      const copy = { ...current };

      if (next === 0) {
        delete copy[id];
      } else {
        copy[id] = next;
      }

      return copy;
    });
  }

  function updateProduct(
    id: number,
    field: keyof Product,
    value: string
  ) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? { ...product, [field]: value }
          : product
      )
    );
  }

  const collections = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(products.map((product) => product.collection))
      ),
    ],
    [products]
  );

  const visibleProducts =
    activeCollection === "All"
      ? products
      : products.filter(
          (product) => product.collection === activeCollection
        );

  return (
    <main
      className="app"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      {showBuilder && (
        <section className="builder">
          <div className="builderHead">
            <div>
              <strong>Storefront Builder</strong>
              <span>Live preview & controls</span>
            </div>

            <button onClick={() => setShowBuilder(false)}>
              Hide Builder
            </button>
          </div>

          <div className="controls">
            <label>
              Brand
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </label>

            <label>
              Announcement
              <input
                value={announcement}
                onChange={(e) =>
                  setAnnouncement(e.target.value)
                }
              />
            </label>

            <label>
              Hero Title
              <input
                value={heroTitle}
                onChange={(e) =>
                  setHeroTitle(e.target.value)
                }
              />
            </label>

            <label>
              Hero Text
              <textarea
                value={heroText}
                onChange={(e) =>
                  setHeroText(e.target.value)
                }
              />
            </label>

            <label>
              Hero Image URL
              <input
                value={heroImage}
                onChange={(e) =>
                  setHeroImage(e.target.value)
                }
              />
            </label>

            <label>
              Accent Color
              <input
                type="color"
                value={accent}
                onChange={(e) =>
                  setAccent(e.target.value)
                }
              />
            </label>
          </div>

          <div className="productEditor">
            <h3>Edit Products</h3>

            {products.map((product) => (
              <div className="editRow" key={product.id}>
                <input
                  value={product.name}
                  onChange={(e) =>
                    updateProduct(
                      product.id,
                      "name",
                      e.target.value
                    )
                  }
                />

                <input
                  value={product.price}
                  onChange={(e) =>
                    updateProduct(
                      product.id,
                      "price",
                      e.target.value
                    )
                  }
                />

                <input
                  value={product.image}
                  onChange={(e) =>
                    updateProduct(
                      product.id,
                      "image",
                      e.target.value
                    )
                  }
                />

                <input
                  value={product.collection}
                  onChange={(e) =>
                    updateProduct(
                      product.id,
                      "collection",
                      e.target.value
                    )
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {!showBuilder && (
        <button
          className="showBuilder"
          onClick={() => setShowBuilder(true)}
        >
          Edit Storefront
        </button>
      )}

      <section className="storefront">
        <div className="announcement">
          {announcement}
        </div>

        <header className="nav">
          <div className="brand">{brand}</div>

          <nav>
            <a href="#shop">Shop</a>
            <a href="#collections">Collections</a>
            <a href="#about">About</a>
          </nav>

          <div className="cart">
            Cart <b>{cartCount}</b>
          </div>
        </header>

        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.15)), url(${heroImage})`,
          }}
        >
          <div className="heroContent">
            <p>THE COLLECTION</p>

            <h1>{heroTitle}</h1>

            <div>{heroText}</div>

            <a href="#shop" className="heroButton">
              Explore Collection
            </a>
          </div>
        </section>

        <section className="shop" id="shop">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">CURATED FOR YOU</p>
              <h2>Featured Timepieces</h2>
            </div>

            <div
              className="collections"
              id="collections"
            >
              {collections.map((collection) => (
                <button
                  className={
                    activeCollection === collection
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setActiveCollection(collection)
                  }
                  key={collection}
                >
                  {collection}
                </button>
              ))}
            </div>
          </div>

          <div className="grid">
            {visibleProducts.map((product) => (
              <article className="card" key={product.id}>
                <div className="imageWrap">
                  <img
                    src={product.image}
                    alt={product.name}
                  />

                  <span>{product.collection}</span>
                </div>

                <div className="cardBody">
                  <h3>{product.name}</h3>

                  <p>{product.description}</p>

                  <div className="cardBottom">
                    <strong>
                      ${Number(product.price).toFixed(2)}
                    </strong>

                    <button
                      onClick={() =>
                        addToCart(product.id)
                      }
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="cartPanel"
          aria-label="Shopping cart"
        >
          <div>
            <strong>Cart</strong>
            <span>
              {cartCount} item
              {cartCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="cartItems">
            {cartCount === 0 ? (
              <span>Your cart is empty.</span>
            ) : (
              Object.entries(cart).map(
                ([id, quantity]) => {
                  const product = products.find(
                    (p) => p.id === Number(id)
                  );

                  if (!product) return null;

                  return (
                    <div
                      className="cartItem"
                      key={id}
                    >
                      <span>{product.name}</span>

                      <div>
                        <button
                          onClick={() =>
                            changeQuantity(
                              product.id,
                              -1
                            )
                          }
                        >
                          −
                        </button>

                        <b>{quantity}</b>

                        <button
                          onClick={() =>
                            changeQuantity(
                              product.id,
                              1
                            )
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>

          <div className="cartTotal">
            <strong>
              Total ${cartTotal.toFixed(2)}
            </strong>

            <button disabled={cartCount === 0}>
              Checkout
            </button>
          </div>
        </section>

        <footer id="about">
          <div>
            <strong>{brand}</strong>

            <p>
              Thoughtfully selected timepieces with a focus
              on refined design and timeless style.
            </p>
          </div>

          <div>
            <h4>Shop</h4>
            <a href="#shop">All Watches</a>
            <a href="#collections">Collections</a>
          </div>

          <div>
            <h4>Customer Care</h4>
            <a href="#about">Shipping</a>
            <a href="#about">Returns</a>
            <a href="#about">Contact</a>
          </div>
        </footer>

        <div className="copyright">
          © 2026 {brand}. All rights reserved.
        </div>
      </section>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .app {
          min-height: 100vh;
          background: #eef0f2;
          color: #151515;
          font-family: Arial, sans-serif;
        }

        .builder {
          max-width: 1400px;
          margin: 0 auto;
          padding: 18px;
        }

        .builderHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .builderHead div {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .builderHead span {
          color: #666;
          font-size: 13px;
        }

        .builder button,
        .showBuilder {
          border: 0;
          background: #111;
          color: #fff;
          padding: 10px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: #fff;
          padding: 14px;
          border-radius: 12px;
        }

        .controls label {
          font-size: 12px;
          font-weight: 700;
          color: #333;
        }

        .controls input,
        .controls textarea,
        .editRow input {
          width: 100%;
          margin-top: 6px;
          padding: 10px;
          border: 1px solid #d5d7da;
          border-radius: 8px;
          color: #111;
          background: #fff;
        }

        .controls textarea {
          min-height: 72px;
          resize: vertical;
        }

        .productEditor {
          margin-top: 10px;
          background: #fff;
          padding: 14px;
          border-radius: 12px;
        }

        .productEditor h3 {
          margin: 0 0 10px;
        }

        .editRow {
          display: grid;
          grid-template-columns: 1.2fr 0.5fr 2fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .showBuilder {
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 20;
        }

        .storefront {
          background: #fff;
          max-width: 1400px;
          margin: auto;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }

        .announcement {
          background: var(--accent);
          color: #fff;
          text-align: center;
          padding: 9px 14px;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .nav {
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 5%;
          border-bottom: 1px solid #eee;
        }

        .brand {
          font-family: Georgia, serif;
          font-size: 24px;
          letter-spacing: 0.03em;
        }

        nav {
          display: flex;
          gap: 28px;
        }

        nav a,
        footer a {
          color: inherit;
          text-decoration: none;
        }

        .cart {
          font-size: 14px;
        }

        .cart b {
          background: #111;
          color: #fff;
          border-radius: 20px;
          padding: 4px 8px;
          margin-left: 5px;
        }

        .hero {
          min-height: 540px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: center;
          color: #fff;
        }

        .heroContent {
          max-width: 650px;
          padding: 8%;
        }

        .heroContent p,
        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.18em;
        }

        .heroContent h1 {
          font-family: Georgia, serif;
          font-size: clamp(44px, 7vw, 82px);
          line-height: 0.95;
          margin: 16px 0;
          font-weight: 500;
        }

        .heroContent div {
          max-width: 520px;
          line-height: 1.7;
        }

        .heroButton {
          display: inline-block;
          margin-top: 26px;
          padding: 13px 20px;
          background: #fff;
          color: #111;
          text-decoration: none;
          border-radius: 3px;
          font-weight: 700;
        }

        .shop {
          padding: 70px 5%;
        }

        .sectionHead {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: end;
          margin-bottom: 30px;
        }

        .sectionHead h2 {
          font-family: Georgia, serif;
          font-size: 40px;
          margin: 7px 0 0;
          font-weight: 500;
        }

        .collections {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .collections button {
          border: 1px solid #ccc;
          background: #fff;
          padding: 8px 12px;
          border-radius: 20px;
          cursor: pointer;
        }

        .collections .selected {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 22px;
        }

        .card {
          border: 1px solid #e7e7e7;
          background: #fff;
        }

        .imageWrap {
          aspect-ratio: 1 / 1.12;
          position: relative;
          overflow: hidden;
          background: #f5f5f5;
        }

        .imageWrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.3s;
        }

        .card:hover img {
          transform: scale(1.03);
        }

        .imageWrap span {
          position: absolute;
          top: 10px;
          left: 10px;
          background: #fff;
          padding: 6px 8px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .cardBody {
          padding: 16px;
        }

        .cardBody h3 {
          font-family: Georgia, serif;
          font-size: 20px;
          font-weight: 500;
          margin: 0 0 8px;
        }

        .cardBody p {
          color: #666;
          font-size: 13px;
          line-height: 1.55;
          min-height: 42px;
        }

        .cardBottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
        }

        .cardBottom button {
          background: var(--accent);
          color: #fff;
          border: 0;
          padding: 9px 12px;
          cursor: pointer;
          border-radius: 3px;
        }

        .cartPanel {
          margin: 0 5% 70px;
          border: 1px solid #ddd;
          padding: 20px;
          display: grid;
          gap: 15px;
        }

        .cartPanel > div:first-child {
          display: flex;
          justify-content: space-between;
        }

        .cartPanel > div:first-child span {
          color: #777;
        }

        .cartItems {
          display: grid;
          gap: 8px;
        }

        .cartItem {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }

        .cartItem button {
          border: 1px solid #ccc;
          background: #fff;
          padding: 4px 9px;
          cursor: pointer;
        }

        .cartItem b {
          margin: 0 10px;
        }

        .cartTotal {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .cartTotal button {
          background: var(--accent);
          color: #fff;
          border: 0;
          padding: 11px 18px;
          cursor: pointer;
        }

        .cartTotal button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        footer {
          background: #111;
          color: #fff;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 50px;
          padding: 55px 5%;
        }

        footer strong {
          font-family: Georgia, serif;
          font-size: 24px;
        }

        footer p {
          color: #aaa;
          max-width: 420px;
          line-height: 1.6;
        }

        footer h4 {
          margin-top: 0;
        }

        footer a {
          display: block;
          color: #aaa;
          margin: 9px 0;
          font-size: 14px;
        }

        .copyright {
          background: #111;
          color: #777;
          text-align: center;
          padding: 18px;
          border-top: 1px solid #333;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .controls {
            grid-template-columns: 1fr 1fr;
          }

          .editRow {
            grid-template-columns: 1fr 1fr;
          }

          .grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .sectionHead {
            align-items: start;
            flex-direction: column;
          }
        }

        @media (max-width: 600px) {
          .builder {
            padding: 10px;
          }

          .controls {
            grid-template-columns: 1fr;
          }

          .editRow {
            grid-template-columns: 1fr;
          }

          .nav {
            padding: 0 4%;
          }

          nav {
            display: none;
          }

          .brand {
            font-size: 19px;
          }

          .hero {
            min-height: 480px;
          }

          .heroContent {
            padding: 9%;
          }

          .heroContent h1 {
            font-size: 50px;
          }

          .shop {
            padding: 45px 4%;
          }

          .grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .cardBody {
            padding: 10px;
          }

          .cardBody h3 {
            font-size: 16px;
          }

          .cardBody p {
            font-size: 12px;
          }

          .cardBottom {
            align-items: start;
            gap: 7px;
            flex-direction: column;
          }

          footer {
            grid-template-columns: 1fr;
            gap: 25px;
            padding: 40px 6%;
          }
        }
      `}</style>
    </main>
  );
          }
