"""Fetch the display fonts the title-logo renderer uses (OFL / Apache, from the official github.com/google/fonts repo).

python scripts/art/get_fonts.py      -> scripts/art/fonts/<File>.ttf  (skips files already there; needs `pip install fonttools`)
These fonts are only used to render title images; they never ship with the site.
"""
import os
import sys
import urllib.request

ROOT = "https://raw.githubusercontent.com/google/fonts/main/"
OUT = os.path.join(os.path.dirname(__file__), "fonts")
# folder / file name inside the repo (licence folder is tried in order: ofl, apache, ufl)
FONTS = [
    ("luckiestguy", "LuckiestGuy-Regular.ttf"), ("bungee", "Bungee-Regular.ttf"), ("bungeeinline", "BungeeInline-Regular.ttf"),
    ("bungeeshade", "BungeeShade-Regular.ttf"), ("titanone", "TitanOne-Regular.ttf"), ("rubikmonoone", "RubikMonoOne-Regular.ttf"),
    ("bowlbyone", "BowlbyOne-Regular.ttf"), ("chango", "Chango-Regular.ttf"), ("blackopsone", "BlackOpsOne-Regular.ttf"),
    ("russoone", "RussoOne-Regular.ttf"), ("racingsansone", "RacingSansOne-Regular.ttf"), ("audiowide", "Audiowide-Regular.ttf"),
    ("monoton", "Monoton-Regular.ttf"), ("bangers", "Bangers-Regular.ttf"), ("creepster", "Creepster-Regular.ttf"),
    ("sniglet", "Sniglet-ExtraBold.ttf"), ("coiny", "Coiny-Regular.ttf"), ("modak", "Modak-Regular.ttf"),
    ("paytoneone", "PaytoneOne-Regular.ttf"), ("passionone", "PassionOne-Black.ttf"), ("righteous", "Righteous-Regular.ttf"),
    ("pressstart2p", "PressStart2P-Regular.ttf"), ("silkscreen", "Silkscreen-Bold.ttf"), ("shrikhand", "Shrikhand-Regular.ttf"),
    ("sigmarone", "SigmarOne-Regular.ttf"), ("knewave", "Knewave-Regular.ttf"), ("lemon", "Lemon-Regular.ttf"),
    ("ultra", "Ultra-Regular.ttf"), ("alfaslabone", "AlfaSlabOne-Regular.ttf"), ("chewy", "Chewy-Regular.ttf"),
    ("carterone", "CarterOne-Regular.ttf"), ("fascinate", "Fascinate-Regular.ttf"), ("rubikbubbles", "RubikBubbles-Regular.ttf"),
    ("rubikglitch", "RubikGlitch-Regular.ttf"), ("rubikwetpaint", "RubikWetPaint-Regular.ttf"), ("londrinasolid", "LondrinaSolid-Black.ttf"),
    ("permanentmarker", "PermanentMarker-Regular.ttf"), ("michroma", "Michroma-Regular.ttf"), ("bebasneue", "BebasNeue-Regular.ttf"),
    ("anton", "Anton-Regular.ttf"), ("sairastencilone", "SairaStencilOne-Regular.ttf"), ("kavoon", "Kavoon-Regular.ttf"),
    ("spicyrice", "SpicyRice-Regular.ttf"), ("rowdies", "Rowdies-Bold.ttf"), ("bagelfatone", "BagelFatOne-Regular.ttf"),
    ("orbitron", "Orbitron[wght].ttf"), ("unbounded", "Unbounded[wght].ttf"), ("grandstander", "Grandstander[wght].ttf"),
    ("baloo2", "Baloo2[wght].ttf"), ("fredoka", "Fredoka[wdth,wght].ttf"), ("teko", "Teko[wght].ttf"),
    ("gluten", "Gluten[slnt,wght].ttf"), ("lilitaone", "LilitaOne-Regular.ttf"), ("blackhansans", "BlackHanSans-Regular.ttf"),
    ("rubikdirt", "RubikDirt-Regular.ttf"),
]
VARIABLE = [("Orbitron[wght].ttf", {"wght": 900}, "Orbitron-Black.ttf"), ("Unbounded[wght].ttf", {"wght": 900}, "Unbounded-Black.ttf"),
            ("Grandstander[wght].ttf", {"wght": 900}, "Grandstander-Black.ttf"), ("Baloo2[wght].ttf", {"wght": 800}, "Baloo2-ExtraBold.ttf"),
            ("Fredoka[wdth,wght].ttf", {"wght": 700, "wdth": 100}, "Fredoka-Bold.ttf"), ("Teko[wght].ttf", {"wght": 700}, "Teko-Bold.ttf"),
            ("Gluten[slnt,wght].ttf", {"wght": 900, "slnt": 0}, "Gluten-Black.ttf")]


def main():
    os.makedirs(OUT, exist_ok=True)
    ok, bad, total = 0, [], 0
    for folder, name in FONTS:
        dst = os.path.join(OUT, name)
        done = [v[2] for v in VARIABLE if v[0] == name]
        if done and os.path.exists(os.path.join(OUT, done[0])):
            ok += 1; continue
        if os.path.exists(dst):
            ok += 1; total += os.path.getsize(dst); continue
        for lic in ("ofl", "apache", "ufl"):
            url = f"{ROOT}{lic}/{folder}/{urllib.parse.quote(name)}"
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    data = r.read()
                if data[:4] not in (b"\x00\x01\x00\x00", b"OTTO", b"true"):
                    continue
                open(dst, "wb").write(data); ok += 1; total += len(data); break
            except Exception:
                continue
        else:
            bad.append(f"{folder}/{name}")
    print(f"fonts ok {ok}, {total / 1e6:.1f} MB; missing: {bad or 'none'}")
    # bold static cuts of the variable fonts (Blender loads a variable font at its default weight)
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    for src, loc, name in VARIABLE:
        sp, dp = os.path.join(OUT, src), os.path.join(OUT, name)
        if os.path.exists(dp) or not os.path.exists(sp): continue
        instancer.instantiateVariableFont(TTFont(sp), loc).save(dp); os.remove(sp)
        print("instanced", name)


if __name__ == "__main__":
    import urllib.parse  # noqa: F401
    sys.exit(main())
