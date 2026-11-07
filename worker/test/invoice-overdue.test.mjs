// Late-payment texts (11/06, Joseph: "every 48hrs until they pay"): every 48 hours past due, no limit; after 5 the
// owner also gets ONE "worth a call" text; no phone = owner told once, nothing more. In-memory invoices, fetch
// captured (no Stripe key, so Stripe is never called). Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInvoiceOverdueReminders } from "../src/invoice.js";
import { loadSettings } from "../src/settings.js";
import { todayISO, addDays } from "../src/util.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const S = { ...base, ghlSmsUrl: "https://ghl.test/sms", ownerPhone: "8015550001", publicBaseUrl: "https://www.triplerdump.com" };
const today = todayISO(S.business.timezone);
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();

// Just enough of D1: the overdue SELECT (same filters as the SQL), row lookups and the two UPDATEs.
function db(rows) {
  return { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    all: async function () {
      assert.match(sql, /\(overdue_owner_alerted_at IS NULL OR COALESCE\(phone, ''\) <> ''\)/);
      const [day, cutoff] = this._a;
      return { results: rows.filter((r) => r.status === "sent" && r.due_date && r.due_date < day && (!r.overdue_owner_alerted_at || r.phone) &&
        (!r.overdue_last_sent_at || r.overdue_last_sent_at <= cutoff)).map((r) => ({ id: r.id })) };
    },
    first: async function () { return rows.find((r) => r.id === this._a[0]) || null; },
    run: async function () {
      const a = this._a;
      if (/overdue_reminders_sent=COALESCE/.test(sql)) { const r = rows.find((x) => x.id === a[1]); r.overdue_reminders_sent = (r.overdue_reminders_sent || 0) + 1; r.overdue_last_sent_at = a[0]; }
      else if (/SET overdue_owner_alerted_at=\?1/.test(sql)) rows.find((x) => x.id === a[1]).overdue_owner_alerted_at = a[0];
      return { meta: { changes: 1 } };
    } }) };
}
const inv = (o) => ({ id: "TRD-INV-57M9N9", status: "sent", customer_name: "Ray Epps", phone: "8015550199", number: "2X01CXZN-0001",
  total_cents: 118130, due_date: addDays(today, -28), overdue_reminders_sent: 0, overdue_last_sent_at: null, overdue_owner_alerted_at: null, ...o });

let sent = [];
const realFetch = globalThis.fetch;
test.beforeEach(() => { sent = []; globalThis.fetch = async (url, o) => { sent.push(o && o.body ? JSON.parse(o.body) : null); return new Response("{}", { status: 200 }); }; });
test.after(() => { globalThis.fetch = realFetch; });

test("past the old 5-text stop: Ray (owner already told) gets text 6, and no second owner text", async () => {
  const rows = [inv({ overdue_reminders_sent: 5, overdue_last_sent_at: hoursAgo(19 * 24), overdue_owner_alerted_at: hoursAgo(17 * 24) })];
  const r = await runInvoiceOverdueReminders({ DB: db(rows) }, S);
  assert.deepEqual([r.sent, r.alerted, sent.length], [1, 0, 1]);
  assert.equal(sent[0].number, "+18015550199");
  assert.match(sent[0].message, /^Hi Ray, a reminder from Triple R Dump: invoice 2X01CXZN-0001/);
  assert.equal(rows[0].overdue_reminders_sent, 6);
});

test("the 5th text also tells the owner once; the 6th goes 48 hours later; 47 hours is too soon", async () => {
  const rows = [inv({ overdue_reminders_sent: 4, overdue_last_sent_at: hoursAgo(48) })];
  const r = await runInvoiceOverdueReminders({ DB: db(rows) }, S);
  assert.deepEqual([r.sent, r.alerted, sent.length], [1, 1, 2]);
  assert.equal(sent[1].number, "+18015550001");
  assert.match(sent[1].message, /^Ray Epps still hasn't paid invoice 2X01CXZN-0001 .* after 5 reminder texts\. Worth a call/);
  rows[0].overdue_last_sent_at = hoursAgo(45);
  assert.equal((await runInvoiceOverdueReminders({ DB: db(rows) }, S)).sent, 0);
  rows[0].overdue_last_sent_at = hoursAgo(48);
  const again = await runInvoiceOverdueReminders({ DB: db(rows) }, S);
  assert.deepEqual([again.sent, again.alerted, rows[0].overdue_reminders_sent], [1, 0, 6]);
});

test("no phone: the owner is told once, then nothing; not due yet or paid: nothing", async () => {
  const rows = [inv({ id: "TRD-INV-NOPH", phone: "" }), inv({ id: "TRD-INV-SOON", due_date: today }), inv({ id: "TRD-INV-PAID", status: "paid" })];
  const r = await runInvoiceOverdueReminders({ DB: db(rows) }, S);
  assert.deepEqual([r.sent, r.alerted, sent.length], [0, 1, 1]);
  assert.match(sent[0].message, /after 0 reminder texts/);
  const again = await runInvoiceOverdueReminders({ DB: db(rows) }, S);
  assert.deepEqual([again.due, again.alerted, sent.length], [0, 0, 1]);
});
