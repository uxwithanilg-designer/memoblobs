"""Wake Racers sound effects, synthesised from scratch (numpy + scipy; no samples, all original): coins, hearts, oil
cans, power boxes and the seven powers (turbo, bubble shield and its pop, coin magnet, tidal wave, ghost hull, mega hop,
ice wake), splashes big and small, landings, jumps, crashes, bumps, wall scrapes, mine blasts, knocked crates, boost
pads, nitro, checkpoints, time bonuses, knockouts, the finish fanfare, losing, the countdown and the start horn,
overtakes, near misses, low-oil warnings, a ship horn, menu sounds, the wreck, docking, a cheering crowd, star and
unlock jingles — and each world's ambience (gulls, surf, parrots, whale song, a hawk, wind, a ship's foghorn, a harbour
bell, cracking ice, frogs, wind chimes, bubbling lava, thunder, cave drips, a synth hum, monkeys and a crowd). The
music is composed live in the game (src/wake/music.ts), so there are no music files.

usage: python scripts/gen_wake_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_wake_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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


def steel(m, d=0.45, g=1.0):
    """a bright steel-pan note: Wake Racers' signature voice"""
    f = mtof(m); t = tt(d)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / (d * 0.4)) + 0.45 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / (d * 0.2))
    y += 0.25 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / (d * 0.1)) + 0.12 * np.sin(2 * np.pi * f * 5.2 * t) * np.exp(-t / 0.02)
    return y * np.minimum(1, t / 0.003) * g


def brass(m, d, bright=2600):
    f = mtof(m)
    y = sweep(f * 0.995, f, d, "saw", "lin") * 0.6 + sweep(f * 1.005, f * 1.005, d, "saw", "lin") * 0.4
    return filt(y, "lp", bright) * adsr(d, 0.03, 0.2, 0.7, 0.12)


def thud(f0=110, f1=40, d=0.3, g=1.0): return sweep(f0, f1, d) * env(d, 0.002, d * 0.35) * g


def place(y, x, at, g=1.0):
    o = int(at * SR)
    if o >= len(y): return y
    k = min(len(x), len(y) - o)
    y[o:o + k] += x[:k] * g
    return y


def blank(d): return np.zeros(n_(d))


def mix(*parts):
    """sum sounds of different lengths (padded with silence)"""
    out = np.zeros(max(len(p) for p in parts))
    for p in parts: out[: len(p)] += p
    return out


def verb(y, size=0.6, wet=0.25):
    ir = noise(size) * np.exp(-tt(size) / (size * 0.28))
    ir = filt(ir, "lp", 6000)
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    w = fftconvolve(y, ir)[: len(y) + n_(size)]
    dry = np.concatenate([y, np.zeros(len(w) - len(y))])
    return dry * (1 - wet) + w * wet


def bubbles(d, n=10, lo=500, hi=1600, g=0.5):
    """little rising blips: water bubbling"""
    y = blank(d)
    for _ in range(n):
        at = RNG.uniform(0, d * 0.8); f = RNG.uniform(lo, hi); dd = RNG.uniform(0.03, 0.07)
        place(y, sweep(f, f * 1.8, dd) * env(dd, 0.002, dd * 0.4), at, g * RNG.uniform(0.4, 1))
    return y


def splash(d=0.7, low=300, high=6000, g=1.0):
    t = tt(d)
    y = filt(noise(d), "bp", (low, high)) * (np.exp(-t / (d * 0.22)) * np.minimum(1, t / 0.01))
    y += filt(noise(d), "lp", 900) * np.exp(-t / (d * 0.3)) * 0.6
    place(y, bubbles(d, 12, 400, 1400, 0.25), d * 0.15)
    return y * g


def chirps(spec, dd, gap, g=0.6):
    y = blank(len(spec) * (dd + gap) + 0.1)
    for i, (a, b) in enumerate(spec): place(y, sweep(a, b, dd) * env(dd, 0.003, dd * 0.5), i * (dd + gap), g)
    return y


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
    tmp = os.path.join(tempfile.gettempdir(), f"wake_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_wake_{name}.mp3")
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", tmp, "-ac", "1", "-b:a", "80k", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", dst], check=True)
    os.remove(tmp)


