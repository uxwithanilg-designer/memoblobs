"""Arcade sound pack for MOMOBLOBS: per-game music loops, funny SFX and character voices.

usage: python scripts/gen_arcade_audio.py <path-to-momo/tools> <out-wav-dir>
Builds on the original Track Momo synth (momo/tools/audio.py). Output: WAV files + manifest.json.
Music loops are LOOP + TAIL seconds (the web player overlaps the tail for seamless loops).
"""
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


def seed(name):
    return np.random.default_rng(zlib.crc32(name.encode()))


def write(name, y, peak=0.9):
    y = np.asarray(y, dtype=np.float64)
    if y.ndim == 1:
        y = y[None, :]
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    pcm = (y.T * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(pcm.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def mix(y, x, o, g=1.0):
    """add x into y at sample offset o (clipped)"""
    o = int(o)
    if o >= len(y) or o < 0: return y
    k = min(len(x), len(y) - o)
    y[o:o + k] += np.asarray(x[:k]) * g
    return y


def env_exp(n, k):
    return np.exp(-np.arange(n) / SR * k)


# ================================================================ instruments
def pluck(f, d=0.6, bright=0.6, decay=3.0):
    """ukulele / guitar-ish pluck: decaying harmonics + click"""
    t = T(d); y = np.zeros(len(t))
    for k in range(1, 10):
        if f * k > 16000: break
        y += np.sin(2 * np.pi * f * k * t * (1 + 0.0007 * k * k)) / k ** (1.6 - bright) * np.exp(-t * (decay + k * 1.4))
    y[:240] += hp(noise(240 / SR), 2500) * np.linspace(0.3, 0, 240)
    return y * 0.6


def pizz(f):
    return bp(pluck(f, 0.28, 0.5, 9.0), 150, 4000) * 1.3


def harpsi(f, d=0.5):
    t = T(d); ff = f
    y = lp(saw(ff, d), 5200) * 0.5 + lp(saw(ff * 2.001, d), 6000) * 0.25
    return y * np.exp(-t * 5.5) * adsr(len(t), 0.002, 0.03, 1, 0.04)


def vibes(f, d=1.2):
    t = T(d)
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 6)
    return y * np.exp(-t * 1.8) * (1 + 0.28 * np.sin(2 * np.pi * 5.2 * t)) * 0.45


def rhodes(f, d=1.2):
    t = T(d)
    y = np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t * 3)) + 0.2 * np.sin(2 * np.pi * 2 * f * t)
    return y * np.exp(-t * 1.4) * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t)) * adsr(len(t), 0.004, 0.1, 1, 0.1) * 0.35


def tuba(f, d=0.3):
    t = T(d)
    y = lp(saw(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)), d), 700)
    return y * adsr(len(t), 0.02, 0.08, 0.8, 0.06) * 0.8


def kazoo(f, d=0.3):
    t = T(d)
    src = saw(f * (1 + 0.01 * np.sin(2 * np.pi * 6 * t)), d) + 0.3 * np.sign(np.sin(2 * np.pi * f * t))
    y = bp(src, 500, 1400) + 0.5 * bp(src, 2200, 3200)
    return np.tanh(y * 2.5) * adsr(len(t), 0.015, 0.05, 0.85, 0.05) * 0.45


def square_arp(f, d=0.14):
    t = T(d)
    y = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 3, 5, 7, 9))
    return lp(y, 3500) * np.exp(-t * 14) * 0.35


def bass_synth(f, d=0.3):
    t = T(d)
    cut = 300 + 1800 * np.exp(-t * 18)
    y = saw(f, d)
    y = lp(y, 900) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    return np.tanh(y * 1.4) * adsr(len(t), 0.004, 0.06, 0.7, 0.04) * 0.6 * (cut / cut.max()) ** 0.1


def theremin_line(notes, bpm, dur_total):
    """notes: list of (t, midi, len). portamento sine with vibrato"""
    n = int(dur_total * SR); f = np.zeros(n); amp = np.zeros(n)
    for (t0, m, ln) in notes:
        i0 = int(t0 * SR); i1 = min(n, int((t0 + ln) * SR))
        f[i0:i1] = midi(m); amp[i0:i1] = 1
    # glide: fill gaps with previous freq, smooth
    last = midi(notes[0][1])
    for i in range(n):
        if f[i] == 0: f[i] = last
        else: last = f[i]
    k = int(0.06 * SR); f = np.convolve(f, np.ones(k) / k, mode="same")
    a = np.convolve(amp, np.ones(int(0.04 * SR)) / int(0.04 * SR), mode="same")
    t = np.arange(n) / SR
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 6.2 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.15 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return y * a * 0.32


