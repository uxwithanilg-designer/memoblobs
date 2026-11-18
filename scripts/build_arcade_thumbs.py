"""Thumbnails for the 30 arcade games, made from real gameplay: capture frames of each game in headless Chrome
(canvas only, no HUD), then compose the chosen frame into the card art — a crop of the action, the title in the
clay font, a tagline pill and the MOMOBLOBS badge. Writes public/games/<slug>/thumb.webp (1280x720, the card art) and og.jpg (1200x630).

usage:
  python scripts/build_arcade_thumbs.py capture <frames_dir> [slug ...]   (needs `next dev` on :3000)
  python scripts/build_arcade_thumbs.py build <frames_dir> [slug ...]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(WEB, "public", "games")
FONT = os.path.join(WEB, "src", "fonts", "LilitaOne.ttf")
MARK = os.path.join(WEB, "scripts", "assets", "momo-mark.png")
W, H = 1280, 720

# slug: (title, tagline, accent, frame no., focus y 0..1, zoom, focus x 0..1, title corner L/R) — the crop centres on the focus point
GAMES = {
    "fish-watch": ("Fish Watch", "Track the golden fish!", "#2E86C8", 1, 0.58, 1.0, 0.5, "L"),
    "spot-the-sneak": ("Spot the Sneak", "Find the odd Gloop!", "#5FB52A", 4, 0.55, 1.2, 0.5, "L"),
    "color-clash": ("Color Clash", "Ink or word?", "#3B5BDB", 13, 0.55, 1.3, 0.5, "L"),
    "blink-change": ("Blink!", "What changed?", "#D49452", 1, 0.55, 1.2, 0.55, "L"),
    "where-is-zib": ("Where's Zib?", "Find the alien!", "#6C3FD1", 4, 0.62, 1.25, 0.5, "L"),
    "memory-bridge": ("Memory Bridge", "Remember the safe stones!", "#1E9C91", 4, 0.58, 1.3, 0.55, "L"),
    "pips-pantry": ("Pip's Pantry", "Match the pairs!", "#2E3F78", 21, 0.55, 1.0, 0.5, "L"),
    "bolt-beeps": ("Bolt's Beep Boop", "Repeat the beeps!", "#1E9C91", 3, 0.55, 1.05, 0.55, "L"),
    "order-up": ("Order Up!", "Build it from memory!", "#FF6F91", 4, 0.42, 1.35, 0.55, "L"),
    "grid-glow": ("Glow Grid", "Tap what glowed!", "#3A2A63", 4, 0.58, 1.05, 0.45, "L"),
    "shadow-match": ("Shadow Snap", "Whose shadow is it?", "#2B2D42", 7, 0.55, 1.1, 0.55, "L"),
    "gloop-guard": ("Gloop Guard", "Green in, red out!", "#2FA866", 10, 0.6, 1.25, 0.5, "L"),
    "who-said-it": ("Who Said It?", "Listen and guess!", "#9B5DE5", 7, 0.42, 1.05, 0.5, "L"),
    "whats-missing": ("What's Missing?", "Spot what's gone!", "#E8504F", 4, 0.5, 1.0, 0.5, "R"),
    "pick-the-door": ("Pick the Door", "Crack the clues!", "#E8504F", 7, 0.55, 1.15, 0.5, "L"),
    "pattern-parade": ("Pattern Parade", "What comes next?", "#9A6B45", 7, 0.45, 1.3, 0.5, "L"),
    "odd-blob-out": ("Odd Blob Out", "Which one doesn't fit?", "#8E5BE8", 10, 0.58, 1.1, 0.45, "L"),
    "balance-buddies": ("Balance Buddies", "Heavy or light?", "#FFB000", 10, 0.5, 1.2, 0.55, "L"),
    "whack-a-gloop": ("Whack-a-Gloop", "Bonk the Gloops!", "#74C94E", 16, 0.7, 1.15, 0.55, "L"),
    "turbo-dash": ("Turbo Dash", "Rocket-snail race!", "#FF8A3D", 10, 0.6, 1.25, 0.66, "R"),
    "bake-drop": ("Bake Drop", "Catch the cake!", "#FF6F91", 13, 0.72, 1.6, 0.45, "L"),
    "quick-hoot": ("Quick Draw", "Wait... NOW!", "#23305A", 13, 0.5, 1.15, 0.5, "L"),
    "count-fast": ("Count Fast", "How many?", "#FFB000", 7, 0.55, 1.0, 0.5, "L"),
    "sum-slices": ("Sum Slices", "Make the number!", "#FF6F91", 4, 0.5, 1.0, 0.5, "L"),
    "number-ninja": ("Number Ninja", "Tap 1, 2, 3... fast!", "#23305A", 7, 0.55, 1.0, 0.55, "L"),
    "more-or-less": ("More or Less", "Pick the right jar!", "#9B5DE5", 4, 0.72, 1.0, 0.5, "L"),
    "slide-ship": ("Slide Ship", "Fix the spaceship!", "#3A2A63", 4, 0.55, 1.0, 0.5, "L"),
    "gloop-pipes": ("Gloop Pipes", "Connect the pipes!", "#2E86C8", 10, 0.58, 1.0, 0.45, "R"),
    "firefly-switch": ("Firefly Switch", "Light them all!", "#1B1440", 7, 0.58, 1.0, 0.5, "L"),
    "maze-munch": ("Maze Munch", "Munch and escape!", "#74C94E", 1, 0.58, 1.05, 0.3, "R"),
}


def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def capture(frames, slugs):
    from playwright.sync_api import sync_playwright
    hide = ("const st = document.createElement('style'); st.textContent = `body * { visibility: hidden !important; } "
            "canvas { visibility: visible !important; } nextjs-portal { display: none !important; }`; document.head.appendChild(st);")
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": 1000, "height": 760}, device_scale_factor=1.28)
        for slug in slugs:
            page = ctx.new_page()
            page.goto(f"http://localhost:3000/play/{slug}", wait_until="load")
            for _ in range(80):
                if page.evaluate("!!(window.__arcade && window.__arcade.hud.status === 'lobby')"): break
                page.wait_for_timeout(400)
            page.wait_for_timeout(800)
            page.evaluate(hide)
            page.evaluate("window.__arcade.start('medium', 4, 0)")
            d = os.path.join(frames, slug); os.makedirs(d, exist_ok=True)
            for i in range(18):
                page.wait_for_timeout(500)
                page.screenshot(path=os.path.join(d, f"f{i:02d}.jpg"), type="jpeg", quality=90)
            print("captured", slug, flush=True)
            page.close()
        b.close()


def fit_font(draw, text, max_w, start):
    size = start
    while size > 40:
        f = ImageFont.truetype(FONT, size)
        if draw.textbbox((0, 0), text, font=f, stroke_width=round(size * 0.09))[2] <= max_w: return f, size
        size -= 4
    return ImageFont.truetype(FONT, size), size


def compose(frame_path, title, tag, accent, fy, zoom, fx, side="L"):
    src = Image.open(frame_path).convert("RGB")
    sw, sh = src.size
    cw = sw / zoom; ch = cw * H / W
    if ch > sh: ch = sh; cw = ch * W / H
    x0 = max(0, min(sw - cw, fx * sw - cw / 2)); y0 = max(0, min(sh - ch, fy * sh - ch / 2))
    img = src.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((W, H), Image.LANCZOS)
    img = ImageEnhance.Color(img).enhance(1.12)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    # readability: dark wash rising from the bottom-left corner + a soft vignette
    wash = Image.new("L", (W, H), 0)
    px = wash.load()
    for y in range(H):
        v = max(0.0, (y / H - 0.34) / 0.66)
        for x in range(0, W, 4):
            h = max(0.0, 1 - (x if side == "L" else W - x) / (W * 0.72))
            a = int(255 * min(0.86, 0.95 * v * (0.35 + 0.65 * h) + 0.1 * v))
            for k in range(4):
                if x + k < W: px[x + k, y] = a
    dark = Image.new("RGB", (W, H), (16, 9, 40))
    img = Image.composite(dark, img, wash)
    vig = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vig).ellipse((-W * 0.25, -H * 0.3, W * 1.25, H * 1.3), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(90))
    img = Image.composite(img, Image.blend(img, dark, 0.45), vig)

    d = ImageDraw.Draw(img)
    navy = (35, 48, 90)
    # title (one line, or two when long)
    words = title.split(" ")
    lines = [title]
    f, size = fit_font(d, title, 760, 118)
    if size < 92 and len(words) > 1:
        mid = (len(words) + 1) // 2
        lines = [" ".join(words[:mid]), " ".join(words[mid:])]
        f, size = fit_font(d, max(lines, key=len), 700, 112)
    tf = ImageFont.truetype(FONT, 38)
    pill_h = 62
    lh = round(size * 0.98)
    block_h = lh * len(lines) + 18 + pill_h
    sw_ = round(size * 0.09)
    tw_ = max(d.textbbox((0, 0), ln, font=f, stroke_width=sw_)[2] for ln in lines)
    pw_ = d.textbbox((0, 0), tag, font=tf)[2] + 44
    x, y = (56 if side == "L" else W - 56 - max(tw_, pw_)), H - 52 - block_h
    for i, ln in enumerate(lines):
        yy = y + i * lh
        d.text((x, yy + round(size * 0.07)), ln, font=f, fill=navy, stroke_width=sw_, stroke_fill=navy)
        d.text((x, yy), ln, font=f, fill=(255, 244, 226), stroke_width=sw_, stroke_fill=navy)
    # tagline pill
    ty = y + lh * len(lines) + 18
    tw = d.textbbox((0, 0), tag, font=tf)[2]
    acc = hexrgb(accent)
    lum = 0.299 * acc[0] + 0.587 * acc[1] + 0.114 * acc[2]
    pill = acc if lum < 170 else tuple(int(c * 0.55) for c in acc)
    d.rounded_rectangle((x - 2, ty + 5, x + tw + 42, ty + pill_h + 5), radius=pill_h // 2, fill=navy)
    d.rounded_rectangle((x - 2, ty, x + tw + 42, ty + pill_h), radius=pill_h // 2, fill=pill)
    d.text((x + 20, ty + 10), tag, font=tf, fill=(255, 255, 255), stroke_width=2, stroke_fill=navy)
    # MOMOBLOBS badge
    mark = Image.open(MARK).convert("RGBA").resize((54, 54), Image.LANCZOS)
    bf = ImageFont.truetype(FONT, 27)
    bw = d.textbbox((0, 0), "MOMOBLOBS", font=bf)[2]
    badge = Image.new("RGBA", (bw + 90, 66), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.rounded_rectangle((0, 0, bw + 89, 65), radius=33, fill=(16, 9, 40, 175))
    badge.alpha_composite(mark, (8, 6))
    bd.text((70, 15), "MOMOBLOBS", font=bf, fill=(255, 255, 255))
    img = img.convert("RGBA"); img.alpha_composite(badge, (36, 32))
    return img.convert("RGB")


def build(frames, slugs):
    for slug in slugs:
        title, tag, accent, fr, fy, zoom, fx, side = GAMES[slug]
        img = compose(os.path.join(frames, slug, f"f{fr:02d}.jpg"), title, tag, accent, fy, zoom, fx, side)
        # THUMB_OUT=<dir> writes previews there instead of public/
        out = os.path.join(os.environ["THUMB_OUT"], slug) if os.environ.get("THUMB_OUT") else os.path.join(PUB, slug)
        os.makedirs(out, exist_ok=True)
        img.save(os.path.join(out, "thumb.webp"), "WEBP", quality=86, method=6)
        og = img.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652))
        og.save(os.path.join(out, "og.jpg"), "JPEG", quality=86, optimize=True, progressive=True)
        print("built", slug, flush=True)


if __name__ == "__main__":
    cmd, frames = sys.argv[1], sys.argv[2]
    slugs = sys.argv[3:] or list(GAMES)
    capture(frames, slugs) if cmd == "capture" else build(frames, slugs)
