-- Promo / discount codes on bookings (2026-08-25).
-- promo_code = the code the customer used, normalized uppercase (NULL = none).
-- discount_cents = dollars off the PRE-TAX subtotal; tax was computed on the
-- discounted amount, so amount_cents already reflects both.
ALTER TABLE bookings ADD COLUMN promo_code TEXT;
ALTER TABLE bookings ADD COLUMN discount_cents INTEGER;
