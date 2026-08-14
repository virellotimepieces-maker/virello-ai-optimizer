"use client";

import { useState } from "react";

type ProductData = {
  title: string;
  price: string;
  audience: string;
  style: string;
  imageCount: number;
};

function buildProduct(data: ProductData) {
  const cleanTitle = data.title
    .replace(/\b(top|new)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const seoTitle = `${cleanTitle} | Men's Luxury Watch`;

  const metaDescription =
    `Discover the ${cleanTitle.toLowerCase()}, designed with a refined look for business, everyday wear and special occasions. Shop a polished timepiece today.`;

  const description =
    `Designed for men who appreciate a refined timepiece, the ${cleanTitle.toLowerCase()} brings a polished presence to both everyday and occasion-ready styling. Its versatile design pairs naturally with tailored business looks, smart-casual outfits and evening wear.

Whether worn as an everyday accessory or selected as a thoughtful gift, this watch is designed to add a sophisticated finishing touch without feeling overdone.`;

  const highlights = [
    "Refined design for a polished appearance",
    "Versatile styling for business and casual wear",
    "Designed for comfortable everyday use",
    "A sophisticated choice for personal wear or gifting",
  ];

  const faqs = [
    {
      q: "Is this watch suitable for everyday wear?",
      a: "Yes. Its versatile design makes it suitable for everyday outfits as well as more polished occasions.",
    },
    {
      q: "Can it be worn with formal clothing?",
      a: "Yes. The refined styling pairs well with business attire, dress shirts and formal looks.",
    },
    {
      q: "Is it suitable as a gift?",
      a: "Yes. Its classic presentation makes it a thoughtful option for birthdays, anniversaries and other occasions.",
    },
  ];

  return {
    cleanTitle,
    seoTitle,
    metaDescription,
    description,
    highlights,
    faqs,
  };
}

export default function Home() {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("129.99");
  const [audience, setAudience] = useState("Men");
  const [style, setStyle] = useState("Premium / Luxury");
  const [imageCount, setImageCount] = useState(4);

  const [product, setProduct] = useState<ReturnType<typeof buildProduct> | null>(
    null
  );

  function generateProduct() {
    if (!title.trim()) {
      alert("Please enter a product title.");
      return;
    }

    const result = buildProduct({
      title,
      price,
      audience,
      style,
      imageCount,
    });

    setProduct(result);
    setMode("preview");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: "#18181b",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "22px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.16em",
            }}
          >
            VIRELLO
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#71717a",
              letterSpacing: "0.08em",
            }}
          >
            AI PRODUCT OPTIMIZER
          </div>
        </div>
      </header>

      {mode === "edit" && (
        <section
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "70px 24px",
          }}
        >
          <div style={{ marginBottom: 45 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#71717a",
                marginBottom: 18,
              }}
            >
              Virello AI
            </div>

            <h1
              style={{
                fontSize: "clamp(42px, 7vw, 76px)",
                lineHeight: 0.98,
                letterSpacing: "-0.055em",
                margin: 0,
                maxWidth: 760,
              }}
            >
              Create a better
              <br />
              product page.
            </h1>

            <p
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                color: "#52525b",
                maxWidth: 650,
                marginTop: 28,
              }}
            >
              Enter your product information and generate a complete,
              product-specific ecommerce page.
            </p>
          </div>

          <div
            style={{
              border: "1px solid #e4e4e7",
              borderRadius: 20,
              padding: 28,
              background: "#fafafa",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: 22 }}>
              Product Information
            </h2>

            <label style={labelStyle}>Product Title</label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Paste your original product title"
              style={inputStyle}
            />

            <label style={labelStyle}>Product Price</label>

            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 15,
                  top: 14,
                  color: "#71717a",
                }}
              >
                $
              </span>

              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{
                  ...inputStyle,
                  paddingLeft: 30,
                }}
              />
            </div>

            <label style={labelStyle}>Target Audience</label>

            <div style={buttonGroupStyle}>
              {["Women", "Men", "Unisex"].map((item) => (
                <button
                  key={item}
                  onClick={() => setAudience(item)}
                  style={choiceStyle(audience === item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Copywriting</label>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
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
                  onClick={() => setStyle(item)}
                  style={choiceStyle(style === item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <label style={labelStyle}>Visuals</label>

            <div>
              <div
                style={{
                  fontSize: 14,
                  color: "#71717a",
                  marginBottom: 10,
                }}
              >
                Number of Product Images
              </div>

              <div style={buttonGroupStyle}>
                {[0, 1, 2, 3, 4, 5, 6].map((number) => (
                  <button
                    key={number}
                    onClick={() => setImageCount(number)}
                    style={choiceStyle(imageCount === number)}
                  >
                    {number}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateProduct}
              style={{
                marginTop: 32,
                width: "100%",
                padding: "17px 22px",
                borderRadius: 12,
                border: "none",
                background: "#18181b",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Generate AI Product Page →
            </button>
          </div>
        </section>
      )}

      {mode === "preview" && product && (
        <section
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "24px",
          }}
        >
          <button
            onClick={() => setMode("edit")}
            style={{
              border: "1px solid #d4d4d8",
              background: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 35,
            }}
          >
            ← Edit Product
          </button>

          <div
            style={{
              borderTop: "1px solid #e4e4e7",
              paddingTop: 30,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.14em",
                fontWeight: 800,
              }}
            >
              VIRELLO
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: 55,
                marginTop: 35,
              }}
            >
              <div>
                <div
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: 18,
                    background:
                      "linear-gradient(135deg, #f4f4f5, #e4e4e7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#71717a",
                    fontSize: 15,
                  }}
                >
                  Product Image
                </div>

                {product &&
                  [1, 2, 3].slice(
                    0,
                    Math.max(0, Math.min(product ? 3 : 0, imageCount - 1))
                  ).map((item) => (
                    <div
                      key={item}
                      style={{
                        marginTop: 12,
                        aspectRatio: "1 / 1",
                        borderRadius: 14,
                        background: "#f4f4f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#71717a",
                        fontSize: 13,
                      }}
                    >
                      Additional Product View
                    </div>
                  ))}
              </div>

              <div>
                <div
                  style={{
                    color: "#71717a",
                    fontSize: 14,
                    marginBottom: 18,
                  }}
                >
                  Premium Collection
                </div>

                <h1
                  style={{
                    fontSize: "clamp(36px, 5vw, 62px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.045em",
                    margin: "0 0 25px",
                  }}
                >
                  {product.cleanTitle}
                </h1>

                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 600,
                    marginBottom: 28,
                  }}
                >
                  ${price}
                </div>

                <p
                  style={{
                    fontSize: 18,
                    lineHeight: 1.7,
                    color: "#52525b",
                    whiteSpace: "pre-line",
                  }}
                >
                  {product.description}
                </p>

                <div style={{ marginTop: 30 }}>
                  {product.highlights.map((item) => (
                    <div
                      key={item}
                      style={{
                        marginBottom: 12,
                        fontSize: 16,
                      }}
                    >
                      ✓ {item}
                    </div>
                  ))}
                </div>

                <button
                  style={{
                    marginTop: 25,
                    padding: "16px 28px",
                    borderRadius: 10,
                    border: "none",
                    background: "#18181b",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  ADD TO CART
                </button>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginTop: 25,
                    paddingTop: 20,
                    borderTop: "1px solid #e4e4e7",
                    color: "#52525b",
                    fontSize: 13,
                  }}
                >
                  <div>Secure Checkout</div>
                  <div>Easy Returns</div>
                  <div>Support</div>
                </div>
              </div>
            </div>

            <section
              style={{
                marginTop: 80,
                paddingTop: 45,
                borderTop: "1px solid #e4e4e7",
              }}
            >
              <h2
                style={{
                  fontSize: 32,
                  letterSpacing: "-0.03em",
                }}
              >
                Why it stands out
              </h2>

              <p
                style={{
                  maxWidth: 720,
                  color: "#52525b",
                  lineHeight: 1.7,
                  fontSize: 17,
                }}
              >
                A versatile timepiece designed to complement your wardrobe
                with a polished and confident finish.
              </p>
            </section>

            <section
              style={{
                marginTop: 65,
                paddingTop: 45,
                borderTop: "1px solid #e4e4e7",
              }}
            >
              <h2
                style={{
                  fontSize: 32,
                  letterSpacing: "-0.03em",
                }}
              >
                Frequently Asked Questions
              </h2>

              {product.faqs.map((faq) => (
                <details
                  key={faq.q}
                  style={{
                    borderBottom: "1px solid #e4e4e7",
                    padding: "20px 0",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 17,
                    }}
                  >
                    {faq.q}
                  </summary>

                  <p
                    style={{
                      color: "#52525b",
                      lineHeight: 1.6,
                      marginBottom: 0,
                    }}
                  >
                    {faq.a}
                  </p>
                </details>
              ))}
            </section>

            <section
              style={{
                marginTop: 65,
                padding: "40px 0",
                borderTop: "1px solid #e4e4e7",
              }}
            >
              <h2
                style={{
                  fontSize: 30,
                  marginBottom: 10,
                }}
              >
                SEO Information
              </h2>

              <div style={{ marginTop: 30 }}>
                <h3 style={{ marginBottom: 8 }}>SEO Title</h3>

                <div
                  style={{
                    padding: 18,
                    background: "#f4f4f5",
                    borderRadius: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {product.seoTitle}
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 13,
                    color: "#71717a",
                  }}
                >
                  {product.seoTitle.length}/60
                </div>
              </div>

              <div style={{ marginTop: 30 }}>
                <h3 style={{ marginBottom: 8 }}>Meta Description</h3>

                <div
                  style={{
                    padding: 18,
                    background: "#f4f4f5",
                    borderRadius: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {product.metaDescription}
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 13,
                    color: "#71717a",
                  }}
                >
                  {product.metaDescription.length}/160
                </div>
              </div>
            </section>

            <section
              style={{
                marginTop: 30,
                padding: "50px 0 80px",
                borderTop: "1px solid #e4e4e7",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  color: "#71717a",
                }}
              >
                VIRELLO PRODUCT EXPERIENCE
              </div>

              <h2
                style={{
                  fontSize: "clamp(34px, 5vw, 56px)",
                  letterSpacing: "-0.04em",
                  margin: "20px auto",
                  maxWidth: 700,
                }}
              >
                Make the product easier to understand. Easier to want.
              </h2>

              <button
                style={{
                  padding: "16px 30px",
                  borderRadius: 10,
                  border: "none",
                  background: "#18181b",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                ADD TO CART
              </button>
            </section>
          </div>
        </section>
      )}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        button,
        input {
          font: inherit;
        }

        input:focus {
          outline: 2px solid #18181b;
          outline-offset: 1px;
        }

        @media (max-width: 760px) {
          main section > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 700,
  marginTop: 24,
  marginBottom: 9,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 15px",
  borderRadius: 10,
  border: "1px solid #d4d4d8",
  background: "#fff",
  color: "#18181b",
  fontSize: 16,
};

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const choiceStyle = (active: boolean): React.CSSProperties => ({
  padding: "10px 15px",
  borderRadius: 9,
  border: active ? "1px solid #18181b" : "1px solid #d4d4d8",
  background: active ? "#18181b" : "#fff",
  color: active ? "#fff" : "#18181b",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: active ? 700 : 500,
});
