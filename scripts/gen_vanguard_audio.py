"""Voxel Vanguard sound effects, synthesised from scratch (numpy + scipy; no samples, all original): a voice for each
blaster (the zapper's pew, the pulse rifle's buzz, the scatter blaster's boom, the rail lance's charged crack, the
rocket tube's whoosh, the arc caster's crackle), robot shots, cannon thumps, a sniper's beam, mortar whistles,
explosions and a boss going down, a boss's roar, hits, hurts and the shield, the jetpack, jumps, landings and
footsteps, reloads and swaps, pickups (coins, gems, hearts, oil glugs, power cubes), teleporting robots, wave alarms,
the stage-clear fanfare, the warp and the drop-in, menu sounds, the newer guns and mission guns, bomb throws, the EMP,
fire and gravity bombs, ammo, bomb and gun crates, and the worlds' ambience (songbirds, a gust,
crickets, an owl, traffic horns, a parrot, cave drips, machines, bubbling lava, surf, gulls, chimes, radio beeps, a
hum). The music is composed live in the game (src/vanguard/music.ts), so there are no music files.

usage: python scripts/gen_vanguard_audio.py [out-dir]          (default: public/audio/arcade)
  Files: sfx_vanguard_<name>.mp3 (mono). Needs ffmpeg on PATH or the imageio-ffmpeg package.
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
RNG = np.random.default_rng(20261128)
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
    tmp = os.path.join(tempfile.gettempdir(), f"vanguard_{name}.wav")
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f"sfx_vanguard_{name}.mp3")
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

# ---------------------------------------------------------------- blasters
def laser(f0, f1, d, kind="square", cut=5000):
    return filt(sweep(f0, f1, d, kind), "lp", cut) * env(d, 0.002, d * 0.35)

y = blank(0.35); place(y, laser(2200, 520, 0.18, "square", 6000), 0, 0.55); place(y, laser(1100, 300, 0.2, "saw", 3000), 0, 0.3)
place(y, filt(noise(0.03), "hp", 4000) * env(0.03, 0.001, 0.01) * 0.4, 0)
S["fire_zapper"] = y
y = blank(0.28); place(y, laser(1500, 420, 0.12, "saw", 4500), 0, 0.5); place(y, filt(noise(0.1), "bp", (800, 4000)) * env(0.1, 0.001, 0.03), 0, 0.35); place(y, thud(160, 70, 0.08), 0, 0.3)
S["fire_pulse"] = y
y = blank(0.7); place(y, filt(noise(0.35), "lp", 3500) * env(0.35, 0.001, 0.09), 0, 1.0); place(y, thud(120, 40, 0.3), 0, 0.9)
place(y, metal(900, 0.25) * 0.15, 0.02); place(y, filt(noise(0.05), "hp", 5000) * env(0.05, 0.0005, 0.015) * 0.5, 0)
place(y, metal(1400, 0.08) * 0.2, 0.3); place(y, metal(1100, 0.08) * 0.2, 0.42)
S["fire_scatter"] = verb(y, 0.4, 0.12)
y = blank(0.9); place(y, sweep(400, 2600, 0.12, "saw") * env(0.12, 0.08, 0.05) * 0.25, 0)
place(y, filt(noise(0.06), "hp", 2000) * env(0.06, 0.0005, 0.02), 0.11, 1.0); place(y, laser(3200, 600, 0.4, "square", 7000), 0.11, 0.5)
for k in range(4): place(y, bell(2400 + k * 700, 0.4, 2), 0.12, 0.08)
S["fire_rail"] = verb(y, 0.6, 0.2)
d = 0.8; t = tt(d)
y = filt(noise(d), "bp", (300, 3500)) * np.minimum(1, t / 0.01) * np.exp(-t / 0.3) * 0.7
place(y, thud(110, 45, 0.25), 0, 0.9); place(y, sweep(200, 900, 0.5, "saw") * env(0.5, 0.01, 0.2) * 0.12, 0.02)
S["fire_boom"] = y
y = blank(0.32)
for k in range(7):
    at = k * 0.04 + RNG.random() * 0.01
    place(y, filt(np.sign(sweep(800 + RNG.random() * 3000, 600 + RNG.random() * 1200, 0.03, "sine")), "bp", (900, 7000)) * env(0.03, 0.001, 0.01) * 0.6, at)
place(y, sweep(2400, 1600, 0.25, "sine") * env(0.25, 0.005, 0.1) * 0.2, 0)
S["fire_arc"] = y

# ---------------------------------------------------------------- robots
y = blank(0.35); place(y, laser(900, 260, 0.2, "saw", 3000), 0, 0.6); place(y, filt(noise(0.05), "bp", (500, 2500)) * env(0.05, 0.001, 0.02) * 0.3, 0)
S["enemyShot"] = y
y = blank(0.6); place(y, thud(90, 32, 0.4), 0, 1.0); place(y, filt(noise(0.25), "lp", 900) * env(0.25, 0.001, 0.08), 0, 0.6); place(y, sweep(500, 160, 0.3, "saw") * env(0.3, 0.005, 0.1) * 0.2, 0.01)
S["cannon"] = y
y = blank(0.7); place(y, laser(4000, 1800, 0.3, "square", 8000), 0, 0.4); d = 0.5; t = tt(d); place(y, filt(noise(d), "hp", 3000) * np.exp(-t / 0.15) * 0.4, 0)
place(y, sweep(2200, 2200, 0.4, "sine", "lin") * (0.5 + 0.5 * np.sin(2 * np.pi * 40 * tt(0.4))) * env(0.4, 0.01, 0.15) * 0.25, 0.02)
S["beam"] = verb(y, 0.5, 0.2)
y = blank(1.1); place(y, thud(180, 70, 0.12), 0, 0.7); place(y, metal(500, 0.1) * 0.2, 0)
d = 0.8; t = tt(d); place(y, sweep(2600, 900, d, "sine") * adsr(d, 0.05, 0.3, 0.6, 0.1) * 0.18, 0.15)
S["mortar"] = y

# ---------------------------------------------------------------- explosions
def blast(d=1.6, big=1.0):
    y = thud(90, 24, 0.8 * big) * 1.2
    place(y, filt(noise(1.2 * big), "lp", 1500) * env(1.2 * big, 0.003, 0.3 * big), 0, 1.1)
    place(y, filt(noise(0.08), "hp", 1500) * env(0.08, 0.0005, 0.02), 0, 0.8)
    for i in range(int(14 * big)): place(y, filt(noise(0.02), "bp", (1500, 7000)) * env(0.02, 0.0005, 0.007), 0.1 + RNG.random() * 0.8 * big, 0.08 + RNG.random() * 0.12)
    for i in range(3): place(y, metal(300 + RNG.random() * 600, 0.3) * 0.08, 0.05 + RNG.random() * 0.3)
    return y
S["boom"] = verb(blast(), 0.9, 0.22)
y = blank(3.4)
for k, at in enumerate((0, 0.35, 0.7, 1.1)): place(y, blast(1.6, 1.0 + k * 0.2), at, 0.7)
S["bossDown"] = verb(y, 1.4, 0.3)
d = 2.0; t = tt(d)
roar = filt(sweep(70, 55, d, "saw", "lin") * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t)) + sweep(140, 110, d, "square", "lin") * 0.3, "lp", 1200) * adsr(d, 0.15, 0.5, 0.8, 0.5)
place(roar, metal(220, 1.2) * 0.25, 0.1)
S["bossRoar"] = verb(roar, 1.2, 0.35)

# ---------------------------------------------------------------- hits, you
y = blank(0.3); place(y, metal(1300 + RNG.random() * 200, 0.2) * 0.5, 0); place(y, filt(noise(0.03), "hp", 3000) * env(0.03, 0.0005, 0.01) * 0.4, 0)
S["hit"] = y
y = blank(0.4); place(y, thud(150, 70, 0.2), 0, 0.9); place(y, filt(sweep(300, 180, 0.2, "square"), "lp", 1400) * env(0.2, 0.005, 0.07) * 0.4, 0); place(y, filt(noise(0.12), "bp", (400, 2000)) * env(0.12, 0.001, 0.04) * 0.4, 0)
S["hurt"] = y
y = blank(0.6); place(y, sweep(1200, 2400, 0.15, "square") * env(0.15, 0.002, 0.06) * 0.25, 0)
for m in (84, 91): place(y, bell(mtof(m), 0.5, 1.4), 0.01, 0.2)
S["shieldHit"] = verb(y, 0.5, 0.25)
d = 0.4; t = tt(d)
S["jet"] = filt(noise(d), "bp", (250, 2600)) * np.sin(np.pi * t / d) * 0.7 + filt(sweep(80, 90, d, "saw", "lin"), "lp", 400) * np.sin(np.pi * t / d) * 0.2
S["jump"] = filt(noise(0.3), "bp", (400, 3000)) * np.sin(np.pi * tt(0.3) / 0.3) ** 2 * 0.5 + sweep(200, 500, 0.3, "sine") * env(0.3, 0.01, 0.1) * 0.15
y = blank(0.45); place(y, thud(100, 40, 0.3), 0, 1.0); place(y, filt(noise(0.1), "lp", 800) * env(0.1, 0.001, 0.04), 0, 0.5); place(y, metal(400, 0.2) * 0.08, 0)
S["land"] = y
y = blank(0.15); place(y, filt(noise(0.04), "bp", (300, 2500)) * env(0.04, 0.001, 0.012), 0, 0.6); place(y, thud(140, 90, 0.05), 0, 0.3)
S["step"] = y
y = blank(0.7); place(y, metal(1800, 0.06) * 0.4, 0); place(y, thud(300, 200, 0.04), 0, 0.3); place(y, metal(1500, 0.06) * 0.4, 0.28); place(y, filt(noise(0.08), "bp", (1000, 4000)) * env(0.08, 0.002, 0.03) * 0.4, 0.3)
S["reload"] = y
y = blank(0.25); place(y, metal(2200, 0.08) * 0.5, 0); place(y, sweep(800, 1600, 0.08, "square") * env(0.08, 0.002, 0.03) * 0.15, 0.03)
S["reloaded"] = y
y = blank(0.4); place(y, metal(1200, 0.08) * 0.4, 0); place(y, metal(900, 0.08) * 0.4, 0.12); place(y, filt(noise(0.15), "bp", (500, 3000)) * np.sin(np.pi * tt(0.15) / 0.15) * 0.3, 0.02)
S["swap"] = y

# ---------------------------------------------------------------- pickups
y = blank(0.35); place(y, pluck(88, 0.22), 0, 0.7); place(y, pluck(95, 0.28), 0.05, 0.7); S["coin"] = y
y = blank(1.0)
for i, m in enumerate((86, 93, 98, 101, 105)): place(y, bell(mtof(m), 0.7, 1.6), i * 0.05, 0.36)
S["gem"] = verb(y, 0.8, 0.3)
y = blank(0.9)
for i, m in enumerate((72, 76, 79, 84)): place(y, synth(m, 0.25, 4000), i * 0.07, 0.35)
S["heart"] = verb(y, 0.5, 0.22)
y = blank(1.0)
for i in range(6):
    f = 110 + i * 25
    place(y, filt(sweep(f, f * 2.4, 0.07) * env(0.07, 0.002, 0.03), "lp", 1500), 0.02 + i * 0.07, 0.6)
place(y, filt(sweep(300, 1100, 0.3, "saw"), "lp", 2500) * env(0.3, 0.02, 0.12) * 0.3, 0.5)
S["oil"] = y
y = blank(0.9); place(y, filt(sweep(200, 1800, 0.4, "saw"), "lp", 3500) * env(0.4, 0.02, 0.18) * 0.4, 0)
for i, m in enumerate((81, 86, 90, 93)): place(y, bell(mtof(m), 0.4, 1.1), 0.14 + i * 0.045, 0.25)
S["power"] = verb(y, 0.5, 0.25)
y = blank(0.6)
for i, f in enumerate((880, 660, 880)): place(y, filt(sweep(f, f, 0.12, "square", "lin"), "lp", 2500) * adsr(0.12, 0.005, 0.05, 0.6, 0.03), i * 0.16, 0.4)
S["lowFuel"] = y
y = blank(1.0); place(y, sweep(300, 2400, 0.6, "sine") * env(0.6, 0.3, 0.15) * 0.3, 0)
for i in range(8): place(y, bell(1800 + RNG.random() * 2400, 0.25, 2), 0.1 + i * 0.06, 0.06)
S["teleport"] = verb(y, 0.6, 0.3)

# ---------------------------------------------------------------- the stage
y = blank(1.6)
for k in range(2):
    for i, f in enumerate((660, 520)): place(y, filt(sweep(f, f, 0.32, "saw", "lin"), "lp", 2600) * adsr(0.32, 0.01, 0.1, 0.8, 0.05) * 0.35, k * 0.7 + i * 0.34)
S["wave"] = verb(y, 0.6, 0.25)
y = blank(0.9)
for i, m in enumerate((79, 84, 88)): place(y, pluck(m, 0.4), i * 0.07, 0.55)
S["waveClear"] = verb(y, 0.5, 0.2)
y = blank(3.2)
for m, at, dd in ((67, 0, 0.14), (67, 0.14, 0.14), (72, 0.28, 0.14), (76, 0.42, 0.5), (74, 0.95, 0.16), (76, 1.12, 0.16), (79, 1.3, 1.2)):
    place(y, brass(m, dd + 0.08), at, 0.45); place(y, brass(m - 12, dd + 0.08), at, 0.2); place(y, synth(m + 12, dd + 0.05, 4500), at, 0.08)
for m in (84, 88, 91, 96): place(y, bell(mtof(m), 1.4), 1.32, 0.14)
S["stageClear"] = verb(y, 1.0, 0.3)
d = 1.3; t = tt(d)
y = filt(noise(d), "bp", (300, 5000)) * (t / d) ** 2 * np.exp(-np.maximum(0, t - d * 0.8) / 0.08) * 0.8
place(y, sweep(200, 3000, d, "sine") * (t / d) * 0.2, 0)
S["warp"] = y
y = blank(1.6); d = 0.7; place(y, filt(noise(d), "bp", (300, 3000)) * (tt(d) / d) ** 1.5 * 0.6, 0)
place(y, thud(110, 35, 0.5), 0.7, 1.0); place(y, filt(noise(0.3), "lp", 1200) * env(0.3, 0.002, 0.08), 0.7, 0.6)
for m in (72, 76, 79): place(y, synth(m, 0.5, 3500), 0.8, 0.18)
S["start"] = verb(y, 0.7, 0.25)
y = blank(1.4)
for i, m in enumerate((72, 67, 63)): place(y, synth(m, 0.36, 1800), i * 0.26, 0.45)
S["lifeLost"] = verb(y, 0.6, 0.2)
y = blank(0.9)
for i, m in enumerate((67, 62)): place(y, synth(m, 0.3, 1600), i * 0.2, 0.35)
S["downed"] = y
y = blank(0.9)
for i, m in enumerate((67, 72, 79)): place(y, pluck(m, 0.35), i * 0.08, 0.5)
S["revive"] = verb(y, 0.5, 0.2)

# ---------------------------------------------------------------- menus
S["tap"] = fm(760, 0.06, 2.0, 1.4, 0.02) * 0.8
y = blank(0.4); place(y, filt(noise(0.25), "bp", (600, 3500)) * env(0.25, 0.06, 0.06) * 0.5, 0); place(y, pluck(86, 0.3), 0.08, 0.5)
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
S["birdA"] = verb(chirps([(3600, 5200), (3600, 5200), (4200, 2800), (3000, 4600)], 0.06, 0.035), 0.5, 0.2)
d = 1.0; t = tt(d)
S["birdB"] = verb(np.sin(2 * np.pi * np.cumsum(2600 + 500 * np.sin(2 * np.pi * 14 * t) + 800 * (t / d)) / SR) * adsr(d, 0.04, 0.3, 0.55, 0.2) * 0.4, 0.5, 0.25)
d = 2.0; t = tt(d)
S["gust"] = filt(noise(d), "bp", (220, 1300)) * np.sin(np.pi * t / d) ** 2 * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * t))
y = blank(1.2)
for k in range(4):
    for i in range(3): place(y, sweep(4300, 4300, 0.02, "sine", "lin") * env(0.02, 0.002, 0.008), k * 0.28 + i * 0.035, 0.4)
S["cricket"] = verb(y, 0.6, 0.3)
y = blank(1.3)
for at, f in ((0, 330), (0.32, 320), (0.6, 310)): place(y, filt(sweep(f, f * 0.92, 0.28, "tri"), "lp", 800) * adsr(0.28, 0.04, 0.12, 0.6, 0.1), at, 0.5)
S["owl"] = verb(y, 1.0, 0.45)
y = blank(1.0)
for at, f in ((0, 420), (0.35, 360)): place(y, filt(sweep(f, f, 0.25, "saw", "lin") * 0.6 + sweep(f * 1.26, f * 1.26, 0.25, "saw", "lin") * 0.4, "lp", 2000) * adsr(0.25, 0.01, 0.1, 0.8, 0.05) * 0.4, at)
S["horn"] = verb(y, 0.9, 0.4)
y = blank(0.9)
for at, f in ((0, 1300), (0.25, 1500)):
    d = 0.18; t = tt(d)
    place(y, filt(np.sign(np.sin(2 * np.pi * (f + 400 * np.sin(2 * np.pi * 18 * t)) * t)), "bp", (700, 4000)) * env(d, 0.005, 0.07) * 0.4, at)
S["parrot"] = verb(y, 0.6, 0.3)
y = blank(1.6)
for i in range(4): place(y, sweep(1400 + RNG.random() * 900, 700 + RNG.random() * 300, 0.06) * env(0.06, 0.002, 0.02) * 0.4, i * 0.35 + RNG.random() * 0.1)
S["drip"] = verb(y, 1.2, 0.5)
y = blank(1.6)
for i in range(4): place(y, metal(180 + (i % 2) * 70, 0.3) * 0.3, i * 0.36); place(y, thud(90, 50, 0.12), i * 0.36, 0.4)
place(y, filt(noise(1.6), "lp", 300) * 0.4, 0)
S["machine"] = y
y = blank(1.2)
for i in range(5): place(y, sweep(120 + RNG.random() * 60, 260 + RNG.random() * 120, 0.09) * env(0.09, 0.005, 0.04), i * 0.2 + RNG.random() * 0.06, 0.6)
place(y, filt(noise(1.2), "lp", 120) * 1.5 * np.sin(np.pi * tt(1.2) / 1.2), 0)
S["lava"] = y
d = 2.6; t = tt(d)
S["wave2"] = filt(noise(d), "bp", (200, 3500)) * np.sin(np.pi * np.minimum(1, t / (d * 0.55))) ** 2 * np.exp(-np.maximum(0, t - d * 0.55) / 0.6) * 0.8
y = blank(1.4)
for at, f in ((0, 1900), (0.32, 2100), (0.62, 1800)):
    d = 0.26; t = tt(d)
    place(y, filt(sweep(f, f * 0.65, d, "saw"), "bp", (900, 4200)) * env(d, 0.02, 0.1) * (0.7 + 0.3 * np.sin(2 * np.pi * 30 * t)), at, 0.4)
S["gull"] = verb(y, 0.8, 0.35)
y = blank(1.8)
for i in range(6): place(y, bell(mtof(84 + [0, 3, 7, 10, 12, 15][int(RNG.random() * 6)]), 0.9, 1.3), i * 0.17 + RNG.random() * 0.05, 0.22)
S["chime"] = verb(y, 1.0, 0.4)
y = blank(1.2)
for i, f in enumerate((1500, 1100, 1800, 900)): place(y, sweep(f, f, 0.06, "square", "lin") * env(0.06, 0.002, 0.02) * 0.3, i * 0.11)
S["radio"] = y
d = 2.4; t = tt(d)
S["hum"] = filt(sweep(60, 60, d, "saw", "lin") * 0.6 + sweep(120, 120, d, "sine", "lin") * 0.4, "lp", 500) * np.sin(np.pi * t / d) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t)) * 0.7

# ---------------------------------------------------------------- more guns, the mission guns, bombs and crates
y = blank(0.3); place(y, laser(2600, 700, 0.1, "square", 6500), 0, 0.5); place(y, laser(1800, 500, 0.1, "square", 5000), 0.05, 0.35)
S["fire_twin"] = y
y = blank(0.16); place(y, laser(1700, 600, 0.07, "saw", 5000), 0, 0.45); place(y, thud(220, 120, 0.05), 0, 0.3); place(y, filt(noise(0.04), "hp", 3000) * env(0.04, 0.001, 0.012), 0, 0.25)
S["fire_minigun"] = y
d = 0.3; t = tt(d)
S["fire_laser"] = (sweep(1400, 1400, d, "saw", "lin") * 0.25 + sweep(2800, 2800, d, "sine", "lin") * 0.2) * (0.7 + 0.3 * np.sin(2 * np.pi * 50 * t)) * adsr(d, 0.01, 0.1, 0.8, 0.08)
y = blank(0.9); place(y, sweep(300, 1400, 0.15, "sine") * env(0.15, 0.1, 0.05) * 0.4, 0); place(y, thud(160, 50, 0.4), 0.12, 0.9); place(y, laser(900, 200, 0.5, "saw", 2500), 0.12, 0.4)
S["fire_plasma"] = verb(y, 0.6, 0.2)
y = blank(0.7)
for k in range(4): place(y, filt(noise(0.25), "bp", (400, 3000)) * np.minimum(1, tt(0.25) / 0.005) * np.exp(-tt(0.25) / 0.1) * 0.5, k * 0.07)
S["fire_swarm"] = y
y = blank(0.16); place(y, laser(2200, 900, 0.07, "saw", 6000), 0, 0.5); place(y, metal(2400, 0.05) * 0.15, 0); place(y, thud(240, 130, 0.05), 0, 0.3)
S["fire_omega"] = y
y = blank(1.4); place(y, sweep(200, 2200, 0.2, "sine") * env(0.2, 0.15, 0.05) * 0.4, 0); place(y, blast(1.0, 0.8), 0.18, 0.9)
S["fire_nova"] = verb(y, 0.9, 0.25)
y = blank(0.6); place(y, filt(noise(0.05), "hp", 2000) * env(0.05, 0.0005, 0.02), 0, 0.9); place(y, laser(3600, 700, 0.3, "square", 8000), 0, 0.5)
for k in range(3): place(y, bell(2600 + k * 900, 0.3, 2), 0.01, 0.07)
S["fire_storm"] = verb(y, 0.5, 0.2)
d = 0.4; t = tt(d)
S["fire_inferno"] = filt(noise(d), "bp", (250, 2400)) * (0.7 + 0.3 * np.sin(2 * np.pi * 17 * t)) * adsr(d, 0.03, 0.1, 0.8, 0.1) * 0.8
S["throw"] = filt(noise(0.25), "bp", (500, 2600)) * np.sin(np.pi * tt(0.25) / 0.25) ** 3 * 0.8
y = blank(1.2); place(y, sweep(3000, 200, 0.6, "square") * env(0.6, 0.005, 0.25) * 0.35, 0); place(y, filt(noise(0.8), "hp", 2500) * np.exp(-tt(0.8) / 0.2) * 0.5, 0)
for k in range(6): place(y, sweep(1800 + RNG.random() * 2000, 600, 0.05, "square") * env(0.05, 0.001, 0.02) * 0.25, 0.1 + k * 0.08)
S["emp"] = verb(y, 0.8, 0.3)
d = 1.6; t = tt(d)
y = filt(noise(d), "bp", (200, 2500)) * adsr(d, 0.05, 0.3, 0.7, 0.5) * (0.7 + 0.3 * np.sin(2 * np.pi * 11 * t)); place(y, thud(130, 50, 0.3), 0, 0.7)
S["fireBomb"] = y
d = 1.6; t = tt(d)
y = sweep(80, 420, d, "saw") * adsr(d, 0.4, 0.4, 0.7, 0.2) * 0.4; place(y, filt(noise(d), "lp", 600) * (t / d) * 0.5, 0)
S["gravity"] = verb(filt(y, "lp", 2500), 1.0, 0.35)
y = blank(0.5)
for k in range(4): place(y, metal(1800 + k * 200, 0.08) * 0.3, k * 0.05)
place(y, thud(220, 140, 0.08), 0.22, 0.5)
S["ammo"] = y
y = blank(0.6); place(y, thud(180, 90, 0.12), 0, 0.6); place(y, metal(700, 0.2) * 0.3, 0.02); place(y, pluck(76, 0.3) * 0.4, 0.12); place(y, pluck(81, 0.3) * 0.4, 0.2)
S["bombPick"] = y
y = blank(1.4)
for i, m in enumerate((67, 71, 74, 79, 83, 86, 91)): place(y, brass(m, 0.16) * 0.4, i * 0.07)
place(y, bell(mtof(98), 0.8) * 0.3, 0.5)
S["gunPick"] = verb(y, 0.8, 0.3)

if __name__ == "__main__":
    only_new = os.environ.get("ONLY_NEW") == "1"
    for k, y in S.items():
        if only_new and os.path.exists(os.path.join(OUT, f"sfx_vanguard_{k}.mp3")): continue
        write(k, y, peak=0.85 if k not in ("gust", "lava", "wave2", "hum", "machine") else 0.7)
    print("done:", len(S), "sounds into", os.path.abspath(OUT))
