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
    faq/index.html
    pages.css                               the home page's look, as a stylesheet
    sitemap.xml, robots.txt

Every page is plain static HTML served by Workers Static Assets, exactly like
index.html. None of these paths collide with a Worker route (/book, /terms,
/api, /admin, /booked, /r, /inv, /calendar), so the booking system is not
involved in serving them. index.html is hand-built and is NOT touched here.

Facts come from one place (the same numbers the home page and the booking
form show): bin prices, the 7.5% tax at checkout, the fees on /terms, and the
four counties. If a price changes in the CMS, change it here too and re-run.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://www.triplerdump.com"
TODAY = "2026-08-22"

BIZ = {
    "name": "Triple R Dump",
    "owner": "Joseph",
    "phone": "801-564-3164",
    "tel": "tel:8015643164",
    "email": "Joseph.Rodrigues@triplerdump.com",
    "address": "3539 S 4250 W, West Haven, UT 84401",
    "city": "West Haven",
    "review": "https://g.page/r/CcTKEv0Yu0gPEBM/review",
    "instagram": "https://www.instagram.com/triple.r.dump/",
    "facebook": "https://www.facebook.com/profile.php?id=61587229028024",
}

HERO_IMG = "/uploads/triple.r.dump-photo-DY2CxEIFMkG-20260527_075118_707154355.jpg"
AREA_IMG = "/uploads/triple.r.dump-photo-DY2CxEIFMkG-20260527_075118_707005240.jpg"
P = "/uploads/triplerdump_photos/triplerdump_photos/"

# ───────────────────────────────────────────────────────────── sizes ──────

SIZES = [
    {
        "slug": "15-yard", "yd": 15, "p13": 300, "p47": 325, "img": P + "01_15yd_bin.png",
        "tag": "The driveway bin",
        "best": "Garage cleanouts, small remodels, yard waste, moving.",
        "fits": "Fits in a standard driveway without blocking the garage.",
        "loads": "about five pickup-truck loads",
        "lead": "The 15 yard is the bin for a weekend. A garage that has not been seen in years, a bathroom remodel, the yard after a storm, a move that left a pile behind. It fits in a standard driveway, it holds about five pickup loads, and the dump fee is already in the price.",
        "good": ["Garage and shed cleanouts", "Bathroom and small kitchen remodels", "Yard waste, branches, sod", "Moving and apartment clean-outs", "Roof tear-offs on a small roof", "Carpet, cabinets, drywall from one room"],
        "faq": [
            ("How much fits in a 15 yard dumpster?", "About five full-size pickup loads. Think a two-car garage cleanout, a bathroom remodel, or the debris from one or two rooms. If you are staring at a kitchen, the 20 yard is the safer call."),
            ("Will it fit in my driveway?", "Yes, that is what the 15 is for. It takes roughly one parking space. Tell us which side of the drive you want it on when you book and the driver sets it there, on boards if you want the concrete protected."),
            ("What does $300 actually cover?", "Delivery, pickup, the rental for 1 to 3 days, and the dump fee. Utah sales tax is added at checkout. Extra days are $50 each; heavy loads over the weight limit and prohibited items are the only other charges, and they are spelled out on the terms page."),
        ],
    },
    {
        "slug": "20-yard", "yd": 20, "p13": 350, "p47": 375, "img": P + "02_20yd_bin_side.jpeg",
        "tag": "Our most-rented size",
        "best": "Kitchen remodels, landscaping, flooring, estate cleanouts.",
        "fits": "Still driveway-sized. The right answer when you are not sure.",
        "loads": "about seven pickup-truck loads",
        "lead": "The 20 yard is the one we rent most, and the one we point people at when they are not sure. Kitchen remodels, flooring through a whole main level, a landscaping tear-out, an estate cleanout. Still fits a driveway, holds about seven pickup loads, and the dump fee is included.",
        "good": ["Kitchen remodels and cabinet tear-outs", "Flooring and carpet, whole floor", "Landscaping, fence and deck tear-downs", "Estate and whole-garage cleanouts", "Roof tear-offs on a standard home", "Basement finishes and remodels"],
        "faq": [
            ("Why is the 20 yard your most-rented bin?", "Because it covers the most jobs for the least money. It is the size that handles a kitchen, a floor, or a yard without running out of room, and it still fits in a driveway. When a 15 feels tight, the 20 is $50 more."),
            ("Can I start with a 15 and switch to a 20?", "Yes. If the bin fills mid-project we haul it and drop the next one in the same trip; that is the bin switch, $200. One of our reviews is exactly that story. Cheaper still is to start with the 20."),
            ("What is the price for a week?", "$375 for 4 to 7 days, plus Utah sales tax at checkout. $350 for 1 to 3 days. Both include delivery, pickup and the dump fee."),
        ],
    },
    {
        "slug": "25-yard", "yd": 25, "p13": 400, "p47": 425, "img": P + "03_25yd_bin_side.jpeg",
        "tag": "Maximum capacity",
        "best": "Construction, roofing, full-home cleanouts, commercial jobs.",
        "fits": "Needs a longer space: a long driveway, a job site, or the street with a permit.",
        "loads": "about nine pickup-truck loads",
        "lead": "The 25 yard is the big one: construction debris, a full roof, a whole-house cleanout, a commercial job that is going to keep filling it. About nine pickup loads. It needs a longer footprint than the others, so tell us where it is going and we will say whether it fits.",
        "good": ["New construction and demolition debris", "Full roof tear-offs", "Whole-home and hoarding cleanouts", "Commercial and retail fit-outs", "Multi-room remodels", "Bulky furniture, decking, fencing in volume"],
        "faq": [
            ("Do I need a permit for a 25 yard bin?", "Only if it has to sit on a public street. In a driveway or on your own lot, no. If it is going on the street, your city may want a permit; the booking form asks, and we can tell you what your city does."),
            ("Can I put concrete, dirt or brick in it?", "Not in a 25. Heavy material hits the weight limit long before the bin is full and the overage is billed by the ton. Heavy loads want their own small container; call and we will set it up properly."),
            ("How long can I keep it?", "1 to 3 days is $400, 4 to 7 days is $425, plus tax. Need longer? Call before pickup and we extend it at $50 a day. On a long job, a bin switch keeps the same bin on site with a fresh one dropped when it fills."),
        ],
    },
]

