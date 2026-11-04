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
binswitch ext_day over_ton prohibited (dollars) and tons15 tons20 tons25 (plain numbers).
Never hardcode a dollar amount here again.

ONE PRICE PER BIN (2026-10-09): Joseph confirmed one price covers a rental of up
to 7 days, so every dumpster price shows the d*_47 token once, with the tons
included and the per-ton overage. Never show "1-3 days / 4-7 days" again.

Also written (2026-10-09): dumpster-rental/index.html (the size hub),
guides/ (only when guides_content.py exists next to this file) and
not-found/index.html (the body the worker serves with every browser 404).
"""
import html as html_lib
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://www.triplerdump.com"
TODAY = "2026-10-09"

# Where we deliver (2026-10-09). Logan (Cache County) is the far north end and
# Springville the far south end; every "four counties" line was replaced by these.
AREA_COUNTIES = ["Weber", "Davis", "Box Elder", "Cache", "Morgan", "Salt Lake", "Utah"]
AREA_TEXT = "Weber, Davis, Box Elder, Cache, Morgan and Salt Lake County, and Utah County as far south as Springville"
AREA_SHORT = "Weber, Davis, Box Elder, Cache, Morgan, Salt Lake &amp; Utah County"
AREA_LD = [f"{c} County, Utah" for c in AREA_COUNTIES]

BIZ = {
    "name": "Triple R Dump",
    "owner": "Joseph",
    "phone": "801-564-3164",
    "tel": "tel:+18015643164",
    "sms": "sms:+18015643164",
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

# ── Real job photos (uploads/jobs/, 2026-10-09) ──────────────────────────────
# Owner's own jobs, each GPS-checked to the city in its file name, then EXIF/GPS
# stripped and house numbers blurred. Bin SIZES in them are unknown: never claim
# one. build_deploy.py ships each at <=1280 px (q66, ~240 KB) plus an 800 px
# copy under w800/ (the srcset below); the 2400 px originals stay untouched.
J = "/uploads/jobs/"
JOBS = {
    "roy": [
        ("roll-off-dumpster-rental-roy-ut.jpg", "l", "2026-10-08", "Triple R Dump roll-off dumpster set on the street in front of a home in Roy, Utah, with the roll-off truck behind it"),
    ],
    "clinton": [
        ("dumpster-rental-clinton-ut.jpg", "l", "2026-09-29", "Triple R Dump roll-off truck setting a dumpster on a Clinton, Utah street lined with split-level homes"),
        ("dumpster-delivery-clinton-utah.jpg", "l", "2026-09-29", "Close-up of a Triple R Dump roll-off dumpster at the curb in Clinton, Utah, with its maximum loading level sticker"),
    ],
    "bountiful": [
        ("dumpster-rental-bountiful-ut.jpg", "l", "2026-09-30", "Triple R Dump roll-off dumpster on an old concrete drive beside a detached garage in Bountiful, Utah"),
        ("roll-off-dumpster-bountiful-utah.jpg", "p", "2026-09-30", "Roll-off trailer in front of a Triple R Dump dumpster on a long concrete driveway in Bountiful, Utah"),
    ],
    "north-ogden": [
        ("dumpster-rental-north-ogden-ut.jpg", "l", "2026-09-27", "Triple R Dump roll-off dumpster at the curb on a curved street in North Ogden, Utah"),
        ("roll-off-dumpster-north-ogden-utah.jpg", "p", "2026-09-27", "Triple R Dump roll-off dumpster on asphalt beside a white fence in North Ogden, Utah"),
        ("dumpster-north-ogden-street-placement.jpg", "p", "2026-09-27", "Triple R Dump roll-off dumpster placed in a cul-de-sac street in North Ogden, Utah"),
        ("dumpster-drop-off-north-ogden.jpg", "p", "2026-09-27", "Triple R Dump dumpster and roll-off trailer beside a white shop building in North Ogden, Utah"),
    ],
    "brigham-city": [
        ("dumpster-rental-brigham-city-ut.jpg", "l", "2026-09-12", "Triple R Dump roll-off dumpster on a driveway in front of a garage in Brigham City, Utah, in early morning light"),
        ("roll-off-dumpster-brigham-city-utah.jpg", "l", "2026-09-12", "Close-up of a Triple R Dump roll-off dumpster sitting on wood boards on a Brigham City, Utah driveway"),
    ],
    "springville": [
        ("dumpster-rental-springville-ut.jpg", "l", "2026-09-02", "Triple R Dump roll-off dumpster in front of a brick home in Springville, Utah, with the mountains behind"),
    ],
    "cottonwood-heights": [
        ("dumpster-rental-cottonwood-heights-ut.jpg", "l", "2026-09-01", "Triple R Dump roll-off dumpster on a driveway beside a large lawn and bulk bags in Cottonwood Heights, Utah"),
        ("roll-off-dumpster-cottonwood-heights-utah.jpg", "l", "2026-09-01", "The same Cottonwood Heights, Utah job seen from the street, with the roll-off truck deck in the foreground"),
    ],
}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

def job_dims(orient):
    """Shipped size after build_deploy.py (long edge 1280)."""
    return (1280, 960) if orient == "l" else (960, 1280)

def job_src(name):
    return J + name

def job_srcset(name, orient):
    w, _ = job_dims(orient)
    small = 800 if orient == "l" else 600
    return f"{J}w800/{name} {small}w, {J}{name} {w}w"

# ───────────────────────────────────────────────────────────── sizes ──────

SIZES = [
    {
        "slug": "15-yard", "yd": 15, "img": P + "01_15yd_bin.png", "loadsn": "5",
        "tag": "The driveway bin",
        "best": "Garage cleanouts, small remodels, yard waste, moving.",
        "fits": "Fits in a standard driveway without blocking the garage.",
        "loads": "about five pickup-truck loads",
        "lead": "The 15 yard is the bin for a weekend. A garage that has not been seen in years, a bathroom remodel, the yard after a storm, a move that left a pile behind. It fits in a standard driveway, it holds about five pickup loads, and the dump fee is already in the price.",
        "good": ["Garage and shed cleanouts", "Bathroom and small kitchen remodels", "Yard waste, branches, sod", "Moving and apartment clean-outs", "Roof tear-offs on a small roof", "Carpet, cabinets, drywall from one room"],
        "faq": [
            ("How much fits in a 15 yard dumpster?", "About five full-size pickup loads. Think a two-car garage cleanout, a bathroom remodel, or the debris from one or two rooms. If you are staring at a kitchen, the 20 yard is the safer call."),
            ("Will it fit in my driveway?", "Yes, that is what the 15 is for. It takes roughly one parking space. Tell us which side of the drive you want it on when you book and the driver sets it there, on boards if you want the concrete protected."),
            ("What does ${{TRD:d15_47}} actually cover?", "Delivery, pickup, the rental for up to 7 days, and the dump fee for up to {{TRD:tons15}} tons. Utah sales tax is added at checkout. Extra days are ${{TRD:ext_day}} each and weight over {{TRD:tons15}} tons is ${{TRD:over_ton}} a ton, and prohibited items are charged per item; all of it is spelled out on the terms page. {{TRD:fuel_note}}"),
        ],
    },
    {
        "slug": "20-yard", "yd": 20, "img": P + "02_20yd_bin_side.jpeg", "loadsn": "7",
        "tag": "Our most-rented size",
        "best": "Kitchen remodels, landscaping, flooring, estate cleanouts.",
        "fits": "Still driveway-sized. The right answer when you are not sure.",
        "loads": "about seven pickup-truck loads",
        "lead": "The 20 yard is the one we rent most, and the one we point people at when they are not sure. Kitchen remodels, flooring through a whole main level, a landscaping tear-out, an estate cleanout. Still fits a driveway, holds about seven pickup loads, and the dump fee is included.",
        "good": ["Kitchen remodels and cabinet tear-outs", "Flooring and carpet, whole floor", "Landscaping, fence and deck tear-downs", "Estate and whole-garage cleanouts", "Roof tear-offs on a standard home", "Basement finishes and remodels"],
        "faq": [
            ("Why is the 20 yard your most-rented bin?", "Because it covers the most jobs for the least money. It is the size that handles a kitchen, a floor, or a yard without running out of room, and it still fits in a driveway. When a 15 feels tight, the 20 is the safer call for a little more."),
            ("Can I start with a 15 and switch to a 20?", "Yes. If the bin fills mid-project we haul it and drop the next one in the same trip; that is the bin switch, ${{TRD:binswitch}}. One of our reviews is exactly that story. Cheaper still is to start with the 20."),
            ("What is the price for a week?", "${{TRD:d20_47}}, and that one price covers anything up to 7 days, plus Utah sales tax at checkout. It includes delivery, pickup and the dump fee for up to {{TRD:tons20}} tons; past that it is ${{TRD:over_ton}} a ton. Finished early? Call and we come get it sooner."),
        ],
    },
    {
        "slug": "25-yard", "yd": 25, "img": P + "03_25yd_bin_side.jpeg", "loadsn": "9",
        "tag": "Maximum capacity",
        "best": "Construction, roofing, full-home cleanouts, commercial jobs.",
        "fits": "Needs a longer space: a long driveway, a job site, or the street with a permit.",
        "loads": "about nine pickup-truck loads",
        "lead": "The 25 yard is the big one: construction debris, a full roof, a whole-house cleanout, a commercial job that is going to keep filling it. About nine pickup loads. It needs a longer footprint than the others, so tell us where it is going and we will say whether it fits.",
        "good": ["New construction and demolition debris", "Full roof tear-offs", "Whole-home and hoarding cleanouts", "Commercial and retail fit-outs", "Multi-room remodels", "Bulky furniture, decking, fencing in volume"],
        "faq": [
            ("Do I need a permit for a 25 yard bin?", "Only if it has to sit on a public street. In a driveway or on your own lot, no. If it is going on the street, your city may want a permit; the booking form asks, and we can tell you what your city does."),
            ("Can I put concrete, dirt or brick in it?", "Call first. Concrete, dirt and brick are heavy: a 25 yard includes {{TRD:tons25}} tons, and dense material gets there long before the bin looks full, with weight over that billed at ${{TRD:over_ton}} a ton. Tell us what it is and roughly how much, and we will tell you how much can go in."),
            ("How long can I keep it?", "Up to 7 days for ${{TRD:d25_47}}, plus tax, with {{TRD:tons25}} tons and the dump fee included. Need longer? Call before pickup and we extend it at ${{TRD:ext_day}} a day. On a long job, a bin switch swaps the full bin for an empty one in the same trip."),
        ],
    },
]

SERVICES = [
    {
        "slug": "junk-removal", "name": "Junk Removal", "price": "${{TRD:junk}}", "unit": "flat rate",
        "book": "/book?service=junk", "img": P + "06_bin_rental_3.jpeg",
        "title": "Junk Removal Ogden, Roy & West Haven, UT | ${{TRD:junk}} Flat",
        "description": "Full-service junk removal in Ogden, Roy, West Haven and Weber County: we load it, haul it and pay the dump. ${{TRD:junk}} flat, weekends. Call 801-564-3164.",
        "h1": "Junk removal in<br>West Haven &amp; Ogden.<br><em>We do the lifting.</em>",
        "lead": "Some jobs do not want a bin sitting there for three days; they want it gone by lunch. That is junk removal. We bring the truck and the hands, load it, haul it and pay the dump. One flat rate. Weekends only, so the weekday fleet stays on the bins.",
        "sections": [
            ("What the flat rate covers", ["The truck, the crew, the loading, the hauling and the dump fee, for one load. Furniture, appliances, the pile in the garage, the shed that finally came down, the leftovers after a move or an estate. If you have more than a load, call and we will price it straight before anyone drives over."]),
            ("Weekends only", ["Junk removal runs Saturdays and Sundays. The booking form only lets you pick a weekend date; try a weekday and it tells you so. Pick the day, tell us roughly what and where, pay online, and we show up."]),
            ("What we cannot take", ["Hazardous waste, wet paint and other liquids, asbestos, propane and fuel, tires, appliances with refrigerant (Freon), and electronics such as TVs, monitors, computers and batteries. Mattresses need separate handling and an extra fee, so mention them when you book. The full list is on the terms page. Not sure about something? Ask when you book."]),
        ],
        "faq": [
            ("Is junk removal cheaper than a dumpster?", "For a pile you want gone today with no lifting, it is the right tool. If you are demolishing over several days, a bin is cheaper per yard and sits there while you work. We are happy to tell you which; call."),
            ("Do I have to be home?", "Someone needs to be there to show us what goes and what stays, or you can stage it in one spot and tag it. Either way we confirm before we load."),
            ("What about a weekday?", "Junk removal is weekends only. On a weekday, a 15 yard bin in the driveway is usually the answer; same phone number."),
        ],
    },
    {
        "slug": "dump-trailer-rental", "name": "Dump Trailer Rental", "price": "${{TRD:trailer_day}}", "unit": "per day",
        "book": "/book?service=trailer", "img": P + "14_gallery_photo_4.jpg",
        "title": "Dump Trailer Rental West Haven & Ogden, UT | ${{TRD:trailer_day}}/Day",
        "description": "Rent a dump trailer by the day in West Haven, near Ogden and Roy: ${{TRD:trailer_day}} a day, 1-14 days, ${{TRD:trailer_dep}} refundable deposit. Haul and dump it yourself. 801-564-3164.",
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
        "title": "Dumpster Swap-Out, Ogden & Weber County | ${{TRD:binswitch}} Bin Switch",
        "description": "Bin full before the job is done? We haul it and drop a fresh dumpster in the same trip, ${{TRD:binswitch}} plus the new rental. Ogden, Roy, West Haven and Davis County.",
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
     "body": ["Clinton is the first town across the county line, ten minutes from the shop, and it is mostly family neighborhoods: split-levels and ramblers on wide residential streets. The calls are household jobs: landscaping tear-outs, fence and deck debris, flooring and kitchen remodels, and the cleanout before or after a move.", "Same prices as Weber County, dump fee included, and same-day delivery when the schedule allows."]},
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
    {"slug": "bountiful", "name": "Bountiful", "county": "Davis", "min": 30, "line": "South Davis. Older homes, long drives, remodels.",
     "body": ["Bountiful is south Davis County, about thirty minutes from the shop, and it has some of the oldest housing on our run: long concrete drives, detached garages, mature trees and basements that are finally getting finished. Remodels, roofing, estate cleanouts and yard work are the usual calls.", "Book online with the address and dates like anywhere else. Deliveries this far south are next-day or on a scheduled date, so book a few days ahead when you can."]},
    {"slug": "salt-lake-city", "name": "Salt Lake City", "county": "Salt Lake", "min": 40, "line": "The far end. Covered, with a call first.",
     "body": ["Salt Lake City is toward the south end of our run, and we do deliver there: commercial jobs, remodels, cleanouts. Call first with the address so we can confirm the date and the placement, and whether the street needs a permit.", "Prices are the same as West Haven. Forty minutes from the shop."]},
    {"slug": "brigham-city", "name": "Brigham City", "county": "Box Elder", "min": 25, "line": "North end of the run. Brick ramblers, big yards.",
     "body": ["Brigham City is the north end of our run, about twenty-five minutes up I-15 from the shop. Older brick ramblers with long driveways and garages, wide lots, and the orchards and yards that come with them: garage cleanouts, roof tear-offs, remodels and yard waste.", "Book online with the address like anywhere else, or call and Joseph will set the day; a day of notice helps this far north."]},
    {"slug": "springville", "name": "Springville", "county": "Utah", "min": 75, "line": "Far south end. Book a few days ahead.",
     "body": ["Springville is the far south end of where we deliver, about an hour and a quarter from the shop. We do take jobs there: remodels, roofing, cleanouts and yard projects on the older streets under the mountain.", "The bins are the same 15, 20 and 25 yard roll-offs we run everywhere else, at the same bin prices, with the dump fee included."]},
    {"slug": "tremonton", "name": "Tremonton", "county": "Box Elder", "min": 40, "line": "Bear River Valley. Farm lots, shops, newer streets.",
     "body": ["Tremonton is in the Bear River Valley, about forty minutes north of our shop by I-15 and I-84, past Brigham City. Farm ground, shops and outbuildings sit around older streets near Main Street and newer subdivisions on the edges of town.", "The same 15, 20 and 25 yard bins come here at the same bin prices, dump fee included. Because of the drive, delivery is next-day or on a scheduled date, so book a few days ahead."]},
    {"slug": "logan", "name": "Logan", "county": "Cache", "min": 55, "line": "Far north end. Cache Valley, book ahead.",
     "body": ["Logan is the far north end of where we deliver, about fifty-five minutes from the shop over Sardine Canyon on US-89/91. Older homes around downtown and the university, newer subdivisions out across the valley, and a lot of rental housing near Utah State University.", "Logan books online like the rest of the area, at the same bin prices with the dump fee included. Delivery over the canyon is next-day or on a scheduled date, so book a few days ahead, and allow extra time in winter, when canyon weather can slow the drive."]},
    {"slug": "cottonwood-heights", "name": "Cottonwood Heights", "county": "Salt Lake", "min": 45, "line": "Salt Lake County. Big lots, mature trees, remodels.",
     "body": ["Cottonwood Heights sits on the east bench of Salt Lake County, about forty-five minutes from the shop: big lawns, mature trees, long driveways and homes that are being remodeled or cleared out. Landscaping and tree work, roofing, basement and kitchen remodels, and estate cleanouts are the usual jobs.", "Same bin prices as everywhere else, dump fee included. Deliveries this far south are next-day or scheduled, so book a few days ahead."]},
]

# ── City pages, consolidated 2026-09-22 ──────────────────────────────────────
# 19 near-identical city pages (85% the same text) sat in GSC "Discovered -
# currently not indexed". Only KEPT_CITIES get a page now, each with its own
# long-form copy + FAQ below; the rest are listed (unlinked) on the hub and
# their old URLs 301 to /service-area/ in worker/src/marketing.js
# (RETIRED_CITIES there must match). Keep claims to what is true of the
# business: no invented job counts, reviews or city-specific rules.
# 2026-10-09: six more pages (North Ogden, Clinton, Bountiful, Brigham City,
# Springville, Cottonwood Heights), each backed by real job photos (JOBS above).
# Then Tremonton and Logan (approved by Boston, both closer than Springville):
# NO job photos there, so no "Recent job" section, no past-job claims, and a
# generic hero photo (never another city's job photo, whose caption would lie).
KEPT_CITIES = ["west-haven", "roy", "hooper", "ogden", "plain-city", "syracuse", "clearfield", "layton",
               "north-ogden", "clinton", "bountiful", "brigham-city", "springville", "cottonwood-heights",
               "tremonton", "logan"]
RETIRED_CITIES = [c["slug"] for c in CITIES if c["slug"] not in KEPT_CITIES]

# 2026-10-09 review: the generic price / permit / dumpster-days FAQs repeated on
# every city page (and in their FAQPage schema) made the pages ~57% identical.
# City FAQs are now city-specific; the price lives in the visible rate cards,
# and every city page links the permit and dumpster-days guides once.
def days_q(city, local=""):
    """The "<city> dumpster days / free dumpster" searches are residents looking
    for the city's own cleanup program. Answer truthfully: we are not it, check
    with the city, and here is when a rental is the better tool."""
    return (f"Does {city} have free dumpster days?",
            (local or f"Some cities run free cleanup dumpsters for residents on set dates; check with {city} or its garbage provider for this year's schedule and rules. ")
            + "Those programs are for household and yard items on the city's dates. A rental is the answer if you missed them, need more room than a shared bin, "
              "need it for more than a day, or have remodeling, roofing or contractor debris.")

CITY_EXTRA = {
    "west-haven": {
        "zips": "84401", "covers": [],
        "more": [
            "West Haven has grown fast, and the jobs follow: landscaping on new builds, basement finishes in homes a few years old, garage cleanouts after a move. A 15 handles a garage; a 20 is the usual pick for a basement finish or a yard tear-out; the 25 is for a whole-house cleanout or a roof.",
            "Because the trucks start here, West Haven is also where a bin switch is quickest to arrange: call when the bin is full and we swap it for an empty one in the same trip.",
        ],
        "faq": [
            ("Can I get a dumpster the same day in West Haven?", "Often, yes. The trucks are parked in West Haven, so a same-day delivery here is the easiest one to fit in. Book online or call {phone} early in the day for the best chance."),
            ("Can I pick up the dump trailer in West Haven?", "Yes. The dump trailer is picked up and returned at our shop at 3539 S 4250 W, West Haven: ${{TRD:trailer_day}} a day for 1 to 14 days, with a ${{TRD:trailer_dep}} refundable deposit. Bins are delivered, so you only come to the shop for the trailer."),
            ("How quickly can you swap a full bin in West Haven?", "Usually the same day or the next morning, because the trucks start here. A bin switch is ${{TRD:binswitch}}: we take the full bin and set an empty one in the same trip."),
        ],
    },
    "roy": {
        "zips": "84067", "covers": [],
        "more": [
            "Roy is mostly established single-family streets, so the jobs are household-sized: a garage that finally gets emptied, a kitchen or bathroom remodel, new flooring, an old deck or fence coming out. The 15 fits most of those; step up to a 20 when a remodel includes drywall and cabinets.",
            "Roy is close enough to the shop that pickups are easy to move. Finished early? Call and we come get it. Need longer? Extensions are ${{TRD:ext_day}} a day; call before the pickup date.",
        ],
        "faq": [
            ("Can I rent a dumpster in Roy for just a weekend?", "Yes. One price covers anything from one day to seven, so book it for Friday and call when you are done; we pick it up early at no extra cost. Roy is five minutes from the shop, so an early pickup is easy to fit in."),
            ("Do you do junk removal in Roy?", "Yes, on weekends, ${{TRD:junk}} flat: we bring the truck and the crew, load it, haul it away and pay the dump. On a weekday, a 15 yard bin in the driveway is usually the cheaper way to clear the same pile."),
            days_q("Roy", "Roy City puts free dumpsters out at its Public Works yard during set weeks of the year, for Roy residents only with proof of residency; check royutah.gov or call Roy Public Works at (801) 774-1090 for this year's dates. "),
        ],
        "note": 'Roy City runs its own <a href="https://www.royutah.gov/departments/public_works/community_programs.php" target="_blank" rel="noopener nofollow">free community dumpster program</a> at Public Works during set weeks of the year, for Roy residents only. It is a good fit for a few loads of household junk on the city&#39;s dates; for a remodel, a roof, a move or anything that needs a bin in your own driveway for a few days, rent one.',
    },
    "hooper": {
        "zips": "84315", "covers": [],
        "more": [
            "On acreage the question is where to put the bin, not whether it fits. Pick a spot the truck can back up to on firm ground; soft fields and wet lawns can rut under a loaded truck, so a gravel drive or pad is the best place in spring.",
            "Brush and yard waste are light and bulky, which is why a 20 or 25 makes sense for clearing fence lines and tree trimmings. Dirt, rock and concrete are the opposite: heavy for their size, with weight limits, so call before you load them.",
        ],
        "faq": [
            ("Can you put a dumpster in a field or behind a barn?", "Yes, as long as the truck can reach the spot on firm, level ground with room to back in and set the bin down. Tell us where you want it when you book and the driver will place it there if it is safe to."),
            ("Can I put branches and yard waste in the dumpster?", "Yes. Branches, brush and general yard waste are fine. Sod, dirt, rock and concrete are heavy, so call first and we will tell you how much can go in; tires and old appliances with refrigerant cannot go in at all."),
            ("Can fence and corral debris go in the bin?", "Yes: wood rails, boards, panels and wire fencing are fine, cut to lie flat. Concrete post footings are heavy, so call first if they are coming out too."),
        ],
    },
    "ogden": {
        "zips": "84401, 84403, 84404", "covers": ["South Ogden", "Washington Terrace", "Riverdale", "North Ogden"],
        "more": [
            "Older homes make heavier debris: plaster and lath, several layers of roofing, brick. Those are dense, so a bin can reach its weight limit before it looks full. For a plaster tear-out or a multi-layer roof, say so when you book and we will suggest a size that stays under the weight allowance.",
            "We cover the neighborhoods around the city at the same prices: South Ogden and Washington Terrace on the bench, Riverdale to the south, and North Ogden up against the mountain. Steep bench driveways are fine; tell us about the slope and the driver brings boards.",
        ],
        "faq": [
            ("Do I need a permit for a dumpster in Ogden?", "Not for a bin on your own driveway or lot. Ogden City requires an encroachment permit for anything placed in the public right-of-way, which includes the street and the strip by the sidewalk, so a street placement needs one from the city before delivery. A driveway placement avoids the question."),
            ("Do you serve South Ogden, Riverdale and North Ogden?", "Yes. South Ogden, Washington Terrace, Riverdale and North Ogden are all on our regular run from West Haven, at the same prices as Ogden itself."),
            ("Is a rental the same as Ogden's Dial-A-Dumpster?", "No. Dial-A-Dumpster is Ogden City's free neighborhood cleanup program: residents with an active city utility account sign up with their neighbors, once per calendar year, and the city picks it up after about 48 hours. The city says it is not for personal home projects such as remodeling, moving in or out, or clearing out basements, garages or sheds. Those are exactly the jobs a rental is for: yours alone, on your dates, for up to 7 days."),
        ],
        "note": 'Two city rules worth knowing. Ogden requires an <a href="https://www.ogdencity.gov/274/The-City-Right-of-Way" target="_blank" rel="noopener nofollow">encroachment permit for anything in the public right-of-way</a> (Ogden City Code 7-4-2), so a bin on the street needs the city&#39;s OK first; on your driveway it does not. And Ogden&#39;s <a href="https://www.ogdencity.gov/1113/Dial-A-Dumpster" target="_blank" rel="noopener nofollow">Dial-A-Dumpster</a> is a free neighborhood cleanup bin, once a year for residents with a city utility account; the city says it is not for remodeling, moving, or clearing out basements, garages or sheds. That is what a rental is for.',
    },
    "plain-city": {
        "zips": "84404", "covers": ["Farr West"],
        "more": [
            "The new subdivisions produce construction and landscaping debris: framing offcuts, drywall scraps, sod, and the packaging that comes with finishing a house. The older properties produce the rest: sheds coming down, fences, and years of stored equipment.",
            "Farr West, just east, is covered at the same prices, and so are the lots and shops along the west side between the two.",
        ],
        "faq": [
            ("Can builders and contractors book a dumpster in Plain City?", "Yes. Contractor and commercial jobs are quoted rather than booked at the online price: use the commercial option on the booking page or call {phone}, and Joseph will set it up."),
            ("Do you deliver to Farr West?", "Yes. Farr West is about ten minutes from the shop, same prices, dump fee included."),
            ("Can you set a dumpster on a farm lot or a new-build lot?", "Yes, on firm ground with a straight path for the truck to back in. On a lot that is still being graded, pick a spot that will stay dry and out of the way of the excavator, and on an active build, check with the builder first."),
        ],
    },
    "syracuse": {
        "zips": "84075", "covers": ["West Point", "Clinton"],
        "more": [
            "Many Syracuse homes are at the stage of finishing basements and building out yards. Those jobs make a steady mix of drywall, framing lumber, carpet pad, sod and landscape rock. Keep rock and dirt out of the bin or tell us first: they are heavy and have weight limits.",
            "West Point and Clinton are next door and covered at the same prices.",
        ],
        "faq": [
            ("What size dumpster do I need for a basement finish?", "A 15 yard for a finish of one or two rooms, a 20 yard for a whole basement: drywall scraps, framing offcuts, packaging and flooring. A full basement gut with old carpet and walls coming out is a 25."),
            ("Can sod and landscape rock go in the bin?", "Sod, yes, but it is heavy, and rock and dirt even more so. Call first with roughly how much you have and we will tell you how much fits inside the weight allowance."),
            ("Do you serve West Point and Clinton?", "Yes, both are a few minutes from Syracuse and covered at the same prices."),
        ],
    },
    "clearfield": {
        "zips": "84015", "covers": ["Sunset"],
        "more": [
            "For a landlord turning over a rental, a 15 is usually enough for one unit's carpet, broken furniture and left-behind trash. Tires, refrigerators and left-behind TVs or electronics cannot go in the bin, and a mattress needs a call first, so set those aside before it arrives.",
            "If the bin goes in an apartment or complex lot, get the manager's OK first and tell us exactly where to set it, so the driver is not guessing on a crowded lot.",
        ],
        "faq": [
            ("Can a landlord book a dumpster for a rental property?", "Yes. Book with the property's address and your own phone and email; the confirmation, reminders and pickup texts come to you, not the tenant."),
            ("Do you deliver to Sunset?", "Yes. Sunset is right next to Clearfield and covered at the same prices."),
            ("Can the bin go in an apartment or complex parking lot?", "Yes, with the property manager's OK. Tell us exactly which stalls it can use; the truck needs a straight path to back in, and the bin takes about one long parking space."),
        ],
    },
    "layton": {
        "zips": "84040, 84041", "covers": ["Kaysville", "Farmington"],
        "more": [
            "On a long remodel, a bin switch keeps the job moving: we pick up the full bin and drop an empty one in the same trip, so the crew never stops for want of a place to throw things. It is ${{TRD:binswitch}} flat.",
            "We also run south to Kaysville and Farmington at the same prices. The farther south, the more a day or two of notice helps with scheduling.",
        ],
        "faq": [
            ("Can a business in Layton rent a dumpster?", "Yes. A one-off job that fits a 15, 20 or 25 books online like any other rental; recurring or larger commercial work is quoted, so use the commercial option on the booking page or call {phone}."),
            ("Can I swap a full dumpster for an empty one?", "Yes. That is a bin switch: ${{TRD:binswitch}} flat, we take the full bin and leave an empty one in the same trip. Call {phone} when the bin is full."),
            ("Do you serve Kaysville and Farmington?", "Yes. Both are on our Davis County run at the same prices; book a day or two ahead if you can."),
        ],
    },
    "north-ogden": {
        "zips": "84414 (and part of 84404)", "covers": ["Pleasant View", "Harrisville"],
        "more": [
            "Bench lots make for sloped driveways and curved streets. The driver sets the bin where it will sit level and can be picked up full, on boards if you want the concrete protected; tell us about the slope when you book. Older bench homes also mean heavier debris (plaster, old roofing, brick), which reaches the weight allowance faster than it fills the bin.",
            "Some of the bins in the photos here sit in the street or a cul-de-sac. Rules for bins on the public street vary by city, so if yours has to go there, call North Ogden's public works office first; a driveway placement avoids the question.",
        ],
        "faq": [
            ("Can you deliver a dumpster to a sloped driveway?", "Usually, yes. The driver places it where it sits safely and can be loaded back on the truck when full. Mention the slope when you book, and ask for boards if you want the concrete protected."),
            ("Do you serve Pleasant View and Harrisville?", "Yes. Both are next to North Ogden and covered at the same prices, dump fee included."),
            ("Will old roofing or plaster fit in the weight allowance?", "Often, but check first. Layered shingles and plaster and lath are dense, so they use the {{TRD:tons20}}-ton allowance of a 20 yard faster than they fill it. Call {phone} with the job and we will suggest the size."),
        ],
    },
    "clinton": {
        "zips": "84015", "covers": ["Sunset", "West Point", "Syracuse"],
        "more": [
            "Most Clinton jobs fit a 15 or a 20: a garage cleanout, a flooring job, landscaping or a deck coming out. Standard driveways take either size; if the bin has to go at the curb instead, as in the photos here, call Clinton City's public works office before delivery, since rules for bins on the public street vary by city.",
            "Sunset, West Point and Syracuse are next door and covered at the same prices, and a bin switch is quick to arrange this close to the shop.",
        ],
        "faq": [
            ("How fast can I get a dumpster in Clinton?", "Often the same day or the next morning. Clinton is ten minutes from the shop; book online with your date or call {phone} early in the day for a same-day drop."),
            ("What size dumpster for a Clinton garage cleanout?", "A 15 yard for most one- and two-car garages. If the garage is packed to the ceiling, or the shed and side yard are being cleared too, take the 20."),
            ("Do you serve Sunset and West Point?", "Yes. Both are a few minutes from Clinton and covered at the same prices."),
        ],
    },
    "bountiful": {
        "zips": "84010", "covers": ["Centerville", "Woods Cross"],
        "more": [
            "Older Bountiful homes have older concrete. Ask for boards when you book and the driver sets the bin on them, which spreads the weight on a cracked or aging drive. Long driveways beside detached garages, like the job in the photos here, are an easy placement.",
            "Centerville and Woods Cross are covered at the same prices. Remodels in south Davis County often run longer than planned; extra days are ${{TRD:ext_day}} each, and a bin switch keeps a long job moving.",
        ],
        "faq": [
            ("Will a dumpster damage my driveway?", "A loaded roll-off is heavy, so ask for boards when you book: the driver sets the bin on wood to spread the load, which is the usual answer on older concrete."),
            ("How far ahead should I book a dumpster in Bountiful?", "A few days if you can. Bountiful is about thirty minutes from the shop, so deliveries here are next-day or on a scheduled date rather than same-day."),
            ("Do you serve Centerville and Woods Cross?", "Yes. Both are on the same south Davis County run as Bountiful, at the same prices."),
        ],
    },
    "brigham-city": {
        "zips": "84302", "covers": ["Perry", "Willard"],
        "more": [
            "A long driveway in front of the garage is the typical Brigham City placement, and the photos here show one: the bin set on wood boards so the concrete is protected. Ask for boards when you book.",
            "Perry and Willard, between us and Brigham City, are covered at the same prices. Yard and orchard waste is welcome; keep dirt, rock and concrete out or call first, because heavy material reaches the weight allowance long before the bin is full.",
        ],
        "faq": [
            ("Do you deliver dumpsters to Brigham City?", "Yes. Brigham City is about twenty-five minutes from our shop in West Haven, at the same prices, dump fee included. Book online or call {phone}."),
            ("Can orchard prunings and yard waste go in the bin?", "Yes: branches, prunings, brush and old landscaping are light and bulky, and a 20 holds a big cleanup. Keep dirt and rock out unless you call first; they are heavy."),
            ("Do you serve Perry and Willard?", "Yes. Both sit between our shop and Brigham City and are covered at the same prices."),
        ],
        "note": 'Farther north we also deliver to <a href="/service-area/tremonton/">dumpster rental in Tremonton</a> and over Sardine Canyon to <a href="/service-area/logan/">dumpster rental in Logan</a>, at the same bin prices; book those a few days ahead, and the booking page shows any fuel charge for the distance.',
    },
    "springville": {
        "zips": "84663", "covers": [],
        "more": [
            "Springville books online like every other city we serve, at the same bin prices and with the dump fee included. If the date is tight or the placement is unusual, call {phone} first and Joseph will tell you what fits.",
            "Plan a few days ahead: a delivery this far south has to fit around the rest of the schedule, so same-day is unlikely. Extra days are ${{TRD:ext_day}} each if the job runs long.",
        ],
        "faq": [
            ("Do you deliver dumpsters to Springville?", "Yes. Springville is the far south end of where we deliver; book online or call {phone}, and give us a few days of notice so the delivery fits the schedule."),
            ("Is a dumpster rental more expensive in Springville?", "The bin prices are the same as in West Haven, with delivery, pickup and the dump fee included. {{TRD:fuel_springville}} We just need a few days of notice."),
            ("What should I have ready when I book a Springville delivery?", "The address, where on the property the bin should sit, your dates and roughly what is going in. If it has to go on the street, check with Springville City first."),
        ],
    },
    "tremonton": {
        "zips": "84337", "covers": ["Garland", "Bear River City", "Elwood"],
        "hero": AREA_IMG,
        "more": [
            "On a bigger lot the question is where the bin can sit: firm, level ground the truck can back up to in a straight line, with about 22 feet of clear space overhead, away from power lines and branches. A gravel pad or a hard drive beats a soft field, especially in spring.",
            "Garland, Bear River City and Elwood are next door and covered at the same bin prices.",
        ],
        "faq": [
            ("Do you deliver dumpsters to Tremonton?", "Yes. Tremonton is about forty minutes from our shop in West Haven. {{TRD:fuel_tremonton}} Book online with the address, ideally a few days ahead; delivery this far out is next-day or scheduled rather than same-day."),
            ("Can one bin clear out a shop or outbuilding?", "Usually a 20 or a 25 does it: old lumber, shelving, scrap and stored junk. Tires, appliances with refrigerant, fuel and chemicals cannot go in, and concrete or dirt needs a call first because of the weight."),
            ("Where is the landfill near Tremonton?", "The Box Elder County Landfill is at 9595 W 6800 N in Tremonton, 435-695-2572. Its 2026 hours are 7:30 a.m. to 4:30 p.m. Monday to Friday and 7:30 a.m. to 3 p.m. Saturday, and you must be in 15 minutes before closing. For more than a pickup load or two, a bin with the dump fee included saves the trips."),
            ("Do you serve Garland and Bear River City?", "Yes. Both are next to Tremonton and covered at the same bin prices, dump fee included."),
        ],
        "note": 'If you would rather haul a small load yourself, the <a href="https://www.boxeldercountyut.gov/232/Landfill" target="_blank" rel="noopener nofollow">Box Elder County Landfill</a> at 9595 W 6800 N in Tremonton is open Monday to Saturday (2026 hours on the county page) and charges an extra $5 per mattress or box spring for special handling.',
    },
    "logan": {
        "zips": "84321 and 84341 (84322 is Utah State University)", "covers": ["North Logan", "Hyde Park", "Providence", "River Heights", "Nibley"],
        "hero": HERO_IMG,
        "more": [
            "For a rental turnover or an apartment move-out, a 15 usually holds it; for a kitchen or basement remodel in an older home, a 20. If the bin goes in a shared or complex lot, get the property manager's OK first and tell us exactly where to set it.",
            "North Logan, Hyde Park, Providence, River Heights and Nibley are covered at the same bin prices.",
        ],
        "faq": [
            ("Do you deliver dumpsters to Logan?", "Yes. Logan is about fifty-five minutes from our shop in West Haven, over Sardine Canyon. Book online with the address a few days ahead; delivery over the canyon is next-day or scheduled rather than same-day."),
            ("Do you charge extra to come over the canyon?", "Logan pays the same bin prices as West Haven, with delivery, pickup and the dump fee included. {{TRD:fuel_logan}} We only ask for a few days of notice."),
            ("What size dumpster for a student rental move-out?", "A 15 yard for one apartment or a small house; a 20 if several roommates are moving out at once or the basement is being cleared too. Mattresses need a call first, and TVs and other electronics cannot go in the bin."),
            ("Where can I take a small load myself in Logan?", "Logan City's environmental campus at 153 N 1400 W has a transfer station for household trash, which is hauled on to the North Valley Landfill, and the Logan Landfill, which now mainly takes construction and demolition waste; the scalehouse is 435-716-9777. For more than a pickup load or two, a bin saves the trips."),
        ],
        "note": 'Hauling a little yourself? Logan City runs the <a href="https://www.loganutah.gov/government/departments/environmental/landfill/index.php" target="_blank" rel="noopener nofollow">Logan Landfill and Transfer Station</a> on its environmental campus at 153 N 1400 W, with green waste and household hazardous waste drop-offs on the same campus.',
    },
    "cottonwood-heights": {
        "zips": "84121 (and parts of 84047, 84092 and 84093)", "covers": ["Holladay"],
        "more": [
            "Big lots and mature trees mean a lot of yard and tree debris, which is light and bulky: a 20 or a 25 holds it well. The job in the photos here had the bin on the driveway beside the lawn, with bulk bags staged next to it.",
            "Holladay, next door, is covered at the same bin prices. This is one of the longer drives on the run, so book a day or two ahead when you can.",
        ],
        "faq": [
            ("Do you deliver to Cottonwood Heights from West Haven?", "Yes. It is about forty-five minutes from the shop, at the same bin prices, dump fee included. {{TRD:fuel_cottonwood_heights}} Book online with the address, ideally a few days ahead; deliveries here are next-day or scheduled rather than same-day."),
            ("What size dumpster for tree trimming and yard debris?", "A 20 or a 25. Branches and brush are light but bulky, so they run out of room before weight. Stumps, dirt and rock are heavy; call first for those."),
            ("Do you serve Holladay?", "Yes. Holladay is next door to Cottonwood Heights and covered at the same bin prices."),
        ],
    },
}

FAQ = [
    ("What size dumpster do I need?", "Three sizes: 15 yard (about five pickup loads; garage cleanouts, small remodels, yard waste), 20 yard (about seven loads; kitchens, flooring, landscaping, estate cleanouts; our most-rented), and 25 yard (about nine loads; construction, roofing, whole-home cleanouts). Not sure? Call and describe the job; we will fit the bin to it."),
    ("What does the price include?", "Delivery, pickup, a rental of up to 7 days and the dump fee, in one price per size: 15 yard ${{TRD:d15_47}}, 20 yard ${{TRD:d20_47}}, 25 yard ${{TRD:d25_47}}. Utah sales tax is added at checkout. Extra days, weight over the allowance and prohibited items are spelled out on the terms page. {{TRD:fuel_note}}"),
    ("Is the dump fee really included?", "Yes, on every bin rental, up to a weight allowance: {{TRD:tons15}} tons in a 15 yard, {{TRD:tons20}} in a 20 and {{TRD:tons25}} in a 25. A normal household or remodel load stays under it. Very heavy material (concrete, dirt, brick) gets there fast, and weight over the allowance is ${{TRD:over_ton}} a ton, so call first for those."),
    ("How long can I keep the bin?", "Up to 7 days for the one price. Done sooner? Call and we pick it up early. Need longer? Call before pickup and we extend it at ${{TRD:ext_day}} a day. If the bin fills before the job is done, a bin switch hauls the full one and drops a fresh one in the same trip."),
    ("How fast can you deliver?", "Same-day and next-day delivery are available most of the year, depending on where the trucks are. Book online with your date or call and ask."),
    ("Where does the bin go?", "Driveway, job site or lot, wherever you point. Drivers set it on boards if you want the concrete protected; just say so when you book. If the bin has to sit on a public street, rules vary by city, so check with your city's public works office first (Ogden requires an encroachment permit); a driveway placement avoids the question."),
    ("What can I not put in it?", "Hazardous waste, wet paint and other liquids, asbestos, propane tanks and fuel, tires, appliances with refrigerant (Freon), and electronics such as TVs, monitors, computers and batteries. Each prohibited item found in a load is ${{TRD:prohibited}} under our terms. Mattresses need separate handling and an extra fee, so call first. The Weber County Transfer Station and Davis Landfill take tires, fridges, mattresses and electronics for a small fee; our guide to what can go in a dumpster has their prices."),
    ("How do I book and pay?", "Pick the size and the dates on the booking page, enter the address and pay by card. You get a confirmation text with your reference number, a reminder the day before delivery and the day before pickup. Commercial accounts can request a quote instead and Joseph calls back."),
    ("Where do you deliver?", "From our shop in West Haven to Weber, Davis, Box Elder, Cache, Morgan and Salt Lake County, and Utah County as far south as Springville. Brigham City is about 25 minutes away, Tremonton about 40, Cottonwood Heights about 45, Logan about 55, and Springville, the far end, about an hour and a quarter; book that end a few days ahead. The service area page lists every city with how far it is from us."),
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

BUSINESS_REF = {"@id": SITE + "/#business"}

# What the tokens render as on the live site today (D1, verified 2026-10-08).
# ONLY used to measure titles/descriptions at build time; pages keep the tokens.
LIVE = {
    "d15_13": "320", "d15_47": "320", "d20_13": "375", "d20_47": "375", "d25_13": "425", "d25_47": "425",
    "junk": "550", "trailer_day": "200", "trailer_dep": "300", "binswitch": "220", "ext_day": "50",
    "over_ton": "70", "tons15": "2", "tons20": "3", "tons25": "4", "prohibited": "200",
}

def rendered(text):
    return re.sub(r"\{\{TRD:([a-z0-9_]+)\}\}", lambda m: LIVE.get(m.group(1), m.group(0)), text)

def fit(*cands, limit=60):
    """First candidate whose rendered length fits (titles <= 60)."""
    for c in cands:
        if len(rendered(c)) <= limit:
            return c
    return cands[-1]

def fit_desc(*cands, lo=120, hi=155):
    """First candidate whose rendered length is within lo..hi, else the closest."""
    for c in cands:
        if lo <= len(rendered(c)) <= hi:
            return c
    return min(cands, key=lambda c: abs(len(rendered(c)) - (lo + hi) / 2))

META = []  # (path, title, description) of every page written, for the build report

# Alt text for the stock photos (what is actually in each one).
IMG_ALT = {
    HERO_IMG: "Triple R Dump roll-off dumpster parked at the curb of a residential street at dusk",
    AREA_IMG: "Triple R Dump roll-off dumpster dropped at a curb beside a fenced yard, roll-off trailer behind it",
    P + "01_15yd_bin.png": "Joseph Rodrigues beside a 15 yard Triple R Dump roll-off bin",
    P + "02_20yd_bin_side.jpeg": "Two 20 yard Triple R Dump roll-off bins on grass, with Joseph Rodrigues between them",
    P + "03_25yd_bin_side.jpeg": "Joseph Rodrigues with a 25 yard Triple R Dump roll-off bin",
    P + "06_bin_rental_3.jpeg": "Triple R Dump trailer loaded with junk and debris behind a pickup",
    P + "07_bin_rental_4.jpeg": "Triple R Dump bin tipping its load inside a covered transfer station",
    P + "13_gallery_photo_3.jpeg": "Triple R Dump dump trailer hitched to a pickup under a covered loading area",
    P + "14_gallery_photo_4.jpg": "Pickup truck towing a Triple R Dump trailer loaded with roll-off bins",
}

def month_year(date):
    y, m = date.split("-")[:2]
    return f"{MONTHS[int(m) - 1]} {y}"

def job_caption(city, date, first=True):
    return (f"A Triple R Dump roll-off delivered in {city}, {month_year(date)}." if first
            else f"The same {city} delivery, {month_year(date)}.")

def job_img(name, orient, alt, cls="", sizes="(max-width: 760px) 100vw, 50vw", hero=False):
    """<img> for a job photo: 1600 px + 800 px srcset, width/height, lazy unless hero."""
    w, h = job_dims(orient)
    load = 'fetchpriority="high"' if hero else 'loading="lazy" decoding="async"'
    c = f' class="{cls}"' if cls else ""
    return (f'<img{c} src="{job_src(name)}" srcset="{job_srcset(name, orient)}" sizes="{sizes}" '
            f'width="{w}" height="{h}" alt="{esc(alt)}" {load}>')

def job_figures(slug, city):
    """The "Recent job in <City>" figures for one city (empty if no photos)."""
    out = []
    for i, (name, orient, date, alt) in enumerate(JOBS.get(slug, [])):
        out.append(f'\n      <figure class="job rv-in">{job_img(name, orient, alt)}'
                   f'<figcaption>{esc(job_caption(city, date, i == 0))}</figcaption></figure>')
    return "".join(out)

def image_ld(slug, city):
    """ImageObject per job photo on a city page."""
    out = []
    for i, (name, orient, date, alt) in enumerate(JOBS.get(slug, [])):
        w, h = job_dims(orient)
        out.append(ld({
            "@context": "https://schema.org", "@type": "ImageObject",
            "contentUrl": SITE + job_src(name), "url": SITE + job_src(name),
            "width": w, "height": h,
            "caption": job_caption(city, date, i == 0), "description": alt,
            "contentLocation": {"@type": "Place", "name": f"{city}, UT"},
            "creator": BUSINESS_REF, "copyrightHolder": BUSINESS_REF, "creditText": BIZ["name"],
            "dateCreated": date,
        }))
    return out

def preload_img(name, orient):
    """<link rel=preload> for a job-photo hero (the LCP image)."""
    return (f'<link rel="preload" as="image" href="{job_src(name)}" imagesrcset="{job_srcset(name, orient)}" '
            f'imagesizes="100vw" fetchpriority="high">')

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
    "i-clock": "clock", "i-chev": "caret-right", "i-check": "check-circle", "i-chat": "chat-circle",
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
            f'<b data-trd-num="g_rating">5.0</b><u><span data-trd-num="g_count">20</span> Google reviews</u></a>')

# ──────────────────────────────────────────────────────────── guides ──────
# guides_content.py (repo root) is written separately: UPDATED + GUIDES, strings
# already HTML-escaped and carrying {{TRD:}} tokens. Without it the build still
# works and simply writes no /guides/ pages and no guide links.
try:
    import guides_content as _guides
    GUIDES = list(getattr(_guides, "GUIDES", []))
    GUIDES_UPDATED = getattr(_guides, "UPDATED", TODAY)
except ImportError:
    GUIDES, GUIDES_UPDATED = [], TODAY
GUIDE_BY_SLUG = {g["slug"]: g for g in GUIDES}

def plain(s):
    """Already-escaped guide HTML -> plain text (meta tags, JSON-LD)."""
    return html_lib.unescape(re.sub(r"<[^>]+>", "", str(s)))

def pick_guides(prefer=(), limit=3, exclude=()):
    """Guides whose slug contains any `prefer` word first, then the rest."""
    first = [g for g in GUIDES if any(p in g["slug"] for p in prefer)]
    rest = [g for g in GUIDES if g not in first]
    return [g for g in first + rest if g["slug"] not in exclude][:limit]

def guide_note(prefer=(), limit=3, lead="Planning it out? Read", tone_dark=False):
    gs = pick_guides(prefer, limit)
    if not gs:
        return ""
    links = [f'<a href="/guides/{g["slug"]}/">{plain(g["title"])}</a>' for g in gs]
    joined = links[0] if len(links) == 1 else ", ".join(links[:-1]) + " or " + links[-1]
    return f'\n    <p class="note">{lead} {joined}. <a href="/guides/">Every guide is here.</a></p>'

# ──────────────────────────────────────────────────────────── chrome ──────

def nav():
    fourth = '<a class="nav-a" href="/guides/">Guides</a>' if GUIDES else '<a class="nav-a" href="/#how">How it works</a>'
    return f'''
<header class="hdr" id="hdr">
  <div class="hdr__scrim" aria-hidden="true"></div>
  <nav class="hdr__row" aria-label="Primary">
    <a class="hdr__mark" href="/" aria-label="Triple R Dump, home">
      <img src="/assets/triple-r-dump-icon.webp" alt="" width="48" height="48">
      <span class="hdr__wm">Triple R Dump<b>West Haven, Utah</b></span>
    </a>
    <div class="hdr__nav">
      <a class="nav-a" href="/dumpster-rental/">Dumpsters &amp; prices</a>
      <a class="nav-a" href="/#reviews">Reviews</a>
      {fourth}
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

def kept():
    return [c for c in CITIES if c["slug"] in KEPT_CITIES]

def footer():
    sizes = '<li><a href="/dumpster-rental/">Dumpster sizes &amp; prices</a></li>' + "".join(f'<li><a href="/dumpster-rental/{s["slug"]}/">{s["yd"]} yard dumpster rental</a></li>' for s in SIZES)
    svcs = "".join(f'<li><a href="/{s["slug"]}/">{s["name"]}</a></li>' for s in SERVICES)
    cities = "".join(f'<li><a href="/service-area/{c["slug"]}/">{c["name"]}</a></li>' for c in sorted(kept(), key=lambda c: c["min"]))
    guides = '<a href="/guides/">Guides</a>' if GUIDES else ""
    return f'''
<footer class="ft">
  <div class="ft__grid">
    <div class="ft__brand">
      <picture>
        <source srcset="/assets/triple-r-dump-foot.webp" type="image/webp">
        <img src="/assets/triple-r-dump-foot.png" alt="Triple R Dump" width="416" height="80" loading="lazy">
      </picture>
      <p>Family-owned roll-off dumpster rental in West Haven, Utah, delivering from Logan to Springville. Dump fee included on every bin rental.</p>
      <p class="ft__links"><a href="/faq/">Questions &amp; answers</a>{guides}<a href="/terms">Terms &amp; fees</a><a href="/bbb/">BBB accredited</a><a href="/contact/">Contact page</a></p>
      <a class="foot-bbb" href="https://www.bbb.org/us/ut/west-haven/profile/dumpster-rentals/triple-r-dump-1126-1000181920/#sealclick" target="_blank" rel="noopener nofollow">
        <img src="https://seal-central-northern-western-arizona.bbb.org/seals/blue-seal-250-52-bbb-1000181920.png" alt="Triple R Dump BBB Business Review" width="250" height="52" loading="lazy">
      </a>
    </div>
    <div><h4>Services</h4><ul>{sizes}{svcs}</ul></div>
    <div><h4>Service area</h4><ul>{cities}<li><a href="/service-area/">Every city we serve</a></li></ul></div>
    <div><h4>Get in touch</h4><ul>
      <li><a href="{BIZ["tel"]}">{BIZ["phone"]}</a></li>
      <li><a href="{BIZ["sms"]}">Text a photo</a></li>
      <li><a href="mailto:{BIZ["email"]}">Email Joseph</a></li>
      <li>{BIZ["address"]}</li>
      <li><a href="/contact/">Contact &amp; directions</a></li>
      <li><a href="https://bio.triplerdump.com/">Links page</a></li>
      <li><a href="{BIZ["instagram"]}" target="_blank" rel="noopener">@triple.r.dump</a></li>
    </ul></div>
  </div>
  <div class="ft__bottom"><span>© 2026 J. Rodrigues · Triple R Dump</span><span>West Haven, Utah · {AREA_SHORT}</span><a href="https://pullcount.com/" target="_blank" rel="noopener">Powered by Pull Count</a></div>
  <div class="ft__sig" aria-hidden="true">Triple R Dump</div>
</footer>
<nav class="callbar" aria-label="Call or book">
  <a class="btn ghost" href="{BIZ["tel"]}">{icon("i-phone")}Call</a>
  <a class="btn" href="/book">{icon("i-cal")}Book a dumpster</a>
</nav>
''' + PAGE_JS

def hero(label, h1, sub, img, primary, primary_label, crumbs, pin=False, alt=None, job=None, primary_icon="i-cal", second=None):
    """The inner-page head band: photo, scrims, breadcrumbs, title bottom-left.
    `crumbs` = [(name, href), ...]; the last one is the current page.
    `job` = (name, orient, date, alt) uses a job photo with its srcset instead of `img`."""
    trail = "".join(
        f'<li><span aria-current="page">{esc(n)}</span></li>' if i == len(crumbs) - 1 else f'<li><a href="{h}">{esc(n)}</a></li>'
        for i, (n, h) in enumerate(crumbs))
    eyebrow_icon = icon("i-pin", 16) if pin else ""
    if job:
        pic = job_img(job[0], job[1], job[3], cls="ph__pic", sizes="100vw", hero=True)
    else:
        pic = f'<img class="ph__pic" src="{img}" alt="{esc(alt if alt is not None else IMG_ALT.get(img, ""))}" fetchpriority="high">'
    href2, label2, icon2 = second or (BIZ["tel"], f'Call {BIZ["phone"]}', "i-phone")
    return f'''
<section class="ph">
  {pic}
  <div class="hero__scrim" aria-hidden="true"></div><div class="hero__scrim hero__scrim--x" aria-hidden="true"></div>
  <div class="ph__in">
    <nav class="crumbs" aria-label="Breadcrumb"><ol>{trail}</ol></nav>
    <p class="hero__eyebrow">{eyebrow_icon}{label}</p>
    <h1>{h1}</h1>
    <p class="hero__lede">{sub}</p>
    {rating_line()}
    <div class="hero__acts">
      <a class="btn btn--lg" href="{primary}">{icon(primary_icon, 19)}{primary_label}</a>
      <a class="btn btn--lg ghost" href="{href2}">{icon(icon2, 19)}{label2}</a>
    </div>
  </div>
</section>'''

MQ_ITEMS = ["15 yard", "20 yard", "25 yard", "Up to 7 days, one price", "Dump fee included", "Junk removal", "Dump trailer", "Bin switch", "Same-day delivery"]

def ticker(far=False):
    items = [("Scheduled delivery" if i == "Same-day delivery" else i) for i in MQ_ITEMS] if far else MQ_ITEMS
    run = "".join(f"<span>{i}</span><i></i>" for i in items)
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

def bin_px(yd):
    """ONE price per bin (up to 7 days) + the tons it includes and the overage."""
    return (f'<div class="bin__px"><div><b>${T(f"d{yd}_47")}</b><span>up to 7 days</span></div>'
            f'<div><b>{T(f"tons{yd}")}<small>tons</small></b><span>included, then ${T("over_ton")}/ton</span></div></div>')

def bin_card(s, about=False, link=True):
    yd = s["yd"]
    url = f"/dumpster-rental/{s['slug']}/"
    if about:
        best = f'<strong>{esc(s["best"])}</strong>'
        btn = f'<a href="{url}" class="btn btn--block ghost ghost--lt">{yd} yard dumpster rental</a>'
        more = ""
    else:
        best = f'<strong>{esc(s["best"])}</strong> {esc(s["fits"])}'
        btn = f'<a href="/book?size={yd}" class="btn btn--block">{icon("i-cal")}Book {yd} yd</a>'
        more = f'<a class="bin__more" href="{url}">{yd} yard dumpster rental: sizes, uses, FAQ</a>' if link else ""
    return f'''
      <article class="bin rv-in">
        <div class="bin__pic"><img src="{s["img"]}" alt="{esc(IMG_ALT.get(s["img"], f"{yd} yard Triple R Dump roll-off bin"))}" loading="lazy"><span class="bin__tag">{esc(s["tag"])}</span></div>
        <div class="bin__b">
          <h3>{yd}<small>yard</small></h3>
          <p class="bin__for">{best}</p>
          {bin_px(yd)}
          {more}{btn}
        </div>
        <span class="ridge"></span>
      </article>'''

def rate_table(only=None):
    cards = "".join(bin_card(s, link=not only) for s in SIZES if not only or s["slug"] == only)
    return f'\n    <div class="bins{" bins--one" if only else ""}">{cards}\n    </div>'

def faq_block(faqs, title="Questions people ask", tone="paper", raw=False):
    e = (lambda x: x) if raw else esc
    items = "".join(f'\n      <div class="faq"><h3>{e(q)}</h3><p>{e(a)}</p></div>' for q, a in faqs)
    return sec(tone, head("Straight answers", title) + f'\n    <div class="faqs">{items}\n    </div>')

def faq_ld(faqs):
    return ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": plain(q), "acceptedAnswer": {"@type": "Answer", "text": plain(a)}} for q, a in faqs]})

def cta(tone="stone", far=False):
    delivery = "Next-day or a scheduled date; book a few days ahead" if far else "Same-day and next-day most days"
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
        <div><dt>Area</dt><dd>{AREA_SHORT}</dd></div>
        <div><dt>Sizes</dt><dd>15, 20 and 25 yard roll-offs, one price for up to 7 days</dd></div>
        <div><dt>Dump fee</dt><dd>Included in every bin rental</dd></div>
        <div><dt>Delivery</dt><dd>{delivery}</dd></div>
        <div><dt>Email</dt><dd><a href="mailto:{BIZ["email"]}">{BIZ["email"]}</a></dd></div>
      </dl>
    </div>
  </div>
</section>'''

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">'

def page(path, title, description, body, schemas, og_image=None, robots=None, canonical=True, preload="", og_type="website"):
    url = SITE + path
    META.append((path, title, description))
    inner = f'''{nav()}
<main>
{body}
</main>
{footer()}'''
    og = og_image or HERO_IMG
    og = og if og.startswith("http") else SITE + og
    rob = f'\n  <meta name="robots" content="{robots}">' if robots else ""
    canon = f'\n  <link rel="canonical" href="{url}">' if canonical else ""
    pre = f"\n  {preload}" if preload else ""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">{rob}{canon}
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/favicon-32x32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/assets/favicon-16x16.png" type="image/png" sizes="16x16">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="Triple R Dump">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:image" content="{og}">
  <meta name="twitter:card" content="summary_large_image">{pre}
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

# (path, priority, lastmod, [(image url, caption), ...])
def job_images(slug, city):
    return [(SITE + job_src(n), job_caption(city, d, i == 0)) for i, (n, o, d, a) in enumerate(JOBS.get(slug, []))]

CITY_NAME = {c["slug"]: c["name"] for c in CITIES}
# The homepage "Recent jobs" strip (index.html, hand-built) shows the first photo of these.
HOME_JOBS = ["roy", "north-ogden", "clinton", "bountiful", "brigham-city", "cottonwood-heights"]
urls = [("/", "1.0", TODAY, [img for s in HOME_JOBS for img in job_images(s, CITY_NAME[s])[:1]]),
        ("/book", "0.9", "2026-10-08", []), ("/terms", "0.3", TODAY, [])]

SIZE_PREFER = {"15-yard": ("size", "can-go", "cost"), "20-yard": ("size", "cost", "can-go"), "25-yard": ("size", "can-go", "permit")}

# size pages: target the size + Ogden / Weber & Davis (the homepage and the
# West Haven page own "dumpster rental West Haven")
for s in SIZES:
    yd = s["yd"]
    path = f"/dumpster-rental/{s['slug']}/"
    p47, tons = T(f"d{yd}_47"), T(f"tons{yd}")
    title = fit(f"{yd} Yard Dumpster Rental in Ogden, Weber & Davis | ${p47}",
                f"{yd} Yard Dumpster Rental Ogden, UT | ${p47}")
    desc = fit_desc(
        f"{yd} yard roll-off dumpster rental in Ogden, Roy, Layton and across Weber & Davis: ${p47} for up to 7 days, {tons} tons and the dump fee included. {BIZ['phone']}",
        f"{yd} yard dumpster rental in Ogden and Weber & Davis County: ${p47} for up to 7 days, {tons} tons and dump fee included. Call {BIZ['phone']}.")
    others = [x for x in SIZES if x["slug"] != s["slug"]]
    body = hero(
        f"{s['tag']} · {s['loads']}",
        f"{yd} yard dumpster rental<br><em>Ogden, Weber &amp; Davis.</em>",
        esc(s["lead"]),
        s["img"],
        f"/book?size={yd}",
        f"Book the {yd} yd",
        [("Home", "/"), ("Dumpster sizes", "/dumpster-rental/"), (f"{yd} yard", path)],
    ) + ticker() + sec("paper",
        head(f'The {yd} yard', "One price.<br><em>Up to 7 days.</em>",
             f'Delivery, pickup, up to 7 days and the dump fee for up to {tons} tons, in one number. Utah sales tax is added at checkout. Weight over that is ${T("over_ton")} a ton; extra days are ${T("ext_day")} each. Delivered across Ogden, Weber and Davis County.')
        + rate_table(only=s["slug"])
    ) + sec("dark", f'''
    <div class="two two--even">
      <div>{head("What it takes", "Good for")}
        {checks(esc(g) for g in s["good"])}
      </div>
      <div>{head("Before you book", "Three things")}
        <ul class="points">
          <li><div><strong>Where it goes</strong>{esc(s["fits"])} Tell us which side of the drive; drivers set it on boards if you want the concrete protected. On a public street, your city may want a permit; the form asks.</div></li>
          <li><div><strong>What cannot go in</strong>Hazardous waste, wet paint and liquids, asbestos, propane and fuel, tires, appliances with refrigerant, and TVs, computers and batteries (${T("prohibited")} per item if found). Mattresses: call first. Heavy material (concrete, dirt, brick, rock) reaches the {tons}-ton allowance fast; call first and we will tell you how much can go in. <a href="/terms">The full list is on the terms page</a>; <a href="/guides/what-can-go-in-a-dumpster/">where the rest goes</a>.</div></li>
          <li><div><strong>How it is paid</strong>Online by card when you book. You get a confirmation text with your reference, a reminder the day before delivery and the day before pickup, and a text when it is done.</div></li>
        </ul>
      </div>
    </div>''') + faq_block(s["faq"], title=f"About the {yd} yard", tone="stone") + sec("paper",
        head("Other sizes", "Not the right one?", '<a href="/dumpster-rental/">Compare all three dumpster sizes side by side.</a>')
        + f'\n    <div class="bins">{"".join(bin_card(o, about=True) for o in others)}\n    </div>'
        + f'\n    <p class="note">Junk gone today instead? <a href="/junk-removal/">Junk removal</a> is weekends only, ${T("junk")} flat. Hauling it yourself? <a href="/dump-trailer-rental/">Dump trailer rental</a>, ${T("trailer_day")} a day.</p>'
        + guide_note(SIZE_PREFER[s["slug"]], 2, "Still deciding? Read")
    ) + cta("stone")
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Service", "name": f"{yd} Yard Dumpster Rental", "serviceType": "Roll-off dumpster rental",
            "description": desc, "image": SITE + s["img"], "provider": PROVIDER, "areaServed": AREA_LD, "url": SITE + path,
            "offers": {"@type": "Offer", "name": f"{yd} yard roll-off, up to 7 days, dump fee included", "price": p47, "priceCurrency": "USD",
                       "availability": "https://schema.org/InStock", "url": SITE + f"/book?size={yd}"}}),
        faq_ld(s["faq"]),
        breadcrumbs([("Home", "/"), ("Dumpster sizes", "/dumpster-rental/"), (f"{yd} yard", path)]),
    ]
    write(f"dumpster-rental/{s['slug']}/index.html", page(path, title, desc, body, schemas, og_image=s["img"]))
    urls.append((path, "0.9", TODAY, []))

# the size hub (/dumpster-rental used to 301 into a 404)
HUB_FAQ = [
    FAQ[0],
    ("How much does a dumpster rental cost?", "One price per size for a rental of up to 7 days: 15 yard ${{TRD:d15_47}}, 20 yard ${{TRD:d20_47}}, 25 yard ${{TRD:d25_47}}. Delivery, pickup and the dump fee are included; Utah sales tax is added at checkout. Extra days are ${{TRD:ext_day}} each."),
    ("How much weight is included?", "{{TRD:tons15}} tons in a 15 yard, {{TRD:tons20}} tons in a 20 yard and {{TRD:tons25}} tons in a 25 yard. Household and remodel debris rarely gets there; concrete, dirt, brick and shingles can. Over the allowance it is ${{TRD:over_ton}} a ton."),
    ("Which dumpster fits in a driveway?", "The 15 and the 20 fit a standard driveway, about one parking space. The 25 needs a longer footprint: a long driveway, a job site or a lot. Tell us where it is going when you book and we will say whether it fits."),
]
cmp_rows = "".join(
    f'\n        <tr><th scope="row"><a href="/dumpster-rental/{s["slug"]}/">{s["yd"]} yard</a></th><td><b>${T(f"d{s["yd"]}_47")}</b></td><td>{T(f"tons{s["yd"]}")} tons</td>'
    f'<td>About {s["loadsn"]} pickup loads</td><td>{esc(s["best"])}</td><td><a class="btn" href="/book?size={s["yd"]}">Book {s["yd"]} yd</a></td></tr>'
    for s in SIZES)
hub_size_body = hero(
    "Three sizes · one price each",
    "Roll-off dumpster sizes:<br><em>15, 20 &amp; 25 yard.</em>",
    f"Every bin is one price for up to 7 days, with delivery, pickup and the dump fee included. Pick by the job, not the calendar. Delivered from West Haven across " + AREA_TEXT + ".",
    P + "02_20yd_bin_side.jpeg",
    "/book",
    "Book online",
    [("Home", "/"), ("Dumpster sizes", "/dumpster-rental/")],
) + ticker() + sec("paper",
    head("Side by side", "Compare the <em>three sizes</em>.", "Prices include delivery, pickup, up to 7 days and the dump fee up to the weight shown. Utah sales tax at checkout.")
    + f'''
    <div class="cmp-wrap"><table class="cmp">
      <caption class="sr-only">Triple R Dump roll-off dumpster sizes compared</caption>
      <thead><tr><th scope="col">Size</th><th scope="col">Price, up to 7 days</th><th scope="col">Weight included</th><th scope="col">Holds</th><th scope="col">Best for</th><th scope="col"><span class="sr-only">Book</span></th></tr></thead>
      <tbody>{cmp_rows}
      </tbody>
    </table></div>
    <p class="note">Over the weight allowance is ${T("over_ton")} a ton; extra days are ${T("ext_day")} each. Not sure? <a href="{BIZ["sms"]}">Text a photo of the pile</a> and we will fit the bin to it.</p>'''
) + sec("stone", head("The bins", "Pick yours.") + rate_table()) + sec("dark", f'''
    <div class="two two--even">
      <div>{head("Rule of thumb", "Which size?")}
        <ul class="points">
          <li><div><strong>15 yard: one room or one garage</strong>A bathroom remodel, a garage or shed cleanout, yard waste, the pile after a move. <a href="/dumpster-rental/15-yard/">More on the 15 yard dumpster</a>.</div></li>
          <li><div><strong>20 yard: when you are not sure</strong>Kitchens, whole-floor flooring, landscaping tear-outs, estate cleanouts. Our most-rented size. <a href="/dumpster-rental/20-yard/">More on the 20 yard dumpster</a>.</div></li>
          <li><div><strong>25 yard: construction and full homes</strong>Roof tear-offs, demolition debris, whole-house cleanouts, commercial jobs. <a href="/dumpster-rental/25-yard/">More on the 25 yard dumpster</a>.</div></li>
        </ul>
      </div>
      <div>{head("Other ways to haul it", "Not a bin?")}
        <ul class="points">
          <li><div><strong>Junk removal, ${T("junk")} flat</strong>We bring the truck and the crew and load it ourselves. Weekends only. <a href="/junk-removal/">Junk removal</a>.</div></li>
          <li><div><strong>Dump trailer, ${T("trailer_day")} a day</strong>You tow it, load it and do the dump runs. <a href="/dump-trailer-rental/">Dump trailer rental</a>.</div></li>
          <li><div><strong>Bin switch, ${T("binswitch")}</strong>Full bin mid-job? We swap it for an empty one in the same trip. <a href="/bin-switch/">Bin switch</a>.</div></li>
        </ul>
      </div>
    </div>''' + guide_note(("size",), 3, "Planning a project? Read")) + faq_block(HUB_FAQ, title="Dumpster sizes: <em>questions</em>", tone="paper") + cta("stone")
hub_size_title = "Dumpster Sizes & Prices | 15, 20, 25 Yard | Triple R Dump"
hub_size_desc = fit_desc(
    f"Compare 15, 20 and 25 yard roll-off dumpsters: one price for up to 7 days from ${T('d15_47')}, tons and dump fee included. Ogden, Roy, Layton, Weber & Davis.",
    f"Compare 15, 20 and 25 yard roll-off dumpsters: one price for up to 7 days from ${T('d15_47')}, weight and dump fee included. Call {BIZ['phone']}.")
write("dumpster-rental/index.html", page(
    "/dumpster-rental/", hub_size_title, hub_size_desc, hub_size_body,
    [
        ld({"@context": "https://schema.org", "@type": "ItemList", "name": "Roll-off dumpster sizes", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": f"{s['yd']} Yard Dumpster Rental", "url": SITE + f"/dumpster-rental/{s['slug']}/"} for i, s in enumerate(SIZES)]}),
        faq_ld(HUB_FAQ),
        breadcrumbs([("Home", "/"), ("Dumpster sizes", "/dumpster-rental/")]),
    ],
    og_image=P + "02_20yd_bin_side.jpeg",
))
urls.append(("/dumpster-rental/", "0.9", TODAY, []))

# service pages
SIDE_CHECKS = {
    "junk-removal": ["Weekends only", "Truck, crew, hauling and dump fee in one price", "One load; call for more"],
    "dump-trailer-rental": ["1 to 14 days", "${{TRD:trailer_dep}} refundable deposit", "Pick up and return in West Haven"],
    "bin-switch": ["Same-trip swap", "Any size that is free", "New bin billed as a normal rental"],
}
SERVICE_PREFER = {"junk-removal": ("junk", "can-go"), "dump-trailer-rental": ("trailer", "cost"), "bin-switch": ("size", "cost")}
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
        head("Bins &amp; rates", "Or rent a <em>bin</em>.", 'Three sizes, one price each for up to 7 days, dump fee included. <a href="/dumpster-rental/">Compare dumpster sizes</a>.') + rate_table()
        + guide_note(SERVICE_PREFER[s["slug"]], 2)
    ) + cta("paper")
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Service", "name": s["name"], "serviceType": s["name"], "description": s["description"], "provider": PROVIDER,
            "areaServed": AREA_LD,
            "offers": {"@type": "Offer", "price": s["price"].strip("$"), "priceCurrency": "USD", "url": SITE + s["book"]}, "url": SITE + path}),
        faq_ld(s["faq"]),
        breadcrumbs([("Home", "/"), (s["name"], path)]),
    ]
    write(f"{s['slug']}/index.html", page(path, s["title"], s["description"], body, schemas, og_image=s["img"]))
    urls.append((path, "0.8", TODAY, []))

# service area hub
def city_card(c):
    mins = "the shop" if c["min"] == 0 else f"~{c['min']} min"
    if c["slug"] in RETIRED_CITIES:
        return f'''<li><div class="city"><span class="city__n">{esc(c["name"])}</span><span class="city__m">{mins}</span><span class="city__l">{esc(c["line"])}</span></div></li>'''
    photo = f'<span class="city__ph">{icon("i-cam", 13)}Job photos</span>' if c["slug"] in JOBS else ""
    return f'''<li><a href="/service-area/{c["slug"]}/" class="city"><span class="city__n">{esc(c["name"])}</span><span class="city__m">{mins}{icon("i-chev", 14)}</span><span class="city__l">{esc(c["line"])}</span>{photo}<span class="ridge"></span></a></li>'''

def jobs_strip(slugs):
    """Photo cards, one per city, each linking to that city's page."""
    cards = []
    for slug in slugs:
        name, orient, date, alt = JOBS[slug][0]
        city = CITY_NAME[slug]
        cards.append(f'\n      <a class="jobc rv-in" href="/service-area/{slug}/">{job_img(name, orient, alt, sizes="(max-width: 760px) 100vw, 33vw")}'
                     f'<span class="jobc__t"><b>Dumpster rental in {esc(city)}</b><small>{month_year(date)}</small></span><span class="ridge"></span></a>')
    return f'\n    <div class="jobcs">{"".join(cards)}\n    </div>'

