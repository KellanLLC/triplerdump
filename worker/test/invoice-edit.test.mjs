// Editing an invoice already sent (Joseph 11/09): Stripe revision, the row follows it, optional notice.
// Stripe calls captured, mocked D1. Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { editInvoice } from "../src/invoice.js";
import { consoleApi } from "../src/console-api.js";
import { loadSettings } from "../src/settings.js";

const base = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const SMS = "https://sms.test/hook";
const S = { ...base, ghlSmsUrl: SMS, taxRate: 0.075, publicBaseUrl: "https://www.triplerdump.com" };

function env(row) {
  const updates = [];
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { updates.push({ sql, a: this._a }); return { meta: { changes: 1 } }; },
    all: async () => ({ results: [] }), first: async () => row }) };
  return { updates, DB, STRIPE_SECRET_KEY: "sk_test_x", CONSOLE_API_KEY: "k" };
}
const row = { id: "TRD-INV-AAAAAA", status: "sent", number: "ABC-0001", stripe_invoice_id: "in_old", due_date: "2099-01-15", job_ref: null, phone: "8015551212", customer_name: "Leroy",
  line_items: JSON.stringify([{ description: "20 yard bin", qty: 1, unit_cents: 37500 }]), subtotal_cents: 37500, tax_cents: 2813, total_cents: 40313, final_notice_date: "2099-03-16", final_notice_sent_at: null };

let calls = [], texts = [];
const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; });
function mock({ failFinalize = false, stripeTotal = null } = {}) {
  calls = []; texts = [];
  let added = 0;
  globalThis.fetch = async (url, o) => {
    const u = String(url), method = (o && o.method) || "GET", body = o && o.body ? new URLSearchParams(String(o.body)) : null;
    const J = (d, status = 200) => new Response(JSON.stringify(d), { status });
    if (u === SMS) { texts.push(JSON.parse(String(o.body))); return J({ ok: true }); }
    calls.push({ url: u, method, body });
    if (failFinalize && /\/finalize$/.test(u)) return J({ error: { message: "nope" } }, 400);
    if (/\/lines\?/.test(u)) return J({ data: [{ parent: { invoice_item_details: { invoice_item: "ii_1" } } }, { parent: { invoice_item_details: { invoice_item: "ii_2" } } }] });
    if (method === "GET") return J({ id: "in_old", status: "open", total: 40313 });
    if (/\/v1\/invoiceitems$/.test(u)) { added += Number(body.get("unit_amount_decimal")); return J({ id: "ii_new" }); }
    if (method === "DELETE") return J({ deleted: true });
    if (/\/v1\/invoices$/.test(u)) return J({ id: "in_new", customer: "cus_1", total: 40313 });
    if (/\/v1\/invoices\/in_new$/.test(u)) return J({ id: "in_new", total: stripeTotal != null ? stripeTotal : (added || 40313) });
    return J({ id: "in_new", number: "ABC-0002", hosted_invoice_url: "https://pay2", invoice_pdf: "https://pdf2" });
  };
}
const step = (re, method = "POST") => calls.find((c) => c.method === method && re.test(c.url));
const updateCall = () => step(/\/v1\/invoices\/in_new$/);

test("job only: Stripe's copied lines stay, the row follows the copy", async () => {
  mock();
  const e = env({ ...row });
  const r = await editInvoice(e, S, row.id, { job_ref: "  Smith -\n 123 Main St ", notify: true });
  assert.equal(r.ok, true); assert.equal(r.number, "ABC-0002"); assert.equal(r.emailed, true); assert.equal(r.due_moved, false);
  assert.equal(step(/\/v1\/invoices$/).body.get("from_invoice[invoice]"), "in_old");
  assert.equal(updateCall().body.get("custom_fields[0][value]"), "Smith - 123 Main St");
  assert.equal(calls.some((c) => /invoiceitems/.test(c.url)), false, "no line rewrite");
  assert.ok(e.updates[0].a.includes("in_new") && /SET stripe_invoice_id/.test(e.updates[0].sql), "row points at the copy first");
  assert.ok(calls.indexOf(step(/\/finalize$/)) < calls.indexOf(step(/\/send$/)));
});

