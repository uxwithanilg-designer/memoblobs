"""Arcade sound pack #2 (memory games): 5 music styles (calm + action), extra funny SFX, voices
for Tiki, Bolt and Bonbon.  usage: python scripts/gen_arcade_audio2.py <momo/tools> <out-wav-dir>"""
import json
import os
import sys
import wave
import zlib

import numpy as np

sys.path.insert(0, sys.argv[1])
import audio as A  # noqa: E402
from audio import SR, T, noise, lp, hp, bp, sweep, midi, adsr, saw, place, marimba, pluck_bass, kick, hat, clap, shaker  # noqa: E402

OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
META = {"music": {}, "sfx": [], "voice": []}


def seed(name): return np.random.default_rng(zlib.crc32(name.encode()))


def write(name, y, peak=0.9):
    y = np.asarray(y, dtype=np.float64)
    if y.ndim == 1: y = y[None, :]
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    pcm = (y.T * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(pcm.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def mix(y, x, o, g=1.0):
    o = int(o)
    if o >= len(y) or o < 0: return y
    k = min(len(x), len(y) - o); y[o:o + k] += np.asarray(x[:k]) * g
    return y


# ---------------------------------------------------------------- instruments
def steel(f, d=0.6):
    t = T(d)
    y = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t * 4) + 0.3 * np.sin(2 * np.pi * f * 3.94 * t) * np.exp(-t * 7) + 0.15 * np.sin(2 * np.pi * f * 5.2 * t) * np.exp(-t * 10)
    return y * np.exp(-t * 3.2) * adsr(len(t), 0.003, 0.05, 1, 0.05) * 0.45


def conga(f=200, d=0.25):
    t = T(d); ff = f * (1 + 0.6 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 14) * 0.7 + bp(noise(d), 800, 3000) * np.exp(-t * 60) * 0.2


def pluck(f, d=0.6, bright=0.6, decay=3.0):
    t = T(d); y = np.zeros(len(t))
    for k in range(1, 10):
        if f * k > 16000: break
        y += np.sin(2 * np.pi * f * k * t * (1 + 0.0007 * k * k)) / k ** (1.6 - bright) * np.exp(-t * (decay + k * 1.4))
    y[:240] += hp(noise(240 / SR), 2500) * np.linspace(0.3, 0, 240)
    return y * 0.6


def pizz(f): return bp(pluck(f, 0.28, 0.5, 9.0), 150, 4000) * 1.3


def reed(f, d=0.3, formant=(450, 1100), vib=0.006):
    t = T(d)
    src = saw(f * (1 + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.15, 0, 1)), d)
    y = bp(src, formant[0] * 0.6, formant[0] * 1.6) + 0.5 * bp(src, formant[1] * 0.8, formant[1] * 1.4)
    return np.tanh(y * 1.5) * adsr(len(t), 0.02, 0.06, 0.85, 0.06) * 0.5


def clarinet(f, d=0.3):
    t = T(d); ph = 2 * np.pi * f * t * (1 + 0.004 * np.sin(2 * np.pi * 5 * t))
    y = sum(np.sin(k * ph) / k for k in (1, 3, 5, 7, 9))
    return lp(y, 2600) * adsr(len(t), 0.03, 0.05, 0.85, 0.06) * 0.4


def pulse(f, d=0.15, duty=0.25):
    t = T(d); ph = (f * t) % 1.0
    y = np.where(ph < duty, 1.0, -1.0) * 0.5
    return lp(y, 6000) * adsr(len(t), 0.002, 0.04, 0.7, 0.03) * 0.35


def tri(f, d=0.2):
    t = T(d); ph = (f * t) % 1.0
    return (4 * np.abs(ph - 0.5) - 1) * adsr(len(t), 0.003, 0.05, 0.8, 0.03) * 0.6


def nylon(f, d=0.8): return lp(pluck(f, d, 0.35, 2.2), 3200)


def flute(f, d=0.4):
    t = T(d); ph = 2 * np.pi * f * t * (1 + 0.006 * np.sin(2 * np.pi * 5 * t) * np.clip(t / 0.2, 0, 1))
    y = np.sin(ph) + 0.15 * np.sin(2 * ph) + bp(noise(d), 1500, 4000) * 0.08
    return y * adsr(len(t), 0.04, 0.05, 0.85, 0.08) * 0.35


def supersaw(f, d=1.5):
    t = T(d); y = np.zeros(len(t))
    for det in (-0.012, -0.005, 0, 0.006, 0.013): y += saw(f * (1 + det), d)
    return lp(y / 5, 1800) * adsr(len(t), 0.25, 0.3, 0.8, 0.4) * 0.35


