// Orbi GP sections from Phases 2–3: the ideas that need pieces of their own — loops, glass tubes, wall rides and
// corkscrews held on by magnet rails, forks and split strands, cannons and air rings, spinning discs and swings,
// rolling boulders, flippers, doors, presses and clapping walls, portals and switch bridges, holey boards, beat floors
// and piano keys, black holes, gusts, chasers (avalanches, worms, trains…), collapsing floors, colour gates, speed traps
// and limits, treasure roads, weather and camera twists. Each one is a tuned piece of road for the stage director
// (gen.ts), which picks it for its idea, mixes it with older ones and has the fairness robot drive it first.
import type { B, Mode } from "./gen";
import type { StageRules } from "./types";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const RAILS = { railL: true, railR: true };

export type Mech2 =
  | "loop" | "tube" | "wallride" | "corkscrew" | "fork" | "strands" | "cannon" | "rings" | "discs" | "swings" | "boulders"
  | "flippers" | "doors" | "presses" | "clappers" | "portals" | "switch" | "holes" | "pontoons" | "beat" | "keys" | "blackhole"
  | "gusts" | "weather" | "view" | "chaser" | "collapse" | "rail" | "paint" | "speedtrap" | "limit" | "treasure" | "doublepad"
  | "bullseye" | "blind" | "trickpark" | "cannonballs" | "lightning" | "lasergrid" | "spores" | "rumble" | "sidebelt" | "glass";

export const MECH2_LABEL: Record<Mech2, string> = {
  loop: "Loop-the-loop", tube: "Glass Tube", wallride: "Wall Ride", corkscrew: "Corkscrew", fork: "The Fork", strands: "Split Strands",
  cannon: "Cannon Shot", rings: "Ring Jump", discs: "Spinning Discs", swings: "Swing Platforms", boulders: "Rolling Boulders",
  flippers: "Flippers", doors: "Slamming Doors", presses: "Presses", clappers: "Clapping Walls", portals: "Portals", switch: "Switch Bridge",
  holes: "Holey Board", pontoons: "Floating Pontoons", beat: "Beat Floor", keys: "Piano Keys", blackhole: "Black Hole", gusts: "Gusts",
  weather: "Storm", view: "Camera Twist", chaser: "The Chase", collapse: "Collapsing Floor", rail: "Rail Grind", paint: "Colour Gates",
  speedtrap: "Speed Trap", limit: "Speed Limit", treasure: "Treasure Road", doublepad: "Double Launch", bullseye: "Bullseye Landing",
  blind: "Blind Jump", trickpark: "Trick Park", cannonballs: "Cannonballs", lightning: "Lightning", lasergrid: "Laser Grid",
  spores: "Spore Clouds", rumble: "Rumble Strips", sidebelt: "Side Belt", glass: "Glass Road",
};

/** a pad jump onto the road ahead (helper) */
function jump(b: B, vh: number, u = 0, look?: string) {
  const a = b.straight(20), fl = b.flight(vh);
  b.add("pad", a + 18.2, u, { ds: 1.2, w: 1.7, p: vh, look });
  b.gap(fl * 0.62); b.straight(18);
  b.steer(a, a + 19, u, 1);
  return { a, fl, pad: a + 18.2 };
}

