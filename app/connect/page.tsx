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
      /(\.myshopify\.com){2,}$/,
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

    const statusParam =
      params.get("status");

    const errorParam =
      params.get("error_description") ||
      params.get("error");

    if (shopParam) {
      const cleanedShop =
        cleanShopDomain(shopParam);

      setShop(cleanedShop);
      setSelected("shopify");
    }

    if (
      connectedParam === "1" &&
      shopParam
    ) {
      const cleanedShop =
        cleanShopDomain(shopParam);

      setConnected(true);
      setConnectedShop(cleanedShop);
      setShop(cleanedShop);
      setSelected("shopify");

      window.history.replaceState(
        {},
        "",
        "/connect"
      );
    }

    if (
      statusParam === "error" &&
      errorParam
    ) {
      setMessage(errorParam);
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
      : "";

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

              <section className="content-card success-card">

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

                  <a
                    href={`/?platform=shopify&connected=1`}
                    target="_top"
                    rel="noopener noreferrer"
                    className="generate-button oauth-link"
                  >
                    Continue to Virello
                  </a>

                </div>

              </section>

              <section className="content-card">

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

              </section>

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

          .content-card h2 {
            margin: 12px 0 10px;

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

            color: #111318;

            font-size: 15px;
            font-weight: 850;
          }

          .flow-card p {
            margin: 9px 0 0;

            color: #7a8088;

            font-size: 13px;
            line-height: 1.55;
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

          .oauth-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
          }

          @media (max-width: 760px) {

            .topbar {
              padding: 16px;
              align-items: flex-start;
            }

            .topbar-actions {
              flex-direction: column;
              align-items: flex-end;
            }

            .shop-pill {
              display: none;
            }

            .brand-name {
              font-size: 17px;
            }

            .hero-inner {
              padding: 52px 20px 48px;
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

            <section className="content-card">

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

              <div className="platform-list">

                {platforms.map((platform) => {

                  const isSelected =
                    selected === platform.id;

                  return (
                    <button
                      key={platform.id}
                      type="button"
                      className={
                        isSelected
                          ? "platform-card selected"
                          : "platform-card"
                      }
                      onClick={() =>
                        handlePlatformSelect(
                          platform.id
                        )
                      }
                    >

                      <div className="platform-icon">
                        {platform.id ===
                        "shopify"
                          ? "S"
                          : platform.id ===
                            "woocommerce"
                          ? "W"
                          : platform.id ===
                            "bigcommerce"
                          ? "B"
                          : platform.id ===
                            "wix"
                          ? "W"
                          : "M"}
                      </div>

                      <div className="platform-info">

                        <strong>
                          {platform.name}
                        </strong>

                        <span>
                          {platform.description}
                        </span>

                      </div>

                      <div
                        className={
                          isSelected
                            ? "radio selected-radio"
                            : "radio"
                        }
                      >
                        {isSelected
                          ? "✓"
                          : ""}
                      </div>

                    </button>
                  );

                })}

              </div>

            </section>

            {selected === "shopify" && (
              <section className="content-card">

                <div className="step-label">
                  SHOPIFY STORE
                </div>

                <h2>
                  Enter your Shopify store
                </h2>

                <p className="section-description">
                  Use your Shopify domain, for
                  example:
                  <br />
                  <strong>
                    mystore.myshopify.com
                  </strong>
                </p>

                <div className="form-group">

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
                    autoComplete="off"
                    spellCheck={false}
                  />

                  {shopifyDomainIsValid ? (

                    <a
                      href={shopifyOAuthUrl}
                      target="_top"
                      rel="noopener noreferrer"
                      className="generate-button continue-button oauth-link"
                    >
                      Continue
                    </a>

                  ) : (

                    <button
                      type="button"
                      className="generate-button continue-button"
                      disabled
                    >
                      Continue
                    </button>

                  )}

                </div>

                {message && (
                  <div className="message">
                    {message}
                  </div>
                )}

                <p className="oauth-note">
                  Shopify authorization will open
                  in the main browser window.
                </p>

              </section>
            )}

            {selected !== "shopify" && (
              <section className="content-card">

                <div className="step-label">
                  VIRELLO
                </div>

                <h2>
                  {selected === "manual"
                    ? "Manual / Import"
                    : `Connect ${
                        platforms.find(
                          (item) =>
                            item.id === selected
                        )?.name ||
                        "platform"
                      }`}
                </h2>

                <p className="section-description">
                  This platform connection will
                  be available in your Virello
                  workspace.
                </p>

              </section>
            )}

            <section className="content-card">

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

            </section>

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

        .content-card h2 {
          margin: 12px 0 10px;

          font-size: 30px;
          letter-spacing: -0.035em;
        }

        .section-description {
          margin: 0 0 24px;

          color: #7a8088;

          font-size: 16px;
          line-height: 1.6;
        }

        .section-description strong {
          color: #111318;
        }

        .platform-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .platform-card {
          width: 100%;
          min-height: 108px;

          padding: 18px 20px;

          border: 1px solid #e0e3e7;
          border-radius: 18px;

          background: #ffffff;

          display: flex;
          align-items: center;
          gap: 20px;

          text-align: left;

          cursor: pointer;

          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .platform-card:hover {
          border-color: #bfc4ca;
        }

        .platform-card.selected {
          border-color: #aeb4bb;

          box-shadow:
            0 8px 20px
            rgba(17, 19, 24, 0.06);
        }

        .platform-icon {
          width: 56px;
          height: 56px;

          flex: 0 0 56px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 15px;

          background: #f1f2f4;

          color: #111318;

          font-size: 24px;
          font-weight: 900;
        }

        .platform-info {
          flex: 1;

          min-width: 0;

          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .platform-info strong {
          color: #111318;
          font-size: 18px;
          font-weight: 850;
        }

        .platform-info span {
          color: #858b93;
          font-size: 14px;
        }

        .radio {
          width: 32px;
          height: 32px;

          flex: 0 0 32px;

          border: 2px solid #d5d8dc;
          border-radius: 50%;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #ffffff;

          font-size: 16px;
          font-weight: 900;
        }

        .selected-radio {
          border-color: #111318;
          background: #111318;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group input {
          width: 100%;

          min-height: 56px;

          padding: 0 18px;

          border: 1px solid #d9dce0;
          border-radius: 12px;

          background: #ffffff;

          color: #111318;

          font-size: 16px;

          outline: none;
        }

        .form-group input:focus {
          border-color: #111318;

          box-shadow:
            0 0 0 3px
            rgba(17, 19, 24, 0.08);
        }

        .form-group input::placeholder {
          color: #9ca1a8;
        }

        .continue-button {
          width: 100%;
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
          opacity: 0.45;
          cursor: not-allowed;
        }

        .oauth-link {
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }

        .oauth-note {
          margin: 14px 0 0;

          color: #92979e;

          font-size: 12px;
          line-height: 1.5;

          text-align: center;
        }

        .message {
          margin-top: 16px;

          padding: 14px 16px;

          border: 1px solid #e1e4e8;
          border-radius: 12px;

          background: #f8f9fa;

          color: #555b63;

          font-size: 13px;
          line-height: 1.5;
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

          color: #111318;

          font-size: 15px;
          font-weight: 850;
        }

        .flow-card p {
          margin: 9px 0 0;

          color: #7a8088;

          font-size: 13px;
          line-height: 1.55;
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

        @media (max-width: 760px) {

          .topbar {
            padding: 16px;
            align-items: flex-start;
          }

          .topbar-actions {
            flex-direction: column;
            align-items: flex-end;
          }

          .shop-pill {
            display: none;
          }

          .brand-name {
            font-size: 17px;
          }

          .hero-inner {
            padding: 52px 20px 48px;
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

          .content-card h2 {
            font-size: 26px;
          }

          .platform-card {
            min-height: 92px;
            padding: 15px;
            gap: 14px;
          }

          .platform-icon {
            width: 50px;
            height: 50px;
            flex-basis: 50px;
          }

          .platform-info strong {
            font-size: 16px;
          }

          .platform-info span {
            font-size: 12px;
          }

          .flow-grid {
            grid-template-columns: 1fr;
          }

        }

      `}</style>

    </main>
  );
}
