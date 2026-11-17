// Track items: pickups (coins, nitro bottles, shields, magnets, ramps) and hazards (fire barrels, oil,
// cones, rocks, spike strips, puddles) + Coin Rush checkpoint gates. Placed per mode by a deterministic
// pattern generator (fair: hazards are telegraphed, spaced by difficulty, never block every lane, never
// sit in blind tight bends or right after a gate). Drawn with one InstancedMesh per kind, an additive
// flame mesh for fire barrels and one additive glow-sprite pool so pickups and hazards read from far away.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ItemKind, ModeId, ThemeSpec, TrackItem } from "./types";
import type { Track } from "./track";
import { mulberry } from "./track";

/** lateral half-width of each item's hit zone (m), added to the car's half width */
export const ITEM_RADIUS: Record<ItemKind, number> = { coin: 0.9, nitro: 1.0, shield: 1.1, magnet: 1.1, ramp: 2.0, fire: 0.75, oil: 1.7, cones: 1.3, rock: 1.0, spikes: 2.1, puddle: 2.1 };
/** half length along the road */
const ITEM_LEN: Record<ItemKind, number> = { coin: 0.7, nitro: 0.7, shield: 0.8, magnet: 0.8, ramp: 1.6, fire: 0.75, oil: 1.7, cones: 0.6, rock: 1.0, spikes: 0.35, puddle: 2.1 };
export const HAZARDS = new Set<ItemKind>(["fire", "oil", "cones", "rock", "spikes", "puddle"]);
/** hazards that cost a life in Coin Rush */
export const LIFE_HAZARDS = new Set<ItemKind>(["fire", "rock", "spikes"]);
/** ramps launch with this power (coin arcs are laid out for it) */
export const RAMP_POWER = 1.3;

function colorize(g: THREE.BufferGeometry, c: string) {
  const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  const out = g.index ? g.toNonIndexed() : g;
  if (out.attributes.uv) out.deleteAttribute("uv");
  return out;
}
const M = (parts: [THREE.BufferGeometry, string][]) => mergeGeometries(parts.map(([g, c]) => colorize(g, c)));