HUB_COUNTIES = ["Weber", "Davis", "Box Elder", "Cache", "Salt Lake", "Utah", "Morgan"]
hub_groups = []
for county in HUB_COUNTIES:
    cs = sorted([c for c in CITIES if c["county"] == county], key=lambda c: (c["slug"] not in KEPT_CITIES, c["min"]))
    hub_groups.append(f'\n    <div class="county"><h2 class="county__h">{county} County</h2><ul class="city-grid">{"".join(city_card(c) for c in cs)}</ul></div>')

JOB_ORDER = sorted(JOBS, key=lambda s: next(c["min"] for c in CITIES if c["slug"] == s))
hub_hero_job = JOBS["north-ogden"][0]
hub_body = hero(
    "Where we haul",
    "Dumpster rental<br><em>Logan to Springville.</em>",
    f"Based in West Haven, delivering across {AREA_TEXT}. Every city gets the same bin prices and the same dump-fee-included deal. {T('fuel_note')}",
    None,
    "/book",
    "Book online",
    [("Home", "/"), ("Service area", "/service-area/")],
    pin=True, job=hub_hero_job,
) + ticker() + sec("dark",
    "".join(hub_groups) + '\n    <p class="note">Not on the list? Call anyway. If a job is a long way out we will say so rather than waste your time.</p>'
) + sec("paper",
    head("Recent jobs", "Real bins, <em>real driveways.</em>", "Photos from our own recent deliveries, one per city. Tap a city for its page.")
    + jobs_strip(JOB_ORDER)
) + sec("stone",
    head("Bins &amp; rates", "One price <em>per bin</em>.", 'One price per size for up to 7 days, dump fee included. ' + T("fuel_note") + ' Utah sales tax at checkout. <a href="/dumpster-rental/">Compare dumpster sizes</a>.') + rate_table()
) + cta("paper")
hub_title = "Dumpster Rental Service Area | Logan to Springville"
hub_desc = fit_desc(
    "Roll-off dumpster rental from West Haven across Weber, Davis, Box Elder, Cache, Morgan, Salt Lake and Utah County. One price per bin, dump fee included.",
    "Dumpster rental from West Haven across Weber, Davis, Box Elder, Cache, Morgan, Salt Lake and Utah County. One price per bin, dump fee included.")
