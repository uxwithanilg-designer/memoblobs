// Momo Jelly Jam 3D renderer (three.js): a toy tray on a themed table with the world's props around it, glossy jelly
// pieces with blinking faces that watch your finger, gates with arrows (and their badges: locks, numbers, queues,
// stars…), floor drains and boxes, turn / flip pads, belts, arrows and every special floor tile, doors, pits, rails,
// fog — and every move animated: glide, turn on a pad, ride a belt, slide on ice, teleport, squish into one block
// (bloop!), slide out of the gate or sink into a drain, confetti.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { worldOf, type World } from "./data/worlds";
import { cond, gateAt, gateOpen, gateW, shapeKey } from "./rules";
import { BoardExtras } from "./three/extras";
import * as M from "./three/models";
import { CELL, COLORS, CRATE, DX, DY, GOLD, RAINBOW, STONE, CLEAR, TILE, type Cond, type JamEvent, type Level, type Move, type Piece, type State } from "./types";

export type Quality = "low" | "medium" | "high";
/** Jelly Shop looks: jelly finish, tray skin, confetti */
export interface JamStyle { finish: string; tray: string; confetti: string }
const TRAY_SKIN: Record<string, string> = { wood: "#B88456", marble: "#EDEDF2", candy: "#FF8FC8", galaxy: "#2A1F5A" };
const CONFETTI: Record<string, string[]> = {
  gold: ["#FFD54A", "#FFC21A", "#E89B00", "#FFF1A8"],
  pastels: ["#FFC8DD", "#BDE0FE", "#CDB4DB", "#FFFFC2", "#CAFFBF"],
};

interface View {
  id: number; color: number; key: string; c: number[];
  group: THREE.Group; body: THREE.Group; jelly: THREE.Mesh; face: THREE.Group; pupils: THREE.Mesh; lids: THREE.Mesh; sym: THREE.Mesh | null;
  /** logical origin (cells) and the visual one it glides to */
  x: number; y: number; vx: number; vy: number; z: number; tz: number;
  sq: number; sqv: number; blink: number; dead: boolean;
  /** a timeline step owns its scale / turn right now */
  anim: boolean;
}
interface Step { t0: number; dur: number; run: (k: number) => void; end?: () => void }
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; color: THREE.Color; rot: number; vr: number }
interface GateView { group: THREE.Group; body: THREE.Mesh[]; mats: THREE.MeshPhysicalMaterial[]; badge: THREE.Mesh | null; badgeMat: THREE.MeshBasicMaterial | null; badgeKey: string; base: THREE.Vector3 }

const ease = (k: number) => 1 - (1 - k) * (1 - k);
const easeIn = (k: number) => k * k;
const RAINBOW_HEX = ["#EE2233", "#FF8A2B", "#FFC21A", "#2FCB52", "#23C8E8", "#2F7BFF", "#8E5BFF"];

/** the emoji badge a special jelly wears */
function badgeOf(p: Piece, s: State, L: Level): string {
  const f = p.f, out: string[] = [];
  if (p.color === CRATE && !f?.kranky) return "";
  if (!f) return "";
  if (f.kranky) out.push("😈");
  if (f.king) out.push("👑");
  if (f.keeper) out.push("📌");
  if (f.must) out.push("❗");
  if (f.timer !== undefined) out.push(`⏳${Math.max(0, f.timer - s.moves)}`);
  if (f.lock && !cond(L, s, f.lock)) out.push(f.lock.t === "key" ? "⛓" : f.lock.t === "hit" ? "🧊" : "🔒");
  if (f.frozen !== undefined && f.frozen > s.moves) out.push("❄");
  if (f.heavy) out.push("⚓");
  if (f.ghost) out.push("👻");
  if (f.bouncy) out.push("🏀");
  if (f.axis !== undefined) out.push(f.axis === 0 ? "↔" : "↕");
  if (f.arrow !== undefined) out.push(["⬆", "➡", "⬇", "⬅"][f.arrow]);
  if (f.lazy) out.push("💤");
  if (f.dirty) out.push("💩");
  if (f.battery) out.push("🔋");
  if (f.contrary || L.rules?.mirror) out.push("🔄");
  if (f.once || f.sealed) out.push("①");
  if (f.hungry) out.push("😋");
  if (f.magnet) out.push("🧲");
  if (f.spinner) out.push("🌀");
  if (f.baby) out.push("🍼");
  if (f.chameleon) out.push("🦎");
  if (f.shy) out.push("🙈");
  if (f.copycat) out.push("🐱");
  if (f.leader) out.push("⭐");
  if (f.twin !== undefined) out.push("👯");
  if (f.alt !== undefined) out.push(COLORS[f.alt]?.sym ?? "");
  if (f.num !== undefined) out.push(`#${f.num}`);
  if (f.setBy !== undefined) out.push(`⏳${Math.max(0, f.setBy - s.moves)}`);
  return out.slice(0, 2).join("");
}
/** the icon a gate shows while it is locked */
function lockIcon(c: Cond): string {
  switch (c.t) {
    case "key": return "🔑"; case "sw": return "⏻"; case "plate": return "▣"; case "cov": return "🎯"; case "coins": return "💰";
    case "out": return "✋"; case "rest": return "🏁"; case "sq": return "👐"; default: return "🔒";
  }
}

