"use client";

import { useEffect, useState } from "react";

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
    description: "Optimize products without connecting a store",
  },
];

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

export default function ConnectPage() {
  const [selected, setSelected] =
    useState<Platform>("shopify");

  const [shop, setShop] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutLoading, setCheckoutLoading] =
    useState(false);

  const [connected, setConnected] =
    useState(false);

  const [connectedShop, setConnectedShop] =
    useState("");

  /*
   * ==================================================
   * READ SHOPIFY CONNECTION RESULT
   * ==================================================
   */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const connectedParam =
      params.get("connected");

    const shopParam =
      params.get("shop") || "";

    if (
      connectedParam === "1" &&
      shopParam
    ) {
      setConnected(true);
      setConnectedShop(shopParam);
      setShop(shopParam);
      setSelected("shopify");

      /*
       * Remove OAuth query parameters
       * from the visible URL.
       *
       * This does NOT reload the page.
       */
      window.history.replaceState(
        {},
        "",
        "/connect"
      );
    }
  }, []);

  /*
   * ==================================================
   * PLATFORM SELECT
   * ==================================================
   */

  function handlePlatformSelect(
    platform: Platform
  ) {
    setSelected(platform);
    setMessage("");

    if (platform !== "shopify") {
      setShop("");
    }
  }

  /*
   * ==================================================
   * STRIPE SUBSCRIPTION CHECKOUT
   * ==================================================
   */

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

      const data =
        await response.json();

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

      window.location.href =
        data.url;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to start subscription checkout."
      );

      setCheckoutLoading(false);
    }
  }

  /*
   * ==================================================
   * SHOPIFY DOMAIN
   * ==================================================
   */

  const cleanShop =
    cleanShopDomain(shop);

  const shopifyDomainIsValid =
    cleanShop.endsWith(
      ".myshopify.com"
    );

  const shopifyOAuthUrl =
    shopifyDomainIsValid
      ? `/api/auth/shopify?shop=${encodeURIComponent(
          cleanShop
        )}`
      : "#";

  /*
   * ==================================================
   * SUCCESSFUL SHOPIFY CONNECTION SCREEN
   * ==================================================
   */

  if (connected) {
    return (
      <main className="app-shell">

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

        <section className="hero">

          <div className="hero-inner">

            <div className="eyebrow">
              SHOPIFY CONNECTED
            </div>

            <h1>
              Your store is
              <span> connected.</span>
            </h1>

            <p>
              Virello AI Optimizer is now
              connected to your Shopify store.
              You can continue to your Virello
              workspace.
            </p>

          </div>

        </section>

        <section className="workspace">

          <div className="workspace-grid">

            <section className="optimizer-panel">

              <div className="content-card success-card">

                <div className="success-icon">
                  ✓
                </div>

                <div className="step-label">
                  CONNECTION COMPLETE
                </div>

                <h2>
                  Shopify connected successfully
                </h2>

                <p>
                  Your Shopify store is now
                  connected to Virello AI Optimizer.
                </p>

                <div className="connected-store">

                  <span>
                    Connected store
                  </span>

                  <strong>
                    {connectedShop}
                  </strong>

                </div>

                <div className="connect-actions">

                  <button
                    type="button"
                    className="generate-button"
                    onClick={() => {

                      /*
                       * IMPORTANT FIX
                       *
                       * Use the TOP browser window.
                       * Do NOT use window.location.href="/".
                       *
                       * This prevents the Shopify embedded
                       * browser context from navigating back
                       * into the OAuth callback.
                       */

                      const targetUrl =
                        `${window.location.origin}/?platform=shopify&connected=1`;

                      if (
                        window.top &&
                        window.top !== window.self
                      ) {
                        window.top.location.replace(
                          targetUrl
                        );
                      } else {
                        window.location.replace(
                          targetUrl
                        );
                      }

                    }}
                  >
                    Continue to Virello
                  </button>

                </div>

              </div>

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
                      Your Shopify store is
                      connected.
                    </p>
                  </div>

                  <div className="flow-card">
                    <strong>
                      2. Import
                    </strong>

                    <p>
                      Bring your product
                      information into Virello.
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
                      to your store.
                    </p>
                  </div>

                </div>

              </div>

            </section>

          </div>

        </section>

        <style jsx>{`

          * {
            box-sizing: border-box;
          }

          .app-shell {
            min-height: 100vh;
            background: #f4f5f7;
            color: #111318;
          }

          .topbar {
            min-height: 92px;
            padding: 18px 28px;
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;

            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }

          .brand-small {
            color: #969ba3;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.16em;
          }

          .brand-name {
            margin-top: 5px;
            font-size: 20px;
            font-weight: 850;
          }

          .topbar-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
          }

          .shop-pill {
            padding: 10px 15px;
            border: 1px solid #e0e3e7;
            border-radius: 999px;
            background: #ffffff;
            color: #6f757d;
            font-size: 11px;
            font-weight: 750;
            white-space: nowrap;
          }

          .subscribe-button {
            min-height: 42px;
            padding: 0 17px;
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

          .hero {
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
          }

          .hero-inner {
            max-width: 1100px;
            margin: 0 auto;
            padding: 70px 28px 65px;
          }

          .eyebrow,
          .step-label {
            color: #8c929a;
            font-size: 10px;
            font-weight: 850;
            letter-spacing: 0.16em;
          }

          .hero h1 {
            max-width: 850px;
            margin: 18px 0 18px;
            font-size: clamp(42px, 7vw, 76px);
            line-height: 0.98;
            letter-spacing: -0.055em;
            font-weight: 900;
          }

          .hero h1 span {
            color: #949aa2;
          }

          .hero p {
            max-width: 760px;
            margin: 0;
            color: #727880;
            font-size: 18px;
            line-height: 1.65;
          }

          .workspace {
            padding: 28px;
          }

          .workspace-grid {
            max-width: 1100px;
            margin: 0 auto;
          }

          .optimizer-panel {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .content-card {
            padding: 32px;
            border: 1px solid #e0e3e7;
            border-radius: 22px;
            background: #ffffff;
            box-shadow:
              0 12px 30px
              rgba(17, 19, 24, 0.04);
          }

          .success-card {
            text-align: center;
          }

          .success-icon {
            width: 66px;
            height: 66px;
            margin: 0 auto 22px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            background: #111318;
            color: #ffffff;

            font-size: 30px;
            font-weight: 900;
          }

          .success-card h2 {
            margin: 12px 0 10px;
            font-size: 28px;
            letter-spacing: -0.03em;
          }

          .success-card > p {
            color: #747a82;
            line-height: 1.6;
          }

          .connected-store {
            margin: 24px auto;
            padding: 18px 20px;
            max-width: 480px;

            border: 1px solid #e2e4e8;
            border-radius: 14px;

            background: #f8f9fa;

            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .connected-store span {
            color: #8a9098;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .connected-store strong {
            color: #111318;
            font-size: 16px;
            word-break: break-word;
          }

          .connect-actions {
            display: flex;
            justify-content: center;
            margin-top: 22px;
          }

          .generate-button {
            min-height: 48px;
            padding: 0 24px;
            border: 0;
            border-radius: 11px;
            background: #111318;
            color: #ffffff;
            font-size: 14px;
            font-weight: 850;
            cursor: pointer;
            text-decoration: none;
          }

          .generate-button:hover {
            background: #292d34;
          }

          .content-card h2 {
            margin: 12px 0 24px;
            font-size: 30px;
            letter-spacing: -0.035em;
          }

          .flow-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .flow-card {
            padding: 20px;
            border: 1px solid #e2e4e8;
            border-radius: 16px;
            background: #fafbfc;
          }

          .flow-card strong {
            display: block;
            font-size: 14px;
          }

          .flow-card p {
            margin: 10px 0 0;
            color: #777d85;
            font-size: 13px;
            line-height: 1.5;
          }

          @media (max-width: 700px) {

            .topbar {
              min-height: 88px;
              padding: 12px 16px;
            }

            .brand-name {
              font-size: 16px;
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
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .subscribe-button {
              min-height: 36px;
              padding: 0 11px;
              font-size: 11px;
            }

            .hero-inner {
              padding: 45px 22px 42px;
            }

            .hero h1 {
              font-size: 47px;
            }

            .hero p {
              font-size: 16px;
            }

            .workspace {
              padding: 16px;
            }

            .content-card {
              padding: 22px;
              border-radius: 18px;
            }

            .flow-grid {
              grid-template-columns: 1fr;
            }

          }

        `}</style>

      </main>
    );
  }

  /*
   * ==================================================
   * NORMAL CONNECT SCREEN
   * ==================================================
   */

  return (
    <main className="app-shell">

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

      <section className="workspace">

        <div className="workspace-grid">

          <section className="optimizer-panel">

            <div className="content-card">

              <div className="step-label">
                STEP 1
              </div>

              <h2>
                Choose your platform
              </h2>

              <p className="section-description">
                Select the ecommerce platform
                where your products are stored.
              </p>

              {message && (
                <div className="alert error">
                  {message}
                </div>
              )}

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
                  }
                )}

              </div>

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

              {selected === "manual" && (

                <div className="connect-actions">

                  <button
                    type="button"
                    className="generate-button"
                    onClick={() => {

                      if (
                        window.top &&
                        window.top !== window.self
                      ) {
                        window.top.location.replace(
                          "/"
                        );
                      } else {
                        window.location.replace(
                          "/"
                        );
                      }

                    }}
                  >
                    Continue
                  </button>

                </div>

              )}

            </div>

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
                    Bring your product
                    information into Virello.
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
                    to your store.
                  </p>

                </div>

              </div>

            </div>

          </section>

        </div>

      </section>

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .app-shell {
          min-height: 100vh;
          background: #f4f5f7;
          color: #111318;
        }

        .topbar {
          min-height: 92px;
          padding: 18px 28px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;

          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .brand-small {
          color: #969ba3;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .brand-name {
          margin-top: 5px;
          font-size: 20px;
          font-weight: 850;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .shop-pill {
          padding: 10px 15px;
          border: 1px solid #e0e3e7;
          border-radius: 999px;
          background: #ffffff;
          color: #6f757d;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
        }

        .subscribe-button {
          min-height: 42px;
          padding: 0 17px;
          border: 0;
          border-radius: 10px;
          background: #111318;
          color: #ffffff;
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
        }

        .subscribe-button:hover {
          background: #292d34;
        }

        .subscribe-button:disabled {
          opacity: 0.55;
          cursor: wait;
        }

        .hero {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
        }

        .hero-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 70px 28px 65px;
        }

        .eyebrow,
        .step-label {
          color: #8c929a;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.16em;
        }

        .hero h1 {
          max-width: 850px;
          margin: 18px 0;
          font-size: clamp(42px, 7vw, 76px);
          line-height: 0.98;
          letter-spacing: -0.055em;
          font-weight: 900;
        }

        .hero h1 span {
          color: #949aa2;
        }

        .hero p {
          max-width: 760px;
          margin: 0;
          color: #727880;
          font-size: 18px;
          line-height: 1.65;
        }

        .workspace {
          padding: 28px;
        }

        .workspace-grid {
          max-width: 1100px;
          margin: 0 auto;
        }

        .optimizer-panel {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .content-card {
          padding: 32px;
          border: 1px solid #e0e3e7;
          border-radius: 22px;
          background: #ffffff;
          box-shadow:
            0 12px 30px
            rgba(17, 19, 24, 0.04);
        }

        .content-card h2 {
          margin: 12px 0 8px;
          font-size: 30px;
          letter-spacing: -0.035em;
        }

        .section-description {
          margin: 0 0 24px;
          color: #777d85;
          line-height: 1.5;
        }

        .platform-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .platform-card {
          min-height: 100px;
          padding: 16px;

          display: flex;
          align-items: center;
          gap: 15px;

          border: 1px solid #e0e3e7;
          border-radius: 16px;

          background: #ffffff;
          color: #111318;

          text-align: left;
          cursor: pointer;
        }

        .platform-card.active {
          border-color: #aeb3ba;
          box-shadow:
            0 0 0 1px #111318;
        }

        .platform-icon {
          width: 56px;
          height: 56px;
          flex: 0 0 56px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 14px;
          background: #f0f2f4;

          font-size: 22px;
          font-weight: 850;
        }

        .platform-info {
          min-width: 0;
          flex: 1;
        }

        .platform-info strong {
          display: block;
          font-size: 16px;
          margin-bottom: 5px;
        }

        .platform-info span {
          display: block;
          color: #858b93;
          font-size: 12px;
          line-height: 1.4;
        }

        .platform-check {
          width: 44px;
          height: 44px;
          flex: 0 0 44px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 2px solid #d9dce0;
          border-radius: 50%;

          font-size: 20px;
          font-weight: 900;
        }

        .platform-card.active .platform-check {
          background: #111318;
          border-color: #111318;
          color: #ffffff;
        }

        .shopify-connect-box {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
        }

        .shopify-connect-box h3 {
          margin: 12px 0 8px;
          font-size: 26px;
          letter-spacing: -0.03em;
        }

        .shopify-connect-box p {
          color: #727880;
          line-height: 1.55;
        }

        .shop-domain-input input {
          width: 100%;
          min-height: 52px;
          margin-top: 8px;

          padding: 0 16px;

          border: 1px solid #cfd3d8;
          border-radius: 12px;

          background: #ffffff;
          color: #111318;

          font-size: 15px;
          outline: none;
        }

        .shop-domain-input input:focus {
          border-color: #111318;
          box-shadow:
            0 0 0 3px
            rgba(17, 19, 24, 0.08);
        }

        .connect-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 18px;
        }

        .generate-button {
          min-height: 48px;
          padding: 0 24px;

          border: 0;
          border-radius: 11px;

          background: #111318;
          color: #ffffff;

          font-size: 14px;
          font-weight: 850;

          cursor: pointer;
          text-decoration: none;
        }

        .generate-button:hover {
          background: #292d34;
        }

        .generate-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .oauth-help {
          margin-top: 12px;
          color: #8a9098;
          font-size: 12px;
          text-align: right;
        }

        .alert {
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 13px;
        }

        .alert.error {
          background: #fff1f1;
          border: 1px solid #f0caca;
          color: #9d3030;
        }

        .flow-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .flow-card {
          padding: 20px;
          border: 1px solid #e2e4e8;
          border-radius: 16px;
          background: #fafbfc;
        }

        .flow-card strong {
          display: block;
          font-size: 14px;
        }

        .flow-card p {
          margin: 10px 0 0;
          color: #777d85;
          font-size: 13px;
          line-height: 1.5;
        }

        @media (max-width: 700px) {

          .topbar {
            min-height: 88px;
            padding: 12px 16px;
          }

          .brand-name {
            font-size: 16px;
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
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .subscribe-button {
            min-height: 36px;
            padding: 0 11px;
            font-size: 11px;
          }

          .hero-inner {
            padding: 45px 22px 42px;
          }

          .hero h1 {
            font-size: 47px;
          }

          .hero p {
            font-size: 16px;
          }

          .workspace {
            padding: 16px;
          }

          .content-card {
            padding: 22px;
            border-radius: 18px;
          }

          .platform-grid,
          .flow-grid {
            grid-template-columns: 1fr;
          }

          .connect-actions {
            justify-content: stretch;
          }

          .generate-button {
            width: 100%;
          }

          .oauth-help {
            text-align: center;
          }

        }

      `}</style>

    </main>
  );
}
