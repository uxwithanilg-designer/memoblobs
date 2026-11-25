// The 3D scene of Wake Racers: one WebGL renderer on the shared phone-performance kit (device-tier quality, capped
// pixel ratio, anti-aliasing and shadows only where they're cheap, a frame governor that lowers the resolution when a
// phone can't keep up), and per course: the sky, light and fog from the world's mood, the land and water, the props
// near the water and the landmarks on the horizon, everything on the water, the boats with their pilots, wakes,
// spray and nitro flames, weather and particles. Courses run for tens of kilometres, so the world is streamed in
// 400 m pieces: the ones from just behind you to well ahead are kept, the next one is built a few milliseconds at a
// time each frame, and the ones you've left behind are freed. The game drives it; it never decides anything itself.
import * as THREE from "three";
import { antialiasFor, FrameGovernor, pixelRatioFor, shadowsFor, type Quality } from "@/lib/perf";
import { Land, farFor, propsFor, buoysFor, type Course } from "../course";
import type { Race } from "../race";
import { glowUniforms, dotTexture, dummy } from "./kit";
import { Sky } from "./sky";
import { landMaterials, landPiece, oceanMesh, segCount, segOf, SEG, type LandMats, type LandPiece } from "./land";
import { setWaterMood } from "./water";
import { farGeometry, propGeometry, VARIANTS } from "./props";
import { Objects } from "./objects";
import { buildBoat, type BoatModel } from "./boat-model";
import { Particles, Wakes, WeatherFx } from "./fx";
import { CameraDirector } from "./camera";
import { worldMaterial } from "./kit";
import type { FarKind, PropKind } from "../worlds";
import { clamp } from "../util";

const tmpColor = new THREE.Color();

