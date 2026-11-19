// Rollo the pangolin, an athletic speed hero built from smooth vinyl-toy shapes: long sprinter legs, a slim torso with a
// plated back, a big head with a swept-back crest of golden armour plates, sport gloves, chunky mint high-tops with
// glowing soles, a plated tail, and a coral scarf that streams behind him. He sprints like a runner — knees driving,
// arms pumping, leaning harder the faster he goes — sweeps his arms back at Turbo, and tucks into the Curl Ball (his
// armour wrapped round a glowing core). Every moving part is one mesh with its colours baked into the vertices, so the
// whole hero is about twenty draw calls on a phone.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const GOLD = "#E8A23A", GOLD_DK = "#B8711F", PEACH = "#FFCFA3", MINT = "#3FE0BE", MINT_DK = "#1FA894", WHITE = "#FFFBF2", CORAL = "#FF5A7A";
const INK = "#21182A", ROSE = "#6A2E3E", AMBER = "#F2A12E", INDIGO = "#2E3A8C";

function scarfTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, "#FF6A88"); grd.addColorStop(1, "#E23A62");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
  g.fillStyle = "#FFE08A";
  for (let i = 0; i < 6; i++) { const y = 22 + i * 40, x = 18 + (i % 2) * 28; star(g, x, y, 7); }
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, 0, 6, 256); g.fillRect(58, 0, 6, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

/** overlapping scale rows (upper rows over lower ones, tips pointing down); `seams` = the glow map */
function armourTexture(seams: boolean, tint?: { gold: string; goldDk: string }) {
  // the plates in another colour (Rollo’s Locker): light, mid and dark of the chosen armour
  const shade = (c: string, to: string, k: number) => "#" + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
  const P = tint ? { bg: shade(tint.goldDk, "#000000", 0.45), a: shade(tint.gold, "#FFFFFF", 0.6), b: tint.gold, c: tint.goldDk, line: shade(tint.goldDk, "#000000", 0.25) } : { bg: "#7A4A14", a: "#FFF0B8", b: "#FFC24A", c: "#D9892A", line: "#9A5A1A" };
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = seams ? "#000000" : P.bg; g.fillRect(0, 0, 512, 512);
  const cols = 9, rows = 7, w = 512 / cols, h = 512 / rows;
  for (let r = rows; r >= -1; r--) {
    for (let k = -1; k <= cols; k++) {
      const x = k * w + (r % 2 ? w / 2 : 0), y = r * h;
      g.beginPath();
      g.moveTo(x - w * 0.52, y);
      g.quadraticCurveTo(x - w * 0.55, y + h * 1.05, x, y + h * 1.35);
      g.quadraticCurveTo(x + w * 0.55, y + h * 1.05, x + w * 0.52, y);
      g.closePath();
      if (seams) { g.fillStyle = "#000000"; g.fill(); g.strokeStyle = "#FFFFFF"; g.lineWidth = 4; g.stroke(); }
      else {
        const grd = g.createLinearGradient(x, y, x, y + h * 1.35);
        grd.addColorStop(0, P.a); grd.addColorStop(0.5, P.b); grd.addColorStop(1, P.c);
        g.fillStyle = grd; g.fill(); g.strokeStyle = P.line; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(x - w * 0.12, y + h * 0.35, w * 0.12, h * 0.22, -0.3, 0, 7); g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c); if (!seams) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** a smooth limb: a capsule that tapers from r0 at the joint (y = 0) to r1 at y = −len */
function taper(r0: number, r1: number, len: number, seg = 14) {
  const pts: THREE.Vector2[] = [], n = 5;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, -len + Math.sin(a) * r1)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r0 + 1e-4, Math.sin(a) * r0)); }
  return new THREE.LatheGeometry(pts, seg);
}
/** a rounded armour plate: a shallow dome, long along z */
function plateGeo() {
  const g = new THREE.SphereGeometry(1, 9, 3, 0, Math.PI * 2, 0, Math.PI * 0.42);
  return g;
}

type Kind = "skin" | "shell" | "glow";

