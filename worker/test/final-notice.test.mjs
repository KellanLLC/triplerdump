// The final notice (10/29): one text, 60 days past due, small claims next; Joseph can switch it off.
// In-memory invoices table, fetch captured (no Stripe key, so Stripe is never called). Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInvoiceFinalNotices, setFinalNotice, createInvoice } from "../src/invoice.js";
import { loadSettings } from "../src/settings.js";
import { todayISO, addDays } from "../src/util.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const S = { ...base, ghlSmsUrl: "https://ghl.test/sms", ownerPhone: "8015550001", publicBaseUrl: "https://www.triplerdump.com" };
const today = todayISO(S.business.timezone);

// Just enough of D1 for invoice.js: the final-notice SELECT, row lookups, the claim and the switch.
function db(rows) {
  return { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    all: async function () {
      if (/final_notice_date <= \?1/.test(sql)) return { results: rows.filter((r) => r.status === "sent" && r.final_notice_date && r.final_notice_date <= this._a[0] && !r.final_notice_off && !r.final_notice_sent_at && r.phone).map((r) => ({ id: r.id })) };
      return { results: [] };
    },
    first: async function () { return rows.find((r) => r.id === this._a[0]) || null; },
    run: async function () {
      const a = this._a;
      if (/SET final_notice_sent_at=\?1 WHERE id=\?2 AND final_notice_sent_at IS NULL/.test(sql)) {
        const r = rows.find((x) => x.id === a[1] && !x.final_notice_sent_at); if (r) r.final_notice_sent_at = a[0];
        return { meta: { changes: r ? 1 : 0 } };
      }
      if (/SET final_notice_sent_at=NULL/.test(sql)) { rows.find((x) => x.id === a[0]).final_notice_sent_at = null; return { meta: { changes: 1 } }; }
      if (/SET final_notice_off=\?1, final_notice_date=\?2/.test(sql)) { Object.assign(rows.find((x) => x.id === a[2]), { final_notice_off: a[0], final_notice_date: a[1] }); return { meta: { changes: 1 } }; }
      if (/INSERT INTO invoices/.test(sql)) { rows.push({ insert: a }); return { meta: { changes: 1 } }; }
      return { meta: { changes: 0 } };
    } }) };
}
const ray = (o) => ({ id: "TRD-INV-57M9N9", status: "sent", customer_name: "Ray Epps", phone: "8015550199", number: "2X01CXZN-0001",
  total_cents: 118130, due_date: addDays(today, -80), final_notice_date: today, final_notice_off: 0, final_notice_sent_at: null, stripe_invoice_id: "in_1", ...o });

let sent = [], answer = 200;
const realFetch = globalThis.fetch;
test.beforeEach(() => { sent = []; answer = 200; globalThis.fetch = async (url, o) => { sent.push({ url: String(url), body: o && o.body ? JSON.parse(o.body) : null }); return new Response("{}", { status: answer }); }; });
test.after(() => { globalThis.fetch = realFetch; });

test("on its date: one text to the customer, a copy to the owner, never twice", async () => {
  const rows = [ray()];
  const r = await runInvoiceFinalNotices({ DB: db(rows) }, S);
  assert.equal(r.sent, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].body.number, "+18015550199");
  assert.match(sent[0].body.message, /^Final notice from Triple R Dump: Ray, invoice 2X01CXZN-0001 for \$1181\.30 is 80 days past due\. If it stays unpaid, we will file in small claims court/);
  assert.match(sent[0].body.message, /late charge \(1\.5% a month\) plus collection and court costs\. Pay here: https:\/\/www\.triplerdump\.com\/inv\/TRD-INV-57M9N9/);
  assert.doesNotMatch(sent[0].body.message, /\{|attorney/);
  assert.equal(sent[1].body.number, "+18015550001");
  assert.match(sent[1].body.message, /^Final notice texted to Ray Epps for invoice 2X01CXZN-0001/);
  assert.ok(rows[0].final_notice_sent_at);
  const again = await runInvoiceFinalNotices({ DB: db(rows) }, S);
  assert.equal(again.sent, 0);
  assert.equal(sent.length, 2);
});

test("not yet, switched off, paid, or no mobile: nothing goes out", async () => {
  const rows = [ray({ final_notice_date: addDays(today, 1) }), ray({ id: "TRD-INV-OFF", final_notice_off: 1 }),
    ray({ id: "TRD-INV-PAID", status: "paid" }), ray({ id: "TRD-INV-NOPH", phone: "" })];
  const r = await runInvoiceFinalNotices({ DB: db(rows) }, S);
  assert.equal(r.sent, 0);
  assert.equal(sent.length, 0);
});

test("a failed text is tried again the next day", async () => {
  const rows = [ray()];
  answer = 500;
  assert.equal((await runInvoiceFinalNotices({ DB: db(rows) }, S)).sent, 0);
  assert.equal(rows[0].final_notice_sent_at, null);
  answer = 200;
  assert.equal((await runInvoiceFinalNotices({ DB: db(rows) }, S)).sent, 1);
});

test("the console switch: off keeps the date, on again after it passed = tomorrow, sent = can't", async () => {
  const rows = [ray({ final_notice_date: addDays(today, -3) })];
  const off = await setFinalNotice({ DB: db(rows) }, S, rows[0].id, false);
  assert.deepEqual([off.ok, rows[0].final_notice_off, rows[0].final_notice_date], [true, 1, addDays(today, -3)]);
  const on = await setFinalNotice({ DB: db(rows) }, S, rows[0].id, true);
  assert.deepEqual([on.ok, on.date, rows[0].final_notice_off], [true, addDays(today, 1), 0]);
  rows[0].final_notice_sent_at = "2026-12-28T17:00:00Z";
  assert.equal((await setFinalNotice({ DB: db(rows) }, S, rows[0].id, false)).ok, false);
});

test("a new invoice is scheduled 60 days after its due date", async () => {
  const rows = [];
  globalThis.fetch = async (url) => new Response(JSON.stringify({ id: "x_1", number: "N-0001", hosted_invoice_url: "https://pay" }), { status: 200 });
  const due = addDays(today, 14);
  const r = await createInvoice({ DB: db(rows), STRIPE_SECRET_KEY: "sk_test_x" }, { ...S, ghlSmsUrl: "" },
    { customer_name: "Test", email: "t@example.com", phone: "", items: [{ description: "Dump fee", qty: 1, unit_cents: 6000 }], due_date: due, taxable: false });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.final_notice_date, addDays(due, 60));
  assert.equal(rows[0].insert[21], addDays(due, 60));
});
