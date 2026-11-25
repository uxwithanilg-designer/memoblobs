// Cube Clash's pixel characters: avatars (you and every rival) with tall blocky proportions, a jetpack and a cube
// blaster, dressed in outfits (a hoodie, an astronaut suit, cat ears, a ninja gi, a pirate bandana, armour, a robot
// shell, a wizard robe) or in their team's colours; and the night mobs — shambling moss zombies, wobbling jelly
// hoppers, floating wisps and the giant crowned Titans. Each character is a set of box parts wrapped in a 64×64 pixel
// skin painted here (plus a glow skin for eyes, visors and flames), drawn together per kind with one instanced mesh
// per part, posed every frame from its walk cycle, aim, attack and cheer timers.
import * as THREE from "three";
import { clamp, makeRng, mix, shade } from "./util";

export type RigKind = "avatar" | "shambler" | "hopper" | "wisp" | "titan";
type Role = "body" | "head" | "armL" | "armR" | "legL" | "legR" | "gun" | "pack" | "top" | "flame";
interface PartDef { role: Role; size: [number, number, number]; uv: [number, number]; pivot: [number, number, number]; off: [number, number, number]; parent?: number }
export interface RigDef { px: number; parts: PartDef[]; height: number; radius: number }

// a tall blocky body (pixels): legs 10, body 10, head 9 → 29 px
const human = (o: { head?: [number, number, number]; body?: [number, number, number]; arm?: [number, number, number]; leg?: [number, number, number] } = {}): PartDef[] => {
  const head = o.head ?? [9, 9, 9], body = o.body ?? [8, 10, 5], arm = o.arm ?? [3, 10, 3], leg = o.leg ?? [4, 10, 4];
  const hip = leg[1], neck = leg[1] + body[1], sh = neck - 0.5;
  return [
    { role: "legR", size: leg, uv: [0, 0], pivot: [-body[0] / 4, hip, 0], off: [-leg[0] / 2, -leg[1], -leg[2] / 2] },
    { role: "legL", size: leg, uv: [0, 0], pivot: [body[0] / 4, hip, 0], off: [-leg[0] / 2, -leg[1], -leg[2] / 2] },
    { role: "body", size: body, uv: [0, 0], pivot: [0, hip, 0], off: [-body[0] / 2, 0, -body[2] / 2] },
    { role: "head", size: head, uv: [0, 0], pivot: [0, neck, 0], off: [-head[0] / 2, 0, -head[2] / 2] },
    { role: "armR", size: arm, uv: [0, 0], pivot: [-body[0] / 2 - arm[0] / 2, sh, 0], off: [-arm[0] / 2, -arm[1], -arm[2] / 2] },
    { role: "armL", size: arm, uv: [0, 0], pivot: [body[0] / 2 + arm[0] / 2, sh, 0], off: [-arm[0] / 2, -arm[1], -arm[2] / 2] },
  ];
};
const ARM_R = 4, HEAD = 3;
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
const rig = (px: number, height: number, radius: number, parts: PartDef[]): RigDef => ({ px, height, radius, parts: packed(parts) });
const TOP = (h = 2): PartDef => ({ role: "top", size: [9, h, 9], uv: [0, 0], pivot: [0, 9, 0], off: [-4.5, 0, -4.5], parent: HEAD });
export const RIGS: Record<RigKind, RigDef> = {
  avatar: rig(0.062, 1.8, 0.34, [
    ...human(), TOP(),
    { role: "pack", size: [6, 7, 3], uv: [0, 0], pivot: [0, 11, -2.5], off: [-3, 0, -3] },
    { role: "gun", size: [2, 7, 3], uv: [0, 0], pivot: [0, -8.5, 0.5], off: [-1, -6, -1.5], parent: ARM_R },
  ]),
  shambler: rig(0.062, 1.8, 0.36, [...human({ arm: [3, 11, 3] }), TOP()]),
  hopper: rig(0.075, 0.75, 0.42, [{ role: "body", size: [10, 10, 10], uv: [0, 0], pivot: [0, 0, 0], off: [-5, 0, -5] }, { role: "top", size: [6, 2, 6], uv: [0, 0], pivot: [0, 10, 0], off: [-3, 0, -3] }]),
  wisp: rig(0.07, 0.9, 0.38, [
    { role: "body", size: [7, 8, 7], uv: [0, 0], pivot: [0, 0, 0], off: [-3.5, -4, -3.5] },
    { role: "flame", size: [5, 5, 5], uv: [0, 0], pivot: [0, 4, 0], off: [-2.5, 0, -2.5] },
    { role: "armR", size: [2, 5, 2], uv: [0, 0], pivot: [-4.5, 1, 0], off: [-1, -5, -1] },
    { role: "armL", size: [2, 5, 2], uv: [0, 0], pivot: [4.5, 1, 0], off: [-1, -5, -1] },
  ]),
  titan: rig(0.2, 6.4, 1.7, [...human({ body: [14, 11, 8], arm: [5, 13, 5], leg: [5, 9, 5] }), TOP(3)]),
};