def synth_pluck(f, d=0.25):
    t = T(d); y = saw(f, d) * 0.6 + saw(f * 2.005, d) * 0.3
    return lp(y, 3200) * np.exp(-t * 11) * 0.5


def rim(): return A._wood(1700, 140) * 0.7


def snap(): d = 0.06; t = T(d); return hp(noise(d), 2000) * np.exp(-t * 80) * 0.8


def snare(g=1.0):
    d = 0.22; t = T(d)
    return (bp(noise(d), 1500, 7000) * np.exp(-t * 22) * 0.7 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30) * 0.5) * g


def gated_snare():
    d = 0.32; t = T(d)
    return (bp(noise(d), 1200, 8000) * (t < 0.22) * 0.8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.6) * np.exp(-t * 3)


def brush(): d = 0.18; t = T(d); return bp(noise(d), 2500, 9000) * np.sin(np.pi * t / d) ** 2 * 0.25


def chip_noise(d=0.08):
    t = T(d); n = np.sign(noise(d)); n = np.repeat(n[::8], 8)[: len(t)]
    return n * np.exp(-t * 35) * 0.3


def steps(bpm, bars, swing=0.0):
    st = 60 / bpm / 4
    for s in range(bars * 16):
        yield s, s * st + (swing * st if s % 2 == 1 else 0), s // 16, s % 16


def motif(rs, scale, n_steps=32, density=0.55, max_len=3):
    out, s = [], 0
    while s < n_steps:
        if rs.random() < density:
            ln = int(rs.integers(1, max_len + 1)); out.append((s, scale[int(rs.integers(0, len(scale)))], ln)); s += ln
        else: s += 1
    return out


def song(name, bpm, bars, body, tail=1.5, swing=0.0):
    d = bars * 4 * 60 / bpm
    buf = np.zeros((2, int((d + tail) * SR)))
    body(buf, bpm, bars, seed(name), swing)
    buf = np.tanh(buf * 1.1) / np.tanh(1.1)
    write("music_" + name, buf, peak=0.6)
    META["music"][name] = {"loop": round(d, 6), "tail": tail, "bpm": bpm}


# ---------------------------------------------------------------- 1. Memory Bridge — tropical steel-drum calypso
def bridge_body(action):
    PROG = [(48, [60, 64, 67]), (53, [60, 65, 69]), (55, [59, 62, 67]), (48, [60, 64, 67])]
    MEL = [72, 74, 76, 79, 81, 84]

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, MEL, 32, 0.55, 2)
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 in (0, 6, 8, 14): place(buf, pluck_bass(midi(root - 12 + (7 if s16 in (6, 14) else 0)), 0.3), t, 0.55)
            if s16 % 4 == 2:
                for i, m in enumerate(ch): place(buf, steel(midi(m + 12), 0.25), t + i * 0.01, 0.13, -0.3 + i * 0.3)
            if s16 % 2 == 0: place(buf, shaker(), t, 0.25, 0.4)
            if s16 in (3, 7, 11, 13): place(buf, conga(220 if s16 % 4 == 3 else 170), t, 0.35, -0.4)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc: place(buf, steel(midi(m), 0.4 + 0.1 * ln), t, 0.32, rs.uniform(-0.4, 0.4))
            if action:
                if s16 % 4 == 0: place(buf, kick(), t, 0.5)
                if s16 in (4, 12): place(buf, snare(0.5), t, 0.4)
                if s16 % 2 == 1: place(buf, hat(), t, 0.12, 0.3)
    return body


