-- 0005: day-after-pickup "close the job" nudge to the owner. One text per booking
-- for any confirmed/paid job whose pickup date has passed without being marked
-- completed (marking completed is what fires the customer review text).
ALTER TABLE bookings ADD COLUMN owner_complete_nudge_sent_at TEXT;
