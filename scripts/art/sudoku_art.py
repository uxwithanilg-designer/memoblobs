"""Sudoku Ninefold key art, made from the real game: captures each board mid-solve from a running `next dev`
(headless Chrome, muted), then lays them out into the card (600x800), cover (1280x720), poster (1000x1500) and
og.jpg (1200x630) in public/games/sudoku-ninefold/. No characters — only puzzle boards.

usage: python scripts/art/sudoku_art.py [capture] [build]   (default both; needs `next dev` on :3000)
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "sudoku-ninefold")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "sudoku")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
BOARDS = [("classic9", "medium", 30), ("killer", "medium", 34), ("samurai", "easy", 120), ("xsudoku", "medium", 28), ("thermo", "medium", 26), ("giant16", "easy", 70), ("mini4", "easy", 3), ("classic6", "medium", 10), ("giant25", "easy", 150)]


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio"])
        pg = b.new_page(viewport={"width": 1000, "height": 1000}, device_scale_factor=2)
        pg.goto(f"http://localhost:{os.environ.get('PORT', '3000')}/play?g=sudoku-ninefold", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__sudoku", timeout=60000)
        for board, level, keep in BOARDS:
            pg.evaluate(f"window.__sudoku.play('{board}', '{level}')")
            pg.wait_for_timeout(2500)
            pg.evaluate("[...document.querySelectorAll('button')].filter(b => /Let.s go/.test(b.textContent)).forEach(b => b.click())")
            pg.wait_for_timeout(600)
            # fill part of the board so it looks mid-solve, and select one tile
            pg.evaluate(f"(() => {{ const h = window.__sudoku; const left = h.fillAllBut({keep}); if (left && left.length) h.select(left[Math.floor(left.length / 2)]); }})()")
            pg.wait_for_timeout(700)
            # transparent room behind the tray, so Samurai's cross has no dark corners
            pg.evaluate("(() => { document.querySelectorAll('.cdk-blob').forEach(e => { e.style.display = 'none'; }); for (let e = document.querySelector('.cdk-tray').parentElement; e; e = e.parentElement) { e.style.background = 'transparent'; e.style.backgroundColor = 'transparent'; } })()")
            pg.locator(".cdk-tray").first.screenshot(path=os.path.join(SHOTS, f"{board}.png"), omit_background=True)
            print("shot", board, flush=True)
        b.close()


def font(size):
    return ImageFont.truetype(FONT, size)


def bg(w, h):
    """night violet with warm and cool glows, like the game's room"""
    im = Image.new("RGB", (w, h), "#140a30")
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.15, 0.1, 0.55, (255, 122, 61)), (0.95, 0.35, 0.5, (123, 92, 255)), (0.45, 1.05, 0.55, (46, 211, 230))]:
        d.ellipse([w * cx - w * r, h * cy - w * r * 0.7, w * cx + w * r, h * cy + w * r * 0.7], fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.18))
    return Image.blend(im, glow, 0.42)


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


def build():
    # cover 1280x720 (the card art everywhere): title left, three boards fanned right
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("samurai", 470, 9), 690, 150)
    paste_shadow(c, board("killer", 400, -7), 560, 260)
    paste_shadow(c, board("classic9", 390, 4), 860, 300)
    clay_text(c, "SUDOKU", (64, 120), 150)
    clay_text(c, "NINEFOLD", (64, 275), 112)
    chip(c, "9 BOARDS", (68, 430), 34)
    chip(c, "DAILY + WEEKLY", (68, 498), 34, (255, 255, 255), (60, 30, 110))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("samurai", 430, 9), 650, 110)
    paste_shadow(c, board("killer", 360, -7), 540, 220)
    paste_shadow(c, board("classic9", 350, 4), 820, 250)
    clay_text(c, "SUDOKU", (56, 110), 132)
    clay_text(c, "NINEFOLD", (56, 245), 98)
    chip(c, "PLAY FREE ONLINE", (60, 390), 32)
    save(c, "og.jpg", 88)
    # card 600x800
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board("killer", 330, -8), 40, 330)
    paste_shadow(c, board("classic9", 340, 7), 230, 380)
    clay_text(c, "SUDOKU", (W // 2, 90), 108, anchor="ma")
    clay_text(c, "NINEFOLD", (W // 2, 205), 82, anchor="ma")
    save(c, "card.webp")
    # poster 1000x1500: the nine boards
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    clay_text(c, "SUDOKU", (W // 2, 70), 170, anchor="ma")
    clay_text(c, "NINEFOLD", (W // 2, 250), 128, anchor="ma")
    order = ["mini4", "classic6", "classic9", "giant16", "giant25", "killer", "xsudoku", "thermo", "samurai"]
    labels = ["MINI 4x4", "CLASSIC 6x6", "CLASSIC 9x9", "GIANT 16x16", "GIANT 25x25", "KILLER", "SUDOKU X", "THERMO", "SAMURAI"]
    cell = 300
    for k, (nm, lb) in enumerate(zip(order, labels)):
        col, row = k % 3, k // 3
        im = board(nm, 250, [-4, 3, -2, 4, -3, 2, -4, 3, -2][k])
        x = 50 + col * cell + (cell - im.width) / 2
        y = 450 + row * 340 + (250 - im.height) / 2
        paste_shadow(c, im, x, y, blur=16, off=14)
        chip(c, lb, (50 + col * cell + cell / 2, 450 + row * 340 + 262), 24, anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
