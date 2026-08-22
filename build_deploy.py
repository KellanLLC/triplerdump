"""Build the deployable site into /deploy.

Copies index.html, tokens.css and all referenced assets, recompressing the
heavy photos (EXIF rotation baked in, max 1920px wide, JPEG q72) so the live
site loads fast. Re-run any time index.html or the photos change.
"""
from PIL import Image, ImageOps
import os, re, shutil

ROOT = r"C:\Users\Home\Desktop\projects\tripe-r-dump"
DST = os.path.join(ROOT, "deploy")

src_html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()

def srcset_refs(html):
    """Local file refs inside every srcset (comma-separated, each entry
    optionally followed by a 1x/2x/640w descriptor). Missed before, which
    silently dropped <picture> sources that had no matching preload href —
    the footer webp 404'd live and rendered as a broken image."""
    out = set()
    for attr in re.findall(r'srcset="([^"]+)"', html):
        for candidate in attr.split(","):
            parts = candidate.split()
            if parts and not parts[0].startswith(("http", "/", "data:", "#")):
                out.add(parts[0])
    return out

refs = sorted(
    set(re.findall(r'(?:src|href)="((?!http|#|tel|mailto|/)[^"]+)"', src_html))
    | set(re.findall(r"url\('([^')]+)'\)", src_html))
    | srcset_refs(src_html)
)

if os.path.exists(DST):
    shutil.rmtree(DST)
os.makedirs(DST)

shutil.copy2(os.path.join(ROOT, "index.html"), DST)
shutil.copy2(os.path.join(ROOT, "tokens.css"), DST)

MAX_W = 1920
# files displayed far smaller than their source — cap tighter
TIGHT = {
    "triple-r-dump2.png": 700,                # nav wordmark, 22px tall on screen
    "uploads/triplerdump_photos/triplerdump_photos/01_15yd_bin.png": 640,  # rates thumb
}
total = 0
for ref in refs:
    if ref in ("tokens.css",):
        continue
    src = os.path.join(ROOT, ref)
    dst = os.path.join(DST, ref)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    ext = os.path.splitext(ref)[1].lower()
    size_in = os.path.getsize(src)

    max_w = TIGHT.get(ref.replace("\\", "/"), MAX_W)
    if ext in (".jpg", ".jpeg") or (ext == ".png" and size_in > 400_000):
        im = ImageOps.exif_transpose(Image.open(src))
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        if ext == ".png":
            if im.mode == "RGBA" and im.getextrema()[3][0] < 255:
                im.save(dst, "PNG", optimize=True)
            else:
                im.convert("RGB").save(dst, "PNG", optimize=True)
        else:
            im.convert("RGB").save(dst, "JPEG", quality=72, optimize=True, progressive=True)
    else:
        shutil.copy2(src, dst)

    size_out = os.path.getsize(dst)
    total += size_out
    print(f"{ref}:  {size_in//1024} -> {size_out//1024} KB")

# ── The generated pages (build_pages.py): size, service, service-area and FAQ
# pages, the stylesheet they share, the sitemap and robots. They are plain
# static files, copied as-is. Their asset refs are ROOT-ABSOLUTE (/assets/...,
# /uploads/...) so one page works from any depth; the scan below resolves that
# leading slash against the repo root and ships anything index.html did not
# already cover, through the same recompression path.
PAGE_DIRS = ["dumpster-rental", "junk-removal", "dump-trailer-rental", "bin-switch", "service-area", "faq"]
PAGE_FILES = ["pages.css", "sitemap.xml", "robots.txt"]
page_refs = set()
for d in PAGE_DIRS:
    src_dir = os.path.join(ROOT, d)
    if not os.path.isdir(src_dir):
        continue
    for dirpath, _, files in os.walk(src_dir):
        for name in files:
            if not name.endswith(".html"):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT)
            os.makedirs(os.path.dirname(os.path.join(DST, rel)), exist_ok=True)
            shutil.copy2(full, os.path.join(DST, rel))
            html = open(full, encoding="utf-8").read()
            page_refs |= set(re.findall(r'(?:src|href|srcset)="/((?:assets|uploads)/[^"\s]+)"', html))
            page_refs |= set(re.findall(r"url\('/((?:assets|uploads)/[^')]+)'\)", html))
for name in PAGE_FILES:
    src = os.path.join(ROOT, name)
    if os.path.exists(src):
        shutil.copy2(src, DST)
        if name == "pages.css":
            page_refs |= set(re.findall(r"url\('/((?:assets|uploads)/[^')]+)'\)", open(src, encoding="utf-8").read()))
for ref in sorted(page_refs - set(refs)):
    src = os.path.join(ROOT, ref)
    dst = os.path.join(DST, ref)
    if not os.path.exists(src):
        print(f"WARNING: page references missing file {ref}")
        continue
    if os.path.exists(dst):
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    ext = os.path.splitext(ref)[1].lower()
    size_in = os.path.getsize(src)
    if ext in (".jpg", ".jpeg") or (ext == ".png" and size_in > 400_000):
        im = ImageOps.exif_transpose(Image.open(src))
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        if ext == ".png":
            im.convert("RGB").save(dst, "PNG", optimize=True)
        else:
            im.convert("RGB").save(dst, "JPEG", quality=72, optimize=True, progressive=True)
    else:
        shutil.copy2(src, dst)
    total += os.path.getsize(dst)
    print(f"(pages) {ref}:  {size_in//1024} -> {os.path.getsize(dst)//1024} KB")

# Workers Static Assets must not upload these if they ever reappear.
with open(os.path.join(DST, ".assetsignore"), "w", encoding="utf-8") as f:
    f.write(".git\n.assetsignore\n")

total += os.path.getsize(os.path.join(DST, "index.html")) + os.path.getsize(os.path.join(DST, "tokens.css"))
print(f"\ndeploy total: {total/1024/1024:.1f} MB")
