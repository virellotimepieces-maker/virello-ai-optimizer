-- Phase 3: session cleanup indexes. Additive.
-- Rollback: see 004_phase3_sessions.down.sql

CREATE INDEX IF NOT EXISTS app_sessions_revoked_idx
  ON app_sessions (revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_sessions_cleanup_idx
  ON app_sessions (expires_at, revoked_at);
