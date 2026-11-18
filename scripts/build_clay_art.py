"""Puddo's Clayland cover art from real game renders (the dev server must be running on :3000).

usage: python scripts/build_clay_art.py
writes public/games/puddo-clayland/card.webp (600x800, text-free), hero.webp (1280x720) and og.jpg (1200x630). The shots
come from the title screen's demo: Momo mid-jump on Sprout Shore, framed by the photo camera.
"""
import io
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
FONT = os.path.join(HERE, "..", "src", "fonts", "LilitaOne.ttf")
URL = "http://localhost:3000/play?g=puddo-clayland"
ONLY_3D = "(() => { document.body.style.visibility = 'hidden'; document.querySelectorAll('canvas').forEach((c) => { c.style.visibility = 'visible'; }); document.querySelectorAll('nextjs-portal').forEach((e) => { e.style.display = 'none'; }); })()"


def grab(w, h, dpr, frame_w, dx, dy, min_t=4.0):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__clayTitle && window.__clayTitle.sim", timeout=180000)
        # wait for a good moment: Momo rising in a jump, after a few seconds of running
        pg.wait_for_function(f"(() => {{ const s = window.__clayTitle.sim; return s.t > {min_t} && !s.ground && s.vy > 3 && s.vy < 9; }})()", timeout=120000, polling=16)
        pg.evaluate("(() => { const d = window.__clayTitle; d.pause(true); const s = d.sim; d.r.photo = { x: s.x + %s, y: s.y + %s, w: %s }; d.r.frame(0); d.r.frame(0); })()" % (dx, dy, frame_w))
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(900)
        png = pg.screenshot()
        b.close()
    return Image.open(io.BytesIO(png)).convert("RGB")


def grab_portrait():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 700, "height": 760}, device_scale_factor=1)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.wait_for_function("window.__clayTitle && window.__clayTitle.sim", timeout=180000)
        pg.wait_for_function("(() => { const s = window.__clayTitle.sim; return s.t > 2 && s.ground; })()", timeout=120000, polling=16)
        pg.evaluate("(() => { const d = window.__clayTitle; d.pause(true); d.r.portrait = '#FF00FF'; d.r.frame(0); d.r.frame(0); })()")
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(700)
        png = pg.screenshot()
        b.close()
    return Image.open(io.BytesIO(png)).convert("RGB")


def cutout(img):
    """key out the flat magenta background, soften the edge and pull the pink out of the fringe"""
    im = img.convert("RGBA")
    px = im.load(); W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            d = abs(r - 255) + g + abs(b - 255)
            a = max(0, min(255, int((d - 60) * 2.2)))
            if 0 < a < 255:
                m = min(r, b) - g
                if m > 0: r -= m * (255 - a) // 255; b -= m * (255 - a) // 255
            px[x, y] = (r, g, b, a)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def cover(img, W, H):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def compose(shot, W, H, lines=("PUDDO'S", "CLAYLAND"), tag="Blast the Dust Army!"):
    img = cover(shot, W, H)
    grad = Image.new("L", (W, H)); gp = grad.load()
    for x in range(W):
        a = max(0.0, 1 - x / (W * 0.6)) ** 1.5
        for y in range(H): gp[x, y] = int(190 * a)
    img.paste(Image.new("RGB", (W, H), (20, 48, 90)), (0, 0), grad)
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.22); logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.07)), logo)
    d = ImageDraw.Draw(img)
    tx, ty = int(W * 0.05), int(H * 0.3)
    for i, w in enumerate(lines):
        size = int(H * (0.11 if i == 0 else 0.19)); f = ImageFont.truetype(FONT, size)
        y = ty if i == 0 else ty + int(H * 0.12)
        fill = (255, 255, 255) if i == 0 else (255, 194, 26)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((tx + 5, y + 10), w, font=f, fill=(40, 18, 0, 220), stroke_width=int(size * 0.11), stroke_fill=(40, 18, 0, 220))
        sh = sh.filter(ImageFilter.GaussianBlur(3)); img.paste(sh, (0, 0), sh)
        d.text((tx, y), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(122, 58, 0))
    f2 = ImageFont.truetype(FONT, int(H * 0.056))
    py = ty + int(H * 0.36)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, py, tx + tw + 44, py + int(H * 0.095)), radius=int(H * 0.05), fill=(79, 209, 139))
    d.text((tx + 22, py + int(H * 0.018)), tag, font=f2, fill=(255, 255, 255))
    f3 = ImageFont.truetype(FONT, int(H * 0.044))
    d.text((tx, int(H * 0.88)), "400 STAGES · 20 ZONES · PLAY FREE ON MOMOBLOBS", font=f3, fill=(255, 248, 235))
    return img


if __name__ == "__main__":
    out = os.path.join(PUB, "games", "puddo-clayland")
    os.makedirs(out, exist_ok=True)
    card = grab(450, 600, 2, 6.5, 0.6, 1.2)
    card.resize((600, 800), Image.LANCZOS).save(os.path.join(out, "card.webp"), "WEBP", quality=86, method=6)
    wide = grab(1600, 900, 1, 15, -3.2, 1.6, 5.0)
    compose(wide, 1280, 720).save(os.path.join(out, "hero.webp"), "WEBP", quality=86, method=6)
    compose(wide, 1200, 630).save(os.path.join(out, "og.jpg"), quality=86, optimize=True, progressive=True)
    pc = cutout(grab_portrait())
    k = 440 / max(pc.width, pc.height)
    pc = pc.resize((max(1, int(pc.width * k)), max(1, int(pc.height * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (480, 480), (0, 0, 0, 0)); canvas.paste(pc, ((480 - pc.width) // 2, (480 - pc.height) // 2), pc)
    canvas.save(os.path.join(out, "puddo.webp"), "WEBP", quality=90, method=6)
    print("art written to", out)
