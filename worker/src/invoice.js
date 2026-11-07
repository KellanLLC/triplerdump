// Invoicing — Joseph sends a bill with his own line items, his own due date, and
// late-fee terms printed at the bottom. Built on Stripe Invoices via the REST API
// (no SDK, same dependency-free style as stripe.js).
//
// Why invoices and not another Checkout Session: Checkout is pay-now-or-nothing.
// An invoice carries a DUE DATE, arbitrary line items and a terms footer, and stays
// payable after it is sent. Commercial jobs had no payment path at all before this —
// they were quote-requests that ended in an owner text.
//
// Payment confirmation always re-reads the invoice from Stripe (refreshInvoiceStatus)
// instead of trusting a callback. Three things ask for that re-read: Stripe's
// invoice.paid webhook (seconds after payment, stripe.js), an admin page view, and
// the hourly sweep (the backup if a webhook is missed).
import { stripeKey } from "./stripe.js";
import { fillTemplate } from "./settings.js";
import { sendInvoiceSms, sendOwnerInvoicePaid, sendOwnerInvoiceOverdue, sendOwnerInvoiceFinal } from "./sms.js";
import { startReview } from "./review.js";
import { todayISO, addDays } from "./util.js";

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

// Applies a percent discount to the invoice as a NEGATIVE line item (Stripe
// invoiceitems accept negative amounts as credits). Pushed BEFORE totalsFor runs,
// so the tax, the stored totals, and the customer's PDF all reflect it with no
// special-casing anywhere else. Mutates `items`; returns the discount in cents.
export function applyPercentDiscount(items, pct, label) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p <= 0 || !items || !items.length) return 0;
  const sub = items.reduce((n, it) => n + it.unit_cents * it.qty, 0);
  const disc = Math.min(sub, Math.round(sub * Math.min(100, p) / 100));
  if (disc <= 0) return 0;
  items.push({ description: label || "Discount", qty: 1, unit_cents: -disc });
  return disc;
}

export function totalsFor(items, taxRate, taxable) {
  const subtotal_cents = items.reduce((n, it) => n + it.unit_cents * it.qty, 0);
  const tax_cents = taxable ? Math.round(subtotal_cents * (Number(taxRate) || 0)) : 0;
  return { subtotal_cents, tax_cents, total_cents: subtotal_cents + tax_cents };
}

