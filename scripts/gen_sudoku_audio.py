"""Sudoku Ninefold sound pack: a calm home theme, one thinking track per board (Mini = pebble kalimba pop, Classic 6x6 =
garden harp stroll, Classic 9x9 = late-night e-piano studio, Giant 16x16 = cosmic bells and choir, Giant 25x25 = a slow
summit horn theme, Killer = sly noir clav, Sudoku X = neon synth arps, Thermo = warm steel-drum ember, Samurai = plucked
koto over taiko), the Daily Classic theme, a driving Speed Blitz track and the brassy Weekly Epic — plus the effects:
tile select tick, the clay "tok" of a placed number (the game re-pitches it per number), pencil note, erase swipe, the
wrong-number bwomp, the row / column / box chime, the solve fanfare, hint sparkle, undo rewind, heart lost, star ding,
board open, clock tick and the streak flare. All original. The game pans every effect to the tile's column.

usage: python scripts/gen_sudoku_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = title, any board music key, music, sfx.   Files: music_sudoku_<key>_<action|calm>, sfx_sudoku_<name>.
Reuses the studio of gen_kiko_audio.py's chain (like gen_slurp_audio.py).
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 173 + 11))
    return {
        "pebble": (114, ["C", "Am", "F", "G"], T_("pebble", 84, "maj"), lambda m, d: i_kalimba(m, 0.45), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.11, 12), bass_pulse(650.0), kit_sleigh, 36, None, lambda m, d: i_marimba(m, 0.35)),
        "garden": (106, ["G", "Em", "C", "D"], T_("garden", 79, "maj"), lambda m, d: i_harp(m, 0.6), stabs(lambda m, d: i_marimba(m, 0.3), (2, 6, 10, 14), 0.12), bass_walk, kit_jungle, 31, lambda m, d: i_strings(m, d, 0.3, False, 2400.0), lambda m, d: i_clarinet(m, d)),
        "studio": (92, ["Dm", "G", "C", "Am"], T_("studio", 74, "dor"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: i_epiano(m - 12, d), (3, 7, 11, 15), 0.1), bass_walk, kit_swing, 38, lambda m, d: i_strings(m, d, 0.22, False, 2000.0), lambda m, d: i_celesta(m, 0.4)),
        "cosmos": (100, ["Am", "Em", "F", "C"], T_("cosmos", 81, "lyd"), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_synthpluck(m, 0.3), (3, 7, 11, 15), 0.11), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.45), lambda m, d: i_celesta(m, 0.5)),
        "summit": (96, ["C", "G", "Am", "F", "Dm", "G", "C", "G"], T_("summit", 72, "maj"), lambda m, d: mono(i_horn(m - 12, d)), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.11), bass_pulse(700.0), kit_march, 36, lambda m, d: i_strings(m, d, 0.32, False, 2800.0), lambda m, d: i_bell(m, 0.6)),
        "noir": (104, ["Am", "Dm", "E", "Am"], T_("noir", 69, "hmin"), lambda m, d: mono(i_clav(m, d)), stabs(lambda m, d: i_epiano(m, d), (2, 6, 10, 14), 0.11), bass_walk, kit_swing, 33, lambda m, d: i_choir(m, d, 0.35), lambda m, d: i_bell(m, 0.5)),
        "neon": (124, ["Em", "C", "G", "D"], T_("neon", 76, "min"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_pluck(m, 0.3, 7000.0, 500.0, 0.06, 0.2), (2, 6, 10, 14), 0.12), bass_reese, kit_edm, 28, lambda m, d: i_strings(m, d, 0.25, False, 3600.0), lambda m, d: mono(i_lead(m, d, None, 3800.0))),
        "ember": (116, ["F", "Bb", "C", "F"], T_("ember", 77, "mix"), lambda m, d: i_steel(m, 0.45), stabs(lambda m, d: i_marimba(m - 12, 0.3), (2, 5, 10, 13), 0.13), bass_walk, kit_tribal, 29, None, lambda m, d: i_kalimba(m, 0.35)),
        "dojo": (98, ["Am", "F", "G", "Em"], T_("dojo", 69, "pent"), lambda m, d: i_pluck(m, 0.45, 5200.0, 420.0, 0.08, 0.35), stabs(lambda m, d: i_pluck(m - 12, 0.3, 3800.0, 380.0, 0.07, 0.3), (3, 7, 11, 15), 0.11), bass_sub, kit_tribal, 33, lambda m, d: i_strings(m, d, 0.22, False, 2200.0), lambda m, d: i_bell(m, 0.6)),
        "daily": (110, ["D", "Bm", "G", "A"], T_("daily", 74, "maj"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(800.0), kit_sleigh, 38, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: i_marimba(m, 0.4)),
        "blitz": (140, ["Am", "F", "C", "G"], T_("blitz", 81, "hmin"), lambda m, d: mono(i_lead(m, d, None, 5200.0)), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.13), bass_reese, kit_rock, 33, lambda m, d: i_choir(m, d, 0.3), lambda m, d: i_bell(m, 0.5)),
        "epic": (122, ["C", "G", "Am", "F", "Dm", "G", "Em", "G"], T_("epic", 84, "maj"), lambda m, d: mono(i_brass(m - 12, d, False, 2800.0)), stabs(lambda m, d: i_bell(m, 0.4), (2, 6, 10, 14), 0.1), bass_pulse(900.0), kit_rock, 36, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_trumpet(m - 12, d))),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["F", "Am", "Dm", "C", "F", "Am", "Bb", "C"]
    hook = notes(tune(77, "lyd", 9019))
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
        S = Song(f"sudoku_{key}_{v}", bpm, bars, rt, sw)
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

    # select: a tiny wooden tick
    n = ns(0.06); t = tt(n)
    S_["select"] = bp(nz(n), 2200, 5200) * env(n, 0.0008, 0.01) * 0.5 + np.sin(2 * np.pi * 1600 * t) * env(n, 0.001, 0.012) * 0.35
    # place: the clay tok at C5 (the game re-pitches it to each number's note)
    S_["place"] = clay_tok(72)
    # note: a pencil scratch
    d = 0.12; n = ns(d)
    S_["note"] = bp(nz(n), 3500, 9000) * env(n, 0.005, 0.05) * (0.6 + 0.4 * np.sin(2 * np.pi * 60 * tt(n))) * 0.5
    # erase: a soft rubber swipe down
    d = 0.22; n = ns(d); t = tt(n)
    S_["erase"] = bp(nz(n), 900, 3200) * env(n, 0.01, 0.09) * 0.45 + np.sin(2 * np.pi * np.cumsum(700 * (0.6 ** (t / d))) / SR) * env(n, 0.005, 0.07) * 0.2
    # wrong: a low clay bwomp with a short buzz
    d = 0.42; n = ns(d); t = tt(n)
    y = np.sin(2 * np.pi * np.cumsum(220 * (0.55 ** (t / d))) / SR) * env(n, 0.004, 0.16) * 0.7
    y = y + np.sign(np.sin(2 * np.pi * 110 * t)) * env(n, 0.004, 0.06) * 0.08
    S_["wrong"] = y
    # unit: a three-note glass chime up (row / column / box complete)
    n = ns(1.1); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91)): put(y, glassy(440 * 2 ** ((m - 69) / 12), 0.6, 0.25), i * 0.06, 0.32)
    put(y, hp(nz(ns(0.5)), 6500) * env(ns(0.5), 0.02, 0.2) * 0.18, 0.05, 1.0)
    S_["unit"] = y
    # solve: a bright fanfare — marimba run, bells, a shimmer
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.45), i * 0.08, 0.5)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.4), 0.45, 0.18)
    for k, m in enumerate((79, 84, 88, 91)): put(y, i_glock(m, 0.45), 0.5 + k * 0.09, 0.3)
    put(y, hp(nz(ns(1.2)), 6000) * env(ns(1.2), 0.05, 0.5) * 0.22, 0.4, 1.0)
    S_["solve"] = y
    # hint: a magic sparkle up
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91, 95)): put(y, i_glock(m, 0.35), i * 0.055, 0.3)
    put(y, hp(nz(ns(0.7)), 7000) * env(ns(0.7), 0.05, 0.3) * 0.25, 0.05, 1.0)
    S_["hint"] = y
    # undo: a quick rewind
    d = 0.3; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1300 * (0.35 ** (t / d))) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 40 * t)) * env(n, 0.004, 0.1) * 0.55
    # heart: two soft falling notes and a low thump
    n = ns(1.2); y = np.zeros(n)
    put(y, i_marimba(67, 0.5), 0, 0.5); put(y, i_marimba(60, 0.7), 0.24, 0.5)
    put(y, np.sin(2 * np.pi * np.cumsum(90 * (0.5 ** (tt(ns(0.3)) / 0.3))) / SR) * env(ns(0.3), 0.002, 0.12), 0.24, 0.5)
    S_["heart"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # open: a soft whoosh into a pop
    d = 0.5; n = ns(d); t = tt(n)
    y = bp(nz(n), 500, 4000) * env(n, 0.15, 0.12) * 0.35
    put(y, clay_tok(79), 0.18, 0.6)
    S_["open"] = y
    # tick: a clock tick for the last seconds of the Blitz
    n = ns(0.08); t = tt(n)
    S_["tick"] = np.sin(2 * np.pi * 2400 * t) * env(n, 0.0005, 0.012) * 0.5 + bp(nz(n), 3000, 7000) * env(n, 0.0005, 0.006) * 0.4
    # streak: a flame whoosh and a major chord
    n = ns(1.4); y = np.zeros(n)
    put(y, bp(nz(ns(0.6)), 400, 3000) * env(ns(0.6), 0.2, 0.2) * 0.4, 0, 1.0)
    for m in (72, 76, 79, 84): put(y, i_bell(m, 1.0), 0.32, 0.16)
    S_["streak"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_sudoku_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_sudoku.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
