"""Garage close-ups. usage: python scripts/car_qa.py <outdir> "Car Name,Other Car" """
import sys
from playwright.sync_api import sync_playwright
OUT = sys.argv[1]; names = sys.argv[2].split(",")
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1280, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:300]))
    pg.goto("http://localhost:3000/play/nitro-rush", wait_until="load"); pg.wait_for_timeout(5000)
    pg.get_by_text("GARAGE").first.click(); pg.wait_for_timeout(1500)
    for n in names:
        pg.get_by_role("button", name=n).first.click(); pg.wait_for_timeout(1800)
        box = pg.locator("div.relative.h-\[34vh\]").first.bounding_box()
        pg.screenshot(path=f"{OUT}/car_{n.replace(' ','_')}.png", clip=box)
    print("errors", errs or "none")
    b.close()
