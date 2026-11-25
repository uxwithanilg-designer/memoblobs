// Gizmo Drive's courses: a stage plan (src/gizmo/stages.ts) becomes a short obstacle course built left to right from
// modules — the classics (rolling hills, bumps, jump ramps, drops, steps, steep towers, half-pipes, low tunnels, ice
// slides) and the contraptions (seesaws, crumbling bridges, lifts, moving platforms, conveyor belts, launch pads,
// button gates, drawbridges, wrecking balls, crushers, ball pits, loops, crate walls, fans, wobbly bridges, giant
// gears). Every module sizes itself to the ride (its speed, length and height), the gravity and the difficulty:
// a jump's gap is worked out from the speed the ride can really reach, a lift's shaft from the car's length, a
// tunnel's ceiling from its height. Each module also leaves behind:
//   - coins (along the ideal line: a jump's coins trace the arc you should fly), and spots for fuel, hearts, powers;
//   - hints for the QA bot (src/gizmo/bot.ts) saying how a careful driver takes it (hold 7 m/s, wait for the lift…);
//   - camera zones (the cinematic framing of big contraptions);
//   - checkpoints between modules.
// Everything is seeded by the stage, so every player gets the same course. No DOM: Node runs it for the QA sweep.
import { Body, BALL, F_ICE, F_ONE, KINEMATIC, PIVOT, STATIC, World, type Motion } from "./physics";
import { stagePlan, type StagePlan } from "./stages";
import { worldOf, type ModuleKind, type WorldDef } from "./worlds";
import { topSpeed, vehicleOf, type VehicleSpec } from "./vehicles";
import { clamp, makeRng, range, type Rng } from "./util";

export type PowerId = "turbo" | "shield" | "magnet" | "float" | "grip";
export const POWERS: { id: PowerId; secs: number; name: string; color: string }[] = [
  { id: "turbo", secs: 5, name: "Turbo!", color: "#FF8A3D" },
  { id: "shield", secs: 14, name: "Helmet shield!", color: "#38BDF8" },
  { id: "magnet", secs: 14, name: "Coin magnet!", color: "#FF4F7A" },
  { id: "float", secs: 9, name: "Floaty jumps!", color: "#A78BFA" },
  { id: "grip", secs: 14, name: "Sticky tyres!", color: "#3EE08F" },
];
export const powerOf = (id: PowerId) => POWERS.find((p) => p.id === id)!;

export interface Item { kind: "coin" | "star" | "fuel" | "heart" | "power"; power?: PowerId; x: number; y: number; x0: number; y0: number; taken: boolean; ph: number }
/** the ground and blocks: a polygon, and the walkable top line (for the grass cap) */
export interface Solid { pts: number[]; top: number[]; kind: "ground" | "block" | "ceiling" | "ice" | "belt"; belt?: number }
/** things drawn that aren't bodies: belts, fans, loops, buttons, frames, signs, start and finish */
export interface Deco { k: string; x: number; y: number; w: number; h: number; a: number; b: number }
/** scenery along the course (art picks the world's prop by `seed`) */
export interface Prop { x: number; y: number; s: number; seed: number; back: boolean; flip: boolean }
export interface Pit { x0: number; x1: number; lip: number; kill: number }
export interface CamZone { x0: number; x1: number; fx: number; fy: number; z: number }
export type Hint =
  | { k: "cap"; x0: number; x1: number; v: number }
  | { k: "speed"; x0: number; x1: number; v: number }
  | { k: "go"; x0: number; x1: number }
  | { k: "ride"; x0: number; x1: number; body: number; xWait: number; board: [number, number]; leave: [number, number] }
  | { k: "gate"; x0: number; x1: number; body: number; xWait: number }
  | { k: "timed"; x0: number; x1: number; bodies: number[]; xWait: number; xClear: number; v: number };

export interface Course {
  plan: StagePlan;
  world: WorldDef;
  vehicle: VehicleSpec;
  physics: World;
  g: number;
  solids: Solid[];
  decos: Deco[];
  props: Prop[];
  items: Item[];
  hints: Hint[];
  cams: CamZone[];
  pits: Pit[];
  checkpoints: { x: number; y: number }[];
  start: { x: number; y: number };
  finish: { x: number; y: number };
  bottom: number;
  top: number;
  /** what each module is, and where (the HUD's gizmo icons, the art's warning signs) */
  modules: { k: ModuleKind; x0: number; x1: number }[];
  /** the ground's height at x (the highest run top; NaN over a pit) */
  heightAt: (x: number) => number;
}

const DEG = Math.PI / 180;
const DEEP = 34;

/** the launch speed that lands a jump D metres on, `drop` metres lower, from a ramp at angle th */
export function launchSpeed(D: number, th: number, drop: number, g: number) {
  const den = 2 * Math.cos(th) ** 2 * (D * Math.tan(th) + drop);
  return den > 0 ? Math.sqrt((g * D * D) / den) : Infinity;
}

/** a corner path with rounded corners (radius rf), sampled every ~0.35 m */
function filleted(pts: [number, number][], rf: number): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    let ax = x1 - x0, ay = y1 - y0, bx = x2 - x1, by = y2 - y1;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    ax /= la; ay /= la; bx /= lb; by /= lb;
    const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    if (Math.abs(turn) < 0.02) { out.push(pts[i]); continue; }
    let t = rf * Math.tan(Math.abs(turn) / 2);
    t = Math.min(t, la * 0.48, lb * 0.48);
    const r = t / Math.tan(Math.abs(turn) / 2);
    const sx = x1 - ax * t, sy = y1 - ay * t;
    const sgn = turn > 0 ? 1 : -1;
    const cx = sx - ay * r * sgn, cy = sy + ax * r * sgn;
    const a0 = Math.atan2(sy - cy, sx - cx);
    const steps = Math.max(2, Math.ceil((Math.abs(turn) * r) / 0.35));
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (turn * k) / steps;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const motion = (k: Motion["k"], o: Partial<Motion>): Motion => ({ k, dx: 0, dy: 0, da: 0, period: 1, phase: 0, hold: 0, ...o });

// ================================================================== the builder
class Builder {
  x = 0; y = 0;
  run: number[] = [];
  runKind: Solid["kind"] = "ground";
  runFlags = 0; runBelt = 0;
  runs: number[][] = [];
  w = new World();
  b0: Body;
  solids: Solid[] = [];
  decos: Deco[] = [];
  items: Item[] = [];
  hints: Hint[] = [];
  cams: CamZone[] = [];
  pits: Pit[] = [];
  spots: { x: number; y: number; after: number }[] = [];
  specials: { x: number; y: number }[] = [];
  modules: { k: ModuleKind; x0: number; x1: number }[] = [];
  V: number; L: number; H: number; g: number;

  constructor(public v: VehicleSpec, public r: Rng, public d: number, g: number) {
    this.b0 = this.w.bodies[0];
    this.g = g;
    this.w.g = g;
    this.V = topSpeed(v);
    this.L = v.chassis.w;
    this.H = v.head.y + v.head.r - v.anchors[0][1] + v.wheels[0].rest + v.wheels[0].r;
  }
  get rr() { return this.r; }
  R(a: number, b: number) { return range(this.r, a, b); }

