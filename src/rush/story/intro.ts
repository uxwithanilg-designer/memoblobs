// The opening cinematic (about 41 s): Rollo and his little brother Chintu toss a glowing pearl on the beach under the
// moon; the wind turns; Mayamma the Sky Witch bursts out of the moon, snatches Chintu, taunts Rollo and flies off with
// him; "Run, Rollo! Run!" — and the camera swings in behind Rollo as the run begins. Everything here is a pure function
// of time: where each actor is (in track space: s along, u across, h up), how they move, where the camera is and what
// it looks at, plus the voice / sound / music cues the session fires as their moment passes.
export type V3 = [number, number, number];
export interface ActorFrame { s: number; u: number; h: number; face: 1 | -1 }
export interface StoryFrame {
  /** the camera: position and target in track space, a Dutch roll (radians) and the lens */
  cam: { pos: V3; look: V3; roll: number; fov: number };
  rollo: ActorFrame & { reach: number; toss?: number; run: number };
  chintu: (ActorFrame & { toss?: number; carried: boolean }) | null;
  witch: { s: number; u: number; h: number; cast: number; laugh: boolean; lean: number; carry: boolean } | null;
  ball: V3 | null;
  /** white flash 0..1, how dark the night is 0..1, letterbox bars 0..1 */
  flash: number; dim: number; bars: number;
}
export type Cue =
  | { t: number; voice: string }
  | { t: number; sfx: "sting" | "thunder" | "whoosh" | "whooshLong" | "wail" | "wind" }
  | { t: number; music: "lullaby" | "witch" | "stage" | "fade" }
  | { t: number; title: true };

export const INTRO_LEN = 41.6;
/** Rollo stands here while they play (he runs off from here when the game starts) */
export const ROLLO_S = 8;
const CHINTU_S = 16.5;

export const CUES: Cue[] = [
  { t: 0, music: "lullaby" },
  { t: 0.4, voice: "n1" },
  { t: 5.0, voice: "n2" },
  { t: 9.7, voice: "c1" },
  { t: 12.4, music: "fade" },
  { t: 12.5, sfx: "wind" },
  { t: 12.6, voice: "n3" },
  { t: 14.0, sfx: "wail" },
  { t: 16.7, sfx: "sting" },
  { t: 16.7, sfx: "thunder" },
  { t: 16.75, music: "witch" },
  { t: 16.9, voice: "l4" },
  { t: 19.0, sfx: "whooshLong" },
  { t: 21.4, sfx: "whoosh" },
  { t: 22.4, voice: "c2" },
  { t: 24.8, voice: "r2" },
  { t: 27.2, voice: "w2" },
  { t: 33.4, voice: "w3" },
  { t: 35.2, sfx: "whooshLong" },
  { t: 39.2, voice: "n4" },
  { t: 39.6, title: true },
  { t: 40.4, music: "stage" },
];

const ss = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
const mix = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const bez = (a: V3, b: V3, c: V3, k: number): V3 => mix(mix(a, b, k), mix(b, c, k), k);
const seg = (t: number, t0: number, t1: number) => (t - t0) / (t1 - t0);

/** where the witch is (track space) at time t, or null before she appears */
function witchAt(t: number): StoryFrame["witch"] {
  if (t < 16.7) return null;
  const hover: V3 = [CHINTU_S + 1.5, 0, 4.4];
  let p: V3, cast = 0, laugh = false, lean = 0.1, carry = false;
  if (t < 21.4) { // out of the moon, down in a great swoop
    const k = ss(seg(t, 16.7, 21.4));
    p = bez([95, -14, 42], [48, 16, 18], hover, k); lean = 0.5 - k * 0.3; laugh = t < 21;
  } else if (t < 24.7) { // down to grab him
    const k = ss(seg(t, 21.4, 22.6)), k2 = ss(seg(t, 23.2, 24.7));
    p = mix(hover, [CHINTU_S + 0.6, 0, 2.3], k); p = mix(p, hover, k2); cast = k * (1 - k2); carry = t > 22.6;
  } else if (t < 35.2) { // hovering, talking down at Rollo
    p = [hover[0] + Math.sin(t * 0.7) * 0.4, Math.sin(t * 0.5) * 0.6, hover[2] + Math.sin(t * 1.1) * 0.25]; carry = true; laugh = t > 32.9 && t < 33.4;
  } else { // away over the sea toward the far end of the world
    const k = ss(seg(t, 35.2, 41.6));
    p = bez([hover[0], 0, hover[2]], [40, 6, 10], [150, 12, 40], k); lean = 0.25 + k * 0.4; carry = true; laugh = t > 37.5;
  }
  return { s: p[0], u: p[1], h: p[2], cast, laugh, lean, carry };
}

