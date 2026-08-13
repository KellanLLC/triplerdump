// CMS / admin panel. Auth = HMAC-signed cookie (ADMIN_SECRET) gated by
// ADMIN_PASSWORD. All editable config lives in D1 `settings`.
import { saveSetting, loadSettings, itemLabel } from "./settings.js";

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
// Type is deliberately larger than a typical dashboard (16px base, 17px inputs):
// this gets used on a phone, outdoors, by one person who is not a software user.
'body{margin:0;font:16px/1.55 system-ui,Segoe UI,Roboto,sans-serif;color:#0b1b2b;background:#ecf2fa}' +
'.wrap{max-width:780px;margin:0 auto;padding:24px 16px 40px}' +
'h1{font-size:25px;margin:0}h2{font-size:19px;margin:0 0 3px}' +
'h3{font-size:15px;margin:22px 0 6px;color:#334155}' +
// Every section leads with a plain-English sentence saying what it is for.
'.what{color:#5a6b7d;font-size:14px;margin:0 0 14px}' +
'label{display:block;font-weight:600;margin:14px 0 3px}' +
'input,select,textarea{width:100%;padding:11px 12px;border:1px solid #cdd7e3;border-radius:8px;font-size:17px;font-family:inherit;box-sizing:border-box;background:#fff}' +
'input:focus,select:focus,textarea:focus{outline:2px solid #116DFF;outline-offset:-1px;border-color:#116DFF}' +
// Each row cell is a column with its input anchored to the bottom, so paired
// fields keep their boxes on one line even when one hint wraps and the other
// doesn't - ragged side-by-side inputs read as broken.
'.row{display:flex;gap:12px;flex-wrap:wrap}.row>div{flex:1;min-width:132px;display:flex;flex-direction:column}' +
'.row>div>input,.row>div>select,.row>div>textarea,.row>div>.cash{margin-top:auto}' +
'textarea{min-height:58px;font-size:15px}.muted{color:#5a6b7d;font-size:14px}' +
// Money fields show a real $ inside the box so an amount is never ambiguous.
// The $ lives in its own .cash wrapper around ONLY the input (label + hint stay in
// normal flow above), centered on the input's own height - so a hint of any length
// can never collide with it. A bare ".cash span" selector once caught the hint span
// inside the label too and pinned it over the input; keep the ">" child selector.
'.cash{position:relative}.cash>span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#5a6b7d;font-weight:600}' +
'.cash input{padding-left:27px}' +
'.hint{display:block;font-weight:400;color:#5a6b7d;font-size:13.5px;margin-top:3px}' +
'button{background:#116DFF;color:#fff;border:0;border-radius:9px;padding:13px 20px;font-size:16px;font-weight:700;cursor:pointer}' +
'button:hover{background:#0b54cc}' +
// overflow-x keeps wide tables (bookings, invoices) scrolling inside their own card
// on a phone instead of stretching the whole page sideways.
'.card{background:#fff;border:1px solid #dde5ef;border-radius:12px;padding:20px;margin-top:16px;overflow-x:auto}' +
'table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:7px 6px;border-bottom:1px solid #eef2f7}' +
'.ok{background:#e9f9ee;border:1px solid #9be0b3;padding:10px 14px;border-radius:8px;margin-bottom:12px}' +
'.top{display:flex;justify-content:space-between;align-items:center;gap:12px}' +
// Loud, plain-words confirmation of the thing he just did ("✓ marked picked up,
// review text on its way") — the old silent redirect read as "nothing happened".
'.flash{background:#e9f9ee;border:1px solid #9be0b3;border-radius:10px;padding:14px 16px;margin-top:12px;font-size:16.5px}' +
'.flash.warn{background:#fff8ec;border-color:#f0c36d}' +
// Today view: one row per job, the single action that matters on the right.
'.job{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #eef2f7}' +
'.job:last-child{border-bottom:0}' +
'.job-info{flex:1;min-width:0}' +
'.job-who{font-weight:700;font-size:17px}' +
'.job-meta{color:#5a6b7d;font-size:14.5px;margin-top:2px;overflow-wrap:anywhere}' +
'.job-meta a{color:#116DFF;text-decoration:none;font-weight:600}' +
'button.done{background:#146c2e;white-space:nowrap}button.done:hover{background:#0f5423}' +
'.card.attn{border-color:#f0c36d;background:#fffdf6}' +
// Two big flat-footed doors to the other screens — no hunting through tabs.
'.quick{display:flex;gap:10px;margin-top:14px}' +
'.quick a{flex:1;display:block;text-align:center;background:#fff;border:1px solid #d7e3f4;border-radius:12px;padding:15px 8px;font-weight:700;color:#0b1b2b;text-decoration:none;font-size:16px}' +
// Advanced settings are demoted and collapsed: they are the ones that break the
// site if guessed at, and they are not what he opens this page to do.
'details.adv{margin-top:16px;background:#f7f9fc;border:1px dashed #cdd7e3;border-radius:12px;padding:14px 18px}' +
'details.adv summary{cursor:pointer;font-weight:700;color:#5a6b7d}' +
// Save stays reachable without hunting for the end of a long form.
'.savebar{position:sticky;bottom:0;background:#ecf2fa;padding:12px 0;margin-top:8px;border-top:1px solid #dde5ef}' +
// Tabs: one job per screen instead of one very long page. type="button" on each so
// they can never submit the form. Without JS every panel simply stays visible, so
// the page degrades to the old long-scroll version rather than showing nothing.
// Tabs WRAP instead of scrolling sideways: on a phone every tab stays visible and
// tappable (a scrolled strip hides half of them, and on desktop it grew a scrollbar).
'.tabs{display:flex;flex-wrap:wrap;gap:6px;margin:20px 0 0}' +
'.tabs button{background:#fff;color:#334155;border:1px solid #dde5ef;border-radius:10px;padding:11px 15px;font-size:15px;font-weight:600;white-space:nowrap;cursor:pointer}' +
'.tabs button[aria-selected="true"]{background:#116DFF;color:#fff;border-color:#116DFF}' +
'.tabs button:hover{border-color:#116DFF}' +
'.panel>.card:first-child{margin-top:14px}' +
'@media(max-width:520px){.row>div{min-width:100%}}' +
// Mobile first: Joseph runs this from his phone, outdoors. Under 480px the paired
// columns stack full-width (hints read on one or two lines instead of a squeezed
// ribbon), the save button becomes a full-width thumb target, and the page gutter
// tightens so fields get the room instead.
'@media(max-width:520px){' +
  '.wrap{padding:14px 10px 40px}' +
  '.row{display:block}.row>div{min-width:0}' +
  '.card{padding:16px 14px}' +
  '.savebar button{width:100%}' +
  'h1{font-size:22px}' +
  // Job rows stack: info on top, a full-width thumb-sized green button under it.
  '.job{flex-wrap:wrap}.job form{width:100%}.job form button{width:100%;padding:14px}' +
'}' +
'</style></head><body><main class="wrap">' + body + '</main></body></html>';

