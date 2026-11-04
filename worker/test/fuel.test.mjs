// Fuel charge (Joseph, 10/30): the first 30 miles from the yard are included; past them it's a $40
// starting charge plus $1 for every mile past 30 ("There should be a $40 up charge plus a dollar a
// mile after that"), on the rounded miles the customer sees.
// Pure math only; the address lookups (Census, the town table, Photon) were checked by hand.
// Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, loadSettings, fuelFor, fuelOn, fuelWords } from "../src/settings.js";

const S = { ...defaultSettings(), serviceRadiusMiles: 88 };
const X = "×";

test("the default: 30 miles free, then $40 plus $1 a mile", () => {
  assert.deepEqual(S.fuelMile, { free: 30, base: 4000, cents: 100 });
  assert.equal(fuelOn(S), true);
  assert.equal(fuelWords(S), "a $40 fuel charge plus $1 for every mile past 30");
});

test("inside the free miles: no fuel charge", () => {
  assert.equal(fuelFor(S, 3), null);
  assert.equal(fuelFor(S, 30), null);
  assert.equal(fuelFor(S, 30.4), null);   // "about 30 miles" is still free
});

test("just past them: the $40 starts it (31 miles = $41, 33 = $43)", () => {
  assert.deepEqual(fuelFor(S, 31), { cents: 4100, miles: 1, label: "Fuel charge ($40 + 1 mile " + X + " $1)" });
  assert.equal(fuelFor(S, 33).cents, 4300);
  assert.deepEqual(fuelFor(S, 48), { cents: 5800, miles: 18, label: "Fuel charge ($40 + 18 miles " + X + " $1)" });
  assert.equal(fuelFor(S, 70).cents, 8000);
});

test("his own numbers: the starting charge alone, the rate alone, cents in the rate", () => {
  const flat = { ...S, fuelMile: { free: 30, base: 5000, cents: 0 } };
  assert.deepEqual(fuelFor(flat, 60), { cents: 5000, miles: 30, label: "Fuel charge (past 30 miles)" });
  assert.equal(fuelWords(flat), "a flat $50 fuel charge");
  const mile = { ...S, fuelMile: { free: 20, base: 0, cents: 150 } };
  assert.deepEqual(fuelFor(mile, 50), { cents: 4500, miles: 30, label: "Fuel charge (30 miles " + X + " $1.50)" });
  assert.equal(fuelWords(mile), "$1.50 for every mile past 20 to cover fuel");
});

test("unknown distance or nothing set: no fuel charge", () => {
  assert.equal(fuelFor(S, null), null);
  assert.equal(fuelFor(S, NaN), null);
  const off = { ...S, fuelMile: { free: 30, base: 0, cents: 0 } };
  assert.equal(fuelOn(off), false);
  assert.equal(fuelFor(off, 70), null);
  assert.equal(fuelWords(off), "");
});

test("D1 fuel_per_mile overrides the default (a saved one without base keeps the $40); the old fuel_zones rings are ignored", async () => {
  const load = async (rows) => loadSettings({ DB: { prepare: () => ({ all: async () => ({ results: rows }) }) } });
  const L = await load([{ key: "fuel_per_mile", value: JSON.stringify({ free: 25, base: 3000, cents: 200 }) }, { key: "fuel_zones", value: JSON.stringify([{ over: 30, cents: 8000 }]) }]);
  assert.deepEqual(L.fuelMile, { free: 25, base: 3000, cents: 200 });
  assert.equal(L.fuelZones, undefined);
  assert.equal(fuelFor(L, 40).cents, 3000 + 15 * 200);
  const old = await load([{ key: "fuel_per_mile", value: JSON.stringify({ free: 30, cents: 100 }) }]);
  assert.deepEqual(old.fuelMile, { free: 30, base: 4000, cents: 100 });
});