  // ---------------------------------------------------------------- ground runs
  pt(x: number, y: number) {
    if (!this.run.length) this.run.push(this.x, this.y);
    this.run.push(x, y);
    this.x = x; this.y = y;
  }
  flat(len: number) { this.pt(this.x + len, this.y); }
  /** a path of corner points from the cursor, rounded */
  path(pts: [number, number][], rf: number) {
    const all = filleted([[this.x - 2, this.y], [this.x, this.y], ...pts], rf);
    for (let i = 2; i < all.length; i++) this.pt(all[i][0], all[i][1]);
  }
  /** close the current run into a ground polygon */
  cut() {
    if (this.run.length >= 4) {
      const top = this.run.slice();
      let lo = Infinity;
      for (let i = 1; i < top.length; i += 2) lo = Math.min(lo, top[i]);
      const x0 = top[0], x1 = top[top.length - 2];
      const pts = [...top, x1, lo - DEEP, x0, lo - DEEP];
      this.w.poly(this.b0, pts, true, this.runFlags, this.runFlags & F_ICE ? 0.1 : 1, this.runBelt);
      this.solids.push({ pts, top, kind: this.runKind, belt: this.runBelt || undefined });
      this.runs.push(top);
    }
    this.run = [];
    this.runKind = "ground"; this.runFlags = 0; this.runBelt = 0;
  }
  /** jump the cursor (after a cut) */
  moveTo(x: number, y: number) { this.x = x; this.y = y; }
  heightAt(x: number) {
    let best = NaN;
    const test = (t: number[]) => {
      if (t.length < 4 || x < t[0] || x > t[t.length - 2]) return;
      for (let i = 0; i + 3 < t.length; i += 2) {
        const ax = t[i], bx = t[i + 2];
        if (x >= ax && x <= bx) {
          const y = bx - ax < 1e-6 ? Math.max(t[i + 1], t[i + 3]) : t[i + 1] + ((x - ax) / (bx - ax)) * (t[i + 3] - t[i + 1]);
          if (!(y <= best)) best = y;
        }
      }
    };
    for (const t of this.runs) test(t);
    test(this.run);
    return best;
  }

  // ---------------------------------------------------------------- pieces
  rect(b: Body, x0: number, y0: number, x1: number, y1: number, ch = 0.06) {
    const pts = [x0 + ch, y0, x1 - ch, y0, x1, y0 + ch, x1, y1 - ch, x1 - ch, y1, x0 + ch, y1, x0, y1 - ch, x0, y0 + ch];
    return this.w.poly(b, pts, true);
  }
  block(x0: number, y0: number, x1: number, y1: number, kind: Solid["kind"] = "block") {
    const pts = [x0, y0, x1, y0, x1, y1, x0, y1];
    this.w.poly(this.b0, pts, true);
    this.solids.push({ pts, top: kind === "ceiling" ? [] : [x0, y1, x1, y1], kind });
  }
  deco(k: string, x: number, y: number, w = 0, h = 0, a = 0, b = 0) { this.decos.push({ k, x, y, w, h, a, b }); }
  pit(x0: number, x1: number, lip: number, depth = 3.4) { this.pits.push({ x0, x1, lip, kill: lip - depth }); }
  coin(x: number, y: number, kind: Item["kind"] = "coin") { this.items.push({ kind, x, y, x0: x, y0: y, taken: false, ph: this.r() * 6.28 }); }
  /** a row of coins over the ground */
  coinRow(x0: number, x1: number, up = 1.15, gap = 1.5) {
    for (let x = x0; x <= x1 + 1e-6; x += gap) { const h = this.heightAt(x); if (Number.isFinite(h)) this.coin(x, h + up); }
  }
  hint(h: Hint) { this.hints.push(h); }
  cam(x0: number, x1: number, fx: number, fy: number, z: number) { this.cams.push({ x0, x1, fx, fy, z }); }
  kin(x: number, y: number, tag: string, m: Motion | null, a = 0) {
    const b = this.w.addBody(KINEMATIC, x, y, a);
    b.tag = tag; b.motion = m;
    return b;
  }

  // ================================================================ the modules
  hills() {
    const r = this.r, d = this.d;
    this.flat(3);
    const n = 2 + (r() < 0.5 ? 1 : 0);
    const x0 = this.x, y0 = this.y;
    let curv = 0;
    let x = x0;
    const rise = (r() - 0.45) * 3;
    const total = n * 14.5;
    for (let i = 0; i < n; i++) {
      const lam = this.R(12, 17), amp = (0.85 + 1.0 * d) * this.R(0.8, 1.15) * (i % 2 && r() < 0.4 ? -0.6 : 1);
      curv = Math.max(curv, Math.abs(amp) * 0.5 * (2 * Math.PI / lam) ** 2);
      for (let s = 0.5; s <= lam + 1e-6; s += 0.5) {
        const u = (x + s - x0) / total;
        this.pt(x + s, y0 + (amp * (1 - Math.cos((2 * Math.PI * s) / lam))) / 2 + rise * clamp(u, 0, 1) * clamp(u, 0, 1) * (3 - 2 * clamp(u, 0, 1)));
      }
      x += lam;
    }
    const vc = clamp(0.92 * Math.sqrt(this.g / Math.max(curv, 0.01)), 4.5, this.V);
    this.hint({ k: "cap", x0: x0 - 2, x1: this.x, v: vc });
    this.coinRow(x0 + 2, this.x - 2, 1.2, 1.6);
  }

  bumps() {
    const d = this.d;
    this.flat(4);
    const x0 = this.x, y = this.y;
    const n = 4 + Math.floor(4 * d + this.r() * 2);
    const rmin = Math.min(this.v.wheels[0].r, this.v.wheels[1].r);
    const hb = Math.min((0.3 + 0.28 * d) * clamp(rmin / 0.44, 0.8, 1.5), rmin * 0.85);
    for (let i = 0; i < n; i++) {
      const wb = this.R(1.7, 2.4), hh = hb * this.R(0.75, 1.15);
      for (let s = 0.25; s <= wb + 1e-6; s += 0.25) this.pt(this.x + 0.25, y + hh * Math.sin((Math.PI * s) / wb) ** 2);
      this.flat(this.R(1.1, 2.6));
    }
    this.hint({ k: "cap", x0: x0 - 3, x1: this.x, v: clamp(6.2 - 3 * d, 3.2, 6) * (this.v.id === "bus" ? 0.75 : 1) });
    this.coinRow(x0 + 1, this.x - 1, 1.5, 1.8);
  }

