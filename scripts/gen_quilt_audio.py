"""Quiltfold sound pack: a cosy home theme, one track per quilt kind (Classic = kalimba fireside, Shape Hints = craft-
table marimba, Squares Only = toy-piano checkers, Ribbons = flowing harp, Holey Quilt = window-light celesta, Mystery
Marks = sly e-piano, No Twins = accordion dance, Fences = farmhouse clarinet, Giant Quilt = a warm string-and-horn
theme) and the Daily Quilt theme, plus the effects: the soft felt "lay" of a patch (re-pitched by its size), the
stitched chime of a patch that fits, the lift, a blocked bump, the quilt-complete fanfare, hint sparkle, undo, reset
swoosh, select, star, open and streak. All original. The game pans every effect to the patch's column.

usage: python scripts/gen_quilt_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_quilt_<key>_<action|calm>, sfx_quilt_<name>.
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
          "mix": [0, 2, 4, 5, 7, 9, 10], "hmin": [0, 2, 3, 5, 7, 8, 11], "pent": [0, 2, 3, 7, 8]}


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
def board_styles():
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 211 + 37))
    return {
        "cozy": (96, ["F", "C", "Dm", "Bb"], T_("cozy", 77, "maj"), lambda m, d: i_kalimba(m, 0.5), stabs(lambda m, d: i_marimba(m - 12, 0.3), (2, 6, 10, 14), 0.11), bass_walk, kit_rain, 29, lambda m, d: i_strings(m, d, 0.25, False, 2200.0), lambda m, d: i_musicbox(m, 0.45)),
        "craft": (108, ["G", "Em", "C", "D"], T_("craft", 79, "maj"), lambda m, d: i_marimba(m, 0.45), stabs(lambda m, d: i_xylo(m, 0.25), (2, 6, 10, 14), 0.12), bass_pulse(700.0), kit_jungle, 31, None, lambda m, d: i_kalimba(m, 0.35)),
        "checker": (116, ["C", "Am", "F", "G"], T_("checker", 84, "maj"), lambda m, d: i_toypiano(m, 0.4), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.11, 12), bass_chip, kit_chip, 36, None, lambda m, d: i_xylo(m, 0.25)),
        "ribbon": (100, ["D", "A", "Bm", "G"], T_("ribbon", 74, "lyd"), lambda m, d: i_harp(m, 0.6), stabs(lambda m, d: i_celesta(m, 0.4), (3, 7, 11, 15), 0.1), bass_sub, kit_rain, 38, lambda m, d: i_strings(m, d, 0.3, False, 2600.0), lambda m, d: i_clarinet(m, d)),
        "window": (94, ["Bb", "Gm", "Eb", "F"], T_("window", 82, "lyd"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.1), bass_sub, kit_sleigh, 34, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.6)),
        "mystery": (104, ["Am", "Dm", "E", "Am"], T_("mystery", 69, "hmin"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: mono(i_clav(m, d)), (2, 6, 10, 14), 0.11), bass_walk, kit_swing, 33, lambda m, d: i_choir(m, d, 0.35), lambda m, d: i_bell(m, 0.5)),
        "dance": (122, ["Bb", "Gm", "Eb", "F"], T_("dance", 82, "maj"), lambda m, d: mono(i_accordion(m - 12, d)), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.12), bass_oompah, kit_march, 34, None, lambda m, d: i_clarinet(m, d)),
        "farm": (110, ["G", "C", "D", "G"], T_("farm", 79, "mix"), lambda m, d: i_clarinet(m, d), stabs(lambda m, d: i_pluck(m, 0.3, 5000.0, 450.0, 0.06, 0.25), (2, 6, 10, 14), 0.12), bass_oompah, kit_gallop, 31, None, lambda m, d: i_marimba(m, 0.35)),
        "grand": (98, ["C", "G", "Am", "F", "Dm", "G", "C", "G"], T_("grand", 72, "maj"), lambda m, d: mono(i_horn(m - 12, d)), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.11), bass_pulse(700.0), kit_march, 36, lambda m, d: i_strings(m, d, 0.32, False, 2800.0), lambda m, d: i_bell(m, 0.6)),
        "daily": (112, ["A", "F#m", "D", "E"], T_("daily", 81, "maj"), lambda m, d: i_glock(m, 0.45), stabs(lambda m, d: i_marimba(m, 0.3), (2, 6, 10, 14), 0.1), bass_pulse(800.0), kit_sleigh, 33, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: i_kalimba(m, 0.4)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["F", "Am", "Bb", "C", "F", "Dm", "Bb", "C"]
    hook = notes(tune(77, "maj", 6113))
    for bar, c in enumerate(prog):
        r = root(c, 36)
        for st_ in (0, 6, 8, 14): S.put("music", i_marimba(r + 24 + (st_ // 6 % 2) * 7, 0.3), S.T(bar, st_), 0.1, 0.2, 0.15)
        for m in vc(c, 55): S.put("music", i_strings(m, S.st * 15, 0.5, False, 2400.0), S.T(bar, 0), 0.07, 0, 0.3)
        S.put("music", i_bass(r, S.st * 6, 600.0, 0.12, 0.6, 1.2), S.T(bar, 0), 0.2, 0, 0)
        if bar % 2: S.put("drums", k_shaker(), S.T(bar, 6), 0.07, -0.3)
    S.seq("music", i_musicbox, hook, 0, 0.26, 0.1, 0.3, 0.15)


SPECS = board_styles()
for key, spec in SPECS.items():
    style(key, spec[0], 16, spec[0], 16, 1.3, 1.3, sc=(0.04, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(make_style(spec))
style("title", 92, 8, 92, 8, 1.6, 1.6, sc=(0.0, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(-2.0, 0.0, -2.0))(st_title)


def run_music():
    for key, spec in STYLES.items():
        act = key != "title"
        v = "action" if act else "calm"
        if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
        bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
        S = Song(f"quilt_{key}_{v}", bpm, bars, rt, sw)
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

    def clay_tok(m, dec=0.12):
        # a soft clay knock: a short marimba body plus a muffled thud
        n = ns(0.35); y = np.zeros(n)
        put(y, i_marimba(m, 0.3), 0, 0.55)
        put(y, lp(nz(ns(0.05)), 900) * env(ns(0.05), 0.001, 0.015), 0, 0.35)
        put(y, np.sin(2 * np.pi * np.cumsum(180 * (0.7 ** (tt(ns(0.08)) / 0.08))) / SR) * env(ns(0.08), 0.001, 0.03), 0, 0.3)
        return y

    def pluck(m, dec=0.25, bright=6000.0):
        return mono(i_pluck(m, dec, bright, 500.0, 0.05, 0.25))

    # lay: a soft felt thump with a woody tick (re-pitched by the patch size in game)
    n = ns(0.4); y = np.zeros(n)
    put(y, lp(nz(ns(0.12)), 900) * env(ns(0.12), 0.003, 0.04), 0, 0.55)
    put(y, np.sin(2 * np.pi * np.cumsum(220 * (0.75 ** (tt(ns(0.12)) / 0.12))) / SR) * env(ns(0.12), 0.002, 0.05), 0, 0.4)
    put(y, i_marimba(72, 0.25), 0.01, 0.3)
    S_["lay"] = y
    # good: the stitch zip and a warm two-note chime when a patch fits
    n = ns(1.0); y = np.zeros(n)
    zipd = 0.14; zn = ns(zipd)
    put(y, bp(nz(zn), 2500, 7000) * env(zn, 0.005, 0.05) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 70 * tt(zn)))), 0, 0.3)
    put(y, i_marimba(72, 0.4), 0.05, 0.45); put(y, glassy(1046.5, 0.6, 0.22), 0.11, 0.25)
    S_["good"] = y
    # lift: a quick pull-off (fabric swish up)
    d = 0.2; n = ns(d); t = tt(n)
    S_["lift"] = bp(nz(n), 1200, 5000) * env(n, 0.01, 0.07) * 0.4 + np.sin(2 * np.pi * np.cumsum(500 * (1.8 ** (t / d))) / SR) * env(n, 0.004, 0.06) * 0.2
    # bump: a soft muted thud for a blocked cut
    d = 0.2; n = ns(d); t = tt(n)
    S_["bump"] = np.sin(2 * np.pi * np.cumsum(160 * (0.7 ** (t / d))) / SR) * env(n, 0.002, 0.06) * 0.6 + lp(nz(n), 600) * env(n, 0.001, 0.02) * 0.3
    # solve: a cosy fanfare — marimba run, music-box bells, a shimmer
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.45), i * 0.08, 0.5)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.4), 0.45, 0.17)
    for k, m in enumerate((79, 84, 88, 91)): put(y, i_glock(m, 0.45), 0.5 + k * 0.09, 0.28)
    put(y, hp(nz(ns(1.2)), 6000) * env(ns(1.2), 0.05, 0.5) * 0.2, 0.4, 1.0)
    S_["solve"] = y
    # hint: a sparkle up
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91, 95)): put(y, i_glock(m, 0.35), i * 0.055, 0.3)
    S_["hint"] = y
    # undo: a quick rewind
    d = 0.28; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1300 * (0.4 ** (t / d))) / SR) * env(n, 0.004, 0.1) * 0.5
    # reset: an airy swoosh down
    d = 0.5; n = ns(d); t = tt(n)
    S_["reset"] = bp(nz(n), 600, 5000) * env(n, 0.05, 0.2) * 0.4 + np.sin(2 * np.pi * np.cumsum(700 * (0.5 ** (t / d))) / SR) * env(n, 0.01, 0.15) * 0.15
    # select: a soft tap
    n = ns(0.12); t = tt(n)
    S_["select"] = np.sin(2 * np.pi * 1200 * t) * env(n, 0.001, 0.03) * 0.4 + bp(nz(n), 2500, 6000) * env(n, 0.0005, 0.008) * 0.3
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # open: a whoosh into a pluck
    d = 0.5; n = ns(d)
    y = bp(nz(n), 500, 4000) * env(n, 0.15, 0.12) * 0.35
    put(y, pluck(79, 0.3), 0.18, 0.5)
    S_["open"] = y
    # streak: a whoosh and a major chord
    n = ns(1.4); y = np.zeros(n)
    put(y, bp(nz(ns(0.6)), 400, 3000) * env(ns(0.6), 0.2, 0.2) * 0.4, 0, 1.0)
    for m in (72, 76, 79, 84): put(y, i_bell(m, 1.0), 0.32, 0.16)
    S_["streak"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_quilt_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_quilt.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