export class WakeScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.8, 2400);
  readonly director: CameraDirector;
  private gov: FrameGovernor;
  private hemi = new THREE.HemisphereLight("#ffffff", "#444444", 1);
  private sun = new THREE.DirectionalLight("#ffffff", 2);
  private sky: Sky;
  private world = new THREE.Group();
  private landQ: Land | null = null;
  private mats: LandMats | null = null;
  private ocean: THREE.Mesh | null = null;
  private objects: Objects | null = null;
  /** built pieces of the course, and the one being built */
  private pieces = new Map<number, { piece: LandPiece; inst: THREE.InstancedMesh[] }>();
  private building: { k: number; it: Generator<void, void, void>; piece: LandPiece; inst: THREE.InstancedMesh[] } | null = null;
  /** prop and landmark models, shared by every piece */
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private propMat = worldMaterial();
  private boats: BoatModel[] = [];
  private shadowsMesh: THREE.InstancedMesh | null = null;
  private wakes: Wakes | null = null;
  readonly fx: Particles;
  private weather: WeatherFx | null = null;
  private course: Course | null = null;
  private w = 1; private h = 1;
  private flash = 0; private nextBolt = 6;
  private sunDir = new THREE.Vector3();
  private waves = 0.4;
  readonly shadows: boolean;
  private fogBase = { near: 100, far: 900 };

  constructor(readonly host: HTMLElement, readonly quality: Quality, c: Course) {
    this.renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(quality), powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(pixelRatioFor(quality));
    const fullPr = this.renderer.getPixelRatio();
    this.gov = new FrameGovernor((k) => { this.renderer.setPixelRatio(fullPr * k); this.resize(this.w, this.h); });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.shadows = shadowsFor(quality);
    if (this.shadows) { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    host.appendChild(this.renderer.domElement);
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", display: "block" });
    this.sky = new Sky(quality);
    this.scene.add(this.sky.mesh, this.hemi, this.sun, this.sun.target, this.world);
    this.scene.fog = new THREE.Fog("#ffffff", 100, 900);
    if (this.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const s = this.sun.shadow.camera; s.left = -30; s.right = 30; s.top = 30; s.bottom = -30; s.near = 1; s.far = 160;
      this.sun.shadow.bias = -0.0008;
    }
    this.fx = new Particles(quality);
    this.scene.add(this.fx.group);
    this.director = new CameraDirector(c);
    this.setCourse(c);
  }

  /** build the whole world for a course (the old one is thrown away) */
  setCourse(c: Course, onProgress?: (p: number) => void) {
    this.clearWorld();
    this.course = c;
    this.director.setCourse(c);
    const m = c.mood, tw = c.plan.twist;
    const night = tw === "night" ? 1 : m.night;
    // sun from the mood: elevation, and azimuth relative to the course's general direction
    const el = (m.sunEl * Math.PI) / 180, az = (m.sunAz * Math.PI) / 180;
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    this.sky.setMood(m, this.sunDir, tw === "night");
    this.hemi.color.set(m.hemiSky); this.hemi.groundColor.set(m.hemiGround); this.hemi.intensity = m.hemi * (tw === "night" ? 0.45 : 1);
    this.sun.color.set(m.sun); this.sun.intensity = m.light * (tw === "night" ? 0.3 : 1);
    this.renderer.toneMappingExposure = m.exposure * 1.05;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(m.fog);
    if (tw === "night") fog.color.multiplyScalar(0.3);
    this.fogBase.near = tw === "fog" ? 25 : m.fogNear; this.fogBase.far = tw === "fog" ? 230 : m.fogFar;
    if (tw === "fog") fog.color.lerp(tmpColor.set("#d8dde4"), 0.6);
    fog.near = this.fogBase.near; fog.far = this.fogBase.far;
    // glow strong enough to read at night, never so strong it washes colours out to white
    glowUniforms.uGlowNight.value = 0.15 + night * 0.95;
    glowUniforms.uGlowAlways.value = 0.75 + night * 0.3;
    this.waves = c.world.waves * (tw === "giant" ? 2.2 : tw === "storm" ? 1.6 : 1);
    const chop = c.world.id === "storm" || tw === "storm" || tw === "giant" ? 0.9 : c.world.waves * 0.3;

    // land and water, streamed in pieces (the first few now, for the home shot and the fly-over)
    this.landQ = new Land(c);
    this.mats = landMaterials(this.quality);
    setWaterMood(this.mats.water, m, this.sunDir, this.waves, chop, fog.near, fog.far, fog.color, night);
    const fu = this.mats.falls.uniforms;
    fu.uColor.value.set(m.water.shallow); fu.uFoam.value.set(m.water.foam); fu.uFogColor.value.copy(fog.color); fu.uFogNear.value = fog.near; fu.uFogFar.value = fog.far;
    this.ocean = oceanMesh(c, this.landQ, this.mats);
    this.world.add(this.ocean);
    // everything on the water
    this.objects = new Objects(c, this.quality);
    this.world.add(this.objects.group);
    const first = Math.min(segCount(c) - 1, segOf(Math.min(c.length, 1500)));
    for (let k = 0; k <= first; k++) { this.startPiece(k); while (!this.building!.it.next().done) { /* now */ } this.finishPiece(); onProgress?.((k + 1) / (first + 1)); }
    // weather
    const wx = tw === "storm" ? "rain" : c.partner && c.seed % 3 === 0 ? c.partner.weather : c.world.weather;
    this.weather = new WeatherFx(wx, this.quality, tw === "storm" || c.world.id === "storm");
    this.scene.add(this.weather.group);
    this.nextBolt = 4 + Math.random() * 5;
  }

  /** the racers' boats */
  setBoats(race: Race) {
    for (const b of this.boats) { this.world.remove(b.group); b.dispose(); }
    this.boats = race.racers.map((r) => {
      const m = buildBoat(r.boatId, r.livery, r.pilot);
      m.group.traverse((o) => { o.castShadow = this.shadows && r.isPlayer; });
      m.group.rotation.order = "YXZ";
      this.world.add(m.group);
      return m;
    });
    this.wakes?.dispose(); if (this.wakes) this.world.remove(this.wakes.mesh);
    this.wakes = new Wakes(race.racers.length);
    this.wakes.mat.uniforms.uFoam.value.set(this.course!.mood.water.foam);
    this.world.add(this.wakes.mesh);
    if (this.shadowsMesh) { this.world.remove(this.shadowsMesh); this.shadowsMesh.geometry.dispose(); (this.shadowsMesh.material as THREE.Material).dispose(); }
    const sg = new THREE.CircleGeometry(1, 20); sg.rotateX(-Math.PI / 2);
    this.shadowsMesh = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: "#000000", map: dotTexture(), transparent: true, opacity: 0.32, depthWrite: false }), race.racers.length);
    this.shadowsMesh.frustumCulled = false;
    this.shadowsMesh.renderOrder = 2;
    this.world.add(this.shadowsMesh);
  }

  private clearWorld() {
    for (const k of [...this.pieces.keys()]) this.dropPiece(k);
    if (this.building) { this.freePiece(this.building.piece, this.building.inst); this.building = null; }
    if (this.objects) { this.world.remove(this.objects.group); this.objects.dispose(); this.objects = null; }
    if (this.ocean) { this.world.remove(this.ocean); this.ocean.geometry.dispose(); this.ocean = null; }
    if (this.mats) { this.mats.terrain.dispose(); this.mats.water.dispose(); this.mats.falls.dispose(); this.mats = null; }
    for (const g of this.geoCache.values()) g.dispose();
    this.geoCache.clear();
    if (this.weather) { this.scene.remove(this.weather.group); this.weather.dispose(); this.weather = null; }
  }

  // ------------------------------------------------------------------ streaming the course in pieces
  private startPiece(k: number) {
    const piece: LandPiece = { group: new THREE.Group(), geos: [] }, inst: THREE.InstancedMesh[] = [];
    this.building = { k, it: this.pieceWork(k, piece, inst), piece, inst };
  }
  private finishPiece() {
    const b = this.building!;
    this.building = null;
    this.world.add(b.piece.group);
    this.pieces.set(b.k, { piece: b.piece, inst: b.inst });
  }
  private freePiece(piece: LandPiece, inst: THREE.InstancedMesh[]) {
    this.world.remove(piece.group);
    for (const g of piece.geos) g.dispose();
    for (const m of inst) m.dispose();
  }
  private dropPiece(k: number) {
    const p = this.pieces.get(k);
    if (!p) return;
    this.freePiece(p.piece, p.inst);
    this.pieces.delete(k);
  }
  private cached(key: string, make: () => THREE.BufferGeometry) {
    let g = this.geoCache.get(key);
    if (!g) { g = make(); this.geoCache.set(key, g); }
    return g;
  }
  /** everything in piece k: land and water, then props, landmarks, buoys and the static things on the water */
  private *pieceWork(k: number, piece: LandPiece, inst: THREE.InstancedMesh[]): Generator<void, void, void> {
    const c = this.course!, land = this.landQ!, objects = this.objects!;
    yield* landPiece(c, land, this.quality, k, this.mats!, piece);
    const s0 = k * SEG - 180, s1 = s0 + SEG;
    // props, by kind and variant
    const props = propsFor(c, land, s0, s1, k, this.quality === "low" ? 0.6 : this.quality === "medium" ? 0.8 : 1);
    yield;
    const groups = new Map<string, typeof props>();
    for (const pr of props) {
      const nv = VARIANTS[pr.k] ?? 1, v = Math.min(nv - 1, Math.floor(pr.v * nv));
      const key = `${pr.k}:${v}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(pr);
    }
    for (const [key, list] of groups) {
      const [kind, vs] = key.split(":"); const nv = VARIANTS[kind as PropKind] ?? 1;
      // a remix partner's props are in the partner's colours
      const fromPartner = c.partner && !c.world.props.some((r) => r.k === kind);
      const g = this.cached("p:" + key, () => propGeometry(kind as PropKind, fromPartner ? c.partner! : c.world, Number(vs), nv));
      const mesh = new THREE.InstancedMesh(g, this.propMat, list.length);
      list.forEach((pr, i) => {
        dummy.position.set(pr.x, pr.y - (pr.k === "lily" ? 0 : 0.15), pr.z); dummy.rotation.set(0, pr.rot, 0); dummy.scale.setScalar(pr.scale); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, tmpColor.setScalar(0.88 + pr.v * 0.24));
      });
      mesh.receiveShadow = this.shadows;
      mesh.computeBoundingSphere();
      inst.push(mesh); piece.group.add(mesh);
      yield;
    }
    // landmarks on the horizon
    const far = farFor(c, land, s0, s1, k);
    const fg = new Map<FarKind, typeof far>();
    for (const f of far) { if (!fg.has(f.k)) fg.set(f.k, []); fg.get(f.k)!.push(f); }
    for (const [kind, list] of fg) {
      const w = c.world.far.includes(kind) ? c.world : c.partner ?? c.world;
      const g = this.cached("f:" + kind, () => farGeometry(kind, w, 0.4));
      const mesh = new THREE.InstancedMesh(g, this.propMat, list.length);
      list.forEach((f, i) => {
        const y = land.heightAt(f.x, f.z);
        dummy.position.set(f.x, Math.min(y, f.y + 30) - 4, f.z); dummy.rotation.set(0, f.rot, 0); dummy.scale.setScalar(f.scale); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.computeBoundingSphere();
      inst.push(mesh); piece.group.add(mesh);
    }
    yield;
    // buoy chains and the static things on the water
    const bm = objects.buoyPiece(buoysFor(c, land, s0, s1));
    if (bm) { inst.push(bm); piece.group.add(bm); }
    const st = objects.staticPiece(s0, s1);
    if (st) { piece.geos.push(st); piece.group.add(new THREE.Mesh(st, objects.material)); }
  }
  /** keep the pieces around the view built (budget: a few ms per frame) and free the ones far behind */
  private stream(sv: number, budgetMs: number) {
    const c = this.course!;
    const kNow = segOf(sv), last = segCount(c) - 1;
    // one piece behind, three ahead (the fog hides anything further)
    const kA = Math.max(0, kNow - 1), kB = Math.min(last, kNow + 3);
    for (const k of this.pieces.keys()) if (k < kA || k > kB + 1) this.dropPiece(k);
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (!this.building) {
        let want = -1;
        for (let k = kNow; k <= kB && want < 0; k++) if (!this.pieces.has(k)) want = k;
        if (want < 0 && kA < kNow && !this.pieces.has(kA)) want = kA;
        if (want < 0) return;
        this.startPiece(want);
      }
      if (this.building!.it.next().done) this.finishPiece();
    }
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.director.portrait = this.h > this.w * 1.1;
    this.fx.setScale(this.h * this.renderer.getPixelRatio() * 0.9);
  }

  /** draw a frame: t = game time, dt = real seconds */
  frame(t: number, dt: number, race: Race, speed01: number, boosting: boolean) {
    const c = this.course!;
    const p = race.player.boat;
    this.director.update(dt, p, speed01, boosting);
    this.director.apply(this.camera);
    // boats
    for (let i = 0; i < this.boats.length && i < race.racers.length; i++) {
      const ra = race.racers[i], b = ra.boat, m = this.boats[i];
      const bob = b.grounded ? Math.sin(t * 2.1 + i * 1.7 + b.x * 0.05) * 0.07 * (0.5 + this.waves) - b.bounce * 0.25 : 0;
      m.group.position.set(b.x, b.y + bob + (ra.boatId === "hover" || ra.boatId === "comet" ? 0.25 : 0) + (ra.boatId === "foil" && b.fwd > 20 && b.grounded ? 0.6 : 0), b.z);
      m.group.rotation.set(-b.pitch - (b.grounded ? Math.sin(t * 1.7 + i) * 0.015 : 0), b.heading, -b.roll, "YXZ");
      m.group.visible = !ra.out || Math.sin(t * 20) > 0;
      if (m.spinner) m.spinner.rotation.z += dt * (8 + 50 * ra.input.throttle);
      m.pilot.rotation.z = b.roll * 1.6;
      m.pilot.rotation.x = -b.pitch * 0.6;
      m.scarf.rotation.x = Math.sin(t * 22 + i) * 0.25 * clamp(b.speed / 20, 0.1, 1) - 0.2;
      m.scarf.rotation.y = Math.sin(t * 13 + i) * 0.2;
      // wake and spray
      const hx = Math.sin(b.heading), hz = Math.cos(b.heading);
      const sx = b.x + hx * m.stern, sz = b.z + hz * m.stern;
      this.wakes?.update(i, dt, sx, b.y, sz, hx, hz, b.speed, m.beam, b.grounded);
      if (b.grounded && b.fwd > 9) {
        const near = Math.abs(b.s - p.s) < 120;
        if (near && this.fx.rnd() < (i === 0 ? 0.95 : 0.45)) {
          const rx = -hz, rz = hx, side = this.fx.rnd() < 0.5 ? -1 : 1, k = Math.min(1, b.fwd / 30);
          this.fx.jet("spray", b.x + hx * 0.6 + rx * side * m.beam, b.y + 0.2, b.z + hz * 0.6 + rz * side * m.beam, rx * side * 4 * k - hx * 2, 3.5 * k, rz * side * 4 * k - hz * 2, 1.5, 1);
        }
      }
      if (b.boostT > 0 && Math.abs(b.s - p.s) < 80) this.fx.jet("flame", sx, b.y + 0.5, sz, -hx * 8, 0.8, -hz * 8, 2, 1, i === 0 ? undefined : "#FF7A2A");
      if (this.shadowsMesh) {
        const gy = b.groundAt(c), hgt = Math.max(0, b.y - gy);
        dummy.position.set(b.x, gy + 0.05, b.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(m.beam * 2.2 * (1 + hgt * 0.06)); dummy.updateMatrix();
        this.shadowsMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    if (this.shadowsMesh) this.shadowsMesh.instanceMatrix.needsUpdate = true;
    this.wakes?.flush();
    this.objects?.update(t, dt, p.s);
    this.stream(p.s, this.quality === "low" ? 1.6 : this.quality === "medium" ? 2.5 : 4);
    if (this.ocean) { this.ocean.position.x = this.camera.position.x; this.ocean.position.z = this.camera.position.z; }
    this.fx.update(dt);
    // storms: lightning now and then
    if (c.world.id === "storm" || c.plan.twist === "storm") {
      this.nextBolt -= dt;
      if (this.nextBolt < 0) { this.flash = 1; this.nextBolt = 5 + Math.random() * 9; this.onThunder?.(); }
    }
    this.flash *= Math.exp(-dt * 7);
    this.sky.update(t, this.camera.position, this.flash * 0.6);
    this.hemi.intensity = (c.mood.hemi * (c.plan.twist === "night" ? 0.45 : 1)) * (1 + this.flash * 2);
    this.weather?.update(dt, t, this.camera.position.x, this.camera.position.y, this.camera.position.z, Math.sin(t * 0.3));
    if (this.mats) {
      this.mats.water.uniforms.uTime.value = t;
      this.mats.falls.uniforms.uTime.value = t;
    }
    if (this.shadows) {
      this.sun.position.set(p.x + this.sunDir.x * 60, p.y + this.sunDir.y * 60, p.z + this.sunDir.z * 60);
      this.sun.target.position.set(p.x, p.y, p.z);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** called on each lightning flash (the game plays thunder) */
  onThunder: (() => void) | null = null;

  dispose() {
    this.gov.dispose();
    this.clearWorld();
    for (const b of this.boats) b.dispose();
    this.wakes?.dispose(); this.fx.dispose(); this.sky.dispose(); this.propMat.dispose();
    if (this.shadowsMesh) { this.shadowsMesh.geometry.dispose(); (this.shadowsMesh.material as THREE.Material).dispose(); }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
