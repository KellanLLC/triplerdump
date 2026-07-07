// Review funnel: STRICTLY owner-triggered. startReview() runs when the owner marks
// a booking complete (bin picked up). There is no cron/auto path — a customer is
// never texted before the owner confirms the job is done, and the per-phone guard
// below means anyone who already left a rating is skipped.
import { fillTemplate, itemLabel } from "./settings.js";
import { sendReviewSms } from "./sms.js";

function mintToken() { return (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36)); }

// Start the review funnel for one booking — called when the owner marks the job
// complete (bin picked up). Guarded twice: (1) per-booking, never re-send if a
// request already went out or a rating exists; (2) per-client, skip if this phone
// already left a rating on any other booking ("already reviewed before").
export async function startReview(env, S, b) {
  if (!b || b.review_sms_sent_at || b.review_rating != null) return { skipped: "already-sent" };
  const prior = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM bookings WHERE phone=?1 AND review_rating IS NOT NULL AND id<>?2"
  ).bind(b.phone, b.id).first();
  if (prior && prior.n > 0) return { skipped: "client-already-reviewed" };

  let tok = b.review_token;
  if (!tok) { tok = mintToken(); await env.DB.prepare("UPDATE bookings SET review_token=?1 WHERE id=?2").bind(tok, b.id).run(); }
  const link = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/r/" + tok;
  const msg = fillTemplate(S.templates.review, { name: b.customer_name, review_link: link, link, bin: b.bin_size, item: itemLabel(b), id: b.id, phone: S.business.phone, customer_phone: b.phone || "", note: b.message || "" });
  const r = await sendReviewSms(S, { phone: b.phone, message: msg, name: b.customer_name, booking: b });
  if (r && r.ok) await env.DB.prepare("UPDATE bookings SET review_sms_sent_at=?1 WHERE id=?2").bind(new Date().toISOString(), b.id).run();
  return { sent: !!(r && r.ok) };
}
