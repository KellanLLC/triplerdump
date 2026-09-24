// Review funnel: STRICTLY owner-triggered. startReview() runs when the owner marks
// a booking complete (bin picked up). There is no cron/auto path for the FIRST ask —
// a customer is never texted before the owner confirms the job is done, and the
// per-phone guard below means anyone who already left a rating is skipped.
//
// After that first ask, a follow-up ladder chases the silent ones: by default
// +24h, +24h, +48h, then it gives up for good. The ladder stops the moment we get
// any signal at all:
//   clicked   - they tapped the link. Strongest signal there is; never nag again.
//   rated     - they answered. Done.
//   exhausted - three follow-ups sent, nobody home. Stop permanently.
// Hours and wording are CMS-editable, and setting an hours box to 0 switches that
// rung off. Screening (>= threshold -> Google, below -> private feedback to the
// owner) is unchanged and lives in reviewpage.js.
import { fillTemplate, itemLabel } from "./settings.js";
import { sendReviewSms } from "./sms.js";

function mintToken() { return (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Math.random().toString(36).slice(2) + Date.now().toString(36)); }
const nowIso = () => new Date().toISOString();

// A review "subject" is a booking OR a paid invoice (2026-09-24: invoiced jobs get
// the same ask + ladder). Both tables carry the same review_* columns; the id
// prefix says which table a row lives in, so every caller can stay id-driven.
const SUBJECT_TABLES = ["bookings", "invoices"];
export const reviewTable = (id) => (String(id || "").startsWith("TRD-INV-") ? "invoices" : "bookings");

// Digits only, last 10 — invoice phones are typed by hand ("(801) 555-1234"),
// booking phones are normalized, so compare on digits.
const PHONE_SQL = (col) => `substr(replace(replace(replace(replace(replace(replace(${col},'-',''),' ',''),'(',''),')',''),'+',''),'.',''), -10)`;
const digits10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