# ---------------------------------------------------------------- 2. Pip's Pantry — cartoon kitchen swing (bassoon + clarinet)
def pantry_body(action):
    PROG = [(50, [62, 66, 69]), (55, [62, 67, 71]), (57, [61, 64, 69]), (50, [62, 66, 69])]
    MEL = [74, 76, 78, 79, 81, 83, 86]

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, MEL, 32, 0.5, 2)
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 % 4 == 0:
                walk = [0, 4, 7, 4][s16 // 4]
                place(buf, reed(midi(root - 12 + walk), 0.22), t, 0.6)
            if s16 in (4, 12):
                for m in ch: place(buf, pizz(midi(m)), t, 0.18)
            if s16 % 4 == 2: place(buf, A._wood(1600, 120), t, 0.2, 0.5)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc and bar % 4 != 2: place(buf, clarinet(midi(m - 12), 0.18 * ln + 0.05), t, 0.4, -0.2)
            if bar % 4 == 3 and s16 == 12: place(buf, A.sfx_boing(1.4, 0.25), t, 0.18)
            if action:
                if s16 % 4 == 0: place(buf, kick(), t, 0.45)
                if s16 in (4, 12): place(buf, snap(), t, 0.4)
                if s16 % 2 == 0: place(buf, hat(s16 % 8 == 6), t, 0.1, 0.3)
    return body


# ---------------------------------------------------------------- 3. Bolt's Beep Boop — chiptune
def beeps_body(action):
    PROG = [(45, [57, 60, 64]), (48, [55, 60, 64]), (43, [55, 59, 62]), (41, [53, 57, 60])]
    MEL = [69, 72, 74, 76, 79, 81]

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, MEL, 32, 0.6, 2)
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 % 2 == 0: place(buf, tri(midi(root - 12 + (12 if s16 % 4 == 2 else 0)), 0.18), t, 0.6)
            place(buf, pulse(midi(ch[s % 3] + 12), 0.09, 0.125), t, 0.12, -0.5 if s % 2 else 0.5)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc: place(buf, pulse(midi(m), 0.12 * ln, 0.25), t, 0.3)
            if s16 in (0, 8) or (action and s16 % 4 == 0): place(buf, kick(), t, 0.45)
            if s16 in (4, 12): place(buf, chip_noise(0.12), t, 0.6)
            if action and s16 % 2 == 1: place(buf, chip_noise(0.03), t, 0.4, 0.3)
    return body


# ---------------------------------------------------------------- 4. Order Up! — café bossa nova
def cafe_body(action):
    PROG = [(41, [52, 57, 60, 64]), (40, [50, 55, 59, 62]), (38, [50, 53, 57, 60]), (43, [50, 53, 55, 59])]  # Fmaj7 Em7 Dm7 G7
    MEL = [72, 74, 76, 77, 79, 81]
    CLAVE = (0, 3, 6, 10, 12)

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, MEL, 32, 0.4, 3)
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 in (0, 6, 8, 14): place(buf, pluck_bass(midi(root - 12 + (7 if s16 in (6, 14) else 0)), 0.4), t, 0.5)
            if s16 in (0, 3, 6, 10, 13):
                for i, m in enumerate(ch): place(buf, nylon(midi(m), 0.6), t + i * 0.008, 0.12, -0.2 + i * 0.12)
            if s16 % 2 == 0: place(buf, shaker(), t, 0.22, 0.4)
            if s16 in CLAVE: place(buf, rim(), t, 0.25, -0.5)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc and bar % 4 != 1: place(buf, flute(midi(m), 0.2 * ln + 0.1), t, 0.35, 0.2)
            if action:
                if s16 in (0, 8): place(buf, kick(), t, 0.4)
                if s16 % 4 == 2: place(buf, brush(), t, 0.4, 0.3)
    return body


# ---------------------------------------------------------------- 5. Glow Grid — synthwave
def glow_body(action):
    PROG = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]  # Am F C G

    def body(buf, bpm, bars, rs, swing):
        st = 60 / bpm / 4
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 == 0:
                for m in ch: place(buf, supersaw(midi(m), st * 16 + 0.3), t, 0.18, rs.uniform(-0.3, 0.3))
            arp = [ch[0], ch[1], ch[2], ch[1] + 12][s16 % 4] + 12
            if s16 % 2 == 0 or action: place(buf, synth_pluck(midi(arp), 0.2), t, 0.2, -0.45 if s16 % 4 < 2 else 0.45)
            if s16 % 2 == 0: place(buf, pluck_bass(midi(root - 12), 0.2), t, 0.45)
            if s16 in (0, 8) or (action and s16 % 4 == 0): place(buf, kick(), t, 0.5)
            if s16 in (4, 12): place(buf, gated_snare(), t, 0.45)
            if action and s16 % 2 == 1: place(buf, hat(), t, 0.12, 0.35)
    return body


for game, body, bpm in [("bridge", bridge_body, 112), ("pantry", pantry_body, 100), ("beeps", beeps_body, 120), ("cafe", cafe_body, 96), ("glow", glow_body, 100)]:
    song(f"{game}_calm", bpm, 8, body(False), swing=0.3 if game == "pantry" else 0.0)
    song(f"{game}_action", int(bpm * 1.15), 8, body(True), swing=0.3 if game == "pantry" else 0.0)


