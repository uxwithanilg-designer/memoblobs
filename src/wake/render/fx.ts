// Wake Racers' effects: pooled particles (spray off the hulls, landing splashes, waterfall mist, smoke and ash, sparks,
// coin sparkles, nitro flames, confetti, mine blasts) drawn as two point clouds (soft and glowing), the foamy V wakes
// behind every boat (crest lines that spread and fade, white churn at the stern), and the world's weather around the
// camera (rain streaks, snow, petals, ash with embers, fireflies, neon sparks, blowing dust, glowing spores).
// Everything is allocated once; the per-frame update only rewrites typed arrays.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import type { Weather } from "../worlds";
import { dotTexture } from "./kit";

const PVERT = `attribute float aSize; attribute vec4 aColor; varying vec4 vColor; uniform float uScale;
void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PFRAG = `uniform sampler2D uTex; varying vec4 vColor; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor.rgb, vColor.a * t.a); if (gl_FragColor.a < 0.01) discard;
  #include <colorspace_fragment>
}`;

export type FxKind = "spray" | "splash" | "mist" | "smoke" | "confetti" | "spark" | "sparkle" | "flame" | "blast" | "foam";
interface Preset { size: [number, number]; life: [number, number]; grav: number; drag: number; alpha: number; glow: boolean; colors: string[] }
const PRESETS: Record<FxKind, Preset> = {
  spray: { size: [0.5, 1.1], life: [0.45, 0.8], grav: -15, drag: 0.6, alpha: 0.85, glow: false, colors: ["#ffffff", "#e8f6ff"] },
  splash: { size: [0.9, 2.2], life: [0.6, 1.1], grav: -17, drag: 0.4, alpha: 0.9, glow: false, colors: ["#ffffff", "#dff3ff"] },
  foam: { size: [1.2, 2.4], life: [0.8, 1.4], grav: 0, drag: 2.5, alpha: 0.55, glow: false, colors: ["#ffffff"] },
  mist: { size: [3, 6.5], life: [1.4, 2.4], grav: 1.2, drag: 1.2, alpha: 0.32, glow: false, colors: ["#ffffff", "#eaf6ff"] },
  smoke: { size: [2, 5], life: [1.4, 2.8], grav: 2.2, drag: 0.8, alpha: 0.4, glow: false, colors: ["#5a5050", "#7a7070", "#3a3434"] },
  confetti: { size: [0.45, 0.8], life: [2.4, 3.6], grav: -3.5, drag: 1.4, alpha: 1, glow: false, colors: ["#FF5A5F", "#FFC233", "#36E3FF", "#3EE08F", "#B98CFF", "#FF8FC3"] },
  spark: { size: [0.3, 0.6], life: [0.25, 0.55], grav: -11, drag: 0.3, alpha: 1, glow: true, colors: ["#FFE066", "#FFB21F", "#FFFFFF"] },
  sparkle: { size: [0.6, 1.1], life: [0.3, 0.55], grav: 2, drag: 2, alpha: 1, glow: true, colors: ["#FFE066", "#FFF6C8"] },
  flame: { size: [0.8, 1.5], life: [0.16, 0.3], grav: 2, drag: 3, alpha: 0.9, glow: true, colors: ["#FF7A2A", "#FFC233", "#36E3FF"] },
  blast: { size: [2.5, 5], life: [0.35, 0.7], grav: 3, drag: 2, alpha: 1, glow: true, colors: ["#FFC233", "#FF5A1F", "#FFFFFF"] },
};

class Cloud {
  readonly points: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private col: Float32Array; private size: Float32Array;
  private life: Float32Array; private max: Float32Array; private grav: Float32Array; private drag: Float32Array; private a0: Float32Array; private s0: Float32Array;
  private next = 0;
  constructor(readonly n: number, glow: boolean, readonly mat: THREE.ShaderMaterial) {
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.life = new Float32Array(n).fill(-1); this.max = new Float32Array(n).fill(1); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    this.a0 = new Float32Array(n); this.s0 = new Float32Array(n);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -9999;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = glow ? 6 : 5;
  }
  private tc = new THREE.Color();
  spawn(p: Preset, x: number, y: number, z: number, vx: number, vy: number, vz: number, rnd: () => number, color?: string) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.max[i] = p.life[0] + (p.life[1] - p.life[0]) * rnd(); this.life[i] = 0;
    this.s0[i] = p.size[0] + (p.size[1] - p.size[0]) * rnd(); this.a0[i] = p.alpha; this.grav[i] = p.grav; this.drag[i] = p.drag;
    this.tc.set(color ?? p.colors[Math.floor(rnd() * p.colors.length)]);
    this.col[i * 4] = this.tc.r; this.col[i * 4 + 1] = this.tc.g; this.col[i * 4 + 2] = this.tc.b;
  }
  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] < 0) continue;
      const l = (this.life[i] += dt);
      if (l >= this.max[i]) { this.life[i] = -1; this.pos[i * 3 + 1] = -9999; this.col[i * 4 + 3] = 0; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k + this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const u = l / this.max[i];
      this.col[i * 4 + 3] = this.a0[i] * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
      this.size[i] = this.s0[i] * (0.6 + 0.8 * u);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aColor.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
  dispose() { this.points.geometry.dispose(); }
}

export class Particles {
  readonly group = new THREE.Group();
  private soft: Cloud; private glow: Cloud;
  private matSoft: THREE.ShaderMaterial; private matGlow: THREE.ShaderMaterial;
  private seed = 1;
  readonly rnd = () => { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; };
  constructor(q: Quality) {
    const n = q === "low" ? 500 : q === "medium" ? 900 : 1600;
    const mk = (add: boolean) => new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTex: { value: dotTexture() }, uScale: { value: 300 } },
    });
    this.matSoft = mk(false); this.matGlow = mk(true);
    this.soft = new Cloud(n, false, this.matSoft); this.glow = new Cloud(Math.round(n * 0.5), true, this.matGlow);
    this.group.add(this.soft.points, this.glow.points);
  }
  /** pixels per metre at 1 m (set from the viewport height and field of view) */
  setScale(px: number) { this.matSoft.uniforms.uScale.value = px; this.matGlow.uniforms.uScale.value = px; }
  burst(kind: FxKind, x: number, y: number, z: number, n: number, speed: number, up = 0.5, color?: string, vx = 0, vz = 0) {
    const p = PRESETS[kind], cl = p.glow ? this.glow : this.soft, r = this.rnd;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, s = speed * (0.4 + 0.6 * r());
      cl.spawn(p, x + (r() - 0.5) * 0.6, y + r() * 0.3, z + (r() - 0.5) * 0.6, vx + Math.cos(a) * s, (up + r() * 0.6) * speed, vz + Math.sin(a) * s, r, color);
    }
  }
  /** a jet of particles from a point in a direction (spray off a hull, nitro flame) */
  jet(kind: FxKind, x: number, y: number, z: number, vx: number, vy: number, vz: number, spread: number, n = 1, color?: string) {
    const p = PRESETS[kind], cl = p.glow ? this.glow : this.soft, r = this.rnd;
    for (let i = 0; i < n; i++) cl.spawn(p, x, y, z, vx + (r() - 0.5) * spread, vy + (r() - 0.5) * spread * 0.5, vz + (r() - 0.5) * spread, r, color);
  }
  update(dt: number) { this.soft.update(dt); this.glow.update(dt); }
  dispose() { this.soft.dispose(); this.glow.dispose(); this.matSoft.dispose(); this.matGlow.dispose(); }
}

// ------------------------------------------------------------------ wakes
const SEG = 44;
const WVERT = `attribute float aAlpha; attribute float aU; varying float vA; varying float vU; varying vec3 vW;
void main(){ vA = aAlpha; vU = aU; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WFRAG = `uniform vec3 uFoam; uniform sampler2D uTex; varying float vA; varying float vU; varying vec3 vW;
void main(){ float x = abs(vU * 2.0 - 1.0);
  float crest = smoothstep(0.62, 0.9, x) * (1.0 - smoothstep(0.92, 1.0, x));
  float churn = (1.0 - smoothstep(0.0, 0.42, x)) * 0.8;
  float n = texture2D(uTex, vW.xz * 0.35).a;
  float a = (crest * 0.9 + churn * smoothstep(0.35, 0.0, 1.0 - vA)) * vA * (0.65 + 0.5 * n);
  gl_FragColor = vec4(uFoam, a);
  #include <colorspace_fragment>
}`;
export class Wakes {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array; private alpha: Float32Array;
  private hist: Float32Array; // per boat, per sample: x, z, dirx, dirz, age, strength
  private head: Int32Array; private acc: Float32Array;
  readonly mat: THREE.ShaderMaterial;
  constructor(readonly boats: number) {
    const nv = boats * SEG * 2;
    this.pos = new Float32Array(nv * 3); this.alpha = new Float32Array(nv);
    const u = new Float32Array(nv), idx: number[] = [];
    for (let b = 0; b < boats; b++) for (let i = 0; i < SEG; i++) {
      const v = (b * SEG + i) * 2; u[v] = 0; u[v + 1] = 1;
      if (i < SEG - 1) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ vertexShader: WVERT, fragmentShader: WFRAG, transparent: true, depthWrite: false, uniforms: { uFoam: { value: new THREE.Color("#ffffff") }, uTex: { value: dotTexture() } } });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.hist = new Float32Array(boats * SEG * 6);
    this.head = new Int32Array(boats); this.acc = new Float32Array(boats);
    for (let i = 0; i < boats * SEG; i++) this.hist[i * 6 + 4] = 99;
  }
  /** feed a boat's stern position each frame (on the water only), then rebuild its strip */
  update(b: number, dt: number, x: number, y: number, z: number, dx: number, dz: number, speed: number, beam: number, onWater: boolean) {
    const H = this.hist, base = b * SEG;
    for (let i = 0; i < SEG; i++) H[(base + i) * 6 + 4] += dt;
    this.acc[b] += dt;
    if (this.acc[b] > 0.045) {
      this.acc[b] = 0;
      this.head[b] = (this.head[b] + 1) % SEG;
      const k = (base + this.head[b]) * 6;
      H[k] = x; H[k + 1] = z; H[k + 2] = dx; H[k + 3] = dz; H[k + 4] = 0; H[k + 5] = onWater ? Math.min(1, speed / 22) : 0;
    }
    // newest first along the strip
    for (let i = 0; i < SEG; i++) {
      const k = (base + ((this.head[b] - i + SEG) % SEG)) * 6;
      const age = H[k + 4], st = H[k + 5];
      let px = H[k], pz = H[k + 1];
      if (i === 0) { px = x; pz = z; }
      const half = beam * 0.8 + age * 3.4;
      const nx = -H[k + 3], nz = H[k + 2];
      const v = (base + i) * 2;
      this.pos[v * 3] = px + nx * half; this.pos[v * 3 + 1] = y + 0.06; this.pos[v * 3 + 2] = pz + nz * half;
      this.pos[(v + 1) * 3] = px - nx * half; this.pos[(v + 1) * 3 + 1] = y + 0.06; this.pos[(v + 1) * 3 + 2] = pz - nz * half;
      const a = st * Math.max(0, 1 - age / 1.9) * (i === 0 ? 0 : 1);
      this.alpha[v] = a; this.alpha[v + 1] = a;
    }
  }
  flush() { const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}

// ------------------------------------------------------------------ weather around the camera
export class WeatherFx {
  readonly group = new THREE.Group();
  private pts: THREE.Points | null = null;
  private rain: THREE.LineSegments | null = null;
  private pos: Float32Array = new Float32Array(0);
  private vel: Float32Array = new Float32Array(0);
  private n = 0;
  private mat: THREE.Material | null = null;
  private kind: Weather = "none";
  private R = 46;
  constructor(kind: Weather, q: Quality, heavy = false) {
    this.kind = kind;
    if (kind === "none") return;
    const base = q === "low" ? 220 : q === "medium" ? 420 : 800;
    this.n = Math.round(base * (heavy ? 1.6 : 1) * (kind === "rain" ? 1.4 : kind === "fireflies" || kind === "spores" ? 0.35 : kind === "mist" ? 0.15 : 1));
    this.pos = new Float32Array(this.n * 3 * (kind === "rain" ? 2 : 1)); this.vel = new Float32Array(this.n * 3);
    const r = (a: number) => (Math.random() * 2 - 1) * a;
    for (let i = 0; i < this.n; i++) {
      this.vel[i * 3] = r(1); this.vel[i * 3 + 1] = 0; this.vel[i * 3 + 2] = r(1);
      const k = kind === "rain" ? i * 6 : i * 3;
      this.pos[k] = r(this.R); this.pos[k + 1] = Math.random() * 30; this.pos[k + 2] = r(this.R);
    }
    if (kind === "rain") {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.mat = new THREE.LineBasicMaterial({ color: "#b8c8d8", transparent: true, opacity: 0.45 });
      this.rain = new THREE.LineSegments(g, this.mat);
      this.rain.frustumCulled = false;
      this.group.add(this.rain);
    } else {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      const color = { snow: "#ffffff", petals: "#FFB7D0", ash: "#8a7a74", fireflies: "#d8ff7a", leaves: "#8fcf5a", sparks: "#36E3FF", dust: "#e8c890", spores: "#b98cff", mist: "#ffffff" }[kind] ?? "#ffffff";
      const size = { snow: 0.35, petals: 0.45, ash: 0.3, fireflies: 0.5, leaves: 0.5, sparks: 0.3, dust: 0.25, spores: 0.45, mist: 9 }[kind] ?? 0.3;
      const glow = kind === "fireflies" || kind === "sparks" || kind === "spores";
      this.mat = new THREE.PointsMaterial({ color, size, map: dotTexture(), transparent: true, depthWrite: false, opacity: kind === "mist" ? 0.12 : 0.9, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, sizeAttenuation: true });
      this.pts = new THREE.Points(g, this.mat);
      this.pts.frustumCulled = false;
      this.group.add(this.pts);
    }
  }
  update(dt: number, t: number, cx: number, cy: number, cz: number, wind: number) {
    if (this.kind === "none") return;
    const R = this.R, p = this.pos, k6 = this.kind === "rain";
    for (let i = 0; i < this.n; i++) {
      const k = k6 ? i * 6 : i * 3;
      let vx = this.vel[i * 3], vy = -1, vz = this.vel[i * 3 + 2];
      switch (this.kind) {
        case "rain": vy = -38; vx = wind * 6; vz = 0; break;
        case "snow": vy = -2.2; vx += Math.sin(t + i) * 0.6; break;
        case "petals": vy = -1.4; vx = Math.sin(t * 0.9 + i) * 1.8 + wind; vz = Math.cos(t * 0.7 + i * 1.3) * 1.4; break;
        case "ash": vy = -1.2; vx = wind * 2 + Math.sin(t + i) * 0.4; break;
        case "fireflies": vy = Math.sin(t * 1.3 + i) * 0.5; vx = Math.sin(t * 0.7 + i * 2.1) * 1; vz = Math.cos(t * 0.8 + i) * 1; break;
        case "spores": vy = 0.5; vx = Math.sin(t * 0.5 + i) * 0.5; break;
        case "sparks": vy = 1.6; vx = Math.sin(t * 2 + i) * 0.6; break;
        case "dust": vy = -0.2; vx = 5 + wind * 3; vz = Math.sin(t + i) * 0.5; break;
        case "leaves": vy = -1.6; vx = Math.sin(t * 1.4 + i) * 2 + wind; break;
        case "mist": vy = 0; vx = 0.6; break;
      }
      let x = p[k] + vx * dt, y = p[k + 1] + vy * dt, z = p[k + 2] + vz * dt;
      // wrap around the camera
      const rx = x - cx, rz = z - cz;
      if (rx > R) x -= 2 * R; else if (rx < -R) x += 2 * R;
      if (rz > R) z -= 2 * R; else if (rz < -R) z += 2 * R;
      if (y < cy - 12) y += 34; else if (y > cy + 22) y -= 34;
      if (this.kind === "mist") y = cy - 3 + (i % 3);
      p[k] = x; p[k + 1] = y; p[k + 2] = z;
      if (k6) { p[k + 3] = x - vx * 0.03; p[k + 4] = y - vy * 0.03; p[k + 5] = z - vz * 0.03; }
    }
    const g = (this.rain ?? this.pts)!.geometry;
    g.attributes.position.needsUpdate = true;
    if (this.kind === "fireflies" && this.mat) (this.mat as THREE.PointsMaterial).opacity = 0.6 + 0.4 * Math.sin(t * 3);
  }
  dispose() { (this.rain ?? this.pts)?.geometry.dispose(); this.mat?.dispose(); }
}
