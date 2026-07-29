// Effective settings = D1 `settings` overrides merged over code defaults
// (+ env-secret fallbacks). Lets the CMS edit values without a deploy.
import { CONFIG, quoteService as quoteServiceCore } from "./config.js";

const num = (v, d) => (typeof v === "number" && !Number.isNaN(v) ? v : d);

const DEFAULT_TEMPLATES = {
  // Shared tokens: {item} {length} {bin} {tier} {date} {pickup} {id} {name} {address} {total} {account} {note}
  //   {item}   = WHAT was booked, service-aware ("20yd bin" / "dump trailer" / "junk removal" /
  //              "bin switch") — prefer this over {bin}yd, which is blank for non-dumpster services.
  //   {length} = rental length ("1-3 day" / "5 days" / "1 day"); blank if unknown.
  //   {total}  = the amount actually charged, INCLUDING any refundable deposit (trailer).
  //   {phone} = the business's number; {customer_phone} = the customer's number (don't confuse).
  //   {note}  = the customer's "Anything else?" message (bookings.message); blank if none.
  // Link tokens are audience-specific (do NOT reuse the old ambiguous {link}):
  //   {admin_link}  = owner's /admin/booking/<id> page  -> owner, owner_reminder, low_rating
  //   {review_link} = customer's /r/<token> review page -> review
  //   {link}        = legacy alias, still filled (= admin_link in owner texts, = review_link in review)
  // Commercial-only tokens: {company} {interest} {timeframe} {email} {details}
  // Low-rating-only tokens: {rating} {feedback}
  confirmation: "Triple R Dump: your {item} is booked for {date} (ref {id}). Dump fees included. Questions? {phone}",
  owner: "New booking: {name} — {item}, {date}. Full details: {admin_link}",
  review: "Thanks for choosing Triple R Dump, {name}! How did we do? {review_link}",
  reminder_sms: "Reminder from Triple R Dump: your {item} is scheduled for {date}. Questions? {phone}",
  // Pickup-reminder-only token: {extension_day} = the per-day extension fee in dollars.
  pickup_reminder: "Triple R Dump: we pick up your {item} tomorrow ({pickup}). Need it longer? Call {phone} today to extend (${extension_day}/day).",
  owner_pickup_reminder: "Pick up {item} from {name} today at {address} (ref {id}). Details: {admin_link}",
  reminder_email_subject: "Your Triple R Dump delivery is coming up ({date})",
  reminder_email_body: "Hi {name}, a reminder that your {item} is scheduled for {date} at {address} (ref {id}). Reply or call {phone} with any changes.",
  owner_reminder: "Deliver {item} to {name} on {date} at {address} (ref {id}). Details: {admin_link}",
  commercial: "New commercial quote ({id}): {company} {name}. Interest: {interest}. Timeframe: {timeframe}. Call {customer_phone} {email}. Site: {address}. {details}",
  low_rating: "{rating}★ from {name} ({id}): \"{feedback}\". {customer_phone}. Details: {admin_link}",
  // Invoice-only tokens: {number} (Stripe invoice no.) {total} {due} {invoice_link}
  invoice: "Triple R Dump invoice {number} for {total} is ready. Due {due}. Pay here: {invoice_link}",
};

// Fee schedule. Joseph's supplied policy text quoted TWO different prices for the
// same four fees; reconciled 2026-07-27 to one number each, chosen as follows:
//   dryRun 150      - stated $150 in two of three places ($200 only in the tarping
//                     bullet, for the same overfilled-bin trigger).
//   overweightTon 75- stated $75/ton vs $150/ton; $50-100/ton is the going rate.
//   extensionDay 50 - stated $50/day vs $150/day. His own tiers imply ~$8/day
//                     marginal (15yd: $300 for 1-3 days, $325 for 4-7), so $150/day
//                     was punitive and hard to defend in a dispute.
//   cancelAfterDispatch 150 - was $150 "after dispatch" AND $100 "within 3 hours",
//                     two rules that overlap in practice. Unified at $150, matching
//                     dryRun, since both are the same real cost: a wasted truck roll.
// latePct/lateGraceDays are NEW (no late fee existed anywhere). 1.5%/month after a
// 15-day grace is the common contractor standard. ALL of these are CMS-editable.
const DEFAULT_FEES = {
  dryRun: 15000,              // wasted trip: blocked, locked, unprepared, overfilled
  overweightTon: 7500,        // per ton over the included allowance
  extensionDay: 5000,         // per day kept beyond the booked period
  prohibitedItem: 20000,      // per prohibited item found in the load
  cancelAfterDispatch: 15000, // cancelled once the truck is rolling
  refundCutoffHours: 48,      // cancel earlier than this = full refund
  latePct: 1.5,               // % per month on a past-due invoice balance
  lateGraceDays: 15,          // days after the due date before it applies
  tons15: 3, tons20: 4, tons25: 5, // weight included with each bin size
};

