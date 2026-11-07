// The website's wording about the fuel charge (10/31): the pages promised "no fuel surcharge" and
// "the drive is on us" while bookings past 30 miles carry one. Now every page says it from the live
// settings (marketing.js fuel_note / fuel_<town>), so a change in the console changes the copy too.
// Mocked ASSETS (the repo's generated HTML) + D1. No network.
// Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORIGIN = "https://www.triplerdump.com";
const read = (rel) => readFileSync(ROOT + rel, "utf8");

function makeEnv(rows) {
  return {
    SITE_ORIGIN: ORIGIN,
    DB: { prepare: () => ({ all: async () => ({ results: rows }), bind() { return this; }, first: async () => null, run: async () => ({}) }) },
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
const page = async (path, rows = []) => (await worker.fetch(new Request(ORIGIN + path, { headers: { accept: "text/html" } }), makeEnv(rows))).text();
const X = "×";
const NOTE = "Delivery is included within 30 miles of our West Haven yard (straight line); farther out we add a $40 fuel charge plus $1 for every mile past 30, shown before you pay.";

test("far towns state their own fuel charge, from the same town table a booking uses", async () => {
  const ch = await page("/service-area/cottonwood-heights/");
  assert.match(ch, /Cottonwood Heights is about 43 miles from our yard in a straight line, so a fuel charge of about \$53 goes on \(\$40 \+ 13 miles × \$1\)/);
  const logan = await page("/service-area/logan/");
  assert.match(logan, /Logan is about 39 miles from our yard in a straight line, so a fuel charge of about \$49 goes on/);
  assert.doesNotMatch(logan, /canyon\?", "No\./);
  assert.match(await page("/service-area/tremonton/"), /Tremonton is about 36 miles/);
  assert.match(await page("/service-area/cottonwood-heights/"), /Cottonwood Heights is about 43 miles/);
});

test("near towns say there is no fuel charge", async () => {
  for (const [slug, town] of [["roy", "Roy"], ["west-haven", "West Haven"], ["bountiful", "Bountiful"], ["brigham-city", "Brigham City"]]) {
    assert.match(await page("/service-area/" + slug + "/"), new RegExp(town + " is inside the 30 miles from our yard where delivery is included, so there is no fuel charge\\."), slug);
  }
});

test("the cost guide, the FAQ, the hub and the homepage explain it; nothing says there is none", async () => {
  const guide = await page("/guides/dumpster-rental-cost-utah/");
  assert.doesNotMatch(guide, /no fuel surcharge|anywhere in our service area/);
  assert.ok(guide.includes("Do you charge extra for delivery?\", \"" + NOTE) || guide.includes(NOTE), "guide FAQ");
  assert.ok((await page("/faq/")).includes(NOTE));
  const hub = await page("/service-area/");
  assert.doesNotMatch(hub, /Same price everywhere|Same price <em>everywhere/);
  assert.ok(hub.includes(NOTE));
  const home = await page("/");
  assert.ok(home.includes('<span data-trd-text="fuel_note">' + NOTE + "</span>"));
});

test("his own numbers flow through, and off means the pages say so", async () => {
  const mine = [{ key: "fuel_per_mile", value: JSON.stringify({ free: 40, base: 2500, cents: 150 }) }];
  assert.match(await page("/service-area/cottonwood-heights/", mine), /about 43 miles .* about \$29\.50 goes on \(\$25 \+ 3 miles × \$1\.50\)/);
  assert.match(await page("/service-area/logan/", mine), /Logan is inside the 40 miles from our yard where delivery is included/);
  const off = [{ key: "fuel_per_mile", value: JSON.stringify({ free: 30, base: 0, cents: 0 }) }];
  assert.match(await page("/service-area/logan/", off), /There is no fuel charge to Logan\./);
  assert.ok((await page("/faq/", off)).includes("Delivery is included anywhere we deliver."));
});
