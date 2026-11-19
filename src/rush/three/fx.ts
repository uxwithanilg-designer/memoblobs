// Speed and juice: two light trails streaming from Rollo's soles (one wide trail behind the Curl Ball), a warm glow on
// the ground under him, speed streaks rushing past the screen edges, and pooled particle bursts — pearl sparkles, grass
// dust on landing, water spray, crate splinters, Clanker sparks and goal confetti.
import * as THREE from "three";
import { glow, sparkle } from "./tex";

const TRAIL = 26;

class Trail {
  readonly mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private ups: THREE.Vector3[] = [];
  private geo: THREE.BufferGeometry;
  constructor(color: string, private width: number) {
    this.geo = new THREE.BufferGeometry();
    const n = TRAIL * 2;
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const a = new Float32Array(n * 4);
    const c = new THREE.Color(color);
    for (let i = 0; i < TRAIL; i++) { const k = 0.75 * Math.pow(1 - i / (TRAIL - 1), 1.6); for (let j = 0; j < 2; j++) a.set([c.r, c.g, c.b, k], (i * 2 + j) * 4); }
    this.geo.setAttribute("color", new THREE.BufferAttribute(a, 4));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL - 1; i++) { const p = i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
  }
  push(p: THREE.Vector3, up: THREE.Vector3, on: number) {
    this.pts.unshift(p.clone()); this.ups.unshift(up.clone());
    if (this.pts.length > TRAIL) { this.pts.pop(); this.ups.pop(); }
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)], u = this.ups[Math.min(i, this.ups.length - 1)];
      const w = this.width * (1 - i / TRAIL) * on;
      pos.setXYZ(i * 2, q.x - u.x * w * 0.5, q.y - u.y * w * 0.5, q.z - u.z * w * 0.5); pos.setXYZ(i * 2 + 1, q.x + u.x * w * 0.5, q.y + u.y * w * 0.5, q.z + u.z * w * 0.5);
    }
    pos.needsUpdate = true;
  }
  reset() { this.pts = []; this.ups = []; }
  setColor(color: string) {
    const a = this.geo.attributes.color as THREE.BufferAttribute, c = new THREE.Color(color);
    for (let i = 0; i < TRAIL * 2; i++) { a.setX(i, c.r); a.setY(i, c.g); a.setZ(i, c.b); }
    a.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

interface Part { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; col: THREE.Color; grav: number }

export class Fx {
  readonly group = new THREE.Group();
  private trails: Trail[];
  private ballTrail: Trail;
  readonly glowDisc: THREE.Mesh;
  private streaks: THREE.LineSegments;
  private streakData: { a: number; r: number; z: number; sp: number }[] = [];
  private parts: Part[] = [];
  private pts: THREE.Points;
  private ptsGeo: THREE.BufferGeometry;
  private MAX = 420;

  constructor(readonly camera: THREE.PerspectiveCamera, night: boolean) {
    this.trails = [new Trail("#3FE8C0", 0.26), new Trail("#3FE8C0", 0.26)];
    this.ballTrail = new Trail("#2FD6B0", 0.6);
    for (const t of [...this.trails, this.ballTrail]) this.group.add(t.mesh);
    this.glowDisc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshBasicMaterial({ map: glow(night ? "#FFC46B" : "#FFE6A0"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: night ? 0.42 : 0.2 }));
    this.group.add(this.glowDisc);
    // speed streaks: thin lines in camera space flying past
    const n = 60;
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    this.streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.streaks.frustumCulled = false;
    for (let i = 0; i < n; i++) this.streakData.push({ a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.6, z: -Math.random() * 30, sp: 0.8 + Math.random() * 0.6 });
    camera.add(this.streaks);
    // particles
    this.ptsGeo = new THREE.BufferGeometry();
    this.ptsGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.MAX * 3), 3));
    this.ptsGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.MAX * 3), 3));
    this.pts = new THREE.Points(this.ptsGeo, new THREE.PointsMaterial({ map: sparkle(), size: 0.26, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false;
    this.group.add(this.pts);
  }

  /** Rollo's Locker: the colour of the sole trails and of the Curl Ball's trail */
  setTrail(sole: string, ball: string) { for (const t of this.trails) t.setColor(sole); this.ballTrail.setColor(ball); }
  /** trails from the soles (or the ball), the ground glow, streaks by speed */
  update(dt: number, o: { soles: THREE.Vector3[]; ballPos: THREE.Vector3; up: THREE.Vector3; side: THREE.Vector3; ground: THREE.Vector3; ball: boolean; speed: number; turbo: boolean; air: boolean }) {
    const fast = Math.min(1, Math.max(0, (o.speed - 12) / 14));
    for (let i = 0; i < 2; i++) this.trails[i].push(o.soles[i].clone().addScaledVector(o.up, 0.04), o.side, o.ball ? 0 : 0.45 + fast * 0.55);
    this.ballTrail.push(o.ballPos.clone().addScaledVector(o.up, -0.42), o.side, o.ball ? 1 : 0);
    this.glowDisc.position.copy(o.ground).addScaledVector(o.up, 0.06);
    this.glowDisc.lookAt(o.ground.x + o.up.x, o.ground.y + o.up.y, o.ground.z + o.up.z);
    this.glowDisc.scale.setScalar(o.air ? 0.7 : 1);
    // streaks
    const k = o.turbo ? 1 : fast * 0.5;
    const mat = this.streaks.material as THREE.LineBasicMaterial;
    mat.opacity += ((k > 0.1 ? 0.18 + k * 0.32 : 0) - mat.opacity) * Math.min(1, dt * 6);
    const pos = this.streaks.geometry.attributes.position as THREE.BufferAttribute;
    const asp = this.camera.aspect;
    this.streakData.forEach((d, i) => {
      d.z += dt * o.speed * 2.2 * d.sp;
      if (d.z > -1) { d.z = -30 - Math.random() * 10; d.a = Math.random() * Math.PI * 2; }
      const x = Math.cos(d.a) * d.r * 9 * Math.max(1, asp), y = Math.sin(d.a) * d.r * 9;
      const len = 1.5 + k * 5;
      pos.setXYZ(i * 2, x, y, d.z); pos.setXYZ(i * 2 + 1, x, y, d.z + len);
    });
    pos.needsUpdate = true;
    // particles
    const pp = this.ptsGeo.attributes.position as THREE.BufferAttribute, pc = this.ptsGeo.attributes.color as THREE.BufferAttribute;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.v.y -= q.grav * dt; q.p.addScaledVector(q.v, dt);
    }
    for (const q of this.parts) {
      if (n >= this.MAX) break;
      const f = q.life / q.max;
      pp.setXYZ(n, q.p.x, q.p.y, q.p.z); pc.setXYZ(n, q.col.r * f, q.col.g * f, q.col.b * f); n++;
    }
    for (let i = n; i < this.MAX; i++) pp.setXYZ(i, 0, -1e5, 0);
    pp.needsUpdate = true; pc.needsUpdate = true;
  }
  burst(at: THREE.Vector3, kind: "pearl" | "dust" | "spray" | "splinter" | "spark" | "confetti" | "medal" | "rush", n = 14) {
    const cols: Record<string, string[]> = {
      pearl: ["#FFE29A", "#FFFFFF", "#FFC94A"], dust: ["#C8E6A0", "#E8D8B0"], spray: ["#BFE6FF", "#FFFFFF"], splinter: ["#C98A55", "#8E5F38"],
      spark: ["#FFE066", "#FFFFFF", "#7DFFE0"], confetti: ["#FF5A7A", "#FFD15A", "#5CF2C9", "#7A5CFF", "#FFFFFF"], medal: ["#B8C8FF", "#FFFFFF"], rush: ["#7DFFE0", "#FFFFFF", "#B89CFF"],
    };
    const list = cols[kind];
    for (let i = 0; i < n && this.parts.length < this.MAX; i++) {
      const sp = kind === "confetti" ? 6 + Math.random() * 6 : kind === "dust" ? 2 + Math.random() * 2 : 3 + Math.random() * 4;
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + (kind === "dust" ? 0.1 : 0.4), Math.random() - 0.5).normalize().multiplyScalar(sp);
      this.parts.push({ p: at.clone(), v, life: 0.5 + Math.random() * (kind === "confetti" ? 1.6 : 0.6), max: 1.2, size: 0.5, col: new THREE.Color(list[i % list.length]), grav: kind === "spark" || kind === "pearl" || kind === "rush" ? 4 : 12 });
    }
  }
  reset() { for (const t of [...this.trails, this.ballTrail]) t.reset(); this.parts = []; }
  dispose() {
    for (const t of [...this.trails, this.ballTrail]) t.dispose();
    this.streaks.geometry.dispose(); (this.streaks.material as THREE.Material).dispose(); this.streaks.removeFromParent();
    this.ptsGeo.dispose(); (this.pts.material as THREE.Material).dispose();
    this.glowDisc.geometry.dispose(); (this.glowDisc.material as THREE.Material).dispose();
  }
}
