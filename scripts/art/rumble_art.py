"""Rumble Rally key art, made from the real game: races the pack a few seconds into a race in several worlds (headless
Chrome, muted, the dev server on PORT, default 3000), frame by frame, firing a rocket at the truck ahead, and captures
the moment into scripts/art/out/rumble. Then lays the shots out as the site's pictures — a full-bleed race scene with
a dark edge, the title in the display font, slanted pills and a strip of world snapshots — into
public/games/rumble-rally/: cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500) and og.jpg (1200x630).

usage: PORT=3000 python scripts/art/rumble_art.py [capture] [build]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "rumble-rally")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "rumble")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, stage, viewport, seconds after GO (-1: on the grid under the lights)): a spread of worlds and times
SCENES = [
    ("grid", 14, (1280, 720), -1), ("harbor", 152, (1280, 720), 3.2), ("cinder", 52, (1280, 720), 3.4), ("canopy", 203, (1280, 720), 3.0),
    ("polar", 108, (1280, 720), 3.3), ("candy", 453, (1280, 720), 3.0), ("boardwalk", 303, (1280, 720), 3.2), ("mars", 503, (1280, 720), 3.1),
    ("cloud", 553, (1280, 720), 3.0), ("dunes", 21, (1280, 720), 3.2),
    ("tall", 152, (720, 1280), 3.2), ("tall2", 303, (720, 1280), 3.0),
]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } canvas.rr-canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
DRIVE = """async ([n, secs]) => {
  const g = window.__rumbleRally;
  g.stop();
  const draw = g.render.bind(g);
  g.render = () => {};
  g.load(n, 'grid');
  const pilot = () => {
    const R = g.you.truck, co = g.course, T = co.terrain, top = R.spec.maxSpin * R.spec.wheel.r;
    let gas = 1, brake = 0;
    if (R.grounded) {
      const pitch = R.a - Math.atan(T.slopeAt(R.x));
      gas = R.forward < top * 0.95 ? 1 : 0.3; if (pitch > 0.42) gas = 0;
    } else { const land = Math.atan(T.slopeAt(R.x + Math.max(2, R.vx * 0.5))) + 0.06; const ctrl = -((R.a - land) * 2.2 + R.w * 0.38); gas = ctrl > 0.12 ? 1 : 0; brake = ctrl < -0.12 ? 1 : 0; }
    g.setTouch(gas, brake); g.setNitro(R.grounded && g.you.nitro > 0.3);
  };
  const tall = innerHeight > innerWidth;
  if (secs < 0) {
    for (let i = 0; i < 60 * 20 && !(g.mode === 'grid' && g.modeT > 4.6); i++) g.frame(1 / 60);
    g.render = draw;
    const xs = g.racers.map((r) => r.truck.x), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    g.cam.x = tall ? g.you.truck.x + 3 : mid + 1.5; g.cam.y = g.you.truck.y + (tall ? 2.6 : 2.2); g.cam.z = tall ? 0.95 : 0.82; g.cam.bars = 0; g.cam.rot = 0; g.cam.shake = 0;
    g.cam.ox = g.cam.x - g.you.truck.x; g.cam.oy = g.cam.y - g.you.truck.y;
    draw(1 / 60);
    return { world: g.course.world.id, mode: g.mode, lights: g.lights };
  }
  for (let i = 0; i < 60 * 20 && g.mode !== 'play'; i++) g.frame(1 / 60);
  let fired = false;
  for (let i = 0; i < 60 * secs; i++) {
    pilot();
    if (!fired && i > 60 * (secs - 0.55)) { g.fire(); fired = true; }
    g.frame(1 / 60);
  }
  g.setTouch(0, 0); g.setNitro(false);
  g.render = draw;
  // frame the pack: the player and the nearest rival, the player a little left of centre on wide shots
  const R = g.you.truck;
  let near = null, nd = 1e9;
  for (const r of g.racers) { if (r.you || r.ghost) continue; const d = Math.abs(r.truck.x - R.x); if (d < nd) { nd = d; near = r; } }
  const mid = near && nd < 16 ? (near.truck.x + R.x) / 2 : R.x + 2;
  g.cam.x = tall ? R.x + 0.4 : mid + 1.2; g.cam.y = R.y + (tall ? 1.4 : 1.3); g.cam.z = tall ? 1.2 : Math.min(1.15, 1 / (1 + Math.max(0, nd - 7) / 26)); g.cam.bars = 0; g.cam.rot = 0; g.cam.shake = 0; g.cam.slow = 1;
  g.cam.ox = g.cam.x - R.x; g.cam.oy = g.cam.y - R.y;
  draw(1 / 60);
  return { world: g.course.world.id, x: R.x, near: near && near.name, nd, burning: g.you.burning };
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        for name, stage, (w, h), secs in SCENES:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=rumble-rally", wait_until="domcontentloaded", timeout=180000)
            pg.wait_for_function("() => window.__rumbleRally && window.__rumbleRally.course", timeout=180000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1200)
            info = pg.evaluate(DRIVE, [stage, secs])
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


def edge(img, side, size, color=(9, 11, 28), alpha=230):
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


def thumb(im, w, h, border=6, radius=16, angle=0):
    c = cover_fit(im, w, h)
    frame = Image.new("RGB", (w + border * 2, h + border * 2), (255, 255, 255))
    frame.paste(c, (border, border))
    frame = rounded(frame, radius + border)
    if angle: frame = frame.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", (frame.width + 40, frame.height + 40), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", frame.size, (0, 0, 0, 255)), (24, 28), frame.split()[3].point(lambda v: v * 0.5))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    sh.alpha_composite(frame, (12, 10))
    return sh


