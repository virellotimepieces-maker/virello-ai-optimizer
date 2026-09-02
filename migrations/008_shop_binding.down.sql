-- Rollback Phase 9 pending-shop columns. Does not delete Stripe billing rows.

DROP INDEX IF EXISTS app_sessions_pending_shop_idx;

ALTER TABLE app_sessions
  DROP COLUMN IF EXISTS pending_shop_expires_at;

ALTER TABLE app_sessions
  DROP COLUMN IF EXISTS pending_shop;

DELETE FROM schema_migrations WHERE version = '008_shop_binding';