write("service-area/index.html", page(
    "/service-area/", hub_title, hub_desc, hub_body,
    [
        ld({"@context": "https://schema.org", "@type": "Service", "name": "Roll-off dumpster rental", "serviceType": "Roll-off dumpster rental", "provider": PROVIDER, "url": SITE + "/service-area/",
            "areaServed": [{"@type": "City", "name": c["name"], "containedInPlace": {"@type": "AdministrativeArea", "name": f"{c['county']} County, Utah"}} for c in kept()]
                          + [{"@type": "AdministrativeArea", "name": a} for a in AREA_LD]}),
        breadcrumbs([("Home", "/"), ("Service area", "/service-area/")]),
    ],
    og_image=job_src(hub_hero_job[0]), preload=preload_img(hub_hero_job[0], hub_hero_job[1]),
))
urls.append(("/service-area/", "0.8", TODAY, [(SITE + job_src(hub_hero_job[0]), job_caption("North Ogden", hub_hero_job[2]))]
             + [img for s in JOB_ORDER for img in job_images(s, CITY_NAME[s])[:1] if s != "north-ogden"]))

# Approximate city-centre coordinates, only used to pick each page's five nearest
# "Also serving" neighbours (drive minutes from the shop put Logan next to
# Springville, which is the wrong end of the state).
CITY_LL = {
    "west-haven": (41.20, -112.05), "roy": (41.16, -112.03), "hooper": (41.16, -112.12), "ogden": (41.22, -111.97),
    "plain-city": (41.30, -112.09), "syracuse": (41.09, -112.06), "clearfield": (41.11, -112.03), "layton": (41.06, -111.97),
    "north-ogden": (41.31, -111.96), "clinton": (41.14, -112.05), "bountiful": (40.89, -111.88), "brigham-city": (41.51, -112.02),
    "springville": (40.17, -111.61), "cottonwood-heights": (40.62, -111.81), "tremonton": (41.71, -112.17), "logan": (41.74, -111.83),
}

