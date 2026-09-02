-- Phase 9: expiring pending_shop during OAuth. Permanent tenant bind is install-only.
-- Recovery: copy checkout/session shop onto pending_shop when that shop has no
-- completed Shopify installation, so a subscriber can replace a failed first attempt
-- without opening another Stripe Checkout.
-- Rollback: see 008_shop_binding.down.sql

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS pending_shop TEXT;

ALTER TABLE app_sessions
  ADD COLUMN IF NOT EXISTS pending_shop_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS app_sessions_pending_shop_idx
  ON app_sessions (pending_shop)
  WHERE pending_shop IS NOT NULL AND revoked_at IS NULL;

-- Safe recovery for sessions bound to a shop that never finished OAuth/install.
UPDATE app_sessions AS sessions
SET
  pending_shop = sessions.shop,
  pending_shop_expires_at = NOW() + INTERVAL '7 days',
  updated_at = NOW()
WHERE sessions.revoked_at IS NULL
  AND sessions.expires_at > NOW()
  AND (
    sessions.pending_shop IS NULL
    OR sessions.pending_shop_expires_at IS NULL
    OR sessions.pending_shop_expires_at <= NOW()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM shops
    JOIN shopify_sessions ON shopify_sessions.shop = shops.shop
    WHERE shops.shop = sessions.shop
      AND shops.uninstalled_at IS NULL
      AND shopify_sessions.revoked_at IS NULL
      AND shopify_sessions.encrypted_access_token <> ''
  );
