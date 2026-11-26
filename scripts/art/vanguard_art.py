"""Voxel Vanguard key art, made from the real game: plays a few seconds of a stage in several worlds (headless Chrome,
muted, the dev server on PORT, default 3000) with a bot at the trigger, then stages the shot — Ace on his jetpack,
robots across the arena, one blowing apart, bolts in the air — and captures it into scripts/art/out/vanguard. Then lays
the shots out as the site's pictures (a full-bleed scene with a dark edge, the title, pills and a strip of world
snapshots) into public/games/voxel-vanguard/: cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500) and
og.jpg (1200x630).

usage: PORT=3000 python scripts/art/vanguard_art.py [capture] [build]
"""
import base64
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "voxel-vanguard")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "vanguard")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, operation, viewport, kind): fights in a spread of worlds (100 operations a world), and the squad line-up for the card
SCENES = [
    ("metro", 352, (1280, 720), "fight"), ("meadow", 24, (1280, 720), "fight"), ("canyon", 121, (1280, 720), "fight"),
    ("frost", 233, (1280, 720), "fight"), ("jungle", 421, (1280, 720), "fight"), ("foundry", 562, (1280, 720), "fight"),
    ("lagoon", 641, (1280, 720), "fight"), ("sky", 712, (1280, 720), "fight"), ("sakura", 845, (1280, 720), "fight"),
    ("lunar", 945, (1280, 720), "fight"), ("crystal", 1045, (1280, 720), "fight"), ("citadel", 1155, (1280, 720), "fight"),
    ("tall", 24, (720, 1280), "squad"), ("tall2", 121, (720, 1280), "fight"),
]
ONLY = [s for s in os.environ.get("ONLY", "").split(",") if s]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } canvas.vv-canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
DRIVE = """async ([n, kind]) => {
  const g = window.__voxelVanguard;
  g.stop();
  const draw = g.render.bind(g);
  g.render = () => {};
  const tall = innerHeight >= innerWidth;
  // is the line from the camera to a point clear of blocks, with a margin round it (tree tops overhang their cell)?
  const top = (x, z, r = 0.7) => { const a = g.arena; let m = -1e9; for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0], [-r, 0], [r, 0], [0, -r], [0, r]]) { const i = Math.round(x + dx + a.half), j = Math.round(z + dz + a.half); m = Math.max(m, i < 0 || j < 0 || i >= a.n || j >= a.n ? 30 : a.solid[j * a.n + i]); } return m; };
  const clear = (x0, y0, z0, x1, y1, z1) => { const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), m = Math.ceil(d / 0.25); for (let k = 0; k < m - 2; k++) { const t = k / m; if (y0 + (y1 - y0) * t < top(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 1.6) + 0.25) return false; } return true; };
  if (kind === "squad") {
    g.load(n, 'attract');
    for (let i = 0; i < 200; i++) g.frame(1 / 60);
    const p = g.player;
    let cam = null;
    // nothing at all on the ground between the camera and the squad (not even a low block in the foreground)
    const flat = (x0, z0, x1, z1) => { for (let k = 0; k <= 30; k++) { const t = k / 30; if (top(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t) > p.y + 0.3) return false; } return true; };
    for (const da of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.1, -1.1]) {
      const cx = p.x + Math.sin(da) * 6.4, cz = p.z + Math.cos(da) * 6.4, cy = p.y + 1.9;
      if (flat(cx, cz, p.x, p.z + 0.8) && flat(cx, cz, p.x + 2, p.z - 0.2) && flat(cx, cz, p.x - 2, p.z - 0.2)) { cam = [cx, cy, cz]; break; }
    }
    if (!cam) for (const da of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8]) {
      const cx = p.x + Math.sin(da) * 6.4, cz = p.z + Math.cos(da) * 6.4, cy = p.y + 1.9;
      if (clear(cx, cy, cz, p.x, p.y + 1, p.z)) { cam = [cx, cy, cz]; break; }
    }
    cam = cam || [p.x, p.y + 1.9, p.z + 6.4];
    g.camera.position.set(cam[0], cam[1], cam[2]);
    g.camera.lookAt(p.x, p.y + 1.6, p.z);
    g.render = draw; draw(1 / 60);
    return { world: g.plan.world, kind };
  }
  g.load(n, 'intro');
  const bot = (secs) => {
    for (let i = 0; i < secs * 60; i++) {
      const p = g.player;
      if (g.mode === 'play') {
        let best = null, bd = 1e9;
        for (const r of g.robots) { if (!r.alive || r.spawnT > 0) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < bd) { bd = d; best = r; } }
        if (best) { g.camYaw = Math.atan2(best.x - p.x, best.z - p.z); g.camPitch = Math.atan2(best.y + 1 - (p.y + 1.6), bd); g.setFire(bd < 30); g.setMove(0, bd > 12 ? 1 : 0); }
        else { g.setFire(false); g.setMove(0, 0.5); }
        p.hp = p.maxHp;
      }
      g.frame(1 / 60);
    }
    g.setFire(false); g.setMove(0, 0);
  };
  bot(9);
  // the hero shot: Ace up on jet flames, the robots ahead, one blowing apart a moment ago (the flash gone, fire and debris flying)
  const p = g.player;
  let target = null, bd = 1e9;
  for (const r of g.robots) { if (!r.alive || r.spawnT > 0) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < bd && d > 6) { bd = d; target = r; } }
  if (target) { g.camYaw = Math.atan2(target.x - p.x, target.z - p.z); }
  // a fresh group of this stage's robots teleports in ahead of Ace (on open ground) and has a second to spread out
  {
    const fx = Math.sin(g.camYaw), fz = Math.cos(g.camYaw), rx = -Math.cos(g.camYaw), rz = Math.sin(g.camYaw);
    const A = g.arena, at = (x, z) => Math.round(z + A.half) * A.n + Math.round(x + A.half);
    const kinds = [];
    for (const sc of g.op.sectors) for (const ph of sc.phases) for (const [kk] of ph.mix) if (!kinds.includes(kk)) kinds.push(kk);
    let k = 0;
    for (const [d, o] of [[10, -2.8], [13, 2.6], [16, -0.6], [19, 5], [18, -6]]) {
      const x = p.x + fx * d + rx * o, z = p.z + fz * d + rz * o;
      if (x < -A.half + 2 || x > A.half - 2 || z < -A.half + 2 || z > A.half - 2) continue;
      const c = at(x, z), t = top(x, z);
      if (t > A.ground[c] + 0.1 || Math.abs(t - p.y) > 2.5 || [1, 2, 3].includes(A.kind[c])) continue;
      g.spawnRobot(kinds[k % kinds.length], k === 2, x, z); k++;
    }
    for (let i = 0; i < 60; i++) { p.hp = p.maxHp; g.setFire(false); g.frame(1 / 60); }
  }
  for (const r of g.robots) if (r.alive) r.fireT = 9;
  p.y += 1.6; p.vy = 0; p.jetting = true; p.grounded = false; p.flash = 0; p.yaw = g.camYaw; p.aimPitch = 0.05;
  g.firing = true; g.mode = 'play';
  g.fx.life.fill(0); // no smoke left over from the bot's fight
  if (target) {
    // another robot further off goes up in a fireball
    const ahead = g.robots.filter((r) => r.alive && !r.spec.boss && Math.hypot(r.x - p.x, r.z - p.z) < 22).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const e = ahead[1] || ahead[0] || target;
    e.rig.root.visible = false;
    g.fx.explode(e.x, e.y + e.height * 0.5, e.z, 1.2, [0x7a8296, 0x3a3e4e, 0xff8a2a, 0xff3a3a]);
    for (let k = 0; k < 5; k++) g.fx.update(0.05, () => -10);
  }
  for (let k = 0; k < 6; k++) { g.fireT = 0; const w = g.spec[g.slot]; g.ammo[g.slot] = w.mag; g.updateCamera(1 / 60); g.shoot(w); g.updateBolts(0.025 + k * 0.012); }
  g.fx.update(0.07, () => -10); // the muzzle and impact flashes are a frame long: gone, the bolts stay in the air
  for (const u of g.squad) { if (u.rig.jet) u.rig.jet.visible = u === p; }
  p.rig.root.position.set(p.x, p.y, p.z); p.rig.pose.rotation.y = p.yaw;
  // no white hit flash left on anyone (the bot was shooting a moment ago)
  for (const u of [...g.robots, ...g.squad]) { u.flash = 0; u.rig.mat.emissive.setRGB(0, 0, 0); }
  // camera: behind Ace and off to one side, looking past him at the fight; the first spot with a clear view
  const fx = Math.sin(g.camYaw), fz = Math.cos(g.camYaw), rx = -Math.cos(g.camYaw), rz = Math.sin(g.camYaw);
  let cam = null;
  // (Ace large in the lower third, off to one side, his jet flames under him)
  for (const [back, side] of [[2.4, 1.5], [2.4, -1.5], [3.0, 2.0], [3.0, -2.0], [2.0, 1.1], [2.0, -1.1], [3.6, 1.2], [3.6, -1.2]]) {
    const cx = p.x - fx * back + rx * side, cz = p.z - fz * back + rz * side, cy = p.y + 1.9;
    if (clear(cx, cy, cz, p.x, p.y + 1, p.z) && clear(cx, cy, cz, p.x + fx * 8, p.y + 1.4, p.z + fz * 8) && clear(cx, cy, cz, p.x + fx * 16, p.y + 2, p.z + fz * 16)) { cam = [cx, cy, cz]; break; }
  }
  cam = cam || [p.x - fx * 2.6 + rx * 1.6, p.y + 2.6, p.z - fz * 2.6 + rz * 1.6];
  g.camera.position.set(cam[0], cam[1], cam[2]);
  g.camera.lookAt(p.x + fx * 8, p.y + 1.4, p.z + fz * 8);
  g.player.rig.root.visible = true;
  g.render = draw; draw(1 / 60);
  return { world: g.plan.world, kind, robots: g.robots.filter((r) => r.alive).length, target: !!target };
}"""


