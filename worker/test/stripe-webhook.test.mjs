// Stripe webhook (11/3): invoice.paid flips an invoice to paid within seconds instead of at the
// next hourly sweep. The event is only a nudge: the invoice is re-read from Stripe before anything
// changes. Also: a booking confirmation goes out once even if the webhook and /booked race.
// In-memory D1, fetch captured (Stripe answers come from `stripe`). Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { handleStripeWebhook, markPaid } from "../src/stripe.js";
import { loadSettings } from "../src/settings.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const S = { ...base, stripeMode: "live", ghlSmsUrl: "https://ghl.test/sms", ownerPhone: "8015550001", publicBaseUrl: "https://www.triplerdump.com" };
const SECRET = "whsec_test_123";

function db(invoices, bookings = []) {
  return { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    first: async function () {
      if (/FROM invoices WHERE stripe_invoice_id=\?1/.test(sql)) return invoices.find((r) => r.stripe_invoice_id === this._a[0]) || null;
      if (/FROM invoices WHERE id=\?1/.test(sql)) return invoices.find((r) => r.id === this._a[0]) || null;
      if (/FROM bookings WHERE id=\?1/.test(sql)) { const b = bookings.find((r) => r.id === this._a[0]); return b ? { ...b } : null; }
      return null;
    },
    all: async () => ({ results: [] }),
    run: async function () {
      const a = this._a;
      if (/UPDATE invoices SET status=\?1, paid_at=COALESCE/.test(sql)) {
        const r = invoices.find((x) => x.id === a[3]); r.status = a[0]; if (a[1]) r.paid_at = r.paid_at || a[1]; return { meta: { changes: 1 } };
      }
      if (/SET owner_paid_notified_at=\?1 WHERE id=\?2 AND owner_paid_notified_at IS NULL/.test(sql)) {
        const r = invoices.find((x) => x.id === a[1] && !x.owner_paid_notified_at); if (r) r.owner_paid_notified_at = a[0]; return { meta: { changes: r ? 1 : 0 } };
      }
      if (/UPDATE bookings SET status='paid'.*AND paid_at IS NULL/.test(sql)) {
        const r = bookings.find((x) => x.id === a[2] && !x.paid_at && x.status !== "paid"); if (r) { r.status = "paid"; r.paid_at = a[0]; } return { meta: { changes: r ? 1 : 0 } };
      }
      return { meta: { changes: 0 } };
    } }) };
}