export function renderLogin(error) {
  return page('<div style="max-width:420px;margin:8vh auto 0"><h1 style="text-align:center">Triple R Dump</h1>' +
    '<div class="card"><form method="POST" action="/admin/login">' +
    (error ? '<div style="color:#c0392b;margin-bottom:8px;font-weight:600">' + esc(error) + '</div>' : '') +
    '<label>Password</label><input type="password" name="password" autofocus required>' +
    '<button style="margin-top:14px;width:100%">Log in</button></form></div></div>');
}

// Plain-words banner for the action just taken. The "done-*" codes come from the
// mark-picked-up flow and say exactly what happened with the review text, because
// "did it send?" is the first thing the owner wonders.
function flashHtml(flash, ref) {
  if (!flash) return "";
  const who = ref ? "<b>" + esc(ref) + "</b> " : "";
  const M = {
    "done-review": who + "<b>marked picked up.</b> The customer's review text is on its way.",
    "done-already": who + "<b>marked picked up.</b> They'd already been asked for a review, so no new text (we never ask twice).",
    "done-failed": who + "<b>marked picked up</b> &mdash; but the review text could not be sent right now. Press the green button again in a minute to retry.",
    "done": who + "<b>marked picked up.</b>",
    "saved": who + "<b>Saved.</b>",
  };
  if (!M[flash]) return "";
  return '<div class="flash' + (flash === "done-failed" ? " warn" : "") + '">&#10003; ' + M[flash] + '</div>';
}

// Status words get a consistent color everywhere they appear — colored TEXT, not
// badges: paid/confirmed = live money (blue), completed = closed (green),
// pending = an unpaid hold (amber), cancelled = gone (grey).
const BOOKING_STATUS_COLOR = { paid: "#116DFF", confirmed: "#116DFF", completed: "#16a34a", pending: "#b45309", quote_requested: "#b45309", cancelled: "#64748b" };
const statusWord = (s) => '<b style="color:' + (BOOKING_STATUS_COLOR[s] || "#0b1b2b") + '">' + esc(s || "—") + "</b>";

// ----- Today view -------------------------------------------------------------
// The first thing the owner sees on /admin: what needs doing NOW, each job one
// row with the single action that matters. The green button posts the same
// /status route as the booking page; back=admin returns him here with the
// confirmation banner on top.
function jobRow(b, withDone) {
  const gmap = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(b.address || "");
  const tel = "tel:+1" + String(b.phone || "").replace(/[^\d]/g, "").slice(-10);
  let html = '<div class="job"><div class="job-info">' +
    '<div class="job-who">' + esc(b.customer_name) + ' &mdash; ' + esc(itemLabel(b)) + '</div>' +
    '<div class="job-meta"><a href="' + gmap + '" target="_blank" rel="noopener">' + esc(b.address || "no address") + '</a>' +
    ' &middot; <a href="' + esc(tel) + '">' + esc(b.phone || "") + '</a>' +
    ' &middot; <a href="/admin/booking/' + esc(b.id) + '">' + esc(b.id) + '</a></div></div>';
  if (withDone) {
    html += '<form method="POST" action="/admin/booking/' + esc(b.id) + '/status">' +
      '<input type="hidden" name="status" value="completed"><input type="hidden" name="back" value="admin">' +
      '<button class="done">&#10003; Picked up</button></form>';
  }
  return html + '</div>';
}

function todaySection(S, d) {
  const today = d.today || "";
  const active = d.active || [];
  const overdue = active.filter((b) => b.pickup_date < today);
  const finish = active.filter((b) => b.pickup_date === today);
  const deliver = active.filter((b) => b.delivery_date === today && b.pickup_date > today);
  const dayName = today
    ? new Date(today + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: (S.business && S.business.timezone) || "America/Denver", weekday: "long", month: "long", day: "numeric" })
    : "";

  let html = "";
  if (overdue.length) {
    html += '<div class="card attn"><h2 style="color:#b45309">Still out &mdash; needs closing</h2>' +
      '<p class="what">These were due back already but were never marked picked up. Job done? Tap the green button &mdash; that also sends the customer their review text.</p>';
    for (const b of overdue) html += jobRow(b, true);
    html += '</div>';
  }
  html += '<div class="card"><h2>Today' + (dayName ? ' &mdash; ' + esc(dayName) : '') + '</h2>';
  if (!finish.length && !deliver.length) {
    html += '<p class="muted" style="margin:6px 0 0">Nothing scheduled today.</p>';
  } else {
    if (deliver.length) { html += '<h3 style="margin-top:12px">Deliver</h3>'; for (const b of deliver) html += jobRow(b, false); }
    if (finish.length) { html += '<h3 style="margin-top:12px">Pick up &mdash; tap when done</h3>'; for (const b of finish) html += jobRow(b, true); }
  }
  html += '</div>';
  return html + '<div class="quick"><a href="/admin/bookings">All bookings</a><a href="/admin/invoices">Invoices</a></div>';
}

function priceField(S, size, tier) {
  const v = (S.bins[size] && S.bins[size].prices[tier] != null) ? (S.bins[size].prices[tier] / 100).toFixed(0) : "";
  return '<div><label>' + size + 'yd ' + tier + ' day ($)</label><input name="p_' + size + '_' + tier.replace("-", "") + '" value="' + esc(v) + '"></div>';
}

// $ field. `hint` is written for someone who has never used an admin panel:
// it says WHEN the money is charged, not what the variable is called.
function cashField(name, label, cents, hint) {
  return '<div><label>' + esc(label) + (hint ? '<span class="hint">' + esc(hint) + '</span>' : "") + '</label>' +
    '<div class="cash"><span>$</span><input name="' + name + '" inputmode="decimal" value="' + esc(cents == null ? "" : Math.round(cents / 100)) + '"></div></div>';
}

