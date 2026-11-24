"""Marble Merge 2048 key art, made from the real game: captures the title from the home screen and a jar from each
of the eight rooms (headless Chrome, muted) into scripts/art/out/marble, then lays them out on a drawn warm toy-shop
background into the card (600x800), cover (1280x720), poster (1000x1500) and og.jpg (1200x630). Only game boards.

usage: PORT=3000 python scripts/art/marble_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "marble-merge-2048")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "marble")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
ZONES = ["toy", "candy", "sea", "arcade", "cave", "forge", "globe", "garden"]


CLEAR_JS = """(() => {
  document.querySelectorAll('.mbl-stars').forEach(e => e.style.display = 'none');
  const r = document.querySelector('.mbl-root'); if (r) { r.style.background = 'transparent'; }
  document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent';
  for (let e = document.querySelector('.mbl-root'); e; e = e.parentElement) { e.style.background = 'transparent'; e.style.backgroundColor = 'transparent'; e.style.backgroundImage = 'none'; }
})()"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        port = os.environ.get('PORT', '3000')
        # the 3D title, from the real home screen, on a transparent background
        pg = b.new_page(viewport={"width": 1100, "height": 760}, device_scale_factor=2)
        pg.goto(f"http://localhost:{port}/play?g=marble-merge-2048", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__marble", timeout=180000)
        pg.wait_for_selector(".mbl-title", timeout=60000)
        pg.wait_for_timeout(6000)
        pg.evaluate(CLEAR_JS)
        # only the title itself: hide everything around it (card shadows would leak in) and its CSS glow
        pg.evaluate("""(() => { const t = document.querySelector('.mbl-title'); t.style.filter = 'none';
          document.querySelectorAll('.mbl-scroll *').forEach(e => { if (!e.contains(t) && !t.contains(e) && e !== t) e.style.visibility = 'hidden'; }); })()""")
        pg.wait_for_timeout(300)
        pg.locator(".mbl-title").first.screenshot(path=os.path.join(SHOTS, "title.png"), omit_background=True)
        print("shot title", flush=True)
        pg.close()
        # a board from each galaxy, the play area only (no HUD)
        pg = b.new_page(viewport={"width": 460, "height": 860}, device_scale_factor=1.5)
        pg.set_default_timeout(120000)
        pg.goto(f"http://localhost:{port}/play?g=marble-merge-2048", wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("() => !!window.__marble", timeout=180000)
        pg.evaluate("localStorage.setItem('momoblobs-marblemerge', JSON.stringify({state:{stage:1,stars:{},totalStars:0,totalScore:0,best:0,current:null,seenHelp:true,tips:['rocks','score','ice','boss','remix','jar'],boosters:{hammer:3,swap:5,undo:3}},version:1}))")
        pg.reload(); pg.wait_for_function("() => !!window.__marble", timeout=180000)
        pg.wait_for_timeout(1500)
        for k, zone in enumerate(ZONES):
            st = k * 25 + 14
            pg.evaluate(f"window.__marble.start({st})")
            pg.wait_for_function(f"() => window.__marble.def()?.stage === {st}", timeout=120000)
            pg.wait_for_timeout(2500)
            # a few drops in, played by the test player
            for _ in range(9):
                c = pg.evaluate("window.__marble.best()")
                if c is None or c != c: break
                pg.evaluate(f"window.__marble.drop({c})"); pg.wait_for_timeout(400)
                try: pg.wait_for_function("() => !window.__marble.busy()", timeout=8000)
                except Exception: pass
            pg.wait_for_timeout(800)
            pg.wait_for_timeout(300)
            pg.locator(".mbl-stage").first.screenshot(path=os.path.join(SHOTS, f"{zone}.png"))
            print("shot", zone, flush=True)
        b.close()


def trim(im):
    """crop transparent margins"""
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box) if box else im


def font(size):
    return ImageFont.truetype(FONT, size)


MCOL = [(255, 201, 60), (255, 138, 42), (255, 77, 94), (255, 79, 174), (180, 92, 255), (77, 123, 255), (47, 198, 255), (47, 217, 138)]


def marble_ball(r, col, label=None):
    """a glossy numbered marble (for the background)"""
    S = int(r * 2 + 8)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx = cy = S / 2
    for k in range(int(r), 0, -1):
        f = k / r
        c = tuple(int(col[i] * (0.55 + 0.45 * (1 - f) ** 0.6) + (255 - col[i]) * max(0, 0.35 - f) ) for i in range(3))
        d.ellipse([cx - k - r * 0.12 * (1 - f), cy - k - r * 0.15 * (1 - f), cx + k - r * 0.12 * (1 - f), cy + k - r * 0.15 * (1 - f)], fill=c + (255,))
    if label:
        d.ellipse([cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55], fill=(255, 255, 255, 245))
        d.text((cx, cy + r * 0.04), label, font=font(int(r * (0.7 if len(label) < 3 else 0.5))), fill=tuple(int(v * 0.55) for v in col), anchor="mm")
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0)); ImageDraw.Draw(hl).ellipse([cx - r * 0.75, cy - r * 0.8, cx - r * 0.05, cy - r * 0.35], fill=(255, 255, 255, 150))
    im.alpha_composite(hl.filter(ImageFilter.GaussianBlur(r * 0.08)))
    return im


