// Invoicing — Joseph sends a bill with his own line items, his own due date, and
// late-fee terms printed at the bottom. Built on Stripe Invoices via the REST API
// (no SDK, same dependency-free style as stripe.js).
//
// Why invoices and not another Checkout Session: Checkout is pay-now-or-nothing.
// An invoice carries a DUE DATE, arbitrary line items and a terms footer, and stays
// payable after it is sent. Commercial jobs had no payment path at all before this —
// they were quote-requests that ended in an owner text.
//
// Payment confirmation is deliberately WEBHOOK-FREE, matching confirmPaidByRedirect()
// in stripe.js: STRIPE_WEBHOOK_SECRET is not set in prod, so we re-read the invoice
// from Stripe (on admin view + the daily cron) instead of trusting a callback.
import { stripeKey } from "./stripe.js";
import { fillTemplate } from "./settings.js";
import { sendInvoiceSms } from "./sms.js";

const API = "https://api.stripe.com/v1/";

// Ambiguity-free alphabet (no O/0/I/1) — these get read aloud over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newInvoiceId() {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return "TRD-INV-" + s;
}

// One Stripe REST call. Returns {ok, data} and NEVER throws, so a Stripe outage
// surfaces as a handled error instead of a 500 on the admin page.
async function stripeCall(key, path, params, method = "POST") {
  try {
    const opts = {
      method,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    };
    if (method === "POST") opts.body = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
    const res = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok) {
      console.error("[invoice] stripe " + path + " failed:", data && data.error ? data.error.message : res.status);
      return { ok: false, data, message: (data && data.error && data.error.message) || ("Stripe error " + res.status) };
    }
    return { ok: true, data };
  } catch (e) {
    console.error("[invoice] stripe fetch error on " + path, e && e.message ? e.message : e);
    return { ok: false, message: "Could not reach Stripe. Nothing was sent — try again." };
  }
}

// Money helpers. Everything internal is integer cents; only display converts.
export const dollarsToCents = (v) => Math.round((Number(String(v).replace(/[^0-9.\-]/g, "")) || 0) * 100);
export const money = (c) => "$" + (((c || 0) / 100).toFixed(2));

// Normalizes the admin form's parallel arrays into line items, dropping blank rows
// (the form always renders spare rows). A row needs a description AND a price.
export function parseLineItems(descs, qtys, prices) {
  const out = [];
  const d = [].concat(descs || []), q = [].concat(qtys || []), p = [].concat(prices || []);
  for (let i = 0; i < d.length; i++) {
    const description = String(d[i] || "").trim();
    const unit_cents = dollarsToCents(p[i]);
    const qty = Math.max(1, parseInt(q[i], 10) || 1);
    if (!description || !unit_cents) continue;
    out.push({ description, qty, unit_cents });
  }
  return out;
}

export function totalsFor(items, taxRate, taxable) {
  const subtotal_cents = items.reduce((n, it) => n + it.unit_cents * it.qty, 0);
  const tax_cents = taxable ? Math.round(subtotal_cents * (Number(taxRate) || 0)) : 0;
  return { subtotal_cents, tax_cents, total_cents: subtotal_cents + tax_cents };
}

