// The land and water meshes of a Wake Racers course, built from the course's height field piece by piece as you race
// (courses run for tens of kilometres): a fine grid near the lane, a coarse ring beyond it out to the horizon, the far ocean,
// quay walls along built-up lanes, a cave roof in the caverns and the waterfall curtains. Land is coloured per vertex
// by the world's palette from height and slope: beaches and grass, striped canyon walls, snow on the peaks, black
// rock with glowing lava veins, crystal glints, neon lines along the quays. Water vertices carry the depth below them
// (for the shader's shallows and shore foam) and a foam amount over rapids and below falls.
import * as THREE from "three";
import type { Quality } from "@/lib/perf";
import { CORRIDOR, DS, POST, PRE, halfWidthAt, lowerBound, place, waterAt, type Course, type Land, type LandQuery } from "../course";
import { clamp, fbm, lerp, rgb, smoothstep, srgbToLinear, vnoise } from "../util";
import type { World } from "../worlds";
import { worldMaterial } from "./kit";
import { fallMaterial, waterMaterial } from "./water";

type RGBA = [number, number, number, number];
const lin = (hex: string): [number, number, number] => { const [r, g, b] = rgb(hex); return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)]; };
const mixc = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** the world's land colour at a point: rel = height above the local water, slope ~ rise per metre */
function painter(w: World, seed: number) {
  const L = w.land;
  const bed = lin(L.bed), shore = lin(L.shore), low = lin(L.low), mid = lin(L.mid), high = lin(L.high), top = lin(L.top);
  const strata = (L.strata ?? []).map(lin), glow = L.glow ? lin(L.glow) : null;
  const H = w.height;
  return (rel: number, slope: number, e: number, x: number, z: number, out: RGBA) => {
    const n = vnoise(x * 0.08, z * 0.08, seed), n2 = vnoise(x * 0.015, z * 0.015, seed + 3);
    let c: [number, number, number];
    let g = 0;
    if (rel < -0.6) c = bed;
    else if (rel < 0.9 && w.profile !== "quay" && w.profile !== "canal" && w.profile !== "neon") c = mixc(shore, bed, smoothstep(0.2, -0.6, rel));
    else {
      switch (w.profile) {
        case "cliffs": {
          const band = Math.floor((rel + n * 2.5 + n2 * 4) / 2.6);
          const sc = strata[((band % strata.length) + strata.length) % strata.length];
          const flat = slope < 0.35;
          c = flat ? mixc(top, low, n * 0.5) : sc;
          if (flat && n > 0.62) c = mixc(c, lin("#7A8B4A"), 0.6);
          break;
        }
        case "mountains": case "hills": {
          const t = rel / H;
          c = mixc(low, mid, smoothstep(0.08, 0.35, t + (n - 0.5) * 0.15));
          if (slope > 0.75) c = mixc(c, high, smoothstep(0.75, 1.3, slope));
          const snow = smoothstep(w.profile === "mountains" ? 0.5 : 0.78, w.profile === "mountains" ? 0.62 : 0.9, t + (n - 0.5) * 0.12) * (slope < 1.4 ? 1 : 0.4);
          c = mixc(c, top, snow);
          break;
        }
        case "lava": {
          c = mixc(low, mid, n);
          if (slope > 0.8) c = mixc(c, high, 0.5);
          // lava veins in the hollows
          const vein = Math.abs(fbm(x * 0.03, z * 0.03, 2, seed + 9) - 0.5);
          if (glow && vein < 0.013 && rel > 0.8 && slope < 1.1) { c = mixc(glow, lin("#FFC233"), smoothstep(0.013, 0, vein)); g = 0.9; }
          break;
        }
        case "cave": {
          c = mixc(low, mid, n);
          if (slope > 0.9) c = mixc(c, high, 0.6);
          if (glow && n > 0.86 && rel > 1.5) { c = mixc(c, glow, 0.8); g = 0.8; }
          break;
        }
        case "dunes": {
          c = mixc(low, mid, smoothstep(0.3, 0.7, n2));
          if (slope > 0.55) c = mixc(c, high, smoothstep(0.55, 1, slope));
          c = mixc(c, top, smoothstep(0.62, 0.8, n) * 0.4);
          break;
        }
        case "coast": {
          c = mixc(low, mid, smoothstep(0.3, 0.9, slope));
          if (slope > 1) c = mixc(c, high, n);
          break;
        }
        case "banks": {
          c = mixc(low, mid, smoothstep(0.3, 0.7, n2));
          c = mixc(c, high, smoothstep(0.4, 0.8, rel / H));
          if (slope > 0.9) c = mixc(c, lin(L.shore), 0.6);
          break;
        }
        case "beach": {
          c = rel < 1.6 ? shore : mixc(low, mid, n);
          if (slope > 0.8) c = mixc(c, high, 0.6);
          break;
        }
        case "quay": case "canal": case "neon": {
          // paving: big slabs, a little wear
          const slab = (Math.floor(x / 3.2) + Math.floor(z / 3.2)) & 1;
          c = mixc(low, mid, slab ? 0.25 + n * 0.3 : n * 0.3);
          if (w.profile === "neon" && glow) {
            const gx = Math.abs(((x % 16) + 16) % 16 - 8), gz = Math.abs(((z % 16) + 16) % 16 - 8);
            if (Math.min(gx, gz) < 0.25 && e > 3) { c = glow; g = 0.85; }
          }
          break;
        }
        default: c = low;
      }
    }
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; out[3] = g;
    return out;
  };
}