export function renderPanel(S, data) {
  const d = data || {};
  const bookings = d.recent || [];
  const lowReviews = d.lowReviews || [];
  const t = S.templates || {};
  const f = S.fees || {};
  // One panel per job. Collected first, then rendered as tabs, so the owner sees a
  // single short screen instead of scrolling past six sections he didn't come for.
  const panels = [];
  const sec = (id, label, html, readonly) => panels.push({ id, label, html, readonly });

  let body = '<div class="top"><h1>Triple R Dump</h1><form method="POST" action="/admin/logout"><button style="background:#64748b">Log out</button></form></div>';
  if (d.saved) body += '<div class="flash"><b>Saved.</b> Your changes are live on the website now.</div>';
  body += flashHtml(d.flash, d.flashRef);
  // What needs doing today sits ABOVE the settings tabs: the owner opens this
  // page to run his day, not to edit config.
  body += todaySection(S, d);

  // First tab on purpose: the answer to "what am I looking at" should be the
  // thing in front of him, not something he has to go hunting for. Marked
  // readonly so the Save bar hides — there is nothing here to submit.
  sec("guide", "How this works", '<div class="card">' +
    '<h2>The one thing to remember</h2>' +
    '<p class="what" style="font-size:15px">When the bin is back on your truck, open that job and tap <b>&ldquo;Mark picked up / completed.&rdquo;</b> That is the only step the website can\'t work out on its own, and it\'s what asks the customer for a review. Everything else runs itself.</p>' +
    '</div>' +

    '<div class="card"><h2>How a job flows</h2>' +
    '<ol style="margin:0;padding-left:20px;line-height:1.75">' +
      '<li>Customer books and <b>pays in full online</b>. Nothing to collect.</li>' +
      '<li><b>You get a text</b> with the job and a link to every detail.</li>' +
      '<li>You deliver. A reminder text goes to you both the day before.</li>' +
      '<li>You pick up. A reminder text goes to you the <b>morning it\'s due</b>.</li>' +
      '<li>You tap <b>Mark picked up / completed</b> &mdash; the review request goes out.</li>' +
    '</ol></div>' +

    '<div class="card"><h2>Reminders you\'ll get</h2>' +
    '<table><tr><th>When</th><th>Who</th><th>What</th></tr>' +
      '<tr><td>Day before delivery</td><td>You + customer</td><td>Deliver this bin tomorrow</td></tr>' +
      '<tr><td>Day before pickup</td><td>Customer</td><td>We pick up tomorrow &mdash; call to extend</td></tr>' +
      '<tr><td><b>Morning of pickup</b></td><td><b>You</b></td><td><b>Pick up this bin today</b></td></tr>' +
      '<tr><td>Day after pickup</td><td>You</td><td>Only if the job was never marked done &mdash; tap the link to close it</td></tr>' +
    '</table>' +
    '<p class="muted" style="margin-top:10px">If someone wants to keep it longer, open the job and use <b>Pickup date</b>. That stops the bin being double-booked, restarts the reminders for the new date, and notes the change. Then charge the extra days in Stripe.</p></div>' +

    '<div class="card"><h2>Money</h2>' +
    '<p class="what">Residential customers pay in full when they book. <b>Refunds are done in the Stripe dashboard</b>, not here.</p>' +
    '<p class="what" style="margin-bottom:6px"><b>Charging extra later</b> (overweight, damage, a wasted trip):</p>' +
    '<table><tr><th>How the job was paid</th><th>Can you charge their card later?</th></tr>' +
      '<tr><td>Booked &amp; paid online</td><td><b>Yes</b> &mdash; card is saved, charge it in Stripe</td></tr>' +
      '<tr><td>You sent an invoice</td><td><b>No card is saved.</b> Send a second invoice</td></tr>' +
    '</table>' +
    '<p class="muted" style="margin-top:10px">Don\'t promise &ldquo;we\'ll just put it on your card&rdquo; unless they booked online. The fees you can charge are listed on your <a href="/terms" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">Terms page</a>, and they agreed to them at booking.</p></div>' +

    '<div class="card"><h2>Reviews</h2>' +
    '<p class="what">After you mark a job complete the customer is asked how it went. <b>4 or 5 stars</b> goes straight to your Google page. <b>3 or less</b> comes privately to you as a text with their comment &mdash; so you hear about a problem before the internet does.</p>' +
    '<p class="muted">If they ignore it, we nudge them up to three more times and then stop for good. The nudges stop the second they open the link or answer. Nobody who already reviewed you gets asked again.</p></div>' +

    '<div class="card"><h2>Things it does without asking</h2>' +
    '<ul style="margin:0;padding-left:20px;line-height:1.75">' +
      '<li><b>Turns away far-away jobs.</b> Past your delivery radius they\'re told to call you instead.</li>' +
      '<li><b>Junk removal is weekends only.</b> Weekday requests are refused.</li>' +
      '<li><b>Won\'t overbook you.</b> It knows how many bins you own.</li>' +
      '<li><b>Frees abandoned checkouts.</b> If payment doesn\'t finish, the slot frees itself and the customer can simply try again.</li>' +
      '<li><b>Blocks spam.</b> If a real customer says &ldquo;it told me to call you&rdquo;, just take it by phone.</li>' +
    '</ul></div>' +

    '<div class="card"><h2>Using these tabs</h2>' +
    '<p class="what">Change anything here and it\'s live on the website immediately &mdash; no one needs to redeploy anything.</p>' +
    '<ul style="margin:0;padding-left:20px;line-height:1.75">' +
      '<li><b>Extra fees</b> rewrites your Terms page automatically.</li>' +
      '<li>In <b>Texts</b>, keep the bits in {curly braces} &mdash; they become real details. <b>Never leave a message box empty</b>; empty means that text stops sending.</li>' +
      '<li><b>Leave Advanced alone.</b> That\'s plumbing.</li>' +
    '</ul>' +
    '<p class="muted" style="margin-top:12px">Something actually broken? Call Boston. Don\'t start changing settings to fix it &mdash; that makes it harder to find.</p></div>', true);

  sec("prices", "Prices", '<div class="card"><h2>What you charge</h2>' +
    '<p class="what">Your bin prices. First box is a 1&ndash;3 day rental, second is 4&ndash;7 days.</p>' +
    '<div class="row">' + priceField(S, "15", "1-3") + priceField(S, "15", "4-7") + '</div>' +
    '<div class="row">' + priceField(S, "20", "1-3") + priceField(S, "20", "4-7") + '</div>' +
    '<div class="row">' + priceField(S, "25", "1-3") + priceField(S, "25", "4-7") + '</div>' +
    '<label>Sales tax<span class="hint">Percent added at checkout. Utah is 7.5.</span></label>' +
    '<input name="tax" inputmode="decimal" value="' + esc((S.taxRate * 100).toFixed(3).replace(/\.?0+$/, "")) + '"></div>');

  sec("fees", "Extra fees", '<div class="card"><h2>Extra fees</h2>' +
    '<p class="what">Charges on top of the rental. <b>These write your Terms page automatically</b> &mdash; change a number here and the website wording updates to match.</p>' +
    '<div class="row">' +
      cashField("fee_dry_run", "Wasted trip", f.dryRun, "Driver shows up but can't do the job: blocked, locked gate, bin too full.") +
      cashField("fee_overweight_ton", "Overweight, per ton", f.overweightTon, "Charged for each ton over what the bin includes.") +
    '</div><div class="row">' +
      cashField("fee_extension_day", "Extra day", f.extensionDay, "Per day they keep the bin past the booked dates.") +
      cashField("fee_prohibited_item", "Banned item", f.prohibitedItem, "Per item: paint, tires, batteries, chemicals.") +
    '</div><div class="row">' +
      cashField("fee_cancel_dispatch", "Late cancellation", f.cancelAfterDispatch, "Only once the truck has already left for the drop-off.") +
      '<div><label>Free cancellation window<span class="hint">Hours before delivery they can still cancel free.</span></label>' +
      '<input name="fee_refund_hours" inputmode="numeric" value="' + esc(f.refundCutoffHours) + '"></div>' +
    '</div>' +
    '<h3>Late payment on invoices</h3>' +
    '<div class="row"><div><label>Late charge<span class="hint">Percent per month on what is still owed.</span></label>' +
      '<input name="fee_late_pct" inputmode="decimal" value="' + esc(f.latePct) + '"></div>' +
      '<div><label>Grace period<span class="hint">Days after the due date before it kicks in.</span></label>' +
      '<input name="fee_late_days" inputmode="numeric" value="' + esc(f.lateGraceDays) + '"></div></div>' +
    '<h3>Weight included with each bin</h3>' +
    '<p class="what" style="margin:-2px 0 4px">Tons included before the overweight fee starts.</p>' +
    '<div class="row"><div><label>15 yard</label><input name="tons_15" inputmode="decimal" value="' + esc(f.tons15) + '"></div>' +
      '<div><label>20 yard</label><input name="tons_20" inputmode="decimal" value="' + esc(f.tons20) + '"></div>' +
      '<div><label>25 yard</label><input name="tons_25" inputmode="decimal" value="' + esc(f.tons25) + '"></div></div>' +
    '<p class="muted" style="margin-top:14px"><a href="/terms" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">See your Terms page &rarr;</a></p></div>');

  sec("bins", "Bins", '<div class="card"><h2>How many bins you have</h2>' +
    '<p class="what">Stops the website from booking a bin you don\'t have free that day.</p>' +
    '<div class="row"><div><label>15 yard</label><input name="inv_15" inputmode="numeric" value="' + esc(S.bins["15"].inventory) + '"></div>' +
    '<div><label>20 yard</label><input name="inv_20" inputmode="numeric" value="' + esc(S.bins["20"].inventory) + '"></div>' +
    '<div><label>25 yard</label><input name="inv_25" inputmode="numeric" value="' + esc(S.bins["25"].inventory) + '"></div>' +
    '<div><label>Most out at once<span class="hint">All sizes combined.</span></label><input name="cap" inputmode="numeric" value="' + esc(S.totalCap) + '"></div></div>' +
    '<h3>Delivery area</h3>' +
    '<div class="row"><div><label>How far you\'ll deliver<span class="hint">Miles from your yard. Addresses farther than this can\'t book online &mdash; they\'re told to call you instead. Put 0 to turn the check off.</span></label>' +
    '<input name="service_radius" inputmode="numeric" value="' + esc(S.serviceRadiusMiles) + '"></div></div></div>');

  sec("alerts", "Alerts", '<div class="card"><h2>Your alerts</h2>' +
    '<p class="what">Where the website texts you when something happens.</p>' +
    '<label>Your mobile number</label><input name="owner_phone" inputmode="tel" value="' + esc(S.ownerPhone) + '">' +
    '<label style="font-weight:400;margin-top:14px"><input type="checkbox" name="notify_owner_bookings" style="width:auto"' + (S.notifyOwnerBookings !== false ? " checked" : "") + '> Text me when someone books</label>' +
    '<label style="font-weight:400;margin-top:8px"><input type="checkbox" name="notify_owner_reminders" style="width:auto"' + (S.notifyOwnerReminders !== false ? " checked" : "") + '> Text me the day before a delivery + the morning of each pickup</label>' +
    '<label style="font-weight:400;margin-top:8px"><input type="checkbox" name="require_payment" style="width:auto"' + (S.requirePayment ? " checked" : "") + '> Customers must pay online to book</label></div>');

  sec("reviews", "Reviews", '<div class="card"><h2>Reviews</h2>' +
    '<p class="what">After you mark a job complete, the customer gets a text asking how it went.</p>' +
    '<label>Your Google review link</label><input name="review_link" value="' + esc(S.reviewLink) + '">' +
    '<div class="row"><div><label>Who gets sent to Google<span class="hint">Gated sends only happy customers; unhappy ones reach you privately instead.</span></label>' +
    '<select name="review_mode"><option value="gated"' + (S.reviewMode === "gated" ? " selected" : "") + '>Only happy customers</option><option value="open"' + (S.reviewMode === "open" ? " selected" : "") + '>Everyone</option></select></div>' +
    '<div><label>Stars needed<span class="hint">This many or more counts as happy.</span></label><input name="threshold" inputmode="numeric" value="' + esc(S.reviewThreshold) + '"></div></div>' +
    '<h3>Chasing the ones who never answer</h3>' +
    '<p class="what" style="margin:-2px 0 10px">If they don\'t reply, we nudge them up to three times, then stop for good. <b>The moment they open the link or leave a rating, the nudges stop.</b> Hours count from the message before. Put 0 to switch a nudge off.</p>' +
    '<div class="row">' +
      '<div><label>1st nudge<span class="hint">Hours after the first ask.</span></label><input name="fu_1" inputmode="numeric" value="' + esc((S.reviewFollowupHours || [])[0] != null ? S.reviewFollowupHours[0] : "") + '"></div>' +
      '<div><label>2nd nudge<span class="hint">Hours after the 1st.</span></label><input name="fu_2" inputmode="numeric" value="' + esc((S.reviewFollowupHours || [])[1] != null ? S.reviewFollowupHours[1] : "") + '"></div>' +
      '<div><label>3rd nudge<span class="hint">Hours after the 2nd.</span></label><input name="fu_3" inputmode="numeric" value="' + esc((S.reviewFollowupHours || [])[2] != null ? S.reviewFollowupHours[2] : "") + '"></div>' +
    '</div></div>');

  sec("texts", "Texts", '<div class="card"><h2>Text messages</h2>' +
    '<p class="what">The wording of every text the website sends. Anything in {curly braces} gets swapped for the real detail, so leave those as they are.</p>' +
    '<details class="adv" style="margin:0 0 4px"><summary>What each {token} means</summary>' +
    '<p class="muted" style="margin:8px 0 0">Shared tokens: {name} {customer_phone} {id} {item} {length} {bin} {tier} {date} {pickup} {address} {total} {account} {note}. <b>{item}</b> = what they booked (20yd bin / dump trailer / junk removal / bin switch) &mdash; prefer it over {bin}yd, which is blank for non-dumpster services. {length} = rental length. {total} = amount charged incl. any refundable deposit. {phone} = your business number, {customer_phone} = the customer\'s. {note} = the customer\'s "Anything else?" message. <b>Link tokens differ by audience:</b> owner texts use {admin_link} (the /admin booking page); the review request uses {review_link} (the customer review page).</p></details>' +
    '<h3>To the customer</h3>' +
    '<label>Booking confirmation</label><textarea name="tpl_confirmation">' + esc(t.confirmation) + '</textarea>' +
    '<label>Delivery reminder <span class="muted">(day before)</span></label><textarea name="tpl_reminder_sms">' + esc(t.reminder_sms) + '</textarea>' +
    '<label>Pickup reminder <span class="muted">(day before pickup, so they can call to extend; {extension_day} = your per-day extension fee)</span></label><textarea name="tpl_pickup_reminder">' + esc(t.pickup_reminder) + '</textarea>' +
    '<label>Review request <span class="muted">(after pickup &mdash; use {review_link})</span></label><textarea name="tpl_review">' + esc(t.review) + '</textarea>' +
    '<label>Nudge 1 <span class="muted">(if they never answered)</span></label><textarea name="tpl_review_followup_1">' + esc(t.review_followup_1) + '</textarea>' +
    '<label>Nudge 2</label><textarea name="tpl_review_followup_2">' + esc(t.review_followup_2) + '</textarea>' +
    '<label>Nudge 3 <span class="muted">(the last one they ever get)</span></label><textarea name="tpl_review_followup_3">' + esc(t.review_followup_3) + '</textarea>' +
    '<h3>To you</h3>' +
    '<label>New booking <span class="muted">(use {admin_link})</span></label><textarea name="tpl_owner">' + esc(t.owner) + '</textarea>' +
    '<label>Delivery reminder <span class="muted">(use {admin_link})</span></label><textarea name="tpl_owner_reminder">' + esc(t.owner_reminder) + '</textarea>' +
    '<label>Pickup day <span class="muted">(sent the morning a bin is due back; use {admin_link})</span></label><textarea name="tpl_owner_pickup_reminder">' + esc(t.owner_pickup_reminder) + '</textarea>' +
    '<label>Job never closed <span class="muted">(day after pickup, only if you forgot to mark it done; use {admin_link})</span></label><textarea name="tpl_owner_complete_nudge">' + esc(t.owner_complete_nudge) + '</textarea>' +
    '<label>Commercial quote request <span class="muted">(adds {company} {interest} {timeframe} {email} {details})</span></label><textarea name="tpl_commercial">' + esc(t.commercial) + '</textarea>' +
    '<label>Low rating alert <span class="muted">(adds {rating} {feedback}; use {admin_link})</span></label><textarea name="tpl_low_rating">' + esc(t.low_rating) + '</textarea>' +
    '<h3>Invoices</h3>' +
    '<label>Invoice text <span class="muted">(adds {number} {total} {due}; use {invoice_link})</span></label><textarea name="tpl_invoice">' + esc(t.invoice) + '</textarea>' +
    '</div>');

  // Everything that breaks the site if guessed at, kept out of the way but reachable.
  // Its own tab now, so no collapsed <details> — clicking the tab would have shown
  // nothing but a grey strip. Kept visually cool and clearly labelled as hands-off.
  sec("advanced", "Advanced", '<div class="card" style="border-color:#e3b7b7;background:#fffaf9">' +
    '<h2>Technical settings</h2>' +
    '<p class="what"><b>Leave these alone.</b> Your web guy set them up. Changing them can stop bookings, texts or payments from working.</p>' +
    '<label>Text-message service webhook</label><input name="sms_url" value="' + esc(S.ghlSmsUrl) + '">' +
    '<label>Review webhook <span class="muted">(blank = use the one above)</span></label><input name="review_url" value="' + esc(S.ghlReviewUrl) + '">' +
    '<label>Website address used in links</label><input name="base_url" value="' + esc(S.publicBaseUrl) + '">' +
    '<label>Card payments mode</label><select name="stripe_mode"><option value="sandbox"' + (S.stripeMode !== "live" ? " selected" : "") + '>Test cards only</option><option value="live"' + (S.stripeMode === "live" ? " selected" : "") + '>Live &mdash; real payments</option></select>' +
    '</div>');

  sec("invoices", "Invoices", '<div class="card"><h2>Invoices</h2>' +
    '<p class="what">Defaults for every invoice you send. You can still change them on each one.</p>' +
    '<div class="row"><div><label>Due in<span class="hint">Days from when you send it.</span></label><input name="invoice_due_days" inputmode="numeric" value="' + esc(S.invoiceDueDays) + '"></div>' +
    '<div><label>Sales tax</label><label style="font-weight:400;margin-top:10px"><input type="checkbox" name="invoice_tax_default" style="width:auto"' + (S.invoiceTaxDefault !== false ? " checked" : "") + '> Add tax automatically</label></div></div>' +
    '<label>Wording at the bottom of every invoice<span class="hint">Your payment terms and late fee. This prints under the line items.</span></label>' +
    '<textarea name="invoice_terms" style="min-height:120px">' + esc(S.invoiceTerms) + '</textarea>' +
    '<p class="muted">If you change the late charge above, update this wording to match.</p></div>');

  // Read-only tab: the save bar is hidden here, since there is nothing to save.
  let activity = '<div class="card"><div class="top"><h2 style="border:0;margin:0">Recent bookings</h2><span><a href="/admin/invoices" style="color:#116DFF;font-weight:600;text-decoration:none">Invoices</a> &nbsp;&middot;&nbsp; <a href="/admin/bookings" style="color:#116DFF;font-weight:600;text-decoration:none">Manage all &rarr;</a></span></div><table><tr><th>Ref</th><th>Status</th><th>Size</th><th>Drop</th><th>Customer</th><th>Total</th></tr>';
  for (const b of (bookings || [])) activity += '<tr><td><a href="/admin/booking/' + esc(b.id) + '" style="color:#116DFF;font-weight:600;text-decoration:none">' + esc(b.id) + '</a></td><td>' + statusWord(b.status) + '</td><td>' + esc(b.bin_size) + 'yd</td><td>' + esc(b.delivery_date) + '</td><td>' + esc(b.customer_name) + '</td><td>$' + ((b.amount_cents || 0) / 100).toFixed(2) + '</td></tr>';
  if (!bookings || !bookings.length) activity += '<tr><td colspan="6" class="muted">No bookings yet.</td></tr>';
  activity += '</table></div>';

  activity += '<div class="card"><h2>Ratings &amp; feedback</h2><table><tr><th>When</th><th>Stars</th><th>Booking</th><th>Feedback</th></tr>';
  for (const r of (lowReviews || [])) activity += '<tr><td>' + esc((r.created_at || "").slice(0, 10)) + '</td><td>' + esc(r.rating) + '</td><td>' + esc(r.booking_id) + '</td><td>' + esc(r.feedback) + '</td></tr>';
  if (!lowReviews || !lowReviews.length) activity += '<tr><td colspan="4" class="muted">None.</td></tr>';
  activity += '</table></div>';
  sec("activity", "Bookings", activity, true);

  // Tab order is what he reaches for most, first. "Advanced" is deliberately last.
  const ORDER = ["guide", "prices", "fees", "bins", "invoices", "alerts", "reviews", "texts", "activity", "advanced"];
  panels.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  // Tab bar, then every panel. The panels all live inside ONE form, so Save writes
  // every setting at once — a per-tab form would blank out the tabs not submitted.
  body += '<div class="tabs" role="tablist">';
  for (const p of panels) {
    body += '<button type="button" role="tab" id="t-' + p.id + '" aria-controls="p-' + p.id + '" aria-selected="false" data-p="' + p.id + '">' + esc(p.label) + '</button>';
  }
  body += '</div>';

  body += '<form method="POST" action="/admin/save">';
  for (const p of panels) {
    body += '<section class="panel" id="p-' + p.id + '" role="tabpanel" aria-labelledby="t-' + p.id + '"' + (p.readonly ? ' data-readonly="1"' : "") + '>' + p.html + '</section>';
  }
  body += '<div class="savebar" id="savebar"><button>Save changes</button></div></form>';

  // Progressive enhancement: panels are visible by default, so with no JS this is
  // simply the old long page. JS only ever HIDES, never reveals, so a script failure
  // can never leave the owner staring at an empty screen.
  body += '<script>(function(){' +
    'var tabs=[].slice.call(document.querySelectorAll(".tabs button"));' +
    'var bar=document.getElementById("savebar");if(!tabs.length)return;' +
    'function show(id){' +
      'tabs.forEach(function(t){var on=t.dataset.p===id;t.setAttribute("aria-selected",on?"true":"false");' +
        'var p=document.getElementById("p-"+t.dataset.p);if(p)p.hidden=!on;' +
        'if(on&&bar)bar.style.display=p&&p.dataset.readonly?"none":"";});' +
      'try{localStorage.setItem("trdTab",id);}catch(e){}}' +
    'tabs.forEach(function(t){t.addEventListener("click",function(){show(t.dataset.p);});});' +
    'var start=tabs[0].dataset.p;try{var s=localStorage.getItem("trdTab");' +
      'if(s&&document.getElementById("p-"+s))start=s;}catch(e){}' +
    'show(start);})();</script>';

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
  // Fees are entered in whole dollars and stored in cents. A blank box must NOT
  // silently become $0 (that would quietly zero out a real charge on the Terms
  // page), so each falls back to the value already in settings.
  const cents = (v, current) => { const x = parseFloat(v); return Number.isNaN(x) ? current : Math.round(x * 100); };
  const numOr = (v, current) => { const x = parseFloat(v); return Number.isNaN(x) ? current : x; };
  const curS = await loadSettings(env);
  const cur = curS.fees || {};
  // 0 is a legitimate value here (check off), so only blank/garbage falls back.
  const sr = parseFloat(form.service_radius);
  await saveSetting(env, "service_radius_miles", Number.isNaN(sr) ? curS.serviceRadiusMiles : sr);
  await saveSetting(env, "fees", {
    dryRun: cents(form.fee_dry_run, cur.dryRun),
    overweightTon: cents(form.fee_overweight_ton, cur.overweightTon),
    extensionDay: cents(form.fee_extension_day, cur.extensionDay),
    prohibitedItem: cents(form.fee_prohibited_item, cur.prohibitedItem),
    cancelAfterDispatch: cents(form.fee_cancel_dispatch, cur.cancelAfterDispatch),
    refundCutoffHours: numOr(form.fee_refund_hours, cur.refundCutoffHours),
    latePct: numOr(form.fee_late_pct, cur.latePct),
    lateGraceDays: numOr(form.fee_late_days, cur.lateGraceDays),
    tons15: numOr(form.tons_15, cur.tons15),
    tons20: numOr(form.tons_20, cur.tons20),
    tons25: numOr(form.tons_25, cur.tons25),
  });
  await saveSetting(env, "invoice_terms", String(form.invoice_terms || ""));
  await saveSetting(env, "invoice_due_days", parseInt(form.invoice_due_days, 10) || 14);
  await saveSetting(env, "invoice_tax_default", form.invoice_tax_default === "on" || form.invoice_tax_default === "true");
  await saveSetting(env, "sms_templates", { confirmation: String(form.tpl_confirmation || ""), reminder_sms: String(form.tpl_reminder_sms || ""), pickup_reminder: String(form.tpl_pickup_reminder || ""), review: String(form.tpl_review || ""), review_followup_1: String(form.tpl_review_followup_1 || ""), review_followup_2: String(form.tpl_review_followup_2 || ""), review_followup_3: String(form.tpl_review_followup_3 || ""), owner: String(form.tpl_owner || ""), owner_reminder: String(form.tpl_owner_reminder || ""), owner_pickup_reminder: String(form.tpl_owner_pickup_reminder || ""), owner_complete_nudge: String(form.tpl_owner_complete_nudge || ""), commercial: String(form.tpl_commercial || ""), low_rating: String(form.tpl_low_rating || ""), invoice: String(form.tpl_invoice || "") });
  // Follow-up ladder timing. Stored as a 3-slot array; a 0 ends the ladder there.
  await saveSetting(env, "review_followup_hours", [form.fu_1, form.fu_2, form.fu_3].map((v) => {
    const n = Number(String(v == null ? "" : v).trim());
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }));
}

