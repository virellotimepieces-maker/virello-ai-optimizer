-- Phase 8: tenant-isolated rate-limit buckets for serverless instances.
-- Rollback: see 007_rate_limits.down.sql

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start_ms BIGINT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  expires_at_ms BIGINT NOT NULL,
  PRIMARY KEY (bucket_key, window_start_ms)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_at_ms_idx
  ON rate_limit_buckets (expires_at_ms);
