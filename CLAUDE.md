# Triple R Dump - Project Context

> Read this at the START of every session. Update it before you finish.

Last updated: 2026-07-27 (worker v 96f1f01d — deploy-readiness pass). DOMAIN CUTOVER IS
DELIBERATELY HELD until after the 8th (owner's call: don't miss job bookings mid-switch).
NEW this pass: (1) FOOTER LOGO FIXED — build_deploy.py never scanned `srcset=`, so
assets/triple-r-dump-foot.webp was never copied into deploy/ and 404'd live; <picture>
cannot fall back to the PNG on a 404, so the footer rendered as a broken image. Scanner
fixed + asset shipped. (2) TURNSTILE REMOVED from /book (dead widget, error 400020),
REPLACED by an off-screen honeypot field `trd_hp`; verifyTurnstile() kept server-side for
re-enable after cutover. Honeypot fails LOUDLY (tells the customer to call) — never a fake
confirmation. (3) Repo hygiene: .gitattributes pins binaries (core.autocrlf=true),
.gitignore covers deploy/ + .wrangler + logs, and the live-but-uncommitted index.html
/book links are finally committed. STILL BLOCKED ON JOSEPH: his real phone for owner_phone.
Prior pass below (2026-07-07, worker v 78168539 — full-build review + fix pass). STRIPE IS LIVE
(CMS mode=Live, require_payment ON, cards saved for off-session damage charges). NEW this
pass: (1) expireStaleHolds now ASKS STRIPE before cancelling a stale hold — the
charged-but-cancelled gap is closed (paid -> markPaid, confirmation fires); (2) Checkout
pinned to CARD-ONLY payment methods; (3) service-aware SMS tokens {item}/{length}, and
{total} now INCLUDES the trailer deposit — code defaults AND live D1 sms_templates migrated
off "{bin}yd bin" (which was blank for trailer/junk/binswitch); (4) /booked is
status-truthful (pending auto-refresh / cancelled / not-found panels; deposit itemized);
(5) low-rating alert is owner-only (no customer fallback); (6) 'delivered' dropped from the
admin status route; (7) commercial leads require agreed_terms server-side. Turnstile still
OFF/unresolved (see Secrets). Review STRICTLY owner-triggered. REMAINING: "Not done / GO LIVE".

## What this is
Roll-off dumpster rental site for Triple R Dump (West Haven, UT - 15/20/25yd bins).
Owner: Joseph Rodrigues. Built by the agency (KellanLLC / user "Kellan").
Joseph's CURRENT live revenue site is Wix at https://www.triplerdump.com - DO NOT touch
domain/DNS until the final cutover (the last step in the whole project).

## Architecture (CONSOLIDATED 2026-06-20)
- ONE Cloudflare Worker: `triplerdump` -> https://triplerdump.bkthueson.workers.dev
  - Serves the static marketing site via Workers Static Assets (directory ../deploy).
  - Dynamic routes: /book, /terms (Terms/Return/Cancellation page, src/terms.js), /api/book,
    /api/availability, /api/geocode, /booked (Stripe
    success landing), /api/stripe-webhook (optional), /admin + /admin/bookings +
    /admin/booking/<ref> (+ /status, /delete, /notes), /r/<token> + /api/review (+ /feedback)
    review funnel, /calendar/<token>.ics.
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
  Admin password was RESET 2026-06-25 (value is a Worker secret; ask Kellan, NOT in repo).
- CMS edits: pricing+tax, inventory+cap, GHL webhook URLs, review link/mode/threshold,
  require_payment toggle, **Stripe mode (sandbox/live)**, owner phone, **owner-notify
  toggles** (text owner on bookings / on reminders), SMS templates — all 7 now editable
  (every outbound SMS): confirmation, customer reminder, review, owner new-booking, owner
  reminder, **commercial quote** + **low-rating alert** (the last two were hardcoded in
  sms.js; templated 2026-06-25). Shows recent bookings.
