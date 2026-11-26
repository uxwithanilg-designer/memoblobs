"""Noodle Pups sound pack: a bouncy dog-park home theme and one track per park (Backyard = a happy marimba-and-uke
shuffle, Sunny Beach = breezy bells, Snowy Hill = twinkling glockenspiel, City Park = a light synth-pop skip, Farmyard =
a plucky hoedown, Autumn Woods = a warm swinging walk, Flower Garden = a sweet music box, Lakeside Dock = gentle marimba,
Desert Camp = a dorian pluck caravan, Rainy Street = a cosy celesta groove, Candy Fair = a bright brass march, Starry
Camp = a dreamy choir lullaby), plus the effects: tap, the pup's scamper (pitched by length), a happy yip as it leaves,
the bump, a bone lost, a two-woof bark, hint, treat, yard clear, star, park complete, lose and the stage open. All
original, all synthesised. Every effect is panned to where it happens.

usage: python scripts/gen_pups_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_pups_<key>_<action|calm>, sfx_pups_<name>.
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
        "yard": (118, ["C", "F", "G", "C"], T_("yard", 79, "maj"), lambda m, d: i_marimba(m, 0.35), stabs(lambda m, d: uke(m, d), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 31, lambda m, d: i_strings(m, d, 0.25, False, 3000.0), lambda m, d: i_glock(m, 0.4)),
        "beach": (100, ["C", "Am", "F", "G"], T_("beach", 79, "pent"), lambda m, d: i_bell(m, 0.4), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.09), bass_walk, kit_rain, 34, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_marimba(m, 0.4)),
        "snow": (96, ["A", "F#m", "D", "E"], T_("snow", 81, "maj"), lambda m, d: i_glock(m, 0.45), stabs(lambda m, d: i_celesta(m, 0.3), (3, 7, 11, 15), 0.08), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_bell(m, 0.5)),
        "city": (120, ["F", "Dm", "Bb", "C"], T_("city", 77, "maj"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(900.0), kit_edm, 29, lambda m, d: i_strings(m, d, 0.25, False, 3200.0), lambda m, d: i_celesta(m, 0.5)),
        "farm": (124, ["G", "C", "D", "G"], T_("farm", 79, "maj"), lambda m, d: uke(m, d), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 31, lambda m, d: i_strings(m, d, 0.25, False, 3000.0), lambda m, d: i_glock(m, 0.4)),
        "autumn": (100, ["Am", "Dm", "G", "C"], T_("autumn", 76, "min"), lambda m, d: i_marimba(m, 0.4), stabs(lambda m, d: uke(m, d), (2, 6, 10, 14), 0.09), bass_walk, kit_swing, 29, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_celesta(m, 0.45)),
        "garden": (92, ["F", "Dm", "Bb", "C"], T_("garden", 77, "pent"), lambda m, d: i_musicbox(m, 0.4), stabs(lambda m, d: i_celesta(m, 0.3), (3, 7, 11, 15), 0.08), bass_sub, kit_rain, 31, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_bell(m, 0.45)),
        "lake": (90, ["G", "Em", "C", "D"], T_("lake", 79, "pent"), lambda m, d: i_marimba(m, 0.4), stabs(lambda m, d: i_bell(m, 0.35), (4, 12), 0.08), bass_walk, kit_rain, 36, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_celesta(m, 0.5)),
        "desert": (104, ["Dm", "C", "Bb", "C"], T_("desert", 74, "dor"), lambda m, d: i_pluck(m, 0.3, 5000.0, 500.0, 0.05, 0.25), stabs(lambda m, d: i_bell(m, 0.3), (4, 12), 0.08), bass_walk, kit_swing, 26, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_marimba(m, 0.35)),
        "rain": (94, ["Em", "C", "G", "D"], T_("rain", 76, "min"), lambda m, d: i_celesta(m, 0.45), stabs(lambda m, d: i_bell(m, 0.35), (4, 12), 0.08), bass_walk, kit_rain, 28, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_synthpluck(m, 0.45)),
        "candy": (116, ["C", "G", "Am", "F"], T_("candy", 76, "maj"), lambda m, d: mono(i_brass(m, d, False, 3000.0)), stabs(lambda m, d: i_marimba(m, 0.25), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 30, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: mono(i_trumpet(m, d))),
        "night": (84, ["Cm", "Ab", "Eb", "Bb"], T_("night", 72, "min"), lambda m, d: i_celesta(m, 0.55), stabs(lambda m, d: i_bell(m, 0.4), (4, 12), 0.07), bass_sub, kit_rain, 24, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_glock(m, 0.5)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the bouncy dog-park theme: music box and marimba over soft strings, a slow shaker
    prog = ["C", "Am", "F", "G", "C", "Em", "F", "G"]
    hook = notes(tune(79, "maj", 6127))
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
        S = Song(f"pups_{key}_{v}", bpm, bars, rt, sw)
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

    def woof(f0, d, g):
        # a small dog's bark: a pitched vowel (two formants) with a noisy edge, falling in pitch
        m = ns(d); t = tt(m)
        f = f0 * (1.25 - 0.45 * t / d)
        ph = 2 * np.pi * np.cumsum(f) / SR
        src = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph) + 0.2 * nz(m)
        v = bp(src, 500, 1400) * 0.8 + bp(src, 1600, 3000) * 0.35
        return v * env(m, 0.006, d * 0.45) * g
    # tap: a soft wooden click
    n = ns(0.12); y = np.zeros(n)
    put(y, knock(70, 0.03, 0.4), 0, 1.0)
    S_["tap"] = y
    # run: little paws scampering (pitched by the game for long pups)
    n = ns(0.5); y = np.zeros(n)
    for i in range(7): put(y, knock(62 + (i % 2) * 5, 0.025, 0.28), i * 0.055, 1.0)
    put(y, bp(nz(ns(0.4)), 1200, 5000) * env(ns(0.4), 0.03, 0.15) * 0.15, 0, 1.0)
    S_["run"] = y
    # out: a happy yip as the pup leaves the yard
    n = ns(0.45); y = np.zeros(n)
    put(y, woof(820, 0.16, 0.7), 0, 1.0)
    for i, m in enumerate((84, 91)): put(y, i_glock(m, 0.35), 0.05 + i * 0.05, 0.12)
    S_["out"] = y
    # bark: two woofs
    n = ns(0.6); y = np.zeros(n)
    put(y, woof(520, 0.14, 0.8), 0, 1.0); put(y, woof(560, 0.16, 0.8), 0.2, 1.0)
    S_["bark"] = y
    # bump: a soft boing and a whimper
    n = ns(0.6); y = np.zeros(n)
    put(y, knock(42, 0.1, 0.6), 0, 1.0); put(y, plop(160, 0.08, 0.4), 0.01, 1.0)
    put(y, np.sin(2 * np.pi * np.cumsum(900 * (0.7 ** (tt(ns(0.3)) / 0.3))) / SR) * env(ns(0.3), 0.02, 0.12) * 0.18, 0.12, 1.0)
    S_["bump"] = y
    # bone: a bone lost — two falling notes
    n = ns(0.7); y = np.zeros(n)
    for i, m in enumerate((72, 66)): put(y, i_marimba(m, 0.35), i * 0.12, 0.32)
    S_["bone"] = y
    # hint: a little ding
    n = ns(0.8); y = np.zeros(n)
    put(y, glassy(1760, 0.6, 0.25), 0, 0.4); put(y, glassy(2637, 0.5, 0.2), 0.08, 0.3)
    S_["hint"] = y
    # treat: a crunchy munch and a sparkle
    n = ns(0.8); y = np.zeros(n)
    for i in range(3): put(y, hp(nz(ns(0.05)), 1800) * env(ns(0.05), 0.002, 0.02) * 0.5, i * 0.08, 1.0)
    for i, m in enumerate((84, 88, 91)): put(y, i_celesta(m, 0.5), 0.25 + i * 0.06, 0.16)
    S_["treat"] = y
    # clear: a bright fanfare
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_marimba(m, 0.4), i * 0.08, 0.34)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.45, 0.13)
    S_["clear"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # park: a park complete — brass and bells
    n = ns(3.2); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.12, 0.28)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.4, False, 3000.0)), 0.5, 0.12)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.6), 0.6, 0.12)
    S_["park"] = y
    # lose: a falling marimba
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((76, 72, 69, 64)): put(y, i_marimba(m, 0.4), i * 0.16, 0.32)
    S_["lose"] = y
    # open: a whistle call
    n = ns(1.2); y = np.zeros(n)
    put(y, chirp(1400, 2200, 0.18, 0.25), 0, 1.0); put(y, chirp(1400, 2600, 0.22, 0.25), 0.25, 1.0)
    for i, m in enumerate((79, 84, 88, 91)): put(y, i_celesta(m, 0.6), 0.15 + i * 0.07, 0.18)
    S_["open"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_pups_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_pups.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
