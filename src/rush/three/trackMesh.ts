// Track meshes, built in chunks that stream in ahead of Rollo and are dropped behind him: the running surface (grass
// path, boards, waterfall water, flowers, stone), its thick edges, the land beside it (grassy shoulders falling to rock
// cliffs and the sea — or meadow slopes), wooden fences and stone walls, lanterns that flicker, palms / trees / flowers,
// bridge pillars into the sea, loop rails and pillars, and the waterfall's rock walls, side sheets and mist.
import * as THREE from "three";
import type { Track } from "../track";
import type { FloorKind, Seg } from "../types";
import type { EnvLook } from "./env";
import { floorTex, boards, fallsWater, glow, grassFlowers, grassPath, rock, stoneFloor } from "./tex";

export const CHUNK = 80;

let rs = 1;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };

interface Buf { p: number[]; n: number[]; uv: number[]; idx: number[]; c?: number[] }
const buf = (c = false): Buf => ({ p: [], n: [], uv: [], idx: [], ...(c ? { c: [] } : {}) });
function toGeo(b: Buf) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  if (b.c) g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
  g.setIndex(b.idx);
  if (b.n.length) g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3)); else g.computeVertexNormals();
  return g;
}
/** add a grid strip: rows × cols points from a function, triangles between them (skip rows where keep() is false) */
function strip(b: Buf, rows: number, cols: number, at: (r: number, c: number, out: number[]) => void, uv: (r: number, c: number) => [number, number], keep: (r: number) => boolean = () => true, color?: (r: number, c: number) => [number, number, number]) {
  const base = b.p.length / 3, o = [0, 0, 0];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    at(r, c, o); b.p.push(o[0], o[1], o[2]); const t = uv(r, c); b.uv.push(t[0], t[1]);
    if (b.c && color) b.c.push(...color(r, c));
  }
  for (let r = 0; r < rows - 1; r++) {
    if (!keep(r)) continue;
    for (let c = 0; c < cols - 1; c++) {
      const a = base + r * cols + c, d = a + cols;
      b.idx.push(a, a + 1, d, a + 1, d + 1, d);
    }
  }
}

const darkMetalF = (t: TrackMeshes) => t.matOf("darkPost", () => new THREE.MeshStandardMaterial({ color: "#2E2A33", roughness: 0.5, metalness: 0.6 }));
export interface Chunk { i: number; group: THREE.Group; lamps: THREE.Sprite[]; geos: THREE.BufferGeometry[]; merged?: THREE.BufferGeometry[] }

