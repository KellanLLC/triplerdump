"""Render the social share cards (og:image) for every page: 1200x630 JPEGs in assets/og/.

    python build_pages.py && python build_og.py && python build_pages.py   # first time
    python build_og.py                                                     # after a title/photo change

build_pages.py lists every page it writes in assets/og/cards.json (slug, title, photo) and
points og:image at assets/og/<slug>.jpg once that file exists (the photo until then, hence
the second build_pages.py run the first time). The homepage (hand-built index.html) is
"home". Cards carry no prices or ratings on purpose: an image can't follow the CMS, so
nothing on it can go stale. Each card = navy panel (logo, headline, three facts, Book
online + phone), the page's own photo on the right, the bins' hazard tape along the bottom.

Rendered by headless Edge in Barlow / Barlow Condensed (the site's fonts, from Google
Fonts), a batch of cards stacked on one tall page, then cut apart with PIL.
"""
import html, json, os, re, shutil, subprocess, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "assets", "og")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
W, H, BATCH = 1200, 630, 16
HOME_PHOTO = "/uploads/triple.r.dump-photo-DY2CxEIFMkG-20260527_075118_707154355.jpg"

def file_url(p):
    return "file:///" + os.path.join(ROOT, p.lstrip("/")).replace("\\", "/")

def icon(name):
    return open(os.path.join(ROOT, "assets", "icons", name + ".svg"), encoding="utf-8").read()

CHECK, PHONE = icon("check-circle"), icon("phone")

def headline(title):
    """(main line, highlighted line) from a page title; highlight may be ''."""
    main = html.unescape(title).split(" | ")[0].strip()
    for pat in (r"^(\d+ Yard Dumpster Rental) in (.+)$", r"^(Dumpster Rental|Junk Removal|Dump Trailer Rental) (?:in )?(.+?, UT)$",
                r"^(Dumpster Rental) (Service Area)$", r"^(Dumpster Swap-Out), (.+)$"):
        m = re.match(pat, main)
        if m:
            return m.group(1), m.group(2)
    return main, ""

# Three facts per card, true for that service (the dumpster ones don't fit a trailer you dump yourself).
FACTS = {
    "junk-removal": ("We load it", "Dump fee included", "Flat price"),
    "dump-trailer-rental": ("Rent by the day", "1 to 14 days", "Book online 24/7"),
    "bin-switch": ("Full bin out", "Fresh bin in", "Same trip"),
}
DUMPSTER_FACTS = ("Dump fee included", "Up to 7 days", "Book online 24/7")
# Titles that read badly when split automatically.
LINES = {"contact": ("Call, text", "or book online")}

def kicker(slug):
    if slug.startswith("guides-"):
        return "Triple R Dump guide"
    return "Family-owned · West Haven, Utah"

def card(c):
    a, b = c["lines"]
    em = f"<em>{html.escape(b)}</em>" if b else ""
    return f'''<div class="card">
  <div class="photo" style="background-image:url('{file_url(c["photo"])}')"></div>
  <div class="grain"></div>
  <div class="left">
    <img class="logo" src="{file_url('/assets/triple-r-dump-light.png')}" alt="">
    <div class="mid">
    <p class="kick">{html.escape(c["kicker"])}</p>
    <h1>{f'<span>{html.escape(a)}</span>' if b else html.escape(a)}{em}</h1>
    <ul class="facts">
      {"".join(f"<li>{CHECK}{html.escape(f)}</li>" for f in FACTS.get(c["slug"], DUMPSTER_FACTS))}
    </ul>
    </div>
    <div class="cta"><span class="btn">Book at triplerdump.com</span><span class="tel">{PHONE}801-564-3164</span></div>
  </div>
  <div class="tape"></div>
</div>'''