// ----- Bookings management (own routes; auth-gated in index.js) -----

export function renderBookingsList(S, rows, q) {
  let body = '<div class="top"><h1>Bookings</h1><a href="/admin" style="color:#64748b;text-decoration:none">&larr; Settings</a></div>';
  body += '<form method="GET" action="/admin/bookings" class="card"><label>Search by ref, name, or phone</label><div class="row"><div><input name="q" value="' + esc(q || "") + '" placeholder="TRD-… / name / phone" autofocus></div><div style="flex:0 0 auto"><button>Search</button></div></div></form>';
  body += '<div class="card"><table><tr><th>Ref</th><th>Status</th><th>Service</th><th>Delivery</th><th>Customer</th><th>Total</th></tr>';
  for (const b of (rows || [])) {
    const svc = esc(b.service_type || "dumpster") + (b.bin_size ? " " + esc(b.bin_size) + "yd" : "");
    body += '<tr><td><a href="/admin/booking/' + esc(b.id) + '" style="color:#116DFF;font-weight:600">' + esc(b.id) + '</a></td><td>' + statusWord(b.status) + '</td><td>' + svc + '</td><td>' + esc(b.delivery_date) + '</td><td>' + esc(b.customer_name) + '</td><td>$' + ((b.amount_cents || 0) / 100).toFixed(2) + '</td></tr>';
  }
  if (!rows || !rows.length) body += '<tr><td colspan="6" class="muted">No bookings' + (q ? ' match "' + esc(q) + '"' : ' yet') + '.</td></tr>';
  body += '</table></div>';
  return page(body);
}

