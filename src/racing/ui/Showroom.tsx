"use client";
// 3D garage turntable: studio key/rim lights, a glossy podium with a glowing ring and soft contact shadow,
// slow auto-rotate, drag (mouse or finger) to spin with inertia, a little drop-in when the car changes,
// camera framing that fits any aspect (tall phone cards included). Rendering pauses when hidden.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCarModel } from "../cars/build";
import type { CarSpec } from "../types";
import { isHighway, isMoto, isStreet } from "./kit";
import { pixelRatioFor } from "@/lib/perf";

function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.55, "rgba(0,0,0,0.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** street skin: night asphalt with donut tyre marks */
function streetFloor() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  gr.addColorStop(0, "#2a2a33"); gr.addColorStop(0.6, "#15151b"); gr.addColorStop(1, "#08080b");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.35)"; g.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4); }
  g.lineCap = "round";
  for (const [r, w, a] of [[150, 16, 0.55], [178, 16, 0.5], [118, 10, 0.3]] as const) {
    g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = w;
    g.beginPath(); g.arc(256, 256, r, 0.3, Math.PI * 1.7); g.stroke();
  }
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 3; g.setLineDash([22, 18]);
  g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** highway skin: a patch of motorway — asphalt, yellow edge lines and white lane dashes */
function highwayFloor() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2b2e34"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.3)"; g.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4); }
  g.fillStyle = "#F2C230"; g.fillRect(40, 0, 12, 512); g.fillRect(460, 0, 12, 512);
  g.fillStyle = "rgba(244,241,230,0.9)"; for (let y = 0; y < 512; y += 96) g.fillRect(250, y, 12, 56);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** moto skin: a pit-garage floor — grey epoxy, a white box line and a red-and-white kerb ring */
