"""High-res, text-free source art for posters and thumbnails, captured from the real games (needs `next dev` on :3000).

python scripts/art/capture.py arcade [slug ...]   gameplay frames of the 30 canvas games   -> out/src/<slug>/f00..f11.jpg
python scripts/art/capture.py title [slug ...]    3D title screens, canvas only (wide + tall) -> out/src/<slug>/title_wide.png, title_tall.png
python scripts/art/capture.py play [slug ...]     3D gameplay through each game's art hooks  -> out/src/<slug>/play_wide.png, play_tall.png
python scripts/art/capture.py portraits           keyed hero cut-outs (Kiko, Puddo, Tondu)  -> out/src/<slug>/hero.png
"""
import io
import os
import re
import sys
import importlib

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, "out", "src")
sys.path.insert(0, os.path.join(WEB, "scripts"))
BASE = "http://localhost:3000"
HIDE = ("(() => { const st = document.createElement('style'); st.textContent = `body * { visibility: hidden !important; } "
        "canvas { visibility: visible !important; } nextjs-portal { display: none !important; }`; document.head.appendChild(st); })()")
GAMES_3D = ["rollo-rush", "momo-jelly-jam", "nitro-rush", "drift-kings", "highway-heat", "moto-rush", "blob-brigade", "momo-boing", "momo-dash",
            "kiko-jungle-quest", "puddo-clayland", "slurp-lab", "tondu-vine-climb", "sky-roll", "momo-escape", "momo-shuffle"]


def arcade_slugs():
    s = open(os.path.join(WEB, "src", "lib", "arcade-catalog.ts"), encoding="utf8").read()
    return re.findall(r'slug: "([a-z0-9-]+)", title: "[^"]+", host: "\w+", live: true', s)


def out(slug):
    d = os.path.join(SRC, slug); os.makedirs(d, exist_ok=True); return d


def arcade(slugs):
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"])
        ctx = b.new_context(viewport={"width": 1000, "height": 760}, device_scale_factor=2)
        for slug in slugs:
            page = ctx.new_page()
            page.goto(f"{BASE}/play?g={slug}", wait_until="load")
            for _ in range(120):
                if page.evaluate("!!(window.__arcade && window.__arcade.hud.status === 'lobby')"): break
                page.wait_for_timeout(400)
            page.wait_for_timeout(800)
            page.evaluate(HIDE)
            page.evaluate("window.__arcade.start('medium', 4, 0)")
            d = out(slug)
            for i in range(18):
                page.wait_for_timeout(500)
                page.screenshot(path=os.path.join(d, f"f{i:02d}.jpg"), type="jpeg", quality=92)
            print("arcade", slug, flush=True)
            page.close()
        b.close()


def title(slugs):
    """the game's own title scene, canvas only, at a wide and a tall size"""
    for slug in slugs:
        for name, (w, h, dpr) in {"title_wide": (1600, 900, 1.2), "title_tall": (600, 900, 1.8)}.items():
            with sync_playwright() as p:
                b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
                pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=dpr)
                pg.goto(f"{BASE}/play?g={slug}", wait_until="domcontentloaded", timeout=180000)
                try: pg.wait_for_selector("canvas", timeout=120000)
                except Exception: print("no canvas", slug); b.close(); continue
                pg.wait_for_timeout(int(os.environ.get("TITLE_WAIT", "11000")))
                pg.evaluate(HIDE)
                pg.wait_for_timeout(600)
                pg.screenshot(path=os.path.join(out(slug), f"{name}.png"))
                b.close()
        print("title", slug, flush=True)


