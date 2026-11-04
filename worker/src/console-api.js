// The Pull Count console (admin.triplerdump.com, a separate Cloudflare Pages project) writes the
// day's jobs through here. Server to server only: every request carries
//   x-console-key   = CONSOLE_API_KEY, a secret both sides hold (never sent to a browser)
//   x-console-user  = who tapped it, and x-console-role = owner | driver  (for console_log)
// The console checks its own logins; this side checks the key, validates, and does exactly what
// /admin does for the same tap (same queries, same texts), so the two can run side by side.
//
//   POST /api/console/booking/<id>/delivered    { bin, pickup? }  delivered_at + bin_no; pickup = new pickup day (dropped early)
//   POST /api/console/booking/<id>/completed    { weight }    status completed + the review ask, as /admin
//   POST /api/console/booking/<id>/pickup-date  { date }      as /admin: reminders re-arm, notes get a stamp
//   POST /api/console/booking/<id>/cancel                     status cancelled            (owners)
//   POST /api/console/booking/<id>/notes        { notes }
//   POST /api/console/text     { booking, message }           a text to the customer (see CONSOLE_TEXT_MODE)
//   POST /api/console/invoice  { customer_name, email, phone, company, booking_id, items, taxable, ask_review, job_ref }  (owners)
//   POST /api/console/invoice/<id>/resend | /void                                       (owners)
//   POST /api/console/invoice/<id>/notice   { on }       the final notice text on or off for that invoice (owners)
//   POST /api/console/booking/<id>/details   { name, phone, email, address }             (owners)
//   POST /api/console/booking/<id>/dates     { delivery, pickup }  move the drop-off; reminders re-arm (owners)
//   POST /api/console/booking/<id>/size      { size }      a different bin; the price difference is noted, not charged (owners)
//   POST /api/console/booking/<id>/swap      { date }      a bin switch that day, as its own job, billed by invoice (owners)
//   POST /api/console/book     { ...the /book form, pay: link|cash|invoice|terminal, price_cents? }   a booking taken by phone (owners);
//                              price_cents = his own pre-tax price for this job instead of the price list;
//                              the fuel charge goes on past 30 miles like /book, unless no_fuel: true
//   POST /api/console/fuel     { address }    the fuel charge "Take a booking" shows for that address (owners)
//   POST /api/console/hold     { contract: {id, company, contact, phone, email, site, city, start, term}, bins: ["20", ...] }
//                              a signed contract's bins, held as open jobs billed monthly (payment_type contract)
//   POST /api/console/settings { bins, extraDay, swapFee, addons, includedDays, radius, fuelMile {free, base, rate}, limits, closed, lists, templates, smsOff, review } (owners)
//
// CONSOLE_TEXT_MODE: until it's "customers", texts the console writes go to the owner's phone instead,
// marked with who they were for, so Joseph sees them first. Texts /admin already sends (the review ask,
// the invoice link) are unchanged.
import { loadSettings } from "./settings.js";
import { startReview } from "./review.js";
import { createInvoice, resendInvoice, voidInvoice, setFinalNotice, totalsFor } from "./invoice.js";
import { sendInvoiceSms } from "./sms.js";
import { isISODate, todayISO } from "./util.js";
import { saveSetting } from "./settings.js";
import { createBooking, genRef, fuelQuote } from "./booking.js";
import { CONFIG } from "./config.js";

