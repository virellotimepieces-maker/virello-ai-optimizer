"use client";

import { useState } from "react";

type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "wix"
  | "manual"
  | null;

const platforms = [
  {
    id: "shopify" as const,
    name: "Shopify",
    description: "Connect your Shopify store",
  },
  {
    id: "woocommerce" as const,
    name: "WooCommerce",
    description: "Connect your WooCommerce store",
  },
  {
    id: "bigcommerce" as const,
    name: "BigCommerce",
    description: "Connect your BigCommerce store",
  },
  {
    id: "wix" as const,
    name: "Wix",
    description: "Connect your Wix store",
  },
  {
    id: "manual" as const,
    name: "Manual / Import",
    description:
      "Optimize products without connecting a store",
  },
];

export default function ConnectPage() {
  const [selected, setSelected] =
    useState<Platform>("shopify");

  const [shop, setShop] = useState("");

  const [message, setMessage] = useState("");

  const [checkoutLoading, setCheckoutLoading] =
    useState(false);

  function cleanShopDomain(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")
      .replace(
        /\.myshopify\.com\.myshopify\.com$/,
        ".myshopify.com"
      );
  }

  function handlePlatformSelect(
    platform: Platform
  ) {
    setSelected(platform);
    setMessage("");

    if (platform !== "shopify") {
      setShop("");
    }
  }

  async function startCheckout() {
    setCheckoutLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.url
      ) {
        throw new Error(
          data.error ||
            "Unable to start subscription checkout."
        );
      }

      window.location.href = data.url;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start subscription checkout."
      );

      setCheckoutLoading(false);
    }
  }

  const cleanShop =
    cleanShopDomain(shop);

  const shopifyDomainIsValid =
    cleanShop.endsWith(
      ".myshopify.com"
    );

  /*
   * IMPORTANT:
   *
   * We are using a REAL anchor/link for Shopify OAuth.
   *
   * This avoids:
   * - window.open()
   * - JavaScript popup behavior
   * - form target behavior
   *
   * The user's tap directly activates the
   * Shopify OAuth URL.
   */
  const shopifyOAuthUrl =
    shopifyDomainIsValid
      ? `/api/auth/shopify?shop=${encodeURIComponent(
          cleanShop
        )}`
      : "#";

  return (
    <main className="app-shell">

      {/* =========================
          TOP BAR
      ========================== */}

      <header className="topbar">

        <div>

          <div className="brand-small">
            VIRELLO AI
          </div>

          <div className="brand-name">
            Virello AI Optimizer
          </div>

        </div>

        <div className="topbar-actions">

          <div className="shop-pill">
            Multi-Platform Ecommerce
          </div>

          <button
            type="button"
            className="subscribe-button"
            onClick={startCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading
              ? "Opening checkout..."
              : "Subscribe to Virello"}
          </button>

        </div>

      </header>

      {/* =========================
          HERO
      ========================== */}

      <section className="hero">

        <div className="hero-inner">

          <div className="eyebrow">
            CONNECT YOUR STORE
          </div>

          <h1>
            Optimize products from
            <span> any store.</span>
          </h1>

          <p>
            Connect your ecommerce platform,
            import your products, optimize them
            with Virello AI, and prepare improved
            listings for your store.
          </p>

        </div>

      </section>

      {/* =========================
          WORKSPACE
      ========================== */}

      <section className="workspace">

        <div className="workspace-grid">

          <section className="optimizer-panel">

            {/* STEP 1 */}

            <div className="selected-product">

              <div>

                <div className="step-label">
                  STEP 1
                </div>

                <h2>
                  Choose your platform
                </h2>

                <p>
                  Select the ecommerce platform
                  where your products are stored.
                </p>

              </div>

            </div>

            {/* MESSAGE */}

            {message && (
              <div className="alert error">
                {message}
              </div>
            )}

            {/* PLATFORM CARD */}

            <div className="content-card">

              <div className="platform-grid">

                {platforms.map(
                  (platform) => {

                    const active =
                      selected ===
                      platform.id;

                    return (
                      <button
                        type="button"
                        key={platform.id}
                        className={
                          active
                            ? "platform-card active"
                            : "platform-card"
                        }
                        onClick={() =>
                          handlePlatformSelect(
                            platform.id
                          )
                        }
                      >

                        <div className="platform-icon">
                          {platform.name.charAt(
                            0
                          )}
                        </div>

                        <div className="platform-info">

                          <strong>
                            {platform.name}
                          </strong>

                          <span>
                            {
                              platform.description
                            }
                          </span>

                        </div>

                        <div className="platform-check">

                          {active
                            ? "✓"
                            : ""}

                        </div>

                      </button>
                    );
                  }
                )}

              </div>

              {/* =========================
                  SHOPIFY CONNECTION
              ========================== */}

              {selected === "shopify" && (

                <div className="shopify-connect-box">

                  <div className="step-label">
                    SHOPIFY STORE
                  </div>

                  <h3>
                    Enter your Shopify store
                  </h3>

                  <p>
                    Use your Shopify domain,
                    for example:
                    mystore.myshopify.com
                  </p>

                  <div className="shop-domain-input">

                    <input
                      type="text"
                      value={shop}
                      onChange={(event) => {
                        setShop(
                          event.target.value
                        );

                        setMessage("");
                      }}
                      placeholder="mystore.myshopify.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="url"
                    />

                  </div>

                  <div className="connect-actions">

                    {shopifyDomainIsValid ? (

                      /*
                       * THIS IS THE IMPORTANT FIX.
                       *
                       * It is a real link, not:
                       * window.open()
                       * window.location
                       * or form submission.
                       *
                       * target="_blank" gives the
                       * Shopify OAuth page its own
                       * browser context.
                       */

                      <a
                        href={shopifyOAuthUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="generate-button oauth-link"
                      >
                        Continue
                      </a>

                    ) : (

                      <button
                        type="button"
                        className="generate-button"
                        disabled
                      >
                        Continue
                      </button>

                    )}

                  </div>

                  <div className="oauth-help">

                    Shopify authorization will
                    open in a separate browser
                    window.

                  </div>

                </div>

              )}

              {/* =========================
                  OTHER PLATFORMS
              ========================== */}

              {selected &&
                selected !== "shopify" &&
                selected !== "manual" && (

                  <div className="connect-actions">

                    <button
                      type="button"
                      className="generate-button"
                      onClick={() => {

                        const platformName =
                          platforms.find(
                            (platform) =>
                              platform.id ===
                              selected
                          )?.name;

                        setMessage(
                          `${platformName} connection is coming next.`
                        );

                      }}
                    >
                      Continue
                    </button>

                  </div>

                )}

              {/* =========================
                  MANUAL IMPORT
              ========================== */}

              {selected === "manual" && (

                <div className="connect-actions">

                  <button
                    type="button"
                    className="generate-button"
                    onClick={() => {
                      window.location.href =
                        "/";
                    }}
                  >
                    Continue
                  </button>

                </div>

              )}

            </div>

            {/* =========================
                WORKFLOW
            ========================== */}

            <div className="content-card">

              <div className="step-label">
                VIRELLO WORKFLOW
              </div>

              <h2>
                From store to optimized listing
              </h2>

              <div className="flow-grid">

                <div className="flow-card">

                  <strong>
                    1. Connect
                  </strong>

                  <p>
                    Connect your ecommerce
                    platform.
                  </p>

                </div>

                <div className="flow-card">

                  <strong>
                    2. Import
                  </strong>

                  <p>
                    Bring product information
                    into Virello.
                  </p>

                </div>

                <div className="flow-card">

                  <strong>
                    3. Optimize
                  </strong>

                  <p>
                    Generate improved product
                    content with AI.
                  </p>

                </div>

                <div className="flow-card">

                  <strong>
                    4. Apply
                  </strong>

                  <p>
                    Send approved content back
                    to the store.
                  </p>

                </div>

              </div>

            </div>

          </section>

        </div>

      </section>

      {/* =========================
          MOBILE / LOCAL STYLES
      ========================== */}

      <style jsx>{`

        .topbar-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .subscribe-button {
          min-height: 40px;
          padding: 0 16px;

          border: 0;
          border-radius: 10px;

          background: #111318;
          color: #ffffff;

          font-size: 12px;
          font-weight: 850;

          cursor: pointer;

          white-space: nowrap;

          box-shadow:
            0 7px 16px
            rgba(17, 19, 24, 0.15);
        }

        .subscribe-button:hover {
          background: #292d34;
        }

        .subscribe-button:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .oauth-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          min-width: 150px;

          text-decoration: none;
        }

        .oauth-help {
          margin-top: 10px;

          color: #8a9098;

          font-size: 10px;
          line-height: 1.5;
          text-align: center;
        }

        @media (max-width: 700px) {

          .topbar {
            min-height: 82px;
            padding: 10px 16px;
          }

          .topbar-actions {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }

          .shop-pill {
            max-width: 150px;
            align-self: flex-end;

            padding: 6px 9px;

            font-size: 9px;
          }

          .subscribe-button {
            min-height: 36px;
            padding: 0 11px;

            font-size: 11px;
          }

        }

      `}</style>

    </main>
  );
}
