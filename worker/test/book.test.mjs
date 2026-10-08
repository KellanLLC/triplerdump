// /book redesign (2026-10-08), website activity tracking, admin card, /social route.
// Mocked D1; no network, no Stripe, no SMS. Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { renderBookingPage } from "../src/page.js";
import { renderPanel } from "../src/admin.js";
import { loadSettings } from "../src/settings.js";
import { addTracking, isMarketingPath } from "../src/marketing.js";

const ORIGIN = "https://www.triplerdump.com";
const S = await loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: [] }) }) } });
const inlineScript = (h) => h.slice(h.indexOf("<script>var PRICING") + 8, h.lastIndexOf("</script>"));

// Every field the server reads from /api/book (booking.js validate()/validateLead()).
const BACKEND_FIELDS = [
  "account_type", "service_type", "bin_size", "rental_tier", "rental_days", "existing_ref", "delivery_date",
  "delivery_time", "address", "pickup_address", "ground_condition", "permit_needed", "permit_obtainable",
  "first_name", "last_name", "phone", "email", "message", "promo_code", "agreed_terms", "trd_hp",
  "company_c", "contact_name", "phone_c", "email_c", "service_interest", "address_c", "timeframe", "details", "agreed_terms_c",
];

test("/book renders for every service; its script parses", () => {
  for (const svc of ["dumpster", "trailer", "junk", "binswitch"]) {
    const h = renderBookingPage(S, svc);
    assert.doesNotThrow(() => new Function(inlineScript(h)), svc);
    assert.match(h, new RegExp(`name="service_type" value="${svc}"`));
    assert.match(h, new RegExp(`name="svc_choice" value="${svc}" checked`));
  }
});

test("/book keeps every backend field name, drops only residential company", () => {
  const h = renderBookingPage(S, "dumpster");
  for (const n of BACKEND_FIELDS) assert.match(h, new RegExp(`name="${n}"`), n);
  assert.doesNotMatch(h, /name="company"/, "residential company field removed (optional server-side)");
  assert.match(h, /delete data\.svc_choice/, "UI-only radios are never posted");
  assert.match(h, /fetch\("\/api\/book"/);
  assert.match(h, /window\.location=j\.checkout_url/, "still redirects to Stripe Checkout");
});

test("/book: live prices on the choices, time-of-day options, tracking, local icons", () => {
  const h = renderBookingPage(S, "dumpster");
  for (const [size, b] of Object.entries(S.bins)) {
    const px = b.prices["1-3"] % 100 === 0 ? "$" + b.prices["1-3"] / 100 : "$" + (b.prices["1-3"] / 100).toFixed(2);
    assert.match(h, new RegExp(`data-px="${size}">\\${px}<`), size);
  }
  assert.match(h, /value:"Early morning \(7-10 AM\)"/);
  assert.match(h, /value:"Midday \(10 AM-2 PM\)"/);
  assert.match(h, /value:"Later in the day \(2-6 PM\)"/);
  assert.match(h, /<script src="\/assets\/t\.js" defer><\/script>/);
  assert.match(h, /<symbol id="i-lock" viewBox="0 0 256 256"/, "Phosphor sprite inlined");
  assert.doesNotMatch(h, /refund 48|full refund/i, "no refund promise on /book");
  // still the custom dropdowns + calendar (owner dislikes native pickers)
  assert.doesNotMatch(h, /<select|type="date"/);
  assert.match(h, /id="calPop"/);
  // the missing-fields check mirrors the server's required fields
  for (const label of ["Bin size", "Delivery date", "Drop-off address", "Where the bin will sit", "Mobile phone (10 digits)", "Email address", "Agree to the terms", "A few details about the job"]) {
    assert.ok(h.includes(label), label);
  }
});

test("/book canceled banner + bfcache re-arm still present", () => {
  const h = renderBookingPage(S, "dumpster");
  assert.match(h, /ps\.get\("canceled"\)/);
  assert.match(h, /addEventListener\("pageshow"/);
});

function trackEnv() {
  const writes = [];
  return {
    writes,
    SITE_ORIGIN: ORIGIN,
    DB: { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; }, run: async function () { writes.push({ sql, args: this._a }); return {}; }, all: async () => ({ results: [] }), first: async () => null }) },
    ASSETS: { fetch: async () => new Response(null, { status: 404 }) },
  };
}
const post = (env, body, ua = "Mozilla/5.0 (iPhone)") =>
  worker.fetch(new Request(ORIGIN + "/api/t", { method: "POST", headers: { "content-type": "application/json", "user-agent": ua }, body }), env);

