// Momo Jelly Jam board extras (phase 2–3): special floor tiles with icons, pits and bridges, edge rails, doors that
// rise and sink (switch doors, laser fences, grumpies, vines, popcorn, stone, crates, tape, balloons…), pick-ups
// (stars, coins, keys), floor drains and packing boxes, worn tiles (crumble / glass / counters) and fog. The renderer
// builds one of these per stage and calls update() whenever the state changes and frame() every frame.
import * as THREE from "three";
import { doorSolid } from "../rules";
import { CELL, COLORS, TILE, type Level, type State } from "../types";
import * as M from "./models";

const EMOJI_TILE: Partial<Record<number, [string, string, boolean?]>> = {
  [TILE.ice]: ["❄", "#8FD6FF", true], [TILE.mud]: ["≋", "#8B5A2B", true], [TILE.tele]: ["🌀", "#7B5CFF"], [TILE.rinse]: ["💧", "#BFE6FF"],
  [TILE.shrink]: ["−", "#FF7A7A", true], [TILE.stretch]: ["+", "#5ED88A", true], [TILE.split]: ["✂", "#FFB23F", true], [TILE.bumper]: ["↩", "#FF5A8A", true],
  [TILE.spring]: ["⇈", "#43C76B", true], [TILE.bubble]: ["○", "#7FE3FF", true], [TILE.thorns]: ["🌵", "#4F9E4A"], [TILE.crumble]: ["✶", "#E8C79A", true],
  [TILE.glass]: ["◇", "#CDEBFF", true], [TILE.counter]: ["3", "#9A93B5", true], [TILE.switch]: ["⏻", "#5B33C9", true], [TILE.plate]: ["▣", "#6B6F86", true],
  [TILE.filterC]: ["⧉", "#888888", true], [TILE.filterS]: ["↔", "#6A7CA8", true], [TILE.snare]: ["🕸", "#7E6BAE"], [TILE.wind]: ["➜", "#7FC8FF", true],
  [TILE.target]: ["🎯", "#FFFFFF"], [TILE.wash]: ["🧼", "#BDF0FF"], [TILE.splash]: ["●", "#7A4A22", true], [TILE.charger]: ["⚡", "#2A2450"],
  [TILE.glue]: ["🍯", "#FFD27A"], [TILE.nosquish]: ["🚫", "#FFFFFF"], [TILE.trap]: ["⚠", "#FF4D4D", true], [TILE.rewind]: ["⏪", "#4E5BD8"],
  [TILE.bouncer]: ["🔁", "#FF8A2B"], [TILE.copy]: ["⧉", "#3FC9B4", true], [TILE.tilt]: ["⇧", "#FF9F43", true], [TILE.swap]: ["🔀", "#E07BD8"],
  [TILE.magnet]: ["🧲", "#FFFFFF"], [TILE.lamp]: ["💡", "#2A2450"], [TILE.press]: ["▤", "#8C9BB5", true],
};
const DOOR_LOOK: Record<string, [string, string, number?]> = {
  wall: ["", "#7E8AA8"], laser: ["⚡", "#FF3B5C", 0.75], red: ["", "#EE2233"], blue: ["", "#2F7BFF"], grumpy: ["😠", "#8E5BFF"], vine: ["🌿", "#3E9E46"],
  popcorn: ["🍿", "#FFF2D0"], stone: ["🗿", "#8E95A3"], crate: ["📦", "#C98B4E"], tape: ["📎", "#FFE08A"], balloon: ["🎈", "#FF7FB6"], bridge: ["", "#B9844F"],
  blink: ["⏱", "#3FC9B4"], crusher: ["⬇", "#6E7E9A"], glass: ["◇", "#CDEBFF", 0.7], domino: ["⚀", "#F7F3EA"], fuse: ["🧨", "#FF6A3D"], zap: ["⚡", "#FFD23F", 0.8],
  arm: ["🕐", "#A87F4E"], shield: ["🛡", "#5ED8E8", 0.8], cage: ["⛓", "#9AA0AE"],
};

interface DoorView { group: THREE.Group; look: string; solid: boolean; k: number; icon: THREE.Mesh | null; plank: THREE.Mesh | null }

export class BoardExtras {
  readonly root = new THREE.Group();
  private own: <T extends { dispose(): void }>(x: T) => T;
  private L: Level;
  private doors: DoorView[] = [];
  private items = new Map<number, THREE.Object3D>();
  private wearViews = new Map<number, THREE.Mesh>();
  private fog = new Map<number, { mesh: THREE.Mesh; gone: boolean }>();
  private revealed = new Set<number>();
  private switchMats = new Map<number, THREE.MeshStandardMaterial>();
  private texCache = new Map<string, THREE.Texture>();
  private time = 0;
  private peekAt = -1;

