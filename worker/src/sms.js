// SMS via GoHighLevel (LeadConnector) inbound webhooks. URLs/owner phone come
// from settings (CMS-editable).
import { fillTemplate } from "./settings.js";

function e164(phone) {
  const d = String(phone || "").replace(/[^\d]/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  return d ? "+" + d : "";
}
function nameParts(full) { const p = String(full || "").trim().split(/\s+/); return { first_name: p[0] || "", last_name: p.slice(1).join(" ") }; }
async function postJSON(url, payload) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) console.error("[sms] webhook returned", res.status);
  return { ok: res.ok, status: res.status };
}
function payload(phone, message, name, type, booking) {
  const np = nameParts(name || (booking && booking.customer_name));
  return { phone: e164(phone), first_name: np.first_name, last_name: np.last_name,
    full_name: name || (booking && booking.customer_name) || "", message, type,
    booking_id: booking && booking.id, bin_size: booking && booking.bin_size,
    delivery_date: booking && booking.delivery_date, address: booking && booking.address };
}

export async function sendSms(S, { phone, message, name, type, booking }) {
  if (!S.ghlSmsUrl || !phone) { console.log("[sms] skipped", { type, hasUrl: !!S.ghlSmsUrl, hasPhone: !!phone }); return { skipped: true }; }
  return postJSON(S.ghlSmsUrl, payload(phone, message, name, type, booking));
}
export async function sendReviewSms(S, { phone, message, name, booking }) {
  const url = S.ghlReviewUrl || S.ghlSmsUrl;
  if (!url || !phone) { console.log("[review-sms] skipped"); return { skipped: true }; }
  return postJSON(url, payload(phone, message, name, "review_request", booking));
}
export async function sendBookingConfirmation(S, booking, consent) {
  if (!consent) return { skipped: true, reason: "no consent" };
  const msg = fillTemplate(S.templates.confirmation, {
    bin: booking.bin_size, tier: booking.rental_tier, date: booking.delivery_date, pickup: booking.pickup_date,
    id: booking.id, name: booking.customer_name, address: booking.address,
    total: (booking.amount_cents / 100).toFixed(2), phone: S.business.phone,
  });
  return sendSms(S, { phone: booking.phone, message: msg, name: booking.customer_name, type: "confirmation", booking });
}
export async function notifyOwnerNewBooking(S, booking) {
  if (!S.ownerPhone) return { skipped: true };
  const msg = fillTemplate(S.templates.owner, {
    bin: booking.bin_size, tier: booking.rental_tier, id: booking.id, name: booking.customer_name,
    date: booking.delivery_date, address: booking.address, total: (booking.amount_cents / 100).toFixed(2), account: booking.account_type,
  });
  return sendSms(S, { phone: S.ownerPhone, message: msg, type: "owner_new_booking", booking });
}
export async function notifyOwnerLowRating(S, booking, rating, feedback) {
  if (!S.ownerPhone) return { skipped: true };
  const msg = `Triple R Dump: ${rating}-star from ${booking.customer_name} (${booking.id}). "${feedback || "no comment"}" ${booking.phone}`;
  return sendSms(S, { phone: S.ownerPhone, message: msg, type: "low_rating", booking });
}