  kicker() {
    const d = this.d, g = this.g;
    const th = (13 + 10 * d + this.R(-2, 2)) * DEG;
    const rampL = this.R(3.6, 4.8);
    const hr = rampL * Math.tan(th);
    const drop = this.r() < 0.55 ? this.R(0.3, 1.0 + 1.6 * d) : this.R(-0.3, 0.3);
    // the jump wants a controlled speed — well under flat out — so flooring it overshoots the landing pad
    // (in low gravity the tyres push less, so the jump asks for a speed the ride can still reach on the run-up)
    const vs = Math.min(clamp((0.5 + 0.16 * d) * this.V * this.R(0.95, 1.05), 5.5, 0.72 * this.V), 8.6 * Math.sqrt(g / 10) + 2.4);
    const c2 = Math.cos(th) ** 2, A = 2 * vs * vs * c2 * Math.tan(th), Bq = 2 * vs * vs * c2 * drop;
    const D = (A + Math.sqrt(Math.max(0, A * A + 4 * g * Bq))) / (2 * g);
    const G = Math.max(2.4, D - 3.1);
    this.flat(14);
    const xr = this.x;
    this.path([[this.x + rampL, this.y + hr]], 3);
    const lipX = this.x, lipY = this.y;
    this.cut();
    const landY = lipY - drop;
    this.pit(lipX, lipX + G, Math.min(lipY, landY), 3.6);
    // a bevelled lip: a landing a touch short rolls up onto the pad instead of hitting a wall
    this.moveTo(lipX + G, landY - 0.4);
    this.pt(lipX + G + 0.8, landY);
    // the landing pad, then a drop to the ground below (overshoot it and you fly much further); floatier in low gravity
    const pad = (this.L + 4.6 + 3 * (1 - d)) * clamp(Math.sqrt(10 / g), 1, 1.5);
    this.flat(pad);
    const dh = this.R(1.6, 2.2 + 1.6 * d), cx = this.x;
    this.pt(cx, landY - dh * 0.45);
    const len = (dh * 0.55) / Math.tan(24 * DEG);
    this.path([[cx + len, landY - dh], [cx + len + 6, landY - dh]], 3);
    // coins trace the arc to fly
    const vx = vs * Math.cos(th), vy = vs * Math.sin(th);
    const tl = D / vx;
    for (let t = 0.15; t < tl; t += 0.13) this.coin(lipX + vx * t, lipY + 1.05 + vy * t - 0.5 * g * t * t);
    const ta = vy / g;
    this.specials.push({ x: lipX + vx * ta, y: lipY + 2.2 + vy * ta - 0.5 * g * ta * ta });
    this.hint({ k: "speed", x0: xr - 12, x1: lipX + G + 2, v: vs * 1.05 + 0.15 });
    this.hint({ k: "cap", x0: lipX + G + 2, x1: cx + len, v: clamp(4.6 + dh * 0.45, 4.5, this.V * 0.7) });
    if (G > 6) this.cam(xr - 4, lipX + G + 4, lipX + G * 0.5, lipY + 1.5, 0.82);
    this.deco("sign", xr - 5, this.heightAt(xr - 5), 0, 0, 1);
  }

  drop() {
    const d = this.d;
    const H = this.R(1.6, 2.4 + 2.6 * d);
    this.flat(9);
    const cx = this.x, cy = this.y;
    this.pt(cx, cy - H * 0.42);
    const len = (H * 0.58) / Math.tan(24 * DEG);
    this.path([[cx + len, cy - H], [cx + len + 7, cy - H]], 3);
    this.hint({ k: "speed", x0: cx - 8, x1: cx + len, v: clamp(4.6 + H * 0.45, 4.5, this.V * 0.7) });
    this.coinRow(cx + 1.5, cx + len + 4, 1.6, 1.2);
    this.deco("sign", cx - 4, cy, 0, 0, 2);
  }

  steps() {
    const d = this.d;
    const up = this.r() < 0.6;
    const n = 2 + Math.floor(2 * d + this.r());
    const x0 = this.x;
    this.flat(3);
    for (let i = 0; i < n; i++) {
      if (up) {
        // a bevelled riser the front wheel can climb from a crawl
        const sh = Math.min((0.22 + 0.2 * d) * this.R(0.85, 1.1), this.v.wheels[1].r * 0.72);
        this.pt(this.x + sh * 0.75, this.y + sh);
      } else {
        const sh = this.R(0.5, 0.6 + 0.7 * d);
        this.pt(this.x, this.y - sh);
      }
      this.flat(this.R(2.8, 3.8));
    }
    this.flat(2);
    this.hint({ k: "cap", x0: x0 - 3, x1: this.x, v: up ? 4.5 : clamp(6.5 - 2 * d, 4, 6.5) });
    this.coinRow(x0 + 2, this.x - 1, 1.3, 1.5);
  }

  tower() {
    const d = this.d;
    const ang = (24 + 11 * d) * DEG, Ht = this.R(2.5, 3.4 + 2.4 * d), plat = this.R(3.2, 5);
    const down = (22 + 12 * d) * DEG, endDrop = this.r() < 0.5 ? 0 : this.R(0.5, 2);
    this.flat(4);
    const x0 = this.x, y0 = this.y;
    const lu = Ht / Math.tan(ang), ld = (Ht + endDrop) / Math.tan(down);
    this.path([[x0 + lu, y0 + Ht], [x0 + lu + plat, y0 + Ht], [x0 + lu + plat + ld, y0 - endDrop], [x0 + lu + plat + ld + 6, y0 - endDrop]], 2.4);
    this.hint({ k: "cap", x0: x0 - 3, x1: x0 + lu * 0.7, v: 7 });
    this.hint({ k: "cap", x0: x0 + lu * 0.7, x1: x0 + lu + plat + ld + 2, v: clamp(4.5 - d, 3.2, 4.5) });
    this.coinRow(x0 + lu + 0.5, x0 + lu + plat - 0.5, 1.2, 1.2);
    this.specials.push({ x: x0 + lu + plat / 2, y: y0 + Ht + 2.4 });
  }

  seesaw() {
    const d = this.d;
    this.flat(6);
    const Lp = clamp(this.L * 2.5 + 2.4, 7.5, 12), th = 0.24;
    const al = (11 + 6 * d) * DEG, half = Lp / 2;
    const y = this.y;
    // a little wedge onto the plank's end
    this.pt(this.x + 0.7, y + th * 0.9);
    const xa = this.x - 0.25;
    this.cut();
    const px = xa + half * Math.cos(al), py = y + th / 2 + half * Math.sin(al) + 0.02;
    const xb = px + half * Math.cos(al);
    const b = this.w.addBody(PIVOT, px, py, al);
    b.tag = "seesaw";
    this.rect(b, -half, -th / 2, half, th / 2, 0.08);
    b.m = 80 + Lp * 7; b.I = (b.m * Lp * Lp) / 12; b.invI = 1 / b.I; b.invM = 0;
    b.comx = -0.28; b.lo = -al; b.hi = al; b.damp = 220;
    b.d = { len: Lp, th };
    this.pit(xa + 0.25, xb - 0.3, y, 3.6);
    this.deco("pillar", px, py, 0.5, py - (y - 4));
    this.moveTo(xb - 0.3, y);
    this.flat(7);
    this.hint({ k: "cap", x0: xa - 7, x1: xb + 2, v: clamp(3.6 - d * 0.8, 2.6, 3.6) });
    for (let i = -1; i <= 1; i++) this.coin(px + i * 1.3, py + 1.6 + (i === 0 ? 0.4 : 0));
    this.specials.push({ x: px, y: py + 3.2 });
    this.cam(xa - 3, xb + 2, px, py + 0.5, 0.88);
  }

