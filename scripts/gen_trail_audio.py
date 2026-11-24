"""Trailfold sound pack: a bright home theme, one track per trail kind (Classic = gliding synth-pop, Wall Maze = plucked
maze groove, Island Hop = steel-drum breeze, Eight Ways = shimmering prism bells, Arrow Lanes = driving marimba,
Bends & Straights = funky clav, Wrap Around = orbiting space lead, Twin Trails = two-voice kalimba duet, Mega Trail = a
big summit horn theme) and the Daily Trail theme, plus the effects: the step pluck (re-pitched up a pentatonic ladder
as the line grows), the stop chime, step-back tick, blocked bump, the trail-complete fanfare, hint sparkle, undo,
reset swoosh, select, star, open and streak. All original. The game pans every effect to the cell's column.

usage: python scripts/gen_trail_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_trail_<key>_<action|calm>, sfx_trail_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 191 + 29))
    return {
        "glide": (118, ["C", "G", "Am", "F"], T_("glide", 84, "maj"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.11, 12), bass_pulse(800.0), kit_edm, 36, lambda m, d: i_strings(m, d, 0.25, False, 3200.0), lambda m, d: i_bell(m, 0.5)),
        "maze": (108, ["Dm", "Am", "Bb", "C"], T_("maze", 74, "dor"), lambda m, d: i_pluck(m, 0.35, 5600.0, 480.0, 0.06, 0.25), stabs(lambda m, d: i_marimba(m, 0.3), (3, 6, 11, 14), 0.12), bass_walk, kit_tribal, 31, lambda m, d: i_strings(m, d, 0.25, False, 2400.0), lambda m, d: i_epiano(m, d)),
        "island": (112, ["D", "Bm", "G", "A"], T_("island", 74, "lyd"), lambda m, d: i_steel(m, 0.45), stabs(lambda m, d: i_marimba(m - 12, 0.3), (2, 5, 10, 13), 0.13), bass_walk, kit_jungle, 38, None, lambda m, d: i_kalimba(m, 0.35)),
        "prism": (104, ["Em", "C", "G", "D"], T_("prism", 76, "lyd"), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_synthpluck(m, 0.3), (3, 7, 11, 15), 0.11), bass_sub, kit_rain, 28, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_celesta(m, 0.5)),
        "arrow": (126, ["A", "F#m", "D", "E"], T_("arrow", 81, "mix"), lambda m, d: i_marimba(m, 0.45), stabs(lambda m, d: i_xylo(m, 0.25), (2, 6, 10, 14), 0.12), bass_pulse(900.0), kit_rock, 33, None, lambda m, d: i_toypiano(m, 0.3)),
        "bends": (110, ["Gm", "C", "Gm", "D"], T_("bends", 79, "dor"), lambda m, d: mono(i_clav(m, d)), stabs(lambda m, d: i_epiano(m, d), (2, 6, 10, 14), 0.11), bass_walk, kit_swing, 31, None, lambda m, d: i_bell(m, 0.5)),
        "orbit": (100, ["Am", "Em", "F", "C"], T_("orbit", 81, "min"), lambda m, d: mono(i_lead(m, d, None, 3200.0, 0.02)), stabs(lambda m, d: i_synthpluck(m, 0.3), (3, 7, 11, 15), 0.11), bass_reese, kit_edm, 33, lambda m, d: i_choir(m, d, 0.45), lambda m, d: i_bell(m, 0.6)),
        "twin": (114, ["F", "Dm", "Bb", "C"], T_("twin", 77, "maj"), lambda m, d: i_kalimba(m, 0.45), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.11, 12), bass_pulse(700.0), kit_sleigh, 29, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_marimba(m, 0.4)),
        "summit": (98, ["C", "G", "Am", "F", "Dm", "G", "C", "G"], T_("summit", 72, "maj"), lambda m, d: mono(i_horn(m - 12, d)), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.11), bass_pulse(700.0), kit_march, 36, lambda m, d: i_strings(m, d, 0.32, False, 2800.0), lambda m, d: i_bell(m, 0.6)),
        "daily": (116, ["E", "C#m", "A", "B"], T_("daily", 76, "maj"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(800.0), kit_sleigh, 40, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: i_marimba(m, 0.4)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["G", "D", "Em", "C", "G", "D", "C", "D"]
    hook = notes(tune(79, "maj", 4417))
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
        S = Song(f"trail_{key}_{v}", bpm, bars, rt, sw)
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

    # step: a soft glassy pluck at C5 (the game re-pitches it up a pentatonic ladder as the line grows)
    n = ns(0.4); y = np.zeros(n)
    put(y, pluck(72, 0.3), 0, 0.5); put(y, glassy(523.25, 0.25, 0.06, 0.6), 0, 0.18)
    S_["step"] = y
    # stop: a bright two-note chime when the line reaches a number
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1046.5, 0.8, 0.3), 0, 0.4); put(y, glassy(1568.0, 0.7, 0.25), 0.07, 0.3)
    put(y, hp(nz(ns(0.4)), 6500) * env(ns(0.4), 0.01, 0.15) * 0.15, 0.02, 1.0)
    S_["stop"] = y
    # back: a tiny downward tick
    d = 0.09; n = ns(d); t = tt(n)
    S_["back"] = np.sin(2 * np.pi * np.cumsum(900 * (0.6 ** (t / d))) / SR) * env(n, 0.001, 0.03) * 0.5
    # bump: a soft muted thud for a blocked move
    d = 0.2; n = ns(d); t = tt(n)
    S_["bump"] = np.sin(2 * np.pi * np.cumsum(160 * (0.7 ** (t / d))) / SR) * env(n, 0.002, 0.06) * 0.6 + lp(nz(n), 600) * env(n, 0.001, 0.02) * 0.3
    # solve: a rising glide of plucks into bells and a shimmer
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 74, 76, 79, 81, 84, 88)): put(y, pluck(m, 0.4), i * 0.06, 0.4)
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
        write_wav(f"sfx_trail_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_trail.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
