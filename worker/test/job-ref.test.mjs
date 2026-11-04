// The job / work order line on an invoice (Joseph 10/30: Utah Roofing Consultants want the homeowner's
// last name and address on each bill). Stripe calls captured, mocked D1. Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInvoice, jobRefOf } from "../src/invoice.js";
import { consoleApi } from "../src/console-api.js";
import { renderInvoiceNew, renderInvoiceDetail, renderInvoiceList } from "../src/admin.js";
import { loadSettings } from "../src/settings.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const S = { ...base, ghlSmsUrl: "" };

function env() {
  const inserts = [];
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { if (/INSERT INTO invoices/.test(sql)) inserts.push({ sql, a: this._a }); return { meta: { changes: 1 } }; },
    all: async () => ({ results: [] }), first: async () => null }) };
  return { inserts, DB, STRIPE_SECRET_KEY: "sk_test_x", CONSOLE_API_KEY: "k" };
}

let calls = [];
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, o) => {
    calls.push({ url: String(url), body: o && o.body ? new URLSearchParams(String(o.body)) : null });
    return new Response(JSON.stringify({ id: "in_1", number: "N-0001", hosted_invoice_url: "https://pay" }), { status: 200 });
  };
});
test.after(() => { globalThis.fetch = realFetch; });

const invoiceCall = () => calls.find((c) => /\/v1\/invoices$/.test(c.url));
const job = { customer_name: "Utah Roofing Consultants", email: "ap@example.com", items: [{ description: "20 yard bin", qty: 1, unit_cents: 37500 }], taxable: true };

test("the job line goes to Stripe as a custom field and is kept on the row", async () => {
  const e = env();
  const r = await createInvoice(e, S, { ...job, job_ref: "  Smith –\n 123 Main St, Ogden " });
  assert.equal(r.ok, true, r.error);
  const p = invoiceCall().body;
  assert.equal(p.get("custom_fields[0][name]"), "Job / Work order");
  assert.equal(p.get("custom_fields[0][value]"), "Smith – 123 Main St, Ogden");
  assert.match(e.inserts[0].sql, /final_notice_date, job_ref\)/);
  assert.equal(e.inserts[0].a[22], "Smith – 123 Main St, Ogden");
});

test("no job line: no custom field, NULL on the row (every invoice before this)", async () => {
  const e = env();
  assert.equal((await createInvoice(e, S, { ...job, job_ref: "   " })).ok, true);
  assert.equal([...invoiceCall().body.keys()].some((k) => k.startsWith("custom_fields")), false);
  assert.equal(e.inserts[0].a[22], null);
});

test("Stripe's 140-character cap", () => {
  assert.equal(jobRefOf("x".repeat(200)).length, 140);
  assert.equal(jobRefOf(null), "");
});

test("the console sends it through", async () => {
  const e = env();
  const req = new Request("https://www.triplerdump.com/api/console/invoice", { method: "POST",
    headers: { "content-type": "application/json", "x-console-key": "k", "x-console-user": "Joseph" },
    body: JSON.stringify({ ...job, job_ref: "Jones – 45 Elm Dr, Roy" }) });
  const res = await consoleApi(req, e, new URL(req.url));
  assert.equal((await res.json()).ok, true);
  assert.equal(invoiceCall().body.get("custom_fields[0][value]"), "Jones – 45 Elm Dr, Roy");
});

test("/admin: a box on New invoice, a row on the invoice, a line in the list", () => {
  assert.match(renderInvoiceNew(S, {}, ""), /<input name="job_ref" maxlength="140" value="">/);
  const inv = { id: "TRD-INV-AAAAAA", number: "N-0001", status: "sent", customer_name: "Utah Roofing Consultants", line_items: "[]", job_ref: "Smith – 123 Main St" };
  assert.match(renderInvoiceDetail(S, inv, ""), /Job \/ Work order.*Smith – 123 Main St/);
  assert.doesNotMatch(renderInvoiceDetail(S, { ...inv, job_ref: null }, ""), /Job \/ Work order/);
  assert.match(renderInvoiceList(S, [inv], ""), /<div class="muted">Smith – 123 Main St<\/div>/);
});