export const SECTIONS2: Record<Mech2, (b: B, m: Mode) => void> = {
  loop: (b, m) => {
    const a = b.straight(28, RAILS);
    b.add("boost", a + 10, 0, { ds: 1.4, w: b.hw }); b.add("boost", a + 21, 0, { ds: 1.4, w: b.hw });
    const R = m === "sign" ? 6.5 : clamp(6.5 + b.r.d, 6.5, 8.5), L = Math.round(2 * Math.PI * R);
    const s0 = b.seg(L, { pitch: 2 * Math.PI, shift: (b.width + 2) * b.dir(), ...RAILS, look: b.vr === "planet" ? "glass" : undefined });
    b.add("zone", s0 + L / 2, 0, { ds: L / 2 + 4, w: b.hw + 2, zone: "magnet", p: 6, look: "none" });
    b.add("zone", s0 + L / 2, 0, { ds: L / 2, w: b.hw + 2, zone: "speed", look: "none" });
    b.coins(s0 + 4, s0 + L - 4, 0, 0, 2.6);
    b.straight(18, RAILS);
    b.steer(a, b.s, 0, 1);
  },
  tube: (b, m) => {
    const dir = b.dir(), o = { tube: true, crown: -0.5, ...RAILS, width: b.width + 1 };
    const a = b.straight(24, o);
    b.add("zone", a + 12, 0, { ds: 9, w: b.hw * 0.5, zone: "speed" });
    b.curve(60, dir * (0.7 + b.r.d * 0.3), o);
    if (m !== "sign") { b.seg(30, { ...o, pitch: -0.12 }); b.curve(50, -dir * 0.9, o); b.seg(30, { ...o, pitch: 0.12 }); }
    b.straight(16, o);
    b.coins(a + 26, b.s - 10, dir * b.free * 0.5, -dir * b.free * 0.5, 4, 0.9);
    if (b.vr === "hyper" || b.vr === "light") for (let s = a + 30; s < b.s - 10; s += 40) b.add("boost", s, 0, { ds: 1.4, w: b.hw * 0.6 });
  },
  wallride: (b, m) => {
    const dir = b.dir(), tw = -dir * (m === "sign" ? 0.85 : 1.1);
    const a = b.straight(16, RAILS);
    b.add("boost", a + 8, 0, { ds: 1.4, w: b.hw });
    b.seg(18, { ...RAILS, twist: tw }); b.curve(46, dir * 1.3, RAILS); b.seg(18, { ...RAILS, twist: -tw });
    b.add("zone", a + 57, 0, { ds: 44, w: b.hw + 2, zone: "magnet", p: 7, look: "none" });
    b.coins(a + 20, a + 96, 0, 0, 4);
    b.straight(12, RAILS);
    b.steer(a, b.s, 0, 1);
  },
  corkscrew: (b, m) => {
    const dir = b.dir(), L = m === "sign" ? 70 : 60;
    const a = b.straight(16, RAILS);
    b.add("boost", a + 8, 0, { ds: 1.4, w: b.hw });
    const s0 = b.seg(L, { ...RAILS, twist: dir * 2 * Math.PI, tube: b.vr === "drum" });
    b.add("zone", s0 + L / 2, 0, { ds: L / 2 + 3, w: b.hw + 2, zone: "magnet", p: 6, look: "none" });
    b.coins(s0 + 4, s0 + L - 4, 0, 0, 3);
    b.straight(12, RAILS);
    b.steer(a, b.s, 0, 1);
  },
  fork: (b, m) => {
    const w0 = b.width; b.width = Math.max(w0, 11) + 3;
    const L = 64, a = b.straight(L + 20, RAILS), s0 = a + 10, q = b.hw / 2;
    for (const k of [0, 1]) b.add("block", s0 + L / 4 + (k * L) / 2, 0, { ds: L / 4, w: 0.3, tall: 1.1, look: "wall" });
    const risky = b.dir();
    b.add("zone", s0 + L / 2, risky * q, { ds: L / 2 - 2, w: q - 0.5, zone: "speed" });
    for (let k = 0; k < (m === "sign" ? 2 : 3); k++) b.add("bumper", s0 + 14 + k * 18, risky * q + (k % 2 ? 0.9 : -0.9), { w: 0.6, tall: 1.2, p: 4 });
    for (let k = 0; k < 4; k++) b.add("gem", s0 + 8 + k * 14, risky * q, { h: 0.6, w: 0.5 });
    b.add("zone", s0 + L / 2, -risky * q, { ds: L / 2 - 6, w: q - 0.5, zone: b.vr === "sorting" ? "conveyor" : "sand", p: 5 });
    b.steer(a, s0 + L + 4, -risky * q, 0.95);
    b.width = w0; b.straight(12);
  },
  strands: (b, m) => {
    const n = m === "sign" ? 2 : 3, L = 12, a = b.straight(10), g0 = b.s, lanes = [-2.6, 0, 2.6];
    b.gap(n * L + 1);
    for (let i = 0; i < n; i++) for (const u of lanes) b.add("plat", g0 + 0.5 + i * L + L / 2, u, { ds: L / 2 - 0.05, w: 0.8, look: "strand" });
    const lane = b.rng.pick(lanes);
    b.steer(a, b.s + 2, lane, 0.8); b.coins(g0 + 2, g0 + n * L - 2, lane, lane, 3);
    b.straight(10);
  },
  cannon: (b, m) => {
    const n = m === "sign" ? 1 : b.vr === "catapult" ? 3 : 2, big = b.vr === "leap" ? 1.5 : 0;
    for (let i = 0; i < n; i++) { const vh = 12.5 + b.r.d * 1.2 + big; const j = jump(b, vh, m === "mix" ? b.lane() : 0, b.vr || "cannon"); b.arc(j.pad, 0, vh); }
  },
  rings: (b, m) => {
    for (let i = 0; i < (m === "sign" ? 1 : 2); i++) {
      const vh = 12 + b.r.d, v = b.v * 0.95, T = (2 * vh) / 26, j = jump(b, vh, 0, b.vr === "gyro" ? undefined : "ring");
      for (const k of [0.3, 0.5, 0.72]) { const t = T * k; b.add("ring", j.pad + v * t, 0, { h: 0.55 + vh * t - 13 * t * t, w: 1.9, look: b.vr }); }
    }
  },
  discs: (b, m) => {
    const n = m === "sign" ? 2 : 3, R = clamp(3.6 - b.r.d * 0.4, 3, 3.6), a = b.straight(10), g0 = b.s;
    b.gap(n * (2 * R + 0.5) + 0.5);
    for (let i = 0; i < n; i++) {
      const s = g0 + 0.5 + i * (2 * R + 0.5) + R, w = (i % 2 ? -1 : 1) * clamp(0.6 + b.r.d * 0.5, 0.6, 1.3);
      b.add("disc", s, 0, { ds: R, w: R, p: w, look: b.vr || "disc" });
      b.add("coin", s, 0, { h: 0.6, w: 0.5 });
    }
    b.steer(a, b.s + 1, 0, 0.78);
    b.straight(10);
  },
  swings: (b, m) => {
    const n = m === "sign" ? 2 : 3, L = 6, amp = clamp(1.2 + b.r.d * 0.8, 1.2, b.free * 0.75), P = clamp(3.6 - b.r.d * 0.8, 2.6, 3.6);
    const a = b.straight(10), g0 = b.s;
    b.gap(n * (L + 0.8) + 0.8);
    for (let i = 0; i < n; i++) {
      const s = g0 + 0.8 + i * (L + 0.8) + L / 2;
      const o = b.add("plat", s, 0, { ds: L / 2, w: 1.8, mov: { ax: "swing", amp, period: P, phase: i * 1.3 }, look: b.vr || "swing" });
      b.intent({ s: s - L / 2 - 4, until: s + L / 2, follow: o.id, slow: 0.62 });
    }
    b.steer(a, g0 - 3, 0, 0.62);
    // a wide landing with curbs: you step off a swing wherever it is
    const e = b.straight(14, { ...RAILS, width: b.width + 3 }); b.steer(e, e + 14, 0, 0.8);
  },
  boulders: (b, m) => {
    const n = m === "sign" ? 2 : 3, L = 90, a = b.straight(L, RAILS);
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1) - 0.5) * 2 * b.free * 0.6;
      b.add("bumper", a + L / 2, u, { w: 1.3, tall: 2.6, p: 3, mov: { ax: "s", amp: 28, period: clamp(7 - b.r.d * 1.5, 4.5, 7) + i * 0.7, phase: i * 2.1 }, look: b.vr || "boulder" });
    }
    b.coins(a + 8, a + L - 8, 0, 0, 6);
  },
  flippers: (b, m) => {
    const w0 = b.width; b.width = Math.max(w0, 10);
    const n = m === "sign" ? 1 : 2, a = b.straight(30 + n * 26, RAILS);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      b.add("sweeper", a + 20 + i * 26, side * (b.hw - 0.5), { p: b.hw * 0.72, tall: 1.1, mov: { ax: "spin", amp: 0.95, period: clamp(2.4 - b.r.d * 0.4, 1.6, 2.4), phase: 0 }, look: b.vr || "flipper" });
      b.steer(a + 8 + i * 26, a + 30 + i * 26, -side * b.free * 0.55, 0.9);
    }
    b.width = w0; b.straight(10);
  },
  doors: (b, m) => {
    const n = m === "sign" ? 2 : 3, a = b.straight(26 + n * 20), P = clamp(3.4 - b.r.d * 0.6, 2.4, 3.4);
    for (let i = 0; i < n; i++) for (const side of [-1, 1]) b.add("block", a + 16 + i * 20, (side * b.hw) / 2, { ds: 0.5, w: b.hw / 2 - 0.05, tall: 2.6, mov: { ax: "h", amp: 3.4, period: P, phase: (side > 0 ? Math.PI : 0) + i * 1.2 }, look: b.vr || "door" });
  },
  presses: (b, m) => {
    const n = m === "sign" ? 2 : 3, a = b.straight(30 + n * 18), P = b.beat * 4;
    for (let i = 0; i < n; i++) b.add("block", a + 18 + i * 18, 0, { ds: 1.2, w: b.hw, tall: 2.4, mov: { ax: "h", amp: 3.6, period: P, phase: i * 1.9 }, look: b.vr || "press" });
  },
  clappers: (b, m) => {
    const n = m === "sign" ? 2 : 3, a = b.straight(26 + n * 20), P = clamp(3 - b.r.d * 0.5, 2, 3);
    for (let i = 0; i < n; i++) for (const side of [-1, 1]) b.add("block", a + 16 + i * 20, side * b.hw * 0.75, { ds: 0.7, w: b.hw * 0.25, tall: 1.6, mov: { ax: "u", amp: b.hw * 0.5, period: P, phase: (side > 0 ? Math.PI : 0) + i * 0.9 }, look: b.vr || "clapper" });
  },
  portals: (b) => {
    const u = b.dir() * b.free * 0.55, dir = b.dir(), a = b.straight(26);
    const p = b.add("portal", a + 16, u, { w: 1.5, look: "in" });
    b.steer(a, a + 17, u, 1);
    // the long way round, for the ones who miss it
    const s1 = b.curve(44, dir * Math.PI * 0.9, RAILS); b.steer(s1, s1 + 44, 0, 0.62);
    b.straight(16); const s2 = b.curve(44, -dir * Math.PI * 0.9, RAILS); b.steer(s2, s2 + 44, 0, 0.62);
    b.coins(s1 + 4, s2 + 40, 0, 0, 6);
    const e = b.straight(24);
    p.p = e + 8;
    b.add("portal", e + 8, u, { w: 1.5, look: "out" });
  },
  switch: (b) => {
    const g = b.id + 1000, u = b.dir() * b.free * 0.5, a = b.straight(28);
    b.add("switch", a + 14, u, { ds: 1.2, w: 1.3, gate: g, look: b.vr || "button" });
    b.steer(a, a + 15, u, 0.95); b.steer(a + 15, a + 28, 0, 0.95);
    const G = clamp(10 + b.r.d * 6, 10, 18), g0 = b.gap(G);
    b.add("plat", g0 + G / 2, 0, { ds: G / 2 + 0.3, w: b.hw - 0.2, gate: g, look: "bridge" });
    b.straight(14);
  },
  holes: (b, m) => {
    const rows = m === "sign" ? 6 : 9, L = 3.2, cols = [-2.2, 0, 2.2];
    b.straight(8); const g0 = b.s;
    b.gap(rows * L + 0.4);
    // the safe path changes column every third row; both columns are solid for two rows round each change
    let c = 1, keep = -1, keepTo = -1;
    for (let r = 0; r < rows; r++) {
      if (r % 3 === 2 && m !== "sign") { keep = c; keepTo = r + 1; c = clamp(c + b.dir(), 0, 2); }
      const s = g0 + 0.2 + r * L + L / 2;
      for (let k = 0; k < 3; k++) if (k === c || (k === keep && r <= keepTo) || b.rng.chance(0.5)) b.add("plat", s, cols[k], { ds: L / 2 - 0.04, w: 1.08, look: b.vr || "board" });
      b.steer(s - L / 2, s + L / 2, cols[c], 0.8);
    }
    b.straight(10);
  },
  pontoons: (b, m) => {
    const n = m === "sign" ? 5 : 8, L = 3.6, a = b.straight(8), g0 = b.s;
    b.gap(n * L + 0.4);
    for (let i = 0; i < n; i++) { const s = g0 + 0.2 + i * L + L / 2; b.add("tile", s, 0, { ds: L / 2 - 0.1, w: 1.9, fall: 0.9, look: "pontoon" }); }
    b.steer(a, b.s, 0, 0.95); b.coins(g0 + 2, g0 + n * L - 2, 0, 0, 3.6, 0.7);
    b.straight(10);
  },
  beat: (b, m) => {
    const rows = m === "sign" ? 4 : 6, L = 4, P = b.beat * 3, a = b.straight(10), g0 = b.s, cols = [-2.3, 0, 2.3];
    b.gap(rows * L + 0.4);
    for (let r = 0; r < rows; r++) for (let k = 0; k < 3; k++)
      b.add("plat", g0 + 0.2 + r * L + L / 2, cols[k], { ds: L / 2 - 0.05, w: 1.13, blink: [P, -(((k + r) % 3) * P) / 3, 0.72], look: b.vr || "beat" });
    b.steer(a, b.s, 0, 0.85);
    b.straight(10);
  },
  keys: (b, m) => {
    const n = m === "sign" ? 16 : 24, K = 1.6, a = b.straight(8), g0 = b.s;
    b.gap(n * K + 0.4);
    for (let i = 0; i < n; i++) b.add("plat", g0 + 0.2 + i * K + K / 2, 0, { ds: K / 2 - 0.04, w: b.hw - 0.2, mov: { ax: "h", amp: -0.45, period: b.beat * 2, phase: i * 0.7 }, look: i % 2 ? "keyB" : "key", p: i });
    b.steer(a, b.s, 0, 1); b.coins(g0 + 2, g0 + n * K - 2, -b.free * 0.4, b.free * 0.4, 3.2);
    b.straight(10);
  },
  blackhole: (b, m) => {
    const w0 = b.width; b.width = Math.max(w0, 9);
    const L = m === "sign" ? 50 : 70, a = b.straight(L, RAILS);
    b.add("zone", a + L / 2, 0, { ds: L / 2 - 4, w: b.hw, zone: "pull", p: clamp(8 + b.r.d * 6, 8, 16), look: "swirl" });
    b.add("zone", a + L / 2, 0, { ds: 2.2, w: 1.1, zone: "lava", look: "hole" });
    const side = b.dir();
    b.steer(a, a + L, side * b.free * 0.8, 0.9);
    b.add("gem", a + L / 2 - 6, side * b.free * 0.8, { h: 0.6, w: 0.5 });
    b.width = w0; b.straight(8);
  },
  gusts: (b) => {
    const a = b.straight(70, { railL: false, railR: false }), P = clamp(3.2 - b.r.d * 0.6, 2.2, 3.2);
    b.add("zone", a + 35, 0, { ds: 32, w: b.hw, zone: "wind", p: clamp(5 + b.r.d * 3, 5, 9), mov: { ax: "u", amp: 0, period: P, phase: 0 }, look: b.vr || "gust" });
    b.steer(a, a + 70, 0, 0.9); b.coins(a + 6, a + 64, 0, 0, 4);
  },
  weather: (b) => {
    const a = b.s, dir = b.dir();
    b.curve(60, dir * 0.6); b.straight(30); b.curve(60, -dir * 0.7); b.straight(20);
    b.add("zone", (a + b.s) / 2, 0, { ds: (b.s - a) / 2 + 30, w: 60, zone: "weather", look: b.vr || "rain" });
    b.coins(a + 6, b.s - 6, 0, 0, 5);
    if (b.vr === "lanterns" || b.vr === "dark" || b.vr === "night") for (let s = a + 10, k = 0; s < b.s; s += 16, k++) b.add("deco", s, (k % 2 ? 1 : -1) * (b.hw + 0.7), { look: "lantern" });
  },
  view: (b) => {
    const a = b.s, dir = b.dir();
    if (b.vr === "slowmo") { jump(b, 12); jump(b, 12.5); }
    else if (b.vr === "front" || b.vr === "side" || b.vr === "top") { b.straight(40); b.curve(50, dir * 0.4); b.straight(30); }
    else { b.curve(50, dir * 0.5); b.straight(40); b.curve(50, -dir * 0.6); }
    b.add("zone", (a + b.s) / 2, 0, { ds: (b.s - a) / 2, w: 60, zone: "view", look: b.vr || "side" });
    b.coins(a + 6, b.s - 6, 0, 0, 5);
  },
  chaser: (b) => {
    const a = b.s, dir = b.dir();
    b.straight(40); b.ramp(90, -0.16); b.curve(60, dir * 0.6); b.straight(40); b.curve(50, -dir * 0.5); b.straight(30);
    const L = b.s - a;
    b.add("chaser", a + 20, 0, { ds: L - 30, w: b.hw + 0.5, p: b.v * 0.74, look: b.vr || "boulder" });
    b.coins(a + 10, b.s - 10, 0, 0, 6);
    b.steer(a, b.s, 0, 1);
  },
  collapse: (b, m) => {
    const rows = m === "sign" ? 10 : 16, L = 3, a = b.straight(8), g0 = b.s, cols = [-2.2, 0, 2.2];
    b.gap(rows * L + 0.4);
    for (let r = 0; r < rows; r++) for (const u of cols) b.add("tile", g0 + 0.2 + r * L + L / 2, u, { ds: L / 2 - 0.06, w: 1.08, fall: clamp(0.5 - b.r.d * 0.1, 0.3, 0.5), look: b.vr || "ruin" });
    b.steer(a, b.s, 0, 1);
    b.coins(g0 + 2, g0 + rows * L - 2, 0, 0, 3);
    b.straight(10);
  },
  rail: (b, m) => {
    const L = m === "sign" ? 40 : clamp(50 + b.r.d * 20, 50, 80);
    b.straight(8, { width: Math.min(b.width, 4) });
    const a = b.seg(L, { width: 1.6, railL: false, railR: false, crown: -0.6, look: "rail", yaw: b.dir() * 0.35 });
    b.straight(10);
    b.steer(a - 8, a + L, 0, 0.85);
    b.coins(a + 4, a + L - 4, 0, 0, 3);
  },
  paint: (b, m) => {
    const a = b.straight(m === "sign" ? 60 : 96), q = b.free * 0.55;
    const gate = (s: number) => {
      const c = b.rng.int(1, 2);
      b.add("zone", s - 26, -q, { ds: 4, w: q * 0.9, zone: "paint", p: 1, look: "paint1" });
      b.add("zone", s - 26, q, { ds: 4, w: q * 0.9, zone: "paint", p: 2, look: "paint2" });
      b.add("laser", s, 0, { ds: 0.3, w: b.hw, tall: 2.2, p: c, look: "prism" });
      b.steer(s - 34, s - 18, c === 1 ? -q : q, 1); b.steer(s - 18, s + 2, 0, 1);
    };
    gate(a + 40); if (m !== "sign") gate(a + 82);
  },
  speedtrap: (b) => {
    const a = b.straight(70), side = b.dir();
    b.add("zone", a + 35, (side * b.hw) / 2, { ds: 28, w: b.hw / 2, zone: "slow", look: "trap" });
    b.add("zone", a + 35, (-side * b.hw) / 2, { ds: 28, w: b.hw / 2 - 0.3, zone: "speed" });
    b.steer(a, a + 70, -side * b.free * 0.6, 1);
  },
  limit: (b) => {
    const a = b.straight(80);
    b.add("zone", a + 40, 0, { ds: 36, w: b.hw, zone: "limit", p: Math.round(b.v * 0.62), look: "town" });
    b.steer(a, a + 80, 0, 0.58);
  },
  treasure: (b) => {
    const a = b.straight(80), dir = b.dir();
    for (const k of [-1, 0, 1]) b.coins(a + 6, a + 74, k * b.free * 0.6, k * b.free * 0.6, 2.6);
    b.add("gold", a + 40, dir * b.free * 0.9, { h: 0.7, w: 0.7 });
    b.add("chest", a + 72, -dir * b.free * 0.85, { h: 0, w: 0.9 });
  },
  doublepad: (b) => {
    const vh = 11.5, a = b.straight(20), fl = b.flight(vh);
    b.add("pad", a + 18.2, 0, { ds: 1.2, w: 1.7, p: vh });
    b.gap(fl * 0.62);
    const i0 = b.straight(Math.max(8, fl * 0.5), { look: "island", width: 6 });
    b.add("pad", b.s - 1.4, 0, { ds: 1.2, w: 1.7, p: vh });
    b.gap(fl * 0.62); b.straight(18);
    b.steer(a, b.s, 0, 1); b.arc(a + 18.2, 0, vh); b.arc(b.s - 18 - fl * 0.62 - 1.4, 0, vh);
    void i0;
  },
  bullseye: (b) => {
    const vh = 12, a = b.straight(20), fl = b.flight(vh), G = fl * 0.62 + 14;
    b.add("pad", a + 18.2, 0, { ds: 1.2, w: 1.7, p: vh });
    const g0 = b.gap(G);
    b.add("disc", a + 18.2 + fl, 0, { ds: 5, w: 5, p: 0, look: "target" });
    b.add("gold", a + 18.2 + fl, 0, { h: 0.7, w: 0.7 });
    b.straight(16);
    b.steer(a, b.s, 0, 1);
    void g0;
  },
  blind: (b) => {
    const vh = 12, a = b.straight(20), fl = b.flight(vh);
    b.add("pad", a + 18.2, 0, { ds: 1.2, w: 1.7, p: vh });
    b.gap(fl * 0.62 + 10);
    b.add("plat", a + 18.2 + fl, 0, { ds: 5.5, w: b.hw - 0.3, look: "blind" });
    b.straight(16);
    b.steer(a, b.s, 0, 1); b.arc(a + 18.2, 0, vh);
  },
  trickpark: (b, m) => {
    for (let i = 0; i < (m === "sign" ? 2 : 3); i++) {
      if (i % 2 === 0) { const a = b.straight(16), vh = 13, fl = b.v * 0.9 * ((2 * vh) / 26); b.add("tramp", a + 14.2, 0, { ds: 1.2, w: 1.8, p: vh }); b.gap(fl * 0.62); b.straight(16); b.steer(a, a + 15, 0, 0.92); b.add("ring", a + 14.2 + fl / 2, 0, { h: 0.55 + vh * vh / 52, w: 2 }); }
      else jump(b, 12, 0, "kick");
    }
  },
  cannonballs: (b, m) => {
    const n = m === "sign" ? 3 : 5, a = b.straight(24 + n * 12, RAILS), P = clamp(3.4 - b.r.d * 0.5, 2.6, 3.4);
    for (let i = 0; i < n; i++) b.add("block", a + 14 + i * 12, 0, { ds: 0.45, w: 0.45, tall: 0.9, mov: { ax: "u", amp: b.hw + 1, period: P, phase: i * 1.7 }, look: b.vr || "cannonball" });
  },
  lightning: (b, m) => {
    const n = m === "sign" ? 2 : 4, a = b.straight(24 + n * 16), P = b.beat * 4;
    for (let i = 0; i < n; i++) { const u = b.dir() * b.free * 0.5; b.add("spikes", a + 12 + i * 16, u, { ds: 1.4, w: 1.0, tall: 2.4, blink: [P, i * 0.9, 0.3], look: "bolt" }); }
  },
  lasergrid: (b, m) => {
    const n = m === "sign" ? 2 : 3, a = b.straight(30 + n * 20);
    for (let i = 0; i < n; i++) b.add("laser", a + 18 + i * 20, ((i % 2 ? 1 : -1) * b.hw) / 2, { ds: 0.25, w: b.hw / 2, tall: 1.6, mov: { ax: "s", amp: 6, period: clamp(3 - b.r.d * 0.5, 2, 3), phase: i * 1.4 }, look: "laser" });
    b.steer(a, a + 30 + n * 20, 0, 0.9);
  },
  spores: (b) => {
    const a = b.straight(70);
    for (let i = 0; i < 3; i++) b.add("zone", a + 14 + i * 20, 0, { ds: 4, w: b.hw * 0.35, zone: "sticky", mov: { ax: "u", amp: b.hw * 0.55, period: 3.2, phase: i * 2 }, look: b.vr || "spores" });
  },
  rumble: (b) => { const dir = b.dir(), a = b.curve(70, dir * 0.6); b.add("zone", a + 35, 0, { ds: 30, w: b.hw, zone: "rumble", look: "rumble" }); b.coins(a + 6, a + 64, 0, 0, 5); },
  sidebelt: (b, m) => {
    const w0 = b.width; b.width = 4.4;
    const L = m === "sign" ? 40 : 60, a = b.straight(L, { railL: false, railR: false }), side = b.dir();
    b.add("zone", a + L / 2, 0, { ds: L / 2, w: b.hw, zone: "wind", p: side * clamp(4 + b.r.d * 2, 4, 7), look: "belt" });
    b.steer(a, a + L, -side * 0.6, 0.9); b.coins(a + 4, a + L - 4, 0, 0, 4);
    b.width = w0; b.straight(10);
  },
  glass: (b) => { const dir = b.dir(), a = b.curve(60, dir * 0.6, { look: "glass" }); b.straight(30, { look: "glass" }); b.curve(50, -dir * 0.5, { look: "glass" }); b.coins(a + 6, b.s - 6, 0, 0, 5); },
};

