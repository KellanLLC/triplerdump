"""Render the social share cards (og:image) for every page: 1200x630 JPEGs in assets/og/.

    python build_pages.py && python build_og.py && python build_pages.py   # first time
    python build_og.py                     # after a title/photo change, or when the review count moves

build_pages.py lists every page it writes in assets/og/cards.json (slug, title, photo) and
points og:image at assets/og/<slug>.jpg once that file exists (the photo until then, hence
the second build_pages.py run the first time). The homepage (hand-built index.html) is "home".

What a card has to do: it shows up as a ~500 px thumbnail in a feed or a text thread, so
only big things count. Three of them, in reading order:
  1. what + where, as the headline (city or bin size in blue);
  2. proof: the Google star rating and review count, big, read from the LIVE homepage at
     build time (so re-run this when the count grows; the numbers are only ever as old as
     the last build, and an older count just understates);
  3. a real customer, word for word from Google: a white review card on the photo's sky,
     where it doesn't cover the bin. Each page gets the quote that fits it (QUOTE_FOR).
Plus the logo, a Book online + phone line, and the bins' hazard tape. No prices: those
change from the console and an image can't follow.

Rendered by headless Edge in Barlow / Barlow Condensed (the site's fonts, from Google
Fonts), a batch of cards stacked on one tall page, then cut apart with PIL.
"""
import html, json, os, re, shutil, subprocess, tempfile, urllib.request
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "assets", "og")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
W, H, BATCH = 1200, 630, 16
SITE = "https://www.triplerdump.com"
HOME_PHOTO = "/uploads/triplerdump_photos/triplerdump_photos/03_25yd_bin_side.jpeg"  # Joseph with a 25 yd bin

# Verbatim excerpts of 5-star Google reviews (worker/src/reviews.js has the full texts).
QUOTES = {
    "nadine": ("Dropped off the dumpster exactly when they said, and set it on wooden beams so it wouldn't damage my driveway.", "Nadine R."),
    "clayton": ("Midway through I needed a bigger bin and Joseph switched me from a 15 to a 20 yd, no headache.", "Clayton C."),
    "jordyn": ("Scheduling was a breeze and he delivered right on time.", "Jordyn H."),
    "lee": ("They came out everyday through the junk removal and trashout process and had a new dumpster dropped off each time on time.", "Lee H."),
    "david": ("Very punctual and a pleasure to work with. I would definitely use this service again!!", "David H."),
    "greg": ("Joe got us set up fast with the perfect dumpster, and delivery, pickup, and hauling were all on time.", "Greg"),
}
QUOTE_FOR = {
    "home": "nadine", "dumpster-rental": "clayton", "dumpster-rental-15-yard": "clayton", "dumpster-rental-20-yard": "clayton",
    "dumpster-rental-25-yard": "greg", "junk-removal": "lee", "bin-switch": "lee", "dump-trailer-rental": "david",
    "contact": "jordyn", "faq": "nadine", "bbb": "david", "guides-what-size-dumpster-do-i-need": "clayton",
}
ROTATION = ["nadine", "jordyn", "greg", "david"]  # every other page, in turn

def quote_for(slug, i):
    return QUOTES[QUOTE_FOR.get(slug) or ROTATION[i % len(ROTATION)]]

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

STAR, PHONE = icon("star-fill"), icon("phone")
# Google's own four-colour "G" (the mark Google shows next to its reviews), not the one-colour icon.
GOOGLE = ('<svg class="gg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">'
  '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
  '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
  '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
  '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>')
# Joseph's round badge (mountains, truck + bin, "Family owned & operated"): the real logo, 849 px source.
BADGE = "/_archive/logo.png"

def headline(title):
    """(main line, highlighted line) from a page title; highlight may be ''."""
    main = html.unescape(title).split(" | ")[0].strip()
    for pat in (r"^(\d+ Yard Dumpster Rental) in (.+)$", r"^(Dumpster Rental|Junk Removal|Dump Trailer Rental) (?:in )?(.+?, UT)$",
                r"^(Dumpster Rental) (Service Area)$", r"^(Dumpster Swap-Out), (.+)$"):
        m = re.match(pat, main)
        if m:
            return m.group(1), m.group(2)
    return main, ""

# Titles that read badly when split automatically.
LINES = {"contact": ("Call, text", "or book online")}

def card(c, rating, count):
    a, b = c["lines"]
    text, who = c["quote"]
    h1 = (f"<span>{html.escape(a)}</span><em>{html.escape(b)}</em>" if b else html.escape(a))
    return f'''<div class="card">
  <div class="photo" style="background-image:url('{file_url(c["photo"])}')"></div>
  <div class="left">
    <div class="brand"><img class="badge" src="{file_url(BADGE)}" alt="">
      <span class="brand__r"><img class="logo" src="{file_url('/assets/triple-r-dump-light.png')}" alt=""><span class="tag">Family owned &amp; operated · West Haven, UT</span></span></div>
    <h1>{h1}</h1>
    <div class="proof">
      <span class="score">{rating}</span>
      <span class="proof__r"><span class="stars">{STAR * 5}</span><span class="count"><i class="gchip">{GOOGLE}</i>{count} Google reviews</span></span>
    </div>
    <div class="cta"><span class="btn">Book at triplerdump.com</span><span class="tel">{PHONE}801-564-3164</span></div>
  </div>
  <figure class="review">
    <div class="review__top"><span class="stars">{STAR * 5}</span><span class="g">{GOOGLE}Google</span></div>
    <blockquote>&ldquo;{html.escape(text)}&rdquo;</blockquote>
    <figcaption>{html.escape(who)}</figcaption>
  </figure>
  <div class="tape"></div>
</div>'''

