// Places instanced scenery around the track: props (with clustering, rows, far landmarks, water and air
// placements, overlap rejection), grass & flower clumps near the road, god-ray shafts and spinning parts.
import * as THREE from "three";
import type { GfxQuality } from "../types";
import type { Track } from "../track";
import type { ThemeLook } from "./themes";
import type { Ground } from "./terrain";
import { vnoise } from "./terrain";
import type { Near } from "./field";
import { PROP_BUILDERS, FAR_PROPS, P, merge, propMat, type PropBuild } from "./props";
import { cornerRanges } from "./roadside";
import * as TX from "./textures";

export interface Spinner { mesh: THREE.InstancedMesh; base: THREE.Matrix4[]; pivot: THREE.Matrix4; axis: THREE.Vector3; speed: number; phase: Float32Array }

const UP = new THREE.Vector3(0, 1, 0);

export function scatterProps(track: Track, l: ThemeLook, G: Ground, q: GfxQuality, night: boolean, rnd: () => number, avoid: [number, number][]) {
  const root = new THREE.Group();
  const spinners: Spinner[] = [];
  const hw = track.halfWidth, sh = track.shoulder, edge = hw + sh;
  const qMul = q === "low" ? 0.32 : q === "medium" ? 0.58 : 1;
  const lenK = track.length / 1800;
  const NQ: Near = { i: 0, dist: 0, d: 0, y: 0 };
  const occ = new Set<number>();
  const OC = 7;
  const occKey = (x: number, z: number) => (Math.floor(x / OC) + 4096) * 8192 + (Math.floor(z / OC) + 4096);
  const free = (x: number, z: number, r: number) => { for (let a = x - r; a <= x + r + OC * 0.5; a += OC) for (let b = z - r; b <= z + r + OC * 0.5; b += OC) if (occ.has(occKey(a, b))) return false; return true; };
  const mark = (x: number, z: number, r: number) => { for (let a = x - r; a <= x + r + OC * 0.5; a += OC) for (let b = z - r; b <= z + r + OC * 0.5; b += OC) occ.add(occKey(a, b)); };
  const corners = cornerRanges(track, 120, 0);
  const inTunnel = (s: number) => avoid.some(([a, b]) => s > a - 10 && s < b + 10);
  const tmp = new THREE.Color();
  const ctx = { night, look: l, q };
  // blob shadows (x, y, z, radius) under grounded props where real shadow maps are not used
  const blobs: number[] = [];
  const wantBlobs = q !== "high" && !l.floating;
  // big props first so small ones fill the gaps
  const specs = [...l.props].map((pr) => ({ pr, def: PROP_BUILDERS[pr.kind] ? PROP_BUILDERS[pr.kind](ctx) : null }))
    .filter((x): x is { pr: typeof l.props[number]; def: PropBuild } => !!x.def)
    .sort((a, b) => (b.def.radius ?? 0) - (a.def.radius ?? 0));

  for (const { pr, def } of specs) {
    const place = def.place ?? "scatter";
    if (place === "water" && G.waterY === null) { def.geometry.dispose(); def.material.dispose(); continue; }
    const far = FAR_PROPS.has(pr.kind) || place === "far";
    const qk = far ? (q === "low" ? 0.6 : q === "medium" ? 0.8 : 1) : qMul;
    let count = Math.max(place === "far" ? 2 : 1, Math.round(def.base * pr.density * qk * lenK));
    if (place === "rows" && q === "low") count = Math.round(count * 0.6);
    const tints = pr.tint ?? def.tint;
    const mats: THREE.Matrix4[] = [];
    const cols: number[] = [];
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const accept = (s: number, side: number, dist: number, yOverride?: number) => {
      track.point(s, side * dist, p);
      const n = G.field.query(p.x, p.z, NQ);
      const k = def.scale[0] + rnd() * (def.scale[1] - def.scale[0]);
      const r = (def.radius ?? 0) * k;
      if (n.dist < edge + Math.max(def.minGap * 0.5, r) - 0.5 && place !== "far") return false;
      if (place === "far" && n.dist < def.minGap * 0.6) return false;
      if (inTunnel(n.i * track.step) && n.dist < edge + 12) return false;
      const y = G.heightAt(p.x, p.z);
      if (place === "water") { if (G.waterY === null || y > G.waterY - 1.2) return false; p.y = G.waterY; }
      else if (place === "air") p.y = (yOverride ?? n.y) + def.air![0] + rnd() * (def.air![1] - def.air![0]);
      else {
        if (G.waterY !== null && y < G.waterY + 0.25) return false;
        if (place === "flat") { const y2 = G.heightAt(p.x + 3, p.z), y3 = G.heightAt(p.x, p.z + 3); if (Math.abs(y2 - y) > 0.9 || Math.abs(y3 - y) > 0.9) return false; }
        p.y = y - (def.sink ?? 0.05) * k;
      }
      if (def.cluster && place !== "rows") { const cn = vnoise(p.x * 0.011, p.z * 0.011, track.seed % 997); if (rnd() > Math.pow(cn * 1.25, 1 + def.cluster * 3)) return false; }
      if (r > 0) { if (!free(p.x, p.z, r)) return false; mark(p.x, p.z, r); }
      let face: number;
      if (place === "corner") face = track.heading(s) + Math.PI;
      else if (def.faceTrack) face = track.heading(s) + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 0.12;
      else face = rnd() * Math.PI * 2;
      qq.setFromAxisAngle(UP, face);
      const sx = def.stretchX ? 0.7 + rnd() * 0.8 : 1, sy = def.stretchY ? 0.7 + rnd() * 0.9 : 1;
      sc.set(k * sx, k * sy, k * (def.stretchX ? 0.7 + rnd() * 0.8 : 1));
      if (place === "corner" && side < 0) sc.x *= -1; // mirror chevrons for left-handers
      mats.push(m4.compose(p, qq, sc).clone());
      if (wantBlobs && def.shadow !== false && (place === "scatter" || place === "roadside") && (def.radius ?? 1.4) * k < 9) blobs.push(p.x, p.y + (def.sink ?? 0.05) * k, p.z, Math.max(1.2, (def.radius ?? 1.4) * k * 1.25));
      if (tints) { tmp.set(tints[Math.floor(rnd() * tints.length)]); cols.push(tmp.r, tmp.g, tmp.b); }
      return true;
    };
    if (place === "rows") {
      // crop rows in field stretches on both sides
      // dense field patches spread around the lap, rows running alongside the road
      const gap = def.rowGap ?? 2, along = pr.kind === "wheat" ? 6.3 : 2.4, rows = q === "low" ? 4 : q === "medium" ? 6 : 9;
      const K = Math.max(3, Math.round(track.length / 420));
      const per = Math.max(2, Math.round(count / (2 * rows * K)));
      for (let k = 0; k < K; k++) {
        const s0 = ((k + 0.2 + rnd() * 0.6) * track.length) / K;
        for (const side of [-1, 1]) {
          if (rnd() < 0.25) continue;
          for (let r = 0; r < rows; r++) for (let j = 0; j < per; j++) accept(s0 + j * along + (r % 2) * along * 0.5, side, edge + def.minGap + 3 + r * gap + (rnd() - 0.5) * 0.3);
        }
      }
    } else if (place === "corner") {
      for (const [a, b] of corners) {
        const mid = (a + b) / 2, k = track.kappa(mid), side = k > 0 ? -1 : 1;
        const n = pr.kind === "chevron" ? Math.min(5, Math.max(2, Math.round((b - a) / 14))) : 1;
        for (let i = 0; i < n && mats.length < count * 2; i++) accept(a + ((b - a) * (i + 0.5)) / n, side, edge + def.minGap + (pr.kind === "tyres" ? 1.2 : 0));
      }
    } else {
      for (let tries = 0; mats.length < count && tries < count * 10; tries++) {
        const s = rnd() * track.length, side = rnd() < 0.5 ? -1 : 1;
        let dist: number;
        if (place === "far") dist = def.minGap + Math.pow(rnd(), def.spread) * def.range;
        else if (place === "roadside") dist = edge + def.minGap + rnd() * def.range;
        else dist = edge + def.minGap + Math.pow(rnd(), def.spread) * def.range;
        accept(s, side, dist);
      }
    }
    if (!mats.length) { def.geometry.dispose(); def.material.dispose(); continue; }
    const inst = new THREE.InstancedMesh(def.geometry, def.material, mats.length);
    inst.name = pr.kind;
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    if (tints) { for (let i = 0; i < mats.length; i++) inst.setColorAt(i, tmp.setRGB(cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2])); }
    if (def.cells) {
      const cell = new Float32Array(mats.length);
      for (let i = 0; i < mats.length; i++) cell[i] = Math.floor(rnd() * def.cells);
      def.geometry.setAttribute("iCell", new THREE.InstancedBufferAttribute(cell, 1));
    }
    inst.castShadow = def.shadow !== false && q === "high";
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    root.add(inst);
    if (def.spin) {
      const sm = new THREE.InstancedMesh(def.spin.geometry, def.material, mats.length);
      sm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const axis = def.spin.axis === "x" ? new THREE.Vector3(1, 0, 0) : def.spin.axis === "y" ? UP.clone() : new THREE.Vector3(0, 0, 1);
      const phase = new Float32Array(mats.length).map(() => rnd() * Math.PI * 2);
      const pivot = new THREE.Matrix4().makeTranslation(...def.spin.pivot);
      if (tints) for (let i = 0; i < mats.length; i++) sm.setColorAt(i, tmp.setRGB(1, 1, 1));
      sm.frustumCulled = false;
      root.add(sm);
      spinners.push({ mesh: sm, base: mats, pivot, axis, speed: def.spin.speed, phase });
    }
  }
  if (blobs.length) {
    const n = blobs.length / 4;
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: TX.blobShadow(), color: 0x000000, transparent: true, opacity: night ? 0.28 : 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const inst = new THREE.InstancedMesh(geo, mat, n);
    const m4 = new THREE.Matrix4(), sun = new THREE.Vector3(...l.sun.dir).normalize();
    for (let i = 0; i < n; i++) {
      const r = blobs[i * 4 + 3];
      m4.makeScale(r, 1, r).setPosition(blobs[i * 4] - sun.x * r * 0.35, blobs[i * 4 + 1] + 0.12, blobs[i * 4 + 2] - sun.z * r * 0.35);
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.renderOrder = 1; inst.name = "blobshadows";
    root.add(inst);
  }
  return { root, spinners };
}

