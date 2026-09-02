-- Rollback for 005_phase4_billing.sql
-- Does not delete shop_subscriptions billing rows.

ALTER TABLE webhook_events DROP COLUMN IF EXISTS provider_created;

ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS last_invoice_event_created;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS stripe_event_created;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS last_invoice_status;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS last_invoice_id;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS canceled_at;
ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS livemode;

DROP INDEX IF EXISTS stripe_invoices_subscription_idx;
DROP INDEX IF EXISTS stripe_invoices_shop_idx;
DROP TABLE IF EXISTS stripe_invoices;

DROP INDEX IF EXISTS stripe_customers_shop_idx;
DROP TABLE IF EXISTS stripe_customers;

DELETE FROM schema_migrations WHERE version = '005_phase4_billing';
