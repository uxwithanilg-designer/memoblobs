"""Skyrift Gems play backdrop: a soft painted candy land — a teal-to-pink sky with big puffy shaded clouds, mint and
pink candy hills with thick white icing caps that drip, a sugar path and soft sparkles. Drawn with PIL at double size
(all original), saved as public/games/skyrift-gems/bg.webp (landscape) and bg-tall.webp (portrait).

usage: python scripts/art/skyrift_bg.py
"""
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "skyrift-gems")


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def vgrad(w, h, top, bot):
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(top, bot, y / max(1, h - 1)))
    return g


def paint(base, mask, top, bot, y0, y1, blur=0):
    """fill a mask with a vertical gradient from y0 (top colour) to y1 (bottom colour)"""
    W, H = base.size
    g = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(g)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(top, bot, (y - y0) / max(1, y1 - y0)))
    m = mask.filter(ImageFilter.GaussianBlur(blur)) if blur else mask
    base.paste(g, (0, 0), m)


def cloud_mask(W, H, x, y, s):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    for dx, dy, r in ((0, 0, 1.0), (0.95, -0.45, 1.3), (2.0, -0.2, 1.1), (2.9, 0.1, 0.85), (-0.9, 0.25, 0.8), (1.4, 0.3, 1.0)):
        d.ellipse([x + (dx - r) * s, y + (dy - r) * s, x + (dx + r) * s, y + (dy + r) * s], fill=255)
    d.ellipse([x - 1.6 * s, y - 0.1 * s, x + 3.6 * s, y + 0.75 * s], fill=255)  # a soft round base
    return m


def hill_mask(W, H, cx, base, w, h):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse([cx - w / 2, base - h, cx + w / 2, base + h], fill=255)
    return m


def icing_mask(W, H, cx, base, w, h, rnd):
    """the white cap: the hill's top cut by a wavy line with drips"""
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    top = base - h
    line_y = top + h * 0.34
    pts = []
    n = 14
    for k in range(n + 1):
        x = cx - w / 2 + w * k / n
        wave = math.sin(k * 1.7) * h * 0.04
        pts.append((x, line_y + wave))
    d.polygon([(cx - w / 2, top - 5)] + pts + [(cx + w / 2, top - 5)], fill=255)
    for k in range(6):
        x = cx - w * 0.32 + k * w * 0.13 + rnd.uniform(-w * 0.03, w * 0.03)
        dl = h * rnd.uniform(0.06, 0.16)
        r = w * 0.024
        d.rectangle([x - r, line_y - 2, x + r, line_y + dl], fill=255)
        d.ellipse([x - r, line_y + dl - r, x + r, line_y + dl + r], fill=255)
    return ImageChops.multiply(m, hill_mask(W, H, cx, base, w, h))


def scene(W0, H0, seed):
    S = 2
    W, H = W0 * S, H0 * S
    rnd = random.Random(seed)
    # sky: teal up top, misty white in the middle, candy pink at the horizon
    sky = vgrad(W, H, (128, 222, 236), (236, 246, 248))
    low = vgrad(W, H, (236, 246, 248), (255, 205, 230))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rectangle([0, int(H * 0.5), W, H], fill=255)
    sky.paste(low.crop((0, 0, W, H)), (0, 0), mask.filter(ImageFilter.GaussianBlur(H * 0.08)))
    im = sky.convert("RGB")
    # big soft background clouds (pale, blurred), then crisp shaded foreground clouds
    for k in range(5):
        x, y, s = rnd.random() * W, H * (0.04 + rnd.random() * 0.42), min(W, H) * (0.07 + rnd.random() * 0.05)
        paint(im, cloud_mask(W, H, x, y, s), (255, 246, 252), (232, 230, 246), y - s * 1.6, y + s, blur=s * 0.25)
    for k in range(6):
        x, y, s = rnd.random() * W, H * (0.06 + rnd.random() * 0.4), min(W, H) * (0.035 + rnd.random() * 0.035)
        paint(im, cloud_mask(W, H, x, y + s * 0.18, s), (196, 214, 238), (196, 214, 238), 0, 1, blur=s * 0.12)
        paint(im, cloud_mask(W, H, x, y, s), (255, 255, 255), (226, 236, 250), y - s * 1.6, y + s * 0.9, blur=1.5 * S)
    # candy hills, back to front, each with its icing cap
    hills = [
        (0.42, 1.04, 0.46, 0.27, (255, 196, 226), (240, 150, 200)),
        (0.68, 1.04, 0.32, 0.31, (176, 240, 226), (110, 210, 192)),
        (0.12, 1.06, 0.56, 0.44, (250, 160, 210), (226, 100, 170)),
        (0.88, 1.06, 0.58, 0.52, (130, 232, 210), (60, 190, 170)),
    ]
    for cx, base, w, h, top, bot in hills:
        cx, base, w, h = cx * W, base * H, w * W, h * H
        # a soft shadow behind, the hill body, a rim light, then the icing
        paint(im, hill_mask(W, H, cx + w * 0.02, base + h * 0.02, w, h), (180, 120, 170), (180, 120, 170), 0, 1, blur=h * 0.06)
        paint(im, hill_mask(W, H, cx, base, w, h), top, bot, base - h, base, blur=S)
        paint(im, icing_mask(W, H, cx, base, w, h, rnd), (255, 255, 255), (232, 240, 252), base - h, base - h * 0.5, blur=S)
    # a sugar path winding up the middle
    path = Image.new("L", (W, H), 0)
    pd = ImageDraw.Draw(path)
    for k in range(60):
        t = k / 59
        x = W * (0.5 + 0.08 * math.sin(t * 3.2)) - W * 0.05 * t
        y = H * (0.8 + 0.22 * t)
        r = W * (0.015 + 0.06 * t)
        pd.ellipse([x - r, y - r * 0.4, x + r, y + r * 0.4], fill=255)
    paint(im, path, (255, 236, 244), (255, 214, 232), H * 0.8, H, blur=2 * S)
    # sparkles
    sp = ImageDraw.Draw(im)
    for k in range(50):
        x, y, r = rnd.random() * W, rnd.random() * H * 0.7, (1 + rnd.random() * 2.2) * S
        sp.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    return im.resize((W0, H0), Image.LANCZOS)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    scene(1600, 900, 7).save(os.path.join(OUT, "bg.webp"), quality=84, method=6)
    scene(900, 1600, 11).save(os.path.join(OUT, "bg-tall.webp"), quality=84, method=6)
    print("wrote bg.webp, bg-tall.webp")
