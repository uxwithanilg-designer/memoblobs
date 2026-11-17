"""Nitro Rush racing sound pack: racing music (8 styles x calm/action + menu) and racing SFX.

usage: python scripts/gen_racing_audio.py <momo/tools> <out-wav-dir> [--mp3 <public/audio/arcade>] [names...]
  names = music keys (rock synthwave edm dnb trap chiptune funk orchestral menu eurobeat phonk chase bigbeat metal hardstyle), "music", "sfx", or sfx names.
  With --mp3 the WAVs are also encoded (ffmpeg / libmp3lame) into that folder as music_race_* / sfx_race_*.

Builds on the helpers of pack #2 (gen_arcade_audio2.py, exec-sliced like pack #3) and momo/tools/audio.py and adds a
small studio: polyBLEP oscillators, drum kits, supersaws, guitars, an orchestra, chip voices, stereo reverb + ping-pong
delay sends, kick-keyed sidechain pumping and a loop-aware master: loudness (ITU BS.1770) and a look-ahead limiter
are computed on the *folded* steady-state loop (loop + tail wrapped onto itself) and applied as a periodic gain, so
the loop + tail overlap that the site's scheduler plays is seamless and sits at the target loudness.
Music files are LOOP + TAIL seconds; manifest_race.json lists loop lengths (MUSIC_META in src/lib/audio.ts).
"""
import json
import os
import subprocess
import sys
import zlib
from functools import lru_cache

import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "gen_arcade_audio2.py"), encoding="utf-8").read()
exec(_src[: _src.index("# ---------------------------------------------------------------- 1. Memory Bridge")])
exec(_src[_src.index("def chirp"): _src.index("def s_door_open")])

ARGS = sys.argv[3:]
MP3 = None
if "--mp3" in ARGS:
    _i = ARGS.index("--mp3"); MP3 = ARGS[_i + 1]; ARGS = ARGS[:_i] + ARGS[_i + 2:]
ONLY = set(ARGS)
META = {"music": {}, "sfx": {}}  # noqa: F811  (fresh manifest for this pack)
RNG = np.random.default_rng(20261117)


def nz(n): return RNG.standard_normal(int(n))
def ns(d): return max(1, int(round(d * SR)))
def tt(n): return np.arange(int(n)) / SR


def rng(name): return np.random.default_rng(zlib.crc32(str(name).encode()))


def lp2(x, f): return lp(lp(x, f), f)


def pk(x, f, g_db, q=1.0):
    """peaking EQ (RBJ biquad)"""
    a = 10 ** (g_db / 40); w = 2 * np.pi * f / SR; al = np.sin(w) / (2 * q)
    b0, b1, b2 = 1 + al * a, -2 * np.cos(w), 1 - al * a
    a0, a1, a2 = 1 + al / a, -2 * np.cos(w), 1 - al / a
    return lfilter([b0 / a0, b1 / a0, b2 / a0], [1, a1 / a0, a2 / a0], x)


def sweep_filt(x, kind, f0, f1, block=256, curve=1.0):
    """2nd-order filter whose cutoff glides f0 -> f1 (exponential) over the signal"""
    n = len(x); out = np.empty(n); zi = np.zeros((1, 2))
    for b in range(0, n, block):
        u = min(1.0, (b + block / 2) / n) ** curve
        f = min(SR * 0.45, max(20.0, f0 * (f1 / f0) ** u))
        sos = butter(2, f / (SR / 2), kind, output="sos")
        out[b:b + block], zi = sosfilt(sos, x[b:b + block], zi=zi)
    return out


def fade(x, a=0.0, r=0.01):
    x = np.array(x, dtype=float)
    if a > 0: k = min(x.shape[-1], ns(a)); x[..., :k] *= np.linspace(0, 1, k)
    if r > 0: k = min(x.shape[-1], ns(r)); x[..., -k:] *= np.linspace(1, 0, k)
    return x


# ---------------------------------------------------------------- oscillators (band-limited)
def saw_b(f, n, ph0=0.0):
    n = int(n)
    dt = np.full(n, float(f) / SR) if np.ndim(f) == 0 else np.asarray(f, float)[:n] / SR
    ph = (ph0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt; x = ph[m] / dt[m]; y[m] -= x + x - x * x - 1
    m = ph > 1 - dt; x = (ph[m] - 1) / dt[m]; y[m] -= x * x + x + x + 1
    return y


def pulse_b(f, n, duty=0.5, ph0=0.0): return 0.5 * (saw_b(f, n, ph0) - saw_b(f, n, ph0 + duty))


def sine(f, n, ph0=0.0):
    n = int(n)
    if np.ndim(f) == 0: return np.sin(2 * np.pi * (f * tt(n) + ph0))
    return np.sin(2 * np.pi * (np.cumsum(np.asarray(f, float)[:n]) / SR + ph0))


def tri_n(f, n):
    ph = (np.cumsum(np.full(int(n), f / SR) if np.ndim(f) == 0 else np.asarray(f, float)[:int(n)] / SR)) % 1.0
    return 4 * np.abs(ph - 0.5) - 1


def glide(m, m_from, n, g=0.05):
    f = np.full(int(n), midi(m))
    if m_from is not None and m_from != m:
        k = min(int(n), ns(g)); f[:k] = midi(m_from) * (midi(m) / midi(m_from)) ** np.linspace(0, 1, k) ** 0.6
    return f


def vib(n, rate=5.5, depth=0.005, delay=0.18, ph=0.0):
    t = tt(n); return 1 + depth * np.sin(2 * np.pi * rate * t + ph) * np.clip((t - delay) / 0.2, 0, 1)


def env_note(n, d, a=0.005, dec=None, sus=1.0, rel=0.08):
    t = tt(n); e = np.ones(int(n))
    ka = min(int(n), ns(a)); e[:ka] = np.linspace(0, 1, ka)
    if dec: e[ka:] = sus + (1 - sus) * np.exp(-(t[ka:] - a) / dec)
    kg = ns(d)
    if kg < n: e[kg:] = e[kg - 1] * np.linspace(1, 0, int(n) - kg) ** 1.5
    return e


# ---------------------------------------------------------------- drums
@lru_cache(maxsize=None)
def k_kick(f0=150.0, f1=48.0, ptau=0.03, dtau=0.25, click=0.5, drive=2.0, d=0.55):
    n = ns(d); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / ptau)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dtau) * np.minimum(1, t / 0.0008)
    cl = hp(nz(n), 1800) * np.exp(-t / 0.0022) * 0.5 + np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.0016) * 0.35
    y = np.tanh(drive * (body + click * cl)) / np.tanh(drive)
    return fade(y, 0, 0.03)


@lru_cache(maxsize=None)
def k_snare(f=190.0, tone=0.6, ntau=0.13, bright=1.0, d=0.45, crack=0.5, drive=1.6):
    n = ns(d); t = tt(n)
    fb = f * (1 + 0.3 * np.exp(-t / 0.008))
    body = (np.sin(2 * np.pi * np.cumsum(fb) / SR) + 0.45 * np.sin(2 * np.pi * np.cumsum(fb * 1.71) / SR)) * np.exp(-t / 0.045)
    wires = bp(nz(n), 1600 * bright, min(15000, 9500 * bright)) * np.exp(-t / ntau)
    crk = hp(nz(n), 3500) * np.exp(-t / 0.0035)
    y = np.tanh(drive * (tone * body + wires * 1.1 + crack * crk)) / np.tanh(drive)
    return fade(y, 0.0005, 0.03)


@lru_cache(maxsize=None)
def k_clap(d=0.4, tau=0.12, lo=900.0, hi=6500.0):
    n = ns(d); t = tt(n); x = bp(nz(n), lo, hi); e = np.zeros(n)
    for o in (0, 0.0085, 0.017, 0.026): e += (t >= o) * np.exp(-np.maximum(0, t - o) / 0.0032)
    e += (t >= 0.028) * np.exp(-np.maximum(0, t - 0.028) / tau) * 0.75
    return fade(x * e * 0.9, 0, 0.03)


MET = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)


@lru_cache(maxsize=None)
def k_hat(open_=False, tau=None, tone=1.0, d=None):
    tau = tau or (0.2 if open_ else 0.028); d = d or (0.7 if open_ else 0.14)
    n = ns(d); t = tt(n)
    m = sum(np.sign(np.sin(2 * np.pi * f * tone * 1.47 * t + i)) for i, f in enumerate(MET))
    y = bp(m, 7000, 12500) * 0.35 + hp(nz(n), 8500) * 0.75
    y = hp(y, 6800) * np.exp(-t / tau) * np.minimum(1, t / 0.0006)
    return fade(y, 0, 0.02)


@lru_cache(maxsize=None)
def k_crash(d=2.4, tau=0.75, tone=1.0):
    n = ns(d); t = tt(n); r = rng(f"crash{d}{tau}{tone}")
    m = sum(np.sign(np.sin(2 * np.pi * f * tone * 2.13 * t + i)) for i, f in enumerate(MET))
    env = np.exp(-t / tau) * np.minimum(1, t / 0.002) * (1 + 1.2 * np.exp(-t / 0.05))
    out = []
    for c in range(2):
        w = r.standard_normal(n)
        y = hp(w, 3200) * 0.8 + bp(m * (1 + 0.02 * c), 3500, 12000) * 0.25 + bp(w, 600, 2500) * 0.15 * np.exp(-t / 0.2)
        out.append(y * env)
    return fade(np.array(out) * 0.55, 0, 0.1)


@lru_cache(maxsize=None)
def k_ride(d=1.2, tau=0.45):
    n = ns(d); t = tt(n)
    bell = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / (tau * 0.6)) / (i + 1) for i, f in enumerate((2950, 4120, 5480, 7400)))
    y = hp(nz(n), 5200) * np.exp(-t / tau) * 0.5 + bell * 0.18 + hp(nz(n), 3000) * np.exp(-t / 0.01) * 0.4
    return fade(y * np.minimum(1, t / 0.0008), 0, 0.05)


@lru_cache(maxsize=None)
def k_tom(f=120.0, d=0.6, tau=0.22, synth=False):
    n = ns(d); t = tt(n)
    fb = f * (1 + (0.9 * np.exp(-t / 0.12) if synth else 0.45 * np.exp(-t / 0.025)))
    y = np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-t / tau) + lp(nz(n), 1500) * np.exp(-t / 0.018) * 0.5
    if synth: y += bp(nz(n), 800, 4000) * np.exp(-t / 0.08) * 0.15
    return fade(np.tanh(1.4 * y), 0.0005, 0.04)


@lru_cache(maxsize=None)
def k_tamb(d=0.18):
    n = ns(d); t = tt(n); y = np.zeros(n)
    for o in (0, 0.012, 0.03):
        k = ns(o); y[k:] += bp(nz(n - k), 6000, 13000) * np.exp(-t[: n - k] / 0.03)
    return y * 0.5


@lru_cache(maxsize=None)
def k_shaker(): d = 0.08; t = tt(ns(d)); return bp(nz(ns(d)), 4500, 12000) * np.sin(np.pi * t / d) ** 2 * 0.45


@lru_cache(maxsize=None)
def k_rim(): return A._wood(1750, 160) * 0.6 + hp(nz(ns(0.08)), 3000) * np.exp(-tt(ns(0.08)) / 0.003) * 0.4


@lru_cache(maxsize=None)
def k_taiko(f=62.0, d=0.9):
    n = ns(d); t = tt(n); fb = f * (1 + 0.35 * np.exp(-t / 0.03))
    y = np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-t / 0.28) + lp(nz(n), 700) * np.exp(-t / 0.05) * 0.6
    y += bp(nz(n), 1500, 5000) * np.exp(-t / 0.006) * 0.3
    return fade(np.tanh(1.5 * y), 0.0005, 0.05)


@lru_cache(maxsize=None)
def k_timp(m=38, d=1.6, roll=False):
    f = midi(m); n = ns(d); t = tt(n); y = np.zeros(n)
    for ratio, a, tau in ((1, 1, 0.9), (1.5, 0.45, 0.6), (1.98, 0.3, 0.45), (2.44, 0.18, 0.3)):
        y += np.sin(2 * np.pi * f * ratio * t * (1 + 0.012 * np.exp(-t / 0.06))) * a * np.exp(-t / tau)
    y += lp(nz(n), 900) * np.exp(-t / 0.012) * 0.5
    return fade(y * 0.7, 0.0008, 0.05)


# chip drums (NES-ish)
@lru_cache(maxsize=None)
def k_chip_kick():
    n = ns(0.16); t = tt(n); f = 55 + 190 * np.exp(-t / 0.025)
    y = tri_n(f, n) * np.exp(-t / 0.07); return np.round(y * 7) / 7


@lru_cache(maxsize=None)
def k_chip_noise(tau=0.06, d=0.2, period=6):
    n = ns(d); x = np.sign(nz(n // period + 1)); x = np.repeat(x, period)[:n]
    e = np.round(np.exp(-tt(n) / tau) * 15) / 15
    return x * e * 0.6


# ---------------------------------------------------------------- melodic instruments
@lru_cache(maxsize=None)
def i_ssaw(m, d, cut=5200.0, att=0.006, rel=0.18, det=0.012, voices=7, dec=0.0, sus=1.0, oct_=0.0):
    """stereo supersaw (voices fanned left/right)"""
    f = midi(m); n = ns(d + rel); r = rng(f"ss{m}{voices}")
    L = np.zeros(n); R = np.zeros(n)
    for i, dd in enumerate(np.linspace(-det, det, voices)):
        v = saw_b(f * (1 + dd), n, r.random())
        p = (i / (voices - 1)) * 2 - 1
        L += v * (1 - p * 0.8); R += v * (1 + p * 0.8)
    if oct_:
        o = saw_b(f * 2.002, n, 0.3) * oct_; L += o; R += o
    e = env_note(n, d, att, dec or None, sus, rel)
    return np.stack([lp(L, cut), lp(R, cut)]) * e / voices * 1.2


@lru_cache(maxsize=None)
def i_pluck(m, d=0.25, bright=7000.0, dark=450.0, tau=0.09, amp_tau=0.35, wide=True):
    f = midi(m); n = ns(min(d, 1.2) + 0.3); t = tt(n)
    a = saw_b(f, n) + pulse_b(f * 2, n, 0.3, 0.2) * 0.25
    b = saw_b(f * 1.008, n, 0.5)
    fe = np.exp(-t / tau)
    def flt(x): xd = lp(x, dark); return xd + (lp(x, bright) - xd) * fe
    amp = np.exp(-t / amp_tau) * env_note(n, d + 0.05, 0.002, None, 1, 0.12)
    if not wide: return flt(a + b * 0.8) * amp * 0.6
    return np.stack([flt(a + b * 0.5), flt(a * 0.6 + b)]) * amp * 0.55


@lru_cache(maxsize=None)
def i_lead(m, d, m_from=None, cut=5500.0, vibd=0.006, sub=0.3, bright=1.0):
    n = ns(d + 0.14); t = tt(n)
    f = glide(m, m_from, n, 0.06) * vib(n, 5.6, vibd, 0.16)
    y = saw_b(f, n) + saw_b(f * 1.0055, n, 0.31) * 0.7 + pulse_b(f * 0.5, n, 0.5) * sub
    y = lp(y, cut * bright) * 0.8 + lp(y, cut * 2.2) * 0.25 * np.exp(-t / 0.06)
    return y * env_note(n, d, 0.006, 0.3, 0.85, 0.12) * 0.55


@lru_cache(maxsize=None)
def i_bass(m, d, cut=700.0, tau=0.09, sub=0.7, drive=1.8, env_amt=1.0):
    f = midi(m); n = ns(d + 0.04); t = tt(n)
    s = saw_b(f, n) + saw_b(f * 1.004, n, 0.37) * 0.6
    dk = lp(s, cut); y = dk + (lp(s, cut * 4) - dk) * np.exp(-t / tau) * env_amt
    y = y + sub * np.sin(2 * np.pi * f * t)
    return np.tanh(drive * y) / np.tanh(drive) * env_note(n, d, 0.003, None, 1, 0.03) * 0.75


@lru_cache(maxsize=None)
def i_reese(m, d, cut=650.0, lfo=0.55, sub=0.8):
    f = midi(m); n = ns(d + 0.06); t = tt(n)
    y = saw_b(f * 0.9935, n) + saw_b(f * 1.0065, n, 0.33) + saw_b(f * 1.0, n, 0.71) * 0.5
    lo = lp2(y, cut * 0.55); hi = lp2(y, cut * 2.0); w = 0.5 + 0.5 * np.sin(2 * np.pi * lfo * t - np.pi / 2)
    y = np.tanh(1.8 * (lo + (hi - lo) * w)) + sub * np.sin(2 * np.pi * f / 2 * t)
    return y * env_note(n, d, 0.006, None, 1, 0.05) * 0.6


@lru_cache(maxsize=None)
def i_808(m, d, m_from=None, drive=2.4, tau=1.4):
    n = ns(d + 0.05); t = tt(n)
    f = glide(m, m_from, n, 0.09) * (1 + 0.5 * np.exp(-t / 0.012))
    y = np.tanh(drive * np.sin(2 * np.pi * np.cumsum(f) / SR)) / np.tanh(drive)
    y = y * np.exp(-t / tau) * env_note(n, d, 0.002, None, 1, 0.05)
    y[: ns(0.004)] += hp(nz(ns(0.004)), 2000) * 0.2
    return y * 0.85


@lru_cache(maxsize=None)
def i_sub(m, d): n = ns(d + 0.03); return np.sin(2 * np.pi * midi(m) * tt(n)) * env_note(n, d, 0.004, None, 1, 0.03)


@lru_cache(maxsize=None)
def i_gtr(m, d, mute=False, seed=0, five=True, gain=9.0):
    """distorted power chord (root, fifth, octave) through a cab sim"""
    r = rng(f"g{m}{d}{mute}{seed}"); f = midi(m); n = ns(d + (0.03 if mute else 0.12)); t = tt(n)
    y = np.zeros(n)
    for k, (ratio, a) in enumerate(((1, 1.0), (1.4983, 0.85), (2.0, 0.55)) if five else ((1, 1.0), (2.0, 0.3))):
        o = ns(0.0015 + k * r.uniform(0.002, 0.005))
        v = saw_b(f * ratio * (1 + r.uniform(-0.0018, 0.0018)) * vib(n, 4.8, 0.0015, 0.0, r.random() * 6), n, r.random()) * a
        y[o:] += v[: n - o]
    pre = np.exp(-t / (0.06 if mute else 1.6)) * (1 if not mute else 1.0)
    y = hp(y, 110) * pre + hp(nz(n), 2500) * np.exp(-t / 0.003) * 0.35
    if mute: y = lp(y, 1100)
    y = np.tanh(gain * y)
    y = hp(lp(lp(y, 6800), 9000), 90); y = pk(y, 3000, 6.0, 0.9); y = pk(y, 520, -6.0, 0.7); y = pk(y, 130, 2.5, 1.0)
    return y * env_note(n, d, 0.001, None, 1, 0.03 if mute else 0.1) * 0.3


@lru_cache(maxsize=None)
def i_gtr_lead(m, d, m_from=None, gain=7.0):
    n = ns(d + 0.18); t = tt(n)
    f = glide(m, m_from, n, 0.07) * vib(n, 6.0, 0.009, 0.2)
    y = saw_b(f, n) + pulse_b(f, n, 0.3, 0.1) * 0.5
    y = hp(y, 200) * np.exp(-t / 3.0) + hp(nz(n), 2500) * np.exp(-t / 0.003) * 0.3
    y = np.tanh(gain * y); y = hp(lp(lp(y, 7000), 9000), 160); y = pk(y, 2600, 6.0, 1.0); y = pk(y, 600, -4.0, 0.8)
    return y * env_note(n, d, 0.003, None, 1, 0.14) * 0.3


@lru_cache(maxsize=None)
def i_clean(m, d, seed=0):
    r = rng(f"c{m}{seed}"); f = midi(m) * (1 + r.uniform(-0.0012, 0.0012))
    y = pk(lp(pluck(f, d + 0.5, 0.8, 2.6), 9000), 2800, 4.0, 0.8)
    return y * env_note(len(y), d + 0.3, 0.001, None, 1, 0.2) * 0.8


@lru_cache(maxsize=None)
def i_epiano(m, d, vel=1.0):
    f = midi(m); n = ns(d + 0.45); t = tt(n)
    idx = 1.3 * vel * np.exp(-t / 0.22) + 0.18
    y = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t)) * np.exp(-t / 1.6)
    y += np.sin(2 * np.pi * f * 13.9 * t) * np.exp(-t / 0.025) * 0.07 * vel
    y += np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.5) * 0.12
    return y * env_note(n, d, 0.002, None, 1, 0.25) * 0.45