test("/api/t records allowed events only, never errors", async () => {
  const env = trackEnv();
  let r = await post(env, JSON.stringify({ t: "book_click", p: "/dumpster-rental/20-yard/" }));
  assert.equal(r.status, 204);
  assert.equal(env.writes.length, 1);
  assert.match(env.writes[0].sql, /INSERT INTO site_events/);
  assert.equal(env.writes[0].args[1], "book_click");
  assert.equal(env.writes[0].args[2], "/dumpster-rental/20-yard/");
  r = await post(env, JSON.stringify({ t: "drop table", p: "/" }));
  assert.equal(r.status, 204);
  r = await post(env, JSON.stringify({ t: "view", p: "/" }), "Googlebot/2.1");
  assert.equal(r.status, 204);
  r = await post(env, "not json");
  assert.equal(r.status, 204);
  assert.equal(env.writes.length, 1, "bad type, bot and junk body all ignored");
  await post(env, JSON.stringify({ t: "view", p: "/<script>alert(1)</script>" }));
  assert.equal(env.writes[1].args[2], "/scriptalert1/script", "path stripped to safe characters");
});

test("admin: Website activity card renders with numbers, hides without", () => {
  const act = { 7: { views: 12, book: 3, call: 2, text: 1, started: 2, paid: 1, quotes: 0 }, 30: { views: 40, book: 9, call: 5, text: 2, started: 6, paid: 4, quotes: 1 }, since: "2026-10-08T00:00:00Z" };
  const with_ = renderPanel(S, { recent: [], lowReviews: [], today: "2026-10-08", active: [], activity: act });
  assert.match(with_, /<h2>Website activity<\/h2>/);
  assert.match(with_, /Tapped Book<\/td><td>3<\/td><td>9<\/td>/);
  assert.match(with_, /Paid bookings<\/td><td>1<\/td><td>4<\/td>/);
  const without = renderPanel(S, { recent: [], lowReviews: [], today: "2026-10-08", active: [] });
  assert.doesNotMatch(without, /Tapped Book<\/td>/, "card hidden when there is no data");
});

test("tracking script injected once into marketing pages; /social is a marketing path", () => {
  const page = "<html><body><p>x</p></body></html>";
  const once = addTracking(page);
  assert.equal((once.match(/assets\/t\.js/g) || []).length, 1);
  assert.equal(addTracking(once), once);
  assert.equal(isMarketingPath("/social/"), true);
  assert.equal(isMarketingPath("/social"), true);
  assert.equal(isMarketingPath("/book"), false);
});

test("admin login unchanged: right password 302 + cookie, wrong 401, then /admin renders", async () => {
  const env = { ...trackEnv(), ADMIN_PASSWORD: "test-only-pw", ADMIN_SECRET: "test-only-secret" };
  const login = (pw) => worker.fetch(new Request(ORIGIN + "/admin/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=" + encodeURIComponent(pw) }), env);
  const bad = await login("wrong");
  assert.equal(bad.status, 401);
  const ok = await login("test-only-pw");
  assert.equal(ok.status, 302);
  const cookie = ok.headers.get("set-cookie");
  assert.ok(cookie && /HttpOnly/i.test(cookie));
  const page = await worker.fetch(new Request(ORIGIN + "/admin", { headers: { cookie: cookie.split(";")[0] } }), env);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Log out/, "logged-in panel, not the login form");
});

test("social.triplerdump.com serves the links page; www/social/ points there", async () => {
  const e = { ...trackEnv(), ASSETS: { fetch: async (req) => new URL(req.url).pathname === "/social/"
    ? new Response("<html><body>LINKS</body></html>", { headers: { "content-type": "text/html; charset=utf-8" } })
    : new Response(null, { status: 404 }) } };
  const go = (u, init) => worker.fetch(new Request(u, init), e);
  const root = await go("https://social.triplerdump.com/");
  assert.equal(root.status, 200);
  assert.match(await root.text(), /LINKS[\s\S]*assets\/t\.js/);
  let r = await go("https://social.triplerdump.com/book?size=20");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), ORIGIN + "/book?size=20");
  for (const p of ["/social/", "/social"]) {
    r = await go(ORIGIN + p);
    assert.equal(r.status, 301, p);
    assert.equal(r.headers.get("location"), "https://social.triplerdump.com/");
  }
  r = await go("https://x-triplerdump.bkthueson.workers.dev/social/");
  assert.equal(r.status, 200, "previews still render it for the deploy smoke test");
  await go("https://social.triplerdump.com/api/t", { method: "POST", headers: { "user-agent": "Mozilla/5.0" }, body: JSON.stringify({ t: "view", p: "/" }) });
  assert.equal(e.writes.at(-1).args[2], "/social/", "views on the subdomain are logged as /social/");
});
