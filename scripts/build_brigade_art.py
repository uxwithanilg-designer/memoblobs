"""Blob Brigade cover art from a real game render (the dev server must be running on :3000).

usage: python scripts/build_brigade_art.py [stage-index 1..20] [seconds-of-autopilot]
writes public/games/blob-brigade/card.webp (600x800, text-free), hero.webp (1280x720) and og.jpg (1200x630).
"""
import io
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public")
FONT = os.path.join(HERE, "..", "src", "fonts", "LilitaOne.ttf")
STAGE = int(sys.argv[1]) if len(sys.argv) > 1 else 9
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 11
URL = "http://localhost:3000/play/blob-brigade"
UNLOCK = """localStorage.setItem('momoblobs:blob-brigade', JSON.stringify({state:{stars:Object.fromEntries([...Array(20)].map((_,i)=>[(i<10?'garden-':'candy-')+((i%10)+1),1])), tutorialDone:true}, version:1}))"""
HIDE = """const s=document.createElement('style'); s.textContent=`.bb-root .z-20,.bb-float,.bb-hp,button[aria-label="Pause"],nextjs-portal{display:none!important}`; document.head.appendChild(s);"""


CLIP = None


def grab(w, h, dpr, clip=None):
    global CLIP
    CLIP = clip
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"])
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
        pg.add_init_script(UNLOCK)
        pg.goto(URL, wait_until="domcontentloaded", timeout=180000)
        pg.get_by_text("PLAY", exact=True).first.wait_for(timeout=180000)
        pg.wait_for_timeout(1500)
        pg.get_by_text("PLAY", exact=True).first.click()
        pg.wait_for_timeout(800)
        pg.get_by_label(f"Stage {((STAGE - 1) % 10) + 1}:").nth((STAGE - 1) // 10).click()
        pg.wait_for_timeout(600)
        pg.get_by_text("PLAY", exact=True).last.click()
        pg.wait_for_function("window.__brigade && window.__brigade.sim", timeout=60000)
        pg.evaluate("window.__brigade.autopilot = true")
        pg.evaluate(f"window.__brigade.debugAdvance({SECS})")
        # wait for the money shot: a big brigade in the middle, the march close, bubbles flying
        for _ in range(40):
            ok = pg.evaluate("""(() => { const s = window.__brigade.sim, h = s.horde; let f = -1e9;
              for (let i = 0; i < h.len; i++) if (h.on[i] && h.z[i] > f) f = h.z[i];
              return s.n >= 40 && f > -15 && f < -6 && Math.abs(s.bx) < 2.6; })()""")
            if ok: break
            pg.evaluate("window.__brigade.debugAdvance(0.5)")
        # step into the middle of the board and let the bubbles fly
        pg.evaluate("(() => { const b = window.__brigade; b.autopilot = false; b.sim.tx = 0.4; b.debugAdvance(0.9); })()")
        pg.evaluate(HIDE)
        pg.wait_for_timeout(700)
        pg.evaluate("window.__brigade.pause()")
        pg.wait_for_timeout(1200)
        png = pg.screenshot(clip=CLIP) if CLIP else pg.screenshot()
        b.close()
    return Image.open(io.BytesIO(png)).convert("RGB")


def cover(img, W, H):
    s = max(W / img.width, H / img.height)
    im = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def compose(shot, W, H, title="Blob Brigade", tag="Grow your brigade!"):
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
        fill = (61, 139, 255) if i == 0 else (255, 138, 61)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((tx + 5, y + 10), w, font=f, fill=(20, 10, 50, 220), stroke_width=int(size * 0.11), stroke_fill=(20, 10, 50, 220))
        sh = sh.filter(ImageFilter.GaussianBlur(3)); img.paste(sh, (0, 0), sh)
        d.text((tx, y), w, font=f, fill=fill, stroke_width=int(size * 0.08), stroke_fill=(255, 255, 255))
    f2 = ImageFont.truetype(FONT, int(H * 0.056))
    py = ty + 2 * int(size * 0.98) + int(H * 0.04)
    tw = d.textlength(tag, font=f2)
    d.rounded_rectangle((tx, py, tx + tw + 44, py + int(H * 0.095)), radius=int(H * 0.05), fill=(47, 203, 139))
    d.text((tx + 22, py + int(H * 0.018)), tag, font=f2, fill=(255, 255, 255))
    f3 = ImageFont.truetype(FONT, int(H * 0.044))
    d.text((tx, int(H * 0.88)), "FREE · NO SIGN-UP · PLAY ON MOMOBLOBS", font=f3, fill=(255, 248, 235))
    return img


if __name__ == "__main__":
    out = os.path.join(PUB, "games", "blob-brigade")
    os.makedirs(out, exist_ok=True)
    # a tall phone frame, cropped to its lower 3:4 so the brigade and the march fill the card
    card = grab(450, 800, 2, {"x": 0, "y": 200, "width": 450, "height": 600})
    card.resize((600, 800), Image.LANCZOS).save(os.path.join(out, "card.webp"), "WEBP", quality=86, method=6)
    if os.environ.get("CARD_ONLY") != "1":
        # wider than 16:9 and cropped from the left, so the board sits right of the title
        wide = grab(2100, 900, 1, {"x": 0, "y": 0, "width": 1600, "height": 900})
        compose(wide, 1280, 720).save(os.path.join(out, "hero.webp"), "WEBP", quality=86, method=6)
        compose(wide, 1200, 630).save(os.path.join(out, "og.jpg"), quality=86, optimize=True, progressive=True)
    print("art ok", out)
