# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month via Stripe, connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## What this branch includes

**Phase 5.** Shopify **managed installation**. Opening the app from Shopify Admin authenticates with App Bridge session tokens and token exchange before any merchant controls. Standalone Connect opens the Admin app URL. This deployment is one Shopify app (the App Store listing app). Offline tokens are expiring, encrypted in Neon, and refreshed automatically. Import is paginated with 429/throttle retries. Save is a single implementation (`POST /api/shopify/products`) and requires `confirmed: true` after review. Import/AI/save require an active install, `read_products`/`write_products`, and an eligible Stripe subscription. Shop identity is not stored in `localStorage`.

**Phase 6.** Server-side OpenAI optimizer (key never sent to the browser) writes title, description, SEO, tags, and conversion copy without inventing facts. Failed AI calls do not consume the 1000 monthly uses. The dashboard is English, with Connect, Subscribe/Manage, Import, Optimize, Review, and Save states.

**Phase 7.** Tenant isolation, HMAC/state/webhook checks, encrypted tokens, session rotation, rate limits, GID validation, security headers, and Playwright desktop/mobile coverage. `npm audit` high+ is gated in `npm run security:check`.

**Phase 9.** Shop binding is not permanent until Shopify OAuth completes (callback HMAC or Shopify's token endpoint, signed state, encrypted token, and installation row). Abandoned or failed OAuth leaves an expiring `pending_shop` that can be replaced. **Use this store** moves this subscriber's $29.99 from a leftover `.myshopify.com` domain (`gfd1cp-1v`) onto the domain in the field (`gfd1cp-1y`) before Connect Shopify. Change Store disconnects a completed install, keeps Stripe billing, and starts a fresh OAuth. Cross-tenant product access stays denied.

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
| `009_expiring_offline_tokens.sql` | Encrypted refresh tokens and expiry columns for Shopify offline sessions |
| `009_expiring_offline_tokens.down.sql` | Drops expiring-token columns |

Rollback order in a maintenance window (Neon PITR first): `009` → `008` → `007` → `006` → `005` → `004` → `003`. Down files for `005`/`003` do not delete `shop_subscriptions` billing rows.

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
- `SHOPIFY_API_KEY` / `SHOPIFY_CLIENT_ID` (must match `shopify.app.toml` `client_id` `059b113acaba78d855be9bc9500e421a`)
- `SHOPIFY_API_SECRET` / `SHOPIFY_CLIENT_SECRET` (that app’s Client secret only)
- `SHOPIFY_API_SECRET_PREVIOUS` (same app, previous secret during rotation — not a second Shopify app)
- `SHOPIFY_APP_HANDLE`
- `SHOPIFY_TOKEN_ENCRYPTION_KEY`

**Vercel: one `SHOPIFY_API_SECRET` per environment. Never two rows that both include Production.**

If search shows two `SHOPIFY_API_SECRET` entries — one **Production** and one **Production and Preview** — Production is receiving two values. Keep the **Production-only** row (the current Client secret you just saved). Delete the overlapping **Production and Preview** row, or change that second row to **Preview only**. The Production-only row must still exist after that. If Connect says **Shopify credentials are not configured**, Production no longer has `SHOPIFY_API_SECRET` — add it back as **Production only**, then **Redeploy Production** without using an existing build cache. Do not paste the secret into git or chat. During a rotation, put the previous secret in `SHOPIFY_API_SECRET_PREVIOUS` instead of a second `SHOPIFY_API_SECRET` row.

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

## Live production

**https://virello-ai-optimizer.vercel.app is the live app.** `main` deploys to Vercel Production.

Subscriber path: Subscribe ($29.99/month) → Connect Shopify → Import → Optimize → Review → Save to Shopify.

### Stripe (real charges)

Vercel Production must use:

- `STRIPE_SECRET_KEY` starting with `sk_live_`
- `STRIPE_PRICE_ID` for a **live** $29.99/month USD Price
- `STRIPE_WEBHOOK_SECRET` for the live endpoint `https://virello-ai-optimizer.vercel.app/api/stripe/webhook`

Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

If Production still has `sk_test_`, the dashboard shows a test-mode banner and real cards are not charged.

### Shopify (App Store listing app)

This production URL is **one Shopify app**: Client ID `059b113acaba78d855be9bc9500e421a`. Do not point a second Shopify app at this URL or mix that app’s secret into Vercel Production.

A Vercel deploy does **not** update Shopify. In [Dev Dashboard](https://dev.shopify.com) → the listing app (Client ID `059b113acaba78d855be9bc9500e421a`):

1. Released version: App URL `https://virello-ai-optimizer.vercel.app`, callback `https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback`, scopes `read_products,write_products`, **managed installation** (do not enable legacy install).
2. Vercel Production `SHOPIFY_API_KEY` must be `059b113acaba78d855be9bc9500e421a`. `SHOPIFY_API_SECRET` is one Production-only Client secret for that same app.
3. **Distribution:** development-store-only limits installs to listed shops. To take other paying subscribers, switch to **Unlisted** (install link) or **Public** (App Store).
4. Resubmit from **Distribution → Manage submission**.

Health check: `GET https://virello-ai-optimizer.vercel.app/api/health` → `{ "ok": true, "live": true }`.

## Shopify OAuth (production)

Embedded Admin uses App Bridge session tokens and token exchange (`expiring=1`). Standalone Connect opens the Admin app URL so managed installation can finish. Merchants do not enter a shop domain inside Shopify Admin.

A Vercel deploy does **not** update Shopify. After a code change, release a version from Dev Dashboard (or `shopify app deploy`) for Client ID `059b113acaba78d855be9bc9500e421a`, then resubmit from **Distribution → Manage submission**.

## Deploy

Next.js on Vercel (`vercel.json` framework only; no `outputDirectory`). Push to `main` promotes Production at `https://virello-ai-optimizer.vercel.app`.

Do not put `sk_test_` or a test Price on Production. Preview may use Stripe test mode.

## Monitoring

- Vercel: function errors, 5xx rate, webhook 400s
- Stripe: failed webhooks, `past_due` / `unpaid` subscriptions
- Shopify: webhook HMAC failures, token exchange errors
- Neon: migration errors, usage table growth
- App logs: `STRIPE_WEBHOOK_PROCESS_ERROR`, `SHOPIFY_OAUTH_CALLBACK_REJECTED`, `AI_ANALYZE_ERROR`

## Rollback

1. In Vercel, Instant Rollback to the previous Production deployment.
2. If schema must move back: restore Neon PITR to before the bad migration, or run the `.down.sql` files newest-first.
3. Git rollback target is the `main` commit immediately before the bad Production deploy.

The live app is Production on `main`.
