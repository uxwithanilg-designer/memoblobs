// Kiko's Treehouse — a small 3D scene for the Treehouse screen: the treehouse on a grassy island with every decoration
// bought so far, Kiko waving on the deck and the Golden Seeds won glowing on the branch. Drag to turn it; it turns slowly
// by itself.
import * as THREE from "three";
import * as M from "./models";
import * as M2 from "./models2";

export class TreehouseView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  private root = new THREE.Group();
  private decos = new THREE.Group();
  private seeds = new THREE.Group();
  private raf = 0; private last = 0; private angle = 0.6; private spin = 0.12; private drag: { x: number; a: number } | null = null;
  private host: HTMLElement; private ro: ResizeObserver;
  private mats: Record<string, THREE.Material>;
  private disposables: { dispose: () => void }[] = [];
  private kiko = new THREE.Group(); private arm: THREE.Group | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
    const sc = this.scene;
    sc.add(new THREE.HemisphereLight("#FFFFFF", "#4A6A3A", 1.3));
    const key = new THREE.DirectionalLight("#FFF2D8", 2.4); key.position.set(8, 14, 10); sc.add(key);
    const rim = new THREE.DirectionalLight("#9FD8FF", 0.8); rim.position.set(-10, 6, -8); sc.add(rim);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene(); envScene.background = new THREE.Color("#BFE6FF");
    const rt = pm.fromScene(envScene, 0.04); sc.environment = rt.texture; this.disposables.push(rt, pm);
    const k = <T extends { dispose: () => void }>(x: T) => { this.disposables.push(x); return x; };
    this.mats = {
      gloss: k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.22, envMapIntensity: 0.9 })),
      clay: k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })),
      leaf: k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })),
      canopy: k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.78, sheen: 0.5, sheenColor: new THREE.Color("#C8FFB0") })),
      glow: k(new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) })),
      glass: k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, transparent: true, opacity: 0.85 })),
    };
    // the island
    const island = new THREE.CylinderGeometry(9, 7, 1.6, 40); island.translate(0, -0.8, 0);
    const top = new THREE.CylinderGeometry(9, 9, 0.12, 40); top.translate(0, 0.02, 0);
    this.root.add(new THREE.Mesh(k(island), k(new THREE.MeshStandardMaterial({ color: "#8A5A32", roughness: 0.9 }))));
    this.root.add(new THREE.Mesh(k(top), k(new THREE.MeshStandardMaterial({ color: "#5FB84A", roughness: 0.9 }))));
    const th = M.treehouse(); this.root.add(new THREE.Mesh(k(th), this.mats.gloss));
    for (let i = 0; i < 6; i++) { const f = M.fern(i % 2); f.translate(Math.cos(i * 1.1) * 6.5, 0, Math.sin(i * 1.1) * 6.5); this.root.add(new THREE.Mesh(k(f), this.mats.leaf)); }
    for (let i = 0; i < 3; i++) { const b = M.bananaPlant(i % 2); b.translate(Math.cos(i * 2.1 + 0.5) * 7, 0, Math.sin(i * 2.1 + 0.5) * 7); this.root.add(new THREE.Mesh(k(b), this.mats.leaf)); }
    // Kiko waving on the deck
    const rig = M.kikoRig("kiko");
    const km = k(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.46, clearcoat: 0.6, sheen: 0.25, sheenColor: new THREE.Color("#FFD2A8") }));
    this.kiko.add(new THREE.Mesh(k(rig.torso), km));
    const head = new THREE.Group(); head.position.set(0, 0.9, 0); head.add(new THREE.Mesh(k(rig.head), km)); this.kiko.add(head);
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 0.3, 0.82, 0); a.add(new THREE.Mesh(k(rig.arm), km)); this.kiko.add(a);
      if (sx > 0) this.arm = a; else a.rotation.z = -0.2;
      const l = new THREE.Group(); l.position.set(sx * 0.14, 0.36, 0); l.add(new THREE.Mesh(k(rig.leg), km)); this.kiko.add(l);
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.45, 0.24); tail.add(new THREE.Mesh(k(rig.tail), km)); this.kiko.add(tail);
    this.kiko.position.set(1.0, 6.35, 1.6); this.kiko.rotation.y = Math.PI; this.kiko.scale.setScalar(1.1);
    this.root.add(this.kiko, this.decos, this.seeds);
    sc.add(this.root);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }
  /** show the bought decorations and the Golden Seeds won */
  set(owned: string[], seeds: number) {
    for (const c of [...this.decos.children]) { const m = c as THREE.Mesh; m.geometry.dispose(); this.decos.remove(c); }
    for (const d of M2.DECOS) if (owned.includes(`deco:${d.id}`)) for (const { g, mat } of M2.decoParts(d.id)) this.decos.add(new THREE.Mesh(g, this.mats[mat] ?? this.mats.gloss));
    for (const c of [...this.seeds.children]) { const m = c as THREE.Mesh; m.geometry.dispose(); this.seeds.remove(c); }
    for (let i = 0; i < 15; i++) {
      const g = M.seedGeo(); g.scale(0.9, 0.9, 0.9);
      const a = (i / 15) * Math.PI * 2;
      g.translate(Math.cos(a) * 3.2, 0.7, Math.sin(a) * 3.2);
      const m = new THREE.Mesh(g, i < seeds ? this.mats.glow : this.mats.clay);
      if (i >= seeds) m.scale.setScalar(0.7);
      this.seeds.add(m);
    }
  }
  private onDown = (e: PointerEvent) => { this.drag = { x: e.clientX, a: this.angle }; };
  private onMove = (e: PointerEvent) => { if (this.drag) this.angle = this.drag.a - (e.clientX - this.drag.x) * 0.01; };
  private onUp = () => { this.drag = null; };
  private resize() {
    const b = this.host.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, b.width), Math.max(1, b.height), false);
    this.camera.aspect = Math.max(1, b.width) / Math.max(1, b.height); this.camera.updateProjectionMatrix();
  }
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    if (!this.drag) this.angle += dt * this.spin;
    const r = this.camera.aspect < 0.8 ? 30 : 21;
    this.camera.position.set(Math.sin(this.angle) * r, 11, Math.cos(this.angle) * r);
    this.camera.lookAt(0, 5.5, 0);
    if (this.arm) this.arm.rotation.set(Math.PI * 0.85, 0, -0.4 + Math.sin(now / 160) * 0.35);
    this.seeds.rotation.y += dt * 0.1;
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
