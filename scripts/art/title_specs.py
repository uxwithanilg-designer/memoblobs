"""3D title-logo designs, one per game (rendered by make_titles.py -> title3d.py in Blender).

Every game has its own typeface and its own look. Line keys: text, font, size, track, shear (italic), arc (+ arches up),
bounce (random tilt/hop), wave, depth (extrude), bevel, bres, offset (grow the outline), dx/dy, rot, grad_scope,
mat / mats (cycled per letter): {type: gloss|chrome|gold|clay|jelly|matte|neon|holo|carpaint, grad [[pos, hex]], color,
side (extrusion colour), rough, metal, coat, emit, emit_str, tex: wood|stone|noise|stripes|checker, tex_col, tex_scale, bump},
plates: outline slabs behind the letters [{grow, depth, drop, back, mat}].
Job keys: lines, ornaments [{type: star|sparkle|sphere|ring|bar|leaf|drop|crown|cube, u, v, s, rot, rx, ry, z, sx, sy, mat}],
cam {tilt, yaw, lens, margin}, world {env: studio|city|forest|courtyard|interior|night|sunrise|sunset|horizon, env_str},
lights {key, fill, rim, *_col}, exposure, glow [hex, radius px, strength] (post), seed.
"""

NAVY = "#1b1550"
INK = "#120a2a"
WHITE = "#ffffff"
# painted chrome: sky, bright band, hard horizon, warm ground
CHROME = [[0, "#3f6fd8"], [0.38, "#e9f3ff"], [0.5, "#ffffff"], [0.52, "#2a2238"], [0.6, "#7a4a2a"], [0.82, "#e0a868"], [1, "#fff0d0"]]
STEEL = [[0, "#ffffff"], [0.45, "#c9d3e6"], [0.5, "#6d7896"], [0.62, "#aab6cf"], [1, "#eef3ff"]]
GOLD = [[0, "#fff6c2"], [0.35, "#ffd35a"], [0.55, "#e09a1a"], [0.7, "#ffe08a"], [1, "#b8700c"]]


def P(color, grow=0.05, depth=0.18, drop=0.0, kind="gloss", **k):
    return dict(grow=grow, depth=depth, drop=drop, mat=dict(type=kind, color=color, **k))


def G(top, bottom, side=None, kind="gloss", mid=None, **k):
    g = [[0, top], [0.5, mid], [1, bottom]] if mid else [[0, top], [1, bottom]]
    return dict(type=kind, grad=g, side=side, **k)


def L(text, font, size=1.0, mat=None, plates=(), **k):
    return dict(text=text, font=font, size=size, mat=mat or G(WHITE, "#dddddd"), plates=list(plates), **k)


def O(type, u, v, s=0.15, mat=None, **k):
    return dict(type=type, u=u, v=v, s=s, mat=mat or dict(type="gloss", color="#ffd25a"), **k)


SPARK = dict(type="gloss", color="#fff6c8", emit="#fff1a0", emit_str=2.5)
JELLY = [G("#ff9ad5", "#ff2e93", "#c2116a", "jelly"), G("#c6ff6b", "#4fd61f", "#2f9a0c", "jelly"), G("#8fe8ff", "#1fa8ff", "#0b6fc2", "jelly"),
         G("#ffe58a", "#ffb21f", "#c47a08", "jelly"), G("#d9a8ff", "#9a4dff", "#6a1fd0", "jelly")]
CLAY = [G("#ffab6b", "#e0622a", "#a8441a", "clay"), G("#9be07a", "#4fae3a", "#2f7a22", "clay"), G("#ffd86b", "#f0a52a", "#b8741a", "clay"), G("#7fc8ff", "#3a8ae0", "#22599e", "clay")]

