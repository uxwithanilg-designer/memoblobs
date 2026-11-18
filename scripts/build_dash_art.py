"""Momo Dash! cover art from a real game render (the dev server must be running on :3000).

usage: python scripts/build_dash_art.py [stage] [seconds]
writes public/games/momo-dash/card.webp (600x800, text-free), hero.webp (1280x720) and og.jpg (1200x630).
The shot is the title screen's 3D view: Momo running toward the camera on Sunset Pier with the conga line behind.
"""
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
FONT = os.path.join(HERE, "..", "src", "fonts", "LilitaOne.ttf")
STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 8
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 9
URL = "http://localhost:3000/play/momo-dash"
UNLOCK = "localStorage.setItem('momoblobs:momo-dash', JSON.stringify({state:{current:%d, tutorialDone:true}, version:1}))" % STAGE
ONLY_3D = "(() => { document.body.style.visibility = 'hidden'; document.querySelectorAll('canvas').forEach((c) => { c.style.visibility = 'visible'; }); document.querySelectorAll('nextjs-portal').forEach((e) => { e.style.display = 'none'; }); })()"


CLIP = None


def grab(w, h, dpr, clip=None, cam="{d: 3.3, h: 1.45, side: 1, dx: 0}"):
    global CLIP
    CLIP = clip
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
        pg.add_init_script(UNLOCK)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.get_by_text("RUN!", exact=True).first.wait_for(timeout=180000)
        pg.wait_for_function("window.__dashTitle && window.__dashTitle.sim", timeout=60000)
        pg.evaluate("(() => { const d = window.__dashTitle; d.sim.friends.push('zib', 'pip', 'bolt'); })()")
        pg.evaluate(f"window.__dashTitle.debugAdvance({SECS})")
        pg.evaluate(ONLY_3D)
        pg.wait_for_timeout(800)
        pg.evaluate("(() => { const d = window.__dashTitle; d.pause(); d.r.photoCam = %s; d.r.clearFx(); d.r.update(0, []); d.r.render(); })()" % cam)
        pg.wait_for_timeout(1500)
        png = pg.screenshot(clip=CLIP) if CLIP else pg.screenshot()
        b.close()
    return Image.open(io.BytesIO(png)).convert("RGB")


def cover(img, W, H):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def compose(shot, W, H, title="Momo Dash!", tag="Swipe, jump, squish!"):
    img = cover(shot, W, H)
    grad = Image.new("L", (W, H)); gp = grad.load()
    for x in range(W):
        a = max(0.0, 1 - x / (W * 0.6)) ** 1.4
        for y in range(H): gp[x, y] = int(205 * a)
    img.paste(Image.new("RGB", (W, H), (43, 29, 82)), (0, 0), grad)
    logo = Image.open(os.path.join(PUB, "brand", "logo.webp")).convert("RGBA")
    lw = int(W * 0.24); logo = logo.resize((lw, int(logo.height * lw / logo.width)), Image.LANCZOS)
    img.paste(logo, (int(W * 0.05), int(H * 0.07)), logo)
    d = ImageDraw.Draw(img)
    size = int(H * 0.19); f = ImageFont.truetype(FONT, size)
    tx, ty = int(W * 0.05), int(H * 0.33)
    for i, w in enumerate(title.upper().split(" ")):
        y = ty + i * int(size * 0.98)
        fill = (255, 194, 61) if i == 0 else (255, 95, 162)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((tx + 5, y + 10), w, font=f, fill=(20, 10, 50, 220), stroke_width=int(size * 0.11), stroke_fill=(20, 10, 50, 220))
        sh = sh.filter(ImageFilter.GaussianBlur(3)); img.paste(sh, (0, 0), sh)
        d.text((tx, y), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(255, 255, 255))
    f2 = ImageFont.truetype(FONT, int(H * 0.056))
    py = ty + 2 * int(size * 0.98) + int(H * 0.04)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, py, tx + tw + 44, py + int(H * 0.095)), radius=int(H * 0.05), fill=(123, 92, 255))
    d.text((tx + 22, py + int(H * 0.018)), tag, font=f2, fill=(255, 255, 255))
    f3 = ImageFont.truetype(FONT, int(H * 0.044))
    d.text((tx, int(H * 0.88)), "FREE · NO SIGN-UP · PLAY ON MOMOBLOBS", font=f3, fill=(255, 248, 235))
    return img


if __name__ == "__main__":
    out = os.path.join(PUB, "games", "momo-dash")
    os.makedirs(out, exist_ok=True)
    # a tall phone frame, cropped to a 3:4 window around Momo
    card = grab(450, 800, 2, {"x": 0, "y": 120, "width": 450, "height": 600})
    card.resize((600, 800), Image.LANCZOS).save(os.path.join(out, "card.webp"), "WEBP", quality=86, method=6)
    if os.environ.get("CARD_ONLY") != "1":
        # wider than 16:9 and cropped so Momo sits right of the title
        wide = grab(1600, 900, 1, None, "{d: 3.0, h: 1.4, side: 1, dx: 1.7}")
        compose(wide, 1280, 720).save(os.path.join(out, "hero.webp"), "WEBP", quality=86, method=6)
        compose(wide, 1200, 630).save(os.path.join(out, "og.jpg"), quality=86, optimize=True, progressive=True)
    print("art ok", out)
