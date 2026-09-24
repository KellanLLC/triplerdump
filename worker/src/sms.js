// All outbound SMS goes through ONE GoHighLevel inbound webhook as a dumb relay:
// we POST exactly { number, message } and GHL sends the text. Recipients and the
// message text are decided here in the worker. Email (when enabled) uses a SEPARATE
// webhook (S.ghlEmailUrl) with a { email, subject, message } payload.
import { fillTemplate, itemLabel, lengthLabel, chargedCents } from "./settings.js";

function e164(phone) {
  const d = String(phone || "").replace(/[^\d]/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}

async function post(url, payload) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) console.error("[ghl] webhook returned", res.status);
  return { ok: res.ok, status: res.status };
}

// The one SMS primitive: send `message` to `number`. Nothing else.
async function sendSms(S, number, message) {
  const to = e164(number);
  if (!S.ghlSmsUrl || !to || !message) { console.log("[ghl] sms skipped (missing url/number/message)"); return { skipped: true }; }
  return post(S.ghlSmsUrl, { number: to, message });
}

// Invoice pay-link text. The message is fully composed by invoice.js (it owns the
// {invoice_link} token), so this is just the primitive under a named entry point.
export async function sendInvoiceSms(S, number, message) {
  return sendSms(S, number, message);
}

// Token values for owner-facing templates.
function ownerVals(S, b) {
  const adminLink = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/admin/booking/" + b.id;
  return {
    bin: b.bin_size, tier: b.rental_tier, item: itemLabel(b), length: lengthLabel(b),
    date: b.delivery_date, pickup: b.pickup_date,
    id: b.id, name: b.customer_name, address: b.address, account: b.account_type || "",
    total: (chargedCents(b) / 100).toFixed(2), phone: (S.business && S.business.phone) || "",
    customer_phone: b.phone || "",
    admin_link: adminLink, link: adminLink, // {link} kept as a legacy alias for {admin_link}
    note: b.message || "",
  };
}

// Customer booking confirmation (consent-gated HERE now — no consent, no send) plus
// an owner copy to the CMS owner number when owner-booking alerts are enabled.
export async function sendBookingWebhook(S, booking, consent, message) {
  let res = { skipped: true };
  if (consent) res = await sendSms(S, booking.phone, message);
  if (S.notifyOwnerBookings !== false && S.ownerPhone) {
    await sendSms(S, S.ownerPhone, fillTemplate((S.templates && S.templates.owner) || "", ownerVals(S, booking)));
  }
  return res;
}

// Customer day-before reminder.
export async function sendReminderSms(S, booking, message) {
  return sendSms(S, booking.phone, message);
}

// Owner copy of the day-before reminder, when enabled.
export async function sendOwnerReminder(S, booking, message) {
  if (S.notifyOwnerReminders === false || !S.ownerPhone) return { skipped: true };
  return sendSms(S, S.ownerPhone, message);
}

// Post-pickup review request (own webhook if set, else the SMS one).
export async function sendReviewSms(S, { phone, message }) {
  const url = S.ghlReviewUrl || S.ghlSmsUrl;
  const to = e164(phone);
  if (!url || !to || !message) { console.log("[review-sms] skipped"); return { skipped: true }; }
  return post(url, { number: to, message });
}

// Owner alert when a customer leaves a low rating. Everything is in the message text.
// OWNER ONLY — no fallback recipient: this text contains the customer's own complaint
// plus an admin link, so if the owner number is unset it must be dropped, never
// misdelivered to the customer.
export async function notifyOwnerLowRating(S, booking, rating, feedback) {
  if (!S.ownerPhone) return { skipped: true };
  const adminLink = (S.publicBaseUrl || "").replace(/\/+$/, "") +
    (String(booking.id).startsWith("TRD-INV-") ? "/admin/invoice/" : "/admin/booking/") + booking.id;
  const vals = {
    rating, name: booking.customer_name, id: booking.id, feedback: feedback || "no comment",
    phone: (S.business && S.business.phone) || "", customer_phone: booking.phone,
    note: booking.message || "", admin_link: adminLink, link: adminLink,
  };
  return sendSms(S, S.ownerPhone, fillTemplate((S.templates && S.templates.low_rating) || "", vals));
}

// Owner text when an invoice is paid (found by the hourly Stripe sweep or when the
// invoice is opened in /admin). Respects the "text me about bookings" toggle.
export async function sendOwnerInvoicePaid(S, inv) {
  if (S.notifyOwnerBookings === false || !S.ownerPhone) return { skipped: true };
  const adminLink = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/admin/invoice/" + inv.id;
  const vals = {
    number: inv.number || inv.id, id: inv.id, name: inv.customer_name || "", company: inv.company || "",
    total: ((Number(inv.total_cents) || 0) / 100).toFixed(2), customer_phone: inv.phone || "",
    phone: (S.business && S.business.phone) || "", admin_link: adminLink, link: adminLink,
  };
  return sendSms(S, S.ownerPhone, fillTemplate((S.templates && S.templates.owner_invoice_paid) || "", vals));
}

// Commercial "request a quote" lead -> texts the owner. All details in the message.
export async function sendCommercialLead(S, lead) {
  if (!lead) return { skipped: true };
  const vals = {
    id: lead.id, company: lead.company || "", name: lead.customer_name || "",
    interest: lead.service_interest || "Not sure", timeframe: lead.timeframe || "n/a",
    phone: (S.business && S.business.phone) || "", customer_phone: lead.phone || "",
    email: lead.email || "", address: lead.address || "n/a",
    details: lead.details || "",
  };
  return sendSms(S, S.ownerPhone, fillTemplate((S.templates && S.templates.commercial) || "", vals));
}

// Reminder email via a SEPARATE webhook (when configured). Minimal email payload.
export async function sendReminderEmail(S, booking, subject, body) {
  if (!S.ghlEmailUrl || !booking.email) return { skipped: true };
  return post(S.ghlEmailUrl, { email: booking.email, subject, message: body });
}
