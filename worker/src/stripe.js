// Stripe Checkout — live integration. Creates a hosted Checkout Session via the
// Stripe REST API (no SDK; keeps the Worker dependency-free) and returns its URL.
// The restricted key stays a Worker secret — it never touches the repo or browser.
//
// TEST vs LIVE: the prod_ ids below are LIVE-mode catalog objects. Stripe keeps
// test and live catalogs fully separate, so a live prod_ id does NOT exist under a
// test key. We therefore bind line items to the real product ids only in LIVE
// mode; under a test key we send inline product NAMES instead (price_data.
// product_data.name). Mode is detected from the key prefix.

import { fillTemplate, itemLabel, lengthLabel, chargedCents } from "./settings.js";
import { sendBookingWebhook } from "./sms.js";

// Maps a booking to Joseph's Stripe product (live-mode ids from product-ids.md).
const PRODUCTS = {
  dumpster: {
    "15": { "1-3": "prod_UlrZz7adPXeY7W", "4-7": "prod_UlrdTKoj20tflo" },
    "20": { "1-3": "prod_UlrcmyYR27PNhx", "4-7": "prod_UlrdIGHELZaFln" },
    "25": { "1-3": "prod_UlrcS8cFFVJcuG", "4-7": "prod_UlreLAkBQ1tTUx" },
  },
  // Trailer is billed as the 1-day product × N days, so 1–14 day rentals all map
  // cleanly (the 2-day / 3-day products in the catalog are just presets).
  trailer: "prod_UlrfXN9elYsnm5",
  junk: "prod_UlrfnshhxZGuZ7",
  binswitch: "prod_UlrfUydjYwu9r1",
};

function productIdFor(booking) {
  if (booking.service_type === "dumpster") {
    const bySize = PRODUCTS.dumpster[booking.bin_size];
    return (bySize && bySize[booking.rental_tier]) || null;
  }
  return PRODUCTS[booking.service_type] || null;
}

// Human-readable line label (test mode, and a fallback if a product id is missing).
function lineName(booking) {
  const s = booking.service_type;
  if (s === "dumpster") {
    const tier = booking.rental_tier === "4-7" ? "4–7" : "1–3";
    return `${booking.bin_size}-Yd Bin | ${tier} Day Rental | Dump Included`;
  }
  if (s === "trailer") return "Dump Trailer Rental (per day)";
  if (s === "junk") return "Junk Removal Services";
  if (s === "binswitch") return "Bin Switch / Multi-Dump";
  return "Triple R Dump service";
}

// Adds one price_data line item to `form` at index `i`. Uses the real product id
// when `productId` is set (live), otherwise an inline product name (test/fallback).
function setLine(form, i, { unit, qty, productId, name }) {
  form.set(`line_items[${i}][quantity]`, String(qty));
  form.set(`line_items[${i}][price_data][currency]`, "usd");
  form.set(`line_items[${i}][price_data][unit_amount]`, String(unit));
  if (productId) form.set(`line_items[${i}][price_data][product]`, productId);
  else form.set(`line_items[${i}][price_data][product_data][name]`, name);
}