test("a wrong price: lines rewritten, tax redone, totals saved, Joseph's note goes out", async () => {
  mock();
  const e = env({ ...row });
  const r = await editInvoice(e, S, row.id, { items: [{ description: "20 yard bin", qty: 1, unit_cents: 30000 }], taxable: true, notify: true, note: "Accidentally put the wrong price" });
  assert.equal(r.total_cents, 32250); assert.equal(r.was_cents, 40313); assert.equal(r.texted, true);
  assert.ok(step(/invoiceitems\/ii_1$/, "DELETE") && step(/invoiceitems\/ii_2$/, "DELETE"));
  const adds = calls.filter((c) => c.method === "POST" && /invoiceitems$/.test(c.url)).map((c) => c.body.get("unit_amount_decimal"));
  assert.deepEqual(adds, ["30000", "2250"]);
  assert.equal(updateCall().body.get("description"), "Accidentally put the wrong price");
  const save = e.updates[1];
  assert.match(save.sql, /total_cents=/); assert.ok(save.a.includes(32250));
  assert.equal(texts.length, 1);
  assert.match(texts[0].message, /^Hey Leroy, your invoice from Triple R Dump has been edited\. Accidentally put the wrong price\. New total \$322\.50/);
  assert.match(texts[0].message, /\/inv\/TRD-INV-AAAAAA/);
});

test("no note reads cleanly; let-them-know off sends nothing", async () => {
  mock();
  await editInvoice(env({ ...row }), S, row.id, { job_ref: "A", notify: true, note: "" });
  assert.match(texts[0].message, /has been edited\. New total/);
  mock();
  const r = await editInvoice(env({ ...row }), S, row.id, { job_ref: "A", notify: false, note: "ignored" });
  assert.equal(r.emailed, false); assert.equal(r.texted, false); assert.equal(texts.length, 0);
  assert.equal(step(/\/send$/), undefined);
  assert.equal(updateCall().body.get("description"), "");
});

test("a new due date moves the final notice; a past one is refused", async () => {
  mock();
  const e = env({ ...row });
  const r = await editInvoice(e, S, row.id, { due_date: "2099-02-01", notify: false });
  assert.equal(r.due_date, "2099-02-01");
  assert.equal(r.final_notice_date, "2099-04-02");
  mock();
  assert.equal((await editInvoice(env({ ...row }), S, row.id, { due_date: "2020-01-01" })).ok, false);
  assert.equal(calls.length, 0);
});

test("an overdue invoice left on its date prints a future one, our date stays", async () => {
  mock();
  const r = await editInvoice(env({ ...row, due_date: "2026-10-09" }), S, row.id, { job_ref: "Epps", due_date: "2026-10-09" });
  assert.equal(r.due_moved, true); assert.equal(r.due_date, "2026-10-09");
  assert.ok(Number(updateCall().body.get("due_date")) > Date.now() / 1000);
});

test("failed finalize deletes the draft and restores the row; no texts", async () => {
  mock({ failFinalize: true });
  const e = env({ ...row });
  assert.equal((await editInvoice(e, S, row.id, { job_ref: "Smith", notify: true })).ok, false);
  assert.ok(step(/\/v1\/invoices\/in_new$/, "DELETE"));
  assert.ok(e.updates[1].a.includes("in_old"));
  assert.equal(step(/\/send$/), undefined); assert.equal(texts.length, 0);
});

test("a copy with a different total is thrown away before the original is touched", async () => {
  mock({ stripeTotal: 1 });
  const e = env({ ...row });
  assert.equal((await editInvoice(e, S, row.id, { job_ref: "Smith" })).ok, false);
  assert.ok(step(/\/v1\/invoices\/in_new$/, "DELETE"));
  assert.equal(e.updates.length, 0); assert.equal(step(/\/finalize$/), undefined);
});

test("paid, voided, no charges, $0 and nothing changed never reach Stripe", async () => {
  mock();
  for (const [r, input] of [[{ ...row, status: "paid" }, { job_ref: "x" }], [{ ...row, status: "void" }, { job_ref: "x" }], [row, { items: [] }], [row, { items: [{ description: "x", qty: 1, unit_cents: -5 }] }]])
    assert.equal((await editInvoice(env(r), S, r.id, input)).ok, false);
  assert.equal((await editInvoice(env(row), S, row.id, { job_ref: "", items: [{ description: "20 yard bin", qty: 1, unit_cents: 37500 }], taxable: true, due_date: row.due_date, notify: true, note: "hi" })).unchanged, true);
  assert.equal(calls.length, 0); assert.equal(texts.length, 0);
});

test("a driver can't edit one", async () => {
  mock();
  const req = new Request("https://www.triplerdump.com/api/console/invoice/TRD-INV-AAAAAA/edit", { method: "POST",
    headers: { "content-type": "application/json", "x-console-key": "k", "x-console-user": "Sam", "x-console-role": "driver" }, body: JSON.stringify({ job_ref: "x" }) });
  assert.equal((await consoleApi(req, env({ ...row }), new URL(req.url))).status, 403);
  assert.equal(calls.length, 0);
});
