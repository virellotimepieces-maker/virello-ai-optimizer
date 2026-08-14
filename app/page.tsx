"use client";

import { useState } from "react";

const product = {
  brand: "VIRELLO",
  category: "Premium Collection",
  title: "2026 New PAGANI DESIGN 1701 V5 Men's Watch",
  price: "$129.99",
  comparePrice: "$159.99",
  discount: "19% OFF",
  description:
    "A refined timepiece designed for men who appreciate a polished look, dependable everyday wear, and timeless style.",
  images: [
    "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=1000&q=85",
    "https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1000&q=85",
  ],
  benefits: [
    "Refined premium-looking design",
    "Comfortable for everyday wear",
    "Easy to style with business or casual outfits",
    "Designed for work and special occasions",
  ],
  features: [
    "Classic refined watch design",
    "Comfort-focused construction",
    "Easy-to-read dial",
    "Versatile everyday styling",
    "Gift-ready presentation",
  ],
};

export default function Home() {
  const [activeImage, setActiveImage] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is this watch suitable for everyday wear?",
      a: "Yes. Its versatile design makes it suitable for everyday outfits, business looks, and special occasions.",
    },
    {
      q: "How does the watch fit?",
      a: "The watch is designed with everyday comfort and an adjustable fit in mind.",
    },
    {
      q: "Is it suitable as a gift?",
      a: "Yes. Its classic appearance makes it a thoughtful choice for birthdays, anniversaries, holidays, and other occasions.",
    },
    {
      q: "How will my order arrive?",
      a: "Your order will be carefully prepared and shipped according to the available fulfillment option for the product.",
    },
    {
      q: "What if I need help with my order?",
      a: "Virello provides customer support to help with product and order-related questions.",
    },
  ];

  return (
    <main className="page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #f7f7f5;
          color: #171717;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        button {
          font: inherit;
        }

        .page {
          min-height: 100vh;
          background: #f7f7f5;
        }

        .topbar {
          width: 100%;
          padding: 16px 24px;
          border-bottom: 1px solid #deded9;
          background: rgba(255, 255, 255, 0.96);
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(12px);
        }

        .topbar-inner {
          max-width: 1180px;
          margin: auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .logo {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 3px;
        }

        .preview-label {
          font-size: 12px;
          color: #777;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .hero {
          max-width: 1180px;
          margin: 0 auto;
          padding: 54px 24px 70px;
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          gap: 64px;
          align-items: start;
        }

        .gallery {
          position: sticky;
          top: 90px;
        }

        .main-image {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          display: block;
          background: #ecece8;
          border-radius: 4px;
        }

        .thumbs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-top: 12px;
        }

        .thumb {
          border: 1px solid #ddd;
          padding: 0;
          background: #fff;
          cursor: pointer;
        }

        .thumb.active {
          border: 2px solid #171717;
        }

        .thumb img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }

        .product-info {
          padding-top: 8px;
        }

        .eyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #777;
          margin-bottom: 18px;
        }

        h1 {
          font-size: clamp(36px, 5vw, 62px);
          line-height: 0.98;
          letter-spacing: -2.5px;
          margin: 0 0 24px;
          font-weight: 700;
        }

        .price-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
        }

        .price {
          font-size: 27px;
          font-weight: 700;
        }

        .compare {
          color: #999;
          text-decoration: line-through;
          font-size: 17px;
        }

        .discount {
          background: #171717;
          color: #fff;
          font-size: 11px;
          padding: 6px 9px;
          letter-spacing: 0.5px;
        }

        .description {
          font-size: 17px;
          line-height: 1.75;
          color: #555;
          margin: 0 0 30px;
        }

        .benefits {
          border-top: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
          margin-bottom: 28px;
        }

        .benefit {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px 0;
          font-size: 15px;
          border-bottom: 1px solid #e5e5e5;
        }

        .benefit:last-child {
          border-bottom: none;
        }

        .check {
          width: 21px;
          height: 21px;
          border: 1px solid #222;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          flex-shrink: 0;
        }

        .cart {
          width: 100%;
          border: 0;
          background: #171717;
          color: #fff;
          padding: 19px 24px;
          cursor: pointer;
          font-weight: 700;
          letter-spacing: 1px;
          transition: 0.2s;
        }

        .cart:hover {
          background: #333;
        }

        .trust {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 16px;
        }

        .trust-item {
          text-align: center;
          padding: 14px 5px;
          font-size: 11px;
          color: #666;
          border: 1px solid #e0e0dc;
          background: #fff;
        }

        .section {
          padding: 90px 24px;
          border-top: 1px solid #ddd;
        }

        .section-inner {
          max-width: 1180px;
          margin: auto;
        }

        .section-heading {
          max-width: 700px;
          margin-bottom: 45px;
        }

        .section-heading h2 {
          font-size: clamp(32px, 5vw, 54px);
          line-height: 1.02;
          letter-spacing: -2px;
          margin: 0 0 15px;
        }

        .section-heading p {
          color: #666;
          font-size: 17px;
          line-height: 1.7;
          margin: 0;
        }

        .benefit-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .benefit-card {
          background: #fff;
          border: 1px solid #ddd;
          padding: 28px 22px;
          min-height: 170px;
        }

        .number {
          font-size: 12px;
          color: #999;
          margin-bottom: 30px;
        }

        .benefit-card h3 {
          font-size: 19px;
          margin: 0;
          line-height: 1.25;
        }

        .feature-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 70px;
          align-items: center;
        }

        .feature-image {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
        }

        .feature-list {
          margin: 25px 0 0;
          padding: 0;
          list-style: none;
        }

        .feature-list li {
          padding: 16px 0;
          border-bottom: 1px solid #ddd;
          display: flex;
          gap: 12px;
          font-size: 16px;
        }

        .feature-list li span {
          font-weight: 700;
        }

        .faq {
          max-width: 850px;
          margin: auto;
        }

        .faq-item {
          border-top: 1px solid #d5d5d0;
        }

        .faq-item:last-child {
          border-bottom: 1px solid #d5d5d0;
        }

        .faq-question {
          width: 100%;
          padding: 22px 0;
          border: 0;
          background: transparent;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          text-align: left;
          font-weight: 600;
          font-size: 16px;
        }

        .faq-answer {
          color: #666;
          line-height: 1.7;
          padding: 0 40px 22px 0;
        }

        .cta-section {
          background: #171717;
          color: #fff;
          text-align: center;
          padding: 100px 24px;
        }

        .cta-section h2 {
          max-width: 700px;
          margin: 0 auto 18px;
          font-size: clamp(36px, 6vw, 62px);
          line-height: 1;
          letter-spacing: -2px;
        }

        .cta-section p {
          max-width: 560px;
          margin: 0 auto 30px;
          color: #bbb;
          line-height: 1.7;
        }

        .cta-button {
          display: inline-block;
          background: #fff;
          color: #171717;
          border: none;
          padding: 17px 35px;
          font-weight: 700;
          cursor: pointer;
        }

        .seo {
          background: #fff;
          border-top: 1px solid #ddd;
          padding: 60px 24px;
        }

        .seo-inner {
          max-width: 900px;
          margin: auto;
        }

        .seo h3 {
          font-size: 22px;
          margin: 0 0 10px;
        }

        .seo-box {
          background: #f7f7f5;
          border: 1px solid #ddd;
          padding: 20px;
          margin-bottom: 25px;
          line-height: 1.6;
        }

        .footer {
          padding: 35px 24px;
          text-align: center;
          color: #888;
          font-size: 12px;
          letter-spacing: 1px;
          background: #fff;
        }

        @media (max-width: 850px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 35px;
            padding-top: 30px;
          }

          .gallery {
            position: static;
          }

          h1 {
            font-size: 42px;
          }

          .benefit-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .feature-layout {
            grid-template-columns: 1fr;
            gap: 35px;
          }
        }

        @media (max-width: 520px) {
          .topbar {
            padding: 14px 16px;
          }

          .preview-label {
            font-size: 9px;
          }

          .hero {
            padding: 25px 16px 55px;
          }

          h1 {
            font-size: 38px;
            letter-spacing: -1.5px;
          }

          .price {
            font-size: 24px;
          }

          .benefit-grid {
            grid-template-columns: 1fr;
          }

          .section {
            padding: 65px 16px;
          }

          .section-heading h2 {
            font-size: 38px;
          }

          .trust {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="topbar-inner">
          <div className="logo">{product.brand}</div>
          <div className="preview-label">AI Product Page Preview</div>
        </div>
      </header>

      <section className="hero">
        <div className="gallery">
          <img
            className="main-image"
            src={product.images[activeImage]}
            alt={product.title}
          />

          <div className="thumbs">
            {product.images.map((image, index) => (
              <button
                key={image}
                className={`thumb ${activeImage === index ? "active" : ""}`}
                onClick={() => setActiveImage(index)}
              >
                <img src={image} alt={`Product view ${index + 1}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="product-info">
          <div className="eyebrow">{product.category}</div>

          <h1>{product.title}</h1>

          <div className="price-row">
            <span className="price">{product.price}</span>
            <span className="compare">{product.comparePrice}</span>
            <span className="discount">{product.discount}</span>
          </div>

          <p className="description">{product.description}</p>

          <div className="benefits">
            {product.benefits.map((benefit) => (
              <div className="benefit" key={benefit}>
                <span className="check">✓</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <button className="cart">ADD TO CART</button>

          <div className="trust">
            <div className="trust-item">SECURE CHECKOUT</div>
            <div className="trust-item">EASY RETURNS</div>
            <div className="trust-item">CUSTOMER SUPPORT</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-heading">
            <h2>Designed to make an impression.</h2>
            <p>
              A refined timepiece created to complement modern wardrobes,
              professional settings, everyday outfits, and special occasions.
            </p>
          </div>

          <div className="benefit-grid">
            {product.benefits.map((benefit, index) => (
              <div className="benefit-card" key={benefit}>
                <div className="number">0{index + 1}</div>
                <h3>{benefit}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner feature-layout">
          <img
            className="feature-image"
            src={product.images[1]}
            alt="Watch lifestyle"
          />

          <div>
            <div className="eyebrow">Product Details</div>

            <div className="section-heading">
              <h2>Made for everyday confidence.</h2>
              <p>
                A balanced design created to bring a polished finishing touch
                to your daily wardrobe while maintaining a timeless appearance.
              </p>
            </div>

            <ul className="feature-list">
              {product.features.map((feature) => (
                <li key={feature}>
                  <span>✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-heading">
            <h2>Questions, answered.</h2>
            <p>
              Clear information that helps customers shop with confidence.
            </p>
          </div>

          <div className="faq">
            {faqs.map((faq, index) => (
              <div className="faq-item" key={faq.q}>
                <button
                  className="faq-question"
                  onClick={() =>
                    setOpenFaq(openFaq === index ? null : index)
                  }
                >
                  <span>{faq.q}</span>
                  <span>{openFaq === index ? "−" : "+"}</span>
                </button>

                {openFaq === index && (
                  <div className="faq-answer">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Make it part of your everyday style.</h2>
        <p>
          A versatile timepiece designed to complete your look from the
          workday to the weekend.
        </p>
        <button className="cta-button">ADD TO CART</button>
      </section>

      <section className="seo">
        <div className="seo-inner">
          <h3>SEO Title</h3>
          <div className="seo-box">
            PAGANI DESIGN 1701 V5 Men's Watch | Virello
          </div>

          <h3>Meta Description</h3>
          <div className="seo-box">
            Discover the PAGANI DESIGN 1701 V5 men's watch with a refined,
            versatile design made for everyday wear, business looks and
            special occasions.
          </div>
        </div>
      </section>

      <footer className="footer">
        VIRELLO AI PRODUCT OPTIMIZER · GENERATED PRODUCT PREVIEW
      </footer>
    </main>
  );
}
