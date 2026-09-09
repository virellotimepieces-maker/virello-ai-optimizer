# Virello AI Optimizer

Gawing tama ang Shopify product listings mo.

Subscription Shopify app: $29.99/month through the **Shopify Billing API** (`appSubscriptionCreate`), connect a store, import products, review AI title/description/SEO/tags/conversion copy, then save to Shopify. Works in **Shopify Admin (embedded)** and as a **standalone dashboard**.

This is not a prompt clinic or Custom GPT rewriter.

## What this branch includes

**Phase 5.** Shopify **managed installation**. Opening the app from Shopify Admin authenticates with App Bridge session tokens and token exchange before any merchant controls. Standalone Connect opens the Admin app URL. This deployment is one Shopify app (the App Store listing app). Offline tokens are expiring, encrypted in Neon, and refreshed automatically. Import is paginated with 429/throttle retries. Save is a single implementation (`POST /api/shopify/products`) and requires `confirmed: true` after review. Import/AI/save require an active install, `read_products`/`write_products`, and an **ACTIVE Shopify app subscription**. Shop identity is not stored in `localStorage`.

**Phase 6.** Server-side OpenAI optimizer (key never sent to the browser) writes title, description, SEO, tags, and conversion copy without inventing facts. Failed AI calls do not consume the 1000 monthly uses. The dashboard is English, with Connect, Subscribe/Manage, Import, Optimize, Review, and Save states.

**Phase 7.** Tenant isolation, HMAC/state/webhook checks, encrypted tokens, session rotation, rate limits, GID validation, security headers, and Playwright desktop/mobile coverage. `npm audit` high+ is gated in `npm run security:check`.

