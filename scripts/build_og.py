"""Per-game social/hero art: clay character on a sunburst + title (1200x630 og.jpg, 1600x840 hero.webp).

usage: python scripts/build_og.py
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(WEB, "public")
FONT = os.path.join(WEB, "src", "fonts", "LilitaOne.ttf")

GAMES = [
    ("fish-watch", "Fish Watch", "Track the golden fish!", "pip", "#2E86C8", "#7CC8FF"),
    ("spot-the-sneak", "Spot the Sneak", "Find the sneaky Gloop!", "gloop", "#5FB52A", "#C6F27A"),
    ("color-clash", "Color Clash", "Ink or word? Don't get tricked!", "hoot", "#3B5BDB", "#FFB000"),
    ("blink-change", "Blink!", "What changed in Noodle's room?", "noodle", "#D49452", "#FFD8A8"),
    ("where-is-zib", "Where's Zib?", "Find the one-eyed alien!", "zib", "#6C3FD1", "#B7FF5A"),
    ("memory-bridge", "Memory Bridge", "Remember the safe stones!", "tiki", "#1E9C91", "#7FD3A8"),
    ("pips-pantry", "Pip's Pantry", "Match the food pairs!", "pip", "#2E3F78", "#E8504F"),
    ("bolt-beeps", "Bolt's Beep Boop", "Repeat the robot beeps!", "bolt", "#1E9C91", "#FFD25A"),
    ("order-up", "Order Up!", "Build the cake from memory!", "bonbon", "#FF6F91", "#FFD25A"),
    ("grid-glow", "Glow Grid", "Tap the squares that glowed!", "bolt", "#3A2A63", "#7CF2C9"),
    ("shadow-match", "Shadow Snap", "Whose shadow is it?", "noodle", "#2B2D42", "#D49452"),
    ("gloop-guard", "Gloop Guard", "Green in, red out!", "gloop", "#2FA866", "#E8504F"),
    ("who-said-it", "Who Said It?", "Who made that silly noise?", "gloop", "#9B5DE5", "#FF8A3D"),
    ("whats-missing", "What's Missing?", "What did Kranky steal?", "kranky", "#E8504F", "#FFD25A"),
    ("pick-the-door", "Pick the Door", "Outsmart Kranky's clues!", "kranky", "#E8504F", "#FFD25A"),
    ("pattern-parade", "Pattern Parade", "What comes next?", "hoot", "#9A6B45", "#2EC4B6"),
    ("odd-blob-out", "Odd Blob Out", "Which blob doesn't belong?", "zib", "#8E5BE8", "#74C94E"),
    ("balance-buddies", "Balance Buddies", "Who is the heaviest?", "hoot", "#FFB000", "#9A6B45"),
    ("whack-a-gloop", "Whack-a-Gloop", "Bonk the Gloops, not Momo!", "gloop", "#74C94E", "#FF8A3D"),
    ("turbo-dash", "Turbo Dash", "Rocket-snail race!", "turbo", "#FF8A3D", "#3B5BDB"),
    ("bake-drop", "Bake Drop", "Catch cake, dodge chillies!", "bonbon", "#FF6F91", "#E8504F"),
    ("quick-hoot", "Quick Draw", "Wait... wait... NOW!", "hoot", "#23305A", "#FFD25A"),
    ("count-fast", "Count Fast", "How many Momos?", "momo", "#FFB000", "#FF6F91"),
    ("sum-slices", "Sum Slices", "Make Bonbon's number!", "bonbon", "#FF6F91", "#FFD25A"),
    ("number-ninja", "Number Ninja", "Tap 1, 2, 3... super fast!", "noodle", "#23305A", "#D49452"),
    ("more-or-less", "More or Less", "Which jar has more?", "turbo", "#9B5DE5", "#FF6F91"),
    ("slide-ship", "Slide Ship", "Fix Zib's spaceship!", "zib", "#3A2A63", "#B7FF5A"),
    ("gloop-pipes", "Gloop Pipes", "Connect the slime pipes!", "gloop", "#2E86C8", "#9BE34A"),
    ("firefly-switch", "Firefly Switch", "Light every firefly!", "noodle", "#1B1440", "#FFE38A"),
    ("maze-munch", "Maze Munch", "Munch cookies, find the exit!", "momo", "#74C94E", "#FF8A3D"),
    ("nitro-rush", "Nitro Rush", "3D racing · 30+ cars · nitro!", "turbo", "#FF5A1F", "#2E86FF"),
]
CHAR_IMG = {"tiki": ("brand", "tiki-sign.webp"), "momo": ("brand", "momo-cheer.webp"), "kranky": ("brand", "kranky.webp")}


def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mixc(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def art(W, H, title, tag, char, c1, c2):
    a, b, dark = hexrgb(c1), hexrgb(c2), (22, 12, 51)
    img = Image.new("RGB", (W, H), dark)
    px = img.load()
    cx, cy = W * 0.68, H * 0.5
    R = math.hypot(W, H)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cx, y - cy) / R
            ang = math.atan2(y - cy, x - cx)
            ray = 1 if int((ang + math.pi) / (math.pi / 12)) % 2 == 0 else 0
            base = mixc(b, a, min(1, d * 1.6))
            base = mixc(base, dark, max(0, d * 1.3 - 0.35))
            if ray: base = mixc(base, (255, 255, 255), 0.07)
            px[x, y] = base
    # character
    ch = Image.open(os.path.join(PUB, *CHAR_IMG.get(char, ("brand", "chars", f"{char}-happy.webp")))).convert("RGBA")
    target_h = int(H * (0.62 if char == "noodle" else 0.55 if char == "turbo" else 0.86))
    ch = ch.resize((int(ch.width * target_h / ch.height), target_h), Image.LANCZOS)
    if ch.width > W * 0.62: ch = ch.resize((int(W * 0.62), int(ch.height * W * 0.62 / ch.width)), Image.LANCZOS)
    sh = Image.new("RGBA", ch.size, (0, 0, 0, 0)); sh.putalpha(ch.getchannel("A").point(lambda v: v * 0.45))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    x0, y0 = int(W * 0.97 - ch.width), int(H * 0.96 - ch.height)
    img.paste((10, 4, 30), (x0 + 14, y0 + 22), sh)
    img.paste(ch, (x0, y0), ch)
    # logo
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.26); logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.07)), logo)
    d = ImageDraw.Draw(img)
    size = int(H * (0.17 if len(title) < 12 else 0.14))
    f = ImageFont.truetype(FONT, size)
    tx, ty = int(W * 0.05), int(H * 0.36)
    d.text((tx + 4, ty + 8), title, font=f, fill=(10, 4, 30), stroke_width=int(size * 0.12), stroke_fill=(10, 4, 30))
    d.text((tx, ty), title, font=f, fill=(255, 244, 226), stroke_width=int(size * 0.1), stroke_fill=(35, 48, 90))
    f2 = ImageFont.truetype(FONT, int(H * 0.06))
    pill_y = ty + size + int(H * 0.06)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, pill_y, tx + tw + 44, pill_y + int(H * 0.1)), radius=int(H * 0.05), fill=(35, 48, 90))
    d.text((tx + 22, pill_y + int(H * 0.018)), tag, font=f2, fill=(255, 210, 90))
    f3 = ImageFont.truetype(FONT, int(H * 0.05))
    d.text((tx, int(H * 0.86)), "FREE · NO SIGN-UP · PLAY ON MOMOBLOBS", font=f3, fill=(255, 244, 226))
    return img


ONLY = set(sys.argv[1:])
for slug, title, tag, char, c1, c2 in GAMES:
    if ONLY and slug not in ONLY: continue
    os.makedirs(os.path.join(PUB, "games", slug), exist_ok=True)
    art(1200, 630, title, tag, char, c1, c2).save(os.path.join(PUB, "games", slug, "og.jpg"), quality=86, optimize=True, progressive=True)
    art(1280, 720, title, tag, char, c1, c2).save(os.path.join(PUB, "games", slug, "hero.webp"), "WEBP", quality=84, method=6)
    print("ok", slug)