- SMS template tokens: **{item}** (2026-07-07) = service-aware "what they booked" ("20yd
  bin" / "dump trailer" / "junk removal" / "bin switch") — USE IT instead of "{bin}yd",
  which is blank for non-dumpster services. **{length}** = rental length ("1-3 day" /
  "5 days" / "1 day"). **{total}** = amount actually charged INCLUDING the trailer's
  refundable deposit (was: excluded it, understating trailer charges by $300).
  Shared `{note}` (= customer "Anything else?" msg, bookings.message).
  PHONE tokens are split: **{phone}** = the BUSINESS number, **{customer_phone}** = the
  customer's number (added 2026-06-25; do not confuse — old {phone} meant the customer's # in
  the commercial/low-rating defaults, now fixed to {customer_phone}).
  + audience-specific LINK tokens — **{admin_link}** (owner texts -> /admin/booking/<ref>)
  and **{review_link}** (review request -> /r/<token>). The old ambiguous `{link}` is kept
  ONLY as a back-compat alias (= admin_link in owner texts, = review_link in review); don't
  use it in new copy. Commercial adds {company}{interest}{timeframe}{email}{details};
  low-rating adds {rating}{feedback}. Live D1 templates were migrated off {link} 2026-06-25.
- **Bookings management** (new 2026-06-25): /admin/bookings = search (ref/name/phone);
  /admin/booking/<ref> = full detail (all fields + customer note + Google/Apple Maps),
  "Mark picked up / completed" (this STARTS the review funnel), editable Notes, dev Delete.
- GOTCHA: a saved `sms_templates` (or any settings) row in D1 OVERRIDES the code default.
  Changing a default in settings.js is INERT if D1 already has that key saved. Fix
  templates via the CMS Save or by updating the D1 settings row, not just code.

## Stack decisions (don't re-litigate)
- Custom booking + Stripe on the Worker - NOT Cal.com, NOT a GHL booking sub-account.
- GHL = dumb SMS relay. As of 2026-06-25 the worker POSTs a MINIMAL payload `{ number,
  message }` per text (number = E.164 recipient, message = exact body). The GHL workflow
  just relays {{message}} -> {{number}}. Email (when enabled) uses a SEPARATE webhook with
  `{ email, subject, message }`. Each text is its own POST; owner gets SEPARATE payloads.
  (Old rich typed-payload model is GONE.) VERIFIED 2026-06-25: GHL relays correctly.
- Payments: RESIDENTIAL pays in full via Stripe Checkout (LIVE as of 2026-06-26; card saved
  for later off-session damage charges). COMMERCIAL = lead/quote-request only; NO online
  payment; Joseph follows up manually.
- Refund/cancel from admin: DROPPED by owner - refunds are done in the Stripe dashboard.
- Capacity: per-size inventory + 11-bin total cap (dumpster service only).
- Address autocomplete: GET /api/geocode?q= proxies to Photon (OSM), KEYLESS, West Haven
  bias. 2026-06-25: now KEEPS the typed leading house number when OSM returns street-only.
- /book UI: clean/minimal/conversion-first. index.html is OWNER-BUILT - do not redesign it.

## Stripe (LIVE as of 2026-06-26 - live key set + live checkout VERIFIED; sandbox still selectable via CMS)
- src/stripe.js: `createCheckout(env, S, booking)` builds a hosted Checkout Session via REST
  (no SDK). Line items: service + 7.5% tax line + (trailer) untaxed deposit line. Product
  mapping from product-ids.md (PRODUCTS map in stripe.js): LIVE keys bind real `prod_` ids;
  test/sandbox keys use inline product NAMES (gated on key prefix `*_live_`).
- CONFIRMATION IS WHSEC-FREE: `confirmPaidByRedirect()` runs on the /booked redirect,
  retrieves the session with the secret key, marks the booking `paid`, fires the
  confirmation SMS. `/api/stripe-webhook` (HMAC verify) also exists but is OPTIONAL now.
- **Stripe mode toggle** (CMS `stripe_mode`, default "sandbox"): selects `STRIPE_SECRET_KEY`
  (sandbox) vs `STRIPE_SECRET_KEY_LIVE` (live). Flip in the CMS - no redeploy.
