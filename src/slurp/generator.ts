// Slurp Lab: "Plant and Prove". We never place Gloopies at random. We place the Slurpers and the lab's gadgets, walk an
// intended solution across the board with the real rules (each Slurper taking short trips through the cells that are
// free at that moment, pushing crates, riding ice and belts, crossing portals …), and plant each Gloopy in a cell where
// its own Slurper arrives first. Short trips make the Slurpers take turns, so the order matters. Every stage is replayed
// with the real rules before it's kept; the solver and the trap test then grade it.
import { rng, depthOf, scoreOf, trapRate, twinsOf } from "./grader";
import { DIR_CH, initState, move, occupancy, options, pathTo, region } from "./rules";
import { SHAPES, rotations } from "./shapes";
import { solve, verify } from "./solver";
import { BF, DIRS, RAINBOW, T, type Drag, type SlurperDef, type Stage } from "./types";

export interface Recipe {
  n: number; lab: number; s: number;
  w: number; h: number;
  colors: number; slurpers: number;
  pool: string[];
  mask: string;
  walls: number;
  /** mechanics on this stage and how many of each */
  mech: Record<string, number>;
  needMax: number;
  fill: number;
  /** most Gloopies a Slurper plants per trip (small = more turns, harder) */
  perTrip: number;
  /** extra drags of slack a fuse gets */
  fuseSlack: number;
  tries: number; pick: number;
  budget: number;
}

// ------------------------------------------------------------------ board shapes
function applyMask(tiles: number[], W: number, H: number, mask: string, r: () => number) {
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = v; };
  const cx = (W - 1) / 2, cy = (H - 1) / 2;
  switch (mask) {
    case "corners": for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) set(x, y, T.VOID); break;
    case "bigcorners": for (const [x, y] of [[0, 0], [W - 2, 0], [0, H - 2], [W - 2, H - 2]]) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + a, y + b, T.VOID); break;
    case "notch": { const nx = Math.floor(W / 2) - (r() < 0.5 ? 1 : 0); set(nx, 0, T.VOID); set(nx + 1, 0, T.VOID); set(nx, H - 1, T.VOID); set(nx + 1, H - 1, T.VOID); break; }
    case "ring": { const hx = Math.floor(cx), hy = Math.floor(cy); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(hx + a, hy + b, T.WALL); break; }
    case "diamond": for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.abs(x - cx) / (cx + 0.6) + Math.abs(y - cy) / (cy + 0.6) > 1.12) set(x, y, T.VOID); break;
    case "plus": { const kx = Math.max(1, Math.floor(W / 4)), ky = Math.max(1, Math.floor(H / 4)); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x < kx || x >= W - kx) && (y < ky || y >= H - ky)) set(x, y, T.VOID); break; }
    case "steps": for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x + y < Math.floor(Math.min(W, H) / 2.5) || (W - 1 - x) + (H - 1 - y) < Math.floor(Math.min(W, H) / 2.5)) set(x, y, T.VOID); break;
    case "pillars": for (let y = 2; y < H - 2; y += 3) for (let x = 1 + (y % 2); x < W - 1; x += 3) set(x, y, T.WALL); break;
    case "split": { const wx = Math.floor(cx); for (let y = 0; y < H; y++) if (Math.abs(y - cy) > 1.2) set(wx, y, T.WALL); break; }
    case "hall": for (let x = 1; x < W - 1; x++) { if (x !== Math.floor(cx)) { set(x, 2, T.WALL); set(x, H - 3, T.WALL); } } break;
    case "heart": for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x - cx) / (W / 2), v = (cy - y) / (H / 2) + 0.25; if ((u * u + v * v - 0.62) ** 3 - u * u * v * v * v > 0.02) set(x, y, T.VOID); } break;
    case "islands": { const wy = Math.floor(cy); for (let x = 0; x < W; x++) if (x % 3 !== 1) set(x, wy, T.VOID); break; }
    default: break;
  }
}
const walkable = (t: number) => t !== T.WALL && t !== T.VOID;
function connected(tiles: number[], W: number, H: number): boolean {
  const N = W * H, start = tiles.findIndex(walkable);
  if (start < 0) return false;
  const seen = new Uint8Array(N); seen[start] = 1; const q = [start];
  for (let h = 0; h < q.length; h++) { const p = q[h], x = p % W, y = (p - x) / W; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const c = ny * W + nx; if (!seen[c] && walkable(tiles[c])) { seen[c] = 1; q.push(c); } } }
  return q.length === tiles.filter(walkable).length;
}
/** tiles a Gloopy may start on */
const plantable = (t: number) => t === T.FLOOR || t === T.ICE || t === T.CRUMBLE;

