// The animals by the road: deer, rabbits, foxes, sheep, hens, frogs, ducks, cranes, songbirds, bees, fireflies and the
// moon's little critters. Each one idles (grazes, pecks, preens, bobs) until the truck rumbles close, then scatters:
// birds take off flapping, hoppers bound away up the road and fade into the trees, frogs leap, bees and fireflies
// drift up. State lives in typed arrays; drawing is plain vector shapes, so nothing is allocated per frame.
import type { AnimalSpot } from "../terrain";
import type { AnimalKind } from "../worlds";
import { mix, rgba, shade } from "../util";

type C = CanvasRenderingContext2D;
const FLIERS = new Set<AnimalKind>(["bird", "duck", "crane", "bee", "firefly"]);

export class Animals {
  n: number;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; t: Float32Array; a: Float32Array;
  /** 0 idle, 1 fleeing, 2 gone */
  st: Uint8Array;
  private spots: AnimalSpot[];
  private tint: (c: string) => string;
  constructor(spots: AnimalSpot[], night: number, tint: string, tintAmt: number) {
    this.spots = spots; this.n = spots.length;
    this.x = new Float32Array(spots.map((s) => s.x)); this.y = new Float32Array(spots.map((s) => s.y));
    this.vx = new Float32Array(this.n); this.vy = new Float32Array(this.n); this.t = new Float32Array(this.n);
    this.a = new Float32Array(this.n).fill(1); this.st = new Uint8Array(this.n);
    const dark = night * 0.4;
    this.tint = (c: string) => { const x = mix(c, tint, tintAmt * 0.4); return dark > 0 ? shade(x, -dark) : x; };
  }
  reset() { for (let i = 0; i < this.n; i++) { this.x[i] = this.spots[i].x; this.y[i] = this.spots[i].y; this.st[i] = 0; this.a[i] = 1; this.t[i] = 0; } }

  /** returns the index of an animal that just took fright (for its sound), or -1 */
  update(dt: number, truckX: number, truckV: number, ground: (x: number) => number): number {
    let fled = -1;
    for (let i = 0; i < this.n; i++) {
      if (this.st[i] === 2) continue;
      const k = this.spots[i].kind;
      this.t[i] += dt;
      if (this.st[i] === 0) {
        const d = this.x[i] - truckX;
        if (d < 11 + truckV * 0.6 && d > -3) {
          this.st[i] = 1; this.t[i] = 0;
          if (FLIERS.has(k)) { this.vx[i] = (Math.random() < 0.6 ? 1 : -1) * (2 + Math.random() * 3); this.vy[i] = k === "bee" || k === "firefly" ? 1.2 : 3.5 + Math.random() * 1.5; }
          else { this.vx[i] = Math.max(truckV + 1.5, k === "deer" ? 9 : k === "frog" ? 4 : 6.5); this.vy[i] = 0; }
          fled = i;
        }
        continue;
      }
      // fleeing
      if (FLIERS.has(k)) {
        this.vy[i] += (k === "bee" || k === "firefly" ? 0.4 : 1.2) * dt;
        this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      } else {
        this.x[i] += this.vx[i] * dt;
        const g = ground(this.x[i]);
        // bounding hops
        const hop = k === "deer" ? 0.55 : k === "rabbit" || k === "frog" ? 0.5 : k === "fox" ? 0.3 : 0.15;
        const f = k === "deer" ? 2.4 : k === "rabbit" ? 3.4 : 4;
        this.y[i] = g + Math.abs(Math.sin(this.t[i] * f * Math.PI)) * hop;
      }
      this.a[i] = Math.max(0, 1 - Math.max(0, this.t[i] - 1.4) / 1.2);
      if (this.a[i] <= 0) this.st[i] = 2;
    }
    return fled;
  }
  kindOf(i: number) { return this.spots[i].kind; }

  draw(c: C, x0: number, x1: number, t: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.st[i] === 2) continue;
      const x = this.x[i];
      if (x < x0 - 2 || x > x1 + 2) continue;
      const s = this.spots[i], k = s.kind;
      const fleeing = this.st[i] === 1;
      const flip = fleeing ? this.vx[i] < 0 : s.flip;
      c.save();
      c.globalAlpha = this.a[i];
      c.translate(x, this.y[i]);
      // fleeing ground animals shrink a touch (running off into the trees)
      const sc = s.s * (fleeing && !FLIERS.has(k) ? 1 - Math.min(0.35, this.t[i] * 0.15) : 1);
      c.scale(flip ? -sc : sc, sc);
      const ph = t * (fleeing ? 14 : 2) + s.seed % 97;
      PAINT[k](c, ph, fleeing, this.tint, t, s.seed);
      c.restore();
    }
    c.globalAlpha = 1;
  }
}