def geo_km(a, b):
    import math
    (la1, lo1), (la2, lo2) = CITY_LL[a], CITY_LL[b]
    x = math.radians(lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2))
    return 6371 * math.hypot(x, math.radians(la2 - la1))

# city pages. Cities more than FAR_MIN minutes out are never promised same-day
# (side card, description, ticker, contact facts).
FAR_MIN = 25
for c in kept():
    path = f"/service-area/{c['slug']}/"
    x = CITY_EXTRA[c["slug"]]
    name = c["name"]
    far = c["min"] > FAR_MIN
    photos = JOBS.get(c["slug"], [])
    city_faq = [(q, a.replace("{phone}", BIZ["phone"])) for q, a in x["faq"]]
    covers = f" We also cover {', '.join(x['covers'][:-1]) + ' and ' + x['covers'][-1] if len(x['covers']) > 1 else x['covers'][0]} from here." if x["covers"] else ""
    near = sorted([n for n in kept() if n["slug"] != c["slug"]], key=lambda n: geo_km(c["slug"], n["slug"]))[:5]
    dist = "minutes from the shop" if c["min"] == 0 else f"about {c['min']} minutes from our shop in West Haven"
    p = T("d15_47")
    title = fit(f"Dumpster Rental {name}, UT | ${p} · Dump Fee Included",
                f"{name} Dumpster Rental | ${p} · Dump Fee Included",
                f"Dumpster Rental {name}, UT | From ${p}")
    speed = "Next-day or scheduled delivery" if far else "Same-day delivery"
    desc = fit_desc(
        f"Roll-off dumpster rental in {name}, UT: 15, 20 & 25 yard bins from ${p} for up to 7 days, dump fee included. {speed}, 5.0-star rated. {BIZ['phone']}",
        f"Dumpster rental in {name}, UT: 15-25 yard bins from ${p} for up to 7 days, dump fee included. {speed}, 5.0-star rated. {BIZ['phone']}",
        f"Dumpster rental in {name}, UT: 15-25 yard bins from ${p}, up to 7 days, dump fee included. {speed}. {BIZ['phone']}")
    from_shop = "the shop" if c["min"] == 0 else f"~{c['min']} min from the shop"
    paras = "".join(f"\n        <p>{esc(pp.replace('{phone}', BIZ['phone']))}</p>" for pp in c["body"] + x["more"])
    note = f"\n        <p>{x['note']}</p>" if x.get("note") else ""
    side_items = (["Next-day or a scheduled date; book a few days ahead"] if far else ["Same-day and next-day available"]) + \
                 ["Driveway, lot or job site; street spots per city rules", "Bins set on boards on request"]
    lede = f"15, 20 and 25 yard roll-off bins delivered to {esc(name)}, {dist}. One price for up to 7 days, dump fee included, and the person who answers the phone is the owner."
    guides_line = ""
    if "dumpster-permit-ogden-weber-davis" in GUIDE_BY_SLUG and "city-dumpster-days-weber-davis" in GUIDE_BY_SLUG:
        guides_line = (' Bin going on the street? Read <a href="/guides/dumpster-permit-ogden-weber-davis/">do I need a dumpster permit</a>.'
                       ' Looking for free city cleanup days? See <a href="/guides/city-dumpster-days-weber-davis/">free city dumpster days in Roy and Ogden</a>.')
    job = photos[0] if photos else None
    hero_img = None if job else x.get("hero", AREA_IMG if c["min"] else HERO_IMG)
    body = hero(
        f"{c['county']} County · {from_shop}",
        f"Dumpster rental<br><em>in {esc(name)}.</em>",
        lede,
        hero_img,
        "/book",
        "Book online",
        [("Home", "/"), ("Service area", "/service-area/"), (name, path)],
        pin=True, job=job,
    ) + ticker(far) + sec("paper", f'''
    <div class="two">
      <div class="prose">
        <header class="prose__head"><p class="kicker">{esc(name)}</p><h2>What we haul <em>here</em>.</h2></header>{paras}{note}
        <p>ZIP codes: {esc(x["zips"])}.{esc(covers)}</p>
        <p>Same bin prices as West Haven, dump fee included. {T("fuel_" + c["slug"].replace("-", "_"))} Utah sales tax at checkout. <a href="/faq/">Dumpster rental questions, answered</a>.{guides_line}</p>
      </div>{side_card("From the shop", f'{"0" if c["min"] == 0 else c["min"]}<small>{"minutes, give or take; this is home" if c["min"] == 0 else "minutes, give or take"}</small>', side_items, "/book", "Book online", BIZ["tel"], f"or call {BIZ['phone']}")}
    </div>''')
    if photos:
        body += sec("stone",
            head("Recent job", f"Recent job in <em>{esc(name)}</em>.", f"Our own photos from a delivery in {esc(name)}. Bins are set where the customer asks, on boards if they want the drive protected.")
            + f'\n    <div class="jobs jobs--{min(len(photos), 4)}">{job_figures(c["slug"], name)}\n    </div>')
    body += sec("dark",
        head("Bins &amp; rates", "One price.<br><em>Up to 7 days.</em>", 'Dump fee included. <a href="/dumpster-rental/">Compare dumpster sizes side by side.</a>') + rate_table()
        + '\n    <p class="note">Junk gone today? <a href="/junk-removal/">Junk removal</a>, weekends. Hauling it yourself? <a href="/dump-trailer-rental/">Dump trailer rental</a>, by the day. Bin filled early? <a href="/bin-switch/">Bin switch</a>, same trip.</p>'
        + f'\n    <p class="note">Also serving: {", ".join(f"<a href=\"/service-area/{n['slug']}/\">dumpster rental in {esc(n['name'])}</a>" for n in near)}, and <a href="/service-area/">every other city we serve</a>.</p>'
    ) + faq_block(city_faq, title=f"Dumpster rental in {esc(name)}: <em>questions</em>", tone="paper" if photos else "stone") + cta("stone" if photos else "paper", far=far)
    service = {"@context": "https://schema.org", "@type": "Service", "name": f"Dumpster rental in {name}, UT", "serviceType": "Roll-off dumpster rental", "provider": PROVIDER,
               "areaServed": {"@type": "City", "name": name, "containedInPlace": {"@type": "AdministrativeArea", "name": f"{c['county']} County, Utah"}}, "url": SITE + path,
               "offers": {"@type": "AggregateOffer", "lowPrice": T("d15_47"), "highPrice": T("d25_47"), "priceCurrency": "USD", "offerCount": 3}}
    if photos:
        service["image"] = [SITE + job_src(n) for n, _, _, _ in photos]
    schemas = [ld(service), faq_ld(city_faq), breadcrumbs([("Home", "/"), ("Service area", "/service-area/"), (name, path)])] + image_ld(c["slug"], name)
    write(f"service-area/{c['slug']}/index.html", page(path, title, desc, body, schemas,
          og_image=job_src(job[0]) if job else hero_img, preload=preload_img(job[0], job[1]) if job else ""))
    urls.append((path, "0.7", TODAY, job_images(c["slug"], name)))

