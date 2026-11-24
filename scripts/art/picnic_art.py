"""Picnic Pairs key art, made from the real game: captures the tile title from the home screen and a board from each
of the eight picnic spots (headless Chrome, muted) into scripts/art/out/picnic, then lays them out on a drawn sunny
background into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only game boards.

usage: PORT=3000 python scripts/art/picnic_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "picnic-pairs")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "picnic")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
ZONES = ["meadow", "beach", "forest", "lake", "orchard", "garden", "camp", "lantern"]


CLEAR_JS = """(() => {
  document.querySelectorAll('.pic-clouds').forEach(e => e.style.display = 'none');
  const r = document.querySelector('.pic-root'); if (r) { r.style.background = 'transparent'; }
  document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
  for (let e = document.querySelector('.pic-root'); e; e = e.parentElement) { e.style.background = 'transparent'; e.style.backgroundColor = 'transparent'; e.style.backgroundImage = 'none'; }
})()"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        port = os.environ.get('PORT', '3000')
        # the 3D title, from the real home screen, on a transparent background
        pg = b.new_page(viewport={"width": 1100, "height": 760}, device_scale_factor=2)
        pg.goto(f"http://localhost:{port}/play?g=picnic-pairs", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__picnic", timeout=180000)
        pg.wait_for_selector(".pic-title", timeout=60000)
        pg.add_style_tag(content='.pic-tbub-e{display:none!important}')
        pg.wait_for_timeout(6000)
        pg.evaluate(CLEAR_JS)
        # only the title itself: hide everything around it (card shadows would leak in) and its CSS glow
        pg.evaluate("""(() => { const t = document.querySelector('.pic-title'); t.style.filter = 'none';
          document.querySelectorAll('.pic-scroll *').forEach(e => { if (!e.contains(t) && !t.contains(e) && e !== t) e.style.visibility = 'hidden'; }); })()""")
        pg.wait_for_timeout(300)
        pg.locator(".pic-title").first.screenshot(path=os.path.join(SHOTS, "title.png"), omit_background=True)
        print("shot title", flush=True)
        pg.close()
        # a board from each picnic spot, the play area only (no HUD)
        pg = b.new_page(viewport={"width": 460, "height": 860}, device_scale_factor=1.5)
        pg.set_default_timeout(120000)
        pg.goto(f"http://localhost:{port}/play?g=picnic-pairs", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__picnic", timeout=180000)
        pg.evaluate("localStorage.setItem('momoblobs-picnicpairs', JSON.stringify({state:{stage:1,stars:{},totalStars:0,totalScore:0,best:0,current:null,seenHelp:true,tips:['slide','shape','stone','boss','remix'],boosters:{hint:3,shuffle:2,time:1}},version:1}))")
        pg.reload(); pg.wait_for_function("() => !!window.__picnic", timeout=180000)
        pg.wait_for_timeout(1500)
        for k, zone in enumerate(ZONES):
            st = k * 25 + 25
            pg.evaluate(f"window.__picnic.start({st})")
            pg.wait_for_function(f"() => window.__picnic.def()?.stage === {st}", timeout=120000)
            pg.wait_for_timeout(2500)
            # take a few pairs so the board looks mid-game
            for _ in range(1):
                h = pg.evaluate("window.__picnic.hint()")
                if not h: break
                pg.evaluate(f"window.__picnic.tap({h[0]})"); pg.wait_for_timeout(80); pg.evaluate(f"window.__picnic.tap({h[1]})"); pg.wait_for_timeout(900)
            pg.wait_for_timeout(300)
            pg.locator(".pic-stage").first.screenshot(path=os.path.join(SHOTS, f"{zone}.png"))
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
    im = vivid(trim(Image.open(os.path.join(SHOTS, "title.png")).convert("RGBA")), 1.2, 1.05)
    s = width / im.width
    return im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)


def board_t(name, height, angle=0.0, frac=0.62):
    """the top of a board capture (the tiles), framed as a rounded card with a white rim"""
    im = Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGBA")
    im = im.crop((0, int(im.height * 0.02), im.width, int(im.height * frac)))
    r = int(im.width * 0.06)
    mask = Image.new("L", im.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=255)
    im.putalpha(mask)
    ImageDraw.Draw(im).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, outline=(255, 255, 255, 255), width=max(5, im.width // 70))
    s_ = height / im.height
    im = im.resize((max(1, int(im.width * s_)), int(height)), Image.LANCZOS)
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
    names = {"meadow": "MEADOW PICNIC", "beach": "BEACH BASKET", "forest": "FOREST FEAST", "lake": "LAKESIDE LUNCH",
             "orchard": "ORCHARD SNACKS", "garden": "GARDEN TEA PARTY", "camp": "MOUNTAIN CAMP", "lantern": "LANTERN NIGHT"}
    GREEN, BLUE, DARK = (224, 96, 42), (62, 168, 255), (74, 42, 26)
    # cover 1280x720: the 3D title on the left, two boards on the right
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("orchard", 400, 6), 930, 70, blur=22, off=16, alpha=80)
    paste_shadow(c, board_t("meadow", 420, -4), 740, 220, blur=22, off=16, alpha=80)
    t = title_img(680); paste_shadow(c, t, 24, 170 - t.height // 2 + 90, blur=14, off=10, alpha=55)
    chip(c, "CONNECT PAIRS", (70, 440), 34, GREEN, (255, 255, 255))
    chip(c, "500+ LEVELS", (70, 508), 34, (255, 204, 31), (40, 30, 0))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("orchard", 360, 6), 860, 60, blur=20, off=14, alpha=80)
    paste_shadow(c, board_t("meadow", 400, -4), 620, 180, blur=20, off=14, alpha=80)
    t = title_img(640); paste_shadow(c, t, 20, 90, blur=14, off=10, alpha=55)
    chip(c, "PLAY FREE ONLINE", (66, 90 + t.height + 6), 32, GREEN, (255, 255, 255))
    save(c, "og.jpg", 88)
    # card 600x800: the title across the top, boards below
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    t = title_img(570); paste_shadow(c, t, (W - t.width) // 2, 40, blur=12, off=8, alpha=55)
    chip(c, "CONNECT PAIRS", (W // 2, 40 + t.height + 2), 26, GREEN, (255, 255, 255), anchor="m")
    paste_shadow(c, board_t("garden", 280, -6), 8, 400, blur=18, off=12, alpha=80)
    paste_shadow(c, board_t("meadow", 300, 6), 268, 470, blur=18, off=12, alpha=80)
    save(c, "card.webp")
    # poster 1000x1500: the title, then a board from each picnic spot
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    t = title_img(900); paste_shadow(c, t, (W - t.width) // 2, 60, blur=16, off=12, alpha=55)
    chip(c, "500+ LEVELS · 8 PICNICS", (W // 2, 60 + t.height + 4), 30, GREEN, (255, 255, 255), anchor="m")
    cellw, top = 235, 60 + t.height + 80
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 4, k // 4
        im = board_t(nm, 380, [-3, 2, -2, 3, 2, -3, 3, -2][k])
        if im.width > cellw - 10: im = im.resize((cellw - 10, int(im.height * (cellw - 10) / im.width)), Image.LANCZOS)
        x = 30 + col * cellw + (cellw - im.width) / 2
        rowH = (H - top - 60) / 2
        y = top + row * rowH + (rowH - 60 - im.height) / 2
        paste_shadow(c, im, x, y, blur=14, off=10, alpha=60)
        chip(c, lb, (30 + col * cellw + cellw / 2, y + im.height + 14), 17, (74, 42, 26), (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
