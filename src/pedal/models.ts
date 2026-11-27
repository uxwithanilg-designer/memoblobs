// Obby Bike Blaster's pixel models. Each is a set of box parts wrapped in a 64×64 pixel skin painted here, with a
// second "glow" skin so visors, blaster muzzles and gremlin eyes shine in the dark:
// - the rider: a chibi cyclist in a helmet and goggles who leans into the ride, pedals, tucks for jumps and cheers;
// - the bike: a pixel BMX (frame, fork and handlebar that steer, round pixel wheels that spin, a crank that turns,
//   and the handlebar blaster);
// - gremlins: little flying pests with a spinning rotor, wings and big glowing eyes.
// Parts can hang from other parts (an arm from the body, the front wheel from the fork). Everything of one kind is
// drawn together with one instanced mesh per part.
import * as THREE from "three";
import { makeRng, mix, shade } from "./util";

export type RigKind = "rider" | "bike" | "gremlin";
type Role = "body" | "head" | "armL" | "armR" | "legL" | "legR" | "pack" | "wheelR" | "wheelF" | "fork" | "bar" | "gun" | "frame" | "down" | "stay" | "seat" | "post" | "crank" | "rotor" | "wingL" | "wingR";
interface PartDef { role: Role; size: [number, number, number]; uv: [number, number]; pivot: [number, number, number]; off: [number, number, number]; parent?: number; rest?: [number, number, number]; round?: boolean }
export interface RigDef { px: number; parts: PartDef[] }

function packed(parts: PartDef[]): PartDef[] {
  let x = 0, y = 0, row = 0;
  return parts.map((p) => {
    const [w, h, d] = p.size, pw = Math.ceil(2 * (w + d)), ph = Math.ceil(d + h);
    if (x + pw > 64) { x = 0; y += row; row = 0; }
    const out = { ...p, uv: [x, y] as [number, number] };
    x += pw; row = Math.max(row, ph);
    return out;
  });
}
const P0: [number, number] = [0, 0];
// the rider, in pixels (1/16 m): hips at the origin (they sit on the saddle)
const RIDER: PartDef[] = packed([
  { role: "body", size: [8, 8, 5], uv: P0, pivot: [0, 0, 0], off: [-4, 0, -2.5] },
  { role: "head", size: [10, 9, 9], uv: P0, pivot: [0, 8, 0.5], off: [-5, 0, -4.5], parent: 0 },
  { role: "armR", size: [3, 7, 3], uv: P0, pivot: [-5.5, 7, 0], off: [-1.5, -7, -1.5], parent: 0 },
  { role: "armL", size: [3, 7, 3], uv: P0, pivot: [5.5, 7, 0], off: [-1.5, -7, -1.5], parent: 0 },
  { role: "legR", size: [3, 7, 3], uv: P0, pivot: [-2, 0, 0], off: [-1.5, -7, -1.5] },
  { role: "legL", size: [3, 7, 3], uv: P0, pivot: [2, 0, 0], off: [-1.5, -7, -1.5] },
  { role: "pack", size: [6, 5, 2], uv: P0, pivot: [0, 2, -2.5], off: [-3, 0, -2], parent: 0 },
]);
// the bike, in pixels: ground at y = 0, rear axle at z = −9, front axle at z = +9, wheels of radius 5
const BIKE: PartDef[] = packed([
  { role: "wheelR", size: [2, 10, 10], uv: P0, pivot: [0, 5, -9], off: [-1, -5, -5], round: true },
  { role: "fork", size: [1, 9, 1], uv: P0, pivot: [0, 13, 6], off: [-0.5, -9, -0.5], rest: [-0.35, 0, 0] },
  { role: "wheelF", size: [2, 10, 10], uv: P0, pivot: [0, -9, 0], off: [-1, -5, -5], parent: 1, round: true, rest: [0.35, 0, 0] },
  { role: "bar", size: [9, 1, 1], uv: P0, pivot: [0, 1, 0], off: [-4.5, 0, -0.5], parent: 1, rest: [0.35, 0, 0] },
  { role: "gun", size: [2, 2, 6], uv: P0, pivot: [0, 1.2, 0.5], off: [-1, 0, -1], parent: 3 },
  { role: "frame", size: [1, 1, 12], uv: P0, pivot: [0, 11, -5], off: [-0.5, -0.5, 0] },
  { role: "down", size: [1, 1, 11], uv: P0, pivot: [0, 6, -1], off: [-0.5, -0.5, 0], rest: [-0.55, 0, 0] },
  { role: "stay", size: [1, 1, 9], uv: P0, pivot: [0, 5, -9], off: [-0.5, -0.5, 0], rest: [-0.08, 0, 0] },
  { role: "post", size: [1, 6, 1], uv: P0, pivot: [0, 6, -2.5], off: [-0.5, 0, -0.5], rest: [-0.25, 0, 0] },
  { role: "seat", size: [3, 1, 5], uv: P0, pivot: [0, 12.5, -4], off: [-1.5, 0, -2.5] },
  { role: "crank", size: [1, 5, 1], uv: P0, pivot: [0, 5, -1], off: [-0.5, -2.5, -0.5] },
]);
const GREMLIN: PartDef[] = packed([
  { role: "body", size: [8, 7, 7], uv: P0, pivot: [0, 0, 0], off: [-4, -3.5, -3.5] },
  { role: "rotor", size: [12, 1, 2], uv: P0, pivot: [0, 4.5, 0], off: [-6, 0, -1] },
  { role: "wingL", size: [6, 1, 5], uv: P0, pivot: [4, 0.5, 0], off: [0, 0, -2.5] },
  { role: "wingR", size: [6, 1, 5], uv: P0, pivot: [-4, 0.5, 0], off: [-6, 0, -2.5] },
]);
export const RIGS: Record<RigKind, RigDef> = { rider: { px: 0.075, parts: RIDER }, bike: { px: 0.0625, parts: BIKE }, gremlin: { px: 0.08, parts: GREMLIN } };
export const BIKE_INDEX = { wheelR: 0, fork: 1, wheelF: 2, crank: 10 };

