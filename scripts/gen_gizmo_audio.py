"""Gizmo Drive sound effects, synthesised from scratch (numpy + scipy; no samples, all original): coins and star coins,
oil cans, hearts, power-ups (turbo, helmet shield, coin magnet, floaty jumps, sticky tyres), landings, bumps, the crash,
the splash, checkpoints, the finish fanfare, the countdown, flips, low-oil warnings, the engine sputter, menu sounds,
the contraptions (button click, gate motor, launch-pad boing, crate smash, creaking and crumbling planks, metal clank,
loop whoosh, wrecking-ball swoosh, crusher stamp, the "new gizmo" jingle) and the worlds' ambience (toy chimes, a toy
train whistle, a cuckoo, candy bubbles and pops, a jackhammer, a reversing truck, metal clanks, wind gusts, birds,
synth zaps and arcade blips, cracking ice, howling wind, creaking metal, crows, owls, frogs, whale song, clock ticks,
steam hisses, bells, ghosts, bats, radio beeps and an airlock). The music is composed live in the game
(src/gizmo/music.ts), so there are no music files.

usage: python scripts/gen_gizmo_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_gizmo_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
RNG = np.random.default_rng(20261126)
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


def env(d, a=0.005, dec=0.2):
    t = tt(d)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(dec, 1e-4))


def adsr(d, a, dcy, s, r):
    t = tt(d)
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(dcy, 1e-4)))
    return e * np.clip((d - t) / max(r, 1e-4), 0, 1)


def sweep(f0, f1, d, kind="sine", curve="exp"):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d) if curve == "exp" else f0 + (f1 - f0) * (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == "saw": return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == "square": return np.sign(np.sin(ph))
    if kind == "tri": return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1
    return np.sin(ph)


def tone(f, d, kind="sine"): return sweep(f, f, d, kind, "lin")


def filt(y, kind, f, order=2):
    if kind == "bp":
        lo, hi = f
        sos = butter(order, [max(20, lo), min(SR / 2 - 100, hi)], btype="band", fs=SR, output="sos")
    else:
        sos = butter(order, min(SR / 2 - 100, max(20, f)), btype="low" if kind == "lp" else "high", fs=SR, output="sos")
    return sosfilt(sos, y)


def bell(f, d, bright=1.0):
    t = tt(d)
    parts = [(1, 1, d * 0.6), (2.76, 0.5 * bright, d * 0.25), (5.4, 0.3 * bright, d * 0.12), (8.9, 0.15 * bright, d * 0.06)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec) for r, a, dec in parts)


def marimba(m, d=0.5, g=1.0):
    """a woody mallet: fundamental, a 4th partial, quick decay — Gizmo Drive's signature voice"""
    f = mtof(m); t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / (d * 0.32)) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / (d * 0.08))
    y += 0.15 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t / 0.01)
    return y * g


def pluck(m, d=0.4, bright=4000):
    f = mtof(m); t = tt(d)
    y = sum((0.6 ** k) * np.sin(2 * np.pi * f * (k + 1) * t) for k in range(6)) * np.exp(-t / (d * 0.3))
    return filt(y, "lp", bright)


def brass(m, d, bright=2500):
    f = mtof(m)
    y = sweep(f * 0.995, f, d, "saw", "lin") * 0.6 + sweep(f * 1.004, f * 1.004, d, "saw", "lin") * 0.4
    return filt(y, "lp", bright) * adsr(d, 0.03, 0.2, 0.7, 0.12)


def thud(f0=110, f1=40, d=0.3, g=1.0): return sweep(f0, f1, d) * env(d, 0.002, d * 0.35) * g


def place(y, x, at, g=1.0):
    o = int(at * SR)
    if o >= len(y): return y
    k = min(len(x), len(y) - o)
    y[o:o + k] += x[:k] * g
    return y


def blank(d): return np.zeros(n_(d))


