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

  const [message, setMessage] = useState("");

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

    const platformName =
      platforms.find(
        (platform) =>
          platform.id === selected
      )?.name;

    setMessage(
      `${platformName} selected. The secure connection step will be added next.`
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
                        onClick={() => {
                          setSelected(
                            platform.id
                          );
                          setMessage("");
                        }}
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
