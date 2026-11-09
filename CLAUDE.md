*** PAY-BY-THE-TON BIN + CREDIT BEFORE TAX 2026-11-09 night (worker v d5466b58 via deploy.mjs, previous 7ac0f5de, checkout probe OK;
    previews back OFF; console = trykellan Pages deployment a9e06929) ***
- Joseph's text: "$250 any size seven-day rental ... they pay their own way at $65 a ton, no tonnage is included". Boston: "idk
  u pick" on the open points, so it behaves like a normal bin: tax on the rental and on the tons, usual extra-day fee, promo
  and fuel as normal. settings.js S.payByTon {on, cents, tonCents} (D1 key pay_by_ton, NOT written yet, default serves;
  /admin Extra fees tab "Pay-by-the-ton bin"). loadSettings adds a third tier "ton" (maxDays = the 4-7 tier's) and
  bins[size].prices.ton AFTER D1's bins, so holds, capacity, calendar and Checkout are the normal path. bookings.rental_tier = 'ton'.
- /book: third length card, "Dump fee included" lines swap to "Tons billed after pickup" (data-dump). Stripe line "15-Yd Bin | 7 Day
  Rental | Tons Billed After Pickup" (no prod_ id, uses the name fallback). /terms Weight Limits sentence, Last updated Nov 9.
  Marketing pages NOT changed (still lead with the tons-included prices).
- Console: real-data rec.tonRate (cents, CURRENT setting, not frozen at booking); weigh-and-bill requires the tons, bills tons x rate
  + tax by invoice (`inv`), the card is not charged. A DRIVER finishing one gets a 403 on the invoice (owners only). Phone bookings
  can't pick this tier yet.
- CREDIT BEFORE TAX: New invoice + weigh-and-bill forms now match totalsFor (Boston: "u pick", that's what customers are billed);
  a credit bigger than the charges is refused on New invoice. Resolves the KNOWN MISMATCH in the entry below.
- npm test 105/105 (test/pay-by-ton.test.mjs). LIVE: real /api/book tier ton -> cs_live session $268.75 ($250 + $18.75 tax), 7 days,
  hold released + row deleted; /book + /terms show $65. Weigh-and-bill checked in the sample console by forcing the rate in a
  throwaway build (3.2 t = $208 + $15.60 = $223.60; refused without a weight). Live console not opened (sign-in).

*** EDIT A SENT INVOICE + NOTICE 2026-11-09 later (worker v 7ac0f5de via deploy.mjs, previous 3066ba65, checkout probe OK;
    previews back OFF; console = trykellan Pages deployment e89a7673) -- SUPERSEDES the job-only route in the entry below ***
- Boston: "make more configurable", and if the customer needs a notice: "hey name your invoice has been edited, <note>"
  (e.g. Joseph put the wrong price). invoice.js editInvoice replaces setInvoiceJobRef: job, items, taxable, due_date, notify,
  note. Same Stripe revision + row-first order. When lines change: delete the draft's copied invoice items (line.parent.
  invoice_item_details.invoice_item), re-add via addChargeLines (shared with createInvoice), tax redone with totalsFor; if
  Stripe's total isn't what Joseph was shown the draft is deleted. Unchanged lines are left alone (no re-tax). New due date
  moves final_notice_date (due + invoiceFinalNoticeDays) unless already sent.
- notify on: Stripe emails the new invoice, template invoice_edited texts the customer ({note} + usual invoice tokens,
  /admin Texts tab "Invoice edited", tpl_invoice_edited wired into saveSettings); the note also prints as the invoice memo
  (Stripe description). notify off: nothing goes out, memo cleared.
- POST /api/console/invoice/<id>/edit (owners; /job is gone). Console: row shows "Job: ..." + one "Edit"; opens the New
  invoice sheet in edit mode (iv.edit): job, due date, chips, lines, tax, totals, "Let them know it changed" + note + preview.
- Edit-mode totals take the credit BEFORE tax (matches totalsFor). KNOWN MISMATCH, not touched: the New invoice sheet shows
  tax on the gross and the credit after tax, but createInvoice bills tax on the net, so a new invoice with a scrap credit
  can bill a different total than the sheet showed.
- npm test 100/100 (test/invoice-edit.test.mjs). Real editInvoice run on Stripe SANDBOX (price + added line + job + due + note;
  clear job silently; tax off; PDF checked); sample console at 375 px. NOT run on a live invoice; live console not opened.

*** JOB LINE ON A SENT INVOICE 2026-11-09 (worker v 3066ba65 via deploy.mjs, previous a1603fbe, checkout probe OK; previews
    back OFF; console = trykellan Pages deployment 94241a73) ***
- Joseph: "editing invoices that I've already sent that I forgot to put the job number on". Stripe refuses every edit to a
  finalized invoice except metadata ("Finalized invoices can't be updated in this way", sandbox-tested custom_fields,
  description, footer). invoice.js setInvoiceJobRef = Stripe's REVISION: from_invoice action=revision, set custom_fields +
  due_date on the draft, repoint the D1 row at the draft (so the original's invoice.voided webhook finds no row), finalize
  (Stripe voids the original), save number/hosted_url/pdf_url/job_ref, then /send emails it. Same D1 row, so /inv/<id>,
  late texts and final notice carry on. Number goes -0001 -> -0002. Paid/void refused. Total mismatch or failed finalize
  = draft deleted, nothing changed. A revision drops the due date and Stripe refuses a past one, so an OVERDUE invoice
  prints due tomorrow; D1 due_date is untouched.
- POST /api/console/invoice/<id>/job {job_ref} (owners). Console: customer card > Invoices you've sent > "Add" / "Change"
  beside the job line on unpaid rows (restyled same day at Boston's ask, Pages cc565ff0; each action sits beside its line; the
  phone CSS forces 44 px on every button, so the links use negative margins); the box says it replaces the invoice and
  emails a new one. Not on /admin.
- npm test 97/97. Real run of setInvoiceJobRef on Stripe SANDBOX (due in future + overdue; PDF shows the job line); sample
  console at 375 px. NOT run on a live invoice (it emails a real customer); live console not opened (sign-in).
- Pages deploy: run wrangler WITHOUT the .env token (that token gets auth error 10000 on Pages; wrangler's own login works).

*** SEO BIBLE FIXES 2026-11-07 night (worker v 748b5e70 then a1603fbe via deploy.mjs, previous 3e6eff8c, checkout probe
    OK both; previews back OFF) ***
- Boston: "fix those" (the bible gaps), skip the top-menu one. His picks: retire Springville only; WAIT on moving the other
  15 city URLs until Ogden shows results (3-4 weeks).
  1) SPRINGVILLE PAGE RETIRED (75 mi, past the bible's 50-mile line for city pages without a real location). Removed from
     KEPT_CITIES (build_pages.py) + CITY_PAGES (agents.js); marketing.js RETIRED_CITIES has it, so /service-area/springville/
     301s to /service-area/. We STILL DELIVER there (radius, fuel, "as far south as Springville" wording unchanged). Its
     job photo stays in the hub strip as an unlinked card (jobs_strip: retired = <div>); homepage city list shows it as a
     <span>; homepage JSON-LD keeps the City without a url. Logan (~39 mi) + Cottonwood Heights (~43 mi) stay. 15 city pages.
  2) FAQPage JSON-LD REMOVED sitewide (faq_ld gone; FAQs stay as visible text). Tests now read the visible FAQ <h3>s.
  3) GUIDES: the answer (g["lead"]) is now the hero text right under the H1 (was the meta description); the duplicate
     answer box below the hero is gone.
  4) TITLES = keyword | benefit | brand where it fits 60: cities "Dumpster Rental Roy, UT | From $320 | Triple R Dump"
     (Cottonwood Heights falls back unbranded), sizes "15 Yard Dumpster Rental Ogden, UT | $320 | Triple R Dump", junk
     "Junk Removal Ogden & Roy, UT | $550 Flat | Triple R Dump", trailer "Dump Trailer Rental Ogden, UT | $200/Day | Triple
     R Dump", swap-out "Dumpster Swap-Out Ogden | $220 Bin Switch | Triple R Dump". (West Haven dropped from the junk +
     trailer titles to fit; "Dump Fee Included" dropped from city titles, still in the descriptions and on the page.)
  NOT FIXABLE BY US: 9 city pages without a job photo; needs Joseph's real photos from Ogden, Layton, Syracuse, Hooper,
  Plain City, Clearfield, West Haven, Tremonton, Logan (never reuse another city's photo).
- npm test 91/91. Live re-scan: 36 sitemap pages 200, 0 problems, 0 broken links/assets.

*** OGDEN PAGE MOVED + HOMEPAGE STOPS COMPETING 2026-11-07 later (worker v 3e6eff8c via deploy.mjs, previous 0bd53027,
    checkout probe OK; previews back OFF) ***
- Boston: in GSC "dumpster rental ogden" shows the HOMEPAGE most, /service-area/ogden/ second (cannibalization: the
  homepage title led with "Dumpster Rental Ogden"; the Ogden page's 36 inlinks were nearly all the bare word "Ogden").
  He OK'd all three fixes:
  1) Ogden page now /dumpster-rental/ogden/ (slug = the phrase, nested under the dumpster-rental hub; breadcrumb Home >
     Dumpster rental > Ogden). build_pages.py CITY_PATH/city_url()/city_crumbs(); agents.js CITY_MOVED/cityPath()
     (llms.txt); marketing.js marketingRedirect 301s /service-area/ogden(/) there (query kept). Old folder deleted (repo +
     deploy/). Share card copied to assets/og/dumpster-rental-ogden.jpg (build_og.py regex takes either prefix).
     ONLY Ogden moved on purpose (bible: one page at a time). If it climbs in 3-4 weeks, add Roy/Layton/... to CITY_PATH +
     CITY_MOVED (keep both in step; a test checks no page links the old Ogden URL).
  2) Homepage title "Dumpster Rental West Haven, Ogden & Roy, UT | Triple R Dump" (+ og:title); H1 "Ogden" and "Roy" are
     now links to their pages (pages.css .hero h1 a: inherit colour, faint underline). Size-page H1s link "Ogden" too.
  3) Junk-removal guide line now links "dumpster rental in Ogden". City "Also serving" links were already keyword anchors.
- npm test 91/91 (tests updated: homepage title/markdown H1, Ogden paths, new redirect asserts). Verified live: old URL 301
  (with and without slash), canonical + breadcrumb + sitemap + llms.txt on the new URL. TODO Boston: GSC URL inspection >
  Request indexing for https://www.triplerdump.com/dumpster-rental/ogden/ (GSC MCP still has no credentials).

