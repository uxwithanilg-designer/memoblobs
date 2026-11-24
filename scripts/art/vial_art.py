"""Moonvial key art, made from the real game: captures a mid-game shelf from each of the eight constellations from a
running `next dev` (headless Chrome, muted) into scripts/art/out/vial, then lays them out
into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only puzzle boards, no characters.

usage: PORT=3000 python scripts/art/vial_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "moonvial")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "vial")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
ZONES = ["lantern", "firefly", "crystal", "starfall", "aurora", "orchard", "harbor", "nebula"]


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio"])
        pg = b.new_page(viewport={"width": 420, "height": 860}, device_scale_factor=2)
        pg.goto(f"http://localhost:{os.environ.get('PORT', '3000')}/play?g=moonvial", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__vial", timeout=120000)
        pg.wait_for_timeout(1500)
        for k, zone in enumerate(ZONES):
            pg.evaluate(f"window.__vial.start({k * 10 + 6})")
            pg.wait_for_timeout(900)
            pg.evaluate("[...document.querySelectorAll('button')].filter(b => /brew/.test(b.textContent)).forEach(b => b.click())")
            # a few real pours so the shelf looks mid-game
            moves = pg.evaluate("window.__vial.solve()") or []
            for a_, b_ in moves[: min(5, len(moves) // 3)]:
                pg.wait_for_function("() => window.__vial.idle()", timeout=10000)
                pg.evaluate(f"window.__vial.tap({a_})"); pg.wait_for_timeout(60); pg.evaluate(f"window.__vial.tap({b_})"); pg.wait_for_timeout(200)
            pg.wait_for_timeout(2600)
            pg.locator(".mvl-shelf").first.screenshot(path=os.path.join(SHOTS, f"{zone}.png"))
            print("shot", zone, flush=True)
        b.close()


def font(size):
    return ImageFont.truetype(FONT, size)


def bg(w, h):
    """a moonlit night: violet sky, rose horizon, a warm moon glow"""
    im = Image.new("RGB", (w, h), "#1b1446")
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.85, 0.05, 0.4, (255, 236, 190)), (0.1, 1.0, 0.6, (232, 138, 106)), (0.6, 0.7, 0.6, (90, 60, 190))]:
        d.ellipse([w * cx - w * r, h * cy - w * r * 0.7, w * cx + w * r, h * cy + w * r * 0.7], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.18))
    return Image.blend(im, glow, 0.5)


def board(name, height, angle=0.0):
    im = Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGBA")
    s = height / im.height
    im = im.resize((max(1, int(im.width * s)), int(height)), Image.LANCZOS)
    if angle: im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    return im


def paste_shadow(canvas, im, x, y, blur=28, off=22, alpha=150):
    sh = Image.new("RGBA", (im.width + blur * 4, im.height + blur * 4), (0, 0, 0, 0))
    a = im.split()[3].point(lambda v: min(alpha, v))
    sh.paste(Image.new("RGBA", im.size, (5, 0, 20, 255)), (blur * 2, blur * 2), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh, (int(x - blur * 2), int(y - blur * 2 + off)))
    canvas.alpha_composite(im, (int(x), int(y)))


def clay_text(canvas, text, xy, size, anchor="la", fill=(255, 244, 226)):
    """chunky title with stacked warm 'clay' layers and a soft drop shadow"""
    d = ImageDraw.Draw(canvas)
    f = font(size)
    x, y = xy
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + size * 0.16), text, font=f, fill=(0, 0, 0, 150), anchor=anchor)
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(size * 0.08)))
    layers = [(168, 80, 27), (217, 130, 43), (240, 180, 90)]
    depth = max(2, int(size * 0.035))
    for k, col in enumerate(layers):
        d.text((x, y + depth * (len(layers) - k)), text, font=f, fill=col, anchor=anchor)
    d.text((x, y), text, font=f, fill=fill, anchor=anchor)


def chip(canvas, text, xy, size, bgc=(255, 178, 61), fg=(59, 29, 0), anchor="l"):
    d = ImageDraw.Draw(canvas)
    f = font(size)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    w, h = r - l + size * 1.2, b - t + size * 0.7
    x, y = xy
    if anchor == "m": x -= w / 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=h / 2, fill=bgc)
    d.text((x + size * 0.6, y + h / 2), text, font=f, fill=fg, anchor="lm")
    return w


def save(im, name, q=90):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    if name.endswith(".jpg"): im.convert("RGB").save(path, quality=q, optimize=True, progressive=True)
    else: im.convert("RGB").save(path, quality=q, method=6)
    print("wrote", name, im.size, flush=True)


def title(canvas, text, xy, size, anchor="la"):
    """bold title in the game's pink-to-violet with a deep shadow layer"""
    d = ImageDraw.Draw(canvas)
    f = font(size)
    x, y = xy
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + size * 0.12), text, font=f, fill=(60, 20, 90, 110), anchor=anchor)
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(size * 0.07)))
    depth = max(2, int(size * 0.04))
    d.text((x, y + depth), text, font=f, fill=(42, 26, 94), anchor=anchor)
    # gradient fill through a mask
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text((x, y), text, font=f, fill=255, anchor=anchor)
    l, tp, r, bt = mask.getbbox()
    grad = Image.new("RGBA", canvas.size)
    gd = ImageDraw.Draw(grad)
    stops = [(255, 255, 255), (255, 233, 168), (255, 182, 224)]
    for xx in range(l, r):
        k = (xx - l) / max(1, r - l)
        c0, c1, kk = (stops[0], stops[1], k * 2) if k < 0.5 else (stops[1], stops[2], (k - 0.5) * 2)
        gd.line([(xx, tp), (xx, bt)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * kk) for i in range(3)) + (255,))
    canvas.paste(grad, (0, 0), mask)


