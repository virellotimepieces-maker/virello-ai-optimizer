DROP INDEX IF EXISTS subscriber_usage_events_shop_idx;
DROP TABLE IF EXISTS subscriber_usage_events;
DELETE FROM schema_migrations WHERE version = '011_usage_idempotency';
