import { todayISO, addDays, isISODate } from "./util.js";
import { quoteService, fillTemplate, itemLabel, lengthLabel, chargedCents } from "./settings.js";
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
    let verdict = "cancel";
    let session = null;
    if (row.stripe_session_id) {
      // The session id prefix (cs_live_/cs_test_) says which catalog minted it —
      // robust even if the CMS stripe_mode was flipped after this booking was made.
      const key = row.stripe_session_id.startsWith("cs_live_") ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY;
      if (key) {
        try {
          const res = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(row.stripe_session_id), {
            headers: { authorization: "Bearer " + key },
          });
          const s = await res.json().catch(() => null);
          if (res.ok && s && s.payment_status === "paid") { verdict = "paid"; session = s; }
          else if (!res.ok && res.status >= 500) verdict = "skip"; // Stripe hiccup — don't guess
        } catch (e) {
          verdict = "skip"; // network error — never cancel what might be paid
          console.error("[expireStaleHolds] stripe check failed for", row.id, e && e.message ? e.message : e);
        }
      }
    }
    try {
      if (verdict === "paid") await markPaid(env, S, row.id, session);
      else if (verdict === "cancel") await env.DB.prepare("UPDATE bookings SET status='cancelled' WHERE id=?1 AND status='pending'").bind(row.id).run();
    } catch (e) {
      console.error("[expireStaleHolds]", row.id, e && e.message ? e.message : e);
    }
  }
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

export async function createBooking(env, S, input) {
  // Commercial = a separate, unpriced lead flow ("request a quote"). Handle it
  // before any residential validation/pricing/capacity logic runs.
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
      return { ok: false, errors: [`No ${S.bins[clean.size].label} bins free around ${clean.date}. Try another date or size.`] };
    }
    q = quoteService(S, "dumpster", { size: clean.size, tier: clean.tier });
  } else if (svcType === "trailer") {
    rentalDays = clean.rentalDays;
    pickup = addDays(clean.date, rentalDays);
    const inv = (S.services.trailer && S.services.trailer.inventory) || 2;
    const out = await trailerOverlapCount(env, clean.date, pickup);
    if (out >= inv) {
      return { ok: false, errors: [`No trailers free around ${clean.date}. Try another date.`] };
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
      return { ok: false, errors: [`No ${label} slots free on ${clean.date}. Try another date.`] };
    }
    q = quoteService(S, svcType, {});
  }

  if (!q) return { ok: false, errors: ["Pricing unavailable for that selection."] };

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
        agreed_terms, subtotal_cents, tax_cents, amount_cents, deposit_cents, payment_type, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, status, clean.accountType, svcType, clean.name, clean.phone, clean.email, clean.company, message,
    clean.size, tierVal, clean.date, clean.deliveryTime, pickup, rentalDays,
    clean.dropAddress, clean.pickupAddress, groundVal, permitVal, permitObtVal,
    1, q.subtotal_cents, q.tax_cents, q.amount_cents, depositVal, paymentType, notes || null
  ).run();

  const booking = {
    id, status, account_type: clean.accountType, service_type: svcType, customer_name: clean.name,
    message, phone: clean.phone, email: clean.email, bin_size: clean.size, rental_tier: tierVal,
    rental_days: rentalDays,
    delivery_date: clean.date, delivery_time: clean.deliveryTime, pickup_date: pickup, address: clean.dropAddress,
    pickup_address: clean.pickupAddress, ground_condition: groundVal,
    subtotal_cents: q.subtotal_cents, tax_cents: q.tax_cents, amount_cents: q.amount_cents,
    deposit_cents: depositVal,
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
    totals: { subtotal_cents: q.subtotal_cents, tax_cents: q.tax_cents, amount_cents: q.amount_cents },
    message: checkout && checkout.url
      ? "Redirecting to secure checkout..."
      : "Booked! You're confirmed - we'll be in touch with details.",
  };
}