SERVICES = [
    {
        "slug": "junk-removal", "name": "Junk Removal", "price": "$550", "unit": "flat rate",
        "book": "/book?service=junk", "img": P + "06_bin_rental_3.jpeg",
        "title": "Junk Removal in West Haven & Weber County, UT",
        "description": "Full-service junk removal on the Wasatch Front: we bring the truck and the crew, load it, haul it and pay the dump. $550 flat, weekends only. Book online or call 801-564-3164.",
        "h1": "Junk removal.<br><em>We do the lifting.</em>",
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
        "slug": "dump-trailer-rental", "name": "Dump Trailer Rental", "price": "$200", "unit": "per day",
        "book": "/book?service=trailer", "img": P + "14_gallery_photo_4.jpg",
        "title": "Dump Trailer Rental in West Haven & Weber County, UT",
        "description": "Rent a dump trailer by the day in West Haven, UT: $200 a day, 1 to 14 days, with a $300 refundable deposit. Haul it yourself, dump it yourself. Book online or call 801-564-3164.",
        "h1": "Dump trailer.<br><em>By the day.</em>",
        "lead": "If you have the truck and the time, a dump trailer is the cheapest way to move a lot of material: your own runs to the dump, a move, hauling gravel or branches. $200 a day, one to fourteen days, with a $300 deposit that comes back when the trailer does.",
        "sections": [
            ("How it works", ["Book the days online, pay the rental plus the refundable deposit, and pick the trailer up from us in West Haven. Haul whatever you need, dump it yourself, bring it back clean on the last day. The deposit comes back to your card once it is checked in."]),
            ("When it is the right call", ["Moving house with a pickup. Your own dump runs at your own pace. Gravel, mulch, soil in. Branches and yard waste out. Anything where you would rather do the driving than pay for a bin to sit."]),
            ("What you need", ["A truck with a hitch rated for it and a driver comfortable towing. The trailer comes with the tie-downs; you bring the muscle. Damage and overages are covered by the card on file, same as every rental, and it is all on the terms page."]),
        ],
        "faq": [
            ("What is the deposit for?", "It is $300, refundable, and it covers the trailer coming back on time and in one piece. It is returned to your card once the trailer is checked in."),
            ("Can I keep it longer than I booked?", "Call before the last day and we extend it at the daily rate if it is not booked behind you. Bringing it back late without a call runs into the late fee on the terms page, so call."),
            ("Is the dump fee included?", "No. With the trailer you are doing your own dump runs and paying the dump directly. The bins include the dump fee; the trailer is the do-it-yourself option, which is why it is cheaper per day."),
        ],
    },
    {
        "slug": "bin-switch", "name": "Bin Switch", "price": "$200", "unit": "per switch",
        "book": "/book?service=binswitch", "img": P + "13_gallery_photo_3.jpeg",
        "title": "Bin Switch, Same-Trip Dumpster Swap in Weber County, UT",
        "description": "Filled the dumpster before the job is done? A bin switch hauls the full one and drops a fresh one in the same trip, $200. Serving West Haven, Ogden, Roy and the Wasatch Front. Call 801-564-3164.",
        "h1": "Full bin?<br><em>Swap it, same trip.</em>",
        "lead": "A remodel that found another wall. A roof with one more layer than anyone thought. A cleanout that kept going. When the bin fills before the job ends, a switch hauls the full one away and drops a fresh one in the same trip, so nothing sits and nobody waits.",
        "sections": [
            ("How it works", ["Book the switch online or call, and tell us the job you are on. The driver pulls the full bin, runs it to the dump, and sets an empty one in the same spot, same visit. The switch is $200; the new bin's rental and dump fee are billed like any other rental."]),
            ("Before you need one", ["If you think you might fill it, start one size up. A 20 is $50 more than a 15 and saves a $200 switch. If you are not sure, call and describe the job; we have placed enough bins to guess well."]),
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

FAQ = [
    ("What size dumpster do I need?", "Three sizes: 15 yard (about five pickup loads; garage cleanouts, small remodels, yard waste), 20 yard (about seven loads; kitchens, flooring, landscaping, estate cleanouts; our most-rented), and 25 yard (about nine loads; construction, roofing, whole-home cleanouts). Not sure? Call and describe the job; we will fit the bin to it."),
    ("What does the price include?", "Delivery, pickup, the rental period and the dump fee. The 1 to 3 day and 4 to 7 day prices are on the home page for every size. Utah sales tax is added at checkout. Extra days, overweight loads and prohibited items are the only other charges, and they are spelled out on the terms page."),
    ("Is the dump fee really included?", "Yes, on every bin rental. You are not billed by the ton at pickup for a normal load. Very heavy loads (concrete, dirt, brick) have a weight limit and the overage is billed per ton, which is why heavy material wants its own small container; call first for those."),
    ("How long can I keep the bin?", "1 to 3 days or 4 to 7 days, priced separately. Need longer? Call before pickup and we extend it at $50 a day. If the bin fills before the job is done, a bin switch hauls the full one and drops a fresh one in the same trip."),
    ("How fast can you deliver?", "Same-day and next-day delivery are available most of the year, depending on where the trucks are. Book online with your date or call and ask."),
    ("Where does the bin go?", "Driveway, job site or lot, wherever you point. Drivers set it on boards if you want the concrete protected; just say so when you book. If the bin has to sit on a public street, your city may require a permit; the booking form asks, and we will tell you what your city does."),
    ("What can I not put in it?", "Hazardous waste, wet paint and other liquids, asbestos, propane tanks and fuel. Tires, mattresses and appliances with refrigerant can go but carry a handling fee. The full list is on the terms page."),
    ("How do I book and pay?", "Pick the size and the dates on the booking page, enter the address and pay by card. You get a confirmation text with your reference number, a reminder the day before delivery and the day before pickup. Commercial accounts can request a quote instead and Joseph calls back."),
    ("Where do you deliver?", "Weber, Morgan, Davis and Salt Lake County, from a shop in West Haven. The service area page lists every city with how far it is from us. Out past that, call and ask; if it is too far we will say so rather than waste your time."),
    ("Do you do junk removal?", "Yes, weekends only, $550 flat: we bring the truck and the crew, load it, haul it and pay the dump. Weekdays, a 15 yard bin is usually the answer."),
    ("Can I rent a dump trailer instead?", "Yes. $200 a day, 1 to 14 days, with a $300 refundable deposit. You do the hauling and the dump runs yourself; it is the do-it-yourself option."),
    ("Who am I dealing with?", "Joseph Rodrigues and his family. Triple R Dump is family-owned and operated out of West Haven, and the person who answers the phone is the person who books the job."),
]

# ──────────────────────────────────────────────────────────── helpers ─────

def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))

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

PHONE_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.55 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.46 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'

def nav():
    return f'''
<nav aria-label="Primary">
  <div class="nav-row">
    <a href="/" class="nav-mark" aria-label="Triple R Dump, home">
      <picture>
        <source srcset="/assets/triple-r-dump-icon.webp" type="image/webp">
        <img class="nav-icon" src="/assets/triple-r-dump-icon.png" alt="" width="76" height="76">
      </picture>
      <picture>
        <source srcset="/assets/triple-r-dump-nav.webp" type="image/webp">
        <img src="/assets/triple-r-dump-nav.png" alt="Triple R Dump" width="454" height="88">
      </picture>
    </a>
    <ul class="nav-inline">
      <li><a href="/#rates">Bins &amp; Rates</a></li>
      <li><a href="/#how">How It Works</a></li>
      <li><a href="/service-area/">Service Area</a></li>
      <li><a href="/faq/">FAQ</a></li>
      <li><a href="/#reviews">Reviews</a></li>
      <li><a href="{BIZ["tel"]}" class="btn btn-fill">Call {BIZ["phone"]}</a></li>
    </ul>
    <button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-drawer">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
<div class="nav-drawer" id="nav-drawer" role="dialog" aria-label="Navigation menu" aria-modal="true">
  <ul>
    <li><a href="/#rates" class="drawer-link">Bins &amp; Rates</a></li>
    <li><a href="/#how" class="drawer-link">How It Works</a></li>
    <li><a href="/service-area/" class="drawer-link">Service Area</a></li>
    <li><a href="/faq/" class="drawer-link">FAQ</a></li>
    <li><a href="/#reviews" class="drawer-link">Reviews</a></li>
  </ul>
  <a href="{BIZ["tel"]}" class="btn btn-fill">Call {BIZ["phone"]}</a>
</div>'''

def footer():
    sizes = "".join(f'<li><a href="/dumpster-rental/{s["slug"]}/">{s["yd"]} yd dumpster</a></li>' for s in SIZES)
    svcs = "".join(f'<li><a href="/{s["slug"]}/">{s["name"]}</a></li>' for s in SERVICES)
    cities = "".join(f'<li><a href="/service-area/{c["slug"]}/">{c["name"]}</a></li>' for c in CITIES[:8])
    return f'''
<footer>
  <div class="foot-grid wrap">
    <div class="foot-brand">
      <picture>
        <source srcset="/assets/triple-r-dump-foot.webp" type="image/webp">
        <img class="foot-mark" src="/assets/triple-r-dump-foot.png" alt="Triple R Dump" width="416" height="80" loading="lazy">
      </picture>
      <p>Family-owned roll-off dumpster rental, West Haven, Utah. Sustainable solutions for all.</p>
      <div class="foot-social">
        <a href="{BIZ["instagram"]}" target="_blank" rel="noopener" aria-label="Instagram">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        </a>
        <a href="{BIZ["facebook"]}" target="_blank" rel="noopener" aria-label="Facebook">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        </a>
      </div>
    </div>
    <div class="foot-col">
      <h3>Services</h3>
      <ul>{sizes}{svcs}</ul>
    </div>
    <div class="foot-col">
      <h3>Service Area</h3>
      <ul>{cities}<li><a href="/service-area/">Every city we serve</a></li></ul>
    </div>
    <div class="foot-col">
      <h3>Contact</h3>
      <ul>
        <li><a href="{BIZ["tel"]}">{BIZ["phone"]}</a></li>
        <li><a href="mailto:{BIZ["email"]}">{BIZ["email"]}</a></li>
        <li>{BIZ["address"]}</li>
        <li><a href="/faq/">Questions &amp; answers</a></li>
        <li><a href="/terms">Terms &amp; fees</a></li>
      </ul>
    </div>
  </div>
  <div class="foot-bottom wrap">
    <p>© 2026 J. Rodrigues · Triple R Dump · Family owned &amp; operated</p>
    <p>Sustainable solutions for all</p>
    <p>Made by <a href="https://getkellan.com" target="_blank" rel="noopener">Kellan</a></p>
  </div>
</footer>
<a class="call-pill hidden" href="{BIZ["tel"]}" aria-label="Call Triple R Dump, {BIZ["phone"]}">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.55 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.46 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  <span class="call-pill-label">{BIZ["phone"]}<em>Tap to call · same-day available</em></span>
</a>
<script>
  var navEl = document.querySelector('nav');
  var onNavScroll = function () {{ navEl.classList.toggle('scrolled', window.scrollY > 40); }};
  onNavScroll(); window.addEventListener('scroll', onNavScroll, {{ passive: true }});
  var toggle = document.querySelector('.nav-toggle'), drawer = document.getElementById('nav-drawer');
  function closeDrawer() {{ drawer.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu'); document.body.style.overflow = ''; }}
  toggle.addEventListener('click', function () {{ var o = drawer.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(o)); toggle.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); document.body.style.overflow = o ? 'hidden' : ''; }});
  drawer.querySelectorAll('a').forEach(function (l) {{ l.addEventListener('click', closeDrawer); }});
  drawer.addEventListener('click', function (e) {{ if (e.target === drawer) closeDrawer(); }});
  document.addEventListener('keydown', function (e) {{ if (e.key === 'Escape') closeDrawer(); }});
  var pill = document.querySelector('.call-pill');
  var onPill = function () {{ pill.classList.toggle('hidden', window.scrollY < 300); }};
  onPill(); window.addEventListener('scroll', onPill, {{ passive: true }});
</script>'''

def hero(label, h1, sub, img, primary, primary_label):
    return f'''
<section class="page-hero">
  <div class="page-hero-bg" style="background-image:url('{img}')" aria-hidden="true"></div>
  <div class="hero-overlay" aria-hidden="true"></div>
  <div class="page-hero-content">
    <p class="label">{label}</p>
    <h1>{h1}</h1>
    <p class="hero-sub">{sub}</p>
    <div class="hero-actions">
      <a href="{primary}" class="btn btn-fill">{primary_label}</a>
      <a href="{BIZ["tel"]}" class="btn btn-ghost">Call {BIZ["phone"]}</a>
    </div>
  </div>
</section>
<div class="hazard" aria-hidden="true"></div>'''

def ticker():
    items = ["Family Owned &amp; Operated", "Weber · Morgan · Davis · Salt Lake", "Same-Day Delivery Available", "Residential &amp; Commercial", "Dump Fee Included"]
    spans = "".join(f"<span>{i}</span>" for i in items * 2)
    return f'<div class="ticker" aria-label="Service highlights"><div class="ticker-track">{spans}</div></div>'

def rate_table(only=None, heading=True):
    rows = []
    for s in SIZES:
        if only and s["slug"] != only:
            continue
        rows.append(f'''
      <div class="rate-row">
        <img class="rate-thumb" src="{s["img"]}" alt="{s["yd"]} yard roll-off bin" loading="lazy">
        <p class="rate-size">{s["yd"]}<small>yard</small></p>
        <p class="rate-best"><strong>{esc(s["best"])}</strong> {esc(s["fits"])}</p>
        <div class="rate-prices-m">
          <p class="rate-price">${s["p13"]}<small>1–3 days</small></p>
          <p class="rate-price">${s["p47"]}<small>4–7 days</small></p>
        </div>
        <a href="/book?size={s["yd"]}" class="btn btn-fill">Book {s["yd"]} yd</a>
      </div>''')
    head = '<div class="rate-head" aria-hidden="true"><span>Bin</span><span></span><span>Best for</span><span>1–3 days</span><span>4–7 days</span><span></span></div>' if heading else ""
    return f'<div class="rate-table">{head}{"".join(rows)}</div>'

def faq_block(faqs, title="Questions people ask"):
    items = "".join(f'<div class="faq-item"><h3>{esc(q)}</h3><p>{esc(a)}</p></div>' for q, a in faqs)
    return f'''
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">Straight answers</p><h2>{title}</h2></header>
    <div class="faq-grid">{items}</div>
  </div>
</section>'''

def faq_ld(faqs):
    return ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})