/** the materials one course's land shares across all its pieces */
export interface LandMats { terrain: THREE.Material; water: THREE.ShaderMaterial; falls: THREE.ShaderMaterial }
export function landMaterials(q: Quality): LandMats { return { terrain: worldMaterial(), water: waterMaterial(q), falls: fallMaterial() }; }

/** a built piece of land: meshes to add, geometry to free */
export interface LandPiece { group: THREE.Group; geos: THREE.BufferGeometry[] }

/** the length of one streamed piece of course (m) */
export const SEG = 400;
export const segOf = (s: number) => Math.floor((s + PRE) / SEG);
export const segCount = (c: Course) => Math.ceil((c.length + POST + PRE) / SEG);

/**
 * Builds the land of piece k (the stretch of course [k·SEG − PRE, (k+1)·SEG − PRE)) a little at a time: a generator
 * that yields every few hundred land samples, so the game can spread the work over frames while you race. Pieces own
 * the land by slabs of z (the course only moves forward in z), so neighbours meet exactly, with no gaps or overlaps.
 */
export function* landPiece(c: Course, land: Land, q: Quality, k: number, mats: LandMats, out: LandPiece): Generator<void, void, void> {
  const w = c.world;
  const paint = painter(w, c.seed % 991);
  const CELL = q === "low" ? 7 : q === "medium" ? 6 : 5;
  const n = segCount(c);
  const s0 = k * SEG - PRE, s1 = s0 + SEG;
  const iOf = (s: number) => clamp(Math.round((s + PRE) / DS), 0, c.count - 1);
  const z0 = k === 0 ? -1e9 : c.pz[iOf(s0)], z1 = k >= n - 1 ? 1e9 : c.pz[iOf(s1)];
  // the area: samples that can be nearest to this slab's land, widened by the corridor
  let xa = 1e9, xb = -1e9, za = 1e9, zb = -1e9;
  for (let i = iOf(s0 - 900); i <= iOf(s1 + 900); i++) { xa = Math.min(xa, c.px[i]); xb = Math.max(xb, c.px[i]); za = Math.min(za, c.pz[i]); zb = Math.max(zb, c.pz[i]); }
  const qy: LandQuery = { i: 0, d: 0, e: 0, dist: 0, wl: 0, s: 0 };
  const col: RGBA = [0, 0, 0, 0];
  const foamAt = (s: number) => {
    let f = 0;
    for (const z of c.rapids) if (s > z.s0 - 6 && s < z.s1 + 6) f = Math.max(f, z.k * 0.9);
    for (const fl of c.falls) if (s > fl.s - 2 && s < fl.s + 40) f = Math.max(f, 1 - (s - fl.s) / 40);
    return f;
  };
  let work = 0;

  // ---- fine land and water near the lane
  {
    const pad = CORRIDOR + 20;
    const gx0 = Math.floor((xa - pad) / CELL), gx1 = Math.ceil((xb + pad) / CELL);
    const gz0 = Math.floor((Math.max(z0, za - pad)) / CELL) - 1, gz1 = Math.ceil((Math.min(z1, zb + pad)) / CELL) + 1;
    const NX = gx1 - gx0 + 2, NZ = gz1 - gz0 + 2;
    const H = new Float32Array(NX * NZ).fill(NaN), W = new Float32Array(NX * NZ), E = new Float32Array(NX * NZ), F = new Float32Array(NX * NZ);
    const done = new Uint8Array(NX * NZ);
    const tp: number[] = [], tc: number[] = [], ti: number[] = [], wp: number[] = [], wd: number[] = [], wf: number[] = [], wi: number[] = [];
    const lt = new Int32Array(NX * NZ).fill(-1), lw = new Int32Array(NX * NZ).fill(-1);
    const sample = (ix: number, iz: number) => {
      const k2 = iz * NX + ix;
      if (done[k2]) return k2;
      done[k2] = 1;
      const x = (gx0 + ix) * CELL, z = (gz0 + iz) * CELL;
      land.query(x, z, qy);
      if (qy.e <= CORRIDOR + 15) { H[k2] = land.heightQ(qy, x, z); W[k2] = qy.wl; E[k2] = qy.e; F[k2] = qy.e < 2 ? foamAt(qy.s) : 0; }
      work++;
      return k2;
    };
    const vT = (ix: number, iz: number) => {
      const k2 = iz * NX + ix;
      if (lt[k2] >= 0) return lt[k2];
      const x = (gx0 + ix) * CELL, z = (gz0 + iz) * CELL, h = H[k2];
      const hx = ix + 1 < NX ? H[sample(ix + 1, iz)] : h, hz = iz + 1 < NZ ? H[sample(ix, iz + 1)] : h;
      const slope = Math.hypot((isNaN(hx) ? h : hx) - h, (isNaN(hz) ? h : hz) - h) / CELL;
      paint(h - W[k2], slope, E[k2], x, z, col);
      lt[k2] = tp.length / 3;
      tp.push(x, h, z); tc.push(col[0], col[1], col[2], col[3]);
      return lt[k2];
    };
    const vW = (ix: number, iz: number) => {
      const k2 = iz * NX + ix;
      if (lw[k2] >= 0) return lw[k2];
      lw[k2] = wp.length / 3;
      wp.push((gx0 + ix) * CELL, W[k2], (gz0 + iz) * CELL); wd.push(Math.max(0, W[k2] - H[k2])); wf.push(F[k2]);
      return lw[k2];
    };
    for (let iz = 0; iz < NZ - 2; iz++) {
      const cz = (gz0 + iz + 0.5) * CELL;
      if (cz < z0 || cz >= z1) continue;
      // only the stretch of this row that the corridor covers (the course samples level with it, widened)
      const ia = lowerBound(c.pz, cz - pad - CELL), ib = Math.min(c.count - 1, lowerBound(c.pz, cz + pad + CELL));
      let rx0 = 1e9, rx1 = -1e9;
      for (let i = ia; i <= ib; i++) { if (c.px[i] < rx0) rx0 = c.px[i]; if (c.px[i] > rx1) rx1 = c.px[i]; }
      if (rx0 > rx1) continue;
      const ixA = Math.max(0, Math.floor((rx0 - pad) / CELL) - gx0 - 1), ixB = Math.min(NX - 2, Math.ceil((rx1 + pad) / CELL) - gx0 + 1);
      for (let ix = ixA; ix < ixB; ix++) {
        const a = sample(ix, iz), b = sample(ix + 1, iz), cc = sample(ix, iz + 1), d = sample(ix + 1, iz + 1);
        if (isNaN(H[a]) || isNaN(H[b]) || isNaN(H[cc]) || isNaN(H[d])) continue;
        const ra = H[a] - W[a], rb = H[b] - W[b], rc = H[cc] - W[cc], rd = H[d] - W[d];
        const flip = ((gx0 + ix + gz0 + iz) & 1) === 0;
        if (Math.max(ra, rb, rc, rd) > -0.7) {
          const A = vT(ix, iz), B = vT(ix + 1, iz), C = vT(ix, iz + 1), D = vT(ix + 1, iz + 1);
          if (flip) ti.push(A, C, B, B, C, D); else ti.push(A, C, D, A, D, B);
        }
        if (Math.min(ra, rb, rc, rd) < 0.35) {
          const A = vW(ix, iz), B = vW(ix + 1, iz), C = vW(ix, iz + 1), D = vW(ix + 1, iz + 1);
          if (flip) wi.push(A, C, B, B, C, D); else wi.push(A, C, D, A, D, B);
        }
      }
      if (work > 220) { work = 0; yield; }
    }
    if (ti.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(tc, 4));
      g.setIndex(ti); g.computeVertexNormals(); g.computeBoundingSphere();
      out.geos.push(g);
      out.group.add(new THREE.Mesh(g, mats.terrain));
    }
    if (wi.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
      g.setAttribute("aDepth", new THREE.Float32BufferAttribute(wd, 1));
      g.setAttribute("aFoam", new THREE.Float32BufferAttribute(wf, 1));
      g.setIndex(wi); g.computeBoundingSphere();
      out.geos.push(g);
      out.group.add(new THREE.Mesh(g, mats.water));
    }
    yield;
  }

  // ---- the coarse ring out to the horizon (a little lower, so the fine land always wins where they meet)
  {
    const C = q === "low" ? 60 : 44, padO = 1500;
    const gx0 = Math.floor((xa - padO) / C), gx1 = Math.ceil((xb + padO) / C);
    const zlo = k === 0 ? za - padO : z0, zhi = k >= n - 1 ? zb + padO : z1;
    const gz0 = Math.floor(zlo / C) - 1, gz1 = Math.ceil(zhi / C) + 1;
    const NX = gx1 - gx0 + 1, NZ = gz1 - gz0 + 1;
    const h = new Float32Array(NX * NZ), ok = new Uint8Array(NX * NZ), wl = new Float32Array(NX * NZ);
    const pos: number[] = [], colr: number[] = [], idx: number[] = [];
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = (gx0 + i) * C, z = (gz0 + j) * C;
        land.query(x, z, qy);
        const k2 = j * NX + i;
        ok[k2] = qy.e > CORRIDOR - 50 ? 1 : 0;
        h[k2] = land.heightQ(qy, x, z) - 0.5; wl[k2] = qy.wl;
        paint(h[k2] - wl[k2], 0.3, qy.e, x, z, col);
        pos.push(x, h[k2], z); colr.push(col[0], col[1], col[2], col[3]);
      }
      if (j % 2 === 1) yield;
    }
    for (let j = 0; j < NZ - 1; j++) {
      const cz = (gz0 + j + 0.5) * C;
      if (cz < zlo || cz >= zhi) continue;
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, cc = a + NX, d = cc + 1;
        if (!(ok[a] && ok[b] && ok[cc] && ok[d])) continue;
        if (Math.max(h[a] - wl[a], h[b] - wl[b], h[cc] - wl[cc], h[d] - wl[d]) < -0.8) continue;
        idx.push(a, cc, b, b, cc, d);
      }
    }
    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 4));
      g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      out.geos.push(g);
      out.group.add(new THREE.Mesh(g, mats.terrain));
    }
    yield;
  }

  // ---- quay walls along built-up lanes (with a neon edge in the neon worlds)
  if (c.walls) {
    const pos: number[] = [], colr: number[] = [], idx: number[] = [];
    const stone = lin(w.land.shore), dark = lin(w.land.mid), edge = w.land.glow ? lin(w.land.glow) : lin(w.land.high);
    const edgeGlow = w.profile === "neon" ? 0.9 : w.profile === "quay" ? 0.35 : 0;
    const p = { x: 0, z: 0 };
    const sa = Math.max(-PRE, s0), sb = Math.min(c.length + POST - 2, s1);
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      let rows = 0;
      for (let s = sa; s <= sb + 0.01; s += 4) {
        const ss = Math.min(s, sb);
        const hw = halfWidthAt(c, ss), wlv = waterAt(c, ss);
        const ring: [number, number, [number, number, number], number][] = [
          [hw, wlv - 3, dark, 0], [hw, wlv + 0.4, dark, 0], [hw, wlv + 0.45, stone, 0], [hw, wlv + 2.2, stone, 0],
          [hw, wlv + 2.25, edge, edgeGlow], [hw + 0.25, wlv + 2.42, edge, edgeGlow], [hw + 1.6, wlv + 2.42, stone, 0],
        ];
        for (const [dd, y, cl, gl] of ring) { place(c, ss, side * dd, p); pos.push(p.x, y, p.z); colr.push(cl[0], cl[1], cl[2], gl); }
        rows++;
      }
      const R = 7;
      for (let r = 0; r < rows - 1; r++) for (let kk = 0; kk < R - 1; kk++) {
        const a = base + r * R + kk, b = a + 1, cc = a + R, d = cc + 1;
        if (side > 0) idx.push(a, b, cc, b, d, cc); else idx.push(a, cc, b, b, cc, d);
      }
    }
    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 4));
      g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      out.geos.push(g);
      out.group.add(new THREE.Mesh(g, mats.terrain));
    }
    yield;
  }

  // ---- the cave roof
  if (w.profile === "cave") {
    const C2 = 8, padC = 70;
    const gx0 = Math.floor((xa - padC) / C2), gx1 = Math.ceil((xb + padC) / C2);
    const gz0 = Math.floor(Math.max(z0, za - padC) / C2) - 1, gz1 = Math.ceil(Math.min(z1, zb + padC) / C2) + 1;
    const NX = gx1 - gx0 + 1, NZ = gz1 - gz0 + 1;
    const pos: number[] = [], colr: number[] = [], idx: number[] = [], ok = new Uint8Array(NX * NZ);
    const rockC = lin(w.land.mid), glowC = lin(w.land.glow ?? "#8C5BFF");
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const x = (gx0 + i) * C2, z = (gz0 + j) * C2;
        land.query(x, z, qy);
        ok[j * NX + i] = qy.e < 60 ? 1 : 0;
        const nn = fbm(x * 0.02, z * 0.02, 3, 77);
        const y = qy.wl + 20 + 14 * nn - 7 * smoothstep(0, 40, qy.e);
        const sparkle = vnoise(x * 0.3, z * 0.3, 5) > 0.9;
        const cl = sparkle ? glowC : mixc(rockC, lin(w.land.low), nn);
        pos.push(x, y, z); colr.push(cl[0], cl[1], cl[2], sparkle ? 0.75 : 0);
      }
      if (j % 6 === 5) yield;
    }
    for (let j = 0; j < NZ - 1; j++) {
      const cz = (gz0 + j + 0.5) * C2;
      if (cz < z0 || cz >= z1) continue;
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, cc = a + NX, d = cc + 1;
        if (ok[a] + ok[b] + ok[cc] + ok[d] < 1) continue;
        idx.push(a, b, cc, b, d, cc);
      }
    }
    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 4));
      g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      out.geos.push(g);
      out.group.add(new THREE.Mesh(g, mats.terrain));
    }
    yield;
  }

  // ---- waterfall curtains in this stretch
  for (const f of c.falls) {
    if (f.s < s0 || f.s >= s1) continue;
    const hw = halfWidthAt(c, f.s) + 3, top = f.top + 0.05, bottom = f.top - f.drop - 0.6;
    const g = new THREE.PlaneGeometry(hw * 2, top - bottom, 8, 6);
    const pp = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) { const v = (pp.getY(i) + (top - bottom) / 2) / (top - bottom); pp.setZ(i, -(1 - v) * (1 - v) * 3); }
    out.geos.push(g);
    const m = new THREE.Mesh(g, mats.falls);
    const p = { x: 0, z: 0 };
    place(c, f.s + 1, 0, p);
    m.position.set(p.x, (top + bottom) / 2, p.z);
    m.rotation.y = f.ang + Math.PI;
    out.group.add(m);
  }
}

