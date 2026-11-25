"""Blockstorm key art, made from the real game: captures action moments from several worlds (headless Chrome, muted, the
dev server on PORT, default 3000) into scripts/art/out/storm — Rook firing rockets into monsters, a boss close-up,
wide island views — plus the pixel logo from the home screen and a cut-out of the hero, then lays them out like the
site's other covers into public/games/blockstorm/: cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500),
og.jpg (1200x630) and hero.webp (the hero on a transparent background, for the Shooting tile on the home page).

usage: PORT=3000 python scripts/art/storm_art.py [capture] [build]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "blockstorm")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "storm")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
URL = f"http://localhost:{PORT}/play?g=blockstorm"
# draw the last frame inside an animation frame, so the browser presents it before the screenshot
PRESENT = "() => new Promise((r) => requestAnimationFrame(() => { window.__blockstorm.frame(1 / 240); requestAnimationFrame(() => requestAnimationFrame(() => r(true))); }))"
# (name, stage, viewport, kind): action = over-the-shoulder fight, hero = a cinematic front view of Rook firing,
# boss = Rook facing a golem, wide = a high view of the island
SCENES = [
    ("action", 4, (1280, 720), "hero"), ("neon", 103, (1280, 720), "wide"), ("boss", 10, (1280, 720), "boss"),
    ("forge", 262, (1280, 720), "action"), ("frost", 166, (1280, 720), "wide"), ("candy", 312, (1280, 720), "action"),
    ("jungle", 556, (1280, 720), "hero"), ("tall", 459, (720, 1280), "hero"),
]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } .bs-stage > canvas:first-child { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
SHOOT = """async ([n, kind]) => {
  const g = window.__blockstorm;
  g.stop();
  g.load(n, 'attract');
  g.play(); g.modeT = 99; g.frame(1 / 60);
  const p = g.p, A = g.arena;
  g.powers.set('shield', 99);
  if (kind === 'wide') {
    for (let i = 0; i < 4; i++) { const r = A.rifts[i % A.rifts.length]; const e = g.spawnEnemy(['grumbler','cubeling','brute','spitter'][i], r.x + i, r.z, false, true); if (e) e.rise = 1; }
    g.photoCam = [A.center.x - A.size * 0.62, 15 + A.size * 0.28, A.center.z - A.size * 0.55, A.center.x, 4, A.center.z + 2];
    for (let i = 0; i < 20; i++) g.frame(1 / 60);
    return { world: g.world.name };
  }
  // face the middle of the island, monsters ahead
  let tx = A.center.x, tz = A.center.z;
  const boss = g.enemies.find((e) => e.kind === 'golem');
  if (boss) { tx = boss.x; tz = boss.z; p.x = boss.x + Math.sin(boss.yaw) * 11; p.z = boss.z + Math.cos(boss.yaw) * 11; p.y = A.vox.top(p.x, p.z) + 0.01; }
  g.camYaw = Math.atan2(tx - p.x, tz - p.z); g.camPitch = boss ? 0.16 : 0.03;
  if (!boss) {
    const kinds = ['grumbler', 'cubeling', 'spitter', 'brute', 'fusebug', 'grumbler'];
    for (let i = 0; i < kinds.length; i++) {
      const d = 6 + i * 1.5, a = g.camYaw + (i - 2.5) * 0.24;
      const e = g.spawnEnemy(kinds[i], p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, false, true);
      if (e) { e.rise = 1; e.hp = e.maxHp = 99999; e.speed *= 0.5; }
    }
    const b = g.spawnEnemy('batbit', p.x + Math.sin(g.camYaw) * 7, p.z + Math.cos(g.camYaw) * 7, false, true); if (b) { b.rise = 1; b.hp = b.maxHp = 99999; }
  } else { boss.hp = boss.maxHp = 1e6; boss.throwCd = 99; boss.summonCd = 99; }
  g.powers.set('rocket', 99);
  g.setFire(true);
  for (let i = 0; i < 70; i++) { g.frame(1 / 60); if (i === 40) g.powers.delete('rocket'); }
  g.setFire(false);
  const yaw = g.camYaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
  if (kind === 'hero') g.photoCam = [p.x - fx * 2.2 + rx * 1.6, p.y + 1.6, p.z - fz * 2.2 + rz * 1.6, p.x + fx * 7 - rx * 0.4, p.y + 1.2, p.z + fz * 7 - rz * 0.4];
  if (kind === 'boss') g.photoCam = [p.x - fx * 3.4 + rx * 1.4, p.y + 2.0, p.z - fz * 3.4 + rz * 1.4, tx, p.y + 3.2, tz];
  g.setFire(true); g.frame(1 / 60); g.frame(1 / 60); g.setFire(false);
  g.frame(1 / 240);
  return { world: g.world.name, enemies: g.enemies.filter((e) => e.alive).length };
}"""
HERO = """async () => {
  const g = window.__blockstorm;
  g.stop();
  g.load(4, 'attract'); g.play(); g.modeT = 99; g.frame(1 / 60);
  const p = g.p;
  g.camYaw = 0; g.camPitch = 0.1;
  for (const e of g.enemies) e.alive = false;
  const sc = g.view.scene, keep = new Set(g.hero.meshes);
  sc.traverse((o) => { if (o.isMesh || o.isPoints) o.visible = keep.has(o); });
  const C = sc.fog.color.constructor;
  sc.background = new C('#00ff00'); sc.fog = null;
  g.photoCam = [p.x + 2.4, p.y + 1.25, p.z + 3.6, p.x, p.y + 0.95, p.z];
  g.frame(1 / 60); g.frame(1 / 60);
  return 'ok';
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
        # the logo, from the home screen, on a transparent background
        pg = b.new_page(viewport={"width": 1000, "height": 700}, device_scale_factor=2)
        pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
        pg.wait_for_function("() => window.__blockstorm && window.__blockstorm.arena", timeout=120000)
        pg.wait_for_timeout(2500)
        pg.add_style_tag(content="* { background: #00ff00 !important; } .bs-stage, nextjs-portal, .bs-tag, .bs-card, .bs-btn { visibility: hidden !important; } .bs-logo { filter: none !important; } .bs-logo span { animation: none !important; }")
        pg.wait_for_timeout(300)
        pg.locator(".bs-logo").screenshot(path=os.path.join(SHOTS, "logo.png"))
        pg.close()
        for name, stage, (w, h), kind in SCENES:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
            pg.wait_for_function("() => window.__blockstorm && window.__blockstorm.arena", timeout=120000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
            # headless Chrome now and then shows a frame that never got drawn: check, and shoot again
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
                pg.wait_for_function("() => window.__blockstorm && window.__blockstorm.arena", timeout=120000)
                pg.evaluate(HIDE)
                pg.wait_for_timeout(1500)
            print("shot", name, info, flush=True)
            pg.close()
        pg = b.new_page(viewport={"width": 800, "height": 1000}, device_scale_factor=1.5)
        pg.goto(URL, wait_until="domcontentloaded", timeout=120000)
        pg.wait_for_function("() => window.__blockstorm && window.__blockstorm.arena", timeout=120000)
        pg.evaluate(HIDE)
        pg.wait_for_timeout(1200)
        for attempt in range(6):
            pg.evaluate(HERO)
            pg.evaluate(PRESENT)
            pg.wait_for_timeout(250)
            path = os.path.join(SHOTS, "hero_green.png")
            pg.screenshot(path=path, timeout=60000)
            lo, hi = Image.open(path).convert("L").getextrema()
            if hi - lo > 40: break
            print("blank frame, again hero", flush=True)
            pg.reload(wait_until="domcontentloaded")
            pg.wait_for_function("() => window.__blockstorm && window.__blockstorm.arena", timeout=120000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
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
    shade = Image.new("RGB", (w, h), (10, 8, 26))
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


def hero_cutout():
    im = keyed(os.path.join(SHOTS, "hero_green.png"))
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    return im


def build():
    os.makedirs(OUT, exist_ok=True)
    action, neon, boss, forge, frost, candy, jungle, tall = (shot(n) for n in ("action", "neon", "boss", "forge", "frost", "candy", "jungle", "tall"))
    RED, GOLD = (255, 79, 106), (255, 194, 61)

    # cover 1280x720: the hero shot full-bleed, the logo and pills on the left over a dark fade
    W, H = 1280, 720
    img = cover_fit(action, W, H).convert("RGBA")
    fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(fade)
    for i in range(W // 2): g.line([(i, 0), (i, H)], fill=(8, 6, 22, int(200 * (1 - i / (W / 2)) ** 1.4)))
    img.alpha_composite(fade)
    lg = logo(520); img.alpha_composite(lg, (56, 120))
    pill(img, 64, 140 + lg.height + 24, "3D BLOCK SHOOTER", 30, RED)
    pill(img, 64, 140 + lg.height + 86, "1000+ STAGES · 20 WORLDS", 30, GOLD, (42, 19, 0))
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=88)

    # og 1200x630
    W, H = 1200, 630
    img = backdrop(neon, W, H, 0.38).convert("RGBA")
    c2 = card_of(boss, 470, 265, -6); img.alpha_composite(c2, (660, 310))
    c1 = card_of(action, 560, 315, 4); img.alpha_composite(c1, (590, 24))
    lg = logo(500); img.alpha_composite(lg, (50, 110))
    pill(img, 60, 130 + lg.height + 20, "3D BLOCK SHOOTER", 28, RED)
    pill(img, 60, 130 + lg.height + 78, "1000+ STAGES · 20 WORLDS", 28, GOLD, (42, 19, 0))
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    # card 600x800: the logo on top, two gameplay cards below
    W, H = 600, 800
    img = backdrop(forge, W, H, 0.35).convert("RGBA")
    lg = logo(470); img.alpha_composite(lg, ((W - lg.width) // 2, 34))
    pill(img, W // 2, 44 + lg.height + 14, "BLAST · TEAR IT DOWN", 24, RED, center=True)
    c1 = card_of(action, 470, 265, -5); img.alpha_composite(c1, (20, 330))
    c2 = card_of(boss, 470, 265, 6); img.alpha_composite(c2, (96, 530))
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    # poster 1000x1500: one tall action scene, the logo above, a strip of worlds below
    W, H = 1000, 1500
    img = cover_fit(tall, W, H).convert("RGBA")
    top = Image.new("RGBA", (W, 560), (0, 0, 0, 0))
    g = ImageDraw.Draw(top)
    for i in range(560): g.line([(0, i), (W, i)], fill=(8, 6, 22, int(210 * (1 - i / 560))))
    img.alpha_composite(top, (0, 0))
    bot = Image.new("RGBA", (W, 560), (0, 0, 0, 0))
    g = ImageDraw.Draw(bot)
    for i in range(560): g.line([(0, i), (W, i)], fill=(8, 6, 22, int(225 * (i / 560))))
    img.alpha_composite(bot, (0, H - 560))
    lg = logo(780); img.alpha_composite(lg, ((W - lg.width) // 2, 70))
    pill(img, W // 2, 90 + lg.height + 20, "BLAST MONSTERS · TEAR BLOCKS DOWN", 32, GOLD, (42, 19, 0), center=True)
    for i, s in enumerate((neon, frost, candy)):
        cc = card_of(s, 280, 175, (-5, 0, 5)[i], border=8, radius=16)
        img.alpha_composite(cc, (30 + i * 315, H - 330))
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)

    # hero.webp: Rook alone, for the Shooting tile
    hero = hero_cutout()
    hero.thumbnail((420, 520), Image.LANCZOS)
    hero.save(os.path.join(OUT, "hero.webp"), quality=90)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