function motoFloor() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(256, 256, 30, 256, 256, 256); gr.addColorStop(0, "#5a5e66"); gr.addColorStop(1, "#24262b");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  for (let a = 0; a < 32; a++) { g.strokeStyle = a % 2 ? "#E10600" : "#F5F5F7"; g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 232, (a / 32) * Math.PI * 2, ((a + 1) / 32) * Math.PI * 2); g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 6; g.strokeRect(150, 120, 212, 272);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function floorTexture(accent: string) {
  if (isStreet()) return streetFloor();
  if (isMoto()) return motoFloor();
  if (isHighway()) return highwayFloor();
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, "#3a2a6e"); gr.addColorStop(0.6, "#1a1236"); gr.addColorStop(1, "#0d0820");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = accent; g.globalAlpha = 0.18; g.lineWidth = 1;
  for (let r = 30; r < 128; r += 18) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function Showroom({ spec, color, locked = false, className = "", view = "garage", accent = "#7CF2FF" }: {
  spec: CarSpec; color: string; locked?: boolean; className?: string; view?: "garage" | "hero"; accent?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ set: (s: CarSpec, c: string, l: boolean) => void } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch { return; }
    renderer.setPixelRatio(pixelRatioFor("high"));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pm.dispose();
    const cam = new THREE.PerspectiveCamera(view === "hero" ? 28 : 30, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera as THREE.OrthographicCamera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4;
    const street = isStreet(), hwy = isHighway();
    const rim = new THREE.DirectionalLight(street ? new THREE.Color("#2EF2FF") : new THREE.Color(accent).lerp(new THREE.Color("#9fc8ff"), 0.5), street ? 2.2 : 1.8); rim.position.set(-5, 3, -4);
    const fill = new THREE.PointLight(street ? 0xff1f7a : hwy ? 0xff2a3a : 0xff8fd8, street || hwy ? 9 : 6, 12, 2); fill.position.set(-3, 1.2, 3.5);
    if (hwy) { const blue = new THREE.PointLight(0x2a6bff, 9, 12, 2); blue.position.set(3, 1.2, 3.5); scene.add(blue); }
    scene.add(key, rim, fill, new THREE.HemisphereLight(0xdde8ff, 0x1a1030, 0.6));
    const floorTex = floorTexture(accent);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.4, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.35, envMapIntensity: 0.45 }));
    floor.receiveShadow = true; scene.add(floor);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(street ? "#FF1F7A" : hwy ? "#FFC600" : isMoto() ? "#E10600" : accent), transparent: true, opacity: 0.6, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.12, 4.4, 72).rotateX(-Math.PI / 2), ringMat);
    ring.position.y = 0.012; scene.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(3.2, street ? 3.28 : 3.26, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: street ? 0x2ef2ff : 0xffffff, transparent: true, opacity: street ? 0.55 : 0.18, toneMapped: false }));
    ring2.position.y = 0.012; scene.add(ring2);
    const blobTex = blobTexture();
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    blob.position.y = 0.02; scene.add(blob);
    const turn = new THREE.Group(); scene.add(turn);
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0816, roughness: 0.55, metalness: 0.5, envMapIntensity: 0.7 });
    let model: ReturnType<typeof buildCarModel> | null = null;
    let dims = { length: 4.4, width: 1.9, height: 1.4 };
    let drop = 1; // 1 → 0 drop-in animation
    const fit = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1, aspect = w / h;
      const L = dims.length, Hh = dims.height;
      const radius = Math.sqrt(L * L + dims.width * dims.width) / 2 + 0.25;
      const vf = THREE.MathUtils.degToRad(cam.fov) / 2;
      const hf = Math.atan(Math.tan(vf) * aspect);
      const dist = (radius / Math.sin(Math.min(vf * 1.15, hf))) * (view === "hero" ? 0.98 : 1.04);
      const yaw = view === "hero" ? 0.62 : 0.68, el2 = view === "hero" ? 0.2 : 0.3;
      cam.position.set(Math.sin(yaw) * dist * Math.cos(el2), Hh * 0.45 + Math.sin(el2) * dist, Math.cos(yaw) * dist * Math.cos(el2));
      cam.lookAt(0, Hh * (view === "hero" ? 0.36 : 0.42), 0);
    };
    const set = (s: CarSpec, c: string, l: boolean) => {
      if (model) { turn.remove(model.group); model.dispose(); }
      model = buildCarModel(s, c);
      if (l) model.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = darkMat; });
      model.setLights?.(!l);
      turn.add(model.group);
      dims = model.dims;
      blob.scale.set(dims.width * 1.9, 1, dims.length * 1.35);
      drop = 1;
      fit();
    };
    state.current = { set };
    let raf = 0, last = performance.now(), ang = 0.2, vel = 0.35, down = false, lx = 0, visible = true;
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); fit(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; }); io.observe(el);
    const cv = renderer.domElement;
    const onDown = (e: PointerEvent) => { down = true; lx = e.clientX; vel = 0; cv.style.cursor = "grabbing"; };
    const onMove = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - lx; ang += dx * 0.012; vel = dx * 0.7; lx = e.clientX; };
    const onUp = () => { if (!down) return; down = false; cv.style.cursor = "grab"; };
    cv.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      if (!visible || document.hidden) return;
      if (!down) { vel += (0.32 - vel) * dt * 1.4; ang += vel * dt; }
      if (drop > 0) drop = Math.max(0, drop - dt * 2.2);
      const e = drop * drop;
      turn.rotation.y = ang + e * 1.6;
      turn.position.y = e * 0.9;
      ringMat.opacity = 0.45 + Math.sin(now / 480) * 0.15;
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      cv.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
      if (model) model.dispose();
      envTex.dispose(); floorTex.dispose(); blobTex.dispose(); darkMat.dispose(); ringMat.dispose();
      renderer.dispose(); renderer.forceContextLoss?.(); renderer.domElement.remove();
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { state.current?.set(spec, color, locked); }, [spec, color, locked]);
  return <div ref={host} className={className} style={view === "hero" ? { maskImage: "radial-gradient(ellipse 72% 62% at 50% 55%, #000 62%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 72% 62% at 50% 55%, #000 62%, transparent 100%)" } : undefined} />;
}
