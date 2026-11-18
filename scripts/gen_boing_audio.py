"""Momo Boing! sound pack: a music bed per sky world (calm = menus with the tune, action = the climb, which leaves room
for the bounce melody) and the one-shot note voices that the bounces play (pitch-shifted in the browser).

usage: python scripts/gen_boing_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = garden, candy, snow (or e.g. garden_calm), notes. Files: music_boing_<world>_<calm|action>, sfx_boing_<voice>.

Keys match src/boing/levels.ts tunes: Garden C major, Candy F major, Snow D major. Reuses the studio of
gen_brigade_audio.py (which reuses gen_racing_audio.py).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen_brigade_audio.py"), encoding="utf-8").read()
exec(_src[: _src.index("def run_music")])
STYLES.clear()  # noqa: F821  (defined by the exec above)


def mixpad(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[: len(x)] += x
    return out


# ---------------------------------------------------------------- bounce voices
@lru_cache(maxsize=None)
def i_marimba(m, d=0.4):
    f = midi(m); n = ns(1.0); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.42) + 0.28 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.07)
    y += 0.08 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t / 0.018) + bp(nz(n), 900, 4200) * np.exp(-t / 0.004) * 0.18
    y += 0.25 * np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t / 0.2)
    return fade(y * 0.5, 0.0006, 0.06)


@lru_cache(maxsize=None)
def i_musicbox(m, d=0.6):
    f = midi(m); n = ns(1.5); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.9) + 0.42 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.3)
    y += 0.22 * np.sin(2 * np.pi * f * 5.04 * t) * np.exp(-t / 0.07) + hp(nz(n), 5200) * np.exp(-t / 0.002) * 0.22
    return fade(y * 0.42, 0.0004, 0.09)


@lru_cache(maxsize=None)
def i_snowbell(m, d=0.6):
    return mixpad(i_glock(m, 0.5) * 1.1, np.concatenate([np.zeros(ns(0.01)), k_tamb() * 0.16]))


@lru_cache(maxsize=None)
def i_toypiano(m, d=0.4):
    f = midi(m); n = ns(0.9); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35) + 0.5 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / 0.12) + 0.22 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-t / 0.05)
    y += bp(nz(n), 2000, 8000) * np.exp(-t / 0.003) * 0.25
    return fade(y * 0.42, 0.0004, 0.06)


@lru_cache(maxsize=None)
def i_kalimba(m, d=0.5):
    f = midi(m); n = ns(1.1); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55) + 0.3 * np.sin(2 * np.pi * f * 5.9 * t) * np.exp(-t / 0.04) + 0.12 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.2)
    y += bp(nz(n), 600, 3000) * np.exp(-t / 0.006) * 0.15
    return fade(y * 0.5, 0.0005, 0.08)


@lru_cache(maxsize=None)
def i_celesta(m, d=0.5):
    return mixpad(i_musicbox(m, 0.5) * 0.7, i_bell(m + 12, 0.8) * 0.35)


@lru_cache(maxsize=None)
def i_synthpluck(m, d=0.4):
    return i_pluck(m, 0.35, 6500.0, 900.0, 0.12, 0.45) * 0.9


@lru_cache(maxsize=None)
def i_horn(m, d=0.3):
    return i_brass(m, 0.28, True, 2600.0) * 1.2


def mono(x):
    x = np.asarray(x)
    return x.mean(axis=0) if x.ndim == 2 else x


VOICES = {"marimba": i_marimba, "musicbox": i_musicbox, "bells": i_snowbell, "toypiano": i_toypiano, "steel": lambda m, d=0.4: i_steel(m, 0.4),
          "celesta": i_celesta, "kalimba": i_kalimba, "xylo": lambda m, d=0.25: i_xylo(m, 0.25), "synth": i_synthpluck, "horn": i_horn}


def kit_soft(S, bar, act, B, hat=2, g=1.0):
    S.kick(k_kick(120, 50, 0.025, 0.22, 0.2, 1.4, 0.4), bar, 0, 0.7 * g)
    S.kick(k_kick(120, 50, 0.025, 0.22, 0.2, 1.4, 0.4), bar, 8, 0.55 * g)
    for s in (4, 12): S.put("drums", k_clap(0.3, 0.09), S.T(bar, s), 0.4 * g, 0.1, 0.18)
    if hat:
        for s in range(0, 16, hat): S.put("drums", k_shaker(), S.T(bar, s), (0.24 if s % 4 == 2 else 0.14) * g, -0.35)
    if act and B and bar % 4 == 3: S.put("drums", k_tamb(), S.T(bar, 14), 0.25, 0.4)


def bed(S, act, prog, tune, voice, chord, bass, lo, drums, arp=None, pad=None):
    """the climb leaves the melody to the bounces: groove, chords, bass and a sparse counter line; menus get the tune"""
    bars = prog * 2 if act else prog
    for bar, c in enumerate(bars):
        r = root(c, lo); ch = vc(c, 60); B = act and bar >= len(prog)
        if act and bar % 8 == 0: crash_at(S, bar, 0.22)
        drums(S, bar, act, B)
        S.put("bass", bass(r, S.st * 3), S.T(bar, 0), 0.8 if act else 0.55)
        S.put("bass", bass(r + 7 if r + 7 <= lo + 12 else r - 5, S.st * 2), S.T(bar, 10 if act else 8), 0.6 if act else 0.45)
        for s in ((2, 6, 10, 14) if act else (4, 12)):
            for m in ch: S.put("music", chord(m, S.st * 1.4), S.T(bar, s), 0.16 if act else 0.14, 0.2, 0.22)
        if pad:
            for m in ch: S.put("music", pad(m, S.st * 15), S.T(bar, 0), 0.07 if act else 0.1, -0.2, 0.35)
        if arp and (B or not act):
            for k, s in enumerate(range(0, 16, 4)): S.put("music", arp(ch[k % 3] + 12, 0.3), S.T(bar, s + 2), 0.1, 0.4, 0.3)
    if not act:
        notes = [(i * 4, m, 3) for i, m in enumerate(tune)]
        S.seq("music", voice, notes, 0, 0.5, 0.1, 0.3)
    else:
        riser_into_loop(S, 1, 0.16)


T_GARDEN = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 81, 79, 76, 74, 76, 79, 81, 84, 86, 84, 81, 79, 81, 79, 76, 74, 72, 74, 76, 74, 72]
T_CANDY = [84, 81, 77, 81, 84, 86, 84, 81, 79, 81, 82, 81, 79, 77, 79, 81, 77, 79, 81, 84, 86, 89, 86, 84, 81, 79, 77, 79, 81, 79, 77, 72]
T_SNOW = [74, 78, 81, 86, 81, 78, 76, 78, 81, 83, 81, 78, 76, 74, 76, 78, 81, 83, 86, 88, 86, 83, 81, 78, 81, 83, 81, 78, 76, 78, 76, 74]


def st_garden(S, act):
    bed(S, act, ["C", "G", "Am", "F", "C", "G", "F", "C"], T_GARDEN, i_marimba, lambda m, d: i_pluck(m, d, 5200.0, 600.0, 0.07, 0.25),
        i_tuba, 33, kit_soft, arp=i_glock, pad=lambda m, d: i_strings(m, d, 0.3, False, 2600.0))


def st_candy(S, act):
    def drums(S, bar, act, B):
        kit_soft(S, bar, act, B, hat=2)
        if act: S.put("drums", k_rim(), S.T(bar, 7), 0.25, 0.3)
    bed(S, act, ["F", "Dm", "A#", "C", "F", "Dm", "A#", "C"], T_CANDY, i_musicbox, lambda m, d: i_glock(m, 0.3),
        i_tuba, 29, drums, arp=i_musicbox, pad=lambda m, d: i_strings(m, d, 0.35, False, 2400.0))


def st_snow(S, act):
    def drums(S, bar, act, B):
        kit_soft(S, bar, act, B, hat=0, g=0.9)
        for s in range(0, 16, 2): S.put("drums", k_tamb(), S.T(bar, s), 0.26 if s % 4 == 0 else 0.16, 0.35, 0.1)
    bed(S, act, ["D", "Bm", "G", "A", "D", "Bm", "G", "A"], T_SNOW, i_snowbell, lambda m, d: i_strings(m, d, 0.04, True, 3200.0),
        i_tuba, 38, drums, arp=i_bell, pad=lambda m, d: i_choir(m, d, 0.4))


T_TOY = [79, 83, 86, 83, 79, 81, 83, 86, 88, 86, 83, 81, 79, 81, 83, 79, 86, 88, 90, 91, 90, 88, 86, 83, 84, 86, 83, 81, 79, 81, 78, 79]
T_BEACH = [81, 85, 88, 85, 81, 83, 85, 88, 90, 88, 85, 83, 81, 83, 85, 81, 88, 90, 93, 90, 88, 85, 83, 85, 88, 85, 83, 81, 83, 85, 83, 81]
T_SPOOKY = [74, 77, 81, 77, 74, 76, 77, 81, 82, 81, 77, 76, 74, 76, 77, 74, 81, 82, 86, 82, 81, 77, 76, 77, 81, 77, 76, 73, 74, 76, 73, 74]
T_JUNGLE = [76, 79, 81, 83, 81, 79, 76, 74, 76, 79, 83, 86, 83, 81, 79, 81, 83, 86, 88, 86, 83, 81, 79, 81, 83, 81, 79, 76, 74, 76, 74, 76]
T_LAVA = [72, 75, 79, 75, 72, 74, 75, 79, 80, 79, 75, 74, 72, 74, 75, 72, 79, 80, 84, 80, 79, 75, 74, 75, 79, 75, 74, 71, 72, 74, 71, 72]
T_SPACE = [81, 84, 88, 84, 81, 83, 84, 88, 91, 88, 84, 83, 81, 83, 84, 81, 88, 91, 93, 91, 88, 84, 83, 84, 88, 84, 83, 79, 81, 83, 79, 81]
T_CASTLE = [75, 79, 82, 79, 75, 77, 79, 82, 84, 82, 79, 77, 75, 77, 79, 75, 82, 84, 87, 84, 82, 79, 77, 79, 82, 79, 77, 75, 77, 79, 77, 75]


def st_toy(S, act):
    def drums(S, bar, act, B):
        for s in (0, 8): S.kick(k_chip_kick(), bar, s, 0.7 if act else 0.45)
        for s in (4, 12): S.put("drums", k_clap(0.25, 0.08), S.T(bar, s), 0.35, 0.1, 0.15)
        for s in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, s), 0.16, -0.35)
    bed(S, act, ["G", "D", "Em", "C", "G", "D", "C", "D"], T_TOY, i_toypiano, lambda m, d: i_glock(m, 0.25), i_chip_tri, 31, drums, arp=i_toypiano)


def st_beach(S, act):
    def drums(S, bar, act, B):
        kit_soft(S, bar, act, B, hat=2)
        for s in (3, 7, 11, 14): S.put("drums", k_tom(220.0, 0.3, 0.1), S.T(bar, s), 0.22 if act else 0.14, 0.3, 0.1)
    bed(S, act, ["A", "F#m", "D", "E", "A", "F#m", "D", "E"], T_BEACH, lambda m, d: i_steel(m, 0.4), lambda m, d: i_steel(m, 0.3), i_tuba, 33, drums,
        arp=lambda m, d: i_steel(m, 0.3), pad=lambda m, d: i_strings(m, d, 0.3, False, 2400.0))


def st_spooky2(S, act):
    def drums(S, bar, act, B):
        S.kick(k_kick(90, 42, 0.03, 0.3, 0.15, 1.2, 0.5), bar, 0, 0.6 if act else 0.4)
        if act: S.kick(k_kick(90, 42, 0.03, 0.3, 0.15, 1.2, 0.5), bar, 10, 0.45)
        for s in (4, 12): S.put("drums", k_rim(), S.T(bar, s), 0.3, 0.2, 0.3)
        for s in range(0, 16, 4): S.put("drums", k_shaker(), S.T(bar, s + 2), 0.12, -0.4)
    bed(S, act, ["Dm", "A#", "C", "Dm", "Dm", "Gm", "A", "Dm"], T_SPOOKY, i_celesta, lambda m, d: i_bell(m, 0.6), i_tuba, 38, drums,
        arp=i_celesta, pad=lambda m, d: i_choir(m, d, 0.5))


def st_jungle2(S, act):
    def drums(S, bar, act, B):
        S.kick(k_kick(110, 48, 0.03, 0.25, 0.2, 1.3, 0.45), bar, 0, 0.7 if act else 0.45)
        for s in (3, 6, 10, 13): S.put("drums", k_tom(160.0 if s % 2 else 120.0, 0.35, 0.12), S.T(bar, s), 0.3 if act else 0.18, 0.2 * (1 if s % 2 else -1), 0.12)
        for s in range(0, 16, 2): S.put("drums", k_shaker(), S.T(bar, s), 0.18 if s % 4 == 0 else 0.11, -0.3)
    bed(S, act, ["Em", "C", "D", "Em", "Em", "D", "C", "B"], T_JUNGLE, i_kalimba, lambda m, d: i_pluck(m, d, 4200.0, 500.0, 0.06, 0.2), i_tuba, 28, drums, arp=i_kalimba)


LAVA_PROG = ["Cm", "G#", "A#", "Cm", "Cm", "Fm", "G", "Cm"]


def st_lava(S, act):
    def drums(S, bar, act, B):
        S.put("drums", k_timp(root(LAVA_PROG[bar % 8], 36)), S.T(bar, 0), 0.6 if act else 0.4, 0, 0.3)
        if act:
            for s in (4, 12): S.put("drums", k_msnare(), S.T(bar, s), 0.45, 0.1, 0.15)
            S.kick(k_bass_drum(), bar, 8, 0.6)
    bed(S, act, LAVA_PROG, T_LAVA, lambda m, d: i_xylo(m, 0.25), lambda m, d: i_brass(m, d, True, 2000.0), i_tuba, 36, drums,
        pad=lambda m, d: i_strings(m, d, 0.2, False, 2200.0))


def st_space(S, act):
    def drums(S, bar, act, B):
        S.kick(k_kick(130, 45, 0.025, 0.3, 0.3, 1.6, 0.5), bar, 0, 0.65 if act else 0.4)
        if act: S.kick(k_kick(130, 45, 0.025, 0.3, 0.3, 1.6, 0.5), bar, 8, 0.5)
        for s in (4, 12): S.put("drums", k_clap(0.35, 0.1), S.T(bar, s), 0.3, 0.1, 0.3)
        for s in range(0, 16, 2): S.put("drums", k_hat(False, 0.025), S.T(bar, s), 0.12, -0.3)
    bed(S, act, ["Am", "F", "C", "G", "Am", "F", "G", "E"], T_SPACE, i_synthpluck, lambda m, d: mono(i_chip(m, d, 0.25)), i_sub, 33, drums,
        arp=i_synthpluck, pad=lambda m, d: mono(i_ssaw(m, d, 2200.0, 0.3, 0.6, 0.012, 5)) * 0.4)


CASTLE_PROG = ["D#", "A#", "Cm", "G#", "D#", "A#", "G#", "A#"]


def st_castle(S, act):
    def drums(S, bar, act, B):
        S.put("drums", k_timp(root(CASTLE_PROG[bar % 8], 38)), S.T(bar, 0), 0.6 if act else 0.4, 0, 0.3)
        if act:
            for s in (4, 12): S.put("drums", k_msnare(), S.T(bar, s), 0.4, 0.1, 0.15)
            for s in range(0, 16, 2): S.put("drums", k_msnare(), S.T(bar, s), 0.12, 0.1, 0.1)
    bed(S, act, CASTLE_PROG, T_CASTLE, i_horn, lambda m, d: i_strings(m, d, 0.05, True, 3000.0), i_tuba, 39, drums,
        arp=lambda m, d: i_harp(m, 0.6), pad=lambda m, d: i_choir(m, d, 0.4))


style("garden", 116, 16, 104, 8, 1.2, 1.6, bal_a=(-2.0, 0.5, -2.5), bal_c=(-5.0, 0.5, -3.0))(st_garden)
style("toy", 128, 16, 112, 8, 0.8, 1.1, bal_a=(-2.0, 0.5, -2.5), bal_c=(-5.0, 0.5, -3.0))(st_toy)
style("beach", 112, 16, 100, 8, 1.1, 1.4, sw=(0.12, 0.12), bal_a=(-2.0, 0.5, -2.5), bal_c=(-5.0, 0.5, -3.0))(st_beach)
style("spooky", 100, 16, 92, 8, 1.8, 2.2, sw=(0.3, 0.3), bal_a=(-3.0, 0.5, -2.5), bal_c=(-5.5, 0.5, -3.0))(st_spooky2)
style("jungle", 112, 16, 100, 8, 1.1, 1.4, bal_a=(-1.5, 0.5, -2.5), bal_c=(-4.5, 0.5, -3.0))(st_jungle2)
style("lava", 120, 16, 104, 8, 1.4, 1.8, bal_a=(-2.0, 0.5, -2.0), bal_c=(-5.0, 0.5, -3.0))(st_lava)
style("space", 118, 16, 100, 8, 2.0, 2.4, bal_a=(-2.0, 0.5, -2.0), bal_c=(-5.0, 0.5, -3.0))(st_space)
style("castle", 120, 16, 104, 8, 1.8, 2.2, bal_a=(-2.5, 0.5, -2.5), bal_c=(-5.5, 0.5, -3.0))(st_castle)
style("candy", 120, 16, 108, 8, 1.1, 1.5, bal_a=(-2.0, 0.5, -2.5), bal_c=(-5.0, 0.5, -3.0))(st_candy)
style("snow", 108, 16, 96, 8, 1.6, 2.0, bal_a=(-2.5, 0.5, -2.5), bal_c=(-5.5, 0.5, -3.0))(st_snow)


def run_music():
    for key, spec in STYLES.items():
        for v, act in (("calm", False), ("action", True)):
            if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
            bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
            S = Song(f"boing_{key}_{v}", bpm, bars, rt, sw)
            spec["fn"](S, act)
            S.render(-16.5 if act else -16.0, sc, None, 0.55, dl, tag=v, bal=bal)


def run_notes():
    if ONLY and "notes" not in ONLY: return
    for name, fn in VOICES.items():
        y = mono(fn(72, 0.5))
        write_wav(f"sfx_boing_{name}", np.stack([y, y]), peak=0.85)
        print("sfx", name, flush=True)
    # the Perfect Boing sparkle: a quick glock run with a shimmer
    n = ns(1.2); out = np.zeros(n)
    for i, m in enumerate((84, 88, 91, 96)):
        x = i_glock(m, 0.3); o = ns(0.035 * i); k = min(len(x), n - o); out[o: o + k] += x[:k] * (0.8 - i * 0.1)
    t = tt(n); out += hp(nz(n), 7000) * np.exp(-t / 0.18) * 0.06
    write_wav("sfx_boing_perfect", np.stack([out, out]), peak=0.8)
    print("sfx perfect", flush=True)


if __name__ == "__main__":
    import time
    t0 = time.time()
    run_notes()
    run_music()
    mf = os.path.join(OUT, "manifest_boing.json")
    with open(mf, "w") as fh: json.dump(META, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
