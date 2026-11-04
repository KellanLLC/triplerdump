// A price Joseph sets himself on a phone booking (10/27: concrete only, $220 + $60 dump).
// The console can (S.ownerBooking); /book can't. Mocked D1; no network. Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBooking } from "../src/booking.js";
import { loadSettings } from "../src/settings.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
// no distance lookups, no Stripe: what's left is the pricing and the INSERT
const S = { ...base, serviceRadiusMiles: 0, fuelMile: { free: 30, cents: 0 }, requirePayment: false, webhookUrl: "", ghlWebhookUrl: "" };
const owner = { ...S, leadHours: 0, sameDayCutoff: "", closedDates: {}, runDays: [0, 1, 2, 3, 4, 5, 6], ownerBooking: true };

function env() {
  const inserts = [];
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { if (/INSERT INTO bookings/.test(sql)) inserts.push(this._a); return { meta: {} }; },
    all: async () => ({ results: [] }), first: async () => null }) };
  return { inserts, DB };
}
const day = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const input = (extra) => ({ account_type: "residential", service_type: "dumpster", bin_size: "20", rental_tier: "4-7", delivery_date: day,
  delivery_time: "Morning", address: "3539 S 4250 W, West Haven, UT 84401", ground_condition: S.groundConditions[0], permit_needed: "no",
  first_name: "Test", last_name: "Concrete", phone: "8015550100", email: "test@example.com", agreed_terms: true, sms_consent: false, ...extra });

const realFetch = globalThis.fetch;
test.before(() => { globalThis.fetch = async () => new Response("{}", { status: 200 }); });
test.after(() => { globalThis.fetch = realFetch; });

test("console booking: his price replaces the price list, tax on top, noted on the job", async () => {
  const e = env();
  const r = await createBooking(e, owner, input({ price_cents: 28000 }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, 28000);
  assert.equal(r.totals.tax_cents, Math.round(28000 * S.taxRate));
  assert.equal(r.totals.amount_cents, 28000 + Math.round(28000 * S.taxRate));
  const row = e.inserts[0];
  assert.ok(row.includes(28000), "subtotal stored");
  assert.ok(row.some((v) => /^Custom price \$280\.00 before tax \(price list \$\d+\.\d\d\)$/.test(String(v))), "note on the booking");
});

test("console booking without a price: the price list, as before", async () => {
  const r = await createBooking(env(), owner, input({ price_cents: "" }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, S.bins["20"].prices["4-7"]);
});

test("console booking: a nonsense price is refused, nothing booked", async () => {
  for (const bad of [-100, 2000000, "abc"]) {
    const e = env();
    const r = await createBooking(e, owner, input({ price_cents: bad }));
    assert.equal(r.ok, false, String(bad));
    assert.equal(e.inserts.length, 0);
  }
});

test("/book: a customer can't set the price", async () => {
  const r = await createBooking(env(), S, input({ price_cents: 100 }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, S.bins["20"].prices["4-7"]);
});
