// Kiko's Wardrobe — a small 3D dressing room for the shop: the chosen runner (Kiko, or Momo as a guest) on a tree stump
// with the fur, hat and tail bow on, turning slowly (drag to turn) and doing a little idle dance.
import * as THREE from "three";
import { hatGeo } from "../crowd/models";
import * as M from "./models";
import type { KikoLook } from "./render";
import { pixelRatioFor } from "@/lib/perf";

export class WardrobeView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private runner = new THREE.Group();
  private parts: { head: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[]; tail: THREE.Group } | null = null;
  private raf = 0; private last = 0; private angle = -0.5; private drag: { x: number; a: number } | null = null; private t = 0;
  private host: HTMLElement; private ro: ResizeObserver;
  private mats: { body: THREE.Material; gloss: THREE.Material; wood: THREE.Material };
  private geos: THREE.BufferGeometry[] = [];

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(pixelRatioFor("high"));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "pan-y" });
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight("#FFFFFF", "#4A6A3A", 1.4));
    const key = new THREE.DirectionalLight("#FFF2D8", 2.6); key.position.set(3, 6, 5); sc.add(key);
    const rim = new THREE.DirectionalLight("#9FD8FF", 1.1); rim.position.set(-4, 3, -4); sc.add(rim);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = new THREE.Scene(); env.background = new THREE.Color("#CFEFFF");
    sc.environment = pm.fromScene(env, 0.04).texture; pm.dispose();
    this.mats = {
      body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.46, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.25, sheenColor: new THREE.Color("#FFD2A8") }),
      gloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
      wood: new THREE.MeshStandardMaterial({ color: "#9A6238", roughness: 0.8 }),
    };
    // the stump and a ring of grass
    const stump = new THREE.CylinderGeometry(0.75, 0.85, 0.5, 28); stump.translate(0, -0.25, 0); this.geos.push(stump);
    sc.add(new THREE.Mesh(stump, this.mats.wood));
    const top = new THREE.CylinderGeometry(0.74, 0.74, 0.02, 28); this.geos.push(top);
    sc.add(new THREE.Mesh(top, new THREE.MeshStandardMaterial({ color: "#E8B887", roughness: 0.7 })));
    const grass = new THREE.TorusGeometry(0.85, 0.12, 8, 30); grass.rotateX(Math.PI / 2); grass.translate(0, -0.45, 0); this.geos.push(grass);
    sc.add(new THREE.Mesh(grass, new THREE.MeshStandardMaterial({ color: "#4FB84A", roughness: 0.8 })));
    sc.add(this.runner);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** dress the runner */
  set(look: KikoLook) {
    for (const c of [...this.runner.children]) this.runner.remove(c);
    this.geos.splice(3).forEach((g) => g.dispose());
    const rig = M.runnerRig(look), fit = M.RUNNER_FIT[look.runner === "momo" ? "momo" : "kiko"];
    const mesh = (g: THREE.BufferGeometry, m = this.mats.body) => { this.geos.push(g); return new THREE.Mesh(g, m); };
    const body = new THREE.Group();
    body.add(mesh(rig.torso));
    const head = new THREE.Group(); head.position.set(0, 0.9, 0); head.add(mesh(rig.head)); body.add(head);
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 0.3, 0.82, 0); a.add(mesh(rig.arm)); arms.push(a); body.add(a);
      const l = new THREE.Group(); l.position.set(sx * 0.14, 0.36, 0); l.add(mesh(rig.leg)); legs.push(l); body.add(l);
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.45, 0.24); tail.add(mesh(rig.tail)); body.add(tail);
    const hg = look.hat && look.hat !== "none" ? hatGeo(look.hat) : null;
    if (hg) { const h = mesh(hg, this.mats.gloss); h.scale.setScalar(fit.hatS); h.position.set(0, fit.hatY, 0); head.add(h); }
    const rb = M.RIBBONS[look.ribbon ?? "none"];
    if (rb) { const b = mesh(M.ribbonGeo(rb.color, rb.style), this.mats.gloss); b.position.set(...fit.bow); tail.add(b); }
    this.runner.add(body);
    this.parts = { head, arms, legs, tail };
  }

  private onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, a: this.angle }; };
  private onMove = (e: PointerEvent) => { if (this.drag) this.angle = this.drag.a + (e.clientX - this.drag.x) * 0.012; };
  private onUp = () => { this.drag = null; };
  private resize() {
    const b = this.host.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, b.width), Math.max(1, b.height), false);
    this.camera.aspect = Math.max(1, b.width) / Math.max(1, b.height); this.camera.updateProjectionMatrix();
  }
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now; this.t += dt;
    if (!this.drag) this.angle += dt * 0.5;
    this.runner.rotation.y = this.angle + Math.PI;
    const p = this.parts, t = this.t;
    if (p) {
      // a little happy dance: bob, swing the arms, wag the tail
      this.runner.position.y = Math.abs(Math.sin(t * 3.2)) * 0.06;
      p.arms[0].rotation.set(Math.sin(t * 3.2) * 0.5, 0, -0.25 - Math.max(0, Math.sin(t * 1.6)) * 1.6);
      p.arms[1].rotation.set(-Math.sin(t * 3.2) * 0.5, 0, 0.25);
      p.legs[0].rotation.x = Math.sin(t * 3.2) * 0.25; p.legs[1].rotation.x = -Math.sin(t * 3.2) * 0.25;
      p.tail.rotation.set(Math.sin(t * 2.4) * 0.15, Math.sin(t * 3) * 0.35, 0);
      p.head.rotation.z = Math.sin(t * 1.6) * 0.12;
    }
    const d = this.camera.aspect < 1 ? 5.6 : 4.4;
    this.camera.position.set(0, 1.35, d);
    this.camera.lookAt(0, 0.62, 0);
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    this.geos.forEach((g) => g.dispose());
    Object.values(this.mats).forEach((m) => m.dispose());
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
