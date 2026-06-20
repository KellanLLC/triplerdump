# Triple R Dump — Project Context

> Read this before starting work. Update it before ending a session — what changed, what's still open, new decisions or blockers. This file exists so no session has to re-learn the project from scratch.

Last updated: 2026-06-19

## What this is
Roll-off dumpster rental site for Triple R Dump (West Haven, UT — 15/20/25yd bins).
Owner: Joseph. Client is a separate party building this for him.
**Production site right now is Wix, at https://www.triplerdump.com — do not touch domain/DNS until final cutover (explicitly the last step in the whole project).**

## Architecture
- Static site repo: `KellanLLC/triplerdump` on GitHub, ships via the `deploy/` folder.
- Production-mirror worker: `triplerdump.bkthueson.workers.dev` — dashboard-wired to `deploy/` output, **not** auto-deployed from git push. Manual via wrangler or Cloudflare dashboard. Treat as a demo/staging worker, not the live money site (Wix is). Safe to edit/redeploy as long as source is saved first.
- Backend/API worker: `triplerdump-api.bkthueson.workers.dev` — built separately so early booking/payment dev couldn't risk breaking the live site mirror.
- **Open decision as of last session:** consolidate into one worker (serves static site + `/book` + `/api/*` + `/calendar`), or keep API split out permanently. Check latest session notes below for the resolution.
- D1 database: `triplerdump_bookings` — rental tier, drop + pickup address, ground condition, permit/HOA flags, terms agreement, pricing, tax.
- Calendar: ICS subscribe feed, token-protected URL, no Google OAuth required.

## Stack decisions (and why, so they don't get re-litigated)
- Booking + payments live in a Cloudflare Worker — not Cal.com (wrong shape: timed appointments vs. drop-a-bin-on-a-date), not GHL (monthly sub-account cost, generic widget clashes with custom site).
- GHL is used **only** as the SMS relay via webhook. Not booking, not calendar.
- Payments: residential pays in full via Stripe Checkout. Commercial gets a manual "we'll invoice you" path — owner sends that invoice himself.
- Capacity cap: 11 bins out at once, total, across all sizes.

## Credentials / secrets
- `.env` is gitignored (it was **not** gitignored when this project started — fixed immediately, before any commit).
- **Stripe: blocked.** Waiting on Joseph to grant the agency admin access to his Stripe account (ETA was 1–5hrs as of last session — check current status). The original `mk_...` value in `.env` was not a valid Stripe key at all.
  - Use a **restricted key** (`rk_`), not a full secret key — it's someone else's account.
  - Scope: Checkout Sessions, Payment Intents, Customers → Write. Charges, Events → Read. Add Refunds → Write only if cancellations should be handled from the site itself.
  - Build and fully test against `rk_test_...` first. Swap to `rk_live_...` only at go-live.
  - Webhook signature verification uses a separate `whsec_...` signing secret, not the API key.
- GHL booking-confirmation webhook: `https://services.leadconnectorhq.com/hooks/rAseXl2Fqh0SQ0hV9Qsk/webhook-trigger/e05f015d-46ad-4673-815a-d7320b29eab0` — stored as Worker secret `GHL_SMS_WEBHOOK_URL`.
- **Unresolved:** is the review-request webhook the same URL as above, or a separate one? Never confirmed — check before wiring the review funnel.
- Google review link: `https://search.google.com/local/writereview?placeid=ChIJc1Zhse8j7AcRxMoS_Ri7SA8`
- GHL payload convention: client passes message text / phone / email directly in the webhook payload; empty fields are skipped on GHL's end.

## Pricing (confirmed with owner, matches his live Wix site)
| Size | 1–3 day | 4–7 day |
|---|---|---|
| 15yd | $300 | $325 |
| 20yd | $350 | $375 |
| 25yd | $400 | $425 |

Utah sales tax: 7.5%, auto-calculated on top.

## Built and tested (as of last session)
- `/book` — matches Joseph's real intake form: bin size, rental tier, drop + pickup address, ground condition, permit/HOA questions, terms agreement.
- `/api/book` — validates input, enforces per-size + 11-bin total caps, writes to D1, routes residential → Stripe (stubbed) and commercial → invoice path.
- Calendar ICS feed — token-protected, shows DROP and PICKUP events with address + phone.
- Daily cron sweep for completed rentals — logic tested against a **mocked** DB only, never run against real data or fired a real webhook.
- Folder cleanup: 132MB → 93MB. Old design drafts (`index-v1`–`v4`) deleted. Irreplaceable source art archived to `_archive/` (untracked, only copies — confirm before hard-deleting).

## Not done / blocked
- Stripe integration — stubbed, blocked on admin access grant.
- Live SMS sending — wired but nothing has actually fired a real text yet.
- Review-request funnel — logic exists but untested live; webhook question above unresolved; review link only just landed.
- CMS / admin panel — owner wants a password-protected panel to manage webhook URLs, pricing, caps, review link, etc. without a code deploy each time. Not scoped, not built.
- Worker consolidation — decide and execute.
- Git commit of the `worker/` code — was offered, confirmation never logged.
- Dedicated phone number for Joseph (for branded SMS/email later) — undecided.
- Email — intentionally deferred until domain cutover (needs the domain to look legit).
- Domain transfer off Wix/LegalZoom — intentionally the **final** step, only once everything else is live and tested, to avoid downtime on the owner's current revenue.

## Known gotchas
- The file-write tool has silently truncated large files containing non-ASCII punctuation (en/em dashes, ellipses) — reports success but corrupts the file. Workaround: write via bash heredoc, keep content ASCII-only for anything non-trivial in size.
- `.env` edits can lag between the shell mount and the live file — if a shell read looks stale right after an edit, re-check with the file viewer before assuming the edit didn't land.

## Conventions
- Never commit secrets. `.env` stays gitignored, always.
- Build and test new functionality in isolation before it touches the live site or real customer data.
- Stripe: test mode first, always, for anything new.
