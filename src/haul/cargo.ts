// The loads: what each world asks you to deliver. Every kind is a small rigid body (a box or a ball) with its own
// size, weight, grip, bounce and — for the fragile ones — the impact speed (m/s) that breaks it. Light kinds feel the
// wind more. A stage's load is stacked into the bed by `stackLoad`: rows from the floor up, the upper row nestled
// between the ones below, so a bigger load stands taller than the tailgate and a careless driver spills the top row.
import { makeRng, range } from "./util";

export type CargoKind =
  | "crate" | "melon" | "barrel" | "jar" | "egg" | "vase" | "potion" | "log" | "gift" | "lantern" | "crystal" | "orb";

export interface CargoSpec {
  kind: CargoKind;
  name: string; plural: string;
  shape: "box" | "ball";
  /** box: width × height; ball: radius in w */
  w: number; h: number;
  mass: number;
  /** friction and bounce */
  mu: number; bounce: number;
  /** impact speed (m/s) that breaks it; 0 = it never breaks */
  breaks: number;
  /** how far one row may hold (the bed is ~1.7 m long) and how many rows a full load stacks */
  rows: number;
  /** colours for the HUD icon */
  color: string; dark: string;
}

export const CARGO: Record<CargoKind, CargoSpec> = {
  crate: { kind: "crate", name: "crate", plural: "crates", shape: "box", w: 0.5, h: 0.44, mass: 16, mu: 0.64, bounce: 0.2, breaks: 0, rows: 2, color: "#D99A52", dark: "#8A5527" },
  melon: { kind: "melon", name: "melon", plural: "melons", shape: "ball", w: 0.26, h: 0.26, mass: 9, mu: 0.7, bounce: 0.2, breaks: 9.5, rows: 2, color: "#5BBF4A", dark: "#2E7A2A" },
  barrel: { kind: "barrel", name: "barrel", plural: "barrels", shape: "box", w: 0.44, h: 0.48, mass: 20, mu: 0.62, bounce: 0.2, breaks: 0, rows: 2, color: "#B8743E", dark: "#5E3A1E" },
  jar: { kind: "jar", name: "honey jar", plural: "honey jars", shape: "box", w: 0.33, h: 0.4, mass: 7, mu: 0.45, bounce: 0.1, breaks: 6.2, rows: 2, color: "#FFB627", dark: "#B26A00" },
  egg: { kind: "egg", name: "giant egg", plural: "giant eggs", shape: "ball", w: 0.2, h: 0.2, mass: 4, mu: 0.75, bounce: 0.08, breaks: 5.4, rows: 2, color: "#FFF1DC", dark: "#C9A27A" },
  vase: { kind: "vase", name: "clay vase", plural: "clay vases", shape: "box", w: 0.36, h: 0.46, mass: 9, mu: 0.62, bounce: 0.08, breaks: 7.2, rows: 2, color: "#E0774A", dark: "#8E3A1F" },
  potion: { kind: "potion", name: "potion", plural: "potions", shape: "box", w: 0.28, h: 0.42, mass: 5, mu: 0.45, bounce: 0.12, breaks: 6.5, rows: 2, color: "#B46CFF", dark: "#5B2A9A" },
  log: { kind: "log", name: "log", plural: "logs", shape: "box", w: 0.76, h: 0.3, mass: 18, mu: 0.7, bounce: 0.06, breaks: 0, rows: 2, color: "#A86A3A", dark: "#5A3218" },
  gift: { kind: "gift", name: "gift", plural: "gifts", shape: "box", w: 0.48, h: 0.42, mass: 6, mu: 0.5, bounce: 0.3, breaks: 0, rows: 2, color: "#FF4F6D", dark: "#9E1F3A" },
  lantern: { kind: "lantern", name: "lantern", plural: "lanterns", shape: "box", w: 0.34, h: 0.42, mass: 2.6, mu: 0.55, bounce: 0.18, breaks: 0, rows: 2, color: "#FF6A3D", dark: "#A8301A" },
  crystal: { kind: "crystal", name: "fire crystal", plural: "fire crystals", shape: "box", w: 0.32, h: 0.46, mass: 10, mu: 0.45, bounce: 0.1, breaks: 7.5, rows: 2, color: "#FF5F8F", dark: "#8E1F4A" },
  orb: { kind: "orb", name: "star orb", plural: "star orbs", shape: "box", w: 0.36, h: 0.38, mass: 7, mu: 0.6, bounce: 0.26, breaks: 0, rows: 2, color: "#7CE7FF", dark: "#2A6FB8" },
};
export const cargoOf = (k: CargoKind) => CARGO[k];

