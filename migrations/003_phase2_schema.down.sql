-- Rollback for 003_phase2_schema.sql
--
-- Manual maintenance-window steps:
--   1. Stop app traffic that writes shops, sessions, usage, or webhooks.
--   2. Take a Neon PITR / logical backup.
--   3. Run this file with a SQL client against DATABASE_URL.
--   4. Confirm shop_subscriptions and subscriber_usage still contain
--      pre-Phase-2 billing rows, then resume traffic on the previous app.
--
-- This file does not delete Stripe customer IDs, subscription IDs, or
-- usage counters created before Phase 2. It drops shops, app_sessions,
-- and the new webhook_events table, and removes Phase 2 columns.

DROP INDEX IF EXISTS app_sessions_expires_idx;
DROP INDEX IF EXISTS app_sessions_shop_active_idx;
DROP INDEX IF EXISTS webhook_events_shop_idx;
DROP INDEX IF EXISTS subscriber_usage_shop_period_idx;
DROP INDEX IF EXISTS shop_subscriptions_status_idx;
DROP INDEX IF EXISTS shopify_sessions_active_idx;
DROP INDEX IF EXISTS shops_uninstalled_idx;

ALTER TABLE shopify_sessions DROP CONSTRAINT IF EXISTS shopify_sessions_shop_fk;
ALTER TABLE shop_subscriptions DROP CONSTRAINT IF EXISTS shop_subscriptions_shop_fk;
ALTER TABLE subscriber_usage DROP CONSTRAINT IF EXISTS subscriber_usage_shop_fk;

DROP TABLE IF EXISTS app_sessions;
DROP TABLE IF EXISTS webhook_events;

ALTER TABLE stripe_webhook_events DROP COLUMN IF EXISTS created_at;
ALTER TABLE stripe_webhook_events DROP COLUMN IF EXISTS status;
ALTER TABLE stripe_webhook_events DROP COLUMN IF EXISTS shop;
ALTER TABLE stripe_webhook_events DROP COLUMN IF EXISTS event_type;
ALTER TABLE stripe_webhook_events DROP COLUMN IF EXISTS provider;

ALTER TABLE subscriber_usage DROP COLUMN IF EXISTS created_at;
ALTER TABLE subscriber_usage DROP COLUMN IF EXISTS shop;

ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS created_at;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS cancel_at_period_end;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS price_id;

ALTER TABLE shopify_sessions DROP COLUMN IF EXISTS revoked_at;
ALTER TABLE shopify_sessions DROP COLUMN IF EXISTS encryption_kid;
ALTER TABLE shopify_sessions DROP COLUMN IF EXISTS token_version;

DROP TABLE IF EXISTS shops;

DELETE FROM schema_migrations WHERE version = '003_phase2_schema';
