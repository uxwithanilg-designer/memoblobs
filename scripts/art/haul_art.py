"""Tumble Truck key art, made from the real game: drives the truck over a crest in several worlds (headless Chrome,
muted, the dev server on PORT, default 3000), frame by frame, and captures the moment the load bounces in the bed
into scripts/art/out/haul. Then lays the shots out as the site's pictures — a full-bleed hero scene with a dark edge,
the title in the display font, ticket-style pills and a strip of world snapshots — into public/games/tumble-truck/:
cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500) and og.jpg (1200x630).

usage: PORT=3000 python scripts/art/haul_art.py [capture] [build]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "tumble-truck")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "haul")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, stage, viewport, truck): a spread of worlds, times and trucks, and two tall ones for the posters
SCENES = [
    ("pinewood", 8, (1280, 720), "mudbug"), ("orchard", 61, (1280, 720), "timberjaw"), ("bayou", 116, (1280, 720), "mudbug"),
    ("honey", 160, (1280, 720), "glowtail"), ("frost", 412, (1280, 720), "thunderhoof"), ("blossom", 461, (1280, 720), "mudbug"),
    ("glowcap", 309, (1280, 720), "glowtail"), ("starfall", 566, (1280, 720), "thunderhoof"), ("redrock", 263, (1280, 720), "timberjaw"),
    ("tall", 214, (720, 1280), "mudbug"), ("tall2", 418, (720, 1280), "glowtail"),
]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } canvas.tt-canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
DRIVE = """async ([n, truck]) => {
  const g = window.__tumbleTruck;
  g.stop();
  g.opts.truck = truck;
  g.load(n, 0, 'play');
  const c = g.course;
  // a crest (or a ramp) away from the start, or a third of the way along
  const target = c.crests.find((x) => x > 60) ?? c.ramps.find((x) => x > 60) ?? c.finish * 0.33;
  // keep the game's own stack (two rows), moved with the truck
  const T0 = g.truck, b = T0.spec.bed, ca = Math.cos(T0.a), sa = Math.sin(T0.a);
  const slots = T0.cargo.map((q) => { const dx = q.x - T0.x, dy = q.y - T0.y; return { kind: q.kind, x: dx * ca + dy * sa - b.x0, y: -dx * sa + dy * ca - b.y + 0.01, scale: q.scale, seed: q.seed }; });
  g.truck.place(c.terrain, Math.max(4, target - 26));
  g.cp = 0;
  g.place = () => {};
  g.truck.loadCargo(slots);
  for (let i = 0; i < 200; i++) g.truck.step(c.terrain, { gas: 0, brake: 0 });
  g.cam.x = g.truck.x + 4; g.cam.y = g.truck.y + 1; g.cam.z = 1; g.cam.bars = 0;
  // drive the game by hand, frame by frame (a background page may not get animation frames)
  let best = null;
  for (let i = 0; i < 60 * 14; i++) {
    const v = g.truck.forward;
    g.setTouch(v < 7 && i % 10 < 6 ? 1 : 0, 0);
    g.frame(1 / 60);
    if (g.truck.x > target - 4 && (!g.truck.grounded || g.truck.x > target + 3)) { best = i; break; }
  }
  g.setTouch(0, 0);
  for (let i = 0; i < 3; i++) g.frame(1 / 60);
  // frame the shot: on wide pictures the truck sits right of centre (the title goes on the left), a little closer
  const tall = innerHeight > innerWidth;
  g.cam.x = g.truck.x + (tall ? 0.6 : -4.2); g.cam.y = g.truck.y + (tall ? 1.6 : 1.1); g.cam.z = tall ? 1.15 : 1.25; g.cam.bars = 0; g.cam.rot = 0;
  g.frame(1 / 60);
  return { x: g.truck.x, world: c.world.id, air: g.truck.airTime, aboard: g.truck.aboard, best };
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        for name, stage, (w, h), truck in SCENES:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=tumble-truck", wait_until="domcontentloaded", timeout=180000)
            pg.wait_for_function("() => window.__tumbleTruck && window.__tumbleTruck.course", timeout=180000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1200)
            info = pg.evaluate(DRIVE, [stage, truck])
            pg.wait_for_timeout(60)
            pg.screenshot(path=os.path.join(SHOTS, f"{name}.png"), timeout=60000)
            print("shot", name, info, flush=True)
            pg.close()
        b.close()


# ---------------------------------------------------------------- layout
def shot(name): return Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")


def cover_fit(im, w, h, fx=0.5, fy=0.5):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = int((im.width - w) * fx), int((im.height - h) * fy)
    return im.crop((x, y, x + w, y + h))


def edge(img, side, size, color=(12, 14, 34), alpha=230):
    """a soft dark gradient along one side (for the title to sit on)"""
    w, h = img.size
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    for i in range(size):
        a = int(alpha * (1 - i / size) ** 1.6)
        if side == "left": d.line([(i, 0), (i, h)], fill=color + (a,))
        elif side == "top": d.line([(0, i), (w, i)], fill=color + (a,))
        else: d.line([(0, h - 1 - i), (w, h - 1 - i)], fill=color + (a,))
    img.alpha_composite(g)


def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = im.convert("RGBA"); out.putalpha(m)
    return out


def thumb(im, w, h, border=6, radius=18, angle=0):
    c = cover_fit(im, w, h)
    frame = Image.new("RGB", (w + border * 2, h + border * 2), (255, 249, 238))
    frame.paste(c, (border, border))
    frame = rounded(frame, radius + border)
    if angle: frame = frame.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", (frame.width + 40, frame.height + 40), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", frame.size, (0, 0, 0, 255)), (24, 28), frame.split()[3].point(lambda v: v * 0.5))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    sh.alpha_composite(frame, (12, 10))
    return sh


