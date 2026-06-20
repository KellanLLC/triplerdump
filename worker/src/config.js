// Central config - owner-tunable knobs. Modeled on Joseph's real Wix form.
// Prices in cents, for the included rental period, pre-tax. Confirmed from owner.
export const CONFIG = {
  business: {
    name: "Triple R Dump",
    owner: "Joseph Rodrigues",
    phone: "801-564-3164",
    email: "Joseph.Rodrigues@triplerdump.com",
    address: "3539 S 4250 W, West Haven, UT 84401",
    timezone: "America/Denver",
    serviceArea: "Weber, Morgan, Davis & Salt Lake County, UT",
    taxRate: 0.075,
  },

  tiers: {
    "1-3": { label: "1-3 day", maxDays: 3 },
    "4-7": { label: "4-7 day", maxDays: 7 },
  },

  bins: {
    "15": { label: "15 yard", inventory: 4, prices: { "1-3": 30000, "4-7": 32500 } },
    "20": { label: "20 yard", inventory: 4, prices: { "1-3": 35000, "4-7": 37500 } },
    "25": { label: "25 yard", inventory: 3, prices: { "1-3": 40000, "4-7": 42500 } },
  },

  groundConditions: ["Driveway / Concrete", "Street / Asphalt", "Backyard / Dirt", "Gravel", "Other"],

  totalBinsCap: 11,

  booking: { minLeadDays: 1, maxAdvanceDays: 90 },
};

export function quote(binSize, tier) {
  const sub = CONFIG.bins[binSize] && CONFIG.bins[binSize].prices[tier];
  if (!sub && sub !== 0) return null;
  const tax = Math.round(sub * CONFIG.business.taxRate);
  return { subtotal_cents: sub, tax_cents: tax, amount_cents: sub + tax };
}
