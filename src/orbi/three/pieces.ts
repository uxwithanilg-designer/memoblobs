// The things on the road, drawn: platforms (stones, movers, swings on ropes, strands, holey boards, switch bridges,
// beat tiles, piano keys, blind landings), falling tiles and pontoons, spinning discs and targets, seesaws, rocking
// plates and logs; jump pads (and their cannons, catapults and drums), boost chevrons, trampolines, air rings and
// portals; bumpers and rolling boulders, blocks (walls, doors, presses, clappers, cannonballs), hammers, sweepers and
// flippers, lasers and prism gates, spikes and lightning; painted zones laid along the road's curve; pickups (coins
// are one instanced mesh), hearts, O-R-B-I letters, chests and gold coins; switches and Kranky's cores; chasers
// (boulders, avalanches, dominoes, worms, trains, storms, comets); checkpoint gates, lanterns, the start gate, the
// finish arch and Kranky's machines. Each piece is placed in the road's frame every frame and animated from the physics.
import * as THREE from "three";
import type { World } from "../data/worlds";
import type { Sim } from "../sim";
import type { Track } from "../track";
import type { Obj } from "../types";
import { arrowTex, checkerTex, glowTex, krankyTex, letterTex, roadTex, zoneTex } from "./tex";

export interface View { o: Obj; root: THREE.Group; parts: Record<string, THREE.Object3D>; world?: boolean; geos?: THREE.BufferGeometry[] }
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 28);
const CONE = new THREE.ConeGeometry(1, 1, 14);
const SPH = new THREE.SphereGeometry(1, 24, 16);
const ICO = new THREE.IcosahedronGeometry(1, 1);
const TORUS = new THREE.TorusGeometry(1, 0.11, 10, 44);
const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const QUAD = new THREE.PlaneGeometry(1, 1);
const OCTA = new THREE.OctahedronGeometry(1, 0);
const COIN = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24).rotateZ(Math.PI / 2);
function starGeo() {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.25 : 0.55; if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }).center();
}
function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5); s.bezierCurveTo(-0.15, -0.3, -0.6, -0.1, -0.55, 0.2); s.bezierCurveTo(-0.5, 0.5, -0.1, 0.55, 0, 0.3);
  s.bezierCurveTo(0.1, 0.55, 0.5, 0.5, 0.55, 0.2); s.bezierCurveTo(0.6, -0.1, 0.15, -0.3, 0, -0.5);
  return new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }).center();
}
const STAR = starGeo();
const HEART = heartGeo();
const CAPS = new THREE.CapsuleGeometry(0.34, 0.4, 6, 14);
const LETTERS = ["O", "R", "B", "I"];
// scratch objects reused every frame (nothing new is made per piece or per coin, so no garbage-collection pauses)
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _rot = new THREE.Matrix4(), _P = [0, 0, 0];
const BEAT = new Set(["beat", "colour", "light", "flip", "offbeat", "royale"]);

