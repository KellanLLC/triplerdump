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

  // NEW services beyond the dumpster flow. Prices in cents, pre-tax.
  // The dumpster service keeps its own `bins`/`tiers` shape above (unchanged);
  // these three are described here and are overridable via the "services"
  // settings key (see settings.js). Each has a `pricing.model`:
  //   - "perDay": amount = dayRate_cents * days (days bounded by min/maxDays)
  //   - "flat":   amount = flat_cents
  // `deposit_cents` is tracked separately and is NOT taxed.
  // `dailyCap` is a simple per-service per-date booking cap; `inventory` (trailer)
  // is checked across the rental window like dumpster bins.
  services: {
    trailer: {
      label: "Dump Trailer Rental",
      pricing: { model: "perDay", dayRate_cents: 20000, minDays: 1, maxDays: 14, deposit_cents: 30000 },
      inventory: 2,
    },
    junk: {
      label: "Junk Removal",
      pricing: { model: "flat", flat_cents: 55000 },
      weekendOnly: true,
      dailyCap: 2,
    },
    binswitch: {
      label: "Bin Switch / Multi-Dump",
      pricing: { model: "flat", flat_cents: 20000 },
      dailyCap: 2,
    },
  },
};

// Canonical pricing for ALL services. opts: { tier } for dumpster, { days } for trailer.
// Returns { subtotal_cents, tax_cents, amount_cents, deposit_cents }.
// taxRate/bins/services are passed in so callers can use either CONFIG defaults
// or merged settings (S). deposit is untaxed.
export function quoteService(serviceType, opts, ctx) {
  const taxRate = ctx && typeof ctx.taxRate === "number" ? ctx.taxRate : CONFIG.business.taxRate;
  const bins = (ctx && ctx.bins) || CONFIG.bins;
  const services = (ctx && ctx.services) || CONFIG.services;
  const type = serviceType || "dumpster";
  let subtotal = null;
  let deposit = 0;

  if (type === "dumpster") {
    const size = opts && opts.size;
    const tier = opts && opts.tier;
    const p = bins[size] && bins[size].prices && bins[size].prices[tier];
    if (p === undefined || p === null) return null;
    subtotal = p;
  } else {
    const svc = services[type];
    if (!svc || !svc.pricing) return null;
    const model = svc.pricing.model;
    if (model === "perDay") {
      let days = Number(opts && opts.days);
      if (!Number.isFinite(days)) return null;
      const minD = svc.pricing.minDays || 1;
      const maxD = svc.pricing.maxDays || 365;
      if (days < minD || days > maxD) return null;
      subtotal = Math.round(svc.pricing.dayRate_cents * days);
      deposit = svc.pricing.deposit_cents || 0;
    } else if (model === "flat") {
      subtotal = svc.pricing.flat_cents;
      deposit = svc.pricing.deposit_cents || 0;
    } else {
      return null;
    }
  }

  if (subtotal === undefined || subtotal === null) return null;
  const tax = Math.round(subtotal * taxRate);
  return { subtotal_cents: subtotal, tax_cents: tax, amount_cents: subtotal + tax, deposit_cents: deposit };
}

export function quote(binSize, tier) {
  return quoteService("dumpster", { size: binSize, tier }, null);
}
