"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = {
  success?: boolean;
  connected?: boolean;
  platform?: string;
  shop?: string;
  error?: string;
};

export default function ConnectPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] =
    useState<ConnectionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    checkShopifyConnection();
  }, []);

  async function checkShopifyConnection() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/shopify/status",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      console.log(
        "SHOPIFY_STATUS_RESPONSE:",
        data
      );

      /*
       * IMPORTANT:
       * Do not assume that the API only returns
       * { connected: true }.
       *
       * Some successful Shopify status responses
       * can contain success/shop information.
       */
      const isConnected =
        data?.connected === true ||
        (
          data?.success === true &&
          !!data?.shop
        );

      if (!response.ok) {
        setStatus({
          connected: false,
          platform: "shopify",
          error:
            data?.error ||
            "Unable to check Shopify connection.",
        });

        return;
      }

      if (isConnected) {
        setStatus({
          ...data,
          connected: true,
          platform: "shopify",
        });

        return;
      }

      setStatus({
        ...data,
        connected: false,
        platform: "shopify",
      });
    } catch (err) {
      console.error(
        "SHOPIFY_CONNECTION_STATUS_ERROR:",
        err
      );

      setStatus({
        connected: false,
        platform: "shopify",
      });
    } finally {
      setLoading(false);
    }
  }

  function connectShopify() {
    if (connecting) return;

    setConnecting(true);
    setError("");

    window.location.assign(
      "/api/shopify/connect"
    );
  }

  function continueToVirello() {
    window.location.assign("/");
  }

  async function startCheckout() {
    setError("");

    try {
      const response = await fetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        !data?.success ||
        !data?.url
      ) {
        throw new Error(
          data?.error ||
            "Unable to start subscription checkout."
        );
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start subscription checkout."
      );
    }
  }

  const connected =
    status?.connected === true;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-small">
            VIRELLO AI
          </div>

          <div className="brand-name">
            Virello AI Optimizer
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="subscribe-button"
            onClick={startCheckout}
          >
            Subscribe
          </button>
        </div>
      </header>

      {error && (
        <div className="error-bar">
          {error}
        </div>
      )}

      {loading ? (
        <section className="loading-section">
          <div className="loading-card">
            <div className="spinner" />

            <p>
              Checking Shopify connection...
            </p>
          </div>
        </section>
      ) : connected ? (
        <>
          <section className="connected-hero">
            <div className="connected-inner">
              <div className="eyebrow">
                SHOPIFY CONNECTED
              </div>

              <h1>
                Your store is{" "}
                <span>connected.</span>
              </h1>

              <p>
                Your Shopify store has been
                successfully connected to
                Virello AI Optimizer.
              </p>
            </div>
          </section>

          <section className="confirmation-section">
            <div className="confirmation-card">
              <div className="check-circle">
                <span>✓</span>
              </div>

              <div className="confirmation-label">
                CONNECTION COMPLETE
              </div>

              <h2>
                Shopify connected successfully
              </h2>

              <p className="confirmation-description">
                Virello can now work with your
                Shopify store.
              </p>

              {status?.shop && (
                <div className="store-row">
                  <div className="store-icon">
                    <span>⌂</span>
                  </div>

                  <div className="store-info">
                    <div className="store-label">
                      Connected store
                    </div>

                    <div className="store-name">
                      {status.shop}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="continue-button"
                onClick={continueToVirello}
              >
                Continue to Virello
              </button>
            </div>

            <div className="next-card">
              <div className="next-label">
                WHAT'S NEXT?
              </div>

              <h3>
                Start optimizing your Shopify
                products.
              </h3>

              <p>
                Import your products, optimize
                them with AI, review the
                recommendations and apply the
                changes to Shopify.
              </p>

              <div className="steps">
                <div className="step">
                  <div className="step-icon">
                    ↓
                  </div>

                  <strong>
                    1. Import
                  </strong>

                  <span>
                    Import your Shopify
                    products.
                  </span>
                </div>

                <div className="step">
                  <div className="step-icon">
                    ✦
                  </div>

                  <strong>
                    2. Optimize
                  </strong>

                  <span>
                    Generate SEO titles,
                    descriptions and more.
                  </span>
                </div>

                <div className="step">
                  <div className="step-icon">
                    ✎
                  </div>

                  <strong>
                    3. Review
                  </strong>

                  <span>
                    Review and edit AI
                    recommendations.
                  </span>
                </div>

                <div className="step">
                  <div className="step-icon">
                    ↑
                  </div>

                  <strong>
                    4. Apply
                  </strong>

                  <span>
                    Publish optimized content
                    to Shopify.
                  </span>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="hero">
            <div className="hero-inner">
              <div className="eyebrow">
                SHOPIFY AI OPTIMIZATION
              </div>

              <h1>
                Optimize Shopify
                <br />
                products{" "}
                <span>with AI.</span>
              </h1>

              <p>
                Connect your Shopify store,
                import products and create
                conversion-focused listings,
                SEO content and product
                intelligence with Virello AI.
              </p>
            </div>
          </section>

          <section className="connection-section">
            <div className="connection-card">
              <div className="step-label">
                SHOPIFY CONNECTION
              </div>

              <h2>
                Connect your Shopify store
              </h2>

              <p className="description">
                Connect your Shopify store to
                import products and optimize
                them with Virello AI.
              </p>

              <div className="shopify-field">
                <span>Shopify</span>
              </div>

              <button
                type="button"
                className="connect-button"
                onClick={connectShopify}
                disabled={connecting}
              >
                {connecting
                  ? "Connecting..."
                  : "Connect Shopify"}
              </button>
            </div>
          </section>
        </>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  .page-shell {
    min-height: 100vh;
    background: #f5f6f7;
    color: #111318;
  }

  .topbar {
    min-height: 76px;
    padding: 13px 34px;
    background: #ffffff;
    border-bottom: 1px solid #e4e6e9;

    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 20px;
  }

  .brand-small {
    color: #9a9fa6;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .16em;
  }

  .brand-name {
    margin-top: 3px;
    font-size: 18px;
    font-weight: 850;
    letter-spacing: -.025em;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
  }

  .subscribe-button {
    min-height: 42px;
    padding: 0 18px;

    border: 0;
    border-radius: 9px;

    background: #111318;
    color: #ffffff;

    font-size: 11px;
    font-weight: 800;

    cursor: pointer;
  }

  .subscribe-button:hover {
    background: #292d34;
  }

  .error-bar {
    width: calc(100% - 44px);
    max-width: 1020px;

    margin: 14px auto 0;
    padding: 11px 14px;

    border: 1px solid #e5cccc;
    border-radius: 9px;

    background: #fffafa;
    color: #984d4d;

    font-size: 11px;
  }

  .hero {
    background: #ffffff;
    border-bottom: 1px solid #e4e6e9;
  }

  .hero-inner {
    max-width: 1020px;
    margin: 0 auto;

    padding: 55px 34px 52px;
  }

  .eyebrow {
    color: #92979e;

    font-size: 10px;
    font-weight: 850;
    letter-spacing: .16em;
  }

  .hero h1 {
    max-width: 760px;

    margin: 13px 0 15px;

    font-size: clamp(38px, 6vw, 62px);
    line-height: .98;

    letter-spacing: -.055em;
    font-weight: 900;
  }

  .hero h1 span {
    color: #969ca4;
  }

  .hero p {
    max-width: 720px;

    margin: 0;

    color: #747a82;

    font-size: 16px;
    line-height: 1.65;
  }

  .connection-section {
    padding: 26px 22px 42px;
  }

  .connection-card {
    max-width: 1020px;
    margin: 0 auto;

    padding: 30px;

    border: 1px solid #dfe2e6;
    border-radius: 17px;

    background: #ffffff;

    box-shadow:
      0 8px 25px rgba(17, 19, 24, .035);
  }

  .step-label,
  .next-label {
    color: #91969d;

    font-size: 10px;
    font-weight: 850;

    letter-spacing: .16em;
  }

  .connection-card h2 {
    margin: 11px 0 8px;

    font-size: 27px;
    line-height: 1.1;

    letter-spacing: -.035em;
  }

  .description {
    max-width: 650px;

    margin: 0 0 22px;

    color: #777d85;

    font-size: 14px;
    line-height: 1.6;
  }

  .shopify-field {
    min-height: 52px;

    padding: 0 15px;

    border: 1px solid #d9dce0;
    border-radius: 9px;

    background: #fafafa;

    display: flex;
    align-items: center;

    color: #17191d;

    font-size: 13px;
    font-weight: 750;
  }

  .connect-button,
  .continue-button {
    width: 100%;
    min-height: 52px;

    margin-top: 10px;

    border: 0;
    border-radius: 9px;

    background: #111318;
    color: #ffffff;

    font-size: 12px;
    font-weight: 850;

    cursor: pointer;
  }

  .connect-button:hover,
  .continue-button:hover {
    background: #292d34;
  }

  .connect-button:disabled {
    opacity: .5;
    cursor: wait;
  }

  .connected-hero {
    background: #ffffff;
    border-bottom: 1px solid #e4e6e9;
  }

  .connected-inner {
    max-width: 1020px;
    margin: 0 auto;

    padding: 47px 34px 48px;
  }

  .connected-inner h1 {
    max-width: 760px;

    margin: 12px 0 15px;

    font-size: clamp(42px, 6vw, 65px);
    line-height: .98;

    letter-spacing: -.06em;
    font-weight: 900;
  }

  .connected-inner h1 span {
    color: #969ca4;
  }

  .connected-inner p {
    max-width: 680px;

    margin: 0;

    color: #777d85;

    font-size: 16px;
    line-height: 1.65;
  }

  .confirmation-section {
    padding: 27px 22px 48px;
  }

  .confirmation-card,
  .next-card {
    max-width: 950px;
    margin: 0 auto;

    border: 1px solid #dfe2e6;
    border-radius: 17px;

    background: #ffffff;
  }

  .confirmation-card {
    padding: 40px 38px 35px;

    text-align: center;
  }

  .check-circle {
    width: 82px;
    height: 82px;

    margin: 0 auto 25px;

    border-radius: 50%;

    background: #111318;

    display: flex;
    align-items: center;
    justify-content: center;
  }

  .check-circle span {
    color: #ffffff;

    font-size: 43px;
    font-weight: 500;

    line-height: 1;
  }

  .confirmation-label {
    color: #92979e;

    font-size: 10px;
    font-weight: 850;

    letter-spacing: .16em;
  }

  .confirmation-card h2 {
    margin: 12px 0 8px;

    font-size: 29px;
    line-height: 1.15;

    letter-spacing: -.04em;
  }

  .confirmation-description {
    margin: 0;

    color: #777d85;

    font-size: 14px;
    line-height: 1.55;
  }

  .store-row {
    max-width: 700px;

    margin: 30px auto 0;
    padding: 19px 0;

    border-top: 1px solid #eceef0;
    border-bottom: 1px solid #eceef0;

    display: flex;
    align-items: center;

    gap: 15px;

    text-align: left;
  }

  .store-icon {
    width: 52px;
    height: 52px;

    flex: 0 0 52px;

    border-radius: 50%;

    background: #f1f2f3;

    display: flex;
    align-items: center;
    justify-content: center;
  }

  .store-icon span {
    font-size: 22px;
  }

  .store-label {
    color: #777d85;

    font-size: 10px;
    font-weight: 750;
  }

  .store-name {
    margin-top: 4px;

    color: #111318;

    font-size: 14px;
    font-weight: 850;

    word-break: break-word;
  }

  .continue-button {
    max-width: 700px;

    margin: 24px auto 0;
  }

  .next-card {
    margin-top: 16px;
    padding: 27px;
  }

  .next-card h3 {
    margin: 9px 0 7px;

    font-size: 21px;

    letter-spacing: -.03em;
  }

  .next-card > p {
    max-width: 650px;

    margin: 0;

    color: #777d85;

    font-size: 12px;
    line-height: 1.6;
  }

  .steps {
    margin-top: 26px;

    display: grid;
    grid-template-columns: repeat(4, 1fr);

    gap: 16px;
  }

  .step {
    min-width: 0;

    text-align: center;
  }

  .step-icon {
    width: 52px;
    height: 52px;

    margin: 0 auto 12px;

    border-radius: 50%;

    background: #f1f2f3;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 23px;
  }

  .step strong {
    display: block;

    font-size: 11px;
  }

  .step span {
    display: block;

    margin-top: 5px;

    color: #858b92;

    font-size: 9px;
    line-height: 1.5;
  }

  .loading-section {
    padding: 27px 22px;
  }

  .loading-card {
    max-width: 1020px;
    min-height: 170px;

    margin: 0 auto;

    border: 1px solid #dfe2e6;
    border-radius: 17px;

    background: #ffffff;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    gap: 13px;
  }

  .loading-card p {
    margin: 0;

    color: #777d85;

    font-size: 12px;
  }

  .spinner {
    width: 27px;
    height: 27px;

    border: 3px solid #e4e6e9;
    border-top-color: #111318;

    border-radius: 50%;

    animation: spin .8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 760px) {
    .topbar {
      min-height: 68px;
      padding: 11px 17px;
    }

    .brand-name {
      font-size: 15px;
    }

    .subscribe-button {
      min-height: 38px;
      padding: 0 14px;
    }

    .hero-inner {
      padding: 39px 22px 37px;
    }

    .hero h1 {
      font-size: 39px;
      line-height: .98;
    }

    .hero p {
      font-size: 13px;
    }

    .connection-section,
    .confirmation-section,
    .loading-section {
      padding: 17px 14px 30px;
    }

    .connection-card {
      padding: 22px;
      border-radius: 14px;
    }

    .connection-card h2 {
      font-size: 23px;
    }

    .connected-inner {
      padding: 37px 22px 38px;
    }

    .connected-inner h1 {
      font-size: 43px;
      line-height: .98;
    }

    .connected-inner p {
      font-size: 13px;
    }

    .confirmation-card {
      padding: 32px 21px 28px;
    }

    .confirmation-card h2 {
      font-size: 24px;
    }

    .store-row {
      margin-top: 25px;
    }

    .next-card {
      padding: 22px;
    }

    .steps {
      grid-template-columns: 1fr 1fr;
      gap: 24px 12px;
    }
  }

  @media (max-width: 430px) {
    .hero h1 {
      font-size: 36px;
    }

    .connected-inner h1 {
      font-size: 39px;
    }

    .steps {
      grid-template-columns: 1fr 1fr;
    }
  }
`;