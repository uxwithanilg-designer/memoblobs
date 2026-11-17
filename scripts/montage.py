"""montage.py <out.jpg> <img...> — side-by-side contact sheet (height 640 each)."""
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
H = 640
ims = [im.resize((round(im.width * H / im.height), H)) for im in ims]
sheet = Image.new("RGB", (sum(i.width for i in ims) + 8 * (len(ims) - 1), H), (20, 10, 40))
x = 0
for im in ims:
    sheet.paste(im, (x, 0)); x += im.width + 8
sheet.save(out, quality=85)
