// Triple R Dump - one worker: static site (via assets) + booking + CMS + review.
import { loadSettings, itemLabel } from "./settings.js";
import { createBooking, getAvailability, expireStaleHolds } from "./booking.js";
import { handleStripeWebhook, confirmPaidByRedirect } from "./stripe.js";
import { renderBookedPage } from "./booked.js";
import { buildICalFeed } from "./ical.js";
import { startReview, runReviewFollowups, markReviewClicked } from "./review.js";
import { runReminderSweep } from "./reminders.js";
import { renderBookingPage } from "./page.js";
import { renderTermsPage } from "./terms.js";
import { renderReviewLanding, handleReviewRate, handleReviewFeedback } from "./reviewpage.js";
import { isAuthed, loginCookie, clearCookie, renderLogin, renderPanel, saveSettings, renderBookingsList, renderBookingDetail, renderInvoiceList, renderInvoiceNew, renderInvoiceDetail } from "./admin.js";
import { createInvoice, refreshInvoiceStatus, voidInvoice, resendInvoice, parseLineItems } from "./invoice.js";

const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" });
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", ...cors() } });
const html = (b, s = 200, extra = {}) => new Response(b, { status: s, headers: { "content-type": "text/html; charset=utf-8", ...extra } });
const redirect = (loc, cookie) => new Response(null, { status: 302, headers: cookie ? { location: loc, "set-cookie": cookie } : { location: loc } });
const formObj = async (req) => Object.fromEntries((await req.formData()).entries());

// Honeypot: the booking form renders an off-screen "trd_hp" input that no real
// customer can see or tab into. Anything non-empty is a bot filling every field.
// Deliberately NOT named website/url/company -- those get autofilled by password
// managers, and a false positive here costs Joseph a real job.
const isBotSubmission = (body) => typeof (body && body.trd_hp) === "string" && body.trd_hp.trim() !== "";

