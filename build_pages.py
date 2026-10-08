"""Generate the SEO pages for the Triple R Dump marketing site.

    python build_pages.py        # then python build_deploy.py, then deploy

Writes, at the repo root (committed, like index.html):

    dumpster-rental/15-yard/index.html      one page per bin size
    dumpster-rental/20-yard/index.html
    dumpster-rental/25-yard/index.html
    junk-removal/index.html                 the three other services
    dump-trailer-rental/index.html
    bin-switch/index.html
    service-area/index.html                 where we haul, city by city
    service-area/<city>/index.html
    faq/index.html, bbb/index.html, contact/index.html
    social/index.html                       link-in-bio page (noindex, not in sitemap)
    sitemap.xml, robots.txt

pages.css (hand-written, NOT generated) is the shared design system: the
approved homepage kit first, then the inner-page blocks these templates use.
Icons are Phosphor SVGs from assets/icons/, inlined per page (see sprite()).

Every page is plain static HTML served by Workers Static Assets, exactly like
index.html. None of these paths collide with a Worker route (/book, /terms,
/api, /admin, /booked, /r, /inv, /calendar), so the booking system is not
involved in serving them. index.html is hand-built and is NOT touched here.

PRICES ARE NOT BAKED IN ANYMORE (2026-08-23). Every dollar amount in these
pages is a {{TRD:key}} token (see T() below); the worker substitutes the live
CMS value on every request (worker/src/marketing.js, wrangler run_worker_first).
A price change in /admin is live on every page within 5 minutes, no rebuild.
Keys: d15_13 d15_47 d20_13 d20_47 d25_13 d25_47 junk trailer_day trailer_dep
binswitch ext_day. Never hardcode a dollar amount here again.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://www.triplerdump.com"
TODAY = "2026-09-22"

BIZ = {
    "name": "Triple R Dump",
    "owner": "Joseph",
    "phone": "801-564-3164",
    "tel": "tel:8015643164",
    "email": "Joseph.Rodrigues@triplerdump.com",
    "address": "3539 S 4250 W, West Haven, UT 84401",
    "city": "West Haven",
    "review": "https://g.page/r/CbcwSVDRTrtzEAE/review",
    "instagram": "https://www.instagram.com/triple.r.dump/",
    "facebook": "https://www.facebook.com/profile.php?id=61587229028024",
    "bbb": "https://www.bbb.org/us/ut/west-haven/profile/dumpster-rentals/triple-r-dump-1126-1000181920",
    "yelp": "https://www.yelp.com/biz/triple-r-dump-west-haven",
    "gmaps": "https://www.google.com/maps?cid=8339345795908710583",  # Joseph's GBP (CID 8339345795908710583)
}
# sameAs for the #business entity - keep in step with index.html's LocalBusiness JSON-LD.
SAME_AS = [BIZ["instagram"], BIZ["facebook"], BIZ["bbb"], BIZ["yelp"], BIZ["gmaps"]]

HERO_IMG = "/uploads/triple.r.dump-photo-DY2CxEIFMkG-20260527_075118_707154355.jpg"
AREA_IMG = "/uploads/triple.r.dump-photo-DY2CxEIFMkG-20260527_075118_707005240.jpg"
P = "/uploads/triplerdump_photos/triplerdump_photos/"

# ───────────────────────────────────────────────────────────── sizes ──────

SIZES = [
    {
        "slug": "15-yard", "yd": 15, "img": P + "01_15yd_bin.png",
        "tag": "The driveway bin",
        "best": "Garage cleanouts, small remodels, yard waste, moving.",
        "fits": "Fits in a standard driveway without blocking the garage.",
        "loads": "about five pickup-truck loads",
        "lead": "The 15 yard is the bin for a weekend. A garage that has not been seen in years, a bathroom remodel, the yard after a storm, a move that left a pile behind. It fits in a standard driveway, it holds about five pickup loads, and the dump fee is already in the price.",
        "good": ["Garage and shed cleanouts", "Bathroom and small kitchen remodels", "Yard waste, branches, sod", "Moving and apartment clean-outs", "Roof tear-offs on a small roof", "Carpet, cabinets, drywall from one room"],
        "faq": [
            ("How much fits in a 15 yard dumpster?", "About five full-size pickup loads. Think a two-car garage cleanout, a bathroom remodel, or the debris from one or two rooms. If you are staring at a kitchen, the 20 yard is the safer call."),
            ("Will it fit in my driveway?", "Yes, that is what the 15 is for. It takes roughly one parking space. Tell us which side of the drive you want it on when you book and the driver sets it there, on boards if you want the concrete protected."),
            ("What does ${{TRD:d15_13}} actually cover?", "Delivery, pickup, the rental for 1 to 3 days, and the dump fee. Utah sales tax is added at checkout. Extra days are ${{TRD:ext_day}} each; heavy loads over the weight limit and prohibited items are the only other charges, and they are spelled out on the terms page."),
        ],
    },
    {
        "slug": "20-yard", "yd": 20, "img": P + "02_20yd_bin_side.jpeg",
        "tag": "Our most-rented size",
        "best": "Kitchen remodels, landscaping, flooring, estate cleanouts.",
        "fits": "Still driveway-sized. The right answer when you are not sure.",
        "loads": "about seven pickup-truck loads",
        "lead": "The 20 yard is the one we rent most, and the one we point people at when they are not sure. Kitchen remodels, flooring through a whole main level, a landscaping tear-out, an estate cleanout. Still fits a driveway, holds about seven pickup loads, and the dump fee is included.",
        "good": ["Kitchen remodels and cabinet tear-outs", "Flooring and carpet, whole floor", "Landscaping, fence and deck tear-downs", "Estate and whole-garage cleanouts", "Roof tear-offs on a standard home", "Basement finishes and remodels"],
        "faq": [
            ("Why is the 20 yard your most-rented bin?", "Because it covers the most jobs for the least money. It is the size that handles a kitchen, a floor, or a yard without running out of room, and it still fits in a driveway. When a 15 feels tight, the 20 is the safer call for a little more."),
            ("Can I start with a 15 and switch to a 20?", "Yes. If the bin fills mid-project we haul it and drop the next one in the same trip; that is the bin switch, ${{TRD:binswitch}}. One of our reviews is exactly that story. Cheaper still is to start with the 20."),
            ("What is the price for a week?", "${{TRD:d20_47}} for 4 to 7 days, plus Utah sales tax at checkout. ${{TRD:d20_13}} for 1 to 3 days. Both include delivery, pickup and the dump fee."),
        ],
    },
    {
        "slug": "25-yard", "yd": 25, "img": P + "03_25yd_bin_side.jpeg",
        "tag": "Maximum capacity",
        "best": "Construction, roofing, full-home cleanouts, commercial jobs.",
        "fits": "Needs a longer space: a long driveway, a job site, or the street with a permit.",
        "loads": "about nine pickup-truck loads",
        "lead": "The 25 yard is the big one: construction debris, a full roof, a whole-house cleanout, a commercial job that is going to keep filling it. About nine pickup loads. It needs a longer footprint than the others, so tell us where it is going and we will say whether it fits.",
        "good": ["New construction and demolition debris", "Full roof tear-offs", "Whole-home and hoarding cleanouts", "Commercial and retail fit-outs", "Multi-room remodels", "Bulky furniture, decking, fencing in volume"],
        "faq": [
            ("Do I need a permit for a 25 yard bin?", "Only if it has to sit on a public street. In a driveway or on your own lot, no. If it is going on the street, your city may want a permit; the booking form asks, and we can tell you what your city does."),
            ("Can I put concrete, dirt or brick in it?", "Not in a 25. Heavy material hits the weight limit long before the bin is full and the overage is billed by the ton. Heavy loads want their own small container; call and we will set it up properly."),
            ("How long can I keep it?", "1 to 3 days is ${{TRD:d25_13}}, 4 to 7 days is ${{TRD:d25_47}}, plus tax. Need longer? Call before pickup and we extend it at ${{TRD:ext_day}} a day. On a long job, a bin switch keeps the same bin on site with a fresh one dropped when it fills."),
        ],
    },
]

SERVICES = [
    {
        "slug": "junk-removal", "name": "Junk Removal", "price": "${{TRD:junk}}", "unit": "flat rate",
        "book": "/book?service=junk", "img": P + "06_bin_rental_3.jpeg",
        "title": "Junk Removal in West Haven & Weber County, UT",
        "description": "Full-service junk removal on the Wasatch Front: we bring the truck and the crew, load it, haul it and pay the dump. ${{TRD:junk}} flat, weekends only. Book online or call 801-564-3164.",
        "h1": "Junk removal in<br>West Haven &amp; Ogden.<br><em>We do the lifting.</em>",
        "lead": "Some jobs do not want a bin sitting there for three days; they want it gone by lunch. That is junk removal. We bring the truck and the hands, load it, haul it and pay the dump. One flat rate. Weekends only, so the weekday fleet stays on the bins.",
        "sections": [
            ("What the flat rate covers", ["The truck, the crew, the loading, the hauling and the dump fee, for one load. Furniture, appliances, the pile in the garage, the shed that finally came down, the leftovers after a move or an estate. If you have more than a load, call and we will price it straight before anyone drives over."]),
            ("Weekends only", ["Junk removal runs Saturdays and Sundays. The booking form only lets you pick a weekend date; try a weekday and it tells you so. Pick the day, tell us roughly what and where, pay online, and we show up."]),
            ("What we cannot take", ["Hazardous waste, wet paint and other liquids, asbestos, propane and fuel. Tires, mattresses and appliances with refrigerant can go but carry a handling fee. The full list is on the terms page. Not sure about something? Ask when you book."]),
        ],
        "faq": [
            ("Is junk removal cheaper than a dumpster?", "For a pile you want gone today with no lifting, it is the right tool. If you are demolishing over several days, a bin is cheaper per yard and sits there while you work. We are happy to tell you which; call."),
            ("Do I have to be home?", "Someone needs to be there to show us what goes and what stays, or you can stage it in one spot and tag it. Either way we confirm before we load."),
            ("What about a weekday?", "Junk removal is weekends only. On a weekday, a 15 yard bin with a one-to-three-day rental is usually the answer; same phone number."),
        ],
    },
    {
        "slug": "dump-trailer-rental", "name": "Dump Trailer Rental", "price": "${{TRD:trailer_day}}", "unit": "per day",
        "book": "/book?service=trailer", "img": P + "14_gallery_photo_4.jpg",
        "title": "Dump Trailer Rental in West Haven & Weber County, UT",
        "description": "Rent a dump trailer by the day in West Haven, UT: ${{TRD:trailer_day}} a day, 1 to 14 days, with a ${{TRD:trailer_dep}} refundable deposit. Haul it yourself, dump it yourself. Book online or call 801-564-3164.",
        "h1": "Dump trailer rental<br>in West Haven, UT.<br><em>By the day.</em>",
        "lead": "If you have the truck and the time, a dump trailer is the cheapest way to move a lot of material: your own runs to the dump, a move, hauling gravel or branches. ${{TRD:trailer_day}} a day, one to fourteen days, with a ${{TRD:trailer_dep}} deposit that comes back when the trailer does.",
        "sections": [
            ("How it works", ["Book the days online, pay the rental plus the refundable deposit, and pick the trailer up from us in West Haven. Haul whatever you need, dump it yourself, bring it back clean on the last day. The deposit comes back to your card once it is checked in."]),
            ("When it is the right call", ["Moving house with a pickup. Your own dump runs at your own pace. Gravel, mulch, soil in. Branches and yard waste out. Anything where you would rather do the driving than pay for a bin to sit."]),
            ("What you need", ["A truck with a hitch rated for it and a driver comfortable towing. The trailer comes with the tie-downs; you bring the muscle. Damage and overages are covered by the card on file, same as every rental, and it is all on the terms page."]),
        ],
        "faq": [
            ("What is the deposit for?", "It is ${{TRD:trailer_dep}}, refundable, and it covers the trailer coming back on time and in one piece. It is returned to your card once the trailer is checked in."),
            ("Can I keep it longer than I booked?", "Call before the last day and we extend it at the daily rate if it is not booked behind you. Bringing it back late without a call runs into the late fee on the terms page, so call."),
            ("Is the dump fee included?", "No. With the trailer you are doing your own dump runs and paying the dump directly. The bins include the dump fee; the trailer is the do-it-yourself option, which is why it is cheaper per day."),
        ],
    },
    {
        "slug": "bin-switch", "name": "Bin Switch", "price": "${{TRD:binswitch}}", "unit": "per switch",
        "book": "/book?service=binswitch", "img": P + "13_gallery_photo_3.jpeg",
        "title": "Bin Switch, Same-Trip Dumpster Swap in Weber County, UT",
        "description": "Filled the dumpster before the job is done? A bin switch hauls the full one and drops a fresh one in the same trip, ${{TRD:binswitch}}. Serving West Haven, Ogden, Roy and the Wasatch Front. Call 801-564-3164.",
        "h1": "Dumpster swap-out in<br>West Haven &amp; Ogden.<br><em>Full bin? Same trip.</em>",
        "lead": "A remodel that found another wall. A roof with one more layer than anyone thought. A cleanout that kept going. When the bin fills before the job ends, a switch hauls the full one away and drops a fresh one in the same trip, so nothing sits and nobody waits.",
        "sections": [
            ("How it works", ["Book the switch online or call, and tell us the job you are on. The driver pulls the full bin, runs it to the dump, and sets an empty one in the same spot, same visit. The switch is ${{TRD:binswitch}}; the new bin's rental and dump fee are billed like any other rental."]),
            ("Before you need one", ["If you think you might fill it, start one size up. A 20 costs only a little more than a 15 and saves a ${{TRD:binswitch}} switch. If you are not sure, call and describe the job; we have placed enough bins to guess well."]),
        ],
        "faq": [
            ("How fast can you switch a bin?", "Usually same day or next morning, depending on where the trucks are. Call as soon as you can see the top of the pile and we will slot it in."),
            ("Does the new bin start a new rental?", "Yes. The switch fee covers the extra trip; the fresh bin is a new rental at the normal rate, dump fee included."),
            ("Can I switch to a bigger size?", "Yes, if one is free. Tell us when you book the switch and we bring the size you need."),
        ],
    },
]

CITIES = [
    {"slug": "west-haven", "name": "West Haven", "county": "Weber", "min": 0, "line": "Home base. Our own neighborhood, same-day most days.",
     "body": ["This is where the trucks live. A West Haven address is the easiest one we serve: same-day delivery most days, pickup when you say, and a driver who has probably been down your street. Cleanouts, remodels, yard projects and the new builds going in on the west side.", "The shop is on 4250 West. Book online or call, and we are minutes away."]},
    {"slug": "roy", "name": "Roy", "county": "Weber", "min": 5, "line": "Next door. Garage cleanouts, moving, remodels.",
     "body": ["Roy is five minutes from the shop and most of what we drop there is residential: a 15 for the garage, a 20 for the kitchen, a move-out, a yard that got away. Driveways are standard width, so the 15 and 20 sit fine; tell us which side and the driver sets it there.", "Same prices as everywhere else, dump fee included, and an easy same-day when you need it."]},
    {"slug": "hooper", "name": "Hooper", "county": "Weber", "min": 7, "line": "Bigger lots, barns, sheds, yard waste by the acre.",
     "body": ["Hooper has the room: acreage, outbuildings, fence lines and the brush that comes with them. Shed teardowns, barn cleanouts, fence and deck debris, and the pile behind the garage that finally gets dealt with. A 20 or a 25 on a lot like that is no problem to place.", "Heavy loads (dirt, concrete, brick) have weight limits; call first and we will set up the right container."]},
    {"slug": "ogden", "name": "Ogden", "county": "Weber", "min": 12, "line": "The big one. Old homes, remodels, street permits.",
     "body": ["Ogden is the biggest city on our run and the oldest housing stock: full-gut remodels, basement finishes, estate cleanouts, roof tear-offs on 1920s bungalows, and commercial jobs on and off Washington. If the bin has to sit on the street rather than a driveway, the city wants a permit; the booking form asks, and we will tell you what to do.", "Same-day and next-day delivery most of the year. Book online or call."]},
    {"slug": "riverdale", "name": "Riverdale", "county": "Weber", "min": 8, "line": "Established neighborhoods. Basements, roofs, cleanouts.",
     "body": ["Riverdale is established streets and busy retail, which means basement finishes, roof tear-offs, kitchen remodels and the odd commercial cleanout. The 20 covers most of it; a 25 for a full roof or a whole-house job.", "Ten minutes from the shop, so a quick swap or an early pickup is easy to fit in."]},
    {"slug": "south-ogden", "name": "South Ogden", "county": "Weber", "min": 12, "line": "Bench neighborhoods. Remodels and cleanouts.",
     "body": ["South Ogden is bench homes with steeper drives and tighter turns, and we have placed plenty of bins on them. Remodels, flooring, estate cleanouts and roofing are the usual calls; tell us about the slope and the driver will bring boards.", "Book online with your address and we confirm the placement by text."]},
    {"slug": "washington-terrace", "name": "Washington Terrace", "county": "Weber", "min": 10, "line": "Post-war homes, remodel after remodel.",
     "body": ["Washington Terrace is post-war housing that is being opened up one kitchen and one basement at a time. A 15 or 20 in the driveway handles most of those; bathroom gut, flooring, cabinets, drywall. Garage cleanouts and move-outs round it out.", "Ten minutes from West Haven. Same prices, dump fee included."]},
    {"slug": "north-ogden", "name": "North Ogden", "county": "Weber", "min": 20, "line": "Up the bench. Roofing, landscaping, big yards.",
     "body": ["North Ogden sits up against the mountain with bigger yards and bigger projects: landscaping tear-outs, retaining walls coming down, roof replacements, and the remodels that go with older bench homes. The 20 is the workhorse; the 25 for roofing and full cleanouts.", "About twenty minutes from the shop, and still on the same-day list when the schedule allows."]},
    {"slug": "plain-city", "name": "Plain City", "county": "Weber", "min": 10, "line": "Acreage and new builds, side by side.",
     "body": ["Plain City is farm lots next to new subdivisions, so we see both ends: construction debris and landscaping on the new streets, shed and barn cleanouts on the old ones. Plenty of room to place a 25 where it is useful.", "Ten minutes out. Book online or call and we will fit the bin to the job."]},
    {"slug": "farr-west", "name": "Farr West", "county": "Weber", "min": 10, "line": "Shops, garages, and the pile behind them.",
     "body": ["Farr West is shops, garages and larger lots along the west side, which means cleanouts, demolition debris and yard projects with room to work. A 20 or 25 in the drive or on the lot is easy.", "Close to the shop, so same-day is usually on the table."]},
    {"slug": "clinton", "name": "Clinton", "county": "Davis", "min": 10, "line": "Davis side. Subdivisions, landscaping, move-outs.",
     "body": ["Clinton is the first town across the county line and we are there most weeks: landscaping tear-outs, fence and deck debris, flooring and kitchen remodels, and move-out cleanouts. Standard driveways, so the 15 and 20 sit right.", "Same prices as Weber County, dump fee included."]},
    {"slug": "syracuse", "name": "Syracuse", "county": "Davis", "min": 12, "line": "Newer homes, yards being finished, remodels starting.",
     "body": ["Syracuse is newer subdivisions finishing their yards and older streets starting to remodel. Landscaping and sod, deck builds and tear-downs, basement finishes, and the garage that filled up during the build. The 20 is the go-to.", "A dozen minutes from West Haven. Book online with your address."]},
    {"slug": "clearfield", "name": "Clearfield", "county": "Davis", "min": 15, "line": "Busy turnover. Rentals, remodels, move-outs.",
     "body": ["Clearfield turns over fast: rentals being flipped between tenants, move-outs, basement finishes and the remodels that come with older homes near the base. Landlords and property managers book us for several addresses at once; the 15 and 20 do most of it.", "Fifteen minutes from the shop, and the prices do not change with the county line."]},
    {"slug": "layton", "name": "Layton", "county": "Davis", "min": 15, "line": "Bigger homes, bigger remodels, commercial too.",
     "body": ["Layton is the largest town in Davis County for us: whole-floor remodels, roofing, estate cleanouts and commercial fit-outs along the Hill Field corridor. The 20 and 25 both earn their keep here, and a bin switch keeps long jobs moving.", "Fifteen minutes out. Same-day when the schedule allows."]},
    {"slug": "kaysville", "name": "Kaysville", "county": "Davis", "min": 20, "line": "Established streets, careful driveways.",
     "body": ["Kaysville is established neighborhoods with nice driveways, and our drivers set bins on boards there without being asked. Kitchen and bath remodels, flooring, landscaping and the occasional roof. The 20 covers most of it.", "Twenty minutes from West Haven, same prices, dump fee included."]},
    {"slug": "farmington", "name": "Farmington", "county": "Davis", "min": 25, "line": "South Davis. Remodels and cleanouts, longer drive.",
     "body": ["Farmington is the far end of our Davis County run and we cover it regularly: remodels, estate cleanouts, landscaping and roofing. The drive is longer; the price is not different.", "Book online or call, and we will confirm the delivery window for the distance."]},
    {"slug": "morgan", "name": "Morgan", "county": "Morgan", "min": 35, "line": "Up the canyon. Cabins, construction, cleanouts.",
     "body": ["Morgan and Mountain Green are up Weber Canyon and we run out there for new construction, cabin and outbuilding cleanouts, roofing and remodels. A 25 on a building lot, a 20 for a cleanout.", "About thirty-five minutes from the shop. Call to set the day and we will make it count."]},
    {"slug": "bountiful", "name": "Bountiful", "county": "Davis", "min": 30, "line": "South end of Davis. We cover it; call to confirm.",
     "body": ["Bountiful is at the edge of the regular run, and we take jobs there: remodels, cleanouts, roofing. Call with the address and the dates and we will confirm the window.", "Same prices, dump fee included. Scheduling is a little tighter this far south, so a day or two of notice helps."]},
    {"slug": "salt-lake-city", "name": "Salt Lake City", "county": "Salt Lake", "min": 40, "line": "The far end. Covered, with a call first.",
     "body": ["Salt Lake City is the far end of the four counties we serve, and we do deliver there: commercial jobs, remodels, cleanouts. Call first with the address so we can confirm the date and the placement, and whether the street needs a permit.", "Prices are the same as West Haven. Forty minutes from the shop."]},
]

# ── City pages, consolidated 2026-09-22 ──────────────────────────────────────
# 19 near-identical city pages (85% the same text) sat in GSC "Discovered -
# currently not indexed". Only KEPT_CITIES get a page now, each with its own
# long-form copy + FAQ below; the rest are listed (unlinked) on the hub and
# their old URLs 301 to /service-area/ in worker/src/marketing.js
# (RETIRED_CITIES there must match). Keep claims to what is true of the
# business: no invented job counts, reviews or city-specific rules.
KEPT_CITIES = ["west-haven", "roy", "hooper", "ogden", "plain-city", "syracuse", "clearfield", "layton"]
RETIRED_CITIES = [c["slug"] for c in CITIES if c["slug"] not in KEPT_CITIES]

PRICE_ANSWER = ("Same prices as everywhere we serve: 15 yard ${{TRD:d15_13}} for 1 to 3 days (${{TRD:d15_47}} for 4 to 7), "
                "20 yard ${{TRD:d20_13}} (${{TRD:d20_47}}), 25 yard ${{TRD:d25_13}} (${{TRD:d25_47}}). Delivery, pickup and the dump fee "
                "are included; Utah sales tax is added at checkout.")

def price_q(city):
    return (f"How much does a dumpster rental cost in {city}, UT?", PRICE_ANSWER)

def permit_q(city):
    return (f"Do I need a permit for a dumpster in {city}?",
            f"Not for a bin on your own driveway, yard or private lot. If it has to sit on the public street or sidewalk, "
            f"{city} can require a right-of-way permit, so check with the city before delivery. The booking form asks where "
            f"the bin goes, and in most cases a driveway placement avoids the question entirely.")

CITY_EXTRA = {
    "west-haven": {
        "zips": "84401", "covers": [],
        "more": [
            "West Haven has grown fast, and the jobs follow: landscaping on new builds, basement finishes in homes a few years old, garage cleanouts after a move. A 15 handles a garage; a 20 is the usual pick for a basement finish or a yard tear-out; the 25 is for a whole-house cleanout or a roof.",
            "Because the trucks start here, West Haven is also where a bin switch is quickest to arrange: call when the bin is full and we swap it for an empty one in the same trip.",
        ],
        "faq": [
            ("Can I get a dumpster the same day in West Haven?", "Often, yes. The trucks are parked in West Haven, so a same-day delivery here is the easiest one to fit in. Book online or call {phone} early in the day for the best chance."),
            price_q("West Haven"),
            permit_q("West Haven"),
        ],
    },
    "roy": {
        "zips": "84067", "covers": [],
        "more": [
            "Roy is mostly established single-family streets, so the jobs are household-sized: a garage that finally gets emptied, a kitchen or bathroom remodel, new flooring, an old deck or fence coming out. The 15 fits most of those; step up to a 20 when a remodel includes drywall and cabinets.",
            "Roy is close enough to the shop that pickups are easy to move. Finished early? Call and we come get it. Need longer? Extensions are ${{TRD:ext_day}} a day; call before the pickup date.",
        ],
        "faq": [
            price_q("Roy"),
            ("Do you do junk removal in Roy?", "Yes, on weekends, ${{TRD:junk}} flat: we bring the truck and the crew, load it, haul it away and pay the dump. On a weekday, a 15 yard bin in the driveway is usually the cheaper way to clear the same pile."),
            permit_q("Roy"),
        ],
    },
    "hooper": {
        "zips": "84315", "covers": [],
        "more": [
            "On acreage the question is where to put the bin, not whether it fits. Pick a spot the truck can back up to on firm ground; soft fields and wet lawns can rut under a loaded truck, so a gravel drive or pad is the best place in spring.",
            "Brush and yard waste are light and bulky, which is why a 20 or 25 makes sense for clearing fence lines and tree trimmings. Dirt, rock and concrete are the opposite: heavy for their size, with weight limits, so call before you load them.",
        ],
        "faq": [
            ("Can you put a dumpster in a field or behind a barn?", "Yes, as long as the truck can reach the spot on firm, level ground with room to back in and set the bin down. Tell us where you want it when you book and the driver will place it there if it is safe to."),
            ("Can I put branches and yard waste in the dumpster?", "Yes. Branches, brush, sod and general yard waste are fine. Keep out hazardous waste, liquids, propane and fuel, and call first for dirt, rock or concrete."),
            price_q("Hooper"),
        ],
    },
    "ogden": {
        "zips": "84401, 84403, 84404", "covers": ["South Ogden", "Washington Terrace", "Riverdale", "North Ogden"],
        "more": [
            "Older homes make heavier debris: plaster and lath, several layers of roofing, brick. Those are dense, so a bin can reach its weight limit before it looks full. For a plaster tear-out or a multi-layer roof, say so when you book and we will suggest a size that stays under the weight allowance.",
            "We cover the neighborhoods around the city at the same prices: South Ogden and Washington Terrace on the bench, Riverdale to the south, and North Ogden up against the mountain. Steep bench driveways are fine; tell us about the slope and the driver brings boards.",
        ],
        "faq": [
            permit_q("Ogden"),
            price_q("Ogden"),
            ("Do you serve South Ogden, Riverdale and North Ogden?", "Yes. South Ogden, Washington Terrace, Riverdale and North Ogden are all on our regular run from West Haven, at the same prices as Ogden itself."),
        ],
    },
    "plain-city": {
        "zips": "84404", "covers": ["Farr West"],
        "more": [
            "The new subdivisions produce construction and landscaping debris: framing offcuts, drywall scraps, sod, and the packaging that comes with finishing a house. The older properties produce the rest: sheds coming down, fences, and years of stored equipment.",
            "Farr West, just east, is covered at the same prices, and so are the lots and shops along the west side between the two.",
        ],
        "faq": [
            price_q("Plain City"),
            ("Can builders and contractors book a dumpster in Plain City?", "Yes. Contractor and commercial jobs are quoted rather than booked at the online price: use the commercial option on the booking page or call {phone}, and Joseph will set it up."),
            ("Do you deliver to Farr West?", "Yes. Farr West is about ten minutes from the shop, same prices, dump fee included."),
        ],
    },
    "syracuse": {
        "zips": "84075", "covers": ["West Point", "Clinton"],
        "more": [
            "Many Syracuse homes are at the stage of finishing basements and building out yards. Those jobs make a steady mix of drywall, framing lumber, carpet pad, sod and landscape rock. Keep rock and dirt out of the bin or tell us first: they are heavy and have weight limits.",
            "West Point and Clinton are next door and covered at the same prices.",
        ],
        "faq": [
            price_q("Syracuse"),
            ("What size dumpster do I need for a basement finish?", "A 20 yard handles most basement finishes: drywall scraps, framing offcuts, packaging and flooring. A small one-room finish fits in a 15; a full basement gut with old carpet and walls coming out is a 25."),
            ("Do you serve West Point and Clinton?", "Yes, both are a few minutes from Syracuse and covered at the same prices."),
        ],
    },
    "clearfield": {
        "zips": "84015", "covers": ["Sunset"],
        "more": [
            "For a landlord turning over a rental, a 15 is usually enough for one unit's carpet, broken furniture and left-behind trash. Mattresses, tires and appliances with refrigerant can go in but carry a handling fee, so mention them when you book.",
            "If the bin goes in an apartment or complex lot, get the manager's OK first and tell us exactly where to set it, so the driver is not guessing on a crowded lot.",
        ],
        "faq": [
            price_q("Clearfield"),
            ("Can a landlord book a dumpster for a rental property?", "Yes. Book with the property's address and your own phone and email; the confirmation, reminders and pickup texts come to you, not the tenant."),
            ("Do you deliver to Sunset?", "Yes. Sunset is right next to Clearfield and covered at the same prices."),
        ],
    },
    "layton": {
        "zips": "84040, 84041", "covers": ["Kaysville", "Farmington"],
        "more": [
            "On a long remodel, a bin switch keeps the job moving: we pick up the full bin and drop an empty one in the same trip, so the crew never stops for want of a place to throw things. It is ${{TRD:binswitch}} flat.",
            "We also run south to Kaysville and Farmington at the same prices. The farther south, the more a day or two of notice helps with scheduling.",
        ],
        "faq": [
            price_q("Layton"),
            ("Can I swap a full dumpster for an empty one?", "Yes. That is a bin switch: ${{TRD:binswitch}} flat, we take the full bin and leave an empty one in the same trip. Call {phone} when the bin is full."),
            ("Do you serve Kaysville and Farmington?", "Yes. Both are on our Davis County run at the same prices; book a day or two ahead if you can."),
        ],
    },
}

FAQ = [
    ("What size dumpster do I need?", "Three sizes: 15 yard (about five pickup loads; garage cleanouts, small remodels, yard waste), 20 yard (about seven loads; kitchens, flooring, landscaping, estate cleanouts; our most-rented), and 25 yard (about nine loads; construction, roofing, whole-home cleanouts). Not sure? Call and describe the job; we will fit the bin to it."),
    ("What does the price include?", "Delivery, pickup, the rental period and the dump fee. The 1 to 3 day and 4 to 7 day prices are on the home page for every size. Utah sales tax is added at checkout. Extra days, overweight loads and prohibited items are the only other charges, and they are spelled out on the terms page."),
    ("Is the dump fee really included?", "Yes, on every bin rental. You are not billed by the ton at pickup for a normal load. Very heavy loads (concrete, dirt, brick) have a weight limit and the overage is billed per ton, which is why heavy material wants its own small container; call first for those."),
    ("How long can I keep the bin?", "1 to 3 days or 4 to 7 days, priced separately. Need longer? Call before pickup and we extend it at ${{TRD:ext_day}} a day. If the bin fills before the job is done, a bin switch hauls the full one and drops a fresh one in the same trip."),
    ("How fast can you deliver?", "Same-day and next-day delivery are available most of the year, depending on where the trucks are. Book online with your date or call and ask."),
    ("Where does the bin go?", "Driveway, job site or lot, wherever you point. Drivers set it on boards if you want the concrete protected; just say so when you book. If the bin has to sit on a public street, your city may require a permit; the booking form asks, and we will tell you what your city does."),
    ("What can I not put in it?", "Hazardous waste, wet paint and other liquids, asbestos, propane tanks and fuel. Tires, mattresses and appliances with refrigerant can go but carry a handling fee. The full list is on the terms page."),
    ("How do I book and pay?", "Pick the size and the dates on the booking page, enter the address and pay by card. You get a confirmation text with your reference number, a reminder the day before delivery and the day before pickup. Commercial accounts can request a quote instead and Joseph calls back."),
    ("Where do you deliver?", "Weber, Morgan, Davis and Salt Lake County, from a shop in West Haven. The service area page lists every city with how far it is from us. Out past that, call and ask; if it is too far we will say so rather than waste your time."),
    ("Do you do junk removal?", "Yes, weekends only, ${{TRD:junk}} flat: we bring the truck and the crew, load it, haul it and pay the dump. Weekdays, a 15 yard bin is usually the answer."),
    ("Can I rent a dump trailer instead?", "Yes. ${{TRD:trailer_day}} a day, 1 to 14 days, with a ${{TRD:trailer_dep}} refundable deposit. You do the hauling and the dump runs yourself; it is the do-it-yourself option."),
    ("Who am I dealing with?", "Joseph Rodrigues and his family. Triple R Dump is family-owned and operated out of West Haven, and the person who answers the phone is the person who books the job."),
]

# ──────────────────────────────────────────────────────────── helpers ─────

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))

def T(key):
    """A live-price token the worker replaces with the current CMS value."""
    return "{{TRD:" + key + "}}"

def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, indent=2) + "</script>"

def breadcrumbs(items):
    return ld({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + p} for i, (n, p) in enumerate(items)
        ],
    })

PROVIDER = {"@type": "LocalBusiness", "@id": SITE + "/#business", "name": BIZ["name"], "telephone": "+1-" + BIZ["phone"], "url": SITE + "/"}

# The /social/ page's own stylesheet (inline; the page does not load pages.css).
SOCIAL_CSS = r"""/* /social on the nicholstreeremoval.com/social bones: built for one thumb on
   one phone. A moving card of the bins up top with the mark set straight on
   the footage, three big square keys, one loud button, then the rest as a
   quiet list, a dashed note and the footer. Light page, Triple R Dump blue
   where Nichols has orange, the bins' red/white tape drifting on the button. */