// ------------------------------------------------------------------ geometry with skin UVs (faces: left +x, right −x, top, bottom, front +z, back −z)
function partGeometry(p: PartDef, px: number) {
  const [w, h, d] = p.size, [u, v] = p.uv, T = 64;
  const regions: Record<string, [number, number, number, number]> = {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + d + w + d, v + d, w, h],
  };
  const faces: [string, number[], number[], number[], number[]][] = [
    ["left", [1, 0, 0], [1, 0, 1], [0, 0, -1], [0, 1, 0]], ["right", [-1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 0]],
    ["top", [0, 1, 0], [0, 1, 1], [1, 0, 0], [0, 0, -1]], ["bottom", [0, -1, 0], [0, 0, 0], [1, 0, 0], [0, 0, 1]],
    ["front", [0, 0, 1], [0, 0, 1], [1, 0, 0], [0, 1, 0]], ["back", [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0]],
  ];
  const pos: number[] = [], nrm: number[] = [], uvs: number[] = [], idx: number[] = [];
  const e = 0.02;
  for (const [name, n, o, uu, vv] of faces) {
    const [rx, ry, rw, rh] = regions[name];
    const base = pos.length / 3;
    for (const [a, c] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const lx = o[0] + uu[0] * a + vv[0] * c, ly = o[1] + uu[1] * a + vv[1] * c, lz = o[2] + uu[2] * a + vv[2] * c;
      pos.push((p.off[0] + lx * w) * px, (p.off[1] + ly * h) * px, (p.off[2] + lz * d) * px);
      nrm.push(n[0], n[1], n[2]);
      uvs.push((rx + (a ? rw - e : e)) / T, 1 - (ry + (c ? e : rh - e)) / T);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------------ skins
export interface Look { a: string; b: string; c: string; skin: string; glow: string; dark: string }
export const RIDERS: { id: string; name: string; price: number; look: Look }[] = [
  { id: "pip", name: "Pip", price: 0, look: { a: "#FFD23F", b: "#3E8CF0", c: "#2B3048", skin: "#F2C29B", glow: "#7CF5FF", dark: "#161A2A" } },
  { id: "kai", name: "Kai", price: 1200, look: { a: "#FF5A5A", b: "#2B2B33", c: "#3A2A2A", skin: "#C98E6A", glow: "#FFB627", dark: "#151519" } },
  { id: "luna", name: "Luna", price: 2500, look: { a: "#B06CFF", b: "#FF6FB5", c: "#2B2147", skin: "#E8B48E", glow: "#FFE45C", dark: "#1D1630" } },
  { id: "zed", name: "Zed", price: 4000, look: { a: "#2FBF71", b: "#F5C542", c: "#24402E", skin: "#8E5A3E", glow: "#B6FF5C", dark: "#12241A" } },
  { id: "frost", name: "Frost", price: 6500, look: { a: "#F2F7FF", b: "#3E8CF0", c: "#2E4A7A", skin: "#F5D0B5", glow: "#9FF0FF", dark: "#1A2A44" } },
  { id: "nova", name: "Nova", price: 10000, look: { a: "#1E1E24", b: "#FF3DF0", c: "#1E1428", skin: "#E8B48E", glow: "#3DF5FF", dark: "#0E0A14" } },
];

type Paint = (x: number, y: number, w: number, h: number) => string;
class Skin {
  cv = document.createElement("canvas"); ctx: CanvasRenderingContext2D;
  gv = document.createElement("canvas"); gtx: CanvasRenderingContext2D;
  r = makeRng(7);
  constructor(seed: number) {
    this.cv.width = this.cv.height = 64; this.gv.width = this.gv.height = 64;
    this.ctx = this.cv.getContext("2d")!; this.gtx = this.gv.getContext("2d")!;
    this.gtx.fillStyle = "#000"; this.gtx.fillRect(0, 0, 64, 64);
    this.r = makeRng(seed);
  }
  px(x: number, y: number, c: string, glow = false) {
    this.ctx.fillStyle = c; this.ctx.fillRect(x, y, 1, 1);
    if (glow) { this.gtx.fillStyle = c; this.gtx.fillRect(x, y, 1, 1); }
  }
  clear(x: number, y: number) { this.ctx.clearRect(x, y, 1, 1); }
  rect(x: number, y: number, w: number, h: number, f: Paint | string, glow = false) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, typeof f === "string" ? f : f(i, j, w, h), glow);
  }
  part(p: PartDef, base: string, o: { grain?: number; rim?: number; top?: string } = {}) {
    const [w, h, d] = p.size, [u, v] = p.uv;
    const grain = o.grain ?? 0.07, rim = o.rim ?? 0.16;
    const face = (x0: number, y0: number, fw: number, fh: number, c: string, light: number) =>
      this.rect(x0, y0, fw, fh, (i, j) => shade(c, light - (j / Math.max(1, fh)) * 0.14 + (this.r() - 0.5) * grain - (i === 0 || j === 0 || i === fw - 1 || j === fh - 1 ? rim : 0)));
    face(u + d, v, w, d, o.top ?? base, 0.12); face(u + d + w, v, w, d, base, -0.2);
    face(u, v + d, d, h, base, -0.04); face(u + d, v + d, w, h, base, 0.04);
    face(u + d + w, v + d, d, h, base, -0.04); face(u + d + w + d, v + d, w, h, base, -0.08);
  }
  band(p: PartDef, fromTop: number, rows: number, c: string | Paint, glow = false) { const [w, , d] = p.size, [u, v] = p.uv; this.rect(u, v + d + fromTop, 2 * (w + d), rows, c, glow); }
  front(p: PartDef) { const [w, h, d] = p.size, [u, v] = p.uv; return { x: u + d, y: v + d, w, h }; }
  back(p: PartDef) { const [w, h, d] = p.size, [u, v] = p.uv; return { x: u + d + w + d, y: v + d, w, h }; }
  side(p: PartDef, which: "left" | "right") { const [w, h, d] = p.size, [u, v] = p.uv; return which === "right" ? { x: u, y: v + d, w: d, h } : { x: u + d + w, y: v + d, w: d, h }; }
  topFace(p: PartDef) { const [w, , d] = p.size, [u, v] = p.uv; return { x: u + d, y: v, w, h: d }; }
  textures() {
    const t = new THREE.CanvasTexture(this.cv), g = new THREE.CanvasTexture(this.gv);
    for (const x of [t, g]) { x.magFilter = THREE.NearestFilter; x.minFilter = THREE.NearestFilter; x.generateMipmaps = false; x.colorSpace = THREE.SRGBColorSpace; }
    return { map: t, glow: g };
  }
}