// ------------------------------------------------------------------ geometry with skin UVs (classic layout, facing +z)
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

// ------------------------------------------------------------------ outfits
export type Style = "hoodie" | "astro" | "ninja" | "knight" | "robo" | "kitty" | "pirate" | "wizard";
/** a: main colour, b: second colour, c: trousers, skin, hair, glow (visors, eyes, flames), dark: trims */
export interface SkinLook { style: Style; a: string; b: string; c: string; skin: string; hair: string; glow: string; dark: string }
export const OUTFITS: { id: string; name: string; price: number; look: SkinLook }[] = [
  { id: "rookie", name: "Rookie", price: 0, look: { style: "hoodie", a: "#3D8BFF", b: "#FFC83D", c: "#2E3A5E", skin: "#F2C29B", hair: "#6B4226", glow: "#7CF5FF", dark: "#1A2340" } },
  { id: "astro", name: "Astro", price: 1200, look: { style: "astro", a: "#F2F5FA", b: "#FF8A3D", c: "#C8D0DC", skin: "#E8B48E", hair: "#3A2A1E", glow: "#7FD0FF", dark: "#5A6478" } },
  { id: "kitty", name: "Kitty", price: 2000, look: { style: "kitty", a: "#FF8AC0", b: "#FFFFFF", c: "#5A4E8E", skin: "#F5D0B5", hair: "#FF8AC0", glow: "#FFE45C", dark: "#3A2A4E" } },
  { id: "ninja", name: "Shadow", price: 3500, look: { style: "ninja", a: "#22222C", b: "#E8343A", c: "#1A1A22", skin: "#D9A07A", hair: "#14141A", glow: "#FF4D5E", dark: "#0E0E14" } },
  { id: "pirate", name: "Corsair", price: 5000, look: { style: "pirate", a: "#E8402E", b: "#FFFFFF", c: "#3A2A1E", skin: "#D9A07A", hair: "#2A1A12", glow: "#FFD23F", dark: "#14100C" } },
  { id: "knight", name: "Paladin", price: 7500, look: { style: "knight", a: "#B8C2D0", b: "#3D8BFF", c: "#7A8494", skin: "#E8B48E", hair: "#4A3A2A", glow: "#FFE45C", dark: "#3A404E" } },
  { id: "robo", name: "Robo", price: 11000, look: { style: "robo", a: "#8E98AA", b: "#38D96B", c: "#5A6274", skin: "#8E98AA", hair: "#5A6274", glow: "#38D96B", dark: "#2E3440" } },
  { id: "wizard", name: "Starlock", price: 16000, look: { style: "wizard", a: "#6A3FC8", b: "#FFD23F", c: "#3A2A6E", skin: "#F2C29B", hair: "#E8E8F0", glow: "#FFD23F", dark: "#241A48" } },
];
/** a rival's look: a random outfit in its team's colour (or a random colour) */
export function rivalLook(seed: number, teamColor: string | null): SkinLook {
  const r = makeRng(seed);
  const base = OUTFITS[Math.floor(r() * OUTFITS.length)].look;
  const hairs = ["#6B4226", "#2A1A12", "#E8C070", "#C0502A", "#14141A", "#E8E8F0"], skins = ["#F2C29B", "#E8B48E", "#D9A07A", "#C98E6A", "#A86E4E", "#F5D0B5"];
  const a = teamColor ?? ["#FF4D5E", "#38D96B", "#FFC83D", "#B06CFF", "#FF8A3D", "#2EC4B6"][Math.floor(r() * 6)];
  const metal = base.style === "robo" || base.style === "knight";
  return { ...base, a: metal ? base.a : a, b: metal ? a : base.b, skin: skins[Math.floor(r() * skins.length)], hair: hairs[Math.floor(r() * hairs.length)] };
}

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
  px(x: number, y: number, c: string, glow = false) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, 1, 1); if (glow) { this.gtx.fillStyle = c; this.gtx.fillRect(x, y, 1, 1); } }
  rect(x: number, y: number, w: number, h: number, f: Paint | string, glow = false) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, typeof f === "string" ? f : f(i, j, w, h), glow); }
  /** a whole part, every face softly shaded (light above, darker below) with a gentle pixel rim — the clean toy look */
  part(p: PartDef, base: string, o: { grain?: number; rim?: number; top?: string; bottom?: string; glow?: boolean } = {}) {
    const [w, h, d] = p.size, [u, v] = p.uv, grain = o.grain ?? 0.03, rim = o.rim ?? 0.1;
    const face = (x0: number, y0: number, fw: number, fh: number, c: string, light: number) => this.rect(x0, y0, fw, fh, (i, j) => {
      const edge = i === 0 || j === 0 || i === fw - 1 || j === fh - 1;
      return shade(c, light - (j / Math.max(1, fh)) * 0.1 + (this.r() - 0.5) * grain - (edge ? rim : 0));
    }, o.glow);
    face(u + d, v, w, d, o.top ?? base, 0.1); face(u + d + w, v, w, d, o.bottom ?? base, -0.18);
    face(u, v + d, d, h, base, -0.03); face(u + d, v + d, w, h, base, 0.04); face(u + d + w, v + d, d, h, base, -0.03); face(u + d + w + d, v + d, w, h, base, -0.06);
  }
  band(p: PartDef, fromTop: number, rows: number, c: string | Paint, glow = false) { const [w, , d] = p.size, [u, v] = p.uv; this.rect(u, v + d + fromTop, 2 * (w + d), rows, c, glow); }
  front(p: PartDef) { const [w, h, d] = p.size, [u, v] = p.uv; return { x: u + d, y: v + d, w, h }; }
  back(p: PartDef) { const [w, h, d] = p.size, [u, v] = p.uv; return { x: u + d + w + d, y: v + d, w, h }; }
  topFace(p: PartDef) { const [w, , d] = p.size, [u, v] = p.uv; return { x: u + d, y: v, w, h: d }; }
  bottomFace(p: PartDef) { const [w, , d] = p.size, [u, v] = p.uv; return { x: u + d + w, y: v, w, h: d }; }
  textures() {
    const t = new THREE.CanvasTexture(this.cv), g = new THREE.CanvasTexture(this.gv);
    for (const x of [t, g]) { x.magFilter = THREE.NearestFilter; x.minFilter = THREE.NearestFilter; x.generateMipmaps = false; x.colorSpace = THREE.SRGBColorSpace; }
    return { map: t, glow: g };
  }
}

