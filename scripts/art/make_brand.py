"""MOMOBLOBS brand files from scripts/art/brand/icon.svg (rendered in headless Chrome, so they match the site's SVG):

  src/app/icon.png (512), src/app/apple-icon.png (180, full-bleed), src/app/favicon.ico (16/32/48)
  public/icons/icon-192.png, icon-512.png, maskable-512.png (full-bleed, art inside the safe zone)
  public/brand/logo.png (lockup for light backgrounds, used by JSON-LD), logo-light.png (for dark backgrounds), icon-512.png
  public/og.jpg (the site's default link preview)

python scripts/art/make_brand.py
"""
import base64
import io
import os
import re
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
SVG = open(os.path.join(HERE, "brand", "icon.svg"), encoding="utf8").read()
FONT = base64.b64encode(open(os.path.join(WEB, "src", "fonts", "LilitaOne.ttf"), "rb").read()).decode()


def variant(kind):
    s = SVG
    if kind in ("bleed", "maskable"):
        s = s.replace('<rect x="2" y="2" width="96" height="96" rx="25" fill="url(#bg)"/>', '<rect x="0" y="0" width="100" height="100" fill="url(#bg)"/>')
        s = s.replace('<rect x="2" y="2" width="96" height="96" rx="25" fill="url(#shine)"/>', '<rect x="0" y="0" width="100" height="100" fill="url(#shine)"/>')
    if kind == "maskable":  # keep the art inside the 80% safe circle
        s = re.sub(r"(<!-- sprout -->)", r'<g transform="translate(50 52) scale(0.78) translate(-50 -52)">\1', s)
        s = s.replace("</svg>", "</g></svg>")
    return "data:image/svg+xml;base64," + base64.b64encode(s.encode()).decode()


def page(pg, html, w, h):
    pg.set_viewport_size({"width": w, "height": h})
    pg.set_content(f"""<html><head><style>@font-face {{ font-family: L; src: url(data:font/ttf;base64,{FONT}); }}
      html, body {{ margin: 0; background: transparent; }} body {{ width: {w}px; height: {h}px; overflow: hidden; font-family: L; }}</style></head>
      <body>{html}</body></html>""")
    pg.wait_for_timeout(250)
    pg.evaluate("document.fonts.ready")
    return Image.open(io.BytesIO(pg.screenshot(omit_background=True))).convert("RGBA")


def icon(pg, kind, size):
    return page(pg, f'<img src="{variant(kind)}" width="{size}" height="{size}" style="display:block">', size, size)


def lockup(pg, light, h=240):
    word = "#ffffff" if light else "#22104F"
    shadow = "text-shadow: 0 6px 0 #22104F;" if light else ""
    html = f"""<div style="display:flex;align-items:center;gap:{int(h * 0.16)}px;height:{h}px;padding:0 {int(h * 0.06)}px">
      <img src="{variant('round')}" width="{h}" height="{h}" style="filter: drop-shadow(0 {h // 30}px {h // 18}px rgba(255,90,60,.45))">
      <div style="display:flex;flex-direction:column;line-height:.86;letter-spacing:.03em;font-size:{int(h * 0.47)}px">
        <span style="background:linear-gradient(90deg,#FFD25A,#FF7A2A);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 {h // 40}px 0 #22104F)">MOMO</span>
        <span style="color:{word};{shadow}">BLOBS</span></div></div>"""
    im = page(pg, html, int(h * 3.4), h + 20)
    return im.crop(im.getchannel("A").getbbox())


def og(pg, lock):
    """default link preview: game cards fanned behind the logo"""
    sys.path.insert(0, HERE)
    import kit as K
    from meta import games
    W, H = 1200, 630
    c = K.lin(W, H, [(0, "#2a1260"), (1, "#0e0726")])
    K.add(c, K.rad(W, H, [(0, (255, 122, 42, 110)), (0.5, (0, 0, 0, 0))], 0.5, 0.45, 0.7), "screen")
    picks = ["rollo-rush", "kiko-jungle-quest", "momo-jelly-jam", "drift-kings", "tondu-vine-climb", "slurp-lab", "momo-dash", "where-is-zib", "puddo-clayland", "whack-a-gloop"]
    for i, slug in enumerate(picks):
        p = os.path.join(K.OUT, "thumbs", f"{slug}.png")
        if not os.path.exists(p): continue
        card = K.card_frame(K.load(p), 300, 169, 18, 5, "#ffffff")
        row, col = divmod(i, 5)
        x = 120 + col * 240 + (60 if row else 0); y = 105 + row * 440
        K.put(c, card, x, y, "mm", shadow=dict(r=14, k=0.5, dy=10), rot=(-7 + col * 3.5) * (1 if row else -1))
    c.alpha_composite(K.rad(W, H, [(0, (14, 7, 38, 235)), (0.42, (14, 7, 38, 160)), (0.75, (14, 7, 38, 0))], 0.5, 0.5, 0.55))
    K.put(c, K.fit(lock, w=600), W // 2, 290, "mm")
    t = K.pill("FREE GAMES  ·  PLAY IN YOUR BROWSER  ·  NO DOWNLOAD", "Michroma-Regular.ttf", 20, "#ffe8c0", "#140a30", track=3, outline="#ff7a2a", ow=2)
    K.put(c, t, W // 2, 440, "mm")
    return K.grain(c, 5)


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page()
        icon(pg, "round", 512).save(os.path.join(WEB, "src", "app", "icon.png"))
        icon(pg, "bleed", 180).convert("RGB").save(os.path.join(WEB, "src", "app", "apple-icon.png"))
        ico = icon(pg, "round", 256)
        ico.save(os.path.join(WEB, "src", "app", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
        os.makedirs(os.path.join(WEB, "public", "icons"), exist_ok=True)
        icon(pg, "round", 192).save(os.path.join(WEB, "public", "icons", "icon-192.png"))
        icon(pg, "round", 512).save(os.path.join(WEB, "public", "icons", "icon-512.png"))
        icon(pg, "maskable", 512).convert("RGB").save(os.path.join(WEB, "public", "icons", "maskable-512.png"))
        brand = os.path.join(WEB, "public", "brand")
        icon(pg, "round", 512).save(os.path.join(brand, "icon-512.png"))
        dark_text = lockup(pg, light=False); light_text = lockup(pg, light=True)
        dark_text.save(os.path.join(brand, "logo.png"))
        light_text.save(os.path.join(brand, "logo-light.png"))
        light_text.save(os.path.join(HERE, "brand", "logo-light.png")); dark_text.save(os.path.join(HERE, "brand", "logo-dark.png"))
        b.close()
    og(None, light_text).convert("RGB").save(os.path.join(WEB, "public", "og.jpg"), quality=88, optimize=True, progressive=True)
    print("brand files written")


if __name__ == "__main__":
    main()