export function renderBookingDetail(S, b, flash) {
  if (!b) return page('<div class="top"><h1>Booking</h1><a href="/admin/bookings" style="color:#64748b;text-decoration:none">&larr; Bookings</a></div><div class="card"><p class="muted">Not found.</p></div>');
  const addr = b.address || "";
  const gmap = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
  const amap = "https://maps.apple.com/?q=" + encodeURIComponent(addr);
  const money = (c) => "$" + ((c || 0) / 100).toFixed(2);
  const r = (k, v) => '<div style="display:flex;border-bottom:1px solid #eef2f7;padding:5px 0"><div style="flex:0 0 42%;color:#5a6b7d">' + esc(k) + '</div><div style="flex:1"><b>' + esc(v == null || v === "" ? "—" : v) + '</b></div></div>';
  // The review question ("did it send?") gets answered right on the page instead
  // of leaving the owner guessing at whether the automation worked.
  const reviewState = b.review_rating != null
    ? "★ " + b.review_rating + " star" + (Number(b.review_rating) === 1 ? "" : "s")
    : b.review_sms_sent_at
      ? "asked " + String(b.review_sms_sent_at).slice(0, 10) + (b.review_stop_reason === "clicked" ? " · they opened the link" : "")
      : "not asked yet";
  let body = '<div class="top"><h1>' + esc(b.id) + '</h1><a href="/admin/bookings" style="color:#64748b;text-decoration:none">&larr; Bookings</a></div>';
  body += flashHtml(flash, "");
  body += '<div class="card">';
  body += r("Status", b.status) + r("Account", b.account_type) + r("Service", b.service_type) + r("Bin size", b.bin_size ? b.bin_size + "yd" : "") + r("Rental", b.rental_tier ? b.rental_tier + " day" : (b.rental_days ? b.rental_days + " days" : "")) + r("Customer", b.customer_name) + r("Phone", b.phone) + r("Email", b.email) + r("Company", b.company);
  body += r("Delivery", b.delivery_date + (b.delivery_time ? " " + b.delivery_time : "")) + r("Pickup", b.pickup_date) + r("Address", b.address) + r("Ground", b.ground_condition) + r("Customer note", b.message);
  body += r("Subtotal", money(b.subtotal_cents)) + r("Tax", money(b.tax_cents)) + r("Total", money(b.amount_cents)) + (b.deposit_cents ? r("Deposit", money(b.deposit_cents)) : "") + r("Payment", b.payment_type) + r("Paid at", b.paid_at) + r("Review", reviewState) + r("Stripe session", b.stripe_session_id);
  body += '<div style="margin-top:12px"><a href="' + gmap + '" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">Open in Google Maps</a> &nbsp;·&nbsp; <a href="' + amap + '" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">Apple Maps</a></div>';
  body += '</div>';
  body += '<div class="card"><h2>Notes</h2><form method="POST" action="/admin/booking/' + esc(b.id) + '/notes"><textarea name="notes" placeholder="Internal notes — pickup details, gate code, etc.">' + esc(b.notes || "") + '</textarea><div style="margin-top:8px"><button>Save notes</button></div></form></div>';
  // Extension flow: customer calls to keep the bin/trailer longer -> set the new date
  // here. This keeps capacity honest (the slot stays occupied through the new date)
  // and re-arms both pickup reminder texts for the new date. Only services with a
  // later pickup get this; junk + bin switch are same-day.
  if ((b.service_type === "dumpster" || b.service_type === "trailer") && ["confirmed", "paid"].includes(b.status)) {
    const extDollars = (((S.fees && S.fees.extensionDay) || 0) / 100);
    body += '<div class="card"><h2>Pickup date</h2>' +
      '<p class="what">Customer needs more time? Set the new pickup date — the pickup reminder texts re-arm for it automatically. Bill the extra days ($' + esc(extDollars) + '/day) from their saved card in the Stripe dashboard.</p>' +
      '<form method="POST" action="/admin/booking/' + esc(b.id) + '/pickupdate"><div class="row"><div><input type="date" name="pickup_date" value="' + esc(b.pickup_date) + '" min="' + esc(b.delivery_date) + '" required></div>' +
      '<div style="flex:0 0 auto"><button>Update pickup date</button></div></div></form></div>';
  }
  body += '<div class="card"><h2>Actions</h2>';
  body += '<p class="what">When the job is finished, press the green button. It closes the job and texts the customer their review ask (once per customer, ever).</p>';
  body += '<form method="POST" action="/admin/booking/' + esc(b.id) + '/status" style="display:inline-block;margin:0 6px 6px 0"><input type="hidden" name="status" value="completed"><button class="done" style="font-size:17px;padding:14px 22px">&#10003; Mark picked up / completed</button></form>';
  body += '<form method="POST" action="/admin/booking/' + esc(b.id) + '/delete" style="display:inline-block" onsubmit="return confirm(\'Delete booking ' + esc(b.id) + '? This cannot be undone.\')"><button style="background:#c0392b">Delete (dev)</button></form>';
  body += '<div style="margin-top:10px"><a href="/admin/invoice/new?booking=' + encodeURIComponent(b.id) + '" style="color:#116DFF;font-weight:600;text-decoration:none">Create an invoice for this booking &rarr;</a></div>';
  body += '<p class="muted" style="margin-top:8px">Refunds are handled in the Stripe dashboard.</p>';
  body += '</div>';
  return page(body);
}