// The job / work order line as it goes to Stripe: one line, at most 140 characters, "" when blank.
export const jobRefOf = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 140);

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
 *           taxable, terms, notes, job_ref }
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
  // Job / work order line (Joseph 10/30): contractors like Utah Roofing Consultants match each bill to
  // a house, so he types their job number, usually the homeowner's last name and the address. A Stripe
  // custom field prints it in the invoice header, on the PDF and the pay page. Stripe caps it at 140.
  const jobRef = jobRefOf(data.job_ref);
  if (jobRef) {
    invParams.set("custom_fields[0][name]", "Job / Work order");
    invParams.set("custom_fields[0][value]", jobRef);
  }
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
  // The final notice goes out this many days after the due date (no due date given = Stripe's
  // days_until_due from today). Joseph can switch it off per invoice in the console.
  const noticeDays = Number(S.invoiceFinalNoticeDays) || 0;
  const tz = (S.business && S.business.timezone) || "America/Denver";
  const finalNotice = noticeDays > 0 ? addDays(data.due_date || addDays(todayISO(tz), Number(S.invoiceDueDays) || 14), noticeDays) : null;
  try {
    await env.DB.prepare(
      "INSERT INTO invoices (id, created_at, booking_id, customer_name, phone, email, company," +
      " line_items, subtotal_cents, tax_cents, total_cents, due_date, status, terms," +
      " stripe_invoice_id, stripe_customer_id, number, hosted_url, pdf_url, sent_at, notes, ask_review, final_notice_date, job_ref)" +
      " VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'sent',?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23)"
    ).bind(
      id, now, data.booking_id || null, data.customer_name, data.phone || "", data.email || "",
      data.company || "", JSON.stringify(items), subtotal_cents, tax_cents, total_cents,
      data.due_date || "", data.terms || "", stripeInvoiceId, customerId,
      sent.data.number || "", sent.data.hosted_invoice_url || "", sent.data.invoice_pdf || "",
      now, data.notes || "", data.ask_review ? 1 : 0, finalNotice, jobRef || null
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

  return { ok: true, id, number: sent.data.number || "", hosted_url: sent.data.hosted_invoice_url || "", final_notice_date: finalNotice };
}

// Re-reads the invoice from Stripe and syncs status/paid_at into D1. Webhook-free,
// same approach as confirmPaidByRedirect(). Safe to call on every admin page view.
export async function refreshInvoiceStatus(env, S, id) {
  let row;
  try { row = await env.DB.prepare("SELECT * FROM invoices WHERE id=?1").bind(id).first(); }
  catch (e) { console.error("[invoice] lookup failed", e); return null; }
  if (!row || !row.stripe_invoice_id) return row || null;
  if (row.status === "void") return row;
  if (row.status === "paid") {
    try { await onInvoicePaid(env, S, row); } catch (e) { console.error("[invoice] paid hook failed", id, e && e.message); }
    return row;
  }

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
  if (row.status === "paid") {
    try { await onInvoicePaid(env, S, row); } catch (e) { console.error("[invoice] paid hook failed", id, e && e.message); }
  }
  return row;
}

// Runs once per paid invoice (both steps are claimed with a guarded UPDATE, so a
// cron pass and an admin page view racing each other can't double-text anyone):
//  1. text the owner "invoice paid";
//  2. if the invoice was created with "ask for a review", start the review ask —
//     through the linked booking when there is one (same guards as a picked-up
//     job), else on the invoice row itself (needs a phone).
// Invoices that existed before 2026-09-24 were backfilled as already handled.
export async function onInvoicePaid(env, S, row) {
  const now = new Date().toISOString();
  if (!row.owner_paid_notified_at) {
    const claim = await env.DB.prepare(
      "UPDATE invoices SET owner_paid_notified_at=?1 WHERE id=?2 AND owner_paid_notified_at IS NULL"
    ).bind(now, row.id).run();
    if (claim.meta && claim.meta.changes === 1) {
      row.owner_paid_notified_at = now;
      await sendOwnerInvoicePaid(S, row);
    }
  }
  if (row.ask_review && !row.review_checked_at) {
    const claim = await env.DB.prepare(
      "UPDATE invoices SET review_checked_at=?1 WHERE id=?2 AND review_checked_at IS NULL"
    ).bind(now, row.id).run();
    if (!(claim.meta && claim.meta.changes === 1)) return;
    row.review_checked_at = now;
    let subject = null;
    if (row.booking_id) subject = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(row.booking_id).first();
    if (!subject) subject = await env.DB.prepare("SELECT * FROM invoices WHERE id=?1").bind(row.id).first();
    const r = await startReview(env, S, subject);
    console.log("[invoice] review ask for", row.id, "via", subject && subject.id, JSON.stringify(r));
  }
}

// Hourly cron: ask Stripe about every open invoice (the same check the admin page
// does), so a payment is noticed within the hour even if nobody opens /admin.
// Also retries paid rows whose owner text never went out.
export async function sweepInvoices(env, S) {
  const { results } = await env.DB.prepare(
    "SELECT id FROM invoices WHERE stripe_invoice_id IS NOT NULL AND (status='sent'" +
    " OR (status='paid' AND (owner_paid_notified_at IS NULL OR (ask_review=1 AND review_checked_at IS NULL))))" +
    " ORDER BY created_at DESC LIMIT 50"
  ).all();
  for (const r of results || []) {
    try { await refreshInvoiceStatus(env, S, r.id); } catch (e) { console.error("[invoice sweep]", r.id, e && e.message); }
  }
  return { checked: (results || []).length };
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

// Late-payment texts. Runs once a day at the reminder hour (see cron.js). For every
// open invoice past its due date that has a phone: re-check Stripe first (never
// chase someone who just paid), then text the pay link if the last reminder was at
// least invoiceReminderHours ago, and keep going until they pay (Joseph 11/06: "every
// 48hrs until they pay"; it used to stop after 5). After invoiceReminderMax texts the
// owner also gets ONE heads-up to call them; the texts carry on. An invoice with no
// phone can't be texted, so the owner is told once and that's it. Paying or voiding
// ends it automatically, since only status='sent' rows are picked up.
export async function runInvoiceOverdueReminders(env, S) {
  if (S.invoiceRemindersOn === false) return { skipped: "off" };
  const tz = (S.business && S.business.timezone) || "America/Denver";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD
  const every = Math.max(24, Number(S.invoiceReminderHours) || 48);
  const max = Math.min(10, Math.max(1, Number(S.invoiceReminderMax) || 5));
  // 2h of slack so a daily tick that lands a few minutes early still counts.
  const cutoff = new Date(Date.now() - (every - 2) * 3600 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    "SELECT id FROM invoices WHERE status='sent' AND due_date <> '' AND due_date < ?1" +
    " AND (overdue_owner_alerted_at IS NULL OR COALESCE(phone, '') <> '')" +
    " AND (overdue_last_sent_at IS NULL OR overdue_last_sent_at <= ?2) LIMIT 50"
  ).bind(today, cutoff).all();

  const base = (S.publicBaseUrl || "").replace(/\/+$/, "");
  let sent = 0, alerted = 0;
  for (const { id } of results || []) {
    try {
      const row = await refreshInvoiceStatus(env, S, id); // paid since? stop here
      if (!row || row.status !== "sent") continue;
      const daysLate = Math.max(1, Math.round((Date.parse(today) - Date.parse(row.due_date)) / 864e5));
      const count = Number(row.overdue_reminders_sent || 0);
      const vals = {
        name: String(row.customer_name || "").split(/\s+/)[0] || row.customer_name || "",
        number: row.number || row.id, total: money(row.total_cents), due: row.due_date,
        days_late: daysLate, count, invoice_link: base + "/inv/" + row.id,
        phone: (S.business && S.business.phone) || "", customer_phone: row.phone || "",
        admin_link: base + "/admin/invoice/" + row.id,
      };
      // The owner's one heads-up: no phone to text (then nothing more happens), or `max` texts gone out.
      const tellOwner = async (n) => {
        if (row.overdue_owner_alerted_at) return;
        await env.DB.prepare("UPDATE invoices SET overdue_owner_alerted_at=?1 WHERE id=?2").bind(new Date().toISOString(), row.id).run();
        await sendOwnerInvoiceOverdue(S, { ...vals, count: n, name: row.customer_name || "" });
        alerted++;
      };
      if (!row.phone) { await tellOwner(count); continue; }
      const msg = fillTemplate((S.templates && S.templates.invoice_overdue) || "", vals);
      if (!msg.trim()) continue; // template blanked in the CMS = feature off
      const r = await sendInvoiceSms(S, row.phone, msg);
      if (r && (r.ok || r.skipped)) {
        await env.DB.prepare(
          "UPDATE invoices SET overdue_reminders_sent=COALESCE(overdue_reminders_sent,0)+1, overdue_last_sent_at=?1 WHERE id=?2"
        ).bind(new Date().toISOString(), row.id).run();
        sent++;
        if (count + 1 >= max) await tellOwner(count + 1);
      }
    } catch (e) {
      console.error("[invoice overdue]", id, e && e.message);
    }
  }
  console.log(`[invoice overdue] due ${(results || []).length}, texted ${sent}, owner alerted ${alerted}`);
  return { due: (results || []).length, sent, alerted };
}

// The final notice (0012). ONE text per invoice, at the daily reminder hour on its
// final_notice_date, saying small claims is next. Stripe is re-checked first, so nobody
// who just paid gets it. Claimed with a guarded UPDATE before sending (two ticks can't
// double-text); a send that fails releases the claim and it tries again the next day.
// Needs a mobile number: an invoice without one never gets it (the console says so).
export async function runInvoiceFinalNotices(env, S) {
  const tz = (S.business && S.business.timezone) || "America/Denver";
  const today = todayISO(tz);
  const { results } = await env.DB.prepare(
    "SELECT id FROM invoices WHERE status='sent' AND final_notice_date IS NOT NULL AND final_notice_date <> ''" +
    " AND final_notice_date <= ?1 AND COALESCE(final_notice_off,0)=0 AND final_notice_sent_at IS NULL" +
    " AND phone IS NOT NULL AND phone <> '' LIMIT 20"
  ).bind(today).all();

  const base = (S.publicBaseUrl || "").replace(/\/+$/, "");
  let sent = 0;
  for (const { id } of results || []) {
    try {
      const row = await refreshInvoiceStatus(env, S, id); // paid since? stop here
      if (!row || row.status !== "sent") continue;
      const due = row.due_date || String(row.sent_at || row.created_at || "").slice(0, 10);
      const vals = {
        name: String(row.customer_name || "").split(/\s+/)[0] || row.customer_name || "",
        number: row.number || row.id, total: money(row.total_cents), due,
        days_late: Math.max(1, Math.round((Date.parse(today) - Date.parse(due)) / 864e5)),
        late_pct: String((S.fees && S.fees.latePct) || 0),
        invoice_link: base + "/inv/" + row.id, phone: (S.business && S.business.phone) || "",
        customer_phone: row.phone || "", admin_link: base + "/admin/invoice/" + row.id,
      };
      const msg = fillTemplate((S.templates && S.templates.invoice_final) || "", vals);
      if (!msg.trim()) continue; // template blanked in the CMS = feature off
      const claim = await env.DB.prepare(
        "UPDATE invoices SET final_notice_sent_at=?1 WHERE id=?2 AND final_notice_sent_at IS NULL"
      ).bind(new Date().toISOString(), row.id).run();
      if (!(claim.meta && claim.meta.changes === 1)) continue;
      const r = await sendInvoiceSms(S, row.phone, msg);
      if (!r || !r.ok) {
        await env.DB.prepare("UPDATE invoices SET final_notice_sent_at=NULL WHERE id=?1").bind(row.id).run();
        continue;
      }
      await sendOwnerInvoiceFinal(S, { ...vals, name: row.customer_name || "" });
      sent++;
    } catch (e) {
      console.error("[invoice final notice]", id, e && e.message);
    }
  }
  console.log(`[invoice final notice] due ${(results || []).length}, texted ${sent}`);
  return { due: (results || []).length, sent };
}

// The console's switch on an unpaid invoice. Off = it never goes out. On again = it goes on
// its date, or tomorrow if that date has passed. Once it's been sent there's nothing to switch.
export async function setFinalNotice(env, S, id, on) {
  const row = await env.DB.prepare(
    "SELECT id, status, due_date, final_notice_date, final_notice_sent_at FROM invoices WHERE id=?1"
  ).bind(id).first();
  if (!row) return { ok: false, error: "Invoice not found." };
  if (row.final_notice_sent_at) return { ok: false, error: "The final notice already went out." };
  if (row.status !== "sent") return { ok: false, error: row.status === "paid" ? "That invoice is paid." : "That invoice was voided." };
  const tz = (S.business && S.business.timezone) || "America/Denver";
  const today = todayISO(tz);
  let date = row.final_notice_date || addDays(row.due_date || today, Number(S.invoiceFinalNoticeDays) || 60);
  if (on && date <= today) date = addDays(today, 1);
  await env.DB.prepare("UPDATE invoices SET final_notice_off=?1, final_notice_date=?2 WHERE id=?3").bind(on ? 0 : 1, date, id).run();
  return { ok: true, on: !!on, date };
}
