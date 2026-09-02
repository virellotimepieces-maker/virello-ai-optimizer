-- Rollback for 004_phase3_sessions.sql
-- Does not drop app_sessions or billing tables.

DROP INDEX IF EXISTS app_sessions_cleanup_idx;
DROP INDEX IF EXISTS app_sessions_revoked_idx;

DELETE FROM schema_migrations WHERE version = '004_phase3_sessions';
