// Puddo Clayland wardrobe: a little 3D dressing room — the chosen character on a clay pedestal with the hat on,
// turning slowly (drag to turn), with the trail sparkling around when one is picked.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { gloop, pip, zib } from "../boing/models";
import { hatGeo, tint } from "../crowd/models";
import { momoRig } from "../dash/models";
import { puddoRig } from "./models";
import { HAT_BASE, TRAIL_COLORS, type ClayLookR } from "./render";

const HAT_Y: Record<string, number> = { puddo: 1.08, momo: 1.02, pip: 1.12, gloop: 0.98, zib: 1.04 };

export class ClayWardrobe {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private who = new THREE.Group();
  private sparkles: THREE.InstancedMesh;
  private mat: THREE.MeshPhysicalMaterial;
  private geos: THREE.BufferGeometry[] = [];
  private raf = 0; private last = 0; private t = 0; private angle = 0; private drag: { x: number; a: number } | null = null;
  private host: HTMLElement; private ro: ResizeObserver; private colors: string[] = [];

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "pan-y" });
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#8a7a6a", 1.3));
    const key = new THREE.DirectionalLight("#FFF2D8", 2.4); key.position.set(3, 6, 5); this.scene.add(key);
    this.mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.2 });
    // the pedestal: a clay drum with a grassy top
    const base = tint(new THREE.CylinderGeometry(0.8, 0.9, 0.45, 32).translate(0, -0.23, 0), "#E8B35A");
    const top = tint(new THREE.CylinderGeometry(0.84, 0.84, 0.12, 32).translate(0, 0.02, 0), "#7ED957");
    this.geos.push(base, top);
    this.scene.add(new THREE.Mesh(base, this.mat), new THREE.Mesh(top, this.mat));
    this.scene.add(this.who);
    const sg = new THREE.SphereGeometry(0.05, 6, 5); this.geos.push(sg);
    this.sparkles = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ toneMapped: false }), 24);
    this.sparkles.count = 0; this.scene.add(this.sparkles);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove); window.addEventListener("pointerup", this.onUp);
    this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }

  set(look: ClayLookR) {
    for (const c of [...this.who.children]) this.who.remove(c);
    const add = (g: THREE.BufferGeometry, x = 0, y = 0, z = 0) => { this.geos.push(g); const m = new THREE.Mesh(g, this.mat); m.position.set(x, y, z); this.who.add(m); return m; };
    if (look.char === "momo" || look.char === "puddo") {
      const r = look.char === "momo" ? momoRig() : (() => { const p = puddoRig(); return { body: p.body, foot: p.foot, arm: p.arm, sprout: p.hat }; })();
      const inner = new THREE.Group(); inner.rotation.y = Math.PI; this.who.add(inner);
      const put = (g: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0) => { this.geos.push(g); const m = new THREE.Mesh(g, this.mat); m.position.set(x, y, z); m.rotation.z = rz; inner.add(m); };
      put(r.body, 0, 0.08, 0); put(r.foot, -0.2, 0, 0); put(r.foot.clone(), 0.2, 0, 0); put(r.arm, -0.47, 0.63, 0, -0.5); put(r.arm.clone(), 0.47, 0.63, 0, 0.5);
      if (!(look.char === "puddo" && look.hat !== "none")) put(r.sprout, 0, look.char === "puddo" ? 1.18 : 1.14, 0);
    } else add(look.char === "pip" ? pip() : look.char === "gloop" ? gloop() : zib(), 0, 0.08, 0);
    const hg = look.hat !== "none" ? hatGeo(look.hat) : null;
    if (hg) { const h = add(hg, 0, (HAT_Y[look.char] ?? 1.02) + 0.08 - HAT_BASE * 0.5, 0); h.scale.setScalar(0.5); }
    this.colors = TRAIL_COLORS[look.trail] ?? [];
  }

  private onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, a: this.angle }; };
  private onMove = (e: PointerEvent) => { if (this.drag) this.angle = this.drag.a + (e.clientX - this.drag.x) * 0.012; };
  private onUp = () => { this.drag = null; };
  private resize() {
    const r = this.host.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // fit the hero, a tall hat and the pedestal top: ~2.5 tiles tall and ~2.3 wide, whatever the panel's shape
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), dist = Math.max(2.5 / k, 2.3 / (k * this.camera.aspect));
    this.camera.position.set(0, 0.95 + dist * 0.06, dist); this.camera.lookAt(0, 0.78, 0);
  }
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    // idle: a gentle sway that keeps the face toward you (drag to turn all the way round)
    if (!this.drag) this.angle += (Math.sin(this.t * 0.7) * 0.55 - this.angle) * Math.min(1, dt * 1.6);
    this.who.rotation.y = this.angle;
    this.who.position.y = Math.abs(Math.sin(this.t * 2.4)) * 0.06;
    const n = this.colors.length ? 24 : 0;
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.t * 0.9, y = 0.2 + ((i * 0.37 + this.t * 0.3) % 1) * 1.2;
      m.makeTranslation(Math.cos(a) * 0.95, y, Math.sin(a) * 0.95); this.sparkles.setMatrixAt(i, m);
      this.sparkles.setColorAt(i, c.set(this.colors[i % this.colors.length]));
    }
    this.sparkles.count = n; this.sparkles.instanceMatrix.needsUpdate = true; if (this.sparkles.instanceColor) this.sparkles.instanceColor.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.raf); this.ro.disconnect();
    window.removeEventListener("pointermove", this.onMove); window.removeEventListener("pointerup", this.onUp);
    this.geos.forEach((g) => g.dispose()); this.mat.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