/** how many of a kind fit on one row of a bed this long */
export function perRow(k: CargoKind, bedLen: number) {
  const s = CARGO[k];
  const w = s.shape === "ball" ? s.w * 2 : s.w;
  return Math.max(1, Math.floor((bedLen - 0.06) / (w + 0.05)));
}
/** the largest load of a kind (every row full, rows shrinking by one as they nest) */
export function capacity(k: CargoKind, bedLen: number) {
  const n = perRow(k, bedLen), rows = CARGO[k].rows;
  let c = 0;
  for (let i = 0; i < rows; i++) c += Math.max(1, n - i);
  return c;
}

export interface Slot { kind: CargoKind; x: number; y: number; scale: number; seed: number }

/**
 * Stack a load into the bed (bed-local metres: x from the tailgate's inner face, y up from the floor).
 * `kinds` lists the kinds to mix (remixes carry two); the stack is the same every time for a stage's seed.
 */
export function stackLoad(kinds: CargoKind[], count: number, bedLen: number, seed: number): Slot[] {
  const r = makeRng(seed);
  const out: Slot[] = [];
  let row = 0, y = 0;
  /** the ball row below (centres), for nestling */
  let below: number[] = [], belowY = 0, belowR = 0;
  while (out.length < count && row < 6) {
    const k = kinds[row % kinds.length];
    const s = CARGO[k];
    const n = Math.max(1, perRow(k, bedLen) - (row > 0 ? 1 : 0));
    // the floor row holds about half the load, so every load stacks at least two rows high
    // (balls: one more on the floor, so the second row's dips hold the rest)
    const half = row === 0 ? Math.max(2, Math.ceil((count + (s.shape === "ball" ? 1 : 0)) / 2)) : n;
    const take = Math.min(n, half, count - out.length);
    if (s.shape === "ball") {
      const rr = s.w;
      if (row > 0 && below.length > 1 && belowR > 0) {
        // into the dips between the balls below (packed tight, so the dips are deep and hold)
        const xs: number[] = [];
        for (let i = 0; i + 1 < below.length && xs.length < take; i++) xs.push((below[i] + below[i + 1]) / 2);
        const half = (below[1] - below[0]) / 2, rise = Math.sqrt(Math.max(0.01, (rr + belowR) ** 2 - half * half));
        for (const x of xs) out.push({ kind: k, x, y: belowY + rise + 0.004, scale: 1, seed: Math.floor(r() * 1e9) });
        below = xs; belowY += rise; belowR = rr;
      } else {
        // the floor row: packed together in the middle of the bed
        const gap = 0.012, span = take * 2 * rr + (take - 1) * gap, x0 = (bedLen - span) / 2 + rr;
        below = [];
        for (let i = 0; i < take; i++) { const x = x0 + i * (2 * rr + gap); below.push(x); out.push({ kind: k, x, y: y + rr + 0.004, scale: 1, seed: Math.floor(r() * 1e9) }); }
        belowY = y + rr; belowR = rr;
      }
      y = belowY + rr;
      row++;
      continue;
    }
    below = []; belowR = 0;
    const scales: number[] = [];
    for (let i = 0; i < take; i++) scales.push(k === "gift" ? range(r, 0.82, 1.08) : 1);
    const used = scales.reduce((a, sc) => a + s.w * sc, 0);
    const gap = Math.max(0.02, (bedLen - used) / (take + 1));
    let x = gap;
    let rowH = 0;
    for (let i = 0; i < take; i++) {
      const sc = scales[i], ww = s.w * sc, hh = s.h * sc;
      out.push({ kind: k, x: x + ww / 2, y: y + hh / 2 + 0.005, scale: sc, seed: Math.floor(r() * 1e9) });
      x += ww + gap;
      rowH = Math.max(rowH, hh);
    }
    y += rowH + 0.01;
    row++;
  }
  return out;
}