// ------------------------------------------------------------------ one candidate
export function makeStage(rc: Recipe, seed: number, relax = 0): Stage | null {
  const r = rng(seed);
  const W = rc.w, H = rc.h, N = W * H, M = rc.mech;
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const pick = <X>(a: X[]) => a[Math.floor(r() * a.length)];
  const tiles = new Array<number>(N).fill(T.FLOOR);
  applyMask(tiles, W, H, rc.mask, r);
  if (!connected(tiles, W, H)) return null;
  for (let k = 0, made = 0; k < rc.walls * 6 && made < rc.walls; k++) {
    const c = ri(0, N - 1); if (tiles[c] !== T.FLOOR) continue;
    tiles[c] = T.WALL; if (connected(tiles, W, H)) made++; else tiles[c] = T.FLOOR;
  }
  const palette = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => r() - 0.5).slice(0, rc.colors);
  const floorCell = (inner = false) => { for (let a = 0; a < 60; a++) { const x = inner ? ri(1, W - 2) : ri(0, W - 1), y = inner ? ri(1, H - 2) : ri(0, H - 1), c = y * W + x; if (tiles[c] === T.FLOOR) return c; } return -1; };
  // ---- the lab's gadgets
  const blockedAt = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || !walkable(tiles[y * W + x]);
  for (let k = 0, made = 0; k < (M.gate ?? 0) * 12 && made < (M.gate ?? 0); k++) {
    const x = ri(1, W - 2), y = ri(1, H - 2), c = y * W + x;
    if (tiles[c] !== T.FLOOR) continue;
    const door = (blockedAt(x - 1, y) && blockedAt(x + 1, y)) || (blockedAt(x, y - 1) && blockedAt(x, y + 1));
    if (!door && r() < 0.7) continue;
    tiles[c] = T.GATE + palette[made % palette.length]; made++;
  }
  for (let k = 0; k < (M.ice ?? 0); k++) { const c = floorCell(); if (c < 0) continue; const x0 = c % W, y0 = (c - x0) / W, w = ri(2, 3), h = ri(2, 4); for (let y = y0; y < Math.min(H, y0 + h); y++) for (let x = x0; x < Math.min(W, x0 + w); x++) if (tiles[y * W + x] === T.FLOOR) tiles[y * W + x] = T.ICE; }
  for (let k = 0; k < (M.goo ?? 0); k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.GOO; }
  for (let k = 0; k < (M.arrow ?? 0); k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.ARROW + ri(0, 3); }
  const portals: [number, number][] = [];
  for (let k = 0; k < (M.portal ?? 0); k++) { for (let a = 0; a < 30; a++) { const p = floorCell(), q = floorCell(); if (p < 0 || q < 0 || p === q) continue; if (Math.abs(p % W - q % W) + Math.abs(Math.floor(p / W) - Math.floor(q / W)) < Math.max(W, H) / 2) continue; tiles[p] = T.PORTAL; tiles[q] = T.PORTAL; portals.push([p, q]); break; } }
  for (let k = 0; k < (M.turn ?? 0); k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.TURN; }
  for (let k = 0; k < (M.belt ?? 0); k++) { const c = floorCell(); if (c < 0) continue; const d = ri(0, 3); let x = c % W, y = (c - x) / W; for (let l = 0, len = ri(3, 5); l < len; l++) { if (x < 0 || y < 0 || x >= W || y >= H || tiles[y * W + x] !== T.FLOOR) break; tiles[y * W + x] = T.BELT + d; x += DIRS[d][0]; y += DIRS[d][1]; } }
  for (let k = 0; k < (M.glass ?? 0); k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.GLASS; }
  if (M.switch) {
    const s0 = floorCell(true); if (s0 >= 0) tiles[s0] = T.SWITCH;
    for (let k = 0; k < M.switch + 1; k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.SWA; }
    for (let k = 0; k < Math.max(1, M.switch - 1); k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.SWB; }
  }
  for (let k = 0; k < (M.paint ?? 0); k++) { const c = floorCell(true); if (c >= 0) tiles[c] = T.PAINT + pick(palette); }
  for (let k = 0; k < (M.crumble ?? 0); k++) { const c = floorCell(); if (c >= 0) tiles[c] = T.CRUMBLE; }
  const fences: number[] = [];
  for (let k = 0; k < (M.fence ?? 0); k++) { const c = floorCell(); if (c < 0) continue; const x = c % W, y = (c - x) / W, d = r() < 0.5 ? 1 : 2; const nx = x + DIRS[d][0], ny = y + DIRS[d][1]; if (nx >= W || ny >= H) continue; const n = ny * W + nx; fences.push(c * 4 + d, n * 4 + ((d + 2) % 4)); }
  const crates: number[] = [];
  for (let k = 0; k < (M.crate ?? 0); k++) { const c = floorCell(true); if (c >= 0 && !crates.includes(c)) crates.push(c); }

  // ---- the Slurpers
  const defs: SlurperDef[] = [];
  const occ0 = new Int16Array(N).fill(-1);
  crates.forEach((c) => (occ0[c] = 99));
  for (let i = 0; i < rc.slurpers; i++) {
    const color = i < rc.colors ? palette[i] : pick(palette);
    let placed = false;
    for (let a = 0; a < 80 && !placed; a++) {
      const shape = pick(a < 50 ? rc.pool : ["dot", "bar2", "bar3", "corner"]), rot = pick(rotations(shape));
      const bw = Math.max(...rot.map((c) => c[0])) + 1, bh = Math.max(...rot.map((c) => c[1])) + 1;
      if (bw > W || bh > H) continue;
      const x = ri(0, W - bw), y = ri(0, H - bh);
      const cells = rot.map(([cx, cy]) => (y + cy) * W + x + cx);
      if (cells.some((c) => tiles[c] !== T.FLOOR || occ0[c] >= 0)) continue;
      if (a < 40 && cells.some((c) => { const cx = c % W, cy = (c - cx) / W; return DIRS.some(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && occ0[ny * W + nx] >= 0; }); })) continue;
      cells.forEach((c) => (occ0[c] = i));
      defs.push({ cells: rot, shape, color, need: 0, x, y });
      placed = true;
    }
    if (!placed && i < 2) return null;
  }
  // flags
  const idx = defs.map((_, i) => i);
  if (M.lock && defs.length > 2) for (let k = 0; k < M.lock; k++) { const i = pick(idx.slice(1)); const keys = palette.filter((c) => c !== defs[i].color && defs.some((d, j) => j !== i && d.color === c && d.lock === undefined)); if (keys.length && defs[i].lock === undefined && !defs[i].sleep) defs[i].lock = pick(keys); }
  if (M.sleep) for (let k = 0; k < M.sleep; k++) { const i = pick(idx.slice(1)); if (defs[i].lock === undefined) defs[i].sleep = true; }
  const pairUp = (key: "link" | "mirror") => { const free = idx.filter((i) => defs[i].link === undefined && defs[i].mirror === undefined && defs[i].lock === undefined && !defs[i].sleep); if (free.length < 2) return; const a = pick(free), rest = free.filter((i) => i !== a && defs[i].color !== defs[a].color); if (!rest.length) return; const b = pick(rest); defs[a][key] = b; defs[b][key] = a; };
  for (let k = 0; k < (M.link ?? 0); k++) pairUp("link");
  for (let k = 0; k < (M.mirror ?? 0); k++) pairUp("mirror");
  if (M.hungry) { const solo = idx.filter((i) => defs.filter((d) => d.color === defs[i].color).length === 1); for (let k = 0; k < M.hungry && solo.length; k++) defs[solo.splice(Math.floor(r() * solo.length), 1)[0]].hungry = true; }

  // ---- walk the intended solution in a board with no Gloopies, planting as each Slurper arrives first
  const floor = tiles.filter(plantable).length;
  const footprint = defs.reduce((a, d) => a + d.cells.length, 0);
  const total = Math.max(defs.length, Math.round((floor - footprint) * rc.fill));
  const wts = defs.map((d) => d.cells.length + r() * 2.5);
  const sw = wts.reduce((a, b) => a + b, 0);
  const quota = wts.map((w) => Math.max(1, Math.min(rc.needMax, Math.round((total * w) / sw))));
  const wanted = quota.reduce((a, b) => a + b, 0);
  const stub: Stage = { n: rc.n, lab: rc.lab, s: rc.s, name: "", w: W, h: H, tiles, blobs: new Array(N).fill(-1), bflags: new Array(N).fill(0), fuse: {}, fences, portals, crates, slurpers: defs.map((d) => ({ ...d, need: 999 })), colors: rc.colors, solution: [], m: { par: 0, planted: 0, events: 0, depth: 0, trap: 0, twins: 0, score: 0 } };
  const sim = initState(stub);
  sim.sl.forEach((q, i) => { q.awake = defs[i].lock === undefined && !defs[i].sleep; });
  const first = new Int16Array(N).fill(-1);
  occupancy(stub, sim).forEach((o, c) => { if (o >= 0) first[c] = o; });
  crates.forEach((c) => (first[c] = -2));
  const planted = new Int8Array(N).fill(-1), bflags = new Array<number>(N).fill(0);
  const got = defs.map(() => 0);
  const walks: Drag[] = [];
  let last = -1;
  const sealStub = (k: number) => {
    const q = sim.sl[k]; if (!q.alive) return;
    q.alive = false;
    for (const [cx, cy] of q.cells) { const c = (q.y + cy) * W + q.x + cx; if (sim.tiles[c] === T.CRUMBLE) sim.tiles[c] = T.VOID; }
    // locks open when every Slurper of the key colour is done
    defs.forEach((d, j) => { if (d.lock !== undefined && !sim.sl[j].awake && !sim.sl.some((qq, m) => qq.alive && qq.color === d.lock && m !== j)) sim.sl[j].awake = true; });
  };
  const plantOn = (k: number, cells: number[], color: number, cap: { left: number }) => {
    for (const c of cells) {
      if (first[c] !== -1) continue;
      first[c] = k;
      if (!plantable(sim.tiles[c]) || got[k] >= quota[k] || cap.left <= 0 || r() > 0.92) continue;
      planted[c] = color; got[k]++; cap.left--;
      // a bomb next to glass blasts it when it's slurped
      if (M.bomb) {
        const x = c % W, y = (c - x) / W; const near: number[] = [];
        for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H && sim.tiles[yy * W + xx] === T.GLASS) near.push(yy * W + xx);
        if (near.length && r() < 0.8) { bflags[c] |= BF.BOMB; near.forEach((n) => (sim.tiles[n] = T.FLOOR)); }
      }
      // a sleeper next to it wakes
      defs.forEach((d, j) => { if (d.sleep && !sim.sl[j].awake) { const q = sim.sl[j]; if (q.cells.some(([cx, cy]) => Math.abs(q.x + cx - c % W) + Math.abs(q.y + cy - Math.floor(c / W)) === 1)) q.awake = true; } });
      if (got[k] >= quota[k]) { sealStub(k); return; }
    }
  };
  for (let round = 0; round < 90 * defs.length; round++) {
    const active = idx.filter((i) => sim.sl[i].alive && sim.sl[i].awake && got[i] < quota[i]);
    if (!active.length) break;
    const choices = active.length > 1 ? active.filter((i) => i !== last) : active;
    const i = pick(choices), q = sim.sl[i];
    const cap = { left: 1 + Math.floor(r() * rc.perTrip) };
    const occ = occupancy(stub, sim), prev = region(stub, sim, occ, i);
    // targets: places in its free region with fresh cells, and gadget moves (push, ride, portal, switch …)
    const freshAt = (x: number, y: number, cells: [number, number][]) => { let n = 0; for (const [cx, cy] of cells) { const c = (y + cy) * W + x + cx; if (c >= 0 && c < N && first[c] < 0 && plantable(sim.tiles[c])) n++; } return n; };
    const cand: { score: number; p: number; opt?: ReturnType<typeof options>[number] }[] = [];
    for (const p of prev.keys()) { const x = p % W, y = (p - x) / W, f = freshAt(x, y, q.cells); if (f) cand.push({ p, score: f * 2 + (Math.abs(x - q.x) + Math.abs(y - q.y)) * (0.6 + r()) }); }
    for (const o of options(stub, sim, i, prev)) {
      const f = o.out.covered.reduce((a, cv) => a + cv.cells.filter((c) => first[c] < 0 && plantable(sim.tiles[c])).length, 0);
      if (f || o.out.changed || o.out.steps.length > 1) cand.push({ p: o.from, score: f * 2 + 2.5 + r() * 2, opt: o });
    }
    if (!cand.length) { quota[i] = got[i]; if (!got[i]) sealStub(i); continue; }
    cand.sort((a, b) => b.score - a.score);
    const c = cand[Math.min(cand.length - 1, Math.floor(r() * Math.min(3, cand.length)))];
    const dirs = [...pathTo(prev, c.p), ...(c.opt ? [c.opt.d] : [])];
    let walked = "";
    for (const d of dirs) {
      if (!sim.sl[i].alive) break;
      const o = move(stub, sim, i, d, true);
      if (!o) break;
      walked += DIR_CH[d];
      for (const f of o.fx) if (f.t === "crate" && first[f.to] === -1) first[f.to] = -2;
      for (const cv of o.covered) plantOn(cv.i, cv.cells, cv.color, cap);
      if (o.stop) break;
    }
    if (walked) walks.push({ i, dirs: walked });
    last = i;
  }

  // ---- the real stage: Slurpers that never got a Gloopy leave
  const keep = defs.map((_, i) => got[i] > 0);
  if (keep.filter(Boolean).length < Math.min(2, defs.length)) return null;
  const remap = new Map<number, number>(); defs.forEach((_, i) => { if (keep[i]) remap.set(i, remap.size); });
  const finalDefs: SlurperDef[] = [];
  defs.forEach((d, i) => {
    if (!keep[i]) return;
    const nd: SlurperDef = { cells: d.cells, shape: d.shape, color: d.color, need: got[i], x: d.x, y: d.y };
    if (d.lock !== undefined) nd.lock = d.lock;
    if (d.sleep) nd.sleep = true;
    if (d.hungry) nd.hungry = true;
    if (d.link !== undefined && remap.has(d.link)) nd.link = remap.get(d.link);
    if (d.mirror !== undefined && remap.has(d.mirror)) nd.mirror = remap.get(d.mirror);
    finalDefs.push(nd);
  });
  const blobs = Array.from(planted);
  // a tray should be full of Gloopies: at least two per Slurper and most of what was wanted
  if (blobs.filter((b) => b >= 0).length < (relax ? Math.max(3, finalDefs.length * (relax > 1 ? 1 : 1.5), wanted * (relax > 1 ? 0.3 : 0.45)) : Math.max(3, finalDefs.length * 2, wanted * 0.6))) return null;
  const st: Stage = { ...stub, blobs, bflags, slurpers: finalDefs, colors: new Set(finalDefs.map((d) => d.color)).size };
  // replay the walks with the real rules: keep the steps that happen; note when each Gloopy is slurped
  const replay = (stage: Stage, rec?: { drag: Int16Array; eater: Int16Array }) => {
    const s = initState(stage), sol: Drag[] = [];
    let stopped = true;
    for (const w of walks) {
      const i = remap.get(w.i);
      if (i === undefined || !s.sl[i].alive) continue;
      let dirs = "";
      const l = sol[sol.length - 1];
      const cont = !!l && l.i === i && !stopped;
      const dragNo = cont ? sol.length : sol.length + 1;
      stopped = false;
      for (const ch of w.dirs) {
        if (!s.sl[i].alive) break;
        const o = move(stage, s, i, DIR_CH.indexOf(ch));
        if (!o) return null;
        dirs += ch;
        if (rec) for (const e of o.eats) for (const c of e.cells) { rec.drag[c] = dragNo; rec.eater[c] = e.i; }
        if (o.stop) { stopped = true; break; }
      }
      if (!dirs) continue;
      if (cont) l.dirs += dirs; else sol.push({ i, dirs });
    }
    return s.blobs.some((b) => b >= 0) ? null : sol;
  };
  const rec = { drag: new Int16Array(N).fill(0), eater: new Int16Array(N).fill(-1) };
  if (!replay(st, rec)) return null;
  // ---- Gloopy twists, decided from when each one is slurped
  const fuse: Record<number, number> = {};
  for (let c = 0; c < N; c++) {
    if (blobs[c] < 0) continue;
    const x = c % W, y = (c - x) / W;
    if (M.bubble && r() < M.bubble / 10) { const earlier = DIRS.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false; const n = ny * W + nx; return blobs[n] >= 0 && rec.drag[n] < rec.drag[c]; }); if (earlier) bflags[c] |= BF.BUBBLE; }
    if (M.double && r() < M.double / 10 && !(bflags[c] & BF.BUBBLE) && rec.eater[c] >= 0) { bflags[c] |= BF.DOUBLE; finalDefs[rec.eater[c]].need += 1; }
    if (M.rainbow && r() < M.rainbow / 12) blobs[c] = RAINBOW;
    if (M.frost && r() < M.frost / 8) bflags[c] |= BF.FROST;
    if (M.fuse && r() < M.fuse / 12 && Object.keys(fuse).length < 4) { bflags[c] |= BF.FUSE; fuse[c] = rec.drag[c] + rc.fuseSlack; }
  }
  st.blobs = blobs; st.bflags = bflags; st.fuse = fuse;
  const sol = replay(st);
  if (!sol || !verify(st, initState(st), sol)) return null;
  st.solution = sol;
  st.mech = Object.keys(M).filter((k) => M[k] > 0);
  return st;
}

