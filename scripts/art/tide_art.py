"""Blocktide key art, made from the real game: captures eight mid-game boards (one per depth zone of the poster) from a running
`next dev` (headless Chrome, muted) into scripts/art/out/tide, then lays them out
into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only puzzle boards, no characters.

usage: PORT=3000 python scripts/art/tide_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "blocktide")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "tide")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
REALMS = ["lagoon", "reef", "kelp", "wreck", "caves", "ice", "vent", "moon"]


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio"])
        pg = b.new_page(viewport={"width": 520, "height": 900}, device_scale_factor=2)
        pg.goto(f"http://localhost:{os.environ.get('PORT', '3000')}/play?g=blocktide", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__tide", timeout=120000)
        pg.wait_for_timeout(1500)
        for k, realm in enumerate(REALMS):
            pg.evaluate("window.__tide.start()")
            pg.wait_for_timeout(900)
            pg.evaluate("[...document.querySelectorAll('button')].filter(b => /Let.s dive in/.test(b.textContent)).forEach(b => b.click())")
            pg.evaluate(f"window.__tide.demo('art{k}', 0.42)")
            pg.wait_for_timeout(700)
            box = pg.evaluate("""(() => { const c = document.querySelector('.tde-stage canvas').getBoundingClientRect(); const w = c.width, h = c.height;
              const trayH = Math.min(h * 0.3, w * 0.42), bs = Math.floor(Math.min(w - 20, h - trayH - 24)), x0 = (w - bs) / 2, y0 = Math.max(6, (h - trayH - bs) / 2 - 4);
              return { x: c.left + x0 - 9, y: c.top + y0 - 9, width: bs + 18, height: bs + 18 }; })()""")
            pg.evaluate("(() => { for (let e = document.querySelector('.tde-stage canvas').parentElement; e; e = e.parentElement) { e.style.background = 'transparent'; } document.querySelectorAll('.tde-rays,.tde-bubbles').forEach(e => e.style.display = 'none'); })()")
            pg.screenshot(path=os.path.join(SHOTS, f"{realm}.png"), clip=box, omit_background=True)
            print("shot", realm, flush=True)
        b.close()


def font(size):
    return ImageFont.truetype(FONT, size)


def bg(w, h):
    """under the sea: teal light from the surface over deep ocean blue"""
    im = Image.new("RGB", (w, h), "#06233d")
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.5, -0.1, 0.7, (34, 211, 197)), (0.05, 0.95, 0.5, (63, 162, 245)), (0.95, 0.9, 0.45, (255, 185, 56))]:
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
    d.text((x, y + depth), text, font=f, fill=(6, 48, 74), anchor=anchor)
    # gradient fill through a mask
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text((x, y), text, font=f, fill=255, anchor=anchor)
    l, tp, r, bt = mask.getbbox()
    grad = Image.new("RGBA", canvas.size)
    gd = ImageDraw.Draw(grad)
    stops = [(255, 255, 255), (156, 245, 236), (34, 211, 197)]
    for xx in range(l, r):
        k = (xx - l) / max(1, r - l)
        c0, c1, kk = (stops[0], stops[1], k * 2) if k < 0.5 else (stops[1], stops[2], (k - 0.5) * 2)
        gd.line([(xx, tp), (xx, bt)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * kk) for i in range(3)) + (255,))
    canvas.paste(grad, (0, 0), mask)


def build():
    names = {"lagoon": "SUNNY LAGOON", "reef": "CORAL REEF", "kelp": "KELP FOREST", "wreck": "SUNKEN SHIP", "caves": "GLOW CAVES",
             "ice": "ICE SHELF", "vent": "FIRE VENTS", "moon": "MOON TIDE"}
    # cover 1280x720
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("reef", 420, 8), 800, 40, alpha=90)
    paste_shadow(c, board("ice", 330, -7), 680, 330, alpha=90)
    paste_shadow(c, board("caves", 300, 5), 970, 380, alpha=90)
    title(c, "BLOCKTIDE", (60, 200), 128)
    chip(c, "ENDLESS BLOCK PUZZLE", (66, 365), 34, (255, 185, 56), (58, 29, 0))
    chip(c, "FILL A LINE, RIDE THE TIDE", (66, 433), 34, (34, 211, 197), (6, 35, 61))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("reef", 370, 8), 760, 30, alpha=90)
    paste_shadow(c, board("ice", 300, -7), 630, 290, alpha=90)
    paste_shadow(c, board("caves", 280, 5), 900, 330, alpha=90)
    title(c, "BLOCKTIDE", (52, 170), 116)
    chip(c, "PLAY FREE ONLINE", (58, 325), 32, (255, 185, 56), (58, 29, 0))
    save(c, "og.jpg", 88)
    # card 600x800
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("reef", 330, -8), 30, 330, alpha=90)
    paste_shadow(c, board("ice", 330, 7), 230, 400, alpha=90)
    title(c, "BLOCKTIDE", (W // 2, 120), 104, anchor="ma")
    chip(c, "ENDLESS BLOCK PUZZLE", (W // 2, 250), 26, (255, 185, 56), (58, 29, 0), anchor="m")
    save(c, "card.webp")
    # poster 1000x1500: the eight realms
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    title(c, "BLOCKTIDE", (W // 2, 110), 150, anchor="ma")
    chip(c, "ONE ENDLESS DIVE · 8 ZONES", (W // 2, 300), 34, (255, 185, 56), (58, 29, 0), anchor="m")
    cellw = 440
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 2, k // 2
        im = board(nm, 210, [-4, 3, -2, 4, -3, 2, -4, 3][k])
        x = 60 + col * cellw + (cellw - im.width) / 2
        y = 410 + row * 265 + (210 - im.height) / 2
        paste_shadow(c, im, x, y, blur=16, off=14, alpha=80)
        chip(c, lb, (60 + col * cellw + cellw / 2, 410 + row * 265 + 216), 22, (6, 48, 74), (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
