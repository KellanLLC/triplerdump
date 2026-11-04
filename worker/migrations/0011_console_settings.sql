-- 0011 (2026-10-27): the Pull Count console's add-ons and "what's going in it" on the booking form.
-- Additive; every INSERT names its columns.
ALTER TABLE bookings ADD COLUMN addons TEXT;   -- JSON [{k, label, cents}] paid with the booking
ALTER TABLE bookings ADD COLUMN debris TEXT;   -- what they said is going in it
