*** GOOGLE BUSINESS PROFILE REBUILT 2026-09-10 (worker v d102dfd5) ***
- The ORIGINAL GBP (CID 1101335824891562692, listing 12025527903397476755, ~15 reviews) is
  held by Brandcraft Marketing (ex-agency, jemmyn@brandcraftmarketingllc.com, unresponsive).
  Boston's ownership request (Google case 9-0753000040917) went unanswered -> Google
  UNVERIFIED it ~Aug 29 -> it vanished from Maps and every old review link dead-ended.
  A support-instructed duplicate (10771400065548320888) was auto-suspended Sep 5; a second
  one Boston built (listing 9322818379133839494, store 06310780382393276766) is ABANDONED
  (unverified, still on bkthueson@gmail.com) - do not touch it.
- JOSEPH BUILT + VERIFIED HIS OWN PROFILE: listing 4556821476581406756, store code
  04459485155888013557, CID 8339345795908710583, owner Joseph.Rodrigues@triplerdump.com,
  managers boston@getkellan.com + bkthueson@gmail.com. Category "Dumpster rental service",
  hours 9-5, public on Maps as of Sep 10.
- NEW REVIEW LINK = https://g.page/r/CbcwSVDRTrtzEBM/review (verified signed-out). Written
  to D1 settings review_link, index.html footer, build_pages.py, settings.js default,
  uploads/info.md. The old g.page/r/CcTKEv0Yu0gPEBM + placeid ChIJc1Zhse8j7AcRxMoS_Ri7SA8
  are DEAD - never reintroduce them.
- STILL OPEN: getting the ~15 old reviews merged onto the new profile. Two Google cases:
  9-0753000040917 (ownership/merge - Michael promised an automatic merge on Sep 7) and
  0-4342000042082 (review-transfer team; insists requester be on BOTH profiles, which is
  impossible since nobody on our side is on the source). Joseph was emailed the
  move-reviews form (support.google.com/business/contact/business_move_reviews) + an owner
  authorization statement to email Boston for forwarding into the case. GBP invite emails
  are unreliable (known 2026 bug) - Joseph had to create the profile himself.

# Triple R Dump - Project Context

> Read this at the START of every session. Update it before you finish.

