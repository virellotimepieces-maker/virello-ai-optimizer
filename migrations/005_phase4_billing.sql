-- Phase 4 billing: Stripe customers, invoices, subscription event ordering.
-- Rollback: see 005_phase4_billing.down.sql

CREATE TABLE IF NOT EXISTS stripe_customers (
  stripe_customer_id TEXT PRIMARY KEY,
  shop TEXT NOT NULL REFERENCES shops(shop),
  livemode BOOLEAN NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_customers_shop_idx
  ON stripe_customers (shop);

CREATE TABLE IF NOT EXISTS stripe_invoices (
  stripe_invoice_id TEXT PRIMARY KEY,
  shop TEXT REFERENCES shops(shop),
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  amount_paid INTEGER,
  amount_due INTEGER,
  currency TEXT,
  period_start BIGINT,
  period_end BIGINT,
  livemode BOOLEAN NOT NULL,
  stripe_created BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_invoices_shop_idx
  ON stripe_invoices (shop);

CREATE INDEX IF NOT EXISTS stripe_invoices_subscription_idx
  ON stripe_invoices (stripe_subscription_id);

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS livemode BOOLEAN;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS canceled_at BIGINT;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS last_invoice_id TEXT;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS last_invoice_status TEXT;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_event_created BIGINT NOT NULL DEFAULT 0;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS last_invoice_event_created BIGINT NOT NULL DEFAULT 0;

ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS provider_created BIGINT;
