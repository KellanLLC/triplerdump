// Who gets a text the console writes (POST /api/console/text). CONSOLE_TEXT_MODE "customers" = the
// customer, as written. Anything else = Joseph's phone, marked as a preview (how it ran 10/26 - 11/12).
// Mocked D1; the texting webhook is caught here, nothing is sent.
// Run: cd worker && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consoleApi } from "../src/console-api.js";

const sent = [], logs = [];
const realFetch = globalThis.fetch;
test.before(() => { globalThis.fetch = async (u, o) => { sent.push({ url: String(u), body: JSON.parse(o.body) }); return new Response("{}", { status: 200 }); }; });
test.after(() => { globalThis.fetch = realFetch; });

function env(mode) {
  const DB = { prepare: (sql) => ({ _a: [], bind(...a) { this._a = a; return this; },
    run: async function () { if (/INSERT INTO console_log/.test(sql)) logs.push(this._a); return { meta: {} }; },
    all: async () => ({ results: /FROM settings$/.test(sql.trim()) ? [{ key: "owner_phone", value: '"8015643164"' }, { key: "ghl_sms_webhook_url", value: '"https://hook.test/sms"' }] : [] }),
    first: async () => (/FROM bookings WHERE id/.test(sql) ? { id: "TRD-TEST01", customer_name: "Pat Customer", phone: "8015550100" } : null) }) };
  const e = { DB, CONSOLE_API_KEY: "k" };
  if (mode) e.CONSOLE_TEXT_MODE = mode;
  return e;
}
const call = (e, body, role = "owner") => consoleApi(new Request("https://www.triplerdump.com/api/console/text", { method: "POST",
  headers: { "content-type": "application/json", "x-console-key": "k", "x-console-user": "Joseph", "x-console-role": role }, body: JSON.stringify(body) }), e, new URL("https://www.triplerdump.com/api/console/text"));
const MSG = "Triple R Dump: your 20 yard dumpster is on the ground at 1 Main St.";

test("customers mode: the text goes to the customer, exactly as written", async () => {
  sent.length = 0; logs.length = 0;
  const r = await (await call(env("customers"), { booking: "TRD-TEST01", message: MSG })).json();
  assert.equal(r.ok, true, r.error);
  assert.equal(r.mode, "customers");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body, { number: "+18015550100", message: MSG });
  assert.equal(JSON.parse(logs[0][6]).mode, "customers");
});

test("a driver's text goes to the customer too", async () => {
  sent.length = 0;
  const r = await (await call(env("customers"), { booking: "TRD-TEST01", message: MSG }, "driver")).json();
  assert.equal(r.ok, true, r.error);
  assert.equal(sent[0].body.number, "+18015550100");
});

test("a contract contact with no booking: their number", async () => {
  sent.length = 0;
  const r = await (await call(env("customers"), { phone: "(801) 555-0199", name: "Site Super", message: "On my way." })).json();
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(sent[0].body, { number: "+18015550199", message: "On my way." });
});

test("owner mode (or unset): Joseph's phone gets it, marked as a preview; the customer gets nothing", async () => {
  for (const mode of ["owner", undefined]) {
    sent.length = 0;
    const r = await (await call(env(mode), { booking: "TRD-TEST01", message: MSG })).json();
    assert.equal(r.ok, true, r.error);
    assert.equal(r.mode, "owner");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].body.number, "+18015643164");
    assert.equal(sent[0].body.message, "[Preview of a text to Pat Customer, 8015550100] " + MSG);
  }
});

test("an empty text or an unknown booking sends nothing", async () => {
  sent.length = 0;
  assert.equal((await call(env("customers"), { booking: "TRD-TEST01", message: "  " })).status, 400);
  const e = env("customers");
  e.DB = { prepare: () => ({ bind() { return this; }, run: async () => ({ meta: {} }), all: async () => ({ results: [] }), first: async () => null }) };
  assert.equal((await call(e, { booking: "TRD-NOPE", message: MSG })).status, 404);
  assert.equal(sent.length, 0);
});

test("the deployed setting is customers, and deploy.mjs refuses a version without it", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(toml, /^CONSOLE_TEXT_MODE = "customers"$/m);
  assert.match(readFileSync(new URL("../deploy.mjs", import.meta.url), "utf8"), /REQUIRED_BINDINGS = \[[^\]]*"env\.CONSOLE_TEXT_MODE"/);
});
