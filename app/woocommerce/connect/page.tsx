"use client";

import { FormEvent, useState } from "react";

export default function WooCommerceConnectPage() {
  const [storeUrl, setStoreUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  async function connectWooCommerce(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (connecting) {
      return;
    }

    setConnecting(true);
    setError("");

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
            storeUrl,
            consumerKey,
            consumerSecret,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        data?.success !== true ||
        data?.connected !== true
      ) {
        throw new Error(
          data?.error ||
            `Unable to connect WooCommerce store (${response.status}).`
        );
      }

      window.location.assign(
        "/woocommerce"
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to connect WooCommerce store."
      );

      setConnecting(false);
    }
  }

  return (
    <main className="page-shell">
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
            <span>store.</span>
          </h1>

          <p>
            Enter your WooCommerce store URL
            and API credentials to connect
            your store directly to Virello.
          </p>
        </div>
      </section>

      <section className="workspace">
        <section className="content-card">
          <div className="step-label">
            STEP 1
          </div>

          <h2>
            WooCommerce store
          </h2>

          <p className="section-description">
            Enter the WooCommerce REST API
            credentials for this store.
          </p>

          <form
            onSubmit={connectWooCommerce}
            className="form"
          >
            <div className="form-group">
              <label htmlFor="store-url">
                Store URL
              </label>

              <input
                id="store-url"
                type="url"
                value={storeUrl}
                onChange={(event) =>
                  setStoreUrl(
                    event.target.value
                  )
                }
                placeholder="https://yourstore.com"
                autoComplete="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={connecting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="consumer-key">
                Consumer Key
              </label>

              <input
                id="consumer-key"
                type="text"
                value={consumerKey}
                onChange={(event) =>
                  setConsumerKey(
                    event.target.value
                  )
                }
                placeholder="ck_..."
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={connecting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="consumer-secret">
                Consumer Secret
              </label>

              <input
                id="consumer-secret"
                type="password"
                value={consumerSecret}
                onChange={(event) =>
                  setConsumerSecret(
                    event.target.value
                  )
                }
                placeholder="cs_..."
                autoComplete="off"
                disabled={connecting}
                required
              />
            </div>

            {error && (
              <div className="message error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="connect-button"
              disabled={
                connecting ||
                !storeUrl.trim() ||
                !consumerKey.trim() ||
                !consumerSecret.trim()
              }
            >
              {connecting
                ? "Connecting..."
                : "Connect WooCommerce Store"}
            </button>
          </form>
        </section>

        <section className="content-card">
          <div className="step-label">
            NEXT
          </div>

          <h2>
            After connection
          </h2>

          <div className="flow-grid">
            <div className="flow-card">
              <strong>
                1. Connect
              </strong>

              <p>
                Verify the WooCommerce
                API credentials.
              </p>
            </div>

            <div className="flow-card">
              <strong>
                2. Products
              </strong>

              <p>
                Load products from the
                connected store.
              </p>
            </div>

            <div className="flow-card">
              <strong>
                3. Optimize
              </strong>

              <p>
                Edit product content
                inside Virello.
              </p>
            </div>

            <div className="flow-card">
              <strong>
                4. Apply
              </strong>

              <p>
                Send approved changes
                back to WooCommerce.
              </p>
            </div>
          </div>
        </section>
      </section>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .page-shell {
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

  .brand-small,
  .eyebrow,
  .step-label {
    color: #92979f;
    font-size: 10px;
    font-weight: 850;
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
    padding: 58px 28px 50px;
  }

  .hero h1 {
    max-width: 850px;
    margin: 18px 0;
    font-size: clamp(44px, 7vw, 72px);
    line-height: 0.98;
    letter-spacing: -0.055em;
  }

  .hero h1 span {
    color: #a0a5ad;
  }

  .hero p {
    max-width: 720px;
    margin: 0;
    color: #747a82;
    font-size: 17px;
    line-height: 1.7;
  }

  .workspace {
    max-width: 1100px;
    margin: 0 auto;
    padding: 38px 28px 70px;
    display: grid;
    grid-template-columns:
      minmax(0, 1.2fr)
      minmax(280px, 0.8fr);
    gap: 22px;
    align-items: start;
  }

  .content-card {
    padding: 32px;
    border: 1px solid #e1e4e8;
    border-radius: 24px;
    background: #ffffff;
    box-shadow:
      0 12px 30px
      rgba(17, 19, 24, 0.05);
  }

  .content-card h2 {
    margin: 12px 0 8px;
    font-size: 28px;
    letter-spacing: -0.035em;
  }

  .section-description {
    margin: 0 0 24px;
    color: #777d85;
    line-height: 1.65;
    font-size: 14px;
  }

  .form {
    display: grid;
    gap: 18px;
  }

  .form-group {
    display: grid;
    gap: 8px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 800;
    color: #4d535b;
  }

  .form-group input {
    width: 100%;
    min-height: 54px;
    padding: 14px 16px;
    border: 1px solid #dfe2e6;
    border-radius: 14px;
    background: #ffffff;
    color: #111318;
    font-size: 15px;
    outline: none;
  }

  .form-group input:focus {
    border-color: #111318;
  }

  .connect-button {
    min-height: 56px;
    border: 0;
    border-radius: 14px;
    background: #111318;
    color: #ffffff;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }

  .connect-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .message {
    padding: 13px 15px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
  }

  .message.error {
    border: 1px solid #f0caca;
    background: #fff5f5;
    color: #9b2c2c;
  }

  .flow-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 22px;
  }

  .flow-card {
    padding: 17px;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    background: #fafbfc;
  }

  .flow-card strong {
    font-size: 13px;
  }

  .flow-card p {
    margin: 7px 0 0;
    color: #777d85;
    font-size: 12px;
    line-height: 1.55;
  }

  @media (max-width: 780px) {
    .topbar {
      padding: 16px 18px;
    }

    .hero-inner {
      padding: 46px 18px 42px;
    }

    .workspace {
      padding: 24px 18px 50px;
      grid-template-columns: 1fr;
    }

    .content-card {
      padding: 24px;
      border-radius: 20px;
    }

    .flow-grid {
      grid-template-columns: 1fr;
    }
  }
`;