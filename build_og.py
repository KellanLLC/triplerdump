"""Render the social share cards (og:image) for every page: 1200x630 JPEGs in assets/og/.

    python build_pages.py && python build_og.py && python build_pages.py   # first time
    python build_og.py                     # after a title/photo change, or when the review count moves

build_pages.py lists every page it writes in assets/og/cards.json (slug, title, photo) and
points og:image at assets/og/<slug>.jpg once that file exists (the photo until then, hence
the second build_pages.py run the first time). The homepage (hand-built index.html) is "home".

The look: the page's real job photo full bleed, darkened from the left so the type reads;
the logo top left; a blue location line with a pin; a two-line headline (what, in grey, then
the promise, in white); and a bottom row with the phone as a blue button plus the Google
stars, rating and review count. The rating and count are read from the LIVE homepage at build
time (re-run this when the count grows; an older count just understates). No prices: those
change from the console and an image can't follow.

Rendered by headless Edge in Barlow (the site's font, from Google Fonts), a batch of cards
stacked on one tall page, then cut apart with PIL.
"""
import html, json, os, re, shutil, subprocess, tempfile, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "assets", "og")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
W, H, BATCH = 1200, 630, 16
SITE = "https://www.triplerdump.com"
HOME_PHOTO = "/uploads/triplerdump_photos/triplerdump_photos/03_25yd_bin_side.jpeg"  # Joseph with a 25 yd bin
NEAR = "Ogden · Roy · West Haven, UT"

COUNTY = {
    "west-haven": "Weber County", "roy": "Weber County", "hooper": "Weber County", "ogden": "Weber County",
    "north-ogden": "Weber County", "plain-city": "Weber County", "clinton": "Davis County", "syracuse": "Davis County",
    "clearfield": "Davis County", "layton": "Davis County", "bountiful": "Davis County", "brigham-city": "Box Elder County",
    "tremonton": "Box Elder County", "springville": "Utah County", "logan": "Cache County",
    "cottonwood-heights": "Salt Lake County",
}

# (location line, grey line, white line) per page; city pages are built in copy_for().
COPY = {
    "home": (NEAR, "Dumpster rental,", "booked online in minutes."),
    "dumpster-rental": (NEAR, "15, 20 and 25 yard bins,", "one price for up to 7 days."),
    "dumpster-rental-15-yard": ("Ogden · Weber & Davis County", "15 yard dumpsters,", "dump fee included."),
    "dumpster-rental-20-yard": ("Ogden · Weber & Davis County", "20 yard dumpsters,", "dump fee included."),
    "dumpster-rental-25-yard": ("Ogden · Weber & Davis County", "25 yard dumpsters,", "dump fee included."),
    "junk-removal": (NEAR, "Junk removal,", "we load it and haul it."),
    "dump-trailer-rental": ("West Haven · Ogden, UT", "Dump trailer rental,", "load it at your own pace."),
    "bin-switch": ("Ogden · Weber County", "Bin switch-out,", "full bin out, empty bin in."),
    "service-area": ("Logan to Springville, UT", "Dumpster rental,", "across Northern Utah."),
    "faq": (NEAR, "Sizes, prices and rules,", "answered straight."),
    "bbb": ("BBB accredited · West Haven, UT", "Dumpster rental,", "family owned & operated."),
    "contact": ("West Haven, UT", "Call, text,", "or book online."),
    "guides": ("Guides · Northern Utah", "Dumpster rental guides,", "straight answers."),
    "guides-dumpster-rental-cost-utah": ("Guide · Utah", "How much does a", "dumpster rental cost?"),
    "guides-what-size-dumpster-do-i-need": ("Guide · Sizes by project", "What size dumpster", "do I need?"),
    "guides-dumpster-permit-ogden-weber-davis": ("Guide · Ogden, Weber & Davis", "Do I need a", "dumpster permit?"),
    "guides-what-can-go-in-a-dumpster": ("Guide · Rules and drop-offs", "What can go", "in a dumpster?"),
    "guides-dumpster-vs-junk-removal-vs-dump-trailer": ("Guide · Which to pick", "Dumpster, junk removal", "or dump trailer?"),
    "guides-city-dumpster-days-weber-davis": ("Guide · Roy and Ogden, 2026", "Free city", "dumpster days."),
}

def copy_for(slug, title):
    if slug in COPY:
        return COPY[slug]
    m = re.match(r"^(?:service-area|dumpster-rental)-(.+)$", slug)
    if m and m.group(1) in COUNTY:
        city = re.match(r"^Dumpster Rental (.+?), UT", html.unescape(title)).group(1)
        return (f"{city}, UT · {COUNTY[m.group(1)]}", "Dumpster rental,", "dump fee included.")
    return COPY["home"]

def live_rating():
    """(rating, count) as the live homepage shows them (D1 google_reviews, refreshed by the cron)."""
    page = urllib.request.urlopen(urllib.request.Request(SITE + "/", headers={"User-Agent": "trd-build-og"}), timeout=20).read().decode()
    rating = re.search(r'data-trd-num="g_rating">([\d.]+)<', page).group(1)
    count = int(re.search(r'data-trd-num="g_count">(\d+)<', page).group(1))
    return rating, count

def file_url(p):
    return "file:///" + os.path.join(ROOT, p.lstrip("/")).replace("\\", "/")

def icon(name):
    return open(os.path.join(ROOT, "assets", "icons", name + ".svg"), encoding="utf-8").read()

STAR, PHONE, PIN = icon("star-fill"), icon("phone"), icon("map-pin")
# Google's own four-colour "G" (the mark Google shows next to its reviews), not the one-colour icon.
GOOGLE = ('<svg class="gg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">'
  '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
  '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
  '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
  '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>')