S = {}
# ---------------------------------------------------------------- pickups
y = blank(0.35); place(y, steel(88, 0.3), 0); place(y, steel(95, 0.28), 0.06)
S["coin"] = y
y = blank(0.7)
for i, m in enumerate((72, 76, 79, 84)): place(y, steel(m, 0.5, 0.8), i * 0.07)
place(y, thud(160, 90, 0.2), 0, 0.5)
S["heart"] = verb(y, 0.5, 0.2)
y = blank(0.6); place(y, bubbles(0.4, 14, 300, 900, 0.6), 0); place(y, steel(67, 0.4), 0.18); place(y, steel(74, 0.35), 0.26)
S["fuel"] = y
y = blank(0.6)
for i, m in enumerate((79, 83, 86, 91)): place(y, steel(m, 0.35, 0.7), i * 0.045)
place(y, filt(noise(0.3), "hp", 4000) * env(0.3, 0.005, 0.1) * 0.25, 0)
S["box"] = y
y = blank(0.8); place(y, sweep(300, 1400, 0.45, "saw") * env(0.45, 0.01, 0.3) * 0.4, 0); place(y, steel(84, 0.4), 0.4)
S["power"] = filt(y, "lp", 7000)
# ---------------------------------------------------------------- powers
y = blank(1.2); place(y, filt(noise(1.0), "bp", (300, 3000)) * adsr(1.0, 0.05, 0.3, 0.6, 0.4), 0, 0.6); place(y, sweep(120, 420, 0.9, "saw") * adsr(0.9, 0.05, 0.3, 0.6, 0.3) * 0.4, 0)
S["turbo"] = filt(y, "lp", 5000)
y = blank(0.8); t = tt(0.7); place(y, np.sin(2 * np.pi * (600 + 300 * t) * t) * env(0.7, 0.02, 0.3) * 0.5 + np.sin(2 * np.pi * 1200 * t) * env(0.7, 0.02, 0.2) * 0.2, 0)
S["shield"] = verb(y, 0.6, 0.35)
y = blank(0.5); place(y, filt(noise(0.06), "hp", 2000) * env(0.06, 0.001, 0.02), 0); place(y, sweep(1200, 300, 0.25) * env(0.25, 0.002, 0.1) * 0.5, 0.01)
S["shieldPop"] = y
y = blank(0.9); place(y, sweep(200, 900, 0.6, "square") * env(0.6, 0.01, 0.3) * 0.2, 0); place(y, steel(91, 0.3), 0.55)
S["magnet"] = filt(y, "lp", 4000)
S["wave"] = verb(splash(1.4, 120, 3000, 1.0) + filt(noise(1.4), "lp", 300) * env(1.4, 0.15, 0.6) * 0.8, 0.9, 0.3)
d = 1.0; t = tt(d)
S["ghost"] = verb(np.sin(2 * np.pi * (500 + 120 * np.sin(2 * np.pi * 3 * t)) * t) * adsr(d, 0.1, 0.4, 0.5, 0.4) * 0.5, 1.0, 0.5)
y = blank(0.7); place(y, sweep(200, 1100, 0.35) * env(0.35, 0.005, 0.2) * 0.7, 0); place(y, splash(0.4, 600, 5000, 0.5), 0)
S["hop"] = y
y = blank(1.0)
for i in range(6): place(y, bell(2400 + i * 260, 0.4, 1.3) * 0.25, i * 0.06)
place(y, filt(noise(0.8), "hp", 3500) * env(0.8, 0.02, 0.3) * 0.3, 0)
S["freeze"] = verb(y, 0.8, 0.35)
# ---------------------------------------------------------------- water
S["splash"] = splash(0.7, 300, 6000)
S["splashBig"] = verb(mix(splash(1.3, 150, 5000, 1.0), thud(90, 40, 0.5) * 0.8), 0.9, 0.25)
S["land"] = mix(splash(0.45, 400, 5000, 0.8), thud(120, 60, 0.2) * 0.5)
y = blank(0.5); place(y, filt(noise(0.35), "bp", (800, 5000)) * env(0.35, 0.01, 0.12) * 0.6, 0); place(y, sweep(220, 520, 0.25) * env(0.25, 0.005, 0.12) * 0.3, 0)
S["jump"] = y
# ---------------------------------------------------------------- knocks
y = blank(0.9); place(y, thud(140, 35, 0.45, 1.2), 0); place(y, filt(noise(0.4), "bp", (200, 3500)) * env(0.4, 0.002, 0.12), 0, 0.8); place(y, splash(0.6, 300, 4000, 0.5), 0.05)
for i in range(4): place(y, filt(noise(0.05), "bp", (1500, 6000)) * env(0.05, 0.001, 0.02), 0.05 + i * 0.07, 0.4)
S["hit"] = verb(y, 0.6, 0.2)
S["bump"] = mix(thud(180, 90, 0.18), filt(noise(0.12), "bp", (300, 2000)) * env(0.12, 0.002, 0.04) * 0.4)
y = filt(noise(0.5), "bp", (400, 3000)) * adsr(0.5, 0.01, 0.2, 0.5, 0.2) * 0.6; place(y, thud(150, 80, 0.2), 0, 0.5)
S["wall"] = y
y = blank(2.0); place(y, thud(90, 25, 1.2, 1.4), 0); place(y, filt(noise(1.6), "lp", 1800) * env(1.6, 0.003, 0.5), 0, 1.0); place(y, splash(1.5, 150, 4000, 0.8), 0.05)
S["mine"] = verb(y, 1.4, 0.3)
y = blank(0.7); place(y, filt(noise(0.3), "bp", (600, 4000)) * env(0.3, 0.002, 0.06), 0, 0.7)
for i in range(5): place(y, filt(noise(0.04), "bp", (1000, 5000)) * env(0.04, 0.001, 0.015), 0.04 + i * 0.05, 0.5)
place(y, splash(0.4, 500, 4000, 0.4), 0.05)
S["smash"] = y
# ---------------------------------------------------------------- speed
y = blank(0.7); place(y, sweep(400, 2000, 0.35, "saw") * env(0.35, 0.005, 0.2) * 0.3, 0); place(y, filt(noise(0.6), "bp", (1000, 6000)) * env(0.6, 0.01, 0.25) * 0.5, 0)
S["pad"] = filt(y, "lp", 7000)
y = filt(noise(0.9), "bp", (500, 4000)) * adsr(0.9, 0.03, 0.3, 0.6, 0.3) * 0.7; place(y, sweep(80, 260, 0.6, "saw") * adsr(0.6, 0.02, 0.3, 0.5, 0.2) * 0.4, 0)
S["nitro"] = y
y = blank(0.6)
for i, m in enumerate((79, 86)): place(y, steel(m, 0.4), i * 0.1)
S["checkpoint"] = y
y = blank(0.6)
for i, m in enumerate((84, 88, 91)): place(y, bell(mtof(m), 0.3, 0.8) * 0.5, i * 0.06)
S["timeAdd"] = y
y = blank(1.0); place(y, sweep(500, 140, 0.6, "square") * env(0.6, 0.005, 0.3) * 0.35, 0); place(y, thud(110, 50, 0.4), 0.05, 0.6)
S["knockout"] = filt(y, "lp", 3000)
y = blank(2.8)
for i, (m, at, dd) in enumerate([(67, 0, 0.18), (72, 0.18, 0.18), (76, 0.36, 0.18), (79, 0.54, 0.5), (76, 1.05, 0.16), (79, 1.22, 1.2)]):
    place(y, brass(m, dd + 0.15), at, 0.5); place(y, brass(m - 12, dd + 0.15), at, 0.25); place(y, steel(m + 12, dd + 0.2, 0.5), at)
