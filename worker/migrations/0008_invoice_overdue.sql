-- 2026-09-24: late-payment texts for invoices past their due date.
ALTER TABLE invoices ADD COLUMN overdue_reminders_sent INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN overdue_last_sent_at TEXT;
ALTER TABLE invoices ADD COLUMN overdue_owner_alerted_at TEXT;