async function signed(event, { secret = SECRET, t = Math.floor(Date.now() / 1000), extraV1 = [] } = {}) {
  const raw = JSON.stringify(event);
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(`${t}.${raw}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const header = [`t=${t}`, ...extraV1.map((v) => `v1=${v}`), `v1=${sig}`].join(",");
  return new Request("https://www.triplerdump.com/api/stripe-webhook", { method: "POST", body: raw, headers: { "stripe-signature": header } });
}
const paidEvent = (id) => ({ id: "evt_1", type: "invoice.paid", livemode: true, data: { object: { id, status: "paid" } } });
const trevor = (o) => ({ id: "TRD-INV-ZYXM2R", status: "sent", customer_name: "Trevor Hansen", company: "Ray White Roofing", phone: "8012095910",
  number: "IFDQ3KBA-0001", total_cents: 90999, stripe_invoice_id: "in_abc", paid_at: null, owner_paid_notified_at: null, ask_review: 0, ...o });

let sms = [], stripeCalls = [], stripe = "paid";
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  sms = []; stripeCalls = []; stripe = "paid";
  globalThis.fetch = async (url, o) => {
    url = String(url);
    if (url.startsWith("https://api.stripe.com/")) { stripeCalls.push(url); return new Response(JSON.stringify({ id: "in_abc", status: stripe, hosted_invoice_url: "https://pay.test/x" }), { status: 200 }); }
    sms.push(JSON.parse(o.body)); return new Response("{}", { status: 200 });
  };
});
test.after(() => { globalThis.fetch = realFetch; });
const env = (inv, bk) => ({ DB: db(inv, bk), STRIPE_SECRET_KEY_LIVE: "rk_live_x", STRIPE_WEBHOOK_SECRET_LIVE: SECRET });

test("invoice.paid: re-checks Stripe, marks paid, texts the owner once even if Stripe resends", async () => {
  const rows = [trevor()];
  const r = await handleStripeWebhook(env(rows), S, await signed(paidEvent("in_abc")));
  assert.equal(r.status, 200);
  assert.equal(stripeCalls.length, 1);
  assert.match(stripeCalls[0], /\/v1\/invoices\/in_abc$/);
  assert.equal(rows[0].status, "paid");
  assert.ok(rows[0].paid_at);
  assert.equal(sms.length, 1);
  assert.equal(sms[0].number, "+18015550001");
  assert.match(sms[0].message, /909\.99/);
  const again = await handleStripeWebhook(env(rows), S, await signed(paidEvent("in_abc")));
  assert.equal(again.status, 200);
  assert.equal(sms.length, 1);
});

test("an event that says paid while Stripe says open changes nothing", async () => {
  stripe = "open";
  const rows = [trevor()];
  const r = await handleStripeWebhook(env(rows), S, await signed(paidEvent("in_abc")));
  assert.equal(r.status, 200);
  assert.equal(rows[0].status, "sent");
  assert.equal(sms.length, 0);
});

test("bad, missing, stale or wrong-secret signatures are refused before anything is read", async () => {
  const rows = [trevor()];
  const e = env(rows);
  const noSig = new Request("https://x/api/stripe-webhook", { method: "POST", body: JSON.stringify(paidEvent("in_abc")) });
  assert.equal((await handleStripeWebhook(e, S, noSig)).status, 400);
  assert.equal((await handleStripeWebhook(e, S, await signed(paidEvent("in_abc"), { secret: "whsec_other" }))).status, 400);
  assert.equal((await handleStripeWebhook(e, S, await signed(paidEvent("in_abc"), { t: Math.floor(Date.now() / 1000) - 600 }))).status, 400);
  assert.equal((await handleStripeWebhook({ ...e, STRIPE_WEBHOOK_SECRET_LIVE: undefined }, S, await signed(paidEvent("in_abc")))).status, 400);
  assert.equal(stripeCalls.length, 0);
  assert.equal(rows[0].status, "sent");
  assert.equal(sms.length, 0);
});

test("a second v1 signature (Stripe rolling the secret) still verifies", async () => {
  const rows = [trevor()];
  const r = await handleStripeWebhook(env(rows), S, await signed(paidEvent("in_abc"), { extraV1: ["00".repeat(32)] }));
  assert.equal(r.status, 200);
  assert.equal(rows[0].status, "paid");
});

test("unknown invoices and other event types: 200, Stripe never called", async () => {
  const rows = [trevor()];
  assert.equal((await handleStripeWebhook(env(rows), S, await signed(paidEvent("in_not_ours")))).status, 200);
  assert.equal((await handleStripeWebhook(env(rows), S, await signed({ id: "evt_2", type: "customer.created", data: { object: { id: "cus_1" } } }))).status, 200);
  assert.equal(stripeCalls.length, 0);
  assert.equal(sms.length, 0);
});

test("invoice.voided syncs the void", async () => {
  stripe = "void";
  const rows = [trevor()];
  await handleStripeWebhook(env(rows), S, await signed({ id: "evt_3", type: "invoice.voided", data: { object: { id: "in_abc" } } }));
  assert.equal(rows[0].status, "void");
  assert.equal(sms.length, 0);
});

test("booking: webhook and /booked landing together send one confirmation", async () => {
  const bookings = [{ id: "TRD-ABC123", status: "pending", paid_at: null, phone: "8015550123", customer_name: "Pat", service_type: "dumpster",
    bin_size: "20", rental_tier: "1-3", delivery_date: "2026-11-10", pickup_date: "2026-11-13", amount_cents: 37625, deposit_cents: 0, address: "1 Main" }];
  const e = env([], bookings);
  const session = { id: "cs_live_1", client_reference_id: "TRD-ABC123", payment_status: "paid", payment_intent: "pi_1" };
  await Promise.all([
    handleStripeWebhook(e, S, await signed({ id: "evt_4", type: "checkout.session.completed", data: { object: session } })),
    markPaid(e, S, "TRD-ABC123", session),
  ]);
  assert.equal(bookings[0].status, "paid");
  const toCustomer = sms.filter((m) => m.number === "+18015550123");
  assert.equal(toCustomer.length, 1);
  assert.equal(sms.filter((m) => m.number === "+18015550001").length, 1);
});
