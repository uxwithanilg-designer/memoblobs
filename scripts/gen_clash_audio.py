"""Cube Clash sound effects, synthesised from scratch (numpy + scipy; no samples, all original): the cube blaster and
the boom blaster, hits, knockback boings, cubes clicking into place, blocks breaking by material, towers collapsing,
jetpack puffs and sputters, the fall into the void, knockouts, crystals ringing and shattering, mobs (growls, hops,
wisps, orbs), the Titan, jump pads, checkpoints, the finish fanfare, shot targets and bridges, pickups and powers,
stage stings, menu sounds, and the maps' ambience (birds, wind, gulls, owls, crickets, lava, chimes, frogs, beeps,
bells, crows, bubbles). The music is composed live in the game (src/clash/music.ts).

usage: python scripts/gen_clash_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_clash_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
    tmp = os.path.join(tempfile.gettempdir(), f"clash_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_clash_{name}.mp3")
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

# the cube blaster: a bright, bouncy "bip-zap" (lighter and higher than a laser), and the boom blaster
y = blank(0.24)
place(y, zap(1800, 900, 0.09, "square", 7000), 0, 0.4)
place(y, filt(tone(mtof(88), 0.08, "square"), "lp", 5000) * env(0.08, 0.001, 0.03) * 0.3, 0.01)
place(y, thud(220, 110, 0.06), 0, 0.4)
S["shoot"] = y
y = blank(1.6)
place(y, thud(90, 30, 0.7, 1.3), 0); place(y, filt(noise(1.1), "lp", 2200) * env(1.1, 0.002, 0.28), 0, 1.0)
for i in range(8): place(y, crunch(0.04, 1200, 6000, 0.012, 0.25), 0.25 + i * 0.08 + RNG.random() * 0.04)
S["boom"] = verb(y, 0.8, 0.25)
y = blank(0.2); place(y, thud(300, 120, 0.08), 0, 0.7); place(y, crunch(0.05, 600, 3000, 0.015, 0.5), 0); place(y, chime(96, 0.08), 0.01, 0.15)
S["hit"] = y
y = blank(0.14); place(y, crunch(0.05, 1800, 7500, 0.012, 0.7, 2), 0)
S["hitBlock"] = y
# knockback: a springy "boing-thump"
y = blank(0.45); place(y, thud(160, 60, 0.15), 0, 0.8); place(y, sweep(220, 520, 0.25, "tri") * env(0.25, 0.005, 0.1) * 0.5, 0.02)
S["knock"] = y
# placing a cube: a soft plastic click-pop
y = blank(0.18); place(y, sweep(700, 420, 0.06, "tri") * env(0.06, 0.001, 0.02), 0, 0.7); place(y, crunch(0.02, 2000, 6000, 0.006, 0.4), 0)
S["place"] = y
# breaking
y = blank(0.4); place(y, crunch(0.3, 200, 2200, 0.08, 1.0, 4), 0); place(y, thud(150, 60, 0.12), 0, 0.4)
S["breakSoft"] = y
y = blank(0.5); place(y, crunch(0.28, 400, 3500, 0.06, 0.8, 5), 0)
for i, f in enumerate((340, 430, 540)): place(y, filt(tone(f, 0.1, "tri"), "lp", 1500) * env(0.1, 0.002, 0.035) * 0.4, 0.01 + i * 0.03)
S["breakWood"] = y
y = blank(0.6); place(y, crunch(0.45, 300, 5000, 0.09, 1.0, 8), 0); place(y, thud(130, 45, 0.18), 0, 0.6)
S["breakStone"] = y
y = blank(0.7)
for i in range(12): place(y, bell(2600 + RNG.random() * 3800, 0.14, 1.8) * 0.3, RNG.random() * 0.25)
place(y, crunch(0.1, 3000, 12000, 0.03, 0.7), 0)
S["breakGlass"] = verb(y, 0.5, 0.25)
y = blank(0.4); place(y, crunch(0.15, 600, 4000, 0.04, 0.8, 3), 0); place(y, sweep(900, 300, 0.12, "square") * env(0.12, 0.002, 0.05) * 0.25, 0)
S["breakCube"] = y
y = blank(0.4); place(y, crunch(0.25, 250, 2600, 0.06, 0.9, 4), 0); place(y, thud(110, 50, 0.15), 0, 0.6)
S["crumble"] = y
y = blank(2.4)
place(y, filt(noise(2.0), "lp", 400) * adsr(2.0, 0.1, 0.8, 0.5, 0.8) * 1.4, 0)
for i in range(14): place(y, crunch(0.25, 200, 3000, 0.06, 0.6 - i * 0.03, 4), 0.05 + i * 0.12 + RNG.random() * 0.06)
S["collapse"] = verb(y, 1.0, 0.25)
# the jetpack: a puff of thrust; and the sputter when it's dry
y = blank(0.35); place(y, filt(noise(0.3), "bp", (300, 2500)) * env(0.3, 0.02, 0.1), 0, 0.8); place(y, thud(90, 70, 0.2) * 0.4, 0)
S["jet"] = y
y = blank(0.5)
for i in range(3): place(y, filt(noise(0.06), "lp", 900) * env(0.06, 0.003, 0.02), i * 0.13, 0.6 - i * 0.15)
S["jetEmpty"] = y
S["jump"] = sweep(300, 720, 0.13, "tri") * env(0.13, 0.004, 0.05) * 0.7
y = blank(0.3); place(y, thud(150, 60, 0.14), 0, 0.8); place(y, crunch(0.07, 300, 1500, 0.025, 0.4), 0)
S["land"] = y
# falling into the void: a long falling whistle
d = 1.4; t = tt(d)
S["fall"] = filt(sweep(1400, 180, d, "tri"), "lp", 3000) * adsr(d, 0.02, 0.4, 0.6, 0.4) * 0.5 + filt(noise(d), "bp", (300, 1500)) * adsr(d, 0.2, 0.4, 0.5, 0.3) * 0.2
# an elimination: a bright "KO" sting
y = blank(0.9)
for i, m in enumerate((79, 84, 91)): place(y, filt(tone(mtof(m), 0.14, "square"), "lp", 4500) * env(0.14, 0.002, 0.07) * 0.35, i * 0.07)
place(y, chime(98, 0.5), 0.2, 0.3)
S["elim"] = verb(y, 0.5, 0.2)
y = blank(1.5)
for i, m in enumerate((67, 63, 58)): place(y, filt(sweep(mtof(m), mtof(m) * 0.94, 0.35, "square"), "lp", 1800) * adsr(0.35, 0.01, 0.1, 0.5, 0.1) * 0.45, i * 0.22)
S["out"] = verb(y, 0.7, 0.25)
y = blank(1.0); place(y, filt(sweep(300, 1200, 0.5, "saw"), "lp", 3000) * env(0.5, 0.05, 0.2) * 0.3, 0)
for i, m in enumerate((84, 88, 91)): place(y, chime(m, 0.4), 0.3 + i * 0.06, 0.3)
S["respawn"] = verb(y, 0.6, 0.3)
# crystals
y = blank(0.5)
for f in (1800, 2700, 3900): place(y, bell(f, 0.3, 1.6), 0, 0.25)
place(y, crunch(0.05, 2500, 9000, 0.015, 0.4), 0)
S["crystalHit"] = verb(y, 0.5, 0.3)
y = blank(2.0)
for i in range(16): place(y, bell(1500 + RNG.random() * 4000, 0.6, 1.8) * 0.3, RNG.random() * 0.25)
place(y, thud(120, 40, 0.5), 0, 0.8); place(y, zap(2800, 200, 1.2, "saw", 3500), 0.03, 0.4)
S["crystalBreak"] = verb(y, 1.1, 0.35)
y = blank(0.8)
for i in range(3): place(y, filt(tone(880, 0.12, "square"), "lp", 3000) * adsr(0.12, 0.004, 0.05, 0.6, 0.03), i * 0.18, 0.4)
S["crystalWarn"] = y
# mobs
d = 0.8; t = tt(d)
S["zGrowl"] = filt(sweep(150, 105, d, "saw") * (1 + 0.6 * np.sin(2 * np.pi * 21 * t)), "lp", 900) * adsr(d, 0.06, 0.3, 0.6, 0.25) * 0.6 + filt(noise(d), "bp", (200, 900)) * adsr(d, 0.06, 0.3, 0.5, 0.25) * 0.25
y = blank(0.3); place(y, sweep(200, 520, 0.12) * env(0.12, 0.003, 0.05), 0, 0.6); place(y, filt(noise(0.08), "lp", 1200) * env(0.08, 0.003, 0.03), 0, 0.4)
S["zHop"] = y
d = 1.0; t = tt(d)
S["zWisp"] = verb(np.sin(2 * np.pi * (600 + 200 * np.sin(2 * np.pi * 3 * t)) * t) * adsr(d, 0.2, 0.3, 0.5, 0.3) * 0.3, 0.9, 0.5)
y = blank(0.5); place(y, thud(280, 100, 0.12), 0, 0.6); place(y, zap(800, 200, 0.25, "tri", 3000), 0.02, 0.4)
for i in range(4): place(y, crunch(0.03, 1500, 7000, 0.01, 0.3), 0.05 + i * 0.05)
S["zDie"] = y
d = 0.5; t = tt(d)
S["orb"] = filt(sweep(500, 900, d, "tri"), "lp", 2500) * env(d, 0.02, 0.2) * 0.5
d = 2.0; t = tt(d)
v = filt(sweep(120, 60, d, "saw") * (1 + 0.8 * np.sin(2 * np.pi * 27 * t)), "lp", 1100) * adsr(d, 0.15, 0.6, 0.6, 0.6)
v += filt(noise(d), "bp", (150, 1400)) * adsr(d, 0.15, 0.6, 0.5, 0.6) * 0.4
S["titanRoar"] = verb(v * 0.8, 1.2, 0.3)
y = blank(1.4); place(y, thud(65, 22, 0.8, 1.6), 0); place(y, crunch(0.9, 100, 2000, 0.25, 1.0, 12), 0)
S["titanSlam"] = verb(y, 0.9, 0.25)
# the course
y = blank(0.6); place(y, sweep(180, 900, 0.3, "square") * env(0.3, 0.004, 0.12) * 0.35, 0); place(y, thud(120, 200, 0.12), 0, 0.5)
S["pad"] = y
y = blank(1.0); place(y, chime(91, 0.6), 0.0, 0.6); place(y, chime(96, 0.7), 0.12, 0.6)
S["checkpoint"] = verb(y, 0.6, 0.25)
y = blank(2.4)
for i, (m, at, dd) in enumerate(((72, 0, 0.14), (76, 0.14, 0.14), (79, 0.28, 0.14), (84, 0.42, 1.0))): place(y, brass(m, dd + 0.1, 3500), at, 0.45)
for m in (88, 91, 96, 100): place(y, chime(m, 1.2), 0.44, 0.16)
S["finish"] = verb(y, 1.0, 0.3)
y = blank(0.7); place(y, crunch(0.1, 1000, 6000, 0.03, 0.7), 0)
for i, m in enumerate((84, 91, 96)): place(y, filt(tone(mtof(m), 0.1, "square"), "lp", 4000) * env(0.1, 0.002, 0.05) * 0.3, 0.03 + i * 0.05)
S["target"] = y
y = blank(1.0)
for i in range(6): place(y, sweep(500 + i * 80, 380 + i * 80, 0.05, "tri") * env(0.05, 0.001, 0.02) * 0.5, i * 0.07)
place(y, chime(96, 0.5), 0.45, 0.3)
S["bridge"] = y
# pickups
y = blank(0.4); place(y, chime(95, 0.25), 0, 0.55); place(y, chime(100, 0.35), 0.05, 0.65); place(y, tone(2093, 0.04, "square") * env(0.04, 0.001, 0.015) * 0.1, 0)
S["coin"] = y
y = blank(1.0)
for i, m in enumerate((88, 95, 100, 104, 107)): place(y, bell(mtof(m), 0.6, 1.4), i * 0.05, 0.4)
S["gem"] = verb(y, 0.8, 0.3)
y = blank(0.8)
for i in range(4): place(y, sweep(160 + i * 50, (160 + i * 50) * 2.1, 0.07) * env(0.07, 0.002, 0.03), 0.02 + i * 0.08, 0.5)
place(y, zap(600, 1700, 0.3, "tri", 4000), 0.36, 0.4)
S["oil"] = y
y = blank(0.9); place(y, thud(90, 50, 0.18), 0, 0.6); place(y, thud(80, 45, 0.18), 0.17, 0.45)
for m in (76, 80, 83, 88): place(y, pluck(m, 0.7, 3500), 0.12, 0.3)
S["heart"] = verb(y, 0.5, 0.2)
y = blank(0.8)
for i, m in enumerate((72, 76, 79, 84)): place(y, filt(tone(mtof(m), 0.12, "square"), "lp", 3000) * env(0.12, 0.003, 0.05) * 0.35, i * 0.06)
S["health"] = y
y = blank(0.9); place(y, filt(sweep(260, 1700, 0.4, "square"), "lp", 3500) * env(0.4, 0.01, 0.18) * 0.35, 0)
for i, m in enumerate((84, 88, 91, 96, 100)): place(y, chime(m, 0.4), 0.15 + i * 0.045, 0.28)
S["power"] = verb(y, 0.5, 0.25)
y = blank(0.7)
for i in range(5): place(y, sweep(600 + i * 60, 400 + i * 60, 0.05, "tri") * env(0.05, 0.001, 0.02) * 0.55, i * 0.06)
place(y, chime(93, 0.3), 0.32, 0.3)
S["cubes"] = y
d = 0.9; t = tt(d)
S["shield"] = verb(sum(np.sin(2 * np.pi * (f + 7 * np.sin(2 * np.pi * 7 * t)) * t) for f in (620, 930, 1240)) * adsr(d, 0.04, 0.3, 0.4, 0.3) * 0.3, 0.7, 0.35)
y = blank(0.5); place(y, crunch(0.05, 3000, 9000, 0.015, 0.7), 0); place(y, sweep(2000, 500, 0.25) * env(0.25, 0.002, 0.09), 0.01, 0.4)
S["shieldPop"] = verb(y, 0.4, 0.2)
# stage moments
y = blank(1.0); place(y, brass(79, 0.45, 3500), 0, 0.7); place(y, brass(72, 0.45, 3500), 0, 0.5); place(y, thud(150, 50, 0.2), 0, 0.7)
S["go"] = verb(y, 0.6, 0.2)
y = blank(2.8)
for i, (m, at, dd) in enumerate(((72, 0, 0.14), (76, 0.14, 0.14), (79, 0.28, 0.14), (84, 0.42, 0.14), (88, 0.56, 1.1))):
    place(y, brass(m, dd + 0.1, 3600), at, 0.42); place(y, filt(tone(mtof(m + 12), dd, "square"), "lp", 4500) * env(dd, 0.003, dd * 0.5) * 0.14, at)
for m in (91, 96, 100, 103): place(y, chime(m, 1.4), 0.6, 0.16)
place(y, filt(noise(1.6), "hp", 5000) * adsr(1.6, 0.4, 0.5, 0.4, 0.6) * 0.2, 0.45)
S["clear"] = verb(y, 1.0, 0.3)
y = blank(3.4)
for at, ms in ((0, (60, 64, 67)), (0.3, (62, 65, 69)), (0.6, (64, 67, 72)), (0.9, (67, 72, 76))):
    for m in ms: place(y, brass(m, 0.9 if at == 0.9 else 0.32, 3000), at, 0.3)
for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100)): place(y, chime(m, 0.9), 1.0 + i * 0.07, 0.22)
S["worldClear"] = verb(y, 1.2, 0.3)
y = blank(1.6)
place(y, filt(noise(1.1), "bp", (300, 3000)) * adsr(1.1, 0.5, 0.2, 0.6, 0.3) * 0.5, 0)
for i, m in enumerate((74, 79, 86, 91)): place(y, chime(m, 0.8), 0.7 + i * 0.08, 0.3)
place(y, thud(110, 40, 0.3), 0.7, 0.6)
S["stageStart"] = verb(y, 0.9, 0.3)
y = blank(1.6)
for i, (f, at) in enumerate(((330, 0), (330, 0.35), (440, 0.7))): place(y, brass(57 + i * 2, 0.4, 2200), at, 0.6)
S["wave"] = verb(y, 0.9, 0.3)
S["beep"] = filt(tone(880, 0.16, "square"), "lp", 3000) * adsr(0.16, 0.005, 0.08, 0.6, 0.05) * 0.5
S["tap"] = filt(tone(1175, 0.05, "square"), "lp", 4000) * env(0.05, 0.001, 0.015) * 0.6
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, pluck(86, 0.3), 0.08, 0.4)
S["open"] = y
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, chime(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.2)
S["buy"] = verb(y, 0.6, 0.25)
y = blank(1.0)
for i in range(5): place(y, crunch(0.015, 2000, 6000, 0.005, 0.4), i * 0.05)
for i, m in enumerate((79, 84, 88, 91)): place(y, filt(tone(mtof(m), 0.15, "square"), "lp", 3500) * env(0.15, 0.003, 0.07) * 0.3, 0.25 + i * 0.06)
S["upgrade"] = verb(y, 0.6, 0.2)
S["whoosh"] = filt(noise(0.6), "bp", (400, 3000)) * np.sin(np.pi * tt(0.6) / 0.6) ** 2 * 0.6


# ---------------------------------------------------------------- ambience
def chirp_seq(fs, d=0.08, gap=0.05, g=0.5):
    y = blank(len(fs) * (d + gap) + 0.2)
    for i, (f0, f1) in enumerate(fs): place(y, sweep(f0, f1, d) * env(d, 0.005, d * 0.4) * g, i * (d + gap))
    return y


S["birdA"] = verb(chirp_seq([(3500, 5000), (3200, 5400), (3600, 4800), (3000, 5200)], 0.06, 0.04), 0.5, 0.2)
d = 0.8; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * (2900 + 650 * np.sin(2 * np.pi * 20 * t)) * t) * adsr(d, 0.05, 0.3, 0.5, 0.2) * 0.4, 0.5, 0.25)
d = 2.0; t = tt(d)
S["wind"] = filt(noise(d), "bp", (220, 1300)) * np.sin(np.pi * t / d) ** 2 * 0.6
y = blank(0.9)
place(y, filt(sweep(1600, 900, 0.18, "saw"), "bp", (700, 2600)) * env(0.18, 0.01, 0.08) * 0.5, 0)
place(y, filt(sweep(1400, 700, 0.3, "saw"), "bp", (600, 2400)) * env(0.3, 0.01, 0.12) * 0.5, 0.22)
S["gull"] = verb(y, 0.8, 0.35)
y = blank(1.2)
for i, at in enumerate((0, 0.4)): place(y, filt(tone(380 - i * 20, 0.32, "tri"), "lp", 900) * adsr(0.32, 0.05, 0.15, 0.6, 0.12), at, 0.5)
S["owl"] = verb(y, 1.0, 0.45)
y = blank(1.4)
for i in range(6): place(y, tone(4300, 0.05, "sine") * (np.sin(2 * np.pi * 60 * tt(0.05)) > 0) * env(0.05, 0.003, 0.02) * 0.35, i * 0.2 + (i % 2) * 0.05)
S["crickets"] = y
y = blank(1.6)
for i in range(6): place(y, thud(90 + RNG.random() * 60, 40, 0.15) * 0.5 + filt(noise(0.15), "lp", 500) * env(0.15, 0.01, 0.05) * 0.4, i * 0.22 + RNG.random() * 0.1)
S["lava"] = verb(y, 0.8, 0.3)
y = blank(1.6)
for i, m in enumerate((91, 95, 98, 103, 100)): place(y, bell(mtof(m), 1.0, 1.0), i * 0.18, 0.25)
S["chimes"] = verb(y, 1.0, 0.45)
y = blank(0.9)
for i in range(3): place(y, filt(np.sign(np.sin(2 * np.pi * 95 * tt(0.16))), "bp", (150, 900)) * env(0.16, 0.01, 0.06), i * 0.22, 0.5)
S["frog"] = verb(y, 0.6, 0.3)
y = blank(1.2)
for i, f in enumerate((1200, 1600, 900, 2000, 1400)): place(y, tone(f, 0.06, "square") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
S["beeps"] = y
y = blank(2.0)
for i, f in enumerate((523, 659, 784, 1046)): place(y, bell(f, 1.2, 1.0), i * 0.32, 0.3)
S["bells"] = verb(y, 1.2, 0.5)
y = blank(0.9)
for at in (0, 0.35): place(y, filt(sweep(700, 520, 0.22, "saw") + filt(noise(0.22), "bp", (800, 2200)) * 0.6, "bp", (500, 2500)) * env(0.22, 0.01, 0.1) * 0.5, at)
S["crow"] = verb(y, 0.8, 0.35)
y = blank(1.2)
for i in range(7):
    f = 400 + RNG.random() * 700
    place(y, sweep(f, f * 1.8, 0.06) * env(0.06, 0.003, 0.025) * 0.5, i * 0.12 + RNG.random() * 0.05)
S["bubbles"] = verb(y, 0.6, 0.3)

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("wind", "lava") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
