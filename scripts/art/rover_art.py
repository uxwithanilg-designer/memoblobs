"""Peak Rover key art, made from the real game: captures mid-jump moments from several worlds (headless Chrome, muted,
the dev server on PORT, default 3000) into scripts/art/out/rover, then lays them out like the site's other covers —
the title in the display font, tag pills, and tilted gameplay cards over a soft, darkened backdrop — into
public/games/peak-rover/: cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500), og.jpg (1200x630).

usage: PORT=3000 python scripts/art/rover_art.py [capture] [build]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "peak-rover")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "rover")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, stage, viewport): golden meadow, canyon, frost night, metro night, volcano, the moon, and a tall one
SCENES = [("meadow", 7, (1280, 720)), ("canyon", 64, (1280, 720)), ("frost", 236, (1280, 720)), ("metro", 262, (1280, 720)),
          ("volcano", 362, (1280, 720)), ("crater", 562, (1280, 720)), ("tall", 312, (720, 1280)), ("tall2", 465, (720, 1280))]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } canvas.rv-canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
JUMP = """async (n) => {
  const g = window.__peakRover;
  g.load(n, 0, 'play');
  const t = g.track, r = t.ramps.find((x) => x > 60) ?? t.ramps[0] ?? 120;
  g.rover.place(t.terrain, Math.max(4, r - 42));
  // drive the game by hand, frame by frame (a background page may not get animation frames)
  g.stop();
  g.setTouch(1, 0);
  for (let i = 0; i < 60 * 12; i++) {
    g.frame(1 / 60);
    if (g.rover.x > r + 2 && g.rover.airTime > 0.32) break;
  }
  g.setTouch(0, 0);
  g.frame(1 / 60);
  return { x: g.rover.x, air: g.rover.airTime, world: t.world.id };
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        for name, stage, (w, h) in SCENES:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=peak-rover", wait_until="domcontentloaded", timeout=120000)
            pg.wait_for_function("() => window.__peakRover && window.__peakRover.track", timeout=120000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
            info = pg.evaluate(JUMP, stage)
            pg.wait_for_timeout(60)
            pg.screenshot(path=os.path.join(SHOTS, f"{name}.png"), timeout=60000)
            print("shot", name, info, flush=True)
            pg.close()
        b.close()


# ---------------------------------------------------------------- layout
def shot(name):
    return Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")


def cover_fit(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def backdrop(im, w, h, dark=0.45):
    bg = cover_fit(im, w, h).filter(ImageFilter.GaussianBlur(14))
    shade = Image.new("RGB", (w, h), (12, 10, 30))
    return Image.blend(bg, shade, dark)


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
    if shadow:
        draw.text((x, y + sw * 1.1), text, font=font, fill=shadow, stroke_width=sw, stroke_fill=shadow)
    draw.text((x, y), text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke)


def title(img, x, y, size, center=False):
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT, int(size * 0.82)); f2 = ImageFont.truetype(FONT, size)
    sw = max(4, size // 11)
    for i, (txt, f, col) in enumerate((("PEAK", f1, (255, 210, 63)), ("ROVER", f2, (255, 122, 61)))):
        w = d.textlength(txt, font=f)
        tx = x - w / 2 if center else x
        ty = y + (0 if i == 0 else int(size * 0.74))
        outlined(d, (tx, ty), txt, f, col, (27, 20, 48), sw, shadow=(27, 20, 48))


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.7
    x0 = x - (w + pad * 2) / 2 if center else x
    d.rounded_rectangle((x0, y, x0 + w + pad * 2, y + size * 1.55), radius=int(size * 0.78), fill=bg)
    d.text((x0 + pad, y + size * 0.22), text, font=f, fill=fg)
    return x0 + w + pad * 2


def build():
    os.makedirs(OUT, exist_ok=True)
    meadow, canyon, frost, metro, volcano, crater = (shot(n) for n in ("meadow", "canyon", "frost", "metro", "volcano", "crater"))
    tall, tall2 = shot("tall"), shot("tall2")

    # cover 1280x720: title and pills on the left, two tilted gameplay cards on the right
    W, H = 1280, 720
    img = backdrop(meadow, W, H, 0.42).convert("RGBA")
    c2 = card_of(metro, 520, 300, -6); img.alpha_composite(c2, (690, 330))
    c1 = card_of(meadow, 600, 340, 4); img.alpha_composite(c1, (610, 40))
    title(img, 70, 150, 150)
    x = pill(img, 74, 440, "HILL CLIMB DRIVING", 30, (255, 79, 122))
    pill(img, 74, 500, "600+ STAGES · 12 WORLDS", 30, (255, 182, 39), (42, 19, 0))
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    # og 1200x630
    W, H = 1200, 630
    img = backdrop(canyon, W, H, 0.42).convert("RGBA")
    c2 = card_of(frost, 470, 270, -6); img.alpha_composite(c2, (660, 300))
    c1 = card_of(canyon, 560, 315, 4); img.alpha_composite(c1, (590, 30))
    title(img, 60, 120, 140)
    pill(img, 64, 400, "HILL CLIMB DRIVING", 28, (255, 79, 122))
    pill(img, 64, 456, "600+ STAGES · 12 WORLDS", 28, (255, 182, 39), (42, 19, 0))
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    # card 600x800: title on top, two cards below
    W, H = 600, 800
    img = backdrop(volcano, W, H, 0.4).convert("RGBA")
    title(img, W // 2, 40, 104, center=True)
    pill(img, W // 2, 250, "HILL CLIMB DRIVING", 24, (255, 79, 122), center=True)
    c1 = card_of(meadow, 470, 265, -5); img.alpha_composite(c1, (20, 320))
    c2 = card_of(crater, 470, 265, 6); img.alpha_composite(c2, (100, 520))
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    # poster 1000x1500: one tall scene, the title above, a strip of worlds below
    W, H = 1000, 1500
    img = cover_fit(tall, W, H).convert("RGBA")
    top = Image.new("RGBA", (W, 520), (0, 0, 0, 0))
    g = ImageDraw.Draw(top)
    for i in range(520): g.line([(0, i), (W, i)], fill=(10, 8, 26, int(200 * (1 - i / 520))))
    img.alpha_composite(top, (0, 0))
    bot = Image.new("RGBA", (W, 560), (0, 0, 0, 0))
    g = ImageDraw.Draw(bot)
    for i in range(560): g.line([(0, i), (W, i)], fill=(10, 8, 26, int(220 * (i / 560))))
    img.alpha_composite(bot, (0, H - 560))
    title(img, W // 2, 70, 190, center=True)
    pill(img, W // 2, 470, "CLIMB · FLY · NEVER STOP", 34, (255, 182, 39), (42, 19, 0), center=True)
    for i, s in enumerate((canyon, frost, metro)):
        cc = card_of(s, 280, 175, (-5, 0, 5)[i], border=8, radius=18)
        img.alpha_composite(cc, (30 + i * 315, H - 330))
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
