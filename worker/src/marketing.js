// Marketing pages are static assets, but their PRICES are CMS truth, not build
// truth. build_pages.py bakes {{TRD:key}} tokens into the generated pages
// (visible text, titles, meta, JSON-LD alike) and index.html marks its price
// elements with data-trd="key"; wrangler's run_worker_first sends these routes
// through the worker, which substitutes the live settings values on every
// response. Changing a price in /admin therefore changes it EVERYWHERE at once.
// Fail-open: any error serves the asset unrewritten (stale price beats a 500).
import { loadSettings, fuelOn, fuelWords } from "./settings.js";
import { townFuel } from "./booking.js";
import { reviewNumbers, reviewsJson } from "./reviews.js";
import { prefersMarkdown, pageMarkdown, markdownNotFoundResponse, varyAccept, MARKDOWN_TYPE, CITY_MOVED } from "./agents.js";

const MARKETING_RE = /^\/(index\.html)?$|^\/(dumpster-rental|junk-removal|dump-trailer-rental|bin-switch|service-area|faq|bbb|contact|social|guides)(\/|$)/;

export function isMarketingPath(p) {
  return MARKETING_RE.test(p);
}

// City pages retired 2026-09-22: 19 near-identical city pages (85% the same
// text) sat in "Discovered - currently not indexed", so the thin ones were
// folded into the /service-area/ hub and the kept 8 got real content. Old URLs
// 301 to the hub so any link or stale index entry still lands somewhere useful.
// Keep in step with RETIRED_CITIES in build_pages.py. 2026-10-09: North Ogden,
// Clinton and Bountiful came back as real pages (with job photos), so they are
// no longer redirected.
export const RETIRED_CITIES = new Set([
  "riverdale", "south-ogden", "washington-terrace", "farr-west",
  "kaysville", "farmington", "morgan", "salt-lake-city",
]);

// Old Wix-era URLs (and the slash spellings of the two worker pages) that people
// or Google may still request. Matched case-insensitively, trailing slash or not.
// /book and /terms themselves are NEVER redirected: only "/book/" and "/terms/".
const LEGACY_REDIRECTS = {
  "/book-online": "/book",
  "/services": "/dumpster-rental/",
  "/pricing": "/dumpster-rental/",
  "/about": "/",
  "/about-us": "/",
  "/gallery": "/service-area/",
  "/reviews": "/#reviews",
  "/contact-us": "/contact/",
};

// Target path (may carry a #fragment) for a legacy URL, or null.
export function legacyRedirect(p) {
  if (p === "/book/") return "/book";
  if (p === "/terms/") return "/terms";
  const k = String(p).toLowerCase().replace(/\/+$/, "");
  return Object.prototype.hasOwnProperty.call(LEGACY_REDIRECTS, k) ? LEGACY_REDIRECTS[k] : null;
}

// Absolute Location for a redirect target, keeping the query string before any #fragment.
export function redirectLocation(origin, target, search) {
  const i = target.indexOf("#");
  return i < 0 ? origin + target + (search || "") : origin + target.slice(0, i) + (search || "") + target.slice(i);
}

// One URL per page: /contact and /contact/ both answered 200 (Google still shows
// the Wix-era snippet for the slashless one). Returns the target path or null.
export function marketingRedirect(p) {
  const m = p.match(/^\/service-area\/([a-z-]+)\/?$/);
  if (m && RETIRED_CITIES.has(m[1])) return "/service-area/";
  if (m && Object.prototype.hasOwnProperty.call(CITY_MOVED, m[1])) return CITY_MOVED[m[1]];
  if (p === "/index.html") return "/";
  if (p !== "/" && !p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p)) return p + "/";
  return null;
}

// cents -> "275" / "37.50" (the "$" stays in the surrounding copy). Plain
// (non-money) tokens such as tons15 are strings and are inserted as they are.
const fmt = (v) => (typeof v === "string" ? v : v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2));

