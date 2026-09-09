CREATE TABLE IF NOT EXISTS subscriber_usage_events (
  subscription_id TEXT NOT NULL,
  period_start BIGINT NOT NULL,
  idempotency_key TEXT NOT NULL,
  shop TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subscription_id, period_start, idempotency_key)
);

CREATE INDEX IF NOT EXISTS subscriber_usage_events_shop_idx
  ON subscriber_usage_events (shop, created_at);