def capture():
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--use-gl=angle"])
        for name, stage, (w, h), kind in SCENES:
            if ONLY and name not in ONLY: continue
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=voxel-vanguard", wait_until="domcontentloaded", timeout=180000)
            pg.wait_for_function("() => window.__voxelVanguard && window.__voxelVanguard.arena", timeout=180000)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(1500)
            info = pg.evaluate(DRIVE, [stage, kind])
            # read the picture straight from the WebGL canvas, in the same task as the draw
            data = pg.evaluate("() => { const g = window.__voxelVanguard; g.renderer.render(g.scene, g.camera); return g.renderer.domElement.toDataURL('image/png'); }")
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


def thumb(im, w, h, border=5, angle=0):
    """a world snapshot in a white pixel frame (square corners, a hard drop shadow)"""
    c = cover_fit(im, w, h)
    frame = Image.new("RGBA", (w + border * 2, h + border * 2), (255, 255, 255, 255))
    frame.paste(c, (border, border))
    if angle: frame = frame.rotate(angle, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", (frame.width + 24, frame.height + 24), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", frame.size, (10, 8, 24, 200)), (14, 14), frame.split()[3])
    sh = sh.filter(ImageFilter.GaussianBlur(2))
    sh.alpha_composite(frame, (4, 4))
    return sh


