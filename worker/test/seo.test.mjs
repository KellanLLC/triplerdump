// Local-SEO overhaul (2026-10-09): one-price tokens, tons/overage tokens, city
// pages back from retirement, legacy Wix redirects, the HTML 404, the size hub
// and guides through the worker, sitemap images, structured data.
// Mocked ASSETS (serving the repo's generated HTML) + D1. No network.
// Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
import { rewritePriceTokens, isMarketingPath, marketingRedirect, legacyRedirect, redirectLocation, RETIRED_CITIES, wantsHtml } from "../src/marketing.js";
import { GUIDE_PAGES, CITY_PAGES } from "../src/agents.js";
import { renderTermsPage } from "../src/terms.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORIGIN = "https://www.triplerdump.com";
const read = (rel) => readFileSync(ROOT + rel, "utf8");

// D1 as it is live today (2026-10-08): one price in both tiers, 2/3/4 tons, $70/ton.
const LIVE_ROWS = [
  { key: "bins", value: JSON.stringify({
    "15": { label: "15 yard", inventory: 1, prices: { "1-3": 32000, "4-7": 32000 } },
    "20": { label: "20 yard", inventory: 3, prices: { "1-3": 37500, "4-7": 37500 } },
    "25": { label: "25 yard", inventory: 5, prices: { "1-3": 42500, "4-7": 42500 } },
  }) },
  { key: "fees", value: JSON.stringify({ overweightTon: 7000, tons15: 2, tons20: 3, tons25: 4 }) },
];

// Serves any generated page from the repo: /x/y/ -> x/y/index.html, / -> index.html.
function makeEnv() {
  return {
    SITE_ORIGIN: ORIGIN,
    DB: { prepare: () => ({ all: async () => ({ results: LIVE_ROWS }), bind() { return this; }, first: async () => null, run: async () => ({}) }) },
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        const rel = p === "/" ? "index.html" : p.endsWith("/") ? p.slice(1) + "index.html" : null;
        if (!rel || !existsSync(ROOT + rel)) return new Response(null, { status: 404 });
        return new Response(read(rel), { status: 200, headers: { "content-type": "text/html" } });
      },
    },
  };
}
const get = (path, accept = "text/html", method = "GET") =>
  worker.fetch(new Request(ORIGIN + path, { method, headers: { accept } }), makeEnv());

const KEPT = (read("build_pages.py").match(/KEPT_CITIES = \[([\s\S]*?)\]/) || [])[1].match(/"([a-z-]+)"/g).map((x) => x.slice(1, -1));
const ALL_CITIES = [...read("build_pages.py").matchAll(/\{"slug": "([a-z-]+)", "name": "[^"]+", "county"/g)].map((m) => m[1]);

function generatedPages() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(ROOT + dir)) {
      const rel = dir + name;
      if (statSync(ROOT + rel).isDirectory()) walk(rel + "/");
      else if (name === "index.html") out.push(rel);
    }
  };
  for (const d of ["dumpster-rental", "junk-removal", "dump-trailer-rental", "bin-switch", "service-area", "faq", "bbb", "contact", "guides"]) {
    if (existsSync(ROOT + d)) walk(d + "/");
  }
  return out;
}

test("tokens: tons + overage are substituted (plain numbers / dollars), prices stay one per bin", () => {
  const tokens = { d15_47: 32000, over_ton: 7000, tons15: "2" };
  const body = '<p>${{TRD:d15_47}} for up to 7 days, {{TRD:tons15}} tons, then ${{TRD:over_ton}}/ton</p>' +
    '<b data-trd="d15_47">$350</b><span data-trd-num="tons15">5</span><span data-trd="over_ton">$100</span>' +
    '<b data-trd-num="g_count">18</b><i data-trd="tons15">$9</i>';
  assert.equal(rewritePriceTokens(body, tokens),
    '<p>$320 for up to 7 days, 2 tons, then $70/ton</p>' +
    '<b data-trd="d15_47">$320</b><span data-trd-num="tons15">2</span><span data-trd="over_ton">$70</span>' +
    '<b data-trd-num="g_count">18</b><i data-trd="tons15">$9</i>');
});

