"""Asset loaders for the art compositor: titles, cast cut-outs, captured frames, brand bits."""
import functools
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from meta import games  # noqa: E402

META = games()
FRAME = {  # the best gameplay frame per arcade game (index into f00..f17)
    "fish-watch": 1, "spot-the-sneak": 4, "color-clash": 13, "blink-change": 1, "where-is-zib": 4, "memory-bridge": 4, "pips-pantry": 17,
    "bolt-beeps": 3, "order-up": 4, "grid-glow": 4, "shadow-match": 7, "gloop-guard": 10, "who-said-it": 7, "whats-missing": 4,
    "pick-the-door": 7, "pattern-parade": 7, "odd-blob-out": 10, "balance-buddies": 10, "whack-a-gloop": 16, "turbo-dash": 10, "bake-drop": 13,
    "quick-hoot": 11, "count-fast": 7, "sum-slices": 4, "number-ninja": 7, "more-or-less": 4, "slide-ship": 4, "gloop-pipes": 10,
    "firefly-switch": 7, "maze-munch": 1,
}


@functools.lru_cache(None)
def title(slug):
    return kit.trim(kit.load(os.path.join(kit.TITLES, f"{slug}.png")), 2)


@functools.lru_cache(None)
def cast(name, expr="happy"):
    """clay cast cut-outs (transparent PNGs from the momo renderer)"""
    if name == "momo":
        p = os.path.join(kit.MOMO, f"momo_{ {'happy': 'cheer', 'wow': 'surprised', 'sad': 'scared'}.get(expr, expr)}.png")
    elif name == "kranky":
        p = os.path.join(kit.MOMO, "kranky_laugh.png" if expr in ("happy", "laugh") else "kranky.png")
    elif name == "tiki":
        p = os.path.join(kit.MOMO, "tiki_sign.png" if expr == "sign" else "tiki.png")
    else:
        p = os.path.join(kit.MOMO, "chars", f"{name}-{expr}.png")
    return kit.trim(kit.load(p), 2)


def no_floor(img, cut=0.06):
    """drop the soft floor shadow the cast renders carry under their feet"""
    a = img.getchannel("A").point(lambda v: 255 if v > 200 else 0)
    bb = a.getbbox()
    return img.crop((0, 0, img.width, bb[3] + 2)) if bb else img


@functools.lru_cache(None)
def frame(slug, i=None):
    i = FRAME.get(slug, 4) if i is None else i
    return kit.load(os.path.join(kit.SRC, slug, f"f{min(17, i):02d}.jpg"))


def src(slug, name):
    p = os.path.join(kit.SRC, slug, name)
    return kit.load(p) if os.path.exists(p) else None


def pub(path):
    return kit.load(os.path.join(kit.WEB, "public", path.lstrip("/")))


@functools.lru_cache(None)
def logo(light=True):
    """the MOMOBLOBS lockup (app icon + wordmark) from scripts/art/make_brand.py; light = white BLOBS for dark grounds"""
    return kit.trim(kit.load(os.path.join(kit.HERE, "brand", "logo-light.png" if light else "logo-dark.png")), 2)


def meta(slug):
    return META[slug]
