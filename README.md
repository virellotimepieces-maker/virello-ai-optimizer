## Phase 8 release verification

Automated suite, security scan, TypeScript, Playwright, and production build. A Vercel preview and live Stripe/Shopify checkout cannot be completed in this environment because the required credentials are not available here. Do not merge to `main` until the blocker list below is cleared.

### Database migrations

Applied automatically on first `DATABASE_URL` use via `app/api/_lib/migrate.ts`.

| File | Purpose |
| --- | --- |
| `001_subscriber_usage.sql` | Monthly AI usage counters |
| `002_shopify_accounts.sql` | Shopify sessions, shop subscriptions, Stripe webhook ids |
| `003_phase2_schema.sql` | `shops`, `app_sessions`, `webhook_events`, FKs |
| `004_phase3_sessions.sql` | Session cleanup indexes |
| `005_phase4_billing.sql` | Stripe customers, invoices, livemode, event ordering |
| `006_phase6_locales.sql` | Shop UI and product-output locales |

Rollback order (maintenance window, Neon PITR first): `006` → `005` → `004` → `003`. `005`/`003` down files do not delete `shop_subscriptions` billing rows.

### Environment-variable names

Set in Vercel Production and Preview. Never commit values.

- `APP_URL`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `STRIPE_SECRET_KEY` (`sk_test_` on Preview, `sk_live_` only on Production)
- `STRIPE_PRICE_ID` (same mode as the secret; must be $29.99 USD / month)
- `STRIPE_WEBHOOK_SECRET` (same mode)
- `SUBSCRIBER_COOKIE_SECRET`
- `AI_SUBSCRIBER_USAGE_LIMIT` (default 1000)
- `SHOPIFY_API_KEY` / `SHOPIFY_CLIENT_ID`
- `SHOPIFY_API_SECRET` / `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_SECRET_PREVIOUS`
- `SHOPIFY_APP_HANDLE`
- `SHOPIFY_TOKEN_ENCRYPTION_KEY`

### Deployment steps

1. Confirm `shopify-rebuild` is green locally: `npm test && npm run test:e2e && npm run security:check && npx tsc --noEmit && npm run build`
2. Create a Vercel Preview from `shopify-rebuild` (not `main`).
3. Point Stripe **test** webhook to `https://<preview>/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.
4. Point Shopify development store webhooks to `https://<preview>/api/webhooks` and set the OAuth callback to `https://<preview>/api/auth/shopify/callback`.
5. Walk the Preview: $29.99 checkout, webhook, Manage Subscription, Connect Shopify, import, AI optimize, review, save, FIL/EN, mobile and desktop.
6. Only after that walkthrough, merge `shopify-rebuild` into `main` with a normal merge commit and promote the Production deployment.

### Monitoring

- Vercel: function errors, 5xx rate, webhook 400s
- Stripe: failed webhooks, `past_due` / `unpaid` subscriptions
- Shopify: webhook HMAC failures, token exchange errors
- Neon: migration errors, usage table growth
- App logs: `STRIPE_WEBHOOK_PROCESS_ERROR`, `SHOPIFY_OAUTH_CALLBACK_REJECTED`, `AI_ANALYZE_ERROR`

### Rollback

1. In Vercel, Instant Rollback to the previous Production deployment.
2. If schema must move back: restore Neon PITR to before the bad migration, or run the `.down.sql` files newest-first.
3. Git rollback target after a merge is the `main` commit before the merge. Until merge, keep serving whatever is currently on `main` and leave `shopify-rebuild` as the working branch.

Do not deploy this branch until Phase 8 preview acceptance is complete.
