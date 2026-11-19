"""Image toolkit for the poster and thumbnail compositor (PIL + numpy).

Everything works on RGBA PIL images. Colours are "#rrggbb" strings or tuples.
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
FONTS = os.path.join(HERE, "fonts")
OUT = os.path.join(HERE, "out")
SRC = os.path.join(OUT, "src")
TITLES = os.path.join(OUT, "titles")
MOMO = os.path.join(os.path.dirname(WEB), "momo", "renders", "web_assets")


# ------------------------------------------------------------------ colour
def rgb(c):
    if isinstance(c, (tuple, list)): return tuple(int(v) for v in c[:3])
    c = c.lstrip("#"); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def rgba(c, a=255):
    return rgb(c) + (int(a),)


def mixc(a, b, t):
    a, b = rgb(a), rgb(b); return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _stops(stops):
    pos = np.array([p for p, _ in stops], dtype=np.float32)
    cols = np.array([rgb(c) + ((c[3],) if isinstance(c, tuple) and len(c) == 4 else (255,)) for _, c in stops], dtype=np.float32)
    return pos, cols


def _map(t, stops):
    pos, cols = _stops(stops)
    t = np.clip(t, 0, 1)
    out = np.empty(t.shape + (4,), dtype=np.float32)
    for k in range(4): out[..., k] = np.interp(t, pos, cols[:, k])
    return Image.fromarray(out.astype(np.uint8), "RGBA")


# ------------------------------------------------------------------ fills
def solid(w, h, c, a=255):
    return Image.new("RGBA", (w, h), rgba(c, a))


def lin(w, h, stops, angle=90):
    """angle 90 = top->bottom, 0 = left->right"""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle); dx, dy = math.cos(a), math.sin(a)
    p = x * dx + y * dy
    t = (p - p.min()) / max(1e-6, p.max() - p.min())
    return _map(t, stops)


def rad(w, h, stops, cx=0.5, cy=0.5, r=0.75):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot((x - cx * w) / max(w, h), (y - cy * h) / max(w, h)) / r
    return _map(d, stops)


def mesh(w, h, base, blobs, soft=1.0):
    """trendy mesh gradient: soft colour blobs [(x, y, r, colour)] over a base colour"""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    acc = np.zeros((h, w, 3), np.float32) + np.array(rgb(base), np.float32)
    for bx, by, br, c in blobs:
        d = np.hypot(x / w - bx, (y / h - by) * h / w) / br
        k = np.exp(-(d ** 2) * 2.2 / soft)[..., None]
        acc = acc * (1 - k) + np.array(rgb(c), np.float32) * k
    return Image.fromarray(np.clip(acc, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def noise_layer(w, h, amt=18, seed=1, mono=True):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, amt, (h, w, 1 if mono else 3)).astype(np.float32)
    if mono: n = np.repeat(n, 3, 2)
    return n


def grain(img, amt=10, seed=1):
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    a[..., :3] = np.clip(a[..., :3] + noise_layer(img.width, img.height, amt, seed), 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def rays(w, h, cx, cy, n, c1, c2, spin=0.0, soft=0):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    ang = (np.arctan2(y - cy * h, x - cx * w) + spin) / (2 * math.pi) * n
    m = (np.floor(ang) % 2 == 0)
    a = np.where(m[..., None], np.array(rgba(c1), np.float32), np.array(rgba(c2), np.float32)).astype(np.uint8)
    im = Image.fromarray(a, "RGBA")
    return im.filter(ImageFilter.GaussianBlur(soft)) if soft else im


def stripes(w, h, width, angle, colors):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    p = (x * math.cos(a) + y * math.sin(a)) / width
    idx = (np.floor(p).astype(int) % len(colors))
    pal = np.array([rgba(c) for c in colors], np.uint8)
    return Image.fromarray(pal[idx], "RGBA")


def halftone(w, h, cell, color, field, angle=45, bg=None, maxr=0.62):
    """dots whose radius follows field(x01, y01) -> 0..1"""
    im = Image.new("RGBA", (w, h), rgba(bg) if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    a = math.radians(angle); ca, sa = math.cos(a), math.sin(a)
    R = int(math.hypot(w, h) / cell) + 2
    for i in range(-R, R):
        for j in range(-R, R):
            u, v = i * cell, j * cell
            x = w / 2 + u * ca - v * sa; y = h / 2 + u * sa + v * ca
            if -cell < x < w + cell and -cell < y < h + cell:
                r = maxr * cell * field(x / w, y / h)
                if r > 0.4: d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(color))
    return im


def dots_grid(w, h, step, r, color, alpha=255):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y in range(step // 2, h, step):
        for x in range(step // 2, w, step): d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(color, alpha))
    return im


def grid(w, h, step, color, width=1, alpha=120):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x in range(0, w, step): d.line((x, 0, x, h), fill=rgba(color, alpha), width=width)
    for y in range(0, h, step): d.line((0, y, w, y), fill=rgba(color, alpha), width=width)
    return im


def persp_grid(w, h, horizon, color, lines=22, rows=16, width=3, alpha=255, fade=True):
    """synthwave floor below `horizon` (0..1)"""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    hy = horizon * h; vx = w / 2
    for i in range(-lines, lines + 1):
        x = vx + i * w / lines * 1.6
        d.line((vx + i * 6, hy, x, h), fill=rgba(color, alpha), width=width)
    for k in range(1, rows + 1):
        t = (k / rows) ** 2.2
        y = hy + (h - hy) * t
        d.line((0, y, w, y), fill=rgba(color, alpha), width=max(1, int(width * (0.4 + t))))
    if fade:
        m = lin(w, h, [(0, (0, 0, 0, 0)), (horizon, (0, 0, 0, 0)), (min(1, horizon + 0.25), (0, 0, 0, 255)), (1, (0, 0, 0, 255))]).getchannel("A")
        im.putalpha(ImageChops.multiply(im.getchannel("A"), m))
    return im


def bokeh(w, h, n, colors, rmin=6, rmax=40, seed=3, blur=4, alpha=(60, 170)):
    rng = random.Random(seed)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for _ in range(n):
        r = rng.uniform(rmin, rmax); x = rng.uniform(0, w); y = rng.uniform(0, h)
        d.ellipse((x - r, y - r, x + r, y + r), fill=rgba(rng.choice(colors), rng.randint(*alpha)))
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im


def confetti(w, h, n, colors, seed=5, size=(8, 22), box=(0, 0, 1, 1)):
    rng = random.Random(seed)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for _ in range(n):
        x = rng.uniform(box[0], box[2]) * w; y = rng.uniform(box[1], box[3]) * h; s = rng.uniform(*size)
        kind = rng.random(); c = rgba(rng.choice(colors))
        piece = Image.new("RGBA", (int(s * 3), int(s * 3)), (0, 0, 0, 0)); pd = ImageDraw.Draw(piece)
        cx = cy = s * 1.5
        if kind < 0.4: pd.rounded_rectangle((cx - s, cy - s * 0.35, cx + s, cy + s * 0.35), s * 0.3, fill=c)
        elif kind < 0.7: pd.ellipse((cx - s * 0.5, cy - s * 0.5, cx + s * 0.5, cy + s * 0.5), fill=c)
        else: pd.polygon(star_pts(cx, cy, s * 0.8, s * 0.35, 4), fill=c)
        piece = piece.rotate(rng.uniform(0, 360), resample=Image.BICUBIC, expand=False)
        im.alpha_composite(piece, (int(x - s * 1.5), int(y - s * 1.5)))
    return im


def star_pts(cx, cy, r1, r2, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        a = math.radians(rot + i * 180 / n); r = r1 if i % 2 == 0 else r2
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def wave_poly(w, y, amp, freq, phase=0.0, bottom=None, steps=200):
    bottom = bottom if bottom is not None else 10 ** 5
    pts = [(x, y + amp * math.sin(x / w * freq * 2 * math.pi + phase)) for x in np.linspace(-10, w + 10, steps)]
    return pts + [(w + 10, bottom), (-10, bottom)]


def shape(w, h, poly, color, alpha=255):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ImageDraw.Draw(im).polygon(poly, fill=rgba(color, alpha)); return im


def circle(w, h, cx, cy, r, color, alpha=255, outline=None, width=0):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgba(color, alpha) if color else None, outline=rgba(outline) if outline else None, width=width)
    return im


# ------------------------------------------------------------------ image ops
def load(path):
    return Image.open(path).convert("RGBA")


def cover(img, w, h, fx=0.5, fy=0.5, zoom=1.0):
    sw, sh = img.size
    s = max(w / sw, h / sh) * zoom
    nw, nh = int(sw * s + 0.5), int(sh * s + 0.5)
    im = img.resize((nw, nh), Image.LANCZOS)
    x0 = int(min(max(0, fx * nw - w / 2), nw - w)); y0 = int(min(max(0, fy * nh - h / 2), nh - h))
    return im.crop((x0, y0, x0 + w, y0 + h))


def fit(img, w=None, h=None):
    sw, sh = img.size
    s = min((w or 10 ** 6) / sw, (h or 10 ** 6) / sh)
    return img.resize((max(1, int(sw * s)), max(1, int(sh * s))), Image.LANCZOS)


def trim(img, pad=0):
    bb = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bb: return img
    return img.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(img.width, bb[2] + pad), min(img.height, bb[3] + pad)))


def grade(img, sat=1.0, con=1.0, bri=1.0, sharp=1.0):
    a = img.getchannel("A") if img.mode == "RGBA" else None
    im = img.convert("RGB")
    if sat != 1: im = ImageEnhance.Color(im).enhance(sat)
    if con != 1: im = ImageEnhance.Contrast(im).enhance(con)
    if bri != 1: im = ImageEnhance.Brightness(im).enhance(bri)
    if sharp != 1: im = ImageEnhance.Sharpness(im).enhance(sharp)
    im = im.convert("RGBA")
    if a: im.putalpha(a)
    return im


def gradmap(img, stops):
    g = np.asarray(img.convert("L")).astype(np.float32) / 255
    out = _map(g, stops)
    if img.mode == "RGBA": out.putalpha(img.getchannel("A"))
    return out


def tint(img, color, amt=0.5):
    t = Image.new("RGBA", img.size, rgba(color)); out = Image.blend(img.convert("RGBA"), t, amt)
    out.putalpha(img.convert("RGBA").getchannel("A")); return out


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r))


def opacity(img, k):
    im = img.copy(); im.putalpha(im.getchannel("A").point(lambda a: int(a * k))); return im


def vignette(img, strength=0.55, color="#000000", r=0.85):
    w, h = img.size
    m = rad(w, h, [(0, (0, 0, 0, 0)), (r * 0.62, (0, 0, 0, 0)), (1.1, rgba(color, int(255 * strength)))], 0.5, 0.5, r * 0.9)
    return Image.alpha_composite(img.convert("RGBA"), m)


def fade(img, side="bottom", start=0.5, color="#000000", alpha=255):
    w, h = img.size
    ang = {"bottom": 90, "top": 270, "right": 0, "left": 180}[side]
    g = lin(w, h, [(0, rgba(color, 0)), (start, rgba(color, 0)), (1, rgba(color, alpha))], ang)
    return Image.alpha_composite(img.convert("RGBA"), g)


def mask_rounded(img, r):
    m = Image.new("L", img.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, img.width - 1, img.height - 1), r, fill=255)
    out = img.convert("RGBA").copy(); out.putalpha(ImageChops.multiply(out.getchannel("A"), m)); return out


def mask_circle(img):
    m = Image.new("L", img.size, 0); ImageDraw.Draw(m).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = img.convert("RGBA").copy(); out.putalpha(ImageChops.multiply(out.getchannel("A"), m)); return out


def mask_poly(img, poly):
    m = Image.new("L", img.size, 0); ImageDraw.Draw(m).polygon(poly, fill=255)
    out = img.convert("RGBA").copy(); out.putalpha(ImageChops.multiply(out.getchannel("A"), m)); return out


def dilate(alpha, px):
    if px <= 0: return alpha
    out = alpha
    while px > 0:
        k = min(px, 12); out = out.filter(ImageFilter.MaxFilter(k * 2 + 1)); px -= k
    return out


def sticker(img, px=14, color="#ffffff", shadow=True):
    """die-cut sticker border around a cut-out"""
    pad = px + 30
    big = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0)); big.paste(img, (pad, pad), img)
    a = dilate(big.getchannel("A").point(lambda v: 255 if v > 40 else 0), px).filter(ImageFilter.GaussianBlur(1.2))
    border = Image.new("RGBA", big.size, rgba(color)); border.putalpha(a)
    out = Image.new("RGBA", big.size, (0, 0, 0, 0))
    if shadow: out.alpha_composite(drop(border, (0, px // 2 + 4), px, "#000000", 0.35))
    out.alpha_composite(border); out.alpha_composite(big)
    return out


def drop(img, off=(0, 18), r=24, color="#000000", k=0.5):
    """the shadow layer only (same size as img)"""
    a = img.getchannel("A").point(lambda v: int(v * k))
    sh = Image.new("RGBA", img.size, rgba(color)); sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(r))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0)); out.alpha_composite(sh, (int(off[0]), int(off[1]))) if off[0] >= 0 and off[1] >= 0 else out.paste(sh, (int(off[0]), int(off[1])), sh)
    return out


def glow(img, r=30, color="#ffffff", k=0.8):
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(r)).point(lambda v: min(255, int(v * k * 1.8)))
    g = Image.new("RGBA", img.size, rgba(color)); g.putalpha(a); return g


def rim(img, color="#ffffff", width=6, angle=-45, k=0.9):
    """a light rim along the edge facing `angle` (degrees, -45 = top-left)"""
    a = img.getchannel("A")
    dx, dy = math.cos(math.radians(angle)) * width, math.sin(math.radians(angle)) * width
    shifted = ImageChops.offset(a, int(-dx), int(-dy))
    edge = ImageChops.subtract(a, shifted).filter(ImageFilter.GaussianBlur(width * 0.4)).point(lambda v: min(255, int(v * k * 1.6)))
    out = Image.new("RGBA", img.size, rgba(color)); out.putalpha(ImageChops.multiply(edge, a)); return out


def with_pad(img, pad):
    out = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0)); out.paste(img, (pad, pad), img); return out


def put(canvas, img, x, y, anchor="mm", shadow=None, glow_c=None, rot=0, scale=1.0):
    """paste with anchor (l/m/r + t/m/b), optional drop shadow (dict) and glow (colour, r)"""
    if scale != 1: img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
    if rot: img = with_pad(img, int(max(img.size) * 0.12)).rotate(rot, resample=Image.BICUBIC, expand=True)
    ax = {"l": 0, "m": 0.5, "r": 1}[anchor[0]]; ay = {"t": 0, "m": 0.5, "b": 1}[anchor[1]]
    px, py = int(x - img.width * ax), int(y - img.height * ay)
    if glow_c:
        gp = with_pad(img, int(glow_c[1] * 3)); g = glow(gp, glow_c[1], glow_c[0], glow_c[2] if len(glow_c) > 2 else 0.8)
        paste(canvas, g, px - int(glow_c[1] * 3), py - int(glow_c[1] * 3))
    if shadow:
        sp = with_pad(img, int(shadow.get("r", 24) * 3))
        s = drop(sp, (0, 0), shadow.get("r", 24), shadow.get("color", "#000000"), shadow.get("k", 0.5))
        paste(canvas, s, px - int(shadow.get("r", 24) * 3) + shadow.get("dx", 0), py - int(shadow.get("r", 24) * 3) + shadow.get("dy", 16))
    paste(canvas, img, px, py)
    return (px, py, px + img.width, py + img.height)


def paste(canvas, img, x, y):
    """alpha-composite allowing negative / out-of-bounds offsets"""
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(canvas.width, x + img.width), min(canvas.height, y + img.height)
    if x1 <= x0 or y1 <= y0: return
    canvas.alpha_composite(img.crop((x0 - x, y0 - y, x1 - x, y1 - y)), (x0, y0))


def add(canvas, layer, mode="normal", k=1.0):
    """blend a full-size layer: normal | screen | multiply | overlay | add"""
    layer = layer.convert("RGBA")
    if k != 1: layer = opacity(layer, k)
    if mode == "normal": canvas.alpha_composite(layer); return canvas
    base = canvas.convert("RGB"); top = layer.convert("RGB")
    f = {"screen": ImageChops.screen, "multiply": ImageChops.multiply, "overlay": ImageChops.overlay, "add": ImageChops.add, "soft": ImageChops.soft_light}[mode]
    mixed = f(base, top).convert("RGBA")
    out = Image.composite(mixed, canvas, layer.getchannel("A"))
    canvas.paste(out); return canvas


# ------------------------------------------------------------------ text
_fc = {}


def font(name, size):
    key = (name, size)
    if key not in _fc:
        p = name if os.path.isabs(name) else os.path.join(FONTS, name)
        if not os.path.exists(p): p = os.path.join(WEB, "src", "fonts", name)
        if not os.path.exists(p): p = os.path.join("C:/Windows/Fonts", name)
        _fc[key] = ImageFont.truetype(p, size)
    return _fc[key]


def text_img(s, fname, size, fill="#ffffff", track=0, stroke=0, stroke_fill="#000000", alpha=255):
    f = font(fname, size)
    if track:
        ws = [f.getbbox(ch)[2] if ch != " " else size * 0.3 for ch in s]
        tw = int(sum(ws) + track * (len(s) - 1)) + stroke * 2 + 4
    else:
        bb = f.getbbox(s, stroke_width=stroke); tw = bb[2] + stroke * 2 + 4
    asc, desc = f.getmetrics()
    im = Image.new("RGBA", (max(1, tw), asc + desc + stroke * 2 + 4), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if track:
        x = stroke
        for ch, cw in zip(s, ws):
            d.text((x, stroke), ch, font=f, fill=rgba(fill, alpha), stroke_width=stroke, stroke_fill=rgba(stroke_fill)); x += cw + track
    else:
        d.text((stroke, stroke), s, font=f, fill=rgba(fill, alpha), stroke_width=stroke, stroke_fill=rgba(stroke_fill))
    return trim(im, 2)


def pill(text, fname, size, fg="#ffffff", bg="#000000", padx=None, pady=None, r=None, track=0, outline=None, ow=0):
    t = text_img(text, fname, size, fg, track)
    padx = padx if padx is not None else int(size * 0.7); pady = pady if pady is not None else int(size * 0.42)
    w, h = t.width + padx * 2, t.height + pady * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), r if r is not None else h // 2, fill=rgba(bg), outline=rgba(outline) if outline else None, width=ow)
    im.alpha_composite(t, (padx, pady)); return im


# ------------------------------------------------------------------ frames / mockups
def polaroid(img, w, caption=None, cap_font="PermanentMarker-Regular.ttf", border="#fbf8f0"):
    inner = cover(img, w - 40, w - 40)
    h = w + (70 if caption else 20)
    im = Image.new("RGBA", (w, h), rgba(border)); im.alpha_composite(inner, (20, 20))
    if caption:
        t = text_img(caption, cap_font, 34, "#2a2a3a"); im.alpha_composite(t, ((w - t.width) // 2, w + 4))
    return im


def phone(img, w, color="#111118", r=None):
    h = int(w * 2.05); r = r or int(w * 0.14)
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=rgba(color))
    d.rounded_rectangle((3, 3, w - 4, h - 4), r - 3, outline=(255, 255, 255, 40), width=2)
    bez = int(w * 0.045)
    scr = mask_rounded(cover(img, w - bez * 2, h - bez * 2), r - bez)
    body.alpha_composite(scr, (bez, bez))
    d = ImageDraw.Draw(body); nw = int(w * 0.3)
    d.rounded_rectangle(((w - nw) // 2, bez + 10, (w + nw) // 2, bez + 10 + int(w * 0.07)), int(w * 0.035), fill=rgba(color))
    return body


def card_frame(img, w, h, r=36, border=10, color="#ffffff"):
    inner = mask_rounded(cover(img, w - 2 * border, h - 2 * border), r - border)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0)); ImageDraw.Draw(out).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=rgba(color))
    out.alpha_composite(inner, (border, border)); return out


def scanlines(img, step=4, k=0.18):
    w, h = img.size
    l = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(l)
    for y in range(0, h, step): d.line((0, y, w, y), fill=(0, 0, 0, int(255 * k)))
    return Image.alpha_composite(img.convert("RGBA"), l)


def brick(w, h, c1="#5a2a2a", c2="#3a1818", mortar="#1a0c0c", bw=120, bh=50, seed=2):
    rng = random.Random(seed)
    im = Image.new("RGBA", (w, h), rgba(mortar)); d = ImageDraw.Draw(im)
    for j, y in enumerate(range(0, h, bh)):
        off = (bw // 2) if j % 2 else 0
        for x in range(-bw, w + bw, bw):
            c = mixc(c1, c2, rng.random())
            d.rounded_rectangle((x + off + 3, y + 3, x + off + bw - 3, y + bh - 3), 4, fill=rgba(c))
    return grain(im, 12, seed)


def cork(w, h, seed=4):
    base = solid(w, h, "#b98a52")
    return grain(Image.alpha_composite(base, opacity(bokeh(w, h, 1600, ["#8a5a2a", "#d8a868", "#6a4020"], 2, 6, seed, 0, (80, 200)), 0.8)), 16, seed)


def save(img, path, w=None, q=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = img if not w else img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
    if path.endswith(".jpg"): im.convert("RGB").save(path, quality=q, optimize=True, progressive=True)
    else: im.convert("RGB").save(path, "WEBP", quality=q, method=6)


def zoom_blur(img, cx=0.5, cy=0.5, strength=0.06, steps=10, sharp_r=0.32):
    """speed: a radial zoom blur that leaves the middle sharp"""
    w, h = img.size
    acc = np.zeros((h, w, 4), np.float32)
    for k in range(steps):
        s = 1 + strength * k / steps
        nw, nh = int(w * s), int(h * s)
        big = img.resize((nw, nh), Image.BILINEAR)
        x0, y0 = int((nw - w) * cx), int((nh - h) * cy)
        acc += np.asarray(big.crop((x0, y0, x0 + w, y0 + h)).convert("RGBA")).astype(np.float32)
    blurred = Image.fromarray((acc / steps).astype(np.uint8), "RGBA")
    m = rad(w, h, [(0, (0, 0, 0, 0)), (sharp_r, (0, 0, 0, 0)), (sharp_r + 0.35, (0, 0, 0, 255))], cx, cy, 0.9).getchannel("A")
    return Image.composite(blurred, img.convert("RGBA"), m)
