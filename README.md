# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Virello is a subscription Shopify app. Merchants subscribe, connect a store, import products, and use AI to improve title, description, SEO, tags, and conversion copy. Changes are reviewed, then saved back to Shopify.

This is not a prompt clinic, Custom GPT rewriter, or social-media dashboard.

## What it does

1. Subscribe for **$29.99/month** through Stripe. After payment the app shows **Manage Subscription**, not Subscribe.
2. Connect a Shopify store with OAuth and an encrypted offline access token.
3. Import products from that store.
4. Select a product and generate AI title, description, SEO, tags, and conversion copy.
5. Review the result, then save approved fields back to Shopify.
6. Enforce monthly AI usage in Neon PostgreSQL. Filipino and English UI stay available.

## Customer flow

| Step | What happens |
| --- | --- |
| `/` | Dashboard: subscribe or manage billing, then connect Shopify |
| Connect | Shopify OAuth (managed install / App Bridge) |
| Import | Load products from the connected shop |
| Optimize | AI draft for the selected product |
| Review | Merchant edits or discards before anything is written |
| Save | Approved fields update Shopify |

There is no `/studio` and no prompt-rewrite sample. Do not paste Virello output into Custom GPT, chatbot, or Cursor rules — the product writes to Shopify after review.

## Run locally

```bash
npm install
npm run dev
```

Required environment variables (set in `.env.local` / Vercel; do not commit secrets): Shopify API key and secret, Stripe secret key, price ID, webhook secret, Neon `DATABASE_URL`, AI API key, token encryption key, session secret, and `APP_URL`.

## Deploy on Vercel

Standard Next.js. Configure production env vars before accepting subscribers. Stripe webhook URL: `https://<APP_URL>/api/stripe/webhook`. Shopify `application_url` and OAuth redirect must match `APP_URL`.
