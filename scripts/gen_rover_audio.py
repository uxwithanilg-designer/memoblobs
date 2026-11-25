"""Peak Rover sound effects, synthesised from scratch (numpy + scipy; no samples, all original): coins, gems, fuel,
hearts, power-ups (turbo, shield, magnet, feather), landings, bumps, the crash, checkpoints, the finish fanfare, the
countdown, flips, low-fuel warnings, the engine sputter, menu sounds, and the worlds' ambience (birds, a hawk, a loon,
an owl, frogs, crows, gulls, wind gusts, a distant city horn and siren, cave drips, a volcano rumble, radio beeps).
The music is composed live in the game (src/rover/music.ts), so there are no music files.

usage: python scripts/gen_rover_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_rover_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
RNG = np.random.default_rng(20261125)
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
    tmp = os.path.join(tempfile.gettempdir(), f"rover_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_rover_{name}.mp3")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "96k", "-ac", "1", dst], check=True)
    os.remove(tmp)
    print("sfx", name, round(len(y) / SR, 2), "s", flush=True)


# ---------------------------------------------------------------- the effects
S = {}

# coins: a bright two-note sparkle; the big coin adds a third; the gem is a glassy cascade
y = blank(0.45); place(y, chime(95, 0.3), 0, 0.6); place(y, chime(100, 0.4), 0.06, 0.7)
place(y, filt(noise(0.06), "hp", 7000) * env(0.06, 0.001, 0.015) * 0.2, 0)
S["coin"] = y
y = blank(0.7)
for i, m in enumerate((91, 96, 100, 103)): place(y, chime(m, 0.5), i * 0.045, 0.55)
place(y, filt(noise(0.2), "hp", 8000) * env(0.2, 0.002, 0.06) * 0.18, 0.05)
S["coinBig"] = verb(y, 0.5, 0.2)
y = blank(1.1)
for i, m in enumerate((88, 95, 100, 104, 107, 112)): place(y, bell(mtof(m), 0.7, 1.4), i * 0.05, 0.4)
place(y, sweep(1800, 5200, 0.4) * env(0.4, 0.01, 0.15) * 0.12, 0.02)
S["gem"] = verb(y, 0.8, 0.3)

# fuel: glugs into the tank, a cap click and a rising "full" tone
y = blank(0.9)
for i in range(4):
    f = 170 + i * 40
    place(y, sweep(f, f * 2.2, 0.07) * env(0.07, 0.002, 0.03), 0.02 + i * 0.09, 0.5)
place(y, filt(noise(0.02), "bp", (2000, 6000)) * env(0.02, 0.0005, 0.006), 0.4, 0.6)
place(y, sweep(500, 1200, 0.35, "tri") * env(0.35, 0.02, 0.15) * 0.35, 0.44)
place(y, chime(96, 0.4), 0.62, 0.35)
S["fuel"] = y

# heart: a warm major third over a heartbeat
y = blank(0.9)
place(y, thud(90, 50, 0.18), 0, 0.6); place(y, thud(80, 45, 0.18), 0.17, 0.45)
for m in (76, 80, 83): place(y, pluck(m, 0.7, 3500), 0.1, 0.35)
S["heart"] = verb(y, 0.5, 0.2)

# power-up: a magic rising sweep and a chime
y = blank(0.8)
place(y, filt(sweep(300, 1500, 0.45, "saw"), "lp", 3000) * env(0.45, 0.02, 0.2) * 0.4, 0)
for i, m in enumerate((84, 88, 91, 96)): place(y, chime(m, 0.4), 0.18 + i * 0.05, 0.3)
S["power"] = verb(y, 0.5, 0.25)

# turbo: a jet whoosh that rises into a roar
d = 1.2; t = tt(d)
roar = filt(noise(d), "bp", (300, 2400)) * np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - 0.4) / 0.35)
whoosh = sweep(200, 1600, d, "saw") * 0.15 * env(d, 0.05, 0.4)
S["turbo"] = filt(roar + whoosh, "lp", 5000)

# shield: a shimmering bubble
d = 0.9; t = tt(d)
y = sum(np.sin(2 * np.pi * (f + 6 * np.sin(2 * np.pi * 7 * t)) * t) for f in (660, 990, 1320)) * adsr(d, 0.04, 0.3, 0.4, 0.3) * 0.3
S["shield"] = verb(y, 0.7, 0.35)
y = blank(0.6); place(y, filt(noise(0.05), "hp", 3000) * env(0.05, 0.001, 0.015), 0, 0.7); place(y, sweep(2200, 500, 0.3) * env(0.3, 0.002, 0.1), 0.01, 0.4)
S["shieldPop"] = verb(y, 0.4, 0.2)

# magnet: a wobbling hum and a metallic clink
d = 0.8; t = tt(d)
y = np.sin(2 * np.pi * 140 * t + 3 * np.sin(2 * np.pi * 9 * t)) * adsr(d, 0.03, 0.3, 0.5, 0.25) * 0.5
place(y, bell(1900, 0.4, 1.6), 0.05, 0.25)
S["magnet"] = y

# feather: an airy rising whistle with soft chimes
y = blank(0.9); place(y, sweep(800, 2200, 0.5) * env(0.5, 0.05, 0.2) * 0.3, 0)
place(y, filt(noise(0.5), "bp", (2000, 7000)) * env(0.5, 0.1, 0.15) * 0.15, 0)
for i, m in enumerate((91, 98, 103)): place(y, chime(m, 0.4), 0.2 + i * 0.07, 0.22)
S["feather"] = verb(y, 0.6, 0.3)

# landings and bumps: suspension thuds (hard ones rattle)
y = blank(0.35); place(y, thud(120, 45, 0.25), 0, 0.8); place(y, filt(noise(0.08), "lp", 900) * env(0.08, 0.001, 0.03), 0, 0.4)
S["land"] = y
y = blank(0.7); place(y, thud(100, 35, 0.4), 0, 1.0); place(y, filt(noise(0.2), "lp", 1400) * env(0.2, 0.001, 0.07), 0, 0.6)
for i in range(4): place(y, bell(700 + i * 230, 0.12, 2.0), 0.04 + i * 0.05, 0.12)
place(y, sweep(420, 300, 0.25, "saw") * env(0.25, 0.01, 0.1) * 0.08, 0.1)
S["landHard"] = y
y = blank(0.25); place(y, thud(160, 70, 0.15), 0, 0.7); place(y, filt(noise(0.03), "bp", (600, 2500)) * env(0.03, 0.001, 0.01), 0, 0.4)
S["bump"] = y

# the crash: crunch, clangs, a bounce and rattling bits
y = blank(1.5)
place(y, filt(noise(0.5), "lp", 2500) * env(0.5, 0.002, 0.15), 0, 0.9)
place(y, thud(90, 30, 0.5), 0, 1.0)
for i, f in enumerate((310, 520, 760, 1130, 1490)): place(y, bell(f, 0.5, 2.2), 0.01 + i * 0.03, 0.18)
place(y, thud(130, 60, 0.2), 0.35, 0.5)
for i in range(7): place(y, filt(noise(0.03), "bp", (1500, 6000)) * env(0.03, 0.001, 0.01), 0.45 + i * 0.07 + RNG.random() * 0.03, 0.25)
S["crash"] = verb(y, 0.6, 0.2)

# checkpoint: a ding-ding over a whoosh
y = blank(1.0); place(y, filt(noise(0.3), "bp", (800, 4000)) * env(0.3, 0.05, 0.08) * 0.3, 0)
place(y, chime(91, 0.6), 0.08, 0.6); place(y, chime(96, 0.7), 0.2, 0.6)
S["checkpoint"] = verb(y, 0.6, 0.25)

# the finish: a brass fanfare with bells and a cymbal swell
y = blank(2.8)
for i, (m, at, dd) in enumerate(((67, 0, 0.18), (72, 0.18, 0.18), (76, 0.36, 0.18), (79, 0.54, 1.2))):
    place(y, brass(m, dd + 0.1), at, 0.5)
    place(y, brass(m - 12, dd + 0.1), at, 0.25)
for m in (84, 88, 91, 96): place(y, chime(m, 1.4), 0.56, 0.18)
place(y, filt(noise(1.6), "hp", 5000) * adsr(1.6, 0.4, 0.5, 0.4, 0.6) * 0.25, 0.3)
S["finish"] = verb(y, 1.0, 0.3)

# GO: a punchy stab and a whoosh; the countdown beep
y = blank(0.9); place(y, brass(79, 0.45, 3500), 0, 0.7); place(y, brass(67, 0.45, 3500), 0, 0.5); place(y, thud(150, 50, 0.2), 0, 0.6)
place(y, filt(noise(0.4), "bp", (500, 3000)) * env(0.4, 0.05, 0.12) * 0.25, 0.05)
S["go"] = verb(y, 0.6, 0.2)
S["beep"] = filt(tone(880, 0.18, "square"), "lp", 3000) * adsr(0.18, 0.005, 0.1, 0.6, 0.05) * 0.5

# flip and big air
y = blank(0.8); place(y, filt(sweep(300, 1400, 0.3, "saw"), "bp", (400, 3000)) * env(0.3, 0.02, 0.1) * 0.25, 0)
place(y, pluck(84, 0.4), 0.18, 0.5); place(y, pluck(91, 0.5), 0.3, 0.5); place(y, chime(96, 0.5), 0.3, 0.25)
S["flip"] = verb(y, 0.5, 0.2)
y = blank(0.9); place(y, filt(noise(0.6), "bp", (300, 1800)) * adsr(0.6, 0.2, 0.2, 0.3, 0.2) * 0.4, 0); place(y, chime(98, 0.6), 0.3, 0.3)
S["bigAir"] = verb(y, 0.6, 0.25)

# fuel warnings
y = blank(0.6)
for i, f in enumerate((990, 740, 990)): place(y, filt(tone(f, 0.12, "square"), "lp", 2500) * adsr(0.12, 0.005, 0.05, 0.6, 0.03), i * 0.16, 0.45)
S["lowFuel"] = y
y = blank(1.4)
for i in range(5):
    a = 0.6 - i * 0.1
    place(y, filt(noise(0.1), "lp", 600 - i * 60) * env(0.1, 0.004, 0.04) * a, i * (0.16 + i * 0.04))
    place(y, thud(70, 40, 0.1) * a, i * (0.16 + i * 0.04))
place(y, filt(noise(0.05), "bp", (1500, 4000)) * env(0.05, 0.001, 0.02) * 0.3, 1.15)
S["sputter"] = y

# lives: a soft "aww", and a longer one when the stage starts again
y = blank(1.3)
for i, m in enumerate((72, 69, 64)): place(y, filt(sweep(mtof(m), mtof(m) * 0.97, 0.4, "saw"), "lp", 1500) * adsr(0.4, 0.02, 0.15, 0.5, 0.1) * 0.4, i * 0.25)
S["lifeLost"] = verb(y, 0.6, 0.2)
y = blank(2.0)
for i, m in enumerate((67, 65, 62, 55)): place(y, filt(sweep(mtof(m), mtof(m) * 0.96, 0.5, "saw"), "lp", 1300) * adsr(0.5, 0.03, 0.2, 0.5, 0.15) * 0.45, i * 0.3)
S["gameOver"] = verb(y, 0.8, 0.25)

# a whole world cleared: a bigger fanfare and a run of bells
y = blank(3.6)
for at, ms in ((0, (60, 64, 67)), (0.3, (62, 65, 69)), (0.6, (64, 67, 72)), (0.9, (67, 72, 76))):
    for m in ms: place(y, brass(m, 0.9 if at == 0.9 else 0.32, 3000), at, 0.3)
for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100)): place(y, chime(m, 0.9), 1.0 + i * 0.07, 0.22)
place(y, filt(noise(2.0), "hp", 5000) * adsr(2.0, 0.6, 0.6, 0.4, 0.8) * 0.22, 0.8)
S["worldClear"] = verb(y, 1.2, 0.3)

# menus
S["tap"] = sweep(900, 600, 0.05) * env(0.05, 0.001, 0.015)
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, pluck(84, 0.3), 0.08, 0.4)
S["open"] = y
y = blank(1.0)
for i in range(5): place(y, filt(noise(0.015), "bp", (2000, 6000)) * env(0.015, 0.0005, 0.005), i * 0.05, 0.4)
for i, m in enumerate((79, 84, 88, 91)): place(y, chime(m, 0.5), 0.25 + i * 0.06, 0.35)
S["upgrade"] = verb(y, 0.6, 0.2)
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, chime(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.2)
S["buy"] = verb(y, 0.6, 0.25)
S["whoosh"] = filt(noise(0.5), "bp", (400, 3000)) * np.sin(np.pi * tt(0.5) / 0.5) ** 2 * 0.6

# ---------------------------------------------------------------- ambience (played quietly, left or right)
def chirp_seq(fs, d=0.08, gap=0.05, g=0.5):
    y = blank(len(fs) * (d + gap) + 0.2)
    for i, (f0, f1) in enumerate(fs): place(y, sweep(f0, f1, d) * env(d, 0.005, d * 0.4) * g, i * (d + gap))
    return y


S["birdA"] = verb(chirp_seq([(3200, 4800), (3000, 5200), (3400, 4600), (2800, 5400)], 0.07, 0.04), 0.5, 0.2)
d = 0.9; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * (3000 + 700 * np.sin(2 * np.pi * 22 * t)) * t) * adsr(d, 0.05, 0.3, 0.5, 0.2) * 0.4, 0.5, 0.25)
y = sweep(3400, 1800, 0.9) * env(0.9, 0.02, 0.35) * 0.5 + filt(noise(0.9), "bp", (2000, 4000)) * env(0.9, 0.02, 0.3) * 0.12
S["hawk"] = verb(y, 0.9, 0.35)
d = 1.6; t = tt(d)
S["loon"] = verb(np.sin(2 * np.pi * (780 + 60 * np.sin(2 * np.pi * 4.5 * t) + 120 * (t / d)) * t) * adsr(d, 0.2, 0.6, 0.6, 0.4) * 0.4, 1.2, 0.45)
d = 1.8; t = tt(d)
S["gust"] = filt(noise(d), "bp", (250, 1400)) * np.sin(np.pi * t / d) ** 2 * 0.6
y = blank(1.2)
for i, at in enumerate((0, 0.4)): place(y, filt(tone(380 - i * 20, 0.32, "tri"), "lp", 900) * adsr(0.32, 0.05, 0.15, 0.6, 0.12), at, 0.5)
S["owl"] = verb(y, 1.0, 0.45)
y = blank(1.0)
for f in (392, 494): place(y, filt(tone(f, 0.5, "square"), "lp", 1200) * adsr(0.5, 0.02, 0.2, 0.8, 0.08) * 0.3, 0)
S["horn"] = verb(y, 1.0, 0.5)
d = 2.0; t = tt(d)
S["siren"] = verb(filt(np.sin(2 * np.pi * np.cumsum(700 + 250 * np.sin(2 * np.pi * 0.9 * t)) / SR), "lp", 1800) * np.sin(np.pi * t / d) * 0.4, 1.2, 0.55)
y = blank(0.9)
for i in range(3):
    pulse = filt(np.sign(np.sin(2 * np.pi * 95 * tt(0.16))), "bp", (150, 900)) * env(0.16, 0.01, 0.06)
    place(y, pulse, i * 0.22, 0.5)
S["frog"] = verb(y, 0.6, 0.3)
d = 2.0; t = tt(d)
S["rumble"] = filt(noise(d), "lp", 90) * np.sin(np.pi * t / d) * 3.0
y = blank(0.9)
place(y, filt(sweep(1600, 900, 0.18, "saw"), "bp", (700, 2600)) * env(0.18, 0.01, 0.08) * 0.5, 0)
place(y, filt(sweep(1400, 700, 0.3, "saw"), "bp", (600, 2400)) * env(0.3, 0.01, 0.12) * 0.5, 0.22)
S["gull"] = verb(y, 0.8, 0.35)
y = blank(0.9)
for at in (0, 0.35): place(y, filt(sweep(700, 520, 0.22, "saw") + filt(noise(0.22), "bp", (800, 2200)) * 0.6, "bp", (500, 2500)) * env(0.22, 0.01, 0.1) * 0.5, at)
S["crow"] = verb(y, 0.8, 0.35)
y = blank(1.2); place(y, sweep(900, 2200, 0.06) * env(0.06, 0.001, 0.025) * 0.6, 0)
S["drip"] = verb(y, 1.1, 0.6)
y = blank(1.2)
for i, f in enumerate((1200, 1600, 900, 2000)): place(y, tone(f, 0.06, "square") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
place(y, filt(noise(0.5), "bp", (1500, 5000)) * env(0.5, 0.01, 0.2) * 0.12, 0.5)
S["radio"] = y

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("rumble", "gust") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
