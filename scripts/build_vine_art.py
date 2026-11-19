"""Tondu's Vine Climb art from real game renders (the dev server must be running on :3000).

usage: python scripts/build_vine_art.py [card_stage=47] [hero_stage=186]
writes public/games/tondu-vine-climb/card.webp (600x800, text-free), hero.webp (1280x720), og.jpg (1200x630) — real
climbs with the autopilot, framed without the HUD — and tondu.webp, Tondu's portrait on a transparent background
(the 3D model alone against a key colour, keyed out here).
"""
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
FONT = os.path.join(HERE, "..", "src", "fonts", "LilitaOne.ttf")
URL = "http://localhost:3000/play?g=tondu-vine-climb"
CARD = int(sys.argv[1]) if len(sys.argv) > 1 else 47
HERO = int(sys.argv[2]) if len(sys.argv) > 2 else 66
SEED = """((n) => { const raw = JSON.parse(localStorage.getItem('momoblobs-vine') || '{"state":{},"version":1}'); raw.state.stage = n; raw.state.plays = 3;
  raw.state.tips = { flip: true, cling: true, leap: true }; raw.state.settings = { quality: 'high', vibrate: false }; localStorage.setItem('momoblobs-vine', JSON.stringify(raw)); })"""
ONLY_3D = "(() => { document.body.style.visibility = 'hidden'; document.querySelectorAll('canvas').forEach((c) => { c.style.visibility = 'visible'; }); document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()); })()"


def climb_shot(w, h, dpr, stage, wait=9000, cam=None):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__vineTitle", timeout=180000)
        pg.evaluate(SEED, stage)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__vineTitle", timeout=180000)
        pg.wait_for_timeout(1200)
        pg.get_by_role("button").filter(has_text="CLIMB").first.click()
        pg.wait_for_function("window.__vine && window.__vine.sim", timeout=60000)
        pg.evaluate("window.__vine.setAutopilot(true); window.__vine.r.setInsets(0, 0)")
        pg.wait_for_timeout(wait)
        if cam: pg.evaluate("((c) => { const r = window.__vine.r; r.artCam = { off: r.head.clone().set(...c[0]), look: r.head.clone().set(...c[1]), fov: c[2] }; })", cam)
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(700)
        png = pg.screenshot()
        b.close()
        return Image.open(io.BytesIO(png)).convert("RGB")


def portrait():
    """Tondu alone against magenta, then keyed out"""
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 900, "height": 900}, device_scale_factor=1)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__vineTitle", timeout=180000)
        pg.wait_for_timeout(2500)
        pg.evaluate("""(() => { const r = window.__vineTitle.r;
          r.setInsets(0, 0);
          r.scene.children.forEach((c) => { if (c !== r.liz.group && !c.isLight) c.visible = false; });
          r.scene.fog = null; r.renderer.setClearColor(0xff00ff, 1);
          const st = window.__vineTitle.view.st, i = Math.round(30 / st.path.ds), tx = st.path.T[i * 3], ty = st.path.T[i * 3 + 1];
          // look at the middle of his body from the side, a little above and in front
          const bx = -tx * 0.85, by = -ty * 0.85;
          r.artCam = { off: r.head.clone().set(bx + 0.35, by + 0.75, 3.3), look: r.head.clone().set(bx, by + 0.05, 0), fov: 36 }; })()""")
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(900)
        png = pg.screenshot()
        b.close()
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, bl, a = px[x, y]
            # magenta distance → alpha (soft edge), and un-spill the pink from the edges
            mag = min(r, bl) - g
            if mag > 90: px[x, y] = (0, 0, 0, 0)
            elif mag > 30:
                k = (mag - 30) / 60
                px[x, y] = (int(min(r, g + 40)), g, int(min(bl, g + 40)), int(255 * (1 - k)))
    bbox = im.getbbox()
    im = im.crop(bbox)
    side = max(im.width, im.height) + 20
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return out.resize((480, 480), Image.LANCZOS)


def cover(img, W, H):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def compose(shot, W, H, hero):
    img = cover(shot, W, H)
    grad = Image.new("L", (W, H)); gp = grad.load()
    for x in range(W):
        a = max(0.0, 1 - x / (W * 0.6)) ** 1.5
        for y in range(H): gp[x, y] = int(205 * a)
    img.paste(Image.new("RGB", (W, H), (10, 46, 20)), (0, 0), grad)
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.2); logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.06)), logo)
    d = ImageDraw.Draw(img)
    tx, ty = int(W * 0.05), int(H * 0.25)
    for i, (w, size, fill) in enumerate((("TONDU'S", int(H * 0.11), (255, 227, 106)), ("VINE", int(H * 0.19), (255, 255, 255)), ("CLIMB", int(H * 0.19), (255, 255, 255)))):
        f = ImageFont.truetype(FONT, size)
        y = ty + [0, int(H * 0.1), int(H * 0.27)][i]
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((tx + 5, y + 9), w, font=f, fill=(8, 40, 14, 230), stroke_width=int(size * 0.11), stroke_fill=(8, 40, 14, 230))
        sh = sh.filter(ImageFilter.GaussianBlur(3)); img.paste(sh, (0, 0), sh)
        d.text((tx, y), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(44, 122, 34))
    tag = "A 3D lizard climb!"
    f2 = ImageFont.truetype(FONT, int(H * 0.055))
    py = ty + int(H * 0.5)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, py, tx + tw + 44, py + int(H * 0.093)), radius=int(H * 0.05), fill=(255, 138, 61))
    d.text((tx + 22, py + int(H * 0.017)), tag, font=f2, fill=(255, 255, 255))
    f3 = ImageFont.truetype(FONT, int(H * 0.042))
    d.text((tx, int(H * 0.88)), "600 STAGES · 30 WORLDS · WILD CANOPY · PLAY FREE", font=f3, fill=(240, 255, 236))
    if hero:
        # Tondu's portrait on the right
        pt = hero.resize((int(H * 0.62), int(H * 0.62)), Image.LANCZOS)
        img.paste(pt, (int(W * 0.66), int(H * 0.36)), pt)
    return img


if __name__ == "__main__":
    out = os.path.join(PUB, "games", "tondu-vine-climb")
    os.makedirs(out, exist_ok=True)
    pt = portrait()
    pt.save(os.path.join(out, "tondu.webp"), "WEBP", quality=90, method=6)
    card = climb_shot(450, 600, 2, CARD)
    card.resize((600, 800), Image.LANCZOS).save(os.path.join(out, "card.webp"), "WEBP", quality=86, method=6)
    # the wide shot: closer, Tondu on the right third with the vine climbing away above him
    wide = climb_shot(1600, 900, 1, HERO, cam=[[-2.3, -0.9, 6.4], [-2.3, 0.15, 0], 38])
    compose(wide, 1280, 720, None).save(os.path.join(out, "hero.webp"), "WEBP", quality=86, method=6)
    compose(wide, 1200, 630, None).save(os.path.join(out, "og.jpg"), quality=86, optimize=True, progressive=True)
    print("art written to", out)
