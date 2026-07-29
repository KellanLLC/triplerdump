-- Pickup reminders (2026-07-28).
-- Customer gets a text the day BEFORE pickup (time to call and extend);
-- the owner gets a text the MORNING OF each pickup. Admin "Update pickup date"
-- clears both flags so the reminders re-arm for the new date.
-- Applied to the live D1 (triplerdump_bookings) on 2026-07-28.
ALTER TABLE bookings ADD COLUMN pickup_reminder_sent_at TEXT;
ALTER TABLE bookings ADD COLUMN owner_pickup_reminder_sent_at TEXT;
