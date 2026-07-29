-- Review follow-up ladder (2026-07-29), modelled on the Kronos Electric system.
-- The first ask stays owner-triggered (mark picked up / completed). These columns
-- drive the chase afterwards: +24h, +24h, +48h, then stop for good.
--
-- review_step         how many follow-ups have gone out (0-3)
-- review_next_due_at  when the next one fires; NULL once the ladder is stopped
-- review_stopped_at   when it ended
-- review_stop_reason  clicked | rated | exhausted
-- review_clicked_at   first tap on /r/<token> — the strongest "heard you" signal
--
-- Applied to the live D1 (triplerdump_bookings) on 2026-07-29.
ALTER TABLE bookings ADD COLUMN review_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN review_next_due_at TEXT;
ALTER TABLE bookings ADD COLUMN review_stopped_at TEXT;
ALTER TABLE bookings ADD COLUMN review_stop_reason TEXT;
ALTER TABLE bookings ADD COLUMN review_clicked_at TEXT;

-- The sweep reads exactly this: rows still running, with a follow-up due.
CREATE INDEX IF NOT EXISTS idx_bookings_review_due ON bookings (review_next_due_at)
  WHERE review_stopped_at IS NULL;