test("homepage through the worker: one 7-day price, tons + $/ton from D1, no tokens left", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  const html = await res.text();
  assert.doesNotMatch(html, /\{\{TRD:/);
  assert.match(html, /data-trd="d15_47">\$320 <small>up to 7 days<\/small>/);
  assert.match(html, /data-trd-num="tons25">4</);
  assert.match(html, /data-trd="over_ton">\$70</);
  assert.match(html, /<title>Dumpster Rental West Haven, Ogden & Roy, UT \| Triple R Dump<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*from \$320 for up to 7 days/);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld.logo, ORIGIN + "/assets/apple-touch-icon.png");
  assert.deepEqual([ld.geo.latitude, ld.geo.longitude], [41.200007, -112.083158]);
  assert.equal(ld.openingHoursSpecification[0].opens, "00:00");
  assert.equal(ld.openingHoursSpecification[0].dayOfWeek.length, 7);
  assert.equal(ld.areaServed.filter((a) => a["@type"] === "City").length, 16);
  assert.ok(ld.areaServed.some((a) => a.name === "Utah County, Utah"));
  assert.ok(!ld.aggregateRating, "no self-serving review stars");
  assert.match(html, /<a class="jobc rv-in" href="\/service-area\/brigham-city\/">/, "recent jobs strip links city pages");
  assert.match(html, /<a class="bin__more" href="\/dumpster-rental\/20-yard\/">20 yard dumpster rental details<\/a>/);
  assert.equal((html.match(/05_bin_rental_2\.jpeg/g) || []).length, 0, "the duplicate photo is gone");
  assert.doesNotMatch(html, /href="(tel|sms):8015643164"/, "tel/sms carry +1");
});

test("generated pages: no tokens left, no two-tier wording, JSON-LD parses, titles <= 60", async () => {
  const pages = generatedPages();
  assert.ok(pages.length >= 30, "pages found: " + pages.length);
  for (const rel of pages) {
    const path = "/" + rel.replace(/index\.html$/, "");
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.doesNotMatch(html, /\{\{TRD:/, path + " token residue");
    assert.doesNotMatch(html, /1–3 days|4–7 days|four counties|Four counties/, path + " old wording");
    assert.doesNotMatch(html, /href="(tel|sms):8015643164"/, path);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    const title = html.match(/<title>([^<]*)<\/title>/)[1].replace(/&amp;/g, "&");
    assert.ok(title.length <= 60, path + " title " + title.length + ": " + title);
    const desc = html.match(/<meta name="description" content="([^"]*)"/)[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'");
    assert.ok(desc.length >= 110 && desc.length <= 160, path + " description " + desc.length);
  }
});

