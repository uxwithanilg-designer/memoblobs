"""Crumble Crew sound effects, synthesised from scratch (numpy + scipy; no samples, all original): smashing wood,
glass, brick, stone and metal, a clank when a block holds, the hammer swing, rubble pouring and whole walls collapsing,
the drill (and the drill on metal), the paint sprayer, the blaster, robot and turret shots, throws, bounces, a fuse,
explosions big and small, a rocket, loot (cash, gold bars, gems, coins), hearts, oil, power cubes and ammo, the alarm
siren and bell, robots hit, going down, a hound bot, a drone, the Vault Warden, getting hurt, the vault door and the
safe cracking, steps, jumps and landings, the getaway van (horn, engine, door), the radio, goal / site / heist fanfares,
the start, a fail, the warp, menu sounds, and each district's ambience. The music is composed live in the game
(src/crumble/music.ts), so there are no music files.

usage: python scripts/gen_crumble_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_crumble_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
    tmp = os.path.join(tempfile.gettempdir(), f"crumble_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_crumble_{name}.mp3")
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


def rubble(d, n=24, lo=600, hi=3800, g=0.5):
    """a shower of blocks: many short knocks spreading out"""
    y = blank(d)
    for i in range(n):
        at = (i / n) ** 1.6 * d * 0.8 + RNG.random() * 0.02
        f = lo + RNG.random() * (hi - lo)
        k = filt(noise(0.05), "bp", (f * 0.6, f * 1.4)) * env(0.05, 0.001, 0.012 + RNG.random() * 0.015)
        place(y, k, at, g * (1 - i / n * 0.6))
    return y


def glass(d=0.7, g=1.0):
    y = blank(d)
    for i in range(30):
        at = RNG.random() ** 2 * d * 0.6
        f = 2500 + RNG.random() * 6000
        place(y, np.sin(2 * np.pi * f * tt(0.08)) * env(0.08, 0.001, 0.02 + RNG.random() * 0.03), at, 0.25 * g)
    place(y, filt(noise(0.1), "hp", 3000) * env(0.1, 0.001, 0.03), 0, 0.8 * g)
    return y


# ---------------------------------------------------------------- smashing
y = blank(0.55); place(y, thud(160, 60, 0.18), 0, 0.8); place(y, filt(noise(0.2), "bp", (300, 2200)) * env(0.2, 0.001, 0.05), 0, 0.7); place(y, rubble(0.4, 10, 500, 2200, 0.35), 0.03)
S["smash_wood"] = y
y = blank(0.9); place(y, thud(120, 50, 0.15), 0, 0.5); place(y, glass(0.8), 0)
S["smash_glass"] = verb(y, 0.5, 0.2)
y = blank(0.7); place(y, thud(110, 45, 0.25), 0, 1.0); place(y, filt(noise(0.25), "bp", (200, 1600)) * env(0.25, 0.001, 0.07), 0, 0.8); place(y, rubble(0.6, 16, 300, 1800, 0.45), 0.04)
S["smash_brick"] = y
y = blank(0.7); place(y, thud(90, 40, 0.3), 0, 1.0); place(y, filt(noise(0.3), "bp", (150, 1200)) * env(0.3, 0.001, 0.09), 0, 0.8); place(y, rubble(0.6, 12, 250, 1400, 0.4), 0.05)
S["smash_stone"] = y
y = blank(0.8); place(y, metal(420, 0.6) * 0.6, 0); place(y, thud(140, 70, 0.12), 0, 0.6); place(y, filt(noise(0.06), "hp", 2500) * env(0.06, 0.001, 0.02), 0, 0.5)
S["smash_metal"] = verb(y, 0.5, 0.2)
y = blank(0.4); place(y, metal(900, 0.3) * 0.35, 0); place(y, thud(200, 120, 0.08), 0, 0.5)
S["clank"] = y
S["swing"] = filt(noise(0.22), "bp", (400, 2200)) * np.sin(np.pi * tt(0.22) / 0.22) ** 2 * 0.7
S["crumble"] = rubble(1.1, 34, 250, 2600, 0.5) + np.concatenate([filt(noise(1.1), "lp", 260) * np.exp(-tt(1.1) / 0.4) * 0.6, np.zeros(0)])[: n_(1.1)]
y = blank(2.4); place(y, thud(70, 28, 1.0), 0, 1.0); place(y, filt(noise(2.4), "lp", 400) * np.exp(-tt(2.4) / 0.8), 0, 0.9); place(y, rubble(2.2, 60, 200, 2200, 0.45), 0.1)
S["collapse"] = verb(y, 1.0, 0.25)
d = 0.5; t = tt(d)
S["drill"] = (filt(sweep(180, 180, d, "saw", "lin"), "lp", 1800) * 0.5 + filt(noise(d), "bp", (900, 3500)) * (0.5 + 0.5 * np.sin(2 * np.pi * 36 * t)) * 0.4) * np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.02)
S["drill_metal"] = S["drill"] * 0.6 + (np.sin(2 * np.pi * 2400 * t) * 0.3 + np.sin(2 * np.pi * 3100 * t) * 0.2) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t)) * np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.02)
y = blank(0.9)
for i in range(4): place(y, filt(noise(0.12), "hp", 2000) * env(0.12, 0.005, 0.05) * 0.5, i * 0.16)
for i in range(6): place(y, sweep(800, 600, 0.12) * env(0.12, 0.004, 0.04) * 0.3, i * 0.12)
S["spray"] = filt(noise(0.9), "bp", (2500, 9000)) * adsr(0.9, 0.03, 0.2, 0.8, 0.1) * 0.6

# ---------------------------------------------------------------- weapons, explosions
y = blank(0.3); place(y, sweep(1800, 300, 0.16, "square") * env(0.16, 0.001, 0.06) * 0.5, 0); place(y, filt(noise(0.05), "hp", 3000) * env(0.05, 0.001, 0.015), 0, 0.4)
S["blaster"] = y
y = blank(0.3); place(y, sweep(900, 220, 0.18, "saw") * env(0.18, 0.001, 0.07) * 0.5, 0); place(y, thud(200, 90, 0.08), 0, 0.3)
S["robot_shot"] = filt(y, "lp", 4000)
y = blank(0.35); place(y, sweep(1300, 400, 0.1, "square") * env(0.1, 0.001, 0.03) * 0.4, 0); place(y, sweep(1300, 400, 0.1, "square") * env(0.1, 0.001, 0.03) * 0.3, 0.12)
S["turret_shot"] = filt(y, "lp", 5000)
S["throw"] = filt(noise(0.25), "bp", (500, 2600)) * np.sin(np.pi * tt(0.25) / 0.25) ** 3 * 0.8
y = blank(0.3); place(y, metal(1200, 0.15) * 0.4, 0); place(y, thud(300, 160, 0.06), 0, 0.4)
S["bounce"] = y
d = 1.4; t = tt(d)
S["fuse"] = filt(noise(d), "bp", (2000, 8000)) * (0.6 + 0.4 * (RNG.random(n_(d)) > 0.92)) * adsr(d, 0.02, 0.3, 0.8, 0.05) * 0.6
y = blank(1.6); place(y, thud(90, 30, 0.7), 0, 1.0); place(y, filt(noise(1.4), "lp", 1800) * np.exp(-tt(1.4) / 0.3), 0, 1.0); place(y, rubble(1.2, 30, 300, 2600, 0.35), 0.06)
S["boom"] = verb(y, 1.0, 0.25)
y = blank(2.6); place(y, thud(70, 22, 1.2), 0, 1.0); place(y, filt(noise(2.4), "lp", 1300) * np.exp(-tt(2.4) / 0.55), 0, 1.0); place(y, rubble(2.2, 60, 200, 2400, 0.4), 0.1)
S["boom_big"] = verb(y, 1.3, 0.3)
d = 0.7; t = tt(d)
S["rocket"] = filt(noise(d), "bp", (300, 3000)) * np.minimum(1, t / 0.03) * np.exp(-t / 0.35) + sweep(500, 140, d, "saw") * env(d, 0.005, 0.2) * 0.3

# ---------------------------------------------------------------- loot and pickups
y = blank(0.7)
for i in range(5): place(y, filt(noise(0.05), "bp", (1500, 6000)) * env(0.05, 0.002, 0.02) * 0.4, i * 0.035)
place(y, bell(2093, 0.5, 1.2) * 0.5, 0.12); place(y, bell(2637, 0.45, 1.2) * 0.4, 0.2)
S["cash"] = y
y = blank(0.7); place(y, metal(1700, 0.4) * 0.35, 0); place(y, metal(2100, 0.35) * 0.3, 0.06); place(y, bell(1568, 0.5) * 0.35, 0.1)
S["gold"] = y
y = blank(0.8)
for i, m in enumerate((88, 92, 95, 100)): place(y, bell(mtof(m), 0.35, 1.4) * 0.4, i * 0.05)
S["gem"] = verb(y, 0.5, 0.25)
y = blank(0.4); place(y, bell(1976, 0.25) * 0.5, 0); place(y, bell(2637, 0.3) * 0.5, 0.06)
S["coin"] = y
y = blank(0.7)
for i, m in enumerate((72, 76, 79, 84)): place(y, pluck(m, 0.3) * 0.6, i * 0.07)
S["heart"] = verb(y, 0.4, 0.2)
y = blank(0.7)
for i in range(4): place(y, sweep(260 + i * 30, 160 + i * 20, 0.12) * env(0.12, 0.01, 0.05) * 0.6, i * 0.11)
S["oil"] = y
y = blank(0.9)
for i, m in enumerate((67, 71, 74, 79, 83, 86)): place(y, synth(m, 0.14) * 0.5, i * 0.06)
S["power"] = verb(y, 0.6, 0.25)
y = blank(0.4); place(y, metal(700, 0.15) * 0.4, 0); place(y, metal(900, 0.12) * 0.4, 0.09); place(y, thud(220, 140, 0.08), 0.16, 0.4)
S["ammo"] = y

# ---------------------------------------------------------------- security
d = 2.2; t = tt(d)
f = 700 + 380 * np.sin(2 * np.pi * 1.1 * t)
S["alarm"] = filt(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * 0.2, "lp", 3000) * adsr(d, 0.05, 0.3, 0.85, 0.2) * 0.7
y = blank(1.0)
for i in range(8): place(y, metal(2300, 0.1) * 0.35, i * 0.11)
S["bell"] = y
y = blank(0.5); place(y, metal(600, 0.25) * 0.4, 0); place(y, thud(260, 120, 0.1), 0, 0.5)
S["robot_hit"] = y
y = blank(1.2); place(y, sweep(600, 80, 0.8, "saw") * env(0.8, 0.01, 0.4) * 0.4, 0); place(y, thud(120, 40, 0.4), 0.1, 0.8); place(y, filt(noise(0.8), "lp", 1500) * np.exp(-tt(0.8) / 0.2), 0.1, 0.7)
S["robot_down"] = y
y = blank(0.6)
for at in (0, 0.22): place(y, filt(sweep(500, 260, 0.14, "square"), "bp", (300, 2500)) * env(0.14, 0.004, 0.06) * 0.6, at)
S["hound"] = y
d = 1.2; t = tt(d)
S["drone"] = filt(sweep(210, 210, d, "saw", "lin") * (0.7 + 0.3 * np.sin(2 * np.pi * 40 * t)), "bp", (150, 2000)) * np.sin(np.pi * t / d) * 0.6
y = blank(2.0); place(y, filt(sweep(70, 45, 1.6, "saw"), "lp", 600) * adsr(1.6, 0.1, 0.5, 0.7, 0.4), 0, 1.0); place(y, metal(140, 1.2) * 0.4, 0.2); place(y, sweep(900, 300, 0.8, "square") * env(0.8, 0.05, 0.3) * 0.2, 0.3)
S["warden"] = verb(y, 1.2, 0.35)
y = blank(0.5); place(y, thud(180, 90, 0.12), 0, 0.7); place(y, filt(noise(0.2), "bp", (400, 2500)) * env(0.2, 0.002, 0.05), 0, 0.5)
S["hurt"] = y
y = blank(1.6); place(y, metal(110, 1.4) * 0.6, 0); place(y, sweep(180, 60, 1.2, "saw") * env(1.2, 0.2, 0.5) * 0.3, 0.1); place(y, thud(80, 30, 0.5), 1.0, 1.0)
S["vault"] = verb(y, 1.0, 0.3)
y = blank(0.9)
for i in range(5): place(y, metal(2600 - i * 120, 0.05) * 0.35, i * 0.09)
place(y, metal(900, 0.3) * 0.5, 0.55)
S["crack"] = y

# ---------------------------------------------------------------- moving
y = blank(0.12); place(y, filt(noise(0.06), "bp", (200, 1600)) * env(0.06, 0.002, 0.02), 0, 0.7)
S["step"] = y
y = blank(0.2); place(y, filt(noise(0.18), "bp", (500, 2500)) * env(0.18, 0.005, 0.06) * 0.5, 0); place(y, sweep(300, 600, 0.12) * env(0.12, 0.005, 0.05) * 0.2, 0)
S["jump"] = y
y = blank(0.3); place(y, thud(140, 60, 0.15), 0, 0.8); place(y, filt(noise(0.12), "bp", (200, 1400)) * env(0.12, 0.002, 0.04), 0, 0.5)
S["land"] = y

# ---------------------------------------------------------------- the van and the radio
y = blank(1.0)
for at, f in ((0, 392), (0.3, 392)): place(y, filt(sweep(f, f, 0.22, "saw", "lin") * 0.6 + sweep(f * 1.25, f * 1.25, 0.22, "square", "lin") * 0.4, "lp", 2400) * adsr(0.22, 0.01, 0.1, 0.8, 0.05) * 0.5, at)
S["van_horn"] = verb(y, 0.7, 0.3)
d = 1.8; t = tt(d)
f = 70 + 90 * np.minimum(1, t / 1.0)
S["van_engine"] = filt(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + sweep(140, 140, d, "saw", "lin") * 0.2, "lp", 900) * adsr(d, 0.08, 0.4, 0.8, 0.3) * 0.8
y = blank(0.6); place(y, metal(300, 0.3) * 0.4, 0); place(y, thud(150, 70, 0.15), 0.02, 0.8)
S["van_door"] = y
y = blank(0.5); place(y, filt(noise(0.08), "bp", (1500, 5000)) * env(0.08, 0.002, 0.03) * 0.5, 0); place(y, sweep(1800, 1800, 0.06, "square", "lin") * env(0.06, 0.002, 0.03) * 0.3, 0.1); place(y, sweep(2400, 2400, 0.06, "square", "lin") * env(0.06, 0.002, 0.03) * 0.3, 0.18)
S["radio"] = y

# ---------------------------------------------------------------- goals and fanfares
y = blank(0.9)
for i, m in enumerate((76, 79, 84)): place(y, pluck(m, 0.4) * 0.6, i * 0.08)
place(y, bell(mtof(88), 0.6) * 0.4, 0.24)
S["goal"] = verb(y, 0.5, 0.25)
y = blank(2.2)
for i, m in enumerate((67, 72, 76, 79)): place(y, brass(m, 0.25) * 0.5, i * 0.13)
place(y, brass(84, 0.9) * 0.6, 0.55); place(y, brass(79, 0.9) * 0.4, 0.55); place(y, bell(mtof(96), 1.0) * 0.3, 0.55)
S["site_clear"] = verb(y, 0.9, 0.3)
y = blank(3.2)
for i, m in enumerate((60, 64, 67, 72, 67, 72, 76, 79)): place(y, brass(m, 0.2) * 0.45, i * 0.11)
place(y, brass(84, 1.4) * 0.6, 0.95); place(y, brass(88, 1.4) * 0.45, 0.95); place(y, brass(79, 1.4) * 0.4, 0.95)
for i in range(8): place(y, bell(mtof(96 + (i % 4) * 2), 0.5) * 0.18, 1.0 + i * 0.12)
place(y, thud(90, 40, 0.4), 0.95, 0.6)
S["heist_clear"] = verb(y, 1.2, 0.3)
y = blank(1.2)
for i, m in enumerate((72, 76, 79, 84)): place(y, synth(m, 0.12) * 0.5, i * 0.09)
place(y, synth(88, 0.5) * 0.5, 0.36)
S["start"] = verb(y, 0.6, 0.25)
y = blank(1.2)
for i, m in enumerate((67, 63, 60)): place(y, brass(m, 0.3, 1800) * 0.5, i * 0.22)
S["fail"] = verb(y, 0.8, 0.3)
y = blank(1.2); place(y, sweep(200, 2400, 0.6, "saw") * env(0.6, 0.3, 0.3) * 0.3, 0); place(y, bell(mtof(91), 0.6) * 0.4, 0.55)
S["warp"] = verb(y, 0.8, 0.35)

# ---------------------------------------------------------------- menus
y = blank(0.12); place(y, sweep(900, 1300, 0.05, "square") * env(0.05, 0.001, 0.02) * 0.3, 0)
S["tap"] = y
y = blank(0.3); place(y, filt(noise(0.2), "bp", (600, 3000)) * env(0.2, 0.01, 0.06) * 0.4, 0); place(y, pluck(84, 0.2) * 0.4, 0.06)
S["open"] = y
y = blank(1.1); place(y, bell(1568, 0.6, 1.2), 0, 0.5); place(y, bell(2093, 0.8, 1.2), 0.08, 0.45)
for i in range(6): place(y, pluck(96 + (i % 3) * 4, 0.3), 0.2 + i * 0.05, 0.25)
S["buy"] = verb(y, 0.6, 0.25)
y = blank(1.0)
for i in range(4): place(y, metal(800 + i * 120, 0.08) * 0.2, i * 0.06)
for i, m in enumerate((79, 84, 88, 91)): place(y, pluck(m, 0.4), 0.26 + i * 0.06, 0.5)
S["upgrade"] = verb(y, 0.6, 0.2)
y = blank(0.5); place(y, metal(1500, 0.08) * 0.4, 0); place(y, metal(1100, 0.1) * 0.4, 0.1); place(y, pluck(84, 0.3), 0.18, 0.4)
S["equip"] = y

# ---------------------------------------------------------------- ambience
def chirps(fs, d=0.07, gap=0.04, g=0.5):
    y = blank(len(fs) * (d + gap) + 0.2)
    for i, (f0, f1) in enumerate(fs): place(y, sweep(f0, f1, d) * env(d, 0.004, d * 0.4) * g, i * (d + gap))
    return y
S["birdA"] = verb(chirps([(3400, 5000), (3800, 2600), (3400, 5000), (2900, 4400)], 0.06, 0.04), 0.5, 0.2)
d = 1.0; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * np.cumsum(2400 + 600 * np.sin(2 * np.pi * 11 * t) + 700 * (t / d)) / SR) * adsr(d, 0.04, 0.3, 0.55, 0.2) * 0.4, 0.5, 0.25)
d = 2.0; t = tt(d)
S["gust"] = filt(noise(d), "bp", (220, 1300)) * np.sin(np.pi * t / d) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.1 * t))
y = blank(1.0)
for at, f in ((0, 440), (0.35, 370)): place(y, filt(sweep(f, f, 0.25, "saw", "lin") * 0.6 + sweep(f * 1.26, f * 1.26, 0.25, "saw", "lin") * 0.4, "lp", 2000) * adsr(0.25, 0.01, 0.1, 0.8, 0.05) * 0.4, at)
S["traffic"] = verb(y, 0.9, 0.4)
y = blank(1.4)
for at, f in ((0, 1900), (0.32, 2100), (0.62, 1800)):
    d = 0.26; t = tt(d)
    place(y, filt(sweep(f, f * 0.65, d, "saw"), "bp", (900, 4200)) * env(d, 0.02, 0.1) * (0.7 + 0.3 * np.sin(2 * np.pi * 30 * t)), at, 0.4)
S["gull"] = verb(y, 0.8, 0.35)
y = blank(1.8)
for i in range(6): place(y, bell(mtof(84 + [0, 3, 7, 10, 12, 15][int(RNG.random() * 6)]), 0.9, 1.3), i * 0.17 + RNG.random() * 0.05, 0.22)
S["chime"] = verb(y, 1.0, 0.4)
d = 2.4; t = tt(d)
S["hum"] = filt(sweep(60, 60, d, "saw", "lin") * 0.6 + sweep(120, 120, d, "sine", "lin") * 0.4, "lp", 500) * np.sin(np.pi * t / d) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t)) * 0.7
y = blank(1.6)
for i in range(4): place(y, sweep(1400 + RNG.random() * 900, 700 + RNG.random() * 300, 0.06) * env(0.06, 0.002, 0.02) * 0.4, i * 0.35 + RNG.random() * 0.1)
S["drip"] = verb(y, 1.2, 0.5)
y = blank(1.2)
for i in range(5): place(y, sweep(120 + RNG.random() * 60, 260 + RNG.random() * 120, 0.09) * env(0.09, 0.005, 0.04), i * 0.2 + RNG.random() * 0.06, 0.6)
place(y, filt(noise(1.2), "lp", 120) * 1.5 * np.sin(np.pi * tt(1.2) / 1.2), 0)
S["lava"] = y
d = 2.6; t = tt(d)
S["surf"] = filt(noise(d), "bp", (200, 3500)) * np.sin(np.pi * np.minimum(1, t / (d * 0.55))) ** 2 * np.exp(-np.maximum(0, t - d * 0.55) / 0.6) * 0.8
y = blank(0.9)
for at, f in ((0, 1300), (0.25, 1500)):
    d = 0.18; t = tt(d)
    place(y, filt(np.sign(np.sin(2 * np.pi * (f + 400 * np.sin(2 * np.pi * 18 * t)) * t)), "bp", (700, 4000)) * env(d, 0.005, 0.07) * 0.4, at)
S["parrot"] = verb(y, 0.6, 0.3)
y = blank(1.2)
for k in range(4):
    for i in range(3): place(y, sweep(4300, 4300, 0.02, "sine", "lin") * env(0.02, 0.002, 0.008), k * 0.28 + i * 0.035, 0.4)
S["cricket"] = verb(y, 0.6, 0.3)
y = blank(1.6)
for i in range(4): place(y, metal(180 + (i % 2) * 70, 0.3) * 0.3, i * 0.36); place(y, thud(90, 50, 0.12), i * 0.36, 0.4)
place(y, filt(noise(1.6), "lp", 300) * 0.4, 0)
S["machine"] = y
y = blank(1.2)
for i, f in enumerate((1500, 1100, 1800, 900)): place(y, sweep(f, f, 0.06, "square", "lin") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
S["beeps"] = y

if __name__ == "__main__":
    for k, y in S.items(): write(k, y, peak=0.85 if k not in ("gust", "lava", "surf", "hum", "machine", "drill", "drill_metal", "van_engine", "alarm") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
