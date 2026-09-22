#!/usr/bin/env node
// Guarded deploy for the triplerdump Worker.  Usage:  node deploy.mjs "message"
//
// Why this exists (2026-09-21): a plain `wrangler deploy` shipped versions with ZERO
// secrets (secrets inherit from the latest UPLOADED version, not the deployed one) and
// later a version with a dead Stripe key; both passed "is it 200?" checks while every
// customer's checkout failed for two days. So: upload a version, verify its secrets +
// bindings, run the FULL smoke test (incl. a real booking -> Stripe Checkout session)
// against the version's PREVIEW URL, and only then route traffic to it. Nothing reaches
// customers until the money path has been proven on that exact version.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const REQUIRED_SECRETS = ["ADMIN_PASSWORD","ADMIN_SECRET","CALENDAR_TOKEN","GHL_SMS_WEBHOOK_URL","STRIPE_SECRET_KEY","STRIPE_SECRET_KEY_LIVE"];
const REQUIRED_BINDINGS = ["env.DB","env.ASSETS","env.SITE_ORIGIN"];
const SITE = "https://www.triplerdump.com";
const D1 = "c9394039-46ce-4d42-99cc-4fc195d7ded0";

try {
  const env = readFileSync(path.join(here, "..", ".env"), "utf8");
  const tok = env.match(/^CLOUDFLARE_TOKEN=(\S+)/m)?.[1]?.replace(/"/g, "");
  if (tok && !process.env.CLOUDFLARE_API_TOKEN) process.env.CLOUDFLARE_API_TOKEN = tok;
} catch {}
process.env.CLOUDFLARE_ACCOUNT_ID ||= "5354e954dbd0016154db6b16b257160a";
const ACCT = process.env.CLOUDFLARE_ACCOUNT_ID;

const sh = (cmd) => execSync(cmd, { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const msg = (process.argv.slice(2).join(" ") || "deploy " + new Date().toISOString()).replace(/"/g, "'");

async function d1(sql) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${D1}/query`, {
    method: "POST", headers: { authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ sql }) }).then((r) => r.json());
  return r?.result?.[0];
}

// Full smoke test against a base URL. Returns the number of failed checks.
async function smoke(base, { withBooking }) {
  let bad = 0;
  const checks = [
    ["/book", "GET", null, 200],
    ["/terms", "GET", null, 200],
    ["/api/availability", "GET", null, 200],
    ["/admin", "GET", null, 200],
    ["/admin/login", "POST", "password=definitely-wrong-" + Date.now(), 401],
  ];
  for (const [p, m, body, want] of checks) {
    let status = "ERR";
    try {
      const r = await fetch(base + p, { method: m, body, headers: body ? { "content-type": "application/x-www-form-urlencoded" } : {}, redirect: "manual" });
      status = r.status;
    } catch {}
    const ok = status === want;
    if (!ok) bad++;
    console.log(`    ${ok ? "ok " : "BAD"} ${m} ${p} -> ${status} (want ${want})`);
  }
  if (!withBooking) return bad;
  // Money path: a real residential booking must come back with a Stripe Checkout URL.
  // The hold is released via the cancel path and the row deleted afterwards.
  const d = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
  const bk = await fetch(base + "/api/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    account_type: "residential", service_type: "dumpster", first_name: "Deploy", last_name: "Smoketest",
    phone: "3852004532", email: "bkthueson@gmail.com", address: "2890 W 3600 S, West Haven, UT 84401",
    bin_size: "25", rental_tier: "1-3", delivery_date: d, delivery_time: "Morning",
    ground_condition: "Driveway / Concrete", permit_needed: "no", agreed_terms: true, sms_consent: false,
    message: "DEPLOY SMOKE TEST - auto-deleted" }) }).then((r) => r.json()).catch((e) => ({ ok: false, errors: [String(e)] }));
  const ref = bk?.booking?.id;
  const checkoutOk = bk?.ok === true && String(bk?.checkout_url || "").startsWith("https://checkout.stripe.com/");
  if (!checkoutOk) bad++;
  console.log(`    ${checkoutOk ? "ok " : "BAD"} POST /api/book -> ${checkoutOk ? "Stripe Checkout session (" + ref + ")" : JSON.stringify(bk?.errors || bk)}`);
  if (ref) {
    await fetch(`${base}/book?canceled=${ref}`).catch(() => {});
    const r = await d1(`DELETE FROM bookings WHERE id='${ref}' AND paid_at IS NULL AND status='cancelled'`).catch(() => null);
    const n = r?.meta?.changes;
    console.log(n === 1 ? `    cleanup: hold released, test row ${ref} deleted` : `    cleanup WARNING: delete test row ${ref} in /admin (changes=${n})`);
  }
  return bad;
}

// Remember what is live now so a failure can be undone with one command.
const prev = sh("npx wrangler deployments status").match(/\(100%\)\s*([0-9a-f-]{36})/)?.[1];
console.log("currently live:", prev || "(unknown)");

console.log("\n1/5 uploading version (no traffic yet)...");
const up = sh(`npx wrangler versions upload --message "${msg}"`);
const id = up.match(/Worker Version ID:\s*([0-9a-f-]{36})/)?.[1];
const preview = up.match(/Version Preview URL:\s*(https:\/\/\S+)/)?.[1];
if (!id || !preview) { console.error(up); throw new Error("could not find the uploaded version id / preview url"); }
console.log("    version", id, "\n    preview", preview);

console.log("\n2/5 verifying secrets + bindings on the version...");
const view = sh(`npx wrangler versions view ${id}`);
const secrets = [...view.matchAll(/Secret Name:\s*(\S+)/g)].map((m) => m[1]);
const missingS = REQUIRED_SECRETS.filter((s) => !secrets.includes(s));
const missingB = REQUIRED_BINDINGS.filter((b) => !view.includes(b));
if (missingS.length || missingB.length) {
  console.error(`\nREFUSING TO DEPLOY ${id}: missing secrets [${missingS}] bindings [${missingB}]. Live traffic untouched.`);
  console.error("Fix: write {\"NAME\":\"value\"} to a json file -> npx wrangler versions secret bulk <file>  (stdin `secret put` mangles values on Windows), then re-run.");
  process.exit(2);
}
console.log("    ok:", secrets.length, "secrets,", REQUIRED_BINDINGS.length, "bindings");

console.log("\n3/5 smoke-testing the PREVIEW (real booking -> Stripe) before any traffic moves...");
if (await smoke(preview, { withBooking: true })) {
  console.error(`\nPREVIEW FAILED. Version ${id} was NOT deployed; live traffic untouched (still ${prev}).`);
  process.exit(3);
}

console.log("\n4/5 deploying", id, "to 100%...");
console.log("    " + (sh(`npx wrangler versions deploy ${id}@100% --yes`).match(/SUCCESS.*/)?.[0] || "deployed"));

console.log("\n5/5 re-checking the live site...");
if (await smoke(SITE, { withBooking: false })) {
  if (prev) { console.error("\nLIVE CHECK FAILED - rolling back to " + prev); console.log(sh(`npx wrangler rollback ${prev} --yes --message "auto-rollback by deploy.mjs"`).match(/SUCCESS.*/)?.[0]); }
  else console.error("\nLIVE CHECK FAILED and previous version unknown - roll back by hand: npx wrangler rollback <id>");
  process.exit(4);
}
console.log("\nDeployed + verified:", id, "(previous:", prev + ")");