/** the far ocean (under everything, at the lowest water level); it follows the camera */
export function oceanMesh(c: Course, land: Land, mats: LandMats) {
  // as deep as the sea beside the start (so its colour meets the near water's)
  let sum = 0, cnt = 0;
  const qy: LandQuery = { i: 0, d: 0, e: 0, dist: 0, wl: 0, s: 0 };
  for (let s = 0; s < Math.min(c.length, 1600); s += 80) for (const side of [-1, 1]) {
    const p = { x: 0, z: 0 };
    place(c, s, side * (halfWidthAt(c, s) + CORRIDOR - 10), p);
    land.query(p.x, p.z, qy);
    const h = land.heightQ(qy, p.x, p.z);
    if (qy.wl > h) { sum += qy.wl - h; cnt++; }
  }
  const depth = cnt > 6 ? clamp(sum / cnt, 1.5, 40) : 40;
  const g = new THREE.CircleGeometry(4500, 48);
  g.rotateX(-Math.PI / 2);
  const nv = g.getAttribute("position").count;
  g.setAttribute("aDepth", new THREE.Float32BufferAttribute(new Float32Array(nv).fill(depth), 1));
  g.setAttribute("aFoam", new THREE.Float32BufferAttribute(new Float32Array(nv), 1));
  const m = new THREE.Mesh(g, mats.water);
  m.position.y = c.baseWater - 0.18;
  m.renderOrder = -2;
  m.frustumCulled = false;
  return m;
}
