// Tondu, an Oriental garden lizard (Calotes versicolor), built in code: a wedge head with swollen jowls, big eyes in
// dark rings with radiating lines, a small ear, a saw-tooth crest from the nape down the back, a slim body that is
// taller than it is wide, a tail almost three times the body, and four slender legs with five long clawed toes.
// The body is one smooth loft along a spine that follows the head's own trail — so it wraps round the vine when he
// flips, bends round every curve and arcs through every leap — re-skinned every frame on the CPU. The legs use
// two-bone IK and grip the vine in a diagonal climbing gait; the tail sways, drops (autotomy) and grows back.
import * as THREE from "three";
import { hatGeo } from "../crowd/models";

export const SCALE = 2.25;
/** head+body and tail lengths before SCALE (m) */
const HB = 0.66, TAIL = 1.3;
export const LIZ_LEN = (HB + TAIL) * SCALE;

/** cross-section of the body along the spine (u from the snout tip, before SCALE): half height, half width, centre lift */
const PROF: [number, number, number, number][] = [
  [0.0, 0.007, 0.008, -0.004], [0.02, 0.019, 0.021, -0.003], [0.045, 0.029, 0.031, -0.002], [0.07, 0.038, 0.041, 0],
  [0.095, 0.045, 0.051, 0], [0.12, 0.051, 0.06, -0.006], [0.14, 0.05, 0.058, -0.008], [0.16, 0.045, 0.047, -0.003],
  [0.19, 0.047, 0.046, 0], [0.235, 0.06, 0.054, 0.002], [0.3, 0.07, 0.06, 0.004], [0.38, 0.074, 0.062, 0.004],
  [0.46, 0.07, 0.06, 0.003], [0.53, 0.062, 0.055, 0.002], [0.6, 0.053, 0.05, 0], [0.66, 0.044, 0.043, 0],
];
function profile(u: number): [number, number, number] {
  if (u >= 0.66) { const k = Math.min(1, (u - 0.66) / TAIL); const r = 0.042 * Math.pow(1 - k, 1.25) + 0.0028; return [r, r * 0.98, 0]; }
  for (let i = 1; i < PROF.length; i++) {
    const a = PROF[i - 1], b = PROF[i];
    if (u <= b[0]) { const k = (u - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k); return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s]; }
  }
  return [0.044, 0.043, 0];
}

export interface Skin { base: string; band: string; stripe: string; belly: string; head: string; throat: string; metal?: number }
export const SKINS: Record<string, Skin & { name: string; price: number }> = {
  classic: { name: "Classic garden", price: 0, base: "#B79C58", band: "#6A5428", stripe: "#F4E6AC", belly: "#F0E2B6", head: "#C6A85E", throat: "#E0C27A" },
  redhead: { name: "Red-head", price: 400, base: "#8C7C46", band: "#584A26", stripe: "#E0CF98", belly: "#E6D8AC", head: "#E2552E", throat: "#C8302A" },
  leaf: { name: "Leaf green", price: 300, base: "#5DAE3C", band: "#3A7A26", stripe: "#CBF09C", belly: "#E2F4BC", head: "#6CBC48", throat: "#9AD86A" },
  sand: { name: "Desert sand", price: 300, base: "#C9A86E", band: "#8A683E", stripe: "#F2E2B8", belly: "#F4EACE", head: "#D2B47A", throat: "#E8D2A0" },
  night: { name: "Night blue", price: 500, base: "#40607E", band: "#243A50", stripe: "#9CD2F2", belly: "#CADDEE", head: "#4A7298", throat: "#7AA8D8" },
  gold: { name: "Gold", price: 800, base: "#D9A82C", band: "#9A6A12", stripe: "#FFE7A2", belly: "#FFF1C2", head: "#E8BA34", throat: "#F6D06A", metal: 0.55 },
};
const FLUSH = new THREE.Color("#FF5A24");

const RINGS_HEAD = 18, RINGS_BODY = 16, RINGS_TAIL = 26, SEG = 14;
const RINGS = RINGS_HEAD + RINGS_BODY + RINGS_TAIL;
/** u of every ring (denser at the head) */
const RING_U: number[] = (() => {
  const out: number[] = [];
  for (let i = 0; i < RINGS_HEAD; i++) out.push((0.19 * i) / (RINGS_HEAD - 1));
  for (let i = 1; i <= RINGS_BODY; i++) out.push(0.19 + (0.47 * i) / RINGS_BODY);
  for (let i = 1; i <= RINGS_TAIL; i++) out.push(0.66 + TAIL * Math.pow(i / RINGS_TAIL, 1.15));
  return out;
})();