export class TrackMeshes {
  private mats = new Map<string, THREE.Material>();
  readonly water: THREE.Texture;
  /** worlds where the road floats in the air (no land beside it) */
  readonly floating: boolean;
  constructor(readonly tr: Track, readonly look: EnvLook, readonly coast: boolean, readonly quality: "low" | "medium" | "high", readonly scenery = coast ? "coast" : "meadow") {
    this.floating = ["sky", "space", "highway", "grid"].includes(scenery);
    this.water = fallsWater().clone(); this.water.needsUpdate = true;
  }
  /** draw the road only up to here (where the next stage's road joins on) */
  end = Infinity;
  matOf(key: string, make: () => THREE.Material) { return this.mat(key, make); }
  private mat(key: string, make: () => THREE.Material) { let m = this.mats.get(key); if (!m) { m = make(); this.mats.set(key, m); } return m; }
  floorMat(k: FloorKind) {
    return this.mat(`floor:${k}`, () => {
      if (k === "falls") return new THREE.MeshStandardMaterial({ map: this.water, roughness: 0.15, metalness: 0.1, emissive: "#2A6A9A", emissiveIntensity: 0.35 });
      const L = this.look;
      const glowing: Record<string, [string, string]> = { neon: [L.light, "#5CF2C9"], rainbow: ["", ""], crystal: [L.grass, L.light], rock: [L.rock, "#FF6A2A"] };
      if (k === "neon" || k === "rainbow" || k === "crystal" || (k === "rock" && L.water.toLowerCase() === "#3a1a12")) {
        const [a, b] = glowing[k];
        const map = floorTex(k, a, b), em = floorTex(k, a, b, true);
        return new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: "#FFFFFF", emissiveIntensity: k === "rainbow" ? 0.55 : 0.8, roughness: k === "crystal" ? 0.15 : 0.45, metalness: k === "crystal" ? 0.3 : 0.1 });
      }
      if (["sand", "snow", "ice", "candy", "metal", "glass", "cloud", "rock", "water", "leaves"].includes(k)) {
        const map = floorTex(k, k === "candy" ? L.grass : k === "water" ? L.water : k === "sand" ? L.grass : L.rock, L.grass);
        const gloss = k === "ice" || k === "glass" || k === "water";
        return new THREE.MeshStandardMaterial({ map, roughness: gloss ? 0.12 : k === "metal" ? 0.35 : 0.85, metalness: k === "metal" ? 0.6 : gloss ? 0.15 : 0, transparent: k === "glass", opacity: k === "glass" ? 0.72 : 1 });
      }
      const map = k === "boards" ? boards() : k === "stone" ? stoneFloor() : k === "flowers" ? grassFlowers(this.look.grass) : grassPath(this.look.grass);
      return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
    });
  }

  build(i: number): Chunk {
    rs = (i * 7919 + 13) % 2147483646 + 1;
    const tr = this.tr, look = this.look;
    const lim = Math.min(tr.len, this.end);
    const s0 = i * CHUNK, s1 = Math.min(tr.len + 200, this.end, s0 + CHUNK);
    const group = new THREE.Group();
    const geos: THREE.BufferGeometry[] = [];
    const lamps: THREE.Sprite[] = [];
    const fr = new Float32Array(12);
    const step = 1;
    const ns = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
    const S = (r: number) => Math.min(s1, s0 + r * step);
    const segOf = (s: number) => tr.segAt(Math.min(tr.len - 0.01, s));
    const W = (s: number) => tr.widthAt(s);
    // ---- running surface, one mesh per floor kind (gaps are left open)
    const floors = new Map<FloorKind, Buf>();
    const cols = 7;
    for (let r = 0; r < ns - 1; r++) {
      const s = S(r), g = segOf(s + 0.5);
      if (g.gap || s >= lim) continue;
      const b = floors.get(g.floor) ?? floors.set(g.floor, buf()).get(g.floor)!;
      const pts = (ss: number, c: number, out: number[]) => { const w = W(ss) / 2 + 0.3; tr.point(ss, -w + (2 * w * c) / (cols - 1), 0, out); };
      strip(b, 2, cols, (rr, c, o) => pts(S(r + rr), c, o), (rr, c) => [c / (cols - 1), S(r + rr) / 8]);
    }
    for (const [k, b] of floors) { const g = toGeo(b); geos.push(g); const m = new THREE.Mesh(g, this.floorMat(k)); m.receiveShadow = true; group.add(m); }
    // ---- thick edges and underside
    const edge = buf();
    for (const side of [-1, 1]) {
      for (let r = 0; r < ns - 1; r++) {
        const s = S(r), g = segOf(s + 0.5);
        if (g.gap || s >= lim) continue;
        const depth = g.tag === "loop" ? -0.3 : -0.9;
        strip(edge, 2, 2, (rr, c, o) => { const ss = S(r + rr); tr.point(ss, side * (W(ss) / 2 + 0.3), c ? depth : 0.02, o); }, (rr, c) => [S(r + rr) / 4, c]);
      }
    }
    for (let r = 0; r < ns - 1; r++) {
      const s = S(r), g = segOf(s + 0.5);
      if (g.gap || s >= lim) continue;
      const under = g.tag === "loop" ? -0.3 : -0.9;
      strip(edge, 2, 2, (rr, c, o) => { const ss = S(r + rr); tr.point(ss, (c ? 1 : -1) * (W(ss) / 2 + 0.3), under, o); }, (rr, c) => [S(r + rr) / 4, c]);
    }
    const eg = toGeo(edge); geos.push(eg);
    const edgeMesh = new THREE.Mesh(eg, this.mat("edge", () => new THREE.MeshStandardMaterial({ map: rock(look.rock), roughness: 0.95, side: THREE.DoubleSide })));
    group.add(edgeMesh);
    // ---- land beside the track (not under bridges, loops, waterfalls or gaps)
    const land = (g: Seg) => !this.floating && !g.gap && (g.tag === "plain" || g.tag === "hill" || g.tag === "bank" || g.tag === "boss");
    const shoulder = buf(), cliff = buf();
    const hx = [0.3, 3.5, 9, 20, 34];
    for (const side of [-1, 1]) {
      for (let r = 0; r < ns - 1; r++) {
        const s = S(r);
        if (!land(segOf(s + 0.5)) || s >= lim) continue;
        const at = (ss: number, c: number, o: number[]) => {
          tr.frame(ss, fr);
          const rx = fr[9], rz = fr[11], rl = Math.hypot(rx, rz) || 1;
          const w = W(ss) / 2 + hx[c];
          const y0 = fr[1];
          const y = c === 0 ? y0 + fr[10] * side * (W(ss) / 2 + 0.3) : c === 1 ? y0 - 0.5 : c === 2 ? y0 - 2.6 : c === 3 ? (this.coast ? y0 * 0.42 : Math.max(-1, y0 - 9)) : (this.coast ? -1.5 : -2);
          o[0] = fr[0] + (rx / rl) * side * w; o[1] = y; o[2] = fr[2] + (rz / rl) * side * w;
        };
        // shoulders (grass), then cliffs (rock) — triangles wound for each side
        const sb = shoulder, cb = cliff;
        const add = (b: Buf, c0: number, c1: number) => {
          const base = b.p.length / 3, o = [0, 0, 0];
          for (let rr = 0; rr < 2; rr++) for (let c = c0; c <= c1; c++) { at(S(r + rr), c, o); b.p.push(o[0], o[1], o[2]); b.uv.push((c - c0) * 1.6, S(r + rr) / 8); }
          const n = c1 - c0 + 1;
          for (let c = 0; c < n - 1; c++) { const a = base + c, d = a + n; if (side > 0) b.idx.push(a, a + 1, d, a + 1, d + 1, d); else b.idx.push(a, d, a + 1, a + 1, d, d + 1); }
        };
        add(sb, 0, 2); add(cb, 2, 4);
      }
    }
    if (shoulder.p.length) { const g = toGeo(shoulder); geos.push(g); const m = new THREE.Mesh(g, this.mat("shoulder", () => new THREE.MeshStandardMaterial({ map: grassFlowers(look.grass), roughness: 0.95 }))); m.receiveShadow = true; group.add(m); }
    if (cliff.p.length) { const g = toGeo(cliff); geos.push(g); group.add(new THREE.Mesh(g, this.mat("cliff", () => new THREE.MeshStandardMaterial({ map: rock(look.rock), roughness: 0.95 })))); }
    // ---- fences, walls, rails, lanterns, bridge pillars, loop pillars
    const post = this.geo("post", () => new THREE.BoxGeometry(0.16, 1.05, 0.16).translate(0, 0.52, 0));
    const rail = this.geo("rail", () => new THREE.BoxGeometry(0.08, 0.1, 1).translate(0, 0, 0.5));
    const wallG = this.geo("wall", () => new THREE.BoxGeometry(0.45, 0.55, 2.05).translate(0, 0.27, 0));
    const pillarG = this.geo("pillar", () => new THREE.BoxGeometry(1.2, 1, 1.2).translate(0, -0.5, 0));
    const wood = this.mat("wood", () => new THREE.MeshStandardMaterial({ color: "#8A5A36", roughness: 0.85 }));
    const stoneM = this.mat("stoneM", () => new THREE.MeshStandardMaterial({ map: stoneFloor(), roughness: 0.9 }));
    const metal = this.mat("metal", () => new THREE.MeshStandardMaterial({ color: "#B9C4D6", roughness: 0.3, metalness: 0.8 }));
    const posts: THREE.Matrix4[] = [], rails: THREE.Matrix4[] = [], walls: THREE.Matrix4[] = [], pillars: THREE.Matrix4[] = [], loopRails: THREE.Matrix4[] = [];
    const mPosts: THREE.Matrix4[] = [], mRails: THREE.Matrix4[] = [], nPosts: THREE.Matrix4[] = [], nRails: THREE.Matrix4[] = [];
    const neonM = this.mat("neonFence", () => new THREE.MeshBasicMaterial({ color: this.look.light }));
    const ob = new THREE.Object3D(), up = new THREE.Vector3(), fw = new THREE.Vector3(), P = [0, 0, 0], Q = [0, 0, 0];
    const orient = (s: number, u: number, h: number) => { tr.frame(s, fr); tr.point(s, u, h, P); ob.position.set(P[0], P[1], P[2]); up.set(fr[6], fr[7], fr[8]); fw.set(fr[3], fr[4], fr[5]); ob.up.copy(up); ob.lookAt(P[0] - fw.x, P[1] - fw.y, P[2] - fw.z); };
    for (let s = Math.ceil(s0 / 2.5) * 2.5; s < s1 && s < lim; s += 2.5) {
      const g = segOf(s);
      if (g.gap) continue;
      const w = W(s) / 2 + 0.15;
      for (const side of [-1, 1]) {
        if (g.tag === "loop" || g.tag === "falls") {
          if (g.tag === "loop") { orient(s, side * w, 0.45); ob.scale.set(1, 1, 2.5); ob.updateMatrix(); loopRails.push(ob.matrix.clone()); }
          continue;
        }
        if (g.fence === "wood" || g.fence === "metal" || g.fence === "neon") {
          const into = g.fence === "wood" ? [posts, rails] : g.fence === "metal" ? [mPosts, mRails] : [nPosts, nRails];
          orient(s, side * w, 0); ob.scale.set(1, 1, 1); ob.updateMatrix(); into[0].push(ob.matrix.clone());
          // two rails to the next post
          tr.point(s, side * w, 0.75, P); tr.point(s + 2.5, side * w, 0.75, Q);
          for (const hh of [0.75, 0.42]) {
            tr.point(s, side * w, hh, P); tr.point(s + 2.5, side * w, hh, Q);
            ob.position.set(P[0], P[1], P[2]); ob.up.set(fr[6], fr[7], fr[8]); ob.lookAt(Q[0], Q[1], Q[2]);
            ob.scale.set(1, 1, Math.hypot(Q[0] - P[0], Q[1] - P[1], Q[2] - P[2])); ob.updateMatrix(); into[1].push(ob.matrix.clone());
          }
        } else if (g.fence === "stone" && Math.round(s / 2.5) % 1 === 0) {
          orient(s, side * w, 0); ob.scale.set(1, 1, 1.25); ob.updateMatrix(); walls.push(ob.matrix.clone());
        }
      }
      // bridge pillars down into the sea
      if (g.tag === "bridge" && Math.round(s / 2.5) % 4 === 0) {
        for (const side of [-1, 1]) {
          tr.point(s, side * (W(s) / 2 - 0.4), -0.9, P);
          ob.position.set(P[0], P[1], P[2]); ob.up.set(0, 1, 0); ob.rotation.set(0, 0, 0); ob.scale.set(1, P[1] + 2, 1); ob.updateMatrix(); pillars.push(ob.matrix.clone());
        }
      }
      // loops stand on two pillars
      if (g.tag === "loop") {
        tr.frame(s, fr);
        if (fr[7] > 0.97 && Math.round(s / 2.5) % 3 === 0) { tr.point(s, 0, -0.9, P); ob.position.set(P[0], P[1], P[2]); ob.rotation.set(0, 0, 0); ob.up.set(0, 1, 0); ob.scale.set(1.4, Math.max(1, P[1] + 1), 1.4); ob.updateMatrix(); pillars.push(ob.matrix.clone()); }
      }
    }
    const inst = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[]) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, m, list.length); list.forEach((x, k) => im.setMatrixAt(k, x)); im.castShadow = this.quality !== "low"; group.add(im); };
    inst(post, wood, posts); inst(rail, wood, rails); inst(post, metal, mPosts); inst(rail, metal, mRails); inst(post, darkMetalF(this), nPosts); inst(rail, neonM, nRails); inst(wallG, stoneM, walls); inst(pillarG, stoneM, pillars); inst(rail, metal, loopRails);
    // ---- lanterns (warm light pools in the night)
    const lampPost = this.geo("lampPost", () => new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6).translate(0, 1.2, 0));
    const lampHead = this.geo("lampHead", () => new THREE.BoxGeometry(0.34, 0.42, 0.34));
    const lampMat = this.mat("lampHead", () => new THREE.MeshBasicMaterial({ color: "#FFD58A" }));
    const darkMetal = this.mat("darkMetal", () => new THREE.MeshStandardMaterial({ color: "#2E2A33", roughness: 0.6 }));
    for (let s = Math.ceil(s0 / 26) * 26; s < s1 && s < lim; s += 26) {
      const g = segOf(s);
      if (!land(g) && g.tag !== "bridge") continue;
      const side = Math.round(s / 26) % 2 ? 1 : -1;
      orient(s, side * (W(s) / 2 + 0.9), 0);
      const p = new THREE.Mesh(lampPost, darkMetal); p.position.copy(ob.position); p.quaternion.copy(ob.quaternion); group.add(p);
      tr.point(s, side * (W(s) / 2 + 0.9), 2.55, P);
      const head = new THREE.Mesh(lampHead, lampMat); head.position.set(P[0], P[1], P[2]); head.quaternion.copy(ob.quaternion); group.add(head);
      if (look.night || this.quality !== "low") {
        const gl = new THREE.Sprite(this.mat("lampGlow", () => new THREE.SpriteMaterial({ map: glow("#FFC46B"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: look.night ? 0.9 : 0.4 })) as THREE.SpriteMaterial);
        gl.position.set(P[0], P[1], P[2]); gl.scale.setScalar(look.night ? 4.5 : 2.5); group.add(gl); lamps.push(gl);
        // a warm pool on the grass under the lamp
        tr.point(s, side * (W(s) / 2 - 0.6), 0.04, P);
        const pool = new THREE.Mesh(this.geo("pool", () => new THREE.CircleGeometry(3.2, 20).rotateX(-Math.PI / 2)), this.mat("pool", () => new THREE.MeshBasicMaterial({ map: glow("#FFB45A"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: look.night ? 0.55 : 0.15 })));
        pool.position.set(P[0], P[1], P[2]); pool.quaternion.copy(ob.quaternion); pool.rotateX(Math.PI / 2); pool.rotateX(-Math.PI / 2); group.add(pool);
      }
    }
    // ---- trees, palms, bushes, flowers, rocks on the land
    const trunk = this.mat("trunk", () => new THREE.MeshStandardMaterial({ color: "#7A5434", roughness: 0.9 }));
    const leaf = this.mat("leaf", () => new THREE.MeshStandardMaterial({ color: this.coast ? "#2F8F4E" : "#58B84A", roughness: 0.8, side: THREE.DoubleSide }));
    const bushG = this.geo("bush", () => new THREE.IcosahedronGeometry(1, 1));
    const rockG = this.geo("rock", () => new THREE.DodecahedronGeometry(1, 0));
    const flowerCols = ["#FFE066", "#FF8FB1", "#FFFFFF", "#B98CFF"];
    const flowerG = this.geo("flower", () => new THREE.SphereGeometry(0.18, 6, 4));
    for (let s = s0 + rnd() * 8; s < s1 && s < lim; s += 7 + rnd() * 9) {
      const g = segOf(s);
      if (!land(g)) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      tr.frame(s, fr);
      const rx = fr[9], rz = fr[11], rl = Math.hypot(rx, rz) || 1;
      const d = W(s) / 2 + 2.5 + rnd() * 6;
      const x = fr[0] + (rx / rl) * side * d, z = fr[2] + (rz / rl) * side * d, y = fr[1] - 0.2 - (d - W(s) / 2) * 0.2;
      const kind = rnd();
      if (this.scenery !== "coast" && this.scenery !== "meadow") { this.prop(group, this.scenery, x, y, z, kind); continue; }
      if (kind < 0.35) {
        if (this.coast) this.palm(group, x, y, z, 5 + rnd() * 3, trunk, leaf);
        else this.tree(group, x, y, z, 4 + rnd() * 3, trunk, leaf, bushG);
      } else if (kind < 0.65) {
        const bsh = new THREE.Mesh(bushG, leaf); bsh.scale.set(0.9 + rnd() * 0.8, 0.6 + rnd() * 0.5, 0.9 + rnd() * 0.8); bsh.position.set(x, y + 0.3, z); group.add(bsh);
        for (let f = 0; f < 4; f++) { const fl = new THREE.Mesh(flowerG, this.mat(`fl${f}`, () => new THREE.MeshStandardMaterial({ color: flowerCols[f], emissive: flowerCols[f], emissiveIntensity: look.night ? 0.25 : 0.05 }))); fl.position.set(x + (rnd() - 0.5) * 1.6, y + 0.7 + rnd() * 0.3, z + (rnd() - 0.5) * 1.6); group.add(fl); }
      } else {
        const rk = new THREE.Mesh(rockG, this.mat("rockM", () => new THREE.MeshStandardMaterial({ map: rock(look.rock), roughness: 0.95 }))); rk.scale.set(0.6 + rnd(), 0.4 + rnd() * 0.6, 0.6 + rnd()); rk.rotation.set(rnd(), rnd() * 6, rnd()); rk.position.set(x, y, z); group.add(rk);
      }
    }
    // ---- waterfalls: rock walls either side, wide water sheets, mist at the bottom
    for (let r = 0; r < ns - 1; r += 1) {
      const s = S(r), g = segOf(s + 0.5);
      if (g.tag !== "falls" || s >= lim) continue;
      if (Math.round(s) % 3 !== 0) continue;
      for (const side of [-1, 1]) {
        orient(s, side * (W(s) / 2 + 1.2), -9.6);
        const wall = new THREE.Mesh(this.geo("fallsWall", () => new THREE.BoxGeometry(1.8, 14, 3.4).translate(0, 4, 0)), this.mat("cliff", () => new THREE.MeshStandardMaterial({ map: rock(look.rock), roughness: 0.95 })));
        wall.position.copy(ob.position); wall.quaternion.copy(ob.quaternion); group.add(wall);
        orient(s, side * (W(s) / 2 + 9), -1.2);
        const sheet = new THREE.Mesh(this.geo("sheet", () => new THREE.PlaneGeometry(14, 3.4).rotateX(-Math.PI / 2)), this.floorMat("falls"));
        sheet.position.copy(ob.position); sheet.quaternion.copy(ob.quaternion); group.add(sheet);
      }
    }
    const fallEnd = tr.segs.findIndex((g, k) => g.tag === "falls" && tr.segs[k + 1]?.tag !== "falls");
    void fallEnd;
    return { i, group, lamps, geos };
  }
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private geo(key: string, make: () => THREE.BufferGeometry) { let g = this.geoCache.get(key); if (!g) { g = make(); this.geoCache.set(key, g); } return g; }
  /** one trackside prop in a world's style */
  private prop(group: THREE.Group, kind: string, x: number, y: number, z: number, k: number) {
    const L = this.look;
    const put = (geo: THREE.BufferGeometry, mat: THREE.Material, px: number, py: number, pz: number, sx: number, sy: number, sz: number, rot = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); m.rotation.y = rot; group.add(m); return m; };
    const std = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => this.mat(`p:${c}:${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o }));
    const glowM = (c: string) => this.mat(`pg:${c}`, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1, roughness: 0.4 }));
    const cyl = this.geo("pCyl", () => new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0)), cone = this.geo("pCone", () => new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0));
    const sph = this.geo("pSph", () => new THREE.SphereGeometry(1, 10, 8)), box = this.geo("pBox", () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), ico = this.geo("pIco", () => new THREE.IcosahedronGeometry(1, 0));
    const r = rnd;
    switch (kind) {
      case "canyon": if (k < 0.5) { put(cyl, std("#FFFFFF"), x, y, z, 0.1, 3, 0.1); put(this.geo("pDisc", () => new THREE.CylinderGeometry(1, 1, 0.25, 18).rotateX(Math.PI / 2)), std(["#FF5A9A", "#FFE066", "#5CF2C9"][Math.floor(r() * 3)], { roughness: 0.3 }), x, y + 3.2, z, 0.9, 0.9, 1, r() * 6); } else put(cone, std(["#B98CFF", "#5CF2C9", "#FFB347"][Math.floor(r() * 3)], { roughness: 0.25 }), x, y, z, 0.9, 1.3, 0.9); break;
      case "forest": if (this.look.grass.toLowerCase() === "#c8662a") { put(cyl, std("#6B4A2E"), x, y, z, 0.25, 3, 0.25); put(sph, std(["#E8662A", "#FFB347", "#C8352A"][Math.floor(r() * 3)]), x, y + 3.6, z, 1.6, 1.4, 1.6); } else for (let i = 0; i < 3; i++) { const h = 5 + r() * 4; put(cyl, std("#7FB85A", { roughness: 0.5 }), x + (r() - 0.5) * 1.2, y, z + (r() - 0.5) * 1.2, 0.14, h, 0.14); } break;
      case "cave": if (k < 0.6) for (let i = 0; i < 3; i++) { const c = put(this.geo("pCrys", () => new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0)), glowM(i % 2 ? "#7FE8FF" : "#C9A8FF"), x + (r() - 0.5), y, z + (r() - 0.5), 0.3, 1 + r() * 1.8, 0.3); c.rotation.z = (r() - 0.5) * 0.7; } else put(ico, std(L.rock, { flatShading: true }), x, y, z, 1, 0.7, 1, r() * 6); break;
      case "city": put(cyl, std("#2E2A33", { metalness: 0.6 }), x, y, z, 0.08, 3.4, 0.08); put(box, glowM(k < 0.5 ? "#FF5FD8" : "#5CF2C9"), x, y + 3.4, z, 0.5, 0.18, 0.5); break;
      case "snow": if (k < 0.6) { const h = 3 + r() * 3; put(cone, std("#2F6A4A"), x, y, z, h * 0.32, h, h * 0.32); put(cone, std("#FFFFFF"), x, y + h * 0.6, z, h * 0.17, h * 0.42, h * 0.17); } else { put(sph, std("#FFFFFF"), x, y + 0.5, z, 0.6, 0.6, 0.6); put(sph, std("#FFFFFF"), x, y + 1.3, z, 0.42, 0.42, 0.42); put(cone, std("#FF8A3A"), x, y + 1.3, z - 0.42, 0.06, 0.3, 0.06).rotation.x = -Math.PI / 2; } break;
      case "volcano": put(ico, std("#1E1412", { flatShading: true }), x, y, z, 1.1, 0.8, 1.1, r() * 6); if (k < 0.4) put(sph, glowM("#FF5A1A"), x, y + 0.1, z, 0.5, 0.15, 0.5); break;
      case "jungle": for (let i = 0; i < 5; i++) { const lf = put(this.geo("pLeaf", () => new THREE.SphereGeometry(1, 8, 6)), std("#3E8A3A", { side: THREE.DoubleSide }), x, y + 0.6, z, 0.3, 0.08, 1.4, (i / 5) * Math.PI * 2); lf.rotation.x = 0.5; } break;
      case "dunes": if (k < 0.5) { put(cyl, std("#4E9A3E"), x, y, z, 0.3, 2.6, 0.3); put(cyl, std("#4E9A3E"), x + 0.45, y + 1, z, 0.18, 1, 0.18); put(cyl, std("#4E9A3E"), x - 0.45, y + 1.4, z, 0.18, 0.8, 0.18); } else put(ico, std(L.rock, { flatShading: true }), x, y, z, 1, 0.6, 1.2, r() * 6); break;
      case "factory": put(box, std(["#FF5A7A", "#5AA0FF", "#FFE066", "#5CF2C9"][Math.floor(r() * 4)], { roughness: 0.35 }), x, y, z, 1.2, 1.2, 1.2, r() * 2); break;
      case "carnival": for (let i = 0; i < 4; i++) put(sph, std(["#FF5A7A", "#5CF2C9", "#FFE066", "#B98CFF"][i], { roughness: 0.25 }), x + (r() - 0.5) * 0.8, y + 2.6 + r() * 0.8, z + (r() - 0.5) * 0.8, 0.4, 0.5, 0.4); put(cyl, std("#FFFFFF"), x, y, z, 0.02, 2.6, 0.02); break;
      case "sea": if (k < 0.6) for (let b = 0; b < 3; b++) { const m = put(cyl, std(["#FF8FA0", "#FFB347", "#B98CFF"][b]), x, y, z, 0.18, 1.6 + r(), 0.18); m.rotation.z = (b - 1) * 0.5; } else put(cyl, std("#2E8A5A"), x, y, z, 0.12, 4 + r() * 3, 0.12); break;
      case "plains": put(cone, std(L.grass), x, y, z, 0.6, 0.9, 0.6); break;
      case "shrooms": { const h = 1 + r() * 2.4, c = ["#9FFFB8", "#FF8FC8", "#7FE8FF", "#FFE066"][Math.floor(r() * 4)]; put(cyl, std("#F2E6D0"), x, y, z, 0.14, h, 0.14); put(this.geo("pCap", () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), glowM(c), x, y + h, z, h * 0.45, h * 0.3, h * 0.45); break; }
      case "tower": put(cyl, std("#3A2A1A"), x, y, z, 0.1, 3, 0.1); put(sph, glowM("#FFE0A0"), x, y + 3.1, z, 0.25, 0.25, 0.25); break;
      case "moors": { const t = put(cyl, std("#2A2626"), x, y, z, 0.18, 3.4, 0.18); t.rotation.z = (r() - 0.5) * 0.5; if (k < 0.3) put(box, std("#4A4A44"), x + 1, y, z, 0.8, 1.2, 0.25, r()); break; }
      case "peaks": put(cyl, std("#5A3E2A"), x, y, z, 0.2, 2.4, 0.2); put(sph, std("#FFB0CF"), x, y + 2.8, z, 1.5, 1.1, 1.5); break;
      case "fortress": put(cone, std("#4A4F5E", { metalness: 0.6 }), x, y, z, 0.4, 2.4, 0.4); if (k < 0.3) put(sph, glowM("#FF5A3A"), x, y + 2.5, z, 0.18, 0.18, 0.18); break;
      default: put(ico, std(L.rock, { flatShading: true }), x, y, z, 0.8, 0.5, 0.8);
    }
  }
  private palm(group: THREE.Group, x: number, y: number, z: number, h: number, trunk: THREE.Material, leaf: THREE.Material) {
    const seg = this.geo("palmSeg", () => new THREE.CylinderGeometry(0.16, 0.22, 1, 7));
    const frond = this.geo("frond", () => {
      const g = new THREE.PlaneGeometry(0.9, 3.6, 1, 6);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const yy = p.getY(i) + 1.8; p.setY(i, yy); p.setZ(i, -yy * yy * 0.09); p.setX(i, p.getX(i) * (1 - yy / 4.2)); }
      g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g;
    });
    const bend = (rnd() - 0.5) * 0.6;
    let top = new THREE.Vector3(x, y, z);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(seg, trunk); m.scale.set(1, h / 5, 1);
      const off = Math.sin(bend) * i * i * 0.06;
      m.position.set(x + off, y + (i + 0.5) * (h / 5), z); m.rotation.z = -bend * i * 0.08; group.add(m);
      top = new THREE.Vector3(x + off, y + (i + 1) * (h / 5), z);
    }
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(frond, leaf); f.position.copy(top); f.rotation.set(0.45 + rnd() * 0.35, (i / 7) * Math.PI * 2 + rnd() * 0.3, 0); group.add(f); }
  }
  private tree(group: THREE.Group, x: number, y: number, z: number, h: number, trunk: THREE.Material, leaf: THREE.Material, crown: THREE.BufferGeometry) {
    const t = new THREE.Mesh(this.geo("trunkT", () => new THREE.CylinderGeometry(0.2, 0.3, 1, 7)), trunk); t.scale.set(1, h * 0.55, 1); t.position.set(x, y + h * 0.27, z); group.add(t);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(crown, leaf); c.scale.setScalar(h * (0.32 - k * 0.05)); c.position.set(x + (rnd() - 0.5) * 0.8, y + h * (0.62 + k * 0.16), z + (rnd() - 0.5) * 0.8); group.add(c); }
  }
  /** per frame: the waterfall water flows, lanterns flicker */
  frame(dt: number, t: number, chunks: Iterable<Chunk>) {
    this.water.offset.y -= dt * 1.6;
    for (const c of chunks) c.lamps.forEach((l, k) => { l.scale.setScalar((this.look.night ? 4.5 : 2.5) * (0.92 + Math.sin(t * 7 + k * 1.7) * 0.05 + Math.sin(t * 13 + k) * 0.03)); });
  }
  disposeChunk(c: Chunk) { for (const g of c.geos) g.dispose(); c.merged?.forEach((g) => g.dispose()); c.group.removeFromParent(); }
  dispose() { for (const m of this.mats.values()) m.dispose(); for (const g of this.geoCache.values()) g.dispose(); this.water.dispose(); }
}
