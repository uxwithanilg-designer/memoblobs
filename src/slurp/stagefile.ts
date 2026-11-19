// Slurp Lab: the compact stage format of the forged campaign files (public/games/slurp-lab/stages-<k>.json, 100
// stages each). Tiles are one character per cell; Gloopies "." none, "0".."7" a colour, "r" rainbow; Gloopy flags in
// base 36; extras only when a stage uses them.
import { T, type SlurperFlags, type Stage } from "./types";
import { kindOf, labOf, stageIn, LABS } from "./campaign";

export interface StageRow {
  n: number; name: string; w: number; h: number; t: string; b: string;
  /** [x, y, colour, need, shape, "xy xy …", flags?] */
  sl: ([number, number, number, number, string, string] | [number, number, number, number, string, string, SlurperFlags])[];
  /** "i:dirs" drags of the planted solution */
  sol: string[];
  m: Stage["m"];
  /** Gloopy flags (one base-36 character per cell) */
  bf?: string;
  fz?: Record<number, number>;
  f?: number[];
  p?: [number, number][];
  c?: number[];
  mech?: string[];
}

// tile code ↔ character
const TILE_CH: Record<number, string> = { [T.FLOOR]: ".", [T.WALL]: "#", [T.VOID]: " ", [T.ICE]: "~", [T.GOO]: "*", [T.PORTAL]: "O", [T.TURN]: "@", [T.GLASS]: "%", [T.SWA]: "A", [T.SWB]: "B", [T.SWITCH]: "S", [T.CRUMBLE]: "=" };
const CH_TILE: Record<string, number> = Object.fromEntries(Object.entries(TILE_CH).map(([k, v]) => [v, Number(k)]));
const GATES = "abcdefgh", ARROWS = "^>v<", BELTS = "UVWX", PAINTS = "01234567";
const tileCh = (v: number) => TILE_CH[v] ?? (v >= T.GATE && v < T.GATE + 8 ? GATES[v - T.GATE] : v >= T.ARROW && v < T.ARROW + 4 ? ARROWS[v - T.ARROW] : v >= T.BELT && v < T.BELT + 4 ? BELTS[v - T.BELT] : v >= T.PAINT && v < T.PAINT + 8 ? "P" + PAINTS[v - T.PAINT] : ".");

export function encodeStage(st: Stage): StageRow {
  // paint pads take two characters; everything else one ("P" is never a tile on its own)
  const t = st.tiles.map(tileCh).join("");
  const b = st.blobs.map((v) => (v < 0 ? "." : v === 8 ? "r" : String(v))).join("");
  const row: StageRow = {
    n: st.n, name: st.name, w: st.w, h: st.h, t, b,
    sl: st.slurpers.map((d) => {
      const base: [number, number, number, number, string, string] = [d.x, d.y, d.color, d.need, d.shape, d.cells.map(([x, y]) => `${x}${y}`).join(" ")];
      const fl: SlurperFlags = {};
      if (d.lock !== undefined) fl.lock = d.lock;
      if (d.link !== undefined) fl.link = d.link;
      if (d.mirror !== undefined) fl.mirror = d.mirror;
      if (d.sleep) fl.sleep = true;
      if (d.hungry) fl.hungry = true;
      return Object.keys(fl).length ? [...base, fl] as [number, number, number, number, string, string, SlurperFlags] : base;
    }),
    sol: st.solution.map((g) => `${g.i}:${g.dirs}`),
    m: st.m,
  };
  if (st.bflags?.some((f) => f)) row.bf = st.bflags.map((f) => f.toString(36)).join("");
  if (st.fuse && Object.keys(st.fuse).length) row.fz = st.fuse;
  if (st.fences?.length) row.f = st.fences;
  if (st.portals?.length) row.p = st.portals;
  if (st.crates?.length) row.c = st.crates;
  if (st.mech?.length) row.mech = st.mech;
  return row;
}

export function decodeStage(r: StageRow, lab = labOf(r.n), kind = kindOf(r.n)): Stage {
  const tiles: number[] = [];
  for (let k = 0; k < r.t.length; k++) {
    const ch = r.t[k];
    if (ch === "P") { tiles.push(T.PAINT + Number(r.t[++k])); continue; }
    if (ch in CH_TILE) tiles.push(CH_TILE[ch]);
    else if (GATES.includes(ch)) tiles.push(T.GATE + GATES.indexOf(ch));
    else if (ARROWS.includes(ch)) tiles.push(T.ARROW + ARROWS.indexOf(ch));
    else if (BELTS.includes(ch)) tiles.push(T.BELT + BELTS.indexOf(ch));
    else tiles.push(T.FLOOR);
  }
  const blobs = [...r.b].map((ch) => (ch === "." ? -1 : ch === "r" ? 8 : Number(ch)));
  const N = r.w * r.h;
  const bflags = r.bf ? [...r.bf].map((ch) => parseInt(ch, 36)) : new Array(N).fill(0);
  const slurpers = r.sl.map((row) => {
    const [x, y, color, need, shape, cells, fl] = row as [number, number, number, number, string, string, SlurperFlags?];
    return { x, y, color, need, shape, cells: cells.split(" ").map((p) => [Number(p[0]), Number(p[1])] as [number, number]), ...(fl ?? {}) };
  });
  const s = r.n >= 1 && r.n <= 600 ? stageIn(r.n) : 0;
  return {
    n: r.n, lab: lab.n, s, name: r.name, w: r.w, h: r.h, tiles, blobs, bflags, fuse: r.fz ?? {}, fences: r.f ?? [], portals: r.p ?? [], crates: r.c ?? [], slurpers,
    colors: new Set(slurpers.map((d) => d.color)).size,
    solution: r.sol.map((g) => { const [i, dirs] = g.split(":"); return { i: Number(i), dirs }; }),
    m: r.m, kind, tip: s === 1 ? lab.tip : undefined, mech: r.mech,
  };
}
export { LABS };
