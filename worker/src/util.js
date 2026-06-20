// Date-only helpers. Bookings deal in calendar days, not timestamps.
export function todayISO(tz = "America/Denver") {
  // en-CA formats as YYYY-MM-DD
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

export function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