# ================================================================ SFX
def chirp(f0, f1, d, shape=1.0):
    t = T(d); f = f0 + (f1 - f0) * (t / d) ** shape
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def s_door_open():
    d = 0.6; t = T(d); f = 300 + 200 * np.sin(2 * np.pi * 3 * t)
    creak = bp(saw(f, d), 400, 1800) * (np.abs(np.sin(2 * np.pi * 26 * t)) ** 3) * np.sin(np.pi * t / d) * 0.6
    pop = np.zeros(len(t)); mix(pop, A.sfx_pop(0.6), 0, 0.6)
    return creak + pop


def s_door_close():
    d = 0.3; t = T(d)
    return np.sin(2 * np.pi * np.cumsum(120 * np.exp(-t * 6) + 50) / SR) * np.exp(-t * 18) + lp(noise(d), 900) * np.exp(-t * 30) * 0.6


def s_register():
    y = np.zeros(int(1.2 * SR))
    mix(y, A._wood(2200, 120), 0, 0.6); mix(y, A._wood(1600, 110), int(0.06 * SR), 0.5)
    mix(y, A._bell(A.midi(96), 0.9), int(0.12 * SR), 0.7); mix(y, A._bell(A.midi(100), 0.9), int(0.14 * SR), 0.5)
    r = seed("register")
    for i in range(10): c = A._bell(r.uniform(3000, 5000), 0.12) * 0.25; mix(y, c, int((0.25 + i * 0.04) * SR))
    return y


def s_plop():
    d = 0.22; t = T(d)
    return chirp(500, 140, d, 0.5) * np.exp(-t * 14) * 0.9 + lp(noise(d), 1200) * np.exp(-t * 30) * 0.3


def s_croak():
    d = 0.4; t = T(d); f = 110 * (1 + 0.1 * np.sin(2 * np.pi * 30 * t))
    v = sum(np.sin(k * 2 * np.pi * np.cumsum(f) / SR) / k for k in range(1, 14))
    return bp(v, 200, 1500) * np.abs(np.sin(2 * np.pi * 14 * t)) * np.sin(np.pi * t / d) * 1.2


def s_tweet():
    y = np.zeros(int(0.5 * SR))
    for i, (a, b) in enumerate([(2500, 4200), (3800, 2600), (2800, 4600)]):
        x = chirp(a, b, 0.07) * np.sin(np.pi * T(0.07) / 0.07); mix(y, x, int(i * 0.1 * SR), 0.5)
    return y


def s_sparks():
    d = 0.7; t = T(d); r = seed("sparks"); y = np.zeros(len(t))
    for _ in range(40):
        c = hp(noise(0.006), 3000) * r.uniform(0.3, 1); mix(y, c, int(r.uniform(0, d - 0.02) * SR))
    return y + bp(noise(d), 2000, 8000) * np.exp(-t * 5) * 0.2 + np.sin(2 * np.pi * 120 * t) * np.exp(-t * 3) * 0.15


def s_robodance():
    y = np.zeros(int(1.0 * SR))
    for i, m in enumerate([72, 76, 79, 76, 84, 79, 88]): mix(y, pulse(midi(m), 0.09, 0.5), int(i * 0.11 * SR), 0.8)
    return y


def s_cork(): d = 0.2; t = T(d); return chirp(900, 300, d, 0.4) * np.exp(-t * 18) + hp(noise(d), 2000) * np.exp(-t * 60) * 0.3


def s_stone():
    d = 0.18; t = T(d)
    return np.sin(2 * np.pi * np.cumsum(260 * np.exp(-t * 8) + 90) / SR) * np.exp(-t * 20) + bp(noise(d), 600, 2400) * np.exp(-t * 40) * 0.3


def s_sink():
    d = 0.9; t = T(d)
    return chirp(600, 120, d, 0.7) * np.exp(-t * 3) * 0.5 + bp(noise(d), 300, 1500) * np.exp(-t * 4) * 0.2


def s_topple():
    y = np.zeros(int(1.1 * SR))
    mix(y, A.sfx_whoosh(0.4), 0, 0.5); mix(y, s_plop(), int(0.35 * SR), 0.8); mix(y, A.sfx_squish(), int(0.42 * SR), 0.8); mix(y, s_plop(), int(0.55 * SR), 0.6)
    return y


def s_nomnom():
    y = np.zeros(int(0.9 * SR))
    for i in range(3):
        d = 0.16; t = T(d); x = bp(noise(d), 200, 1200) * (np.abs(np.sin(2 * np.pi * 9 * t))) * np.sin(np.pi * t / d); mix(y, x, int(i * 0.22 * SR), 0.9)
    return y