function paintSkin(kind: RigKind, look: SkinLook, tint: string, seed: number) {
  const s = new Skin(seed);
  const P = RIGS[kind].parts;
  const by = (role: Role) => P.find((p) => p.role === role)!;
  const L = look;
  if (kind === "avatar") {
    const head = by("head"), body = by("body"), top = by("top"), pack = by("pack"), gun = by("gun");
    const f = s.front(head);
    const face = () => {
      s.part(head, L.skin);
      for (const ex of [f.x + 2, f.x + f.w - 4]) { s.rect(ex, f.y + 4, 2, 2, "#1d1d2a"); s.px(ex, f.y + 4, "#ffffff"); }
      s.rect(f.x + 2, f.y + 3, 2, 1, shade(L.hair, -0.1)); s.rect(f.x + f.w - 4, f.y + 3, 2, 1, shade(L.hair, -0.1));
      s.rect(f.x + 3, f.y + 7, f.w - 6, 1, shade(L.skin, -0.35)); s.px(f.x + 2, f.y + 6, shade(L.skin, -0.3)); s.px(f.x + f.w - 3, f.y + 6, shade(L.skin, -0.3));
      s.px(f.x + 1, f.y + 6, mix(L.skin, "#FF7A8A", 0.35)); s.px(f.x + f.w - 2, f.y + 6, mix(L.skin, "#FF7A8A", 0.35));
      s.band(head, 0, 2, L.hair); s.rect(f.x, f.y, f.w, 2, L.hair);
      const b = s.back(head); s.rect(b.x, b.y, b.w, 5, L.hair);
      const tf = s.topFace(head); s.rect(tf.x, tf.y, tf.w, tf.h, shade(L.hair, 0.05));
    };
    switch (L.style) {
      case "astro": {
        s.part(head, L.a); s.rect(f.x + 1, f.y + 2, f.w - 2, 5, (i, j) => (i === 1 && j < 2 ? "#ffffff" : shade(L.glow, -0.1 - j * 0.04)), true);
        s.part(top, shade(L.a, -0.04)); s.part(body, L.a); const bf = s.front(body); s.rect(bf.x + 2, bf.y + 2, 4, 3, L.b); s.px(bf.x + 3, bf.y + 3, L.glow, true);
        break;
      }
      case "ninja": {
        face(); s.rect(f.x, f.y, f.w, 3, L.a); s.rect(f.x, f.y + 6, f.w, 3, L.a); s.band(head, 2, 1, L.b);
        s.part(top, L.a); s.part(body, L.a); s.band(body, 6, 1, L.b);
        break;
      }
      case "knight": {
        s.part(head, L.a); s.rect(f.x + 1, f.y + 4, f.w - 2, 1, "#14141c"); s.rect(f.x + 4, f.y + 3, 1, 4, "#14141c");
        s.part(top, L.b, { top: shade(L.b, 0.1) }); s.part(body, L.a); const bf = s.front(body); s.rect(bf.x + 2, bf.y + 1, 4, 5, L.b); s.rect(bf.x + 3, bf.y + 2, 2, 3, L.glow);
        break;
      }
      case "robo": {
        s.part(head, L.a, { rim: 0.16 }); s.rect(f.x + 1, f.y + 3, f.w - 2, 2, "#14141c"); s.rect(f.x + 2, f.y + 3, 2, 2, L.glow, true); s.rect(f.x + f.w - 4, f.y + 3, 2, 2, L.glow, true);
        s.rect(f.x + 2, f.y + 6, f.w - 4, 1, (i) => (i % 2 ? L.glow : "#14141c"), true);
        s.part(top, L.dark); const tt = s.topFace(top); s.px(tt.x + 4, tt.y + 4, L.glow, true);
        s.part(body, L.a, { rim: 0.16 }); const bf = s.front(body); s.rect(bf.x + 2, bf.y + 2, 4, 3, L.b, true);
        break;
      }
      case "kitty": {
        face(); s.rect(f.x, f.y, f.w, 2, L.a); s.band(head, 0, 2, L.a);
        s.part(top, L.a); const tf = s.front(top); s.rect(tf.x, tf.y, 2, 2, "#FFFFFF"); s.rect(tf.x + tf.w - 2, tf.y, 2, 2, "#FFFFFF");
        s.part(body, L.a); const bf = s.front(body); s.rect(bf.x + 2, bf.y + 3, 4, 3, L.b); s.band(body, 9, 1, shade(L.a, -0.2));
        break;
      }
      case "pirate": {
        face(); s.band(head, 0, 3, L.a); s.rect(f.x, f.y, f.w, 3, L.a); s.rect(f.x + f.w - 4, f.y + 4, 2, 2, "#14100c");
        s.part(top, L.a); s.part(body, L.b); s.band(body, 0, 10, (_i, j) => (j % 3 === 0 ? L.a : L.b)); s.band(body, 7, 1, L.dark);
        break;
      }
      case "wizard": {
        face(); s.part(top, L.a, { top: L.b }); const tf = s.topFace(top); s.px(tf.x + 4, tf.y + 4, L.glow, true);
        s.part(body, L.a); const bf = s.front(body); s.px(bf.x + 2, bf.y + 2, L.glow, true); s.px(bf.x + 5, bf.y + 6, L.glow, true); s.band(body, 8, 2, L.b);
        s.rect(f.x + 1, f.y + 6, f.w - 2, 3, L.hair);
        break;
      }
      default: { // hoodie
        face(); s.part(top, L.hair, { top: shade(L.hair, 0.08) });
        s.part(body, L.a); const bf = s.front(body); s.rect(bf.x + 2, bf.y + 5, 4, 3, shade(L.a, -0.15)); s.px(bf.x + 3, bf.y + 1, L.b); s.px(bf.x + 4, bf.y + 1, L.b); s.band(body, 9, 1, shade(L.a, -0.2));
        const hb = s.back(body); s.rect(hb.x + 1, hb.y, hb.w - 2, 3, shade(L.a, -0.12));
      }
    }
    for (const role of ["armL", "armR"] as Role[]) { const a = by(role); s.part(a, L.a); s.band(a, a.size[1] - 2, 2, L.style === "robo" ? L.dark : L.style === "astro" ? L.b : L.skin); }
    for (const role of ["legL", "legR"] as Role[]) { const l = by(role); s.part(l, L.c); s.band(l, l.size[1] - 2, 2, L.dark); }
    // the jetpack (it runs on oil) and the cube blaster
    s.part(pack, "#9AA4B8", { rim: 0.14 }); const pf = s.back(pack); s.rect(pf.x + 1, pf.y + 1, 4, 2, (i) => (i < 3 ? "#FFB627" : "#3a3a44")); s.band(pack, 5, 1, L.b);
    const pb = s.bottomFace(pack); s.rect(pb.x, pb.y, pb.w, pb.h, "#FF8A3D", true);
    s.part(gun, "#3A3F4E", { rim: 0.16 }); s.band(gun, 1, 1, L.b); s.band(gun, 4, 1, L.b);
    const gb = s.bottomFace(gun); s.rect(gb.x, gb.y, gb.w, gb.h, L.glow, true);
  } else if (kind === "shambler" || kind === "titan") {
    const skin = kind === "titan" ? mix("#8A9478", tint, 0.2) : mix("#7CC46C", tint, 0.35), cloth = kind === "titan" ? shade(skin, -0.25) : mix("#4E6E9E", tint, 0.3);
    const eye = kind === "titan" ? "#FFE45C" : "#FF4D5E";
    const head = by("head"), body = by("body"), top = by("top");
    s.part(head, skin, { grain: 0.08 }); const f = s.front(head);
    s.rect(f.x + 2, f.y + 3, 2, 2, eye, true); s.rect(f.x + f.w - 4, f.y + 3, 2, 2, eye, true);
    s.rect(f.x + 3, f.y + 6, f.w - 6, 2, "#2a0e1a"); s.px(f.x + 3, f.y + 6, "#F5F0E0"); s.px(f.x + f.w - 4, f.y + 6, "#F5F0E0");
    s.part(top, kind === "titan" ? "#FFC83D" : shade(skin, -0.15), { top: kind === "titan" ? "#FFE27A" : undefined });
    if (kind === "titan") { const tf = s.front(top); for (let i = 0; i < tf.w; i += 2) s.px(tf.x + i, tf.y, "#FF4D5E", true); }
    s.part(body, cloth, { grain: 0.08 });
    const bf = s.front(body);
    for (let k = 0; k < 6; k++) s.px(bf.x + Math.floor(s.r() * bf.w), bf.y + Math.floor(s.r() * bf.h), shade(cloth, -0.3));
    if (kind === "titan") s.rect(bf.x + 5, bf.y + 3, 4, 4, (i, j) => (i === 1 && j === 1 ? "#ffffff" : eye), true);
    for (const role of ["armL", "armR"] as Role[]) { const a = by(role); s.part(a, skin, { grain: 0.08 }); s.band(a, 0, 3, cloth); }
    for (const role of ["legL", "legR"] as Role[]) s.part(by(role), shade(cloth, -0.15));
    if (kind === "titan") for (const p of P) { const [w, h, d] = p.size, [u, v] = p.uv; for (let j = 2; j < h; j += 3) s.rect(u, v + d + j, 2 * (w + d), 1, (i) => ((i + j) % 5 === 0 ? shade(skin, -0.3) : shade(skin, 0.02))); }
  } else if (kind === "hopper") {
    const c = mix("#5EE07A", tint, 0.35), p = P[0];
    s.part(p, c, { top: shade(c, 0.12), rim: 0.14 }); const f = s.front(p);
    s.rect(f.x + 1, f.y + 3, 3, 3, "#ffffff"); s.rect(f.x + 6, f.y + 3, 3, 3, "#ffffff");
    s.rect(f.x + 2, f.y + 4, 2, 2, "#14241a"); s.rect(f.x + 7, f.y + 4, 2, 2, "#14241a");
    s.rect(f.x + 3, f.y + 7, 4, 1, "#14241a");
    s.part(P[1], shade(c, 0.18));
  } else if (kind === "wisp") {
    const c = mix("#7CC8FF", tint, 0.3);
    s.part(P[0], c, { glow: true, rim: 0.05 }); const f = s.front(P[0]);
    s.rect(f.x + 1, f.y + 2, 2, 2, "#14142a", true); s.rect(f.x + 4, f.y + 2, 2, 2, "#14142a", true); s.rect(f.x + 2, f.y + 5, 3, 1, "#14142a", true);
    s.part(P[1], mix(c, "#ffffff", 0.45), { glow: true });
    s.part(P[2], shade(c, -0.1), { glow: true }); s.part(P[3], shade(c, -0.1), { glow: true });
  }
  return s.textures();
}

