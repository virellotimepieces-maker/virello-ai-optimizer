# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month via Stripe, connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## Phase 1 recovery

Branch `shopify-rebuild` restores the last Shopify/Stripe baseline (`a2e6428`) and prepares the repo shape. WooCommerce routes and deploy zip archives were removed. Monthly paid AI allowance is **1000**.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with real values. Do not commit it.

```bash
npm test
npm run security:check
npm run build
```

## Environment variable names

Set these in `.env.local` and Vercel. Do not put values in git.

- `APP_URL`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `SUBSCRIBER_COOKIE_SECRET`
- `AI_SUBSCRIBER_USAGE_LIMIT` (paid allowance; default 1000)
- `SHOPIFY_API_KEY` / `SHOPIFY_CLIENT_ID`
- `SHOPIFY_API_SECRET` / `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_SECRET_PREVIOUS`
- `SHOPIFY_APP_HANDLE`
- `SHOPIFY_TOKEN_ENCRYPTION_KEY`

## Customer flow

Subscribe → Manage Subscription after payment → Connect Shopify (embedded Admin or standalone) → Import → Optimize → Review → Save to Shopify.

## Deploy

Next.js on Vercel. Do not deploy this branch until Phase 1 is approved. Stripe webhook path: `/api/stripe/webhook`. Shopify OAuth callback: `/api/auth/shopify/callback`.
