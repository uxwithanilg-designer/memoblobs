"""Game-card thumbnails (16:9), one design per game: the 3D title, a big character or hero shot, the game's own scene.

python scripts/art/thumbs.py [slug ...]
  -> scripts/art/out/thumbs/<slug>.png (1600x900)
  -> public/games/<slug>/cover.webp (1280x720, the card art) and og.jpg (1200x630, link previews)
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit as K  # noqa: E402
from assets import cast, frame, meta, no_floor, src, title  # noqa: E402
import race_art as RA  # noqa: E402

W, H = 1600, 900


def T(slug, w=None, h=None):
    return K.fit(title(slug), w=w, h=h)


def ttl(c, slug, x, y, w, h=None, anchor="mm", rot=0, glow=None, k=0.55):
    t = T(slug, w, h or int(H * 0.62))
    return K.put(c, t, x, y, anchor, shadow=dict(r=24, k=k, dy=16), rot=rot, glow_c=glow)


def ch(name, expr="happy", h=None, w=None, floor=False):
    im = cast(name, expr)
    if not floor: im = no_floor(im)
    return K.fit(im, w=w, h=h) if (w or h) else im


def hero(slug):
    p = src(slug, "hero.png")
    return K.trim(p) if p else None


def scene(slug, prefer=("play_wide.png", "title_wide.png")):
    for n in prefer:
        im = src(slug, n)
        if im: return im
    return K.load(os.path.join(K.WEB, "public", "games", slug, "card.webp"))


def side_fade(c, color, side="l", reach=0.62, k=235):
    ang = 0 if side == "l" else 180
    g = K.lin(W, H, [(0, K.rgba(color, k)), (reach * 0.55, K.rgba(color, int(k * 0.8))), (reach, K.rgba(color, 0)), (1, K.rgba(color, 0))], ang)
    c.alpha_composite(g)


# ------------------------------------------------------------------ layouts
def lay_side(slug, f, crop, side, panel, char_im, char_x, char_h, extras=None, blur=0, grade=(1.15, 1.06, 1.0), title_w=760, title_y=0.5):
    """gameplay full-bleed, a colour fade on the title side, a big character on the other side"""
    bg = K.cover(f, W, H, *crop)
    if blur: bg = K.blur(bg, blur)
    c = K.grade(bg, *grade)
    side_fade(c, panel, side)
    if extras: extras(c)
    if char_im is not None:
        im = K.fit(char_im, w=int(W * 0.5), h=int(H * char_h))
        K.put(c, im, int(W * char_x), H + int(H * 0.03), "mb", shadow=dict(r=26, k=0.5, dy=10))
        K.put(c, K.rim(K.with_pad(im, 10), "#ffffff", 7, -40 if side == "l" else -140, 0.55), int(W * char_x), H + int(H * 0.03) + 10, "mb")
    tx = int(W * 0.27) if side == "l" else int(W * 0.73)
    ttl(c, slug, tx, int(H * title_y), title_w)
    return K.grain(K.vignette(c, 0.35), 5)


def lay_card(slug, bg, card_img, card_box, rot, char_im, char_xy, char_h, title_xy, title_w, border="#ffffff", r=40, extras=None, card_glow=None):
    """designed background, the gameplay as a tilted card, the character and the title"""
    c = bg
    cw, chh, cx, cy = card_box
    card = K.card_frame(card_img, cw, chh, r, 14, border)
    K.put(c, card, cx, cy, "mm", shadow=dict(r=34, k=0.45, dy=22), rot=rot, glow_c=(card_glow, 30, 0.35) if card_glow else None)
    if extras: extras(c)
    if char_im is not None:
        im = K.fit(char_im, w=int(W * 0.42), h=int(H * char_h))
        K.put(c, im, *char_xy, "mb", shadow=dict(r=22, k=0.45, dy=10))
    ttl(c, slug, *title_xy, title_w)
    return K.grain(c, 5)


def lay_scene(slug, sc, crop, title_xy, title_w, fade=("#000000", "l", 0.6, 200), hero_im=None, hero_xy=None, hero_h=0.9, grade=(1.18, 1.08, 1.02), extras=None, glow=None, vig=0.4):
    """a 3D game's own scene, graded, with the title over a soft fade"""
    c = K.grade(K.cover(sc, W, H, *crop), *grade)
    if fade: side_fade(c, fade[0], fade[1], fade[2], fade[3])
    if extras: extras(c)
    if hero_im is not None:
        im = K.fit(hero_im, w=int(W * 0.55), h=int(H * hero_h))
        K.put(c, im, *hero_xy, "mb", shadow=dict(r=26, k=0.5, dy=12))
    ttl(c, slug, *title_xy, title_w, glow=glow)
    return K.grain(K.vignette(c, vig), 5)