/** the ideas built from a Phase 2–3 piece: [mechanic, variant] (the variant changes the look or a detail) */
export const IDEA2: Record<string, [Mech2, string?]> = {
  T07: ["fork"], T12: ["loop"], T13: ["wallride"], T18: ["tube", "glass"], T22: ["corkscrew", "upside"], T23: ["strands"], T25: ["corkscrew", "mobius"],
  J13: ["cannon", "cannon"], J14: ["rings"], J15: ["discs", "turntable"], J17: ["cannon", "catapult"], J18: ["swings"], J21: ["bullseye"], J23: ["doublepad"], J24: ["blind"], J25: ["cannon", "leap"],
  B15: ["holes", "maze"], B16: ["holes"], B18: ["swings", "sway"], B19: ["pontoons"], B20: ["discs", "clock"], B21: ["rings", "gyro"], B22: ["sidebelt"], B24: ["discs", "plate"],
  H07: ["flippers", "flipper"], H08: ["boulders", "top"], H10: ["boulders", "boulder"], H13: ["clappers"], H17: ["flippers", "boot"], H20: ["flippers", "paddle"], H21: ["doors"], H22: ["beat", "flip"], H24: ["flippers", "arm"],
  F14: ["rumble"], F18: ["beat", "colour"], F19: ["switch", "plate"], F20: ["beat"], F22: ["flippers", "pinball"], F23: ["discs", "tread"],
  A08: ["tube", "vacuum"], A10: ["gusts", "tornado"], A11: ["corkscrew", "gravity"], A12: ["rail", "magnet"], A13: ["wallride", "magnet"], A15: ["blackhole"], A16: ["loop", "planet"],
  A17: ["wallride", "moon"], A18: ["blackhole", "wells"], A21: ["loop", "gravity"], A22: ["rings", "antigrav"], A23: ["cannon", "planet"], A25: ["corkscrew", "maze"],
  M03: ["tube", "pipe"], M04: ["portals"], M05: ["switch"], M06: ["doors", "timed"], M09: ["swings", "ferris"], M10: ["rail", "cart"], M11: ["blackhole", "drain"], M13: ["corkscrew", "drum"],
  M15: ["rail", "zipline"], M17: ["fork", "sorting"], M20: ["swings", "pendulum"], M21: ["discs", "maze"], M22: ["fork", "junction"], M23: ["cannon", "catapult"], M24: ["switch", "domino"],
  N06: ["weather", "dark"], N07: ["weather", "rain"], N09: ["weather", "sandstorm"], N11: ["swings", "vine"], N14: ["weather", "lanterns"], N18: ["weather", "smoke"], N19: ["weather", "rainbow"],
  N21: ["gusts", "solar"], N22: ["weather", "code"], N23: ["gusts", "petals"], N24: ["weather", "fireworks"], N25: ["weather", "storm"],
  D03: ["clappers", "crab"], D04: ["chaser", "dominoes"], D11: ["clappers", "plant"], D12: ["cannonballs"], D14: ["spores", "hands"], D15: ["spores"], D16: ["boulders", "jelly"], D17: ["lightning"],
  D18: ["presses"], D19: ["paint", "prism"], D21: ["boulders", "debris"], D22: ["lasergrid"], D23: ["flippers", "fire"], D24: ["cannonballs", "rocket"],
  S11: ["treasure", "line"], S13: ["tube", "swing"], S15: ["speedtrap"], S18: ["rings", "air"], S19: ["collapse", "keepup"], S21: ["tube", "tunnel"], S23: ["tube", "hyper"], S25: ["tube", "light"],
  R06: ["fork", "shortcut"], R12: ["chaser", "chaser"], R23: ["weather", "night"],
  C08: ["treasure", "letters"], C10: ["treasure", "chest"], C11: ["treasure", "gold"], C21: ["treasure", "vault"], C23: ["treasure"],
  Q06: ["rings"], Q09: ["view", "mirror"], Q16: ["paint"], Q17: ["limit"],
  V02: ["view", "side"], V03: ["view", "top"], V04: ["view", "low"], V05: ["view", "slowmo"], V06: ["weather", "dark"], V07: ["view", "mirror"], V08: ["view", "tilt"], V09: ["weather", "fog"],
  V10: ["glass"], V11: ["view", "flip"], V12: ["view", "fisheye"], V13: ["view", "strobe"], V14: ["weather", "neon"], V15: ["tube", "tunnel"], V16: ["view", "far"], V17: ["view", "front"],
  V18: ["view", "pixel"], V21: ["fork"], V22: ["view", "nightvision"], V23: ["view", "kaleido"], V24: ["view", "narrow"],
  X02: ["trickpark"], X05: ["rail"], X06: ["wallride"], X07: ["loop"], X09: ["trickpark"], X10: ["trickpark"], X11: ["trickpark"], X13: ["rings", "trick"], X18: ["rings", "gate"], X21: ["trickpark"],
  X23: ["treasure", "trail"], X24: ["trickpark"],
  E02: ["chaser", "candy"], E04: ["chaser", "dominoes"], E06: ["chaser", "rocks"], E07: ["flippers", "pinball"], E09: ["chaser", "worm"], E11: ["collapse"], E12: ["cannonballs", "airship"],
  E13: ["presses", "clock"], E14: ["chaser", "train"], E17: ["chaser", "tornado"], E18: ["presses", "factory"], E21: ["chaser", "comet"], E22: ["collapse", "glitch"], E23: ["rings", "dragon"],
  Y03: ["doors", "music"], Y04: ["treasure", "notes"], Y05: ["cannon", "bass"], Y06: ["keys"], Y11: ["beat", "light"], Y14: ["keys", "echo"], Y15: ["beat", "offbeat"], Y17: ["cannon", "drop"],
  Y21: ["collapse", "glitch"], Y22: ["cannon", "drum"], Y24: ["beat", "royale"],
};

