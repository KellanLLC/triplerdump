// CMS / admin panel. Auth = HMAC-signed cookie (ADMIN_SECRET) gated by
// ADMIN_PASSWORD. All editable config lives in D1 `settings`.
import { saveSetting } from "./settings.js";

const COOKIE = "trd_admin";
const enc = new TextEncoder();

function b64url(buf) {
  let s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
function eq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

async function makeToken(secret) { const data = "admin." + (Date.now() + 7 * 864e5); return data + "." + (await hmac(secret, data)); }
async function checkToken(secret, token) {
  if (!token) return false;
  const p = token.split(".");
  if (p.length !== 3 || p[0] !== "admin") return false;
  if (parseInt(p[1], 10) < Date.now()) return false;
  return eq(p[2], await hmac(secret, p[0] + "." + p[1]));
}
function readCookie(req, name) {
  const h = req.headers.get("cookie") || "";
  const m = h.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export async function isAuthed(req, env) {
  if (!env.ADMIN_SECRET) return false;
  return checkToken(env.ADMIN_SECRET, readCookie(req, COOKIE));
}
export async function loginCookie(env, password) {
  if (!env.ADMIN_PASSWORD || !password || !eq(String(password), String(env.ADMIN_PASSWORD))) return null;
  const t = await makeToken(env.ADMIN_SECRET || "fallback-secret-change-me");
  return COOKIE + "=" + encodeURIComponent(t) + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800";
}
export function clearCookie() { return COOKIE + "=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"; }

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const page = (body) => '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Triple R Dump - Admin</title><style>' +
'body{margin:0;font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:#0b1b2b;background:#eef2f7}.wrap{max-width:760px;margin:0 auto;padding:24px 16px 70px}' +
'h1{font-size:24px}h2{font-size:16px;margin:26px 0 8px;border-bottom:1px solid #dde5ef;padding-bottom:4px}' +
'label{display:block;font-weight:600;margin:10px 0 2px}input,select,textarea{width:100%;padding:9px 11px;border:1px solid #cdd7e3;border-radius:8px;font:inherit;box-sizing:border-box}' +
'.row{display:flex;gap:12px}.row>div{flex:1}textarea{min-height:54px}.muted{color:#5a6b7d;font-size:13px}' +
'button{background:#116DFF;color:#fff;border:0;border-radius:9px;padding:12px 18px;font-size:15px;font-weight:700;cursor:pointer}' +
'.card{background:#fff;border:1px solid #dde5ef;border-radius:12px;padding:18px;margin-top:14px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid #eef2f7}' +
'.ok{background:#e9f9ee;border:1px solid #9be0b3;padding:8px 12px;border-radius:8px;margin-bottom:12px}.top{display:flex;justify-content:space-between;align-items:center}</style></head><body><main class="wrap">' + body + '</main></body></html>';

export function renderLogin(error) {
  return page('<h1>Triple R Dump - Admin</h1><div class="card"><form method="POST" action="/admin/login">' +
    (error ? '<div style="color:#c0392b;margin-bottom:8px">' + esc(error) + '</div>' : '') +
    '<label>Password</label><input type="password" name="password" autofocus required>' +
    '<button style="margin-top:12px">Log in</button></form></div>');
}

function priceField(S, size, tier) {
  const v = (S.bins[size] && S.bins[size].prices[tier] != null) ? (S.bins[size].prices[tier] / 100).toFixed(0) : "";
  return '<div><label>' + size + 'yd ' + tier + ' day ($)</label><input name="p_' + size + '_' + tier.replace("-", "") + '" value="' + esc(v) + '"></div>';
}

export function renderPanel(S, bookings, lowReviews, saved) {
  const t = S.templates || {};
  let body = '<div class="top"><h1>Admin</h1><form method="POST" action="/admin/logout"><button style="background:#64748b">Log out</button></form></div>';
  if (saved) body += '<div class="ok">Saved.</div>';
  body += '<form method="POST" action="/admin/save"><div class="card">';

  body += '<h2>Pricing &amp; tax</h2><div class="row">' + priceField(S, "15", "1-3") + priceField(S, "15", "4-7") + '</div>';
  body += '<div class="row">' + priceField(S, "20", "1-3") + priceField(S, "20", "4-7") + '</div>';
  body += '<div class="row">' + priceField(S, "25", "1-3") + priceField(S, "25", "4-7") + '</div>';
  body += '<label>Sales tax (%)</label><input name="tax" value="' + esc((S.taxRate * 100).toFixed(3).replace(/\.?0+$/, "")) + '">';

  body += '<h2>Capacity</h2><div class="row"><div><label>15yd qty</label><input name="inv_15" value="' + esc(S.bins["15"].inventory) + '"></div>' +
    '<div><label>20yd qty</label><input name="inv_20" value="' + esc(S.bins["20"].inventory) + '"></div>' +
    '<div><label>25yd qty</label><input name="inv_25" value="' + esc(S.bins["25"].inventory) + '"></div>' +
    '<div><label>Total cap</label><input name="cap" value="' + esc(S.totalCap) + '"></div></div>';

  body += '<h2>Webhooks (GoHighLevel)</h2><label>SMS / confirmation webhook URL</label><input name="sms_url" value="' + esc(S.ghlSmsUrl) + '">' +
    '<label>Review webhook URL <span class="muted">(blank = use the SMS one)</span></label><input name="review_url" value="' + esc(S.ghlReviewUrl) + '">';

  body += '<h2>Review funnel</h2><label>Google review link</label><input name="review_link" value="' + esc(S.reviewLink) + '">' +
    '<div class="row"><div><label>Mode</label><select name="review_mode"><option value="gated"' + (S.reviewMode === "gated" ? " selected" : "") + '>Gated (filter low ratings)</option><option value="open"' + (S.reviewMode === "open" ? " selected" : "") + '>Open (everyone)</option></select></div>' +
    '<div><label>Min stars to Google</label><input name="threshold" value="' + esc(S.reviewThreshold) + '"></div></div>' +
    '<label>Public base URL <span class="muted">(for review links in texts)</span></label><input name="base_url" value="' + esc(S.publicBaseUrl) + '">';

  body += '<h2>Booking</h2><label><input type="checkbox" name="require_payment" style="width:auto"' + (S.requirePayment ? " checked" : "") + '> Require online payment (turn ON once Stripe is live)</label>' +
    '<label>Stripe mode <span class="muted">(dev)</span></label><select name="stripe_mode"><option value="sandbox"' + (S.stripeMode !== "live" ? " selected" : "") + '>Sandbox (test cards)</option><option value="live"' + (S.stripeMode === "live" ? " selected" : "") + '>Live (real payments)</option></select>' +
    '<label>Owner phone (for alerts)</label><input name="owner_phone" value="' + esc(S.ownerPhone) + '">' +
    '<label><input type="checkbox" name="notify_owner_bookings" style="width:auto"' + (S.notifyOwnerBookings !== false ? " checked" : "") + '> Text owner on new bookings</label>' +
    '<label><input type="checkbox" name="notify_owner_reminders" style="width:auto"' + (S.notifyOwnerReminders !== false ? " checked" : "") + '> Text owner on delivery reminders</label>';

  body += '<h2>SMS templates</h2>' +
    '<p class="muted" style="margin:-6px 0 12px">Shared tokens: {name} {customer_phone} {id} {item} {length} {bin} {tier} {date} {pickup} {address} {total} {account} {note}. <b>{item}</b> = what they booked (20yd bin / dump trailer / junk removal / bin switch) &mdash; prefer it over {bin}yd, which is blank for non-dumpster services. {length} = rental length. {total} = amount charged incl. any refundable deposit. {phone} = your business number, {customer_phone} = the customer\'s. {note} = the customer\'s "Anything else?" message. <b>Link tokens differ by audience:</b> owner texts use {admin_link} (the /admin booking page); the review request uses {review_link} (the customer review page).</p>' +
    '<h3 style="margin:14px 0 6px;font-size:14px;color:#334155">To the customer</h3>' +
    '<label>Booking confirmation</label><textarea name="tpl_confirmation">' + esc(t.confirmation) + '</textarea>' +
    '<label>Delivery reminder <span class="muted">(day before)</span></label><textarea name="tpl_reminder_sms">' + esc(t.reminder_sms) + '</textarea>' +
    '<label>Review request <span class="muted">(after pickup &mdash; use {review_link})</span></label><textarea name="tpl_review">' + esc(t.review) + '</textarea>' +
    '<h3 style="margin:18px 0 6px;font-size:14px;color:#334155">To the owner</h3>' +
    '<label>New booking <span class="muted">(use {admin_link})</span></label><textarea name="tpl_owner">' + esc(t.owner) + '</textarea>' +
    '<label>Delivery reminder <span class="muted">(use {admin_link})</span></label><textarea name="tpl_owner_reminder">' + esc(t.owner_reminder) + '</textarea>' +
    '<label>Commercial quote request <span class="muted">(adds {company} {interest} {timeframe} {email} {details})</span></label><textarea name="tpl_commercial">' + esc(t.commercial) + '</textarea>' +
    '<label>Low rating alert <span class="muted">(adds {rating} {feedback}; use {admin_link})</span></label><textarea name="tpl_low_rating">' + esc(t.low_rating) + '</textarea>';

  body += '<div style="margin-top:16px"><button>Save all</button></div></div></form>';

  body += '<div class="card"><div class="top"><h2 style="border:0;margin:0">Recent bookings</h2><a href="/admin/bookings" style="color:#116DFF;font-weight:600;text-decoration:none">Manage all &rarr;</a></div><table><tr><th>Ref</th><th>Status</th><th>Size</th><th>Drop</th><th>Customer</th><th>Total</th></tr>';
  for (const b of (bookings || [])) body += '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.status) + '</td><td>' + esc(b.bin_size) + 'yd</td><td>' + esc(b.delivery_date) + '</td><td>' + esc(b.customer_name) + '</td><td>$' + ((b.amount_cents || 0) / 100).toFixed(2) + '</td></tr>';
  if (!bookings || !bookings.length) body += '<tr><td colspan="6" class="muted">No bookings yet.</td></tr>';
  body += '</table></div>';

  body += '<div class="card"><h2>Ratings &amp; feedback</h2><table><tr><th>When</th><th>Stars</th><th>Booking</th><th>Feedback</th></tr>';
  for (const r of (lowReviews || [])) body += '<tr><td>' + esc((r.created_at || "").slice(0, 10)) + '</td><td>' + esc(r.rating) + '</td><td>' + esc(r.booking_id) + '</td><td>' + esc(r.feedback) + '</td></tr>';
  if (!lowReviews || !lowReviews.length) body += '<tr><td colspan="4" class="muted">None.</td></tr>';
  body += '</table></div>';

  return page(body);
}

export async function saveSettings(env, form) {
  const n = (v) => { const x = parseFloat(v); return Number.isNaN(x) ? null : x; };
  const bins = {
    "15": { label: "15 yard", inventory: parseInt(form.inv_15, 10) || 0, prices: { "1-3": Math.round((n(form.p_15_13) || 0) * 100), "4-7": Math.round((n(form.p_15_47) || 0) * 100) } },
    "20": { label: "20 yard", inventory: parseInt(form.inv_20, 10) || 0, prices: { "1-3": Math.round((n(form.p_20_13) || 0) * 100), "4-7": Math.round((n(form.p_20_47) || 0) * 100) } },
    "25": { label: "25 yard", inventory: parseInt(form.inv_25, 10) || 0, prices: { "1-3": Math.round((n(form.p_25_13) || 0) * 100), "4-7": Math.round((n(form.p_25_47) || 0) * 100) } },
  };
  await saveSetting(env, "bins", bins);
  await saveSetting(env, "tax_rate", (n(form.tax) || 0) / 100);
  await saveSetting(env, "total_cap", parseInt(form.cap, 10) || 11);
  await saveSetting(env, "ghl_sms_webhook_url", String(form.sms_url || ""));
  await saveSetting(env, "ghl_review_webhook_url", String(form.review_url || ""));
  await saveSetting(env, "review_link", String(form.review_link || ""));
  await saveSetting(env, "review_mode", form.review_mode === "open" ? "open" : "gated");
  await saveSetting(env, "review_threshold", parseInt(form.threshold, 10) || 4);
  await saveSetting(env, "public_base_url", String(form.base_url || ""));
  await saveSetting(env, "require_payment", form.require_payment === "on" || form.require_payment === "true");
  await saveSetting(env, "stripe_mode", form.stripe_mode === "live" ? "live" : "sandbox");
  await saveSetting(env, "notify_owner_bookings", form.notify_owner_bookings === "on" || form.notify_owner_bookings === "true");
  await saveSetting(env, "notify_owner_reminders", form.notify_owner_reminders === "on" || form.notify_owner_reminders === "true");
  await saveSetting(env, "owner_phone", String(form.owner_phone || ""));
  await saveSetting(env, "sms_templates", { confirmation: String(form.tpl_confirmation || ""), reminder_sms: String(form.tpl_reminder_sms || ""), review: String(form.tpl_review || ""), owner: String(form.tpl_owner || ""), owner_reminder: String(form.tpl_owner_reminder || ""), commercial: String(form.tpl_commercial || ""), low_rating: String(form.tpl_low_rating || "") });
}

// ----- Bookings management (own routes; auth-gated in index.js) -----

export function renderBookingsList(S, rows, q) {
  let body = '<div class="top"><h1>Bookings</h1><a href="/admin" style="color:#64748b;text-decoration:none">&larr; Settings</a></div>';
  body += '<form method="GET" action="/admin/bookings" class="card"><label>Search by ref, name, or phone</label><div class="row"><div><input name="q" value="' + esc(q || "") + '" placeholder="TRD-… / name / phone" autofocus></div><div style="flex:0 0 auto"><button>Search</button></div></div></form>';
  body += '<div class="card"><table><tr><th>Ref</th><th>Status</th><th>Service</th><th>Delivery</th><th>Customer</th><th>Total</th></tr>';
  for (const b of (rows || [])) {
    const svc = esc(b.service_type || "dumpster") + (b.bin_size ? " " + esc(b.bin_size) + "yd" : "");
    body += '<tr><td><a href="/admin/booking/' + esc(b.id) + '" style="color:#116DFF;font-weight:600">' + esc(b.id) + '</a></td><td>' + esc(b.status) + '</td><td>' + svc + '</td><td>' + esc(b.delivery_date) + '</td><td>' + esc(b.customer_name) + '</td><td>$' + ((b.amount_cents || 0) / 100).toFixed(2) + '</td></tr>';
  }
  if (!rows || !rows.length) body += '<tr><td colspan="6" class="muted">No bookings' + (q ? ' match "' + esc(q) + '"' : ' yet') + '.</td></tr>';
  body += '</table></div>';
  return page(body);
}

export function renderBookingDetail(S, b) {
  if (!b) return page('<div class="top"><h1>Booking</h1><a href="/admin/bookings" style="color:#64748b;text-decoration:none">&larr; Bookings</a></div><div class="card"><p class="muted">Not found.</p></div>');
  const addr = b.address || "";
  const gmap = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
  const amap = "https://maps.apple.com/?q=" + encodeURIComponent(addr);
  const money = (c) => "$" + ((c || 0) / 100).toFixed(2);
  const r = (k, v) => '<div style="display:flex;border-bottom:1px solid #eef2f7;padding:5px 0"><div style="flex:0 0 42%;color:#5a6b7d">' + esc(k) + '</div><div style="flex:1"><b>' + esc(v == null || v === "" ? "—" : v) + '</b></div></div>';
  let body = '<div class="top"><h1>' + esc(b.id) + '</h1><a href="/admin/bookings" style="color:#64748b;text-decoration:none">&larr; Bookings</a></div>';
  body += '<div class="card">';
  body += r("Status", b.status) + r("Account", b.account_type) + r("Service", b.service_type) + r("Bin size", b.bin_size ? b.bin_size + "yd" : "") + r("Rental", b.rental_tier ? b.rental_tier + " day" : (b.rental_days ? b.rental_days + " days" : "")) + r("Customer", b.customer_name) + r("Phone", b.phone) + r("Email", b.email) + r("Company", b.company);
  body += r("Delivery", b.delivery_date + (b.delivery_time ? " " + b.delivery_time : "")) + r("Pickup", b.pickup_date) + r("Address", b.address) + r("Ground", b.ground_condition) + r("Customer note", b.message);
  body += r("Subtotal", money(b.subtotal_cents)) + r("Tax", money(b.tax_cents)) + r("Total", money(b.amount_cents)) + (b.deposit_cents ? r("Deposit", money(b.deposit_cents)) : "") + r("Payment", b.payment_type) + r("Paid at", b.paid_at) + r("Stripe session", b.stripe_session_id);
  body += '<div style="margin-top:12px"><a href="' + gmap + '" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">Open in Google Maps</a> &nbsp;·&nbsp; <a href="' + amap + '" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">Apple Maps</a></div>';
  body += '</div>';
  body += '<div class="card"><h2>Notes</h2><form method="POST" action="/admin/booking/' + esc(b.id) + '/notes"><textarea name="notes" placeholder="Internal notes — pickup details, gate code, etc.">' + esc(b.notes || "") + '</textarea><div style="margin-top:8px"><button>Save notes</button></div></form></div>';
  body += '<div class="card"><h2>Actions</h2>';
  body += '<form method="POST" action="/admin/booking/' + esc(b.id) + '/status" style="display:inline-block;margin:0 6px 6px 0"><input type="hidden" name="status" value="completed"><button>Mark picked up / completed</button></form>';
  body += '<form method="POST" action="/admin/booking/' + esc(b.id) + '/delete" style="display:inline-block" onsubmit="return confirm(\'Delete booking ' + esc(b.id) + '? This cannot be undone.\')"><button style="background:#c0392b">Delete (dev)</button></form>';
  body += '<p class="muted" style="margin-top:8px">Refunds are handled in the Stripe dashboard.</p>';
  body += '</div>';
  return page(body);
}
