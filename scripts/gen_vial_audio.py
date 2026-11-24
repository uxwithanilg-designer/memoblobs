"""Moonvial sound pack: a calm moonlit home theme and one gentle night track per constellation (Lantern Garden =
music box and harp, Firefly Pond = kalimba, Crystal Grotto = celesta and glass, Starfall Hill = bells and choir,
Aurora Peak = slow strings, Moon Orchard = marimba and clarinet, Comet Harbor = accordion waltz, Nebula Gate = soft
synth), plus the effects: vial select clink, the flowing stream, the bottle filling up (rising pitch), nope, cork pop, hidden-layer reveal shimmer, delivery to the
star spirit, stage clear, star, constellation fanfare, undo, extra vial, restart, stuck and open. All original. The
game pans every effect to the vial's place on the shelf.

usage: python scripts/gen_vial_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_vial_<key>_<action|calm>, sfx_vial_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 241 + 7))
    return {
        "lantern": (92, ["F", "Dm", "Bb", "C"], T_("lantern", 77, "maj"), lambda m, d: i_musicbox(m, 0.6), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.1), bass_sub, kit_rain, 29, lambda m, d: i_strings(m, d, 0.4, False, 2600.0), lambda m, d: i_celesta(m, 0.5)),
        "firefly": (100, ["G", "Em", "C", "D"], T_("firefly", 79, "maj"), lambda m, d: i_kalimba(m, 0.55), stabs(lambda m, d: i_pluck(m, 0.3, 5000.0, 600.0, 0.05, 0.25), (3, 7, 11, 15), 0.1), bass_walk, kit_rain, 31, lambda m, d: i_choir(m, d, 0.45), lambda m, d: i_glock(m, 0.4)),
        "crystal": (88, ["Am", "F", "C", "E"], T_("crystal", 81, "hmin"), lambda m, d: i_celesta(m, 0.7), stabs(lambda m, d: i_glock(m, 0.3), (2, 10), 0.08), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_bell(m, 0.6)),
        "starfall": (84, ["C", "Am", "F", "G"], T_("starfall", 84, "lyd"), lambda m, d: i_bell(m, 0.9), stabs(lambda m, d: i_celesta(m, 0.3), (3, 11), 0.08), bass_sub, kit_rain, 36, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_snowbell(m, 0.5)),
        "aurora": (80, ["D", "A", "Bm", "G"], T_("aurora", 74, "lyd"), lambda m, d: i_strings(m, d, 0.1, False, 3600.0), stabs(lambda m, d: i_harp(m, 0.4), (2, 6, 10, 14), 0.08), bass_sub, kit_rain, 26, lambda m, d: i_strings(m, d, 0.5, False, 2400.0), lambda m, d: i_bell(m, 0.6)),
        "orchard": (98, ["Bb", "Gm", "Eb", "F"], T_("orchard", 82, "maj"), lambda m, d: i_marimba(m, 0.35), stabs(lambda m, d: i_pluck(m, 0.3, 5000.0, 600.0, 0.05, 0.25), (2, 6, 10, 14), 0.1), bass_walk, kit_rain, 34, lambda m, d: i_strings(m, d, 0.35, False, 2800.0), lambda m, d: mono(i_clarinet(m, d))),
        "harbor": (96, ["C", "G", "Am", "F"], T_("harbor", 84, "mix"), lambda m, d: mono(i_accordion(m, d)), stabs(lambda m, d: i_steel(m, 0.3), (4, 12), 0.1), bass_oompah, kit_rain, 36, lambda m, d: i_strings(m, d, 0.35, False, 2800.0), lambda m, d: i_glock(m, 0.4)),
        "nebula": (90, ["Em", "C", "G", "B"], T_("nebula", 76, "dor"), lambda m, d: i_synthpluck(m, 0.5), stabs(lambda m, d: i_bell(m, 0.5), (3, 11), 0.08), bass_sub, kit_rain, 28, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_celesta(m, 0.5)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["A", "F#m", "D", "E", "A", "F#m", "Bm", "E"]
    hook = notes(tune(81, "maj", 5521))
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
        S = Song(f"vial_{key}_{v}", bpm, bars, rt, sw)
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

    def glug(f0, d=0.14, g=0.5):
        n_ = ns(d); t_ = tt(n_)
        return np.sin(2 * np.pi * np.cumsum(f0 * (1.6 ** (t_ / d))) / SR) * env(n_, 0.004, d * 0.4) * g

    # select: a glass clink
    n = ns(0.5); y = np.zeros(n)
    put(y, glassy(1760, 0.4, 0.12), 0, 0.35); put(y, glassy(2640, 0.3, 0.08), 0.005, 0.15)
    S_["select"] = y
    # flow: the potion stream — a soft liquid rush with a fluttering texture and a little fizz
    n = ns(0.62); y = np.zeros(n); t = tt(n)
    rush = bp(nz(n), 250, 2200) * env(n, 0.05, 0.2) * (0.72 + 0.28 * np.sin(2 * np.pi * 11 * t) * np.sin(2 * np.pi * 3.3 * t + 1.0))
    y += rush * 0.42
    put(y, hp(nz(ns(0.45)), 5500) * env(ns(0.45), 0.06, 0.2) * 0.07, 0.04, 1.0)
    for i, f in enumerate((520, 610, 480, 700, 560)): put(y, glug(f, 0.06, 0.16), 0.08 + i * 0.09, 1.0)
    S_["flow"] = y
    # fill: liquid landing in a glass — resonant grains rising in pitch as the vial fills, with bubbles
    n = ns(0.75); y = np.zeros(n)
    for i in range(15):
        f = 300 * (1.075 ** i)
        put(y, bp(nz(ns(0.09)), f * 0.85, f * 1.25) * env(ns(0.09), 0.01, 0.05) * 0.55, i * 0.038, 1.0)
    for i, f in enumerate((380, 470, 590, 720)): put(y, glug(f, 0.08, 0.28), 0.06 + i * 0.13, 1.0)
    put(y, glassy(1760 * 1.5, 0.3, 0.08), 0.55, 0.06)
    S_["fill"] = y
    # nope: a dull glass knock
    n = ns(0.25); y = np.zeros(n)
    put(y, lp(nz(ns(0.06)), 900) * env(ns(0.06), 0.001, 0.02) * 0.6, 0, 1.0); put(y, i_marimba(55, 0.15), 0, 0.3)
    S_["nope"] = y
    # cork: a pop and a twinkle
    d = 0.08; n = ns(0.7); y = np.zeros(n); t = tt(ns(d))
    put(y, np.sin(2 * np.pi * np.cumsum(500 * (2.2 ** (t / d))) / SR) * env(ns(d), 0.001, 0.03) * 0.6, 0, 1.0)
    put(y, hp(nz(ns(0.03)), 2000) * env(ns(0.03), 0.001, 0.01) * 0.4, 0, 1.0)
    for i, m in enumerate((88, 91, 96)): put(y, i_glock(m, 0.3), 0.08 + i * 0.05, 0.22)
    S_["cork"] = y
    # reveal: a shimmer as a hidden layer shows itself
    n = ns(0.9); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91, 95, 100)): put(y, i_celesta(m, 0.4), i * 0.04, 0.18)
    put(y, hp(nz(ns(0.5)), 7000) * env(ns(0.5), 0.05, 0.2) * 0.1, 0, 1.0)
    S_["reveal"] = y
    # deliver: a whoosh up and a happy two-note chime (the spirit says thanks)
    n = ns(1.1); y = np.zeros(n)
    put(y, bp(nz(ns(0.4)), 600, 4500) * env(ns(0.4), 0.2, 0.1) * 0.3, 0, 1.0)
    put(y, i_bell(84, 0.7), 0.38, 0.25); put(y, i_bell(91, 0.7), 0.5, 0.25)
    S_["deliver"] = y
    # clear: a gentle fanfare — harp run, bells and a soft choir
    n = ns(2.8); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, mono(i_harp(m, 0.5)), i * 0.08, 0.3)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.45, 0.14)
    for m in (60, 64, 67): put(y, i_choir(m, 1.4, 0.2), 0.4, 0.08)
    S_["clear"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # constellation: a bigger fanfare with brass and a rising sparkle
    n = ns(3.4); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.12, 0.28)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.4, False, 3000.0)), 0.5, 0.12)
    for i, m in enumerate((84, 88, 91, 96, 100, 103)): put(y, i_celesta(m, 0.6), 0.6 + i * 0.07, 0.16)
    for m in (84, 91, 96): put(y, i_bell(m, 1.6), 0.95, 0.12)
    S_["constellation"] = y
    # undo: a quick rewind
    d = 0.28; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1200 * (0.4 ** (t / d))) / SR) * env(n, 0.004, 0.1) * 0.45
    # extra: a magic poof and a glass ring
    n = ns(0.9); y = np.zeros(n)
    put(y, bp(nz(ns(0.3)), 800, 6000) * env(ns(0.3), 0.01, 0.12) * 0.4, 0, 1.0)
    put(y, glassy(1318, 0.7, 0.25), 0.1, 0.3); put(y, glassy(1976, 0.6, 0.2), 0.14, 0.2)
    S_["extra"] = y
    # restart: a harp glissando down
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((91, 88, 86, 84, 81, 79, 76, 74, 72)): put(y, mono(i_harp(m, 0.3)), i * 0.035, 0.2)
    S_["restart"] = y
    # stuck: a soft descending sigh
    n = ns(1.2); y = np.zeros(n)
    for i, m in enumerate((76, 72, 69, 64)): put(y, i_celesta(m, 0.5), i * 0.16, 0.22)
    S_["stuck"] = y
    # open: a soft whoosh into a bell
    n = ns(0.9); y = np.zeros(n)
    put(y, bp(nz(ns(0.5)), 400, 3000) * env(ns(0.5), 0.2, 0.15) * 0.3, 0, 1.0)
    put(y, i_bell(84, 0.6), 0.3, 0.25)
    S_["open"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_vial_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_vial.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