// ----- Invoices (auth-gated in index.js) -------------------------------------

const invMoney = (c) => "$" + ((c || 0) / 100).toFixed(2);
const STATUS_COLOR = { paid: "#16a34a", sent: "#b45309", void: "#64748b", draft: "#64748b" };
const statusPill = (s) =>
  '<b style="color:' + (STATUS_COLOR[s] || "#0b1b2b") + '">' + esc(s || "—") + '</b>';

export function renderInvoiceList(S, rows, q) {
  let body = '<div class="top"><h1>Invoices</h1><a href="/admin" style="color:#64748b;text-decoration:none">&larr; Settings</a></div>';
  body += '<div style="margin-bottom:12px"><a href="/admin/invoice/new" style="display:inline-block;background:#116DFF;color:#fff;padding:11px 16px;border-radius:9px;font-weight:700;text-decoration:none">+ New invoice</a></div>';
  body += '<form method="GET" action="/admin/invoices" class="card"><label>Search by invoice no., customer, or booking ref</label><div class="row"><div><input name="q" value="' + esc(q || "") + '" placeholder="TRD-INV-… / name / TRD-…"></div><div style="flex:0 0 auto"><button>Search</button></div></div></form>';
  body += '<div class="card"><table><tr><th>Invoice</th><th>Status</th><th>Customer</th><th>Due</th><th>Total</th></tr>';
  for (const r of (rows || [])) {
    body += '<tr><td><a href="/admin/invoice/' + esc(r.id) + '" style="color:#116DFF;font-weight:600">' + esc(r.number || r.id) + '</a></td>' +
      '<td>' + statusPill(r.status) + '</td><td>' + esc(r.customer_name) + '</td><td>' + esc(r.due_date || "—") + '</td><td>' + invMoney(r.total_cents) + '</td></tr>';
  }
  if (!rows || !rows.length) body += '<tr><td colspan="5" class="muted">No invoices' + (q ? ' match "' + esc(q) + '"' : ' yet') + '.</td></tr>';
  body += '</table></div>';
  return page(body);
}

