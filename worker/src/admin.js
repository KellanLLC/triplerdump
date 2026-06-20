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
    '<label>Owner phone (for alerts)</label><input name="owner_phone" value="' + esc(S.ownerPhone) + '">';

  body += '<h2>SMS templates <span class="muted">tokens: {bin} {tier} {date} {pickup} {id} {name} {address} {total} {account} {phone} {link}</span></h2>' +
    '<label>Booking confirmation</label><textarea name="tpl_confirmation">' + esc(t.confirmation) + '</textarea>' +
    '<label>Owner alert</label><textarea name="tpl_owner">' + esc(t.owner) + '</textarea>' +
    '<label>Review request</label><textarea name="tpl_review">' + esc(t.review) + '</textarea>';

  body += '<div style="margin-top:16px"><button>Save all</button></div></div></form>';

  body += '<div class="card"><h2>Recent bookings</h2><table><tr><th>Ref</th><th>Status</th><th>Size</th><th>Drop</th><th>Customer</th><th>Total</th></tr>';
  for (const b of (bookings || [])) body += '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.status) + '</td><td>' + esc(b.bin_size) + 'yd</td><td>' + esc(b.delivery_date) + '</td><td>' + esc(b.customer_name) + '</td><td>$' + ((b.amount_cents || 0) / 100).toFixed(2) + '</td></tr>';
  if (!bookings || !bookings.length) body += '<tr><td colspan="6" class="muted">No bookings yet.</td></tr>';
  body += '</table></div>';

  body += '<div class="card"><h2>Low ratings &amp; feedback</h2><table><tr><th>When</th><th>Stars</th><th>Booking</th><th>Feedback</th></tr>';
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
  await saveSetting(env, "owner_phone", String(form.owner_phone || ""));
  await saveSetting(env, "sms_templates", { confirmation: String(form.tpl_confirmation || ""), owner: String(form.tpl_owner || ""), review: String(form.tpl_review || "") });
}