const _r = new THREE.Matrix4(), _m = new THREE.Matrix4();
export function updateSpinners(sp: Spinner[], t: number) {
  for (const s of sp) {
    for (let i = 0; i < s.base.length; i++) {
      _r.makeRotationAxis(s.axis, t * s.speed + s.phase[i]);
      _m.multiplyMatrices(s.base[i], s.pivot).multiply(_r);
      s.mesh.setMatrixAt(i, _m);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- grass & flowers
export function scatterGrass(track: Track, l: ThemeLook, G: Ground, q: GfxQuality, rnd: () => number, avoid: [number, number][]) {
  const gs = l.grass;
  if (!gs || q === "low" || l.floating) return null;
  const root = new THREE.Group();
  const edge = track.halfWidth + track.shoulder;
  const lenK = track.length / 1800;
  const H = gs.height ?? 0.75;
  // one clump: 7 blades fanning out, dark at the root, light at the tip
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + i, r = 0.12 + (i % 3) * 0.1, h = H * (0.65 + (i % 4) * 0.15);
    const g = new THREE.BufferGeometry();
    const lean = 0.25 + (i % 2) * 0.15;
    const pos = [-0.06, 0, 0, 0.06, 0, 0, lean * 0.5, h, 0.02];
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.6, 0.8], 3));
    g.rotateY(a); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    const pg = P(g, "#ffffff", 1);
    const c = pg.attributes.color as THREE.BufferAttribute; c.setXYZ(0, 0.45, 0.45, 0.45); c.setXYZ(1, 0.45, 0.45, 0.45); c.setXYZ(2, 1.1, 1.1, 1.0);
    blades.push(pg);
  }
  const clump = merge(blades);
  const n = Math.round((q === "medium" ? 1700 : 4600) * gs.density * lenK);
  const mat = propMat({ sway: 70, side: THREE.DoubleSide });
  const make = (geo: THREE.BufferGeometry, count: number, tints: string[], range: [number, number], scale: [number, number], material: THREE.Material) => {
    const inst = new THREE.InstancedMesh(geo, material, count);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const NQ: Near = { i: 0, dist: 0, d: 0, y: 0 };
    let k = 0;
    for (let tries = 0; k < count && tries < count * 4; tries++) {
      const s = rnd() * track.length, side = rnd() < 0.5 ? -1 : 1;
      if (avoid.some(([a, b]) => s > a && s < b)) continue;
      const dist = edge + range[0] + Math.pow(rnd(), 1.7) * (range[1] - range[0]);
      track.point(s, side * dist, p);
      const nq = G.field.query(p.x, p.z, NQ);
      if (nq.dist < edge + range[0] - 0.3) continue;
      const y = G.heightAt(p.x, p.z);
      if (G.waterY !== null && y < G.waterY + 0.15) continue;
      if (vnoise(p.x * 0.05, p.z * 0.05, 77) < 0.3) continue; // patchy
      p.y = y - 0.04;
      qq.setFromAxisAngle(UP, rnd() * Math.PI * 2);
      const kk = scale[0] + rnd() * (scale[1] - scale[0]);
      sc.set(kk, kk * (0.8 + rnd() * 0.5), kk);
      inst.setMatrixAt(k, m4.compose(p, qq, sc));
      inst.setColorAt(k, col.set(tints[Math.floor(rnd() * tints.length)]).multiplyScalar(0.9 + rnd() * 0.2));
      k++;
    }
    inst.count = k;
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    return inst;
  };
  root.add(make(clump, n, gs.colors, [1.6, 34], [0.8, 1.5], mat)).children.at(-1)!.name = "grass";
  if (gs.flowers?.length) {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 2.4, r = 0.15 + (i % 3) * 0.12, h = 0.35 + (i % 3) * 0.12, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const stem = new THREE.BufferGeometry();
      stem.setAttribute("position", new THREE.Float32BufferAttribute([x - 0.015, 0, z, x + 0.015, 0, z, x, h, z], 3));
      stem.setAttribute("normal", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      parts.push(P(stem, "#4E7A2E"));
      parts.push(P(new THREE.OctahedronGeometry(0.08, 0).scale(1, 0.6, 1).translate(x, h, z), "#ffffff", 1, gs.glow ? 1.3 : 0));
    }
    const fm = propMat({ sway: 40 });
    root.add(make(merge(parts), Math.round(n * 0.28), gs.flowers, [1.6, 24], [0.9, 1.4], fm));
  }
  return root;
}

