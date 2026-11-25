"""Tumble Truck sound effects, synthesised from scratch (numpy + scipy; no samples, all original): coins, gems, fuel
glugs, hearts, power-ups (nitro, cargo net, bubble wrap, magnet), heavy monster-truck landings and knocks, the crash,
checkpoints, the delivery fanfare and its stars, the countdown, cargo sounds (a wooden knock, a load falling out, glass
shattering, a shell cracking), water splashes, mud squelches, bridge creaks, the truck's air horn, fuel warnings, menu
sounds, animals that take fright (wing flaps, a rustle in the bushes) and the worlds' ambience (songbirds, an owl, a
frog, crickets, a gust, a stream, bees, a hen, a sheep, a hawk, wind chimes, a village bell, a sawmill, bubbling lava,
radio beeps, a crow, a duck). The music is composed live in the game (src/haul/music.ts), so there are no music files.

usage: python scripts/gen_haul_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_haul_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
    """a two-operator FM tone (bright, bell-ish or woody)"""
    t = tt(d)
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / (dec * 0.6))
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / dec)


def bell(f, d, bright=1.0):
    t = tt(d)
    parts = [(1, 1, d * 0.6), (2.76, 0.5 * bright, d * 0.25), (5.4, 0.3 * bright, d * 0.12), (8.9, 0.15 * bright, d * 0.06)]
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / dec) for r, a, dec in parts)


def marimba(m, d=0.35): return fm(mtof(m), d, 4.0, 1.4, d * 0.4) * np.minimum(1, tt(d) / 0.002)


def brass(m, d, bright=2600):
    f = mtof(m)
    y = sweep(f * 0.99, f, d, "saw", "lin") * 0.6 + sweep(f * 1.005, f * 1.005, d, "saw", "lin") * 0.4
    return filt(y, "lp", bright) * adsr(d, 0.03, 0.2, 0.7, 0.12)


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
    tmp = os.path.join(tempfile.gettempdir(), f"haul_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_haul_{name}.mp3")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", dst], check=True)
    os.remove(tmp)
    print("sfx", name, round(len(y) / SR, 2), "s", flush=True)


S = {}

# ---------------------------------------------------------------- pickups
y = blank(0.4); place(y, marimba(88, 0.25), 0, 0.7); place(y, marimba(95, 0.3), 0.05, 0.7)
place(y, filt(noise(0.04), "hp", 7500) * env(0.04, 0.001, 0.01) * 0.15, 0)
S["coin"] = y
y = blank(0.6)
for i, m in enumerate((86, 90, 93, 98)): place(y, marimba(m, 0.35), i * 0.05, 0.6)
S["coinBig"] = verb(y, 0.45, 0.2)
y = blank(1.1)
for i, m in enumerate((84, 91, 96, 100, 103, 108)): place(y, bell(mtof(m), 0.7, 1.5), i * 0.055, 0.38)
place(y, sweep(1500, 5000, 0.4) * env(0.4, 0.01, 0.15) * 0.1, 0.02)
S["gem"] = verb(y, 0.8, 0.3)
# fuel: a can glugging into the tank, the cap clunks, a rising "full" tone
y = blank(1.0)
for i in range(5):
    f = 140 + i * 30
    place(y, filt(sweep(f, f * 2.6, 0.08) * env(0.08, 0.002, 0.035), "lp", 1800), 0.02 + i * 0.085, 0.6)
place(y, thud(300, 150, 0.06), 0.46, 0.5)
place(y, sweep(420, 1100, 0.32, "tri") * env(0.32, 0.02, 0.14) * 0.35, 0.5)
place(y, marimba(96, 0.4), 0.7, 0.4)
S["fuel"] = y
y = blank(0.9)
place(y, filt(noise(0.3), "bp", (500, 2500)) * env(0.3, 0.08, 0.08) * 0.25, 0)
for m in (72, 76, 79, 84): place(y, fm(mtof(m), 0.7, 1.0, 0.8, 0.35) * 0.35, 0.08)
S["heart"] = verb(y, 0.5, 0.22)
y = blank(0.8)
place(y, filt(sweep(250, 1600, 0.45, "saw"), "lp", 3200) * env(0.45, 0.02, 0.2) * 0.4, 0)
for i, m in enumerate((79, 84, 88, 91)): place(y, bell(mtof(m), 0.4, 1.0), 0.16 + i * 0.05, 0.25)
S["power"] = verb(y, 0.5, 0.25)
d = 1.3; t = tt(d)
roar = filt(noise(d), "bp", (250, 2200)) * np.minimum(1, t / 0.08) * np.exp(-np.maximum(0, t - 0.5) / 0.35)
S["nitro"] = filt(roar + sweep(120, 900, d, "saw") * 0.18 * env(d, 0.03, 0.5), "lp", 6000)
place(S["nitro"], thud(80, 35, 0.35), 0, 0.6)
# the cargo net: a rope whip and a snap
y = blank(0.6)
place(y, filt(noise(0.2), "bp", (1200, 5000)) * np.sin(np.pi * tt(0.2) / 0.2) ** 2 * 0.5, 0)
place(y, filt(noise(0.03), "hp", 2000) * env(0.03, 0.001, 0.01), 0.2, 0.8)
place(y, sweep(600, 300, 0.12, "tri") * env(0.12, 0.002, 0.05) * 0.4, 0.2)
S["net"] = y
# bubble wrap: pops climbing up
y = blank(0.8)
for i in range(7):
    at = 0.04 + i * 0.08 + RNG.random() * 0.02
    place(y, filt(noise(0.012), "bp", (1500 + i * 300, 5000)) * env(0.012, 0.0005, 0.004), at, 0.8)
    place(y, sweep(800 + i * 150, 1400 + i * 150, 0.05) * env(0.05, 0.001, 0.02) * 0.3, at)
S["bubble"] = y
d = 0.8; t = tt(d)
y = np.sin(2 * np.pi * 120 * t + 3 * np.sin(2 * np.pi * 8 * t)) * adsr(d, 0.03, 0.3, 0.5, 0.25) * 0.5
place(y, bell(1800, 0.4, 1.5), 0.05, 0.25)
S["magnet"] = y

# ---------------------------------------------------------------- the truck
y = blank(0.45); place(y, thud(95, 38, 0.35), 0, 1.0); place(y, filt(noise(0.1), "lp", 700) * env(0.1, 0.001, 0.04), 0, 0.5)
place(y, sweep(180, 120, 0.25, "tri") * env(0.25, 0.01, 0.1) * 0.12, 0.03)
S["land"] = y
y = blank(0.9); place(y, thud(80, 30, 0.5), 0, 1.0); place(y, filt(noise(0.25), "lp", 1200) * env(0.25, 0.001, 0.08), 0, 0.7)
for i in range(5): place(y, bell(520 + i * 260, 0.14, 2.2), 0.03 + i * 0.045, 0.1)
d = 0.5; t = tt(d); place(y, np.sin(2 * np.pi * (140 + 60 * np.sin(2 * np.pi * 9 * t)) * t) * env(d, 0.005, 0.15) * 0.25, 0.05)
S["landHard"] = y
y = blank(0.25); place(y, thud(140, 60, 0.16), 0, 0.8); place(y, filt(noise(0.03), "bp", (500, 2200)) * env(0.03, 0.001, 0.01), 0, 0.4)
S["bump"] = y
y = blank(1.6)
place(y, filt(noise(0.6), "lp", 2200) * env(0.6, 0.002, 0.16), 0, 1.0)
place(y, thud(75, 28, 0.55), 0, 1.0)
for i, f in enumerate((280, 470, 690, 1020, 1380)): place(y, bell(f, 0.5, 2.0), 0.01 + i * 0.03, 0.15)
place(y, thud(120, 50, 0.22), 0.38, 0.5)
for i in range(8): place(y, filt(noise(0.025), "bp", (2500, 8000)) * env(0.025, 0.001, 0.008), 0.42 + i * 0.06 + RNG.random() * 0.03, 0.22)
S["crash"] = verb(y, 0.6, 0.2)
# the air horn: two brassy tones
y = blank(0.9)
for f in (311, 392):
    place(y, filt(sweep(f * 0.97, f, 0.7, "saw", "lin"), "lp", 2200) * adsr(0.7, 0.03, 0.2, 0.85, 0.1) * 0.35, 0)
S["horn"] = verb(y, 0.7, 0.3)

# ---------------------------------------------------------------- stages
y = blank(1.0); place(y, filt(noise(0.3), "bp", (700, 3800)) * env(0.3, 0.05, 0.08) * 0.3, 0)
place(y, bell(mtof(88), 0.6), 0.08, 0.5); place(y, bell(mtof(93), 0.7), 0.2, 0.5)
S["checkpoint"] = verb(y, 0.6, 0.25)
# the delivery: a horn-section fanfare, bells, a cymbal swell and a little cheer of whistles
y = blank(3.0)
for i, (m, at, dd) in enumerate(((65, 0, 0.16), (69, 0.16, 0.16), (72, 0.32, 0.16), (77, 0.48, 1.3))):
    place(y, brass(m, dd + 0.1), at, 0.5); place(y, brass(m - 12, dd + 0.1), at, 0.25)
for m in (84, 89, 93, 96): place(y, bell(mtof(m), 1.4), 0.5, 0.16)
place(y, filt(noise(1.7), "hp", 5000) * adsr(1.7, 0.4, 0.5, 0.4, 0.6) * 0.22, 0.3)
for i in range(4): place(y, sweep(1800 + i * 200, 2600 + i * 250, 0.25) * env(0.25, 0.02, 0.1) * 0.12, 0.6 + i * 0.12)
S["deliver"] = verb(y, 1.0, 0.3)
y = blank(0.7)
place(y, bell(mtof(96), 0.5, 1.4), 0, 0.5); place(y, bell(mtof(103), 0.6, 1.4), 0.04, 0.4)
place(y, filt(noise(0.2), "hp", 6000) * env(0.2, 0.002, 0.07) * 0.2, 0)
S["star"] = verb(y, 0.6, 0.3)
y = blank(0.9); place(y, brass(77, 0.45, 3600), 0, 0.7); place(y, brass(65, 0.45, 3600), 0, 0.5); place(y, thud(140, 50, 0.2), 0, 0.6)
place(y, filt(noise(0.4), "bp", (500, 3000)) * env(0.4, 0.05, 0.12) * 0.25, 0.05)
S["go"] = verb(y, 0.6, 0.2)
S["beep"] = filt(sweep(784, 784, 0.18, "tri", "lin") + 0.3 * sweep(1568, 1568, 0.18, "square", "lin"), "lp", 3500) * adsr(0.18, 0.005, 0.1, 0.6, 0.05) * 0.6

# ---------------------------------------------------------------- the load
# a wooden knock (cargo against the bed)
y = blank(0.3); place(y, fm(260, 0.18, 1.5, 3.0, 0.05), 0, 0.7); place(y, filt(noise(0.02), "bp", (800, 3000)) * env(0.02, 0.0005, 0.006), 0, 0.5)
S["thud"] = y
# a piece falling out: a comic slide whistle down, then a thump
y = blank(1.0); place(y, sweep(1400, 380, 0.5, "sine") * adsr(0.5, 0.02, 0.3, 0.8, 0.05) * 0.35, 0)
place(y, thud(130, 55, 0.25), 0.55, 0.8); place(y, filt(noise(0.08), "lp", 1200) * env(0.08, 0.001, 0.03), 0.55, 0.4)
S["lost"] = y
# glass shattering
y = blank(1.2)
place(y, filt(noise(0.08), "hp", 2500) * env(0.08, 0.0005, 0.03), 0, 1.0)
for i in range(14):
    f = 2200 + RNG.random() * 5000
    place(y, bell(f, 0.25, 2.5), 0.01 + RNG.random() * 0.5, 0.06 + RNG.random() * 0.08)
place(y, filt(noise(0.5), "hp", 4000) * env(0.5, 0.005, 0.12) * 0.25, 0.02)
S["glass"] = verb(y, 0.5, 0.2)
# a shell / clay crack
y = blank(0.6)
for i in range(4): place(y, filt(noise(0.015), "bp", (900, 4500)) * env(0.015, 0.0005, 0.005), i * 0.018, 0.8)
place(y, thud(180, 80, 0.12), 0, 0.5)
for i in range(5): place(y, filt(noise(0.01), "bp", (2000, 6000)) * env(0.01, 0.0005, 0.004), 0.1 + i * 0.05 + RNG.random() * 0.02, 0.3)
S["crack"] = y

# ---------------------------------------------------------------- the road
y = blank(1.0)
place(y, filt(noise(0.5), "bp", (300, 4000)) * env(0.5, 0.005, 0.14), 0, 0.9)
place(y, thud(110, 45, 0.25), 0, 0.5)
for i in range(10): place(y, sweep(500 + RNG.random() * 900, 1200 + RNG.random() * 1500, 0.04) * env(0.04, 0.002, 0.015) * 0.2, 0.1 + RNG.random() * 0.6)
S["splash"] = verb(y, 0.5, 0.2)
d = 0.5; t = tt(d)
y = filt(noise(d), "lp", 600) * np.sin(np.pi * t / d) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t))
place(y, sweep(140, 90, 0.3, "tri") * env(0.3, 0.02, 0.1) * 0.3, 0.05)
S["mud"] = y
d = 0.7; t = tt(d)
creak = filt(sweep(180, 240, d, "saw", "lin") * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 38 * t))), "bp", (300, 2400))
S["creak"] = creak * np.sin(np.pi * t / d) * 0.6
y = blank(0.6)
for i, f in enumerate((988, 740, 988)): place(y, filt(sweep(f, f, 0.12, "square", "lin"), "lp", 2500) * adsr(0.12, 0.005, 0.05, 0.6, 0.03), i * 0.16, 0.45)
S["lowFuel"] = y
y = blank(1.4)
for i in range(5):
    a = 0.6 - i * 0.1
    place(y, filt(noise(0.1), "lp", 550 - i * 60) * env(0.1, 0.004, 0.04) * a, i * (0.16 + i * 0.04))
    place(y, thud(65, 38, 0.1) * a, i * (0.16 + i * 0.04))
S["sputter"] = y
y = blank(1.3)
for i, m in enumerate((70, 67, 62)): place(y, filt(sweep(mtof(m), mtof(m) * 0.97, 0.4, "saw"), "lp", 1500) * adsr(0.4, 0.02, 0.15, 0.5, 0.1) * 0.4, i * 0.25)
S["lifeLost"] = verb(y, 0.6, 0.2)
# the load failed: a wah-wah trombone
y = blank(1.8)
for i, m in enumerate((62, 61, 60)):
    d = 0.35; t = tt(d)
    place(y, filt(sweep(mtof(m), mtof(m), d, "saw", "lin"), "lp", 900 + 700 * np.mean(np.sin(np.pi * t / d))) * adsr(d, 0.03, 0.2, 0.7, 0.1) * 0.4, i * 0.32)
d = 0.8; t = tt(d)
place(y, filt(sweep(mtof(59), mtof(59) * 0.94, d, "saw"), "lp", 1100) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)) * adsr(d, 0.03, 0.3, 0.7, 0.2) * 0.45, 0.96)
S["fail"] = verb(y, 0.6, 0.2)
y = blank(3.6)
for at, ms in ((0, (60, 64, 67)), (0.3, (62, 65, 69)), (0.6, (64, 67, 72)), (0.9, (67, 72, 76))):
    for m in ms: place(y, brass(m, 0.9 if at == 0.9 else 0.32, 3000), at, 0.3)
for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100)): place(y, bell(mtof(m), 0.9), 1.0 + i * 0.07, 0.2)
place(y, filt(noise(2.0), "hp", 5000) * adsr(2.0, 0.6, 0.6, 0.4, 0.8) * 0.2, 0.8)
S["worldClear"] = verb(y, 1.2, 0.3)

# ---------------------------------------------------------------- menus
S["tap"] = fm(700, 0.06, 2.0, 1.5, 0.02) * 0.8
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, marimba(84, 0.3), 0.08, 0.5)
S["open"] = y
y = blank(1.0)
for i in range(6): place(y, filt(noise(0.012), "bp", (2000, 6000)) * env(0.012, 0.0005, 0.004), i * 0.045, 0.4)
for i, m in enumerate((79, 84, 88, 91)): place(y, marimba(m, 0.4), 0.28 + i * 0.06, 0.5)
S["upgrade"] = verb(y, 0.6, 0.2)
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, marimba(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.25)
S["buy"] = verb(y, 0.6, 0.25)
S["whoosh"] = filt(noise(0.6), "bp", (300, 2600)) * np.sin(np.pi * tt(0.6) / 0.6) ** 2 * 0.6

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


S["birdA"] = verb(chirps([(3600, 5200), (3600, 5200), (3600, 5200), (4200, 2800), (3000, 4600)], 0.06, 0.035), 0.5, 0.2)
d = 1.0; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * np.cumsum(2600 + 500 * np.sin(2 * np.pi * 14 * t) + 800 * (t / d)) / SR) * adsr(d, 0.04, 0.3, 0.55, 0.2) * 0.4, 0.5, 0.25)
y = blank(1.3)
for at, f in ((0, 330), (0.32, 320), (0.6, 310)): place(y, filt(sweep(f, f * 0.92, 0.28, "tri"), "lp", 800) * adsr(0.28, 0.04, 0.12, 0.6, 0.1), at, 0.5)
S["owl"] = verb(y, 1.0, 0.45)
y = blank(0.8)
for at in (0, 0.22):
    d = 0.16; t = tt(d)
    croak = filt(np.sign(np.sin(2 * np.pi * (85 + 40 * t / d) * t)), "bp", (200, 1200)) * env(d, 0.005, 0.07)
    place(y, croak, at, 0.6)
S["frog"] = verb(y, 0.6, 0.3)
y = blank(1.2)
for k in range(4):
    for i in range(3): place(y, sweep(4300, 4300, 0.02, "sine", "lin") * env(0.02, 0.002, 0.008), k * 0.28 + i * 0.035, 0.4)
S["cricket"] = verb(y, 0.6, 0.3)
d = 2.0; t = tt(d)
S["gust"] = filt(noise(d), "bp", (220, 1300)) * np.sin(np.pi * t / d) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * t))
d = 2.0; t = tt(d)
stream = filt(noise(d), "bp", (500, 3500)) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 3.1 * t) * np.sin(2 * np.pi * 1.7 * t + 1)))
for i in range(12): place(stream, sweep(700 + RNG.random() * 900, 1400 + RNG.random() * 900, 0.03) * env(0.03, 0.002, 0.012) * 0.25, RNG.random() * 1.9)
S["stream"] = stream * np.sin(np.pi * t / d)
d = 1.4; t = tt(d)
S["bees"] = filt(sweep(210, 230, d, "saw", "lin") * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t)), "bp", (200, 2500)) * np.sin(np.pi * t / d) * 0.6
y = blank(1.1)
for at, f, dd in ((0, 520, 0.07), (0.14, 560, 0.07), (0.3, 480, 0.06), (0.45, 640, 0.2)):
    place(y, filt(sweep(f, f * 0.8, dd, "saw"), "bp", (500, 2800)) * env(dd, 0.004, dd * 0.6), at, 0.5)
S["hen"] = verb(y, 0.5, 0.25)
d = 0.9; t = tt(d)
baa = sweep(330, 300, d, "saw") * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * t))
S["sheep"] = verb(filt(baa, "bp", (500, 2400)) * adsr(d, 0.05, 0.3, 0.6, 0.2) * 0.5, 0.6, 0.3)
y = sweep(3200, 1700, 0.9) * env(0.9, 0.02, 0.35) * 0.5 + filt(noise(0.9), "bp", (2000, 4000)) * env(0.9, 0.02, 0.3) * 0.12
S["hawk"] = verb(y, 0.9, 0.35)
y = blank(1.8)
for i in range(6): place(y, bell(mtof(84 + [0, 3, 7, 10, 12, 15][int(RNG.random() * 6)]), 0.9, 1.3), i * 0.17 + RNG.random() * 0.05, 0.22)
S["chime"] = verb(y, 1.0, 0.4)
y = bell(mtof(55), 2.4, 1.2) * 0.6; place(y, bell(mtof(67), 1.6, 1.0), 0, 0.2)
S["bell"] = verb(y, 1.4, 0.4)
d = 1.6; t = tt(d)
saw = filt(sweep(900, 1050, d, "saw", "lin") * (0.7 + 0.3 * np.sin(2 * np.pi * 22 * t)), "bp", (600, 4000)) * np.sin(np.pi * t / d)
S["saw"] = saw * 0.5
y = blank(1.2)
for i in range(5): place(y, sweep(120 + RNG.random() * 60, 260 + RNG.random() * 120, 0.09) * env(0.09, 0.005, 0.04), i * 0.2 + RNG.random() * 0.06, 0.6)
place(y, filt(noise(1.2), "lp", 120) * 1.5 * np.sin(np.pi * tt(1.2) / 1.2), 0)
S["lava"] = y
y = blank(1.2)
for i, f in enumerate((1500, 1100, 1800, 900)): place(y, sweep(f, f, 0.06, "square", "lin") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
place(y, filt(noise(0.5), "bp", (1500, 5000)) * env(0.5, 0.01, 0.2) * 0.12, 0.5)
S["radio"] = y
y = blank(0.9)
for at in (0, 0.33): place(y, filt(sweep(680, 500, 0.22, "saw") + filt(noise(0.22), "bp", (800, 2200)) * 0.6, "bp", (500, 2500)) * env(0.22, 0.01, 0.1) * 0.5, at)
S["crow"] = verb(y, 0.8, 0.35)
y = blank(0.7)
for at in (0, 0.2):
    d = 0.14; t = tt(d)
    q = filt(sweep(620, 520, d, "saw") * (0.6 + 0.4 * np.sin(2 * np.pi * 40 * t)), "bp", (700, 2600)) * env(d, 0.005, 0.07)
    place(y, q, at, 0.6)
S["duck"] = verb(y, 0.5, 0.25)

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("gust", "lava", "stream") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