const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (error, status = 400) => J({ ok: false, error }, status);
const nowIso = () => new Date().toISOString();
const newId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
function same(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
// what a driver may do; everything else is an owner's
const DRIVER_OK = new Set(["delivered", "completed", "text", "notes"]);

async function log(env, who, action, target, detail) {
  try {
    await env.DB.prepare("INSERT INTO console_log (id, at, by_user, role, action, target, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
      .bind(newId(), nowIso(), who.user, who.role, action, target || null, detail ? JSON.stringify(detail) : null).run();
  } catch (e) { console.error("[console] log failed", e); }
}
const bookingOut = (b) => b && ({ id: b.id, status: b.status, delivery_date: b.delivery_date, pickup_date: b.pickup_date, delivered_at: b.delivered_at || null, bin_no: b.bin_no || null, completed_at: b.completed_at || null, notes: b.notes || "" });

export async function consoleApi(request, env, url) {
  if (request.method !== "POST") return fail("POST only.", 405);
  if (!env.CONSOLE_API_KEY || !same(request.headers.get("x-console-key"), env.CONSOLE_API_KEY)) return fail("unauthorized", 401);
  const who = { user: String(request.headers.get("x-console-user") || "console").slice(0, 80), role: request.headers.get("x-console-role") === "driver" ? "driver" : "owner" };
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const p = url.pathname.replace(/^\/api\/console\/?/, "");

  // ---- a booking ----
  const bm = /^booking\/([A-Za-z0-9-]{1,40})\/(delivered|completed|pickup-date|cancel|notes|details|dates|size|swap|paid)$/.exec(p);
  if (bm) {
    const [, id, act] = bm;
    if (who.role === "driver" && !DRIVER_OK.has(act)) return fail("A driver can't do that.", 403);  // details, dates, size, swap: owners
    const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(id).first();
    if (!b) return fail("That booking isn't in the system.", 404);
    const reload = async () => bookingOut(await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(id).first());

    if (act === "delivered") {
      if (b.status === "cancelled") return fail("That booking was cancelled.");
      const bin = String(body.bin || "").trim().slice(0, 20) || null;
      await env.DB.prepare("UPDATE bookings SET delivered_at=COALESCE(delivered_at, ?1), bin_no=COALESCE(?2, bin_no) WHERE id=?3").bind(nowIso(), bin, id).run();
      // dropped off before its day: the pickup keeps the same rental length from today, as the console showed
      const today = todayISO(), np = String(body.pickup || "").trim();
      if (isISODate(np) && np >= today && np !== b.pickup_date) {
        const days = Math.max(1, Math.round((Date.parse(np) - Date.parse(today)) / 864e5));
        const stamp = "Dropped off early " + today + " (was " + b.delivery_date + "); pickup moved " + b.pickup_date + " to " + np + " (" + who.user + ")";
        await env.DB.prepare(
          "UPDATE bookings SET pickup_date=?1, rental_days=?2, pickup_reminder_sent_at=NULL, owner_pickup_reminder_sent_at=NULL, owner_complete_nudge_sent_at=NULL, " +
          "notes=CASE WHEN notes IS NULL OR notes='' THEN ?3 ELSE notes || char(10) || ?3 END WHERE id=?4"
        ).bind(np, days, stamp, id).run();
      }
      await log(env, who, "delivered", id, { bin, pickup: isISODate(np) ? np : null });
      return J({ ok: true, booking: await reload() });
    }
    if (act === "completed") {
      if (b.status === "cancelled") return fail("That booking was cancelled.");
      const w = Number(body.weight);
      await env.DB.prepare("UPDATE bookings SET status='completed', completed_at=COALESCE(completed_at, ?1), weight_tons=COALESCE(?2, weight_tons), delivered_at=COALESCE(delivered_at, ?1) WHERE id=?3")
        .bind(nowIso(), Number.isFinite(w) && w > 0 ? Math.round(w * 100) / 100 : null, id).run();
      // the review ask, exactly as /admin's "completed" does it (it skips anyone already asked or rated)
      let review = "failed";
      if (b.status !== "completed") {
        try {
          const S = await loadSettings(env);
          const r = await startReview(env, S, await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(id).first());
          review = r && r.sent ? "sent" : (r && r.skipped ? "skipped" : "failed");
        } catch (e) { console.error("[console] startReview", e); }
      } else review = "already-done";
      await log(env, who, "completed", id, { weight: body.weight || null, review });
      return J({ ok: true, review, booking: await reload() });
    }
    if (act === "pickup-date") {
      const nd = String(body.date || "").trim();
      if (!isISODate(nd) || nd < b.delivery_date) return fail("Pick a pickup day on or after the drop-off.");
      if (nd !== b.pickup_date) {
        const days = Math.max(1, Math.round((Date.parse(nd) - Date.parse(b.delivery_date)) / 864e5));
        const stamp = "Pickup moved " + b.pickup_date + " to " + nd + " (" + nowIso().slice(0, 10) + ", " + who.user + ")";
        await env.DB.prepare(
          "UPDATE bookings SET pickup_date=?1, rental_days=?2, pickup_reminder_sent_at=NULL, owner_pickup_reminder_sent_at=NULL, owner_complete_nudge_sent_at=NULL, " +
          "notes=CASE WHEN notes IS NULL OR notes='' THEN ?3 ELSE notes || char(10) || ?3 END WHERE id=?4"
        ).bind(nd, days, stamp, id).run();
      }
      await log(env, who, "pickup-date", id, { from: b.pickup_date, to: nd });
      return J({ ok: true, booking: await reload() });
    }
    if (act === "cancel") {
      await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=?1").bind(id).run();
      await log(env, who, "cancel", id, { was: b.status });
      return J({ ok: true, booking: await reload() });
    }
    // ---- owners: the booking's details, its days, its size, a swap ----
    const stampNote = (line) => env.DB.prepare("UPDATE bookings SET notes=CASE WHEN notes IS NULL OR notes='' THEN ?1 ELSE notes || char(10) || ?1 END WHERE id=?2").bind(line, id).run();
    const day = nowIso().slice(0, 10);
    if (act === "details") {
      const name = String(body.name || "").trim().slice(0, 120), phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
      const email = String(body.email || "").trim().slice(0, 160), address = String(body.address || "").trim().slice(0, 240);
      if (name.length < 2) return fail("Their name is too short.");
      if (phone.length !== 10) return fail("That phone number needs 10 digits.");
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That email doesn't look right.");
      if (address.length < 5) return fail("Add the full address.");
      await env.DB.prepare("UPDATE bookings SET customer_name=?1, phone=?2, email=?3, pickup_address=CASE WHEN pickup_address IS NULL OR pickup_address=address THEN ?4 ELSE pickup_address END, address=?4 WHERE id=?5")
        .bind(name, phone, email || b.email, address, id).run();
      await log(env, who, "details", id, { name, phone, email, address });
      return J({ ok: true, booking: await reload() });
    }
    if (act === "dates") {
      const dd = String(body.delivery || "").trim(), pd = String(body.pickup || dd).trim();
      if (!isISODate(dd) || !isISODate(pd) || pd < dd) return fail("Pick a drop-off day, and a pickup on or after it.");
      if (b.status === "cancelled" || b.status === "completed") return fail("That job is " + b.status + ".");
      const days = Math.max(1, Math.round((Date.parse(pd) - Date.parse(dd)) / 864e5));
      await env.DB.prepare("UPDATE bookings SET delivery_date=?1, pickup_date=?2, rental_days=?3, reminder_sent_at=NULL, pickup_reminder_sent_at=NULL, owner_pickup_reminder_sent_at=NULL, owner_complete_nudge_sent_at=NULL WHERE id=?4")
        .bind(dd, pd, days, id).run();
      await stampNote("Moved: drop-off " + b.delivery_date + " to " + dd + ", pickup " + b.pickup_date + " to " + pd + " (" + day + ", " + who.user + ")");
      await log(env, who, "dates", id, { from: [b.delivery_date, b.pickup_date], to: [dd, pd] });
      return J({ ok: true, booking: await reload() });
    }
    if (act === "paid") {
      if (b.paid_at) return J({ ok: true, booking: await reload() });
      const how = ["cash", "check", "card", "other"].includes(body.how) ? body.how : "cash";
      await env.DB.prepare("UPDATE bookings SET status=CASE WHEN status IN ('confirmed', 'pending') THEN 'paid' ELSE status END, paid_at=?1 WHERE id=?2").bind(nowIso(), id).run();
      await stampNote("Paid by " + how + " (" + day + ", " + who.user + ")");
      await log(env, who, "paid", id, { how });
      return J({ ok: true, booking: await reload() });
    }
    if (act === "size" || act === "swap") {
      const S = await loadSettings(env);
      if (act === "size") {
        const size = String(body.size || "").trim();
        if (!S.bins[size]) return fail("That size isn't on your price list.");
        const was = b.bin_size, tier = b.rental_tier || "4-7";
        const diff = ((S.bins[size].prices || {})[tier] || 0) - (((S.bins[was] || {}).prices || {})[tier] || 0);
        await env.DB.prepare("UPDATE bookings SET bin_size=?1 WHERE id=?2").bind(size, id).run();
        await stampNote("Size changed " + was + " yd to " + size + " yd" + (diff ? " ($" + (Math.abs(diff) / 100).toFixed(2) + (diff > 0 ? " more" : " less") + " than booked)" : "") + " (" + day + ", " + who.user + ")");
        await log(env, who, "size", id, { from: was, to: size, diff_cents: diff });
        return J({ ok: true, diff_cents: diff, booking: await reload() });
      }
      const date = String(body.date || "").trim();
      if (!isISODate(date) || date < todayISO(S.business.timezone)) return fail("Pick a day for the swap.");
      const fee = Math.round((S.services.binswitch && S.services.binswitch.pricing && S.services.binswitch.pricing.flat_cents) || 0);
      const tax = Math.round(fee * S.taxRate), nid = genRef(), ts = nowIso();
      await env.DB.prepare(
        "INSERT INTO bookings (id, created_at, status, account_type, service_type, customer_name, phone, email, company, bin_size, delivery_date, pickup_date, rental_days, " +
        "address, pickup_address, agreed_terms, subtotal_cents, tax_cents, amount_cents, deposit_cents, discount_cents, payment_type, notes) " +
        "VALUES (?1, ?2, 'confirmed', ?3, 'binswitch', ?4, ?5, ?6, ?7, ?8, ?9, ?9, 1, ?10, ?10, 1, ?11, ?12, ?13, 0, 0, 'invoice', ?14)"
      ).bind(nid, ts, b.account_type || "residential", b.customer_name, b.phone, b.email, b.company, b.bin_size, date, b.address, fee, tax, fee + tax, "Swap for " + id + " (" + who.user + ")").run();
      await stampNote("Swap booked " + date + " as " + nid + " (" + day + ", " + who.user + ")");
      await log(env, who, "swap", id, { swap: nid, date, fee_cents: fee });
      return J({ ok: true, swap: { id: nid, date, amount_cents: fee + tax }, booking: await reload() });
    }
    if (act === "notes") {
      const notes = String(body.notes == null ? "" : body.notes).slice(0, 4000);
      await env.DB.prepare("UPDATE bookings SET notes=?1 WHERE id=?2").bind(notes, id).run();
      await log(env, who, "notes", id, null);
      return J({ ok: true, booking: await reload() });
    }
  }

  // ---- a text to a customer ----
  if (p === "text") {
    const id = String(body.booking || ""), message = String(body.message || "").trim().slice(0, 1200);
    let b = id ? await env.DB.prepare("SELECT id, customer_name, phone FROM bookings WHERE id=?1").bind(id).first() : null;
    // no booking yet (a contract's contact): their number, the same preview rule
    if (!b && !id && String(body.phone || "").replace(/\D/g, "").length >= 10) b = { id: null, customer_name: String(body.name || "a customer").slice(0, 80), phone: String(body.phone).replace(/\D/g, "").slice(-10) };
    if (!b) return fail("That booking isn't in the system.", 404);
    if (!message) return fail("The text is empty.");
    const S = await loadSettings(env);
    const live = env.CONSOLE_TEXT_MODE === "customers";
    const to = live ? b.phone : S.ownerPhone;
    if (!to) return fail(live ? "There's no phone number on that booking." : "No owner phone is set, so the preview has nowhere to go.");
    const body2 = live ? message : "[Preview of a text to " + b.customer_name + ", " + b.phone + "] " + message;
    const r = await sendInvoiceSms(S, to, body2);
    await log(env, who, "text", id, { mode: live ? "customers" : "owner", sent: !!(r && r.ok), message });
    if (r && r.skipped) return fail("Texting isn't set up in this system.");
    if (!r || !r.ok) return fail("The text didn't go out. Try again in a minute.", 502);
    return J({ ok: true, mode: live ? "customers" : "owner" });
  }

  // ---- a booking taken by phone: his own /book rules, except an owner can book any day ----
  if (p === "book") {
    if (who.role === "driver") return fail("A driver can't do that.", 403);
    const S = await loadSettings(env);
    const pay = ["link", "cash", "invoice", "terminal"].includes(body.pay) ? body.pay : "link";
    // a payment link is a Stripe invoice (texted and emailed, never expires), so it needs their email
    if (pay === "link" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email || "").trim())) return fail("A payment link goes by email too, so add their email. Or pick cash, or card at the door.");
    const S2 = Object.assign({}, S, { leadHours: 0, sameDayCutoff: "", closedDates: {}, runDays: [0, 1, 2, 3, 4, 5, 6], requirePayment: false, ownerBooking: true });
    const input = Object.assign({}, body, { account_type: "residential", agreed_terms: true, sms_consent: body.sms_consent !== false, permit_needed: body.permit_needed || "no",
      // one of his placement options, or his first one
      ground_condition: S.groundConditions.includes(body.ground_condition) ? body.ground_condition : (S.groundConditions[0] || CONFIG.groundConditions[0]) });
    const r = await createBooking(env, S2, input);
    if (!r.ok) return J({ ok: false, error: (r.errors || [r.error]).join(" ") }, 400);
    const bk = r.booking;
    await env.DB.prepare("UPDATE bookings SET payment_type=?1, notes=CASE WHEN notes IS NULL OR notes='' THEN ?2 ELSE notes || char(10) || ?2 END WHERE id=?3")
      .bind(pay, "Taken by phone (" + who.user + "), pays by " + (pay === "link" ? "payment link" : pay), bk.id).run();
    let invoice = null;
    if (pay === "link") {
      const due = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
      const items = [{ description: (bk.bin_size ? bk.bin_size + " yard dumpster" : "Rental") + ", " + bk.delivery_date + " to " + bk.pickup_date + " (" + bk.id + ")", qty: 1,
        unit_cents: bk.subtotal_cents - (bk.addons || []).reduce((n, a) => n + a.cents, 0) }].concat((bk.addons || []).map((a) => ({ description: a.label, qty: 1, unit_cents: a.cents })));
      invoice = await createInvoice(env, S, { customer_name: bk.customer_name, email: bk.email, phone: bk.phone, company: "", booking_id: bk.id, items, due_date: due, taxable: true, terms: S.invoiceTerms || "", notes: "Booked by phone", ask_review: false });
      if (!invoice.ok) {
        await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=?1").bind(bk.id).run();
        return fail("The payment link didn't go out (" + (invoice.error || "Stripe") + "), so nothing was booked. Try again, or pick cash.");
      }
    }
    await log(env, who, "book", bk.id, { pay, total_cents: r.totals && r.totals.amount_cents, invoice: invoice && invoice.number, price_cents: body.price_cents != null && body.price_cents !== "" ? Number(body.price_cents) : undefined, no_fuel: body.no_fuel === true || undefined });
    return J({ ok: true, id: bk.id, pay, totals: r.totals, booking: bk, invoice: invoice && { number: invoice.number, url: invoice.hosted_url } });
  }

  // ---- the fuel charge for the address he's typing in "Take a booking" (the same answer the booking uses) ----
  if (p === "fuel") {
    if (who.role === "driver") return fail("A driver can't do that.", 403);
    return J(await fuelQuote(await loadSettings(env), String(body.address || "").slice(0, 200), true));
  }

  // ---- a signed contract: each bin is held as an open job in his system ----
  if (p === "hold") {
    if (who.role === "driver") return fail("A driver can't do that.", 403);
    const c = body.contract || {}, bins = (Array.isArray(body.bins) ? body.bins : []).map((x) => String(x).replace(/\D/g, "")).filter(Boolean).slice(0, 40);
    if (!/^CT-\d+$/.test(String(c.id || ""))) return fail("Which contract?");
    if (!bins.length) return fail("The contract has no bins.");
    const S = await loadSettings(env);
    const start = isISODate(c.start) && c.start >= todayISO(S.business.timezone) ? c.start : todayISO(S.business.timezone);
    const months = Math.max(1, Math.min(60, Number(c.term) || 12));
    const end = (() => { const d = new Date(start + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); })();
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 864e5), ts = nowIso(), ids = [];
    const phone = String(c.phone || "").replace(/\D/g, "").slice(-10), addr = [c.site, c.city].filter(Boolean).join(", ") + ", UT";
    for (const yd of bins) {
      const nid = genRef();
      await env.DB.prepare(
        "INSERT INTO bookings (id, created_at, status, account_type, service_type, customer_name, phone, email, company, bin_size, delivery_date, pickup_date, rental_days, " +
        "address, pickup_address, agreed_terms, subtotal_cents, tax_cents, amount_cents, deposit_cents, discount_cents, payment_type, notes) " +
        "VALUES (?1, ?2, 'confirmed', 'commercial', 'dumpster', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, 1, 0, 0, 0, 0, 0, 'contract', ?12)"
      ).bind(nid, ts, String(c.contact || c.company || "").slice(0, 120), phone, String(c.email || ""), String(c.company || "").slice(0, 120), yd, start, end, days, addr,
        "Contract " + c.id + ": billed monthly on the contract, not this booking (" + who.user + ")").run();
      ids.push(nid);
    }
    await log(env, who, "hold", c.id, { bins, ids, start, end });
    return J({ ok: true, ids, start, end });
  }

  // ---- a text to someone on his team (a driver's run): straight to them ----
  if (p === "text-staff") {
    if (who.role === "driver") return fail("A driver can't do that.", 403);
    const to = String(body.phone || "").replace(/\D/g, "").slice(-10), message = String(body.message || "").trim().slice(0, 1200);
    if (to.length !== 10) return fail("That phone number needs 10 digits.");
    if (!message) return fail("The text is empty.");
    const S = await loadSettings(env);
    const r = await sendInvoiceSms(S, to, message);
    await log(env, who, "text-staff", null, { to, sent: !!(r && r.ok) });
    if (!r || !r.ok) return fail("The text didn't go out. Try again in a minute.", 502);
    return J({ ok: true });
  }

  // ---- his settings, from the console's Prices and Setup (owners). Only what's sent changes. ----
  if (p === "settings") {
    if (who.role === "driver") return fail("A driver can't do that.", 403);
    const raw = {};
    for (const r of ((await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('bins', 'fees', 'services', 'closed_dates', 'sms_templates')").all()).results || [])) {
      try { raw[r.key] = JSON.parse(r.value); } catch (e) {}
    }
    const cents = (v) => Math.round(Number(v) * 100);
    const okC = (c) => Number.isFinite(c) && c >= 0 && c <= 10000000;
    const changed = [];
    const put = async (key, val) => { await saveSetting(env, key, val); changed.push(key); };
    let fees = raw.fees ? Object.assign({}, raw.fees) : null;
    if (Array.isArray(body.bins)) {
      const bins = JSON.parse(JSON.stringify(raw.bins || CONFIG.bins));
      fees = fees || {};
      for (const x of body.bins) {
        const yd = String(x.yd || "").replace(/\D/g, "").slice(0, 3);
        if (!yd) continue;
        const c = cents(x.price);
        if (!okC(c) || c === 0) return fail("Give the " + yd + " yard a price.");
        const cur = bins[yd] || { label: yd + " yard", inventory: 0, prices: {} };
        cur.label = String(x.label || cur.label || yd + " yard").slice(0, 40);
        cur.prices = { "1-3": c, "4-7": c };   // one price per bin (Joseph's Sep 30 prices)
        cur.inventory = Math.max(0, Math.min(200, Math.round(Number(x.own) || 0)));
        cur.hidden = x.hidden === true;
        if (x.blurb !== undefined) cur.blurb = String(x.blurb || "").slice(0, 200);
        bins[yd] = cur;
        if (x.tons !== undefined && Number(x.tons) >= 0) fees["tons" + yd] = Number(x.tons);
      }
      await put("bins", bins);
    }
    if (body.extraDay !== undefined) { const c = cents(body.extraDay); if (!okC(c)) return fail("The daily rate doesn't look right."); fees = Object.assign({}, fees || {}, { extensionDay: c }); }
    if (fees && (Array.isArray(body.bins) || body.extraDay !== undefined)) await put("fees", fees);
    if (body.swapFee !== undefined) {
      const c = cents(body.swapFee); if (!okC(c)) return fail("The swap fee doesn't look right.");
      const svc = Object.assign({}, raw.services || {});
      svc.binswitch = Object.assign({}, svc.binswitch || {}, { pricing: Object.assign({}, (svc.binswitch || {}).pricing || {}, { flat_cents: c }) });
      await put("services", svc);
    }
    if (Array.isArray(body.addons)) {
      const list = body.addons.map((a) => ({ k: String(a.k || "").replace(/[^a-z0-9-]/gi, "").slice(0, 24), label: String(a.label || "").trim().slice(0, 60), cents: cents(a.price), on: a.on !== false }))
        .filter((a) => a.k && a.label && okC(a.cents) && a.cents > 0);
      await put("addons", list);
    }
    if (body.dailyRuns !== undefined) { const n = Math.round(Number(body.dailyRuns)); if (!(n >= 0 && n <= 200)) return fail("Runs a day has to be 0 to 200."); await put("daily_runs", n || null); }
    if (body.includedDays !== undefined) { const n = Math.round(Number(body.includedDays)); if (!(n >= 4 && n <= 30)) return fail("Days included has to be 4 to 30."); await put("included_days", n); }
    if (body.radius !== undefined) { const n = Number(body.radius); if (!(n >= 0 && n <= 300)) return fail("The delivery area has to be 0 to 300 miles."); await put("service_radius_miles", Math.round(n)); }
    // the fuel charge: { free: miles included, base: dollars once past them, rate: dollars a mile past them } (settings.js fuelFor)
    if (body.fuelMile && typeof body.fuelMile === "object") {
      const free = Math.round(Number(body.fuelMile.free)), c = cents(body.fuelMile.rate);
      // a console tab from before the starting charge sends no base: keep what's set (settings.js reads a missing one as the default)
      const b = body.fuelMile.base === undefined ? null : cents(body.fuelMile.base);
      if (!(free >= 0 && free <= 300)) return fail("Free miles has to be 0 to 300.");
      if (!okC(c) || c > 2500) return fail("The fuel charge has to be $0 to $25 a mile.");
      if (b !== null && (!okC(b) || b > 50000)) return fail("The starting fuel charge has to be $0 to $500.");
      await put("fuel_per_mile", b === null ? { free, cents: c } : { free, base: b, cents: c });
    }
    if (body.limits) {
      const L = body.limits;
      if (Array.isArray(L.runDays)) { const d = L.runDays.map(Number).filter((x) => x >= 0 && x <= 6); if (!d.length) return fail("Pick at least one day you run."); await put("run_days", d); }
      if (L.leadHours !== undefined) { const n = Number(L.leadHours); if (!(n >= 0 && n <= 240)) return fail("Notice has to be 0 to 240 hours."); await put("lead_hours", n); }
      if (L.cutoff !== undefined) { const c = String(L.cutoff || ""); if (c && !/^\d{1,2}:\d{2}$/.test(c)) return fail("The cut-off time doesn't look right."); await put("same_day_cutoff", c); }
    }
    if (body.closed && typeof body.closed === "object") {
      const cd = Object.assign({}, raw.closed_dates || {});
      for (const [d, why] of Object.entries(body.closed)) { if (!isISODate(d)) continue; if (why) cd[d] = String(why).slice(0, 80); else delete cd[d]; }
      const old = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);   // long-past days drop off
      for (const d of Object.keys(cd)) if (d < old) delete cd[d];
      await put("closed_dates", cd);
    }
    if (body.lists) {
      if (Array.isArray(body.lists.place)) { const l = body.lists.place.map((x) => String(x).trim().slice(0, 60)).filter(Boolean); if (!l.length) return fail("Keep at least one place the bin can go."); await put("ground_conditions", l); }
      if (Array.isArray(body.lists.debris)) await put("debris_list", body.lists.debris.map((x) => String(x).trim().slice(0, 60)).filter(Boolean));
    }
    const TPL = ["confirmation", "reminder_sms", "pickup_reminder", "review", "console_dropped", "console_pickedup"];
    if (body.templates && typeof body.templates === "object") {
      const t = Object.assign({}, raw.sms_templates || {});
      for (const [k, v] of Object.entries(body.templates)) if (TPL.includes(k) && String(v || "").trim()) t[k] = String(v).trim().slice(0, 600);
      await put("sms_templates", t);
    }
    if (Array.isArray(body.smsOff)) await put("sms_off", body.smsOff.filter((k) => TPL.includes(k)));
    if (body.review) {
      if (body.review.on !== undefined) await put("review_off", body.review.on === false);
      if (body.review.link) { const l = String(body.review.link).trim(); if (!/^https:\/\//.test(l)) return fail("The review link has to start with https://"); await put("review_link", l.slice(0, 300)); }
    }
    await log(env, who, "settings", null, { changed });
    return J({ ok: true, changed });
  }

  // ---- invoices (owners) ----
  if (p === "invoice" || /^invoice\/[A-Za-z0-9-]{1,40}\/(resend|void|notice)$/.test(p)) {
    if (who.role === "driver") return fail("A driver can't do that.", 403);
    const S = await loadSettings(env);
    if (p === "invoice") {
      const items = (Array.isArray(body.items) ? body.items : []).map((i) => ({
        description: String(i.description || "").trim().slice(0, 200), qty: Math.max(1, Math.round(Number(i.qty) || 1)), unit_cents: Math.round(Number(i.unit_cents) || 0)
      })).filter((i) => i.description && i.unit_cents !== 0);
      const due = new Date(Date.now() + (Number(S.invoiceDueDays) || 14) * 864e5).toISOString().slice(0, 10);
      const r = await createInvoice(env, S, {
        customer_name: String(body.customer_name || "").trim(), email: String(body.email || "").trim(), phone: String(body.phone || "").trim(),
        company: String(body.company || "").trim(), booking_id: String(body.booking_id || "").trim() || null, items,
        due_date: due, taxable: body.taxable !== false, terms: S.invoiceTerms || "", notes: "Made in the console by " + who.user, ask_review: !!body.ask_review,
        job_ref: body.job_ref,
      });
      await log(env, who, "invoice", r.id || null, { ok: r.ok, error: r.error || null, total_cents: totalsFor(items, S.taxRate, body.taxable !== false).total_cents });
      return r.ok ? J({ ok: true, id: r.id, number: r.number, hosted_url: r.hosted_url, final_notice_date: r.final_notice_date }) : fail(r.error || "Couldn't make the invoice.");
    }
    const [, iid, act] = /^invoice\/([A-Za-z0-9-]+)\/(resend|void|notice)$/.exec(p);
    if (act === "notice") {
      const r = await setFinalNotice(env, S, iid, body.on === true);
      await log(env, who, "invoice-notice", iid, { ok: r.ok, on: body.on === true, date: r.date || null, error: r.error || null });
      return r.ok ? J({ ok: true, on: r.on, date: r.date }) : fail(r.error || "That didn't work.");
    }
    const r = act === "resend" ? await resendInvoice(env, S, iid) : await voidInvoice(env, S, iid);
    await log(env, who, "invoice-" + act, iid, { ok: r.ok, error: r.error || null });
    return r.ok ? J({ ok: true }) : fail(r.error || "That didn't work.");
  }
  return fail("Unknown request.", 404);
}
