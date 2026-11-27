"""Obby Bike Blaster sound effects, synthesised from scratch (numpy + scipy; no samples, all original): the freewheel
ticking and the tyre roll, hops and landings, the bike bell, jelly boings and boost whooshes, coins, gems, oil, hearts,
power-ups, the shield and wings, checkpoint and sector chimes, the finish fanfare with fireworks, the level-start
sting, crashes, falls and respawns, a dry squeaky chain, the handlebar blaster, targets, bridges folding out, crates,
gremlins, laser gates and whooshes, menu sounds, and the worlds' ambience (birds, wind, a city, owls, crickets, lava,
bubbles, gulls, gears, chimes, frogs, beeps, glitches, thunder, crows, the hum of space). The music is composed live
in the game (src/pedal/music.ts).

usage: python scripts/gen_pedal_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_pedal_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
RNG = np.random.default_rng(20261127)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "public", "audio", "arcade")


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe: return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


# ---------------------------------------------------------------- building blocks
def n_(d): return max(1, int(round(d * SR)))
def tt(d): return np.arange(n_(d)) / SR
def noise(d): return RNG.standard_normal(n_(d))
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


def env(d, a=0.005, dec=0.2, curve=1.0):
    t = tt(d)
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(dec, 1e-4)) ** curve
    return e


def adsr(d, a, dcy, s, r):
    n = n_(d); t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(dcy, 1e-4)))
    rel = np.clip((d - t) / max(r, 1e-4), 0, 1)
    return e * rel


def sweep(f0, f1, d, kind="sine", curve="exp"):
    t = tt(d)
    if curve == "exp": f = f0 * (f1 / f0) ** (t / d)
    else: f = f0 + (f1 - f0) * (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == "saw": return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == "square": return np.sign(np.sin(ph))
    if kind == "tri": return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    return np.sin(ph)


def tone(f, d, kind="sine", harm=None):
    t = tt(d)
    if harm:
        return sum(a * np.sin(2 * np.pi * f * k * t) for k, a in harm)
    return sweep(f, f, d, kind, "lin")


def filt(y, kind, f, order=2):
    if kind == "bp":
        lo, hi = f
        sos = butter(order, [max(20, lo), min(SR / 2 - 100, hi)], btype="band", fs=SR, output="sos")
    else:
        sos = butter(order, min(SR / 2 - 100, max(20, f)), btype="low" if kind == "lp" else "high", fs=SR, output="sos")
    return sosfilt(sos, y)


def bell(f, d, bright=1.0):
    """inharmonic bell partials, each with its own decay"""
    t = tt(d)
    parts = [(1, 1, d * 0.6), (2.76, 0.5 * bright, d * 0.25), (5.4, 0.3 * bright, d * 0.12), (8.9, 0.15 * bright, d * 0.06)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec) for r, a, dec in parts)


def chime(m, d=0.6, g=1.0): return bell(mtof(m), d) * g * np.minimum(1, tt(d) / 0.002)


def pluck(m, d=0.4, bright=4000):
    f = mtof(m); t = tt(d)
    y = sum((0.6 ** k) * np.sin(2 * np.pi * f * (k + 1) * t) for k in range(6)) * np.exp(-t / (d * 0.3))
    return filt(y, "lp", bright)


def brass(m, d, bright=2500):
    f = mtof(m)
    y = sweep(f * 0.995, f, d, "saw", "lin") * 0.6 + sweep(f * 1.004, f * 1.004, d, "saw", "lin") * 0.4
    return filt(y, "lp", bright) * adsr(d, 0.03, 0.2, 0.7, 0.12)


def thud(f0=110, f1=40, d=0.3, g=1.0):
    return sweep(f0, f1, d) * env(d, 0.002, d * 0.35) * g


def place(y, x, at, g=1.0):
    o = int(at * SR)
    if o >= len(y): return y
    k = min(len(x), len(y) - o)
    y[o:o + k] += x[:k] * g
    return y


def blank(d): return np.zeros(n_(d))


def verb(y, size=0.6, wet=0.25):
    ir_d = size
    ir = noise(ir_d) * np.exp(-tt(ir_d) / (size * 0.28))
    ir = filt(ir, "lp", 6000)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = fftconvolve(y, ir)[: len(y) + n_(ir_d)]
    dry = np.concatenate([y, np.zeros(len(w) - len(y))])
    return dry * (1 - wet) + w * wet


def finish(y, peak=0.9, fade=0.01):
    y = np.asarray(y, dtype=np.float64)
    nf = n_(fade)
    if len(y) > nf: y[-nf:] *= np.linspace(1, 0, nf)
    y[: n_(0.0005)] *= np.linspace(0, 1, n_(0.0005))
    m = np.max(np.abs(y)) + 1e-9
    return y / m * peak


def write(name, y, peak=0.9):
    y = finish(y, peak)
    pcm = (y * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(tempfile.gettempdir(), f"pedal_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_pedal_{name}.mp3")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", dst], check=True)
    os.remove(tmp)
    print("sfx", name, round(len(y) / SR, 2), "s", flush=True)



def crunch(d, lo, hi, dec, g=1.0, grains=0):
    """a burst of filtered noise with little cracks in it (breaking things)"""
    y = filt(noise(d), "bp", (lo, hi)) * env(d, 0.001, dec) * g
    for i in range(grains):
        place(y, filt(noise(0.02), "bp", (lo * 1.5, min(hi * 2, 15000))) * env(0.02, 0.0005, 0.006) * g * 0.6, RNG.random() * d * 0.7)
    return y


def zap(f0, f1, d, kind="square", lp=5000):
    return filt(sweep(f0, f1, d, kind), "lp", lp) * env(d, 0.001, d * 0.35)

# ---------------------------------------------------------------- the effects
S = {}

# the ride: a freewheel click and a short burst of tyre roll (both played over and over by the game)
y = blank(0.05); place(y, filt(noise(0.006), "bp", (3000, 9000)) * env(0.006, 0.0005, 0.002), 0, 0.8); place(y, tone(2600, 0.01, "square") * env(0.01, 0.0005, 0.003) * 0.2, 0)
S["tick"] = y
d = 0.36; t = tt(d)
S["roll"] = filt(noise(d), "bp", (120, 1400)) * np.sin(np.pi * t / d) ** 2 * 0.7 + filt(noise(d), "bp", (2000, 5000)) * np.sin(np.pi * t / d) ** 2 * 0.06
# hops and landings
y = blank(0.2); place(y, sweep(240, 680, 0.14, "tri") * env(0.14, 0.004, 0.06), 0, 0.6); place(y, filt(noise(0.08), "bp", (500, 2500)) * env(0.08, 0.002, 0.03), 0, 0.25)
S["jump"] = y
y = blank(0.3); place(y, thud(150, 60, 0.14), 0, 0.8); place(y, crunch(0.08, 300, 1800, 0.025, 0.4), 0)
for i in range(2): place(y, bell(1800 + i * 600, 0.05, 2.0) * 0.1, 0.01 + i * 0.02)
S["land"] = y
y = blank(0.6); place(y, thud(110, 40, 0.3, 1.2), 0); place(y, crunch(0.2, 200, 2500, 0.06, 0.8, 4), 0)
for i in range(4): place(y, bell(900 + i * 330, 0.12, 2.0) * 0.15, 0.02 + i * 0.04)
S["landHard"] = y
# the bike bell (menus and the start)
y = blank(1.0)
for at in (0, 0.16): place(y, bell(2350, 0.7, 1.4) * 0.6 + bell(3020, 0.7, 1.2) * 0.3, at)
S["bell"] = verb(y, 0.5, 0.2)
# jelly bounce, boost strip
y = blank(0.7); d = 0.5; t = tt(d)
place(y, np.sin(2 * np.pi * np.cumsum(180 + 520 * (t / d) + 60 * np.sin(2 * np.pi * 14 * t)) / SR) * env(d, 0.005, 0.2) * 0.7, 0)
place(y, thud(220, 90, 0.1), 0, 0.5)
S["bounce"] = verb(y, 0.5, 0.2)
d = 0.9; t = tt(d)
y = filt(noise(d), "bp", (400, 3500)) * np.minimum(1, t / 0.05) * np.exp(-t / 0.35) * 0.6 + sweep(300, 1400, d, "saw") * env(d, 0.01, 0.3) * 0.18
S["boost"] = filt(y, "lp", 6000)
# pickups
y = blank(0.4); place(y, chime(93, 0.25), 0, 0.55); place(y, chime(100, 0.35), 0.055, 0.65)
S["coin"] = y
y = blank(1.0)
for i, m in enumerate((88, 95, 100, 104, 107)): place(y, bell(mtof(m), 0.6, 1.4), i * 0.05, 0.4)
S["gem"] = verb(y, 0.8, 0.3)
y = blank(0.8)
for i in range(3): place(y, sweep(160 + i * 50, (160 + i * 50) * 2, 0.07) * env(0.07, 0.002, 0.03), 0.02 + i * 0.08, 0.5)
place(y, zap(500, 1500, 0.3, "tri", 4000), 0.3, 0.4)
S["oil"] = y
y = blank(0.9); place(y, thud(90, 50, 0.18), 0, 0.6); place(y, thud(80, 45, 0.18), 0.17, 0.45)
for m in (76, 80, 83, 88): place(y, pluck(m, 0.7, 3500), 0.12, 0.3)
S["heart"] = verb(y, 0.5, 0.2)
y = blank(0.9); place(y, filt(sweep(250, 1600, 0.4, "square"), "lp", 3500) * env(0.4, 0.01, 0.18) * 0.35, 0)
for i, m in enumerate((84, 88, 91, 96, 100)): place(y, chime(m, 0.4), 0.15 + i * 0.045, 0.28)
S["power"] = verb(y, 0.5, 0.25)
d = 0.9; t = tt(d)
S["shield"] = verb(sum(np.sin(2 * np.pi * (f + 7 * np.sin(2 * np.pi * 7 * t)) * t) for f in (620, 930, 1240)) * adsr(d, 0.04, 0.3, 0.4, 0.3) * 0.3, 0.7, 0.35)
y = blank(0.5); place(y, crunch(0.05, 3000, 9000, 0.015, 0.7), 0); place(y, sweep(2000, 500, 0.25) * env(0.25, 0.002, 0.09), 0.01, 0.4)
S["shieldPop"] = verb(y, 0.4, 0.2)
y = blank(0.6)
for i in range(3): place(y, filt(noise(0.09), "bp", (500, 3000)) * env(0.09, 0.01, 0.04), i * 0.1, 0.5)
place(y, chime(96, 0.4), 0.05, 0.3)
S["wings"] = verb(y, 0.6, 0.3)
# checkpoints, sectors, the finish
y = blank(1.0); place(y, filt(noise(0.3), "bp", (800, 4000)) * env(0.3, 0.05, 0.08) * 0.3, 0)
place(y, chime(91, 0.6), 0.06, 0.6); place(y, chime(96, 0.7), 0.18, 0.6)
S["checkpoint"] = verb(y, 0.6, 0.25)
y = blank(1.4)
for i, m in enumerate((79, 84, 88, 91)): place(y, brass(m, 0.5 if i == 3 else 0.18, 3200), i * 0.12, 0.45)
for m in (96, 100): place(y, chime(m, 0.9), 0.4, 0.25)
S["sector"] = verb(y, 0.8, 0.25)
y = blank(2.8)
for i, (m, at, dd) in enumerate(((67, 0, 0.16), (72, 0.16, 0.16), (76, 0.32, 0.16), (79, 0.48, 0.16), (84, 0.64, 1.1))):
    place(y, brass(m, dd + 0.1, 3400), at, 0.45); place(y, filt(tone(mtof(m + 12), dd, "square"), "lp", 4000) * env(dd, 0.003, dd * 0.5) * 0.15, at)
for m in (88, 91, 96, 100): place(y, chime(m, 1.4), 0.66, 0.16)
place(y, filt(noise(1.6), "hp", 5000) * adsr(1.6, 0.4, 0.5, 0.4, 0.6) * 0.22, 0.5)
for i in range(5): place(y, crunch(0.15, 600, 6000, 0.05, 0.25), 1.0 + i * 0.28)
S["finish"] = verb(y, 1.0, 0.3)
y = blank(3.6)
for at, ms in ((0, (60, 64, 67)), (0.3, (62, 65, 69)), (0.6, (64, 67, 72)), (0.9, (67, 72, 76))):
    for m in ms: place(y, brass(m, 0.9 if at == 0.9 else 0.32, 3000), at, 0.3)
for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100)): place(y, chime(m, 0.9), 1.0 + i * 0.07, 0.22)
place(y, filt(noise(2.0), "hp", 5000) * adsr(2.0, 0.6, 0.6, 0.4, 0.8) * 0.22, 0.8)
S["worldClear"] = verb(y, 1.2, 0.3)
y = blank(1.6)
place(y, filt(noise(1.1), "bp", (300, 3000)) * adsr(1.1, 0.5, 0.2, 0.6, 0.3) * 0.5, 0)
for i, m in enumerate((72, 79, 84, 91)): place(y, chime(m, 0.8), 0.7 + i * 0.08, 0.3)
place(y, bell(2350, 0.6, 1.4) * 0.3, 0.7)
S["levelStart"] = verb(y, 0.9, 0.3)
y = blank(1.0); place(y, brass(79, 0.45, 3500), 0, 0.7); place(y, brass(67, 0.45, 3500), 0, 0.5); place(y, thud(150, 50, 0.2), 0, 0.7)
S["go"] = verb(y, 0.6, 0.2)
# crashes and falls
y = blank(1.2); place(y, crunch(0.4, 200, 4000, 0.1, 1.0, 8), 0); place(y, thud(110, 35, 0.4), 0, 0.9)
for i, f in enumerate((420, 640, 910, 1270)): place(y, bell(f, 0.4, 2.2) * 0.2, 0.01 + i * 0.03)
for i in range(5): place(y, crunch(0.04, 1500, 6000, 0.012, 0.3), 0.3 + i * 0.1)
S["crash"] = verb(y, 0.6, 0.2)
d = 1.2; t = tt(d)
S["fall"] = verb(filt(sweep(1400, 200, d, "tri"), "lp", 3000) * env(d, 0.01, 0.6) * 0.45 + filt(noise(d), "bp", (300, 1500)) * adsr(d, 0.3, 0.3, 0.6, 0.3) * 0.25, 0.8, 0.3)
y = blank(0.9)
for i, m in enumerate((84, 88, 91, 96)): place(y, chime(m, 0.5), i * 0.05, 0.35)
place(y, sweep(400, 1600, 0.3, "tri") * env(0.3, 0.01, 0.1) * 0.3, 0)
S["respawn"] = verb(y, 0.6, 0.3)
y = blank(0.4); place(y, thud(160, 60, 0.15), 0, 0.8); place(y, crunch(0.1, 300, 2500, 0.03, 0.6), 0); place(y, bell(700, 0.2, 2.0) * 0.2, 0)
S["wall"] = y
d = 0.5; t = tt(d)
S["squeak"] = filt(np.sin(2 * np.pi * np.cumsum(1900 + 400 * np.sin(2 * np.pi * 11 * t)) / SR), "bp", (1200, 4000)) * adsr(d, 0.05, 0.2, 0.5, 0.15) * 0.4
y = blank(0.6)
for i, f in enumerate((990, 740, 990)): place(y, filt(tone(f, 0.12, "square"), "lp", 2500) * adsr(0.12, 0.005, 0.05, 0.6, 0.03), i * 0.16, 0.45)
S["lowOil"] = y
y = blank(1.3)
for i, m in enumerate((72, 69, 64)): place(y, filt(sweep(mtof(m), mtof(m) * 0.97, 0.4, "saw"), "lp", 1500) * adsr(0.4, 0.02, 0.15, 0.5, 0.1) * 0.4, i * 0.25)
S["lifeLost"] = verb(y, 0.6, 0.2)
y = blank(2.0)
for i, m in enumerate((67, 65, 62, 55)): place(y, filt(sweep(mtof(m), mtof(m) * 0.96, 0.5, "saw"), "lp", 1300) * adsr(0.5, 0.03, 0.2, 0.5, 0.15) * 0.45, i * 0.3)
S["outOfLives"] = verb(y, 0.8, 0.25)
# the blaster, targets, crates, gremlins, traps
y = blank(0.26); place(y, zap(2600, 700, 0.14, "square", 7000), 0, 0.4); place(y, zap(1300, 350, 0.1, "saw", 3000), 0, 0.3); place(y, thud(200, 80, 0.06), 0, 0.3)
S["shoot"] = y
y = blank(1.0); place(y, bell(1600, 0.6, 1.6), 0, 0.5); place(y, bell(2400, 0.7, 1.4), 0.04, 0.4); place(y, crunch(0.1, 2000, 9000, 0.03, 0.5), 0)
for i, m in enumerate((84, 88, 91)): place(y, chime(m, 0.4), 0.15 + i * 0.06, 0.25)
S["targetHit"] = verb(y, 0.6, 0.25)
y = blank(1.1)
for i in range(8): place(y, filt(noise(0.05), "bp", (300, 1500)) * env(0.05, 0.002, 0.02) * 0.6 + thud(260 - i * 10, 120, 0.05) * 0.3, i * 0.11)
place(y, filt(sweep(220, 160, 0.9, "saw"), "lp", 800) * env(0.9, 0.05, 0.4) * 0.2, 0)
S["bridge"] = y
y = blank(0.6); place(y, crunch(0.3, 400, 3500, 0.06, 0.8, 6), 0); place(y, thud(220, 90, 0.15), 0, 0.6)
for i, f in enumerate((330, 410, 520)): place(y, filt(tone(f, 0.12, "tri"), "lp", 1500) * env(0.12, 0.002, 0.04) * 0.4, 0.01 + i * 0.03)
S["crate"] = y
d = 0.6; t = tt(d)
S["gremlin"] = filt(sweep(500, 700, d, "saw") * (1 + 0.8 * np.sin(2 * np.pi * 34 * t)), "bp", (300, 2500)) * adsr(d, 0.05, 0.2, 0.6, 0.2) * 0.4
y = blank(0.5); place(y, sweep(900, 200, 0.2, "square") * env(0.2, 0.002, 0.08) * 0.4, 0); place(y, crunch(0.15, 800, 5000, 0.04, 0.6, 3), 0)
for i in range(4): place(y, chime(98 + i * 2, 0.15) * 0.3, 0.05 + i * 0.03)
S["gremlinPop"] = y
d = 0.35; t = tt(d)
S["laser"] = filt(tone(1200, d, "square") * (0.5 + 0.5 * np.sin(2 * np.pi * 60 * t)), "bp", (600, 5000)) * env(d, 0.005, 0.15) * 0.4
S["whoosh"] = filt(noise(0.6), "bp", (400, 3000)) * np.sin(np.pi * tt(0.6) / 0.6) ** 2 * 0.6
# menus
S["tap"] = filt(tone(1046, 0.05, "square"), "lp", 4000) * env(0.05, 0.001, 0.015) * 0.6
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, pluck(84, 0.3), 0.08, 0.4)
S["open"] = y
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, chime(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.2)
S["buy"] = verb(y, 0.6, 0.25)
y = blank(1.0)
for i in range(5): place(y, crunch(0.015, 2000, 6000, 0.005, 0.4), i * 0.05)
for i, m in enumerate((79, 84, 88, 91)): place(y, filt(tone(mtof(m), 0.15, "square"), "lp", 3500) * env(0.15, 0.003, 0.07) * 0.3, 0.25 + i * 0.06)
S["upgrade"] = verb(y, 0.6, 0.2)


# ---------------------------------------------------------------- ambience (played quietly, left or right)
def chirp_seq(fs, d=0.08, gap=0.05, g=0.5):
    y = blank(len(fs) * (d + gap) + 0.2)
    for i, (f0, f1) in enumerate(fs): place(y, sweep(f0, f1, d) * env(d, 0.005, d * 0.4) * g, i * (d + gap))
    return y


S["birdA"] = verb(chirp_seq([(3200, 4900), (3000, 5200), (3600, 4800)], 0.07, 0.04), 0.5, 0.2)
d = 0.8; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * (2900 + 650 * np.sin(2 * np.pi * 22 * t)) * t) * adsr(d, 0.05, 0.3, 0.5, 0.2) * 0.4, 0.5, 0.25)
d = 2.0; t = tt(d)
S["wind"] = filt(noise(d), "bp", (220, 1300)) * np.sin(np.pi * t / d) ** 2 * 0.6
y = blank(2.0); place(y, filt(noise(2.0), "lp", 500) * np.sin(np.pi * tt(2.0) / 2.0) * 0.6, 0)
for f in (392, 494): place(y, filt(tone(f, 0.45, "square"), "lp", 1100) * adsr(0.45, 0.02, 0.2, 0.8, 0.08) * 0.2, 0.6)
S["city"] = verb(y, 1.0, 0.5)
y = blank(1.2)
for i, at in enumerate((0, 0.4)): place(y, filt(tone(380 - i * 20, 0.32, "tri"), "lp", 900) * adsr(0.32, 0.05, 0.15, 0.6, 0.12), at, 0.5)
S["owl"] = verb(y, 1.0, 0.45)
y = blank(1.4)
for i in range(6): place(y, tone(4300, 0.05, "sine") * (np.sin(2 * np.pi * 60 * tt(0.05)) > 0) * env(0.05, 0.003, 0.02) * 0.35, i * 0.2 + (i % 2) * 0.05)
S["crickets"] = y
y = blank(1.6)
for i in range(6): place(y, thud(90 + RNG.random() * 60, 40, 0.15) * 0.5 + filt(noise(0.15), "lp", 500) * env(0.15, 0.01, 0.05) * 0.4, i * 0.22 + RNG.random() * 0.1)
S["lava"] = verb(y, 0.8, 0.3)
y = blank(1.2)
for i in range(7):
    f = 400 + RNG.random() * 700
    place(y, sweep(f, f * 1.8, 0.06) * env(0.06, 0.003, 0.025) * 0.5, i * 0.12 + RNG.random() * 0.05)
S["bubbles"] = verb(y, 0.6, 0.3)
y = blank(0.9)
place(y, filt(sweep(1600, 900, 0.18, "saw"), "bp", (700, 2600)) * env(0.18, 0.01, 0.08) * 0.5, 0)
place(y, filt(sweep(1400, 700, 0.3, "saw"), "bp", (600, 2400)) * env(0.3, 0.01, 0.12) * 0.5, 0.22)
S["gull"] = verb(y, 0.8, 0.35)
y = blank(1.4)
for i in range(6): place(y, bell(600 + (i % 3) * 210, 0.12, 2.4) * 0.35 + crunch(0.12, 1500, 5000, 0.01, 0.2), i * 0.2)
S["gears"] = verb(y, 0.7, 0.3)
y = blank(1.6)
for i, m in enumerate((91, 95, 98, 103, 100)): place(y, bell(mtof(m), 1.0, 1.0), i * 0.18, 0.25)
S["chimes"] = verb(y, 1.0, 0.45)
y = blank(0.9)
for i in range(3): place(y, filt(np.sign(np.sin(2 * np.pi * 95 * tt(0.16))), "bp", (150, 900)) * env(0.16, 0.01, 0.06), i * 0.22, 0.5)
S["frog"] = verb(y, 0.6, 0.3)
y = blank(1.2)
for i, f in enumerate((1200, 1600, 900, 2000, 1400)): place(y, tone(f, 0.06, "square") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
S["beeps"] = y
y = blank(1.0)
for i in range(8): place(y, filt(tone(200 + RNG.random() * 2000, 0.04, "square"), "lp", 6000) * 0.3 + crunch(0.04, 2000, 9000, 0.02, 0.25), i * 0.08 + RNG.random() * 0.04)
S["glitch"] = y
d = 2.6; t = tt(d)
y = filt(noise(d), "lp", 220) * np.exp(-t / 0.9) * 2.2
place(y, crunch(0.3, 800, 6000, 0.08, 0.6, 6), 0)
S["thunder"] = verb(y, 1.2, 0.35)
y = blank(0.9)
for at in (0, 0.35): place(y, filt(sweep(700, 520, 0.22, "saw") + filt(noise(0.22), "bp", (800, 2200)) * 0.6, "bp", (500, 2500)) * env(0.22, 0.01, 0.1) * 0.5, at)
S["crow"] = verb(y, 0.8, 0.35)
d = 2.2; t = tt(d)
S["space"] = verb(np.sin(2 * np.pi * np.cumsum(220 + 80 * np.sin(2 * np.pi * 0.6 * t)) / SR) * np.sin(np.pi * t / d) * 0.3 + filt(noise(d), "bp", (2000, 6000)) * np.sin(np.pi * t / d) * 0.05, 1.2, 0.5)

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("wind", "city", "lava", "thunder") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