function itemGeometry(kind: ItemKind): { g: THREE.BufferGeometry; mat: THREE.Material; y: number; spin: boolean } {
  const std = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, ...o });
  switch (kind) {
    case "coin": return { g: M([[new THREE.CylinderGeometry(0.66, 0.66, 0.14, 22).rotateX(Math.PI / 2), "#FFC93C"], [new THREE.CylinderGeometry(0.46, 0.46, 0.18, 22).rotateX(Math.PI / 2), "#FFE58A"], [new THREE.BoxGeometry(0.14, 0.5, 0.2), "#E8A200"]]), mat: std({ metalness: 0.75, roughness: 0.25, emissive: new THREE.Color("#8a5c00"), emissiveIntensity: 0.75 }), y: 1.1, spin: true };
    case "nitro": return { g: M([[new THREE.CapsuleGeometry(0.42, 1.0, 4, 12), "#2E8BFF"], [new THREE.CylinderGeometry(0.44, 0.44, 0.26, 14), "#F4F1E6"], [new THREE.CylinderGeometry(0.18, 0.22, 0.34, 10).translate(0, 0.9, 0), "#E6EDF5"], [new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10).translate(0, 1.08, 0), "#E8504F"]]), mat: std({ emissive: new THREE.Color("#0a4bff"), emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.25 }), y: 1.2, spin: true };
    case "shield": return { g: M([[new THREE.IcosahedronGeometry(0.8, 1), "#7CF2FF"], [new THREE.OctahedronGeometry(0.42, 0), "#FFFFFF"]]), mat: std({ transparent: true, opacity: 0.8, emissive: new THREE.Color("#2bd8ff"), emissiveIntensity: 1, flatShading: true }), y: 1.3, spin: true };
    case "magnet": return { g: M([[new THREE.TorusGeometry(0.55, 0.2, 10, 20, Math.PI), "#E8504F"], [new THREE.BoxGeometry(0.4, 0.34, 0.4).translate(0.55, -0.14, 0), "#E6EDF5"], [new THREE.BoxGeometry(0.4, 0.34, 0.4).translate(-0.55, -0.14, 0), "#E6EDF5"]]), mat: std({ emissive: new THREE.Color("#7a0010"), emissiveIntensity: 0.8 }), y: 1.3, spin: true };
    case "ramp": {
      const sh = new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(2.5, 0), new THREE.Vector2(2.5, 1.15), new THREE.Vector2(1.8, 1.15)]);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 4.4, bevelEnabled: false }); g.translate(0, 0, -2.2); g.rotateY(-Math.PI / 2);
      const slope = Math.atan2(1.15, 4.3);
      const parts: [THREE.BufferGeometry, string][] = [[g, "#FFB000"]];
      for (let i = 0; i < 3; i++) { const z = -1.6 + i * 1.3; parts.push([new THREE.BoxGeometry(4.5, 0.05, 0.42).rotateX(-slope).translate(0, (z + 2.5) * Math.tan(slope) + 0.04, z), "#1b1b22"]); }
      parts.push([new THREE.BoxGeometry(4.6, 0.12, 0.25).translate(0, 1.2, 2.25), "#F4F1E6"]);
      return { g: M(parts), mat: std({ roughness: 0.55, emissive: new THREE.Color("#4a2a00"), emissiveIntensity: 0.4 }), y: 0, spin: false };
    }
    case "fire": return { g: M([[new THREE.CylinderGeometry(0.52, 0.52, 1.25, 14).translate(0, 0.62, 0), "#C9302C"], [new THREE.CylinderGeometry(0.535, 0.535, 0.22, 14).translate(0, 0.62, 0), "#FFD23A"], [new THREE.CylinderGeometry(0.54, 0.54, 0.08, 14).translate(0, 0.25, 0), "#2a2a2a"], [new THREE.CylinderGeometry(0.54, 0.54, 0.08, 14).translate(0, 1.0, 0), "#2a2a2a"], [new THREE.CylinderGeometry(0.46, 0.46, 0.05, 14).translate(0, 1.26, 0), "#3a1a0a"]]).scale(1.25, 1.25, 1.25), mat: std({ emissive: new THREE.Color("#ff3a00"), emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.3 }), y: 0, spin: false };
    case "oil": return { g: M([[new THREE.CircleGeometry(1.9, 20).rotateX(-Math.PI / 2), "#0d0d12"], [new THREE.CircleGeometry(0.9, 16).rotateX(-Math.PI / 2).translate(0.6, 0.006, 0.3), "#3a2c6a"], [new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2).translate(-0.7, 0.008, -0.5), "#1d4a5a"], [new THREE.CircleGeometry(0.7, 14).rotateX(-Math.PI / 2).translate(-1.4, 0.004, 0.9), "#0d0d12"]]), mat: std({ roughness: 0.05, metalness: 0.7 }), y: 0.05, spin: false };
    case "cones": {
      const parts: [THREE.BufferGeometry, string][] = [];
      for (const [x, z] of [[-1.0, 0], [0, 0.35], [1.0, 0]]) { parts.push([new THREE.ConeGeometry(0.32, 0.9, 12).translate(x, 0.5, z), "#FF7A1A"], [new THREE.CylinderGeometry(0.21, 0.25, 0.14, 12).translate(x, 0.55, z), "#FFFFFF"], [new THREE.BoxGeometry(0.66, 0.06, 0.66).translate(x, 0.03, z), "#222"]); }
      return { g: M(parts), mat: std({ emissive: new THREE.Color("#5a1d00"), emissiveIntensity: 0.5 }), y: 0, spin: false };
    }
    case "rock": return { g: M([[new THREE.DodecahedronGeometry(1, 0).scale(1.2, 0.85, 1).translate(0, 0.62, 0), "#8C847C"], [new THREE.DodecahedronGeometry(0.5, 0).translate(0.95, 0.3, 0.4), "#7a726a"]]), mat: std({ flatShading: true, roughness: 1 }), y: 0, spin: false };
    case "spikes": {
      const parts: [THREE.BufferGeometry, string][] = [];
      for (let i = 0; i < 6; i++) parts.push([new THREE.BoxGeometry(0.75, 0.1, 0.62).translate(-1.9 + i * 0.76, 0.05, 0), i % 2 ? "#FFD23A" : "#1b1b22"]);
      for (let i = 0; i < 11; i++) parts.push([new THREE.ConeGeometry(0.13, 0.45, 5).translate(-2 + i * 0.4, 0.32, 0), "#D9DEE6"]);
      return { g: M(parts), mat: std({ metalness: 0.7, roughness: 0.3, emissive: new THREE.Color("#ff2020"), emissiveIntensity: 0.2 }), y: 0, spin: false };
    }
    case "puddle": return { g: M([[new THREE.CircleGeometry(2.3, 22).rotateX(-Math.PI / 2), "#5AA9E6"], [new THREE.CircleGeometry(1.2, 18).rotateX(-Math.PI / 2).translate(1.2, 0.004, -0.6), "#7cc0f0"]]), mat: std({ transparent: true, opacity: 0.72, roughness: 0.02, metalness: 0.4 }), y: 0.04, spin: false };
  }
}