  collapse() {
    const d = this.d;
    this.flat(9);
    const n = 4 + Math.floor(4 * d + this.r() * 2), pw = 1.85, gp = 0.05, th = 0.32;
    const x0 = this.x, y = this.y;
    this.cut();
    const delay = clamp(0.75 - 0.35 * d, 0.38, 0.75);
    for (let i = 0; i < n; i++) {
      const b = this.kin(x0 + gp + i * (pw + gp) + pw / 2, y - th / 2, "plank", motion("fall", { period: delay }));
      this.rect(b, -pw / 2, -th / 2, pw / 2, th / 2, 0.05);
      b.d = { w: pw, th, i };
    }
    const x1 = x0 + gp + n * (pw + gp);
    this.pit(x0, x1, y, 3.6);
    this.deco("posts", x0, y, x1 - x0, 1.2);
    this.moveTo(x1, y);
    this.flat(8);
    this.hint({ k: "go", x0: x0 - 7, x1: x1 + 2 });
    for (let x = x0 + 1; x < x1; x += 1.4) this.coin(x, y + 1.3);
  }

  lift() {
    const d = this.d;
    this.flat(7);
    const Hl = this.R(2.6, 3.4 + 2.4 * d), Ws = this.L + 1.9, xs = this.x, y = this.y;
    this.cut();
    const per = this.R(8, 9.5), hold = 0.27;
    const b = this.kin(xs + Ws / 2, y - 0.25, "lift", motion("osc", { dy: Hl, period: per, hold, phase: this.r() }));
    this.rect(b, -(Ws - 0.24) / 2, -0.25, (Ws - 0.24) / 2, 0.25, 0.06);
    b.d = { w: Ws - 0.24, h: Hl };
    this.pit(xs, xs + Ws, y, 3.2);
    this.deco("shaft", xs, y, Ws, Hl);
    this.moveTo(xs + Ws, y + Hl);
    this.flat(8);
    this.hint({ k: "ride", x0: xs - this.L / 2 - 13, x1: xs + Ws + 2, body: b.id, xWait: xs - this.L / 2 - 1.1, board: [0, hold * 0.2], leave: [0.5 + 0.02, 0.5 + hold] });
    this.cam(xs - 5, xs + Ws + 3, xs + Ws / 2, y + Hl / 2 + 1, 0.85);
    this.coin(xs + Ws / 2, y + Hl + 1.4, "star");
    this.coinRow(xs + Ws + 1.5, xs + Ws + 6, 1.15, 1.5);
  }

  slider() {
    const d = this.d;
    this.flat(7);
    const Lpl = this.L + 2.3, Wp = Lpl + this.R(4, 4.5 + 5 * d), xs = this.x, y = this.y;
    this.cut();
    const dx = Wp - Lpl - 0.24;
    const per = clamp(dx / 1.1 + 4.5, 8, 11), hold = 0.25;
    const b = this.kin(xs + 0.12 + Lpl / 2, y - 0.25, "slider", motion("osc", { dx, period: per, hold, phase: this.r() }));
    this.rect(b, -Lpl / 2, -0.25, Lpl / 2, 0.25, 0.06);
    b.d = { w: Lpl, dx };
    this.pit(xs, xs + Wp, y, 3.6);
    this.moveTo(xs + Wp, y);
    this.flat(8);
    this.hint({ k: "ride", x0: xs - this.L / 2 - 13, x1: xs + Wp + 2, body: b.id, xWait: xs - this.L / 2 - 1.1, board: [0, hold * 0.2], leave: [0.5 + 0.02, 0.5 + hold] });
    this.cam(xs - 4, xs + Wp + 3, xs + Wp / 2, y + 1.2, 0.85);
    for (let x = xs + 2; x < xs + Wp - 1; x += 1.5) this.coin(x, y + 2.6);
  }

  conveyor() {
    const d = this.d;
    this.flat(6);
    this.cut();
    const len = this.R(10, 12 + 6 * d), ang = this.R(4, 8 + 6 * d) * DEG, vb = -(2 + 3.2 * d);
    const x0 = this.x, y0 = this.y;
    this.runKind = "belt"; this.runBelt = vb;
    this.pt(x0 + len, y0 + len * Math.tan(ang));
    this.cut();
    this.moveTo(x0 + len, y0 + len * Math.tan(ang));
    this.flat(7);
    this.hint({ k: "go", x0: x0 - 4, x1: x0 + len + 1 });
    this.coinRow(x0 + 1, x0 + len - 1, 1.2, 1.4);
  }

  spring() {
    const d = this.d, g = this.g;
    this.flat(7);
    const Hs = this.R(3, 3.4 + 2.4 * d), pw = 2.6, y = this.y;
    const xp = this.x;
    this.pt(xp, y - 0.5); this.pt(xp + pw, y - 0.5); this.pt(xp + pw, y);
    const b = this.kin(xp + pw / 2, y - 0.25, "pad", null);
    this.rect(b, -pw / 2 + 0.05, -0.25, pw / 2 - 0.05, 0.25, 0.05);
    b.d = { spring: Math.sqrt(2 * g * (Hs + 2.5)), push: 3.6 + 0.5 * this.L, w: pw - 0.1 };
    this.flat(1.2 + 0.45 * this.L);
    const xw = this.x;
    this.pt(xw, y + Hs);
    this.flat(8);
    this.hint({ k: "speed", x0: xp - 7, x1: xw + 2, v: 2.7 });
    this.hint({ k: "cap", x0: xp - 7, x1: xw + 2, v: 3.2 });
    this.cam(xp - 4, xw + 4, xw - 1, y + Hs / 2 + 1.5, 0.82);
    for (let k = 0; k < 4; k++) this.coin(xp + pw / 2 + 0.6, y + 2 + k * 1.2);
    this.coin(xw + 2.5, y + Hs + 1.2, "star");
  }

  gate() {
    const d = this.d;
    this.flat(5);
    const xb = this.x + 0.8, y = this.y;
    this.deco("button", xb, y, 1.4, 0, this.w.buttons.length);
    this.flat(6.5 + 4 * d);
    const xg = this.x + 0.4;
    const per = 1.4 + 1.2 * d;
    const b = this.kin(xg, y, "gate", motion("trig", { dy: 4.6, period: per }));
    this.rect(b, -0.32, 0.02, 0.32, 3.9, 0.06);
    b.d = { h: 3.9 };
    this.w.buttons.push({ x: xb, y, w: 1.4, targets: [b.id], pressed: 0 });
    this.deco("housing", xg, y, 1.4, 8.8);
    this.flat(7);
    this.hint({ k: "cap", x0: xb - 5, x1: xg - this.L / 2 - 1, v: 4 });
    this.hint({ k: "gate", x0: xb, x1: xg + 2, body: b.id, xWait: xg - this.L / 2 - 1.4 });
    this.coinRow(xb + 1.5, xg - 2, 1.2, 1.3);
  }

