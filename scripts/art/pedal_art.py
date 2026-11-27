"""Obby Bike Blaster key art, made from the real game: captures moments from several worlds (headless Chrome, muted,
the dev server on PORT, default 3000) into scripts/art/out/pedal — the rider in mid-air off a ramp or a jelly pad,
blasting a crate wall, wide views down the course — plus the pixel logo from the home screen, then lays them out like
the site's other covers into public/games/obby-bike-blaster/: cover.webp (1280x720), card.webp (600x800),
poster.webp (1000x1500) and og.jpg (1200x630).

usage: PORT=3000 python scripts/art/pedal_art.py [capture] [build]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "obby-bike-blaster")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "pedal")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
URL = f"http://localhost:{PORT}/play?g=obby-bike-blaster"
READY = "() => window.__obbybike && window.__obbybike.course"
# draw the last frame inside an animation frame, so the browser presents it before the screenshot
PRESENT = "() => new Promise((r) => requestAnimationFrame(() => { window.__obbybike.frame(1 / 240); requestAnimationFrame(() => requestAnimationFrame(() => r(true))); }))"
# (name, level, viewport, part, camera): the part of the course to ride into; the camera: side = a low side view of
# the jump, front = ahead of the rider looking back, blast = over the shoulder at a crate wall, wide = high above
SCENES = [
    ("air", 14, (1280, 720), "rampJump", "side"), ("jelly", 437, (1280, 720), "bounce", "front"),
    ("blast", 1090, (1280, 720), "crates", "blast"), ("neon", 380, (1280, 720), "spinner", "wide"),
    ("frost", 262, (1280, 720), "boostGap", "side"), ("jungle", 200, (1280, 720), "rampJump", "front"),
    ("haunt", 620, (1280, 720), "pillars", "wide"), ("tall", 1090, (720, 1280), "bounce", "front"),
]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } .ob-stage, .ob-stage * { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
SHOOT = """async ([n, part, cam]) => {
  const g = window.__obbybike;
  g.stop();
  g.load(n, 'attract');
  let s = g.course.patterns.findIndex((p, i) => i > 0 && p === part);
  if (s < 1) s = 1;
  g.load(n, 'attract', s - 1);
  g.mode = 'play'; g.powers.set('shield', 99);
  g.keys.add('w');
  const b = g.bike;
  let air = 0;
  if (part === 'crates') {
    // stand a few metres short of the crate wall and open fire
    const wall = g.dynamic.filter((p) => p.kind === 'crate' && p.section === s);
    if (wall.length) {
      const x0 = Math.min(...wall.map((p) => p.x0)), x1 = Math.max(...wall.map((p) => p.x1)), y0 = Math.min(...wall.map((p) => p.y0)), z0 = wall[0].z0;
      g.keys.clear();
      b.place((x0 + x1) / 2, y0, z0 - 6.5, 0);
      g.setFire(true);
      for (let k = 0; k < 26; k++) g.frame(1 / 60);
    }
  }
  for (let i = 0; i < 900 && part !== 'crates'; i++) {
    // jump off the end of a ramp (or any edge)
    if (b.onGround && b.ground && (b.ground.ramp || b.ground.kind === 'boost')) {
      const g2 = b.ground; if (g2.ramp && g2.z1 - b.z < 0.9) g.jump();
    }
    if (part !== 'crates' && part !== 'spinner' && part !== 'pillars' && !b.onGround && b.airT > 0.25 && b.vy < 3) { air = 1; break; }
    if ((part === 'spinner' || part === 'pillars') && b.z > g.course.checkpoints[s - 1].z + 14) break;
    g.frame(1 / 60);
    if (g.mode !== 'play') { g.mode = 'play'; }
  }
  g.keys.clear();
  const yaw = b.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const x = b.x, y = b.y, z = b.z;
  if (cam === 'side') g.photoCam = [x + rx * 6.2 + fx * 2.6, y + 1.0, z + rz * 6.2 + fz * 2.6, x - fx * 0.6, y + 1.1, z - fz * 0.6];
  if (cam === 'front') g.photoCam = [x + fx * 5.2 + rx * 2.6, y + 1.9, z + fz * 5.2 + rz * 2.6, x - fx * 1.5, y + 0.9, z - fz * 1.5];
  if (cam === 'blast') g.photoCam = [x - fx * 3.0 + rx * 1.5, y + 2.0, z - fz * 3.0 + rz * 1.5, x + fx * 8, y + 1.2, z + fz * 8];
  if (cam === 'wide') g.photoCam = [x + rx * 13 - fx * 8, y + 11, z + rz * 13 - fz * 8, x + fx * 16, y - 1, z + fz * 16];
  g.frame(1 / 60); g.frame(1 / 60);
  g.setFire(false);
  return { world: g.world.name, part, air, z: Math.round(z) };
}"""


def ready(pg):
    pg.wait_for_function(READY, timeout=120000)


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        # the logo, from the home screen, on a green screen (made transparent later)
        pg = b.new_page(viewport={"width": 1000, "height": 700}, device_scale_factor=2)
        pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
        ready(pg)
        pg.wait_for_timeout(2500)
        pg.add_style_tag(content="* { background: #00ff00 !important; } body * { visibility: hidden !important; } .ob-logo, .ob-logo * { visibility: visible !important; } nextjs-portal { display: none !important; } .ob-logo { filter: none !important; } .ob-logo span { animation: none !important; }")
        pg.wait_for_timeout(300)
        pg.locator(".ob-logo").screenshot(path=os.path.join(SHOTS, "logo.png"))
        pg.close()
        for name, level, (w, h), part, cam in SCENES:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
            ready(pg)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
            # headless Chrome now and then shows a frame that never got drawn: check, and shoot again
            for attempt in range(6):
                info = pg.evaluate(SHOOT, [level, part, cam])
                pg.evaluate(PRESENT)
                pg.wait_for_timeout(250)
                path = os.path.join(SHOTS, f"{name}.png")
                pg.screenshot(path=path, timeout=60000)
                lo, hi = Image.open(path).convert("L").getextrema()
                if hi - lo > 40: break
                print("blank frame, again", name, flush=True)
                pg.reload(wait_until="domcontentloaded", timeout=120000)
                ready(pg)
                pg.evaluate(HIDE)
                pg.wait_for_timeout(1500)
            print("shot", name, info, flush=True)
            pg.close()
        b.close()


# ---------------------------------------------------------------- layout
def shot(name):
    return Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")


def cover_fit(im, w, h, fy=0.5):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, int((im.height - h) * fy)
    return im.crop((x, y, x + w, y + h))


def backdrop(im, w, h, dark=0.45):
    bg = cover_fit(im, w, h).filter(ImageFilter.GaussianBlur(12))
    shade = Image.new("RGB", (w, h), (8, 14, 34))
    return Image.blend(bg, shade, dark)


def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = im.convert("RGBA"); out.putalpha(m)
    return out


def card_of(im, w, h, angle, border=10, radius=22):
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


def keyed(path):
    """a picture shot on a green screen, with the green made transparent"""
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if g > 140 and g > r * 1.4 and g > b * 1.4:
                px[x, y] = (0, 0, 0, 0)
            elif g > r and g > b and g - max(r, b) > 30:  # green fringe on the edges
                px[x, y] = (r, max(r, b), b, 160)
    return im


def logo(width):
    im = keyed(os.path.join(SHOTS, "logo.png"))
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    h = int(im.height * width / im.width)
    return im.resize((width, h), Image.NEAREST if width >= im.width else Image.LANCZOS)


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.7
    x0 = x - (w + pad * 2) / 2 if center else x
    d.rounded_rectangle((x0, y + 4, x0 + w + pad * 2, y + size * 1.55 + 4), radius=int(size * 0.3), fill=(0, 0, 0))
    d.rounded_rectangle((x0, y, x0 + w + pad * 2, y + size * 1.55), radius=int(size * 0.3), fill=bg)
    d.text((x0 + pad, y + size * 0.22), text, font=f, fill=fg)
    return x0 + w + pad * 2


def build():
    os.makedirs(OUT, exist_ok=True)
    air, jelly, blast, neon, frost, jungle, haunt, tall = (shot(n) for n in ("air", "jelly", "blast", "neon", "frost", "jungle", "haunt", "tall"))
    BLUE, GOLD = (62, 197, 255), (255, 194, 61)

    # cover 1280x720: the jump full-bleed, the logo and pills on the left over a dark fade
    W, H = 1280, 720
    # mirrored and zoomed a little, so the rider flies on the right, clear of the logo
    m = ImageOps.mirror(air)
    cw, ch = int(m.width * 0.84), int(m.height * 0.84)
    x0 = max(0, min(m.width - cw, int(m.width * 0.6) - int(cw * 0.64))); y0 = max(0, min(m.height - ch, int(m.height * 0.52) - ch // 2))
    img = m.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.LANCZOS).convert("RGBA")
    fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(fade)
    for i in range(W // 2): g.line([(i, 0), (i, H)], fill=(6, 12, 30, int(200 * (1 - i / (W / 2)) ** 1.4)))
    img.alpha_composite(fade)
    lg = logo(500); img.alpha_composite(lg, (56, 110))
    pill(img, 64, 130 + lg.height + 24, "3D PIXEL BIKE OBBY", 30, BLUE, (6, 24, 44))
    pill(img, 64, 130 + lg.height + 86, "1200+ LEVELS · 20 WORLDS", 30, GOLD, (42, 19, 0))
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=80)

    # og 1200x630
    W, H = 1200, 630
    img = backdrop(neon, W, H, 0.38).convert("RGBA")
    c2 = card_of(blast, 470, 265, -6); img.alpha_composite(c2, (660, 310))
    c1 = card_of(air, 560, 315, 4); img.alpha_composite(c1, (590, 24))
    lg = logo(480); img.alpha_composite(lg, (50, 100))
    pill(img, 60, 120 + lg.height + 20, "3D PIXEL BIKE OBBY", 28, BLUE, (6, 24, 44))
    pill(img, 60, 120 + lg.height + 78, "1200+ LEVELS · 20 WORLDS", 28, GOLD, (42, 19, 0))
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=86)

    # card 600x800: the logo on top, two gameplay cards below
    W, H = 600, 800
    img = backdrop(frost, W, H, 0.35).convert("RGBA")
    lg = logo(460); img.alpha_composite(lg, ((W - lg.width) // 2, 30))
    pill(img, W // 2, 40 + lg.height + 14, "RIDE · JUMP · BLAST", 24, BLUE, (6, 24, 44), center=True)
    c1 = card_of(air, 470, 265, -5); img.alpha_composite(c1, (20, 330))
    c2 = card_of(jelly, 470, 265, 6); img.alpha_composite(c2, (96, 530))
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=80)

    # poster 1000x1500: one tall jump, the logo above, a strip of worlds below
    W, H = 1000, 1500
    img = cover_fit(tall, W, H).convert("RGBA")
    top = Image.new("RGBA", (W, 560), (0, 0, 0, 0))
    g = ImageDraw.Draw(top)
    for i in range(560): g.line([(0, i), (W, i)], fill=(6, 12, 30, int(210 * (1 - i / 560))))
    img.alpha_composite(top, (0, 0))
    bot = Image.new("RGBA", (W, 560), (0, 0, 0, 0))
    g = ImageDraw.Draw(bot)
    for i in range(560): g.line([(0, i), (W, i)], fill=(6, 12, 30, int(225 * (i / 560))))
    img.alpha_composite(bot, (0, H - 560))
    lg = logo(760); img.alpha_composite(lg, ((W - lg.width) // 2, 70))
    pill(img, W // 2, 90 + lg.height + 20, "RIDE · JUMP · BLAST · NEVER FALL", 32, GOLD, (42, 19, 0), center=True)
    for i, s in enumerate((jungle, blast, haunt)):
        cc = card_of(s, 280, 175, (-5, 0, 5)[i], border=8, radius=16)
        img.alpha_composite(cc, (30 + i * 315, H - 330))
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=80)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