test("size hub /dumpster-rental/ goes through the worker; size pages use one Offer + the hub breadcrumb", async () => {
  assert.equal(isMarketingPath("/dumpster-rental/"), true);
  assert.equal(marketingRedirect("/dumpster-rental"), "/dumpster-rental/");
  const hub = await (await get("/dumpster-rental/")).text();
  assert.match(hub, /<table class="cmp">/);
  assert.match(hub, /<td><b>\$375<\/b><\/td><td>3 tons<\/td>/);
  assert.doesNotMatch(hub, /"@type": "FAQPage"/, "no FAQ schema (SEO bible: FAQ rich results are gone)");
  const y20 = await (await get("/dumpster-rental/20-yard/")).text();
  const svc = JSON.parse([...y20.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((j) => j.includes('"Service"')));
  assert.equal(svc.offers["@type"], "Offer");
  assert.equal(svc.offers.price, "375");
  const crumbs = JSON.parse([...y20.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((j) => j.includes("BreadcrumbList")));
  assert.deepEqual(crumbs.itemListElement.map((i) => i.item), [ORIGIN + "/", ORIGIN + "/dumpster-rental/", ORIGIN + "/dumpster-rental/20-yard/"]);
  assert.match(y20, /<li><a href="\/dumpster-rental\/">Dumpster sizes<\/a><\/li>/, "visible crumb matches");
  assert.doesNotMatch(y20, /<title>[^<]*West Haven/, "size pages no longer target West Haven");
});

test("city pages: the 14 kept cities, retired list matches build_pages.py, photos + ImageObject", async () => {
  assert.equal(KEPT.length, 15); // Springville retired 2026-11-07
  for (const slug of ["north-ogden", "clinton", "bountiful"]) {
    assert.equal(RETIRED_CITIES.has(slug), false, slug);
    assert.equal(marketingRedirect("/service-area/" + slug + "/"), null, slug + " is a page again");
  }
  const retired = ALL_CITIES.filter((s) => !KEPT.includes(s)).sort();
  assert.deepEqual([...RETIRED_CITIES].sort(), retired, "marketing.js RETIRED_CITIES == build_pages.py");
  assert.equal(marketingRedirect("/service-area/riverdale/"), "/service-area/");
  // Ogden moved into the /dumpster-rental/ folder (URL = the search phrase); the old URL 301s there.
  assert.equal(marketingRedirect("/service-area/ogden/"), "/dumpster-rental/ogden/");
  assert.equal(marketingRedirect("/service-area/ogden"), "/dumpster-rental/ogden/");
  assert.equal(marketingRedirect("/dumpster-rental/ogden/"), null);
  for (const rel of generatedPages()) assert.doesNotMatch(read(rel), /\/service-area\/ogden\//, rel + " links the old Ogden URL");
  assert.doesNotMatch(read("index.html") + read("sitemap.xml"), /\/service-area\/ogden\//);
  const ogCrumbs = read("dumpster-rental/ogden/index.html");
  assert.match(ogCrumbs, /"item": "https:\/\/www\.triplerdump\.com\/dumpster-rental\/"/, "Ogden breadcrumb goes through /dumpster-rental/");
  assert.deepEqual(CITY_PAGES.map((c) => c[1]).sort(), [...KEPT].sort(), "llms.txt city list == kept cities");

  const bc = await (await get("/service-area/brigham-city/")).text();
  assert.match(bc, /<h2>Recent job in <em>Brigham City<\/em>\.<\/h2>/);
  assert.match(bc, /<figcaption>A Triple R Dump roll-off delivered in Brigham City, September 2026\.<\/figcaption>/);
  assert.match(bc, /<img class="ph__pic" src="\/uploads\/jobs\/dumpster-rental-brigham-city-ut\.jpg" srcset="[^"]+" sizes="100vw" width="1280" height="960" alt="[^"]+" fetchpriority="high">/);
  assert.match(bc, /<meta property="og:image" content="https:\/\/www\.triplerdump\.com\/assets\/og\/service-area-brigham-city\.jpg">/);
  const imgs = [...bc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).filter((o) => o["@type"] === "ImageObject");
  assert.equal(imgs.length, 2);
  assert.deepEqual(imgs[0].contentLocation, { "@type": "Place", name: "Brigham City, UT" });
  assert.equal(imgs[0].creator["@id"], ORIGIN + "/#business");
  assert.equal(imgs[0].dateCreated, "2026-09-12");
  assert.match(bc, /<a href="\/service-area\/[a-z-]+\/">dumpster rental in [A-Z]/, "descriptive Also-serving anchors");
  assert.doesNotMatch(bc, /business license/i);

  // Springville retired 2026-11-07 (75 mi, past the SEO bible's 50-mile line): 301 to the hub.
  assert.equal(marketingRedirect("/service-area/springville/"), "/service-area/");

  const roy = await (await get("/service-area/roy/")).text();
  assert.match(roy, /href="https:\/\/www\.royutah\.gov\/departments\/public_works\/community_programs\.php" target="_blank" rel="noopener nofollow"/);
  const ogden = await (await get("/dumpster-rental/ogden/")).text();
  assert.match(ogden, /ogdencity\.gov\/1113\/Dial-A-Dumpster" target="_blank" rel="noopener nofollow"/);
  assert.match(ogden, /ogdencity\.gov\/274\/The-City-Right-of-Way/);
});

test("service-area hub: six counties, recent-jobs strip, new area wording", async () => {
  const hub = await (await get("/service-area/")).text();
  for (const c of ["Weber", "Davis", "Box Elder", "Cache", "Salt Lake", "Utah", "Morgan"]) assert.match(hub, new RegExp(`<h2 class="county__h">${c} County</h2>`));
  assert.ok((hub.match(/class="jobc rv-in"/g) || []).length >= 7);
  assert.match(hub, /<title>Dumpster Rental Service Area \| Logan to Springville<\/title>/);
});

test("legacy Wix paths 301 to their page; /book and /terms are never redirected", async () => {
  const cases = {
    "/book-online": "/book", "/services": "/dumpster-rental/", "/pricing": "/dumpster-rental/", "/about": "/", "/about-us": "/",
    "/gallery": "/service-area/", "/reviews": "/#reviews", "/contact-us": "/contact/", "/book/": "/book", "/terms/": "/terms",
    "/About-Us/": "/", "/book-online/": "/book",
  };
  for (const [from, to] of Object.entries(cases)) {
    assert.equal(legacyRedirect(from), to, from);
    const r = await get(from);
    assert.equal(r.status, 301, from);
    assert.equal(r.headers.get("location"), ORIGIN + to, from);
  }
  for (const p of ["/book", "/terms", "/", "/contact/", "/faq/", "/booked"]) assert.equal(legacyRedirect(p), null, p);
  assert.equal(redirectLocation(ORIGIN, "/#reviews", "?a=1"), ORIGIN + "/?a=1#reviews", "query before the fragment");
  const q = await get("/book-online?size=20");
  assert.equal(q.headers.get("location"), ORIGIN + "/book?size=20");
  const book = await get("/book");
  assert.equal(book.status, 200, "/book still renders");
  assert.match(await book.text(), /<form/);
  const terms = await get("/terms");
  assert.equal(terms.status, 200);
});

test("HTML 404: browsers yes, agents Markdown, API JSON, HEAD empty", async () => {
  assert.equal(wantsHtml("text/html,*/*"), true);
  assert.equal(wantsHtml("*/*"), false);
  const r = await get("/no-such-page");
  assert.equal(r.status, 404);
  assert.match(await r.text(), /<title>Page Not Found \| Triple R Dump<\/title>/);
  const md = await get("/no-such-page", "text/markdown");
  assert.match(md.headers.get("content-type"), /^text\/markdown/);
  const api = await get("/api/no-such", "text/html");
  assert.match(api.headers.get("content-type"), /^application\/json/);
  const head = await get("/no-such-page", "text/html", "HEAD");
  assert.equal(head.status, 404);
  assert.equal(await head.text(), "");
  const nf = read("not-found/index.html");
  assert.match(nf, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(nf, /rel="canonical"/);
});

test("guides go through the worker with live prices; llms.txt lists the real guide slugs", async () => {
  assert.equal(isMarketingPath("/guides/"), true);
  assert.equal(isMarketingPath("/guides/what-size-dumpster-do-i-need/"), true);
  assert.match(read("worker/wrangler.toml"), /"\/guides", "\/guides\/\*"/);
  if (!existsSync(ROOT + "guides/index.html")) return; // guides_content.py absent: nothing built
  for (const [slug] of GUIDE_PAGES) assert.ok(existsSync(ROOT + "guides/" + slug + "/index.html"), slug);
  const g = await (await get("/guides/" + GUIDE_PAGES[0][0] + "/")).text();
  assert.doesNotMatch(g, /\{\{TRD:/);
  const art = [...g.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((o) => o["@type"] === "Article");
  assert.equal(art.author.name, "Joseph Rodrigues");
  assert.equal(art.publisher["@id"], ORIGIN + "/#business");
  assert.match(art.datePublished, /^\d{4}-\d{2}-\d{2}$/);
  const idx = await (await get("/guides/")).text();
  assert.equal((idx.match(/class="gcard rv-in"/g) || []).length, GUIDE_PAGES.length);
});

test("sitemap: image namespace + job photos, fresh lastmod, new pages in, noindex pages out", () => {
  const sm = read("sitemap.xml");
  assert.match(sm, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  for (const p of ["/dumpster-rental/", "/service-area/brigham-city/", "/service-area/cottonwood-heights/", "/service-area/north-ogden/"]) {
    assert.match(sm, new RegExp(`<loc>${ORIGIN}${p}</loc>`), p);
  }
  assert.doesNotMatch(sm, /not-found|\/social\//);
  assert.match(sm, /<image:loc>https:\/\/www\.triplerdump\.com\/uploads\/jobs\/roll-off-dumpster-brigham-city-utah\.jpg<\/image:loc>/);
  assert.doesNotMatch(sm, /<lastmod>2026-09-22<\/lastmod>/);
});

test("/terms carries a meta description and canonical", () => {
  const t = renderTermsPage({ fees: {} });
  assert.match(t, /<meta name="description" content="[^"]{100,160}">/);
  assert.match(t, /<link rel="canonical" href="https:\/\/www\.triplerdump\.com\/terms">/);
});

// ---- content review fixes (2026-10-09, second pass) --------------------------------

test("prohibited items match /terms everywhere: no 'handling fee', no small container, $/item from fees", async () => {
  assert.equal(rewritePriceTokens("${{TRD:prohibited}}", { prohibited: 20000 }), "$200");
  const sources = [read("index.html"), ...generatedPages().map(read), read("guides_content.py")];
  for (const t of sources) {
    assert.doesNotMatch(t, /handling fee/i);
    assert.doesNotMatch(t, /small container/i);
    assert.doesNotMatch(t, /[Tt]ires[^.<]{0,60}can go in/);
  }
  const faq = await (await get("/faq/")).text();
  assert.match(faq, /tires, appliances with refrigerant \(Freon\), and electronics such as TVs, monitors, computers and batteries\. Each prohibited item found in a load is \$200/);
  assert.match(faq, /Mattresses need separate handling and an extra fee, so call first/);
  const y25 = await (await get("/dumpster-rental/25-yard/")).text();
  assert.match(y25, /Can I put concrete, dirt or brick in it\?<\/h3><p>Call first\./);
  const g = await (await get("/guides/what-can-go-in-a-dumpster/")).text();
  assert.match(g, /<tr><th scope="row">Tires<\/th><td>No<\/td>/);
  assert.match(g, /<tr><th scope="row">Refrigerator, freezer, AC unit<\/th><td>No<\/td>/);
  assert.doesNotMatch(g, /\{\{TRD:/);
});

test("same-day is promised only for near cities (min <= 25)", async () => {
  for (const slug of ["bountiful", "cottonwood-heights", "logan"]) {
    const html = await (await get("/service-area/" + slug + "/")).text();
    const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.doesNotMatch(desc, /same-day/i, slug + " description");
    assert.doesNotMatch(html, /Same-day and next-day available|<span>Same-day delivery<\/span>|<dd>Same-day and next-day most days<\/dd>/, slug);
    assert.match(html, /Next-day or a scheduled date; book a few days ahead/, slug);
  }
  for (const slug of ["roy", "brigham-city", "clinton"]) {
    const html = await (await get("/service-area/" + slug + "/")).text();
    assert.match(html, /Same-day and next-day available/, slug);
  }
});

test("city FAQs are city-specific: no generic permit/dumpster-days/price questions, none repeated", () => {
  const all = [];
  for (const slug of KEPT) {
    const qs = [...read((slug === "ogden" ? "dumpster-rental/" : "service-area/") + slug + "/index.html").matchAll(/<div class="faq"><h3>([^<]+)<\/h3>/g)].map((m) => m[1]);
    assert.ok(qs.length >= 3, slug);
    for (const q of qs) {
      if (/^Do I need a permit for a dumpster in /.test(q)) assert.equal(slug, "ogden", q);
      if (/have free dumpster days\?$/.test(q)) assert.equal(slug, "roy", q);
      assert.doesNotMatch(q, /^How much does a dumpster rental cost in /, q);
    }
    all.push(...qs);
  }
  assert.equal(new Set(all).size, all.length, "no question repeated across city pages");
  assert.doesNotMatch(read("service-area/layton/index.html"), /can require a right-of-way permit/);
  assert.match(read("service-area/layton/index.html"), /href="\/guides\/dumpster-permit-ogden-weber-davis\/"/);
});

test("review fixes: photo times, Dial-A-Dumpster scope, no self-citation, full area on the size hub", () => {
  const bc = read("service-area/brigham-city/index.html");
  assert.match(bc, /Brigham City, Utah, in early morning light/);
  assert.doesNotMatch(bc + read("index.html"), /at sunset|morning sun/);
  assert.match(read("service-area/roy/index.html"), /set on the street in front of a home in Roy, Utah, with the roll-off truck behind it/);
  const og = read("dumpster-rental/ogden/index.html");
  assert.match(og, /not for personal home projects such as remodeling, moving in or out, or clearing out basements, garages or sheds/);
  assert.doesNotMatch(og, /for yard cleanup/);
  assert.doesNotMatch(read("guides_content.py"), /S_TERMS|TRD_TERMS/);
  for (const rel of generatedPages().filter((p) => p.startsWith("guides/") && p !== "guides/index.html")) {
    const srcs = (read(rel).match(/<ol class="sources">([\s\S]*?)<\/ol>/) || ["", ""])[1];
    assert.doesNotMatch(srcs, /triplerdump\.com\/terms|href="\/terms"/, rel);
  }
  assert.match(read("dumpster-rental/index.html"), /Utah County as far south as Springville/);
  assert.doesNotMatch(read("contact/index.html"), /same hours as on our Google Business Profile/);
});

test("Logan + Tremonton: real pages, no job-photo claims, generic hero, not same-day, linked and in the sitemap", async () => {
  for (const slug of ["logan", "tremonton"]) {
    assert.ok(KEPT.includes(slug), slug);
    assert.equal(RETIRED_CITIES.has(slug), false, slug);
    assert.equal(marketingRedirect("/service-area/" + slug + "/"), null);
    const res = await get("/service-area/" + slug + "/");
    assert.equal(res.status, 200, slug);
    const html = await res.text();
    assert.doesNotMatch(html, /\{\{TRD:/);
    assert.doesNotMatch(html, /Recent job in|class="jobs |"@type": "ImageObject"/, slug + ": no job photos, so no job section");
    assert.doesNotMatch(html, /uploads\/jobs\//, slug + ": no other city's job photo");
    const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.doesNotMatch(desc, /same-day/i);
    assert.match(html, /Next-day or a scheduled date; book a few days ahead/);
    const qs = [...html.matchAll(/<div class="faq"><h3>([^<]+)<\/h3>/g)];
    assert.ok(qs.length >= 3 && qs.length <= 4, slug + " FAQ count");
    assert.match(read("sitemap.xml"), new RegExp(`<loc>${ORIGIN}/service-area/${slug}/</loc>`));
    assert.match(read("service-area/brigham-city/index.html"), new RegExp(`href="/service-area/${slug}/">dumpster rental in `));
    assert.match(read("index.html"), new RegExp(`href="/service-area/${slug}/"`));
  }
  const logan = read("service-area/logan/index.html");
  assert.match(logan, /<h2 class="county__h">Cache County<\/h2>|Cache County · ~55 min/);
  assert.match(logan, /loganutah\.gov\/government\/departments\/environmental\/landfill\/index\.php" target="_blank" rel="noopener nofollow"/);
  assert.match(read("service-area/tremonton/index.html"), /boxeldercountyut\.gov\/232\/Landfill" target="_blank" rel="noopener nofollow"/);
  assert.match(read("service-area/index.html"), /<h2 class="county__h">Cache County<\/h2><ul class="city-grid"><li><a href="\/service-area\/logan\/"/);
});