def slanted(img, text_img, x, y):
    """paste a text layer slanted like the game's logo"""
    sk = text_img.transform(text_img.size, Image.AFFINE, (1, 0.16, -text_img.height * 0.08, 0, 1, 0), resample=Image.BICUBIC)
    img.alpha_composite(sk, (int(x), int(y)))


def checker(img, x, y, w, h, cell):
    d = ImageDraw.Draw(img)
    d.rectangle((x - 3, y - 3, x + w + 3, y + h + 3), fill=(13, 10, 30))
    for i in range(int(w // cell)):
        for j in range(int(h // cell)):
            d.rectangle((x + i * cell, y + j * cell, x + (i + 1) * cell - 1, y + (j + 1) * cell - 1), fill=(255, 255, 255) if (i + j) % 2 else (21, 22, 30))


def title(img, x, y, size, center=False):
    f = ImageFont.truetype(FONT, size)
    sw = max(4, size // 11)
    lines = (("RUMBLE", (255, 210, 63)), ("RALLY", (255, 61, 110)))
    layer_w = int(max(ImageDraw.Draw(img).textlength(t, font=f) for t, _ in lines) + sw * 4 + size * 0.3)
    layer = Image.new("RGBA", (layer_w, int(size * 2.1)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, (txt, col) in enumerate(lines):
        w = d.textlength(txt, font=f)
        tx = (layer_w - w) / 2 if center else sw * 2
        ty = i * int(size * 0.86)
        d.text((tx, ty + sw * 1.2), txt, font=f, fill=(13, 10, 30), stroke_width=sw, stroke_fill=(13, 10, 30))
        d.text((tx, ty), txt, font=f, fill=col, stroke_width=sw, stroke_fill=(13, 10, 30))
    lx = x - layer_w / 2 if center else x
    slanted(img, layer, lx, y)
    bw = int(layer_w * 0.72)
    checker(img, int(lx + (layer_w - bw) / 2 if center else lx + sw * 2 + size * 0.05), int(y + size * 1.86), bw, max(10, size // 9), max(5, size // 18))


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.75
    x0 = x - (w + pad * 2) / 2 if center else x
    sk = size * 0.28
    d.polygon([(x0 + sk, y), (x0 + w + pad * 2 + sk, y), (x0 + w + pad * 2 - sk, y + size * 1.55), (x0 - sk, y + size * 1.55)], fill=bg)
    d.text((x0 + pad, y + size * 0.2), text, font=f, fill=fg)
    return x0 + w + pad * 2


def strip(img, names, x, y, w, h, gap):
    for i, n in enumerate(names):
        img.alpha_composite(thumb(shot(n), w, h, 5, 12, (-3, 2, -2, 3)[i % 4]), (x + i * (w + gap), y))


def build():
    os.makedirs(OUT, exist_ok=True)
    WHITE, PINK, NAVY, YELLOW = (255, 255, 255), (242, 38, 78), (13, 10, 30), (255, 210, 63)

    # cover 1280x720: a full-bleed race scene, dark on the left, the title, pills and a strip of worlds
    W, H = 1280, 720
    img = cover_fit(shot("harbor"), W, H, 0.62, 0.55).convert("RGBA")
    edge(img, "left", 780); edge(img, "bottom", 260, alpha=170)
    title(img, 56, 54, 138)
    pill(img, 74, 352, "MONSTER TRUCK RACING", 30, PINK)
    pill(img, 74, 412, "600+ RACES · 12 WORLDS", 30, YELLOW, NAVY)
    strip(img, ["canopy", "candy", "mars"], 56, 520, 200, 120, 22)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    # og 1200x630
    W, H = 1200, 630
    img = cover_fit(shot("grid"), W, H, 0.6, 0.55).convert("RGBA")
    edge(img, "left", 720); edge(img, "bottom", 220, alpha=160)
    title(img, 48, 40, 126)
    pill(img, 64, 316, "RACE · RAM · ROCKET", 28, PINK)
    pill(img, 64, 372, "600+ RACES · 12 WORLDS", 28, YELLOW, NAVY)
    strip(img, ["cinder", "polar", "boardwalk"], 48, 452, 188, 112, 20)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    # card 600x800: a tall scene, the title on top
    W, H = 600, 800
    img = cover_fit(shot("tall"), W, H, 0.5, 0.62).convert("RGBA")
    edge(img, "top", 420, alpha=235); edge(img, "bottom", 220, alpha=170)
    title(img, W // 2, 30, 104, center=True)
    pill(img, W // 2, 268, "MONSTER TRUCK RACING", 24, PINK, center=True)
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    # poster 1000x1500: one tall scene, the title above, worlds below
    W, H = 1000, 1500
    img = cover_fit(shot("tall2"), W, H, 0.5, 0.6).convert("RGBA")
    edge(img, "top", 620, alpha=235); edge(img, "bottom", 560, alpha=225)
    title(img, W // 2, 60, 176, center=True)
    pill(img, W // 2, 470, "RACE · RAM · ROCKET", 34, PINK, center=True)
    strip(img, ["dunes", "cloud", "cinder"], 28, H - 300, 280, 170, 30)
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
