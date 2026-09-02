# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month via Stripe, connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## Phase 4 (current)

Stripe Price must be **exactly $29.99 USD / month**. Test and live Stripe credentials, Price IDs, webhook events, checkout sessions, customers, subscriptions, and Customer Portal objects must stay in the same mode. Billing (customers, subscriptions, invoices, payment status, period, cancellation, webhook event IDs) is stored in Neon. Product access requires **both** an active Shopify install and an eligible Stripe subscription (`active` or `trialing`, with no failed last invoice). Uninstall revokes access and sessions immediately but does **not** cancel Stripe.

The UI Subscribe button becomes **Manage Subscription** from `canManage` (survives refresh via `virello_sid`). Customer Portal return URLs are always `APP_URL`. Legacy `virello_subscriber` / shop / token cookies are cleared and never written.

Branch: `shopify-rebuild`. Do not merge to `main` and do not deploy until approved.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with real values. Do not commit it. `APP_URL` should be the public https origin (used for Stripe return URLs, CSRF, and redirect allowlisting). `STRIPE_PRICE_ID` must be a $29.99/month USD Price in the same mode as `STRIPE_SECRET_KEY`.

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
| `005_phase4_billing.sql` | `stripe_customers`, `stripe_invoices`, livemode, invoice/cancellation, event ordering |
| `005_phase4_billing.down.sql` | Phase 4 rollback (does not delete `shop_subscriptions` billing rows) |

### Rollback

Phase 4 billing tables: `migrations/005_phase4_billing.down.sql`.  
Phase 3 indexes: `migrations/004_phase3_sessions.down.sql`.  
Phase 2 schema: `migrations/003_phase2_schema.down.sql` (does not delete pre-Phase-2 billing rows). Roll back 4 → 3 → 2.

## Environment variable names

Set these in `.env.local` and Vercel. Do not put values in git.

- `APP_URL` (canonical public origin)
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STRIPE_SECRET_KEY` (`sk_test_` or `sk_live_`, never mixed)
- `STRIPE_PRICE_ID` (must be $29.99 USD monthly in the same mode)
- `STRIPE_WEBHOOK_SECRET` (`whsec_…` from the same mode)
- `SUBSCRIBER_COOKIE_SECRET`
- `AI_SUBSCRIBER_USAGE_LIMIT` (paid allowance; default 1000)
- `SHOPIFY_API_KEY` / `SHOPIFY_CLIENT_ID`
- `SHOPIFY_API_SECRET` / `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_SECRET_PREVIOUS`
- `SHOPIFY_APP_HANDLE`
- `SHOPIFY_TOKEN_ENCRYPTION_KEY`

## Access matrix

| Stripe status | Product access (if Shopify is installed) | Manage Subscription |
| --- | --- | --- |
| `active` | Yes | Yes |
| `trialing` | Yes | Yes |
| `past_due` | No | Yes |
| `unpaid` | No | Yes |
| `incomplete` | No | Yes |
| `paused` | No | Yes |
| `canceled` / `incomplete_expired` | No | No (Subscribe) |
| Uninstalled + Stripe still `active` | No | Yes |
| Last invoice `failed` | No | Yes |

AI, product import, and save-to-Shopify all use this gate.

## Customer flow

Subscribe → Manage Subscription after payment (survives refresh via `virello_sid`) → Connect Shopify (embedded Admin or standalone) → Import → Optimize → Review → Save to Shopify.

## Deploy

Next.js on Vercel (`vercel.json` framework only; no `outputDirectory`). Do not deploy this branch until Phase 4 is approved. Stripe webhook path: `/api/stripe/webhook`. Shopify webhook path: `/api/webhooks`. Shopify OAuth callback: `/api/auth/shopify/callback`.