def verb(y, size=0.6, wet=0.25):
    ir = noise(size) * np.exp(-tt(size) / (size * 0.28))
    ir = filt(ir, "lp", 6000)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = fftconvolve(y, ir)[: len(y) + n_(size)]
    dry = np.concatenate([y, np.zeros(len(w) - len(y))])
    return dry * (1 - wet) + w * wet


def finish(y, peak=0.9, fade=0.01):
    y = np.asarray(y, dtype=np.float64)
    nf = n_(fade)
    if len(y) > nf: y[-nf:] *= np.linspace(1, 0, nf)
    y[: n_(0.0005)] *= np.linspace(0, 1, n_(0.0005))
    return y / (np.max(np.abs(y)) + 1e-9) * peak


def write(name, y, peak=0.9):
    y = finish(y, peak)
    pcm = (y * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(tempfile.gettempdir(), f"gizmo_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_gizmo_{name}.mp3")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", dst], check=True)
    os.remove(tmp)
    print("sfx", name, round(len(y) / SR, 2), "s", flush=True)


S = {}

# ---------------------------------------------------------------- pickups
y = blank(0.42); place(y, marimba(91, 0.3), 0, 0.7); place(y, marimba(98, 0.35), 0.055, 0.8)
place(y, filt(noise(0.05), "hp", 7500) * env(0.05, 0.001, 0.012) * 0.18, 0)
S["coin"] = y
y = blank(1.0)
for i, m in enumerate((86, 91, 95, 98, 103)): place(y, marimba(m, 0.5), i * 0.05, 0.6)
for i, m in enumerate((98, 103, 107)): place(y, bell(mtof(m), 0.6, 1.3), 0.25 + i * 0.05, 0.25)
S["star"] = verb(y, 0.7, 0.3)
y = blank(0.9)
for i in range(5): place(y, sweep(140 + i * 35, 300 + i * 70, 0.06) * env(0.06, 0.002, 0.025), 0.02 + i * 0.075, 0.55)
place(y, filt(noise(0.02), "bp", (2000, 6000)) * env(0.02, 0.0005, 0.006), 0.42, 0.6)
place(y, marimba(84, 0.4), 0.5, 0.5); place(y, marimba(91, 0.5), 0.6, 0.5)
S["fuel"] = y
y = blank(1.0)
place(y, thud(85, 48, 0.18), 0, 0.6); place(y, thud(78, 44, 0.18), 0.16, 0.45)
for i, m in enumerate((79, 83, 86, 91)): place(y, marimba(m, 0.6), 0.12 + i * 0.06, 0.45)
S["heart"] = verb(y, 0.5, 0.22)
y = blank(0.85)
place(y, filt(sweep(260, 1600, 0.45, "saw"), "lp", 3200) * env(0.45, 0.02, 0.2) * 0.4, 0)
for i, m in enumerate((84, 88, 91, 96, 100)): place(y, marimba(m, 0.35), 0.15 + i * 0.045, 0.35)
S["power"] = verb(y, 0.5, 0.25)

# power-ups
d = 1.2; t = tt(d)
roar = filt(noise(d), "bp", (300, 2600)) * np.minimum(1, t / 0.12) * np.exp(-np.maximum(0, t - 0.4) / 0.35)
S["turbo"] = filt(roar + sweep(220, 1800, d, "saw") * 0.14 * env(d, 0.05, 0.4), "lp", 5200)
d = 0.9; t = tt(d)
S["shield"] = verb(sum(np.sin(2 * np.pi * (f + 7 * np.sin(2 * np.pi * 6 * t)) * t) for f in (700, 1050, 1400)) * adsr(d, 0.04, 0.3, 0.4, 0.3) * 0.3, 0.7, 0.35)
y = blank(0.6); place(y, filt(noise(0.05), "hp", 3000) * env(0.05, 0.001, 0.015), 0, 0.7); place(y, sweep(2400, 500, 0.3) * env(0.3, 0.002, 0.1), 0.01, 0.4)
S["shieldPop"] = verb(y, 0.4, 0.2)
d = 0.8; t = tt(d)
y = np.sin(2 * np.pi * 150 * t + 3 * np.sin(2 * np.pi * 10 * t)) * adsr(d, 0.03, 0.3, 0.5, 0.25) * 0.5
place(y, bell(2000, 0.4, 1.6), 0.05, 0.25)
S["magnet"] = y
y = blank(0.9); place(y, sweep(700, 2300, 0.5) * env(0.5, 0.05, 0.2) * 0.3, 0)
place(y, filt(noise(0.5), "bp", (2000, 7000)) * env(0.5, 0.1, 0.15) * 0.15, 0)
for i, m in enumerate((93, 98, 105)): place(y, marimba(m, 0.4), 0.2 + i * 0.07, 0.3)
S["float"] = verb(y, 0.6, 0.3)
y = blank(0.7)
for i in range(6): place(y, filt(noise(0.03), "bp", (300, 1500)) * env(0.03, 0.001, 0.012), i * 0.05, 0.4)
place(y, marimba(76, 0.4), 0.3, 0.6); place(y, marimba(83, 0.4), 0.38, 0.6)
S["grip"] = y

# ---------------------------------------------------------------- the drive
y = blank(0.35); place(y, thud(130, 48, 0.24), 0, 0.85); place(y, filt(noise(0.08), "lp", 900) * env(0.08, 0.001, 0.03), 0, 0.4)
for k in range(3): place(y, filt(tone(260 + k * 40, 0.08, "tri"), "lp", 1200) * env(0.08, 0.002, 0.03), 0.04 + k * 0.035, 0.12)
S["land"] = y
y = blank(0.75); place(y, thud(110, 34, 0.42), 0, 1.0); place(y, filt(noise(0.22), "lp", 1500) * env(0.22, 0.001, 0.07), 0, 0.6)
for i in range(5): place(y, bell(650 + i * 210, 0.12, 2.0), 0.03 + i * 0.045, 0.1)
S["landHard"] = y
y = blank(0.25); place(y, thud(170, 75, 0.15), 0, 0.7); place(y, filt(noise(0.03), "bp", (600, 2600)) * env(0.03, 0.001, 0.01), 0, 0.4)
S["bump"] = y
y = blank(1.6)
place(y, filt(noise(0.5), "lp", 2600) * env(0.5, 0.002, 0.15), 0, 0.9)
place(y, thud(95, 30, 0.5), 0, 1.0)
for i, f in enumerate((330, 540, 790, 1150, 1520)): place(y, bell(f, 0.5, 2.2), 0.01 + i * 0.03, 0.17)
place(y, thud(140, 60, 0.2), 0.36, 0.5)
for i in range(4): place(y, sweep(900 - i * 120, 500 - i * 80, 0.08, "tri") * env(0.08, 0.002, 0.03), 0.6 + i * 0.12, 0.2)
for i in range(6): place(y, filt(noise(0.03), "bp", (1500, 6000)) * env(0.03, 0.001, 0.01), 0.45 + i * 0.08 + RNG.random() * 0.03, 0.22)
S["crash"] = verb(y, 0.6, 0.2)
y = blank(1.4)
place(y, thud(70, 30, 0.4), 0, 0.8)
place(y, filt(noise(0.9), "bp", (400, 3200)) * env(0.9, 0.01, 0.25), 0, 0.7)
for i in range(10): place(y, sweep(600 + RNG.random() * 900, 1500 + RNG.random() * 1200, 0.05) * env(0.05, 0.002, 0.02), 0.2 + RNG.random() * 0.8, 0.2)
S["splash"] = verb(y, 0.7, 0.25)
y = blank(1.0); place(y, filt(noise(0.3), "bp", (800, 4000)) * env(0.3, 0.05, 0.08) * 0.3, 0)
for i, m in enumerate((84, 88, 91, 96)): place(y, marimba(m, 0.5), 0.06 + i * 0.07, 0.55)
S["checkpoint"] = verb(y, 0.6, 0.25)
y = blank(2.9)
for m, at, dd in ((72, 0, 0.16), (76, 0.16, 0.16), (79, 0.32, 0.16), (84, 0.48, 1.2)):
    place(y, brass(m, dd + 0.1), at, 0.45); place(y, brass(m - 12, dd + 0.1), at, 0.22)
for i, m in enumerate((84, 88, 91, 96, 100, 103)): place(y, marimba(m, 0.6), 0.5 + i * 0.06, 0.3)
place(y, filt(noise(1.6), "hp", 5000) * adsr(1.6, 0.4, 0.5, 0.4, 0.6) * 0.25, 0.3)
S["finish"] = verb(y, 1.0, 0.3)
y = blank(0.9); place(y, brass(84, 0.45, 3600), 0, 0.6); place(y, brass(72, 0.45, 3600), 0, 0.45); place(y, thud(160, 50, 0.2), 0, 0.6)
place(y, filt(noise(0.4), "bp", (500, 3000)) * env(0.4, 0.05, 0.12) * 0.25, 0.05)
S["go"] = verb(y, 0.6, 0.2)
y = marimba(93, 0.25) * 0.8; place(y, filt(tone(1396, 0.12, "square"), "lp", 2500) * adsr(0.12, 0.003, 0.05, 0.5, 0.04), 0, 0.2)
S["beep"] = y
y = blank(0.8); place(y, filt(sweep(300, 1500, 0.3, "saw"), "bp", (400, 3000)) * env(0.3, 0.02, 0.1) * 0.25, 0)
place(y, marimba(88, 0.4), 0.16, 0.6); place(y, marimba(95, 0.5), 0.28, 0.6)
S["flip"] = verb(y, 0.5, 0.2)
y = blank(0.9); place(y, filt(noise(0.6), "bp", (300, 1800)) * adsr(0.6, 0.2, 0.2, 0.3, 0.2) * 0.4, 0); place(y, marimba(100, 0.5), 0.3, 0.4)
S["bigAir"] = verb(y, 0.6, 0.25)
y = blank(0.6)
for i, f in enumerate((1046, 784, 1046)): place(y, filt(tone(f, 0.12, "square"), "lp", 2500) * adsr(0.12, 0.005, 0.05, 0.6, 0.03), i * 0.16, 0.42)
S["lowFuel"] = y
y = blank(1.4)
for i in range(5):
    a = 0.6 - i * 0.1
    place(y, filt(noise(0.1), "lp", 600 - i * 60) * env(0.1, 0.004, 0.04) * a, i * (0.16 + i * 0.04))
    place(y, thud(72, 40, 0.1) * a, i * (0.16 + i * 0.04))
S["sputter"] = y
y = blank(1.3)
for i, m in enumerate((74, 70, 65)): place(y, filt(sweep(mtof(m), mtof(m) * 0.96, 0.4, "tri"), "lp", 1800) * adsr(0.4, 0.02, 0.15, 0.5, 0.1) * 0.5, i * 0.24)
S["lifeLost"] = verb(y, 0.6, 0.2)
y = blank(2.0)
for i, m in enumerate((69, 66, 62, 57)): place(y, filt(sweep(mtof(m), mtof(m) * 0.95, 0.5, "tri"), "lp", 1500) * adsr(0.5, 0.03, 0.2, 0.5, 0.15) * 0.5, i * 0.3)
S["gameOver"] = verb(y, 0.8, 0.25)
y = blank(3.6)
for at, ms in ((0, (60, 64, 67)), (0.3, (62, 65, 69)), (0.6, (64, 67, 72)), (0.9, (67, 72, 76))):
    for m in ms: place(y, brass(m, 0.9 if at == 0.9 else 0.32, 3000), at, 0.28)
for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100, 103)): place(y, marimba(m, 0.7), 1.0 + i * 0.065, 0.3)
place(y, filt(noise(2.0), "hp", 5000) * adsr(2.0, 0.6, 0.6, 0.4, 0.8) * 0.22, 0.8)
S["worldClear"] = verb(y, 1.2, 0.3)