function priceTokens(S, body) {
  const t = {};
  for (const yd of ["15", "20", "25"]) {
    const b = S.bins && S.bins[yd];
    if (b && b.prices) {
      if (Number.isFinite(b.prices["1-3"])) t[`d${yd}_13`] = b.prices["1-3"];
      if (Number.isFinite(b.prices["4-7"])) t[`d${yd}_47`] = b.prices["4-7"];
    }
  }
  const sv = S.services || {};
  if (sv.junk && sv.junk.pricing) t.junk = sv.junk.pricing.flat_cents;
  if (sv.trailer && sv.trailer.pricing) {
    t.trailer_day = sv.trailer.pricing.dayRate_cents;
    t.trailer_dep = sv.trailer.pricing.deposit_cents;
  }
  if (sv.binswitch && sv.binswitch.pricing) t.binswitch = sv.binswitch.pricing.flat_cents;
  if (S.fees && Number.isFinite(S.fees.extensionDay)) t.ext_day = S.fees.extensionDay;
  if (S.fees && Number.isFinite(S.fees.overweightTon)) t.over_ton = S.fees.overweightTon;
  // Per-item fine for a prohibited item found in a bin (/terms, fees.prohibitedItem).
  if (S.fees && Number.isFinite(S.fees.prohibitedItem)) t.prohibited = S.fees.prohibitedItem;
  for (const k of Object.keys(t)) if (!Number.isFinite(t[k])) delete t[k];
  // Weight included per bin (fees.tons15/20/25): plain numbers, not money.
  for (const yd of ["15", "20", "25"]) {
    const n = S.fees ? Number(S.fees["tons" + yd]) : NaN;
    if (Number.isFinite(n) && n >= 0) t["tons" + yd] = String(n);
  }
  // The fuel charge for a far drop-off (S.fuelMile), as sentences, so the pages say what a booking
  // charges: fuel_note = how it works; fuel_<town> ("fuel_logan", "fuel_plain_city") = that town's own
  // line, for the towns this page asks for.
  t.fuel_note = fuelNote(S);
  for (const [, k] of String(body || "").matchAll(/\{\{TRD:fuel_([a-z_]+)\}\}/g)) {
    if (k !== "note" && !t["fuel_" + k]) { const s = townFuelLine(S, k.replace(/_/g, " ")); if (s) t["fuel_" + k] = s; }
  }
  return t;
}

const freeMiles = (S) => Math.round(Number(S.fuelMile && S.fuelMile.free) || 0);

function fuelNote(S) {
  if (!fuelOn(S)) return "Delivery is included anywhere we deliver.";
  return "Delivery is included within " + freeMiles(S) + " miles of our West Haven yard (straight line); farther out we add " + fuelWords(S) + ", shown before you pay.";
}

function townFuelLine(S, name) {
  const tf = townFuel(S, name);
  if (!tf) return null;
  const town = name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  if (!fuelOn(S)) return "There is no fuel charge to " + town + ".";
  if (!tf.fuel) return town + " is inside the " + freeMiles(S) + " miles from our yard where delivery is included, so there is no fuel charge.";
  const how = tf.fuel.label.replace(/^Fuel charge \((.*)\)$/, "$1");
  return town + " is about " + tf.miles + " miles from our yard in a straight line, so a fuel charge of about $" + fmt(tf.fuel.cents) +
    " goes on (" + how + "); the booking page shows the exact amount for your address before you pay.";
}

// Exported for the offline test suite.
export function rewritePriceTokens(body, tokens) {
  let out = body.replace(/\{\{TRD:([a-z0-9_]+)\}\}/g, (m, k) => (k in tokens ? fmt(tokens[k]) : m));
  out = out.replace(/(data-trd="([a-z0-9_]+)"[^>]*>)\$[0-9][0-9.,]*/g, (m, pre, k) => (k in tokens && typeof tokens[k] === "number" ? pre + "$" + fmt(tokens[k]) : m));
  // Plain-number markers (index.html: data-trd-num="tons15">2<). The review
  // numbers (g_rating / g_count) use the same attribute and are not in `tokens`.
  out = out.replace(/(data-trd-num="([a-z0-9_]+)"[^>]*>)[0-9][0-9.,]*/g, (m, pre, k) => (typeof tokens[k] === "string" ? pre + tokens[k] : m));
  // Sentence markers (index.html: data-trd-text="fuel_note">baked sentence<); the baked text is the fallback.
  out = out.replace(/(data-trd-text="([a-z0-9_]+)"[^>]*>)[^<]*/g, (m, pre, k) => (typeof tokens[k] === "string" ? pre + tokens[k] : m));
  return out;
}

