"""Racing key art: the whole field on track (pack shots from capture_action.py), graded per game with speed blur."""
import os
import random

from PIL import Image, ImageDraw

import kit as K

# ------------------------------------------------------------------ racing: the whole field on track
RACE_SHOT = {  # which camera angle reads best as "the whole field racing", per picture size
    "nitro-rush": {"wide": "tele", "tall": "tele"}, "drift-kings": {"wide": "head", "tall": "head"},
    "highway-heat": {"wide": "tele", "tall": "tele"}, "moto-rush": {"wide": "tele", "tall": "tele"},
}
RACE_LOOK = {
    "nitro-rush": dict(grade=[(0, "#1a0630"), (0.45, "#c8406a"), (0.8, "#ffb46a"), (1, "#fff4d8")], k=0.18, a="#ff3a1f", b="#2e86ff"),
    "drift-kings": dict(grade=[(0, "#12042a"), (0.5, "#a02ad8"), (0.85, "#ff9ad8"), (1, "#fff0fa")], k=0.22, a="#ff4fd8", b="#8e5bff"),
    "highway-heat": dict(grade=[(0, "#060a1e"), (0.5, "#3a4a8a"), (0.85, "#ffc89a"), (1, "#ffffff")], k=0.22, a="#ff2a2a", b="#2f6bff"),
    "moto-rush": dict(grade=[(0, "#140a00"), (0.5, "#c86a00"), (0.85, "#ffe04a"), (1, "#ffffff")], k=0.25, a="#ffd400", b="#e10600"),
}


def pack_shot(slug, size, w, h, fx=0.5, fy=0.5, zoom=1.0):
    im = K.load(os.path.join(K.SRC, slug, f"pack_{RACE_SHOT[slug][size]}_{size}.png"))
    look = RACE_LOOK[slug]
    im = K.grade(K.cover(im, w, h, fx, fy, zoom), 1.25, 1.1, 1.02)
    tinted = K.gradmap(im, look["grade"])
    im = Image.blend(im, tinted, look["k"])
    return K.zoom_blur(im, 0.55, 0.55, 0.07, 10, 0.3)


def speed_streaks(c, w, h, cols, n=40, seed=7, y0=0.15, y1=0.9):
    s = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(s); rng = random.Random(seed)
    for _ in range(n):
        y = rng.uniform(y0, y1) * h; x = rng.uniform(-200, w)
        d.line((x, y, x + rng.uniform(140, 420), y), fill=K.rgba(rng.choice(cols), rng.randint(60, 160)), width=rng.randint(2, 6))
    c.alpha_composite(s)


def siren(c, w, h, a, b):
    K.add(c, K.rad(w, h, [(0, K.rgba(a, 170)), (0.4, (0, 0, 0, 0))], 0.08, 0.08, 0.5), "screen")
    K.add(c, K.rad(w, h, [(0, K.rgba(b, 170)), (0.4, (0, 0, 0, 0))], 0.92, 0.08, 0.5), "screen")