/** the scale bump texture (keeled scales in rows) */
function scaleTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#808080"; c.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const x = col * 16 + (row % 2) * 8, y = row * 16;
    const g = c.createRadialGradient(x + 8, y + 9, 1, x + 8, y + 8, 9);
    g.addColorStop(0, "#d8d8d8"); g.addColorStop(0.7, "#9a9a9a"); g.addColorStop(1, "#505050");
    c.fillStyle = g; c.beginPath(); c.ellipse(x + 8, y + 8, 7.5, 8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.35)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 8, y + 3); c.lineTo(x + 8, y + 13); c.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function eyeTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 64;
  const c = cv.getContext("2d")!;
  // equirect: the front of the eye is in the middle of the canvas
  c.fillStyle = "#3A3420"; c.fillRect(0, 0, 128, 64);
  const g = c.createRadialGradient(64, 32, 2, 64, 32, 26);
  g.addColorStop(0, "#1a1208"); g.addColorStop(0.32, "#0e0a06"); g.addColorStop(0.36, "#D8A238"); g.addColorStop(0.8, "#B07A28"); g.addColorStop(1, "#5A4420");
  c.fillStyle = g; c.beginPath(); c.ellipse(64, 32, 26, 22, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255,255,255,0.95)"; c.beginPath(); c.ellipse(56, 24, 5, 4, 0, 0, Math.PI * 2); c.fill();
  return new THREE.CanvasTexture(cv);
}

interface Leg { upper: THREE.Mesh; lower: THREE.Mesh; foot: THREE.Mesh; knee: THREE.Mesh; u: number; side: 1 | -1; off: number; front: boolean }