// `prefill` may carry a booking to bill (customer details + a starting line item).
export function renderInvoiceNew(S, prefill, error) {
  const p = prefill || {};
  const due = new Date(Date.now() + (Number(S.invoiceDueDays) || 14) * 864e5).toISOString().slice(0, 10);
  // Blank spare rows are fine — parseLineItems() in invoice.js drops any row with no
  // description or no price, so Joseph can use as few or as many as he needs.
  const rowHtml = (i, d, q, amt) =>
    '<div class="row" style="margin-bottom:6px"><div style="flex:3"><input name="li_desc" value="' + esc(d || "") + '" placeholder="Description"></div>' +
    '<div style="flex:0 0 72px"><input name="li_qty" value="' + esc(q || "") + '" placeholder="Qty"></div>' +
    '<div style="flex:0 0 110px"><input name="li_price" value="' + esc(amt || "") + '" placeholder="$ each"></div></div>';

  let body = '<div class="top"><h1>New invoice</h1><a href="/admin/invoices" style="color:#64748b;text-decoration:none">&larr; Invoices</a></div>';
  if (error) body += '<div class="card" style="border-color:#f0a3a3;background:#fdf2f2"><b style="color:#c0392b">' + esc(error) + '</b></div>';
  body += '<form method="POST" action="/admin/invoice/create"><div class="card">';
  if (p.booking_id) body += '<input type="hidden" name="booking_id" value="' + esc(p.booking_id) + '"><p class="muted">Attached to booking <b>' + esc(p.booking_id) + '</b></p>';
  body += '<h2>Customer</h2>' +
    '<label>Name</label><input name="customer_name" value="' + esc(p.customer_name || "") + '" required>' +
    '<div class="row"><div><label>Email <span class="muted">(required — Stripe emails the invoice)</span></label><input name="email" type="email" value="' + esc(p.email || "") + '" required></div>' +
    '<div><label>Phone <span class="muted">(for the pay-link text)</span></label><input name="phone" value="' + esc(p.phone || "") + '"></div></div>' +
    '<label>Company <span class="muted">(optional)</span></label><input name="company" value="' + esc(p.company || "") + '">';

  body += '<h2>Line items</h2>';
  const seed = p.items || [];
  for (let i = 0; i < Math.max(seed.length + 3, 5); i++) {
    const it = seed[i];
    body += rowHtml(i, it && it.description, it && it.qty, it ? (it.unit_cents / 100).toFixed(2) : "");
  }
  body += '<div id="more"></div><button type="button" id="addRow" style="background:#64748b;padding:8px 12px;font-size:13px">+ Add another line</button>';

  body += '<h2>Terms</h2>' +
    '<div class="row"><div><label>Due date</label><input type="date" name="due_date" value="' + esc(due) + '"></div>' +
    '<div><label>Sales tax</label><label style="font-weight:400;margin-top:9px"><input type="checkbox" name="taxable" style="width:auto"' + (S.invoiceTaxDefault !== false ? " checked" : "") + '> Add ' + esc(((S.taxRate || 0) * 100).toFixed(3).replace(/\.?0+$/, "")) + '% sales tax</label></div></div>' +
    '<label>Terms printed at the bottom <span class="muted">(from settings; edit for this one invoice if needed)</span></label>' +
    '<textarea name="terms" style="min-height:110px">' + esc(S.invoiceTerms || "") + '</textarea>' +
    '<label>Internal note <span class="muted">(not shown to the customer)</span></label><input name="notes" value="">';

  body += '<div style="margin-top:16px"><button>Create &amp; send invoice</button></div>' +
    '<p class="muted">Sends immediately: Stripe emails the invoice + PDF, and the customer gets a text with the pay link.</p>';
  body += '</div></form>';
  body += '<script>document.getElementById("addRow").addEventListener("click",function(){' +
    'var d=document.createElement("div");d.className="row";d.style.marginBottom="6px";' +
    'd.innerHTML=\'<div style="flex:3"><input name="li_desc" placeholder="Description"></div><div style="flex:0 0 72px"><input name="li_qty" placeholder="Qty"></div><div style="flex:0 0 110px"><input name="li_price" placeholder="$ each"></div>\';' +
    'document.getElementById("more").appendChild(d);});</script>';
  return page(body);
}

