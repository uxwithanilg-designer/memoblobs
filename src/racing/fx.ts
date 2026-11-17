// Race effects, tuned for phones (fixed pools, no per-frame allocations):
//  • Particles — two GPU point-sprite pools: "soft" (alpha: tyre smoke, dust, rain spray, splashes, confetti,
//    wreck smoke) and "glow" (additive: sparks, nitro flames, fire, coin sparkles, pickup bursts).
//  • SkidMarks — a ring buffer of rubber quads laid on the road, faded on the GPU by age.
//  • shock rings — expanding additive rings for PERFECT NITRO, takedowns and checkpoints.
import * as THREE from "three";

const R = () => Math.random() - 0.5;

class Pool {
  points: THREE.Points;
  readonly n: number;
  private pos: Float32Array; private col: Float32Array; private alpha: Float32Array; private size: Float32Array;
  private life: Float32Array; private max: Float32Array; private vel: Float32Array; private grow: Float32Array; private drag: Float32Array; private grav: Float32Array; private a0: Float32Array;
  private next = 0; private live = 0;
  private mat: THREE.ShaderMaterial;
  constructor(n: number, additive: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.alpha = new Float32Array(n); this.size = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.vel = new Float32Array(n * 3);
    this.grow = new Float32Array(n); this.drag = new Float32Array(n); this.grav = new Float32Array(n); this.a0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    const attr = (a: Float32Array, k: number) => { const b = new THREE.BufferAttribute(a, k); b.setUsage(THREE.DynamicDrawUsage); return b; };
    g.setAttribute("position", attr(this.pos, 3)); g.setAttribute("color", attr(this.col, 3));
    g.setAttribute("alpha", attr(this.alpha, 1)); g.setAttribute("size", attr(this.size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 520 } },
      vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); float z = -mv.z;
          vA = alpha * smoothstep(1.2, 4.5, z); // fade out right in front of the lens (no big blobs on phones)
          gl_PointSize = min(200.0, size * scale / max(0.5, z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: additive
        ? `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d) * 4.0; if (r > 1.0) discard; float a = vA * (1.0 - r) * (1.0 - r); gl_FragColor = vec4(vC * (1.0 + (1.0 - r) * 0.8) * a, a); }`
        : `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d) * 4.0; if (r > 1.0) discard; float a = vA * smoothstep(1.0, 0.15, r); gl_FragColor = vec4(vC, a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }
  setScale(v: number) { this.mat.uniforms.scale.value = v; }
  emit(x: number, y: number, z: number, r: number, g: number, b: number, size: number, life: number, vx: number, vy: number, vz: number, grow = 0, drag = 1.5, grav = 0, a0 = 0.9) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    if (this.life[i] <= 0) this.live++;
    this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav; this.a0[i] = a0;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.size[i] = size; this.alpha[i] = a0;
  }
  update(dt: number) {
    if (this.live <= 0) return;
    let live = 0;
    const P = this.pos, V = this.vel;
    for (let i = 0; i < this.n; i++) {
      let l = this.life[i];
      if (l <= 0) { if (this.alpha[i] !== 0) this.alpha[i] = 0; continue; }
      l -= dt; this.life[i] = l;
      if (l <= 0) { this.alpha[i] = 0; continue; }
      live++;
      const i3 = i * 3, k = Math.exp(-this.drag[i] * dt);
      V[i3] *= k; V[i3 + 2] *= k; V[i3 + 1] = V[i3 + 1] * k - this.grav[i] * dt;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const u = l / this.max[i];
      this.alpha[i] = this.a0[i] * (u > 0.8 ? (1 - u) * 5 * 0.6 + 0.4 : u);
    }
    this.live = live;
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = true; g.alpha.needsUpdate = true; g.size.needsUpdate = true; g.color.needsUpdate = true;
  }
  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

const tmpC = new THREE.Color();

export class Particles {
  /** add this to the scene */
  group = new THREE.Group();
  /** the soft pool (kept for compatibility) */
  points: THREE.Points;
  /** 0..1 emission budget (lowered automatically when the frame rate drops) */
  budget = 1;
  private soft: Pool; private glow: Pool;
  private rings: { m: THREE.Mesh; t: number; max: number; size: number }[] = [];
  constructor(n: number) {
    this.soft = new Pool(Math.round(n * 0.55), false);
    this.glow = new Pool(Math.round(n * 0.45), true);
    this.points = this.soft.points;
    this.group.add(this.soft.points, this.glow.points);
    const rg = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x7cf2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 7; m.frustumCulled = false;
      this.group.add(m); this.rings.push({ m, t: 0, max: 1, size: 10 });
    }
  }
  /** pixels per metre at 1 m distance: viewport height (device px) / (2·tan(fov/2)) */
  setScale(v: number) { this.soft.setScale(v); this.glow.setScale(v); }
  private ok(p = 1) { return Math.random() < p * this.budget; }

  smoke(p: THREE.Vector3, amount: number, width: number, dark = false) {
    if (!this.ok(amount)) return;
    const g = dark ? 0.32 + Math.random() * 0.1 : 0.78 + Math.random() * 0.16;
    this.soft.emit(p.x + R() * width * 0.4, p.y, p.z + R() * 0.6, g, g, g, 0.8, 1.0 + Math.random() * 0.4, R() * 1.5, 0.7 + Math.random(), R() * 1.5, 1.9, 1.2, 0, 0.4);
  }
  dust(p: THREE.Vector3, color: string) {
    if (!this.ok(0.7)) return;
    tmpC.set(color);
    this.soft.emit(p.x + R() * 1.4, p.y, p.z + R(), tmpC.r, tmpC.g, tmpC.b, 0.8, 0.9, R() * 2, 1 + Math.random(), R() * 2, 2.2, 1.4, 0, 0.7);
  }
  /** rain / wet-road spray behind a wheel */
  spray(p: THREE.Vector3, back: THREE.Vector3, speed: number) {
    if (!this.ok(0.6)) return;
    const k = Math.min(1, speed / 60);
    this.soft.emit(p.x + R() * 0.5, p.y + 0.1, p.z + R() * 0.5, 0.82, 0.88, 0.95, 0.5, 0.55, back.x * 6 * k + R() * 2, 1 + Math.random() * 1.5, back.z * 6 * k + R() * 2, 2.6, 2, 2, 0.35 * k + 0.1);
  }
  sparks(p: THREE.Vector3, n: number) {
    const m = Math.ceil(n * this.budget);
    for (let i = 0; i < m; i++) this.glow.emit(p.x, p.y, p.z, 1, 0.6 + Math.random() * 0.35, 0.2, 0.13, 0.35 + Math.random() * 0.3, R() * 10, 2 + Math.random() * 5, R() * 10, 0, 0.6, 14, 1);
  }
  nitroSparks(p: THREE.Vector3) {
    for (let i = 0; i < 2; i++) this.glow.emit(p.x + R() * 0.8, p.y + R() * 0.2, p.z, 0.4 + Math.random() * 0.3, 0.8, 1, 0.22, 0.3, R() * 2, R(), R() * 2, 0, 3, 0, 1);
  }
  /** nitro flame puffs from an exhaust; `back` = unit vector pointing out of the tail */
  exhaust(p: THREE.Vector3, back: THREE.Vector3, shock: boolean) {
    if (!this.ok(0.9)) return;
    const pink = shock && Math.random() < 0.5;
    const r = pink ? 1 : 0.35 + Math.random() * 0.2, g = pink ? 0.35 : 0.75 + Math.random() * 0.2, b = 1;
    this.glow.emit(p.x, p.y, p.z, r, g, b, shock ? 0.5 : 0.36, 0.22 + Math.random() * 0.1, back.x * 9 + R() * 1.5, R() * 1.2, back.z * 9 + R() * 1.5, -0.6, 2, 0, 1);
  }
  splash(p: THREE.Vector3) { const m = Math.ceil(26 * this.budget); for (let i = 0; i < m; i++) this.soft.emit(p.x, p.y, p.z, 0.75, 0.88, 1, 0.3, 0.7, R() * 8, 3 + Math.random() * 4, R() * 8, 0.4, 1.2, 12, 0.8); }
  /** a burst of fire + smoke (fire barrel hit, explosion) */
  fire(p: THREE.Vector3) {
    const m = Math.ceil(30 * this.budget);
    for (let i = 0; i < m; i++) this.glow.emit(p.x + R() * 1.5, p.y + R() * 0.5, p.z + R() * 1.5, 1, 0.4 + Math.random() * 0.4, 0.1, 0.7, 0.6 + Math.random() * 0.4, R() * 3, 3 + Math.random() * 3, R() * 3, 1, 1, 0, 1);
    for (let i = 0; i < m / 2; i++) this.soft.emit(p.x, p.y, p.z, 0.25, 0.25, 0.28, 1, 1.4, R() * 2, 2 + Math.random() * 2, R() * 2, 2.5, 1.5, 0, 0.7);
  }
  /** continuous small flames + dark smoke (burning wreck, fire barrels close to the camera) */
  burn(p: THREE.Vector3, k = 1) {
    if (this.ok(0.8 * k)) this.glow.emit(p.x + R() * 0.6, p.y, p.z + R() * 0.6, 1, 0.45 + Math.random() * 0.35, 0.1, 0.5, 0.45 + Math.random() * 0.25, R(), 2.2 + Math.random() * 1.5, R(), -0.4, 1, 0, 1);
    if (this.ok(0.35 * k)) this.soft.emit(p.x + R() * 0.4, p.y + 0.8, p.z + R() * 0.4, 0.2, 0.2, 0.22, 0.7, 1.6, R() * 0.8, 1.6 + Math.random(), R() * 0.8, 2, 0.8, 0, 0.55);
  }
  coinSparkle(p: THREE.Vector3) { const m = Math.ceil(10 * this.budget); for (let i = 0; i < m; i++) this.glow.emit(p.x, p.y, p.z, 1, 0.86, 0.3, 0.2, 0.45, R() * 4, 1 + Math.random() * 3, R() * 4, 0, 1.5, 4, 1); }
  /** coloured burst for nitro / shield / magnet pickups */
  burst(p: THREE.Vector3, color: string, n = 18) {
    tmpC.set(color);
    const m = Math.ceil(n * this.budget);
    for (let i = 0; i < m; i++) this.glow.emit(p.x, p.y, p.z, tmpC.r, tmpC.g, tmpC.b, 0.28, 0.5 + Math.random() * 0.3, R() * 9, R() * 6 + 1, R() * 9, 0, 2, 2, 1);
  }
  /** finish-line confetti around a point */
  confetti(p: THREE.Vector3, n = 40) {
    const m = Math.ceil(n * this.budget);
    for (let i = 0; i < m; i++) {
      tmpC.setHSL(Math.random(), 0.9, 0.6);
      this.soft.emit(p.x + R() * 6, p.y + 3 + Math.random() * 3, p.z + R() * 6, tmpC.r, tmpC.g, tmpC.b, 0.22, 2.2 + Math.random(), R() * 7, 3 + Math.random() * 5, R() * 7, 0, 1.6, 5, 1);
    }
  }
  /** expanding glow ring on the ground (PERFECT NITRO, takedown, checkpoint) */
  ring(p: THREE.Vector3, color: number, size = 12, time = 0.6) {
    const r = this.rings.reduce((a, b) => (a.t <= 0 ? a : b.t <= 0 ? b : a.t < b.t ? a : b));
    r.t = time; r.max = time; r.size = size;
    r.m.position.copy(p); r.m.position.y += 0.3;
    (r.m.material as THREE.MeshBasicMaterial).color.setHex(color);
    r.m.visible = true;
  }

  update(dt: number) {
    this.soft.update(dt); this.glow.update(dt);
    for (const r of this.rings) {
      if (r.t <= 0) continue;
      r.t -= dt;
      const u = 1 - Math.max(0, r.t) / r.max;
      const s = 1 + u * r.size;
      r.m.scale.set(s, s, s);
      (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.85;
      if (r.t <= 0) r.m.visible = false;
    }
  }
  dispose() {
    this.soft.dispose(); this.glow.dispose();
    this.rings[0]?.m.geometry.dispose();
    for (const r of this.rings) (r.m.material as THREE.Material).dispose();
  }
}

/** Rubber marks on the road: a ring buffer of quads, one strip per wheel key. */
export class SkidMarks {
  mesh: THREE.Mesh;
  private pos: Float32Array; private birth: Float32Array; private str: Float32Array;
  private head = 0;
  private last = new Map<number, { x: number; y: number; z: number; rx: number; rz: number; t: number }>();
  private mat: THREE.ShaderMaterial;
  private dirty = false;
  constructor(private segs: number, color = "#111114", private life = 9) {
    const n = segs * 4;
    this.pos = new Float32Array(n * 3); this.birth = new Float32Array(n).fill(-999); this.str = new Float32Array(n);
    const idx = new Uint32Array(segs * 6);
    for (let i = 0; i < segs; i++) { const a = i * 4; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    const g = new THREE.BufferGeometry();
    const pa = new THREE.BufferAttribute(this.pos, 3); pa.setUsage(THREE.DynamicDrawUsage);
    const ba = new THREE.BufferAttribute(this.birth, 1); ba.setUsage(THREE.DynamicDrawUsage);
    const sa = new THREE.BufferAttribute(this.str, 1); sa.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", pa); g.setAttribute("birth", ba); g.setAttribute("strength", sa);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const c = new THREE.Color(color);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { time: { value: 0 }, life: { value: life }, color: { value: c } },
      vertexShader: `attribute float birth; attribute float strength; uniform float time; uniform float life; varying float vA;
        void main(){ float age = time - birth; vA = strength * clamp(1.0 - age / life, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 color; varying float vA; void main(){ if (vA <= 0.003) discard; gl_FragColor = vec4(color, vA); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }
  /** lay rubber for wheel `key` at world point p (on the road), right = road right vector */
  mark(key: number, p: THREE.Vector3, right: THREE.Vector3, width: number, strength: number, time: number) {
    if (this.segs <= 0) return;
    let L = this.last.get(key);
    if (!L) { L = { x: 0, y: 0, z: 0, rx: 0, rz: 0, t: -1 }; this.last.set(key, L); }
    if (time - L.t > 0.12) { L.x = p.x; L.y = p.y; L.z = p.z; L.rx = right.x; L.rz = right.z; L.t = time; return; }
    const dx = p.x - L.x, dz = p.z - L.z;
    if (dx * dx + dz * dz < 0.5) { L.t = time; return; }
    const i = this.head; this.head = (this.head + 1) % this.segs;
    const v = i * 4, w = width / 2, y0 = L.y + 0.03, y1 = p.y + 0.03;
    const P = this.pos, o = v * 3;
    P[o] = L.x - L.rx * w; P[o + 1] = y0; P[o + 2] = L.z - L.rz * w;
    P[o + 3] = L.x + L.rx * w; P[o + 4] = y0; P[o + 5] = L.z + L.rz * w;
    P[o + 6] = p.x - right.x * w; P[o + 7] = y1; P[o + 8] = p.z - right.z * w;
    P[o + 9] = p.x + right.x * w; P[o + 10] = y1; P[o + 11] = p.z + right.z * w;
    for (let k = 0; k < 4; k++) { this.birth[v + k] = time; this.str[v + k] = strength; }
    L.x = p.x; L.y = p.y; L.z = p.z; L.rx = right.x; L.rz = right.z; L.t = time;
    this.dirty = true;
  }
  update(time: number) {
    this.mat.uniforms.time.value = time;
    if (!this.dirty) return;
    this.dirty = false;
    const a = this.mesh.geometry.attributes;
    a.position.needsUpdate = true; a.birth.needsUpdate = true; a.strength.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
