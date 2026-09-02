-- Phase 2 schema (additive). Safe on databases that already ran 001/002.
-- Rollback: see 003_phase2_schema.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shops (
  shop TEXT PRIMARY KEY,
  name TEXT,
  scopes TEXT NOT NULL DEFAULT '',
  installed_at TIMESTAMPTZ,
  uninstalled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shops (shop, scopes, installed_at, updated_at)
SELECT shop, scope, installed_at, updated_at
FROM shopify_sessions
ON CONFLICT (shop) DO NOTHING;

INSERT INTO shops (shop, updated_at)
SELECT shop, updated_at
FROM shop_subscriptions
ON CONFLICT (shop) DO NOTHING;

ALTER TABLE shopify_sessions
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE shopify_sessions
  ADD COLUMN IF NOT EXISTS encryption_kid TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE shopify_sessions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS price_id TEXT;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE subscriber_usage
  ADD COLUMN IF NOT EXISTS shop TEXT;

ALTER TABLE subscriber_usage
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE subscriber_usage AS usage
SET shop = subs.shop
FROM shop_subscriptions AS subs
WHERE usage.subscription_id = subs.stripe_subscription_id
  AND usage.shop IS NULL;

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stripe';

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS event_type TEXT;

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS shop TEXT;

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed';

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  shop TEXT,
  status TEXT NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'processed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, event_id)
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL REFERENCES shops(shop),
  stripe_customer_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE shopify_sessions
    ADD CONSTRAINT shopify_sessions_shop_fk
    FOREIGN KEY (shop) REFERENCES shops(shop);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE shop_subscriptions
    ADD CONSTRAINT shop_subscriptions_shop_fk
    FOREIGN KEY (shop) REFERENCES shops(shop);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriber_usage
    ADD CONSTRAINT subscriber_usage_shop_fk
    FOREIGN KEY (shop) REFERENCES shops(shop);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS shops_uninstalled_idx
  ON shops (uninstalled_at);

CREATE INDEX IF NOT EXISTS shopify_sessions_active_idx
  ON shopify_sessions (shop)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS shop_subscriptions_status_idx
  ON shop_subscriptions (status);

CREATE INDEX IF NOT EXISTS subscriber_usage_shop_period_idx
  ON subscriber_usage (shop, period_start);

CREATE INDEX IF NOT EXISTS webhook_events_shop_idx
  ON webhook_events (shop);

CREATE INDEX IF NOT EXISTS app_sessions_shop_active_idx
  ON app_sessions (shop)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS app_sessions_expires_idx
  ON app_sessions (expires_at);