# ------------------------------------------------------------------ per-game designs
def bg_rays(c1, c2, cx=0.68, cy=0.55, n=26, glow="#ffffff"):
    c = K.rays(W, H, cx, cy, n, c1, c2, 0.05)
    K.add(c, K.rad(W, H, [(0, K.rgba(glow, 150)), (0.5, K.rgba(glow, 0))], cx, cy, 0.7))
    return c


def bg_mesh(base, cols):
    pts = [(0.1, 0.2), (0.85, 0.15), (0.3, 0.95), (0.95, 0.85), (0.55, 0.5)]
    return K.mesh(W, H, base, [(x, y, 0.45, c) for (x, y), c in zip(pts, cols)])


def D(slug):
    """returns the thumbnail for one game"""
    g = meta(slug)
    f = frame(slug) if g["arcade"] else None
    A = {
        # ---------------- focus
        "fish-watch": lambda: lay_card(slug, K.grain(K.lin(W, H, [(0, "#bff2ff"), (1, "#1f6fc0")]), 4), K.cover(f, 760, 600, 0.29, 0.6, 1.7), (800, 640, 1150, 470), 4,
                                        ch("pip", "wow"), (190, H + 20), 0.5, (400, 250), 640, "#ffd25a", 60,
                                        extras=lambda c: c.alpha_composite(K.bokeh(W, H, 30, ["#ffffff"], 6, 22, 3, 1, (100, 220)))),
        "spot-the-sneak": lambda: sneak(slug, f),
        "color-clash": lambda: clash(slug),
        "blink-change": lambda: blink_t(slug),
        "where-is-zib": lambda: lay_side(slug, f, (0.5, 0.45, 1.2), "l", "#1a0a3a", ch("zib", "wow"), 0.8, 0.95, title_w=720,
                                          extras=lambda c: K.add(c, K.rad(W, H, [(0, (183, 255, 90, 110)), (0.4, (0, 0, 0, 0))], 0.8, 0.6, 0.5), "screen")),
        "shadow-match": lambda: shadow_t(slug, f),
        "gloop-guard": lambda: lay_side(slug, f, (0.5, 0.55, 1.25), "l", "#140820", ch("gloop", "happy"), 0.86, 0.55, title_w=760),
        # ---------------- memory
        "memory-bridge": lambda: lay_side(slug, f, (0.5, 0.55, 1.1), "l", "#0b4a4a", K.trim(cast("tiki", "happy")), 0.82, 0.62, title_w=720),
        "pips-pantry": lambda: lay_card(slug, gingham("#2e3f78"), K.cover(f, 760, 520, 0.42, 0.42, 1.15), (820, 580, 1110, 440), -4,
                                         ch("pip", "happy"), (270, H + 20), 0.7, (420, 260), 660, "#e8504f", 40),
        "bolt-beeps": lambda: lay_side(slug, f, (0.62, 0.5, 1.3), "l", "#04181a", ch("bolt", "happy"), 0.86, 0.72, title_w=640),
        "order-up": lambda: lay_card(slug, K.stripes(W, H, 80, 0, ["#ff6f91", "#ffe0ea"]), K.cover(f, 760, 520, 0.33, 0.33, 1.5), (800, 560, 1130, 470), 3,
                                      ch("bonbon", "happy"), (190, H + 20), 0.5, (420, 270), 660, "#5ae0c8", 40),
        "grid-glow": lambda: lay_side(slug, f, (0.6, 0.5, 1.15), "l", "#07040f", ch("bolt", "wow"), 0.12, 0.42, title_w=700),
        "who-said-it": lambda: lay_side(slug, f, (0.5, 0.42, 1.2), "r", "#2a0a4a", ch("gloop", "wow"), 0.14, 0.62, title_w=700),
        "whats-missing": lambda: lay_side(slug, f, (0.45, 0.45, 1.15), "l", "#3a0a0a", K.trim(cast("kranky", "laugh")), 0.82, 0.62, title_w=740),
        # ---------------- brain
        "pick-the-door": lambda: lay_side(slug, f, (0.6, 0.66, 1.25), "l", "#3a0a2a", None, 0, 0, title_w=760,
                                           extras=lambda c: K.put(c, K.fit(cast("kranky", "laugh"), w=520), 1360, 330, "mm", shadow=dict(r=20, k=0.5, dy=10))),
        "pattern-parade": lambda: lay_side(slug, f, (0.5, 0.45, 1.1), "r", "#2a1a6a", ch("hoot", "happy"), 0.13, 0.66, title_w=720),
        "odd-blob-out": lambda: oddblob(slug),
        "balance-buddies": lambda: lay_side(slug, f, (0.5, 0.55, 1.15), "l", "#3a1e0a", ch("hoot", "happy"), 0.86, 0.6, title_w=760),
        # ---------------- reflex
        "whack-a-gloop": lambda: whack_t(slug),
        "turbo-dash": lambda: lay_side(slug, f, (0.45, 0.55, 1.1), "l", "#0b1a4a", ch("turbo", "happy"), 0.76, 0.86, title_w=700,
                                        extras=speedlines),
        "bake-drop": lambda: lay_card(slug, bg_mesh("#ffe8f0", ["#ffc8dc", "#fff0c8", "#ffd8e8", "#ffb0c8", "#ffffff"]), K.cover(f, 700, 560, 0.42, 0.6, 1.25), (760, 600, 1150, 460), 4,
                                       ch("bonbon", "wow"), (300, H + 20), 0.72, (420, 250), 680, "#ff7ab8", 50,
                                       extras=lambda c: c.alpha_composite(K.confetti(W, H, 70, ["#ff3a5a", "#2ec4b6", "#ffd21f", "#7a5aff", "#ffffff"], 3, (6, 13)))),
        "quick-hoot": lambda: lay_side(slug, f, (0.6, 0.6, 1.2), "l", "#5a1e0a", ch("hoot", "happy"), 0.82, 0.7, title_w=720),
        # ---------------- numbers
        "count-fast": lambda: lay_card(slug, numbers_bg(), K.cover(f, 760, 520, 0.36, 0.5, 1.4), (800, 560, 1140, 450), -3,
                                        K.trim(cast("momo", "happy")), (330, H + 40), 0.62, (430, 270), 700, "#111111", 36),
        "sum-slices": lambda: lay_card(slug, gingham("#d8281e"), K.cover(f, 620, 620, 0.62, 0.55, 1.45), (640, 640, 1150, 450), 0,
                                        ch("bonbon", "happy"), (300, H + 20), 0.7, (420, 260), 700, "#ffffff", 320),
        "number-ninja": lambda: ninja_t(slug, f),
        "more-or-less": lambda: lay_card(slug, bg_mesh("#f8e8ff", ["#ffd0e8", "#d8c8ff", "#ffe8c8", "#c8f0ff", "#ffffff"]), K.cover(f, 760, 560, 0.6, 0.75, 1.55), (800, 600, 1140, 450), -3,
                                          ch("turbo", "wow"), (300, H + 20), 0.6, (420, 270), 660, "#ffffff", 46),
        # ---------------- puzzle
        "slide-ship": lambda: lay_side(slug, f, (0.45, 0.5, 1.2), "l", "#0a0a2a", ch("zib", "happy"), 0.86, 0.66, title_w=720),
        "gloop-pipes": lambda: lay_side(slug, f, (0.42, 0.6, 1.2), "r", "#0a2a4a", ch("gloop", "happy"), 0.14, 0.62, title_w=700),
        "firefly-switch": lambda: lay_side(slug, f, (0.45, 0.55, 1.15), "l", "#0b0a2a", ch("noodle", "happy"), 0.76, 0.5, title_w=760,
                                            extras=lambda c: (lambda ff: (c.alpha_composite(K.glow(ff, 10, "#ffe38a", 0.9)), c.alpha_composite(ff)))(K.bokeh(W, H, 40, ["#fff2a0", "#ffe38a"], 3, 8, 12, 0, (200, 255)))),
        "maze-munch": lambda: lay_side(slug, f, (0.5, 0.55, 1.05), "l", "#3f1a2a", K.trim(cast("momo", "happy")), 0.82, 0.6, title_w=720),
        # ---------------- 3D games
        "rollo-rush": lambda: lay_scene(slug, scene(slug, ("loop_wide_001_24_profile_-4.5.jpg", "run_wide_019_4_close.jpg")), (0.62, 0.45, 1.18), (1230, 430), 600, ("#060a26", "r", 0.48, 200)),
        "momo-jelly-jam": lambda: jelly_t(slug),
        "nitro-rush": lambda: race_t(slug),
        "drift-kings": lambda: race_t(slug),
        "highway-heat": lambda: race_t(slug),
        "moto-rush": lambda: race_t(slug),
        "blob-brigade": lambda: brigade_t(slug),
        "momo-boing": lambda: lay_scene(slug, scene(slug), (0.6, 0.5, 1.05), (430, 330), 680, ("#2a0a3a", "l", 0.55, 170), K.trim(cast("momo", "happy")), (1250, 760), 0.62,
                                        extras=lambda c: boing_arcs(c)),
        "momo-dash": lambda: lay_scene(slug, scene(slug), (0.62, 0.55, 1.05), (430, 330), 680, ("#1a0a3a", "l", 0.55, 170), K.trim(cast("momo", "happy")), (1230, H + 60), 0.78, extras=speedlines),
        "kiko-jungle-quest": lambda: lay_scene(slug, scene(slug), (0.5, 0.55, 1.05), (450, 350), 740, ("#0f2a0a", "l", 0.6, 190), hero(slug) or K.trim(K.load(os.path.join(K.WEB, "public", "games", "kiko-jungle-quest", "kiko.webp"))), (1250, H + 30), 0.8),
        "puddo-clayland": lambda: lay_scene(slug, scene(slug), (0.5, 0.5, 1.0), (450, 300), 760, ("#3a1a08", "l", 0.55, 150), hero(slug), (1320, H + 10), 0.78),
        "slurp-lab": lambda: lay_scene(slug, scene(slug), (0.62, 0.5, 1.0), (420, 330), 660, ("#1a0a4a", "l", 0.6, 200), glow=("#7aff3a", 26, 0.2)),
        "tondu-vine-climb": lambda: lay_scene(slug, scene(slug), (0.5, 0.5, 1.0), (440, 370), 700, ("#0a2a0a", "l", 0.58, 190), hero(slug), (1220, 820), 0.8),
        "sky-roll": lambda: lay_scene(slug, scene(slug, ("title_wide.png",)), (0.5, 0.6, 1.05), (800, 230), 900, None, K.trim(cast("momo", "happy")), (1380, H + 30), 0.5),
        "momo-escape": lambda: escape_t(slug),
        "momo-shuffle": lambda: lay_scene(slug, scene(slug, ("title_wide.png",)), (0.62, 0.62, 1.15), (440, 330), 700, ("#3a0a1a", "l", 0.55, 200)),
    }
    return A[slug]()


