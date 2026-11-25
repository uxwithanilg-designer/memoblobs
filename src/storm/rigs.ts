// Blockstorm's pixel characters. Each one is a set of box parts (head, body, arms, legs, wings, a blaster, a bomb…)
// wrapped in a 64×64 pixel skin painted here, with a second "glow" skin so eyes, visors and cores shine in the dark.
// Characters of one kind are drawn together (one instanced mesh per part), so a whole swarm costs a handful of draw
// calls. Poses are built every frame from each actor's walk cycle, aim, attack and hurt timers.
import * as THREE from "three";
import { clamp, makeRng, mix, shade } from "./util";

export type RigKind = "hero" | "grumbler" | "cubeling" | "batbit" | "spitter" | "fusebug" | "brute" | "golem" | "archer" | "knight" | "brawler";
type Role = "body" | "head" | "armL" | "armR" | "legL" | "legR" | "gun" | "wingL" | "wingR" | "pack" | "bomb" | "fuse" | "leg" | "tool";
interface PartDef { role: Role; size: [number, number, number]; uv: [number, number]; pivot: [number, number, number]; off: [number, number, number]; parent?: number }
export interface RigDef { px: number; parts: PartDef[]; height: number; radius: number }

// a classic chibi humanoid (pixels): legs 6, body 7, head 9 → 22 px tall
const human = (o: { head?: [number, number, number]; body?: [number, number, number]; arm?: [number, number, number]; leg?: [number, number, number] } = {}): PartDef[] => {
  const head = o.head ?? [10, 9, 9], body = o.body ?? [8, 7, 5], arm = o.arm ?? [3, 7, 3], leg = o.leg ?? [3, 6, 3];
  const hip = leg[1], neck = leg[1] + body[1], sh = neck - 0.5;
  return [
    { role: "legR", size: leg, uv: [0, 32], pivot: [-body[0] / 4, hip, 0], off: [-leg[0] / 2, -leg[1], -leg[2] / 2] },
    { role: "legL", size: leg, uv: [16, 32], pivot: [body[0] / 4, hip, 0], off: [-leg[0] / 2, -leg[1], -leg[2] / 2] },
    { role: "body", size: body, uv: [0, 18], pivot: [0, hip, 0], off: [-body[0] / 2, 0, -body[2] / 2] },
    { role: "head", size: head, uv: [0, 0], pivot: [0, neck, 0], off: [-head[0] / 2, 0, -head[2] / 2] },
    { role: "armR", size: arm, uv: [32, 32], pivot: [-body[0] / 2 - arm[0] / 2, sh, 0], off: [-arm[0] / 2, -arm[1], -arm[2] / 2] },
    { role: "armL", size: arm, uv: [48, 32], pivot: [body[0] / 2 + arm[0] / 2, sh, 0], off: [-arm[0] / 2, -arm[1], -arm[2] / 2] },
  ];
};
const ARM_R = 4, ARM_L = 5;
/** lay every part's skin out on the 64×64 sheet, row by row (the uv given in a part is just a placeholder) */
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
export const RIGS: Record<RigKind, RigDef> = {
  // the hero's blaster hangs from the hand along the arm, so it points wherever the arm aims
  hero: rig(0.08, 1.76, 0.36, [...human(), { role: "pack", size: [6, 6, 3], uv: [0, 0], pivot: [0, 7, -2.5], off: [-3, 0, -3] }, { role: "gun", size: [2, 8, 3], uv: [0, 0], pivot: [0, -5.5, 0.5], off: [-1, -7, -1.5], parent: ARM_R }]),
  archer: rig(0.075, 1.6, 0.34, [...human(), { role: "tool", size: [1, 11, 2], uv: [0, 0], pivot: [0, -6, 0], off: [-0.5, -5.5, 0], parent: ARM_L }]),
  knight: rig(0.08, 1.76, 0.38, [...human({ body: [9, 7, 6] }), { role: "tool", size: [1, 2, 11], uv: [0, 0], pivot: [0, -6.5, 0], off: [-0.5, -1, -1], parent: ARM_R }]),
  brawler: rig(0.078, 1.7, 0.38, human({ arm: [4, 7, 4] })),
  grumbler: rig(0.078, 1.72, 0.36, human({ head: [9, 9, 9] })),
  spitter: rig(0.078, 1.75, 0.38, human({ head: [11, 10, 10], arm: [3, 8, 3] })),
  brute: rig(0.12, 2.7, 0.75, human({ head: [9, 8, 8], body: [11, 8, 7], arm: [5, 9, 5], leg: [4, 6, 4] })),
  golem: rig(0.2, 5.4, 1.5, human({ head: [9, 8, 8], body: [14, 10, 8], arm: [5, 12, 5], leg: [5, 7, 5] })),
  cubeling: rig(0.072, 0.72, 0.38, [{ role: "body", size: [10, 10, 10], uv: [0, 0], pivot: [0, 0, 0], off: [-5, 0, -5] }]),
  batbit: rig(0.075, 0.5, 0.4, [
    { role: "body", size: [7, 6, 6], uv: [0, 0], pivot: [0, 0, 0], off: [-3.5, -3, -3] },
    { role: "wingL", size: [9, 1, 6], uv: [0, 0], pivot: [3.5, 1, 0], off: [0, 0, -3] },
    { role: "wingR", size: [9, 1, 6], uv: [0, 0], pivot: [-3.5, 1, 0], off: [-9, 0, -3] },
  ]),
  fusebug: {
    px: 0.08, height: 0.9, radius: 0.45, parts: packed([
      { role: "body", size: [8, 5, 10], uv: [0, 0], pivot: [0, 2, 0], off: [-4, 0, -5] },
      { role: "head", size: [6, 4, 4], uv: [36, 0], pivot: [0, 3.5, 5], off: [-3, -1.5, 0] },
      { role: "leg", size: [1, 3, 1], uv: [56, 0], pivot: [-4, 3, 3], off: [-1, -3, -0.5] },
      { role: "leg", size: [1, 3, 1], uv: [56, 0], pivot: [4, 3, 3], off: [0, -3, -0.5] },
      { role: "leg", size: [1, 3, 1], uv: [56, 0], pivot: [-4, 3, -3], off: [-1, -3, -0.5] },
      { role: "leg", size: [1, 3, 1], uv: [56, 0], pivot: [4, 3, -3], off: [0, -3, -0.5] },
      { role: "bomb", size: [5, 5, 5], uv: [0, 32], pivot: [0, 7, -1], off: [-2.5, 0, -2.5] },
      { role: "fuse", size: [1, 3, 1], uv: [56, 8], pivot: [0, 12, -1], off: [-0.5, 0, -0.5] },
    ]),
  },
};