# FAQ
faq_job = JOBS["north-ogden"][2]
faq_body = hero(
    "Straight answers",
    "Dumpster rental<br><em>questions, answered.</em>",
    "The things people ask before they book: size, price, how long, what can go in, where we deliver. If yours is not here, the phone works.",
    None,
    "/book",
    "Book online",
    [("Home", "/"), ("FAQ", "/faq/")],
    job=faq_job,
) + ticker() + faq_block(FAQ, title="Before you book", tone="paper")
if GUIDES:
    faq_body += sec("stone", head("Guides", "Want the <em>long answer</em>?", "Longer write-ups on the questions that need more than a paragraph.")
                    + f'\n    <ul class="gl">{"".join(f"<li><a href=\"/guides/{g['slug']}/\">{plain(g['title'])}</a><span>{plain(g['description'])}</span></li>" for g in GUIDES)}\n    </ul>')
faq_body += sec("dark",
    head("Bins &amp; rates", "One price.<br><em>Up to 7 days.</em>", 'Dump fee included. <a href="/dumpster-rental/">Compare dumpster sizes.</a>') + rate_table()
) + cta("stone")
write("faq/index.html", page(
    "/faq/",
    "Dumpster Rental FAQ: Sizes, Prices & Rules | Triple R Dump",
    fit_desc(f"What size dumpster you need, what ${T('d15_47')} includes, how long you keep it, what can't go in and where we deliver. Straight answers from Triple R Dump.",
             "What size dumpster you need, what the price includes, how long you keep it, what can't go in and where we deliver. Straight answers."),
    faq_body,
    [faq_ld(FAQ), breadcrumbs([("Home", "/"), ("FAQ", "/faq/")])],
    og_image=job_src(faq_job[0]),
))
urls.append(("/faq/", "0.6", TODAY, []))

