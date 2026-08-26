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
    useState<Platform>(null);

  const [shop, setShop] = useState("");

  const [message, setMessage] = useState("");

  function cleanShopDomain(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "")
      .replace(/\.myshopify\.com\.myshopify\.com$/, ".myshopify.com");
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

  function handleContinue() {
    setMessage("");

    if (!selected) {
      setMessage(
        "Please choose a platform first."
      );
      return;
    }

    if (selected === "manual") {
      window.location.href = "/";
      return;
    }

    if (selected === "shopify") {
      const cleanShop = cleanShopDomain(shop);

      if (!cleanShop) {
        setMessage(
          "Enter your Shopify store domain first."
        );
        return;
      }

      if (
        !cleanShop.endsWith(".myshopify.com")
      ) {
        setMessage(
          "Enter your Shopify domain like mystore.myshopify.com."
        );
        return;
      }

      window.location.href =
        `/api/auth/shopify?shop=${encodeURIComponent(
          cleanShop
        )}`;

      return;
    }

    const platformName =
      platforms.find(
        (platform) =>
          platform.id === selected
      )?.name;

    setMessage(
      `${platformName} connection is coming next.`
    );
  }

  return (
    <main className="app-shell">

      {/* TOP BAR */}
      <header className="topbar">
        <div>
          <div className="brand-small">
            VIRELLO AI
          </div>

          <div className="brand-name">
            Virello AI Optimizer
          </div>
        </div>

        <div className="shop-pill">
          Multi-Platform Ecommerce
        </div>
      </header>

      {/* HERO */}
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

      {/* WORKSPACE */}
      <section className="workspace">

        <div className="workspace-grid">

          <section className="optimizer-panel">

            {/* HEADER */}
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

              {/* SHOPIFY STORE DOMAIN */}
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
                      onChange={(event) =>
                        setShop(
                          event.target.value
                        )
                      }
                      placeholder="mystore.myshopify.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          handleContinue();
                        }
                      }}
                    />

                  </div>

                </div>
              )}

              {/* CONTINUE */}
              <div className="connect-actions">

                <button
                  type="button"
                  className="generate-button"
                  onClick={
                    handleContinue
                  }
                >
                  Continue
                </button>

              </div>

            </div>

            {/* WORKFLOW */}
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

    </main>
  );
}
