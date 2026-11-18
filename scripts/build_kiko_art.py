"""Kiko's Jungle Quest cover art from real game renders (the dev server must be running on :3000).

usage: python scripts/build_kiko_art.py [seconds]
writes public/games/kiko-jungle-quest/card.webp (600x800, text-free), hero.webp (1280x720), og.jpg (1200x630) and
kiko.webp (a cut-out of Kiko for the site's character spots). The shots come from the title screen's 3D view: Kiko
running toward the camera through Banana Grove.
"""
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
FONT = os.path.join(HERE, "..", "src", "fonts", "LilitaOne.ttf")
SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 6
URL = "http://localhost:3000/play/kiko-jungle-quest"
ONLY_3D = "(() => { document.body.style.visibility = 'hidden'; document.querySelectorAll('canvas').forEach((c) => { c.style.visibility = 'visible'; }); document.querySelectorAll('nextjs-portal').forEach((e) => { e.style.display = 'none'; }); })()"


def grab(w, h, dpr, clip=None, cam="{d: 3.3, h: 1.35, side: 1, dx: 0}", portrait=False):
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.get_by_text("RUN!", exact=True).first.wait_for(timeout=180000)
        pg.wait_for_function("window.__kikoTitle && window.__kikoTitle.sim", timeout=60000)
        pg.evaluate(f"window.__kikoTitle.debugAdvance({SECS})")
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(800)
        pre = "d.r.portrait('#FF00FF');" if portrait else ""
        pg.evaluate("(() => { const d = window.__kikoTitle; d.pause(); %s d.r.photoCam = %s; d.r.clearFx(); d.r.update(0, []); d.r.render(); })()" % (pre, cam))
        pg.wait_for_timeout(1500)
        png = pg.screenshot(clip=clip) if clip else pg.screenshot()
        b.close()
    return Image.open(io.BytesIO(png)).convert("RGB")


def cover(img, W, H):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def cutout(img):
    """key out the flat magenta background, soften the edge and remove the pink fringe"""
    im = img.convert("RGBA")
    px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            d = abs(r - 255) + g + abs(b - 255)
            a = max(0, min(255, int((d - 60) * 2.2)))
            if a < 255 and a > 0:
                # despill: pull the magenta out of the edge colour
                m = min(r, b) - g
                if m > 0: r -= m * (255 - a) // 255; b -= m * (255 - a) // 255
            px[x, y] = (r, g, b, a)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def compose(shot, W, H, lines=("KIKO'S", "JUNGLE QUEST"), tag="Run, swing and munch!"):
    img = cover(shot, W, H)
    grad = Image.new("L", (W, H)); gp = grad.load()
    for x in range(W):
        a = max(0.0, 1 - x / (W * 0.62)) ** 1.4
        for y in range(H): gp[x, y] = int(210 * a)
    img.paste(Image.new("RGB", (W, H), (18, 52, 28)), (0, 0), grad)
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.24); logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.07)), logo)
    d = ImageDraw.Draw(img)
    size = int(H * 0.17); f = ImageFont.truetype(FONT, size)
    tx, ty = int(W * 0.05), int(H * 0.33)
    for i, w in enumerate(lines):
        y = ty + i * int(size * 0.98)
        fill = (255, 210, 63) if i == 0 else (156, 255, 107)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((tx + 5, y + 10), w, font=f, fill=(20, 30, 10, 220), stroke_width=int(size * 0.11), stroke_fill=(20, 30, 10, 220))
        sh = sh.filter(ImageFilter.GaussianBlur(3)); img.paste(sh, (0, 0), sh)
        d.text((tx, y), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(42, 26, 8))
    f2 = ImageFont.truetype(FONT, int(H * 0.056))
    py = ty + len(lines) * int(size * 0.98) + int(H * 0.04)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, py, tx + tw + 44, py + int(H * 0.095)), radius=int(H * 0.05), fill=(255, 154, 31))
    d.text((tx + 22, py + int(H * 0.018)), tag, font=f2, fill=(255, 255, 255))
    f3 = ImageFont.truetype(FONT, int(H * 0.044))
    d.text((tx, int(H * 0.88)), "FREE · NO SIGN-UP · PLAY ON MOMOBLOBS", font=f3, fill=(255, 248, 235))
    return img


if __name__ == "__main__":
    out = os.path.join(PUB, "games", "kiko-jungle-quest")
    os.makedirs(out, exist_ok=True)
    only = os.environ.get("ONLY", "")
    if only in ("", "card"):
        card = grab(450, 800, 2, {"x": 0, "y": 120, "width": 450, "height": 600})
        card.resize((600, 800), Image.LANCZOS).save(os.path.join(out, "card.webp"), "WEBP", quality=86, method=6)
    if only in ("", "hero"):
        wide = grab(1600, 900, 1, None, "{d: 3.0, h: 1.3, side: 1, dx: 1.7}")
        compose(wide, 1280, 720).save(os.path.join(out, "hero.webp"), "WEBP", quality=86, method=6)
        compose(wide, 1200, 630).save(os.path.join(out, "og.jpg"), quality=86, optimize=True, progressive=True)
    if only in ("", "kiko"):
        shot = grab(700, 800, 1, None, "{d: 3.2, h: 0.75, side: 0.55, dx: 0}", portrait=True)
        kk = cutout(shot)
        s = 440 / max(kk.width, kk.height)
        kk = kk.resize((max(1, int(kk.width * s)), max(1, int(kk.height * s))), Image.LANCZOS)
        canvas = Image.new("RGBA", (480, 480), (0, 0, 0, 0)); canvas.paste(kk, ((480 - kk.width) // 2, (480 - kk.height) // 2), kk)
        canvas.save(os.path.join(out, "kiko.webp"), "WEBP", quality=90, method=6)
    print("art ok", out)
