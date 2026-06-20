// Daily cron: for rentals past pickup with no review sent, mint a token and
// text the customer a link to our /r/<token> funnel.
import { todayISO } from "./util.js";
import { fillTemplate } from "./settings.js";
import { sendReviewSms } from "./sms.js";

function mintToken() { return (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36)); }

export async function runReviewSweep(env, S) {
  const today = todayISO(S.business.timezone);
  const { results } = await env.DB.prepare(
    `SELECT * FROM bookings
       WHERE pickup_date < ?1 AND status IN ('confirmed','paid','completed') AND review_sms_sent_at IS NULL`
  ).bind(today).all();

  const base = (S.publicBaseUrl || "").replace(/\/+$/, "");
  let sent = 0;
  for (const b of results) {
    try {
      let tok = b.review_token;
      if (!tok) { tok = mintToken(); await env.DB.prepare("UPDATE bookings SET review_token=?1 WHERE id=?2").bind(tok, b.id).run(); }
      const link = base + "/r/" + tok;
      const msg = fillTemplate(S.templates.review, { name: b.customer_name, link, bin: b.bin_size, id: b.id });
      const r = await sendReviewSms(S, { phone: b.phone, message: msg, name: b.customer_name, booking: b });
      if (r && r.ok) {
        await env.DB.prepare("UPDATE bookings SET review_sms_sent_at=?1, status='completed' WHERE id=?2").bind(new Date().toISOString(), b.id).run();
        sent++;
      }
    } catch (e) { console.error("[review] failed for", b.id, e); }
  }
  console.log(`[review] due ${results.length}, sent ${sent}`);
  return { due: results.length, sent };
}