/** a round pixel wheel on a square side face: tyre, rim, hub and spokes; everything else is cut away (transparent) */
function wheelSide(s: Skin, x0: number, y0: number, n: number, tyre: string, rimC: string) {
  const c = (n - 1) / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = i - c, dy = j - c, d = Math.hypot(dx, dy);
    const spoke = Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.7;
    if (d > c + 0.5) s.clear(x0 + i, y0 + j);
    else if (d > c - 1.2) s.px(x0 + i, y0 + j, shade(tyre, dy * -0.03));
    else if (d > c - 2.2) s.px(x0 + i, y0 + j, shade(rimC, dy * -0.04));
    else if (d < 1.3) s.px(x0 + i, y0 + j, shade(rimC, 0.25));
    else if (spoke) s.px(x0 + i, y0 + j, shade(rimC, -0.12));
    else s.clear(x0 + i, y0 + j);
  }
}

function paintSkin(kind: RigKind, look: Look, frame: string, seed: number) {
  const s = new Skin(seed);
  const parts = RIGS[kind].parts;
  const by = (role: Role) => parts.find((p) => p.role === role)!;
  const L = look;
  if (kind === "rider") {
    const head = by("head"), body = by("body");
    // a cycling helmet over the hair, goggles that glow, a grin
    s.part(head, L.skin);
    const f = s.front(head);
    s.rect(f.x, f.y, f.w, 3, L.a); s.band(head, 0, 3, (i) => (i % 4 === 0 ? shade(L.a, -0.25) : L.a));
    { const t = s.topFace(head); s.rect(t.x, t.y, t.w, t.h, (i, j) => ((i + j) % 4 === 0 ? shade(L.a, 0.2) : L.a)); s.rect(t.x + Math.floor(t.w / 2) - 1, t.y, 2, t.h, L.b); }
    s.rect(f.x + 1, f.y + 3, f.w - 2, 2, L.dark);
    s.rect(f.x + 2, f.y + 3, 2, 2, L.glow, true); s.rect(f.x + f.w - 4, f.y + 3, 2, 2, L.glow, true);
    s.px(f.x + 2, f.y + 3, "#ffffff", true); s.px(f.x + f.w - 4, f.y + 3, "#ffffff", true);
    s.rect(f.x + 3, f.y + 6, f.w - 6, 1, shade(L.skin, -0.45)); s.px(f.x + 3, f.y + 5, shade(L.skin, -0.35)); s.px(f.x + f.w - 4, f.y + 5, shade(L.skin, -0.35));
    { const b = s.back(head); s.rect(b.x, b.y, b.w, 4, L.a); s.rect(b.x + 1, b.y + 3, b.w - 2, 1, L.dark); s.rect(b.x, b.y + 4, b.w, b.h - 4, shade(L.c, 0.1)); }
    s.part(body, L.b);
    const bf = s.front(body);
    s.rect(bf.x + 3, bf.y + 1, 2, 4, L.a); s.band(body, 6, 1, L.dark);
    { const bb = s.back(body); s.rect(bb.x + 1, bb.y + 2, bb.w - 2, 1, L.a); s.rect(bb.x + 1, bb.y + 4, bb.w - 2, 1, L.a); }
    for (const role of ["armL", "armR"] as Role[]) { const a = by(role); s.part(a, L.b); s.band(a, a.size[1] - 2, 2, L.dark); }
    for (const role of ["legL", "legR"] as Role[]) { const l = by(role); s.part(l, L.c); s.band(l, l.size[1] - 2, 2, "#F5F7FF"); s.band(l, l.size[1] - 1, 1, L.dark); }
    const pack = by("pack"); s.part(pack, "#8E98AA"); s.rect(s.back(pack).x + 1, s.back(pack).y + 1, 4, 2, (i) => (i < 3 ? "#FFB627" : "#3a3a44"));
  } else if (kind === "bike") {
    const tyre = "#1E1E26", rimC = "#C8CED8";
    for (const role of ["wheelR", "wheelF"] as Role[]) {
      const w = by(role);
      s.part(w, tyre, { rim: 0.05 });
      for (const side of ["left", "right"] as const) { const f = s.side(w, side); wheelSide(s, f.x, f.y, f.w, tyre, rimC); }
      // the box's square rolling faces are cut away: only the two round sides show
      const [ww, hh, dd] = w.size, [u, v] = w.uv;
      for (const [x, y, rw, rh] of [[u + dd, v, ww, dd], [u + dd + ww, v, ww, dd], [u + dd, v + dd, ww, hh], [u + dd + ww + dd, v + dd, ww, hh]]) for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) s.clear(x + i, y + j);
    }
    for (const role of ["frame", "down", "stay", "fork"] as Role[]) { const p = by(role); s.part(p, frame, { rim: 0.12 }); s.band(p, 0, 1, shade(frame, 0.25)); }
    s.part(by("post"), "#9AA3B5"); s.part(by("bar"), "#2A2A33"); s.part(by("seat"), "#22222A");
    const g = by("gun"); s.part(g, "#3A3F4E", { rim: 0.2 }); s.band(g, 0, 1, L.a);
    { const f = s.front(g); s.rect(f.x, f.y, f.w, f.h, L.glow, true); }
    s.part(by("crank"), "#B8BEC8");
  } else {
    const c = mix("#7A4FD8", frame, 0.4);
    const body = by("body");
    s.part(body, c, { top: shade(c, 0.15) });
    const f = s.front(body);
    s.rect(f.x + 1, f.y + 1, 2, 3, "#ffffff"); s.rect(f.x + f.w - 3, f.y + 1, 2, 3, "#ffffff");
    s.rect(f.x + 1, f.y + 2, 2, 2, "#FF3D5A", true); s.rect(f.x + f.w - 3, f.y + 2, 2, 2, "#FF3D5A", true);
    s.rect(f.x + 2, f.y + 5, f.w - 4, 1, "#1a0a26"); s.px(f.x + 3, f.y + 6, "#ffffff"); s.px(f.x + f.w - 4, f.y + 6, "#ffffff");
    s.part(by("rotor"), "#C8CED8"); s.part(by("wingL"), shade(c, -0.2)); s.part(by("wingR"), shade(c, -0.2));
  }
  return s.textures();
}

