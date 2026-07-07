// Triple R Dump - one worker: static site (via assets) + booking + CMS + review.
import { loadSettings } from "./settings.js";
import { createBooking, getAvailability, expireStaleHolds } from "./booking.js";
import { handleStripeWebhook, confirmPaidByRedirect } from "./stripe.js";
import { renderBookedPage } from "./booked.js";
import { buildICalFeed } from "./ical.js";
import { startReview } from "./review.js";
import { runReminderSweep } from "./reminders.js";
import { renderBookingPage } from "./page.js";
import { renderTermsPage } from "./terms.js";
import { renderReviewLanding, handleReviewRate, handleReviewFeedback } from "./reviewpage.js";
import { isAuthed, loginCookie, clearCookie, renderLogin, renderPanel, saveSettings, renderBookingsList, renderBookingDetail } from "./admin.js";

const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" });
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...cors() } });
const html = (b, s = 200, extra = {}) => new Response(b, { status: s, headers: { "content-type": "text/html; charset=utf-8", ...extra } });
const redirect = (loc, cookie) => new Response(null, { status: 302, headers: cookie ? { location: loc, "set-cookie": cookie } : { location: loc } });
const formObj = async (req) => Object.fromEntries((await req.formData()).entries());

// Cloudflare Turnstile server-side verification. No-op when no secret is configured
// (site keeps working before/without Turnstile). Missing token -> reject (bot / not
// solved). Network/infra error talking to siteverify -> fail OPEN so a CF hiccup can't
// block real customers; an explicit failure (bad/used token) -> reject.
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token) });
    if (ip) form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await res.json();
    return !!(data && data.success);
  } catch (e) {
    console.error("[turnstile] verify error (failing open)", e && e.message ? e.message : e);
    return true;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;
    if (m === "OPTIONS") return new Response(null, { headers: cors() });

    try {
      // ----- Admin / CMS -----
      if (p === "/admin" && m === "GET") {
        const S = await loadSettings(env);
        if (!(await isAuthed(request, env))) return html(renderLogin());
        const bookings = (await env.DB.prepare("SELECT id,status,bin_size,delivery_date,customer_name,amount_cents FROM bookings ORDER BY created_at DESC LIMIT 15").all()).results || [];
        const reviews = (await env.DB.prepare("SELECT booking_id,rating,feedback,created_at FROM reviews ORDER BY created_at DESC LIMIT 25").all()).results || [];
        return html(renderPanel(S, bookings, reviews, url.searchParams.get("saved")));
      }
      if (p === "/admin/login" && m === "POST") {
        const cookie = await loginCookie(env, (await formObj(request)).password);
        return cookie ? redirect("/admin", cookie) : html(renderLogin("Incorrect password."), 401);
      }
      if (p === "/admin/logout" && m === "POST") return redirect("/admin", clearCookie());
      if (p === "/admin/save" && m === "POST") {
        if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
        await saveSettings(env, await formObj(request));
        return redirect("/admin?saved=1");
      }
      // Bookings management (search list + per-booking detail + status/delete).
      if (p === "/admin/bookings" && m === "GET") {
        if (!(await isAuthed(request, env))) return html(renderLogin());
        const S = await loadSettings(env);
        const q = (url.searchParams.get("q") || "").trim();
        const rows = q
          ? (await env.DB.prepare("SELECT * FROM bookings WHERE id LIKE ?1 OR customer_name LIKE ?1 OR phone LIKE ?1 ORDER BY created_at DESC LIMIT 100").bind("%" + q + "%").all()).results
          : (await env.DB.prepare("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100").all()).results;
        return html(renderBookingsList(S, rows || [], q));
      }
      {
        const bd = p.match(/^\/admin\/booking\/([^/]+)$/);
        if (bd && m === "GET") {
          if (!(await isAuthed(request, env))) return html(renderLogin());
          const S = await loadSettings(env);
          const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(bd[1]).first();
          return html(renderBookingDetail(S, b));
        }
        const bs = p.match(/^\/admin\/booking\/([^/]+)\/status$/);
        if (bs && m === "POST") {
          if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
          const st = String((await formObj(request)).status || "").trim();
          // No 'delivered': the capacity/iCal/reminder queries don't recognize it, so a
          // delivered-but-not-picked-up bin would silently free its slot for double-booking.
          if (["confirmed", "paid", "completed", "cancelled"].includes(st)) {
            await env.DB.prepare("UPDATE bookings SET status=?1 WHERE id=?2").bind(st, bs[1]).run();
            if (st === "completed") {
              const S = await loadSettings(env);
              const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(bs[1]).first();
              if (b) { try { await startReview(env, S, b); } catch (e) { console.error("[startReview]", e); } }
            }
          }
          return redirect("/admin/booking/" + encodeURIComponent(bs[1]));
        }
        const bdel = p.match(/^\/admin\/booking\/([^/]+)\/delete$/);
        if (bdel && m === "POST") {
          if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
          await env.DB.prepare("DELETE FROM bookings WHERE id=?1").bind(bdel[1]).run();
          return redirect("/admin/bookings");
        }
        const bnotes = p.match(/^\/admin\/booking\/([^/]+)\/notes$/);
        if (bnotes && m === "POST") {
          if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
          const notes = String((await formObj(request)).notes || "").slice(0, 4000);
          await env.DB.prepare("UPDATE bookings SET notes=?1 WHERE id=?2").bind(notes, bnotes[1]).run();
          return redirect("/admin/booking/" + encodeURIComponent(bnotes[1]));
        }
      }

      // ----- Booking -----
      if (p === "/" || p === "/book") { const S = await loadSettings(env); return html(renderBookingPage(S, url.searchParams.get("service"))); }
      if (p === "/terms" && m === "GET") { const S = await loadSettings(env); return html(renderTermsPage(S)); }
      if (p === "/api/availability" && m === "GET") {
        const S = await loadSettings(env);
        return json(await getAvailability(env, S, url.searchParams.get("size"), url.searchParams.get("date"), url.searchParams.get("tier") || "1-3"));
      }
      if (p === "/api/book" && m === "POST") {
        const S = await loadSettings(env);
        const body = await request.json().catch(() => ({}));
        if (!(await verifyTurnstile(env, body["cf-turnstile-response"], request.headers.get("cf-connecting-ip")))) {
          return json({ ok: false, errors: ["Could not verify you're human. Please complete the check and try again."] }, 400);
        }
        const r = await createBooking(env, S, body);
        return json(r, r.ok ? 200 : 400);
      }
      // Stripe payment confirmation (raw body needed for signature check).
      if (p === "/api/stripe-webhook" && m === "POST") {
        const S = await loadSettings(env);
        const r = await handleStripeWebhook(env, S, request);
        return new Response(r.status === 200 ? "ok" : "error", { status: r.status });
      }
      // Post-checkout success landing (Stripe success_url).
      if (p === "/booked" && m === "GET") {
        const S = await loadSettings(env);
        const ref = url.searchParams.get("ref");
        if (ref) { try { await confirmPaidByRedirect(env, S, ref); } catch (e) { console.error("[booked confirm]", e); } }
        const b = ref
          ? await env.DB.prepare("SELECT id,status,paid_at,customer_name,delivery_date,amount_cents,deposit_cents FROM bookings WHERE id=?1").bind(ref).first()
          : null;
        return html(renderBookedPage(S, b));
      }
      // Keyless address autocomplete: same-origin proxy to Photon (OSM). No API
      // key, biased toward West Haven, UT. Graceful: returns [] on any failure.
      if (p === "/api/geocode" && m === "GET") {
        const q = String(url.searchParams.get("q") || "").trim().slice(0, 120);
        if (q.length < 3) return json([]);
        const qnum = (q.match(/^\s*(\d+)/) || [])[1] || ""; // keep the typed house number
        try {
          const upstream =
            "https://photon.komoot.io/api/?q=" + encodeURIComponent(q) +
            "&limit=5&lang=en&lat=41.2&lon=-112.0";
          const r = await fetch(upstream, {
            headers: { "user-agent": "TripleRDump-Booking/1.0 (https://triplerdump.com; address autocomplete)" },
          });
          if (!r.ok) return json([]);
          const data = await r.json();
          const out = (data && Array.isArray(data.features) ? data.features : [])
            .map((f) => {
              const pr = (f && f.properties) || {};
              const street = pr.street || pr.name || "";
              const housenumber = pr.housenumber || (pr.osm_key !== "place" && qnum ? qnum : "");
              const city = pr.city || pr.town || pr.village || pr.hamlet || pr.county || "";
              const state = pr.state || pr.statecode || "";
              const postcode = pr.postcode || "";
              const line1 = [housenumber, street].filter(Boolean).join(" ").trim();
              const tail = [city, [state, postcode].filter(Boolean).join(" ").trim()].filter(Boolean).join(", ");
              const label = [line1, tail].filter(Boolean).join(", ") || (pr.name || "");
              return { label, street, housenumber, city, state, postcode };
            })
            .filter((s) => s.label);
          return json(out);
        } catch (e) {
          console.error("[geocode]", e && e.message ? e.message : e);
          return json([]);
        }
      }

      // ----- Review funnel -----
      const rr = p.match(/^\/r\/([^/]+)$/);
      if (rr && m === "GET") {
        const S = await loadSettings(env);
        const b = await env.DB.prepare("SELECT customer_name FROM bookings WHERE review_token=?1").bind(rr[1]).first();
        const first = b ? String(b.customer_name || "").split(/\s+/)[0] : "";
        return html(renderReviewLanding(S, rr[1], first));
      }
      if (p === "/api/review" && m === "POST") {
        const S = await loadSettings(env);
        return json(await handleReviewRate(env, S, await request.json().catch(() => ({}))));
      }
      if (p === "/api/review/feedback" && m === "POST") {
        const S = await loadSettings(env);
        return json(await handleReviewFeedback(env, S, await request.json().catch(() => ({}))));
      }

      // ----- Owner calendar feed -----
      const cal = p.match(/^\/calendar\/([^/]+)\.ics$/);
      if (cal && m === "GET") {
        if (!env.CALENDAR_TOKEN || cal[1] !== env.CALENDAR_TOKEN) return new Response("Not found", { status: 404 });
        return new Response(await buildICalFeed(env), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache" } });
      }

      return json({ ok: false, error: "Not found" }, 404);
    } catch (err) {
      console.error("[fetch]", err && err.stack ? err.stack : err);
      return json({ ok: false, error: "Server error" }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const S = await loadSettings(env);
      // Run the sweeps independently so one failing can't abort the others.
      // NOTE: review requests are STRICTLY owner-triggered (startReview on "mark
      // complete") — there is deliberately NO review sweep here.
      await expireStaleHolds(env, S).catch((e) => console.error("[cron expire]", e));
      await runReminderSweep(env, S).catch((e) => console.error("[cron reminder]", e));
    })());
  },
};
