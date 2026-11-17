"""QA screenshots of arcade games in a real (headless) Chrome.

usage: python scripts/qa_shot.py <slug> <out_dir> [--w 390 --h 844] [--steps "js;js;..."]
Each step is JS run in the page; after each step a screenshot is saved as <slug>_<i>.png.
Helpers available in steps: A (the game), wait(ms), until(fn, ms), play(diff, level).
"""
import argparse
import os
import sys

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("out")
ap.add_argument("--w", type=int, default=390)
ap.add_argument("--h", type=int, default=844)
ap.add_argument("--base", default="http://localhost:3000")
ap.add_argument("--steps", default="")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

HELPERS = """
window.wait = (ms) => new Promise(r => setTimeout(r, ms));
window.until = async (fn, ms = 15000) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await wait(50); };
window.play = async (d, l) => { await until(() => window.__arcade && window.__arcade.hud.status === 'lobby'); window.__arcade.start(d, l, 0); };
"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"])
    mobile = a.w < 700
    ctx = b.new_context(viewport={"width": a.w, "height": a.h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text[:300]))
    page.add_init_script(HELPERS)
    page.goto(f"{a.base}/play/{a.slug}", wait_until="load")
    for _ in range(80):
        if page.evaluate("!!(window.__arcade && window.__arcade.hud.status === 'lobby')"): break
        page.wait_for_timeout(500)
    page.wait_for_timeout(1200)
    page.screenshot(path=os.path.join(a.out, f"{a.slug}_0.png"))
    for i, step in enumerate([s for s in a.steps.split(";;") if s.strip()], 1):
        page.evaluate("async () => { const A = window.__arcade; " + step + " }")
        page.screenshot(path=os.path.join(a.out, f"{a.slug}_{i}.png"))
    print("errors:", errs[:8] if errs else "none")
    b.close()
