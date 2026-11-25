"""Rumble Rally sound effects, synthesised from scratch (numpy + scipy; no samples, all original): coins, gems, oil
glugs, hearts, power-ups (shield, magnet, a rocket pack, nitro), rocket launches and blasts, a rocket hit, metal rams
and a shield deflecting a hit, heavy monster-truck landings, the crash, checkpoints, overtakes, start-light beeps and
GO, the chequered flag, a win fanfare, a podium fanfare, a race lost, fuel warnings, the trucks' air horn, a grandstand
crowd and its cheer, menu sounds, animals that take fright, and the worlds' ambience (a gust, gulls, a crow,
songbirds, a parrot, surf, machines, a ship's horn, cave drips, thunder, wind chimes, radio beeps, bubbling lava, a
mine bell). The music is composed live in the game (src/rumble/music.ts), so there are no music files.

usage: python scripts/gen_rumble_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_rumble_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
def blank(d): return np.zeros(n_(d))


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


def filt(y, kind, f, order=2):
    if kind == "bp":
        lo, hi = f
        sos = butter(order, [max(20, lo), min(SR / 2 - 100, hi)], btype="band", fs=SR, output="sos")
    else:
        sos = butter(order, min(SR / 2 - 100, max(20, f)), btype="low" if kind == "lp" else "high", fs=SR, output="sos")
    return sosfilt(sos, y)


def fm(f, d, ratio=2.0, index=2.0, dec=0.3):
    t = tt(d)
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / (dec * 0.6))
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / dec)


def bell(f, d, bright=1.0):
    t = tt(d)
    parts = [(1, 1, d * 0.6), (2.76, 0.5 * bright, d * 0.25), (5.4, 0.3 * bright, d * 0.12), (8.9, 0.15 * bright, d * 0.06)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec) for r, a, dec in parts)


def metal(f, d):
    """an inharmonic metal clang"""
    t = tt(d)
    return sum(a * np.sin(2 * np.pi * f * r * t + RNG.random() * 6) * np.exp(-t / (d * k)) for r, a, k in ((1, 1, 0.5), (1.47, 0.7, 0.35), (2.09, 0.5, 0.25), (2.83, 0.4, 0.18), (3.71, 0.3, 0.12)))


def pluck(m, d=0.35): return fm(mtof(m), d, 3.0, 1.2, d * 0.45) * np.minimum(1, tt(d) / 0.002)


def brass(m, d, bright=2800):
    f = mtof(m)
    y = sweep(f * 0.985, f, d, "saw", "lin") * 0.55 + sweep(f * 1.006, f * 1.006, d, "saw", "lin") * 0.45
    return filt(y, "lp", bright) * adsr(d, 0.025, 0.2, 0.72, 0.12)


def synth(m, d, cut=3200):
    f = mtof(m)
    y = sweep(f, f, d, "square", "lin") * 0.4 + sweep(f * 1.01, f * 1.01, d, "saw", "lin") * 0.6
    return filt(y, "lp", cut) * adsr(d, 0.01, 0.15, 0.6, 0.08)


def thud(f0=110, f1=40, d=0.3): return sweep(f0, f1, d) * env(d, 0.002, d * 0.35)


def place(y, x, at, g=1.0):
    o = int(at * SR)
    if o >= len(y): return y
    k = min(len(x), len(y) - o)
    y[o:o + k] += x[:k] * g
    return y


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
    tmp = os.path.join(tempfile.gettempdir(), f"rumble_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_rumble_{name}.mp3")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", dst], check=True)
    os.remove(tmp)
    print("sfx", name, round(len(y) / SR, 2), "s", flush=True)


def crowd(d, roar=0.5):
    """a grandstand: many voices as band-passed noise, swelling and murmuring"""
    t = tt(d)
    y = np.zeros(n_(d))
    for k in range(7):
        lo = 300 + k * 160
        band = filt(noise(d), "bp", (lo, lo * 2.4))
        y += band * (0.55 + 0.45 * np.sin(2 * np.pi * (0.7 + k * 0.37) * t + RNG.random() * 6)) / 7
    return y * (0.6 + roar * 0.4)


S = {}

# ---------------------------------------------------------------- pickups
y = blank(0.35); place(y, pluck(88, 0.22), 0, 0.7); place(y, pluck(96, 0.28), 0.045, 0.7)
place(y, filt(noise(0.03), "hp", 8000) * env(0.03, 0.001, 0.008) * 0.15, 0)
S["coin"] = y
y = blank(0.6)
for i, m in enumerate((84, 88, 91, 96, 100)): place(y, pluck(m, 0.3), i * 0.04, 0.55)
S["coinBig"] = verb(y, 0.4, 0.2)
y = blank(1.1)
for i, m in enumerate((86, 93, 98, 101, 105)): place(y, bell(mtof(m), 0.7, 1.6), i * 0.05, 0.36)
place(y, sweep(1800, 6000, 0.35) * env(0.35, 0.01, 0.12) * 0.1, 0.02)
S["gem"] = verb(y, 0.8, 0.3)
# oil: a can glugging into the tank, the cap, a rising "full" synth
y = blank(1.0)
for i in range(6):
    f = 120 + i * 26
    place(y, filt(sweep(f, f * 2.4, 0.07) * env(0.07, 0.002, 0.03), "lp", 1600), 0.02 + i * 0.07, 0.6)
place(y, metal(900, 0.12) * 0.25, 0.46)
place(y, filt(sweep(300, 1200, 0.3, "saw"), "lp", 2500) * env(0.3, 0.02, 0.12) * 0.3, 0.5)
S["fuel"] = y
y = blank(0.9)
place(y, filt(noise(0.3), "bp", (600, 2600)) * env(0.3, 0.08, 0.08) * 0.2, 0)
for m in (74, 78, 81, 86): place(y, fm(mtof(m), 0.7, 1.0, 0.8, 0.35) * 0.33, 0.07)
S["heart"] = verb(y, 0.5, 0.22)
y = blank(0.8)
place(y, filt(sweep(200, 1800, 0.4, "saw"), "lp", 3500) * env(0.4, 0.02, 0.18) * 0.4, 0)
for i, m in enumerate((81, 86, 90, 93)): place(y, bell(mtof(m), 0.4, 1.1), 0.14 + i * 0.045, 0.25)
S["power"] = verb(y, 0.5, 0.25)
# nitro: a jet roar that kicks in with a thump
d = 1.4; t = tt(d)
roar = filt(noise(d), "bp", (300, 3200)) * np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.6) / 0.35)
y = filt(roar + sweep(90, 1300, d, "saw") * 0.16 * env(d, 0.02, 0.5), "lp", 7000)
place(y, thud(90, 30, 0.35), 0, 0.7)
place(y, filt(noise(0.15), "hp", 3000) * env(0.15, 0.001, 0.05) * 0.4, 0)
S["nitro"] = y
# shield: a shimmering dome rising up
d = 1.0; t = tt(d)
y = np.zeros(n_(d))
for k, m in enumerate((72, 79, 84, 88)): y += np.sin(2 * np.pi * mtof(m) * t * (1 + 0.004 * np.sin(2 * np.pi * 6 * t + k))) * adsr(d, 0.15 + k * 0.05, 0.4, 0.4, 0.3) * 0.2
place(y, sweep(400, 2400, 0.5, "tri") * env(0.5, 0.02, 0.2) * 0.2, 0)
S["shield"] = verb(y, 0.8, 0.35)
d = 0.8; t = tt(d)
y = np.sin(2 * np.pi * 140 * t + 3 * np.sin(2 * np.pi * 9 * t)) * adsr(d, 0.03, 0.3, 0.5, 0.25) * 0.5
place(y, bell(2000, 0.4, 1.5), 0.05, 0.25)
S["magnet"] = y
# rocket pack: a metal rack clacks, a ready beep
y = blank(0.7)
for i in range(3): place(y, metal(700 + i * 90, 0.1) * 0.35, i * 0.08)
place(y, thud(160, 80, 0.08), 0, 0.4)
place(y, sweep(1200, 1600, 0.12, "square") * env(0.12, 0.005, 0.05) * 0.2, 0.3)
place(y, sweep(1600, 1600, 0.16, "square", "lin") * env(0.16, 0.005, 0.07) * 0.2, 0.42)
S["rocketPick"] = y

# ---------------------------------------------------------------- rockets and rams
# launch: a hiss and a whoosh away with a thump at the pod
d = 0.9; t = tt(d)
hiss = filt(noise(d), "bp", (900, 6000)) * np.minimum(1, t / 0.01) * np.exp(-t / 0.35)
y = hiss * 0.7 + filt(sweep(300, 1500, d, "saw"), "lp", 4000) * env(d, 0.005, 0.25) * 0.2
place(y, thud(150, 50, 0.15), 0, 0.8)
S["launch"] = y
# blast: a deep boom, a roar of fire and debris
d = 2.0; t = tt(d)
y = thud(95, 24, 0.9) * 1.2
place(y, filt(noise(1.4), "lp", 1400) * env(1.4, 0.003, 0.35), 0, 1.1)
place(y, filt(noise(0.08), "hp", 1500) * env(0.08, 0.0005, 0.02), 0, 0.8)
for i in range(16): place(y, filt(noise(0.02), "bp", (1500, 7000)) * env(0.02, 0.0005, 0.007), 0.15 + RNG.random() * 0.9, 0.08 + RNG.random() * 0.12)
S["blast"] = verb(y, 1.0, 0.25)
# hit: a metal slam inside a blast
y = blank(1.3)
place(y, metal(420, 0.6) * 0.5, 0)
place(y, thud(120, 35, 0.45), 0, 1.0)
place(y, filt(noise(0.7), "lp", 2000) * env(0.7, 0.002, 0.2), 0, 0.8)
place(y, sweep(900, 250, 0.5, "saw") * env(0.5, 0.01, 0.15) * 0.15, 0.04)
S["hit"] = verb(y, 0.7, 0.2)
# ram: steel on steel and a crunch
y = blank(0.9)
place(y, thud(100, 40, 0.35), 0, 1.0)
place(y, metal(310, 0.5) * 0.45, 0.005)
place(y, metal(530, 0.35) * 0.25, 0.02)
place(y, filt(noise(0.25), "bp", (600, 4500)) * env(0.25, 0.001, 0.06), 0, 0.7)
for i in range(5): place(y, filt(noise(0.015), "bp", (2500, 8000)) * env(0.015, 0.0005, 0.005), 0.08 + i * 0.04 + RNG.random() * 0.02, 0.25)
S["ram"] = verb(y, 0.5, 0.15)
# shield hit: a zap and a ringing dome
y = blank(1.0)
d = 0.3; t = tt(d)
place(y, filt(np.sign(np.sin(2 * np.pi * (900 + 600 * np.sin(2 * np.pi * 50 * t)) * t)), "bp", (800, 6000)) * env(d, 0.002, 0.08) * 0.4, 0)
for m in (84, 91, 96): place(y, bell(mtof(m), 0.8, 1.3), 0.02, 0.22)
S["shieldHit"] = verb(y, 0.7, 0.3)

# ---------------------------------------------------------------- the trucks
y = blank(0.45); place(y, thud(90, 36, 0.35), 0, 1.0); place(y, filt(noise(0.1), "lp", 800) * env(0.1, 0.001, 0.04), 0, 0.5)
place(y, metal(240, 0.25) * 0.08, 0.01)
S["land"] = y
y = blank(0.9); place(y, thud(75, 28, 0.5), 0, 1.0); place(y, filt(noise(0.25), "lp", 1300) * env(0.25, 0.001, 0.08), 0, 0.7)
place(y, metal(330, 0.5) * 0.18, 0.02)
d = 0.5; t = tt(d); place(y, np.sin(2 * np.pi * (130 + 50 * np.sin(2 * np.pi * 9 * t)) * t) * env(d, 0.005, 0.15) * 0.25, 0.05)
S["landHard"] = y
y = blank(1.7)
place(y, filt(noise(0.6), "lp", 2400) * env(0.6, 0.002, 0.16), 0, 1.0)
place(y, thud(70, 26, 0.6), 0, 1.0)
for i, f in enumerate((260, 430, 650, 980)): place(y, metal(f, 0.5), 0.01 + i * 0.04, 0.12)
place(y, thud(110, 45, 0.22), 0.4, 0.5)
for i in range(9): place(y, filt(noise(0.025), "bp", (2500, 8000)) * env(0.025, 0.001, 0.008), 0.45 + i * 0.06 + RNG.random() * 0.03, 0.2)
S["crash"] = verb(y, 0.6, 0.2)
# air horn: a three-tone monster truck horn
y = blank(1.0)
for f in (233, 294, 349):
    place(y, filt(sweep(f * 0.97, f, 0.75, "saw", "lin"), "lp", 2400) * adsr(0.75, 0.03, 0.2, 0.85, 0.1) * 0.3, 0)
S["horn"] = verb(y, 0.7, 0.3)

# ---------------------------------------------------------------- the race
# start lights: a low beep per light, GO: a high long beep over a crowd roar
S["light"] = filt(sweep(587, 587, 0.22, "square", "lin") * 0.5 + sweep(587, 587, 0.22, "sine", "lin"), "lp", 3000) * adsr(0.22, 0.004, 0.1, 0.7, 0.04) * 0.6
y = blank(1.6)
place(y, filt(sweep(1175, 1175, 0.55, "square", "lin") * 0.4 + sweep(1175, 1175, 0.55, "sine", "lin"), "lp", 4000) * adsr(0.55, 0.004, 0.2, 0.75, 0.1) * 0.55, 0)
place(y, crowd(1.4, 1.0) * np.sin(np.pi * tt(1.4) / 1.4) * 0.5, 0.05)
place(y, thud(120, 45, 0.25), 0, 0.5)
S["go"] = y
y = blank(1.0); place(y, filt(noise(0.25), "bp", (800, 4000)) * env(0.25, 0.04, 0.08) * 0.3, 0)
place(y, bell(mtof(86), 0.6), 0.06, 0.5); place(y, bell(mtof(93), 0.7), 0.18, 0.5)
S["checkpoint"] = verb(y, 0.6, 0.25)
y = blank(0.8)
place(y, filt(noise(0.4), "bp", (400, 3000)) * np.sin(np.pi * tt(0.4) / 0.4) ** 2 * 0.5, 0)
place(y, synth(79, 0.12), 0.18, 0.4); place(y, synth(86, 0.25), 0.3, 0.45)
S["overtake"] = verb(y, 0.5, 0.2)
y = blank(0.8)
place(y, filt(noise(0.45), "bp", (300, 2400)) * np.sin(np.pi * tt(0.45) / 0.45) ** 2 * 0.5, 0)
place(y, synth(74, 0.14, 2200), 0.2, 0.3); place(y, synth(69, 0.3, 2200), 0.34, 0.3)
S["passed"] = y
# chequered flag: a horn blast, the crowd erupts
y = blank(2.4)
place(y, crowd(2.2, 1.0) * adsr(2.2, 0.15, 0.8, 0.6, 0.8), 0.05, 0.7)
for f in (262, 330, 392): place(y, filt(sweep(f, f, 0.6, "saw", "lin"), "lp", 2600) * adsr(0.6, 0.02, 0.2, 0.8, 0.1) * 0.25, 0)
place(y, thud(110, 40, 0.3), 0, 0.6)
S["finish"] = verb(y, 0.8, 0.25)
# the win: a big brass and synth fanfare
y = blank(3.2)
for m, at, dd in ((67, 0, 0.14), (67, 0.14, 0.14), (67, 0.28, 0.14), (72, 0.42, 0.5), (71, 0.95, 0.18), (72, 1.14, 0.18), (76, 1.33, 1.2)):
    place(y, brass(m, dd + 0.08), at, 0.45); place(y, brass(m - 12, dd + 0.08), at, 0.22); place(y, synth(m + 12, dd + 0.05, 4500), at, 0.08)
for m in (84, 88, 91, 96): place(y, bell(mtof(m), 1.4), 1.35, 0.15)
place(y, filt(noise(1.8), "hp", 5000) * adsr(1.8, 0.3, 0.5, 0.4, 0.6) * 0.2, 1.3)
S["win"] = verb(y, 1.0, 0.3)
y = blank(2.2)
for m, at, dd in ((65, 0, 0.16), (69, 0.16, 0.16), (72, 0.32, 0.9)):
    place(y, brass(m, dd + 0.08), at, 0.45); place(y, brass(m - 12, dd + 0.08), at, 0.2)
for m in (84, 88, 91): place(y, bell(mtof(m), 1.0), 0.34, 0.14)
S["podium"] = verb(y, 0.9, 0.3)
y = blank(1.8)
for i, m in enumerate((67, 63, 60)): place(y, synth(m, 0.32, 1800), i * 0.28, 0.45)
d = 0.8; t = tt(d)
place(y, filt(sweep(mtof(55), mtof(55) * 0.92, d, "saw"), "lp", 1100) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)) * adsr(d, 0.03, 0.3, 0.7, 0.2) * 0.45, 0.86)
S["lose"] = verb(y, 0.6, 0.2)
y = blank(1.3)
for i, m in enumerate((72, 68, 63)): place(y, filt(sweep(mtof(m), mtof(m) * 0.97, 0.4, "saw"), "lp", 1500) * adsr(0.4, 0.02, 0.15, 0.5, 0.1) * 0.4, i * 0.24)
S["lifeLost"] = verb(y, 0.6, 0.2)
y = blank(0.6)
for i, f in enumerate((932, 698, 932)): place(y, filt(sweep(f, f, 0.12, "square", "lin"), "lp", 2500) * adsr(0.12, 0.005, 0.05, 0.6, 0.03), i * 0.16, 0.45)
S["lowFuel"] = y
y = blank(1.4)
for i in range(5):
    a = 0.6 - i * 0.1
    place(y, filt(noise(0.1), "lp", 550 - i * 60) * env(0.1, 0.004, 0.04) * a, i * (0.16 + i * 0.04))
    place(y, thud(65, 38, 0.1) * a, i * (0.16 + i * 0.04))
S["sputter"] = y
# the crowd: a murmuring grandstand, and a cheer with whistles
d = 2.4; S["crowd"] = crowd(d, 0.3) * np.sin(np.pi * tt(d) / d) ** 0.5
y = crowd(2.0, 1.0) * adsr(2.0, 0.12, 0.6, 0.7, 0.7)
for i in range(5): place(y, sweep(1700 + RNG.random() * 600, 2600 + RNG.random() * 700, 0.28) * env(0.28, 0.02, 0.12) * 0.12, 0.2 + RNG.random() * 1.2)
for i in range(10): place(y, filt(noise(0.03), "bp", (1500, 5000)) * env(0.03, 0.001, 0.01) * 0.2, 0.1 + RNG.random() * 1.6)
S["cheer"] = y
y = blank(3.8)
for at, ms in ((0, (60, 64, 67)), (0.28, (62, 65, 69)), (0.56, (64, 67, 72)), (0.84, (67, 72, 76))):
    for m in ms: place(y, brass(m, 1.0 if at == 0.84 else 0.3, 3000), at, 0.28)
for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100)): place(y, bell(mtof(m), 0.9), 0.95 + i * 0.07, 0.2)
place(y, crowd(2.6, 1.0) * adsr(2.6, 0.3, 0.6, 0.5, 0.9) * 0.4, 0.8)
S["worldClear"] = verb(y, 1.2, 0.3)

# ---------------------------------------------------------------- the track
y = blank(1.0)
place(y, filt(noise(0.5), "bp", (300, 4000)) * env(0.5, 0.005, 0.14), 0, 0.9)
place(y, thud(110, 45, 0.25), 0, 0.5)
for i in range(10): place(y, sweep(500 + RNG.random() * 900, 1200 + RNG.random() * 1500, 0.04) * env(0.04, 0.002, 0.015) * 0.2, 0.1 + RNG.random() * 0.6)
S["splash"] = verb(y, 0.5, 0.2)
d = 0.5; t = tt(d)
y = filt(noise(d), "lp", 600) * np.sin(np.pi * t / d) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t))
place(y, sweep(140, 90, 0.3, "tri") * env(0.3, 0.02, 0.1) * 0.3, 0.05)
S["mud"] = y
S["whoosh"] = filt(noise(0.6), "bp", (300, 2800)) * np.sin(np.pi * tt(0.6) / 0.6) ** 2 * 0.6

# ---------------------------------------------------------------- menus
S["tap"] = fm(760, 0.06, 2.0, 1.4, 0.02) * 0.8
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, pluck(86, 0.3), 0.08, 0.5)
S["open"] = y
y = blank(1.0)
for i in range(4): place(y, metal(800 + i * 120, 0.08) * 0.2, i * 0.06)
for i, m in enumerate((79, 84, 88, 91)): place(y, pluck(m, 0.4), 0.26 + i * 0.06, 0.5)
d = 0.4; t = tt(d); place(y, filt(sweep(80, 160, d, "saw"), "lp", 900) * env(d, 0.02, 0.2) * 0.4, 0.05)
S["upgrade"] = verb(y, 0.6, 0.2)
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, pluck(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.25)
S["buy"] = verb(y, 0.6, 0.25)

# ---------------------------------------------------------------- startled animals
y = blank(0.7)
for i in range(6): place(y, filt(noise(0.05), "bp", (300, 2200)) * np.sin(np.pi * tt(0.05) / 0.05) * (1 - i * 0.12), i * 0.085, 0.7)
S["flap"] = y
d = 0.7; t = tt(d)
S["rustle"] = filt(noise(d), "bp", (1500, 7000)) * np.sin(np.pi * t / d) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * t + RNG.random()))) * 0.6


# ---------------------------------------------------------------- ambience (played quietly, left or right)
def chirps(fs, d=0.07, gap=0.04, g=0.5):
    y = blank(len(fs) * (d + gap) + 0.2)
    for i, (f0, f1) in enumerate(fs): place(y, sweep(f0, f1, d) * env(d, 0.004, d * 0.4) * g, i * (d + gap))
    return y


d = 2.0; t = tt(d)
S["gust"] = filt(noise(d), "bp", (220, 1300)) * np.sin(np.pi * t / d) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * t))
y = blank(1.4)
for at, f in ((0, 1900), (0.32, 2100), (0.62, 1800)):
    d = 0.26; t = tt(d)
    place(y, filt(sweep(f, f * 0.65, d, "saw"), "bp", (900, 4200)) * env(d, 0.02, 0.1) * (0.7 + 0.3 * np.sin(2 * np.pi * 30 * t)), at, 0.4)
S["gull"] = verb(y, 0.8, 0.35)
y = blank(0.9)
for at in (0, 0.33): place(y, filt(sweep(680, 500, 0.22, "saw") + filt(noise(0.22), "bp", (800, 2200)) * 0.6, "bp", (500, 2500)) * env(0.22, 0.01, 0.1) * 0.5, at)
S["crow"] = verb(y, 0.8, 0.35)
S["birdA"] = verb(chirps([(3600, 5200), (3600, 5200), (3600, 5200), (4200, 2800), (3000, 4600)], 0.06, 0.035), 0.5, 0.2)
d = 1.0; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * np.cumsum(2600 + 500 * np.sin(2 * np.pi * 14 * t) + 800 * (t / d)) / SR) * adsr(d, 0.04, 0.3, 0.55, 0.2) * 0.4, 0.5, 0.25)
y = blank(0.9)
for at, f in ((0, 1300), (0.25, 1500)):
    d = 0.18; t = tt(d)
    place(y, filt(np.sign(np.sin(2 * np.pi * (f + 400 * np.sin(2 * np.pi * 18 * t)) * t)), "bp", (700, 4000)) * env(d, 0.005, 0.07) * 0.4, at)
S["parrot"] = verb(y, 0.6, 0.3)
d = 2.6; t = tt(d)
S["wave"] = filt(noise(d), "bp", (200, 3500)) * np.sin(np.pi * np.minimum(1, t / (d * 0.55))) ** 2 * np.exp(-np.maximum(0, t - d * 0.55) / 0.6) * 0.8
y = blank(1.6)
for i in range(4):
    place(y, metal(180 + (i % 2) * 70, 0.3) * 0.3, i * 0.36)
    place(y, thud(90, 50, 0.12), i * 0.36, 0.4)
place(y, filt(noise(1.6), "lp", 300) * 0.4, 0)
S["machine"] = y
d = 2.2; t = tt(d)
S["shiphorn"] = verb(filt(sweep(98, 96, d, "saw", "lin") * 0.6 + sweep(147, 145, d, "saw", "lin") * 0.4, "lp", 700) * adsr(d, 0.2, 0.5, 0.8, 0.6) * 0.6, 1.2, 0.45)
y = blank(1.6)
for i in range(4): place(y, sweep(1400 + RNG.random() * 900, 700 + RNG.random() * 300, 0.06) * env(0.06, 0.002, 0.02) * 0.4, i * 0.35 + RNG.random() * 0.1)
S["drip"] = verb(y, 1.2, 0.5)
d = 3.0; t = tt(d)
y = filt(noise(d), "lp", 220) * np.exp(-t / 1.1) * 2.2
place(y, filt(noise(0.12), "bp", (800, 5000)) * env(0.12, 0.001, 0.04) * 0.6, 0)
place(y, thud(70, 25, 1.2) * 0.8, 0.02)
S["thunder"] = verb(y, 1.6, 0.4)
y = blank(1.8)
for i in range(6): place(y, bell(mtof(84 + [0, 3, 7, 10, 12, 15][int(RNG.random() * 6)]), 0.9, 1.3), i * 0.17 + RNG.random() * 0.05, 0.22)
S["chime"] = verb(y, 1.0, 0.4)
y = blank(1.2)
for i, f in enumerate((1500, 1100, 1800, 900)): place(y, sweep(f, f, 0.06, "square", "lin") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
place(y, filt(noise(0.5), "bp", (1500, 5000)) * env(0.5, 0.01, 0.2) * 0.12, 0.5)
S["radio"] = y
y = blank(1.2)
for i in range(5): place(y, sweep(120 + RNG.random() * 60, 260 + RNG.random() * 120, 0.09) * env(0.09, 0.005, 0.04), i * 0.2 + RNG.random() * 0.06, 0.6)
place(y, filt(noise(1.2), "lp", 120) * 1.5 * np.sin(np.pi * tt(1.2) / 1.2), 0)
S["lava"] = y
y = bell(mtof(57), 2.2, 1.4) * 0.6; place(y, bell(mtof(69), 1.4, 1.0), 0, 0.2)
S["bell"] = verb(y, 1.2, 0.4)

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("gust", "lava", "wave", "crowd", "thunder", "machine") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
