"use client";

import { FormEvent, useState } from "react";

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

      /*
       * Open Stripe checkout in the
       * top-level browser window.
       */
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

  function handleContinue(
    event: FormEvent<HTMLFormElement>
  ) {
    /*
     * The Shopify form below handles the
     * actual OAuth navigation.
     *
     * This function is only used for
     * non-Shopify platforms and validation.
     */

    if (!selected) {
      event.preventDefault();

      setMessage(
        "Please choose a platform first."
      );

      return;
    }

    if (selected === "manual") {
      event.preventDefault();

      window.location.href = "/";

      return;
    }

    if (selected !== "shopify") {
      event.preventDefault();

      const platformName =
        platforms.find(
          (platform) =>
            platform.id === selected
        )?.name;

      setMessage(
        `${platformName} connection is coming next.`
      );

      return;
    }

    const cleanShop =
      cleanShopDomain(shop);

    if (!cleanShop) {
      event.preventDefault();

      setMessage(
        "Enter your Shopify store domain first."
      );

      return;
    }

    if (
      !cleanShop.endsWith(
        ".myshopify.com"
      )
    ) {
      event.preventDefault();

      setMessage(
        "Enter your Shopify domain like mystore.myshopify.com."
      );

      return;
    }

    /*
     * IMPORTANT:
     *
     * DO NOT preventDefault here.
     *
     * The browser will submit the form directly
     * to /api/auth/shopify.
     *
     * target="_top" forces the OAuth request
     * into the top-level browser context.
     */
  }

  const cleanShop =
    cleanShopDomain(shop);

  const shopifyDomainIsValid =
    cleanShop.endsWith(
      ".myshopify.com"
    );

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

            {/* ERROR / MESSAGE */}

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

              {/* SHOPIFY */}

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

                  {/*

                    IMPORTANT FIX

                    This is now a real HTML form.

                    The browser performs the navigation
                    directly after the user presses
                    Continue.

                    This avoids window.open()
                    and avoids relying on JavaScript
                    frame navigation.

                  */}

                  <form
                    action="/api/auth/shopify"
                    method="GET"
                    target="_top"
                    onSubmit={
                      handleContinue
                    }
                  >

                    <div className="shop-domain-input">

                      <input
                        type="text"
                        name="shop"
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
                      />

                    </div>

                    <div className="connect-actions">

                      <button
                        type="submit"
                        className="generate-button"
                        disabled={
                          !shopifyDomainIsValid
                        }
                      >
                        Continue
                      </button>

                    </div>

                  </form>

                </div>

              )}

              {/* NON-SHOPIFY CONTINUE */}

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

              {/* MANUAL */}

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