// ------------------------------------------------------------------ geometry with skin UVs
// box faces in the classic skin layout (facing +z): top, bottom, right(−x), front(+z), left(+x), back(−z)
function partGeometry(p: PartDef, px: number) {
  const [w, h, d] = p.size, [u, v] = p.uv, T = 64;
  const regions: Record<string, [number, number, number, number]> = {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + d + w + d, v + d, w, h],
  };
  const faces: [string, number[], number[], number[], number[]][] = [
    ["left", [1, 0, 0], [1, 0, 1], [0, 0, -1], [0, 1, 0]],
    ["right", [-1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 0]],
    ["top", [0, 1, 0], [0, 1, 1], [1, 0, 0], [0, 0, -1]],
    ["bottom", [0, -1, 0], [0, 0, 0], [1, 0, 0], [0, 0, 1]],
    ["front", [0, 0, 1], [0, 0, 1], [1, 0, 0], [0, 1, 0]],
    ["back", [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0]],
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
export interface SkinLook { a: string; b: string; c: string; skin: string; glow: string; dark: string }
export const HERO_SKINS: { id: string; name: string; price: number; look: SkinLook }[] = [
  { id: "rook", name: "Rook", price: 0, look: { a: "#FF8A3D", b: "#21B3A6", c: "#243046", skin: "#F2C29B", glow: "#7CF5FF", dark: "#1B2236" } },
  { id: "nova", name: "Nova", price: 1500, look: { a: "#B06CFF", b: "#FF6FB5", c: "#2B2147", skin: "#E8B48E", glow: "#FFE45C", dark: "#1D1630" } },
  { id: "ember", name: "Ember", price: 3000, look: { a: "#E8402E", b: "#2B2B33", c: "#3A2A2A", skin: "#D9A07A", glow: "#FFB627", dark: "#151519" } },
  { id: "frost", name: "Frost", price: 5000, look: { a: "#F2F7FF", b: "#3E8CF0", c: "#2E4A7A", skin: "#F5D0B5", glow: "#9FF0FF", dark: "#1A2A44" } },
  { id: "jade", name: "Jade", price: 8000, look: { a: "#2FBF71", b: "#F5C542", c: "#24402E", skin: "#C98E6A", glow: "#B6FF5C", dark: "#12241A" } },
  { id: "gold", name: "Midas", price: 15000, look: { a: "#FFD23F", b: "#1E1E24", c: "#3A3020", skin: "#E8B48E", glow: "#FF5CE1", dark: "#121216" } },
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
  rect(x: number, y: number, w: number, h: number, f: Paint | string, glow = false) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, typeof f === "string" ? f : f(i, j, w, h), glow);
  }
  /** a whole part: every face shaded (lighter on top, darker below), a darker pixel rim and a little grain */
  part(p: PartDef, base: string, o: { grain?: number; rim?: number; bottom?: string; top?: string } = {}) {
    const [w, h, d] = p.size, [u, v] = p.uv;
    const grain = o.grain ?? 0.07, rim = o.rim ?? 0.16;
    const shadeFace = (x0: number, y0: number, fw: number, fh: number, c: string, light: number) =>
      this.rect(x0, y0, fw, fh, (i, j) => {
        const edge = i === 0 || j === 0 || i === fw - 1 || j === fh - 1;
        return shade(c, light - (j / Math.max(1, fh)) * 0.14 + (this.r() - 0.5) * grain - (edge ? rim : 0));
      });
    shadeFace(u + d, v, w, d, o.top ?? base, 0.12);
    shadeFace(u + d + w, v, w, d, o.bottom ?? base, -0.2);
    shadeFace(u, v + d, d, h, base, -0.04);
    shadeFace(u + d, v + d, w, h, base, 0.04);
    shadeFace(u + d + w, v + d, d, h, base, -0.04);
    shadeFace(u + d + w + d, v + d, w, h, base, -0.08);
  }
  /** the four side faces of a part as one strip (for bands that wrap around: belts, boots, cuffs) */
  band(p: PartDef, fromTop: number, rows: number, c: string | Paint, glow = false) {
    const [w, h, d] = p.size, [u, v] = p.uv;
    void h;
    this.rect(u, v + d + fromTop, 2 * (w + d), rows, c, glow);
  }
  front(p: PartDef) { const [w, h, d] = p.size, [u, v] = p.uv; return { x: u + d, y: v + d, w, h }; }
  topFace(p: PartDef) { const [w, , d] = p.size, [u, v] = p.uv; return { x: u + d, y: v, w, h: d }; }
  textures() {
    const t = new THREE.CanvasTexture(this.cv), g = new THREE.CanvasTexture(this.gv);
    for (const x of [t, g]) { x.magFilter = THREE.NearestFilter; x.minFilter = THREE.NearestFilter; x.generateMipmaps = false; x.colorSpace = THREE.SRGBColorSpace; }
    return { map: t, glow: g };
  }
}