// Google rating + review count (data-trd-num="g_rating" / "g_count") and the review
// cards JSON the homepage carousel reads. The baked values in index.html are the
// fallback if this never runs.
export function rewriteReviews(body, g) {
  if (!g) return body;
  const nums = reviewNumbers(g);
  let out = body.replace(/(data-trd-num="([a-z0-9_]+)"[^>]*>)[0-9][0-9.,]*/g, (m, pre, k) => (k in nums ? pre + nums[k] : m));
  out = out.replace(/(<script type="application\/json" id="trd-reviews">)[\s\S]*?(<\/script>)/, (m, a, b) => a + reviewsJson(g) + b);
  return out;
}

// Anonymous activity counter (assets/t.js -> /api/t) on every marketing page,
// so the generated pages need no template change. Skipped if already present.
export function addTracking(body) {
  if (body.includes("/t.js")) return body;
  const i = body.lastIndexOf("</body>");
  return i < 0 ? body : body.slice(0, i) + '<script src="/assets/t.js" defer></script>' + body.slice(i);
}

// ---- HTML 404 for people ----------------------------------------------------------
// Browsers asking for a page that does not exist get the site's own 404 page
// (build_pages.py writes it to /not-found/: nav, links to booking, sizes,
// service area, guides, phone) with status 404. Agents keep the Markdown 404
// (agents.js) and API/other clients keep the JSON one (index.js).
export function wantsHtml(accept) {
  return /text\/html|application\/xhtml\+xml/i.test(String(accept || ""));
}

const NOT_FOUND_FALLBACK = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="robots" content="noindex"><title>Page Not Found | Triple R Dump</title></head>' +
  '<body style="font:17px/1.6 system-ui,sans-serif;max-width:36em;margin:12vh auto;padding:0 5vw;color:#0f1726">' +
  '<h1>That page is not here.</h1><p>The link may be old or mistyped.</p><ul>' +
  '<li><a href="/">Home</a></li><li><a href="/book">Book a dumpster</a></li><li><a href="/dumpster-rental/">Dumpster sizes &amp; prices</a></li>' +
  '<li><a href="/service-area/">Service area</a></li><li><a href="/guides/">Guides</a></li>' +
  '<li>Call or text <a href="tel:+18015643164">801-564-3164</a></li></ul></body></html>';

export async function notFoundHtmlResponse(env, request) {
  let body = NOT_FOUND_FALLBACK;
  try {
    const origin = new URL(request.url).origin;
    const res = env.ASSETS ? await env.ASSETS.fetch(new Request(origin + "/not-found/", { method: "GET" })) : null;
    if (res && res.status === 200 && (res.headers.get("content-type") || "").includes("text/html")) body = await res.text();
  } catch (e) {
    console.error("[404] not-found page fetch failed, using fallback", e && e.message ? e.message : e);
  }
  const h = varyAccept(new Headers({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" }));
  return new Response(request.method === "HEAD" ? null : body, { status: 404, headers: h });
}

export async function serveMarketingPage(env, request) {
  // Strip validators so ASSETS can't answer 304 (a 304 would let a browser keep
  // HTML whose prices changed while the underlying asset did not).
  const headers = new Headers(request.headers);
  headers.delete("if-none-match");
  headers.delete("if-modified-since");
  const res = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers }));
  // Agents asking for Markdown (Accept: text/markdown) get the same page as
  // Markdown; browsers get the HTML exactly as before. Either way the response
  // varies on Accept so no cache hands one the other's body. See agents.js.
  const md = prefersMarkdown(request.headers.get("accept"));
  if (res.status === 404 && md) return markdownNotFoundResponse(request);
  if (res.status === 404 && wantsHtml(request.headers.get("accept"))) return notFoundHtmlResponse(env, request);
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 200 || !ct.includes("text/html")) return res;
  let S = null;
  try {
    S = await loadSettings(env);
  } catch (e) {
    console.error("[marketing] settings load failed, serving unrewritten", e && e.message ? e.message : e);
  }
  if (!S && !md) {
    const out = new Response(res.body, res);
    varyAccept(out.headers);
    return out;
  }
  let body = await res.text();
  if (S) body = rewriteReviews(rewritePriceTokens(body, priceTokens(S, body)), S.googleReviews);
  const h = new Headers(res.headers);
  h.delete("etag");
  h.delete("last-modified");
  h.delete("content-length");
  h.set("cache-control", "public, max-age=300"); // a CMS price change is fully live within 5 min
  varyAccept(h);
  if (md) {
    body = pageMarkdown(body, request.url, S);
    h.set("content-type", MARKDOWN_TYPE);
  } else {
    body = addTracking(body);
    h.set("content-type", "text/html; charset=utf-8");
  }
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers: h });
}