# menus
y = marimba(91, 0.12) * 0.7; place(y, sweep(1200, 800, 0.04) * env(0.04, 0.001, 0.01), 0, 0.3)
S["tap"] = y
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, marimba(86, 0.3), 0.08, 0.5)
S["open"] = y
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, marimba(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.25)
S["buy"] = verb(y, 0.6, 0.25)
S["whoosh"] = filt(noise(0.5), "bp", (400, 3000)) * np.sin(np.pi * tt(0.5) / 0.5) ** 2 * 0.6

# ---------------------------------------------------------------- contraptions
y = blank(0.3); place(y, filt(noise(0.012), "bp", (1500, 5000)) * env(0.012, 0.0005, 0.004), 0, 0.8); place(y, thud(300, 140, 0.06), 0, 0.5)
place(y, marimba(96, 0.2), 0.04, 0.4)
S["button"] = y
d = 1.4; t = tt(d)
y = filt(sweep(90, 140, d, "saw"), "lp", 700) * adsr(d, 0.08, 0.3, 0.7, 0.2) * 0.5
y += filt(noise(d), "bp", (800, 2400)) * adsr(d, 0.05, 0.3, 0.3, 0.2) * 0.12 * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * t))
place(y, thud(160, 70, 0.15), 1.25, 0.6)
S["gate"] = y
d = 0.7; t = tt(d)
f = 160 + 340 * np.exp(-t / 0.1) + 60 * np.sin(2 * np.pi * 14 * t) * np.exp(-t / 0.3)
y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.003, 0.25)
place(y, thud(200, 60, 0.1), 0, 0.6)
S["spring"] = y
y = blank(1.0)
place(y, filt(noise(0.25), "bp", (300, 2500)) * env(0.25, 0.001, 0.08), 0, 1.0)
place(y, thud(150, 60, 0.2), 0, 0.8)
for i in range(9): place(y, filt(noise(0.04), "bp", (800, 4000)) * env(0.04, 0.001, 0.015), 0.08 + i * 0.06 + RNG.random() * 0.04, 0.35)
S["crate"] = verb(y, 0.5, 0.2)
d = 0.8; t = tt(d)
f = 220 + 80 * np.sin(2 * np.pi * 2.2 * t)
S["creak"] = filt(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * (0.5 + 0.5 * np.sin(2 * np.pi * 37 * t)), "bp", (300, 1800)) * adsr(d, 0.08, 0.3, 0.6, 0.25) * 0.4
y = blank(1.0)
for i in range(12): place(y, filt(noise(0.06), "lp", 1200 + RNG.random() * 1500) * env(0.06, 0.002, 0.03), i * 0.06 + RNG.random() * 0.03, 0.5 - i * 0.03)
place(y, thud(90, 40, 0.3), 0.1, 0.5)
S["crumble"] = y
y = blank(0.6); place(y, bell(420, 0.5, 2.4), 0, 0.6); place(y, bell(1130, 0.3, 2.0), 0, 0.3); place(y, thud(200, 90, 0.08), 0, 0.5)
S["clank"] = verb(y, 0.4, 0.2)
d = 1.0; t = tt(d)
S["loop"] = filt(noise(d), "bp", (500, 3500)) * np.sin(np.pi * t / d) ** 2 * 0.5 + sweep(400, 1200, d) * np.sin(np.pi * t / d) ** 2 * 0.1  # same length
d = 0.6; t = tt(d)
S["swoosh"] = filt(noise(d), "bp", (200, 1400)) * np.sin(np.pi * t / d) ** 3 * 0.8
y = blank(0.7); place(y, thud(90, 28, 0.45), 0, 1.0); place(y, filt(noise(0.15), "lp", 2000) * env(0.15, 0.001, 0.05), 0, 0.6)
place(y, filt(noise(0.4), "hp", 3000) * env(0.4, 0.01, 0.12) * 0.25, 0.05)
place(y, bell(310, 0.3, 2.0), 0, 0.2)
S["stamp"] = y
y = blank(1.3)
for i, m in enumerate((79, 84, 88, 91, 96)): place(y, marimba(m, 0.6), i * 0.08, 0.55)
place(y, bell(mtof(103), 0.8, 1.3), 0.4, 0.3)
S["newGizmo"] = verb(y, 0.7, 0.3)


