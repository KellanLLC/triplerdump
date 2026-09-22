import { todayISO, addDays, isISODate } from "./util.js";
import { quoteService, fillTemplate, itemLabel, lengthLabel, chargedCents, findDiscountCode } from "./settings.js";
import { sendBookingWebhook, sendCommercialLead } from "./sms.js";
import { createCheckout, markPaid } from "./stripe.js";

const SERVICE_INTEREST_LABELS = {
  dumpster: "Dumpster",
  trailer: "Dump Trailer",
  junk: "Junk Removal",
  binswitch: "Bin Switch",
  unsure: "Not sure",
};

const SERVICE_TYPES = ["dumpster", "trailer", "junk", "binswitch"];

// Business phone for customer-facing refusals — every dead end should hand the
// customer a way to reach Joseph instead of just a "no".
function bizPhone(S) {
  return (S.business && S.business.phone) || "801-564-3164";
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genRef() {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return "TRD-" + s;
}

// Day-of-week for a calendar date in the business timezone. Anchors at noon UTC
// to stay well away from any midnight/DST boundary. 0=Sun..6=Sat.
function weekdayInTz(iso, tz) {
  const wd = new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: tz, weekday: "short" });
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
}
function isWeekend(iso, tz) {
  const d = weekdayInTz(iso, tz);
  return d === 0 || d === 6;
}

