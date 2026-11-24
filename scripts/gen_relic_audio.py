"""Bubble Relics sound pack: a calm torch-lit home theme and one adventure track per temple chamber (Jungle Gate =
dorian marimba with kalimba, Torchlit Hall = a harmonic-minor guitar march with brass, Serpent Shrine = a snaky
clarinet over a sub bass, Crystal Caverns = celesta and bells in a choir haze, Sunken Temple = slow kalimba under
water, Golden Vault = a heroic trumpet theme, Moon Altar = soft synth plucks and choir, Dragon Sanctum = driving brass
in harmonic minor), plus the effects: shoot, wall bounce, stick, bubble pop, bomb blast, crystal crack, falling
bubbles, relic chime, firework, swap, reload, stone knock, stone crumble, combo, stage clear, star, chamber
conquered, lose, booster and the temple gong. All original. The game pans every effect to where it happens.

usage: python scripts/gen_relic_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  Files: music_relic_<key>_<action|calm>, sfx_relic_<name>.
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
        "jungle": (104, ["Dm", "C", "Dm", "Am"], T_("jungle", 74, "dor"), lambda m, d: i_marimba(m, 0.4), stabs(lambda m, d: i_kalimba(m, 0.3), (3, 7, 11, 15), 0.1), bass_walk, kit_rain, 26, lambda m, d: i_strings(m, d, 0.35, False, 2600.0), lambda m, d: i_kalimba(m, 0.5)),
        "torch": (112, ["Am", "F", "G", "E"], T_("torch", 69, "hmin"), lambda m, d: i_gtr(m, 0.3, False), stabs(lambda m, d: i_gtr(m, 0.2, True), (4, 12), 0.1), bass_oompah, kit_march, 33, lambda m, d: mono(i_brass(m, d, False, 2400.0)), lambda m, d: mono(i_trumpet(m, d))),
        "serpent": (96, ["Em", "F", "Em", "D"], T_("serpent", 76, "hmin"), lambda m, d: mono(i_clarinet(m, d)), stabs(lambda m, d: i_pluck(m, 0.25, 3000.0, 400.0, 0.05, 0.2), (3, 7, 11, 15), 0.1), bass_sub, kit_swing, 28, lambda m, d: i_strings(m, d, 0.4, False, 2200.0), lambda m, d: i_marimba(m, 0.3)),
        "crystal": (92, ["Bm", "G", "D", "A"], T_("crystal", 83, "min"), lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_bell(m, 0.4), (4, 12), 0.07), bass_sub, kit_rain, 35, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_glock(m, 0.4)),
        "sunken": (84, ["Gm", "Eb", "Bb", "F"], T_("sunken", 79, "dor"), lambda m, d: i_kalimba(m, 0.6), stabs(lambda m, d: i_epiano(m, 0.25, 0.6), (3, 11), 0.08), bass_sub, kit_rain, 31, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_bell(m, 0.5)),
        "gold": (120, ["C", "G", "Am", "F"], T_("gold", 79, "mix"), lambda m, d: mono(i_trumpet(m, d)), stabs(lambda m, d: i_glock(m, 0.25), (2, 6, 10, 14), 0.1), bass_pulse(900.0), kit_edm, 36, lambda m, d: mono(i_brass(m, d, False, 2800.0)), lambda m, d: i_glock(m, 0.4)),
        "moon": (88, ["F#m", "D", "A", "E"], T_("moon", 78, "min"), lambda m, d: i_synthpluck(m, 0.5), stabs(lambda m, d: i_bell(m, 0.4), (4, 12), 0.07), bass_sub, kit_rain, 30, lambda m, d: i_choir(m, d, 0.6), lambda m, d: i_celesta(m, 0.5)),
        "dragon": (128, ["Cm", "Ab", "Bb", "G"], T_("dragon", 72, "hmin"), lambda m, d: mono(i_brass(m, d, False, 3000.0)), stabs(lambda m, d: i_gtr(m, 0.2, True), (2, 6, 10, 14), 0.11), bass_pulse(700.0), kit_edm, 24, lambda m, d: i_strings(m, d, 0.3, False, 3000.0), lambda m, d: mono(i_trumpet(m, d))),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_title(S, act):
    # the calm temple theme: music box and marimba over soft strings, a slow shaker
    prog = ["Dm", "Bb", "F", "C", "Dm", "Bb", "Gm", "A"]
    hook = notes(tune(74, "dor", 7717))
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
        S = Song(f"relic_{key}_{v}", bpm, bars, rt, sw)
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

    # shoot: a soft "fwip" and a pluck
    n = ns(0.35); y = np.zeros(n)
    put(y, bp(nz(ns(0.16)), 900, 5000) * env(ns(0.16), 0.01, 0.06) * 0.35, 0, 1.0); put(y, plop(420, 0.08, 0.35), 0, 1.0)
    S_["shoot"] = y
    # bounce: a glass tink off the wall
    n = ns(0.5); y = np.zeros(n)
    put(y, glassy(2300, 0.4, 0.12), 0, 0.35); put(y, glassy(3450, 0.3, 0.06), 0.005, 0.12)
    S_["bounce"] = y
    # stick: a squishy bubble landing
    n = ns(0.35); y = np.zeros(n)
    put(y, plop(260, 0.1, 0.5), 0, 1.0); put(y, lp(nz(ns(0.05)), 1200) * env(ns(0.05), 0.001, 0.02) * 0.25, 0, 1.0)
    S_["stick"] = y
    # pop: a bright bubble pop with a sparkle
    n = ns(0.5); y = np.zeros(n)
    put(y, hp(nz(ns(0.02)), 3000) * env(ns(0.02), 0.0005, 0.006) * 0.9, 0, 1.0)
    put(y, plop(700, 0.05, 0.45), 0.002, 1.0); put(y, glassy(2637, 0.3, 0.07), 0.01, 0.12)
    S_["pop"] = y
    # blast: a bomb — a boom, a crackle and falling sparkle
    n = ns(1.4); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(120 * (0.35 ** (tt(ns(0.5)) / 0.5))) / SR) * env(ns(0.5), 0.002, 0.22) * 0.9, 0, 1.0)
    put(y, lp(nz(ns(0.6)), 2500) * env(ns(0.6), 0.002, 0.18) * 0.6, 0, 1.0)
    rr = random.Random(7)
    for i in range(8): put(y, hp(nz(ns(0.03)), 4000) * env(ns(0.03), 0.001, 0.01) * 0.3, 0.12 + i * 0.07 + rr.random() * 0.03, 1.0)
    S_["blast"] = y
    # thaw: an ice crack and tinkling shards
    n = ns(0.8); y = np.zeros(n)
    put(y, hp(nz(ns(0.06)), 2500) * env(ns(0.06), 0.001, 0.02) * 0.8, 0, 1.0)
    for i, f in enumerate((2400, 3100, 2800, 3600)): put(y, glassy(f, 0.3, 0.08), 0.03 + i * 0.05, 0.15)
    S_["thaw"] = y
    # fall: bubbles tumbling down — a falling cascade of plops
    n = ns(1.2); y = np.zeros(n)
    for i in range(7): put(y, plop(600 - i * 55, 0.07, 0.3 - i * 0.025), i * 0.075, 1.0)
    put(y, bp(nz(ns(0.5)), 300, 2000) * env(ns(0.5), 0.15, 0.2) * 0.18, 0, 1.0)
    S_["fall"] = y
    # relic: a golden gem collected — a bright glassy chime run
    n = ns(1.2); y = np.zeros(n)
    for i, f in enumerate((1568, 1976, 2349, 3136)): put(y, glassy(f, 0.7, 0.25), i * 0.05, 0.22)
    for i, m in enumerate((88, 95)): put(y, i_bell(m, 0.8), 0.06 + i * 0.08, 0.18)
    S_["relic"] = y
    # crumble: stones crack and tumble
    n = ns(1.0); y = np.zeros(n)
    put(y, lp(nz(ns(0.5)), 700) * env(ns(0.5), 0.005, 0.2) * 0.6, 0, 1.0)
    for i in range(6): put(y, knock(43 + (i % 3) * 3, 0.07, 0.35), 0.05 + i * 0.09, 1.0)
    S_["crumble"] = y
    # firework: a whistle up and a sparkly burst
    n = ns(1.2); y = np.zeros(n)
    put(y, chirp(900, 2400, 0.25, 0.18), 0, 1.0)
    put(y, lp(nz(ns(0.3)), 3000) * env(ns(0.3), 0.001, 0.1) * 0.55, 0.25, 1.0)
    for i in range(10): put(y, glassy(2000 + rr.random() * 2500, 0.2, 0.05), 0.28 + i * 0.05, 0.08)
    S_["firework"] = y
    # swap: a quick swoosh with two plucks
    n = ns(0.45); y = np.zeros(n)
    put(y, bp(nz(ns(0.2)), 700, 4000) * env(ns(0.2), 0.05, 0.06) * 0.3, 0, 1.0)
    put(y, pluck(79, 0.2), 0.03, 0.25); put(y, pluck(84, 0.2), 0.11, 0.25)
    S_["swap"] = y
    # load: a soft bloop as a new bubble rises in the pod
    n = ns(0.3); y = np.zeros(n)
    put(y, plop(330, 0.09, 0.3), 0, 1.0)
    S_["load"] = y
    # stone: a stone knock
    n = ns(0.4); y = np.zeros(n)
    put(y, knock(48, 0.08, 0.5), 0, 1.0); put(y, lp(nz(ns(0.08)), 900) * env(ns(0.08), 0.001, 0.03) * 0.5, 0, 1.0)
    S_["stone"] = y
    # combo: a rising arpeggio
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((79, 84, 88, 91)): put(y, mono(i_synthpluck(m, 0.3)), i * 0.05, 0.25)
    S_["combo"] = y
    # clear: a bright fanfare — toy piano run, bells and a pop
    n = ns(2.6); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_toypiano(m, 0.4), i * 0.08, 0.32)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.3), 0.45, 0.13)
    put(y, plop(700, 0.05, 0.4), 0.44, 1.0)
    S_["clear"] = y
    # star: a ding
    n = ns(1.0); y = np.zeros(n)
    put(y, glassy(1568, 0.9, 0.35), 0, 0.5); put(y, glassy(2093, 0.7, 0.25), 0.02, 0.25)
    S_["star"] = y
    # chamber: a chamber conquered — brass and bells
    n = ns(3.2); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, mono(i_trumpet(m, 0.16)), i * 0.12, 0.28)
    for m in (60, 64, 67, 72): put(y, mono(i_brass(m, 1.4, False, 3000.0)), 0.5, 0.12)
    for m in (84, 88, 91, 96): put(y, i_bell(m, 1.6), 0.6, 0.12)
    S_["chamber"] = y
    # lose: a drooping descent
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((76, 72, 69, 64)): put(y, i_toypiano(m, 0.4), i * 0.16, 0.3)
    S_["lose"] = y
    # booster: a magic shimmer
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91, 95, 100)): put(y, i_celesta(m, 0.4), i * 0.045, 0.2)
    put(y, hp(nz(ns(0.4)), 5000) * env(ns(0.4), 0.05, 0.15) * 0.12, 0, 1.0)
    S_["booster"] = y
    # open: a soft temple gong
    n = ns(2.2); y = np.zeros(n)
    t_ = tt(ns(2.0))
    put(y, (np.sin(2 * np.pi * 110 * t_) + 0.5 * np.sin(2 * np.pi * 263 * t_) + 0.3 * np.sin(2 * np.pi * 417 * t_)) * env(ns(2.0), 0.005, 0.9) * 0.4, 0, 1.0)
    put(y, i_bell(84, 1.2), 0.02, 0.12)
    S_["open"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_relic_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_relic.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
