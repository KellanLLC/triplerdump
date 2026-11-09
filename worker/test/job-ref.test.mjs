// The job / work order line on an invoice (Joseph 10/30: Utah Roofing Consultants want the homeowner's
// last name and address on each bill). Stripe calls captured, mocked D1. Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInvoice, jobRefOf, setInvoiceJobRef } from "../src/invoice.js";
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

// ---- the job line on an invoice already sent (Joseph 11/09) ----
function reviseEnv(row) {
  const updates = [];
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { updates.push({ sql, a: this._a }); return { meta: { changes: 1 } }; },
    all: async () => ({ results: [] }), first: async () => row }) };
  return { updates, DB, STRIPE_SECRET_KEY: "sk_test_x", CONSOLE_API_KEY: "k" };
}
const sentRow = { id: "TRD-INV-AAAAAA", status: "sent", number: "ABC-0001", stripe_invoice_id: "in_old", due_date: "2099-01-15", job_ref: null };
function mockRevise({ failFinalize = false, draftTotal = 40313 } = {}) {
  calls = [];
  globalThis.fetch = async (url, o) => {
    const u = String(url), method = (o && o.method) || "GET";
    calls.push({ url: u, method, body: o && o.body ? new URLSearchParams(String(o.body)) : null });
    if (failFinalize && /\/finalize$/.test(u)) return new Response(JSON.stringify({ error: { message: "nope" } }), { status: 400 });
    if (method === "GET") return new Response(JSON.stringify({ id: "in_old", status: "open", total: 40313 }), { status: 200 });
    if (/\/v1\/invoices$/.test(u)) return new Response(JSON.stringify({ id: "in_new", total: draftTotal }), { status: 200 });
    return new Response(JSON.stringify({ id: "in_new", number: "ABC-0002", hosted_invoice_url: "https://pay2", invoice_pdf: "https://pdf2" }), { status: 200 });
  };
}
const step = (re, method = "POST") => calls.find((c) => c.method === method && re.test(c.url));

test("a sent invoice is replaced by Stripe's revision, and the row follows it", async () => {
  mockRevise();
  const e = reviseEnv({ ...sentRow });
  const r = await setInvoiceJobRef(e, S, sentRow.id, "  Smith -\n 123 Main St ");
  assert.equal(r.ok, true); assert.equal(r.number, "ABC-0002"); assert.equal(r.emailed, true); assert.equal(r.due_moved, false);
  assert.equal(step(/\/v1\/invoices$/).body.get("from_invoice[invoice]"), "in_old");
  const upd = step(/\/v1\/invoices\/in_new$/);
  assert.equal(upd.body.get("custom_fields[0][value]"), "Smith - 123 Main St");
  assert.ok(Number(upd.body.get("due_date")) > Date.now() / 1000 + 3600);
  assert.ok(e.updates[0].a.includes("in_new") && /stripe_invoice_id/.test(e.updates[0].sql), "the row points at the copy first");
  assert.ok(calls.indexOf(step(/\/finalize$/)) < calls.indexOf(step(/\/send$/)));
  assert.match(e.updates[1].sql, /number=.*job_ref=/);
});

test("an overdue invoice prints a future due date, our own date stays", async () => {
  mockRevise();
  const e = reviseEnv({ ...sentRow, due_date: "2026-10-09" });
  const r = await setInvoiceJobRef(e, S, sentRow.id, "Epps");
  assert.equal(r.due_moved, true);
  assert.ok(Number(step(/\/v1\/invoices\/in_new$/).body.get("due_date")) > Date.now() / 1000);
  assert.equal(e.updates.some((u) => /due_date/.test(u.sql)), false);
});

test("a failed finalize deletes the draft and puts the row back", async () => {
  mockRevise({ failFinalize: true });
  const e = reviseEnv({ ...sentRow });
  const r = await setInvoiceJobRef(e, S, sentRow.id, "Smith");
  assert.equal(r.ok, false);
  assert.ok(step(/\/v1\/invoices\/in_new$/, "DELETE"));
  assert.ok(e.updates[1].a.includes("in_old"));
  assert.equal(step(/\/send$/), undefined);
});

test("a copy with a different total is thrown away before anything changes", async () => {
  mockRevise({ draftTotal: 1 });
  const e = reviseEnv({ ...sentRow });
  assert.equal((await setInvoiceJobRef(e, S, sentRow.id, "Smith")).ok, false);
  assert.ok(step(/\/v1\/invoices\/in_new$/, "DELETE"));
  assert.equal(e.updates.length, 0);
});

test("paid, voided, blank and unchanged never touch Stripe", async () => {
  mockRevise();
  for (const [row, val] of [[{ ...sentRow, status: "paid" }, "x"], [{ ...sentRow, status: "void" }, "x"], [sentRow, "   "]])
    assert.equal((await setInvoiceJobRef(reviseEnv(row), S, row.id, val)).ok, false);
  assert.equal((await setInvoiceJobRef(reviseEnv({ ...sentRow, job_ref: "Same" }), S, sentRow.id, "Same")).unchanged, true);
  assert.equal(calls.length, 0);
});

test("a driver can't change it", async () => {
  mockRevise();
  const req = new Request("https://www.triplerdump.com/api/console/invoice/TRD-INV-AAAAAA/job", { method: "POST",
    headers: { "content-type": "application/json", "x-console-key": "k", "x-console-user": "Sam", "x-console-role": "driver" }, body: JSON.stringify({ job_ref: "x" }) });
  assert.equal((await consoleApi(req, reviseEnv({ ...sentRow }), new URL(req.url))).status, 403);
  assert.equal(calls.length, 0);
});