// ------------------------------------------------------------------ instanced drawing
export interface Pose {
  x: number; y: number; z: number; yaw: number; scale: number;
  /** per part [rx, ry, rz] */
  rot: Float32Array;
  /** root bob (m) and squash (y scale) */
  bob: number; squash: number;
  /** tint multiplier (1,1,1 = normal; >1 flashes white) */
  r: number; g: number; b: number;
}
export function newPose(kind: RigKind): Pose { return { x: 0, y: 0, z: 0, yaw: 0, scale: 1, rot: new Float32Array(RIGS[kind].parts.length * 3), bob: 0, squash: 1, r: 1, g: 1, b: 1 }; }

const _m = new THREE.Matrix4(), _root = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _locals: THREE.Matrix4[] = Array.from({ length: 12 }, () => new THREE.Matrix4());
const _c = new THREE.Color();

export class RigBatch {
  readonly meshes: THREE.InstancedMesh[] = [];
  private n = 0;
  private mat: THREE.MeshLambertMaterial;
  private tex: { map: THREE.Texture; glow: THREE.Texture };
  constructor(readonly kind: RigKind, look: SkinLook, tint: string, readonly cap: number, seed = 1) {
    const def = RIGS[kind];
    this.tex = paintSkin(kind, look, tint, seed);
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex.map, emissiveMap: this.tex.glow, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1 });
    for (const p of def.parts) {
      const m = new THREE.InstancedMesh(partGeometry(p, def.px), this.mat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.castShadow = true;
      m.setColorAt(0, _c.setRGB(1, 1, 1));
      this.meshes.push(m);
    }
  }
  addTo(o: THREE.Object3D) { for (const m of this.meshes) o.add(m); }
  begin() { this.n = 0; }
  push(p: Pose) {
    if (this.n >= this.cap) return;
    const def = RIGS[this.kind];
    _p.set(p.x, p.y + p.bob, p.z); _q.setFromAxisAngle(_s.set(0, 1, 0), p.yaw); _s.set(p.scale, p.scale * p.squash, p.scale);
    _root.compose(_p, _q, _s);
    for (let i = 0; i < def.parts.length; i++) {
      const part = def.parts[i];
      _p.set(part.pivot[0] * def.px, part.pivot[1] * def.px, part.pivot[2] * def.px);
      _e.set(p.rot[i * 3], p.rot[i * 3 + 1], p.rot[i * 3 + 2], "YXZ"); _q.setFromEuler(_e);
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
  end() {
    for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  dispose() {
    for (const m of this.meshes) { m.geometry.dispose(); m.removeFromParent(); m.dispose(); }
    this.mat.dispose(); this.tex.map.dispose(); this.tex.glow.dispose();
  }
}

// ------------------------------------------------------------------ poses
/** a humanoid: walking (phase, amount 0..1), aiming (pitch), a melee swing (0..1), cheering, and arms out (zombies) */
export function poseHuman(p: Pose, kind: RigKind, walk: number, amt: number, aim: number | null, atk: number, cheer = 0, t = 0, reach = false) {
  const parts = RIGS[kind].parts, R = p.rot;
  R.fill(0);
  const sw = Math.sin(walk) * 0.9 * amt;
  for (let i = 0; i < parts.length; i++) {
    const role = parts[i].role;
    if (role === "legL") R[i * 3] = sw;
    else if (role === "legR") R[i * 3] = -sw;
    else if (role === "armL") { R[i * 3] = -sw * 0.8; R[i * 3 + 2] = 0.08; }
    else if (role === "armR") { R[i * 3] = sw * 0.8; R[i * 3 + 2] = -0.08; }
    else if (role === "head") R[i * 3] = Math.sin(walk * 2) * 0.04 * amt;
  }
  const iR = parts.findIndex((q) => q.role === "armR"), iL = parts.findIndex((q) => q.role === "armL"), iH = parts.findIndex((q) => q.role === "head");
  if (reach) { R[iR * 3] = -1.35 + Math.sin(walk) * 0.15; R[iL * 3] = -1.35 - Math.sin(walk) * 0.15; }
  if (aim !== null) {
    R[iR * 3] = -Math.PI / 2 - aim; R[iR * 3 + 1] = 0.12; R[iR * 3 + 2] = 0;
    R[iL * 3] = -Math.PI / 2 - aim * 0.9 + 0.2; R[iL * 3 + 1] = -0.6; R[iL * 3 + 2] = 0.2;
    R[iH * 3] = -aim * 0.5;
  }
  if (atk > 0) {
    const k = atk < 0.4 ? atk / 0.4 : 1 - (atk - 0.4) / 0.6;
    R[iR * 3] = -2.4 * k; R[iL * 3] = -1.2 * k;
  }
  if (cheer > 0) {
    R[iR * 3] = Math.PI - 0.3 + Math.sin(t * 10) * 0.2; R[iR * 3 + 2] = -0.3;
    R[iL * 3] = Math.PI - 0.3 + Math.cos(t * 10) * 0.2; R[iL * 3 + 2] = 0.3;
    p.bob += Math.abs(Math.sin(t * 7)) * 0.15;
  }
  p.bob += Math.abs(Math.sin(walk)) * 0.05 * amt;
}
export function poseWisp(p: Pose, t: number) {
  const R = p.rot; R.fill(0);
  R[2 * 3] = -0.6 + Math.sin(t * 5) * 0.4; R[3 * 3] = -0.6 + Math.cos(t * 5) * 0.4;
  R[1 * 3 + 1] = t * 3;
  p.bob = Math.sin(t * 2.6) * 0.18;
}
export function poseHopper(p: Pose, hop: number) {
  const h = clamp(hop, 0, 1);
  p.squash = h < 0.15 ? 1 - (0.15 - h) * 2.2 : h > 0.85 ? 1 - (h - 0.85) * 2.2 : 1 + Math.sin(h * Math.PI) * 0.15;
}