- `require_payment` is ON in D1 settings. Unpaid-hold expiry (60 min) frees capacity
  (booking.js expireStaleHolds + cron backstop). Restricted-key perms needed (sandbox &
  live): Checkout Sessions + Products + Prices = Write, Payment Intents = Read; NOT Refunds.
- SAVED CARDS (added 2026-06-26): createCheckout sets `customer_creation=always` +
  `payment_intent_data[setup_future_usage]=off_session`, so every paid checkout saves the card
  to a Stripe Customer. Owner charges it LATER (off-session) from the dashboard for overages /
  trip fees / prohibited-material fines (authorized in /terms). VERIFIED saving in sandbox.
  GOTCHA: setup_future_usage reads null on an UNPAID session (Checkout applies it at completion)
  — not a bug. Each booking creates a NEW Customer (dupes by email are fine).
- CHECKOUT SAFETY (added 2026-06-26): if payment is required but the Checkout session can't be
  created (live key missing / Stripe error), booking.js DELETES the pending row + returns an
  error — NEVER a fake "Booked!". (Bug found switching to Live with no live key: it used to
  silently confirm unpaid.)
- CARD-ONLY + PAID-HOLD RECONCILE (added 2026-07-07): createCheckout pins
  payment_method_types to card (async methods like ACH/BNPL settle AFTER the 60-min hold and
  the /booked redirect would miss them). expireStaleHolds(env, S) retrieves each stale row's
  session (key picked by the cs_live_/cs_test_ id prefix, so a CMS mode flip can't break it)
  and calls the now-exported markPaid() when payment_status=paid instead of cancelling —
  closes the "customer charged, redirect lost, hold cancelled" gap (whsec still not needed).
  Stripe 5xx/network error => row left pending for the next sweep; verified-unpaid/no-session
  => cancelled as before. /booked shows a pending panel w/ meta-refresh, so late payers who
  DO land there self-heal too.

## Booking / payment flow
- src/booking.js (settings-driven, service-aware). Service types via `service_type`:
  dumpster (15/20/25yd x 1-3 / 4-7 day), trailer ($200/day 1-14d + $300 untaxed deposit),
  junk ($550 flat, weekends only), binswitch ($200 flat). Tax 7.5% on subtotal.
- require_payment ON -> status='pending' + Checkout; confirmed `paid` via /booked redirect.
  require_payment OFF -> auto-confirms (fires confirmation immediately). "Anything else?"
  on the form = textarea name="message" -> stored in `message` col -> shown in admin detail.
- COMMERCIAL = separate lead/quote flow, status='quote_requested', fires owner SMS.

## Review funnel
- TRIGGER (changed 2026-06-25): the review request fires when the OWNER marks a booking
  `completed` in admin (startReview() in review.js, called from the /status route). The
  nightly runReviewSweep cron was DELETED 2026-06-25 — startReview is now the ONLY path
  (the cron lacked the per-phone guard and could fire before actual pickup). Double-guarded:
  skip if a request already went out for that booking, AND skip if the same phone left a
  rating on any prior booking ("already reviewed before"). Cron now = holds + reminders only.
- /r/<token>: customer rates 1-5. GATED (default): >=4 (reviewThreshold) -> AUTO-REDIRECTS
  straight to the Google review link (CMS `review_link`, placeid ChIJc1Zhse8j7AcRxMoS_Ri7SA8);
  <=3 -> private feedback -> owner SMS (now WITH a /admin/booking/<ref> link). Server-side gated.
- POLICY NOTE: review gating violates Google policy + is FTC-risky (Fashion Nova). Owner
  accepted the risk knowingly; it is a CMS toggle (open vs gated).
- NOT built yet: review follow-up cadence (initial + 3 follow-ups at +24h/+24h/+48h).

## Secrets
- `.env` (root, gitignored): stripe-api (`mk_...` = NOT a valid Stripe key; ignore it),
  CLOUDFLARE_TOKEN (cfut_...; Kellan's account; account-scoped; used to deploy).
- Worker secrets (wrangler secret put): ADMIN_PASSWORD (reset 2026-06-25), ADMIN_SECRET,
  CALENDAR_TOKEN, GHL_SMS_WEBHOOK_URL, STRIPE_SECRET_KEY (sandbox `rk_test_`),
  STRIPE_SECRET_KEY_LIVE (`rk_live_`, set + VERIFIED 2026-06-26; came from .env `new-stripe-token`).
  TURNSTILE_SECRET was set then DELETED 2026-06-26 (Turnstile OFF). NOT set: STRIPE_WEBHOOK_SECRET[_LIVE]
  (whsec optional — confirmation is via the /booked redirect). worker/.dev.vars holds local copies.
- Turnstile: RESOLVED 2026-07-27 — went the honeypot route. The widget + script are GONE
  from page.js (two sitekeys were tried, `0x4AAAAAAAAADrLvT9zIQddMdOb` then
  `0x4AAAAADrLvT9zIQddMdOb`; BOTH error 400020 on workers.dev, likely because it is a
  public-suffix domain). Replaced by an off-screen honeypot input `trd_hp` on both the
  residential and commercial forms; isBotSubmission() in index.js rejects any non-empty
  value on /api/book. verifyTurnstile() is INTENTIONALLY KEPT (no-ops with no secret) so
  Turnstile can be switched back on after the domain cutover by re-adding the widget +
  setting TURNSTILE_SECRET — worth retrying then, since a real domain may fix 400020.
  GOTCHA: the honeypot field is deliberately NOT named website/url/company — password
  managers autofill those, and a false positive costs a real job. It also fails LOUDLY
  ("please call us") rather than faking success, so a misfire can't silently eat a booking.
  Still NO rate limiting on /api/book or /admin/login.
- GHL SMS webhook (LIVE in D1 settings as of 2026-06-25): trigger id ends ...b0039c7f...
  (older ids ...0b90a794... and ...e05f015d... are STALE). Configurable in the CMS.
- owner_phone in D1 = Kellan's TEST number 3852004532 - SWAP to Joseph's number at go-live.
- A `rk_live_` key was pasted into chat 2026-06-25 by mistake - ROLL/revoke it before go-live.

## Pricing (matches Wix; CMS-editable) - Utah sales tax 7.5% on subtotal
- Dumpster: 15yd $300/$325, 20yd $350/$375, 25yd $400/$425 (1-3 / 4-7 day).
- Dump Trailer $200/day + $300 untaxed deposit. Junk $550 flat (weekends). Bin Switch $200.

## Built + verified LIVE this session (2026-06-25, sandbox; worker v 15660ccd)
- Stripe Checkout end-to-end in sandbox: product-mapped sessions, exact amounts (verified
  4/4 service types), whsec-free /booked confirmation, sandbox/live CMS toggle, hold-expiry.
- SMS: minimal {number,message} relay to the new GHL webhook; client confirmation +
  SEPARATE owner copy; owner-notify CMS toggles; owner SMS carries the admin booking link
  (verified arriving on a real phone). Consent-gated client SMS.
- Review funnel: starts on owner "mark complete" (verified), dedup, >=4 auto-redirect to
  Google, <=3 -> owner alert with booking link.
- Admin: bookings search + per-booking detail (maps, customer note, editable notes, delete),
  stripe mode + owner toggles. Address autocomplete keeps the typed house number.

## Built + verified this session (2026-06-26; worker v 0323603f)
- STRIPE LIVE: set STRIPE_SECRET_KEY_LIVE (rk_live), CMS -> Live, VERIFIED live checkout makes
  real cs_live_ sessions w/ correct amounts (15yd 1-3=$322.50, 20yd 1-3=$376.25).
- SAVED CARDS for damage charges (customer_creation=always + setup_future_usage=off_session);
  verified saving in sandbox. Checkout-failure SAFETY rollback (no fake confirmations).
- /terms page (src/terms.js) w/ owner's Terms/Return/Cancellation policy; booking checkboxes
  link to it. NOTE: owner's source text has CONFLICTING $ amounts (dry-run $150 vs $200; daily
  $50 vs $150; overweight $75 vs $150/ton; cancel $150 vs $100) — reconcile with owner.
- MOBILE fixes: custom dropdowns were display:inline (popup = misaligned sliver on iOS) ->
  `.cdd{display:block}`; terms `<a>` broke the flex row into columns -> wrapped text+link in a
  <span>. Both verified on a 390px viewport.
- Cleaned up all test bookings created during verification.

## Built + verified this session (2026-07-07; worker v 78168539) — full-build review + fixes
- FULL REVIEW first (source + deployed bundle via MCP + live D1): deployed matched source,
  prod schema matches code, no secrets tracked, admin auth/escaping/cookie flags solid.
- FIXED charged-but-cancelled gap (the big one): a card is charged the moment Checkout
  completes; if the /booked redirect never lands (closed tab/network) NOTHING confirmed it
  (no whsec set) and the 60-min sweep cancelled the paid booking. expireStaleHolds now asks
  Stripe per stale row; Checkout pinned card-only. VERIFIED live: booking POST created a
  real cs_live_ session with the new params (TRD-5ZRGZU; row deleted after).
- FIXED non-dumpster SMS (live bug): confirmation read "your yd bin is confirmed" for
  trailer/junk/binswitch. New {item}/{length} tokens filled everywhere; code defaults AND
  the saved D1 sms_templates row rewritten (owner's copy preserved); admin hint updated.
- FIXED /booked page lying: branches paid / pending (meta-refresh, re-runs the Stripe
  check) / cancelled ("nothing was booked", rebook link) / not-found; trailer total now
  includes the $300 deposit (itemized). VERIFIED live on an unpaid row + a bogus ref.
- FIXED smaller: low-rating alert had `S.ownerPhone || booking.phone` — could text the
  CUSTOMER their own complaint + admin link if owner phone blank (now owner-only);
  'delivered' removed from the admin /status route (capacity/iCal queries don't know it);
  commercial leads now require agreed_terms server-side; admin "Ratings & feedback" heading.
- Smoke-tested helpers + all /booked branches (24 asserts, node); node --check all files.
- KNOWN + accepted (not fixed): capacity check-then-insert race (fine at this volume); no
  rate limiting on /admin/login or /api/book (ties into the Turnstile-vs-honeypot decision);
  /terms conflicting $ amounts still need Joseph; CMS empty-template = silently disabled SMS.

## Not done / blocked (next session)
- Review FOLLOW-UPS: initial + 3 at +24h/+24h/+48h then abandon. Needs a `review_followups`
  col + the review cron rewritten to advance the cadence (and cron freq -> hourly; it's daily
  16:00 now). Stop on rating or after 3.
- PICKUP reminder (client + owner): only a DELIVERY reminder exists. Needs a
  `pickup_reminder_sent_at` col + reminders.js logic + templates.
- SMS COPY pass: review/tighten all template wording (proposed copy is in the chat plan).
- INVOICING (NEW ask from Joseph, 2026-07-27, via text): he wants to send INVOICES with a
  pay link, choose the due date, add his own line items, and have terms w/ late-fee
  penalties at the bottom. NOTHING like this exists — today it is prepaid Checkout
  (residential) or quote-request only (commercial); no invoice object, no due dates, no
  line items, no late fees. This is a real build (Stripe Invoicing API + an admin compose
  screen + a terms/late-fee block); it is NOT a config toggle. He called it "the main thing
  I need". Not started — scope it before promising a date.
- GO LIVE (remaining): [DONE: live key set+verified, CMS=Live, saved cards, Turnstile
  decided (honeypot), footer logo fixed]. STILL TO DO ->
  (1) [DONE 2026-07-27] owner_phone swapped off the test number 3852004532 to 8015643164.
  CONFIRMED by Kellan: 801-564-3164 is Joseph's PERSONAL CELL (not merely the public
  business line), so it does receive SMS and is the right target for booking / reminder /
  low-rating alerts. NOT yet proven end-to-end — no test text has actually been relayed
  through GHL to that number, so do that before trusting it; (2) roll the OLD exposed
  rk_live key in Stripe (new one is what's set) — must be done in the Stripe dashboard by
  Kellan, not from here; (3) domain cutover off Wix, HELD BY OWNER UNTIL AFTER THE 8th so no
  job bookings are missed mid-switch: update SITE_ORIGIN (wrangler var -> needs redeploy)
  AND the CMS "Public base URL" together, or Stripe redirects + admin/review links break.
- (2026-07-27) D1 bookings table verified EMPTY again — deleted the 7/10 junk row
  TRD-DN86AB (someone poked the live form: gibberish name, cancelled, never paid) and this
  pass's smoke booking TRD-U2QAAG. Both had paid_at NULL; no real customer money involved.
- MEDIA NOT COMMITTED: ~144MB of photos/video sit uncommitted (61MB of modified tracked
  photos swapped to full-res originals + 83MB untracked, incl. a large .mp4). Deliberately
  left out of the 2026-07-27 commit — decide Git LFS vs keeping them out of the repo.
- GHL workflows (Joseph's side): SMS workflow relays {{message}}->{{number}} (CONFIRMED
  working). Still needs branches/handling per text if he wants different routing.
- Branded email (separate GHL email webhook + SPF/DKIM) - deferred to the domain.

## Known gotchas
- Write/Edit tool intermittently TRUNCATES files (reports success). Verify with `node
  --check` + `wc -c`; fall back to bash heredoc (cat > f <<'EOF') for big writes.
- SAVED D1 settings OVERRIDE code defaults (see Config/CMS) - the biggest trap this session
  (owner template lacked {link} in D1, masking the code default). Fix in D1/CMS, not code.
- DEPLOY: `deploy/` is a REGENERABLE artifact (python build_deploy.py rebuilds from root
  index.html). DO NOT `git -C deploy reset --hard`. For a WORKER-ONLY change you can skip
  build_deploy.py and just `wrangler deploy` (assets unchanged -> "No files to upload").
  deploy/.assetsignore must list `.git` + `.assetsignore` so the nested git repo isn't
  uploaded; build_deploy.py wipes it (recreate). It FAILS on deploy/.git (read-only); move
  it aside to rebuild. Excludes absolute hrefs like `/book` in its ref regex - keep that.
- BUILD_DEPLOY REF SCANNING (bit us 2026-07-27): the script only copies assets it can FIND
  by regex in index.html. It scans `src=`, `href=`, `url('...')` and — since this pass —
  `srcset=`. A file referenced ONLY via an attribute the regex misses is silently skipped
  (no error, no warning) and 404s live. That is exactly how the footer logo broke: it was
  srcset-only, while the nav/icon webps survived only because they ALSO have
  `<link rel=preload href=...>` tags. If you add a new way of referencing an asset
  (`data-src`, `<video src>`, CSS `image-set()`, double-quoted `url("...")`), TEACH THE
  SCANNER, then verify every ref resolves inside deploy/ BEFORE deploying.
- EDGE CACHES 404s: after shipping a previously-missing asset the plain URL can keep
  returning the cached 404. Re-test with `?cb=<random>` or `Cache-Control: no-cache` before
  concluding the deploy failed. Also, `wrangler deploy` printing "No files to upload" is NOT
  a failure — asset blobs are content-addressed, so an existing hash is simply not re-sent.
- WRANGLER AUTH: the .env CLOUDFLARE_TOKEN is account-scoped; `wrangler whoami` and
  `wrangler d1 execute --remote` fail (code 10000). FIX: also export
  CLOUDFLARE_ACCOUNT_ID=5354e954dbd0016154db6b16b257160a -> `wrangler deploy` + `secret put`
  work. For REMOTE D1 reads/writes use the Cloudflare MCP `d1_database_query` tool
  (db id c9394039-46ce-4d42-99cc-4fc195d7ded0), NOT wrangler --remote.
- Shell cwd is NOT reliably the worker dir between Bash calls - use absolute paths
  (cd /c/Users/Home/Desktop/projects/tripe-r-dump/worker && ...).
- `reviews` table IS now in schema.sql (added 2026-06-26; cols: booking_id, rating, routed_to, feedback, created_at).

## Conventions
- Never commit secrets (.env, worker/.dev.vars, and live keys/passwords stay out of repo).
- Build/test in isolation; clean up test rows after testing the live worker.
- Stripe test/sandbox mode first, always.
- Deploy: `cd worker && npx wrangler deploy` (export CLOUDFLARE_API_TOKEN + ACCOUNT_ID).
