"""Slurp Lab cover art from real game renders (the dev server must be running on :3000).

usage: python scripts/build_slurp_art.py [stage=50]
writes public/games/slurp-lab/card.webp (600x800, text-free), hero.webp (1280x720) and og.jpg (1200x630). The shots
are a real stage half solved (the Garden Lab's Big Tray by default), framed without the HUD.
"""
import io
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
FONT = os.path.join(HERE, "..", "src", "fonts", "LilitaOne.ttf")
URL = "http://localhost:3000/play?g=slurp-lab"
STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 50
PREP = """(() => { const raw = JSON.parse(localStorage.getItem('momoblobs-slurp') || '{"state":{},"version":2}');
  raw.state.unlocked = 600; raw.state.tutorialSeen = true; localStorage.setItem('momoblobs-slurp', JSON.stringify(raw)); })()"""
ONLY_3D = "(() => { document.body.style.visibility = 'hidden'; document.querySelectorAll('canvas').forEach((c) => { c.style.visibility = 'visible'; }); document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()); })()"


def grab(w, h, dpr, shift, drags):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__slurpTitle", timeout=180000)
        pg.evaluate(PREP)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__slurpTitle", timeout=180000)
        pg.get_by_role("button", name="Labs").first.click(); pg.wait_for_timeout(500)
        lab = (STAGE - 1) // 20 + 1
        # 30 lab chips: match "<lab>. " exactly, then the stage tile (its text starts with the number, no dot)
        pg.get_by_role("button").filter(has_text=re.compile(r"^%d\. " % lab)).first.click(); pg.wait_for_timeout(400)
        pg.get_by_role("button").filter(has_text=re.compile(r"^%d(?![.\d])" % ((STAGE - 1) % 20 + 1))).first.click()
        pg.wait_for_function(f"window.__slurpGame && window.__slurpGame.st.n === {STAGE}", timeout=120000)
        pg.wait_for_timeout(3200)
        pg.evaluate("(() => { const g = window.__slurpGame; g.playSolution(%d); g.r.setInsets(0, 0); g.r.shiftX = %s; g.r.fit(); })()" % (drags, shift))
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(1500)
        png = pg.screenshot()
        b.close()
        return Image.open(io.BytesIO(png)).convert("RGB")


def cover(img, W, H):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def compose(shot, W, H, lines=("SLURP", "LAB"), tag="A 3D brain puzzle!"):
    img = cover(shot, W, H)
    grad = Image.new("L", (W, H)); gp = grad.load()
    for x in range(W):
        a = max(0.0, 1 - x / (W * 0.58)) ** 1.6
        for y in range(H): gp[x, y] = int(200 * a)
    img.paste(Image.new("RGB", (W, H), (16, 24, 70)), (0, 0), grad)
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.22); logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.07)), logo)
    d = ImageDraw.Draw(img)
    tx, ty = int(W * 0.05), int(H * 0.28)
    for i, w in enumerate(lines):
        size = int(H * 0.2); f = ImageFont.truetype(FONT, size)
        y = ty + i * int(H * 0.19)
        fill = (255, 255, 255) if i == 0 else (255, 210, 63)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((tx + 5, y + 10), w, font=f, fill=(14, 20, 70, 230), stroke_width=int(size * 0.11), stroke_fill=(14, 20, 70, 230))
        sh = sh.filter(ImageFilter.GaussianBlur(3)); img.paste(sh, (0, 0), sh)
        d.text((tx, y), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(59, 91, 219))
    f2 = ImageFont.truetype(FONT, int(H * 0.056))
    py = ty + int(H * 0.42)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, py, tx + tw + 44, py + int(H * 0.095)), radius=int(H * 0.05), fill=(255, 77, 109))
    d.text((tx + 22, py + int(H * 0.018)), tag, font=f2, fill=(255, 255, 255))
    f3 = ImageFont.truetype(FONT, int(H * 0.044))
    d.text((tx, int(H * 0.88)), "600 STAGES · 30 LABS · ENDLESS · PLAY FREE ON MOMOBLOBS", font=f3, fill=(240, 244, 255))
    return img


if __name__ == "__main__":
    out = os.path.join(PUB, "games", "slurp-lab")
    os.makedirs(out, exist_ok=True)
    card = grab(450, 600, 2, 0, 2)
    card.resize((600, 800), Image.LANCZOS).save(os.path.join(out, "card.webp"), "WEBP", quality=86, method=6)
    wide = grab(1600, 900, 1, 4.2, 2)
    compose(wide, 1280, 720).save(os.path.join(out, "hero.webp"), "WEBP", quality=86, method=6)
    compose(wide, 1200, 630).save(os.path.join(out, "og.jpg"), quality=86, optimize=True, progressive=True)
    print("art written to", out)
