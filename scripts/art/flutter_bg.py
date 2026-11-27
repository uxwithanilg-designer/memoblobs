"""Flutter Pairs play backdrop: a felt-craft countryside — a soft felt sky with stitched clouds, layered felt hills with
running-stitch seams, felt trees and little flowers, drawn with PIL at double size (all original). Saved as
public/games/flutter-pairs/bg.webp (landscape) and bg-tall.webp (portrait).

usage: python scripts/art/flutter_bg.py
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "flutter-pairs")


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def fuzz(im, amount, seed):
    """felt fuzz: faint light and dark specks"""
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    for k in range(int(W * H / 90)):
        x, y = rnd.random() * W, rnd.random() * H
        c = 255 if rnd.random() < 0.5 else 0
        d.point((x, y), fill=(c, c, c, int(255 * amount * rnd.random())))


def stitch_path(d, pts, col, width, dash, gap):
    """a running stitch along a polyline"""
    carry = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L == 0: continue
        t = -carry
        while t < L:
            a = max(0.0, t); b = min(L, t + dash)
            if b > a: d.line([(x0 + (x1 - x0) * a / L, y0 + (y1 - y0) * a / L), (x0 + (x1 - x0) * b / L, y0 + (y1 - y0) * b / L)], fill=col, width=width)
            t += dash + gap
        carry = t - L


def scene(W0, H0, seed):
    S = 2
    W, H = W0 * S, H0 * S
    rnd = random.Random(seed)
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp((168, 222, 240), (236, 246, 232), y / (H * 0.7)))
    # stitched felt clouds
    for k in range(6):
        cx, cy, s = rnd.random() * W, H * (0.06 + rnd.random() * 0.32), min(W, H) * (0.05 + rnd.random() * 0.04)
        blobs = [(cx + dx * s, cy + dy * s, r * s) for dx, dy, r in ((0, 0, 1.0), (1.0, -0.4, 1.2), (2.0, 0, 0.95), (1.0, 0.35, 0.9))]
        for (x, y, r) in blobs:
            d.ellipse([x - r + 6, y - r + 8, x + r + 6, y + r + 8], fill=(150, 200, 220))
        for (x, y, r) in blobs:
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
        for (x, y, r) in blobs:
            pts = [(x + math.cos(a) * (r - 10 * S), y + math.sin(a) * (r - 10 * S)) for a in [math.pi * (1.05 + 0.9 * t / 20) for t in range(21)]]
            stitch_path(d, pts, (200, 220, 236), 3 * S, 8 * S, 6 * S)
    # layered felt hills, each with a running stitch along its top
    layers = [(0.58, (168, 220, 130), 0.08), (0.66, (138, 204, 104), 0.07), (0.76, (112, 186, 86), 0.06), (0.87, (96, 168, 72), 0.05)]
    for li, (base, col, amp) in enumerate(layers):
        ph = rnd.random() * 6
        pts = [(x, H * base + math.sin(x / W * math.pi * (2 + li) + ph) * H * amp) for x in range(0, W + 8, 8)]
        d.polygon(pts + [(W, H), (0, H)], fill=col)
        d.line(pts, fill=lerp(col, (255, 255, 255), 0.25), width=4 * S)
        stitch_path(d, [(x, y + 16 * S) for x, y in pts], lerp(col, (255, 255, 255), 0.55), 3 * S, 10 * S, 8 * S)
        # felt trees and flowers on the hill
        for k in range(3 + li):
            x = rnd.random() * W; y = H * base + math.sin(x / W * math.pi * (2 + li) + ph) * H * amp
            if rnd.random() < 0.5:
                r = (26 + li * 8) * S
                d.rectangle([x - 5 * S, y - r * 0.6, x + 5 * S, y + 6 * S], fill=(140, 96, 60))
                d.ellipse([x - r, y - r * 2.1, x + r, y - r * 0.3], fill=lerp(col, (40, 120, 50), 0.5))
            else:
                for f in range(4):
                    fx = x + f * 18 * S; r = 6 * S
                    d.ellipse([fx - r, y - r - 6 * S, fx + r, y + r - 6 * S], fill=[(255, 120, 150), (255, 210, 80), (255, 255, 255), (180, 140, 255)][f % 4])
    im = im.filter(ImageFilter.GaussianBlur(0.6 * S))
    fuzz(im, 0.06, seed)
    return im.resize((W0, H0), Image.LANCZOS)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    scene(1600, 900, 5).save(os.path.join(OUT, "bg.webp"), quality=80, method=6)
    scene(900, 1600, 9).save(os.path.join(OUT, "bg-tall.webp"), quality=80, method=6)
    print("wrote bg.webp, bg-tall.webp")