@lru_cache(maxsize=None)
def i_clav(m, d):
    f = midi(m); n = ns(d + 0.05); t = tt(n)
    y = pulse_b(f, n, 0.22) + saw_b(f * 2, n) * 0.2
    a = bp(y, 500, 1400); b = bp(y, 1200, 4200); w = np.exp(-t / 0.05)
    return (a + (b - a) * w) * np.exp(-t / 0.18) * env_note(n, d, 0.001, None, 1, 0.02) * 1.2


@lru_cache(maxsize=None)
def i_brass(m, d, stab=False, cut=2800.0, fall=False):
    f = midi(m); n = ns(d + 0.16); t = tt(n)
    fv = f * vib(n, 5.2, 0.004, 0.22)
    if fall: fv = fv * (1 - 0.06 * np.clip((t - d * 0.6) / 0.15, 0, 1) ** 2)
    y = saw_b(fv, n) + saw_b(fv * 1.0045, n, 0.3) * 0.8 + saw_b(fv * 0.9965, n, 0.6) * 0.7
    dk = lp(y, cut * 0.32); br = lp2(y, cut * 1.4)
    sw = (1 - np.exp(-t / (0.025 if stab else 0.07))) * (0.7 + 0.3 * np.exp(-t / 0.18))
    y = dk + (br - dk) * sw
    e = env_note(n, d, 0.008 if stab else 0.035, 0.12 if stab else 0.4, 0.55 if stab else 0.85, 0.09)
    return y * e * 0.4


@lru_cache(maxsize=None)
def i_strings(m, d, att=0.18, spicc=False, cut=4200.0):
    r = rng(f"s{m}{spicc}"); f = midi(m); n = ns(d + (0.07 if spicc else 0.35)); t = tt(n)
    y = np.zeros(n)
    for i in range(4):
        fv = f * (1 + r.uniform(-0.003, 0.003)) * (1 + 0.004 * np.sin(2 * np.pi * r.uniform(4.6, 5.8) * t + r.random() * 6))
        y += saw_b(fv, n, r.random())
    y = lp(hp(y, 160), cut * (1.3 if spicc else 1.0)); y = pk(y, 2600, 3, 1.2)
    if spicc: e = np.exp(-t / 0.085) * env_note(n, d, 0.003, None, 1, 0.05)
    else: e = env_note(n, d, att, None, 1, 0.3)
    return y * e * 0.22


@lru_cache(maxsize=None)
def i_choir(m, d, att=0.25):
    f = midi(m); n = ns(d + 0.4); t = tt(n)
    src = saw_b(f * vib(n, 5.0, 0.006, 0.1), n) + saw_b(f * 1.004 * vib(n, 5.4, 0.006, 0.1, 1.0), n, 0.4)
    y = bp(src, 560, 900) + 0.65 * bp(src, 1000, 1350) + 0.3 * bp(src, 2350, 2900) + 0.12 * hp(nz(n), 5000) * 0.3
    return y * env_note(n, d, att, None, 1, 0.35) * 0.55


@lru_cache(maxsize=None)
def i_bell(m, d=0.8, ratio=3.5, idx=1.6):
    f = midi(m); n = ns(d + 0.6); t = tt(n)
    y = np.sin(2 * np.pi * f * t + idx * np.exp(-t / 0.4) * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t / 0.9)
    return y * env_note(n, d + 0.5, 0.001, None, 1, 0.1) * 0.4


@lru_cache(maxsize=None)
def i_harp(m, d=0.6): return lp(pluck(midi(m), d + 0.6, 0.4, 2.0), 5000) * 0.8


@lru_cache(maxsize=None)
def i_chip(m, d, duty=0.25, vibd=0.007, m_from=None):
    n = ns(d + 0.02); t = tt(n)
    f = glide(m, m_from, n, 0.03) * (1 + vibd * np.sign(np.sin(2 * np.pi * 6.0 * t)) * (t > 0.15) * 0.5 + vibd * 0.5 * np.sin(2 * np.pi * 6 * t) * (t > 0.15))
    y = pulse_b(f, n, duty)
    e = np.round(env_note(n, d, 0.001, 0.35, 0.7, 0.02) * 15) / 15
    return y * e * 0.45


@lru_cache(maxsize=None)
def i_chip_tri(m, d):
    n = ns(d + 0.01); y = np.round(tri_n(midi(m), n) * 7.5) / 7.5
    return y * env_note(n, d, 0.001, None, 1, 0.01) * 0.75


# ---------------------------------------------------------------- FX
@lru_cache(maxsize=None)
def fx_riser(d, f0=250.0, f1=9500.0, tone=0.18):
    n = ns(d); t = tt(n); u = t / d; out = []
    for c in range(2):
        y = hp(sweep_filt(nz(n), "low", f0, f1, curve=1.6), 150)
        out.append(y)
    s = saw_b(90 * 2 ** (3.2 * u ** 1.7), n) + saw_b(90.6 * 2 ** (3.2 * u ** 1.7), n, 0.4)
    s = lp(s, 4000) * tone
    out = np.array(out) + s
    return out * (u ** 2.2) * 0.6


@lru_cache(maxsize=None)
def fx_downlift(d=1.6):
    n = ns(d); t = tt(n); out = []
    for c in range(2): out.append(sweep_filt(nz(n), "low", 9000, 150, curve=0.6) * np.exp(-t / (d * 0.35)))
    return fade(np.array(out) * 0.5, 0.002, 0.05)


@lru_cache(maxsize=None)
def fx_boom(d=1.8, f0=85.0, f1=30.0):
    n = ns(d); t = tt(n)
    y = np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / 0.25)) / SR) * np.exp(-t / 0.55)
    y = np.tanh(1.6 * y) + lp(nz(n), 1800) * np.exp(-t / 0.05) * 0.4
    return fade(y * 0.9, 0.001, 0.1)


@lru_cache(maxsize=None)
def fx_revcym(d):
    c = k_crash(d + 0.2, d * 0.45)[:, : ns(d)][:, ::-1]
    return fade(c, 0.05, 0.004) * 0.8


# ---------------------------------------------------------------- notation helpers
PC = {"c": 0, "c#": 1, "db": 1, "d": 2, "d#": 3, "eb": 3, "e": 4, "f": 5, "f#": 6, "gb": 6, "g": 7, "g#": 8, "ab": 8,
      "a": 9, "a#": 10, "bb": 10, "b": 11}
QUAL = {"": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "m7": (0, 3, 7, 10), "maj7": (0, 4, 7, 11), "5": (0, 7),
        "sus4": (0, 5, 7), "m9": (0, 3, 7, 10, 14), "9": (0, 4, 7, 10, 14), "add9": (0, 4, 7, 14), "7sus4": (0, 5, 7, 10),
        "dim": (0, 3, 6), "maj9": (0, 4, 7, 11, 14), "6": (0, 4, 7, 9)}


def nm(s):
    s = s.lower(); return 12 * (int(s[-1]) + 1) + PC[s[:-1]]


def mel(text):
    """'e5 2 g5 2 r 4 a5 4' -> [(step, midi, len_steps)], steps counted from the phrase start"""
    tok = text.split(); out = []; s = 0.0
    for i in range(0, len(tok), 2):
        n, ln = tok[i], float(tok[i + 1])
        if n != "r": out.append((s, nm(n), ln))
        s += ln
    return out


def chd(name):
    r = name[0].lower(); rest = name[1:]
    if rest[:1] in ("#", "b") and not rest.startswith("b5"): r += rest[0]; rest = rest[1:]
    return PC[r], QUAL[rest]


def root(name, lo=28): pc, _ = chd(name); return lo + (pc - lo) % 12


def vc(name, lo=55, top=None):
    """close voicing: every chord tone wrapped into [lo, lo+12)"""
    pc, iv = chd(name); return sorted(lo + (pc + i - lo) % 12 for i in iv)


def dia(m, steps, scale):
    pcs = sorted(scale); o, pc = divmod(m, 12)
    if pc not in pcs: return m + (-3 if steps < 0 else 3)
    i = pcs.index(pc) + steps; o += i // len(pcs); return o * 12 + pcs[i % len(pcs)]


MINOR = lambda k: [(k + i) % 12 for i in (0, 2, 3, 5, 7, 8, 10)]
HMINOR = lambda k: [(k + i) % 12 for i in (0, 2, 3, 5, 7, 8, 11)]
MAJOR = lambda k: [(k + i) % 12 for i in (0, 2, 4, 5, 7, 9, 11)]


# ---------------------------------------------------------------- mastering
def make_ir(rt, seed=5, pre=0.018, bright=7500.0):
    r = np.random.default_rng(seed); n = int(rt * 1.1 * SR); t = np.arange(n) / SR; out = []
    for c in range(2):
        w = r.standard_normal(n)
        for k in range(10): w[int(r.uniform(0.003, 0.07) * SR)] += r.uniform(-1, 1) * 6 * (1 - k / 12)
        ir = lp(w, 1600) * 10 ** (-3 * t / rt) + 0.7 * hp(w, 1600) * 10 ** (-3 * t / (rt * 0.5))
        ir = lp(hp(ir, 160), bright) * np.minimum(1, t / 0.004)
        out.append(ir)
    ir = np.array(out); ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1)


def delay_fx(x, dt, fb=0.35, taps=5):
    d = int(round(dt * SR)); y = np.zeros_like(x); m = hp(lp(0.5 * (x[0] + x[1]), 5200), 280)
    for k in range(1, taps + 1):
        o = k * d
        if o >= x.shape[1]: break
        y[(k - 1) % 2, o:] += m[:-o] * fb ** (k - 1)
    return y


_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def lufs(x, circular=True):
    """ITU BS.1770 integrated loudness (48 kHz K-weighting, gated)"""
    x = np.atleast_2d(x)
    if circular: x = np.concatenate([x[:, -int(0.5 * SR):], x], axis=1)
    y = lfilter(*_K2, lfilter(*_K1, x, axis=1), axis=1)
    if circular: y = y[:, int(0.5 * SR):]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    cs = np.concatenate([np.zeros((y.shape[0], 1)), np.cumsum(y ** 2, axis=1)], axis=1)
    st = np.arange(0, max(1, y.shape[1] - blk), hop)
    ms = ((cs[:, st + blk] - cs[:, st]) / blk).sum(axis=0)
    ld = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[ld > -70]
    if not len(g): return -70.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g = ms[(ld > -70) & (ld > rel)]
    return float(-0.691 + 10 * np.log10(g.mean()))


def limiter_gain(C, ceil=0.89, win=0.012):
    """look-ahead brick-wall gain for a circular signal (gain <= ceil/|x| everywhere)"""
    p = np.max(np.abs(C), axis=0); r = np.minimum(1.0, ceil / (p + 1e-12))
    W = ns(win); pad = 3 * W
    rp = np.concatenate([r[-pad:], r, r[:pad]])
    g = uniform_filter1d(minimum_filter1d(rp, 2 * W + 1), W)
    g = np.minimum(g, rp)
    return g[pad:-pad]


def fold(x, Ls):
    C = x[:, :Ls].copy(); o = Ls
    while o < x.shape[1]:
        k = min(Ls, x.shape[1] - o); C[:, :k] += x[:, o:o + k]; o += k
    return C


def write_wav(name, y, peak=None):
    y = np.asarray(y, dtype=np.float64)
    if y.ndim == 1: y = y[None, :]
    if peak: y = y / (np.max(np.abs(y)) + 1e-9) * peak
    y = np.clip(y, -1, 1)
    d = (RNG.random(y.shape) - RNG.random(y.shape)) / 32768  # TPDF dither
    pcm = np.clip(np.round((y + d) * 32767), -32768, 32767).astype(np.int16)
    import wave
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(pcm.shape[0]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.T.tobytes())
    if MP3:
        q = "3" if name.startswith("music") else "4"
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", os.path.join(OUT, name + ".wav"),
                        "-codec:a", "libmp3lame", "-q:a", q, os.path.join(MP3, name + ".mp3")], check=True)


