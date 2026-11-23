// Car thumbnails for the garage strip / pickers: one small offscreen renderer draws each car once (3/4 front
// view, studio light) into a cached data URL. Jobs run one per tick so menus stay responsive; the renderer
// is disposed when the queue has been idle for a while (so only one extra WebGL context ever exists).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCarModel } from "../cars/build";
import type { CarSpec } from "../types";

const W = 320, H = 180;
const cache = new Map<string, string>();
const waiting = new Map<string, ((url: string) => void)[]>();
const queue: { key: string; spec: CarSpec; color: string; locked: boolean }[] = [];
let ctx: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; env: THREE.Texture; dark: THREE.MeshStandardMaterial } | null = null;
let busy = false;
let idleTimer = 0;

function setup() {
  if (ctx) return ctx;
  // perf-ok: an offscreen thumbnail renderer at pixel ratio 1
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 5);
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6); rim.position.set(-5, 3, -4);
  scene.add(key, rim, new THREE.HemisphereLight(0xe6eeff, 0x20143a, 0.7));
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
  const dark = new THREE.MeshStandardMaterial({ color: 0x07050f, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.6 });
  ctx = { r, scene, cam, env, dark };
  return ctx;
}

function teardown() {
  if (!ctx || busy || queue.length) return;
  ctx.env.dispose(); ctx.dark.dispose(); ctx.r.dispose(); ctx.r.forceContextLoss?.();
  ctx = null;
}

function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) { clearTimeout(idleTimer); idleTimer = window.setTimeout(teardown, 4000); return; }
  busy = true;
  window.setTimeout(() => {
    let url = "";
    try {
      const c = setup();
      const m = buildCarModel(job.spec, job.color);
      if (job.locked) m.group.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.material = c.dark; });
      m.group.rotation.y = -0.62;
      c.scene.add(m.group);
      const L = m.dims.length, Hh = m.dims.height;
      const dist = L * 1.32 + 1.2;
      c.cam.position.set(Math.sin(0.35) * dist, Hh * 0.9 + L * 0.16, Math.cos(0.35) * dist);
      c.cam.lookAt(0, Hh * 0.42, 0);
      c.r.render(c.scene, c.cam);
      url = c.r.domElement.toDataURL("image/webp", 0.86);
      c.scene.remove(m.group);
      m.dispose();
    } catch { url = ""; }
    cache.set(job.key, url);
    for (const cb of waiting.get(job.key) ?? []) cb(url);
    waiting.delete(job.key);
    busy = false;
    pump();
  }, 0);
}

export function thumbKey(spec: CarSpec, color: string, locked: boolean) { return `${spec.id}|${locked ? "x" : color}`; }
export function cachedThumb(spec: CarSpec, color: string, locked: boolean) { return cache.get(thumbKey(spec, color, locked)); }

/** resolves to a data URL ("" if WebGL is unavailable) */
export function carThumb(spec: CarSpec, color: string, locked: boolean): Promise<string> {
  const key = thumbKey(spec, color, locked);
  const hit = cache.get(key);
  if (hit != null) return Promise.resolve(hit);
  return new Promise((res) => {
    const list = waiting.get(key);
    if (list) { list.push(res); return; }
    waiting.set(key, [res]);
    queue.push({ key, spec, color, locked });
    clearTimeout(idleTimer);
    pump();
  });
}