/** colours and size (Rollo's own, or Chintu's) */
export interface RolloLook { gold: string; goldDk: string; peach: string; mint: string; mintDk: string; coral: string; indigo: string; amber: string; size: number; ball?: string }
export const ROLLO: RolloLook = { gold: GOLD, goldDk: GOLD_DK, peach: PEACH, mint: MINT, mintDk: MINT_DK, coral: CORAL, indigo: INDIGO, amber: AMBER, size: 1 };
/** Chintu: smaller, lighter gold, sky-blue gloves and shoes, a sunny scarf, orange shorts */
export const CHINTU: Partial<RolloLook> = { gold: "#F2C46A", goldDk: "#C08A3A", mint: "#6FC2FF", mintDk: "#3A8AD8", coral: "#FFD15A", indigo: "#FF7A4A", size: 0.66 };

export interface RolloPose {
  v: number; vu: number; air: boolean; vh: number; ball: boolean; hit: boolean; blink: boolean; run: number; dt: number; idle?: boolean;
  /** Turbo or Moon Rush: arms swept back, low and fast */
  fast?: boolean;
  /** the cinematic: reaching out with both arms (0..1), or tossing a ball (0..1 through the throw) */
  reach?: number; toss?: number;
}

interface Limb { hip: THREE.Group; knee: THREE.Group }
interface Arm { shoulder: THREE.Group; elbow: THREE.Group }

export class Rollo {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly ball = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private legs: Limb[] = [];
  private arms: Arm[] = [];
  private lids: THREE.Group[] = [];
  private tail: THREE.Group[] = [];
  private scarf!: THREE.Mesh; private scarfBase!: Float32Array;
  private phase = 0; private blinkT = 2; private ballK = 0; private squash = 0; private wasAir = false; private dashK = 0; private t = 0;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private scratch: THREE.BufferGeometry[] = [];
  private kinds: Record<Kind, THREE.Material>;
  private flash: { m: THREE.MeshStandardMaterial; base: THREE.Color; k: number }[] = [];
  readonly soles: THREE.Object3D[] = [];

