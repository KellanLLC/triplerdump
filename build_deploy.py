"""Build the deployable site into /deploy.

Copies index.html, tokens.css and all referenced assets. PHOTOS are shipped as
web-sized copies (see ship_raster): the originals under uploads/ are the owner's
full-res files and are only ever READ, never written. Same filename + extension
in deploy/, so no HTML ref changes. Re-run any time index.html or the photos change.
"""
from PIL import Image, ImageOps, ImageCms
import io, os, re, shutil

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
    set(re.findall(r'(?:src|href)="((?!http|#|tel:|mailto:|sms:|/)[^"]+)"', src_html))
    | set(re.findall(r"url\('([^')]+)'\)", src_html))
    | srcset_refs(src_html)
)

if os.path.exists(DST):
    # An open handle on the deploy/ folder itself (Explorer, a shell cwd) makes
    # the final rmdir fail even after the contents are gone — emptying it is enough.
    for entry in os.listdir(DST):
        p = os.path.join(DST, entry)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
os.makedirs(DST, exist_ok=True)

shutil.copy2(os.path.join(ROOT, "index.html"), DST)
shutil.copy2(os.path.join(ROOT, "tokens.css"), DST)

# ── Photo optimization ─────────────────────────────────────────────────────
# PHOTOS = any .jpg/.jpeg, plus .png files under uploads/ (01_15yd_bin.png is a
# photo saved as PNG). PNGs anywhere else (assets/: logos, favicons, the stencil
# "24/7" art) are copied byte-for-byte so they stay crisp.
#   JPEG: EXIF rotation baked in, Display P3 -> sRGB (iPhone originals are P3;
#         dropping the profile without converting washed the colours out),
#         long edge <= MAX_EDGE, q80 progressive, NO EXIF (the originals carry
#         GPS coordinates) and no ICC (sRGB is the web default).
#   PNG photo over PNG_PHOTO_MIN bytes: long edge <= cap, alpha flattened when
#         it is effectively opaque, 256-colour dithered palette (a photo PNG is
#         ~3x larger lossless; the palette is visually identical at the sizes
#         it is shown). Smaller uploads/ PNGs (icons) are copied as-is.
MAX_EDGE = 1600
JPEG_Q = 80
PNG_PHOTO_MIN = 300_000
# files displayed far smaller than their source — cap tighter (long edge)
TIGHT = {
    "uploads/triplerdump_photos/triplerdump_photos/01_15yd_bin.png": 640,  # rates thumb (+ 15yd page hero)
}
# Whole folders with their own (long edge, JPEG quality). The 2026-10-09 job
# photos are 2400 px originals full of foliage: 1600 q80 was 400-660 KB each,
# 1280 q66 averages ~240 KB and is what the pages' width/height attributes say.
PREFIX_JPEG = {"uploads/jobs/": (1280, 66)}
# Resized copies for srcset: <dir>/w<N>/<file> is generated from <dir>/<file>
# with long edge N (e.g. uploads/jobs/w800/x.jpg), only when no such file exists
# in the repo. The variants exist only inside deploy/.
VARIANT_RE = re.compile(r"^(.*)/w(\d+)/([^/]+\.jpe?g)$", re.I)
VARIANT_Q = 70

def source_for(ref):
    """(source path, long-edge override or None, quality override or None)."""
    key = ref.replace("\\", "/").lstrip("/")
    direct = os.path.join(ROOT, key)
    m = VARIANT_RE.match(key)
    if m and not os.path.exists(direct):
        return os.path.join(ROOT, m.group(1), m.group(3)), int(m.group(2)), VARIANT_Q
    return direct, None, None
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))

def _to_srgb(im):
    icc = im.info.get("icc_profile")
    if not icc:
        return im
    try:
        return ImageCms.profileToProfile(im.convert("RGB"), ImageCms.ImageCmsProfile(io.BytesIO(icc)), SRGB, outputMode="RGB")
    except Exception as e:  # unreadable profile: keep pixels as they are
        print(f"  (colour conversion skipped: {e})")
        return im

def ship_raster(ref, src, dst, edge=None, quality=None):
    """Write ref's deploy copy to dst. Returns a short note of what was done."""
    key = ref.replace("\\", "/").lstrip("/")
    ext = os.path.splitext(key)[1].lower()
    size_in = os.path.getsize(src)
    pre = next((v for k, v in PREFIX_JPEG.items() if key.startswith(k)), None)
    if edge is None:
        edge = TIGHT.get(key, pre[0] if pre else MAX_EDGE)
    q = quality or (pre[1] if pre else JPEG_Q)
    if ext in (".jpg", ".jpeg"):
        im = Image.open(src)
        im = _to_srgb(ImageOps.exif_transpose(im))
        im.thumbnail((edge, edge), Image.LANCZOS)  # never upscales
        im.convert("RGB").save(dst, "JPEG", quality=q, optimize=True, progressive=True)
        return "jpeg %dx%d q%d" % (im.width, im.height, q)
    if ext == ".png" and key.startswith("uploads/") and size_in > PNG_PHOTO_MIN:
        im = ImageOps.exif_transpose(Image.open(src))
        im.thumbnail((edge, edge), Image.LANCZOS)
        if im.mode in ("RGBA", "LA", "P") and im.convert("RGBA").getchannel("A").getextrema()[0] < 200:
            im = im.convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        else:  # effectively opaque (01_15yd_bin.png: min alpha 228 on a few edge px)
            im = im.convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        im.save(dst, "PNG", optimize=True)
        return "png %dx%d palette" % (im.width, im.height)
    shutil.copy2(src, dst)
    return "copied"

