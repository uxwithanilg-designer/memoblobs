"""Render every game's 3D title logo in Blender, then trim it.

python scripts/art/make_titles.py [slug ...]
  -> scripts/art/out/titles/<slug>.png  (full-res, transparent, trimmed)
  -> public/games/<slug>/title.webp     (1600 px wide max, for the site and the art compositor)
Designs live in scripts/art/title_specs.py.
"""
import json
import os
import subprocess
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
FONTS = os.path.join(HERE, "fonts")
OUT = os.path.join(HERE, "out", "titles")
BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
sys.path.insert(0, HERE)
from title_specs import TITLES  # noqa: E402

_fc = {}


def font(name):
    path = name if os.path.isabs(name) else os.path.join(FONTS, name)
    if not os.path.exists(path): path = os.path.join(WEB, "src", "fonts", name)
    if path not in _fc:
        f = TTFont(path)
        _fc[path] = (f, f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm, kern_table(f))
    return path, _fc[path]


def kern_table(f):
    """pair kerning (glyph, glyph) -> units, from GPOS PairPos (formats 1 and 2) and the old kern table"""
    pairs = {}
    if "kern" in f:
        for t in f["kern"].kernTables:
            for (a, b), v in getattr(t, "kernTable", {}).items(): pairs[(a, b)] = v
    if "GPOS" not in f: return pairs
    gpos = f["GPOS"].table
    if not gpos.LookupList: return pairs
    for lk in gpos.LookupList.Lookup:
        subs = []
        for st in lk.SubTable:
            if lk.LookupType == 9: st = st.ExtSubTable
            if getattr(st, "LookupType", lk.LookupType) == 2 or st.__class__.__name__ == "PairPos": subs.append(st)
        for st in subs:
            if st.Format == 1:
                cov = st.Coverage.glyphs
                for i, ps in enumerate(st.PairSet):
                    for pv in ps.PairValueRecord:
                        v = getattr(pv.Value1, "XAdvance", 0) if pv.Value1 else 0
                        if v and (cov[i], pv.SecondGlyph) not in pairs: pairs[(cov[i], pv.SecondGlyph)] = v
            elif st.Format == 2:
                cov = set(st.Coverage.glyphs)
                c1 = st.ClassDef1.classDefs if st.ClassDef1 else {}
                c2 = st.ClassDef2.classDefs if st.ClassDef2 else {}
                st._k = (cov, c1, c2, st.Class1Record)
                pairs.setdefault("_classes", []).append(st._k)
    return pairs


def kern(kt, a, b):
    if (a, b) in kt: return kt[(a, b)]
    for cov, c1, c2, rec in kt.get("_classes", []):
        if a not in cov: continue
        r = rec[c1.get(a, 0)].Class2Record[c2.get(b, 0)]
        v = getattr(r.Value1, "XAdvance", 0) if r.Value1 else 0
        if v: return v
    return 0


def measure(L):
    path, (f, gs, cmap, upm, kt) = font(L["font"])
    L["font"] = path
    text = L["text"]
    names = [cmap.get(ord(c)) or cmap.get(ord(c.upper())) or ".notdef" for c in text]
    L["adv"] = [f["hmtx"][n][0] / upm for n in names]
    L["kern"] = [kern(kt, names[i], names[i + 1]) / upm for i in range(len(names) - 1)] + [0]
    ys = []
    for n in names:
        bp = BoundsPen(gs); gs[n].draw(bp)
        if bp.bounds: ys.append(bp.bounds)
    L["cap"] = max(b[3] for b in ys) / upm
    L["desc"] = min(b[1] for b in ys) / upm
    hb = BoundsPen(gs); gs[cmap[ord("H")]].draw(hb)
    L["hH"] = (hb.bounds[3] - hb.bounds[1]) / upm
    return L


def add_glow(im, glow):
    from PIL import ImageFilter
    col, rad, strength = glow
    pad = rad * 3
    big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.paste(im, (pad, pad), im)
    a = big.getchannel("A").filter(ImageFilter.GaussianBlur(rad)).point(lambda v: min(255, int(v * strength * 2.2)))
    c = tuple(int(col.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    halo = Image.new("RGBA", big.size, c + (0,)); halo.putalpha(a)
    return Image.alpha_composite(halo, big)


def add_outline(im, rings):
    """2D outline rings behind the type (for fonts whose overlapping contours spike when bevelled in 3D)"""
    from PIL import ImageFilter
    pad = sum(px for _, px in rings) + 8
    big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0)); big.paste(im, (pad, pad), im)
    a = big.getchannel("A").point(lambda v: 255 if v > 60 else 0)
    out = Image.new("RGBA", big.size, (0, 0, 0, 0)); grow = 0
    layers = []
    for col, px in rings:
        grow += px
        m = a
        k = grow
        while k > 0:
            s = min(k, 10); m = m.filter(ImageFilter.MaxFilter(s * 2 + 1)); k -= s
        c = tuple(int(col.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        layer = Image.new("RGBA", big.size, c + (255,)); layer.putalpha(m.filter(ImageFilter.GaussianBlur(1)))
        layers.append(layer)
    for layer in reversed(layers): out = Image.alpha_composite(out, layer)
    return Image.alpha_composite(out, big)


def trim(src, dst_png, dst_webp, glow=None, outline=None):
    im = Image.open(src).convert("RGBA")
    if outline: im = add_outline(im, outline)
    if glow: im = add_glow(im, glow)
    bb = im.getchannel("A").point(lambda a: 255 if a > 6 else 0).getbbox()
    if not bb: return "EMPTY RENDER"
    pad = 12
    im = im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))
    im.save(dst_png)
    w = min(1600, im.width)
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(dst_webp, "WEBP", quality=90, method=6)
    return im.size


def main():
    fast = "--fast" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    os.makedirs(OUT, exist_ok=True)
    jobs = []
    for slug, spec in TITLES.items():
        if only and slug not in only: continue
        job = json.loads(json.dumps(spec))
        job["slug"] = slug
        for L in job["lines"]: measure(L)
        job["out"] = os.path.join(OUT, f"_raw_{slug}.png")
        if fast: job["res"] = 1200; job["samples"] = 12
        jobs.append(job)
    jf = os.path.join(OUT, "_jobs.json")
    json.dump(jobs, open(jf, "w", encoding="utf8"))

    # one Blender process per title (Eevee renders come out blank after the first render in a reused process)
    def one(job):
        slug = job["slug"]
        log = open(os.path.join(OUT, f"_log_{slug}.txt"), "w", encoding="utf8")
        subprocess.run([BLENDER, "-b", "--factory-startup", "--python", os.path.join(HERE, "title3d.py"), "--", jf, slug], stdout=log, stderr=subprocess.STDOUT)
        log.close()
        d = os.path.join(WEB, "public", "games", slug)
        return slug, trim(os.path.join(OUT, f"_raw_{slug}.png"), os.path.join(OUT, f"{slug}.png"), os.path.join(d, "title.webp"), job.get("glow"), job.get("outline"))

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(int(os.environ.get("TITLE_JOBS", "2"))) as ex:
        for slug, r in ex.map(one, jobs): print("TITLE", slug, r, flush=True)


if __name__ == "__main__":
    main()
