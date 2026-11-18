"""Puddo's Clayland: Rain Raid sound pack: an action track for each of the 20 zones (each its own genre), the calm map
theme, and boss, chase, bonus and Golden Sprout tracks, plus the game's sound effects (springy clay jumps, the Rain
Blaster's watery shots per weapon, thunder-splash Storm Bombs, Dusties melting into mud, ambush alarms and gates, pumps,
cages, keys, the Splash Gong, the Rain Bell...). All original melodies, made from motifs in each zone's own mode.

usage: python scripts/gen_clay_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = an island key (shore, grove, ...), map, boss, chase, bonus, star, music, or sfx.
  Files: music_clay_<key>_action (music_clay_map_calm), sfx_clay_<name>.
Reuses the studio of gen_kiko_audio.py (→ gen_dash_audio.py → … → gen_racing_audio.py).
"""
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
_kiko = open(os.path.join(HERE, "gen_kiko_audio.py"), encoding="utf-8").read()
exec(_kiko[: _kiko.index(chr(10) + "def run_music():")])
exec(_kiko[_kiko.index(chr(10) + "def st2(y)"): _kiko.index(chr(10) + "def sfx():")])
STYLES.clear()  # noqa: F821
META = {"music": {}, "sfx": {}}  # noqa: F811

SCALES = {"maj": [0, 2, 4, 5, 7, 9, 11], "min": [0, 2, 3, 5, 7, 8, 10], "dor": [0, 2, 3, 5, 7, 9, 10], "phr": [0, 1, 3, 5, 7, 8, 10],
          "lyd": [0, 2, 4, 6, 7, 9, 11], "mix": [0, 2, 4, 5, 7, 9, 10], "hmin": [0, 2, 3, 5, 7, 8, 11]}


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


def uke(m, d): return i_pluck(m, 0.35, 6000.0, 700.0, 0.06, 0.28)
def flute(m, d): return i_lead(m, d, None, 3000.0, 0.012, 0.0, 0.45)


