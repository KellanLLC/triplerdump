// Agent-readiness tests: Markdown negotiation, Markdown 404s, /llms.txt, homepage
// metadata. Runs the real worker fetch handler against a mocked ASSETS binding
// (serving the repo's own HTML) and a mocked D1. No network, no Stripe, no SMS.
// Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
import { prefersMarkdown, htmlToMarkdown, varyAccept } from "../src/agents.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORIGIN = "https://www.triplerdump.com";
const PAGES = {
  "/": "index.html",
  "/dumpster-rental/15-yard/": "dumpster-rental/15-yard/index.html",
  "/faq/": "faq/index.html",
};

// Live-price proof: D1 says the 15yd 1-3 day bin is $299, not the baked $275.
const SETTINGS_ROWS = [
  { key: "bins", value: JSON.stringify({
    "15": { label: "15 yard", inventory: 1, prices: { "1-3": 29900, "4-7": 31900 } },
    "20": { label: "20 yard", inventory: 3, prices: { "1-3": 32500, "4-7": 35000 } },
    "25": { label: "25 yard", inventory: 5, prices: { "1-3": 37500, "4-7": 40000 } },
  }) },
];

function makeEnv({ settingsFail = false } = {}) {
  return {
    SITE_ORIGIN: ORIGIN,
    DB: {
      prepare: () => ({
        all: async () => { if (settingsFail) throw new Error("d1 down"); return { results: SETTINGS_ROWS }; },
        bind() { return this; },
        first: async () => null,
        run: async () => ({}),
      }),
    },
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        if (!PAGES[p]) return new Response(null, { status: 404 });
        return new Response(readFileSync(ROOT + PAGES[p], "utf8"), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8", etag: '"abc"' },
        });
      },
    },
  };
}

const get = (path, accept, env = makeEnv(), method = "GET") =>
  worker.fetch(new Request(ORIGIN + path, { method, headers: accept ? { accept } : {} }), env);

