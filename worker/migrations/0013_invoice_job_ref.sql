-- 0013 (2026-10-30): the job / work order line on an invoice (Joseph 10/30). Contractors like Utah
-- Roofing Consultants match each bill to a house by it, usually the homeowner's last name and address.
-- It goes to Stripe as a custom field (printed in the invoice header); this keeps a copy for /admin + the console.
ALTER TABLE invoices ADD COLUMN job_ref TEXT;
