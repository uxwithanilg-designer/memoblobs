"""Arcade sound pack #3 (the last 20 games): 20 music styles (calm + action), 14 funny SFX, voices for Momo,
Kranky and Turbo.  usage: python scripts/gen_arcade_audio3.py <momo/tools> <out-wav-dir> [only-names...]
Reuses the instruments from pack #2 (gen_arcade_audio2.py) without re-rendering that pack."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen_arcade_audio2.py"), encoding="utf-8").read()
exec(_src[: _src.index("# ---------------------------------------------------------------- 1. Memory Bridge")])
exec(_src[_src.index("def chirp"): _src.index("def s_door_open")])
exec(_src[_src.index("# ================================================================ voices"): _src.index("VOICES = {")])
ONLY = set(sys.argv[3:])
META = {"music": {}, "sfx": [], "voice": []}  # noqa: F811  (fresh manifest for this pack)


def want(name): return not ONLY or name in ONLY or name.split("_")[0] in ONLY


def chord(buf, t, notes, inst, g, spread=0.008, pan=0.0):
    for i, m in enumerate(notes): place(buf, inst(midi(m)), t + i * spread, g, pan + (i - len(notes) / 2) * 0.12)


def bell(f, d=0.6): return A._bell(f, d)


def brass(f, d=0.3): return A._brass(f, d, False) * 0.6


def theremin(f, d=0.6):
    t = T(d); ph = 2 * np.pi * np.cumsum(f * (1 + 0.02 * np.sin(2 * np.pi * 6 * t))) / SR
    return (np.sin(ph) + 0.1 * np.sin(2 * ph)) * adsr(len(t), 0.08, 0.1, 0.85, 0.15) * 0.4


def koto(f, d=0.7): return bp(pluck(f, d, 0.8, 3.5), 200, 7000) * 1.2


def taiko(f=90, d=0.5):
    t = T(d); ff = f * (1 + 0.5 * np.exp(-t * 25))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 6) + lp(noise(d), 500) * np.exp(-t * 20) * 0.4


def slap(f, d=0.22):
    t = T(d); y = tri(f, d) * np.exp(-t * 9) * 1.4
    y[:300] += hp(noise(300 / SR), 1500) * np.linspace(0.5, 0, 300)
    return y


def kazoo(f, d=0.3): return reed(f, d, (650, 1500), 0.012) * 1.1


def tuba(f, d=0.3): return reed(f, d, (280, 700), 0.004) * 1.2


def surf(f, d=0.3):
    t = T(d); y = lp(pluck(f, d, 0.75, 2.5), 4200) * (1 + 0.5 * np.sin(2 * np.pi * 9 * t))
    return y * 0.9


def mbox(f, d=0.9):
    t = T(d)
    return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 6)) * np.exp(-t * 4) * 0.35


def pop(p=1.0): return A.sfx_pop(p)


# ================================================================ 20 music styles
def mk(prog, mel, play):
    def outer(action):
        def body(buf, bpm, bars, rs, swing):
            mot = motif(rs, mel, 32, 0.5, 2)
            for s, t, bar, s16 in steps(bpm, bars, swing):
                root, ch = prog[bar % len(prog)]
                lead = [(m, ln) for (ms, m, ln) in mot if ms == s % 32]
                play(buf, t, s, bar, s16, root, ch, lead, action, rs, 60 / bpm / 4)
        return body
    return outer


def p_shadow(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 8): place(buf, pizz(midi(root - 12)), t, 0.8)
    if s16 in (4, 12): chord(buf, t, ch, pizz, 0.22)
    if action and s16 % 2 == 0: place(buf, pizz(midi(root)), t, 0.25, 0.3)
    for m, ln in lead: place(buf, bell(midi(m), 0.5), t, 0.25, rs.uniform(-0.4, 0.4))
    if bar % 2 == 1 and s16 == 0: place(buf, clarinet(midi(ch[0]), st * 12), t, 0.35, -0.3)
    if s16 % 4 == 2: place(buf, brush(), t, 0.35, 0.3)
    if action and s16 in (0, 8): place(buf, kick(), t, 0.4)


def p_guard(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 % 2 == 0: place(buf, pluck_bass(midi(root - 12 + (12 if s16 % 4 == 2 else 0)), 0.18), t, 0.6)
    if s16 in (2, 6, 10, 14): chord(buf, t, [m + 12 for m in ch], lambda f: synth_pluck(f, 0.15), 0.12)
    if s16 in (4, 12): place(buf, clap(), t, 0.45)
    if s16 % 4 == 2: place(buf, hat(True), t, 0.12, 0.35)
    if (action and s16 % 4 == 0) or s16 in (0, 8): place(buf, kick(), t, 0.55)
    for m, ln in lead: place(buf, synth_pluck(midi(m + 12), 0.2 * ln), t, 0.2, -0.3)
    if action and s16 % 2 == 1: place(buf, hat(), t, 0.08, -0.3)


def p_quick(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 6, 8, 14): chord(buf, t, ch, lambda f: nylon(f, 0.5), 0.13, 0.02)
    if s16 in (0, 3, 8, 11): place(buf, A._wood(900 if s16 % 8 == 0 else 1300, 110), t, 0.3, 0.5)
    if s16 in (0, 8): place(buf, pluck_bass(midi(root - 12), 0.4), t, 0.5)
    for m, ln in lead:
        if bar % 4 != 3: place(buf, flute(midi(m), 0.25 * ln + 0.15), t, 0.42, -0.2)
    if action:
        if s16 % 4 == 0: place(buf, kick(), t, 0.4)
        if s16 in (4, 12): place(buf, snare(0.5), t, 0.35)


def p_whack(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 8): place(buf, tuba(midi(root - 12), 0.2), t, 0.6)
    if s16 in (4, 12): chord(buf, t, ch, lambda f: reed(f, 0.12), 0.13)
    if s16 in (2, 6, 10, 14): chord(buf, t, ch, lambda f: reed(f, 0.1), 0.08)
    for m, ln in lead: place(buf, pulse(midi(m + 12), 0.1 * ln, 0.5), t, 0.3); place(buf, flute(midi(m + 12), 0.1 * ln), t, 0.15)
    if action:
        if s16 in (4, 12): place(buf, snare(0.6), t, 0.4)
        if s16 % 2 == 0: place(buf, hat(), t, 0.1, 0.3)
        if s16 % 8 == 0: place(buf, kick(), t, 0.45)


def p_voices(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 8): place(buf, tuba(midi(root - 12 + (7 if s16 == 8 else 0)), 0.25), t, 0.65)
    if s16 in (4, 12): chord(buf, t, ch, pizz, 0.2)
    for m, ln in lead: place(buf, kazoo(midi(m), 0.13 * ln + 0.05), t, 0.45, 0.15)
    if s16 % 4 == 2: place(buf, brush(), t, 0.3, -0.3)
    if bar % 4 == 3 and s16 == 14: place(buf, A.sfx_boing(1.2, 0.3), t, 0.2)
    if action:
        if s16 in (4, 12): place(buf, snare(0.5), t, 0.35)
        if s16 in (0, 8): place(buf, kick(), t, 0.45)


def p_heist(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 % 4 == 0: place(buf, pizz(midi(root - 12 + [0, 3, 5, 6][s16 // 4])), t, 0.9)
    if s16 in (6, 14): chord(buf, t, ch, lambda f: marimba(f, 0.3), 0.15)
    if s16 in (4, 12): place(buf, snap(), t, 0.4, 0.4)
    for m, ln in lead:
        if bar % 2 == 0: place(buf, reed(midi(m - 12), 0.12 * ln + 0.04, (500, 1300)), t, 0.3, -0.25)
    if action:
        if s16 % 2 == 0: place(buf, hat(), t, 0.09, 0.35)
        if s16 in (0, 10): place(buf, kick(), t, 0.4)


def p_oddblob(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 == 0: chord(buf, t, ch, lambda f: supersaw(f, st * 16), 0.09)
    if s16 in (0, 6, 10): place(buf, tri(midi(root - 12), 0.3), t, 0.55)
    if s16 in (0, 3, 6, 10, 12): place(buf, rim(), t, 0.22, -0.5)
    for m, ln in lead:
        if bar % 4 != 3: place(buf, theremin(midi(m), 0.25 * ln + 0.2), t, 0.4, 0.2)
    if action:
        if s16 % 2 == 0: place(buf, shaker(), t, 0.2, 0.4)
        if s16 in (0, 8): place(buf, kick(), t, 0.45)


def p_parade(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 8): place(buf, kick(), t, 0.5); place(buf, tuba(midi(root - 12), 0.22), t, 0.55)
    if s16 in (4, 12): place(buf, snare(0.7), t, 0.45)
    if action and s16 % 2 == 1: place(buf, snare(0.25), t, 0.3)
    if s16 in (0, 4, 8, 12): chord(buf, t, ch, lambda f: brass(f, 0.18), 0.16)
    if s16 == 0 and bar % 2 == 0: place(buf, hat(True), t, 0.18)
    for m, ln in lead: place(buf, flute(midi(m + 12), 0.1 * ln + 0.05), t, 0.35, 0.2)


def p_doors(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 3, 6): chord(buf, t, ch, lambda f: brass(f, 0.16), 0.2)
    if s16 % 2 == 0: place(buf, pluck_bass(midi(root - 12 + (7 if s16 % 8 == 6 else 0)), 0.2), t, 0.55)
    if s16 in (4, 12): place(buf, clap(), t, 0.45)
    for m, ln in lead: place(buf, bell(midi(m + 12), 0.4), t, 0.22, rs.uniform(-0.3, 0.3))
    if (action and s16 % 4 == 0) or s16 == 0: place(buf, kick(), t, 0.5)
    if action and s16 % 4 == 2: place(buf, hat(True), t, 0.12, 0.3)


def p_balance(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    arp = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1]][s16 % 6 if s16 < 12 else (s16 - 12)]
    if s16 % 2 == 0: place(buf, marimba(midi(arp + 12), 0.3), t, 0.28, -0.4 if (s16 // 4) % 2 else 0.4)
    if s16 in (0, 8): place(buf, reed(midi(root - 12), 0.35, (400, 1000)), t, 0.6)
    for m, ln in lead:
        if bar % 4 != 2: place(buf, flute(midi(m), 0.2 * ln + 0.1), t, 0.35, 0.1)
    if bar % 4 == 3 and s16 == 12: place(buf, A.sfx_boing(0.9, 0.35), t, 0.2)
    if action:
        if s16 in (0, 8): place(buf, kick(), t, 0.45)
        if s16 % 2 == 0: place(buf, shaker(), t, 0.18, 0.4)


def p_jars(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    arp = [ch[0], ch[1], ch[2], ch[1]][s16 % 4] + 12
    place(buf, synth_pluck(midi(arp), 0.12), t, 0.13 if s16 % 2 else 0.18, -0.45 if s16 % 2 else 0.45)
    if s16 % 4 == 0: place(buf, tri(midi(root - 12), 0.2), t, 0.6)
    if s16 % 4 == 2: place(buf, tri(midi(root), 0.15), t, 0.4)
    for m, ln in lead: place(buf, bell(midi(m + 12), 0.35), t, 0.25)
    if s16 in (4, 12): place(buf, clap(), t, 0.4)
    if bar % 2 == 1 and s16 == 15: place(buf, pop(1.5), t, 0.2)
    if action and s16 % 4 == 0: place(buf, kick(), t, 0.5)


def p_count(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 6, 8, 14): place(buf, pluck_bass(midi(root - 12), 0.3), t, 0.55)
    if s16 in (2, 10): chord(buf, t, ch, lambda f: marimba(f, 0.3), 0.18)
    for m, ln in lead: place(buf, marimba(midi(m + 12), 0.3), t, 0.4, rs.uniform(-0.3, 0.3))
    if s16 % 2 == 0: place(buf, shaker(), t, 0.2, 0.4)
    if s16 in (4, 12): place(buf, clap(), t, 0.4)
    if action:
        if s16 % 4 == 0: place(buf, kick(), t, 0.45)
        if s16 % 2 == 1: place(buf, hat(), t, 0.08)


def p_turbo(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 % 2 == 0: place(buf, pluck_bass(midi(root - 12), 0.15), t, 0.6)
    if s16 in (0, 3, 6, 10): chord(buf, t, ch, lambda f: surf(f, 0.25), 0.12, 0.01)
    for m, ln in lead: place(buf, surf(midi(m), 0.12 * ln + 0.08), t, 0.4, -0.2)
    if s16 in (4, 12): place(buf, snare(0.7), t, 0.45)
    if s16 in (0, 8) or (action and s16 % 4 == 0): place(buf, kick(), t, 0.55)
    if action and s16 % 2 == 1: place(buf, hat(), t, 0.1, 0.3)
    if s16 % 4 == 2: place(buf, hat(), t, 0.08, -0.3)


def p_bake(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 4, 6, 10, 12, 14): chord(buf, t, [m + 12 for m in ch], lambda f: pluck(f, 0.3, 0.75, 6), 0.1, 0.006)
    if s16 in (0, 8): place(buf, pluck_bass(midi(root - 12), 0.3), t, 0.55)
    for m, ln in lead: place(buf, bell(midi(m + 12), 0.4), t, 0.22, 0.2)
    if s16 in (4, 12): place(buf, clap(), t, 0.4)
    if action:
        if s16 % 4 == 0: place(buf, kick(), t, 0.45)
        if s16 % 2 == 0: place(buf, shaker(), t, 0.18, 0.4)


def p_slices(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 % 4 == 0: place(buf, pluck_bass(midi(root - 12 + [0, 4, 7, 9][s16 // 4]), 0.35), t, 0.6)
    if s16 in (4, 12): chord(buf, t, ch, lambda f: pluck(f, 0.35, 0.5, 5), 0.16, 0.01)
    if s16 % 4 == 2: place(buf, brush(), t, 0.4, 0.3)
    for m, ln in lead:
        if bar % 4 != 1: place(buf, clarinet(midi(m - 12), 0.15 * ln + 0.08), t, 0.38, -0.2)
    if action:
        if s16 % 4 == 0 or s16 % 4 == 3: place(buf, hat(), t, 0.1, 0.35)
        if s16 in (0, 10): place(buf, kick(), t, 0.4)


def p_ninja(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 3, 8, 11): place(buf, taiko(80 if s16 in (0, 8) else 110), t, 0.6)
    if action and s16 % 2 == 1: place(buf, taiko(160, 0.2), t, 0.25, 0.3)
    if s16 in (0, 8): place(buf, koto(midi(root - 12), 0.6), t, 0.4)
    for m, ln in lead: place(buf, koto(midi(m), 0.4), t, 0.4, rs.uniform(-0.4, 0.4))
    if bar % 4 == 2 and s16 == 0: place(buf, flute(midi(ch[2] + 12), st * 14), t, 0.3)
    if s16 % 4 == 2: place(buf, A._wood(1500, 140), t, 0.2, -0.5)


def p_ship(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 == 0: chord(buf, t, ch, lambda f: supersaw(f, st * 16 + 0.4), 0.16)
    arp = [ch[0], ch[1], ch[2], ch[1] + 12][s16 % 4] + 12
    place(buf, synth_pluck(midi(arp), 0.18), t, 0.12, -0.5 if s16 % 2 else 0.5)
    if s16 % 8 == 0: place(buf, tri(midi(root - 24), st * 8), t, 0.5)
    for m, ln in lead:
        if bar % 2 == 1: place(buf, bell(midi(m + 12), 0.8), t, 0.18, rs.uniform(-0.5, 0.5))
    if action:
        if s16 in (0, 8): place(buf, kick(), t, 0.5)
        if s16 in (4, 12): place(buf, gated_snare(), t, 0.35)


def p_pipes(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 in (0, 3, 6, 10, 11): place(buf, slap(midi(root - 12 + (12 if s16 in (3, 11) else 0))), t, 0.6)
    if s16 in (4, 12): place(buf, clap(), t, 0.4)
    if s16 in (2, 7, 14): chord(buf, t, ch, lambda f: reed(f, 0.1, (700, 1600)), 0.1)
    if s16 % 4 == 1 and rs.random() < 0.5: place(buf, pop(rs.uniform(0.8, 1.6)), t, 0.12, rs.uniform(-0.6, 0.6))
    for m, ln in lead: place(buf, synth_pluck(midi(m), 0.15 * ln), t, 0.22, 0.2)
    if action:
        if s16 % 4 == 0: place(buf, kick(), t, 0.5)
        if s16 % 2 == 1: place(buf, hat(), t, 0.09, -0.3)


def p_firefly(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 % 4 == 0: place(buf, nylon(midi(ch[(s16 // 4) % 3]), 0.9), t, 0.18, -0.3 + 0.2 * (s16 // 4))
    if s16 == 0: place(buf, nylon(midi(root - 12), 1.4), t, 0.3)
    for m, ln in lead: place(buf, mbox(midi(m + 12), 0.9), t, 0.4, rs.uniform(-0.4, 0.4))
    if action:
        if s16 % 4 == 2: place(buf, shaker(), t, 0.12, 0.4)
        if s16 == 0: place(buf, kick(), t, 0.3)


def p_maze(buf, t, s, bar, s16, root, ch, lead, action, rs, st):
    if s16 % 2 == 0: place(buf, tri(midi(root - 12 + (12 if s16 % 4 == 2 else 0)), 0.15), t, 0.6)
    place(buf, pulse(midi(ch[s % 3] + 12), 0.07, 0.125), t, 0.1, -0.4 if s % 2 else 0.4)
    for m, ln in lead: place(buf, pulse(midi(m + 12), 0.11 * ln, 0.5), t, 0.28)
    if s16 in (0, 8) or (action and s16 % 4 == 0): place(buf, kick(), t, 0.45)
    if s16 in (4, 12): place(buf, chip_noise(0.1), t, 0.55)
    if action and s16 % 2 == 1: place(buf, chip_noise(0.025), t, 0.35, 0.3)


C, Am, F, G, Dm, Em, E, Bb = ((48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62]),
                              (50, [57, 62, 65]), (52, [55, 59, 64]), (52, [56, 59, 64]), (46, [58, 62, 65]))
A7 = (45, [55, 61, 64]); D = (50, [57, 62, 66]); Bm = (47, [54, 59, 62])
MAJ = [72, 74, 76, 79, 81, 84]; MIN = [69, 72, 74, 76, 79, 81]; HARM = [69, 71, 72, 74, 76, 77, 80]
STYLES = {
    "shadow": (92, [Am, Dm, E, Am], HARM, p_shadow, 0.0),
    "guard": (116, [Em, A7, Em, A7], [76, 79, 81, 83, 86], p_guard, 0.0),
    "quick": (84, [Am, Em, F, E], [69, 72, 76, 74, 71], p_quick, 0.0),
    "whack": (132, [C, G, C, F], MAJ, p_whack, 0.0),
    "voices": (104, [F, C, G, C], MAJ, p_voices, 0.15),
    "heist": (96, [Dm, Dm, Bb, A7], [62, 65, 67, 68, 69, 72], p_heist, 0.2),
    "oddblob": (100, [Dm, G, C, Am], [74, 77, 79, 81, 84], p_oddblob, 0.0),
    "parade": (112, [C, F, G, C], MAJ, p_parade, 0.0),
    "doors": (120, [C, Am, F, G], [76, 79, 81, 84, 86, 88], p_doors, 0.0),
    "balance": (96, [F, C, Dm, G], MAJ, p_balance, 0.0),
    "jars": (124, [C, Am, F, G], [76, 79, 81, 84, 88], p_jars, 0.0),
    "count": (110, [G, C, D, G], [74, 76, 78, 79, 81, 83], p_count, 0.0),
    "turbo": (140, [Em, C, G, D], [76, 79, 81, 83, 86], p_turbo, 0.0),
    "bake": (112, [C, F, G, F], MAJ, p_bake, 0.1),
    "slices": (108, [F, Dm, G, C], [72, 74, 76, 77, 79, 81, 84], p_slices, 0.3),
    "ninja": (96, [Am, F, Em, Am], [69, 71, 72, 76, 77, 81], p_ninja, 0.0),
    "ship": (90, [Dm, Bb, F, C], MIN, p_ship, 0.0),
    "pipes": (104, [Em, G, A7, G], [76, 79, 81, 83, 86], p_pipes, 0.15),
    "firefly": (72, [F, C, Dm, Bb], [72, 74, 77, 79, 81, 84], p_firefly, 0.0),
    "maze": (128, [C, G, Am, F], MAJ, p_maze, 0.0),
}
for key, (bpm, prog, mel, play, swing) in STYLES.items():
    if not want(key): continue
    body = mk(prog, mel, play)
    song(f"{key}_calm", bpm, 8, body(False), swing=swing)
    song(f"{key}_action", int(bpm * 1.15), 8, body(True), swing=swing)
    print("music", key, flush=True)


# ================================================================ SFX
def s_bonk():
    d = 0.5; t = T(d); y = np.sin(2 * np.pi * np.cumsum(220 * np.exp(-t * 12) + 70) / SR) * np.exp(-t * 14)
    mix(y, A._wood(700, 90), 0, 0.8); mix(y, A.sfx_squish(), int(0.03 * SR), 0.5); mix(y, A.sfx_boing(1.6, 0.25), int(0.08 * SR), 0.3)
    return y


def s_squeak():
    d = 0.3; t = T(d); f = 1300 + 500 * np.sin(np.pi * t / d) + 40 * np.sin(2 * np.pi * 30 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 0.6 * 0.7


def s_rocket():
    d = 1.1; t = T(d); env = np.minimum(1, t * 6) * np.exp(-np.maximum(0, t - 0.8) * 8)
    r = (lp(noise(d), 400) * (1 - t / d) + bp(noise(d), 800, 3500) * (t / d) ** 1.2) * env
    return r * 1.2 + chirp(120, 600, d, 1.5) * 0.25 * np.exp(-np.maximum(0, t - 0.8) * 8)


def s_crunch():
    y = np.zeros(int(0.45 * SR)); r = seed("crunch")
    for i in range(3):
        d = 0.09; t = T(d); x = bp(noise(d), 1200, 6000) * np.exp(-t * 30)
        for _ in range(12): c = hp(noise(0.003), 3000) * r.uniform(0.3, 1); mix(x, c, int(r.uniform(0, d - 0.004) * SR))
        mix(y, x, int(i * 0.12 * SR), 0.9)
    return y


def s_slosh():
    d = 0.8; t = T(d); y = lp(noise(d), 700) * (0.5 + 0.5 * np.sin(2 * np.pi * 5 * t)) * np.sin(np.pi * t / d) * 0.8
    r = seed("slosh")
    for i in range(5): mix(y, chirp(r.uniform(300, 500), r.uniform(700, 1100), 0.06) * np.exp(-T(0.06) * 30) * 0.4, int(r.uniform(0.05, 0.7) * SR))
    return y


def s_click():
    y = A._wood(2600, 260) * 0.7; mix(y, hp(noise(0.004), 4000), 0, 0.5); return y


def s_twinkle():
    y = np.zeros(int(0.9 * SR)); r = seed("twinkle")
    for i, m in enumerate([88, 91, 95, 100]): mix(y, A._bell(midi(m) * r.uniform(0.995, 1.005), 0.5) * 0.4, int(i * 0.07 * SR))
    return y


def s_sizzle():
    d = 0.9; t = T(d); r = seed("sizzle"); y = hp(noise(d), 3000) * np.exp(-t * 2.5) * 0.5
    for _ in range(50): mix(y, hp(noise(0.004), 2500) * r.uniform(0.2, 0.9), int(r.uniform(0, d - 0.01) * SR))
    mix(y, chirp(900, 2200, 0.35) * np.exp(-T(0.35) * 4) * 0.3, 0)
    return y


def s_gong():
    d = 2.2; t = T(d); y = np.zeros(len(t))
    for k, (r, dec) in enumerate([(1, 1.1), (1.48, 1.6), (2.12, 2.2), (2.74, 3.0), (3.5, 4.0), (4.9, 5.0)]):
        y += np.sin(2 * np.pi * 98 * r * t + k) * np.exp(-t * dec) / (k + 1) ** 0.6
    return y * (1 + 0.15 * np.sin(2 * np.pi * 5 * t)) + lp(noise(d), 400) * np.exp(-t * 20) * 0.5


def s_curtain():
    d = 0.75; t = T(d); y = (bp(noise(d), 600, 2500) * (1 - t / d) + bp(noise(d), 2500, 7000) * (t / d)) * np.sin(np.pi * t / d) ** 1.5 * 0.8
    return y + lp(noise(d), 400) * np.sin(np.pi * t / d) * 0.3


def s_creak():
    d = 0.7; t = T(d); f = 180 + 120 * np.sin(2 * np.pi * 1.5 * t)
    return bp(saw(f, d), 300, 1600) * (np.abs(np.sin(2 * np.pi * 22 * t)) ** 4) * np.sin(np.pi * t / d) * 0.9


def s_clunk():
    d = 0.4; t = T(d); y = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) * a for f, k, a in [(310, 18, 0.6), (720, 28, 0.4), (1130, 40, 0.3)])
    return y + np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t * 10) + 60) / SR) * np.exp(-t * 16) * 0.7


def s_buzz():
    d = 0.55; t = T(d); y = (np.sign(np.sin(2 * np.pi * 110 * t)) + np.sign(np.sin(2 * np.pi * 116.5 * t))) * 0.3
    return lp(y, 2500) * adsr(len(t), 0.005, 0.05, 0.9, 0.08)


def s_cheer():
    y = np.zeros(int(1.4 * SR)); r = seed("cheer")
    for i in range(7):
        v = gibber(f"cheer{i}", 0.7, r.uniform(250, 520), up, "ae", (0.18, 0.3), (0.02, 0.05)); mix(y, v, int(r.uniform(0, 0.25) * SR), 0.35)
    for _ in range(40): mix(y, bp(noise(0.012), 1200, 5000) * np.exp(-T(0.012) * 200) * r.uniform(0.2, 0.6), int(r.uniform(0.1, 1.2) * SR))
    return y


SFX = {"bonk": s_bonk, "squeak": s_squeak, "rocket": s_rocket, "crunch": s_crunch, "slosh": s_slosh, "click": s_click,
       "twinkle": s_twinkle, "sizzle": s_sizzle, "gong": s_gong, "curtain": s_curtain, "creak": s_creak, "clunk": s_clunk,
       "buzz": s_buzz, "cheer": s_cheer}
for name, fn in SFX.items():
    if not want(name) and ONLY and "sfx" not in ONLY: continue
    write("sfx_" + name, fn(), 0.9); META["sfx"].append(name)


# ================================================================ voices
VOICES = {
    "momo_happy": lambda: gibber("momo_happy", 0.6, 430, hump, "ie", (0.06, 0.09)),
    "momo_wow": lambda: gibber("momo_wow", 0.45, 470, up, "o", (0.14, 0.2)),
    "momo_sad": lambda: gibber("momo_sad", 0.8, 420, down, "ou", (0.14, 0.2)),
    "momo_laugh": lambda: gibber("momo_laugh", 0.7, 520, laughc, "ie", (0.04, 0.05), (0.03, 0.04)),
    "kranky_happy": lambda: gibber("kranky_happy", 0.8, 125, hump, "ao", (0.07, 0.11), ring=38),
    "kranky_wow": lambda: gibber("kranky_wow", 0.5, 135, up, "o", (0.16, 0.22), ring=38),
    "kranky_sad": lambda: gibber("kranky_sad", 0.9, 130, down, "ou", (0.16, 0.24), ring=30),
    "kranky_laugh": lambda: gibber("kranky_laugh", 0.9, 150, laughc, "e", (0.05, 0.06), (0.03, 0.05), ring=42),
    "turbo_happy": lambda: gibber("turbo_happy", 0.9, 215, hump, "ou", (0.16, 0.24), (0.03, 0.06)),
    "turbo_wow": lambda: gibber("turbo_wow", 0.5, 300, up, "i", (0.06, 0.08), (0.01, 0.02)),
    "turbo_sad": lambda: gibber("turbo_sad", 1.1, 200, down, "ou", (0.22, 0.32)),
    "turbo_laugh": lambda: gibber("turbo_laugh", 0.9, 230, laughc, "o", (0.08, 0.1), (0.05, 0.07)),
}
for name, fn in VOICES.items():
    if not want(name) and ONLY and "voice" not in ONLY: continue
    write("voice_" + name, fn(), 0.85); META["voice"].append(name)

with open(os.path.join(OUT, "manifest3.json"), "w") as fh: json.dump(META, fh, indent=1)
print("music", len(META["music"]), "sfx", len(META["sfx"]), "voices", len(META["voice"]))
