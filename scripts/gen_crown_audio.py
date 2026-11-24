"""Crownfold sound pack: a candle-lit royal home theme, one track per kind (Classic Court = a harpsichord-style court
dance, Twin Crowns = a ballroom waltz feel, Diagonal Watch = chapel bells, Knight's Rule = a galloping ride, Rubble =
old ruins, Watchtowers = a night watch march, Wrap Around = a turning carousel, Compass = a sea voyage, Grand Court =
a full brass anthem) and the Daily Court theme, plus the effects: the crown chime, the × mark tap, clear, the
rule-break buzz, the court-complete fanfare, the solve fanfare, hint sparkle, undo, reset, star, open and streak.
All original. The game pans every effect to the square's column.

usage: python scripts/gen_crown_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_crown_<key>_<action|calm>, sfx_crown_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 311 + 17))
    harpsi = lambda m, d: i_pluck(m, 0.3, 9000.0, 900.0, 0.04, 0.22)
    return {
        "court": (104, ["C", "G", "Am", "F", "Dm", "G", "C", "G"], T_("court", 84, "maj"), harpsi, stabs(lambda m, d: i_pluck(m - 12, 0.2, 7000.0, 700.0, 0.04, 0.15), (2, 6, 10, 14), 0.1), bass_walk, kit_rain, 36, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: mono(i_piccolo(m, d))),
        "waltz": (96, ["F", "C", "Dm", "Bb", "F", "C", "Bb", "C"], T_("waltz", 77, "maj"), lambda m, d: i_strings(m, d, 0.06, False, 4200.0), stabs(lambda m, d: i_harp(m, 0.4), (4, 6, 12, 14), 0.12), bass_sub, kit_rain, 29, lambda m, d: i_strings(m, d, 0.4, False, 2600.0), lambda m, d: i_celesta(m, 0.5)),
        "bishop": (88, ["Dm", "Bb", "F", "C"], T_("bishop", 74, "dor"), lambda m, d: i_bell(m, 0.9), stabs(lambda m, d: i_choir(m, 0.6, 0.1), (0, 8), 0.08), bass_sub, kit_rain, 26, lambda m, d: i_choir(m, d, 0.4), lambda m, d: mono(i_clarinet(m, d))),
        "gallop": (132, ["Em", "C", "D", "B"], T_("gallop", 76, "hmin"), lambda m, d: mono(i_trumpet(m, d)), stabs(lambda m, d: i_strings(m, 0.12, 0.01, True, 4000.0), (2, 6, 10, 14), 0.12), bass_oompah, kit_gallop, 28, lambda m, d: i_strings(m, d, 0.25, False, 3000.0), lambda m, d: mono(i_horn(m, 0.4))),
        "ruins": (92, ["Am", "Dm", "E", "Am"], T_("ruins", 81, "hmin"), lambda m, d: i_harp(m, 0.7), stabs(lambda m, d: i_kalimba(m, 0.4), (3, 7, 11, 15), 0.1), bass_sub, kit_tribal, 33, lambda m, d: i_choir(m, d, 0.45), lambda m, d: mono(i_clarinet(m, d))),
        "watch": (112, ["Gm", "Eb", "Bb", "F"], T_("watch", 79, "min"), lambda m, d: mono(i_horn(m, 0.5)), stabs(lambda m, d: i_strings(m, 0.15, 0.01, True, 3600.0), (2, 6, 10, 14), 0.11), bass_oompah, kit_march, 31, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_glock(m, 0.4)),
        "orbit": (116, ["C", "Am", "F", "G"], T_("orbit", 84, "lyd"), lambda m, d: i_musicbox(m, 0.6), stabs(lambda m, d: i_accordion(m, 0.15), (2, 6, 10, 14), 0.1), bass_oompah, kit_rain, 36, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: i_celesta(m, 0.5)),
        "voyage": (100, ["D", "Bm", "G", "A"], T_("voyage", 74, "mix"), lambda m, d: mono(i_accordion(m, d)), stabs(lambda m, d: i_gtr(m, 0.2, True), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 26, lambda m, d: i_strings(m, d, 0.35, False, 2800.0), lambda m, d: mono(i_piccolo(m, d))),
        "anthem": (108, ["C", "G", "Am", "F", "C", "F", "G", "G"], T_("anthem", 84, "maj"), lambda m, d: mono(i_brass(m, d, False, 3400.0)), stabs(lambda m, d: i_strings(m, 0.15, 0.01, True, 4000.0), (2, 6, 10, 14), 0.12), bass_oompah, kit_march, 36, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_trumpet(m, d))),
        "daily": (110, ["G", "Em", "C", "D"], T_("daily", 79, "maj"), harpsi, stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_walk, kit_rain, 31, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: mono(i_trumpet(m, d))),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["G", "Em", "C", "D", "G", "Em", "Am", "D"]
    hook = notes(tune(79, "maj", 2611))
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
        S = Song(f"crown_{key}_{v}", bpm, bars, rt, sw)
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

    # crown: a bright regal chime — harp pluck, bell and a little gold shimmer
    n = ns(0.9); y = np.zeros(n)
    put(y, mono(i_harp(79, 0.5)), 0, 0.4); put(y, i_bell(91, 0.7), 0.02, 0.22); put(y, glassy(2093, 0.4, 0.12), 0.03, 0.12)
    put(y, hp(nz(ns(0.25)), 8000) * env(ns(0.25), 0.005, 0.08) * 0.08, 0, 1.0)
    S_["crown"] = y
    # mark: a soft wooden tap
    n = ns(0.2); y = np.zeros(n)
    put(y, i_marimba(72, 0.12), 0, 0.35); put(y, lp(nz(ns(0.03)), 1800) * env(ns(0.03), 0.001, 0.01), 0, 0.25)
    S_["mark"] = y
    # clear: a tiny reverse tick
    d = 0.1; n = ns(d); t = tt(n)
    S_["clear"] = np.sin(2 * np.pi * np.cumsum(1000 * (0.6 ** (t / d))) / SR) * env(n, 0.001, 0.03) * 0.4
    # bad: a low lute twang and buzz
    d = 0.32; n = ns(d); t = tt(n)
    S_["bad"] = (np.sign(np.sin(2 * np.pi * 123 * t)) * 0.2 + np.sin(2 * np.pi * 61.5 * t) * 0.5) * env(n, 0.005, 0.1) * 0.6
    # court: a short trumpet call when a row, column or court is complete
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79)): put(y, mono(i_trumpet(m, 0.14)), i * 0.08, 0.3)
    put(y, i_bell(84, 0.6), 0.24, 0.18)
    S_["court"] = y
    # solve: a royal fanfare — brass run, bells, cymbal shimmer
    n = ns(2.8); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.11, 0.32)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.2, False, 3000.0)), 0.48, 0.14)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.4), 0.5, 0.13)
    put(y, hp(nz(ns(1.4)), 5000) * env(ns(1.4), 0.03, 0.6) * 0.18, 0.48, 1.0)
    S_["solve"] = y
    # hint: a sparkle up on the harp
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 83, 86, 91, 95)): put(y, mono(i_harp(m, 0.35)), i * 0.05, 0.25)
    S_["hint"] = y
    # undo: a quick rewind
    d = 0.28; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1200 * (0.4 ** (t / d))) / SR) * env(n, 0.004, 0.1) * 0.45
    # reset: a harp glissando down
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((91, 88, 86, 84, 81, 79, 76, 74, 72)): put(y, mono(i_harp(m, 0.3)), i * 0.035, 0.2)
    S_["reset"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # open: a soft curtain whoosh into a harp note
    d = 0.5; n = ns(d)
    y = bp(nz(n), 400, 3500) * env(n, 0.15, 0.12) * 0.3
    put(y, mono(i_harp(79, 0.4)), 0.18, 0.45)
    S_["open"] = y
    # streak: a whoosh and a major chord in bells and brass
    n = ns(1.5); y = np.zeros(n)
    put(y, bp(nz(ns(0.6)), 400, 3000) * env(ns(0.6), 0.2, 0.2) * 0.35, 0, 1.0)
    for m in (72, 76, 79, 84): put(y, i_bell(m, 1.0), 0.32, 0.14)
    for m in (60, 67): put(y, mono(i_brass(m, 0.9, False, 2600.0)), 0.32, 0.12)
    S_["streak"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_crown_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_crown.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
