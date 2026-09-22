// Marketing pages are static assets, but their PRICES are CMS truth, not build
// truth. build_pages.py bakes {{TRD:key}} tokens into the generated pages
// (visible text, titles, meta, JSON-LD alike) and index.html marks its price
// elements with data-trd="key"; wrangler's run_worker_first sends these routes
// through the worker, which substitutes the live settings values on every
// response. Changing a price in /admin therefore changes it EVERYWHERE at once.
// Fail-open: any error serves the asset unrewritten (stale price beats a 500).
import { loadSettings } from "./settings.js";

const MARKETING_RE = /^\/(index\.html)?$|^\/(dumpster-rental|junk-removal|dump-trailer-rental|bin-switch|service-area|faq|bbb|contact)(\/|$)/;

export function isMarketingPath(p) {
  return MARKETING_RE.test(p);
}

// City pages retired 2026-09-22: 19 near-identical city pages (85% the same
// text) sat in "Discovered - currently not indexed", so the thin ones were
// folded into the /service-area/ hub and the kept 8 got real content. Old URLs
// 301 to the hub so any link or stale index entry still lands somewhere useful.
// Keep in step with RETIRED_CITIES in build_pages.py.
const RETIRED_CITIES = new Set([
  "riverdale", "south-ogden", "washington-terrace", "north-ogden", "farr-west",
  "clinton", "kaysville", "farmington", "morgan", "bountiful", "salt-lake-city",
]);

// One URL per page: /contact and /contact/ both answered 200 (Google still shows
// the Wix-era snippet for the slashless one). Returns the target path or null.
export function marketingRedirect(p) {
  const m = p.match(/^\/service-area\/([a-z-]+)\/?$/);
  if (m && RETIRED_CITIES.has(m[1])) return "/service-area/";
  if (p === "/index.html") return "/";
  if (p !== "/" && !p.endsWith("/") && !/\.[a-z0-9]+$/i.test(p)) return p + "/";
  return null;
}

// cents -> "275" / "37.50" (the "$" stays in the surrounding copy)
const fmt = (cents) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

function priceTokens(S) {
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
  for (const k of Object.keys(t)) if (!Number.isFinite(t[k])) delete t[k];
  return t;
}

// Exported for the offline test suite.
export function rewritePriceTokens(body, tokens) {
  let out = body.replace(/\{\{TRD:([a-z0-9_]+)\}\}/g, (m, k) => (k in tokens ? fmt(tokens[k]) : m));
  out = out.replace(/(data-trd="([a-z0-9_]+)"[^>]*>)\$[0-9][0-9.,]*/g, (m, pre, k) => (k in tokens ? pre + "$" + fmt(tokens[k]) : m));
  return out;
}

export async function serveMarketingPage(env, request) {
  // Strip validators so ASSETS can't answer 304 (a 304 would let a browser keep
  // HTML whose prices changed while the underlying asset did not).
  const headers = new Headers(request.headers);
  headers.delete("if-none-match");
  headers.delete("if-modified-since");
  const res = await env.ASSETS.fetch(new Request(request.url, { method: request.method, headers }));
  const ct = res.headers.get("content-type") || "";
  if (res.status !== 200 || !ct.includes("text/html")) return res;
  let S;
  try {
    S = await loadSettings(env);
  } catch (e) {
    console.error("[marketing] settings load failed, serving unrewritten", e && e.message ? e.message : e);
    return res;
  }
  const body = rewritePriceTokens(await res.text(), priceTokens(S));
  const h = new Headers(res.headers);
  h.delete("etag");
  h.delete("last-modified");
  h.delete("content-length");
  h.set("cache-control", "public, max-age=300"); // a CMS price change is fully live within 5 min
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers: h });
}
