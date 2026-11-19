"""Tondu's Vine Climb sound pack: a warm title theme (kalimba and marimba under jungle strings), one climbing track
for each of the 30 green worlds (Backyard Garden = bright marimba hop, Mango Orchard = steel-drum sunshine, Bamboo Grove =
pentatonic flute over taiko, Banana Grove = kalimba bounce, Tea Hills = misty harp ... up to the Great Banyan's tribal
brass finale; later worlds get faster and fuller), a driving guardian theme for every world's stage 20, and the effects:
the leafy flip swoosh, the bug snap (pitched up with the combo), the golden-beetle chime, the tail-drop pop and wobble,
the regrow shimmer, the moss-shield chime, the Sun-Rush smash, leap and landing, pickups, Sun Rush, the flower-gate
bloom, the moss checkpoint, the fall, Kaaki's caw, falling-fruit whistles, thunder, pod pops, rolling burrs, the cling
creak, the new-world fanfare, a combo arpeggio, bees and splashes. All original.

usage: python scripts/gen_vine_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = title, guardian, any world music key (garden ... crown), music, sfx.
  Files: music_vine_<key>_<action|calm>, sfx_vine_<name>.
Reuses the studio of gen_clay_audio.py's chain (gen_kiko_audio.py -> gen_dash_audio.py -> ... -> gen_racing_audio.py).
"""
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
_kiko = open(os.path.join(HERE, "gen_kiko_audio.py"), encoding="utf-8").read()
exec(_kiko[: _kiko.index(chr(10) + "def run_music():")])
exec(_kiko[_kiko.index(chr(10) + "def st2(y)"): _kiko.index(chr(10) + "def sfx():")])
STYLES.clear()  # noqa: F821
META = {"music": {}, "sfx": {}}  # noqa: F811

SCALES = {"maj": [0, 2, 4, 5, 7, 9, 11], "min": [0, 2, 3, 5, 7, 8, 10], "dor": [0, 2, 3, 5, 7, 9, 10], "lyd": [0, 2, 4, 6, 7, 9, 11],
          "mix": [0, 2, 4, 5, 7, 9, 10], "hmin": [0, 2, 3, 5, 7, 8, 11], "pent": [0, 2, 4, 7, 9], "mpent": [0, 3, 5, 7, 10]}