total = 0
for ref in refs:
    if ref in ("tokens.css",):
        continue
    src, edge, q = source_for(ref)
    dst = os.path.join(DST, ref)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    size_in = os.path.getsize(src)
    note = ship_raster(ref, src, dst, edge, q)
    size_out = os.path.getsize(dst)
    total += size_out
    print(f"{ref}:  {size_in//1024} -> {size_out//1024} KB  ({note})")

# ── The generated pages (build_pages.py): size, service, service-area and FAQ
# pages, the stylesheet they share, the sitemap and robots. They are plain
# static files, copied as-is. Their asset refs are ROOT-ABSOLUTE (/assets/...,
# /uploads/...) so one page works from any depth; the scan below resolves that
# leading slash against the repo root and ships anything index.html did not
# already cover, through the same recompression path.
PAGE_DIRS = ["dumpster-rental", "junk-removal", "dump-trailer-rental", "bin-switch", "service-area", "faq", "bbb", "contact", "social", "guides", "not-found"]
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
            # every candidate of a multi-entry srcset / imagesrcset, not just the first
            for attr in re.findall(r'(?:srcset|imagesrcset)="([^"]+)"', html):
                page_refs |= {c.split()[0][1:] for c in attr.split(",") if c.split() and c.split()[0].startswith(("/assets/", "/uploads/"))}
            page_refs |= set(re.findall(r"url\('/((?:assets|uploads)/[^')]+)'\)", html))
for name in PAGE_FILES:
    src = os.path.join(ROOT, name)
    if os.path.exists(src):
        shutil.copy2(src, DST)
        if name == "pages.css":
            page_refs |= set(re.findall(r"url\('/((?:assets|uploads)/[^')]+)'\)", open(src, encoding="utf-8").read()))
for ref in sorted(page_refs - set(refs)):
    src, edge, q = source_for(ref)
    dst = os.path.join(DST, ref)
    if not os.path.exists(src):
        print(f"WARNING: page references missing file {ref}")
        continue
    if os.path.exists(dst):
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    size_in = os.path.getsize(src)
    note = ship_raster(ref, src, dst, edge, q)
    total += os.path.getsize(dst)
    print(f"(pages) {ref}:  {size_in//1024} -> {os.path.getsize(dst)//1024} KB  ({note})")

# Social share cards (build_og.py): og:image is an absolute URL the scan above can't see,
# and the JPEGs are final (re-encoding would blur the text), so the folder is copied as-is.
og_src = os.path.join(ROOT, "assets", "og")
if os.path.isdir(og_src):
    os.makedirs(os.path.join(DST, "assets", "og"), exist_ok=True)
    for name in sorted(os.listdir(og_src)):
        if name.endswith(".jpg"):
            shutil.copy2(os.path.join(og_src, name), os.path.join(DST, "assets", "og", name))
            total += os.path.getsize(os.path.join(og_src, name))

# Workers Static Assets must not upload these if they ever reappear.
with open(os.path.join(DST, ".assetsignore"), "w", encoding="utf-8") as f:
    f.write(".git\n.assetsignore\n")

total += os.path.getsize(os.path.join(DST, "index.html")) + os.path.getsize(os.path.join(DST, "tokens.css"))
print(f"\ndeploy total: {total/1024/1024:.1f} MB")

# ── Every local ref must resolve INSIDE deploy/. The scanner has silently missed
# attribute types before (srcset; then the 2nd+ candidates of a srcset). This
# checks src, href, poster, srcset/imagesrcset (every candidate) and CSS url() in
# every deployed HTML/CSS file. Page routes (/book, /service-area/...) are skipped.
def _local_refs(text):
    out = set(re.findall(r'(?:src|href|poster)="([^"#?]+)', text))
    out |= set(re.findall(r"url\(['\"]?([^'\")]+)", text))
    for attr in re.findall(r'(?:srcset|imagesrcset)="([^"]+)"', text):
        out |= {c.split()[0] for c in attr.split(",") if c.split()}
    return {r for r in out if not r.startswith(("http", "tel:", "mailto:", "sms:", "data:", "//", "#"))}

missing = []
for dirpath, _, files in os.walk(DST):
    for name in files:
        if not name.endswith((".html", ".css")):
            continue
        full = os.path.join(dirpath, name)
        for r in _local_refs(open(full, encoding="utf-8").read()):
            if r.startswith("/"):
                if not r.startswith(("/assets/", "/uploads/", "/pages.css", "/favicon")):
                    continue  # a route, not a file
                target = os.path.join(DST, r.lstrip("/"))
            else:
                if "." not in os.path.basename(r):
                    continue  # relative route
                target = os.path.join(os.path.dirname(full), r)
            if not os.path.isfile(target):
                missing.append(f"{os.path.relpath(full, DST)} -> {r}")
if missing:
    print("\nMISSING IN deploy/ (would 404 live):\n  " + "\n  ".join(sorted(missing)))
    raise SystemExit(1)
n_files = sum(len(fs) for _, _, fs in os.walk(DST))
print(f"ref check: every local asset ref in deploy/ resolves ({n_files} files in deploy/)")