const V = () => new THREE.Vector3();
const tA = V(), tB = V(), tC = V(), tD = V(), tE = V(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4(), tS = V();
const UPY = new THREE.Vector3(0, 1, 0);

export interface LizardPose {
  /** world head position and its "up" (away from the vine) */
  head: THREE.Vector3; up: THREE.Vector3;
  /** metres climbed since last frame (drives the gait) */
  moved: number;
  airborne: boolean;
  cling: number;
  flush: number;
  /** 0..1 snap lunge, side of the bug (-1 / 1 relative to his right) */
  snap: number;
  /** idle push-ups (title / gate) 0..1 */
  bob: number;
  /** vine radius under him (0 = not on a vine) */
  vineR: number;
}

export class Lizard {
  group = new THREE.Group();
  private keep: { dispose: () => void }[] = [];
  private geo: THREE.BufferGeometry; private pos: Float32Array; private col: Float32Array; private baseCol: Float32Array;
  private mesh: THREE.Mesh; private mat: THREE.MeshStandardMaterial;
  private crest: THREE.InstancedMesh; private crestU: number[] = [];
  private eyes: THREE.Mesh[] = []; private lids: THREE.Mesh[] = []; private ears: THREE.Mesh[] = []; private lines: THREE.InstancedMesh;
  private legs: Leg[] = [];
  private hat: THREE.Mesh | null = null;
  /** head trail: x,y,z, ux,uy,uz every TRAIL_DS metres (newest first) */
  private trail: Float32Array; private trailN = 0; private trailDist = 0;
  private spineP: Float32Array = new Float32Array(RINGS * 3); private spineT = new Float32Array(RINGS * 3); private spineU = new Float32Array(RINGS * 3);
  private walk = 0; private t = 0; private blink = 0; private nextBlink = 2;
  /** 1 = full tail; < 1 while it grows back; the stub when dropped */
  tailK = 1;
  private flushNow = 0;
  skin: Skin;

  constructor(skin = "classic", hat = "none") {
    this.skin = SKINS[skin] ?? SKINS.classic;
    const k = <X extends { dispose: () => void }>(x: X) => { this.keep.push(x); return x; };
    // the loft
    const nv = RINGS * SEG + 2;
    this.pos = new Float32Array(nv * 3); this.col = new Float32Array(nv * 3); this.baseCol = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const idx: number[] = [];
    for (let r = 0; r < RINGS - 1; r++) for (let j = 0; j < SEG; j++) {
      const a = r * SEG + j, b = r * SEG + ((j + 1) % SEG), c2 = (r + 1) * SEG + j, d = (r + 1) * SEG + ((j + 1) % SEG);
      idx.push(a, c2, b, b, c2, d);
    }
    const tip = RINGS * SEG, end = tip + 1;
    for (let j = 0; j < SEG; j++) { idx.push(tip, j, (j + 1) % SEG); const o = (RINGS - 1) * SEG; idx.push(end, o + ((j + 1) % SEG), o + j); }
    for (let r = 0; r < RINGS; r++) for (let j = 0; j < SEG; j++) { const i = r * SEG + j; uv[i * 2] = RING_U[r] * 14; uv[i * 2 + 1] = j / SEG * 3; }
    this.geo = k(new THREE.BufferGeometry());
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    const bump = k(scaleTexture());
    this.mat = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: this.skin.metal ?? 0, bumpMap: bump, bumpScale: 0.6 }));
    this.mesh = new THREE.Mesh(this.geo, this.mat); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.group.add(this.mesh);
    this.paint();
    // crest spines
    const sp = k(new THREE.ConeGeometry(0.5, 1, 4)); sp.translate(0, 0.5, 0); sp.scale(1, 1, 0.45);
    const spMat = k(new THREE.MeshStandardMaterial({ color: this.skin.band, roughness: 0.6 }));
    for (let u = 0.15; u <= 0.47; u += 0.032) this.crestU.push(u);
    this.crest = new THREE.InstancedMesh(sp, spMat, this.crestU.length); this.crest.frustumCulled = false;
    this.group.add(this.crest);
    // eyes: an eyeball, a dark ring round it and dark lines radiating out
    const eyeTex = k(eyeTexture());
    const eyeG = k(new THREE.SphereGeometry(0.026 * SCALE, 16, 12)); eyeG.rotateY(-Math.PI / 2);
    const eyeM = k(new THREE.MeshStandardMaterial({ map: eyeTex, roughness: 0.15, metalness: 0.0 }));
    const lidG = k(new THREE.TorusGeometry(0.027 * SCALE, 0.007 * SCALE, 8, 20));
    const lidM = k(new THREE.MeshStandardMaterial({ color: new THREE.Color(this.skin.band).multiplyScalar(0.7), roughness: 0.7 }));
    const earG = k(new THREE.CylinderGeometry(0.011 * SCALE, 0.011 * SCALE, 0.004, 12)); earG.rotateX(Math.PI / 2);
    const earM = k(new THREE.MeshStandardMaterial({ color: "#3A3420", roughness: 0.8 }));
    for (let i = 0; i < 2; i++) {
      const e = new THREE.Mesh(eyeG, eyeM); this.eyes.push(e); this.group.add(e);
      const l = new THREE.Mesh(lidG, lidM); this.lids.push(l); this.group.add(l);
      const ear = new THREE.Mesh(earG, earM); this.ears.push(ear); this.group.add(ear);
    }
    const lineG = k(new THREE.BoxGeometry(0.0035 * SCALE, 0.002 * SCALE, 0.016 * SCALE)); lineG.translate(0, 0, 0.008 * SCALE);
    this.lines = new THREE.InstancedMesh(lineG, lidM, 10); this.lines.frustumCulled = false; this.group.add(this.lines);
    // legs
    const upG = k(new THREE.CylinderGeometry(0.0125 * SCALE, 0.019 * SCALE, 1, 10)); upG.translate(0, 0.5, 0);
    const loG = k(new THREE.CylinderGeometry(0.0075 * SCALE, 0.012 * SCALE, 1, 10)); loG.translate(0, 0.5, 0);
    const jG = k(new THREE.SphereGeometry(0.0135 * SCALE, 10, 8));
    const legM = k(new THREE.MeshStandardMaterial({ color: this.skin.base, roughness: 0.6, metalness: this.skin.metal ?? 0 }));
    const footHind = k(footGeo(true)), footFore = k(footGeo(false));
    for (const [u, side, off, front] of [[0.25, 1, 0, true], [0.25, -1, 0.5, true], [0.6, 1, 0.5, false], [0.6, -1, 0, false]] as [number, 1 | -1, number, boolean][]) {
      const leg: Leg = { upper: new THREE.Mesh(upG, legM), lower: new THREE.Mesh(loG, legM), foot: new THREE.Mesh(front ? footFore : footHind, legM), knee: new THREE.Mesh(jG, legM), u, side, off, front };
      this.group.add(leg.upper, leg.lower, leg.foot, leg.knee); this.legs.push(leg);
    }
    // a hat (Wardrobe)
    const hg = hat !== "none" ? hatGeo(hat) : null;
    if (hg) { k(hg); const hm = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })); this.hat = new THREE.Mesh(hg, hm); this.group.add(this.hat); }
    this.trail = new Float32Array(Math.ceil((LIZ_LEN + 1) / 0.02) * 6 + 12);
  }

  /** bake the colours: bands, a pale flank stripe, a light belly, the darker mouth line and the head */
  private paint() {
    const sk = this.skin;
    const base = new THREE.Color(sk.base), band = new THREE.Color(sk.band), stripe = new THREE.Color(sk.stripe), belly = new THREE.Color(sk.belly), head = new THREE.Color(sk.head), throat = new THREE.Color(sk.throat);
    const c = new THREE.Color(), regrowC = new THREE.Color(sk.base).lerp(new THREE.Color("#C8C090"), 0.35);
    for (let r = 0; r < RINGS; r++) {
      const u = RING_U[r];
      for (let j = 0; j < SEG; j++) {
        const a = (j / SEG) * Math.PI * 2; // 0 = top (dorsal), π = belly
        const up = Math.cos(a), sideAbs = Math.abs(Math.sin(a));
        c.copy(base);
        // dark crossbands on the back and the tail
        if (u > 0.2) { const bandK = Math.max(0, Math.sin(u * 38)) ** 3 * (u < 0.66 ? 0.7 : 0.55); c.lerp(band, bandK * Math.max(0, up + 0.3)); }
        // pale stripe along each flank (shoulder to hip)
        if (u > 0.2 && u < 0.62 && up > -0.2 && up < 0.35 && sideAbs > 0.75) c.lerp(stripe, 0.7);
        // belly
        if (up < -0.35) c.lerp(belly, Math.min(1, (-up - 0.35) * 2.2));
        // head and throat
        if (u < 0.17) { c.lerp(head, 0.75); if (up < -0.2) c.lerp(throat, 0.7); }
        // the mouth line along the head's sides
        if (u > 0.01 && u < 0.125 && Math.abs(up + 0.28 - u * 0.6) < 0.12 && sideAbs > 0.6) c.multiplyScalar(0.42);
        // a slightly lighter, plainer regrown tail tip
        if (u > 1.4) c.lerp(regrowC, 0.25);
        const i = (r * SEG + j) * 3;
        this.baseCol[i] = c.r; this.baseCol[i + 1] = c.g; this.baseCol[i + 2] = c.b;
      }
    }
    for (const e of [RINGS * SEG, RINGS * SEG + 1]) { const i = e * 3; c.set(e === RINGS * SEG ? sk.head : sk.band); this.baseCol[i] = c.r; this.baseCol[i + 1] = c.g; this.baseCol[i + 2] = c.b; }
    this.col.set(this.baseCol); this.flushNow = -1;
  }
  private flushPaint(k: number) {
    if (Math.abs(k - this.flushNow) < 0.02) return;
    this.flushNow = k;
    for (let r = 0; r < RINGS_HEAD + 4; r++) {
      const u = RING_U[r], w = Math.max(0, Math.min(1, (0.24 - u) / 0.08)) * k;
      for (let j = 0; j < SEG; j++) {
        const i = (r * SEG + j) * 3;
        this.col[i] = this.baseCol[i] + (FLUSH.r - this.baseCol[i]) * w * 0.85;
        this.col[i + 1] = this.baseCol[i + 1] + (FLUSH.g - this.baseCol[i + 1]) * w * 0.85;
        this.col[i + 2] = this.baseCol[i + 2] + (FLUSH.b - this.baseCol[i + 2]) * w * 0.85;
      }
    }
    (this.geo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
  }

  /** lay the body down along a curve: at(d) = position and up `d` metres behind the head */
  reset(at: (d: number, p: THREE.Vector3, up: THREE.Vector3) => void) {
    const n = this.trail.length / 6;
    for (let i = 0; i < n; i++) { at(i * 0.02, tA, tB); this.trail.set([tA.x, tA.y, tA.z, tB.x, tB.y, tB.z], i * 6); }
    this.trailN = n; this.trailDist = 0;
  }
  private push(p: THREE.Vector3, up: THREE.Vector3) {
    // add the head position to the trail every 2 cm (the history shifts back; newest first)
    const tr = this.trail;
    const dx = p.x - tr[0], dy = p.y - tr[1], dz = p.z - tr[2];
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.02) { tr[0] = p.x; tr[1] = p.y; tr[2] = p.z; tr[3] = up.x; tr[4] = up.y; tr[5] = up.z; return; }
    const steps = Math.min(60, Math.floor(d / 0.02));
    tr.copyWithin(6 * steps, 0, tr.length - 6 * steps);
    const ox = tr[6 * steps], oy = tr[6 * steps + 1], oz = tr[6 * steps + 2];
    const ux = tr[6 * steps + 3], uy = tr[6 * steps + 4], uz = tr[6 * steps + 5];
    for (let k = 0; k < steps; k++) {
      const f = k / steps, o = k * 6;
      tr[o] = p.x + (ox - p.x) * f; tr[o + 1] = p.y + (oy - p.y) * f; tr[o + 2] = p.z + (oz - p.z) * f;
      tr[o + 3] = up.x + (ux - up.x) * f; tr[o + 4] = up.y + (uy - up.y) * f; tr[o + 5] = up.z + (uz - up.z) * f;
    }
  }
  /** points at increasing distances behind the head along the trail (one pass) */
  private alongAll(ds: number[], P: Float32Array, U: Float32Array) {
    const tr = this.trail, n = this.trailN;
    let i = 0, acc = 0;
    for (let r = 0; r < ds.length; r++) {
      const d = ds[r];
      while (i < n - 2) {
        const o = i * 6, q = o + 6;
        const seg = Math.hypot(tr[q] - tr[o], tr[q + 1] - tr[o + 1], tr[q + 2] - tr[o + 2]);
        if (acc + seg >= d) break;
        acc += seg; i++;
      }
      const o = i * 6, q = o + 6;
      const seg = Math.hypot(tr[q] - tr[o], tr[q + 1] - tr[o + 1], tr[q + 2] - tr[o + 2]);
      const k = seg > 1e-6 ? Math.max(0, Math.min(1, (d - acc) / seg)) : 0;
      for (let a = 0; a < 3; a++) {
        P[r * 3 + a] = tr[o + a] + (tr[q + a] - tr[o + a]) * k;
        U[r * 3 + a] = tr[o + 3 + a] + (tr[q + 3 + a] - tr[o + 3 + a]) * k;
      }
      const l = Math.hypot(U[r * 3], U[r * 3 + 1], U[r * 3 + 2]) || 1;
      U[r * 3] /= l; U[r * 3 + 1] /= l; U[r * 3 + 2] /= l;
    }
  }

  update(p: LizardPose, dt: number) {
    this.t += dt;
    this.walk += p.moved;
    this.push(p.head, p.up);
    // blink
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blink = 0.16; this.nextBlink = 2.5 + Math.random() * 3.5; }
    if (this.blink > 0) this.blink -= dt;
    this.flushPaint(p.flush);
    const tailEnd = 0.66 + TAIL * Math.max(0.12, Math.min(1, this.tailK));
    // spine along the trail, with a soft side-to-side body wave while climbing and a tail sway
    const sp = this.spineP, sT = this.spineT, sU = this.spineU;
    const speedK = Math.min(1, p.moved / Math.max(1e-4, dt) / 4);
    this.alongAll(RING_U.map((u) => Math.min(u, tailEnd) * SCALE), sp, sU);
    for (let r = 0; r < RINGS; r++) {
      const a = Math.max(0, r - 1), b = Math.min(RINGS - 1, r + 1);
      tA.set(sp[a * 3] - sp[b * 3], sp[a * 3 + 1] - sp[b * 3 + 1], sp[a * 3 + 2] - sp[b * 3 + 2]);
      if (tA.lengthSq() < 1e-10) tA.set(0, 1, 0);
      tA.normalize(); sT[r * 3] = tA.x; sT[r * 3 + 1] = tA.y; sT[r * 3 + 2] = tA.z;
    }
    // ring frames and vertices
    const lift = (p.vineR > 0 ? 0 : 0) - p.cling * 0.012;
    for (let r = 0; r < RINGS; r++) {
      const u = Math.min(RING_U[r], tailEnd);
      const [ry0, rz0, cy] = profile(u);
      const s = SCALE * (RING_U[r] > tailEnd ? 0.3 : 1);
      const ry = ry0 * s, rz = rz0 * s;
      tA.set(sT[r * 3], sT[r * 3 + 1], sT[r * 3 + 2]);
      tB.set(sU[r * 3], sU[r * 3 + 1], sU[r * 3 + 2]);
      tB.addScaledVector(tA, -tB.dot(tA)).normalize(); // up ⟂ tangent
      tC.crossVectors(tA, tB).normalize(); // right
      // the wave: sideways along the body, stronger in the tail, plus a push-up bob for the front
      const wave = Math.sin(this.walk * 7 - u * 9) * (u < 0.66 ? 0.012 : 0.03 * Math.min(1, (u - 0.66) * 1.6)) * (0.35 + speedK * 0.65) * SCALE;
      const sway = u > 0.66 ? Math.sin(this.t * 2.2 - u * 3) * 0.05 * (u - 0.66) * SCALE * (p.airborne ? 2.4 : 1) : 0;
      const bob = p.bob * Math.max(0, 0.3 - u) * 0.6 * Math.max(0, Math.sin(this.t * 9));
      const lift2 = (ry + (u > 0.66 ? 0 : 0.004)) + lift + bob + (u > 0.9 ? Math.sin(this.t * 1.6) * 0.03 * (u - 0.9) : 0);
      tD.set(sp[r * 3], sp[r * 3 + 1], sp[r * 3 + 2]).addScaledVector(tB, lift2 + cy * SCALE).addScaledVector(tC, wave + sway)
        .addScaledVector(tA, p.snap * 0.07 * Math.max(0, 1 - u * 4.5));
      sp[r * 3] = tD.x; sp[r * 3 + 1] = tD.y; sp[r * 3 + 2] = tD.z;
      for (let j = 0; j < SEG; j++) {
        const a = (j / SEG) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        // a flatter belly
        const yy = ca < 0 ? ca * 0.82 : ca;
        const i = (r * SEG + j) * 3;
        this.pos[i] = tD.x + tB.x * yy * ry + tC.x * sa * rz;
        this.pos[i + 1] = tD.y + tB.y * yy * ry + tC.y * sa * rz;
        this.pos[i + 2] = tD.z + tB.z * yy * ry + tC.z * sa * rz;
      }
    }
    // caps: snout tip and tail tip
    const tip = RINGS * SEG * 3, end = tip + 3, last = (RINGS - 1) * 3;
    tA.set(sT[0], sT[1], sT[2]);
    this.pos[tip] = sp[0] + tA.x * 0.006; this.pos[tip + 1] = sp[1] + tA.y * 0.006; this.pos[tip + 2] = sp[2] + tA.z * 0.006;
    tA.set(sT[last], sT[last + 1], sT[last + 2]);
    this.pos[end] = sp[last] - tA.x * 0.01; this.pos[end + 1] = sp[last + 1] - tA.y * 0.01; this.pos[end + 2] = sp[last + 2] - tA.z * 0.01;
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    // head features from the ring frames
    const frame = (u: number) => {
      let r = 0; while (r < RINGS - 1 && RING_U[r + 1] < u) r++;
      tA.set(sT[r * 3], sT[r * 3 + 1], sT[r * 3 + 2]);
      tB.set(sU[r * 3], sU[r * 3 + 1], sU[r * 3 + 2]); tB.addScaledVector(tA, -tB.dot(tA)).normalize();
      tC.crossVectors(tA, tB).normalize();
      tD.set(sp[r * 3], sp[r * 3 + 1], sp[r * 3 + 2]);
      return profile(u);
    };
    // eyes, lids, ears, eye lines
    let li = 0;
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? 1 : -1;
      const [ry, rz] = frame(0.072);
      const eye = this.eyes[i], lid = this.lids[i], ear = this.ears[i];
      tE.copy(tD).addScaledVector(tC, sd * rz * SCALE * 0.84).addScaledVector(tB, ry * SCALE * 0.34);
      eye.position.copy(tE);
      tM.makeBasis(tA, tB, tC.clone().multiplyScalar(sd)); eye.quaternion.setFromRotationMatrix(tM);
      // look a little forward; blink squashes it
      const bl = this.blink > 0 ? 0.12 : 1;
      eye.scale.set(1, bl, 1);
      lid.position.copy(tE).addScaledVector(tC, sd * 0.004);
      tS.copy(tC).multiplyScalar(sd); tQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tS); lid.quaternion.copy(tQ);
      lid.scale.set(1, this.blink > 0 ? 0.5 : 1, 1);
      // the radiating dark lines round the eye
      for (let k = 0; k < 5; k++) {
        const ang = Math.PI * 0.55 + (k / 4) * Math.PI * 0.9;
        tS.copy(tB).multiplyScalar(Math.cos(ang)).addScaledVector(tA, Math.sin(ang)).normalize();
        tM.lookAt(tE.clone().add(tS), tE, tC.clone().multiplyScalar(sd));
        tQ.setFromRotationMatrix(tM);
        tM.compose(tE.clone().addScaledVector(tS, 0.03 * SCALE).addScaledVector(tC, sd * -0.008), tQ, tS.set(1, 1, 1));
        this.lines.setMatrixAt(li++, tM);
      }
      const [ry2, rz2] = frame(0.118);
      ear.position.copy(tD).addScaledVector(tC, sd * rz2 * SCALE * 0.96).addScaledVector(tB, ry2 * SCALE * 0.1);
      tS.copy(tC).multiplyScalar(sd); ear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tS);
    }
    this.lines.instanceMatrix.needsUpdate = true;
    // crest: tallest at the nape, leaning back
    this.crestU.forEach((u, i) => {
      const [ry] = frame(u);
      const h = (0.034 - (u - 0.15) * 0.07) * SCALE * (1 - Math.max(0, u - 0.36) * 2.2), w = 0.011 * SCALE;
      tE.copy(tD).addScaledVector(tB, ry * SCALE * 0.92);
      // the spine leans back; its flat side faces sideways
      tS.copy(tB).addScaledVector(tA, -0.45).normalize();
      const zx = tC.clone().addScaledVector(tS, -tC.dot(tS)).normalize(), xx = new THREE.Vector3().crossVectors(tS, zx);
      tM.makeBasis(xx.multiplyScalar(w * 1.6), tS.clone().multiplyScalar(Math.max(0.004, h)), zx.multiplyScalar(w));
      tM.setPosition(tE);
      this.crest.setMatrixAt(i, tM);
    });
    this.crest.instanceMatrix.needsUpdate = true;
    // hat on the head
    if (this.hat) {
      const [ry] = frame(0.1);
      this.hat.position.copy(tD).addScaledVector(tB, ry * SCALE * 0.95 - 0.02);
      tM.makeBasis(tC, tB, tA.clone().negate()); this.hat.quaternion.setFromRotationMatrix(tM);
      this.hat.scale.setScalar(0.085 * SCALE);
    }
    // legs (two-bone IK, feet gripping the vine in a diagonal gait)
    const stride = 0.17 * SCALE;
    for (const L of this.legs) {
      const [ry, rz] = frame(L.u);
      const shoulder = tE.copy(tD).addScaledVector(tC, L.side * rz * SCALE * 0.85).addScaledVector(tB, -ry * SCALE * 0.15);
      // foot: planted on the vine round the side, stepping forward when the body has moved on
      const x = (this.walk / stride) + L.off, f = x - Math.floor(x);
      const swing = f > 0.72 ? (f - 0.72) / 0.28 : 0;
      const along = p.airborne ? -0.02 : ((0.5 - f) * stride + (swing ? swing * stride : 0)) * 0.9 + (L.front ? 0.03 : -0.02) * SCALE;
      const vr = p.vineR > 0 ? p.vineR : 0.12;
      const center = tS.copy(tD).addScaledVector(tB, -(vr + ry * SCALE * (p.vineR > 0 ? 1 : 0.4)));
      const ang = (p.airborne ? 1.2 : 0.95) * L.side;
      const foot = new THREE.Vector3().copy(center)
        .addScaledVector(tB, Math.cos(ang) * vr).addScaledVector(tC, Math.sin(ang) * vr)
        .addScaledVector(tA, along);
      if (swing) foot.addScaledVector(tB, Math.sin(swing * Math.PI) * 0.035 * SCALE);
      if (p.airborne) foot.addScaledVector(tC, L.side * 0.05).addScaledVector(tB, 0.03);
      this.ik(L, shoulder, foot, tC.clone().multiplyScalar(L.side).add(tB.clone().multiplyScalar(0.6)).normalize(), tA.clone(), center);
    }
  }

  private ik(L: Leg, a: THREE.Vector3, foot: THREE.Vector3, bend: THREE.Vector3, fwd: THREE.Vector3, center: THREE.Vector3) {
    const l1 = (L.front ? 0.075 : 0.085) * SCALE, l2 = (L.front ? 0.07 : 0.082) * SCALE;
    const d = foot.clone().sub(a); let dist = d.length();
    const maxD = (l1 + l2) * 0.98;
    if (dist > maxD) { d.multiplyScalar(maxD / dist); dist = maxD; foot.copy(a).add(d); }
    const dir = d.clone().normalize();
    const ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    const ang = Math.acos(Math.max(-1, Math.min(1, ca)));
    const b = bend.clone().addScaledVector(dir, -bend.dot(dir)).normalize();
    const knee = a.clone().addScaledVector(dir, Math.cos(ang) * l1).addScaledVector(b, Math.sin(ang) * l1);
    const place = (m: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) => {
      const v = to.clone().sub(from); const len = v.length();
      m.position.copy(from); m.quaternion.setFromUnitVectors(UPY, v.normalize()); m.scale.set(1, len, 1);
    };
    place(L.upper, a, knee); place(L.lower, knee, foot); L.knee.position.copy(knee);
    // the foot lies on the vine, toes forward and out
    const n = foot.clone().sub(center).normalize();
    const f = fwd.clone().addScaledVector(n, -fwd.dot(n)).normalize();
    const side = new THREE.Vector3().crossVectors(n, f).multiplyScalar(-L.side);
    f.addScaledVector(side, 0.45).normalize();
    const r = new THREE.Vector3().crossVectors(f, n).normalize();
    L.foot.position.copy(foot);
    tM.makeBasis(r, n, f); L.foot.quaternion.setFromRotationMatrix(tM);
  }

  setSkin(skin: string) { this.skin = SKINS[skin] ?? SKINS.classic; this.paint(); }
  dispose() { for (const k of this.keep) k.dispose(); this.group.removeFromParent(); }
}

