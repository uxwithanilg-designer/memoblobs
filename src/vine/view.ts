// One stage's 3D: the glossy vine (tube chunks with leaves, tendrils and flowers; gaps, forks, spiral trunks), every
// hazard with its own animation, bugs, pickups, the flower gate and the moss checkpoint, zone dressing (webs, sap,
// dew, sun patches, waterfalls, tree holes) and the world's layered background props. Positioned at `off` so each
// stage starts where the last one ended.
import * as THREE from "three";
import * as M from "./models";
import { pathAt } from "./path";
import { leapWindow } from "./stages";
import { BUGS, GUARDIANS, WORLDS, type World } from "./worlds";
import type { Sim } from "./sim";
import type { Haz, Stage } from "./types";

export const VR = 0.13;
/** Pippi's mirror vine runs this far behind Tondu's */
export const PIPPI_Z = -1.6;
const FORK_OFF = 0.95;
type D = { dispose: () => void };
const tP = [0, 0, 0], tT = [0, 0, 0], tN = [0, 0, 0];
const PT = { p: tP, t: tT, n: tN };
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
const mA = new THREE.Matrix4(), qA = new THREE.Quaternion(), sA = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

/** shared geometry + materials (built once per renderer) */
export class Kit {
  keep: D[] = [];
  mat: THREE.MeshStandardMaterial; glossy: THREE.MeshPhysicalMaterial; glow: THREE.MeshBasicMaterial; ghost: THREE.MeshBasicMaterial; water: THREE.MeshBasicMaterial;
  thorn: THREE.BufferGeometry; burr: THREE.BufferGeometry; budHead: THREE.BufferGeometry; budSpikes: THREE.BufferGeometry; ant: THREE.BufferGeometry; bee: THREE.BufferGeometry; spider: THREE.BufferGeometry;
  mango: THREE.BufferGeometry; coconut: THREE.BufferGeometry; nut: THREE.BufferGeometry; pod: THREE.BufferGeometry; snail: THREE.BufferGeometry; drop: THREE.BufferGeometry;
  sun: THREE.BufferGeometry; glide: THREE.BufferGeometry; magnet: THREE.BufferGeometry; shield: THREE.BufferGeometry; moss: THREE.BufferGeometry; rope: THREE.BufferGeometry;
  ring: THREE.BufferGeometry; disc: THREE.BufferGeometry; bolt: THREE.BufferGeometry; web: THREE.BufferGeometry; plane: THREE.BufferGeometry; sphere: THREE.BufferGeometry;
  bugs = new Map<number, THREE.BufferGeometry>();
  constructor() {
    const k = <X extends D>(x: X) => { this.keep.push(x); return x; };
    this.mat = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
    this.glossy = k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
    this.glow = k(new THREE.MeshBasicMaterial({ color: "#E8FF8A", transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    this.ghost = k(new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }));
    this.water = k(new THREE.MeshBasicMaterial({ color: "#E6F8FF", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    this.thorn = k(M.thornGeo()); this.burr = k(M.burrGeo()); this.budHead = k(M.budHeadGeo()); this.budSpikes = k(M.budSpikesGeo());
    this.ant = k(M.antGeo()); this.bee = k(M.beeGeo()); this.spider = k(M.spiderGeo());
    this.mango = k(M.mangoGeo()); this.coconut = k(M.coconutGeo()); this.nut = k(M.nutGeo()); this.pod = k(M.podGeo()); this.snail = k(M.snailGeo()); this.drop = k(M.dropGeo());
    this.sun = k(M.sunGeo()); this.glide = k(M.glideGeo()); this.magnet = k(M.magnetGeo()); this.shield = k(M.shieldGeo()); this.moss = k(M.mossRingGeo()); this.rope = k(M.ropeGeo());
    this.ring = k(new THREE.TorusGeometry(VR * 1.25, 0.05, 8, 20)); this.disc = k(new THREE.CircleGeometry(0.5, 20)); this.sphere = k(new THREE.SphereGeometry(1, 12, 8));
    this.plane = k(new THREE.PlaneGeometry(1, 1));
    const bp: THREE.Vector3[] = []; for (let i = 0; i < 8; i++) bp.push(new THREE.Vector3((i % 2 ? 0.25 : -0.25) * Math.random(), 5 - i * 0.7, 0));
    this.bolt = k(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 24, 0.05, 4));
    const wp: number[] = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; wp.push(0, 0, 0, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0); for (const r of [0.18, 0.32, 0.46]) { const b = ((i + 1) / 6) * Math.PI * 2; wp.push(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(b) * r, Math.sin(b) * r, 0); } }
    this.web = k(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(wp, 3)));
  }
  bug(kind: number): THREE.BufferGeometry {
    let g = this.bugs.get(kind);
    if (!g) { g = M.bugGeo(kind < 0 ? null : BUGS[kind]); this.bugs.set(kind, g); this.keep.push(g); }
    return g;
  }
  dispose() { for (const k of this.keep) k.dispose(); }
}

interface AnimHaz { h: Haz; i: number; o: THREE.Object3D; parts?: THREE.Object3D[]; base: THREE.Vector3 }

export class StageView {
  st: Stage; world: World; g = new THREE.Group(); off: THREE.Vector3;
  private keep: D[] = [];
  private thorns: THREE.InstancedMesh | null = null; private thornHaz: number[] = [];
  private anim: AnimHaz[] = [];
  private bugMeshes: { m: THREE.InstancedMesh; idx: number[] }[] = [];
  private picks: THREE.Mesh[] = [];
  private gate: THREE.Mesh; private gateBloom = 0;
  private moss: THREE.Mesh | null = null;
  private tubes: { m: THREE.Mesh; s0: number; s1: number }[] = [];
  private marks: { m: THREE.Mesh; gap: number }[] = [];
  private ropes: { m: THREE.Mesh; gap: number }[] = [];
  private kit: Kit;
  /** where the stage ends in world space (the next stage starts here) */
  end: THREE.Vector3;
  yMin = 0; yMax = 0;

