// The animals by the track: camels in the dunes, goats on the ruins and peaks, penguins at the polar station, crabs
// on the boardwalk, monkeys in the jungle, songbirds and gulls everywhere and the red planet's little critters. Each
// one idles until the trucks thunder close, then scatters — birds take off flapping, the rest bound or waddle away and
// fade out. State lives in typed arrays; drawing is plain vector shapes, so nothing is allocated per frame.
import type { AnimalSpot } from "../terrain";
import type { AnimalKind } from "../worlds";
import { mix, shade } from "../util";

type C = CanvasRenderingContext2D;
const FLIERS = new Set<AnimalKind>(["bird"]);

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
          if (FLIERS.has(k)) { this.vx[i] = (Math.random() < 0.6 ? 1 : -1) * (2 + Math.random() * 3); this.vy[i] = 3.5 + Math.random() * 1.5; }
          else { this.vx[i] = Math.max(truckV + 1.5, k === "camel" || k === "goat" ? 8 : k === "penguin" || k === "crab" ? 3.5 : 6.5); this.vy[i] = 0; }
          fled = i;
        }
        continue;
      }
      // fleeing
      if (FLIERS.has(k)) {
        this.vy[i] += 1.2 * dt;
        this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      } else {
        this.x[i] += this.vx[i] * dt;
        const g = ground(this.x[i]);
        // bounding hops
        const hop = k === "goat" ? 0.5 : k === "rabbit" || k === "monkey" ? 0.5 : k === "camel" ? 0.2 : 0.12;
        const f = k === "goat" ? 2.6 : k === "rabbit" ? 3.4 : k === "camel" ? 2 : 4;
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
  rabbit: (c, ph, run, g) => {
    const fur = g("#C9B8A8"), hop = run ? Math.sin(ph) * 0.2 : 0;
    ell(c, 0, 0.22, 0.28, 0.2, fur, hop); ell(c, 0.24, 0.36, 0.14, 0.12, fur);
    ell(c, 0.2, 0.6, 0.04, 0.17, fur, -0.2 + hop); ell(c, 0.26, 0.6, 0.04, 0.16, g("#E8C8C8"), -0.1 + hop);
    ell(c, -0.28, 0.26, 0.07, 0.07, "#FFFFFF"); eye(c, 0.3, 0.4, 0.025);
    ell(c, 0.1, 0.05, 0.14, 0.05, shade(fur, -0.2));
  },
  bird: (c, ph, run, g, t, seed) => {
    const col = g(["#E8423A", "#3A7AE8", "#2A2D3E", "#F2B23A"][seed % 4]);
    if (run) { const f = Math.sin(ph * 1.8); ell(c, 0, 0, 0.12, 0.07, col); wing(c, -0.04, 0.02, 0.26, f, shade(col, -0.2)); ell(c, 0.11, 0.04, 0.05, 0.05, col); return; }
    const hopY = Math.max(0, Math.sin(t * 3 + seed)) * 0.03;
    ell(c, 0, 0.1 + hopY, 0.12, 0.08, col); ell(c, 0.1, 0.16 + hopY, 0.06, 0.06, col); c.fillStyle = "#F2B23A"; c.beginPath(); c.moveTo(0.15, 0.17 + hopY); c.lineTo(0.22, 0.16 + hopY); c.lineTo(0.15, 0.14 + hopY); c.fill(); eye(c, 0.12, 0.18 + hopY, 0.014);
    c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(-0.1, 0.12 + hopY); c.lineTo(-0.24, 0.16 + hopY); c.lineTo(-0.1, 0.07 + hopY); c.fill();
  },
  critter: (c, ph, run, g, t) => {
    const body = g("#8FE3C8"), j = run ? Math.abs(Math.sin(ph * 0.6)) * 0.15 : Math.abs(Math.sin(t * 2)) * 0.04;
    ell(c, 0, 0.22 + j, 0.22, 0.2, body); ell(c, 0, 0.16 + j, 0.14, 0.08, g("#D8FFF0"));
    eye(c, 0.06, 0.28 + j, 0.05);
    c.strokeStyle = body; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0, 0.4 + j); c.lineTo(0.06, 0.55 + j); c.stroke(); ell(c, 0.06, 0.56 + j, 0.04, 0.04, "#FF7AD9");
  },
  penguin: (c, ph, run, g) => {
    const w = run ? Math.sin(ph) * 0.12 : Math.sin(ph * 0.5) * 0.04;
    c.save(); c.rotate(w);
    ell(c, 0, 0.32, 0.18, 0.3, g("#1E2232")); ell(c, 0.05, 0.3, 0.12, 0.24, g("#F4F6FA"));
    ell(c, 0.02, 0.62, 0.13, 0.12, g("#1E2232")); eye(c, 0.08, 0.66, 0.02);
    c.fillStyle = "#F2A23A"; c.beginPath(); c.moveTo(0.13, 0.62); c.lineTo(0.22, 0.6); c.lineTo(0.13, 0.57); c.fill();
    ell(c, 0.05, 0.02, 0.07, 0.03, "#F2A23A"); ell(c, -0.07, 0.02, 0.07, 0.03, "#F2A23A");
    ell(c, -0.14, 0.34, 0.05, 0.16, g("#1E2232"), 0.3);
    c.restore();
  },
  crab: (c, ph, run, g) => {
    const sh = run ? Math.sin(ph) * 0.04 : 0, col = g("#FF5A3A");
    for (let k = -1; k <= 1; k += 2) for (let j = 0; j < 3; j++) leg(c, k * (0.08 + j * 0.05), 0.08, 0.12, k * (0.5 + sh * 4), col, 0.025);
    ell(c, 0, 0.14, 0.17, 0.09, col); ell(c, -0.18, 0.22, 0.06, 0.05, col); ell(c, 0.18, 0.22, 0.06, 0.05, col);
    eye(c, -0.05, 0.25, 0.02); eye(c, 0.05, 0.25, 0.02);
  },
  monkey: (c, ph, run, g) => {
    const fur = g("#8A5A36"), sw = run ? Math.sin(ph) * 0.6 : 0;
    leg(c, -0.1, 0.25, 0.25, sw, fur, 0.07); leg(c, 0.1, 0.25, 0.25, -sw, fur, 0.07);
    ell(c, 0, 0.38, 0.17, 0.2, fur); ell(c, 0.03, 0.36, 0.1, 0.13, g("#E8C090"));
    c.strokeStyle = fur; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.15, 0.3); c.quadraticCurveTo(-0.4, 0.4, -0.3, 0.65); c.stroke();
    ell(c, 0.08, 0.66, 0.14, 0.13, fur); ell(c, 0.13, 0.63, 0.08, 0.07, g("#E8C090")); ell(c, -0.04, 0.7, 0.05, 0.05, g("#E8C090"));
    eye(c, 0.12, 0.68, 0.022);
  },
  camel: (c, ph, run, g) => {
    const fur = g("#C8945A"), sw = run ? Math.sin(ph) * 0.5 : 0;
    for (const [x, s] of [[-0.45, 1], [-0.3, -1], [0.3, 1], [0.45, -1]] as const) leg(c, x, 0.95, 0.95, sw * s, shade(fur, -0.15), 0.08);
    ell(c, 0, 1.05, 0.62, 0.26, fur); ell(c, -0.18, 1.3, 0.2, 0.2, fur); ell(c, 0.22, 1.28, 0.18, 0.17, fur);
    c.strokeStyle = fur; c.lineWidth = 0.16; c.lineCap = "round"; c.beginPath(); c.moveTo(0.5, 1.1); c.quadraticCurveTo(0.72, 1.2, 0.72, 1.55); c.stroke();
    ell(c, 0.8, 1.58, 0.16, 0.09, fur); eye(c, 0.82, 1.63, 0.025);
  },
  goat: (c, ph, run, g) => {
    const fur = g("#E8E2D8"), sw = run ? Math.sin(ph) * 0.7 : 0;
    leg(c, -0.2, 0.36, 0.36, sw, g("#6A6460"), 0.06); leg(c, 0.2, 0.36, 0.36, -sw, g("#6A6460"), 0.06);
    ell(c, 0, 0.46, 0.32, 0.16, fur);
    ell(c, 0.34, 0.62, 0.12, 0.1, fur); eye(c, 0.38, 0.65, 0.02);
    c.strokeStyle = g("#8A7A68"); c.lineWidth = 0.04; c.beginPath(); c.arc(0.28, 0.74, 0.1, Math.PI * 0.2, Math.PI * 1.1); c.stroke();
    c.fillStyle = fur; c.beginPath(); c.moveTo(0.4, 0.54); c.lineTo(0.44, 0.44); c.lineTo(0.36, 0.52); c.fill();
  },
};
