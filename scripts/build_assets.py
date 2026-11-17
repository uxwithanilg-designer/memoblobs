"""Build the website's static images from the MOMOBLOBS render folder.

usage: python scripts/build_assets.py <path-to-momo/renders>
Writes optimized WebP/PNG files into public/ and src/app (icons).
"""
import os
import sys

from PIL import Image

R = sys.argv[1]
WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(WEB, "public")
APP = os.path.join(WEB, "src", "app")


def out(*p):
    path = os.path.join(PUB, *p)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def trim(im, pad=12):
    bbox = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        im = im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))
    return im


def fit_w(im, w):
    return im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((l, t, l + w, t + h))


# --- transparent clay cut-outs
for name, w in [("logo", 1400), ("momo_cheer", 720), ("momo_wave", 720), ("momo_surprised", 720), ("momo_sly", 720),
                ("momo_scared", 720), ("kranky", 820), ("kranky_laugh", 820), ("tiki_sign", 620), ("tiki", 560),
                ("cup", 420), ("coin", 160), ("hero", 1200)]:
    im = trim(Image.open(os.path.join(R, "web_assets", name + ".png")).convert("RGBA"))
    fit_w(im, w).save(out("brand", name.replace("_", "-") + ".webp"), "WEBP", quality=88, method=6)
    if name == "logo":
        fit_w(im, 1200).save(out("brand", "logo.png"), optimize=True)

# --- game art (Momo Shuffle)
long_thumb = Image.open(os.path.join(R, "youtube", "long", "thumbnail.png")).convert("RGB")
fit_w(long_thumb, 1600).save(out("games", "momo-shuffle", "hero.webp"), "WEBP", quality=84, method=6)
cover(long_thumb, 1200, 630).save(out("games", "momo-shuffle", "og.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
for i, f in enumerate(["01_easy_warmup", "05_medium_spin", "28_easy_blackout", "15_impossible_speed"]):
    im = Image.open(os.path.join(R, "youtube", "thumbnails", f + "_thumb.png")).convert("RGB")
    fit_w(im, 720).save(out("games", "momo-shuffle", f"cover-{i + 1}.webp"), "WEBP", quality=84, method=6)
for f in ["main-stage", "cast", "momo-expressions", "short-freeze", "short-reveal", "short-hook"]:
    im = Image.open(os.path.join(R, "concept", f + ".png")).convert("RGB")
    fit_w(im, 1280 if im.width > im.height else 720).save(out("games", "momo-shuffle", f"shot-{f}.webp"), "WEBP", quality=82, method=6)

# --- social / brand
banner = Image.open(os.path.join(R, "branding", "youtube_banner_2560x1440.png")).convert("RGB")
cover(banner.crop((240, 300, 2320, 1140)), 1200, 630).save(out("og.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
fit_w(banner, 1920).save(out("brand", "banner.webp"), "WEBP", quality=82, method=6)

# --- app icons (Momo in the ring, from the channel profile picture)
prof = Image.open(os.path.join(R, "branding", "youtube_profile_1080.png")).convert("RGBA")
ig = Image.open(os.path.join(R, "branding", "instagram_profile_1080.png")).convert("RGB")
for s in (192, 512):
    prof.resize((s, s), Image.LANCZOS).save(out("icons", f"icon-{s}.png"), optimize=True)
# maskable: shrink into the 80% safe zone on the sunburst purple
mask = Image.new("RGBA", (512, 512), (75, 47, 160, 255))
mask.paste(prof.resize((410, 410), Image.LANCZOS), (51, 51))
mask.save(out("icons", "maskable-512.png"), optimize=True)
prof.resize((180, 180), Image.LANCZOS).save(os.path.join(APP, "apple-icon.png"), optimize=True)
prof.resize((512, 512), Image.LANCZOS).save(os.path.join(APP, "icon.png"), optimize=True)
prof.resize((256, 256), Image.LANCZOS).save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
fit_w(prof, 400).save(out("brand", "avatar-momo.webp"), "WEBP", quality=86)
fit_w(ig, 400).save(out("brand", "avatar-momo-pink.webp"), "WEBP", quality=86)

# --- arcade cast (renders/web_assets/chars/<id>-<expr>.png)
import glob
for f in sorted(glob.glob(os.path.join(R, "web_assets", "chars", "*.png"))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = trim(Image.open(f).convert("RGBA"))
    fit_w(im, 760 if name.startswith("noodle") else 520).save(out("brand", "chars", name + ".webp"), "WEBP", quality=88, method=6)
print("assets ok")
