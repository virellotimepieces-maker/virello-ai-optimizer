-- Rollback for 006_phase6_locales.sql

ALTER TABLE shops DROP COLUMN IF EXISTS output_locale;
ALTER TABLE shops DROP COLUMN IF EXISTS ui_locale;

DELETE FROM schema_migrations WHERE version = '006_phase6_locales';