# ------------------------------------------------------------------ bespoke pieces
def boing_arcs(c):
    a = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(a)
    for k, col in enumerate(("#ff8ad8", "#8af0ff", "#ffe07a")):
        d.arc((980 - k * 40, 140 + k * 30, 1520 + k * 40, 980 + k * 30), 200, 340, fill=K.rgba(col, 200), width=10)
    c.alpha_composite(K.glow(a, 10, "#ffffff", 0.5)); c.alpha_composite(a)


def brigade_t(slug):
    """the blob army marching at you down the road"""
    sc = scene(slug, ("title_wide.png",))
    c = K.grade(K.blur(K.cover(sc, W, H, 0.5, 0.5, 1.1), 3), 1.2, 1.0, 0.9)
    K.add(c, K.lin(W, H, [(0, (13, 26, 58, 120)), (1, (13, 26, 58, 0))]))
    momo = K.trim(cast("momo", "happy")); rng = random.Random(5)
    rows = [(330, 0.09, 11), (395, 0.12, 10), (475, 0.16, 9), (580, 0.22, 8), (720, 0.3, 7), (900, 0.42, 5)]
    for y, sc_, n in rows:
        span = 700 * (0.4 + sc_ * 2)
        for i in range(n):
            x = 1100 + (i - (n - 1) / 2) * span / n + rng.uniform(-12, 12)
            im = K.fit(momo, h=int(H * sc_))
            if rng.random() < 0.3: im = K.tint(im, "#3d8bff", 0.35)
            K.put(c, im, int(x), y + 40, "mb", shadow=dict(r=8, k=0.35, dy=6))
    side_fade(c, "#0d1a3a", "l", 0.55, 225)
    ttl(c, slug, 400, 440, 720)
    return K.grain(K.vignette(c, 0.35), 5)