/** grade a candidate: par (solver), the trap test, order chains, twins → score */
export function grade(st: Stage, budget: number): Stage {
  const start = initState(st);
  // the full solver only finds a shorter par on small trays (≤ 4 Slurpers); on bigger ones it spends ~90% of the forge
  // time and never beats the planted solution, so par = planted there
  const sv = st.slurpers.length <= 4 ? solve(st, start, budget) : { solved: false, drags: [] };
  const par = sv.solved ? Math.min(sv.drags.length, st.solution.length) : st.solution.length;
  const events = st.solution.reduce((a, g) => a + g.dirs.length, 0);
  const trap = trapRate(st, 50, st.n);
  const depth = depthOf(st, start, st.solution);
  const twins = twinsOf(st);
  const blobs = st.blobs.filter((b) => b >= 0).length;
  const m = { par, planted: st.solution.length, events, depth, trap: Math.round(trap * 100) / 100, twins };
  st.m = { ...m, score: Math.round(scoreOf(m, st.colors, blobs, st.mech?.length ?? 0) * 10) / 10 };
  return st;
}

/** make `tries` candidates and keep the one at `pick` (0 = the easiest … 1 = the hardest) */
export function forge(rc: Recipe): Stage {
  const out: Stage[] = [];
  // a hard recipe sometimes can't be met: relax the fill, then keep only the lab's own idea
  for (let relax = 0; relax < 3 && !out.length; relax++) {
    const r2 = relax < 2 ? rc : { ...rc, mech: Object.fromEntries(Object.entries(rc.mech).slice(0, relax === 2 ? 2 : 99)) };
    for (let k = 0; out.length < rc.tries && k < rc.tries * 10; k++) {
      const st = makeStage(r2, rc.n * 7919 + k * 104729 + relax * 31337, relax);
      if (st) out.push(grade(st, rc.budget));
    }
  }
  if (!out.length) throw new Error(`stage ${rc.n}: no candidate`);
  out.sort((a, b) => a.m.score - b.m.score);
  return out[Math.min(out.length - 1, Math.round(rc.pick * (out.length - 1)))];
}
export { SHAPES };