  constructor(L: Level, s: State, own: <T extends { dispose(): void }>(x: T) => T, wallCol: string) {
    this.L = L; this.own = own;
    const W = L.W, H = L.H, ox = -W / 2, oy = -H / 2;
    const at = (ci: number, z: number, o: THREE.Object3D) => { o.position.set(ox + (ci % W) + 0.5, oy + ((ci / W) | 0) + 0.5, z); this.root.add(o); return o; };
    const plane = (w: number, h: number) => own(new THREE.PlaneGeometry(w, h));
    // pits and bridges
    const pitMat = own(new THREE.MeshStandardMaterial({ color: "#1B1430", roughness: 0.95 }));
    const rimMat = own(new THREE.MeshStandardMaterial({ color: "#3A2E5A", roughness: 0.8 }));
    const plankMat = own(new THREE.MeshStandardMaterial({ map: own(M.plankTex()), roughness: 0.7 }));
    for (let ci = 0; ci < W * H; ci++) {
      if (L.walls[ci] === CELL.pit || L.walls[ci] === CELL.bridge) {
        at(ci, -0.16, new THREE.Mesh(plane(0.96, 0.96), pitMat));
        const rim = new THREE.Mesh(own(M.rbox(0.98, 0.98, 0.08, 0.04, 2)), rimMat); at(ci, -0.2, rim);
        if (L.walls[ci] === CELL.bridge) { const p = new THREE.Mesh(plane(0.9, 0.98), plankMat); p.receiveShadow = true; at(ci, 0.02, p); }
      }
    }
    // special tiles
    for (let ci = 0; ci < W * H; ci++) {
      const t = L.tiles[ci];
      const v = L.tval?.[ci] ?? 0;
      if (t === TILE.paint) { at(ci, 0.013, new THREE.Mesh(plane(0.86, 0.86), this.mat(`paint${v & 15}`, () => M.iconTex("🎨", COLORS[v & 15].hex)))); continue; }
      if (t === TILE.filterC) { at(ci, 0.013, new THREE.Mesh(plane(0.86, 0.86), this.mat(`filter${v}`, () => M.iconTex("⧉", COLORS[v]?.hex ?? "#888", "#FFFFFF", true)))); continue; }
      if (t === TILE.counter) { const m = new THREE.Mesh(plane(0.86, 0.86), this.mat(`counter${v}`, () => M.iconTex(String(v || 3), "#9A93B5", "#FFFFFF", true))); at(ci, 0.013, m); this.wearViews.set(ci, m); continue; }
      if (t === TILE.star || t === TILE.coin || t === TILE.key) {
        const icon = t === TILE.star ? "⭐" : t === TILE.coin ? "💰" : "🔑";
        const m = new THREE.Mesh(plane(0.62, 0.62), this.mat(`item${icon}`, () => M.emojiBadge(icon, "rgba(255,255,255,0)"), true));
        m.scale.set(1, 0.67, 1);
        this.items.set(ci, at(ci, 0.32, m));
        continue;
      }
      const look = EMOJI_TILE[t];
      if (!look) continue;
      const m = new THREE.Mesh(plane(0.86, 0.86), this.mat(`tile${t}`, () => M.iconTex(look[0], look[1], "#FFFFFF", !!look[2])));
      if (t === TILE.wind || t === TILE.tilt) m.rotation.z = [0, -Math.PI / 2, Math.PI, Math.PI / 2][L.tdir[ci]];
      m.receiveShadow = true;
      at(ci, 0.013, m);
      if (t === TILE.switch) this.switchMats.set(ci, m.material as THREE.MeshStandardMaterial);
      if (t === TILE.crumble || t === TILE.glass) this.wearViews.set(ci, m);
    }
    // edge rails
    if (L.rails) {
      const railMat = own(new THREE.MeshStandardMaterial({ color: "#F4F1FF", roughness: 0.3, metalness: 0.2 }));
      const hGeo = own(M.rbox(1.0, 0.1, 0.42, 0.04, 2)), vGeo = own(M.rbox(0.1, 1.0, 0.42, 0.04, 2));
      for (let ci = 0; ci < W * H; ci++) {
        const r = L.rails[ci]; if (!r) continue;
        const x = ci % W, y = (ci / W) | 0;
        if (r & 1) { const m = new THREE.Mesh(hGeo, railMat); m.position.set(ox + x + 0.5, oy + y + 1, 0.2); m.castShadow = true; this.root.add(m); }
        if (r & 2) { const m = new THREE.Mesh(vGeo, railMat); m.position.set(ox + x + 1, oy + y + 0.5, 0.2); m.castShadow = true; this.root.add(m); }
      }
    }
    // doors
    const doorGeo = own(M.rbox(0.9, 0.9, 0.62, 0.14, 2)), iconGeo = plane(0.6, 0.6);
    L.doors?.forEach((d, di) => {
      const [icon, col, alpha] = DOOR_LOOK[d.look] ?? DOOR_LOOK.wall;
      const group = new THREE.Group();
      const colour = d.look === "wall" ? wallCol : col;
      const mat = own(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, transparent: !!alpha, opacity: alpha ?? 1 }));
      let iconMesh: THREE.Mesh | null = null, plank: THREE.Mesh | null = null;
      for (const ci of d.cells) {
        if (d.look === "bridge") {
          at(ci, -0.16, new THREE.Mesh(plane(0.96, 0.96), pitMat));
          plank = new THREE.Mesh(plane(0.92, 0.98), plankMat); plank.position.set(ox + (ci % W) + 0.5, oy + ((ci / W) | 0) + 0.5, 0.02); group.add(plank);
          continue;
        }
        const b = new THREE.Mesh(doorGeo, mat); b.position.set(ox + (ci % W) + 0.5, oy + ((ci / W) | 0) + 0.5, 0.31); b.castShadow = true; b.receiveShadow = true; group.add(b);
        if (icon) { iconMesh = new THREE.Mesh(iconGeo, this.mat(`door${icon}`, () => M.emojiBadge(icon, "rgba(255,255,255,0)"), true)); iconMesh.scale.set(1, 0.67, 1); iconMesh.position.set(b.position.x, b.position.y, 0.64); group.add(iconMesh); }
      }
      this.root.add(group);
      const solid = doorSolid(L, s, di);
      this.doors.push({ group, look: d.look, solid, k: solid ? 1 : 0, icon: iconMesh, plank });
    });
    // floor drains and boxes
    L.gates.forEach((g) => {
      if (g.side !== 4) return;
      const gx = g.at % W, gy = (g.at / W) | 0, gh = g.h ?? 1;
      const box = g.kind === "box";
      const colour = box ? "#FFFFFF" : COLORS[g.color]?.hex ?? "#FFFFFF";
      const mat = own(new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: colour, emissiveIntensity: box ? 0.08 : 0.15 }));
      const cx = ox + gx + g.w / 2, cy = oy + gy + gh / 2;
      const t = 0.09;
      for (const [w, h, x, y] of [[g.w + t * 2, t, cx, oy + gy - t / 2], [g.w + t * 2, t, cx, oy + gy + gh + t / 2], [t, gh, ox + gx - t / 2, cy], [t, gh, ox + gx + g.w + t / 2, cy]]) {
        const m = new THREE.Mesh(own(M.rbox(w, h, 0.16, 0.03, 2)), mat); m.position.set(x, y, 0.06); this.root.add(m);
      }
      if (!box) {
        const hole = new THREE.Mesh(plane(g.w - 0.06, gh - 0.06), own(new THREE.MeshStandardMaterial({ color: new THREE.Color(colour).multiplyScalar(0.35), roughness: 0.9, transparent: true, opacity: 0.55 })));
        hole.position.set(cx, cy, 0.016); this.root.add(hole);
      } else if (g.cmap) {
        g.cmap.forEach((c, k) => {
          if (c < 0) return;
          const dot = new THREE.Mesh(own(new THREE.CircleGeometry(0.16, 20)), own(new THREE.MeshBasicMaterial({ color: COLORS[c].hex, transparent: true, opacity: 0.85 })));
          dot.position.set(ox + gx + (k % g.w) + 0.5, oy + gy + Math.floor(k / g.w) + 0.5, 0.017); this.root.add(dot);
        });
      }
    });
    // fog
    const fogCells = L.rules?.view?.fog ?? [];
    if (fogCells.length) {
      const fogMat = own(new THREE.MeshBasicMaterial({ map: own(M.fogTex()), transparent: true, depthWrite: false }));
      for (const ci of fogCells) { const m = new THREE.Mesh(plane(1.6, 1.6), fogMat.clone()); this.own(m.material as THREE.Material); m.renderOrder = 5; at(ci, 0.95, m); this.fog.set(ci, { mesh: m, gone: false }); }
      // lamps light their corner from the start
      L.tiles.forEach((t, ci) => { if (t === TILE.lamp) this.revealAround(ci, 2); });
    }
    if (L.rules?.view?.peek) this.peekAt = L.rules.view.peek;
    this.update(s, true);
  }

  private mat(key: string, make: () => THREE.Texture, basic = false): THREE.Material {
    let t = this.texCache.get(key);
    if (!t) { t = this.own(make()); this.texCache.set(key, t); }
    return this.own(basic ? new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, transparent: true }));
  }
  private revealAround(ci: number, r: number) {
    const W = this.L.W, x0 = ci % W, y0 = (ci / W) | 0;
    for (const [c, f] of this.fog) { const dx = Math.abs((c % W) - x0), dy = Math.abs(((c / W) | 0) - y0); if (dx <= r && dy <= r && !f.gone) { f.gone = true; this.revealed.add(c); } }
  }

  /** match the state: doors, pick-ups, worn tiles, switches, fog */
  update(s: State, snap = false) {
    const L = this.L;
    this.doors.forEach((d, i) => { d.solid = doorSolid(L, s, i); if (snap) d.k = d.solid ? 1 : 0; });
    for (const [ci, m] of this.items) m.visible = !s.got.includes(ci);
    for (let i = 0; i < s.wear.length; i += 2) {
      const ci = s.wear[i], n = s.wear[i + 1], m = this.wearViews.get(ci);
      if (!m) continue;
      const t = L.tiles[ci], max = t === TILE.crumble ? 1 : t === TILE.glass ? 2 : L.tval?.[ci] ?? 3;
      const broken = n >= max;
      const mm = m.material as THREE.MeshStandardMaterial;
      if (t === TILE.counter) { mm.map = this.own(M.iconTex(broken ? "■" : String(max - n), broken ? "#5E4E8E" : "#9A93B5", "#FFFFFF", true)); mm.needsUpdate = true; m.scale.setScalar(broken ? 1.05 : 1); m.position.z = broken ? 0.3 : 0.013; }
      else { mm.color.set(broken ? "#1B1430" : "#FFFFFF"); mm.opacity = broken ? 0.95 : 1 - n * 0.25; }
    }
    for (const [ci, mat] of this.switchMats) { const g = L.tval?.[ci] ?? 0; mat.color.set(((s.sw >> g) & 1) ? "#FFE36A" : "#FFFFFF"); }
    // fog lifts where a jelly lands (jellies hiding in the fog at the start stay hidden until something moves there)
    if (this.fog.size) {
      for (const p of s.pieces) {
        const key = `${p.x},${p.y},${p.c.length}`;
        if (!snap && this.seenAt.get(p.id) !== key) for (let i = 0; i < p.c.length; i += 2) this.revealAround((p.y + p.c[i + 1]) * L.W + p.x + p.c[i], 1);
        this.seenAt.set(p.id, key);
      }
    }
    this.last = s;
  }
  private last: State | null = null;
  private seenAt = new Map<number, string>();
  /** R20 peek: after a few seconds the whole tray fogs over (and clears again wherever jellies go) */
  private peekFog() {
    const L = this.L, W = L.W, ox = -W / 2, oy = -L.H / 2;
    const mat = this.own(new THREE.MeshBasicMaterial({ map: this.own(M.fogTex()), transparent: true, depthWrite: false }));
    const geo = this.own(new THREE.PlaneGeometry(1.6, 1.6));
    for (let ci = 0; ci < W * L.H; ci++) {
      if (L.walls[ci] === CELL.wall || this.fog.has(ci)) continue;
      const m = new THREE.Mesh(geo, mat.clone()); this.own(m.material as THREE.Material);
      (m.material as THREE.MeshBasicMaterial).opacity = 0;
      m.renderOrder = 5; m.position.set(ox + (ci % W) + 0.5, oy + ((ci / W) | 0) + 0.5, 0.95); this.root.add(m);
      this.fog.set(ci, { mesh: m, gone: false });
    }
    if (this.last) this.update(this.last);
  }

  frame(dt: number) {
    this.time += dt;
    for (const d of this.doors) {
      const target = d.solid ? 1 : 0;
      d.k += (target - d.k) * Math.min(1, dt * 10);
      if (d.look === "bridge") { if (d.plank) d.plank.visible = d.k < 0.5; continue; }
      d.group.scale.z = 0.08 + d.k * 0.92;
      d.group.visible = d.k > 0.02;
      if (d.icon) d.icon.visible = d.k > 0.6;
    }
    for (const m of this.items.values()) { m.position.z = 0.32 + Math.sin(this.time * 3 + m.position.x) * 0.05; }
    for (const f of this.fog.values()) {
      const m = f.mesh.material as THREE.MeshBasicMaterial;
      if (f.gone) { m.opacity = Math.max(0, m.opacity - dt * 2); f.mesh.visible = m.opacity > 0.01; }
      else if (m.opacity < 1) m.opacity = Math.min(1, m.opacity + dt * 1.5);
    }
    if (this.peekAt > 0 && this.time > this.peekAt) { this.peekAt = -1; this.peekFog(); }
  }
}
