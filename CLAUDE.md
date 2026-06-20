# Triple R Dump - Project Context

> Read this at the START of every session. Update it before you finish.

Last updated: 2026-06-20

## What this is
Roll-off dumpster rental site for Triple R Dump (West Haven, UT - 15/20/25yd bins).
Owner: Joseph Rodrigues. Built by the agency (KellanLLC / user "Kellan").
Joseph's CURRENT live revenue site is Wix at https://www.triplerdump.com - DO NOT touch
domain/DNS until the final cutover (the last step in the whole project).

## Architecture (CONSOLIDATED 2026-06-20)
- ONE Cloudflare Worker: `triplerdump` -> https://triplerdump.bkthueson.workers.dev
  - Serves the static marketing site via Workers Static Assets (directory ../deploy).
  - Runs dynamic routes: /book, /api/book, /api/availability, /admin (CMS),
    /r/<token> + /api/review (+ /feedback) review funnel, /calendar/<token>.ics.
  - wrangler-managed. Deploy: `cd worker && npx wrangler deploy` (manual; no git CI).
  - The old `triplerdump-api` worker was merged in and DELETED. Source lives in worker/.
- Static site: index.html + tokens.css + assets/ + uploads/, built into ../deploy by
  build_deploy.py. Repo KellanLLC/triplerdump (deploy/ is a nested git repo).
- D1 db `triplerdump_bookings` (id c9394039-46ce-4d42-99cc-4fc195d7ded0).
  Tables: bookings, settings (CMS overrides), reviews.

## Config / CMS
- Editable config lives in D1 `settings` (key -> JSON), layered over code defaults
  (src/config.js) by src/settings.js. The CMS edits it live - NO deploy needed.
- /admin: password (secret ADMIN_PASSWORD) -> HMAC-signed cookie (secret ADMIN_SECRET).
  Edits pricing+tax, inventory+cap, GHL webhook URLs, review link/mode/threshold,
  require_payment toggle, owner phone, SMS templates. Shows recent bookings + feedback.
- Admin password + calendar token are Worker secrets (ask Kellan; not in repo).

## Stack decisions (don't re-litigate)
- Custom booking + Stripe on the Worker - NOT Cal.com, NOT a GHL booking sub-account.
- GHL = SMS relay ONLY (inbound webhook; payload carries the message text; empty skipped).
- Payments: residential pays in full via Stripe Checkout; commercial = manual Stripe invoice.
- Capacity: per-size inventory + 11-bin total cap.

## Booking / payment flow
- src/booking.js (settings-driven). Residential AUTO-CONFIRMS while `require_payment`=false
  (Stripe still stubbed) so the whole pipeline is testable now. When Stripe goes live, flip
  require_payment ON in the CMS -> residential routes through Checkout, confirms on payment.
- SMS consent (TCPA) checkbox on the form; confirmation text only fires with consent.

## Review funnel
- Daily cron (16:00 UTC) -> rentals past pickup w/ no review sent -> mints review_token,
  texts /r/<token> via GHL review webhook (falls back to SMS webhook if review URL blank).
- /r/<token>: customer rates 1-5. GATED mode (DEFAULT, CMS toggle): 4-5 -> Google review
  link; 1-3 -> private feedback form -> texts owner. OPEN mode: everyone gets the Google
  link + a feedback box. Gating is enforced SERVER-SIDE (low ratings never get the link).
- POLICY NOTE: gated / "review gating" violates Google's review policy and is FTC-risky
  (Fashion Nova precedent). Owner accepted the risk knowingly; it is a CMS toggle.

## Secrets
- `.env` (root, gitignored): stripe-api (the `mk_...` value is NOT a valid Stripe key),
  CLOUDFLARE_TOKEN (cfut_... prefix; Kellan's account; used to deploy from the sandbox).
- Worker secrets (wrangler secret put): GHL_SMS_WEBHOOK_URL, CALENDAR_TOKEN, ADMIN_PASSWORD,
  ADMIN_SECRET. worker/.dev.vars (gitignored) holds local copies for `wrangler dev`.
- GHL SMS webhook: https://services.leadconnectorhq.com/hooks/rAseXl2Fqh0SQ0hV9Qsk/webhook-trigger/e05f015d-46ad-4673-815a-d7320b29eab0
- Review webhook: same as SMS for now (configurable separately in the CMS).
- Google review link placeid: ChIJc1Zhse8j7AcRxMoS_Ri7SA8

## Pricing (confirmed, matches Wix) - now editable in the CMS
15yd 300/325, 20yd 350/375, 25yd 400/425 ($, 1-3 day / 4-7 day). Utah sales tax 7.5%.

## Built + tested LIVE (2026-06-20)
- Consolidated worker: static site + /book + /admin CMS + booking + calendar + review funnel.
- Booking: validation, per-size + 11 cap, pricing+tax, auto-confirm (payment stubbed).
- CMS: login (wrong->401, right->cookie), panel renders, settings save to D1.
- Review funnel: gated 5*->Google, 2*->private feedback (no link leaked), owner alert path.
- Calendar ICS feed (token-gated; wrong token 404). All verified live; test rows cleaned up.

## Not done / blocked
- Stripe/POS - stubbed (src/stripe.js). Blocked on Joseph's rk_ key. When it lands:
  implement Checkout via REST + /api/stripe-webhook (verify whsec), flip require_payment ON,
  add unpaid-hold expiry so pending bookings don't tie up bin capacity.
- Live SMS - plumbing deployed + GHL secret set, but no real text fired yet (needs consent /
  owner number / Stripe confirm). OWNER_PHONE empty (Joseph has no dedicated number yet).
- Branded email - deferred until the domain (needs SPF/DKIM to be deliverable).
- Domain transfer off Wix/LegalZoom - the FINAL step.

## Known gotchas
- The file Write/Edit tool intermittently TRUNCATES files mid-content (reports success
  anyway). NOT specific to non-ASCII - ASCII rewrites truncated too. RELIABLE FIX: write
  via bash heredoc (cat > file <<'EOF' ... EOF), then verify with `wc -c` + `node --check`.
- Files created by `cp` from the read-only uploads mount inherit read-only perms; `chmod u+w` before overwriting.
- `.env` edits by the user can lag the shell mount; the Read/editor tool sees the current
  file - use it to read freshly-saved values (that is how we got CLOUDFLARE_TOKEN).

## Conventions
- Never commit secrets (.env and worker/.dev.vars stay gitignored).
- Build/test in isolation; when testing against the live worker, clean up test rows after.
- Stripe test mode first, always.
- Deploy: `cd worker && npx wrangler deploy` (needs CLOUDFLARE_API_TOKEN exported from .env).