def build():
    names = {"lantern": "LANTERN GARDEN", "firefly": "FIREFLY POND", "crystal": "CRYSTAL GROTTO", "starfall": "STARFALL HILL",
             "aurora": "AURORA PEAK", "orchard": "MOON ORCHARD", "harbor": "COMET HARBOR", "nebula": "NEBULA GATE"}
    # cover 1280x720
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("crystal", 560, 6), 930, 60, alpha=90)
    paste_shadow(c, board("lantern", 560, -5), 700, 120, alpha=90)
    title(c, "MOONVIAL", (60, 200), 132)
    chip(c, "ENDLESS POTION SORT", (66, 370), 34, (255, 194, 61), (42, 21, 0))
    chip(c, "POUR · CORK · DELIVER", (66, 438), 34, (154, 107, 255), (255, 255, 255))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("crystal", 500, 6), 880, 50, alpha=90)
    paste_shadow(c, board("lantern", 500, -5), 660, 100, alpha=90)
    title(c, "MOONVIAL", (52, 170), 118)
    chip(c, "PLAY FREE ONLINE", (58, 328), 32, (255, 194, 61), (42, 21, 0))
    save(c, "og.jpg", 88)
    # card 600x800
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("starfall", 520, -6), 20, 260, alpha=90)
    paste_shadow(c, board("orchard", 520, 6), 300, 300, alpha=90)
    title(c, "MOONVIAL", (W // 2, 110), 108, anchor="ma")
    chip(c, "ENDLESS POTION SORT", (W // 2, 238), 26, (255, 194, 61), (42, 21, 0), anchor="m")
    save(c, "card.webp")
    # poster 1000x1500: the eight constellations
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    title(c, "MOONVIAL", (W // 2, 100), 150, anchor="ma")
    chip(c, "ENDLESS STAGES · 8 CONSTELLATIONS", (W // 2, 290), 30, (255, 194, 61), (42, 21, 0), anchor="m")
    cellw = 235
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 4, k // 4
        im = board(nm, 360, [-3, 2, -2, 3, 2, -3, 3, -2][k])
        x = 30 + col * cellw + (cellw - im.width) / 2
        y = 400 + row * 520 + (360 - im.height) / 2
        paste_shadow(c, im, x, y, blur=16, off=14, alpha=80)
        chip(c, lb, (30 + col * cellw + cellw / 2, 400 + row * 520 + 378), 18, (42, 26, 94), (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