  constructor(look: Partial<RolloLook> = {}) {
    const K: RolloLook = { ...ROLLO, ...look };
    const shellMat = this.m(new THREE.MeshPhysicalMaterial({ map: armourTexture(false, K.gold !== GOLD ? K : undefined), emissiveMap: armourTexture(true), emissive: K.mint, emissiveIntensity: 1.0, roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide }));
    const skin = this.m(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.3, sheenColor: new THREE.Color("#FFE6C0") }));
    const glow = this.m(new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.kinds = { skin, shell: shellMat, glow };
    this.flash = [{ m: skin, base: new THREE.Color("#000000"), k: 0 }, { m: shellMat, base: new THREE.Color(K.mint), k: 1 }];

    const P = (parent: THREE.Object3D, geo: THREE.BufferGeometry, kind: Kind, col: string, at: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0], sc: number | [number, number, number] = 1) => {
      const m = new THREE.Mesh(geo, this.kinds[kind]);
      m.userData.col = col; m.userData.kind = kind;
      m.position.set(...at); m.rotation.set(...rot);
      if (typeof sc === "number") m.scale.setScalar(sc); else m.scale.set(...sc);
      parent.add(m); return m;
    };
    const pivot = (parent: THREE.Object3D, at: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
      const g = new THREE.Group(); g.position.set(...at); g.rotation.set(...rot); g.userData.pivot = true; parent.add(g); return g;
    };
    const G = <T extends THREE.BufferGeometry>(x: T) => { this.scratch.push(x); return x; };
    const sph = G(new THREE.SphereGeometry(1, 22, 16)), mid = G(new THREE.SphereGeometry(1, 14, 10)), lowSph = G(new THREE.SphereGeometry(1, 9, 7));
    const plate = G(plateGeo());
    const torus = (r: number, t: number, arc = Math.PI * 2) => G(new THREE.TorusGeometry(r, t, 8, 24, arc));
    const cyl = (r0: number, r1: number, h: number, s = 16) => G(new THREE.CylinderGeometry(r0, r1, h, s));

    // ================================================================ body (hips) and legs: long, slim sprinter legs, big shoes
    this.body.userData.pivot = true;
    const HIP = 0.66;
    P(this.body, mid, "skin", K.indigo, [0, HIP + 0.01, 0.01], [0, 0, 0], [0.112, 0.085, 0.1]); // running shorts
    P(this.body, torus(0.098, 0.014), "skin", K.mint, [0, HIP + 0.06, 0.01], [Math.PI / 2, 0, 0], [1, 1.02, 1]);
    for (const sx of [-1, 1]) {
      const hip = pivot(this.body, [sx * 0.075, HIP - 0.02, 0.01]);
      P(hip, G(taper(0.052, 0.04, 0.24)), "skin", K.gold, [0, 0, 0]);
      P(hip, cyl(0.06, 0.07, 0.12), "skin", K.indigo, [0, -0.045, 0]);
      P(hip, cyl(0.062, 0.072, 0.12), "skin", K.mint, [sx * 0.006, -0.045, 0], [0, 0, 0], [1, 1, 0.22]);
      const knee = pivot(hip, [0, -0.255, 0]);
      P(knee, G(taper(0.041, 0.031, 0.2)), "skin", K.gold, [0, 0, 0]);
      // sock with a mint stripe
      P(knee, cyl(0.04, 0.037, 0.07), "skin", WHITE, [0, -0.2, 0]);
      P(knee, cyl(0.0415, 0.0415, 0.016), "skin", K.mint, [0, -0.19, 0]);
      // the high-top: a chunky rounded upper, toe cap, thick white sole, glowing strip, heel tab, laces, collar
      const sh = new THREE.Group(); sh.position.set(0, -0.29, -0.04); knee.add(sh);
      P(sh, G(new THREE.CapsuleGeometry(0.078, 0.19, 6, 14)), "skin", K.mint, [0, 0.025, -0.02], [Math.PI / 2, 0, 0], [1.12, 1, 0.92]);
      P(sh, mid, "skin", K.mint, [0, 0.005, -0.14], [0, 0, 0], [0.086, 0.07, 0.086]);
      P(sh, mid, "skin", WHITE, [0, 0.0, -0.18], [0, 0, 0], [0.07, 0.052, 0.05]); // toe cap
      P(sh, G(new THREE.CapsuleGeometry(0.094, 0.22, 4, 14)), "skin", WHITE, [0, -0.058, -0.03], [Math.PI / 2, 0, 0], [1.04, 1, 0.42]);
      P(sh, G(new THREE.CapsuleGeometry(0.096, 0.22, 4, 14)), "glow", K.mint, [0, -0.088, -0.03], [Math.PI / 2, 0, 0], [1.05, 1.01, 0.13]);
      P(sh, G(new THREE.BoxGeometry(0.06, 0.09, 0.035)), "skin", K.amber, [0, 0.065, 0.12]); // heel tab
      P(sh, mid, "skin", K.amber, [sx * 0.085, 0.02, -0.03], [0, 0, 0], [0.012, 0.035, 0.06]); // side flash
      for (let k = 0; k < 3; k++) P(sh, G(new THREE.BoxGeometry(0.11, 0.014, 0.024)), "skin", WHITE, [0, 0.075 - k * 0.013, -0.03 - k * 0.048], [-0.5, 0, 0]);
      P(sh, torus(0.058, 0.022), "skin", WHITE, [0, 0.095, 0.03], [Math.PI / 2, 0, 0]);
      const tip = new THREE.Object3D(); tip.position.set(0, -0.1, 0.07); sh.add(tip); this.soles.push(tip);
      this.legs.push({ hip, knee });
    }

    // ================================================================ torso, armour, arms
    this.torso.position.set(0, HIP, 0); this.torso.userData.pivot = true; this.body.add(this.torso);
    P(this.torso, G(taper(0.13, 0.088, 0.2)), "skin", K.gold, [0, 0.26, 0], [0, 0, 0], [1, 1, 0.84]);
    P(this.torso, sph, "skin", K.peach, [0, 0.19, -0.066], [0.12, 0, 0], [0.085, 0.15, 0.05]); // chest and belly
    // the plated back (the painted shell) and shoulder plates
    P(this.torso, G(new THREE.SphereGeometry(1, 28, 18, Math.PI * 0.06, Math.PI * 0.88, 0.12, Math.PI * 0.72)), "shell", K.gold, [0, 0.18, 0.012], [0, 0, 0], [0.142, 0.21, 0.125]);
    for (const sx of [-1, 1]) P(this.torso, plate, "shell", K.gold, [sx * 0.135, 0.29, 0.0], [0, 0, sx * -0.95], [0.07, 0.042, 0.085]);
    // neck, scarf ring and knot
    P(this.torso, G(taper(0.05, 0.05, 0.07)), "skin", K.gold, [0, 0.4, 0]);
    P(this.torso, torus(0.085, 0.035), "skin", K.coral, [0, 0.355, -0.005], [Math.PI / 2 + 0.12, 0, 0], [1, 1.05, 1]);
    P(this.torso, lowSph, "skin", K.coral, [0.04, 0.345, 0.095], [0, 0, 0], [0.045, 0.04, 0.035]);
    for (const sx of [-1, 1]) {
      const shoulder = pivot(this.torso, [sx * 0.155, 0.27, 0.0]);
      P(shoulder, lowSph, "skin", K.gold, [0, 0, 0], [0, 0, 0], 0.045);
      P(shoulder, G(taper(0.036, 0.03, 0.14)), "skin", K.gold, [0, 0, 0]);
      const elbow = pivot(shoulder, [0, -0.155, 0]);
      P(elbow, G(taper(0.03, 0.028, 0.11)), "skin", K.gold, [0, 0, 0]);
      // a big sport glove: mint fist, white cuff with a gold strap, a thumb
      P(elbow, cyl(0.046, 0.052, 0.055), "skin", WHITE, [0, -0.125, 0]);
      P(elbow, cyl(0.053, 0.053, 0.014), "skin", K.amber, [0, -0.135, 0]);
      P(elbow, mid, "skin", K.mint, [0, -0.2, -0.008], [0, 0, 0], [0.068, 0.072, 0.076]);
      P(elbow, lowSph, "skin", K.mintDk, [sx * -0.048, -0.18, -0.045], [0.4, 0, 0], [0.026, 0.034, 0.026]);
      P(elbow, mid, "skin", K.mintDk, [0, -0.165, -0.06], [0, 0, 0], [0.05, 0.016, 0.02]); // knuckle ridge
      this.arms.push({ shoulder, elbow });
    }

    // ================================================================ head: big, with a swept-back crest of plates
    this.head.position.set(0, 0.52, -0.015); this.head.userData.pivot = true; this.torso.add(this.head);
    P(this.head, sph, "skin", K.gold, [0, 0, 0], [0, 0, 0], [0.235, 0.225, 0.235]); // skull
    P(this.head, sph, "skin", K.peach, [0, -0.07, -0.11], [0, 0, 0], [0.165, 0.125, 0.14]); // face / muzzle
    // the snout: a long tapered pangolin snout, tipped with a small dark nose
    P(this.head, G(taper(0.075, 0.036, 0.15)), "skin", K.peach, [0, -0.06, -0.2], [-Math.PI / 2 + 0.12, 0, 0], [1.05, 1, 0.85]);
    P(this.head, lowSph, "skin", ROSE, [0, -0.08, -0.385], [0, 0, 0], [0.034, 0.027, 0.026]);
    P(this.head, lowSph, "glow", "#FFFFFF", [-0.01, -0.07, -0.407], [0, 0, 0], 0.007);
    // a cocky half-grin
    P(this.head, torus(0.04, 0.008, Math.PI * 0.7), "skin", INK, [0.025, -0.118, -0.238], [0.15, 0.3, Math.PI + 0.3]);
    for (const sx of [-1, 1]) {
      // big separate eyes (sclera, amber iris, pupil, sparkle) and a lid that blinks
      const eye = new THREE.Group(); eye.position.set(sx * 0.088, 0.045, -0.175); eye.rotation.set(0, sx * 0.3, 0); eye.scale.set(0.8, 1.3, 0.78); this.head.add(eye);
      P(eye, mid, "skin", WHITE, [0, 0, 0], [0, 0, 0], 0.078);
      P(eye, mid, "skin", K.amber, [sx * -0.012, -0.006, -0.062], [0, 0, 0], [0.047, 0.05, 0.026]);
      P(eye, lowSph, "skin", INK, [sx * -0.014, -0.006, -0.077], [0, 0, 0], [0.027, 0.033, 0.014]);
      P(eye, lowSph, "glow", "#FFFFFF", [sx * 0.006 - 0.012, 0.024, -0.085], [0, 0, 0], 0.012);
      const lid = pivot(eye, [0, 0, 0]);
      P(lid, G(new THREE.SphereGeometry(0.084, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), "skin", K.goldDk, [0, 0, 0]);
      this.lids.push(lid);
      // brows: angled down to the middle — focused
      P(this.head, G(new THREE.CapsuleGeometry(0.015, 0.06, 4, 8)), "skin", K.goldDk, [sx * 0.088, 0.152, -0.172], [0.62, sx * 0.25, sx * (Math.PI / 2 + 0.38)], [1, 1, 0.7]);
      // tiny ears, cheeks
      P(this.head, lowSph, "skin", K.goldDk, [sx * 0.2, 0.1, 0.05], [0, 0, sx * -0.4], [0.028, 0.045, 0.02]);
      P(this.head, lowSph, "skin", "#FFB0A0", [sx * 0.12, -0.09, -0.2], [0, 0, 0], [0.032, 0.02, 0.014]);
    }
    // the scale cap: overlapping armour tiles over the crown and the back of the head, rounded tips pointing back like
    // roof tiles, with a low rounded ridge down the middle (a pangolin's head, not spikes)
    const rows: [number, number][] = [[-0.5, 0], [-0.18, 2], [0.14, 3], [0.46, 4], [0.78, 4], [1.1, 4], [1.4, 3], [1.7, 2]]; // [angle back from the top, tiles each side]
    for (const [ra, n] of rows) {
      for (let j = -n; j <= n; j++) {
        const ridge = j === 0, stag = (Math.round(ra * 10) % 2 ? 0.14 : 0);
        const bAng = j * 0.29 + (j ? Math.sign(j) * stag : 0);
        const hold = new THREE.Group(); hold.rotation.set(ra, 0, bAng, "ZXY"); this.head.add(hold);
        const k = ridge ? 1.2 : 1 - Math.abs(j) * 0.06;
        P(hold, plate, "shell", K.gold, [0, 0.214 + (ridge ? 0.012 : 0), 0.008], [-(ridge ? 0.42 : 0.24), 0, 0], [0.078 * k, 0.034 * k, 0.088 * k]);
      }
    }

    // ================================================================ the plated tail (two pieces that sway)
    const t1 = pivot(this.body, [0, HIP - 0.04, 0.09], [-1.25, 0, 0]);
    P(t1, G(taper(0.088, 0.064, 0.22)), "shell", K.gold, [0, 0, 0], [0, 0, 0], [1.25, 1, 0.72]);
    const t2 = pivot(t1, [0, -0.23, 0], [-0.4, 0, 0]);
    P(t2, G(taper(0.064, 0.026, 0.22)), "shell", K.gold, [0, 0, 0], [0, 0, 0], [1.25, 1, 0.72]);
    P(t2, lowSph, "glow", K.mint, [0, -0.245, 0], [0, 0, 0], 0.03);
    this.tail.push(t1, t2);

    // ================================================================ the scarf: two ribbons streaming behind
    const r1 = new THREE.PlaneGeometry(0.075, 0.62, 1, 10).translate(-0.035, -0.31, 0);
    const r2 = new THREE.PlaneGeometry(0.065, 0.5, 1, 8).translate(0.05, -0.25, 0.01);
    const sgeo = this.g(mergeGeometries([r1, r2], false)!); r1.dispose(); r2.dispose();
    this.scarfBase = (sgeo.attributes.position.array as Float32Array).slice();
    this.scarf = new THREE.Mesh(sgeo, this.m(new THREE.MeshStandardMaterial({ map: scarfTexture(), side: THREE.DoubleSide, roughness: 0.75 })));
    this.scarf.position.set(0.04, 0.35, 0.11); this.scarf.rotation.x = -Math.PI / 2 + 0.3;
    this.torso.add(this.scarf);

    // ================================================================ the Curl Ball
    this.ball.add(new THREE.Mesh(this.g(new THREE.SphereGeometry(0.46, 28, 20)), glow.clone()));
    ((this.ball.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).vertexColors = false;
    ((this.ball.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(K.ball ?? K.mint);
    this.m((this.ball.children[0] as THREE.Mesh).material as THREE.Material);
    this.ball.add(new THREE.Mesh(this.g(new THREE.SphereGeometry(0.5, 36, 24)), shellMat));
    const eyes = new THREE.Group(); eyes.position.set(0, 0.12, -0.44); eyes.userData.pivot = true; this.ball.add(eyes);
    for (const sx of [-1, 1]) { P(eyes, mid, "skin", WHITE, [sx * 0.09, 0, 0], [0, 0, 0], 0.05); P(eyes, lowSph, "skin", INK, [sx * 0.09, 0, -0.035], [0, 0, 0], 0.025); }
    this.ball.position.y = 0.5; this.ball.visible = false; this.ball.scale.setScalar(0.01);

    // ---- bake every pivot: one mesh per material, colours in the vertices
    this.root.add(this.body, this.ball);
    this.root.updateMatrixWorld(true);
    const pivots: THREE.Object3D[] = [];
    this.root.traverse((o) => { if (o.userData.pivot) pivots.push(o); });
    for (const p of pivots) this.bake(p);
    for (const g of this.scratch) g.dispose();
    this.scratch = [];
    this.root.scale.setScalar(K.size);
  }
  private m<T extends THREE.Material>(x: T): T { this.mats.push(x); return x; }
  private g<T extends THREE.BufferGeometry>(x: T): T { this.geos.push(x); return x; }

  /** merge a pivot's own parts (not those of pivots inside it) into one mesh per material, colours baked in */
  private bake(pivot: THREE.Object3D) {
    const inv = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
    const by = new Map<Kind, THREE.BufferGeometry[]>();
    const drop: THREE.Mesh[] = [];
    const col = new THREE.Color();
    pivot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.col === undefined) return;
      for (let p: THREE.Object3D | null = m.parent; p && p !== pivot; p = p.parent) if (p.userData.pivot) return;
      const g = m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
      const n = g.attributes.position.count;
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      col.set(m.userData.col as string);
      const c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      g.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const kind = m.userData.kind as Kind;
      (by.get(kind) ?? by.set(kind, []).get(kind)!).push(g);
      drop.push(m);
    });
    for (const m of drop) m.removeFromParent();
    for (const [kind, raw] of by) {
      const list = raw.every((g) => g.index) ? raw : raw.map((g) => { if (!g.index) return g; const n = g.toNonIndexed(); g.dispose(); return n; });
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      this.g(merged);
      pivot.add(new THREE.Mesh(merged, this.kinds[kind]));
    }
  }

  /** animate one frame */
  update(p: RolloPose) {
    const dt = p.dt; this.t += dt;
    // tuck in / out
    this.ballK += ((p.ball ? 1 : 0) - this.ballK) * Math.min(1, dt * 16);
    const k = this.ballK;
    this.body.visible = k < 0.95; this.ball.visible = k > 0.05;
    this.body.scale.setScalar(1 - k * 0.6);
    this.ball.scale.setScalar(Math.max(0.01, k));
    this.ball.rotation.x -= (p.v * dt) / 0.5;
    // ---- the sprint
    const idle = !!p.idle, run = idle || p.air ? 0 : 1;
    const sp = Math.min(1, p.v / 20);
    this.dashK += ((p.fast && run ? 1 : 0) - this.dashK) * Math.min(1, dt * 6);
    const dk = this.dashK;
    this.phase += dt * (idle ? 1.4 : 2.2 + p.v * 0.17) * Math.PI;
    const A = 0.55 + 0.5 * sp; // stride
    for (let i = 0; i < 2; i++) {
      const ph = this.phase + i * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
      const L = this.legs[i], R = this.arms[i], side = i === 0 ? -1 : 1;
      if (run) {
        L.hip.rotation.x = A * s + 0.12;
        L.knee.rotation.x = -(0.22 + (0.9 + 0.7 * sp) * Math.max(0, c) ** 0.9);
        R.shoulder.rotation.x = -A * 0.9 * s * (1 - dk) - 0.9 * dk;
        R.shoulder.rotation.z = side * (0.1 + 0.32 * dk);
        R.elbow.rotation.x = (1.35 + 0.35 * s) * (1 - dk) + 0.25 * dk;
      } else if (p.air) {
        const up = p.vh > 0 ? 1 : 0;
        L.hip.rotation.x = i === 0 ? 1.1 * up + 0.35 : 0.25 * up - 0.15;
        L.knee.rotation.x = i === 0 ? -1.5 * up - 0.4 : -0.5;
        R.shoulder.rotation.x = up ? -2.3 : -0.4;
        R.shoulder.rotation.z = side * (up ? 0.35 : 1.15);
        R.elbow.rotation.x = up ? 0.3 : 0.5;
      } else {
        // idle: a ready stance, weight shifting, hands loose
        const br = Math.sin(this.t * 2.1);
        L.hip.rotation.x = 0.06 * (i ? 1 : -1); L.knee.rotation.x = -0.12 - 0.04 * br;
        R.shoulder.rotation.x = 0.12 + 0.05 * br; R.shoulder.rotation.z = side * 0.22; R.elbow.rotation.x = 0.35;
      }
    }
    // the cinematic: both arms reach out, or one arm tosses the pearl ball
    if (p.reach) for (let i = 0; i < 2; i++) { const R = this.arms[i], side = i === 0 ? -1 : 1; R.shoulder.rotation.x = -1.7 * p.reach; R.shoulder.rotation.z = side * 0.25; R.elbow.rotation.x = 0.2; }
    if (p.toss !== undefined) { const R = this.arms[1], k = Math.sin(Math.min(1, Math.max(0, p.toss)) * Math.PI); R.shoulder.rotation.x = -0.4 - k * 2.2; R.elbow.rotation.x = 0.5 - k * 0.4; }
    // body: lean into the run (harder with speed and at Turbo), bob, twist, bank into turns
    const bob = run * Math.abs(Math.cos(this.phase)) * 0.06 + (idle ? Math.sin(this.t * 2.1) * 0.012 : 0);
    if (!p.air && this.wasAir) this.squash = 1;
    this.wasAir = p.air;
    this.squash = Math.max(0, this.squash - dt * 5);
    const sq = Math.sin(this.squash * Math.PI) * 0.12;
    this.body.position.y = bob - sq * 0.35;
    this.body.scale.y *= 1 - sq; this.body.scale.x *= 1 + sq * 0.6; this.body.scale.z *= 1 + sq * 0.6;
    const lean = idle ? 0 : p.air ? Math.max(-0.4, Math.min(0.3, -p.vh * 0.03)) - 0.1 : -(0.14 + 0.2 * sp + 0.16 * dk);
    this.body.rotation.x = lean;
    this.body.rotation.z = Math.max(-0.4, Math.min(0.4, -p.vu * 0.045));
    this.torso.rotation.y = run * Math.sin(this.phase) * 0.16;
    this.torso.rotation.x = run * -0.06 * sp;
    // the head keeps its eyes on the road; at idle it looks around
    this.head.rotation.x = -lean * 0.7 + run * Math.cos(this.phase * 2) * 0.03;
    this.head.rotation.y = -this.torso.rotation.y * 0.8 + (idle ? Math.sin(this.t * 0.6) * 0.35 : 0);
    // tail sways and trails
    this.tail[0].rotation.y = Math.sin(this.phase * 0.5) * 0.22;
    this.tail[0].rotation.x = -1.25 + run * Math.sin(this.phase * 2) * 0.08 + (p.air ? 0.3 : 0);
    this.tail[1].rotation.y = Math.sin(this.phase * 0.5 - 0.8) * 0.3;
    // blink (lids rest tilted back, roll forward to close)
    this.blinkT -= dt;
    const shut = this.blinkT < 0.11;
    if (this.blinkT < 0) this.blinkT = 1.8 + Math.random() * 2.6;
    for (const l of this.lids) l.rotation.x = shut ? -1.5 : 0.85;
    // scarf ribbons: wave harder the faster we go
    const pos = this.scarf.geometry.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array, b0 = this.scarfBase;
    const f = Math.min(1, p.v / 22);
    for (let i = 0; i < a.length; i += 3) {
      const t = -b0[i + 1] / 0.62, o = b0[i] > 0 ? 1.3 : 0;
      a[i] = b0[i] + Math.sin(this.phase * 1.5 + t * 6 + o) * 0.06 * t * (0.4 + f);
      a[i + 2] = b0[i + 2] + Math.sin(this.phase * 1.1 + t * 5 + o) * 0.12 * t * f - t * t * 0.25 * (1 - f);
    }
    pos.needsUpdate = true;
    this.scarf.rotation.x = -Math.PI / 2 + 0.3 + (1 - f) * 0.75;
    // hit flash (back to each material's own glow after) and mercy blink
    for (const x of this.flash) x.m.emissive.copy(p.hit ? RED : x.base);
    this.root.visible = !p.blink || Math.floor(performance.now() / 70) % 2 === 0;
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) { const s = m as THREE.MeshStandardMaterial; s.map?.dispose(); s.emissiveMap?.dispose(); m.dispose(); }
  }
}
const RED = new THREE.Color("#FF2A2A");