type Painter = (c: C, ph: number, run: boolean, g: (col: string) => string, t: number, seed: number) => void;
const ell = (c: C, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };
const leg = (c: C, x: number, y: number, len: number, a: number, col: string, w = 0.05) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); c.stroke(); };
const eye = (c: C, x: number, y: number, r = 0.035) => { ell(c, x, y, r, r, "#1A1420"); ell(c, x + r * 0.35, y + r * 0.35, r * 0.35, r * 0.35, "#FFFFFF"); };
function wing(c: C, x: number, y: number, len: number, flap: number, col: string) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - len * 0.3, y); c.quadraticCurveTo(x, y + len * flap, x + len * 0.5, y + len * 0.6 * flap); c.lineTo(x + len * 0.2, y); c.closePath(); c.fill();
}

const PAINT: Record<AnimalKind, Painter> = {
  deer: (c, ph, run, g) => {
    const body = g("#B8763E"), dark = g("#8A5228");
    const sw = run ? Math.sin(ph) * 0.6 : 0;
    leg(c, -0.35, 0.7, 0.7, sw, dark, 0.07); leg(c, 0.35, 0.7, 0.7, -sw, dark, 0.07); leg(c, -0.25, 0.7, 0.7, -sw * 0.8, body, 0.07); leg(c, 0.45, 0.7, 0.7, sw * 0.8, body, 0.07);
    ell(c, 0, 0.85, 0.55, 0.26, body);
    ell(c, -0.05, 0.78, 0.4, 0.12, g("#F2DCC0"));
    const nod = run ? 0 : Math.max(0, Math.sin(ph * 0.4)) * 0.35;
    c.save(); c.translate(0.45, 1.0); c.rotate(-nod);
    ell(c, 0.08, 0.2, 0.09, 0.24, body, -0.4); ell(c, 0.2, 0.42, 0.18, 0.11, body, -0.2); ell(c, 0.34, 0.38, 0.06, 0.05, "#2A1A12");
    eye(c, 0.18, 0.46); ell(c, 0.05, 0.56, 0.06, 0.1, dark, -0.5);
    c.strokeStyle = g("#6A4426"); c.lineWidth = 0.035; c.beginPath(); c.moveTo(0.12, 0.52); c.lineTo(0.04, 0.8); c.lineTo(-0.06, 0.88); c.moveTo(0.06, 0.7); c.lineTo(0.16, 0.82); c.stroke();
    c.restore();
    ell(c, -0.55, 0.95, 0.08, 0.1, "#FFFFFF");
  },
  rabbit: (c, ph, run, g) => {
    const fur = g("#C9B8A8"), hop = run ? Math.sin(ph) * 0.2 : 0;
    ell(c, 0, 0.22, 0.28, 0.2, fur, hop); ell(c, 0.24, 0.36, 0.14, 0.12, fur);
    ell(c, 0.2, 0.6, 0.04, 0.17, fur, -0.2 + hop); ell(c, 0.26, 0.6, 0.04, 0.16, g("#E8C8C8"), -0.1 + hop);
    ell(c, -0.28, 0.26, 0.07, 0.07, "#FFFFFF"); eye(c, 0.3, 0.4, 0.025);
    ell(c, 0.1, 0.05, 0.14, 0.05, shade(fur, -0.2));
  },
  fox: (c, ph, run, g) => {
    const fur = g("#E8742A"), sw = run ? Math.sin(ph) * 0.7 : 0;
    leg(c, -0.25, 0.32, 0.32, sw, "#2A1A12", 0.06); leg(c, 0.25, 0.32, 0.32, -sw, "#2A1A12", 0.06);
    ell(c, 0, 0.42, 0.38, 0.17, fur);
    c.fillStyle = fur; c.beginPath(); c.moveTo(-0.32, 0.45); c.quadraticCurveTo(-0.8, 0.5 + (run ? 0.1 : Math.sin(ph) * 0.05), -0.75, 0.75); c.quadraticCurveTo(-0.55, 0.5, -0.3, 0.38); c.fill();
    ell(c, -0.72, 0.72, 0.07, 0.07, "#FFFFFF");
    ell(c, 0.38, 0.58, 0.15, 0.12, fur); c.fillStyle = fur; c.beginPath(); c.moveTo(0.45, 0.55); c.lineTo(0.66, 0.5); c.lineTo(0.45, 0.48); c.fill();
    c.beginPath(); c.moveTo(0.3, 0.66); c.lineTo(0.33, 0.82); c.lineTo(0.4, 0.68); c.moveTo(0.4, 0.68); c.lineTo(0.47, 0.8); c.lineTo(0.48, 0.64); c.fill();
    ell(c, 0.42, 0.52, 0.12, 0.05, "#FFFFFF"); eye(c, 0.43, 0.61, 0.025);
  },
  sheep: (c, ph, run, g) => {
    const wool = g("#F4EFE6"), sw = run ? Math.sin(ph) * 0.6 : 0;
    leg(c, -0.25, 0.3, 0.32, sw, "#2A2430", 0.07); leg(c, 0.25, 0.3, 0.32, -sw, "#2A2430", 0.07);
    for (const [x, y, r] of [[-0.25, 0.5, 0.2], [0, 0.56, 0.24], [0.22, 0.5, 0.2], [-0.1, 0.38, 0.2], [0.12, 0.38, 0.2]] as const) ell(c, x, y, r, r * 0.9, wool);
    const nod = run ? 0 : Math.max(0, Math.sin(ph * 0.5)) * 0.25;
    ell(c, 0.42, 0.5 - nod, 0.13, 0.16, "#2A2430"); eye(c, 0.46, 0.54 - nod, 0.025); ell(c, 0.33, 0.6 - nod, 0.08, 0.04, "#2A2430", 0.5);
  },
  chicken: (c, ph, run, g) => {
    const peck = run ? 0 : Math.max(0, Math.sin(ph * 1.3)) * 0.3;
    const sw = run ? Math.sin(ph) * 0.6 : 0;
    leg(c, -0.05, 0.16, 0.16, sw, "#E8A23A", 0.03); leg(c, 0.06, 0.16, 0.16, -sw, "#E8A23A", 0.03);
    ell(c, 0, 0.3, 0.2, 0.16, g("#FFFFFF"));
    c.fillStyle = g("#F2EEE8"); c.beginPath(); c.moveTo(-0.15, 0.34); c.lineTo(-0.3, 0.5); c.lineTo(-0.12, 0.42); c.fill();
    if (run) wing(c, -0.02, 0.34, 0.22, Math.sin(ph * 2), g("#E8E4DC"));
    c.save(); c.translate(0.14, 0.4); c.rotate(-peck);
    ell(c, 0.04, 0.06, 0.09, 0.1, g("#FFFFFF")); ell(c, 0.03, 0.17, 0.05, 0.04, "#E8423A"); c.fillStyle = "#F2B23A"; c.beginPath(); c.moveTo(0.11, 0.06); c.lineTo(0.18, 0.04); c.lineTo(0.11, 0.02); c.fill(); eye(c, 0.07, 0.08, 0.018);
    c.restore();
  },
  frog: (c, ph, run, g) => {
    const skin = g("#5EBE4A"), j = run ? Math.abs(Math.sin(ph * 0.5)) * 0.1 : 0;
    ell(c, 0, 0.12 + j, 0.2, 0.11, skin); ell(c, 0.12, 0.22 + j, 0.07, 0.06, skin); ell(c, -0.02, 0.22 + j, 0.07, 0.06, skin);
    eye(c, 0.13, 0.24 + j, 0.025); eye(c, -0.01, 0.24 + j, 0.025);
    ell(c, -0.14, 0.05 + j, 0.1, 0.04, shade(skin, -0.2)); ell(c, 0.06, 0.08 + j, 0.14, 0.05, g("#D8F2A8"));
  },
  duck: (c, ph, run, g, t) => {
    if (run) { const f = Math.sin(ph * 1.6); ell(c, 0, 0, 0.24, 0.12, g("#8E6A4A")); wing(c, -0.05, 0.04, 0.4, f, g("#A88A6A")); ell(c, 0.24, 0.1, 0.09, 0.08, g("#2E8A4A")); c.fillStyle = "#F2B23A"; c.beginPath(); c.moveTo(0.3, 0.1); c.lineTo(0.42, 0.08); c.lineTo(0.3, 0.06); c.fill(); return; }
    const bob = Math.sin(t * 2 + ph) * 0.02;
    ell(c, 0, 0.08 + bob, 0.26, 0.12, g("#8E6A4A")); ell(c, -0.05, 0.12 + bob, 0.14, 0.06, g("#6A4A30"));
    ell(c, 0.22, 0.24 + bob, 0.09, 0.09, g("#2E8A4A")); c.fillStyle = "#F2B23A"; c.beginPath(); c.moveTo(0.29, 0.23 + bob); c.lineTo(0.4, 0.21 + bob); c.lineTo(0.29, 0.19 + bob); c.fill(); eye(c, 0.25, 0.27 + bob, 0.018);
  },
  bird: (c, ph, run, g, t, seed) => {
    const col = g(["#E8423A", "#3A7AE8", "#2A2D3E", "#F2B23A"][seed % 4]);
    if (run) { const f = Math.sin(ph * 1.8); ell(c, 0, 0, 0.12, 0.07, col); wing(c, -0.04, 0.02, 0.26, f, shade(col, -0.2)); ell(c, 0.11, 0.04, 0.05, 0.05, col); return; }
    const hopY = Math.max(0, Math.sin(t * 3 + seed)) * 0.03;
    ell(c, 0, 0.1 + hopY, 0.12, 0.08, col); ell(c, 0.1, 0.16 + hopY, 0.06, 0.06, col); c.fillStyle = "#F2B23A"; c.beginPath(); c.moveTo(0.15, 0.17 + hopY); c.lineTo(0.22, 0.16 + hopY); c.lineTo(0.15, 0.14 + hopY); c.fill(); eye(c, 0.12, 0.18 + hopY, 0.014);
    c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(-0.1, 0.12 + hopY); c.lineTo(-0.24, 0.16 + hopY); c.lineTo(-0.1, 0.07 + hopY); c.fill();
  },
  crane: (c, ph, run, g) => {
    const w = g("#F4F4F0");
    if (run) { const f = Math.sin(ph * 1.2); ell(c, 0, 0, 0.3, 0.1, w); wing(c, -0.05, 0.03, 0.7, f, w); c.strokeStyle = w; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0.25, 0.04); c.lineTo(0.55, 0.1); c.stroke(); ell(c, 0.58, 0.1, 0.05, 0.04, "#E8423A"); return; }
    leg(c, -0.04, 0.6, 0.6, 0, "#2A2430", 0.025); leg(c, 0.06, 0.6, 0.6, 0, "#2A2430", 0.025);
    ell(c, 0, 0.72, 0.28, 0.14, w); ell(c, -0.2, 0.7, 0.12, 0.08, "#2A2430");
    c.strokeStyle = w; c.lineWidth = 0.05; c.beginPath(); c.moveTo(0.2, 0.78); c.quadraticCurveTo(0.34, 1.0, 0.28, 1.18); c.stroke();
    ell(c, 0.3, 1.2, 0.06, 0.05, w); ell(c, 0.3, 1.25, 0.04, 0.025, "#E8423A"); c.fillStyle = "#C9A23A"; c.beginPath(); c.moveTo(0.35, 1.2); c.lineTo(0.5, 1.18); c.lineTo(0.35, 1.17); c.fill();
  },
  bee: (c, ph, _run, _g, t, seed) => {
    const y = 0.7 + Math.sin(t * 3 + seed) * 0.12, x = Math.sin(t * 2.2 + seed) * 0.3;
    ell(c, x, y, 0.08, 0.06, "#FFC21A"); c.fillStyle = "#2A1A10"; c.fillRect(x - 0.02, y - 0.06, 0.03, 0.12);
    ell(c, x - 0.02, y + 0.07, 0.06, 0.03 + Math.abs(Math.sin(ph * 6)) * 0.03, "rgba(255,255,255,0.75)");
  },
  firefly: (c, _ph, _run, _g, t, seed) => {
    const y = 0.8 + Math.sin(t * 1.3 + seed) * 0.3, x = Math.sin(t * 0.9 + seed) * 0.6, a = 0.5 + 0.5 * Math.sin(t * 4 + seed);
    ell(c, x, y, 0.3, 0.3, rgba("#D8FF7A", 0.2 * a)); ell(c, x, y, 0.06, 0.06, rgba("#F2FFB0", 0.6 + 0.4 * a));
  },
  critter: (c, ph, run, g, t) => {
    const body = g("#8FE3C8"), j = run ? Math.abs(Math.sin(ph * 0.6)) * 0.15 : Math.abs(Math.sin(t * 2)) * 0.04;
    ell(c, 0, 0.22 + j, 0.22, 0.2, body); ell(c, 0, 0.16 + j, 0.14, 0.08, g("#D8FFF0"));
    eye(c, 0.06, 0.28 + j, 0.05);
    c.strokeStyle = body; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0, 0.4 + j); c.lineTo(0.06, 0.55 + j); c.stroke(); ell(c, 0.06, 0.56 + j, 0.04, 0.04, "#FF7AD9");
  },
};