# ---------------------------------------------------------------- ambience (played quietly, left or right)
def chirps(fs, d=0.08, gap=0.05, g=0.5):
    y = blank(len(fs) * (d + gap) + 0.2)
    for i, (f0, f1) in enumerate(fs): place(y, sweep(f0, f1, d) * env(d, 0.005, d * 0.4) * g, i * (d + gap))
    return y


A = {}
y = blank(1.2)
for i, m in enumerate((96, 100, 103, 108, 103)): place(y, bell(mtof(m), 0.5, 0.8), i * 0.13, 0.35)
A["chime"] = verb(y, 0.8, 0.35)
d = 1.1; t = tt(d)
A["whistle"] = verb((np.sin(2 * np.pi * 1180 * t) + 0.6 * np.sin(2 * np.pi * 1480 * t)) * adsr(d, 0.05, 0.2, 0.8, 0.3) * (1 + 0.1 * np.sin(2 * np.pi * 6 * t)) * 0.3, 1.0, 0.45)
y = blank(0.9)
for at, f in ((0, 784), (0.28, 622)): place(y, sweep(f, f * 0.96, 0.22) * env(0.22, 0.01, 0.1) * 0.5, at)
A["cuckoo"] = verb(y, 0.8, 0.4)
y = blank(0.9)
for i in range(6): place(y, sweep(300 + RNG.random() * 200, 900 + RNG.random() * 500, 0.05) * env(0.05, 0.002, 0.02), i * 0.12 + RNG.random() * 0.05, 0.4)
A["bubble"] = verb(y, 0.5, 0.3)
y = blank(0.4); place(y, filt(noise(0.02), "bp", (800, 3000)) * env(0.02, 0.001, 0.006), 0, 0.8); place(y, sweep(500, 1500, 0.05) * env(0.05, 0.001, 0.02), 0, 0.4)
A["pop"] = y
y = blank(1.2)
for i in range(18):
    place(y, filt(noise(0.03), "bp", (300, 2500)) * env(0.03, 0.001, 0.012), i * 0.055, 0.6)
    place(y, thud(120, 80, 0.03), i * 0.055, 0.3)