// One-off amount_off coupon so Checkout shows the promo as a real discount row
// ("MILITARY10 −$37.50") while the service line keeps its full price AND its live
// product id. amount_off (not percent_off) on purpose: a percent coupon would
// also discount the tax and deposit LINES — our tax is already computed on the
// discounted subtotal server-side, and the deposit is never discounted.
// Returns the coupon id, or null on any failure (caller falls back).
async function createDiscountCoupon(key, booking) {
  try {
    const form = new URLSearchParams({
      amount_off: String(booking.discount_cents),
      currency: "usd",
      duration: "once",
      name: String(booking.promo_code || "Discount").slice(0, 40),
      "metadata[booking_id]": booking.id,
    });
    const res = await fetch("https://api.stripe.com/v1/coupons", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const c = await res.json().catch(() => null);
    if (!res.ok) { console.error("[stripe] coupon create failed:", c && c.error ? c.error.message : res.status); return null; }
    return (c && c.id) || null;
  } catch (e) {
    console.error("[stripe] coupon fetch error", e && e.message ? e.message : e);
    return null;
  }
}

// Picks the Stripe key for the CMS's current mode. `isLive` is derived from the KEY
// PREFIX, not the CMS toggle, so a mode flip with a missing key can never make us bind
// live-catalog product ids under a test key. Shared with invoice.js so the two money
// flows cannot drift apart.
export function stripeKey(env, S) {
  const liveMode = !!(S && S.stripeMode === "live");
  const key = (liveMode ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY) || "";
  return { key, isLive: key.startsWith("sk_live") || key.startsWith("rk_live") };
}

export async function createCheckout(env, S, booking) {
  // CMS stripe_mode picks which key/catalog to use ("sandbox" default, "live" for real
  // payments) — lets dev flip test<->live without a redeploy. Real product ids bind ONLY
  // under a genuine live key; test/sandbox keys use inline product names so the flow
  // works against an empty sandbox catalog.
  const { key, isLive } = stripeKey(env, S);
  if (!key) return { stubbed: true, url: null };

  const origin = env.SITE_ORIGIN || "";

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", `${origin}/booked?ref=${encodeURIComponent(booking.id)}`);
  form.set("cancel_url", `${origin}/book?canceled=${encodeURIComponent(booking.id)}`);
  form.set("client_reference_id", booking.id);
  form.set("metadata[booking_id]", booking.id);
  if (booking.email) form.set("customer_email", booking.email);
  // Hold the slot ~60 min; matches the unpaid-hold expiry sweep in booking.js.
  form.set("expires_at", String(Math.floor(Date.now() / 1000) + 60 * 60));
  // Card only (synchronous capture). Async methods (ACH debit, BNPL) settle AFTER
  // the 60-min hold expiry and after the /booked redirect has already come back
  // "unpaid" — the sweep would cancel a booking the customer eventually pays for.
  form.set("payment_method_types[0]", "card");
  // Save the card to a Customer for later OFF-SESSION charges (weight overages, trip
  // fees, prohibited-material fines) — the customer authorizes this in the Terms.
  // customer_creation=always guarantees a Customer is created with the card attached;
  // setup_future_usage marks it reusable off-session (chargeable later from the dashboard).
  form.set("customer_creation", "always");
  form.set("payment_intent_data[setup_future_usage]", "off_session");

  // Promo discount: preferred as a Stripe coupon (its own visible discount row).
  // If the coupon can't be created the discount MUST NOT be lost — fall back to
  // charging the already-discounted amount directly on the service line.
  let lineDiscount = 0;
  if ((booking.discount_cents || 0) > 0) {
    const couponId = await createDiscountCoupon(key, booking);
    if (couponId) form.set("discounts[0][coupon]", couponId);
    else lineDiscount = booking.discount_cents;
  }

  let i = 0;
  const liveProduct = isLive ? productIdFor(booking) : null;

  // Service line. Trailer = 1-day product × days; everything else qty 1 at subtotal.
  // On the coupon-less discount fallback the line is always qty 1 at the net
  // amount (a per-day unit could drift by rounding when the discount splits).
  const isTrailer = booking.service_type === "trailer";
  const days = Math.max(1, Number(booking.rental_days) || 1);
  setLine(form, i++, lineDiscount > 0
    ? { unit: booking.subtotal_cents - lineDiscount, qty: 1, productId: liveProduct, name: lineName(booking) }
    : {
        unit: isTrailer ? Math.round(booking.subtotal_cents / days) : booking.subtotal_cents,
        qty: isTrailer ? days : 1,
        productId: liveProduct,
        name: lineName(booking),
      });

  // Sales tax (computed server-side; deposit is untaxed). Inline product in both
  // modes. TODO(pre-live polish): swap to a dedicated "UT Sales Tax" product id to
  // keep the live catalog tidy.
  if (booking.tax_cents > 0) {
    setLine(form, i++, { unit: booking.tax_cents, qty: 1, productId: null, name: "Utah sales tax (7.5%)" });
  }

  // Refundable damage deposit (trailer) — untaxed; Joseph refunds after return.
  if (booking.deposit_cents > 0) {
    setLine(form, i++, { unit: booking.deposit_cents, qty: 1, productId: null, name: "Refundable damage deposit" });
  }

  let session;
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    session = await res.json();
    if (!res.ok) {
      console.error("[stripe] session create failed:", session && session.error ? session.error.message : res.status);
      return { url: null, error: true };
    }
  } catch (e) {
    console.error("[stripe] fetch error", e && e.message ? e.message : e);
    return { url: null, error: true };
  }

  // Persist the session id so the webhook can reconcile this booking.
  try {
    await env.DB.prepare("UPDATE bookings SET stripe_session_id=?1 WHERE id=?2").bind(session.id, booking.id).run();
  } catch (e) {
    console.error("[stripe] persist session id failed", e && e.message ? e.message : e);
  }

  return { url: session.url, id: session.id };
}

