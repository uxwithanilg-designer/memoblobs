"""Wake Racers key art, made from the real game: headless Chrome (muted, the dev server on PORT, default 3000) opens
stages in several worlds, and we capture the home screen's close shot of the boat and moments from the race with the
interface hidden, into scripts/art/out/wake; then lay the shots out like the site's other covers — the title in the
display font with a wave mark, tag pills, and tilted gameplay cards over a soft, darkened backdrop — into
public/games/wake-racers/: cover.webp (1280x720), card.webp (600x800), poster.webp (1000x1500), og.jpg (1200x630).

usage: PORT=3000 python scripts/art/wake_art.py [capture] [build]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "games", "wake-racers")
SHOTS = os.path.join(ROOT, "scripts", "art", "out", "wake")
FONT = os.path.join(ROOT, "src", "fonts", "LilitaOne.ttf")
PORT = os.environ.get("PORT", "3000")
# (name, stage, when: "home" or seconds into the race, viewport)
SCENES = [
    ("lagoon_home", 8, "home", (1280, 720)), ("lagoon_race", 8, 6.0, (1280, 720)), ("canyon", 58, 7.0, (1280, 720)),
    ("harbor", 108, 6.5, (1280, 720)), ("fjord", 158, 7.0, (1280, 720)), ("blossom_home", 308, "home", (1280, 720)),
    ("cyber", 558, 6.0, (1280, 720)), ("storm", 412, 6.0, (1280, 720)), ("jungle_home", 212, "home", (1280, 720)),
    ("tall", 9, 6.5, (720, 1280)), ("tall_home", 60, "home", (720, 1280)),
]
HIDE = "(() => { const s = document.createElement('style'); s.textContent = 'body * { visibility: hidden !important; } .wk-stage, .wk-stage canvas { visibility: visible !important; } nextjs-portal { display: none !important; }'; document.head.appendChild(s); })()"
SAVE = "(n) => localStorage.setItem('momoblobs-wakeracers', JSON.stringify({ state: { ...((JSON.parse(localStorage.getItem('momoblobs-wakeracers') || '{}')).state || {}), stage: n, seenHelp: true }, version: 1 }))"


def capture(scenes):
    from playwright.sync_api import sync_playwright
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--autoplay-policy=no-user-gesture-required", "--enable-gpu", "--ignore-gpu-blocklist"])
        for name, stage, when, (w, h) in scenes:
            pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1.5)
            pg.goto(f"http://localhost:{PORT}/play?g=wake-racers", wait_until="domcontentloaded", timeout=180000)
            pg.evaluate(SAVE, stage)
            pg.reload(wait_until="domcontentloaded")
            pg.wait_for_function("() => window.__wake && window.__wake.scene", timeout=180000)
            pg.get_by_role("button", name="RACE").wait_for(state="visible", timeout=60000)
            pg.wait_for_timeout(1500)
            if when != "home":
                pg.evaluate("() => { const g = window.__wake; g.autopilot = true; }")
                pg.get_by_role("button", name="RACE").click()
                pg.wait_for_timeout(600)
                pg.evaluate("() => window.__wake.skipIntro()")
                pg.wait_for_function("() => window.__wake.phase === 'race'", timeout=30000)
                pg.wait_for_timeout(int(when * 1000))
            else:
                pg.wait_for_timeout(2500)
            pg.evaluate(HIDE)
            pg.wait_for_timeout(120)
            pg.screenshot(path=os.path.join(SHOTS, f"{name}.png"), timeout=60000)
            print("shot", name, pg.evaluate("() => [window.__wake.plan.world, window.__wake.phase, Math.round(window.__wake.race.player.boat.s)]"), flush=True)
            pg.close()
        b.close()


# ---------------------------------------------------------------- layout
def shot(name): return Image.open(os.path.join(SHOTS, f"{name}.png")).convert("RGB")


def cover_fit(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s + 0.5), int(im.height * s + 0.5)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def backdrop(im, w, h, dark=0.45):
    bg = cover_fit(im, w, h).filter(ImageFilter.GaussianBlur(14))
    return Image.blend(bg, Image.new("RGB", (w, h), (6, 18, 46)), dark)


def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), r, fill=255)
    out = im.convert("RGBA"); out.putalpha(m)
    return out


def card_of(im, w, h, angle, border=10, radius=26):
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


def outlined(draw, xy, text, font, fill, stroke, sw, shadow=None):
    x, y = xy
    if shadow: draw.text((x, y + sw * 1.1), text, font=font, fill=shadow, stroke_width=sw, stroke_fill=shadow)
    draw.text((x, y), text, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke)


def wave_mark(img, cx, cy, r):
    """a round badge with a curling wave"""
    d = ImageDraw.Draw(img)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 181, 71), outline=(6, 20, 46), width=max(3, r // 8))
    pts = []
    for i in range(41):
        u = i / 40
        x = cx - r * 0.72 + u * r * 1.44
        y = cy + r * 0.12 - math.sin(u * math.pi * 2) * r * 0.22
        pts.append((x, y))
    pts += [(cx + r * 0.72, cy + r * 0.55), (cx - r * 0.72, cy + r * 0.55)]
    d.polygon(pts, fill=(25, 211, 197), outline=(6, 20, 46))


def title(img, x, y, size, center=False):
    d = ImageDraw.Draw(img)
    f1 = ImageFont.truetype(FONT, size); f2 = ImageFont.truetype(FONT, int(size * 0.8))
    sw = max(4, size // 11)
    w1 = d.textlength("WAKE", font=f1) + size * 0.8
    tx = x - w1 / 2 if center else x
    outlined(d, (tx, y), "WAKE", f1, (95, 242, 224), (6, 20, 46), sw, shadow=(6, 20, 46))
    wave_mark(img, int(tx + d.textlength("WAKE", font=f1) + size * 0.42), int(y + size * 0.56), int(size * 0.36))
    w2 = d.textlength("RACERS", font=f2)
    tx2 = x - w2 / 2 if center else x
    outlined(d, (tx2, y + int(size * 0.9)), "RACERS", f2, (255, 181, 71), (6, 20, 46), sw, shadow=(6, 20, 46))


def pill(img, x, y, text, size, bg, fg=(255, 255, 255), center=False):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    w = d.textlength(text, font=f)
    pad = size * 0.7
    x0 = x - (w + pad * 2) / 2 if center else x
    d.rounded_rectangle((x0, y, x0 + w + pad * 2, y + size * 1.55), radius=int(size * 0.78), fill=bg)
    d.text((x0 + pad, y + size * 0.22), text, font=f, fill=fg)


def build():
    os.makedirs(OUT, exist_ok=True)
    lh, lr, canyon, harbor, fjord, bh, cyber, storm, jh = (shot(n) for n in ("lagoon_home", "lagoon_race", "canyon", "harbor", "fjord", "blossom_home", "cyber", "storm", "jungle_home"))
    tall, tall_home = shot("tall"), shot("tall_home")
    TEAL, ORANGE, INK = (19, 201, 214), (255, 106, 61), (3, 43, 51)

    W, H = 1280, 720
    img = backdrop(lh, W, H, 0.38).convert("RGBA")
    img.alpha_composite(card_of(canyon, 520, 293, -6), (690, 340))
    img.alpha_composite(card_of(lh, 600, 338, 4), (610, 36))
    title(img, 70, 130, 150)
    pill(img, 74, 440, "3D SPEEDBOAT RACING", 30, ORANGE)
    pill(img, 74, 500, "600+ STAGES · 12 WORLDS", 30, TEAL, INK)
    img.convert("RGB").save(os.path.join(OUT, "cover.webp"), quality=86)

    W, H = 1200, 630
    img = backdrop(lr, W, H, 0.4).convert("RGBA")
    img.alpha_composite(card_of(harbor, 470, 265, -6), (660, 310))
    img.alpha_composite(card_of(lr, 560, 315, 4), (590, 26))
    title(img, 60, 100, 140)
    pill(img, 64, 400, "3D SPEEDBOAT RACING", 28, ORANGE)
    pill(img, 64, 456, "600+ STAGES · 12 WORLDS", 28, TEAL, INK)
    img.convert("RGB").save(os.path.join(OUT, "og.jpg"), quality=88)

    W, H = 600, 800
    img = backdrop(bh, W, H, 0.38).convert("RGBA")
    title(img, W // 2, 30, 104, center=True)
    pill(img, W // 2, 236, "JUMP · DRIFT · WIN THE RACE", 22, ORANGE, center=True)
    img.alpha_composite(card_of(fjord, 470, 265, -5), (20, 300))
    img.alpha_composite(card_of(cyber, 470, 265, 6), (100, 510))
    img.convert("RGB").save(os.path.join(OUT, "card.webp"), quality=86)

    W, H = 1000, 1500
    img = cover_fit(tall_home, W, H).convert("RGBA")
    top = Image.new("RGBA", (W, 540), (0, 0, 0, 0)); g = ImageDraw.Draw(top)
    for i in range(540): g.line([(0, i), (W, i)], fill=(4, 14, 38, int(210 * (1 - i / 540))))
    img.alpha_composite(top, (0, 0))
    bot = Image.new("RGBA", (W, 560), (0, 0, 0, 0)); g = ImageDraw.Draw(bot)
    for i in range(560): g.line([(0, i), (W, i)], fill=(4, 14, 38, int(225 * (i / 560))))
    img.alpha_composite(bot, (0, H - 560))
    title(img, W // 2, 60, 180, center=True)
    pill(img, W // 2, 450, "RAMPS · WATERFALLS · RIVALS · NITRO", 30, TEAL, INK, center=True)
    for i, s in enumerate((storm, tall, jh)):
        img.alpha_composite(card_of(s, 280, 175, (-5, 0, 5)[i], border=8, radius=18), (30 + i * 315, H - 330))
    img.convert("RGB").save(os.path.join(OUT, "poster.webp"), quality=86)
    print("art written to", OUT)


if __name__ == "__main__":
    steps = sys.argv[1:] or ["capture", "build"]
    if "capture" in steps: capture(SCENES)
    if "build" in steps: build()