CSS = '''
html,body{margin:0;padding:0;background:#0d131d}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:#0d131d;color:#f3f5f8;font-family:Barlow,sans-serif}
.card::before{content:"";position:absolute;inset:0;background:radial-gradient(110% 90% at 0% 0%,#18223a 0%,#0d131d 65%)}
.photo{position:absolute;top:0;right:0;bottom:0;width:560px;background-size:cover;background-position:center;
  clip-path:polygon(90px 0,100% 0,100% 100%,0 100%)}
.left{position:absolute;left:60px;top:40px;bottom:58px;width:560px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:16px}
.badge{width:96px;height:auto;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))}
.brand__r{display:flex;flex-direction:column;gap:9px}
.logo{width:260px;height:auto;display:block}
.tag{font:600 16px/1 Barlow,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#bde9fb}
h1{margin:auto 0 0;font-size:96px;font-family:'Barlow Condensed',sans-serif;font-weight:800;text-transform:uppercase;line-height:.92;letter-spacing:-.005em;color:#fff}
h1 span,h1 em{display:block;white-space:nowrap}
h1 em{font-style:italic;color:#3d8bff}
.proof{display:flex;align-items:center;gap:16px;margin:30px 0 auto}
.score{font:800 74px/.8 'Barlow Condensed',sans-serif;color:#fff}
.proof__r{display:flex;flex-direction:column;gap:7px}
.proof .stars{display:flex;gap:3px;color:#fbbc05}
.proof .stars svg{width:34px;height:34px}
.count{display:flex;align-items:center;gap:9px;font:600 23px/1 Barlow,sans-serif;color:#cfd6e2}
.gchip{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#fff}
.gchip .gg{width:19px;height:19px}
.cta{display:flex;align-items:center;gap:22px;white-space:nowrap}
.btn{background:#116dff;color:#fff;font:700 25px/1 'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.03em;padding:16px 22px;border-radius:4px}
.tel{display:flex;align-items:center;gap:9px;font:700 28px/1 'Barlow Condensed',sans-serif;letter-spacing:.02em;color:#fff}
.tel svg{width:26px;height:26px;color:#3d8bff}
.review{position:absolute;top:36px;right:36px;width:380px;margin:0;padding:18px 22px 17px;background:#fff;color:#0f1726;
  border-radius:10px;box-shadow:0 22px 50px rgba(0,0,0,.45)}
.review__top{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
.review .stars{display:flex;gap:2px;color:#fbbc05}
.review .stars svg{width:21px;height:21px}
.g{display:flex;align-items:center;gap:6px;font:600 17px/1 Barlow,sans-serif;color:#5a667a}
.g .gg{width:19px;height:19px}
blockquote{margin:0;font:600 22px/1.27 Barlow,sans-serif;letter-spacing:-.005em}
figcaption{margin-top:10px;font:600 17px/1 Barlow,sans-serif;color:#5a667a}
figcaption::before{content:"— "}
.tape{position:absolute;left:0;right:0;bottom:0;height:14px;background:repeating-linear-gradient(135deg,#fff 0 16px,#d42a20 16px 32px)}
'''

# Shrink each headline until every line fits the column and the whole thing sits on three lines;
# shrink a long quote so the review card never grows past the photo's sky.
FIT = '''document.fonts.ready.then(() => {
  document.querySelectorAll("h1").forEach((h) => {
    const lines = [...h.querySelectorAll("span,em")]; let px = 96;
    while (px > 48 && (lines.some((l) => l.scrollWidth > 560) || h.scrollWidth > 560 || h.offsetHeight > px * 0.92 * 3 + 2)) h.style.fontSize = (px -= 2) + "px";
  });
  document.querySelectorAll("blockquote").forEach((q) => {
    let px = 22;
    while (px > 17 && q.closest(".review").offsetHeight > 200) q.style.fontSize = (px -= 1) + "px";
  });
});'''

def render(batch, png, rating, count):
    doc = f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,800&family=Barlow:wght@600&display=swap" rel="stylesheet">
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
    cards = [{"slug": "home", "lines": ("Dumpster Rental", "Ogden · Roy · West Haven"), "photo": HOME_PHOTO}]
    for p in pages:
        cards.append({"slug": p["slug"], "lines": LINES.get(p["slug"]) or headline(p["title"]), "photo": p["photo"]})
    for i, c in enumerate(cards):
        c["quote"] = quote_for(c["slug"], i)
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
