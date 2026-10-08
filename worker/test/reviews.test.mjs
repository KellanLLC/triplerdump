// Google reviews on the homepage + landing-page social proof, map embeds, Book Now.
// Mocked ASSETS + D1 + fetch; no network. Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
import {
  DEFAULT_GOOGLE_REVIEWS, mergeGoogleReviews, applyPlacesResponse, refreshGoogleReviews, reviewsJson, PLACE_ID,
} from "../src/reviews.js";
import { rewriteReviews } from "../src/marketing.js";
import { loadSettings } from "../src/settings.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORIGIN = "https://www.triplerdump.com";
const HOME = readFileSync(ROOT + "index.html", "utf8");
const CONTACT = readFileSync(ROOT + "contact/index.html", "utf8");

function env(rows = [], extra = {}) {
  const writes = [];
  return {
    writes,
    SITE_ORIGIN: ORIGIN,
    ...extra,
    DB: {
      prepare: (sql) => ({
        _args: [],
        bind(...a) { this._args = a; return this; },
        all: async () => ({ results: rows }),
        first: async () => null,
        run: async function () { writes.push({ sql, args: this._args }); return {}; },
      }),
    },
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        const file = p === "/" ? HOME : p === "/contact/" ? CONTACT : null;
        if (!file) return new Response(null, { status: 404 });
        return new Response(file, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      },
    },
  };
}
const get = (path, e, accept = "text/html") => worker.fetch(new Request(ORIGIN + path, { headers: { accept } }), e);

const LIVE = {
  rating: 4.9, count: 23, updatedAt: "2026-10-07T00:00:00Z", source: "places",
  reviews: [{ name: "Pat </script><b>x", rating: 5, date: "2026-10-01", text: "Great <b>bin</b>" }],
};

test("defaults: 5.0 from 18, seven cards, settings carry them", async () => {
  assert.equal(DEFAULT_GOOGLE_REVIEWS.rating, 5);
  assert.equal(DEFAULT_GOOGLE_REVIEWS.count, 18);
  assert.equal(DEFAULT_GOOGLE_REVIEWS.reviews.length, 7);
  const S = await loadSettings(env());
  assert.equal(S.googleReviews.count, 18);
  const S2 = await loadSettings(env([{ key: "google_reviews", value: JSON.stringify(LIVE) }]));
  assert.equal(S2.googleReviews.count, 23);
  assert.equal(S2.googleReviews.reviews[0].name, LIVE.reviews[0].name);
  // Garbage in D1 falls back field by field.
  assert.deepEqual(mergeGoogleReviews({ rating: "x", reviews: [] }).count, 18);
});

