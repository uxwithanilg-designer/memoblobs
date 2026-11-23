// Slurp Lab renderer (three.js): a glossy lab tray floating in its lab's backdrop, jelly Gloopies that wobble, blink
// and get slurped up in an arc, glowing glass Slurpers with neon rims and a number tag, and every lab gadget: ice,
// goo, arrows, portals, turn pads, belts, cracked glass, switch walls, paint pads, glass bridges, fences, crates,
// bubbled / frosted / rainbow / double / bomb / fuse Gloopies, locks, sleepers and linked pairs. Reflections come from
// an environment map; everything is instanced or built once per stage; a FrameGovernor keeps slow phones smooth.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { antialiasFor, FrameGovernor, pixelRatioFor } from "@/lib/perf";
import { hoot } from "../boing/models";
import { hatGeo } from "../crowd/models";
import * as M from "./models";
import { DIR_CH } from "./rules";
import { BF, COLORS, RAINBOW, T, isArrow, isBelt, isGate, isPaint, type Drag, type SlurpEvent, type Stage, type State } from "./types";
import type { Lab } from "./campaign";

export type Quality = "low" | "medium" | "high";
export interface SlurpLook { skin: string; hat: string }
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpE = new THREE.Euler(), tmpC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const BODY = new THREE.Matrix4(), EYE = new THREE.Matrix4(), OFF = new THREE.Matrix4();
const WHITE = new THREE.Color("#ffffff");
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

interface Blob { cell: number; color: number; x: number; z: number; mesh: THREE.InstancedMesh; idx: number; eye: number; ph: number; flags: number; top: [THREE.InstancedMesh, number] | null; shell: [THREE.InstancedMesh, number] | null; cap: number; fly: { t: number; tx: number; tz: number; delay: number } | null }
interface SlurperObj { g: THREE.Group; glass: THREE.Mesh; rim: THREE.Mesh; rimMat: THREE.MeshBasicMaterial; glassMat: THREE.MeshPhysicalMaterial; tag: THREE.Sprite; tagCtx: CanvasRenderingContext2D; tagTex: THREE.CanvasTexture; icon: THREE.Sprite | null; shown: string; vx: number; vz: number; lift: number; seal: number; shake: number; sig: string; color: number; spin: number }
interface Part { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; color: THREE.Color; grav: number }

function iconSprite(draw: (c: CanvasRenderingContext2D) => void, keep: (x: { dispose: () => void }) => void): THREE.Sprite {
  const cv = document.createElement("canvas"); cv.width = 96; cv.height = 96;
  const c = cv.getContext("2d")!; draw(c);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; keep(tex);
  const mat = new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthTest: false }); keep(mat);
  const s = new THREE.Sprite(mat); s.renderOrder = 9; return s;
}

export class SlurpRenderer {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
  private gov: FrameGovernor | null = null;
  private w = 1; private h = 1; private q: Quality; private t = 0;
  private stageG = new THREE.Group(); private keep: { dispose: () => void }[] = []; private stageKeep: { dispose: () => void }[] = [];
  private st: Stage | null = null; private s: State | null = null;
  private cx = 0; private cz = 0;
  private blobs: Blob[] = []; private blobMeshes: THREE.InstancedMesh[] = []; private eyes: THREE.InstancedMesh | null = null; private caps: THREE.InstancedMesh | null = null;
  private hats: THREE.InstancedMesh | null = null; private shells: THREE.InstancedMesh[] = [];
  private fuses: { cell: number; sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; shown: number }[] = [];
  private sl: SlurperObj[] = [];
  private links: { a: number; b: number; m: THREE.Mesh }[] = [];
  private cellObj = new Map<number, THREE.Object3D>();
  private belts: { m: THREE.Mesh; x: number; z: number; d: number; k: number }[] = [];
  private spinners: THREE.Object3D[] = [];
  private crates: THREE.Mesh[] = []; private crateAt = new Map<number, THREE.Mesh>();
  private dragged = -1;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private hemi: THREE.HemisphereLight; private key: THREE.DirectionalLight; private rimL: THREE.DirectionalLight;
  private floaters: THREE.InstancedMesh | null = null; private floatData: { x: number; y: number; z: number; s: number; v: number; r: number }[] = [];
  private parts: Part[] = []; private partMesh: THREE.InstancedMesh; private partMax = 420;
  private hintG = new THREE.Group(); private hintT = 0;
  private insetTop = 0; private insetBottom = 0; private insetLeft = 0; private insetRight = 0;
  /** art: slide the tray sideways on screen (world units; + = to the right) */
  shiftX = 0;
  private winT = -1; private stuckT = 0;
  private hootMesh: THREE.Mesh | null = null;
  private tileMesh: THREE.InstancedMesh | null = null; private tileBase: THREE.Color[] = []; private tileCells: number[] = [];
  private look: SlurpLook = { skin: "glass", hat: "none" };

