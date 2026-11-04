-- 0012 (2026-10-29): the final notice. One text per unpaid invoice, invoiceFinalNoticeDays (60) after
-- the due date, saying small claims is next (Joseph 10/29). Invoices already unpaid when it shipped
-- count their 60 days from 10/29, his pick: "60 days from now, since we're just about to implement it".
ALTER TABLE invoices ADD COLUMN final_notice_date TEXT;             -- YYYY-MM-DD it goes out, at the reminder hour
ALTER TABLE invoices ADD COLUMN final_notice_off INTEGER DEFAULT 0; -- 1 = switched off for this invoice in the console
ALTER TABLE invoices ADD COLUMN final_notice_sent_at TEXT;
UPDATE invoices SET final_notice_date = '2026-12-28' WHERE status = 'sent';
