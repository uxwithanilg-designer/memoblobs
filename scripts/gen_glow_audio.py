"""Glowfold sound pack: a night-drive home theme, one synthwave track per kind (Classic = neon arps, Pure Balance =
pulsing bass, Sign Language = circuit plucks, Glow Boxes = grid groove, Diagonal Rule = laser leads, Wrap Around =
orbiting pads, Trio = prism bells, No Squares = arcade chiptune, Grand Glow = a big skyline anthem) and the Daily Glow
theme, plus the effects: the warm Ember whoosh-pop, the icy Frost chime, the Bloom pluck, clear, the rule-break buzz,
the line-complete sweep, the solve fanfare, hint sparkle, undo, reset, star, open and streak. All original. The game
pans every effect to the cell's column.

usage: python scripts/gen_glow_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_glow_<key>_<action|calm>, sfx_glow_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 227 + 41))
    return {
        "neon": (112, ["Am", "F", "C", "G"], T_("neon", 81, "min"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_synthpluck(m - 12, 0.3), (2, 6, 10, 14), 0.12), bass_reese, kit_edm, 33, lambda m, d: i_strings(m, d, 0.25, False, 3400.0), lambda m, d: mono(i_lead(m, d, None, 3600.0))),
        "pulse": (118, ["Em", "C", "G", "D"], T_("pulse", 76, "dor"), lambda m, d: mono(i_lead(m, d, None, 3000.0, 0.02)), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.12), bass_pulse(1000.0), kit_edm, 28, lambda m, d: i_choir(m, d, 0.35), lambda m, d: i_bell(m, 0.5)),
        "circuit": (124, ["Dm", "Bb", "C", "A"], T_("circuit", 74, "hmin"), lambda m, d: i_pluck(m, 0.3, 7000.0, 500.0, 0.05, 0.2), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.12), bass_reese, kit_rock, 33, None, lambda m, d: mono(i_lead(m, d, None, 4200.0))),
        "grid": (116, ["Gm", "Eb", "Bb", "F"], T_("grid", 79, "dor"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: i_synthpluck(m, 0.3), (3, 7, 11, 15), 0.11), bass_pulse(900.0), kit_edm, 31, lambda m, d: i_strings(m, d, 0.25, False, 3000.0), lambda m, d: i_bell(m, 0.5)),
        "laser": (128, ["Bm", "G", "D", "A"], T_("laser", 83, "min"), lambda m, d: mono(i_lead(m, d, None, 5200.0)), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.13), bass_reese, kit_rock, 35, lambda m, d: i_choir(m, d, 0.3), lambda m, d: i_bell(m, 0.5)),
        "orbit": (100, ["Am", "Em", "F", "C"], T_("orbit", 81, "lyd"), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_synthpluck(m, 0.3), (3, 7, 11, 15), 0.11), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.45), lambda m, d: i_celesta(m, 0.5)),
        "prism": (108, ["C", "Am", "F", "G"], T_("prism", 84, "lyd"), lambda m, d: i_glock(m, 0.45), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_sub, kit_edm, 36, lambda m, d: i_strings(m, d, 0.3, False, 3400.0), lambda m, d: i_bell(m, 0.6)),
        "arcade": (132, ["C", "G", "Am", "F"], T_("arcade", 84, "maj"), lambda m, d: mono(i_chip(m, d, 0.25)), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.12), bass_chip, kit_chip, 36, None, lambda m, d: mono(i_lead(m, d, None, 3800.0))),
        "skyline": (120, ["C", "G", "Am", "F", "Dm", "G", "Em", "G"], T_("skyline", 84, "maj"), lambda m, d: mono(i_lead(m, d, None, 4400.0, 0.02)), stabs(lambda m, d: i_synthpluck(m, 0.3), (2, 6, 10, 14), 0.1), bass_pulse(1000.0), kit_edm, 36, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_brass(m - 12, d, False, 3000.0))),
        "daily": (114, ["F", "Dm", "Bb", "C"], T_("daily", 77, "maj"), lambda m, d: i_synthpluck(m, 0.45), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(800.0), kit_edm, 29, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: i_bell(m, 0.5)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["Am", "F", "C", "G", "Am", "F", "Dm", "E"]
    hook = notes(tune(81, "min", 7321))
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
        S = Song(f"glow_{key}_{v}", bpm, bars, rt, sw)
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

    # ember: a warm whoosh into a soft pop
    n = ns(0.45); y = np.zeros(n)
    put(y, bp(nz(ns(0.18)), 400, 2600) * env(ns(0.18), 0.04, 0.08) * 0.5, 0, 1.0)
    put(y, np.sin(2 * np.pi * np.cumsum(300 * (1.6 ** (tt(ns(0.12)) / 0.12))) / SR) * env(ns(0.12), 0.002, 0.05), 0.08, 0.45)
    put(y, mono(i_synthpluck(67, 0.3)), 0.09, 0.35)
    S_["ember"] = y
    # frost: an icy two-note chime
    n = ns(0.8); y = np.zeros(n)
    put(y, glassy(1318.5, 0.6, 0.22), 0, 0.4); put(y, glassy(1975.5, 0.5, 0.18), 0.05, 0.25)
    put(y, hp(nz(ns(0.3)), 7000) * env(ns(0.3), 0.005, 0.1) * 0.12, 0, 1.0)
    S_["frost"] = y
    # bloom: a green leafy pluck
    n = ns(0.6); y = np.zeros(n)
    put(y, mono(i_pluck(76, 0.35, 5000.0, 480.0, 0.06, 0.3)), 0, 0.5); put(y, i_marimba(83, 0.3), 0.04, 0.25)
    S_["bloom"] = y
    # clear: a tiny reverse tick
    d = 0.1; n = ns(d); t = tt(n)
    S_["clear"] = np.sin(2 * np.pi * np.cumsum(1100 * (0.6 ** (t / d))) / SR) * env(n, 0.001, 0.03) * 0.45
    # bad: a soft synth buzz for a broken rule
    d = 0.3; n = ns(d); t = tt(n)
    S_["bad"] = (np.sign(np.sin(2 * np.pi * 140 * t)) * 0.25 + np.sin(2 * np.pi * 70 * t) * 0.5) * env(n, 0.005, 0.1) * 0.6
    # line: a bright upward sweep when a row or column is finished
    n = ns(0.9); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91)): put(y, mono(i_synthpluck(m, 0.3)), i * 0.045, 0.3)
    put(y, hp(nz(ns(0.4)), 6000) * env(ns(0.4), 0.02, 0.15) * 0.15, 0.05, 1.0)
    S_["line"] = y
    # solve: a neon fanfare — synth run, bells, shimmer
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88, 91)): put(y, mono(i_synthpluck(m, 0.4)), i * 0.07, 0.4)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.4), 0.45, 0.17)
    put(y, hp(nz(ns(1.2)), 6000) * env(ns(1.2), 0.05, 0.5) * 0.22, 0.4, 1.0)
    S_["solve"] = y
    # hint: a sparkle up
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91, 95)): put(y, i_glock(m, 0.35), i * 0.055, 0.3)
    S_["hint"] = y
    # undo: a quick rewind
    d = 0.28; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1300 * (0.4 ** (t / d))) / SR) * env(n, 0.004, 0.1) * 0.5
    # reset: a downward synth swoosh
    d = 0.5; n = ns(d); t = tt(n)
    S_["reset"] = bp(nz(n), 600, 5000) * env(n, 0.05, 0.2) * 0.4 + np.sin(2 * np.pi * np.cumsum(700 * (0.5 ** (t / d))) / SR) * env(n, 0.01, 0.15) * 0.15
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # open: a whoosh into a pluck
    d = 0.5; n = ns(d)
    y = bp(nz(n), 500, 4000) * env(n, 0.15, 0.12) * 0.35
    put(y, mono(i_synthpluck(79, 0.3)), 0.18, 0.5)
    S_["open"] = y
    # streak: a whoosh and a major chord
    n = ns(1.4); y = np.zeros(n)
    put(y, bp(nz(ns(0.6)), 400, 3000) * env(ns(0.6), 0.2, 0.2) * 0.4, 0, 1.0)
    for m in (72, 76, 79, 84): put(y, i_bell(m, 1.0), 0.32, 0.16)
    S_["streak"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_glow_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_glow.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
