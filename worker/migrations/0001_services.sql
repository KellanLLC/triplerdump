-- Migration 0001: make bookings service-aware (dumpster | trailer | junk | binswitch).
-- Adds service_type (defaults to 'dumpster' so existing rows/links keep working)
-- and deposit_cents (refundable trailer deposit; untaxed, NOT included in amount_cents).
--
-- NOTE: SQLite's ALTER TABLE ... ADD COLUMN does NOT support IF NOT EXISTS.
-- Run this migration EXACTLY ONCE per database. Re-running will error with
-- "duplicate column name" (that error is safe to ignore if the columns exist).
--
-- Apply LOCAL only for testing:
--   cd worker && npx wrangler d1 execute triplerdump_bookings --local --file=migrations/0001_services.sql
-- (Do NOT run with --remote here; the production migration is handled separately.)

ALTER TABLE bookings ADD COLUMN service_type TEXT NOT NULL DEFAULT 'dumpster';
ALTER TABLE bookings ADD COLUMN deposit_cents INTEGER;
