-- Phase 6: per-shop interface and product-output locales.
-- Rollback: see 006_phase6_locales.down.sql

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS ui_locale TEXT;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS output_locale TEXT;