  drawbridge() {
    const d = this.d;
    this.flat(4);
    const xb = this.x + 0.8, y = this.y;
    this.deco("button", xb, y, 1.4, 0, this.w.buttons.length);
    this.flat(4.5);
    const Wd = clamp(this.R(4.5, 5 + 3 * d), 4.5, 8.5), xs = this.x;
    this.cut();
    const xh = xs + Wd;
    const per = 1.5 + 0.8 * d;
    const b = this.kin(xh, y, "bridge", motion("trig", { da: Math.PI / 2, period: per }), -Math.PI / 2);
    this.rect(b, -(Wd + 0.45), -0.36, 0.1, 0, 0.05);
    b.d = { len: Wd + 0.55 };
    this.w.buttons.push({ x: xb, y, w: 1.4, targets: [b.id], pressed: 0 });
    this.pit(xs, xh, y, 3.6);
    this.deco("hinge", xh, y, 0, Wd);
    this.moveTo(xh, y);
    this.flat(8);
    this.hint({ k: "cap", x0: xb - 5, x1: xs, v: 4 });
    this.hint({ k: "gate", x0: xb, x1: xh + 2, body: b.id, xWait: xs - this.L / 2 - 0.9 });
    this.cam(xb - 3, xh + 4, xs + Wd / 2, y + 1.6, 0.9);
    this.coin(xs + Wd / 2, y + 1.5, "star");
  }

