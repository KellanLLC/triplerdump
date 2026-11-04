// The fuel charge on bookings Joseph takes by phone (10/30: "When I book the appointment it doesn't
// add the fuel charge for addresses farther than 30 miles"). Mocked D1; the Census lookup is mocked
// to find nothing, so the distance comes from the town the address ends with (src/places.js).
// Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBooking, fuelQuote } from "../src/booking.js";
import { loadSettings } from "../src/settings.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const S = { ...base, serviceRadiusMiles: 88, fuelMile: { free: 30, base: 4000, cents: 100 }, requirePayment: false, webhookUrl: "", ghlWebhookUrl: "" };
// what console-api.js "book" passes in
const owner = (s) => ({ ...s, leadHours: 0, sameDayCutoff: "", closedDates: {}, runDays: [0, 1, 2, 3, 4, 5, 6], ownerBooking: true });

function env() {
  const inserts = [];
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { if (/INSERT INTO bookings/.test(sql)) inserts.push(this._a); return { meta: {} }; },
    all: async () => ({ results: [] }), first: async () => null }) };
  return { inserts, DB };
}
const day = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
const DRAPER = "12300 S Minuteman Dr, Draper, UT";   // the town: 50 miles out: $40 + 20 past 30 at $1 = $60
const ROY = "5600 S 3500 W, Roy, UT";                 // about 3 miles: none
const input = (address, extra) => ({ account_type: "residential", service_type: "dumpster", bin_size: "20", rental_tier: "4-7", delivery_date: day,
  delivery_time: "Morning", address, ground_condition: S.groundConditions[0], permit_needed: "no",
  first_name: "Test", last_name: "Fuel", phone: "8015550100", email: "test@example.com", agreed_terms: true, sms_consent: false, ...extra });
const list = base.bins["20"].prices["4-7"];
const addonsOf = (e) => { const v = e.inserts[0].find((x) => typeof x === "string" && x.startsWith("[{")); return v ? JSON.parse(v) : []; };

const realFetch = globalThis.fetch;
test.before(() => { globalThis.fetch = async () => new Response("{}", { status: 200 }); });
test.after(() => { globalThis.fetch = realFetch; });

test("phone booking 50 miles out: $40 + $1 a mile past 30 goes on, taxed, as its own line", async () => {
  const e = env();
  const r = await createBooking(e, owner(S), input(DRAPER));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, list + 6000);
  assert.equal(r.totals.amount_cents, list + 6000 + Math.round((list + 6000) * S.taxRate));
  assert.deepEqual(addonsOf(e), [{ k: "fuel", label: "Fuel charge ($40 + 20 miles × $1)", cents: 6000 }]);
});

test("phone booking inside 30 miles: no fuel charge", async () => {
  const e = env();
  const r = await createBooking(e, owner(S), input(ROY));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, list);
  assert.deepEqual(addonsOf(e), []);
});

