"""Blocktide sound pack: a calm tide-pool home theme and one track per depth zone of the endless dive (Sunny Lagoon,
Coral Reef, Kelp Forest, Sunken Ship shanty, Glow Caves, Ice Shelf, Fire Vents, Moon Tide), plus the effects: pick-up
bubble, jelly plop, slide back, three sizes of wave clear, combo, pearl, all-clear, deal, undo, swap, game over, new
best / new zone fanfare, open and power-up. All original. The game
pans every effect to where the piece lands.

usage: python scripts/gen_tide_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_tide_<key>_<action|calm>, sfx_tide_<name>.
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
    T_ = lambda k, root, mode: notes(tune(root, mode, sum(map(ord, k)) * 173 + 29))
    uke = lambda m, d: i_pluck(m, 0.3, 6000.0, 600.0, 0.05, 0.25)
    return {
        "lagoon": (104, ["G", "C", "D", "G"], T_("lagoon", 79, "maj"), uke, stabs(lambda m, d: i_steel(m, 0.3), (2, 6, 10, 14), 0.1), bass_walk, kit_rain, 31, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_steel(m, 0.4)),
        "reef": (116, ["D", "C", "G", "D"], T_("reef", 74, "mix"), lambda m, d: i_marimba(m, 0.35), stabs(lambda m, d: i_kalimba(m, 0.3), (3, 7, 11, 15), 0.11), bass_sub, kit_tribal, 26, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.5)),
        "kelp": (96, ["Am", "G", "F", "G"], T_("kelp", 81, "dor"), lambda m, d: i_kalimba(m, 0.6), stabs(lambda m, d: i_pluck(m, 0.3, 4000.0, 500.0, 0.06, 0.3), (2, 6, 10, 14), 0.1), bass_sub, kit_rain, 33, lambda m, d: i_choir(m, d, 0.5), lambda m, d: mono(i_clarinet(m, d))),
        "wreck": (100, ["Dm", "C", "Dm", "A"], T_("wreck", 74, "hmin"), lambda m, d: mono(i_accordion(m, d)), stabs(lambda m, d: i_accordion(m, 0.15), (4, 12), 0.1), bass_oompah, kit_march, 26, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: mono(i_piccolo(m, d))),
        "caves": (92, ["Em", "C", "Am", "B"], T_("caves", 76, "hmin"), lambda m, d: i_celesta(m, 0.7), stabs(lambda m, d: i_bell(m, 0.5), (3, 11), 0.08), bass_sub, kit_rain, 28, lambda m, d: i_choir(m, d, 0.5), lambda m, d: i_glock(m, 0.5)),
        "ice": (98, ["C", "G", "Am", "F"], T_("ice", 84, "lyd"), lambda m, d: i_snowbell(m, 0.6), stabs(lambda m, d: i_celesta(m, 0.3), (2, 6, 10, 14), 0.09), bass_sub, kit_rain, 36, lambda m, d: i_strings(m, d, 0.4, False, 3200.0), lambda m, d: i_glock(m, 0.5)),
        "vent": (124, ["Cm", "Ab", "Eb", "G"], T_("vent", 72, "hmin"), lambda m, d: mono(i_brass(m, d, False, 3400.0)), stabs(lambda m, d: i_strings(m, 0.15, 0.01, True, 4000.0), (2, 6, 10, 14), 0.12), bass_reese, kit_rock, 24, lambda m, d: i_choir(m, d, 0.35), lambda m, d: mono(i_lead(m, d, None, 4200.0))),
        "moon": (88, ["F", "Am", "Bb", "C"], T_("moon", 77, "lyd"), lambda m, d: i_epiano(m, d), stabs(lambda m, d: i_bell(m, 0.5), (3, 11), 0.08), bass_sub, kit_rain, 29, lambda m, d: i_strings(m, d, 0.45, False, 2600.0), lambda m, d: i_celesta(m, 0.5)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm home theme: music box and marimba over soft strings, a slow shaker — music for thinking
    prog = ["C", "Am", "F", "G", "C", "Am", "Dm", "G"]
    hook = notes(tune(84, "maj", 9133))
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
        S = Song(f"tide_{key}_{v}", bpm, bars, rt, sw)
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

    def wave(d, lo, hi, att, g):
        n_ = ns(d)
        return bp(nz(n_), lo, hi) * env(n_, att, d * 0.5) * g

    def plop(f0, d=0.16, g=0.6):
        n_ = ns(d); t_ = tt(n_)
        return np.sin(2 * np.pi * np.cumsum(f0 * (1.9 ** (t_ / d))) / SR) * env(n_, 0.002, d * 0.35) * g

    # pick: a little bubble pop going up
    n = ns(0.25); y = np.zeros(n)
    put(y, plop(500, 0.1, 0.5), 0, 1.0); put(y, plop(900, 0.07, 0.3), 0.04, 1.0)
    S_["pick"] = y
    # place: a soft jelly plop with a wooden knock
    n = ns(0.35); y = np.zeros(n)
    d = 0.18; t = tt(ns(d))
    put(y, np.sin(2 * np.pi * np.cumsum(320 * (0.55 ** (t / d))) / SR) * env(ns(d), 0.002, 0.07) * 0.7, 0, 1.0)
    put(y, i_marimba(67, 0.15), 0.005, 0.25); put(y, lp(nz(ns(0.04)), 1500) * env(ns(0.04), 0.001, 0.012), 0, 0.3)
    S_["place"] = y
    # back: a soft slide down
    d = 0.22; n = ns(d); t = tt(n)
    S_["back"] = np.sin(2 * np.pi * np.cumsum(600 * (0.5 ** (t / d))) / SR) * env(n, 0.004, 0.08) * 0.35
    # clears: wave whoosh + chimes, bigger each step
    for k_, (dur, notes_, g) in {"clear1": (0.9, (79, 84), 0.45), "clear2": (1.2, (76, 79, 84, 88), 0.55), "clear3": (1.6, (72, 76, 79, 84, 88, 91), 0.65)}.items():
        n = ns(dur + 0.6); y = np.zeros(n)
        put(y, wave(dur, 250, 3800, dur * 0.3, g), 0, 1.0)
        for i, m in enumerate(notes_): put(y, mono(i_harp(m, 0.5)), 0.05 + i * 0.045, 0.28)
        put(y, i_bell(notes_[-1] + 12, 0.8), 0.05 + len(notes_) * 0.045, 0.12)
        S_[k_] = y
    # combo: a rising synth pluck pair (pitched up by the game per combo step)
    n = ns(0.6); y = np.zeros(n)
    put(y, mono(i_synthpluck(84, 0.3)), 0, 0.35); put(y, mono(i_synthpluck(91, 0.3)), 0.06, 0.3)
    S_["combo"] = y
    # pearl: a sparkly glass ping
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1760, 0.8, 0.3), 0, 0.4); put(y, glassy(2637, 0.6, 0.2), 0.03, 0.25)
    put(y, hp(nz(ns(0.3)), 8000) * env(ns(0.3), 0.005, 0.1) * 0.1, 0, 1.0)
    S_["pearl"] = y
    # allclear: a big splash and a bright fanfare
    n = ns(2.8); y = np.zeros(n)
    put(y, wave(1.6, 200, 5000, 0.25, 0.7), 0, 1.0)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, mono(i_trumpet(m, 0.14)), 0.2 + i * 0.08, 0.28)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.6, 0.13)
    S_["allclear"] = y
    # deal: three quick soft plops (new pieces slide in)
    n = ns(0.5); y = np.zeros(n)
    for i in range(3): put(y, plop(380 + i * 120, 0.08, 0.35), i * 0.07, 1.0)
    S_["deal"] = y
    # undo: a quick rewind
    d = 0.28; n = ns(d); t = tt(n)
    S_["undo"] = np.sin(2 * np.pi * np.cumsum(1200 * (0.4 ** (t / d))) / SR) * env(n, 0.004, 0.1) * 0.45
    # swap: a whirlpool swirl
    n = ns(0.7); y = np.zeros(n)
    put(y, wave(0.6, 400, 2800, 0.25, 0.45), 0, 1.0)
    for i, m in enumerate((79, 83, 86, 91)): put(y, i_kalimba(m, 0.3), 0.1 + i * 0.06, 0.2)
    S_["swap"] = y
    # over: a sinking glub-glub
    n = ns(1.4); y = np.zeros(n)
    for i, f in enumerate((420, 330, 250)):
        d = 0.32; t = tt(ns(d))
        put(y, np.sin(2 * np.pi * np.cumsum(f * (0.7 ** (t / d))) / SR) * env(ns(d), 0.01, 0.12) * 0.5, i * 0.28, 1.0)
    for i, m in enumerate((72, 68, 65, 60)): put(y, mono(i_harp(m, 0.5)), 0.1 + i * 0.16, 0.2)
    S_["over"] = y
    # win: a sunny fanfare — steel drum run, bells, a splash
    n = ns(2.8); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_steel(m, 0.4), i * 0.09, 0.35)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.4), 0.5, 0.13)
    put(y, wave(1.0, 300, 4000, 0.2, 0.35), 0.45, 1.0)
    S_["win"] = y
    # open: a bubbly whoosh
    n = ns(0.8); y = np.zeros(n)
    put(y, wave(0.5, 400, 3000, 0.2, 0.35), 0, 1.0)
    for i in range(5): put(y, plop(400 + i * 90, 0.07, 0.25), 0.15 + i * 0.05, 1.0)
    S_["open"] = y
    # power: a power-up chime
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((79, 84, 88, 91)): put(y, i_glock(m, 0.35), i * 0.06, 0.28)
    S_["power"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_tide_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_tide.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
