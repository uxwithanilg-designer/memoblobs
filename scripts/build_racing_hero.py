"""Hero / OG art for a racing game from a real in-game render (needs the dev server on :3000).

usage: python scripts/build_racing_hero.py <slug> <title> <tag> <themeId> <carId> [paint]
  e.g. python scripts/build_racing_hero.py nitro-rush "Nitro Rush" "34 cars · 29 worlds · nitro!" neon-city inferno-v12

Starts a RaceSession off-screen (window.__RaceSession, dev builds only), lets the AI race for a few seconds, fires
nitro, frames a low chase "photo mode" shot of the player's car and composes it with the title into
public/games/<slug>/hero.webp (1280x720), og.jpg (1200x630) and a text-free card.webp (600x800) for game cards.
"""
import base64
import io
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(WEB, "public")
FONT = os.path.join(WEB, "src", "fonts", "LilitaOne.ttf")
slug, title, tag, theme, car = sys.argv[1:6]
paint = int(sys.argv[6]) if len(sys.argv) > 6 else 0

# SHOT_MODE=battle (Drift Kings) catches both cars mid-slide in a tandem drift
SHOT_MODE = os.environ.get("SHOT_MODE", "race")
CFG = {"game": slug, "mode": SHOT_MODE, "themeId": theme, "variant": 0, "reverse": False, "laps": 2, "opponents": 5, "ai": "hard", "carId": car,
       "paint": paint, "upgrades": {"speed": 0, "accel": 0, "handling": 0, "nitro": 0}, "weather": "clear", "night": "auto",
       "pickups": True, "hazards": True}
START = """async (cfg) => {
  const S = window.__RaceSession;
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000';
  document.body.appendChild(host);
  const s = new S(host, cfg, { quality: 'high', camera: 'chase', renderScale: 1, onHud: () => {}, onEvent: () => {} });
  await s.init(); window.__race = s; s.pause();
}"""
RUN = """() => { const s = window.__race; s.debugAdvance(6.2); s.debugAutopilot && s.debugAutopilot('hard'); s.debugAdvance(9);
  s.player.car.nitro = 1; s.touch.nitro = true; s.debugAdvance(0.7); }"""
# Highway Heat chase: run until a police car is right behind you
RUN_CHASE = """() => { const s = window.__race; s.debugAdvance(6.2); s.debugAutopilot('hard'); s.debugAdvance(4);
  for (let i = 0; i < 500; i++) { s.debugAdvance(0.1); const p = s.player.car;
    if ((s.cops || []).some((c) => !c.out && c.car.wreck <= 0 && s.track.delta(c.car.s, p.s) > 7 && s.track.delta(c.car.s, p.s) < 20)) break; }
  s.player.car.nitro = 1; s.touch.nitro = true; s.debugAdvance(0.4); }"""
# bikes: catch the rider leaned over in a corner, with the pack close behind
RUN_LEAN = """() => { const s = window.__race; s.debugAdvance(6.2); s.debugAutopilot('hard'); s.debugAdvance(5);
  for (let i = 0; i < 600; i++) { s.debugAdvance(0.05); const p = s.player.car;
    if (Math.abs(s.track.kappa(p.s)) > 0.011 && p.v > 22 && Math.abs(s.player.roll) > 0.6) break; } }"""
RUN_DRIFT = """() => { const s = window.__race; s.debugAdvance(6.2); s.debugAutopilot('pro', 'drifter'); s.debugAdvance(6);
  for (let i = 0; i < 400; i++) { s.debugAdvance(0.1); const p = s.player.car, b = s.boss && s.boss.car;
    if (p.drifting && p.driftTime > 0.7 && (!b || (b.drifting && Math.abs(s.track.delta(p.s, b.s)) < 22))) break; } }"""
GRAB = """([back, side, up, ahead, lookSide, lookUp, fov]) => {
  // framed in track space (s along the road, d to the right), so a drifting car still lands in the right third
  const r = window.__race, P0 = r.player, car = P0.car, cam = r.camera, V = cam.position.constructor;
  if (r.items && r.items.group) r.items.group.visible = false;
  const pos = r.track.point(car.s - back, car.d + side, new V()); pos.y += up;
  const look = r.track.point(car.s + ahead, car.d + lookSide, new V()); look.y += lookUp;
  cam.position.copy(pos); cam.up.set(0, 1, 0); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(look);
  r.renderer.render(r.scene, cam);
  return r.renderer.domElement.toDataURL('image/png');
}"""