/** paint a character's skin. `tint` recolours monsters for their world; `look` dresses the hero and the friends */
function paintSkin(kind: RigKind, look: SkinLook, tint: string, seed: number) {
  const s = new Skin(seed);
  const P = RIGS[kind].parts;
  const by = (role: Role) => P.find((p) => p.role === role)!;
  const eyes = (p: PartDef, y: number, col: string, gap = 2, sz = 2, pupil?: string, glow = true) => {
    const f = s.front(p), cx = f.x + f.w / 2;
    const lx = Math.round(cx - gap / 2 - sz), rx = Math.round(cx + gap / 2);
    s.rect(lx, f.y + y, sz, sz, col, glow); s.rect(rx, f.y + y, sz, sz, col, glow);
    if (pupil) { s.px(lx + sz - 1, f.y + y + sz - 1, pupil); s.px(rx, f.y + y + sz - 1, pupil); }
  };
  switch (kind) {
    case "hero": case "archer": case "knight": case "brawler": {
      const L = look;
      const head = by("head"), body = by("body");
      if (kind === "hero") {
        // helmet with a glowing visor, the lower face showing
        s.part(head, L.a, { top: shade(L.a, 0.1) });
        const f = s.front(head);
        s.rect(f.x + 1, f.y + 2, f.w - 2, 3, (i) => (i === 1 || i === 2 ? "#ffffff" : shade(L.glow, -0.05 - (i % 3) * 0.05)), true);
        s.rect(f.x + 2, f.y + 5, f.w - 4, 3, (i, j) => shade(L.skin, -j * 0.06));
        s.px(f.x + 4, f.y + 6, shade(L.skin, -0.45)); s.px(f.x + 5, f.y + 6, shade(L.skin, -0.45)); s.px(f.x + 3, f.y + 6, shade(L.skin, -0.35));
        s.band(head, 2, 3, (_i, j) => (j === 0 ? shade(L.a, -0.14) : j === 1 ? shade(L.b, 0.12) : L.b));
        { // the back of the helmet: a racing stripe in the suit colour and a small badge
          const [w, h, d] = head.size, [u, v] = head.uv, bx = u + d + w + d, by = v + d, mid = Math.floor(w / 2);
          s.rect(bx, by, w, h, (i, j) => (i === 0 || i === w - 1 || j === h - 1 ? shade(L.a, -0.28) : shade(L.a, -0.04 - j * 0.02 + (s.r() - 0.5) * 0.04)));
          s.rect(bx, by + 2, w, 1, shade(L.a, -0.14)); s.rect(bx, by + 3, w, 1, shade(L.b, 0.12)); s.rect(bx, by + 4, w, 1, L.b);
          s.rect(bx + mid - 1, by + 6, 2, 2, shade(L.a, 0.3)); s.rect(bx + 1, by + h - 2, w - 2, 1, L.dark); }
        s.rect(f.x + 1, f.y + 2, f.w - 2, 3, (i) => (i === 1 || i === 2 ? "#ffffff" : shade(L.glow, -0.05 - (i % 3) * 0.05)), true);
        const t = s.topFace(head); s.rect(t.x + 4, t.y + 1, 2, t.h - 2, shade(L.b, 0.1));
      } else {
        s.part(head, L.skin);
        const f = s.front(head);
        s.rect(f.x + 2, f.y + 4, 2, 2, "#1d1d2a"); s.rect(f.x + f.w - 4, f.y + 4, 2, 2, "#1d1d2a");
        s.px(f.x + 2, f.y + 4, "#ffffff"); s.px(f.x + f.w - 4, f.y + 4, "#ffffff");
        s.rect(f.x + 4, f.y + 7, f.w - 8, 1, shade(L.skin, -0.4));
        if (kind === "archer") { s.band(head, 0, 3, shade(L.a, -0.05)); s.rect(s.topFace(head).x, s.topFace(head).y, 10, 9, L.a); s.rect(f.x, f.y, f.w, 3, L.a); }
        if (kind === "knight") { s.part(head, "#B8C2D0"); s.rect(f.x + 1, f.y + 4, f.w - 2, 1, "#1a1a24"); s.rect(f.x + 4, f.y + 3, 2, 4, "#1a1a24"); const t = s.topFace(head); s.rect(t.x + 4, t.y, 2, t.h, L.a); }
        if (kind === "brawler") { s.band(head, 1, 2, L.a); s.rect(f.x, f.y + 1, f.w, 2, L.a); }
      }
      s.part(body, L.b);
      const bf = s.front(body);
      s.band(body, 5, 1, L.dark);
      s.px(bf.x + 3, bf.y + 5, "#FFD23F"); s.px(bf.x + 4, bf.y + 5, "#FFD23F");
      if (kind === "hero") { s.rect(bf.x + 3, bf.y + 1, 2, 3, L.a); s.px(bf.x + 4, bf.y + 1, "#ffffff"); }
      if (kind === "knight") { s.part(body, "#9AA6B8"); s.rect(bf.x + 2, bf.y + 1, 5, 4, L.a); }
      for (const role of ["armL", "armR"] as Role[]) {
        const a = by(role);
        s.part(a, kind === "knight" ? "#9AA6B8" : L.b);
        s.band(a, a.size[1] - 2, 2, kind === "brawler" ? "#E23B3B" : L.skin);
      }
      for (const role of ["legL", "legR"] as Role[]) {
        const l = by(role);
        s.part(l, L.c);
        s.band(l, l.size[1] - 2, 2, L.dark);
      }
      const pack = P.find((p) => p.role === "pack");
      if (pack) { s.part(pack, "#8E98AA"); const f = s.front(pack); s.rect(f.x + 1, f.y + 1, 4, 2, (i) => (i < 3 ? "#FFB627" : "#3a3a44")); s.band(pack, 4, 1, L.a); }
      const gun = P.find((p) => p.role === "gun");
      if (gun) {
        s.part(gun, "#3A3F4E", { rim: 0.2 });
        s.band(gun, 2, 1, L.a); s.band(gun, 5, 1, L.a);
        // the muzzle (the far end, the box's bottom) glows
        const [w, , d] = gun.size, [u, v] = gun.uv;
        s.rect(u + d + w, v, w, d, L.glow, true);
      }
      const tool = P.find((p) => p.role === "tool");
      if (tool) s.part(tool, kind === "archer" ? "#8A5A35" : "#D8E0EC", { rim: 0.1 });
      break;
    }
    case "grumbler": case "spitter": case "brute": case "golem": {
      const skin = kind === "golem" ? mix("#8C8F98", tint, 0.25) : kind === "brute" ? mix("#7E7A92", tint, 0.35) : kind === "spitter" ? mix("#B8C85A", tint, 0.3) : mix("#6EB86A", tint, 0.42);
      const cloth = kind === "golem" ? shade(skin, -0.2) : mix("#5A3E7A", tint, 0.4);
      const eye = kind === "golem" ? "#FF5CE1" : kind === "spitter" ? "#FFE45C" : "#FF4F6A";
      const head = by("head"), body = by("body");
      s.part(head, skin, { grain: 0.12 });
      const f = s.front(head);
      eyes(head, kind === "spitter" ? 2 : 3, eye, kind === "spitter" ? 1 : 2, 2, kind === "spitter" ? "#1a1a1a" : undefined);
      // brows and mouths
      if (kind === "spitter") { s.rect(f.x + 2, f.y + 6, f.w - 4, 3, "#2a0e1a"); for (let i = 0; i < f.w - 4; i += 2) s.px(f.x + 2 + i, f.y + 6, "#F5F0E0"); s.rect(f.x + 3, f.y + 8, f.w - 6, 1, "#7CFF3A"); }
      else { s.rect(f.x + 2, f.y + 2, f.w - 4, 1, shade(skin, -0.45)); s.rect(f.x + 3, f.y + 6, f.w - 6, 1, "#2a0e1a"); s.px(f.x + 3, f.y + 6, "#F5F0E0"); s.px(f.x + f.w - 4, f.y + 6, "#F5F0E0"); }
      if (kind === "golem" || kind === "brute") { // cracks that glow
        for (let k = 0; k < 6; k++) { const x = s.r() * 60, y = s.r() * 40; s.px(Math.floor(x), Math.floor(y), eye, true); }
      }
      s.part(body, cloth, { grain: 0.1 });
      const bf = s.front(body);
      if (kind === "golem") { s.rect(bf.x + Math.floor(bf.w / 2) - 2, bf.y + 3, 4, 4, (i, j) => (i === 1 && j === 1 ? "#ffffff" : eye), true); }
      else { for (let k = 0; k < 5; k++) s.px(bf.x + Math.floor(s.r() * bf.w), bf.y + Math.floor(s.r() * bf.h), shade(cloth, -0.35)); s.band(body, body.size[1] - 1, 1, shade(cloth, -0.3)); }
      for (const role of ["armL", "armR"] as Role[]) { const a = by(role); s.part(a, skin, { grain: 0.12 }); if (kind !== "golem") s.band(a, 0, 3, cloth); }
      for (const role of ["legL", "legR"] as Role[]) { const l = by(role); s.part(l, kind === "golem" ? shade(skin, -0.12) : shade(cloth, -0.18)); s.band(l, l.size[1] - 1, 1, shade(skin, -0.3)); }
      if (kind === "golem") {
        // carved stone: brick seams on every part, moss on the shoulders and head, glowing cracks
        const moss = mix("#5E9E3A", tint, 0.2);
        for (const part of P) {
          const [w, h, d] = part.size, [u, v] = part.uv, W2 = 2 * (w + d);
          for (let j = 0; j < h; j++) for (let i = 0; i < W2; i++) {
            const row = Math.floor(j / 3), seam = j % 3 === 2 || (i + (row % 2) * 3) % 6 === 0;
            if (seam) s.px(u + i, v + d + j, shade(skin, -0.32));
            else if (j < 2 && part.role !== "legL" && part.role !== "legR" && s.r() < 0.55) s.px(u + i, v + d + j, shade(moss, (s.r() - 0.5) * 0.2));
          }
          const t = s.topFace(part);
          if (part.role !== "legL" && part.role !== "legR") s.rect(t.x, t.y, t.w, t.h, () => (s.r() < 0.8 ? shade(moss, (s.r() - 0.5) * 0.25) : shade(skin, -0.1)));
        }
        const hf = s.front(by("head"));
        s.rect(hf.x + 1, hf.y + 2, hf.w - 2, 1, shade(skin, -0.5));
        eyes(by("head"), 3, eye, 2, 2);
        s.rect(hf.x + 3, hf.y + 6, hf.w - 6, 1, eye, true);
        const bf2 = s.front(body);
        s.rect(bf2.x + Math.floor(bf2.w / 2) - 2, bf2.y + 3, 4, 4, (i, j) => (i === 1 && j === 1 ? "#ffffff" : eye), true);
        for (let k = 0; k < 10; k++) { const x0 = bf2.x + Math.floor(s.r() * bf2.w), y0 = bf2.y + Math.floor(s.r() * bf2.h); s.px(x0, y0, eye, true); }
      }
      break;
    }
    case "cubeling": {
      const c = mix("#8E5CFF", tint, 0.45);
      const p = P[0];
      s.part(p, c, { grain: 0.05, rim: 0.12, top: shade(c, 0.15) });
      const f = s.front(p);
      s.rect(f.x + 1, f.y + 3, 3, 3, "#ffffff"); s.rect(f.x + 6, f.y + 3, 3, 3, "#ffffff");
      s.rect(f.x + 2, f.y + 4, 2, 2, "#1a0a26", true); s.rect(f.x + 7, f.y + 4, 2, 2, "#1a0a26", true);
      s.px(f.x + 2, f.y + 4, "#FF5CE1", true); s.px(f.x + 7, f.y + 4, "#FF5CE1", true);
      s.rect(f.x + 3, f.y + 7, 4, 1, "#2a0e2a"); s.px(f.x + 4, f.y + 8, "#FF7AB6");
      for (let k = 0; k < 14; k++) s.px(Math.floor(s.r() * 40), Math.floor(s.r() * 20), shade(c, 0.25));
      break;
    }
    case "batbit": {
      const c = mix("#3A2A5A", tint, 0.3);
      s.part(P[0], c, { grain: 0.1 });
      const f = s.front(P[0]);
      s.px(f.x + 1, f.y + 2, "#FF3D5A", true); s.px(f.x + 5, f.y + 2, "#FF3D5A", true);
      s.px(f.x + 2, f.y + 4, "#ffffff"); s.px(f.x + 4, f.y + 4, "#ffffff");
      s.part(P[1], shade(c, -0.15), { rim: 0.25 }); s.part(P[2], shade(c, -0.15), { rim: 0.25 });
      break;
    }
    case "fusebug": {
      const c = mix("#4A4E66", tint, 0.3);
      s.part(P[0], c, { grain: 0.08, top: shade(c, 0.1) });
      const t = s.topFace(P[0]); s.rect(t.x + 3, t.y, 2, t.h, mix("#FF5CE1", tint, 0.2), true);
      s.part(P[1], shade(c, -0.1));
      const f = s.front(P[1]); s.px(f.x + 1, f.y + 1, "#FFE45C", true); s.px(f.x + 4, f.y + 1, "#FFE45C", true);
      for (let k = 2; k <= 5; k++) s.part(P[k], shade(c, -0.3));
      s.part(P[6], "#22222A", { rim: 0.1 }); s.band(P[6], 2, 1, "#FFC83D");
      s.part(P[7], "#FFB627", {}); s.band(P[7], 0, 1, "#FFFFFF", true);
      { const tf = s.topFace(P[7]); s.rect(tf.x, tf.y, tf.w, tf.h, "#FFFFFF", true); }
      break;
    }
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
/** fill a pose's part rotations for a humanoid: walking (phase, amount 0..1), aiming (pitch), attacking (0..1), and cheering */
export function poseHuman(p: Pose, kind: RigKind, walk: number, amt: number, aim: number | null, atk: number, cheer = 0, t = 0) {
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
  if (aim !== null) {
    // blaster up: right arm points where you aim, the left steadies it
    R[iR * 3] = -Math.PI / 2 - aim; R[iR * 3 + 1] = 0.12; R[iR * 3 + 2] = 0;
    R[iL * 3] = -Math.PI / 2 - aim * 0.9 + 0.2; R[iL * 3 + 1] = -0.6; R[iL * 3 + 2] = 0.2;
    R[iH * 3] = -aim * 0.5;
  }
  if (atk > 0) {
    // a swing: wind up, then strike
    const k = atk < 0.4 ? atk / 0.4 : 1 - (atk - 0.4) / 0.6;
    R[iR * 3] = -2.4 * k + (atk > 0.4 ? 1.6 * (1 - k) * 0.5 : 0);
    R[iL * 3] = -1.2 * k;
  }
  if (cheer > 0) {
    R[iR * 3] = Math.PI - 0.3 + Math.sin(t * 10) * 0.2; R[iR * 3 + 2] = -0.3;
    R[iL * 3] = Math.PI - 0.3 + Math.cos(t * 10) * 0.2; R[iL * 3 + 2] = 0.3;
    p.bob += Math.abs(Math.sin(t * 7)) * 0.15;
  }
  p.bob += Math.abs(Math.sin(walk)) * 0.05 * amt;
}
export function poseBat(p: Pose, t: number) {
  const R = p.rot; R.fill(0);
  const f = Math.sin(t * 22) * 0.9;
  R[1 * 3 + 2] = f; R[2 * 3 + 2] = -f;
  p.bob = Math.sin(t * 3) * 0.12;
}
export function poseBug(p: Pose, walk: number, amt: number, fuse: number) {
  const R = p.rot; R.fill(0);
  for (let k = 0; k < 4; k++) R[(2 + k) * 3] = Math.sin(walk + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI / 2 : 0)) * 0.7 * amt;
  R[1 * 3] = Math.sin(walk * 0.5) * 0.08;
  p.squash = 1 + fuse * 0.08 * Math.sin(fuse * 40);
}
export function poseCube(p: Pose, hop: number) {
  // hop: 0..1 through a jump; squash on take-off and landing
  const h = clamp(hop, 0, 1);
  p.squash = h < 0.15 ? 1 - (0.15 - h) * 2 : h > 0.85 ? 1 - (h - 0.85) * 2 : 1 + Math.sin(h * Math.PI) * 0.12;
}