def snare(g=1.0):
    d = 0.22; t = T(d)
    return (bp(noise(d), 1500, 7000) * np.exp(-t * 22) * 0.7 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30) * 0.5) * g


def brush():
    d = 0.18; t = T(d)
    return bp(noise(d), 2500, 9000) * np.sin(np.pi * t / d) ** 2 * 0.25


def snap():
    d = 0.06; t = T(d)
    return hp(noise(d), 2000) * np.exp(-t * 80) * 0.8


def bubble_note(f0=300, f1=1400, d=0.09):
    t = T(d); f = f0 + (f1 - f0) * (t / d) ** 0.6
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) * 0.5


def chord_pad(notes, d, kind="rhodes"):
    y = np.zeros(int(d * SR))
    for m in notes:
        x = rhodes(midi(m), d) if kind == "rhodes" else vibes(midi(m), d)
        y[:len(x)] += x[: len(y)]
    return y


# ================================================================ composition helpers
def steps(bpm, bars, swing=0.0):
    st = 60 / bpm / 4
    for s in range(bars * 16):
        yield s, s * st + (swing * st if s % 2 == 1 else 0), s // 16, s % 16


def motif(rs, scale, n_steps=32, density=0.55, max_len=3):
    out, s = [], 0
    while s < n_steps:
        if rs.random() < density:
            ln = int(rs.integers(1, max_len + 1))
            out.append((s, scale[int(rs.integers(0, len(scale)))], ln))
            s += ln
        else:
            s += 1
    return out


def song(name, bpm, bars, body, tail=1.5, swing=0.0):
    d = bars * 4 * 60 / bpm
    buf = np.zeros((2, int((d + tail) * SR)))
    body(buf, bpm, bars, seed(name), swing)
    # glue: gentle saturation
    buf = np.tanh(buf * 1.1) / np.tanh(1.1)
    write("music_" + name, buf, peak=0.6)
    META["music"][name] = {"loop": round(d, 6), "tail": tail, "bpm": bpm}


# ---------------------------------------------------------------- 1. Fish Watch — Pip's pond (ukulele + marimba + bubbles)
def fish_body(action):
    PROG = [(41, [53, 57, 60]), (38, [50, 53, 57]), (46, [58, 62, 65]), (48, [55, 60, 64])]  # F Dm Bb C
    PENTA = [65, 67, 69, 72, 74, 77, 79, 81]

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, PENTA, 32, 0.5 if not action else 0.62)
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 in (0, 6, 10) or (action and s16 == 14): place(buf, pluck_bass(midi(root), 0.35), t, 0.5)
            if s16 % 4 == 2 or (action and s16 % 2 == 0):  # ukulele strum
                for i, m in enumerate(ch): place(buf, pluck(midi(m + 12), 0.5), t + i * 0.012, 0.22, -0.3 + i * 0.2)
            if s16 % 2 == 0: place(buf, shaker(), t, 0.22 if not action else 0.32, 0.4)
            if action and s16 in (4, 12): place(buf, clap(), t, 0.22)
            if action and s16 % 4 == 0: place(buf, kick(), t, 0.5)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc and (bar % 4 != 3 or rs.random() < 0.6):
                    place(buf, marimba(midi(m + (12 if action and bar % 2 else 0)), 0.4), t, 0.26, rs.uniform(-0.5, 0.5))
            if rs.random() < (0.05 if not action else 0.08): place(buf, bubble_note(rs.uniform(250, 500), rs.uniform(900, 1700)), t, 0.18, rs.uniform(-0.8, 0.8))
    return body