CSS = '''
html,body{margin:0;padding:0;background:#0d131d}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:#0d131d;color:#f3f5f8;font-family:Barlow,sans-serif}
.photo{position:absolute;top:0;right:0;bottom:0;width:560px;background-size:cover;background-position:center;
  clip-path:polygon(110px 0,100% 0,100% 100%,0 100%)}
.photo::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(13,19,29,.55),rgba(13,19,29,0) 45%)}
.card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:760px;
  background:radial-gradient(120% 90% at 0% 0%,#18223a 0%,#0d131d 70%)}
.grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
.left{position:absolute;left:64px;top:54px;bottom:62px;width:590px;display:flex;flex-direction:column}
.logo{width:330px;height:auto;display:block}
.mid{margin:auto 0}
.kick{margin:0 0 12px;font:600 19px/1 Barlow,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#bde9fb}
h1{margin:0;font-size:96px;font-family:'Barlow Condensed',sans-serif;font-weight:800;text-transform:uppercase;line-height:.93;letter-spacing:-.005em;color:#fff}
h1 span{display:block;white-space:nowrap}
h1 em{display:block;white-space:nowrap;font-style:italic;color:#3d8bff}
.facts{list-style:none;margin:26px 0 0;padding:0;display:flex;gap:22px;font:600 21px/1 Barlow,sans-serif;color:#cfd6e2}
.facts li{display:flex;align-items:center;gap:8px;white-space:nowrap}
.facts svg{width:24px;height:24px;color:#2fbf71;flex:none}
.cta{display:flex;align-items:center;gap:26px}
.btn{background:#116dff;color:#fff;font:700 27px/1 'Barlow Condensed',sans-serif;text-transform:uppercase;letter-spacing:.03em;padding:17px 26px;border-radius:3px}
.tel{display:flex;align-items:center;gap:10px;font:700 30px/1 'Barlow Condensed',sans-serif;letter-spacing:.02em;color:#fff}
.tel svg{width:28px;height:28px;color:#3d8bff}
.tape{position:absolute;left:0;right:0;bottom:0;height:14px;background:repeating-linear-gradient(135deg,#fff 0 16px,#d42a20 16px 32px)}
'''

# Shrink each headline until the highlighted line fits on one row and the whole thing on three.
FIT = '''document.fonts.ready.then(() => document.querySelectorAll("h1").forEach((h) => {
  const lines = [...h.querySelectorAll("span,em")]; let px = 96;
  while (px > 48 && (lines.some((l) => l.scrollWidth > 590) || h.scrollWidth > 590 || h.offsetHeight > px * 0.93 * 3 + 2)) h.style.fontSize = (px -= 2) + "px";
}));'''

def render(batch, png):
    doc = f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;1,800&family=Barlow:wght@600&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>{"".join(card(c) for c in batch)}<script>{FIT}</script></body></html>'''
    tmp = tempfile.mkdtemp(prefix="og-")
    page = os.path.join(tmp, "cards.html")
    open(page, "w", encoding="utf-8-sig").write(doc)  # BOM, or Edge reads file:// as Windows-1252
    subprocess.run([EDGE, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--user-data-dir={os.path.join(tmp, 'profile')}", f"--window-size={W},{H * len(batch)}",
                    "--virtual-time-budget=15000", f"--screenshot={png}", "file:///" + page.replace("\\", "/")], check=True, timeout=120)
    shutil.rmtree(tmp, ignore_errors=True)

def main():
    pages = json.load(open(os.path.join(OUT, "cards.json"), encoding="utf-8"))
    cards = [{"slug": "home", "lines": ("Dumpster Rental", "Ogden · Roy · West Haven"), "photo": HOME_PHOTO, "kicker": kicker("home")}]
    for p in pages:
        cards.append({"slug": p["slug"], "lines": LINES.get(p["slug"]) or headline(p["title"]), "photo": p["photo"], "kicker": kicker(p["slug"])})
    for i in range(0, len(cards), BATCH):
        batch = cards[i:i + BATCH]
        png = os.path.join(tempfile.gettempdir(), f"og-batch-{i}.png")
        render(batch, png)
        sheet = Image.open(png).convert("RGB")
        assert sheet.size == (W, H * len(batch)), sheet.size
        for j, c in enumerate(batch):
            out = os.path.join(OUT, c["slug"] + ".jpg")
            sheet.crop((0, j * H, W, (j + 1) * H)).save(out, "JPEG", quality=86, optimize=True, progressive=True)
            print(f"{c['slug']:45} {os.path.getsize(out) // 1024} KB  {' / '.join(x for x in c['lines'] if x)}")
        os.remove(png)

if __name__ == "__main__":
    main()