def gingham(col):
    c = K.solid(W, H, "#ffffff")
    K.add(c, K.stripes(W, H, 60, 0, [col, "#ffffff"]), "normal", 0.45); K.add(c, K.stripes(W, H, 60, 90, [col, "#ffffff"]), "multiply", 0.5)
    return c


def numbers_bg():
    c = K.solid(W, H, "#fff6e0"); rng = random.Random(3)
    cols = ["#ffb000", "#ff6f91", "#2459e0", "#21a85a", "#9b5de5", "#e8323a"]
    for i in range(14):
        t = K.text_img(str(rng.randint(1, 9)), "Rowdies-Bold.ttf", rng.randint(160, 320), rng.choice(cols))
        K.put(c, K.opacity(t, 0.25), rng.uniform(0, W), rng.uniform(0, H), "mm", rot=rng.uniform(-25, 25))
    return c


def speedlines(c):
    s = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(s); rng = random.Random(4)
    for _ in range(40):
        y = rng.uniform(0, H); x = rng.uniform(-200, W); ln = rng.uniform(120, 380)
        d.line((x, y, x + ln, y), fill=K.rgba(rng.choice(["#ffffff", "#ffd25a"]), rng.randint(50, 140)), width=rng.randint(2, 6))
    c.alpha_composite(s)