A["jackhammer"] = y
y = blank(1.6)
for i in range(3): place(y, filt(tone(1050, 0.28, "square"), "lp", 2500) * adsr(0.28, 0.005, 0.1, 0.8, 0.03), i * 0.5, 0.4)
A["reverse"] = verb(y, 0.8, 0.4)
A["clank"] = S["clank"]
d = 1.8; t = tt(d)
A["gust"] = filt(noise(d), "bp", (250, 1400)) * np.sin(np.pi * t / d) ** 2 * 0.6
A["bird"] = verb(chirps([(3200, 4800), (3000, 5200), (3400, 4600), (2800, 5400)], 0.07, 0.04), 0.5, 0.2)
y = blank(0.6); place(y, sweep(2400, 300, 0.25, "saw") * env(0.25, 0.002, 0.1) * 0.4, 0); place(y, sweep(1800, 600, 0.2, "square") * env(0.2, 0.002, 0.08) * 0.2, 0.15)
A["zap"] = filt(y, "lp", 5000)
y = blank(0.8)
for i, f in enumerate((660, 880, 990, 1320)): place(y, tone(f, 0.07, "square") * env(0.07, 0.002, 0.03) * 0.3, i * 0.09)
A["blip"] = y
y = blank(1.0); place(y, filt(noise(0.05), "hp", 2500) * env(0.05, 0.0005, 0.01), 0, 0.9)
for i in range(5): place(y, filt(noise(0.03), "bp", (1500, 6000)) * env(0.03, 0.001, 0.01), 0.04 + i * 0.05, 0.4)
place(y, thud(80, 40, 0.4), 0.02, 0.4)
A["crack"] = verb(y, 1.0, 0.45)
d = 2.0; t = tt(d)
A["howl"] = filt(noise(d), "bp", (400, 900)) * np.sin(np.pi * t / d) ** 2 * (1 + 0.6 * np.sin(2 * np.pi * 0.7 * t)) * 0.5
A["creak"] = S["creak"]
y = blank(0.9)
for at in (0, 0.35): place(y, filt(sweep(720, 520, 0.22, "saw") + filt(noise(0.22), "bp", (800, 2200)) * 0.6, "bp", (500, 2500)) * env(0.22, 0.01, 0.1) * 0.5, at)
A["crow"] = verb(y, 0.8, 0.35)
y = blank(1.2)
for i, at in enumerate((0, 0.4)): place(y, filt(tone(380 - i * 20, 0.32, "tri"), "lp", 900) * adsr(0.32, 0.05, 0.15, 0.6, 0.12), at, 0.5)
A["owl"] = verb(y, 1.0, 0.45)
y = blank(0.9)
for i in range(3): place(y, filt(np.sign(np.sin(2 * np.pi * 95 * tt(0.16))), "bp", (150, 900)) * env(0.16, 0.01, 0.06), i * 0.22, 0.5)
A["frog"] = verb(y, 0.6, 0.3)
d = 2.6; t = tt(d)
f = 180 + 120 * np.sin(np.pi * t / d) + 30 * np.sin(2 * np.pi * 1.3 * t)
A["whale"] = verb(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2 * 0.5, 1.6, 0.6)
y = blank(1.2)
for i in range(4):
    place(y, filt(noise(0.01), "bp", (2000, 6000)) * env(0.01, 0.0005, 0.004), i * 0.3, 0.5)
    place(y, bell(2200 if i % 2 else 1800, 0.05, 0.5), i * 0.3, 0.2)
