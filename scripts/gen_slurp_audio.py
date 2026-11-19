"""Slurp Lab sound pack: a calm title / lab-map theme, one thinking-music track for each of the 30 labs (Bubble Lab =
bubbly glockenspiel pop, Candy Lab = toy-piano bounce, Garden Lab = harp-and-clarinet stroll, Crystal Cave = bells over a
choir, Ocean Lab = steel-drum breeze, Ice Lab = snow bells, Honey Lab = a lazy swing, the Vault = a sly e-piano, ... up to
the Grand Lab's brass finale), a tense, driving Exam track for every lab's stage 20, and the effects: glass clink pick-up,
the drag tick, the wet slurp, the seal pop and chime, the soft bonk, Prof. Hoot's "hmm" when stuck, a rewind for undo, a
magic sparkle for hints, the win fanfare, the star ding, and one sound per Phase 2 mechanic (bubble pop, glass break,
bridge crumble, switch, paint splash, turn pad, crate push, portal, unlock, bomb, ice slide, goo, burnt fuse). All
original.

usage: python scripts/gen_slurp_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = title, exam, any lab music key (bubble ... grand), music, sfx.
  Files: music_slurp_<key>_<action|calm>, sfx_slurp_<name>.
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
          "mix": [0, 2, 4, 5, 7, 9, 10], "hmin": [0, 2, 3, 5, 7, 8, 11]}


def tune(root, mode, seed):
    """a 32-note hook: motif A, a lifted B, A with a new ending, and a cadence home"""
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
def lab_styles():
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 131 + 7))
    return {
        "bubble": (112, ["C", "Am", "F", "G"], T_("bubble", 84, "maj"), lambda m, d: i_glock(m, 0.35), stabs(lambda m, d: i_marimba(m - 12, 0.3), (2, 6, 10, 14), 0.12), bass_pulse(650.0), kit_sleigh, 36, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_kalimba(m, 0.35)),
        "candy": (120, ["F", "Dm", "Bb", "C"], T_("candy", 77, "maj"), lambda m, d: i_toypiano(m, 0.35), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.12, 12), bass_chip, kit_chip, 29, None, lambda m, d: i_glock(m, 0.3)),
        "garden": (106, ["G", "Em", "C", "D"], T_("garden", 79, "maj"), lambda m, d: i_harp(m, 0.6), stabs(lambda m, d: i_marimba(m, 0.3), (2, 6, 10, 14), 0.12), bass_walk, kit_jungle, 31, lambda m, d: i_strings(m, d, 0.3, False, 2400.0), lambda m, d: i_clarinet(m, d)),
        "crystal": (100, ["Bm", "G", "Em", "F#"], T_("crystal", 71, "min"), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_glock(m, 0.3), (3, 7, 11, 15), 0.1, 12), bass_sub, kit_tribal, 35, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_celesta(m, 0.5)),
        "ocean": (110, ["D", "Bm", "G", "A"], T_("ocean", 74, "lyd"), lambda m, d: i_steel(m, 0.45), stabs(lambda m, d: i_marimba(m - 12, 0.3), (2, 5, 10, 13), 0.13), bass_walk, kit_jungle, 38, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_kalimba(m, 0.35)),
        # Phase 2 labs 6-30
        "ice": (104, ["Em", "C", "G", "D"], T_("ice", 76, "dor"), lambda m, d: i_glock(m, 0.5), stabs(lambda m, d: i_snowbell(m, 0.4), (3, 7, 11, 15), 0.1, 12), bass_sub, kit_sleigh, 40, lambda m, d: i_strings(m, d, 0.35, False, 3000.0), lambda m, d: i_celesta(m, 0.5)),
        "honey": (96, ["F", "Bb", "Gm", "C"], T_("honey", 77, "mix"), lambda m, d: mono(i_horn(m - 12, d)), stabs(lambda m, d: i_marimba(m, 0.3), (2, 6, 10, 14), 0.12), bass_walk, kit_swing, 29, None, lambda m, d: i_xylo(m, 0.25)),
        "vault": (108, ["Dm", "Bb", "Gm", "A"], T_("vault", 74, "hmin"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: mono(i_clav(m, d)), (2, 6, 10, 14), 0.11), bass_walk, kit_swing, 38, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.5)),
        "soap": (116, ["C", "G", "Am", "F"], T_("soap", 84, "lyd"), lambda m, d: i_kalimba(m, 0.45), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(700.0), kit_sleigh, 36, lambda m, d: i_strings(m, d, 0.3, False, 2600.0), lambda m, d: i_marimba(m, 0.4)),
        "rainbow": (124, ["G", "D", "Em", "C"], T_("rainbow", 79, "maj"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_pluck(m, 0.3, 7000.0, 500.0, 0.06, 0.2), (3, 7, 11, 15), 0.12), bass_pulse(900.0), kit_edm, 31, lambda m, d: i_strings(m, d, 0.3, False, 3200.0), lambda m, d: i_glock(m, 0.35)),
        "jelly": (118, ["A", "F#m", "D", "E"], T_("jelly", 81, "maj"), lambda m, d: i_marimba(m, 0.45), stabs(lambda m, d: i_toypiano(m, 0.3), (2, 6, 10, 14), 0.12), bass_chip, kit_chip, 33, None, lambda m, d: i_xylo(m, 0.25)),
        "paint": (110, ["Bb", "Gm", "Eb", "F"], T_("paint", 82, "maj"), lambda m, d: mono(i_accordion(m - 12, d)), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.12), bass_oompah, kit_march, 34, None, lambda m, d: i_clarinet(m, d)),
        "wind": (126, ["Am", "F", "G", "Em"], T_("wind", 81, "dor"), lambda m, d: mono(i_piccolo(m - 12, d)), stabs(lambda m, d: i_pluck(m, 0.3, 6500.0, 500.0, 0.05, 0.2), (2, 6, 10, 14), 0.12), bass_pulse(900.0), kit_gallop, 33, lambda m, d: i_strings(m, d, 0.25, False, 3000.0), lambda m, d: i_harp(m, 0.5)),
        "space": (100, ["Am", "Em", "F", "C"], T_("space", 81, "min"), lambda m, d: mono(i_lead(m, d, None, 3200.0, 0.02)), stabs(lambda m, d: i_synthpluck(m, 0.3), (3, 7, 11, 15), 0.11), bass_reese, kit_edm, 33, lambda m, d: i_choir(m, d, 0.45), lambda m, d: i_bell(m, 0.6)),
        "spin": (122, ["E", "C#m", "A", "B"], T_("spin", 76, "mix"), lambda m, d: i_xylo(m, 0.25), stabs(lambda m, d: i_marimba(m, 0.3), (2, 5, 10, 13), 0.13), bass_walk, kit_jungle, 28, None, lambda m, d: i_kalimba(m, 0.4)),
        "clock": (112, ["Cm", "Ab", "Eb", "G"], T_("clock", 72, "hmin"), lambda m, d: i_musicbox(m, 0.5), stabs(lambda m, d: mono(i_clav(m, d)), (0, 4, 8, 12), 0.1), bass_pulse(650.0), kit_march, 36, lambda m, d: i_strings(m, d, 0.3, False, 2600.0), lambda m, d: i_celesta(m, 0.5)),
        "toy": (120, ["G", "C", "D", "G"], T_("toy", 79, "maj"), lambda m, d: i_toypiano(m, 0.4), stabs(lambda m, d: i_xylo(m, 0.25), (2, 6, 10, 14), 0.12), bass_oompah, kit_chip, 31, None, lambda m, d: mono(i_chip(m, d, 0.25))),
        "bridge": (106, ["Dm", "C", "Bb", "A"], T_("bridge", 74, "dor"), lambda m, d: i_harp(m, 0.6), stabs(lambda m, d: i_pluck(m, 0.3, 5000.0, 450.0, 0.06, 0.25), (2, 6, 10, 14), 0.12), bass_walk, kit_tribal, 38, lambda m, d: i_strings(m, d, 0.3, False, 2400.0), lambda m, d: i_clarinet(m, d)),
        "factory": (128, ["Em", "Em", "C", "D"], T_("factory", 76, "min"), lambda m, d: mono(i_clav(m, d)), stabs(lambda m, d: mono(i_brass(m, 0.28, True, 2400.0)), (6, 14), 0.16), bass_pulse(1000.0), kit_rock, 28, None, lambda m, d: mono(i_lead(m, d, None, 4200.0))),
        "fireworks": (130, ["C", "G", "Am", "F"], T_("fireworks", 84, "maj"), lambda m, d: mono(i_trumpet(m - 12, d)), stabs(lambda m, d: mono(i_brass(m, 0.28, True, 2800.0)), (2, 6, 10, 14), 0.12), bass_pulse(1000.0), kit_edm, 36, lambda m, d: i_strings(m, d, 0.25, False, 3600.0), lambda m, d: i_bell(m, 0.6)),
        "mirror": (102, ["F#m", "D", "A", "E"], T_("mirror", 78, "dor"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_harp(m, 0.4), (3, 7, 11, 15), 0.11), bass_sub, kit_rain, 30, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.7)),
        "glass": (108, ["B", "G#m", "E", "F#"], T_("glass", 83, "lyd"), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_sub, kit_sleigh, 35, lambda m, d: i_strings(m, d, 0.35, False, 3400.0), lambda m, d: i_snowbell(m, 0.5)),
        "kitchen": (116, ["F", "Dm", "Gm", "C"], T_("kitchen", 77, "mix"), lambda m, d: i_clarinet(m, d), stabs(lambda m, d: i_marimba(m, 0.3), (2, 6, 10, 14), 0.13), bass_oompah, kit_swing, 29, None, lambda m, d: i_xylo(m, 0.25)),
        "snow": (96, ["D", "Bm", "G", "A"], T_("snow", 74, "maj"), lambda m, d: i_snowbell(m, 0.6), stabs(lambda m, d: i_celesta(m, 0.4), (3, 7, 11, 15), 0.1), bass_pulse(650.0), kit_sleigh, 38, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_musicbox(m, 0.5)),
        "robot": (124, ["Am", "Am", "F", "G"], T_("robot", 81, "min"), lambda m, d: mono(i_chip(m, d, 0.25)), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.12), bass_chip, kit_chip, 33, None, lambda m, d: mono(i_lead(m, d, None, 3800.0))),
        "fuse": (134, ["Dm", "Bb", "C", "A"], T_("fuse", 74, "hmin"), lambda m, d: mono(i_lead(m, d, None, 5200.0)), stabs(lambda m, d: i_pluck(m, 0.3, 6000.0, 500.0, 0.05, 0.2), (2, 6, 10, 14), 0.13), bass_reese, kit_rock, 26, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_brass(m, d, False, 2800.0))),
        "maze": (110, ["Gm", "Eb", "Cm", "D"], T_("maze", 79, "hmin"), lambda m, d: i_pluck(m, 0.3, 6000.0, 500.0, 0.05, 0.25), stabs(lambda m, d: i_marimba(m, 0.3), (3, 6, 11, 14), 0.13), bass_walk, kit_tribal, 31, lambda m, d: i_strings(m, d, 0.3, False, 2400.0), lambda m, d: i_epiano(m, d)),
        "dream": (88, ["C", "Am", "F", "G"], T_("dream", 72, "lyd"), lambda m, d: i_musicbox(m, 0.6), stabs(lambda m, d: i_harp(m, 0.5), (2, 6, 10, 14), 0.1), bass_sub, kit_rain, 36, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_celesta(m, 0.5)),
        "sky": (114, ["A", "E", "F#m", "D"], T_("sky", 81, "mix"), lambda m, d: mono(i_horn(m - 12, d)), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.12), bass_walk, kit_march, 33, lambda m, d: i_strings(m, d, 0.3, False, 3200.0), lambda m, d: i_bell(m, 0.6)),
        "grand": (126, ["C", "G", "Am", "F", "Dm", "G", "Em", "G"], T_("grand", 84, "maj"), lambda m, d: mono(i_brass(m - 12, d, False, 2800.0)), stabs(lambda m, d: i_bell(m, 0.4), (2, 6, 10, 14), 0.1), bass_pulse(900.0), kit_rock, 36, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_trumpet(m - 12, d))),
        "exam": (128, ["Am", "F", "C", "E"], T_("exam", 81, "hmin"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: i_pluck(m, 0.3, 6000.0, 500.0, 0.05, 0.2), (2, 6, 10, 14), 0.13), bass_pulse(800.0), kit_edm, 33, lambda m, d: i_choir(m, d, 0.35), lambda m, d: i_bell(m, 0.5)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm lab theme: celesta and marimba over soft strings and a gentle shaker — music for thinking
    prog = ["C", "Em", "Am", "F", "C", "Em", "F", "G"]
    hook = notes(tune(72, "lyd", 2027))
    for bar, c in enumerate(prog):
        r = root(c, 36)
        for st_ in (0, 6, 8, 14): S.put("music", i_marimba(r + 24 + (st_ // 6 % 2) * 7, 0.3), S.T(bar, st_), 0.1, 0.2, 0.15)
        for m in vc(c, 55): S.put("music", i_strings(m, S.st * 15, 0.5, False, 2400.0), S.T(bar, 0), 0.07, 0, 0.3)
        S.put("music", i_bass(r, S.st * 6, 600.0, 0.12, 0.6, 1.2), S.T(bar, 0), 0.2, 0, 0)
        if bar % 2: S.put("drums", k_shaker(), S.T(bar, 6), 0.07, -0.3)
    S.seq("music", i_celesta, hook, 0, 0.26, 0.1, 0.3, 0.15)


SPECS = lab_styles()
for key, spec in SPECS.items():
    style(key, spec[0], 16, spec[0], 16, 1.3, 1.3, sc=(0.04, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(make_style(spec))
style("title", 96, 8, 96, 8, 1.6, 1.6, sc=(0.0, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(-2.0, 0.0, -2.0))(st_title)


def run_music():
    for key, spec in STYLES.items():
        act = key != "title"
        v = "action" if act else "calm"
        if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
        bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
        S = Song(f"slurp_{key}_{v}", bpm, bars, rt, sw)
        spec["fn"](S, act)
        S.render(-17.0 if act else -17.5, sc, None, 0.55, dl, tag=v, bal=bal)
        print("music", key, round(bars * 4 * 60 / bpm, 6), flush=True)


def sfx():
    if ONLY and "sfx" not in ONLY: return
    S_ = {}

    def glassy(f, d, dec, bright=1.0):
        m = ns(d); t = tt(m)
        w = np.sin(2 * np.pi * f * t) + 0.45 * bright * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.05) + 0.25 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / 0.02)
        return w * env(m, 0.001, dec)

    # pick up: a little glass clink and a lift
    n = ns(0.3); y = np.zeros(n)
    put(y, glassy(1760, 0.25, 0.09), 0, 0.5); put(y, glassy(2349, 0.2, 0.07), 0.035, 0.35)
    put(y, hp(nz(ns(0.08)), 4000) * env(ns(0.08), 0.002, 0.03), 0, 0.12)
    S_["pick"] = y
    # drop: a soft glass set-down
    n = ns(0.3); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(220 * (0.6 ** (tt(ns(0.15)) / 0.15))) / SR) * env(ns(0.15), 0.002, 0.05), 0, 0.5)
    put(y, glassy(1318, 0.2, 0.05), 0.01, 0.25)
    S_["drop"] = y
    # step: a tiny tick (it plays on every cell)
    n = ns(0.06); t = tt(n)
    S_["step"] = (bp(nz(n), 2600, 6000) * env(n, 0.0008, 0.012) * 0.6 + np.sin(2 * np.pi * 1400 * t) * env(n, 0.001, 0.015) * 0.4)
    # slurp: a wet upward gulp and a bubble pop
    d = 0.32; n = ns(d); t = tt(n)
    f = 260 * (3.2 ** (t / d))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 34 * t)) * env(n, 0.006, 0.12)
    y = body * 0.6 + lp(nz(n), 1200) * env(n, 0.004, 0.08) * 0.5
    pop = np.sin(2 * np.pi * np.cumsum(900 * (1.8 ** (tt(ns(0.05)) / 0.05))) / SR) * env(ns(0.05), 0.001, 0.02)
    put(y, pop, 0.2, 0.5)
    S_["slurp"] = y
    # seal: a cork pop, then a three-note glass chime
    n = ns(1.2); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(500 * (2.4 ** (tt(ns(0.08)) / 0.08))) / SR) * env(ns(0.08), 0.001, 0.03), 0, 0.7)
    put(y, bp(nz(ns(0.05)), 2500, 6000) * env(ns(0.05), 0.001, 0.015), 0, 0.4)
    for i, m in enumerate((84, 88, 91)): put(y, i_glock(m, 0.5), 0.07 + i * 0.07, 0.35)
    put(y, hp(nz(ns(0.6)), 6000) * env(ns(0.6), 0.02, 0.25) * 0.2, 0.1, 1.0)
    S_["seal"] = y
    # blocked: a soft bonk
    d = 0.22; n = ns(d); t = tt(n)
    S_["blocked"] = np.sin(2 * np.pi * np.cumsum(170 * (0.65 ** (t / d))) / SR) * env(n, 0.002, 0.07) * 0.7 + lp(nz(n), 500) * env(n, 0.001, 0.03) * 0.4
    # stuck: Prof. Hoot's thoughtful "hmm" — two soft falling notes
    n = ns(1.2); y = np.zeros(n)
    put(y, i_marimba(67, 0.5), 0, 0.5); put(y, i_marimba(62, 0.6), 0.28, 0.5)
    put(y, kglide([300, 280, 250], 0.7, 0.03, 4.0, (1.0, 0.5)) * env(ns(0.7), 0.05, 0.3), 0.05, 0.25)
    S_["stuck"] = y
    # undo: a quick rewind
    d = 0.3; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1300 * (0.35 ** (t / d))) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 40 * t)) * env(n, 0.004, 0.1) * 0.55
    # hint: a magic sparkle up
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91, 95)): put(y, i_glock(m, 0.35), i * 0.055, 0.3)
    put(y, hp(nz(ns(0.7)), 7000) * env(ns(0.7), 0.05, 0.3) * 0.25, 0.05, 1.0)
    S_["hint"] = y
    # win: a bright fanfare on bells and marimba with a shimmer
    n = ns(2.2); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84)): put(y, i_marimba(m, 0.45), i * 0.09, 0.5)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.2), 0.42, 0.18)
    put(y, i_glock(96, 0.6), 0.5, 0.3)
    put(y, hp(nz(ns(1.4)), 5000) * env(ns(1.4), 0.08, 0.6) * 0.3, 0.38, 1.0)
    S_["win"] = y
    # star: a ding
    n = ns(0.8); y = np.zeros(n)
    put(y, i_bell(91, 0.7), 0, 0.5); put(y, i_glock(98, 0.4), 0.03, 0.25)
    S_["star"] = y
    # ---- Phase 2 mechanics
    R = np.random.default_rng(11)

    def sweep(f0, f1, d, a=0.002, dec=0.08):
        m = ns(d); t = tt(m)
        return np.sin(2 * np.pi * np.cumsum(f0 * ((f1 / f0) ** (t / d))) / SR) * env(m, a, dec)

    def click(d=0.012, lo=2500, hi=7000):
        return bp(nz(ns(d)), lo, hi) * env(ns(d), 0.0003, 0.004)
    # pop: a bubble bursting
    n = ns(0.25); y = np.zeros(n)
    put(y, sweep(600, 1900, 0.04, 0.001, 0.02), 0, 0.6); put(y, hp(nz(ns(0.03)), 3000) * env(ns(0.03), 0.0005, 0.008), 0, 0.4)
    put(y, glassy(2637, 0.12, 0.04), 0.02, 0.15)
    S_["pop"] = y
    # break: glass shatters into tinkles
    n = ns(0.7); y = np.zeros(n)
    put(y, hp(nz(ns(0.25)), 2500) * env(ns(0.25), 0.001, 0.07), 0, 0.5)
    for k in range(9): put(y, glassy(float(R.uniform(2200, 5200)), 0.25, float(R.uniform(0.03, 0.08))), float(R.uniform(0.0, 0.32)), float(R.uniform(0.12, 0.25)))
    S_["break"] = y
    # crumble: a bridge tile cracks and falls away
    n = ns(0.8); y = np.zeros(n)
    put(y, lp(nz(ns(0.6)), 700) * env(ns(0.6), 0.01, 0.2), 0, 0.5)
    for k in range(7): put(y, click(0.03, 900, 3000), 0.04 + k * 0.06 + float(R.uniform(0, 0.03)), 0.35 - k * 0.03)
    put(y, sweep(240, 90, 0.35, 0.005, 0.15), 0.15, 0.35)
    S_["crumble"] = y
    # switch: a click and a heavy clunk
    n = ns(0.4); y = np.zeros(n)
    put(y, click(0.012, 2000, 7000), 0, 0.6)
    put(y, sweep(190, 120, 0.12, 0.002, 0.06), 0.03, 0.6); put(y, glassy(880, 0.2, 0.06, 0.5), 0.035, 0.2)
    S_["switch"] = y
    # paint: a wet splash of colour
    n = ns(0.5); y = np.zeros(n)
    put(y, bp(nz(ns(0.3)), 700, 3200) * env(ns(0.3), 0.004, 0.09), 0, 0.5)
    m_ = ns(0.25); t_ = tt(m_)
    put(y, np.sin(2 * np.pi * np.cumsum(900 * (0.35 ** (t_ / 0.25))) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t_)) * env(m_, 0.003, 0.08), 0.01, 0.4)
    put(y, i_glock(88, 0.3), 0.08, 0.15)
    S_["paint"] = y
    # turn: the pad spins the Slurper - a quick rising whirr
    d = 0.38; m_ = ns(d); t_ = tt(m_)
    y = np.sin(2 * np.pi * np.cumsum(300 * (2.4 ** (t_ / d))) / SR) * (0.55 + 0.45 * np.sin(2 * np.pi * 32 * t_)) * env(m_, 0.01, 0.14) * 0.5
    y = np.concatenate([y, np.zeros(ns(0.1))])
    put(y, click(), d - 0.05, 0.4)
    S_["turn"] = y
    # crate: a wooden thud and a short scrape
    n = ns(0.4); y = np.zeros(n)
    put(y, sweep(130, 70, 0.12, 0.001, 0.05), 0, 0.7); put(y, bp(nz(ns(0.05)), 300, 1300) * env(ns(0.05), 0.0005, 0.02), 0, 0.5)
    put(y, bp(nz(ns(0.18)), 600, 2400) * env(ns(0.18), 0.02, 0.06), 0.03, 0.2)
    S_["crate"] = y
    # portal: a warp swoosh and a bright arrival
    n = ns(0.9); y = np.zeros(n)
    m_ = ns(0.45); t_ = tt(m_)
    put(y, np.sin(2 * np.pi * np.cumsum(220 * (7.0 ** (t_ / 0.45)) * (1 + 0.03 * np.sin(2 * np.pi * 9 * t_))) / SR) * env(m_, 0.12, 0.12), 0, 0.35)
    sw_ = hp(nz(ns(0.45)), 3500); put(y, sw_ * np.linspace(0, 1, len(sw_)) ** 2, 0, 0.25)
    put(y, glassy(1760, 0.3, 0.12), 0.42, 0.3); put(y, glassy(2637, 0.3, 0.1), 0.46, 0.2)
    S_["portal"] = y
    # unlock: a key turns (two clicks) and a happy chime
    n = ns(1.0); y = np.zeros(n)
    for tk in (0, 0.07): put(y, click(), tk, 0.5)
    put(y, sweep(260, 180, 0.08, 0.001, 0.04), 0.07, 0.4)
    for k, m in enumerate((79, 84, 88)): put(y, i_glock(m, 0.45), 0.14 + k * 0.08, 0.32)
    S_["unlock"] = y
    # bomb: a soft candy boom with crackle
    n = ns(1.1); y = np.zeros(n)
    put(y, sweep(110, 38, 0.45, 0.002, 0.2), 0, 0.85); put(y, lp(nz(ns(0.4)), 1400) * env(ns(0.4), 0.002, 0.14), 0, 0.6)
    for k in range(10): put(y, hp(nz(ns(0.01)), 4000) * env(ns(0.01), 0.0003, 0.003), 0.08 + float(R.uniform(0, 0.5)), float(R.uniform(0.1, 0.3)))
    S_["bomb"] = y
    # slide: gliding over ice
    d = 0.45; m_ = ns(d); t_ = tt(m_)
    y = bp(nz(m_), 3000, 8000) * env(m_, 0.03, 0.18) * 0.35 + np.sin(2 * np.pi * np.cumsum(1300 * (0.7 ** (t_ / d))) / SR) * env(m_, 0.02, 0.15) * 0.18
    S_["slide"] = y
    # goo: a sticky squelch
    d = 0.32; m_ = ns(d); t_ = tt(m_)
    y = np.sin(2 * np.pi * np.cumsum(150 * (0.6 ** (t_ / d))) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * t_)) * env(m_, 0.006, 0.11) * 0.7
    y = y + lp(nz(m_), 650) * env(m_, 0.004, 0.08) * 0.45
    S_["goo"] = y
    # burnt: a fuse fizzles out with a sad low note
    n = ns(1.3); y = np.zeros(n)
    fz = hp(nz(ns(0.6)), 3000) * env(ns(0.6), 0.005, 0.25); put(y, fz * (0.6 + 0.4 * (R.random(len(fz)) > 0.7)), 0, 0.35)
    put(y, sweep(95, 55, 0.3, 0.002, 0.12), 0.32, 0.6)
    put(y, i_marimba(62, 0.5), 0.36, 0.35); put(y, i_marimba(57, 0.6), 0.62, 0.35)
    S_["burnt"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_slurp_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_slurp.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
