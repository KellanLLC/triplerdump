-- 2026-09-24: owner text when an invoice is paid + review ask for paid invoices.
-- Review columns mirror bookings.review_* so review.js can treat either table as
-- a review "subject". ask_review defaults 0: invoices created before this feature
-- never get a surprise review text; the New Invoice checkbox sets it to 1.
ALTER TABLE invoices ADD COLUMN ask_review INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN owner_paid_notified_at TEXT;
ALTER TABLE invoices ADD COLUMN review_checked_at TEXT;
ALTER TABLE invoices ADD COLUMN review_token TEXT;
ALTER TABLE invoices ADD COLUMN review_sms_sent_at TEXT;
ALTER TABLE invoices ADD COLUMN review_rating INTEGER;
ALTER TABLE invoices ADD COLUMN review_step INTEGER;
ALTER TABLE invoices ADD COLUMN review_next_due_at TEXT;
ALTER TABLE invoices ADD COLUMN review_stopped_at TEXT;
ALTER TABLE invoices ADD COLUMN review_stop_reason TEXT;
ALTER TABLE invoices ADD COLUMN review_clicked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_review_token ON invoices(review_token);
-- Backfill: every invoice already paid counts as notified, so the first sweep
-- after deploy doesn't text the owner about months-old payments.
UPDATE invoices SET owner_paid_notified_at = COALESCE(paid_at, created_at) WHERE status = 'paid';
