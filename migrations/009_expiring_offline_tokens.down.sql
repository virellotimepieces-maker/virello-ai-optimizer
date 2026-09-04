ALTER TABLE shopify_sessions DROP COLUMN IF EXISTS refresh_token_expires_at;
ALTER TABLE shopify_sessions DROP COLUMN IF EXISTS access_token_expires_at;
ALTER TABLE shopify_sessions DROP COLUMN IF EXISTS encrypted_refresh_token;