  wrecker() {
    const d = this.d;
    this.flat(4);
    const Lc = this.R(6, 7.5), rb = this.R(0.85, 1.05), y = this.y;
    // at the bottom of its swing it skims the car's roof; at the ends it's well above it
    const A = this.R(0.85, 1.05);
    const reach = Lc * Math.sin(A) + rb;
    const P = this.R(5.2, 6.2);
    const low = y + this.H - 0.55 + rb;
    // on the harder stages two of them, swinging in a wave you can ride through
    const n = d > 0.72 && this.r() < 0.55 ? 2 : 1, sp = reach * 2 + 3.5;
    const vPass = Math.min(0.85 * this.V, 8.5), ph0 = this.r();
    const xw = this.x + reach + 6;
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const ph = (((ph0 - (i * sp) / vPass / P) % 1) + 1) % 1;
      const b = this.kin(xw + i * sp, low + Lc, "wrecker", motion("pend", { da: A, period: P, phase: ph }));
      b.circ.push(0, -Lc, rb);
      b.d = { len: Lc, r: rb };
      this.deco("crane", xw + i * sp, y, Lc, low + Lc - y);
      ids.push(b.id);
    }
    const xe = xw + (n - 1) * sp;
    this.flat(reach * 2 + 10 + (n - 1) * sp);
    this.hint({ k: "timed", x0: xw - reach - this.L / 2 - 14, x1: xe + reach + 3, bodies: ids, xWait: xw - reach - this.L / 2 - 2.5, xClear: xe + reach + this.L / 2 + 0.6, v: vPass });
    this.cam(xw - reach - 6, xe + reach + 3, (xw + xe) / 2, y + 2.5, n > 1 ? 0.78 : 0.85);
    for (let i = 0; i < n; i++) this.coinRow(xw + i * sp - 2, xw + i * sp + 2, 1.2, 1);
  }

  pistons() {
    const d = this.d;
    this.flat(10);
    const n = 1 + Math.min(2, Math.floor(d * 2.2 + this.r() * 0.9)), sp = 4.8, bw = 2.2, bh = 2.4, y = this.y;
    // up above the roof most of the time, then a quick slam down to roof height
    const per = this.R(3.2, 4.1), up = y + this.H + 1.9, stroke = 2.6;
    const x0 = this.x + 3;
    const ids: number[] = [];
    // each crusher lifts a little after the one before, at the pace of a car driving through: a wave to follow
    const vPass = clamp(0.45 * this.V, 4, 5.5), ph0 = this.r();
    for (let i = 0; i < n; i++) {
      const ph = (((ph0 - (i * sp) / vPass / per) % 1) + 1) % 1;
      const b = this.kin(x0 + i * sp, up, "stamper", motion("osc", { dy: -stroke, period: per, hold: 0.42, hold2: 0.12, phase: ph }));
      this.rect(b, -bw / 2, 0, bw / 2, bh, 0.08);
      b.d = { w: bw, h: bh };
      ids.push(b.id);
    }
    this.deco("frame", x0 - bw / 2 - 0.6, y, (n - 1) * sp + bw + 1.2, up - y + bh + 0.4);
    this.flat((n - 1) * sp + 9);
    this.hint({ k: "timed", x0: x0 - 14, x1: x0 + (n - 1) * sp + 4, bodies: ids, xWait: x0 - bw / 2 - this.L / 2 - 1.4 - (vPass * vPass) / 9, xClear: x0 + (n - 1) * sp + bw / 2 + this.L / 2 + 0.4, v: vPass });
    this.cam(x0 - 6, x0 + (n - 1) * sp + 4, x0 + ((n - 1) * sp) / 2, y + 3, 0.85);
    for (let i = 0; i < n; i++) this.coin(x0 + i * sp, y + 1.2);
  }

  balls() {
    const d = this.d;
    this.flat(6);
    // a tub with a snug row of heavy loose balls: a rolling, wobbling floor (they shift under the wheels)
    const rb = this.R(0.46, 0.55), n = 5 + Math.floor(this.r() * 3 + d * 4), slack = 0.12;
    const Wb = n * 2 * rb + slack, D = 2 * rb - 0.12, y = this.y, x0 = this.x;
    this.pt(x0, y - D); this.pt(x0 + Wb, y - D); this.pt(x0 + Wb, y);
    for (let i = 0; i < n; i++) {
      const b = this.w.addBody(BALL, x0 + slack / 2 + rb + i * 2 * rb, y - D + rb + 0.01, 0);
      b.tag = "ball"; b.r = rb; b.m = 60; b.invM = 1 / b.m; b.I = 0.5 * b.m * rb * rb; b.invI = 1 / b.I;
      b.d = { hue: i % 5 };
    }
    this.flat(7);
    this.hint({ k: "cap", x0: x0 - 4, x1: x0 + Wb + 2, v: clamp(5 - 2 * d, 3.2, 5) });
    this.coinRow(x0 + 0.8, x0 + Wb - 0.8, 1.6, 1.4);
  }

  loop() {
    const g = this.g;
    const R = clamp(3.2 + (g < 7 ? 0.6 : 0), 3.2, 4.2);
    const Reff = R - 0.95;
    const vreq = Math.sqrt(g * Reff * 5.2) * 1.1;
    const vgo = 0.9 * this.V;
    const hd = Math.max(0.8, ((vreq * vreq - vgo * vgo) / (2 * g)) * 1.5 + 1);
    this.flat(4);
    const x0 = this.x, y = this.y;
    const up = hd / Math.tan(9 * DEG), dn = hd / Math.tan(17 * DEG);
    this.path([[x0 + up, y + hd], [x0 + up + 3, y + hd], [x0 + up + 3 + dn, y], [x0 + up + 3 + dn + 5, y]], 3);
    const cx = this.x + 0.3, cy = y + R;
    this.flat(R + 8);
    const A: number[] = [], Bs: number[] = [];
    let prevX = cx, prevY = cy - R;
    const step = 10;
    for (let deg = -90 + step; deg <= 270; deg += step) {
      const a = deg * DEG, nx = cx + R * Math.cos(a), ny = cy + R * Math.sin(a);
      const id = this.w.seg(this.b0, prevX, prevY, nx, ny, F_ONE);
      if (deg <= 0) A.push(id); else if (deg > 180) Bs.push(id);
      prevX = nx; prevY = ny;
    }
    this.w.loops.push({ cx, cy, R, a: A, b: Bs, state: 0 });
    this.deco("loop", cx, cy, R, 0);
    this.hint({ k: "go", x0: x0 - 2, x1: cx + R + 3 });
    this.cam(cx - R - 7, cx + R + 2, cx, cy, 0.78);
    for (let deg = 0; deg < 360; deg += 36) this.coin(cx + (R - 1.3) * Math.cos(deg * DEG), cy + (R - 1.3) * Math.sin(deg * DEG));
    this.specials.push({ x: cx, y: cy + R - 1.4 });
  }

  tunnel() {
    const d = this.d;
    this.flat(6);
    const len = this.R(14, 18 + 7 * d), amp = 0.16 + 0.24 * d;
    const x0 = this.x, y = this.y;
    for (let s = 0.5; s <= len + 1e-6; s += 0.5) this.pt(x0 + s, y + amp * Math.sin((Math.PI * s) / 3) ** 2 * clamp(Math.min(s, len - s) / 2, 0, 1));
    const clear = y + amp + this.H + 0.55 + 0.45 * (1 - d);
    const pts = [x0 - 2.2, clear + 1.4, x0 - 0.2, clear, x0 + len + 0.2, clear, x0 + len + 2.2, clear + 1.4, x0 + len + 2.2, clear + 6, x0 - 2.2, clear + 6];
    this.w.poly(this.b0, pts, true);
    this.solids.push({ pts, top: [], kind: "ceiling" });
    this.flat(5);
    this.hint({ k: "cap", x0: x0 - 4, x1: x0 + len + 1, v: clamp(5.2 - 1.6 * d, 3.4, 5.2) });
    this.coinRow(x0 + 1, x0 + len - 1, 1.1, 1.6);
  }

  halfpipe() {
    const d = this.d;
    this.flat(5);
    const D = this.R(2.2, 2.8 + 1.6 * d), a1 = this.R(30, 40) * DEG, bot = this.R(3, 6), a2 = this.R(24, 32) * DEG, rise = this.R(0, 0.8);
    const x0 = this.x, y = this.y;
    const l1 = D / Math.tan(a1), l2 = (D + rise) / Math.tan(a2);
    this.path([[x0 + l1, y - D], [x0 + l1 + bot, y - D], [x0 + l1 + bot + l2, y + rise], [x0 + l1 + bot + l2 + 6, y + rise]], 3.5);
    this.hint({ k: "cap", x0: x0 - 3, x1: x0 + l1, v: 6.5 });
    this.hint({ k: "cap", x0: x0 + l1 + bot, x1: this.x, v: 8.5 });
    this.coinRow(x0 + l1, x0 + l1 + bot, 1.2, 1.2);
  }

  crates() {
    const d = this.d;
    this.flat(15);
    const cols = d > 0.5 ? 2 : 1, rows = d > 0.35 ? 3 : 2, cs = 1.15, y = this.y, x0 = this.x;
    const b = this.w.addBody(STATIC, x0 + (cols * cs) / 2, y, 0);
    b.tag = "crate"; b.breakSpeed = 4.2;
    this.rect(b, -(cols * cs) / 2, 0, (cols * cs) / 2, rows * cs, 0.04);
    b.d = { cols, rows, cs };
    this.flat(cols * cs + 9);
    this.hint({ k: "speed", x0: x0 - 13, x1: x0 + cols * cs + 2, v: 7.2 });
    this.coin(x0 + cols * cs + 2.5, y + 1.3, "star");
  }

  fans() {
    const d = this.d, g = this.g;
    this.flat(8);
    const Wf = this.R(8, 8 + 6 * d), x0 = this.x, y = this.y;
    this.cut();
    const rise = this.r() < 0.4 ? this.R(0.4, 1.4) : 0;
    const top = 2.6 + rise;
    this.w.winds.push({ x0: x0 + 0.2, x1: x0 + Wf - 0.2, y0: y - 14, y1: y + top, ax: 0, ay: g * 1.32 });
    this.pit(x0, x0 + Wf, y, 4.2);
    this.deco("fans", x0, y - 3.6, Wf, top + 3.6);
    this.moveTo(x0 + Wf, y + rise);
    this.flat(8);
    this.hint({ k: "speed", x0: x0 - 7, x1: x0 + Wf + 2, v: 5 });
    this.cam(x0 - 3, x0 + Wf + 3, x0 + Wf / 2, y + 2, 0.85);
    for (let x = x0 + 1.5; x < x0 + Wf - 1; x += 1.6) this.coin(x, y + top + 0.6 + Math.sin(x) * 0.4);
  }

  tilt() {
    const d = this.d;
    this.flat(6);
    const Wt = this.R(8, 9 + 5 * d), x0 = this.x, y = this.y;
    this.cut();
    const b = this.w.addBody(PIVOT, x0 + Wt / 2, y - 0.14, 0);
    b.tag = "tilt";
    this.rect(b, -Wt / 2 + 0.1, -0.14, Wt / 2 - 0.1, 0.14, 0.05);
    b.m = 160; b.I = (b.m * Wt * Wt) / 12; b.invI = 1 / b.I; b.spring = 1600 + 800 * (1 - d); b.damp = 160; b.lo = -0.075; b.hi = 0.075;
    b.d = { len: Wt - 0.2 };
    this.pit(x0, x0 + Wt, y, 3.6);
    this.deco("pillar", x0 + Wt / 2, y - 0.14, 0.5, 4);
    this.moveTo(x0 + Wt, y - 0.5);
    this.pt(x0 + Wt + 1.5, y);
    this.flat(7);
    this.hint({ k: "cap", x0: x0 - 4, x1: x0 + Wt + 2, v: 3.6 });
    for (let x = x0 + 1; x < x0 + Wt; x += 1.5) this.coin(x, y + 1.3);
  }

  gear() {
    const d = this.d;
    this.flat(5);
    // one giant gear, half sunk in a pit: its teeth turn under the wheels (against you on the harder stages)
    const Rg = this.R(3.2, 4), y = this.y;
    this.pt(this.x + 1, y - 0.35);
    const xs = this.x;
    this.cut();
    const dxe = Math.sqrt(Math.max(0.2, Rg * Rg - (Rg - 0.55) ** 2));
    const gx = xs + dxe + 0.12;
    const spin = (d > 0.6 && this.r() < 0.5 ? 1 : -1) * this.R(0.28, 0.42);
    const b = this.kin(gx, y - Rg + 0.2, "gear", motion("spin", { da: spin }), this.r() * 6);
    const teeth = Math.round(Rg * 4.4), th = 0.18;
    const pts: number[] = [];
    for (let k = 0; k < teeth; k++) {
      const a = (k / teeth) * Math.PI * 2, w = (Math.PI / teeth) * 0.5;
      pts.push(Math.cos(a - w * 1.4) * (Rg - th), Math.sin(a - w * 1.4) * (Rg - th));
      pts.push(Math.cos(a - w * 0.7) * Rg, Math.sin(a - w * 0.7) * Rg);
      pts.push(Math.cos(a + w * 0.7) * Rg, Math.sin(a + w * 0.7) * Rg);
      pts.push(Math.cos(a + w * 1.4) * (Rg - th), Math.sin(a + w * 1.4) * (Rg - th));
    }
    this.w.poly(b, pts, true);
    b.d = { r: Rg, teeth };
    const xe = gx + dxe + 0.12;
    this.pit(xs, xe, y, 3.6);
    this.moveTo(xe, y - 0.35);
    this.pt(xe + 1, y);
    this.flat(7);
    this.hint({ k: "cap", x0: xs - 6, x1: xe + 2, v: 4.2 });
    this.cam(xs - 3, xe + 3, (xs + xe) / 2, y + 0.5, 0.88);
    this.coinRow(xs - 0.5, xe + 0.5, 1.6, 1.5);
  }

  ice() {
    const d = this.d;
    this.flat(6);
    this.cut();
    const D = this.R(1.8, 2.4 + 1.6 * d), rise = this.R(0.3, 0.9), bot = this.R(3, 5);
    const x0 = this.x, y = this.y;
    this.runKind = "ice"; this.runFlags = F_ICE;
    const l1 = D / Math.tan(22 * DEG), l2 = (D + rise) / Math.tan(17 * DEG);
    this.path([[x0 + l1, y - D], [x0 + l1 + bot, y - D], [x0 + l1 + bot + l2, y + rise], [x0 + l1 + bot + l2 + 3, y + rise]], 4);
    const xe = this.x, ye = this.y;
    this.cut();
    this.moveTo(xe, ye);
    this.flat(6);
    this.hint({ k: "speed", x0: x0 - 6, x1: x0 + 1, v: 7.5 });
    this.hint({ k: "go", x0: x0 + 1, x1: xe });
    this.coinRow(x0 + 1, xe - 1, 1.2, 1.4);
  }

  /** a chain of little jumps onto short pads: hold the right speed the whole way */
  hops() {
    const d = this.d, g = this.g;
    const n = 2 + Math.floor(this.r() * 2 + d * 1.4);
    this.flat(13);
    let prevLand = -1;
    for (let i = 0; i < n; i++) {
      const th = (11 + 7 * d + this.R(-1.5, 1.5)) * DEG, rampL = this.R(2, 2.6), hr = rampL * Math.tan(th);
      const drop = this.R(-0.15, 0.5 + 0.4 * d);
      const vs = Math.min(clamp((0.46 + 0.12 * d) * this.V * this.R(0.95, 1.05), 5.2, 0.64 * this.V), 8.6 * Math.sqrt(g / 10) + 2.2);
      const c2 = Math.cos(th) ** 2, A = 2 * vs * vs * c2 * Math.tan(th), Bq = 2 * vs * vs * c2 * drop;
      const D = (A + Math.sqrt(Math.max(0, A * A + 4 * g * Bq))) / (2 * g);
      const G = Math.max(2.2, D - 3);
      const xr = this.x;
      this.path([[this.x + rampL, this.y + hr]], 2);
      const lipX = this.x, lipY = this.y;
      this.cut();
      const landY = lipY - drop;
      this.pit(lipX, lipX + G, Math.min(lipY, landY), 3.6);
      // a bevelled lip: a landing a touch short rolls up onto the pad instead of hitting a wall
      this.moveTo(lipX + G, landY - 0.35);
      this.pt(lipX + G + 0.7, landY);
      // low gravity: floatier landings need a longer pad to settle before the next ramp
      this.flat((this.L + 3.4 + 2.2 * (1 - d)) * clamp(Math.sqrt(10 / g), 1, 1.5));
      const vx = vs * Math.cos(th), vy = vs * Math.sin(th);
      for (let t = 0.12; t < D / vx; t += 0.14) this.coin(lipX + vx * t, lipY + 1.05 + vy * t - 0.5 * g * t * t);
      this.hint({ k: "speed", x0: prevLand < 0 ? xr - 11 : prevLand, x1: lipX + G + 1.5, v: vs * 1.08 + 0.2 });
      prevLand = lipX + G;
      if (i === 0) this.deco("sign", xr - 5, this.heightAt(xr - 5), 0, 0, 1);
    }
    this.flat(4);
    this.cam(prevLand - 30, prevLand + 4, prevLand - 12, this.y + 2, 0.82);
  }

  /** a bridge of trapdoors that drop open in a wave: cross while they're shut */
  trapdoor() {
    const d = this.d;
    this.flat(10);
    const n = 2 + Math.min(3, Math.floor(d * 2.6 + this.r())), pw = this.R(2.3, 2.8), gp = 0.04, y = this.y;
    const x0 = this.x;
    this.cut();
    const per = this.R(3.4, 4.4), vPass = clamp(0.5 * this.V, 4.5, 6.5), ph0 = this.r();
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const hx = x0 + gp + i * (pw + gp);
      const ph = (((ph0 - (i * (pw + gp)) / vPass / per) % 1) + 1) % 1;
      const b = this.kin(hx, y, "trapdoor", motion("osc", { da: -1.35, period: per, hold: 0.4, hold2: 0.14, phase: ph }));
      this.rect(b, 0, -0.3, pw, 0, 0.04);
      b.d = { w: pw };
      ids.push(b.id);
    }
    const x1 = x0 + gp + n * (pw + gp);
    this.pit(x0, x1, y, 3.6);
    this.deco("posts", x0, y, x1 - x0, 0.8);
    this.moveTo(x1, y);
    this.flat(8);
    this.hint({ k: "timed", x0: x0 - 16, x1: x1 + 2, bodies: ids, xWait: x0 - this.L / 2 - 1.4 - (vPass * vPass) / 9, xClear: x1 + this.L / 2 + 0.4, v: vPass });
    this.cam(x0 - 5, x1 + 3, (x0 + x1) / 2, y + 1, 0.88);
    for (let x = x0 + 0.8; x < x1; x += 1.2) this.coin(x, y + 1.3);
  }

  /** a bed of free-spinning rollers over a pit: the wheels slip, momentum carries you */
  rollers() {
    const d = this.d;
    this.flat(9);
    const rr = this.R(0.42, 0.52), n = 5 + Math.floor(d * 4 + this.r() * 2), gp = 0.05, y = this.y, x0 = this.x;
    this.cut();
    for (let i = 0; i < n; i++) {
      const b = this.w.addBody(PIVOT, x0 + gp + rr + i * (2 * rr + gp), y - rr, this.r() * 6);
      b.tag = "roller";
      const pts: number[] = [];
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
      this.w.poly(b, pts, true);
      b.m = 40; b.I = 0.5 * b.m * rr * rr; b.invI = 1 / b.I; b.damp = 4 + 10 * (1 - d);
      b.d = { r: rr };
    }
    const x1 = x0 + gp + n * (2 * rr + gp);
    this.pit(x0, x1, y, 3.6);
    this.moveTo(x1, y);
    this.flat(7);
    this.hint({ k: "speed", x0: x0 - 8, x1: x1 + 1, v: 6.5 });
    for (let x = x0 + 0.6; x < x1; x += 1.1) this.coin(x, y + 1.4);
  }
}