// ------------------------------------------------------------------ instanced drawing and poses
export interface Pose { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; scale: number; rot: Float32Array; r: number; g: number; b: number }
export function newPose(kind: RigKind): Pose { return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1, rot: new Float32Array(RIGS[kind].parts.length * 3), r: 1, g: 1, b: 1 }; }

const _m = new THREE.Matrix4(), _root = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _locals: THREE.Matrix4[] = Array.from({ length: 16 }, () => new THREE.Matrix4());
const _c = new THREE.Color();

export class RigBatch {
  readonly meshes: THREE.InstancedMesh[] = [];
  private n = 0;
  private mat: THREE.MeshLambertMaterial;
  private tex: { map: THREE.Texture; glow: THREE.Texture };
  constructor(readonly kind: RigKind, look: Look, frame: string, readonly cap: number, seed = 1) {
    const def = RIGS[kind];
    this.tex = paintSkin(kind, look, frame, seed);
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex.map, emissiveMap: this.tex.glow, emissive: new THREE.Color("#ffffff"), alphaTest: 0.5, side: THREE.DoubleSide });
    for (const p of def.parts) {
      const m = new THREE.InstancedMesh(partGeometry(p, def.px), this.mat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; m.count = 0; m.castShadow = true;
      m.setColorAt(0, _c.setRGB(1, 1, 1));
      this.meshes.push(m);
    }
  }
  addTo(o: THREE.Object3D) { for (const m of this.meshes) o.add(m); }
  begin() { this.n = 0; }
  push(p: Pose) {
    if (this.n >= this.cap) return;
    const def = RIGS[this.kind];
    _p.set(p.x, p.y, p.z); _e.set(p.pitch, p.yaw, p.roll, "YXZ"); _q.setFromEuler(_e); _s.set(p.scale, p.scale, p.scale);
    _root.compose(_p, _q, _s);
    for (let i = 0; i < def.parts.length; i++) {
      const part = def.parts[i];
      _p.set(part.pivot[0] * def.px, part.pivot[1] * def.px, part.pivot[2] * def.px);
      const rx = (part.rest?.[0] ?? 0) + p.rot[i * 3], ry = (part.rest?.[1] ?? 0) + p.rot[i * 3 + 1], rz = (part.rest?.[2] ?? 0) + p.rot[i * 3 + 2];
      _e.set(rx, ry, rz, "YXZ"); _q.setFromEuler(_e);
      _locals[i].compose(_p, _q, _s.set(1, 1, 1));
      if (part.parent !== undefined) _locals[i].premultiply(_locals[part.parent]);
    }
    for (let i = 0; i < def.parts.length; i++) {
      _m.multiplyMatrices(_root, _locals[i]);
      this.meshes[i].setMatrixAt(this.n, _m);
      this.meshes[i].setColorAt(this.n, _c.setRGB(p.r, p.g, p.b));
    }
    this.n++;
  }
  end() { for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
  dispose() { for (const m of this.meshes) { m.geometry.dispose(); m.removeFromParent(); m.dispose(); } this.mat.dispose(); this.tex.map.dispose(); this.tex.glow.dispose(); }
}

