-- Migration 0002: review-funnel + reminder bookkeeping columns.
-- Adds review_token, review_rating, reminder_sent_at.
--
-- IMPORTANT - PRODUCTION ALREADY HAS THESE COLUMNS.
-- The current remote `triplerdump_bookings` table already contains
-- review_token, review_rating and reminder_sent_at (they predate this file;
-- schema.sql had simply failed to record them). DO NOT apply this migration
-- to --remote: SQLite's ADD COLUMN has no IF NOT EXISTS, so it would error
-- with "duplicate column name".
--
-- This file exists so a database rebuilt from an OLDER schema.sql (e.g. a
-- fresh --local/dev DB) can be brought to parity with production and the
-- committed schema.sql. Run it EXACTLY ONCE on such a database.
--
-- Apply LOCAL only (after 0001_services.sql):
--   cd worker && npx wrangler d1 execute triplerdump_bookings --local --file=migrations/0002_review_reminder.sql

ALTER TABLE bookings ADD COLUMN reminder_sent_at TEXT;
ALTER TABLE bookings ADD COLUMN review_token TEXT;
ALTER TABLE bookings ADD COLUMN review_rating INTEGER;
