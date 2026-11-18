"""Kiko's Jungle Quest sound pack: music per region (calm = menus, action = the run), a seed-chase track, the Smoothie
Rush loop, the banana coin "ba-ding", the jungle effects and
the ambience calls (birds, a night owl, monkey chatter) that the game places all around the player.

usage: python scripts/gen_kiko_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = grove, river, chase, rush (or e.g. grove_calm), sfx. Files: music_kiko_<style>_<calm|action>, sfx_kiko_<name>.

Banana Grove = a bouncy marimba-and-kalimba jungle groove (toms, shakers, log drums), Mango River = a sunny steel-drum
calypso, Chase = driving bongos and brass, Rush = a quick, sparkly power-up loop. All original melodies.
Reuses the studio of gen_dash_audio.py (→ gen_boing_audio.py → … → gen_racing_audio.py).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen_dash_audio.py"), encoding="utf-8").read()
exec(_src[: _src.index(chr(10) + "def run_music():")])
STYLES.clear()  # noqa: F821  (defined by the exec above)


# ---------------------------------------------------------------- BANANA GROVE — marimba jungle groove in C
H_GROVE = mel("c5 2 d5 2 e5 2 g5 2 a5 2 g5 2 e5 2 d5 2  c5 2 e5 2 g5 2 c6 2 a5 2 g5 2 e5 2 g5 2  f5 2 e5 2 d5 2 c5 2 d5 2 e5 2 g5 2 e5 2  d5 2 c5 2 a4 2 c5 2 d5 2 e5 2 c5 4")
H_GROVE_B = mel("e5 3 g5 1 a5 2 c6 2 a5 4 g5 4  f5 3 a5 1 c6 2 d6 2 c6 4 a5 4  g5 2 a5 2 g5 2 e5 2 d5 2 e5 2 g5 4  a5 2 g5 2 e5 2 d5 2 c5 8")


def kit_jungle(S, bar, soft=False):
    S.kick(k_kick(105, 46, 0.03, 0.25, 0.25, 1.3, 0.45), bar, 0, 0.75 if not soft else 0.45)
    if not soft: S.kick(k_kick(105, 46, 0.03, 0.25, 0.25, 1.3, 0.45), bar, 10, 0.55)
    for st_ in ((3, 6, 11, 14) if not soft else (6, 14)): S.put("drums", k_tom(190.0 if st_ % 2 else 140.0, 0.35, 0.1), S.T(bar, st_), 0.3 if st_ in (6, 14) else 0.2, 0.3 * (1 if st_ % 2 else -1), 0.12)
    for st_ in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, st_ + (1 if st_ % 4 else 0)), 0.18 if st_ % 4 == 0 else 0.11, -0.35)
    if not soft and bar % 2: S.put("drums", k_rim(), S.T(bar, 12), 0.28, 0.25, 0.15)
    if not soft and bar % 4 == 3: S.put("drums", k_taiko(), S.T(bar, 12), 0.45, 0, 0.2)


def st_grove(S, act):
    prog = ["C", "Am", "F", "G"] * (4 if act else 2)
    for bar, c in enumerate(prog):
        r = root(c, 36)
        if act and bar % 8 == 0: crash_at(S, bar, 0.3)
        kit_jungle(S, bar, not act)
        if act:
            for st_, iv in ((0, 0), (3, 7), (6, 12), (8, 0), (11, 7), (14, 10)): S.put("bass", i_tuba(r + iv - 12, S.st * 1.6), S.T(bar, st_), 0.62)
            for st_ in (2, 6, 10, 14):
                for m in vc(c, 62): S.put("music", i_kalimba(m, 0.3), S.T(bar, st_), 0.12, 0.35, 0.1)
            if bar >= 4: arp16(S, bar, c, 0.07, 72, every=2, bright=5200.0)
        else:
            S.put("bass", i_tuba(r - 12, S.st * 6), S.T(bar, 0), 0.5); S.put("bass", i_tuba(r - 5, S.st * 4), S.T(bar, 8), 0.4)
            for m in vc(c, 60): S.put("music", i_kalimba(m, 0.6), S.T(bar, 0), 0.12, 0.2, 0.3)
    if act:
        S.seq("music", lambda m, d: i_marimba(m, 0.45), H_GROVE, 4, 0.42, 0.1, 0.25, 0.1)
        S.seq("music", lambda m, d: i_marimba(m, 0.45), H_GROVE_B, 8, 0.4, 0.1, 0.25, 0.1)
        S.seq("music", lambda m, d: i_marimba(m, 0.45), H_GROVE, 12, 0.42, 0.1, 0.25, 0.1)
        S.seq("music", lambda m, d: i_glock(m, 0.3), [(st_, m + 12, ln) for st_, m, ln in H_GROVE], 12, 0.12, -0.3, 0.25)
        riser_into_loop(S, 1, 0.16)
    else:
        S.seq("music", lambda m, d: i_marimba(m, 0.5), H_GROVE, 0, 0.36, 0.1, 0.3, 0.2)
        S.seq("music", lambda m, d: i_kalimba(m, 0.5), H_GROVE_B, 4, 0.3, -0.1, 0.3, 0.2)


# ---------------------------------------------------------------- MANGO RIVER — steel-drum calypso in F
H_RIVER = mel("f5 2 a5 2 c6 2 a5 2 f5 2 g5 2 a5 2 f5 2  e5 2 g5 2 a#5 2 g5 2 e5 2 f5 2 g5 2 e5 2  f5 2 a5 2 c6 2 d6 2 c6 2 a5 2 g5 2 a5 2  a#5 2 a5 2 g5 2 f5 2 e5 2 f5 2 g5 2 f5 2")
H_RIVER_B = mel("c6 3 a5 1 c6 2 d6 2 c6 4 a5 4  a#5 3 g5 1 a#5 2 c6 2 a#5 4 g5 4  a5 2 c6 2 f6 2 e6 2 d6 2 c6 2 a#5 2 a5 2  g5 2 a5 2 a#5 2 g5 2 f5 8")


def st_river(S, act):
    prog = ["F", "Bb", "C7", "F"] * (4 if act else 2)
    kk = k_kick(115, 50, 0.02, 0.18, 0.6, 1.4)
    for bar, c in enumerate(prog):
        r = root(c, 29)
        if act and bar % 8 == 0: crash_at(S, bar, 0.3)
        for st_ in range(16):
            if act:
                if st_ in (0, 8): S.kick(kk, bar, st_, 0.85)
                if st_ in (3, 11): S.kick(kk, bar, st_, 0.45)
                if st_ in (4, 12): S.put("drums", k_rim(), S.T(bar, st_), 0.4, 0.15, 0.15)
                if st_ % 2 == 0: S.put("drums", k_shaker(), S.T(bar, st_), 0.17 if st_ % 4 == 2 else 0.11, -0.35)
                if st_ in (6, 7, 14): S.put("drums", k_tom(230.0 if st_ == 7 else 170.0, 0.3, 0.1), S.T(bar, st_), 0.26, 0.3, 0.1)
            else:
                if st_ in (0, 10): S.kick(kk, bar, st_, 0.45)
                if st_ % 4 == 2: S.put("drums", k_shaker(), S.T(bar, st_), 0.13, -0.3)
        if act:
            for st_, iv in ((0, 0), (3, 7), (6, 12), (8, 0), (10, 4), (12, 7), (14, 12)): S.put("bass", i_bass(r + iv, S.st * 1.4, 700, 0.07, 0.65, 1.3), S.T(bar, st_), 0.66)
            for st_ in (2, 5, 10, 13):
                for m in vc(c, 62): S.put("music", i_steel(m, 0.25), S.T(bar, st_), 0.1, 0.35, 0.1)
        else:
            S.put("bass", i_bass(r, S.st * 7, 500, 0.05, 0.6, 1.2), S.T(bar, 0), 0.6)
            for m in vc(c, 60): S.put("music", i_steel(m, 0.5), S.T(bar, 0), 0.12, 0.2, 0.25)
    if act:
        S.seq("music", lambda m, d: i_steel(m, 0.4), H_RIVER, 4, 0.42, 0.1, 0.25, 0.12)
        S.seq("music", lambda m, d: i_steel(m, 0.4), H_RIVER_B, 8, 0.4, 0.1, 0.25, 0.12)
        S.seq("music", lambda m, d: i_steel(m, 0.4), H_RIVER, 12, 0.42, 0.1, 0.25, 0.12)
        S.seq("music", lambda m, d: i_marimba(m, 0.35), [(st_, m - 12, ln) for st_, m, ln in H_RIVER], 12, 0.2, -0.3, 0.2)
        riser_into_loop(S, 1, 0.16)
    else:
        S.seq("music", lambda m, d: i_steel(m, 0.45), H_RIVER, 0, 0.34, 0.1, 0.3, 0.2)
        S.seq("music", lambda m, d: i_steel(m, 0.45), H_RIVER_B, 4, 0.3, -0.1, 0.3, 0.2)


# ---------------------------------------------------------------- CHASE — bongos and brass, A minor
H_CHASE = mel("a4 2 c5 2 e5 2 a5 2 g5 2 e5 2 d5 2 e5 2  f5 2 a5 2 c6 2 a5 2 g5 4 e5 4  d5 2 f5 2 a5 2 d6 2 c6 2 a5 2 g5 2 f5 2  e5 2 g#5 2 b5 2 d6 2 c6 4 a5 4")


def st_chase(S, act):
    prog = ["Am", "F", "Dm", "E"] * 4
    sn = k_snare(230, 0.6, 0.11, 1.0, 0.35, 0.5)
    for bar, c in enumerate(prog):
        r = root(c, 33)
        if bar % 4 == 0: crash_at(S, bar, 0.36)
        for st_ in (0, 6, 8, 11): S.kick(k_kick(120, 46, 0.02, 0.2, 0.6, 1.6), bar, st_, 0.85 if st_ % 8 == 0 else 0.6)
        for st_ in (4, 12): S.put("drums", sn, S.T(bar, st_), 0.7, 0, 0.12)
        for st_ in range(16): S.put("drums", k_tom(260.0 if st_ % 3 == 0 else 200.0, 0.2, 0.06), S.T(bar, st_), 0.2 if st_ % 4 == 0 else 0.11, 0.35 * (1 if st_ % 2 else -1), 0.08)
        for st_ in range(0, 16, 2): S.put("bass", i_bass(r + (12 if st_ % 8 == 6 else 0), S.st * 1.5, 800, 0.06, 0.7, 1.8), S.T(bar, st_), 0.72)
        if bar % 2 == 1:
            for m in vc(c, 62): S.put("music", i_brass(m, S.st * 1.5, True, 3200.0), S.T(bar, 13), 0.24, -0.2, 0.2)
        for st_ in (2, 6, 10, 14):
            for m in vc(c, 64): S.put("music", i_marimba(m, 0.25), S.T(bar, st_), 0.08, 0.35, 0.1)
    S.seq("music", i_brass, H_CHASE, 4, 0.32, -0.1, 0.2, 0.0, cut=3400.0)
    S.seq("music", i_brass, H_CHASE, 12, 0.32, -0.1, 0.2, 0.0, cut=3400.0)
    S.seq("music", lambda m, d: i_marimba(m, 0.35), [(st_, m + 12, ln) for st_, m, ln in H_CHASE], 12, 0.16, 0.3, 0.25)
    riser_into_loop(S, 1, 0.2)


# ---------------------------------------------------------------- RUSH — the Smoothie Rush / pepper rocket loop
H_RUSH = mel("c6 1 e6 1 g6 2 e6 1 g6 1 c7 2 b6 2 g6 2 e6 4  d6 1 f6 1 a6 2 f6 1 a6 1 d7 2 c7 2 a6 2 f6 4  e6 1 g6 1 c7 2 d7 2 e7 2 d7 2 c7 2 b6 2 c7 2  g6 2 a6 2 b6 2 d7 2 c7 8")


def st_rush(S, act):
    prog = ["C", "Dm", "C", "G"] * 2
    for bar, c in enumerate(prog):
        r = root(c, 36)
        if bar % 4 == 0: crash_at(S, bar, 0.32)
        kit_chip(S, bar)
        for st_ in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, st_ + 1), 0.18, 0.4)
        bass_chip(S, bar, r)
        for st_ in (2, 6, 10, 14):
            for m in vc(c, 64): S.put("music", i_marimba(m, 0.22), S.T(bar, st_), 0.12, 0.35, 0.08)
    S.seq("music", lambda m, d: i_marimba(m, 0.3), H_RUSH, 0, 0.32, 0.05, 0.15, 0.1)
    S.seq("music", lambda m, d: i_glock(m, 0.35), H_RUSH, 0, 0.18, -0.25, 0.25)
    S.seq("music", lambda m, d: mono(i_chip(m, d, 0.25, 0.006)), [(st_, m - 12, ln) for st_, m, ln in H_RUSH], 4, 0.16, 0.2, 0.15, 0.12)
    S.seq("music", lambda m, d: i_marimba(m, 0.3), H_RUSH, 4, 0.32, 0.05, 0.15, 0.1)


style("grove", 124, 16, 104, 8, 1.2, 1.6, sc=(0.05, 0.0), bal_a=(0.5, -0.5, -0.5), bal_c=(-2.0, 0.0, -1.0))(st_grove)
style("river", 128, 16, 108, 8, 1.2, 1.6, sc=(0.1, 0.0), bal_a=(0.0, -0.5, -0.5), bal_c=(-2.5, 0.0, -1.5))(st_river)
style("chase", 140, 16, 140, 16, 1.2, 1.2, bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(st_chase)
style("rush", 168, 8, 168, 8, 0.8, 0.8, bal_a=(-0.5, 0.5, -2.0))(st_rush)
# ---------------------------------------------------------------- REGIONS 3–15: one arranger (runner from Momo Dash), thirteen bands
def notes(tune, last=4):
    """a 32-note region tune as a 4-bar hook (eighth notes, the last one longer)"""
    names = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]
    out = []
    for i, m in enumerate(tune[:31]): out.append(f"{names[m % 12]}{m // 12 - 1} 2")
    out.append(f"{names[tune[31] % 12]}{tune[31] // 12 - 1} {last - 2}")
    return mel(" ".join(out))


T_BAMBOO = [74, 76, 78, 81, 83, 81, 78, 76, 74, 78, 81, 86, 83, 81, 78, 81, 79, 78, 76, 74, 76, 78, 81, 78, 76, 74, 71, 74, 76, 78, 74, 74]
T_FALLS = [69, 73, 76, 81, 80, 76, 73, 76, 74, 78, 81, 78, 76, 73, 71, 73, 69, 73, 76, 78, 81, 83, 85, 81, 83, 80, 76, 80, 81, 76, 73, 69]
T_MUSH = [67, 70, 74, 70, 67, 69, 70, 74, 75, 74, 70, 69, 67, 69, 70, 67, 74, 75, 79, 75, 74, 70, 69, 70, 74, 70, 69, 66, 67, 69, 66, 67]
T_MARSH = [76, 79, 83, 79, 76, 74, 71, 74, 76, 79, 81, 83, 81, 79, 76, 79, 72, 76, 79, 76, 74, 78, 81, 78, 79, 76, 74, 71, 72, 74, 71, 76]
T_CANOPY = [72, 76, 79, 83, 84, 83, 79, 76, 78, 81, 84, 81, 79, 76, 74, 76, 72, 74, 76, 78, 79, 81, 83, 84, 83, 79, 76, 74, 72, 74, 76, 72]
T_NIGHT = [77, 80, 84, 80, 77, 79, 80, 84, 85, 84, 80, 79, 77, 79, 80, 77, 84, 85, 89, 85, 84, 80, 79, 80, 84, 80, 79, 76, 77, 79, 76, 77]
T_BLOSSOM = [79, 83, 86, 83, 79, 81, 83, 86, 88, 86, 83, 81, 79, 81, 83, 79, 86, 88, 91, 88, 86, 83, 81, 83, 84, 83, 81, 79, 78, 79, 81, 79]
T_CAVES = [71, 74, 78, 74, 71, 73, 74, 78, 79, 78, 74, 73, 71, 73, 74, 71, 78, 79, 83, 79, 78, 74, 73, 74, 78, 74, 73, 70, 71, 73, 70, 71]
T_AUTUMN = [69, 72, 76, 72, 69, 71, 72, 76, 77, 76, 72, 71, 69, 71, 72, 69, 76, 77, 81, 77, 76, 72, 71, 72, 74, 72, 71, 68, 69, 71, 68, 69]
T_PLAINS = [77, 79, 81, 84, 86, 84, 81, 79, 77, 81, 84, 89, 86, 84, 81, 84, 82, 81, 79, 77, 79, 81, 84, 81, 79, 77, 74, 77, 79, 81, 77, 77]
T_MANGROVE = [74, 77, 81, 77, 74, 76, 77, 81, 82, 81, 77, 76, 74, 76, 77, 74, 81, 82, 86, 82, 81, 77, 76, 77, 81, 77, 76, 73, 74, 76, 73, 74]
T_SNOW = [74, 78, 81, 86, 85, 81, 78, 81, 79, 83, 86, 83, 81, 78, 76, 78, 74, 78, 81, 83, 86, 88, 90, 86, 88, 85, 81, 85, 86, 81, 78, 74]
T_VOLCANO = [72, 75, 79, 75, 72, 74, 75, 79, 80, 79, 75, 74, 72, 74, 75, 72, 79, 80, 84, 80, 79, 75, 74, 75, 79, 75, 74, 71, 72, 74, 71, 72]
H_BOSS = mel("e5 2 g5 2 b5 2 e6 2 d6 2 b5 2 a5 2 b5 2  c6 2 b5 2 a5 2 g5 2 f#5 4 b4 4  e5 2 f#5 2 g5 2 a5 2 b5 2 c6 2 d6 2 e6 2  d#6 2 c6 2 b5 2 a5 2 g5 4 e5 4")


def kit_rain(S, bar):
    kit_jungle(S, bar)
    for st_ in range(16): S.put("drums", k_shaker(), S.T(bar, st_), 0.1 + (0.06 if st_ % 4 == 0 else 0), (0.5 if st_ % 2 else -0.5))


def flute(m, d): return i_lead(m, d, None, 3000.0, 0.012, 0.0, 0.45)
def whistle(m, d): return i_lead(m + 12, d, None, 5200.0, 0.02, 0.0, 0.35)


def st_bamboo(S, act): runner(S, ["D", "Bm", "G", "A"], notes(T_BAMBOO), flute, stabs(lambda m, d: i_pluck(m, 0.4, 6000.0, 500.0, 0.05, 0.3), (2, 6, 10, 14), 0.14), bass_pulse(600.0), kit_tribal, 38, pad=lambda m, d: i_strings(m, d, 0.3, False, 2400.0), second=lambda m, d: i_kalimba(m, 0.4))
def st_falls(S, act): runner(S, ["A", "E", "F#m", "D"], notes(T_FALLS), lambda m, d: i_harp(m, 0.6), stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.1, 12), bass_walk, kit_sleigh, 33, pad=lambda m, d: i_strings(m, d, 0.35, False, 2600.0), second=lambda m, d: i_strings(m, d, 0.05, False, 3600.0))
def st_mush(S, act): runner(S, ["Gm", "D#", "Cm", "D"], notes(T_MUSH), lambda m, d: i_tuba(m, d), stabs(lambda m, d: i_strings(m, d, 0.01, True, 3600.0), (0, 3, 6, 8, 11, 14), 0.1), bass_walk, kit_swing, 31, second=lambda m, d: i_xylo(m, 0.25))
def st_marsh(S, act): runner(S, ["Em", "C", "Am", "B"], notes(T_MARSH), lambda m, d: i_marimba(m, 0.45), stabs(lambda m, d: i_marimba(m - 12, 0.3), (3, 6, 11, 14), 0.14), bass_tribal, kit_rain, 28, pad=lambda m, d: i_choir(m, d, 0.4))
def st_canopy(S, act): runner(S, ["C", "D", "Em", "G"], notes(T_CANOPY), lambda m, d: i_kalimba(m, 0.5), stabs(lambda m, d: i_pluck(m, 0.3, 6500.0, 600.0, 0.06, 0.2), (2, 6, 10, 14), 0.12), bass_pulse(700.0), kit_jungle, 36, second=whistle)
def st_night(S, act): runner(S, ["Fm", "C#", "D#", "C"], notes(T_NIGHT), i_celesta, stabs(lambda m, d: i_glock(m, 0.3), (2, 10), 0.08), bass_walk, kit_swing, 29, pad=lambda m, d: i_strings(m, d, 0.4, False, 2200.0), second=lambda m, d: i_harp(m, 0.6))
def st_blossom(S, act): runner(S, ["G", "D", "Em", "C"], notes(T_BLOSSOM), lambda m, d: i_glock(m, 0.4), stabs(lambda m, d: i_pluck(m, 0.35, 6000.0, 600.0, 0.07, 0.25), (2, 6, 10, 14), 0.12), bass_pulse(650.0), kit_sleigh, 31, pad=lambda m, d: i_strings(m, d, 0.3, False, 2800.0), second=flute)
def st_caves(S, act): runner(S, ["Bm", "G", "Em", "F#"], notes(T_CAVES), lambda m, d: i_bell(m, 0.8), stabs(lambda m, d: i_pluck(m, 0.3, 5000.0, 400.0, 0.06, 0.3), (3, 7, 11, 15), 0.1), bass_sub, kit_tribal, 35, pad=lambda m, d: mono(i_ssaw(m, d, 1800.0, 0.4, 0.8, 0.012, 5)) * 0.4, second=lambda m, d: i_celesta(m, 0.5))
def st_autumn(S, act): runner(S, ["Am", "F", "C", "E"], notes(T_AUTUMN), lambda m, d: i_accordion(m, d), stabs(lambda m, d: i_clean(m, d, 1), (2, 6, 10, 14), 0.15), bass_oompah, kit_gallop, 33, second=lambda m, d: i_clarinet(m, d))
def st_plains(S, act): runner(S, ["F", "Bb", "C", "F"], notes(T_PLAINS), lambda m, d: i_marimba(m, 0.45), stabs(lambda m, d: i_kalimba(m, 0.3), (2, 5, 10, 13), 0.14), bass_tribal, kit_tribal, 29, second=lambda m, d: i_xylo(m, 0.25))
def st_mangrove(S, act): runner(S, ["Dm", "A#", "Gm", "A"], notes(T_MANGROVE), lambda m, d: i_clarinet(m, d), stabs(lambda m, d: i_pluck(m, 0.3, 4500.0, 500.0, 0.05, 0.25), (2, 6, 10, 14), 0.13), bass_walk, kit_swing, 38, pad=lambda m, d: i_choir(m, d, 0.4))
def st_snow2(S, act): runner(S, ["D", "G", "A", "D"], notes(T_SNOW), i_celesta, stabs(lambda m, d: i_glock(m, 0.3), (2, 6, 10, 14), 0.12), bass_pulse(700.0), kit_sleigh, 38, pad=lambda m, d: i_strings(m, d, 0.3, False, 2800.0), second=lambda m, d: i_bell(m, 0.6))
def st_volcano(S, act): runner(S, ["Cm", "G#", "Fm", "G"], notes(T_VOLCANO), lambda m, d: i_brass(m, d, False, 3400.0), stabs(lambda m, d: i_brass(m, d, True, 2600.0), (0, 6, 12), 0.18), bass_reese, lambda S, b: (kit_rock(S, b, True), S.put("drums", k_taiko(), S.T(b, 12), 0.45, 0, 0.2)), 24, second=lambda m, d: i_marimba(m, 0.4))
def st_boss(S, act): runner(S, ["Em", "C", "Am", "B"], H_BOSS, lambda m, d: i_brass(m, d, False, 3600.0), stabs(lambda m, d: i_strings(m, d, 0.02, True, 3600.0), (0, 2, 4, 6, 8, 10, 12, 14), 0.08), bass_pulse(900.0), lambda S, b: (kit_rock(S, b, True), S.put("drums", k_taiko(), S.T(b, 14), 0.5, 0, 0.2)), 28, second=lambda m, d: i_marimba(m, 0.35))


for key, fn, bpm in (("bamboo", st_bamboo, 120), ("falls", st_falls, 124), ("mushroom", st_mush, 118), ("marsh", st_marsh, 126), ("canopy", st_canopy, 128),
                     ("night", st_night, 116), ("blossom", st_blossom, 124), ("caves", st_caves, 120), ("autumn", st_autumn, 126), ("plains", st_plains, 128),
                     ("mangrove", st_mangrove, 118), ("snow", st_snow2, 128), ("volcano", st_volcano, 136), ("boss", st_boss, 146)):
    style(key, bpm, 16, bpm, 16, 1.3, 1.3, sc=(0.05, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(0.0, 0.0, -1.0))(fn)
ACTION_ONLY = {"river", "chase", "rush", "bamboo", "falls", "mushroom", "marsh", "canopy", "night", "blossom", "caves", "autumn", "plains", "mangrove", "snow", "volcano", "boss"}


def run_music():
    for key, spec in STYLES.items():
        for v, act in (("calm", False), ("action", True)):
            if key in ACTION_ONLY and not act: continue
            if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
            bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
            S = Song(f"kiko_{key}_{v}", bpm, bars, rt, sw)
            spec["fn"](S, act)
            S.render(-16.5 if act else -16.0, sc, None, 0.55, dl, tag=v, bal=bal)


# ---------------------------------------------------------------- SFX
def st2(y): y = np.asarray(y, dtype=np.float64); return np.stack([y, y])


def sweep_tone(f0, f1, d, shape="sin", curve=1.0):
    n = ns(d); t = tt(n); k = (t / d) ** curve
    f = f0 * (f1 / f0) ** k
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if shape == "sin" else np.sign(np.sin(ph)) * 0.6


def kglide(fs, d, vib=0.0, vr=6.0, harm=(1.0,)):
    """a tone that glides through the frequencies fs over d seconds (with vibrato and harmonics)"""
    n = ns(d); t = tt(n)
    f = np.interp(t, np.linspace(0, d, len(fs)), fs) * (1 + vib * np.sin(2 * np.pi * vr * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return sum(a * np.sin(ph * (k + 1)) for k, a in enumerate(harm))


def env(n, a, r):
    t = tt(n); d = n / SR
    return np.minimum(1, t / max(1e-4, a)) * np.exp(-np.maximum(0, t - a) / max(1e-4, r)) * np.clip((d - t) / 0.01, 0, 1)


def put(out, x, at, g=1.0):
    i = ns(at); k = min(len(x), len(out) - i)
    if k > 0: out[i: i + k] += x[:k] * g


def kvoice(fs, d, formants=((700, 1.0), (1200, 0.5)), vib=0.03, breath=0.05):
    """a cartoon 'ooh / aah' voice: a buzzy glide through two formant band-passes"""
    n = ns(d); src = kglide(fs, d, vib, 7.0, (1.0, 0.7, 0.5, 0.35, 0.25, 0.18, 0.12))
    src = src + breath * nz(n)
    y = sum(g * bp(src, f * 0.75, f * 1.3) for f, g in formants)
    return y * env(n, 0.02, d * 0.45)


def sfx():
    if ONLY and "sfx" not in ONLY: return
    S_ = {}
    # the banana-melody marimba (C5; the game pitch-shifts it to play the region's tune)
    n = ns(1.0); y = np.zeros(n)
    put(y, i_marimba(72, 0.4), 0, 0.95); put(y, i_glock(84, 0.3), 0.003, 0.18); put(y, i_kalimba(72, 0.3), 0, 0.25)
    S_["banana"] = y
    # banana pickup: a bright coin 'ba-ding' (B5 → E6) with a little metal shimmer — the same every time, not a tune
    def ctone(f, d, dec):
        m = ns(d); t = tt(m)
        w = np.sin(2 * np.pi * f * t) + 0.32 * np.sin(2 * np.pi * 2 * f * t) + 0.14 * np.sin(2 * np.pi * 3 * f * t)
        w = w + 0.22 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.04)
        return w * env(m, 0.0015, dec)
    n = ns(0.5); y = np.zeros(n)
    put(y, ctone(988, 0.075, 0.05), 0, 0.5)
    put(y, ctone(1319, 0.45, 0.14), 0.06, 0.72)
    put(y, i_glock(100, 0.25), 0.06, 0.1)
    put(y, hp(nz(ns(0.06)), 7000) * env(ns(0.06), 0.001, 0.015), 0.06, 0.06)
    S_["coin"] = y
    # fruit: a juicy bloop + squelch
    d = 0.32; n = ns(d); t = tt(n)
    y = sweep_tone(280, 950, 0.12) * env(ns(0.12), 0.003, 0.05)
    y = np.concatenate([y, np.zeros(n - len(y))]) + bp(nz(n), 1500, 5000) * env(n, 0.002, 0.03) * 0.4 + hp(sweep_filt(nz(n), "low", 3000, 700), 300) * env(n, 0.01, 0.08) * 0.35
    S_["fruit"] = y
    # jump: springy up-whoop
    d = 0.3; n = ns(d); t = tt(n)
    f = 300 * (2.4 ** (t / d)) * (1 + 0.05 * np.sin(2 * np.pi * 26 * t) * np.exp(-t / 0.12))
    S_["jump"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.11) + 0.12 * bp(nz(n), 1500, 6000) * env(n, 0.002, 0.03)
    # land: soft thud on the forest floor
    d = 0.22; n = ns(d); t = tt(n)
    S_["land"] = np.sin(2 * np.pi * np.cumsum(120 * (0.45 ** (t / d))) / SR) * env(n, 0.002, 0.06) + 0.45 * lp(nz(n), 700) * env(n, 0.001, 0.05)
    # swipe: a leafy whoosh
    d = 0.24; n = ns(d)
    S_["swipe"] = hp(sweep_filt(nz(n), "low", 900, 4400, curve=0.7), 350) * np.sin(np.pi * tt(n) / d) ** 1.5 * 0.9
    # slide: a dirt skid
    d = 0.45; n = ns(d)
    S_["slide"] = (lp(nz(n), 1800) * 0.7 + hp(sweep_filt(nz(n), "low", 2600, 600), 250) * 0.5) * env(n, 0.01, 0.2)
    # bounce: the mushroom BOING
    d = 0.7; n = ns(d); t = tt(n)
    f = (170 + 380 * (1 - np.exp(-t / 0.08))) * (1 + 0.16 * np.sin(2 * np.pi * 13 * t) * np.exp(-t / 0.3))
    S_["bounce"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.004, 0.28) * 0.9 + 0.3 * lp(nz(n), 500) * env(n, 0.001, 0.04)
    # vine: a rope creak and a whoosh
    d = 0.7; n = ns(d); t = tt(n); y = np.zeros(n)
    cr = np.sign(np.sin(2 * np.pi * np.cumsum(140 + 60 * np.sin(2 * np.pi * 3 * t) + 25 * nz(n)) / SR))
    put(y, bp(cr, 400, 2200) * env(n, 0.02, 0.18) * 0.5, 0)
    put(y, hp(sweep_filt(nz(n), "low", 700, 3800, curve=0.6), 300) * np.sin(np.pi * t / d) ** 1.2 * 0.8, 0.05)
    S_["vine"] = y
    # heart: a sparkly up-arpeggio
    n = ns(1.2); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_harp(m, 0.6), 0.05 * i, 0.5)
    put(y, i_bell(96, 0.9), 0.25, 0.3)
    S_["heart"] = y
    # max hearts up: a gliss and a big bell chord
    n = ns(1.6); y = np.zeros(n)
    for i, m in enumerate(range(72, 97, 2)): put(y, i_harp(m, 0.5), 0.025 * i, 0.35)
    for m in (84, 88, 91): put(y, i_bell(m, 1.2), 0.35, 0.22)
    S_["maxup"] = y
    # hurt: a bonk and a cartoon "ooh!"
    n = ns(0.9); y = np.zeros(n)
    put(y, np.sin(2 * np.pi * np.cumsum(240 * (0.3 ** (tt(ns(0.22)) / 0.22))) / SR) * env(ns(0.22), 0.001, 0.07), 0, 0.85)
    put(y, kvoice([520, 600, 430], 0.5, ((500, 1.0), (900, 0.4))), 0.08, 0.9)
    S_["hurt"] = y
    # splash: into the river
    n = ns(1.1); t = tt(n); y = bp(nz(n), 300, 4500) * (np.minimum(1, t / 0.01) * np.exp(-t / 0.22)) * 0.9
    for i in range(10):
        at = 0.08 + 0.07 * i + 0.03 * np.sin(i * 7); k = ns(0.06)
        put(y, np.sin(2 * np.pi * np.cumsum(np.linspace(500 + 90 * i, 1300 + 120 * i, k)) / SR) * env(k, 0.002, 0.02), at, 0.25)
    S_["splash"] = y
    # banana flag (checkpoint): a little marimba jingle
    n = ns(1.0); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84)): put(y, i_marimba(m, 0.4), 0.07 * i, 0.55)
    put(y, i_bell(96, 0.6), 0.28, 0.2)
    S_["flag"] = y
    # trick: sparkly up-run
    n = ns(0.8); y = np.zeros(n)
    for i, m in enumerate((84, 88, 91, 96)): put(y, i_glock(m, 0.3), 0.04 * i, 0.72 - i * 0.08)
    S_["trick"] = y
    # a whole banana line collected: a quick coin shower (ding-ding-ding + sparkle), not a tune
    n = ns(0.9); y = np.zeros(n)
    for i, f in enumerate((1319, 1568, 1976)): put(y, ctone(f, 0.35, 0.1), 0.07 * i, 0.5 - i * 0.05)
    put(y, ctone(2637, 0.5, 0.2), 0.21, 0.32)
    put(y, hp(nz(ns(0.5)), 6500) * np.exp(-tt(ns(0.5)) / 0.12) * 0.07, 0.2)
    S_["melody"] = y
    # power-up: riser + chord sparkle
    n = ns(1.0); y = np.zeros(n)
    put(y, mono(fx_riser(0.45, 400.0, 6000.0, 0.25)), 0, 0.6)
    for m in (72, 76, 79, 84): put(y, i_glock(m, 0.5), 0.42, 0.38)
    S_["power"] = y
    # Smoothie Rush: a blender whirr up into a rainbow chord
    n = ns(1.5); t = tt(n); y = np.zeros(n)
    k = ns(0.7); tk = tt(k)
    wh = np.sign(np.sin(2 * np.pi * np.cumsum(80 + 260 * tk / 0.7) / SR)) * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * tk))
    put(y, bp(wh, 300, 2400) * env(k, 0.05, 0.5) * 0.5, 0)
    for i, m in enumerate((72, 76, 79, 84, 88)): put(y, i_glock(m, 0.5), 0.55 + 0.04 * i, 0.4)
    for m in (60, 64, 67): put(y, i_brass(m, 0.5, True, 4200.0), 0.6, 0.25)
    S_["rush"] = y
    # Fruit Salad: a fanfare, then a burp
    n = ns(1.6); y = np.zeros(n)
    for i, m in enumerate((67, 72, 76, 79)): put(y, i_brass(m, 0.25, True, 4000.0), 0.07 * i, 0.3)
    for m in (72, 76, 79, 84): put(y, i_brass(m, 0.5, False, 4000.0), 0.3, 0.25)
    k = ns(0.45); tk = tt(k)
    burp = np.sign(np.sin(2 * np.pi * np.cumsum(95 - 30 * tk / 0.45 + 8 * np.sin(2 * np.pi * 9 * tk)) / SR))
    put(y, lp(burp, 900) * env(k, 0.02, 0.2) * 0.8 + lp(nz(k), 600) * env(k, 0.02, 0.1) * 0.2, 1.0)
    S_["salad"] = y
    # yuck: a raspberry
    d = 0.7; n = ns(d); t = tt(n)
    flap = (np.sin(2 * np.pi * 34 * t) > 0).astype(float)
    S_["yuck"] = (lp(nz(n) * flap, 1400) * 0.9 + lp(np.sign(np.sin(2 * np.pi * np.cumsum(110 + 20 * t) / SR)), 700) * 0.3) * env(n, 0.03, 0.3)
    # slip: a slide whistle up and down
    d = 0.75; n = ns(d)
    S_["slip"] = kglide([600, 1700, 520], d, 0.01, 6.0, (1.0, 0.15)) * env(n, 0.02, 0.4) * 0.6
    # monkey chatter: ooh-ooh-aah-aah
    n = ns(1.1); y = np.zeros(n)
    for i, (fs, fm) in enumerate((([430, 560, 470], ((420, 1.0), (850, 0.4))), ([460, 600, 500], ((420, 1.0), (850, 0.4))), ([620, 820, 640], ((780, 1.0), (1250, 0.5))), ([650, 860, 660], ((780, 1.0), (1250, 0.5))))):
        put(y, kvoice(fs, 0.22, fm), 0.22 * i, 0.8)
    S_["monkey"] = y
    # bird 1: a bright tropical double-chirp with a trill
    n = ns(0.8); y = np.zeros(n)
    for at in (0.0, 0.2):
        put(y, kglide([2400, 4200, 3600], 0.13, 0.04, 40.0) * env(ns(0.13), 0.005, 0.05), at, 0.6)
    put(y, kglide([3400, 3000], 0.25, 0.08, 30.0) * env(ns(0.25), 0.01, 0.1), 0.42, 0.4)
    S_["bird1"] = y
    # bird 2: a whistled "wee-ooo"
    d = 0.7; n = ns(d)
    S_["bird2"] = kglide([1800, 2700, 1500], d, 0.01, 5.0, (1.0, 0.1)) * env(n, 0.04, 0.3) * 0.6
    # bird 3: a night owl "hoo-hoo"
    n = ns(1.2); y = np.zeros(n)
    for at, f in ((0.0, 410), (0.42, 380)):
        k = ns(0.32); put(y, (kglide([f, f * 0.96], 0.32, 0.01) + 0.15 * lp(nz(k), 900)) * env(k, 0.05, 0.12), at, 0.7)
    S_["bird3"] = y
    # croc: a jaw snap
    n = ns(0.45); y = np.zeros(n)
    put(y, bp(nz(ns(0.05)), 1800, 7000) * env(ns(0.05), 0.001, 0.012), 0, 0.9)
    put(y, np.sin(2 * np.pi * np.cumsum(160 * (0.5 ** (tt(ns(0.18)) / 0.18))) / SR) * env(ns(0.18), 0.001, 0.05), 0.005, 0.6)
    S_["croc"] = y
    # coconut: a falling whistle and a bonk
    n = ns(0.85); y = np.zeros(n)
    put(y, kglide([1900, 700], 0.6, 0.0, 1.0, (1.0, 0.1)) * env(ns(0.6), 0.02, 0.4) * 0.35, 0)
    put(y, np.sin(2 * np.pi * np.cumsum(300 * (0.4 ** (tt(ns(0.2)) / 0.2))) / SR) * env(ns(0.2), 0.001, 0.05) + 0.3 * bp(nz(ns(0.2)), 800, 3000) * env(ns(0.2), 0.001, 0.02), 0.6, 0.7)
    S_["coco"] = y
    # countdown beep and GO
    n = ns(0.2); t = tt(n)
    S_["count"] = (i_marimba(84, 0.2)[:n] * 0.9 + np.sin(2 * np.pi * 1047 * t) * env(n, 0.003, 0.06) * 0.3)
    n = ns(0.8); y = np.zeros(n)
    for m in (72, 76, 79, 84): put(y, i_brass(m, 0.35, True, 4000.0), 0, 0.33); put(y, i_marimba(m, 0.4), 0, 0.3)
    S_["go"] = y
    # Golden Banana: a shimmer
    n = ns(1.3); y = np.zeros(n)
    for i, m in enumerate((88, 91, 96, 100, 103)): put(y, i_glock(m, 0.5), 0.05 * i, 0.4)
    put(y, i_bell(96, 1.0), 0.0, 0.3); put(y, hp(nz(n), 7000) * np.exp(-tt(n) / 0.35) * 0.06, 0)
    S_["gold"] = y
    # faint: a slide down, a plop into the banana pile and a few dizzy bells
    n = ns(1.8); y = np.zeros(n)
    put(y, kglide([1200, 260], 0.9, 0.02, 5.0, (1.0, 0.2)) * env(ns(0.9), 0.02, 0.6) * 0.55, 0)
    put(y, np.sin(2 * np.pi * np.cumsum(140 * (0.5 ** (tt(ns(0.3)) / 0.3))) / SR) * env(ns(0.3), 0.001, 0.08) + 0.4 * lp(nz(ns(0.3)), 900) * env(ns(0.3), 0.001, 0.06), 0.9, 0.8)
    for i, m in enumerate((84, 88, 84, 88)): put(y, i_bell(m, 0.4), 1.1 + 0.12 * i, 0.15)
    S_["faint"] = y
    # the Golden Seed won
    n = ns(1.5); y = np.zeros(n)
    for i, m in enumerate((72, 76, 79, 84)): put(y, i_brass(m, 0.3, True, 4200.0), 0.08 * i, 0.32)
    for m in (72, 76, 79, 84): put(y, i_brass(m, 0.7, False, 4200.0), 0.36, 0.3)
    put(y, i_bell(96, 1.0), 0.36, 0.3); put(y, i_marimba(96, 0.5), 0.36, 0.3)
    S_["caught"] = y
    # raft: a wooden knock and a slosh
    n = ns(0.9); y = np.zeros(n)
    for at, f in ((0.0, 230), (0.12, 190)): put(y, i_marimba(int(round(12 * np.log2(f / 440) + 69)), 0.25), at, 0.6)
    put(y, lp(nz(ns(0.6)), 1200) * env(ns(0.6), 0.05, 0.2) * 0.4, 0.2)
    S_["raft"] = y
    # a ride: a happy animal call and a jingle
    n = ns(1.2); y = np.zeros(n)
    put(y, i_brass(60, 0.25, True, 2600.0), 0, 0.4); put(y, i_brass(67, 0.4, True, 2600.0), 0.15, 0.4)
    for i, m in enumerate((79, 84, 88, 91)): put(y, i_glock(m, 0.4), 0.3 + 0.05 * i, 0.35)
    S_["ride"] = y
    # sticky web: a stretchy boing down
    d = 0.6; n = ns(d)
    S_["web"] = kglide([700, 260, 330], d, 0.06, 18.0, (1.0, 0.3)) * env(n, 0.01, 0.25) * 0.6 + lp(nz(n), 1200) * env(n, 0.01, 0.1) * 0.2
    # mud: a squelch
    d = 0.4; n = ns(d); t = tt(n)
    S_["mud"] = lp(nz(n), 900) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t)) * env(n, 0.01, 0.14) * 0.8 + np.sin(2 * np.pi * np.cumsum(140 + 60 * np.sin(2 * np.pi * 9 * t)) / SR) * env(n, 0.01, 0.1) * 0.4
    # wind gust: a long whoosh
    d = 0.9; n = ns(d)
    S_["wind"] = hp(sweep_filt(nz(n), "low", 500, 2600, curve=0.5), 200) * np.sin(np.pi * tt(n) / d) ** 1.3 * 0.8
    # thunder: a crack and a long rumble
    n = ns(2.6); t = tt(n); y = np.zeros(n)
    put(y, hp(nz(ns(0.12)), 800) * env(ns(0.12), 0.001, 0.04), 0, 0.7)
    put(y, lp(nz(n), 220) * np.exp(-t / 0.9) * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * t)), 0.05, 1.0)
    S_["thunder"] = y
    # geyser: a hiss and a spurt
    d = 0.9; n = ns(d); t = tt(n)
    S_["geyser"] = hp(nz(n), 2500) * np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.25) / 0.3) * 0.7 + lp(nz(n), 400) * env(n, 0.02, 0.2) * 0.3
    # zipline: a rising metal whine
    d = 1.2; n = ns(d); t = tt(n)
    S_["zip"] = (kglide([900, 1500, 1300], d, 0.004, 40.0, (1.0, 0.4, 0.2)) * 0.25 + bp(nz(n), 2000, 6000) * 0.25) * env(n, 0.05, 0.6)
    # boss growl (funny)
    n = ns(1.0); y = np.zeros(n)
    put(y, kvoice([180, 150, 120], 0.8, ((450, 1.0), (800, 0.5)), 0.08, 0.25), 0, 1.0)
    S_["roar"] = y
    # boss throw: whoosh + whistle down
    d = 0.7; n = ns(d)
    S_["throw"] = hp(sweep_filt(nz(n), "low", 600, 3000, curve=0.7), 300) * np.sin(np.pi * tt(n) / d) * 0.5 + kglide([1600, 900], d, 0, 1.0, (1.0,)) * env(n, 0.02, 0.3) * 0.25
    # elephant / dino stomp
    d = 0.4; n = ns(d); t = tt(n)
    S_["stomp"] = np.sin(2 * np.pi * np.cumsum(80 * (0.5 ** (t / d))) / SR) * env(n, 0.002, 0.12) + lp(nz(n), 300) * env(n, 0.001, 0.06) * 0.5
    # ice: a crisp crack
    n = ns(0.5); y = np.zeros(n)
    put(y, bp(nz(ns(0.05)), 3000, 9000) * env(ns(0.05), 0.001, 0.01), 0, 0.8)
    put(y, i_bell(96, 0.4), 0.01, 0.2)
    S_["ice"] = y
    # lava: a sizzle
    d = 0.8; n = ns(d)
    S_["lava"] = hp(nz(n), 3000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 40 * tt(n)))) * env(n, 0.01, 0.3) * 0.5
    for k_, y in S_.items():
        write_wav(f"sfx_kiko_{k_}", st2(fade(np.asarray(y, dtype=np.float64), 0.0005, 0.02)), peak=0.85)
        print("sfx", k_, flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    sfx()
    run_music()
    mf = os.path.join(OUT, "manifest_kiko.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