test("he can waive it on one (no_fuel); the website can't", async () => {
  const e = env();
  const r = await createBooking(e, owner(S), input(DRAPER, { no_fuel: true }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, list);
  assert.deepEqual(addonsOf(e), []);
  const e2 = env();
  const r2 = await createBooking(e2, S, input(DRAPER, { no_fuel: true }));
  assert.equal(r2.ok, true, JSON.stringify(r2.errors));
  assert.equal(r2.totals.subtotal_cents, list + 6000);
});

test("his own price for the job: fuel still goes on top, like the extras", async () => {
  const e = env();
  const r = await createBooking(e, owner(S), input(DRAPER, { price_cents: 28000 }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.totals.subtotal_cents, 28000 + 6000);
});

test("past the delivery radius: the website refuses, a phone booking goes through with the fuel charge", async () => {
  const near = { ...S, serviceRadiusMiles: 40 };
  const r = await createBooking(env(), near, input(DRAPER));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /outside our delivery area/);
  const e = env();
  const r2 = await createBooking(e, owner(near), input(DRAPER));
  assert.equal(r2.ok, true, JSON.stringify(r2.errors));
  assert.equal(addonsOf(e)[0].cents, 6000);
});

test("the console's quote is the same answer the booking charges", async () => {
  const q = await fuelQuote(S, DRAPER, true);
  assert.equal(q.known, true);
  assert.equal(q.miles, 50);
  assert.equal(q.cents, 6000);
  assert.equal(q.label, "Fuel charge ($40 + 20 miles × $1)");
  assert.equal((await fuelQuote(S, ROY, true)).cents, 0);
  // past the radius: /book's check prices nothing (it refuses); his still does
  const near = { ...S, serviceRadiusMiles: 40 };
  assert.equal((await fuelQuote(near, DRAPER)).cents, 0);
  const o = await fuelQuote(near, DRAPER, true);
  assert.equal(o.far, true);
  assert.equal(o.cents, 6000);
});

// the console's own door (console-api.js): the quote route, and a phone booking with the charge waived
import { consoleApi } from "../src/console-api.js";
function apiEnv() {
  const e = env();
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { if (/INSERT INTO bookings/.test(sql)) e.inserts.push(this._a); return { meta: {} }; },
    all: async () => ({ results: /FROM settings$/.test(sql.trim()) ? [{ key: "service_radius_miles", value: "88" }] : [] }),
    first: async () => (/FROM bookings WHERE id/.test(sql) ? { id: "x", customer_name: "Test Fuel", subtotal_cents: 0, addons: null } : null) }) };
  return { inserts: e.inserts, DB, CONSOLE_API_KEY: "k" };
}
const call = (e, path, body, role = "owner") => consoleApi(new Request("https://www.triplerdump.com/api/console/" + path, { method: "POST",
  headers: { "content-type": "application/json", "x-console-key": "k", "x-console-user": "Joseph", "x-console-role": role }, body: JSON.stringify(body) }), e, new URL("https://www.triplerdump.com/api/console/" + path));

test("POST /api/console/fuel prices the address; drivers can't", async () => {
  const r = await (await call(apiEnv(), "fuel", { address: DRAPER })).json();
  assert.equal(r.known, true);
  assert.equal(r.cents, 6000);
  assert.equal((await call(apiEnv(), "fuel", { address: DRAPER }, "driver")).status, 403);
});

test("POST /api/console/book: fuel on by default, off with no_fuel", async () => {
  const body = { customer_name: "Test Fuel", phone: "8015550100", email: "", address: DRAPER, service_type: "dumpster", bin_size: "20", rental_tier: "4-7",
    delivery_date: day, pay: "cash", sms_consent: false };
  const e = apiEnv();
  const r = await (await call(e, "book", body)).json();
  assert.equal(r.ok, true, r.error);
  assert.equal(r.totals.subtotal_cents, list + 6000);
  const e2 = apiEnv();
  const r2 = await (await call(e2, "book", { ...body, no_fuel: true })).json();
  assert.equal(r2.ok, true, r2.error);
  assert.equal(r2.totals.subtotal_cents, list);
});

test("POST /api/console/settings saves the free miles and the rate a mile; out of range refused", async () => {
  const puts = [];
  const e = apiEnv();
  const DB0 = e.DB;
  e.DB = { prepare: (sql) => { const st = DB0.prepare(sql); const run = st.run; st.run = async function () { if (/INSERT INTO settings|INSERT OR REPLACE INTO settings|ON CONFLICT/.test(sql)) puts.push(this._a); return run.call(this); }; return st; } };
  const r = await (await call(e, "settings", { fuelMile: { free: 25, base: 35, rate: 1.5 } })).json();
  assert.equal(r.ok, true, r.error);
  assert.ok(puts.some((a) => a[0] === "fuel_per_mile" && a[1] === JSON.stringify({ free: 25, base: 3500, cents: 150 })), JSON.stringify(puts));
  // a console tab from before the starting charge: base left out, so the stored one (or the $40 default) stays
  puts.length = 0;
  assert.equal((await (await call(e, "settings", { fuelMile: { free: 30, rate: 1 } })).json()).ok, true);
  assert.ok(puts.some((a) => a[0] === "fuel_per_mile" && a[1] === JSON.stringify({ free: 30, cents: 100 })), JSON.stringify(puts));
  assert.match((await (await call(apiEnv(), "settings", { fuelMile: { free: 30, base: 600, rate: 1 } })).json()).error, /\$500/);
  assert.match((await (await call(apiEnv(), "settings", { fuelMile: { free: 25, rate: 40 } })).json()).error, /\$25 a mile/);
  assert.match((await (await call(apiEnv(), "settings", { fuelMile: { free: -1, rate: 1 } })).json()).error, /Free miles/);
});
