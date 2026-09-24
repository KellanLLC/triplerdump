# How the Triple R Dump backend works

One Cloudflare Worker (`triplerdump`) does everything: serves the website, takes
bookings and payments, runs the admin panel, sends every text, and runs timed jobs.
One database (D1 `triplerdump_bookings`). Stripe handles money. GoHighLevel only
relays texts: we send it `{ number, message }` and it sends the SMS.

**Deploy:** `cd worker && node deploy.mjs "what changed"`. Nothing else. It tests a
real checkout on a preview before any customer sees the new version. Preview URLs
are switched off between deploys (SEO), so switch them on for the deploy and off
after; the exact API call is in the top of `CLAUDE.md`.

## The files (`worker/src/`)

| File | What it does |
|---|---|
| `index.js` | The front door. Looks at the URL and hands the request to the right file. |
| `cron.js` | Every timed job, in one list. Start here for "why did that text go out?" |
| `booking.js` | Creates bookings: prices, bin availability, service area, holds, promo codes. |
| `stripe.js` | Stripe Checkout (card payments) and confirming a payment. |
| `invoice.js` | Invoices: create, send, void, "paid" check, late-payment texts. |
| `review.js` | Review asks and the follow-up nudges (for bookings and invoices). |
| `reviewpage.js` | The `/r/...` page where customers pick stars. |
| `reminders.js` | Delivery and pickup reminders, "job never closed" nudge. |
| `sms.js` | The only place a text is actually sent. |
| `settings.js` | Default settings and text wording. The admin panel overrides these. |
| `admin.js` | Every admin screen (dashboard, bookings, invoices, settings tabs). |
| `page.js` | The `/book` page. |
| `booked.js` | The "you're booked" page after paying. |
| `terms.js` | The `/terms` page (fees come from settings). |
| `marketing.js` | Puts live prices into the website pages; one-URL-per-page redirects. |
| `ical.js` | Calendar feed of jobs. |
| `config.js`, `util.js` | Small shared helpers. |

## Where settings live

Everything Joseph can change (prices, bins, fees, texts, on/off switches) is saved in
the database `settings` table from the admin panel. A saved setting **beats** the
default in `settings.js`, so changing a default in code does nothing if that setting
was already saved. Change it in the admin panel instead.

## Timed jobs (`cron.js`)

| When | Job |
|---|---|
| Every hour | Free bins held by checkouts nobody finished (after 60 min) |
| Every hour | Check open invoices with Stripe; when one is paid, text Joseph and (if ticked) ask for a review |
| Every hour | Review nudges to people who haven't answered |
| Daily, 10am | Delivery and pickup reminders; "job never closed" nudge to Joseph |
| Daily, 10am | Late-payment texts for overdue invoices |

## Every text the system sends

Each one is sent **once** unless it says otherwise. Wording is in Admin → Texts.

| Text | To | When |
|---|---|---|
| Booking confirmation | Customer | Right after they pay (only if they ticked texts OK) |
| New booking | Joseph | Same moment |
| Delivery reminder | Customer + Joseph | Day before delivery, 10am |
| Pickup reminder | Customer | Day before pickup, 10am (dumpster + trailer) |
| Pickup day | Joseph | Morning of pickup |
| Job never closed | Joseph | Day after pickup, if not marked done |
| Review ask | Customer | When Joseph taps "Picked up", or when an invoice with the review box ticked is paid |
| Review nudges 1-3 | Customer | +24h, +24h, +48h, only if they haven't tapped the link |
| Low rating alert | Joseph | Customer gives 1-3 stars and writes feedback |
| Invoice | Customer | When the invoice is created, and when Joseph taps Resend |
| Invoice paid | Joseph | Within an hour of payment |
| Late payment | Customer | Every 48h after the due date, up to 5 times |
| Invoice still unpaid | Joseph | After the last late-payment text |
| Commercial quote request | Joseph | When a business fills out the quote form |

Never asked twice for a review: anyone who already rated, or was asked in the last
30 days, is skipped.

## Database tables

| Table | Holds |
|---|---|
| `bookings` | Every booking, its status, payment, and which texts went out |
| `invoices` | Every invoice, Stripe ids, paid date, review + late-payment state |
| `reviews` | Star ratings and feedback |
| `settings` | Everything saved from the admin panel |

Schema: `worker/schema.sql`. Changes go in `worker/migrations/` and must be applied
to the live database **before** deploying code that uses them.