# name: (bpm, prog, mode, root, lead, stabs, bass, kit, lo, pad, second)
def island_styles():
    T_ = lambda k, root, mode: notes(tune(root, mode, hash(k) & 0xFFFF))
    return {
        "shore": (124, ["C", "F", "G", "C"], T_("shore", 72, "maj"), uke, stabs(lambda m, d: i_steel(m, 0.3), (2, 6, 10, 14), 0.12), bass_walk, kit_jungle, 36, None, lambda m, d: i_marimba(m, 0.35)),
        "grove": (128, ["G", "C", "D", "G"], T_("grove", 79, "maj"), lambda m, d: i_accordion(m, d), stabs(lambda m, d: i_clean(m, d, 1), (2, 6, 10, 14), 0.14), bass_oompah, kit_gallop, 31, None, lambda m, d: i_clarinet(m, d)),
        "caves": (118, ["Am", "F", "G", "E"], T_("caves", 69, "hmin"), lambda m, d: i_marimba(m, 0.5), stabs(lambda m, d: i_bell(m, 0.6), (3, 7, 11, 15), 0.1), bass_sub, kit_tribal, 33, lambda m, d: i_strings(m, d, 0.4, False, 2200.0), lambda m, d: i_kalimba(m, 0.4)),
        "lagoon": (122, ["F", "C", "Dm", "C"], T_("lagoon", 77, "maj"), lambda m, d: i_steel(m, 0.45), stabs(lambda m, d: i_marimba(m - 12, 0.3), (2, 5, 10, 13), 0.13), bass_walk, kit_jungle, 29, None, lambda m, d: i_kalimba(m, 0.35)),
        "cliffs": (126, ["D", "A", "Bm", "G"], T_("cliffs", 74, "lyd"), flute, stabs(lambda m, d: i_harp(m, 0.5), (2, 6, 10, 14), 0.12), bass_pulse(650.0), kit_sleigh, 38, lambda m, d: i_strings(m, d, 0.35, False, 2800.0), lambda m, d: i_glock(m, 0.3)),
        "candy": (132, ["C", "Am", "F", "G"], T_("candy", 84, "maj"), lambda m, d: i_synthpluck(m, 0.35), stabs(lambda m, d: i_toypiano(m, 0.3), (2, 6, 10, 14), 0.12, 12), bass_pulse(900.0), kit_edm, 36, None, lambda m, d: i_glock(m, 0.3)),
        "toybox": (130, ["G", "D", "C", "D"], T_("toybox", 79, "mix"), lambda m, d: i_musicbox(m, 0.5), stabs(lambda m, d: i_toypiano(m, 0.3), (2, 6, 10, 14), 0.12, 12), bass_chip, kit_chip, 31, None, lambda m, d: mono(i_chip(m, d, 0.25))),
        "mire": (114, ["Em", "C", "Am", "B"], T_("mire", 64, "dor"), lambda m, d: i_pluck(m, 0.3, 3200.0, 400.0, 0.05, 0.25), stabs(lambda m, d: i_tuba(m, d), (0, 8), 0.16, -12), bass_walk, kit_swing, 28, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_clarinet(m, d)),
        "peaks": (126, ["D", "G", "A", "D"], T_("peaks", 74, "maj"), i_celesta, stabs(lambda m, d: i_snowbell(m, 0.4), (2, 6, 10, 14), 0.12), bass_pulse(700.0), kit_sleigh, 38, lambda m, d: i_strings(m, d, 0.3, False, 2800.0), lambda m, d: i_bell(m, 0.6)),
        "dunes": (120, ["Em", "F", "Em", "D"], T_("dunes", 76, "phr"), lambda m, d: i_clarinet(m, d), stabs(lambda m, d: i_pluck(m, 0.3, 4500.0, 500.0, 0.05, 0.25), (3, 6, 11, 14), 0.13), bass_tribal, kit_tribal, 28, lambda m, d: i_strings(m, d, 0.3, False, 2600.0), lambda m, d: i_kalimba(m, 0.4)),
        "lantern": (110, ["Fm", "C#", "D#", "C"], T_("lantern", 77, "min"), i_celesta, stabs(lambda m, d: i_harp(m, 0.6), (2, 10), 0.1), bass_walk, kit_swing, 29, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_glock(m, 0.3)),
        "factory": (126, ["Dm", "G", "Dm", "A"], T_("factory", 74, "dor"), lambda m, d: i_clav(m, d), stabs(lambda m, d: i_brass(m, d, True, 2600.0), (0, 6, 12), 0.16), bass_walk, kit_rock, 26, None, lambda m, d: i_epiano(m, d)),
        "temple": (122, ["Am", "G", "F", "E"], T_("temple", 69, "hmin"), lambda m, d: i_kalimba(m, 0.5), stabs(lambda m, d: i_marimba(m, 0.4), (3, 6, 11, 14), 0.15), bass_tribal, lambda S, b: (kit_tribal(S, b), S.put("drums", k_taiko(), S.T(b, 12), 0.4, 0, 0.2)), 33, None, flute),
        "clouds": (120, ["F", "Bb", "C", "F"], T_("clouds", 77, "lyd"), lambda m, d: i_harp(m, 0.7), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_pulse(600.0), kit_sleigh, 29, lambda m, d: i_strings(m, d, 0.4, False, 3000.0), lambda m, d: i_celesta(m, 0.5)),
        "neon": (128, ["Am", "F", "C", "G"], T_("neon", 81, "min"), lambda m, d: mono(i_ssaw(m, d, 4200.0, 0.01, 0.3, 0.01, 5)), stabs(lambda m, d: i_pluck(m, 0.3, 7000.0, 600.0, 0.06, 0.2), (2, 6, 10, 14), 0.12), bass_reese, kit_edm, 33, lambda m, d: mono(i_ssaw(m, d, 1800.0, 0.4, 0.8, 0.012, 5)) * 0.4, lambda m, d: i_bell(m, 0.5)),
        "volcano": (136, ["Cm", "G#", "Fm", "G"], T_("volcano", 72, "hmin"), lambda m, d: i_brass(m, d, False, 3400.0), stabs(lambda m, d: i_brass(m, d, True, 2600.0), (0, 6, 12), 0.18), bass_reese, lambda S, b: (kit_rock(S, b, True), S.put("drums", k_taiko(), S.T(b, 12), 0.45, 0, 0.2)), 24, None, lambda m, d: i_marimba(m, 0.4)),
        "crystal": (118, ["Bm", "G", "Em", "F#"], T_("crystal", 71, "min"), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_glock(m, 0.3), (3, 7, 11, 15), 0.1, 12), bass_sub, kit_tribal, 35, lambda m, d: mono(i_ssaw(m, d, 1800.0, 0.4, 0.8, 0.012, 5)) * 0.4, lambda m, d: i_celesta(m, 0.5)),
        "pirate": (128, ["Dm", "A", "Dm", "C"], T_("pirate", 74, "dor"), lambda m, d: i_accordion(m, d), stabs(lambda m, d: i_clean(m, d, 2), (2, 6, 10, 14), 0.15), bass_oompah, kit_gallop, 26, None, lambda m, d: i_tuba(m, d)),
        "moon": (124, ["Em", "C", "G", "D"], T_("moon", 76, "dor"), lambda m, d: mono(i_chip(m, d, 0.25)), stabs(lambda m, d: i_pluck(m, 0.3, 6500.0, 600.0, 0.06, 0.2), (2, 6, 10, 14), 0.12), bass_sub, kit_edm, 28, lambda m, d: i_choir(m, d, 0.4), lambda m, d: i_bell(m, 0.5)),
        "castle": (132, ["Cm", "Ab", "Eb", "Bb"], T_("castle", 72, "min"), lambda m, d: i_brass(m, d, False, 3600.0), stabs(lambda m, d: i_strings(m, d, 0.02, True, 3600.0), (0, 2, 4, 6, 8, 10, 12, 14), 0.08), bass_pulse(900.0), kit_march, 24, lambda m, d: i_strings(m, d, 0.3, False, 2600.0), lambda m, d: i_choir(m, d, 0.3)),
        "boss": (148, ["Em", "C", "Am", "B"], notes(tune(76, "hmin", 777)), lambda m, d: i_brass(m, d, False, 3600.0), stabs(lambda m, d: i_strings(m, d, 0.02, True, 3600.0), (0, 2, 4, 6, 8, 10, 12, 14), 0.08), bass_pulse(900.0), lambda S, b: (kit_rock(S, b, True), S.put("drums", k_taiko(), S.T(b, 14), 0.5, 0, 0.2)), 28, None, lambda m, d: i_marimba(m, 0.35)),
        "chase": (152, ["Dm", "A#", "C", "A"], notes(tune(74, "min", 4242)), lambda m, d: i_brass(m, d, False, 3200.0), stabs(lambda m, d: i_pluck(m, 0.3, 6000.0, 500.0, 0.05, 0.2), (2, 6, 10, 14), 0.14), bass_reese, kit_tribal, 26, None, lambda m, d: i_marimba(m, 0.4)),
        "bonus": (140, ["C", "G", "Am", "F"], notes(tune(84, "maj", 99)), lambda m, d: mono(i_chip(m, d, 0.25)), stabs(lambda m, d: i_toypiano(m, 0.3), (2, 6, 10, 14), 0.12, 12), bass_chip, kit_chip, 36, None, lambda m, d: i_glock(m, 0.3)),
        "star": (164, ["C", "F", "G", "C"], notes(tune(84, "lyd", 7)), lambda m, d: i_glock(m, 0.4), stabs(lambda m, d: i_synthpluck(m, 0.3), (0, 2, 4, 6, 8, 10, 12, 14), 0.1, 12), bass_pulse(1100.0), kit_edm, 36, None, lambda m, d: i_celesta(m, 0.4)),
    }


