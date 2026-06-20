# Triple R Dump — API Worker

Booking + payments + notifications backend. Runs as its own Cloudflare Worker
(`triplerdump-api`) so the live marketing site stays untouched until cutover.

## What it does
- `GET /book` — standalone booking page (bin size, date, address, contact)
- `POST /api/book` — validates, capacity-checks (per-size + 11-bin cap), stores in D1, returns a Stripe checkout URL (residential) or invoice notice (commercial)
- `GET /api/availability?size=15&date=YYYY-MM-DD` — availability check
- `GET /calendar/<CALENDAR_TOKEN>.ics` — private iCal feed of confirmed bookings; owner subscribes once in Google/Apple Calendar
- Daily cron — fires a review-request text for rentals whose pickup date just passed

## Data
Cloudflare D1 database `triplerdump_bookings` (id `c9394039-46ce-4d42-99cc-4fc195d7ded0`). Schema in `schema.sql`.

## Secrets (not in repo)
Local: copy `.dev.vars.example` → `.dev.vars`. Production: `wrangler secret put NAME`.

| name | purpose |
|---|---|
| `STRIPE_SECRET_KEY` | restricted key, `rk_test_`/`rk_live_` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_` for verifying Stripe webhooks |
| `GHL_SMS_WEBHOOK_URL` | GoHighLevel inbound webhook for confirmations |
| `GHL_REVIEW_WEBHOOK_URL` | GHL webhook for review requests |
| `OWNER_PHONE` | owner cell for new-booking alerts |
| `CALENDAR_TOKEN` | long random string guarding the .ics feed |

## Dev / deploy
```
npm install
npm run dev            # local
npm run deploy         # publish to Cloudflare
npm run db:schema      # (re)apply schema to the remote DB
```

## Status
- [x] Worker + D1 + booking flow + capacity guard
- [x] iCal feed + review cron (wire webhook URLs to activate texts)
- [ ] Stripe checkout — stubbed in `src/stripe.js`, finished when the key lands
- [ ] Embed booking flow into the live site, then domain cutover
