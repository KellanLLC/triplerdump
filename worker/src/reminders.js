// Daily cron sweeps, four passes over bookings:
//   1. Delivery reminder, the day before delivery (customer + owner copy).
//   2. Pickup reminder to the CUSTOMER, the day before pickup - in time to call
//      and extend (terms require 24h notice; {extension_day} quotes the daily fee).
//   3. Pickup-day text to the OWNER, the morning of the pickup itself.
//   4. Close-the-job nudge to the OWNER, the day AFTER pickup, for any job never
//      marked completed - marking it done is what fires the customer review text,
//      so a forgotten tap silently costs a review.
// Junk + bin-switch are single-day services with nothing to pick up later, so only
// dumpster + trailer get passes 2-3; pass 4 covers EVERY service (same-day jobs
// need closing too). Extending a booking in admin clears the pickup flags AND the
// close nudge, so all three re-arm for the new date automatically.
import { todayISO, addDays } from "./util.js";
import { fillTemplate, itemLabel, lengthLabel, chargedCents } from "./settings.js";
import { sendReminderSms, sendReminderEmail, sendOwnerReminder } from "./sms.js";

// Customer-facing texts/emails: NO admin-link token (the old shared {link} was a
// footgun). {extension_day} = the per-day extension fee in dollars, from S.fees.
function tokenVals(S, b) {
  return {
    bin: b.bin_size, tier: b.rental_tier, item: itemLabel(b), length: lengthLabel(b),
    date: b.delivery_date, pickup: b.pickup_date,
    id: b.id, name: b.customer_name, address: b.address, phone: S.business.phone, customer_phone: b.phone || "",
    total: (chargedCents(b) / 100).toFixed(2), note: b.message || "",
    extension_day: String((((S.fees && S.fees.extensionDay) || 0) / 100)),
  };
}

export async function runReminderSweep(env, S) {
  const today = todayISO(S.business.timezone);
  const target = addDays(today, S.reminderLeadDays); // deliveries this many days out
  const { results } = await env.DB.prepare(
    `SELECT * FROM bookings
       WHERE delivery_date = ?1 AND status IN ('confirmed','paid') AND reminder_sent_at IS NULL`
  ).bind(target).all();

  let sent = 0;
  for (const b of results) {
    try {
      const adminLink = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/admin/booking/" + b.id;
      const vals = tokenVals(S, b);
      await sendReminderSms(S, b, fillTemplate(S.templates.reminder_sms, vals));
      if (S.ghlEmailUrl && b.email) {
        await sendReminderEmail(S, b, fillTemplate(S.templates.reminder_email_subject, vals), fillTemplate(S.templates.reminder_email_body, vals));
      }
      if (S.notifyOwnerReminders !== false && S.ownerPhone) {
        // Owner copy gets the booking admin link ({link} kept as a legacy alias).
        await sendOwnerReminder(S, b, fillTemplate(S.templates.owner_reminder || "", { ...vals, admin_link: adminLink, link: adminLink }));
      }
      await env.DB.prepare("UPDATE bookings SET reminder_sent_at=?1 WHERE id=?2").bind(new Date().toISOString(), b.id).run();
      sent++;
    } catch (e) { console.error("[reminder] failed for", b.id, e); }
  }

  const pickup = await runPickupSweep(env, S, today);
  console.log(`[reminder] delivery due ${results.length}, sent ${sent}; pickup customer ${pickup.customer}, owner ${pickup.owner}, close nudge ${pickup.close}`);
  return { due: results.length, sent, pickup };
}

// Passes 2 + 3. Statuses: confirmed/paid only - completed means already picked up,
// pending is an unpaid hold. Flags are marked even when a send is skipped (owner
// toggle off, missing webhook) so a quiet day never re-fires old rows later.
async function runPickupSweep(env, S, today) {
  let customer = 0, owner = 0, close = 0;

  // Customer, day before pickup: time to call and extend.
  const soon = addDays(today, 1);
  const dueCustomer = (await env.DB.prepare(
    `SELECT * FROM bookings
       WHERE pickup_date = ?1 AND status IN ('confirmed','paid')
         AND service_type IN ('dumpster','trailer') AND pickup_reminder_sent_at IS NULL`
  ).bind(soon).all()).results || [];
  for (const b of dueCustomer) {
    try {
      await sendReminderSms(S, b, fillTemplate(S.templates.pickup_reminder, tokenVals(S, b)));
      await env.DB.prepare("UPDATE bookings SET pickup_reminder_sent_at=?1 WHERE id=?2").bind(new Date().toISOString(), b.id).run();
      customer++;
    } catch (e) { console.error("[pickup reminder] failed for", b.id, e); }
  }

  // Owner, morning of pickup day: today's pickup list, one text per job.
  const dueOwner = (await env.DB.prepare(
    `SELECT * FROM bookings
       WHERE pickup_date = ?1 AND status IN ('confirmed','paid')
         AND service_type IN ('dumpster','trailer') AND owner_pickup_reminder_sent_at IS NULL`
  ).bind(today).all()).results || [];
  for (const b of dueOwner) {
    try {
      const adminLink = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/admin/booking/" + b.id;
      await sendOwnerReminder(S, b, fillTemplate(S.templates.owner_pickup_reminder || "", { ...tokenVals(S, b), admin_link: adminLink, link: adminLink }));
      await env.DB.prepare("UPDATE bookings SET owner_pickup_reminder_sent_at=?1 WHERE id=?2").bind(new Date().toISOString(), b.id).run();
      owner++;
    } catch (e) { console.error("[owner pickup reminder] failed for", b.id, e); }
  }

  // Owner, day AFTER pickup: any job still not marked completed. `<= yesterday`
  // (not `=`) so a job that slipped several days without the flag still gets its
  // one nudge. All services - junk/bin-switch have pickup_date = delivery_date,
  // so "the day after the job" works uniformly. One text per booking, ever;
  // /pickupdate clears the flag so an extension re-arms it for the new date.
  const yesterday = addDays(today, -1);
  const dueClose = (await env.DB.prepare(
    `SELECT * FROM bookings
       WHERE pickup_date <= ?1 AND status IN ('confirmed','paid')
         AND owner_complete_nudge_sent_at IS NULL`
  ).bind(yesterday).all()).results || [];
  for (const b of dueClose) {
    try {
      const adminLink = (S.publicBaseUrl || "").replace(/\/+$/, "") + "/admin/booking/" + b.id;
      await sendOwnerReminder(S, b, fillTemplate(S.templates.owner_complete_nudge || "", { ...tokenVals(S, b), admin_link: adminLink, link: adminLink }));
      await env.DB.prepare("UPDATE bookings SET owner_complete_nudge_sent_at=?1 WHERE id=?2").bind(new Date().toISOString(), b.id).run();
      close++;
    } catch (e) { console.error("[owner close nudge] failed for", b.id, e); }
  }

  return { customer, owner, close };
}