test("prefersMarkdown: agents yes, browsers no", () => {
  assert.equal(prefersMarkdown("text/markdown"), true);
  assert.equal(prefersMarkdown("text/markdown, text/html;q=0.9"), true);
  assert.equal(prefersMarkdown("text/html, text/markdown"), true); // tie -> markdown (only agents list it)
  assert.equal(prefersMarkdown("text/x-markdown"), true);
  assert.equal(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"), false);
  assert.equal(prefersMarkdown("text/html, text/markdown;q=0.5"), false);
  assert.equal(prefersMarkdown("text/markdown;q=0"), false);
  assert.equal(prefersMarkdown("*/*"), false);
  assert.equal(prefersMarkdown(""), false);
  assert.equal(prefersMarkdown(null), false);
});

test("varyAccept appends without clobbering", () => {
  assert.equal(varyAccept(new Headers()).get("vary"), "Accept");
  assert.equal(varyAccept(new Headers({ vary: "Accept-Encoding" })).get("vary"), "Accept-Encoding, Accept");
  assert.equal(varyAccept(new Headers({ vary: "accept" })).get("vary"), "accept");
});

test("homepage: Accept text/markdown -> Markdown body, live prices, Vary: Accept", async () => {
  const res = await get("/", "text/markdown");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/markdown; charset=utf-8$/);
  assert.match(res.headers.get("vary"), /\bAccept\b/);
  assert.equal(res.headers.get("etag"), null);
  const md = await res.text();
  assert.ok(md.startsWith("---\ntitle: "), "front matter first");
  assert.match(md, /^url: https:\/\/www\.triplerdump\.com\/$/m);
  assert.match(md, /^# Family Dumpster Rental in West Haven, Ogden & Roy$/m);
  assert.match(md, /^## Straight prices\. Dump's included\.$/m);
  assert.match(md, /^\$299 1–3 days$/m, "D1 price substituted before conversion");
  assert.doesNotMatch(md, /\$275 1–3 days/);
  assert.match(md, /\[Book 15 yd\]\(https:\/\/www\.triplerdump\.com\/book\?size=15\)/, "links absolute");
  assert.match(md, /\[call to confirm\]\(tel:8015643164\)\./);
  assert.match(md, /https:\/\/www\.triplerdump\.com\/llms\.txt/);
  assert.doesNotMatch(md, /<[a-z\/!]/i, "no HTML left");
  assert.doesNotMatch(md, /\{\{TRD:|data-trd|&amp;|&nbsp;/);
  assert.doesNotMatch(md, /padding-block|grid-template|asphalt-tear/, "no CSS leaked");
  assert.equal(md.split("Same-Day Delivery Available").length - 1, 0, "ticker skipped");
  assert.doesNotMatch(md, /Made by Kellan|nav-toggle|Open menu/, "chrome skipped");
});

test("homepage: browsers still get the HTML page, now with Vary: Accept", async () => {
  const accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  const res = await get("/", accept);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/html/);
  assert.match(res.headers.get("vary"), /\bAccept\b/);
  assert.equal(res.headers.get("cache-control"), "public, max-age=300");
  const html = await res.text();
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /data-trd="d15_13">\$299</, "price rewrite unchanged");
  // Same body as the file apart from the worker's rewrites (prices, review JSON).
  const file = readFileSync(ROOT + "index.html", "utf8");
  const norm = (t) => t.replace(/(<script type="application\/json" id="trd-reviews">)[\s\S]*?<\/script>/, "$1</script>");
  assert.equal(norm(html).length - norm(file).length, 0);
  // No Accept header at all = HTML.
  const bare = await get("/", null);
  assert.match(bare.headers.get("content-type"), /^text\/html/);
});

test("HEAD with Accept text/markdown: headers only", async () => {
  const res = await get("/", "text/markdown", makeEnv(), "HEAD");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/markdown/);
  assert.equal(await res.text(), "");
});

test("generated pages convert too (FAQ headings, 15yd tokens resolved)", async () => {
  const faq = await (await get("/faq/", "text/markdown")).text();
  assert.match(faq, /^### What size dumpster do I need\?$/m);
  const y15 = await (await get("/dumpster-rental/15-yard/", "text/markdown")).text();
  assert.match(y15, /^title: "15 Yard Dumpster Rental in West Haven, UT \| \$299, Dump Fee Included"$/m);
  assert.match(y15, /^- Garage and shed cleanouts$/m, "lists become Markdown lists");
  assert.doesNotMatch(y15, /\{\{TRD:/);
});

test("D1 outage: HTML unchanged (code-default prices), Markdown still served", async () => {
  const env = makeEnv({ settingsFail: true });
  const html = await get("/", "text/html", env);
  assert.match(html.headers.get("content-type"), /^text\/html/);
  assert.match(html.headers.get("vary"), /\bAccept\b/);
  // loadSettings swallows the D1 error and serves code defaults (config.js).
  assert.match(await html.text(), /data-trd="d15_13">\$300</, "code-default price");
  const md = await get("/", "text/markdown", makeEnv({ settingsFail: true }));
  assert.match(md.headers.get("content-type"), /^text\/markdown/);
  assert.match(await md.text(), /^# Family Dumpster Rental/m);
});

test("404: Markdown body for agents, JSON as before for everyone else", async () => {
  const res = await get("/__ora-404-probe-komol4ar", "text/markdown");
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type"), /^text\/markdown; charset=utf-8$/);
  assert.match(res.headers.get("vary"), /\bAccept\b/);
  const body = await res.text();
  assert.ok(body.length >= 20);
  assert.match(body, /^# 404 - Page not found$/m);
  assert.match(body, /`\/__ora-404-probe-komol4ar`/);
  assert.match(body, /https:\/\/www\.triplerdump\.com\/llms\.txt/);
  assert.match(body, /https:\/\/www\.triplerdump\.com\/sitemap\.xml/);

  const plain = await get("/__ora-404-probe-komol4ar", "*/*");
  assert.equal(plain.status, 404);
  assert.match(plain.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await plain.json(), { ok: false, error: "Not found" });

  // Missing page under a marketing prefix (worker-first route, ASSETS 404s).
  const mk = await get("/service-area/nowhere-town/", "text/markdown");
  assert.equal(mk.status, 404);
  assert.match(mk.headers.get("content-type"), /^text\/markdown/);
  const mkHtml = await get("/service-area/nowhere-town/", "text/html");
  assert.equal(mkHtml.status, 404);
});

test("redirects unchanged for agents (slashless -> slash keeps working)", async () => {
  const res = await get("/faq", "text/markdown");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), ORIGIN + "/faq/");
});

test("/llms.txt: llmstxt.org shape, when-to-use guidance, live prices", async () => {
  const res = await get("/llms.txt", null);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/plain; charset=utf-8$/);
  const t = await res.text();
  const lines = t.split("\n");
  assert.equal(lines[0], "# Triple R Dump", "H1 first");
  assert.match(lines[2], /^> Family-owned roll-off dumpster rental in West Haven, Utah\./, "blockquote summary");
  assert.match(t, /^## When to use Triple R Dump$/m);
  assert.match(t, /^## How an agent should help a customer book$/m);
  assert.match(t, /^Not a fit: hazardous waste.*Addresses more than about 60 miles/m);
  assert.match(t, /^- 15 yard roll-off dumpster: \$299 for 1-3 days, \$319 for 4-7 days$/m, "D1 prices");
  assert.match(t, /^- Junk removal: \$550 flat \(weekends only\)$/m);
  assert.match(t, /^- Dump trailer rental: \$200 per day \(1-14 days\) plus a \$300 refundable deposit$/m);
  assert.match(t, /\/api\/availability\?size=20&date=YYYY-MM-DD&tier=1-3/);
  assert.match(t, /Do not submit bookings or payments on a customer's behalf/);
  // Every H2 link-list entry is "- [name](url)" (optionally ": notes").
  const linkLines = lines.filter((l) => l.startsWith("- ["));
  assert.ok(linkLines.length >= 10);
  for (const l of linkLines) assert.match(l, /^- \[[^\]]+\]\(https:\/\/www\.triplerdump\.com\/[^)]*\)(: .+)?$/);
  assert.match(t, /^## Optional$/m);
  assert.doesNotMatch(t, /undefined|null|NaN/);
  const head = await get("/llms.txt", null, makeEnv(), "HEAD");
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("homepage metadata: canonical, lang, og:image, og:type", () => {
  const html = readFileSync(ROOT + "index.html", "utf8");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.triplerdump\.com\/">/);
  assert.match(html, /<meta property="og:type" content="website">/);
  const img = html.match(/<meta property="og:image" content="([^"]+)">/);
  assert.ok(img, "og:image present");
  assert.match(img[1], /^https:\/\/www\.triplerdump\.com\//, "absolute URL");
  // The image must be one the deploy ships (referenced elsewhere in index.html).
  const rel = img[1].replace("https://www.triplerdump.com/", "");
  assert.ok(html.includes("url('" + rel + "')"), "og:image is the hero photo build_deploy.py copies");
});

test("htmlToMarkdown: tables, entities, nested skips", () => {
  const { markdown, title } = htmlToMarkdown(
    "<html><head><title>T &amp; U</title><style>body{}</style></head><body>" +
    "<div class=\"ticker\"><div><span>dup</span></div><span>dup</span></div>" +
    "<p>Fish &amp; chips&nbsp;&#8212; <a href=\"/x\">go</a></p>" +
    "<table><tr><th>Size</th><th>Price</th></tr><tr><td>15</td><td>$1</td></tr></table>" +
    "<div aria-hidden=\"true\"><p>hidden</p></div><footer><p>foot</p></footer></body></html>",
    "https://example.com/a/");
  assert.equal(title, "T & U");
  assert.equal(markdown, "Fish & chips — [go](https://example.com/x)\n\n| Size | Price |\n| --- | --- |\n| 15 | $1 |");
});