class Song:
    def __init__(self, name, bpm, bars, rt=1.4, swing=0.0, tail=None, pre=0.02):
        self.name, self.bpm, self.bars, self.swing = name, bpm, bars, swing
        self.st = 60 / bpm / 4; self.beat = 60 / bpm; self.L = bars * 16 * self.st; self.Ls = int(round(self.L * SR))
        self.tail = tail or max(1.8, rt * 0.9 + 0.6); self.N = self.Ls + ns(self.tail)
        self.b = {k: np.zeros((2, self.N)) for k in ("drums", "music", "bass", "fx", "rev", "dly")}
        self.kicks = []; self.rs = rng(name); self.rt = rt; self.ir = make_ir(rt, zlib.crc32(name.encode()) % 1000, pre)

    def T(self, bar, step=0.0):
        sw = self.swing if (step == int(step) and int(step) % 2 == 1) else 0.0
        return (bar * 16 + step + sw) * self.st

    def put(self, bus, x, t, g=1.0, pan=0.0, rv=0.0, dl=0.0, hum=0.0):
        if hum: t += self.rs.uniform(-hum, hum); g *= 1 + self.rs.uniform(-0.1, 0.1)
        i = int(round(t * SR))
        if i < 0 or i >= self.N: return
        a = (max(-1, min(1, pan)) + 1) * np.pi / 4; gl, gr = np.cos(a) * 1.4142, np.sin(a) * 1.4142
        if x.ndim == 1:
            k = min(len(x), self.N - i); xs = np.stack([x[:k] * gl, x[:k] * gr])
        else:
            k = min(x.shape[1], self.N - i); xs = x[:, :k] * np.array([[min(1, gl)], [min(1, gr)]])
        self.b[bus][:, i:i + k] += xs * g
        if rv: self.b["rev"][:, i:i + k] += xs * (g * rv)
        if dl: self.b["dly"][:, i:i + k] += xs * (g * dl)

    def kick(self, x, bar, step=0, g=1.0, rv=0.0, hum=0.0):
        t = self.T(bar, step); self.kicks.append(t % self.L); self.put("drums", x, t, g, 0, rv, 0, hum)

    def seq(self, bus, inst, notes, bar0, g=1.0, pan=0.0, rv=0.0, dl=0.0, legato=1.0, hum=0.0, glide_=False, **kw):
        prev = None
        for s, m, ln in notes:
            bar = bar0 + int(s // 16); step = s % 16
            if glide_: x = inst(m, ln * self.st * legato, m_from=prev, **kw)
            else: x = inst(m, ln * self.st * legato, **kw)
            self.put(bus, x, self.T(bar, step), g, pan, rv, dl, hum); prev = m

    def sc_env(self, depth, rel_beats=0.55, att=0.003):
        env = np.ones(self.Ls)
        if depth <= 0 or not self.kicks: return env
        rl = rel_beats * self.beat; W = ns(rl + att); k = np.arange(W) / SR
        duck = depth * np.where(k < att, k / att, np.clip(1 - (k - att) / rl, 0, 1) ** 2)
        for tk in sorted(set(round(x, 4) for x in self.kicks)):
            i = int(round(tk * SR)) % self.Ls; idx = (i + np.arange(W)) % self.Ls
            env[idx] = np.minimum(env[idx], 1 - duck)
        return env

    def render(self, target=-14.0, sc=0.0, sc_bass=None, sc_rel=0.55, dly=0.75, fb=0.32, glue=1.15, tag="action", bal=(0.0, 0.0, -1.5)):
        N, Ls = self.N, self.Ls
        rev = np.stack([fftconvolve(self.b["rev"][c], self.ir[c])[:N] for c in range(2)])
        dl = delay_fx(self.b["dly"], dly * self.beat, fb)
        env_m = np.resize(self.sc_env(sc, sc_rel), N)
        env_b = np.resize(self.sc_env(sc if sc_bass is None else sc_bass, sc_rel * 0.8), N)
        dr = np.tanh(self.b["drums"] * glue) / glue
        mus = (self.b["music"] + rev + dl) * env_m; bas = self.b["bass"] * env_b
        # bus balance: drums / music / bass loudness (BS.1770 on the folded loop) to the style's offsets (dB)
        lv = [lufs(fold(x, Ls)) for x in (dr, mus, bas)]
        ref = float(np.median([a - o for a, o in zip(lv, bal) if a > -69]))
        gains = [1.0 if a <= -69 else 10 ** (np.clip(ref + o - a, -12, 12) / 20) for a, o in zip(lv, bal)]
        self.bus_db = [round(20 * np.log10(g), 1) for g in gains]
        dr, mus, bas = dr * gains[0], mus * gains[1], bas * gains[2]
        mix = dr + mus + bas + self.b["fx"] * gains[0]
        mix = np.stack([hp(mix[c], 24) for c in range(2)])
        C = fold(mix, Ls); g = 1.0
        for _ in range(5):
            gl = limiter_gain(C * g); lv = lufs(C * g * gl)
            if abs(lv - target) < 0.05: break
            g *= 10 ** ((target - lv) / 20)
        gl = limiter_gain(C * g)
        out = mix * g * np.resize(gl, N)
        out = fade(out, 0, min(0.3, self.tail * 0.3))
        steady = C * g * gl
        st = {"loop": round(self.L, 6), "tail": round(self.tail, 3), "bpm": self.bpm, "lufs": round(lufs(steady), 2),
              "peak_db": round(20 * np.log10(np.max(np.abs(steady)) + 1e-9), 2), "gr_max_db": round(-20 * np.log10(gl.min()), 2),
              "gr_avg_db": round(-20 * np.log10(gl.mean()), 2), "corr": round(float(np.corrcoef(steady[0], steady[1])[0, 1]), 3),
              "kind": tag, "bus_db": self.bus_db}
        write_wav("music_" + self.name, out)
        if os.environ.get("STEMS"):
            gg = g * np.resize(gl, N)
            for nm_, x in (("drums", dr), ("music", mus), ("bass", bas), ("fx", self.b["fx"] * gains[0])):
                write_wav(f"stem_{self.name}_{nm_}", x * gg)
        META["music"][self.name] = st
        print("music", self.name, st, flush=True)


# ================================================================ STYLES
def crash_at(S, bar, g=0.55, step=0): S.put("drums", k_crash(), S.T(bar, step), g, 0, 0.12)


def riser_into_loop(S, bars=2, g=0.5, rev_cym=True):
    d = bars * 16 * S.st; S.put("fx", fx_riser(round(d, 4)), S.L - d, g)
    if rev_cym: dc = round(min(2.0, d), 4); S.put("fx", fx_revcym(dc), S.L - dc, g * 0.6)


def drum_fill(S, bar, kick, snare, toms, start=8, g=1.0, roll=False):
    for s in range(start, 16):
        if roll: S.put("drums", snare, S.T(bar, s), g * (0.35 + 0.65 * (s - start) / (16 - start)), 0, 0.15)
        else:
            tom = toms[min(len(toms) - 1, (s - start) * len(toms) // (16 - start))]
            S.put("drums", tom if s % 2 == 0 or s > 13 else snare, S.T(bar, s), g * (0.8 if s % 2 else 1.0), [-0.4, 0, 0.4][(s - start) * 3 // (16 - start)], 0.18)
    S.kick(kick, bar, start, g)


# ---------------------------------------------------------------- ROCK — E minor, guitars up front
ROCK_HOOK = mel("b4 2 e5 2 g5 2 a5 2 b5 4 a5 2 g5 2  e5 4 g5 2 e5 2 d5 4 b4 4  d5 2 g5 2 b5 2 d6 2 b5 4 a5 2 g5 2  a5 6 f#5 2 a5 2 b5 2 a5 4")
ROCK_B = mel("g5 4 e5 2 g5 2 c6 4 b5 4  a5 4 f#5 2 a5 2 d6 4 c6 2 b5 2  b5 8 g5 4 e5 4  f#5 2 g5 2 a5 2 b5 2 e6 8  "
             "e6 4 d6 2 c6 2 b5 4 g5 4  a5 4 b5 2 c6 2 d6 8  b5 4 d#6 4 f#6 4 d#6 4  b5 8 a5 2 g5 2 f#5 4")


def st_rock(S, act):
    kk = k_kick(130, 60, 0.02, 0.12, 1.1, 1.8); sn = k_snare(200, 0.95, 0.16, 1.0); hh = k_hat(False, 0.035); oh = k_hat(True, 0.18)
    rd = k_ride(); toms = [k_tom(f) for f in (200, 150, 108)]; rim = k_rim()
    PA = ["Em", "C", "G", "D"]; PB = ["C", "D", "Em", "Em", "C", "D", "B", "B"]
    prog = PA * 2 + PB if act else PA * 2; nb = len(prog)
    for bar, c in enumerate(prog):
        r = root(c, 28); g5 = root(c, 40); B = act and bar >= 8
        if act:
            if bar % 4 == 0: crash_at(S, bar, 0.6)
            kicks = [0, 8, 10] + ([7] if bar % 2 else []) + ([3] if B else [])
            if bar == 14: kicks = list(range(16))
            fill = bar in (7, 15)
            for s in range(16):
                if fill and s >= 8: continue
                if s in kicks: S.kick(kk, bar, s, 0.95 if s % 4 == 0 else 0.8, hum=0.002)
                if s in (4, 12): S.put("drums", sn, S.T(bar, s), 1.0, 0, 0.2, hum=0.002)
                if s % 2 == 0 and not (bar % 4 == 0 and s == 0):
                    if B: S.put("drums", rd, S.T(bar, s), 0.5 if s % 4 == 0 else 0.35, 0.35, 0.05, hum=0.002)
                    else: S.put("drums", oh if (s == 14 and bar % 2 == 1) else hh, S.T(bar, s), 0.55 if s % 4 == 0 else 0.38, 0.3, 0, hum=0.002)
            if fill: drum_fill(S, bar, kk, sn, toms, 8, 1.0, roll=(bar == 15))
            # bass: driving 8ths, passing note into the next bar
            nxt = root(prog[(bar + 1) % nb], 28)
            for s in range(0, 16, 1 if bar == 14 else 2):
                m = r + (12 if s == 12 and not B else 0)
                if s == 14: m = nxt + (2 if nxt < r else -1) if nxt != r else r + 7
                S.put("bass", i_bass(m, S.st * (0.9 if bar == 14 else 1.8), 900, 0.05, 0.55, 2.2), S.T(bar, s), 0.85, 0, 0, 0, 0.002)
            # rhythm guitars, double tracked hard left / right
            if bar < 4: hits = [(0, 1.5, 0), (2, 1, 1), (4, 1, 1), (6, 2, 0), (8, 1, 1), (10, 2, 0), (12, 1, 1), (14, 1, 1)]
            elif bar < 8: hits = [(0, 6, 0), (8, 1, 1), (10, 1, 1), (12, 1, 1), (14, 2, 0)]
            elif bar in (14, 15): hits = [(s, 1, 1) for s in range(0, 16, 1)] if bar == 14 else [(0, 8, 0)]
            else: hits = [(0, 6, 0), (6, 4, 0), (10, 6, 0)]
            for s, ln, mute in hits:
                for side, sd in ((-0.85, 0), (0.85, 1)):
                    S.put("music", i_gtr(g5, S.st * ln, bool(mute), sd), S.T(bar, s), 0.9 if not mute else 0.75, side, 0.06, 0, 0.003)
        else:
            if bar == 0: S.put("drums", rd, 0, 0.4, 0.3, 0.1)
            for s in range(16):
                if s in (0, 10) or (bar % 2 and s == 7): S.kick(kk, bar, s, 0.6, hum=0.003)
                if s in (4, 12): S.put("drums", rim, S.T(bar, s), 0.55, -0.1, 0.25, hum=0.003)
                if s % 2 == 0: S.put("drums", hh, S.T(bar, s), 0.48 if s % 4 else 0.6, 0.3, 0, hum=0.003)
                if s % 4 == 2: S.put("drums", k_shaker(), S.T(bar, s), 0.5, -0.4, 0.05)
            if bar == 7: drum_fill(S, bar, kk, sn, toms, 12, 0.6)
            for s in (0, 6, 10): S.put("bass", i_bass(r, S.st * (5 if s == 0 else 3.6), 500, 0.05, 0.6, 1.6), S.T(bar, s), 0.8)
            arp = [0, 7, 12, 7 + 12, 4 if "m" not in c else 3, 12]
            ch = vc(c, 52)
            pat = [ch[0], ch[1] if len(ch) > 1 else ch[0] + 7, ch[0] + 12, ch[-1] + 12, ch[1] + 12 if len(ch) > 1 else ch[0] + 19, ch[0] + 12, ch[-1], ch[1]]
            for i, s in enumerate(range(0, 16, 2)):
                S.put("music", i_clean(pat[i], S.st * 3, i % 2), S.T(bar, s), 0.5, -0.45 if i % 2 else 0.45, 0.25, 0.12, 0.003)
            S.put("music", i_strings(ch[0] + 12, S.st * 16, 0.4), S.T(bar, 0), 0.25, 0, 0.4)
            for x in ch[1:]: S.put("music", i_strings(x + 12, S.st * 16, 0.4), S.T(bar, 0), 0.18, 0.3, 0.4)
    if act:
        S.seq("music", i_gtr_lead, ROCK_HOOK, 4, 0.75, 0.1, 0.18, 0.22, glide_=True)
        S.seq("music", i_gtr_lead, ROCK_B, 8, 0.75, -0.25, 0.18, 0.2, glide_=True)
        harm = [(s, dia(m, -2, HMINOR(4) if s // 16 >= 6 else MINOR(4)), ln) for s, m, ln in ROCK_B]
        S.seq("music", i_gtr_lead, harm, 8, 0.5, 0.35, 0.18, 0.1, glide_=True)
        # synth arp layer in the B section
        for bar in range(8, 16):
            ch = vc(prog[bar], 64)
            for s in range(16):
                S.put("music", i_pluck(ch[s % len(ch)] + (12 if s % 8 >= 4 else 0), S.st * 0.8, 5000, 400, 0.05, 0.12, False), S.T(bar, s), 0.16, 0.5 if s % 2 else -0.5, 0.1, 0.2)
        riser_into_loop(S, 1, 0.35)
    else:
        S.seq("music", i_clean, [(s, m - 12 if m > 80 else m, ln) for s, m, ln in ROCK_HOOK], 4, 0.55, 0.15, 0.35, 0.2)


STYLES = {}


def style(key, bpm_a, bars_a, bpm_c, bars_c, rt_a, rt_c, sc=(0.0, 0.0), sw=(0.0, 0.0), dly=(0.75, 0.75),
          bal_a=(0.0, 0.0, -1.5), bal_c=(-4.0, 0.0, -2.5)):
    def deco(fn):
        STYLES[key] = dict(fn=fn, a=(bpm_a, bars_a, rt_a, sc[0], sw[0], dly[0], bal_a), c=(bpm_c, bars_c, rt_c, sc[1], sw[1], dly[1], bal_c))
        return fn
    return deco


style("rock", 152, 16, 120, 8, 1.1, 1.6, sc=(0.12, 0.0), bal_a=(0.0, 0.5, -2.0), bal_c=(-3.0, 0.0, -2.5))(st_rock)


# ---------------------------------------------------------------- shared kit helpers
@lru_cache(maxsize=None)
def k_gsnare():
    """80s gated-reverb snare"""
    n = ns(0.42); t = tt(n); s = k_snare(185, 0.8, 0.08, 1.0, 0.42)
    gate = np.clip((0.24 - t) / 0.02, 0, 1)
    room = bp(nz(n), 700, 9000) * gate * (0.55 + 0.45 * np.exp(-t / 0.08)) * 0.45
    return np.tanh(1.4 * (s + room))


def edm_drums(S, bar, kk, clap, hh, oh, kick=True, g=1.0, clap_steps=(4, 12), hats16=True, ride=None):
    for s in range(16):
        if kick and s % 4 == 0: S.kick(kk, bar, s, 1.0 * g)
        if s in clap_steps: S.put("drums", clap, S.T(bar, s), 0.85 * g, 0, 0.18)
        if s % 4 == 2: S.put("drums", oh, S.T(bar, s), 0.6 * g, 0.25, 0.05)
        if hats16 and s % 2 == 1: S.put("drums", hh, S.T(bar, s), 0.34 * g, -0.3)
        if ride is not None and s % 2 == 0: S.put("drums", ride, S.T(bar, s), 0.25 * g, 0.35, 0.05)


def snare_build(S, bar0, bars, sn, g=0.8, pan=0.0):
    """8ths -> 16ths -> 32nds snare roll with crescendo, ending on the loop point"""
    total = bars * 16
    for b in range(bars):
        for s in range(16):
            u = (b * 16 + s) / total
            sub = 1 if u > 0.75 else 2 if u > 0.4 else 4
            if s % sub == 0 or (u > 0.875):
                reps = 2 if u > 0.875 else 1
                for r in range(reps):
                    S.put("drums", sn, S.T(bar0 + b, s + r * 0.5), g * (0.3 + 0.7 * u), pan, 0.2)


def pads(S, bar, c, g=0.2, lo=55, cut=2600.0, att=0.02, rel=0.25, length=16, step=0, rv=0.3):
    for m in vc(c, lo): S.put("music", i_ssaw(m, round(S.st * length, 4), cut, att, rel, 0.012, 7), S.T(bar, step), g, 0, rv)


def arp16(S, bar, c, g=0.16, lo=64, pat=(0, 1, 2, 3, 2, 1, 3, 2), every=1, bright=6000.0, dl=0.25, wide=True):
    ch = vc(c, lo); ch = ch + [ch[0] + 12]
    for k, s in enumerate(range(0, 16, every)):
        m = ch[pat[k % len(pat)] % len(ch)]
        x = i_pluck(m, S.st * every * 0.9, bright, 400, 0.06, 0.18, wide)
        S.put("music", x, S.T(bar, s), g, (0.4 if k % 2 else -0.4) if not wide else 0, 0.12, dl)


# ---------------------------------------------------------------- SYNTHWAVE — A minor outrun
SW_HOOK = mel("e5 3 a5 3 c6 2 b5 2 a5 2 g5 2 a5 2  c6 6 a5 2 f5 4 g5 4  e5 3 g5 3 c6 2 d6 2 e6 4 d6 2  d6 6 b5 2 g5 4 b5 2 d6 2")
SW_B = mel("a5 4 c6 4 f6 6 e6 2  d6 4 b5 4 g5 4 d6 4  e6 6 c6 2 a5 4 c6 2 d6 2  e6 12 d6 2 c6 2  "
           "f6 4 e6 2 c6 2 a5 8  b5 4 d6 4 g6 8  g#5 4 b5 4 e6 4 g#6 4  b6 8 r 8")


def st_synthwave(S, act):
    kk = k_kick(150, 55, 0.025, 0.15, 0.9, 2.0); sn = k_gsnare(); hh = k_hat(False, 0.03); oh = k_hat(True, 0.16)
    toms = [k_tom(f, synth=True) for f in (220, 165, 120)]
    PA = ["Am", "F", "C", "G"]; PB = ["F", "G", "Am", "Am", "F", "G", "E", "E"]
    prog = PA * 2 + PB if act else PA * 2
    for bar, c in enumerate(prog):
        r = root(c, 33); B = act and bar >= 8
        if act:
            if bar % 8 == 0: crash_at(S, bar, 0.55)
            for s in range(16):
                if s % 4 == 0 and not (bar == 15 and s >= 8): S.kick(kk, bar, s, 1.0)
                if s in (4, 12) and not (bar == 15 and s == 12): S.put("drums", sn, S.T(bar, s), 0.9, 0, 0.25)
                S.put("drums", hh, S.T(bar, s), (0.32 if s % 4 == 2 else 0.2) * (1.15 if B else 1), 0.3)
                if B and s % 4 == 2: S.put("drums", oh, S.T(bar, s), 0.3, -0.3)
            if bar in (7, 15): drum_fill(S, bar, kk, sn, toms, 12 if bar == 7 else 8, 0.9)
            for s in range(16):
                m = r + (12 if s % 2 else 0)
                S.put("bass", i_bass(m, S.st * 0.9, 650, 0.06, 0.6, 1.8), S.T(bar, s), 0.8 if s % 4 == 0 else 0.62)
            pads(S, bar, c, 0.22, 57, 2400)
            arp16(S, bar, c, 0.15 if bar < 4 else 0.12, 69)
        else:
            if bar == 0: crash_at(S, 0, 0.3)
            for s in range(16):
                if s in (0, 8) or (bar % 2 == 1 and s == 14): S.kick(kk, bar, s, 0.7)
                if s in (4, 12): S.put("drums", sn, S.T(bar, s), 0.55, 0, 0.3)
                if s % 2 == 0: S.put("drums", hh, S.T(bar, s), 0.28 if s % 4 == 2 else 0.18, 0.3)
            for s in range(0, 16, 2):
                S.put("bass", i_bass(r + (12 if s % 4 == 2 else 0), S.st * 1.7, 420, 0.08, 0.7, 1.4), S.T(bar, s), 0.75)
            pads(S, bar, c, 0.24, 57, 1800, 0.25, 0.4)
            arp16(S, bar, c, 0.14, 64, every=2, bright=4200, dl=0.35)
    if act:
        S.seq("music", i_lead, SW_HOOK, 4, 0.55, 0.05, 0.22, 0.28, glide_=True)
        S.seq("music", i_lead, SW_B, 8, 0.58, -0.08, 0.22, 0.28, glide_=True)
        S.seq("music", i_lead, [(s, dia(m, -2, HMINOR(9) if s >= 96 else MINOR(9)), ln) for s, m, ln in SW_B], 8, 0.32, 0.4, 0.2, 0.15, glide_=True, cut=4000.0)
        riser_into_loop(S, 1, 0.4)
    else:
        S.seq("music", i_lead, [(s, m - 12, ln) for s, m, ln in SW_HOOK], 4, 0.45, 0.1, 0.35, 0.35, glide_=True, cut=2600.0, sub=0.0)


# ---------------------------------------------------------------- EDM — big-room festival (F minor / Ab)
EDM_HOOK = mel("c5 2 f5 2 ab5 2 c6 3 bb5 3 ab5 2 g5 2  f5 3 ab5 3 f5 2 db6 3 c6 3 ab5 2  eb5 2 ab5 2 c6 2 eb6 3 db6 3 c6 2 bb5 2  g5 3 bb5 3 eb6 4 db6 2 c6 2 bb5 2")
EDM_HOOK_END = [x for x in EDM_HOOK if x[0] < 48] + mel("r 48 g5 2 bb5 2 c6 2 db6 2 eb6 4 f6 4")


def st_edm(S, act):
    kk = k_kick(190, 56, 0.018, 0.15, 1.0, 2.4); cl = k_clap(); sn = k_snare(220, 0.5, 0.1, 1.2)
    hh = k_hat(False, 0.025); oh = k_hat(True, 0.12)
    prog = ["Fm", "Db", "Ab", "Eb"] * (4 if act else 2)
    for bar, c in enumerate(prog):
        r = root(c, 29)
        if act:
            build = bar >= 14
            if bar in (0, 8): crash_at(S, bar, 0.6); S.put("fx", fx_boom(), S.T(bar, 0), 0.55 if bar == 0 else 0.35)
            if not build: edm_drums(S, bar, kk, cl, hh, oh, ride=k_ride() if bar >= 8 else None)
            else:
                for s in range(0, 16, 4):
                    if bar == 14 or s < 8: S.kick(kk, bar, s, 0.9)
            for s in range(16):
                if not build or bar == 14:
                    if s % 4 == 0: S.put("bass", i_sub(r, round(S.st * 3.6, 4)), S.T(bar, s), 0.42)
                    if s % 4 == 2: S.put("bass", i_bass(r + 12, S.st * 1.6, 1100, 0.07, 0.2, 2.4), S.T(bar, s), 0.8)
            pads(S, bar, c, 0.3 if not build else 0.2, 60, 7000 if not build else 3500, 0.005, 0.2)
            if not build:
                for s in range(0, 16, 2):
                    x = i_pluck(vc(c, 72)[(s // 2) % 3], S.st * 1.5, 6000, 600, 0.05, 0.15, True); S.put("music", x, S.T(bar, s), 0.1, 0, 0.1, 0.2)
        else:
            if bar == 0: crash_at(S, 0, 0.25)
            for s in range(16):
                if s % 4 == 0: S.kick(kk, bar, s, 0.55)
                if s % 4 == 2: S.put("drums", oh, S.T(bar, s), 0.26, 0.25, 0.05)
                if s in (4, 12) and bar >= 4: S.put("drums", cl, S.T(bar, s), 0.4, 0, 0.3)
                if s % 2 == 1: S.put("drums", k_shaker(), S.T(bar, s), 0.35, -0.35)
            S.put("bass", i_sub(r, round(S.st * 15, 4)), S.T(bar, 0), 0.32)
            for s in (2, 6, 10, 14): S.put("bass", i_bass(r + 12, S.st * 1.4, 500, 0.06, 0.15, 1.4), S.T(bar, s), 0.5)
            for s in range(1, 16, 2): S.put("drums", k_hat(False, 0.02), S.T(bar, s), 0.26, 0.3)
            pads(S, bar, c, 0.26, 60, 3200, 0.3, 0.5)
    if act:
        for b0 in (0, 4, 8, 12):
            hook = EDM_HOOK if b0 != 12 else EDM_HOOK_END
            S.seq("music", i_pluck, hook, b0, 0.32, 0, 0.18, 0.18, wide=True, bright=9000.0, dark=900.0, tau=0.12, amp_tau=0.6)
            S.seq("music", i_ssaw, hook, b0, 0.28 if b0 >= 8 else 0.18, 0, 0.2, 0.15, cut=6500.0, att=0.004, rel=0.12, voices=7, det=0.016)
            if b0 >= 8: S.seq("music", i_ssaw, [(s, m + 12, ln) for s, m, ln in hook], b0, 0.12, 0, 0.25, 0.2, cut=7000.0, att=0.004, rel=0.12, voices=5, det=0.014)
        snare_build(S, 14, 2, sn, 0.7)
        riser_into_loop(S, 2, 0.5)
    else:
        S.seq("music", i_pluck, EDM_HOOK, 4, 0.4, 0, 0.3, 0.3, wide=True, bright=5000.0, dark=600.0, tau=0.1, amp_tau=0.45)


# ---------------------------------------------------------------- DRUM & BASS — D minor, reese + rolling breaks
DNB_HOOK = mel("a5 4 d6 4 f6 2 e6 2 d6 4  f6 6 d6 2 bb5 4 c6 4  d6 4 g5 2 bb5 2 d6 4 f6 2 e6 2  e6 8 c#6 4 a5 4")
DNB_HOOK2 = DNB_HOOK[:-3] + mel("r 48 e6 4 f6 2 e6 2 c#6 4 e6 4")


def st_dnb(S, act):
    kk = k_kick(170, 55, 0.018, 0.13, 1.0, 2.0); sn = k_snare(215, 0.9, 0.12, 1.15, 0.4, 0.8); hh = k_hat(False, 0.022)
    oh = k_hat(True, 0.12); rd = k_ride(); toms = [k_tom(f) for f in (210, 160, 120)]
    if act: prog = ["Dm", "Bb", "Gm", "A"] * 4
    else: prog = ["Dm9", "Bbmaj7", "Gm9", "A7"] * 4
    for bar, c in enumerate(prog):
        r = root(c, 38); B = bar >= 8
        gd = 1.0 if act else 0.55
        if bar % 8 == 0: crash_at(S, bar, 0.5 * gd)
        fill = act and bar == 15
        for s in range(16):
            if fill and s >= 8: continue
            if s in (0, 10) or (bar % 4 == 3 and s == 7) or (bar % 2 == 1 and s == 2): S.kick(kk, bar, s, (0.95 if s in (0, 10) else 0.7) * gd)
            if s in (4, 12): S.put("drums", sn, S.T(bar, s), 0.95 * gd, 0, 0.18)
            if act and s in (7, 9, 15) and bar % 2 == 0: S.put("drums", sn, S.T(bar, s), 0.18, 0.1, 0.1)
            if act and s == 14 and bar % 4 == 1: S.put("drums", sn, S.T(bar, s), 0.3, 0.1, 0.1)
            if B and act: S.put("drums", rd if s % 2 == 0 else hh, S.T(bar, s), 0.32 if s % 4 == 2 else 0.2, 0.35, 0.04)
            else: S.put("drums", hh, S.T(bar, s), (0.34 if s % 2 == 0 else 0.16) * gd, 0.3, 0)
            if s % 8 == 6 and bar % 2 == 1: S.put("drums", oh, S.T(bar, s), 0.25 * gd, -0.3)
        if fill: drum_fill(S, bar, kk, sn, toms, 8, 0.95, roll=True)
        if act:
            for s, iv, ln in ((0, 0, 6), (7, 12, 2), (10, 0, 4), (14, 7 if bar % 2 else 12, 2)):
                S.put("bass", i_reese(r + iv, round(S.st * ln, 4), 700 if B else 560), S.T(bar, s), 0.8)
            pads(S, bar, c, 0.13, 57, 2200, 0.15, 0.3, rv=0.45)
            if bar % 2 == 0:
                for m in vc(c, 64): S.put("music", i_pluck(m, S.st * 1.5, 5000, 700, 0.06, 0.2, True), S.T(bar, 6), 0.14, 0, 0.2, 0.25)
            if 4 <= bar < 8:
                ch = vc(c, 72)
                for k, s in enumerate((0, 3, 6, 8, 11, 14)): S.put("music", i_bell(ch[k % len(ch)], 0.4, 3.5, 1.2), S.T(bar, s), 0.22, 0.4 if k % 2 else -0.4, 0.2, 0.3)
        else:
            S.put("bass", i_sub(root(c, 30), round(S.st * 9.5, 4)), S.T(bar, 0), 0.5)
            S.put("bass", i_sub(root(c, 30), round(S.st * 5.5, 4)), S.T(bar, 10), 0.42)
            for s in range(0, 16, 2): S.put("drums", k_hat(False, 0.02), S.T(bar, s), 0.2 if s % 4 else 0.28, 0.3)
            for m in vc(c, 55): S.put("music", i_epiano(m, S.st * 6), S.T(bar, 0), 0.3, 0, 0.3)
            for m in vc(c, 55): S.put("music", i_epiano(m, S.st * 4, 0.6), S.T(bar, 10), 0.22, 0, 0.3)
            for m in vc(c, 62)[:3]: S.put("music", i_strings(m, S.st * 16, 0.5), S.T(bar, 0), 0.4, 0.3, 0.5)
            S.put("drums", k_shaker(), S.T(bar, 2), 0.3, -0.4); S.put("drums", k_shaker(), S.T(bar, 10), 0.3, -0.4)
    if act:
        S.seq("music", i_lead, DNB_HOOK, 8, 0.52, 0.0, 0.2, 0.3, glide_=True)
        S.seq("music", i_lead, DNB_HOOK2, 12, 0.52, 0.0, 0.2, 0.3, glide_=True)
        S.seq("music", i_lead, [(s, m - 12, ln) for s, m, ln in DNB_HOOK2], 12, 0.25, 0.0, 0.15, 0.1, glide_=True, cut=3000.0)
        riser_into_loop(S, 1, 0.4)
    else:
        for b0 in (8, 12):
            S.seq("music", i_bell, [(s, m, min(ln, 4)) for s, m, ln in (DNB_HOOK if b0 == 8 else DNB_HOOK2)], b0, 0.32, 0.2, 0.35, 0.35, ratio=2.0, idx=1.0)


# ---------------------------------------------------------------- TRAP — G minor, 808 slides, hat rolls, epic brass
TRAP_HOOK = mel("g5 2 bb5 2 d6 2 bb5 2 a5 2 bb5 2 g5 4  g5 2 bb5 2 eb6 4 d6 2 c6 2 bb5 4  c6 2 eb6 2 g6 2 eb6 2 d6 2 c6 2 bb5 4  a5 2 c6 2 f#6 4 d6 4 a5 4")


def st_trap(S, act):
    kk = k_kick(160, 55, 0.02, 0.1, 1.0, 1.8); cl = k_clap(0.45, 0.14, 1000, 7000); sn = k_snare(230, 0.6, 0.12, 1.2, 0.4, 0.9)
    prog = ["Gm", "Eb", "Cm", "D"] * (4 if act else 3); nb = len(prog)
    prev = None
    for bar, c in enumerate(prog):
        r = root(c, 31); B = act and bar >= 8
        gd = 1.0 if act else 0.6
        if act and bar % 8 == 0: crash_at(S, bar, 0.5); S.put("fx", fx_boom(2.2, 70, 28), S.T(bar, 0), 0.6)
        pat = [(0, 0, 6), (7, 0, 3), (10, 7, 3), (14, 12, 2)] if act else [(0, 0, 10), (10, 7, 6)]
        if act and bar == nb - 1: pat = [(0, 0, 6), (7, 0, 3), (10, 12, 6)]
        for s, iv, ln in pat:
            m = r + iv
            gl_from = prev if (s in (10, 14) or (s == 0 and prev is not None and abs(prev - m) <= 7)) else None
            S.put("bass", i_808(m, round(S.st * ln, 4), gl_from), S.T(bar, s), 0.78 * (1 if act else 0.8))
            if s in (0, 10) or not act: S.kick(kk, bar, s, 0.75 * gd)
            prev = m
        if act or bar >= 4:
            S.put("drums", cl, S.T(bar, 8), 0.8 * gd, 0, 0.2); S.put("drums", sn, S.T(bar, 8), 0.55 * gd, 0, 0.15)
        roll = bar % 4
        for s in range(0, 16, 2):
            if act and roll == 3 and s >= 12: continue
            if act and roll == 1 and 4 <= s < 8: continue
            S.put("drums", k_hat(False, 0.02, 1.0), S.T(bar, s), (0.48 if s % 4 == 0 else 0.36) * gd, 0.25)
        if act:
            if roll == 1:
                for k in range(6): S.put("drums", k_hat(False, 0.015, round(1.0 + 0.05 * k, 3)), S.T(bar, 4 + k * 4 / 6), 0.26 + 0.04 * k, 0.25)
            if roll == 3:
                for k in range(8): S.put("drums", k_hat(False, 0.012, round(0.9 + 0.06 * k, 3)), S.T(bar, 12 + k * 0.5), 0.24 + 0.035 * k, 0.25 - 0.06 * k)
            if roll == 2: S.put("drums", k_hat(True, 0.15), S.T(bar, 14), 0.25, -0.25)
            if bar % 2 == 1: S.put("drums", k_rim(), S.T(bar, 11), 0.35, -0.4, 0.2)
        elif roll == 3:
            for k in range(4): S.put("drums", k_hat(False, 0.015, 1.0), S.T(bar, 12 + k), 0.12 + 0.02 * k, 0.25)
        for m in vc(c, 55)[:3]: S.put("music", i_strings(m, S.st * 16, 0.35), S.T(bar, 0), (0.32 if B else 0.22), 0.25, 0.4)
        if B:
            for s in (0, 3, 6):
                for m in vc(c, 55): S.put("music", i_brass(m, S.st * (2 if s < 6 else 3), True, 3000.0, s == 6), S.T(bar, s), 0.38, -0.15, 0.25)
                S.put("music", i_brass(root(c, 43), S.st * 2, True, 2000.0), S.T(bar, s), 0.35, 0, 0.2)
    if act:
        for b0 in (0, 4, 8, 12):
            S.seq("music", i_bell, TRAP_HOOK, b0, 0.4 if b0 < 8 else 0.32, -0.1, 0.25, 0.2, ratio=3.5, idx=1.5)
            if b0 >= 8: S.seq("music", i_lead, [(s, m - 12, ln) for s, m, ln in TRAP_HOOK], b0, 0.28, 0.2, 0.25, 0.25, glide_=True, cut=3200.0)
        S.put("fx", fx_revcym(round(2 * S.beat, 4)), S.L - 2 * S.beat, 0.4)
    else:
        S.seq("music", i_bell, TRAP_HOOK, 4, 0.38, -0.1, 0.35, 0.3, ratio=3.5, idx=1.2)
        S.seq("music", i_bell, TRAP_HOOK, 8, 0.3, 0.2, 0.35, 0.3, ratio=2.0, idx=0.9)


# ---------------------------------------------------------------- CHIPTUNE — C major 8-bit racer
CHIP_A = mel("g5 2 c6 2 e6 2 g6 2 e6 2 c6 2 d6 2 e6 2  c6 4 a5 2 c6 2 e6 4 d6 2 c6 2  a5 2 c6 2 f6 2 a6 2 g6 2 f6 2 e6 2 f6 2  g6 6 f6 2 e6 2 d6 2 b5 4")
CHIP_A2 = CHIP_A[:-5] + mel("r 48 b5 2 d6 2 g6 2 b6 2 d7 8")
CHIP_B = mel("f6 4 e6 2 d6 2 a5 4 d6 4  b5 4 d6 2 g6 2 f6 4 d6 4  e6 4 g6 2 b6 2 a6 4 g6 4  a6 8 e6 4 c6 4  "
             "a6 2 g6 2 f6 2 e6 2 f6 4 c6 4  b5 2 c6 2 d6 2 e6 2 f6 4 d6 4  e6 4 g6 4 c7 8  b6 2 a6 2 g6 2 f6 2 e6 2 d6 2 b5 2 g5 2")


def st_chip(S, act):
    nk = k_chip_kick(); sn = k_chip_noise(0.07, 0.2, 5); hh = k_chip_noise(0.012, 0.05, 2)
    prog = (["C", "Am", "F", "G"] * 2 + ["Dm", "G", "Em", "Am", "F", "G", "C", "G"]) if act else ["C", "Am", "F", "G"] * 2
    for bar, c in enumerate(prog):
        r = root(c, 36); fill = act and bar == 15
        for s in range(16):
            if fill and s >= 8:
                S.put("drums", sn, S.T(bar, s), 0.5 + 0.03 * s, 0); continue
            if s in (0, 8) or (act and s in (6, 10) and bar % 2): S.kick(nk, bar, s, 0.85 if act else 0.6)
            if s in (4, 12) and (act or s == 12): S.put("drums", sn, S.T(bar, s), 0.7 if act else 0.45, 0)
            if s % 2 == 0 and act: S.put("drums", hh, S.T(bar, s), 0.35 if s % 4 == 2 else 0.22, 0.2)
            if not act and s % 4 == 2: S.put("drums", hh, S.T(bar, s), 0.25, 0.2)
        for s in range(0, 16, 2 if act else 4):
            S.put("bass", i_chip_tri(r + (12 if (s // 2) % 2 else 0), S.st * (1.8 if act else 3.6)), S.T(bar, s), 0.5)
        ch = vc(c, 60) + [vc(c, 60)[0] + 12]
        step = 0.5 if (act and bar >= 4) else 1.0
        k = 0; s = 0.0
        while s < 16:
            S.put("music", i_chip(ch[k % len(ch)] + 12, round(S.st * step * 0.95, 5), 0.125, 0.0), S.T(bar, s), 0.2 if act else 0.17, 0.7 if k % 2 else -0.7, 0.05, 0.1)
            k += 1; s += step
    if act:
        S.seq("music", i_chip, CHIP_A, 0, 0.6, -0.15, 0.08, 0.12, duty=0.25)
        S.seq("music", i_chip, CHIP_A2, 4, 0.6, -0.15, 0.08, 0.12, duty=0.25)
        S.seq("music", i_chip, CHIP_B, 8, 0.6, -0.15, 0.08, 0.12, duty=0.25)
        allm = CHIP_A + [(x + 64, m, ln) for x, m, ln in CHIP_A2] + [(x + 128, m, ln) for x, m, ln in CHIP_B]
        S.seq("music", i_chip, [(s + 3, m, ln) for s, m, ln in allm if s + 3 < 256], 0, 0.22, 0.75, 0.0, 0.0, duty=0.125)
    else:
        S.seq("music", i_chip, CHIP_A, 4, 0.5, -0.15, 0.12, 0.15, duty=0.5, vibd=0.01)
        S.seq("music", i_chip, [(s + 3, m, ln) for s, m, ln in CHIP_A if s + 3 < 64], 4, 0.2, 0.75, 0.0, 0.0, duty=0.125)


# ---------------------------------------------------------------- FUNK — E dorian, slap bass, clav, horns
FUNK_B = mel("g5 2 b5 2 d6 2 e6 4 d6 2 b5 2 g5 2  f#5 2 a5 2 b5 2 d#6 4 c#6 2 b5 2 a5 2  g5 2 b5 2 e6 3 d6 1 b5 2 d6 6  e6 2 r 2 e6 1 r 1 g6 2 e6 2 d6 2 b5 4")


@lru_cache(maxsize=None)
def i_slap(m, d, pop=False, ghost=False):
    f = midi(m); n = ns(d + 0.04); t = tt(n)
    y = np.sin(2 * np.pi * f * t) + 0.6 * saw_b(f, n) * np.exp(-t / (0.06 if pop else 0.12))
    if pop:
        y += saw_b(f * 2, n, 0.2) * 0.5 * np.exp(-t / 0.05); y[: ns(0.003)] += hp(nz(ns(0.003)), 3000) * 0.8
    else: y[: ns(0.004)] += lp(nz(ns(0.004)), 1500) * 0.6
    y = lp(y, 4200 if pop else 1800)
    if ghost: y = lp(y, 600) * np.exp(-t / 0.02) * 0.6
    return np.tanh(1.5 * y) * np.exp(-t / 0.5) * env_note(n, d, 0.001, None, 1, 0.025) * 0.7


def st_funk(S, act):
    kk = k_kick(115, 55, 0.02, 0.13, 0.9, 1.5); sn = k_snare(210, 0.8, 0.14, 1.0, 0.4, 0.5); hh = k_hat(False, 0.025); oh = k_hat(True, 0.13)
    tb = k_tamb(); toms = [k_tom(f) for f in (200, 150)]
    if act: prog = ["Em7", "A9"] * 4 + ["Cmaj7", "B7", "Em7", "Em7", "Cmaj7", "B7", "Em7", "B7"]
    else: prog = ["Em7", "A9"] * 4
    SL = [(0, 0, 1.5, 0), (3, 12, 1, 1), (4, 0, 0.5, 2), (6, 10, 1, 1), (7, 12, 1, 1), (10, 3, 1, 0), (11, 5, 1, 0), (12, 7, 1, 0), (14, 10, 1, 1), (15, 12, 1, 1)]
    for bar, c in enumerate(prog):
        r = root(c, 28); gd = 1.0 if act else 0.6
        if act and bar % 8 == 0: crash_at(S, bar, 0.45)
        fill = act and bar in (7, 15)
        for s in range(16):
            if fill and s >= 12: continue
            if s in (0, 6, 10) or (bar % 2 and s == 3): S.kick(kk, bar, s, (0.95 if s == 0 else 0.75) * gd, hum=0.002)
            if s in (4, 12): S.put("drums", sn, S.T(bar, s), 0.9 * gd, 0, 0.12, hum=0.002)
            if s in (7, 9, 15): S.put("drums", sn, S.T(bar, s), 0.13 * gd, 0.1, 0.05, hum=0.003)
            if s == 14 and bar % 2: S.put("drums", oh, S.T(bar, s), 0.3 * gd, 0.3)
            elif act or s % 2 == 0: S.put("drums", hh, S.T(bar, s), (0.36 if s % 4 == 2 else 0.24 if s % 2 == 0 else 0.13) * gd, 0.3, 0, hum=0.002)
            if s in (4, 12) or (act and s % 2 == 0 and bar >= 8): S.put("drums", tb, S.T(bar, s), 0.28 * gd, -0.4)
        if fill: drum_fill(S, bar, kk, sn, toms, 12, 0.85)
        if act:
            for s, iv, ln, kind in SL:
                S.put("bass", i_slap(r + iv, round(S.st * ln, 4), kind == 1, kind == 2), S.T(bar, s), 0.95, 0, 0, 0, 0.002)
            ch = vc(c, 60)
            for s, ln, gg in ((2, 0.6, 0.5), (3, 0.3, 0.25), (6, 0.6, 0.5), (8, 0.3, 0.25), (10, 0.6, 0.45), (11, 0.3, 0.2), (14, 0.6, 0.5)):
                for m in ch: S.put("music", i_clav(m, S.st * ln), S.T(bar, s), gg * 0.42, 0.45, 0.05, 0, 0.002)
            for s in range(1, 16, 2): S.put("music", i_clav(ch[0] + 12, S.st * 0.25), S.T(bar, s), 0.14, -0.45, 0.02)
            if bar < 8 and bar % 2 == 1:
                for m in vc(prog[(bar + 1) % len(prog)], 62): S.put("music", i_brass(m, S.st * 1.5, True, 3200.0), S.T(bar, 14), 0.34, -0.15, 0.2)
                for m in vc(c, 62): S.put("music", i_brass(m, S.st * 1.0, True, 3200.0), S.T(bar, 6), 0.3, -0.15, 0.2)
        else:
            for s, iv, ln in ((0, 0, 3), (6, 12, 1), (7, 10, 1), (10, 7, 2), (14, 12, 2)):
                S.put("bass", i_bass(r + iv, S.st * ln, 500, 0.05, 0.5, 1.3), S.T(bar, s), 0.85, 0, 0, 0, 0.003)
            for s, ln in ((0, 3), (6, 1.5), (10, 4)):
                for m in vc(c, 55): S.put("music", i_epiano(m, S.st * ln, 0.8), S.T(bar, s), 0.28, 0, 0.2, 0, 0.003)
            for s in (3, 11): S.put("music", i_clav(vc(c, 60)[0] + 12, S.st * 0.3), S.T(bar, s), 0.18, 0.45, 0.05)
    if act:
        S.seq("music", i_brass, FUNK_B, 8, 0.42, -0.1, 0.2, 0.0, cut=3600.0)
        S.seq("music", i_brass, [(s, m - 12, ln) for s, m, ln in FUNK_B], 8, 0.3, 0.15, 0.2, 0.0, cut=2600.0)
        S.seq("music", i_brass, FUNK_B, 12, 0.42, -0.1, 0.2, 0.0, cut=3600.0)
        S.seq("music", i_brass, [(s, dia(m, -2, [4, 6, 7, 9, 11, 1, 2, 3]), ln) for s, m, ln in FUNK_B], 12, 0.3, 0.2, 0.2, 0.0, cut=3000.0)
    else:
        S.seq("music", i_epiano, FUNK_B, 4, 0.3, 0.25, 0.3, 0.2)


# ---------------------------------------------------------------- ORCHESTRAL — D minor action score (hybrid)
ORC_A = mel("d4 6 a4 2 f4 4 e4 2 d4 2  f4 6 bb4 2 a4 4 g4 2 f4 2  g4 4 bb4 4 d5 6 c5 2  c#5 8 e5 4 a4 4")
ORC_B = mel("d5 4 f5 4 bb5 6 a5 2  a5 6 g5 2 f5 4 c5 4  g5 6 e5 2 c5 4 e5 4  f5 4 e5 2 d5 2 a5 8  "
            "bb5 6 a5 2 g5 4 d5 4  f5 6 e5 2 d5 4 f5 4  e5 4 c#5 4 a4 4 c#5 4  e5 8 r 8")


def st_orch(S, act):
    bd = k_kick(95, 42, 0.04, 0.5, 0.3, 1.4); sn = k_snare(240, 0.5, 0.09, 1.3, 0.3, 0.7)
    if act: prog = ["Dm", "Bb", "Gm", "A"] * 2 + ["Bb", "F", "C", "Dm", "Gm", "Dm", "A", "A"]
    else: prog = ["Dm", "Bb", "Gm", "A"] * 2
    for bar, c in enumerate(prog):
        r = root(c, 38); B = act and bar >= 8; ch = vc(c, 62)
        if act:
            if bar % 8 == 0: crash_at(S, bar, 0.45); S.put("fx", fx_boom(2.0, 75, 30), S.T(bar, 0), 0.5)
            for s, g in ((0, 1.0), (3, 0.6), (6, 0.75), (8, 0.9), (11, 0.6), (14, 0.7)):
                S.put("drums", k_taiko(62 if s in (0, 8) else 85), S.T(bar, s), g * 0.8, -0.2 if s % 2 else 0.2, 0.3)
            S.kick(bd, bar, 0, 0.8); S.kick(bd, bar, 8, 0.6)
            if B and bar < 15:
                for s in range(16): S.put("drums", sn, S.T(bar, s), (0.35 if s % 4 == 0 else 0.18) * (0.7 + 0.3 * (bar - 8) / 7), 0.15, 0.2)
            if bar == 15:
                for k in range(32): S.put("drums", k_timp(root(c, 38)), S.T(bar, k * 0.5), 0.15 + 0.5 * k / 32, 0, 0.3)
            else: S.put("drums", k_timp(r), S.T(bar, 0), 0.8, 0, 0.3)
            acc = (0, 3, 6, 8, 11, 14)
            for s in range(16):
                hi = ch[1 if s % 2 else 2]
                m = ch[0] + 12 if s % 8 in (0, 3, 6) else hi + (12 if hi < ch[0] else 0)
                S.put("music", i_strings(m, S.st * 0.9, 0.0, True), S.T(bar, s), 0.62 if s in acc else 0.4, -0.45, 0.22)
                if s % 2 == 0: S.put("music", i_strings(r, S.st * 1.6, 0.0, True, 2500.0), S.T(bar, s), 0.62, 0.35, 0.2)
                if s % 2 == 0: S.put("bass", i_strings(r - 12, S.st * 1.6, 0.0, True, 1500.0), S.T(bar, s), 0.5, 0.3, 0.15)
            if B:
                for m in vc(c, 55): S.put("music", i_choir(m, S.st * 16, 0.3), S.T(bar, 0), 0.22, 0, 0.45)
                for m in (root(c, 41), root(c, 41) + 7):
                    S.put("music", i_brass(m, S.st * 3, True, 1800.0), S.T(bar, 0), 0.38, 0.2, 0.25)
                    S.put("music", i_brass(m, S.st * 2, True, 1800.0), S.T(bar, 6), 0.3, 0.2, 0.25)
        else:
            if bar % 4 == 0: S.put("drums", k_timp(r), S.T(bar, 0), 0.45, 0, 0.4)
            S.put("drums", k_taiko(60), S.T(bar, 0), 0.35, 0, 0.4); S.put("drums", k_taiko(60), S.T(bar, 3), 0.2, 0, 0.4)
            for m in vc(c, 50): S.put("music", i_strings(m, S.st * 16, 0.6), S.T(bar, 0), 0.5, -0.2, 0.45)
            S.put("bass", i_strings(root(c, 33), S.st * 16, 0.6, False, 1500.0), S.T(bar, 0), 0.55, 0.2, 0.4)
            arp = ch + [ch[0] + 12, ch[1] + 12, ch[0] + 12, ch[2]]
            for k, s in enumerate(range(0, 16, 2)): S.put("music", i_harp(arp[k % len(arp)] + 12, 0.5), S.T(bar, s), 0.32, 0.4, 0.35)
    if act:
        S.seq("music", i_brass, ORC_A, 4, 0.55, 0.15, 0.3, 0.0, cut=1800.0)
        S.seq("music", i_brass, [(s, m - 12, ln) for s, m, ln in ORC_A], 4, 0.4, 0.25, 0.3, 0.0, cut=1300.0)
        S.seq("music", i_brass, ORC_B, 8, 0.55, -0.1, 0.3, 0.0, cut=3200.0)
        S.seq("music", i_strings, [(s, m + 12, ln) for s, m, ln in ORC_B], 8, 0.55, -0.35, 0.35, 0.0, att=0.05)
        S.seq("music", i_brass, [(s, m - 12, ln) for s, m, ln in ORC_B], 8, 0.42, 0.25, 0.3, 0.0, cut=1600.0)
        S.put("fx", fx_revcym(round(4 * S.beat, 4)), S.L - 4 * S.beat, 0.5)
    else:
        S.seq("music", i_brass, ORC_A, 4, 0.36, 0.15, 0.45, 0.0, cut=1300.0)


# ---------------------------------------------------------------- MENU — garage lounge (calm) / Nitro Rush anthem (action)
MENU_HOOK = mel("b5 3 a5 3 f#5 2 d5 4 e5 4  c#6 3 a5 3 f#5 2 e5 4 c#5 4  b5 3 g5 3 e5 2 d5 4 e5 4  e5 4 f#5 4 a5 4 c#6 4")
ANTHEM = mel("f#5 2 a5 2 d6 4 e6 2 f#6 2 e6 2 d6 2  e6 4 c#6 2 a5 2 e6 4 f#6 2 e6 2  d6 4 b5 2 f#5 2 d6 2 e6 2 f#6 4  g6 6 f#6 2 e6 4 d6 2 e6 2")
ANTHEM2 = ANTHEM[:-5] + mel("r 48 g6 4 a6 4 b6 8")
ANTHEM_B = mel("f#6 4 d6 2 b5 2 f#6 4 e6 2 d6 2  d6 4 b5 2 g5 2 d6 4 e6 4  f#6 4 a6 4 f#6 4 d6 4  e6 6 c#6 2 a5 4 e6 4  "
               "f#6 4 d6 2 b5 2 f#6 2 g6 2 a6 4  b6 4 a6 2 g6 2 d6 4 b5 4  a5 2 c#6 2 e6 2 a6 2 g6 4 f#6 4  e6 8 c#6 4 a5 4")


def st_menu(S, act):
    kk = k_kick(185, 56, 0.018, 0.15, 1.0, 2.2); cl = k_clap(); hh = k_hat(False, 0.025); oh = k_hat(True, 0.12); sn = k_snare(220, 0.5, 0.1, 1.2)
    if act:
        prog = ["D", "A", "Bm", "G"] * 2 + ["Bm", "G", "D", "A", "Bm", "G", "A", "A"]
        for bar, c in enumerate(prog):
            r = root(c, 33); B = bar >= 8; build = bar >= 14
            if bar % 8 == 0: crash_at(S, bar, 0.55); S.put("fx", fx_boom(), S.T(bar, 0), 0.4)
            edm_drums(S, bar, kk, cl, hh, oh, ride=k_ride() if B and not build else None)
            for s in range(16):
                if s % 4 == 0: S.put("bass", i_sub(r, round(S.st * 3.6, 4)), S.T(bar, s), 0.42)
                if s % 4 == 2: S.put("bass", i_bass(r + 12, S.st * 1.6, 1100, 0.07, 0.2, 2.2), S.T(bar, s), 0.75)
            pads(S, bar, c, 0.28, 57, 7000, 0.005, 0.2)
            arp16(S, bar, c, 0.1, 69, every=1, bright=7000)
            if B:
                for s, ln in ((0, 6), (6, 4), (10, 6)):
                    for side, sd in ((-0.8, 0), (0.8, 1)):
                        S.put("music", i_gtr(root(c, 40), S.st * ln, False, sd, True, 6.0), S.T(bar, s), 0.42, side, 0.05)
        S.seq("music", i_ssaw, ANTHEM, 0, 0.26, 0, 0.2, 0.18, cut=7000.0, att=0.004, rel=0.12, voices=7, det=0.016)
        S.seq("music", i_pluck, ANTHEM, 0, 0.3, 0, 0.15, 0.2, wide=True, bright=9000.0, dark=900.0, tau=0.12, amp_tau=0.6)
        S.seq("music", i_ssaw, ANTHEM2, 4, 0.26, 0, 0.2, 0.18, cut=7000.0, att=0.004, rel=0.12, voices=7, det=0.016)
        S.seq("music", i_pluck, ANTHEM2, 4, 0.3, 0, 0.15, 0.2, wide=True, bright=9000.0, dark=900.0, tau=0.12, amp_tau=0.6)
        S.seq("music", i_lead, ANTHEM_B, 8, 0.5, 0, 0.22, 0.25, glide_=True, cut=6500.0)
        S.seq("music", i_ssaw, [(s, dia(m, -2, MAJOR(2)), ln) for s, m, ln in ANTHEM_B], 8, 0.2, 0, 0.2, 0.15, cut=6000.0, att=0.004, rel=0.12, voices=5, det=0.014)
        snare_build(S, 14, 2, sn, 0.55)
        riser_into_loop(S, 2, 0.45)
    else:
        prog = ["Gmaj7", "F#m7", "Em7", "A7sus4"] * 3
        for bar, c in enumerate(prog):
            r = root(c, 33)
            for s in range(16):
                if s % 4 == 0: S.kick(kk, bar, s, 0.5)
                if s in (4, 12): S.put("drums", cl, S.T(bar, s), 0.42, 0, 0.3)
                if s % 4 == 2: S.put("drums", oh, S.T(bar, s), 0.26, 0.3, 0.05)
                if s % 2 == 1: S.put("drums", k_shaker(), S.T(bar, s), 0.3, -0.35)
            for s in range(0, 16, 2): S.put("bass", i_bass(r + (12 if s % 4 == 2 else 0), S.st * 1.5, 700, 0.05, 0.25, 1.5), S.T(bar, s), 0.62)
            for s in range(0, 16, 2): S.put("drums", k_hat(False, 0.02), S.T(bar, s), 0.22, 0.35)
            for s, ln in ((0, 3), (6, 2), (10, 4)):
                for m in vc(c, 57): S.put("music", i_epiano(m, S.st * ln, 0.9), S.T(bar, s), 0.26, 0, 0.25, 0.08)
            S.put("music", i_strings(vc(c, 62)[0] + 12, S.st * 16, 0.5), S.T(bar, 0), 0.25, 0, 0.4)
        S.seq("music", i_pluck, MENU_HOOK, 4, 0.38, 0.1, 0.3, 0.3, wide=True, bright=4500.0, dark=700.0, tau=0.1, amp_tau=0.5)
        S.seq("music", i_bell, MENU_HOOK, 8, 0.3, -0.2, 0.3, 0.3, ratio=2.0, idx=1.1)


style("synthwave", 128, 16, 100, 8, 1.8, 2.4, sc=(0.45, 0.3), bal_a=(-0.5, 0.0, -1.5))(st_synthwave)
style("edm", 128, 16, 120, 8, 1.6, 2.2, sc=(0.75, 0.45), bal_a=(0.0, 0.5, -2.0))(st_edm)
style("dnb", 174, 16, 172, 16, 1.4, 2.0, sc=(0.3, 0.2), bal_a=(0.5, -1.0, 0.0), bal_c=(-3.0, 0.0, -4.0))(st_dnb)
style("trap", 145, 16, 130, 12, 1.5, 2.2, sc=(0.0, 0.0), bal_a=(-1.0, -0.5, 0.5), bal_c=(-4.0, 0.0, -1.0))(st_trap)
style("chiptune", 160, 16, 120, 8, 0.6, 0.9, sc=(0.0, 0.0), bal_a=(-2.0, 1.0, -3.0), bal_c=(-4.0, 1.0, -3.0))(st_chip)
style("funk", 124, 16, 104, 8, 1.0, 1.4, sc=(0.1, 0.0), sw=(0.1, 0.16), bal_a=(0.0, -1.0, 0.0), bal_c=(-3.5, 0.0, -1.5))(st_funk)
style("orchestral", 140, 16, 90, 8, 2.4, 2.8, sc=(0.0, 0.0), bal_a=(-2.0, 1.0, -5.0), bal_c=(-6.0, 0.0, -5.0))(st_orch)
style("menu", 126, 16, 112, 12, 1.6, 2.0, sc=(0.6, 0.35), bal_a=(0.0, 0.5, -2.0), bal_c=(-3.5, 0.0, -2.5))(st_menu)


# ---------------------------------------------------------------- DRIFT KINGS — EUROBEAT (F# minor, 156 bpm)
# The classic drift-video sound: four-on-the-floor, octave-jumping bass, offbeat brass stabs, racing supersaw hook.
EURO_A = mel("f#5 2 a5 2 c#6 2 e6 4 c#6 2 b5 2 a5 2  b5 2 a5 2 f#5 4 a5 2 b5 2 d6 4  e6 2 d6 2 c#6 2 b5 2 c#6 4 e6 4  c#6 6 b5 2 g#5 4 c#6 4")
EURO_A2 = EURO_A[:-4] + mel("r 48 c#6 2 e6 2 f#6 4 g#6 4 e6 4")
EURO_B = mel("d6 4 c#6 2 b5 2 a5 4 f#5 4  e6 4 d6 2 c#6 2 b5 4 g#5 4  a5 2 c#6 2 f#6 4 e6 2 c#6 2 a5 4  f#6 8 e6 4 c#6 4  "
             "d6 2 f#6 2 a6 4 g#6 2 f#6 2 e6 4  e6 2 g#6 2 b6 4 a6 2 g#6 2 f#6 4  f6 4 g#6 4 c#7 4 g#6 4  c#7 8 r 8")


def st_eurobeat(S, act):
    kk = k_kick(165, 50, 0.018, 0.17, 1.1, 2.6); cl = k_clap(0.42, 0.13, 1100, 7500); hh = k_hat(False, 0.022); oh = k_hat(True, 0.1)
    sn = k_snare(235, 0.5, 0.1, 1.3)
    PA = ["F#m", "D", "E", "C#m"]; PB = ["D", "E", "F#m", "F#m", "D", "E", "C#", "C#"]
    prog = PA * 2 + PB if act else PA * 2
    for bar, c in enumerate(prog):
        r = root(c, 30); B = act and bar >= 8
        if act:
            if bar % 4 == 0: crash_at(S, bar, 0.5)
            if bar % 8 == 0: S.put("fx", fx_boom(1.6, 95, 36), S.T(bar, 0), 0.35)
            edm_drums(S, bar, kk, cl, hh, oh)
            # the eurobeat bass: bouncing root / octave 8ths
            for s in range(0, 16, 2):
                m = r + (12 if s % 4 == 2 else 0)
                S.put("bass", i_bass(m, S.st * 1.7, 1500, 0.045, 0.35, 2.6), S.T(bar, s), 0.88 if s % 4 == 0 else 0.76)
            # synth-brass stabs on the offbeats (all of them in the chorus)
            for s in ((2, 6, 10, 14) if B else (6, 14)):
                for m in vc(c, 60): S.put("music", i_brass(m, S.st * 1.1, True, 5200.0), S.T(bar, s), 0.15, 0, 0.1)
            arp16(S, bar, c, 0.12 if B else 0.14, 69, pat=(0, 1, 2, 1, 3, 2, 1, 2), bright=8000.0)
            pads(S, bar, c, 0.16, 57, 5200, 0.01, 0.2)
        else:
            for s in range(16):
                if s % 4 == 0: S.kick(kk, bar, s, 0.55)
                if s in (4, 12): S.put("drums", cl, S.T(bar, s), 0.45, 0, 0.25)
                if s % 4 == 2: S.put("drums", oh, S.T(bar, s), 0.28, 0.25, 0.05)
            for s in range(0, 16, 2):
                S.put("bass", i_bass(r + (12 if s % 4 == 2 else 0), S.st * 1.6, 700, 0.05, 0.4, 1.8), S.T(bar, s), 0.7)
            arp16(S, bar, c, 0.13, 64, pat=(0, 2, 1, 3), every=2, bright=4800.0, dl=0.35)
            pads(S, bar, c, 0.22, 57, 2600, 0.15, 0.4)
    if act:
        for b0, ph in ((0, EURO_A), (4, EURO_A2)):
            S.seq("music", i_ssaw, ph, b0, 0.3, 0, 0.18, 0.2, cut=8000.0, att=0.004, rel=0.1, voices=7, det=0.018)
            S.seq("music", i_pluck, ph, b0, 0.22, 0, 0.12, 0.15, wide=True, bright=9500.0, dark=900.0, tau=0.1, amp_tau=0.5)
        S.seq("music", i_lead, EURO_B, 8, 0.52, 0, 0.2, 0.22, glide_=True, cut=7500.0)
        S.seq("music", i_ssaw, [(s, dia(m, -2, HMINOR(6) if s >= 96 else MINOR(6)), ln) for s, m, ln in EURO_B], 8, 0.2, 0, 0.2, 0.15,
              cut=6500.0, att=0.004, rel=0.12, voices=5, det=0.015)
        snare_build(S, 14, 2, sn, 0.5)
        riser_into_loop(S, 2, 0.45)
    else:
        S.seq("music", i_pluck, EURO_A, 4, 0.36, 0.1, 0.3, 0.3, wide=True, bright=5200.0, dark=700.0, tau=0.1, amp_tau=0.45)


# ---------------------------------------------------------------- DRIFT KINGS — DRIFT PHONK (C# minor, half-time)
# Cowbell riffs, a distorted sliding 808, crunchy kick, snare on 3 and rolling Memphis hats.
@lru_cache(maxsize=None)
def i_cowbell(m, d=0.3, tau=0.15, drive=1.8):
    f = midi(m); n = ns(d + 0.12); t = tt(n)
    y = pulse_b(f, n, 0.5) + pulse_b(f * 1.48, n, 0.5) * 0.75
    y = bp(y, f * 0.85, min(SR * 0.45, f * 5.0))
    e = np.exp(-t / tau) * 0.75 + np.exp(-t / 0.01) * 0.25
    y = np.tanh(drive * y * e) / np.tanh(drive)
    return y * env_note(n, d, 0.001, None, 1, 0.05) * 0.55


PHONK_RIFF = mel("c#6 2 c#6 2 e6 2 c#6 2 g#5 2 b5 2 c#6 4  c#6 2 c#6 2 e6 2 f#6 2 e6 2 c#6 2 b5 4  "
                 "a5 2 a5 2 c#6 2 a5 2 e5 2 g#5 2 a5 4  b5 2 b5 2 d#6 2 e6 2 d#6 2 b5 2 g#5 4")
PHONK_HI = mel("g#6 2 r 2 g#6 2 b6 2 c#7 4 b6 2 g#6 2  e6 2 r 2 e6 2 f#6 2 g#6 4 f#6 2 e6 2  "
               "c#6 2 r 2 c#6 2 e6 2 a6 4 g#6 2 e6 2  d#6 2 r 2 d#6 2 f#6 2 b6 4 a6 2 g#6 2")


def st_phonk(S, act):
    kk = k_kick(150, 46, 0.015, 0.22, 1.3, 3.2); sn = k_snare(210, 0.55, 0.12, 1.1, 0.4, 1.0); cl = k_clap(0.42, 0.12, 900, 6500)
    prog = (["C#m", "C#m", "A", "B"] * 4) if act else (["C#m", "C#m", "A", "B"] * 2)
    prev = None
    for bar, c in enumerate(prog):
        r = root(c, 25); B = act and bar >= 8; g = 1.0 if act else 0.62
        if act and bar % 8 == 0: crash_at(S, bar, 0.45); S.put("fx", fx_boom(2.0, 70, 28), S.T(bar, 0), 0.55)
        # 808: long root, a slide up the octave and back at the end of the bar
        pat = [(0, 0, 7), (7, 0, 3), (10, 12, 3), (13, 7, 3)] if act else [(0, 0, 10), (10, 7, 6)]
        for s, iv, ln in pat:
            m = r + iv
            S.put("bass", i_808(m, round(S.st * ln, 4), prev if s >= 10 else None, 3.0, 1.2), S.T(bar, s), 0.82 * (1 if act else 0.8))
            if s in (0, 7) or (not act and s == 0): S.kick(kk, bar, s, 0.8 * g)
            prev = m
        # snare + clap on beat 3 (half-time)
        S.put("drums", sn, S.T(bar, 8), 0.7 * g, 0, 0.18); S.put("drums", cl, S.T(bar, 8), 0.55 * g, 0, 0.12)
        # Memphis hats: 8ths with triplet rolls every other bar
        for s in range(0, 16, 2):
            if act and bar % 2 == 1 and s >= 12: continue
            S.put("drums", k_hat(False, 0.018, 1.05), S.T(bar, s), (0.42 if s % 4 == 0 else 0.3) * g, 0.25)
        if act and bar % 2 == 1:
            for k in range(6): S.put("drums", k_hat(False, 0.014, round(1.0 + 0.04 * k, 3)), S.T(bar, 12 + k * 4 / 6), 0.22 + 0.04 * k, 0.25 - 0.08 * k)
        if act and bar % 4 == 3: S.put("drums", k_hat(True, 0.14), S.T(bar, 14), 0.25, -0.25)
        # dark detuned pad
        for m in vc(c, 52)[:3]: S.put("music", i_strings(m, S.st * 16, 0.3, False, 2400.0), S.T(bar, 0), 0.2 if act else 0.24, 0.2, 0.45)
        if B:
            for s in (0, 6):
                for m in vc(c, 55): S.put("music", i_brass(m, S.st * 3, True, 2600.0, True), S.T(bar, s), 0.22, -0.2, 0.25)
    if act:
        for b0 in (0, 4, 8, 12):
            S.seq("music", i_cowbell, PHONK_RIFF, b0, 0.5, -0.05, 0.12, 0.18)
            if b0 >= 8: S.seq("music", i_cowbell, PHONK_HI, b0, 0.3, 0.3, 0.15, 0.25)
        S.put("fx", fx_revcym(round(2 * S.beat, 4)), S.L - 2 * S.beat, 0.4)
    else:
        for b0 in (0, 4):
            S.seq("music", i_cowbell, PHONK_RIFF, b0, 0.36, -0.05, 0.3, 0.3, tau=0.2, drive=1.2)


style("eurobeat", 156, 16, 132, 8, 1.3, 1.8, sc=(0.45, 0.25), bal_a=(0.0, 0.5, -1.5), bal_c=(-3.5, 0.0, -2.5))(st_eurobeat)
style("phonk", 132, 16, 100, 8, 1.2, 1.8, sc=(0.0, 0.0), bal_a=(-0.5, -1.0, 1.0), bal_c=(-3.5, 0.0, -1.0))(st_phonk)


# ---------------------------------------------------------------- HIGHWAY HEAT — CHASE (A minor, 70s cop-show action theme)
# Driving 16th hats, syncopated octave bass, clav chops, bongos, brass melody, timpani on the turnarounds.
CHASE_A = mel("a5 3 c6 3 e6 2 d6 4 c6 2 b5 2  a5 3 c6 3 e6 2 g6 4 f6 2 e6 2  f6 3 e6 3 d6 2 c6 4 d6 2 e6 2  e6 6 g#5 2 b5 4 e6 4")
CHASE_B = mel("a6 4 g6 2 e6 2 c6 4 e6 4  g6 4 f6 2 d6 2 b5 4 d6 4  f6 4 e6 2 c6 2 a5 4 c6 2 d6 2  e6 8 g#6 4 b6 4  "
              "c7 4 b6 2 a6 2 e6 4 a6 4  g6 4 f6 2 e6 2 d6 4 f6 4  e6 2 f6 2 e6 2 d6 2 c6 2 b5 2 a5 2 g#5 2  a5 8 r 8")


def st_chase(S, act):
    kk = k_kick(140, 55, 0.02, 0.13, 1.0, 1.9); sn = k_snare(215, 0.7, 0.13, 1.1); hh = k_hat(False, 0.03); oh = k_hat(True, 0.14)
    bongo_hi, bongo_lo = k_tom(330, 0.25, 0.08), k_tom(240, 0.3, 0.1)
    PA = ["Am", "Am", "F", "E"]; PB = ["Am", "G", "F", "E", "Am", "G", "F", "E"]
    prog = PA * 2 + PB if act else PA * 2
    for bar, c in enumerate(prog):
        r = root(c, 33); B = act and bar >= 8; g = 1.0 if act else 0.6
        if act and bar % 4 == 0: crash_at(S, bar, 0.5)
        if act and c == "E" and bar % 4 == 3:
            S.put("drums", k_timp(40, 1.2), S.T(bar, 0), 0.7, 0, 0.3); S.put("drums", k_timp(40, 1.0), S.T(bar, 8), 0.6, 0, 0.3)
        for s in range(16):
            if s in (0, 6, 10) or (B and s == 14): S.kick(kk, bar, s, 0.9 * g)
            if s in (4, 12): S.put("drums", sn, S.T(bar, s), 0.85 * g, 0, 0.18)
            if act: S.put("drums", oh if s % 8 == 6 else hh, S.T(bar, s), (0.42 if s % 4 == 2 else 0.26) * g, 0.3)
            elif s % 2 == 0: S.put("drums", hh, S.T(bar, s), 0.3, 0.3)
            if s in (3, 7, 11, 13, 15): S.put("drums", bongo_hi if s % 4 == 3 else bongo_lo, S.T(bar, s), 0.35 * g, -0.45, 0.08)
        # syncopated octave bass with a chromatic walk into the next chord
        for s, iv, ln in ((0, 0, 2), (3, 12, 1), (4, 0, 2), (7, 12, 1), (8, 0, 2), (10, 7, 2), (12, 12, 2), (14, 10, 2)):
            S.put("bass", i_bass(r + iv, S.st * ln * 0.9, 1100, 0.05, 0.4, 2.2), S.T(bar, s), 0.85 * (1 if act else 0.8))
        # clav chops on the offbeats
        for s in (2, 6, 10, 14):
            for m in vc(c, 57): S.put("music", i_clav(m, S.st * 0.8), S.T(bar, s), 0.16 * g, 0.35)
        if B:
            for s in (0, 3, 6):
                for m in vc(c, 55): S.put("music", i_brass(m, S.st * (2 if s < 6 else 3), True, 3400.0, s == 6), S.T(bar, s), 0.3, -0.1, 0.2)
        for m in vc(c, 57)[:3]: S.put("music", i_strings(m, S.st * 16, 0.25), S.T(bar, 0), 0.18 if act else 0.24, 0.2, 0.35)
    if act:
        for b0 in (0, 4):
            S.seq("music", i_brass, CHASE_A, b0, 0.5, 0.05, 0.2, 0.15, cut=4200.0)
            S.seq("music", i_brass, [(s, m - 12, ln) for s, m, ln in CHASE_A], b0, 0.32, -0.25, 0.2, 0.1, cut=3000.0)
        S.seq("music", i_lead, CHASE_B, 8, 0.45, 0.1, 0.2, 0.2, glide_=True, cut=5500.0)
        S.seq("music", i_brass, [(s, dia(m, -2, HMINOR(9)), ln) for s, m, ln in CHASE_B], 8, 0.3, -0.2, 0.2, 0.1, cut=3600.0)
        snare_build(S, 15, 1, sn, 0.5)
        riser_into_loop(S, 1, 0.35)
    else:
        S.seq("music", i_epiano, CHASE_A, 4, 0.4, 0.1, 0.3, 0.25)


# ---------------------------------------------------------------- HIGHWAY HEAT — BIG BEAT (E minor, breakbeat + acid + sirens)
@lru_cache(maxsize=None)
def i_acid(m, d, cut=900.0, env=2600.0, tau=0.12, drive=2.2):
    """303-style squelch: saw through a swept, resonant (peaked) low-pass"""
    f = midi(m); n = ns(d + 0.05); t = tt(n)
    y = saw_b(f, n)
    fc = cut + env * np.exp(-t / tau)
    out = np.empty(n); blk = 128; zi = None
    for i in range(0, n, blk):
        c0 = float(min(SR * 0.45, fc[i]))
        b, a = butter(2, c0 / (SR / 2), "low")
        seg, zi = lfilter(b, a, y[i:i + blk], zi=(zi if zi is not None else np.zeros(2)))
        out[i:i + blk] = seg
    out = out + pk(out, float(cut * 1.4), 9.0, 4.0) * 0.5
    out = np.tanh(drive * out) / np.tanh(drive)
    return out * env_note(n, d, 0.003, None, 1, 0.03) * 0.6


ACID_A = [(0, 0, 2), (2, 0, 1), (3, 12, 1), (4, 0, 2), (6, 10, 1), (7, 0, 1), (8, 3, 2), (10, 0, 1), (11, 12, 1), (12, 7, 2), (14, 5, 1), (15, 3, 1)]
BIG_HOOK = mel("e6 2 r 2 e6 2 g6 2 b6 4 a6 2 g6 2  f#6 2 r 2 f#6 2 a6 2 d7 4 c7 2 b6 2  e6 2 r 2 e6 2 g6 2 c7 4 b6 2 a6 2  b6 6 a6 2 g6 4 f#6 4")


def st_bigbeat(S, act):
    kk = k_kick(150, 50, 0.015, 0.16, 1.2, 2.6); sn = k_snare(200, 0.6, 0.15, 1.2, 0.45, 1.4); hh = k_hat(False, 0.025); oh = k_hat(True, 0.15)
    prog = (["Em", "Em", "C", "D"] * 4) if act else (["Em", "Em", "C", "D"] * 2)
    for bar, c in enumerate(prog):
        r = root(c, 28); B = act and bar >= 8; g = 1.0 if act else 0.6
        if act and bar % 8 == 0: crash_at(S, bar, 0.5); S.put("fx", fx_boom(1.8, 85, 32), S.T(bar, 0), 0.45)
        # funky breakbeat
        for s, gg in ((0, 1.0), (7, 0.7), (10, 0.85)) if act else ((0, 1.0), (10, 0.7)):
            S.kick(kk, bar, s, gg * g)
        for s, gg in ((4, 1.0), (12, 1.0), (9, 0.3), (15, 0.35)) if act else ((4, 0.8), (12, 0.8)):
            S.put("drums", sn, S.T(bar, s), gg * g, 0, 0.12)
        for s in range(0, 16, 2): S.put("drums", oh if s in (6, 14) else hh, S.T(bar, s), (0.4 if s % 4 == 0 else 0.3) * g, 0.25)
        if act and bar % 2 == 1:
            for k in range(4): S.put("drums", hh, S.T(bar, 12 + k), 0.2 + 0.05 * k, -0.2)
        # acid line, the filter opening up in the chorus
        cut = 700.0 + (bar % 8) * 120 + (500 if B else 0)
        for s, iv, ln in ACID_A if act else ACID_A[::2]:
            S.put("bass", i_acid(r + 12 + iv, round(S.st * ln * 0.9, 4), round(cut, 1), 3200.0 if B else 2200.0), S.T(bar, s), 0.62 * (1 if act else 0.75))
        S.put("bass", i_sub(r, round(S.st * 15, 4)), S.T(bar, 0), 0.35)
        # stabs
        if B:
            for s in (0, 6, 12):
                for m in vc(c, 60): S.put("music", i_ssaw(m, S.st * 1.2, 4800.0, 0.003, 0.08, 0.014, 5), S.T(bar, s), 0.2, 0, 0.12)
        for m in vc(c, 52)[:3]: S.put("music", i_strings(m, S.st * 16, 0.3, False, 2600.0), S.T(bar, 0), 0.16 if act else 0.22, 0.2, 0.4)
        # a police wail across the turnaround
        if act and bar % 4 == 3:
            n = ns(S.st * 8); t = tt(n); f = 700 + 500 * np.sin(np.pi * t / (S.st * 8)) ** 2
            S.put("fx", lp(saw_b(f, n), 3000) * np.sin(np.pi * t / (S.st * 8)) * 0.12, S.T(bar, 8), 0.5)
    if act:
        for b0 in (8, 12):
            S.seq("music", i_lead, BIG_HOOK, b0, 0.4, 0.15, 0.2, 0.25, glide_=True, cut=4800.0)
            S.seq("music", i_pluck, BIG_HOOK, b0, 0.22, -0.2, 0.15, 0.2, wide=True, bright=7000.0, dark=700.0, tau=0.08, amp_tau=0.3)
        snare_build(S, 15, 1, sn, 0.45)
        riser_into_loop(S, 1, 0.4)
    else:
        S.seq("music", i_pluck, BIG_HOOK, 4, 0.3, 0.1, 0.3, 0.3, wide=True, bright=4500.0, dark=600.0, tau=0.1, amp_tau=0.5)


style("chase", 138, 16, 108, 8, 1.2, 1.6, sc=(0.0, 0.0), bal_a=(0.0, 0.0, -1.0), bal_c=(-3.5, 0.0, -2.0))(st_chase)
style("bigbeat", 134, 16, 108, 8, 1.1, 1.6, sc=(0.2, 0.1), bal_a=(0.5, -0.5, -0.5), bal_c=(-3.0, 0.0, -1.5))(st_bigbeat)


# ---------------------------------------------------------------- MOTO RUSH GP — RACING METAL (E minor, 168 bpm)
# Double-kick runs, chugging palm-muted rhythm guitars hard left/right, a gallop, a soaring lead guitar hook.
METAL_HOOK = mel("e5 2 g5 2 b5 2 e6 4 d6 2 b5 2 a5 2  b5 2 a5 2 g5 2 e5 4 d5 2 e5 2 g5 2  a5 2 b5 2 c6 2 d6 4 c6 2 b5 2 a5 2  b5 8 d#6 4 f#6 4")
METAL_B = mel("g6 4 f#6 2 e6 2 b5 4 e6 4  f#6 4 e6 2 d6 2 a5 4 d6 4  e6 4 d6 2 c6 2 g5 4 c6 4  b5 4 c6 2 d#6 2 f#6 4 b6 4  "
              "g6 2 a6 2 b6 4 a6 2 g6 2 f#6 4  e6 2 f#6 2 g6 4 f#6 2 e6 2 d6 4  c6 2 d6 2 e6 4 d6 2 c6 2 b5 4  b5 8 r 8")


def st_metal(S, act):
    kk = k_kick(150, 58, 0.012, 0.09, 1.4, 2.2); sn = k_snare(210, 0.85, 0.14, 1.2); hh = k_hat(False, 0.03); rd = k_ride()
    toms = [k_tom(f) for f in (210, 160, 115)]
    PA = ["Em", "C", "D", "B"]; PB = ["C", "D", "Em", "Em", "C", "D", "B", "B"]
    prog = PA * 2 + PB if act else PA * 2
    for bar, c in enumerate(prog):
        r = root(c, 28); g5 = root(c, 40); B = act and bar >= 8; g = 1.0 if act else 0.55
        if act:
            if bar % 4 == 0: crash_at(S, bar, 0.6)
            double = B or bar % 4 == 3
            for s in range(16):
                if double or s in (0, 3, 6, 8, 11, 14): S.kick(kk, bar, s, (0.9 if s % 4 == 0 else 0.7) * g, hum=0.002)
                if s in (4, 12): S.put("drums", sn, S.T(bar, s), 1.0, 0, 0.18, hum=0.002)
                if s % 2 == 0: S.put("drums", rd if B else hh, S.T(bar, s), 0.38 if s % 4 == 0 else 0.26, 0.3, 0.04, hum=0.002)
            if bar in (7, 15): drum_fill(S, bar, kk, sn, toms, 8, 1.0, roll=(bar == 15))
            # gallop chugs (palm muted) with an open power chord on the one
            for s in range(16):
                gallop = s % 4 in (0, 2, 3)
                if not gallop: continue
                for side, sd in ((-0.9, 0), (0.9, 1)):
                    S.put("music", i_gtr(g5, S.st * (2.6 if s == 0 else 0.8), s != 0, sd), S.T(bar, s), 0.85 if s == 0 else 0.7, side, 0.04, 0, 0.002)
            for s in range(0, 16, 2): S.put("bass", i_bass(r, S.st * 1.8, 900, 0.05, 0.55, 2.6), S.T(bar, s), 0.85)
        else:
            for s in range(16):
                if s in (0, 10): S.kick(kk, bar, s, 0.6)
                if s in (4, 12): S.put("drums", k_rim(), S.T(bar, s), 0.5, -0.1, 0.2)
                if s % 2 == 0: S.put("drums", hh, S.T(bar, s), 0.3 if s % 4 == 0 else 0.2, 0.3)
            ch = vc(c, 52)
            pat = [ch[0], ch[1] if len(ch) > 1 else ch[0] + 7, ch[0] + 12, ch[-1] + 12, ch[1] + 12 if len(ch) > 1 else ch[0] + 19, ch[0] + 12, ch[-1], ch[1]]
            for i, s in enumerate(range(0, 16, 2)): S.put("music", i_clean(pat[i], S.st * 3, i % 2), S.T(bar, s), 0.48, -0.45 if i % 2 else 0.45, 0.25, 0.12)
            for s in (0, 8): S.put("bass", i_bass(r, S.st * 7, 600, 0.06, 0.6, 1.6), S.T(bar, s), 0.75)
    if act:
        S.seq("music", i_gtr_lead, METAL_HOOK, 0, 0.7, 0.1, 0.2, 0.22, glide_=True)
        S.seq("music", i_gtr_lead, METAL_HOOK, 4, 0.7, 0.1, 0.2, 0.22, glide_=True)
        S.seq("music", i_gtr_lead, METAL_B, 8, 0.72, -0.2, 0.2, 0.2, glide_=True)
        S.seq("music", i_gtr_lead, [(s, dia(m, -2, HMINOR(4) if s >= 48 else MINOR(4)), ln) for s, m, ln in METAL_B], 8, 0.45, 0.35, 0.18, 0.1, glide_=True)
        riser_into_loop(S, 1, 0.35)
    else:
        S.seq("music", i_clean, [(s, m - 12, ln) for s, m, ln in METAL_HOOK], 4, 0.5, 0.15, 0.35, 0.2)


# ---------------------------------------------------------------- MOTO RUSH GP — HARDSTYLE (A minor, 150 bpm)
# A distorted pitch-tailed kick on every beat, reverse bass on the offbeats, claps, and a euphoric supersaw lead.
@lru_cache(maxsize=None)
def k_hardkick():
    n = ns(0.42); t = tt(n)
    f = 52 + 190 * np.exp(-t / 0.02) + 38 * np.exp(-t / 0.12)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y = np.tanh(5.5 * y) * np.exp(-t / 0.22)
    y[: ns(0.004)] += hp(nz(ns(0.004)), 2500) * 0.6
    return lp(y, 7000) * 0.9


HARD_HOOK = mel("a5 3 c6 3 e6 2 a6 4 g6 2 e6 2  f6 3 e6 3 c6 2 d6 4 e6 4  c6 3 b5 3 a5 2 e6 4 d6 2 c6 2  b5 6 g#5 2 b5 4 e6 4")


def st_hardstyle(S, act):
    kk = k_hardkick(); cl = k_clap(0.4, 0.12, 1000, 7500); oh = k_hat(True, 0.1); hh = k_hat(False, 0.02)
    PA = ["Am", "F", "C", "G"]; PB = ["Am", "F", "G", "E"]
    prog = PA * 2 + PB * 2 if act else PA * 2
    for bar, c in enumerate(prog):
        r = root(c, 33); B = act and bar >= 8; g = 1.0 if act else 0.55
        if act:
            if bar % 8 == 0: crash_at(S, bar, 0.55); S.put("fx", fx_boom(2.0, 80, 30), S.T(bar, 0), 0.45)
            build = bar in (7, 15)
            for s in range(16):
                if s % 4 == 0 and not (build and s >= 8): S.kick(kk, bar, s, 1.0)
                if s in (4, 12): S.put("drums", cl, S.T(bar, s), 0.7, 0, 0.2)
                if s % 4 == 2: S.put("drums", oh, S.T(bar, s), 0.4, 0.25, 0.05)
                if s % 2 == 1: S.put("drums", hh, S.T(bar, s), 0.22, -0.3)
                # reverse bass: distorted offbeat stabs between the kicks
                if s % 4 == 2 and not (build and s >= 8): S.put("bass", i_bass(r + 12, S.st * 1.6, 1500, 0.04, 0.3, 3.0), S.T(bar, s), 0.62)
            if build:
                for k2 in range(8): S.kick(kk, bar, 8 + k2, 0.4 + 0.07 * k2)
            pads(S, bar, c, 0.18, 57, 6000, 0.01, 0.2)
            if B: arp16(S, bar, c, 0.1, 69, every=1, bright=8000.0)
        else:
            for s in range(16):
                if s in (0, 8): S.kick(kk, bar, s, 0.45)
                if s in (4, 12): S.put("drums", cl, S.T(bar, s), 0.35, 0, 0.3)
            pads(S, bar, c, 0.26, 57, 2400, 0.2, 0.5)
            for m in vc(c, 57): S.put("music", i_epiano(m, S.st * 6, 0.8), S.T(bar, 0), 0.22, 0, 0.3)
    if act:
        for b0 in (8, 12):
            S.seq("music", i_ssaw, HARD_HOOK, b0, 0.32, 0, 0.22, 0.2, cut=8500.0, att=0.004, rel=0.12, voices=7, det=0.02)
            S.seq("music", i_ssaw, [(s, m - 12, ln) for s, m, ln in HARD_HOOK], b0, 0.2, 0, 0.2, 0.15, cut=6000.0, att=0.004, rel=0.12, voices=5, det=0.018)
        S.seq("music", i_pluck, HARD_HOOK, 0, 0.26, 0.1, 0.2, 0.25, wide=True, bright=7500.0, dark=800.0, tau=0.1, amp_tau=0.45)
        S.seq("music", i_pluck, HARD_HOOK, 4, 0.26, 0.1, 0.2, 0.25, wide=True, bright=7500.0, dark=800.0, tau=0.1, amp_tau=0.45)
        riser_into_loop(S, 1, 0.4)
    else:
        S.seq("music", i_pluck, HARD_HOOK, 4, 0.34, 0.1, 0.35, 0.3, wide=True, bright=4500.0, dark=600.0, tau=0.1, amp_tau=0.5)


style("metal", 168, 16, 120, 8, 1.1, 1.6, sc=(0.0, 0.0), bal_a=(0.5, 0.5, -1.5), bal_c=(-3.0, 0.0, -2.5))(st_metal)
style("hardstyle", 150, 16, 120, 8, 1.4, 2.0, sc=(0.55, 0.3), bal_a=(0.5, 0.0, -1.5), bal_c=(-3.5, 0.0, -2.0))(st_hardstyle)


# ================================================================ RACING SFX (files sfx_race_<name>.wav)
def smooth_noise(n, rate, r):
    """band-limited random curve (~rate Hz), values ~N(0,1)"""
    k = max(2, int(n / SR * rate) + 2); pts = r.standard_normal(k)
    return np.interp(np.linspace(0, k - 1, int(n)), np.arange(k), pts)


def squeal(d, f0=1050.0, drop=0.0, rough=0.35, seed="sq"):
    """tyre squeal: a stick-slip tone with chaotic pitch / level wander plus rubber hiss"""
    r = rng(seed); n = ns(d); t = tt(n); u = t / d
    f = f0 * (1 - drop * u) * (1 + 0.035 * smooth_noise(n, 9, r) + 0.012 * smooth_noise(n, 45, r))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.55 * np.sin(2 * ph + 0.3) + 0.25 * np.sin(3 * ph + 1.1) + 0.12 * np.sin(4.02 * ph)
    am = np.clip(0.75 + 0.25 * smooth_noise(n, 14, r), 0.2, 1.2)
    hiss = bp(nz(n), 1400, 6000) * (0.6 + 0.4 * np.abs(smooth_noise(n, 30, r)))
    return (tone * am * 0.6 + hiss * rough) * 0.8


def s_screech():
    d = 0.75; n = ns(d); t = tt(n)
    y = squeal(d, 1150, 0.12, 0.3, "screech") * np.minimum(1, t / 0.02) * np.exp(-np.maximum(0, t - 0.35) / 0.15)
    return fade(y, 0, 0.03)


def s_screech_long():
    d = 2.0; n = ns(d); t = tt(n)
    a = squeal(d, 1000, 0.3, 0.45, "screechL"); b = squeal(d, 1360, 0.25, 0.2, "screechL2")
    env = np.minimum(1, t / 0.04) * np.clip((d - t) / 0.6, 0, 1) ** 1.3 * (0.8 + 0.2 * np.sin(2 * np.pi * 2.2 * t))
    return fade((a + 0.5 * b) * env, 0, 0.05)


def s_blowoff():
    d = 0.75; n = ns(d); t = tt(n); r = rng("bov")
    hiss = sweep_filt(nz(n), "high", 1800, 4200) * np.exp(-t / 0.2) * np.minimum(1, t / 0.006)
    body = bp(nz(n), 600, 2400) * np.exp(-t / 0.08) * 0.5
    flutter = 1 - 0.55 * (np.sin(2 * np.pi * 26 * t) > 0) * np.clip((t - 0.12) / 0.05, 0, 1) * np.exp(-t / 0.4)
    return fade((hiss + body) * flutter, 0, 0.05)


def s_shift():
    d = 0.3; n = ns(d); t = tt(n)
    click = bp(nz(n), 1800, 7000) * np.exp(-t / 0.004) * 1.0
    clunk = np.sin(2 * np.pi * np.cumsum(140 + 90 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.03) * 0.6
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / k) * a for f, k, a in ((410, 0.03, 0.5), (980, 0.025, 0.45), (2350, 0.015, 0.3)))
    y = click + clunk + ring
    y[ns(0.045):] += (bp(nz(n), 1500, 5000) * np.exp(-t / 0.006) * 0.35)[: n - ns(0.045)]
    return fade(y, 0, 0.03)


def pop1(r, big=1.0):
    d = 0.16; n = ns(d); t = tt(n)
    bang = lp(nz(n), 2500 + 1500 * big) * np.exp(-t / (0.007 + 0.006 * big)) * np.minimum(1, t / 0.0006)
    thump = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t / 0.01)) / SR) * np.exp(-t / 0.03) * 0.8 * big
    return np.tanh(2.2 * (bang * 1.2 + thump)) * r.uniform(0.7, 1.0)


def s_backfire():
    r = rng("backfire"); y = np.zeros(ns(0.55))
    mix(y, pop1(r, 1.3), 0, 1.0)
    for o in (0.07, 0.11, 0.19):
        mix(y, pop1(r, 0.5), ns(o + r.uniform(-0.01, 0.01)), r.uniform(0.3, 0.6))
    for _ in range(14): mix(y, hp(nz(ns(0.003)), 2500) * r.uniform(0.1, 0.35), ns(r.uniform(0.02, 0.4)))
    return fade(y, 0, 0.05)


def s_crackle():
    r = rng("crackle"); y = np.zeros(ns(1.0)); t0 = 0.0
    while t0 < 0.8:
        mix(y, pop1(r, r.uniform(0.3, 0.9)), ns(t0), r.uniform(0.4, 1.0)); t0 += r.uniform(0.04, 0.13)
    return fade(y, 0, 0.05)


def metal_hits(r, n_hits, d, f_lo=300, f_hi=4500):
    y = np.zeros(ns(d))
    for _ in range(n_hits):
        o = ns(r.uniform(0, d * 0.25)); dd = r.uniform(0.15, 0.6); tn = tt(ns(dd))
        f = r.uniform(f_lo, f_hi)
        part = sum(np.sin(2 * np.pi * f * k * tn + r.random() * 6) / k for k in (1, 2.31, 3.87)) * np.exp(-tn / r.uniform(0.04, 0.2))
        mix(y, part * r.uniform(0.2, 0.6), o)
    return y


def s_crash():
    r = rng("crash"); d = 1.8; n = ns(d); t = tt(n); out = []
    thump = np.sin(2 * np.pi * np.cumsum(48 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.12) * 1.2
    for c in range(2):
        crunch = bp(nz(n), 400, 5000) * np.exp(-t / 0.09) * (0.6 + 0.4 * np.abs(smooth_noise(n, 80, r))) * 1.2
        metal = metal_hits(r, 9, d)
        debris = np.zeros(n)
        for _ in range(40): mix(debris, hp(nz(ns(0.004)), 3500) * r.uniform(0.05, 0.3), ns(abs(r.normal(0.25, 0.25))))
        glass = np.zeros(n)
        for _ in range(16): mix(glass, A._bell(r.uniform(3000, 7000), 0.12) * r.uniform(0.04, 0.12), ns(r.uniform(0.05, 0.6)))
        out.append(np.tanh(1.5 * (thump + crunch + metal * 0.8)) + debris + glass)
    return fade(np.array(out), 0, 0.15)


def s_crunch():
    r = rng("crunch2"); d = 0.7; n = ns(d); t = tt(n)
    thump = np.sin(2 * np.pi * np.cumsum(60 + 110 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07)
    crunch = bp(nz(n), 600, 5000) * np.exp(-t / 0.05) * (0.5 + 0.5 * np.abs(smooth_noise(n, 120, r)))
    y = np.tanh(1.6 * (thump + crunch * 1.1 + metal_hits(r, 5, d, 400, 3500) * 0.7))
    return fade(y, 0, 0.06)


def s_scrape():
    r = rng("scrape"); d = 0.9; n = ns(d); t = tt(n)
    grind = bp(nz(n), 1200, 7000) * (0.4 + 0.6 * np.abs(smooth_noise(n, 160, r)))
    squeal_ = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.02 * smooth_noise(n, 12, r))) / SR) * a for f, a in ((2150, 0.25), (3420, 0.15), (5050, 0.08)))
    sparks = np.zeros(n)
    for _ in range(30): mix(sparks, hp(nz(ns(0.003)), 4000) * r.uniform(0.1, 0.4), ns(r.uniform(0, d - 0.01)))
    env = np.minimum(1, t / 0.01) * np.clip((d - t) / 0.3, 0, 1)
    return fade((grind * 0.8 + squeal_ + sparks) * env, 0, 0.03)


def s_nitro():
    d = 1.6; n = ns(d); t = tt(n); u = t / d; out = []
    for c in range(2):
        ign = lp(nz(n), 900) * np.exp(-t / 0.05) * 1.4
        flame = sweep_filt(nz(n), "low", 400, 5200, curve=0.5) * np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.7) / 0.35)
        hiss = hp(nz(n), 4000) * np.exp(-t / 0.4) * 0.35
        out.append(ign + flame + hiss)
    jet = saw_b(260 * 2 ** (1.8 * np.minimum(1, u * 1.6)), n) + saw_b(263 * 2 ** (1.8 * np.minimum(1, u * 1.6)), n, 0.4)
    jet = bp(jet, 400, 4000) * 0.22 * np.minimum(1, t / 0.08) * np.exp(-np.maximum(0, t - 0.6) / 0.3)
    thump = np.sin(2 * np.pi * np.cumsum(50 + 80 * np.exp(-t / 0.04)) / SR) * np.exp(-t / 0.12) * 0.8
    return fade(np.array(out) * 0.7 + jet + thump, 0, 0.1)


def s_shockwave():
    d = 2.2; n = ns(d); t = tt(n); out = []
    boom = np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(28 + 70 * np.exp(-t / 0.18)) / SR)) * np.exp(-t / 0.5) * 0.3
    whump = np.tanh(3.0 * np.sin(2 * np.pi * np.cumsum(85 + 170 * np.exp(-t / 0.05)) / SR)) * np.exp(-t / 0.22) * 0.6
    for c in range(2):
        blast = sweep_filt(nz(n), "low", 7000, 160, curve=0.45) * np.exp(-t / 0.35) * 1.1
        air = bp(nz(n), 250, 2500) * np.exp(-t / 0.1) * 0.9
        out.append(blast + air)
    return fade(np.array(out) + boom + whump, 0.001, 0.15)


def s_beep():
    d = 0.32; n = ns(d); t = tt(n); f = 880.0
    y = np.sin(2 * np.pi * f * t) * 0.7 + lp(pulse_b(f, n, 0.5), 3500) * 0.35 + np.sin(4 * np.pi * f * t) * 0.08
    return y * env_note(n, 0.24, 0.006, None, 1, 0.07)


def s_beep_go():
    d = 1.0; n = ns(d); t = tt(n); f = 1760.0
    y = np.sin(2 * np.pi * f * t) * 0.65 + lp(pulse_b(f, n, 0.5), 5000) * 0.3 + np.sin(np.pi * f * t) * 0.25
    return y * env_note(n, 0.72, 0.006, 0.5, 0.75, 0.25)


def crowd(d, seed="crowd", n_voices=36, excite=1.0):
    """stadium crowd: formant-filtered voiced noise with syllabic modulation, spread in stereo"""
    r = rng(seed); n = ns(d); t = tt(n); L = np.zeros(n); R = np.zeros(n)
    vows = [(700, 1200), (500, 1700), (400, 2300), (600, 1000), (750, 1400)]
    src = nz(n)
    for v in range(n_voices):
        f1, f2 = vows[v % len(vows)]; f1 *= r.uniform(0.85, 1.2); f2 *= r.uniform(0.85, 1.15)
        f0 = r.uniform(180, 420) * (1 + 0.15 * excite * np.clip(t / 0.4, 0, 1))
        buzz = saw_b(f0 * (1 + 0.04 * smooth_noise(n, 3, r)), n, r.random()) * 0.6 + np.roll(src, v * 997) * 0.6
        voice = bp(buzz, f1 * 0.75, f1 * 1.3) + 0.5 * bp(buzz, f2 * 0.85, f2 * 1.2)
        am = np.clip(0.5 + 0.6 * smooth_noise(n, r.uniform(3, 6), r), 0, 1.4)
        p = r.uniform(-1, 1); voice *= am
        L += voice * (1 - p) * 0.5; R += voice * (1 + p) * 0.5
    hiss = bp(nz(n), 1500, 6000) * 0.25
    return np.stack([L + hiss, R + np.roll(hiss, 1234)]) / np.sqrt(n_voices)


def claps(d, seed="claps", rate=40.0):
    r = rng(seed); n = ns(d); out = np.zeros((2, n)); c = k_clap(0.12, 0.03, 1200, 6000)
    for _ in range(int(rate * d)):
        o = ns(r.uniform(0, d - 0.12)); p = r.uniform(-1, 1); g = r.uniform(0.1, 0.35)
        k = min(len(c), n - o); out[0, o:o + k] += c[:k] * g * (1 - p) / 2; out[1, o:o + k] += c[:k] * g * (1 + p) / 2
    return out


def whistle(r, d=0.6):
    n = ns(d); t = tt(n); f = r.uniform(2200, 3000) * (1 + 0.25 * np.sin(np.pi * t / d) * r.choice([-1, 1]))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 0.5 * 0.25


def s_crowd():
    d = 3.2; n = ns(d); t = tt(n)
    y = crowd(d) * 1.6 + claps(d) * 0.9
    r = rng("whist")
    for o in (0.4, 1.1, 1.9):
        w = whistle(r); k = ns(o); y[:, k:k + len(w)] += np.stack([w * 0.7, w * 0.4])[:, : n - k]
    env = np.minimum(1, t / 0.35) * np.clip((d - t) / 1.2, 0, 1) ** 1.2
    return fade(y * env, 0, 0.1)


def horn_tone(f, d, formant=(900, 2400), drive=3.0, vibd=0.0):
    n = ns(d); t = tt(n)
    fv = f * (1 + vibd * np.sin(2 * np.pi * 7 * t)) * (1 - 0.03 * np.exp(-t / 0.03))
    x = saw_b(fv, n) + pulse_b(fv * 1.002, n, 0.4) * 0.6
    y = bp(x, formant[0] * 0.6, formant[0] * 1.4) + 0.6 * bp(x, formant[1] * 0.8, formant[1] * 1.25)
    return np.tanh(drive * y) * env_note(n, d - 0.04, 0.015, None, 1, 0.04)


def s_airhorn():
    y = np.zeros(ns(1.6))
    for o, dd in ((0.0, 0.18), (0.24, 0.18), (0.48, 1.0)):
        b = horn_tone(466.2, dd, (1100, 2600), 3.5) + horn_tone(587.3, dd, (1100, 2600), 3.5) * 0.8 + horn_tone(233.1, dd, (700, 1800), 2.0) * 0.4
        mix(y, b, ns(o))
    return fade(y * 0.6, 0, 0.05)


def s_finish():
    d = 3.6; n = ns(d); y = s_crowd(); out = np.zeros((2, n))
    out[:, : y.shape[1]] += y[:, :n]
    h = s_airhorn(); o = ns(0.05); out[:, o:o + len(h)] += np.stack([h, h * 0.9])[:, : n - o] * 0.9
    c = k_crash(2.4, 0.9); out[:, : c.shape[1]] += c * 0.7
    return fade(out, 0, 0.1)


def s_checkpoint():
    y = np.zeros(ns(1.1))
    for i, (m, g) in enumerate(((88, 0.7), (95, 0.8), (100, 0.45))):
        mix(y, i_bell(m, 0.5, 2.0, 1.2) * g, ns(i * 0.075)); mix(y, A._bell(midi(m), 0.6) * 0.3 * g, ns(i * 0.075))
    t = tt(len(y)); y += hp(nz(len(y)), 6000) * np.exp(-t / 0.25) * 0.05
    return fade(y, 0, 0.05)


def s_coin():
    y = np.zeros(ns(0.6))
    for i, (m, g) in enumerate(((83, 0.6), (88, 0.9))):
        n = ns(0.45); t = tt(n); f = midi(m)
        tone = (pulse_b(f, n, 0.5) * 0.3 + np.sin(2 * np.pi * f * t) * 0.6 + np.sin(2 * np.pi * f * 3.01 * t) * 0.15) * np.exp(-t / (0.06 if i == 0 else 0.18))
        mix(y, lp(tone, 7000) * g, ns(i * 0.065))
    r = rng("coin")
    for k in range(6): mix(y, A._bell(r.uniform(4000, 8000), 0.2) * 0.06, ns(0.08 + k * 0.035))
    return fade(y, 0, 0.04)


def s_nearmiss():
    d = 0.8; n = ns(d); t = tt(n); u = t / d
    env = np.exp(-((u - 0.42) / 0.16) ** 2)
    x = sweep_filt(nz(n), "low", 6500, 700, curve=0.8) * env
    tone = np.sin(2 * np.pi * np.cumsum(520 * (1.18 - 0.36 * (u > 0.42) - 0.1 * u)) / SR) * env * 0.15
    pan = np.clip((u - 0.2) * 2.2 - 1, -1, 1)
    l, rr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    y = x + tone
    return fade(np.stack([y * l, y * rr]) * 1.3, 0.01, 0.05)


def s_explosion():
    r = rng("boom"); d = 2.8; n = ns(d); t = tt(n); out = []
    boom = np.tanh(2.0 * np.sin(2 * np.pi * np.cumsum(30 + 80 * np.exp(-t / 0.08)) / SR)) * np.exp(-t / 0.45) * 0.5
    boom = boom + np.tanh(3.0 * np.sin(2 * np.pi * np.cumsum(90 + 150 * np.exp(-t / 0.04)) / SR)) * np.exp(-t / 0.2) * 0.4
    for c in range(2):
        blast = lp(nz(n), 3200) * np.exp(-t / 0.12) * 1.6 + bp(nz(n), 150, 1200) * np.exp(-t / 0.5) * 1.0
        crackles = np.zeros(n)
        for _ in range(45): mix(crackles, pop1(r, r.uniform(0.15, 0.5)), ns(abs(r.normal(0.5, 0.45))), r.uniform(0.05, 0.25))
        out.append(np.tanh(1.4 * (blast + boom)) + crackles + metal_hits(r, 4, d, 300, 2000) * 0.25)
    return fade(np.array(out), 0.0005, 0.3)


def s_horn():
    d = 0.6
    y = horn_tone(415, d, (1500, 3000), 4.0) + horn_tone(523, d, (1500, 3000), 4.0) * 0.85
    return fade(hp(y, 250) * 0.6, 0, 0.03)


def s_land():
    r = rng("land"); d = 0.55; n = ns(d); t = tt(n)
    thump = np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(75 + 110 * np.exp(-t / 0.03)) / SR)) * np.exp(-t / 0.08) * 0.9
    rattle = bp(nz(n), 300, 4000) * np.exp(-t / 0.05) * 0.8 + metal_hits(r, 4, d, 500, 2500) * 0.45
    squeak = np.sin(2 * np.pi * np.cumsum(np.full(n, 900.0) * (1 + 0.1 * smooth_noise(n, 20, r))) / SR) * np.exp(-np.maximum(0, t - 0.06) / 0.05) * (t > 0.06) * 0.08
    return fade(np.tanh(1.5 * (thump + rattle)) + squeak, 0, 0.04)


def s_jump():
    d = 0.7; n = ns(d); t = tt(n); u = t / d
    w = sweep_filt(nz(n), "low", 500, 6000, curve=0.7) * np.sin(np.pi * u) ** 1.2
    rev = saw_b(120 * 2 ** (1.3 * u), n) * np.sin(np.pi * u) * 0.12
    return fade(w + lp(rev, 2500), 0.005, 0.05)


def s_pickup():
    d = 0.7; n = ns(d); t = tt(n)
    zap = np.sin(2 * np.pi * np.cumsum(500 * 2 ** (2.5 * np.minimum(1, t / 0.18))) / SR) * np.exp(-t / 0.15) * 0.4
    gas = hp(nz(n), 3000) * np.exp(-t / 0.12) * 0.35
    y = zap + gas
    for i, m in enumerate((76, 83, 88)): mix(y, i_bell(m, 0.3, 2.0, 0.9) * 0.5, ns(0.05 + i * 0.05))
    return fade(y, 0, 0.05)


def s_shield():
    d = 1.1; n = ns(d); t = tt(n); y = np.zeros(n)
    for k, f in enumerate((660, 990, 1320, 1980)):
        y += np.sin(2 * np.pi * f * t * (1 + 0.004 * np.sin(2 * np.pi * (5 + k) * t)) + 2 * np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t / 0.2)) * 0.2
    y *= np.minimum(1, t / 0.08) * np.exp(-t / 0.35)
    y += sweep_filt(nz(n), "high", 600, 6000) * np.sin(np.pi * np.minimum(1, t / 0.6)) * 0.1
    return fade(y, 0, 0.05)


def s_magnet():
    d = 1.0; n = ns(d); t = tt(n)
    hum = saw_b(110 * (1 + 0.03 * np.sin(2 * np.pi * 9 * t)), n) + saw_b(111, n, 0.3)
    wah = 0.5 + 0.5 * np.sin(2 * np.pi * 7 * t)
    y = (bp(hum, 300, 900) + (bp(hum, 900, 2600) - bp(hum, 300, 900)) * wah) * np.minimum(1, t / 0.05) * np.exp(-t / 0.4)
    for i, m in enumerate((84, 88, 91, 96)): mix(y, A._bell(midi(m), 0.4) * 0.12, ns(0.2 + i * 0.06))
    return fade(y, 0, 0.05)


def s_lap():
    y = np.zeros(ns(1.2))
    for i, m in enumerate((79, 84, 91)):
        mix(y, i_bell(m, 0.5, 2.0, 1.0) * 0.8, ns(i * 0.09)); mix(y, i_pluck(m, 0.3, 8000.0, 2000.0, 0.1, 0.4, False) * 0.4, ns(i * 0.09))
    return fade(y, 0, 0.05)


def s_final_lap():
    y = np.zeros(ns(1.8))
    for i, m in enumerate((67, 72, 76)): mix(y, i_brass(m, 0.14, True, 3600.0) * 1.2, ns(i * 0.11))
    for m in (67, 72, 76, 79): mix(y, i_brass(m, 0.9, False, 3600.0) * 0.8, ns(0.33))
    mix(y, k_crash(1.4, 0.5).mean(axis=0) * 0.5, ns(0.33))
    for i, m in enumerate((84, 88, 91, 96)): mix(y, A._bell(midi(m), 0.5) * 0.12, ns(0.36 + i * 0.05))
    return fade(y, 0, 0.1)


def s_win():
    d = 2.8; n = ns(d); out = np.zeros((2, n))
    seq = [((60, 64, 67), 0.0, 0.16), ((60, 64, 67), 0.18, 0.12), ((65, 69, 72), 0.33, 0.3), ((67, 71, 74), 0.66, 0.3), ((72, 76, 79, 84), 1.0, 1.5)]
    for notes, o, dd in seq:
        for j, m in enumerate(notes):
            x = i_brass(m, dd, dd < 0.2, 3800.0); p = (j - 1) * 0.35; k = ns(o)
            out[0, k:k + len(x)] += x[: n - k] * (1 - p) * 0.6; out[1, k:k + len(x)] += x[: n - k] * (1 + p) * 0.6
    for o in (0.0, 0.33, 0.66, 1.0):
        tp = k_timp(36 if o < 0.9 else 48, 1.2); k = ns(o); out[:, k:k + len(tp)] += tp[: n - k] * 0.5
    c = k_crash(1.8, 0.8); k = ns(1.0); out[:, k:k + c.shape[1]] += c[:, : n - k] * 0.6
    return fade(out, 0, 0.2)


def s_lose():
    y = np.zeros(ns(1.8))
    for i, m in enumerate((67, 63, 60)): mix(y, i_lead(m, 0.32 if i < 2 else 0.9, None, 2400.0, 0.004, 0.0) * 0.9, ns(i * 0.34))
    for m in (48, 51, 55): mix(y, i_strings(m, 1.0, 0.1) * 0.9, ns(0.68))
    return fade(y, 0, 0.2)


def s_fire():
    d = 1.3; n = ns(d); t = tt(n); r = rng("fire")
    whoomp = sweep_filt(nz(n), "low", 300, 3000, curve=0.4) * np.minimum(1, t / 0.03) * np.exp(-t / 0.4)
    roar = lp(nz(n), 500) * np.exp(-t / 0.5) * 0.8
    y = np.tanh(1.5 * (whoomp + roar))
    for _ in range(30): mix(y, pop1(r, r.uniform(0.1, 0.3)), ns(r.uniform(0.05, 1.1)), r.uniform(0.05, 0.2))
    return fade(y, 0.002, 0.1)


def s_eliminated():
    y = np.zeros(ns(1.4))
    for i, f in enumerate((660, 520, 392)):
        n = ns(0.24); t = tt(n); x = lp(pulse_b(f, n, 0.5) + pulse_b(f * 1.006, n, 0.5), 3000) * env_note(n, 0.2, 0.004, None, 1, 0.03)
        mix(y, x * 0.5, ns(i * 0.26))
    mix(y, fx_boom(0.9, 110, 55) * 0.5, ns(0.78))
    return fade(y, 0, 0.05)


def s_perfect():
    y = np.zeros(ns(1.3))
    for i, m in enumerate((79, 83, 86, 91, 95)): mix(y, i_bell(m, 0.4, 2.0, 1.0) * 0.5, ns(i * 0.05))
    n = len(y); t = tt(n); y += sweep_filt(nz(n), "low", 800, 9000, curve=0.6) * np.sin(np.pi * np.minimum(1, t / 0.6)) * 0.12
    return fade(y, 0, 0.1)


def s_takedown():
    a = s_crash(); b = s_shockwave(); n = max(a.shape[1], b.shape[1]); y = np.zeros((2, n))
    y[:, : a.shape[1]] += a; y[:, : b.shape[1]] += b * 0.8
    return y


def s_go():
    """the big GO stinger (layered under the GO beep): impact, crash, whoosh and a crowd roar"""
    d = 2.6; n = ns(d); out = np.zeros((2, n))
    out[:, : ns(1.8)] += np.stack([fx_boom(1.8, 90, 32)] * 2) * 0.45
    c = k_crash(2.4, 0.8); out[:, : c.shape[1]] += c[:, :n] * 0.6
    w = s_nitro(); out[:, : w.shape[1]] += w[:, :n] * 0.5
    cr = crowd(2.4, "gocrowd", 28, 1.3) * 1.4; t = tt(cr.shape[1])
    cr *= np.minimum(1, t / 0.2) * np.clip((2.4 - t) / 1.0, 0, 1); out[:, : cr.shape[1]] += cr
    for m in (62, 69, 74):
        x = i_brass(m, 0.5, True, 4200.0); out[:, : len(x)] += np.stack([x, x]) * 0.5
    return fade(out, 0, 0.2)


# ---------------------------------------------------------------- Highway Heat SFX
def s_siren():
    """one US 'wail' cycle (1.3 s) that repeats seamlessly: low → high → low"""
    d = 1.3; n = ns(d); t = tt(n)
    f = 640 + 720 * np.sin(np.pi * t / d) ** 2
    y = 0.7 * saw_b(f, n) + 0.5 * pulse_b(f * 1.003, n, 0.5)
    y = bp(y, 400, 5200) + 0.25 * lp(y, 900)
    y = np.tanh(1.6 * y) * (0.85 + 0.15 * np.sin(2 * np.pi * 7 * t))
    return fade(y * 0.6, 0.02, 0.02)


def s_yelp():
    """quick police 'whoop' for confirm buttons"""
    d = 0.42; n = ns(d); t = tt(n)
    f = 560 + 1100 * np.minimum(1, t / 0.28) ** 0.7
    y = np.tanh(1.8 * (0.7 * saw_b(f, n) + 0.4 * pulse_b(f * 1.004, n, 0.5)))
    y = bp(y, 450, 6000) * np.minimum(1, t / 0.01) * np.clip((d - t) / 0.12, 0, 1)
    return fade(y * 0.55, 0.003, 0.03)


def s_radio():
    """police radio squelch: click, a burst of filtered static and a short tail"""
    d = 0.32; n = ns(d); t = tt(n); r = rng("radio")
    y = bp(nz(n), 1100, 3400) * (np.exp(-t / 0.05) * 0.9 + 0.25 * (t < 0.22)) * np.clip((0.3 - t) / 0.05, 0, 1)
    y[: ns(0.004)] += np.linspace(1, 0, ns(0.004)) * 0.9
    tone = np.sin(2 * np.pi * 1250 * t) * (t > 0.2) * np.exp(-(t - 0.2) / 0.04) * 0.4
    return fade(np.tanh(2.2 * (y + tone)) * 0.6, 0.0, 0.02)


def s_rev():
    """motorcycle rev blip: the engine note jumps up and falls back, with a couple of exhaust pops"""
    d = 0.9; n = ns(d); t = tt(n); r = rng("rev")
    f = 48 + 150 * np.exp(-((t - 0.16) / 0.11) ** 2) * (t > 0.02) + 60 * np.clip((0.16 - t) / 0.16, 0, 1) * (t < 0.16) * 0
    f = 48 + 170 * np.where(t < 0.14, t / 0.14, np.exp(-(t - 0.14) / 0.2))
    y = 0.6 * saw_b(f * 2, n) + 0.5 * pulse_b(f * 4, n, 0.3) + 0.3 * saw_b(f * 8.02, n)
    y = np.tanh(2.6 * lp(y, 3200)) * np.clip(t / 0.01, 0, 1) * np.clip((d - t) / 0.25, 0, 1)
    for _ in range(3): mix(y, pop1(r, r.uniform(0.25, 0.5)), ns(r.uniform(0.35, 0.75)), r.uniform(0.15, 0.3))
    return fade(y * 0.7, 0.002, 0.05)


RACE_SFX = {
    "screech": s_screech, "screechLong": s_screech_long, "blowoff": s_blowoff, "shift": s_shift, "backfire": s_backfire,
    "crackle": s_crackle, "crash": s_crash, "crunch": s_crunch, "scrape": s_scrape, "nitro": s_nitro, "shockwave": s_shockwave,
    "beep": s_beep, "beepGo": s_beep_go, "go": s_go, "crowd": s_crowd, "airhorn": s_airhorn, "finish": s_finish,
    "checkpoint": s_checkpoint, "coin": s_coin, "nearMiss": s_nearmiss, "explosion": s_explosion, "horn": s_horn,
    "land": s_land, "jump": s_jump, "pickup": s_pickup, "shield": s_shield, "magnet": s_magnet, "lap": s_lap,
    "finalLap": s_final_lap, "win": s_win, "lose": s_lose, "fire": s_fire, "eliminated": s_eliminated,
    "perfect": s_perfect, "takedown": s_takedown, "siren": s_siren, "yelp": s_yelp, "radio": s_radio, "rev": s_rev,
}


def run_sfx():
    for name, fn in RACE_SFX.items():
        if ONLY and not ({name, "sfx", f"race_{name}"} & ONLY): continue
        y = np.asarray(fn(), dtype=float)
        y = y / (np.max(np.abs(y)) + 1e-9) * 0.9
        x = np.atleast_2d(y); blk = ns(0.4); hop = ns(0.05); best = -70.0
        if x.shape[1] < blk: x = np.concatenate([x, np.zeros((x.shape[0], blk - x.shape[1]))], axis=1)
        for o in range(0, max(1, x.shape[1] - blk + 1), hop): best = max(best, lufs(x[:, o:o + blk], False))
        write_wav("sfx_race_" + name, y)
        META["sfx"][name] = {"dur": round(np.atleast_2d(y).shape[1] / SR, 3), "ch": x.shape[0], "lufs_m": round(best, 1)}
        print("sfx", name, META["sfx"][name], flush=True)


# ================================================================ driver
def want(name): return not ONLY or name in ONLY or name.split("_")[0] in ONLY


def run_music():
    for key, spec in STYLES.items():
        for v, act in (("calm", False), ("action", True)):
            if ONLY and not ({key, f"{key}_{v}", "music"} & ONLY): continue
            bpm, bars, rt, sc, sw, dl, bal = spec["a" if act else "c"]
            S = Song(f"race_{key}_{v}", bpm, bars, rt, sw)
            spec["fn"](S, act)
            S.render(-14.0 if act else -15.5, sc, None, 0.55, dl, tag=v, bal=bal)


if __name__ == "__main__":
    import time
    t0 = time.time()
    run_music()
    run_sfx()
    mf = os.path.join(OUT, "manifest_race.json")
    man = json.load(open(mf)) if os.path.exists(mf) else {}
    for k in ("music", "sfx"): man.setdefault(k, {}).update(META[k])
    with open(mf, "w") as fh: json.dump(man, fh, indent=1)
    print("done in %.1fs" % (time.time() - t0))