export class JellyRenderer {
  readonly cv: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
  private q: Quality;
  private w = 1; private h = 1; private insetTop = 0; private insetBottom = 0;
  private L: Level | null = null;
  private S: State | null = null;
  private world: World = worldOf(1);
  private spin = new THREE.Group();
  private board = new THREE.Group();
  private table: THREE.Mesh; private tableMat: THREE.MeshStandardMaterial;
  private props = new THREE.Group();
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private lamps: THREE.PointLight[] = [];
  private keepList: { dispose(): void }[] = [];
  private keep<T extends { dispose(): void }>(x: T): T { this.keepList.push(x); return x; }
  private levelOwn: { dispose(): void }[] = [];
  private own<T extends { dispose(): void }>(x: T): T { this.levelOwn.push(x); return x; }
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private matCache = new Map<string, THREE.MeshPhysicalMaterial>();
  private lidMat = new Map<number, THREE.MeshStandardMaterial>();
  private rainbowMats: THREE.MeshPhysicalMaterial[] = [];
  private faceGeo = M.faceParts();
  private faceMat: THREE.MeshStandardMaterial;
  private views = new Map<number, View>();
  private steps: Step[] = [];
  private time = 0;
  private padBadges: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; last: number }[] = [];
  private gateBadges: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; last: number }[] = [];
  private gateViews: GateView[] = [];
  private gateGroups: THREE.Group[] = [];
  private beltTexs: THREE.Texture[] = [];
  private extras: BoardExtras | null = null;
  private ghost: THREE.Mesh | null = null; private ghostMat: THREE.MeshStandardMaterial;
  private parts: Part[] = []; private bits: THREE.InstancedMesh;
  private look = new THREE.Vector2(0, 0);
  private m4 = new THREE.Matrix4(); private q4 = new THREE.Quaternion(); private v3 = new THREE.Vector3(); private s3 = new THREE.Vector3(); private e3 = new THREE.Euler();
  private ray = new THREE.Raycaster(); private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -M.JELLY_TOP * 0.5);
  private shake = 0;
  /** the tray's turn (R30 twist, S05 / S06), radians: current and target */
  private turn = 0; private turnTo = 0;
  private mode: string | undefined;
  /** slower glides (S20 delay) */
  private slow = 1;
  private style: JamStyle = { finish: "glossy", tray: "world", confetti: "party" };
  setStyle(st: JamStyle) { this.style = { ...st }; for (const m of this.matCache.values()) m.dispose(); this.matCache.clear(); this.rainbowMats = []; }

  constructor(host: HTMLElement, quality: Quality) {
    this.q = quality;
    const R = this.renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", alpha: false, powerPreference: "high-performance", stencil: false });
    this.cv = R.domElement;
    Object.assign(this.cv.style, { display: "block", position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
    this.cv.setAttribute("aria-label", "Momo Jelly Jam board");
    host.appendChild(this.cv);
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = true;
    R.shadowMap.type = quality === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(R);
    // the tray faces +z: turn the room so its bright ceiling lights sit under the table (otherwise the jelly tops
    // mirror them and red reads as pink near the top of the tray); the walls still give a soft gloss
    const room = new RoomEnvironment();
    room.rotation.x = -Math.PI / 2;
    this.scene.environment = this.keep(pm.fromScene(room, 0.04).texture);
    pm.dispose();
    this.hemi = new THREE.HemisphereLight("#FFFFFF", "#C9B8A8", 0.85);
    this.sun = new THREE.DirectionalLight("#FFF4E4", 2.1);
    this.sun.position.set(-5, 7, 14);
    this.sun.castShadow = true;
    const sm = quality === "high" ? 2048 : quality === "medium" ? 1536 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.02;
    const sc = this.sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40;
    const fill = new THREE.DirectionalLight("#DDEBFF", 0.45); fill.position.set(6, -4, 8);
    this.scene.add(this.hemi, this.sun, fill);
    // the table
    this.tableMat = this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.8, envMapIntensity: 0.35 }));
    this.table = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(120, 120)), this.tableMat);
    this.table.position.z = -0.42; this.table.receiveShadow = true;
    this.spin.add(this.board);
    this.scene.add(this.table, this.props, this.spin);
    this.faceMat = this.keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, envMapIntensity: 0.8 }));
    this.ghostMat = this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.6, emissive: "#FFFFFF", emissiveIntensity: 0.35, roughness: 0.4, depthWrite: false }));
    for (const g of Object.values(this.faceGeo)) this.keep(g);
    // confetti
    this.bits = new THREE.InstancedMesh(this.keep(M.rbox(0.16, 0.08, 0.03, 0.01, 1)), this.keep(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.5 })), 260);
    this.bits.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(260 * 3).fill(1), 3);
    this.bits.count = 0; this.bits.frustumCulled = false;
    this.scene.add(this.bits);
    this.keep({ dispose: () => this.bits.dispose() });
  }

  // ---------------------------------------------------------------- sizing
  /** the board is fitted into the space between the HUD (top) and the buttons (bottom), CSS pixels */
  setInsets(top: number, bottom: number) { this.insetTop = top; this.insetBottom = bottom; this.fit(); }
  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    const dpr = Math.min(window.devicePixelRatio || 1, this.q === "high" ? 2 : this.q === "medium" ? 1.7 : 1.3);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.fit();
  }
  private fit() {
    const L = this.L;
    // a quarter-turned tray swaps its sides
    const quarter = Math.abs(Math.round(this.turnTo / (Math.PI / 2))) % 2 === 1;
    const bw = ((quarter ? L?.H : L?.W) ?? 6) + 2.0, bh = ((quarter ? L?.W : L?.H) ?? 8) + 2.0;
    const availH = Math.max(120, this.h - this.insetTop - this.insetBottom);
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // distance so the tray fits both the width and the free height
    const dW = bw / (2 * tanH * (this.w / this.h)), dH = (bh * (this.h / availH)) / (2 * tanH);
    const dist = Math.max(dW, dH);
    const pxPerUnit = this.h / (2 * dist * tanH);
    const off = (this.insetTop - this.insetBottom) / 2 / pxPerUnit;
    const tilt = 0.16;
    this.camera.position.set(0, off - dist * Math.sin(tilt), dist * Math.cos(tilt));
    this.camera.lookAt(0, off, 0);
    this.camera.near = Math.max(0.5, dist - 30); this.camera.far = dist + 60;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- the stage
  setLevel(L: Level, s: State) {
    this.clearLevel();
    this.L = L; this.S = s;
    this.world = worldOf(L.world);
    const Wd = this.world, look = Wd.look;
    const v = L.rules?.view;
    this.mode = v?.mode;
    this.slow = v?.delay ? 2.2 : 1;
    this.turn = this.turnTo = 0; this.spin.rotation.z = 0;
    for (const m of this.matCache.values()) m.dispose();
    this.matCache.clear(); this.rainbowMats = [];
    const night = !!look.night || this.mode === "night" || this.mode === "neon";
    this.hemi.intensity = this.mode === "night" ? 0.3 : night ? 0.55 : 0.85;
    this.sun.intensity = this.mode === "night" ? 0.6 : night ? 1.5 : 2.1;
    this.renderer.toneMappingExposure = night ? 1.12 : 1.05;
    this.scene.background = new THREE.Color(this.mode === "neon" ? "#120C26" : look.sky);
    // table: the world's surface, a different grain every stage
    const old = this.tableMat.map;
    const tt = M.tableTex(Wd.props, this.mode === "neon" ? "#0E0A1E" : look.table, L.look + 1);
    tt.repeat.set(10, 10);
    this.tableMat.map = tt; this.tableMat.color.set("#FFFFFF"); this.tableMat.needsUpdate = true;
    old?.dispose();
    // tray colours vary a touch from stage to stage
    const shift = ((L.look % 7) - 3) * 0.012;
    const frameCol = new THREE.Color(TRAY_SKIN[this.style.tray] ?? look.frame).offsetHSL(shift, 0, ((L.look >> 3) % 3 - 1) * 0.03);
    const W = L.W, H = L.H, ox = -W / 2, oy = -H / 2;
    const frame = new THREE.Mesh(this.own(M.trayFrame(W, H)), this.own(new THREE.MeshStandardMaterial({ color: frameCol, roughness: 0.32, envMapIntensity: 0.7 })));
    frame.castShadow = frame.receiveShadow = true;
    this.board.add(frame);
    // tray base under the tiles
    const neon = this.mode === "neon";
    const base = new THREE.Mesh(this.own(M.rbox(W + 0.3, H + 0.3, 0.3, 0.12, 2)), this.own(new THREE.MeshStandardMaterial({ color: neon ? "#1B1238" : new THREE.Color(look.floor2).multiplyScalar(0.92), roughness: 0.7 })));
    base.position.z = -0.27; base.receiveShadow = true;
    this.board.add(base);
    // floor tiles: checker / plain / rows, chosen per stage
    const pattern = L.look % 3;
    const free: number[] = [];
    for (let i = 0; i < W * H; i++) if (L.walls[i] === CELL.floor) free.push(i);
    const tiles = new THREE.InstancedMesh(this.own(M.floorTile()), this.own(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.55, envMapIntensity: 0.4 })), Math.max(1, free.length));
    const c1 = new THREE.Color(neon ? "#2A1F4A" : look.floor), c2 = new THREE.Color(neon ? "#241A40" : look.floor2);
    free.forEach((ci, k) => {
      const x = ci % W, y = (ci / W) | 0;
      this.m4.makeTranslation(ox + x + 0.5, oy + y + 0.5, 0);
      tiles.setMatrixAt(k, this.m4);
      const alt = pattern === 0 ? (x + y) % 2 === 1 : pattern === 2 ? y % 2 === 1 : false;
      tiles.setColorAt(k, alt ? c2 : c1);
    });
    tiles.count = free.length;
    tiles.receiveShadow = true;
    this.own({ dispose: () => tiles.dispose() });
    this.board.add(tiles);
    // inner walls, as greedy rounded blocks
    const isWall = (i: number) => L.walls[i] === CELL.wall;
    const used = new Uint8Array(W * H), wallParts: THREE.BufferGeometry[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isWall(i) || used[i]) continue;
      let w = 1; while (x + w < W && isWall(i + w) && !used[i + w]) w++;
      let h = 1;
      outer: for (;;) { if (y + h >= H) break; for (let k = 0; k < w; k++) if (!isWall((y + h) * W + x + k) || used[(y + h) * W + x + k]) break outer; h++; }
      for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) used[(y + j) * W + x + k] = 1;
      const g = M.wallBlock(w, h); g.translate(ox + x + w / 2, oy + y + h / 2, 0.06); wallParts.push(g);
    }
    if (wallParts.length) {
      const g = this.own(mergeGeometries(wallParts.map((p) => (p.index ? p.toNonIndexed() : p)))!);
      wallParts.forEach((p) => p.dispose());
      const wm = new THREE.Mesh(g, this.own(new THREE.MeshStandardMaterial({ color: new THREE.Color(look.wall).offsetHSL(shift, 0, 0), roughness: 0.32, envMapIntensity: 0.7 })));
      wm.castShadow = wm.receiveShadow = true;
      this.board.add(wm);
    }
    // floor tiles: pads, belts, arrows
    L.pads.forEach((pad, pi) => {
      const x = pad.cell % W, y = (pad.cell / W) | 0;
      const tex = pad.flip ? M.iconTex("⇋", "#E07BD8", "#FFFFFF", true) : M.padTex(pad.ccw);
      const m = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.9, 0.9)), this.own(new THREE.MeshStandardMaterial({ map: this.own(tex), roughness: 0.4, transparent: true })));
      m.position.set(ox + x + 0.5, oy + y + 0.5, 0.012); m.receiveShadow = true;
      this.board.add(m);
      const mat = this.own(new THREE.MeshBasicMaterial({ map: this.own(M.badgeTex(String(s.pads[pi] ?? pad.uses), "#5B33C9")), transparent: true, depthWrite: false }));
      const badge = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.34, 0.34)), mat);
      badge.position.set(ox + x + 0.2, oy + y + 0.8, 0.5);
      this.board.add(badge);
      this.padBadges.push({ mesh: badge, mat, last: s.pads[pi] ?? pad.uses });
    });
    const arrowT = L.tiles.some((t) => t === TILE.arrow) ? this.own(M.arrowTex()) : null;
    for (let i = 0; i < W * H; i++) {
      const t = L.tiles[i], x = i % W, y = (i / W) | 0;
      if (t === TILE.belt) {
        const tex = this.own(M.beltTex()); this.beltTexs.push(tex);
        const m = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.96, 0.9)), this.own(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
        m.position.set(ox + x + 0.5, oy + y + 0.5, 0.011);
        m.rotation.z = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][L.tdir[i]];
        m.receiveShadow = true; this.board.add(m);
      } else if (t === TILE.arrow && arrowT) {
        const m = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.8, 0.8)), this.own(new THREE.MeshStandardMaterial({ map: arrowT, transparent: true, roughness: 0.5 })));
        m.position.set(ox + x + 0.5, oy + y + 0.5, 0.011);
        m.rotation.z = [0, -Math.PI / 2, Math.PI, Math.PI / 2][L.tdir[i]];
        this.board.add(m);
      }
    }
    // everything new in phases 2–3: special tiles, pits, rails, doors, pick-ups, drains, boxes, fog
    this.extras = new BoardExtras(L, s, (x) => this.own(x), new THREE.Color(look.wall).getStyle());
    this.board.add(this.extras.root);
    // lamps glow on night stages
    if (this.mode === "night" || look.night) L.tiles.forEach((t, ci) => {
      if (t !== TILE.lamp || this.lamps.length >= 3) return;
      const pl = new THREE.PointLight("#FFE6A8", 6, 5, 1.6); pl.position.set(ox + (ci % W) + 0.5, oy + ((ci / W) | 0) + 0.5, 1.4);
      this.board.add(pl); this.lamps.push(pl);
    });
    // gates set into the frame (floor gates are drawn by the extras; an empty group marks their spot)
    L.gates.forEach((g, gi) => {
      const grp = new THREE.Group();
      const gv: GateView = { group: grp, body: [], mats: [], badge: null, badgeMat: null, badgeKey: "", base: new THREE.Vector3() };
      if (g.side === 4) {
        grp.position.set(ox + (g.at % W) + g.w / 2, oy + ((g.at / W) | 0) + (g.h ?? 1) / 2, 0);
        this.board.add(grp); this.gateGroups[gi] = grp; this.gateViews[gi] = gv;
        if (g.need) this.gateBadge(gv, lockIcon(g.need), 0, 0, 0.5);
        return;
      }
      const parts = M.gate(g.w);
      this.own(parts.body); this.own(parts.arrow);
      const col = COLORS[g.color] ?? COLORS[0];
      const bodyMat = () => this.own(new THREE.MeshPhysicalMaterial({ color: col.hex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1, transparent: true }));
      if (g.also !== undefined) {
        // a Mix Gate: two colours side by side
        for (const [k, cIdx] of [[0, g.color], [1, g.also]] as const) {
          const half = M.gate(g.w / 2).body; this.own(half);
          const mat = this.own(new THREE.MeshPhysicalMaterial({ color: COLORS[cIdx].hex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true }));
          const hm = new THREE.Mesh(half, mat);
          hm.position.x = (k ? 1 : -1) * g.w / 4; hm.castShadow = true; grp.add(hm); gv.body.push(hm); gv.mats.push(mat);
        }
      } else {
        const mat = bodyMat();
        if (g.kind === "rainbow") { mat.color.set("#FFFFFF"); mat.map = this.own(M.stripeTex(RAINBOW_HEX)); }
        const b = new THREE.Mesh(parts.body, mat); b.castShadow = true; grp.add(b); gv.body.push(b); gv.mats.push(mat);
      }
      const arrow = new THREE.Mesh(parts.arrow, this.own(new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.3 })));
      grp.add(arrow);
      const sym = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.26, 0.26)), this.own(new THREE.MeshBasicMaterial({ map: this.own(M.symbolTex(col.sym)), transparent: true, depthWrite: false })));
      sym.position.set(-g.w / 2 + 0.25, 0.36, 0.585); if (g.w > 1.5 && g.kind !== "rainbow") grp.add(sym);
      if (g.count < 99) {
        const mat = this.own(new THREE.MeshBasicMaterial({ map: this.own(M.badgeTex(String(s.gates[gi]), "#1B1530")), transparent: true, depthWrite: false }));
        const badge = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.36, 0.36)), mat);
        badge.position.set(g.w / 2 - 0.22, 0.36, 0.62); grp.add(badge);
        this.gateBadges[gi] = { mesh: badge, mat, last: s.gates[gi] };
      }
      this.placeGate(grp, g.side, gateAt(g, s, gi), g.w);
      gv.base.copy(grp.position);
      this.board.add(grp);
      this.gateGroups[gi] = grp;
      this.gateViews[gi] = gv;
    });
    this.placeProps(L);
    this.sync(s, true);
    this.fit();
  }
  private placeGate(grp: THREE.Group, side: number, at: number, w: number) {
    const L = this.L!, ox = -L.W / 2, oy = -L.H / 2, along = at + w / 2;
    switch (side) {
      case 0: grp.position.set(ox + along, oy + L.H, 0); grp.rotation.z = 0; break;
      case 2: grp.position.set(ox + along, oy, 0); grp.rotation.z = Math.PI; break;
      case 1: grp.position.set(ox + L.W, oy + along, 0); grp.rotation.z = -Math.PI / 2; break;
      case 3: grp.position.set(ox, oy + along, 0); grp.rotation.z = Math.PI / 2; break;
    }
  }
  /** a gate's variant badge (lock, number, star, queue, weight…) */
  private gateBadge(gv: GateView, text: string, x: number, y: number, z: number) {
    if (gv.badgeKey === text) return;
    gv.badgeKey = text;
    if (!text) { if (gv.badge) gv.badge.visible = false; return; }
    const tex = this.own(M.emojiBadge(text));
    if (!gv.badge) {
      gv.badgeMat = this.own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      gv.badge = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.66, 0.44)), gv.badgeMat);
      gv.badge.position.set(x, y, z); gv.badge.renderOrder = 4;
      gv.group.add(gv.badge);
    } else { gv.badgeMat!.map?.dispose(); gv.badgeMat!.map = tex; gv.badgeMat!.needsUpdate = true; }
    gv.badge.visible = true;
  }
  /** gates that change with the state: locks, cycles, blinks, narrowing, sliding, queues */
  private updateGates(s: State) {
    const L = this.L; if (!L) return;
    L.gates.forEach((g, gi) => {
      const gv = this.gateViews[gi]; if (!gv) return;
      const parts: string[] = [];
      if (g.need && !cond(L, s, g.need)) parts.push(lockIcon(g.need));
      if (g.order !== undefined) parts.push(`${g.order}`);
      if (g.queue) { const used = (g.count >= 99 ? 99 : g.count) - s.gates[gi]; const next = g.queue[used]; if (next !== undefined) parts.push(COLORS[next].sym); }
      if (g.star) parts.push("⭐");
      if (g.parts !== undefined) parts.push(`×${g.parts}`);
      if (g.area !== undefined) parts.push(`▦${g.area}`);
      if (g.h !== undefined && g.side !== 4) parts.push(`↧${g.h}`);
      if (g.dirIn !== undefined) parts.push(["⬆", "➡", "⬇", "⬅"][g.dirIn]);
      if (g.spawn) parts.push("🍬");
      if (g.side === 4) { this.gateBadge(gv, parts.join(""), 0, 0, 0.5); return; }
      this.gateBadge(gv, parts.slice(0, 2).join(""), -g.w / 2 + 0.1, 0.62, 0.66);
      const open = gateOpen(L, s, gi);
      const colour = g.cycle ? g.cycle[(s.moves + (g.phase ?? 0)) % g.cycle.length] : g.color;
      const hide = L.rules?.view?.remember !== undefined && this.time > (L.rules.view.remember ?? 0);
      gv.mats.forEach((m, k) => {
        if (g.kind === "rainbow") return;
        if (k === 0 || g.also === undefined) m.color.set(hide ? "#B8B3CC" : COLORS[k === 1 ? g.also! : colour]?.hex ?? "#888");
        m.opacity = open ? 1 : 0.42;
      });
      // sliding / shuffled / narrowing gates move and shrink
      const at = gateAt(g, s, gi), w = gateW(g, s, gi);
      if (at !== g.at || g.slide || s.gat) this.placeGate(gv.group, g.side, at, g.w);
      if (g.narrow) for (const b of gv.body) b.scale.x = w / g.w;
    });
  }

  private placeProps(L: Level) {
    for (const c of [...this.props.children]) { this.props.remove(c); if (c instanceof THREE.Mesh) c.geometry.dispose(); }
    const mat = this.own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, envMapIntensity: 0.6 }));
    let s = L.look * 7919 + 17;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const rx = L.W / 2 + 1.6, ry = L.H / 2 + 1.6;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
      const k = 1 + rnd() * 0.9;
      const x = Math.cos(a) * rx * k + (rnd() - 0.5), y = Math.sin(a) * ry * k + (rnd() - 0.5);
      const m = new THREE.Mesh(M.prop(this.world.props, i + Math.floor(rnd() * 4)), mat);
      m.position.set(x, y, -0.42); m.rotation.z = rnd() * Math.PI * 2; m.scale.setScalar(0.9 + rnd() * 0.5);
      m.castShadow = true; m.receiveShadow = true;
      this.props.add(m);
    }
  }

  private clearLevel() {
    for (const v of this.views.values()) this.board.remove(v.group);
    this.views.clear();
    for (const c of [...this.board.children]) this.board.remove(c);
    for (const d of this.levelOwn) d.dispose();
    this.levelOwn = []; this.padBadges = []; this.gateBadges = []; this.gateGroups = []; this.gateViews = []; this.beltTexs = []; this.lamps = [];
    this.steps = []; this.ghost = null; this.extras = null;
  }

  // ---------------------------------------------------------------- jelly views
  private geo(c: number[]) {
    const k = shapeKey(c);
    let g = this.geoCache.get(k);
    if (!g) { g = M.jellyGeometry(c); this.geoCache.set(k, g); }
    return g;
  }
  /** the jelly material for a colour (special jellies and view modes get their own) */
  private mat(color: number, variant = ""): THREE.MeshPhysicalMaterial {
    const key = `${color}|${variant}|${this.mode ?? ""}|${this.style.finish}`;
    let m = this.matCache.get(key);
    if (m) return m;
    const col = COLORS[color] ?? COLORS[0];
    if (color === STONE) m = new THREE.MeshPhysicalMaterial({ color: col.hex, roughness: 0.85, metalness: 0, clearcoat: 0.1 });
    else if (color === CRATE) m = new THREE.MeshPhysicalMaterial({ color: col.hex, roughness: 0.75, clearcoat: 0.2 });
    else if (color === GOLD) m = new THREE.MeshPhysicalMaterial({ color: col.hex, roughness: 0.22, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6 });
    else if (color === CLEAR) m = new THREE.MeshPhysicalMaterial({ color: col.hex, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.45, envMapIntensity: 1.4 });
    else {
      m = new THREE.MeshPhysicalMaterial({ color: col.hex, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.5, sheenColor: new THREE.Color("#FFFFFF"), sheenRoughness: 0.4, emissive: col.deep, emissiveIntensity: 0.12, envMapIntensity: 1.25 });
      if (color === RAINBOW) this.rainbowMats.push(m);
      if (this.mode === "neon") { m.emissive.set(col.hex); m.emissiveIntensity = 0.6; }
      if (this.mode === "bw") { const l = new THREE.Color(col.hex).getHSL({ h: 0, s: 0, l: 0 }).l; m.color.setHSL(0, 0, 0.25 + l * 0.6); m.emissive.set("#000000"); }
      if (this.mode === "night") { m.emissive.set(col.hex); m.emissiveIntensity = 0.28; }
      // the player's jelly finish from the shop
      switch (this.style.finish) {
        case "pastel": m.roughness = 0.55; m.clearcoat = 0.25; m.sheen = 0.2; m.color.lerp(new THREE.Color("#FFFFFF"), 0.22); break;
        case "glitter": m.sheen = 1; m.sheenColor.set("#FFE9A8"); m.clearcoatRoughness = 0.25; m.emissiveIntensity = 0.22; break;
        case "glass": m.transparent = true; m.opacity = 0.8; m.roughness = 0.03; m.envMapIntensity = 1.6; break;
        case "metal": m.metalness = 0.55; m.roughness = 0.18; m.envMapIntensity = 1.6; break;
        case "neon": m.emissive.set(col.hex); m.emissiveIntensity = 0.55; break;
      }
    }
    if (variant === "ghost") { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }
    if (variant === "mystery") { m.color.set("#9A93B5"); m.emissive.set("#000000"); }
    if (variant.startsWith("tone")) m.color.offsetHSL(0, -0.08, Math.min(0.25, +variant.slice(4) * 0.06));
    if (variant === "goldrush") { m.metalness = 0.55; m.color.lerp(new THREE.Color("#FFD54A"), 0.35); }
    this.matCache.set(key, m);
    return m;
  }
  private lid(color: number) {
    let m = this.lidMat.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: (COLORS[color] ?? COLORS[0]).deep, roughness: 0.3 }); this.lidMat.set(color, m); }
    return m;
  }
  /** what makes a jelly look different (rebuilt when it changes) */
  private viewKey(p: Piece, s: State) {
    const L = this.L!;
    const home = L.pieces.find((q) => q.id === p.id);
    const mystery = !!p.f?.mystery && !!home && home.x === p.x && home.y === p.y && s.moves === 0;
    return `${shapeKey(p.c)}|${p.color}|${badgeOf(p, s, L)}|${mystery ? "m" : ""}|${p.f?.bubble ? "b" : ""}|${p.parts}`;
  }
  private makeView(p: Piece, s: State): View {
    const L = this.L!;
    const group = new THREE.Group(), body = new THREE.Group();
    group.userData.jelly = true;
    group.add(body);
    const home = L.pieces.find((q) => q.id === p.id);
    const mystery = !!p.f?.mystery && !!home && home.x === p.x && home.y === p.y && s.moves === 0;
    const vw = L.rules?.view;
    const variant = mystery ? "mystery" : p.f?.ghost ? "ghost" : vw?.gold && p.parts >= 4 ? "goldrush" : this.mode === "tones" && p.parts > 1 ? `tone${p.parts - 1}` : "";
    const jelly = new THREE.Mesh(this.geo(p.c), this.mat(p.color, variant));
    jelly.castShadow = true; jelly.receiveShadow = true;
    body.add(jelly);
    const [fx, fy, fs] = M.faceAnchor(p.c);
    const face = new THREE.Group();
    const eyes = new THREE.Mesh(this.faceGeo.eyes, this.faceMat), pupils = new THREE.Mesh(this.faceGeo.pupils, this.faceMat);
    const lids = new THREE.Mesh(this.faceGeo.lids, this.lid(p.color)), mouth = new THREE.Mesh(this.faceGeo.mouth, this.faceMat);
    lids.visible = false;
    face.add(eyes, pupils, lids, mouth);
    face.position.set(fx, fy, M.JELLY_TOP - 0.02);
    face.scale.setScalar(fs);
    face.visible = p.color !== CRATE || !!p.f?.kranky;
    body.add(face);
    // a bubble around bubble jellies
    if (p.f?.bubble) {
      const shell = new THREE.Mesh(this.geo(p.c), this.own(new THREE.MeshPhysicalMaterial({ color: "#BFF3FF", transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, depthWrite: false })));
      shell.scale.set(1.08, 1.08, 1.35); shell.position.set(-0.04, -0.04, -0.02); body.add(shell);
    }
    // the colour symbol on a far cell (colour-blind play, and black & white stages)
    let sym: THREE.Mesh | null = null;
    if (p.c.length >= 4 || this.mode === "bw" || p.color === GOLD || p.color === STONE) {
      let best = 0, bd = -1;
      for (let i = 0; i < p.c.length; i += 2) { const d = Math.hypot(p.c[i] + 0.5 - fx, p.c[i + 1] + 0.5 - fy); if (d > bd) { bd = d; best = i; } }
      if (bd > 0.8 || this.mode === "bw") {
        sym = new THREE.Mesh(this.symGeo(), this.symMat(mystery ? 13 : p.color));
        sym.position.set(p.c[best] + 0.5, p.c[best + 1] + 0.5, M.JELLY_TOP + 0.004);
        if (!mystery) body.add(sym);
      }
    }
    // a badge for special jellies (king, timer, lock, heavy…) and part counters
    let badge = badgeOf(p, s, L);
    if (mystery) badge = "❓";
    if (vw?.counters && p.parts > 1) badge = `${p.parts}${badge}`.slice(0, 4);
    if (badge) {
      const bm = new THREE.Mesh(this.own(new THREE.PlaneGeometry(0.72, 0.48)), this.own(new THREE.MeshBasicMaterial({ map: this.own(M.emojiBadge(badge)), transparent: true, depthWrite: false })));
      bm.position.set(fx, fy + 0.42, M.JELLY_TOP + 0.08); bm.renderOrder = 3;
      body.add(bm);
    }
    const v: View = { id: p.id, color: p.color, key: this.viewKey(p, s), c: p.c, group, body, jelly, face, pupils, lids, sym, x: p.x, y: p.y, vx: p.x, vy: p.y, z: 0, tz: 0, sq: 0, sqv: 0, blink: 1 + Math.random() * 3, dead: false, anim: false };
    group.position.set(p.x - L.W / 2, p.y - L.H / 2, 0);
    this.board.add(group);
    return v;
  }
  private symG: THREE.BufferGeometry | null = null;
  private symGeo() { if (!this.symG) this.symG = this.keep(new THREE.PlaneGeometry(0.42, 0.42)); return this.symG; }
  private symMats = new Map<number, THREE.MeshBasicMaterial>();
  private symMat(color: number) {
    let m = this.symMats.get(color);
    if (!m) { m = this.keep(new THREE.MeshBasicMaterial({ map: this.keep(M.symbolTex((COLORS[color] ?? COLORS[0]).sym)), transparent: true, depthWrite: false })); this.symMats.set(color, m); }
    return m;
  }
  private dropView(v: View) { v.dead = true; this.board.remove(v.group); if (this.views.get(v.id) === v) this.views.delete(v.id); }

  /** make the jelly views match a state exactly (start, undo, restart, resume) */
  sync(s: State, snap = false) {
    this.S = s;
    const live = new Set([...this.views.values()].map((v) => v.group));
    for (const c of [...this.board.children]) if (c.userData.jelly && !live.has(c as THREE.Group)) this.board.remove(c);
    const keepIds = new Set(s.pieces.map((p) => p.id));
    for (const v of [...this.views.values()]) if (!keepIds.has(v.id)) this.dropView(v);
    for (const p of s.pieces) {
      let v = this.views.get(p.id);
      if (v && v.key !== this.viewKey(p, s)) { const was = v; this.dropView(v); v = this.makeView(p, s); v.vx = was.vx; v.vy = was.vy; this.views.set(p.id, v); if (!snap) v.sq = -0.5; }
      if (!v) { v = this.makeView(p, s); this.views.set(p.id, v); if (!snap) { v.sq = -0.6; } }
      v.x = p.x; v.y = p.y; v.tz = 0;
      if (snap) { v.vx = p.x; v.vy = p.y; v.z = 0; }
    }
    this.steps = [];
    s.pads.forEach((u, i) => this.setBadge(this.padBadges[i], u, "#5B33C9"));
    s.gates.forEach((u, i) => this.setBadge(this.gateBadges[i], u, "#1B1530"));
    this.extras?.update(s, snap);
    this.updateGates(s);
    // the tray turns (R30 twist half way, S05 flip every N, S06 quarter every N)
    const vw = this.L?.rules?.view;
    if (vw) {
      let turn = 0;
      if (vw.twistAt !== undefined && s.moves >= vw.twistAt) turn += Math.PI;
      if (vw.flipEvery) turn += Math.floor(s.moves / vw.flipEvery) * Math.PI;
      if (vw.spinEvery) turn += Math.floor(s.moves / vw.spinEvery) * (Math.PI / 2);
      if (turn !== this.turnTo) { this.turnTo = turn; if (snap) this.turn = turn; this.fit(); }
    }
  }
  private setBadge(b: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; last: number } | undefined, n: number, bg: string) {
    if (!b || b.last === n) return;
    b.last = n;
    b.mat.map?.dispose();
    b.mat.map = this.own(M.badgeTex(String(n), n > 0 ? bg : "#9A93B5")); b.mat.needsUpdate = true;
  }

  // ---------------------------------------------------------------- input helpers
  /** board cell coordinates (float) under a screen point (CSS px relative to the canvas) */
  pick(px: number, py: number): { x: number; y: number } | null {
    const L = this.L; if (!L) return null;
    this.ray.setFromCamera(new THREE.Vector2((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1), this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.v3);
    if (!hit) return null;
    // undo the tray's turn
    const a = -this.spin.rotation.z, ca = Math.cos(a), sa = Math.sin(a);
    const x = hit.x * ca - hit.y * sa, y = hit.x * sa + hit.y * ca;
    return { x: x + L.W / 2, y: y + L.H / 2 };
  }
  /** a jelly being dragged: lift it and show it at origin (x, y) */
  drag(id: number, x: number, y: number) {
    const v = this.views.get(id); if (!v) return;
    v.x = x; v.y = y; v.tz = 0.42;
  }
  /** let go (no move happened) */
  release(id: number) { const v = this.views.get(id); if (v) { v.tz = 0; v.sq = 0.5; } }
  /** the eyes follow this board point */
  lookAt(x: number, y: number) { this.look.set(x, y); }
  /** nobody is pointing: the eyes wander */
  lookAway() { this.look.set(0, 0); }
  /** show where the hinted jelly should go */
  hint(m: Move | null, s: State) {
    if (this.ghost) { this.board.remove(this.ghost); this.ghost = null; }
    if (!m || !this.L) return;
    const p = s.pieces.find((q) => q.id === m.id); if (!p) return;
    // a flat glowing copy of the jelly, in its own colour, where it should go
    const hex = (COLORS[p.color] ?? COLORS[0]).hex;
    this.ghostMat.color.set(hex); this.ghostMat.emissive.set(hex);
    this.ghost = new THREE.Mesh(this.geo(p.c), this.ghostMat);
    this.ghost.position.set(m.x - this.L.W / 2, m.y - this.L.H / 2, 0.03);
    this.ghost.scale.set(1, 1, 0.35);
    this.board.add(this.ghost);
    const v = this.views.get(m.id); if (v) v.sq = 0.9;
  }
  get busy() { return this.steps.length > 0; }

  // ---------------------------------------------------------------- playing a move's events
  /** animate what a move did; returns how long it takes (seconds) */
  play(events: JamEvent[], s: State, onBeat?: (e: JamEvent) => void): number {
    const L = this.L!;
    let t = this.time;
    const sl = this.slow;
    const add = (dur: number, run: (k: number) => void, end?: () => void) => { this.steps.push({ t0: t, dur: dur * sl, run, end }); t += dur * sl; };
    const glide = (id: number, x: number, y: number, dur: number, hop = 0, end?: () => void) => {
      let v: View | undefined, fx = 0, fy = 0;
      add(dur, (k) => { if (!v) { v = this.views.get(id); if (!v) return; fx = v.x; fy = v.y; } const kk = ease(k); v.x = fx + (x - fx) * kk; v.y = fy + (y - fy) * kk; v.vx = v.x; v.vy = v.y; v.z = Math.sin(k * Math.PI) * hop; }, () => { if (v) { v.x = x; v.y = y; } end?.(); });
    };
    this.hint(null, s);
    for (const e of events) {
      switch (e.t) {
        case "move": {
          const v = this.views.get(e.id); if (!v) break;
          v.x = e.x; v.y = e.y; v.tz = 0;
          add(0.1, () => {}, () => { v.sq = 0.55; onBeat?.(e); });
          break;
        }
        case "turn": {
          const pad = L.pads[e.pad], px = (pad.cell % L.W) + 0.5, py = ((pad.cell / L.W) | 0) + 0.5;
          const dir = e.ccw ? 1 : -1;
          let v: View | undefined, sx = 0, sy = 0;
          add(0.32, (k) => {
            if (!v) { v = this.views.get(e.id); if (!v) return; sx = v.x; sy = v.y; }
            v.anim = true;
            if (e.flip) { v.body.scale.x = Math.cos(k * Math.PI); v.z = Math.sin(k * Math.PI) * 0.4; return; }
            const a = ease(k) * dir * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
            // rotate the jelly about the pad centre
            const rx = sx - px, ry = sy - py;
            v.vx = px + rx * ca - ry * sa; v.vy = py + rx * sa + ry * ca;
            v.x = v.vx; v.y = v.vy;
            v.body.rotation.z = a; v.z = Math.sin(k * Math.PI) * 0.35;
          }, () => {
            if (v) this.dropView(v);
            const nv = this.makeView(e.piece, s); this.views.set(e.piece.id, nv); nv.sq = 0.6;
            onBeat?.(e);
          });
          break;
        }
        case "belt": glide(e.id, e.x, e.y, 0.09, 0, () => onBeat?.(e)); break;
        case "slide": {
          const far = e.why === "tele" || e.why === "rewind" || e.why === "bounce";
          if (far) {
            let v: View | undefined;
            add(0.16, (k) => { if (!v) v = this.views.get(e.id); if (v) { v.anim = true; v.body.scale.setScalar(1 - k * 0.8); } }, () => {
              if (v) { v.x = v.vx = e.x; v.y = v.vy = e.y; v.body.scale.setScalar(0.2); }
              onBeat?.(e);
            });
            add(0.16, (k) => { if (v) v.body.scale.setScalar(0.2 + k * 0.8); }, () => { if (v) { v.anim = false; v.sq = -0.6; } });
          } else glide(e.id, e.x, e.y, e.why === "fall" || e.why === "ice" || e.why === "spring" || e.why === "tilt" ? 0.22 : 0.14, e.why === "spring" ? 0.5 : 0, () => onBeat?.(e));
          break;
        }
        case "shape": {
          let v: View | undefined;
          add(0.12, (k) => { if (!v) v = this.views.get(e.id); if (v) { v.anim = true; v.body.scale.set(1 + 0.15 * Math.sin(k * Math.PI), 1 + 0.15 * Math.sin(k * Math.PI), 1 - 0.2 * Math.sin(k * Math.PI)); } }, () => {
            if (v) this.dropView(v);
            const nv = this.makeView(e.piece, s); this.views.set(e.piece.id, nv); nv.sq = -0.7;
            const cx = e.piece.x - L.W / 2, cy = e.piece.y - L.H / 2;
            this.burst(cx + 0.5, cy + 0.5, new THREE.Color((COLORS[e.piece.color] ?? COLORS[0]).hex), 8);
            onBeat?.(e);
          });
          break;
        }
        case "spawn": add(0.14, () => {}, () => { const nv = this.makeView(e.piece, s); this.views.set(e.piece.id, nv); nv.sq = -0.9; nv.z = 1.2; onBeat?.(e); }); break;
        case "remove": {
          let v: View | undefined;
          add(0.18, (k) => { if (!v) v = this.views.get(e.id); if (v) { v.anim = true; v.body.scale.setScalar(1 - k); } }, () => { if (v) this.dropView(v); onBeat?.(e); });
          break;
        }
        case "get": {
          const x = (e.cell % L.W) + 0.5 - L.W / 2, y = ((e.cell / L.W) | 0) + 0.5 - L.H / 2;
          add(0.05, () => {}, () => { this.extras?.update(s); this.burst(x, y, new THREE.Color(e.what === "coin" || e.what === "star" ? "#FFD54A" : "#FFFFFF"), 14, true); onBeat?.(e); });
          break;
        }
        case "switch": case "door": case "wear": add(0.04, () => {}, () => { this.extras?.update(s); onBeat?.(e); }); break;
        case "merge": {
          let parts: View[] | null = null;
          add(0.14, (k) => { parts ??= e.ids.map((id) => this.views.get(id)).filter((v): v is View => !!v); for (const v of parts) { v.anim = true; v.body.scale.set(1 - 0.08 * k, 1 - 0.08 * k, 1 + 0.12 * k); } }, () => {
            for (const v of parts ?? []) this.dropView(v);
            const nv = this.makeView(e.piece, s); this.views.set(e.piece.id, nv); nv.sq = -0.9;
            const cx = e.piece.x - L.W / 2, cy = e.piece.y - L.H / 2;
            const col = new THREE.Color((COLORS[e.piece.color] ?? COLORS[0]).hex);
            for (let i = 0; i < e.piece.c.length; i += 2) this.burst(cx + e.piece.c[i] + 0.5, cy + e.piece.c[i + 1] + 0.5, col, 3);
            onBeat?.(e);
          });
          add(0.12, () => {});
          break;
        }
        case "exit": {
          const g = L.gates[e.gate];
          const floor = g.side === 4;
          const dx = floor ? 0 : DX[g.side as 0 | 1 | 2 | 3], dy = floor ? 0 : DY[g.side as 0 | 1 | 2 | 3];
          const len = 2.6;
          let v: View | undefined, fx = 0, fy = 0, beat = false;
          add(0.46, (k) => {
            if (!v) { v = this.views.get(e.id); if (!v) return; fx = v.x; fy = v.y; }
            if (!beat) { beat = true; onBeat?.(e); }
            v.anim = true;
            const kk = easeIn(k);
            v.x = fx + dx * len * kk; v.y = fy + dy * len * kk; v.vx = v.x; v.vy = v.y;
            v.body.scale.setScalar(1 - 0.55 * kk);
            v.z = floor ? -kk * 0.9 : Math.sin(k * Math.PI) * 0.2;
            const gg = this.gateGroups[e.gate]; if (gg && !floor) gg.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.08);
          }, () => {
            if (v) this.dropView(v);
            const gp = this.gateGroups[e.gate]?.position;
            if (gp) this.burst(gp.x + dx * 0.4, gp.y + dy * 0.4, new THREE.Color((COLORS[e.piece.color] ?? COLORS[0]).hex), 26, true);
          });
          break;
        }
        case "lost": add(0.1, () => {}, () => { this.shakeIt(); onBeat?.(e); }); break;
        case "win": add(0.2, () => {}, () => { this.burst(0, 0, null, 120, true); onBeat?.(e); }); break;
      }
    }
    add(0.01, () => {}, () => this.sync(s));
    return t - this.time;
  }

  private burst(x: number, y: number, color: THREE.Color | null, n: number, big = false) {
    const onBoard = this.S ? [...new Set(this.S.pieces.map((p) => p.color).filter((c) => c < 8))].map((c) => COLORS[c].hex) : [];
    const hexes = CONFETTI[this.style.confetti] ?? (this.style.confetti === "jelly" && onBoard.length ? onBoard : COLORS.slice(0, 8).map((c) => c.hex));
    const pal = hexes.map((h) => new THREE.Color(h));
    // confetti flies in board space: turn it with the tray
    const a0 = this.spin.rotation.z, ca = Math.cos(a0), sa = Math.sin(a0);
    const wx = x * ca - y * sa, wy = x * sa + y * ca;
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 250) this.parts.shift();
      const a = Math.random() * Math.PI * 2, s = (big ? 0.06 : 0.03) + Math.random() * (big ? 0.12 : 0.05);
      this.parts.push({ x: wx, y: wy, z: 0.6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0.05 + Math.random() * (big ? 0.12 : 0.05), life: 0.9 + Math.random() * 0.6, max: 1.5, size: 0.8 + Math.random() * 0.8, color: color ?? pal[i % pal.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
  }
  shakeIt() { this.shake = 0.6; }

  // ---------------------------------------------------------------- frame
  frame(dt: number) {
    this.time += dt;
    const L = this.L;
    // timeline steps (each starts after the previous one)
    while (this.steps.length) {
      const st = this.steps[0];
      const k = Math.min(1, (this.time - st.t0) / st.dur);
      if (k < 0) break;
      st.run(k);
      if (k >= 1) { this.steps.shift(); st.end?.(); if (this.steps.length && this.steps[0].t0 < this.time - 0.5) for (const s2 of this.steps) s2.t0 = Math.max(s2.t0, this.time); continue; }
      break;
    }
    if (L) {
      const f = Math.min(1, dt * 16);
      for (const v of this.views.values()) {
        v.vx += (v.x - v.vx) * f; v.vy += (v.y - v.vy) * f;
        v.z += (v.tz - v.z) * Math.min(1, dt * 14);
        // springy squash
        v.sqv += (-v.sq * 220 - v.sqv * 16) * dt; v.sq += v.sqv * dt;
        const s = Math.max(-0.4, Math.min(0.4, v.sq * 0.25));
        const lift = v.tz > 0 ? 1.04 : 1;
        if (!v.anim) v.body.scale.set(lift * (1 + s * 0.5), lift * (1 + s * 0.5), Math.max(0.5, 1 - s));
        v.group.position.set(v.vx - L.W / 2, v.vy - L.H / 2, v.z);
        // eyes: blink, and look at the finger (or wobble about)
        v.blink -= dt;
        if (v.blink < -0.12) v.blink = 1.8 + Math.random() * 3.5;
        v.lids.visible = v.blink < 0;
        const fx = v.face.position.x + v.vx, fy = v.face.position.y + v.vy;
        const lx = this.look.x - fx, ly = this.look.y - fy, ll = Math.hypot(lx, ly) || 1;
        const tx = (this.look.lengthSq() ? lx / ll : Math.sin(this.time * 0.7 + v.id)) * 0.035, ty = (this.look.lengthSq() ? ly / ll : Math.cos(this.time * 0.5 + v.id)) * 0.03;
        v.pupils.position.x += (tx - v.pupils.position.x) * f; v.pupils.position.y += (ty - v.pupils.position.y) * f;
      }
      for (const t of this.beltTexs) t.offset.x -= dt * 0.9;
      for (const m of this.rainbowMats) m.color.setHSL((this.time * 0.15) % 1, 0.85, 0.58);
      if (this.ghost) (this.ghost.material as THREE.MeshStandardMaterial).opacity = 0.55 + 0.2 * Math.sin(this.time * 6);
      this.extras?.frame(dt);
      if (L.rules?.view?.remember !== undefined && this.S && Math.abs(this.time - L.rules.view.remember) < dt * 1.5) this.updateGates(this.S);
      // the tray turns
      if (Math.abs(this.turnTo - this.turn) > 0.001) { this.turn += (this.turnTo - this.turn) * Math.min(1, dt * 4); this.spin.rotation.z = this.turn; }
    }
    // confetti
    let n = 0;
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.z += p.vz * dt * 60; p.vz -= 0.006 * dt * 60; p.vx *= 0.97; p.vy *= 0.97; p.rot += p.vr * dt;
      if (p.z < 0.05) { p.z = 0.05; p.vz *= -0.3; p.vx *= 0.7; p.vy *= 0.7; }
      if (n >= 260) continue;
      this.v3.set(p.x, p.y, p.z); this.e3.set(p.rot, p.rot * 0.6, p.rot * 0.3); this.q4.setFromEuler(this.e3); this.s3.setScalar(p.size * Math.min(1, p.life * 2));
      this.bits.setMatrixAt(n, this.m4.compose(this.v3, this.q4, this.s3)); this.bits.setColorAt(n, p.color); n++;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    this.bits.count = n; this.bits.instanceMatrix.needsUpdate = true; if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
    // gentle camera breath + shake
    this.shake = Math.max(0, this.shake - dt * 2);
    this.board.position.set((Math.random() - 0.5) * this.shake * 0.08, (Math.random() - 0.5) * this.shake * 0.08, 0);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.clearLevel();
    for (const g of this.geoCache.values()) g.dispose();
    for (const m of this.matCache.values()) m.dispose();
    for (const m of this.lidMat.values()) m.dispose();
    for (const c of this.props.children) if (c instanceof THREE.Mesh) c.geometry.dispose();
    this.tableMat.map?.dispose();
    for (const k of this.keepList) k.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.cv.remove();
  }
}

/** a sensible default for "auto" graphics */
export function autoQuality(): Quality {
  if (typeof navigator === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 4;
  const touch = typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || (navigator.maxTouchPoints ?? 0) > 0);
  if (cores <= 4) return "low";
  return touch ? "medium" : "high";
}
