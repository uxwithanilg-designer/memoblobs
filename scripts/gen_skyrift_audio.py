"""Skyrift Gems sound pack: a bright sky theme and one track per island world (twenty: Cloud Meadow to Celestial
Crown — bells, music boxes, marimbas, plucks, brass and synths over light grooves, each its own key and tune), plus the
effects: a swap (a soft whoosh), a bad swap (a bonk), a match (a glassy chime the game pitches up with each cascade), a
special made (a sparkle), a line blast (a laser sweep), a bomb (a deep boom), a prism (a shimmering rainbow run), ice
cracking, a rock chipping, a chest landing (coins), gems landing, a shuffle, the hammer, the rival's turn, win, lose,
star, world complete and the level open. All original, all synthesised. Panned to the column it happens in.

usage: python scripts/gen_skyrift_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_skyrift_<key>_<action|calm>, sfx_skyrift_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 131 + 17))
    uke = lambda m, d: i_pluck(m, 0.3, 6000.0, 600.0, 0.05, 0.25)
    R = [
        lambda k: (100, ["C", "Am", "F", "G"], T_(k, 79, "pent"), lambda m, d: i_bell(m, 0.4), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.09), bass_walk, kit_rain, 34, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_marimba(m, 0.4)),
        lambda k: (92, ["F", "Dm", "Bb", "C"], T_(k, 77, "pent"), lambda m, d: i_musicbox(m, 0.4), stabs(lambda m, d: i_celesta(m, 0.3), (3, 7, 11, 15), 0.08), bass_sub, kit_rain, 31, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_bell(m, 0.45)),
        lambda k: (122, ["C", "G", "Am", "F"], T_(k, 76, "maj"), lambda m, d: mono(i_brass(m, d, False, 3000.0)), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 30, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: mono(i_trumpet(m, d))),
        lambda k: (126, ["Am", "F", "C", "G"], T_(k, 81, "min"), lambda m, d: i_synthpluck(m, 0.35), stabs(lambda m, d: i_pluck(m, 0.2, 6000.0, 600.0, 0.05, 0.2), (2, 6, 10, 14), 0.11), bass_pulse(800.0), kit_edm, 33, lambda m, d: i_strings(m, d, 0.25, False, 3400.0), lambda m, d: i_glock(m, 0.35)),
        lambda k: (98, ["G", "Em", "C", "D"], T_(k, 79, "pent"), lambda m, d: i_marimba(m, 0.4), stabs(lambda m, d: i_bell(m, 0.35), (4, 12), 0.08), bass_walk, kit_rain, 36, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_celesta(m, 0.5)),
        lambda k: (114, ["D", "G", "A", "D"], T_(k, 81, "maj"), lambda m, d: i_glock(m, 0.35), stabs(lambda m, d: uke(m, d), (2, 6, 10, 14), 0.1), bass_pulse(850.0), kit_swing, 33, lambda m, d: i_strings(m, d, 0.25, False, 3200.0), lambda m, d: i_marimba(m, 0.35)),
        lambda k: (118, ["F", "Dm", "Bb", "C"], T_(k, 77, "maj"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(900.0), kit_edm, 29, lambda m, d: i_strings(m, d, 0.25, False, 3200.0), lambda m, d: i_celesta(m, 0.5)),
        lambda k: (104, ["Dm", "C", "Bb", "C"], T_(k, 74, "dor"), lambda m, d: i_pluck(m, 0.3, 5000.0, 500.0, 0.05, 0.25), stabs(lambda m, d: i_bell(m, 0.3), (4, 12), 0.08), bass_walk, kit_swing, 26, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_marimba(m, 0.35)),
        lambda k: (90, ["Em", "C", "G", "D"], T_(k, 76, "min"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_bell(m, 0.4), (4, 12), 0.07), bass_sub, kit_rain, 28, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_glock(m, 0.5)),
        lambda k: (88, ["Am", "F", "C", "G"], T_(k, 76, "min"), lambda m, d: i_bell(m, 0.45), stabs(lambda m, d: i_celesta(m, 0.35), (4, 12), 0.07), bass_sub, kit_rain, 28, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_glock(m, 0.5)),
        lambda k: (96, ["A", "F#m", "D", "E"], T_(k, 81, "maj"), lambda m, d: i_glock(m, 0.45), stabs(lambda m, d: i_celesta(m, 0.3), (3, 7, 11, 15), 0.08), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_bell(m, 0.5)),
        lambda k: (110, ["Cm", "Ab", "Eb", "Bb"], T_(k, 72, "min"), lambda m, d: i_synthpluck(m, 0.45), stabs(lambda m, d: i_bell(m, 0.4), (4, 12), 0.07), bass_sub, kit_edm, 24, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_celesta(m, 0.5)),
    ]
    keys = ['meadow', 'sunrise', 'spire', 'harbor', 'falls', 'keep', 'ember', 'frost', 'jade', 'coral', 'storm', 'lotus', 'amber', 'aurora', 'thunder', 'petal', 'starfall', 'mist', 'bastion', 'crown']
    out = {}
    for n, key in enumerate(keys):
        spec = list(R[n % len(R)](key))
        if n >= len(R): spec[0] = spec[0] + 8  # the second round of islands runs a little faster
        out[key] = tuple(spec)
    return out


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm sky theme: music box and marimba over soft strings, a slow shaker
    prog = ["C", "Am", "F", "G", "C", "Em", "F", "G"]
    hook = notes(tune(79, "maj", 4421))
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
        S = Song(f"skyrift_{key}_{v}", bpm, bars, rt, sw)
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

    def knock(m, d=0.12, g=0.5):
        n_ = ns(0.25); y_ = np.zeros(n_)
        put(y_, i_marimba(m, d), 0, g); put(y_, lp(nz(ns(0.03)), 1600) * env(ns(0.03), 0.001, 0.01) * 0.35, 0, 1.0)
        return y_

    def chirp(f0, f1, d, g):
        n_ = ns(d); t_ = tt(n_)
        return np.sin(2 * np.pi * np.cumsum(f0 * ((f1 / f0) ** (t_ / d))) / SR) * env(n_, 0.003, d * 0.4) * g

    def plop(f, d=0.12, g=0.5):
        # a round water-drop "plop": a fast upward sine sweep with a soft body
        n_ = ns(d + 0.1); t_ = tt(n_)
        return np.sin(2 * np.pi * np.cumsum(f * (1 + 1.6 * np.minimum(1, t_ / d))) / SR) * env(n_, 0.001, d * 0.45) * g

    # swap: a soft whoosh
    n = ns(0.3); y = np.zeros(n)
    put(y, bp(nz(ns(0.18)), 600, 3500) * env(ns(0.18), 0.03, 0.08) * 0.35, 0, 1.0)
    S_["swap"] = y
    # bad: a bonk
    n = ns(0.3); y = np.zeros(n)
    put(y, knock(48, 0.05, 0.45), 0, 1.0); put(y, chirp(300, 200, 0.1, 0.12), 0, 1.0)
    S_["bad"] = y
    # match: a glassy chime
    n = ns(0.7); y = np.zeros(n)
    put(y, glassy(1568, 0.5, 0.2), 0, 0.4); put(y, glassy(2093, 0.4, 0.15), 0.03, 0.22)
    S_["match"] = y
    # make: a sparkle for a special gem
    n = ns(0.9); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91, 96)): put(y, i_glock(m, 0.4), i * 0.05, 0.2)
    S_["make"] = y
    # line: a laser sweep across the board
    n = ns(0.6); y = np.zeros(n)
    put(y, chirp(2400, 400, 0.35, 0.3), 0, 1.0); put(y, bp(nz(ns(0.3)), 2000, 8000) * env(ns(0.3), 0.005, 0.1) * 0.25, 0, 1.0)
    S_["line"] = y
    # bomb: a deep boom
    n = ns(1.0); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(90 * (0.5 ** (tt(ns(0.5)) / 0.3))) / SR) * env(ns(0.5), 0.002, 0.25) * 0.8, 0, 1.0)
    put(y, lp(nz(ns(0.5)), 900) * env(ns(0.5), 0.002, 0.18) * 0.5, 0, 1.0)
    S_["bomb"] = y
    # prism: a shimmering rainbow run
    n = ns(1.4); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 83, 86, 88, 91, 95)): put(y, i_celesta(m, 0.6), i * 0.05, 0.17)
    put(y, chirp(800, 3000, 0.6, 0.08), 0, 1.0)
    S_["prism"] = y
    # ice: a crack
    n = ns(0.4); y = np.zeros(n)
    put(y, bp(nz(ns(0.08)), 2500, 9000) * env(ns(0.08), 0.001, 0.02) * 0.6, 0, 1.0); put(y, glassy(3136, 0.25, 0.08), 0.01, 0.2)
    S_["ice"] = y
    # rock: a stony chip
    n = ns(0.35); y = np.zeros(n)
    put(y, bp(nz(ns(0.1)), 300, 2500) * env(ns(0.1), 0.001, 0.03) * 0.6, 0, 1.0); put(y, knock(40, 0.04, 0.4), 0, 1.0)
    S_["rock"] = y
    # chest: coins tumbling
    n = ns(0.9); y = np.zeros(n)
    for i in range(6): put(y, glassy(2349 + (i % 3) * 300, 0.2, 0.06), i * 0.06, 0.2)
    S_["chest"] = y
    # land: gems settling
    n = ns(0.2); y = np.zeros(n)
    put(y, knock(64, 0.02, 0.2), 0, 1.0)
    S_["land"] = y
    # shuffle: a swirl
    n = ns(0.8); y = np.zeros(n)
    for i in range(5): put(y, chirp(500 + i * 120, 1400 + i * 200, 0.12, 0.08), i * 0.08, 1.0)
    S_["shuffle"] = y
    # hammer: a clang and a crash
    n = ns(0.8); y = np.zeros(n)
    put(y, glassy(880, 0.4, 0.2), 0, 0.4); put(y, bp(nz(ns(0.3)), 300, 5000) * env(ns(0.3), 0.002, 0.1) * 0.5, 0.02, 1.0)
    S_["hammer"] = y
    # turn: the rival's go (a soft two-note cue)
    n = ns(0.6); y = np.zeros(n)
    for i, m in enumerate((76, 71)): put(y, i_marimba(m, 0.3), i * 0.1, 0.25)
    S_["turn"] = y
    # clear: a bright fanfare
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.4), i * 0.08, 0.34)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.45, 0.13)
    S_["win"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # world: a colour world complete — brass and bells
    n = ns(3.2); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.12, 0.28)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.4, False, 3000.0)), 0.5, 0.12)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.6), 0.6, 0.12)
    S_["world"] = y
    # lose: a falling marimba
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((76, 72, 69, 64)): put(y, i_marimba(m, 0.4), i * 0.16, 0.32)
    S_["lose"] = y
    # open: a rising swish and a chime
    n = ns(1.2); y = np.zeros(n)
    put(y, chirp(300, 1600, 0.4, 0.15), 0, 1.0)
    for i, m in enumerate((79, 84, 88)): put(y, i_celesta(m, 0.6), 0.2 + i * 0.07, 0.18)
    for i, m in enumerate((79, 84, 88, 91)): put(y, i_celesta(m, 0.6), 0.15 + i * 0.07, 0.18)
    S_["open"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_skyrift_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_skyrift.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