# BBB accreditation
BBB_PROFILE = "https://www.bbb.org/us/ut/west-haven/profile/dumpster-rentals/triple-r-dump-1126-1000181920/"
BBB_SEAL = "https://seal-central-northern-western-arizona.bbb.org/seals/blue-seal-250-52-bbb-1000181920.png"
bbb_body = hero(
    "Accountability, in writing",
    "BBB-accredited<br><em>dumpster rental.</em>",
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
    head("Bins &amp; rates", "One price.<br><em>Up to 7 days.</em>", 'Dump fee included. <a href="/dumpster-rental/">Compare dumpster sizes.</a>') + rate_table()
) + cta("stone")
write("bbb/index.html", page(
    "/bbb/",
    "BBB Accredited Dumpster Rental | Triple R Dump, West Haven",
    "Triple R Dump is a BBB Accredited dumpster rental company in West Haven, Utah. What accreditation means, and how to check our current rating on bbb.org.",
    bbb_body,
    [breadcrumbs([("Home", "/"), ("BBB accredited", "/bbb/")])],
    og_image=P + "07_bin_rental_4.jpeg",
))
urls.append(("/bbb/", "0.5", TODAY, []))

# contact (the old Wix site had /contact and it still shows in search results —
# this page exists so that URL lands somewhere real instead of a 404)
MAPS_G = "https://maps.google.com/?q=3539+S+4250+W,+West+Haven,+UT+84401"
MAPS_A = "https://maps.apple.com/?q=3539+S+4250+W,+West+Haven,+UT+84401"
# Google Maps > Share > Embed a map, for Joseph's profile (CID 8339345795908710583).
MAPS_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3001.9984669344267!2d-112.083158!3d41.200007!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x62c23885d8c053df%3A0x73bb4ed1504930b7!2sTriple%20R%20Dump!5e0!3m2!1sen!2sus!4v1791435442660!5m2!1sen!2sus"
GEO = {"@type": "GeoCoordinates", "latitude": 41.200007, "longitude": -112.083158}
HOURS = [{"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "opens": "00:00", "closes": "23:59"}]
contact_body = hero(
    "Call, text or book",
    "Dumpster rental?<br><em>Talk to the owner.</em>",
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
        <div class="prose-block"><h2>Hours</h2>
          <p>Open 24 hours, seven days a week. Online booking never closes; calls and texts go straight to Joseph.</p></div>
        <div class="prose-block"><h2>Email</h2>
          <p><a href="mailto:{BIZ["email"]}">{BIZ["email"]}</a> works for quotes, commercial accounts, paperwork and anything with an attachment. For a bin this week, the phone is faster.</p></div>
        <div class="prose-block"><h2>The shop</h2>
          <p>{BIZ["address"]}. That is where the trucks and trailers live; dump trailer pickups and returns happen here. Directions: <a href="{MAPS_G}" target="_blank" rel="noopener">Google Maps</a> or <a href="{MAPS_A}" target="_blank" rel="noopener">Apple Maps</a>.</p></div>
        <div class="prose-block"><h2>Book without calling</h2>
          <p>The <a href="/book">booking page</a> takes the size, the dates and the address, checks that a bin is actually free, and takes payment by card. It is the same calendar we run the trucks from. Junk removal books weekends only; everything else, any day. <a href="/dumpster-rental/">Compare dumpster sizes and prices</a> first if you are not sure which bin.</p></div>
      </div>{side_card("Reach us", f'<a href="{BIZ["tel"]}">{BIZ["phone"]}</a><small>call or text, the owner answers</small>', ["The owner answers", "Same-day delivery most days", "Booking online, day or night"], BIZ["tel"], f"{icon('i-phone')}Call {BIZ['phone']}", "/book", "or book online",
                       big_cls=" sidec__big--num",
                       extra=f'\n      <p class="sidec__proof"><a href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{icon("i-g", 16)}{stars(15)} <strong data-trd-num="g_rating">5.0</strong> from <span data-trd-num="g_count">20</span> Google reviews</a></p>')}
    </div>''') + sec("dark", head("Where we haul", "Logan<br><em>to Springville.</em>", f'{AREA_TEXT}, from one shop in West Haven. <a href="/service-area/">Every city we serve is here.</a>') + f'''
    <div class="map-embed">
      <iframe src="{MAPS_EMBED}" title="Map: Triple R Dump, {BIZ["address"]}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <p class="map-cap">{BIZ["address"]} · <a href="{MAPS_G}" target="_blank" rel="noopener">Directions</a></p>
    </div>''') + cta("stone")
write("contact/index.html", page(
    "/contact/",
    "Contact Triple R Dump | Dumpster Rental in West Haven, UT",
    f"Call or text {BIZ['phone']}, email, or book a dumpster online. Triple R Dump, family-owned roll-off rental at 3539 S 4250 W, West Haven, UT. Open 24 hours.",
    contact_body,
    [
        ld({"@context": "https://schema.org", "@type": "ContactPage", "name": "Contact Triple R Dump", "url": SITE + "/contact/",
            "about": {"@type": "LocalBusiness", "@id": SITE + "/#business", "name": BIZ["name"], "telephone": "+1-" + BIZ["phone"], "email": BIZ["email"], "url": SITE + "/",
                      "address": {"@type": "PostalAddress", "streetAddress": "3539 S 4250 W", "addressLocality": "West Haven", "addressRegion": "UT", "postalCode": "84401", "addressCountry": "US"},
                      "geo": GEO, "openingHoursSpecification": HOURS,
                      "priceRange": "$$", "hasMap": BIZ["gmaps"], "sameAs": SAME_AS}}),
        breadcrumbs([("Home", "/"), ("Contact", "/contact/")]),
    ],
))
urls.append(("/contact/", "0.6", TODAY, []))

# guides (only when guides_content.py exists)
def guide_card(g):
    img = g.get("img", "")
    jobname = img[len(J):] if img.startswith(J) and "/" not in img[len(J):] else None
    orient = next((o for jobs in JOBS.values() for n, o, _, _ in jobs if n == jobname), "l")
    pic = (job_img(jobname, orient, plain(g.get("img_alt", "")), sizes="(max-width: 760px) 100vw, 33vw") if jobname
           else f'<img src="{img}" alt="{g.get("img_alt", "")}" loading="lazy">') if img else ""
    return (f'\n      <a class="gcard rv-in" href="/guides/{g["slug"]}/"><span class="gcard__pic">{pic}</span>'
            f'<span class="gcard__b"><span class="kicker">{g.get("kicker", "Guide")}</span><b>{g["title"]}</b><span>{g["description"]}</span></span><span class="ridge"></span></a>')

def guide_body_html(g):
    out = []
    for h2, paras in g.get("sections", []):
        inner = "".join(pp if pp.lstrip().startswith(("<ul>", "<ol>")) else f"<p>{pp}</p>" for pp in paras)
        out.append(f'\n        <div class="prose-block"><h2>{h2}</h2>{inner}</div>')
    t = g.get("table")
    if t:
        th = "".join(f'<th scope="col">{c}</th>' for c in t.get("head", []))
        rows = "".join("<tr>" + "".join((f'<th scope="row">{c}</th>' if i == 0 else f"<td>{c}</td>") for i, c in enumerate(r)) + "</tr>" for r in t.get("rows", []))
        cap = f"<caption>{t['caption']}</caption>" if t.get("caption") else ""
        out.append(f'\n        <div class="cmp-wrap"><table class="cmp cmp--guide">{cap}<thead><tr>{th}</tr></thead><tbody>{rows}</tbody></table></div>')
    return "".join(out)

if GUIDES:
    for g in GUIDES:
        path = f"/guides/{g['slug']}/"
        img = g.get("img") or HERO_IMG
        jobname = img[len(J):] if img.startswith(J) and "/" not in img[len(J):] else None
        jorient = next((o for jobs in JOBS.values() for n, o, _, _ in jobs if n == jobname), "l")
        job = (jobname, jorient, "", plain(g.get("img_alt", ""))) if jobname else None
        related = [GUIDE_BY_SLUG[r] for r in g.get("related", []) if r in GUIDE_BY_SLUG][:3]
        srcs = "".join(f'<li><a href="{esc(html_lib.unescape(u))}" target="_blank" rel="noopener nofollow">{lbl}</a></li>' for lbl, u in g.get("sources", []))
        body = hero(
            g.get("kicker", "Guide"),
            g["h1"],
            esc(plain(g["description"])),
            None if job else img,
            "/book",
            "Book online",
            [("Home", "/"), ("Guides", "/guides/"), (plain(g["title"]), path)],
            alt=plain(g.get("img_alt", "")), job=job,
        ) + ticker() + sec("paper", f'''
    <div class="two">
      <article class="prose">
        <p class="answer">{g["lead"]}</p>{guide_body_html(g)}
        <p class="byline">By Joseph Rodrigues, owner of Triple R Dump · Updated {month_year(GUIDES_UPDATED)}</p>
      </article>{side_card("Need a bin?", f"${T('d15_47')}<small>15 yard, up to 7 days, dump fee included</small>", ["20 yard $" + T("d20_47") + ", 25 yard $" + T("d25_47"), "Same-day delivery most days", "The owner answers the phone"], "/book", "Book online", BIZ["tel"], f"or call {BIZ['phone']}")}
    </div>''')
        if g.get("faq"):
            body += faq_block(g["faq"], title="Quick <em>answers</em>", tone="stone", raw=True)
        tail = ""
        if srcs:
            tail += head("Sources", "Where these <em>facts</em> come from.") + f'\n    <ol class="sources">{srcs}</ol>'
        if related:
            tail += head("Keep reading", "Related <em>guides</em>.") + f'\n    <div class="gcards">{"".join(guide_card(r) for r in related)}\n    </div>'
        if tail:
            body += sec("dark" if not g.get("faq") else "paper", tail)
        body += cta("stone")
        schemas = [
            ld({"@context": "https://schema.org", "@type": "Article", "headline": plain(g["title"]), "description": plain(g["description"]),
                "image": SITE + img if img.startswith("/") else img, "datePublished": GUIDES_UPDATED, "dateModified": GUIDES_UPDATED,
                "author": {"@type": "Person", "name": "Joseph Rodrigues", "jobTitle": "Owner", "worksFor": BUSINESS_REF},
                "publisher": BUSINESS_REF, "mainEntityOfPage": SITE + path}),
            breadcrumbs([("Home", "/"), ("Guides", "/guides/"), (plain(g["title"]), path)]),
        ]
        if g.get("faq"):
            schemas.insert(1, faq_ld(g["faq"]))
        write(f"guides/{g['slug']}/index.html", page(path, plain(g["title"]), plain(g["description"]), body, schemas, og_image=img, og_type="article",
                                                       preload=preload_img(job[0], job[1]) if job else ""))
        urls.append((path, "0.6", GUIDES_UPDATED, [(SITE + img, plain(g.get("img_alt", "")))] if jobname else []))
    gi_job = JOBS["brigham-city"][0]
    gi_body = hero(
        "Straight answers, written down",
        "Dumpster rental guides<br><em>for northern Utah.</em>",
        "Sizing, prices, permits, what can go in and what to do with what cannot, from the owner who drops the bins.",
        None, "/book", "Book online",
        [("Home", "/"), ("Guides", "/guides/")],
        job=gi_job,
    ) + ticker() + sec("paper", head("Guides", "Read before <em>you book</em>.", "Every price in these guides is the live price on the booking page.")
        + f'\n    <div class="gcards">{"".join(guide_card(g) for g in GUIDES)}\n    </div>') + cta("stone")
    write("guides/index.html", page(
        "/guides/",
        "Dumpster Rental Guides for Northern Utah | Triple R Dump",
        fit_desc("Plain-English guides to renting a dumpster in Weber, Davis and Salt Lake County: sizes, prices, permits, weight limits and what can go in the bin.",
                 "Guides to renting a dumpster in northern Utah: sizes, prices, permits, weight limits and what can go in the bin, from Triple R Dump."),
        gi_body,
        [ld({"@context": "https://schema.org", "@type": "ItemList", "name": "Triple R Dump guides", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": plain(g["title"]), "url": SITE + f"/guides/{g['slug']}/"} for i, g in enumerate(GUIDES)]}),
         breadcrumbs([("Home", "/"), ("Guides", "/guides/")])],
        og_image=job_src(gi_job[0]), preload=preload_img(gi_job[0], gi_job[1]),
    ))
    urls.append(("/guides/", "0.7", GUIDES_UPDATED, []))
else:
    print("guides_content.py not found: no /guides/ pages written")

# not-found: the worker serves this body with status 404 to browsers
# (worker/src/marketing.js notFoundHtml). noindex, no canonical, not in the sitemap.
nf_links = [
    ("/dumpster-rental/", "Dumpster sizes &amp; prices", "15, 20 and 25 yard, one price each for up to 7 days"),
    ("/book", "Book a dumpster", "Pick a size and a date, pay by card"),
    ("/service-area/", "Service area", "Every city we serve, Logan to Springville"),
] + ([("/guides/", "Guides", "Sizing, prices, permits and what can go in")] if GUIDES else []) + [
    ("/faq/", "Questions &amp; answers", "Straight answers before you book"),
    ("/contact/", "Contact", f"Call or text {BIZ['phone']}"),
]
nf_body = hero(
    "404 · page not found",
    "That page<br><em>is not here.</em>",
    "The link may be old (our previous website had different addresses) or mistyped. Everything is one tap from here, or call and the owner will sort it out.",
    HERO_IMG, "/book", "Book a dumpster",
    [("Home", "/"), ("Page not found", "/not-found/")],
) + sec("dark", head("Try one of these", "Where to <em>next</em>.")
    + '\n    <ul class="city-grid">' + "".join(
        f'<li><a href="{h}" class="city"><span class="city__n">{n}</span><span class="city__m">{icon("i-chev", 14)}</span><span class="city__l">{l}</span><span class="ridge"></span></a></li>'
        for h, n, l in nf_links) + "</ul>") + cta("stone")
write("not-found/index.html", page("/not-found/", "Page Not Found | Triple R Dump", "That page is not here. Book a dumpster, see sizes and prices, or call Triple R Dump at 801-564-3164.",
                                   nf_body, [], robots="noindex, follow", canonical=False))

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
        <p class="where">West Haven, UT · Logan to Springville</p>
        <h1>Need a bin? <em>Dump fee included.</em></h1>
        <p class="sub">15, 20 and 25 yard roll-off dumpsters, junk removal and dump trailers. Family owned, and the owner answers.</p>
        <a class="rate" href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{stars(14)}<b data-trd-num="g_rating">5.0</b> <span data-trd-num="g_count">20</span> Google reviews</a>
      </div>
    </section>

    <div class="side">
    <nav class="keys" aria-label="Reach us">
      <a class="key" href="{BIZ["tel"]}">{icon("i-phone", 24)}Call</a>
      <a class="key" href="{BIZ["gmaps"]}" target="_blank" rel="noopener">{icon("i-pin", 24)}Google</a>
      <a class="key" href="{BIZ["instagram"]}" target="_blank" rel="noopener">{icon("i-ig", 24)}Instagram</a>
    </nav>

    <a class="go" href="{SITE}/book">
      <span class="goT"><b>Book a dumpster online</b><small>Pick a size and a date, pay by card. From ${T("d15_47")} for up to 7 days.</small></span>
      <span class="goArrow" aria-hidden="true">{icon("i-chev", 20)}</span>
    </a>

    <nav class="list" aria-label="More links">{social_row(SITE + "/dumpster-rental/", "i-bin", "Bin sizes &amp; prices", "15, 20 and 25 yard, dump fee included")}{social_row(SITE + "/junk-removal/", "i-couch", "Junk removal", "We load it and haul it. Weekends, $" + T("junk") + " flat")}{social_row(SITE + "/dump-trailer-rental/", "i-trailer", "Dump trailer rental", "By the day, for your own runs")}{social_row(SITE + "/service-area/", "i-cam", "Our work", "Real bins on real driveways")}{social_row(SITE + "/", "i-web", "Our website", "Every bin, every service, every town")}{social_row(BIZ["facebook"], "i-fb", "Facebook", "Triple R Dump", ext=True)}{social_row(SITE + "/bbb/", "i-shield", "BBB accredited", "Our Better Business Bureau profile")}
    </nav>

    <a class="badge" href="{BIZ["tel"]}">
      <span class="badgeI">{icon("i-clock", 24)}</span>
      <span><b>Need a bin today?</b> Same-day delivery most days. Call {BIZ["phone"]} and {BIZ["owner"]} picks up.</span>
    </a>

    <footer class="foot">
      <p>Triple R Dump · West Haven, Utah · {AREA_SHORT}</p>
      <p><a href="https://pullcount.com/" target="_blank" rel="noopener">Powered by Pull Count</a></p>
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
  <link rel="canonical" href="https://bio.triplerdump.com/">
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

# sitemap (+ image entries for the job photos) and robots. /social/ and
# /not-found/ are deliberately NOT in the sitemap: both are noindex.
def sitemap_url(p, pr, lastmod, imgs):
    im = "".join(f"\n    <image:image>\n      <image:loc>{esc(u)}</image:loc>\n    </image:image>" for u, _ in imgs)
    return f"  <url>\n    <loc>{SITE}{p}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{pr}</priority>{im}\n  </url>\n"

write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
      + "".join(sitemap_url(*u) for u in urls) + "</urlset>\n")
write("robots.txt", "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /booked\nDisallow: /r/\nDisallow: /inv/\nDisallow: /calendar/\n\nSitemap: " + SITE + "/sitemap.xml\n")

print(f"\n{len(urls)} URLs in the sitemap, {sum(len(u[3]) for u in urls)} image entries.")
print("\nTitles / descriptions as rendered with today's live values (title <= 60, description 120-155):")
for path, title, desc in META:
    t, d = rendered(title), rendered(desc)
    flag = "" if len(t) <= 60 and 120 <= len(d) <= 155 else "   <-- check"
    print(f"  {path:42} title {len(t):3}  desc {len(d):3}{flag}")
