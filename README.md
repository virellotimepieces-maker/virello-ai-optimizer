# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month via Stripe, connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## Phase 2 (current)

Versioned Neon migrations, tenant-isolated shops / sessions / subscriptions / usage, uninstall that **revokes** the Shopify installation without deleting billing history, webhook idempotency, and atomic monthly AI quota of **1000** successful optimizations. Failed AI requests do not consume quota.

Branch: `shopify-rebuild`. Do not merge to `main` and do not deploy until approved.

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
npx tsc --noEmit
npm run build
```

## Database migrations

SQL files live in `migrations/`, applied in filename order by `app/api/_lib/migrate.ts` on first database use.

| File | Purpose |
| --- | --- |
| `001_subscriber_usage.sql` | Monthly AI usage counters |
| `002_shopify_accounts.sql` | Shopify sessions, Stripe shop subscriptions, Stripe webhook ids |
| `003_phase2_schema.sql` | `shops`, `app_sessions`, `webhook_events`, FKs, indexes, revoke columns |
| `003_phase2_schema.down.sql` | Phase 2 rollback only |

### Rollback Phase 2

1. Stop writes (pause the app or put Neon in a maintenance window).
2. Take a Neon point-in-time or logical backup.
3. Run `migrations/003_phase2_schema.down.sql` against the database.
4. Confirm `shop_subscriptions` and `subscriber_usage` still hold billing rows.
5. Ship the previous application revision.

The down file drops `shops`, `app_sessions`, and `webhook_events`. It does **not** delete Stripe customer or subscription records created before Phase 2.

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

Next.js on Vercel. Do not deploy this branch until Phase 2 is approved. Stripe webhook path: `/api/stripe/webhook`. Shopify webhook path: `/api/webhooks`. Shopify OAuth callback: `/api/auth/shopify/callback`.
