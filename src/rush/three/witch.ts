// Mayamma the Sky Witch: an old, ghost-white woman who never walks — she floats. A gaunt grey face with sunken cheeks,
// a hooked nose, a crooked grin with uneven teeth and deep sockets where her eyes burn green; long, wild silver hair
// falling over her shoulders; thin bony arms with long dark nails; a flowing white saree with a faded red-and-gold
// border, its pallu thrown over her head and streaming behind her, the hem fraying into mist where her feet should
// be. She bobs, her saree ripples and flutters, her hair sways, she casts with both hands, and she can carry Chintu.
import * as THREE from "three";
import { mergeStatic } from "./merge";
import { glow } from "./tex";

const SKIN = "#CBD3D8", CLOTH = "#F4F2EC", BORDER = "#B8323A", GOLDB = "#D8B25A", HAIR = "#E4E6EA", NAIL = "#2A2430";

function sareeTex() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = CLOTH; g.fillRect(0, 0, 256, 512);
  // a soft weave and old stains
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(150,150,140,${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 512, 2, 1); }
  for (let i = 0; i < 18; i++) { const x = Math.random() * 256, y = Math.random() * 512, r = 10 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(170,170,155,0.18)"); gr.addColorStop(1, "rgba(170,170,155,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // the border near the hem (v = 0 is the bottom of the lathe)
  const y0 = 512 - 70;
  g.fillStyle = BORDER; g.fillRect(0, y0, 256, 26);
  g.fillStyle = GOLDB; g.fillRect(0, y0 - 6, 256, 5); g.fillRect(0, y0 + 27, 256, 5);
  for (let x = 4; x < 256; x += 16) { g.beginPath(); g.moveTo(x, y0 + 4); g.lineTo(x + 6, y0 + 13); g.lineTo(x, y0 + 22); g.lineTo(x - 6, y0 + 13); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
/** fade to nothing toward the hem (alpha map: white = solid) */
function fadeTex() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, "#000000"); gr.addColorStop(0.28, "#5A5A5A"); gr.addColorStop(0.5, "#FFFFFF"); gr.addColorStop(1, "#FFFFFF");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}
/** wrinkles, hollow cheeks and dark sockets painted on the face (front of the head = u 0.75) */
function faceTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = SKIN; g.fillRect(0, 0, 512, 256);
  const cx = 384, cy = 120;
  const blot = (x: number, y: number, r: number, col: string, a: number) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace("A", String(a))); gr.addColorStop(1, col.replace("A", "0")); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const sx of [-1, 1]) { blot(cx + sx * 26, cy - 6, 30, "rgba(40,30,60,A)", 0.85); blot(cx + sx * 34, cy + 40, 26, "rgba(70,80,95,A)", 0.45); }
  g.strokeStyle = "rgba(60,60,75,0.55)"; g.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx - 40, cy - 46 - i * 7); g.quadraticCurveTo(cx, cy - 52 - i * 7, cx + 40, cy - 46 - i * 7); g.stroke(); }
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx + sx * (46 + i * 3), cy - 10 + i * 6); g.lineTo(cx + sx * (60 + i * 4), cy - 4 + i * 8); g.stroke(); g.beginPath(); g.moveTo(cx + sx * 12, cy + 32 + i * 5); g.quadraticCurveTo(cx + sx * 22, cy + 46 + i * 6, cx + sx * 16, cy + 62 + i * 4); g.stroke(); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,95,110,${Math.random() * 0.25})`; g.fillRect(Math.random() * 512, Math.random() * 256, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export interface WitchPose { dt: number; t: number; cast?: number; speak?: boolean; laugh?: boolean; carry?: boolean; lean?: number }

export class Witch {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  /** where Chintu hangs when she carries him (her left hand) */
  readonly grip = new THREE.Object3D();
  /** where her magic leaves (her right hand) */
  readonly palm = new THREE.Object3D();
  private head = new THREE.Group();
  private jaw = new THREE.Group();
  private armR = new THREE.Group(); private armL = new THREE.Group();
  private hair: THREE.Group[] = [];
  private skirt: THREE.Mesh; private skirtBase: Float32Array;
  private pallu: THREE.Mesh; private palluBase: Float32Array;
  private eyes: THREE.Mesh[] = [];
  private aura: THREE.Sprite;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private say = 0;

  constructor() {
    const g = <T extends THREE.BufferGeometry>(x: T) => { this.geos.push(x); return x; };
    const m = <T extends THREE.Material>(x: T) => { this.mats.push(x); return x; };
    const cloth = m(new THREE.MeshStandardMaterial({ map: sareeTex(), alphaMap: fadeTex(), transparent: true, side: THREE.DoubleSide, roughness: 0.85, emissive: "#9FB8C8", emissiveIntensity: 0.22, depthWrite: false }));
    const clothSolid = m(new THREE.MeshStandardMaterial({ map: sareeTex(), side: THREE.DoubleSide, roughness: 0.85, emissive: "#9FB8C8", emissiveIntensity: 0.2 }));
    const skin = m(new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7, emissive: "#3A4A5A", emissiveIntensity: 0.25 }));
    const face = m(new THREE.MeshStandardMaterial({ map: faceTex(), roughness: 0.75, emissive: "#3A4A5A", emissiveIntensity: 0.25 }));
    const dark = m(new THREE.MeshStandardMaterial({ color: "#140A18", roughness: 0.6 }));
    const nail = m(new THREE.MeshStandardMaterial({ color: NAIL, roughness: 0.3, metalness: 0.2 }));
    const tooth = m(new THREE.MeshStandardMaterial({ color: "#E8E0C8", roughness: 0.5 }));
    const hairM = m(new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.9, side: THREE.DoubleSide, emissive: "#8090A0", emissiveIntensity: 0.25 }));
    const eyeM = m(new THREE.MeshBasicMaterial({ color: "#B8FF5A" }));
    const add = (p: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.scale.set(sx, sy, sz); p.add(me); return me; };
    const sph = g(new THREE.SphereGeometry(1, 20, 14));

    this.root.add(this.body);
    // ---- the saree: a long flowing body that frays into mist (no feet)
    const prof: THREE.Vector2[] = [];
    const H = 2.3;
    const R = (y: number) => { const t = y / H; return t > 0.92 ? 0.12 + (1 - t) * 1.5 : t > 0.7 ? 0.24 + (0.92 - t) * 0.2 : 0.29 + (0.7 - t) * 0.62 + Math.sin(t * 9) * 0.02; };
    for (let i = 0; i <= 28; i++) { const y = (i / 28) * H; prof.push(new THREE.Vector2(R(y), y)); }
    const sk = g(new THREE.LatheGeometry(prof, 40));
    // fray the hem: ragged points at the bottom
    const sp = sk.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) { const a0 = Math.atan2(sp.getZ(i), sp.getX(i)), fold = 1 + 0.07 * Math.sin(a0 * 9) * Math.min(1, (H - sp.getY(i)) / 1.2); sp.setX(i, sp.getX(i) * fold); sp.setZ(i, sp.getZ(i) * fold); }
    for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); if (y < 0.35) { const a = Math.atan2(sp.getZ(i), sp.getX(i)); sp.setY(i, y - (0.35 - y) * (0.6 + 0.9 * Math.abs(Math.sin(a * 5)))); } }
    sk.computeVertexNormals();
    this.skirtBase = (sp.array as Float32Array).slice();
    this.skirt = add(this.body, sk, cloth, 0, -1.2, 0) as THREE.Mesh;
    // a solid inner layer so the body never looks hollow
    add(this.body, g(new THREE.CylinderGeometry(0.2, 0.32, 1.2, 16)), clothSolid, 0, 0.35, 0);
    // ---- arms: thin and bony, long fingers with dark nails
    const arm = (side: number, grp: THREE.Group) => {
      grp.position.set(side * 0.27, 0.95, 0); this.body.add(grp);
      add(grp, g(new THREE.CylinderGeometry(0.05, 0.035, 0.55, 8).translate(0, -0.27, 0)), skin);
      add(grp, sph, clothSolid, 0, -0.08, 0, 0.1, 0.16, 0.1); // the blouse sleeve
      const fore = new THREE.Group(); fore.position.y = -0.55; grp.add(fore); grp.userData.fore = fore;
      add(fore, g(new THREE.CylinderGeometry(0.035, 0.028, 0.5, 8).translate(0, -0.25, 0)), skin);
      add(fore, sph, skin, 0, -0.55, 0, 0.06, 0.08, 0.04);
      for (let f = 0; f < 4; f++) {
        const fg = new THREE.Group(); fg.position.set((f - 1.5) * 0.028, -0.6, -0.01); fg.rotation.x = -0.25 - f * 0.05; fore.add(fg);
        add(fg, g(new THREE.CylinderGeometry(0.009, 0.007, 0.16, 5).translate(0, -0.08, 0)), skin);
        add(fg, g(new THREE.ConeGeometry(0.008, 0.08, 5).translate(0, -0.04, 0)), nail, 0, -0.16, 0);
      }
      const thumb = add(fore, g(new THREE.CylinderGeometry(0.01, 0.008, 0.1, 5).translate(0, -0.05, 0)), skin, side * -0.05, -0.56, -0.02); thumb.rotation.z = side * 0.8;
      return fore;
    };
    const foreR = arm(1, this.armR), foreL = arm(-1, this.armL);
    this.palm.position.set(0, -0.7, -0.05); foreR.add(this.palm);
    this.grip.position.set(0, -0.72, 0); foreL.add(this.grip);
    // ---- head: gaunt, long, with a hooked nose and a crooked grin
    this.head.position.set(0, 1.42, -0.02); this.body.add(this.head);
    add(this.head, g(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 10)), skin, 0, -0.18, 0); // a thin neck
    const skull = add(this.head, sph, face, 0, 0.02, 0, 0.17, 0.22, 0.18); skull.rotation.y = 0;
    add(this.head, sph, skin, 0, -0.12, -0.05, 0.1, 0.08, 0.1); // the chin, pointed
    const nose = add(this.head, g(new THREE.ConeGeometry(0.035, 0.16, 8).rotateX(-Math.PI / 2 - 0.5)), skin, 0, 0.0, -0.2);
    void nose;
    add(this.head, sph, skin, 0, -0.045, -0.235, 0.025, 0.022, 0.022); // the hooked tip
    for (const sx of [-1, 1]) {
      add(this.head, sph, dark, sx * 0.065, 0.06, -0.14, 0.05, 0.04, 0.03); // sunken sockets
      const eye = add(this.head, sph, eyeM, sx * 0.065, 0.06, -0.162, 0.022, 0.018, 0.012); this.eyes.push(eye as THREE.Mesh);
      const brow = add(this.head, g(new THREE.BoxGeometry(0.09, 0.016, 0.02)), dark, sx * 0.07, 0.115, -0.155); brow.rotation.z = sx * -0.45;
      add(this.head, sph, skin, sx * 0.17, 0.02, 0.01, 0.025, 0.05, 0.03); // pointed ears
    }
    // a red dot on her brow
    add(this.head, sph, m(new THREE.MeshBasicMaterial({ color: "#C8202A" })), 0, 0.14, -0.17, 0.014, 0.014, 0.006);
    // the mouth: a dark crooked gap with uneven teeth, on a jaw that drops when she speaks or laughs
    this.jaw.position.set(0, -0.08, -0.13); this.head.add(this.jaw);
    add(this.jaw, sph, dark, 0, 0, -0.02, 0.07, 0.025, 0.02);
    for (let i = 0; i < 6; i++) { const t2 = add(this.jaw, g(new THREE.ConeGeometry(0.008, 0.03, 4)), tooth, -0.05 + i * 0.02, 0.012 + (i % 2) * 0.004, -0.035); t2.rotation.z = Math.PI + (i % 3 - 1) * 0.3; }
    // ---- hair: long, wild and silver, falling over her shoulders and down her back
    for (let k = 0; k < 5; k++) {
      const grp = new THREE.Group(); grp.position.set(0, 0.16, 0.02); this.head.add(grp); this.hair.push(grp);
      for (let i = 0; i < 9; i++) {
        const a = -0.35 + (k / 5) * (Math.PI + 0.4) + i * 0.06, len = 0.7 + Math.random() * 0.6;
        const strand = add(grp, g(new THREE.PlaneGeometry(0.05, len).translate(0, -len / 2, 0)), hairM, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.15 + 0.02);
        strand.rotation.set(0.15 + Math.random() * 0.2, -a + Math.PI / 2, (Math.random() - 0.5) * 0.4);
      }
    }
    // ---- the pallu: over her head as a veil, then streaming out behind her
    add(this.head, g(new THREE.SphereGeometry(0.2, 18, 12, Math.PI * 1.85, Math.PI * 1.3, 0, Math.PI * 0.62)), clothSolid, 0, 0.04, 0.02, 1.08, 1.18, 1.1);
    const pl = g(new THREE.PlaneGeometry(0.42, 2.2, 3, 18).translate(0, -1.1, 0));
    this.palluBase = (pl.attributes.position.array as Float32Array).slice();
    this.pallu = add(this.body, pl, cloth, 0.05, 1.62, 0.12) as THREE.Mesh;
    this.pallu.rotation.x = -1.1;
    // ---- a ghostly glow round her
    this.aura = new THREE.Sprite(m(new THREE.SpriteMaterial({ map: glow("#BFE8FF"), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.aura.scale.set(3.2, 4.4, 1); this.aura.position.y = 0.4; this.root.add(this.aura);
    for (const e of this.eyes) { const gl = new THREE.Sprite(m(new THREE.SpriteMaterial({ map: glow("#B8FF5A"), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }))); gl.scale.setScalar(0.18); e.add(gl); gl.scale.set(6, 7, 1); }
    // ---- fewer draw calls: merge what moves together (each lock of hair, each forearm and hand, the jaw, the face);
    // the saree, the pallu (rippled every frame) and the eyes (they flare) stay as they are
    this.skirt.userData.dyn = true; this.pallu.userData.dyn = true; this.jaw.userData.dyn = true;
    for (const e of this.eyes) e.userData.dyn = true;
    for (const h of this.hair) { h.userData.dyn = true; this.geos.push(...mergeStatic(h)); }
    this.geos.push(...mergeStatic(this.jaw), ...mergeStatic(foreR), ...mergeStatic(foreL));
    foreR.userData.dyn = true; foreL.userData.dyn = true;
    this.geos.push(...mergeStatic(this.head));
    this.root.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
  }

  /** she speaks for this many seconds (her jaw moves) */
  talk(seconds: number) { this.say = Math.max(this.say, seconds); }

  update(p: WitchPose) {
    const t = p.t, dt = p.dt;
    this.say = Math.max(0, this.say - dt);
    // float: a slow bob and sway, leaning into her flight
    this.body.position.y = Math.sin(t * 1.6) * 0.12;
    this.body.rotation.z = Math.sin(t * 0.9) * 0.06;
    this.body.rotation.x = -(p.lean ?? 0.15);
    // the saree ripples and flutters more toward the hem
    const a = this.skirt.geometry.attributes.position as THREE.BufferAttribute, arr = a.array as Float32Array, b = this.skirtBase;
    for (let i = 0; i < arr.length; i += 3) {
      const y = b[i + 1], k = Math.max(0, 1 - (y + 0.4) / 2.2) ** 1.6;
      const ang = Math.atan2(b[i + 2], b[i]);
      arr[i] = b[i] + Math.sin(t * 3 + y * 3 + ang * 2) * 0.06 * k;
      arr[i + 2] = b[i + 2] + Math.cos(t * 2.6 + y * 2.4 + ang) * 0.08 * k + k * k * 0.5 * (p.lean ?? 0.15);
      arr[i + 1] = b[i + 1] + Math.sin(t * 2 + ang * 3) * 0.05 * k;
    }
    a.needsUpdate = true;
    const q = this.pallu.geometry.attributes.position as THREE.BufferAttribute, qa = q.array as Float32Array, qb = this.palluBase;
    for (let i = 0; i < qa.length; i += 3) { const s = -qb[i + 1] / 2.2; qa[i] = qb[i] + Math.sin(t * 4 + s * 6) * 0.1 * s; qa[i + 2] = qb[i + 2] + Math.sin(t * 3 + s * 5) * 0.22 * s; }
    q.needsUpdate = true;
    for (let i = 0; i < this.hair.length; i++) { this.hair[i].rotation.x = 0.2 + Math.sin(t * 2.2 + i) * 0.12 + (p.lean ?? 0.15) * 0.6; this.hair[i].rotation.z = Math.sin(t * 1.7 + i * 1.3) * 0.1; }
    // arms: reach and claw; a cast swings the right arm forward and opens the hand
    const cast = Math.max(0, Math.min(1, p.cast ?? 0));
    this.armR.rotation.x = -0.4 - Math.sin(t * 1.3) * 0.15 - cast * 1.6;
    this.armR.rotation.z = 0.35 + cast * 0.2;
    (this.armR.userData.fore as THREE.Group).rotation.x = -0.6 + cast * 0.5;
    this.armL.rotation.x = p.carry ? -0.9 : -0.5 - Math.sin(t * 1.3 + 1) * 0.15;
    this.armL.rotation.z = p.carry ? -0.1 : -0.35;
    (this.armL.userData.fore as THREE.Group).rotation.x = p.carry ? -0.2 : -0.6;
    // head: a tilt, and the jaw drops as she talks or cackles
    this.head.rotation.z = Math.sin(t * 1.1) * 0.12 + (p.laugh ? Math.sin(t * 14) * 0.08 : 0);
    this.head.rotation.x = p.laugh ? -0.3 : 0.05;
    const open = p.laugh ? 0.5 + Math.abs(Math.sin(t * 16)) * 0.5 : this.say > 0 ? Math.abs(Math.sin(t * 13)) * 0.7 : 0.1;
    this.jaw.position.y = -0.08 - open * 0.035; this.jaw.scale.y = 1 + open * 1.4;
    // the eyes flare
    const flare = 0.85 + Math.sin(t * 7) * 0.15 + cast * 0.6;
    for (const e of this.eyes) e.scale.set(0.022 * flare, 0.018 * flare, 0.012);
    (this.aura.material as THREE.SpriteMaterial).opacity = 0.45 + Math.sin(t * 2) * 0.1 + cast * 0.25;
  }

  dispose() { for (const g of this.geos) g.dispose(); for (const m of this.mats) { (m as THREE.MeshStandardMaterial).map?.dispose(); (m as THREE.MeshStandardMaterial).alphaMap?.dispose(); m.dispose(); } }
}