export function storyAt(t: number): StoryFrame {
  const W = witchAt(t);
  // ---- the two brothers and their glowing pearl
  const period = 2.6, ph = t < 16.7 ? (t % period) / period : -1;
  let ball: V3 | null = null, tossR: number | undefined, tossC: number | undefined;
  if (ph >= 0) {
    if (ph < 0.5) { const k = ph / 0.5; ball = [CHINTU_S - 0.5 - (CHINTU_S - ROLLO_S - 1) * k, 0.1, 1.3 + Math.sin(k * Math.PI) * 2.6]; tossC = Math.min(1, ph / 0.12); }
    else { const k = (ph - 0.5) / 0.5; ball = [ROLLO_S + 0.5 + (CHINTU_S - ROLLO_S - 1) * k, -0.1, 1.3 + Math.sin(k * Math.PI) * 2.6]; tossR = Math.min(1, (ph - 0.5) / 0.12); }
  }
  const run = t > 39.2 ? Math.min(1, (t - 39.2) / 1.6) : 0;
  const rolloS = ROLLO_S + (t > 39.2 ? 0.5 * 9 * Math.pow(t - 39.2, 2) * 0.6 : 0);
  const reach = t > 22.4 && t < 39.2 ? Math.min(1, (t - 22.4) / 0.4) * (0.75 + Math.sin(t * 3) * 0.1) : 0;
  const rollo = { s: rolloS, u: 0, h: 0, face: 1 as const, reach, toss: tossR, run };
  let chintu: StoryFrame["chintu"] = { s: CHINTU_S, u: 0, h: 0, face: -1, toss: tossC, carried: false };
  if (W && W.carry) chintu = { ...chintu, carried: true };
  if (t > 41) chintu = null;
  // ---- the camera, shot by shot
  const P = (s: number, u: number, h: number): V3 => [s, u, h];
  let cam: StoryFrame["cam"];
  if (t < 5) { const k = ss(seg(t, 0, 5)); cam = { pos: mix(P(-34, 5, 38), P(-4, 4.2, 3.4), k), look: mix(P(260, -10, 95), P(12, 0, 1.2), ss(seg(t, 0.6, 5))), roll: 0, fov: 50 }; }
  else if (t < 9.7) { const k = ss(seg(t, 5, 9.7)); cam = { pos: mix(P(20.2, -1.5, 1.7), P(19.0, -1.1, 1.5), k), look: P(ROLLO_S, 0, 1.4), roll: 0, fov: 50 }; }
  else if (t < 12.6) { cam = { pos: P(13.4 + (t - 9.7) * 0.15, -1.4, 0.95), look: P(CHINTU_S, 0, 0.85), roll: 0, fov: 42 }; }
  else if (t < 16.7) { const k = ss(seg(t, 13.2, 16.6)); cam = { pos: P(2.8, 1.4, 0.85 + k * 0.3), look: mix(P(CHINTU_S, 0, 1), P(150, -14, 55), k), roll: 0, fov: 48 }; }
  else if (t < 21.4) { const w = W!; cam = { pos: P(3, -2.7, 1.3), look: [w.s, w.u, w.h + 0.8], roll: 0.3 * Math.min(1, (t - 16.7) / 0.5), fov: 50 }; }
  else if (t < 24.7) { const w = W!; cam = { pos: P(12.4, -3.2, 0.5), look: mix([CHINTU_S, 0, 1.2], [w.s, w.u, w.h], 0.5), roll: 0.08, fov: 42 }; }
  else if (t < 27.2) { const w = W!; cam = { pos: P(4.2, 1.2, 1.7), look: [w.s, w.u, w.h - 0.4], roll: 0, fov: 56 }; }
  else if (t < 35.2) { const w = W!, k = ss(seg(t, 27.2, 35.2)); cam = { pos: P(12.6 + k * 1.6, -1.9, 0.4), look: [w.s, w.u, w.h + 1.1], roll: -0.06, fov: 46 - k * 6 }; }
  else if (t < 39.2) { const w = W!; cam = { pos: P(3.4, 0.9, 1.6), look: [w.s, w.u, w.h + 0.5], roll: 0, fov: 50 }; }
  else { const k = ss(seg(t, 39.2, 41.4)); cam = { pos: mix(P(3.4, 0.9, 1.6), P(rolloS - 4.4, 0, 2.0), k), look: mix(W ? [W.s, W.u, W.h] : P(60, 0, 10), P(rolloS + 6, 0, 1.0), k), roll: 0, fov: 50 + k * 18 }; }
  // ---- light: the night darkens as the wind turns, a flash when she bursts out, letterbox bars throughout
  const flash = t > 16.7 && t < 17.3 ? 1 - (t - 16.7) / 0.6 : t > 19.1 && t < 19.4 ? 0.5 : 0;
  const dim = t < 12.5 ? 0 : t < 16.7 ? ss(seg(t, 12.5, 16.7)) * 0.55 : t < 39 ? 0.55 : 0.55 * (1 - ss(seg(t, 39, 41.4)));
  const bars = t < 39.4 ? Math.min(1, t / 0.8) : 1 - ss(seg(t, 39.4, 41.2));
  return { cam, rollo, chintu, witch: W, ball, flash, dim, bars };
}
