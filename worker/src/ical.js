// Builds an iCal (.ics) feed of confirmed bookings so the owner can subscribe
// once in Google/Apple Calendar and see every drop-off + pickup. Read-only,
// no Google credentials needed. Served behind a secret token.
import { addDays } from "./util.js";

function esc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
const ymd = (iso) => iso.replace(/-/g, "");

export async function buildICalFeed(env) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM bookings
       WHERE status IN ('confirmed','paid','completed')
       ORDER BY delivery_date`
  ).all();

  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Triple R Dump//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Triple R Dump — Bookings",
    "X-WR-TIMEZONE:America/Denver",
  ];

  for (const b of results) {
    const who = `${b.customer_name} · ${b.phone}`;
    const desc = `${b.customer_name} · ${b.phone} · ${b.account_type} · ${b.id}`;

    // Drop-off (all-day on delivery date)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}-drop@triplerdump`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(b.delivery_date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(b.delivery_date, 1))}`,
      `SUMMARY:DROP ${b.bin_size}yd — ${esc(who)}`,
      `LOCATION:${esc(b.address)}`,
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT"
    );

    // Pickup (all-day on pickup date)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}-pickup@triplerdump`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(b.pickup_date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(b.pickup_date, 1))}`,
      `SUMMARY:PICKUP ${b.bin_size}yd — ${esc(who)}`,
      `LOCATION:${esc(b.address)}`,
      `DESCRIPTION:${esc(desc)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