def tune(root, mode, seed):
    """a 32-note climbing hook: motif A, a lifted B, A with a new ending, and a cadence home"""
    sc, r = SCALES[mode], random.Random(seed)
    deg = lambda d: root + 12 * (d // len(sc)) + sc[d % len(sc)]
    walk, d = [], r.choice([0, 2, 4])
    for _ in range(8):
        walk.append(d); d = max(-2, min(9, d + r.choice([-2, -1, 1, 1, 2, 2, 3])))
    a = walk
    b = [x + r.choice([2, 3]) for x in walk[:6]] + [walk[6] + 1, walk[7] + 2]
    a2 = walk[:5] + [walk[5] + 1, walk[6] - 1, walk[4]]
    c = [walk[0] + 4, walk[1] + 3, walk[2] + 2, walk[3] + 1, 2, 1, -1, 0]
    return [deg(x) for x in a + b + a2 + c]


# name: (bpm, prog, hook, lead, stabs, bass, kit, lo, pad, second)
def world_styles():
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 977 + 11))
    st = lambda f, steps=(2, 6, 10, 14), g=0.12, o=0: stabs(f, steps, g, o)
    strings = lambda c=2800.0: (lambda m, d: i_strings(m, d, 0.3, False, c))
    return {
        "garden": (116, ["C", "G", "Am", "F"], T_("garden", 84, "maj"), lambda m, d: i_marimba(m, 0.4), st(lambda m, d: i_kalimba(m, 0.3)), bass_walk, kit_jungle, 36, strings(), lambda m, d: i_glock(m, 0.35)),
        "orchard": (118, ["F", "C", "Dm", "Bb"], T_("orchard", 77, "maj"), lambda m, d: i_steel(m, 0.45), st(lambda m, d: i_marimba(m, 0.3)), bass_oompah, kit_jungle, 29, None, lambda m, d: i_kalimba(m, 0.35)),
        "bamboo": (112, ["Am", "G", "F", "G"], T_("bamboo", 81, "mpent"), lambda m, d: mono(i_piccolo(m - 12, d)), st(lambda m, d: i_kalimba(m, 0.3), (3, 7, 11, 15)), bass_tribal, kit_tribal, 33, strings(2400.0), lambda m, d: i_harp(m, 0.5)),
        "banana": (122, ["G", "D", "Em", "C"], T_("banana", 79, "pent"), lambda m, d: i_kalimba(m, 0.45), st(lambda m, d: i_marimba(m, 0.3)), bass_walk, kit_jungle, 31, None, lambda m, d: i_xylo(m, 0.25)),
        "tea": (108, ["D", "Bm", "G", "A"], T_("tea", 74, "lyd"), lambda m, d: i_harp(m, 0.6), st(lambda m, d: i_celesta(m, 0.3), (3, 7, 11, 15), 0.1), bass_sub, kit_soft_s, 38, strings(2600.0), lambda m, d: i_clarinet(m, d)),
        "lotus": (110, ["E", "C#m", "A", "B"], T_("lotus", 76, "pent"), lambda m, d: i_steel(m, 0.5), st(lambda m, d: i_harp(m, 0.4)), bass_sub, kit_rain, 28, strings(3000.0), lambda m, d: i_bell(m, 0.6)),
        "coast": (124, ["A", "E", "F#m", "D"], T_("coast", 81, "maj"), lambda m, d: i_steel(m, 0.45), st(lambda m, d: i_marimba(m - 12, 0.3), (2, 5, 10, 13), 0.13), bass_walk, kit_jungle, 33, None, lambda m, d: i_kalimba(m, 0.35)),
        "rose": (120, ["Bb", "Gm", "Eb", "F"], T_("rose", 82, "maj"), lambda m, d: i_clarinet(m, d), st(lambda m, d: i_harp(m, 0.4)), bass_walk, kit_swing, 34, strings(2800.0), lambda m, d: i_glock(m, 0.3)),
        "fern": (114, ["Em", "C", "G", "D"], T_("fern", 76, "dor"), lambda m, d: i_marimba(m, 0.45), st(lambda m, d: i_kalimba(m, 0.3), (3, 6, 11, 14)), bass_tribal, kit_tribal, 28, strings(2400.0), lambda m, d: i_harp(m, 0.5)),
        "canopy": (126, ["Am", "F", "C", "G"], T_("canopy", 81, "min"), lambda m, d: i_kalimba(m, 0.5), st(lambda m, d: i_marimba(m, 0.35), (3, 6, 11, 14), 0.15), bass_tribal, kit_tribal, 33, strings(2600.0), lambda m, d: mono(i_horn(m - 12, d))),
        "mushroom": (118, ["G", "Em", "C", "D"], T_("mushroom", 79, "maj"), lambda m, d: i_xylo(m, 0.25), st(lambda m, d: i_toypiano(m, 0.3)), bass_oompah, kit_chip, 31, None, lambda m, d: i_glock(m, 0.35)),
        "monsoon": (120, ["Dm", "Bb", "C", "A"], T_("monsoon", 74, "dor"), lambda m, d: i_epiano(m, d), st(lambda m, d: i_pluck(m, 0.3, 5000.0, 450.0, 0.06, 0.2)), bass_walk, kit_rain, 38, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.5)),
        "sunflower": (128, ["C", "F", "G", "C"], T_("sunflower", 84, "maj"), lambda m, d: mono(i_trumpet(m - 12, d)), st(lambda m, d: i_marimba(m, 0.3)), bass_oompah, kit_march, 36, strings(3400.0), lambda m, d: i_glock(m, 0.35)),
        "ruins": (116, ["Am", "Dm", "E", "Am"], T_("ruins", 81, "hmin"), lambda m, d: i_harp(m, 0.6), st(lambda m, d: i_pluck(m, 0.3, 4500.0, 400.0, 0.06, 0.25), (3, 7, 11, 15)), bass_tribal, kit_tribal, 33, lambda m, d: i_choir(m, d, 0.45), lambda m, d: mono(i_horn(m - 12, d))),
        "firefly": (104, ["F", "Dm", "Bb", "C"], T_("firefly", 77, "lyd"), lambda m, d: i_celesta(m, 0.5), st(lambda m, d: i_harp(m, 0.4), (3, 7, 11, 15), 0.1), bass_sub, kit_rain, 29, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_musicbox(m, 0.5)),
        "waterfall": (122, ["D", "A", "Bm", "G"], T_("waterfall", 74, "maj"), lambda m, d: i_harp(m, 0.6), st(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_walk, kit_jungle, 38, strings(3200.0), lambda m, d: i_steel(m, 0.45)),
        "banyan": (128, ["Em", "D", "C", "B"], T_("banyan", 76, "hmin"), lambda m, d: i_kalimba(m, 0.5), st(lambda m, d: i_marimba(m, 0.35), (2, 5, 10, 13), 0.15), bass_tribal, kit_tribal, 28, None, lambda m, d: mono(i_accordion(m - 12, d))),
        "gourd": (124, ["G", "C", "D", "G"], T_("gourd", 79, "mix"), lambda m, d: mono(i_accordion(m - 12, d)), st(lambda m, d: i_xylo(m, 0.25)), bass_oompah, kit_swing, 31, None, lambda m, d: i_clarinet(m, d)),
        "orchid": (112, ["F#m", "D", "A", "E"], T_("orchid", 78, "dor"), lambda m, d: i_celesta(m, 0.5), st(lambda m, d: i_harp(m, 0.4), (3, 7, 11, 15), 0.11), bass_sub, kit_rain, 30, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.7)),
        "mangrove": (126, ["Dm", "C", "Bb", "A"], T_("mangrove", 74, "dor"), lambda m, d: i_steel(m, 0.45), st(lambda m, d: i_marimba(m, 0.3), (3, 6, 11, 14)), bass_walk, kit_jungle, 38, strings(2600.0), lambda m, d: i_kalimba(m, 0.4)),
        "pine": (118, ["Em", "G", "D", "C"], T_("pine", 76, "min"), lambda m, d: mono(i_piccolo(m - 12, d)), st(lambda m, d: i_harp(m, 0.4)), bass_sub, kit_march, 28, strings(2400.0), lambda m, d: mono(i_horn(m - 12, d))),
        "spice": (130, ["Am", "G", "F", "E"], T_("spice", 81, "hmin"), lambda m, d: i_pluck(m, 0.3, 6000.0, 500.0, 0.05, 0.25), st(lambda m, d: i_marimba(m, 0.3), (2, 6, 10, 14), 0.13), bass_tribal, kit_tribal, 33, None, lambda m, d: mono(i_clav(m, d))),
        "blossom": (120, ["A", "F#m", "D", "E"], T_("blossom", 81, "pent"), lambda m, d: i_kalimba(m, 0.45), st(lambda m, d: i_harp(m, 0.4)), bass_walk, kit_soft_s, 33, strings(3200.0), lambda m, d: i_glock(m, 0.35)),
        "temple": (124, ["Dm", "Bb", "Gm", "A"], T_("temple", 74, "hmin"), lambda m, d: i_bell(m, 0.8), st(lambda m, d: i_kalimba(m, 0.3), (0, 4, 8, 12), 0.1), bass_tribal, kit_tribal, 38, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_harp(m, 0.5)),
        "glow": (128, ["Cm", "Ab", "Eb", "Bb"], T_("glow", 72, "min"), lambda m, d: i_synthpluck(m, 0.4), st(lambda m, d: i_pluck(m, 0.3, 7000.0, 500.0, 0.06, 0.2), (3, 7, 11, 15)), bass_pulse(900.0), kit_edm, 36, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.6)),
        "thicket": (134, ["Em", "C", "D", "B"], T_("thicket", 76, "hmin"), lambda m, d: mono(i_lead(m, d, None, 4200.0)), st(lambda m, d: mono(i_brass(m, 0.28, True, 2400.0)), (6, 14), 0.16), bass_reese, kit_rock, 28, None, lambda m, d: i_marimba(m, 0.4)),
        "storm": (136, ["Dm", "Bb", "C", "A"], T_("storm", 74, "hmin"), lambda m, d: mono(i_lead(m, d, None, 5200.0)), st(lambda m, d: i_pluck(m, 0.3, 6000.0, 500.0, 0.05, 0.2), (2, 6, 10, 14), 0.13), bass_reese, kit_rock, 26, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_brass(m, d, False, 2800.0))),
        "cloud": (126, ["C", "Am", "F", "G"], T_("cloud", 84, "lyd"), lambda m, d: i_celesta(m, 0.5), st(lambda m, d: i_harp(m, 0.4), (3, 7, 11, 15), 0.11), bass_walk, kit_soft_s, 36, strings(3600.0), lambda m, d: mono(i_horn(m - 12, d))),
        "sky": (132, ["G", "D", "Em", "C"], T_("sky", 79, "mix"), lambda m, d: mono(i_horn(m - 12, d)), st(lambda m, d: i_harp(m, 0.4)), bass_walk, kit_march, 31, strings(3200.0), lambda m, d: i_bell(m, 0.6)),
        "crown": (138, ["C", "G", "Am", "F", "Dm", "G", "Em", "G"], T_("crown", 84, "maj"), lambda m, d: mono(i_brass(m - 12, d, False, 2800.0)), st(lambda m, d: i_marimba(m, 0.35)), bass_tribal, kit_tribal, 36, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_trumpet(m - 12, d))),
        "guardian": (140, ["Am", "F", "G", "E"], T_("guardian", 81, "hmin"), lambda m, d: mono(i_lead(m, d, None, 5200.0)), st(lambda m, d: mono(i_brass(m, 0.28, True, 2600.0)), (2, 6, 10, 14), 0.14), bass_reese, kit_tribal, 33, lambda m, d: i_choir(m, d, 0.35), lambda m, d: i_marimba(m, 0.4)),
    }