// YYYY-MM-DD (a date input) -> unix seconds. Stripe wants a timestamp; pinned to
// 23:59:59 UTC so an invoice due "the 10th" isn't already overdue that morning.
function dueDateToUnix(ymd) {
  if (!ymd) return null;
  const t = Date.parse(String(ymd) + "T23:59:59Z");
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * Creates + sends a Stripe invoice, then records it in D1.
 * `data`: { customer_name, email, phone, company, booking_id, items[], due_date,
 *           taxable, terms, notes }
 * Returns { ok, id, number, hosted_url } or { ok:false, error }.
 */
export async function createInvoice(env, S, data) {
  const { key } = stripeKey(env, S);
  if (!key) return { ok: false, error: "Stripe key not configured for the current mode." };

  const items = data.items || [];
  if (!items.length) return { ok: false, error: "Add at least one line item." };
  if (!data.customer_name) return { ok: false, error: "Enter a customer name." };
  if (!data.email) return { ok: false, error: "Enter an email — Stripe needs it to send the invoice." };

  const { subtotal_cents, tax_cents, total_cents } = totalsFor(items, S.taxRate, data.taxable);
  const id = newInvoiceId();

  // 1. Customer. One per invoice, matching how Checkout already creates a Customer
  //    per booking (duplicate emails are fine and expected).
  const cust = await stripeCall(key, "customers", {
    name: data.customer_name,
    email: data.email,
    ...(data.phone ? { phone: data.phone } : {}),
    "metadata[trd_invoice_id]": id,
  });
  if (!cust.ok) return { ok: false, error: cust.message };
  const customerId = cust.data.id;

  // 2. Draft invoice FIRST, so line items bind to this invoice by id. Without this
  //    (and without pending_invoice_items_behavior=exclude) any stray unbilled item
  //    on the customer would silently ride along onto the bill.
  const invParams = new URLSearchParams({
    customer: customerId,
    collection_method: "send_invoice",
    pending_invoice_items_behavior: "exclude",
    auto_advance: "false",
    "metadata[trd_invoice_id]": id,
  });
  const dueUnix = dueDateToUnix(data.due_date);
  if (dueUnix) invParams.set("due_date", String(dueUnix));
  else invParams.set("days_until_due", String(Number(S.invoiceDueDays) || 14));
  if (data.terms) invParams.set("footer", data.terms);
  if (data.booking_id) invParams.set("metadata[booking_id]", data.booking_id);
  invParams.set("payment_settings[payment_method_types][0]", "card");
  // NO setup_future_usage here, and it CANNOT be added. Verified in sandbox 2026-07-28:
  //   1. payment_settings[payment_method_options][card][setup_future_usage] on an
  //      invoice -> "Received unknown parameter" (sending it made EVERY invoice fail).
  //   2. A finalized send_invoice invoice has NO PaymentIntent yet — Stripe creates it
  //      when the customer goes to pay — so there is nothing to set it on afterwards.
  // CONSEQUENCE, a real operational difference: an INVOICED job leaves NO reusable card
  // on file. Checkout does (stripe.js payment_intent_data); invoices do not. Joseph
  // cannot auto-charge overages/damage on an invoiced job — he bills those by sending a
  // SECOND invoice. Take a deposit up front when that matters for a job.

  const inv = await stripeCall(key, "invoices", invParams);
  if (!inv.ok) return { ok: false, error: inv.message };
  const stripeInvoiceId = inv.data.id;

  // 3. Line items, bound to the draft.
  // NOTE: invoiceitems does NOT accept `unit_amount` on this API version ("Received
  // unknown parameter: unit_amount. Did you mean unit_amount_decimal?", verified
  // 2026-07-27). Use unit_amount_decimal WITH quantity so the invoice shows a real
  // "2 x $75.00" line; a flat `amount` would collapse qty into one lump sum.
  for (const it of items) {
    const r = await stripeCall(key, "invoiceitems", {
      customer: customerId,
      invoice: stripeInvoiceId,
      currency: "usd",
      unit_amount_decimal: String(it.unit_cents),
      quantity: String(it.qty),
      description: it.description,
    });
    if (!r.ok) return { ok: false, error: r.message };
  }
  if (tax_cents > 0) {
    const pct = ((Number(S.taxRate) || 0) * 100).toFixed(3).replace(/\.?0+$/, "");
    const r = await stripeCall(key, "invoiceitems", {
      customer: customerId,
      invoice: stripeInvoiceId,
      currency: "usd",
      unit_amount_decimal: String(tax_cents),
      quantity: "1",
      description: "Utah sales tax (" + pct + "%)",
    });
    if (!r.ok) return { ok: false, error: r.message };
  }

  // 4. Send — finalizes AND emails in one call, returning the payable link.
  const sent = await stripeCall(key, "invoices/" + encodeURIComponent(stripeInvoiceId) + "/send", {});
  if (!sent.ok) return { ok: false, error: sent.message };

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO invoices (id, created_at, booking_id, customer_name, phone, email, company," +
      " line_items, subtotal_cents, tax_cents, total_cents, due_date, status, terms," +
      " stripe_invoice_id, stripe_customer_id, number, hosted_url, pdf_url, sent_at, notes)" +
      " VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'sent',?13,?14,?15,?16,?17,?18,?19,?20)"
    ).bind(
      id, now, data.booking_id || null, data.customer_name, data.phone || "", data.email || "",
      data.company || "", JSON.stringify(items), subtotal_cents, tax_cents, total_cents,
      data.due_date || "", data.terms || "", stripeInvoiceId, customerId,
      sent.data.number || "", sent.data.hosted_invoice_url || "", sent.data.invoice_pdf || "",
      now, data.notes || ""
    ).run();
  } catch (e) {
    // The customer HAS been billed by now. Surface it loudly rather than pretending
    // the send failed — Joseph must not fire a second invoice for the same job.
    console.error("[invoice] D1 insert failed AFTER Stripe send", e && e.message ? e.message : e);
    return {
      ok: false,
      sentAnyway: true,
      hosted_url: sent.data.hosted_invoice_url || "",
      error: "Stripe sent invoice " + (sent.data.number || stripeInvoiceId) +
             " but saving it here failed. Do NOT resend — check the Stripe dashboard.",
    };
  }

  // Text the pay link, via our own short /inv/<id> redirect rather than the long
  // Stripe URL. Never fails the invoice: it is already sent and emailed by now.
  try {
    const base = (S.publicBaseUrl || "").replace(/\/+$/, "");
    const message = fillTemplate((S.templates && S.templates.invoice) || "", {
      name: data.customer_name,
      number: sent.data.number || "",
      total: money(total_cents),
      due: data.due_date || "",
      invoice_link: base + "/inv/" + id,
      phone: (S.business && S.business.phone) || "",
    });
    if (data.phone && message) await sendInvoiceSms(S, data.phone, message);
  } catch (e) {
    console.error("[invoice] sms failed (invoice still sent)", e && e.message ? e.message : e);
  }

  return { ok: true, id, number: sent.data.number || "", hosted_url: sent.data.hosted_invoice_url || "" };
}