  constructor(st: Stage, off: THREE.Vector3, kit: Kit, quality: "low" | "medium" | "high") {
    this.st = st; this.off = off.clone(); this.kit = kit;
    this.world = WORLDS[st.def.world];
    this.g.position.copy(off);
    const k = <X extends D>(x: X) => { this.keep.push(x); return x; };
    const p = st.path, w = this.world;
    this.end = new THREE.Vector3(p.P[(p.n - 1) * 3], p.P[(p.n - 1) * 3 + 1], p.P[(p.n - 1) * 3 + 2]).add(off);
    let y0 = 1e9, y1 = -1e9; for (let i = 0; i < p.n; i++) { y0 = Math.min(y0, p.P[i * 3 + 1]); y1 = Math.max(y1, p.P[i * 3 + 1]); }
    this.yMin = y0 + off.y; this.yMax = y1 + off.y;
    // ---------------------------------------------------------------- the vine
    const vineMat = k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: new THREE.Color(w.vine[2]) }));
    const forkOff = (s: number) => {
      for (const f of st.forks) if (s >= f.s0 - 2 && s <= f.s1 + 2) {
        const a = Math.min(1, Math.max(0, (s - (f.s0 - 2)) / 3)), b = Math.min(1, Math.max(0, ((f.s1 + 2) - s) / 3));
        const k2 = Math.min(a, b); return k2 * k2 * (3 - 2 * k2) * FORK_OFF;
      }
      return 0;
    };
    const chunk = 12; // metres per tube mesh
    const c1 = new THREE.Color(w.vine[0]), c2 = new THREE.Color(w.vine[1]), c3 = new THREE.Color(w.vine[2]);
    const buildTube = (sA0: number, sA1: number, lat: number) => {
      const seg = 10, step = 0.25;
      const n = Math.max(2, Math.round((sA1 - sA0) / step) + 1);
      const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
      const cc = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const s = sA0 + ((sA1 - sA0) * i) / (n - 1);
        pathAt(p, s, PT);
        vA.set(tT[0], tT[1], tT[2]).normalize(); vB.set(tN[0], tN[1], tN[2]).normalize(); vC.crossVectors(vA, vB).normalize();
        const fo = lat * forkOff(s);
        // tapered ends at gaps, a gentle bulge every ~1.3 m (nodes)
        const endK = Math.min(1, (s - sA0) / 0.6, (sA1 - s) / 0.6);
        const r = VR * (0.55 + 0.45 * Math.min(1, endK * 1.4)) * (1 + 0.07 * Math.max(0, Math.cos(s * 4.8)) ** 6);
        for (let j = 0; j <= seg; j++) {
          const a = (j / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const nx = vB.x * ca + vC.x * sa, ny = vB.y * ca + vC.y * sa, nz = vB.z * ca + vC.z * sa;
          pos.push(tP[0] + vB.x * fo + nx * r, tP[1] + vB.y * fo + ny * r, tP[2] + vB.z * fo + nz * r);
          nor.push(nx, ny, nz);
          // twisting stripes along the vine, lighter toward the camera side
          const stripe = Math.max(0, Math.sin(a * 3 + s * 2.2)) ** 2;
          cc.copy(c1).lerp(c2, stripe * 0.55).lerp(c3, Math.max(0, sa) * 0.25);
          col.push(cc.r, cc.g, cc.b);
        }
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = k(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, vineMat); m.receiveShadow = quality !== "low"; this.g.add(m);
      this.tubes.push({ m, s0: sA0, s1: sA1 });
    };
    // split into solid runs (gaps cut the vine), forks get two tubes
    const runs: [number, number][] = [];
    let s = 0;
    for (const gp of st.gaps) { if (gp.s0 > s) runs.push([s, gp.s0]); s = gp.s1; }
    runs.push([s, p.len]);
    const mirror = st.haz.some((h) => h.mirror);
    for (const [a, b] of runs) {
      for (let x = a; x < b - 0.01; x += chunk) {
        const y = Math.min(b, x + chunk + 0.01);
        const inFork = st.forks.some((f) => y > f.s0 - 2 && x < f.s1 + 2);
        if (inFork) { buildTube(x, y, 1); buildTube(x, y, -1); } else buildTube(x, y, 0);
        if (mirror) { const before = this.tubes.length; buildTube(x, y, 0); const t = this.tubes[before]; t.m.position.z = PIPPI_Z; }
      }
    }
    // a giant trunk behind every spiral
    const barkMat = k(new THREE.MeshStandardMaterial({ color: w.trunk, roughness: 0.85 }));
    for (const tr of p.trunks) {
      const h = tr.y1 - tr.y0;
      const tg = k(new THREE.CylinderGeometry(tr.r, tr.r * 1.08, h, 22, 6));
      const tm = new THREE.Mesh(tg, barkMat); tm.position.set(tr.x, (tr.y0 + tr.y1) / 2, tr.z); tm.receiveShadow = quality !== "low"; this.g.add(tm);
    }
    // leaves, tendrils, flowers along the vine (mostly behind it so the sides stay readable)
    const leafG = k(M.leafGeo(0.62, 0.3, w.leaf[0], w.vine[2])), tendG = k(M.tendrilGeo(w.vine[2])), flG = k(M.flowerGeo(w.accent, "#FFF2A0", 0.14));
    const leafM: THREE.Matrix4[] = [], tendM: THREE.Matrix4[] = [], flM: THREE.Matrix4[] = [];
    let ls = 0.4;
    while (ls < p.len) {
      const gapHere = st.gaps.some((gp) => ls > gp.s0 - 0.4 && ls < gp.s1 + 0.4);
      if (!gapHere) {
        pathAt(p, ls, PT);
        vA.set(tT[0], tT[1], tT[2]).normalize(); vB.set(tN[0], tN[1], tN[2]).normalize(); vC.crossVectors(vA, vB).normalize();
        const fo = forkOff(ls);
        const h = Math.sin(ls * 12.9898) * 43758.5453; const r = h - Math.floor(h);
        // leaf: out of the vine's back (-C) or upper-back, never on the play sides
        const side = r < 0.5 ? 1 : -1;
        const dir = vD.copy(vC).multiplyScalar(-0.85).addScaledVector(vB, side * 0.55).normalize();
        const base = new THREE.Vector3(tP[0], tP[1], tP[2]).addScaledVector(vB, fo).addScaledVector(dir, VR * 0.8);
        mA.lookAt(new THREE.Vector3(), dir, vA); qA.setFromRotationMatrix(mA);
        const sc = 0.8 + r * 0.6;
        leafM.push(new THREE.Matrix4().compose(base, qA, sA.set(sc, sc, sc)));
        if (r > 0.86) tendM.push(new THREE.Matrix4().compose(base.clone().addScaledVector(dir, 0.05), qA, sA.set(1, 1, 1)));
        if (r > 0.72 && r < 0.78) { const fd = vD.copy(vC).multiplyScalar(-0.3).addScaledVector(vB, -side).normalize(); mA.lookAt(new THREE.Vector3(), fd, UP); qA.setFromRotationMatrix(mA); flM.push(new THREE.Matrix4().compose(base.clone().addScaledVector(fd, 0.12), qA, sA.set(1, 1, 1))); }
      }
      ls += 0.5 + ((ls * 7.13) % 0.3);
    }
    const inst = (geo: THREE.BufferGeometry, mats: THREE.Matrix4[], mat: THREE.Material) => {
      if (!mats.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); this.g.add(im); return im;
    };
    const leafMat = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    // band the vine's leaves (the stage is long; only nearby bands are drawn)
    const band = (ms: THREE.Matrix4[]) => { const out = new Map<number, THREE.Matrix4[]>(); for (const m of ms) { const k2 = Math.floor(m.elements[13] / 20); let a = out.get(k2); if (!a) { a = []; out.set(k2, a); } a.push(m); } return [...out.values()]; };
    for (const ms of band(leafM)) inst(leafG, ms, leafMat);
    for (const ms of band(tendM)) inst(tendG, ms, kit.mat);
    for (const ms of band(flM)) inst(flG, ms, kit.mat);
    // ---------------------------------------------------------------- hazards
    const thornIdx: number[] = [];
    st.haz.forEach((h, i) => { if (h.kind === "thorn" && !h.mirror) thornIdx.push(i); });
    if (thornIdx.length) {
      const tm = new THREE.InstancedMesh(kit.thorn, kit.glossy, thornIdx.length); tm.castShadow = quality === "high";
      thornIdx.forEach((hi, j) => { this.place(st.haz[hi], tm, j, 0); });
      tm.computeBoundingSphere(); this.g.add(tm); this.thorns = tm; this.thornHaz = thornIdx;
    }
    for (let i = 0; i < st.haz.length; i++) {
      const h = st.haz[i];
      if (h.kind === "thorn" && !h.mirror) continue;
      const o = this.hazObject(h);
      if (!o) continue;
      const base = this.sidePoint(h.s, h.side === 0 ? 1 : h.side, 0, h.br).clone();
      if (h.mirror) { const side = h.side === 0 ? 1 : h.side; o.position.copy(this.sidePoint(h.s, side, -0.02)); o.position.z += PIPPI_Z; pathAt(this.st.path, h.s, PT); o.quaternion.setFromUnitVectors(UP, vB.set(tN[0], tN[1], tN[2]).multiplyScalar(side)); this.g.add(o); continue; }
      this.g.add(o); this.anim.push({ h, i, o, base });
    }
    // ---------------------------------------------------------------- bugs and pickups
    const kinds = [...new Set(st.bugs.map((b) => b.kind))];
    for (const kind of kinds) {
      const idx = st.bugs.map((b, i) => (b.kind === kind ? i : -1)).filter((i) => i >= 0);
      const bm = new THREE.InstancedMesh(kit.bug(kind), kind < 0 ? kit.glossy : kit.mat, idx.length);
      bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); bm.frustumCulled = false;
      this.g.add(bm); this.bugMeshes.push({ m: bm, idx });
    }
    for (const pk of st.picks) {
      const geo = pk.kind === "sun" ? kit.sun : pk.kind === "glide" ? kit.glide : pk.kind === "magnet" ? kit.magnet : kit.shield;
      const m = new THREE.Mesh(geo, kit.glossy); m.position.copy(this.sidePoint(pk.s, pk.side, 0.45, pk.br)); this.g.add(m); this.picks.push(m);
    }
    // ---------------------------------------------------------------- gaps: leap marks, flower pads, ropes
    const lw = leapWindow(st.def.speed);
    st.gaps.forEach((gp, gi) => {
      if (gp.kind === "flower") {
        const fp = new THREE.Mesh(k(M.flowerPadGeo(w.accent)), kit.mat); fp.position.copy(this.sidePoint(gp.s0 - 0.2, gp.side ?? 1, 0.05)); fp.scale.setScalar(1.4);
        pathAt(p, gp.s0, PT); vB.set(tN[0], tN[1], tN[2]).multiplyScalar(gp.side ?? 1); fp.quaternion.setFromUnitVectors(UP, vB); this.g.add(fp);
        return;
      }
      for (let ms = gp.s0 - lw; ms <= gp.s0; ms += 0.35) {
        const m = new THREE.Mesh(kit.ring, kit.glow.clone()); this.keep.push(m.material as THREE.Material);
        pathAt(p, ms, PT); m.position.set(tP[0], tP[1], tP[2]); vA.set(tT[0], tT[1], tT[2]); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vA);
        this.g.add(m); this.marks.push({ m, gap: gi });
      }
      if (gp.kind === "swing") {
        const rm = new THREE.Mesh(kit.rope, kit.glow.clone()); this.keep.push(rm.material as THREE.Material);
        pathAt(p, gp.s0 + 0.3, PT); rm.position.set(tP[0], tP[1] + 3.2, tP[2] + 0.3); this.g.add(rm); this.ropes.push({ m: rm, gap: gi });
      }
    });
    // ---------------------------------------------------------------- zones
    for (const z of st.zones) {
      if (z.kind === "web" || z.kind === "sap" || z.kind === "dew" || z.kind === "sun") {
        for (let zs = z.s0; zs < z.s1; zs += z.kind === "web" ? 0.9 : 0.5) {
          const pt = this.sidePoint(zs, z.side === 0 ? 1 : z.side, 0.06);
          let m: THREE.Object3D;
          if (z.kind === "web") { m = new THREE.LineSegments(kit.web, new THREE.LineBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.8 })); this.keep.push((m as THREE.LineSegments).material as THREE.Material); }
          else if (z.kind === "sun") { m = new THREE.Mesh(kit.disc, new THREE.MeshBasicMaterial({ color: "#FFE07A", transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); this.keep.push((m as THREE.Mesh).material as THREE.Material); m.scale.setScalar(0.9); }
          else { m = new THREE.Mesh(kit.drop, kit.glossy); m.scale.setScalar(z.kind === "sap" ? 1.4 : 1); }
          pathAt(p, zs, PT); vB.set(tN[0], tN[1], tN[2]).multiplyScalar(z.side === 0 ? 1 : z.side);
          m.position.copy(pt); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vB);
          if (z.kind === "sap") ((m as THREE.Mesh).material = kit.glossy);
          this.g.add(m);
        }
        if (z.kind === "sap") {
          // amber sap blobs
          for (const ch of this.g.children.slice(-Math.ceil((z.s1 - z.s0) / 0.5))) if ((ch as THREE.Mesh).isMesh) (ch as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({ color: "#D88A1A", roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.9 });
        }
      }
      if (z.kind === "hole") {
        const L = z.s1 - z.s0;
        pathAt(p, (z.s0 + z.s1) / 2, PT);
        const tg = k(new THREE.CylinderGeometry(3.2, 3.2, L * 0.75, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9));
        const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: new THREE.Color(w.trunk).multiplyScalar(0.8), roughness: 0.9, side: THREE.BackSide }));
        this.keep.push(tm.material as THREE.Material);
        tm.position.set(tP[0], tP[1], tP[2] - 0.6); this.g.add(tm);
        for (let i = 0; i < 8; i++) { const mu = new THREE.Mesh(k(M.propGeo("mushroom", w.leaf, w.trunk, "#7CFFB4")), kit.mat); mu.scale.setScalar(0.6); mu.position.set(tP[0] + (i % 2 ? 2.2 : -2.2), tP[1] - L * 0.35 + i * L * 0.1, tP[2] - 1.6); this.g.add(mu); }
      }
      if (z.kind === "waterfall") {
        pathAt(p, (z.s0 + z.s1) / 2, PT);
        const L = z.s1 - z.s0;
        const wf = new THREE.Mesh(kit.plane, kit.water); wf.scale.set(2.6, L * 0.8 + 6, 1); wf.position.set(tP[0], tP[1], tP[2] - 0.5); this.g.add(wf);
      }
    }
    // ---------------------------------------------------------------- gate and moss checkpoint
    this.gate = new THREE.Mesh(k(M.gateGeo(w.accent)), kit.mat);
    pathAt(p, p.len - 0.6, PT); this.gate.position.set(tP[0], tP[1], tP[2]); vA.set(tT[0], tT[1], tT[2]);
    this.gate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vA); this.g.add(this.gate);
    if (st.mid) { this.moss = new THREE.Mesh(kit.moss, kit.mat); pathAt(p, st.mid, PT); this.moss.position.set(tP[0], tP[1], tP[2]); this.moss.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vA.set(tT[0], tT[1], tT[2])); this.g.add(this.moss); }
    // ---------------------------------------------------------------- background props in layers
    this.buildProps(quality);
  }

  /** a point on the vine surface at s, round the vine by side (+1 / -1), lifted `lift` m off it */
  sidePoint(s: number, side: number, lift = 0, br?: number): THREE.Vector3 {
    pathAt(this.st.path, s, PT);
    const out = new THREE.Vector3(tP[0], tP[1], tP[2]);
    if (br) { const f = this.st.forks.find((x) => s >= x.s0 - 2 && s <= x.s1 + 2); if (f) { const a = Math.min(1, Math.max(0, (s - (f.s0 - 2)) / 3)), b = Math.min(1, Math.max(0, ((f.s1 + 2) - s) / 3)); const k2 = Math.min(a, b); out.x += tN[0] * br * k2 * k2 * (3 - 2 * k2) * FORK_OFF; out.y += tN[1] * br * k2 * k2 * (3 - 2 * k2) * FORK_OFF; out.z += tN[2] * br * k2 * k2 * (3 - 2 * k2) * FORK_OFF; } }
    return out.add(new THREE.Vector3(tN[0], tN[1], tN[2]).multiplyScalar(side * (VR + lift)));
  }
  /** the fork's sideways offset at s for branch br (for Tondu) */
  forkShift(s: number, br: number): number {
    const f = this.st.forks.find((x) => s >= x.s0 - 2 && s <= x.s1 + 2);
    if (!f || !br) return 0;
    const a = Math.min(1, Math.max(0, (s - (f.s0 - 2)) / 3)), b = Math.min(1, Math.max(0, ((f.s1 + 2) - s) / 3)); const k2 = Math.min(a, b);
    return br * k2 * k2 * (3 - 2 * k2) * FORK_OFF;
  }
  private place(h: Haz, im: THREE.InstancedMesh, j: number, extraLift: number) {
    const side = h.side === 0 ? 1 : h.side;
    const pt = this.sidePoint(h.s, side, extraLift - 0.02, h.br);
    pathAt(this.st.path, h.s, PT);
    vB.set(tN[0], tN[1], tN[2]).multiplyScalar(side);
    qA.setFromUnitVectors(UP, vB);
    const sc = 0.85 + h.len * 0.35;
    mA.compose(pt, qA, sA.set(sc, sc, sc));
    im.setMatrixAt(j, mA);
  }
  private hazObject(h: Haz): THREE.Object3D | null {
    const kit = this.kit;
    const mesh = (g: THREE.BufferGeometry, mat: THREE.Material = kit.mat) => new THREE.Mesh(g, mat);
    const gr = GUARDIANS[this.st.def.guardian ?? ""];
    switch (h.kind) {
      case "thorn": case "pod": { const g = new THREE.Group(); g.add(mesh(h.kind === "pod" ? kit.pod : kit.thorn, kit.glossy)); if (h.kind === "pod") { const t = mesh(kit.thorn, kit.glossy); t.scale.setScalar(0.001); t.name = "burst"; g.add(t); } return g; }
      case "burr": return mesh(kit.burr, kit.glossy);
      case "bud": { const g = new THREE.Group(); for (const sd of [1, -1]) { const b = new THREE.Group(); b.add(mesh(kit.budHead, kit.glossy)); const sp = mesh(kit.budSpikes, kit.glossy); sp.name = "spikes"; b.add(sp); b.userData.side = sd; g.add(b); } return g; }
      case "ants": { const g = new THREE.Group(); const n = Math.max(4, Math.round(h.len / 0.22)); for (let i = 0; i < n; i++) { const a = mesh(kit.ant); a.userData.k = i / n; g.add(a); } return g; }
      case "bees": case "tongue": case "crawler": case "spider": case "dive": {
        if (h.kind === "spider") { const g = new THREE.Group(); const sp = mesh(kit.spider, kit.glossy); sp.scale.setScalar(1.6); g.add(sp); const th = new THREE.Mesh(kit.plane, new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.6 })); this.keep.push(th.material as THREE.Material); th.name = "thread"; g.add(th); return g; }
        if (h.kind === "bees") { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = mesh(kit.bee, kit.glossy); b.scale.setScalar(1.3); b.userData.k = i; g.add(b); } return g; }
        if (h.kind === "tongue") { const g = new THREE.Group(); const t = new THREE.Mesh(kit.sphere, new THREE.MeshStandardMaterial({ color: "#FF6A8A", roughness: 0.3 })); this.keep.push(t.material as THREE.Material); t.name = "tongue"; g.add(t); return g; }
        if (h.kind === "dive") { const g = new THREE.Group(); const sh = new THREE.Mesh(kit.disc, kit.ghost); sh.name = "shadow"; g.add(sh); return g; }
        // crawler: a caterpillar (or the guardian's snake / beetle colours)
        const g = new THREE.Group(); const col = gr && (gr.model === "snake" || gr.model === "beetle") ? gr.colors : ["#7ACB3A", "#FFD23F", "#2A2A2A"];
        const segG = M.segGeo(col[0]), segG2 = M.segGeo(col[1]); this.keep.push(segG, segG2);
        const n = Math.max(5, Math.round(h.len / 0.24));
        for (let i = 0; i < n; i++) { const sg = mesh(i % 2 ? segG2 : segG, kit.glossy); sg.userData.k = i / n; sg.scale.setScalar(1 - (i / n) * 0.35); g.add(sg); }
        return g;
      }
      case "fruit": case "nut": case "drip": { const g = new THREE.Group(); const f = mesh(h.kind === "fruit" ? (this.world.props.includes("palm") ? kit.coconut : kit.mango) : h.kind === "nut" ? (this.world.props.includes("palm") ? kit.coconut : kit.nut) : kit.drop, kit.glossy); f.name = "fruit"; f.scale.setScalar(h.kind === "drip" ? 1 : 1.5); g.add(f); const sh = new THREE.Mesh(kit.disc, kit.ghost); sh.name = "shadow"; g.add(sh); return g; }
      case "lightning": { const g = new THREE.Group(); const sh = new THREE.Mesh(kit.disc, new THREE.MeshBasicMaterial({ color: "#BFE8FF", transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); this.keep.push(sh.material as THREE.Material); sh.name = "shadow"; g.add(sh); const b = new THREE.Mesh(kit.bolt, new THREE.MeshBasicMaterial({ color: "#E8F8FF", toneMapped: false })); this.keep.push(b.material as THREE.Material); b.name = "bolt"; b.visible = false; g.add(b); return g; }
      case "snail": return mesh(kit.snail, kit.glossy);
      case "swing": { const g = new THREE.Group(); const t = mesh(kit.thorn, kit.glossy); t.scale.setScalar(1.15); t.name = "thorn"; g.add(t); return g; }
      case "shadow": case "water": {
        const g = new THREE.Group();
        const n = Math.max(2, Math.round(h.len / 0.5));
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(kit.disc, h.kind === "shadow" ? kit.ghost : kit.water); m.userData.k = i / (n - 1); m.scale.set(0.9, 0.9, 1); g.add(m);
        }
        return g;
      }
    }
    return null;
  }

  private buildProps(q: "low" | "medium" | "high") {
    // We're climbing high in the canopy: the background is tall columns (tree trunks, bamboo, stone, waterfalls) that run
    // past the top and bottom of the screen, foliage clusters along them, hanging lianas, and the world's own accents.
    const w = this.world, k = <X extends D>(x: X) => { this.keep.push(x); return x; };
    let seed = this.st.def.seed >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const y0 = this.yMin - this.off.y - 30, y1 = this.yMax - this.off.y + 40, H = y1 - y0;
    const props = w.props;
    const colKind = props.includes("bamboo") ? "bamboo" : props.includes("pine") ? "pine" : props.includes("ruin") || props.includes("temple") ? "stone" : props.includes("palm") ? "palm" : "trunk";
    const lowQ = q === "low";
    // ---- columns
    const colGeo = k(new THREE.CylinderGeometry(1, 1.08, 1, colKind === "bamboo" ? 10 : 14, 1));
    const bark = new THREE.Color(colKind === "bamboo" ? "#86BE4A" : colKind === "stone" ? "#A8AE98" : w.trunk);
    const colMat = k(new THREE.MeshStandardMaterial({ color: bark, roughness: colKind === "bamboo" ? 0.45 : 0.9 }));
    const cols: { x: number; z: number; r: number }[] = [];
    const lay = [
      { z: [-70, -50], r: [1.6, 2.6], x: 60, n: lowQ ? 6 : 9, avoid: 0 },
      { z: [-38, -24], r: [0.8, 1.4], x: 32, n: lowQ ? 5 : 8, avoid: 7 },
      { z: [-17, -11], r: [0.45, 0.8], x: 18, n: lowQ ? 3 : 5, avoid: 7.5 },
    ];
    const colM: THREE.Matrix4[] = [];
    for (const L of lay) for (let i = 0; i < L.n; i++) {
      let x = (rnd() * 2 - 1) * L.x;
      if (L.avoid && Math.abs(x) < L.avoid) x = Math.sign(x || 1) * (L.avoid + rnd() * 4);
      const z = L.z[0] + rnd() * (L.z[1] - L.z[0]), r = (L.r[0] + rnd() * (L.r[1] - L.r[0])) * (colKind === "bamboo" ? 0.35 : 1);
      cols.push({ x, z, r });
      // columns run far past both ends so no stage boundary ever shows a cut trunk
      colM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, (y0 + y1) / 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rnd() - 0.5) * 0.03), new THREE.Vector3(r, H + 260, r)));
      // bamboo groves come in clumps
      if (colKind === "bamboo") for (let j = 0; j < 3; j++) { const dx = (rnd() - 0.5) * 1.6, dz = (rnd() - 0.5) * 1.6; cols.push({ x: x + dx, z: z + dz, r }); colM.push(new THREE.Matrix4().compose(new THREE.Vector3(x + dx, (y0 + y1) / 2, z + dz), new THREE.Quaternion(), new THREE.Vector3(r * 0.9, H + 260, r * 0.9))); }
    }
    const cm = new THREE.InstancedMesh(colGeo, colMat, colM.length); colM.forEach((m, i) => cm.setMatrixAt(i, m)); cm.computeBoundingSphere(); this.g.add(cm);
    // bamboo nodes / stone bands
    if (colKind === "bamboo" || colKind === "stone") {
      const ringG = k(new THREE.TorusGeometry(1, 0.08, 6, 16)); ringG.rotateX(Math.PI / 2);
      const ringM = k(new THREE.MeshStandardMaterial({ color: colKind === "bamboo" ? "#5E8A2E" : "#8A907A", roughness: 0.7 }));
      const rm: THREE.Matrix4[] = [];
      for (const c of cols) for (let y = y0; y < y1; y += colKind === "bamboo" ? 2.4 : 6) rm.push(new THREE.Matrix4().compose(new THREE.Vector3(c.x, y, c.z), new THREE.Quaternion(), new THREE.Vector3(c.r * 1.05, c.r, c.r * 1.05)));
      const im = new THREE.InstancedMesh(ringG, ringM, rm.length); rm.forEach((m, i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); this.g.add(im);
    }
    // ---- foliage clusters along the columns, plus free-floating leaf clusters near the vine's sides
    const blob = k(new THREE.SphereGeometry(1, lowQ ? 9 : 12, lowQ ? 6 : 8));
    const leafMat = k(new THREE.MeshStandardMaterial({ vertexColors: false, color: "#ffffff", roughness: 0.75 }));
    const bm: THREE.Matrix4[] = [], bc: THREE.Color[] = [];
    const greens = [new THREE.Color(w.leaf[0]), new THREE.Color(w.leaf[1]), new THREE.Color(w.leaf[2])];
    const accent = new THREE.Color(w.accent);
    const cluster = (x: number, y: number, z: number, s: number, flowers: boolean) => {
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, rr = s * (0.4 + rnd() * 0.6);
        bm.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * s * 0.9, y + (rnd() - 0.4) * s * 0.7, z + Math.sin(a) * s * 0.5), new THREE.Quaternion(), new THREE.Vector3(rr, rr * 0.78, rr)));
        bc.push(greens[Math.floor(rnd() * 3)].clone().multiplyScalar(0.9 + rnd() * 0.2));
      }
      if (flowers) for (let i = 0; i < 3; i++) { const a = rnd() * Math.PI * 2; bm.push(new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(a) * s, y + s * 0.3, z + Math.sin(a) * s * 0.4 + s * 0.4), new THREE.Quaternion(), new THREE.Vector3(s * 0.14, s * 0.14, s * 0.14))); bc.push(accent.clone()); }
    };
    const blossom = props.includes("blossom");
    for (const c of cols) {
      if (colKind === "bamboo") { for (let y = y0; y < y1; y += 7 + rnd() * 5) if (rnd() < 0.45) cluster(c.x + (rnd() - 0.5) * 2, y, c.z, 0.9 + c.r * 2, false); continue; }
      const far = c.z < -40;
      for (let y = y0 + rnd() * 6; y < y1; y += far ? 16 + rnd() * 10 : 10 + rnd() * 8) cluster(c.x + (rnd() - 0.5) * c.r * 3, y, c.z + c.r * 0.6, (c.r * 2.4 + 1.2) * (far ? 1.4 : 1), blossom || rnd() < 0.18);
    }
    // near clusters at the screen edges (frame the climb, add depth)
    for (let y = y0; y < y1; y += lowQ ? 12 : 8) { const sd = rnd() < 0.5 ? -1 : 1; cluster(sd * (5.5 + rnd() * 3), y + rnd() * 4, -5 - rnd() * 3, 1.2 + rnd() * 0.8, rnd() < 0.3); }
    // split into 24 m bands so whatever is off screen is culled
    const bands = new Map<number, number[]>();
    bm.forEach((m, i) => { const b = Math.floor((m.elements[13] - y0) / 24); let a = bands.get(b); if (!a) { a = []; bands.set(b, a); } a.push(i); });
    for (const idx of bands.values()) {
      const im = new THREE.InstancedMesh(blob, leafMat, idx.length); idx.forEach((i, j) => { im.setMatrixAt(j, bm[i]); im.setColorAt(j, bc[i]); }); im.computeBoundingSphere(); this.g.add(im);
    }
    // ---- hanging lianas
    if (!lowQ && colKind !== "bamboo") {
      const lg = k(new THREE.CylinderGeometry(0.035, 0.035, 1, 5)); lg.translate(0, -0.5, 0);
      const lm = k(new THREE.MeshStandardMaterial({ color: new THREE.Color(w.vine[1]).lerp(new THREE.Color(w.trunk), 0.4), roughness: 0.8 }));
      const mm: THREE.Matrix4[] = [];
      for (const c of cols) for (let y = y0; y < y1; y += 9 + rnd() * 9) { if (rnd() < 0.5) continue; const L = 4 + rnd() * 10; mm.push(new THREE.Matrix4().compose(new THREE.Vector3(c.x + (rnd() - 0.5) * 3, y, c.z + 0.5), new THREE.Quaternion(), new THREE.Vector3(1 + c.r, L, 1 + c.r))); }
      if (mm.length) { const im = new THREE.InstancedMesh(lg, lm, mm.length); mm.forEach((m, i) => im.setMatrixAt(i, m)); im.computeBoundingSphere(); this.g.add(im); }
    }
    // ---- the world's accents (small props on the clusters / floating in the sky worlds)
    const small = props.filter((p) => !["tree", "giant", "roots", "bamboo", "pine", "ruin", "temple", "palm", "hedge"].includes(p));
    if (small.length) {
      const geos = small.map((pk) => k(M.propGeo(pk, w.leaf, w.trunk, w.accent)));
      const mats: THREE.Matrix4[][] = geos.map(() => []);
      for (let y = y0; y < y1; y += lowQ ? 10 : 6.5) {
        const kind = Math.floor(rnd() * geos.length), pk = small[kind];
        const far = pk === "cloud" || pk === "island" || pk === "waterfall";
        const sd = rnd() < 0.5 ? -1 : 1;
        const x = far ? (rnd() * 2 - 1) * 30 : sd * (6 + rnd() * 6), z = far ? -30 - rnd() * 20 : -7 - rnd() * 8;
        const sc = far ? 5 + rnd() * 6 : 1.4 + rnd() * 1.4;
        mats[kind].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + rnd() * 5, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2), new THREE.Vector3(sc, sc, sc)));
      }
      geos.forEach((g, i) => {
        const byBand = new Map<number, THREE.Matrix4[]>();
        for (const m of mats[i]) { const b = Math.floor((m.elements[13] - y0) / 30); let a = byBand.get(b); if (!a) { a = []; byBand.set(b, a); } a.push(m); }
        for (const ms of byBand.values()) { const im = new THREE.InstancedMesh(g, this.kit.mat, ms.length); ms.forEach((m, j) => im.setMatrixAt(j, m)); im.computeBoundingSphere(); this.g.add(im); }
      });
    }
    // ---- big foreground leaves at the edges (depth), not on low quality
    if (!lowQ) {
      const fgLeaf = k(M.leafGeo(1, 0.45, new THREE.Color(w.leaf[1]).multiplyScalar(0.75).getStyle(), w.leaf[0]));
      const fm: THREE.Matrix4[] = [];
      for (let y = y0; y < y1; y += 7) {
        const sd = rnd() < 0.5 ? -1 : 1;
        fm.push(new THREE.Matrix4().compose(new THREE.Vector3(sd * (4.6 + rnd() * 2.5), y + rnd() * 5, 3 + rnd() * 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4 + rnd() * 0.8, sd > 0 ? -2.2 : 2.2, rnd() - 0.5)), new THREE.Vector3(2.4, 2.4, 2.4)));
      }
      const fmat = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
      const im = new THREE.InstancedMesh(fgLeaf, fmat, fm.length); fm.forEach((m, j) => im.setMatrixAt(j, m)); im.computeBoundingSphere(); this.g.add(im);
    }
  }

  private smashed = new Set<number>();
  /** a hazard Sun Rush smashed: gone for the rest of this stage */
  smash(i: number) {
    this.smashed.add(i);
    const j = this.thornHaz.indexOf(i);
    if (j >= 0 && this.thorns) { this.thorns.setMatrixAt(j, ZERO); this.thorns.instanceMatrix.needsUpdate = true; }
  }
  /** bring smashed thorns back (a restart) */
  unsmash() {
    if (!this.smashed.size) return;
    for (const i of this.smashed) { const j = this.thornHaz.indexOf(i); if (j >= 0 && this.thorns) this.place(this.st.haz[i], this.thorns, j, 0); }
    if (this.thorns) this.thorns.instanceMatrix.needsUpdate = true;
    this.smashed.clear();
  }
  // ------------------------------------------------------------------ per frame
  update(sim: Sim | null, t: number, camPos: THREE.Vector3) {
    const st = this.st, p = st.path;
    const live = sim && sim.st === st ? sim : null;
    const near = (s: number) => { if (!live) return true; return s > live.s - 25 && s < live.s + 45; };
    // bugs: bob and flutter; gone once eaten
    for (const bm of this.bugMeshes) {
      // only the bugs near Tondu are drawn (packed to the front, count set)
      let j = 0;
      bm.idx.forEach((bi) => {
        const b = st.bugs[bi];
        if ((live && live.eaten[bi] === 1) || !near(b.s)) return;
        const side = b.side === 0 ? 1 : b.side;
        const pt = this.sidePoint(b.s, side, 0.32 + Math.sin(t * 3 + bi) * 0.05, b.br);
        pathAt(p, b.s, PT); vB.set(tN[0], tN[1], tN[2]).multiplyScalar(side);
        qA.setFromUnitVectors(UP, vB);
        const spin = new THREE.Quaternion().setFromAxisAngle(vB, t * 1.2 + bi);
        qA.premultiply(spin);
        const sc = b.kind < 0 ? 1.25 : 1.15;
        mA.compose(pt, qA, sA.set(sc, sc, sc)); bm.m.setMatrixAt(j++, mA);
      });
      bm.m.count = j;
      bm.m.instanceMatrix.needsUpdate = true;
    }
    this.picks.forEach((m, i) => { const taken = live ? live.picked[i] : 0; m.visible = !taken; m.rotation.y = t * 2; m.rotation.x = Math.sin(t) * 0.3; });
    // thorns shake a little when close (they're alive!)
    // animated hazards
    for (const a of this.anim) {
      const h = a.h;
      if (!near(h.s) || this.smashed.has(a.i)) { a.o.visible = false; continue; }
      a.o.visible = true;
      const armT = live ? live.arm[a.i] : -1, now = live ? live.t : t;
      const side = h.side === 0 ? 1 : h.side;
      pathAt(p, h.s, PT);
      vA.set(tT[0], tT[1], tT[2]).normalize(); vB.set(tN[0], tN[1], tN[2]).normalize(); vC.crossVectors(vA, vB).normalize();
      const lethal = live ? live.lethal(h, a.i, now, 1) || live.lethal(h, a.i, now, -1) : false;
      switch (h.kind) {
        case "burr": case "snail": {
          const sNow = armT >= 0 && live ? h.s + (h.v ?? 0) * (now - armT) : h.s;
          a.o.position.copy(this.sidePoint(sNow, side, h.kind === "burr" ? 0.12 : 0.02, h.br));
          pathAt(p, sNow, PT); vB.set(tN[0], tN[1], tN[2]).multiplyScalar(side);
          a.o.quaternion.setFromUnitVectors(UP, vB);
          if (h.kind === "burr") a.o.rotateOnAxis(new THREE.Vector3(1, 0, 0), sNow * 5);
          else { vA.set(tT[0], tT[1], tT[2]); a.o.lookAt(a.o.position.clone().add(vA)); a.o.rotateOnAxis(new THREE.Vector3(0, 0, 1), side > 0 ? -Math.PI / 2 : Math.PI / 2); }
          break;
        }
        case "crawler": {
          const sNow = armT >= 0 && live && h.v !== undefined ? h.s + h.v * (now - armT) : h.s;
          const periodic = h.period !== undefined;
          a.o.children.forEach((c) => {
            const k = c.userData.k as number;
            if (periodic) {
              // a caterpillar crossing the vine (both sides) while "on"
              const ph = live ? ((((now + (h.phase ?? 0)) % h.period!) + h.period!) % h.period!) / h.period! : 0.5;
              const on = h.on ?? 0.5, cross = ph < on ? ph / on : -1;
              const off = cross < 0 ? 2 : (cross * 2 - 1) * 1.4 - k * 0.9;
              c.position.copy(this.sidePoint(h.s, 1, 0)).addScaledVector(vB, -VR).addScaledVector(vB, off).addScaledVector(vC, 0.1);
              c.visible = cross >= 0;
            } else {
              c.position.copy(this.sidePoint(sNow + k * h.len, side, 0.05, h.br));
              c.visible = true;
            }
          });
          break;
        }
        case "bud": {
          const open = lethal ? 1 : 0.15;
          a.o.children.forEach((b) => {
            const sd = b.userData.side as number;
            b.position.copy(this.sidePoint(h.s, sd, 0.02));
            vD.copy(vB).multiplyScalar(sd); b.quaternion.setFromUnitVectors(UP, vD);
            const sp = b.getObjectByName("spikes")!; const cur = sp.scale.x; const nx = cur + (open - cur) * 0.25; sp.scale.setScalar(Math.max(0.05, nx));
          });
          break;
        }
        case "ants": {
          const L = h.len;
          a.o.children.forEach((c) => {
            const k = (((c.userData.k as number) + now * 0.35) % 1);
            c.position.copy(this.sidePoint(h.s - L / 2 + k * L, side, 0.01, h.br));
            pathAt(p, h.s - L / 2 + k * L, PT); vD.set(tN[0], tN[1], tN[2]).multiplyScalar(side);
            c.quaternion.setFromUnitVectors(UP, vD);
            c.scale.setScalar(lethal ? 1.3 : 0.35);
          });
          break;
        }
        case "bees": {
          const ph = live && h.period ? ((((now + (h.phase ?? 0)) % h.period) + h.period) % h.period) / h.period : 0;
          const on = h.on ?? 0.4;
          a.o.children.forEach((b) => {
            const kk = b.userData.k as number;
            const x = ph < on ? (ph / on) * 2.6 - 1.3 : 1.6 + Math.sin(now * 3 + kk) * 0.2;
            b.position.copy(this.sidePoint(h.s, 1, 0)).addScaledVector(vB, -VR).addScaledVector(vB, x + kk * 0.25).addScaledVector(vC, 0.25 + Math.sin(now * 9 + kk) * 0.08).addScaledVector(vA, (kk - 1) * 0.3);
            b.lookAt(b.position.clone().addScaledVector(vB, -1));
          });
          break;
        }
        case "spider": {
          const ph = live && h.period ? ((((now + (h.phase ?? 0)) % h.period) + h.period) % h.period) / h.period : 0;
          const on = h.on ?? 0.4;
          const drop = ph < on ? 0 : Math.min(1.8, (ph - on) * 6);
          const sp = a.o.children[0], th = a.o.getObjectByName("thread")!;
          const top = this.sidePoint(h.s, 1, 0).addScaledVector(vB, -VR).addScaledVector(vC, 0.3);
          sp.position.copy(top).addScaledVector(UP, 0.2 + drop * 1.4);
          sp.lookAt(camPos);
          th.position.copy(sp.position).addScaledVector(UP, 1.6); th.scale.set(0.02, 3.2, 1); th.lookAt(th.position.clone().add(new THREE.Vector3(0, 0, 1)));
          break;
        }
        case "tongue": {
          const lash = lethal ? 1 : 0;
          const t2 = a.o.getObjectByName("tongue")!;
          t2.position.copy(this.sidePoint(h.s, 1, 0)).addScaledVector(vB, -VR).addScaledVector(vC, 0.2);
          t2.scale.set(lash ? 1.5 : 0.01, 0.06, 0.06); t2.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), vB);
          break;
        }
        case "swing": {
          // a thorn on a stalk swinging round the front of the vine from one side to the other
          const ph = live && h.period ? ((((now + (h.phase ?? 0)) % h.period) + h.period) % h.period) / h.period : 0;
          const ang = (ph < 0.5 ? 0 : Math.PI) + (Math.abs(((ph * 2) % 1) - 0.5) < 0.12 ? 0 : 0);
          const smooth = Math.cos(ph * Math.PI * 2) * 0.5 + 0.5; // 1 at side, 0 at the other
          const a2 = (h.side === 1 ? 0 : Math.PI) + (1 - smooth) * Math.PI * (ph < 0.5 ? 1 : 1) * 0 + (ph < 0.5 ? 0 : Math.PI) * 0 + ang * 0;
          const realA = (h.side === 1 ? 0 : Math.PI) + Math.PI * (1 - smooth);
          vD.copy(vB).multiplyScalar(Math.cos(realA)).addScaledVector(vC, Math.sin(realA) * 0.9).normalize();
          a.o.position.set(tP[0], tP[1], tP[2]).addScaledVector(vD, VR);
          a.o.quaternion.setFromUnitVectors(UP, vD);
          void a2;
          break;
        }
        case "fruit": case "nut": case "drip": case "lightning": case "dive": case "pod": {
          const fr = a.o.getObjectByName("fruit"), sh = a.o.getObjectByName("shadow"), bolt = a.o.getObjectByName("bolt"), burst = a.o.getObjectByName("burst");
          const land = this.sidePoint(h.s, side, 0.15, h.br);
          const k = armT >= 0 && live ? (now - armT) / (h.delay ?? 1) : -1;
          if (sh) { sh.position.copy(this.sidePoint(h.s, side, 0.03, h.br)); vD.copy(vB).multiplyScalar(side); sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vD); const sc = k < 0 ? 0.2 : Math.min(1.2, 0.3 + k); sh.scale.set(sc, sc, 1); sh.visible = k < 1 + (h.dur ?? 1) / (h.delay ?? 1); }
          if (fr) {
            if (k < 0) fr.position.copy(land).addScaledVector(UP, 4).addScaledVector(vC, 0.4);
            else if (k < 1) fr.position.copy(land).addScaledVector(UP, 4 * (1 - k * k)).addScaledVector(vC, 0.4 * (1 - k));
            else { const after = (now - armT - (h.delay ?? 1)) / Math.max(0.2, h.dur ?? 1); fr.position.copy(land).addScaledVector(UP, after > 1 ? -(after - 1) * 6 : 0); }
            fr.rotation.y = now;
          }
          if (bolt) { bolt.visible = k >= 1 && k < 1.25; bolt.position.copy(land); }
          if (h.kind === "pod") {
            const pod = a.o.children[0]; pod.position.copy(this.sidePoint(h.s, side, 0, h.br)); vD.copy(vB).multiplyScalar(side); pod.quaternion.setFromUnitVectors(UP, vD);
            if (burst) { burst.position.copy(pod.position); burst.quaternion.copy(pod.quaternion); const bs = k >= 1 ? Math.min(1.1, (k - 1) * 4 + 0.2) : 0.001; burst.scale.setScalar(bs); pod.visible = k < 1; }
          }
          break;
        }
        case "shadow": case "water": {
          a.o.children.forEach((c) => {
            const s = h.s - h.len / 2 + (c.userData.k as number) * h.len;
            c.position.copy(this.sidePoint(s, side, 0.04, h.br));
            pathAt(p, s, PT); vD.set(tN[0], tN[1], tN[2]).multiplyScalar(side);
            c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vD);
            const pul = h.kind === "water" ? 0.8 + Math.sin(now * 8 + s * 3) * 0.15 : 0.9;
            c.scale.set(pul, pul, 1);
          });
          break;
        }
      }
    }
    // leap marks pulse; ropes glow green when you may let go
    for (const mk of this.marks) { const m = mk.m.material as THREE.MeshBasicMaterial; m.opacity = 0.35 + Math.sin(t * 8) * 0.2; }
    for (const rp of this.ropes) {
      const gp = st.gaps[rp.gap];
      const green = live ? live.ropeGreen(gp) : true;
      (rp.m.material as THREE.MeshBasicMaterial).color.set(green ? "#7CFF6A" : "#FF7A5A");
      rp.m.rotation.z = Math.sin(((live ? live.t : t) + (gp.phase ?? 0)) / (gp.period ?? 1.6) * Math.PI * 2) * 0.35;
    }
    // the gate blooms as Tondu arrives
    if (live) {
      const toGate = p.len - live.s;
      this.gateBloom += ((toGate < 8 ? 1 : 0.6) - this.gateBloom) * 0.08;
    }
    this.gate.scale.setScalar(this.gateBloom || 0.6);
    this.gate.rotation.z += 0.004;
    if (this.moss) this.moss.rotation.z = Math.sin(t) * 0.2;
  }

  dispose() {
    for (const k of this.keep) k.dispose();
    this.g.removeFromParent();
  }
}
