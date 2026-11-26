// Effects, all made of voxels and drawn as two instanced meshes (one draw call each, no allocation per frame):
//  - solid cubes, lit: robot debris that bounces and tumbles when a robot blows apart, chunks of block, smoke puffs
//    that rise and swell, shell casings;
//  - glowing cubes, additive: blaster bolts stretched along their flight, muzzle flashes, fireballs, sparks, pickup
//    glints, jetpack exhaust, teleport sparkles, the shock rings of big blasts.
// Every frame the game asks for the bolts and beams it needs on top of the particles.
import * as THREE from "three";

const MAX_SOLID = 520, MAX_GLOW = 900;
export const DEBRIS = 0, SMOKE = 1, FIRE = 2, SPARK = 3, FLASH = 4, GLINT = 5, EXHAUST = 6, RING = 7;

const N = 700;
export class Fx {
  solid: THREE.InstancedMesh; glow: THREE.InstancedMesh;
  private x = new Float32Array(N); private y = new Float32Array(N); private z = new Float32Array(N);
  private vx = new Float32Array(N); private vy = new Float32Array(N); private vz = new Float32Array(N);
  private life = new Float32Array(N); private max = new Float32Array(N); private size = new Float32Array(N);
  private rot = new Float32Array(N); private spin = new Float32Array(N);
  private col = new Float32Array(N * 3); private kind = new Uint8Array(N);
  private next = 0;
  private ns = 0; private ng = 0;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(); private p = new THREE.Vector3(); private s = new THREE.Vector3(); private c = new THREE.Color();
  private up = new THREE.Vector3(0, 0, 1); private dir = new THREE.Vector3();
  constructor() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.solid = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_SOLID);
    this.glow = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAX_GLOW);
    for (const im of [this.solid, this.glow]) { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0; }
    this.solid.setColorAt(0, this.c.set(0xffffff)); this.glow.setColorAt(0, this.c.set(0xffffff));
    this.solid.castShadow = false;
  }
  clear() { this.life.fill(0); }

  spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, hex: number) {
    const i = this.next; this.next = (this.next + 1) % N;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.rot[i] = Math.random() * 6.28; this.spin[i] = (Math.random() - 0.5) * 14;
    this.col[i * 3] = ((hex >> 16) & 255) / 255; this.col[i * 3 + 1] = ((hex >> 8) & 255) / 255; this.col[i * 3 + 2] = (hex & 255) / 255;
  }
  burst(kind: number, x: number, y: number, z: number, count: number, speed: number, life: number, size: number, hex: number, up = 0) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + up, Math.sin(a) * Math.cos(e) * s, life * (0.6 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.7), hex);
    }
  }
  /** a robot (or a barrel) blowing apart: its own coloured chunks, fire, smoke, a flash and a ring */
  explode(x: number, y: number, z: number, scale: number, cols: number[], q = 1) {
    const n = Math.round((14 + scale * 10) * q);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = (3 + Math.random() * 6) * Math.sqrt(scale);
      this.spawn(DEBRIS, x + (Math.random() - 0.5) * scale * 0.6, y + Math.random() * scale * 0.6, z + (Math.random() - 0.5) * scale * 0.6, Math.cos(a) * s, 3 + Math.random() * 7, Math.sin(a) * s, 1.2 + Math.random() * 0.8, (0.1 + Math.random() * 0.16) * Math.sqrt(scale), cols[k % cols.length]);
    }
    this.burst(FIRE, x, y + 0.3 * scale, z, Math.round((10 + scale * 6) * q), 4 * Math.sqrt(scale), 0.55, 0.45 * Math.sqrt(scale), 0xff8a2a, 1);
    this.burst(SMOKE, x, y + 0.3 * scale, z, Math.round((6 + scale * 3) * q), 1.8, 1.4, 0.55 * Math.sqrt(scale), 0x4a4a52, 1.2);
    this.burst(SPARK, x, y + 0.3, z, Math.round(10 * q), 10, 0.35, 0.08, 0xffe07a, 2);
    this.spawn(FLASH, x, y + 0.4 * scale, z, 0, 0, 0, 0.16, 2.2 * scale, 0xfff0c0);
    this.spawn(RING, x, y + 0.1, z, 0, 0, 0, 0.45, 4.5 * scale, 0xffb05a);
  }

  /** advance; `floor(x, z)` is the ground height for bouncing debris */
  update(dt: number, floor: (x: number, z: number) => number) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = this.kind[i];
      const g = k === DEBRIS ? 22 : k === SPARK ? 14 : k === SMOKE ? -1.6 : k === FIRE ? -3 : k === EXHAUST ? -1 : 0;
      const drag = k === SMOKE || k === FIRE || k === EXHAUST ? 0.9 : 0.995;
      this.vx[i] *= drag; this.vz[i] *= drag; this.vy[i] = this.vy[i] * (k === SMOKE ? 0.95 : 1) - g * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      if (k === DEBRIS) {
        const f = floor(this.x[i], this.z[i]);
        if (this.y[i] < f + this.size[i] * 0.5) { this.y[i] = f + this.size[i] * 0.5; this.vy[i] = Math.abs(this.vy[i]) * 0.35; this.vx[i] *= 0.6; this.vz[i] *= 0.6; this.spin[i] *= 0.6; }
      }
    }
  }

  /** start a frame's drawing: particles first */
  begin() {
    this.ns = 0; this.ng = 0;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      const k = this.kind[i], u = this.life[i] / this.max[i];
      let s = this.size[i];
      if (k === SMOKE) s *= 1.8 - u; else if (k === FIRE) s *= 0.4 + u; else if (k === FLASH) s *= 0.6 + (1 - u) * 0.6; else if (k === RING) s *= 1 - u * 0.85; else if (k === DEBRIS) s *= Math.min(1, u * 3);
      const glow = k !== DEBRIS && k !== SMOKE;
      if (glow) {
        const b = k === FIRE ? u : k === RING ? u * 0.8 : k === FLASH ? u : u * 0.9;
        this.c.setRGB(this.col[i * 3] * b, this.col[i * 3 + 1] * b, this.col[i * 3 + 2] * b);
        if (k === RING) this.put(true, this.x[i], this.y[i], this.z[i], s, 0.06, s, 0);
        else this.put(true, this.x[i], this.y[i], this.z[i], s, s, s, this.rot[i]);
      } else {
        const fade = k === SMOKE ? 0.55 + u * 0.45 : 1;
        this.c.setRGB(this.col[i * 3] * fade, this.col[i * 3 + 1] * fade, this.col[i * 3 + 2] * fade);
        this.put(false, this.x[i], this.y[i], this.z[i], s, s, s, this.rot[i]);
      }
    }
  }
  private put(glow: boolean, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot: number) {
    const im = glow ? this.glow : this.solid, n = glow ? this.ng : this.ns;
    if (n >= (glow ? MAX_GLOW : MAX_SOLID)) return;
    this.e.set(rot, rot * 0.7, 0); this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    im.setMatrixAt(n, this.m); im.setColorAt(n, this.c);
    if (glow) this.ng++; else this.ns++;
  }
  /** a glowing bar from (x, y, z) along (dx, dy, dz) of a length: bolts, beams, tracers */
  bar(x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, w: number, hex: number, bright = 1) {
    if (this.ng >= MAX_GLOW) return;
    this.dir.set(dx, dy, dz).normalize();
    this.q.setFromUnitVectors(this.up, this.dir);
    this.m.compose(this.p.set(x - this.dir.x * len * 0.5, y - this.dir.y * len * 0.5, z - this.dir.z * len * 0.5), this.q, this.s.set(w, w, len));
    this.c.setHex(hex).multiplyScalar(bright);
    this.glow.setMatrixAt(this.ng, this.m); this.glow.setColorAt(this.ng, this.c); this.ng++;
  }
  /** a glowing cube (for one-frame flashes and glints) */
  cube(x: number, y: number, z: number, s: number, hex: number, bright = 1) {
    if (this.ng >= MAX_GLOW) return;
    this.c.setHex(hex).multiplyScalar(bright);
    this.put(true, x, y, z, s, s, s, 0);
  }
  end() {
    this.solid.count = this.ns; this.glow.count = this.ng;
    this.solid.instanceMatrix.needsUpdate = true; this.glow.instanceMatrix.needsUpdate = true;
    if (this.solid.instanceColor) this.solid.instanceColor.needsUpdate = true;
    if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
  }
  dispose() { this.solid.geometry.dispose(); (this.solid.material as THREE.Material).dispose(); (this.glow.material as THREE.Material).dispose(); }
}