SFX = {"doorOpen": s_door_open, "doorClose": s_door_close, "register": s_register, "plop": s_plop, "croak": s_croak, "tweet": s_tweet,
       "sparks": s_sparks, "robodance": s_robodance, "cork": s_cork, "stone": s_stone, "sink": s_sink, "topple": s_topple, "nomnom": s_nomnom}
for name, fn in SFX.items():
    write("sfx_" + name, fn(), 0.9); META["sfx"].append(name)


# ================================================================ voices
VOW = {"a": (800, 1250), "e": (420, 2100), "i": (300, 2400), "o": (480, 880), "u": (330, 820)}


def gibber(name, d, base, contour, vowels="aeiou", syl=(0.07, 0.12), gap=(0.01, 0.035), ring=0.0, square=False, crush=0):
    r = seed(name); y = np.zeros(int((d + 0.25) * SR)); t0 = 0.0
    while t0 < d:
        sd = r.uniform(*syl); t = T(sd)
        f = base * contour(t0 / d) * r.uniform(0.9, 1.15) * (1 + 0.12 * np.sin(np.pi * t / sd))
        ph = 2 * np.pi * np.cumsum(np.full(len(t), 1.0) * f) / SR
        src = np.sign(np.sin(ph)) * 0.6 if square else sum(np.sin(k * ph) / k for k in range(1, 24))
        f1, f2 = VOW[vowels[int(r.integers(0, len(vowels)))]]
        v = bp(src, f1 * 0.7, f1 * 1.3) + 0.6 * bp(src, f2 * 0.8, min(f2 * 1.2, 20000))
        v *= np.sin(np.pi * t / sd) ** 0.7
        mix(y, v, int(t0 * SR))
        t0 += sd + r.uniform(*gap)
    tt = np.arange(len(y)) / SR
    if ring: y = y * np.sin(2 * np.pi * ring * tt) * 1.4 + y * 0.3
    if crush: y = np.round(y * crush) / crush
    return y


def chirps(name, n, base, up=True):
    r = seed(name); y = np.zeros(int((n * 0.12 + 0.2) * SR))
    for i in range(n):
        a = base * r.uniform(0.9, 1.2); b = a * (1.5 if up else 0.65)
        x = chirp(a, b, 0.08) * np.sin(np.pi * T(0.08) / 0.08); mix(y, x, int(i * 0.11 * SR), 0.6)
    return y


up = lambda u: 1 + 0.45 * u
down = lambda u: 1.25 - 0.5 * u
hump = lambda u: 1 + 0.3 * np.sin(np.pi * u)
laughc = lambda u: 1.3 - 0.4 * u

VOICES = {
    "tiki_happy": lambda: chirps("tiki_happy", 4, 2400, True),
    "tiki_wow": lambda: gibber("tiki_wow", 0.5, 820, up, "o", (0.12, 0.18)),
    "tiki_sad": lambda: chirps("tiki_sad", 3, 2600, False),
    "tiki_laugh": lambda: gibber("tiki_laugh", 0.7, 900, laughc, "ie", (0.05, 0.06), (0.03, 0.05)),
    "bolt_happy": lambda: gibber("bolt_happy", 0.7, 300, hump, "aeo", (0.06, 0.09), square=True, crush=8),
    "bolt_wow": lambda: gibber("bolt_wow", 0.5, 260, up, "o", (0.12, 0.18), square=True, crush=8, ring=60),
    "bolt_sad": lambda: gibber("bolt_sad", 0.9, 320, down, "ou", (0.14, 0.22), square=True, crush=6),
    "bolt_laugh": lambda: gibber("bolt_laugh", 0.8, 360, laughc, "ae", (0.05, 0.06), (0.02, 0.04), square=True, crush=8),
    "bonbon_happy": lambda: gibber("bonbon_happy", 0.8, 175, hump, "ou", (0.09, 0.14)),
    "bonbon_wow": lambda: gibber("bonbon_wow", 0.55, 160, up, "o", (0.18, 0.25)),
    "bonbon_sad": lambda: gibber("bonbon_sad", 0.9, 190, down, "ou", (0.15, 0.24)),
    "bonbon_laugh": lambda: gibber("bonbon_laugh", 0.9, 150, laughc, "o", (0.09, 0.11), (0.06, 0.08)),
}
for name, fn in VOICES.items():
    write("voice_" + name, fn(), 0.85); META["voice"].append(name)

with open(os.path.join(OUT, "manifest2.json"), "w") as fh: json.dump(META, fh, indent=1)
print("music", len(META["music"]), "sfx", len(META["sfx"]), "voices", len(META["voice"]))
