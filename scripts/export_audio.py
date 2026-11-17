"""Export the original Track Momo SFX + music (momo/tools/audio.py) as web audio files.

usage: python scripts/export_audio.py <path-to-momo/tools> <out-dir>
Writes WAV files; encode them with ffmpeg afterwards (see package.json "audio" script).
Music loops are written as LOOP + TAIL seconds; the web player restarts each loop every
LOOP seconds and lets the tail overlap, so loops are seamless even with MP3 priming.
"""
import json
import os
import sys
import wave

import numpy as np

sys.path.insert(0, sys.argv[1])
import audio as A  # noqa: E402

OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
SR = A.SR


def write(name, y, stereo=False, peak=0.89):
    y = np.asarray(y, dtype=np.float64)
    if y.ndim == 1:
        y = np.stack([y, y]) if stereo else y[None, :]
    m = np.max(np.abs(y)) + 1e-9
    y = y / m * peak
    pcm = (y.T * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(pcm.shape[1]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- SFX (mono)
SFX = {
    "pop": lambda: A.sfx_pop(), "popBig": lambda: A.sfx_popBig(), "boing": lambda: A.sfx_boing(), "hop": A.sfx_hop,
    "squish": A.sfx_squish, "thud": A.sfx_thud, "lift": A.sfx_lift, "whoosh": lambda: A.sfx_whoosh(0.5),
    "whooshShort": lambda: A.sfx_whoosh(0.3), "whooshLong": lambda: A.sfx_whoosh(0.8), "swoosh": A.sfx_swoosh,
    "slide": lambda: A.sfx_slide(0.12), "clack": A.sfx_clack, "tick": A.sfx_tick, "tock": A.sfx_tock,
    "drumroll": lambda: A.sfx_drumroll(1.0), "impact": A.sfx_impact, "tada": A.sfx_tada, "sparkle": A.sfx_sparkle,
    "confetti": A.sfx_confetti, "sadtrombone": A.sfx_sadtrombone, "snicker": A.sfx_snicker, "sting": A.sfx_sting,
    "gibberK": lambda: A.sfx_gibberK(1.4), "gibberKShort": lambda: A.sfx_gibberK(0.7), "gibberT": lambda: A.sfx_gibberT(1.2),
    "hmm": A.sfx_hmm, "rewind": A.sfx_rewind, "lightsOff": A.sfx_lightsOff, "lightsOn": A.sfx_lightsOn,
}
# relative loudness from the video mixer (cue gains), so the web mix sounds the same
GAIN = {}
for name, fn in SFX.items():
    y = fn()
    write("sfx_" + name, y, peak=0.9)
    GAIN[name] = 1.0


# ---------------------------------------------------------------- MUSIC loops (stereo)
def bpm_of(kind, inten):
    return {"playful": 112, "shuffle": 128 + 34 * inten, "tension": 90, "celebrate": 124, "think": 104, "replay": 92}[kind]


LOOPS = [
    ("playful", 0.5, 8), ("think", 0.4, 8), ("shuffle_easy", 0.0, 8), ("shuffle_medium", 0.5, 8),
    ("shuffle_hard", 1.0, 8), ("tension", 0.5, 4), ("celebrate", 0.5, 4), ("replay", 0.5, 8),
]
TAIL = 1.5
meta = {}
for name, inten, bars in LOOPS:
    kind = name.split("_")[0]
    loop = bars * 4 * 60 / bpm_of(kind, inten)
    buf = A.section(kind, loop + TAIL, inten, 4242 + len(meta), 0.0)
    f = min(int(0.03 * SR), buf.shape[1] // 2)  # undo the section's 30 ms fade-in
    ramp = np.linspace(0, 1, f); ramp[0] = 1
    buf[:, :f] /= ramp[None, :]
    buf[:, 0] = 0
    write("music_" + name, buf * 0.55, peak=0.62)
    meta[name] = {"loop": round(loop, 6), "tail": TAIL, "bpm": bpm_of(kind, inten)}

with open(os.path.join(OUT, "manifest.json"), "w") as fh:
    json.dump({"sfx": sorted(SFX), "music": meta}, fh, indent=1)
print("exported", len(SFX), "sfx and", len(meta), "music loops to", OUT)
