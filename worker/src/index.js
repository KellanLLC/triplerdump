// Triple R Dump - one worker: static site (via assets) + booking + CMS + review.
import { loadSettings } from "./settings.js";
import { createBooking, getAvailability } from "./booking.js";
import { buildICalFeed } from "./ical.js";
import { runReviewSweep } from "./review.js";
import { renderBookingPage } from "./page.js";
import { renderReviewLanding, handleReviewRate, handleReviewFeedback } from "./reviewpage.js";
import { isAuthed, loginCookie, clearCookie, renderLogin, renderPanel, saveSettings } from "./admin.js";

const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" });
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...cors() } });
const html = (b, s = 200, extra = {}) => new Response(b, { status: s, headers: { "content-type": "text/html; charset=utf-8", ...extra } });
const redirect = (loc, cookie) => new Response(null, { status: 302, headers: cookie ? { location: loc, "set-cookie": cookie } : { location: loc } });
const formObj = async (req) => Object.fromEntries((await req.formData()).entries());

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

      // ----- Booking -----
      if (p === "/" || p === "/book") { const S = await loadSettings(env); return html(renderBookingPage(S)); }
      if (p === "/api/availability" && m === "GET") {
        const S = await loadSettings(env);
        return json(await getAvailability(env, S, url.searchParams.get("size"), url.searchParams.get("date"), url.searchParams.get("tier") || "1-3"));
      }
      if (p === "/api/book" && m === "POST") {
        const S = await loadSettings(env);
        const r = await createBooking(env, S, await request.json().catch(() => ({})));
        return json(r, r.ok ? 200 : 400);
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
    ctx.waitUntil((async () => { const S = await loadSettings(env); await runReviewSweep(env, S); })());
  },
};