def cta():
    return f'''
<section id="contact" class="cta">
  <div class="wrap">
    <p class="label">Ready when you are</p>
    <h2>Book online or<br><em>call the owner.</em></h2>
    <p>Pick the bin, pick the dates, pay by card. Or call and talk it through; {BIZ["owner"]} picks up.</p>
    <div class="cta-actions">
      <a href="/book" class="btn btn-fill">Book online</a>
      <a href="{BIZ["tel"]}" class="btn btn-ghost">Call {BIZ["phone"]}</a>
    </div>
  </div>
</section>'''

def page(path, title, description, body, schemas, og_image=None):
    url = SITE + path
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
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/tokens.css">
  <link rel="stylesheet" href="/pages.css">
  {"".join(schemas)}
</head>
<body>
{nav()}
{body}
{footer()}
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

urls = [("/", "1.0"), ("/book", "0.9"), ("/terms", "0.3")]

# size pages
for s in SIZES:
    path = f"/dumpster-rental/{s['slug']}/"
    title = f"{s['yd']} Yard Dumpster Rental in West Haven, UT | ${s['p13']}, Dump Fee Included"
    desc = f"{s['yd']} yard roll-off dumpster rental in West Haven, Ogden, Roy and the Wasatch Front: ${s['p13']} for 1–3 days, ${s['p47']} for 4–7 days, dump fee included. {s['best']} Book online or call {BIZ['phone']}."
    good = "".join(f"<li>{esc(g)}</li>" for g in s["good"])
    others = [x for x in SIZES if x["slug"] != s["slug"]]
    body = hero(
        f"{s['tag']} · {s['loads']}",
        f"{s['yd']} yard<br><em>dumpster rental</em>",
        esc(s["lead"]),
        s["img"],
        f"/book?size={s['yd']}",
        f"Book the {s['yd']} yd",
    ) + ticker() + f'''
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">The {s["yd"]} yard</p><h2>Straight price.<br><em>Dump's included.</em></h2>
      <p>Delivery, pickup, the rental and the dump fee, in one number. Utah sales tax is added at checkout. Extra days are $50 each; call before pickup to extend.</p></header>
    {rate_table(only=s["slug"])}
  </div>
</section>
<section class="sec">
  <div class="wrap two">
    <div>
      <header class="sec-head"><p class="label">What it takes</p><h2>Good for</h2></header>
      <ul class="checks">{good}</ul>
    </div>
    <div>
      <header class="sec-head"><p class="label">Before you book</p><h2>Three things</h2></header>
      <ul class="points">
        <li><div><strong>Where it goes</strong>{esc(s["fits"])} Tell us which side of the drive; drivers set it on boards if you want the concrete protected. On a public street, your city may want a permit; the form asks.</div></li>
        <li><div><strong>What cannot go in</strong>Hazardous waste, wet paint and liquids, asbestos, propane and fuel. Tires, mattresses and appliances with refrigerant carry a handling fee. Heavy material (concrete, dirt, brick) has a weight limit; call first. <a href="/terms">The full list is on the terms page.</a></div></li>
        <li><div><strong>How it is paid</strong>Online by card when you book. You get a confirmation text with your reference, a reminder the day before delivery and the day before pickup, and a text when it is done.</div></li>
      </ul>
    </div>
  </div>
</section>
{faq_block(s["faq"], title=f"About the {s['yd']} yard")}
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">Other sizes</p><h2>Not the right one?</h2></header>
    <div class="rate-table">{"".join(f'''<div class="rate-row"><img class="rate-thumb" src="{o["img"]}" alt="{o["yd"]} yard roll-off bin" loading="lazy"><p class="rate-size">{o["yd"]}<small>yard</small></p><p class="rate-best"><strong>{esc(o["best"])}</strong></p><div class="rate-prices-m"><p class="rate-price">${o["p13"]}<small>1–3 days</small></p><p class="rate-price">${o["p47"]}<small>4–7 days</small></p></div><a href="/dumpster-rental/{o["slug"]}/" class="btn btn-ghost">About the {o["yd"]} yd</a></div>''' for o in others)}</div>
    <p class="rate-note">Junk gone today instead? <a href="/junk-removal/">Junk removal</a> is weekends only, $550 flat. Hauling it yourself? <a href="/dump-trailer-rental/">Dump trailer</a>, $200 a day.</p>
  </div>
</section>
''' + cta()
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Product", "name": f"{s['yd']} Yard Dumpster Rental", "description": desc,
            "image": SITE + s["img"], "brand": {"@type": "Brand", "name": BIZ["name"]},
            "offers": [
                {"@type": "Offer", "name": "1–3 day rental, dump fee included", "price": str(s["p13"]), "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": SITE + f"/book?size={s['yd']}", "areaServed": "Weber, Morgan, Davis and Salt Lake County, Utah"},
                {"@type": "Offer", "name": "4–7 day rental, dump fee included", "price": str(s["p47"]), "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": SITE + f"/book?size={s['yd']}&tier=4-7"},
            ]}),
        faq_ld(s["faq"]),
        breadcrumbs([("Home", "/"), ("Bins & rates", "/#rates"), (f"{s['yd']} yard", path)]),
    ]
    write(f"dumpster-rental/{s['slug']}/index.html", page(path, title, desc, body, schemas, og_image=s["img"]))
    urls.append((path, "0.9"))