// ---------------------------------------------------------------- god rays
export function buildShafts(track: Track, l: ThemeLook, G: Ground, q: GfxQuality, rnd: () => number) {
  if (!l.shafts || q === "low") return null;
  const n = Math.round((q === "medium" ? 14 : 26) * (track.length / 1800));
  const g = new THREE.PlaneGeometry(7, 60).translate(0, 30, 0);
  const cross = new THREE.PlaneGeometry(7, 60).rotateY(Math.PI / 2).translate(0, 30, 0);
  const geo = merge([P(g, "#ffffff"), P(cross, "#ffffff")]);
  const mat = new THREE.MeshBasicMaterial({ map: TX.shaftTex(), color: new THREE.Color(l.shafts).multiplyScalar(l.underwater ? 0.35 : 0.22), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  const sun = new THREE.Vector3(...l.sun.dir).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(UP, sun);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), qy = new THREE.Quaternion();
  const edge = track.halfWidth + track.shoulder;
  for (let i = 0; i < n; i++) {
    const s = rnd() * track.length, side = rnd() < 0.5 ? -1 : 1;
    track.point(s, side * (edge + 12 + rnd() * 70), p);
    p.y = G.heightAt(p.x, p.z) - 2;
    qy.setFromAxisAngle(UP, rnd() * Math.PI).premultiply(tilt);
    const k = 0.7 + rnd() * 0.9; sc.set(k, 0.8 + rnd() * 0.5, k);
    inst.setMatrixAt(i, m4.compose(p, qy, sc));
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  inst.renderOrder = 2;
  return inst;
}
