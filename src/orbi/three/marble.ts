// A racing marble: a glossy sphere in its skin (Orbi's is clear glass with a glowing swirl spinning inside), a soft
// glow for the shiny ones, and a name tag floating above the rivals. It rolls for real: every frame it turns about
// the axis across its direction of travel by the distance it moved.
import * as THREE from "three";
import { glowTex, SKINS, swirlTex } from "./tex";

const SPHERE = new THREE.SphereGeometry(1, 40, 28);
const CORE = new THREE.SphereGeometry(0.62, 24, 16);

function nameTag(text: string, color: string) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d")!;
  g.font = "bold 34px system-ui, sans-serif";
  const w = Math.min(248, g.measureText(text).width + 30);
  g.fillStyle = "rgba(20,24,48,0.72)"; g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 46, 23); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc((256 - w) / 2 + 16, 31, 7, 0, 7); g.fill();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128 + 8, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.65, 1); s.renderOrder = 5;
  return s;
}

export class MarbleView {
  readonly root = new THREE.Group();
  readonly ball: THREE.Mesh;
  private core: THREE.Mesh | null = null;
  readonly tag: THREE.Sprite | null;
  private mats: THREE.Material[] = [];
  private q = new THREE.Quaternion();
  private last = new THREE.Vector3();
  private first = true;

  constructor(skin: number, name: string, isPlayer: boolean, quality: "low" | "medium" | "high", env: THREE.Texture | null) {
    const sk = SKINS[skin % SKINS.length];
    let mat: THREE.Material;
    if (sk.glass) {
      const m = new THREE.MeshPhysicalMaterial({
        color: sk.tint ?? "#6FD8FF", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMap: env, envMapIntensity: 1.5,
        transparent: true, opacity: quality === "high" ? 1 : 0.72, ...(quality === "high" ? { transmission: 0.7, thickness: 1.2, ior: 1.45 } : {}),
      });
      mat = m;
      const cm = new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      this.core = new THREE.Mesh(CORE, cm); this.mats.push(cm);
    } else {
      mat = new THREE.MeshPhysicalMaterial({
        color: sk.tex ? "#ffffff" : sk.color, map: sk.tex?.() ?? null, roughness: sk.rough ?? 0.25, metalness: sk.metal ?? 0.05,
        clearcoat: 0.8, clearcoatRoughness: 0.12, envMap: env, envMapIntensity: sk.metal ? 1.4 : 0.9,
        ...(sk.emissiveMap ? { emissiveMap: sk.emissiveMap(), emissive: new THREE.Color(sk.glow ?? "#ffffff"), emissiveIntensity: 1.4 } : {}),
      });
    }
    this.mats.push(mat);
    this.ball = new THREE.Mesh(SPHERE, mat);
    this.ball.castShadow = quality !== "low";
    this.root.add(this.ball);
    if (this.core) this.ball.add(this.core);
    if (sk.glow) {
      const gm = new THREE.SpriteMaterial({ map: glowTex(sk.glow), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: isPlayer ? 0.55 : 0.35 });
      const gs = new THREE.Sprite(gm); gs.scale.setScalar(3.2); this.root.add(gs); this.mats.push(gm);
    }
    this.tag = isPlayer ? null : nameTag(name, sk.color);
    if (this.tag) { this.tag.position.y = 1.9; this.root.add(this.tag); this.mats.push(this.tag.material); }
  }

  /** place the marble (world centre, radius) and roll it by the distance moved; `up` is the road's normal */
  place(p: THREE.Vector3, r: number, up: THREE.Vector3, dt: number, spinBoost = 0) {
    this.root.position.copy(p);
    this.ball.scale.setScalar(r);
    if (this.tag) this.tag.position.y = r + 1.25;
    if (this.first) { this.last.copy(p); this.first = false; }
    const d = p.clone().sub(this.last);
    const dist = d.length();
    if (dist > 1e-4 && dist < 30) {
      const axis = new THREE.Vector3().crossVectors(up, d).normalize();
      if (axis.lengthSq() > 0.5) { this.q.setFromAxisAngle(axis, dist / r); this.ball.quaternion.premultiply(this.q); }
    }
    if (this.core) this.core.rotation.y += dt * (2 + spinBoost * 6);
    this.last.copy(p);
  }
  reset() { this.first = true; }
  /** a see-through ghost (Time Trial) */
  ghostify() { for (const m of this.mats) { m.transparent = true; m.opacity = 0.35; m.depthWrite = false; } this.ball.castShadow = false; }
  dispose() { for (const m of this.mats) { const mm = m as THREE.MeshStandardMaterial; if (mm.map && !(mm.map as THREE.CanvasTexture).isCanvasTexture) mm.map.dispose(); m.dispose(); } }
}