# service pages
for s in SERVICES:
    path = f"/{s['slug']}/"
    secs = "".join(f'<div class="prose-block"><h2>{esc(h)}</h2>{"".join(f"<p>{esc(p)}</p>" for p in ps)}</div>' for h, ps in s["sections"])
    body = hero(
        f"{s['price']} {s['unit']}",
        s["h1"],
        esc(s["lead"]),
        s["img"],
        s["book"],
        "Book it online",
    ) + ticker() + f'''
<section class="sec">
  <div class="wrap two">
    <div class="prose">{secs}</div>
    <aside class="side-card">
      <p class="label">At a glance</p>
      <p class="big-price">{s["price"]}<small>{esc(s["unit"])}</small></p>
      <ul class="checks">
        {"<li>Weekends only</li><li>Truck, crew, hauling and dump fee in one price</li><li>One load; call for more</li>" if s["slug"] == "junk-removal" else ""}
        {"<li>1 to 14 days</li><li>$300 refundable deposit</li><li>Pick up and return in West Haven</li>" if s["slug"] == "dump-trailer-rental" else ""}
        {"<li>Same-trip swap</li><li>Any size that is free</li><li>New bin billed as a normal rental</li>" if s["slug"] == "bin-switch" else ""}
      </ul>
      <a href="{s["book"]}" class="btn btn-fill">Book it online</a>
      <a href="{BIZ["tel"]}" class="side-call">or call {BIZ["phone"]}</a>
    </aside>
  </div>
</section>
{faq_block(s["faq"])}
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">Bins &amp; rates</p><h2>Or rent a <em>bin</em>.</h2><p>Three sizes, dump fee included, priced by the day.</p></header>
    {rate_table()}
  </div>
</section>
''' + cta()
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
    return f'''<li><a href="/service-area/{c["slug"]}/" class="city"><span class="city-name">{esc(c["name"])}</span><span class="city-min">{mins}</span><span class="city-line">{esc(c["line"])}</span></a></li>'''

