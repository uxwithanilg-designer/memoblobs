"""Blob Brigade music: a bouncy marching band (Garden Path), a toy-box polka (Candy Kitchen) and a minor-key boss march.

usage: python scripts/gen_brigade_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = march, polka, boss, sleigh, toybox, steel, spooky, jungle, brass, synth, epic (or e.g. march_calm). Files: music_brigade_<style>_<calm|action>.

Reuses the studio of gen_racing_audio.py (oscillators, drum kits, brass, strings, reverb/delay sends, loop-aware
mastering) and adds band instruments: tuba, glockenspiel, xylophone, accordion, clarinet, piccolo and a marching kit.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen_racing_audio.py"), encoding="utf-8").read()
exec(_src[: _src.index("# ================================================================ driver")])
STYLES.clear()  # noqa: F821  (defined by the exec above)


# ---------------------------------------------------------------- band instruments
@lru_cache(maxsize=None)
def i_tuba(m, d):
    """round low brass 'oom'"""
    f = midi(m); n = ns(d + 0.12); t = tt(n)
    y = saw_b(f, n) + 0.6 * saw_b(f * 1.003, n, 0.4)
    sw = 1 - 0.55 * np.exp(-t / 0.05)
    y = lp2(y, 420 + 900 * np.exp(-t / 0.08).mean()) * sw + 0.5 * np.sin(2 * np.pi * f * t)
    return np.tanh(1.4 * y) * env_note(n, d, 0.012, 0.18, 0.7, 0.07) * 0.5


@lru_cache(maxsize=None)
def i_glock(m, d=0.5):
    f = midi(m); n = ns(min(d, 0.6) + 0.9); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.6) + 0.32 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.12)
    y += 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.04) + hp(nz(n), 6000) * np.exp(-t / 0.003) * 0.25
    return fade(y * 0.42, 0.0005, 0.05)


@lru_cache(maxsize=None)
def i_xylo(m, d=0.25):
    f = midi(m); n = ns(0.5); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.12) + 0.45 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.03)
    y += 0.18 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.012) + bp(nz(n), 2000, 7000) * np.exp(-t / 0.003) * 0.35
    return fade(y * 0.5, 0.0005, 0.05)


@lru_cache(maxsize=None)
def i_accordion(m, d):
    f = midi(m); n = ns(d + 0.08); t = tt(n)
    trem = 1 + 0.1 * np.sin(2 * np.pi * 6.3 * t)
    y = pulse_b(f, n, 0.42) + 0.8 * pulse_b(f * 1.006, n, 0.36, 0.3) + 0.45 * pulse_b(f * 2.0, n, 0.5, 0.1)
    y = pk(bp(y, 260, 4500), 1400, 3, 0.8) * trem
    return y * env_note(n, d, 0.015, None, 1, 0.06) * 0.2


@lru_cache(maxsize=None)
def i_clarinet(m, d):
    f = midi(m); n = ns(d + 0.1); fv = f * vib(n, 5.4, 0.005, 0.22)
    y = pulse_b(fv, n, 0.5) + 0.08 * saw_b(fv * 3.0, n)
    y = lp2(y, 2800) + 0.03 * bp(nz(n), 1500, 4500)
    return y * env_note(n, d, 0.025, None, 1, 0.07) * 0.32


@lru_cache(maxsize=None)
def i_piccolo(m, d):
    f = midi(m); n = ns(d + 0.08); fv = f * vib(n, 5.8, 0.006, 0.15)
    ph = 2 * np.pi * np.cumsum(fv) / SR
    y = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * hp(nz(n), 3500)
    return y * env_note(n, d, 0.02, None, 1, 0.05) * 0.24


@lru_cache(maxsize=None)
def i_trumpet(m, d):
    return i_brass(m, d, False, 4200.0) * 1.1


@lru_cache(maxsize=None)
def k_bass_drum(): return k_kick(68, 44, 0.05, 0.42, 0.18, 1.2, 0.7)
@lru_cache(maxsize=None)
def k_msnare(): return k_snare(235, 0.42, 0.1, 1.5, 0.32, 0.9, 1.5)
@lru_cache(maxsize=None)
def k_cymbal(): return k_crash(1.4, 0.42, 1.15)


def snare_roll(S, bar, start, steps, g0=0.15, g1=0.6):
    """buzz roll in 32nds with a crescendo"""
    k = int(steps * 2)
    for i in range(k): S.put("drums", k_msnare(), S.T(bar, start + i * 0.5), g0 + (g1 - g0) * i / max(1, k - 1), 0.12, 0.15)


# ---------------------------------------------------------------- GARDEN PATH — marching band (F major)
MARCH_A = mel("c5 4 f5 4 a5 4 f5 4  c6 6 a5 2 f5 8  g5 4 a5 4 bb5 4 g5 4  e5 6 f5 2 g5 8  "
              "a5 4 bb5 4 c6 4 a5 4  d6 6 c6 2 bb5 4 a5 4  g5 4 a5 4 bb5 4 e5 4  f5 8 r 4 c5 4")
MARCH_B = mel("d6 4 bb5 4 f5 4 bb5 4  d6 4 f6 4 d6 8  c6 4 a5 4 f5 4 a5 4  c6 4 f6 4 c6 8  "
              "bb5 4 g5 4 d5 4 g5 4  c6 4 bb5 4 a5 4 g5 4  a5 4 f5 4 c6 4 a5 4  g5 8 c5 4 e5 4")
MARCH_PA = ["F", "F", "C7", "C7", "F", "Bb", "C7", "F"]
MARCH_PB = ["Bb", "Bb", "F", "F", "Gm", "C7", "F", "C7"]


def st_march(S, act):
    prog = MARCH_PA + MARCH_PB if act else MARCH_PA
    for bar, c in enumerate(prog):
        r = root(c, 34); fifth = r + 7 if r + 7 <= 46 else r - 5; ch = vc(c, 58); B = act and bar >= 8
        if act:
            if bar % 8 == 0: crash_at(S, bar, 0.4)
            S.kick(k_bass_drum(), bar, 0, 0.9); S.kick(k_bass_drum(), bar, 8, 0.75)
            for s in (4, 12):
                S.put("drums", k_msnare(), S.T(bar, s), 0.7, 0.12, 0.15)
                S.put("drums", k_cymbal(), S.T(bar, s), 0.16 if B else 0.09, -0.3, 0.1)
            for s in (2, 6, 10, 14, 15): S.put("drums", k_msnare(), S.T(bar, s), 0.16, 0.12, 0.1)
            if bar in (7, 15): snare_roll(S, bar, 8, 8)
            # oom-pah: tuba on 1 and 3, horn stabs on 2 and 4
            S.put("bass", i_tuba(r, S.st * 3), S.T(bar, 0), 0.9); S.put("bass", i_tuba(fifth, S.st * 3), S.T(bar, 8), 0.8)
            for s in (4, 12):
                for m in ch: S.put("music", i_brass(m, S.st * 2, True, 2200.0), S.T(bar, s), 0.22, -0.25, 0.18)
            if B:
                for k2, s in enumerate(range(0, 16, 2)): S.put("music", i_glock(ch[k2 % len(ch)] + 24, 0.2), S.T(bar, s), 0.12, 0.45, 0.2)
        else:
            S.put("drums", k_rim(), S.T(bar, 4), 0.32, 0.2, 0.2); S.put("drums", k_rim(), S.T(bar, 12), 0.32, 0.2, 0.2)
            for s in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, s), 0.22 if s % 4 == 0 else 0.14, -0.35)
            S.put("bass", i_tuba(r, S.st * 3), S.T(bar, 0), 0.7); S.put("bass", i_tuba(fifth, S.st * 3), S.T(bar, 8), 0.6)
            for s in (4, 12):
                for m in ch: S.put("music", i_strings(m, S.st * 1.2, 0.0, True), S.T(bar, s), 0.35, -0.3, 0.25)
    if act:
        S.seq("music", i_trumpet, MARCH_A, 0, 0.55, 0.1, 0.25)
        S.seq("music", i_glock, [(s, m + 12, ln) for s, m, ln in MARCH_A], 0, 0.3, -0.3, 0.3)
        S.seq("music", i_clarinet, MARCH_B, 8, 0.55, -0.15, 0.25)
        S.seq("music", i_piccolo, [(s, m + 12, ln) for s, m, ln in MARCH_B], 8, 0.35, 0.35, 0.3)
        S.seq("music", i_brass, [(s, dia(m, -2, MAJOR(5)), ln) for s, m, ln in MARCH_B], 8, 0.3, 0.25, 0.25, cut=2000.0)
        riser_into_loop(S, 1, 0.25)
    else:
        S.seq("music", i_glock, MARCH_A, 0, 0.42, 0.1, 0.35)
        S.seq("music", i_clarinet, [(s, m - 12, ln) for s, m, ln in MARCH_A[8:]], 0, 0.22, -0.3, 0.3)


# ---------------------------------------------------------------- CANDY KITCHEN — toy-box polka (G major)
POLKA_A = mel("d5 2 g5 2 b5 2 g5 2 d6 4 b5 4  a5 2 b5 2 c6 2 b5 2 a5 4 g5 4  f#5 2 a5 2 c6 2 a5 2 d6 4 c6 4  b5 2 a5 2 g5 2 f#5 2 a5 8  "
              "c6 2 b5 2 a5 2 b5 2 c6 4 d6 4  e6 2 d6 2 c6 2 a5 2 f#5 8  g5 2 a5 2 b5 2 c6 2 d6 4 b5 4  g5 4 d5 4 g5 8")
POLKA_B = mel("e6 2 c6 2 g5 2 c6 2 e6 4 g6 4  f6 2 e6 2 d6 2 e6 2 c6 8  d6 2 b5 2 g5 2 b5 2 d6 4 g6 4  f#6 2 e6 2 d6 2 c6 2 b5 8  "
              "a5 2 c6 2 f#6 2 a6 2 g6 2 f#6 2 e6 2 d6 2  c6 2 b5 2 a5 2 b5 2 c6 4 f#5 4  g5 2 b5 2 d6 2 g6 2 f#6 2 d6 2 b5 2 a5 2  g5 4 d5 4 g5 8")
POLKA_PA = ["G", "G", "D7", "D7", "D7", "D7", "G", "G"]
POLKA_PB = ["C", "C", "G", "G", "D7", "D7", "G", "G"]


def st_polka(S, act):
    prog = POLKA_PA + POLKA_PB if act else POLKA_PA
    for bar, c in enumerate(prog):
        r = root(c, 31); fifth = r + 7 if r + 7 <= 43 else r - 5; ch = vc(c, 60); B = act and bar >= 8
        if act:
            if bar % 8 == 0: crash_at(S, bar, 0.32)
            S.kick(k_bass_drum(), bar, 0, 0.8); S.kick(k_bass_drum(), bar, 8, 0.7)
            for s in (4, 12): S.put("drums", k_msnare(), S.T(bar, s), 0.45, 0.15, 0.15)
            for s in range(0, 16, 2): S.put("drums", k_tamb(), S.T(bar, s + 1), 0.3, -0.4, 0.05)
            if bar in (7, 15): snare_roll(S, bar, 12, 4, 0.2, 0.5)
        else:
            for s in (4, 12): S.put("drums", k_rim(), S.T(bar, s), 0.3, 0.2, 0.2)
            for s in range(0, 16, 2): S.put("drums", k_tamb(), S.T(bar, s + 1), 0.16, -0.4, 0.05)
        # oom-pah-pah: tuba on the beat, accordion on the off-beats
        for s, m in ((0, r), (8, fifth)): S.put("bass", i_tuba(m, S.st * 2.5), S.T(bar, s), 0.85 if act else 0.65)
        for s in (4, 12):
            for m in ch: S.put("music", i_accordion(m, S.st * 1.6), S.T(bar, s), 0.34 if act else 0.26, 0.2, 0.15)
        if B:
            for s in range(0, 16, 4): S.put("music", i_xylo(ch[(s // 4) % len(ch)] + 24), S.T(bar, s + 2), 0.18, -0.45, 0.2)
    if act:
        S.seq("music", i_clarinet, POLKA_A, 0, 0.55, -0.1, 0.22)
        S.seq("music", i_xylo, [(s, m + 12, ln) for s, m, ln in POLKA_A], 0, 0.28, 0.35, 0.2)
        S.seq("music", i_accordion, POLKA_B, 8, 0.5, 0.15, 0.22)
        S.seq("music", i_xylo, [(s, m + 12, ln) for s, m, ln in POLKA_B], 8, 0.3, -0.35, 0.2)
        S.seq("music", i_clarinet, [(s, dia(m, -2, MAJOR(7)), ln) for s, m, ln in POLKA_B], 8, 0.32, -0.25, 0.22)
        riser_into_loop(S, 1, 0.22)
    else:
        S.seq("music", i_xylo, POLKA_A, 0, 0.42, 0.1, 0.3)
        S.seq("music", i_glock, [(s, m + 12, ln) for s, m, ln in POLKA_A[::2]], 0, 0.15, -0.3, 0.35)


# ---------------------------------------------------------------- BOSS — minor-key march (D minor)
BOSS_HOOK = mel("d5 6 a4 2 d5 4 f5 4  e5 6 d5 2 c#5 8  d5 4 f5 4 a5 4 d6 4  c#6 8 a5 8  "
                "bb5 6 a5 2 g5 4 f5 4  g5 6 f5 2 e5 8  f5 4 e5 4 d5 4 c#5 4  d5 8 a4 8")
BOSS_P = ["Dm", "A", "Dm", "A", "Gm", "C", "A", "Dm"]


def st_boss(S, act):
    prog = BOSS_P * 2 if act else BOSS_P
    for bar, c in enumerate(prog):
        r = root(c, 38); ch = vc(c, 57); B = bar >= 8
        if bar % 8 == 0: crash_at(S, bar, 0.45); S.put("fx", fx_boom(1.8, 70, 30), S.T(bar, 0), 0.45)
        S.put("drums", k_timp(r), S.T(bar, 0), 0.85, 0, 0.3); S.put("drums", k_timp(r - 5 if r - 5 >= 33 else r + 7), S.T(bar, 8), 0.7, 0, 0.3)
        S.kick(k_bass_drum(), bar, 0, 0.9); S.kick(k_bass_drum(), bar, 8, 0.8)
        for s in range(16):
            acc = s in (4, 12)
            if acc or s % 2 == 1 or (B and act): S.put("drums", k_msnare(), S.T(bar, s), 0.65 if acc else 0.18, 0.12, 0.15)
        for s in (4, 12): S.put("drums", k_cymbal(), S.T(bar, s), 0.12 if B else 0.07, -0.3, 0.1)
        if bar in (7, 15): snare_roll(S, bar, 8, 8, 0.2, 0.7)
        # low brass ostinato on the root, spiccato strings in eighths
        for s in (0, 3, 6, 8, 11, 14): S.put("bass", i_tuba(root(c, 33), S.st * 1.6), S.T(bar, s), 0.8 if s in (0, 8) else 0.55)
        for s in range(0, 16, 2): S.put("music", i_strings(ch[(s // 2) % len(ch)] + 12, S.st * 0.9, 0.0, True), S.T(bar, s), 0.36, -0.4, 0.2)
        if B:
            for m in ch: S.put("music", i_choir(m, S.st * 16, 0.3), S.T(bar, 0), 0.2, 0, 0.45)
    S.seq("music", i_brass, BOSS_HOOK, 0, 0.55, 0.1, 0.28, cut=3000.0)
    S.seq("music", i_brass, [(s, m - 12, ln) for s, m, ln in BOSS_HOOK], 0, 0.38, -0.2, 0.25, cut=1500.0)
    if act:
        S.seq("music", i_trumpet, [(s, m + 12, ln) for s, m, ln in BOSS_HOOK], 8, 0.42, 0.2, 0.3)
        S.seq("music", i_brass, BOSS_HOOK, 8, 0.5, -0.1, 0.28, cut=3000.0)
        S.seq("music", i_glock, [(s, m + 12, ln) for s, m, ln in BOSS_HOOK], 8, 0.16, 0.4, 0.3)
        riser_into_loop(S, 1, 0.3)


style("march", 126, 16, 108, 8, 1.2, 1.6, sc=(0.0, 0.0), bal_a=(-1.0, 0.5, -2.0), bal_c=(-5.0, 0.5, -2.5))(st_march)
style("polka", 148, 16, 122, 8, 1.0, 1.4, sc=(0.0, 0.0), bal_a=(-1.5, 0.5, -1.5), bal_c=(-5.0, 0.5, -2.0))(st_polka)
style("boss", 132, 16, 120, 8, 1.6, 2.0, sc=(0.0, 0.0), bal_a=(-1.0, 0.5, -2.0), bal_c=(-3.0, 0.0, -2.5))(st_boss)


# ================================================================ Phase 2 worlds: eight more styles
def kit_basic(S, bar, act, B, kick=(0, 8), snare=(4, 12), hat=2, g=1.0, kk=None, sn=None):
    kk = kk or k_bass_drum(); sn = sn or k_msnare()
    for s in kick: S.kick(kk, bar, s, 0.85 * g)
    for s in snare: S.put("drums", sn, S.T(bar, s), 0.55 * g, 0.1, 0.15)
    if hat:
        for s in range(0, 16, hat): S.put("drums", k_hat(False, 0.03), S.T(bar, s), (0.22 if s % 4 == 0 else 0.15) * g, -0.3)


def band(S, act, prog, hook, lead, lead2, chord, bass, drums, lo=34, chord_steps=(4, 12), bass_steps=((0, 0), (8, 7)), hook_g=0.5, chord_g=0.26, extra=None, counter=None):
    bars = prog * 2 if act else prog
    for bar, c in enumerate(bars):
        r = root(c, lo); ch = vc(c, 58); B = act and bar >= len(prog)
        if act and bar % 8 == 0: crash_at(S, bar, 0.35)
        drums(S, bar, act, B)
        for s, iv in bass_steps:
            m = r + iv if r + iv <= lo + 12 else r + iv - 12
            S.put("bass", bass(m, S.st * 2.6), S.T(bar, s), 0.8 if act else 0.6)
        for s in chord_steps:
            for m in ch: S.put("music", chord(m, S.st * 1.6), S.T(bar, s), chord_g * (1 if act else 0.75), 0.25, 0.2)
        if extra: extra(S, bar, c, act, B)
    if act:
        S.seq("music", lead, hook, 0, hook_g, 0.1, 0.25)
        S.seq("music", lead2, [(s, m + 12, ln) for s, m, ln in hook], len(prog), hook_g * 0.8, -0.2, 0.3)
        if counter: S.seq("music", counter, [(s, m - 12, ln) for s, m, ln in hook], len(prog), hook_g * 0.55, 0.3, 0.25)
        riser_into_loop(S, 1, 0.22)
    else:
        S.seq("music", lead2, hook, 0, hook_g * 0.75, 0.1, 0.35)


# ---------------------------------------------------------------- SNOWY PEAKS — sleigh-bell march (D major)
SLEIGH = mel("a5 4 f#5 2 a5 2 d6 4 a5 4  b5 4 g5 2 b5 2 d6 8  c#6 4 a5 2 c#6 2 e6 4 g6 4  f#6 8 d6 8  "
             "b5 4 d6 2 b5 2 f#5 4 b5 4  g5 4 b5 2 d6 2 g6 8  e6 4 c#6 2 a5 2 g5 4 e5 4  d5 8 r 8")


def st_sleigh(S, act):
    def drums(S, bar, act, B):
        kit_basic(S, bar, act, B, hat=0, g=1.0 if act else 0.6)
        for s in range(0, 16, 2): S.put("drums", k_tamb(), S.T(bar, s + (1 if s % 4 else 0)), 0.32 if act else 0.2, 0.35, 0.1)
        if act and bar % 8 == 7: snare_roll(S, bar, 12, 4)
    band(S, act, ["D", "G", "A7", "D", "Bm", "G", "A7", "D"], SLEIGH, i_glock, i_bell, lambda m, d: i_strings(m, d, 0.0, True), i_tuba, drums, lo=38)


# ---------------------------------------------------------------- TOY ROOM — wind-up chiptune (C major)
TOYBOX = mel("c6 2 e6 2 g6 2 e6 2 c6 4 g5 4  a5 2 c6 2 f6 4 e6 2 d6 2 c6 4  b5 2 d6 2 g6 2 f6 2 e6 4 d6 4  c6 4 e6 4 c6 8  "
             "a5 2 c6 2 e6 2 c6 2 a5 4 e6 4  f6 2 e6 2 d6 2 c6 2 a5 8  g5 2 b5 2 d6 2 f6 2 e6 4 d6 4  c6 8 g5 4 c6 4")


def st_toybox(S, act):
    def drums(S, bar, act, B):
        for s in (0, 8): S.kick(k_chip_kick(), bar, s, 0.8 if act else 0.5)
        for s in (4, 12): S.put("drums", k_chip_noise(0.06, 0.18, 6), S.T(bar, s), 0.5 if act else 0.3, 0.1)
        if act:
            for s in range(1, 16, 2): S.put("drums", k_chip_noise(0.015, 0.05, 2), S.T(bar, s), 0.18, -0.3)
    band(S, act, ["C", "F", "G", "C", "Am", "F", "G", "C"], TOYBOX, lambda m, d: i_chip(m, d, 0.25), i_glock, lambda m, d: i_chip(m, d, 0.125), lambda m, d: i_chip_tri(m, d),
         drums, lo=36, chord_steps=(2, 6, 10, 14), chord_g=0.14, counter=lambda m, d: i_chip(m, d, 0.5))


# ---------------------------------------------------------------- BEACH DAY — steel-drum calypso (F major)
STEEL = mel("c6 3 a5 3 f5 2 a5 2 c6 2 f6 4  d6 3 bb5 3 f5 2 bb5 2 d6 2 f6 4  e6 3 c6 3 g5 2 bb5 2 c6 2 e6 4  f6 6 c6 2 a5 8  "
            "d6 3 a5 3 f5 2 a5 2 d6 2 f6 4  f6 3 d6 3 bb5 2 d6 2 f6 2 bb6 4  g6 3 e6 3 c6 2 bb5 2 g5 2 e6 4  f6 8 r 8")


@lru_cache(maxsize=None)
def i_steel(m, d=0.4):
    f = midi(m); n = ns(0.9); t = tt(n)
    y = np.sin(2 * np.pi * f * t + 0.9 * np.exp(-t / 0.15) * np.sin(2 * np.pi * f * 2.0 * t)) * np.exp(-t / 0.45)
    y += 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / 0.08)
    return fade(y * 0.42, 0.001, 0.05)


def st_steel(S, act):
    def drums(S, bar, act, B):
        g = 1.0 if act else 0.6
        for s in (0, 6, 8, 14): S.kick(k_bass_drum(), bar, s, (0.7 if s in (0, 8) else 0.45) * g)
        for s in (3, 7, 11, 15): S.put("drums", k_tom(320 if s % 8 == 3 else 260, 0.25, 0.08), S.T(bar, s), 0.4 * g, 0.3 if s % 8 == 3 else -0.3, 0.1)
        for s in (0, 3, 6, 10, 12): S.put("drums", k_rim(), S.T(bar, s), 0.3 * g, 0.4)
        for s in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, s + 1), 0.2 * g, -0.4)
    band(S, act, ["F", "Bb", "C7", "F", "Dm", "Bb", "C7", "F"], STEEL, i_steel, i_steel, i_steel, i_tuba, drums, lo=29,
         chord_steps=(2, 6, 10, 14), chord_g=0.16, bass_steps=((0, 0), (6, 7), (8, 0), (14, 7)))


# ---------------------------------------------------------------- SPOOKY NIGHT — spooky-silly swing (D minor)
SPOOKY = mel("d5 2 f5 2 a5 2 d6 2 c#6 4 a5 4  bb5 2 g5 2 d5 2 g5 2 a5 4 bb5 4  a5 2 c#6 2 e6 2 g6 2 f6 4 e6 4  d6 8 a5 8  "
             "f5 2 a5 2 d6 2 f6 2 e6 4 d6 4  d6 2 bb5 2 f5 2 bb5 2 c6 4 d6 4  e6 2 c#6 2 a5 2 g5 2 f5 4 e5 4  d5 8 r 8")


def st_spooky(S, act):
    def drums(S, bar, act, B):
        g = 1.0 if act else 0.55
        for s in (0, 8): S.kick(k_bass_drum(), bar, s, 0.75 * g)
        for s in (4, 12): S.put("drums", k_snare(220, 0.4, 0.08, 1.2, 0.3, 0.6), S.T(bar, s), 0.4 * g, 0.1, 0.25)
        for s in range(0, 16, 2): S.put("drums", k_ride(), S.T(bar, s), (0.22 if s % 4 == 0 else 0.14) * g, 0.35)
    band(S, act, ["Dm", "Gm", "A7", "Dm", "Dm", "Bb", "A7", "Dm"], SPOOKY, i_xylo, lambda m, d: i_lead(m, d, None, 3200.0, 0.02), lambda m, d: i_accordion(m - 12, d),
         lambda m, d: i_strings(m, d, 0.0, True, 1500.0), drums, lo=38, bass_steps=((0, 0), (4, 7), (8, 12), (12, 7)), chord_g=0.2)


# ---------------------------------------------------------------- JUNGLE RUINS — jungle drums (A minor)
JUNGLE = mel("e5 2 g5 2 a5 4 c6 2 a5 2 g5 4  d5 2 e5 2 g5 4 a5 2 g5 2 e5 4  c5 2 d5 2 e5 4 g5 2 e5 2 d5 4  e5 8 a4 8  "
             "a5 2 c6 2 d6 4 e6 2 d6 2 c6 4  g5 2 a5 2 c6 4 d6 2 c6 2 a5 4  f5 2 g5 2 a5 4 c6 2 a5 2 g5 4  e5 8 r 8")


def st_jungle(S, act):
    def drums(S, bar, act, B):
        g = 1.0 if act else 0.55
        for s, f, gg in ((0, 62, 0.9), (3, 85, 0.5), (6, 62, 0.7), (8, 62, 0.85), (10, 110, 0.5), (11, 85, 0.5), (14, 110, 0.6)):
            S.put("drums", k_taiko(f), S.T(bar, s), gg * 0.7 * g, -0.25 if s % 2 else 0.25, 0.25)
        for s in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, s), 0.2 * g, 0.4)
    band(S, act, ["Am", "G", "F", "Am", "Am", "G", "F", "E"], JUNGLE, lambda m, d: i_piccolo(m - 12, d), i_xylo, i_xylo, i_tuba, drums, lo=33,
         chord_steps=(2, 10), chord_g=0.2, bass_steps=((0, 0), (3, 0), (6, 7), (8, 0), (11, 7)))


# ---------------------------------------------------------------- LAVA LAND — big brass (C minor)
BRASS = mel("c5 4 eb5 2 g5 2 c6 6 bb5 2  ab5 4 g5 2 f5 2 eb5 8  f5 4 g5 2 ab5 2 bb5 6 ab5 2  g5 8 d5 8  "
            "c6 4 bb5 2 ab5 2 g5 4 eb5 4  f5 4 g5 2 ab5 2 c6 8  b5 4 c6 2 d6 2 g5 8  c6 8 r 8")


def st_brass(S, act):
    def drums(S, bar, act, B):
        g = 1.0 if act else 0.55
        S.put("drums", k_timp(root(["Cm", "Ab", "Bb", "G", "Cm", "Fm", "G", "Cm"][bar % 8], 38)), S.T(bar, 0), 0.7 * g, 0, 0.3)
        kit_basic(S, bar, act, B, hat=2 if act else 0, g=g)
        if act and bar % 8 == 7: snare_roll(S, bar, 8, 8, 0.2, 0.6)
    band(S, act, ["Cm", "Ab", "Bb", "G", "Cm", "Fm", "G", "Cm"], BRASS, i_trumpet, lambda m, d: i_brass(m, d, False, 3000.0), lambda m, d: i_brass(m, d, True, 2000.0), i_tuba, drums,
         lo=36, chord_g=0.24, counter=lambda m, d: i_brass(m, d, False, 1500.0))


# ---------------------------------------------------------------- SPACE STATION — synth march (E minor)
SYNTH = mel("e5 2 g5 2 b5 2 e6 2 d6 4 b5 4  c6 2 e6 2 g6 4 e6 2 c6 2 g5 4  d6 2 f#6 2 a6 4 f#6 2 d6 2 a5 4  b5 8 d#6 8  "
            "g6 4 f#6 2 e6 2 b5 4 e6 4  e6 4 d6 2 c6 2 g5 4 c6 4  d6 4 c6 2 b5 2 a5 4 f#5 4  e5 8 r 8")


def st_synth(S, act):
    prog = ["Em", "C", "D", "B", "Em", "C", "D", "Em"]
    def drums(S, bar, act, B):
        g = 1.0 if act else 0.5
        for s in range(0, 16, 4): S.kick(k_kick(140, 45, 0.03, 0.3, 0.5, 2.0), bar, s, 0.85 * g)
        for s in (4, 12): S.put("drums", k_clap(0.35, 0.1), S.T(bar, s), 0.5 * g, 0, 0.2)
        for s in range(2, 16, 4): S.put("drums", k_hat(True, 0.08), S.T(bar, s), 0.25 * g, 0.3)
    def extra(S, bar, c, act, B):
        pads(S, bar, c, 0.12 if act else 0.18, 57, 3500.0 if act else 2200.0)
        if act: arp16(S, bar, c, 0.09, 69, every=1, bright=6000.0)
    band(S, act, prog, SYNTH, lambda m, d: i_lead(m, d, None, 5200.0), lambda m, d: i_lead(m, d, None, 3800.0), lambda m, d: i_pluck(m, d, 4000.0, 400.0, 0.08, 0.2, False),
         lambda m, d: i_bass(m, d, 800.0, 0.08, 0.7, 2.0), drums, lo=28, chord_g=0.1, extra=extra, bass_steps=((0, 0), (4, 0), (8, 0), (12, 0)))


# ---------------------------------------------------------------- KRANKY'S CASTLE — epic finale (D minor)
EPIC = mel("d5 4 a5 4 f5 2 e5 2 d5 4  bb4 4 f5 4 d5 2 c5 2 bb4 4  c5 4 g5 4 e5 2 d5 2 c5 4  a4 4 c#5 4 e5 4 a5 4  "
           "d6 4 c6 2 a5 2 f5 4 a5 4  g5 4 bb5 2 d6 2 g6 4 f6 4  e6 4 c#6 2 a5 2 e5 4 c#6 4  d6 8 r 8")


def st_epic(S, act):
    prog = ["Dm", "Bb", "C", "A", "Dm", "Gm", "A", "Dm"]
    def drums(S, bar, act, B):
        g = 1.0 if act else 0.5
        for s, gg in ((0, 1.0), (3, 0.6), (6, 0.75), (8, 0.9), (11, 0.6), (14, 0.7)): S.put("drums", k_taiko(62 if s in (0, 8) else 85), S.T(bar, s), gg * 0.7 * g, 0.2 if s % 2 else -0.2, 0.3)
        S.put("drums", k_timp(root(prog[bar % 8], 38)), S.T(bar, 0), 0.7 * g, 0, 0.3)
        if act and B:
            for s in range(0, 16, 2): S.put("drums", k_msnare(), S.T(bar, s), 0.2, 0.1, 0.2)
    def extra(S, bar, c, act, B):
        for s in range(0, 16, 2): S.put("music", i_strings(vc(c, 62)[(s // 2) % 3], S.st * 0.9, 0.0, True), S.T(bar, s), 0.34 if act else 0.22, -0.4, 0.2)
        if B:
            for m in vc(c, 55): S.put("music", i_choir(m, S.st * 16, 0.3), S.T(bar, 0), 0.2, 0, 0.45)
    band(S, act, prog, EPIC, lambda m, d: i_brass(m, d, False, 3200.0), lambda m, d: i_strings(m, d, 0.05), lambda m, d: i_brass(m, d, True, 1800.0), i_tuba, drums,
         lo=38, chord_steps=(0, 8), chord_g=0.22, extra=extra, counter=lambda m, d: i_brass(m, d, False, 1500.0))


style("sleigh", 140, 16, 112, 8, 1.2, 1.6, bal_a=(-1.0, 0.5, -2.0), bal_c=(-5.0, 0.5, -2.5))(st_sleigh)
style("toybox", 150, 16, 120, 8, 0.6, 0.9, bal_a=(-2.0, 1.0, -3.0), bal_c=(-4.0, 1.0, -3.0))(st_toybox)
style("steel", 118, 16, 100, 8, 1.0, 1.3, bal_a=(-1.0, 0.5, -1.5), bal_c=(-4.0, 0.5, -2.0))(st_steel)
style("spooky", 128, 16, 108, 8, 1.4, 1.8, sw=(0.33, 0.33), bal_a=(-1.5, 0.5, -2.0), bal_c=(-5.0, 0.5, -2.5))(st_spooky)
style("jungle", 118, 16, 100, 8, 1.2, 1.6, bal_a=(0.0, 0.0, -2.0), bal_c=(-3.0, 0.5, -2.5))(st_jungle)
style("brass", 128, 16, 104, 8, 1.6, 2.0, bal_a=(-1.5, 0.5, -2.0), bal_c=(-5.0, 0.5, -2.5))(st_brass)
style("synth", 124, 16, 104, 8, 1.4, 1.8, sc=(0.35, 0.2), bal_a=(-1.0, 0.5, -1.5), bal_c=(-4.0, 0.5, -2.0))(st_synth)
style("epic", 136, 16, 96, 8, 2.2, 2.6, bal_a=(-2.0, 1.0, -4.0), bal_c=(-6.0, 0.0, -4.0))(st_epic)


def run_music():
    for key, spec in STYLES.items():
        for v, act in (("calm", False), ("action", True)):
            if key == "boss" and not act: continue
            if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
            bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
            S = Song(f"brigade_{key}_{v}", bpm, bars, rt, sw)
            spec["fn"](S, act)
            S.render(-14.5 if act else -16.0, sc, None, 0.55, dl, tag=v, bal=bal)


if __name__ == "__main__":
    import time
    t0 = time.time()
    run_music()
    mf = os.path.join(OUT, "manifest_brigade.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