  constructor(host: HTMLElement, quality: Quality) {
    this.q = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", stencil: false, alpha: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", display: "block" });
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.scene.environment = env; this.keep.push(env);
    // balanced light: a soft sky / ground fill, one warm key light and a gentle coloured rim
    this.hemi = new THREE.HemisphereLight("#ffffff", "#8090c0", 1.2); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight("#fff6ea", 1.45); this.key.position.set(-5, 12, 8); this.scene.add(this.key);
    this.rimL = new THREE.DirectionalLight("#9fd8ff", 0.6); this.rimL.position.set(4, 6, -10); this.scene.add(this.rimL);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color("#1C2A6B") }, bot: { value: new THREE.Color("#5C7CFA") }, fwd: { value: new THREE.Vector3(0, -0.8, -0.6) } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      // a bright glow behind the tray (where the camera looks) fading to the lab's richer colour at the edges
      fragmentShader: "uniform vec3 top; uniform vec3 bot; uniform vec3 fwd; varying vec3 vP; void main(){ float d = dot(normalize(vP), normalize(fwd)); float k = smoothstep(0.2, 1.0, d); vec3 c = mix(top, bot, k); c += vec3(1.0) * pow(k, 8.0) * 0.08; gl_FragColor = vec4(c, 1.0); }",
    });
    this.keep.push(this.skyMat);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), this.skyMat); this.keep.push(this.sky.geometry); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    this.scene.add(this.stageG); this.scene.add(this.hintG);
    const pg = new THREE.SphereGeometry(1, 8, 6); this.keep.push(pg);
    const pmat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false }); this.keep.push(pmat);
    this.partMesh = new THREE.InstancedMesh(pg, pmat, this.partMax);
    this.partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.partMesh.count = 0; this.partMesh.frustumCulled = false;
    this.partMesh.setColorAt(0, new THREE.Color("#fff")); this.partMesh.renderOrder = 6; this.scene.add(this.partMesh);
  }

  setLook(l: SlurpLook) { this.look = l; }

  // ------------------------------------------------------------------ stage
  load(st: Stage, s: State, lab: Lab) {
    this.clear();
    this.st = st; this.s = s;
    this.cx = (st.w - 1) / 2; this.cz = (st.h - 1) / 2;
    const W = st.w;
    const sk = <X extends { dispose: () => void }>(x: X) => { this.stageKeep.push(x); return x; };
    const at = (c: number, y = 0) => new THREE.Vector3(c % W - this.cx, y, Math.floor(c / W) - this.cz);
    (this.skyMat.uniforms.top.value as THREE.Color).set(lab.sky[0]).lerp(new THREE.Color(lab.sky[1]), 0.3);
    (this.skyMat.uniforms.bot.value as THREE.Color).set(lab.sky[1]).lerp(WHITE, 0.12);
    this.scene.fog = new THREE.Fog(lab.sky[0], 22, 70);
    this.hemi.groundColor.set(lab.tile).lerp(new THREE.Color(lab.tray), 0.4);
    this.rimL.color.set(lab.sky[1]);
    // the tray: a slab under every board cell, glossy tiles on everything you can stand on
    const cells: number[] = [];
    st.tiles.forEach((t, c) => { if (t !== T.VOID) cells.push(c); });
    const trayMat = sk(new THREE.MeshPhysicalMaterial({ color: lab.tray, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 0.6 }));
    const tray = new THREE.InstancedMesh(sk(M.trayGeo()), trayMat, cells.length);
    cells.forEach((c, i) => { tmpM.makeTranslation(c % W - this.cx, 0, Math.floor(c / W) - this.cz); tray.setMatrixAt(i, tmpM); });
    tray.computeBoundingSphere(); this.stageG.add(tray);
    const floorCells = cells.filter((c) => st.tiles[c] !== T.WALL);
    const tileMat = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 0.45, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.05 }));
    const tiles = new THREE.InstancedMesh(sk(M.tileGeo()), tileMat, floorCells.length);
    this.tileBase = []; this.tileCells = floorCells;
    floorCells.forEach((c, i) => {
      const x = c % W, y = (c - x) / W, t = st.tiles[c];
      tmpM.makeTranslation(x - this.cx, 0.02, y - this.cz); tiles.setMatrixAt(i, tmpM);
      const col = new THREE.Color((x + y) % 2 ? lab.tile : lab.tileB);
      if (isGate(t)) col.lerp(new THREE.Color(COLORS[t - T.GATE].hex), 0.35);
      if (t === T.ICE) col.set("#CFF0FF");
      if (isBelt(t)) col.set("#5A6370");
      if (t === T.GOO) col.lerp(new THREE.Color("#FFC24A"), 0.35);
      if (t === T.CRUMBLE) col.set("#BFEFFF");
      this.tileBase.push(col); tiles.setColorAt(i, col);
    });
    tiles.computeBoundingSphere(); this.tileMesh = tiles; this.stageG.add(tiles);
    const walls = cells.filter((c) => st.tiles[c] === T.WALL);
    if (walls.length) {
      const wm = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.15, transparent: true, opacity: 0.9, clearcoat: 1, envMapIntensity: 0.6 }));
      const wl = new THREE.InstancedMesh(sk(M.wallGeo()), wm, walls.length);
      walls.forEach((c, i) => { tmpM.makeTranslation(c % W - this.cx, 0, Math.floor(c / W) - this.cz); wl.setMatrixAt(i, tmpM); });
      wl.computeBoundingSphere(); this.stageG.add(wl);
    }
    // gadgets on cells
    const plain = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, envMapIntensity: 0.6 }));
    const glow = (col: string, op = 0.9) => sk(new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: op < 1, opacity: op }));
    const add = (c: number, geo: THREE.BufferGeometry, mat: THREE.Material, y = 0, rotY = 0, dyn = false) => { const m = new THREE.Mesh(geo, mat); m.position.copy(at(c, y)); m.rotation.y = rotY; this.stageG.add(m); if (dyn) this.cellObj.set(c, m); return m; };
    const postG = sk(M.gatePostsGeo()), arrowG = sk(M.arrowDecalGeo()), turnG = sk(M.turnDecalGeo()), chevG = sk(M.chevronGeo()), portalG = sk(M.portalGeo()), gooG = sk(M.gooGeo()), splatG = sk(M.splatGeo()), switchG = sk(M.switchGeo()), swG = sk(M.swBlockGeo()), glassG = sk(M.glassBlockGeo()), crumbleG = sk(M.crumbleGeo());
    const glassMat = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, transparent: true, opacity: 0.72, clearcoat: 1, envMapIntensity: 0.9 }));
    const crumbleMat = sk(new THREE.MeshPhysicalMaterial({ color: "#A5E7FF", roughness: 0.1, transparent: true, opacity: 0.8, clearcoat: 1, emissive: new THREE.Color("#7FD8FF"), emissiveIntensity: 0.25 }));
    const swA = sk(new THREE.MeshPhysicalMaterial({ color: "#FF5C7A", roughness: 0.2, transparent: true, opacity: 0.85, clearcoat: 1, emissive: new THREE.Color("#FF5C7A"), emissiveIntensity: 0.25 }));
    const swB = sk(new THREE.MeshPhysicalMaterial({ color: "#4C7DFF", roughness: 0.2, transparent: true, opacity: 0.85, clearcoat: 1, emissive: new THREE.Color("#4C7DFF"), emissiveIntensity: 0.25 }));
    const portalHues = ["#9B7BFF", "#2EE6C8", "#FF8A3D"];
    const portalIdx = new Map<number, number>(); (st.portals ?? []).forEach(([a, b], k) => { portalIdx.set(a, k); portalIdx.set(b, k); });
    st.tiles.forEach((t, c) => {
      if (isGate(t)) {
        const x = c % W, y = (c - x) / W, col = COLORS[t - T.GATE];
        const open = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < st.w && yy < st.h && st.tiles[yy * W + xx] !== T.WALL && st.tiles[yy * W + xx] !== T.VOID;
        const g = new THREE.Group(); g.position.copy(at(c));
        if (!open(x - 1, y) && !open(x + 1, y)) g.rotation.y = Math.PI / 2;
        g.add(new THREE.Mesh(postG, plain));
        const film = new THREE.Mesh(sk(new THREE.PlaneGeometry(0.84, 0.6)), sk(new THREE.MeshBasicMaterial({ color: col.glow, transparent: true, opacity: 0.4, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })));
        film.position.y = 0.32; g.add(film);
        this.stageG.add(g);
      } else if (isArrow(t)) add(c, arrowG, glow("#ffffff", 0.85), 0.02, -(t - T.ARROW) * Math.PI / 2);
      else if (t === T.TURN) this.spinners.push(add(c, turnG, glow("#FFD23F", 0.9), 0.02));
      else if (isBelt(t)) { const d = t - T.BELT; for (let k = 0; k < 2; k++) { const m = add(c, chevG, glow("#FFE066", 0.95), 0.02, -d * Math.PI / 2); this.belts.push({ m, x: c % W - this.cx, z: Math.floor(c / W) - this.cz, d, k }); } }
      else if (t === T.PORTAL) this.spinners.push(add(c, portalG, glow(portalHues[(portalIdx.get(c) ?? 0) % 3], 0.95), 0));
      else if (t === T.GOO) add(c, gooG, plain, 0);
      else if (isPaint(t)) add(c, splatG, glow(COLORS[t - T.PAINT].hex, 1), 0.02);
      else if (t === T.SWITCH) add(c, switchG, plain, 0, 0, true);
      else if (t === T.SWA) add(c, swG, swA, 0, 0, true);
      else if (t === T.SWB) add(c, swG, swB, 0, 0, true);
      else if (t === T.GLASS) add(c, glassG, glassMat, 0, 0, true);
      else if (t === T.CRUMBLE) add(c, crumbleG, crumbleMat, 0.05, 0, true);
    });
    if (st.fences?.length) {
      const fg = sk(M.fenceGeo()), fm = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.1, transparent: true, opacity: 0.85, clearcoat: 1, emissive: new THREE.Color("#BFEFFF"), emissiveIntensity: 0.2 }));
      for (const key of st.fences) { const d = key % 4, c = (key - d) / 4; if (d !== 1 && d !== 2) continue; const m = new THREE.Mesh(fg, fm); const p = at(c); m.position.set(p.x + (d === 1 ? 0.5 : 0), 0, p.z + (d === 2 ? 0.5 : 0)); if (d === 2) m.rotation.y = Math.PI / 2; this.stageG.add(m); }
    }
    const crateG = sk(M.crateGeo());
    for (const c of st.crates ?? []) { const m = new THREE.Mesh(crateG, plain); m.position.copy(at(c)); this.stageG.add(m); this.crates.push(m); }
    this.syncCrates(s);
    // Gloopies: one instanced mesh per colour (+ rainbow), tops for doubles, shells, caps, eyes, hats
    const byColor = new Map<number, number[]>();
    st.blobs.forEach((b, c) => { if (b >= 0) { if (!byColor.has(b)) byColor.set(b, []); byColor.get(b)!.push(c); } });
    const total = [...byColor.values()].reduce((a, l) => a + l.length, 0);
    const eyeGeo = sk(M.eyesGeo()), eyeMat = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.15, clearcoat: 1 }));
    this.eyes = new THREE.InstancedMesh(eyeGeo, eyeMat, Math.max(1, total));
    this.eyes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.eyes.frustumCulled = false; this.stageG.add(this.eyes);
    const flagCount = (f: number) => st.blobs.filter((b, c) => b >= 0 && ((st.bflags?.[c] ?? 0) & f)).length;
    const shellMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => { if (!n) return null; const m = new THREE.InstancedMesh(sk(geo), mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.renderOrder = 5; this.stageG.add(m); this.shells.push(m); return m; };
    const bubbles = shellMesh(M.bubbleShellGeo(), sk(new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.2, depthWrite: false })), flagCount(BF.BUBBLE));
    const frosts = shellMesh(M.frostShellGeo(), sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, transparent: true, opacity: 0.94, envMapIntensity: 0.5 })), flagCount(BF.FROST));
    this.caps = shellMesh(M.bombCapGeo(), plain, flagCount(BF.BOMB));
    const hg = this.look.hat !== "none" ? hatGeo(this.look.hat) : null;
    if (hg) { hg.scale(0.32, 0.32, 0.32); hg.translate(0, 0.36 - 1.5 * 0.32, 0); this.hats = shellMesh(hg, plain, Math.max(1, total)); }
    let eyeN = 0, bubN = 0, frostN = 0, capN = 0;
    const tops = new Map<number, THREE.InstancedMesh>(); const topN = new Map<number, number>();
    for (const [color, list] of byColor) {
      const def = COLORS[color];
      const mat = sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.24, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.12, envMapIntensity: 0.45, emissive: new THREE.Color(color === RAINBOW ? "#ffffff" : def.hex), emissiveIntensity: color === RAINBOW ? 0.05 : 0.14 }));
      const mesh = new THREE.InstancedMesh(sk(color === RAINBOW ? M.rainbowGloopyGeo() : M.gloopyGeo(def.hex, def.symbol)), mat, list.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
      const doubles = list.filter((c) => (st.bflags?.[c] ?? 0) & BF.DOUBLE).length;
      if (doubles) { const tg = color === RAINBOW ? M.rainbowGloopyGeo().scale(0.62, 0.62, 0.62).translate(0, 0.5, 0) : M.doubleTopGeo(def.hex, def.symbol); const tm = new THREE.InstancedMesh(sk(tg), mat, doubles); tm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tm.frustumCulled = false; tops.set(color, tm); topN.set(color, 0); this.blobMeshes.push(tm); this.stageG.add(tm); }
      list.forEach((c, idx) => {
        const f = st.bflags?.[c] ?? 0;
        let top: Blob["top"] = null; if (f & BF.DOUBLE) { top = [tops.get(color)!, topN.get(color)!]; topN.set(color, top[1] + 1); }
        let shell: Blob["shell"] = null;
        if (f & BF.FROST && frosts) shell = [frosts, frostN++]; else if (f & BF.BUBBLE && bubbles) shell = [bubbles, bubN++];
        if (f & BF.FROST && f & BF.BUBBLE && bubbles) bubN++;
        this.blobs.push({ cell: c, color, x: c % W - this.cx, z: Math.floor(c / W) - this.cz, mesh, idx, eye: eyeN++, ph: (c * 1.618) % (Math.PI * 2), flags: f, top, shell, cap: f & BF.BOMB ? capN++ : -1, fly: null });
      });
      this.blobMeshes.push(mesh); this.stageG.add(mesh);
    }
    for (const cs of Object.keys(st.fuse ?? {})) {
      const c = Number(cs);
      const cv = document.createElement("canvas"); cv.width = 96; cv.height = 96;
      const ctx = cv.getContext("2d")!, tex = sk(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(sk(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthTest: false }))); sp.renderOrder = 9; sp.scale.setScalar(0.42);
      sp.position.copy(at(c, 1.05)); this.stageG.add(sp);
      this.fuses.push({ cell: c, sprite: sp, ctx, tex, shown: -99 });
    }
    // Slurpers (each with its own glass, so paint can change its colour)
    st.slurpers.forEach((d, i) => {
      const q = s.sl[i];
      const g = new THREE.Group();
      const gm = sk(new THREE.MeshPhysicalMaterial({ color: COLORS[q.color].hex, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.58, envMapIntensity: 0.7, emissive: new THREE.Color(COLORS[q.color].hex), emissiveIntensity: 0.42, depthWrite: false }));
      const rimMat = sk(new THREE.MeshBasicMaterial({ color: COLORS[q.color].glow, toneMapped: false }));
      const glass = new THREE.Mesh(sk(M.slurperGlassGeo(q.cells)), gm); glass.renderOrder = 3;
      const rim = new THREE.Mesh(sk(M.slurperRimGeo(q.cells)), rimMat); rim.renderOrder = 4;
      g.add(glass, rim);
      const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
      const ctx = cv.getContext("2d")!;
      const tex = sk(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
      const tag = new THREE.Sprite(sk(new THREE.SpriteMaterial({ map: tex, toneMapped: false, depthTest: false })));
      tag.scale.setScalar(0.5); tag.renderOrder = 8; g.add(tag);
      let icon: THREE.Sprite | null = null;
      if (d.lock !== undefined) { const kc = COLORS[d.lock].hex; icon = iconSprite((c) => { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(48, 52, 40, 0, Math.PI * 2); c.fill(); c.strokeStyle = kc; c.lineWidth = 9; c.beginPath(); c.arc(48, 40, 15, Math.PI, 0); c.stroke(); c.fillStyle = kc; c.fillRect(26, 42, 44, 30); }, sk); }
      else if (d.sleep) icon = iconSprite((c) => { c.fillStyle = "#ffffff"; c.beginPath(); c.arc(48, 48, 40, 0, Math.PI * 2); c.fill(); c.fillStyle = "#5C4BD6"; c.font = "900 44px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("Zz", 48, 52); }, sk);
      else if (d.hungry) icon = iconSprite((c) => { c.fillStyle = "#FFD23F"; c.beginPath(); c.arc(48, 48, 40, 0, Math.PI * 2); c.fill(); c.fillStyle = "#3A2600"; c.beginPath(); c.arc(48, 46, 22, 0, Math.PI); c.fill(); c.fillStyle = "#FF4D6D"; c.beginPath(); c.arc(48, 60, 9, 0, Math.PI); c.fill(); }, sk);
      if (icon) { icon.scale.setScalar(0.46); g.add(icon); }
      g.position.set(q.x - this.cx, 0, q.y - this.cz);
      this.stageG.add(g);
      this.sl.push({ g, glass, rim, rimMat, glassMat: gm, tag, tagCtx: ctx, tagTex: tex, icon, shown: "", vx: q.x - this.cx, vz: q.y - this.cz, lift: 0, seal: -1, shake: 0, sig: this.cellSig(q.cells), color: q.color, spin: 0 });
      this.placeTag(i);
    });
    const lg = sk(M.linkBarGeo());
    st.slurpers.forEach((d, i) => {
      for (const [key, col] of [["link", "#FFD23F"], ["mirror", "#C3A3FF"]] as const) { const j = d[key]; if (j !== undefined && j > i) { const m = new THREE.Mesh(lg, glow(col, 0.85)); m.renderOrder = 7; this.stageG.add(m); this.links.push({ a: i, b: j, m }); } }
    });
    // backdrop floaters
    const fn = this.q === "low" ? 14 : 34;
    const fm = sk(new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.2, clearcoat: 1, transparent: true, opacity: lab.float === "bubbles" ? 0.4 : 0.85 }));
    this.floaters = new THREE.InstancedMesh(sk(M.floater2Geo(lab.float)), fm, fn);
    this.floaters.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.floaters.frustumCulled = false;
    const pal = [lab.tile, lab.sky[1], "#ffffff", ...COLORS.slice(0, 5).map((c) => c.glow)];
    this.floatData = [];
    for (let i = 0; i < fn; i++) {
      const a = (i / fn) * Math.PI * 2 + i, rr = st.w * 0.7 + 3 + (i % 5) * 1.6;
      this.floatData.push({ x: Math.cos(a) * rr, y: -6 + ((i * 2.3) % 9), z: Math.sin(a) * rr * 0.9 - 4, s: 0.5 + ((i * 0.37) % 1) * 0.9, v: 0.3 + ((i * 0.53) % 1) * 0.5, r: i });
      this.floaters.setColorAt(i, new THREE.Color(pal[i % pal.length]));
    }
    this.stageG.add(this.floaters);
    this.hootMesh = new THREE.Mesh(sk(hoot()), sk(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.5 })));
    this.hootMesh.scale.setScalar(0.85); this.hootMesh.position.set(st.w / 2 + 0.55, -0.1, -st.h / 2 - 0.1); this.hootMesh.rotation.y = -0.5;
    this.stageG.add(this.hootMesh);
    this.winT = -1; this.stuckT = 0;
    this.syncCells(s);
    this.fit();
  }

  /** the HUD's space at the top and bottom of the screen (px), so the tray fits between */
  setInsets(top: number, bottom: number, left = 0, right = 0) { this.insetTop = top; this.insetBottom = bottom; this.insetLeft = left; this.insetRight = right; this.fit(); }

  private cellSig(cells: [number, number][]) { return cells.map((c) => c.join(",")).join(";"); }
  private placeTag(i: number) {
    const o = this.sl[i], q = this.s!.sl[i];
    const tagAt = q.cells.reduce((b, c) => (c[1] * 10 + c[0] > b[1] * 10 + b[0] ? c : b), q.cells[0]);
    o.tag.position.set(tagAt[0] + 0.3, 0.62, tagAt[1] + 0.28);
    if (o.icon) { const a = q.cells[0]; o.icon.position.set(a[0] - 0.25, 0.72, a[1] - 0.2); }
  }
  private drawTag(o: SlurperObj, need: number, hex: string, hungry: boolean) {
    const key = `${need}|${hex}`;
    if (o.shown === key) return;
    o.shown = key;
    const c = o.tagCtx;
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = hungry ? "#FFF3BF" : "#ffffff"; c.beginPath(); c.arc(64, 64, 54, 0, Math.PI * 2); c.fill();
    c.lineWidth = 11; c.strokeStyle = hex; c.stroke();
    c.fillStyle = "#1B1530"; c.font = "900 66px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(String(Math.max(0, need)), 64, 70);
    o.tagTex.needsUpdate = true;
  }
  private syncCrates(s: State) {
    this.crateAt.clear();
    const now: number[] = []; s.crates.forEach((v, c) => { if (v) now.push(c); });
    now.forEach((c, k) => { const m = this.crates[k]; if (!m) return; this.crateAt.set(c, m); m.position.set(c % this.st!.w - this.cx, 0, Math.floor(c / this.st!.w) - this.cz); });
  }
  /** the dynamic cells: glass, bridges, switch walls */
  private syncCells(s: State) {
    const st = this.st!;
    for (const [c, o] of this.cellObj) {
      const t0 = st.tiles[c], t = s.tiles[c];
      if (t0 === T.GLASS) o.visible = t === T.GLASS;
      else if (t0 === T.CRUMBLE) o.visible = t === T.CRUMBLE;
      else if (t0 === T.SWA) o.scale.y = s.sw === 0 ? 1 : 0.12;
      else if (t0 === T.SWB) o.scale.y = s.sw === 1 ? 1 : 0.12;
      else if (t0 === T.SWITCH) o.rotation.y = s.sw ? Math.PI : 0;
    }
    if (this.tileMesh) {
      let dirty = false;
      this.tileCells.forEach((c, i) => { if (st.tiles[c] !== T.CRUMBLE) return; if (s.tiles[c] === T.VOID) this.tileMesh!.setMatrixAt(i, ZERO); else { tmpM.makeTranslation(c % st.w - this.cx, 0.02, Math.floor(c / st.w) - this.cz); this.tileMesh!.setMatrixAt(i, tmpM); } dirty = true; });
      if (dirty) this.tileMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ camera
  fit() {
    const st = this.st; if (!st) return;
    // tall phone screens look more from above (the tray uses the height); wide screens a bit more from the side
    const e = this.h > this.w * 1.3 ? 1.14 : 0.98, fovY = (this.camera.fov * Math.PI) / 180;
    const pad = 0.4;
    const corners = [[-st.w / 2 - pad, 0, -st.h / 2 - pad - 0.6], [st.w / 2 + pad, 0, -st.h / 2 - pad - 0.6], [-st.w / 2 - pad, 0, st.h / 2 + pad], [st.w / 2 + pad, 0, st.h / 2 + pad], [-st.w / 2, 0.8, -st.h / 2 - 0.6], [st.w / 2, 0.8, -st.h / 2 - 0.6]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    // side insets: fit the tray between the side columns and centre it there (a view offset is a pure screen shift)
    const ox = (this.insetLeft - this.insetRight) / 2;
    if (ox) this.camera.setViewOffset(this.w, this.h, -ox, 0, this.w, this.h); else this.camera.clearViewOffset();
    const xSpan = Math.min(1.9, Math.max(0.3, 2 - ((this.insetLeft + this.insetRight) / this.w) * 2 - 0.04));
    const topF = this.insetTop / this.h, botF = this.insetBottom / this.h;
    const yMax = 1 - topF * 2 - 0.02, yMin = -1 + botF * 2 + 0.02;
    let d = Math.max(st.w, st.h) * 1.6, tz = 0;
    for (let it = 0; it < 8; it++) {
      this.camera.position.set(0, Math.sin(e) * d, tz + Math.cos(e) * d);
      this.camera.lookAt(0, 0, tz); this.camera.updateMatrixWorld(); this.camera.updateProjectionMatrix();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmpP.copy(c).project(this.camera); x0 = Math.min(x0, tmpP.x); x1 = Math.max(x1, tmpP.x); y0 = Math.min(y0, tmpP.y); y1 = Math.max(y1, tmpP.y); }
      const k = Math.max((x1 - x0) / xSpan, (y1 - y0) / Math.max(0.3, yMax - yMin));
      d *= lerp(1, k, 0.85);
      const off = (yMax + yMin) / 2 - (y0 + y1) / 2;
      tz += (off * d * Math.tan(fovY / 2)) / Math.sin(e) * 0.9;
    }
    if (this.shiftX) { this.camera.position.x = -this.shiftX; this.camera.lookAt(-this.shiftX, 0, tz); this.camera.updateMatrixWorld(); }
    if (this.scene.fog instanceof THREE.Fog) { this.scene.fog.near = d + 6; this.scene.fog.far = d + 45; }
    this.camera.getWorldDirection(this.skyMat.uniforms.fwd.value as THREE.Vector3);
  }

  /** screen point → board cell (or null) */
  pick(px: number, py: number): { x: number; y: number } | null {
    const st = this.st; if (!st) return null;
    const ndc = new THREE.Vector2((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const x = Math.round(hit.x + this.cx), y = Math.round(hit.z + this.cz);
    return { x: Math.max(-1, Math.min(st.w, x)), y: Math.max(-1, Math.min(st.h, y)) };
  }
  /** board cell → screen px (for DOM hints) */
  screenOf(x: number, y: number): [number, number] {
    tmpP.set(x - this.cx, 0.3, y - this.cz).project(this.camera);
    return [(tmpP.x * 0.5 + 0.5) * this.w, (-tmpP.y * 0.5 + 0.5) * this.h];
  }

  setDragged(i: number) { this.dragged = i; }
  /** after undo / restart: jump everything to the board as it is */
  snap(s: State) {
    this.s = s;
    this.blobs.forEach((b) => { b.fly = null; });
    this.sl.forEach((o, i) => { const q = s.sl[i]; o.vx = q.x - this.cx; o.vz = q.y - this.cz; o.seal = -1; o.g.scale.setScalar(1); });
    this.syncCrates(s); this.syncCells(s);
    this.winT = -1; this.stuckT = 0;
    this.clearHint();
  }

  // ------------------------------------------------------------------ hints
  showHint(drag: Drag) {
    const st = this.st, s = this.s; if (!st || !s) return;
    this.clearHint();
    const q = s.sl[drag.i], col = COLORS[q.color];
    let x = q.x, y = q.y;
    const dotG = new THREE.SphereGeometry(0.09, 10, 8); this.stageKeep.push(dotG);
    const dotM = new THREE.MeshBasicMaterial({ color: col.glow, toneMapped: false, transparent: true, opacity: 0.95 }); this.stageKeep.push(dotM);
    for (const ch of drag.dirs) {
      const k = DIR_CH.indexOf(ch); x += [0, 1, 0, -1][k]; y += [-1, 0, 1, 0][k];
      for (const [cx, cy] of q.cells) { const m = new THREE.Mesh(dotG, dotM); m.position.set(x + cx - this.cx, 0.45, y + cy - this.cz); this.hintG.add(m); }
    }
    const ghost = new THREE.Mesh(this.sl[drag.i].rim.geometry, new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.75 }));
    this.stageKeep.push(ghost.material as THREE.Material);
    ghost.position.set(x - this.cx, 0.05, y - this.cz); ghost.name = "ghost"; this.hintG.add(ghost);
    this.hintT = 0.001;
  }
  clearHint() { for (const c of [...this.hintG.children]) this.hintG.remove(c); this.hintT = 0; }

  // ------------------------------------------------------------------ events → effects
  onEvent(e: SlurpEvent) {
    const st = this.st, s = this.s; if (!st || !s) return;
    const W = st.w, cp = (c: number, y = 0.4) => new THREE.Vector3(c % W - this.cx, y, Math.floor(c / W) - this.cz);
    switch (e.t) {
      case "step": { this.clearHint(); if (e.kind === "slide") this.burstAt(new THREE.Vector3(e.x - this.cx, 0.1, e.y - this.cz), "#E7F8FF", 3, 2, 0.05, 4); break; }
      case "blocked": { const o = this.sl[e.i]; if (o) o.shake = 0.25; break; }
      case "slurp": {
        const q = s.sl[e.i];
        e.cells.forEach((c, k) => {
          const b = this.blobs.find((bb) => bb.cell === c);
          if (!b) return;
          let best = [q.x + q.cells[0][0], q.y + q.cells[0][1]], bd = 1e9;
          for (const [cx, cy] of q.cells) { const dd = Math.hypot(q.x + cx - this.cx - b.x, q.y + cy - this.cz - b.z); if (dd < bd) { bd = dd; best = [q.x + cx, q.y + cy]; } }
          b.fly = { t: 0, tx: best[0] - this.cx, tz: best[1] - this.cz, delay: k * 0.05 };
        });
        break;
      }
      case "seal": {
        const o = this.sl[e.i]; if (!o) break;
        o.seal = 0;
        const col = COLORS[e.color], q = s.sl[e.i];
        for (const [cx, cy] of q.cells) { this.burstAt(new THREE.Vector3(e.x + cx - this.cx, 0.4, e.y + cy - this.cz), col.glow, 10, 4.5, 0.07, 6); this.burstAt(new THREE.Vector3(e.x + cx - this.cx, 0.4, e.y + cy - this.cz), "#ffffff", 4, 3, 0.05, 4); }
        break;
      }
      case "fx": {
        const f = e.e;
        if (f.t === "pop") this.burstAt(cp(f.cell, 0.5), "#E7F8FF", 12, 3.5, 0.06, 3);
        else if (f.t === "break") { this.burstAt(cp(f.cell, 0.4), "#BFE8FF", 14, 4.5, 0.08, 10); this.syncCells(s); }
        else if (f.t === "crumble") { this.burstAt(cp(f.cell, 0), "#A5E7FF", 10, 3, 0.07, 12); this.syncCells(s); }
        else if (f.t === "switch") this.syncCells(s);
        else if (f.t === "paint") { const q = s.sl[f.i]; this.burstAt(new THREE.Vector3(q.x - this.cx, 0.5, q.y - this.cz), COLORS[f.color].glow, 16, 4, 0.08, 6); }
        else if (f.t === "turn") { const o = this.sl[f.i]; if (o) o.spin = 1; }
        else if (f.t === "crate") { const m = this.crateAt.get(f.from); if (m) { this.crateAt.delete(f.from); this.crateAt.set(f.to, m); } this.burstAt(cp(f.to, 0.1), "#E8C08A", 6, 2.5, 0.07, 8); }
        else if (f.t === "portal") { this.burstAt(cp(f.from, 0.3), "#C3A3FF", 14, 3, 0.07, 2); this.burstAt(cp(f.to, 0.3), "#C3A3FF", 14, 3, 0.07, 2); const o = this.sl[f.i]; if (o) { const q = s.sl[f.i]; o.vx = q.x - this.cx; o.vz = q.y - this.cz; } }
        else if (f.t === "unlock" || f.t === "wake") { const q = s.sl[f.i]; this.burstAt(new THREE.Vector3(q.x - this.cx, 0.8, q.y - this.cz), "#FFE066", 18, 4, 0.08, 4); }
        else if (f.t === "bomb") { this.burstAt(cp(f.cell, 0.4), "#FF8A3D", 22, 6, 0.1, 6); this.burstAt(cp(f.cell, 0.4), "#FFE066", 12, 4, 0.07, 6); }
        break;
      }
      case "win": this.winT = 0; break;
      case "stuck": case "burnt": this.stuckT = 1.2; break;
      case "undo": case "restart": this.snap(s); break;
      default: break;
    }
  }
  private burstAt(p: THREE.Vector3, color: string, n: number, speed: number, size: number, grav = 8) {
    for (let i = 0; i < n && this.parts.length < this.partMax; i++) {
      const a = Math.random() * Math.PI * 2, el = Math.random() * 1.2, sp = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({ p: p.clone(), v: new THREE.Vector3(Math.cos(a) * sp * Math.cos(el), Math.sin(el) * sp + 1.5, Math.sin(a) * sp * Math.cos(el)), life: 0.55 + Math.random() * 0.35, max: 0.9, size: size * (0.6 + Math.random() * 0.8), color: new THREE.Color(color), grav });
    }
  }

  // ------------------------------------------------------------------ per frame
  frame(dt: number) {
    const st = this.st, s = this.s;
    this.t += dt;
    this.sky.position.copy(this.camera.position);
    if (st && s) {
      const W = st.w;
      for (const b of this.blobs) {
        const here = s.blobs[b.cell] >= 0;
        let m: THREE.Matrix4 | null = null;
        if (b.fly) {
          const f = b.fly; f.t += dt;
          const k = (f.t - f.delay) / 0.32;
          if (k >= 1) b.fly = null;
          else if (k < 0) m = this.idle(b);
          else {
            const e = ease(k), x = lerp(b.x, f.tx, e), z = lerp(b.z, f.tz, e), y = Math.sin(k * Math.PI) * 0.9 + k * 0.2, sc = 1 - k * 0.85;
            tmpQ.setFromEuler(tmpE.set(-0.45, 0, Math.sin(k * 20) * 0.2));
            m = BODY.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sc * (1 - k * 0.3), sc * (1 + k * 0.8), sc));
          }
        } else if (here) m = this.idle(b);
        const frosted = !!(b.flags & BF.FROST) && here && !this.revealed(b.cell, s);
        if (m) {
          if (b.shell) { const isFrost = b.flags & BF.FROST, show = isFrost ? frosted : s.bub[b.cell] > 0 && here; b.shell[0].setMatrixAt(b.shell[1], show ? EYE.copy(m).multiply(OFF.makeScale(1.04, 1.04, 1.04)) : ZERO); }
          const blink = Math.sin(this.t * 0.9 + b.ph * 3) > 0.985 ? 0.1 : 1;
          this.eyes!.setMatrixAt(b.eye, frosted ? ZERO : EYE.copy(m).multiply(OFF.compose(tmpP.set(0, 0.43, 0.27), tmpQ.identity(), tmpS.set(1, blink, 1))));
          if (b.top) b.top[0].setMatrixAt(b.top[1], m);
          if (this.hats) this.hats.setMatrixAt(b.eye, frosted || b.top ? ZERO : m);
          if (b.cap >= 0 && this.caps) this.caps.setMatrixAt(b.cap, m);
          // a frosted Gloopy hides its colour: shrink the body under the frost
          b.mesh.setMatrixAt(b.idx, frosted ? OFF.copy(m).multiply(EYE.makeScale(0.8, 0.8, 0.8)) : m);
        } else {
          b.mesh.setMatrixAt(b.idx, ZERO); this.eyes!.setMatrixAt(b.eye, ZERO);
          if (b.top) b.top[0].setMatrixAt(b.top[1], ZERO);
          if (this.hats) this.hats.setMatrixAt(b.eye, ZERO);
          if (b.cap >= 0 && this.caps) this.caps.setMatrixAt(b.cap, ZERO);
          if (b.shell) b.shell[0].setMatrixAt(b.shell[1], ZERO);
        }
      }
      for (const m of this.blobMeshes) m.instanceMatrix.needsUpdate = true;
      for (const m of this.shells) m.instanceMatrix.needsUpdate = true;
      if (this.eyes) this.eyes.instanceMatrix.needsUpdate = true;
      for (const f of this.fuses) {
        const alive = s.blobs[f.cell] >= 0, left = (st.fuse[f.cell] ?? 0) - s.moves;
        f.sprite.visible = alive;
        if (alive && left !== f.shown) {
          f.shown = left; const c = f.ctx; c.clearRect(0, 0, 96, 96);
          c.fillStyle = left <= 1 ? "#FF3B5C" : "#FF9F1C"; c.beginPath(); c.arc(48, 50, 40, 0, Math.PI * 2); c.fill();
          c.fillStyle = "#ffffff"; c.font = "900 46px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(Math.max(0, left)), 48, 54);
          f.tex.needsUpdate = true;
        }
        if (alive) f.sprite.scale.setScalar(0.42 * (left <= 1 ? 1 + Math.abs(Math.sin(this.t * 8)) * 0.15 : 1));
      }
      this.sl.forEach((o, i) => {
        const q = s.sl[i], d = st.slurpers[i];
        if (!q.alive && o.seal < 0) { o.g.visible = false; return; }
        o.g.visible = true;
        const sig = this.cellSig(q.cells);
        if (sig !== o.sig) { o.sig = sig; const gg = M.slurperGlassGeo(q.cells), rg = M.slurperRimGeo(q.cells); this.stageKeep.push(gg, rg); o.glass.geometry = gg; o.rim.geometry = rg; this.placeTag(i); }
        if (o.color !== q.color) { o.color = q.color; o.glassMat.color.set(COLORS[q.color].hex); o.glassMat.emissive.set(COLORS[q.color].hex); }
        const tx = q.x - this.cx, tz = q.y - this.cz;
        o.vx = lerp(o.vx, tx, Math.min(1, dt * 22)); o.vz = lerp(o.vz, tz, Math.min(1, dt * 22));
        o.lift = lerp(o.lift, i === this.dragged ? 1 : 0, Math.min(1, dt * 14));
        o.shake = Math.max(0, o.shake - dt);
        o.spin = Math.max(0, o.spin - dt * 3);
        const sh = o.shake > 0 ? Math.sin(o.shake * 70) * 0.06 : 0;
        o.g.position.set(o.vx + sh, o.lift * 0.16, o.vz);
        o.g.rotation.y = o.spin > 0 ? Math.sin(o.spin * Math.PI) * 0.4 : 0;
        const asleep = !q.awake;
        const pulse = asleep ? 0.55 : 1 + (i === this.dragged ? 0.35 + Math.sin(this.t * 10) * 0.15 : Math.sin(this.t * 2.2 + i) * 0.08);
        const skin = this.look.skin;
        tmpC.set(skin === "gold" ? "#FFC93C" : skin === "candy" ? (Math.floor(this.t * 2 + i) % 2 ? "#FFFFFF" : COLORS[q.color].hex) : COLORS[q.color].hex);
        o.rimMat.color.copy(tmpC).lerp(WHITE, skin === "crystal" ? 0.5 : i === this.dragged ? 0.35 : 0.12).multiplyScalar(1.2 * pulse);
        o.glassMat.opacity = asleep ? 0.32 : skin === "crystal" ? 0.4 : 0.58;
        o.glassMat.metalness = skin === "gold" ? 0.4 : 0;
        if (o.icon) o.icon.visible = asleep || !!d.hungry;
        if (o.seal >= 0) {
          o.seal += dt;
          const k = o.seal / 0.42;
          o.g.scale.setScalar(k < 0.35 ? 1 + k * 0.5 : Math.max(0.001, 1.17 * (1 - (k - 0.35) / 0.65)));
          o.g.position.y = 0.16 + k * 0.4;
          if (k >= 1) { o.seal = -1; o.g.visible = false; o.g.scale.setScalar(1); }
        } else o.g.scale.setScalar(1 + o.lift * 0.04);
        this.drawTag(o, q.need, COLORS[q.color].hex, !!d.hungry);
        o.tag.position.y = 0.62 + Math.sin(this.t * 3 + i) * 0.03;
      });
      for (const l of this.links) {
        const A = this.sl[l.a], B = this.sl[l.b], qa = s.sl[l.a], qb = s.sl[l.b];
        l.m.visible = qa.alive && qb.alive;
        if (!l.m.visible) continue;
        const ca = qa.cells[0], cb = qb.cells[0];
        const ax = A.vx + ca[0], az = A.vz + ca[1], bx = B.vx + cb[0], bz = B.vz + cb[1];
        l.m.position.set((ax + bx) / 2, 0.55, (az + bz) / 2); l.m.scale.set(Math.max(0.01, Math.hypot(bx - ax, bz - az)), 1, 1); l.m.rotation.set(0, -Math.atan2(bz - az, bx - ax), 0);
      }
      for (const [c, m] of this.crateAt) { const x = c % W - this.cx, z = Math.floor(c / W) - this.cz; m.position.x = lerp(m.position.x, x, Math.min(1, dt * 18)); m.position.z = lerp(m.position.z, z, Math.min(1, dt * 18)); }
      for (const b of this.belts) { const k = ((this.t * 0.8 + b.k * 0.5) % 1) - 0.5; b.m.position.set(b.x + [0, 1, 0, -1][b.d] * k * 0.8, 0.02, b.z + [-1, 0, 1, 0][b.d] * k * 0.8); }
      for (const sp of this.spinners) sp.rotation.y += dt * 1.6;
      if (this.tileMesh) {
        const anim = this.winT >= 0 || this.stuckT > 0;
        if (anim || this.tileMesh.userData.dirty) {
          this.tileCells.forEach((c, i) => {
            const x = c % W, y = (c - x) / W;
            let col = this.tileBase[i];
            if (this.winT >= 0) { const wave = Math.max(0, 1 - Math.abs(this.winT * 9 - (x + y)) / 2); col = tmpC.copy(col).lerp(WHITE, wave * 0.8); }
            else if (this.stuckT > 0) col = tmpC.copy(col).lerp(new THREE.Color("#FF8FA3"), this.stuckT * 0.35);
            this.tileMesh!.setColorAt(i, col);
          });
          if (this.tileMesh.instanceColor) this.tileMesh.instanceColor.needsUpdate = true;
          this.tileMesh.userData.dirty = anim;
        }
        if (this.winT >= 0) { this.winT += dt; if (Math.random() < 0.6) this.burstAt(new THREE.Vector3((Math.random() - 0.5) * st.w, 0.5, (Math.random() - 0.5) * st.h), COLORS[Math.floor(Math.random() * 8)].glow, 3, 5, 0.08, 5); }
        this.stuckT = Math.max(0, this.stuckT - dt * 0.6);
      }
      if (this.hintT > 0) { this.hintT += dt; const gh = this.hintG.getObjectByName("ghost"); if (gh) gh.position.y = 0.08 + Math.abs(Math.sin(this.hintT * 4)) * 0.12; this.hintG.children.forEach((c, k) => { if (c.name !== "ghost") c.scale.setScalar(0.8 + Math.abs(Math.sin(this.hintT * 5 - k * 0.3)) * 0.6); }); }
      if (this.hootMesh) { this.hootMesh.position.y = -0.1 + Math.abs(Math.sin(this.t * 1.6)) * 0.05; this.hootMesh.rotation.z = Math.sin(this.t * 0.8) * 0.05; }
    }
    if (this.floaters) {
      this.floatData.forEach((f, i) => {
        f.y += f.v * dt; if (f.y > 3) f.y = -8;
        tmpQ.setFromEuler(tmpE.set(this.t * 0.3 + f.r, this.t * 0.4 + f.r, 0));
        tmpM.compose(tmpP.set(f.x + Math.sin(this.t * 0.5 + f.r) * 0.6, f.y, f.z), tmpQ, tmpS.setScalar(f.s));
        this.floaters!.setMatrixAt(i, tmpM);
      });
      this.floaters.instanceMatrix.needsUpdate = true;
    }
    let n = 0;
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of this.parts) {
      p.v.y -= p.grav * dt; p.p.addScaledVector(p.v, dt);
      tmpM.compose(p.p, tmpQ.identity(), tmpS.setScalar(p.size * Math.min(1, (p.life / p.max) * 1.6)));
      this.partMesh.setMatrixAt(n, tmpM); this.partMesh.setColorAt(n, p.color); n++;
    }
    this.partMesh.count = n; this.partMesh.instanceMatrix.needsUpdate = true; if (this.partMesh.instanceColor) this.partMesh.instanceColor.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
  /** frost lifts once a Gloopy next to it has been slurped */
  private revealed(c: number, s: State): boolean {
    const st = this.st!, W = st.w, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= st.h) continue; const n = ny * W + nx; if (st.blobs[n] >= 0 && s.blobs[n] < 0) return true; }
    return false;
  }
  private idle(b: Blob): THREE.Matrix4 {
    const w = Math.sin(this.t * 3.1 + b.ph), sy = 1 + w * 0.045, sx = 1 - w * 0.03;
    const hop = Math.max(0, Math.sin(this.t * 2 + b.ph * 2)) ** 12 * 0.08;
    tmpQ.setFromEuler(tmpE.set(-0.45, Math.sin(this.t * 0.7 + b.ph) * 0.18, 0));
    return BODY.compose(tmpP.set(b.x, 0.02 + hop, b.z), tmpQ, tmpS.set(sx, sy, sx));
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    this.fit();
  }
  private clear() {
    for (const c of [...this.stageG.children]) this.stageG.remove(c);
    this.clearHint();
    for (const k of this.stageKeep) k.dispose();
    this.stageKeep = []; this.blobs = []; this.blobMeshes = []; this.eyes = null; this.caps = null; this.hats = null; this.shells = []; this.sl = []; this.parts = []; this.fuses = []; this.links = [];
    this.cellObj.clear(); this.belts = []; this.spinners = []; this.crates = []; this.crateAt.clear();
    this.floaters = null; this.hootMesh = null; this.tileMesh = null;
  }
  dispose() {
    this.gov?.dispose();
    this.clear();
    for (const k of this.keep) k.dispose();
    this.partMesh.geometry.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
