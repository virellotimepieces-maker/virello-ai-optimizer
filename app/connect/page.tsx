"use client";

import { useEffect, useState } from "react";
import { shopifyFetch } from "../shopify-fetch";

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
  const [subscriberActive, setSubscriberActive] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [shop, setShop] = useState("");
  const [status, setStatus] =
    useState<ConnectionStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopFromUrl = params.get("shop");
    const oauthError = params.get("error_description");

    if (oauthError) setError(oauthError);

    if (shopFromUrl) {
      setShop(
        cleanShopDomain(shopFromUrl)
      );
    }

    checkShopifyConnection();
    checkSubscriberStatus();
  }, []);

  async function checkSubscriberStatus() {
    try {
      const response = await shopifyFetch(
        "/api/subscriber/status",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );
      const data = await response
        .json()
        .catch(() => null);

      setSubscriberActive(
        response.ok &&
        data?.success &&
        data?.active === true
      );
    } catch {
      setSubscriberActive(false);
    }
  }

  async function handleSubscription() {
    if (billingLoading) return;

    if (!subscriberActive) {
      window.location.assign("/?checkout=true");
      return;
    }

    setBillingLoading(true);
    setError("");

    try {
      const response = await shopifyFetch(
        "/api/stripe/portal",
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok || !data?.url) {
        throw new Error(
          data?.error ||
          "Unable to open subscription management."
        );
      }

      const opened = window.open(
        data.url,
        "_top"
      );

      if (!opened) {
        window.location.assign(data.url);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open subscription management."
      );
      setBillingLoading(false);
    }
  }

  async function checkShopifyConnection() {
    setLoading(true);
    setError("");

    try {
      const response = await shopifyFetch("/status", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response
        .json()
        .catch(() => null);

      if (response.ok && data?.connected) {
        setStatus({
          ...data,
          connected: true,
          platform: "shopify",
        });

        if (data.shop) {
          setShop(data.shop);
        }

        return;
      }

      setStatus({
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

  function cleanShopDomain(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }

  function connectShopify() {
    if (connecting) return;

    const cleanedShop = cleanShopDomain(shop);

    if (!cleanedShop) {
      setError(
        "Enter your Shopify .myshopify.com store domain."
      );
      return;
    }

    if (
      !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(
        cleanedShop
      )
    ) {
      setError(
        "Use your Shopify .myshopify.com domain."
      );
      return;
    }

    setConnecting(true);
    setError("");

    const authorizationUrl =
      `${window.location.origin}/api/auth/shopify?shop=${encodeURIComponent(
        cleanedShop
      )}`;

    /*
     * Shopify's authorization page cannot be rendered inside the embedded
     * Admin iframe. Navigate the top-level browsing context so mobile Admin
     * does not fail with net::ERR_BLOCKED_BY_RESPONSE.
     */
    const opened = window.open(
      authorizationUrl,
      "_top"
    );

    if (!opened) {
      window.location.assign(
        authorizationUrl
      );
    }
  }

  function continueToVirello() {
    const target = new URL("/", window.location.origin);
    if (shop) target.searchParams.set("shop", cleanShopDomain(shop));
    window.location.assign(target.toString());
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
          <div className="shopify-pill">
            Shopify
          </div>

          <button
            type="button"
            className="subscribe-button"
            onClick={handleSubscription}
            disabled={billingLoading}
          >
            {billingLoading
              ? "Opening..."
              : subscriberActive
                ? "Manage Subscription"
                : "Subscribe"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-bar">
          {error}
        </div>
      )}

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
            Connect your Shopify store, import
            products and create conversion-focused
            listings, SEO content and product
            intelligence with Virello AI.
          </p>
        </div>
      </section>

      {loading && (
        <section className="loading-section">
          <div className="loading-card">
            <div className="spinner" />

            <p>
              Checking Shopify connection...
            </p>
          </div>
        </section>
      )}

      {!loading && connected && (
        <>
          <section className="connected-hero">
            <div className="connected-inner">
              <div className="connected-check">
                ✓
              </div>

              <div>
                <div className="eyebrow">
                  SHOPIFY CONNECTED
                </div>

                <h2>
                  Your Shopify store is{" "}
                  <span>connected.</span>
                </h2>

                <p>
                  Your Shopify store has been
                  successfully connected to
                  Virello AI Optimizer.
                </p>
              </div>

              <div className="connected-store">
                <div className="shopify-logo">
                  S
                </div>

                <div className="store-info">
                  <div className="store-label">
                    Connected Store
                  </div>

                  <strong>
                    {status?.shop ||
                      "Shopify Store"}
                  </strong>

                  <div className="connected-tag">
                    <span>●</span>
                    Connected
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="confirmation-section">
            <div className="confirmation-card">
              <div className="check-circle">
                ✓
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

              <div className="store-row">
                <div className="store-icon">
                  S
                </div>

                <div>
                  <div className="store-label">
                    Connected store
                  </div>

                  <div className="store-name">
                    {status?.shop ||
                      "Shopify Store"}
                  </div>
                </div>

                <div className="row-connected">
                  ✓ Connected
                </div>
              </div>

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
                    Import your Shopify products.
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
                    Review AI recommendations.
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
                    Publish changes to Shopify.
                  </span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {!loading && !connected && (
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
              import products and optimize them
              with Virello AI.
            </p>

            <label
              htmlFor="shop"
              className="input-label"
            >
              Shopify store domain
            </label>

            <input
              id="shop"
              type="text"
              value={shop}
              onChange={(e) => {
                setShop(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  connectShopify();
                }
              }}
              placeholder="your-store.myshopify.com"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              className="shop-input"
            />

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
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
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
          gap: 10px;
        }

        .shopify-pill {
          min-height: 42px;
          padding: 0 17px;
          border: 1px solid #dfe2e6;
          border-radius: 999px;
          background: #fff;
          display: flex;
          align-items: center;
          color: #70757d;
          font-size: 11px;
          font-weight: 800;
        }

        .subscribe-button {
          min-height: 42px;
          padding: 0 18px;
          border: 0;
          border-radius: 9px;
          background: #111318;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .subscribe-button:hover {
          background: #292d34;
        }

        .error-bar {
          max-width: 1020px;
          margin: 14px auto 0;
          padding: 12px 15px;
          border: 1px solid #e5cccc;
          border-radius: 9px;
          background: #fffafa;
          color: #984d4d;
          font-size: 12px;
        }

        .hero {
          background: #fff;
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

        .hero h1 span,
        .connected-inner h2 span {
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
          max-width: 700px;
          margin: 0 auto;
          padding: 30px;
          border: 1px solid #dfe2e6;
          border-radius: 17px;
          background: #fff;
          box-shadow:
            0 8px 25px
            rgba(17, 19, 24, .035);
        }

        .step-label,
        .next-label,
        .confirmation-label {
          color: #91969d;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .16em;
        }

        .connection-card h2 {
          margin: 11px 0 8px;
          font-size: 29px;
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

        .input-label {
          display: block;
          margin-bottom: 8px;
          color: #111318;
          font-size: 12px;
          font-weight: 800;
        }

        .shop-input {
          width: 100%;
          min-height: 54px;
          padding: 0 15px;
          border: 1px solid #d9dce0;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: #111318;
          font-size: 14px;
        }

        .shop-input:focus {
          border-color: #111318;
          box-shadow:
            0 0 0 3px
            rgba(17, 19, 24, .07);
        }

        .shop-input::placeholder {
          color: #a0a5ab;
        }

        .connect-button,
        .continue-button {
          width: 100%;
          min-height: 54px;
          margin-top: 12px;
          border: 0;
          border-radius: 9px;
          background: #111318;
          color: #fff;
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

        .loading-section {
          padding: 27px 22px;
        }

        .loading-card {
          max-width: 1020px;
          min-height: 180px;
          margin: 0 auto;
          border: 1px solid #dfe2e6;
          border-radius: 17px;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }

        .loading-card p {
          margin: 0;
          color: #777d85;
          font-size: 12px;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e4e6e9;
          border-top-color: #111318;
          border-radius: 50%;
          animation: spin .8s linear infinite;
        }

        .connected-hero {
          background: #f4faf5;
          border-bottom: 1px solid #dfe9e1;
        }

        .connected-inner {
          max-width: 1020px;
          margin: 0 auto;
          padding: 28px 34px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 20px;
        }

        .connected-check {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: #35a853;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 700;
        }

        .connected-inner h2 {
          margin: 9px 0 7px;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1;
          letter-spacing: -.05em;
          font-weight: 900;
        }

        .connected-inner p {
          margin: 0;
          color: #777d85;
          font-size: 13px;
          line-height: 1.5;
        }

        .connected-store {
          min-width: 230px;
          padding: 17px;
          border: 1px solid #e2e7e3;
          border-radius: 12px;
          background: #fff;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .shopify-logo {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: #95bf47;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 27px;
          font-weight: 900;
        }

        .store-label {
          color: #777d85;
          font-size: 10px;
          font-weight: 700;
        }

        .store-info strong {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          word-break: break-word;
        }

        .connected-tag {
          margin-top: 5px;
          color: #32834a;
          font-size: 9px;
          font-weight: 800;
        }

        .connected-tag span {
          margin-right: 4px;
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
          background: #fff;
        }

        .confirmation-card {
          padding: 40px 38px 35px;
          text-align: center;
        }

        .check-circle {
          width: 82px;
          height: 82px;
          margin: 0 auto 22px;
          border-radius: 50%;
          background: #35a853;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 700;
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
          margin: 28px auto 0;
          padding: 18px 0;
          border-top: 1px solid #eceef0;
          border-bottom: 1px solid #eceef0;
          display: flex;
          align-items: center;
          gap: 14px;
          text-align: left;
        }

        .store-icon {
          width: 50px;
          height: 50px;
          flex: 0 0 50px;
          border-radius: 10px;
          background: #95bf47;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
          font-weight: 900;
        }

        .store-name {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 850;
          word-break: break-word;
        }

        .row-connected {
          margin-left: auto;
          color: #32834a;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
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
          grid-template-columns:
            repeat(4, 1fr);
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

          .shopify-pill {
            display: none;
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
            font-size: 25px;
          }

          .connected-inner {
            padding: 25px 22px;
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .connected-check {
            width: 58px;
            height: 58px;
            font-size: 30px;
          }

          .connected-inner h2 {
            font-size: 34px;
          }

          .connected-store {
            min-width: 0;
            width: 100%;
          }

          .confirmation-card {
            padding: 32px 21px 28px;
          }

          .confirmation-card h2 {
            font-size: 24px;
          }

          .store-row {
            align-items: flex-start;
          }

          .row-connected {
            margin-left: auto;
            padding-top: 4px;
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

          .connected-inner h2 {
            font-size: 32px;
          }

          .store-row {
            flex-wrap: wrap;
          }

          .row-connected {
            width: 100%;
            margin-left: 64px;
          }
        }
      `}</style>
    </main>
  );
}
