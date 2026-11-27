// Obby Bike Blaster's effects, all instanced (a handful of draw calls however busy it gets) and allocation-free per
// frame: debris cubes (crates bursting, a rider tumbling off), soft smoke and dust puffs, glowing additive sparks
// (blaster flashes, coin sparkles, boost trails, fireworks) and tracers (the handlebar blaster's bolts).
import * as THREE from "three";
/** anything that can say whether a point is inside something solid */
export interface Solid { solidAt(x: number, y: number, z: number): boolean }

const _o = new THREE.Object3D();
const _c = new THREE.Color();

// ------------------------------------------------------------------ debris cubes and smoke
export class Debris {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private p: Float32Array; private v: Float32Array; private rot: Float32Array; private life: Float32Array; private max: Float32Array;
  private size: Float32Array; private kind: Uint8Array; private col: Float32Array;
  constructor(readonly cap: number) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    this.mesh = new THREE.InstancedMesh(g, m, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, _c.set(1, 1, 1));
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.rot = new Float32Array(cap * 4);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.size = new Float32Array(cap); this.kind = new Uint8Array(cap); this.col = new Float32Array(cap * 3);
  }
  /** kind 0: a cube that falls and bounces; 1: a smoke puff that rises and grows */
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, r: number, g: number, b: number, life = 1.4, kind = 0) {
    let i = this.n;
    if (i >= this.cap) { i = Math.floor(Math.random() * this.cap); } else this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.rot[i * 4] = Math.random() * 6; this.rot[i * 4 + 1] = Math.random() * 6; this.rot[i * 4 + 2] = (Math.random() - 0.5) * 14; this.rot[i * 4 + 3] = (Math.random() - 0.5) * 14;
    this.life[i] = life * (0.75 + Math.random() * 0.5); this.max[i] = this.life[i]; this.size[i] = size; this.kind[i] = kind;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  /** a burst of cubes in a colour (a block's average colour, a monster's colour) */
  burst(x: number, y: number, z: number, count: number, r: number, g: number, b: number, speed = 4, size = 0.18) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random();
      const s = speed * (0.4 + Math.random() * 0.8);
      const sh = 0.85 + Math.random() * 0.3;
      this.spawn(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6, Math.cos(a) * s, up * s, Math.sin(a) * s, size * (0.6 + Math.random() * 0.8), r * sh, g * sh, b * sh);
    }
  }
  smoke(x: number, y: number, z: number, count: number, grey = 0.75, size = 0.5) {
    for (let k = 0; k < count; k++) this.spawn(x + (Math.random() - 0.5), y + Math.random() * 0.5, z + (Math.random() - 0.5), (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2, size * (0.6 + Math.random() * 0.6), grey, grey, grey * 1.02, 1.6, 1);
  }
  update(dt: number, V: Solid | null, grav: number) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); continue; }
      const k = this.kind[i];
      if (k === 1) {
        this.v[i * 3 + 1] += dt * 0.5; this.v[i * 3] *= 1 - dt; this.v[i * 3 + 2] *= 1 - dt;
      } else this.v[i * 3 + 1] -= grav * dt;
      let x = this.p[i * 3] + this.v[i * 3] * dt, y = this.p[i * 3 + 1] + this.v[i * 3 + 1] * dt, z = this.p[i * 3 + 2] + this.v[i * 3 + 2] * dt;
      if (k === 0 && V) {
        const h = this.size[i] * 0.5;
        if (V.solidAt(Math.floor(x), Math.floor(y - h), Math.floor(z)) && this.v[i * 3 + 1] < 0) {
          y = Math.floor(y - h) + 1 + h;
          this.v[i * 3 + 1] *= -0.32; this.v[i * 3] *= 0.6; this.v[i * 3 + 2] *= 0.6;
          this.rot[i * 4 + 2] *= 0.5; this.rot[i * 4 + 3] *= 0.5;
        }
        if (V.solidAt(Math.floor(x), Math.floor(y), Math.floor(z)) && y > 0) { x = this.p[i * 3]; z = this.p[i * 3 + 2]; this.v[i * 3] *= -0.3; this.v[i * 3 + 2] *= -0.3; }
      }
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.rot[i * 4] += this.rot[i * 4 + 2] * dt; this.rot[i * 4 + 1] += this.rot[i * 4 + 3] * dt;
      i++;
    }
  }
  private kill(i: number) {
    const j = --this.n;
    if (i === j) return;
    for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[j * 3 + a]; this.v[i * 3 + a] = this.v[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; }
    for (let a = 0; a < 4; a++) this.rot[i * 4 + a] = this.rot[j * 4 + a];
    this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.kind[i] = this.kind[j];
  }
  draw() {
    for (let i = 0; i < this.n; i++) {
      const t = this.life[i] / this.max[i];
      const k = this.kind[i];
      const s = k === 1 ? this.size[i] * (1.6 - t * 0.6) * Math.min(1, t * 3) : this.size[i] * Math.min(1, t * 3.5);
      _o.position.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      _o.rotation.set(this.rot[i * 4], this.rot[i * 4 + 1], 0);
      _o.scale.setScalar(Math.max(0.001, s));
      _o.updateMatrix();
      this.mesh.setMatrixAt(i, _o.matrix);
      this.mesh.setColorAt(i, _c.setRGB(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.n = 0; this.mesh.count = 0; }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

// ------------------------------------------------------------------ glowing sparks (additive)
export class Sparks {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private p: Float32Array; private v: Float32Array; private life: Float32Array; private max: Float32Array; private size: Float32Array; private col: Float32Array; private drag: Float32Array; private grav: Float32Array;
  constructor(readonly cap: number) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.mesh = new THREE.InstancedMesh(g, m, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 5;
    this.mesh.setColorAt(0, _c.set(1, 1, 1));
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.size = new Float32Array(cap); this.col = new Float32Array(cap * 3); this.drag = new Float32Array(cap); this.grav = new Float32Array(cap);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, r: number, g: number, b: number, life = 0.4, drag = 2, grav = 0) {
    let i = this.n;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap); else this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.drag[i] = drag; this.grav[i] = grav;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  }
  burst(x: number, y: number, z: number, count: number, r: number, g: number, b: number, speed = 6, size = 0.12, life = 0.45, grav = 6) {
    for (let k = 0; k < count; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), sp = speed * (0.3 + Math.random() * 0.7);
      this.spawn(x, y, z, Math.cos(a) * s * sp, u * sp + speed * 0.2, Math.sin(a) * s * sp, size * (0.5 + Math.random()), r, g, b, life * (0.6 + Math.random() * 0.8), 2.5, grav);
    }
  }
  /** one bright flash (muzzle, explosion core) */
  flash(x: number, y: number, z: number, size: number, r: number, g: number, b: number, life = 0.09) { this.spawn(x, y, z, 0, 0, 0, size, r, g, b, life, 0, 0); }
  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) { for (let a = 0; a < 3; a++) { this.p[i * 3 + a] = this.p[j * 3 + a]; this.v[i * 3 + a] = this.v[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; } this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; }
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] *= d; this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt; this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      i++;
    }
  }
  draw() {
    for (let i = 0; i < this.n; i++) {
      const t = this.life[i] / this.max[i];
      _o.position.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      _o.rotation.set(t * 3, t * 5, 0);
      _o.scale.setScalar(this.size[i] * (0.3 + 0.7 * t));
      _o.updateMatrix();
      this.mesh.setMatrixAt(i, _o.matrix);
      this.mesh.setColorAt(i, _c.setRGB(this.col[i * 3] * t, this.col[i * 3 + 1] * t, this.col[i * 3 + 2] * t));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.n = 0; this.mesh.count = 0; }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

// ------------------------------------------------------------------ tracers (bolts of light)
export class Tracers {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private a: Float32Array; private b: Float32Array; private life: Float32Array; private col: Float32Array; private w: Float32Array;
  constructor(readonly cap: number) {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0, 0.5);
    const m = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.mesh = new THREE.InstancedMesh(g, m, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 6;
    this.mesh.setColorAt(0, _c.set(1, 1, 1));
    this.a = new Float32Array(cap * 3); this.b = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.col = new Float32Array(cap * 3); this.w = new Float32Array(cap);
  }
  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, g: number, b: number, w = 0.07) {
    let i = this.n;
    if (i >= this.cap) i = Math.floor(Math.random() * this.cap); else this.n++;
    this.a[i * 3] = ax; this.a[i * 3 + 1] = ay; this.a[i * 3 + 2] = az; this.b[i * 3] = bx; this.b[i * 3 + 1] = by; this.b[i * 3 + 2] = bz;
    this.life[i] = 0.12; this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.w[i] = w;
  }
  update(dt: number) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      // the bolt's tail catches up with its head
      const k = Math.min(1, dt * 14);
      for (let a = 0; a < 3; a++) this.a[i * 3 + a] += (this.b[i * 3 + a] - this.a[i * 3 + a]) * k;
      if (this.life[i] <= 0) {
        const j = --this.n;
        if (i !== j) { for (let a = 0; a < 3; a++) { this.a[i * 3 + a] = this.a[j * 3 + a]; this.b[i * 3 + a] = this.b[j * 3 + a]; this.col[i * 3 + a] = this.col[j * 3 + a]; } this.life[i] = this.life[j]; this.w[i] = this.w[j]; }
        continue;
      }
      i++;
    }
  }
  draw() {
    for (let i = 0; i < this.n; i++) {
      const ax = this.a[i * 3], ay = this.a[i * 3 + 1], az = this.a[i * 3 + 2], dx = this.b[i * 3] - ax, dy = this.b[i * 3 + 1] - ay, dz = this.b[i * 3 + 2] - az;
      const len = Math.max(0.001, Math.hypot(dx, dy, dz));
      _o.position.set(ax, ay, az);
      _o.lookAt(ax + dx, ay + dy, az + dz);
      const t = this.life[i] / 0.12;
      _o.scale.set(this.w[i] * t, this.w[i] * t, len);
      _o.updateMatrix();
      this.mesh.setMatrixAt(i, _o.matrix);
      this.mesh.setColorAt(i, _c.setRGB(this.col[i * 3], this.col[i * 3 + 1], this.col[i * 3 + 2]));
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.n = 0; this.mesh.count = 0; }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
