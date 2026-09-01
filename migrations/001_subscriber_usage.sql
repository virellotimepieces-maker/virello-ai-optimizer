CREATE TABLE IF NOT EXISTS subscriber_usage (
  subscription_id TEXT NOT NULL,
  period_start BIGINT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS subscriber_usage_updated_at_idx
  ON subscriber_usage (updated_at);