def play(slugs):
    """gameplay shots through the existing per-game art helpers, at poster/thumbnail sizes"""
    jobs = {
        "momo-boing": lambda m: (m.grab(1600, 900, 1.2), m.grab(600, 900, 1.8)),
        "blob-brigade": lambda m: (m.grab(1600, 900, 1.2), m.grab(600, 900, 1.8)),
        "momo-dash": lambda m: (m.grab(1600, 900, 1.2, None, "{d: 3.0, h: 1.4, side: 1, dx: 0.9}"), m.grab(600, 900, 1.8)),
        "kiko-jungle-quest": lambda m: (m.grab(1600, 900, 1.2, None, "{d: 3.0, h: 1.3, side: 1, dx: 0.9}"), m.grab(600, 900, 1.8)),
        "puddo-clayland": lambda m: (m.grab(1600, 900, 1.2, 15, -1.2, 1.6, 5.0), m.grab(600, 900, 1.8, 7.5, 0.6, 1.6)),
        "slurp-lab": lambda m: (m.grab(1600, 900, 1.2, 2.0, 2), m.grab(600, 900, 1.8, 0, 2)),
        "tondu-vine-climb": lambda m: (m.climb_shot(1600, 900, 1.2, m.HERO, cam=[[-2.3, -0.9, 6.4], [-2.3, 0.15, 0], 38]), m.climb_shot(600, 900, 1.8, m.CARD)),
    }
    mods = {"momo-boing": "build_boing_art", "blob-brigade": "build_brigade_art", "momo-dash": "build_dash_art", "kiko-jungle-quest": "build_kiko_art",
            "puddo-clayland": "build_clay_art", "slurp-lab": "build_slurp_art", "tondu-vine-climb": "build_vine_art"}
    argv = sys.argv; sys.argv = [argv[0]]  # the helpers read sys.argv at import
    for slug in slugs:
        if slug not in jobs: continue
        m = importlib.import_module(mods[slug])
        try:
            wide, tall = jobs[slug](m)
            wide.save(os.path.join(out(slug), "play_wide.png")); tall.save(os.path.join(out(slug), "play_tall.png"))
            print("play", slug, wide.size, tall.size, flush=True)
        except Exception as e:
            print("play FAILED", slug, e, flush=True)
    sys.argv = argv


def portraits():
    argv = sys.argv; sys.argv = [argv[0]]
    import build_clay_art as clay
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome", args=["--mute-audio", "--ignore-gpu-blocklist"])
            pg = b.new_page(viewport={"width": 700, "height": 760}, device_scale_factor=2.4)
            pg.goto(clay.URL, wait_until="domcontentloaded", timeout=180000)
            pg.wait_for_function("window.__clayTitle && window.__clayTitle.sim", timeout=180000)
            pg.wait_for_function("(() => { const s = window.__clayTitle.sim; return s.t > 2 && s.ground; })()", timeout=120000, polling=16)
            pg.evaluate("(() => { const d = window.__clayTitle; d.pause(true); d.r.portrait = '#FF00FF'; d.r.frame(0); d.r.frame(0); })()")
            pg.evaluate(clay.ONLY_3D)
            pg.wait_for_timeout(800)
            img = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
            b.close()
        clay.cutout(img).save(os.path.join(out("puddo-clayland"), "hero.png")); print("portrait puddo", flush=True)
    except Exception as e: print("portrait puddo FAILED", e, flush=True)
    import build_vine_art as vine
    try:
        src = open(vine.__file__, encoding="utf8").read()
        code = src[src.index("def portrait("):src.index("def cover(")].replace("device_scale_factor=1", "device_scale_factor=2.2").replace("def portrait(", "def portrait_hi(").replace("return out.resize((480, 480), Image.LANCZOS)", "return out")
        ns = dict(vine.__dict__); exec(code, ns)
        ns["portrait_hi"]().save(os.path.join(out("tondu-vine-climb"), "hero.png")); print("portrait tondu", flush=True)
    except Exception as e: print("portrait tondu FAILED", e, flush=True)
    sys.argv = argv


if __name__ == "__main__":
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == "arcade": arcade(rest or arcade_slugs())
    elif cmd == "title": title(rest or GAMES_3D)
    elif cmd == "play": play(rest or GAMES_3D)
    elif cmd == "portraits": portraits()