# ---------------------------------------------------------------- 2. Spot the Sneak — tip-toe pizzicato detective
def sneak_body(action):
    PROG = [(38, [50, 53, 57]), (46, [50, 53, 58]), (43, [50, 55, 58]), (45, [49, 52, 57])]  # Dm Bb Gm A
    RUN = [62, 64, 65, 67, 69, 70, 73, 74]

    def body(buf, bpm, bars, rs, swing):
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 in (0, 8): place(buf, pizz(midi(root)), t, 0.8)          # tip
            if s16 in (4, 12): place(buf, pizz(midi(root + 7)), t, 0.6)     # toe
            if s16 in (4, 12): place(buf, snap(), t, 0.5, 0.35)
            if s16 in (2, 6, 10, 14) and rs.random() < 0.7:
                m = ch[int(rs.integers(0, 3))] + 12
                place(buf, pizz(midi(m)), t, 0.35, rs.uniform(-0.6, 0.6))
            if bar % 4 == 3 and s16 >= 8 and s16 % 2 == 0:              # sneaky chromatic run
                place(buf, pizz(midi(RUN[(s16 - 8) // 2 + 2])), t, 0.4, 0.3)
            if bar % 2 == 1 and s16 == 0: place(buf, kazoo(midi(ch[2] - 12), 0.28), t, 0.18)
            if action:
                place(buf, hat(s16 % 4 == 2), t, 0.16, -0.35)
                if s16 % 4 == 0: place(buf, kick(), t, 0.45)
                if s16 in (4, 12): place(buf, snare(0.5), t, 0.5)
    return body


# ---------------------------------------------------------------- 3. Color Clash — classroom harpsichord march
def clash_body(action):
    PROG = [(36, [60, 64, 67]), (41, [60, 65, 69]), (43, [59, 62, 67]), (36, [60, 64, 67])]  # C F G C
    MEL = [72, 74, 76, 77, 79, 81, 83, 84]

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, MEL, 32, 0.6, 2)
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 in (0, 8): place(buf, tuba(midi(root), 0.25), t, 0.75)               # oom
            if s16 in (4, 12):                                                          # pah
                for m in ch: place(buf, harpsi(midi(m), 0.2), t, 0.16)
            if s16 % 4 == 0: place(buf, A._wood(1800, 120), t, 0.25, 0.5)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc: place(buf, harpsi(midi(m), 0.25 * ln), t, 0.3, -0.2)
            if action:
                if s16 % 2 == 0: place(buf, hat(), t, 0.14, 0.3)
                if s16 in (4, 12): place(buf, snare(0.6), t, 0.45)
                if s16 % 4 == 0: place(buf, kick(), t, 0.5)
            if bar % 4 == 3 and s16 == 12: place(buf, kazoo(midi(67), 0.18), t, 0.25)
    return body


# ---------------------------------------------------------------- 4. Blink! — lazy lounge jazz (swing)
def blink_body(action):
    PROG = [(48, [58, 63, 67, 70]), (41, [57, 60, 63, 65]), (46, [57, 62, 65, 69]), (43, [59, 62, 65, 67])]  # Cm7 F7 Bbmaj7 G7
    SCALE = [70, 72, 74, 75, 77, 79, 81, 82]

    def body(buf, bpm, bars, rs, swing):
        mot = motif(rs, SCALE, 32, 0.45, 3)
        st = 60 / bpm / 4
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 % 4 == 0:  # walking bass
                walk = [0, 4, 7, 10][s16 // 4] if bar % 2 == 0 else [12, 10, 7, 5][s16 // 4]
                place(buf, pluck_bass(midi(root - 12 + walk + 12), 0.4), t, 0.55)
            if s16 == 0 or (s16 == 10 and rs.random() < 0.6): place(buf, chord_pad(ch, 1.6), t, 0.32, rs.uniform(-0.2, 0.2))
            if s16 % 4 == 0 or s16 % 4 == 3: place(buf, brush(), t, 0.4 if s16 % 8 == 4 else 0.25, 0.35)
            if s16 % 8 == 4: place(buf, snap(), t, 0.25, 0.4)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc and (bar % 4) != 1: place(buf, vibes(midi(m), 0.9), t, 0.3, rs.uniform(-0.5, 0.5))
            if action and s16 % 2 == 0: place(buf, hat(s16 % 8 == 6), t, 0.12, -0.3)
            if action and s16 in (0, 8): place(buf, kick(), t, 0.35)
    return body


# ---------------------------------------------------------------- 5. Where's Zib? — retro space theremin
def zib_body(action):
    PROG = [(40, [52, 55, 59]), (36, [52, 55, 60]), (38, [54, 57, 62]), (35, [52, 54, 59])]  # Em C D Bsus
    LEAD = [64, 66, 67, 69, 71, 74, 76, 79]

    def body(buf, bpm, bars, rs, swing):
        st = 60 / bpm / 4
        mot = motif(rs, LEAD, 32, 0.4, 4)
        notes = []
        for s, t, bar, s16 in steps(bpm, bars, swing):
            root, ch = PROG[bar % 4]
            if s16 % 2 == 0 or action: place(buf, square_arp(midi(ch[(s // (1 if action else 2)) % 3] + 12), 0.14), t, 0.18, -0.5 if s % 4 < 2 else 0.5)
            if s16 in (0, 3, 8, 11) or (action and s16 in (6, 14)): place(buf, bass_synth(midi(root - 12 + 12), 0.25), t, 0.5)
            if s16 in (0, 8) or (action and s16 % 4 == 0): place(buf, kick(), t, 0.5)
            if s16 in (4, 12): place(buf, snare(0.5), t, 0.4)
            if action and s16 % 2 == 1: place(buf, hat(), t, 0.12, 0.3)
            loc = s % 32
            for (ms, m, ln) in mot:
                if ms == loc and bar % 4 != 3: notes.append((t, m, ln * st * 0.95))
        if notes:
            th = theremin_line(notes, bpm, buf.shape[1] / SR)
            buf[0, :len(th)] += th * 0.9; buf[1, :len(th)] += th * 1.0
    return body


for game, body, bpm in [("fish", fish_body, 96), ("sneak", sneak_body, 108), ("clash", clash_body, 120), ("blink", blink_body, 92), ("zib", zib_body, 104)]:
    song(f"{game}_calm", bpm, 8, body(False), swing=0.33 if game == "blink" else 0.0)
    song(f"{game}_action", int(bpm * 1.18), 8, body(True), swing=0.33 if game == "blink" else 0.0)


# ================================================================ funny SFX
def chirp(f0, f1, d, shape=1.0):
    t = T(d); f = f0 + (f1 - f0) * (t / d) ** shape
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def s_bubble(): return bubble_note(320, 1500, 0.08) * 1.4


def s_bubbles():
    y = np.zeros(int(0.6 * SR)); r = seed("bubbles")
    for _ in range(9):
        b = bubble_note(r.uniform(250, 600), r.uniform(900, 2200), r.uniform(0.05, 0.1)); i = int(r.uniform(0, 0.48) * SR)
        mix(y, b, i, r.uniform(0.5, 1))
    return y


def s_splash():
    d = 0.7; t = T(d)
    y = lp(noise(d), 3000) * np.exp(-t * 7) + hp(noise(d), 4000) * np.exp(-t * 10) * 0.5
    y[:int(0.05 * SR)] += sweep(np.linspace(180, 60, int(0.05 * SR))) * 0.6
    drops = s_bubbles()[: len(y)] * 0.4; y[: len(drops)] += drops
    return y


def s_gulp():
    d = 0.32; t = T(d); f = 260 * np.exp(-t * 4) + 70
    v = sum(np.sin(k * 2 * np.pi * np.cumsum(f) / SR) / k for k in range(1, 8))
    return bp(v, 150, 900) * np.sin(np.pi * t / d) ** 0.5 * 1.4


def s_slap():
    d = 0.25; t = T(d)
    return hp(noise(d), 800) * np.exp(-t * 45) * 1.2 + np.sin(2 * np.pi * 140 * t) * np.exp(-t * 25) * 0.7


def s_ding(): return A._bell(A.midi(88), 0.9) * 0.9 + A._bell(A.midi(95), 0.9) * 0.3


def s_chime():
    y = np.zeros(int(1.0 * SR))
    for i, m in enumerate([72, 76, 79, 84]):
        x = marimba(midi(m), 0.6); o = int(i * 0.07 * SR); mix(y, x, o, 0.7)
    return y


def s_bwomp():
    d = 0.55; t = T(d); f = 220 * (1 - 0.45 * t / d) * (1 + 0.06 * np.sin(2 * np.pi * 9 * t))
    v = lp(saw(f, d), 1200)
    return np.tanh(v * 2) * adsr(len(t), 0.01, 0.1, 0.8, 0.15) * 0.8


def s_squelch():
    d = 0.32; t = T(d); y = bp(noise(d), 200, 1800) * (1 + np.sin(2 * np.pi * 38 * t))
    return y * np.sin(np.pi * t / d) ** 0.8 + chirp(500, 150, d) * np.exp(-t * 10) * 0.4


def s_splat():
    d = 0.4; t = T(d)
    return lp(noise(d), 1500) * np.exp(-t * 14) * 1.2 + chirp(300, 80, d) * np.exp(-t * 12) * 0.6


def s_wobble():
    d = 0.6; t = T(d); f = 300 * (1 + 0.25 * np.sin(2 * np.pi * 11 * t) * np.exp(-t * 3))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4) * 0.8


def s_honk():
    d = 0.4; t = T(d); y = np.zeros(len(t))
    for f in (330, 415):
        y += np.sign(np.sin(2 * np.pi * f * t)) * 0.5
    y = bp(y, 400, 2500)
    return np.tanh(y * 2) * adsr(len(t), 0.01, 0.05, 0.9, 0.08) * 0.6


def s_kazoo(): return np.concatenate([kazoo(midi(67), 0.18), kazoo(midi(72), 0.32)])


def s_slide_up(): d = 0.5; t = T(d); return chirp(400, 1800, d, 1.6) * np.sin(np.pi * t / d) ** 0.4 * 0.7


def s_slide_down(): d = 0.55; t = T(d); return chirp(1800, 300, d, 0.7) * np.sin(np.pi * t / d) ** 0.4 * 0.7


def s_whistle():
    d = 0.45; t = T(d); f = 2600 * (1 + 0.03 * np.sign(np.sin(2 * np.pi * 28 * t)))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + bp(noise(d), 2000, 4000) * 0.2) * adsr(len(t), 0.01, 0.05, 0.9, 0.1) * 0.5


def s_scratch():
    d = 0.4; t = T(d); f = 900 + 700 * np.sin(2 * np.pi * 5 * t)
    return bp(noise(d), 600, 3000) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 * np.sin(np.pi * t / d)


def s_chalk():
    d = 0.35; t = T(d); f = 3200 + 400 * np.sin(2 * np.pi * 17 * t)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + bp(noise(d), 2500, 6000) * 0.4) * np.sin(np.pi * t / d)


def s_bell():
    y = np.zeros(int(1.0 * SR))
    for i in range(10):
        b = A._bell(1400, 0.15) * 0.6; o = int(i * 0.07 * SR); mix(y, b, o)
    return y


def s_page():
    d = 0.3; t = T(d)
    return bp(noise(d), 1500, 7000) * np.abs(np.sin(2 * np.pi * 14 * t)) * np.sin(np.pi * t / d) * 0.8


def s_snore():
    d = 1.4; t = T(d); inhale = np.clip(np.sin(np.pi * t / 0.8), 0, 1) * (t < 0.8)
    rasp = bp(noise(d), 80, 600) * (1 + np.sign(np.sin(2 * np.pi * 32 * t))) * inhale
    exhale = (t > 0.85) * np.sin(np.pi * np.clip((t - 0.85) / 0.5, 0, 1)) * bp(noise(d), 300, 1500) * 0.35
    whistle = (t > 0.9) * chirp(900, 1300, d) * 0.12 * np.sin(np.pi * np.clip((t - 0.9) / 0.45, 0, 1))
    return rasp + exhale + whistle


def s_zap(): d = 0.3; t = T(d); return np.sign(np.sin(2 * np.pi * np.cumsum(2400 * np.exp(-t * 9) + 150) / SR)) * np.exp(-t * 7) * 0.35


def s_ufo():
    d = 1.0; t = T(d); f = 600 + 250 * np.sin(2 * np.pi * 7 * t) + 300 * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) * 0.5


def s_teleport():
    d = 0.6; t = T(d); y = np.zeros(len(t))
    for k in range(5): y += chirp(300 * (k + 1), 1500 * (k + 1), d, 0.8) * 0.15
    return y * np.sin(np.pi * t / d) + hp(noise(d), 6000) * 0.1 * np.sin(np.pi * t / d)


def s_blink():
    d = 0.25; t = T(d)
    y = bp(noise(d), 400, 2500) * np.sin(np.pi * t / d) ** 2 * 0.5
    w = A._wood(2600, 140); y[int(0.1 * SR):int(0.1 * SR) + len(w)] += w * 0.6
    return y


def s_tink(): return A._bell(A.midi(96), 0.35) * 0.6


def s_shutter():
    y = np.zeros(int(0.2 * SR)); a = A._wood(3000, 160); b = A._wood(1800, 120)
    y[:len(a)] += a; o = int(0.07 * SR); mix(y, b, o, 0.8)
    return y


def s_heartbeat():
    y = np.zeros(int(0.7 * SR))
    for o, g in ((0, 1), (0.22, 0.7)):
        d = 0.18; t = T(d); x = np.sin(2 * np.pi * 60 * t) * np.exp(-t * 18) * g; i = int(o * SR); mix(y, x, i)
    return y


def s_coin():
    a = A._bell(A.midi(88), 0.18) * 0.7; b = A._bell(A.midi(95), 0.5) * 0.7
    y = np.zeros(len(a) + len(b)); mix(y, a, 0); mix(y, b, int(0.07 * SR))
    return y


def s_blip(): d = 0.09; t = T(d); return np.sign(np.sin(2 * np.pi * 880 * t)) * np.exp(-t * 30) * 0.3


def jingle(notes, step=0.09, inst=None, tail=0.9):
    inst = inst or (lambda f, d: A._brass(f, d))
    y = np.zeros(int((len(notes) * step + tail) * SR))
    for i, (m, ln) in enumerate(notes):
        x = inst(midi(m), ln); o = int(i * step * SR); mix(y, x, o)
    return y


def s_levelup(): return jingle([(72, 0.1), (76, 0.1), (79, 0.1), (84, 0.6)], 0.09)


def s_perfect():
    y = jingle([(72, 0.1), (76, 0.1), (79, 0.1), (84, 0.1), (88, 0.7)], 0.08)
    sp = A.sfx_sparkle(); y[:len(sp)] += sp[: len(y)] * 0.6
    return y


def s_fail(): return jingle([(67, 0.22), (66, 0.22), (65, 0.6)], 0.24, lambda f, d: kazoo(f, d) * 1.6)


def s_whoosh_in(): return A.sfx_whoosh(0.45)


def s_whoosh_out(): return A.sfx_whoosh(0.35)


def s_scramble():
    y = np.zeros(int(0.6 * SR)); r = seed("scramble")
    for i in range(16):
        w = A._wood(r.uniform(900, 1600), 140); o = int(i * 0.035 * SR); mix(y, w, o, r.uniform(0.4, 0.8))
    return y


def s_poof():
    d = 0.5; t = T(d)
    return lp(noise(d), 1800) * np.exp(-t * 9) * 0.9 + chirp(800, 200, d) * np.exp(-t * 12) * 0.2


def s_drip(): return bubble_note(900, 300, 0.07) * 1.2


def s_tick_hi(): return A._wood(3200, 120)


def s_go(): return s_whistle()[: int(0.3 * SR)]


def s_applause():
    d = 1.6; t = T(d); y = np.zeros(len(t)); r = seed("applause")
    for _ in range(140):
        c = bp(noise(0.02), 800, 5000) * np.exp(-T(0.02) * 160); i = int(r.uniform(0, d - 0.05) * SR); mix(y, c, i, r.uniform(0.3, 1))
    return y * np.clip(np.sin(np.pi * t / d) * 1.6, 0, 1)


def vowel_voice(d, f0c, vowel_seq, breath=0.05):
    """sustained cartoon vowel: f0 contour array-func, vowel formants list"""
    t = T(d); f0 = f0c(t / d)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    src = sum(np.sin(k * ph) / k for k in range(1, 20))
    y = np.zeros(len(t))
    for i, (f1, f2) in enumerate(vowel_seq):
        seg_env = np.clip(1 - np.abs((t / d) * len(vowel_seq) - i - 0.5), 0, 1)
        y += (bp(src, f1 * 0.7, f1 * 1.3) + 0.6 * bp(src, f2 * 0.8, min(f2 * 1.2, 20000))) * seg_env
    return (y + bp(noise(d), 1000, 4000) * breath) * np.sin(np.pi * t / d) ** 0.6


def s_ooh(): return vowel_voice(0.9, lambda u: 220 * (1 + 0.35 * u), [(300, 870), (320, 800)]) * 0.9


def s_aww(): return vowel_voice(1.0, lambda u: 300 * (1 - 0.35 * u), [(700, 1200), (650, 1000), (500, 900)]) * 0.9


def s_giggle():
    y = np.zeros(int(0.8 * SR))
    for i, f in enumerate([700, 760, 680, 740, 650]):
        x = vowel_voice(0.09, lambda u, f=f: f * np.ones_like(u), [(800, 1300)], 0.1); o = int(i * 0.12 * SR); mix(y, x, o)
    return y


SFX = {
    "bubble": s_bubble, "bubbles": s_bubbles, "splash": s_splash, "gulp": s_gulp, "slap": s_slap, "ding": s_ding, "chime": s_chime,
    "bwomp": s_bwomp, "squelch": s_squelch, "splat": s_splat, "wobble": s_wobble, "honk": s_honk, "kazoo": s_kazoo,
    "slideUp": s_slide_up, "slideDown": s_slide_down, "whistle": s_whistle, "scratch": s_scratch, "chalk": s_chalk, "bell": s_bell,
    "page": s_page, "snore": s_snore, "zap": s_zap, "ufo": s_ufo, "teleport": s_teleport, "blink": s_blink, "tink": s_tink,
    "shutter": s_shutter, "heartbeat": s_heartbeat, "coin": s_coin, "blip": s_blip, "levelup": s_levelup, "perfect": s_perfect,
    "fail": s_fail, "whooshIn": s_whoosh_in, "whooshOut": s_whoosh_out, "scramble": s_scramble, "poof": s_poof, "drip": s_drip,
    "tickHi": s_tick_hi, "go": s_go, "applause": s_applause, "ooh": s_ooh, "aww": s_aww, "giggle": s_giggle,
}
for name, fn in SFX.items():
    write("sfx_" + name, fn(), 0.9)
    META["sfx"].append(name)


# ================================================================ character voices (gibberish with personality)
VOW = {"a": (800, 1250), "e": (420, 2100), "i": (300, 2400), "o": (480, 880), "u": (330, 820)}


def gibber(name, d, base, contour, vowels="aeiou", syl=(0.07, 0.12), gap=(0.01, 0.035), rough=0.0, ring=0.0, am=0.0, bright=1.0):
    r = seed(name)
    y = np.zeros(int((d + 0.25) * SR)); t0 = 0.0
    while t0 < d:
        sd = r.uniform(*syl); t = T(sd)
        f = base * contour(t0 / d) * r.uniform(0.9, 1.15) * (1 + 0.12 * np.sin(np.pi * t / sd))
        ph = 2 * np.pi * np.cumsum(np.full(len(t), 1.0) * f) / SR
        src = sum(np.sin(k * ph) / k ** bright for k in range(1, 24))
        if rough: src = src + rough * bp(noise(sd), 300, 3000)
        f1, f2 = VOW[vowels[int(r.integers(0, len(vowels)))]]
        v = bp(src, f1 * 0.7, f1 * 1.3) + 0.6 * bp(src, f2 * 0.8, min(f2 * 1.2, 20000))
        v *= np.sin(np.pi * t / sd) ** 0.7
        i = int(t0 * SR); k = min(len(v), len(y) - i); y[i:i + k] += v[:k]
        t0 += sd + r.uniform(*gap)
    tt = np.arange(len(y)) / SR
    if ring: y = y * np.sin(2 * np.pi * ring * tt) * 1.4 + y * 0.3
    if am: y = y * (1 + 0.5 * np.sin(2 * np.pi * am * tt))
    return y


def bark(f=420, d=0.16):
    t = T(d); f0 = f * np.exp(-t * 6)
    src = sum(np.sin(k * 2 * np.pi * np.cumsum(f0) / SR) / k for k in range(1, 18)) + bp(noise(d), 500, 3000) * 0.6
    v = bp(src, 500, 1100) + 0.7 * bp(src, 1500, 2600)
    return np.tanh(v * 2.2) * np.exp(-t * 10) * adsr(len(t), 0.005, 0.02, 1, 0.03)


def seqcat(parts, gap=0.06):
    out = []
    for p in parts:
        out.append(p); out.append(np.zeros(int(gap * SR)))
    return np.concatenate(out)


up = lambda u: 1 + 0.45 * u
down = lambda u: 1.25 - 0.5 * u
flat = lambda u: 1 + 0 * u
hump = lambda u: 1 + 0.3 * np.sin(np.pi * u)
laughc = lambda u: 1.3 - 0.4 * u

VOICES = {
    # Pip — squeaky little penguin
    "pip_happy": lambda: gibber("pip_happy", 0.75, 560, hump, "aei", (0.05, 0.08)),
    "pip_wow": lambda: gibber("pip_wow", 0.5, 520, up, "ou", (0.12, 0.2)),
    "pip_sad": lambda: gibber("pip_sad", 0.9, 600, down, "ao", (0.14, 0.22)),
    "pip_laugh": lambda: gibber("pip_laugh", 0.8, 620, laughc, "ei", (0.05, 0.06), (0.03, 0.05)),
    # Gloop — bubbly gurgle
    "gloop_happy": lambda: gibber("gloop_happy", 0.8, 125, hump, "ou", (0.08, 0.14), am=17, bright=0.8),
    "gloop_wow": lambda: gibber("gloop_wow", 0.55, 120, up, "o", (0.18, 0.25), am=22, bright=0.8),
    "gloop_sad": lambda: gibber("gloop_sad", 0.9, 140, down, "ou", (0.15, 0.25), am=12, bright=0.8),
    "gloop_laugh": lambda: gibber("gloop_laugh", 0.9, 150, laughc, "ao", (0.06, 0.08), (0.03, 0.05), am=20, bright=0.8),
    # Prof. Hoot — wise old owl ("hoo-hoo")
    "hoot_happy": lambda: seqcat([vowel_voice(0.28, lambda u: 330 * (1 - 0.15 * u), [VOW["u"]]), vowel_voice(0.4, lambda u: 290 * (1 - 0.2 * u), [VOW["u"]])], 0.08),
    "hoot_wow": lambda: vowel_voice(0.6, lambda u: 240 * (1 + 0.6 * u), [VOW["u"], VOW["o"]]),
    "hoot_sad": lambda: s_snore() * 0.9,
    "hoot_laugh": lambda: seqcat([vowel_voice(0.12, lambda u, k=k: (340 - k * 20) * np.ones_like(u), [VOW["u"]]) for k in range(5)], 0.05),
    "hoot_talk": lambda: gibber("hoot_talk", 1.2, 210, hump, "ouo", (0.08, 0.13)),
    # Noodle — happy sausage dog
    "noodle_happy": lambda: seqcat([bark(480), bark(520)], 0.09),
    "noodle_wow": lambda: vowel_voice(0.5, lambda u: 420 * (1 + 0.7 * u), [VOW["o"], VOW["u"]]),
    "noodle_sad": lambda: vowel_voice(0.9, lambda u: 700 * (1 - 0.45 * u) * (1 + 0.03 * np.sin(2 * np.pi * 7 * u * 0.9)), [VOW["i"], VOW["u"]], 0.15),
    "noodle_laugh": lambda: seqcat([vowel_voice(0.07, lambda u: 500 * np.ones_like(u), [VOW["a"]], 0.4) for _ in range(6)], 0.04),
    # Zib — ring-modulated alien
    "zib_happy": lambda: gibber("zib_happy", 0.75, 420, hump, "aei", (0.06, 0.09), ring=95),
    "zib_wow": lambda: gibber("zib_wow", 0.55, 380, up, "o", (0.15, 0.22), ring=120),
    "zib_sad": lambda: gibber("zib_sad", 0.9, 460, down, "uo", (0.12, 0.2), ring=70),
    "zib_laugh": lambda: gibber("zib_laugh", 0.8, 520, laughc, "ie", (0.05, 0.06), (0.02, 0.04), ring=110),
}
for name, fn in VOICES.items():
    write("voice_" + name, fn(), 0.85)
    META["voice"].append(name)

with open(os.path.join(OUT, "manifest.json"), "w") as fh:
    json.dump(META, fh, indent=1)
print("music", len(META["music"]), "sfx", len(META["sfx"]), "voices", len(META["voice"]))