:root{
  --disp:'Barlow Condensed','Arial Narrow',sans-serif;
  --body:'Barlow',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
  --accent:#116dff; --accent-lift:#3d8bff; --accent-deep:#0d56c9; --on-accent:#fff;
  --sky:#bde9fb; --hazard:#d42a20; --star:#fbbc05;
  --s-bg:#f4f6f9; --s-bg-2:#e3e9f2;
  --s-card:rgba(255,255,255,.82); --s-card-hi:#fff;
  --s-line:rgba(15,23,38,.09); --s-line-hi:rgba(15,23,38,.2);
  --s-text:#0f1726; --s-text-2:#38445a; --s-text-3:#5f6b80;
  --s-r:22px; --s-r-sm:16px;
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img,svg,video{display:block;max-width:100%}
:focus-visible{outline:2.5px solid var(--accent-lift);outline-offset:3px}

.page{position:relative;min-height:100svh;overflow:hidden;isolation:isolate;background:var(--s-bg);color:var(--s-text);font-family:var(--body);padding:max(14px,env(safe-area-inset-top)) 16px calc(36px + env(safe-area-inset-bottom))}
.page::before{content:'';position:absolute;inset:0;z-index:-2;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(17,109,255,.045) 0 70px,rgba(17,109,255,0) 70px 140px)}
.page::after{content:'';position:absolute;left:50%;top:-120px;width:900px;height:700px;z-index:-1;pointer-events:none;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(17,109,255,.18),transparent 70%)}
.col{max-width:480px;margin:0 auto;display:grid;gap:14px}
.side{display:grid;gap:14px;align-content:start}
.clip,.side>*{animation:s-in .7s cubic-bezier(.16,1,.3,1) both}
.side>*:nth-child(1){animation-delay:.06s}.side>*:nth-child(2){animation-delay:.12s}.side>*:nth-child(3){animation-delay:.18s}.side>*:nth-child(4){animation-delay:.24s}.side>*:nth-child(5){animation-delay:.3s}
@keyframes s-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* the moving card */
.clip{position:relative;border-radius:var(--s-r);overflow:hidden;aspect-ratio:4/5;background:#0d131d;box-shadow:0 18px 44px rgba(15,23,38,.24);isolation:isolate}
.still,.video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.video{opacity:0;transition:opacity .6s ease}
.video.is-playing{opacity:1}
.clip::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(9,14,22,.6) 0%,rgba(9,14,22,.16) 26%,rgba(9,14,22,0) 42%,rgba(9,14,22,.26) 58%,rgba(9,14,22,.92) 100%)}
.logo{position:absolute;z-index:1;top:6%;left:50%;width:34%;max-width:160px;height:auto;transform:translateX(-50%);filter:drop-shadow(0 6px 22px rgba(0,0,0,.5));animation:s-drop .9s .2s cubic-bezier(.16,1,.3,1) both}
@keyframes s-drop{from{opacity:0;transform:translate(-50%,-16px) scale(.92)}to{opacity:1;transform:translateX(-50%)}}
.txt{position:absolute;z-index:1;left:20px;right:20px;bottom:20px;color:#fff}
.where{margin:0 0 8px;font-family:var(--disp);font-weight:700;font-size:.74rem;letter-spacing:.22em;text-transform:uppercase;color:var(--sky)}
.txt h1{margin:0;font-family:var(--disp);font-weight:800;font-size:clamp(2.3rem,11vw,3rem);line-height:.94;letter-spacing:-.01em;text-wrap:balance;color:#fff}
.txt h1 em{font-style:italic;color:var(--accent-lift)}
.sub{margin:10px 0 0;font-size:.9rem;line-height:1.45;color:rgba(255,255,255,.84)}
.rate{display:inline-flex;align-items:center;gap:7px;margin-top:10px;font-size:.86rem;color:rgba(255,255,255,.9)}
.rate b{font-family:var(--disp);font-size:1.05rem;color:#fff}
.rate .stars{display:inline-flex;gap:1px;color:var(--star)}

/* the three keys */
.keys{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.key{display:grid;justify-items:center;gap:8px;padding:16px 6px 14px;border-radius:var(--s-r-sm);background:var(--s-card);border:1px solid var(--s-line);color:var(--s-text);font-family:var(--disp);font-weight:700;font-size:1rem;text-align:center;transition:background-color .2s ease,border-color .2s ease,transform .15s ease}
.key svg{color:var(--accent-deep)}
.key:hover{background:var(--s-card-hi);border-color:var(--s-line-hi)}
.key:active{transform:scale(.97)}

/* the one loud button, the bins' tape drifting across it */
.go{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;padding:18px 18px 18px 20px;border-radius:var(--s-r-sm);background:var(--accent);color:var(--on-accent);box-shadow:0 12px 30px rgba(17,109,255,.32);transition:background-color .2s ease,transform .15s ease}
.go::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.12;background:repeating-linear-gradient(135deg,#fff 0 16px,transparent 16px 32px);background-size:45.25px 45.25px;animation:s-tape 3s linear infinite}
@keyframes s-tape{from{background-position:0 0}to{background-position:45.25px 0}}
.go:hover{background:var(--accent-deep)}
.go:active{transform:scale(.985)}
.go>*{position:relative}
.goT{flex:1;min-width:0}
.goT b{display:block;font-family:var(--disp);font-weight:800;font-size:1.3rem;line-height:1.1}
.goT small{display:block;margin-top:3px;font-size:.84rem;font-weight:500;opacity:.88}
.goArrow{display:grid;place-items:center;width:40px;height:40px;border-radius:99px;background:rgba(255,255,255,.18);flex:none}

/* the list */
.list{border-radius:var(--s-r-sm);background:var(--s-card);border:1px solid var(--s-line);overflow:hidden}
.row{display:flex;align-items:center;gap:14px;padding:14px 16px;color:var(--s-text);transition:background-color .2s ease}
.row+.row{border-top:1px solid var(--s-line)}
.row:hover{background:var(--s-card-hi)}
.rowI{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:12px;background:var(--s-bg-2);color:var(--accent-deep)}
.rowT{flex:1;min-width:0}
.rowT b{display:block;font-family:var(--disp);font-weight:700;font-size:1.08rem;line-height:1.2}
.rowT small{display:block;margin-top:2px;font-size:.8rem;color:var(--s-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rowC{display:grid;color:var(--s-text-3);transition:transform .2s ease,color .2s ease}
.row:hover .rowC{transform:translateX(3px);color:var(--accent-deep)}

/* the dashed note */
.badge{display:flex;gap:14px;align-items:center;padding:16px;border-radius:var(--s-r-sm);border:1px dashed var(--s-line-hi);color:var(--s-text-2);font-size:.88rem;line-height:1.45}
.badge b{color:var(--s-text)}
.badgeI{display:grid;place-items:center;width:48px;height:48px;flex:none;border-radius:99px;background:var(--accent);color:var(--on-accent)}

.foot{text-align:center;font-size:.78rem;color:var(--s-text-3);display:grid;gap:7px;padding-top:10px}
.foot p{margin:0}
.foot a{color:var(--s-text-2);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--s-line-hi)}
.foot a:hover{color:var(--accent-deep)}

@media (max-width:511px){
  .clip{margin:calc(-1 * max(14px,env(safe-area-inset-top))) -16px 0;border-radius:0;aspect-ratio:auto;height:min(78svh,calc(100vw * 1.3))}
  .logo{top:calc(5% + env(safe-area-inset-top))}
}
@media (min-width:700px){.page{padding-top:40px}}
/* Desktop: the phone column would sit in a sea of empty page, so the card
   becomes a tall poster on the left, as tall as the links beside it. Same
   blocks, same order, two columns. */
@media (min-width:920px){
  .page{display:grid;align-items:center;padding:48px 40px}
  .col{max-width:1040px;width:100%;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:stretch}
  .clip{aspect-ratio:auto;height:auto;min-height:620px}
  .logo{width:30%;max-width:170px;top:7%}
  .txt{left:32px;right:32px;bottom:32px}
  .txt h1{font-size:clamp(3rem,4.2vw,3.8rem)}
  .sub{font-size:1rem;max-width:40ch}
  .where{font-size:.8rem}
  .side{gap:16px;padding-top:4px}
  .key{padding:20px 6px 18px;font-size:1.08rem}
  .go{padding:22px 22px 22px 24px}
  .goT b{font-size:1.5rem}
  .goT small{font-size:.9rem}
  .row{padding:15px 18px}
  .foot{text-align:left;padding-top:4px}
}
@media (prefers-reduced-motion:reduce){.clip,.side>*,.go::before,.logo{animation:none}}

"""

# ───────────────────────────────────────────────────────────── icons ──────
# Every icon is a Phosphor Icons 2.1.1 SVG (MIT, assets/icons/LICENSE-phosphor.txt),
# inlined per page as a <symbol> sprite holding only the icons that page uses.
# Nothing is hand drawn. The one exception is the multicolour Google "G"
# (#i-g), which is Google's own mark.
ICON_DIR = os.path.join(ROOT, "assets", "icons")
ICONS = {
    "i-phone": "phone", "i-pin": "map-pin", "i-cal": "calendar-check", "i-dollar": "currency-dollar",
    "i-user": "user", "i-shield": "shield-check", "i-cam": "camera",
    "i-star": "star-fill", "i-ext": "arrow-square-out", "i-ig": "instagram-logo", "i-fb": "facebook-logo",
    "i-web": "globe", "i-bin": "trash", "i-couch": "couch", "i-trailer": "truck-trailer",
    "i-clock": "clock", "i-chev": "caret-right", "i-check": "check-circle",
}
G_SYMBOL = '<symbol id="i-g" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 15.7l7 5.1C15 17.1 19.1 14 24 14c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.6 2 8.4 6.6 6.3 15.7z"/><path fill="#FBBC05" d="M24 46c5.5 0 10.4-1.8 14.2-5l-6.6-5.4C29.6 37.1 27 38 24 38c-5.7 0-10.6-3.1-11.8-8.4l-7 5.4C8.3 41.4 15.6 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.6 2.8-2.2 5.2-4.4 6.8l6.6 5.4C42.1 37 45 31.1 45 24c0-1.3-.2-2.7-.5-4z"/></symbol>'

def _symbol(sid):
    if sid == "i-g":
        return G_SYMBOL
    svg = open(os.path.join(ICON_DIR, ICONS[sid] + ".svg"), encoding="utf-8").read()
    inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1).strip()
    return f'<symbol id="{sid}" viewBox="0 0 256 256" fill="currentColor">{inner}</symbol>'

def sprite(html):
    """The hidden <svg> sprite with exactly the icons `html` references."""
    used = sorted(set(re.findall(r'href="#(i-[a-z]+)"', html)))
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">\n' + "\n".join("  " + _symbol(s) for s in used) + "\n</svg>"

def icon(sid, size=18):
    return f'<svg width="{size}" height="{size}" aria-hidden="true"><use href="#{sid}"/></svg>'

def stars(size=17):
    return '<span class="stars" aria-hidden="true">' + icon("i-star", size) * 5 + "</span>"

def rating_line():
    """Google rating for the head band. The worker fills both data-trd-num numbers."""
    return (f'<a class="hero__stars" href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{stars()}'
            f'<b data-trd-num="g_rating">5.0</b><u><span data-trd-num="g_count">18</span> Google reviews</u></a>')

# ──────────────────────────────────────────────────────────── chrome ──────

def nav():
    return f'''
<header class="hdr" id="hdr">
  <div class="hdr__scrim" aria-hidden="true"></div>
  <nav class="hdr__row" aria-label="Primary">
    <a class="hdr__mark" href="/" aria-label="Triple R Dump, home">
      <img src="/assets/triple-r-dump-icon.webp" alt="" width="48" height="48">
      <span class="hdr__wm">Triple R Dump<b>West Haven, Utah</b></span>
    </a>
    <div class="hdr__nav">
      <a class="nav-a" href="/#bins">Dumpsters &amp; prices</a>
      <a class="nav-a" href="/#reviews">Reviews</a>
      <a class="nav-a" href="/#how">How it works</a>
      <a class="nav-a" href="/service-area/">Service area</a>
      <a class="nav-a" href="/faq/">FAQ</a>
    </div>
    <div class="hdr__acts">
      <a class="btn ghost" href="{BIZ["tel"]}">{icon("i-phone", 17)}{BIZ["phone"]}</a>
      <a class="btn" href="/book">Book a dumpster</a>
    </div>
  </nav>
</header>'''

PAGE_JS = '''<script>
(function () {
  var hdr = document.getElementById('hdr');
  var onScroll = function () { hdr.classList.toggle('is-stuck', window.scrollY > 40); };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  var els = document.querySelectorAll('.rv-in');
  if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('on'); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(function (el) { io.observe(el); });
})();
</script>'''

def footer():
    sizes = "".join(f'<li><a href="/dumpster-rental/{s["slug"]}/">{s["yd"]} yard dumpster</a></li>' for s in SIZES)
    svcs = "".join(f'<li><a href="/{s["slug"]}/">{s["name"]}</a></li>' for s in SERVICES)
    cities = "".join(f'<li><a href="/service-area/{c["slug"]}/">{c["name"]}</a></li>' for c in CITIES if c["slug"] in KEPT_CITIES)
    return f'''
<footer class="ft">
  <div class="ft__grid">
    <div class="ft__brand">
      <picture>
        <source srcset="/assets/triple-r-dump-foot.webp" type="image/webp">
        <img src="/assets/triple-r-dump-foot.png" alt="Triple R Dump" width="416" height="80" loading="lazy">
      </picture>
      <p>Family-owned roll-off dumpster rental in West Haven, Utah. Dump fee included on every bin rental.</p>
      <p class="ft__links"><a href="/faq/">Questions &amp; answers</a><a href="/terms">Terms &amp; fees</a><a href="/bbb/">BBB accredited</a><a href="/contact/">Contact page</a></p>
      <a class="foot-bbb" href="https://www.bbb.org/us/ut/west-haven/profile/dumpster-rentals/triple-r-dump-1126-1000181920/#sealclick" target="_blank" rel="noopener nofollow">
        <img src="https://seal-central-northern-western-arizona.bbb.org/seals/blue-seal-250-52-bbb-1000181920.png" alt="Triple R Dump BBB Business Review" width="250" height="52" loading="lazy">
      </a>
    </div>
    <div><h4>Services</h4><ul>{sizes}{svcs}</ul></div>
    <div><h4>Service area</h4><ul>{cities}<li><a href="/service-area/">Every city we serve</a></li></ul></div>
    <div><h4>Get in touch</h4><ul>
      <li><a href="{BIZ["tel"]}">{BIZ["phone"]}</a></li>
      <li><a href="sms:8015643164">Text a photo</a></li>
      <li><a href="mailto:{BIZ["email"]}">Email Joseph</a></li>
      <li>{BIZ["address"]}</li>
      <li><a href="/social/">Links page</a></li>
      <li><a href="{BIZ["instagram"]}" target="_blank" rel="noopener">@triple.r.dump</a></li>
    </ul></div>
  </div>
  <div class="ft__bottom"><span>© 2026 J. Rodrigues · Triple R Dump</span><span>West Haven, Utah · Weber, Davis, Morgan &amp; Salt Lake County</span><a href="https://getkellan.com" target="_blank" rel="noopener">Made by Kellan</a></div>
  <div class="ft__sig" aria-hidden="true">Triple R Dump</div>
</footer>
<nav class="callbar" aria-label="Call or book">
  <a class="btn ghost" href="{BIZ["tel"]}">{icon("i-phone")}Call</a>
  <a class="btn" href="/book">{icon("i-cal")}Book a dumpster</a>
</nav>
''' + PAGE_JS

def hero(label, h1, sub, img, primary, primary_label, crumbs, pin=False):
    """The inner-page head band: photo, scrims, breadcrumbs, title bottom-left.
    `crumbs` = [(name, href), ...]; the last one is the current page."""
    trail = "".join(
        f'<li><span aria-current="page">{esc(n)}</span></li>' if i == len(crumbs) - 1 else f'<li><a href="{h}">{esc(n)}</a></li>'
        for i, (n, h) in enumerate(crumbs))
    eyebrow_icon = icon("i-pin", 16) if pin else ""
    return f'''
<section class="ph">
  <img class="ph__pic" src="{img}" alt="" fetchpriority="high">
  <div class="hero__scrim" aria-hidden="true"></div><div class="hero__scrim hero__scrim--x" aria-hidden="true"></div>
  <div class="ph__in">
    <nav class="crumbs" aria-label="Breadcrumb"><ol>{trail}</ol></nav>
    <p class="hero__eyebrow">{eyebrow_icon}{label}</p>
    <h1>{h1}</h1>
    <p class="hero__lede">{sub}</p>
    {rating_line()}
    <div class="hero__acts">
      <a class="btn btn--lg" href="{primary}">{icon("i-cal", 19)}{primary_label}</a>
      <a class="btn btn--lg ghost" href="{BIZ["tel"]}">{icon("i-phone", 19)}Call {BIZ["phone"]}</a>
    </div>
  </div>
</section>'''

MQ_ITEMS = ["15 yard", "20 yard", "25 yard", "Junk removal", "Dump trailer", "Bin switch", "Dump fee included", "Same-day delivery"]

def ticker():
    run = "".join(f"<span>{i}</span><i></i>" for i in MQ_ITEMS)
    return f'''
<div class="tape" aria-hidden="true"></div>
<div class="mq" aria-hidden="true"><div class="mq__in">{run}{run}</div></div>'''

def sec(tone, inner, sid=None):
    """One band: tone is paper / stone (light) or dark."""
    idattr = f' id="{sid}"' if sid else ""
    return f'''
<section class="sec sec--{tone}"{idattr}>
  <div class="wrap">{inner}
  </div>
</section>'''

def head(kicker, h2, lede=""):
    led = f'<p class="lede">{lede}</p>' if lede else ""
    return f'\n    <div class="head"><div><p class="kicker">{kicker}</p><h2>{h2}</h2></div>{led}</div>'

def checks(items):
    return '<ul class="checks">' + "".join(f"<li>{icon('i-check')}<span>{i}</span></li>" for i in items) + "</ul>"

def side_card(kicker, big, items, btn_href, btn_label, alt_href, alt_label, extra="", big_cls="", btn_attrs=""):
    return f'''
    <aside class="sidec rv-in">
      <span class="ridge"></span>
      <p class="kicker">{kicker}</p>
      {f'<p class="sidec__big{big_cls}">{big}</p>' if big else ""}{extra}
      {checks(items)}
      <a href="{btn_href}" class="btn"{btn_attrs}>{btn_label}</a>
      <a href="{alt_href}" class="sidec__alt">{alt_label}</a>
    </aside>'''

def bin_card(s, about=False):
    yd = s["yd"]
    if about:
        best = f'<strong>{esc(s["best"])}</strong>'
        btn = f'<a href="/dumpster-rental/{s["slug"]}/" class="btn btn--block ghost ghost--lt">About the {yd} yd</a>'
    else:
        best = f'<strong>{esc(s["best"])}</strong> {esc(s["fits"])}'
        btn = f'<a href="/book?size={yd}" class="btn btn--block">{icon("i-cal")}Book {yd} yd</a>'
    return f'''
      <article class="bin rv-in">
        <div class="bin__pic"><img src="{s["img"]}" alt="{yd} yard roll-off bin" loading="lazy"><span class="bin__tag">{esc(s["tag"])}</span></div>
        <div class="bin__b">
          <h3>{yd}<small>yard</small></h3>
          <p class="bin__for">{best}</p>
          <div class="bin__px"><div><b>${T(f"d{yd}_13")}</b><span>1–3 days</span></div><div><b>${T(f"d{yd}_47")}</b><span>4–7 days</span></div></div>
          {btn}
        </div>
        <span class="ridge"></span>
      </article>'''

def rate_table(only=None):
    cards = "".join(bin_card(s) for s in SIZES if not only or s["slug"] == only)
    return f'\n    <div class="bins{" bins--one" if only else ""}">{cards}\n    </div>'

def faq_block(faqs, title="Questions people ask", tone="paper"):
    items = "".join(f'\n      <div class="faq"><h3>{esc(q)}</h3><p>{esc(a)}</p></div>' for q, a in faqs)
    return sec(tone, head("Straight answers", title) + f'\n    <div class="faqs">{items}\n    </div>')

def faq_ld(faqs):
    return ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})

def cta(tone="stone"):
    return f'''
<section id="contact" class="sec sec--{tone}">
  <div class="wrap pair">
    <div class="callc rv-in">
      <p class="kicker">Ready when you are</p>
      <h2>Book online or<br><em>call the owner.</em></h2>
      <p>Pick the bin, pick the dates, pay by card. Or call and talk it through; {BIZ["owner"]} picks up.</p>
      <a class="callc__num" href="{BIZ["tel"]}">{BIZ["phone"]}</a>
      <div class="callc__acts">
        <a href="/book" class="btn btn--lg">{icon("i-cal", 19)}Book online</a>
        <a href="{BIZ["tel"]}" class="btn btn--lg ghost ghost--lt">{icon("i-phone", 19)}Call {BIZ["phone"]}</a>
      </div>
    </div>
    <div class="infoc rv-in">
      <p class="kicker"><span class="live"></span>Taking bookings</p>
      <p style="margin:0;color:var(--fg-3)">The number on this page rings {BIZ["owner"]}, the owner. Booking online works day or night.</p>
      <dl class="facts">
        <div><dt>Area</dt><dd>Weber, Davis, Morgan &amp; Salt Lake County</dd></div>
        <div><dt>Sizes</dt><dd>15, 20 and 25 yard roll-offs</dd></div>
        <div><dt>Dump fee</dt><dd>Included in every bin rental</dd></div>
        <div><dt>Delivery</dt><dd>Same-day and next-day most days</dd></div>
        <div><dt>Email</dt><dd><a href="mailto:{BIZ["email"]}">{BIZ["email"]}</a></dd></div>
      </dl>
    </div>
  </div>
</section>'''

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">'

def page(path, title, description, body, schemas, og_image=None):
    url = SITE + path
    inner = f'''{nav()}
<main>
{body}
</main>
{footer()}'''
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
  <link rel="canonical" href="{url}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/favicon-32x32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/assets/favicon-16x16.png" type="image/png" sizes="16x16">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Triple R Dump">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:image" content="{SITE}{og_image or HERO_IMG}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  {FONTS}
  <link rel="stylesheet" href="/pages.css">
  {"".join(schemas)}
</head>
<body>
{sprite(inner)}
{inner}
</body>
</html>
'''

def write(rel, content):
    out = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("wrote", rel, len(content.encode("utf-8")), "bytes")

# ─────────────────────────────────────────────────────────── pages ────────
# Section rhythm, as on the homepage: light bands (paper / stone) alternate
# with dark ones; the contact pair sits on a light band above the dark footer.

urls = [("/", "1.0"), ("/book", "0.9"), ("/terms", "0.3")]

# size pages
for s in SIZES:
    path = f"/dumpster-rental/{s['slug']}/"
    title = f"{s['yd']} Yard Dumpster Rental in West Haven, UT | ${T(f'd{s["yd"]}_13')}, Dump Fee Included"
    desc = f"{s['yd']} yard roll-off dumpster rental in West Haven, Ogden, Roy and the Wasatch Front: ${T(f'd{s["yd"]}_13')} for 1–3 days, ${T(f'd{s["yd"]}_47')} for 4–7 days, dump fee included. {s['best']} Book online or call {BIZ['phone']}."
    others = [x for x in SIZES if x["slug"] != s["slug"]]
    body = hero(
        f"{s['tag']} · {s['loads']}",
        f"{s['yd']} yard dumpster rental<br><em>in West Haven, UT</em>",
        esc(s["lead"]),
        s["img"],
        f"/book?size={s['yd']}",
        f"Book the {s['yd']} yd",
        [("Home", "/"), ("Dumpsters & prices", "/#bins"), (f"{s['yd']} yard", path)],
    ) + ticker() + sec("paper",
        head(f'The {s["yd"]} yard', "Straight price.<br><em>Dump's included.</em>",
             f'Delivery, pickup, the rental and the dump fee, in one number. Utah sales tax is added at checkout. Extra days are ${T("ext_day")} each; call before pickup to extend.')
        + rate_table(only=s["slug"])
    ) + sec("dark", f'''
    <div class="two two--even">
      <div>{head("What it takes", "Good for")}
        {checks(esc(g) for g in s["good"])}
      </div>
      <div>{head("Before you book", "Three things")}
        <ul class="points">
          <li><div><strong>Where it goes</strong>{esc(s["fits"])} Tell us which side of the drive; drivers set it on boards if you want the concrete protected. On a public street, your city may want a permit; the form asks.</div></li>
          <li><div><strong>What cannot go in</strong>Hazardous waste, wet paint and liquids, asbestos, propane and fuel. Tires, mattresses and appliances with refrigerant carry a handling fee. Heavy material (concrete, dirt, brick) has a weight limit; call first. <a href="/terms">The full list is on the terms page.</a></div></li>
          <li><div><strong>How it is paid</strong>Online by card when you book. You get a confirmation text with your reference, a reminder the day before delivery and the day before pickup, and a text when it is done.</div></li>
        </ul>
      </div>
    </div>''') + faq_block(s["faq"], title=f"About the {s['yd']} yard", tone="stone") + sec("paper",
        head("Other sizes", "Not the right one?")
        + f'\n    <div class="bins">{"".join(bin_card(o, about=True) for o in others)}\n    </div>'
        + f'\n    <p class="note">Junk gone today instead? <a href="/junk-removal/">Junk removal</a> is weekends only, ${T("junk")} flat. Hauling it yourself? <a href="/dump-trailer-rental/">Dump trailer</a>, ${T("trailer_day")} a day.</p>'
    ) + cta("stone")
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Product", "name": f"{s['yd']} Yard Dumpster Rental", "description": desc,
            "image": SITE + s["img"], "brand": {"@type": "Brand", "name": BIZ["name"]},
            "offers": [
                {"@type": "Offer", "name": "1–3 day rental, dump fee included", "price": T(f"d{s['yd']}_13"), "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": SITE + f"/book?size={s['yd']}", "areaServed": "Weber, Morgan, Davis and Salt Lake County, Utah"},
                {"@type": "Offer", "name": "4–7 day rental, dump fee included", "price": T(f"d{s['yd']}_47"), "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": SITE + f"/book?size={s['yd']}&tier=4-7"},
            ]}),
        faq_ld(s["faq"]),
        breadcrumbs([("Home", "/"), ("Bins & rates", "/#rates"), (f"{s['yd']} yard", path)]),
    ]
    write(f"dumpster-rental/{s['slug']}/index.html", page(path, title, desc, body, schemas, og_image=s["img"]))
    urls.append((path, "0.9"))

# service pages
SIDE_CHECKS = {
    "junk-removal": ["Weekends only", "Truck, crew, hauling and dump fee in one price", "One load; call for more"],
    "dump-trailer-rental": ["1 to 14 days", "${{TRD:trailer_dep}} refundable deposit", "Pick up and return in West Haven"],
    "bin-switch": ["Same-trip swap", "Any size that is free", "New bin billed as a normal rental"],
}
for s in SERVICES:
    path = f"/{s['slug']}/"
    secs = "".join(f'\n        <div class="prose-block"><h2>{esc(h)}</h2>{"".join(f"<p>{esc(p)}</p>" for p in ps)}</div>' for h, ps in s["sections"])
    body = hero(
        f"{s['price']} {s['unit']}",
        s["h1"],
        esc(s["lead"]),
        s["img"],
        s["book"],
        "Book it online",
        [("Home", "/"), (s["name"], path)],
    ) + ticker() + sec("paper", f'''
    <div class="two">
      <div class="prose">{secs}
      </div>{side_card("At a glance", f'{s["price"]}<small>{esc(s["unit"])}</small>', SIDE_CHECKS[s["slug"]], s["book"], "Book it online", BIZ["tel"], f"or call {BIZ['phone']}")}
    </div>''') + faq_block(s["faq"], tone="dark") + sec("stone",
        head("Bins &amp; rates", "Or rent a <em>bin</em>.", "Three sizes, dump fee included, priced by the day.") + rate_table()
    ) + cta("paper")
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Service", "name": s["name"], "serviceType": s["name"], "description": s["description"], "provider": PROVIDER,
            "areaServed": ["Weber County, Utah", "Morgan County, Utah", "Davis County, Utah", "Salt Lake County, Utah"],
            "offers": {"@type": "Offer", "price": s["price"].strip("$"), "priceCurrency": "USD", "url": SITE + s["book"]}, "url": SITE + path}),
        faq_ld(s["faq"]),
        breadcrumbs([("Home", "/"), (s["name"], path)]),
    ]
    write(f"{s['slug']}/index.html", page(path, s["title"], s["description"], body, schemas, og_image=s["img"]))
    urls.append((path, "0.8"))

# service area hub
def city_card(c):
    mins = "the shop" if c["min"] == 0 else f"~{c['min']} min"
    if c["slug"] in RETIRED_CITIES:
        return f'''<li><div class="city"><span class="city__n">{esc(c["name"])}</span><span class="city__m">{mins}</span><span class="city__l">{esc(c["line"])}</span></div></li>'''
    return f'''<li><a href="/service-area/{c["slug"]}/" class="city"><span class="city__n">{esc(c["name"])}</span><span class="city__m">{mins}{icon("i-chev", 14)}</span><span class="city__l">{esc(c["line"])}</span><span class="ridge"></span></a></li>'''

hub_groups = []
for county in ["Weber", "Davis", "Morgan", "Salt Lake"]:
    cs = [c for c in CITIES if c["county"] == county]
    hub_groups.append(f'\n    <div class="county"><h2 class="county__h">{county} County</h2><ul class="city-grid">{"".join(city_card(c) for c in cs)}</ul></div>')

hub_body = hero(
    "Where we haul",
    "Weber, Morgan, Davis<br><em>&amp; Salt Lake.</em>",
    "Based in West Haven, serving the Wasatch Front, heart of the city or out past the edge of it. Every city below gets the same prices and the same dump-fee-included deal; the only thing that changes is the drive.",
    AREA_IMG,
    "/book",
    "Book online",
    [("Home", "/"), ("Service area", "/service-area/")],
    pin=True,
) + ticker() + sec("dark",
    "".join(hub_groups) + '\n    <p class="note">Not on the list? Call anyway. If a job is a long way out we will say so rather than waste your time.</p>'
) + sec("paper",
    head("Bins &amp; rates", "Same price <em>everywhere</em>.", "Dump fee included. Utah sales tax at checkout.") + rate_table()
) + cta("stone")
write("service-area/index.html", page(
    "/service-area/",
    "Dumpster Rental Service Area: Weber, Davis, Morgan & Salt Lake County, UT | Triple R Dump",
    "Triple R Dump delivers roll-off dumpsters from West Haven across Weber, Morgan, Davis and Salt Lake County: Ogden, Roy, Hooper, Clinton, Syracuse, Layton, Kaysville, Farmington, Morgan, Bountiful and Salt Lake City. Same prices everywhere, dump fee included.",
    hub_body,
    [breadcrumbs([("Home", "/"), ("Service area", "/service-area/")])],
    og_image=AREA_IMG,
))
urls.append(("/service-area/", "0.8"))

# city pages
for c in [x for x in CITIES if x["slug"] in KEPT_CITIES]:
    path = f"/service-area/{c['slug']}/"
    x = CITY_EXTRA[c["slug"]]
    city_faq = [(q, a.replace("{phone}", BIZ["phone"])) for q, a in x["faq"]]
    covers = f" We also cover {', '.join(x['covers'][:-1]) + ' and ' + x['covers'][-1] if len(x['covers']) > 1 else x['covers'][0]} from here." if x["covers"] else ""
    near = sorted([n for n in CITIES if n["slug"] != c["slug"] and n["slug"] in KEPT_CITIES], key=lambda n: abs(n["min"] - c["min"]))[:5]
    dist = "minutes from the shop" if c["min"] == 0 else f"about {c['min']} minutes from our shop in West Haven"
    title = f"Dumpster Rental in {c['name']}, UT | 15, 20 & 25 Yard Bins, Dump Fee Included"
    desc = f"Roll-off dumpster rental in {c['name']}, Utah from Triple R Dump, {dist}. 15, 20 and 25 yard bins from ${T('d15_13')}, dump fee included, same-day delivery available. Book online or call {BIZ['phone']}."
    from_shop = "the shop" if c["min"] == 0 else f"~{c['min']} min from the shop"
    paras = "".join(f"\n        <p>{esc(p)}</p>" for p in c["body"] + x["more"])
    body = hero(
        f"{c['county']} County · {from_shop}",
        f"Dumpster rental<br><em>in {esc(c['name'])}.</em>",
        f"15, 20 and 25 yard roll-off bins delivered to {esc(c['name'])}, {dist}. Dump fee included, same-day available, and the person who answers the phone is the owner.",
        AREA_IMG if c["min"] else HERO_IMG,
        "/book",
        "Book online",
        [("Home", "/"), ("Service area", "/service-area/"), (c["name"], path)],
        pin=True,
    ) + ticker() + sec("paper", f'''
    <div class="two">
      <div class="prose">
        <header class="prose__head"><p class="kicker">{esc(c["name"])}</p><h2>What we haul <em>here</em>.</h2></header>{paras}
        <p>ZIP codes: {esc(x["zips"])}.{esc(covers)}</p>
        <p>Same prices as West Haven, dump fee included. Utah sales tax at checkout. <a href="/faq/">Questions answered here.</a></p>
      </div>{side_card("From the shop", f'{"0" if c["min"] == 0 else c["min"]}<small>{"minutes, give or take; this is home" if c["min"] == 0 else "minutes, give or take"}</small>', ["Same-day and next-day available", "Driveway, lot or street (permit if the city asks)", "Bins set on boards on request"], "/book", "Book online", BIZ["tel"], f"or call {BIZ['phone']}")}
    </div>''') + sec("dark",
        head("Bins &amp; rates", "Straight prices.<br><em>Dump's included.</em>") + rate_table()
        + '\n    <p class="note">Junk gone today? <a href="/junk-removal/">Junk removal</a>, weekends. Hauling it yourself? <a href="/dump-trailer-rental/">Dump trailer</a>, by the day. Bin filled early? <a href="/bin-switch/">Bin switch</a>, same trip.</p>'
        + f'\n    <p class="note">Also serving {", ".join(f"<a href=\"/service-area/{n['slug']}/\">{esc(n['name'])}</a>" for n in near)}, and <a href="/service-area/">the rest of the four counties</a>.</p>'
    ) + faq_block(city_faq, title=f"Dumpster rental in {esc(c['name'])}: <em>questions</em>", tone="stone") + cta("paper")
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Service", "name": f"Dumpster rental in {c['name']}, UT", "serviceType": "Roll-off dumpster rental", "provider": PROVIDER,
            "areaServed": {"@type": "City", "name": c["name"], "containedInPlace": {"@type": "AdministrativeArea", "name": f"{c['county']} County, Utah"}}, "url": SITE + path}),
        faq_ld(city_faq),
        breadcrumbs([("Home", "/"), ("Service area", "/service-area/"), (c["name"], path)]),
    ]
    write(f"service-area/{c['slug']}/index.html", page(path, title, desc, body, schemas, og_image=AREA_IMG))
    urls.append((path, "0.7"))

# FAQ
faq_body = hero(
    "Straight answers",
    "Questions<br><em>people ask.</em>",
    "The things people ask before they book. If yours is not here, the phone works.",
    P + "05_bin_rental_2.jpeg",
    "/book",
    "Book online",
    [("Home", "/"), ("FAQ", "/faq/")],
) + ticker() + faq_block(FAQ, title="Before you book", tone="paper") + sec("dark",
    head("Bins &amp; rates", "Straight prices.<br><em>Dump's included.</em>") + rate_table()
) + cta("stone")
write("faq/index.html", page(
    "/faq/",
    "Dumpster Rental FAQ: Sizes, Prices, What Can Go In | Triple R Dump, West Haven UT",
    "What size dumpster you need, what the price includes, how long you can keep it, what cannot go in, where we deliver and how booking works. Straight answers from Triple R Dump in West Haven, Utah.",
    faq_body,
    [faq_ld(FAQ), breadcrumbs([("Home", "/"), ("FAQ", "/faq/")])],
))
urls.append(("/faq/", "0.6"))

# BBB accreditation
BBB_PROFILE = "https://www.bbb.org/us/ut/west-haven/profile/dumpster-rentals/triple-r-dump-1126-1000181920/"
BBB_SEAL = "https://seal-central-northern-western-arizona.bbb.org/seals/blue-seal-250-52-bbb-1000181920.png"
bbb_body = hero(
    "Accountability, in writing",
    "BBB<br><em>accredited.</em>",
    "Triple R Dump is accredited by the Better Business Bureau. That is not a badge we printed for ourselves; it is a standard we applied for, were vetted against, and have to keep.",
    P + "07_bin_rental_4.jpeg",
    "/book",
    "Book online",
    [("Home", "/"), ("BBB accredited", "/bbb/")],
) + ticker() + sec("paper", f'''
    <div class="two">
      <div class="prose">
        <div class="prose-block"><h2>What accreditation means</h2>
          <p>The BBB accredits businesses that meet its Standards for Trust and keep meeting them: advertise honestly, tell the truth about prices, honor what was promised, and answer when a customer has a problem. Accreditation is reviewed, not bought once and kept forever; a business that stops living up to it loses it.</p>
          <p>For a dumpster company that means the number on the page is the number on your card, the dump fee is included like the site says, and the fees for the rare extras are written down before you book, not discovered after.</p></div>
        <div class="prose-block"><h2>If something goes wrong</h2>
          <p>Call first; the person who answers is the owner and he would rather fix it today than read about it later. But accreditation means you do not have to take our word for that. Our BBB profile is a public channel we are obligated to answer, with our complaint history and current rating in the open.</p></div>
        <div class="prose-block"><h2>Check for yourself</h2>
          <p>The seal here is served by the BBB itself, not by us; it always shows our current standing, and it links straight to <a href="{BBB_PROFILE}" target="_blank" rel="noopener nofollow">our profile on bbb.org</a>. Reviews, rating, history: all of it is theirs to publish, not ours to edit.</p></div>
      </div>{side_card("Verified by the BBB", "", ["Accredited business", "Live rating, straight from bbb.org", "Public complaint channel"], BBB_PROFILE, "See our BBB profile", BIZ["tel"], f"or call {BIZ['phone']}",
                       extra=f'<a class="sidec__seal" href="{BBB_PROFILE}#sealclick" target="_blank" rel="noopener nofollow"><img class="bbb-seal" src="{BBB_SEAL}" alt="Triple R Dump BBB Business Review" width="250" height="52" loading="lazy"></a>',
                       btn_attrs=' target="_blank" rel="noopener nofollow"')}
    </div>''') + sec("dark",
    head("Bins &amp; rates", "Straight prices.<br><em>Dump's included.</em>") + rate_table()
) + cta("stone")
write("bbb/index.html", page(
    "/bbb/",
    "BBB Accredited Business | Triple R Dump, West Haven UT",
    "Triple R Dump is a BBB Accredited dumpster rental company in West Haven, Utah. What accreditation means, how to check our current rating, and where to find our profile on bbb.org.",
    bbb_body,
    [breadcrumbs([("Home", "/"), ("BBB accredited", "/bbb/")])],
    og_image=P + "07_bin_rental_4.jpeg",
))
urls.append(("/bbb/", "0.5"))

# contact (the old Wix site had /contact and it still shows in search results —
# this page exists so that URL lands somewhere real instead of a 404)
MAPS_G = "https://maps.google.com/?q=3539+S+4250+W,+West+Haven,+UT+84401"
MAPS_A = "https://maps.apple.com/?q=3539+S+4250+W,+West+Haven,+UT+84401"
# Google Maps > Share > Embed a map, for Joseph's profile (CID 8339345795908710583).
MAPS_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3001.9984669344267!2d-112.083158!3d41.200007!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x62c23885d8c053df%3A0x73bb4ed1504930b7!2sTriple%20R%20Dump!5e0!3m2!1sen!2sus!4v1791435442660!5m2!1sen!2sus"
contact_body = hero(
    "Call, text or book",
    "Talk to<br><em>the owner.</em>",
    "No call center, no queue. The number here rings Joseph, and the booking page is open all night. Say what the job is and we will tell you which bin, which day and what it costs.",
    HERO_IMG,
    "/book",
    "Book online",
    [("Home", "/"), ("Contact", "/contact/")],
) + ticker() + sec("paper", f'''
    <div class="two">
      <div class="prose">
        <div class="prose-block"><h2>Call or text</h2>
          <p><a href="{BIZ["tel"]}">{BIZ["phone"]}</a>. Calls get answered by the person who books the jobs and drives the trucks; texts get answered between them. Have the drop-off address, the dates and a rough idea of what you are tossing, and it is a two-minute conversation.</p></div>
        <div class="prose-block"><h2>Email</h2>
          <p><a href="mailto:{BIZ["email"]}">{BIZ["email"]}</a> works for quotes, commercial accounts, paperwork and anything with an attachment. For a bin this week, the phone is faster.</p></div>
        <div class="prose-block"><h2>The shop</h2>
          <p>{BIZ["address"]}. That is where the trucks and trailers live; dump trailer pickups and returns happen here. Directions: <a href="{MAPS_G}" target="_blank" rel="noopener">Google Maps</a> or <a href="{MAPS_A}" target="_blank" rel="noopener">Apple Maps</a>.</p></div>
        <div class="prose-block"><h2>Book without calling</h2>
          <p>The <a href="/book">booking page</a> takes the size, the dates and the address, checks that a bin is actually free, and takes payment by card. It is the same calendar we run the trucks from. Junk removal books weekends only; everything else, any day.</p></div>
      </div>{side_card("Reach us", f'<a href="{BIZ["tel"]}">{BIZ["phone"]}</a><small>call or text, the owner answers</small>', ["The owner answers", "Same-day delivery most days", "Booking online, day or night"], BIZ["tel"], f"{icon('i-phone')}Call {BIZ['phone']}", "/book", "or book online",
                       big_cls=" sidec__big--num",
                       extra=f'\n      <p class="sidec__proof"><a href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{icon("i-g", 16)}{stars(15)} <strong data-trd-num="g_rating">5.0</strong> from <span data-trd-num="g_count">18</span> Google reviews</a></p>')}
    </div>''') + sec("dark", head("Where we haul", "Four counties,<br><em>one shop.</em>", 'Weber, Morgan, Davis and Salt Lake County, from West Haven. <a href="/service-area/">Every city we serve is here.</a>') + f'''
    <div class="map-embed">
      <iframe src="{MAPS_EMBED}" title="Map: Triple R Dump, {BIZ["address"]}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <p class="map-cap">{BIZ["address"]} · <a href="{MAPS_G}" target="_blank" rel="noopener">Directions</a></p>
    </div>''') + cta("stone")
write("contact/index.html", page(
    "/contact/",
    "Contact Triple R Dump | Call, Text or Book Online | West Haven, UT",
    f"Call or text Triple R Dump at {BIZ['phone']}, email {BIZ['email']}, or book a dumpster online. Family-owned roll-off dumpster rental at {BIZ['address']}, serving the Wasatch Front.",
    contact_body,
    [
        ld({"@context": "https://schema.org", "@type": "ContactPage", "name": "Contact Triple R Dump", "url": SITE + "/contact/",
            "about": {"@type": "LocalBusiness", "@id": SITE + "/#business", "name": BIZ["name"], "telephone": "+1-" + BIZ["phone"], "email": BIZ["email"], "url": SITE + "/",
                      "address": {"@type": "PostalAddress", "streetAddress": "3539 S 4250 W", "addressLocality": "West Haven", "addressRegion": "UT", "postalCode": "84401", "addressCountry": "US"},
                      "priceRange": "$$", "hasMap": BIZ["gmaps"], "sameAs": SAME_AS}}),
        breadcrumbs([("Home", "/"), ("Contact", "/contact/")]),
    ],
))
urls.append(("/contact/", "0.6"))

# /social/ — the link-in-bio page (Instagram etc.). Built for one thumb on one
# phone, two columns on desktop. Self-contained styles (does NOT use pages.css).
# noindex, not in the sitemap. The video's still is ALSO an <img src> so
# build_deploy.py (which scans src=/href=/srcset=) ships the jpg.
def social_row(href, ico, label, sub, ext=False):
    tgt = ' target="_blank" rel="noopener"' if ext else ""
    return (f'\n      <a class="row" href="{href}"{tgt}><span class="rowI">{icon(ico, 20)}</span><span class="rowT"><b>{label}</b><small>{sub}</small></span>'
            f'<span class="rowC" aria-hidden="true">{icon("i-chev")}</span></a>')

social_inner = f'''<main class="page">
  <div class="col">
    <section class="clip" aria-label="Dumpster rental, dump fee included">
      <img class="still" src="/assets/dump-loop.jpg" alt="">
      <video class="video" src="/assets/dump-loop.mp4" poster="/assets/dump-loop.jpg" muted loop playsinline autoplay preload="metadata"></video>
      <img class="logo" src="/assets/apple-touch-icon.png" alt="Triple R Dump" width="180" height="180">
      <div class="txt">
        <p class="where">West Haven, UT · Weber, Davis, Morgan &amp; Salt Lake</p>
        <h1>Need a bin? <em>Dump fee included.</em></h1>
        <p class="sub">15, 20 and 25 yard roll-off dumpsters, junk removal and dump trailers. Family owned, and the owner answers.</p>
        <a class="rate" href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{stars(14)}<b data-trd-num="g_rating">5.0</b> <span data-trd-num="g_count">18</span> Google reviews</a>
      </div>
    </section>

    <div class="side">
    <nav class="keys" aria-label="Reach us">
      <a class="key" href="{BIZ["tel"]}">{icon("i-phone", 24)}Call</a>
      <a class="key" href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{icon("i-pin", 24)}Google</a>
      <a class="key" href="{BIZ["instagram"]}" target="_blank" rel="noopener">{icon("i-ig", 24)}Instagram</a>
    </nav>

    <a class="go" href="/book">
      <span class="goT"><b>Book a dumpster online</b><small>Pick a size and a date, pay by card. From ${T("d15_13")}.</small></span>
      <span class="goArrow" aria-hidden="true">{icon("i-chev", 20)}</span>
    </a>

    <nav class="list" aria-label="More links">{social_row("/#bins", "i-bin", "Bin sizes &amp; prices", "15, 20 and 25 yard, dump fee included")}{social_row("/junk-removal/", "i-couch", "Junk removal", "We load it and haul it. Weekends, $" + T("junk") + " flat")}{social_row("/dump-trailer-rental/", "i-trailer", "Dump trailer rental", "By the day, for your own runs")}{social_row("/#work", "i-cam", "Our work", "Real bins on real driveways")}{social_row("/", "i-web", "Our website", "Every bin, every service, every town")}{social_row(BIZ["facebook"], "i-fb", "Facebook", "Triple R Dump", ext=True)}{social_row("/bbb/", "i-shield", "BBB accredited", "Our Better Business Bureau profile")}
    </nav>

    <a class="badge" href="{BIZ["tel"]}">
      <span class="badgeI">{icon("i-clock", 24)}</span>
      <span><b>Need a bin today?</b> Same-day delivery most days. Call {BIZ["phone"]} and {BIZ["owner"]} picks up.</span>
    </a>

    <footer class="foot">
      <p>Triple R Dump · West Haven, Utah · Weber, Davis, Morgan &amp; Salt Lake County</p>
      <p><a href="https://getkellan.com" target="_blank" rel="noopener">Made by Kellan</a></p>
    </footer>
    </div>
  </div>
</main>'''

write("social/index.html", f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Triple R Dump · Links</title>
  <meta name="description" content="Book a dumpster online, call the owner, or find Triple R Dump on Google, Instagram and Facebook. Roll-off dumpster rental in West Haven, Utah, dump fee included.">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="{SITE}/social/">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/favicon-32x32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/assets/favicon-16x16.png" type="image/png" sizes="16x16">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<style>
{SOCIAL_CSS}</style>
</head>
<body>
{sprite(social_inner)}
{social_inner}
<script>
  // Fade the loop in over the still only once it is actually playing.
  var v = document.querySelector('.video');
  v.addEventListener('playing', function () {{ v.classList.add('is-playing'); }});
  if (v.play) {{ var p = v.play(); if (p && p.catch) p.catch(function () {{}}); }}
</script>
</body>
</html>
''')

# sitemap + robots (/social/ is deliberately NOT in the sitemap: noindex)
write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url>\n    <loc>{SITE}{p}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{pr}</priority>\n  </url>\n" for p, pr in urls) + "</urlset>\n")
write("robots.txt", "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /booked\nDisallow: /r/\nDisallow: /inv/\nDisallow: /calendar/\n\nSitemap: " + SITE + "/sitemap.xml\n")

print(f"\n{len(urls)} URLs in the sitemap.")
