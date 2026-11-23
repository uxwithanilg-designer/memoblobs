// three.js renderer for Momo Sky Roll. Everything near the ball is (re)written every frame from the level data and
// the beat — tiles rise into place, special tiles animate, props bounce on the kick, hazards move exactly where the
// simulation says they are (art/skins.ts models posed from hazards.ts math), and sky/light/fog morph per zone mood.
import * as THREE from "three";
import { ballView, bossView, dropperView, laserView, pendulumView, popperView, rollerView, sliderView, spinnerView } from "./art/skins";
import type { BallView, BossView, DropperView, LaserView, PendulumView, PopperView, RollerView, SliderView, SpinnerView } from "./art/api";
import { propGeometry } from "./art/props";
import { CLAW_WARN, clawLift, clawSlamNear, daisyAngle, laserOn, MALLET_LEN, MALLET_PIVOT_Y, malletAngle, popperUp, ROLLER_R, rollerS, sliderHop, sliderX } from "./hazards";
import { tileOffset, tileSolid, zoneAt } from "./levels";
import { bannerTexture, decalTexture, makeArch, makeKranky, propMaterial, tileGeometry, tileMaterial, type ClayUniforms } from "./models";
import { Rng } from "./rng";
import { moodOf, type Mood, type Particles as PKind } from "./themes";
import { TK, type CamMode, type Hazard, type Level, type Pickup } from "./types";
import type { Sim } from "./sim";
import { antialiasFor, pixelRatioFor } from "@/lib/perf";

export type Quality = "low" | "medium" | "high";

const TILE_CAP = 1600;
const UP = new THREE.Vector3(0, 1, 0);
const COLORS = [0xff5dc8, 0x3dd8ff, 0xffd23d];

// ---------------------------------------------------------------- particles
class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array; private alpha: Float32Array;
  private vel: Float32Array; private life: Float32Array; private max: Float32Array; private grav: Float32Array; private drag: Float32Array; private size0: Float32Array;
  private twinkle: Uint8Array;
  private next = 0;
  constructor(private cap: number, additive: boolean, tex: THREE.Texture) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.size0 = new Float32Array(cap);
    this.twinkle = new Uint8Array(cap);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 }, uMap: { value: tex } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale;
        varying vec3 vC; varying float vA;
        void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.1, -mv.z); }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); float a = t.a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * t.rgb, a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
  set scale(v: number) { (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = v; }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, c: THREE.Color, size: number, life: number, grav = 0, drag = 0, twinkle = false) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.size0[i] = size; this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag;
    this.twinkle[i] = twinkle ? 1 : 0;
    this.alpha[i] = 1;
  }
  update(dt: number, t: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.alpha[i] = Math.min(1, f * 2.5) * (this.twinkle[i] ? 0.45 + 0.55 * Math.sin(t * 9 + i * 1.7) ** 2 : 1);
      this.size[i] = this.size0[i] * (0.55 + 0.45 * Math.min(1, f * 3));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.aColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- level dressing
interface PropItem { k: string; s: number; x: number; y: number; sc: number; ry: number; c: THREE.Color; ph: number; island?: boolean; cloud?: boolean }
const easeBack = (t: number) => { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const frac = (v: number) => v - Math.floor(v);
/** first index whose .s >= s (arr sorted by s) */
const lowerS = (arr: { s: number }[], s: number) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s < s) lo = m + 1; else hi = m; } return lo; };
/** free the GPU side of a subtree (skins build fresh geometry/materials per view) */
function disposeTree(o: THREE.Object3D, keep: Set<unknown>) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry && !keep.has(m.geometry)) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mt of mats) {
      if (keep.has(mt)) continue;
      for (const v of Object.values(mt as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture && !keep.has(v)) v.dispose();
      mt.dispose();
    }
  });
}

function dress(L: Level, q: Quality, from = 2, to = L.rows.length + 30): { items: PropItem[]; end: number } {
  const rng = new Rng((L.seed ^ 0x51ab ^ Math.imul(Math.floor(from), 7919)) >>> 0);
  const out: PropItem[] = [];
  const extent = (s: number): [number, number, number] => {
    let a = 99, b = -99, h = 0;
    for (let d = -3; d <= 3; d++) {
      const r = L.rows[s + d];
      if (!r || !r.tiles.length) continue;
      a = Math.min(a, r.tiles[0].x - (r.tiles[0].mv?.ax === 0 ? r.tiles[0].mv.amp : 0));
      b = Math.max(b, r.tiles[r.tiles.length - 1].x + (r.tiles[r.tiles.length - 1].mv?.ax === 0 ? r.tiles[r.tiles.length - 1].mv!.amp : 0));
      if (d === 0) h = r.h;
    }
    return a > b ? [-1, 1, h] : [a, b, h];
  };
  const density = q === "low" ? 0.55 : q === "medium" ? 0.8 : 1;
  const pickKind = (m: Mood) => {
    const entries = Object.entries(m.mix);
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = rng.next() * total;
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[0]?.[0] ?? "bush";
  };
  const tint = (m: Mood, k: string) => new THREE.Color(rng.pick(m.props[k] ?? [0xffffff]));
  const nRows = L.rows.length;
  let s = from;
  for (; s < to; s += 1.4 + rng.next() * 1.4) {
    const si = Math.min(nRows - 1, Math.floor(s));
    const m = moodOf(L.zones[zoneAt(L, si)].mood);
    const [a, b, h] = extent(si);
    for (const side of [-1, 1]) {
      if (rng.next() > density * 0.92) continue;
      const edge = side < 0 ? a : b;
      const x = edge + side * (1.9 + rng.next() * 3.2);
      const y = h - 0.25 - rng.next() * 0.9;
      const isc = 0.7 + rng.next() * 0.8;
      out.push({ k: m.island ?? "island", s, x, y, sc: isc, ry: rng.next() * 6.28, c: new THREE.Color(m.tileB).offsetHSL(0, 0, (rng.next() - 0.5) * 0.06), ph: rng.next(), island: true });
      const n = rng.next() < 0.45 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const k = pickKind(m);
        const ox = (rng.next() - 0.5) * isc * 0.9, oz = (rng.next() - 0.5) * isc * 0.9;
        out.push({ k, s: s + oz, x: x + ox, y, sc: 0.8 + rng.next() * 0.7, ry: rng.next() * 6.28, c: tint(m, k), ph: rng.next() });
      }
    }
    if (rng.next() < 0.22 * density) {
      const side = rng.sign();
      const x = side * (9 + rng.next() * 14), y = h - 3 + rng.next() * 5, isc = 1.6 + rng.next() * 2.2;
      out.push({ k: m.island ?? "island", s, x, y, sc: isc, ry: rng.next() * 6.28, c: new THREE.Color(m.tileA), ph: rng.next(), island: true });
      for (let i = 0; i < 2; i++) { const k = pickKind(m); out.push({ k, s: s + (rng.next() - 0.5) * isc, x: x + (rng.next() - 0.5) * isc, y, sc: isc * 0.8, ry: rng.next() * 6.28, c: tint(m, k), ph: rng.next() }); }
    }
    if (rng.next() < 0.16) {
      const side = rng.sign(), below = rng.next() < 0.45;
      out.push({ k: "cloud", s, x: side * (12 + rng.next() * 20), y: h + (below ? -9 - rng.next() * 5 : 5 + rng.next() * 9), sc: 1.6 + rng.next() * 2.4, ry: rng.next() * 6.28, c: new THREE.Color(m.cloud), ph: rng.next(), cloud: true });
    }
  }
  return { items: out.sort((p, q2) => p.s - q2.s), end: s };
}

// ---------------------------------------------------------------- hazard views
type HView =
  | { h: Hazard; a: "mallet"; v: PendulumView } | { h: Hazard; a: "daisy"; v: SpinnerView } | { h: Hazard; a: "claw"; v: DropperView }
  | { h: Hazard; a: "slider"; v: SliderView } | { h: Hazard; a: "roller"; v: RollerView } | { h: Hazard; a: "popper"; v: PopperView } | { h: Hazard; a: "laser"; v: LaserView };

function makeView(h: Hazard): HView {
  switch (h.kind) {
    case "mallet": return { h, a: "mallet", v: pendulumView(h.skin) };
    case "daisy": return { h, a: "daisy", v: spinnerView(h.skin, h.arms ?? 4, h.size) };
    case "claw": return { h, a: "claw", v: dropperView(h.skin, h.size * 2 + 1) };
    case "slider": return { h, a: "slider", v: sliderView(h.skin, h.w ?? 1) };
    case "roller": return { h, a: "roller", v: rollerView(h.skin, ROLLER_R) };
    case "popper": return { h, a: "popper", v: popperView(h.skin, h.w ?? 1) };
    case "laser": return { h, a: "laser", v: laserView(h.skin, h.size * 2) };
  }
}

const PICK_COLOR: Record<string, number> = { A01: 0x5fe08a, A02: 0x3dd8ff, A03: 0xff8a3d, A04: 0xffb3d0, A05: 0x7affea, A06: 0x9b6bff, A07: 0xff5d8f, A08: 0xffffff, A09: 0xc8d0dc, A10: 0x46a0ff, A11: 0xb57bff, A12: 0xff6b3d, A13: 0xe8f0ff, A14: 0xd49452, A15: 0xffd23d };

function textSprite(text: string, bg: string, fg = "#ffffff") {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = "rgba(255,255,255,0.9)"; g.stroke();
  g.font = "900 72px 'Lilita One', 'Fredoka', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = fg; g.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.setScalar(0.62);
  return s;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.25, 0.25);
  s.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  s.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  s.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  s.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  s.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  s.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 14 });
  g.center(); g.rotateZ(Math.PI); g.scale(0.5, 0.5, 0.5);
  return g;
}

function boltGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.1, 0.5); s.lineTo(-0.22, 0.02); s.lineTo(-0.02, 0.02); s.lineTo(-0.12, -0.5); s.lineTo(0.24, 0.08); s.lineTo(0.04, 0.08); s.lineTo(0.1, 0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
  g.center();
  return g;
}

function coinTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(48, 42, 6, 64, 64, 66);
  gr.addColorStop(0, "#fff6c2"); gr.addColorStop(0.5, "#ffc93d"); gr.addColorStop(1, "#e08f00");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.lineWidth = 7; g.strokeStyle = "rgba(150,80,0,0.5)"; g.beginPath(); g.arc(64, 64, 49, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#fff8d6"; g.strokeStyle = "rgba(160,90,0,0.65)"; g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 32, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(64 + Math.cos(a) * r, 67 + Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePickup(p: Pickup, glowTex?: THREE.Texture): THREE.Object3D {
  const g = new THREE.Group();
  const std = (c: number, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.2, emissive: c, emissiveIntensity: e });
  switch (p.kind) {
    case "power": {
      const c = PICK_COLOR[p.ab ?? ""] ?? 0xffffff;
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 2), std(c, 0.9)));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 8, 28), std(0xffffff, 0.6)); ring.rotation.x = Math.PI / 2; g.add(ring);
      break;
    }
    case "letter": g.add(textSprite(p.ab ?? "M", "#ff8a3d")); break;
    case "note": g.add(textSprite("♪", "#9b5de5")); break;
    case "key": {
      const gold = std(0xffc533, 0.4);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 18), gold); ring.position.y = 0.15; g.add(ring);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.07), gold); bar.position.y = -0.1; g.add(bar);
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.07), gold); tooth.position.set(0.06, -0.22, 0); g.add(tooth);
      break;
    }
    case "baby": {
      const c = [0xff8a3d, 0x9be34a, 0xff6f91, 0x46c8ff][p.id % 4];
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), std(c, 0.15)); body.scale.y = 0.85; g.add(body);
      const eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1030 });
      for (const x of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM); e.position.set(x, 0.04, 0.17); g.add(e); }
      break;
    }
    case "box": {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), std(0xff5d8f, 0.2)));
      const rib = std(0xffd23d, 0.3);
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.44), rib); g.add(r1);
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.44), rib); g.add(r2);
      break;
    }
    case "statue": {
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc533, roughness: 0.2, metalness: 0.8, emissive: 0x5a3a00, emissiveIntensity: 0.6 });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 22, 16), gold); b.position.y = 0.3; g.add(b);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.2, 18), new THREE.MeshStandardMaterial({ color: 0xfff1d6 })); ped.position.y = -0.2; g.add(ped);
      break;
    }
    case "life": {
      const heart = new THREE.Mesh(heartGeometry(), new THREE.MeshStandardMaterial({ color: 0xff3d6e, roughness: 0.25, metalness: 0.1, emissive: 0xff1f5a, emissiveIntensity: 0.55 }));
      heart.position.y = 0.12;
      g.add(heart);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(-0.1, 0.24, 0.12); g.add(shine);
      if (glowTex) { const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7aa8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 })); halo.scale.setScalar(1.5); halo.position.y = 0.12; g.add(halo); }
      break;
    }
    case "booster": {
      const bolt = new THREE.Mesh(boltGeometry(), new THREE.MeshStandardMaterial({ color: 0xffd23d, roughness: 0.25, metalness: 0.2, emissive: 0xffa800, emissiveIntensity: 0.85 }));
      bolt.position.y = 0.14; g.add(bolt);
      const ringM = new THREE.MeshStandardMaterial({ color: 0x3dd8ff, roughness: 0.2, metalness: 0.3, emissive: 0x1aa8ff, emissiveIntensity: 0.9 });
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 36), ringM); r1.position.y = 0.14; g.add(r1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 36), ringM); r2.position.y = 0.14; r2.rotation.x = Math.PI / 2; g.add(r2);
      if (glowTex) { const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7ae8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 })); halo.scale.setScalar(1.8); halo.position.y = 0.14; g.add(halo); }
      break;
    }
    default: break;
  }
  g.position.set(p.x, p.y, -p.s);
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------- renderer
export class RollRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private L: Level;
  private q: Quality;
  private view: number;
  private u: ClayUniforms = { uPulse: { value: 0 }, uNight: { value: 0 } };
  private tiles: THREE.InstancedMesh;
  private aSide: THREE.InstancedBufferAttribute;
  private aGlow: THREE.InstancedBufferAttribute;
  private decals: Record<"boost" | "pad" | "crack" | "check", THREE.InstancedMesh>;
  private warn: THREE.InstancedMesh;
  private shadows: THREE.InstancedMesh;
  private walls: THREE.InstancedMesh;
  private props = new Map<string, { mesh: THREE.InstancedMesh; items: PropItem[] }>();
  private sky: THREE.Mesh;
  private skyU: Record<string, THREE.IUniform>;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fog: THREE.Fog;
  private ball: BallView;
  private twin: BallView;
  private shield: THREE.Mesh;
  private ghostBall: THREE.Mesh;
  private ghostX: Int8Array | null = null;
  private trail: THREE.Mesh;
  private trailPts: THREE.Vector3[] = [];
  private trailPos: Float32Array;
  private trailA: Float32Array;
  private beads: THREE.InstancedMesh;
  private sprouts: THREE.Group[] = [];
  private extras: { p: Pickup; o: THREE.Object3D }[] = [];
  private hv: HView[] = [];
  private bosses: { zone: number; v: BossView }[] = [];
  private arches: { s: number; g: THREE.Group }[] = [];
  private kranky: ReturnType<typeof makeKranky> | null = null;
  private boulder: RollerView | null = null;
  private flood: THREE.Mesh | null = null;
  private fx: Particles;
  private glow: Particles;
  private ripples: { s: number; x: number; t: number; a: number }[] = [];
  private pal = { top: new THREE.Color(), mid: new THREE.Color(), bot: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sunI: 2, hemiI: 1, stars: 0, fogK: 1, dark: 0 };
  private cam = { x: 0, y: 0, roll: 0, shake: 0, fov: 0, pull: 0, orbit: 0, lastS: 0, mode: "chase" as CamMode, blend: 0, zoneT: 0, zone: -1 };
  private squash = { v: 0, k: 0 };
  private tilt = { x: 0, vx: 0, z: 0, vz: 0 };
  private lastVx = 0;
  private time = 0;
  private ambientT = 0;
  private w = 1; private h = 1;
  private dpr = 1;
  private scaleMul = 1;
  private touched = new Map<string, number>();
  shakeOn = true;
  reduced = false;
  /** the camera currently shows the world mirrored left↔right (input should be flipped) */
  viewFlip = false;
  private tmpC = new THREE.Color();
  private tmpC2 = new THREE.Color();
  private m4 = new THREE.Matrix4();
  private q4 = new THREE.Quaternion();
  private e3 = new THREE.Euler();
  private v3 = new THREE.Vector3();
  private s3 = new THREE.Vector3();
  private disposed = false;
  /** endless run: the track keeps growing — no checkpoint/finish arches, fixed-size instance pools, far-behind views freed */
  private run = false;
  private dressEnd = 0;
  private pm!: ReturnType<typeof propMaterial>;
  private glowTex!: THREE.Texture;
  private goldMat!: THREE.MeshStandardMaterial;
  private hazN = 0;
  private pickN = 0;
  private zoneN = 0;
  /** speed rush / booster strength from the session (speed − 1): wider FOV + speed streaks */
  speedFx = 0;
  private fxK = 0;
  private streaks!: THREE.InstancedMesh;
  private streakSeed!: Float32Array;
  private bubble!: THREE.Mesh;

  constructor(host: HTMLElement, L: Level, q: Quality, ch = "momo", run = false) {
    this.L = L; this.q = q; this.run = run;
    this.view = q === "low" ? 46 : q === "medium" ? 58 : 66;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(q), powerPreference: "high-performance", stencil: false, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.dpr = pixelRatioFor(q);
    const cv = this.renderer.domElement;
    Object.assign(cv.style, { display: "block", width: "100%", height: "100%", touchAction: "none", outline: "none", transition: "transform 0.35s" });
    cv.setAttribute("aria-label", "Momo Sky Roll game");
    host.appendChild(cv);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
    const m0 = moodOf(L.zones[0].mood);
    this.setPalette(m0, 1, false);
    this.fog = new THREE.Fog(m0.fog, this.view * 0.45, this.view + 4);
    this.scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(m0.hemiSky, m0.hemiGround, m0.hemiI);
    this.sun = new THREE.DirectionalLight(m0.sun, m0.sunI);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.skyU = {
      uTop: { value: this.pal.top }, uMid: { value: this.pal.mid }, uBot: { value: this.pal.bot },
      uSun: { value: new THREE.Vector3(-0.35, 0.35, -1).normalize() }, uSunCol: { value: this.pal.sun }, uStars: { value: 0 }, uTime: { value: 0 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uTop, uMid, uBot, uSun, uSunCol; uniform float uStars, uTime; varying vec3 vD;
        float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        void main(){
          float h = vD.y;
          vec3 c = h > 0.0 ? mix(uMid, uTop, pow(clamp(h * 1.4, 0.0, 1.0), 0.75)) : mix(uMid, uBot, pow(clamp(-h * 2.2, 0.0, 1.0), 0.6));
          float s = max(dot(normalize(vD), uSun), 0.0);
          c += uSunCol * (pow(s, 260.0) * 1.6 + pow(s, 12.0) * 0.28);
          if (uStars > 0.01 && h > -0.05) {
            vec3 g = floor(vD * 160.0); float r = h3(g);
            float tw = 0.6 + 0.4 * sin(uTime * 2.0 + r * 40.0);
            c += vec3(step(0.9965, r) * tw * uStars * smoothstep(-0.05, 0.25, h));
          }
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const tg = tileGeometry();
    this.aSide = new THREE.InstancedBufferAttribute(new Float32Array(TILE_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    this.aGlow = new THREE.InstancedBufferAttribute(new Float32Array(TILE_CAP), 1).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    tg.setAttribute("aSide", this.aSide); tg.setAttribute("aGlow", this.aGlow);
    this.tiles = new THREE.InstancedMesh(tg, tileMaterial(this.u), TILE_CAP);
    this.tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tiles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TILE_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
    this.tiles.frustumCulled = false;
    this.scene.add(this.tiles);

    const decal = (kind: "boost" | "pad" | "crack" | "check", cap: number, opacity = 1) => {
      const g = new THREE.PlaneGeometry(0.78, 0.78).rotateX(-Math.PI / 2);
      const m = new THREE.MeshBasicMaterial({ map: decalTexture(kind), transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -2 });
      const mesh = new THREE.InstancedMesh(g, m, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
      this.scene.add(mesh);
      return mesh;
    };
    this.decals = { boost: decal("boost", 500, 0.95), pad: decal("pad", 300, 0.95), crack: decal("crack", 700, 0.85), check: decal("check", 300, 0.9) };
    {
      const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      this.warn = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: decalTexture("warn"), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 80);
      this.warn.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.warn.frustumCulled = false; this.warn.count = 0;
      this.shadows = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: decalTexture("shadow"), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), 64);
      this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.shadows.frustumCulled = false; this.shadows.count = 0;
      const wg = new THREE.BoxGeometry(0.14, 0.7, 1.0); wg.translate(0, 0.25, 0);
      this.walls = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.55, emissive: 0x6688ff, emissiveIntensity: 0.25 }), 260);
      this.walls.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.walls.frustumCulled = false; this.walls.count = 0;
      this.scene.add(this.warn, this.shadows, this.walls);
    }

    this.pm = propMaterial(this.u);
    {
      const dz = dress(L, q, 2, run ? L.rows.length : L.rows.length + 30);
      this.dressEnd = dz.end;
      this.addProps(dz.items);
    }

    this.ball = ballView(ch);
    this.twin = ballView(ch);
    this.twin.group.visible = false; this.twin.top.visible = false;
    this.scene.add(this.ball.group, this.ball.top, this.twin.group, this.twin.top);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0x7affea, transparent: true, opacity: 0.28, emissive: 0x7affea, emissiveIntensity: 0.6, depthWrite: false }));
    this.shield.visible = false;
    this.scene.add(this.shield);
    this.ghostBall = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, emissive: 0xb8c8ff, emissiveIntensity: 0.6, depthWrite: false }));
    this.ghostBall.visible = false;
    this.scene.add(this.ghostBall);
    {
      const N = 26;
      this.trailPos = new Float32Array(N * 2 * 3);
      this.trailA = new Float32Array(N * 2);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("aA", new THREE.BufferAttribute(this.trailA, 1).setUsage(THREE.DynamicDrawUsage));
      const idx: number[] = [];
      for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      this.trail = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Color(m0.trail) } },
        vertexShader: `attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uC; varying float vA; void main(){ gl_FragColor = vec4(uC * vA, vA); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      this.trail.frustumCulled = false;
      this.trail.visible = q !== "low";
      this.scene.add(this.trail);
    }

    const beadCount = run ? 480 : L.pickups.filter((p) => p.kind === "bead").length;
    if (run) {
      // spinning gold coins
      const face = new THREE.MeshStandardMaterial({ map: coinTexture(), roughness: 0.3, metalness: 0.45, emissive: 0x6a4300, emissiveIntensity: 0.55 });
      const rim = new THREE.MeshStandardMaterial({ color: 0xe8a400, roughness: 0.3, metalness: 0.6, emissive: 0x5a3800, emissiveIntensity: 0.5 });
      this.beads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.055, 24).rotateX(Math.PI / 2), [rim, face, face], beadCount);
    } else this.beads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.15, 2), new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.15, emissive: 0x332211, emissiveIntensity: 0.6 }), Math.max(1, beadCount));
    this.beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beads.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, beadCount) * 3), 3);
    this.beads.frustumCulled = false; this.beads.count = 0;
    this.scene.add(this.beads);
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xffc533, roughness: 0.25, metalness: 0.55, emissive: 0x6a4300, emissiveIntensity: 0.8 });
    this.glowTex = decalTexture("glow");
    this.addPickups();

    this.addHazards();
    this.addBosses();
    this.ensureChase();

    const cpTex = run ? null : bannerTexture("CHECKPOINT", "#ffb000");
    if (cpTex) L.checkpoints.forEach((s, i) => {
      if (i === 0) return;
      const r = L.rows[s];
      const w = r.tiles.length ? r.tiles[r.tiles.length - 1].x - r.tiles[0].x + 1 : 5;
      const g = makeArch(w, cpTex, [0xfff1d6, 0xffb000]);
      g.position.set(r.tiles.length ? (r.tiles[0].x + r.tiles[r.tiles.length - 1].x) / 2 : 0, r.h, -s);
      g.visible = false;
      this.scene.add(g); this.arches.push({ s, g });
    });
    if (!run) {
      const r = L.rows[L.finish];
      const g = makeArch(r.tiles.length, bannerTexture("FINISH", "#ff8a3d", "#ffffff", true), [0xffffff, 0xff8a3d], true);
      g.position.set(0, r.h, -L.finish); g.visible = false;
      this.scene.add(g); this.arches.push({ s: L.finish, g });
    }

    const dot = decalTexture("glow");
    this.fx = new Particles(q === "low" ? 300 : 600, false, dot);
    this.glow = new Particles(q === "low" ? 200 : 420, true, dot);
    this.scene.add(this.fx.points, this.glow.points);
    {
      // speed streaks (rush / booster)
      const N = 44;
      this.streakSeed = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        this.streakSeed[i * 4] = side * (1.8 + Math.random() * 3.6);
        this.streakSeed[i * 4 + 1] = -0.4 + Math.random() * 4.2;
        this.streakSeed[i * 4 + 2] = Math.random();
        this.streakSeed[i * 4 + 3] = 0.6 + Math.random() * 0.8;
      }
      this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), N);
      this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.streaks.frustumCulled = false; this.streaks.visible = false;
      this.scene.add(this.streaks);
    }
    // the revive bubble (endless run: a life was lost, Momo floats on safely)
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 18), new THREE.MeshStandardMaterial({ color: 0xffe0f4, transparent: true, opacity: 0.32, emissive: 0xff9ad8, emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.1, depthWrite: false }));
    this.bubble.visible = false;
    this.scene.add(this.bubble);
  }

  // ---------------------------------------------------------------- building blocks (also used when the run grows)
  private addProps(items: PropItem[]) {
    const byKind = new Map<string, PropItem[]>();
    for (const it of items) { if (!byKind.has(it.k)) byKind.set(it.k, []); byKind.get(it.k)!.push(it); }
    for (const [k, list] of byKind) {
      const have = this.props.get(k);
      if (have) { for (const it of list) have.items.push(it); have.items.sort((a, b) => a.s - b.s); continue; }
      const cap = this.run ? 320 : Math.max(1, list.length);
      const mesh = new THREE.InstancedMesh(propGeometry(k), this.pm, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage) as THREE.InstancedBufferAttribute;
      mesh.frustumCulled = false; mesh.count = 0;
      this.scene.add(mesh);
      this.props.set(k, { mesh, items: list });
    }
  }

  private addPickups() {
    const L = this.L, gold = this.goldMat, glowTex = this.glowTex;
    for (let i = this.pickN; i < L.pickups.length; i++) {
      const p = L.pickups[i];
      if (p.kind === "bead") continue;
      if (p.kind === "sprout") {
        const g = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 8), gold); stem.position.y = -0.05;
        const leaf = new THREE.SphereGeometry(0.14, 12, 8);
        const l1 = new THREE.Mesh(leaf, gold); l1.scale.set(1.6, 0.35, 0.8); l1.position.set(0.16, 0.16, 0); l1.rotation.z = 0.5;
        const l2 = new THREE.Mesh(leaf, gold); l2.scale.set(1.6, 0.35, 0.8); l2.position.set(-0.16, 0.14, 0); l2.rotation.z = -0.5;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
        halo.scale.setScalar(1.3);
        g.add(stem, l1, l2, halo);
        g.userData.id = p.id;
        g.position.set(p.x, p.y, -p.s);
        g.visible = false;
        this.sprouts.push(g); this.scene.add(g);
      } else {
        const o = makePickup(p, glowTex);
        this.extras.push({ p, o }); this.scene.add(o);
      }
    }
    this.pickN = L.pickups.length;
  }

  private addHazards() {
    const L = this.L;
    for (let i = this.hazN; i < L.hazards.length; i++) { const v = makeView(L.hazards[i]); v.v.group.visible = false; this.scene.add(v.v.group); this.hv.push(v); }
    this.hazN = L.hazards.length;
  }

  private addBosses() {
    const L = this.L;
    for (let i = this.zoneN; i < L.zones.length; i++) { const z = L.zones[i]; if (z.boss) { const v = bossView(z.boss); v.group.visible = false; this.scene.add(v.group); this.bosses.push({ zone: i, v }); } }
    this.zoneN = L.zones.length;
  }

  private ensureChase() {
    const L = this.L;
    const chases = new Set(L.zones.map((z) => z.rules.chase).filter(Boolean));
    if (!this.kranky && (chases.has("kranky") || L.zones.some((z) => z.boss === "kranky-giant"))) { this.kranky = makeKranky(); this.kranky.group.scale.setScalar(0.6); this.kranky.group.visible = false; this.scene.add(this.kranky.group); }
    if (!this.boulder && chases.has("boulder")) { this.boulder = rollerView("boulder", 1.3); this.boulder.group.visible = false; this.scene.add(this.boulder.group); }
    if (!this.flood && chases.has("flood")) {
      this.flood = new THREE.Mesh(new THREE.PlaneGeometry(30, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3dc8ff, transparent: true, opacity: 0.7, emissive: 0x1a7aff, emissiveIntensity: 0.3, roughness: 0.15 }));
      this.flood.visible = false; this.scene.add(this.flood);
    }
  }

  /** endless run: more track was glued on (levels.appendChunk) — dress it, build its hazards and pickups, and free what is far behind */
  extend() {
    if (this.disposed) return;
    const L = this.L, cut = this.cam.lastS - 30;
    for (const pr of this.props.values()) { const i = lowerS(pr.items, cut); if (i > 0) pr.items.splice(0, i); }
    const dz = dress(L, this.q, this.dressEnd, L.rows.length);
    this.dressEnd = dz.end;
    this.addProps(dz.items);
    const keep = new Set<unknown>([this.goldMat, this.glowTex]);
    const drop = (o: THREE.Object3D) => { this.scene.remove(o); disposeTree(o, keep); };
    this.hv = this.hv.filter((v) => { if (v.h.s >= cut) return true; drop(v.v.group); return false; });
    this.bosses = this.bosses.filter((b) => { if (L.zones[b.zone].to >= cut) return true; drop(b.v.group); return false; });
    this.sprouts = this.sprouts.filter((g) => { if (L.pickups[g.userData.id as number].s >= cut) return true; drop(g); return false; });
    this.extras = this.extras.filter((e) => { if (e.p.s >= cut) return true; drop(e.o); return false; });
    if (this.touched.size > 200) this.touched.clear();
    this.addPickups();
    this.addHazards();
    this.addBosses();
    this.ensureChase();
  }

  private updateStreaks(bx: number, by: number, s: number) {
    const k = this.reduced ? 0 : clamp01((this.fxK - 0.2) / 0.8);
    const st = this.streaks;
    st.visible = k > 0.02;
    if (!st.visible) return;
    (st.material as THREE.MeshBasicMaterial).opacity = 0.5 * k;
    const seed = this.streakSeed, arr = st.instanceMatrix.array as Float32Array;
    for (let i = 0; i < st.count; i++) {
      const sp = seed[i * 4 + 3];
      const d = frac(seed[i * 4 + 2] + this.time * sp * (0.9 + k * 1.5));
      const zz = s + 26 - d * 30;
      const len = (1.2 + k * 3.6) * sp;
      this.m4.compose(this.v3.set(bx * 0.7 + seed[i * 4], by + seed[i * 4 + 1], -zz), this.q4.identity(), this.s3.set(1, 1, len));
      this.m4.toArray(arr, i * 16);
    }
    st.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- palette
  private setPalette(m: Mood, k: number, dark: boolean) {
    const p = this.pal;
    p.top.lerp(this.tmpC.set(m.sky[0]), k); p.mid.lerp(this.tmpC.set(m.sky[1]), k); p.bot.lerp(this.tmpC.set(m.sky[2]), k);
    p.fog.lerp(this.tmpC.set(m.fog), k); p.sun.lerp(this.tmpC.set(m.sun), k);
    p.hs.lerp(this.tmpC.set(m.hemiSky), k); p.hg.lerp(this.tmpC.set(m.hemiGround), k);
    p.sunI += (m.sunI - p.sunI) * k; p.hemiI += (m.hemiI - p.hemiI) * k; p.stars += (Math.max(m.stars, dark ? 0.8 : 0) - p.stars) * k;
    p.fogK += ((m.fogK ?? 1) - p.fogK) * k; p.dark += ((dark ? 1 : 0) - p.dark) * k;
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setPixelRatio(this.dpr * this.scaleMul);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    const ps = (this.h * this.dpr * this.scaleMul) / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.fx.scale = ps * 0.9; this.glow.scale = ps * 0.9;
  }
  setScale(k: number) { if (Math.abs(k - this.scaleMul) > 0.01) { this.scaleMul = k; this.resize(this.w, this.h); } }
  get scale() { return this.scaleMul; }
  pxPerLane(s: number) {
    const a = this.v3.set(-0.5, 0, -s).project(this.camera).x;
    const b = this.v3.set(0.5, 0, -s).project(this.camera).x;
    return Math.max(8, Math.abs(b - a) * 0.5 * this.w);
  }

  // ---------------------------------------------------------------- effects API
  burst(kind: string, x: number, y: number, s: number, color?: number) {
    const z = -s, c = this.tmpC, R = Math.random;
    const lowK = this.q === "low" ? 0.5 : 1;
    switch (kind) {
      case "bead": c.set(color ?? 0xffffff); for (let i = 0; i < 14 * lowK; i++) { const a = R() * 6.28, sp = 1.5 + R() * 2.5; this.glow.spawn(x, y, z, Math.cos(a) * sp, 1 + R() * 2.5, Math.sin(a) * sp, c, 0.18 + R() * 0.12, 0.5 + R() * 0.3, 3, 2, true); } break;
      case "sprout": case "key": case "statue": case "letter": case "baby": case "box": case "note": case "power":
        for (let i = 0; i < (kind === "sprout" || kind === "statue" ? 40 : 22) * lowK; i++) { const a = R() * 6.28, sp = 1 + R() * 4; c.setHSL(kind === "power" ? R() : 0.12 + R() * 0.04, 1, 0.6 + R() * 0.2); this.glow.spawn(x, y, z, Math.cos(a) * sp, 2 + R() * 4, Math.sin(a) * sp, c, 0.22 + R() * 0.2, 0.9 + R() * 0.6, 4, 1.5, true); }
        break;
      case "life":
        for (let i = 0; i < 34 * lowK; i++) { const a = R() * 6.28, sp = 1 + R() * 3.5; c.setHSL(0.93 + R() * 0.05, 1, 0.62 + R() * 0.15); this.glow.spawn(x, y, z, Math.cos(a) * sp, 2 + R() * 4, Math.sin(a) * sp, c, 0.24 + R() * 0.18, 0.9 + R() * 0.5, 4, 1.5, true); }
        break;
      case "land": case "crumble": case "slam": {
        c.set(kind === "crumble" ? 0xc9a070 : 0xfff6e8);
        const n = (kind === "slam" ? 26 : kind === "land" ? 12 : 8) * lowK;
        for (let i = 0; i < n; i++) { const a = R() * 6.28, sp = (kind === "slam" ? 3 : 1.4) + R() * 1.5; this.fx.spawn(x + Math.cos(a) * 0.2, y + 0.05, z + Math.sin(a) * 0.2, Math.cos(a) * sp, 0.6 + R() * 1.2, Math.sin(a) * sp, c, 0.28 + R() * 0.25, 0.45 + R() * 0.35, 2.5, 3); }
        if (kind === "land") this.ripples.push({ s, x, t: 0, a: 1 });
        if (kind === "slam") { this.cam.shake = Math.max(this.cam.shake, 0.35); this.ripples.push({ s, x, t: 0, a: 2 }); }
        break;
      }
      case "pad": case "boost": case "teleport": case "tile":
        c.set(kind === "pad" ? 0xff7ab8 : kind === "teleport" ? 0x9b6bff : color ?? 0xffe066);
        for (let i = 0; i < 22 * lowK; i++) { const a = R() * 6.28; this.glow.spawn(x + Math.cos(a) * 0.4, y + 0.05, z + Math.sin(a) * 0.4, Math.cos(a) * 1.2, kind === "pad" ? 3 + R() * 3 : 0.5 + R(), kind === "boost" ? 4 + R() * 3 : Math.sin(a) * 1.2, c, 0.2 + R() * 0.15, 0.6, kind === "pad" ? 5 : 0, 1.5, true); }
        if (kind === "boost") this.cam.fov = 11; else if (kind === "pad") this.cam.pull = 1;
        break;
      case "hit":
        for (let i = 0; i < 30 * lowK; i++) { const a = R() * 6.28, sp = 2 + R() * 4; c.setHSL(0.07 + R() * 0.03, 1, 0.55 + R() * 0.2); this.fx.spawn(x, y + 0.3, z, Math.cos(a) * sp, 2 + R() * 4, Math.sin(a) * sp, c, 0.25 + R() * 0.25, 0.7 + R() * 0.4, 9, 1); }
        this.cam.shake = Math.max(this.cam.shake, 0.6);
        break;
      case "shield": c.set(0x7affea); for (let i = 0; i < 30 * lowK; i++) { const a = R() * 6.28; this.glow.spawn(x, y + 0.34, z, Math.cos(a) * 3, R() * 2, Math.sin(a) * 3, c, 0.2, 0.5, 0, 2, true); } break;
      case "checkpoint": case "finish": case "fever": {
        const n = (kind === "finish" ? 140 : kind === "fever" ? 50 : 70) * lowK;
        const cols = [0xff5d8f, 0xffc53d, 0x46d2ff, 0x9b6bff, 0x5fe08a, 0xffffff];
        for (let i = 0; i < n; i++) {
          c.set(cols[i % cols.length]);
          const side = i % 2 ? 1 : -1;
          this.fx.spawn(x + side * 2.6, y + 2.2, z - 1, -side * (1 + R() * 3), 3 + R() * 5, -R() * 2.5, c, 0.11 + R() * 0.09, 1.4 + R() * 1.2, 6, 0.8);
        }
        break;
      }
      case "respawn": c.set(0xffffff); for (let i = 0; i < 24 * lowK; i++) { const a = (i / 24) * 6.28; this.glow.spawn(x, y + 0.3, z, Math.cos(a) * 2.5, 0.5, Math.sin(a) * 2.5, c, 0.2, 0.5, 0, 3, true); } break;
    }
  }
  land(v: number) { this.squash.v -= 6 * v; this.tilt.vx -= 9 * v; if (!this.reduced) this.cam.shake = Math.max(this.cam.shake, 0.12 * v); }
  launch() { this.squash.v += 5; this.tilt.vx += 6; }
  /** race your best run: a see-through ball follows it */
  setGhost(a: Int8Array) { this.ghostX = a; }
  touch(x: number, s: number) { this.touched.set(`${Math.round(s)}:${Math.round(x)}`, this.time); }

  // ---------------------------------------------------------------- frame
  update(sim: Sim, beat: number, dt: number) {
    if (this.disposed) return;
    this.time += dt;
    const L = this.L;
    const s = sim.s, bx = sim.x, by = sim.y;
    const spb = 60 / L.bpm;
    const kick = Math.exp(-frac(beat) * 6);
    const zi = zoneAt(L, Math.max(0, s + 2));
    const zone = L.zones[zi];
    const rules = zone.rules;
    const mood = moodOf(zone.mood);
    this.u.uPulse.value = kick;
    this.u.uNight.value = Math.max(this.pal.stars, this.pal.dark);
    this.skyU.uStars.value = this.pal.stars;
    this.skyU.uTime.value = this.time;
    this.setPalette(mood, Math.min(1, dt * 1.3), !!rules.lightsOut);
    const dk = 1 - this.pal.dark * 0.78;
    this.fog.color.copy(this.pal.fog).multiplyScalar(dk);
    const fogK = this.pal.fogK * (rules.fog ? 0.45 : 1) * (rules.lightsOut ? 0.75 : 1);
    this.fog.near = this.view * 0.45 * fogK; this.fog.far = (this.view + 4) * fogK;
    this.hemi.color.copy(this.pal.hs); this.hemi.groundColor.copy(this.pal.hg); this.hemi.intensity = this.pal.hemiI * dk;
    this.sun.color.copy(this.pal.sun); this.sun.intensity = this.pal.sunI * dk;
    const trailU = (this.trail.material as THREE.ShaderMaterial).uniforms.uC.value as THREE.Color;
    if (sim.fever) trailU.setHSL(frac(this.time * 0.6), 1, 0.6); else trailU.lerp(this.tmpC.set(mood.trail), Math.min(1, dt * 2));

    const s0 = Math.max(0, Math.floor(s) - 9), s1 = Math.min(L.rows.length - 1, Math.floor(s) + this.view);
    const far = s + this.view;
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 0.9);

    // chase: tiles behind Momo collapse
    const chasing = (!!rules.chase || !!zone.boss) && sim.mode !== "ready";
    const chaseEdge = chasing ? s - 3.2 : -1e9;
    // force tilt (tilting boards)
    let tiltZ = 0;
    for (const f of L.forces) if (f.kind === "tilt" && s >= f.s0 - 4 && s <= f.s1 + 4) tiltZ = -0.09 * Math.sin(2 * Math.PI * (beat / (f.period ?? 8) + (f.phase ?? 0)));

    // ---- tiles + decals
    const mat = this.tiles.instanceMatrix.array as Float32Array;
    const col = (this.tiles.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    const side = this.aSide.array as Float32Array, glowA = this.aGlow.array as Float32Array;
    let n = 0;
    const dc = { boost: 0, pad: 0, crack: 0, check: 0 };
    const putDecal = (k: keyof typeof dc, x: number, y: number, z: number, ry: number, sc: number) => {
      const dm = this.decals[k];
      if (dc[k] >= dm.instanceMatrix.count) return;
      this.e3.set(0, ry, 0);
      this.m4.compose(this.v3.set(x, y + 0.012, z), this.q4.setFromEuler(this.e3), this.s3.set(sc, 1, sc));
      this.m4.toArray(dm.instanceMatrix.array as Float32Array, dc[k] * 16);
      dc[k]++;
    };
    const wm = this.walls.instanceMatrix.array as Float32Array;
    let nw = 0;
    for (let r = s0; r <= s1; r++) {
      const row = L.rows[r];
      if (!row.tiles.length) continue;
      const zr = L.zones[row.zone].rules;
      const m = moodOf(L.zones[row.zone].mood);
      const rise = clamp01((far - r) / 14);
      const memoryHide = zr.memory && r > s + 6 && r < s + 30;
      const walled = L.walls.some((w) => r >= w.s0 && r < w.s1);
      for (const t of row.tiles) {
        if (n >= TILE_CAP) break;
        const e = easeBack(clamp01(rise * 1.15 - Math.abs(t.x) * 0.04));
        let y = row.h - 5.5 * (1 - e), rx = 0, rz = tiltZ;
        let sc = 0.55 + 0.45 * Math.min(1, e);
        let x = t.x + (t.mv?.ax === 0 ? tileOffset(t, beat) : 0), z = -r;
        if (t.mv?.ax === 1) y += tileOffset(t, beat);
        let shake = 0, g = 0;
        let c: number = (t.x + r) % 2 ? m.tileA : m.tileB;
        switch (t.k) {
          case TK.boost: c = 0xffd23d; g = 1; break;
          case TK.pad: c = 0xff6fae; g = 1; break;
          case TK.mega: c = 0xff3d8a; g = 1.2; break;
          case TK.check: if (!this.run) { c = 0xffd84d; g = 0.7; } break;
          case TK.finish: c = (t.x + r) % 2 ? 0xffffff : 0x3a2a63; g = 0.15; break;
          case TK.start: c = 0xfff1d6; break;
          case TK.mud: c = 0x8a5a3a; break;
          case TK.ice: c = 0xc9f2ff; g = 0.25; break;
          case TK.sticky: c = 0xff8ad8; break;
          case TK.bouncy: c = 0x7cf27a; g = 0.3; sc *= 1 + 0.08 * kick; break;
          case TK.glass: c = 0xd8f6ff; g = 0.35; break;
          case TK.gold: c = 0xffc533; g = 0.8; break;
          case TK.mirror: c = 0xd0e0ff; g = 0.8; break;
          case TK.gravity: c = 0xb57bff; g = 0.9; break;
          case TK.shrink: c = 0x5dd8ff; g = 0.8; break;
          case TK.grow: c = 0xff8a3d; g = 0.8; break;
          case TK.magnet: c = 0x3d7bff; g = 0.7; break;
          case TK.push: c = 0xffb84d; g = 0.5; break;
          case TK.plate: c = sim.isPressed(t.g ?? -1) ? 0x5fe08a : 0xff5d5d; g = 0.8; break;
          case TK.teleport: c = 0x7a5cff; g = 1; break;
          case TK.updraft: c = 0x8affea; g = 0.9; break;
          case TK.seesaw: c = 0xc8a0ff; rz += Math.sin(this.time * 3 + r) * 0.08; break;
          case TK.piano: { const black = [1, 3, 6].includes((t.note ?? 0) % 7); c = black ? 0x2a2440 : 0xfafaff; const tt = this.touched.get(`${r}:${t.x}`); if (tt !== undefined && this.time - tt < 0.4) { g = 1.2; y -= 0.06; } break; }
          case TK.paint: c = COLORS[t.c ?? 0]; g = 1; break;
          case TK.color: { c = COLORS[t.c ?? 0]; g = 0.5; if (!tileSolid(t, beat, sim.color)) { sc *= 0.55; y -= 0.25; g = 0.1; } break; }
          case TK.blink: { const on = tileSolid(t, beat, sim.color), soon = tileSolid(t, beat + 0.25, sim.color); c = 0xb57bff; g = on ? 0.9 : 0.1; const k = on ? (soon ? 1 : 0.7) : soon ? 0.4 : 0.15; sc *= 0.4 + 0.6 * k; y -= (1 - k) * 0.5; break; }
          case TK.ghost: { const k = Math.max(kick, clamp01(1 - (r - s) / 6)); sc *= 0.25 + 0.75 * k; g = 0.4 * k; break; }
          case TK.bridge: { const on = sim.isPressed(t.g ?? -1) || sim.o.bot; c = 0xd9a066; if (!on) { sc *= 0.15; y -= 1.5; } break; }
          case TK.crumble: {
            c = 0xe6b872;
            if (t.drop !== undefined) {
              const until = t.drop - beat;
              if (until < 1 && until > 0) { shake = 1 - until; x += Math.sin(this.time * 55 + r) * 0.035 * shake; z += Math.cos(this.time * 47 + t.x) * 0.03 * shake; }
              if (until <= 0) { const tt = -until * spb; y -= 9 * tt * tt + tt; rx = tt * 1.6 * (t.x % 2 ? 1 : -1); rz = tt * 1.1; if (y < row.h - 14) continue; }
            }
            break;
          }
        }
        if (memoryHide) { sc *= 0.05; y -= 3; }
        if (zr.beatSteps && r > s + 1) y += 0.12 * kick * ((t.x + r) % 2 ? 1 : 0.5);
        if (zr.lightsOut) g = Math.max(g, 0.15 + 0.9 * kick);
        if (r < chaseEdge) { const tt = (chaseEdge - r) * 0.35; y -= tt * tt * 4; rx = tt * 0.8; rz = (t.x % 2 ? 1 : -1) * tt * 0.6; if (y < row.h - 14) continue; }
        for (const rp of this.ripples) {
          const d = Math.hypot(t.x - rp.x, r - rp.s);
          const w = rp.t * 9 - d;
          if (w > 0 && w < 2.2) y -= Math.sin((w / 2.2) * Math.PI) * 0.07 * rp.a * (1 - rp.t / 0.9);
        }
        this.e3.set(rx, 0, rz);
        this.m4.compose(this.v3.set(x, y, z), this.q4.setFromEuler(this.e3), this.s3.set(sc, sc, sc));
        this.m4.toArray(mat, n * 16);
        this.tmpC.set(c);
        if (shake > 0) this.tmpC.lerp(this.tmpC2.set(0xff6a4a), shake * 0.55);
        col[n * 3] = this.tmpC.r; col[n * 3 + 1] = this.tmpC.g; col[n * 3 + 2] = this.tmpC.b;
        this.tmpC.set(m.side);
        side[n * 3] = this.tmpC.r; side[n * 3 + 1] = this.tmpC.g; side[n * 3 + 2] = this.tmpC.b;
        glowA[n] = g;
        if (e > 0.5 && !memoryHide) {
          const mid = t.x === row.tiles[Math.floor(row.tiles.length / 2)].x;
          if (t.k === TK.boost) putDecal("boost", x, y, z, 0, sc * (1 + 0.08 * kick));
          else if (t.k === TK.push) putDecal("boost", x, y, z, (t.dir ?? 1) > 0 ? -Math.PI / 2 : Math.PI / 2, sc);
          else if (t.k === TK.pad || t.k === TK.mega || t.k === TK.teleport || t.k === TK.updraft) putDecal("pad", x, y, z, t.k === TK.teleport ? this.time * 3 : 0, sc * (t.k === TK.mega ? 1.15 : 1) * (1 + 0.08 * kick));
          else if (t.k === TK.crumble || t.k === TK.glass) putDecal("crack", x, y, z, 0, sc);
          else if ((t.k === TK.check && mid && !this.run) || t.k === TK.gold || t.k === TK.paint || t.k === TK.mirror || t.k === TK.gravity || t.k === TK.shrink || t.k === TK.grow) putDecal("check", x, y, z, this.time, sc * 0.8);
          for (const f of L.forces) if (f.kind === "conveyor" && r >= f.s0 && r <= f.s1 && mid) putDecal("boost", x, y, z, Math.sin(2 * Math.PI * (beat / (f.period ?? 6) + (f.phase ?? 0))) > 0 ? -Math.PI / 2 : Math.PI / 2, sc);
        }
        n++;
      }
      if (walled && nw < 258) {
        for (const sd of [-1, 1]) {
          const tx = sd < 0 ? row.tiles[0].x - 0.58 : row.tiles[row.tiles.length - 1].x + 0.58;
          this.m4.compose(this.v3.set(tx, row.h - 5.5 * (1 - easeBack(rise)), -r), this.q4.setFromEuler(this.e3.set(0, 0, sd * 0.25)), this.s3.set(1, 1, 1));
          this.m4.toArray(wm, nw * 16); nw++;
        }
      }
    }
    this.tiles.count = n;
    this.tiles.instanceMatrix.needsUpdate = true;
    (this.tiles.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    this.aSide.needsUpdate = true; this.aGlow.needsUpdate = true;
    for (const k of ["boost", "pad", "crack", "check"] as const) { this.decals[k].count = dc[k]; this.decals[k].instanceMatrix.needsUpdate = true; }
    this.walls.count = nw; this.walls.instanceMatrix.needsUpdate = true;

    // ---- props
    for (const { mesh, items } of this.props.values()) {
      const arr = mesh.instanceMatrix.array as Float32Array;
      const ca = (mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
      let k = 0, lo = 0, hi = items.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid].s < s0 - 4) lo = mid + 1; else hi = mid; }
      for (let i = lo; i < items.length; i++) {
        const it = items[i];
        if (it.s > s1 + 10 || k >= mesh.instanceMatrix.count) break;
        const e = easeBack(clamp01((far + 8 - it.s) / 16));
        const bob = it.island || it.cloud ? 0 : 0.05 * Math.exp(-frac(beat + it.ph) * 5);
        const yy = it.y - 6 * (1 - e) + (it.island ? Math.sin(this.time * 0.6 + it.ph * 6) * 0.08 : 0) + (it.cloud ? Math.sin(this.time * 0.2 + it.ph * 6) * 0.5 : 0);
        const sc = it.sc * Math.max(0.01, e);
        const drift = it.cloud ? Math.sin(this.time * 0.05 + it.ph * 9) * 2 : 0;
        this.e3.set(0, it.ry + (it.cloud ? this.time * 0.01 : 0), it.island || it.cloud ? 0 : Math.sin(this.time * 1.4 + it.ph * 9) * 0.03);
        this.m4.compose(this.v3.set(it.x + drift, yy, -it.s), this.q4.setFromEuler(this.e3), this.s3.set(sc * (1 - bob * 0.5), sc * (1 + bob), sc * (1 - bob * 0.5)));
        this.m4.toArray(arr, k * 16);
        ca[k * 3] = it.c.r; ca[k * 3 + 1] = it.c.g; ca[k * 3 + 2] = it.c.b;
        k++;
      }
      mesh.count = k;
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }

    // ---- shadows
    const sh = this.shadows.instanceMatrix.array as Float32Array;
    let ns = 0;
    const shadow = (x: number, s2: number, size: number) => {
      if (ns >= 64) return;
      const sup = sim.support(x, s2, beat);
      if (!sup) return;
      this.m4.compose(this.v3.set(x, sup.floor + 0.01, -s2), this.q4.identity(), this.s3.set(size, 1, size));
      this.m4.toArray(sh, ns * 16); ns++;
    };
    if (sim.mode !== "fall" && sim.mode !== "dead" && sim.mode !== "hit") shadow(bx, s, Math.max(0.35, 0.95 - (by - sim.floorAt(s)) * 0.25) * sim.size);

    // ---- hazards
    const wmk = this.warn.instanceMatrix.array as Float32Array;
    let nwarn = 0;
    const floorOf = (r: number) => L.rows[Math.max(0, Math.min(L.rows.length - 1, Math.round(r)))].h;
    for (const hv of this.hv) {
      const h = hv.h;
      const g = hv.v.group;
      if (hv.a === "roller") {
        const rs = rollerS(h, beat);
        const vis = rs > s - 4 && rs < s1;
        g.visible = vis;
        if (!vis) continue;
        g.position.set(h.x, floorOf(rs), -rs);
        hv.v.roll.rotation.x = rs / ROLLER_R;
        shadow(h.x, rs, 1.1);
        continue;
      }
      const vis = h.s > s0 - 3 && h.s < s1 - 1;
      g.visible = vis;
      if (!vis) continue;
      const e = easeBack(clamp01((far - h.s) / 14));
      const fy = floorOf(h.s) - 6 * (1 - e);
      switch (hv.a) {
        case "mallet": {
          const a = malletAngle(h, beat);
          const hx = MALLET_LEN * Math.sin(a), hy = MALLET_PIVOT_Y - MALLET_LEN * Math.cos(a);
          g.position.set(h.x, fy, -h.s);
          hv.v.head.position.set(hx, hy, 0); hv.v.head.rotation.z = a;
          hv.v.rope.position.set(hx / 2, (MALLET_PIVOT_Y + hy) / 2, 0); hv.v.rope.rotation.z = a; hv.v.rope.scale.y = MALLET_LEN - 0.3;
          hv.v.top.position.set(0, MALLET_PIVOT_Y + 0.2, 0);
          shadow(h.x + hx, h.s, 0.9 + (hy - 0.5) * 0.4);
          break;
        }
        case "daisy": g.position.set(h.x, fy, -h.s); hv.v.spin.rotation.y = daisyAngle(h, beat); g.scale.setScalar(1 + 0.03 * kick); break;
        case "claw": {
          const lift = clawLift(h, beat);
          const until = clawSlamNear(h, beat) - beat;
          g.position.set(h.x, floorOf(h.s) + lift * 10, -h.s);
          g.visible = lift < 0.999;
          hv.v.setOpen(until > 0 ? 1 : 0.15);
          if (until < CLAW_WARN && until > -0.6 && nwarn < 76) {
            const p = 1 + 0.12 * Math.sin(this.time * 18);
            for (let x = Math.round(h.x - h.size); x <= Math.round(h.x + h.size); x++) {
              this.m4.compose(this.v3.set(x, floorOf(h.s) + 0.015, -h.s), this.q4.identity(), this.s3.set(0.95 * p, 1, 0.95 * p));
              this.m4.toArray(wmk, nwarn * 16); nwarn++;
            }
          }
          break;
        }
        case "slider": g.position.set(sliderX(h, beat), fy + sliderHop(h, beat), -h.s); hv.v.tick?.(this.time, beat); break;
        case "popper": {
          const up = popperUp(h, beat);
          g.position.set(h.x, fy, -h.s);
          hv.v.setUp(up);
          const next = popperUp(h, beat + 0.5);
          if (up < 0.05 && next > 0.05 && nwarn < 76) { this.m4.compose(this.v3.set(h.x, floorOf(h.s) + 0.015, -h.s), this.q4.identity(), this.s3.set(0.8, 1, 0.8)); this.m4.toArray(wmk, nwarn * 16); nwarn++; }
          break;
        }
        case "laser": g.position.set(h.x, fy, -h.s); hv.v.setOn(laserOn(h, beat)); break;
      }
    }
    this.warn.count = nwarn; this.warn.instanceMatrix.needsUpdate = true;

    // ---- bosses + chase visuals
    for (const b of this.bosses) {
      const z = L.zones[b.zone];
      const near = s > z.from - 40 && s < z.to + 6;
      b.v.group.visible = near;
      if (!near) continue;
      const k = clamp01((s - z.from + 10) / 14) * clamp01((z.to + 6 - s) / 8);
      b.v.group.position.set((b.zone % 2 ? -1 : 1) * 7.5, floorOf(s) + 1 - (1 - k) * 8, -(s + 17));
      b.v.group.rotation.y = (b.zone % 2 ? 0.5 : -0.5);
      b.v.update(this.time, beat, k);
    }
    const chaseKind = rules.chase ?? (zone.boss === "kranky-giant" ? "kranky" : null);
    if (this.kranky) {
      const k = this.kranky;
      const on = chaseKind === "kranky" && sim.mode !== "done";
      k.group.visible = on;
      if (on) {
        const ks = sim.mode === "ready" ? s - 5.2 : s - 4.4 + Math.sin(beat * Math.PI) * 0.2;
        k.group.position.x += (bx * 0.6 - k.group.position.x) * Math.min(1, dt * 2.5);
        k.group.position.z = -ks; k.group.position.y = floorOf(ks) + Math.abs(Math.sin(beat * Math.PI)) * 0.25;
        k.group.rotation.y = Math.PI + Math.sin(beat * Math.PI) * 0.12;
        const snap = Math.max(0, Math.sin(beat * Math.PI * 2)) * 0.5;
        k.claws[0].rotation.z = 0.3 + snap; k.claws[1].rotation.z = -0.3 - snap;
      }
    }
    if (this.boulder) {
      const on = chaseKind === "boulder";
      this.boulder.group.visible = on;
      if (on) { const bs = s - 5; this.boulder.group.position.set(bx * 0.4, floorOf(bs), -bs); this.boulder.roll.rotation.x = bs / 1.3; }
    }
    if (this.flood) {
      const on = chaseKind === "flood";
      this.flood.visible = on;
      if (on) this.flood.position.set(bx * 0.5, floorOf(s) - 0.35 + Math.sin(this.time * 2) * 0.08, -(s - 9));
    }

    // ---- arches
    for (const a of this.arches) {
      const vis = a.s > s0 && a.s < s1;
      a.g.visible = vis;
      if (!vis) continue;
      const e = easeBack(clamp01((far - a.s) / 14));
      a.g.position.y = floorOf(a.s) - 6 * (1 - e);
      a.g.scale.setScalar(1 + (a.s === L.finish ? 0.04 * kick : 0));
      const sign = a.g.userData.sign as THREE.Object3D | undefined;
      if (sign) { const k = easeBack(clamp01((s - (a.s - 3.2)) / 2.2)); sign.rotation.x = -1.35 * k; sign.position.y = (a.g.userData.signY as number) + k * 0.5; }
    }

    // ---- pickups
    {
      const arr = this.beads.instanceMatrix.array as Float32Array;
      const ca = (this.beads.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
      let k = 0;
      const magnet = sim.has("A07") || sim.boosting ? 2.2 : 0;
      const cap = this.beads.instanceMatrix.count;
      for (let pi = lowerS(L.pickups, s0); pi < L.pickups.length; pi++) {
        const p = L.pickups[pi];
        if (p.s > s1 || k >= cap) break;
        if (p.kind !== "bead" || sim.got[p.id]) continue;
        const e = clamp01((far - p.s) / 10);
        let px = p.x, ps = p.s, py = floorOf(p.s) + p.y + Math.sin(beat * Math.PI + p.s) * 0.06;
        if (magnet && Math.abs(p.s - s) < magnet + 1.5 && Math.abs(p.x - bx) < magnet + 1) { const t = 0.35; px += (bx - px) * t; ps += (s - ps) * t; py += (by + 0.34 - py) * t; }
        if (this.run) this.e3.set(0, Math.sin(this.time * 2.6 + p.s * 0.45) * 1.05, 0);
        else this.e3.set(this.time * 1.3 + p.s, this.time * 2 + p.id, 0);
        const sc = (0.8 + 0.2 * kick) * e;
        this.m4.compose(this.v3.set(px, py, -ps), this.q4.setFromEuler(this.e3), this.s3.set(sc, sc, sc));
        this.m4.toArray(arr, k * 16);
        if (this.run) { this.tmpC.setRGB(1, 1, 1); if (sim.fever) this.tmpC.setHSL(frac(this.time * 0.8 + p.id * 0.13), 1, 0.8); }
        else {
          const m = moodOf(L.zones[L.rows[Math.min(L.rows.length - 1, Math.round(p.s))].zone].mood);
          this.tmpC.set(sim.fever ? 0xffffff : m.beads[p.id % m.beads.length]);
          if (sim.fever) this.tmpC.setHSL(frac(this.time * 0.8 + p.id * 0.13), 1, 0.6);
        }
        ca[k * 3] = this.tmpC.r; ca[k * 3 + 1] = this.tmpC.g; ca[k * 3 + 2] = this.tmpC.b;
        k++;
      }
      this.beads.count = k;
      this.beads.instanceMatrix.needsUpdate = true;
      (this.beads.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
      for (const g of this.sprouts) {
        const id = g.userData.id as number;
        const p = L.pickups[id];
        const vis = !sim.got[id] && p.s > s0 && p.s < s1;
        g.visible = vis;
        if (vis) { g.rotation.y = this.time * 2.2; g.position.y = floorOf(p.s) + p.y + 0.08 + Math.sin(this.time * 3) * 0.08; g.scale.setScalar(1 + 0.1 * kick); }
      }
      for (const { p, o } of this.extras) {
        const vis = !sim.got[p.id] && p.s > s0 && p.s < s1;
        o.visible = vis;
        if (vis) { o.rotation.y = this.time * 1.8; o.position.y = floorOf(p.s) + p.y + 0.12 + Math.sin(this.time * 2.6 + p.id) * 0.08; o.scale.setScalar(1 + 0.08 * kick); }
      }
    }

    // ---- ball
    const b = this.ball;
    const vx = (bx - b.group.position.x) / Math.max(1e-3, dt);
    const ds = s - this.cam.lastS;
    this.cam.lastS = s;
    const R = 0.34 * sim.size;
    b.group.position.set(bx, by + R, -s);
    if (sim.mode === "roll" || sim.mode === "jump" || sim.mode === "done" || sim.mode === "fall" || sim.mode === "revive") {
      if (Math.abs(ds) < 3) {
        this.q4.setFromAxisAngle(this.v3.set(1, 0, 0), -ds / R);
        b.body.quaternion.premultiply(this.q4);
        this.q4.setFromAxisAngle(this.v3.set(0, 0, 1), -(vx * dt) / R);
        b.body.quaternion.premultiply(this.q4);
      }
    }
    this.squash.v += (-this.squash.k * 120 - this.squash.v * 10) * dt;
    this.squash.k += this.squash.v * dt;
    const sq = Math.max(-0.3, Math.min(0.3, this.squash.k));
    b.group.scale.set((1 - sq * 0.6) * sim.size, (1 + sq) * sim.size, (1 - sq * 0.6) * sim.size);
    const acc = (vx - this.lastVx) / Math.max(1e-3, dt);
    this.lastVx = vx;
    this.tilt.vz += (-this.tilt.z * 160 - this.tilt.vz * 9 + acc * 0.02) * dt; this.tilt.z += this.tilt.vz * dt;
    this.tilt.vx += (-this.tilt.x * 160 - this.tilt.vx * 9) * dt; this.tilt.x += this.tilt.vx * dt;
    b.top.position.set(bx, by + R + R * 0.94 * (1 + sq), -s);
    b.top.scale.setScalar(sim.size);
    b.top.rotation.set(-0.25 + Math.max(-0.6, Math.min(0.6, this.tilt.x)), 0, Math.max(-0.7, Math.min(0.7, this.tilt.z)));
    const showBall = sim.mode !== "dead";
    b.group.visible = showBall; b.top.visible = showBall;
    const ghost = sim.has("A13") || sim.has("A03");
    const bm = b.body.material as THREE.MeshStandardMaterial;
    if (bm.transparent !== ghost) { bm.transparent = ghost; bm.opacity = ghost ? 0.5 : 1; bm.needsUpdate = true; }
    if (ghost && this.run) bm.opacity = Math.sin(this.time * 28) > 0 ? 0.8 : 0.3;
    const rev = sim.mode === "revive";
    this.bubble.visible = rev;
    if (rev) { this.bubble.position.copy(b.group.position); this.bubble.scale.setScalar(sim.size * (1 + 0.08 * kick + Math.sin(this.time * 5) * 0.03)); this.bubble.rotation.y = this.time; }
    this.shield.visible = sim.shield && showBall;
    if (this.shield.visible) { this.shield.position.copy(b.group.position); this.shield.scale.setScalar(sim.size * (1 + 0.06 * kick)); }
    const twin = sim.has("A08");
    this.twin.group.visible = twin; this.twin.top.visible = twin;
    if (twin) { this.twin.group.position.set(-bx, by + R, -s); this.twin.body.quaternion.copy(b.body.quaternion); this.twin.top.position.set(-bx, by + R * 1.94, -s); }
    if (sim.has("A12") && Math.random() < dt * 40) { this.tmpC.setHSL(0.06 + Math.random() * 0.06, 1, 0.6); this.glow.spawn(bx + (Math.random() - 0.5) * 0.2, by + 0.1, -s + 0.3, (Math.random() - 0.5), -2, 2, this.tmpC, 0.25, 0.35, 0, 1, false); }
    // speed rush / booster: streaks, wider FOV and a comet tail
    this.fxK += (this.speedFx - this.fxK) * Math.min(1, dt * 2.5);
    this.updateStreaks(bx, by, s);
    if (this.fxK > 0.3 && Math.random() < dt * 45 * Math.min(1.4, this.fxK)) { this.tmpC.setHSL(sim.boosting ? 0.52 + Math.random() * 0.06 : 0.1 + Math.random() * 0.05, 1, 0.65); this.glow.spawn(bx + (Math.random() - 0.5) * 0.35, by + 0.15 + Math.random() * 0.4, -s + 0.35, (Math.random() - 0.5) * 0.6, 0.3, 3, this.tmpC, 0.2, 0.45, 0, 1, false); }
    if (sim.fever && Math.random() < dt * 30) { this.tmpC.setHSL(Math.random(), 1, 0.65); this.glow.spawn(bx + (Math.random() - 0.5) * 0.8, by + 0.4 + Math.random() * 0.4, -s + 0.2, (Math.random() - 0.5) * 2, 1 + Math.random(), 1.5, this.tmpC, 0.16, 0.6, 1, 1, true); }

    if (this.ghostX && (sim.mode === "roll" || sim.mode === "jump")) {
      const gi = Math.max(0, Math.min(this.ghostX.length - 1, Math.round(s)));
      const gx = this.ghostX[gi] / 16;
      this.ghostBall.visible = Math.abs(gx - bx) > 0.25;
      this.ghostBall.position.set(gx, sim.floorAt(s) + 0.34, -s);
    } else this.ghostBall.visible = false;

    // ---- trail
    if (this.trail.visible) {
      const pts = this.trailPts;
      if (sim.mode === "roll" || sim.mode === "jump" || sim.mode === "done" || sim.mode === "revive") {
        const v = pts.length >= 26 ? pts.pop()! : new THREE.Vector3();
        pts.unshift(v.set(bx, by + 0.2 * sim.size, -s));
      } else if (pts.length) pts.pop();
      const N = 26;
      for (let i = 0; i < N; i++) {
        const p = pts[Math.min(i, pts.length - 1)];
        const w = 0.22 * sim.size * (1 - i / N) * (sim.fever ? 1.5 : 1);
        const a = pts.length > 1 ? (1 - i / N) * (sim.fever ? 0.8 : 0.55) * (i < pts.length ? 1 : 0) : 0;
        const px = p ? p.x : bx, py = p ? p.y : by, pz = p ? p.z : -s;
        this.trailPos[i * 6] = px - w; this.trailPos[i * 6 + 1] = py; this.trailPos[i * 6 + 2] = pz;
        this.trailPos[i * 6 + 3] = px + w; this.trailPos[i * 6 + 4] = py; this.trailPos[i * 6 + 5] = pz;
        this.trailA[i * 2] = a; this.trailA[i * 2 + 1] = a;
      }
      const g = this.trail.geometry;
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    }

    // ---- ambient particles + forces
    this.ambientT += dt * (this.q === "low" ? 9 : this.q === "medium" ? 16 : 24);
    while (this.ambientT > 1) { this.ambientT -= 1; this.ambient(mood.particles, bx, s, by); }
    for (const f of L.forces) {
      if (s < f.s0 - 6 || s > f.s1 || Math.random() > dt * 30) continue;
      const dir = f.period ? Math.sign(Math.sin(2 * Math.PI * (beat / f.period + (f.phase ?? 0)))) : Math.sign(f.ax);
      const R2 = Math.random;
      if (f.kind === "wind") { this.tmpC.set(0xffffff); this.fx.spawn(bx - dir * 6, by + 0.3 + R2() * 2, -(s + 2 + R2() * 10), dir * 9, 0, 0, this.tmpC, 0.06, 0.8, 0, 0); }
      else if (f.kind === "beam") { this.tmpC.set(0x7affea); this.glow.spawn(bx + dir * R2() * 2, by + 3 + R2() * 2, -(s + R2() * 6), 0, -2, 0, this.tmpC, 0.14, 0.8, 0, 0, true); }
      else if (f.kind === "water") { this.tmpC.set(0x46c8ff); this.fx.spawn(bx - dir * 5, by + 0.2, -(s + 1 + R2() * 8), dir * 7, 2 + R2() * 2, 0, this.tmpC, 0.12, 0.7, 6, 0); }
      else if (f.kind === "magnet") { this.tmpC.set(0x3d7bff); this.glow.spawn((f.to ?? 0) + (R2() - 0.5) * 4, by + 0.3, -(s + R2() * 6), 0, 0.5, 0, this.tmpC, 0.12, 0.6, 0, 0, true); }
    }
    this.fx.update(dt, this.time);
    this.glow.update(dt, this.time);

    // ---- camera
    this.updateCamera(sim, dt, vx, zone.cam, zi, beat);
    this.sky.position.copy(this.camera.position);
    this.sun.target.position.set(bx, by, -s); this.sun.position.set(bx - 6, by + 12, -s + 4);
    this.renderer.render(this.scene, this.camera);
  }

  private ambient(kind: PKind, bx: number, s: number, by: number) {
    const R = Math.random, c = this.tmpC;
    const x = bx + (R() - 0.5) * 16, zs = s + 4 + R() * 26, y = by + R() * 4;
    switch (kind) {
      case "petals": c.set(R() < 0.5 ? 0xffb3d0 : 0xffffff); this.fx.spawn(x, y + 3, -zs, 0.6 + R() * 0.4, -0.5, 0.3, c, 0.13, 4, 0.2, 0.3); break;
      case "pollen": c.set(0xffe27a); this.glow.spawn(x, y, -zs, (R() - 0.5) * 0.3, 0.2 * R(), 0, c, 0.08, 3.5, 0, 0.1, true); break;
      case "spores": c.set(R() < 0.5 ? 0x8affea : 0xd6a8ff); this.glow.spawn(x, y - 1, -zs, (R() - 0.5) * 0.2, 0.5 + R() * 0.4, 0, c, 0.12, 4, -0.02, 0.2, true); break;
      case "leaves": c.set(R() < 0.5 ? 0xff9a3d : 0xffc24d); this.fx.spawn(x, y + 3, -zs, 1 + R(), -0.6, 0.4, c, 0.15, 4, 0.25, 0.3); break;
      case "fireflies": c.set(R() < 0.6 ? 0xd8ff7a : 0xfff27a); this.glow.spawn(x, y, -zs, (R() - 0.5) * 0.6, (R() - 0.5) * 0.3, (R() - 0.5) * 0.6, c, 0.13, 3.5, 0, 0.2, true); break;
      case "clippings": c.set(R() < 0.5 ? 0x6cd24a : 0x9be36a); this.fx.spawn(x, y + 2, -zs, (R() - 0.5) * 2, -0.8, 1.5, c, 0.1, 3, 0.4, 0.2); break;
      case "snow": c.set(0xffffff); this.fx.spawn(x, y + 4, -zs, (R() - 0.5) * 0.6, -0.9, 0, c, 0.12, 5, 0.05, 0.2); break;
      case "bubbles": c.set(0xbff4ff); this.glow.spawn(x, y - 2, -zs, (R() - 0.5) * 0.3, 0.9, 0, c, 0.16, 4, -0.05, 0.1, true); break;
      case "embers": case "sparks": c.set(R() < 0.5 ? 0xff8a3d : 0xffd23d); this.glow.spawn(x, y - 1, -zs, (R() - 0.5) * 0.8, 1 + R(), 0, c, kind === "sparks" ? 0.07 : 0.1, 2.5, -0.1, 0.3, true); break;
      case "ash": c.set(0x8a8a8a); this.fx.spawn(x, y + 3, -zs, (R() - 0.5) * 0.4, -0.5, 0, c, 0.1, 4, 0.05, 0.2); break;
      case "notes": c.setHSL(R(), 0.9, 0.65); this.glow.spawn(x, y, -zs, (R() - 0.5) * 0.4, 0.6, 0, c, 0.16, 3, 0, 0.1, true); break;
      case "confetti": c.setHSL(R(), 1, 0.6); this.fx.spawn(x, y + 4, -zs, (R() - 0.5), -1.2, 0, c, 0.1, 4, 0.1, 0.4); break;
      case "dust": case "sand": c.set(kind === "sand" ? 0xf0d090 : 0xd8c8b0); this.fx.spawn(x, y, -zs, 1.5 + R(), 0.1, 0, c, 0.08, 3, 0, 0.1); break;
      case "stars": case "glitter": c.setHSL(kind === "glitter" ? R() : 0.15, 0.8, 0.8); this.glow.spawn(x, y + 1, -zs, 0, 0, 0, c, 0.1, 2.5, 0, 0, true); break;
      case "rain": c.set(0x9fc8ff); this.fx.spawn(x, y + 5, -zs, 0, -9, 0, c, 0.05, 0.9, 0, 0); break;
    }
  }

  private updateCamera(sim: Sim, dt: number, vx: number, mode: CamMode, zi: number, beat: number) {
    const c = this.cam;
    if (zi !== c.zone) { c.zone = zi; c.zoneT = 0; }
    c.zoneT += dt;
    const flipped = sim.flipped;
    const want: CamMode = flipped ? "upside" : mode;
    if (want !== c.mode) { c.mode = want; c.blend = 0; }
    c.blend = Math.min(1, c.blend + dt * 1.2);
    const aspect = this.w / this.h;
    const portrait = clamp01((1.25 - aspect) / 0.75);
    const rushK = Math.min(1.4, this.fxK);
    let back = 5.4 + portrait * 2.1 + rushK * 0.45, up = 3.1 + portrait * 1.35;
    let fovBase = 54 + portrait * 12 + rushK * 8;
    const done = sim.mode === "done";
    c.x += (sim.x * 0.8 - c.x) * Math.min(1, dt * (sim.mode === "fall" ? 1.5 : 6));
    const ground = sim.floorAt(sim.s);
    const wantY = (sim.mode === "jump" ? (sim.y - ground) * 0.5 : sim.mode === "hit" ? Math.max(0, (sim.y - ground) * 0.3) : 0) + ground;
    c.y += (wantY - c.y) * Math.min(1, dt * 4);
    c.pull += ((sim.mode === "jump" ? 1 : 0) - c.pull) * Math.min(1, dt * 2.5);
    c.fov += (0 - c.fov) * Math.min(1, dt * 2.2);
    c.roll += (-vx * 0.01 - c.roll) * Math.min(1, dt * 5);
    c.shake = Math.max(0, c.shake - dt * 1.6);
    c.orbit = done ? c.orbit + dt * 0.35 : 0;
    const s = sim.s;
    const fall = sim.mode === "fall" ? Math.min(2.2, -(sim.y - ground) * 0.35) : 0;
    let roll = this.reduced ? 0 : c.roll;
    let px = c.x, py = up + c.y + c.pull * 0.9 + fall * 0.6, pz = -s + back + c.pull;
    let lx = c.x * 0.75 + sim.x * 0.25, ly = c.y - fall * 0.8, lz = -s - 6;
    const k = this.reduced ? 1 : smooth(c.blend);
    let flip = false;
    switch (c.mode) {
      case "top": py = c.y + 9 + portrait * 3; pz = -s + 2.6; lz = -s - 3.5; fovBase += 4; break;
      case "side": px = sim.x + 5.5; py = c.y + 3.6; pz = -s + 3.6; lx = sim.x - 0.5; lz = -s - 4; break;
      case "reverse": py = c.y + up * 0.9; pz = -s - 6; lz = -s + 3; flip = true; break;
      case "dutch": roll += 0.28; break;
      case "wide": back *= 1.5; up *= 1.45; py = up + c.y; pz = -s + back; fovBase += 8; break;
      case "low": py = c.y + 1.3; pz = -s + 3.4; ly = c.y + 0.9; lz = -s - 10; break;
      case "quarter": { const a = Math.sin(Math.min(1, c.zoneT / 6) * Math.PI) * 1.05; px = sim.x + Math.sin(a) * back; pz = -s + Math.cos(a) * back; break; }
      case "upside": roll += Math.PI; flip = true; break;
      case "mirror": flip = true; break;
      case "spin": roll += Math.sin((beat / 16) * Math.PI * 2) * 0.7; break;
      case "flyby": if (c.zoneT < 4) { const a = (c.zoneT / 4) * Math.PI * 1.2; px = sim.x + Math.sin(a) * 6; pz = -s + Math.cos(a) * 6; py = c.y + 3; lx = sim.x; lz = -s; } break;
    }
    if (done) { const a = Math.min(1.1, c.orbit); px = sim.x + Math.sin(a) * back * 1.1; pz = -s + Math.cos(a) * back * 1.1; py = c.y + up * (1 + a * 0.2); lx = sim.x; ly = c.y + 0.3; lz = -s; roll = 0; flip = false; }
    // blend from the chase position into special modes
    if (c.mode !== "chase" && !done && k < 1) {
      const bx = c.x, bY = up + c.y + c.pull * 0.9, bz = -s + back + c.pull;
      px = bx + (px - bx) * k; py = bY + (py - bY) * k; pz = bz + (pz - bz) * k;
    }
    this.viewFlip = flip;
    const sk = this.shakeOn && !this.reduced ? c.shake * c.shake : 0;
    this.camera.position.set(px + (Math.random() - 0.5) * sk, py + (Math.random() - 0.5) * sk, pz);
    this.camera.up.copy(UP);
    this.camera.lookAt(lx, ly, lz);
    if (roll) this.camera.rotateZ(roll * (c.mode === "upside" ? k : 1));
    const fov = fovBase + c.fov + c.pull * 3;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const seen = new Set<unknown>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); }
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mt of mats) {
        if (seen.has(mt)) continue;
        seen.add(mt);
        for (const v of Object.values(mt as unknown as Record<string, unknown>)) if (v instanceof THREE.Texture && !seen.has(v)) { seen.add(v); v.dispose(); }
        const su = (mt as THREE.ShaderMaterial).uniforms;
        if (su) for (const v of Object.values(su)) if (v.value instanceof THREE.Texture && !seen.has(v.value)) { seen.add(v.value); v.value.dispose(); }
        mt.dispose();
      }
    });
    this.tiles.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t);

// dev/QA: let headless checks build every skin
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __rollSkins?: unknown }).__rollSkins = { ballView, bossView, dropperView, laserView, pendulumView, popperView, rollerView, sliderView, spinnerView, propGeometry };
}