// Printed at the bottom of every invoice (Stripe `footer`). Uses the same fee numbers
// as /terms so an invoice can never quote a late fee the policy page contradicts.
// CMS-editable: reword it in /admin, no deploy needed.
const DEFAULT_INVOICE_TERMS =
  "Payment is due by the due date shown above. Balances unpaid more than " +
  DEFAULT_FEES.lateGraceDays + " days past the due date accrue a late charge of " +
  DEFAULT_FEES.latePct + "% per month on the outstanding amount. Weight overages ($" +
  (DEFAULT_FEES.overweightTon / 100) + " per ton), trip fees ($" + (DEFAULT_FEES.dryRun / 100) +
  "), and prohibited-material fines ($" + (DEFAULT_FEES.prohibitedItem / 100) +
  " per item) identified after service remain the customer's responsibility. " +
  "Questions about this invoice? Call 801-564-3164.";
const DEFAULT_REVIEW_LINK = "https://search.google.com/local/writereview?placeid=ChIJc1Zhse8j7AcRxMoS_Ri7SA8";

export function defaultSettings(env = {}) {
  return {
    business: CONFIG.business,
    tiers: CONFIG.tiers,
    groundConditions: CONFIG.groundConditions,
    booking: CONFIG.booking,
    bins: CONFIG.bins,
    services: CONFIG.services,
    taxRate: CONFIG.business.taxRate,
    totalCap: CONFIG.totalBinsCap,
    ghlSmsUrl: env.GHL_SMS_WEBHOOK_URL || "",
    ghlReviewUrl: env.GHL_REVIEW_WEBHOOK_URL || "",
    ghlEmailUrl: env.GHL_EMAIL_WEBHOOK_URL || "",
    reviewLink: DEFAULT_REVIEW_LINK,
    reviewMode: "gated",
    reviewThreshold: 4,
    requirePayment: false,
    stripeMode: "sandbox",
    notifyOwnerBookings: true,
    notifyOwnerReminders: true,
    ownerPhone: env.OWNER_PHONE || "",
    publicBaseUrl: env.SITE_ORIGIN || "",
    reminderLeadDays: 1,
    // Every dollar amount a customer can be charged BEYOND the rental itself. These
    // drive the /terms page, so editing one here rewrites the policy wording. That is
    // the point: each fee now has exactly ONE source of truth, which is why the page
    // could previously quote two different prices for the same fee.
    fees: { ...DEFAULT_FEES },
    // Delivery area: straight-line miles from the yard in West Haven. 60 covers the
    // published counties (Weber, Morgan, Davis, Salt Lake). 0 disables the check.
    serviceRadiusMiles: 60,
    serviceCenter: { lat: 41.203, lon: -112.054 },
    invoiceTerms: DEFAULT_INVOICE_TERMS,
    invoiceDueDays: 14,
    invoiceTaxDefault: true,
    templates: { ...DEFAULT_TEMPLATES },
  };
}

