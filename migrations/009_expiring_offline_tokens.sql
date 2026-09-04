-- Expiring offline Admin API tokens (required for new public Shopify apps).
ALTER TABLE shopify_sessions
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT NOT NULL DEFAULT '';

ALTER TABLE shopify_sessions
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

ALTER TABLE shopify_sessions
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ;
