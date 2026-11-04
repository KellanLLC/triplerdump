# guides_content.py — data only; rendered by build_pages.py into /guides/<slug>/
#
# Question/guide pages for triplerdump.com. Triple R Dump's own prices are ALWAYS
# {{TRD:key}} tokens (the worker substitutes live D1 prices at request time); only
# third-party fees (county transfer station, landfill, city programs) are literal
# numbers, and every one of those is cited in the guide's "sources" list.
# Third-party facts were checked against the official pages on 2026-10-09.
# Our own /terms is linked in the text where it matters but is NOT a "source":
# sources are for third-party facts only.
# Prohibited items follow /terms (worker/src/terms.js): tires, appliances with
# refrigerant, TVs/monitors/computers and batteries are NOT allowed in a bin
# ({{TRD:prohibited}} per item if found); mattresses = call first (separate
# handling, extra fee); concrete/dirt/brick/rock = call first (weight).
#
# Contract (see build_pages.py): section strings are inserted as-is inside <p>...</p>;
# a string that starts with "<ul>" is inserted without the <p> wrapper. "lead", FAQ
# questions/answers and "img_alt" are plain text (no HTML).

UPDATED = "2026-10-09"


def _a(href, text):
    """Internal link."""
    return '<a href="%s">%s</a>' % (href, text)


def _x(href, text):
    """Outbound citation link."""
    return '<a href="%s" rel="nofollow noopener" target="_blank">%s</a>' % (href, text)


def _ul(*items):
    return "<ul>" + "".join("<li>%s</li>" % i for i in items) + "</ul>"


# ---- official sources (verified 2026-10-09) ------------------------------------
WEBER_FLYER = "https://www.webercountyutah.gov/Solid_Waste/documents/wm-flyer.pdf"
WEBER_SW = "https://www.webercountyutah.gov/Solid_Waste/"
WASATCH_FEES = "https://www.wasatchintegrated.gov/fees/"
DAVIS_LANDFILL = "https://www.wasatchintegrated.gov/davis-landfill/"
OGDEN_CODE = "https://codelibrary.amlegal.com/codes/ogdencityut/latest/ogdencity_ut/0-0-0-11479"
OGDEN_ROW = "https://www.ogdencity.gov/274/The-City-Right-of-Way"
OGDEN_DAD = "https://www.ogdencity.gov/1113/Dial-A-Dumpster"
ROY_PROGRAMS = "https://www.royutah.gov/departments/public_works/community_programs.php"
BAGSTER = "https://thebagster.com/products/products_services.aspx"

S_WEBER_FLYER = ("Weber County Transfer Station rates, as of July 1, 2026 (Weber County / WM)", WEBER_FLYER)
S_WEBER_SW = ("Weber County Solid Waste Management: transfer station location", WEBER_SW)
S_WASATCH_FEES = ("Wasatch Integrated Waste Management District fees, effective September 2, 2026", WASATCH_FEES)
S_DAVIS = ("Davis Landfill: address, hours and small-load fee (Wasatch Integrated)", DAVIS_LANDFILL)
S_OGDEN_CODE = ("Ogden City Code 7-4-2: Encroachment permits", OGDEN_CODE)
S_OGDEN_ROW = ("Ogden City: The City Right-of-Way", OGDEN_ROW)
S_OGDEN_DAD = ("Ogden City: Dial-A-Dumpster program", OGDEN_DAD)
S_ROY = ("Roy City Public Works: community programs (community dumpsters)", ROY_PROGRAMS)
S_BAGSTER = ("Bagster: capacity, dimensions and accepted materials", BAGSTER)


