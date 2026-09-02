DROP INDEX IF EXISTS rate_limit_buckets_expires_at_ms_idx;
DROP TABLE IF EXISTS rate_limit_buckets;
DELETE FROM schema_migrations WHERE version = '007_rate_limits';
