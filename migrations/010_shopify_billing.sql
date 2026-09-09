-- Shopify app subscriptions (Billing API). Stripe tables are left in place unused.
CREATE TABLE IF NOT EXISTS shopify_app_subscriptions (
  shop TEXT PRIMARY KEY REFERENCES shops(shop) ON DELETE CASCADE,
  shopify_subscription_gid TEXT NOT NULL,
  status TEXT NOT NULL,
  test BOOLEAN NOT NULL DEFAULT TRUE,
  name TEXT NOT NULL DEFAULT 'Virello AI Optimizer',
  amount_cents INTEGER NOT NULL DEFAULT 2999,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_interval TEXT NOT NULL DEFAULT 'EVERY_30_DAYS',
  current_period_start BIGINT NOT NULL DEFAULT 0,
  current_period_end BIGINT NOT NULL DEFAULT 0,
  confirmation_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopify_app_subscriptions_gid_idx
  ON shopify_app_subscriptions (shopify_subscription_gid);

CREATE INDEX IF NOT EXISTS shopify_app_subscriptions_status_idx
  ON shopify_app_subscriptions (status);