const GLOW: Partial<Record<ItemKind, [string, number, number]>> = {
  // colour, size (m), height above the item's base
  coin: ["#FFC93C", 1.9, 1.1], nitro: ["#3BA8FF", 3.0, 1.2], shield: ["#7CF2FF", 3.2, 1.3], magnet: ["#FF5A8E", 3.0, 1.3],
  fire: ["#FF6A00", 5.4, 2.0], rock: ["#FF4A2A", 3.2, 0.9], spikes: ["#FF2A3A", 3.0, 0.4], cones: ["#FF8A1F", 2.4, 0.6], ramp: ["#FFB000", 4.0, 1.0],
};

// ---------------------------------------------------------------- layout
export interface LayoutOpts {
  pickups: boolean; hazards: boolean; seed: number;
  /** 0 (kind) .. 1 (brutal): hazard density, patterns, spacing */
  difficulty?: number;
  /** expected cruising speed (m/s) for coin arcs over ramps */
  refSpeed?: number;
}
export interface Layout { items: TrackItem[]; gates: number[] }

export function layoutItems(track: Track, mode: ModeId, theme: ThemeSpec, o: LayoutOpts): Layout {
  const rnd = mulberry(o.seed * 13 + 5);
  const L = track.length, hw = track.halfWidth;
  const D = Math.max(0, Math.min(1, o.difficulty ?? 0.4));
  const items: TrackItem[] = [];
  let id = 0;
  const add = (kind: ItemKind, s: number, d: number, h = 0) => { const it: TrackItem = { id: id++, kind, s: track.wrap(s), d: Math.max(-hw + 0.9, Math.min(hw - 0.9, d)), taken: false, respawnAt: 0 }; if (h > 0) it.h = h; items.push(it); };
  const lanes = [-hw * 0.55, 0, hw * 0.55];
  const lane = () => lanes[Math.floor(rnd() * 3)];
  const kAbs = (s: number) => Math.abs(track.kappa(s));
  const straight = (s: number, len: number) => { for (let x = 0; x <= len; x += 6) if (kAbs(s + x) > 0.0028) return false; return true; };
  const gates: number[] = [];
  const softPool = theme.hazards.filter((k) => k === "oil" || k === "cones" || k === "puddle");
  const soft = (softPool.length ? softPool : ["cones", "oil"]) as ItemKind[];

  if (mode === "coinrush") {
    const n = Math.max(3, Math.min(7, Math.round(L / 520)));
    for (let k = 0; k < n; k++) gates.push(((k + 1) * L) / n - 25);
    const nearGate = (s: number) => gates.some((g) => { const x = s - g; return x > -10 && x < 32; });
    const life: ItemKind[] = ["fire"];
    for (const k of theme.hazards) if ((k === "rock" || k === "spikes") && !life.includes(k)) life.push(k);
    if (D > 0.3 && !life.includes("rock")) life.push("rock");
    if (D > 0.55 && !life.includes("spikes")) life.push("spikes");
    const hazProb = o.hazards ? 0.3 + D * 0.42 : 0;
    const hazGap = 78 - D * 40;
    let lastHaz = -999, lastNitro = 0, lastPower = 120, ramps = 0;
    const maxRamps = Math.round(2 + D * 2);
    // no hazards in blind tight bends (any difficulty) or right after a gate
    const tightAround = (s: number, lim: number) => { for (let x = -30; x <= 10; x += 5) if (kAbs(s + x) > lim) return true; return false; };
    const canHaz = (s: number) => o.hazards && s - lastHaz >= hazGap && s > 95 && s < L - 30 && !nearGate(s) && !tightAround(s, D > 0.7 ? 0.016 : 0.011);
    const lifeOrSoft = () => (rnd() < 0.55 + D * 0.35 ? life[Math.floor(rnd() * life.length)] : soft[Math.floor(rnd() * soft.length)]);
    const coinLine = (s: number, d: number, n: number, gap = 4.5) => { for (let i = 0; i < n; i++) add("coin", s + i * gap, d); };
    let s = 70;
    while (s < L - 45) {
      let len = 0;
      const li = Math.floor(rnd() * 3);
      if (o.pickups && s - lastNitro > 260 - D * 60) {
        // nitro bottle with a coin lead-in
        coinLine(s, lanes[li], 4); add("nitro", s + 22, lanes[li]); lastNitro = s; len = 26;
      } else if (o.pickups && s - lastPower > 520 - D * 80 && rnd() < 0.6) {
        coinLine(s, lanes[li], 4); add(rnd() < 0.5 ? "shield" : "magnet", s + 22, lanes[li]); lastPower = s; len = 26;
      } else if (canHaz(s) && rnd() < hazProb) {
        const pick = rnd();
        if (D >= 0.45 && pick < 0.25 && !tightAround(s + 45, 0.011) && !tightAround(s + 90, 0.011) && !nearGate(s + 90)) {
          // slalom: alternate sides, coins on the safe side
          const side = rnd() < 0.5 ? 0 : 2;
          for (let i = 0; i < 3; i++) { const hl = i % 2 ? 2 - side : side; add(lifeOrSoft(), s + i * (34 - D * 6), lanes[hl]); coinLine(s + i * (34 - D * 6) - 4, lanes[2 - hl], 3); }
          len = 3 * (34 - D * 6); lastHaz = s + len;
        } else if (D >= 0.22 && pick < 0.6) {
          // gate: two lanes blocked, the coin line shows the way through the third
          const open = li;
          for (let k = 0; k < 3; k++) if (k !== open) add(k === (open + 1) % 3 ? lifeOrSoft() : (rnd() < D ? life[Math.floor(rnd() * life.length)] : soft[Math.floor(rnd() * soft.length)]), s + 14, lanes[k] + (rnd() - 0.5) * 0.8);
          coinLine(s, lanes[open], 7); len = 30; lastHaz = s + 14;
        } else {
          // single hazard, coins on another lane
          const k = lifeOrSoft();
          add(k, s + 12, k === "spikes" ? lanes[li] * 0.9 : lanes[li] + (rnd() - 0.5) * 1.2);
          coinLine(s, lanes[(li + 1 + Math.floor(rnd() * 2)) % 3], 6); len = 28; lastHaz = s + 12;
        }
      } else if (o.pickups) {
        const pick = rnd();
        if (pick < 0.18 && ramps < maxRamps && straight(s, 75)) {
          // ramp + coin arc in the air
          const v = o.refSpeed ?? 45, vy = (5.5 + v * 0.06) * RAMP_POWER, T = (2 * vy) / 22, dist = v * T;
          add("ramp", s, lanes[li]);
          for (let i = 1; i <= 8; i++) { const x = 3 + (i * dist) / 9, t = x / v, h = vy * t - 11 * t * t; add("coin", s + 2 + x, lanes[li], Math.max(0, h)); }
          ramps++; len = dist + 12;
        } else if (pick < 0.45) {
          // weave across the road
          const n = 10, from = rnd() < 0.5 ? -1 : 1;
          for (let i = 0; i < n; i++) add("coin", s + i * 4.6, from * Math.cos((i / (n - 1)) * Math.PI) * hw * 0.55);
          len = n * 4.6;
        } else if (pick < 0.65) {
          // lane change diagonal
          const a = lanes[li], b = lanes[(li + 1 + Math.floor(rnd() * 2)) % 3];
          for (let i = 0; i < 8; i++) add("coin", s + i * 4.6, a + ((b - a) * i) / 7);
          len = 37;
        } else if (pick < 0.75 && o.hazards) {
          // soft patch (oil / puddle / cones) with coins either side
          add(soft[Math.floor(rnd() * soft.length)], s + 12, lanes[li]);
          coinLine(s, lanes[(li + 1) % 3], 6); len = 28;
        } else { coinLine(s, lanes[li], 7 + Math.floor(rnd() * 3)); len = 40; }
      }
      s += len + (34 - D * 16) * (0.8 + rnd() * 0.4);
    }
  } else {
    const start = 60, end = L - 30;
    const timetrial = mode === "timetrial";
    if (o.pickups) {
      for (let s = start; s < end; s += (timetrial ? 200 : 150) * (0.8 + rnd() * 0.4)) {
        const d0 = lane(), curve = rnd() < 0.35 ? (rnd() - 0.5) * 0.6 : 0;
        for (let k = 0; k < 5; k++) add("coin", s + k * 4.5, d0 + curve * k * 4.5);
      }
      for (let s = start + 90; s < end; s += (timetrial ? 260 : 230) * (0.8 + rnd() * 0.4)) add("nitro", s, lane());
      if (!timetrial) {
        for (let s = start + 400; s < end; s += 650 + rnd() * 300) add(rnd() < 0.5 ? "shield" : "magnet", s, lane());
        if (mode === "race") for (let x = start + rnd() * (end - start), k = 0; k < 20; k++, x += 40) if (straight(x, 70)) { add("ramp", x, lane()); break; }
      }
    }
    if (o.hazards && !timetrial) {
      const gap = 330 - D * 90;
      for (let s = start + 160; s < end; s += gap * (0.75 + rnd() * 0.5)) {
        if (kAbs(s) > 0.012) continue;
        add(soft[Math.floor(rnd() * soft.length)], s, lane() + (rnd() - 0.5) * 2);
      }
    }
  }
  items.sort((a, b) => a.s - b.s);
  items.forEach((it, i) => (it.id = i));
  return { items, gates };
}

