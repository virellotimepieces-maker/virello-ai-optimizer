CREATE TABLE IF NOT EXISTS shopify_sessions (
  shop TEXT PRIMARY KEY,
  encrypted_access_token TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_subscriptions (
  shop TEXT PRIMARY KEY,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  current_period_start BIGINT NOT NULL DEFAULT 0,
  current_period_end BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shop_subscriptions_customer_idx
  ON shop_subscriptions (stripe_customer_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
