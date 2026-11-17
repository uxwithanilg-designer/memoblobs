"""Headless QA for the racing game: home, garage, quick race (intro, GO, racing, nitro, hood cam).
usage: python scripts/race_qa.py <outdir> <width> <height> <tag> [world name to pick in Quick Race]
Uses window.__race.debugAdvance(sec) to fast-forward game time (software GL is slow)."""
import sys, time
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; W = int(sys.argv[2]); H = int(sys.argv[3]); tag = sys.argv[4] if len(sys.argv) > 4 else "m"
theme = sys.argv[5] if len(sys.argv) > 5 else None
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    mobile = W < 900
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:400]))
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errs.append(m.text[:300]))
    pg.goto("http://localhost:3000/play/nitro-rush", wait_until="load")
    pg.wait_for_timeout(6000)
    pg.screenshot(path=f"{OUT}/{tag}_0_home.png")
    pg.get_by_text("GARAGE").first.click(); pg.wait_for_timeout(2500)
    pg.screenshot(path=f"{OUT}/{tag}_1_garage.png")
    pg.get_by_role("button", name="Back").first.click(); pg.wait_for_timeout(600)
    pg.get_by_text("QUICK RACE").first.click(); pg.wait_for_timeout(800)
    if theme: pg.get_by_text(theme).first.click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="RACE").last.click()
    for i in range(80):
        pg.wait_for_timeout(500)
        if pg.evaluate("!!(window.__race && window.__race.phase === 'intro')"): break
    pg.evaluate("window.__race.debugAdvance(1.0)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/{tag}_2_intro.png")
    pg.evaluate("window.__race.debugAdvance(4.6)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/{tag}_3_go.png")
    pg.evaluate("window.__race.debugAdvance(7)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/{tag}_4_racing.png")
    pg.evaluate("window.__race.touch.nitro = true; window.__race.touch.left = true; window.__race.debugAdvance(1.5)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/{tag}_5_nitro.png")
    pg.evaluate("window.__race.touch.nitro = false; window.__race.touch.left = false; window.__race.cycleCamera(); window.__race.cycleCamera(); window.__race.debugAdvance(3)"); pg.wait_for_timeout(300); pg.screenshot(path=f"{OUT}/{tag}_6_hood.png")
    st = pg.evaluate("(() => { const r = window.__race; const c = r.player.car; return { speed: Math.round(c.v*3.6), s: Math.round(c.s), lap: c.lap, d: c.d.toFixed(1), phase: r.phase, L: Math.round(r.track.length) }; })()")
    print("state", st)
    print("errors:", errs[:6] if errs else "none")
    b.close()