export async function loadSettings(env) {
  const s = defaultSettings(env);
  let rows = [];
  try { rows = (await env.DB.prepare("SELECT key, value FROM settings").all()).results || []; }
  catch (e) { console.error("[settings] load failed, using defaults", e); }
  const o = {};
  for (const row of rows) { try { o[row.key] = JSON.parse(row.value); } catch { o[row.key] = row.value; } }

  if (o.bins) s.bins = o.bins;
  if (o.services) s.services = { ...s.services, ...o.services };
  if (o.tax_rate !== undefined) s.taxRate = num(o.tax_rate, s.taxRate);
  if (o.total_cap !== undefined) s.totalCap = num(o.total_cap, s.totalCap);
  if (o.ghl_sms_webhook_url) s.ghlSmsUrl = o.ghl_sms_webhook_url;
  if (o.ghl_review_webhook_url !== undefined) s.ghlReviewUrl = o.ghl_review_webhook_url;
  if (o.ghl_email_webhook_url !== undefined) s.ghlEmailUrl = o.ghl_email_webhook_url;
  if (o.review_link) s.reviewLink = o.review_link;
  if (o.review_mode) s.reviewMode = o.review_mode;
  if (o.review_threshold !== undefined) s.reviewThreshold = num(o.review_threshold, s.reviewThreshold);
  if (o.require_payment !== undefined) s.requirePayment = o.require_payment === true;
  if (o.stripe_mode) s.stripeMode = o.stripe_mode === "live" ? "live" : "sandbox";
  if (o.notify_owner_bookings !== undefined) s.notifyOwnerBookings = o.notify_owner_bookings === true;
  if (o.notify_owner_reminders !== undefined) s.notifyOwnerReminders = o.notify_owner_reminders === true;
  if (o.owner_phone !== undefined) s.ownerPhone = o.owner_phone;
  if (o.public_base_url) s.publicBaseUrl = o.public_base_url;
  if (o.reminder_lead_days !== undefined) s.reminderLeadDays = num(o.reminder_lead_days, s.reminderLeadDays);
  if (o.fees) s.fees = { ...s.fees, ...o.fees };
  if (o.service_radius_miles !== undefined) s.serviceRadiusMiles = num(o.service_radius_miles, s.serviceRadiusMiles);
  if (o.invoice_terms !== undefined) s.invoiceTerms = o.invoice_terms;
  if (o.invoice_due_days !== undefined) s.invoiceDueDays = num(o.invoice_due_days, s.invoiceDueDays);
  if (o.invoice_tax_default !== undefined) s.invoiceTaxDefault = o.invoice_tax_default === true;
  if (o.sms_templates) s.templates = { ...s.templates, ...o.sms_templates };
  return s;
}

export async function saveSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3"
  ).bind(key, JSON.stringify(value), new Date().toISOString()).run();
}

// Settings-aware pricing for any service. opts: {tier} dumpster, {days} trailer.
// Returns {subtotal_cents, tax_cents, amount_cents, deposit_cents} or null.
export function quoteService(S, serviceType, opts) {
  return quoteServiceCore(serviceType, opts, { taxRate: S.taxRate, bins: S.bins, services: S.services });
}

// Backward-compatible dumpster quote. Same {subtotal_cents,tax_cents,amount_cents}
// shape as before (deposit_cents is 0 for dumpster and harmless if read).
export function quote(S, binSize, tier) {
  return quoteService(S, "dumpster", { size: binSize, tier });
}

export function fillTemplate(tpl, vals) {
  return String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (vals[k] !== undefined && vals[k] !== null ? String(vals[k]) : ""));
}

// {item}: what was booked, phrased for a sentence ("your {item} is booked").
// Works off a bookings row OR the in-memory booking object (same field names).
export function itemLabel(b) {
  const t = (b && b.service_type) || "dumpster";
  if (t === "trailer") return "dump trailer";
  if (t === "junk") return "junk removal";
  if (t === "binswitch") return "bin switch";
  return (b && b.bin_size ? b.bin_size + "yd " : "") + "bin";
}

// {length}: human rental length. Dumpster keeps its tier wording ("1-3 day");
// trailer uses the day count ("5 days"); junk/binswitch are single-day ("1 day").
export function lengthLabel(b) {
  if (b && b.rental_tier) return b.rental_tier + " day";
  const d = Number(b && b.rental_days);
  if (Number.isFinite(d) && d > 0) return d + (d === 1 ? " day" : " days");
  return "";
}

// What the card is actually charged: service total + refundable deposit (trailer).
// amount_cents deliberately excludes the deposit in the DB; anywhere money is
// SHOWN to a human should use this so trailer totals aren't understated by $300.
export function chargedCents(b) {
  return ((b && b.amount_cents) || 0) + ((b && b.deposit_cents) || 0);
}
