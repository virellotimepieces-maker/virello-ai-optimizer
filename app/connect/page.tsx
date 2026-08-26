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
      setConnectedShop(
        cleanShopDomain(shopParam)
      );
      setShop(
        cleanShopDomain(shopParam)
      );
      setSelected("shopify");

      window.history.replaceState(
        {},
        "",
        "/connect"
      );
    }
  }, []);

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

  const cleanShop =
    cleanShopDomain(shop);

  const shopifyDomainIsValid =
    /^([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9])\.myshopify\.com$/i.test(
      cleanShop
    );

  const shopifyOAuthUrl =
    shopifyDomainIsValid
      ? `/api/auth/shopify?shop=${encodeURIComponent(
          cleanShop
        )}`
      : "#";

  function continueToVirello() {
    const targetUrl =
      `${window.location.origin}/?platform=shopify&connected=1`;

    try {
      if (
        window.top &&
        window.top !== window.self
      ) {
        window.top.location.href =
          targetUrl;
        return;
      }
    } catch {
      // Fallback below.
    }

    window.location.href =
      targetUrl;
  }

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
                    onClick={continueToVirello}
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

            font-size:
              clamp(42px, 7vw, 76px);

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
            color: #111318;
            font-size: 14px;
            font-weight: 800;
          }

          .flow-card p {
            margin: 8px 0 0;

            color: #747a82;

            font-size: 13px;
            line-height: 1.55;
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

            .hero-inner {
              padding: 48px 20px 44px;
            }

            .hero h1 {
              font-size: 48px;
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

            .success-card h2 {
              font-size: 24px;
            }

          }

        `}</style>

      </main>
    );
  }

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

            </div>

            {message && (
              <div className="alert">
                {message}
              </div>
            )}

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
                    <br />
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
                    open in this browser.
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
                      window.location.href =
                        "/";
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

          font-size:
            clamp(42px, 7vw, 76px);

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

        .section-description {
          margin: -12px 0 0;
          color: #747a82;
          line-height: 1.6;
        }

        .alert {
          padding: 14px 16px;
          border: 1px solid #e4b4b4;
          border-radius: 12px;
          background: #fff5f5;
          color: #a33a3a;
          font-size: 13px;
          line-height: 1.5;
        }

        .platform-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .platform-card {
          width: 100%;
          min-height: 108px;
          padding: 18px 20px;

          display: flex;
          align-items: center;
          gap: 18px;

          border: 1px solid #e0e3e7;
          border-radius: 18px;

          background: #ffffff;
          color: #111318;

          text-align: left;
          cursor: pointer;

          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .platform-card:hover {
          background: #fafbfc;
          border-color: #cfd3d8;
        }

        .platform-card.active {
          border-color: #b8bdc4;

          box-shadow:
            0 6px 18px
            rgba(17, 19, 24, 0.05);
        }

        .platform-icon {
          width: 58px;
          height: 58px;

          flex: 0 0 58px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 15px;

          background: #f1f2f4;

          font-size: 24px;
          font-weight: 900;
        }

        .platform-info {
          flex: 1;

          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .platform-info strong {
          font-size: 17px;
          font-weight: 850;
        }

        .platform-info span {
          color: #7b8189;
          font-size: 13px;
        }

        .platform-check {
          width: 42px;
          height: 42px;

          flex: 0 0 42px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 2px solid #d7d9dd;
          border-radius: 50%;

          font-size: 18px;
          font-weight: 900;
        }

        .platform-card.active
        .platform-check {
          border-color: #111318;
          background: #111318;
          color: #ffffff;
        }

        .shopify-connect-box {
          margin-top: 22px;
          padding-top: 26px;

          border-top: 1px solid #e8e9eb;
        }

        .shopify-connect-box h3 {
          margin: 12px 0 10px;

          font-size: 30px;
          letter-spacing: -0.035em;
        }

        .shopify-connect-box p {
          color: #747a82;
          line-height: 1.6;
        }

        .shop-domain-input {
          margin-top: 18px;
        }

        .shop-domain-input input {
          width: 100%;
          min-height: 54px;

          padding: 0 16px;

          border: 1px solid #d9dce1;
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
        }

        .generate-button:hover {
          background: #292d34;
        }

        .generate-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .oauth-link {
          min-width: 150px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          text-decoration: none;
        }

        .oauth-help {
          margin-top: 10px;

          color: #8a9098;

          font-size: 10px;
          line-height: 1.5;
          text-align: center;
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
          color: #111318;
          font-size: 14px;
          font-weight: 800;
        }

        .flow-card p {
          margin: 8px 0 0;

          color: #747a82;

          font-size: 13px;
          line-height: 1.55;
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

          .hero-inner {
            padding: 48px 20px 44px;
          }

          .hero h1 {
            font-size: 48px;
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

          .platform-card {
            min-height: 92px;
            padding: 14px;
            gap: 12px;
          }

          .platform-icon {
            width: 48px;
            height: 48px;
            flex-basis: 48px;
          }

          .platform-info strong {
            font-size: 15px;
          }

          .platform-info span {
            font-size: 12px;
          }

          .platform-check {
            width: 36px;
            height: 36px;
            flex-basis: 36px;
          }

          .shopify-connect-box h3 {
            font-size: 25px;
          }

          .flow-grid {
            grid-template-columns: 1fr;
          }

          .success-card h2 {
            font-size: 24px;
          }

        }

      `}</style>

    </main>
  );
}
