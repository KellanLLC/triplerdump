// Everything that runs on a timer. The Worker's cron fires HOURLY (wrangler.toml
// `0 * * * *`); this file is the one place that says what happens on each tick.
//
// EVERY HOUR
//   1. expireStaleHolds        booking.js   free bins held by checkouts nobody finished (60 min)
//   2. sweepInvoices           invoice.js   ask Stripe about open invoices -> "paid" owner text
//                                           + review ask when an invoice gets paid
//   3. runReviewFollowups      review.js    review nudges +24h / +24h / +48h, then stop
//   4. refreshGoogleReviews    reviews.js   homepage Google rating/count/cards, at most
//                                           once every 20h; no-op without GOOGLE_PLACES_API_KEY
//
// ONCE A DAY, at the reminder hour (10:00 America/Denver by default)
//   5. runReminderSweep        reminders.js delivery + pickup reminders, "job never closed" nudge
//   6. runInvoiceOverdueReminders invoice.js late-payment texts, then tell the owner
//
// Each job runs on its own: one failing never stops the others.
import { loadSettings } from "./settings.js";
import { expireStaleHolds } from "./booking.js";
import { sweepInvoices, runInvoiceOverdueReminders } from "./invoice.js";
import { runReviewFollowups } from "./review.js";
import { runReminderSweep } from "./reminders.js";
import { refreshGoogleReviews } from "./reviews.js";

const run = (name, p) => p.catch((e) => console.error(`[cron ${name}]`, e && e.message ? e.message : e));

export async function runScheduled(env) {
  const S = await loadSettings(env);

  await run("expire holds", expireStaleHolds(env, S));
  await run("invoices", sweepInvoices(env, S));
  await run("review follow-ups", runReviewFollowups(env, S));
  await run("google reviews", refreshGoogleReviews(env, S));

  const localHour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: S.business.timezone, hour: "numeric", hour12: false,
  }).format(new Date()));
  if (localHour === (Number(S.reminderHourLocal) || 10)) {
    await run("reminders", runReminderSweep(env, S));
    await run("invoice overdue", runInvoiceOverdueReminders(env, S));
  }
}