S["finish"] = verb(y, 1.2, 0.3)
y = blank(1.6)
for i, m in enumerate((67, 64, 60, 55)): place(y, brass(m, 0.35), i * 0.28, 0.5)
S["lose"] = verb(y, 0.9, 0.3)
y = blank(0.5); place(y, bell(880, 0.35, 0.6), 0)
S["beep"] = y
y = blank(1.0); place(y, bell(1760, 0.7, 0.6), 0); place(y, brass(81, 0.5), 0, 0.3)
S["go"] = y
y = blank(0.4); place(y, sweep(500, 1500, 0.18, "tri") * env(0.18, 0.003, 0.08) * 0.6, 0); place(y, steel(91, 0.25), 0.12)
S["overtake"] = y
y = filt(noise(0.45), "bp", (900, 5000)) * (np.sin(np.pi * tt(0.45) / 0.45) ** 2) * 0.7
S["nearMiss"] = y
y = blank(1.0)
for i in range(3): place(y, tone(740, 0.12, "square") * env(0.12, 0.003, 0.06) * 0.3, i * 0.2)
S["lowFuel"] = filt(y, "lp", 3000)
d = 1.1; t = tt(d)
S["horn"] = filt(tone(233, d, "saw") * 0.5 + tone(294, d, "saw") * 0.4, "lp", 1500) * adsr(d, 0.04, 0.2, 0.8, 0.2)
# ---------------------------------------------------------------- menus
y = blank(0.12); place(y, steel(91, 0.1, 0.6), 0)
S["tap"] = y
y = blank(0.4); place(y, sweep(600, 1400, 0.2, "tri") * env(0.2, 0.004, 0.1) * 0.5, 0); place(y, filt(noise(0.2), "bp", (2000, 7000)) * env(0.2, 0.01, 0.07) * 0.2, 0)
S["open"] = y
y = blank(0.8)
for i, m in enumerate((84, 88, 91, 96)): place(y, steel(m, 0.4, 0.7), i * 0.06)
place(y, bubbles(0.3, 6, 1200, 2400, 0.2), 0.2)
S["buy"] = y
d = 0.6; t = tt(d)
S["whoosh"] = filt(noise(d), "bp", (500, 4000)) * np.sin(np.pi * t / d) ** 2 * 0.8
y = blank(1.8); place(y, thud(100, 30, 1.0, 1.3), 0); place(y, splash(1.6, 150, 3500), 0.05); place(y, bubbles(1.4, 30, 200, 800, 0.4), 0.3)
S["wreck"] = verb(y, 1.2, 0.3)
y = blank(1.0)
for i, m in enumerate((72, 79, 84)): place(y, steel(m, 0.5), i * 0.12)
place(y, thud(120, 70, 0.2), 0, 0.4)
S["docked"] = y
d = 2.2; t = tt(d)
y = filt(noise(d), "bp", (500, 3500)) * adsr(d, 0.15, 0.6, 0.6, 0.7) * 0.6
for i in range(14): place(y, filt(noise(0.06), "bp", (1500, 6000)) * env(0.06, 0.002, 0.02), RNG.uniform(0.1, 1.8), 0.3)
S["cheer"] = verb(y, 0.8, 0.25)
y = blank(0.8)
for i, m in enumerate((79, 83, 86, 91, 95)): place(y, steel(m, 0.4, 0.6), i * 0.05)
S["star"] = verb(y, 0.6, 0.25)
y = blank(1.2)
for i, m in enumerate((72, 76, 79, 84, 88)): place(y, steel(m, 0.5, 0.7), i * 0.09); place(y, brass(m - 12, 0.25), i * 0.09, 0.15)
S["unlock"] = verb(y, 0.9, 0.3)