GUIDES = [
  # ===========================================================================
  {
    "slug": "dumpster-rental-cost-utah",
    "title": "How Much Does a Dumpster Rental Cost in Utah?",
    "description": "Dumpster rental prices in Ogden and northern Utah: 15, 20 and 25 yard prices, what is included, extra fees, and when hauling it yourself is cheaper.",
    "h1": "How much does a dumpster rental <em>cost</em> in Utah?",
    "kicker": "Pricing guide",
    "lead": "A roll-off dumpster from us costs ${{TRD:d15_47}} for a 15 yard, ${{TRD:d20_47}} for a 20 yard and ${{TRD:d25_47}} for a 25 yard, for a rental of up to 7 days. That price covers delivery, pickup, the dump fee and a set weight allowance; Utah sales tax is added at checkout.",
    "img": "/uploads/jobs/roll-off-dumpster-rental-roy-ut.jpg",
    "img_alt": "Triple R Dump roll-off dumpster parked on a residential street in Roy, Utah",
    "sections": [
      ("Our prices, one line each", [
        "We charge one price per bin for a rental of up to 7 days, and no dump fee is added after pickup. {{TRD:fuel_note}} Every charge is on the booking page before you pay, and Utah sales tax is added at checkout.",
        _ul(
          "<strong>15 yard: ${{TRD:d15_47}}</strong>, {{TRD:tons15}} tons included, about five pickup-truck loads. " + _a("/dumpster-rental/15-yard/", "15 yard dumpster rental"),
          "<strong>20 yard: ${{TRD:d20_47}}</strong>, {{TRD:tons20}} tons included, about seven pickup-truck loads. " + _a("/dumpster-rental/20-yard/", "20 yard dumpster rental"),
          "<strong>25 yard: ${{TRD:d25_47}}</strong>, {{TRD:tons25}} tons included, about nine pickup-truck loads. " + _a("/dumpster-rental/25-yard/", "25 yard dumpster rental"),
        ),
        "Most people choose by the project rather than the price. If you are not sure which bin fits your job, the " + _a("/guides/what-size-dumpster-do-i-need/", "dumpster size guide") + " walks through the common ones.",
      ]),
      ("What the price includes", [
        _ul(
          "Delivery to your driveway, lot or job site.",
          "Up to 7 days with the bin. If you finish early, call and we pick it up sooner. The price is the same either way.",
          "Pickup, the haul to the dump and the dump fee for the load, up to the weight included with your size.",
          "Boards under the bin if you want your driveway protected. Ask when you book.",
        ),
        "The weight allowance is the part people skip over. A 15 yard includes {{TRD:tons15}} tons, a 20 yard {{TRD:tons20}} tons and a 25 yard {{TRD:tons25}} tons. That covers a normal cleanout or remodel comfortably. Heavy material is where it gets used up, which is covered below.",
      ]),
      ("What can cost extra", [
        _ul(
          "<strong>Weight over the allowance:</strong> ${{TRD:over_ton}} per ton over, billed from the scale ticket after the bin is dumped.",
          "<strong>Extra days:</strong> ${{TRD:ext_day}} per day past the 7 days. Call before your pickup date and we will move it.",
          "<strong>Prohibited items:</strong> tires, appliances that contain refrigerant, and TVs, monitors, computers and batteries are not allowed in the bin; our terms charge ${{TRD:prohibited}} for each one found in a load. Mattresses need separate handling and an extra fee, so call before one goes in. " + _a("/guides/what-can-go-in-a-dumpster/", "Where those items go instead") + ".",
          "<strong>A trip fee:</strong> if the driver cannot get to the bin because it is blocked, or it is loaded above the rim and cannot be hauled safely.",
          "<strong>Distance:</strong> {{TRD:fuel_note}}",
          "<strong>Utah sales tax</strong>, added at checkout.",
        ),
        "Every one of these is written out on our " + _a("/terms", "terms and fees page") + ". If none of them apply to your job, the bin price plus tax is what you pay.",
      ]),
      ("Where overweight charges actually come from", [
        "In our experience the overage is almost always heavy material, not a bin that was too full. Older homes around Ogden are the usual example: plaster and lath walls, two or three layers of roofing, brick. That debris is dense, so a bin can reach its weight allowance before it looks full.",
        "If your job is plaster, tile with mortar beds, roofing, or anything with concrete, dirt, brick or rock in it, call us at (801) 564-3164 before you book. We will tell you how much can safely go in and which size makes sense. It is cheaper to plan for weight than to pay for it afterward.",
      ]),
      ("Is it cheaper to haul it to the dump yourself?", [
        "Sometimes, yes. If the whole job fits in one or two pickup loads and you already have a truck, haul it yourself and keep the money. Here is what the local dumps charge so you can do the math.",
        "<strong>Weber County Transfer Station</strong> (867 W Wilson Lane, Ogden) charges $35.50 per ton for general waste, with a minimum fee of $17 for qualifying Waste Management customers and $27 for everyone else, as of July 1, 2026. The county rate sheet notes that those unit rates do not include taxes, an energy surcharge or other fees, and that uncovered commercial loads are charged double. " + _x(WEBER_FLYER, "Weber County rate sheet"),
        "<strong>Davis Landfill</strong> in Layton, run by Wasatch Integrated, charges Davis County district residents a flat $10 per load for loads at or below 10,000 pounds, and out-of-district customers $50 per load, as of September 2, 2026. Bring proof of residency for the lower rate. " + _x(WASATCH_FEES, "Wasatch Integrated fee schedule"),
        "So the dump fee itself is not the expensive part, especially in Davis County. What a rental saves you is the truck, the trips and the time. A 20 yard bin holds about seven pickup loads. Hauling that yourself means seven rounds of loading, tying down and covering the load, driving, waiting at the scale and unloading, plus a gate fee every trip.",
        "Covering the load is not optional. Wasatch Integrated charges $10 at the gate for each uncovered or unsecured load, and its fee page quotes the Utah law that makes driving with uncovered trash a fine of not less than $200.",
        "Our rough rule: one or two loads, haul it yourself. Three or more, or a job you will be filling over several days, rent the bin.",
      ]),
      ("Other ways to spend less", [
        _ul(
          "<strong>Pick the right size the first time.</strong> Going up one size usually costs less than a second bin.",
          "<strong>Bin switch for long jobs.</strong> If one bin fills before the job is done, we swap the full one for an empty one in the same trip for ${{TRD:binswitch}}, and the new bin is billed as a normal rental.",
          "<strong>Junk removal if you do not want to load anything.</strong> ${{TRD:junk}} flat, weekends only: our crew loads, hauls and pays the dump for one load. See " + _a("/junk-removal/", "junk removal") + ".",
          "<strong>Dump trailer if you want to haul it yourself.</strong> ${{TRD:trailer_day}} per day plus a ${{TRD:trailer_dep}} refundable deposit. You tow it, load it and pay the dump fee yourself. See " + _a("/dump-trailer-rental/", "dump trailer rental") + ".",
        ),
        "Contractor and commercial jobs are quoted. Choose the commercial option on the " + _a("/book", "booking page") + " or call, and Joseph will get back to you with a price.",
      ]),
    ],
    "table": {
      "caption": "Triple R Dump roll-off sizes and prices (rental up to 7 days, delivery, pickup and dump fee included)",
      "head": ["Size", "Price", "Weight included", "Holds about", "Typical projects"],
      "rows": [
        ["15 yard", "${{TRD:d15_47}}", "{{TRD:tons15}} tons", "5 pickup loads", "Garage cleanout, one bathroom, yard cleanup"],
        ["20 yard", "${{TRD:d20_47}}", "{{TRD:tons20}} tons", "7 pickup loads", "Kitchen remodel, flooring, landscaping, estate cleanout"],
        ["25 yard", "${{TRD:d25_47}}", "{{TRD:tons25}} tons", "9 pickup loads", "Roof tear-off, whole-house cleanout, construction"],
      ],
    },
    "faq": [
      ("How much does a dumpster rental cost for a week?", "With us the bin price already covers up to 7 days: ${{TRD:d15_47}} for a 15 yard, ${{TRD:d20_47}} for a 20 yard and ${{TRD:d25_47}} for a 25 yard, plus Utah sales tax. Extra days after that are ${{TRD:ext_day}} each if you call before pickup."),
      ("How much is a dumpster rental for a day?", "We do not have a separate one-day price. The same price covers anywhere from one day to seven, so if you finish early, call and we will pick it up sooner."),
      ("Is the dump fee included in the price?", "Yes. Delivery, pickup and the dump fee are included, up to {{TRD:tons15}} tons in a 15 yard, {{TRD:tons20}} tons in a 20 yard and {{TRD:tons25}} tons in a 25 yard. Weight over that is ${{TRD:over_ton}} per ton."),
      ("Is it cheaper to rent a dumpster or go to the dump?", "For one or two pickup loads, hauling it yourself is usually cheaper if you already have a truck; local gate fees start at about $10 to $27 a load for residents (Davis Landfill charges out-of-district customers $50 a load). For three or more loads, a bin usually wins once you count the trips, the time and a gate fee on every run."),
      ("What happens if my dumpster is overweight?", "We dump it, the scale ticket shows the weight, and anything over the allowance for your size is billed at ${{TRD:over_ton}} per ton to the card on file. Call before you load heavy material and we will help you avoid it."),
      ("Do you charge extra for delivery?", "{{TRD:fuel_note}} Pickup is always part of the bin price."),
    ],
    "sources": [S_WEBER_FLYER, S_WASATCH_FEES, S_DAVIS],
    "related": ["what-size-dumpster-do-i-need", "dumpster-vs-junk-removal-vs-dump-trailer", "what-can-go-in-a-dumpster"],
  },

  # ===========================================================================
  {
    "slug": "what-size-dumpster-do-i-need",
    "title": "What Size Dumpster Do I Need? Sizes by Project",
    "description": "Which dumpster size fits your project: bathroom, kitchen, garage, basement, house cleanout, flooring, deck, fence, roofing or yard waste. A Utah guide.",
    "h1": "What size dumpster do I <em>need</em>?",
    "kicker": "Size guide",
    "lead": "For most home projects a 15 yard handles a bathroom or a garage, a 20 yard handles a kitchen, flooring or an estate cleanout, and a 25 yard handles roofs, whole-house cleanouts and construction. Volume picks the size, but weight decides whether it works.",
    "img": "/uploads/jobs/dumpster-rental-cottonwood-heights-ut.jpg",
    "img_alt": "Roll-off dumpster on a driveway beside a lawn and trees in Cottonwood Heights, Utah, with bulk bags next to it",
    "sections": [
      ("The three sizes in plain terms", [
        _ul(
          "<strong>15 yard</strong>: about five pickup-truck loads, {{TRD:tons15}} tons included, ${{TRD:d15_47}}. The weekend bin. " + _a("/dumpster-rental/15-yard/", "15 yard dumpster rental"),
          "<strong>20 yard</strong>: about seven pickup-truck loads, {{TRD:tons20}} tons included, ${{TRD:d20_47}}. The one we rent most, and the safe pick when you are unsure. " + _a("/dumpster-rental/20-yard/", "20 yard dumpster rental"),
          "<strong>25 yard</strong>: about nine pickup-truck loads, {{TRD:tons25}} tons included, ${{TRD:d25_47}}. Roofing, whole houses, construction. " + _a("/dumpster-rental/25-yard/", "25 yard dumpster rental"),
        ),
        "The 15 and 20 sit in a standard driveway. The 25 needs a longer footprint, so tell us where it is going and we will say whether it fits. Every size is one price for up to 7 days with delivery, pickup and the dump fee included.",
      ]),
      ("Remodels: bathrooms and kitchens", [
        "<strong>One bathroom</strong> is a 15 yard job: the vanity, toilet, tub or shower surround, drywall and flooring. Watch the tile. Tile set in a mortar bed, and cast-iron tubs, are heavy for their size, so a bathroom gut can use a fair share of the weight allowance without filling much of the bin.",
        "<strong>A kitchen</strong> is a 20 yard job. Cabinets and boxes take up room fast, and if the flooring and some drywall come out at the same time, a 15 fills up early. Stone or tile countertops add weight; mention them when you book.",
        "If you are doing a kitchen and a bathroom together, or a whole main floor, look at the 25 yard or plan on a " + _a("/bin-switch/", "bin switch") + " partway through.",
      ]),
      ("Cleanouts: garage, basement, whole house", [
        "<strong>A garage cleanout</strong> fits a 15 yard for most one- and two-car garages. If the garage is packed to the ceiling, or you are clearing the shed and the side yard too, step up to the 20.",
        "<strong>A basement</strong> is usually a 15 or a 20, depending on how much furniture is down there. A basement finish, where the debris is mostly framing offcuts, drywall scraps and packaging, fits a 15 for one or two rooms and a 20 for a whole basement.",
        "<strong>A whole house or estate cleanout</strong> is a 20 or a 25. Furniture is bulky but light, so these jobs run out of room before they run out of weight. For a large home, a 25 and a bin switch beats guessing low. Appliances with refrigerant, tires and electronics cannot go in the bin, mattresses need a call first, and paint, chemicals and other liquids cannot go in at all; see " + _a("/guides/what-can-go-in-a-dumpster/", "what can go in a dumpster") + ".",
        "If you would rather not do the loading yourself, our " + _a("/junk-removal/", "junk removal") + " crew loads one full load for ${{TRD:junk}} on weekends.",
      ]),
      ("Flooring, decks and fences", [
        "<strong>Carpet and pad</strong> are bulky. A few rooms fit a 15; a whole level of carpet, or carpet plus the tack strip and subfloor, is a 20. Tile flooring is the opposite: it takes little room but weighs a lot.",
        "<strong>Deck removal</strong> is a 15 for a small deck and a 20 for a large one. Cut long boards and joists down so they lie flat; a bin full of crossed boards holds far less than it should.",
        "<strong>Fence removal</strong> is a 15 or a 20 depending on length. Wood panels are light. The concrete around the posts is not, so if the footings are coming out too, call first.",
      ]),
      ("Roof tear-offs: weight is the limit, not space", [
        "Shingles are the classic case of a bin that hits its weight allowance while it still looks half empty. Asphalt shingles are heavy, architectural shingles weigh more than 3-tab, and older homes around Ogden often have two or three layers on them.",
        "So we do not size a roof by eye. Call us at (801) 564-3164 with the number of squares, how many layers are coming off and the shingle type. Your roofer or the original bid will have the square count, and the weight per square is printed on the bundle wrapper or the manufacturer's spec sheet. With those numbers we will tell you whether one bin covers it and which size, and the 25 yard is usually where a roof ends up.",
      ]),
      ("Yard waste, concrete and dirt", [
        "<strong>Branches, brush and green waste</strong> are light and bulky: a 15 for a typical yard cleanup, a 20 for a full landscaping tear-out.",
        "<strong>Sod, dirt, rock, concrete and brick</strong> are a different story. They can reach the weight allowance with very little of the bin used. Heavy material has weight limits, so call before you book and we will tell you how much can go in. Clean dirt and sod can also go to Davis Landfill in Layton as clean fill; see the " + _x(WASATCH_FEES, "Wasatch Integrated fee schedule") + ".",
      ]),
      ("When you are between two sizes", [
        "Go up one. The difference between a 15 yard at ${{TRD:d15_47}} and a 20 yard at ${{TRD:d20_47}} is less than a second delivery, and a bin loaded above the rim cannot be hauled until the extra comes off. If you would like a second opinion, " + _a("/contact/", "call or text us") + " and describe the job; we would rather size it right than sell you the big one. When you know the size, " + _a("/book", "book your dumpster online") + ".",
      ]),
    ],
    "table": {
      "caption": "Dumpster size by project (what we usually send)",
      "head": ["Project", "Usual size", "Watch out for"],
      "rows": [
        ["One bathroom remodel", "15 yard", "Tile, mortar beds and cast-iron tubs are heavy"],
        ["Kitchen remodel", "20 yard", "Stone or tile counters add weight"],
        ["Garage cleanout", "15 yard (20 if packed to the ceiling)", "Paint, chemicals and fuel cannot go in"],
        ["Basement cleanout or finish", "15 for one or two rooms, 20 for a whole basement", "Old paint cans and chemicals stay out"],
        ["Whole-house or estate cleanout", "20 or 25 yard, plus a bin switch for large homes", "Fridges, tires and electronics cannot go in; call first about mattresses"],
        ["Carpet or flooring removal", "15 for a few rooms, 20 for a whole level", "Carpet is bulky; tile is heavy"],
        ["Deck removal", "15 or 20 yard", "Cut boards so they lie flat"],
        ["Fence removal", "15 or 20 yard", "Concrete post footings: call first"],
        ["Roof tear-off", "Call with squares and layers (usually 25 yard)", "Weight, not space, is the limit"],
        ["Yard waste and landscaping", "15 or 20 yard", "Sod, dirt and rock are heavy"],
        ["Concrete, dirt, brick, rock", "Call first", "Weight limits apply"],
      ],
    },
    "faq": [
      ("What size dumpster do I need for a bathroom remodel?", "A 15 yard for one bathroom. It holds about five pickup loads and includes {{TRD:tons15}} tons, which covers the vanity, toilet, tub, drywall and flooring. Mention heavy tile or a cast-iron tub when you book."),
      ("What size dumpster do I need for a garage cleanout?", "A 15 yard for most one- and two-car garages. If it is packed to the ceiling or you are clearing a shed as well, take the 20 yard."),
      ("What size dumpster do I need for a house cleanout?", "A 20 or a 25 yard. Furniture and household goods are bulky but light, so these jobs run out of room first. For a large home, a 25 yard plus a bin switch is the safer plan."),
      ("What size dumpster do I need for roof shingles?", "It depends on the weight, not the volume. Call us with the number of squares, the number of layers and the shingle type, and we will tell you whether one bin covers it. Roofs usually go in a 25 yard."),
      ("How big is a 20 yard dumpster?", "It holds about seven pickup-truck loads and includes {{TRD:tons20}} tons of debris. It fits a standard driveway; if you are unsure about your spot, tell us where it is going and we will tell you whether it fits."),
      ("What if I order a dumpster that is too small?", "Call us. We can swap the full bin for an empty one in the same trip for ${{TRD:binswitch}}, and the new bin is billed as a normal rental. Do not load above the rim; an overfilled bin cannot be hauled."),
    ],
    "sources": [S_WASATCH_FEES],
    "related": ["dumpster-rental-cost-utah", "what-can-go-in-a-dumpster", "dumpster-vs-junk-removal-vs-dump-trailer"],
  },

  # ===========================================================================
  {
    "slug": "dumpster-permit-ogden-weber-davis",
    "title": "Do I Need a Dumpster Permit? Ogden, Weber and Davis",
    "description": "When a dumpster needs a city permit in Ogden and Weber or Davis County: driveway vs street, Ogden's encroachment permit, HOAs, and how to pick a safe spot.",
    "h1": "Do I need a <em>permit</em> for a dumpster?",
    "kicker": "Permits and placement",
    "lead": "A dumpster on your own driveway or private property stays off the public right-of-way, which is what city street permits cover, though an HOA or landlord can still have rules. If it has to go on a public street, sidewalk or park strip, rules vary by city, so ask first; in Ogden that is an encroachment permit from the city.",
    "img": "/uploads/jobs/dumpster-rental-brigham-city-ut.jpg",
    "img_alt": "Roll-off dumpster set on wood boards on a residential driveway in Brigham City, Utah",
    "sections": [
      ("Driveway or street: the one question that matters", [
        "Most of the bins we drop sit in a driveway, and a driveway is your property. Right-of-way permits such as Ogden's cover the public street, curb, park strip and sidewalk, so a bin on your driveway, your lot or your job site stays out of that question. Your HOA, landlord or neighbors on a shared drive may still have a say, and if you are unsure whether your city has rules of its own, ask; more on that below.",
        "The street is different. The public right-of-way belongs to the city, and it is usually bigger than people think: the road, the curb and gutter, the park strip and the sidewalk. Putting a bin there means asking the city first. Under our " + _a("/terms", "rental terms") + ", when a bin goes on a public street the customer is responsible for any city or HOA permit, but tell us when you book and we will tell you what we know about your city.",
      ]),
      ("Ogden: an encroachment permit for the public way", [
        "Ogden City Code 7-4-2 makes it unlawful to place an encroachment on any portion of the public way without an encroachment permit from the mayor or the mayor's designee. " + _x(OGDEN_CODE, "Ogden City Code 7-4-2"),
        "Ogden's right-of-way page says the right-of-way includes city streets, curb and gutter, park strips and sidewalks, and that the right-of-way line is often several feet behind the sidewalk or curb. In other words, the strip of grass in front of your house may still be city property. " + _x(OGDEN_ROW, "Ogden City right-of-way page"),
        "If your Ogden bin has to go on the street, call Ogden City Engineering at 801-629-8990 before your delivery date and ask which permit applies to a roll-off dumpster and what the current fee is. We do not quote the fee here because it is set by the city and can change. If you can fit the bin in the driveway instead, the question goes away. More on " + _a("/service-area/ogden/", "dumpster rental in Ogden") + ".",
      ]),
      ("Other cities we serve", [
        "We have not found a published, official dumpster rule for Roy, Layton, Bountiful, Brigham City or North Ogden, and we are not going to guess at one. If you need street placement in any city, call that city's public works or engineering office (the number is on the city website) and ask three things: does a roll-off on the street need a permit, what does it cost, and how long can it stay.",
        "That goes for every city on our route, including " + _a("/service-area/roy/", "Roy") + ", " + _a("/service-area/layton/", "Layton") + ", Clinton, " + _a("/service-area/bountiful/", "Bountiful") + ", " + _a("/service-area/north-ogden/", "North Ogden") + ", Brigham City and the rest of our " + _a("/service-area/", "service area") + ".",
        "The simplest way around the whole question is the driveway. Nearly every residential job we do fits there.",
      ]),
      ("HOAs, landlords and shared driveways", [
        "An HOA can have its own rules even when the city has none: how long a dumpster can sit, whether it can be in view of the street, or whether it needs approval first. Check your CC&amp;Rs or ask the management company before delivery day. If you rent, get your landlord's okay. On a shared driveway, give the neighbors a heads-up so nobody gets blocked in.",
      ]),
      ("Picking the spot", [
        _ul(
          "<strong>Firm, level ground.</strong> Concrete or asphalt is best. A full bin is heavy, and soft ground ruts.",
          "<strong>Room for the truck.</strong> The truck needs more room than the bin: a straight path to back in and set it down, with no parked cars, trailers or basketball hoops in the way. A blocked bin can mean a trip fee.",
          "<strong>Overhead clearance.</strong> Our terms ask for at least 22 feet of clearance above the spot, away from power lines and tree branches, because the bin tips off the truck.",
          "<strong>Slope.</strong> Steep drives are fine; tell us about the slope when you book and the driver will bring boards and choose a safe spot.",
          "<strong>Grass and what is under it.</strong> A bin can go on grass when the ground is firm and dry, but keep the truck clear of sprinkler lines, septic tanks and wells.",
          "<strong>Keep the sidewalk open</strong> and do not move the bin once it is placed.",
        ),
      ]),
      ("Boards and driveway protection", [
        "Our drivers set bins on boards on request, which spreads the load and protects the surface. The photo at the top of this page is a Brigham City driveway set up that way. Older concrete, new concrete and pavers are the places it matters most. Just say so when you " + _a("/book", "book your dumpster") + ".",
      ]),
    ],
    "table": None,
    "faq": [
      ("Do I need a permit for a dumpster in my driveway?", "A driveway is private property, not the public right-of-way that street permits such as Ogden's cover. Check with your HOA or landlord if you have one, since they can set their own rules, and ask your city if you are unsure."),
      ("Do I need a permit to put a dumpster on the street?", "It depends on the city. The street, curb, park strip and sidewalk are city right-of-way. In Ogden, City Code 7-4-2 requires an encroachment permit for an encroachment on the public way; call Ogden City Engineering at 801-629-8990. In other cities, call public works before delivery and ask."),
      ("Who gets the dumpster permit, me or the dumpster company?", "Under our terms, the customer is responsible for any city or HOA permit when the bin goes on a public street. Tell us when you book and we will tell you what we know about your city."),
      ("Can you put a dumpster on grass?", "Yes, if the ground is firm and dry. Soft ground ruts under a full bin and the truck, so keep it clear of sprinkler lines, septic tanks and wells, and tell us when you book."),
      ("Can you put a dumpster on a sloped driveway?", "Yes. Tell us about the slope when you book; the driver brings boards and sets the bin where it is safe to load and to pick up."),
      ("How long can you keep a dumpster in your driveway?", "Our rental covers up to 7 days. Extra days are ${{TRD:ext_day}} each if you call before your pickup date. An HOA may have its own limit, so check if you have one."),
    ],
    "sources": [S_OGDEN_CODE, S_OGDEN_ROW],
    "related": ["what-size-dumpster-do-i-need", "city-dumpster-days-weber-davis", "dumpster-rental-cost-utah"],
  },

  # ===========================================================================
  {
    "slug": "what-can-go-in-a-dumpster",
    "title": "What Can Go in a Dumpster? Rules and Local Drop-Offs",
    "description": "What can and cannot go in a roll-off dumpster in Utah, and where tires, fridges, mattresses, paint and electronics go instead in Weber and Davis County.",
    "h1": "What can and can't go in a <em>dumpster</em>?",
    "kicker": "Materials",
    "lead": "Household junk, furniture, remodel and construction debris, roofing and yard waste can all go in a roll-off dumpster. Hazardous waste, liquids such as wet paint, asbestos, propane tanks, fuel, tires, appliances with refrigerant, batteries and electronics cannot. Mattresses need a call first, and so do concrete, dirt, brick and rock because of their weight.",
    "img": "/uploads/jobs/dumpster-drop-off-north-ogden.jpg",
    "img_alt": "Triple R Dump roll-off dumpster dropped off at a home in North Ogden, Utah",
    "sections": [
      ("What goes in", [
        _ul(
          "Household junk and furniture: couches, chairs, tables, dressers, boxes, toys, clothing.",
          "Remodel and construction debris: drywall, lumber, cabinets, doors, windows, flooring, carpet and pad, trim.",
          "Roofing: shingles, underlayment and roof boards. They are heavy, so see the " + _a("/guides/what-size-dumpster-do-i-need/", "dumpster size guide") + " first.",
          "Yard waste: branches, brush, bushes, old landscaping.",
          "Appliances without refrigerant, such as washers, dryers and stoves.",
          "Glass: old windows, mirrors and broken glass. Lay them flat and keep sharp pieces wrapped so nobody gets cut loading the rest.",
        ),
        "Load heavy items first and spread them out, keep everything level with the top rim, and do not stack anything above it. A bin loaded over the rim cannot be hauled. When you are ready, " + _a("/book", "book a roll-off dumpster online") + " or call (801) 564-3164.",
      ]),
      ("What cannot go in", [
        _ul(
          "Hazardous waste: chemicals, pesticides, herbicides, and anything radioactive.",
          "Asbestos, including old flooring, siding or insulation you suspect contains it.",
          "Wet paint, motor oil, fuel, antifreeze and other liquids.",
          "Propane tanks and fuel containers.",
          "Batteries, especially lithium-ion, and electronics such as TVs, monitors and computers.",
          "Tires.",
          "Appliances that contain refrigerant (Freon): refrigerators, freezers, window air conditioners.",
        ),
        "These are on our " + _a("/terms", "terms page") + " with the full list, and each one found in a load is ${{TRD:prohibited}} under those terms. Some of them are a fire or leak risk in a bin, and a load with them in it can be refused at the dump. The transfer station and landfill below take tires, fridges and electronics for a small fee.",
      ]),
      ("Mattresses: call first", [
        "<strong>Mattresses and box springs</strong> need separate handling and carry an extra fee, so call (801) 564-3164 before you put one in the bin and we will tell you how to handle it. If you only have one or two, dropping them at the Weber County Transfer Station or Davis Landfill yourself is often simpler; prices are below.",
      ]),
      ("Heavy material: call first", [
        "Concrete, dirt, brick, rock, sod and plaster are heavy, and they use up the weight allowance fast: {{TRD:tons15}} tons in a 15 yard, {{TRD:tons20}} tons in a 20 yard, {{TRD:tons25}} tons in a 25 yard. Weight over that is ${{TRD:over_ton}} per ton. Call us before you book a heavy load and we will tell you how much can safely go in.",
      ]),
      ("Where the rest goes in Weber County", [
        "The Weber County Transfer Station is at 867 W Wilson Lane in Ogden. It is open Monday to Friday 7 a.m. to 5 p.m. and Saturday 8 a.m. to 5 p.m., closed Sundays and major holidays. Waste Management has run its general waste and household hazardous waste collection since July 1, 2026, and the county suggests using 24th Street to Exchange Road because of train traffic on Wilson Lane. " + _x(WEBER_SW, "Weber County Solid Waste"),
        "Its rate sheet, as of July 1, 2026, lists these special items, each on top of the base disposal charge:",
        _ul(
          "Tires: $4.00 each, up to four per person and eight per vehicle per day.",
          "Mattresses and box springs: $15.00 each.",
          "White goods (appliances): $15 per load, plus a $10.00 fee if the Freon has not been removed from a refrigerator.",
          "TVs and computer monitors: $5.00 each.",
          "Household hazardous waste: $20.00 per load.",
        ),
        "The sheet notes those rates do not include taxes, an energy surcharge or other fees. " + _x(WEBER_FLYER, "Weber County rate sheet"),
      ]),
      ("Where the rest goes in Davis County", [
        "Davis Landfill is at 1997 E 3500 N in Layton, open Monday to Saturday, 7 a.m. to 6 p.m. in summer and 7 a.m. to 5 p.m. in winter. " + _x(DAVIS_LANDFILL, "Davis Landfill"),
        "Wasatch Integrated's fee schedule, effective September 2, 2026, charges $4.00 per tire, $15.00 per refrigerator and $15.00 per mattress or box spring. Household hazardous waste and electronic waste are accepted at no charge for district residents with proof of residency, and are not accepted from out-of-district customers. Clean dirt and sod are accepted as clean fill. " + _x(WASATCH_FEES, "Wasatch Integrated fee schedule"),
        "Some cities also run free cleanup dumpsters for residents, with their own banned-items lists. See " + _a("/guides/city-dumpster-days-weber-davis/", "city dumpster days in Weber and Davis County") + ".",
      ]),
    ],
    "table": {
      "caption": "Quick reference: can it go in a Triple R Dump roll-off?",
      "head": ["Item", "In the bin?", "If not, or to save the fee"],
      "rows": [
        ["Furniture, household junk", "Yes", ""],
        ["Drywall, lumber, cabinets, flooring", "Yes", ""],
        ["Shingles", "Yes (heavy; see the size guide)", ""],
        ["Concrete, dirt, brick, rock", "Call first: heavy, we will tell you how much can go in", "Davis Landfill takes clean dirt and sod as clean fill"],
        ["Glass, windows, mirrors", "Yes", ""],
        ["Washer, dryer, stove", "Yes", ""],
        ["Tires", "No", "Transfer station or landfill, $4 each"],
        ["Mattresses, box springs", "Call first (separate handling, extra fee)", "Transfer station or landfill, $15 each"],
        ["Refrigerator, freezer, AC unit", "No", "Transfer station (white goods) or landfill"],
        ["TVs, monitors, computers", "No", "Davis Landfill e-waste (district residents) or Weber transfer station"],
        ["Batteries", "No", "Household hazardous waste drop-off"],
        ["Wet paint, oil, fuel, chemicals", "No", "Household hazardous waste drop-off"],
        ["Propane tanks, asbestos", "No", "Call the transfer station or landfill first"],
      ],
    },
    "faq": [
      ("Can you put appliances in a dumpster?", "Washers, dryers and stoves, yes. Refrigerators, freezers and AC units that contain refrigerant, no: our terms prohibit them in the bin. The Weber County Transfer Station takes white goods for $15 a load (plus $10 if the Freon has not been removed), and Davis Landfill charges $15 per refrigerator."),
      ("Can you put dirt in a dumpster?", "Call first. Dirt is heavy and fills the weight allowance with very little of the bin used, so tell us roughly how much you have and we will tell you how much can go in."),
      ("Can you put electronics in a dumpster?", "No. TVs, monitors, computers and batteries cannot go in our bins. Davis Landfill takes electronic waste at no charge for district residents, and the Weber County Transfer Station charges $5 per TV or monitor plus its base fee."),
      ("Can you put mattresses or tires in a dumpster?", "Tires, no: they are prohibited in our bins. Mattresses need separate handling and an extra fee, so call before one goes in. Both are $4 per tire and $15 per mattress at the Weber County Transfer Station and Davis Landfill."),
      ("Can you put paint in a dumpster?", "Not wet paint, or any other liquid. Take leftover paint to a household hazardous waste drop-off, and ask us before you throw out any paint cans."),
      ("Can you put furniture and glass in a dumpster?", "Yes. Couches, tables, dressers and other furniture are fine, and so are old windows, mirrors and broken glass; lay glass flat and wrap sharp pieces."),
    ],
    "sources": [S_WEBER_FLYER, S_WEBER_SW, S_WASATCH_FEES, S_DAVIS],
    "related": ["what-size-dumpster-do-i-need", "city-dumpster-days-weber-davis", "dumpster-rental-cost-utah"],
  },

  # ===========================================================================
  {
    "slug": "dumpster-vs-junk-removal-vs-dump-trailer",
    "title": "Dumpster vs Junk Removal vs Dump Trailer: Which to Pick",
    "description": "Roll-off dumpster, junk removal or dump trailer? How to choose by cost, effort and timing, plus an honest dumpster vs Bagster comparison. Northern Utah.",
    "h1": "Dumpster, junk removal or dump <em>trailer</em>?",
    "kicker": "Compare options",
    "lead": "Rent a dumpster when you have a lot of debris and a few days to fill it, book junk removal when you want a crew to load it all in one visit, and rent a dump trailer when you want to haul and dump it yourself. We do all three, so here is how we would choose.",
    "img": "/uploads/jobs/dumpster-rental-clinton-ut.jpg",
    "img_alt": "Roll-off truck setting a dumpster on a residential street in Clinton, Utah",
    "sections": [
      ("The short version", [
        _ul(
          "<strong>Lots of debris, several days of work:</strong> a roll-off dumpster.",
          "<strong>A pile that is ready to go and you do not want to lift it:</strong> junk removal.",
          "<strong>Small loads over time, and you are fine doing the driving:</strong> a dump trailer.",
          "<strong>A job bigger than one bin:</strong> a dumpster plus a bin switch.",
        ),
      ]),
      ("Roll-off dumpster: the most room for the money", [
        "A bin is one price for up to 7 days: ${{TRD:d15_47}} for a 15 yard, ${{TRD:d20_47}} for a 20 yard and ${{TRD:d25_47}} for a 25 yard, with delivery, pickup and the dump fee included up to the weight allowance. You load it at your own pace, a little each evening or all at once on Saturday.",
        "It is the right call for remodels, roof tear-offs, basement and garage cleanouts that take more than a day, and anything that produces debris as you go. The trade-off: you do the loading, and the bin needs a spot in your driveway or on the job site for the week. See " + _a("/dumpster-rental/", "dumpster sizes and prices") + ".",
      ]),
      ("Junk removal: you do not lift anything", [
        "Our junk removal is ${{TRD:junk}} flat, weekends only. The crew shows up, loads everything, hauls it away and pays the dump. It covers one load.",
        "It wins when the stuff is already sitting there: a move-out, an estate, a basement full of furniture, a garage you have been meaning to clear. It is also the answer when you cannot lift heavy items, have no room for a bin, or your HOA will not allow one. The limits are real, though: weekends only, one visit and one load. If the job will keep producing debris for days, a bin is the better fit. See " + _a("/junk-removal/", "junk removal in northern Utah") + ".",
      ]),
      ("Dump trailer: haul it yourself", [
        "The dump trailer is ${{TRD:trailer_day}} per day for 1 to 14 days, plus a ${{TRD:trailer_dep}} refundable deposit. You tow it, load it, take it to the dump and pay the dump fee there, then bring it back.",
        "It suits people who want to do the hauling, have smaller loads spread over time, or need to move material more than once. Local gate fees are modest; Davis Landfill charges district residents $10 for a load of 10,000 pounds or less, as of September 2, 2026. The cost is your time and the driving, and every load has to be covered. Our " + _a("/guides/dumpster-rental-cost-utah/", "dumpster cost guide") + " has the local dump fees side by side. See " + _a("/dump-trailer-rental/", "dump trailer rental") + ".",
      ]),
      ("Bin switch for jobs bigger than one bin", [
        "On a big cleanout or a long remodel, one bin may not be enough. A bin switch swaps your full bin for an empty one in the same trip, so the work does not stop. The switch is ${{TRD:binswitch}} and the new bin is billed as a normal rental. Call as soon as you can see the top of the pile. See " + _a("/bin-switch/", "bin switch service") + ".",
      ]),
      ("Dumpster vs Bagster", [
        "A Bagster is a bag you buy, fill and schedule for collection. According to the Bagster site, it holds 3 cubic yards and up to 3,300 pounds, and no more than 1 cubic yard of that can be heavy material such as dirt, brick, rock, concrete, sod or stucco. " + _x(BAGSTER, "Bagster specifications"),
        "For comparison, our smallest bin is 15 yards, about five times the volume of one bag. A bag makes sense for a small, light job when you have a spot it can sit in; check whether collection is available at your address and what it costs. For a remodel, a roof or a real cleanout, a roll-off holds far more and handles heavier debris. We do not know Bagster's local price, so compare it yourself against ours.",
      ]),
    ],
    "table": {
      "caption": "Triple R Dump options compared",
      "head": ["", "Roll-off dumpster", "Junk removal", "Dump trailer"],
      "rows": [
        ["Price", "${{TRD:d15_47}} to ${{TRD:d25_47}}, up to 7 days", "${{TRD:junk}} flat, one load", "${{TRD:trailer_day}} per day plus ${{TRD:trailer_dep}} refundable deposit"],
        ["Who loads it", "You", "Our crew", "You"],
        ["Who hauls and dumps it", "We do, dump fee included", "We do, dump fee included", "You do, and you pay the dump"],
        ["When", "Any day; same-day or next-day most of the year", "Weekends only", "1 to 14 days"],
        ["Best for", "Remodels, roofing, multi-day cleanouts", "Ready piles, furniture, no room for a bin", "DIY hauling, small loads over time"],
        ["Book", _a("/book", "Book a dumpster"), _a("/book?service=junk", "Book junk removal"), _a("/book?service=trailer", "Book the trailer")],
      ],
    },
    "faq": [
      ("Is it cheaper to rent a dumpster or hire junk removal?", "For a lot of debris, a dumpster is cheaper per load: our 20 yard is ${{TRD:d20_47}} for up to 7 days, against ${{TRD:junk}} for one junk removal load. Junk removal costs more because our crew does all the lifting."),
      ("Dumpster rental vs junk removal: which is better for a house cleanout?", "If the house will take days to sort, a dumpster lets you work at your pace. If everything is sorted and ready to go, junk removal clears it in one weekend visit without you lifting anything."),
      ("Dumpster rental vs Bagster: which should I choose?", "A Bagster holds 3 cubic yards and up to 3,300 pounds, with no more than 1 cubic yard of heavy debris, according to Bagster. Our smallest bin is 15 yards. For small, light jobs a bag can work; for remodels, roofing or cleanouts, a roll-off holds far more."),
      ("Can I rent a dump trailer instead of a dumpster?", "Yes. Our dump trailer is ${{TRD:trailer_day}} per day plus a ${{TRD:trailer_dep}} refundable deposit. You tow, load and dump it yourself and pay the dump fee at the gate."),
      ("Is junk removal available on weekdays?", "No, our junk removal runs on weekends only. If you need it gone on a weekday, a dumpster delivered same-day or next-day is the usual answer."),
    ],
    "sources": [S_BAGSTER, S_WASATCH_FEES, S_DAVIS],
    "related": ["dumpster-rental-cost-utah", "what-size-dumpster-do-i-need", "city-dumpster-days-weber-davis"],
  },

  # ===========================================================================
  {
    "slug": "city-dumpster-days-weber-davis",
    "title": "Free City Dumpster Days in Roy and Ogden (2026)",
    "description": "How free city dumpster days work in Roy, Ogden and other Weber and Davis County cities, who can use them, and when renting a dumpster makes more sense.",
    "h1": "City dumpster days and <em>free dumpster</em> programs",
    "kicker": "City programs",
    "lead": "Some cities run free cleanup dumpster programs for residents, such as Roy's community dumpster weeks and Ogden's Dial-A-Dumpster, but they come with residency rules, limited dates and banned materials, and Ogden's excludes remodeling, moving and garage, basement or shed cleanouts. For other cities, check with the city. If you missed the date, have remodel or contractor debris or need more time, renting a dumpster is the fallback.",
    "img": "/uploads/jobs/dumpster-north-ogden-street-placement.jpg",
    "img_alt": "Roll-off dumpster placed at the street in front of a home in North Ogden, Utah",
    "sections": [
      ("What a city dumpster day is", [
        "When people search for their city's dumpster days, dumpster program or free dumpster, they are looking for a cleanup program the city runs for its own residents. These are not rentals. They are run by the city, limited to residents, open on set dates, and limited in what they take. Every city runs its program differently, and the rules change from year to year.",
        "We are a rental company, not the city, so the details below come straight from the two city programs we could verify on official city pages. For anything else, check with your city.",
      ]),
      ("Roy City community dumpsters", [
        "Roy sets out community dumpsters at Roy Public Works, 5051 S 1900 W. Residents haul their own items there, sign in and show proof of residency; the dumpsters are for Roy City residents only. The 2026 schedule listed week-long windows in April, May, late September and October 19 to 24.",
        "Roy's page says no toxic, hazardous or flammable materials, no tires or batteries, and no concrete, bricks or rocks. For current dates and questions, call Roy Public Works at (801) 774-1090. " + _x(ROY_PROGRAMS, "Roy City community programs"),
      ]),
      ("Ogden Dial-A-Dumpster", [
        "Ogden's Dial-A-Dumpster delivers a dumpster to your home. According to the city, it is free for Ogden City residents with an active Ogden City utility account, one dumpster per resident per calendar year. It is delivered on the scheduled date and picked up about 48 hours later, with drop-off and pickup on Mondays, Wednesdays and Fridays.",
        "The city describes it as a neighborhood cleanup program and says it is not for personal home projects: renovating, remodeling, moving in or out, or clearing out basements, garages or sheds. To sign up, you pick up an application at Ogden Public Works, 133 W 29th St, gather five neighbor signatures, decide where it will go and return the form to schedule delivery. It stays free unless the dumpster is overfilled, contains restricted materials or is damaged.",
        "Ogden does not accept tires, batteries, chemicals, shingles, concrete, dirt, rocks, refrigerators, computer monitors, asphalt or tree stumps in it. Call Ogden City at 801-629-8000 for details. " + _x(OGDEN_DAD, "Ogden Dial-A-Dumpster"),
      ]),
      ("Other cities: check your public works page", [
        "West Haven, Layton, Clearfield, Syracuse, Clinton, North Ogden, Bountiful, Brigham City, Hooper, Plain City and the other cities we serve each decide whether to run a program, when, and for whom. We have not verified those programs, and we do not want to send you to the wrong date. Look for a cleanup, bulk waste or community dumpster page on your city's public works website, or call city hall.",
      ]),
      ("When renting makes more sense", [
        _ul(
          "<strong>You missed the date</strong>, or the next one is months away.",
          "<strong>It is a remodel, a move, or a garage, basement or shed cleanout.</strong> Ogden says Dial-A-Dumpster is not for those personal home projects; a rental is.",
          "<strong>It is roofing or contractor debris.</strong> Ogden's program bans shingles, concrete, dirt and rock, and Roy's bans concrete, brick and rock. A rental takes roofing and remodel debris; heavy material uses up the weight allowance fast, so call first.",
          "<strong>You need more than a couple of days.</strong> A Dial-A-Dumpster is picked up after about 48 hours. Our bins stay up to 7 days for one price.",
          "<strong>You need it on your schedule</strong>, at your house, not at a drop-off yard during set hours.",
          "<strong>You have more than one load</strong>, or a rental property, business or contractor job that the city program does not cover.",
        ),
      ]),
      ("What it costs if you rent instead", [
        "Tires, refrigerators and electronics cannot go in our bins either; " + _a("/guides/what-can-go-in-a-dumpster/", "here is where they go instead") + ".",
        "Our bins are one price for up to 7 days with delivery, pickup and the dump fee included: ${{TRD:d15_47}} for a " + _a("/dumpster-rental/15-yard/", "15 yard dumpster") + ", ${{TRD:d20_47}} for a 20 yard and ${{TRD:d25_47}} for a 25 yard, plus Utah sales tax. Most people who missed a city cleanup day are fine with the 15.",
        "If you would rather not load it yourself, " + _a("/junk-removal/", "weekend junk removal") + " is ${{TRD:junk}} for one load. We serve " + _a("/service-area/roy/", "Roy") + ", " + _a("/service-area/ogden/", "Ogden") + " and the rest of Weber, Davis, Box Elder, Cache, Morgan and Salt Lake counties, and Utah County as far south as Springville. " + _a("/book", "Book online") + " or call (801) 564-3164.",
      ]),
    ],
    "table": {
      "caption": "City programs compared with a rental (as published by each city, checked October 2026)",
      "head": ["", "Roy community dumpsters", "Ogden Dial-A-Dumpster", "Triple R Dump rental"],
      "rows": [
        ["Who can use it", "Roy residents with proof of residency", "Ogden residents with an active city utility account", "Anyone in our service area"],
        ["Where", "Drop-off at Roy Public Works", "Delivered to your home", "Delivered to your driveway or job site"],
        ["How long", "Set week-long windows", "About 48 hours", "Up to 7 days"],
        ["How often", "A few windows a year", "Once per calendar year", "Whenever you book"],
        ["Cost", "Free to residents", "Free unless overfilled, restricted items or damage", "${{TRD:d15_47}} to ${{TRD:d25_47}} plus tax"],
        ["Remodeling, moving, garage or basement cleanouts", "Household items only", "Not allowed", "Yes"],
        ["Concrete, rock, shingles", "No concrete, brick or rock", "No shingles, concrete, dirt or rock", "Shingles yes; concrete and rock call first (weight)"],
      ],
    },
    "faq": [
      ("When are Roy City dumpster days?", "Roy posts its community dumpster dates on the Public Works community programs page. The 2026 schedule listed week-long windows in April, May, late September and October 19 to 24. Call Roy Public Works at (801) 774-1090 to confirm."),
      ("Is Ogden's Dial-A-Dumpster free?", "Yes, for Ogden City residents with an active city utility account, once per calendar year, according to the city. It can cost extra if the dumpster is overfilled, has restricted materials in it or is damaged."),
      ("Can contractors use city dumpster days?", "Generally no. Roy's community dumpsters are for Roy City residents only, and Ogden's Dial-A-Dumpster requires a resident utility account. For contractor debris, rent a bin or ask us for a commercial quote."),
      ("Can I put shingles or concrete in a city dumpster?", "Not in Roy's or Ogden's programs. Ogden bans shingles, concrete, dirt and rock, and Roy bans concrete, brick and rock. Our rental bins take shingles; for concrete, dirt or rock, call first and we will tell you how much can go in."),
      ("Can I use Ogden's Dial-A-Dumpster for a remodel or a move?", "No. Ogden says the program is not for personal home projects such as renovating, remodeling, moving in or out, or clearing out basements, garages or sheds. A rental is the tool for those."),
      ("What if I missed my city's free dumpster day?", "Rent one instead. A 15 yard is ${{TRD:d15_47}} for up to 7 days with delivery, pickup and the dump fee included, delivered on your schedule."),
    ],
    "sources": [S_ROY, S_OGDEN_DAD],
    "related": ["what-can-go-in-a-dumpster", "dumpster-rental-cost-utah", "dumpster-permit-ogden-weber-davis"],
  },
]
