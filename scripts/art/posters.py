"""One poster per game (1200x1800), each in its own art style.

python scripts/art/posters.py [slug ...]
  -> scripts/art/out/posters/<slug>.png and public/games/<slug>/poster.webp (1000x1500)
"""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K  # noqa: E402
from assets import cast, frame, logo, meta, no_floor, src, title  # noqa: E402

W, H = 1200, 1800
POSTERS = {}


def poster(slug):
    def deco(fn):
        POSTERS[slug] = fn; return fn
    return deco


# ------------------------------------------------------------------ shared bits
def put_title(c, slug, cx, cy, w, anchor="mm", rot=0, shadow=True, glow=None):
    t = K.fit(title(slug), w=w)
    return K.put(c, t, cx, cy, anchor, shadow=dict(r=22, k=0.55, dy=18) if shadow else None, rot=rot, glow_c=glow)


def brand(c, y=None, color="#ffffff", alpha=230, dark=False):
    """the small MOMOBLOBS lockup + site line at the foot of the poster (dark text on light grounds)"""
    y = y or H - 64
    light = K.rgb(color)[0] + K.rgb(color)[1] + K.rgb(color)[2] > 380
    lg = K.fit(logo(light), h=60)
    t = K.text_img("PLAY FREE  ·  MOMOBLOBS.COM", "Michroma-Regular.ttf", 20, color, track=4, alpha=alpha)
    gap = 26; tw = lg.width + gap + t.width
    x = (W - tw) // 2
    if dark: K.put(c, K.glow(K.with_pad(lg, 20), 10, "#000000", 0.6), x - 20, y - lg.height // 2 - 20, "lt")
    K.put(c, lg, x, y, "lm"); K.put(c, t, x + lg.width + gap, y + 2, "lm")


def tagline(c, slug, y, color="#ffffff", size=44, fontname="Fredoka-Bold.ttf", track=1, stroke=0, stroke_fill="#000000", text=None):
    t = K.text_img(text or meta(slug)["short"], fontname, size, color, track=track, stroke=stroke, stroke_fill=stroke_fill)
    if t.width > W - 120: t = K.fit(t, w=W - 120)
    K.put(c, t, W // 2, y, "mm")
    return t


def char(name, expr="happy", h=None, w=None, floor=True):
    im = cast(name, expr)
    if not floor: im = no_floor(im)
    return K.fit(im, w=w, h=h)


def out_paths(slug):
    return os.path.join(K.OUT, "posters", f"{slug}.png"), os.path.join(K.WEB, "public", "games", slug, "poster.webp")


# ------------------------------------------------------------------ FOCUS
@poster("fish-watch")
def fish_watch(m):
    """paper-cut ocean: layered wavy paper, a porthole into the tank, Pip on the ice"""
    c = K.lin(W, H, [(0, "#bfefff"), (0.35, "#5cc6f2"), (1, "#0b3a78")])
    K.add(c, K.rad(W, H, [(0, (255, 255, 255, 120)), (0.6, (255, 255, 255, 0))], 0.5, 0.0, 0.8))
    cols = ["#7fd6f7", "#4fb4ea", "#2a8ad4", "#1a64b0", "#0f4890", "#0a3170"]
    def wave(i, col):
        layer = K.shape(W, H, K.wave_poly(W, 760 + i * 170, 34 - i * 3, 1.3 + i * 0.25, i * 1.7), col)
        c.alpha_composite(K.drop(layer, (0, 0), 18, "#04203f", 0.5)); c.alpha_composite(layer)
    for i, col in enumerate(cols[:4]): wave(i, col)
    # porthole into the tank
    tank = K.cover(frame("fish-watch"), 760, 760, 0.29, 0.62, 1.95)
    tank = K.mask_circle(K.grade(tank, 1.15, 1.08))
    ring = Image.new("RGBA", (860, 860), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
    d.ellipse((0, 0, 859, 859), fill=K.rgba("#f4c64a")); d.ellipse((22, 22, 837, 837), fill=K.rgba("#c8902a"))
    for k in range(12):
        a = k * math.pi / 6; x, y = 430 + 404 * math.cos(a), 430 + 404 * math.sin(a)
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=K.rgba("#fff0b0"))
    ring.alpha_composite(tank, (50, 50))
    ring.alpha_composite(K.opacity(K.rad(760, 760, [(0, (255, 255, 255, 0)), (0.7, (255, 255, 255, 0)), (1, (255, 255, 255, 120))], 0.35, 0.3, 0.9), 0.9), (50, 50))
    K.put(c, ring, W // 2, 960, "mm", shadow=dict(r=40, k=0.55, dy=30))
    for i, col in enumerate(cols[4:], 4): wave(i, col)
    c.alpha_composite(K.bokeh(W, H, 26, ["#ffffff", "#d8f6ff"], 8, 26, 7, 1, (90, 200)))
    pip = char("pip", "wow", h=520)
    K.put(c, pip, 980, 1560, "mb", shadow=dict(r=26, k=0.5, dy=20))
    put_title(c, "fish-watch", W // 2, 270, 940)
    tagline(c, "fish-watch", 1640, "#eaf8ff", 46, track=2)
    brand(c, dark=True)
    return K.grain(c, 6)


@poster("spot-the-sneak")
def spot_the_sneak(m):
    """a wallpaper of identical Gloops — and one sneak, circled"""
    c = K.solid(W, H, "#2a0a4a")
    g = char("gloop", "happy", w=210, floor=False); odd = K.tint(char("gloop", "wow", w=210, floor=False), "#c86aff", 0.55)
    rng = random.Random(4)
    cells = [(x, y) for y in range(520, 1560, 190) for x in range(90, W, 240)]
    pick = 13
    for i, (x, y) in enumerate(cells):
        xx = x + (120 if (y // 190) % 2 else 0) - 60
        im = odd if i == pick else g
        K.put(c, im.rotate(rng.uniform(-8, 8), resample=Image.BICUBIC, expand=True), xx, y, "mm", shadow=dict(r=10, k=0.45, dy=8))
        if i == pick: spot = (xx, y)
    ring = K.circle(W, H, spot[0], spot[1], 150, None, outline="#ffe24a", width=16)
    c.alpha_composite(K.glow(ring, 16, "#ffe24a", 0.9)); c.alpha_composite(ring)
    hand = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(hand).line((spot[0] + 105, spot[1] + 105, spot[0] + 230, spot[1] + 230), fill=K.rgba("#ffe24a"), width=34)
    c.alpha_composite(hand)
    c = K.vignette(c, 0.6, "#12002a")
    K.add(c, K.lin(W, H, [(0, (42, 10, 74, 255)), (0.24, (42, 10, 74, 240)), (0.34, (42, 10, 74, 0))]))
    put_title(c, "spot-the-sneak", W // 2, 230, 1000)
    band = K.lin(W, 250, [(0, (18, 0, 42, 0)), (0.4, (18, 0, 42, 235)), (1, (18, 0, 42, 255))]); K.paste(c, band, 0, H - 250)
    tagline(c, "spot-the-sneak", H - 150, "#d8ffb0", 48, track=2)
    brand(c)
    return K.grain(c, 6)


@poster("color-clash")
def color_clash(m):
    """Swiss Stroop board: colour words printed in the wrong ink, one clean grid"""
    c = K.solid(W, H, "#f4efe4")
    d = ImageDraw.Draw(c)
    d.rectangle((0, 0, W, 560), fill=K.rgba("#2459e0"))
    c.alpha_composite(K.opacity(K.dots_grid(W, 560, 40, 4, "#ffffff"), 0.18))
    ink = {"RED": "#e8323a", "BLUE": "#2459e0", "YELLOW": "#ffb800", "GREEN": "#21a85a", "PINK": "#ff5fa8", "PURPLE": "#8e3ae8"}
    words = [("RED", "BLUE"), ("GREEN", "PINK"), ("YELLOW", "PURPLE"), ("BLUE", "YELLOW"), ("PINK", "GREEN"), ("PURPLE", "RED")]
    tw, th, gx, gy = 530, 270, 50, 640
    for i, (wd, col) in enumerate(words):
        x, y = gx + (i % 2) * (tw + 40), gy + (i // 2) * (th + 30)
        tile = Image.new("RGBA", (tw, th), (0, 0, 0, 0)); ImageDraw.Draw(tile).rounded_rectangle((0, 0, tw - 1, th - 1), 34, fill=K.rgba("#ffffff"))
        t = K.fit(K.text_img(wd, "RubikMonoOne-Regular.ttf", 120, ink[col]), w=tw - 80, h=th - 90)
        tile.alpha_composite(t, ((tw - t.width) // 2, (th - t.height) // 2))
        K.put(c, tile, x, y, "lt", shadow=dict(r=16, k=0.18, dy=10))
    owl = char("hoot", "happy", h=520)
    K.put(c, owl, 1010, 1640, "mb", shadow=dict(r=22, k=0.4, dy=14))
    put_title(c, "color-clash", W // 2, 250, 900)
    t = K.text_img("Tap the ink colour, not the word", "Fredoka-Bold.ttf", 46, "#ffffff"); K.put(c, t, W // 2, 500, "mm")
    p = K.pill("INK  OR  WORD?", "RubikMonoOne-Regular.ttf", 40, "#ffffff", "#111111"); K.put(c, p, 360, 1600, "mm", rot=-3)
    brand(c, H - 50, "#111111")
    return K.grain(c, 6)


@poster("blink-change")
def blink_change(m):
    """before / after polaroids under a giant blinking eye"""
    c = K.lin(W, H, [(0, "#ffe9cc"), (1, "#ffb98a")])
    c.alpha_composite(K.opacity(K.rays(W, H, 0.5, 0.25, 24, "#fff4e2", "#ffe0b8", 0.0), 0.6))
    # the eye: an almond white, iris, and a lid closing from the top
    ew, eh = 700, 330
    eye = Image.new("RGBA", (ew, eh), (0, 0, 0, 0)); d = ImageDraw.Draw(eye)
    d.ellipse((0, 0, ew - 1, eh - 1), fill=K.rgba("#ffffff"))
    d.ellipse((ew / 2 - 120, eh / 2 - 120, ew / 2 + 120, eh / 2 + 120), fill=K.rgba("#2e86c8")); d.ellipse((ew / 2 - 62, eh / 2 - 62, ew / 2 + 62, eh / 2 + 62), fill=K.rgba("#10142a"))
    d.ellipse((ew / 2 - 40, eh / 2 - 70, ew / 2 + 5, eh / 2 - 25), fill=K.rgba("#ffffff"))
    lid = Image.new("RGBA", (ew, eh), (0, 0, 0, 0)); ld = ImageDraw.Draw(lid)
    ld.ellipse((-60, -eh * 1.1, ew + 60, eh * 0.52), fill=K.rgba("#ff9a5a"))
    lid = K.mask_poly(lid, [(0, 0), (ew, 0), (ew, eh), (0, eh)])
    lm = Image.new("L", (ew, eh), 0); ImageDraw.Draw(lm).ellipse((0, 0, ew - 1, eh - 1), fill=255)
    lid.putalpha(Image.composite(lid.getchannel("A"), Image.new("L", (ew, eh), 0), lm)); eye.alpha_composite(lid)
    ol = Image.new("RGBA", (ew + 40, eh + 40), (0, 0, 0, 0)); od = ImageDraw.Draw(ol)
    od.ellipse((20, 20, ew + 19, eh + 19), outline=K.rgba("#3a1a0a"), width=16)
    od.arc((-40, 20 - eh * 1.1, ew + 80, 20 + eh * 0.52), 20, 160, fill=K.rgba("#3a1a0a"), width=14)
    for k in range(7):
        a = math.radians(40 + k * 16.7); cx, cy = (ew + 40) / 2, 20 + eh * 0.52 - (eh * 1.62) / 2
        rx, ry = (ew + 120) / 2, eh * 1.62 / 2
        x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
        od.line((x, y, x + 28 * math.cos(a), y + 50 * math.sin(a)), fill=K.rgba("#3a1a0a"), width=12)
    base = Image.new("RGBA", ol.size, (0, 0, 0, 0)); base.alpha_composite(eye, (20, 20)); base.alpha_composite(ol)
    K.put(c, base, W // 2, 470, "mm", shadow=dict(r=24, k=0.25, dy=14))
    a = K.polaroid(K.grade(K.cover(frame("blink-change", 1), 520, 520, 0.5, 0.45, 1.3), 1.1), 500, "before")
    b = K.polaroid(K.grade(K.cover(frame("blink-change", 9), 520, 520, 0.5, 0.45, 1.3), 1.1), 500, "after?")
    K.put(c, a, 330, 1060, "mm", shadow=dict(r=20, k=0.35, dy=14), rot=6)
    K.put(c, b, 870, 1080, "mm", shadow=dict(r=20, k=0.35, dy=14), rot=-5)
    dog = char("noodle", "wow", w=560)
    K.put(c, dog, 860, 1660, "mb", shadow=dict(r=20, k=0.4, dy=14))
    put_title(c, "blink-change", 340, 1500, 560, rot=-5)
    tagline(c, "blink-change", 1700, "#7a3a12", 40)
    brand(c, H - 46, "#7a3a12")
    return K.grain(c, 6)


@poster("where-is-zib")
def where_is_zib(m):
    """space crowd seen through a telescope; Zib glowing in front"""
    c = K.lin(W, H, [(0, "#0b0626"), (0.6, "#2a1268"), (1, "#5a1fa8")])
    c.alpha_composite(K.bokeh(W, H, 260, ["#ffffff", "#c8b8ff", "#b7ff5a"], 1, 3.5, 2, 0, (120, 255)))
    K.add(c, K.rad(W, H, [(0, (183, 255, 90, 90)), (0.5, (183, 255, 90, 0))], 0.5, 0.52, 0.7), "screen")
    crowd = K.mask_circle(K.grade(K.cover(frame("where-is-zib"), 820, 820, 0.5, 0.45, 1.15), 1.2, 1.05))
    ring = K.circle(980, 980, 490, 490, 488, "#1a1240"); ring.alpha_composite(K.circle(980, 980, 490, 490, 470, "#8a7ad8")); ring.alpha_composite(K.circle(980, 980, 490, 490, 450, "#0b0626"))
    ring.alpha_composite(crowd, (80, 80))
    ring.alpha_composite(K.circle(980, 980, 490, 490, 410, None, outline="#b7ff5a", width=6))
    K.put(c, ring, W // 2, 880, "mm", glow_c=("#b7ff5a", 40, 0.35))
    zib = char("zib", "wow", h=640)
    K.put(c, zib, 230, 1620, "mb", shadow=dict(r=30, k=0.5, dy=10), glow_c=("#b7ff5a", 30, 0.3))
    put_title(c, "where-is-zib", W // 2, 260, 860, glow=("#b7ff5a", 30, 0.25))
    tagline(c, "where-is-zib", 1530, "#e8ffd0", 48, "Audiowide-Regular.ttf", 2)
    brand(c)
    return K.grain(c, 7)


@poster("shadow-match")
def shadow_match(m):
    """film noir: a small dog in the spotlight, a giant shadow on the wall"""
    c = K.lin(W, H, [(0, "#1a1a26"), (1, "#0a0a10")])
    wall = K.rad(W, H, [(0, (255, 228, 170, 210)), (0.42, (255, 228, 170, 60)), (0.75, (0, 0, 0, 0))], 0.5, 0.58, 0.75)
    c.alpha_composite(wall)
    floor = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(floor).rectangle((0, 1380, W, H), fill=K.rgba("#2a2016"))
    c.alpha_composite(floor); c.alpha_composite(K.rad(W, H, [(0, (255, 220, 160, 150)), (0.35, (0, 0, 0, 0))], 0.5, 0.82, 0.55))
    dog = char("noodle", "happy", w=520, floor=False)
    big = K.fit(K.tint(dog, "#000000", 1.0), w=1180)
    K.put(c, K.opacity(K.blur(big, 5), 0.88), W // 2 + 30, 1300, "mb")
    q = K.text_img("?", "BebasNeue-Regular.ttf", 360, "#ffd25a"); K.put(c, q, 1040, 760, "mm", glow_c=("#ffd25a", 20, 0.4))
    K.put(c, dog, W // 2 - 40, 1560, "mb", shadow=dict(r=14, k=0.7, dy=6))
    K.put(c, K.rim(K.with_pad(dog, 10), "#ffe0a0", 6, -60, 0.8), W // 2 - 40, 1560 + 10, "mb")
    beam = K.shape(W, H, [(560, 0), (640, 0), (900, 1560), (300, 1560)], "#fff3d0", 40).filter(ImageFilter.GaussianBlur(30)); K.add(c, beam, "screen")
    put_title(c, "shadow-match", W // 2, 300, 860)
    tagline(c, "shadow-match", 1650, "#ffe8c0", 56, "BebasNeue-Regular.ttf", 6)
    brand(c, H - 46)
    return K.grain(K.vignette(c, 0.6), 12)


@poster("gloop-guard")
def gloop_guard(m):
    """night club door: brick wall, neon sign, velvet rope"""
    c = K.brick(W, H, "#3a1a3a", "#241030", "#0e0614", 150, 62)
    K.add(c, K.rad(W, H, [(0, (90, 255, 140, 90)), (0.55, (0, 0, 0, 0))], 0.5, 0.25, 0.8), "screen")
    put_title(c, "gloop-guard", W // 2, 360, 980, shadow=False, glow=("#5aff7a", 50, 0.45))
    door = K.grade(K.cover(frame("gloop-guard"), 760, 760, 0.5, 0.55, 1.35), 1.15, 1.05)
    door = K.mask_rounded(door, 40)
    fr = Image.new("RGBA", (800, 800), (0, 0, 0, 0)); ImageDraw.Draw(fr).rounded_rectangle((0, 0, 799, 799), 50, fill=K.rgba("#ffd25a")); fr.alpha_composite(door, (20, 20))
    K.put(c, fr, W // 2, 1060, "mm", shadow=dict(r=40, k=0.6, dy=24), glow_c=("#ff4a5a", 30, 0.35))
    rope = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(rope)
    d.arc((60, 1300, 1140, 1560), 10, 170, fill=K.rgba("#c8102e"), width=34)
    for x in (80, 1120):
        d.rounded_rectangle((x - 22, 1360, x + 22, 1640), 10, fill=K.rgba("#ffd25a")); d.ellipse((x - 40, 1330, x + 40, 1410), fill=K.rgba("#ffe58a"))
    c.alpha_composite(rope)
    gl = char("gloop", "happy", w=360)
    K.put(c, gl, 230, 1600, "mb", shadow=dict(r=18, k=0.5, dy=10))
    t = K.text_img("GREEN IN · RED OUT", "Monoton-Regular.ttf", 54, "#ff6a7a"); K.put(c, t, W // 2 + 120, 1590, "mm", glow_c=("#ff4a5a", 14, 0.6))
    brand(c)
    return K.grain(c, 8)


# ------------------------------------------------------------------ MEMORY
@poster("memory-bridge")
def memory_bridge(m):
    """vintage travel poster: flat lake at sunset, stepping stones, Tiki"""
    c = K.lin(W, H, [(0, "#ffcf7a"), (0.28, "#ff9a6a"), (0.42, "#f5c7a0"), (1, "#f5c7a0")])
    K.add(c, K.circle(W, H, 600, 700, 200, "#fff1b8"))
    hills = [(560, 60, 0.9, "#6aa88a"), (610, 40, 1.4, "#4a8a72")]
    for y, a, f, col in hills: c.alpha_composite(K.shape(W, H, K.wave_poly(W, y + 120, a, f, 1.2), col))
    lake = K.lin(W, H - 760, [(0, "#2fb8b0"), (1, "#0b5a6a")]); K.paste(c, lake, 0, 760)
    for k in range(9):
        ln = Image.new("RGBA", (W, H), (0, 0, 0, 0)); y = 800 + k * k * 12
        ImageDraw.Draw(ln).line((200 - k * 20, y, 1000 + k * 20, y), fill=(255, 255, 255, 60), width=3); c.alpha_composite(ln)
    rng = random.Random(3)
    for i, (x, y, s) in enumerate([(300, 1500, 1.25), (700, 1350, 1.05), (420, 1180, 0.85), (760, 1050, 0.7), (520, 950, 0.55), (660, 880, 0.42)]):
        st = Image.new("RGBA", (int(300 * s), int(120 * s)), (0, 0, 0, 0)); d = ImageDraw.Draw(st)
        d.ellipse((0, 0, st.width - 1, st.height - 1), fill=K.rgba("#5a6a6e")); d.ellipse((st.width * 0.08, 0, st.width * 0.92, st.height * 0.7), fill=K.rgba("#9aaeb0"))
        if i in (1, 3): d.ellipse((st.width * 0.35, st.height * 0.1, st.width * 0.65, st.height * 0.4), fill=K.rgba("#ffe24a"))
        K.put(c, st, x, y, "mm", shadow=dict(r=12, k=0.35, dy=10))
    tk = char("tiki", "happy", h=420)
    K.put(c, tk, 320, 1460, "mb", shadow=dict(r=14, k=0.4, dy=10))
    border = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(border).rectangle((28, 28, W - 29, H - 29), outline=K.rgba("#fff4e0"), width=14); c.alpha_composite(border)
    put_title(c, "memory-bridge", W // 2, 290, 780)
    t = K.text_img("VISIT THE LAKE OF A HUNDRED STONES", "BebasNeue-Regular.ttf", 46, "#5a2a12", track=6); K.put(c, t, W // 2, 600, "mm")
    tagline(c, "memory-bridge", 1640, "#fff4e0", 50, "BebasNeue-Regular.ttf", 6)
    brand(c, H - 70)
    return K.grain(c, 10)


@poster("pips-pantry")
def pips_pantry(m):
    """kitchen gingham, a jar-label title and the memory cards"""
    c = K.solid(W, H, "#ffffff")
    K.add(c, K.stripes(W, H, 60, 0, ["#2e3f78", "#ffffff"]), "normal", 0.35); K.add(c, K.stripes(W, H, 60, 90, ["#2e3f78", "#ffffff"]), "multiply", 0.5)
    K.add(c, K.solid(W, H, "#f8f0e0"), "multiply", 0.7)
    label = Image.new("RGBA", (1000, 560), (0, 0, 0, 0)); d = ImageDraw.Draw(label)
    d.rounded_rectangle((0, 0, 999, 559), 80, fill=K.rgba("#fff7e6"), outline=K.rgba("#e8504f"), width=18)
    d.rounded_rectangle((40, 40, 959, 519), 56, outline=K.rgba("#2e3f78"), width=6)
    K.put(c, label, W // 2, 380, "mm", shadow=dict(r=26, k=0.35, dy=18), rot=-3)
    put_title(c, "pips-pantry", W // 2, 360, 820, rot=-3, shadow=False)
    cards = K.grade(K.cover(frame("pips-pantry"), 900, 520, 0.42, 0.42, 1.15), 1.1)
    K.put(c, K.card_frame(cards, 940, 560, 34, 20, "#2e3f78"), W // 2, 1040, "mm", shadow=dict(r=30, k=0.4, dy=22), rot=2)
    pip = char("pip", "happy", h=520)
    K.put(c, pip, 930, 1640, "mb", shadow=dict(r=20, k=0.45, dy=12))
    for x, y, col in ((150, 1450, "#e8504f"), (300, 1560, "#ffb000"), (180, 1640, "#74c94e")):
        K.put(c, K.circle(120, 120, 60, 60, 54, col), x, y, "mm", shadow=dict(r=10, k=0.35, dy=8))
    tagline(c, "pips-pantry", 1395, "#2e3f78", 52, track=1)
    brand(c, H - 60, "#2e3f78")
    return K.grain(c, 6)


@poster("bolt-beeps")
def bolt_beeps(m):
    """retro CRT on a dark desk: the beep pads glowing, Bolt peeking"""
    c = K.lin(W, H, [(0, "#0a2a2e"), (1, "#041416")])
    c.alpha_composite(K.opacity(K.grid(W, H, 60, "#3affd8", 2, 60), 0.6))
    tv = Image.new("RGBA", (1060, 900), (0, 0, 0, 0)); d = ImageDraw.Draw(tv)
    d.rounded_rectangle((0, 0, 1059, 899), 90, fill=K.rgba("#c8b89a")); d.rounded_rectangle((30, 30, 1029, 869), 70, fill=K.rgba("#a8987a"))
    scr = K.scanlines(K.grade(K.cover(frame("bolt-beeps"), 820, 640, 0.66, 0.5, 1.35), 1.3, 1.1), 5, 0.22)
    scr = K.mask_rounded(scr, 60); tv.alpha_composite(scr, (60, 60))
    tv.alpha_composite(K.rad(820, 640, [(0, (255, 255, 255, 40)), (0.7, (255, 255, 255, 0))], 0.3, 0.2, 0.9), (60, 60))
    for k, col in enumerate(("#ff4a4a", "#ffd21f", "#3affd8")):
        d.ellipse((900, 140 + k * 120, 990, 230 + k * 120), fill=K.rgba("#5a4a3a")); d.ellipse((915, 155 + k * 120, 975, 215 + k * 120), fill=K.rgba(col))
    d.rectangle((900, 560, 990, 820), fill=K.rgba("#5a4a3a"))
    K.put(c, tv, W // 2, 1000, "mm", shadow=dict(r=40, k=0.6, dy=30), glow_c=("#3affd8", 40, 0.25))
    bolt = char("bolt", "happy", h=560)
    K.put(c, bolt, 1000, 1560, "mb", shadow=dict(r=20, k=0.5, dy=10))
    put_title(c, "bolt-beeps", W // 2, 300, 600, glow=("#3affd8", 26, 0.25))
    tagline(c, "bolt-beeps", 1600, "#3affd8", 44, "PressStart2P-Regular.ttf", 2)
    brand(c)
    return K.grain(c, 8)


@poster("order-up")
def order_up(m):
    """50s diner menu: candy stripes, a menu card, Bonbon the chef"""
    c = K.stripes(W, H, 90, 0, ["#ff6f91", "#ffe8ee"])
    K.add(c, K.lin(W, H, [(0, (255, 255, 255, 0)), (1, (255, 111, 145, 160))]))
    menu = Image.new("RGBA", (820, 900), (0, 0, 0, 0)); d = ImageDraw.Draw(menu)
    d.rounded_rectangle((0, 0, 819, 899), 40, fill=K.rgba("#fffaf0"), outline=K.rgba("#5ae0c8"), width=16)
    menu.alpha_composite(K.text_img("TODAY'S SPECIAL", "Lemon-Regular.ttf", 54, "#ff2a6a"), (90, 60))
    cake = K.mask_rounded(K.grade(K.cover(frame("order-up"), 640, 420, 0.33, 0.33, 1.6), 1.1), 30)
    menu.alpha_composite(cake, (90, 160))
    for k, line in enumerate(("1 · Sponge", "2 · Cream", "3 · Cherry", "Build it from memory!")):
        t = K.text_img(line, "Fredoka-Bold.ttf", 40 if k < 3 else 36, "#5a2a3a" if k < 3 else "#ff2a6a"); menu.alpha_composite(t, (100, 620 + k * 62))
    K.put(c, menu, 560, 1080, "mm", shadow=dict(r=34, k=0.4, dy=24), rot=3)
    bb = char("bonbon", "happy", h=620)
    K.put(c, bb, 960, 1660, "mb", shadow=dict(r=24, k=0.45, dy=14))
    put_title(c, "order-up", W // 2, 290, 860)
    brand(c, H - 60, "#ffffff", dark=True)
    return K.grain(c, 6)


@poster("grid-glow")
def grid_glow(m):
    """minimal cyber: a glowing 4x4 tile grid floating in the dark"""
    c = K.solid(W, H, "#07040f")
    K.add(c, K.rad(W, H, [(0, (124, 242, 201, 70)), (0.6, (0, 0, 0, 0))], 0.5, 0.55, 0.8))
    lit = {(0, 1), (1, 1), (1, 3), (2, 2), (2, 3), (3, 0)}
    tile = 190; gap = 26; gx = (W - (4 * tile + 3 * gap)) // 2; gy = 640
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for r in range(4):
        for q in range(4):
            x, y = gx + q * (tile + gap), gy + r * (tile + gap)
            if (r, q) in lit: d.rounded_rectangle((x, y, x + tile, y + tile), 28, fill=K.rgba("#ffd25a"))
            else: d.rounded_rectangle((x, y, x + tile, y + tile), 28, fill=K.rgba("#1a1236"), outline=K.rgba("#7cf2c9", 160), width=4)
    c.alpha_composite(K.glow(layer, 40, "#ffd25a", 0.55)); c.alpha_composite(layer)
    for k in range(6):
        y = 560 + k * 9; ln = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(ln).line((0, y + k * 160, W, y + k * 160 - 300), fill=K.rgba("#7cf2c9", 30), width=2); c.alpha_composite(ln)
    bolt = char("bolt", "wow", h=380)
    K.put(c, bolt, 190, 1660, "mb", glow_c=("#7cf2c9", 30, 0.3))
    put_title(c, "grid-glow", W // 2, 330, 760, shadow=False)
    tagline(c, "grid-glow", 1560, "#7cf2c9", 40, "Silkscreen-Bold.ttf", 4)
    brand(c)
    return K.grain(c, 9)


@poster("who-said-it")
def who_said_it(m):
    """comic book page: halftone, panels and speech bubbles"""
    c = K.solid(W, H, "#fff6e0")
    c.alpha_composite(K.halftone(W, H, 26, "#ffb0d0", lambda x, y: 0.3 + 0.6 * y, 20))
    d = ImageDraw.Draw(c)
    panels = [(40, 560, 640, 1150), (660, 560, 1160, 1150), (40, 1170, 1160, 1700)]
    fills = ["#9b5de5", "#ff8a3d", "#2ec4b6"]
    for (x0, y0, x1, y1), col in zip(panels, fills):
        d.rectangle((x0, y0, x1, y1), fill=K.rgba(col), outline=K.rgba("#1a0a2a"), width=10)
    stage = K.grade(K.cover(frame("who-said-it"), 580, 570, 0.5, 0.42, 1.4), 1.15)
    c.alpha_composite(stage, (50, 570))
    K.put(c, char("gloop", "wow", h=500), 910, 1140, "mb")
    K.put(c, char("zib", "happy", h=420), 330, 1690, "mb")
    K.put(c, char("bolt", "happy", h=420), 880, 1690, "mb")
    def bubble(x, y, w, h, txt, size, tail):
        b = Image.new("RGBA", (W, H), (0, 0, 0, 0)); bd = ImageDraw.Draw(b)
        bd.polygon([(x + w * 0.3, y + h * 0.8), (x + w * 0.45, y + h * 0.8), tail], fill=K.rgba("#ffffff"), outline=K.rgba("#1a0a2a"))
        bd.ellipse((x, y, x + w, y + h), fill=K.rgba("#ffffff"), outline=K.rgba("#1a0a2a"), width=8)
        c.alpha_composite(b); t = K.text_img(txt, "Bangers-Regular.ttf", size, "#1a0a2a", track=2); K.put(c, t, x + w / 2, y + h / 2, "mm")
    bubble(690, 590, 300, 180, "BLEEP!", 70, (800, 860))
    bubble(120, 1190, 340, 190, "WHO?!", 80, (300, 1420))
    bubble(760, 1200, 360, 170, "BOOP!", 72, (880, 1400))
    put_title(c, "who-said-it", W // 2, 280, 900)
    brand(c, H - 54, "#1a0a2a")
    return K.grain(c, 6)


@poster("whats-missing")
def whats_missing(m):
    """case file: manila folder, a polaroid of the museum shelf, red STOLEN stamp"""
    c = K.lin(W, H, [(0, "#3a2a2a"), (1, "#1a1010")])
    folder = Image.new("RGBA", (1080, 1300), (0, 0, 0, 0)); d = ImageDraw.Draw(folder)
    d.rounded_rectangle((0, 60, 1079, 1299), 30, fill=K.rgba("#e8c78a")); d.rounded_rectangle((40, 0, 420, 120), 24, fill=K.rgba("#e8c78a"))
    folder = K.grain(folder, 10)
    folder.alpha_composite(K.text_img("CASE FILE #27 · MUSEUM", "SairaStencilOne-Regular.ttf", 40, "#7a4a1a", track=3), (80, 30))
    K.put(c, folder, W // 2, 1080, "mm", shadow=dict(r=30, k=0.6, dy=20), rot=-2)
    pol = K.polaroid(K.grade(K.cover(frame("whats-missing"), 600, 600, 0.45, 0.42, 1.25), 1.1), 640, "the shelf, before")
    K.put(c, pol, 520, 1000, "mm", shadow=dict(r=18, k=0.5, dy=12), rot=-6)
    stamp = K.text_img("STOLEN!", "BlackOpsOne-Regular.ttf", 130, "#d0141e"); stamp = K.opacity(stamp, 0.85)
    box = Image.new("RGBA", (stamp.width + 60, stamp.height + 50), (0, 0, 0, 0)); ImageDraw.Draw(box).rounded_rectangle((0, 0, box.width - 1, box.height - 1), 20, outline=K.rgba("#d0141e", 220), width=12)
    box.alpha_composite(stamp, (30, 25)); K.put(c, box, 760, 1360, "mm", rot=14)
    kr = cast("kranky", "laugh"); kr = K.fit(kr, w=560)
    K.put(c, kr, 900, 760, "mm", shadow=dict(r=20, k=0.5, dy=12), rot=8)
    put_title(c, "whats-missing", W // 2, 250, 940)
    tagline(c, "whats-missing", 1660, "#ffe8c0", 50, "PassionOne-Black.ttf", 2)
    brand(c, H - 54)
    return K.grain(c, 10)


# ------------------------------------------------------------------ BRAIN
@poster("pick-the-door")
def pick_the_door(m):
    """TV game show: red curtains, three lit doors, Kranky hosting"""
    c = K.lin(W, H, [(0, "#3a0a2a"), (1, "#14041a")])
    beams = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for x in (300, 600, 900): beams.alpha_composite(K.shape(W, H, [(x - 30, 0), (x + 30, 0), (x + 220, 1500), (x - 220, 1500)], "#ffe8b0", 70))
    c.alpha_composite(beams.filter(ImageFilter.GaussianBlur(30)))
    for side in (0, 1):
        cur = K.stripes(260, H, 40, 0, ["#a0101e", "#c8202e", "#7a0a16"])
        cur = K.mask_poly(cur, [(0, 0), (260, 0), (200 if side == 0 else 260, H), (0, H)] if side == 0 else [(0, 0), (260, 0), (260, H), (60, H)])
        c.alpha_composite(cur, (0 if side == 0 else W - 260, 0))
    doors = K.grade(K.cover(frame("pick-the-door"), 900, 520, 0.6, 0.66, 1.25), 1.15, 1.05)
    K.put(c, K.card_frame(doors, 940, 560, 30, 20, "#ffd25a"), W // 2, 1100, "mm", shadow=dict(r=36, k=0.6, dy=26), glow_c=("#ffd25a", 30, 0.3))
    bulbs = Image.new("RGBA", (W, H), (0, 0, 0, 0)); bd = ImageDraw.Draw(bulbs)
    for k in range(13): x = 150 + k * 75; bd.ellipse((x - 14, 790 - 14, x + 14, 790 + 14), fill=K.rgba("#fff2b0")); bd.ellipse((x - 14, 1410 - 14, x + 14, 1410 + 14), fill=K.rgba("#fff2b0"))
    c.alpha_composite(K.glow(bulbs, 14, "#ffd25a", 0.8)); c.alpha_composite(bulbs)
    kr = K.fit(cast("kranky", "laugh"), w=620)
    K.put(c, kr, W // 2, 1720, "mb", shadow=dict(r=24, k=0.55, dy=12))
    put_title(c, "pick-the-door", W // 2, 330, 900)
    t = K.text_img("ONE DOOR WINS. CRACK THE CLUES!", "AlfaSlabOne-Regular.ttf", 40, "#ffd25a", track=2); K.put(c, t, W // 2, 640, "mm")
    brand(c, H - 46)
    return K.grain(c, 8)


@poster("pattern-parade")
def pattern_parade(m):
    """risograph festival print: two-ink town, bunting and a big title"""
    c = K.solid(W, H, "#fff2dc")
    town = K.cover(frame("pattern-parade"), W, 1000, 0.5, 0.42, 1.0)
    riso = K.gradmap(K.grade(town, 1, 1.3), [(0, "#1a0e4a"), (0.45, "#ff3a7a"), (0.8, "#ffb8c8"), (1, "#fff2dc")])
    pink = K.opacity(K.gradmap(town, [(0, "#ff5a8a"), (1, (255, 255, 255, 0))]), 0.45)
    c.alpha_composite(riso, (0, 620)); K.paste(c, pink, 14, 632)
    c.alpha_composite(K.halftone(W, H, 18, "#2ec4b6", lambda x, y: max(0, (y - 0.35) * 0.9), 15))
    for row, y in enumerate((560, 640)):
        flags = Image.new("RGBA", (W, H), (0, 0, 0, 0)); fd = ImageDraw.Draw(flags)
        fd.line((0, y, W, y + 40), fill=K.rgba("#2a1a6a"), width=4)
        for k in range(12):
            x = k * 105 + row * 50; col = ("#ff5a8a", "#2ec4b6", "#ffb000", "#9b5de5")[(k + row) % 4]
            fd.polygon([(x, y + x * 40 / W), (x + 80, y + (x + 80) * 40 / W), (x + 40, y + 90 + x * 40 / W)], fill=K.rgba(col))
        c.alpha_composite(flags)
    owl = char("hoot", "happy", h=520)
    K.put(c, owl, 960, 1560, "mb", shadow=dict(r=18, k=0.4, dy=10))
    put_title(c, "pattern-parade", W // 2, 290, 980)
    tagline(c, "pattern-parade", 1640, "#2a1a6a", 54, "Fascinate-Regular.ttf", 2)
    brand(c, H - 46, "#2a1a6a")
    return K.grain(c, 14, 7)


@poster("odd-blob-out")
def odd_blob_out(m):
    """minimal line-up: five purple blobs and the one that doesn't fit"""
    c = K.lin(W, H, [(0, "#f2ecff"), (1, "#d8c8ff")])
    zb = no_floor(cast("zib", "happy")); odd = no_floor(cast("zib", "wow"))
    same = K.fit(K.tint(zb, "#8e5be8", 0.25), h=300); diff = K.fit(K.tint(odd, "#74c94e", 0.55), h=300)
    pts = [(220, 860), (600, 820), (980, 860), (220, 1260), (600, 1220), (980, 1260)]
    for i, (x, y) in enumerate(pts):
        im = diff if i == 4 else same
        K.put(c, K.circle(W, H, x, y + 140, 120, "#8e5be8", 50), 0, 0, "lt")
        K.put(c, im.rotate(18 if i == 4 else 0, resample=Image.BICUBIC, expand=True), x, y + 150, "mb", shadow=dict(r=14, k=0.3, dy=10))
    ring = K.circle(W, H, 600, 1220, 210, None, outline="#74c94e", width=14); c.alpha_composite(ring)
    q = K.text_img("?", "Chewy-Regular.ttf", 300, "#74c94e"); K.put(c, q, 860, 1080, "mm", shadow=dict(r=12, k=0.3, dy=8), rot=-12)
    put_title(c, "odd-blob-out", W // 2, 330, 900)
    tagline(c, "odd-blob-out", 1560, "#4a1aa0", 54, "Chewy-Regular.ttf", 2)
    brand(c, H - 60, "#4a1aa0")
    return K.grain(c, 6)


@poster("balance-buddies")
def balance_buddies(m):
    """physics notebook: graph paper, a seesaw diagram and the buddies on it"""
    c = K.solid(W, H, "#fffaf0")
    c.alpha_composite(K.grid(W, H, 40, "#9ac0e0", 1, 110)); c.alpha_composite(K.grid(W, H, 200, "#6a9ac8", 2, 150))
    d = ImageDraw.Draw(c)
    d.polygon([(600, 1180), (500, 1360), (700, 1360)], fill=K.rgba("#ffb000"), outline=K.rgba("#3a1e0a"))
    plank = Image.new("RGBA", (1000, 60), (0, 0, 0, 0)); ImageDraw.Draw(plank).rounded_rectangle((0, 0, 999, 59), 28, fill=K.rgba("#9a6b45"))
    K.put(c, plank, 600, 1160, "mm", rot=8, shadow=dict(r=10, k=0.3, dy=8))
    K.put(c, char("bonbon", "happy", h=360, floor=False), 250, 1090, "mb")
    K.put(c, char("pip", "wow", h=260, floor=False), 930, 1010, "mb")
    for x, y, txt in ((250, 1260, "? kg"), (930, 1180, "? kg")):
        t = K.text_img(txt, "PermanentMarker-Regular.ttf", 56, "#2459e0"); K.put(c, t, x, y + 60, "mm")
    arr = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ad = ImageDraw.Draw(arr)
    ad.arc((360, 760, 840, 1100), 200, 340, fill=K.rgba("#e8323a"), width=8); ad.polygon([(812, 800), (850, 860), (790, 850)], fill=K.rgba("#e8323a")); c.alpha_composite(arr)
    owl = char("hoot", "happy", h=420)
    K.put(c, owl, 1010, 1700, "mb", shadow=dict(r=14, k=0.3, dy=8))
    put_title(c, "balance-buddies", W // 2, 330, 980, rot=-4)
    t = K.text_img("Who is the heaviest?", "PermanentMarker-Regular.ttf", 64, "#3a1e0a"); K.put(c, t, 470, 1520, "mm", rot=2)
    brand(c, H - 54, "#3a1e0a")
    return K.grain(c, 5)


# ------------------------------------------------------------------ REFLEX
def best_frame(slug, score):
    from assets import frame as fr
    return max(range(18), key=lambda i: score(fr(slug, i)))


def greenness(im):
    import numpy as np
    a = np.asarray(im.convert("RGB").resize((200, 152))).astype(int)
    return int(((a[..., 1] > a[..., 0] + 40) & (a[..., 1] > a[..., 2] + 40) & (a[..., 1] > 150)).sum())


@poster("whack-a-gloop")
def whack_a_gloop(m):
    """pop-art burst: rays, a hole, Gloop popping up, BONK!"""
    c = K.rays(W, H, 0.5, 0.62, 28, "#ffd21f", "#ffb000", 0.1)
    K.add(c, K.rad(W, H, [(0, (255, 255, 255, 150)), (0.5, (255, 255, 255, 0))], 0.5, 0.62, 0.7))
    c.alpha_composite(K.halftone(W, H, 30, "#ff8a3d", lambda x, y: abs(y - 0.62) * 1.4, 30))
    hole = Image.new("RGBA", (760, 280), (0, 0, 0, 0)); hd = ImageDraw.Draw(hole)
    hd.ellipse((0, 0, 759, 279), fill=K.rgba("#7a4a1a")); hd.ellipse((40, 30, 719, 250), fill=K.rgba("#2a1406"))
    K.put(c, hole, W // 2, 1420, "mm")
    gl = char("gloop", "wow", w=600, floor=False)
    gl = gl.crop((0, 0, gl.width, int(gl.height * 0.86)))
    K.put(c, gl, W // 2, 1440, "mb")
    lip = Image.new("RGBA", (760, 280), (0, 0, 0, 0)); ImageDraw.Draw(lip).chord((0, 0, 759, 279), 0, 180, fill=K.rgba("#9a5a22"))
    ImageDraw.Draw(lip).chord((40, 30, 719, 250), 0, 180, fill=(0, 0, 0, 0))
    K.put(c, lip, W // 2, 1420, "mm")
    bonk = K.text_img("BONK!", "Bangers-Regular.ttf", 210, "#ffffff", track=4, stroke=14, stroke_fill="#1e0a2a")
    K.put(c, bonk, 880, 930, "mm", rot=12, shadow=dict(r=10, k=0.5, dy=10))
    c.alpha_composite(K.confetti(W, H, 40, ["#ff3a5a", "#2ec4b6", "#ffffff", "#7a5aff"], 9, (10, 24), (0, 0.4, 1, 0.9)))
    put_title(c, "whack-a-gloop", W // 2, 330, 980)
    tagline(c, "whack-a-gloop", 1620, "#1e0a2a", 54, "Bangers-Regular.ttf", 3)
    brand(c, H - 60, "#1e0a2a")
    return K.grain(c, 6)


@poster("turbo-dash")
def turbo_dash(m):
    """speed magazine cover: motion streaks, a huge snail and cover lines"""
    road = K.grade(K.cover(frame("turbo-dash"), W, H, 0.5, 0.55, 1.0), 1.2, 1.1)
    c = road.copy()
    c.alpha_composite(K.lin(W, H, [(0, (11, 26, 74, 230)), (0.35, (11, 26, 74, 60)), (0.7, (11, 26, 74, 30)), (1, (11, 26, 74, 230))]))
    streaks = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(streaks); rng = random.Random(2)
    for _ in range(60):
        y = rng.uniform(500, 1500); x = rng.uniform(-200, W); ln = rng.uniform(150, 500)
        sd.line((x, y, x + ln, y - ln * 0.08), fill=K.rgba(rng.choice(["#ffffff", "#ffd25a", "#38b6ff"]), rng.randint(60, 180)), width=rng.randint(2, 7))
    c.alpha_composite(streaks.filter(ImageFilter.GaussianBlur(1)))
    sn = char("turbo", "happy", w=900)
    K.put(c, sn, 640, 1520, "mb", shadow=dict(r=30, k=0.55, dy=18))
    put_title(c, "turbo-dash", W // 2, 250, 940)
    for k, (txt, col) in enumerate((("WORLD'S SLOWEST SNAIL", "#ffffff"), ("FASTEST ROCKET", "#ffd25a"))):
        t = K.text_img(txt, "RacingSansOne-Regular.ttf", 56, col); K.put(c, t, 70, 520 + k * 70, "lm")
    p = K.pill("ISSUE #1", "RacingSansOne-Regular.ttf", 40, "#0b1a4a", "#ffd25a"); K.put(c, p, 1120, 540, "rm", rot=-6)
    tagline(c, "turbo-dash", 1630, "#ffffff", 50, "RacingSansOne-Regular.ttf", 2)
    brand(c)
    return K.grain(c, 7)


@poster("bake-drop")
def bake_drop(m):
    """sweet pastel: mesh-gradient frosting, falling cake bits, sprinkles"""
    c = K.mesh(W, H, "#ffe8f0", [(0.1, 0.1, 0.5, "#ffc8dc"), (0.9, 0.3, 0.5, "#fff0c8"), (0.3, 0.8, 0.6, "#ffd8e8"), (0.9, 0.9, 0.5, "#ffb0c8")])
    c.alpha_composite(K.confetti(W, H, 120, ["#ff3a5a", "#2ec4b6", "#ffd21f", "#7a5aff", "#ffffff"], 3, (6, 14)))
    bowl = K.grade(K.cover(frame("bake-drop"), 700, 520, 0.42, 0.78, 1.7), 1.1)
    K.put(c, K.mask_circle(K.cover(bowl, 620, 620)), W // 2, 1050, "mm", shadow=dict(r=30, k=0.3, dy=20))
    ring = K.circle(W, H, W // 2, 1050, 330, None, outline="#ffffff", width=26); c.alpha_composite(ring)
    for x, y, r, col in ((250, 650, 70, "#ff7ab8"), (960, 720, 56, "#ffc86a"), (180, 1250, 50, "#ff3a5a"), (1020, 1300, 64, "#fff0c8")):
        K.put(c, K.circle(r * 2 + 4, r * 2 + 4, r + 2, r + 2, r, col), x, y, "mm", shadow=dict(r=12, k=0.25, dy=10))
    bb = char("bonbon", "wow", h=520)
    K.put(c, bb, 900, 1640, "mb", shadow=dict(r=20, k=0.35, dy=12))
    put_title(c, "bake-drop", W // 2, 330, 860)
    tagline(c, "bake-drop", 1470, "#b02a6a", 52, "Grandstander-Black.ttf", 1)
    brand(c, H - 54, "#b02a6a")
    return K.grain(c, 5)


@poster("quick-hoot")
def quick_hoot(m):
    """western WANTED poster: parchment, a frame, the fastest finger in the west"""
    c = K.lin(W, H, [(0, "#ff9a3a"), (1, "#c8481a")])
    paper = Image.new("RGBA", (1060, 1640), K.rgba("#f2dcae"))
    paper = K.grain(K.vignette(paper, 0.45, "#7a4a1a", 0.95), 14)
    pd = ImageDraw.Draw(paper)
    wt = K.text_img("WANTED", "Ultra-Regular.ttf", 170, "#3a1e0a"); paper.alpha_composite(wt, ((1060 - wt.width) // 2, 50))
    pd.line((80, 290, 980, 290), fill=K.rgba("#3a1e0a"), width=6)
    pic = K.grade(K.cover(frame("quick-hoot"), 760, 600, 0.65, 0.6, 1.4), 1.1)
    pic = K.gradmap(pic, [(0, "#2a1406"), (0.6, "#c88a4a"), (1, "#fff0d0")])
    paper.alpha_composite(pic, (150, 330)); pd.rectangle((150, 330, 910, 930), outline=K.rgba("#3a1e0a"), width=8)
    paper.alpha_composite(K.text_img("FASTEST FINGER IN THE WEST", "Ultra-Regular.ttf", 46, "#3a1e0a"), (110, 1360))
    paper.alpha_composite(K.text_img("REWARD: BRAGGING RIGHTS", "BebasNeue-Regular.ttf", 72, "#8a1a0a", track=4), (230, 1440))
    K.put(c, paper, W // 2, 900, "mm", shadow=dict(r=30, k=0.5, dy=20), rot=-1.5)
    owl = char("hoot", "happy", h=460)
    K.put(c, owl, 960, 1360, "mb", shadow=dict(r=16, k=0.4, dy=8))
    put_title(c, "quick-hoot", W // 2, 1180, 900, rot=-3)
    brand(c, H - 46)
    return K.grain(c, 8)


# ------------------------------------------------------------------ NUMBERS
@poster("count-fast")
def count_fast(m):
    """Swiss numerals: a bold grid of digits, Momo counting"""
    c = K.solid(W, H, "#fff6e0")
    cols = ["#ffb000", "#ff6f91", "#2459e0", "#21a85a", "#9b5de5", "#e8323a", "#2ec4b6", "#111111", "#ff8a3d"]
    cell = 400; d = ImageDraw.Draw(c)
    for i in range(9):
        x, y = (i % 3) * cell, 560 + (i // 3) * 333
        d.rectangle((x, y, x + cell, y + 333), fill=K.rgba(cols[i]))
        t = K.text_img(str(i + 1), "Rowdies-Bold.ttf", 300, "#ffffff" if i != 0 else "#111111"); K.put(c, K.opacity(t, 0.9), x + cell // 2, y + 166, "mm")
    mo = cast("momo", "happy"); mo = K.fit(mo, w=760)
    K.put(c, mo, W // 2, 1500, "mm", shadow=dict(r=30, k=0.5, dy=20))
    K.paste(c, K.lin(W, 160, [(0, (255, 246, 224, 0)), (1, (255, 246, 224, 255))]), 0, 1460)
    d = ImageDraw.Draw(c); d.rectangle((0, 1620, W, H), fill=K.rgba("#fff6e0"))
    put_title(c, "count-fast", W // 2, 290, 920)
    tagline(c, "count-fast", 1680, "#111111", 50, "Rowdies-Bold.ttf", 2)
    brand(c, H - 46, "#111111")
    return K.grain(c, 6)


@poster("sum-slices")
def sum_slices(m):
    """pizzeria: red gingham, the slice wheel and a chalkboard sum"""
    c = K.solid(W, H, "#ffffff")
    K.add(c, K.stripes(W, H, 70, 0, ["#d8281e", "#ffffff"]), "normal", 0.55); K.add(c, K.stripes(W, H, 70, 90, ["#d8281e", "#ffffff"]), "multiply", 0.55)
    wheel = K.grade(K.cover(frame("sum-slices"), 900, 900, 0.62, 0.55, 1.45), 1.1)
    K.put(c, K.mask_circle(wheel), W // 2, 1000, "mm", shadow=dict(r=40, k=0.5, dy=26))
    board = Image.new("RGBA", (520, 300), (0, 0, 0, 0)); bd = ImageDraw.Draw(board)
    bd.rounded_rectangle((0, 0, 519, 299), 24, fill=K.rgba("#7a3a12")); bd.rounded_rectangle((18, 18, 501, 281), 16, fill=K.rgba("#1f3a2a"))
    board.alpha_composite(K.text_img("9 + 7 + 10", "PermanentMarker-Regular.ttf", 64, "#ffffff"), (70, 50)); board.alpha_composite(K.text_img("= 26 !", "PermanentMarker-Regular.ttf", 80, "#ffd25a"), (150, 150))
    K.put(c, board, 300, 1500, "mm", shadow=dict(r=18, k=0.45, dy=12), rot=-5)
    K.put(c, char("bonbon", "happy", h=520), 960, 1700, "mb", shadow=dict(r=18, k=0.4, dy=10))
    put_title(c, "sum-slices", W // 2, 300, 920)
    brand(c, H - 46, "#ffffff", dark=True)
    return K.grain(c, 6)


@poster("number-ninja")
def number_ninja(m):
    """ink-brush scroll: rice paper, a red sun, slashed numbers"""
    c = K.solid(W, H, "#f4ecdc")
    c = K.grain(c, 10)
    K.add(c, K.circle(W, H, 600, 820, 330, "#d0141e"))
    rng = random.Random(8)
    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0)); idr = ImageDraw.Draw(ink)
    for k in range(5):
        y = 1180 + k * 26; idr.line((rng.uniform(40, 200), y, rng.uniform(900, 1160), y + rng.uniform(-30, 30)), fill=K.rgba("#141414", 230), width=rng.randint(18, 40))
    c.alpha_composite(ink.filter(ImageFilter.GaussianBlur(1.5)))
    for k, (n, x, y, s, r) in enumerate(((7, 250, 700, 200, -12), (3, 960, 640, 170, 14), (12, 920, 1020, 150, -8), (1, 240, 1040, 180, 10))):
        t = K.text_img(str(n), "BlackHanSans-Regular.ttf", s, "#141414"); K.put(c, t, x, y, "mm", rot=r)
    slash = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(slash).line((60, 1000, 1140, 560), fill=K.rgba("#ffffff"), width=16); c.alpha_composite(K.glow(slash, 10, "#ffffff", 0.6)); c.alpha_composite(slash)
    dog = char("noodle", "happy", w=780)
    K.put(c, dog, W // 2, 1580, "mb", shadow=dict(r=20, k=0.35, dy=10))
    put_title(c, "number-ninja", W // 2, 300, 900)
    tagline(c, "number-ninja", 1660, "#141414", 52, "BlackHanSans-Regular.ttf", 3, text="TAP 1, 2, 3 - SUPER FAST")
    brand(c, H - 46, "#141414")
    return c


@poster("more-or-less")
def more_or_less(m):
    """candy shop: two glass jars on a shelf, jelly beans everywhere"""
    c = K.mesh(W, H, "#f8e8ff", [(0.2, 0.2, 0.6, "#ffd0e8"), (0.85, 0.35, 0.5, "#d8c8ff"), (0.5, 0.95, 0.7, "#ffe8c8")])
    jars = K.grade(K.cover(frame("more-or-less"), 860, 640, 0.6, 0.75, 1.55), 1.15)
    K.put(c, K.card_frame(jars, 900, 680, 46, 18, "#ffffff"), W // 2, 1000, "mm", shadow=dict(r=34, k=0.35, dy=24), rot=-2)
    beans = Image.new("RGBA", (W, H), (0, 0, 0, 0)); rng = random.Random(6)
    for _ in range(70):
        x, y = rng.uniform(0, W), rng.choice([rng.uniform(560, 660), rng.uniform(1360, 1500)])
        b = Image.new("RGBA", (90, 60), (0, 0, 0, 0)); ImageDraw.Draw(b).ellipse((5, 5, 85, 55), fill=K.rgba(rng.choice(["#ff3a7a", "#9b5de5", "#2ec4ff", "#ffb000", "#74c94e", "#ffffff"])))
        ImageDraw.Draw(b).ellipse((20, 12, 45, 24), fill=(255, 255, 255, 120))
        beans.alpha_composite(b.rotate(rng.uniform(0, 360), expand=True).resize((64, 64)), (int(x), int(y)))
    c.alpha_composite(K.drop(beans, (0, 6), 6, "#5a2a6a", 0.4)); c.alpha_composite(beans)
    K.put(c, char("turbo", "wow", h=420), 1000, 1700, "mb", shadow=dict(r=14, k=0.35, dy=8))
    put_title(c, "more-or-less", W // 2, 300, 560)
    tagline(c, "more-or-less", 1580, "#6a1fd0", 54, "SpicyRice-Regular.ttf", 2)
    brand(c, H - 46, "#6a1fd0")
    return K.grain(c, 5)


# ------------------------------------------------------------------ PUZZLE
@poster("slide-ship")
def slide_ship(m):
    """blueprint: a ship schematic built from the puzzle tiles"""
    c = K.lin(W, H, [(0, "#123a8a"), (1, "#0a1f52")])
    c.alpha_composite(K.grid(W, H, 30, "#8ab8ff", 1, 60)); c.alpha_composite(K.grid(W, H, 150, "#8ab8ff", 2, 110))
    tiles = K.grade(K.cover(frame("slide-ship"), 700, 640, 0.45, 0.5, 1.6), 1.1)
    bp = K.gradmap(tiles, [(0, "#0a1f52"), (0.5, "#4a7ad8"), (1, "#e8f4ff")])
    K.put(c, K.card_frame(bp, 740, 680, 10, 6, "#e8f4ff"), W // 2, 1000, "mm", rot=-4)
    d = ImageDraw.Draw(c)
    for (x0, y0, x1, y1, txt) in ((240, 760, 130, 640, "HULL 03"), (980, 760, 1100, 640, "WING"), (960, 1300, 1100, 1460, "ENGINE")):
        d.line((x0, y0, x1, y1), fill=K.rgba("#e8f4ff"), width=3); d.ellipse((x0 - 8, y0 - 8, x0 + 8, y0 + 8), outline=K.rgba("#e8f4ff"), width=3)
        t = K.text_img(txt, "Michroma-Regular.ttf", 28, "#e8f4ff", track=3); K.put(c, t, x1, y1 - 24, "mm")
    zb = char("zib", "happy", h=480)
    K.put(c, zb, 230, 1640, "mb", glow_c=("#b7ff5a", 24, 0.3))
    put_title(c, "slide-ship", W // 2, 300, 860, glow=("#b7ff5a", 20, 0.2))
    t = K.text_img("SCHEMATIC  ·  SHEET 1 OF 1  ·  REBUILD ME", "Michroma-Regular.ttf", 24, "#e8f4ff", track=3); K.put(c, t, W // 2, 560, "mm")
    tagline(c, "slide-ship", 1560, "#b7ff5a", 44, "Michroma-Regular.ttf", 2)
    brand(c)
    return K.grain(c, 6)


@poster("gloop-pipes")
def gloop_pipes(m):
    """plumbing works: big chrome pipes, slime flowing, Gloop in the tank"""
    c = K.lin(W, H, [(0, "#5ab8e8"), (1, "#1a5a8a")])
    c.alpha_composite(K.opacity(K.grid(W, H, 80, "#ffffff", 2, 40), 0.7))
    pipes = Image.new("RGBA", (W, H), (0, 0, 0, 0)); pd = ImageDraw.Draw(pipes)
    path = [(-50, 700), (300, 700), (300, 1100), (800, 1100), (800, 600), (1250, 600)]
    pd.line(path, fill=K.rgba("#3a4a5a"), width=150, joint="curve"); pd.line(path, fill=K.rgba("#c8d4e0"), width=120, joint="curve"); pd.line(path, fill=K.rgba("#9be34a"), width=60, joint="curve")
    for x, y in path[1:-1]: pd.ellipse((x - 95, y - 95, x + 95, y + 95), fill=K.rgba("#8a96a6")); pd.ellipse((x - 70, y - 70, x + 70, y + 70), fill=K.rgba("#9be34a"))
    c.alpha_composite(K.drop(pipes, (0, 20), 20, "#0a2a4a", 0.5)); c.alpha_composite(pipes)
    board = K.grade(K.cover(frame("gloop-pipes"), 560, 560, 0.42, 0.62, 1.7), 1.1)
    K.put(c, K.card_frame(board, 600, 600, 40, 20, "#ffd25a"), 830, 1360, "mm", shadow=dict(r=30, k=0.5, dy=20), rot=4)
    K.put(c, char("gloop", "happy", h=460), 290, 1650, "mb", shadow=dict(r=18, k=0.45, dy=10))
    put_title(c, "gloop-pipes", W // 2, 300, 880)
    tagline(c, "gloop-pipes", 1720, "#ffffff", 40, "BungeeInline-Regular.ttf", 2)
    brand(c, 1790 - 30)
    return K.grain(c, 6)


@poster("firefly-switch")
def firefly_switch(m):
    """night storybook: a moonlit meadow full of glowing jars and fireflies"""
    c = K.lin(W, H, [(0, "#0b0a2a"), (0.6, "#1b1a5a"), (1, "#2a2a6a")])
    c.alpha_composite(K.bokeh(W, H, 200, ["#ffffff"], 1, 2.5, 4, 0, (100, 220)))
    K.add(c, K.circle(W, H, 940, 380, 130, "#fff6d0")); c.alpha_composite(K.glow(K.circle(W, H, 940, 380, 130, "#fff6d0"), 60, "#fff6d0", 0.5))
    for y, col in ((1300, "#14143a"), (1420, "#0e0e2a")): c.alpha_composite(K.shape(W, H, K.wave_poly(W, y, 50, 1.2, y / 100), col))
    jars = K.grade(K.cover(frame("firefly-switch"), 620, 760, 0.45, 0.55, 1.45), 1.2, 1.05)
    K.put(c, K.mask_rounded(jars, 50), W // 2, 960, "mm", glow_c=("#ffe38a", 50, 0.35))
    ff = K.bokeh(W, H, 60, ["#fff2a0", "#ffe38a", "#d8ff8a"], 4, 10, 12, 0, (200, 255)); c.alpha_composite(K.glow(ff, 12, "#ffe38a", 0.9)); c.alpha_composite(ff)
    dog = char("noodle", "happy", w=640)
    K.put(c, K.tint(dog, "#1b1a5a", 0.35), W // 2 + 180, 1660, "mb", glow_c=("#ffe38a", 20, 0.25))
    put_title(c, "firefly-switch", W // 2, 270, 900, shadow=False)
    tagline(c, "firefly-switch", 1720, "#fff2c0", 46, "BowlbyOne-Regular.ttf", 2)
    brand(c, 1790 - 24)
    return K.grain(c, 7)


@poster("maze-munch")
def maze_munch(m):
    """a hedge maze seen from above, cookies on the path, Momo on the run"""
    import numpy as np
    c = K.solid(W, H, "#ffe2ec")
    n, cell = 15, 80; rng = random.Random(11)
    vis = set(); walls = {(x, y): [1, 1] for x in range(n) for y in range(n)}
    stack = [(0, 0)]; vis.add((0, 0))
    while stack:
        x, y = stack[-1]; nb = [(x + dx, y + dy, dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < n and 0 <= y + dy < n and (x + dx, y + dy) not in vis]
        if not nb: stack.pop(); continue
        nx, ny, dx, dy = rng.choice(nb)
        if dx == 1: walls[(x, y)][0] = 0
        elif dx == -1: walls[(nx, ny)][0] = 0
        elif dy == 1: walls[(x, y)][1] = 0
        else: walls[(nx, ny)][1] = 0
        vis.add((nx, ny)); stack.append((nx, ny))
    mz = Image.new("RGBA", (W, H), (0, 0, 0, 0)); md = ImageDraw.Draw(mz); ox, oy = 0, 520
    for (x, y), (r, b) in walls.items():
        px, py = ox + x * cell, oy + y * cell
        if r: md.line((px + cell, py, px + cell, py + cell), fill=K.rgba("#3f9a2a"), width=26)
        if b: md.line((px, py + cell, px + cell, py + cell), fill=K.rgba("#3f9a2a"), width=26)
    md.rectangle((ox, oy, ox + n * cell, oy + n * cell), outline=K.rgba("#3f9a2a"), width=26)
    c.alpha_composite(K.drop(mz, (0, 14), 8, "#2a5a1a", 0.5)); c.alpha_composite(mz)
    c.alpha_composite(K.opacity(K.rim(mz, "#c8ff9a", 6, -90, 0.8), 0.9))
    for k in range(10):
        x, y = ox + rng.randrange(n) * cell + cell // 2, oy + rng.randrange(n) * cell + cell // 2
        K.put(c, K.circle(60, 60, 30, 30, 22, "#c8843a"), x, y, "mm", shadow=dict(r=6, k=0.4, dy=4))
    mo = cast("momo", "happy"); mo = K.fit(mo, w=520)
    K.put(c, mo, 920, 1640, "mb", shadow=dict(r=22, k=0.45, dy=12))
    put_title(c, "maze-munch", W // 2, 270, 860)
    brand(c, H - 46, "#3f9a2a")
    return K.grain(c, 6)


# ------------------------------------------------------------------ 3D GAMES
def tall(slug, prefer=("play_tall.png", "title_tall.png")):
    for n in prefer:
        im = src(slug, n)
        if im: return im
    return K.load(os.path.join(K.WEB, "public", "games", slug, "card.webp"))


def billing(c, y, color="#d8d8e8", lines=("MOMOBLOBS PRESENTS", "A CLAY GAMES ORIGINAL  ·  MUSIC BY THE MOMOBLOBS BAND  ·  PLAY FREE IN YOUR BROWSER")):
    for k, ln in enumerate(lines):
        t = K.text_img(ln, "BebasNeue-Regular.ttf", 40 if k == 0 else 26, color, track=6 if k == 0 else 3)
        K.put(c, t, W // 2, y + k * 46, "mm")


@poster("rollo-rush")
def rollo_rush(m):
    """cinematic movie one-sheet: night shore, Rollo alone, billing block"""
    c = K.grade(K.cover(tall("rollo-rush", ("loop_tall_001_24_profile_-4.5.jpg", "run_tall_019_1_front34.jpg")), W, H, 0.5, 0.45, 1.05), 1.15, 1.08)
    c = K.fade(c, "bottom", 0.62, "#050a1e", 250); c = K.fade(c, "top", 0.72, "#050a1e", 220)
    K.add(c, K.rad(W, H, [(0, (255, 190, 120, 120)), (0.4, (0, 0, 0, 0))], 0.82, 0.32, 0.6), "screen")
    put_title(c, "rollo-rush", W // 2, 290, 820)
    t = K.text_img("LOOPS.  RAILS.  ONE ROAD THAT NEVER STOPS.", "BebasNeue-Regular.ttf", 46, "#ffe8c0", track=5); K.put(c, t, W // 2, 1500, "mm")
    billing(c, 1580)
    brand(c, H - 50)
    return K.grain(c, 8)


@poster("momo-jelly-jam")
def momo_jelly_jam(m):
    """Y2K sticker collage: candy mesh, a tilted board, die-cut stickers"""
    c = K.mesh(W, H, "#ffd6f0", [(0.1, 0.1, 0.5, "#ff9ad5"), (0.9, 0.2, 0.5, "#c8a8ff"), (0.2, 0.9, 0.6, "#8fe8ff"), (0.9, 0.85, 0.5, "#ffe58a")])
    board = K.cover(tall("momo-jelly-jam", ("title_tall.png",)), 820, 820, 0.5, 0.33, 1.9)
    K.put(c, K.card_frame(board, 860, 860, 70, 20, "#ffffff"), W // 2, 960, "mm", shadow=dict(r=30, k=0.3, dy=20), rot=-5)
    mo = K.sticker(K.fit(cast("momo", "happy"), w=520), 16)
    K.put(c, mo, 900, 1640, "mb", rot=8)
    for x, y, col, r in ((170, 620, "#ff4fb4", 14), (1050, 600, "#8e5bff", -10), (160, 1500, "#ffd21f", 20)):
        st = Image.new("RGBA", (180, 180), (0, 0, 0, 0)); ImageDraw.Draw(st).polygon(K.star_pts(90, 90, 80, 36, 5), fill=K.rgba(col))
        K.put(c, K.sticker(st, 10), x, y, "mm", rot=r)
    c.alpha_composite(K.confetti(W, H, 50, ["#ffffff", "#ff4fb4", "#8e5bff"], 6, (6, 14)))
    put_title(c, "momo-jelly-jam", W // 2, 330, 640)
    brand(c, H - 50, "#5b1a6e")
    return K.grain(c, 5)


def car_poster(slug, style):
    """the whole field racing (in-game pack shot), graded per game, with the style's overlay on top"""
    import race_art as RA
    c = RA.pack_shot(slug, "tall", W, H, 0.5, 0.52, 1.02)
    if style == "synth":
        c = K.fade(c, "top", 0.6, "#1a0638", 230)
        K.add(c, K.lin(W, H, [(0, (255, 58, 138, 0)), (0.7, (255, 58, 138, 0)), (1, (255, 58, 138, 120))]), "screen")
        c.alpha_composite(K.opacity(K.persp_grid(W, H, 0.84, "#ff4fd8", 24, 6, 3), 0.55))
    elif style == "smoke":
        c = K.fade(c, "bottom", 0.62, "#14042a", 240)
        for k in range(3): K.put(c, K.opacity(K.text_img("DRIFT", "Teko-Bold.ttf", 300, "#ff4fd8"), 0.1), W // 2, 1180 + k * 230, "mm")
        c.alpha_composite(K.bokeh(W, H, 18, ["#ff4fd8", "#ffffff"], 60, 160, 5, 40, (30, 80)))
    elif style == "siren":
        c = K.fade(c, "top", 0.62, "#06081a", 235)
        RA.siren(c, W, H, "#ff2a2a", "#2f6bff")
    else:
        c = K.fade(c, "top", 0.7, "#ffd400", 255); c = K.fade(c, "bottom", 0.62, "#111111", 200)
    RA.speed_streaks(c, W, H, ["#ffffff", RA.RACE_LOOK[slug]["a"]], 26, 3, 0.35, 0.8)
    return c, Image.new("RGBA", (W, H), (0, 0, 0, 0))


def ImageChops_mul(a, b):
    from PIL import ImageChops
    return ImageChops.multiply(a, b)


@poster("nitro-rush")
def nitro_rush(m):
    """synthwave: striped sun, neon grid, the car on a lit platform"""
    c, car = car_poster("nitro-rush", "synth")
    c.alpha_composite(car)
    put_title(c, "nitro-rush", W // 2, 300, 980)
    t = K.text_img("34 CARS  ·  29 WORLDS  ·  NITRO", "Audiowide-Regular.ttf", 46, "#5ff8ff", track=3); K.put(c, t, W // 2, 1600, "mm", glow_c=("#5ff8ff", 12, 0.5))
    brand(c, H - 50)
    return K.grain(c, 7)


@poster("drift-kings")
def drift_kings(m):
    """night street: stacked DRIFT type, neon smoke, the car centre stage"""
    c, car = car_poster("drift-kings", "smoke")
    c.alpha_composite(car)
    put_title(c, "drift-kings", W // 2, 1420, 900, glow=("#ff4fd8", 26, 0.3))
    t = K.text_img("SIDEWAYS  IS  THE  ONLY  WAY", "Teko-Bold.ttf", 64, "#ffd25a", track=6); K.put(c, t, W // 2, 140, "mm")
    brand(c, H - 46)
    return K.grain(c, 8)


@poster("highway-heat")
def highway_heat(m):
    """police chase: red / blue split, siren glow, a heat-level badge"""
    c, car = car_poster("highway-heat", "siren")
    c.alpha_composite(car)
    put_title(c, "highway-heat", W // 2, 300, 860)
    badge = K.pill("WANTED  ·  HEAT LEVEL 5", "Anton-Regular.ttf", 54, "#ffffff", "#d0141e", outline="#ffffff", ow=6)
    K.put(c, badge, W // 2, 1560, "mm", rot=-4, shadow=dict(r=14, k=0.5, dy=10))
    brand(c, H - 46)
    return K.grain(c, 8)


@poster("moto-rush")
def moto_rush(m):
    """sports magazine cover: masthead, the bike, cover lines, barcode"""
    c, bike = car_poster("moto-rush", "mag")
    c.alpha_composite(bike)
    put_title(c, "moto-rush", W // 2, 230, 1080)
    for k, (txt, col, s) in enumerate((("32 BIKES", "#ffffff", 92), ("27 CIRCUITS", "#ffd400", 70), ("WHEELIES!", "#ffffff", 70))):
        t = K.text_img(txt, "Orbitron-Black.ttf", s, col); K.put(c, t, 70, 1260 + k * 100, "lm")
    iss = K.pill("ISSUE 01", "Orbitron-Black.ttf", 34, "#ffd400", "#111111"); K.put(c, iss, 1130, 520, "rm")
    bc = Image.new("RGBA", (220, 130), K.rgba("#ffffff")); bd = ImageDraw.Draw(bc); rng = random.Random(1)
    x = 12
    while x < 208: w_ = rng.choice((2, 3, 5)); bd.rectangle((x, 12, x + w_, 100), fill=K.rgba("#111111")); x += w_ + rng.choice((2, 3, 4))
    K.put(c, bc, 1120, 1640, "rb")
    brand(c, H - 46, "#ffffff")
    return K.grain(c, 6)


@poster("blob-brigade")
def blob_brigade(m):
    """recruitment poster: constructivist rays and the army marching out"""
    c = K.rays(W, H, 0.5, 0.95, 22, "#f2e2c4", "#e8d0a8", 0.0)
    c.alpha_composite(K.shape(W, H, [(0, 0), (W, 0), (W, 520), (0, 640)], "#c8281e"))
    momo = K.trim(cast("momo", "happy")); rng = random.Random(5)
    for y, s, n in ((900, 0.08, 9), (980, 0.1, 8), (1080, 0.13, 7), (1210, 0.17, 6), (1380, 0.23, 5), (1620, 0.32, 4)):
        span = W * (0.35 + s * 2.2)
        for i in range(n):
            im = K.fit(momo, h=int(H * s)); x = W / 2 + (i - (n - 1) / 2) * span / n + rng.uniform(-10, 10)
            K.put(c, im, int(x), y, "mb", shadow=dict(r=8, k=0.35, dy=6))
    t = K.text_img("JOIN THE BRIGADE!", "BebasNeue-Regular.ttf", 120, "#ffffff", track=8); K.put(c, t, W // 2, 560, "mm", rot=-5)
    put_title(c, "blob-brigade", W // 2, 270, 900)
    for x, y in ((120, 760), (1080, 740)):
        st = Image.new("RGBA", (160, 160), (0, 0, 0, 0)); ImageDraw.Draw(st).polygon(K.star_pts(80, 80, 76, 32), fill=K.rgba("#ffd21f")); K.put(c, st, x, y, "mm", shadow=dict(r=8, k=0.3, dy=6))
    brand(c, H - 46, "#3a1a0a")
    return K.grain(c, 9)


@poster("momo-boing")
def momo_boing(m):
    """up, up, up: a night sky tower and Momo mid-bounce"""
    c = K.grade(K.cover(tall("momo-boing", ("title_tall.png",)), W, H, 0.5, 0.5, 1.05), 1.15, 1.05)
    c = K.fade(c, "top", 0.6, "#120624", 230)
    arcs = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(arcs)
    for k, col in enumerate(("#ff8ad8", "#8af0ff", "#ffe07a")):
        d.arc((150 - k * 30, 900 + k * 30, 1050 + k * 30, 1900 + k * 30), 190, 350, fill=K.rgba(col, 220), width=14)
    c.alpha_composite(K.glow(arcs, 12, "#ffffff", 0.5)); c.alpha_composite(arcs)
    K.put(c, K.fit(cast("momo", "happy"), w=640), 700, 1300, "mm", glow_c=("#ffe07a", 30, 0.25), rot=-8)
    put_title(c, "momo-boing", W // 2, 330, 860)
    brand(c, H - 46)
    return K.grain(c, 6)


@poster("momo-dash")
def momo_dash(m):
    """street poster: halftone sunset pier, torn paper band, a sticker Momo"""
    c = K.grade(K.cover(tall("momo-dash", ("title_tall.png",)), W, H, 0.5, 0.5, 1.05), 1.2, 1.08)
    c.alpha_composite(K.halftone(W, H, 24, "#ff3d8a", lambda x, y: max(0, 0.6 - y) * 0.7, 20))
    rng = random.Random(3)
    band = [(0, 1180)] + [(x, 1180 + rng.uniform(-18, 18)) for x in range(0, W + 40, 40)] + [(W, 1180)]
    band = band + [(W, 1560)] + [(x, 1560 + rng.uniform(-18, 18)) for x in range(W, -40, -40)] + [(0, 1560)]
    paper = K.shape(W, H, band, "#fff4e2"); c.alpha_composite(K.drop(paper, (0, 10), 14, "#000000", 0.4)); c.alpha_composite(paper)
    put_title(c, "momo-dash", W // 2, 1360, 820, rot=-4)
    K.put(c, K.sticker(K.fit(cast("momo", "happy"), w=480), 16), 900, 1040, "mm", rot=10)
    t = K.text_img("RUN · SWIPE · SQUISH", "Knewave-Regular.ttf", 70, "#ffffff", stroke=6, stroke_fill="#1a0a3a"); K.put(c, t, W // 2, 180, "mm", rot=-3)
    brand(c, H - 60, "#ffffff", dark=True)
    return K.grain(c, 7)


@poster("kiko-jungle-quest")
def kiko_jungle_quest(m):
    """adventure film poster: the jungle road framed by big leaves"""
    c = K.grade(K.cover(tall("kiko-jungle-quest", ("title_tall.png",)), W, H, 0.5, 0.5, 1.15), 1.2, 1.08)
    c = K.fade(c, "bottom", 0.55, "#0a1a06", 245)
    K.add(c, K.rad(W, H, [(0, (255, 230, 150, 120)), (0.4, (0, 0, 0, 0))], 0.5, 0.15, 0.6), "screen")
    rng = random.Random(2)
    for x, y, rot, s in ((-40, 120, 30, 1.0), (1240, 200, 150, 1.1), (-60, 1000, -20, 1.2), (1260, 1100, 200, 1.0), (100, -60, 70, 0.8), (1100, -40, 110, 0.9)):
        lf = Image.new("RGBA", (700, 300), (0, 0, 0, 0)); ld = ImageDraw.Draw(lf)
        pts = [(20 + t * 660, 150 - 130 * (1 - abs(2 * t - 1)) ** 0.7) for t in [i / 20 for i in range(21)]] + [(20 + t * 660, 150 + 130 * (1 - abs(2 * t - 1)) ** 0.7) for t in [i / 20 for i in range(20, -1, -1)]]
        ld.polygon(pts, fill=K.rgba(K.mixc("#1f6a1a", "#3fae2a", rng.random()))); ld.line((20, 150, 680, 150), fill=K.rgba("#123a0e"), width=8)
        lf = K.fit(lf, w=int(700 * s))
        K.put(c, lf, x, y, "mm", rot=rot, shadow=dict(r=20, k=0.5, dy=12))
    put_title(c, "kiko-jungle-quest", W // 2, 1280, 880)
    billing(c, 1570, "#e8f0c8", ("300 PLACES  ·  15 REGIONS  ·  ONE BIG FRUIT TREE", "RUN · SWING · MUNCH  ·  PLAY FREE ON ANY DEVICE"))
    brand(c, H - 46)
    return K.grain(c, 7)


@poster("puddo-clayland")
def puddo_clayland(m):
    """storybook page: an arched window into Clayland, Puddo in front, raindrops"""
    c = K.grain(K.solid(W, H, "#fbf0dc"), 12)
    win = K.cover(tall("puddo-clayland"), 900, 1000, 0.5, 0.55, 1.1)
    mask = Image.new("L", (900, 1000), 0); md = ImageDraw.Draw(mask); md.rectangle((0, 450, 900, 1000), fill=255); md.ellipse((0, 0, 900, 900), fill=255)
    win.putalpha(mask)
    frame_ = Image.new("RGBA", (960, 1060), (0, 0, 0, 0)); fd = ImageDraw.Draw(frame_); fd.rectangle((0, 480, 960, 1060), fill=K.rgba("#c8642a")); fd.ellipse((0, 0, 960, 960), fill=K.rgba("#c8642a"))
    frame_.alpha_composite(win, (30, 30))
    K.put(c, frame_, W // 2, 1080, "mm", shadow=dict(r=30, k=0.35, dy=20))
    for x, y, s in ((140, 620, 60), (1060, 700, 48), (180, 1500, 40), (1040, 1580, 56)):
        d = Image.new("RGBA", (s * 2, s * 3), (0, 0, 0, 0)); ImageDraw.Draw(d).ellipse((0, s, s * 2, s * 3), fill=K.rgba("#4fb8ff")); ImageDraw.Draw(d).polygon([(s * 0.1, s * 1.6), (s, 0), (s * 1.9, s * 1.6)], fill=K.rgba("#4fb8ff"))
        K.put(c, d, x, y, "mm", shadow=dict(r=8, k=0.25, dy=6))
    pu = src("puddo-clayland", "hero.png")
    if pu: K.put(c, K.fit(K.trim(pu), h=620), 920, 1700, "mb", shadow=dict(r=20, k=0.4, dy=12))
    put_title(c, "puddo-clayland", W // 2, 260, 960)
    brand(c, H - 46, "#7a3a12")
    return c


@poster("slurp-lab")
def slurp_lab(m):
    """liquid mesh gradient and a glass card holding the lab tray"""
    c = K.mesh(W, H, "#2a0e5a", [(0.15, 0.2, 0.55, "#7a3aff"), (0.85, 0.3, 0.5, "#3a8aff"), (0.3, 0.85, 0.6, "#7aff3a"), (0.85, 0.9, 0.5, "#ff5ad8")], 1.2)
    tray = K.cover(tall("slurp-lab"), 820, 1080, 0.5, 0.5, 1.15)
    glass = Image.new("RGBA", (900, 1160), (0, 0, 0, 0)); gd = ImageDraw.Draw(glass)
    gd.rounded_rectangle((0, 0, 899, 1159), 70, fill=(255, 255, 255, 60), outline=(255, 255, 255, 160), width=4)
    glass.alpha_composite(K.mask_rounded(tray, 50), (40, 40))
    K.put(c, glass, W // 2, 1010, "mm", shadow=dict(r=40, k=0.4, dy=24))
    c.alpha_composite(K.bokeh(W, H, 34, ["#ffffff", "#b8ffb0", "#e0c8ff"], 10, 34, 9, 2, (80, 180)))
    put_title(c, "slurp-lab", W // 2, 250, 760, glow=("#7aff3a", 26, 0.25))
    tagline(c, "slurp-lab", 1660, "#eaffd0", 40, "Righteous-Regular.ttf", 2)
    brand(c, H - 46)
    return K.grain(c, 5)


@poster("tondu-vine-climb")
def tondu_vine_climb(m):
    """botanical: the green canopy, the vine, and Tondu clinging in front"""
    c = K.grade(K.cover(tall("tondu-vine-climb", ("title_tall.png",)), W, H, 0.5, 0.5, 1.05), 1.18, 1.05)
    c = K.fade(c, "top", 0.62, "#0a2a0a", 220); c = K.fade(c, "bottom", 0.7, "#0a2a0a", 200)
    td = src("tondu-vine-climb", "hero.png")
    if td: K.put(c, K.fit(K.trim(td), w=980), W // 2 + 60, 1250, "mm", shadow=dict(r=26, k=0.45, dy=16), rot=-18)
    put_title(c, "tondu-vine-climb", W // 2, 300, 820)
    tagline(c, "tondu-vine-climb", 1660, "#e8ffc8", 40, "Gluten-Black.ttf", 1)
    brand(c, H - 46)
    return K.grain(c, 6)


@poster("sky-roll")
def sky_roll(m):
    """dreamy holographic sky: pastel path into floating islands"""
    c = K.grade(K.cover(tall("sky-roll", ("title_tall.png",)), W, H, 0.5, 0.55, 1.05), 1.1, 1.0, 1.05)
    holo = K.mesh(W, H, "#ffe0f4", [(0.1, 0.1, 0.5, "#c8e8ff"), (0.9, 0.2, 0.5, "#ffd0f0"), (0.5, 0.0, 0.5, "#e8d0ff")])
    K.add(c, holo, "soft", 0.9)
    c = K.fade(c, "top", 0.55, "#ffe8f8", 200)
    c.alpha_composite(K.bokeh(W, H, 40, ["#ffffff", "#ffd6f0", "#c8f0ff"], 4, 14, 3, 0, (150, 255)))
    K.put(c, K.sticker(K.fit(cast("momo", "happy"), w=420), 14, "#ffffff"), 980, 1660, "mb", rot=8)
    put_title(c, "sky-roll", W // 2, 300, 900)
    tagline(c, "sky-roll", 1560, "#7a3a9a", 42, "Unbounded-Black.ttf", 1, text="ROLL TO THE BEAT")
    brand(c, 1790 - 20, "#7a3a9a")
    return K.grain(c, 4)


@poster("momo-escape")
def momo_escape(m):
    """heist thriller: a dark maze from above, red lasers, hazard tape"""
    c = K.gradmap(K.cover(tall("momo-escape", ("title_tall.png",)), W, H, 0.5, 0.5, 1.2), [(0, "#06030c"), (0.55, "#2a1240"), (1, "#c88ab0")])
    lasers = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lasers)
    for y0, y1 in ((520, 700), (980, 860), (1300, 1420)): d.line((0, y0, W, y1), fill=K.rgba("#ff2b5c"), width=6)
    c.alpha_composite(K.glow(lasers, 14, "#ff2b5c", 0.9)); c.alpha_composite(lasers)
    for y, ang in ((0, -6), (H - 140, 6)):
        tape = K.stripes(W + 200, 120, 60, 45, ["#ffd21f", "#141414"]); K.put(c, tape, W // 2, y + 70, "mm", rot=ang, shadow=dict(r=12, k=0.5, dy=8))
    K.put(c, K.fit(cast("momo", "wow"), w=620), W // 2 + 120, 1500, "mb", shadow=dict(r=24, k=0.6, dy=12), rot=-6)
    put_title(c, "momo-escape", W // 2, 380, 940, glow=("#ff2b5c", 26, 0.25))
    t = K.text_img("EVERY FLOOR. EVERY TRAP. NO WAY OUT?", "BlackOpsOne-Regular.ttf", 44, "#ffffff", track=2); K.put(c, t, W // 2, 640, "mm")
    brand(c, H - 230)
    return K.grain(c, 9)


@poster("momo-shuffle")
def momo_shuffle(m):
    """vintage magic show bill: red and gold sunburst, a bulb-lit stage"""
    c = K.rays(W, H, 0.5, 0.55, 30, "#a0101e", "#c8202e", 0.0)
    K.add(c, K.rad(W, H, [(0, (255, 210, 90, 160)), (0.45, (0, 0, 0, 0))], 0.5, 0.55, 0.7), "screen")
    stage = K.cover(tall("momo-shuffle", ("title_tall.png",)), 860, 860, 0.5, 0.7, 1.25)
    st = K.mask_circle(stage)
    ring = K.circle(980, 980, 490, 490, 488, "#ffd25a"); ring.alpha_composite(K.circle(980, 980, 490, 490, 460, "#7a0a14")); ring.alpha_composite(st, (60, 60))
    bulbs = Image.new("RGBA", (980, 980), (0, 0, 0, 0)); bd = ImageDraw.Draw(bulbs)
    import math as _m
    for k in range(28):
        a = k / 28 * 2 * _m.pi; x, y = 490 + 474 * _m.cos(a), 490 + 474 * _m.sin(a); bd.ellipse((x - 13, y - 13, x + 13, y + 13), fill=K.rgba("#fff6c8"))
    ring.alpha_composite(K.glow(bulbs, 10, "#ffd25a", 0.9)); ring.alpha_composite(bulbs)
    K.put(c, ring, W // 2, 1050, "mm", shadow=dict(r=34, k=0.5, dy=20))
    put_title(c, "momo-shuffle", W // 2, 300, 900)
    t = K.text_img("THE GREATEST CUP TRICK ON EARTH", "Ultra-Regular.ttf", 46, "#ffe8a0"); K.put(c, t, W // 2, 1620, "mm", shadow=dict(r=6, k=0.6, dy=4))
    brand(c, H - 46)
    return K.grain(c, 9)


# ------------------------------------------------------------------ CLI
def main():
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    for slug, fn in POSTERS.items():
        if only and slug not in only: continue
        if not os.path.exists(os.path.join(K.TITLES, f"{slug}.png")): print("no title yet:", slug); continue
        img = fn(meta(slug)).convert("RGB")
        png, webp = out_paths(slug)
        os.makedirs(os.path.dirname(png), exist_ok=True)
        img.save(png)
        K.save(img, webp, w=1000, q=86)
        print("poster", slug, flush=True)


if __name__ == "__main__":
    main()