def make_style(spec):
    bpm, prog, hook, lead, chords, bass, kit, lo, pad, second = spec
    def fn(S, act): runner(S, prog, hook, lead, chords, bass, kit, lo, pad=pad, second=second)
    return fn


def st_map(S, act):
    # the calm island-map theme: ukulele, celesta and soft strings over a gentle shuffle
    prog = ["C", "Am", "F", "G"] * 2
    hook = notes(tune(72, "maj", 2026))
    for bar, c in enumerate(prog):
        r = root(c, 36)
        for st_ in (0, 4, 8, 12): S.put("music", uke(r + 24 + (st_ // 4 % 2) * 7, 0.3), S.T(bar, st_), 0.12, 0.2, 0.15)
        for m in vc(c, 55): S.put("music", i_strings(m, S.st * 15, 0.5, False, 2400.0), S.T(bar, 0), 0.07, 0, 0.3)
        S.put("music", i_bass(r, S.st * 6, 600.0, 0.12, 0.6, 1.2), S.T(bar, 0), 0.22, 0, 0)
        if bar % 2: S.put("drums", k_shaker(), S.T(bar, 6), 0.08, -0.3)
    S.seq("music", i_celesta, hook, 0, 0.28, 0.1, 0.3, 0.15)


SPECS = island_styles()
for key, spec in SPECS.items():
    style(key, spec[0], 16, spec[0], 16, 1.3, 1.3, sc=(0.05, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(make_style(spec))
style("map", 100, 8, 100, 8, 1.6, 1.6, sc=(0.0, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(-2.0, 0.0, -2.0))(st_map)


def run_music():
    for key, spec in STYLES.items():
        act = key != "map"
        v = "action" if act else "calm"
        if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
        bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
        S = Song(f"clay_{key}_{v}", bpm, bars, rt, sw)
        spec["fn"](S, act)
        S.render(-16.5 if act else -17.0, sc, None, 0.55, dl, tag=v, bal=bal)
        print("music", key, round(bars * 4 * 60 / bpm, 6), flush=True)


def sfx():
    if ONLY and "sfx" not in ONLY: return
    S_ = {}

    def ctone(f, d, dec):
        m = ns(d); t = tt(m)
        w = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 2 * f * t) + 0.14 * np.sin(2 * np.pi * 3 * f * t)
        w = w + 0.22 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.04)
        return w * env(m, 0.0015, dec)

    def squelch(d=0.25, f0=180.0, f1=520.0, g=0.6):
        n = ns(d); t = tt(n)
        y = sweep_tone(f0, f1, d * 0.6) * env(ns(d * 0.6), 0.004, d * 0.2)
        y = np.concatenate([y, np.zeros(n - len(y))])
        return y * g + lp(nz(n), 1400) * env(n, 0.002, d * 0.25) * 0.45

    # movement
    d = 0.32; n = ns(d); t = tt(n)
    f = 260 * (2.6 ** (t / d)) * (1 + 0.06 * np.sin(2 * np.pi * 24 * t) * np.exp(-t / 0.12))
    S_["jump"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, 0.12) * 0.8
    d = 0.22; n = ns(d); t = tt(n)
    S_["land"] = np.sin(2 * np.pi * np.cumsum(110 * (0.5 ** (t / d))) / SR) * env(n, 0.002, 0.05) + 0.5 * lp(nz(n), 600) * env(n, 0.001, 0.05)
    # coins, fruit, drops, hearts, juice
    n = ns(0.5); y = np.zeros(n)
    put(y, ctone(1175, 0.07, 0.045), 0, 0.5); put(y, ctone(1568, 0.42, 0.13), 0.055, 0.72); put(y, hp(nz(ns(0.05)), 7500) * env(ns(0.05), 0.001, 0.012), 0.055, 0.06)
    S_["coin"] = y
    d = 0.32; n = ns(d)
    y = sweep_tone(300, 1000, 0.12) * env(ns(0.12), 0.003, 0.05)
    S_["fruit"] = np.concatenate([y, np.zeros(n - len(y))]) + bp(nz(n), 1500, 5000) * env(n, 0.002, 0.03) * 0.4 + hp(sweep_filt(nz(n), "low", 3000, 700), 300) * env(n, 0.01, 0.08) * 0.35
    n = ns(1.1); y = np.zeros(n)
    put(y, sweep_tone(600, 1400, 0.09) * env(ns(0.09), 0.002, 0.04), 0, 0.7)
    for i, m in enumerate((84, 88, 91, 96)): put(y, i_glock(m, 0.5), 0.08 + i * 0.07, 0.35)
    S_["drop"] = y
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84)): put(y, i_marimba(m, 0.3), i * 0.07, 0.6)
    S_["heart"] = y
    d = 0.6; n = ns(d)
    y = hp(sweep_filt(nz(n), "low", 600, 2400, curve=0.8), 200) * env(n, 0.03, 0.25) * 0.7
    put(y, sweep_tone(260, 160, 0.2) * env(ns(0.2), 0.005, 0.08), 0.35, 0.6)
    S_["juice"] = y
    # ouch
    n = ns(0.7); y = np.zeros(n)
    put(y, kvoice([520, 380, 300], 0.4, ((800, 1.0), (1300, 0.5)), 0.05, 0.1), 0, 0.9)
    put(y, np.sin(2 * np.pi * np.cumsum(140 * (0.5 ** (tt(ns(0.25)) / 0.25))) / SR) * env(ns(0.25), 0.002, 0.08), 0, 0.6)
    S_["hurt"] = y
    n = ns(0.9); y = np.zeros(n)
    put(y, bp(nz(ns(0.08)), 1500, 7000) * env(ns(0.08), 0.001, 0.02), 0, 0.9)
    put(y, kglide([600, 300, 180], 0.7, 0.02, 5.0, (1.0, 0.4)) * env(ns(0.7), 0.01, 0.3), 0.06, 0.4)
    S_["crack"] = y
    # splats
    d = 0.22; n = ns(d)
    S_["splat"] = hp(sweep_filt(nz(n), "low", 900, 3800, curve=0.7), 300) * np.sin(np.pi * tt(n) / d) ** 1.5 * 0.7 + sweep_tone(500, 900, d) * env(n, 0.002, 0.06) * 0.25
    S_["wrap"] = squelch(0.32, 160, 420, 0.7)
    d = 0.3; n = ns(d); t = tt(n)
    S_["kick"] = np.sin(2 * np.pi * 420 * t) * env(n, 0.001, 0.025) * 0.6 + hp(sweep_filt(nz(n), "low", 700, 3500, curve=0.6), 300) * np.sin(np.pi * t / d) * 0.5
    d = 0.45; n = ns(d); t = tt(n)
    y = np.sin(2 * np.pi * np.cumsum(90 * (0.45 ** (t / d))) / SR) * env(n, 0.002, 0.14) + lp(nz(n), 500) * env(n, 0.001, 0.07) * 0.6
    put(y, squelch(0.3, 140, 300, 0.3), 0.02, 1.0)
    S_["stomp"] = y
    n = ns(0.45); y = np.zeros(n)
    put(y, sweep_tone(900, 300, 0.12) * env(ns(0.12), 0.002, 0.05), 0, 0.6); put(y, i_glock(96, 0.2), 0.02, 0.15); put(y, kvoice([900, 1300], 0.18, ((1200, 1.0), (2400, 0.5)), 0.1, 0.05), 0.04, 0.35)
    S_["squash"] = y
    n = ns(0.6); y = np.zeros(n)
    for i in range(5): put(y, bp(nz(ns(0.08)), 600 + i * 300, 4000) * env(ns(0.08), 0.001, 0.03), i * 0.05, 0.7 - i * 0.1)
    S_["break"] = y
    n = ns(0.8); y = np.zeros(n)
    put(y, bp(nz(ns(0.07)), 2500, 9000) * env(ns(0.07), 0.001, 0.02), 0, 0.8); put(y, i_bell(91, 0.5), 0.01, 0.2); put(y, i_bell(86, 0.5), 0.05, 0.15)
    for i in range(4): put(y, bp(nz(ns(0.05)), 2000, 7000) * env(ns(0.05), 0.001, 0.02), 0.1 + i * 0.06, 0.25)
    S_["pot"] = y
    # friends
    n = ns(1.4); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_glock(m, 0.6), i * 0.08, 0.4); put(y, i_marimba(m - 12, 0.3), i * 0.08, 0.3)
    put(y, kvoice([500, 700, 900], 0.5, ((900, 1.0), (1500, 0.5)), 0.04, 0.05), 0.45, 0.5)
    S_["friend"] = y
    n = ns(0.9); y = np.zeros(n)
    put(y, kglide([500, 420, 300], 0.7, 0.03, 5.0, (1.0, 0.5, 0.25)) * env(ns(0.7), 0.02, 0.3), 0, 0.5)
    S_["lost"] = y
    n = ns(1.4); y = np.zeros(n)
    put(y, ctone(1047, 0.2, 0.08), 0, 0.5); put(y, ctone(1568, 0.6, 0.2), 0.12, 0.6)
    put(y, kvoice([600, 900, 800], 0.45, ((1000, 1.0), (1700, 0.5)), 0.04, 0.08), 0.3, 0.55)
    S_["checkpoint"] = y
    # the Splash Gong: inharmonic partials with a long shimmer
    n = ns(3.2); t = tt(n); y = np.zeros(n)
    for k, (fr, g, dec) in enumerate(((180, 1.0, 1.4), (264, 0.7, 1.1), (377, 0.5, 0.9), (515, 0.35, 0.7), (690, 0.25, 0.5), (941, 0.15, 0.35))):
        y += np.sin(2 * np.pi * fr * t * (1 + 0.004 * np.sin(2 * np.pi * 3 * t))) * np.exp(-t / dec) * g
    y = y * np.minimum(1, t / 0.003) + lp(nz(n), 900) * env(n, 0.001, 0.05) * 0.5
    S_["gong"] = y * 0.6
    d = 0.7; n = ns(d); t = tt(n)
    f = (170 + 380 * (1 - np.exp(-t / 0.08))) * (1 + 0.16 * np.sin(2 * np.pi * 13 * t) * np.exp(-t / 0.3))
    S_["bounce"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, 0.28) * 0.9
    d = 0.5; n = ns(d); t = tt(n)
    S_["spring"] = np.sin(2 * np.pi * np.cumsum(500 + 600 * t / d + 80 * np.sin(2 * np.pi * 30 * t)) / SR) * env(n, 0.003, 0.18) * 0.6
    d = 0.35; n = ns(d)
    S_["swim"] = bp(nz(n), 300, 1800) * env(n, 0.02, 0.12) * 0.6 + sweep_tone(300, 600, d) * env(n, 0.01, 0.1) * 0.2
    d = 0.8; n = ns(d)
    S_["splash"] = hp(nz(n), 1200) * env(n, 0.003, 0.25) * 0.7 + lp(nz(n), 600) * env(n, 0.002, 0.12) * 0.5
    n = ns(0.5); y = np.zeros(n)
    put(y, bp(nz(ns(0.02)), 2000, 8000) * env(ns(0.02), 0.001, 0.006), 0, 0.8); put(y, i_marimba(79, 0.2), 0.02, 0.4); put(y, i_marimba(86, 0.2), 0.1, 0.4)
    S_["switch"] = y
    n = ns(1.6); y = np.zeros(n)
    for i in range(10): put(y, i_glock(84 + (i * 4) % 17, 0.4), i * 0.06, 0.25)
    put(y, hp(sweep_filt(nz(ns(1.2)), "low", 2000, 9000, curve=0.6), 1500) * env(ns(1.2), 0.1, 0.5) * 0.2, 0, 1.0)
    S_["star"] = y
    n = ns(0.9); y = np.zeros(n)
    for i in range(2): put(y, bp(nz(ns(0.04)), 3000, 9000) * env(ns(0.04), 0.001, 0.01), i * 0.12, 0.7)
    put(y, kvoice([300, 380, 300, 380], 0.5, ((600, 1.0), (1100, 0.5)), 0.1, 0.1), 0.3, 0.5)
    S_["pinch"] = y
    # hazards
    d = 0.6; n = ns(d)
    S_["fire"] = (hp(nz(n), 1500) * 0.5 + lp(nz(n), 400) * 0.6) * env(n, 0.05, 0.25) * 0.6
    d = 0.4; n = ns(d); t = tt(n)
    S_["laser"] = np.sign(np.sin(2 * np.pi * np.cumsum(1800 * (0.4 ** (t / d))) / SR)) * env(n, 0.002, 0.12) * 0.3
    d = 0.6; n = ns(d); t = tt(n)
    S_["crusher"] = np.sin(2 * np.pi * np.cumsum(70 * (0.5 ** (t / d))) / SR) * env(n, 0.002, 0.2) + lp(nz(n), 300) * env(n, 0.001, 0.12) * 0.8 + bp(nz(n), 1500, 5000) * env(n, 0.001, 0.03) * 0.3
    d = 0.35; n = ns(d)
    S_["arrow"] = kglide([2200, 1500], d, 0, 1.0, (1.0,)) * env(n, 0.005, 0.12) * 0.3 + hp(nz(n), 3000) * env(n, 0.002, 0.08) * 0.3
    d = 0.9; n = ns(d); t = tt(n)
    S_["cannon"] = np.sin(2 * np.pi * np.cumsum(60 * (0.4 ** (t / d))) / SR) * env(n, 0.002, 0.3) + lp(nz(n), 700) * env(n, 0.001, 0.2) * 0.9
    d = 0.9; n = ns(d); t = tt(n)
    S_["geyser"] = hp(nz(n), 2500) * np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.25) / 0.3) * 0.6 + lp(nz(n), 400) * env(n, 0.02, 0.2) * 0.3
    d = 0.35; n = ns(d); t = tt(n)
    S_["rock"] = np.sin(2 * np.pi * np.cumsum(120 * (0.5 ** (t / d))) / SR) * env(n, 0.002, 0.1) + bp(nz(n), 400, 2500) * env(n, 0.001, 0.05) * 0.7
    n = ns(0.5); y = np.zeros(n)
    put(y, bp(nz(ns(0.05)), 3000, 9000) * env(ns(0.05), 0.001, 0.01), 0, 0.8); put(y, i_bell(96, 0.4), 0.01, 0.2)
    S_["ice"] = y
    n = ns(0.6); y = np.zeros(n)
    for i in range(2): put(y, sweep_tone(1400, 700, 0.09) * env(ns(0.09), 0.002, 0.04), i * 0.22, 0.5)
    S_["low"] = y
    # bosses and bells
    n = ns(0.8); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(160 * (0.4 ** (tt(ns(0.3)) / 0.3))) / SR) * env(ns(0.3), 0.002, 0.1), 0, 0.8)
    put(y, kvoice([500, 800, 400], 0.45, ((700, 1.0), (1300, 0.5)), 0.1, 0.1), 0.05, 0.6)
    S_["bosshit"] = y
    n = ns(1.1); y = np.zeros(n)
    put(y, kvoice([180, 150, 120], 0.9, ((450, 1.0), (800, 0.5)), 0.08, 0.25), 0, 1.0)
    S_["roar"] = y
    n = ns(2.2); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(80 * (0.3 ** (tt(ns(0.8)) / 0.8))) / SR) * env(ns(0.8), 0.002, 0.3) + lp(nz(ns(0.8)), 600) * env(ns(0.8), 0.001, 0.25), 0, 0.9)
    for i, m in enumerate((72, 76, 79, 84, 79, 84, 88)): put(y, i_brass(m, 0.25, True, 3000.0), 0.6 + i * 0.12, 0.25)
    S_["bossdown"] = y
    n = ns(4.0); t = tt(n); y = np.zeros(n)
    for fr, g, dec in ((392, 1.0, 2.2), (784, 0.6, 1.6), (933, 0.4, 1.2), (1176, 0.35, 1.0), (1568, 0.2, 0.7), (196, 0.5, 2.6)):
        y += np.sin(2 * np.pi * fr * t) * np.exp(-t / dec) * g
    y = y * np.minimum(1, t / 0.002)
    for i in range(6): put(y, i_glock(84 + [0, 4, 7, 12, 7, 16][i], 0.6), 0.6 + i * 0.15, 0.2)
    S_["bell"] = y * 0.55
    d = 0.7; n = ns(d)
    S_["stretch"] = kglide([200, 260, 520], d, 0.03, 8.0, (1.0, 0.5, 0.3, 0.2)) * env(n, 0.02, 0.3) * 0.5
    d = 0.5; n = ns(d); t = tt(n)
    S_["hover"] = np.sin(2 * np.pi * np.cumsum(600 + 120 * np.sin(2 * np.pi * 8 * t)) / SR) * env(n, 0.05, 0.2) * 0.25
    # Puddo's voice: a small, bright clay-sprite voice — "yay!", "ooh!", "aww…"
    n = ns(0.75); y = np.zeros(n)
    put(y, kvoice([620, 880, 1050], 0.32, ((950, 1.0), (1700, 0.55)), 0.05, 0.04), 0, 0.9)
    put(y, kvoice([980, 1180], 0.22, ((1100, 1.0), (2100, 0.5)), 0.08, 0.03), 0.3, 0.6)
    S_["puddo_happy"] = y
    n = ns(0.7); y = np.zeros(n)
    put(y, kvoice([520, 860, 700], 0.55, ((520, 1.0), (950, 0.45)), 0.04, 0.05), 0, 0.9)
    S_["puddo_wow"] = y
    n = ns(0.8); y = np.zeros(n)
    put(y, kvoice([760, 560, 420, 380], 0.65, ((780, 1.0), (1250, 0.5)), 0.06, 0.08), 0, 0.85)
    S_["puddo_sad"] = y
    # ---------------------------------------------------------------- Rain Raid: the Rain Blaster, bombs, the Dust Army
    def plip(f0=1500.0, f1=620.0, d=0.11, g=0.7):
        n = ns(d); y = sweep_tone(f0, f1, d) * env(n, 0.001, d * 0.35) * g
        return y + bp(nz(n), 1800, 6500) * env(n, 0.0008, 0.012) * 0.35 + lp(nz(n), 900) * env(n, 0.001, 0.02) * 0.2
    S_["shot"] = plip()
    n = ns(0.16); y = np.zeros(n)
    for i, f in enumerate((1300, 1550, 1800)): put(y, plip(f, f * 0.45, 0.1, 0.45), i * 0.012, 1.0)
    S_["shot_spread"] = y
    S_["shot_rapid"] = plip(1250, 700, 0.07, 0.6)
    n = ns(0.2); y = np.zeros(n)
    put(y, ctone(2300, 0.18, 0.05), 0, 0.5); put(y, ctone(3450, 0.12, 0.03), 0, 0.25); put(y, bp(nz(ns(0.02)), 4000, 11000) * env(ns(0.02), 0.0005, 0.006), 0, 0.5)
    S_["shot_hail"] = y
    d = 0.16; n = ns(d); t = tt(n)
    S_["shot_zap"] = np.sign(np.sin(2 * np.pi * np.cumsum(1300 * (0.35 ** (t / d)) * (1 + 0.3 * np.sin(2 * np.pi * 90 * t))) / SR)) * env(n, 0.001, 0.05) * 0.28 + hp(nz(n), 3000) * env(n, 0.001, 0.03) * 0.3
    n = ns(0.22); y = np.zeros(n)
    put(y, plip(1700, 900, 0.1, 0.5), 0, 1.0); put(y, i_glock(96, 0.18), 0.01, 0.18); put(y, i_glock(100, 0.15), 0.05, 0.12)
    S_["shot_rainbow"] = y
    d = 0.32; n = ns(d); t = tt(n)
    S_["shot_geyser"] = hp(sweep_filt(nz(n), "low", 4000, 900, curve=0.7), 400) * env(n, 0.003, 0.12) * 0.8 + np.sin(2 * np.pi * np.cumsum(140 * (0.5 ** (t / d))) / SR) * env(n, 0.002, 0.06) * 0.5
    d = 0.35; n = ns(d)
    S_["bomb_throw"] = hp(sweep_filt(nz(n), "low", 800, 3200, curve=0.8), 300) * np.sin(np.pi * tt(n) / d) * 0.45 + sweep_tone(300, 650, d) * env(n, 0.01, 0.15) * 0.25
    # the thunder-splash: a deep boom, a crack, then rain hiss
    n = ns(1.6); t = tt(n); y = np.zeros(n)
    y += np.sin(2 * np.pi * np.cumsum(70 * (0.35 ** (t / 1.6))) / SR) * np.exp(-t / 0.35) * 1.0
    y += lp(nz(n), 500) * np.exp(-t / 0.25) * 0.9
    y += bp(nz(n), 1500, 6000) * np.exp(-t / 0.05) * 0.6
    y += hp(nz(n), 3500) * np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - 0.2) / 0.5) * 0.3
    S_["boom"] = y * 0.85
    d = 0.12; n = ns(d); t = tt(n)
    S_["hitdust"] = lp(nz(n), 1200) * env(n, 0.0008, 0.03) * 0.8 + np.sin(2 * np.pi * 320 * t) * env(n, 0.001, 0.025) * 0.4
    n = ns(0.3); y = np.zeros(n)
    put(y, ctone(880, 0.25, 0.06), 0, 0.5); put(y, ctone(1340, 0.2, 0.04), 0, 0.35); put(y, bp(nz(ns(0.03)), 2500, 8000) * env(ns(0.03), 0.001, 0.008), 0, 0.6)
    S_["shield"] = y
    # a Dustie melts back into mud: a squelchy plop, a drip
    n = ns(0.5); y = np.zeros(n)
    put(y, squelch(0.3, 420, 130, 0.7), 0, 1.0); put(y, plip(1800, 900, 0.08, 0.35), 0.16, 1.0); put(y, lp(nz(ns(0.2)), 700) * env(ns(0.2), 0.002, 0.07), 0, 0.5)
    S_["melt"] = y
    n = ns(0.9); y = np.zeros(n)
    for i, m in enumerate((79, 84, 88, 91, 96)): put(y, i_glock(m, 0.4), i * 0.055, 0.35)
    put(y, hp(sweep_filt(nz(ns(0.5)), "low", 2500, 9000, curve=0.6), 1500) * env(ns(0.5), 0.05, 0.2) * 0.2, 0, 1.0)
    S_["pickup"] = y
    n = ns(0.5); y = np.zeros(n)
    put(y, i_glock(91, 0.3), 0, 0.4); put(y, i_glock(98, 0.35), 0.07, 0.45); put(y, ctone(1568, 0.25, 0.07), 0.07, 0.3)
    S_["combo"] = y
    n = ns(2.2); t = tt(n); y = np.zeros(n)
    put(y, hp(sweep_filt(nz(ns(1.0)), "low", 600, 6000, curve=0.6), 300) * env(ns(1.0), 0.3, 0.3) * 0.5, 0, 1.0)
    put(y, np.sin(2 * np.pi * np.cumsum(55 * (0.5 ** (tt(ns(1.4)) / 1.4))) / SR) * env(ns(1.4), 0.01, 0.5) * 0.8 + lp(nz(ns(1.4)), 400) * env(ns(1.4), 0.01, 0.4) * 0.6, 0.6, 1.0)
    for i, m in enumerate((84, 88, 91, 96, 100)): put(y, i_bell(m, 0.6), 0.6 + i * 0.07, 0.15)
    S_["super"] = y
    n = ns(1.2); y = np.zeros(n)
    for i, m in enumerate((88, 91, 95, 100)): put(y, i_bell(m, 0.6), i * 0.08, 0.2)
    S_["stormfull"] = y
    d = 0.18; n = ns(d); t = tt(n)
    S_["foeshot"] = bp(nz(n), 350, 1600) * env(n, 0.001, 0.05) * 0.7 + np.sin(2 * np.pi * np.cumsum(220 * (0.6 ** (t / d))) / SR) * env(n, 0.001, 0.04) * 0.35
    d = 0.35; n = ns(d)
    S_["spawn"] = lp(sweep_filt(nz(n), "low", 300, 1800, curve=0.7), 2500) * np.sin(np.pi * tt(n) / d) * 0.6
    n = ns(1.0); t = tt(n); y = np.zeros(n)
    y += np.sin(2 * np.pi * np.cumsum(55 * (0.6 ** (t / 1.0))) / SR) * np.exp(-t / 0.3) + lp(nz(n), 400) * np.exp(-t / 0.15) * 0.9
    put(y, ctone(420, 0.5, 0.15), 0.01, 0.35); put(y, ctone(640, 0.4, 0.1), 0.01, 0.2)
    S_["gate"] = y * 0.8
    n = ns(1.2); y = np.zeros(n)
    put(y, lp(nz(ns(0.8)), 300) * env(ns(0.8), 0.05, 0.3), 0, 0.6)
    for i, m in enumerate((72, 79, 84, 88)): put(y, i_marimba(m, 0.35), 0.15 + i * 0.09, 0.45)
    S_["door"] = y
    n = ns(1.0); y = np.zeros(n)
    for i in range(4):
        d2 = 0.22; t2 = tt(ns(d2)); f2 = 880 if i % 2 == 0 else 660
        put(y, np.sign(np.sin(2 * np.pi * f2 * t2)) * env(ns(d2), 0.005, 0.05) * 0.18 + np.sin(2 * np.pi * f2 * t2) * env(ns(d2), 0.005, 0.06) * 0.3, i * 0.23, 1.0)
    S_["alarm"] = y
    n = ns(1.8); t = tt(n); y = np.zeros(n)
    y += np.sin(2 * np.pi * np.cumsum(60 * (0.35 ** (t / 1.8))) / SR) * np.exp(-t / 0.4) + lp(nz(n), 700) * np.exp(-t / 0.3) * 0.9
    for i in range(6): put(y, bp(nz(ns(0.06)), 1500 + i * 400, 7000) * env(ns(0.06), 0.001, 0.02), 0.08 + i * 0.07, 0.5 - i * 0.06)
    put(y, hp(nz(ns(1.0)), 2500) * env(ns(1.0), 0.05, 0.4) * 0.3, 0.3, 1.0)
    S_["pump"] = y * 0.8
    n = ns(1.3); y = np.zeros(n)
    for i in range(4): put(y, bp(nz(ns(0.06)), 800 + i * 400, 5000) * env(ns(0.06), 0.001, 0.02), i * 0.04, 0.6)
    for i, m in enumerate((79, 84, 88, 91)): put(y, i_glock(m, 0.4), 0.2 + i * 0.07, 0.3)
    put(y, kvoice([800, 1100, 1300], 0.35, ((1200, 1.0), (2200, 0.5)), 0.05, 0.04), 0.35, 0.45)
    S_["cage"] = y
    n = ns(1.2); y = np.zeros(n)
    for i, m in enumerate((84, 91, 96, 103)): put(y, i_bell(m, 0.5), i * 0.07, 0.22)
    put(y, hp(nz(ns(0.4)), 5000) * env(ns(0.4), 0.02, 0.15) * 0.15, 0, 1.0)
    S_["key"] = y
    d = 0.45; n = ns(d); t = tt(n)
    S_["well"] = np.sin(2 * np.pi * np.cumsum(150 * (0.5 ** (t / d))) / SR) * env(n, 0.002, 0.12) * 0.7 + hp(nz(n), 1500) * env(n, 0.003, 0.12) * 0.4
    n = ns(1.4); y = np.zeros(n)
    for i, m in enumerate((72, 68, 65, 60)): put(y, i_marimba(m, 0.45), i * 0.16, 0.5)
    put(y, kglide([420, 300, 220], 1.0, 0.03, 5.0, (1.0, 0.5)) * env(ns(1.0), 0.02, 0.4), 0.1, 0.35)
    S_["life"] = y
    n = ns(0.6); y = np.zeros(n)
    for i in range(4): put(y, bp(nz(ns(0.07)), 500 + i * 250, 3500) * env(ns(0.07), 0.001, 0.025), i * 0.045, 0.7 - i * 0.12)
    put(y, np.sin(2 * np.pi * np.cumsum(140 * (0.5 ** (tt(ns(0.2)) / 0.2))) / SR) * env(ns(0.2), 0.002, 0.06), 0, 0.5)
    S_["crate"] = y
    for k_, y in S_.items():
        write_wav(f"sfx_clay_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_clay.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