# ---------------------------------------------------------------- the worlds' ambience
A = {}
A["gull"] = verb(chirps([(1800, 1200), (2000, 1300), (1700, 1100)], 0.14, 0.06, 0.5), 0.6, 0.3)
d = 2.4; t = tt(d)
A["surf"] = filt(noise(d), "bp", (200, 2500)) * (np.sin(np.pi * t / d) ** 3) * 0.7 + filt(noise(d), "hp", 3000) * np.maximum(0, np.sin(np.pi * (t - 0.5) / d)) ** 4 * 0.3
A["parrot"] = verb(chirps([(1400, 2600), (2600, 1500), (1600, 2800), (2200, 1300)], 0.08, 0.05, 0.5), 0.5, 0.2)
d = 2.8; t = tt(d)
f = 220 + 140 * np.sin(np.pi * t / d) + 40 * np.sin(2 * np.pi * 1.1 * t)
A["whale"] = verb(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2 * 0.5, 1.8, 0.6)
A["hawk"] = verb(filt(sweep(2800, 1700, 0.7, "saw"), "bp", (1500, 4000)) * env(0.7, 0.05, 0.35) * 0.5, 1.2, 0.5)
d = 2.2; t = tt(d)
A["wind"] = filt(noise(d), "bp", (300, 1500)) * np.sin(np.pi * t / d) ** 2 * (1 + 0.5 * np.sin(2 * np.pi * 0.9 * t)) * 0.6
d = 2.4
A["horn"] = verb(filt(tone(98, d, "saw") * 0.6 + tone(147, d, "saw") * 0.3, "lp", 700) * adsr(d, 0.2, 0.4, 0.8, 0.6), 1.6, 0.5)
y = bell(392, 2.0, 1.0) * 0.6; place(y, bell(392, 1.6, 1.0), 0.6, 0.4)
A["bell"] = verb(y, 1.4, 0.45)
y = blank(1.0); place(y, filt(noise(0.05), "hp", 2500) * env(0.05, 0.0005, 0.01), 0, 0.9)
for i in range(5): place(y, filt(noise(0.03), "bp", (1500, 6000)) * env(0.03, 0.001, 0.01), 0.04 + i * 0.05, 0.4)
place(y, thud(70, 35, 0.5), 0.02, 0.5)
A["ice"] = verb(y, 1.2, 0.5)
y = blank(0.9)
for i in range(3): place(y, filt(np.sign(np.sin(2 * np.pi * 110 * tt(0.15))), "bp", (150, 900)) * env(0.15, 0.01, 0.05), i * 0.2, 0.5)
A["frog"] = verb(y, 0.6, 0.3)
y = blank(1.8)
for i, m in enumerate((84, 88, 91, 86, 93)): place(y, bell(mtof(m), 1.1, 1.2) * 0.35, i * 0.22 + RNG.uniform(0, 0.05))
A["chime"] = verb(y, 1.2, 0.5)
y = blank(1.4); place(y, bubbles(1.2, 18, 80, 300, 0.7), 0); place(y, filt(noise(1.2), "lp", 250) * env(1.2, 0.1, 0.5) * 0.5, 0)
A["lava"] = y
y = blank(3.2); place(y, filt(noise(3.0), "lp", 220) * adsr(3.0, 0.05, 0.9, 0.4, 1.4), 0, 1.0); place(y, filt(noise(0.4), "bp", (300, 2500)) * env(0.4, 0.002, 0.1), 0, 0.6)
A["thunder"] = verb(y, 1.8, 0.4)
y = blank(1.2)
for i in range(3): place(y, sweep(1400, 2400, 0.05) * env(0.05, 0.002, 0.02), i * 0.35 + RNG.uniform(0, 0.1), 0.5)
A["drip"] = verb(y, 1.6, 0.6)
d = 2.0; t = tt(d)
A["synth"] = verb(filt(tone(110, d, "saw") * 0.4 + tone(165, d, "saw") * 0.25, "lp", 700) * np.sin(np.pi * t / d) ** 2 * (1 + 0.3 * np.sin(2 * np.pi * 4 * t)), 1.0, 0.5)
A["monkey"] = verb(chirps([(700, 1400), (900, 1600), (800, 1500), (1000, 1800), (900, 1300)], 0.09, 0.04, 0.5), 0.7, 0.3)
d = 2.2; t = tt(d)
y = filt(noise(d), "bp", (400, 3000)) * np.sin(np.pi * t / d) ** 2 * 0.6
for i in range(10): place(y, filt(noise(0.06), "bp", (1200, 5000)) * env(0.06, 0.002, 0.02), RNG.uniform(0.2, 1.8), 0.25)
A["crowd"] = y
for k, v in A.items(): S["amb_" + k] = v

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("amb_wind", "amb_surf") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