function validate(input, S) {
  const errors = [];

  // Service type: default to "dumpster" so existing links/posts keep working.
  let serviceType = String(input.service_type || "dumpster").trim().toLowerCase();
  if (!SERVICE_TYPES.includes(serviceType)) serviceType = "dumpster";
  const isDumpster = serviceType === "dumpster";
  const isTrailer = serviceType === "trailer";
  const isJunk = serviceType === "junk";
  const isBinswitch = serviceType === "binswitch";

  // ----- Common fields (all services) -----
  let name = String(input.customer_name || "").trim();
  if (!name) name = [input.first_name, input.last_name].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
  if (name.length < 2) errors.push("Enter your name.");

  const phone = String(input.phone || "").replace(/[^\d]/g, "");
  if (phone.length < 10) errors.push("Enter a valid phone number.");

  const email = String(input.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("Enter a valid email.");

  const dropAddress = String(input.address || input.drop_address || "").trim();
  if (dropAddress.length < 5) errors.push("Enter the drop-off address.");

  const date = String(input.delivery_date || "").trim();
  if (!isISODate(date)) errors.push("Pick a delivery date.");

  const agreed = input.agreed_terms === true || input.agreed_terms === "true" || input.agreed_terms === "on" || input.agreed_terms === 1;
  if (!agreed) errors.push("You must agree to the terms.");

  // ----- Service-specific fields -----
  let size = "";
  let tier = "";
  let ground = "";
  let permitNeeded = 0;
  let permitObtainable = "";
  let rentalDays = null;
  let existingRef = "";

  if (isDumpster) {
    size = String(input.bin_size || "").trim();
    if (!S.bins[size]) errors.push("Pick a bin size (15, 20 or 25 yard).");

    tier = String(input.rental_tier || "").trim();
    if (!S.tiers[tier]) errors.push("Pick a rental length (1-3 or 4-7 day).");

    ground = String(input.ground_condition || "").trim();
    if (!S.groundConditions.includes(ground)) errors.push("Pick the drop-off ground condition.");

    const permitRaw = input.permit_needed;
    permitNeeded = (permitRaw === true || permitRaw === "yes" || permitRaw === "Yes" || permitRaw === 1 || permitRaw === "1") ? 1 : 0;
    const permitAnswered = permitRaw === true || permitRaw === false || ["yes", "no", "Yes", "No", 0, 1, "0", "1"].includes(permitRaw);
    if (!permitAnswered) errors.push("Tell us if a permit/HOA approval is needed.");
    permitObtainable = String(input.permit_obtainable || "").trim();
  } else if (isTrailer) {
    const svc = S.services && S.services.trailer;
    const minD = (svc && svc.pricing && svc.pricing.minDays) || 1;
    const maxD = (svc && svc.pricing && svc.pricing.maxDays) || 14;
    rentalDays = parseInt(input.rental_days, 10);
    if (!Number.isFinite(rentalDays) || rentalDays < minD || rentalDays > maxD) {
      errors.push(`Pick the number of rental days (${minD}-${maxD}).`);
    }
  } else if (isJunk) {
    // Weekend-only enforced server-side regardless of client.
    if (isISODate(date) && !isWeekend(date, S.business.timezone)) {
      errors.push("Junk removal is available on weekends (Saturday or Sunday) only.");
    }
  } else if (isBinswitch) {
    existingRef = String(input.existing_ref || "").trim();
  }

  const smsConsent = input.sms_consent === true || input.sms_consent === "true" || input.sms_consent === "on" || input.sms_consent === 1;
  const accountType = input.account_type === "commercial" ? "commercial" : "residential";

  return {
    errors,
    clean: {
      serviceType, size, tier, name, phone, email,
      dropAddress,
      pickupAddress: String(input.pickup_address || "").trim() || dropAddress,
      date,
      deliveryTime: String(input.delivery_time || "").trim(),
      ground,
      permitNeeded,
      permitObtainable,
      rentalDays,
      existingRef,
      company: String(input.company || "").trim(),
      message: String(input.message || "").trim(),
      promoCode: String(input.promo_code || "").trim(),
      smsConsent: smsConsent ? 1 : 0,
      accountType,
    },
  };
}

// Commercial leads are a SEPARATE, unpriced flow ("request a quote"). No size/tier,
// no day-range, no ground/permit, no pricing - just enough to let Joseph reach out.
function validateLead(input) {
  const errors = [];

  const company = String(input.company || "").trim();
  if (company.length < 2) errors.push("Enter your company name.");

  let name = String(input.customer_name || "").trim();
  if (!name) name = [input.first_name, input.last_name].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
  if (name.length < 2) errors.push("Enter a contact name.");

  const phone = String(input.phone || "").replace(/[^\d]/g, "");
  if (phone.length < 10) errors.push("Enter a valid phone number.");

  const email = String(input.email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("Enter a valid email.");

  const address = String(input.address || input.drop_address || "").trim();
  if (address.length < 5) errors.push("Enter the job site address.");

  const details = String(input.message || input.details || "").trim();
  if (details.length < 2) errors.push("Tell us a bit about what you need.");

  // Same terms gate as the residential flow — the form always sends it, so this
  // only stops direct API posts from skipping the agreement.
  const agreed = input.agreed_terms === true || input.agreed_terms === "true" || input.agreed_terms === "on" || input.agreed_terms === 1;
  if (!agreed) errors.push("You must agree to the terms.");

  // Optional "what do you need?" - normalize to a known label; default "Not sure".
  let interestKey = String(input.service_interest || input.service_type || "").trim().toLowerCase();
  if (!SERVICE_INTEREST_LABELS[interestKey]) interestKey = "unsure";
  const serviceInterest = SERVICE_INTEREST_LABELS[interestKey];

  return {
    errors,
    clean: {
      company, name, phone, email, address, details,
      timeframe: String(input.timeframe || "").trim(),
      serviceInterest,
      smsConsent: (input.sms_consent === true || input.sms_consent === "true" || input.sms_consent === "on" || input.sms_consent === 1) ? 1 : 0,
    },
  };
}

// Handle a commercial lead: store an unpriced row (status 'quote_requested'),
// alert the owner, and return a "we'll reach out" shape for the lead form.
// NOTE: reuses existing columns. NOT-NULL columns that don't apply to a lead get
// safe placeholders (bin_size='', rental_days=0, pickup_date=delivery_date||created date)
// while pricing/tier columns stay NULL.
async function createCommercialLead(env, S, input) {
  const { errors, clean } = validateLead(input);
  if (errors.length) return { ok: false, errors };

  const id = genRef();
  const now = new Date().toISOString();
  const today = todayISO(S.business.timezone);

  // Fold the service-of-interest + timeframe into message/notes so nothing is lost.
  const messageParts = [];
  if (clean.serviceInterest) messageParts.push("Interested in: " + clean.serviceInterest);
  if (clean.timeframe) messageParts.push("Timeframe: " + clean.timeframe);
  if (clean.details) messageParts.push(clean.details);
  const message = messageParts.join(" | ");
  const notes = "Commercial quote request. Interest: " + clean.serviceInterest +
    (clean.timeframe ? ". Timeframe: " + clean.timeframe : "");

  await env.DB.prepare(
    `INSERT INTO bookings
       (id, created_at, status, account_type, service_type, customer_name, phone, email, company, message,
        bin_size, rental_tier, delivery_date, delivery_time, pickup_date, rental_days,
        address, pickup_address, ground_condition, permit_needed, permit_obtainable,
        agreed_terms, subtotal_cents, tax_cents, amount_cents, deposit_cents, payment_type, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, "quote_requested", "commercial", "dumpster", clean.name, clean.phone, clean.email, clean.company, message,
    "", null, today, "", today, 0,
    clean.address, clean.address, null, null, null,
    1, null, null, null, null, null, notes
  ).run();

  const lead = {
    id,
    company: clean.company,
    customer_name: clean.name,
    phone: clean.phone,
    email: clean.email,
    address: clean.address,
    timeframe: clean.timeframe,
    service_interest: clean.serviceInterest,
    details: clean.details,
  };

  try { await sendCommercialLead(S, lead); } catch (e) { console.error("[commercial lead webhook]", e); }

  return {
    ok: true,
    lead: true,
    id,
    message: "Request received - Joseph will reach out shortly to set up your job. Need it sooner? Call " + (S.business.phone || "") + ".",
  };
}

// Dumpster capacity: counts bins whose rental window overlaps [delivery,pickup].
// Scoped to service_type='dumpster' so trailer/junk/binswitch rows don't consume
// bin capacity. Legacy rows have service_type defaulting to 'dumpster'.
async function overlapCounts(env, deliveryDate, pickupDate) {
  const { results } = await env.DB.prepare(
    `SELECT bin_size, COUNT(*) AS n FROM bookings
       WHERE status IN ('pending','confirmed','paid')
         AND service_type = 'dumpster'
         AND delivery_date <= ?2 AND pickup_date >= ?1
       GROUP BY bin_size`
  ).bind(deliveryDate, pickupDate).all();
  const bySize = {};
  let total = 0;
  for (const r of results) { bySize[r.bin_size] = r.n; total += r.n; }
  return { bySize, total };
}

// Trailer capacity: count trailer rentals whose window overlaps [delivery,pickup].
async function trailerOverlapCount(env, deliveryDate, pickupDate) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings
       WHERE status IN ('pending','confirmed','paid')
         AND service_type = 'trailer'
         AND delivery_date <= ?2 AND pickup_date >= ?1`
  ).bind(deliveryDate, pickupDate).first();
  return (row && row.n) || 0;
}

// Per-day cap for single-day services (junk / binswitch): count same-service
// bookings whose delivery is on that date.
async function sameServiceDayCount(env, serviceType, date) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings
       WHERE status IN ('pending','confirmed','paid')
         AND service_type = ?1
         AND delivery_date = ?2`
  ).bind(serviceType, date).first();
  return (row && row.n) || 0;
}

// Unpaid Checkout holds tie up bin capacity until payment completes. Sweep any
// pending checkout booking older than `holdMinutes` (matches the Stripe session
// expires_at in stripe.js). Called lazily before capacity checks and daily via
// the cron backstop.
//
// SAFETY (the charged-but-cancelled gap): Stripe charges the card the moment
// Checkout completes — the /booked redirect is only how we FIND OUT, and it can
// fail (closed tab, dropped network); no webhook secret is configured. So before
// cancelling a stale hold we ask Stripe: paid -> markPaid (confirmation SMS
// fires, capacity stays held); verified unpaid / no session -> cancel and free
// the slot; Stripe unreachable -> leave it for the next sweep rather than guess.
export async function expireStaleHolds(env, S, holdMinutes = 60) {
  const cutoff = new Date(Date.now() - holdMinutes * 60 * 1000).toISOString();
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      "SELECT id, stripe_session_id FROM bookings WHERE status='pending' AND payment_type='checkout' AND paid_at IS NULL AND created_at < ?1"
    ).bind(cutoff).all()).results || [];
  } catch (e) {
    console.error("[expireStaleHolds] query", e && e.message ? e.message : e);
    return;
  }
  for (const row of rows) {
    try { await releaseHold(env, S, row); }
    catch (e) { console.error("[expireStaleHolds]", row.id, e && e.message ? e.message : e); }
  }
}

// Asks Stripe whether a Checkout session was actually PAID before we touch its
// booking. "paid" -> confirm it; "unpaid" -> verified not paid (or nothing to
// verify: no session id / no key configured, where no charge can exist);
// "unknown" -> Stripe 5xx or network error: act on NOTHING, never guess about
// money. The session id prefix (cs_live_/cs_test_) picks the key — robust even
// if the CMS stripe_mode was flipped after this booking was made.
async function sessionPaymentState(env, sessionId) {
  if (!sessionId) return { state: "unpaid", session: null, key: null };
  const key = sessionId.startsWith("cs_live_") ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY;
  if (!key) return { state: "unpaid", session: null, key: null };
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId), {
      headers: { authorization: "Bearer " + key },
    });
    const s = await res.json().catch(() => null);
    if (res.ok && s && s.payment_status === "paid") return { state: "paid", session: s, key };
    if (!res.ok && res.status >= 500) return { state: "unknown", session: null, key };
    return { state: "unpaid", session: s && s.id ? s : null, key };
  } catch (e) {
    console.error("[sessionPaymentState]", e && e.message ? e.message : e);
    return { state: "unknown", session: null, key };
  }
}

// Kills an open Checkout session. True only when Stripe confirmed the expiry —
// i.e. the session provably can no longer take a payment.
async function expireStripeSession(key, sessionId) {
  if (!key || !sessionId) return false;
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId) + "/expire", {
      method: "POST",
      headers: { authorization: "Bearer " + key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Releases one pending unpaid hold. The money-safety invariant every caller gets:
// a row is cancelled ONLY once its Checkout session provably cannot take a
// payment any more (no session, naturally expired, or expired by us right now) —
// otherwise the customer could still pay into a booking whose capacity we just
// gave away.
//   "paid"     -> session was actually paid; the booking got confirmed instead.
//   "released" -> hold cancelled, capacity freed.
//   "left"     -> could not verify safely; row left pending for the next sweep.
async function releaseHold(env, S, row) {
  const st = await sessionPaymentState(env, row.stripe_session_id);
  if (st.state === "paid") { await markPaid(env, S, row.id, st.session); return "paid"; }
  if (st.state === "unknown") return "left";
  if (st.session && st.session.status === "open") {
    const expired = await expireStripeSession(st.key, row.stripe_session_id);
    if (!expired) {
      // Expire refused — the session may have completed in the race. Re-check
      // once: paid now -> confirm it; otherwise leave the row for the sweep.
      const re = await sessionPaymentState(env, row.stripe_session_id);
      if (re.state === "paid") { await markPaid(env, S, row.id, re.session); return "paid"; }
      return "left";
    }
  }
  await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=?1 AND status='pending'").bind(row.id).run();
  return "released";
}

// The lockout that cost a real job (two attempts, Aug 11–12): a failed or
// abandoned checkout leaves the customer's own pending hold counting against
// capacity for up to an hour — and with a 1-bin size, every retry is refused as
// "No bins free" BY THEIR OWN EARLIER ATTEMPT. Before the capacity gate, release
// any unpaid holds belonging to THIS customer (same phone, or same email). If
// one turns out already PAID, report it so the caller refuses the duplicate
// instead of charging them twice.
async function releaseOwnHolds(env, S, clean) {
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      "SELECT id, stripe_session_id FROM bookings WHERE status='pending' AND payment_type='checkout' AND paid_at IS NULL AND (phone=?1 OR (?2 <> '' AND lower(email)=lower(?2)))"
    ).bind(clean.phone, clean.email || "").all()).results || [];
  } catch (e) {
    console.error("[releaseOwnHolds] query", e && e.message ? e.message : e);
    return null;
  }
  for (const row of rows) {
    try {
      if ((await releaseHold(env, S, row)) === "paid") return { paidRef: row.id };
    } catch (e) {
      console.error("[releaseOwnHolds]", row.id, e && e.message ? e.message : e);
    }
  }
  return null;
}

// Stripe Checkout's back arrow lands on /book?canceled=<ref>. Release that hold
// right away instead of letting it sit on a bin for up to an hour. Same money
// safety as every release: a paid session confirms the booking, an unverifiable
// one is left for the sweep.
export async function cancelAbandonedCheckout(env, S, ref) {
  const row = await env.DB.prepare(
    "SELECT id, stripe_session_id FROM bookings WHERE id=?1 AND status='pending' AND payment_type='checkout' AND paid_at IS NULL"
  ).bind(String(ref || "")).first();
  if (!row) return;
  try { await releaseHold(env, S, row); }
  catch (e) { console.error("[cancelAbandonedCheckout]", row.id, e && e.message ? e.message : e); }
}

export async function getAvailability(env, S, size, date, tier = "1-3") {
  if (!S.bins[size] || !isISODate(date) || !S.tiers[tier]) {
    return { ok: false, error: "valid size, date and tier required" };
  }
  await expireStaleHolds(env, S);
  const pickup = addDays(date, S.tiers[tier].maxDays);
  const counts = await overlapCounts(env, date, pickup);
  const sizeOut = counts.bySize[size] || 0;
  const sizeCap = S.bins[size].inventory;
  const available = sizeOut < sizeCap && counts.total < S.totalCap;
  return { ok: true, available, size, tier, date, pickup_date: pickup, size_out: sizeOut, size_cap: sizeCap, total_out: counts.total, total_cap: S.totalCap };
}

// ---- Service area ------------------------------------------------------------
// The address field alone accepted anything ("length >= 5"), so someone a state
// away could book and PAY, and Joseph would eat a Stripe refund plus a wasted
// morning. Geocode the drop-off via Photon (same upstream as the autocomplete)
// and measure straight-line miles from the yard.
//
// Deliberately conservative in BOTH directions:
//  - Reject only when EVERY candidate interpretation of the address is beyond the
//    radius, so an ambiguous address gets the benefit of the doubt.
//  - Fail OPEN (allow) when Photon errors, times out, or finds nothing — an outage
//    or an unusual-but-real address must never block a paying local customer.
//    Gibberish addresses also pass; they always did, and Joseph triages by phone.
function milesBetween(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180, R = 3958.8; // earth radius, miles
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function outsideServiceArea(S, address) {
  const radius = Number(S.serviceRadiusMiles);
  if (!radius || radius <= 0) return null; // 0/blank in the CMS = check disabled
  const c = S.serviceCenter || { lat: 41.203, lon: -112.054 }; // West Haven, UT
  try {
    const r = await fetch(
      "https://photon.komoot.io/api/?q=" + encodeURIComponent(String(address).slice(0, 120)) +
      "&limit=3&lang=en&lat=" + c.lat + "&lon=" + c.lon,
      { headers: { "user-agent": "TripleRDump-Booking/1.0 (service-area check)" }, signal: AbortSignal.timeout(4000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const feats = ((data && data.features) || []).filter((f) => f && f.geometry && Array.isArray(f.geometry.coordinates));
    if (!feats.length) return null;
    let best = Infinity;
    for (const f of feats) {
      const mi = milesBetween(c.lat, c.lon, f.geometry.coordinates[1], f.geometry.coordinates[0]);
      if (mi < best) best = mi;
    }
    return best > radius ? { miles: Math.round(best) } : null;
  } catch (e) {
    console.error("[servicearea] failing open:", e && e.message ? e.message : e);
    return null;
  }
}

export async function createBooking(env, S, input) {
  // Commercial = a separate, unpriced lead flow ("request a quote"). Handle it
  // before any residential validation/pricing/capacity logic runs. No area gate
  // on leads: a far-away commercial inquiry costs nothing and may be worth a call.
  if (String(input && input.account_type) === "commercial") {
    return createCommercialLead(env, S, input);
  }

  const { errors, clean } = validate(input, S);
  if (errors.length) return { ok: false, errors };

  const today = todayISO(S.business.timezone);
  const earliest = addDays(today, S.booking.minLeadDays);
  const latest = addDays(today, S.booking.maxAdvanceDays);
  if (clean.date < earliest) return { ok: false, errors: [`Earliest delivery is ${earliest}.`] };
  if (clean.date > latest) return { ok: false, errors: [`We book up to ${S.booking.maxAdvanceDays} days out.`] };

  // Outside the delivery area -> a clear no with a phone number, BEFORE any
  // capacity hold or Stripe session is created.
  const far = await outsideServiceArea(S, clean.dropAddress);
  if (far) {
    return { ok: false, errors: [
      `That address looks to be about ${far.miles} miles from us — outside our delivery area ` +
      `(within ${Number(S.serviceRadiusMiles)} miles of West Haven). If that seems wrong, or you're close, ` +
      `call ${bizPhone(S)} and we'll see what we can do.`,
    ] };
  }

  // A customer's own failed/abandoned checkout must never lock them out of
  // retrying (it did, Aug 11–12: with one 15-yarder, a stranded hold made every
  // retry read "No bins free" — the customer walked). Release THIS customer's
  // unpaid holds first; if one was actually paid, refuse the duplicate instead
  // of double-charging them.
  const prior = await releaseOwnHolds(env, S, clean);
  if (prior && prior.paidRef) {
    return { ok: false, errors: [
      `Good news — your earlier attempt actually went through: you're already booked (ref ${prior.paidRef}) ` +
      `and your card was only charged once. Your confirmation text is on its way. Questions? Call ${bizPhone(S)}.`,
    ] };
  }

  // Free any expired unpaid holds so they don't wrongly block this booking.
  await expireStaleHolds(env, S);

  const svcType = clean.serviceType;

  // ----- Service-specific window, rental_days, capacity gate, and quote -----
  let pickup;
  let rentalDays;
  let q;

  if (svcType === "dumpster") {
    rentalDays = S.tiers[clean.tier].maxDays;
    pickup = addDays(clean.date, rentalDays);
    const counts = await overlapCounts(env, clean.date, pickup);
    if ((counts.bySize[clean.size] || 0) >= S.bins[clean.size].inventory || counts.total >= S.totalCap) {
      return { ok: false, errors: [`No ${S.bins[clean.size].label} bins free around ${clean.date}. Try another date or size, or call ${bizPhone(S)} and we'll see what we can do.`] };
    }
    q = quoteService(S, "dumpster", { size: clean.size, tier: clean.tier });
  } else if (svcType === "trailer") {
    rentalDays = clean.rentalDays;
    pickup = addDays(clean.date, rentalDays);
    const inv = (S.services.trailer && S.services.trailer.inventory) || 2;
    const out = await trailerOverlapCount(env, clean.date, pickup);
    if (out >= inv) {
      return { ok: false, errors: [`No trailers free around ${clean.date}. Try another date, or call ${bizPhone(S)}.`] };
    }
    q = quoteService(S, "trailer", { days: rentalDays });
  } else {
    // junk + binswitch: single-day services with a simple per-day cap.
    rentalDays = 1;
    pickup = clean.date;
    const svc = S.services[svcType] || {};
    const cap = svc.dailyCap || 2;
    const out = await sameServiceDayCount(env, svcType, clean.date);
    if (out >= cap) {
      const label = (svc.label || svcType);
      return { ok: false, errors: [`No ${label} slots free on ${clean.date}. Try another date, or call ${bizPhone(S)}.`] };
    }
    q = quoteService(S, svcType, {});
  }

  if (!q) return { ok: false, errors: ["Pricing unavailable for that selection."] };

  // Promo code: percent off the PRE-TAX subtotal, tax recomputed on the
  // discounted amount, deposit untouched. An unrecognized code refuses loudly —
  // silently charging full price against what the customer expected is worse
  // than making them fix a typo (or clear the box).
  let promo = null;
  if (clean.promoCode) {
    promo = findDiscountCode(S, clean.promoCode);
    if (!promo) {
      return { ok: false, errors: [
        `That promo code (${clean.promoCode}) isn't valid. Check the spelling, clear the box to book without it, or call ${bizPhone(S)}.`,
      ] };
    }
    const disc = Math.min(q.subtotal_cents, Math.round(q.subtotal_cents * promo.pct / 100));
    const tax = Math.round((q.subtotal_cents - disc) * S.taxRate);
    q = { ...q, discount_cents: disc, tax_cents: tax, amount_cents: q.subtotal_cents - disc + tax };
  }
  const discountVal = (promo && q.discount_cents) || 0;

  // binswitch: fold the optional existing-booking ref into notes (only).
  let notes = "";
  const message = clean.message;
  if (svcType === "binswitch" && clean.existingRef) {
    notes = "Existing booking ref: " + clean.existingRef;
  }

  const id = genRef();
  const now = new Date().toISOString();
  // Residential only here - commercial is handled by createCommercialLead() above.
  let status, paymentType;
  if (S.requirePayment) { status = "pending"; paymentType = "checkout"; }
  else { status = "confirmed"; paymentType = "none"; }

  // Dumpster keeps a tier; other services store NULL for rental_tier.
  const tierVal = svcType === "dumpster" ? clean.tier : null;
  const groundVal = svcType === "dumpster" ? clean.ground : null;
  const permitVal = svcType === "dumpster" ? clean.permitNeeded : null;
  const permitObtVal = svcType === "dumpster" ? clean.permitObtainable : null;
  const depositVal = q.deposit_cents || 0;

  await env.DB.prepare(
    `INSERT INTO bookings
       (id, created_at, status, account_type, service_type, customer_name, phone, email, company, message,
        bin_size, rental_tier, delivery_date, delivery_time, pickup_date, rental_days,
        address, pickup_address, ground_condition, permit_needed, permit_obtainable,
        agreed_terms, subtotal_cents, tax_cents, amount_cents, deposit_cents, promo_code, discount_cents, payment_type, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, status, clean.accountType, svcType, clean.name, clean.phone, clean.email, clean.company, message,
    clean.size, tierVal, clean.date, clean.deliveryTime, pickup, rentalDays,
    clean.dropAddress, clean.pickupAddress, groundVal, permitVal, permitObtVal,
    1, q.subtotal_cents, q.tax_cents, q.amount_cents, depositVal, promo ? promo.code : null, discountVal, paymentType, notes || null
  ).run();

  const booking = {
    id, status, account_type: clean.accountType, service_type: svcType, customer_name: clean.name,
    message, phone: clean.phone, email: clean.email, bin_size: clean.size, rental_tier: tierVal,
    rental_days: rentalDays,
    delivery_date: clean.date, delivery_time: clean.deliveryTime, pickup_date: pickup, address: clean.dropAddress,
    pickup_address: clean.pickupAddress, ground_condition: groundVal,
    subtotal_cents: q.subtotal_cents, tax_cents: q.tax_cents, amount_cents: q.amount_cents,
    deposit_cents: depositVal,
    promo_code: promo ? promo.code : null,
    discount_cents: discountVal,
    payment_type: paymentType,
  };

  const confirmMsg = fillTemplate(S.templates.confirmation, { bin: booking.bin_size, tier: booking.rental_tier, item: itemLabel(booking), length: lengthLabel(booking), date: booking.delivery_date, pickup: booking.pickup_date, id: booking.id, name: booking.customer_name, address: booking.address, total: (chargedCents(booking) / 100).toFixed(2), phone: S.business.phone, customer_phone: booking.phone || "", note: booking.message || "" });
  if (status === "confirmed") { try { await sendBookingWebhook(S, booking, clean.smsConsent, confirmMsg); } catch (e) { console.error("[booking webhook]", e); } }

  let checkout = null;
  if (paymentType === "checkout") {
    try { checkout = await createCheckout(env, S, booking); } catch (e) { console.error("[checkout]", e); }
    // Payment is REQUIRED but checkout couldn't start (e.g. live Stripe key missing, or a
    // Stripe API error). NEVER show a fake confirmation: roll back the hold and surface an
    // error so an unpaid booking is never presented as confirmed.
    if (!checkout || !checkout.url) {
      try { await env.DB.prepare("DELETE FROM bookings WHERE id=?1").bind(id).run(); } catch (e2) { console.error("[checkout rollback]", e2); }
      return { ok: false, errors: ["We couldn't start secure checkout — no charge was made and nothing was booked. Please try again, or call " + (S.business.phone || "") + "."] };
    }
  }

  return {
    ok: true,
    booking,
    payment_type: paymentType,
    checkout_url: checkout && checkout.url ? checkout.url : null,
    totals: { subtotal_cents: q.subtotal_cents, discount_cents: discountVal, tax_cents: q.tax_cents, amount_cents: q.amount_cents },
    message: checkout && checkout.url
      ? "Redirecting to secure checkout..."
      : "Booked! You're confirmed - we'll be in touch with details.",
  };
}