/** the rider on the bike: lean (body forward), pedal phase, steer, a tuck in the air, a cheer at the finish */
export function poseRider(p: Pose, pedal: number, lean: number, tuck: number, cheer: number, t: number) {
  const R = p.rot; R.fill(0);
  // body leaning toward the bars
  R[0] = 0.45 + lean * 0.25 + tuck * 0.35;
  // head up to see the road
  R[3] = -0.35 - tuck * 0.2;
  // arms reaching the handlebar
  R[2 * 3] = -1.15 - tuck * 0.1; R[3 * 3] = -1.15 - tuck * 0.1;
  R[2 * 3 + 2] = -0.12; R[3 * 3 + 2] = 0.12;
  // legs on the pedals: opposite phases
  R[4 * 3] = -0.95 + Math.sin(pedal) * 0.55 - tuck * 0.4;
  R[5 * 3] = -0.95 + Math.sin(pedal + Math.PI) * 0.55 - tuck * 0.4;
  if (cheer > 0) {
    R[0] = 0.05;
    R[2 * 3] = Math.PI - 0.4 + Math.sin(t * 9) * 0.25; R[2 * 3 + 2] = -0.35;
    R[3 * 3] = Math.PI - 0.4 + Math.cos(t * 9) * 0.25; R[3 * 3 + 2] = 0.35;
    R[3] = 0.15;
  }
}
export function poseBike(p: Pose, wheel: number, steer: number, crank: number) {
  const R = p.rot; R.fill(0);
  R[BIKE_INDEX.wheelR * 3] = wheel;
  R[BIKE_INDEX.wheelF * 3] = wheel;
  R[BIKE_INDEX.fork * 3 + 1] = steer;
  R[BIKE_INDEX.crank * 3] = crank;
}
export function poseGremlin(p: Pose, t: number) {
  const R = p.rot; R.fill(0);
  R[1 * 3 + 1] = t * 28;
  const f = Math.sin(t * 16) * 0.7;
  R[2 * 3 + 2] = f; R[3 * 3 + 2] = -f;
}