/** ideas that are a rule or a race format more than a piece of road */
export interface IdeaRule { rules?: StageRules; special?: "duel" | "champion" | "leader" | "rush" | "ghost" | "royale" | "final"; rivals?: number; skill?: number; hearts?: boolean }
export const IDEA_RULES: Record<string, IdeaRule> = {
  R07: { special: "rush" }, R09: { rules: { elim: true, podium: true } }, R10: { special: "duel", rivals: 1, skill: 0.25, rules: { win: true } },
  R11: { special: "leader", rules: { win: true } }, R12: { rules: { escape: true, podium: true } }, R15: { rules: { rolling: true, podium: true } },
  R17: { special: "ghost", rules: { podium: true } }, R18: { special: "rush", skill: 0.2, rules: { podium: true } }, R19: { rules: { rolling: true, podium: true } },
  R20: { special: "royale", rivals: 15, rules: { elim: true, podium: true } }, R22: { special: "champion", rules: { win: true } }, R25: { skill: 0.3, rules: { win: true } },
  Q04: { rules: { coins: 40, podium: true } }, Q06: { rules: { rings: true } }, Q07: { rules: { stars: true } }, Q12: { rules: { nopower: true, podium: true } },
  Q13: { rules: { powers: 3, podium: true } }, Q18: { rules: { tricks: 3, podium: true } }, Q19: { rules: { podium: true } }, Q21: { rules: { elim: true, podium: true } }, Q23: { rules: { lead: true } },
  C03: { hearts: true }, X04: {}, X08: {}, X14: {}, C05: {}, M01: {},
};

