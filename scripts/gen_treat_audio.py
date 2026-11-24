"""Treatrio sound pack: a sunny shop-front home theme and one track per shop (Sunrise Bakery = warm e-piano pop,
Candy Corner = bubbly plucks and glockenspiel, Gelato Terrace = a little bossa, Fruit Orchard = folk ukulele and
accordion, Moon Tea House = pentatonic kalimba, Cocoa Workshop = lounge e-piano and clarinet, Starlight Diner = a
swinging piano diner tune, Carnival Night = a fairground oompah), plus the effects: pick, drop, nope, the pop of three,
combo, row slide, gift unwrap, ice crack, unlock, undo, hint, shuffle, clock tick, stage clear, star, shop complete,
time's up and the shop bell. All original. The game pans every effect to the box's column.

usage: python scripts/gen_treat_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_treat_<key>_<action|calm>, sfx_treat_<name>.
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
        "bakery": (108, ["C", "Am", "F", "G"], T_("bakery", 84, "maj"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: i_epiano(m, 0.2, 0.7), (2, 6, 10, 14), 0.1), bass_walk, kit_swing, 36, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: i_glock(m, 0.4)),
        "candy": (120, ["F", "Dm", "Bb", "C"], T_("candy", 77, "maj"), lambda m, d: i_synthpluck(m, 0.4), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(900.0), kit_edm, 29, lambda m, d: i_strings(m, d, 0.25, False, 3200.0), lambda m, d: i_celesta(m, 0.5)),
        "gelato": (104, ["Dm", "G", "C", "A"], T_("gelato", 74, "dor"), lambda m, d: i_marimba(m, 0.35), stabs(lambda m, d: i_gtr(m, 0.2, True), (3, 6, 11, 14), 0.1), bass_walk, kit_rain, 26, lambda m, d: i_strings(m, d, 0.35, False, 2800.0), lambda m, d: mono(i_clarinet(m, d))),
        "orchard": (112, ["G", "C", "D", "G"], T_("orchard", 79, "maj"), uke, stabs(lambda m, d: i_accordion(m, 0.15), (4, 12), 0.1), bass_oompah, kit_rain, 31, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: mono(i_accordion(m, d))),
        "tea": (92, ["Am", "G", "F", "E"], T_("tea", 81, "pent"), lambda m, d: i_kalimba(m, 0.55), stabs(lambda m, d: i_pluck(m, 0.3, 5000.0, 600.0, 0.05, 0.25), (3, 11), 0.08), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_bell(m, 0.5)),
        "cocoa": (96, ["Fm", "Bb", "Eb", "C"], T_("cocoa", 77, "dor"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: i_epiano(m, 0.2, 0.6), (3, 7, 11, 15), 0.09), bass_walk, kit_swing, 29, lambda m, d: i_strings(m, d, 0.4, False, 2400.0), lambda m, d: mono(i_clarinet(m, d))),
        "diner": (132, ["C", "Am", "F", "G"], T_("diner", 84, "mix"), lambda m, d: i_toypiano(m, 0.35), stabs(lambda m, d: i_epiano(m, 0.15, 0.7), (2, 6, 10, 14), 0.11), bass_walk, kit_swing, 36, lambda m, d: mono(i_brass(m, d, False, 2600.0)), lambda m, d: mono(i_trumpet(m, d))),
        "carnival": (116, ["C", "G", "C", "F", "C", "G", "C", "C"], T_("carnival", 84, "maj"), lambda m, d: mono(i_accordion(m, d)), stabs(lambda m, d: i_glock(m, 0.3), (4, 12), 0.1), bass_oompah, kit_march, 36, lambda m, d: mono(i_brass(m, d, False, 2800.0)), lambda m, d: i_glock(m, 0.4)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["F", "Dm", "Bb", "C", "F", "Am", "Bb", "C"]
    hook = notes(tune(84, "maj", 3307))
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
        S = Song(f"treat_{key}_{v}", bpm, bars, rt, sw)
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

    # pick: a soft lift-up pluck
    n = ns(0.3); y = np.zeros(n)
    put(y, chirp(500, 900, 0.09, 0.35), 0, 1.0); put(y, i_glock(91, 0.15), 0.02, 0.12)
    S_["pick"] = y
    # drop: a wooden "thock" as a treat lands on the shelf
    n = ns(0.35); y = np.zeros(n)
    put(y, knock(67, 0.14, 0.55), 0, 1.0); put(y, knock(74, 0.08, 0.2), 0.06, 1.0)
    S_["drop"] = y
    # nope: a soft boing-bonk
    n = ns(0.3); y = np.zeros(n)
    put(y, chirp(220, 140, 0.18, 0.45), 0, 1.0); put(y, knock(55, 0.12, 0.3), 0, 1.0)
    S_["nope"] = y
    # pop: three alike burst — a bright pop, a sugar sparkle and a chord
    n = ns(1.0); y = np.zeros(n)
    put(y, chirp(400, 1600, 0.06, 0.6), 0, 1.0)
    put(y, hp(nz(ns(0.25)), 6000) * env(ns(0.25), 0.002, 0.08) * 0.18, 0.02, 1.0)
    for i, m in enumerate((84, 88, 91)): put(y, i_glock(m, 0.5), 0.04 + i * 0.03, 0.22)
    S_["pop"] = y
    # combo: a rising arpeggio
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((79, 84, 88, 91)): put(y, mono(i_synthpluck(m, 0.3)), i * 0.05, 0.25)
    S_["combo"] = y
    # slide: the row behind slides forward (a soft wooden scrape)
    n = ns(0.4); y = np.zeros(n)
    put(y, bp(nz(ns(0.3)), 300, 1500) * env(ns(0.3), 0.08, 0.12) * 0.35, 0, 1.0); put(y, knock(60, 0.1, 0.25), 0.25, 1.0)
    S_["slide"] = y
    # unwrap: paper rustle and a ding
    n = ns(0.8); y = np.zeros(n)
    for i in range(5): put(y, hp(nz(ns(0.05)), 2500) * env(ns(0.05), 0.002, 0.02) * 0.35, i * 0.045, 1.0)
    put(y, i_bell(88, 0.6), 0.22, 0.25)
    S_["unwrap"] = y
    # ice: a crack and tinkling shards
    n = ns(0.8); y = np.zeros(n)
    put(y, hp(nz(ns(0.06)), 2500) * env(ns(0.06), 0.001, 0.02) * 0.8, 0, 1.0)
    for i, f in enumerate((2400, 3100, 2800, 3600)): put(y, glassy(f, 0.3, 0.08), 0.03 + i * 0.05, 0.15)
    S_["ice"] = y
    # unlock: a lock click and a happy chime
    n = ns(0.9); y = np.zeros(n)
    put(y, knock(84, 0.05, 0.4), 0, 1.0); put(y, knock(79, 0.05, 0.3), 0.07, 1.0)
    for i, m in enumerate((84, 88, 91, 96)): put(y, i_bell(m, 0.6), 0.15 + i * 0.05, 0.16)
    S_["unlock"] = y
    # undo: a quick rewind
    d = 0.28; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1200 * (0.4 ** (t / d))) / SR) * env(n, 0.004, 0.1) * 0.45
    # hint: a twinkle
    n = ns(0.9); y = np.zeros(n)
    for i, m in enumerate((88, 91, 95, 100)): put(y, i_celesta(m, 0.4), i * 0.06, 0.2)
    S_["hint"] = y
    # shuffle: a whoosh with tumbling knocks
    n = ns(0.9); y = np.zeros(n)
    put(y, bp(nz(ns(0.6)), 500, 4000) * env(ns(0.6), 0.2, 0.2) * 0.35, 0, 1.0)
    for i, m in enumerate((72, 76, 69, 79, 74, 81)): put(y, knock(m, 0.06, 0.18), 0.08 + i * 0.07, 1.0)
    S_["shuffle"] = y
    # tick: a woodblock tick
    n = ns(0.12); y = np.zeros(n)
    put(y, i_marimba(96, 0.08), 0, 0.5)
    S_["tick"] = y
    # clear: a bright fanfare — toy piano run, bells and a pop
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_toypiano(m, 0.4), i * 0.08, 0.32)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.45, 0.13)
    put(y, chirp(400, 1600, 0.06, 0.4), 0.44, 1.0)
    S_["clear"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # shop: the shop is stocked — brass and bells
    n = ns(3.2); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.12, 0.28)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.4, False, 3000.0)), 0.5, 0.12)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.6), 0.6, 0.12)
    S_["shop"] = y
    # timeup: a descending toy run
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((76, 72, 69, 64)): put(y, i_toypiano(m, 0.4), i * 0.16, 0.3)
    S_["timeup"] = y
    # open: the shop door bell
    n = ns(1.2); y = np.zeros(n)
    put(y, i_bell(91, 1.0), 0, 0.3); put(y, i_bell(88, 1.0), 0.14, 0.26); put(y, i_bell(91, 0.8), 0.28, 0.18)
    S_["open"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_treat_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_treat.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