*** SEO BIBLE SCAN 2026-11-07 (worker v 0bd53027 via deploy.mjs, previous 71986913, checkout probe OK; previews back OFF) ***
- Boston: "scan website thru the seo bible" (Desktop/kellan roll off/docs/seo-bible.md, Edward Sturm rules). Crawled all
  37 sitemap URLs. PASSING: keyword-first titles/H1s, 0 em dashes, FAQs written out (no accordions), real photos, prices
  on every page, phone by every button, footer links every money page (35 inlinks), robots + sitemap clean, AI crawlers
  allowed, TTFB ~0.1 s, (c) 2026, city main copy 48-69% similar (no pure name swaps).
- FIXED (bible rule: search phrase starts the first sentence): city ledes now "Dumpster rental in Roy, UT, from our family
  yard in West Haven, about 5 minutes away: ..."; size ledes "15 yard dumpster rental: ..."; junk/trailer/swap-out ledes
  start with their phrase. /book bin photos got alt text. Only those lines changed (31 lines); HTML copied into deploy/.
- NOT done on purpose: slug changes (/service-area/roy/ lacks "dumpster-rental") and title rewrites, because the bible
  says hold big changes ~3 months after the Oct 22-27 Maps proximity swing. GSC MCP has no credentials
  (~/.claude/gsc/service-account.json missing), so the query-mining steps (sections 4/7/19) were not run.
- GAPS for later: no "Triple R Dump reviews" page (/reviews/ 301s to /#reviews); no scenario pages (roofing tear-off,
  estate cleanout, contractors); 9 of 16 city pages have no job photo; Logan/Springville/Cottonwood Heights are 45-75 min
  out (bible: far cities need a real location to rank in Maps; organic only).

*** LAST-REMINDER LINE ON UNPAID INVOICES 2026-11-06 (console only: trykellan Pages deployment 1e336f3f, previous a0659164;
    trykellan commit ab0e368, no remote; worker unchanged) ***
- Joseph asked (via Boston) for a "last notified" indicator on the console's Unpaid invoices list. Each row now has a third
  line: "Last reminder 27 hours ago (2 of 5) · next Sun 10 AM", "No reminder yet · first one Wed 10 AM", "Last reminder 19
  days ago · all 5 sent, no more", "No mobile number, so no reminder texts", "Final notice texted <date>", or "reminder
  texts are off". real-data.js now selects overdue_reminders_sent / overdue_last_sent_at / overdue_owner_alerted_at and the
  invoice_reminder_* settings (data.ivRemind); console remindOf() mirrors invoice.js runInvoiceOverdueReminders (10 AM,
  day after due, every-2 h slack, max then stop). Checked locally against LIVE D1 (read-only) at 375 px; live console is
  behind sign-in so not opened. Same commit also checks in the trykellan work deployed 10/27-10/30 but never committed.
- SAME NIGHT, NO MORE 5-TEXT STOP (worker v 71986913 via deploy.mjs, previous b736eff5, checkout probe OK; previews back
  OFF; console Pages 1c6ee257). Boston: "Remove the 5 text limit". runInvoiceOverdueReminders texts every 48 h until paid;
  invoice_reminder_max (still 5, Admin "Tell me after") now = when Joseph gets his ONE "worth a call" text, right after
  that text goes out. Query excludes overdue_owner_alerted_at only when there's no phone, so Ray Epps (alerted 10/20 under
  the old stop) gets text 6 at the next 10 AM tick (11/07) with no second owner text; no D1 write needed.
  test/invoice-overdue.test.mjs (npm test 91/91). Console line: "Last reminder 19 days ago (5 sent) · next one tomorrow
  10 AM" (amber once past 5). OWNER-GUIDE + HOW-IT-WORKS updated.

