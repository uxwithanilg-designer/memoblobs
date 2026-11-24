"""Sproutpop key art, made from the real game: captures the 3D title from the home screen and a 3D greenhouse board
from each of the eight gardens (transparent, headless Chrome with software WebGL, muted) into scripts/art/out/sprout,
then lays them out on a drawn garden background (sky, sun, rolling hills, soap bubbles, petals)
into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only game boards, no characters.

usage: PORT=3000 python scripts/art/sprout_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "sproutpop")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "sprout")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
ZONES = ["meadow", "sunflower", "lotus", "mushroom", "cherry", "cactus", "lavender", "moonflower"]


CLEAR_JS = """(() => {
  document.querySelectorAll('.spp-sun,.spp-hills,.spp-petals,.spp-soap').forEach(e => e.style.display = 'none');
  const r = document.querySelector('.spp-root'); if (r) { r.style.background = 'transparent'; }
  document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
  for (let e = document.querySelector('.spp-root'); e; e = e.parentElement) { e.style.background = 'transparent'; e.style.backgroundColor = 'transparent'; e.style.backgroundImage = 'none'; }
})()"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        port = os.environ.get('PORT', '3000')
        # the 3D title, from the real home screen, on a transparent background
        pg = b.new_page(viewport={"width": 1100, "height": 760}, device_scale_factor=2)
        pg.goto(f"http://localhost:{port}/play?g=sproutpop", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__sprout", timeout=180000)
        pg.wait_for_selector(".spp-title3d canvas", timeout=60000)
        pg.wait_for_timeout(6000)
        pg.evaluate(CLEAR_JS)
        # only the title itself: hide everything around it (card shadows would leak in) and its CSS glow
        pg.evaluate("""(() => { const t = document.querySelector('.spp-title3d'); t.style.filter = 'none';
          document.querySelectorAll('.spp-scroll *').forEach(e => { if (!e.contains(t) && !t.contains(e) && e !== t) e.style.visibility = 'hidden'; }); })()""")
        pg.wait_for_timeout(300)
        pg.locator(".spp-title3d").first.screenshot(path=os.path.join(SHOTS, "title.png"), omit_background=True)
        print("shot title", flush=True)
        pg.close()
        # a board from each garden, a couple of shots in, the greenhouse only (no HUD)
        pg = b.new_page(viewport={"width": 460, "height": 860}, device_scale_factor=1.5)
        pg.set_default_timeout(120000)
        pg.goto(f"http://localhost:{port}/play?g=sproutpop", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__sprout", timeout=180000)
        pg.evaluate("localStorage.setItem('momoblobs-sproutpop', JSON.stringify({state:{stage:1,stars:{},totalStars:0,totalScore:0,best:0,current:null,seenHelp:true,tips:['stone','ice','bomb','boss','remix'],boosters:{swap:0,rainbow:2,bomb:2}},version:1}))")
        pg.reload(); pg.wait_for_function("() => !!window.__sprout", timeout=180000)
        pg.wait_for_timeout(1500)
        for k, zone in enumerate(ZONES):
            st = k * 25 + [9, 14, 12, 18, 11, 16, 13, 20][k]
            pg.evaluate(f"window.__sprout.start({st})")
            pg.wait_for_function(f"() => window.__sprout.def()?.stage === {st}", timeout=120000)
            pg.wait_for_timeout(2500)
            for _ in range(2):
                pg.evaluate("(async () => { const b = window.__sprout.best(); if (b.swap) window.__sprout.swap(); await new Promise(r => setTimeout(r, 300)); await window.__sprout.shoot(b.angle); })()")
                pg.wait_for_timeout(400)
                pg.wait_for_function("() => !window.__sprout.busy()", timeout=30000)
            # aim guide on, for the art
            L = pg.evaluate("window.__sprout.launcher()")
            pg.mouse.move(L["x"] + [-90, 80, -60, 110, -120, 70, -80, 100][k], L["y"] - 300)
            pg.wait_for_timeout(1200)
            pg.evaluate(CLEAR_JS)
            pg.wait_for_timeout(300)
            pg.locator(".spp-stage").first.screenshot(path=os.path.join(SHOTS, f"{zone}.png"), omit_background=True)
            print("shot", zone, flush=True)
        b.close()


def trim(im):
    """crop transparent margins"""
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box) if box else im


def font(size):
    return ImageFont.truetype(FONT, size)


def bg(w, h, awning=True):
    """the garden: a sunny sky, a sun glow, rolling green hills, floating soap bubbles, drifting petals and leaves"""
    import random
    rnd = random.Random(w * 7 + h)
    im = Image.new("RGB", (w, h), "#bfeaff")
    d = ImageDraw.Draw(im)
    top, mid, bot = (176, 226, 255), (226, 248, 214), (196, 238, 160)
    for y in range(h):
        k = y / max(1, h - 1)
        c0, c1, kk = (top, mid, k * 2) if k < 0.5 else (mid, bot, (k - 0.5) * 2)
        d.line([(0, y), (w, y)], fill=tuple(int(c0[i] + (c1[i] - c0[i]) * kk) for i in range(3)))
    im = im.convert("RGBA")
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    for cx, cy, r, col in [(0.82, 0.12, 0.22, (255, 236, 140, 210)), (0.5, 0.25, 0.42, (255, 255, 255, 140)), (0.1, 0.8, 0.3, (255, 179, 209, 90))]:
        g.ellipse([w * cx - w * r, h * cy - w * r * 0.7, w * cx + w * r, h * cy + w * r * 0.7], fill=col)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(min(w, h) * 0.1)))
    # sun rays
    ry = Image.new("RGBA", (w, h), (0, 0, 0, 0)); rd = ImageDraw.Draw(ry)
    sx, sy = w * 0.82, h * 0.12
    for i in range(14):
        a0 = i * math.pi / 7
        rd.polygon([(sx, sy), (sx + math.cos(a0) * w * 1.4, sy + math.sin(a0) * w * 1.4), (sx + math.cos(a0 + 0.12) * w * 1.4, sy + math.sin(a0 + 0.12) * w * 1.4)], fill=(255, 255, 255, 34))
    im.alpha_composite(ry.filter(ImageFilter.GaussianBlur(4)))
    # rolling hills
    hl = Image.new("RGBA", (w, h), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
    for cx, cy, rx, ry_, col in [(0.2, 1.08, 0.7, 0.3, (124, 196, 74, 255)), (0.85, 1.1, 0.6, 0.28, (96, 172, 60, 255)), (0.5, 1.16, 0.8, 0.26, (150, 214, 100, 255))]:
        hd.ellipse([w * (cx - rx), h - h * (cy - 1) - h * ry_ * 1.0 - h * 0.0, w * (cx + rx), h + h * ry_], fill=col)
    im.alpha_composite(hl.filter(ImageFilter.GaussianBlur(2)))
    # soap bubbles
    sb = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for i in range(int(w * h / 26000) + 6):
        r = rnd.randint(int(w * 0.012) + 6, int(w * 0.045) + 10)
        x, y = rnd.randint(0, w), rnd.randint(0, h)
        bb = Image.new("RGBA", (r * 2 + 4, r * 2 + 4), (0, 0, 0, 0)); bd = ImageDraw.Draw(bb)
        tint = [(255, 140, 210), (130, 220, 255), (190, 255, 150), (255, 230, 130)][i % 4]
        bd.ellipse([2, 2, r * 2 + 2, r * 2 + 2], fill=tint + (40,), outline=(255, 255, 255, 190), width=max(2, r // 9))
        bd.ellipse([r * 0.55, r * 0.45, r * 0.95, r * 0.8], fill=(255, 255, 255, 210))
        sb.alpha_composite(bb, (x - r, y - r))
    im.alpha_composite(sb)
    # petals and leaves
    pt = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    unit = max(10, w // 80)
    for i in range(int(w * h / 14000)):
        piece = Image.new("RGBA", (unit * 3, unit * 3), (0, 0, 0, 0))
        col = [(255, 179, 209), (255, 255, 255), (184, 240, 138), (255, 224, 102)][i % 4]
        ImageDraw.Draw(piece).ellipse([unit * 0.6, unit * 1.1, unit * 2.4, unit * 1.9], fill=col + (210,))
        piece = piece.rotate(rnd.uniform(0, 180), resample=Image.BICUBIC)
        pt.alpha_composite(piece, (rnd.randint(-unit, w), rnd.randint(-unit, h)))
    im.alpha_composite(pt)
    return im.convert("RGB")


def vivid(im, sat=1.45, con=1.12):
    """transparent WebGL captures come out washed out: restore colour and contrast, keep the alpha"""
    a = im.getchannel("A")
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(im.convert("RGB")).enhance(sat)).enhance(con)
    out = rgb.convert("RGBA"); out.putalpha(a)
    return out


def title_img(width):
    """the real 3D title, cropped and scaled to a width"""
    im = vivid(trim(Image.open(os.path.join(SHOTS, "title.png")).convert("RGBA")), 1.35, 1.08)
    s = width / im.width
    return im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)


def board_t(name, height, angle=0.0, frac=0.56):
    """the top of a greenhouse capture (the bubbles), framed as a rounded glass card"""
    im = vivid(trim(Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGBA")))
    im = im.crop((0, 0, im.width, int(im.height * frac)))
    card = Image.new("RGBA", im.size, (255, 255, 255, 0))
    r = int(im.width * 0.07)
    panel = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(panel).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=(236, 255, 236, 215), outline=(255, 255, 255, 255), width=max(4, im.width // 90))
    card.alpha_composite(panel); card.alpha_composite(im)
    mask = Image.new("L", im.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=255)
    card.putalpha(Image.composite(card.getchannel("A"), Image.new("L", im.size, 0), mask))
    s = height / card.height
    card = card.resize((max(1, int(card.width * s)), int(height)), Image.LANCZOS)
    if angle: card = card.rotate(angle, resample=Image.BICUBIC, expand=True)
    return card


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
    names = {"meadow": "SPRING MEADOW", "sunflower": "SUNFLOWER FIELDS", "lotus": "LOTUS POND", "mushroom": "MUSHROOM FOREST",
             "cherry": "CHERRY HILL", "cactus": "CACTUS DUNES", "lavender": "LAVENDER VALLEY", "moonflower": "MOONFLOWER NIGHT"}
    GREEN, BLUE, DARK = (34, 176, 79), (62, 168, 255), (31, 74, 42)
    # cover 1280x720: the 3D title on the left, two boards on the right
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("cherry", 400, 6), 930, 70, blur=22, off=16, alpha=80)
    paste_shadow(c, board_t("meadow", 420, -4), 740, 220, blur=22, off=16, alpha=80)
    t = title_img(680); paste_shadow(c, t, 24, 170 - t.height // 2 + 90, blur=14, off=10, alpha=55)
    chip(c, "3D BUBBLE SHOOTER", (70, 440), 34, GREEN, (255, 255, 255))
    chip(c, "500+ STAGES", (70, 508), 34, (255, 197, 49), (58, 29, 0))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("cherry", 360, 6), 860, 60, blur=20, off=14, alpha=80)
    paste_shadow(c, board_t("meadow", 400, -4), 620, 180, blur=20, off=14, alpha=80)
    t = title_img(640); paste_shadow(c, t, 20, 90, blur=14, off=10, alpha=55)
    chip(c, "PLAY FREE ONLINE", (66, 90 + t.height + 6), 32, GREEN, (255, 255, 255))
    save(c, "og.jpg", 88)
    # card 600x800: the title across the top, boards below
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    t = title_img(570); paste_shadow(c, t, (W - t.width) // 2, 40, blur=12, off=8, alpha=55)
    chip(c, "3D BUBBLE SHOOTER", (W // 2, 40 + t.height + 2), 26, GREEN, (255, 255, 255), anchor="m")
    paste_shadow(c, board_t("lotus", 290, -6), 8, 350, blur=18, off=12, alpha=80)
    paste_shadow(c, board_t("meadow", 310, 6), 268, 420, blur=18, off=12, alpha=80)
    save(c, "card.webp")
    # poster 1000x1500: the title, then a board from each garden
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    t = title_img(900); paste_shadow(c, t, (W - t.width) // 2, 60, blur=16, off=12, alpha=55)
    chip(c, "500+ STAGES · 8 GARDENS", (W // 2, 60 + t.height + 4), 30, GREEN, (255, 255, 255), anchor="m")
    cellw, top = 235, 60 + t.height + 80
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 4, k // 4
        im = board_t(nm, 380, [-3, 2, -2, 3, 2, -3, 3, -2][k])
        if im.width > cellw - 10: im = im.resize((cellw - 10, int(im.height * (cellw - 10) / im.width)), Image.LANCZOS)
        x = 30 + col * cellw + (cellw - im.width) / 2
        rowH = (H - top - 60) / 2
        y = top + row * rowH + (rowH - 60 - im.height) / 2
        paste_shadow(c, im, x, y, blur=14, off=10, alpha=60)
        chip(c, lb, (30 + col * cellw + cellw / 2, y + im.height + 14), 17, DARK, (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