**Phase 9.** Shop binding is not permanent until Shopify OAuth completes (callback HMAC or Shopify's token endpoint, signed state, encrypted token, and installation row). Abandoned or failed OAuth leaves an expiring `pending_shop` that can be replaced. Shopify app subscriptions belong to one store and are not moved. Change Store disconnects a completed install; billing stays on that store. Cross-tenant product access stays denied.

**Billing.** Merchants are charged only through Shopify. `POST /api/billing/subscribe` creates a $29.99 / `EVERY_30_DAYS` app subscription and redirects to Shopify’s confirmation URL (top-level, including inside the Admin iframe). `POST /api/billing/manage` opens the pending confirmation URL or Shopify Admin billing settings. `app_subscriptions/update` keeps status in sync.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app listens on **http://127.0.0.1:43217**. Fill `.env.local` with real values. Do not commit it. `APP_URL` should be the public https origin (Shopify billing return URLs, CSRF, redirect allowlisting). Production must be `https://virello-ai-optimizer.vercel.app`. Do not use the browser Origin as a fallback.

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
| `002_shopify_accounts.sql` | Shopify sessions, leftover Stripe shop subscriptions, leftover Stripe webhook ids |
| `003_phase2_schema.sql` | `shops`, `app_sessions`, `webhook_events`, FKs, indexes, revoke columns |
| `003_phase2_schema.down.sql` | Phase 2 rollback only |
| `004_phase3_sessions.sql` | Session cleanup indexes |
| `004_phase3_sessions.down.sql` | Phase 3 index rollback |
| `005_phase4_billing.sql` | Leftover `stripe_customers` / `stripe_invoices` tables (unused by the app) |
| `005_phase4_billing.down.sql` | Phase 4 rollback (does not delete leftover `shop_subscriptions` rows) |
| `007_rate_limits.sql` | Tenant-isolated serverless rate-limit buckets |
| `007_rate_limits.down.sql` | Phase 8 rate-limit rollback |
| `008_shop_binding.sql` | Expiring `pending_shop` on `app_sessions`; recover uninstalled session shops so OAuth can be retried or replaced |
| `008_shop_binding.down.sql` | Phase 9 pending-shop rollback |
| `009_expiring_offline_tokens.sql` | Encrypted refresh tokens and expiry columns for Shopify offline sessions |
| `009_expiring_offline_tokens.down.sql` | Drops expiring-token columns |
| `010_shopify_billing.sql` | `shopify_app_subscriptions` for Shopify Billing API status |
| `010_shopify_billing.down.sql` | Drops `shopify_app_subscriptions` |

Rollback order in a maintenance window (Neon PITR first): `010` → `009` → `008` → `007` → `006` → `005` → `004` → `003`. Down files for `005`/`003` do not delete leftover `shop_subscriptions` rows.

## Environment-variable names

Set these in `.env.local` and in Vercel Preview/Production. Never commit values.

- `APP_URL` (canonical public origin; Production: `https://virello-ai-optimizer.vercel.app`)
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_SUBSCRIBER_USAGE_LIMIT` (paid allowance; default 1000)
- `SHOPIFY_API_KEY` / `SHOPIFY_CLIENT_ID` (must match `shopify.app.toml` `client_id` `059b113acaba78d855be9bc9500e421a`)
- `SHOPIFY_API_SECRET` / `SHOPIFY_CLIENT_SECRET` (that app’s Client secret only)
- `SHOPIFY_API_SECRET_PREVIOUS` (same app, previous secret during rotation — not a second Shopify app)
- `SHOPIFY_APP_HANDLE`
- `SHOPIFY_TOKEN_ENCRYPTION_KEY`
- `SHOPIFY_BILLING_TEST` (default true; partner development stores always create test charges. Set `false` only to create live Shopify charges)

**Do not delete these leftover Vercel variables yet** (unused after Shopify Billing replaced Stripe):

- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `SUBSCRIBER_COOKIE_SECRET` (legacy Stripe subscriber cookie; unused)

**Vercel: one `SHOPIFY_API_SECRET` per environment. Never two rows that both include Production.**

If search shows two `SHOPIFY_API_SECRET` entries — one **Production** and one **Production and Preview** — Production is receiving two values. Keep the **Production-only** row (the current Client secret you just saved). Delete the overlapping **Production and Preview** row, or change that second row to **Preview only**. The Production-only row must still exist after that. If Connect says **Shopify credentials are not configured**, Production no longer has `SHOPIFY_API_SECRET` — add it back as **Production only**, then **Redeploy Production** without using an existing build cache. Do not paste the secret into git or chat. During a rotation, put the previous secret in `SHOPIFY_API_SECRET_PREVIOUS` instead of a second `SHOPIFY_API_SECRET` row.

## Access matrix

| Shopify app subscription status | Product access (if Shopify is installed) | Manage Subscription |
| --- | --- | --- |
| `ACTIVE` | Yes | Yes |
| `PENDING` | No | Yes (confirmation URL) |
| `FROZEN` | No | Yes (Shopify Admin billing) |
| `DECLINED` | No | No (Subscribe) |
| `CANCELLED` | No | No (Subscribe) |
| `EXPIRED` | No | No (Subscribe) |
| Uninstalled + still `ACTIVE` | No | Yes |
| No subscription | No | No (Subscribe) |

AI, product import, and save-to-Shopify all use this gate.

## Customer flow

Open from Shopify Admin → Subscribe ($29.99/month Shopify charge) → approve on Shopify’s confirmation URL → Import → Optimize → Review → Save to Shopify.

## Live production

**https://virello-ai-optimizer.vercel.app is the live app.** `main` deploys to Vercel Production.

Subscriber path: Subscribe ($29.99/month via Shopify Billing) → Import → Optimize → Review → Save to Shopify.

### Shopify Billing (no Stripe checkout)

Charges are created with GraphQL `appSubscriptionCreate`. Test charges are the default (`SHOPIFY_BILLING_TEST` unset or `true`, and always on partner development stores). Set `SHOPIFY_BILLING_TEST=false` on Production only when live Shopify charges should be created for non-development stores.

Webhook: `app_subscriptions/update` → `https://virello-ai-optimizer.vercel.app/api/webhooks`.

A Vercel deploy does **not** register that topic. Run `shopify app deploy` (or release from Dev Dashboard) for Client ID `059b113acaba78d855be9bc9500e421a` so the listing app serves `app_subscriptions/update`.

### Shopify (App Store listing app)

This production URL is **one Shopify app**: Client ID `059b113acaba78d855be9bc9500e421a`. Do not point a second Shopify app at this URL or mix that app’s secret into Vercel Production.

A Vercel deploy does **not** update Shopify. In [Dev Dashboard](https://dev.shopify.com) → the listing app (Client ID `059b113acaba78d855be9bc9500e421a`):

1. Released version: App URL `https://virello-ai-optimizer.vercel.app`, callback `https://virello-ai-optimizer.vercel.app/api/auth/shopify/callback`, scopes `read_products,write_products`, **managed installation** (do not enable legacy install).
2. Vercel Production `SHOPIFY_API_KEY` must be `059b113acaba78d855be9bc9500e421a`. `SHOPIFY_API_SECRET` is one Production-only Client secret for that same app.
3. **Distribution:** development-store-only limits installs to listed shops. To take other paying subscribers, switch to **Unlisted** (install link) or **Public** (App Store).
4. Do not resubmit until install → Subscribe → Shopify confirmation → `ACTIVE` has been tested in a development store.

Health check: `GET https://virello-ai-optimizer.vercel.app/api/health` → `{ "ok": true, "live": true }`.

## Shopify OAuth (production)

Embedded Admin uses App Bridge session tokens and token exchange (`expiring=1`). Standalone Connect opens the Admin app URL so managed installation can finish. Merchants do not enter a shop domain inside Shopify Admin.

A Vercel deploy does **not** update Shopify. After a code change, release a version from Dev Dashboard (or `shopify app deploy`) for Client ID `059b113acaba78d855be9bc9500e421a`.

## Deploy

Next.js on Vercel (`vercel.json` framework only; no `outputDirectory`). Push to `main` promotes Production at `https://virello-ai-optimizer.vercel.app`.

## Monitoring

- Vercel: function errors, 5xx rate, webhook 400s
- Shopify Billing: `app_subscriptions/update`, pending/declined charges
- Shopify: webhook HMAC failures, token exchange errors
- Neon: migration errors, usage table growth
- App logs: `SHOPIFY_BILLING_SUBSCRIBE_ERROR`, `SHOPIFY_OAUTH_CALLBACK_REJECTED`, `AI_ANALYZE_ERROR`

## Rollback

1. In Vercel, Instant Rollback to the previous Production deployment.
2. If schema must move back: restore Neon PITR to before the bad migration, or run the `.down.sql` files newest-first.
3. Git rollback target is the `main` commit immediately before the bad Production deploy.

The live app is Production on `main`.