export function renderInvoiceDetail(S, inv, flash) {
  if (!inv) return page('<div class="top"><h1>Invoice</h1><a href="/admin/invoices" style="color:#64748b;text-decoration:none">&larr; Invoices</a></div><div class="card"><p class="muted">Not found.</p></div>');
  let items = [];
  try { items = JSON.parse(inv.line_items || "[]"); } catch { items = []; }
  const r = (k, v) => '<div style="display:flex;border-bottom:1px solid #eef2f7;padding:5px 0"><div style="flex:0 0 42%;color:#5a6b7d">' + esc(k) + '</div><div style="flex:1"><b>' + esc(v == null || v === "" ? "—" : v) + '</b></div></div>';

  let body = '<div class="top"><h1>' + esc(inv.number || inv.id) + '</h1><a href="/admin/invoices" style="color:#64748b;text-decoration:none">&larr; Invoices</a></div>';
  if (flash) body += '<div class="ok">' + esc(flash) + '</div>';
  body += '<div class="card">';
  body += '<div style="display:flex;border-bottom:1px solid #eef2f7;padding:5px 0"><div style="flex:0 0 42%;color:#5a6b7d">Status</div><div style="flex:1">' + statusPill(inv.status) + '</div></div>';
  body += r("Customer", inv.customer_name) + r("Email", inv.email) + r("Phone", inv.phone) + r("Company", inv.company) +
    (inv.booking_id ? '<div style="display:flex;border-bottom:1px solid #eef2f7;padding:5px 0"><div style="flex:0 0 42%;color:#5a6b7d">Booking</div><div style="flex:1"><a href="/admin/booking/' + esc(inv.booking_id) + '" style="color:#116DFF;font-weight:600">' + esc(inv.booking_id) + '</a></div></div>' : "") +
    r("Due", inv.due_date) + r("Sent", (inv.sent_at || "").slice(0, 10)) + r("Paid at", inv.paid_at);
  body += '</div>';

  body += '<div class="card"><h2>Line items</h2><table><tr><th>Description</th><th>Qty</th><th>Each</th><th>Amount</th></tr>';
  for (const it of items) body += '<tr><td>' + esc(it.description) + '</td><td>' + esc(it.qty) + '</td><td>' + invMoney(it.unit_cents) + '</td><td>' + invMoney(it.unit_cents * it.qty) + '</td></tr>';
  body += '</table><div style="margin-top:10px">' + r("Subtotal", invMoney(inv.subtotal_cents)) + (inv.tax_cents ? r("Tax", invMoney(inv.tax_cents)) : "") + r("Total", invMoney(inv.total_cents)) + '</div></div>';

  body += '<div class="card"><h2>Actions</h2>';
  if (inv.hosted_url) body += '<p><a href="' + esc(inv.hosted_url) + '" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">Open the customer\'s pay page &rarr;</a>' +
    (inv.pdf_url ? ' &nbsp;·&nbsp; <a href="' + esc(inv.pdf_url) + '" target="_blank" rel="noopener" style="color:#116DFF;font-weight:600;text-decoration:none">PDF</a>' : "") + '</p>';
  if (inv.status !== "void" && inv.status !== "paid") {
    body += '<form method="POST" action="/admin/invoice/' + esc(inv.id) + '/resend" style="display:inline-block;margin:0 6px 6px 0"><button>Re-text the pay link</button></form>';
    body += '<form method="POST" action="/admin/invoice/' + esc(inv.id) + '/void" style="display:inline-block" onsubmit="return confirm(\'Void this invoice? The customer will no longer be able to pay it.\')"><button style="background:#c0392b">Void</button></form>';
  } else if (inv.status === "paid") {
    body += '<p class="muted">Paid. Refunds are handled in the Stripe dashboard.</p>';
  } else {
    body += '<p class="muted">This invoice was voided.</p>';
  }
  body += '</div>';

  if (inv.terms) body += '<div class="card"><h2>Terms as sent</h2><p class="muted" style="white-space:pre-wrap">' + esc(inv.terms) + '</p></div>';
  return page(body);
}
