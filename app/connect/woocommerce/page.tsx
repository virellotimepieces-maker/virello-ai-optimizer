"use client";

import { FormEvent, useState } from "react";

export default function WooCommerceConnectPage() {
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [connectedStore, setConnectedStore] = useState("");

  function normalizeStoreUrl(value: string): string {
    const raw = value.trim();

    if (!raw) {
      return "";
    }

    try {
      const withProtocol = /^https?:\/\//i.test(raw)
        ? raw
        : `https://${raw}`;

      const url = new URL(withProtocol);

      return url.origin.replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  async function connectWooCommerce(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (connecting) {
      return;
    }

    setMessage("");
    setConnected(false);

    const normalizedUrl =
      normalizeStoreUrl(storeUrl);

    if (!normalizedUrl) {
      setMessage(
        "Enter a valid WooCommerce store URL."
      );
      return;
    }

    if (!consumerKey.trim()) {
      setMessage(
        "WooCommerce Consumer Key is required."
      );
      return;
    }

    if (!consumerSecret.trim()) {
      setMessage(
        "WooCommerce Consumer Secret is required."
      );
      return;
    }

    setConnecting(true);

    try {
      const response = await fetch(
        "/api/auth/woocommerce",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            storeUrl: normalizedUrl,
            consumerKey: consumerKey.trim(),
            consumerSecret:
              consumerSecret.trim(),
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `WooCommerce connection failed (${response.status}).`
        );
      }

      if (
        data?.success !== true ||
        data?.connected !== true ||
        data?.platform !== "woocommerce"
      ) {
        throw new Error(
          data?.error ||
            "WooCommerce connection could not be verified."
        );
      }

      setStoreUrl(
        data.storeUrl || normalizedUrl
      );

      setConnectedStore(
        data.storeUrl || normalizedUrl
      );

      setConnected(true);
      setMessage("");
    } catch (error) {
      console.error(
        "WOOCOMMERCE_CONNECT_ERROR:",
        error
      );

      setConnected(false);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect WooCommerce store."
      );
    } finally {
      setConnecting(false);
    }
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

          <div className="platform-pill">
            WooCommerce
          </div>
        </header>

        <section className="hero">
          <div className="hero-inner">
            <div className="eyebrow">
              WOOCOMMERCE CONNECTED
            </div>

            <h1>
              Your store is{" "}
              <span>connected.</span>
            </h1>

            <p>
              Your WooCommerce store has
              been successfully connected
              to Virello AI Optimizer.
            </p>
          </div>
        </section>

        <section className="workspace">
          <section className="content-card success-card">
            <div className="success-icon">
              ✓
            </div>

            <div className="step-label">
              CONNECTION COMPLETE
            </div>

            <h2>
              WooCommerce connected
              successfully
            </h2>

            <p>
              Virello can now work with
              your WooCommerce store.
            </p>

            <div className="connected-store">
              <span>
                Connected store
              </span>

              <strong>
                {connectedStore}
              </strong>
            </div>

            <div className="actions">
              <a
                href="/connect"
                className="button secondary"
              >
                Back to Platforms
              </a>

              <a
                href="/woocommerce"
                className="button primary"
              >
                Continue to WooCommerce
              </a>
            </div>
          </section>

          <section className="content-card">
            <div className="step-label">
              VIRELLO WORKFLOW
            </div>

            <h2>
              From store to optimized
              listing
            </h2>

            <div className="flow-grid">
              <div className="flow-card">
                <strong>
                  1. Connect
                </strong>

                <p>
                  Your WooCommerce
                  store is connected.
                </p>
              </div>

              <div className="flow-card">
                <strong>
                  2. Import
                </strong>

                <p>
                  Bring your product
                  information into
                  Virello.
                </p>
              </div>

              <div className="flow-card">
                <strong>
                  3. Optimize
                </strong>

                <p>
                  Generate improved
                  product content with
                  AI.
                </p>
              </div>

              <div className="flow-card">
                <strong>
                  4. Apply
                </strong>

                <p>
                  Send approved content
                  back to your store.
                </p>
              </div>
            </div>
          </section>
        </section>

        <style jsx>{styles}</style>
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

        <div className="platform-pill">
          WooCommerce
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">
            WOOCOMMERCE CONNECTION
          </div>

          <h1>
            Connect your{" "}
            <span>WooCommerce store.</span>
          </h1>

          <p>
            Connect your WooCommerce
            store directly to Virello AI
            Optimizer using your
            WooCommerce REST API
            credentials.
          </p>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-grid">
          <section className="content-card">
            <div className="step-label">
              STEP 1
            </div>

            <h2>
              Store information
            </h2>

            <p className="description">
              Enter your WooCommerce
              store URL and API
              credentials.
            </p>

            <form
              onSubmit={
                connectWooCommerce
              }
            >
              <div className="form-group">
                <label htmlFor="storeUrl">
                  WooCommerce Store URL
                </label>

                <input
                  id="storeUrl"
                  type="url"
                  value={storeUrl}
                  onChange={(event) => {
                    setStoreUrl(
                      event.target.value
                    );
                    setMessage("");
                  }}
                  placeholder="https://yourstore.com"
                  autoComplete="url"
                  disabled={connecting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="consumerKey">
                  Consumer Key
                </label>

                <input
                  id="consumerKey"
                  type="text"
                  value={consumerKey}
                  onChange={(event) => {
                    setConsumerKey(
                      event.target.value
                    );
                    setMessage("");
                  }}
                  placeholder="ck_..."
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={connecting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="consumerSecret">
                  Consumer Secret
                </label>

                <input
                  id="consumerSecret"
                  type="password"
                  value={consumerSecret}
                  onChange={(event) => {
                    setConsumerSecret(
                      event.target.value
                    );
                    setMessage("");
                  }}
                  placeholder="cs_..."
                  autoComplete="off"
                  disabled={connecting}
                />
              </div>

              {message && (
                <div className="message">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="connect-button"
                disabled={connecting}
              >
                {connecting
                  ? "Connecting..."
                  : "Connect WooCommerce"}
              </button>
            </form>

            <p className="security-note">
              Your WooCommerce credentials
              are sent only to Virello's
              WooCommerce connection
              endpoint and are stored
              separately from other
              platform connections.
            </p>
          </section>

          <section className="content-card">
            <div className="step-label">
              API REQUIREMENTS
            </div>

            <h2>
              Before connecting
            </h2>

            <div className="requirements">
              <div className="requirement">
                <strong>
                  1. Store URL
                </strong>

                <p>
                  Use the main URL of
                  your WooCommerce
                  store.
                </p>
              </div>

              <div className="requirement">
                <strong>
                  2. Consumer Key
                </strong>

                <p>
                  Use the WooCommerce
                  REST API Consumer Key.
                </p>
              </div>

              <div className="requirement">
                <strong>
                  3. Consumer Secret
                </strong>

                <p>
                  Use the matching
                  WooCommerce REST API
                  Consumer Secret.
                </p>
              </div>
            </div>

            <a
              href="/connect"
              className="back-link"
            >
              ← Back to platform
              selection
            </a>
          </section>

          <section className="content-card">
            <div className="step-label">
              VIRELLO WORKFLOW
            </div>

            <h2>
              From store to optimized
              listing
            </h2>

            <div className="flow-grid">
              <div className="flow-card">
                <strong>
                  1. Connect
                </strong>

                <p>
                  Connect your
                  WooCommerce platform.
                </p>
              </div>

              <div className="flow-card">
                <strong>
                  2. Import
                </strong>

                <p>
                  Bring product
                  information into
                  Virello.
                </p>
              </div>

              <div className="flow-card">
                <strong>
                  3. Optimize
                </strong>

                <p>
                  Generate improved
                  product content with
                  AI.
                </p>
              </div>

              <div className="flow-card">
                <strong>
                  4. Apply
                </strong>

                <p>
                  Send approved content
                  back to your store.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
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

  .platform-pill {
    padding: 10px 15px;
    border: 1px solid #e0e3e7;
    border-radius: 999px;
    background: #ffffff;
    color: #6f757d;
    font-size: 11px;
    font-weight: 750;
  }

  .hero {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
  }

  .hero-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 65px 28px 60px;
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
    font-size: clamp(42px, 7vw, 72px);
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

  .description {
    margin: 0 0 26px;
    color: #7a8088;
    font-size: 16px;
    line-height: 1.6;
  }

  .form-group {
    margin-bottom: 18px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #30343a;
    font-size: 13px;
    font-weight: 800;
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

  .form-group input:disabled {
    opacity: 0.55;
  }

  .connect-button {
    width: 100%;
    min-height: 52px;
    margin-top: 4px;
    border: 0;
    border-radius: 11px;
    background: #111318;
    color: #ffffff;
    font-size: 14px;
    font-weight: 850;
    cursor: pointer;
  }

  .connect-button:hover {
    background: #292d34;
  }

  .connect-button:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .message {
    margin: 8px 0 16px;
    padding: 14px 16px;
    border: 1px solid #e0e3e7;
    border-radius: 12px;
    background: #f7f8f9;
    color: #555b63;
    font-size: 14px;
    line-height: 1.5;
  }

  .security-note {
    margin: 18px 0 0;
    color: #92979e;
    font-size: 12px;
    line-height: 1.55;
    text-align: center;
  }

  .requirements {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
  }

  .requirement {
    padding: 18px;
    border: 1px solid #e0e3e7;
    border-radius: 15px;
    background: #fafafa;
  }

  .requirement strong {
    display: block;
    margin-bottom: 7px;
    font-size: 14px;
  }

  .requirement p {
    margin: 0;
    color: #81878f;
    font-size: 13px;
    line-height: 1.55;
  }

  .back-link {
    display: inline-block;
    margin-top: 24px;
    color: #111318;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
  }

  .success-card {
    text-align: center;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: #111318;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    font-weight: 900;
  }

  .success-card h2 {
    margin-top: 14px;
  }

  .success-card > p {
    max-width: 600px;
    margin: 0 auto;
    color: #7a8088;
    font-size: 16px;
    line-height: 1.6;
  }

  .connected-store {
    max-width: 520px;
    margin: 28px auto;
    padding: 18px 20px;
    border: 1px solid #e0e3e7;
    border-radius: 14px;
    background: #f7f8f9;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .connected-store span {
    color: #8b9199;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .connected-store strong {
    color: #111318;
    font-size: 17px;
    word-break: break-word;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .button {
    min-height: 48px;
    padding: 0 24px;
    border-radius: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-size: 14px;
    font-weight: 850;
  }

  .button.primary {
    background: #111318;
    color: #ffffff;
  }

  .button.secondary {
    border: 1px solid #d9dce0;
    background: #ffffff;
    color: #111318;
  }

  .flow-grid {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 24px;
  }

  .flow-card {
    min-height: 150px;
    padding: 20px;
    border: 1px solid #e0e3e7;
    border-radius: 16px;
    background: #fafafa;
  }

  .flow-card strong {
    display: block;
    margin-bottom: 10px;
    font-size: 15px;
  }

  .flow-card p {
    margin: 0;
    color: #81878f;
    font-size: 13px;
    line-height: 1.55;
  }

  @media (max-width: 800px) {
    .topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .hero-inner {
      padding: 55px 20px 50px;
    }

    .workspace {
      padding: 18px;
    }

    .content-card {
      padding: 24px;
    }

    .flow-grid {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .topbar {
      padding: 16px 18px;
    }

    .hero h1 {
      font-size: 46px;
    }

    .hero p {
      font-size: 16px;
    }

    .flow-grid {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
    }

    .button {
      width: 100%;
    }
  }
`;