def bg(w, h, awning=True):
    """a warm, dim toy shop: maroon-to-ember wall, soft lamp bokeh, shelves and a few big blurred marbles"""
    import random
    rnd = random.Random(w * 7 + h)
    im = Image.new("RGB", (w, h), "#1e0b0b")
    d = ImageDraw.Draw(im)
    for y in range(h):
        k = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=(int(30 + 60 * k), int(11 + 20 * k), int(11 + 14 * k)))
    im = im.convert("RGBA")
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    for i in range(18):
        x, y, r = rnd.random() * w, rnd.random() * h, max(w, h) * (0.03 + rnd.random() * 0.07)
        gd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 180, 80, rnd.randint(30, 70)))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(max(w, h) * 0.02)))
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    for row in range(3):
        y = h * (0.28 + row * 0.3)
        sd.rectangle([0, y, w, y + max(6, h * 0.012)], fill=(122, 58, 30, 150))
        x = rnd.random() * 40
        while x < w:
            bw, bh = 20 + rnd.random() * 50, 30 + rnd.random() * 70
            sd.rounded_rectangle([x, y - bh, x + bw, y], radius=8, fill=(255, 179, 71, rnd.randint(18, 40)))
            x += bw + 20 + rnd.random() * 50
    im.alpha_composite(sh)
    blur = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for i in range(7):
        r = int(min(w, h) * (0.05 + rnd.random() * 0.06))
        m = marble_ball(r, MCOL[i % len(MCOL)], str(2 ** (1 + rnd.randint(0, 7))))
        blur.alpha_composite(m, (int(rnd.random() * (w - r * 2)), int(rnd.random() * (h - r * 2))))
    blur = blur.filter(ImageFilter.GaussianBlur(min(w, h) * 0.006))
    a = blur.getchannel("A").point(lambda v: int(v * 0.55)); blur.putalpha(a)
    im.alpha_composite(blur)
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


def board_t(name, height, angle=0.0, frac=0.46):
    """the top of a board capture (the tiles), framed as a rounded card with a white rim"""
    im = Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGBA")
    # the blocks sit at the bottom: keep the lower part of the board
    im = im.crop((0, int(im.height * (1 - frac)), im.width, im.height))
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
    names = {"toy": "TOY SHOP", "candy": "CANDY BAR", "sea": "SEASIDE PIER", "arcade": "NEON ARCADE",
             "cave": "CRYSTAL CAVE", "forge": "LAVA FORGE", "globe": "SNOW GLOBE", "garden": "MIDNIGHT GARDEN"}
    GREEN, BLUE, DARK = (255, 77, 94), (62, 168, 255), (60, 20, 20)
    # cover 1280x720: the 3D title on the left, two boards on the right
    W, H = 1280, 720
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("candy", 400, 6), 930, 70, blur=22, off=16, alpha=80)
    paste_shadow(c, board_t("arcade", 420, -4), 740, 220, blur=22, off=16, alpha=80)
    t = title_img(680); paste_shadow(c, t, 24, 170 - t.height // 2 + 90, blur=14, off=10, alpha=55)
    chip(c, "DROP & MERGE BALLS", (70, 440), 34, GREEN, (255, 255, 255))
    chip(c, "500+ LEVELS", (70, 508), 34, (255, 204, 31), (40, 30, 0))
    save(c, "cover.webp")
    # og 1200x630
    W, H = 1200, 630
    c = bg(W, H).convert("RGBA")
    paste_shadow(c, board_t("candy", 360, 6), 860, 60, blur=20, off=14, alpha=80)
    paste_shadow(c, board_t("arcade", 400, -4), 620, 180, blur=20, off=14, alpha=80)
    t = title_img(640); paste_shadow(c, t, 20, 90, blur=14, off=10, alpha=55)
    chip(c, "PLAY FREE ONLINE", (66, 90 + t.height + 6), 32, GREEN, (255, 255, 255))
    save(c, "og.jpg", 88)
    # card 600x800: the title across the top, boards below
    W, H = 600, 800
    c = bg(W, H).convert("RGBA")
    t = title_img(570); paste_shadow(c, t, (W - t.width) // 2, 40, blur=12, off=8, alpha=55)
    chip(c, "DROP & MERGE BALLS", (W // 2, 40 + t.height + 2), 26, GREEN, (255, 255, 255), anchor="m")
    paste_shadow(c, board_t("toy", 280, -6), 8, 400, blur=18, off=12, alpha=80)
    paste_shadow(c, board_t("arcade", 300, 6), 268, 470, blur=18, off=12, alpha=80)
    save(c, "card.webp")
    # poster 1000x1500: the title, then a board from each galaxy
    W, H = 1000, 1500
    c = bg(W, H).convert("RGBA")
    t = title_img(900); paste_shadow(c, t, (W - t.width) // 2, 60, blur=16, off=12, alpha=55)
    chip(c, "500+ LEVELS · 8 ROOMS", (W // 2, 60 + t.height + 4), 30, GREEN, (255, 255, 255), anchor="m")
    cellw, top = 235, 60 + t.height + 80
    for k, (nm, lb) in enumerate(names.items()):
        col, row = k % 4, k // 4
        im = board_t(nm, 520, [-3, 2, -2, 3, 2, -3, 3, -2][k], 0.8)
        if im.width > cellw - 10: im = im.resize((cellw - 10, int(im.height * (cellw - 10) / im.width)), Image.LANCZOS)
        x = 30 + col * cellw + (cellw - im.width) / 2
        rowH = (H - top - 60) / 2
        y = top + row * rowH + (rowH - 60 - im.height) / 2
        paste_shadow(c, im, x, y, blur=14, off=10, alpha=60)
        chip(c, lb, (30 + col * cellw + cellw / 2, y + im.height + 14), 17, (60, 20, 20), (255, 255, 255), anchor="m")
    save(c, "poster.webp", 88)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