*** SHARE CARDS RESTYLED 2026-11-04 (worker v b736eff5 via deploy.mjs, previous 7b319ed3, checkout probe OK; previews back OFF) ***
- Boston sent a competitor's card (3DA Dumpsters) and said "do this style". build_og.py now: page photo FULL BLEED under a
  left-dark gradient, badge + wordmark top left, blue pin + location line (city pages "Roy, UT · Weber County", COUNTY map),
  two-line headline (grey "Dumpster rental," / white promise, COPY dict per page), bottom row = blue phone button + gold
  stars + Google G + "5.0 on Google · 29 reviews · Book online any hour". The quote card + hazard tape are GONE. Still no
  prices on the image. Same re-run rule (python build_og.py, copy assets/og/*.jpg into deploy/assets/og, deploy).
  NOT in this entry's scope: the entry below describes the older v3 layout.

*** BRANDED SHARE CARDS (og:image) 2026-11-03 (worker v e552157a; v2 reviews 5e4f8b88; v3 badge + real G 7b319ed3; previous ddd34dc2, checkout probe OK;
    previews back OFF) ***
- Boston ran a share-preview checker on the homepage: photo was 1600x1200 (wrong ratio, cropped), no headline/CTA,
  og:description 152 ch, title "63" ch. Now every page has its own 1200x630 card in assets/og/<slug>.jpg (36 + home):
  navy panel with logo, headline (city/size line in blue), GOOGLE PROOF (big "5.0" + gold stars + "29 Google reviews",
  read from the LIVE homepage when build_og.py runs), "Book at triplerdump.com" + 801-564-3164; the page's photo in its
  own diagonal panel; a white Google-review card on the photo's sky with a VERBATIM 5-star quote that fits the page
  (QUOTES / QUOTE_FOR: Nadine's wooden-beams-driveway quote on home, Clayton's 15->20 switch on size pages, Lee's
  every-day swaps on bin switch/junk). Home photo = Joseph with a 25 yd bin. Logo lockup top-left = Joseph's ROUND BADGE (the real logo: _archive/logo.png, 849 px; same art as assets/apple-touch-icon.png; it's AI-made with typos inside the bin, invisible at card size) + the stencil wordmark + 'Family owned & operated'. Google mark = Google's official 4-colour G (inline SVG), on a white chip on navy. Hazard tape along the bottom. NO prices
  (they change from the console). RE-RUN build_og.py (+ copy assets/og/*.jpg into deploy/, deploy) when the review
  count has grown noticeably; an old count only understates. og:image:width/height/alt added.
- build_og.py renders them with headless Edge (site fonts via Google Fonts, 16 cards per screenshot, cut with PIL).
  build_pages.py writes assets/og/cards.json and uses a card only once its file exists. After a title/photo change:
  python build_pages.py && python build_og.py && python build_pages.py. build_deploy.py copies assets/og/*.jpg as-is
  (no recompression; og:image is an absolute URL its scanner can't see). Per-service facts / odd titles: FACTS, LINES.
- Homepage: og:description shortened (~100 ch); title + og:title use a bare "&" (valid HTML5; checkers counted &amp;
  as 5 chars -> "63", real length 59). /social/ (bio.triplerdump.com) had NO share tags at all; now has them + home card.
- Tests updated (agents + seo), npm test 88/88. Changed HTML + cards copied into deploy/ (build_deploy.py NOT re-run).
  Verified live: tags on /, card URLs 200 image/jpeg, Roy/15yd/guide pages point at their cards, bio page too.

*** STRIPE WEBHOOK LIVE 2026-11-03 (worker v ddd34dc2 via deploy.mjs, previous 1428b51b, checkout probe OK; previews back OFF) ***
- Why: Joseph saw Ray White Roofing (Trevor Hansen) invoices IFDQ3KBA $909.99 + TNOBJDPD $400.71 as unpaid at 4:54 PM;
  Trevor had paid at 4:37/4:39 and the hourly sweep flipped them at 5:00. Invoices now flip within seconds.
- Stripe endpoint we_1UXrmJC5darb2tzHTVO9mMXE (live, created via API with the .env current-stripe-api key; that key CAN
  write webhook_endpoints) -> https://www.triplerdump.com/api/stripe-webhook, events invoice.paid, invoice.voided,
  invoice.marked_uncollectible, checkout.session.completed, checkout.session.async_payment_succeeded.
  Signing secret = worker secret STRIPE_WEBHOOK_SECRET_LIVE (9 secrets now; copy in ../.env stripe-webhook-secret-live).
  deploy.mjs REQUIRES it now + smoke-checks POST /api/stripe-webhook unsigned -> 400.
- stripe.js: invoice events look up invoices.stripe_invoice_id and run refreshInvoiceStatus (re-reads Stripe; the event
  is only a nudge, so a forged/stale "paid" can't mark anything). markPaid now CLAIMS the row (UPDATE ... AND paid_at
  IS NULL) so webhook + /booked redirect racing send one confirmation. verifyStripeSig accepts multiple v1 (secret roll).
  The hourly sweepInvoices + /booked redirect stay as backups. test/stripe-webhook.test.mjs (npm test 88/88).
- Verified live: signed invoice.paid for an already-paid invoice -> 200, no duplicate text; wrong secret -> 400; a real
  Stripe event (a $1 no-email charge_automatically invoice, finalized + voided, customer deleted after) delivered with
  pending_webhooks 0. A voided $1 invoice in_1UXrpYC5darb2tzHJUgCkUQd remains in Stripe's history (harmless).
- To turn it off: disable the endpoint in Stripe (Developers > Webhooks); everything falls back to the hourly check.
- NOT COMMITTED. admin.js guide tab still says invoice texts come "within the hour" (still true; not redeployed for it).

*** SITE COPY STATES THE FUEL CHARGE 2026-10-31 (worker v 1428b51b via deploy.mjs, previous 98f48ffe, checkout probe OK;
    previews back OFF) — fixes the OPEN marketing-copy note below ***
- The pages promised no drive charge ("no fuel surcharge", Springville "the drive is on us", Logan "Do you charge extra
  ... No.", "Same price everywhere") while bookings past 30 mi carry one. Now the copy comes from live settings:
  marketing.js tokens {{TRD:fuel_note}} (how it works, fuelWords; "Delivery is included anywhere we deliver." when off)
  and {{TRD:fuel_<town>}} (fuel_logan, fuel_plain_city: booking.js townFuel = PLACES town center miles + fuelFor, the
  same answer a booking ending in that town gets without a street match). index.html uses <span data-trd-text="fuel_note">
  (baked fallback). Every city page's "Same bin prices as West Haven" line carries its town token; far-town FAQs too.
  "same prices" -> "same bin prices" for far towns; hub/meta "Same price everywhere" -> "One price per bin".
- Live: Springville 75 mi ~$85 (a street address there reads 78 mi $88, hence "about" + "the booking page shows the
  exact amount"), Logan 39 $49, Tremonton 36 $46, Cottonwood Heights 43 $53, Roy/near towns "no fuel charge".
- test/fuel-copy.test.mjs (npm test 81/81). Changed HTML copied into deploy/ (build_deploy.py NOT re-run). NOT COMMITTED.
- Homepage hero "One price covers up to 7 days, delivery, pickup and the dump fee" left as is (true inside 30 mi; the
  rates section right under it now states the fuel charge).

*** FUEL STARTING CHARGE 2026-10-30 night (worker v 98f48ffe via deploy.mjs, previous b36fbcb5, checkout probe OK;
    previews back OFF; console = trykellan Pages deployment a0659164) — SUPERSEDES the $ math in the entry below ***
- Joseph: "if someone lives 31 miles, it's gonna charge them one dollar extra ... There should be a $40 up charge plus
  a dollar a mile after that". S.fuelMile = {free 30, base 4000, cents 100}: past the free miles it's base + (rounded
  miles - free) x cents. 31 mi $41, 33 mi $43, 48 mi $58, 70 mi $80. Label "Fuel charge ($40 + 18 miles × $1)" (base
  only: "Fuel charge (past 30 miles)"). settings.js fuelWords(S) = the customer wording, used by /book ("Farther out, we
  still come to you: a $40 fuel charge plus $1 for every mile past 30 (straight-line miles).") and llms.txt.
- D1 fuel_per_mile still NOT written (default serves). A saved row without `base` reads as the $40 default; console-api
  /settings stores no base when an old console tab omits it, so an old tab can't zero it. base $0-$500.
- Console Setup > Where you deliver: new "Starting charge $[40]" row under the two ring rows; example line shows
  "$65 ($40 + 25 × $1)"; town list "32 mi · $42". real-data.js fuelMi has base. npm test 77/77; sample console
  checked (desktop + 375px, no overflow); live /api/fuel: Draper 48 mi $58, Provo 70 mi $80, Roy none.

*** FUEL CHARGE BY THE MILE 2026-10-30 later (worker v b36fbcb5 via deploy.mjs, previous 3d181c30, checkout probe OK;
    previews back OFF; console = trykellan Pages deployment 7bd8155f) ***
- Boston proposed "30 miles included and every mile past is an extra 1-5 dollars"; Joseph: "So I guess $1 a mile
  should work right?" The flat rings ($80 past 30, $120 past 60) are GONE. settings.js S.fuelMile {free, cents}
  (default {30, 100}; D1 key fuel_per_mile, NOT written yet, so the default serves; cents 0 = off; fuelOn(S)).
  fuelFor = (Math.round(miles) - free) x cents, on the rounded miles the customer sees; label "Fuel charge (18 miles
  × $1)" (Stripe line / invoice line). D1 fuel_zones still holds the old rings but nothing reads it.
- /book hint: "...Farther out, we still come to you for $1 a mile past 30 (straight-line miles), to cover fuel."
  llms.txt says it too. console-api /settings takes fuelMile {free 0-300, rate $0-$25/mi} -> fuel_per_mile; the old
  `fuel` rings payload is ignored. real-data.js returns fuelMi {free, rate} (null = default).
- Console Setup > Where you deliver: row 1 = free miles (-/+5, "Free"), row 2 = delivery limit (-/+5) + "$ [1] /mi";
  map draws the free ring + the limit; town list shows each town's charge ("39 mi · $9"); example line. Take a booking
  sample math matches; fuel amounts show cents ($13.50). sitePatch sends fuelMile on every save.
- Live checked: Draper 48 mi $18, Provo 70 mi $40, Roy 3 mi none; /book + llms.txt wording. npm test 77/77.
- FIXED 10/31 (entry at the top), was OPEN (marketing copy): several pages still promised no drive charge: guides_content.py cost guide "no
  fuel surcharge", build_pages.py Springville FAQ "the drive is on us" and Logan FAQ "Do you charge extra to come over
  the canyon? No.", plus "delivery included" lines everywhere. Wrong since the 10/27 fuel zones.

*** FUEL CHARGE ON CONSOLE PHONE BOOKINGS 2026-10-30 (worker v 3d181c30 via deploy.mjs, previous a2e138bc, checkout
    probe OK; previews back OFF; console = trykellan Pages deployment f4bedc41) ***
- Joseph's text: "When I book the appointment it doesn't add the fuel charge for addresses farther than 30 miles".
  It skipped S.ownerBooking on purpose (10/27 note below). Now booking.js charges it on console bookings too, same
  fuelFor/milesFromYard as /book; input.no_fuel === true waives it, honored ONLY when S.ownerBooking. A custom
  price_cents replaces the rental; fuel + extras + tax still go on top. Owner bookings also skip the radius refusal
  now (the console already told him "You can still take it"); past the radius they get the farthest ring.
  Pay-link invoices already itemize bk.addons, so fuel is its own invoice line.
- New POST /api/console/fuel {address} (owners) -> fuelQuote(S, address, owner=true). trykellan _middleware.js
  LIVE_PATH fuel:"fuel". Console "Take a booking": componentDidUpdate asks it 700 ms after the address/town stop
  changing (same "addr, town, UT" string the booking sends, so same cached answer); a row under "Price for this job"
  ("About 48 miles from the yard, so the $80 fuel charge goes on" + "No fuel charge"/"Add it back"); total and
  summary include it; sends no_fuel. Sample console prices it from the town (TOWNLL + its fuel rings).
- test/console-fuel.test.mjs (npm test 74/74). Sample console checked: SLC 32 mi -> $489.13, waived $403.13,
  custom $280 -> $387.00. Live console not opened (sign-in); live /api/console/fuel without key = 401.
- Seen live 10/30: D1 service_radius_miles is 80 (was 88 on 10/27), presumably a console Setup save. Not touched.
- OWNER-GUIDE.md section 5 updated. NOT COMMITTED (either repo).

*** JOB / WORK ORDER LINE ON INVOICES 2026-10-30 (worker v a2e138bc via deploy.mjs, previous eb924674, checkout probe OK;
    previews back OFF; console = trykellan Pages deployment 6ca4ff0a; D1 migration 0013 applied) ***
- Joseph's text: Utah Roofing Consultants (contract) want a job / work order number on each invoice = the homeowner's
  last name + address, so they know which house a bill is for. createInvoice takes data.job_ref -> Stripe invoice
  custom_fields[0] {name "Job / Work order", value <=140, one line (jobRefOf)}: prints in the PDF header (verified on a
  sandbox invoice, voided after) + pay page. Stored in invoices.job_ref (0013, NULL on the 40 older rows).
- /admin New invoice: "Job / Work order #" box (name job_ref); detail row; list shows it under the customer; search
  matches it. Console (_src-console.dc.html): box on New invoice (iv.job, kept through "Change") and on "weigh and
  bill" when it sends an invoice (finJob); POST /api/console/invoice passes job_ref; real-data.js selects job_ref ->
  customer card "Invoices you've sent" shows "Job: ...". NOT on the contract monthly bill (that's a monthly roll-up).
- test/job-ref.test.mjs (npm test 66/66). Console build diff = those lines only (console + sample index). Live console
  view not opened (sign-in); its invoice SELECT was run on live D1 OK. OWNER-GUIDE.md updated. NOT COMMITTED (either repo).
- SAME DAY, BIN SWITCH DAY ON INVOICES (console only, Pages deployment 861f7abb; worker unchanged): Joseph: "if I invoice
  somebody for a bin switch, we can put what day we're gonna do the bin switch". Console New invoice: the "+ Bin switch"
  chip's line has a "Switch day" date box (required to send), prefilled with the customer's next switch already booked
  from the job (their "Bin switch" jobs or swapsOf, >= today). The line goes to Stripe as "Bin switch · Wed Nov 4"
  (lineLabel). Only the chip's line; a typed "Bin switch" line has no box. /admin lines are free text (type the day).
  Tested in the sample console: refused without a day, prefill from a logged swap, sent line on the customer card.
- SAME DAY, UNPAID INVOICES ON THE CONSOLE HOME (console only, Pages deployment 7da40ae1; worker unchanged): Joseph: "How
  do I see invoices that still need to be paid?" (before: only Customers > "Owe you", per customer, or /admin/invoices,
  paid + unpaid mixed). Today screen, last section, owner only (DRIVER sees nothing): "Unpaid invoices N", "$X waiting ·
  N overdue", one row per unpaid invoice (S.invoices !paid; real-data = D1 status 'sent', the hourly sweep keeps it
  fresh), soonest due first, "Overdue N days" in red / "Due Fri Nov 6"; tap = that customer's card. An invoice just sent
  from the console has no due until reload, so it counts date + 14 (same as the card). Empty = "Every invoice is paid."
  Tested in the sample console (overdue first, paid one left out, tap-through, empty state, 375px no overflow).

*** TERMS SECTION 6: REPEAT + INVOICED CUSTOMERS 2026-10-29 night (worker v eb924674 via deploy.mjs, previous ba36bc88;
    previews back OFF) ***
- Joseph: "if you have ordered from us before and are using a post-invoice type of payment ... automatically assume all
  risk ... putting the dumpster on their driveway or in their grass". terms.js: new "6. Repeat Customers and Invoiced
  Orders" (terms carry over to every later order however placed/paid; customer assumes the section 4 + Property Damage &
  Placement risk) and "Last updated October 29, 2026" under the title. Goes forward only: it can't reach an incident
  before 10/29 (Joseph hinted at one). Verified live on /terms. NOT COMMITTED.

*** FINAL NOTICE TEXT ON UNPAID INVOICES 2026-10-29 (worker v ba36bc88 via deploy.mjs, previous a1079aac; previews back OFF;
    console = trykellan Pages deployment 4e13cae9; D1 migration 0012 applied) ***
- Joseph (10/29, Ray Epps owes $1,181.30 on TRD-INV-57M9N9, due 10/9, all 5 late texts sent): one text 60 days past due
  saying small claims is next. "60 days from now" for invoices already unpaid -> 0012 set final_notice_date 2026-12-28 on
  every status='sent' row (only Ray's). New invoices: createInvoice stores due + S.invoiceFinalNoticeDays (60).
- Daily at the reminder hour (cron.js) runInvoiceFinalNotices: re-checks Stripe, claims final_notice_sent_at, texts
  templates.invoice_final, owner copy owner_invoice_final; failed send releases the claim. Needs a phone. Wording claims
  only what /terms backs: 1.5%/mo late charge + collection costs, plus court costs. No attorney fees (not in his terms).
- Console: customer card > "Invoices you've sent" shows "Final notice texts Ray Mon Dec 28 · Don't send" (POST
  /api/console/invoice/<id>/notice {on}; setFinalNotice). Templates editable in /admin. test/final-notice.test.mjs (61/61).
  The live on/off switch was NOT clicked (would write his data); route covered by tests + sample console. NOT COMMITTED.

*** JOSEPH'S OWN PRICE ON PHONE BOOKINGS 2026-10-27 evening (worker v a1079aac via deploy.mjs, checkout probe OK, previews
    back OFF; console = trykellan Pages deployment 9046ffc6) ***
- Joseph's text: concrete-only job is $220 + $60 dump, "when I do a booking I can change the price myself but if anyone else
  does they can't". Console "Take a booking" has a "Price for this job" box ($, before tax; blank = price list, shown as
  the placeholder). It sends price_cents to /api/console/book; booking.js createBooking honors it ONLY when S.ownerBooking
  (console-api.js), so /api/book ignores it. It replaces the rental incl. extra days; add-ons + tax still on top; $0-$10,000.
  The booking gets a note "Custom price $280.00 before tax (price list $375.00)"; console_log detail has price_cents.
  test/price.test.mjs (npm test 56/56). Console source: Desktop/Kellan systems/trykellan-demo/_src-console.dc.html
  (nbPrice*, nbCustomCents); rebuilt with _build-apps.js + _dist.js only (dist diff = console + sample index only).
  The installed app ("Triple R Dashboard") has no cache (console/sw.js), so it shows on next open. NOT COMMITTED (either repo).

*** FUEL RINGS EDITABLE FROM THE CONSOLE 2026-10-27 (worker v 3ff28dd3 via deploy.mjs; previews back OFF) ***
- console-api.js /settings takes { fuel: [{over, price}] } -> D1 fuel_zones [{over, cents}] (rings must grow outward,
  $0-$1,000). The console (trykellan Setup > Where you deliver) shows three rings: free out to 30, $80 out to 60, $120
  out to the radius (88), each with -/+ 5 mi and a $ box; it sends fuel + radius on every save. Until the first save
  D1 has no fuel_zones and settings.js's default (the same rings) applies.
- /book wording: "Delivery's included within 30 miles of our yard in West Haven. Farther out, we still come to you
  with a flat fuel charge for the drive: $80 up to 60 miles, $120 past 60." then "Good news, we deliver out your way!
  You're about 48 miles from our yard, so we add $80 for fuel." Tested on the D1 copy: save, reprice, bad order refused.
- NOT COMMITTED.

*** FUEL CHARGE ZONES LIVE 2026-10-27 (worker v 0672ca53 via deploy.mjs; preview + live checks OK; previews back OFF) ***
- Joseph asked (text to Boston): zones by distance, charged automatically at booking. Green within 30 miles of the
  yard = none, yellow 30-60 = $80, red 60 to the radius (88 live) = $120. Bins, junk removal and bin switches booked
  ONLINE; not trailers (renter tows) or console phone bookings (S.ownerBooking). settings.js S.fuelZones (code
  default; D1 key fuel_zones overrides, [] = off) + fuelFor(); taxed like the rental; a promo never discounts it.
- It's its own line: stored in bookings.addons as {k:"fuel"}, so Stripe Checkout shows "Fuel charge (30–60 miles)"
  (verified on a sandbox session: bin, fuel, tax, promo all right). stripe.js trailer line now subtracts add-on lines.
- Distance (booking.js milesFromYard), straight-line miles like the radius: 1) Census geocoder street match, kept
  only in UT and when the typed town agrees (it fuzzy-matched Huntsville -> Hanksville); 2) else the town the address
  ends with, src/places.js (180 Utah places within 100 mi, Census 2024 Gazetteer); 3) else no fuel charge and the
  radius check falls back to Photon's closest candidate (old rule). Photon alone was wrong (Logan -> Centerville,
  Springville -> Logan, Huntsville -> Goshen 87 mi, St George -> Kaysville). Cached a day (Cache API /__cache/miles2).
- /book: GET /api/fuel?address= prices the address as they type; note under the address ("No fuel charge within 30
  miles... 30–60 miles: $80. Over 60: $120." then "About 48 miles from our West Haven yard: $80 fuel charge added."),
  a summary row, totals. llms.txt says it too. test/fuel.test.mjs (npm test 52/52).
- Checked live: Draper 48 mi $80, Provo 70 mi $120, Roy 3 mi none, Huntsville 15 mi none, St George refused.
- Same day: delivery radius 85 -> 88 (Joseph's text: "our range all the way up to 88 miles"; D1 settings
  service_radius_miles, written directly). Red zone label now "Fuel charge (60–88 miles)"; Santaquin (86 mi) books.
  The console resends its radius on every settings save, so a console tab opened before this could write 85 back.
- NOT shown yet on the Pull Count console job view (real-data.js folds it into the bin price; total is right).
- NOT COMMITTED.

*** PULL COUNT CONSOLE PHASE 2 LIVE 2026-10-27 (worker v cbde574c, then v 0649e245 with contracts, both via deploy.mjs; previews back OFF) ***
- The console now EDITS HIS SITE: POST /api/console/settings writes bins (one price both tiers, inventory, hidden,
  blurb), fees (extensionDay, tonsNN), services.binswitch, addons, included_days, service_radius_miles, run_days,
  lead_hours, same_day_cutoff, closed_dates, daily_runs, ground_conditions, debris_list, sms_templates, sms_off,
  review_off, review_link. ALL OPTIONAL: unset = the old behavior. settings.js loads them; booking.js obeys them
  (earliestDate, dateOpen, dayFull, hidden sizes, add-ons priced + taxed, ownerBooking); page.js shows them
  (add-on checkboxes, "What's going in it?", calendar rules); stripe.js adds add-on lines; reminders.js/sms honor
  sms_off; startReview honors review_off. The original ground conditions still validate (the deploy smoke test).
- New console actions: booking/<id>/{details,dates,size,swap,paid}, book (phone bookings; pay link = Stripe invoice,
  needs email; cash/terminal/invoice), hold (a signed contract's bins as payment_type 'contract' jobs), text-staff,
  and /text to a phone with no booking (contract contacts). MIGRATION 0011 APPLIED LIVE (addons, debris).
  Backup first: tripe-r-dump-backups/triplerdump_bookings-2026-10-27-before-phase2.sql. npm test 48/48.
- NOT COMMITTED.

*** PULL COUNT CONSOLE WRITES LIVE 2026-10-26 (worker v 5107cb23 via deploy.mjs; preview + live checks OK; previews back OFF) ***
- Joseph agreed (via Boston). The console (trykellan.com/console, soon admin.triplerdump.com; Pages project `trykellan`)
  now WRITES here through src/console-api.js: POST /api/console/booking/<id>/{delivered,completed,pickup-date,cancel,notes},
  /api/console/text, /api/console/invoice (+ /invoice/<id>/{resend,void}). Server to server only: the Pages project calls
  this Worker over a service binding (TRD) with header x-console-key = secret CONSOLE_API_KEY (8 secrets now; deploy.mjs
  still requires the original 6). Missing/wrong key -> 401. Drivers: delivered/completed/text/notes only (403 otherwise).
- Same SQL as /admin: "completed" runs startReview (the review ask); pickup-date re-arms reminders + stamps notes;
  "delivered" with a pickup (dropped early) moves the pickup the same way. Every change -> console_log (who/what/when).
- MIGRATION 0010 APPLIED LIVE (d1 execute --file; no d1_migrations table here): bookings += delivered_at, bin_no,
  completed_at, weight_tons; new table console_log. Additive; every INSERT names its columns. Backup first:
  Desktop/projects/tripe-r-dump-backups/triplerdump_bookings-2026-10-26-golive.sql (27 bookings).
- TEXTS: CONSOLE_TEXT_MODE unset = "owner": every text the console writes goes to S.ownerPhone as
  "[Preview of a text to NAME, PHONE] ...". Set the var to "customers" (wrangler.toml [vars] + deploy.mjs) only when
  Joseph OKs them. The review ask and invoice texts are this Worker's own and go to customers as before.
- OFF SWITCH: trykellan wrangler.toml LIVE_WRITES = "off" + pages deploy (console goes read-only), or delete the
  CONSOLE_API_KEY secret here. Tested first on a local copy of this D1 (wrangler dev + pages dev, texts caught locally).
- NOT COMMITTED (src/console-api.js, src/index.js route, migrations/0010_console.sql, schema.sql).
- DNS ADDED same night (Boston saw NXDOMAIN): CNAME admin -> trykellan.pages.dev, proxied, record id
  4dca7c57203490adc9bec8e0ee4ff659 (via ../.env CLOUDFLARE_TOKEN, which can edit this zone). It's a Pages custom domain
  on `trykellan`; this Worker's custom domains (apex, www, bio, social) are exact hostnames, so no clash. Delete the
  record to undo.

*** MIGRATION PREP: PULL COUNT CONSOLE 2026-10-26 (superseded by the entry above: the console now writes) ***
- The new system = trykellan.com (Desktop/Kellan systems/trykellan-demo, Cloudflare Pages `trykellan`). Its
  /console/ READS this D1 via functions/real-data.js (fixed SELECTs, never writes); every console action is
  browser-only (localStorage). Swapping Joseph over needs a real write backend first (see plan in that session).
- Debugged there (local, NOT deployed/committed): demo/demo.js syntax error (a `//` comment ate the end of a
  line, so Demo tools + Phone were dead on every page since d36fed1); _dist.js now refuses scripts that don't
  parse; geocode retry without ", UT 84404-9792" (Photon returns nothing for ZIP+4, so the live job had no pin);
  one phone = one customer (invoices typed "Root & Ripple" vs "Root and Ripple Designs" split him); "Repeat" and
  the customer list now count invoices (contractor work is mostly invoiced, no booking behind it).
- FACTS FOR THE MIGRATION: bookings have NO lat/lng (store them at booking time); bin switches have bin_size NULL;
  no bin numbers/trucks/contracts/dump weights/customers table in D1; the LIVE service-area gate (booking.js
  ~446) also gets zero Photon results for ZIP+4 addresses and fails OPEN, so the radius isn't enforced on them.

*** WIX GSC TOKEN REMOVED 2026-10-24 ***
- Deleted Cloudflare TXT google-site-verification=iizxVYdJu7gsxBf0emEU0Hny9KSZjEg_2le5_ShvWuI (Wix reseller
  'reseller-api-user-do-not-delete@reseller.gappsemail.wix.com' GSC owner) so Boston could remove that owner.
  KEPT: google-site-verification=4T67NtoF... and the Google SPF TXT. Re-add the record to undo.

*** FOOTER CREDIT WORDING 2026-10-24 later (worker v 012bcb41 via deploy.mjs; checkout probe OK; previews back OFF) ***
- Boston picked "Powered by Pull Count" (over "Website by" / "Built by"): same link, spot and styling. Verified live, 37/37.

*** FOOTER CREDIT -> PULL COUNT 2026-10-24 (worker v 2cd486ec via deploy.mjs; checkout probe OK; previews back OFF) ***
- Boston OK'd. Footer credit on all 37 pages (build_pages.py footer + social footer, hand-built index.html) is now
  <a href="https://pullcount.com/" target="_blank" rel="noopener">Website by Pull Count</a> (followed; was "Made by
  Kellan" -> getkellan.com). build_pages.py rebuilt: only that line changed; HTML copied into deploy/ (build_deploy.py
  NOT re-run, photos untouched). agents.test.mjs footer regex updated, 48/48. Before the edit, local worker bundle +
  deploy/ were verified identical to live. Verified live on all 37 pages. NOT COMMITTED.

*** FOOTER LINK FIX 2026-10-10 (worker v 24ce10e4 via deploy.mjs; checkout probe OK; previews back OFF) ***
- 'Made by Kellan' was unclickable on wide desktops (~1920px): the giant .ft__sig text (line-height .8) overflows
  upward over .ft__bottom and won the hit test. pages.css .ft__sig now pointer-events:none (decorative). Homepage
  link now target=_blank like every other page. Verified live at 1920px: the link is the hit target everywhere.

*** SPAM CLUSTER REPORTED 2026-10-09 (Google Business Redressal Complaint, case ID 8-3750000041499) ***
- Boston OK'd. 42 suspected lead-gen listings (Ogden/Roy/North+South Ogden/Clearfield/Syracuse/Layton/Kaysville/
  Farmington/Brigham City/Huntsville) filed as 'This business doesn't exist', name 'Boston', bkthueson@gmail.com.
  Evidence list (Maps cid URLs, phones, addresses, review counts): _mock/spam-listings-2026-10-09.csv (gitignored).
  Form GOTCHAS: URL fields must start 'https://www.google.com/maps/' (the '?cid=' form without /place/ is rejected;
  'https://www.google.com/maps/place/?cid=N' works and resolves); the optional spreadsheet upload made Submit hang
  forever - use 'Add additional field' (a.add-additional) instead. Google gives no status updates: re-run the rank
  survey in 2-4 weeks and check whether the listings are gone (same cids).

*** LIVE GOOGLE REVIEW COUNT + RANK MAP 2026-10-09 evening (worker v 4760c6f6 via deploy.mjs; checkout probe OK) ***
- GOOGLE_PLACES_API_KEY secret ADDED (7 secrets now; deploy.mjs requires 6, fine). Key = the 'bos' key from Desktop/
  google profile snap shot/keys.local.js (unrestricted Places key; all 4 keys there work server-side). Places returns
  rating/userRatingCount (5.0 / 20) but NO review texts for this listing, so cards stay as reviews.js defaults; the
  count/rating now auto-update (cron, every 20h). First run due 16:00 MDT 10-09 (D1 key google_reviews).
- RANK MAP artifact: https://claude.ai/artifact/CPbW11cJdBFGCP2cYkBcXB (source + data + scripts in session scratchpad
  rank/: survey.py = 24 towns x 7 terms top-60 @3 km bias; grid.py = 7x7 @1 mi top-20). Sep 28-29 (no address) ->
  Oct 9: top-20 2->64 /168, top-10 0->25, top-3 0->3; West Haven 'dumpster rental' #36->#10. BUT grids fell vs Sep 29:
  West Haven avg 3.6->6.6, Ogden 9.3->16.8, because ~10 lead-gen spam listings ('[City] Dumpster Rental', 0-3 reviews;
  NEW: 'Alfredo Dumpster Rentals Ogden' 473 27th St, 'Desmond O Dumpster Ogden' 244 25th St) crowd the Ogden top 20.
  Biggest lever = Business Redressal Complaint reports (Boston's call; not filed). The 4 keys' free daily quota ran out
  (resets midnight Pacific); Bountiful/Cottonwood Heights/Springville/Logan/Tremonton are not measured yet.
- Scheduled task 'trd-request-indexing-logan-tremonton' fires 2026-10-10 15:05 MDT: requests GSC indexing for Logan +
  Tremonton, checks the review row, and reports to Boston's Discord webhook (URL lives in the task + auto-memory, NOT repo).

*** LOGAN + TREMONTON CITY PAGES 2026-10-09 later (worker v f29e03f8 via deploy.mjs; checkout probe OK) ***
- Boston: add cities if no farther than Springville. Logan (~49 mi/55 min, Cache County, books online) and
  Tremonton (~40 min, Box Elder) added: 16 city pages, Cache County in AREA_TEXT/agents.js SERVICE_AREA, hub
  'Logan to Springville'. NO job photos there (no Recent-job section, no job claims). Logan landfill/transfer
  + Box Elder County Landfill facts cited (loganutah.gov, boxeldercountyut.gov). 48/48 tests. Sitemap 37.
- GBP photos: North Ogden + Springville were already there (Joseph); Roy, Clinton, Bountiful, Brigham City,
  Cottonwood Heights UPLOADED 10-09 (blurred uploads/jobs versions; showed 'Pending' review). GBP 'Add photos'
  needs a REAL click with Chrome visible (hidden window = clicks never arrive). Logan/Tremonton 'Request
  indexing' hit GSC daily quota on 10-09 - request them next session (they are in the sitemap).

*** EXTREME SEO PASS 2026-10-09 (worker v d13f9b0b via deploy.mjs; checkout probe OK; previews toggled back OFF) ***
- WHY: GSC (3 mo) = 51 clicks / 2.35K imp, 21 pages indexed (was 3), but city/service pages had impressions
  and ZERO clicks (Roy 217 imp pos 9; "dumpster rental roy ut" 136 imp pos 6.6; Layton/Ogden pos 17-38).
  Competitors (Canyon View - same street in West Haven, Dumps Easy, TrashDash) publish no prices, no FAQ
  schema, no real job photos; nobody covers permits/"dumpster days" for Weber/Davis/Box Elder.
- JOB PHOTOS: Joseph texted 16 photos (Desktop/transfer/received_photos IMG_7773..7887), every one GPS-
  verified to the city he labeled: Roy, Clinton, Bountiful, North Ogden, Brigham City, Springville, Cottonwood
  Heights (GPS on the Holladay line). 14 shipped in uploads/jobs/ (city-named, house numbers BLURRED, EXIF/GPS
  stripped; IMG_7886 skipped = child + van plate). The OTHER 77 IMG_62xx-65xx in that folder are GPS'd in
  Dayton/Cincinnati OH + N. Kentucky = NOT Joseph's - never use. Bin sizes in job photos are UNKNOWN.
- SITE (build_pages.py largely rewritten; data-driven): KEPT_CITIES = 14 (added brigham-city, springville,
  cottonwood-heights; un-retired north-ogden, clinton, bountiful - marketing.js RETIRED_CITIES matches, test
  checks). Each photo city has "Recent job in X" figures + ImageObject JSON-LD + photo hero/og:image.
  New: /dumpster-rental/ size hub (fixed the 404), /guides/ + 6 guides (content = guides_content.py: cost,
  size-by-project, permits, what-can-go-in, dumpster vs junk vs trailer, city dumpster days - all third-party
  facts cited to official pages), HTML 404 page (not-found/, noindex; agents still Markdown, /api JSON),
  301s for old Wix paths + /book/ /terms/. ONE-PRICE copy everywhere ("up to 7 days", tons included, $/ton)
  via new tokens tons15/tons20/tons25/over_ton/prohibited (marketing.js). Titles <=60 / descs <=155, size
  pages target Ogden/Weber/Davis (not West Haven). Homepage: logo 404 fixed, geo, 24h hours, areaServed,
  recent-jobs strip, hero preload. reviews.js defaults = 20 reviews (5 new, approx dates). Sitemap 35 URLs
  + 33 image entries. Service area wording = AREA_TEXT (Weber, Davis, Box Elder, Morgan, Salt Lake + Utah
  County to Springville). Prohibited items now match /terms (tires, Freon appliances, electronics NOT allowed
  $200/item; mattresses call first; concrete/dirt call first). 47/47 tests. Money files byte-identical.
- D1 (no deploy needed): service_radius_miles 60 -> 85 (Boston OK'd; Springville ~75 mi books online).
  sms_templates.review now asks customers to mention their town + project (json_set, 17 keys intact).
- GBP (Joseph's listing, via Chrome): 6 PRODUCTS added + live (15/20/25 yd $320/$375/$425, junk $550, trailer
  $200/day, bin switch $220), each linked to its page. IF PRICES CHANGE, edit the GBP products too. GBP now
  shows "Open 24 hours" and 20 reviews (all 5.0). Did NOT bulk-upload job photos (Joseph already added some).
- GSC: sitemap resubmitted 10-09; Request indexing on 6 new city pages, Roy, /dumpster-rental/, /guides/,
  /guides/dumpster-rental-cost-utah/ (quota used for the day). GSC MCP is NOT configured (no creds) - use Chrome.
- DEPLOY GOTCHA: deploy.mjs needs previews ON; right after enabling, preview URLs can 404 (plain-text platform
  404) for ~30-60 s -> first attempt was correctly refused on POST /api/t. Enable previews, WAIT 60 s, deploy,
  then set previews_enabled false.
- OPEN for Joseph/Boston: /terms still says concrete/dirt/brick "must be in a small designated container
  (e.g. 10-yard)" (no such bin) - site says "call first"; decide + fix terms.js. Logan (72 imp, pos 41) and
  Tremonton show demand - only add pages if Joseph serves them. Brigham City requires a city business license
  to haul refuse for profit (codelibrary §94) - confirm Joseph has one (NOT on the site). config.js fallback
  prices/tons ($325.., 3/4/5 t, $75) differ from live D1 - only matter if D1 is down. NOT COMMITTED.

*** LINKS PAGE ON bio.triplerdump.com 2026-10-08 (worker v a56db2df via deploy.mjs; checkout probe OK) ***
- https://bio.triplerdump.com/ = the links page (Workers custom domain, added via API; cert auto).
  index.js SOCIAL_HOST: on that host "/" serves /social/, /api/t is kept (views logged as /social/),
  every other path 301s to the same path on www (static assets still serve from the asset path).
  www|apex /social(/) AND social.triplerdump.com (used for ~1 hour first, also a custom domain) 301
  -> bio. workers.dev previews still render /social/ (smoke test). Page links to www absolutely;
  canonical = bio; footer "Links page" links point there. deploy.mjs live check expects /social/ 301,
  bio 200, social. 301.

*** PRICES SET TO JOSEPH'S SEP 30 TEXT 2026-10-08 (D1 only, no deploy; Boston asked) ***
- Joseph texted Boston on Sep 30: "2t 15yd @ $320, 3t 20yd @ $375, 4t 25yd @ $425, anything over is
  $70 a ton" (one price per bin, no 1-3 / 4-7 split). Live D1 had $350/$400/$450 (both tiers), tons
  1/4/5, $100/ton (an /admin Save on Oct 2 by someone - no audit log; same save created MILITARY10).
- Written to D1: bins 15/20/25 = 32000/37500/42500 for BOTH tiers (inventory 1/3/5 untouched); fees
  overweightTon 7000, tons15/20/25 = 2/3/4 (other fees untouched); invoice_terms "$100 per ton" ->
  "$70 per ton". Verified live: homepage, size pages, /book, /social, /terms (2/3/4 tons, $70/ton),
  llms.txt, and a real 15yd 4-7 day booking -> Stripe Checkout $344.00 (row deleted after).
- Earlier history: Aug 23 Joseph lowered to 275/300, 325/350, 375/400; before that 300/325, 350/375,
  400/425. If Joseph's prices change again, he edits them in /admin (Prices tab) - no deploy needed.
- CONFIRMED BY JOSEPH (via Boston, 2026-10-08): ONE price per bin for a 7-day rental across the board;
  customers who want it picked up sooner just call. Same price in both D1 tiers is INTENTIONAL.
  (Correction: his $25 price drop happened between Aug 12-21, not Aug 23. The Oct 1-2 admin saves
  were not made by any Claude session.)

*** SITE REDESIGN LIVE 2026-10-08 (worker v ec06fc93 via deploy.mjs; preview + live checks OK) ***
- New look on the Nichols Tree Removal "bones" (fixed header, photo hero + rate card, tape + trust bar,
  marquee, light paper/stone sections alternating with navy, giant footer signature) in TRD colours
  (blue #116DFF, navy, red/white bin tape). Fonts Barlow / Barlow Condensed (+ Anton footer sig).
  ICONS: Phosphor Icons only (assets/icons/*.svg, MIT) - never hand-draw icons (Boston's rule).
- index.html = new homepage; links /pages.css (the shared design system, also used by every
  generated page). Prices are data-trd markers (14), Google rating/count are data-trd-num markers,
  review cards come from the #trd-reviews JSON the worker fills (reviews.js; 3 seed reviews carry
  real Google photo + date, verified 2026-10-08; others show an initial and no date).
- build_pages.py + pages.css restyled (all 18 pages: SEO tags/JSON-LD/copy/{{TRD:}} tokens unchanged)
  and generate the new /social/ link-in-bio page (noindex, not in sitemap; through the worker).
- /book (page.js) restyled IN PLACE: 4 steps, service cards, prices on size/length cards, order
  summary aside (sticky) + phone pay bar, time-of-day options (delivery_time = "Midday (10 AM-2 PM)"
  etc., free text server-side), "address found" + de-duped autocomplete, missing-fields popup
  mirroring booking.js validate(), card-on-file note under terms. KEPT: custom dropdowns + calendar
  (owner dislikes native pickers), every backend field name, Stripe redirect, confirm screens,
  ?canceled= banner, pageshow re-arm. Residential "company" field removed (optional server-side).
  Summary total now = amount charged (includes trailer deposit). Icons: src/icons.js (generated).
- TRACKING: assets/t.js -> POST /api/t -> D1 site_events (migration 0009 APPLIED live); no cookies/
  IPs; bots skipped. Admin "Website activity" card (7/30 days: views, Book/Call/Text taps, checkouts
  started, paid, quotes). Pruned >400 days at the reminder hour. Injected into marketing pages by
  marketing.js addTracking(); index.html + page.js include it directly.
- deploy.mjs smoke now also checks / /social/ /dumpster-rental/20-yard/ /contact/ and /api/t, and the
  LIVE re-check RETRIES up to ~2 min (edge takes ~1 min to serve a new version; the first attempt
  auto-rolled back on a false alarm because /social/ + /api/t did not exist on the old version).
- build_deploy.py: sms: links are no longer treated as files (crashed the build).
- VERIFIED: 31/31 tests; live booking on www -> real Stripe Checkout ($430, delivery_time stored),
  hold released + row deleted (bookings 20 -> 20); payment/SMS/review/reminder/invoice code byte-
  identical; D1 settings identical to the pre-change baseline (26 keys); 6 secrets on ec06fc93;
  admin login form + wrong-pw 401 live; right-pw 302 in the offline test (real password not used).
- /terms refund wording: Boston said LEAVE IT (it was there before). Texting: webhook untouched, fine.
- REVIEW CARDS (v 1a6911d5): only reviews with a verified date are shown (Connie/Scott/Jorge, real
  photo + date); falls back to all if <3 dated. Boston DECLINED a Places API key (cost) and declined
  Chrome desktop access, so more dates need a manual add to reviews.js DEFAULT_GOOGLE_REVIEWS.
- WAS OPEN: /terms full-refund line - resolved above. Google Places API key still not set (review photos/dates for the other 4 cards + auto
  count). _mock/ (gitignored) holds the approved mocks.

*** LANDER SOCIAL PROOF + MAPS 2026-10-07 (worker v df51bc34 via deploy.mjs, checkout probe OK) ***
- index.html: "Book Now" (fill) added to desktop nav, mobile drawer and hero (Call is now the
  ghost button; "View Bin Sizes" dropped). Hero proof row: stars + rating + count (links #reviews),
  BBB accredited (/bbb/), 15 years. Reviews heading now "5.0 stars · 18 Google reviews" + "Read all
  reviews on Google" link; final CTA got a rating line. #area photo REPLACED by the Google Maps
  embed (Share > Embed a map, 1d widened to 30000). Contact page (build_pages.py MAPS_EMBED) got
  the same embed + directions under "Where we haul" and a rating line in the side card.
- REVIEWS ARE DATA, NOT MARKUP: worker/src/reviews.js. D1 settings key `google_reviews`
  {rating,count,updatedAt,source,reviews[]} (default = 5.0/18 + 7 cards, checked on Maps
  2026-10-07). marketing.js rewriteReviews() fills every data-trd-num="g_rating|g_count" and the
  <script type=application/json id=trd-reviews> block the carousel reads (inline array = fallback).
  cron.js refreshGoogleReviews(): Places API (New) place ChIJ31PA2IU4wmIRtzBJUNFOu3M, at most every
  20h, merges Google's 5 newest reviews in front (max 12). NO-OP until a GOOGLE_PLACES_API_KEY
  worker secret exists (Boston must create it; add via `versions secret bulk`, then deploy.mjs -
  and add it to REQUIRED_SECRETS only if you want deploys to demand it). Until then count/cards
  are static: bump D1 google_reviews by hand if needed. Tests: npm test (23).

*** AI-AGENT READINESS 2026-10-07 (worker v fb2ebdc7 via deploy.mjs, checkout probe OK) ***
- src/agents.js: Accept: text/markdown (q >= text/html) on ANY marketing page -> the page
  converted to Markdown (front matter + body + contact footer), Content-Type text/markdown,
  Vary: Accept; prices are substituted BEFORE conversion. HTML responses unchanged except
  they now carry Vary: Accept. Unknown paths: Markdown 404 for agents, the old JSON 404
  for everyone else. /llms.txt is WORKER-GENERATED from live settings (when-to-use, how to
  book = send people to /book?size=..|service=.., read-only /api/availability, never POST
  /api/book for them). index.html got og:type/og:image/og:url/og:title/og:description/
  twitter:card (og:image = the hero photo). Tests: `cd worker && npm test` (12, node:test,
  mocked ASSETS+D1). /book and /terms are NOT negotiated (HTML only).
- AI crawlers: Boston set AI Crawl Control "Training" policy to ALLOW (2026-10-07). Verified
  ClaudeBot, Claude-User, anthropic-ai, GPTBot, ChatGPT-User, Google-Extended, ora-agent,
  DeepSeekBot, CCBot, Bytespider all 200 on the homepage. robots.txt unchanged (Bot
  Preference Sync on, nothing prepended).

*** MAPS RANKING AUDIT 2026-09-29 (read-only; nothing changed) ***
- Report: https://claude.ai/artifact/M4tNTLjZK571P1T66kiocy. ROOT CAUSE: GBP Business location =
  "No location; deliveries and home services only" + service area Davis/Weber/Morgan/Box Elder/
  Salt Lake -> Google's pin sits in the Great Salt Lake (41.2078,-112.6317), ~30 mi from West
  Haven. 168-search grid (24 towns x 7 terms, top 60): TRD never in top 20, #36 in West Haven.
  A distance model predicts current ranks within 7% from the lake pin (no other penalty).
  Old Brandcraft listing gave apex ~37 impressions/day until Sep 4; ~7/day since.
- FIX (Joseph): add hidden business address with unit # (3539 S 4250 W = townhome complex),
  as the ONLY edit that day; expect re-verification. Then report the 40-listing spam cluster
  (Onvoy 385 blocks; 44% of top-3 spots), add Junk removal category, resubmit description
  (current new one NOT APPROVED), photos/posts, reviews to ~40. GBP website = apex (1 redirect).
- Site: 3/38 indexed, 3 external links, homepage ~8 MB images, links only 2/8 city pages.
- FOLLOW-UP SAME NIGHT (worker v 18f0a4b7 via deploy.mjs, checkout probe OK): build_deploy.py
  ship_raster() now resizes/strips EXIF (GPS!) /sRGB-converts photos INTO deploy/ (originals in
  uploads/ untouched) - homepage images 8.6 -> 4.9 MB; homepage footer links all 8 city pages;
  JSON-LD sameAs + hasMap + priceRange (index.html + build_pages.py SAME_AS). GBP: all 17
  services got descriptions (no verification flag). GBP has NO products, NO cover photo, 7
  photos (business card twice). BBB already links the site (nofollow). Found: an UNCLAIMED
  Bing listing (pin ~12 mi off in North Ogden, wrong category, Wix text) + Apple Maps place
  exists; ChatGPT now sources local data from Yelp (Yelp says 24h). Claiming needs Joseph's logins.
  PHOTOS: uploaded 7 photos + a 16:9 cover (Joseph + bin) to GBP from uploads/ originals (15 photos
  now; business card still there twice). GBP uploader lives in a same-origin iframe the Chrome
  file_upload tool can't see: add a hidden <input type=file> to the TOP doc, file_upload into it,
  then copy .files into the iframe input via DataTransfer + dispatch change. NEVER file_upload
  into the top-level Google file inputs - those are the search bar's image search.
- 2026-09-29 later: Joseph OK'd address + junk category. JUNK REMOVAL SERVICE category ADDED
  (pending review). HIDDEN ADDRESS IS NOT POSSIBLE in the current GBP editor: address fields
  only exist while "Show business address to customers" is ON; toggling it OFF wipes them
  (verified via DOM - values ""). Google support had told Joseph to remove the address (SAB).
  Address edit was CANCELLED (still "No location"). Remaining lever: shrink the service area
  (currently 5 counties incl. Salt Lake + Box Elder) so the auto pin/centroid moves toward
  West Haven. DONE ~01:20Z 09-30 (Boston OK'd): junk category went LIVE first, then service area
  changed 5 counties -> 18 cities (West Haven Roy Hooper Ogden Plain City Syracuse Clearfield
  Layton Riverdale S/N Ogden Farr West Marriott-Slaterville Clinton West Point Sunset Washington
  Terrace Kaysville), pending review. Evidence: old pin (41.2078,-112.6317) = bbox CENTER of the
  5 counties. New bbox center ~ (41.18,-112.04). Re-run the Maps grid after it goes live.
  Service area went LIVE (18 cities) but the public pin had not moved yet. Then Boston decided
  (competitors TrashDash/Canyon View/Dumps Easy all show addresses) to add a PUBLIC address:
  3539 S 4250 W, West Haven, UT 84401 saved with "Show business address to customers" ON,
  pending review ~01:35Z 09-30.
  ADDRESS WENT LIVE same night (Places API: sab=false, pin 41.2000,-112.0832). Datum grid
  ("dumpster rental", 7x7 @1mi): OGDEN 20+ everywhere on 09-19 -> avg #9.3, 49/49 ranked, 78% top10
  (center 41.2182,-111.9731 = same grid as 09-19); WEST HAVEN (centred on pin) avg #3.6, 65% top3,
  100% top10. Images in Desktop/google profile snap shot/snapshots/triple-r-dump/. Risk accepted by Boston: re-verification / SAB-at-home rules
  (Google support had told Joseph to remove it). Address was already public on site/Yelp/MapQuest.

*** SERVICE PRICES IN ADMIN + BIN SWITCH $220 2026-09-27 (worker v b2f01b05) ***
- Prices tab now has "Other services": bin switch, junk, trailer/day, trailer deposit
  (svc_* fields). saveSettings writes D1 `services` = ONLY {key:{pricing:{cents}}};
  loadSettings now DEEP-merges per service so label/caps/minDays stay code defaults.
  Blank or $0 keeps the current price (deposit may be 0). Joseph asked for bin switch
  $200 -> $220: D1 services row written (junk 550 / trailer 200+300 unchanged). Verified
  live: /bin-switch/ + homepage + /book pricing show $220. 7/7 offline asserts.

*** LATE-PAYMENT TEXTS + cron.js + HOW-IT-WORKS.md 2026-09-24 (worker v 922242c9) ***
- invoice.js runInvoiceOverdueReminders(): at the daily reminder hour (10:00 Denver), for
  status='sent' invoices with due_date < today: refreshInvoiceStatus first (paid -> stop),
  then text template invoice_overdue if last text >= (invoiceReminderHours-2)h ago; after
  invoiceReminderMax texts (or no phone) text the owner ONCE (owner_invoice_overdue) and
  stop forever (overdue_owner_alerted_at). Settings keys invoice_reminders_on (default ON)
  / invoice_reminder_hours (48, min 24) / invoice_reminder_max (5, 1-10) in the Invoices
  tab; both templates in the Texts tab (wholesale-save trap satisfied). Migration 0008
  APPLIED live (overdue_reminders_sent, overdue_last_sent_at, overdue_owner_alerted_at).
  Taylor Nix (TRD-INV-CC4L8T, due 9/10) gets the first one at the next 10:00 Denver tick.
- SIMPLIFICATION: every timed job now lives in src/cron.js (header lists them); index.js
  scheduled() just calls runScheduled(). worker/HOW-IT-WORKS.md = plain-English map of
  files, timed jobs, EVERY text (who/when), tables, deploy rule. Keep it current.
- VERIFIED: 12/12 offline asserts (node:sqlite + mocked Stripe/SMS) + live: real admin pw
  302, wrong 401, 6 secrets on 922242c9, admin fields render, 4/4 live Checkout sessions,
  bookings 13 rows unchanged, invoices 15 (1 open).

*** CLOUDFLARE GIT BUILDS DISCONNECTED 2026-09-24 -> `git push` IS SAFE AGAIN ***
- Deleted via API both Workers Builds triggers on script tag 48abc415... ("Deploy default
  branch" = `npx wrangler deploy` on main, the 09-18 culprit; "Deploy non-production
  branches" = `wrangler versions upload` on every other branch, which would also have
  poisoned the latest-upload secret chain) AND repo connection f3f06491 (KellanLLC/
  triplerdump). GET .../builds/workers/<tag>/triggers now returns 0. Last build ever:
  2026-09-18T18:31Z. Live stayed on c40a67b5. The GitHub App may still be installed on
  the GitHub side (harmless with no triggers; remove in GitHub > Settings > Applications
  if wanted). Bot branch origin/cloudflare/workers-autoconfig not deleted yet.
  Deploys remain MANUAL via deploy.mjs only.

*** INVOICE PAID -> OWNER TEXT + REVIEW ASK 2026-09-24 (worker v b245339b; guide-tab text in the next version) ***
- invoice.js onInvoicePaid(): runs from refreshInvoiceStatus whenever a row is/turns paid.
  (1) owner SMS (template owner_invoice_paid, respects notify_owner_bookings), claimed via
  owner_paid_notified_at; (2) if invoices.ask_review=1 -> startReview on the LINKED BOOKING
  if booking_id, else on the invoice row itself; claimed via review_checked_at.
  sweepInvoices() rides the HOURLY cron: re-checks status='sent' rows with Stripe (so paid
  is noticed within ~1h w/o anyone opening /admin) + retries paid rows not yet handled.
- review.js now treats bookings AND invoices as review "subjects" (same review_* columns;
  table picked by id prefix TRD-INV-). findReviewSubject() used by /r/<token>, rate +
  feedback handlers; runReviewFollowups loops both tables; low-rating link points to
  /admin/invoice/<id> for invoices. startReview guards are now cross-table + digit-
  normalized phone: skip if phone ever rated, OR was asked in the last 30 days (new).
- Migration 0007 APPLIED to live D1 (11 invoice cols + index). Backfill: all 13 paid
  invoices got owner_paid_notified_at; ask_review DEFAULT 0 so the 15 pre-existing
  invoices never send review texts. New Invoice form checkbox "ask_review" (default ON).
  Texts tab has tpl_owner_invoice_paid (WHOLESALE-SAVE TRAP satisfied).
- VERIFIED: 16/16 offline asserts (node:sqlite stand-in, captured SMS) + live: real admin
  password still logs in (302 + cookie), wrong pw 401, 6 secrets on the version, admin
  pages render new fields, 4/4 live Checkout sessions ($349.38 / $645 / $591.25 / $215),
  bookings table unchanged (13). The one OPEN invoice (TRD-INV-CC4L8T) WILL text Joseph
  when paid (no review ask - it predates the checkbox).

*** SEO SITE FIXES 2026-09-22 (worker v 0266ad90, deployed via deploy.mjs, checkout probe OK) ***
- CITY PAGES 19 -> 8: KEPT_CITIES in build_pages.py (west-haven roy hooper ogden plain-city
  syracuse clearfield layton), each with extra copy (CITY_EXTRA: ZIPs, neighbours covered,
  2 paragraphs) + a 3-question city FAQ (+FAQPage JSON-LD). Main-content similarity 85% -> ~64%.
  The 11 retired cities are still LISTED (unlinked div.city cards) on /service-area/ and their
  URLs 301 to /service-area/ (marketing.js RETIRED_CITIES - must match build_pages.py). The
  retired folders were deleted from the repo root. Sitemap now 21 URLs, lastmod 2026-09-22.
- marketing.js marketingRedirect(): every marketing URL is now ONE URL - slashless -> slash
  (/contact -> /contact/, /faq -> /faq/ ...), /index.html -> /. Query string preserved.
- /book: meta description + canonical (/book, or /book?service=<svc> for the others).
- index.js: fetch now = noindexOffDomain(handle()) - any *.workers.dev host gets
  X-Robots-Tag: noindex. scheduled() -> scheduledTick() (same body).
- workers.dev + preview URLs are OFF ON PURPOSE (Boston: duplicate-content SEO). deploy.mjs
  NEEDS a preview URL, so each deploy: POST .../workers/scripts/triplerdump/subdomain
  {"enabled":false,"previews_enabled":true} -> run deploy.mjs -> set previews_enabled back
  to false. (Uploaded-but-never-deployed version 439b3e71 from the first failed try: ignore.)
- index.html: footer Morgan/Salt Lake County links -> /service-area/ (were retired pages).
- GSC DONE same day (via Chrome "Browser 1" = this PC; "Browser 2" is NOT on this machine):
  sitemap resubmitted (read 9/22, 21 pages), junk "sitemap.xm" removed, Request indexing on
  /book, /service-area/, /service-area/{ogden,roy,layton,syracuse}/, /dumpster-rental/20-yard/.
  2026-09-23: requested the other 9 too (west-haven, hooper, plain-city, clearfield,
  15/25-yard, /junk-removal/, /contact/, /faq/) - ALL 16 key URLs now requested. Hooper +
  /junk-removal/ were "URL is unknown to Google" before the request. Avg pos 9.3 (24h) and
  still 3 indexed on 09-23 = expected lag; nothing further to do until Joseph verifies GBP. Inspection showed "Referring page: None detected" on every
  unindexed page - Google has not crawled the homepage links to them yet. NOT COMMITTED.

*** GBP LOST VERIFICATION + SEO AUDIT 2026-09-22 (read-only; nothing changed) ***
- Joseph's GBP (listing 4556821476581406756) shows "Verification required" in Business Profile
  Manager: "Google requires additional info... Your edits will be visible after you're verified."
  Only method offered = BUSINESS VIDEO (Joseph must record it: location, equipment/truck+bins,
  proof of management). Still PUBLIC on Maps (5.0/14), but the 09-19 edits (2nd category,
  services, description, first post) are NOT live, Posts shows "No posts yet", Performance is
  locked. Likely triggered by the big 09-19 edit batch - do NOT make more GBP edits until verified.
- GBP website button = https://triplerdump.com/ (APEX) -> so apex impressions in GSC = map-pack.
  Apex: 20-120 imp/day Aug 21-Sep 4 at pos 2-5, ZERO Sep 5-7, then 2-16/day at pos ~10-12.
  That is the whole "average position got worse" story: map pack lost, not organic decline.
- GSC: 3/38 indexed; 30 "Discovered - currently not indexed" (all size/service/city pages,
  /book, /contact/, /faq/, /bbb/). City pages are ~85% identical text (difflib) - consolidate
  to ~6-8 unique pages. No manual actions; CWV = not enough data; Links = still processing.
  Junk sitemap entry "sitemap.xm" (Couldn't fetch) can be deleted. /contact (no slash) returns
  200 and Google's snippet for it is the stale Wix "1234 Main Street" placeholder - 301 it to
  /contact/ + request reindex.

*** INCIDENT 2026-09-19 -> 09-21: SITE RAN WITH ZERO SECRETS FOR ~2 DAYS. RESOLVED 2026-09-21,
worker v 4dd97a62 live with all 6 secrets (terms auto-charge wording + review link now live). ***
- CAUSE: after the 09-18 rollback, the 09-19 `wrangler deploy`s (8057a86c, d3ab2d60) inherited
  secrets from the LATEST UPLOADED version (= bot shell 5824dd69, 0 secrets), NOT the deployed
  one. Inheritance is ALWAYS from the latest upload; rollback never changes "latest". Result:
  checkout "couldn't start secure checkout" (safety path, nothing charged) + admin 401 for
  every password, for ~2 days. Fixed by `wrangler rollback 9dcf9d99`, then rebuilding the
  secret chain with `versions secret bulk` (JSON file) and a guarded deploy.
- SECRET VALUES NOW: ADMIN_PASSWORD = the same password Joseph/Boston always used (in .env
  `ADMIN_PASSWORD` / `current-admin-password`); ADMIN_SECRET = new random (.env; only
  invalidated old cookies); STRIPE_SECRET_KEY_LIVE = NEW restricted key "TRD Work live FIX"
  (.env `current-stripe-api`, 107 ch, ends azcc; all 6 needed permissions verified). The old
  .env `new-stripe-token` (184 ch, ends 69af6) is DEAD - Stripe rejects it; the previous
  working key lives only inside old version 9dcf9d99 and can be deleted in Stripe once
  nobody plans to roll back past 4dd97a62. CALENDAR_TOKEN + STRIPE_SECRET_KEY (sandbox) from
  worker/.dev.vars, GHL_SMS_WEBHOOK_URL = the D1 settings value.
- GOTCHA: `echo -n "v" | wrangler versions secret put NAME` MANGLES the value on this
  Windows/Git-Bash setup. ALWAYS `versions secret bulk <file.json>` (then delete the file).
- *** DEPLOY COMMAND IS NOW `cd worker && node deploy.mjs "message"` - NEVER plain
  `wrangler deploy` again. *** It uploads a version (no traffic), verifies all 6 secrets +
  DB/ASSETS/SITE_ORIGIN, runs the full smoke test INCLUDING a real booking -> Stripe Checkout
  session against the version's PREVIEW URL (<id>-triplerdump.bkthueson.workers.dev; hold
  released + test row deleted), only then `versions deploy`, then re-checks live with
  auto-rollback to the previous version. Proven 2026-09-21: refused a 5-secret version
  (exit 2) and a dead-Stripe-key version (exit 3) with live untouched; then shipped 4dd97a62
  clean. Rejected/short-lived uploads that day (5f0293ee 7731da6f 7f756e90 1e55f6b7 e68fe4c3
  a84aae79 a62fbf7b c23890eb...) can be ignored.
- STILL OPEN: (1) disconnect the Cloudflare GitHub app before any `git push` (see 09-18
  incident); (2) Boston wants an hourly live checkout monitor that texts him on failure -
  not built yet.

*** GBP OPTIMIZATION PASS 2026-09-19 (profile only; no code change) ***
- Reviews MERGED: Joseph's profile now shows 5.0 / 14 reviews, 6 photos. Joseph had already
  replied to all 14 himself (Unreplied filter = empty). Review link g.page/r/CbcwSVDRTrtzEAE.
- ADDED via the GBP editor: 10 custom services (15/20/25 Yard Dumpster Rental, Dump Trailer
  Rental, Junk Removal, Bin Switch-Out, Residential/Commercial Dumpster Rental, Construction
  Debris Removal, Yard Waste Removal) - it was at fromEmptyState, i.e. ZERO services before.
  Second category "Waste management service" + 7 Google-native service types (Construction
  debris removal, Dumpster rental, Furniture removal, House & garage cleanouts, Junk removal,
  Trash removal & disposal, Yard debris removal). DELIBERATELY SKIPPED appliance / e-waste /
  hazardous / mattress types - /terms lists those as PROHIBITED materials.
  New SEO description (652 ch, cities + sizes + BBB). First Post published w/ Book button ->
  /book (post id 16072318222926251).
- NOT DONE: photos (no way to get local files into the page from here - Joseph or Boston must
  upload; 6 now, target 20+), Products tab, Q&A seeding. Hours left at Joseph's 9-5 on purpose.
- HOW TO DRIVE THE GBP EDITOR (this took a while to work out): business.google.com/n/<listing>/
  <services|reviews|posts>?fid=<cid> redirects to google.com/search#mpd=... and the real editor
  is a SAME-ORIGIN iframe -> [...document.querySelectorAll('iframe')].find(x=>x.offsetWidth>800)
  .contentDocument. Chrome MUST be visible+focused (document.visibilityState) or real clicks
  silently no-op and screenshots time out. Compute viewport coords as iframeRect + elRect and
  use computer left_click. Synthetic MouseEvents work for plain buttons, but TEXT INPUTS MUST
  BE TYPED FOR REAL - a native-setter value set leaves aria-invalid=true and the form refuses
  to submit ("A link is required"). Also: Google rejects URLs inside the description field.

*** AUTO-CHARGE ON LATE INVOICES 2026-09-19 (worker v d3ab2d60) ***
- /terms "Late Payment & Automatic Charge" + "Payment Authorization" (terms.js) now say: unpaid
  invoice balance + accrued late fees may be charged to the card on file, without further
  notice, on/after the day after the due date; if no card / declined, balance still due and
  may go to collections. Same language in DEFAULT_INVOICE_TERMS (settings.js) AND the live
  D1 `invoice_terms` row (rewritten - it overrides the default; also fixed the stale $75/ton
  -> $100/ton there to match D1 fees + /terms).
- REALITY CHECK: Checkout bookings DO store a card (setup_future_usage=off_session).
  Invoiced jobs DO NOT (see Invoicing) - the clause is worded "card on file" so it is
  truthful either way, but Joseph can only actually auto-charge Checkout customers. Charging
  is still MANUAL from the Stripe dashboard; nothing in the worker charges anyone
  automatically.

*** INCIDENT 2026-09-18 18:31Z: `git push` TOOK THE BOOKING SYSTEM DOWN FOR ~3 MIN — DO NOT
PUSH TO KellanLLC/triplerdump UNTIL THE CLOUDFLARE GITHUB APP IS DISCONNECTED ***
- CAUSE: a Cloudflare GitHub App (Workers Builds) has been connected to the repo since
  ~2026-06-11 (bot branch origin/cloudflare/workers-autoconfig, author
  cloudflare-workers-and-pages[bot]). Nobody had pushed since (28 local commits sat
  unpushed), so it never fired. The first push (schema commit cf6184f) triggered a build
  that used the bot's root wrangler.jsonc — assets:"." and NO main script — and deployed
  it as version 5824dd69 (18:31:51Z): no fetch/scheduled handler, no DB/ASSETS/SITE_ORIGIN
  bindings, no secrets, compat date = build day. Static pages kept serving; /book /admin
  /terms /booked and every /api/* went 404 on both the custom domain and workers.dev.
- FIX: `npx wrangler rollback 9dcf9d99-00ad-4887-92c2-060ec38af098` at 18:34:22Z (the
  version deployed+verified at 18:25). Rollback re-points traffic at that version WITH its
  bindings. Verified after: /book /terms /admin /contact/ /booked?ref=bogus 200, bad admin
  pw 401, /api/availability returns live D1 caps, /api/promo ok, cron `0 * * * *` still
  attached, both custom domains still bound, `wrangler versions secret list` shows all 6
  secrets on the 100% version (ADMIN_PASSWORD ADMIN_SECRET CALENDAR_TOKEN
  GHL_SMS_WEBHOOK_URL STRIPE_SECRET_KEY STRIPE_SECRET_KEY_LIVE). D1: zero bookings created
  2026-09-18, last real row 09-11 — no customer was mid-checkout.
- GOTCHA: `wrangler secret list` and GET /workers/scripts/triplerdump/settings read the
  LATEST UPLOADED version (= the bad shell -> "[]", bindings []), NOT the deployed one.
  Use `wrangler deployments status`, `wrangler versions view <id>` and
  `wrangler versions secret list` — those are authoritative. Secrets inherit from previous
  DEPLOYMENTS on upload ("secrets are never deleted by deployments"), so a normal
  `wrangler deploy` from worker/ keeps them. ADMIN_PASSWORD/ADMIN_SECRET exist ONLY in the
  deployed version (not on disk anywhere) — never let a deploy drop them.
- TODO (Boston): (1) disconnect the git integration — Cloudflare dash > Workers & Pages >
  triplerdump > Settings > Build (or GitHub > Settings > Applications > "Cloudflare Workers
  & Pages" > remove this repo); (2) `git push origin --delete cloudflare/workers-autoconfig`;
  (3) only then is `git push` safe again. Deploys stay MANUAL: `cd worker && npx wrangler
  deploy`.

*** HOMEPAGE LocalBusiness JSON-LD 2026-09-18 (worker v 9dcf9d99; worker SOURCE UNCHANGED) ***
- Every generated page's JSON-LD points provider/about at https://www.triplerdump.com/#business
  but index.html had ZERO structured data, so that @id resolved to nothing. Added one
  <script type="application/ld+json"> LocalBusiness block before </head> (name/phone/email/
  address/4 counties areaServed/sameAs IG+FB/image+logo, values = BIZ in build_pages.py).
  NO openingHours on purpose (site says 24/7, GBP says 9-5). Contains no {{TRD:}} / data-trd
  so marketing.js passes it through. Only /index.html changed in the deploy (1 asset).
- VERIFIED live post-deploy: 1 ld+json on /, 9/9 data-trd prices render, 0 token residue;
  /book /terms /api/availability /admin /booked?ref=bogus /contact/ /service-area/ogden/
  /sitemap.xml all 200; bad admin password 401. No bookings created. NOT committed yet.
- GSC EXPORT (Aug 21-Sep 16, 9 clicks/448 imp): apex+http variants still show as separate
  URLs = stale Wix-era data (live 301s verified correct). Only /, /contact and
  /service-area/syracuse/ indexed so far - the Sep 10 pages are just not crawled yet.
  ACTION for Boston: confirm sitemap submitted in Search Console + "Request indexing" on
  /service-area/ogden/ and /service-area/roy/. "dumpster rental" ranks #1 with 0 clicks =
  map pack, i.e. GBP (see header). "dumpster rental logan ut" 47 imp @ pos 43 - Logan is
  Cache County, OUTSIDE the four stated counties; do not add a page unless Joseph serves it.

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
- NEW REVIEW LINK = https://g.page/r/CbcwSVDRTrtzEAE/review (verified signed-out). Written
  to D1 settings review_link, index.html footer, build_pages.py, settings.js default,
  uploads/info.md. The old g.page/r/CcTKEv0Yu0gPEBM + placeid ChIJc1Zhse8j7AcRxMoS_Ri7SA8
  are DEAD - never reintroduce them.
- RESOLVED 2026-09-19: Google merged the old reviews onto Joseph's profile (Boston got
  access to the source via Michael's brand-account invite on case 0-4342, Sep 15). REVIEW
  LINK CHANGED AGAIN to https://g.page/r/CbcwSVDRTrtzEAE/review (direct write-review form,
  placeid ChIJ31PA2IU4wmIRtzBJUNFOu3M) - in D1 + all 4 source files, worker v 8057a86c.
  Manually re-texted the 3 customers who got a dead link (TRD-SVRDWY/8PQ9KH/9YTGEX) via
  the GHL relay; noted on their bookings.
- (historical) getting the ~15 old reviews merged onto the new profile. Two Google cases:
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
- Deploy: `cd worker && node deploy.mjs "msg"` (guarded; reads the token from ../.env). NEVER plain `wrangler deploy`.
