import { todayISO, addDays, isISODate } from "./util.js";
import { quote } from "./settings.js";
import { notifyOwnerNewBooking, sendBookingConfirmation } from "./sms.js";
import { createCheckout } from "./stripe.js";

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genRef() {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return "TRD-" + s;
}

function validate(input, S) {
  const errors = [];
  const size = String(input.bin_size || "").trim();
  if (!S.bins[size]) errors.push("Pick a bin size (15, 20 or 25 yard).");

  const tier = String(input.rental_tier || "").trim();
  if (!S.tiers[tier]) errors.push("Pick a rental length (1-3 or 4-7 day).");

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

  const ground = String(input.ground_condition || "").trim();
  if (!S.groundConditions.includes(ground)) errors.push("Pick the drop-off ground condition.");

  const permitRaw = input.permit_needed;
  const permitNeeded = permitRaw === true || permitRaw === "yes" || permitRaw === "Yes" || permitRaw === 1 || permitRaw === "1";
  const permitAnswered = permitRaw === true || permitRaw === false || ["yes", "no", "Yes", "No", 0, 1, "0", "1"].includes(permitRaw);
  if (!permitAnswered) errors.push("Tell us if a permit/HOA approval is needed.");

  const agreed = input.agreed_terms === true || input.agreed_terms === "true" || input.agreed_terms === "on" || input.agreed_terms === 1;
  if (!agreed) errors.push("You must agree to the terms.");

  const smsConsent = input.sms_consent === true || input.sms_consent === "true" || input.sms_consent === "on" || input.sms_consent === 1;

  const accountType = input.account_type === "commercial" ? "commercial" : "residential";

  return {
    errors,
    clean: {
      size, tier, name, phone, email,
      dropAddress,
      pickupAddress: String(input.pickup_address || "").trim() || dropAddress,
      date,
      deliveryTime: String(input.delivery_time || "").trim(),
      ground,
      permitNeeded: permitNeeded ? 1 : 0,
      permitObtainable: String(input.permit_obtainable || "").trim(),
      company: String(input.company || "").trim(),
      message: String(input.message || "").trim(),
      smsConsent: smsConsent ? 1 : 0,
      accountType,
    },
  };
}

async function overlapCounts(env, deliveryDate, pickupDate) {
  const { results } = await env.DB.prepare(
    `SELECT bin_size, COUNT(*) AS n FROM bookings
       WHERE status IN ('pending','confirmed','paid')
         AND delivery_date <= ?2 AND pickup_date >= ?1
       GROUP BY bin_size`
  ).bind(deliveryDate, pickupDate).all();
  const bySize = {};
  let total = 0;
  for (const r of results) { bySize[r.bin_size] = r.n; total += r.n; }
  return { bySize, total };
}

export async function getAvailability(env, S, size, date, tier = "1-3") {
  if (!S.bins[size] || !isISODate(date) || !S.tiers[tier]) {
    return { ok: false, error: "valid size, date and tier required" };
  }
  const pickup = addDays(date, S.tiers[tier].maxDays);
  const counts = await overlapCounts(env, date, pickup);
  const sizeOut = counts.bySize[size] || 0;
  const sizeCap = S.bins[size].inventory;
  const available = sizeOut < sizeCap && counts.total < S.totalCap;
  return { ok: true, available, size, tier, date, pickup_date: pickup, size_out: sizeOut, size_cap: sizeCap, total_out: counts.total, total_cap: S.totalCap };
}

export async function createBooking(env, S, input) {
  const { errors, clean } = validate(input, S);
  if (errors.length) return { ok: false, errors };

  const today = todayISO(S.business.timezone);
  const earliest = addDays(today, S.booking.minLeadDays);
  const latest = addDays(today, S.booking.maxAdvanceDays);
  if (clean.date < earliest) return { ok: false, errors: [`Earliest delivery is ${earliest}.`] };
  if (clean.date > latest) return { ok: false, errors: [`We book up to ${S.booking.maxAdvanceDays} days out.`] };

  const pickup = addDays(clean.date, S.tiers[clean.tier].maxDays);

  const counts = await overlapCounts(env, clean.date, pickup);
  if ((counts.bySize[clean.size] || 0) >= S.bins[clean.size].inventory || counts.total >= S.totalCap) {
    return { ok: false, errors: [`No ${S.bins[clean.size].label} bins free around ${clean.date}. Try another date or size.`] };
  }

  const q = quote(S, clean.size, clean.tier);
  if (!q) return { ok: false, errors: ["Pricing unavailable for that selection."] };

  const id = genRef();
  const now = new Date().toISOString();
  const isCommercial = clean.accountType === "commercial";
  let status, paymentType;
  if (isCommercial) { status = "confirmed"; paymentType = "invoice"; }
  else if (S.requirePayment) { status = "pending"; paymentType = "checkout"; }
  else { status = "confirmed"; paymentType = "none"; }

  await env.DB.prepare(
    `INSERT INTO bookings
       (id, created_at, status, account_type, customer_name, phone, email, company, message,
        bin_size, rental_tier, delivery_date, delivery_time, pickup_date, rental_days,
        address, pickup_address, ground_condition, permit_needed, permit_obtainable,
        agreed_terms, subtotal_cents, tax_cents, amount_cents, payment_type)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, status, clean.accountType, clean.name, clean.phone, clean.email, clean.company, clean.message,
    clean.size, clean.tier, clean.date, clean.deliveryTime, pickup, S.tiers[clean.tier].maxDays,
    clean.dropAddress, clean.pickupAddress, clean.ground, clean.permitNeeded, clean.permitObtainable,
    1, q.subtotal_cents, q.tax_cents, q.amount_cents, paymentType
  ).run();

  const booking = {
    id, status, account_type: clean.accountType, customer_name: clean.name,
    phone: clean.phone, email: clean.email, bin_size: clean.size, rental_tier: clean.tier,
    delivery_date: clean.date, pickup_date: pickup, address: clean.dropAddress,
    pickup_address: clean.pickupAddress, ground_condition: clean.ground,
    subtotal_cents: q.subtotal_cents, tax_cents: q.tax_cents, amount_cents: q.amount_cents,
    payment_type: paymentType,
  };

  try { await notifyOwnerNewBooking(S, booking); } catch (e) { console.error("[notify owner]", e); }
  if (status === "confirmed") { try { await sendBookingConfirmation(S, booking, clean.smsConsent); } catch (e) { console.error("[confirm sms]", e); } }

  let checkout = null;
  if (paymentType === "checkout") {
    try { checkout = await createCheckout(env, booking); } catch (e) { console.error("[checkout]", e); }
  }

  return {
    ok: true,
    booking,
    payment_type: paymentType,
    checkout_url: checkout && checkout.url ? checkout.url : null,
    totals: { subtotal_cents: q.subtotal_cents, tax_cents: q.tax_cents, amount_cents: q.amount_cents },
    message: isCommercial
      ? "Request received - we'll send a Stripe invoice for your account."
      : (checkout && checkout.url
          ? "Redirecting to secure checkout..."
          : "Booked! You're confirmed - we'll be in touch with details."),
  };
}