def shoot():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1)
        pg.set_default_timeout(300000)
        pg.goto("http://localhost:3000/play/" + slug, wait_until="load", timeout=180000)
        pg.wait_for_function("!!window.__RaceSession", timeout=300000)
        pg.evaluate(START, CFG)
        pg.evaluate(RUN_LEAN if os.environ.get("LEAN") else RUN_DRIFT if SHOT_MODE in ("battle", "drift") else RUN_CHASE if SHOT_MODE in ("escape", "heat") else RUN)
        # low rear three-quarter, looking past the car down the road
        # car sits in the right third so the title has room on the left
        # HERO_CAM / CARD_CAM (JSON: back, side, up, ahead, lookSide, lookUp, fov) override the framing,
        # e.g. a camera in front of the car looking back at the police behind it
        hero_cam = json.loads(os.environ.get("HERO_CAM", "[7.5, -3.3, 1.15, 14, -1.7, 0.9, 44]"))
        url = pg.evaluate(GRAB, hero_cam)
        # game-card cover (no text): car centred, camera a little higher so it sits above the card's caption
        url2 = pg.evaluate(GRAB, json.loads(os.environ.get("CARD_CAM", "[6.4, -0.8, 2.7, 2.5, -0.2, -1.5, 50]")))
        b.close()
    dec = lambda u: Image.open(io.BytesIO(base64.b64decode(u.split(",", 1)[1]))).convert("RGB")
    return dec(url), dec(url2)


def cover(img, W, H, zoom=1.0, shift=0.0):
    """scale to cover W x H (times `zoom`) and crop; `shift` (fraction of W) moves the subject right"""
    s = max(W / img.width, H / img.height) * zoom
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = max(0, min(im.width - W, (im.width - W) // 2 - int(shift * W))); y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def compose(shot, W, H):
    # HERO_ZOOM / HERO_SHIFT push a centred subject into the right-hand side, clear of the title
    img = cover(shot, W, H, float(os.environ.get("HERO_ZOOM", "1")), float(os.environ.get("HERO_SHIFT", "0")))
    # left-side legibility gradient + a warm bottom glow
    grad = Image.new("L", (W, H))
    gp = grad.load()
    for x in range(W):
        a = max(0.0, 1 - x / (W * 0.62)) ** 1.4
        for y in range(H):
            gp[x, y] = int(215 * a)
    img.paste(Image.new("RGB", (W, H), (14, 8, 40)), (0, 0), grad)
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.24)
    logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.07)), logo)
    d = ImageDraw.Draw(img)
    size = int(H * 0.19)
    f = ImageFont.truetype(FONT, size)
    tx, ty = int(W * 0.05), int(H * 0.34)
    words = title.upper().split(" ")
    x = tx
    for i, w in enumerate(words):
        fill = (255, 200, 60) if i == 0 else (124, 242, 255)
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).text((x + 5, ty + 10), w, font=f, fill=(8, 2, 24, 220), stroke_width=int(size * 0.11), stroke_fill=(8, 2, 24, 220))
        img.paste(shadow.filter(ImageFilter.GaussianBlur(3)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(3)))
        d.text((x, ty), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(30, 14, 70))
        x += int(d.textlength(w + " ", font=f))
    f2 = ImageFont.truetype(FONT, int(H * 0.058))
    pill_y = ty + size + int(H * 0.07)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, pill_y, tx + tw + 44, pill_y + int(H * 0.1)), radius=int(H * 0.05), fill=(255, 90, 31))
    d.text((tx + 22, pill_y + int(H * 0.02)), tag, font=f2, fill=(255, 250, 235))
    f3 = ImageFont.truetype(FONT, int(H * 0.048))
    d.text((tx, int(H * 0.87)), "FREE · NO SIGN-UP · PLAY ON MOMOBLOBS", font=f3, fill=(255, 244, 226))
    return img


shot, card = shoot()
os.makedirs(os.path.join(PUB, "games", slug), exist_ok=True)
cw = round(card.height * 3 / 4)
if not os.environ.get("HERO_ONLY"):  # HERO_ONLY=1 re-renders hero/og and keeps the current card
    card.crop(((card.width - cw) // 2, 0, (card.width + cw) // 2, card.height)).resize((600, 800), Image.LANCZOS).save(
        os.path.join(PUB, "games", slug, "card.webp"), "WEBP", quality=86, method=6)
if not os.environ.get("CARD_ONLY"):  # CARD_ONLY=1 re-renders just the card and keeps the current hero/og
    compose(shot, 1280, 720).save(os.path.join(PUB, "games", slug, "hero.webp"), "WEBP", quality=86, method=6)
    compose(shot, 1200, 630).save(os.path.join(PUB, "games", slug, "og.jpg"), quality=86, optimize=True, progressive=True)
print("ok", slug, json.dumps({"theme": theme, "car": car}))