export async function findReviewSubject(env, token) {
  for (const table of SUBJECT_TABLES) {
    const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE review_token=?1`).bind(token).first();
    if (row) return { table, row };
  }
  return null;
}

// {item} for an invoice: best guess from its line items, else "dumpster".
function invoiceItem(b) {
  const txt = String(b.line_items || "").toLowerCase();
  if (txt.includes("trailer")) return "dump trailer";
  if (txt.includes("junk")) return "junk removal";
  return "dumpster";
}
const isoInHours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

// Hours until follow-up `step` (1-3), or null once the ladder is spent. A blank
// or non-positive setting deliberately ends the ladder there.
function followupHours(S, step) {
  const list = (S && S.reviewFollowupHours) || [];
  const n = Number(list[step - 1]);
  return step >= 1 && step <= 3 && Number.isFinite(n) && n > 0 ? n : null;
}

// Tokens shared by the first ask and every follow-up.
function reviewVals(S, b, link) {
  return {
    name: String(b.customer_name || "").split(/\s+/)[0] || b.customer_name || "",
    review_link: link, link,
    bin: b.bin_size || "", item: reviewTable(b.id) === "invoices" ? invoiceItem(b) : itemLabel(b), id: b.id,
    phone: S.business.phone, customer_phone: b.phone || "", note: b.message || "",
  };
}

// End the ladder. COALESCE keeps the FIRST reason that stopped it, so a later
// pass can never overwrite "clicked" with "exhausted".
export async function stopReviewLadder(env, id, reason) {
  await env.DB.prepare(
    `UPDATE ${reviewTable(id)}
        SET review_next_due_at = NULL,
            review_stopped_at = COALESCE(review_stopped_at, ?2),
            review_stop_reason = COALESCE(review_stop_reason, ?3)
      WHERE id = ?1`
  ).bind(id, nowIso(), reason).run();
}

// Called when someone opens /r/<token>. Tapping the link means they heard us,
// so stop chasing even if they wander off without picking a star.
export async function markReviewClicked(env, token) {
  const s = await findReviewSubject(env, token);
  const b = s && s.row;
  if (!b || b.review_clicked_at) return;
  await env.DB.prepare(`UPDATE ${s.table} SET review_clicked_at=?1 WHERE id=?2`).bind(nowIso(), b.id).run();
  await stopReviewLadder(env, b.id, "clicked");
}

// Start the review funnel for one booking — called when the owner marks the job
// complete (bin picked up). Guarded twice: (1) per-booking, never re-send if a
// request already went out or a rating exists; (2) per-client, skip if this phone
// already left a rating on any other booking ("already reviewed before").
export async function startReview(env, S, b) {
  if (!b || b.review_sms_sent_at || b.review_rating != null) return { skipped: "already-sent" };
  const table = reviewTable(b.id);
  const ph = digits10(b.phone);
  if (!ph) return { skipped: "no-phone" };
  // Per-client guards, across BOTH tables: already rated us, or already asked in
  // the last 30 days (a booking + its invoice must not produce two asks).
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  for (const tb of SUBJECT_TABLES) {
    const prior = await env.DB.prepare(
      `SELECT SUM(CASE WHEN review_rating IS NOT NULL THEN 1 ELSE 0 END) AS rated,
              SUM(CASE WHEN review_sms_sent_at >= ?3 THEN 1 ELSE 0 END) AS recent
         FROM ${tb} WHERE ${PHONE_SQL("phone")} = ?1 AND id <> ?2`
    ).bind(ph, b.id, since).first();
    if (prior && prior.rated > 0) return { skipped: "client-already-reviewed" };
    if (prior && prior.recent > 0) return { skipped: "client-asked-recently" };
  }

  let tok = b.review_token;
  if (!tok) { tok = mintToken(); await env.DB.prepare(`UPDATE ${table} SET review_token=?1 WHERE id=?2`).bind(tok, b.id).run(); }
  const link = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/r/" + tok;
  const msg = fillTemplate(S.templates.review, reviewVals(S, b, link));
  const r = await sendReviewSms(S, { phone: b.phone, message: msg, name: b.customer_name, booking: b });
  if (r && r.ok) {
    // Arm rung 1. If no hours are configured the ladder is off, so mark it
    // finished immediately rather than leaving a row the sweep keeps picking up.
    const h = followupHours(S, 1);
    await env.DB.prepare(
      `UPDATE ${table}
          SET review_sms_sent_at = ?1, review_step = 0, review_next_due_at = ?2,
              review_stopped_at = ?3, review_stop_reason = ?4
        WHERE id = ?5`
    ).bind(nowIso(), h ? isoInHours(h) : null, h ? null : nowIso(), h ? null : "exhausted", b.id).run();
  }
  return { sent: !!(r && r.ok) };
}

// Cron sweep. Sends at most ONE follow-up per booking per pass, and only to rows
// that are still running, still unrated, and actually due.
export async function runReviewFollowups(env, S) {
  let due = 0, sentAll = 0;
  for (const table of SUBJECT_TABLES) {
    const r = await runFollowupsFor(env, S, table);
    due += r.due; sentAll += r.sent;
  }
  return { due, sent: sentAll };
}

async function runFollowupsFor(env, S, table) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${table}
      WHERE review_stopped_at IS NULL
        AND review_next_due_at IS NOT NULL
        AND review_next_due_at <= ?1
        AND review_sms_sent_at IS NOT NULL
        AND review_rating IS NULL
      ORDER BY review_next_due_at
      LIMIT 50`
  ).bind(nowIso()).all();

  let sent = 0;
  for (const b of results || []) {
    const step = Number(b.review_step || 0) + 1;
    const tpl = S.templates["review_followup_" + step];
    if (step > 3 || !tpl || !String(tpl).trim()) { await stopReviewLadder(env, b.id, "exhausted"); continue; }

    const link = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/r/" + b.review_token;
    let msg = fillTemplate(tpl, reviewVals(S, b, link));
    if (!msg.includes(link)) msg = (msg + " " + link).trim();

    try {
      const r = await sendReviewSms(S, { phone: b.phone, message: msg, name: b.customer_name, booking: b });
      if (!(r && (r.ok || r.skipped))) throw new Error("send failed");
      sent++;
      const next = followupHours(S, step + 1);
      await env.DB.prepare(
        `UPDATE ${table}
            SET review_step = ?2, review_next_due_at = ?3,
                review_stopped_at = ?4, review_stop_reason = ?5
          WHERE id = ?1`
      ).bind(b.id, step, next ? isoInHours(next) : null, next ? null : nowIso(), next ? null : "exhausted").run();
    } catch (e) {
      // Leave review_next_due_at alone so the next pass retries instead of
      // silently dropping the customer off the ladder.
      console.error("[review followup] step", step, "failed for", b.id, e && e.message);
    }
  }
  console.log(`[review followup ${table}] due ${(results || []).length}, sent ${sent}`);
  return { due: (results || []).length, sent };
}
