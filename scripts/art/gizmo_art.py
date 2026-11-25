"""Gizmo Drive key art, made from the real game: the test driver drives stages in headless Chrome (muted, the dev
server on PORT, default 3000) and we capture it in the middle of a contraption (a loop, a lift, a wrecking ball, a jump)
in several worlds into scripts/art/out/gizmo, then lay the shots out like the site's other covers — the title in the
display font, tag pills, and tilted gameplay cards over a soft, darkened backdrop — into public/games/gizmo-drive/:
cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500), og.jpg (1200x630).

usage: PORT=3000 python scripts/art/gizmo_art.py [capture] [build] [review]
  review: one shot per world (scripts/art/out/gizmo/review_*.png) for checking the look
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "gizmo-drive")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "gizmo")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, stage, the contraption to catch, viewport)
SCENES = [
    ("toy", 10, "kicker", (1280, 720)), ("candy", 62, "spring", (1280, 720)), ("hardhat", 109, "wrecker", (1280, 720)),
    ("sky", 170, "kicker", (1280, 720)), ("neon", 209, "loop", (1280, 720)), ("glacier", 287, "lift", (1280, 720)),
    ("haunted", 521, "loop", (1280, 720)), ("clock", 469, "drawbridge", (1280, 720)),
    ("tall", 236, "pistons", (720, 1280)), ("tall2", 160, "slider", (720, 1280)),
]
REVIEW = [(f"review_{w}", n, None, (1280, 720)) for w, n in (
    ("toybox", 23), ("candy", 73), ("hardhat", 123), ("skyisles", 173), ("neon", 223), ("glacier", 273),
    ("scrapyard", 323), ("shroom", 373), ("coral", 423), ("clockwork", 473), ("haunted", 523), ("orbit", 573), ("remix", 640))]
REVIEW2 = [("new_trapdoor", 149, "trapdoor", (1280, 720)), ("new_rollers", 75, "rollers", (1280, 720)), ("new_hops", 186, "hops", (1280, 720)),
           ("remix_630", 630, "rollers", (1280, 720)), ("remix_704", 704, "trapdoor", (1280, 720)), ("remix_741", 741, "loop", (1280, 720))]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } canvas.gz-canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
DRIVE = """async ([n, kind]) => {
  const g = window.__gizmo;
  g.load(n, 0, 'play');
  g.autopilot = true;
  g.play(); g.skip();
  g.stop();
  const mods = g.course.modules;
  const m = (kind && mods.find((q) => q.k === kind)) || mods[Math.min(1, mods.length - 1)];
  const target = m.x0 + (m.x1 - m.x0) * (kind === 'kicker' ? 0.62 : kind === 'loop' ? 0.72 : 0.5);
  // drive the game by hand, frame by frame (a background page may not get animation frames)
  let i = 0;
  for (; i < 60 * 90; i++) {
    g.frame(1 / 60);
    if (g.mode === 'play' && g.car.x > target) break;
    if (g.mode === 'over') break;
  }
  for (let k = 0; k < 2; k++) g.frame(1 / 60);
  return { x: g.car.x, target, frames: i, world: g.course.world.id, mode: g.mode, mods: mods.map((q) => q.k).join(',') };
}"""


def capture(scenes):
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        for name, stage, kind, (w, h) in scenes:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=gizmo-drive", wait_until="domcontentloaded", timeout=180000)
            pg.wait_for_function("() => window.__gizmo && window.__gizmo.course", timeout=180000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(800)
            info = pg.evaluate(DRIVE, [stage, kind])
            pg.wait_for_timeout(80)
            pg.screenshot(path=os.path.join(SHOTS, f"{name}.png"), timeout=60000)
            print("shot", name, info, flush=True)
            pg.close()
        b.close()


# ---------------------------------------------------------------- layout
def shot(name): return Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")


def cover_fit(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def backdrop(im, w, h, dark=0.45):
    bg = cover_fit(im, w, h).filter(ImageFilter.GaussianBlur(14))
    return Image.blend(bg, Image.new("RGB", (w, h), (14, 10, 34)), dark)


def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = im.convert("RGBA"); out.putalpha(m)
    return out


def card_of(im, w, h, angle, border=10, radius=26):
    c = cover_fit(im, w, h)
    frame = Image.new("RGB", (w + border * 2, h + border * 2), (255, 255, 255))
    frame.paste(c, (border, border))
    frame = rounded(frame, radius + border)
    rot = frame.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", (rot.width + 60, rot.height + 60), (0, 0, 0, 0))
    a = rot.split()[3].point(lambda v: v * 0.55)
    sh.paste(Image.new("RGBA", rot.size, (0, 0, 0, 255)), (40, 46), a)
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    sh.alpha_composite(rot, (20, 16))
    return sh


def outlined(draw, xy, text, font, fill, stroke, sw, shadow=None):
    x, y = xy
    if shadow: draw.text((x, y + sw * 1.1), text, font=font, fill=shadow, stroke_width=sw, stroke_fill=shadow)
    draw.text((x, y), text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke)


def gear(img, cx, cy, r):
    d = ImageDraw.Draw(img)
    import math
    pts = []
    for i in range(24):
        a = i / 24 * math.tau
        rr = r if i % 2 == 0 else r * 0.78
        for da in (-0.1, 0.1):
            pts.append((cx + math.cos(a + da) * rr, cy + math.sin(a + da) * rr))
    d.polygon(pts, fill=(255, 194, 51), outline=(20, 16, 42), width=max(3, r // 9))
    d.ellipse((cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3), fill=(20, 16, 42))


def title(img, x, y, size, center=False):
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT, size); f2 = ImageFont.truetype(FONT, int(size * 0.88))
    sw = max(4, size // 11)
    w1 = d.textlength("GIZM", font=f1) + size * 0.72
    tx = x - w1 / 2 if center else x
    outlined(d, (tx, y), "GIZM", f1, (77, 242, 196), (20, 16, 42), sw, shadow=(20, 16, 42))
    gear(img, int(tx + d.textlength("GIZM", font=f1) + size * 0.36), int(y + size * 0.55), int(size * 0.36))
    w2 = d.textlength("DRIVE", font=f2)
    tx2 = x - w2 / 2 if center else x
    outlined(d, (tx2, y + int(size * 0.86)), "DRIVE", f2, (183, 156, 255), (20, 16, 42), sw, shadow=(20, 16, 42))


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.7
    x0 = x - (w + pad * 2) / 2 if center else x
    d.rounded_rectangle((x0, y, x0 + w + pad * 2, y + size * 1.55), radius=int(size * 0.78), fill=bg)
    d.text((x0 + pad, y + size * 0.22), text, font=f, fill=fg)


def build():
    os.makedirs(OUT, exist_ok=True)
    toy, candy, hard, sky, neon, glacier, haunted, clock = (shot(n) for n in ("toy", "candy", "hardhat", "sky", "neon", "glacier", "haunted", "clock"))
    tall, tall2 = shot("tall"), shot("tall2")
    MINT, VIOLET, INK = (22, 211, 166), (124, 92, 255), (6, 42, 36)

    W, H = 1280, 720
    img = backdrop(neon, W, H, 0.4).convert("RGBA")
    img.alpha_composite(card_of(sky, 520, 300, -6), (690, 330))
    img.alpha_composite(card_of(neon, 600, 340, 4), (610, 40))
    title(img, 70, 140, 150)
    pill(img, 74, 440, "PHYSICS DRIVING", 30, VIOLET)
    pill(img, 74, 500, "600+ STAGES · 12 WORLDS", 30, MINT, INK)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    W, H = 1200, 630
    img = backdrop(toy, W, H, 0.42).convert("RGBA")
    img.alpha_composite(card_of(glacier, 470, 270, -6), (660, 300))
    img.alpha_composite(card_of(toy, 560, 315, 4), (590, 30))
    title(img, 60, 110, 140)
    pill(img, 64, 400, "PHYSICS DRIVING", 28, VIOLET)
    pill(img, 64, 456, "600+ STAGES · 12 WORLDS", 28, MINT, INK)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    W, H = 600, 800
    img = backdrop(candy, W, H, 0.4).convert("RGBA")
    title(img, W // 2, 34, 100, center=True)
    pill(img, W // 2, 240, "DON'T FLIP · REACH THE FLAG", 22, VIOLET, center=True)
    img.alpha_composite(card_of(sky, 470, 265, -5), (20, 310))
    img.alpha_composite(card_of(haunted, 470, 265, 6), (100, 515))
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    W, H = 1000, 1500
    img = cover_fit(tall, W, H).convert("RGBA")
    top = Image.new("RGBA", (W, 520), (0, 0, 0, 0)); g = ImageDraw.Draw(top)
    for i in range(520): g.line([(0, i), (W, i)], fill=(12, 8, 30, int(205 * (1 - i / 520))))
    img.alpha_composite(top, (0, 0))
    bot = Image.new("RGBA", (W, 560), (0, 0, 0, 0)); g = ImageDraw.Draw(bot)
    for i in range(560): g.line([(0, i), (W, i)], fill=(12, 8, 30, int(225 * (i / 560))))
    img.alpha_composite(bot, (0, H - 560))
    title(img, W // 2, 60, 180, center=True)
    pill(img, W // 2, 440, "SEESAWS · LIFTS · LOOPS · WRECKING BALLS", 30, MINT, INK, center=True)
    for i, s in enumerate((clock, tall2, toy)):
        img.alpha_composite(card_of(s, 280, 175, (-5, 0, 5)[i], border=8, radius=18), (30 + i * 315, H - 330))
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "review" in steps: capture(REVIEW)
    if "review2" in steps: capture(REVIEW2)
    if "capture" in steps: capture(SCENES)
    if "build" in steps: build()