hub_groups = []
for county in ["Weber", "Davis", "Morgan", "Salt Lake"]:
    cs = [c for c in CITIES if c["county"] == county]
    hub_groups.append(f'<h2 class="county-head">{county} County</h2><ul class="city-grid">{"".join(city_card(c) for c in cs)}</ul>')

hub_body = hero(
    "Where we haul",
    "Weber, Morgan, Davis<br><em>&amp; Salt Lake.</em>",
    "Based in West Haven, serving the Wasatch Front, heart of the city or out past the edge of it. Every city below gets the same prices and the same dump-fee-included deal; the only thing that changes is the drive.",
    AREA_IMG,
    "/book",
    "Book online",
) + ticker() + f'''
<section class="sec">
  <div class="wrap">{"".join(hub_groups)}
    <p class="area-note">Not on the list? Call anyway. If a job is a long way out we will say so rather than waste your time.</p>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">Bins &amp; rates</p><h2>Same price <em>everywhere</em>.</h2><p>Dump fee included. Utah sales tax at checkout.</p></header>
    {rate_table()}
  </div>
</section>
''' + cta()
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
for c in CITIES:
    path = f"/service-area/{c['slug']}/"
    near = sorted([x for x in CITIES if x["slug"] != c["slug"]], key=lambda x: abs(x["min"] - c["min"]))[:5]
    dist = "minutes from the shop" if c["min"] == 0 else f"about {c['min']} minutes from our shop in West Haven"
    title = f"Dumpster Rental in {c['name']}, UT | 15, 20 & 25 Yard Bins, Dump Fee Included"
    desc = f"Roll-off dumpster rental in {c['name']}, Utah from Triple R Dump, {dist}. 15, 20 and 25 yard bins from $300, dump fee included, same-day delivery available. Book online or call {BIZ['phone']}."
    from_shop = "the shop" if c["min"] == 0 else f"~{c['min']} min from the shop"
    body = hero(
        f"{c['county']} County · {from_shop}",
        f"Dumpster rental<br><em>in {esc(c['name'])}.</em>",
        f"15, 20 and 25 yard roll-off bins delivered to {esc(c['name'])}, {dist}. Dump fee included, same-day available, and the person who answers the phone is the owner.",
        AREA_IMG if c["min"] else HERO_IMG,
        "/book",
        "Book online",
    ) + ticker() + f'''
<section class="sec">
  <div class="wrap two">
    <div class="prose">
      <header class="sec-head"><p class="label">{esc(c["name"])}</p><h2>What we haul <em>here</em>.</h2></header>
      {"".join(f"<p>{esc(p)}</p>" for p in c["body"])}
      <p>Same prices as West Haven, dump fee included. Utah sales tax at checkout. <a href="/faq/">Questions answered here.</a></p>
    </div>
    <aside class="side-card">
      <p class="label">From the shop</p>
      <p class="big-price">{"0" if c["min"] == 0 else c["min"]}<small>{"minutes, give or take; this is home" if c["min"] == 0 else "minutes, give or take"}</small></p>
      <ul class="checks"><li>Same-day and next-day available</li><li>Driveway, lot or street (permit if the city asks)</li><li>Bins set on boards on request</li></ul>
      <a href="/book" class="btn btn-fill">Book online</a>
      <a href="{BIZ["tel"]}" class="side-call">or call {BIZ["phone"]}</a>
    </aside>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">Bins &amp; rates</p><h2>Straight prices.<br><em>Dump's included.</em></h2></header>
    {rate_table()}
    <p class="rate-note">Junk gone today? <a href="/junk-removal/">Junk removal</a>, weekends. Hauling it yourself? <a href="/dump-trailer-rental/">Dump trailer</a>, by the day. Bin filled early? <a href="/bin-switch/">Bin switch</a>, same trip.</p>
  </div>
</section>
<section class="sec">
  <div class="wrap">
    <p class="area-note">Also serving {", ".join(f'<a href="/service-area/{n["slug"]}/">{esc(n["name"])}</a>' for n in near)}, and <a href="/service-area/">the rest of the four counties</a>.</p>
  </div>
</section>
''' + cta()
    schemas = [
        ld({"@context": "https://schema.org", "@type": "Service", "name": f"Dumpster rental in {c['name']}, UT", "serviceType": "Roll-off dumpster rental", "provider": PROVIDER,
            "areaServed": {"@type": "City", "name": c["name"], "containedInPlace": {"@type": "AdministrativeArea", "name": f"{c['county']} County, Utah"}}, "url": SITE + path}),
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
) + ticker() + faq_block(FAQ, title="Before you book") + f'''
<section class="sec">
  <div class="wrap">
    <header class="sec-head"><p class="label">Bins &amp; rates</p><h2>Straight prices.<br><em>Dump's included.</em></h2></header>
    {rate_table()}
  </div>
</section>
''' + cta()
write("faq/index.html", page(
    "/faq/",
    "Dumpster Rental FAQ: Sizes, Prices, What Can Go In | Triple R Dump, West Haven UT",
    "What size dumpster you need, what the price includes, how long you can keep it, what cannot go in, where we deliver and how booking works. Straight answers from Triple R Dump in West Haven, Utah.",
    faq_body,
    [faq_ld(FAQ), breadcrumbs([("Home", "/"), ("FAQ", "/faq/")])],
))
urls.append(("/faq/", "0.6"))

# sitemap + robots
write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url>\n    <loc>{SITE}{p}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{pr}</priority>\n  </url>\n" for p, pr in urls) + "</urlset>\n")
write("robots.txt", "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /booked\nDisallow: /r/\nDisallow: /inv/\nDisallow: /calendar/\n\nSitemap: " + SITE + "/sitemap.xml\n")

print(f"\n{len(urls)} URLs in the sitemap.")
