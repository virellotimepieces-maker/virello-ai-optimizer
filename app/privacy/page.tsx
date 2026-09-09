import { COPY } from "../i18n";

export const metadata = {
  title: "Privacy Policy — Virello AI Optimizer",
  description: "How Virello AI Optimizer stores and deletes merchant data.",
};

export default function PrivacyPage() {
  const copy = COPY.en;
  return (
    <main className="app-shell privacy-page">
      <header className="topbar">
        <div>
          <div className="brand-small">{copy.brandSmall}</div>
          <div className="brand-name">{copy.brand}</div>
        </div>
        <a className="subscribe-button" href="/">
          {copy.brand}
        </a>
      </header>
      <article className="content-card privacy-card">
        <h1>Privacy Policy</h1>
        <p>
          Virello AI Optimizer (“Virello”) is a Shopify app that helps merchants rewrite
          product listings. This policy describes the data we store for that purpose.
        </p>
        <h2>Who we serve</h2>
        <p>
          Virello is used by Shopify merchants, not by their storefront customers. We do
          not create customer accounts, and we do not store customer personal information
          such as names, emails, addresses, or order history.
        </p>
        <h2>Data we store</h2>
        <ul>
          <li>Shopify shop domain and installation status</li>
          <li>Encrypted Shopify offline access and refresh tokens</li>
          <li>Shopify app subscription status and billing period for the $29.99/month plan</li>
          <li>Monthly AI usage counts for the connected shop</li>
          <li>Optional merchant-chosen locale preferences</li>
        </ul>
        <p>
          Product titles, descriptions, and other listing fields are sent to our servers
          only while you import, optimize, or save. We do not keep a product catalog after
          the request finishes. Optional product facts you type in the dashboard stay in
          the browser until you leave the page.
        </p>
        <h2>Processors</h2>
        <ul>
          <li>Shopify — authentication, product APIs, and app billing</li>
          <li>OpenAI — listing optimization. The API key stays on the server.</li>
          <li>Neon — encrypted tokens, billing status, and usage counters</li>
          <li>Vercel — application hosting</li>
        </ul>
        <h2>Cookies and sessions</h2>
        <p>
          After you connect a store we set an HttpOnly session cookie so the dashboard can
          recognize the shop. Shop identity is not stored in localStorage.
        </p>
        <h2>Retention and deletion</h2>
        <p>
          Uninstalling the app from Shopify Admin revokes stored access tokens. Shopify’s
          <code> shop/redact </code>
          webhook deletes shop-scoped records, including usage and subscription snapshots.
          Customer GDPR topics (<code>customers/data_request</code> and{" "}
          <code>customers/redact</code>) are acknowledged after HMAC verification; we have
          no customer records to export or erase.
        </p>
        <h2>Contact</h2>
        <p>
          Questions:{" "}
          <a href="mailto:virelloai.optimizer@gmail.com">virelloai.optimizer@gmail.com</a>
        </p>
      </article>
    </main>
  );
}
