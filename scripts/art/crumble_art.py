"""Crumble Crew key art, made from the real game: loads a heist site in several districts (headless Chrome, muted, the
dev server on PORT, default 3000), blows holes in the building's front with real explosions (the floors above come
down), brings in a few security robots, sets one off in a fireball, puts Rocco in front with his mallet raised, and
captures a low, wide shot into scripts/art/out/crumble. Then lays the shots out as the site's pictures (a full-bleed
scene with a dark edge, the title, pills and a strip of district snapshots) into public/games/crumble-crew/:
cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500) and og.jpg (1200x630).

usage: PORT=3000 python scripts/art/crumble_art.py [capture] [build]
"""
import base64
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "crumble-crew")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "crumble")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, heist, viewport, kind): 100 heists a district
SCENES = [
    ("maple", 5, (1280, 720), "wreck"), ("dune", 103, (1280, 720), "wreck"), ("frost", 230, (1280, 720), "wreck"), ("neon", 340, (1280, 720), "wreck"),
    ("jungle", 425, (1280, 720), "wreck"), ("lava", 560, (1280, 720), "wreck"), ("pirate", 602, (1280, 720), "wreck"), ("cloud", 720, (1280, 720), "wreck"),
    ("blossom", 804, (1280, 720), "wreck"), ("moon", 930, (1280, 720), "wreck"), ("crystal", 1045, (1280, 720), "wreck"), ("tower", 1150, (1280, 720), "wreck"),
    ("tall", 3, (720, 1280), "crew"), ("tall2", 103, (720, 1280), "wreck"),
]
ONLY = [s for s in os.environ.get("ONLY", "").split(",") if s]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } canvas.cc-canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
DRIVE = """async ([n, kind]) => {
  const g = window.__crumble;
  g.stop();
  const draw = g.render.bind(g);
  g.render = () => {};
  g.opts.onHud = () => {}; g.opts.onEvent = () => {};
  const tall = innerHeight >= innerWidth;
  g.load(n, 'intro');
  for (let i = 0; i < 150; i++) g.frame(1 / 30);
  const w = g.world, L = g.layout, box = L.box;
  const fz = w.wz(box.k0), cx = (w.wx(box.i0) + w.wx(box.i1)) / 2;
  const p = g.player;
  g.firstPerson = false;
  if (kind === 'crew') {
    // the van at the kerb, Rocco beside it facing you, the building behind
    const vx = L.van.x, vz = L.van.z;
    p.x = vx + 3.4; p.z = vz + 3.2; p.y = 0.5;
    g.mode = 'attract';
    for (let i = 0; i < 20; i++) g.frame(1 / 30);
    p.x = vx + 3.4; p.z = vz + 3.2; g.rocco.root.position.set(p.x, 0.5, p.z); g.rocco.pose.rotation.y = Math.PI + 0.35;
    g.camera.position.set(p.x + 1.4, 1.3, p.z - 3.4);
    g.camera.lookAt(p.x - 0.6, 2.4, p.z + 6);
    w.rebuild(Infinity);
    g.render = draw; draw(1 / 60);
    return { district: g.district.id, kind };
  }
  // blow holes in the front (the storeys above come down)
  const ex = g.explode.bind(g);
  for (const [dx, dy] of [[-5, 1.5], [4, 2], [-1, 4.5], [7, 5]]) ex(cx + dx, dy, fz + 0.3, 2.3, 5, 0, 0);
  for (let i = 0; i < 45; i++) { g.frame(1 / 30); }
  w.rebuild(Infinity);
  // the robots come
  g.alarm = true;
  const bots = [];
  for (const [dx, dz, k] of [[-6, -6, 'guard'], [5, -8, 'hound'], [1, -5, 'shield'], [8, -4, 'guard']]) {
    const b = g.addBot(k, false, cx + dx, 0.5, fz + dz); b.spawnT = 0; bots.push(b);
  }
  const d = g.addBot('drone', false, cx - 2, 4.5, fz - 7); d.spawnT = 0; bots.push(d);
  for (const b of bots) b.yaw = Math.atan2(-b.x + cx - 3, (fz - 16) - b.z);
  for (let i = 0; i < 3; i++) { for (const b of bots) b.flash = 0; g.frame(1 / 30); }
  // one robot goes up in a fireball a moment ago; Rocco has his mallet up
  const victim = g.addBot('guard', false, cx + 3, 0.5, fz - 6); victim.spawnT = 0;
  g.killBot(victim, true);
  g.fx.update(0.22, (x, y, z) => w.floorBelow(x, y, z));
  // Rocco in the yard with his mallet up, half turned to you, the wreck and the robots behind him
  p.x = cx + 2.5; p.z = fz - 7.5; p.y = 0.5; p.vy = 0; p.grounded = true; p.speed = 0;
  g.camYaw = Math.PI + 0.5; g.camPitch = 0.1;
  g.mode = 'play'; g.swing = 0.9;
  g.poseRocco(1 / 60);
  g.rocco.root.visible = true; g.rocco.pose.rotation.y = Math.PI + (tall ? 0.55 : -0.5);
  for (const b of g.bots) { b.flash = 0; b.rig.mat.emissive.setRGB(0, 0, 0); b.rig.root.position.set(b.x, b.y, b.z); b.rig.pose.rotation.y = b.yaw; }
  // the camera: low in front of Rocco, looking up past him at the wreck
  // (on the wide pictures Rocco stands right of centre, clear of the title)
  g.camera.position.set(p.x + (tall ? -0.9 : 1.6), 1.2, p.z - (tall ? 3.6 : 3.1));
  g.camera.lookAt(p.x + (tall ? 0.3 : -1.6), tall ? 3.4 : 2.4, p.z + 8);
  g.viewTool.visible = false;
  g.render = draw; draw(1 / 60);
  return { district: g.district.id, kind, bots: g.bots.length };
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--use-gl=angle"])
        for name, heist, (w, h), kind in SCENES:
            if ONLY and name not in ONLY: continue
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=crumble-crew", wait_until="domcontentloaded", timeout=240000)
            pg.wait_for_function("() => window.__crumble && window.__crumble.world", timeout=240000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
            info = pg.evaluate(DRIVE, [heist, kind])
            data = pg.evaluate("() => { const g = window.__crumble; g.renderer.render(g.scene, g.camera); return g.renderer.domElement.toDataURL('image/png'); }")
            with open(os.path.join(SHOTS, f"{name}.png"), "wb") as f: f.write(base64.b64decode(data.split(",", 1)[1]))
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


def edge(img, side, size, color=(14, 10, 24), alpha=230):
    w, h = img.size
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    for i in range(size):
        a = int(alpha * (1 - i / size) ** 1.6)
        if side == "left": d.line([(i, 0), (i, h)], fill=color + (a,))
        elif side == "top": d.line([(0, i), (w, i)], fill=color + (a,))
        else: d.line([(0, h - 1 - i), (w, h - 1 - i)], fill=color + (a,))
    img.alpha_composite(g)


def thumb(im, w, h, border=5, angle=0):
    c = cover_fit(im, w, h)
    frame = Image.new("RGBA", (w + border * 2, h + border * 2), (255, 255, 255, 255))
    frame.paste(c, (border, border))
    if angle: frame = frame.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", (frame.width + 24, frame.height + 24), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", frame.size, (14, 8, 24, 200)), (14, 14), frame.split()[3])
    sh = sh.filter(ImageFilter.GaussianBlur(2))
    sh.alpha_composite(frame, (4, 4))
    return sh


def strip(img, names, x, y, w, h, gap):
    for i, n in enumerate(names):
        img.alpha_composite(thumb(shot(n), w, h, 5, (-3, 2, -2, 3)[i % 4]), (x + i * (w + gap), y))


def title(img, x, y, size, center=False):
    f = ImageFont.truetype(FONT, size)
    sw = max(4, size // 12)
    lines = (("CRUMBLE", (255, 176, 90), (184, 84, 26)), ("CREW", (91, 232, 224), (26, 138, 138)))
    d0 = ImageDraw.Draw(img)
    for i, (txt, col, deep) in enumerate(lines):
        w = d0.textlength(txt, font=f)
        tx = x - w / 2 if center else x
        ty = y + i * int(size * 0.88)
        for k in range(6, 0, -1):
            d0.text((tx + k * sw * 0.45, ty + k * sw * 0.45), txt, font=f, fill=deep if k < 6 else (14, 8, 24), stroke_width=sw // 2, stroke_fill=deep if k < 6 else (14, 8, 24))
        d0.text((tx, ty), txt, font=f, fill=col, stroke_width=sw // 3, stroke_fill=deep)


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.75
    x0 = x - (w + pad * 2) / 2 if center else x
    x1, y1 = x0 + w + pad * 2, y + size * 1.55
    s = max(4, size // 6)
    for dx, dy, col in ((s, s, (14, 8, 24)), (0, 0, bg)):
        d.polygon([(x0 + dx + s, y + dy), (x1 + dx - s, y + dy), (x1 + dx - s, y + dy + s), (x1 + dx, y + dy + s), (x1 + dx, y1 + dy - s), (x1 + dx - s, y1 + dy - s), (x1 + dx - s, y1 + dy), (x0 + dx + s, y1 + dy), (x0 + dx + s, y1 + dy - s), (x0 + dx, y1 + dy - s), (x0 + dx, y + dy + s), (x0 + dx + s, y + dy + s)], fill=col)
    d.text((x0 + pad, y + size * 0.2), text, font=f, fill=fg)
    return x1


def build():
    os.makedirs(OUT, exist_ok=True)
    ORANGE, NAVY, TEAL = (255, 122, 42), (14, 10, 30), (42, 184, 176)
    W, H = 1280, 720
    img = cover_fit(shot("maple"), W, H, 0.6, 0.5).convert("RGBA")
    edge(img, "left", 760); edge(img, "bottom", 260, alpha=170)
    title(img, 56, 46, 116)
    pill(img, 64, 300, "SMASH · GRAB · GETAWAY", 30, ORANGE)
    pill(img, 64, 362, "1200 HEISTS · 12 DISTRICTS", 30, TEAL, NAVY)
    strip(img, ["neon", "jungle", "crystal"], 56, 520, 200, 120, 22)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    W, H = 1200, 630
    img = cover_fit(shot("blossom"), W, H, 0.6, 0.5).convert("RGBA")
    edge(img, "left", 720); edge(img, "bottom", 220, alpha=160)
    title(img, 48, 34, 108)
    pill(img, 56, 276, "BREAK EVERY BLOCK", 28, ORANGE)
    pill(img, 56, 334, "1200 HEISTS · 12 DISTRICTS", 28, TEAL, NAVY)
    strip(img, ["frost", "pirate", "tower"], 48, 452, 188, 112, 20)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    W, H = 600, 800
    img = cover_fit(shot("tall"), W, H, 0.5, 0.6).convert("RGBA")
    edge(img, "top", 400, alpha=235); edge(img, "bottom", 200, alpha=160)
    title(img, W // 2 - 12, 26, 84, center=True)
    pill(img, W // 2, 214, "SMASH · GRAB · GETAWAY", 22, ORANGE, center=True)
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    W, H = 1000, 1500
    img = cover_fit(shot("tall2"), W, H, 0.5, 0.55).convert("RGBA")
    edge(img, "top", 600, alpha=235); edge(img, "bottom", 560, alpha=225)
    title(img, W // 2 - 16, 56, 142, center=True)
    pill(img, W // 2, 400, "BREAK EVERY BLOCK", 34, ORANGE, center=True)
    strip(img, ["lava", "moon", "cloud"], 28, H - 300, 280, 170, 30)
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
