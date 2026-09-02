# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month via Stripe, connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## Phase 3 (current)

Opaque `app_sessions` cookies (`virello_sid` only), server-side session validation, rotation after Shopify connect / Stripe checkout / privilege changes, uninstall that revokes sessions without deleting billing, consolidated Shopify HMAC/JWT, `APP_URL` as the canonical origin, and leftover Pages-router files removed.

Branch: `shopify-rebuild`. Do not merge to `main` and do not deploy until approved.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with real values. Do not commit it. `APP_URL` should be the public https origin (used for Stripe return URLs, CSRF, and redirect allowlisting).

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
| `004_phase3_sessions.sql` | Session cleanup indexes |
| `004_phase3_sessions.down.sql` | Phase 3 index rollback |

### Rollback

Phase 3 indexes: `migrations/004_phase3_sessions.down.sql`.  
Phase 2 schema: `migrations/003_phase2_schema.down.sql` (does not delete pre-Phase-2 billing rows).

## Environment variable names

Set these in `.env.local` and Vercel. Do not put values in git.

- `APP_URL` (canonical public origin)
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

Subscribe → Manage Subscription after payment (survives refresh via `virello_sid`) → Connect Shopify (embedded Admin or standalone) → Import → Optimize → Review → Save to Shopify.

## Deploy

Next.js on Vercel (`vercel.json` framework only; no `outputDirectory`). Do not deploy this branch until Phase 3 is approved. Stripe webhook path: `/api/stripe/webhook`. Shopify webhook path: `/api/webhooks`. Shopify OAuth callback: `/api/auth/shopify/callback`.