// Cloudflare Turnstile server-side verification. The client widget was REMOVED
// 2026-07-27 (sitekey never rendered on workers.dev -- error 400020) and replaced
// by the honeypot above. This stays so Turnstile can be switched back on after the
// domain cutover by re-adding the widget and setting TURNSTILE_SECRET.
// No-op when no secret is configured (the case today). Missing token -> reject (bot
// / not solved). Network/infra error talking to siteverify -> fail OPEN so a CF
// hiccup can't block real customers; an explicit failure (bad/used token) -> reject.
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
        // Extension: move the pickup date. Clears both pickup-reminder flags so the
        // customer day-before and owner pickup-day texts re-fire for the new date,
        // and stamps the change into notes as an audit trail. rental_days follows so
        // the trailer's {length} label stays truthful; historical amounts are kept -
        // extension days are billed off-session from the Stripe dashboard.
        const bpd = p.match(/^\/admin\/booking\/([^/]+)\/pickupdate$/);
        if (bpd && m === "POST") {
          if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
          const nd = String((await formObj(request)).pickup_date || "").trim();
          const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(bpd[1]).first();
          if (b && /^\d{4}-\d{2}-\d{2}$/.test(nd) && nd >= b.delivery_date && nd !== b.pickup_date) {
            const days = Math.max(1, Math.round((Date.parse(nd) - Date.parse(b.delivery_date)) / 864e5));
            const stamp = "Pickup moved " + b.pickup_date + " to " + nd + " (" + new Date().toISOString().slice(0, 10) + ")";
            await env.DB.prepare(
              "UPDATE bookings SET pickup_date=?1, rental_days=?2, pickup_reminder_sent_at=NULL, owner_pickup_reminder_sent_at=NULL, " +
              "notes=CASE WHEN notes IS NULL OR notes='' THEN ?3 ELSE notes || char(10) || ?3 END WHERE id=?4"
            ).bind(nd, days, stamp, bpd[1]).run();
          }
          return redirect("/admin/booking/" + encodeURIComponent(bpd[1]));
        }
      }

      // ----- Invoices (admin) -----
      if (p === "/admin/invoices" && m === "GET") {
        if (!(await isAuthed(request, env))) return html(renderLogin());
        const S = await loadSettings(env);
        const q = (url.searchParams.get("q") || "").trim();
        const rows = q
          ? (await env.DB.prepare("SELECT * FROM invoices WHERE id LIKE ?1 OR number LIKE ?1 OR customer_name LIKE ?1 OR booking_id LIKE ?1 ORDER BY created_at DESC LIMIT 100").bind("%" + q + "%").all()).results
          : (await env.DB.prepare("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 100").all()).results;
        return html(renderInvoiceList(S, rows || [], q));
      }
      if (p === "/admin/invoice/new" && m === "GET") {
        if (!(await isAuthed(request, env))) return html(renderLogin());
        const S = await loadSettings(env);
        // ?booking=REF prefills the customer and seeds a line item from the booking.
        let prefill = {};
        const ref = url.searchParams.get("booking");
        if (ref) {
          const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(ref).first();
          if (b) {
            prefill = {
              booking_id: b.id, customer_name: b.customer_name, email: b.email,
              phone: b.phone, company: b.company,
              items: [{ description: itemLabel(b) + (b.delivery_date ? " — " + b.delivery_date : ""), qty: 1, unit_cents: b.subtotal_cents || 0 }],
            };
          }
        }
        return html(renderInvoiceNew(S, prefill, url.searchParams.get("error")));
      }
      if (p === "/admin/invoice/create" && m === "POST") {
        if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
        const S = await loadSettings(env);
        // Read formData directly: line items are REPEATED fields, and formObj()'s
        // Object.fromEntries would keep only the last of each.
        const fd = await request.formData();
        const items = parseLineItems(fd.getAll("li_desc"), fd.getAll("li_qty"), fd.getAll("li_price"));
        const r = await createInvoice(env, S, {
          customer_name: String(fd.get("customer_name") || "").trim(),
          email: String(fd.get("email") || "").trim(),
          phone: String(fd.get("phone") || "").trim(),
          company: String(fd.get("company") || "").trim(),
          booking_id: String(fd.get("booking_id") || "").trim() || null,
          items,
          due_date: String(fd.get("due_date") || "").trim(),
          taxable: fd.get("taxable") === "on",
          terms: String(fd.get("terms") || ""),
          notes: String(fd.get("notes") || ""),
        });
        if (!r.ok) {
          const back = "/admin/invoice/new?error=" + encodeURIComponent(r.error || "Could not create the invoice.");
          return redirect(back + (fd.get("booking_id") ? "&booking=" + encodeURIComponent(String(fd.get("booking_id"))) : ""));
        }
        return redirect("/admin/invoice/" + encodeURIComponent(r.id) + "?flash=" + encodeURIComponent("Invoice " + (r.number || r.id) + " sent."));
      }
      {
        const iv = p.match(/^\/admin\/invoice\/([^/]+)$/);
        if (iv && m === "GET") {
          if (!(await isAuthed(request, env))) return html(renderLogin());
          const S = await loadSettings(env);
          // Webhook-free reconcile: ask Stripe on every view (same idea as /booked).
          const inv = await refreshInvoiceStatus(env, S, iv[1]);
          return html(renderInvoiceDetail(S, inv, url.searchParams.get("flash")));
        }
        const ivr = p.match(/^\/admin\/invoice\/([^/]+)\/resend$/);
        if (ivr && m === "POST") {
          if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
          const S = await loadSettings(env);
          const r = await resendInvoice(env, S, ivr[1]);
          return redirect("/admin/invoice/" + encodeURIComponent(ivr[1]) + "?flash=" + encodeURIComponent(r.ok ? "Pay link re-sent." : (r.error || "Could not resend.")));
        }
        const ivv = p.match(/^\/admin\/invoice\/([^/]+)\/void$/);
        if (ivv && m === "POST") {
          if (!(await isAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, 401);
          const S = await loadSettings(env);
          const r = await voidInvoice(env, S, ivv[1]);
          return redirect("/admin/invoice/" + encodeURIComponent(ivv[1]) + "?flash=" + encodeURIComponent(r.ok ? "Invoice voided." : (r.error || "Could not void.")));
        }
      }
      // Public short link for the texted pay URL. No auth: the id IS the secret, and
      // it only ever redirects to Stripe's own hosted page.
      {
        const short = p.match(/^\/inv\/([^/]+)$/);
        if (short && m === "GET") {
          const row = await env.DB.prepare("SELECT hosted_url FROM invoices WHERE id=?1").bind(short[1]).first();
          if (row && row.hosted_url) return Response.redirect(row.hosted_url, 302);
          return html('<!DOCTYPE html><meta charset="utf-8"><title>Invoice not found</title>' +
            '<div style="font:16px/1.6 system-ui;max-width:34em;margin:12vh auto;padding:0 5vw">' +
            "<h1>We couldn't find that invoice</h1><p>The link may be old or mistyped. " +
            'Give us a call at <a href="tel:8015643164">801-564-3164</a> and we\'ll sort it out.</p></div>', 404);
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
        // Honeypot tripped. Book nothing, but fail LOUDLY rather than faking success:
        // if this ever misfires on a real person, they must be told to call, not
        // handed a fake confirmation for a job that was never scheduled.
        if (isBotSubmission(body)) {
          console.warn("[honeypot] dropped submission");
          return json({ ok: false, errors: ["We couldn't process that submission. Please call " + (S.business?.phone || "801-564-3164") + " and we'll book it for you."] }, 400);
        }
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
        // Opening the link is the strongest signal we get that they heard us —
        // stop the follow-up ladder even if they never pick a star. Never let a
        // tracking write break the page they came to see.
        try { await markReviewClicked(env, rr[1]); } catch (e) { console.error("[review click]", e); }
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

  // Runs HOURLY. The review follow-up ladder needs finer resolution than a daily
  // tick (+24h/+24h/+48h from whenever the previous message went out), and freeing
  // stale unpaid holds hourly is strictly better than daily. The reminder sweep is
  // the one job that must fire at a civilised hour, so it is gated to 10:00 local
  // rather than run every pass.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const S = await loadSettings(env);
      // Run the sweeps independently so one failing can't abort the others.
      // NOTE: the FIRST review ask is still owner-triggered (startReview on "mark
      // complete"). Only the follow-ups to an unanswered ask run on the cron.
      await expireStaleHolds(env, S).catch((e) => console.error("[cron expire]", e));
      await runReviewFollowups(env, S).catch((e) => console.error("[cron review followup]", e));

      const localHour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: S.business.timezone, hour: "numeric", hour12: false,
      }).format(new Date()));
      if (localHour === (Number(S.reminderHourLocal) || 10)) {
        await runReminderSweep(env, S).catch((e) => console.error("[cron reminder]", e));
      }
    })());
  },
};