def outlined(d, xy, text, font, fill, stroke, sw):
    x, y = xy
    d.text((x, y + sw * 1.15), text, font=font, fill=stroke, stroke_width=sw, stroke_fill=stroke)
    d.text((x, y), text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke)


def title(img, x, y, size, center=False):
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT, int(size * 0.78)); f2 = ImageFont.truetype(FONT, size)
    sw = max(4, size // 11)
    for i, (txt, f, col) in enumerate((("TUMBLE", f1, (255, 210, 63)), ("TRUCK", f2, (255, 106, 44)))):
        w = d.textlength(txt, font=f)
        tx = x - w / 2 if center else x
        ty = y + (0 if i == 0 else int(size * 0.7))
        outlined(d, (tx, ty), txt, f, col, (28, 20, 48), sw)


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.7
    x0 = x - (w + pad * 2) / 2 if center else x
    d.rounded_rectangle((x0, y, x0 + w + pad * 2, y + size * 1.55), radius=int(size * 0.5), fill=bg)
    d.text((x0 + pad, y + size * 0.2), text, font=f, fill=fg)
    return x0 + w + pad * 2


def strip(img, names, x, y, w, h, gap):
    for i, n in enumerate(names):
        img.alpha_composite(thumb(shot(n), w, h, 5, 14, (-3, 2, -2, 3)[i % 4]), (x + i * (w + gap), y))


def build():
    os.makedirs(OUT, exist_ok=True)
    CREAM, ORANGE, NAVY = (255, 249, 238), (255, 106, 44), (28, 20, 48)

    # cover 1280x720: a full-bleed scene, dark on the left, the title, pills and a strip of worlds
    W, H = 1280, 720
    img = cover_fit(shot("pinewood"), W, H, 0.62, 0.55).convert("RGBA")
    edge(img, "left", 760); edge(img, "bottom", 260, alpha=170)
    title(img, 64, 70, 150)
    x = pill(img, 70, 360, "MONSTER TRUCK DELIVERY", 30, ORANGE)
    pill(img, 70, 420, "600+ STAGES · 12 WORLDS", 30, CREAM, NAVY)
    strip(img, ["bayou", "frost", "blossom"], 56, 520, 200, 120, 22)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    # og 1200x630
    W, H = 1200, 630
    img = cover_fit(shot("orchard"), W, H, 0.6, 0.55).convert("RGBA")
    edge(img, "left", 720); edge(img, "bottom", 220, alpha=160)
    title(img, 56, 52, 140)
    pill(img, 62, 330, "MONSTER TRUCK DELIVERY", 28, ORANGE)
    pill(img, 62, 386, "600+ STAGES · 12 WORLDS", 28, CREAM, NAVY)
    strip(img, ["glowcap", "starfall", "honey"], 48, 456, 188, 112, 20)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    # card 600x800: a tall scene, the title on top
    W, H = 600, 800
    img = cover_fit(shot("tall"), W, H, 0.5, 0.62).convert("RGBA")
    edge(img, "top", 420, alpha=235); edge(img, "bottom", 220, alpha=170)
    title(img, W // 2, 40, 112, center=True)
    pill(img, W // 2, 262, "MONSTER TRUCK DELIVERY", 24, ORANGE, center=True)
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    # poster 1000x1500: one tall scene, the title above, worlds below
    W, H = 1000, 1500
    img = cover_fit(shot("tall2"), W, H, 0.5, 0.6).convert("RGBA")
    edge(img, "top", 620, alpha=235); edge(img, "bottom", 560, alpha=225)
    title(img, W // 2, 70, 190, center=True)
    pill(img, W // 2, 455, "DRIVE EASY · DELIVER IT ALL", 34, ORANGE, center=True)
    strip(img, ["redrock", "bayou", "frost"], 28, H - 300, 280, 170, 30)
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
