// Effective settings = D1 `settings` overrides merged over code defaults
// (+ env-secret fallbacks). Lets the CMS edit values without a deploy.
import { CONFIG } from "./config.js";

const num = (v, d) => (typeof v === "number" && !Number.isNaN(v) ? v : d);

const DEFAULT_TEMPLATES = {
  // tokens: {bin} {tier} {date} {pickup} {id} {name} {address} {total} {account} {phone} {link}
  confirmation: "Triple R Dump: your {bin}yd bin is booked for {date} (ref {id}). Dump fees included. Questions? {phone}",
  owner: "New {bin}yd {tier}d booking {id}: {name}, drop {date}, {address}. ${total} {account}.",
  review: "Thanks for choosing Triple R Dump, {name}! How did we do? {link}",
};
const DEFAULT_REVIEW_LINK = "https://search.google.com/local/writereview?placeid=ChIJc1Zhse8j7AcRxMoS_Ri7SA8";

export function defaultSettings(env = {}) {
  return {
    business: CONFIG.business,
    tiers: CONFIG.tiers,
    groundConditions: CONFIG.groundConditions,
    booking: CONFIG.booking,
    bins: CONFIG.bins,
    taxRate: CONFIG.business.taxRate,
    totalCap: CONFIG.totalBinsCap,
    ghlSmsUrl: env.GHL_SMS_WEBHOOK_URL || "",
    ghlReviewUrl: env.GHL_REVIEW_WEBHOOK_URL || "",
    reviewLink: DEFAULT_REVIEW_LINK,
    reviewMode: "gated",
    reviewThreshold: 4,
    requirePayment: false,
    ownerPhone: env.OWNER_PHONE || "",
    publicBaseUrl: env.SITE_ORIGIN || "",
    templates: { ...DEFAULT_TEMPLATES },
  };
}

export async function loadSettings(env) {
  const s = defaultSettings(env);
  let rows = [];
  try { rows = (await env.DB.prepare("SELECT key, value FROM settings").all()).results || []; }
  catch (e) { console.error("[settings] load failed, using defaults", e); }

  const o = {};
  for (const row of rows) { try { o[row.key] = JSON.parse(row.value); } catch { o[row.key] = row.value; } }

  if (o.bins) s.bins = o.bins;
  if (o.tax_rate !== undefined) s.taxRate = num(o.tax_rate, s.taxRate);
  if (o.total_cap !== undefined) s.totalCap = num(o.total_cap, s.totalCap);
  if (o.ghl_sms_webhook_url) s.ghlSmsUrl = o.ghl_sms_webhook_url;
  if (o.ghl_review_webhook_url !== undefined) s.ghlReviewUrl = o.ghl_review_webhook_url;
  if (o.review_link) s.reviewLink = o.review_link;
  if (o.review_mode) s.reviewMode = o.review_mode;
  if (o.review_threshold !== undefined) s.reviewThreshold = num(o.review_threshold, s.reviewThreshold);
  if (o.require_payment !== undefined) s.requirePayment = o.require_payment === true;
  if (o.owner_phone !== undefined) s.ownerPhone = o.owner_phone;
  if (o.public_base_url) s.publicBaseUrl = o.public_base_url;
  if (o.sms_templates) s.templates = { ...s.templates, ...o.sms_templates };
  return s;
}

export async function saveSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3"
  ).bind(key, JSON.stringify(value), new Date().toISOString()).run();
}

export function quote(S, binSize, tier) {
  const sub = S.bins[binSize] && S.bins[binSize].prices[tier];
  if (sub === undefined || sub === null) return null;
  const tax = Math.round(sub * S.taxRate);
  return { subtotal_cents: sub, tax_cents: tax, amount_cents: sub + tax };
}

export function fillTemplate(tpl, vals) {
  return String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (vals[k] !== undefined && vals[k] !== null ? String(vals[k]) : ""));
}