// ---------------------------------------------------------------- the road between sections (Sky Roll style)
// No plain road: between two sections the course runs a technical stretch — a tilted (cambered) road that pulls you to
// one side, a narrow zig-zag, a funnel that shrinks to a thread, stairs to drop down, hops over gaps, crests that throw
// you up, a rounded ledge, a minefield of don't-touch orbs, a slalom — or, now and then, a speed run with boost pads and
// a rocket booster where you hit 350 km/h.
const narrowW = (b: B) => clamp(3.4 - b.r.d * 0.7, 2.2, 3.4);
const NO_RAILS = { railL: false, railR: false };
/** a row of don't-touch mines across the road with one gap (lane u) */
function mineRow(b: B, s: number, gapU: number, moving = false) {
  const step = 1.6;
  for (let u = -b.free; u <= b.free + 0.01; u += step) {
    if (Math.abs(u - gapU) < step * 0.95) continue;
    b.add("mine", s, u, { h: 0.6, w: 0.5, ...(moving ? { mov: { ax: "u" as const, amp: 0.7, period: 2.4, phase: s * 0.3 } } : {}) });
  }
}
const JOIN: [number, (b: B) => void][] = [
  [3, (b) => { // camber: the road tilts and pulls you to one side
    const tw = b.dir() * clamp(0.2 + b.r.d * 0.16, 0.2, 0.46), w = clamp(b.width * 0.8, 3, 6), L = b.rng.int(30, 60);
    const a = b.seg(10, { twist: tw, width: w, ...NO_RAILS }); b.seg(L, { width: w, ...NO_RAILS }); b.seg(10, { twist: -tw, width: w, ...NO_RAILS });
    b.steer(a, b.s, 0, b.at(26)); b.coins(a + 8, b.s - 8, 0, 0, 4);
  }],
  [3, (b) => { // zig: a narrow zig-zag with no rails
    const w = narrowW(b) + 1, n = b.rng.int(3, 5), y = clamp(0.28 + b.r.d * 0.1, 0.28, 0.42), a = b.s, d0 = b.dir();
    b.straight(6, { width: w, ...NO_RAILS });
    for (let i = 0; i < n; i++) b.curve(18, (i % 2 ? -1 : 1) * d0 * y, { width: w, ...NO_RAILS });
    b.steer(a, b.s, 0, b.at(20)); b.coins(a + 6, b.s - 4, 0, 0, 4);
  }],
  [3, (b) => { // funnel: a wide road shrinks to a thread
    const wide = b.width + 2, nw = narrowW(b), a = b.s, L = 24 + b.r.d * 14;
    b.straight(12, { width: wide, ...NO_RAILS }); b.straight(12, { width: (wide + nw) / 2, ...NO_RAILS }); b.straight(L, { width: nw, ...NO_RAILS }); b.straight(8);
    b.steer(a + 8, b.s, 0, b.at(24)); b.coins(a + 26, a + 24 + L, 0, 0, 3);
  }],
  [2, (b) => { // stairs: steps down, narrower as you go
    const n = b.rng.int(4, 7), a = b.s;
    for (let i = 0; i < n; i++) { b.straight(6 + b.rng.int(0, 3), { width: Math.max(narrowW(b), b.width - i * 0.5), ...NO_RAILS }); b.gap(1.6, { pitch: -0.5 }); b.gap(1.6, { pitch: 0.5 }); }
    b.straight(8); b.steer(a, b.s, 0, 0.9); b.coins(a + 3, b.s - 6, 0, 0, 3.2, 0.8);
  }],
  [2, (b) => { // hops: jump the gaps on a narrow road
    const n = b.rng.int(2, 4), w = narrowW(b) + 1, a = b.s;
    for (let i = 0; i < n; i++) { b.straight(12, { width: w, ...NO_RAILS }); b.gap(clamp(2.4 + b.r.d * 1.8, 2.4, 5.2)); }
    b.straight(10, { width: w }); b.steer(a, b.s, 0, 1);
  }],
  [2, (b) => { // crests: humps that throw you into the air, then land on a narrow road
    const n = b.rng.int(3, 5), w = narrowW(b) + 1.2, a = b.s;
    for (let i = 0; i < n; i++) { b.seg(8, { pitch: 0.3, width: w, ...NO_RAILS }); b.seg(12, { pitch: -0.6, width: w, ...NO_RAILS }); b.seg(8, { pitch: 0.3, width: w, ...NO_RAILS }); }
    b.steer(a, b.s, 0, 0.92); b.coins(a + 4, b.s - 4, 0, 0, 3, 1.4);
  }],
  [2, (b) => { // ledge: a rounded beam with nothing either side
    const L = clamp(30 + b.r.d * 14, 30, 50), w = clamp(2.4 - b.r.d * 0.4, 1.8, 2.4);
    b.straight(6, { width: Math.min(b.width, 4) });
    const a = b.straight(L, { width: w, crown: 0.32, look: "beam", ...NO_RAILS }); b.straight(8);
    b.steer(a - 6, a + L, 0, b.at(18)); b.coins(a + 4, a + L - 4, 0, 0, 4);
  }],
  [2, (b) => { // minefield: weave through rows of don't-touch orbs
    const rows = b.rng.int(4, 6), a = b.straight(20 + rows * 16), moving = b.r.d > 0.9;
    let g = 0;
    for (let i = 0; i < rows; i++) {
      g = clamp(g + b.rng.pick([-1.6, 0, 1.6]), -b.free + 0.8, b.free - 0.8);
      const s = a + 16 + i * 16; mineRow(b, s, g, moving);
      b.intent({ s: s - 14.6, until: s + 1.2, u: g, slow: b.at(17), now: true });
    }
  }],
  [2, (b) => { // slalom: don't-touch posts left and right on a narrow road
    const n = b.rng.int(5, 8), w = Math.max(narrowW(b) + 1.6, 4.4), a = b.straight(20 + n * 18, { width: w, ...NO_RAILS });
    const hw = w / 2;
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, s = a + 16 + i * 18; b.add("mine", s, side * (hw - 1.15), { h: 0.6, w: 0.5 }); b.intent({ s: s - 16.8, until: s + 1, u: -side * Math.min(0.8, hw - 1.4), slow: b.at(16), now: true }); }
  }],
  [2, (b) => { // speed run: a wide downhill with boost pads and a rocket booster — 350 km/h
    const w0 = b.width; b.width = Math.max(w0, 8) + 1;
    const L = b.rng.int(260, 360), a = b.s;
    b.seg(L * 0.2, { pitch: -0.1, railL: true, railR: true }); b.seg(L * 0.6, { railL: true, railR: true }); b.seg(L * 0.2, { pitch: 0.1, railL: true, railR: true });
    b.elev -= Math.sin(0.1) * L * 0.2;
    for (const k of [0.06, 0.14]) b.add("boost", a + L * k, 0, { ds: 1.4, w: b.hw - 0.3 });
    // the rocket: on the middle line, or a stronger one out on the edge
    b.add("rocket", a + L * 0.24, b.dir() * b.free * 0.6, { h: 0.9, w: 0.85, p: 1.8 });
    b.add("rocket", a + L * 0.24, 0, { h: 0.9, w: 0.85, p: 1.3 });
    for (let i = 0; i < 3; i++) b.add("mine", a + L * (0.42 + i * 0.08), (i % 2 ? 1 : -1) * b.free * 0.6, { h: 0.6, w: 0.5 });
    b.coins(a + 8, a + L - 8, 0, 0, 5);
    // brake before the end: what comes next is never this wide
    b.steer(a, a + L * 0.72, 0, 1); b.steer(a + L * 0.72, a + L + 12, 0, b.at(34));
    b.width = w0; b.straight(12);
  }],
];
/** the stretch between two sections (weighted; speed runs come more often later on) */
export function joiner(b: B) {
  const tot = JOIN.reduce((x, [w]) => x + w, 0);
  let k = b.rng.next() * tot;
  for (const [w, f] of JOIN) { k -= w; if (k <= 0) { f(b); return; } }
  JOIN[0][1](b);
}
