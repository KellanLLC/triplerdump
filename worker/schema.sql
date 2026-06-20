-- Triple R Dump - bookings store (Cloudflare D1 / SQLite)
-- Already applied to the live DB; kept here as source of truth.

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,                 -- booking ref, e.g. TRD-7QK4M2
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending|confirmed|paid|cancelled|completed
  account_type TEXT NOT NULL DEFAULT 'residential', -- residential|commercial

  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  message TEXT,

  bin_size TEXT NOT NULL,              -- 15|20|25
  rental_tier TEXT,                    -- 1-3|4-7
  delivery_date TEXT NOT NULL,         -- YYYY-MM-DD
  delivery_time TEXT,                  -- optional preferred time
  pickup_date TEXT NOT NULL,           -- delivery + tier maxDays
  rental_days INTEGER NOT NULL,

  address TEXT NOT NULL,               -- drop-off address
  pickup_address TEXT,                 -- defaults to drop-off
  ground_condition TEXT,               -- driveway/street/dirt/gravel/other
  permit_needed INTEGER,               -- 0/1
  permit_obtainable TEXT,
  agreed_terms INTEGER,                -- 0/1

  subtotal_cents INTEGER,
  tax_cents INTEGER,
  amount_cents INTEGER,                -- subtotal + tax
  payment_type TEXT,                   -- checkout|invoice
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  paid_at TEXT,
  confirmation_sms_sent_at TEXT,
  review_sms_sent_at TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_delivery ON bookings(delivery_date);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup   ON bookings(pickup_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_review   ON bookings(pickup_date, review_sms_sent_at);
