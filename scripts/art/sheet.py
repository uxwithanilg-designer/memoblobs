"""Preview sheet of title PNGs on alternating dark/light tiles: python scripts/art/sheet.py <out.jpg> slug ..."""
import os
import sys

from PIL import Image

O = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "titles")
out, names = sys.argv[1], sys.argv[2:]
C = 2 if len(names) <= 4 else 3
TW, TH = 900, 520
rows = (len(names) + C - 1) // C
sheet = Image.new("RGB", (C * TW, rows * TH), "#222")
for i, n in enumerate(names):
    bg = [(40, 30, 76), (232, 232, 238), (30, 90, 70), (120, 40, 60)][(i + i // C) % 4]
    tile = Image.new("RGB", (TW, TH), bg)
    p = os.path.join(O, f"{n}.png")
    if os.path.exists(p):
        im = Image.open(p); im.thumbnail((TW - 40, TH - 40)); tile.paste(im, ((TW - im.width) // 2, (TH - im.height) // 2), im)
    sheet.paste(tile, ((i % C) * TW, (i // C) * TH))
sheet.save(out, quality=86)