*** DISCOUNT / PROMO CODES 2026-08-25 (worker v 27a2173d; UI polish v c353741b) — Joseph
asked "how do I apply discounts to invoices? like 10% military discount? or create a
code online" ***
- POLISH PASS (v c353741b) after Boston's screenshot: the blank spare rows carried
  placeholder text "MILITARY10"/"10" that READ AS SAVED CODES (he thought the code was
  duplicated), and add/remove was only implicit. Now: NO placeholders in the inputs
  (the intro sentence carries the example), ONE clearly-empty spare row (no-JS path),
  a grey "+ Add another code" button (appends rows with the next unused dc_ index),
  and a Remove button on every row (clears the inputs + hides the row; blank code =
  dropped on Save — nothing is deleted until Save changes is pressed). Rows pair with
  their example line by data-i (never by position) so removed rows can leave gaps.
  Verified with REAL CLICKS in a browser against renderPanel output served over
  localhost (file:// previews are static snapshots — serve via http to script them):
  example lines update live, Add appended dc_code_2, Remove cleared + hid the row and
  its example. Offline suite now 59/59.
- v f77d6fcb: the /book promo input's placeholder said "e.g. MILITARY10" — that hands
  every CUSTOMER a string that is probably a real working code. Placeholder removed;
  /book must NEVER show an example code (suite asserts it, 60/60). Example codes are
  fine in /admin copy (owner-only), never on customer-facing pages.
- CMS "Discounts" tab in /admin (between Extra fees and Bins): rows of code + percent +
  On checkbox, two blank rows to add more, and a LIVE EXAMPLE line under each row (the
  25yd 1-3 price run through the percent, before/after tax) so Joseph sees the math
  before saving. Stored in D1 settings key `discount_codes` = [{code,pct,active}].
  saveSettings parses indexed fields dc_code_0.. (whole panel is ONE form, so repeated
  names would collapse); codes normalize to uppercase A-Z/0-9/dash ≤20 chars, pct clamps
  1–100, blank code = delete, dupes keep the first. settings.js: S.discountCodes default
  [] + findDiscountCode(S, code) (case-insensitive, skips active:false).
- /book: "Promo code (optional)" input above the price summary (residential only —
  commercial leads are unpriced). Debounced live check via NEW GET /api/promo?code= →
  {ok,valid,code,pct} (reveals nothing but existence+pct). Valid → green "CODE applied:
  N% off", summary grows a discount row, tax/total recomputed client-side; unknown →
  red "Code not recognized". SERVER is authoritative: createBooking validates the code
  and REFUSES an unknown one loudly (never silently charges full price). Math: discount
  = pct% of PRE-TAX subtotal (capped at subtotal), tax recomputed on the net, deposit
  NEVER discounted. bookings rows store promo_code (uppercase) + discount_cents
  (migration 0006 APPLIED to live D1); subtotal_cents stays the ORIGINAL price and
  amount_cents = subtotal − discount + tax, so {total}/chargedCents/booked-page all
  stay right with no changes.
- STRIPE CHECKOUT shows the discount as a real discount row: createCheckout creates a
  one-off AMOUNT_OFF coupon (duration=once, name = the code) and passes
  discounts[0][coupon]; amount_off NOT percent_off on purpose — percent would also
  discount the tax + deposit LINES (our tax is already computed on the net). Service
  line keeps full price AND its live product id. Coupon create fails → fallback charges
  the net amount on the service line qty 1 (no per-day rounding drift for trailer) so
  the discount is never lost. LIVE VERIFIED end-to-end: booking TRD-CAUJY3 with test
  code TRDTEST9 (10%): $375 → total_details.amount_discount=3750, amount_total=36281 on
  a real cs_live_ session. Cleaned up after: hold released via /book?canceled= (session
  expired at Stripe), booking row + test settings row deleted, one-off coupon deleted;
  bookings table back to the 8 real rows, discount_codes key ABSENT from D1 (code
  default [] serves until Joseph saves his first code).
- INVOICES: New Invoice page has a Discount section — select of saved codes ("CODE — N%
  off", inactive ones hidden) + "Custom percent…" that reveals a percent box (JS; no-JS
  shows both). index.js /admin/invoice/create applies it via invoice.js
  applyPercentDiscount(items, pct, label): pushes a NEGATIVE line item before totalsFor,
  so tax (on the net), D1 line_items JSON, the Stripe invoice, and the PDF all reflect
  it with zero schema change (Stripe invoiceitems accept negative unit_amount_decimal;
  capped at the items subtotal so a total can never go negative). invMoney now renders
  negatives as "-$X.XX". NOT yet exercised against the real Stripe invoice API — the
  negative-line-item call is offline-tested only; first real discounted invoice should
  be watched (sandbox first if in doubt).
- Admin booking detail shows "Discount (CODE) −$X" between Subtotal and Tax; /book
  confirmation recap shows it too. Guide tab + OWNER-GUIDE.md updated (Discounts row in
  the tab table + a "Discount codes" section under Money).
- Offline suite: scratchpad promo_test.mjs — 56/56 asserts (findDiscountCode, booking
  math incl. loud refusal + unchanged no-code path, checkout coupon + fallback + no-
  coupon regression, invoice negative-line math incl. caps, admin render/save/detail,
  invoice form, /book render). Post-verify regression: /book /admin /terms 200,
  /api/availability normal, /api/promo valid:false after cleanup.

*** LIVE PRICES EVERYWHERE + /bbb/ PAGE + FOOTER CREDIT 2026-08-23 later (worker v 08d9a149) ***
- PRICES ARE NOW CMS-DRIVEN ON EVERY PAGE, NO REBUILD. New worker/src/marketing.js:
  wrangler `run_worker_first` (glob list) routes the marketing HTML ( / , /dumpster-rental*,
  /junk-removal*, /dump-trailer-rental*, /bin-switch*, /service-area*, /faq*, /bbb* )
  through the worker, which fetches the asset via the new ASSETS binding and substitutes
  live settings prices. Two markers: generated pages carry {{TRD:key}} tokens (visible
  text, titles, meta, JSON-LD, FAQ prose — build_pages.py bakes NO dollar amounts any
  more; keys d15_13/d15_47/d20_13/d20_47/d25_13/d25_47/junk/trailer_day/trailer_dep/
  binswitch/ext_day, helper T()); index.html keeps real numbers but marks its 9
  .rate-price elements with data-trd="key" (graceful fallback). Fail-open: settings
  error → asset served unrewritten. Responses: cache-control max-age=300, ETag/
  Last-Modified stripped, request validators stripped so a 304 can't pin stale prices.
  A /admin price save is live site-wide within 5 min. Ext-day fee + junk/trailer/switch
  prices also flow (S.services/S.fees) — services key has no D1 row today, so code
  defaults serve until someone saves one.
- WRANGLER UPGRADED 3.114 -> 4.125 in worker/package.json — REQUIRED (v3 only knows
  boolean run_worker_first). Deploy syntax unchanged.
- Offline test: scratchpad trd_rewrite_test.mjs (31 asserts — token sweep over all
  generated pages incl. no-stray-`${`, JSON-LD prices, data-trd rewrite, cents
  formatting, unknown-token passthrough, path matcher incl/excl) ALL PASS. LIVE
  verified: 15yd page + homepage show D1 prices with zero {{TRD: residue (generated
  pages have no baked numbers, so the rendered $275 proves the D1 chain), /book /terms
  /admin /api/availability unaffected.
- /bbb/ SEO page added (build_pages.py; PAGE_DIRS in build_deploy.py got "bbb").
  31 sitemap URLs now. Footer of index.html + generated pages links it ("BBB
  accredited"). Page: hero, what-accreditation-means prose, side card with the dynamic
  seal + profile link, rate table (tokens), CTA.
- FOOTER CREDIT RESTYLED per Boston's screenshot: "Made by Kellan" now .foot-made —
  Anton, uppercase, letter-spacing .16em, .72rem, color UNCHANGED (--color-ink-2),
  UNDERLINED, and the WHOLE phrase is one link to getkellan.com (Boston asked for all
  three in follow-ups). index.html inline CSS + pages.css.
- /contact/ PAGE 2026-08-24 (worker v 9af0659f): the old Wix /contact URL still ranked
  in searches and 404'd. Real page added in build_pages.py (call/text, email, shop
  address + Google/Apple Maps, book-online blocks; side card with the full phone number
  — .big-price.contact-num, smaller clamp so it fits; ContactPage+LocalBusiness JSON-LD).
  In sitemap (32 URLs), footer Contact cols link it, PAGE_DIRS + run_worker_first +
  MARKETING_RE include it. Other legacy Wix paths probed and still 404: /about
  /services /book-online /quote /gallery — nobody has reported those ranking; check
  Search Console if traffic complaints continue.

*** PRICE DROP SYNCED 2026-08-23 (worker v 0908692f; worker SOURCE UNCHANGED) ***
- Joseph LOWERED dumpster prices $25 across the board via the admin CMS (he called it
  "Stripe" in his text, but D1 `bins` is what changed): 15yd $275/$300, 20yd $325/$350,
  25yd $375/$400 (1-3 / 4-7 day). Checkout was already charging these; the static pages
  were stale. Synced index.html (3 rate rows) + build_pages.py (p13/p47, three FAQ
  answers, the city-page "from $300"->"from $275" desc), rebuilt, deployed. VERIFIED
  live: homepage + 15yd page show new prices; /book 200; availability API normal.
  Junk $550 / trailer $200+$300 deposit / switch $200 unchanged.
- ALSO CHANGED IN D1 (by Joseph, presumably same session): fees.overweightTon 7500->10000
  ($100/ton — /terms renders this automatically) and total_cap 11->9 (matches the real
  1/3/5 fleet). MISMATCH LEFT OPEN: D1 `invoice_terms` text still says "$75 per ton" —
  one D1 write to fix once Joseph confirms $100 was intentional. CLAUDE.md's old "$75/ton
  reconciled" notes are now historical.
- build_deploy.py: rmtree(deploy) died on WinError 32 (open handle on the FOLDER itself;
  the nested deploy/.git got deleted by the first half-run — it was regenerable). The
  script now EMPTIES deploy/ instead of rmtree'ing it, so a held handle on the dir can't
  break the build. deploy/ is no longer a nested git repo.
- BBB SEAL LIVE (same day, worker v df1d08c0): Joseph forwarded BBB's dynamic-seal email
  (business id 1000181920). Seal added to the footer of index.html AND the build_pages.py
  footer template (+ .foot-bbb CSS in index inline styles and pages.css): BBB's hosted
  PNG (seal-central-northern-western-arizona.bbb.org — hotlinked ON PURPOSE, it is a
  "dynamic" seal BBB updates/revokes) linking to their bbb.org profile with #sealclick
  (BBB's click tracking — keep it). Rendered 40px tall under the social icons. VERIFIED
  live in a real browser: image loads (250x52 natural), shows "BBB Rating: A-", no
  overflow. bbb.org profile URL 403s for curl (bot blocking) — normal, fine in browsers.

*** SEO PAGES + SITEMAP 2026-08-22 (worker v 956b44b0; worker SOURCE UNCHANGED) ***
- The marketing site is no longer one page. `build_pages.py` (repo root) generates, from
  data at the top of the file, in the home page's exact look (pages.css = the index CSS
  lifted into a stylesheet; index.html keeps its own inline CSS and was NOT redesigned):
  /dumpster-rental/{15,20,25}-yard/, /junk-removal/, /dump-trailer-rental/, /bin-switch/,
  /service-area/ + 19 city pages (/service-area/<city>/), /faq/, plus sitemap.xml (30 URLs
  incl. / /book /terms) and robots.txt (Disallow /admin /api/ /booked /r/ /inv/ /calendar/;
  Sitemap line). All plain static files served by Workers Static Assets; NONE of the paths
  collide with a worker route, so the booking system is not involved in serving them.
- build_deploy.py now ALSO copies those page folders + pages.css/sitemap.xml/robots.txt
  into deploy/ and scans them for ROOT-ABSOLUTE asset refs (/assets/…, /uploads/…) —
  generated pages use leading-slash paths, unlike index.html. It also recreates
  deploy/.assetsignore. Workflow for a page/price change: edit build_pages.py ->
  `python build_pages.py` -> `python build_deploy.py` -> `cd worker && npx wrangler deploy`.
- index.html: SURGICAL href edits only — footer Services links -> the size/service pages,
  footer Service Area column -> city pages + hub + FAQ, and one sentence under the
  counties linking the hub. Nothing else in index.html changed.
- Prices/fees in the pages are the same numbers as the home page + /terms (15/20/25 =
  $300/$325, $350/$375, $400/$425; junk $550; trailer $200/day + $300 deposit; switch
  $200; extension $50/day). IF THE CMS PRICES CHANGE, update build_pages.py and re-run,
  or the static pages go stale.
- VERIFIED live after deploy: all 30 sitemap URLs 200; /book, /terms, /api/availability,
  /admin (login form), /booked?ref=bogus unchanged; bad admin password 401. No bookings
  were created. Search Console: submit https://www.triplerdump.com/sitemap.xml.

*** THE CLIENT-SIDE PERSON IS **BOSTON**. "Kellan" (KellanLLC / getkellan.com) is his
COMPANY, not his name. Older notes and commits below wrongly call him Kellan. ***

*** DASHBOARD + CLOSE-NUDGE + REVIEW PROOF 2026-08-13, later same day (worker v dbb933e8) ***
- /admin now OPENS ON A TODAY VIEW above the settings tabs: "Still out — needs closing"
  (amber card, overdue unmarked jobs), then Today with Deliver / "Pick up — tap when done"
  buckets. Each job = one row (maps link, tel link, ref link) + a green "✓ Picked up"
  button that POSTs the existing /status route with back=admin (only the literal "admin"
  is honored). renderPanel SIGNATURE CHANGED to (S, data): data = { recent, lowReviews,
  saved, flash, flashRef, today, active }; index.js /admin GET queries active jobs
  (status confirmed/paid AND (delivery_date=today OR pickup_date<=today)).
- FLASH CONFIRMATIONS (Boston: "make sure it says ok marked picked up successfully"):
  /status and /pickupdate redirect with ?flash=…; flashHtml() renders plain-words green
  banners — done-review ("review text on its way") / done-already ("never ask twice") /
  done-failed (amber, "press again to retry" — truthful: re-marking completed re-calls
  startReview, whose guards make it a safe retry). Booking detail now has a REVIEW row
  (★ N stars / "asked DATE · they opened the link" / "not asked yet").
- CLOSE NUDGE (new pass 4 in reminders.js runPickupSweep): the day AFTER pickup_date
  (query pickup_date <= yesterday so slipped days still catch), status confirmed/paid,
  ALL services, one text per booking ever (flag owner_complete_nudge_sent_at — migration
  0005 APPLIED to live D1; /pickupdate NULLs it so extensions re-arm). Template
  owner_complete_nudge — sms_templates is now 14 keys; the key is ABSENT from the saved
  D1 row so the code default serves (per-key merge). THE WHOLESALE-SAVE TRAP: the Texts
  tab textarea (tpl_owner_complete_nudge) MUST exist in the form — saveSettings writes
  sms_templates wholesale, and a missing field would save "" and silently kill the text.
  Respects notify_owner_reminders; flag stamped even when the send is skipped; rides the
  10:00 America/Denver gate.
- REVIEW AUTOMATION: PROVEN, twice. (1) Real customer Tony Roest — review sent Aug 3 on
  mark-completed, he clicked Aug 4 and rated 5 (Boston's "it didn't send anything" when
  re-marking = the already-sent/already-rated guards, by design — the new flash banner
  now SAYS so). (2) Live test to Boston's own phone: row TRD-BTESTA (3852004532, status
  completed, token 9ea1ef0f…), GHL relay returned 200, ladder armed (nudge 1 due
  2026-08-14T22:14Z if he doesn't tap; tapping stops it with reason "clicked").
  Boston CONFIRMED the text arrived on his phone; TRD-BTESTA was then DELETED (he never
  tapped, so no reviews row and the armed nudge died with the row — no residue, and
  3852004532 stays eligible for future tests). Bookings table = the 4 real rows.
- VERIFIED: 27/27 new offline asserts (nudge sweep incl. toggle-off-still-stamps, Today
  buckets incl. same-day junk in "finish", flash, review row, no-undefined) + 32/32
  lockout-suite regression; real-browser probe at 375px CSS = ZERO horizontal overflow
  (headless-Edge right-edge clipping at 125% DPI remains a screenshot ARTIFACT — trust
  the scrollWidth probe). Palette: admin bg #eef2f7 -> #ecf2fa (brand-blue-tinted, not
  the stock UI-kit grey); statuses = colored TEXT not pills; the done action is green
  #146c2e (6.5:1 on white). OWNER-GUIDE.md + the admin guide tab updated in step (4-row
  reminders table).

*** INCIDENT + FIX 2026-08-13 (worker v e1e09a91) — THE SELF-LOCKOUT THAT COST A REAL JOB ***
- Brody Floto (Hooper, 2.8 mi away) tried to book the 15yd twice (Aug 11 + Aug 12; rows
  TRD-SA9MN6 / TRD-SU7XVK left `cancelled` in D1 as real history — do not delete). Both
  times he passed every gate, reached LIVE Stripe Checkout, and payment died on his device
  (ZERO PaymentIntents ever hit Stripe — nothing was submitted). His own pending hold then
  owned the ONLY 15-yarder for 60 min, so every retry read "No 15 yard bins free". He
  walked; Joseph reported it Aug 13 as "kicked him out / wouldn't let him back in".
- It was NOT the service area (his address geocodes 2.8 mi; the gate passed him both days).
  Boston, mid-triage, saved radius=0 + bins 15yd->3; bins are now the VERIFIED fleet
  1/3/5 (confirmed with Joseph — leave alone) and the radius was RESTORED to 60 (Vegas
  re-verified refused at ~389 mi live).
- THE FIX — one shared releaseHold() in booking.js with a MONEY INVARIANT every caller
  gets: a hold row is cancelled ONLY once its Checkout session provably can't take a
  payment (paid -> markPaid; open -> must successfully POST /expire at Stripe first;
  expire refused -> re-check once (may have just completed) -> else leave pending;
  Stripe 5xx/network -> leave pending). Callers:
  (1) createBooking releases the SAME customer's pending unpaid holds (phone OR email
      match) BEFORE the capacity gate — a retry can never be blocked by your own earlier
      attempt. If one turns out PAID, it refuses the duplicate ("you're already booked,
      ref X") instead of double-charging.
  (2) /book?canceled=<ref> (Stripe's back arrow / cancel_url) -> cancelAbandonedCheckout
      releases that hold immediately; page shows a "nothing was charged" banner.
  (3) expireStaleHolds (60-min sweep) now routes through the same releaseHold().
- page.js: `pageshow` handler re-arms the form on back-forward-cache restore — Safari was
  restoring /book with the submit button PERMANENTLY DISABLED and "Checking
  availability..." stuck (the literal "wouldn't let me back in"). Capacity refusals now
  end with the business phone so a real sell-out becomes a call, not a lost job.
- VERIFIED: 32/32 offline asserts (mocked D1+fetch, zero SMS/charges) + live: double-book
  released hold A (row cancelled + session force-EXPIRED at Stripe), ?canceled released
  hold B, Vegas refused, /book HTML carries pageshow+banner. Test rows deleted; bookings
  table = the 4 real historical rows. Both guides (admin tab + OWNER-GUIDE.md) updated.
- STILL UNKNOWN: why Stripe's page failed him twice (server-side everything worked; Tony
  Roest paid fine July 30 with identical config). If anyone reports it a third time, take
  it by phone — Joseph can send an invoice pay link from /admin.

REVIEW FOLLOW-UP LADDER BUILT 2026-07-29 (worker v dc317caf) — modelled on the
kronos-electric worker (C:\Users\Home\Desktop\projects\kronos-electric).
- The FIRST ask is still owner-triggered (startReview on "mark picked up / completed").
  Only the chase is automatic: +24h, +24h, +48h, then STOP FOREVER.
- STOPS on any signal: `clicked` (opening /r/<token> — markReviewClicked, strongest
  signal, set even if they never rate), `rated` (stopReviewLadder from handleReviewRate),
  `exhausted` (3 sent, or an hours box set to 0). stopReviewLadder COALESCEs so the FIRST
  reason wins and a later pass can't overwrite "clicked" with "exhausted".
- Migration 0004 APPLIED to live D1: review_step, review_next_due_at, review_stopped_at,
  review_stop_reason, review_clicked_at + a partial index on (review_next_due_at) WHERE
  review_stopped_at IS NULL.
- CMS: Reviews tab has the 3 hour boxes (`review_followup_hours`, JSON array [24,24,48],
  0 = rung off); Texts tab has review_followup_1/2/3 — sms_templates is now 13 keys.
- *** CRON IS NOW HOURLY (`0 * * * *`, was `0 16 * * *`). *** The ladder needs sub-daily
  resolution. The DELIVERY/PICKUP REMINDER SWEEP IS GATED to 10:00 America/Denver inside
  scheduled() (Intl.DateTimeFormat hour check) so it still lands at a civilised hour —
  if you ever touch that gate, reminders will fire at the wrong time or every hour.
- 25/25 offline asserts pass (mocked D1 + fetch, zero real SMS).
ADMIN "How this works" TAB (first tab, readonly so the Save bar hides) — a condensed
owner guide inside /admin so Joseph never has to find OWNER-GUIDE.md. Keep the two in
step when behaviour changes.
FOOTER: index.html now credits "Made by Kellan" -> https://getkellan.com.

*** DOMAIN CUTOVER DONE 2026-07-29 (worker v 4554797a). triplerdump.com now serves THIS
worker, off Wix. ***
- Registrar is PORKBUN (not Wix). DNS was delegated to Wix (ns6/ns7.wixdns.net); NS at
  Porkbun now = grannbo.ns.cloudflare.com / ricardo.ns.cloudflare.com. ROLLBACK = paste the
  two wixdns names back at Porkbun.
- Cloudflare zone 8993d58d91137efadc828eb24ad41a41, account 5354e954..., plan Free, ACTIVE.
  GOTCHA: a new zone sits at status "initializing" and activation_check fails with 81163
  until a PLAN IS SELECTED in the UI (/select-plan). Selecting Free unblocked it -> pending
  -> active in ~1 min.
- Method: added zone, let CF import all 7 records, FORCED THEM DNS-ONLY (import defaults to
  proxied, which would have broken Wix over SSL), verified CF's NS answered byte-identically
  to Wix BEFORE flipping (nslookup against grannbo.ns.cloudflare.com). NS flip was therefore
  a no-op for visitors and mail.
- EMAIL: domain has GOOGLE WORKSPACE (MX 10 aspmx.l.google.com + SPF + google-site-
  verification TXT). All three PRESERVED through the cutover and re-verified after. Kellan
  says nobody actually uses @triplerdump.com. NOTE: if the Workspace subscription is billed
  THROUGH WIX, cancelling Wix kills the mailboxes regardless of DNS — billing, not DNS.
- Wix A records + www CNAME DELETED; both triplerdump.com and www bound as Workers custom
  domains. www IS CANONICAL (Wix redirected apex->www, so this preserves SEO); apex 301s to
  www via a Cloudflare dynamic-redirect rule (query string preserved).
- SITE_ORIGIN (wrangler.toml) AND D1 public_base_url both = https://www.triplerdump.com.
  THEY MUST ALWAYS MOVE TOGETHER.
- VERIFIED LIVE ON THE NEW DOMAIN: /, /book, /terms, /api/availability, /booked, valid SSL,
  admin 401 unauthed, apex->www 301, and a REAL booking (TRD-EWEFTJ, $376.25, cs_live
  session) — row deleted after; bookings table back to 0.
- *** TELL JOSEPH: DO NOT CANCEL WIX YET. *** Resolvers still caching the old wixdns NS
  (24h TTL) keep sending visitors to Wix's IPs; if Wix dies before those caches expire those
  visitors get nothing. Wait ~48h, confirm 1.1.1.1 and 8.8.8.8 both return the cloudflare
  NS, THEN cancel. (At cutover: 8.8.8.8 already switched, 1.1.1.1 had not.)
- STILL OUTSTANDING: roll the old exposed rk_live key in the Stripe dashboard.

FINAL PRE-CUTOVER VERIFICATION 2026-07-29 (worker v 941f0436, live). Re-ran EVERYTHING
against the deployed build after the pickup-reminder deploy. ALL GREEN:
• MONEY, live Stripe, all 4 services, exact amounts: dumpster 20yd 1-3 $376.25, trailer
  3d $645.00 + $300 deposit, junk $591.25, binswitch $215.00 — each returned a real
  cs_live_ session. All 5 test rows deleted after; bookings table = 0, paid rows = 0.
• REFUSALS all correct: weekday junk, honeypot (loud "call us"), Vegas 386 mi, past date,
  missing terms agreement.
• CAPACITY GATE proven live: 4 synthetic overlapping 20yd rows -> size_out 4/4,
  available:false, 5th booking refused; 15yd + far dates unaffected; rows removed.
• PICKUP SWEEP SQL run against LIVE schema (both new columns) — valid; extension UPDATE
  shape valid. 19/19 offline sweep asserts pass. Cron 0 16 UTC = 10:00 AM America/Denver.
• AUTH: all 6 admin POST routes 401 unauthed (incl. new /pickupdate); all admin GETs show
  the login form, never data; bad password 401.
• ASSETS: all 26 homepage refs + /book refs 200 cache-busted. deploy/index.html identical
  to root. /terms fees render 150/75-per-ton/50-per-day/200/48h/1.5%/15d.
• TEMPLATES in D1: 7 saved keys, NONE empty, no legacy {link}; the 2 new pickup keys are
  absent from D1 so they correctly fall back to code defaults (per-key merge).
• DOMAIN DEPENDENCY IS TINY: index.html uses RELATIVE links (/book), so the site works on
  any domain instantly. The ONLY hardcoded host is wrangler.toml SITE_ORIGIN (used for
  Stripe success_url/cancel_url + publicBaseUrl default; D1 public_base_url overrides the
  latter). workers.dev KEEPS serving after a custom domain is added, so a forgotten
  SITE_ORIGIN update is COSMETIC (links land on a working old-domain page), not breakage.
• Still true: no real card has ever been charged in live mode (sessions verified only),
  and no SMS has been relayed to Joseph's real phone end-to-end. 5 old June test rows sit
  in `reviews` (cosmetic, visible in admin; dedup reads bookings.review_rating).
Last updated: 2026-07-28 late (worker v 941f0436 — pickup reminders + admin polish).
NEW this pass: (1) PICKUP REMINDERS BUILT: customer text the day BEFORE pickup ("call
{phone} to extend, ${extension_day}/day") + owner text the MORNING OF each pickup, both
CMS-editable templates (pickup_reminder / owner_pickup_reminder — sms_templates is now
10 keys), dumpster+trailer only (junk/binswitch are same-day), flags
pickup_reminder_sent_at / owner_pickup_reminder_sent_at (migration 0003 APPLIED to live
D1). Same daily 16:00 UTC cron. 19-assert offline suite passed (mocked DB+fetch, zero
real SMS). (2) EXTENSION CONTROL: /admin/booking/<ref> has "Update pickup date"
(dumpster/trailer, confirmed/paid) -> POST /pickupdate updates pickup_date+rental_days,
NULLs both pickup flags (reminders re-arm for the new date), appends an audit line to
notes. Capacity stays honest (overlap uses delivery..pickup). Extra days are billed
off-session from Stripe (saved card). (3) ADMIN BUG FIX: `.cash span` CSS caught the
label's hint span too and pinned hints ON TOP of the money inputs (Extra fees tab was
unreadable) — cashField now wraps ONLY $+input in .cash with a `>` child selector.
(4) ADMIN MOBILE-FIRST pass: tabs WRAP (no more hidden tabs/scrollbar), one 520px
breakpoint stacks rows + full-width Save, cards scroll wide tables internally, row
cells bottom-anchor inputs so paired fields align even when one hint wraps. Verified by
rendering renderPanel() offline + headless screenshots (renderPanel is pure — no admin
login needed; NOTE headless Edge window-size ≠ CSS px on this machine (125% DPI), so
"overflow" in screenshots is an ARTIFACT — trust a JS probe of scrollWidth, not pixels).
Prior pass (same day, worker v 57819b23 — pre-cutover QC, read-only). VERIFIED
LIVE, all green: deployed bundle = committed source (service-area gate rejected Vegas at
386 mi; honeypot rejects loudly; reconciled fees on /terms), all 26 index.html assets 200
(cache-busted), D1 settings correct (mode=live, require_payment on, owner_phone
8015643164, GHL webhook ...b0039c7f), bookings table EMPTY, full money path smoke-tested
(POST /api/book -> pending row + cs_live session, $376.25 exact, Stripe page 200; row
TRD-YXZMF3 deleted after; NO SMS — pending sends none), /booked not-found truthful, admin
401 on bad password, secrets all 6 present, /book has zero horizontal overflow at 375px
(measured scrollWidth). D1 REST API queries WORK with the .env token (POST
/accounts/<acct>/d1/database/<db>/query) — the "MCP only" note below is outdated.
CUTOVER PREREQ FOUND: the triplerdump.com ZONE IS NOT IN THE CLOUDFLARE ACCOUNT yet —
Workers custom domains require the zone on CF, so: add zone -> flip nameservers at the
registrar (Wix) -> attach custom domain to worker -> update SITE_ORIGIN + CMS base URL
together -> redeploy -> live booking test on the new domain. 5 June test reviews still sit
in `reviews` (harmless — dedup reads bookings.review_rating — but they show in admin).
Prior pass (2026-07-27, worker v 96f1f01d — deploy-readiness). DOMAIN CUTOVER WAS
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
- SERVICE AREA (added 2026-07-28): createBooking geocodes the drop-off (Photon) and
  REFUSES residential bookings farther than `service_radius_miles` (CMS, Bins tab,
  default 60 mi from West Haven ~ the published counties; 0 = off) BEFORE any hold or
  Stripe session. Rejects only if EVERY geocode candidate is outside; fails OPEN on
  Photon errors/no-results (an outage must never block a local customer — gibberish
  still passes, Joseph triages by phone). Commercial leads NOT gated. Verified live:
  Vegas rejected at "about 391 miles", West Haven + Draper accepted, gibberish accepted.
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

## Invoicing (built 2026-07-27/28) — VERIFIED END TO END
- src/invoice.js: Stripe Invoices over REST. Draft first -> invoiceitems bound to it
  (pending_invoice_items_behavior=exclude) -> /send finalizes + emails. Confirmation is
  webhook-free: refreshInvoiceStatus() re-reads from Stripe on admin view (same idea as
  confirmPaidByRedirect). Admin: /admin/invoices, /admin/invoice/new (?booking=REF
  prefills), /admin/invoice/<id> (+ /resend, /void). Public /inv/<id> -> hosted pay page.
- TWO STRIPE PARAMS THAT DO NOT WORK ON INVOICES (each made EVERY invoice fail; found
  only by hitting the real API, not from docs):
  (1) `unit_amount` on invoiceitems -> "Did you mean unit_amount_decimal?". Use
      unit_amount_decimal WITH quantity so a line reads "2 x $75.00"; a flat `amount`
      collapses qty into one lump sum.
  (2) payment_settings[payment_method_options][card][setup_future_usage] -> "Received
      unknown parameter".
- **NO CARD ON FILE FOR INVOICED JOBS** (verified in sandbox 2026-07-28). A finalized
  send_invoice invoice has NO PaymentIntent until the customer goes to pay, so
  setup_future_usage cannot be set after the fact either. Checkout keeps a card
  (stripe.js), invoices do NOT. Joseph bills overages/damage on an invoiced job by
  sending a SECOND invoice, or takes a deposit up front. Do not tell him otherwise.
- Stripe KEY PERMISSIONS: invoicing needs Customers + Invoices + Billable Items = Write.
  Checkout never needed them because customer_creation=always makes the Customer for you.
  LIVE key "TRD Worker live" (...nWYn) HAS them. The restricted TEST key (...9jaJ) does
  NOT — worker/.dev.vars now holds a plain `sk_test_` secret key instead (full access,
  test mode only). That key was pasted in chat, so roll it when convenient.
- Fees/terms: every $ amount on /terms renders from S.fees (CMS-editable). Joseph's
  original text quoted TWO prices for the same four fees; reconciled to dry run $150,
  overweight $75/ton, extension $50/day, cancellation $150, plus a NEW late fee of
  1.5%/month after 15 days. Editing a fee rewrites every place it appears.
- Admin CMS is TABBED (9 tabs) as of 2026-07-28, all inside ONE form — a form per tab
  would blank every setting not submitted, since saveSettings writes each key
  unconditionally. Panels are visible in the HTML and JS only ever HIDES them, so no-JS
  degrades to the old long page instead of a blank screen.

## Not done / blocked (next session)
- Review FOLLOW-UPS: initial + 3 at +24h/+24h/+48h then abandon. Needs a `review_followups`
  col + the review cron rewritten to advance the cadence (and cron freq -> hourly; it's daily
  16:00 now). Stop on rating or after 3.
- [DONE 2026-07-28] PICKUP reminder (client + owner) — built + deployed, see header.
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
