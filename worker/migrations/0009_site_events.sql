-- 2026-10-08: anonymous website activity for the admin "Website activity" card.
-- One row per page view or Book / Call / Text tap. No cookies, no IP, no
-- personal data: just what happened, on which page, when.
CREATE TABLE IF NOT EXISTS site_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT
);
CREATE INDEX IF NOT EXISTS idx_site_events_ts ON site_events (ts);