def kit_soft_s(S, bar):
    """soft shaker + rim kit (no big drums) for the calmer worlds"""
    if bar % 8 == 0: S.put("drums", k_shaker(), S.T(bar, 0), 0.06, -0.3)
    for st_ in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, st_), 0.05 + (0.03 if st_ % 4 == 2 else 0), 0.3 if st_ % 4 else -0.2)
    for st_ in (4, 12): S.put("drums", hp(nz(ns(0.04)), 2500) * env(ns(0.04), 0.001, 0.015), S.T(bar, st_), 0.12, 0.1)


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the warm title: kalimba melody over marimba, soft jungle strings, a shaker and distant birds
    prog = ["G", "Em", "C", "D", "G", "Em", "C", "D"]
    hook = notes(tune(79, "pent", 4242))
    for bar, c in enumerate(prog):
        r = root(c, 36)
        for st_ in (0, 6, 8, 14): S.put("music", i_marimba(r + 24 + (st_ // 6 % 2) * 7, 0.3), S.T(bar, st_), 0.1, 0.2, 0.15)
        for m in vc(c, 55): S.put("music", i_strings(m, S.st * 15, 0.5, False, 2400.0), S.T(bar, 0), 0.07, 0, 0.3)
        S.put("music", i_bass(r, S.st * 6, 600.0, 0.12, 0.6, 1.2), S.T(bar, 0), 0.2, 0, 0)
        if bar % 2: S.put("drums", k_shaker(), S.T(bar, 6), 0.07, -0.3)
        if bar % 4 == 1:
            # a bird chirp far off
            t_ = tt(ns(0.25)); S.put("music", np.sin(2 * np.pi * np.cumsum(2400 + 900 * np.sin(2 * np.pi * 18 * t_)) / SR) * env(ns(0.25), 0.01, 0.08) * 0.25, S.T(bar, 10), 0.08, 0.6, 0.4)
    S.seq("music", lambda m, d: i_kalimba(m, 0.5), hook, 0, 0.3, 0.1, 0.3, 0.15)


SPECS = world_styles()
for key, spec in SPECS.items():
    style(key, spec[0], 16, spec[0], 16, 1.3, 1.3, sc=(0.04, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(make_style(spec))
style("title", 96, 8, 96, 8, 1.6, 1.6, sc=(0.0, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(-2.0, 0.0, -2.0))(st_title)


def run_music():
    for key, spec in STYLES.items():
        act = key != "title"
        v = "action" if act else "calm"
        if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
        bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
        S = Song(f"vine_{key}_{v}", bpm, bars, rt, sw)
        spec["fn"](S, act)
        S.render(-17.0 if act else -17.5, sc, None, 0.55, dl, tag=v, bal=bal)
        print("music", key, round(bars * 4 * 60 / bpm, 6), flush=True)


def sfx():
    if ONLY and "sfx" not in ONLY: return
    S_ = {}
    R = np.random.default_rng(7)

    def sweep(f0, f1, d, a=0.002, dec=0.08):
        m = ns(d); t = tt(m)
        return np.sin(2 * np.pi * np.cumsum(f0 * ((f1 / f0) ** (t / d))) / SR) * env(m, a, dec)

    def leafy(d, lo, hi, a=0.01, dec=0.1):
        m = ns(d); return bp(nz(m), lo, hi) * env(m, a, dec)

    def click(d=0.012, lo=2500, hi=7000):
        return bp(nz(ns(d)), lo, hi) * env(ns(d), 0.0003, 0.004)

    # flip: a quick leafy swoosh round the vine
    n = ns(0.3); y = np.zeros(n)
    m_ = ns(0.24); t_ = tt(m_)
    sw_ = bp(nz(m_), 900, 5000) * np.sin(np.pi * np.clip(t_ / 0.24, 0, 1)) ** 2
    put(y, sw_, 0, 0.55); put(y, sweep(500, 1100, 0.12, 0.01, 0.05), 0.02, 0.12); put(y, click(0.01, 3000, 8000), 0.2, 0.25)
    S_["flip"] = y
    # snap: a crisp little bite (pitched up with the combo by the game)
    n = ns(0.2); y = np.zeros(n)
    put(y, click(0.008, 2000, 7000), 0, 0.6); put(y, sweep(420, 180, 0.07, 0.001, 0.03), 0.004, 0.45); put(y, i_glock(91, 0.15), 0.02, 0.12)
    S_["snap"] = y
    # gold: snap + a coin chime
    n = ns(0.8); y = np.zeros(n)
    put(y, click(0.008, 2000, 7000), 0, 0.5); put(y, i_glock(88, 0.35), 0.02, 0.32); put(y, i_glock(95, 0.45), 0.09, 0.32); put(y, hp(nz(ns(0.4)), 7000) * env(ns(0.4), 0.01, 0.15) * 0.25, 0.05, 1.0)
    S_["gold"] = y
    # combo: a rising marimba arpeggio
    n = ns(0.9); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.4), i * 0.06, 0.4)
    S_["combo"] = y
    # miss: a soft low blip
    S_["miss"] = sweep(330, 240, 0.12, 0.004, 0.05) * 0.35
    # tail: a rubbery pop and a wobbly slide down
    n = ns(0.9); y = np.zeros(n)
    put(y, sweep(300, 900, 0.05, 0.001, 0.02), 0, 0.6); put(y, click(0.015, 1500, 5000), 0, 0.4)
    m_ = ns(0.6); t_ = tt(m_)
    put(y, np.sin(2 * np.pi * np.cumsum(700 * (0.45 ** (t_ / 0.6)) * (1 + 0.06 * np.sin(2 * np.pi * 9 * t_))) / SR) * env(m_, 0.01, 0.22), 0.06, 0.35)
    S_["tail"] = y
    # regrow: a rising shimmer
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91)): put(y, i_glock(m, 0.35), i * 0.07, 0.3)
    put(y, hp(nz(ns(0.6)), 6500) * env(ns(0.6), 0.05, 0.25) * 0.25, 0.05, 1.0)
    S_["regrow"] = y
    # shield: a green magic chime and a soft absorb
    n = ns(0.9); y = np.zeros(n)
    put(y, sweep(240, 120, 0.2, 0.005, 0.08), 0, 0.5)
    for i, m in enumerate((84, 91)): put(y, i_bell(m, 0.6), 0.03 + i * 0.05, 0.25)
    S_["shield"] = y
    # smash: Sun Rush crunches a thorn
    n = ns(0.6); y = np.zeros(n)
    put(y, lp(nz(ns(0.2)), 2200) * env(ns(0.2), 0.001, 0.06), 0, 0.7); put(y, sweep(140, 60, 0.18, 0.001, 0.08), 0, 0.6)
    for k in range(5): put(y, click(0.01, 3000, 8000), float(R.uniform(0.02, 0.2)), 0.3)
    S_["smash"] = y
    # leap: a whoosh up
    n = ns(0.5); y = np.zeros(n)
    m_ = ns(0.4); t_ = tt(m_)
    put(y, bp(nz(m_), 600, 4000) * (t_ / 0.4) * env(m_, 0.05, 0.1), 0, 0.5); put(y, sweep(300, 900, 0.3, 0.02, 0.1), 0, 0.25)
    S_["leap"] = y
    # land: a soft thump and a rustle
    n = ns(0.4); y = np.zeros(n)
    put(y, sweep(160, 80, 0.12, 0.001, 0.05), 0, 0.6); put(y, leafy(0.2, 1500, 6000, 0.005, 0.06), 0.01, 0.35)
    S_["land"] = y
    # hop: a tiny boing
    S_["hop"] = sweep(400, 700, 0.12, 0.003, 0.05) * 0.4
    # pick: a bright three-note pickup
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91)): put(y, i_glock(m, 0.4), i * 0.05, 0.35)
    S_["pick"] = y
    # rush: a rising whoosh, sizzle and a chord
    n = ns(1.4); y = np.zeros(n)
    m_ = ns(0.7); t_ = tt(m_)
    put(y, bp(nz(m_), 800, 6000) * (t_ / 0.7) ** 2 * env(m_, 0.3, 0.1), 0, 0.45)
    for m in (72, 76, 79, 84): put(y, mono(i_brass(m, 0.5, True, 3200.0)), 0.6, 0.18)
    put(y, hp(nz(ns(0.6)), 5000) * env(ns(0.6), 0.02, 0.3) * 0.3, 0.6, 1.0)
    S_["rush"] = y
    # gate: the flower gate blooms (harp glissando + bells)
    n = ns(1.8); y = np.zeros(n)
    for i, m in enumerate((67, 71, 74, 79, 83, 86, 91)): put(y, i_harp(m, 0.7), i * 0.045, 0.32)
    for m in (91, 95, 98): put(y, i_bell(m, 1.0), 0.36, 0.14)
    put(y, hp(nz(ns(1.0)), 6000) * env(ns(1.0), 0.05, 0.4) * 0.2, 0.3, 1.0)
    S_["gate"] = y
    # mid: the moss checkpoint
    n = ns(0.8); y = np.zeros(n)
    put(y, i_marimba(79, 0.4), 0, 0.45); put(y, i_marimba(86, 0.5), 0.1, 0.45)
    S_["mid"] = y
    # fall: a descending slide, rustle and a soft thud far below
    n = ns(1.5); y = np.zeros(n)
    m_ = ns(1.0); t_ = tt(m_)
    put(y, np.sin(2 * np.pi * np.cumsum(900 * (0.25 ** (t_ / 1.0))) / SR) * env(m_, 0.02, 0.4), 0, 0.35)
    put(y, leafy(0.4, 1500, 6000, 0.01, 0.15), 0, 0.3); put(y, sweep(120, 50, 0.25, 0.002, 0.1), 1.05, 0.5)
    S_["fall"] = y
    # caw: Kaaki the crow (two caws)
    n = ns(0.9); y = np.zeros(n)
    for k, t0 in enumerate((0, 0.32)):
        m_ = ns(0.24); t_ = tt(m_)
        f = 620 * (1 - 0.25 * t_ / 0.24)
        saw = 2 * ((np.cumsum(f) / SR) % 1.0) - 1
        caw = bp(saw * (1 + 0.3 * np.sin(2 * np.pi * 32 * t_)), 700, 2600) * env(m_, 0.01, 0.12)
        put(y, caw, t0, 0.6 - k * 0.15)
    S_["caw"] = y
    # whistle: something falling from above
    n = ns(0.7); y = np.zeros(n)
    put(y, sweep(1500, 600, 0.6, 0.02, 0.25), 0, 0.3)
    S_["whistle"] = y
    # thunder: a crack and a long rumble
    n = ns(2.0); y = np.zeros(n)
    put(y, hp(nz(ns(0.08)), 2500) * env(ns(0.08), 0.001, 0.03), 0, 0.8)
    rum = lp(nz(ns(1.8)), 300) * env(ns(1.8), 0.05, 0.7); put(y, rum * (1 + 0.5 * np.sin(2 * np.pi * 3 * tt(ns(1.8)))), 0.03, 1.0)
    S_["thunder"] = y
    # pop: a seed pod bursting
    n = ns(0.5); y = np.zeros(n)
    put(y, sweep(250, 900, 0.04, 0.001, 0.02), 0, 0.6)
    for k in range(6): put(y, click(0.01, 2000, 6000), 0.02 + float(R.uniform(0, 0.2)), 0.25)
    S_["pop"] = y
    # roll: a burr rolling down the vine
    m_ = ns(0.7); t_ = tt(m_)
    S_["roll"] = lp(nz(m_), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 16 * t_)) * env(m_, 0.05, 0.25) * 0.8
    # cling: a little grip creak
    S_["cling"] = bp(nz(ns(0.15)), 800, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 60 * tt(ns(0.15)))) * env(ns(0.15), 0.01, 0.05)
    # world: a new world's fanfare
    n = ns(2.4); y = np.zeros(n)
    for i, m in enumerate((60, 64, 67, 72)): put(y, mono(i_brass(m, 0.9, False, 3000.0)), 0.0 + i * 0.12, 0.2)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.4), 0.5, 0.14)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.4), 0.5 + i * 0.07, 0.3)
    put(y, hp(nz(ns(1.4)), 5500) * env(ns(1.4), 0.1, 0.6) * 0.22, 0.45, 1.0)
    S_["world"] = y
    # buzz: a bee passing
    m_ = ns(0.6); t_ = tt(m_)
    saw = 2 * ((np.cumsum(230 + 15 * np.sin(2 * np.pi * 7 * t_)) / SR) % 1.0) - 1
    S_["buzz"] = bp(saw, 300, 3000) * np.sin(np.pi * t_ / 0.6) * 0.5
    # splash: water
    n = ns(0.7); y = np.zeros(n)
    put(y, bp(nz(ns(0.35)), 600, 5000) * env(ns(0.35), 0.003, 0.12), 0, 0.6)
    for k in range(5): put(y, sweep(float(R.uniform(900, 1600)), float(R.uniform(1800, 2600)), 0.05, 0.001, 0.02), 0.08 + k * 0.06, 0.18)
    S_["splash"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_vine_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_vine.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