def sneak(slug, f):
    c = K.solid(W, H, "#2a0a4a")
    g = ch("gloop", "happy", w=170); odd = K.tint(ch("gloop", "wow", w=170), "#c86aff", 0.55); rng = random.Random(4)
    spot = None
    for j, y in enumerate(range(130, H + 100, 160)):
        for i, x in enumerate(range(60 + (j % 2) * 95, W + 100, 190)):
            im = odd if (i, j) == (6, 2) else g
            K.put(c, im.rotate(rng.uniform(-8, 8), resample=Image.BICUBIC, expand=True), x, y, "mm", shadow=dict(r=8, k=0.4, dy=6))
            if (i, j) == (6, 2): spot = (x, y)
    side_fade(c, "#1a0030", "l", 0.62, 245)
    ring = K.circle(W, H, spot[0], spot[1], 115, None, outline="#ffe24a", width=14); c.alpha_composite(K.glow(ring, 14, "#ffe24a", 0.9)); c.alpha_composite(ring)
    ttl(c, slug, 400, 450, 700)
    return K.grain(c, 5)


def clash(slug):
    c = K.solid(W, H, "#f4efe4"); d = ImageDraw.Draw(c)
    ink = ["#e8323a", "#2459e0", "#ffb800", "#21a85a", "#ff5fa8", "#8e3ae8"]
    words = ["BLUE", "RED", "GREEN", "PINK", "YELLOW", "PURPLE"]
    for i, wd in enumerate(words):
        x, y = 840 + (i % 2) * 380, 60 + (i // 2) * 270
        d.rounded_rectangle((x, y, x + 350, y + 240), 30, fill=K.rgba("#ffffff"))
        t = K.fit(K.text_img(wd, "RubikMonoOne-Regular.ttf", 90, ink[i]), w=300, h=150); K.put(c, t, x + 175, y + 120, "mm")
    d.rectangle((0, 0, 800, H), fill=K.rgba("#2459e0"))
    c.alpha_composite(K.mask_poly(K.opacity(K.dots_grid(W, H, 40, 4, "#ffffff"), 0.2), [(0, 0), (800, 0), (800, H), (0, H)]))
    K.put(c, ch("hoot", "happy", h=420), 1560, H + 20, "rb", shadow=dict(r=18, k=0.4, dy=10))
    ttl(c, slug, 400, 450, 700)
    return K.grain(c, 5)


def blink_t(slug):
    c = K.lin(W, H, [(0, "#ffe9cc"), (1, "#ffb98a")], 0)
    c.alpha_composite(K.opacity(K.rays(W, H, 0.72, 0.5, 26, "#fff4e2", "#ffe0b8"), 0.6))
    a = K.polaroid(K.grade(K.cover(frame("blink-change", 1), 520, 520, 0.5, 0.45, 1.3), 1.1), 470, "before")
    b = K.polaroid(K.grade(K.cover(frame("blink-change", 9), 520, 520, 0.5, 0.45, 1.3), 1.1), 470, "after?")
    K.put(c, a, 970, 430, "mm", shadow=dict(r=20, k=0.35, dy=14), rot=7)
    K.put(c, b, 1330, 470, "mm", shadow=dict(r=20, k=0.35, dy=14), rot=-6)
    K.put(c, ch("noodle", "wow", w=520), 1240, H + 20, "mb", shadow=dict(r=16, k=0.4, dy=10))
    ttl(c, slug, 400, 450, 700, rot=-4)
    return K.grain(c, 5)


def shadow_t(slug, f):
    c = K.lin(W, H, [(0, "#1a1a26"), (1, "#0a0a10")])
    c.alpha_composite(K.rad(W, H, [(0, (255, 228, 170, 210)), (0.45, (255, 228, 170, 40)), (0.8, (0, 0, 0, 0))], 0.72, 0.5, 0.6))
    dog = ch("noodle", "happy", w=560)
    big = K.fit(K.tint(dog, "#000000", 1.0), w=1000)
    K.put(c, K.opacity(K.blur(big, 5), 0.85), 1150, 760, "mb")
    K.put(c, dog, 1150, H - 30, "mb", shadow=dict(r=14, k=0.7, dy=6))
    q = K.text_img("?", "BebasNeue-Regular.ttf", 300, "#ffd25a"); K.put(c, q, 1500, 260, "mm", glow_c=("#ffd25a", 18, 0.4))
    ttl(c, slug, 400, 450, 640)
    return K.grain(K.vignette(c, 0.5), 9)


def oddblob(slug):
    c = K.lin(W, H, [(0, "#f2ecff"), (1, "#d8c8ff")])
    zb = no_floor(cast("zib", "happy")); same = K.fit(K.tint(zb, "#8e5be8", 0.25), h=250)
    diff = K.fit(K.tint(no_floor(cast("zib", "wow")), "#74c94e", 0.55), h=250)
    same = K.fit(same, h=330); diff = K.fit(diff, h=330)
    for i, (x, y) in enumerate(((930, 470), (1200, 470), (1470, 470), (1060, 860), (1340, 860))):
        K.put(c, (diff if i == 4 else same).rotate(15 if i == 4 else 0, resample=Image.BICUBIC, expand=True), x, y, "mb", shadow=dict(r=12, k=0.3, dy=8))
    ring = K.circle(W, H, 1340, 700, 190, None, outline="#74c94e", width=14); c.alpha_composite(K.glow(ring, 10, "#74c94e", 0.6)); c.alpha_composite(ring)
    ttl(c, slug, 420, 450, 720)
    return K.grain(c, 4)


def whack_t(slug):
    from posters import best_frame, greenness
    i = best_frame("whack-a-gloop", greenness)
    c = K.grade(K.cover(frame("whack-a-gloop", i), W, H, 0.5, 0.65, 1.1), 1.15, 1.05)
    side_fade(c, "#1e0a2a", "l", 0.55, 220)
    burst = K.rays(700, 700, 0.5, 0.5, 18, "#ffd21f", "#ffb000", 0.0); burst = K.mask_poly(burst, K.star_pts(350, 350, 340, 250, 14))
    K.put(c, burst, 1230, 380, "mm", shadow=dict(r=16, k=0.35, dy=10))
    K.put(c, ch("gloop", "wow", h=420), 1230, 560, "mb")
    bonk = K.text_img("BONK!", "Bangers-Regular.ttf", 150, "#ffffff", track=4, stroke=12, stroke_fill="#1e0a2a"); K.put(c, bonk, 1300, 700, "mm", rot=10, shadow=dict(r=10, k=0.5, dy=8))
    ttl(c, slug, 400, 450, 680)
    return K.grain(c, 5)


def ninja_t(slug, f):
    c = K.grain(K.solid(W, H, "#f4ecdc"), 10)
    K.add(c, K.circle(W, H, 1150, 420, 300, "#d0141e"))
    card = K.card_frame(K.cover(f, 560, 560, 0.55, 0.55, 1.1), 560, 560, 30, 14, "#141414")
    K.put(c, card, 1150, 470, "mm", shadow=dict(r=24, k=0.4, dy=16), rot=-6)
    slash = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(slash).line((700, 820, 1600, 80), fill=K.rgba("#ffffff"), width=12)
    c.alpha_composite(K.glow(slash, 8, "#ffffff", 0.6)); c.alpha_composite(slash)
    K.put(c, ch("noodle", "happy", w=520), 1180, H + 10, "mb")
    ttl(c, slug, 420, 450, 700)
    return c


def jelly_t(slug):
    c = bg_mesh("#ffe0f4", ["#ffb8e0", "#d8c8ff", "#ffe8b0", "#b8ecff", "#ffffff"])
    board = scene(slug, ("play_wide.png", "title_wide.png"))
    card = K.card_frame(K.cover(board, 640, 640, 0.5, 0.42, 2.2), 640, 640, 60, 16, "#ffffff")
    K.put(c, card, 1180, 450, "mm", shadow=dict(r=30, k=0.35, dy=20), rot=6)
    K.put(c, K.trim(cast("momo", "happy")), 1000, H + 40, "mb", scale=0.55, shadow=dict(r=20, k=0.4, dy=10))
    c.alpha_composite(K.confetti(W, H, 40, ["#ff4fb4", "#8e5bff", "#ffd21f", "#2ec4ff"], 5, (8, 18)))
    ttl(c, slug, 420, 450, 640)
    return K.grain(c, 4)


def escape_t(slug):
    sc = scene(slug, ("title_wide.png",))
    c = K.grade(K.cover(sc, W, H, 0.5, 0.5, 1.3), 1.1, 1.15, 0.8)
    c = K.gradmap(c, [(0, "#08040f"), (0.5, "#3a1a4a"), (1, "#ffd0e0")])
    lasers = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lasers)
    for y0, y1 in ((120, 260), (640, 520), (820, 760)): d.line((0, y0, W, y1), fill=K.rgba("#ff2b5c"), width=6)
    c.alpha_composite(K.glow(lasers, 12, "#ff2b5c", 0.9)); c.alpha_composite(lasers)
    st = K.stripes(W, 70, 50, 45, ["#ffd21f", "#141414"]); K.paste(c, st, 0, H - 70)
    K.put(c, K.trim(cast("momo", "wow")), 1250, H - 60, "mb", scale=0.62, shadow=dict(r=20, k=0.5, dy=10))
    ttl(c, slug, 480, 420, 760, glow=("#ff2b5c", 24, 0.25))
    return K.grain(c, 6)


