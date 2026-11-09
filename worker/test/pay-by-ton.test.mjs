// The $250 any-size, pay-your-own-tonnage bin (Joseph 11/09). Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSettings, quoteService, lengthLabel } from "../src/settings.js";
import { renderBookingPage } from "../src/page.js";
import { renderTermsPage } from "../src/terms.js";

const load = (rows = {}) => loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: Object.entries(rows).map(([key, v]) => ({ key, value: JSON.stringify(v) })) }) }) } });

test("every size is $250 for 7 days on the ton tier, plus tax", async () => {
  const S = await load();
  assert.equal(S.tiers.ton.maxDays, 7);
  for (const size of Object.keys(S.bins)) {
    const q = quoteService(S, "dumpster", { size, tier: "ton" });
    assert.equal(q.subtotal_cents, 25000);
    assert.equal(q.amount_cents, 25000 + Math.round(25000 * S.taxRate));
  }
});

test("saved bins keep their own prices and still get the ton tier", async () => {
  const S0 = await load();
  const S = await load({ bins: { "15": { ...S0.bins["15"], prices: { "1-3": 32000, "4-7": 32000 } } } });
  assert.equal(S.bins["15"].prices["4-7"], 32000);
  assert.equal(S.bins["15"].prices.ton, 25000);
});

test("the price and rate come from settings, and it can be switched off", async () => {
  const S = await load({ pay_by_ton: { on: true, cents: 27500, tonCents: 7000 } });
  assert.equal(S.bins["20"].prices.ton, 27500);
  assert.match(renderBookingPage(S, "dumpster"), /\$70 a ton after pickup/);
  const off = await load({ pay_by_ton: { on: false, cents: 25000, tonCents: 6500 } });
  assert.equal(off.tiers.ton, undefined);
  assert.equal(off.bins["20"].prices.ton, undefined);
  assert.doesNotMatch(renderBookingPage(off, "dumpster"), /value="ton"/);
});

test("the booking page offers it and says no tons are included", async () => {
  const html = renderBookingPage(await load(), "dumpster");
  assert.match(html, /name="rental_tier" value="ton"/);
  assert.match(html, /No tons included: you pay \$65 a ton after pickup, plus tax\./);
  assert.match(html, /Tons billed after pickup/);
});

test("the terms state it and the text says what they booked", async () => {
  assert.match(renderTermsPage(await load()), /Pay-by-the-ton rentals<\/b> include no weight: every ton on the scale ticket is billed at \$65 per ton/);
  assert.equal(lengthLabel({ rental_tier: "ton", rental_days: 7 }), "7 day, pay by the ton");
  assert.equal(lengthLabel({ rental_tier: "4-7" }), "4-7 day");
});