# Joseph's round badge (mountains, truck + bin, "Family owned & operated"): the real logo, 849 px source.
BADGE = "/_archive/logo.png"

def card(c, rating, count):
    where, grey, white = c["copy"]
    return f'''<div class="card">
  <div class="photo" style="background-image:url('{file_url(c["photo"])}')"></div>
  <div class="shade"></div>
  <div class="brand"><img class="badge" src="{file_url(BADGE)}" alt=""><img class="logo" src="{file_url('/assets/triple-r-dump-light.png')}" alt=""></div>
  <div class="body">
    <div class="where">{PIN}{html.escape(where)}</div>
    <h1><span class="grey">{html.escape(grey)}</span><span>{html.escape(white)}</span></h1>
    <div class="row">
      <span class="btn">{PHONE}801-564-3164</span>
      <span class="proof"><span class="stars">{STAR * 5}</span><i class="gchip">{GOOGLE}</i>{rating} on Google · {count} reviews · Book online any hour</span>
    </div>
  </div>
</div>'''

CSS = '''
html,body{margin:0;padding:0;background:#0b1018}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:#0b1018;color:#fff;font-family:Barlow,sans-serif}
.photo{position:absolute;inset:0;background-size:cover;background-position:center}
.shade{position:absolute;inset:0;background:
  linear-gradient(90deg,rgba(9,13,21,.95) 0%,rgba(9,13,21,.88) 42%,rgba(9,13,21,.45) 70%,rgba(9,13,21,.1) 100%),
  linear-gradient(0deg,rgba(9,13,21,.8) 0%,rgba(9,13,21,0) 55%),
  linear-gradient(180deg,rgba(9,13,21,.55) 0%,rgba(9,13,21,0) 30%)}
.brand{position:absolute;left:56px;top:42px;display:flex;align-items:center;gap:16px}
.badge{width:92px;height:auto;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
.logo{width:250px;height:auto;display:block;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))}
.body{position:absolute;left:56px;right:56px;bottom:52px}
.where{display:flex;align-items:center;gap:10px;font:700 22px/1 Barlow,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5ea0ff}
.where svg{width:26px;height:26px;flex:none}
h1{margin:20px 0 34px;font:800 78px/1.02 Barlow,sans-serif;letter-spacing:-.012em;text-shadow:0 2px 18px rgba(0,0,0,.35)}
h1 span{display:block;width:max-content;white-space:nowrap}
h1 .grey{color:#c3c8d1}
.row{display:flex;align-items:center;gap:26px;white-space:nowrap}
.btn{display:flex;align-items:center;gap:12px;background:#116dff;color:#fff;font:700 34px/1 Barlow,sans-serif;padding:17px 26px 17px 22px;border-radius:5px;box-shadow:0 10px 24px rgba(0,0,0,.35)}
.btn svg{width:30px;height:30px}
.proof{display:flex;align-items:center;gap:10px;font:600 23px/1 Barlow,sans-serif;color:#eef1f6}
.proof .stars{display:flex;gap:2px;color:#fbbc05}
.proof .stars svg{width:25px;height:25px}
.gchip{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:50%;background:#fff;margin-left:4px}
.gchip .gg{width:17px;height:17px}
'''

# Shrink a headline until both lines fit the card; shrink the proof line if a big count pushes it wide.
FIT = '''document.fonts.ready.then(() => {
  document.querySelectorAll("h1").forEach((h) => {
    let px = 78;
    while (px > 44 && [...h.children].some((l) => l.scrollWidth > 1000)) h.style.fontSize = (px -= 2) + "px";
  });
  document.querySelectorAll(".row").forEach((r) => {
    const p = r.querySelector(".proof"); let px = 23;
    while (px > 16 && r.scrollWidth > 1088) p.style.fontSize = (px -= 1) + "px";
  });
});'''

def render(batch, png, rating, count):
    doc = f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@600;700;800&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>{"".join(card(c, rating, count) for c in batch)}<script>{FIT}</script></body></html>'''
    tmp = tempfile.mkdtemp(prefix="og-")
    page = os.path.join(tmp, "cards.html")
    open(page, "w", encoding="utf-8-sig").write(doc)  # BOM, or Edge reads file:// as Windows-1252
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={os.path.join(tmp, 'profile')}", f"--window-size={W},{H * len(batch)}",
                    "--virtual-time-budget=15000", f"--screenshot={png}", "file:///" + page.replace("\\", "/")], check=True, timeout=120)
    shutil.rmtree(tmp, ignore_errors=True)

def main():
    rating, count = live_rating()
    print(f"live Google rating {rating}, {count} reviews")
    pages = json.load(open(os.path.join(OUT, "cards.json"), encoding="utf-8"))
    cards = [{"slug": "home", "copy": COPY["home"], "photo": HOME_PHOTO}]
    for p in pages:
        cards.append({"slug": p["slug"], "copy": copy_for(p["slug"], p["title"]), "photo": p["photo"]})
    for i in range(0, len(cards), BATCH):
        batch = cards[i:i + BATCH]
        png = os.path.join(tempfile.gettempdir(), f"og-batch-{i}.png")
        render(batch, png, rating, count)
        sheet = Image.open(png).convert("RGB")
        assert sheet.size == (W, H * len(batch)), sheet.size
        for j, c in enumerate(batch):
            out = os.path.join(OUT, c["slug"] + ".jpg")
            sheet.crop((0, j * H, W, (j + 1) * H)).save(out, "JPEG", quality=86, optimize=True, progressive=True)
            print(f"{c['slug']:48} {os.path.getsize(out) // 1024} KB")
        os.remove(png)

if __name__ == "__main__":
    main()
