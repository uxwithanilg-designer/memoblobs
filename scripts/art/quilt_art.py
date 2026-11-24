"""Quiltfold key art, made from the real game: captures each of the nine quilt kinds mid-solve from a running
`next dev` (headless Chrome, muted) into public/games/quiltfold/kinds/<kind>.webp (the home cards), then lays them out
into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only puzzle boards, no characters.

usage: PORT=3000 python scripts/art/quilt_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "quiltfold")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "quilt")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
BOARDS = [("classic", "medium", 0.45), ("shapes", "medium", 0.5), ("squares", "medium", 0.45), ("ribbons", "medium", 0.5), ("holes", "medium", 0.45), ("mystery", "medium", 0.5), ("notwins", "medium", 0.45), ("fences", "medium", 0.5), ("giant", "easy", 0.5)]


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio"])
        pg = b.new_page(viewport={"width": 1000, "height": 1000}, device_scale_factor=2)
        pg.goto(f"http://localhost:{os.environ.get('PORT', '3000')}/play?g=quiltfold", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__quilt", timeout=120000)
        for board, level, keep in BOARDS:
            pg.evaluate(f"window.__quilt.play('{board}', '{level}')")
            pg.wait_for_timeout(2500)
            pg.evaluate("[...document.querySelectorAll('button')].filter(b => /Let.s go/.test(b.textContent)).forEach(b => b.click())")
            pg.wait_for_timeout(600)
            # fill part of the board so it looks mid-solve, and select one tile
            pg.evaluate(f"(() => {{ const t = window.__quilt; const n = t.puzzle().solution.length; t.lay(Math.round(n * {keep})); }})()")
            pg.wait_for_timeout(700)
            # transparent room behind the tray, so Samurai's cross has no dark corners
            pg.evaluate("(() => { document.querySelectorAll('.qlt-none').forEach(e => { e.style.display = 'none'; }); for (let e = document.querySelector('svg.qlt-board').parentElement; e; e = e.parentElement) { e.style.background = 'transparent'; e.style.backgroundColor = 'transparent'; } })()")
            pg.locator("svg.qlt-board").first.screenshot(path=os.path.join(SHOTS, f"{board}.png"), omit_background=True)
            print("shot", board, flush=True)
        b.close()


def font(size):
    return ImageFont.truetype(FONT, size)


def bg(w, h):
    """the game's bright aurora: peach, lilac and sky glows on a pale lilac room"""
    im = Image.new("RGB", (w, h), "#fbf3e6")
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.1, 0.05, 0.55, (255, 200, 170)), (0.95, 0.4, 0.5, (220, 200, 255)), (0.45, 1.05, 0.55, (190, 235, 215))]:
        d.ellipse([w * cx - w * r, h * cy - w * r * 0.7, w * cx + w * r, h * cy + w * r * 0.7], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.18))
    return Image.blend(im, glow, 0.55)


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
    d.text((x, y + depth), text, font=f, fill=(122, 40, 110), anchor=anchor)
    # gradient fill through a mask
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text((x, y), text, font=f, fill=255, anchor=anchor)
    l, tp, r, bt = mask.getbbox()
    grad = Image.new("RGBA", canvas.size)
    gd = ImageDraw.Draw(grad)
    stops = [(255, 138, 91), (232, 69, 107), (139, 92, 246)]
    for xx in range(l, r):
        k = (xx - l) / max(1, r - l)
        c0, c1, kk = (stops[0], stops[1], k * 2) if k < 0.5 else (stops[1], stops[2], (k - 0.5) * 2)
        gd.line([(xx, tp), (xx, bt)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * kk) for i in range(3)) + (255,))
    canvas.paste(grad, (0, 0), mask)


def build():
    names = {"classic": "CLASSIC", "shapes": "SHAPE HINTS", "squares": "SQUARES ONLY", "ribbons": "RIBBONS", "holes": "HOLEY QUILT",
             "mystery": "MYSTERY", "notwins": "NO TWINS", "fences": "FENCES", "giant": "GIANT QUILT"}
    # the home cards: every kind, mid-solve
    os.makedirs(os.path.join(OUT, "kinds"), exist_ok=True)
    for k in names:
        im = Image.open(os.path.join(SHOTS, f"{k}.png")).convert("RGBA")
        s = 520 / max(im.size)
        im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS).save(os.path.join(OUT, "kinds", f"{k}.webp"), quality=86, method=6)
    # cover 1280x720
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("giant", 400, 8), 830, 50, alpha=90)
    paste_shadow(c, board("shapes", 330, -7), 690, 300, alpha=90)
    paste_shadow(c, board("fences", 300, 5), 950, 360, alpha=90)
    title(c, "QUILTFOLD", (60, 200), 122)
    chip(c, "9 RECTANGLE PUZZLES", (66, 360), 34, (232, 69, 107), (255, 255, 255))
    chip(c, "ONE NUMBER IN EVERY PATCH", (66, 428), 34, (255, 255, 255), (60, 30, 110))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("giant", 360, 8), 770, 40, alpha=90)
    paste_shadow(c, board("shapes", 300, -7), 640, 270, alpha=90)
    paste_shadow(c, board("fences", 280, 5), 880, 320, alpha=90)
    title(c, "QUILTFOLD", (52, 170), 112)
    chip(c, "PLAY FREE ONLINE", (58, 320), 32, (232, 69, 107), (255, 255, 255))
    save(c, "og.jpg", 88)
    # card 600x800
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("shapes", 320, -8), 40, 330, alpha=90)
    paste_shadow(c, board("classic", 330, 7), 230, 390, alpha=90)
    title(c, "QUILTFOLD", (W // 2, 120), 104, anchor="ma")
    chip(c, "ONE NUMBER IN EVERY PATCH", (W // 2, 250), 26, (232, 69, 107), (255, 255, 255), anchor="m")
    save(c, "card.webp")
    # poster 1000x1500: the nine kinds
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    title(c, "QUILTFOLD", (W // 2, 110), 150, anchor="ma")
    chip(c, "ONE NUMBER IN EVERY PATCH", (W // 2, 300), 34, (232, 69, 107), (255, 255, 255), anchor="m")
    cell = 300
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 3, k // 3
        im = board(nm, 250, [-4, 3, -2, 4, -3, 2, -4, 3, -2][k])
        x = 50 + col * cell + (cell - im.width) / 2
        y = 450 + row * 340 + (250 - im.height) / 2
        paste_shadow(c, im, x, y, blur=16, off=14, alpha=80)
        chip(c, lb, (50 + col * cell + cell / 2, 450 + row * 340 + 262), 24, (60, 30, 110), (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