def strip(img, names, x, y, w, h, gap):
    for i, n in enumerate(names):
        img.alpha_composite(thumb(shot(n), w, h, 5, (-3, 2, -2, 3)[i % 4]), (x + i * (w + gap), y))


def title(img, x, y, size, center=False):
    f = ImageFont.truetype(FONT, size)
    sw = max(4, size // 12)
    lines = (("VOXEL", (124, 255, 138), (30, 122, 58)), ("VANGUARD", (255, 210, 63), (168, 102, 26)))
    d0 = ImageDraw.Draw(img)
    for i, (txt, col, deep) in enumerate(lines):
        w = d0.textlength(txt, font=f)
        tx = x - w / 2 if center else x
        ty = y + i * int(size * 0.88)
        # a stepped voxel extrusion, then the face
        for k in range(6, 0, -1):
            d0.text((tx + k * sw * 0.45, ty + k * sw * 0.45), txt, font=f, fill=deep if k < 6 else (10, 8, 24), stroke_width=sw // 2, stroke_fill=deep if k < 6 else (10, 8, 24))
        d0.text((tx, ty), txt, font=f, fill=col, stroke_width=sw // 3, stroke_fill=deep)


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.75
    x0 = x - (w + pad * 2) / 2 if center else x
    x1, y1 = x0 + w + pad * 2, y + size * 1.55
    s = max(4, size // 6)
    # stepped pixel corners and a hard shadow
    for dx, dy, col in ((s, s, (10, 8, 24)), (0, 0, bg)):
        d.polygon([(x0 + dx + s, y + dy), (x1 + dx - s, y + dy), (x1 + dx - s, y + dy + s), (x1 + dx, y + dy + s), (x1 + dx, y1 + dy - s), (x1 + dx - s, y1 + dy - s), (x1 + dx - s, y1 + dy), (x0 + dx + s, y1 + dy), (x0 + dx + s, y1 + dy - s), (x0 + dx, y1 + dy - s), (x0 + dx, y + dy + s), (x0 + dx + s, y + dy + s)], fill=col)
    d.text((x0 + pad, y + size * 0.2), text, font=f, fill=fg)
    return x1


def build():
    os.makedirs(OUT, exist_ok=True)
    GREEN, NAVY, YELLOW = (34, 192, 90), (13, 10, 30), (255, 210, 63)

    W, H = 1280, 720
    img = cover_fit(shot("frost"), W, H, 0.6, 0.5).convert("RGBA")
    edge(img, "left", 760); edge(img, "bottom", 260, alpha=170)
    title(img, 56, 46, 116)
    pill(img, 64, 300, "3D PIXEL SHOOTER", 30, GREEN)
    pill(img, 64, 362, "1200 OPERATIONS · 12 WORLDS", 30, YELLOW, NAVY)
    strip(img, ["sakura", "canyon", "crystal"], 56, 520, 200, 120, 22)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    W, H = 1200, 630
    img = cover_fit(shot("meadow"), W, H, 0.6, 0.5).convert("RGBA")
    edge(img, "left", 720); edge(img, "bottom", 220, alpha=160)
    title(img, 48, 34, 108)
    pill(img, 56, 276, "RUN · GUN · JETPACK", 28, GREEN)
    pill(img, 56, 334, "1200 OPERATIONS · 12 WORLDS", 28, YELLOW, NAVY)
    strip(img, ["metro", "crystal", "frost"], 48, 452, 188, 112, 20)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    W, H = 600, 800
    img = cover_fit(shot("tall"), W, H, 0.5, 0.62).convert("RGBA")
    edge(img, "top", 400, alpha=235); edge(img, "bottom", 200, alpha=160)
    title(img, W // 2 - 12, 26, 84, center=True)
    pill(img, W // 2, 214, "3D PIXEL SHOOTER", 24, GREEN, center=True)
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    W, H = 1000, 1500
    img = cover_fit(shot("tall2"), W, H, 0.5, 0.55).convert("RGBA")
    edge(img, "top", 600, alpha=235); edge(img, "bottom", 560, alpha=225)
    title(img, W // 2 - 16, 56, 142, center=True)
    pill(img, W // 2, 400, "RUN · GUN · JETPACK", 34, GREEN, center=True)
    strip(img, ["frost", "sakura", "metro"], 28, H - 300, 280, 170, 30)
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)

    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture()
    if "build" in steps: build()
