"""Treatrio key art, made from the real game: captures the 3D title from the home screen and a 3D shop wall from each
of the eight shops (transparent, headless Chrome with software WebGL, muted) into scripts/art/out/treat, then lays them
out on a drawn candy-shop background
into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only puzzle boards, no characters.

usage: PORT=3000 python scripts/art/treat_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "treatrio")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "treat")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
ZONES = ["bakery", "candy", "gelato", "orchard", "tea", "chocolate", "starlight", "carnival"]


CLEAR_JS = """(() => {
  document.querySelectorAll('.trt-home-bg,.trt-sprinkles,.trt-cream,.trt-awning,.trt-lights').forEach(e => e.style.display = 'none');
  const r = document.querySelector('.trt-root'); if (r) { r.style.background = 'transparent'; }
  document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
  for (let e = document.querySelector('.trt-root'); e; e = e.parentElement) { e.style.background = 'transparent'; e.style.backgroundColor = 'transparent'; e.style.backgroundImage = 'none'; }
})()"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        port = os.environ.get('PORT', '3000')
        # the 3D title, from the real home screen, on a transparent background
        pg = b.new_page(viewport={"width": 1100, "height": 760}, device_scale_factor=2)
        pg.goto(f"http://localhost:{port}/play?g=treatrio", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__treat", timeout=180000)
        pg.wait_for_selector(".trt-title3d canvas", timeout=60000)
        pg.wait_for_timeout(6000)
        pg.evaluate(CLEAR_JS)
        # only the title itself: hide everything around it (card shadows would leak in) and its CSS glow
        pg.evaluate("""(() => { const t = document.querySelector('.trt-title3d'); t.style.filter = 'none';
          document.querySelectorAll('.trt-scroll *').forEach(e => { if (!e.contains(t) && !t.contains(e) && e !== t) e.style.visibility = 'hidden'; }); })()""")
        pg.wait_for_timeout(300)
        pg.locator(".trt-title3d").first.screenshot(path=os.path.join(SHOTS, "title.png"), omit_background=True)
        print("shot title", flush=True)
        pg.close()
        # a shelf from each shop, mid-game, cabinets only
        pg = b.new_page(viewport={"width": 520, "height": 900}, device_scale_factor=2)
        pg.goto(f"http://localhost:{port}/play?g=treatrio", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__treat", timeout=180000)
        pg.evaluate("localStorage.setItem('momoblobs-treatrio', JSON.stringify({state:{stage:1,stars:{},totalStars:0,totalScore:0,best:0,current:null,seenHelp:true,tips:['lock','ice','mystery','boss']},version:1}))")
        pg.reload(); pg.wait_for_function("() => !!window.__treat", timeout=180000)
        pg.wait_for_timeout(1500)
        for k, zone in enumerate(ZONES):
            pg.evaluate(f"window.__treat.start({k * 10 + 4})")
            pg.wait_for_timeout(3500)
            sol = pg.evaluate("window.__treat.def().solution") or []
            for m in sol[: min(4, len(sol) // 5)]:
                pg.evaluate(f"window.__treat.move({m['from']}, {m['slot']}, {m['to']})"); pg.wait_for_timeout(500)
            pg.wait_for_timeout(1500)
            pg.evaluate(CLEAR_JS)
            pg.wait_for_timeout(200)
            pg.locator(".trt-stage").first.screenshot(path=os.path.join(SHOTS, f"{zone}.png"), omit_background=True)
            print("shot", zone, flush=True)
        b.close()


def trim(im):
    """crop transparent margins"""
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box) if box else im


def font(size):
    return ImageFont.truetype(FONT, size)


def bg(w, h, awning=True):
    """the candy shop: cotton-candy gradient, white candy stripes, sprinkles, a striped awning and cream clouds"""
    import random
    rnd = random.Random(w * 7 + h)
    im = Image.new("RGB", (w, h), "#ffd3ea")
    d = ImageDraw.Draw(im)
    top, mid, bot = (255, 211, 234), (255, 228, 207), (255, 215, 230)
    for y in range(h):
        k = y / max(1, h - 1)
        c0, c1, kk = (top, mid, k * 2) if k < 0.5 else (mid, bot, (k - 0.5) * 2)
        d.line([(0, y), (w, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * kk) for i in range(3)))
    im = im.convert("RGBA")
    # soft glows: white behind the title, blue and green in the lower corners
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.5, 0.22, 0.42, (255, 255, 255, 150)), (0.08, 0.9, 0.35, (127, 216, 255, 110)), (0.92, 0.85, 0.35, (184, 240, 138, 110))]:
        g.ellipse([w * cx - w * r, h * cy - w * r * 0.6, w * cx + w * r, h * cy + w * r * 0.6], fill=col)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.12)))
    # diagonal candy stripes
    st = Image.new("RGBA", (w, h), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
    step = max(30, w // 28)
    for x0 in range(-h, w + h, step * 2):
        sd.polygon([(x0, 0), (x0 + step, 0), (x0 + step + h, h), (x0 + h, h)], fill=(255, 255, 255, 46))
    im.alpha_composite(st)
    # sprinkles
    cols = [(255, 95, 168), (255, 194, 61), (63, 162, 245), (126, 220, 74), (154, 107, 255), (255, 255, 255)]
    sp = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    unit = max(10, w // 90)
    for i in range(int(w * h / 9000)):
        piece = Image.new("RGBA", (unit * 3, unit * 3), (0, 0, 0, 0))
        ImageDraw.Draw(piece).rounded_rectangle([unit * 1.2, unit * 0.3, unit * 1.8, unit * 2.7], radius=unit * 0.3, fill=cols[i % len(cols)] + (200,))
        piece = piece.rotate(rnd.uniform(0, 180), resample=Image.BICUBIC)
        sp.alpha_composite(piece, (rnd.randint(-unit, w), rnd.randint(-unit, h)))
    im.alpha_composite(sp)
    # cream clouds along the bottom
    cr = Image.new("RGBA", (w, h), (0, 0, 0, 0)); cd = ImageDraw.Draw(cr)
    r = max(34, w // 22)
    for x in range(-r, w + r, int(r * 1.5)):
        cd.ellipse([x - r, h - r * 0.9, x + r, h + r * 1.1], fill=(255, 255, 255, 215))
        cd.ellipse([x + r * 0.75 - r * 0.85, h - r * 0.45, x + r * 0.75 + r * 0.85, h + r * 1.3], fill=(255, 248, 239, 225))
    im.alpha_composite(cr.filter(ImageFilter.GaussianBlur(1)))
    if awning:
        aw = max(46, h // 14)
        a_im = Image.new("RGBA", (w, aw + aw // 2), (0, 0, 0, 0)); ad = ImageDraw.Draw(a_im)
        sw = max(34, w // 20)
        for i, x in enumerate(range(0, w + sw, sw)):
            col = (255, 95, 168, 255) if i % 2 == 0 else (255, 246, 251, 255)
            ad.rectangle([x, 0, x + sw, aw], fill=col)
            ad.ellipse([x, aw - sw // 2, x + sw, aw + sw // 2], fill=col)
        shade = a_im.copy().filter(ImageFilter.GaussianBlur(6)); sh = Image.new("RGBA", a_im.size, (200, 50, 120, 0)); sh.putalpha(shade.getchannel("A").point(lambda v: v * 0.35))
        im.alpha_composite(sh, (0, 6)); im.alpha_composite(a_im, (0, 0))
        hl = Image.new("RGBA", (w, aw // 2), (255, 255, 255, 60)); im.alpha_composite(hl, (0, 0))
    return im.convert("RGB")


def title_img(width):
    """the real 3D title, cropped and scaled to a width"""
    im = trim(Image.open(os.path.join(SHOTS, "title.png")).convert("RGBA"))
    s = width / im.width
    return im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)


def board_t(name, height, angle=0.0):
    """a shelf capture with its transparent margins cropped"""
    im = trim(Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGBA"))
    s = height / im.height
    im = im.resize((max(1, int(im.width * s)), int(height)), Image.LANCZOS)
    if angle: im = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    return im


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
    d.text((x, y + depth), text, font=f, fill=(255, 255, 255), anchor=anchor)
    # gradient fill through a mask
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text((x, y), text, font=f, fill=255, anchor=anchor)
    l, tp, r, bt = mask.getbbox()
    grad = Image.new("RGBA", canvas.size)
    gd = ImageDraw.Draw(grad)
    stops = [(255, 143, 200), (255, 79, 154), (200, 50, 122)]
    for xx in range(l, r):
        k = (xx - l) / max(1, r - l)
        c0, c1, kk = (stops[0], stops[1], k * 2) if k < 0.5 else (stops[1], stops[2], (k - 0.5) * 2)
        gd.line([(xx, tp), (xx, bt)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * kk) for i in range(3)) + (255,))
    canvas.paste(grad, (0, 0), mask)


def build():
    names = {"bakery": "SUNRISE BAKERY", "candy": "CANDY CORNER", "gelato": "GELATO TERRACE", "orchard": "FRUIT ORCHARD",
             "tea": "MOON TEA HOUSE", "chocolate": "COCOA WORKSHOP", "starlight": "STARLIGHT DINER", "carnival": "CARNIVAL NIGHT"}
    # cover 1280x720: the 3D title on the left, two shelves on the right
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("candy", 470, 5), 860, 150, blur=22, off=16, alpha=70)
    paste_shadow(c, board_t("orchard", 420, -5), 690, 250, blur=22, off=16, alpha=70)
    t = title_img(700); paste_shadow(c, t, 24, 170 - t.height // 2 + 90, blur=14, off=10, alpha=55)
    chip(c, "ENDLESS 3D SORT", (70, 430), 34, (255, 79, 154), (255, 255, 255))
    chip(c, "POP THE TRIOS", (70, 498), 34, (255, 194, 61), (58, 29, 0))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("candy", 420, 5), 820, 130, blur=20, off=14, alpha=70)
    paste_shadow(c, board_t("orchard", 380, -5), 650, 220, blur=20, off=14, alpha=70)
    t = title_img(660); paste_shadow(c, t, 20, 70, blur=14, off=10, alpha=55)
    chip(c, "PLAY FREE ONLINE", (66, 70 + t.height + 6), 32, (255, 79, 154), (255, 255, 255))
    save(c, "og.jpg", 88)
    # card 600x800: the title across the top, shelves below
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    t = title_img(560); paste_shadow(c, t, (W - t.width) // 2, 64, blur=12, off=8, alpha=55)
    chip(c, "ENDLESS 3D SORT", (W // 2, 64 + t.height + 2), 26, (255, 79, 154), (255, 255, 255), anchor="m")
    paste_shadow(c, board_t("tea", 360, -5), 34, 380, blur=18, off=12, alpha=70)
    paste_shadow(c, board_t("candy", 380, 5), 270, 400, blur=18, off=12, alpha=70)
    save(c, "card.webp")
    # poster 1000x1500: the title, then a shelf from each shop
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    t = title_img(900); paste_shadow(c, t, (W - t.width) // 2, 70, blur=16, off=12, alpha=55)
    chip(c, "ENDLESS STAGES · 8 SHOPS", (W // 2, 70 + t.height + 4), 30, (255, 79, 154), (255, 255, 255), anchor="m")
    cellw, top = 235, 70 + t.height + 90
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 4, k // 4
        im = board_t(nm, 420, [-3, 2, -2, 3, 2, -3, 3, -2][k])
        if im.width > cellw - 10: im = im.resize((cellw - 10, int(im.height * (cellw - 10) / im.width)), Image.LANCZOS)
        x = 30 + col * cellw + (cellw - im.width) / 2
        rowH = (H - top - 70) / 2
        y = top + row * rowH + (rowH - 60 - im.height) / 2
        paste_shadow(c, im, x, y, blur=14, off=10, alpha=60)
        chip(c, lb, (30 + col * cellw + cellw / 2, y + im.height + 16), 18, (90, 42, 58), (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