// Re-reads the invoice from Stripe and syncs status/paid_at into D1. Webhook-free,
// same approach as confirmPaidByRedirect(). Safe to call on every admin page view.
export async function refreshInvoiceStatus(env, S, id) {
  let row;
  try { row = await env.DB.prepare("SELECT * FROM invoices WHERE id=?1").bind(id).first(); }
  catch (e) { console.error("[invoice] lookup failed", e); return null; }
  if (!row || !row.stripe_invoice_id) return row || null;
  if (row.status === "paid" || row.status === "void") return row;

  const { key } = stripeKey(env, S);
  if (!key) return row;
  const r = await stripeCall(key, "invoices/" + encodeURIComponent(row.stripe_invoice_id), null, "GET");
  // Stripe unreachable -> leave the row alone; the next view or cron retries.
  if (!r.ok) return row;

  const st = r.data.status; // draft|open|paid|uncollectible|void
  const mapped = st === "paid" ? "paid" : st === "void" ? "void" : "sent";
  if (mapped !== row.status || (mapped === "paid" && !row.paid_at)) {
    const paidAt = mapped === "paid" ? new Date().toISOString() : null;
    try {
      await env.DB.prepare(
        "UPDATE invoices SET status=?1, paid_at=COALESCE(?2, paid_at)," +
        " hosted_url=COALESCE(NULLIF(?3,''), hosted_url) WHERE id=?4"
      ).bind(mapped, paidAt, r.data.hosted_invoice_url || "", id).run();
    } catch (e) { console.error("[invoice] status update failed", e); }
    row.status = mapped;
    if (paidAt) row.paid_at = paidAt;
  }
  return row;
}

// Voids an OPEN invoice in Stripe (a paid one cannot be voided — refund instead).
export async function voidInvoice(env, S, id) {
  const row = await env.DB.prepare("SELECT * FROM invoices WHERE id=?1").bind(id).first();
  if (!row) return { ok: false, error: "Invoice not found." };
  if (row.status === "paid") return { ok: false, error: "That invoice is already paid — refund it in Stripe instead." };
  const { key } = stripeKey(env, S);
  if (!key) return { ok: false, error: "Stripe key not configured." };
  const r = await stripeCall(key, "invoices/" + encodeURIComponent(row.stripe_invoice_id) + "/void", {});
  if (!r.ok) return { ok: false, error: r.message };
  try { await env.DB.prepare("UPDATE invoices SET status='void' WHERE id=?1").bind(id).run(); }
  catch (e) { console.error("[invoice] void persist failed", e); }
  return { ok: true };
}

// Re-texts the pay link for an already-sent invoice. Creates NOTHING in Stripe, so
// it can never double-bill.
export async function resendInvoice(env, S, id) {
  const row = await env.DB.prepare("SELECT * FROM invoices WHERE id=?1").bind(id).first();
  if (!row) return { ok: false, error: "Invoice not found." };
  if (row.status === "void") return { ok: false, error: "That invoice was voided." };
  const base = (S.publicBaseUrl || "").replace(/\/+$/, "");
  const message = fillTemplate((S.templates && S.templates.invoice) || "", {
    name: row.customer_name,
    number: row.number || "",
    total: money(row.total_cents),
    due: row.due_date || "",
    invoice_link: base + "/inv/" + row.id,
    phone: (S.business && S.business.phone) || "",
  });
  if (!row.phone || !message) return { ok: false, error: "No customer phone (or the invoice SMS template is blank)." };
  await sendInvoiceSms(S, row.phone, message);
  return { ok: true };
}