// ================================================================== the course
export function buildCourse(n: number): Course {
  const plan = stagePlan(n);
  const world = worldOf(plan.world);
  const vehicle = vehicleOf(plan.vehicle);
  const g = world.gravity * (plan.twist === "lowgrav" ? 0.6 : 1);
  const r = makeRng(plan.seed);
  const b = new Builder(vehicle, r, plan.difficulty, g);
  // the start: a flat pad
  b.moveTo(-6, 0);
  b.flat(16);
  const start = { x: 1.5, y: 0 };
  b.spots.push({ x: 6, y: 0, after: -1 });
  const checkpoints: { x: number; y: number }[] = [];
  plan.modules.forEach((m, i) => {
    const x0 = b.x;
    (b[m] as () => void).call(b);
    b.modules.push({ k: m, x0, x1: b.x });
    // a breather after each module; checkpoints every few modules
    b.flat(3 + r() * 2.5);
    const sx = b.x - 1.5;
    b.spots.push({ x: sx, y: b.y, after: i });
    b.flat(1.5);
    const last = i === plan.modules.length - 1;
    if (!last && (i + 1) % 3 === 0) checkpoints.push({ x: sx, y: b.y });
  });
  // the finish
  b.flat(7);
  const finish = { x: b.x, y: b.y };
  b.deco("finish", finish.x, finish.y);
  b.flat(26);
  b.cut();
  const W = b.w;
  b.deco("start", start.x + 1.4, 0);
  for (const cp of checkpoints) b.deco("checkpoint", cp.x, cp.y);

  // ---- pickups: fuel by the time the course takes, hearts and powers now and then
  const length = finish.x - start.x;
  const waits = b.hints.filter((h) => h.k === "ride" || h.k === "gate" || h.k === "timed").length;
  const est = length / 6.2 + waits * 3.5;
  const spots = b.spots.filter((s) => s.after >= 0 && s.x < finish.x - 6);
  const used = new Set<number>();
  const drop = (kind: Item["kind"], s: { x: number; y: number }, power?: PowerId) => {
    used.add(s.x);
    b.items.push({ kind, power, x: s.x, y: s.y + 1.25, x0: s.x, y0: s.y + 1.25, taken: false, ph: r() * 6 });
  };
  if (spots.length) {
    // oil: a can about every half tank of driving (by the time it really takes to get there)
    const waitXs = b.hints.filter((h) => h.k === "ride" || h.k === "gate" || h.k === "timed").map((h) => h.x0);
    const tAt = (x: number) => (x - start.x) / 6.2 + waitXs.filter((w) => w < x).length * 3.5;
    if (est > vehicle.tank * 0.5) {
      let due = vehicle.tank * 0.48;
      for (const s of spots) if (tAt(s.x) >= due && !used.has(s.x)) { drop("fuel", s); due = tAt(s.x) + vehicle.tank * 0.48; }
    }
    // hearts: up where you have to fly for them, about one every seven gizmos
    const hearts = Math.max(plan.n % 4 === 2 ? 1 : 0, Math.floor(plan.modules.length / 7) + (r() < 0.25 ? 1 : 0));
    const sp = b.specials.slice();
    for (let k = 0; k < hearts; k++) {
      if (sp.length) { const q = sp.splice(Math.floor(r() * sp.length), 1)[0]; b.items.push({ kind: "heart", x: q.x, y: q.y, x0: q.x, y0: q.y, taken: false, ph: 0 }); }
      else { const s = spots[Math.floor(r() * spots.length)]; if (!used.has(s.x)) drop("heart", s); }
    }
    // power-ups: one every few gizmos, chosen for the gizmo that follows
    if (plan.n > 2) {
      for (let i = 1 + Math.floor(r() * 3); i < plan.modules.length; i += 3 + Math.floor(r() * 3)) {
        const s = b.spots.find((q) => q.after === i - 1);
        if (!s || used.has(s.x)) continue;
        const next = plan.modules[i];
        const pw: PowerId = next === "kicker" || next === "fans" || next === "drop" || next === "hops" ? (r() < 0.5 ? "float" : "shield")
          : next === "tower" || next === "ice" || next === "halfpipe" || next === "balls" || next === "rollers" ? "grip"
          : next === "crates" || next === "conveyor" || next === "collapse" ? "turbo"
          : r() < 0.5 ? "magnet" : "shield";
        drop("power", s, pw);
      }
    }
  }
  if (plan.twist === "coins") for (const s of b.spots) for (let k = -2; k <= 2; k++) b.coin(s.x + k * 0.9, s.y + 2.4 + Math.abs(k) * -0.25, k === 0 ? "star" : "coin");
  // coins never sit inside the ground
  for (const it of b.items) { const h = b.heightAt(it.x); if (Number.isFinite(h) && it.y < h + 0.7) it.y = it.y0 = h + 0.9; }
  b.items.sort((p, q) => p.x - q.x);

  // ---- scenery along the ground runs
  const props: Prop[] = [];
  for (const t of b.runs) {
    const x0 = t[0], x1 = t[t.length - 2];
    for (let x = x0 + 2 + r() * 4; x < x1 - 2; x += 5 + r() * 9) {
      const h = b.heightAt(x), hl = b.heightAt(x - 1.2), hr = b.heightAt(x + 1.2);
      if (!Number.isFinite(h) || Math.abs(hl - hr) > 0.8) continue;
      props.push({ x, y: Math.min(h, hl, hr), s: 0.8 + r() * 0.6, seed: Math.floor(r() * 1e6), back: true, flip: r() < 0.5 });
    }
  }

  W.finalize();
  W.settle(2.5);
  W.snapshot();
  W.reset();
  let lo = Infinity, hi = -Infinity;
  for (const s of b.solids) for (let i = 1; i < s.top.length; i += 2) { lo = Math.min(lo, s.top[i]); hi = Math.max(hi, s.top[i]); }
  W.killY = lo - 14;
  return {
    plan, world, vehicle, physics: W, g, solids: b.solids, decos: b.decos, props, items: b.items, hints: b.hints, cams: b.cams, pits: b.pits,
    checkpoints, start, finish, bottom: lo - 6, top: hi + 8, modules: b.modules, heightAt: (x) => b.heightAt(x),
  };
}
