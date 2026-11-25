"""Cube Clash key art, made from the real game: captures matches from several maps (headless Chrome, muted, the dev
server on PORT, default 3000) into scripts/art/out/clash — a sky-island fight with rivals bridging in, a crystal battle,
a Titan, an obby run, a zombie night — plus the 8-bit logo from the home screen, then lays them out like the site's
other covers into public/games/cube-clash/: cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500) and
og.jpg (1200x630).

usage: PORT=3000 python scripts/art/clash_art.py [capture] [build]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "cube-clash")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "clash")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
URL = f"http://localhost:{PORT}/play?g=cube-clash"
# (name, stage, viewport, kind)
SCENES = [
    ("sky", 5, (1280, 720), "fight"), ("wide", 9, (1280, 720), "wide"), ("crystal", 53, (1280, 720), "wide"),
    ("titan", 10, (1280, 720), "titan"), ("obby", 102, (1280, 720), "obby"), ("zombie", 154, (1280, 720), "fight"),
    ("tall", 305, (720, 1280), "fight"),
]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } .cc-stage > canvas:first-child { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
PRESENT = "() => new Promise((r) => requestAnimationFrame(() => { window.__cubeclash.frame(1 / 240); requestAnimationFrame(() => requestAnimationFrame(() => r(true))); }))"
SHOOT = """async ([n, kind]) => {
  const g = window.__cubeclash;
  g.stop(); g.photoCam = null;
  g.load(n, 'attract'); g.play(); g.phaseT = 99; g.frame(1 / 60);
  g.powers.set('shield', 999);
  const secs = kind === 'wide' ? 22 : kind === 'titan' ? 3 : kind === 'obby' ? 0.5 : 14;
  for (let k = 0; k < 30 * secs; k++) { g.frame(1 / 30); g.p.hp = g.p.maxHp; }
  const p = g.p, c = g.map.center;
  if (kind === 'wide') { g.photoCam = [c.x - 28, c.y + 18, c.z - 30, c.x + 2, c.y - 2, c.z + 3]; g.frame(1 / 60); return { mode: g.plan.mode }; }
  if (kind === 'obby') { g.camYaw = 0.2; g.camPitch = -0.15; g.frame(1 / 60); g.photoCam = [p.x - 3.5, p.y + 3.2, p.z - 4.5, p.x + 1, p.y + 1.5, p.z + 10]; g.frame(1 / 60); return { mode: g.plan.mode }; }
  if (kind === 'titan') {
    const t = g.titan, fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
    p.x = t.x + fx * 10; p.z = t.z + fz * 10; p.y = g.map.vox.top(p.x, p.z) + 0.01;
    g.camYaw = Math.atan2(t.x - p.x, t.z - p.z); g.camPitch = 0.25;
    g.powers.set('rocket', 99); g.setFire(true); for (let k = 0; k < 40; k++) g.frame(1 / 60); g.setFire(false);
    const yaw = g.camYaw, gx = Math.sin(yaw), gz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    g.photoCam = [p.x - gx * 3.2 + rx * 1.6, p.y + 1.9, p.z - gz * 3.2 + rz * 1.6, t.x, t.y + 3.6, t.z];
    g.setFire(true); g.frame(1 / 60); g.setFire(false); g.frame(1 / 240);
    return { mode: g.plan.mode };
  }
  // a fight: aim at the nearest rival (or mob) and fire
  const foes = g.rivals.filter((r) => r.alive && r.team !== 0).map((r) => r).concat(g.mobs.filter((m) => m.alive));
  foes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const f = foes[0];
  if (f) { g.camYaw = Math.atan2(f.x - p.x, f.z - p.z) - 0.08; g.camPitch = Math.atan2(f.y + 1 - (p.y + 1.5), Math.max(1, Math.hypot(f.x - p.x, f.z - p.z))); }
  g.setFire(true); for (let k = 0; k < 10; k++) g.frame(1 / 60); g.setFire(false);
  const yaw = g.camYaw, gx = Math.sin(yaw), gz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
  g.photoCam = [p.x - gx * 2.4 + rx * 1.7, p.y + 1.7, p.z - gz * 2.4 + rz * 1.7, p.x + gx * 8 - rx * 0.6, p.y + 1.2, p.z + gz * 8 - rz * 0.6];
  g.setFire(true); g.frame(1 / 60); g.setFire(false); g.frame(1 / 240);
  return { mode: g.plan.mode, foes: foes.length };
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(viewport={"width": 1000, "height": 700}, device_scale_factor=2)
        pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
        pg.wait_for_function("() => window.__cubeclash && window.__cubeclash.map", timeout=120000)
        pg.wait_for_timeout(2500)
        pg.add_style_tag(content="* { background: #ff00ff !important; } .cc-stage, nextjs-portal, .cc-tag, .cc-card, .cc-btn { visibility: hidden !important; } .cc-logo { filter: none !important; } .cc-logo span { animation: none !important; }")
        pg.wait_for_timeout(300)
        pg.locator(".cc-logo").screenshot(path=os.path.join(SHOTS, "logo.png"))
        pg.close()
        for name, stage, (w, h), kind in SCENES:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
            pg.wait_for_function("() => window.__cubeclash && window.__cubeclash.map", timeout=120000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
            info = None
            for attempt in range(6):
                info = pg.evaluate(SHOOT, [stage, kind])
                pg.evaluate(PRESENT)
                pg.wait_for_timeout(250)
                path = os.path.join(SHOTS, f"{name}.png")
                pg.screenshot(path=path, timeout=60000)
                lo, hi = Image.open(path).convert("L").getextrema()
                if hi - lo > 40: break
                print("blank frame, again", name, flush=True)
                pg.reload(wait_until="domcontentloaded")
                pg.wait_for_function("() => window.__cubeclash && window.__cubeclash.map", timeout=120000)
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


def backdrop(im, w, h, dark=0.4):
    bg = cover_fit(im, w, h).filter(ImageFilter.GaussianBlur(12))
    return Image.blend(bg, Image.new("RGB", (w, h), (10, 16, 48)), dark)


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
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if g > 140 and g > r * 1.4 and g > b * 1.4: px[x, y] = (0, 0, 0, 0)
            elif g > r and g > b and g - max(r, b) > 30: px[x, y] = (r, max(r, b), b, 160)
    return im


def keyed_magenta(path):
    """the logo is shot on magenta (its letters are white and light green)"""
    im = Image.open(path).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r > 140 and b > 140 and g < min(r, b) * 0.55: px[x, y] = (0, 0, 0, 0)
            elif r > g + 40 and b > g + 40: px[x, y] = (g, g, g, 150)  # magenta fringe
    return im


def logo(width):
    im = keyed_magenta(os.path.join(SHOTS, "logo.png"))
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    return im.resize((width, int(im.height * width / im.width)), Image.LANCZOS)


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.7
    x0 = x - (w + pad * 2) / 2 if center else x
    d.rounded_rectangle((x0, y + 4, x0 + w + pad * 2, y + size * 1.55 + 4), radius=int(size * 0.3), fill=(0, 0, 0))
    d.rounded_rectangle((x0, y, x0 + w + pad * 2, y + size * 1.55), radius=int(size * 0.3), fill=bg)
    d.text((x0 + pad, y + size * 0.22), text, font=f, fill=fg)


def build():
    os.makedirs(OUT, exist_ok=True)
    sky, wide, crystal, titan, obby, zombie, tall = (shot(n) for n in ("sky", "wide", "crystal", "titan", "obby", "zombie", "tall"))
    GREEN, BLUE = (56, 217, 107), (61, 139, 255)

    # cover 1280x720: the wide sky battle full-bleed, the logo and pills on the left over a dark fade
    W, H = 1280, 720
    img = cover_fit(wide, W, H).convert("RGBA")
    fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(fade)
    for i in range(W // 2): g.line([(i, 0), (i, H)], fill=(8, 12, 40, int(205 * (1 - i / (W / 2)) ** 1.4)))
    img.alpha_composite(fade)
    lg = logo(500); img.alpha_composite(lg, (56, 120))
    pill(img, 64, 140 + lg.height + 24, "BUILD · BRIDGE · BLAST", 30, GREEN, (6, 35, 15))
    pill(img, 64, 140 + lg.height + 86, "1000+ STAGES · 20 MAPS", 30, BLUE)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=88)

    # og 1200x630
    W, H = 1200, 630
    img = backdrop(crystal, W, H, 0.35).convert("RGBA")
    c2 = card_of(titan, 470, 265, -6); img.alpha_composite(c2, (660, 310))
    c1 = card_of(sky, 560, 315, 4); img.alpha_composite(c1, (590, 24))
    lg = logo(470); img.alpha_composite(lg, (50, 110))
    pill(img, 60, 130 + lg.height + 20, "3D BLOCK SHOOTER", 28, GREEN, (6, 35, 15))
    pill(img, 60, 130 + lg.height + 78, "SKY WARS · CRYSTALS · OBBY", 28, BLUE)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    # card 600x800
    W, H = 600, 800
    img = backdrop(zombie, W, H, 0.35).convert("RGBA")
    lg = logo(450); img.alpha_composite(lg, ((W - lg.width) // 2, 34))
    pill(img, W // 2, 44 + lg.height + 14, "BUILD · BRIDGE · BLAST", 24, GREEN, (6, 35, 15), center=True)
    c1 = card_of(wide, 470, 265, -5); img.alpha_composite(c1, (20, 330))
    c2 = card_of(titan, 470, 265, 6); img.alpha_composite(c2, (96, 530))
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    # poster 1000x1500
    W, H = 1000, 1500
    img = cover_fit(tall, W, H).convert("RGBA")
    top = Image.new("RGBA", (W, 560), (0, 0, 0, 0)); g = ImageDraw.Draw(top)
    for i in range(560): g.line([(0, i), (W, i)], fill=(8, 12, 40, int(210 * (1 - i / 560))))
    img.alpha_composite(top, (0, 0))
    bot = Image.new("RGBA", (W, 560), (0, 0, 0, 0)); g = ImageDraw.Draw(bot)
    for i in range(560): g.line([(0, i), (W, i)], fill=(8, 12, 40, int(225 * (i / 560))))
    img.alpha_composite(bot, (0, H - 560))
    lg = logo(760); img.alpha_composite(lg, ((W - lg.width) // 2, 70))
    pill(img, W // 2, 90 + lg.height + 20, "SKY CLASH · CRYSTAL CLASH · OBBY RUN", 30, GREEN, (6, 35, 15), center=True)
    for i, s in enumerate((crystal, obby, zombie)):
        cc = card_of(s, 280, 175, (-5, 0, 5)[i], border=8, radius=16)
        img.alpha_composite(cc, (30 + i * 315, H - 330))
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
