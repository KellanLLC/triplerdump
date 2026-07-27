-- Triple R Dump - bookings store (Cloudflare D1 / SQLite)
-- Already applied to the live DB; kept here as source of truth.

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,                 -- booking ref, e.g. TRD-7QK4M2
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending|confirmed|paid|cancelled|completed
  account_type TEXT NOT NULL DEFAULT 'residential', -- residential|commercial
  service_type TEXT NOT NULL DEFAULT 'dumpster',    -- dumpster|trailer|junk|binswitch

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
  deposit_cents INTEGER,               -- refundable deposit (trailer); untaxed, not in amount
  payment_type TEXT,                   -- checkout|invoice
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  paid_at TEXT,
  confirmation_sms_sent_at TEXT,
  review_sms_sent_at TEXT,
  reminder_sent_at TEXT,               -- set by the nightly reminder sweep
  review_token TEXT,                   -- minted by the review sweep; powers /r/<token>
  review_rating INTEGER,               -- 1-5, captured on the review landing
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookings_delivery ON bookings(delivery_date);
CREATE INDEX IF NOT EXISTS idx_bookings_pickup   ON bookings(pickup_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_review   ON bookings(pickup_date, review_sms_sent_at);

-- Review funnel ratings/feedback (one row per rating; re-rating replaces by booking_id).
-- Written by reviewpage.js (handleReviewRate / handleReviewFeedback). Was live in D1 but
-- previously missing from this file.
CREATE TABLE IF NOT EXISTS reviews (
  booking_id TEXT NOT NULL,
  rating     INTEGER,                  -- 1-5 stars
  routed_to  TEXT,                     -- google|feedback|both (where the rater was sent)
  feedback   TEXT,                     -- private free-text (low ratings / "anything else")
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);

-- Powers /r/<token> review-landing lookups (review_token). Live in prod; kept here too.
CREATE INDEX IF NOT EXISTS idx_bookings_token ON bookings(review_token);

-- CMS overrides: one row per setting key -> JSON value, layered over code defaults by
-- src/settings.js (loadSettings). saveSetting() upserts here. This table is REQUIRED for
-- the admin CMS to persist edits; it was live in prod but previously missing from this file,
-- so a from-scratch rebuild would break every /admin save.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,               -- JSON-encoded (parsed by loadSettings)
  updated_at TEXT
);

-- Invoices (added 2026-07-27). Joseph bills a customer with his OWN line items, his
-- OWN due date, and late-fee terms printed at the bottom. Separate from bookings on
-- purpose: commercial jobs never go through the booking form, so booking_id is
-- nullable. `terms` is SNAPSHOTTED per invoice -- editing the CMS terms later must
-- not retroactively change what a customer already agreed to.
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,             -- TRD-INV-XXXXXX
  created_at TEXT NOT NULL,
  booking_id TEXT,                 -- optional link to bookings.id
  customer_name TEXT NOT NULL,
  phone TEXT, email TEXT, company TEXT,
  line_items TEXT,                 -- JSON [{description, qty, unit_cents}]
  subtotal_cents INTEGER, tax_cents INTEGER, total_cents INTEGER,
  due_date TEXT,                   -- YYYY-MM-DD
  status TEXT,                     -- draft|sent|paid|void
  terms TEXT,                      -- footer text exactly as sent
  stripe_invoice_id TEXT, stripe_customer_id TEXT,
  number TEXT,                     -- Stripe's human invoice no.
  hosted_url TEXT, pdf_url TEXT,
  sent_at TEXT, paid_at TEXT, notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices(status);