// ---- Webhook ----------------------------------------------------------------

// Verifies a Stripe-Signature header against the raw body using Web Crypto HMAC.
// Implements Stripe's scheme: signed_payload = `${t}.${rawBody}`, compared to v1.
async function verifyStripeSig(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  for (const kv of sigHeader.split(",")) {
    const idx = kv.indexOf("=");
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  // Reject stale/replayed events (5-minute tolerance).
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(`${t}.${rawBody}`));
  const expected = [...new Uint8Array(sigBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Constant-time-ish compare.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let n = 0; n < expected.length; n++) diff |= expected.charCodeAt(n) ^ v1.charCodeAt(n);
  return diff === 0;
}

// Marks a booking paid (idempotent) and fires the confirmation webhook. The
// combined terms+SMS-consent checkbox is required to book, so consent is implied.
// Exported: the stale-hold sweep in booking.js also confirms via this path when
// it finds a paid session the customer never redirected back for.
export async function markPaid(env, S, ref, session) {
  const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(ref).first();
  if (!b) { console.error("[stripe webhook] unknown booking", ref); return; }
  if (b.status === "paid" || b.paid_at) return; // already handled

  const pi = (session && session.payment_intent) || null;
  await env.DB.prepare("UPDATE bookings SET status='paid', paid_at=?1, stripe_payment_intent=?2 WHERE id=?3")
    .bind(new Date().toISOString(), pi, ref).run();
  b.status = "paid";

  try {
    const msg = fillTemplate(S.templates.confirmation, {
      bin: b.bin_size, tier: b.rental_tier, item: itemLabel(b), length: lengthLabel(b),
      date: b.delivery_date, pickup: b.pickup_date,
      id: b.id, name: b.customer_name, address: b.address,
      total: (chargedCents(b) / 100).toFixed(2), phone: S.business.phone,
      customer_phone: b.phone || "",
      note: b.message || "",
    });
    await sendBookingWebhook(S, b, 1, msg);
  } catch (e) {
    console.error("[stripe webhook] confirmation send failed", e && e.message ? e.message : e);
  }
}

// Whsec-free confirmation: when Stripe redirects the customer to /booked, retrieve
// the session with our secret key and mark paid if it's settled. This fires the
// confirmation without needing a webhook/whsec (the webhook still works if set).
export async function confirmPaidByRedirect(env, S, ref) {
  const b = await env.DB.prepare("SELECT * FROM bookings WHERE id=?1").bind(ref).first();
  if (!b || b.status === "paid" || b.paid_at || !b.stripe_session_id) return { skipped: true };
  const key = (S && S.stripeMode === "live") ? env.STRIPE_SECRET_KEY_LIVE : env.STRIPE_SECRET_KEY;
  if (!key) return { skipped: true };
  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(b.stripe_session_id), {
      headers: { authorization: "Bearer " + key },
    });
    const s = await res.json();
    if (res.ok && s && s.payment_status === "paid") { await markPaid(env, S, ref, s); return { paid: true }; }
  } catch (e) { console.error("[stripe confirm-redirect]", e && e.message ? e.message : e); }
  return { paid: false };
}

// Handles POST /api/stripe-webhook. Returns { status } for the route to echo.
// 400 only on signature/parse failure; otherwise 200 so Stripe stops retrying.
export async function handleStripeWebhook(env, S, request) {
  // Verify against the active mode's signing secret (live endpoint vs sandbox).
  const secret = ((S && S.stripeMode === "live") ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET) || env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { console.error("[stripe webhook] no signing secret configured"); return { status: 400 }; }
  const raw = await request.text();
  const ok = await verifyStripeSig(raw, request.headers.get("stripe-signature"), secret);
  if (!ok) { console.error("[stripe webhook] bad signature"); return { status: 400 }; }

  let event;
  try { event = JSON.parse(raw); } catch { return { status: 400 }; }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data && event.data.object;
    const ref = session && (session.client_reference_id || (session.metadata && session.metadata.booking_id));
    if (ref && session.payment_status === "paid") {
      try { await markPaid(env, S, ref, session); }
      catch (e) { console.error("[stripe webhook] markPaid failed", e && e.message ? e.message : e); }
    }
  }
  return { status: 200 };
}
