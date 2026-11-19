"""Contact sheet of posters/thumbs: python scripts/art/psheet.py <posters|thumbs> <out.jpg> slug ..."""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
kind, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
d = os.path.join(HERE, "out", kind)
tw, th = (400, 600) if kind == "posters" else (640, 360)
C = 4 if kind == "posters" else 3
names = [n for n in names if os.path.exists(os.path.join(d, n + ".png"))]
rows = (len(names) + C - 1) // C
sheet = Image.new("RGB", (C * tw + (C + 1) * 8, rows * th + (rows + 1) * 8), "#222")
for i, n in enumerate(names):
    im = Image.open(os.path.join(d, n + ".png")).convert("RGB").resize((tw, th), Image.LANCZOS)
    sheet.paste(im, (8 + (i % C) * (tw + 8), 8 + (i // C) * (th + 8)))
sheet.save(out, quality=86)