export class Pieces {
  readonly group = new THREE.Group();
  private mats: Record<string, THREE.Material>;
  private coins: THREE.InstancedMesh;
  private tmp = new THREE.Object3D();
  private F = new Float32Array(12);
  private m4 = new THREE.Matrix4();
  constructor(private tr: Track, private world: World, env: THREE.Texture | null) {
    const R = world.road;
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, ...o });
    const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 0.7, envMap: env, ...o });
    const glow = (c: string, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mats = {
      top: std({ color: R.top, map: roadTex(R.line) }), side: std({ color: R.side, roughness: 0.8 }),
      stone: std({ color: world.pal.rock, roughness: 0.9 }), grass: std({ color: world.pal.grass, roughness: 0.85 }),
      wood: std({ color: "#B87A44", map: roadTex("#000", "plank"), roughness: 0.75 }), woodDk: std({ color: "#7A4A24", roughness: 0.8 }),
      tile: std({ color: new THREE.Color(R.top).lerp(new THREE.Color("#ffffff"), 0.35), roughness: 0.5 }),
      red: phys({ color: "#E8344A" }), white: phys({ color: "#F4F6FA" }), yellow: phys({ color: "#FFC600" }), dark: std({ color: "#2A2E38", roughness: 0.6 }),
      black: phys({ color: "#16181E", roughness: 0.3 }), green: phys({ color: "#3FBF5A" }), blue: phys({ color: "#2E8BFF" }), orange: phys({ color: "#FF8A1E" }),
      metal: phys({ color: "#C8D0DA", metalness: 0.9, roughness: 0.2 }), pink: phys({ color: "#FF5AB8" }), accent: phys({ color: R.stripeA }),
      pad: new THREE.MeshBasicMaterial({ map: arrowTex("#5CF2FF"), transparent: true, depthWrite: false }),
      padBase: std({ color: "#1A4A8A", emissive: new THREE.Color("#2E8BFF"), emissiveIntensity: 0.6 }),
      boost: new THREE.MeshBasicMaterial({ map: arrowTex("#FFE14D"), transparent: true, depthWrite: false }),
      membrane: phys({ color: "#FF3D8B", roughness: 0.4 }),
      laser: new THREE.MeshBasicMaterial({ color: "#FF2E5A", transparent: true, opacity: 0.85 }),
      prism1: glow("#FF4A8A", 0.8), prism2: glow("#2EA8FF", 0.8),
      spike: phys({ color: "#D8DEE8", metalness: 0.7, roughness: 0.25 }),
      gold: phys({ color: "#FFB81C", metalness: 0.55, roughness: 0.28, emissive: new THREE.Color("#B87A00"), emissiveIntensity: 0.55, envMapIntensity: 0.6 }),
      gem: phys({ color: "#5CF2FF", transmission: 0.3, roughness: 0.05, emissive: new THREE.Color("#1A8AA8"), emissiveIntensity: 0.6 }),
      orb: new THREE.MeshBasicMaterial({ color: "#7CF2FF" }),
      caps: phys({ color: "#FF7CF0", emissive: new THREE.Color("#7A2A8A"), emissiveIntensity: 0.4 }),
      star: phys({ color: "#FFE14D", metalness: 0.6, roughness: 0.2, emissive: new THREE.Color("#8A6A00"), emissiveIntensity: 0.6 }),
      heart: phys({ color: "#FF3A5A", emissive: new THREE.Color("#8A0A20"), emissiveIntensity: 0.5 }),
      mineSpike: std({ color: "#FF2E3A", emissive: new THREE.Color("#FF1A2A"), emissiveIntensity: 1.1 }),
      rocketCore: std({ color: "#FFE9A8", emissive: new THREE.Color("#FFB43A"), emissiveIntensity: 1.6 }),
      check: std({ map: checkerTex() }), banner: std({ color: R.stripeA, roughness: 0.5 }),
      glass: new THREE.MeshPhysicalMaterial({ color: "#CFF6FF", roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35, envMap: env, depthWrite: false, side: THREE.DoubleSide }),
      rope: std({ color: "#5A3A22", roughness: 0.9 }), vine: std({ color: "#3A8A3A", roughness: 0.9 }),
      rock: std({ color: world.pal.rock, roughness: 0.95, flatShading: true }),
      jelly: new THREE.MeshPhysicalMaterial({ color: "#FF8AD8", transmission: 0.5, roughness: 0.15, transparent: true, opacity: 0.75, envMap: env }),
      neon: new THREE.MeshBasicMaterial({ color: R.glow ?? R.stripeA }), neon2: new THREE.MeshBasicMaterial({ color: "#5CF2FF" }),
      beatOn: std({ color: "#FFFFFF", emissive: new THREE.Color(R.stripeA), emissiveIntensity: 0.9 }), beatWarn: std({ color: "#FFD23A", emissive: new THREE.Color("#FF6A1A"), emissiveIntensity: 0.8 }),
      core: std({ color: "#FF2E5A", emissive: new THREE.Color("#FF2E5A"), emissiveIntensity: 1.4 }), coreDone: std({ color: "#5A5E68", roughness: 0.7 }),
      beam: glow("#FF5A7A", 0.35), cyanGlow: glow("#5CF2FF", 0.55), orangeGlow: glow("#FF9A3A", 0.55), fire: glow("#FF7A1A", 0.85), bolt: glow("#E8F4FF", 0.9), warn: glow("#FFE14D", 0.45),
      on: std({ color: "#3FDF6A", emissive: new THREE.Color("#3FDF6A"), emissiveIntensity: 0.9 }), off: std({ color: "#E8344A", emissive: new THREE.Color("#E8344A"), emissiveIntensity: 0.7 }),
      face: new THREE.MeshBasicMaterial({ map: krankyTex(R.glow ?? "#FF2E5A") }),
      bossBody: phys({ color: new THREE.Color(R.stripeA).lerp(new THREE.Color("#30343E"), 0.35), metalness: 0.5, roughness: 0.35 }),
    };
    for (const z of ["ice", "sticky", "sand", "lava", "conveyor", "speed", "wind", "vent", "lowg", "heavyg", "swirl", "hole", "trap", "town", "paint1", "paint2", "rumble", "belt", "spores", "hands", "gust", "tornado", "solar", "petals"]) {
      const t = zoneTex(z).clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      const see = ["lava", "speed", "lowg", "swirl", "spores", "hands", "gust", "tornado", "solar", "petals", "wind"].includes(z);
      this.mats["z_" + z] = see
        ? new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: z === "lowg" || z === "wind" || z === "gust" || z === "tornado" || z === "solar" || z === "petals" ? 0.4 : z === "spores" || z === "hands" ? 0.7 : 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
        : new THREE.MeshStandardMaterial({ map: t, roughness: z === "ice" ? 0.08 : 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    }
    for (const ch of LETTERS) this.mats["l_" + ch] = new THREE.MeshBasicMaterial({ map: letterTex(ch), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    this.coins = new THREE.InstancedMesh(COIN, this.mats.gold, 700);
    this.coins.count = 0; this.coins.frustumCulled = false;
    this.group.add(this.coins);
  }

  /** a painted stretch laid along the road (it follows the curve), in world space */
  private ribbon(o: Obj, mat: string, lift: number): View {
    const ds = o.ds ?? 5, w = o.w ?? 2, s0 = o.s - ds, s1 = o.s + ds, F = this.F;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const n = Math.max(2, Math.ceil((s1 - s0) / 2));
    for (let i = 0; i <= n; i++) {
      const s = s0 + ((s1 - s0) * i) / n; this.tr.frame(s, F);
      for (const k of [-1, 1]) { const u = o.u + k * w; pos.push(F[0] + F[9] * u + F[6] * lift, F[1] + F[10] * u + F[7] * lift, F[2] + F[11] * u + F[8] * lift); uv.push(k < 0 ? 0 : Math.max(1, w / 2), (s - s0) / 4); }
      if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const root = new THREE.Group(), me = new THREE.Mesh(g, this.mats[mat]); me.receiveShadow = true; root.add(me);
    return { o, root, parts: { zone: me }, world: true, geos: [g] };
  }

  // ---------------------------------------------------------------- build one piece
  make(o: Obj): View | null {
    const root = new THREE.Group(), parts: Record<string, THREE.Object3D> = {};
    const mesh = (g: THREE.BufferGeometry, m: string, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, cast = true) => {
      const me = new THREE.Mesh(g, this.mats[m]); me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; return me;
    };
    const sprite = (c: string, s: number, y = 0, op = 0.8) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op })); sp.scale.setScalar(s); sp.position.y = y; return sp; };
    const w = o.w ?? 1, ds = o.ds ?? 1, look = o.look ?? "";
    switch (o.k) {
      case "plat": {
        if (look === "stone") { const b = new THREE.Group(); b.add(mesh(CYL, "top", w, 0.3, w, 0, -0.15)); b.add(mesh(CONE, "stone", w * 0.95, 2.4, w * 0.95, 0, -1.5).rotateX(Math.PI)); root.add(b); break; }
        if (look === "strand") { root.add(mesh(BOX, "neon", w * 2, 0.3, ds * 2, 0, -0.15)); root.add(mesh(BOX, "dark", w * 1.6, 0.5, ds * 2, 0, -0.55)); break; }
        if (look === "key" || look === "keyB") { root.add(mesh(BOX, look === "key" ? "white" : "black", w * 2, 0.4, ds * 2 - 0.08, 0, -0.2)); break; }
        if (BEAT.has(look)) { const t = mesh(BOX, "beatOn", w * 2, 0.3, ds * 2, 0, -0.15); root.add(t); root.add(mesh(BOX, "dark", w * 2 - 0.1, 0.4, ds * 2 - 0.1, 0, -0.5)); parts.top = t; break; }
        if (look === "bridge") { const b = new THREE.Group(); b.add(mesh(BOX, "metal", w * 2, 0.3, ds * 2, 0, -0.15)); b.add(mesh(BOX, "yellow", 0.25, 0.5, ds * 2, -w + 0.12, 0.1)); b.add(mesh(BOX, "yellow", 0.25, 0.5, ds * 2, w - 0.12, 0.1)); root.add(b); parts.body = b; break; }
        if (look === "blind") { const b = mesh(BOX, "glass", w * 2, 0.3, ds * 2, 0, -0.15); root.add(b); parts.body = b; break; }
        const m = look === "mover" ? "accent" : look === "board" || look === "maze" ? "wood" : look === "vine" ? "grass" : "top";
        root.add(mesh(BOX, m, w * 2, 0.35, ds * 2, 0, -0.175)); root.add(mesh(BOX, "side", w * 2 - 0.1, 0.9, ds * 2 - 0.1, 0, -0.75));
        if (o.mov?.ax === "swing") {
          const rm = look === "vine" ? "vine" : "rope";
          for (const z of [-ds + 0.4, ds - 0.4]) { const r = mesh(BOX, rm, 0.09, 8, 0.09, 0, 4, z, false); root.add(r); parts["rope" + (z > 0 ? 1 : 0)] = r; }
          if (look === "pendulum") root.add(mesh(SPH, "gold", 1.1, 1.1, 1.1, 0, -1.6));
        }
        break;
      }
      case "tile": {
        const m = look === "pontoon" ? "wood" : look === "ruin" ? "stone" : look === "glitch" || look === "keepup" ? "neon2" : "tile";
        const b = new THREE.Group(); b.add(mesh(BOX, m, w * 2, 0.32, ds * 2, 0, -0.16)); b.add(mesh(BOX, look === "pontoon" ? "woodDk" : "side", w * 2 - 0.1, 0.5, ds * 2 - 0.1, 0, -0.55)); root.add(b); parts.body = b; break;
      }
      case "disc": {
        const b = new THREE.Group();
        if (look === "target") { for (let k = 0; k < 4; k++) b.add(mesh(CYL, k % 2 ? "white" : "red", w * (1 - k * 0.22), 0.32 + k * 0.01, w * (1 - k * 0.22), 0, -0.16 + k * 0.005)); }
        else { b.add(mesh(CYL, look === "plate" ? "white" : look === "tread" ? "dark" : "top", w, 0.32, w, 0, -0.16)); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.add(mesh(BOX, "accent", 0.25, 0.05, w * 0.9, Math.sin(a) * w * 0.45, 0.01, Math.cos(a) * w * 0.45, false).rotateY(a)); } }
        b.add(mesh(CYL, "side", w * 0.98, 0.7, w * 0.98, 0, -0.65));
        root.add(b); parts.body = b;
        if (look !== "target") root.add(mesh(CYL, "dark", 0.5, 3, 0.5, 0, -2.2));
        break;
      }
      case "seesaw": case "tilt": {
        const b = new THREE.Group();
        b.add(mesh(BOX, look === "rope" ? "wood" : "top", w * 2, 0.3, ds * 2, 0, -0.15)); b.add(mesh(BOX, "side", w * 2, 0.4, ds * 2 - 0.2, 0, -0.5));
        root.add(b); parts.body = b;
        const piv = mesh(CONE, "dark", 0.7, 1.6, 0.7, 0, -1.4); piv.rotateX(Math.PI); root.add(piv);
        break;
      }
      case "log": { const b = mesh(CYL, "wood", 1.15, ds * 2, 1.15, 0, -1.15); b.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(b); root.add(g); parts.body = b; break; }
      case "pad": {
        root.add(mesh(BOX, "padBase", w * 2, 0.12, ds * 2, 0, 0.02, 0, false)); const a = mesh(PLANE, "pad", w * 1.8, 1, ds * 1.8, 0, 0.1, 0, false); root.add(a); parts.arrow = a;
        if (look === "cannon" || look === "leap" || look === "bass" || look === "drop") {
          const c = new THREE.Group(); c.position.set(0, 0.6, -0.6); c.rotation.x = -0.6;
          c.add(mesh(CYL, look === "cannon" ? "black" : "accent", 1.05, 3, 1.05, 0, 0.6)); c.add(mesh(CYL, "gold", 1.15, 0.25, 1.15, 0, 1.9)); c.add(mesh(CYL, "gold", 1.15, 0.25, 1.15, 0, -0.5));
          c.add(mesh(CYL, "dark", 0.85, 0.05, 0.85, 0, 2.1, 0, false));
          root.add(c);
          for (const x of [-1.3, 1.3]) root.add(mesh(CYL, "woodDk", 0.6, 0.25, 0.6, x, 0.6).rotateZ(Math.PI / 2));
        } else if (look === "catapult") {
          root.add(mesh(BOX, "woodDk", 2.6, 0.4, 0.5, 0, 0.3, -1.6)); const arm = mesh(BOX, "wood", 0.3, 0.3, 3.4, 0, 0.9, -0.4); arm.rotation.x = -0.4; root.add(arm); parts.arm = arm;
        } else if (look === "drum") {
          root.add(mesh(CYL, "red", w + 0.2, 0.9, w + 0.2, 0, -0.45)); root.add(mesh(CYL, "white", w + 0.25, 0.08, w + 0.25, 0, -0.02)); root.add(mesh(CYL, "gold", w + 0.28, 0.1, w + 0.28, 0, -0.85));
        } else if (look === "ring") { const r = mesh(TORUS, "gold", w + 0.3, w + 0.3, w + 0.3, 0, 0.12, 0, false); r.rotation.x = Math.PI / 2; root.add(r); }
        else if (look === "planet") { root.add(mesh(SPH, "blue", 1.6, 1.6, 1.6, w + 2.4, 1.2)); root.add(mesh(TORUS, "gold", 2.4, 2.4, 0.6, w + 2.4, 1.2, 0, false)); }
        break;
      }
      case "boost": { const a = mesh(PLANE, "boost", w * 2, 1, ds * 2, 0, 0.03, 0, false); root.add(a); parts.arrow = a; break; }
      case "tramp": { root.add(mesh(CYL, "dark", w, 0.5, w, 0, -0.1)); const m = mesh(CYL, "membrane", w * 0.9, 0.12, w * 0.9, 0, 0.18); root.add(m); parts.top = m; break; }
      case "ring": {
        const r = mesh(TORUS, look === "dragon" ? "fire" : look === "antigrav" ? "cyanGlow" : "gold", w, w, w * 1.4, 0, 0, 0, false); root.add(r); parts.spin = r;
        root.add(sprite(look === "antigrav" ? "#5CF2FF" : "#FFE14D", w * 2.4, 0, 0.35));
        break;
      }
      case "portal": {
        const inn = look !== "out", col = inn ? "#5CF2FF" : "#FF9A3A";
        const g = new THREE.Group(); g.position.y = 1.9;
        g.add(mesh(TORUS, inn ? "neon2" : "orange", 1.9, 1.9, 2.4, 0, 0, 0, false));
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), this.mats[inn ? "cyanGlow" : "orangeGlow"]); g.add(disc); parts.spin = disc;
        g.add(sprite(col, 6, 0, 0.5)); root.add(g);
        root.add(mesh(CYL, "dark", 0.3, 0.3, 0.3, 0, 0.05));
        break;
      }
      case "switch": {
        root.add(mesh(CYL, "dark", w, 0.16, w, 0, 0.02)); const btn = mesh(CYL, "off", w * 0.78, 0.22, w * 0.78, 0, 0.14); root.add(btn); parts.btn = btn;
        const sign = mesh(BOX, "yellow", 0.1, 1.6, 0.1, w + 0.4, 0.8); root.add(sign); root.add(mesh(BOX, "yellow", 0.9, 0.5, 0.08, w + 0.4, 1.6));
        break;
      }
      case "core": {
        root.add(mesh(CYL, "dark", w, 0.12, w, 0, 0.02, 0, false)); const c = mesh(CYL, "core", w * 0.75, 0.25, w * 0.75, 0, 0.14, 0, false); root.add(c); parts.btn = c;
        const beam = mesh(CYL, "beam", 0.35, 7, 0.35, 0, 3.5, 0, false); root.add(beam); parts.beam = beam;
        root.add(sprite("#FF2E5A", 4, 0.4, 0.6));
        break;
      }
      case "bumper": {
        if (look === "boulder" || look === "rocks" || look === "debris") { const b = mesh(ICO, "rock", w, w, w, 0, w, 0); root.add(b); parts.roll = b; break; }
        if (look === "top") { const t = new THREE.Group(); t.add(mesh(CONE, "accent", w, (o.tall ?? 2) * 0.8, w, 0, (o.tall ?? 2) * 0.55).rotateX(Math.PI)); t.add(mesh(CYL, "white", w * 1.02, 0.2, w * 1.02, 0, (o.tall ?? 2) * 0.9)); t.add(mesh(CYL, "dark", 0.15, 0.8, 0.15, 0, (o.tall ?? 2) + 0.3)); root.add(t); parts.spinY = t; break; }
        if (look === "jelly") { const j = mesh(SPH, "jelly", w, (o.tall ?? 2) * 0.6, w, 0, 0.4); root.add(j); parts.wob = j; root.add(sprite("#FF8AD8", w * 3, 1, 0.3)); break; }
        root.add(mesh(CYL, "pink", w, o.tall ?? 1.4, w, 0, (o.tall ?? 1.4) / 2)); const ring = mesh(CYL, "white", w * 1.08, 0.18, w * 1.08, 0, (o.tall ?? 1.4) * 0.75); root.add(ring); parts.ring = ring;
        break;
      }
      case "block": {
        const b = new THREE.Group(), T = o.tall ?? 1.4;
        if (look === "cannonball" || look === "bossball" || look === "airship") { b.add(mesh(SPH, "black", w * 1.3, w * 1.3, w * 1.3, 0, w * 1.3)); b.add(sprite("#FF7A1A", 1.4, w * 2.4, 0.9)); }
        else if (look === "rocket") { const r = new THREE.Group(); r.rotation.z = Math.PI / 2; r.position.y = 0.6; r.add(mesh(CYL, "white", 0.4, 1.6, 0.4)); r.add(mesh(CONE, "red", 0.4, 0.7, 0.4, 0, 1.15)); b.add(r); b.add(sprite("#FF9A3A", 1.6, 0.6, 0.9)); }
        else if (look === "wall") { b.add(mesh(BOX, "neon", w * 2, T, ds * 2, 0, T / 2)); }
        else if (look === "door" || look === "timed" || look === "music") { b.add(mesh(BOX, look === "music" ? "accent" : "wood", w * 2, T, ds * 2, 0, T / 2)); b.add(mesh(BOX, "gold", w * 2.04, 0.18, ds * 2.1, 0, T * 0.15, 0, false)); b.add(mesh(BOX, "gold", w * 2.04, 0.18, ds * 2.1, 0, T * 0.85, 0, false)); }
        else if (look === "press" || look === "factory" || look === "clock") { b.add(mesh(BOX, "metal", w * 2, T, ds * 2, 0, T / 2)); b.add(mesh(BOX, "yellow", w * 2.02, 0.3, ds * 2.02, 0, 0.15, 0, false)); b.add(mesh(CYL, "dark", 0.35, 8, 0.35, 0, T + 4, 0, false)); }
        else if (look === "crab") { b.add(mesh(SPH, "red", w * 1.1, T * 0.5, ds * 1.6, 0, T * 0.5)); b.add(mesh(SPH, "white", 0.18, 0.18, 0.18, -0.3, T * 0.95, ds)); b.add(mesh(SPH, "white", 0.18, 0.18, 0.18, 0.3, T * 0.95, ds)); }
        else if (look === "plant") { b.add(mesh(SPH, "green", w * 1.1, T * 0.6, ds * 1.5, 0, T * 0.55)); b.add(mesh(BOX, "white", w * 1.6, 0.12, ds * 1.6, 0, T * 0.55, 0, false)); }
        else { b.add(mesh(BOX, look === "piston" ? "metal" : look === "clapper" ? "orange" : "accent", w * 2, T, ds * 2, 0, T / 2)); b.add(mesh(BOX, "white", w * 2.02, 0.16, ds * 2.02, 0, T * 0.72, 0, false)); }
        root.add(b); parts.body = b;
        break;
      }
      case "hammer": {
        // a gantry over the road with the hammer swinging under it
        const H = 5.2, half = 5;
        root.add(mesh(BOX, "dark", 0.3, H, 0.3, -half, H / 2)); root.add(mesh(BOX, "dark", 0.3, H, 0.3, half, H / 2)); root.add(mesh(BOX, "dark", half * 2 + 0.3, 0.35, 0.35, 0, H));
        const arm = new THREE.Group(); arm.position.y = H; root.add(arm);
        arm.add(mesh(BOX, "woodDk", 0.22, H - 1.1, 0.22, 0, -(H - 1.1) / 2));
        const head = mesh(CYL, "red", 0.85, 2.2, 0.85, 0, -(H - 0.6)); head.rotation.x = Math.PI / 2; arm.add(head);
        arm.add(mesh(CYL, "white", 0.88, 0.3, 0.88, 0, -(H - 0.6), 0.9).rotateX(Math.PI / 2));
        parts.arm = arm;
        break;
      }
      case "sweeper": {
        root.add(mesh(CYL, "dark", 0.55, 1.4, 0.55, 0, 0.7));
        const arm = new THREE.Group(); arm.position.y = 0.8; root.add(arm);
        const L = o.p ?? 3.6, m = look === "fire" ? "fire" : look === "flipper" || look === "pinball" ? "white" : look === "boot" ? "woodDk" : look === "paddle" ? "blue" : "red";
        if (look === "flipper" || look === "pinball") { const f = mesh(CYL, m, 0.45, L * 2, 0.45, 0, 0, 0); f.rotation.x = Math.PI / 2; arm.add(f); arm.add(mesh(BOX, "accent", 0.5, 0.12, L * 2, 0, 0.3, 0, false)); }
        else arm.add(mesh(BOX, m, 0.5, 0.5, L * 2, 0, 0, 0, look !== "fire"));
        if (look === "fire") for (let k = -2; k <= 2; k++) arm.add(sprite("#FF7A1A", 1.8, 0.2, 0.7).translateZ((k * L) / 2.5));
        else { arm.add(mesh(SPH, "white", 0.32, 0.32, 0.32, 0, 0, L)); arm.add(mesh(SPH, "white", 0.32, 0.32, 0.32, 0, 0, -L)); }
        if (look === "boot") { arm.add(mesh(BOX, "red", 0.9, 0.7, 1.4, 0, 0, L)); }
        parts.arm = arm;
        break;
      }
      case "laser": {
        const span = w, m = look === "prism" ? ((o.p ?? 1) === 1 ? "prism1" : "prism2") : "laser";
        root.add(mesh(BOX, "dark", 0.35, 2.2, 0.35, -span, 1.1)); root.add(mesh(BOX, "dark", 0.35, 2.2, 0.35, span, 1.1));
        const beam = new THREE.Group();
        if (look === "prism") beam.add(mesh(BOX, m, span * 2, 2, 0.06, 0, 1.05, 0, false));
        else for (const y of [0.4, 0.9, 1.4]) beam.add(mesh(BOX, m, span * 2, 0.07, 0.07, 0, y, 0, false));
        root.add(beam); parts.beam = beam;
        break;
      }
      case "spikes": {
        if (look === "bolt") {
          const warn = mesh(CYL, "warn", w, 0.04, ds, 0, 0.05, 0, false); root.add(warn); parts.warn = warn;
          const col = new THREE.Group(); col.add(mesh(CYL, "bolt", 0.35, 14, 0.35, 0, 7, 0, false)); col.add(sprite("#E8F4FF", 5, 0.6, 0.9)); root.add(col); parts.bolt = col;
          break;
        }
        root.add(mesh(BOX, "dark", w * 2, 0.08, ds * 2, 0, 0.02, 0, false));
        const g = new THREE.Group();
        for (let x = -w + 0.35; x <= w - 0.3; x += 0.6) for (let z = -ds + 0.3; z <= ds - 0.3; z += 0.6) g.add(mesh(CONE, "spike", 0.2, 0.8, 0.2, x, 0.4, z));
        root.add(g); parts.spikes = g;
        break;
      }
      case "zone": {
        if (look === "none" || o.zone === "weather" || o.zone === "view" || o.zone === "magnet") return null;
        const key = look && this.mats["z_" + look] ? look : o.zone === "slow" ? "trap" : o.zone === "limit" ? "town" : o.zone === "pull" ? "swirl" : o.zone === "rumble" ? "rumble" : o.zone ?? "ice";
        if (!o.mov && ds > 6) {
          const v = this.ribbon(o, "z_" + key, o.zone === "lowg" ? 0.5 : 0.03);
          if (o.zone === "vent" || o.zone === "lowg") { const sp = new THREE.Group(); for (let i = 0; i < 10; i++) { const s = sprite(o.zone === "vent" ? "#ffffff" : "#C9A8FF", 0.6, Math.random() * 6, 0.6); sp.add(s); } v.parts.puffs = sp; v.root.add(sp); }
          return v;
        }
        const z = mesh(PLANE, "z_" + key, w * 2, 1, ds * 2, 0, o.zone === "lowg" ? 0.5 : 0.025, 0, false);
        const map = (z.material as THREE.MeshBasicMaterial).map;
        if (map) map.repeat.set(Math.max(1, w / 2), Math.max(1, ds / 2));
        root.add(z); parts.zone = z;
        if (look === "hole") root.add(sprite("#7A3AFF", 5, 0.2, 0.5));
        if (look === "spores" || look === "hands") { for (let i = 0; i < 6; i++) root.add(sprite(look === "spores" ? "#B8FF7A" : "#A07AFF", 2.4, 0.6 + Math.random(), 0.45).translateX((Math.random() - 0.5) * w * 2).translateZ((Math.random() - 0.5) * ds * 2)); }
        break;
      }
      case "chaser": {
        const R = Math.min(5, (o.w ?? 4) * 0.85), b = new THREE.Group();
        if (look === "train") { b.add(mesh(BOX, "accent", R * 1.6, R * 1.3, 6, 0, R * 0.7, 0)); b.add(mesh(CYL, "dark", R * 0.6, 1.2, R * 0.6, 0, R * 1.5, 1.5)); const f = mesh(QUAD, "face", R * 1.3, R * 1.1, 1, 0, R * 0.75, 3.02, false); b.add(f); for (const x of [-R * 0.7, R * 0.7]) for (const z of [-2, 0, 2]) b.add(mesh(CYL, "black", 0.6, 0.3, 0.6, x, 0.5, z).rotateZ(Math.PI / 2)); }
        else if (look === "worm") { for (let k = 0; k < 6; k++) b.add(mesh(SPH, k % 2 ? "orange" : "yellow", R * (1 - k * 0.08), R * (1 - k * 0.08), R * 0.8, 0, R * (0.9 + Math.sin(k) * 0.2), -k * R * 0.9)); b.add(mesh(SPH, "white", R * 0.25, R * 0.25, R * 0.25, -R * 0.4, R * 1.3, R * 0.7)); b.add(mesh(SPH, "white", R * 0.25, R * 0.25, R * 0.25, R * 0.4, R * 1.3, R * 0.7)); }
        else if (look === "dominoes") { for (let k = 0; k < 5; k++) { const d = mesh(BOX, k % 2 ? "white" : "black", R * 2, R * 1.6, 0.5, 0, R * 0.8, -k * 1.4); d.rotation.x = -0.3 - k * 0.25; b.add(d); } }
        else if (look === "tornado" || look === "storm") { for (let k = 0; k < 7; k++) b.add(mesh(TORUS, "cyanGlow", R * (0.35 + k * 0.16), R * (0.35 + k * 0.16), 1.5, 0, 0.6 + k * 1.2, 0, false).rotateX(Math.PI / 2)); b.add(sprite("#C8E8FF", R * 4, R, 0.35)); }
        else if (look === "comet" || look === "meteor") { b.add(mesh(ICO, "orange", R * 0.8, R * 0.8, R * 0.8, 0, R, 0)); b.add(sprite("#FFB45A", R * 5, R, 0.8)); for (let k = 1; k < 5; k++) b.add(sprite("#FF7A1A", R * (3 - k * 0.5), R, 0.5).translateZ(-k * R)); }
        else if (look === "candy") { for (let k = 0; k < 9; k++) b.add(mesh(SPH, ["pink", "yellow", "blue", "white", "green"][k % 5], R * 0.45, R * 0.45, R * 0.45, Math.sin(k * 2.3) * R * 0.8, R * 0.5 + (k % 3) * R * 0.4, -Math.cos(k * 1.7) * R * 0.4)); }
        else { b.add(mesh(ICO, "rock", R, R, R, 0, R, 0)); parts.roll = b.children[0]; for (let k = 0; k < 4; k++) b.add(sprite("#C8B8A0", R * 1.4, R * 0.3, 0.35).translateX((k - 1.5) * R * 0.7).translateZ(-R)); }
        root.add(b); parts.body = b;
        break;
      }
      case "gem": { const g = mesh(OCTA, "gem", 0.42, 0.62, 0.42, 0, 0, 0, false); root.add(g); parts.spin = g; break; }
      case "orb": { const g = mesh(SPH, "orb", 0.42, 0.42, 0.42, 0, 0, 0, false); root.add(g); root.add(sprite("#7CF2FF", 2.2, 0, 1)); parts.spin = g; break; }
      case "capsule": { const g = mesh(CAPS, "caps", 1, 1, 1, 0, 0, 0, false); g.rotation.z = Math.PI / 2; const w2 = new THREE.Group(); w2.add(g); root.add(w2); root.add(sprite("#FF7CF0", 2.4, 0, 0.7)); parts.spin = w2; break; }
      case "star": { const g = mesh(STAR, "star", 1.3, 1.3, 1.3, 0, 0, 0, false); root.add(g); root.add(sprite("#FFE14D", 3, 0, 0.8)); parts.spin = g; break; }
      case "heart": { const g = mesh(HEART, "heart", 1.1, 1.1, 1.1, 0, 0, 0, false); root.add(g); root.add(sprite("#FF5A7A", 2.6, 0, 0.7)); parts.spin = g; break; }
      case "mine": {
        // a don't-touch orb: a dark core bristling with red spikes, a warning glow round it
        const g = new THREE.Group(), R = w;
        g.add(mesh(ICO, "black", R * 0.75, R * 0.75, R * 0.75, 0, 0, 0, false));
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, b2 = k % 2 ? 0.6 : -0.6, c = mesh(CONE, "mineSpike", R * 0.22, R * 0.75, R * 0.22, Math.cos(a) * Math.cos(b2) * R * 0.85, Math.sin(b2) * R * 0.85, Math.sin(a) * Math.cos(b2) * R * 0.85, false); c.lookAt(Math.cos(a) * 9, Math.sin(b2) * 9, Math.sin(a) * 9); c.rotateX(Math.PI / 2); g.add(c); }
        root.add(g); root.add(sprite("#FF2E3A", R * 4.2, 0, 0.55)); parts.spin = g;
        const ring = mesh(CYL, "warn", R * 1.5, 0.03, R * 1.5, 0, -(o.h ?? 0.6) + 0.04, 0, false); root.add(ring);
        break;
      }
      case "rocket": {
        // a speed booster: a glowing flame-ringed orb with a chevron, spinning
        const g = new THREE.Group(), R = w;
        g.add(mesh(SPH, "rocketCore", R * 0.6, R * 0.6, R * 0.6, 0, 0, 0, false));
        const r1 = mesh(TORUS, "orangeGlow", R * 0.95, R * 0.95, R, 0, 0, 0, false); g.add(r1);
        const r2 = mesh(TORUS, "fire", R * 1.1, R * 1.1, R, 0, 0, 0, false); r2.rotation.y = Math.PI / 2; g.add(r2);
        const chev = new THREE.Mesh(QUAD, this.mats.boost); chev.scale.set(R * 1.4, R * 1.4, 1); chev.rotation.x = -Math.PI / 2; chev.position.y = -(o.h ?? 0.9) + 0.06; root.add(chev);
        root.add(g); root.add(sprite("#FFB43A", R * 5, 0, 0.85)); parts.spin = g;
        break;
      }
      case "letter": { const g = new THREE.Mesh(QUAD, this.mats["l_" + LETTERS[(o.p ?? 0) % 4]]); g.scale.setScalar(1.5); root.add(g); root.add(sprite("#FFD23A", 2.6, 0, 0.55)); parts.spin = g; break; }
      case "gold": { const g = new THREE.Group(); g.add(mesh(COIN, "gold", 2.2, 2.2, 2.2, 0, 0, 0, false)); root.add(g); root.add(sprite("#FFD23A", 3.4, 0, 0.8)); parts.spin = g; break; }
      case "chest": { const g = new THREE.Group(); g.add(mesh(BOX, "wood", 1.3, 0.8, 0.9, 0, 0.4)); g.add(mesh(BOX, "gold", 1.34, 0.14, 0.94, 0, 0.62, 0, false)); const lid = mesh(CYL, "wood", 0.45, 1.3, 0.45, 0, 0.82); lid.rotation.z = Math.PI / 2; g.add(lid); root.add(g); root.add(sprite("#FFD23A", 2.6, 0.6, 0.5)); parts.spinY = g; break; }
      case "check": case "finish": case "deco": {
        if (look === "lantern") { root.add(mesh(CYL, "dark", 0.08, 3, 0.08, 0, 1.5)); const l = mesh(SPH, "orangeGlow", 0.35, 0.45, 0.35, 0, 3.1, 0, false); root.add(l); root.add(sprite("#FFB45A", 3.2, 3.1, 0.9)); parts.flick = l; break; }
        if (look === "boss") { this.machine(root, parts, o); break; }
        const W = (o.w ?? 5) + 0.6, H = o.k === "finish" ? 7 : 5.2;
        const post = o.k === "finish" ? "white" : "accent";
        root.add(mesh(CYL, post, 0.3, H, 0.3, -W, H / 2)); root.add(mesh(CYL, post, 0.3, H, 0.3, W, H / 2));
        const ban = mesh(BOX, o.k === "check" ? "banner" : "check", W * 2 + 0.6, o.k === "finish" ? 1.4 : 0.9, 0.3, 0, H);
        root.add(ban);
        if (o.k === "finish") {
          const line = mesh(PLANE, "check", W * 2, 1, 3, 0, 0.03, 0, false); const m = (line.material as THREE.MeshStandardMaterial).map; if (m) m.repeat.set(W, 1.5); root.add(line);
          const cup = new THREE.Group(); cup.position.y = H + 1.6;
          cup.add(mesh(CYL, "gold", 0.7, 1.1, 0.7, 0, 0.3)); cup.add(mesh(SPH, "gold", 0.75, 0.6, 0.75, 0, 0.9)); cup.add(mesh(CYL, "gold", 0.25, 0.6, 0.25, 0, -0.4)); cup.add(mesh(BOX, "gold", 0.9, 0.2, 0.9, 0, -0.75));
          root.add(cup); parts.spin = cup;
        }
        if (look === "startgate") { for (let i = 0; i < 5; i++) { const l = mesh(SPH, "red", 0.22, 0.22, 0.22, -0.9 + i * 0.45, H - 0.55, -0.2, false); root.add(l); parts["l" + i] = l; } }
        break;
      }
      default: return null;
    }
    return { o, root, parts };
  }

  /** Kranky's machine: a walking arch over the road (legs either side), a body with his face, arms that thump */
  private machine(root: THREE.Group, parts: Record<string, THREE.Object3D>, o: Obj) {
    const W = (o.w ?? 5) + 1.4, kind = (o.p ?? 0) % 5, H = 7.5;
    const m = (g: THREE.BufferGeometry, mat: string, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(g, this.mats[mat]); me.scale.set(sx, sy, sz); me.position.set(x, y, z); me.castShadow = true; return me; };
    for (const x of [-W, W]) { root.add(m(BOX, "bossBody", 1.2, H, 1.6, x, H / 2)); root.add(m(BOX, "dark", 1.8, 0.8, 2.4, x, 0.4)); }
    const body = new THREE.Group(); body.position.y = H + 2.2; root.add(body); parts.body = body;
    if (kind === 0) { body.add(m(CYL, "bossBody", 3, 4, 3)); const blades = new THREE.Group(); blades.position.z = 1.8; for (let k = 0; k < 4; k++) blades.add(m(BOX, "white", 0.8, 7, 0.2, 0, 3.5).rotateZ((k * Math.PI) / 2)); body.add(blades); parts.blades = blades; }
    else if (kind === 1) { body.add(m(BOX, "bossBody", W * 1.6, 3.2, 3)); body.add(m(BOX, "metal", W * 1.7, 0.6, 3.2, 0, -1.9)); for (let k = -3; k <= 3; k++) body.add(m(CONE, "metal", 0.3, 0.8, 0.3, k * 0.9, -2.5).rotateX(Math.PI)); }
    else if (kind === 2) { body.add(m(BOX, "bossBody", 4.4, 3.8, 3.4)); body.add(m(BOX, "dark", 1.4, 1, 1.4, 0, 2.4)); body.add(m(SPH, "red", 0.4, 0.4, 0.4, 0, 3.2)); for (const x of [-3, 3]) { const arm = m(BOX, "bossBody", 1, 4, 1, x, -1.6); body.add(arm); parts["arm" + (x > 0 ? 1 : 0)] = arm; } }
    else if (kind === 3) { body.add(m(SPH, "bossBody", 3, 2.6, 3.6)); body.add(m(CONE, "gold", 0.5, 1.6, 0.5, -1.4, 2.4)); body.add(m(CONE, "gold", 0.5, 1.6, 0.5, 1.4, 2.4)); body.add(m(BOX, "fire", 2.4, 0.5, 1.2, 0, -1.2, 3.2)); }
    else { body.add(m(SPH, "bossBody", 3.4, 3.4, 3.4)); const ring = m(TORUS, "gold", 4.6, 4.6, 3, 0, 0, 0); ring.rotation.x = 1.2; body.add(ring); parts.blades = ring; }
    const face = new THREE.Mesh(QUAD, this.mats.face); face.scale.set(2.8, 2.8, 1); face.position.set(0, 0.2, kind === 4 ? 3.45 : kind === 3 ? 3.65 : 1.75); body.add(face);
    // Kranky's top hat on top
    body.add(m(CYL, "black", 0.9, 1.4, 0.9, 0, 3.4)); body.add(m(CYL, "black", 1.4, 0.15, 1.4, 0, 2.7)); body.add(m(CYL, "red", 0.92, 0.25, 0.92, 0, 2.95));
    const smoke = new THREE.Group(); for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("#4A4A4A"), transparent: true, depthWrite: false, opacity: 0.6 })); s.scale.setScalar(2.4); s.position.set((Math.random() - 0.5) * 3, Math.random() * 3, 0); smoke.add(s); }
    smoke.visible = false; body.add(smoke); parts.smoke = smoke;
  }

  /** a view leaving sight: free what it owns */
  drop(v: View) { v.root.removeFromParent(); for (const g of v.geos ?? []) g.dispose(); }

  // ---------------------------------------------------------------- place + animate
  place(v: View, sim: Sim, t: number) {
    const o = v.o, p = v.parts, me = sim.marbles[0];
    if (v.world) {
      const mz = (p.zone as THREE.Mesh).material as THREE.MeshBasicMaterial;
      if (mz.map && (o.zone === "conveyor" || o.zone === "speed")) mz.map.offset.y = -t * ((o.p ?? 6) / 6) * (o.zone === "speed" ? 2 : 1);
      if (mz.map && (o.zone === "wind" || o.zone === "pull")) mz.map.offset.x = t * 0.3 * Math.sign(o.p ?? 1);
      if (p.puffs) { const F = this.tr.frame(o.s, this.F); p.puffs.position.set(F[0], F[1], F[2]); for (const c of p.puffs.children) { c.position.y += 0.06; if (c.position.y > 7) c.position.y = 0; } }
      return;
    }
    // a hammer's gantry stands still; only its arm swings (to where the physics has the head)
    const s = sim.os(o), u = o.k === "hammer" ? o.u : sim.ou(o);
    let h = sim.oh(o);
    if (o.k === "tile") { h -= sim.dropOf(o) * (o.look === "pontoon" ? 0.25 : 1); const sh = sim.shake(o); p.body.position.x = sh > 0 && sh < 1 ? Math.sin(t * 60) * 0.06 * sh : 0; v.root.visible = h > -30; }
    if (["coin", "gem", "orb", "capsule", "star", "heart", "letter", "gold"].includes(o.k)) h += Math.sin(t * 3 + o.s) * 0.12;
    const P = this.tr.point(s, u, h, _P);
    const F = this.tr.frame(s, this.F);
    this.m4.makeBasis(_r.set(F[9], F[10], F[11]), _u.set(F[6], F[7], F[8]), _f.set(F[3], F[4], F[5])); this.m4.setPosition(P[0], P[1], P[2]);
    v.root.matrixAutoUpdate = false; v.root.matrix.copy(this.m4); v.root.matrixWorldNeedsUpdate = true;
    switch (o.k) {
      case "plat": {
        if (o.mov?.ax === "swing") { const a = sim.swingA(o); for (const k of ["rope0", "rope1"]) { const r = p[k]; if (r) { r.position.x = -4 * Math.sin(a); r.position.y = 4 * Math.cos(a); r.rotation.z = a; } } }
        if (BEAT.has(o.look ?? "") && p.top) { const on = sim.on(o), soon = sim.on(o, sim.t + 0.45); v.root.visible = on; (p.top as THREE.Mesh).material = this.mats[on && !soon ? "beatWarn" : "beatOn"]; }
        if (o.gate !== undefined && p.body) { const op = sim.open(o.gate); p.body.scale.z += ((op ? 1 : 0.02) - p.body.scale.z) * 0.15; p.body.visible = p.body.scale.z > 0.03; }
        if (o.look === "blind" && p.body) p.body.visible = me.air || Math.abs(me.s - o.s) < 9;
        break;
      }
      case "disc": p.body.rotation.y = (o.p ?? 0) * sim.t; break;
      case "seesaw": case "tilt": p.body.rotation.z = -sim.lean(o); break;
      case "log": p.body.rotation.y += ((o.p ?? 3) > 0 ? -1 : 1) * 0.04; break;
      case "pad": { const m = (p.arrow as THREE.Mesh).material as THREE.MeshBasicMaterial; m.opacity = 0.65 + Math.sin(t * 8) * 0.35; break; }
      case "boost": { const m = (p.arrow as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m.map) m.map.offset.y = -t * 1.5; break; }
      case "ring": p.spin.rotation.z = t * 1.2; break;
      case "portal": p.spin.rotation.z = -t * 3; break;
      case "switch": (p.btn as THREE.Mesh).material = this.mats[sim.open(o.gate ?? 0) ? "on" : "off"]; break;
      case "core": { const done = sim.taken.has(o.id); (p.btn as THREE.Mesh).material = this.mats[done ? "coreDone" : "core"]; p.beam.visible = !done; break; }
      case "bumper": {
        if (p.ring) p.ring.scale.x = p.ring.scale.z = (o.w ?? 0.8) * (1.08 + Math.sin(t * 6) * 0.04);
        if (p.roll) p.roll.rotation.x = s / (o.w ?? 1);
        if (p.spinY) p.spinY.rotation.y = t * 9;
        if (p.wob) { const k = 1 + Math.sin(t * 5 + o.s) * 0.08; p.wob.scale.set((o.w ?? 1) * k, (o.tall ?? 2) * 0.6 / k, (o.w ?? 1) * k); }
        break;
      }
      case "hammer": p.arm.rotation.z = Math.asin(Math.max(-0.95, Math.min(0.95, (sim.ou(o) - o.u) / 4.6))); break;
      case "sweeper": p.arm.rotation.y = -sim.spin(o); break;
      case "laser": p.beam.visible = sim.on(o); break;
      case "spikes": {
        const on = sim.on(o);
        if (p.bolt) { p.bolt.visible = on && Math.floor(t * 20) % 3 !== 0; p.warn.visible = !on && sim.on(o, sim.t + 0.6); break; }
        p.spikes.position.y += ((on ? 0 : -0.85) - p.spikes.position.y) * 0.35; break;
      }
      case "zone": { if (o.zone === "conveyor" || o.zone === "speed") { const m = (p.zone as THREE.Mesh).material as THREE.MeshBasicMaterial; if (m.map) m.map.offset.y = -t * ((o.p ?? 6) / 6) * (o.zone === "speed" ? 2 : 1); } break; }
      case "chaser": { const go = sim.chasing(o); v.root.visible = go; if (go && p.roll) p.roll.rotation.x = s / 3; if (go && p.body && (o.look === "tornado" || o.look === "storm")) p.body.rotation.y = t * 4; break; }
      case "gem": case "orb": case "capsule": case "star": case "heart": case "letter": case "gold": p.spin.rotation.y = t * 2.4; v.root.visible = !sim.taken.has(o.id); break;
      case "chest": p.spinY.rotation.y = Math.sin(t * 1.5) * 0.4; v.root.visible = !sim.taken.has(o.id); break;
      case "mine": p.spin.rotation.y = t * 1.6; p.spin.scale.setScalar(1 + Math.sin(t * 7 + o.s) * 0.06); break;
      case "rocket": p.spin.rotation.y = t * 4; p.spin.rotation.z = Math.sin(t * 2) * 0.3; break;
      case "finish": if (p.spin) p.spin.rotation.y = t; break;
      case "deco": {
        if (o.look === "lantern") { if (p.flick) p.flick.scale.setScalar(0.35 + Math.sin(t * 13 + o.s) * 0.03); break; }
        if (o.look === "boss") {
          const core = sim.obj(o.id + 1), hit = !!core && sim.taken.has(core.id);
          if (p.blades) p.blades.rotation.z = t * (hit ? 0.4 : 2.2);
          if (p.arm0) { p.arm0.rotation.x = Math.sin(t * 3) * 0.6; p.arm1.rotation.x = -Math.sin(t * 3) * 0.6; }
          p.body.position.x = hit ? Math.sin(t * 40) * 0.08 : Math.sin(t * 0.9) * 0.4;
          p.body.rotation.z = hit ? 0.18 : 0;
          if (p.smoke) { p.smoke.visible = hit; for (const c of p.smoke.children) { c.position.y += 0.05; if (c.position.y > 5) c.position.y = 0; } }
          break;
        }
        for (let i = 0; i < 5; i++) { const l = p["l" + i]; if (l) ((l as THREE.Mesh).material as THREE.MeshStandardMaterial) = this.mats[sim.t > 3 - i * 0.6 ? "yellow" : "red"] as THREE.MeshStandardMaterial; }
        break;
      }
    }
  }

  /** all the coins near the camera, as one instanced mesh */
  coinsFrame(objs: Obj[], sim: Sim, s0: number, s1: number, t: number) {
    let n = 0, lo = 0, hi = objs.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (objs[mid].s < s0) lo = mid + 1; else hi = mid; }
    for (let i = lo; i < objs.length; i++) {
      const o = objs[i];
      if (o.s > s1) break;
      if (o.k !== "coin" || sim.taken.has(o.id)) continue;
      if (n >= 700) break;
      const P = this.tr.point(o.s, o.u, (o.h ?? 0.6) + Math.sin(t * 3 + o.s) * 0.1, _P);
      const F = this.tr.frame(o.s, this.F);
      this.m4.makeBasis(_r.set(F[9], F[10], F[11]), _u.set(F[6], F[7], F[8]), _f.set(F[3], F[4], F[5]));
      this.tmp.matrix.copy(this.m4).multiply(_rot.makeRotationY(t * 3 + o.s * 0.3));
      this.tmp.matrix.setPosition(P[0], P[1], P[2]);
      this.coins.setMatrixAt(n++, this.tmp.matrix);
    }
    this.coins.count = n; this.coins.instanceMatrix.needsUpdate = true;
  }
  dispose() { for (const m of Object.values(this.mats)) m.dispose(); this.coins.dispose(); void this.world; }
}