test("homepage HTML: live rating/count everywhere + review JSON, script-safe", async () => {
  const html = await (await get("/", env([{ key: "google_reviews", value: JSON.stringify(LIVE) }]))).text();
  assert.equal((html.match(/data-trd-num="g_rating">4\.9</g) || []).length, 3, "hero, reviews, CTA");
  assert.equal((html.match(/data-trd-num="g_count">23</g) || []).length, 3);
  assert.doesNotMatch(html, /data-trd-num="g_count">18</);
  const json = html.match(/<script type="application\/json" id="trd-reviews">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(json, /<\/script>/i, "no breakout");
  const data = JSON.parse(json);
  assert.equal(data.count, 23);
  assert.equal(data.reviews[0].name, "Pat </script><b>x");
  assert.equal(data.url, "https://www.google.com/maps?cid=8339345795908710583");
});

test("homepage HTML with no saved reviews: defaults (5.0 / 18) filled in", async () => {
  const html = await (await get("/", env())).text();
  assert.equal((html.match(/data-trd-num="g_count">18</g) || []).length, 3);
  const data = JSON.parse(html.match(/id="trd-reviews">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.reviews.length, 7);
  assert.equal(data.reviews[0].name, "Connie Collard");
});

test("contact page: rating line rewritten too", async () => {
  const html = await (await get("/contact/", env([{ key: "google_reviews", value: JSON.stringify(LIVE) }]))).text();
  assert.match(html, /data-trd-num="g_rating">4\.9<\/strong> from <span data-trd-num="g_count">23<\/span> Google reviews/);
});

test("rewriteReviews leaves unknown markers and price markers alone", () => {
  const body = '<b data-trd-num="nope">7</b><p data-trd="d15_13">$350</p><b data-trd-num="g_count">18</b>';
  assert.equal(rewriteReviews(body, mergeGoogleReviews({ count: 30 })),
    '<b data-trd-num="nope">7</b><p data-trd="d15_13">$350</p><b data-trd-num="g_count">30</b>');
  assert.equal(rewriteReviews(body, null), body);
});

test("applyPlacesResponse: new reviews first, same reviewer replaced, capped at 12", () => {
  const cur = mergeGoogleReviews(null);
  const next = applyPlacesResponse(cur, {
    rating: 4.94, userRatingCount: 20,
    reviews: [
      { rating: 5, publishTime: "2026-09-01T10:00:00Z", originalText: { text: "Older new one" }, authorAttribution: { displayName: "Ann" } },
      { rating: 5, publishTime: "2026-10-05T10:00:00Z", text: { text: "x ".repeat(200) }, authorAttribution: { displayName: "Bo", uri: "https://maps.google.com/u/1" } },
      { rating: 5, publishTime: "2026-07-01T00:00:00Z", text: { text: "Updated by Connie" }, authorAttribution: { displayName: "connie collard" } },
      { rating: 4, authorAttribution: { displayName: "Empty" } },
    ],
  }, "2026-10-07T12:00:00.000Z");
  assert.equal(next.rating, 4.9);
  assert.equal(next.count, 20);
  assert.equal(next.source, "places");
  assert.equal(next.updatedAt, "2026-10-07T12:00:00.000Z");
  assert.deepEqual(next.reviews.slice(0, 3).map((r) => r.name), ["Bo", "Ann", "connie collard"]);
  assert.ok(next.reviews[0].text.length <= 260 && next.reviews[0].text.endsWith("…"));
  assert.equal(next.reviews.filter((r) => /connie/i.test(r.name)).length, 1, "no duplicate Connie");
  assert.ok(!next.reviews.some((r) => r.name === "Empty"), "text-less reviews skipped");
  assert.equal(next.reviews.length, 3 + 6);
  const many = applyPlacesResponse(next, { reviews: Array.from({ length: 5 }, (_, i) => ({ rating: 5, text: { text: "t" + i }, authorAttribution: { displayName: "N" + i } })) }, "x");
  assert.equal(many.reviews.length, 12);
  assert.equal(many.count, 20, "missing count keeps the old one");
});

test("refreshGoogleReviews: no key = no-op; fresh = skip; stale = fetch + store", async () => {
  assert.deepEqual(await refreshGoogleReviews(env(), { googleReviews: mergeGoogleReviews(null) }), { skipped: "no key" });

  const e = env([], { GOOGLE_PLACES_API_KEY: "k" });
  const fresh = mergeGoogleReviews({ ...LIVE, updatedAt: "2026-10-07T00:00:00Z" });
  assert.deepEqual(await refreshGoogleReviews(e, { googleReviews: fresh }, new Date("2026-10-07T10:00:00Z")), { skipped: "fresh" });

  const realFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, headers: init.headers };
    return new Response(JSON.stringify({ rating: 5, userRatingCount: 19, reviews: [] }), { status: 200 });
  };
  try {
    const r = await refreshGoogleReviews(e, { googleReviews: fresh }, new Date("2026-10-08T10:00:00Z"));
    assert.deepEqual(r, { updated: true, rating: 5, count: 19 });
    assert.equal(seen.url, "https://places.googleapis.com/v1/places/" + PLACE_ID);
    assert.equal(seen.headers["X-Goog-Api-Key"], "k");
    assert.equal(seen.headers["X-Goog-FieldMask"], "rating,userRatingCount,reviews");
    assert.equal(e.writes.length, 1);
    assert.match(e.writes[0].sql, /INSERT INTO settings .*'google_reviews'/);
    assert.equal(JSON.parse(e.writes[0].args[0]).count, 19);

    globalThis.fetch = async () => new Response("denied", { status: 403 });
    await assert.rejects(refreshGoogleReviews(e, { googleReviews: fresh }, new Date("2026-10-09T10:00:00Z")), /places 403/);
    assert.equal(e.writes.length, 1, "error writes nothing");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("reviewsJson escapes < so the block can't close early", () => {
  assert.doesNotMatch(reviewsJson(mergeGoogleReviews(LIVE)), /</);
});

test("landing page: Book Now in nav, drawer and hero; proof row; map; JSON block", () => {
  assert.match(HOME, /<ul class="nav-inline">[\s\S]*?<a href="\/book" class="btn btn-fill">Book Now<\/a>[\s\S]*?<\/ul>/);
  assert.match(HOME, /<div class="nav-drawer"[\s\S]*?<a href="\/book" class="btn btn-fill">Book Now<\/a>/);
  assert.match(HOME, /<div class="hero-actions">\s*<a href="\/book" class="btn btn-fill">Book Now<\/a>/);
  assert.match(HOME, /<ul class="hero-proof"[\s\S]*?Google[\s\S]*?BBB[\s\S]*?15 years/);
  assert.match(HOME, /<div class="area-media area-map reveal">\s*<iframe src="https:\/\/www\.google\.com\/maps\/embed\?pb=[^"]+0x73bb4ed1504930b7[^"]*" title="Map: Triple R Dump[^"]*" loading="lazy"/);
  assert.match(HOME, /<script type="application\/json" id="trd-reviews">\{\}<\/script>/);
  assert.match(HOME, /href="https:\/\/www\.google\.com\/maps\?cid=8339345795908710583"[^>]*>Read all reviews on Google/);
});

test("contact page: map embed + directions, built from build_pages.py", () => {
  assert.match(CONTACT, /<div class="map-embed">\s*<iframe src="https:\/\/www\.google\.com\/maps\/embed\?pb=[^"]+0x73bb4ed1504930b7[^"]*" title="Map: Triple R Dump, 3539 S 4250 W, West Haven, UT 84401" loading="lazy"/);
  assert.match(CONTACT, /class="map-cap">3539 S 4250 W, West Haven, UT 84401 · <a href="https:\/\/maps\.google\.com/);
  assert.match(readFileSync(ROOT + "build_pages.py", "utf8"), /MAPS_EMBED = "https:\/\/www\.google\.com\/maps\/embed\?pb=/);
});

test("llms.txt states the live Google rating", async () => {
  const t = await (await get("/llms.txt", env([{ key: "google_reviews", value: JSON.stringify(LIVE) }]), "*/*")).text();
  assert.match(t, /Rated 4\.9 out of 5 on Google from 23 reviews \(https:\/\/www\.google\.com\/maps\?cid=8339345795908710583\)\./);
});
