-- 0010 (2026-10-26): the Pull Count console (admin.triplerdump.com) writes the day's jobs here through
-- /api/console (src/console-api.js). Additive only: /admin and every existing query ignore these.
ALTER TABLE bookings ADD COLUMN delivered_at TEXT;   -- when the bin was set down (the console's "Dropped off")
ALTER TABLE bookings ADD COLUMN bin_no TEXT;         -- which bin, as stenciled on it: "20-001"
ALTER TABLE bookings ADD COLUMN completed_at TEXT;   -- when it was picked up
ALTER TABLE bookings ADD COLUMN weight_tons REAL;    -- the scale weight, kept for the records (never billed)
-- every change the console makes: who, what, when
CREATE TABLE IF NOT EXISTS console_log (
  id       TEXT PRIMARY KEY,
  at       TEXT NOT NULL,
  by_user  TEXT,
  role     TEXT,       -- owner | driver
  action   TEXT NOT NULL,
  target   TEXT,       -- booking or invoice id
  detail   TEXT        -- JSON
);
CREATE INDEX IF NOT EXISTS idx_console_log_target ON console_log(target, at);
