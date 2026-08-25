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
    description: "Optimize products without a store connection",
  },
];

export default function ConnectStorePage() {
  const [selected, setSelected] = useState<Platform>(null);
  const [message, setMessage] = useState("");

  function continueSetup() {
    if (!selected) {
      setMessage("Choose a platform first.");
      return;
    }

    if (selected === "manual") {
      window.location.href = "/";
      return;
    }

    setMessage(
      `${platforms.find((item) => item.id === selected)?.name} connection will be configured here.`
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-small">VIRELLO AI</div>

          <div className="brand-name">
            Virello AI Optimizer
          </div>
        </div>

        <div className="shop-pill">
          Multi-Platform Ecommerce
        </div>
      </header>

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
            Connect your ecommerce platform to import
            products into Virello, optimize them with AI,
            and apply the improved content back to your store.
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid">
          <section className="optimizer-panel">
            <div className="selected-product">
              <div>
                <div className="step-label">
                  STEP 1
                </div>

                <h2>
                  Choose your platform
                </h2>

                <p>
                  Select where your products are currently
                  stored.
                </p>
              </div>
            </div>

            {message && (
              <div className="alert error">
                {message}
              </div>
            )}

            <div className="content-card">
              <div className="platform-grid">
                {platforms.map((platform) => {
                  const active =
                    selected === platform.id;

                  return (
                    <button
                      type="button"
                      key={platform.id}
                      onClick={() => {
                        setSelected(platform.id);
                        setMessage("");
                      }}
                      className={
                        active
                          ? "platform-card active"
                          : "platform-card"
                      }
                    >
                      <div className="platform-icon">
                        {platform.name.charAt(0)}
                      </div>

                      <div className="platform-info">
                        <strong>
                          {platform.name}
                        </strong>

                        <span>
                          {platform.description}
                        </span>
                      </div>

                      <div className="platform-check">
                        {active ? "✓" : ""}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="connect-actions">
                <button
                  type="button"
                  className="generate-button"
                  onClick={continueSetup}
                >
                  Continue
                </button>
              </div>
            </div>

            <div className="content-card">
              <div className="step-label">
                HOW VIRELLO WORKS
              </div>

              <div className="flow-grid">
                <div className="flow-card">
                  <strong>1. Connect</strong>
                  <p>
                    Connect your ecommerce platform.
                  </p>
                </div>

                <div className="flow-card">
                  <strong>2. Import</strong>
                  <p>
                    Bring your products into Virello.
                  </p>
                </div>

                <div className="flow-card">
                  <strong>3. Optimize</strong>
                  <p>
                    Let Virello AI improve your listings.
                  </p>
                </div>

                <div className="flow-card">
                  <strong>4. Apply</strong>
                  <p>
                    Send optimized content back to your store.
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