TITLES = {
    # ------------------------------------------------------------------ 3D games
    "rollo-rush": dict(
        lines=[L("ROLLO", "LuckiestGuy-Regular.ttf", 0.6, G(WHITE, "#ffe2a0", "#d0731b"), [P(NAVY, 0.055, 0.22), P(WHITE, 0.1, 0.1, kind="matte")], shear=0.14, track=0.03),
               L("RUSH", "LuckiestGuy-Regular.ttf", 1.3, G("#fff25a", "#ff4a1c", "#a83208", mid="#ffa21f"), [P(NAVY, 0.055, 0.22), P(WHITE, 0.1, 0.1, kind="matte")], shear=0.14, track=0.01)],
        ornaments=[O("bar", -0.06, 0.6, 0.06, dict(type="gloss", color=WHITE), len=8, z=0), O("bar", -0.1, 0.74, 0.045, dict(type="gloss", color="#ffd25a"), len=5, z=0),
                   O("sparkle", 0.97, 0.1, 0.14, SPARK, rot=12)],
        cam=dict(tilt=10, yaw=-10, lens=55), world=dict(env="studio"), lights=dict(fill=250)),
    "momo-jelly-jam": dict(
        lines=[L("MOMO", "BagelFatOne-Regular.ttf", 0.55, G(WHITE, "#ffe3f1", "#ffb3d6"), [P("#5b1a6e", 0.06, 0.16)], track=0.02),
               L("JELLY", "BagelFatOne-Regular.ttf", 1.0, None, [P("#5b1a6e", 0.06, 0.18)], mats=JELLY, bounce=1.0, track=0.01, depth=0.16, bevel=0.035),
               L("JAM!", "BagelFatOne-Regular.ttf", 1.15, None, [P("#5b1a6e", 0.06, 0.18)], mats=JELLY[3:] + JELLY[:3], bounce=1.0, depth=0.16, bevel=0.035)],
        cam=dict(tilt=6, yaw=6, lens=60), world=dict(env="interior", env_str=0.8), seed=3),
    "nitro-rush": dict(
        lines=[L("NITRO", "RussoOne-Regular.ttf", 1.0, dict(type="chrome", grad=CHROME, side="#5a6688"), [P("#d01818", 0.05, 0.16, kind="carpaint"), P("#0b0b16", 0.085, 0.1)], shear=0.22, track=0.02, depth=0.1, bevel=0.018),
               L("RUSH", "RussoOne-Regular.ttf", 0.62, G("#ffdf3a", "#ff7a00", "#a84400"), [P("#0b0b16", 0.05, 0.14)], shear=0.22, track=0.32, dx=0.08)],
        ornaments=[O("bar", -0.06, 0.35, 0.045, dict(type="gloss", color="#ff2d2d"), len=6, z=0), O("bar", -0.1, 0.5, 0.035, dict(type="gloss", color=WHITE), len=4, z=0)],
        cam=dict(tilt=12, yaw=-14, lens=50), world=dict(env="horizon")),
    "puddo-clayland": dict(
        lines=[L("PUDDO'S", "Sniglet-ExtraBold.ttf", 0.5, G(WHITE, "#f3e3c8", "#cdb48f", "clay"), [], track=0.04, bounce=0.4, bevel=0.0, depth=0.1),
               L("CLAYLAND", "Sniglet-ExtraBold.ttf", 1.0, None, [], mats=CLAY, bounce=0.7, wave=0.05, depth=0.18, bevel=0.0)],
        outline=[["#5a2a12", 14], ["#fff4e0", 9]],
        ornaments=[O("drop", 0.97, 0.02, 0.13, dict(type="jelly", color="#4fb8ff"), rot=-12), O("leaf", 0.2, 0.0, 0.16, dict(type="clay", color="#4fae3a"), rot=28)],
        cam=dict(tilt=8, yaw=8, lens=60), world=dict(env="forest"), seed=11),
    "kiko-jungle-quest": dict(
        lines=[L("KIKO'S", "Kavoon-Regular.ttf", 0.5, G("#fff4c8", "#ffd060", "#a06a1a"), [P("#1f5a1a", 0.06, 0.16)], track=0.03),
               L("JUNGLE", "Kavoon-Regular.ttf", 1.0, dict(type="gloss", grad=[[0, "#ffd36a"], [1, "#d98a1f"]], side="#6a3a10", tex="wood", tex_col="#a8601a", tex_scale=2.2, rough=0.4), [P("#1f5a1a", 0.06, 0.2), P("#a4e04a", 0.1, 0.1)], arc=0.35),
               L("QUEST", "Kavoon-Regular.ttf", 0.78, G("#c8ff6a", "#46b81f", "#1f6a12"), [P("#1f5a1a", 0.06, 0.18), P("#ffd25a", 0.1, 0.1)], track=0.04)],
        ornaments=[O("leaf", 0.02, 0.2, 0.2, dict(type="gloss", grad=[[0, "#8fe06a"], [1, "#2f8a1f"]]), rot=40), O("leaf", 0.98, 0.15, 0.2, dict(type="gloss", grad=[[0, "#8fe06a"], [1, "#2f8a1f"]]), rot=150),
                   O("leaf", 0.9, 0.95, 0.14, dict(type="gloss", color="#4fae3a"), rot=-160)],
        cam=dict(tilt=9, yaw=-6, lens=60), world=dict(env="forest", env_str=0.7)),
    "momo-escape": dict(
        lines=[L("MOMO", "BlackOpsOne-Regular.ttf", 0.55, dict(type="neon", color="#5ff8ff", emit_str=2.2), [P("#0a1020", 0.05, 0.12)], track=0.2),
               L("ESCAPE", "BlackOpsOne-Regular.ttf", 1.0, dict(type="gloss", color="#ffd21f", side="#7a5a00", tex="stripes", tex_col="#1a1a1a", tex_scale=4), [P("#141822", 0.05, 0.2, kind="gloss", metal=0.7), P("#ff2b5c", 0.085, 0.08, kind="neon", emit_str=2)], shear=0.08)],
        ornaments=[O("bar", 0.5, 1.08, 0.025, dict(type="neon", color="#ff2b5c", emit_str=4), len=40, z=0.2)],
        cam=dict(tilt=14, yaw=10, lens=50), world=dict(env="night", env_str=0.6), glow=["#ff2b5c", 26, 0.35]),
    "momo-dash": dict(
        lines=[L("MOMO", "Knewave-Regular.ttf", 0.6, G(WHITE, "#d8f6ff", "#5a8aa0"), [], shear=0.1, rot=-4, bevel=0.0, depth=0.1),
               L("DASH!", "Knewave-Regular.ttf", 1.25, G("#fff04a", "#ffb000", "#b85a00", mid="#ffd21f"), [P(INK, 0.055, 0.2), P("#ff3d8a", 0.1, 0.1)], shear=0.12, rot=-4, track=0.02)],
        ornaments=[O("bar", 1.04, 0.66, 0.05, dict(type="gloss", color="#ff3d8a"), len=6), O("bar", 1.07, 0.8, 0.04, dict(type="gloss", color="#38d1ff"), len=4),
                   O("star", 0.02, 0.05, 0.12, dict(type="gloss", color="#38d1ff"), rot=-15)],
        cam=dict(tilt=8, yaw=12, lens=55), world=dict(env="city", env_str=0.6), outline=[[INK, 6]]),
    "blob-brigade": dict(
        lines=[L("BLOB", "TitanOne-Regular.ttf", 0.75, G("#8fd0ff", "#1f6fe0", "#0b3a8a"), [P("#0d1a3a", 0.06, 0.18), P("#ffd21f", 0.1, 0.08)], arc=0.25, track=0.04),
               L("BRIGADE", "TitanOne-Regular.ttf", 1.0, G("#fff07a", "#ffb000", "#a85a00"), [P("#0d1a3a", 0.06, 0.2), P(WHITE, 0.1, 0.08, kind="matte")], arc=0.25)],
        ornaments=[O("star", 0.05, 0.12, 0.17, dict(type="gold", grad=GOLD), rot=-14), O("star", 0.95, 0.12, 0.17, dict(type="gold", grad=GOLD), rot=14),
                   O("star", 0.5, -0.12, 0.12, dict(type="gold", grad=GOLD))],
        cam=dict(tilt=10, yaw=0, lens=55), world=dict(env="studio")),
    "sky-roll": dict(
        lines=[L("MOMO", "Unbounded-Black.ttf", 0.42, G(WHITE, "#ffe1f4", "#c48ad8"), [P("#3a1a6a", 0.05, 0.12)], track=0.3),
               L("SKY ROLL", "Unbounded-Black.ttf", 1.0, dict(type="holo", grad=[[0, "#ffffff"], [0.5, "#d8f0ff"], [1, "#ffe0f4"]], side="#b08ae8", film=560, coat=1.0), [P("#3a1a6a", 0.05, 0.18), P("#ff9ad5", 0.09, 0.08)], arc=0.2, track=0.02)],
        ornaments=[O("sparkle", 0.03, 0.05, 0.13, SPARK, rot=10), O("sparkle", 0.96, 0.85, 0.1, SPARK, rot=-8), O("sphere", 0.92, 0.0, 0.09, dict(type="holo", color="#ffd6f0", film=480))],
        cam=dict(tilt=7, yaw=-6, lens=60), world=dict(env="sunrise", env_str=0.9)),
    "momo-boing": dict(
        lines=[L("MOMO", "Modak-Regular.ttf", 0.6, G(WHITE, "#fff3b0", "#d8a020"), [P("#4a1250", 0.06, 0.14)], bounce=0.5),
               L("BOING!", "Modak-Regular.ttf", 1.2, None, [P("#4a1250", 0.06, 0.18)], mats=[G("#ff8ad8", "#ff2fa8", "#b0107a"), G("#8af0ff", "#24b8ff", "#0b6fc2"), G("#c8ff7a", "#5fd01f", "#2f8a10"), G("#ffe07a", "#ffa21f", "#b8600a")],
                 bounce=0.25, wave=0.03, track=0.05, depth=0.18, bevel=0.045)],
        ornaments=[O("ring", 0.98, 0.05, 0.09, dict(type="gloss", color="#ffd25a"), thick=0.3, rx=60)],
        cam=dict(tilt=5, yaw=-8, lens=60), world=dict(env="interior", env_str=0.8), seed=5),
    "drift-kings": dict(
        lines=[L("DRIFT", "Teko-Bold.ttf", 1.15, G("#ffffff", "#ffb8f0", "#9a1fd0", mid="#ffe0fa"), [P("#ff2fb8", 0.04, 0.14, kind="neon", emit_str=1.5), P("#12062a", 0.075, 0.12)], shear=0.25, track=0.04),
               L("KINGS", "Teko-Bold.ttf", 0.8, dict(type="gold", grad=GOLD, side="#8a5000"), [P("#12062a", 0.05, 0.14)], shear=0.25, track=0.22, dx=0.06)],
        ornaments=[O("crown", 0.86, -0.05, 0.16, dict(type="gold", grad=GOLD), rot=14)],
        cam=dict(tilt=12, yaw=-12, lens=50), world=dict(env="studio", env_str=0.9), glow=["#ff2fb8", 22, 0.3]),
    "highway-heat": dict(
        lines=[L("HIGHWAY", "Anton-Regular.ttf", 0.7, G(WHITE, "#cfe0ff", "#3a4a8a"), [P("#0a0e1e", 0.03, 0.12)], shear=0.18, track=0.08, bevel=0.01),
               L("HEAT", "Anton-Regular.ttf", 1.35, G("#fff27a", "#ff2a12", "#7a0a0a", mid="#ff8a12"), [P("#0a0e1e", 0.05, 0.2), P("#ff2a2a", 0.09, 0.1)], shear=0.18, track=0.06)],
        ornaments=[O("bar", 0.12, 1.06, 0.035, dict(type="neon", color="#ff2a2a", emit_str=4), len=10), O("bar", 0.88, 1.06, 0.035, dict(type="neon", color="#2f6bff", emit_str=4), len=10)],
        cam=dict(tilt=12, yaw=12, lens=50), world=dict(env="city", env_str=0.7), glow=["#ff5a2a", 20, 0.25]),
    "moto-rush": dict(
        lines=[L("MOTO RUSH", "Orbitron-Black.ttf", 1.0, G("#fff35a", "#ffb800", "#7a5200"), [P("#111111", 0.05, 0.16), P(WHITE, 0.085, 0.08, kind="matte")], shear=0.2, track=0.02),
               L("GP", "Orbitron-Black.ttf", 1.0, G(WHITE, "#e8e8e8", "#666666"), [P("#e8141e", 0.07, 0.16, kind="carpaint"), P("#111111", 0.11, 0.1)], shear=0.2, track=0.2)],
        cam=dict(tilt=10, yaw=-10, lens=50), world=dict(env="studio")),
    "slurp-lab": dict(
        lines=[L("SLURP", "Righteous-Regular.ttf", 1.0, dict(type="neon", grad=[[0, "#eaffb0"], [1, "#7aff3a"]], side="#2f8a10", emit_str=0.8), [P("#2a0e5a", 0.06, 0.2), P("#c88aff", 0.1, 0.08, kind="neon", emit_str=1)], track=0.02),
               L("LAB", "Righteous-Regular.ttf", 0.85, G("#e6c8ff", "#8a3aff", "#4a1aa0"), [P("#2a0e5a", 0.06, 0.18), P("#7aff3a", 0.1, 0.08, kind="neon", emit_str=1)], track=0.35)],
        ornaments=[O("sphere", 0.02, 0.1, 0.08, dict(type="jelly", color="#7aff3a")), O("sphere", 0.97, 0.75, 0.06, dict(type="jelly", color="#c88aff")), O("sphere", 0.92, 0.95, 0.04, dict(type="jelly", color="#7aff3a"))],
        cam=dict(tilt=6, yaw=8, lens=60), world=dict(env="interior", env_str=0.6), glow=["#7aff3a", 24, 0.3]),
    "tondu-vine-climb": dict(
        lines=[L("TONDU'S", "Gluten-Black.ttf", 0.5, G("#fff0c0", "#e0b860", "#8a6420"), [P("#123a12", 0.06, 0.14)], track=0.04),
               L("VINE", "Gluten-Black.ttf", 1.05, G("#d8ff8a", "#3fae2a", "#1a5a12"), [P("#123a12", 0.06, 0.2), P("#e8ff9a", 0.1, 0.08)], wave=0.05, bounce=0.4),
               L("CLIMB", "Gluten-Black.ttf", 0.85, G("#b8f05a", "#1f8a3a", "#0f4a1a"), [P("#123a12", 0.06, 0.2), P("#e8ff9a", 0.1, 0.08)], wave=0.05, bounce=0.4, track=0.03)],
        ornaments=[O("leaf", 0.0, 0.45, 0.2, dict(type="gloss", grad=[[0, "#b8f05a"], [1, "#2f8a1f"]]), rot=60), O("leaf", 1.0, 0.25, 0.18, dict(type="gloss", grad=[[0, "#b8f05a"], [1, "#2f8a1f"]]), rot=130),
                   O("leaf", 0.95, 1.0, 0.14, dict(type="gloss", color="#3fae2a"), rot=-140), O("sphere", 0.1, 0.95, 0.05, dict(type="jelly", color="#ff5a3a"))],
        cam=dict(tilt=7, yaw=8, lens=60), world=dict(env="forest", env_str=0.8), seed=9),
    "momo-shuffle": dict(
        lines=[L("MOMO", "Shrikhand-Regular.ttf", 0.6, G(WHITE, "#ffe8e0", "#c08a7a"), [P("#5a0a1a", 0.06, 0.16)], rot=-4),
               L("SHUFFLE", "Shrikhand-Regular.ttf", 1.0, dict(type="gold", grad=GOLD, side="#7a4400"), [P("#8a0a1e", 0.06, 0.2, kind="carpaint"), P("#ffd25a", 0.1, 0.08, kind="gold")], rot=-4)],
        ornaments=[O("sphere", x / 8, 1.08, 0.035, dict(type="neon", color="#fff2b0", emit_str=5)) for x in range(9)] + [O("sphere", x / 8, -0.1, 0.035, dict(type="neon", color="#fff2b0", emit_str=5)) for x in range(9)],
        cam=dict(tilt=6, yaw=0, lens=60), world=dict(env="interior", env_str=0.7), glow=["#ffd25a", 18, 0.25]),
    # ------------------------------------------------------------------ arcade: focus
    "fish-watch": dict(
        lines=[L("FISH", "Coiny-Regular.ttf", 1.0, G("#b8f6ff", "#1f9ae0", "#0b4a8a", "jelly"), [P("#0a2a5a", 0.06, 0.18), P("#ffe24a", 0.1, 0.08)], wave=0.06),
               L("WATCH", "Coiny-Regular.ttf", 0.75, G(WHITE, "#d6f4ff", "#5a9ac0"), [P("#0a2a5a", 0.06, 0.16)], wave=0.05, wave_phase=1.5, track=0.04)],
        ornaments=[O("sphere", 0.95, 0.05, 0.07, dict(type="jelly", color="#bff0ff", glow=0.05)), O("sphere", 1.0, 0.25, 0.045, dict(type="jelly", color="#bff0ff", glow=0.05)), O("sphere", 0.02, 0.85, 0.05, dict(type="jelly", color="#bff0ff", glow=0.05))],
        cam=dict(tilt=6, yaw=6, lens=60), world=dict(env="courtyard", env_str=0.8)),
    "spot-the-sneak": dict(
        lines=[L("SPOT THE", "RubikWetPaint-Regular.ttf", 0.5, G(WHITE, "#e8ffd0", "#7ab04a"), [], track=0.06, bevel=0.0, depth=0.08),
               L("SNEAK", "RubikWetPaint-Regular.ttf", 1.0, G("#e0ff6a", "#3fd01f", "#1a7a0a", "jelly"), [], bevel=0.0, depth=0.12)],
        outline=[["#2a0a4a", 14], ["#c86aff", 10]],
        cam=dict(tilt=8, yaw=-8, lens=55), world=dict(env="forest", env_str=0.7)),
    "color-clash": dict(
        lines=[L("COLOR", "RubikMonoOne-Regular.ttf", 0.9, None, [P("#141414", 0.05, 0.16)], mats=[dict(type="gloss", color=c, side="#222244") for c in ("#ff3a3a", "#2f7bff", "#ffd21f", "#2fc84a", "#b04aff")], bounce=0.4),
               L("CLASH", "RubikMonoOne-Regular.ttf", 0.9, None, [P("#141414", 0.05, 0.16)], mats=[dict(type="gloss", color=c, side="#222244") for c in ("#2fc84a", "#ffd21f", "#b04aff", "#ff3a3a", "#2f7bff")], bounce=0.4)],
        cam=dict(tilt=8, yaw=10, lens=60), world=dict(env="studio"), seed=21),
    "blink-change": dict(
        lines=[L("BLINK!", "PaytoneOne-Regular.ttf", 1.0, G("#fff2d8", "#ffa64a", "#a8520a"), [P("#3a1a0a", 0.06, 0.2), P("#ffe0a0", 0.1, 0.08)], track=0.02)],
        ornaments=[O("sphere", 0.5, -0.32, 0.16, dict(type="gloss", color=WHITE), sz=0.5), O("sphere", 0.5, -0.32, 0.075, dict(type="gloss", color="#1a1030"), z=0.9),
                   O("sparkle", 0.05, -0.2, 0.1, SPARK), O("sparkle", 0.95, -0.25, 0.08, SPARK)],
        cam=dict(tilt=8, yaw=-6, lens=60), world=dict(env="sunset", env_str=0.7)),
    "where-is-zib": dict(
        lines=[L("WHERE'S", "Audiowide-Regular.ttf", 0.55, G(WHITE, "#e8d8ff", "#7a5ab0"), [P("#1a0a3a", 0.05, 0.14)], track=0.06),
               L("ZIB?", "Audiowide-Regular.ttf", 1.3, G("#f0e0ff", "#7a2aff", "#3a0a90", mid="#b88aff"), [P("#1a0a3a", 0.05, 0.2), P("#b7ff5a", 0.09, 0.08, kind="neon", emit_str=1.2)], track=0.04)],
        ornaments=[O("ring", 0.93, 0.02, 0.12, dict(type="chrome", grad=STEEL), thick=0.22, rx=70), O("sphere", 0.93, 0.02, 0.07, dict(type="jelly", color="#b7ff5a"))],
        cam=dict(tilt=10, yaw=8, lens=55), world=dict(env="night", env_str=0.9), glow=["#b7ff5a", 18, 0.22]),
    "shadow-match": dict(
        lines=[L("SHADOW", "BebasNeue-Regular.ttf", 1.0, G("#3a3a4a", "#0a0a12", "#000000", rough=0.2), [P("#f4f0e8", 0.04, 0.12, kind="matte"), P("#000000", 0.04, 0.3, drop=0.12)], track=0.06),
               L("SNAP", "BebasNeue-Regular.ttf", 0.8, G("#fff07a", "#ffb81f", "#8a5a00"), [P("#000000", 0.05, 0.16, drop=0.1)], track=0.35)],
        cam=dict(tilt=6, yaw=-14, lens=55), world=dict(env="studio", env_str=0.4), lights=dict(key=1800, fill=120, rim=2400, rim_col="#ffd28a")),
    "gloop-guard": dict(
        lines=[L("GLOOP", "Monoton-Regular.ttf", 1.0, dict(type="neon", color="#5aff7a", emit_str=6), [P("#0d0a1e", 0.08, 0.06, kind="matte")], depth=0.03, bevel=0.012),
               L("GUARD", "Monoton-Regular.ttf", 1.0, dict(type="neon", color="#ff4a5a", emit_str=6), [P("#0d0a1e", 0.08, 0.06, kind="matte")], depth=0.03, bevel=0.012)],
        cam=dict(tilt=4, yaw=-6, lens=60), world=dict(env="night", env_str=0.4), glow=["#9affb0", 30, 0.55]),
    # ------------------------------------------------------------------ arcade: memory
    "memory-bridge": dict(
        lines=[L("MEMORY", "LondrinaSolid-Black.ttf", 0.8, dict(type="gloss", grad=[[0, "#ffffff"], [1, "#bfe8e0"]], side="#3a7a70", tex="stone", tex_col="#d8ece8", tex_scale=4, rough=0.45, bump=0.12), [P("#0a3a3a", 0.05, 0.16), P("#7fe0d0", 0.09, 0.07)], track=0.05),
               L("BRIDGE", "LondrinaSolid-Black.ttf", 1.0, dict(type="gloss", grad=[[0, "#b8fff0"], [1, "#2fb8a0"]], side="#145a50", tex="stone", tex_col="#7fe0c8", tex_scale=4, rough=0.4, bump=0.12), [P("#0a3a3a", 0.05, 0.2), P("#7fe0d0", 0.09, 0.08)], arc=-0.18)],
        ornaments=[O("drop", 0.04, 0.2, 0.08, dict(type="jelly", color="#5ad8ff")), O("leaf", 0.97, 0.15, 0.12, dict(type="gloss", color="#4fae3a"), rot=130)],
        cam=dict(tilt=9, yaw=-6, lens=60), world=dict(env="courtyard")),
    "pips-pantry": dict(
        lines=[L("PIP'S", "Fredoka-Bold.ttf", 0.6, G(WHITE, "#dfe6ff", "#6a7ab0"), [P("#1e2a5a", 0.06, 0.14)], rot=-3),
               L("PANTRY", "Fredoka-Bold.ttf", 1.0, dict(type="gloss", grad=[[0, "#ffe2a8"], [1, "#e8a050"]], side="#8a5020", tex="noise", tex_col="#a0602a", tex_scale=9, rough=0.5), [P("#1e2a5a", 0.06, 0.2), P("#ff6a6a", 0.1, 0.08)], rot=-3)],
        ornaments=[O("sphere", 0.98, 0.1, 0.07, dict(type="gloss", color="#ff4a4a")), O("star", 0.02, 0.9, 0.08, dict(type="gloss", color="#ffd25a"))],
        cam=dict(tilt=7, yaw=7, lens=60), world=dict(env="interior", env_str=0.7)),
    "bolt-beeps": dict(
        lines=[L("BOLT'S", "PressStart2P-Regular.ttf", 0.5, G(WHITE, "#d8f0ee", "#4a6a68"), [P("#0a2a2a", 0.05, 0.12)], track=0.04),
               L("BEEP", "PressStart2P-Regular.ttf", 1.0, dict(type="neon", color="#3affd8", emit_str=1.4, side="#0a6a5a"), [P("#1a2a3a", 0.05, 0.18, kind="gloss", metal=0.6), P("#ffd21f", 0.09, 0.08)], depth=0.16, bevel=0.008, bres=1),
               L("BOOP", "PressStart2P-Regular.ttf", 1.0, dict(type="neon", color="#ffd21f", emit_str=1.2, side="#8a6a00"), [P("#1a2a3a", 0.05, 0.18, kind="gloss", metal=0.6), P("#3affd8", 0.09, 0.08)], depth=0.16, bevel=0.008, bres=1)],
        cam=dict(tilt=12, yaw=-14, lens=50), world=dict(env="city", env_str=0.6), glow=["#3affd8", 18, 0.25]),
    "order-up": dict(
        lines=[L("ORDER", "Lemon-Regular.ttf", 0.8, G("#ffc2d8", "#ff4a86", "#b0104a"), [P(WHITE, 0.05, 0.14, kind="matte"), P("#1a1a2a", 0.09, 0.1)], rot=-5),
               L("UP!", "Lemon-Regular.ttf", 1.15, dict(type="chrome", grad=CHROME, side="#5a6688"), [P("#5ae0c8", 0.05, 0.16), P("#1a1a2a", 0.09, 0.1)], rot=-5, track=0.04)],
        ornaments=[O("star", 0.92, 0.55, 0.13, dict(type="gloss", color="#ffd25a"), rot=10), O("sparkle", 0.05, 0.75, 0.1, SPARK)],
        cam=dict(tilt=8, yaw=10, lens=55), world=dict(env="studio", env_str=0.8)),
    "grid-glow": dict(
        lines=[L("GLOW", "SairaStencilOne-Regular.ttf", 1.0, dict(type="neon", color="#7cf2c9", emit_str=3), [P("#140a2a", 0.06, 0.16, kind="gloss"), P("#7cf2c9", 0.1, 0.05, kind="neon", emit_str=1.2)], bres=1, bevel=0.006),
               L("GRID", "SairaStencilOne-Regular.ttf", 1.0, dict(type="neon", color="#ffd25a", emit_str=2.5), [P("#140a2a", 0.06, 0.16, kind="gloss"), P("#ffd25a", 0.1, 0.05, kind="neon", emit_str=1.2)], bres=1, bevel=0.006)],
        ornaments=[O("cube", 0.0, 0.0, 0.06, dict(type="neon", color="#7cf2c9", emit_str=2)), O("cube", 1.0, 1.0, 0.06, dict(type="neon", color="#ffd25a", emit_str=2))],
        cam=dict(tilt=10, yaw=12, lens=55), world=dict(env="night", env_str=0.5), glow=["#7cf2c9", 24, 0.45]),
    "who-said-it": dict(
        lines=[L("WHO SAID", "SigmarOne-Regular.ttf", 0.75, G(WHITE, "#f0e0ff", "#8a5ab0"), [P("#2a0a4a", 0.06, 0.16), P("#ff8a3d", 0.1, 0.07)], bounce=0.3),
               L("IT?", "SigmarOne-Regular.ttf", 1.2, G("#d8a8ff", "#8a2aff", "#4a0aa0"), [P("#2a0a4a", 0.06, 0.2), P("#ff8a3d", 0.1, 0.08)], bounce=0.5)],
        ornaments=[O("sphere", 0.88, 0.9, 0.09, dict(type="gloss", color=WHITE), sx=1.4), O("sphere", 0.12, 0.9, 0.06, dict(type="gloss", color="#ff8a3d"), sx=1.4)],
        cam=dict(tilt=7, yaw=-8, lens=60), world=dict(env="interior", env_str=0.7), seed=4),
    "whats-missing": dict(
        lines=[L("WHAT'S", "PassionOne-Black.ttf", 0.7, G(WHITE, "#ffe0d8", "#b05a4a"), [P("#3a0a0a", 0.05, 0.14)], track=0.05),
               L("MISSING?", "PassionOne-Black.ttf", 1.0, G("#ffe25a", "#ff5a2a", "#8a1a0a", mid="#ffa63a"), [P("#3a0a0a", 0.05, 0.2), P("#ffd25a", 0.09, 0.08)], track=0.02)],
        ornaments=[O("ring", 0.94, 0.0, 0.11, dict(type="chrome", grad=STEEL), thick=0.18), O("bar", 0.99, 0.2, 0.03, dict(type="gloss", color="#5a2a0a"), len=3.2, rot=-50)],
        cam=dict(tilt=8, yaw=8, lens=55), world=dict(env="studio")),
    # ------------------------------------------------------------------ arcade: brain
    "pick-the-door": dict(
        lines=[L("PICK THE", "AlfaSlabOne-Regular.ttf", 0.5, G(WHITE, "#ffe8e0", "#a0504a"), [P("#c81e2a", 0.06, 0.14, kind="carpaint"), P("#2a0a0a", 0.1, 0.08)], track=0.05),
               L("DOOR", "AlfaSlabOne-Regular.ttf", 1.2, dict(type="gloss", grad=[[0, "#e8a050"], [1, "#9a5420"]], side="#4a2408", tex="wood", tex_col="#7a3a12", tex_scale=1.4, rough=0.35), [P("#ffd25a", 0.05, 0.16, kind="gold"), P("#2a0a0a", 0.09, 0.1)], track=0.03)],
        ornaments=[O("sphere", 0.97, 0.75, 0.05, dict(type="gold", grad=GOLD)), O("star", 0.03, 0.05, 0.1, dict(type="gold", grad=GOLD))],
        cam=dict(tilt=6, yaw=-10, lens=55), world=dict(env="interior", env_str=0.7)),
    "pattern-parade": dict(
        lines=[L("PATTERN", "Fascinate-Regular.ttf", 0.85, None, [P("#3a1a0a", 0.05, 0.16)], mats=[dict(type="gloss", color=c, side="#5a3a2a", tex="stripes", tex_col=WHITE, tex_scale=6) for c in ("#ff6a8a", "#2ec4b6", "#ffb000", "#9b5de5")], track=0.02),
               L("PARADE", "Fascinate-Regular.ttf", 1.0, None, [P("#3a1a0a", 0.05, 0.18), P("#ffe8c0", 0.09, 0.07, kind="matte")], mats=[dict(type="gloss", color=c, side="#5a3a2a") for c in ("#2ec4b6", "#ffb000", "#9b5de5", "#ff6a8a")], wave=0.06)],
        ornaments=[O("star", 0.02, 0.05, 0.1, dict(type="gloss", color="#ffb000")), O("star", 0.98, 0.0, 0.1, dict(type="gloss", color="#ff6a8a")), O("sphere", 0.5, -0.12, 0.05, dict(type="gloss", color="#2ec4b6"))],
        cam=dict(tilt=7, yaw=6, lens=60), world=dict(env="sunrise", env_str=0.7)),
    "odd-blob-out": dict(
        lines=[L("ODD BLOB", "Chewy-Regular.ttf", 1.0, None, [P("#22104a", 0.06, 0.18)], mats=[G("#d9b8ff", "#8e5be8", "#4a1aa0")] * 5 + [G("#e0ff8a", "#74c94e", "#2f7a10")] + [G("#d9b8ff", "#8e5be8", "#4a1aa0")] * 2, bounce=0.3),
               L("OUT", "Chewy-Regular.ttf", 0.8, G(WHITE, "#e8e0ff", "#7a6ab0"), [P("#22104a", 0.06, 0.16), P("#74c94e", 0.1, 0.07)], track=0.15)],
        cam=dict(tilt=6, yaw=-8, lens=60), world=dict(env="studio"), seed=8),
    "balance-buddies": dict(
        lines=[L("BALANCE", "Baloo2-ExtraBold.ttf", 1.0, G("#fff2a0", "#ffb000", "#9a5a00"), [P("#3a1e0a", 0.06, 0.18), P(WHITE, 0.1, 0.07, kind="matte")], rot=-6),
               L("BUDDIES", "Baloo2-ExtraBold.ttf", 0.8, G("#ffd8b0", "#d0884a", "#6a3a12"), [P("#3a1e0a", 0.06, 0.16)], rot=-6, track=0.03)],
        ornaments=[O("bar", 0.5, 1.12, 0.05, dict(type="gloss", color="#9a6b45"), len=22, rot=-6), O("cube", 0.5, 1.22, 0.07, dict(type="gloss", color="#2ec4b6"), rot=45, rx=0)],
        cam=dict(tilt=7, yaw=6, lens=60), world=dict(env="sunrise", env_str=0.7)),
    # ------------------------------------------------------------------ arcade: reflex
    "whack-a-gloop": dict(
        lines=[L("WHACK-A-", "Bangers-Regular.ttf", 0.65, G(WHITE, "#fff0d0", "#b07a3a"), [P("#1e0a2a", 0.05, 0.14), P("#ff8a3d", 0.09, 0.07)], shear=0.06, track=0.06, rot=4),
               L("GLOOP!", "Bangers-Regular.ttf", 1.2, G("#eaff7a", "#5fd01f", "#1f6a0a"), [P("#1e0a2a", 0.05, 0.2), P("#ff8a3d", 0.1, 0.1)], shear=0.06, track=0.04, rot=4)],
        ornaments=[O("star", 0.96, 0.05, 0.2, dict(type="gloss", color="#ffd21f"), points=8, inner=0.6, rot=8, z=-0.8), O("sparkle", 0.03, 0.9, 0.1, SPARK)],
        cam=dict(tilt=8, yaw=-10, lens=55), world=dict(env="studio")),
    "turbo-dash": dict(
        lines=[L("TURBO", "RacingSansOne-Regular.ttf", 1.0, G("#fff27a", "#ff4a12", "#8a1a0a", mid="#ffa21f"), [P("#0a1a4a", 0.05, 0.18), P("#38b6ff", 0.09, 0.08)], shear=0.15, track=0.02),
               L("DASH", "RacingSansOne-Regular.ttf", 0.8, G(WHITE, "#cfe8ff", "#3a6aa0"), [P("#0a1a4a", 0.05, 0.16)], shear=0.15, track=0.3, dx=0.1)],
        ornaments=[O("bar", -0.05, 0.3, 0.05, dict(type="gloss", color="#ff8a3d"), len=7), O("bar", -0.08, 0.45, 0.04, dict(type="gloss", color="#ffd25a"), len=5), O("bar", -0.04, 0.6, 0.03, dict(type="gloss", color=WHITE), len=4)],
        cam=dict(tilt=10, yaw=-14, lens=50), world=dict(env="sunset", env_str=0.7)),
    "bake-drop": dict(
        lines=[L("BAKE", "Grandstander-Black.ttf", 1.0, G("#ffd8ec", "#ff7ab8", "#b02a6a"), [P("#5a2a12", 0.07, 0.22), P("#ffe8c8", 0.11, 0.08, kind="matte")], bounce=0.3),
               L("DROP", "Grandstander-Black.ttf", 1.0, G("#fff0c8", "#ffc86a", "#a0601a"), [P("#5a2a12", 0.07, 0.22), P("#ff7ab8", 0.11, 0.08)], bounce=0.3)],
        ornaments=[O("bar", 0.1 + 0.8 * (i % 5) / 4, 0.12 + 0.3 * (i // 5), 0.018, dict(type="gloss", color=c), len=2.5, rot=r, z=1.2)
                   for i, (c, r) in enumerate([("#ff3a5a", 20), ("#2ec4b6", -30), ("#ffd21f", 60), ("#7a5aff", -10), ("#ffffff", 45), ("#2ec4b6", 15), ("#ff3a5a", -50), ("#ffd21f", 5), ("#ffffff", -25), ("#7a5aff", 70)])]
        + [O("sphere", 0.96, 0.0, 0.08, dict(type="gloss", color="#e8141e"))],
        cam=dict(tilt=6, yaw=6, lens=60), world=dict(env="interior", env_str=0.8), seed=6),
    "quick-hoot": dict(
        lines=[L("QUICK", "Ultra-Regular.ttf", 0.8, G(WHITE, "#f0e0c0", "#8a6a3a"), [P("#3a1e0a", 0.05, 0.16, kind="gloss", tex="wood", tex_col="#5a2e12")], track=0.06),
               L("DRAW", "Ultra-Regular.ttf", 1.1, dict(type="gold", grad=GOLD, side="#6a3a00"), [P("#3a1e0a", 0.05, 0.2), P("#c84a1a", 0.09, 0.08)], track=0.04)],
        ornaments=[O("star", 0.03, 0.5, 0.16, dict(type="gold", grad=GOLD), rot=-10), O("star", 0.97, 0.5, 0.16, dict(type="gold", grad=GOLD), rot=10)],
        cam=dict(tilt=7, yaw=0, lens=60), world=dict(env="studio", env_str=0.9)),
    # ------------------------------------------------------------------ arcade: numbers
    "count-fast": dict(
        lines=[L("COUNT", "Rowdies-Bold.ttf", 1.0, G("#fff6a0", "#ffb000", "#9a5a00"), [P("#3a0a2a", 0.06, 0.18), P("#ff6f91", 0.1, 0.08)], track=0.02),
               L("FAST!", "Rowdies-Bold.ttf", 0.9, G("#ffd0e0", "#ff3a7a", "#8a0a3a"), [P("#3a0a2a", 0.06, 0.18)], shear=0.12, track=0.08)],
        ornaments=[O("cube", 0.97, 0.05, 0.1, dict(type="gloss", color=WHITE), rot=20, rx=20), O("sphere", 0.96, 0.04, 0.025, dict(type="gloss", color="#1a1030"), z=1.4),
                   O("cube", 0.02, 0.95, 0.08, dict(type="gloss", color="#ffd21f"), rot=-15, rx=-20)],
        cam=dict(tilt=8, yaw=8, lens=55), world=dict(env="studio")),
    "sum-slices": dict(
        lines=[L("SUM", "Chango-Regular.ttf", 0.8, G("#fff6c8", "#ffd060", "#b08020"), [P("#c8281e", 0.06, 0.16), P("#7a3a12", 0.1, 0.1)], track=0.08),
               L("SLICES", "Chango-Regular.ttf", 1.0, dict(type="gloss", grad=[[0, "#fff09a"], [1, "#ffb81f"]], side="#c8281e", tex="noise", tex_col="#ffa020", tex_scale=5), [P("#c8281e", 0.06, 0.18), P("#7a3a12", 0.1, 0.12)], wave=0.04)],
        ornaments=[O("sphere", 0.1, 0.0, 0.07, dict(type="gloss", color="#d8281e"), sz=0.35), O("sphere", 0.92, 0.05, 0.06, dict(type="gloss", color="#d8281e"), sz=0.35), O("leaf", 0.97, 0.9, 0.08, dict(type="gloss", color="#3fae2a"), rot=20)],
        cam=dict(tilt=8, yaw=-6, lens=60), world=dict(env="sunrise", env_str=0.7)),
    "number-ninja": dict(
        lines=[L("NUMBER", "BlackHanSans-Regular.ttf", 0.7, G(WHITE, "#e0e0e8", "#5a5a6a"), [P("#d0141e", 0.05, 0.14, kind="carpaint")], track=0.1),
               L("NINJA", "BlackHanSans-Regular.ttf", 1.2, G("#3a3a4a", "#0a0a10", "#000000", rough=0.15), [P(WHITE, 0.04, 0.12, kind="matte"), P("#d0141e", 0.08, 0.1, kind="carpaint")], track=0.03)],
        ornaments=[O("bar", 0.5, 0.62, 0.025, dict(type="gloss", color=WHITE, emit="#ffffff", emit_str=1.5), len=34, rot=-14, z=1.3)],
        cam=dict(tilt=8, yaw=12, lens=55), world=dict(env="city", env_str=0.6)),
    "more-or-less": dict(
        lines=[L("MORE", "SpicyRice-Regular.ttf", 1.0, None, [P("#2a0a4a", 0.06, 0.18)], mats=[G("#ffb0c8", "#ff3a7a", "#9a0a3a", "jelly"), G("#c8a8ff", "#9b5de5", "#4a1aa0", "jelly")], bounce=0.4),
               L("or", "SpicyRice-Regular.ttf", 0.5, G("#ffffff", "#ffe0a0", "#a07a3a"), [P("#2a0a4a", 0.06, 0.14)]),
               L("LESS", "SpicyRice-Regular.ttf", 0.8, None, [P("#2a0a4a", 0.06, 0.16)], mats=[G("#b0f0ff", "#2ec4ff", "#0a6aa0", "jelly"), G("#ffe8a0", "#ffb000", "#9a5a00", "jelly")], bounce=0.4, track=0.05)],
        ornaments=[O("sphere", 0.96, 0.1, 0.06, dict(type="jelly", color="#ff3a7a"), sx=1.5, rot=30), O("sphere", 0.05, 0.85, 0.05, dict(type="jelly", color="#74c94e"), sx=1.5, rot=-20),
                   O("sphere", 0.95, 0.8, 0.045, dict(type="jelly", color="#ffd21f"), sx=1.5, rot=60)],
        cam=dict(tilt=6, yaw=-6, lens=60), world=dict(env="interior", env_str=0.8), seed=12),
    # ------------------------------------------------------------------ arcade: puzzle
    "slide-ship": dict(
        lines=[L("SLIDE", "Michroma-Regular.ttf", 0.8, dict(type="holo", grad=STEEL, side="#3a3a6a", film=380), [P("#0a0a2a", 0.05, 0.16), P("#b7ff5a", 0.085, 0.06, kind="neon", emit_str=1.5)], track=0.12),
               L("SHIP", "Michroma-Regular.ttf", 1.0, G("#e0ff9a", "#7aff3a", "#2a7a10", emit="#7aff3a", emit_str=0.25), [P("#0a0a2a", 0.05, 0.18)], track=0.18)],
        ornaments=[O("sphere", 0.97, 0.05, 0.09, dict(type="gloss", grad=[[0, "#ffb0e0"], [1, "#9b5de5"]])), O("ring", 0.97, 0.05, 0.14, dict(type="gold", grad=GOLD), thick=0.12, rx=72, ry=15),
                   O("sparkle", 0.02, 0.9, 0.08, SPARK)],
        cam=dict(tilt=10, yaw=12, lens=50), world=dict(env="night", env_str=0.8), glow=["#b7ff5a", 16, 0.2]),
    "gloop-pipes": dict(
        lines=[L("GLOOP", "BungeeInline-Regular.ttf", 1.0, G("#d8ff7a", "#5fd01f", "#1f6a0a", "jelly"), [P("#2a3a4a", 0.05, 0.18, kind="gloss", metal=0.8), P("#9be34a", 0.09, 0.07)]),
               L("PIPES", "BungeeInline-Regular.ttf", 1.0, dict(type="chrome", grad=STEEL, side="#4a5a6a"), [P("#2a3a4a", 0.05, 0.18, kind="gloss", metal=0.8), P("#2e86c8", 0.09, 0.07)])],
        ornaments=[O("drop", 0.12, 1.06, 0.07, dict(type="jelly", color="#9be34a"), rot=180), O("drop", 0.86, 1.08, 0.05, dict(type="jelly", color="#9be34a"), rot=180)],
        cam=dict(tilt=8, yaw=-10, lens=55), world=dict(env="city", env_str=0.7)),
    "firefly-switch": dict(
        lines=[L("FIREFLY", "BowlbyOne-Regular.ttf", 1.0, dict(type="neon", grad=[[0, "#fffbd0"], [1, "#ffd23a"]], side="#a07a00", emit_str=1.2), [P("#0a0a2a", 0.06, 0.18), P("#ffe38a", 0.1, 0.06, kind="neon", emit_str=0.8)], track=0.02),
               L("SWITCH", "BowlbyOne-Regular.ttf", 0.75, G("#d8e8ff", "#6a8ad8", "#22305a"), [P("#0a0a2a", 0.06, 0.16)], track=0.12)],
        ornaments=[O("sphere", u, v, s, dict(type="neon", color="#fff2a0", emit_str=8)) for u, v, s in ((0.02, 0.0, 0.03), (0.98, 0.1, 0.025), (0.92, 0.95, 0.035), (0.06, 0.9, 0.02), (0.5, -0.12, 0.02))],
        cam=dict(tilt=8, yaw=8, lens=60), world=dict(env="night", env_str=0.6), glow=["#ffe38a", 26, 0.4]),
    "maze-munch": dict(
        lines=[L("MAZE", "Bungee-Regular.ttf", 1.0, dict(type="matte", grad=[[0, "#b8f06a"], [1, "#3f9a2a"]], side="#1f5a12", tex="noise", tex_col="#2f7a1a", tex_scale=12, rough=0.75, bump=0.6), [P("#3a1e0a", 0.05, 0.18), P("#ff8a3d", 0.09, 0.08)], track=0.04),
               L("MUNCH", "Bungee-Regular.ttf", 0.85, G("#ffd08a", "#ff8a3d", "#9a3a0a"), [P("#3a1e0a", 0.05, 0.16)], track=0.06, bounce=0.3)],
        ornaments=[O("sphere", 0.97, 0.2, 0.06, dict(type="gloss", color="#ffd25a")), O("sphere", 0.97, 0.45, 0.04, dict(type="gloss", color="#ffd25a")), O("sphere", 0.02, 0.85, 0.05, dict(type="gloss", color="#ffd25a"))],
        cam=dict(tilt=12, yaw=10, lens=50), world=dict(env="forest", env_str=0.7)),
}