/** a foot: a little palm and five long thin clawed toes (the hind foot's 4th toe the longest) */
function footGeo(hind: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const palm = new THREE.SphereGeometry(0.012 * SCALE, 8, 6); palm.scale(1, 0.45, 1.1); parts.push(palm);
  const lens = hind ? [0.022, 0.034, 0.046, 0.062, 0.036] : [0.02, 0.032, 0.04, 0.042, 0.03];
  lens.forEach((l, i) => {
    const toe = new THREE.CylinderGeometry(0.0022 * SCALE, 0.0038 * SCALE, l * SCALE, 5);
    toe.translate(0, (l * SCALE) / 2, 0); toe.rotateX(Math.PI / 2);
    const a = (i - 2) * 0.42;
    toe.rotateY(a); toe.translate(Math.sin(a) * 0.006, 0, Math.cos(a) * 0.006);
    parts.push(toe);
    const claw = new THREE.ConeGeometry(0.0022 * SCALE, 0.008 * SCALE, 4); claw.rotateX(Math.PI / 2);
    claw.translate(0, -0.001, (l * SCALE)); claw.rotateY(a); parts.push(claw);
  });
  return mergeGeos(parts);
}
export function mergeGeos(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // a tiny merge (positions + normals) so we don't need BufferGeometryUtils
  let n = 0; const ps: number[] = [], ns: number[] = [], idx: number[] = [];
  for (const g of parts) {
    const gi = g.index ? g : g;
    const p = gi.getAttribute("position"), no = gi.getAttribute("normal");
    for (let i = 0; i < p.count; i++) { ps.push(p.getX(i), p.getY(i), p.getZ(i)); ns.push(no.getX(i), no.getY(i), no.getZ(i)); }
    if (gi.index) for (let i = 0; i < gi.index.count; i++) idx.push(gi.index.getX(i) + n); else for (let i = 0; i < p.count; i++) idx.push(i + n);
    n += p.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3)); out.setIndex(idx);
  return out;
}