A["tick"] = y
d = 1.0; t = tt(d)
A["steam"] = filt(noise(d), "hp", 2500) * adsr(d, 0.03, 0.3, 0.6, 0.4) * 0.5
y = bell(523, 1.8, 1.1) * 0.6; place(y, bell(784, 1.4, 0.8), 0, 0.3)
A["bell"] = verb(y, 1.2, 0.45)
d = 1.8; t = tt(d)
A["ghost"] = verb(np.sin(2 * np.pi * (420 + 60 * np.sin(2 * np.pi * 0.8 * t) + 25 * np.sin(2 * np.pi * 5 * t)) * t) * np.sin(np.pi * t / d) ** 2 * 0.35, 1.4, 0.55)
A["bat"] = verb(chirps([(5200, 7800), (5600, 8200), (5000, 7600)], 0.03, 0.04, 0.4), 0.4, 0.2)
y = blank(1.2)
for i, f in enumerate((1200, 1600, 900, 2000)): place(y, tone(f, 0.06, "square") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
place(y, filt(noise(0.5), "bp", (1500, 5000)) * env(0.5, 0.01, 0.2) * 0.12, 0.5)
A["radio"] = y
y = blank(1.4); place(y, thud(120, 60, 0.2), 0, 0.6); place(y, filt(noise(1.1), "bp", (1500, 7000)) * adsr(1.1, 0.02, 0.4, 0.4, 0.4) * 0.5, 0.1)
A["airlock"] = y
for k, v in A.items(): S["amb_" + k] = v

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("amb_gust", "amb_howl") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
