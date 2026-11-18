"""Momo Dash! sound pack: music per world (calm = menus, action = the run), a boss-chase track, the coin-melody chime
(pitch-shifted in the browser so coin lines play the song) and the runner's CG sound effects.

usage: python scripts/gen_dash_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = pier, candy, chase (or e.g. pier_calm), sfx. Files: music_dash_<style>_<calm|action>, sfx_dash_<name>.

Sunset Pier = sunny surf-funk (steel drum hook, slap bass, guitar chops, brass), Candy Town = bubblegum electro-pop
(four-on-the-floor, plucky arps, chip lead), Chase = a driving minor-key chase for thief and boss stages.
Reuses the studio of gen_boing_audio.py (→ gen_brigade_audio.py → gen_racing_audio.py).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen_boing_audio.py"), encoding="utf-8").read()
exec(_src[: _src.index(chr(10) + "def run_music():")])
STYLES.clear()  # noqa: F821  (defined by the exec above)


# ---------------------------------------------------------------- SUNSET PIER — surf-funk in C
PIER_HOOK = mel("e5 2 g5 2 c6 3 b5 1 a5 2 g5 2 e5 4  f5 2 a5 2 c6 2 d6 2 e6 4 d6 4  e6 2 d6 2 c6 2 a5 2 g5 4 e5 2 g5 2  a5 3 g5 1 e5 2 d5 2 c5 8")
PIER_B = mel("c6 4 b5 2 a5 2 g5 4 e5 4  a5 4 g5 2 e5 2 d5 4 c5 4  f5 2 a5 2 c6 2 f6 2 e6 4 c6 4  d6 6 b5 2 g5 8")


def steel(m, d=0.4): return i_steel(m, 0.4)


def st_pier(S, act):
    kk = k_kick(115, 52, 0.02, 0.15, 0.8, 1.5); sn = k_snare(205, 0.75, 0.13, 1.0, 0.4, 0.5)
    hh = k_hat(False, 0.025); oh = k_hat(True, 0.12); tb = k_tamb(); cl = k_clap(0.3, 0.1)
    prog = ["C", "Am", "F", "G"] * (4 if act else 2)
    for bar, c in enumerate(prog):
        r = root(c, 33)
        if act and bar % 8 == 0: crash_at(S, bar, 0.4)
        fill = act and bar in (7, 15)
        for s in range(16):
            if act:
                if fill and s >= 12: continue
                if s in (0, 7, 10): S.kick(kk, bar, s, 0.95 if s == 0 else 0.7, hum=0.002)
                if s in (4, 12): S.put("drums", sn, S.T(bar, s), 0.85, 0, 0.12, hum=0.002); S.put("drums", cl, S.T(bar, s), 0.3, 0.15, 0.15)
                if s == 14 and bar % 2: S.put("drums", oh, S.T(bar, s), 0.28, 0.3)
                else: S.put("drums", hh, S.T(bar, s), 0.3 if s % 4 == 2 else 0.18 if s % 2 == 0 else 0.1, 0.3, 0, hum=0.002)
                if s % 4 == 2: S.put("drums", tb, S.T(bar, s), 0.22, -0.4)
            else:
                if s in (0, 10): S.kick(kk, bar, s, 0.5)
                if s in (4, 12): S.put("drums", k_rim(), S.T(bar, s), 0.3, 0.1, 0.2)
                if s % 2 == 0: S.put("drums", k_shaker(), S.T(bar, s), 0.16, -0.3)
        if fill: drum_fill(S, bar, kk, sn, [k_tom(f) for f in (210, 160)], 12, 0.8)
        if act:
            for s, iv, ln, pop in ((0, 0, 1.5, False), (3, 12, 1, True), (6, 7, 1, False), (8, 0, 1, False), (10, 12, 1, True), (11, 10, 1, False), (14, 7, 2, False)):
                S.put("bass", i_slap(r + iv, round(S.st * ln, 4), pop, False), S.T(bar, s), 0.9, 0, 0, 0, 0.002)
            ch = vc(c, 60)
            for s in (2, 6, 10, 14):
                for m in ch: S.put("music", i_clean(m, S.st * 0.5, s), S.T(bar, s), 0.15, 0.4, 0.05)
            if bar % 2 == 1:
                for m in vc(prog[(bar + 1) % len(prog)], 62): S.put("music", i_brass(m, S.st * 1.2, True, 3200.0), S.T(bar, 14), 0.24, -0.2, 0.2)
        else:
            for s, iv, ln in ((0, 0, 6), (8, 7, 4), (12, 12, 4)):
                S.put("bass", i_bass(r + iv, S.st * ln, 500, 0.05, 0.6, 1.2), S.T(bar, s), 0.8)
            for s, ln in ((0, 6), (8, 6)):
                for m in vc(c, 55): S.put("music", i_epiano(m, S.st * ln, 0.8), S.T(bar, s), 0.24, 0, 0.25)
    if act:
        S.seq("music", steel, PIER_HOOK, 4, 0.42, 0.1, 0.25, 0.12)
        S.seq("music", steel, PIER_B, 8, 0.38, 0.1, 0.25, 0.12)
        S.seq("music", steel, PIER_HOOK, 12, 0.42, 0.1, 0.25, 0.12)
        S.seq("music", i_brass, [(s, m - 12, ln) for s, m, ln in PIER_HOOK], 12, 0.22, -0.2, 0.2, 0.0, cut=3000.0)
        riser_into_loop(S, 1, 0.18)
    else:
        S.seq("music", steel, PIER_HOOK, 0, 0.36, 0.1, 0.3, 0.2)
        S.seq("music", steel, PIER_B, 4, 0.3, -0.1, 0.3, 0.2)


# ---------------------------------------------------------------- CANDY TOWN — bubblegum electro-pop in F
CANDY_HOOK = mel("c6 2 a5 2 f5 2 a5 2 c6 4 d6 4  a#5 2 d6 2 f6 4 e6 2 d6 2 c6 4  a#5 2 a5 2 g5 2 a5 2 a#5 4 d6 4  c6 2 a#5 2 a5 2 g5 2 f5 8")
CANDY_B = mel("f6 3 e6 1 d6 2 c6 2 a5 4 c6 4  d6 3 c6 1 a#5 2 a5 2 f5 8  g5 2 a5 2 a#5 2 d6 2 c6 4 a#5 4  a5 4 g5 4 e5 4 c6 4")


def chip_lead(m, d): return mono(i_chip(m, d, 0.25, 0.006))


def st_candy(S, act):
    kk = k_kick(140, 48, 0.02, 0.2, 0.6, 1.8); cl = k_clap(0.35, 0.11); hh = k_hat(False, 0.022); oh = k_hat(True, 0.1)
    prog = ["F", "Dm", "A#", "C"] * (4 if act else 2)
    for bar, c in enumerate(prog):
        r = root(c, 29)
        if act and bar % 8 == 0: crash_at(S, bar, 0.38)
        if act:
            edm_drums(S, bar, kk, cl, hh, oh, g=0.85)
            for s in range(0, 16, 2): S.put("bass", i_bass(r + (12 if s % 4 == 2 else 0), S.st * 1.6, 900, 0.06, 0.6, 1.6), S.T(bar, s), 0.7)
            arp16(S, bar, c, 0.13, 65, every=2, bright=7000.0)
            pads(S, bar, c, 0.1, 57, 2600.0)
        else:
            kit_soft(S, bar, False, False, hat=2, g=0.7)
            S.put("bass", i_bass(r, S.st * 8, 500, 0.05, 0.6, 1.2), S.T(bar, 0), 0.7)
            S.put("bass", i_bass(r + 7, S.st * 6, 500, 0.05, 0.6, 1.2), S.T(bar, 8), 0.55)
            for m in vc(c, 60): S.put("music", i_musicbox(m, 0.6), S.T(bar, 0), 0.14, 0.2, 0.3)
            pads(S, bar, c, 0.08, 55, 2000.0)
    if act:
        S.seq("music", chip_lead, CANDY_HOOK, 4, 0.2, 0.05, 0.15, 0.15)
        S.seq("music", lambda m, d: i_glock(m, 0.4), CANDY_HOOK, 4, 0.2, -0.2, 0.25)
        S.seq("music", chip_lead, CANDY_B, 8, 0.2, 0.05, 0.15, 0.15)
        S.seq("music", chip_lead, CANDY_HOOK, 12, 0.2, 0.05, 0.15, 0.15)
        S.seq("music", lambda m, d: i_glock(m, 0.4), CANDY_HOOK, 12, 0.22, -0.2, 0.25)
        riser_into_loop(S, 1, 0.2)
    else:
        S.seq("music", lambda m, d: i_musicbox(m, 0.6), CANDY_HOOK, 0, 0.42, 0.1, 0.3, 0.15)
        S.seq("music", lambda m, d: i_musicbox(m, 0.6), CANDY_B, 4, 0.36, -0.1, 0.3, 0.15)


# ---------------------------------------------------------------- CHASE — thief and boss stages, D minor
CHASE_HOOK = mel("d5 2 f5 2 a5 4 g5 2 f5 2 e5 4  f5 2 a5 2 d6 4 c6 2 a#5 2 a5 4  a#5 2 a5 2 g5 2 f5 2 g5 4 a5 4  a5 2 c#6 2 e6 4 d6 8")


def st_chase(S, act):
    kk = k_kick(120, 45, 0.02, 0.2, 0.7, 1.8); sn = k_snare(220, 0.7, 0.12, 1.2, 0.4, 0.6); hh = k_hat(False, 0.02)
    prog = ["Dm", "A#", "C", "A"] * 4
    for bar, c in enumerate(prog):
        r = root(c, 26)
        if bar % 4 == 0: crash_at(S, bar, 0.42)
        for s in range(16):
            if s in (0, 6, 8, 11): S.kick(kk, bar, s, 0.9 if s % 8 == 0 else 0.7)
            if s in (4, 12): S.put("drums", sn, S.T(bar, s), 0.85, 0, 0.15)
            S.put("drums", hh, S.T(bar, s), 0.26 if s % 2 == 0 else 0.14, 0.3)
        if bar % 4 == 3: S.put("drums", k_taiko(), S.T(bar, 14), 0.6, 0, 0.2)
        for s in range(0, 16, 2): S.put("bass", i_bass(r + (12 if s % 8 == 6 else 0), S.st * 1.5, 800, 0.06, 0.7, 2.0), S.T(bar, s), 0.75)
        for s in range(0, 16, 2):
            for m in vc(c, 57): S.put("music", i_strings(m, S.st * 1.2, 0.02, True, 3600.0), S.T(bar, s), 0.08, 0.25, 0.1)
        if bar % 2 == 1:
            for m in vc(c, 62): S.put("music", i_brass(m, S.st * 1.5, True, 3000.0), S.T(bar, 13), 0.26, -0.2, 0.2)
    S.seq("music", i_brass, CHASE_HOOK, 4, 0.34, -0.1, 0.2, 0.0, cut=3400.0)
    S.seq("music", i_brass, CHASE_HOOK, 12, 0.34, -0.1, 0.2, 0.0, cut=3400.0)
    S.seq("music", lambda m, d: i_strings(m, d, 0.05, False, 4200.0), [(s, m + 12, ln) for s, m, ln in CHASE_HOOK], 12, 0.12, 0.3, 0.3)
    riser_into_loop(S, 1, 0.2)


style("pier", 124, 16, 104, 8, 1.0, 1.4, sc=(0.1, 0.0), sw=(0.08, 0.12), bal_a=(0.0, -0.5, -0.5), bal_c=(-3.5, 0.0, -1.5))(st_pier)
style("candy", 128, 16, 110, 8, 1.4, 1.8, sc=(0.55, 0.3), bal_a=(0.0, 0.5, -1.5), bal_c=(-4.0, 0.5, -2.5))(st_candy)
style("chase", 140, 16, 140, 16, 1.2, 1.2, sc=(0.0, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(st_chase)


# ---------------------------------------------------------------- worlds 3-12: one arranger, ten very different bands
def kit_tribal(S, bar):
    S.kick(k_kick(110, 48, 0.03, 0.25, 0.2, 1.3, 0.45), bar, 0, 0.8)
    S.kick(k_kick(110, 48, 0.03, 0.25, 0.2, 1.3, 0.45), bar, 10, 0.6)
    for st_ in (3, 6, 8, 11, 13, 14): S.put("drums", k_tom(170.0 if st_ % 2 else 125.0, 0.35, 0.12), S.T(bar, st_), 0.32 if st_ in (8, 14) else 0.22, 0.25 * (1 if st_ % 2 else -1), 0.12)
    for st_ in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, st_), 0.2 if st_ % 4 == 0 else 0.12, -0.3)
    if bar % 4 == 3: S.put("drums", k_taiko(), S.T(bar, 12), 0.5, 0, 0.2)


def kit_sleigh(S, bar):
    for st_ in range(0, 16, 4): S.kick(k_kick(130, 50, 0.02, 0.2, 0.5, 1.6), bar, st_, 0.8)
    for st_ in (4, 12): S.put("drums", k_clap(0.3, 0.1), S.T(bar, st_), 0.55, 0.1, 0.2)
    for st_ in range(0, 16, 2): S.put("drums", k_tamb(), S.T(bar, st_), 0.3 if st_ % 4 == 2 else 0.18, 0.35, 0.1)


def kit_chip(S, bar):
    for st_ in (0, 6, 8, 11): S.kick(k_chip_kick(), bar, st_, 0.75)
    for st_ in (4, 12): S.put("drums", k_chip_noise(0.08, 0.2, 4), S.T(bar, st_), 0.5, 0.1)
    for st_ in range(0, 16, 2): S.put("drums", k_chip_noise(0.02, 0.05, 1), S.T(bar, st_), 0.14, -0.3)


def kit_rock(S, bar, heavy=False):
    kk = k_kick(100, 42, 0.02, 0.22, 0.9, 2.0); sn = k_snare(200, 0.7, 0.14, 1.2, 0.42, 0.7)
    for st_ in ((0, 3, 8, 10) if heavy else (0, 8, 10)): S.kick(kk, bar, st_, 0.9)
    for st_ in (4, 12): S.put("drums", sn, S.T(bar, st_), 0.9, 0, 0.15)
    for st_ in range(0, 16, 2): S.put("drums", k_hat(st_ % 4 == 2, 0.04), S.T(bar, st_), 0.28 if st_ % 4 == 2 else 0.2, 0.3)


def kit_swing(S, bar):
    S.kick(k_kick(95, 44, 0.03, 0.3, 0.3, 1.4, 0.5), bar, 0, 0.75); S.kick(k_kick(95, 44, 0.03, 0.3, 0.3, 1.4, 0.5), bar, 8, 0.6)
    for st_ in (4, 12): S.put("drums", k_rim(), S.T(bar, st_), 0.4, 0.2, 0.2)
    for st_ in (0, 3, 4, 7, 8, 11, 12, 15): S.put("drums", k_ride(0.6, 0.3), S.T(bar, st_), 0.16 if st_ % 4 else 0.24, 0.35, 0.05)


def kit_gallop(S, bar):
    for st_ in (0, 3, 4, 8, 11, 12): S.kick(k_kick(105, 46, 0.03, 0.22, 0.4, 1.4), bar, st_, 0.8 if st_ % 4 == 0 else 0.55)
    for st_ in (4, 12): S.put("drums", k_snare(220, 0.6, 0.1, 1.0, 0.3, 0.4), S.T(bar, st_), 0.6, 0, 0.15)
    for st_ in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, st_), 0.16, -0.35)
    if bar % 2: S.put("drums", k_tamb(), S.T(bar, 14), 0.25, 0.4)


def kit_edm(S, bar):
    edm_drums(S, bar, k_kick(140, 48, 0.02, 0.2, 0.6, 1.8), k_clap(0.35, 0.11), k_hat(False, 0.022), k_hat(True, 0.1), g=0.8)


def kit_march(S, bar):
    S.kick(k_bass_drum(), bar, 0, 0.8); S.kick(k_bass_drum(), bar, 8, 0.7)
    for st_ in (4, 12): S.put("drums", k_msnare(), S.T(bar, st_), 0.6, 0.1, 0.15)
    for st_ in range(0, 16, 2): S.put("drums", k_msnare(), S.T(bar, st_ + 1), 0.12, 0.1, 0.1)
    if bar % 4 == 3: snare_roll(S, bar, 8, 8, 0.15, 0.55)
    if bar % 8 == 0: S.put("drums", k_timp(38), S.T(bar, 0), 0.5, 0, 0.3)


def bass_pulse(cut=800.0):
    def f(S, bar, r):
        for st_ in range(0, 16, 2): S.put("bass", i_bass(r + (12 if st_ % 8 == 6 else 0), S.st * 1.5, cut, 0.06, 0.7, 1.8), S.T(bar, st_), 0.7)
    return f


def bass_oompah(S, bar, r):
    for st_, iv in ((0, 0), (4, 7), (8, 0), (12, 7)): S.put("bass", i_tuba(r + iv, S.st * 2), S.T(bar, st_), 0.75)


def bass_tribal(S, bar, r):
    S.put("bass", i_tuba(r, S.st * 3), S.T(bar, 0), 0.75); S.put("bass", i_tuba(r + 7, S.st * 2), S.T(bar, 10), 0.6)


def bass_walk(S, bar, r):
    for st_, iv in ((0, 0), (4, 7), (8, 12), (12, 10)): S.put("bass", i_bass(r + iv, S.st * 3.5, 600, 0.08, 0.6, 1.3), S.T(bar, st_), 0.75)


def bass_reese(S, bar, r):
    S.put("bass", i_reese(r, S.st * 7), S.T(bar, 0), 0.7); S.put("bass", i_reese(r + (3 if bar % 2 else 0), S.st * 7), S.T(bar, 8), 0.65)


def bass_sub(S, bar, r):
    S.put("bass", i_808(r, S.st * 6), S.T(bar, 0), 0.7); S.put("bass", i_808(r + 7, S.st * 4), S.T(bar, 10), 0.55)


def bass_chip(S, bar, r):
    for st_ in range(0, 16, 2): S.put("bass", i_chip_tri(r + 12 + (12 if st_ % 4 == 2 else 0), S.st * 1.8), S.T(bar, st_), 0.6)


def stabs(inst, steps=(2, 6, 10, 14), g=0.15, oct_=0):
    def f(S, bar, ch):
        for st_ in steps:
            for m in ch: S.put("music", inst(m + oct_, S.st * 0.8), S.T(bar, st_), g, 0.35, 0.1)
    return f


def runner(S, prog, hook, lead, chords, bass, kit, lo=33, pad=None, arp=False, lead_g=0.36, second=None):
    bars = (prog * 4)[:16]
    for bar, c in enumerate(bars):
        r = root(c, lo)
        if bar % 8 == 0: crash_at(S, bar, 0.38)
        kit(S, bar)
        bass(S, bar, r)
        chords(S, bar, vc(c, 60))
        if pad:
            for m in vc(c, 55): S.put("music", pad(m, S.st * 15), S.T(bar, 0), 0.08, 0, 0.3)
        if arp and bar >= 4: arp16(S, bar, c, 0.1, 67, every=2, bright=6500.0)
    S.seq("music", lead, hook, 4, lead_g, 0.1, 0.25, 0.12)
    S.seq("music", lead, hook, 12, lead_g, 0.1, 0.25, 0.12)
    if second: S.seq("music", second, [(st_, m - 12, ln) for st_, m, ln in hook], 12, lead_g * 0.6, -0.2, 0.2, 0.0)
    riser_into_loop(S, 1, 0.18)


H_JUNGLE = mel("e5 2 g5 2 a5 2 b5 2 d6 4 b5 4  a5 2 b5 2 g5 2 e5 2 d5 4 e5 4  g5 2 a5 2 b5 2 d6 2 e6 4 d6 2 b5 2  a5 3 g5 1 e5 4 e5 8")
H_SNOW = mel("f#5 2 a5 2 d6 4 c#6 2 a5 2 f#5 4  g5 2 b5 2 d6 4 e6 4 d6 4  f#6 2 e6 2 d6 2 c#6 2 b5 4 a5 4  g5 2 f#5 2 e5 4 d5 8")
H_TOY = mel("g5 1 b5 1 d6 2 b5 2 g5 2 a5 2 b5 2 c6 4  d6 2 c6 2 b5 2 a5 2 g5 4 d5 4  e5 2 g5 2 c6 2 e6 2 d6 4 b5 4  a5 2 c6 2 b5 2 a5 2 g5 8")
H_SPOOKY = mel("d5 2 f5 2 a5 2 c#6 2 d6 4 a5 4  a#5 2 a5 2 g5 2 f5 2 e5 4 a4 4  d5 2 e5 2 f5 2 g5 2 a5 4 f5 4  e5 2 c#5 2 e5 4 d5 8")
H_CANYON = mel("a4 3 c5 1 e5 4 d5 2 c5 2 a4 4  g4 3 a4 1 c5 4 d5 4 e5 4  a5 3 g5 1 e5 4 d5 2 e5 2 c5 4  b4 2 c5 2 b4 4 a4 8")
H_NEON = mel("e5 2 g5 2 b5 2 e6 2 d6 4 b5 4  c6 2 b5 2 a5 2 g5 2 a5 4 b5 4  e6 2 f#6 2 g6 4 f#6 2 e6 2 d6 4  b5 2 d6 2 e6 4 e5 8")
H_LAVA = mel("c5 2 d#5 2 g5 2 c6 2 a#5 4 g5 4  g#5 2 g5 2 f5 2 d#5 2 d5 4 g4 4  c5 2 d#5 2 f5 2 g5 2 g#5 4 a#5 4  g5 2 f5 2 d5 4 c5 8")
H_SKY = mel("a5 2 c#6 2 e6 4 d6 2 c#6 2 b5 4  a5 2 b5 2 c#6 4 e6 4 a5 4  f#5 2 a5 2 d6 4 c#6 2 b5 2 a5 4  g#5 2 a5 2 b5 4 a5 8")
H_SPACE = mel("a5 2 e6 2 a5 2 c6 2 b5 4 e5 4  f5 2 a5 2 c6 2 e6 2 d6 4 b5 4  c6 2 b5 2 a5 2 g5 2 a5 4 e6 4  d6 2 b5 2 g#5 4 a5 8")
H_CASTLE = mel("d#5 2 g5 2 a#5 4 g5 2 a#5 2 d#6 4  d6 2 c6 2 a#5 2 g#5 2 g5 4 d#5 4  f5 2 g5 2 g#5 4 a#5 4 c6 4  a#5 2 g#5 2 g5 4 d#5 8")


def st_jungle(S, act): runner(S, ["Em", "C", "D", "Em"], H_JUNGLE, lambda m, d: i_kalimba(m, 0.5), stabs(lambda m, d: i_marimba(m, 0.4), (3, 6, 11, 14), 0.16), bass_tribal, kit_tribal, 28)
def st_snow(S, act): runner(S, ["D", "G", "A", "D"], H_SNOW, i_celesta, stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.12), bass_pulse(700.0), kit_sleigh, 38, pad=lambda m, d: i_strings(m, d, 0.3, False, 2800.0), second=lambda m, d: i_strings(m, d, 0.05, False, 3600.0))
def st_toy(S, act): runner(S, ["G", "D", "C", "D"], H_TOY, i_toypiano, stabs(lambda m, d: i_toypiano(m, 0.3), (2, 6, 10, 14), 0.12, 12), bass_chip, kit_chip, 31, second=lambda m, d: mono(i_chip(m, d, 0.25)))
def st_spooky3(S, act): runner(S, ["Dm", "A#", "Dm", "A"], H_SPOOKY, lambda m, d: i_celesta(m, 0.5), stabs(lambda m, d: i_brass(m, d, True, 2600.0), (6, 14), 0.2), bass_walk, kit_swing, 38, pad=lambda m, d: i_choir(m, d, 0.4))
def st_canyon(S, act): runner(S, ["Am", "G", "Am", "E"], H_CANYON, lambda m, d: i_lead(m, d, None, 3800.0, 0.012, 0.1, 0.7), stabs(lambda m, d: i_clean(m, d, 2), (2, 6, 10, 14), 0.15), bass_oompah, kit_gallop, 33, second=lambda m, d: i_brass(m, d, False, 2800.0))
def st_neon(S, act): runner(S, ["Em", "C", "G", "D"], H_NEON, lambda m, d: i_lead(m, d, None, 6000.0, 0.008, 0.3, 1.0), stabs(lambda m, d: i_pluck(m, 0.3, 7000.0, 500.0, 0.06, 0.2), (3, 7, 11, 15), 0.12), bass_pulse(1100.0), kit_edm, 28, pad=lambda m, d: mono(i_ssaw(m, d, 2400.0, 0.3, 0.6, 0.012, 5)) * 0.5, arp=True)
def st_lava2(S, act): runner(S, ["Cm", "G#", "Fm", "G"], H_LAVA, lambda m, d: i_brass(m, d, False, 3400.0), stabs(lambda m, d: i_brass(m, d, True, 2600.0), (0, 6, 12), 0.18), bass_reese, lambda S, b: kit_rock(S, b, True), 24, second=lambda m, d: i_gtr_lead(m, d))
def st_sky(S, act): runner(S, ["A", "E", "D", "E"], H_SKY, lambda m, d: i_harp(m, 0.6), stabs(lambda m, d: i_pluck(m, 0.35, 6000.0, 600.0, 0.07, 0.25), (2, 6, 10, 14), 0.14), bass_pulse(650.0), kit_sleigh, 33, pad=lambda m, d: i_strings(m, d, 0.35, False, 2600.0), second=lambda m, d: i_glock(m, 0.4))
def st_space2(S, act): runner(S, ["Am", "F", "C", "E"], H_SPACE, lambda m, d: mono(i_chip(m, d, 0.25, 0.008)), stabs(lambda m, d: i_pluck(m, 0.3, 7500.0, 500.0, 0.05, 0.2), (3, 7, 11, 15), 0.12), bass_sub, kit_edm, 33, pad=lambda m, d: mono(i_ssaw(m, d, 2200.0, 0.3, 0.6, 0.012, 5)) * 0.4, arp=True)
def st_castle2(S, act): runner(S, ["D#", "G#", "A#", "D#"], H_CASTLE, lambda m, d: i_brass(m, d, False, 3600.0), stabs(lambda m, d: i_strings(m, d, 0.02, True, 3600.0), (0, 2, 4, 6, 8, 10, 12, 14), 0.07), bass_oompah, kit_march, 39, pad=lambda m, d: i_choir(m, d, 0.4), second=lambda m, d: i_brass(m, d, False, 2600.0))


style("jungle", 124, 16, 124, 16, 1.2, 1.2, sc=(0.05, 0.0), bal_a=(0.5, -0.5, -0.5))(st_jungle)
style("snow", 128, 16, 128, 16, 1.5, 1.5, sc=(0.35, 0.0), bal_a=(0.0, 0.5, -1.5))(st_snow)
style("toy", 136, 16, 136, 16, 0.8, 0.8, bal_a=(-0.5, 0.5, -2.0))(st_toy)
style("spooky", 128, 16, 128, 16, 1.6, 1.6, sw=(0.14, 0.14), bal_a=(-0.5, 0.5, -1.0))(st_spooky3)
style("canyon", 126, 16, 126, 16, 1.2, 1.2, bal_a=(0.0, 0.0, -1.0))(st_canyon)
style("neon", 128, 16, 128, 16, 1.6, 1.6, sc=(0.5, 0.0), bal_a=(0.0, 0.5, -1.5))(st_neon)
style("lava", 140, 16, 140, 16, 1.1, 1.1, bal_a=(0.5, 0.0, -0.5))(st_lava2)
style("sky", 120, 16, 120, 16, 1.6, 1.6, sc=(0.3, 0.0), bal_a=(-0.5, 0.5, -1.5))(st_sky)
style("space", 130, 16, 130, 16, 1.8, 1.8, sc=(0.6, 0.0), bal_a=(0.0, 0.5, -1.0))(st_space2)
style("castle", 138, 16, 138, 16, 2.0, 2.0, bal_a=(-1.0, 1.0, -3.0))(st_castle2)

# ---------------------------------------------------------------- STAR — the booster's short, bouncy power-up loop (original)
H_STAR = mel("f5 1 a5 1 c6 2 a5 1 c6 1 f6 2 e6 2 c6 2 a5 4  g5 1 a#5 1 d6 2 a#5 1 d6 1 g6 2 f6 2 d6 2 a#5 4  a5 1 c6 1 f6 2 g6 2 a6 2 g6 2 f6 2 e6 2 f6 2  c6 2 d6 2 e6 2 g6 2 f6 8")


def st_star(S, act):
    prog = ["F", "Gm", "F", "C"] * 2
    for bar, c in enumerate(prog):
        r = root(c, 29)
        if bar % 4 == 0: crash_at(S, bar, 0.35)
        kit_chip(S, bar)
        for st_ in range(0, 16, 2): S.put("drums", k_tamb(), S.T(bar, st_ + 1), 0.16, 0.4)
        bass_chip(S, bar, r)
        for st_ in (2, 6, 10, 14):
            for m in vc(c, 64): S.put("music", i_pluck(m, S.st * 0.7, 7500.0, 600.0, 0.05, 0.18), S.T(bar, st_), 0.12, 0.35, 0.08)
    S.seq("music", lambda m, d: mono(i_chip(m, d, 0.25, 0.006)), H_STAR, 0, 0.3, 0.05, 0.15, 0.12)
    S.seq("music", lambda m, d: i_glock(m, 0.35), H_STAR, 0, 0.22, -0.25, 0.25)
    S.seq("music", lambda m, d: mono(i_chip(m, d, 0.5, 0.006)), [(st_, m + 12, ln) for st_, m, ln in H_STAR], 4, 0.18, 0.2, 0.15, 0.12)
    S.seq("music", lambda m, d: i_glock(m, 0.35), H_STAR, 4, 0.22, -0.25, 0.25)


style("star", 168, 8, 168, 8, 0.8, 0.8, bal_a=(-0.5, 0.5, -2.0))(st_star)

ACTION_ONLY = {"jungle", "snow", "toy", "spooky", "canyon", "neon", "lava", "sky", "space", "castle", "chase", "star"}


def run_music():
    for key, spec in STYLES.items():
        for v, act in (("calm", False), ("action", True)):
            if key in ACTION_ONLY and not act: continue
            if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
            bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
            S = Song(f"dash_{key}_{v}", bpm, bars, rt, sw)
            spec["fn"](S, act)
            S.render(-16.5 if act else -16.0, sc, None, 0.55, dl, tag=v, bal=bal)


# ---------------------------------------------------------------- SFX
def st2(y): y = np.asarray(y, dtype=np.float64); return np.stack([y, y])


def sweep_tone(f0, f1, d, shape="sin", curve=1.0):
    n = ns(d); t = tt(n); k = (t / d) ** curve
    f = f0 * (f1 / f0) ** k
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if shape == "sin" else np.sign(np.sin(ph)) * 0.6


def env(n, a, r):
    t = tt(n); d = n / SR
    return np.minimum(1, t / max(1e-4, a)) * np.exp(-np.maximum(0, t - a) / max(1e-4, r)) * np.clip((d - t) / 0.01, 0, 1)


def put(out, x, at, g=1.0):
    i = ns(at); k = min(len(x), len(out) - i)
    if k > 0: out[i: i + k] += x[:k] * g


def sfx():
    if ONLY and "sfx" not in ONLY: return
    S_ = {}
    # the coin-melody chime (C5; the game pitch-shifts it to play the tune)
    n = ns(1.2); y = np.zeros(n)
    put(y, i_glock(72, 0.4), 0, 0.9); put(y, i_bell(84, 0.7), 0, 0.22); put(y, mono(i_musicbox(84, 0.4)), 0.004, 0.25)
    S_["chime"] = y
    # jump: a springy boing up
    d = 0.32; n = ns(d); t = tt(n)
    f = 260 * (2.6 ** (t / d)) * (1 + 0.06 * np.sin(2 * np.pi * 28 * t) * np.exp(-t / 0.12))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.12) + 0.15 * bp(nz(n), 1500, 6000) * env(n, 0.002, 0.03)
    S_["jump"] = y
    # land: soft clay thud
    d = 0.2; n = ns(d); t = tt(n)
    y = np.sin(2 * np.pi * np.cumsum(140 * (0.45 ** (t / d))) / SR) * env(n, 0.002, 0.06) + 0.35 * lp(nz(n), 900) * env(n, 0.001, 0.04)
    S_["land"] = y
    # swipe: a short whoosh
    d = 0.22; n = ns(d); x = nz(n)
    y = hp(sweep_filt(x, "low", 900, 4200, curve=0.7), 350) * np.sin(np.pi * tt(n) / d) ** 1.5 * 0.9
    S_["swipe"] = y
    # squish: a squelchy slide
    d = 0.38; n = ns(d); t = tt(n)
    y = hp(sweep_filt(nz(n), "low", 2400, 500), 200) * env(n, 0.01, 0.16) * 0.7 + np.sin(2 * np.pi * np.cumsum(180 + 60 * np.sin(2 * np.pi * 18 * t)) / SR) * env(n, 0.005, 0.12) * 0.5
    S_["squish"] = y
    # trick: sparkly up-run
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91, 96)): put(y, i_glock(m, 0.3), 0.04 * i, 0.75 - i * 0.08)
    y += hp(nz(n), 7000) * np.exp(-tt(n) / 0.2) * 0.06
    S_["trick"] = y
    # melody complete: a harp flourish
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88, 91, 96)): put(y, i_harp(m, 0.6), 0.045 * i, 0.5)
    put(y, i_bell(96, 0.8), 0.32, 0.3)
    S_["melody"] = y
    # power-up: riser + chord sparkle
    n = ns(1.0); y = np.zeros(n)
    put(y, mono(fx_riser(0.45, 400.0, 6000.0, 0.25)), 0, 0.6)
    for m in (72, 76, 79, 84): put(y, i_glock(m, 0.5), 0.42, 0.4)
    S_["power"] = y
    # stumble: a wobbly boing-oing down
    d = 0.55; n = ns(d); t = tt(n)
    f = 520 * (0.42 ** (t / d)) * (1 + 0.18 * np.sin(2 * np.pi * 16 * t))
    S_["wobble"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.25) * 0.8
    # crash: bonk + clatter
    n = ns(0.9); t = tt(n); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(220 * (0.3 ** (tt(ns(0.25)) / 0.25))) / SR) * env(ns(0.25), 0.001, 0.08), 0, 0.9)
    put(y, bp(nz(n), 300, 5000) * np.exp(-t / 0.18), 0.01, 0.55)
    put(y, mono(fx_boom(0.6, 90.0, 35.0)), 0, 0.6)
    S_["crash"] = y
    # countdown beeps and GO
    n = ns(0.2); t = tt(n)
    S_["count"] = (np.sin(2 * np.pi * 880 * t) + 0.3 * np.sin(2 * np.pi * 1760 * t)) * env(n, 0.003, 0.08) * 0.7
    n = ns(0.7); y = np.zeros(n)
    for m in (72, 76, 79, 84): put(y, i_brass(m, 0.35, True, 4000.0), 0, 0.35)
    put(y, (np.sin(2 * np.pi * 1320 * tt(ns(0.3))) * env(ns(0.3), 0.003, 0.12)), 0, 0.4)
    S_["go"] = y
    # boost pad: up-sweep with a whoosh
    d = 0.5; n = ns(d)
    S_["pad"] = sweep_tone(300, 1400, d) * env(n, 0.005, 0.25) * 0.6 + hp(sweep_filt(nz(n), "low", 600, 6000), 300) * env(n, 0.01, 0.2) * 0.5
    # fever: party stab + sparkle
    n = ns(1.0); y = np.zeros(n)
    for m in (67, 72, 76, 79): put(y, i_brass(m, 0.45, True, 3800.0), 0, 0.32)
    for i, m in enumerate((91, 96, 100)): put(y, i_glock(m, 0.4), 0.15 + 0.05 * i, 0.35)
    S_["fever"] = y
    # kart horn: a cute squeeze honk-honk
    n = ns(0.5); y = np.zeros(n)
    for at in (0.0, 0.2):
        k = ns(0.16); tt_ = tt(k)
        h = (np.sign(np.sin(2 * np.pi * 410 * tt_)) * 0.4 + np.sin(2 * np.pi * 520 * tt_) * 0.5) * env(k, 0.01, 0.1)
        put(y, lp(h, 2500), at, 0.7)
    S_["horn"] = y
    # catch: the thief is caught
    n = ns(1.4); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84)): put(y, i_brass(m, 0.3, True, 4200.0), 0.08 * i, 0.32)
    for m in (72, 76, 79, 84): put(y, i_brass(m, 0.7, False, 4200.0), 0.36, 0.3)
    put(y, i_bell(96, 1.0), 0.36, 0.3)
    S_["catch"] = y
    for k, y in S_.items():
        write_wav(f"sfx_dash_{k}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_dash.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
