// Daily cron: remind customers ahead of delivery. Default lead = 1 day before.
import { todayISO, addDays } from "./util.js";
import { fillTemplate, itemLabel, lengthLabel, chargedCents } from "./settings.js";
import { sendReminderSms, sendReminderEmail, sendOwnerReminder } from "./sms.js";

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
      // Customer-facing texts/emails: NO admin-link token (the old shared {link} was a footgun).
      const vals = { bin: b.bin_size, tier: b.rental_tier, item: itemLabel(b), length: lengthLabel(b),
        date: b.delivery_date, pickup: b.pickup_date,
        id: b.id, name: b.customer_name, address: b.address, phone: S.business.phone, customer_phone: b.phone || "",
        total: (chargedCents(b) / 100).toFixed(2), note: b.message || "" };
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
  console.log(`[reminder] due ${results.length}, sent ${sent}`);
  return { due: results.length, sent };
}