// ---------------------------------------------------------------- field
function bannerTexture() {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96;
  const g = cv.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, "#1b1440"); gr.addColorStop(1, "#0b0718");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 96);
  g.fillStyle = "#ffffff"; g.font = "bold 58px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("CHECKPOINT", 256, 50);
  for (let i = 0; i < 2; i++) { g.save(); g.translate(i ? 470 : 42, 48); g.scale(i ? 1 : -1, 1); g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(-16, -22); g.lineTo(8, 0); g.lineTo(-16, 22); g.lineTo(-6, 0); g.closePath(); g.fill(); g.restore(); }
  g.strokeStyle = "#ffffff"; g.lineWidth = 6; g.strokeRect(3, 3, 506, 90);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function curtainTexture() {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 128;
  const g = cv.getContext("2d")!;
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  g.globalCompositeOperation = "destination-out";
  for (let x = 0; x < 64; x += 16) { g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x, 0, 6, 128); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

type KindMesh = { mesh: THREE.InstancedMesh; list: TrackItem[]; idx: Int32Array; y: number; spin: boolean };

export class ItemField {
  items: TrackItem[] = [];
  meshes = new Map<ItemKind, KindMesh>();
  group = new THREE.Group();
  /** coin rush checkpoint gates (s positions, ascending) */
  gates: number[] = [];
  /** coins per lap */
  coinCount = 0;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private hits: TrackItem[] = [];
  private pending: TrackItem[] = [];
  private respawnT = 0;
  private flames: { mesh: THREE.InstancedMesh; list: TrackItem[] } | null = null;
  private glow: { points: THREE.Points; alpha: Float32Array; slot: Int32Array; mat: THREE.ShaderMaterial } | null = null;
  private gateMeshes: { frame: THREE.InstancedMesh; banner: THREE.InstancedMesh; curtain: THREE.InstancedMesh; state: Uint8Array; col: THREE.Color } | null = null;
  private pulseMats: { m: THREE.MeshStandardMaterial; base: number; amp: number; f: number }[] = [];
  private sArr: Float32Array;
  private fireIdx: Int32Array;
  private lastT = 0;

  constructor(private track: Track, mode: ModeId, theme: ThemeSpec, opts: LayoutOpts, glowScale = 520) {
    const lay = layoutItems(track, mode, theme, opts);
    this.items = lay.items; this.gates = lay.gates;
    this.sArr = new Float32Array(this.items.map((i) => i.s));
    this.coinCount = this.items.filter((i) => i.kind === "coin").length;
    this.fireIdx = new Int32Array(this.items.length).fill(-1);
    // meshes
    const kinds = [...new Set(this.items.map((i) => i.kind))];
    for (const k of kinds) {
      const def = itemGeometry(k);
      const list = this.items.filter((i) => i.kind === k);
      const mesh = new THREE.InstancedMesh(def.g, def.mat, list.length);
      mesh.castShadow = k === "fire" || k === "rock" || k === "ramp";
      mesh.frustumCulled = false;
      if (def.spin) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const idx = new Int32Array(this.items.length).fill(-1);
      list.forEach((it, i) => (idx[it.id] = i));
      this.meshes.set(k, { mesh, list, idx, y: def.y, spin: def.spin });
      this.group.add(mesh);
      list.forEach((it, i) => this.place(mesh, i, it, 0, def.y, def.spin));
      mesh.instanceMatrix.needsUpdate = true;
      const sm = def.mat as THREE.MeshStandardMaterial;
      if (k === "spikes") this.pulseMats.push({ m: sm, base: 0.25, amp: 0.6, f: 6 });
      if (k === "nitro") this.pulseMats.push({ m: sm, base: 0.9, amp: 0.4, f: 4 });
      if (k === "fire") this.pulseMats.push({ m: sm, base: 0.35, amp: 0.25, f: 11 });
    }
    // fire barrel flames
    const fires = this.items.filter((i) => i.kind === "fire");
    if (fires.length) {
      const fg = M([[new THREE.ConeGeometry(0.58, 1.9, 9, 1, true).translate(0, 0.95, 0), "#FF6A1A"], [new THREE.ConeGeometry(0.36, 1.25, 8, 1, true).translate(0, 0.62, 0), "#FFE14A"]]);
      const fm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.InstancedMesh(fg, fm, fires.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
      this.flames = { mesh, list: fires };
      fires.forEach((it, i) => (this.fireIdx[it.id] = i));
      fires.forEach((it, i) => this.placeFlame(i, it, 0));
      this.group.add(mesh);
    }
    // glow sprites (one draw call for every glowing item)
    const glowing = this.items.filter((i) => GLOW[i.kind]);
    if (glowing.length) {
      const n = glowing.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), phase = new Float32Array(n);
      const slot = new Int32Array(this.items.length).fill(-1);
      const c = new THREE.Color();
      glowing.forEach((it, i) => {
        const [hex, sz, h] = GLOW[it.kind]!;
        track.point(it.s, it.d, this.p);
        pos[i * 3] = this.p.x; pos[i * 3 + 1] = this.p.y + h + (it.h ?? 0); pos[i * 3 + 2] = this.p.z;
        c.set(hex); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        size[i] = sz; alpha[i] = it.kind === "coin" ? 0.45 : 0.75; phase[i] = it.id * 0.37; slot[it.id] = i;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("size", new THREE.BufferAttribute(size, 1)); g.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1)); g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
        uniforms: { time: { value: 0 }, scale: { value: glowScale } },
        vertexShader: `attribute float size; attribute float alpha; attribute float phase; uniform float time; uniform float scale; varying float vA; varying vec3 vC;
          void main(){ vC = color; float p = 0.82 + 0.18 * sin(time * 4.0 + phase); vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float dist = -mv.z; vA = alpha * p * smoothstep(320.0, 160.0, dist) * smoothstep(2.0, 9.0, dist);
            gl_PointSize = min(220.0, size * p * scale / max(1.0, dist)); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0 || vA <= 0.0) discard; float a = vA * pow(1.0 - r, 2.2); gl_FragColor = vec4(vC * a, a); }`,
      });
      const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 4;
      this.glow = { points, alpha, slot, mat };
      this.group.add(points);
    }
    if (this.gates.length && typeof document !== "undefined") this.buildGates();
  }

  private buildGates() {
    const tr = this.track, hw = tr.halfWidth, n = this.gates.length;
    const span = hw + 1.6, H = 6.2;
    const frameG = M([
      [new THREE.BoxGeometry(0.7, H, 0.7).translate(span, H / 2, 0), "#F4F1E6"], [new THREE.BoxGeometry(0.7, H, 0.7).translate(-span, H / 2, 0), "#F4F1E6"],
      [new THREE.BoxGeometry(0.9, 0.5, 0.9).translate(span, 0.25, 0), "#1b1b22"], [new THREE.BoxGeometry(0.9, 0.5, 0.9).translate(-span, 0.25, 0), "#1b1b22"],
      [new THREE.BoxGeometry(span * 2 + 0.7, 1.3, 0.5).translate(0, H - 0.65, 0), "#F4F1E6"],
    ]);
    const frame = new THREE.InstancedMesh(frameG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.25 }), n);
    const banner = new THREE.InstancedMesh(new THREE.PlaneGeometry(span * 1.5, span * 1.5 * (96 / 512)).rotateY(Math.PI).translate(0, H - 0.65, -0.27), new THREE.MeshBasicMaterial({ map: bannerTexture(), toneMapped: false }), n);
    const ct = curtainTexture(); ct.repeat.set(span / 2, 1);
    const curtain = new THREE.InstancedMesh(new THREE.PlaneGeometry(span * 2, H - 1.3).translate(0, (H - 1.3) / 2, 0), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), n);
    frame.castShadow = true;
    for (const m of [frame, banner, curtain]) m.frustumCulled = false;
    this.gates.forEach((s, i) => {
      tr.point(s, 0, this.p);
      this.q.setFromAxisAngle(this.up, tr.heading(s));
      this.sc.set(1, 1, 1);
      this.m4.compose(this.p, this.q, this.sc);
      frame.setMatrixAt(i, this.m4); banner.setMatrixAt(i, this.m4); curtain.setMatrixAt(i, this.m4);
    });
    const col = new THREE.Color();
    this.gateMeshes = { frame, banner, curtain, state: new Uint8Array(n), col };
    for (let i = 0; i < n; i++) this.setGate(i, i === 0 ? 1 : 0);
    this.group.add(frame, banner, curtain);
  }

  /** gate visual state: 0 = upcoming, 1 = next (bright, pulsing), 2 = passed this lap */
  setGate(i: number, state: 0 | 1 | 2) {
    const G = this.gateMeshes; if (!G || i < 0 || i >= G.state.length) return;
    G.state[i] = state;
    const c = G.col.set(state === 1 ? "#3CFF8F" : state === 2 ? "#555a66" : "#4FD8FF");
    G.frame.setColorAt(i, c); G.curtain.setColorAt(i, c); G.banner.setColorAt(i, c);
    G.frame.instanceColor!.needsUpdate = true; G.curtain.instanceColor!.needsUpdate = true; G.banner.instanceColor!.needsUpdate = true;
  }

  private place(mesh: THREE.InstancedMesh, i: number, it: TrackItem, t: number, y: number, spin = false) {
    const tr = this.track;
    tr.point(it.s, it.d, this.p);
    this.p.y += y + (it.h ?? 0) + (spin ? Math.sin(t * 3 + it.id) * 0.15 : 0);
    const h = tr.heading(it.s) + (spin ? t * 3 + it.id : 0);
    this.q.setFromAxisAngle(this.up, h);
    const k = it.taken ? 0.0001 : 1;
    this.sc.set(k, k, k);
    this.m4.compose(this.p, this.q, this.sc);
    mesh.setMatrixAt(i, this.m4);
  }
  private placeFlame(i: number, it: TrackItem, t: number) {
    const f = this.flames!; const tr = this.track;
    tr.point(it.s, it.d, this.p); this.p.y += 1.56;
    const ph = it.id * 1.7;
    this.q.setFromAxisAngle(this.up, t * 2.2 + ph);
    const k = it.taken ? 0.0001 : 1;
    this.sc.set(k * (0.92 + Math.sin(t * 13 + ph) * 0.08), k * (1 + Math.sin(t * 17 + ph) * 0.18 + Math.sin(t * 7.3 + ph) * 0.1), k * (0.92 + Math.cos(t * 11 + ph) * 0.08));
    this.m4.compose(this.p, this.q, this.sc);
    f.mesh.setMatrixAt(i, this.m4);
  }

  /** first index with s >= x */
  private lower(x: number) { let lo = 0, hi = this.sArr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (this.sArr[m] < x) lo = m + 1; else hi = m; } return lo; }
  /** call fn for every item with s in [s0, s1] (wrapping) */
  each(s0: number, s1: number, fn: (it: TrackItem) => void) {
    const L = this.track.length, n = this.items.length;
    if (!n) return;
    if (s1 - s0 >= L) { for (const it of this.items) fn(it); return; }
    const a = this.track.wrap(s0), b = a + (s1 - s0);
    for (let i = this.lower(a); i < n && this.items[i].s <= b; i++) fn(this.items[i]);
    if (b > L) for (let i = 0; i < n && this.items[i].s <= b - L; i++) fn(this.items[i]);
  }

  /** animate pickups / flames near the focus, pulse materials, respawn taken items */
  update(t: number, focusS: number) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT)); this.lastT = t;
    for (const pm of this.pulseMats) pm.m.emissiveIntensity = pm.base + Math.sin(t * pm.f) * pm.amp * 0.5 + pm.amp * 0.5;
    if (this.glow) this.glow.mat.uniforms.time.value = t;
    const L = this.track.length, n = this.items.length;
    if (n) {
      const a = this.track.wrap(focusS - 12), b = a + 200;
      for (let i = this.lower(a); i < n && this.items[i].s <= b; i++) this.animate(this.items[i], t);
      if (b > L) for (let i = 0; i < n && this.items[i].s <= b - L; i++) this.animate(this.items[i], t);
      for (const m of this.meshes.values()) if (m.spin) m.mesh.instanceMatrix.needsUpdate = true;
      if (this.flames) this.flames.mesh.instanceMatrix.needsUpdate = true;
    }
    // respawns (checked twice a second)
    this.respawnT -= dt;
    if (this.respawnT <= 0 && this.pending.length) {
      this.respawnT = 0.5;
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const it = this.pending[i];
        if (t > it.respawnAt && Math.abs(this.track.delta(focusS, it.s)) > 90) { this.pending.splice(i, 1); this.reveal(it, t); }
      }
    }
  }
  private animate(it: TrackItem, t: number) {
    if (it.taken) return;
    if (it.kind === "fire") { if (this.flames) this.placeFlame(this.fireIdx[it.id], it, t); return; }
    const m = this.meshes.get(it.kind)!;
    if (m.spin) this.place(m.mesh, m.idx[it.id], it, t, m.y, true);
  }

  /** items the car at (s, d) touches this frame — returns a shared array, consume it immediately */
  touching(s: number, d: number, halfLen: number, magnet = 0, carY = 0, halfWid = 0.95) {
    const out = this.hits; out.length = 0;
    const n = this.items.length; if (!n) return out;
    const reachM = magnet > 0 ? 7 : 0;
    const q = this.q0; q.s = s; q.d = d; q.halfLen = halfLen; q.reach = reachM; q.y = carY; q.hw = halfWid;
    const L = this.track.length, a = this.track.wrap(s - halfLen - 3 - reachM), b = a + 2 * (halfLen + 3 + reachM);
    for (let i = this.lower(a); i < n && this.items[i].s <= b; i++) this.test(this.items[i]);
    if (b > L) for (let i = 0; i < n && this.items[i].s <= b - L; i++) this.test(this.items[i]);
    return out;
  }
  private q0 = { s: 0, d: 0, halfLen: 0, reach: 0, y: 0, hw: 0 };
  private test(it: TrackItem) {
    if (it.taken) return;
    const q = this.q0;
    const ds = Math.abs(this.track.delta(q.s, it.s));
    const coin = it.kind === "coin", haz = HAZARDS.has(it.kind);
    const reach = coin ? q.reach : 0;
    const lat = ITEM_RADIUS[it.kind] + q.hw * (haz ? 0.8 : 1) + (haz ? 0 : 0.35) + reach;
    if (ds > q.halfLen * (haz ? 0.85 : 1) + ITEM_LEN[it.kind] + reach || Math.abs(it.d - q.d) > lat) return;
    // airborne coins need a jump; ground items can be flown over
    const h = it.h ?? 0;
    if (coin ? Math.abs(q.y - h) > 1.5 + (reach ? 2 : 0) : q.y > (it.kind === "fire" ? 2.0 : it.kind === "rock" ? 1.3 : 0.5)) return;
    this.hits.push(it);
  }

  take(it: TrackItem, now: number, respawn: number) {
    it.taken = true; it.respawnAt = respawn > 0 ? now + respawn : 0;
    if (respawn > 0) this.pending.push(it);
    this.refresh(it, now);
  }
  private reveal(it: TrackItem, now: number) { it.taken = false; it.respawnAt = 0; this.refresh(it, now); }
  private refresh(it: TrackItem, now: number) {
    const m = this.meshes.get(it.kind)!;
    this.place(m.mesh, m.idx[it.id], it, now, m.y, m.spin);
    m.mesh.instanceMatrix.needsUpdate = true;
    if (it.kind === "fire" && this.flames) { this.placeFlame(this.fireIdx[it.id], it, now); this.flames.mesh.instanceMatrix.needsUpdate = true; }
    if (this.glow) { const g = this.glow.slot[it.id]; if (g >= 0) { this.glow.alpha[g] = it.taken ? 0 : it.kind === "coin" ? 0.45 : 0.75; this.glow.points.geometry.attributes.alpha.needsUpdate = true; } }
  }
  /** a new lap in coin rush: everything comes back (when out of sight) */
  resetAll(now: number) { for (const it of this.items) if (it.taken && !this.pending.includes(it)) { it.respawnAt = now; this.pending.push(it); } }
  setGlowScale(v: number) { if (this.glow) this.glow.mat.uniforms.scale.value = v; }

  /** gate pulse (call each frame with the index of the next gate) */
  pulseGate(i: number, t: number) {
    const G = this.gateMeshes; if (!G || i < 0 || i >= G.state.length) return;
    const k = 0.75 + Math.sin(t * 7) * 0.25;
    const c = G.col.set("#3CFF8F").multiplyScalar(k + 0.25);
    G.curtain.setColorAt(i, c); G.curtain.instanceColor!.needsUpdate = true;
  }

  dispose() {
    for (const { mesh } of this.meshes.values()) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    if (this.flames) { this.flames.mesh.geometry.dispose(); (this.flames.mesh.material as THREE.Material).dispose(); }
    if (this.glow) { this.glow.points.geometry.dispose(); this.glow.mat.dispose(); }
    if (this.gateMeshes) for (const m of [this.gateMeshes.frame, this.gateMeshes.banner, this.gateMeshes.curtain]) { m.geometry.dispose(); const mt = m.material as THREE.MeshBasicMaterial; mt.map?.dispose(); mt.dispose(); }
  }
}
