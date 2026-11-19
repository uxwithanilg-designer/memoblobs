"""Game facts for the art compositor, read from the catalogue sources (title, short, tagline, colours, host, category)."""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
STR = r'"((?:[^"\\]|\\.)*)"'


def _field(block, name):
    m = re.search(name + r":\s*" + STR, block)
    return m.group(1).replace('\\"', '"') if m else None


def games():
    out = {}
    src = open(os.path.join(WEB, "src", "lib", "games.ts"), encoding="utf8").read()
    for blk in re.split(r"\n  \{\n", src)[1:]:
        slug = _field(blk, "slug")
        if slug:
            out[slug] = dict(slug=slug, title=_field(blk, "title"), short=_field(blk, "short"), tagline=_field(blk, "tagline"),
                             accent=_field(blk, "accent"), accent2=_field(blk, "accent2"), category=_field(blk, "category"), host=None, arcade=False)
    src = open(os.path.join(WEB, "src", "lib", "arcade-catalog.ts"), encoding="utf8").read()
    for blk in re.split(r"\n  A\(\{", src)[1:]:
        slug = _field(blk, "slug")
        if slug:
            out[slug] = dict(slug=slug, title=_field(blk, "title"), short=_field(blk, "short"), tagline=_field(blk, "tagline"),
                             accent=_field(blk, "accent"), accent2=_field(blk, "accent2"), category=_field(blk, "category"), host=_field(blk, "host"), arcade=True)
    return out


if __name__ == "__main__":
    g = games()
    print(len(g))
    for v in g.values(): print(v["slug"], "|", v["short"], "|", v["accent"], v["accent2"], v["host"])
    print("missing:", [k for k, v in g.items() if not v["accent"] or not v["short"]])
