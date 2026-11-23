// Blob Brigade renderer (three.js). Reads the Sim every frame and draws it with instanced meshes: one draw call for
// all brigade blobs, two for all near Grumpies, one for far ones, one for every bubble, tile, label and confetti.
import * as THREE from "three";
import { antialiasFor, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import type { Sim, Block, Boss } from "./sim";
import { BUBBLE_R, POWER_LIST, TIER_R, WALL_END } from "./sim";
import { HALF } from "./levels";
import * as M from "./models";
import type { SimEvent, ThemeId } from "./types";
import { POWERUPS, type Look } from "./leaders";

export type Quality = "low" | "medium" | "high";

interface ThemeLook {
  fog: string; hemiSky: string; hemiGround: string; sun: string;
  floor: () => THREE.Texture; side: () => THREE.Texture;
  wall: string; wallTop: string; kerb: string;
  rec: [string, string]; bonus: [string, string];
  grump: string; helmet: string; speedy: string; jelly: string;
  /** spooky: dim lights and a glow around the brigade */
  dark?: boolean;
}

const LOOKS: Record<ThemeId, ThemeLook> = {
  garden: {
    fog: "#D8F0DD", hemiSky: "#FFFFFF", hemiGround: "#86B86E", sun: "#FFF4DD",
    floor: () => noiseTex("#D9D5CC", "#C9C4B9", "#E6E2DA", 256, 0.9), side: () => noiseTex("#5DB653", "#4A9E43", "#73C766", 256, 1.4),
    wall: "#BCB6AA", wallTop: "#D4CFC4", kerb: "#C8C2B6", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#8F86B8", helmet: "#8F86B8", speedy: "#7FA0C8", jelly: "#67D97A",
  },
  candy: {
    fog: "#FFE4F1", hemiSky: "#FFFFFF", hemiGround: "#FFB8D6", sun: "#FFF0F6",
    floor: () => checkerTex("#FFE7F1", "#FFD1E5", 256), side: () => sprinkleTex("#FFC6DE", 256),
    wall: "#6B3E26", wallTop: "#8C5536", kerb: "#FFFFFF", rec: ["#21C6A8", "#6BE3CC"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#9A86C4", helmet: "#9A86C4", speedy: "#7FA0C8", jelly: "#67D97A",
  },
  snow: {
    fog: "#E3F2FF", hemiSky: "#FFFFFF", hemiGround: "#B8D8F0", sun: "#FFFFFF",
    floor: () => streakTex("#D6ECFF", "#FFFFFF", "#B8DBF5"), side: () => noiseTex("#F4F8FF", "#DDE8F5", "#FFFFFF", 256, 1.4),
    wall: "#9FC6E8", wallTop: "#D6ECFF", kerb: "#FFFFFF", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#8F86B8", helmet: "#8F86B8", speedy: "#7FA0C8", jelly: "#67D97A",
  },
  toy: {
    fog: "#FFF0DC", hemiSky: "#FFFFFF", hemiGround: "#E8C49A", sun: "#FFF4E0",
    floor: () => plankTex("#E3B07A", "#C98F55"), side: () => checkerTex("#FF8FA8", "#7FB2FF", 256),
    wall: "#FF5F7E", wallTop: "#FFD23F", kerb: "#3D8BFF", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#8F86B8", helmet: "#8F86B8", speedy: "#7FA0C8", jelly: "#67D97A",
  },
  beach: {
    fog: "#CFF3FF", hemiSky: "#FFFFFF", hemiGround: "#F2DDA8", sun: "#FFF4D6",
    floor: () => noiseTex("#F2DFAE", "#E3CB8E", "#FFF0C8", 256, 1.0), side: () => noiseTex("#3CC8D8", "#2BAFC2", "#7FE3EE", 256, 1.6),
    wall: "#B88A5A", wallTop: "#D9AE7A", kerb: "#FFFFFF", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#8F86B8", helmet: "#8F86B8", speedy: "#7FA0C8", jelly: "#67D97A",
  },
  spooky: {
    fog: "#2A2045", hemiSky: "#7C6BC4", hemiGround: "#2A2340", sun: "#B9A8FF",
    floor: () => brickTex("#4A4262", "#3A3350", 3), side: () => noiseTex("#2E3B2A", "#253021", "#3A4A33", 256, 1.4),
    wall: "#5A4E70", wallTop: "#6E6288", kerb: "#5A4E70", rec: ["#6B4CFF", "#8F78FF"], bonus: ["#FF8A1F", "#FFB347"],
    grump: "#A99BD6", helmet: "#A99BD6", speedy: "#8FB0D8", jelly: "#7FE38A", dark: true,
  },
  jungle: {
    fog: "#D3EBC2", hemiSky: "#FFFFF0", hemiGround: "#7FA860", sun: "#FFF6D8",
    floor: () => brickTex("#A9AE96", "#8A8F7A", 2), side: () => noiseTex("#3E8F3A", "#2E7A2E", "#5FAE4A", 256, 1.6),
    wall: "#8A8F7A", wallTop: "#A9AE96", kerb: "#7A7F6A", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#8F86B8", helmet: "#8F86B8", speedy: "#7FA0C8", jelly: "#67D97A",
  },
  lava: {
    fog: "#4A2218", hemiSky: "#FFB38A", hemiGround: "#4A1A10", sun: "#FFC49A",
    floor: () => crackTex("#3C302C", "#FF6A1F"), side: () => crackTex("#2A1A16", "#FF4A10"),
    wall: "#2E2422", wallTop: "#4A3A34", kerb: "#2E2422", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#9A8FC0", helmet: "#9A8FC0", speedy: "#8FB0D8", jelly: "#67D97A",
  },
  space: {
    fog: "#141A3A", hemiSky: "#C9D6FF", hemiGround: "#2A3060", sun: "#E6ECFF",
    floor: () => brickTex("#A7AEC6", "#8A92AE", 2), side: () => starTex(),
    wall: "#6C7A99", wallTop: "#8FE3FF", kerb: "#6C7A99", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#A99BD6", helmet: "#A99BD6", speedy: "#8FB0D8", jelly: "#67D97A",
  },
  castle: {
    fog: "#EADBC8", hemiSky: "#FFFFFF", hemiGround: "#A8988A", sun: "#FFF2DE",
    floor: () => brickTex("#C2B4A6", "#A8988A", 4), side: () => noiseTex("#5DA04A", "#4A8A3A", "#73B862", 256, 1.4),
    wall: "#A33A3A", wallTop: "#C9A227", kerb: "#8A7A6A", rec: ["#2F6BFF", "#5C8EFF"], bonus: ["#FFB81C", "#FFD45C"],
    grump: "#8F86B8", helmet: "#8F86B8", speedy: "#7FA0C8", jelly: "#67D97A",
  },
};

// ------------------------------------------------------------------ canvas textures
function canvas(n: number) { const c = document.createElement("canvas"); c.width = c.height = n; return c; }
function texOf(c: HTMLCanvasElement, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function noiseTex(base: string, dark: string, light: string, n: number, dot: number) {
  const c = canvas(n), g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  for (let i = 0; i < n * 6; i++) { g.fillStyle = Math.random() < 0.5 ? dark : light; g.globalAlpha = 0.35; const r = Math.random() * 2 * dot + 0.5; g.fillRect(Math.random() * n, Math.random() * n, r, r); }
  g.globalAlpha = 1;
  return texOf(c);
}
function checkerTex(a: string, b: string, n: number) {
  const c = canvas(n), g = c.getContext("2d")!, s = n / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * s, y * s, s, s); }
  g.globalAlpha = 0.12; for (let i = 0; i < 400; i++) { g.fillStyle = "#ffffff"; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
  g.globalAlpha = 1;
  return texOf(c);
}
function sprinkleTex(base: string, n: number) {
  const c = canvas(n), g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  const cols = ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF", "#B26BFF", "#FFFFFF"];
  for (let i = 0; i < 160; i++) {
    g.save(); g.translate(Math.random() * n, Math.random() * n); g.rotate(Math.random() * 3.14);
    g.fillStyle = cols[i % cols.length]; g.beginPath(); g.roundRect(-5, -1.6, 10, 3.2, 1.6); g.fill(); g.restore();
  }
  return texOf(c);
}
function streakTex(base: string, a: string, b: string) {
  const c = canvas(256), g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.strokeStyle = i % 2 ? a : b; g.globalAlpha = 0.5; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + 30 + Math.random() * 60, y + (Math.random() - 0.5) * 10); g.stroke(); }
  g.globalAlpha = 1;
  return texOf(c);
}
function plankTex(a: string, b: string) {
  const c = canvas(256), g = c.getContext("2d")!;
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 64, 0, 64, 256); g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(i * 64, 0, 3, 256); }
  for (let i = 0; i < 30; i++) { g.strokeStyle = "rgba(90,50,20,0.18)"; g.beginPath(); const x = Math.random() * 256; g.moveTo(x, Math.random() * 256); g.lineTo(x + (Math.random() - 0.5) * 8, Math.random() * 256); g.stroke(); }
  return texOf(c);
}
function brickTex(a: string, b: string, n: number) {
  const c = canvas(256), g = c.getContext("2d")!, s = 256 / n;
  g.fillStyle = b; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = a; g.globalAlpha = 0.85 + Math.random() * 0.15;
    g.beginPath(); g.roundRect(x * s + ((y % 2) * s) / 2 + 3, y * s + 3, s - 6, s - 6, 8); g.fill();
    if (x === n - 1 && y % 2) { g.beginPath(); g.roundRect(-s / 2 + 3, y * s + 3, s - 6, s - 6, 8); g.fill(); }
  }
  g.globalAlpha = 1;
  return texOf(c);
}
function crackTex(base: string, glow: string) {
  const c = canvas(256), g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = glow; g.lineWidth = 2.5; g.shadowColor = glow; g.shadowBlur = 8;
  for (let i = 0; i < 9; i++) { g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
  g.shadowBlur = 0;
  return texOf(c);
}
function starTex() {
  const c = canvas(256), g = c.getContext("2d")!;
  g.fillStyle = "#151B40"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) { g.fillStyle = ["#FFFFFF", "#B9C8FF", "#FFE9A8"][i % 3]; g.globalAlpha = 0.4 + Math.random() * 0.6; const r = Math.random() * 1.8 + 0.4; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  return texOf(c);
}
function stripeTex(a: string, b: string) {
  const c = canvas(128), g = c.getContext("2d")!;
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  g.fillStyle = b;
  for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(0, k * 64 + 40); g.lineTo(64, k * 64 + 8); g.lineTo(128, k * 64 + 40); g.lineTo(128, k * 64 + 64); g.lineTo(64, k * 64 + 32); g.lineTo(0, k * 64 + 64); g.closePath(); g.fill(); }
  return texOf(c);
}
function shadowTex() {
  const c = canvas(64), g = c.getContext("2d")!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(20,10,40,0.42)"); gr.addColorStop(0.6, "rgba(20,10,40,0.2)"); gr.addColorStop(1, "rgba(20,10,40,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** text labels for tiles live in one 8×8 atlas, drawn on demand */
class Atlas {
  c = canvas(1024); g = this.c.getContext("2d")!; tex = new THREE.CanvasTexture(this.c);
  cells = new Map<string, number>(); next = 0;
  constructor() { this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4; }
  cell(text: string, coin = false): number {
    const k = text + (coin ? "c" : "");
    const have = this.cells.get(k);
    if (have !== undefined) return have;
    const i = this.next++ % 64;
    for (const [kk, v] of this.cells) if (v === i) this.cells.delete(kk);
    const x = (i % 8) * 128, y = Math.floor(i / 8) * 128, g = this.g;
    g.clearRect(x, y, 128, 128);
    g.save(); g.translate(x + 64, y + 64);
    g.font = `900 ${text.length > 3 ? 46 : 58}px "Lilita One", "Arial Black", system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    if (coin) {
      g.fillStyle = "#FFC21A"; g.strokeStyle = "#B7770B"; g.lineWidth = 6;
      g.beginPath(); g.arc(-26, 0, 22, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = "#FFE48A"; g.beginPath(); g.arc(-31, -6, 7, 0, Math.PI * 2); g.fill();
      g.lineWidth = 10; g.strokeStyle = "#7A4A00"; g.strokeText(text, 22, 4); g.fillStyle = "#FFFFFF"; g.fillText(text, 22, 4);
    } else {
      g.lineWidth = 12; g.strokeStyle = "rgba(10,20,70,0.85)"; g.strokeText(text, 0, 4);
      g.fillStyle = "#FFFFFF"; g.fillText(text, 0, 4);
    }
    g.restore();
    this.tex.needsUpdate = true;
    this.cells.set(k, i);
    return i;
  }
  /** a power-up tile: its emoji on a white badge */
  icon(emoji: string): number {
    const k = `pw:${emoji}`;
    const have = this.cells.get(k);
    if (have !== undefined) return have;
    const i = this.next++ % 64;
    for (const [kk, v] of this.cells) if (v === i) this.cells.delete(kk);
    const x = (i % 8) * 128, y = Math.floor(i / 8) * 128, g = this.g;
    g.clearRect(x, y, 128, 128);
    g.save(); g.translate(x + 64, y + 64);
    g.fillStyle = "#FFFFFF"; g.strokeStyle = "rgba(10,20,70,0.55)"; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 50, 0, Math.PI * 2); g.fill(); g.stroke();
    g.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", system-ui, sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, 0, 5);
    g.restore();
    this.tex.needsUpdate = true;
    this.cells.set(k, i);
    return i;
  }
}

// ------------------------------------------------------------------ instanced helpers
function inst(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, color = false) {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false; m.count = 0;
  if (color) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  return m;
}
/** writes a translate · rotateY · scale matrix straight into an instance buffer */
function put(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, s: number, sy = s, ry = 0, sz = s) {
  const a = m.instanceMatrix.array as Float32Array, o = i * 16, c = Math.cos(ry), n = Math.sin(ry);
  a[o] = c * s; a[o + 1] = 0; a[o + 2] = -n * s; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = n * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}
function putFlat(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sz: number) {
  // a ground decal: plane rotated to lie flat (−90° about X)
  const a = m.instanceMatrix.array as Float32Array, o = i * 16;
  a[o] = sx; a[o + 1] = 0; a[o + 2] = 0; a[o + 3] = 0;
  a[o + 4] = 0; a[o + 5] = 0; a[o + 6] = -sz; a[o + 7] = 0;
  a[o + 8] = 0; a[o + 9] = 1; a[o + 10] = 0; a[o + 11] = 0;
  a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
}
const setCol = (m: THREE.InstancedMesh, i: number, c: THREE.Color) => { const a = m.instanceColor!.array as Float32Array; a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; };
const done = (...ms: THREE.InstancedMesh[]) => { for (const m of ms) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };

const TIER_COLOR = ["#FF8A3D", "#FF7A2E", "#FF6A26", "#FF5A3C"].map((c) => new THREE.Color(c));
const CONFETTI = ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF", "#B26BFF", "#FF8A3D", "#FFFFFF"].map((c) => new THREE.Color(c));
const WHITE = new THREE.Color("#FFFFFF");
const GOO = new THREE.Color("#FF4D6D"), ZAP = new THREE.Color("#FFD23F"), CAKE = new THREE.Color("#FF7AB6");
const GOO_BALL = new THREE.Color("#6BD35A"), CAKE_BALL = new THREE.Color("#FFE3F0");
const CHILL = new THREE.Color("#9FD8FF");
const BOMB_RING: Record<string, THREE.Color> = { goo: GOO, zap: ZAP, cake: CAKE, snow: new THREE.Color("#5FB8F5"), lava: new THREE.Color("#FF7A1F"), rock: new THREE.Color("#FFB347"), cannon: new THREE.Color("#FF4D6D") };
const BOMB_BALL: Record<string, THREE.Color> = { goo: GOO_BALL, zap: ZAP, cake: CAKE_BALL, snow: new THREE.Color("#FFFFFF"), lava: new THREE.Color("#FF5A1F"), rock: new THREE.Color("#7A6656"), cannon: new THREE.Color("#2A2140") };

interface VUnit { x: number; z: number; s: number; tier: number }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; vr: number; life: number; max: number; c: number; s: number; oc?: THREE.Color }
interface Flier { x0: number; z0: number; t: number; dur: number; ox: number; oz: number }

export class BrigadeRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.5, 140);
  private sim: Sim;
  private look: ThemeLook;
  private q: Quality;
  private w = 1; private h = 1;
  private camBase = new THREE.Vector3(); private camTarget = new THREE.Vector3();
  private shake = 0;
  private time = 0;
  private atlas = new Atlas();
  // instanced meshes
  private uBody: THREE.InstancedMesh; private uFace: THREE.InstancedMesh; private uBand: THREE.InstancedMesh; private uCrown: THREE.InstancedMesh;
  private gBody: THREE.InstancedMesh; private gFace: THREE.InstancedMesh; private gFar: THREE.InstancedMesh; private gPan: THREE.InstancedMesh; private gBand: THREE.InstancedMesh;
  private shadows: THREE.InstancedMesh;
  private bubbles: THREE.InstancedMesh;
  private slabs: THREE.InstancedMesh; private labels: THREE.InstancedMesh; private labelCell: THREE.InstancedBufferAttribute;
  private confetti: THREE.InstancedMesh; private puffs: THREE.InstancedMesh; private fliers: THREE.InstancedMesh;
  private gCap: THREE.InstancedMesh; private chutes: THREE.InstancedMesh;
  private rings: THREE.InstancedMesh; private fills: THREE.InstancedMesh; private balls: THREE.InstancedMesh; private bolts: THREE.InstancedMesh;
  private boltList: { x: number; z: number; t: number }[] = [];
  private gEars!: THREE.InstancedMesh; private gZip!: THREE.InstancedMesh; private gShield!: THREE.InstancedMesh; private gBalloon!: THREE.InstancedMesh;
  private rocks!: THREE.InstancedMesh; private rockLanes!: THREE.InstancedMesh; private toys!: THREE.InstancedMesh;
  private ventRings!: THREE.InstancedMesh; private ventCols!: THREE.InstancedMesh; private puddles!: THREE.InstancedMesh;
  private beam!: THREE.Mesh; private guard!: THREE.Mesh; private pillow!: THREE.Mesh; private wave!: THREE.Mesh; private waveT = -1; private waveDir = 1;
  private glow: THREE.PointLight | null = null;
  private bossParts: Record<string, THREE.Object3D> = {};
  private bossShield: THREE.Mesh | null = null;
  private recLane: THREE.Texture | null = null; private bonusLane: THREE.Texture | null = null;
  private vu: VUnit[] = [];
  private parts: Particle[] = []; private puffList: Particle[] = []; private flyList: Flier[] = [];
  private gateObjs = new Map<number, THREE.Group>();
  private blockObjs = new Map<number, THREE.Group>();
  private bossObj: THREE.Group | null = null; private bossKey = "";
  private bossBody: THREE.Mesh | null = null;
  private disposables: { dispose(): void }[] = [];
  private col = new THREE.Color();
  /** Grumpies carrying a power this frame (they get a badge) */
  private carriers: number[] = [];
  private pwCol = POWER_LIST.map((p) => new THREE.Color(POWERUPS[p].color));
  private jarGeo = M.jarGeo(); private pinGeo = M.pinataGeo();

  private uHat: THREE.InstancedMesh | null = null;
  private bubbleKind = "blue";
  private tier = 0;
  constructor(container: HTMLElement, sim: Sim, theme: ThemeId, quality: Quality, style?: Look) {
    this.sim = sim; this.look = LOOKS[theme]; this.q = quality;
    this.tier = sim.spec.tier ?? 0;
    this.bubbleKind = style?.bubble ?? "blue";
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    // lower the resolution a step if this device can't hold the frame rate (and back up when it can)
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });

    const L = this.look;
    // Remix Loop palettes: gold, rainbow and galaxy versions of every world
    const fogCol = new THREE.Color(L.fog);
    if (this.tier === 1) fogCol.lerp(new THREE.Color("#FFC870"), 0.45);
    if (this.tier === 3) fogCol.lerp(new THREE.Color("#1C1150"), 0.75);
    this.scene.background = fogCol;
    const dark = !!L.dark || !!sim.spec.mech?.dark;
    this.scene.fog = new THREE.Fog(fogCol, dark ? 22 : 34, dark ? 62 : 78);
    this.scene.add(new THREE.HemisphereLight(L.hemiSky, L.hemiGround, dark ? 0.9 : 1.25));
    const sun = new THREE.DirectionalLight(L.sun, dark ? 0.85 : 1.55); sun.position.set(-5, 14, 7); this.scene.add(sun);
    if (dark || this.tier === 3) { this.glow = new THREE.PointLight("#FFD9A0", 5, 20, 1.1); this.glow.position.set(0, 3, -2); this.scene.add(this.glow); }
    if (this.tier === 1) { const g = new THREE.DirectionalLight("#FFB347", 0.9); g.position.set(6, 6, -10); this.scene.add(g); }
    if (this.tier === 3) { const g = new THREE.DirectionalLight("#B26BFF", 1.2); g.position.set(-6, 8, -10); this.scene.add(g); }

    const lam = (o: THREE.MeshLambertMaterialParameters = {}) => this.keep(new THREE.MeshLambertMaterial(o));
    const vc = lam({ vertexColors: true });
    const caps = quality === "low" ? { near: 1200, far: 1800, bub: 500 } : { near: 1600, far: 2800, bub: 900 };
    this.uBody = inst(this.keep(M.blobBody(1)), lam(), 140, true);
    this.uFace = inst(this.keep(M.blobFace()), vc, 140);
    this.uBand = inst(this.keep(M.bandana()), vc, 40);
    this.uCrown = inst(this.keep(M.crown()), lam({ vertexColors: true }), 60, true);
    const hat = style?.hat ? M.hatGeo(style.hat) : null;
    if (hat) { this.uHat = inst(this.keep(hat), vc, 140); this.scene.add(this.uHat); }
    this.gBody = inst(this.keep(M.grumpBody(1)), lam(), caps.near, true);
    this.gFace = inst(this.keep(M.grumpFace()), vc, caps.near);
    this.gFar = inst(this.keep(M.grumpBody(0)), lam(), caps.far, true);
    this.gPan = inst(this.keep(M.saucepan()), vc, 900);
    this.gBand = inst(this.keep(M.headband()), vc, 300);
    const sh = new THREE.PlaneGeometry(1, 1);
    this.shadows = inst(this.keep(sh), this.keep(new THREE.MeshBasicMaterial({ map: this.keep(shadowTex()), transparent: true, depthWrite: false })), 2200);
    this.shadows.renderOrder = 1;
    // bold, solid, glowing bubbles that read on every floor (pale see-through ones vanished on light boards)
    const [bcol, bglow] = ({ blue: ["#2E8BFF", "#0F55D6"], pink: ["#FF4FA3", "#C2306F"], green: ["#2FD35A", "#138A30"], gold: ["#FFB800", "#B87400"], rainbow: ["#FFFFFF", "#333333"] } as Record<string, [string, string]>)[this.bubbleKind] ?? ["#2E8BFF", "#0F55D6"];
    this.bubbles = inst(this.keep(M.bubbleGeo()), this.keep(new THREE.MeshPhongMaterial({ color: bcol, emissive: bglow, emissiveIntensity: 0.6, specular: "#FFFFFF", shininess: 110 })), caps.bub, true);
    this.slabs = inst(this.keep(M.tileSlab(1.8, 1.0)), lam(), 140, true);
    const lg = new THREE.PlaneGeometry(1, 1);
    this.labelCell = new THREE.InstancedBufferAttribute(new Float32Array(140 * 2), 2); this.labelCell.setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute("aCell", this.labelCell);
    const lm = new THREE.MeshBasicMaterial({ map: this.atlas.tex, transparent: true, depthWrite: false });
    lm.onBeforeCompile = (sh2) => {
      sh2.vertexShader = sh2.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 aCell;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = vMapUv * 0.125 + aCell;");
    };
    this.labels = inst(this.keep(lg), this.keep(lm), 140);
    this.labels.renderOrder = 2;
    this.confetti = inst(this.keep(M.confettiGeo()), lam({ side: THREE.DoubleSide }), quality === "low" ? 400 : 900, true);
    this.puffs = inst(this.keep(M.puffGeo()), lam({ transparent: true, opacity: 0.85 }), 260, true);
    this.fliers = inst(this.keep(M.blobBody(0)), lam(), 160, true);
    this.gCap = inst(this.keep(M.spitCap()), vc, 240);
    this.chutes = inst(this.keep(M.parachute()), vc, 60);
    const rg = new THREE.RingGeometry(0.84, 1, 40); rg.rotateX(-Math.PI / 2);
    const cg = new THREE.CircleGeometry(1, 32); cg.rotateX(-Math.PI / 2);
    this.rings = inst(this.keep(rg), this.keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false })), 24, true);
    this.fills = inst(this.keep(cg), this.keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.38, depthWrite: false })), 24, true);
    this.rings.renderOrder = this.fills.renderOrder = 3;
    this.balls = inst(this.keep(M.bubbleGeo()), lam(), 24, true);
    this.bolts = inst(this.keep(M.boltGeo()), this.keep(new THREE.MeshBasicMaterial({ vertexColors: true })), 8);
    this.gEars = inst(this.keep(M.bunnyEars()), vc, 300);
    this.gZip = inst(this.keep(M.zipper()), vc, 300);
    this.gShield = inst(this.keep(M.woodShield()), vc, 300);
    this.gBalloon = inst(this.keep(M.grumpBalloon()), vc, 200);
    this.rocks = inst(this.keep(M.boulderGeo()), vc, 10);
    const lane = new THREE.PlaneGeometry(1, 1); lane.rotateX(-Math.PI / 2);
    this.rockLanes = inst(this.keep(lane), this.keep(new THREE.MeshBasicMaterial({ color: "#FF4D6D", transparent: true, opacity: 0.22, depthWrite: false })), 10);
    this.toys = inst(this.keep(M.toyBlocks()), vc, 6);
    const vr = new THREE.RingGeometry(0.7, 1, 28); vr.rotateX(-Math.PI / 2);
    this.ventRings = inst(this.keep(vr), this.keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false })), 8, true);
    const vcg = new THREE.CylinderGeometry(0.5, 0.75, 1, 12, 1, true); vcg.translate(0, 0.5, 0);
    this.ventCols = inst(this.keep(vcg), this.keep(new THREE.MeshBasicMaterial({ color: "#FF7A1F", transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })), 8);
    const pd = new THREE.CircleGeometry(1, 24); pd.rotateX(-Math.PI / 2);
    this.puddles = inst(this.keep(pd), this.keep(new THREE.MeshBasicMaterial({ color: "#FF6A1F", transparent: true, opacity: 0.8, depthWrite: false })), 10);
    this.rockLanes.renderOrder = this.ventRings.renderOrder = this.puddles.renderOrder = 3;
    const bg = new THREE.BoxGeometry(1.8, 0.9, 40); bg.translate(0, 0.6, -20);
    this.beam = new THREE.Mesh(this.keep(bg), this.keep(new THREE.MeshBasicMaterial({ color: "#E9B8FF", transparent: true, opacity: 0.45, depthWrite: false })));
    this.guard = new THREE.Mesh(this.keep(new THREE.SphereGeometry(1, 20, 14)), this.keep(new THREE.MeshPhongMaterial({ color: "#FFD23F", emissive: "#FFB000", emissiveIntensity: 0.5, transparent: true, opacity: 0.28, shininess: 100 })));
    const pg = new THREE.BoxGeometry(1, 1.1, 0.7); pg.translate(0, 0.55, 0);
    this.pillow = new THREE.Mesh(this.keep(pg), this.keep(new THREE.MeshLambertMaterial({ color: "#FFF6E0", emissive: "#FFE6A8", emissiveIntensity: 0.3 })));
    const wg = new THREE.CylinderGeometry(1.4, 1.4, 60, 16, 1, true, 0, Math.PI); wg.rotateX(Math.PI / 2); wg.translate(0, 0.4, -24);
    this.wave = new THREE.Mesh(this.keep(wg), this.keep(new THREE.MeshPhongMaterial({ color: "#5FD3EE", emissive: "#1B9BBF", emissiveIntensity: 0.35, transparent: true, opacity: 0.8, side: THREE.DoubleSide, shininess: 80 })));
    this.beam.visible = this.guard.visible = this.pillow.visible = this.wave.visible = false;
    this.scene.add(this.gEars, this.gZip, this.gShield, this.gBalloon, this.rocks, this.rockLanes, this.toys, this.ventRings, this.ventCols, this.puddles, this.beam, this.guard, this.pillow, this.wave);
    this.scene.add(this.uBody, this.uFace, this.uBand, this.uCrown, this.gBody, this.gFace, this.gFar, this.gPan, this.gBand, this.shadows, this.bubbles, this.slabs, this.labels, this.confetti, this.puffs, this.fliers, this.gCap, this.chutes, this.rings, this.fills, this.balls, this.bolts);
    this.buildBoard(theme);
  }

  private keep<T extends { dispose(): void }>(x: T): T { this.disposables.push(x); return x; }

  // ---------------------------------------------------------------- the board
  private buildBoard(theme: ThemeId) {
    const L = this.look, sim = this.sim, len = 130, zc = -len / 2 + 12;
    const floorTex = this.keep(L.floor()); floorTex.repeat.set(2.6, len / 5);
    const floor = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(HALF * 2, len)), this.keep(new THREE.MeshLambertMaterial({ map: floorTex })));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, zc); this.scene.add(floor);
    const sideTex = this.keep(L.side()); sideTex.repeat.set(6, len / 5);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(30, len)), this.keep(new THREE.MeshLambertMaterial({ map: sideTex })));
      side.rotation.x = -Math.PI / 2; side.position.set(sx * (HALF + 15), -0.05, zc); this.scene.add(side);
      const kerb = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.35, 0.4, len)), this.keep(new THREE.MeshLambertMaterial({ color: L.kerb })));
      kerb.position.set(sx * (HALF + 0.17), 0.2, zc); this.scene.add(kerb);
    }
    // conveyor and bonus lanes, the field is plain floor
    for (const lane of sim.lanes) {
      if (lane.kind === "field") continue;
      const [a, b] = lane.kind === "recruit" ? L.rec : L.bonus;
      const t = this.keep(stripeTex(a, b)); t.repeat.set(1, len / 2.2);
      if (lane.kind === "recruit") this.recLane = t; else this.bonusLane = t;
      const m = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(lane.x1 - lane.x0 - 0.1, len)), this.keep(new THREE.MeshLambertMaterial({ map: t, transparent: true, opacity: 0.9 })));
      m.rotation.x = -Math.PI / 2; m.position.set((lane.x0 + lane.x1) / 2, 0.012, zc); this.scene.add(m);
    }
    // walls between lanes, from the wall mouth up the board
    const wl = len - 12 + WALL_END;
    for (const [x0, x1] of sim.walls) {
      const w = x1 - x0;
      const wall = new THREE.Mesh(this.keep(new THREE.BoxGeometry(w, 0.55, wl)), this.keep(new THREE.MeshLambertMaterial({ color: L.wall })));
      wall.position.set((x0 + x1) / 2, 0.275, WALL_END - wl / 2); this.scene.add(wall);
      const top = new THREE.Mesh(this.keep(new THREE.BoxGeometry(w + 0.06, 0.08, wl)), this.keep(new THREE.MeshLambertMaterial({ color: L.wallTop })));
      top.position.set((x0 + x1) / 2, 0.58, WALL_END - wl / 2); this.scene.add(top);
      const cap = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(w / 2, w / 2, 0.62, 12)), this.keep(new THREE.MeshLambertMaterial({ color: L.wallTop })));
      cap.position.set((x0 + x1) / 2, 0.31, WALL_END); this.scene.add(cap);
    }
    this.buildDecor(theme, zc, len);
  }

  private buildDecor(theme: ThemeId, zc: number, len: number) {
    const dense = this.q === "low" ? 0.5 : 1;
    const scatter = (geo: THREE.BufferGeometry, count: number, minX: number, maxX: number, s0: number, s1: number) => {
      const m = inst(this.keep(geo), this.keep(new THREE.MeshLambertMaterial({ vertexColors: true })), Math.max(1, Math.round(count * dense)));
      m.count = Math.max(1, Math.round(count * dense));
      for (let i = 0; i < m.count; i++) {
        const sx = Math.random() < 0.5 ? -1 : 1, x = sx * (HALF + minX + Math.random() * (maxX - minX)), z = zc + (Math.random() - 0.5) * len;
        put(m, i, x, 0, z, s0 + Math.random() * (s1 - s0), undefined, Math.random() * 6.28);
      }
      m.instanceMatrix.needsUpdate = true;
      this.scene.add(m);
    };
    if (theme === "garden") {
      scatter(M.grassTuft(), 700, 0.4, 14, 0.8, 1.7);
      scatter(M.clover(), 260, 0.4, 10, 1, 1.8);
      scatter(M.mushroom(), 26, 1.2, 9, 0.8, 1.7);
      scatter(M.flower("#FF6FB1"), 70, 0.6, 12, 0.9, 1.4);
      scatter(M.flower("#FFFFFF"), 70, 0.6, 12, 0.9, 1.4);
      scatter(M.flower("#8F7CFF"), 50, 0.6, 12, 0.9, 1.4);
    } else if (theme === "snow") {
      scatter(M.pineTree(), 90, 0.8, 14, 0.9, 1.8);
      scatter(M.snowman(), 14, 1.2, 9, 0.9, 1.3);
      scatter(M.igloo(), 8, 3, 12, 0.9, 1.4);
    } else if (theme === "toy") {
      scatter(M.toyBlocks(), 40, 0.8, 12, 0.9, 1.6);
      scatter(M.toyBall("#FF5F7E", "#FFFFFF"), 20, 1, 12, 0.8, 1.4);
      scatter(M.toyBall("#3D8BFF", "#FFD23F"), 20, 1, 12, 0.8, 1.4);
    } else if (theme === "beach") {
      scatter(M.palmTree(), 50, 1.5, 14, 0.9, 1.5);
      scatter(M.beachUmbrella(), 16, 1, 10, 0.9, 1.2);
      scatter(M.sandBucket(), 24, 0.6, 10, 0.9, 1.3);
    } else if (theme === "spooky") {
      scatter(M.pumpkin(), 40, 0.6, 12, 0.8, 1.5);
      scatter(M.gravestone(), 30, 1, 12, 0.9, 1.3);
      scatter(M.deadTree(), 30, 1.5, 14, 0.9, 1.6);
      scatter(M.lanternPost(), 26, 0.5, 2.5, 1, 1.1);
    } else if (theme === "jungle") {
      scatter(M.fern(), 180, 0.5, 14, 1, 2.2);
      scatter(M.jungleTree(), 50, 1.5, 14, 0.9, 1.6);
      scatter(M.stoneHead(), 12, 1.5, 10, 0.9, 1.4);
    } else if (theme === "lava") {
      scatter(M.basaltRock(), 90, 0.6, 14, 0.8, 1.8);
    } else if (theme === "space") {
      scatter(M.crystal("#8FE3FF"), 40, 0.6, 12, 0.8, 1.6);
      scatter(M.crystal("#FF8FE0"), 30, 0.6, 12, 0.8, 1.6);
      scatter(M.antenna(), 14, 1.2, 10, 0.9, 1.3);
    } else if (theme === "castle") {
      scatter(M.castleTower(), 22, 2.5, 14, 0.9, 1.4);
      scatter(M.banner(), 30, 0.6, 3, 1, 1.2);
      scatter(M.grassTuft(), 300, 0.5, 14, 0.8, 1.5);
    } else {
      scatter(M.lollipop(["#FF4FA3", "#FFFFFF"]), 22, 1.2, 10, 1, 1.8);
      scatter(M.lollipop(["#3FD3A0", "#FFFFFF"]), 18, 1.2, 10, 1, 1.8);
      scatter(M.cupcake("#FFB3D1"), 24, 1, 10, 1, 1.6);
      scatter(M.cupcake("#B2F0FF"), 18, 1, 10, 1, 1.6);
      scatter(M.donut("#FF7AB6"), 26, 0.8, 11, 0.9, 1.4);
      scatter(M.donut("#8B5A3C"), 18, 0.8, 11, 0.9, 1.4);
      for (const c of ["#FF4FA3", "#FFD23F", "#3FD3A0", "#4FA8FF", "#B26BFF"]) scatter(M.gumdrop(c), 40, 0.4, 12, 0.6, 1.1);
    }
  }

  // ---------------------------------------------------------------- camera
  private gov: FrameGovernor | null = null;
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    const cam = this.camera, aspect = this.w / this.h;
    cam.aspect = aspect; cam.fov = aspect < 0.8 ? 50 : 44;
    const portrait = aspect < 0.8;
    const pitch = portrait ? 0.98 : 0.92;
    // landscape phones are short: show less of the march ahead and keep the brigade big
    const farZ = portrait ? -34 : aspect > 1.7 ? -22 : -27, lineY = portrait ? -0.56 : -0.6;
    const v = new THREE.Vector3();
    const ndc = (x: number, z: number) => v.set(x, 0, z).project(cam);
    // find the closest camera that shows the whole board width at the line and the march far up the board
    for (let D = 12; D < 70; D += 0.5) {
      // place the brigade line ~22% up from the bottom
      // moving the rig towards −z lowers the line on screen
      let tz = -8;
      for (let k = 0; k < 30; k++) {
        cam.position.set(0, Math.sin(pitch) * D, tz + Math.cos(pitch) * D);
        cam.lookAt(0, 0, tz); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const y = ndc(0, 0.6).y;
        if (Math.abs(y - lineY) < 0.002) break;
        tz -= (y - lineY) * 5;
      }
      const left = ndc(-HALF - 0.3, 1.2), far = ndc(0, farZ);
      if (Math.abs(left.x) <= 0.99 && far.y <= 0.93) { this.camTarget.set(0, 0, tz); this.camBase.copy(cam.position); break; }
    }
  }

  /** world → CSS pixels inside the canvas */
  screen(x: number, y: number, z: number): [number, number, boolean] {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.w, (-v.y * 0.5 + 0.5) * this.h, v.z < 1];
  }

  // ---------------------------------------------------------------- per frame
  update(dt: number, events: SimEvent[]) {
    this.time += dt;
    const s = this.sim, t = this.time;
    for (const e of events) this.onEvent(e);
    // brigade units ease towards their formation slots
    const units = s.units;
    while (this.vu.length < units.length) this.vu.push({ x: s.bx, z: 0, s: 0, tier: 0 });
    this.vu.length = units.length;
    let ni = 0, ii = 0, bi = 0, ci = 0, hi = 0;
    const k = Math.min(1, dt * 10);
    for (let i = 0; i < units.length; i++) {
      const u = units[i], v = this.vu[i];
      if (v.tier !== u.tier) { v.tier = u.tier; v.s = Math.min(v.s, 0.4); }
      v.x += (s.bx + u.ox - v.x) * k; v.z += (u.oz - v.z) * k;
      const target = TIER_R[u.tier] / 0.86;
      v.s += (target - v.s) * Math.min(1, dt * 8);
      const hop = Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.07 * (1 + u.tier * 0.5), sq = 1 - hop * 0.6;
      put(this.uBody, ni, v.x, hop, v.z, v.s, v.s * sq);
      put(this.uFace, ni, v.x, hop, v.z, v.s, v.s * sq);
      setCol(this.uBody, ni, s.chillT > 0 ? CHILL : TIER_COLOR[u.tier]);
      putFlat(this.shadows, ii++, v.x, 0.02, v.z, v.s * 2.3, v.s * 2.1);
      if (u.tier === 1) put(this.uBand, bi++, v.x, hop, v.z, v.s, v.s * sq);
      if (this.uHat && u.tier < 2 && hi < 140) put(this.uHat, hi++, v.x, hop, v.z, v.s, v.s * sq);
      if (u.tier >= 2) {
        put(this.uCrown, ci, v.x, hop, v.z, v.s, v.s * sq, t * 0.6);
        setCol(this.uCrown, ci, u.tier === 3 ? this.col.setHSL((t * 0.15 + i * 0.1) % 1, 0.85, 0.6) : this.col.set("#FFC93C"));
        ci++;
      }
      ni++;
    }
    this.uBody.count = this.uFace.count = ni; this.uBand.count = bi; this.uCrown.count = ci;
    if (this.uHat) { this.uHat.count = hi; this.uHat.instanceMatrix.needsUpdate = true; }
    // rainbow tier: the sky slowly cycles through colours
    if (this.tier === 2) { const c = this.scene.background as THREE.Color; c.setHSL((t * 0.03) % 1, 0.6, 0.82); (this.scene.fog as THREE.Fog).color.copy(c); }

    // Grumpies: near ones get faces, far ones are cheap balls
    const h = s.horde, L = this.look;
    const cg = new THREE.Color(L.grump), cs = new THREE.Color(L.speedy), cj = new THREE.Color(L.jelly), cc = new THREE.Color("#6A5E98"), cp = new THREE.Color("#7FA77A");
    const cbo = new THREE.Color("#A08FD8"), csp = new THREE.Color("#B07BD8"), csh = new THREE.Color("#8A86A8"), cba = new THREE.Color("#9C92C8");
    const frozen = s.freezeT > 0, ice = new THREE.Color("#BFEFFF");
    let gn = 0, gf = 0, gp = 0, gb = 0, gc = 0, gch = 0, ge = 0, gz = 0, gs = 0, gl = 0;
    const capN = this.gBody.instanceMatrix.count, capF = this.gFar.instanceMatrix.count;
    this.carriers.length = 0;
    for (let i = 0; i < h.len; i++) {
      if (!h.on[i]) continue;
      const z = h.z[i];
      if (z < -76) continue;
      const kind = h.kind[i], x = h.x[i];
      const tough = (h.max[i] > 3 ? 1 + Math.min(0.6, Math.log10(h.max[i]) * 0.22) : 1) * (h.pw[i] ? 1.3 : 1);
      if (h.pw[i] && this.carriers.length < 12) this.carriers.push(i);
      const sc = (kind === 2 ? 0.25 : kind === 3 ? 0.24 : kind === 4 ? 0.42 : 0.27) * tough;
      const ph = h.phase[i] + t * (kind === 2 ? 14 : kind === 4 ? 5 : 8);
      const drop = h.hitT[i] < 0 ? -h.hitT[i] : 0;
      const bp = kind === 6 ? (t + h.phase[i]) % 1.6 : 1;
      const hop = (kind === 6 && bp < 0.4 ? Math.sin((bp / 0.4) * Math.PI) * 0.9 : Math.abs(Math.sin(ph)) * 0.08) + drop * 9;
      const base0 = kind === 2 ? cs : kind === 3 ? cj : kind === 4 ? cc : kind === 5 ? cp : kind === 6 ? cbo : kind === 7 ? csp : kind === 8 ? csh : kind === 9 ? cba : cg;
      const base = frozen ? ice : h.pw[i] ? this.pwCol[h.pw[i] - 1] : base0;
      const c = h.hitT[i] > 0 ? WHITE : base;
      if (z > -30 && gn < capN) {
        const sw = Math.sin(ph * 0.5) * 0.12;
        put(this.gBody, gn, x, hop, z, sc, sc * (1 - hop * 0.8), sw); setCol(this.gBody, gn, c);
        put(this.gFace, gn, x, hop, z, sc, sc * (1 - hop * 0.8), sw);
        if (gn + gf < 2000) putFlat(this.shadows, ii++, x, 0.02, z, sc * 2.2, sc * 2);
        if (kind === 1 && h.hp[i] > 1.5) put(this.gPan, gp++, x, hop, z, sc, sc, sw);
        if (kind === 2 && gb < 300) put(this.gBand, gb++, x, hop, z, sc, sc, sw);
        if (kind === 5 && gc < 240) put(this.gCap, gc++, x, hop, z, sc, sc, sw);
        if (kind === 6 && ge < 300) put(this.gEars, ge++, x, hop, z, sc, sc, sw);
        if (kind === 7 && gz < 300) put(this.gZip, gz++, x, hop, z, sc, sc, sw);
        if (kind === 8 && h.cd[i] > 0 && gs < 300) put(this.gShield, gs++, x, hop, z, sc, sc, sw);
        if (kind === 9 && gl < 200) put(this.gBalloon, gl++, x, hop, z, sc, sc, Math.sin(t * 2 + i) * 0.3);
        if (drop > 0 && gch < 60) put(this.chutes, gch++, x, hop, z, sc, sc, Math.sin(t * 3 + i) * 0.2);
        gn++;
      } else if (gf < capF) {
        put(this.gFar, gf, x, hop, z, sc, sc); setCol(this.gFar, gf, base);
        if (kind === 1 && h.hp[i] > 1.5 && gp < 900) put(this.gPan, gp++, x, 0, z, sc, sc);
        gf++;
      }
    }
    this.gBody.count = this.gFace.count = gn; this.gFar.count = gf; this.gPan.count = gp; this.gBand.count = gb; this.gCap.count = gc; this.chutes.count = gch;
    this.gEars.count = ge; this.gZip.count = gz; this.gShield.count = gs; this.gBalloon.count = gl;

    // bubbles
    const B = s.bubbles;
    let bn = 0;
    const bcap = this.bubbles.instanceMatrix.count;
    for (let i = 0; i < B.len && bn < bcap; i++) {
      if (!B.on[i]) continue;
      const r = BUBBLE_R[B.tier[i]] * s.bubbleR, wob = 1 + Math.sin(t * 20 + i) * 0.08;
      put(this.bubbles, bn, B.x[i], 0.55 + B.tier[i] * 0.2, B.z[i], r * 1.25 * wob, (r * 1.25) / wob);
      setCol(this.bubbles, bn, this.bubbleKind === "rainbow" ? this.col.setHSL((i * 0.13 + t * 0.4) % 1, 0.95, 0.55) : WHITE);
      bn++;
    }
    this.bubbles.count = bn;

    // tiles + their labels
    let tn = 0;
    const gold = new THREE.Color(L.bonus[0]), blue = new THREE.Color(L.rec[0]), coin = new THREE.Color("#FFC21A"), thornC = new THREE.Color("#E5484D");
    for (const tile of s.tiles) {
      if (tile.z < -70 || tn >= 140) continue;
      const lane = s.lanes[tile.lane], w = Math.min(1.8, lane.x1 - lane.x0 - 0.25);
      const bob = tile.moving ? 0 : 0.02;
      const pw = tile.pw ? POWERUPS[tile.pw] : null, pulse = pw ? 1 + Math.sin(t * 9 + tile.id) * 0.07 : 1;
      put(this.slabs, tn, tile.x, bob, tile.z, (w / 1.8) * pulse, pw ? 1.4 : 1, 0, pulse);
      setCol(this.slabs, tn, pw ? this.col.set(pw.color) : tile.coin ? coin : tile.v < 0 ? thornC : lane.kind === "bonus" ? gold : blue);
      const cell = pw ? this.atlas.icon(pw.icon) : this.atlas.cell(tile.v < 0 ? `−${-tile.v}` : `+${tile.v}`, tile.coin);
      putFlat(this.labels, tn, tile.x, (pw ? 0.38 : 0.29) + bob, tile.z, pw ? 1.15 * pulse : 1.0, pw ? 1.15 * pulse : 1.0);
      (this.labelCell.array as Float32Array)[tn * 2] = (cell % 8) / 8;
      (this.labelCell.array as Float32Array)[tn * 2 + 1] = 1 - (Math.floor(cell / 8) + 1) / 8;
      tn++;
    }
    this.slabs.count = tn;
    // power badges float over the Grumpies that carry them
    for (const i of this.carriers) {
      if (tn >= 140 || h.z[i] < -70) continue;
      const pw = POWERUPS[POWER_LIST[h.pw[i] - 1]], p = 1 + Math.sin(t * 7 + i) * 0.08;
      const cell = this.atlas.icon(pw.icon);
      putFlat(this.labels, tn, h.x[i], 1.3, h.z[i], 1.35 * p, 1.35 * p);
      (this.labelCell.array as Float32Array)[tn * 2] = (cell % 8) / 8;
      (this.labelCell.array as Float32Array)[tn * 2 + 1] = 1 - (Math.floor(cell / 8) + 1) / 8;
      tn++;
    }
    this.labels.count = tn;
    this.labelCell.needsUpdate = true;

    // villain attacks: a ring on the ground fills up until the goo ball / cake / lightning lands
    let bk = 0, bb = 0;
    for (const b of s.bombs) {
      if (bk >= 24) break;
      const f = Math.min(1, b.t / b.dur), pulse = 1 + Math.sin(t * 22) * 0.04;
      const colr = BOMB_RING[b.kind] ?? GOO;
      put(this.rings, bk, b.x, 0.05, b.z, b.r * pulse, 1, 0, b.r * pulse); setCol(this.rings, bk, colr);
      put(this.fills, bk, b.x, 0.045, b.z, Math.max(0.01, b.r * f), 1, 0, Math.max(0.01, b.r * f)); setCol(this.fills, bk, colr);
      bk++;
      if (b.kind !== "zap") {
        const x = b.x0 + (b.x - b.x0) * f, z = b.z0 + (b.z - b.z0) * f, y = b.y0 * (1 - f) + Math.sin(f * Math.PI) * 4.5 + 0.3;
        const big = b.kind === "cake" || b.kind === "snow" || b.kind === "rock" ? 0.5 : 0.36;
        put(this.balls, bb, x, y, z, big, b.kind === "cake" ? 0.38 : big); setCol(this.balls, bb, BOMB_BALL[b.kind] ?? GOO_BALL);
        bb++;
      }
    }
    this.rings.count = this.fills.count = bk; this.balls.count = bb;
    let bo = 0;
    for (let i = this.boltList.length - 1; i >= 0; i--) {
      const z = this.boltList[i];
      z.t += dt;
      if (z.t > 0.28) { this.boltList.splice(i, 1); continue; }
      put(this.bolts, bo++, z.x, 0, z.z, 1, 1 - z.t, Math.sin(i * 7) * 0.5);
    }
    this.bolts.count = bo;
    done(this.gCap, this.chutes, this.rings, this.fills, this.balls, this.bolts);

    this.syncHazards(dt);
    this.syncGates();
    this.syncBlocks(dt);
    this.syncBoss(dt);
    for (const g of this.blockObjs.values()) { const o = g.userData.block as Block; if (o.alive && ii < 2200) putFlat(this.shadows, ii++, o.x, 0.02, o.z, o.r * 2.4, o.r * 2.2); }
    if (s.boss && ii < 2200) putFlat(this.shadows, ii++, s.boss.x, 0.02, s.boss.z, s.boss.r * 2.6, s.boss.r * 2.2);
    this.shadows.count = ii;

    this.stepParticles(dt);
    if (this.recLane) this.recLane.offset.y = (-t * this.sim.spec.tileSpeed) / 2.2;
    if (this.bonusLane && s.blocks.some((o) => o.kind === "jar" && !o.alive)) this.bonusLane.offset.y = (-t * this.sim.spec.tileSpeed) / 2.2;

    done(this.uBody, this.uFace, this.uBand, this.uCrown, this.gBody, this.gFace, this.gFar, this.gPan, this.gBand, this.shadows, this.bubbles, this.slabs, this.labels);

    // camera follows the brigade a little and shakes on hits
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const sx = (Math.random() - 0.5) * this.shake * 0.5, sy = (Math.random() - 0.5) * this.shake * 0.4;
    const follow = s.bx * 0.16;
    this.camera.position.set(this.camBase.x + follow + sx, this.camBase.y + sy, this.camBase.z);
    this.camera.lookAt(this.camTarget.x + follow * 1.2, 0, this.camTarget.z);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  // ---------------------------------------------------------------- Phase 2: hazards, powers
  private syncHazards(dt: number) {
    const s = this.sim, t = this.time;
    let k = 0;
    for (const b of s.boulders) {
      if (k >= 10) break;
      put(this.rocks, k, b.x, 0.9, b.z, 0.9, 0.9, 0); // rolling: spin about X via a tilted matrix is overkill — bob instead
      const len = Math.max(0.1, -b.z);
      put(this.rockLanes, k, b.x, 0.04, b.z / 2, 2.0, 1, 0, len);
      k++;
    }
    this.rocks.count = this.rockLanes.count = k;
    let tb = 0;
    for (const b of s.blockers) { if (tb < 6) put(this.toys, tb++, b.x, 0.9 + Math.sin(t * 3 + b.id) * 0.08, b.z, b.w / 1.3, b.w / 1.3, Math.sin(t + b.id) * 0.2); }
    this.toys.count = tb;
    let vr = 0, vc = 0, pd = 0;
    for (const zn of s.zones) {
      if (zn.kind === "vent") {
        if (vr < 8) {
          put(this.ventRings, vr, zn.x, 0.05, 0.1, zn.w / 2, 1, 0, zn.w / 2);
          setCol(this.ventRings, vr, this.col.set(zn.state === 0 ? "#5A2A1A" : zn.state === 1 ? (Math.sin(t * 18) > 0 ? "#FFB347" : "#FF5A1F") : "#FF7A1F"));
          vr++;
        }
        if (zn.state === 2 && vc < 8) put(this.ventCols, vc++, zn.x, 0, 0.1, zn.w / 2, 3.2 + Math.sin(t * 20) * 0.3, t * 4, zn.w / 2);
      } else if (pd < 10) {
        const r = (zn.w / 2) * Math.min(1, zn.t * 2);
        put(this.puddles, pd++, zn.x, 0.04, 0.1, r, 1, 0, r * 0.8);
      }
    }
    this.ventRings.count = vr; this.ventCols.count = vc; this.puddles.count = pd;
    // beams, shields, the pillow wall, the surf wave
    this.beam.visible = s.beamT > 0;
    if (this.beam.visible) { this.beam.position.set(s.bx, 0, 0); (this.beam.material as THREE.MeshBasicMaterial).color.setHSL((t * 0.8) % 1, 0.9, 0.75); this.beam.scale.set(1 + Math.sin(t * 30) * 0.08, 1, 1); }
    this.guard.visible = s.guardT > 0;
    if (this.guard.visible) { this.guard.position.set(s.bx, 0.6, 0); this.guard.scale.setScalar(s.R + 0.6 + Math.sin(t * 12) * 0.05); }
    this.pillow.visible = s.wallT > 0;
    if (this.pillow.visible) { this.pillow.position.set(0, 0, -4.9); this.pillow.scale.set(7.6, 1 + Math.sin(t * 4) * 0.05, 1); }
    if (this.waveT >= 0) {
      this.waveT += dt;
      const f = this.waveT / 0.7;
      this.wave.visible = f < 1;
      this.wave.position.set(-this.waveDir * (9 - f * 18), 0, 0);
      if (f >= 1) this.waveT = -1;
    }
    if (this.glow) this.glow.position.set(s.bx, 3.2, -2.5);
    done(this.gEars, this.gZip, this.gShield, this.gBalloon, this.rocks, this.rockLanes, this.toys, this.ventRings, this.ventCols, this.puddles);
  }

  // ---------------------------------------------------------------- gates / blocks / boss
  private syncGates() {
    const seen = new Set<number>();
    for (const row of this.sim.gates) {
      seen.add(row.id);
      let g = this.gateObjs.get(row.id);
      if (!g) { g = this.makeGate(row.gates.map((x) => x)); this.gateObjs.set(row.id, g); this.scene.add(g); }
      g.position.z = row.z;
      if (row.done && row.chosen >= 0) {
        const p = g.children.find((c) => c.userData.gate === row.chosen);
        if (p) { p.scale.setScalar(Math.min(1.35, p.scale.x + 0.06)); ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity - 0.05); }
      }
    }
    for (const [id, g] of this.gateObjs) if (!seen.has(id)) { this.scene.remove(g); this.disposeGroup(g); this.gateObjs.delete(id); }
  }
  private makeGate(gates: { op: string; k: number }[]): THREE.Group {
    const g = new THREE.Group(), w = (HALF * 2) / gates.length;
    gates.forEach((gate, i) => {
      const good = gate.op === "+" || gate.op === "x";
      const label = `${gate.op === "+" ? "+" : gate.op === "-" ? "−" : gate.op === "x" ? "×" : "÷"}${gate.k}`;
      // the canvas matches the panel's shape so the number isn't stretched
      const pw = w - 0.5, ph = 2.0, cw = 512, chh = Math.round((cw * ph) / pw);
      const c = document.createElement("canvas"); c.width = cw; c.height = chh;
      const x = c.getContext("2d")!;
      const grad = x.createLinearGradient(0, 0, 0, chh);
      grad.addColorStop(0, good ? "rgba(70,220,140,0.85)" : "rgba(255,80,110,0.85)"); grad.addColorStop(1, good ? "rgba(20,160,110,0.55)" : "rgba(200,30,70,0.55)");
      x.fillStyle = grad; x.beginPath(); x.roundRect(8, 8, cw - 16, chh - 16, 40); x.fill();
      x.lineWidth = 12; x.strokeStyle = "rgba(255,255,255,0.9)"; x.stroke();
      x.font = `900 ${Math.round(chh * 0.62)}px "Lilita One", "Arial Black", system-ui, sans-serif`;
      x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
      x.lineWidth = 18; x.strokeStyle = good ? "#0B5A3A" : "#7A0C2A"; x.strokeText(label, cw / 2, chh * 0.55);
      x.fillStyle = "#FFFFFF"; x.fillText(label, cw / 2, chh * 0.55);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      panel.position.set(-HALF + w * (i + 0.5), 1.25, 0);
      panel.rotation.x = -0.35;
      panel.userData.gate = i;
      g.add(panel);
    });
    const postMat = new THREE.MeshLambertMaterial({ color: "#FFFFFF" });
    for (let i = 0; i <= gates.length; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8), postMat);
      post.position.set(-HALF + w * i, 1.3, 0); g.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.3, 0.2, 0.2), postMat); bar.position.set(0, 2.6, 0); g.add(bar);
    return g;
  }

  private syncBlocks(dt: number) {
    for (const o of this.sim.blocks) {
      let g = this.blockObjs.get(o.id);
      if (!g) {
        if (!o.alive) continue;
        g = this.makeBlock(o); this.blockObjs.set(o.id, g); this.scene.add(g);
      }
      if (!o.alive) {
        g.scale.multiplyScalar(Math.max(0, 1 - dt * 7));
        if (g.scale.x < 0.05) { this.scene.remove(g); this.disposeGroup(g, true); this.blockObjs.delete(o.id); }
        continue;
      }
      const sh = o.hitT > 0 ? (Math.random() - 0.5) * 0.12 : 0;
      g.position.set(o.x + sh, 0, o.z);
      if (o.kind === "pinata") g.rotation.y += dt * 1.6;
      if (o.kind === "cage") { const inner = g.children[1]; if (inner) inner.position.y = 0.15 + Math.abs(Math.sin(this.time * 6)) * 0.12; }
    }
  }
  private makeBlock(o: Block): THREE.Group {
    const g = new THREE.Group();
    g.userData.block = o;
    if (o.kind === "jar") {
      const m = new THREE.Mesh(this.jarGeo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.scale.setScalar(0.95); g.add(m);
    } else if (o.kind === "pinata") {
      const m = new THREE.Mesh(this.pinGeo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.scale.setScalar(0.85); g.add(m);
    } else {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), new THREE.MeshPhongMaterial({ color: "#BFF3FF", emissive: "#3BA8D0", emissiveIntensity: 0.25, transparent: true, opacity: 0.45, shininess: 100 }));
      shell.position.y = 0.66; g.add(shell);
      const blob = new THREE.Mesh(M.blobBody(0), new THREE.MeshLambertMaterial({ color: "#FF8A3D" })); blob.scale.setScalar(0.32); g.add(blob);
    }
    return g;
  }

  private syncBoss(dt: number) {
    const b = this.sim.boss;
    if (!b) {
      if (this.bossObj) {
        // cheered up: spin, shrink and fly off
        this.bossObj.rotation.y += dt * 9; this.bossObj.position.y += dt * 4; this.bossObj.scale.multiplyScalar(Math.max(0, 1 - dt * 2.2));
        if (this.bossObj.scale.x < 0.05) { this.scene.remove(this.bossObj); this.disposeGroup(this.bossObj, true); this.bossObj = null; this.bossKey = ""; }
      }
      return;
    }
    const key = `${b.kind}:${b.mini}`;
    if (!this.bossObj || this.bossKey !== key) this.makeBoss(b);
    const g = this.bossObj!;
    const step = Math.abs(Math.sin(this.time * 3.2));
    const fly = b.kind === "cloud" ? 3.4 + Math.sin(this.time * 1.6) * 0.25 : b.kind === "balloon" ? 3.0 + Math.sin(this.time * 1.2) * 0.3
      : b.kind === "ufo" ? 3.6 + Math.sin(this.time * 1.4) * 0.25 : b.kind === "ghost" ? 0.6 + Math.sin(this.time * 2) * 0.25 : 0;
    if (b.kind === "ghost" && this.bossBody) { const mat = this.bossBody.material as THREE.MeshLambertMaterial; mat.opacity += ((b.fadeT > 0 ? 0.15 : 0.9) - mat.opacity) * Math.min(1, dt * 8); }
    if (this.bossParts.armor) this.bossParts.armor.visible = b.armor;
    if (this.bossParts.core) { const c = this.bossParts.core as THREE.Mesh; c.visible = true; (c.material as THREE.MeshBasicMaterial).color.set(b.core ? "#7CFFB2" : "#3A4A3A"); c.scale.setScalar(b.core ? 1 + Math.sin(this.time * 12) * 0.12 : 0.8); }
    if (this.bossParts.beam) this.bossParts.beam.visible = b.pullT > 0;
    g.position.set(b.x, fly || step * 0.18, b.z);
    g.rotation.z = Math.sin(this.time * 3.2) * (fly ? 0.03 : 0.06);
    if (b.kind === "spiky") g.rotation.x = b.roll > 0 ? g.rotation.x + dt * 9 : g.rotation.x * Math.max(0, 1 - dt * 8);
    if (b.kind === "boat") g.rotation.z = Math.sin(this.time * 1.8) * 0.08;
    if (this.bossShield) { this.bossShield.visible = b.shieldT > 0; this.bossShield.scale.setScalar(1 + Math.sin(this.time * 14) * 0.04); }
    const s = b.r / 1.0;
    g.scale.set(s, s * (1 - step * 0.06), s);
    if (this.bossBody) {
      const m = this.bossBody.material as THREE.MeshPhongMaterial | THREE.MeshLambertMaterial;
      m.emissive.set(b.hitT > 0 ? "#FFFFFF" : b.rage ? "#5A0010" : "#000000");
      (m as THREE.MeshLambertMaterial).emissiveIntensity = b.hitT > 0 ? 0.55 : b.rage ? 0.35 + Math.sin(this.time * 10) * 0.15 : 0;
    }
  }
  private makeBoss(b: Boss) {
    if (this.bossObj) { this.scene.remove(this.bossObj); this.disposeGroup(this.bossObj, true); }
    const g = new THREE.Group();
    this.bossShield = null;
    this.bossParts = {};
    const simple: Partial<Record<Boss["kind"], () => THREE.BufferGeometry>> = {
      mega: M.megaGrump, kranky: M.krankyKrab, cloud: M.stormCloud, balloon: M.balloonBaron, spiky: M.sirSpikes, chef: M.chefGrumble,
      yeti: M.yetiGeo, robo: M.roboGeo, boat: M.boatGeo, ghost: M.ghostGeo, golem: M.golemGeo, magma: M.magmaGeo, ufo: M.ufoGeo, mech: M.mechGeo,
    };
    const mk = simple[b.kind];
    if (mk) {
      const m = new THREE.Mesh(mk(), new THREE.MeshLambertMaterial({ vertexColors: true })); g.add(m); this.bossBody = m;
      if (b.kind === "ghost") { const mat = m.material as THREE.MeshLambertMaterial; mat.transparent = true; mat.opacity = 0.9; }
      if (b.kind === "robo") { const a = new THREE.Mesh(M.roboArmor(), new THREE.MeshLambertMaterial({ vertexColors: true })); g.add(a); this.bossParts.armor = a; }
      if (b.kind === "golem") {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: "#7CFFB2" }));
        core.position.set(0, 1.6, 0.62); g.add(core); this.bossParts.core = core;
      }
      if (b.kind === "ufo") {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#B6FFB0", transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
        cone.position.set(0, -2.1, 0); cone.visible = false; g.add(cone); this.bossParts.beam = cone;
      }
      if (b.kind === "kranky" || b.kind === "mech") {
        const sh = new THREE.Mesh(new THREE.SphereGeometry(1.75, 20, 14), new THREE.MeshPhongMaterial({ color: "#8FE3FF", emissive: "#3BB4E0", emissiveIntensity: 0.5, transparent: true, opacity: 0.35, shininess: 120 }));
        sh.position.set(0, 1.0, 0.2); sh.visible = false; g.add(sh); this.bossShield = sh;
      }
    } else {
      const j = M.jellyKing();
      const body = new THREE.Mesh(j.jelly, new THREE.MeshPhongMaterial({ color: "#5FD873", transparent: true, opacity: 0.86, shininess: 120, specular: "#FFFFFF" }));
      g.add(body, new THREE.Mesh(j.deco, new THREE.MeshLambertMaterial({ vertexColors: true }))); this.bossBody = body;
    }
    this.bossObj = g; this.bossKey = `${b.kind}:${b.mini}`;
    this.scene.add(g);
  }
  private disposeGroup(g: THREE.Object3D, keepShared = false) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (!keepShared || (m.geometry !== this.jarGeo && m.geometry !== this.pinGeo)) m.geometry.dispose();
      const mat = m.material as THREE.Material & { map?: THREE.Texture | null };
      mat.map?.dispose(); mat.dispose();
    });
  }

  // ---------------------------------------------------------------- effects
  private burst(x: number, y: number, z: number, n: number, speed = 3.2, oc?: THREE.Color) {
    const max = this.confetti.instanceMatrix.count;
    for (let i = 0; i < n && this.parts.length < max; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ x, y, z, vx: Math.cos(a) * v, vy: 2.5 + Math.random() * speed, vz: Math.sin(a) * v * 0.7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18, life: 0, max: 0.9 + Math.random() * 0.6, c: Math.floor(Math.random() * CONFETTI.length), s: 0.8 + Math.random() * 0.8, oc });
    }
  }
  private puff(x: number, y: number, z: number, s: number, c = 6) {
    if (this.puffList.length >= this.puffs.instanceMatrix.count) return;
    this.puffList.push({ x, y, z, vx: 0, vy: 0.6, vz: 0, r: 0, vr: 0, life: 0, max: 0.35, c, s });
  }
  private fly(x0: number, z0: number, n: number) {
    const units = this.sim.units;
    for (let i = 0; i < n && this.flyList.length < 160; i++) {
      const u = units[Math.floor(Math.random() * Math.max(1, units.length))] ?? { ox: 0, oz: 0 };
      this.flyList.push({ x0: x0 + (Math.random() - 0.5) * 0.8, z0: z0 + (Math.random() - 0.5) * 0.6, t: -i * 0.04, dur: 0.42 + Math.random() * 0.15, ox: u.ox, oz: u.oz });
    }
  }
  private popBudget = 0;
  private onEvent(e: SimEvent) {
    switch (e.t) {
      case "pop": {
        // big pops always show; small ones are sampled when hundreds pop at once
        this.popBudget++;
        if (e.big || this.popBudget % (this.parts.length > 500 ? 4 : 1) === 0) this.burst(e.x, 0.5, e.z, e.big ? 4 : 2, 2.6);
        this.puff(e.x, 0.45, e.z, 0.32);
        break;
      }
      case "hit": this.shake = Math.min(1, this.shake + 0.35 + e.n * 0.02); this.puff(e.x, 0.5, e.z, 0.6, 0); this.burst(e.x, 0.5, e.z, 4, 2); break;
      case "recruit": if (!e.coin) this.fly(e.x, e.z, Math.min(6, e.n)); else this.burst(e.x, 0.4, e.z, 5, 2); break;
      case "gate": if (e.good) this.burst(e.x, 1.6, 0.2, 18, 3.5); else this.shake = Math.min(1, this.shake + 0.3); break;
      case "blockBreak":
        this.burst(e.x, 1, e.z, e.kind === "jar" ? 40 : 26, 4.2);
        for (let i = 0; i < 6; i++) this.puff(e.x + (Math.random() - 0.5), 0.8, e.z + (Math.random() - 0.5), 0.6);
        if (e.kind === "cage") this.fly(e.x, e.z, Math.min(14, e.n));
        break;
      case "bossDown": this.burst(e.x, 1.6, e.z, 90, 6); this.shake = 0.6; break;
      case "bossSmash": this.shake = 1; break;
      case "land":
        if (e.kind === "zap") this.boltList.push({ x: e.x, z: e.z, t: 0 });
        this.burst(e.x, 0.3, e.z, e.hit ? 26 : 12, 3.4, BOMB_BALL[e.kind] ?? GOO_BALL);
        this.puff(e.x, 0.4, e.z, 1.1, e.kind === "zap" ? 1 : 6);
        if (e.hit) this.shake = Math.min(1, this.shake + 0.5);
        break;
      case "bossCharge": this.shake = Math.min(1, this.shake + 0.2); break;
      case "surf": if (e.stage === "hit") { this.waveT = 0; this.waveDir = e.dir; this.shake = Math.min(1, this.shake + 0.4); } break;
      case "cakeBomb": this.burst(e.x, 0.6, e.z, 22, 4, CAKE_BALL); this.puff(e.x, 0.6, e.z, 1.4, 6); break;
      case "power": this.burst(e.x, 0.8, e.z, 30, 4); this.puff(this.sim.bx, 1, 0, 1.6, 1); break;
      case "leaderPower": this.burst(this.sim.bx, 1.5, -0.5, 40, 5); this.puff(this.sim.bx, 1.2, 0, 2.2, 1); break;
      case "boulderHit": this.burst(e.x, 0.6, 0, e.hit ? 26 : 12, 3.5, BOMB_BALL.rock); if (e.hit) this.shake = Math.min(1, this.shake + 0.6); break;
      case "burn": this.burst(this.sim.bx, 0.4, 0, 3, 2, BOMB_BALL.lava); break;
      case "vent": if (e.state === "erupt") this.burst(e.x, 0.5, 0.1, 18, 4, BOMB_BALL.lava); break;
      case "bossDrop": this.puff(this.sim.boss?.x ?? 0, 3, this.sim.boss?.z ?? -20, 1.2); break;
      case "merge": this.puff(this.sim.bx, 0.8, 0, 0.9 + e.tier * 0.5, 1); break;
      case "end": if (e.won) for (let i = 0; i < 6; i++) this.burst(this.sim.bx + (Math.random() - 0.5) * 6, 4, -2 - Math.random() * 6, 30, 3); break;
      default: break;
    }
  }
  private stepParticles(dt: number) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y = Math.max(0.03, p.y + p.vy * dt); p.z += p.vz * dt; p.r += p.vr * dt;
      if (p.y <= 0.03) { p.vx *= 0.8; p.vz *= 0.8; p.vr *= 0.7; }
      const s = p.s * (1 - Math.max(0, p.life - p.max + 0.25) * 4);
      put(this.confetti, n, p.x, p.y, p.z, s, s, p.r);
      setCol(this.confetti, n, p.oc ?? CONFETTI[p.c]);
      n++;
    }
    this.confetti.count = n;
    let m = 0;
    for (let i = this.puffList.length - 1; i >= 0; i--) {
      const p = this.puffList[i];
      p.life += dt;
      if (p.life >= p.max) { this.puffList.splice(i, 1); continue; }
      const f = p.life / p.max, s = p.s * (0.5 + f * 1.1) * (1 - f * f);
      put(this.puffs, m, p.x, p.y + p.vy * p.life, p.z, s, s);
      setCol(this.puffs, m, p.c === 0 ? this.col.set("#FF6B8A") : p.c === 1 ? this.col.set("#FFE27A") : WHITE);
      m++;
    }
    this.puffs.count = m;
    let f = 0;
    const s = this.sim;
    for (let i = this.flyList.length - 1; i >= 0; i--) {
      const p = this.flyList[i];
      p.t += dt;
      if (p.t >= p.dur) { this.flyList.splice(i, 1); continue; }
      if (p.t < 0) continue;
      const u = p.t / p.dur, x = p.x0 + (s.bx + p.ox - p.x0) * u, z = p.z0 + (p.oz - p.z0) * u, y = Math.sin(u * Math.PI) * 1.6;
      put(this.fliers, f, x, y, z, 0.3, 0.3);
      setCol(this.fliers, f, TIER_COLOR[0]);
      f++;
    }
    this.fliers.count = f;
    done(this.confetti, this.puffs, this.fliers);
  }

  dispose() {
    this.gov?.dispose();
    for (const g of this.gateObjs.values()) this.disposeGroup(g);
    for (const g of this.blockObjs.values()) this.disposeGroup(g, true);
    if (this.bossObj) this.disposeGroup(this.bossObj, true);
    this.jarGeo.dispose(); this.pinGeo.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    for (const d of this.disposables) d.dispose();
    this.atlas.tex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

