# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month via Stripe, connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## What this branch includes

**Phase 5.** Shopify OAuth for **standalone** (authorization-code + signed state, HMAC, `APP_URL` callback) and **embedded** (Admin launch + App Bridge token exchange). Offline tokens stay encrypted in Neon. Import is paginated with 429/throttle retries. Save is a single implementation (`POST /api/shopify/products`) and requires `confirmed: true` after review. Import/AI/save require an active install, `read_products`/`write_products`, and an eligible Stripe subscription. Shop identity is not stored in `localStorage`.

**Phase 6.** Server-side OpenAI optimizer (key never sent to the browser) writes title, description, SEO, tags, and conversion copy without inventing facts. Failed AI calls do not consume the 1000 monthly uses. The dashboard is FIL/EN for interface and product-output language separately, with Connect, Subscribe/Manage, Import, Optimize, Review, and Save states.

**Phase 7.** Tenant isolation, HMAC/state/webhook checks, encrypted tokens, session rotation, rate limits, GID validation, security headers, and Playwright desktop/mobile coverage. `npm audit` high+ is gated in `npm run security:check`.

**Phase 9.** Shop binding is not permanent until Shopify OAuth completes (HMAC, signed state, code exchange, encrypted token, and installation row). Abandoned or failed OAuth leaves an expiring `pending_shop` that can be replaced. Change Store disconnects a completed install, keeps Stripe billing, and starts a fresh OAuth. Cross-tenant product access stays denied.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app listens on **http://127.0.0.1:43217**. Fill `.env.local` with real values. Do not commit it. `APP_URL` should be the public https origin (Stripe return URLs, CSRF, redirect allowlisting). Production must be `https://virello-ai-optimizer.vercel.app`. Do not use the browser Origin as a fallback. `STRIPE_PRICE_ID` must be a $29.99/month USD Price in the same mode as `STRIPE_SECRET_KEY`.

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run security:check
npm run build
```

There is no ESLint config; `npm run lint` runs the TypeScript compiler (`tsc --noEmit`).

## Database migrations

SQL files live in `migrations/`, applied in filename order by `app/api/_lib/migrate.ts` on first `DATABASE_URL` use.

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
    | `007_rate_limits.sql` | Tenant-isolated serverless rate-limit buckets |
| `007_rate_limits.down.sql` | Phase 8 rate-limit rollback |
| `008_shop_binding.sql` | Expiring `pending_shop` on `app_sessions`; recover uninstalled session shops so OAuth can be retried or replaced |
| `008_shop_binding.down.sql` | Phase 9 pending-shop rollback (does not delete Stripe billing rows) |

Rollback order in a maintenance window (Neon PITR first): `008` → `007` → `006` → `005` → `004` → `003`. Down files for `005`/`003` do not delete `shop_subscriptions` billing rows.

## Environment-variable names

Set these in `.env.local` and in Vercel Preview/Production. Never commit values.

- `APP_URL` (canonical public origin; Production: `https://virello-ai-optimizer.vercel.app`)
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STRIPE_SECRET_KEY` (`sk_test_` on Preview, `sk_live_` only on Production)
- `STRIPE_PRICE_ID` (must be $29.99 USD monthly in the same mode as the secret)
- `STRIPE_WEBHOOK_SECRET` (same mode)
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

Next.js on Vercel (`vercel.json` framework only; no `outputDirectory`).

1. Confirm `shopify-rebuild` is green locally (commands above).
2. Create a Vercel Preview from `shopify-rebuild` (not `main`).
3. Point Stripe **test** webhook to `https://<preview>/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Point Shopify development-store webhooks to `https://<preview>/api/webhooks` and set the OAuth callback to `https://<preview>/api/auth/shopify/callback`. Required scopes: `read_products`, `write_products`.
5. Walk the Preview: $29.99 checkout, webhook, Manage Subscription, Connect Shopify, import, AI optimize, 1000-use enforcement, review, save, FIL/EN, mobile and desktop.
6. Only after that walkthrough, merge `shopify-rebuild` into `main` with a **normal merge commit** (no force-push) and promote Production.

## Monitoring

- Vercel: function errors, 5xx rate, webhook 400s
- Stripe: failed webhooks, `past_due` / `unpaid` subscriptions
- Shopify: webhook HMAC failures, token exchange errors
- Neon: migration errors, usage table growth
- App logs: `STRIPE_WEBHOOK_PROCESS_ERROR`, `SHOPIFY_OAUTH_CALLBACK_REJECTED`, `AI_ANALYZE_ERROR`

## Rollback

1. In Vercel, Instant Rollback to the previous Production deployment.
2. If schema must move back: restore Neon PITR to before the bad migration, or run the `.down.sql` files newest-first.
3. Git rollback target after a merge is the `main` commit immediately before the merge. Until merge, keep serving whatever is currently on `main` and leave `shopify-rebuild` as the working branch.

Do not deploy this branch until Phase 8 preview acceptance is complete.
