"""Melon Merge Fiesta sound pack: a sunny festival home theme and one track per market (Farm Market = a bouncy
marimba-and-uke hoedown, Tropical Beach = steel-drum bells over a island groove, Berry Patch = sweet synth-pop plucks,
Citrus Grove = a bright, zesty glockenspiel skip, Smoothie Bar = a chill, swinging lounge groove, Night Market = warm
lanterns of celesta and choir, Snowy Greenhouse = twinkling celesta in the cold, Sunset Vineyard = a warm brass waltz),
plus the effects: aim tick, drop whoosh, the soft fruit bump (louder for harder hits), the juicy merge squish (pitched
up for every link in a chain), combo, walnut crack and break, jelly pop, hammer, bomb, shake, undo, stage clear, star,
market complete, lose and the crate-open fanfare. All original. Every effect is panned to where it happens.

usage: python scripts/gen_melon_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_melon_<key>_<action|calm>, sfx_melon_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 197 + 13))
    uke = lambda m, d: i_pluck(m, 0.3, 6000.0, 600.0, 0.05, 0.25)
    return {
        "farm": (116, ["G", "C", "D", "G"], T_("farm", 79, "maj"), lambda m, d: i_marimba(m, 0.35), stabs(lambda m, d: uke(m, d), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 31, lambda m, d: i_strings(m, d, 0.25, False, 3000.0), lambda m, d: i_glock(m, 0.4)),
        "beach": (104, ["C", "F", "G", "C"], T_("beach", 79, "pent"), lambda m, d: i_bell(m, 0.4), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.1), bass_walk, kit_rain, 34, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_marimba(m, 0.4)),
        "berry": (120, ["F", "Dm", "Bb", "C"], T_("berry", 77, "maj"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(900.0), kit_edm, 29, lambda m, d: i_strings(m, d, 0.25, False, 3200.0), lambda m, d: i_celesta(m, 0.5)),
        "citrus": (126, ["D", "G", "A", "D"], T_("citrus", 81, "maj"), lambda m, d: i_glock(m, 0.35), stabs(lambda m, d: i_pluck(m, 0.2, 6000.0, 600.0, 0.05, 0.2), (2, 6, 10, 14), 0.11), bass_pulse(850.0), kit_edm, 33, lambda m, d: i_strings(m, d, 0.25, False, 3400.0), lambda m, d: i_marimba(m, 0.35)),
        "smoothie": (92, ["Dm7", "G", "Cmaj7", "Am"] if False else ["Dm", "G", "C", "Am"], T_("smoothie", 74, "dor"), lambda m, d: i_celesta(m, 0.45), stabs(lambda m, d: i_bell(m, 0.35), (4, 12), 0.08), bass_walk, kit_swing, 28, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_synthpluck(m, 0.45)),
        "night": (88, ["Am", "F", "C", "G"], T_("night", 76, "min"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_bell(m, 0.4), (4, 12), 0.07), bass_sub, kit_rain, 28, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_glock(m, 0.5)),
        "green": (98, ["A", "F#m", "D", "E"], T_("green", 81, "maj"), lambda m, d: i_glock(m, 0.45), stabs(lambda m, d: i_celesta(m, 0.3), (3, 7, 11, 15), 0.08), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_bell(m, 0.5)),
        "vine": (112, ["C", "Am", "F", "G"], T_("vine", 76, "maj"), lambda m, d: mono(i_brass(m, d, False, 3000.0)), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 30, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: mono(i_trumpet(m, d))),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the sunny festival theme: music box and marimba over soft strings, a slow shaker
    prog = ["C", "Am", "F", "G", "C", "Em", "F", "G"]
    hook = notes(tune(79, "maj", 7741))
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
        S = Song(f"melon_{key}_{v}", bpm, bars, rt, sw)
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

    # aim: a tiny tick as the fruit slides
    n = ns(0.08); y = np.zeros(n)
    put(y, glassy(2600, 0.06, 0.02), 0, 0.25)
    S_["aim"] = y
    # drop: a short release whoosh
    n = ns(0.3); y = np.zeros(n)
    put(y, chirp(1100, 380, 0.16, 0.22), 0, 1.0); put(y, bp(nz(ns(0.16)), 800, 5000) * env(ns(0.16), 0.01, 0.07) * 0.22, 0, 1.0)
    S_["drop"] = y
    # tap: a soft fruit bump (the game sets the loudness from the hit)
    n = ns(0.25); y = np.zeros(n)
    put(y, plop(240, 0.06, 0.45), 0, 1.0); put(y, knock(52, 0.04, 0.25), 0, 1.0)
    S_["tap"] = y
    # merge: a juicy squish, a pop and a sweet chime (pitched up in chains by the game)
    n = ns(0.9); y = np.zeros(n)
    put(y, lp(nz(ns(0.12)), 2200) * env(ns(0.12), 0.004, 0.05) * 0.35, 0, 1.0)
    put(y, plop(380, 0.07, 0.55), 0.01, 1.0); put(y, plop(700, 0.05, 0.3), 0.035, 1.0)
    for i, m in enumerate((84, 91)): put(y, i_glock(m, 0.45), 0.04 + i * 0.05, 0.14)
    S_["merge"] = y
    # combo: a rising arpeggio
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((79, 84, 88, 91, 96)): put(y, i_glock(m, 0.3), i * 0.045, 0.22)
    S_["combo"] = y
    # crack: a walnut cracks
    n = ns(0.35); y = np.zeros(n)
    put(y, knock(43, 0.06, 0.5), 0, 1.0); put(y, hp(nz(ns(0.05)), 2500) * env(ns(0.05), 0.001, 0.02) * 0.5, 0, 1.0)
    S_["crack"] = y
    # smash: a walnut breaks
    n = ns(0.9); y = np.zeros(n)
    put(y, lp(nz(ns(0.5)), 1400) * env(ns(0.5), 0.002, 0.16) * 0.7, 0, 1.0)
    for i in range(6): put(y, knock(46 + (i % 3) * 4, 0.04, 0.28), 0.03 + i * 0.05, 1.0)
    S_["smash"] = y
    # thaw: a jelly wrap pops
    n = ns(0.8); y = np.zeros(n)
    put(y, hp(nz(ns(0.06)), 2500) * env(ns(0.06), 0.001, 0.02) * 0.8, 0, 1.0)
    for i, f in enumerate((2400, 3100, 2800, 3600)): put(y, glassy(f, 0.3, 0.08), 0.03 + i * 0.05, 0.15)
    S_["thaw"] = y
    # hammer: a heavy bonk and a pop
    n = ns(0.6); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(180 * (0.4 ** (tt(ns(0.3)) / 0.3))) / SR) * env(ns(0.3), 0.002, 0.12) * 0.8, 0, 1.0)
    put(y, knock(40, 0.08, 0.5), 0, 1.0); put(y, plop(600, 0.05, 0.3), 0.05, 1.0)
    S_["hammer"] = y
    # bomb: a fizzy boom and a spray of juice
    n = ns(1.2); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(120 * (0.3 ** (tt(ns(0.5)) / 0.5))) / SR) * env(ns(0.5), 0.002, 0.2) * 0.9, 0, 1.0)
    put(y, lp(nz(ns(0.7)), 1800) * env(ns(0.7), 0.003, 0.25) * 0.6, 0, 1.0)
    for i in range(5): put(y, plop(500 + i * 130, 0.05, 0.25), 0.08 + i * 0.05, 1.0)
    S_["bomb"] = y
    # shake: a crate rattle
    n = ns(0.8); y = np.zeros(n)
    for i in range(7): put(y, knock(50 + (i % 3) * 3, 0.04, 0.3), i * 0.07, 1.0); put(y, plop(260 + (i % 2) * 60, 0.04, 0.2), i * 0.07 + 0.02, 1.0)
    S_["shake"] = y
    # undo: a quick rewind
    d_ = 0.28; n = ns(d_); t_ = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1200 * (0.4 ** (t_ / d_))) / SR) * env(n, 0.004, 0.1) * 0.45
    # clear: a bright fanfare
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.4), i * 0.08, 0.34)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.45, 0.13)
    S_["clear"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # room: a room complete — brass and bells
    n = ns(3.2); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.12, 0.28)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.4, False, 3000.0)), 0.5, 0.12)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.6), 0.6, 0.12)
    S_["room"] = y
    # lose: a falling marimba
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((76, 72, 69, 64)): put(y, i_marimba(m, 0.4), i * 0.16, 0.32)
    S_["lose"] = y
    # open: a jar-lid pop and a shimmer
    n = ns(1.2); y = np.zeros(n)
    put(y, plop(300, 0.08, 0.5), 0, 1.0)
    for i, m in enumerate((84, 88, 91, 96)): put(y, i_celesta(m, 0.6), 0.12 + i * 0.07, 0.18)
    S_["open"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_melon_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_melon.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