def race_t(slug):
    """the whole field racing: the pack shot graded per game, zoom blur for speed, the title on the left"""
    L = RA.RACE_LOOK[slug]
    c = RA.pack_shot(slug, "wide", W, H, 0.36, 0.55, 1.3)
    side_fade(c, "#06040f", "l", 0.55, 215)
    RA.speed_streaks(c, W, H, [L["a"], L["b"], "#ffffff"], 30, 7, 0.2, 0.85)
    if slug == "highway-heat": RA.siren(c, W, H, L["a"], L["b"])
    ttl(c, slug, 420, 450, 720)
    return K.grain(K.vignette(c, 0.4), 5)


def car_t(slug, c1, c2, style):
    sc = scene(slug, ("title_wide.png",))
    car = K.cover(sc, 1100, 900, 0.62, 0.5, 1.0)
    if style == "synth":
        c = K.lin(W, H, [(0, "#1a0638"), (0.55, "#ff3a8a"), (0.56, "#14062a"), (1, "#14062a")])
        sun = K.circle(W, H, 1080, 470, 300, "#ffb000"); sun = K.mask_poly(sun, [(0, 0), (W, 0), (W, 495), (0, 495)])
        c.alpha_composite(sun)
        c.alpha_composite(K.persp_grid(W, H, 0.56, "#ff4fd8", 26, 12, 3))
    elif style == "smoke":
        c = K.lin(W, H, [(0, "#14042a"), (1, "#3a0a5a")])
        c.alpha_composite(K.bokeh(W, H, 30, ["#ff4fd8", "#8e5bff", "#ffffff"], 60, 180, 5, 40, (40, 110)))
        txt = K.text_img("DRIFT", "Teko-Bold.ttf", 520, "#ff4fd8"); K.put(c, K.opacity(txt, 0.12), 1100, 450, "mm")
    elif style == "siren":
        c = K.solid(W, H, "#06081a")
        K.add(c, K.rad(W, H, [(0, (255, 42, 42, 200)), (0.5, (0, 0, 0, 0))], 0.55, 0.2, 0.6), "screen")
        K.add(c, K.rad(W, H, [(0, (47, 107, 255, 200)), (0.5, (0, 0, 0, 0))], 0.95, 0.2, 0.6), "screen")
    else:
        c = K.lin(W, H, [(0, "#1a1a1a"), (1, "#050505")])
        chk = K.stripes(W, H, 60, 0, ["#ffffff", "#111111"]); chk2 = K.stripes(W, H, 60, 90, ["#ffffff", "#111111"])
        board = Image.fromarray(__import__("numpy").bitwise_xor(__import__("numpy").asarray(chk.convert("L")), __import__("numpy").asarray(chk2.convert("L")))).convert("RGBA")
        c.alpha_composite(K.opacity(K.mask_poly(board, [(700, 640), (W, 640), (W, H), (500, H)]), 0.35))
        K.add(c, K.rad(W, H, [(0, (255, 212, 0, 140)), (0.5, (0, 0, 0, 0))], 0.72, 0.45, 0.6), "screen")
    # the car: the right, text-free part of the in-race photo, feathered into the designed background
    photo = K.grade(K.load(os.path.join(K.WEB, "public", "games", slug, "card.webp")), 1.15, 1.08)  # text-free chase shot
    photo = K.fit(photo, h=H)
    m = K.lin(photo.width, H, [(0, (0, 0, 0, 0)), (0.25, (0, 0, 0, 255)), (1, (0, 0, 0, 255))], 0).getchannel("A")
    photo.putalpha(m)
    K.paste(c, photo, W - photo.width, 0)
    speed = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(speed); rng = random.Random(7)
    for _ in range(26):
        y = rng.uniform(200, 800); x = rng.uniform(0, 600)
        d.line((x, y, x + rng.uniform(200, 500), y), fill=K.rgba(rng.choice([c1, c2, "#ffffff"]), rng.randint(70, 170)), width=rng.randint(3, 8))
    c.alpha_composite(speed)
    ttl(c, slug, 430, 450, 720)
    return K.grain(K.vignette(c, 0.4), 6)


def main():
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    from meta import games
    for slug in games():
        if only and slug not in only: continue
        try:
            img = D(slug).convert("RGB")
        except Exception as e:
            import traceback; traceback.print_exc(); print("FAILED", slug, e, flush=True); continue
        os.makedirs(os.path.join(K.OUT, "thumbs"), exist_ok=True)
        img.save(os.path.join(K.OUT, "thumbs", f"{slug}.png"))
        d = os.path.join(K.WEB, "public", "games", slug)
        K.save(img, os.path.join(d, "cover.webp"), w=1280, q=86)
        og = K.cover(img.convert("RGBA"), 1200, 630, 0.5, 0.5, 1.0)
        K.save(og, os.path.join(d, "og.jpg"), q=86)
        print("thumb", slug, flush=True)


if __name__ == "__main__":
    main()
