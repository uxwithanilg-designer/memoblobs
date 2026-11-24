"use client";
// The Moonvial shelf in 3D (three.js). Same game, same handle as the 2D shelf: a pour lifts the vial over its target,
// tips it and runs a stream across while the levels move, a full vial gets a cork and a sparkle and flies up to the
// star spirit who ordered it.
//   • Vials are turned glass (lathe geometry) with a fresnel glass shader, tipped a little toward you so you see in.
//   • The potion is one mesh per vial with a liquid shader: layers are bands of world height, so when a vial tips the
//     potion stays level (the plane through the axis at the fill length keeps the volume), the back faces seen
//     through the top read as the liquid's surface, and the surface sloshes after a pour.
//   • The stream is a tube along a curve with droplets splashing where it lands; spirits are extruded glowing stars
//     with faces; sparkles are additive points.
// Layout is in CSS pixels on the z = 0 plane (the camera is set so one world unit is one pixel there), so taps use
// the same simple hit test as before. The loop runs at full speed while anything moves and drops to a gentle idle
// rate otherwise.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { LIQUID } from "../stage";
import { SLOTS, corkedCount, type Game, type PVial } from "../play";
import type { ShelfHandle } from "./Shelf";

export type { ShelfHandle };
interface Props { game: Game; selected: number; onTap: (vial: number) => void; glow: string }

const POUR_BASE = 760, FLY_MS = 650, TILT = 0.2;
/** dev only: window.__vialSlow = 8 plays the pour in slow motion (for checking the animation) */
const slow = () => (process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? Number((window as unknown as { __vialSlow?: number }).__vialSlow) || 1 : 1);
const pourMs = () => POUR_BASE * slow();
const MAXL = 6;

// ------------------------------------------------------------------ shaders

const LIQ_VERT = `
varying vec3 vW; varying vec3 vN;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const LIQ_FRAG = `
uniform float uBottom; uniform float uBand; uniform float uLevel; uniform float uTime; uniform float uSlosh; uniform float uFade;
uniform vec3 uCol[${MAXL}]; uniform float uHid[${MAXL}]; uniform vec3 uCam; uniform float uAx;
varying vec3 vW; varying vec3 vN;
void main(){
  float wob = sin(uTime * 4.0 + vW.x * 0.09) * uSlosh + sin(uTime * 2.3 - vW.z * 0.12) * uSlosh * 0.5;
  float lvl = uLevel + wob;
  if (vW.y > lvl) discard;
  float b = clamp(floor((vW.y - uBottom) / uBand), 0.0, ${MAXL - 1}.0);
  vec3 c = uCol[0]; float hid = uHid[0];
  for (int i = 1; i < ${MAXL}; i++) { if (float(i) <= b) { c = uCol[i]; hid = uHid[i]; } }
  if (hid > 0.5) c = vec3(0.17, 0.13, 0.38);
  vec3 V = normalize(uCam - vW);
  vec3 N = normalize(vN);
  float ndv = abs(dot(N, V));
  vec3 col;
  if (gl_FrontFacing) {
    // a glowing core with darker edges, a soft light from the upper left and a rim shine
    col = c * (0.42 + 0.58 * ndv) + c * 0.28;
    col += vec3(1.0) * pow(max(0.0, dot(N, normalize(vec3(-0.6, 0.5, 0.6)))), 12.0) * 0.55;
    col += vec3(1.0) * pow(1.0 - ndv, 3.0) * 0.18;
    // a thin bright seam between layers
    float f = fract((vW.y - uBottom) / uBand);
    col = mix(col, col * 1.18 + 0.05, smoothstep(0.93, 1.0, f) * step(0.5, 1.0 - hid));
  } else {
    // back faces seen through the top: the surface of the potion
    col = mix(c, vec3(1.0), 0.32) + 0.06 * sin(uTime * 3.0 + vW.x * 0.3);
  }
  // the meniscus line
  col = mix(vec3(1.0), col, 0.55 + 0.45 * smoothstep(0.0, 1.6 * uAx, lvl - vW.y));
  gl_FragColor = vec4(col, uFade);
}`;
const GLASS_VERT = `
varying vec3 vW; varying vec3 vN; varying vec3 vL;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const GLASS_FRAG = `
uniform vec3 uCam; uniform float uFade; uniform float uFrost; uniform vec3 uGlow; uniform float uSel; uniform float uR;
varying vec3 vW; varying vec3 vN; varying vec3 vL;
void main(){
  vec3 V = normalize(uCam - vW); vec3 N = normalize(vN);
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 2.2);
  // two vertical highlight strips, like light from a window
  float sx = vL.x / max(1.0, uR);
  float strip = smoothstep(0.08, 0.0, abs(sx + 0.55)) * 0.55 + smoothstep(0.05, 0.0, abs(sx - 0.62)) * 0.25;
  float a = (0.05 + 0.6 * fres + strip * 0.6) * uFade + uFrost * 0.55;
  vec3 col = mix(vec3(0.78, 0.88, 1.0), vec3(1.0), fres) + strip;
  col = mix(col, uGlow, uSel * fres * 0.8);
  col = mix(col, vec3(0.24, 0.2, 0.5), uFrost * 0.8);
  gl_FragColor = vec4(col, min(1.0, a + uSel * fres * 0.35));
}`;

// ------------------------------------------------------------------ shared textures

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = () => canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
const starTex = () => canvasTex(64, 64, (g) => { g.translate(32, 32); g.fillStyle = "#fff"; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = (i * Math.PI) / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); const r = g.createRadialGradient(0, 0, 0, 0, 0, 14); r.addColorStop(0, "#fff"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(-16, -16, 32, 32); });
const qTex = () => canvasTex(64, 64, (g) => { g.fillStyle = "rgba(230,220,255,.95)"; g.font = "bold 46px 'Lilita One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 32, 36); });
const lockTex = (n: number) => canvasTex(96, 112, (g) => {
  g.lineWidth = 10; g.strokeStyle = "#ffe08a"; g.beginPath(); g.arc(48, 42, 24, Math.PI, 0); g.stroke();
  g.fillStyle = "#ffc23d"; g.beginPath(); g.roundRect(14, 40, 68, 60, 12); g.fill();
  g.fillStyle = "#3a2000"; g.font = "bold 44px 'Lilita One', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), 48, 72);
});

// ------------------------------------------------------------------ geometry

/** the outside of a vial, bottom at y = 0, height vh */
function vialProfile(vw: number, vh: number, inset = 0): THREE.Vector2[] {
  const r = vw / 2 - inset, neckH = vw * 0.42, rn = vw * 0.28 - inset * 0.6;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(0.01, Math.cos(a) * r), r + Math.sin(a) * r + inset)); }
  const bodyTop = vh - neckH * 1.2;
  pts.push(new THREE.Vector2(r, bodyTop));
  for (let i = 1; i <= 8; i++) { const t = i / 8; const x = r + (rn - r) * (1 - Math.pow(1 - t, 2)); pts.push(new THREE.Vector2(x, bodyTop + (neckH * 0.6) * t)); }
  pts.push(new THREE.Vector2(rn, vh - inset));
  return pts;
}

interface VialGfx {
  group: THREE.Group; inner: THREE.Group;
  glass: THREE.Mesh<THREE.LatheGeometry, THREE.ShaderMaterial>;
  liquid: THREE.Mesh<THREE.LatheGeometry, THREE.ShaderMaterial>;
  lip: THREE.Mesh; cork: THREE.Mesh; halo: THREE.Sprite;
  qs: THREE.Sprite[]; lock: THREE.Sprite; lockN: number;
  key: string;
  x: number; y: number; lift: number; shake: number; slosh: number; tilt: number;
  fly?: { t0: number; slot: number; x0: number; y0: number };
}
interface Spirit { group: THREE.Group; body: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>; flask: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>; halo: THREE.Sprite; eyes: THREE.Object3D[]; color: number; inAt: number; hop: number; R: number; empty: THREE.Mesh }
interface Spark { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; c: THREE.Color; s: number }
interface Drop { p: THREE.Vector3; v: THREE.Vector3; life: number }
interface PourAnim { a: number; b: number; amount: number; color: number; srcBefore: number; dstBefore: number; t0: number; done: () => void }

export const Shelf = forwardRef<ShelfHandle, Props>(function Shelf3D({ game, selected, onTap, glow }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const props = useRef({ game, selected, glow });
  const api = useRef<ReturnType<typeof makeScene> | null>(null);

  useEffect(() => { props.current = { game, selected, glow }; api.current?.kick(); });

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const s = makeScene(el, () => props.current);
    api.current = s;
    return () => { s.dispose(); api.current = null; };
  }, []);

  // a new stage: forget old positions
  useEffect(() => { if (game.moves === 0) api.current?.reset(); }, [game.moves, game.vials.length, game.colors]);

  useImperativeHandle(ref, () => ({
    pour: (a, b, amount, color, srcBefore, dstBefore) => api.current ? api.current.pour(a, b, amount, color, srcBefore, dstBefore) : Promise.resolve(),
    deliver: (vial, slot, color) => api.current ? api.current.deliver(vial, slot, color) : Promise.resolve(),
    shake: (vial) => api.current?.shake(vial),
    sparkle: (vial, color, big) => api.current?.sparkle(vial, color, big),
    where: (vial) => api.current?.where(vial) ?? null,
  }), []);

  const down = (e: React.PointerEvent) => {
    const s = api.current; if (!s) return;
    const r = host.current!.getBoundingClientRect();
    const hit = s.hit(e.clientX - r.left, e.clientY - r.top);
    if (hit >= 0) { e.preventDefault(); onTap(hit); }
  };
  return <div ref={host} className="mvl-shelf" onPointerDown={down} />;
});

// ------------------------------------------------------------------ the scene

function makeScene(el: HTMLDivElement, get: () => { game: Game; selected: number; glow: string }) {
  const renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(autoQuality()), alpha: true, powerPreference: "high-performance", stencil: false });
  renderer.setPixelRatio(pixelRatioFor(autoQuality()));
  renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "manipulation";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  scene.add(new THREE.HemisphereLight(0xe8e0ff, 0x302060, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-300, 500, 700); scene.add(sun);
  const T = { glow: glowTex(), star: starTex(), q: qTex() };

  let W = 360, H = 600;
  const vials = new Map<number, VialGfx>();
  const geoCache = new Map<string, { glass: THREE.LatheGeometry; liquid: THREE.LatheGeometry; lip: THREE.TorusGeometry; cork: THREE.CylinderGeometry }>();
  const sparks: Spark[] = [];
  const drops: Drop[] = [];
  let pourA: PourAnim | null = null;
  const flying = Array(SLOTS).fill(0);
  let raf = 0, last = 0, idleFrames = 0, disposed = false;

  // shelf planks under each row
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x3a2a6a, roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a1a5a, emissiveIntensity: 0.4 });
  const planks: THREE.Mesh[] = [];

  // sparkles (additive points)
  const SP = 220;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
  spGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
  const spPts = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 16, map: T.star, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  spPts.frustumCulled = false; spPts.renderOrder = 10;
  scene.add(spPts);

  // droplets (instanced)
  const DR = 60;
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.2 });
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), dropMat, DR);
  dropMesh.frustumCulled = false; dropMesh.count = 0; scene.add(dropMesh);

  // the stream
  const streamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.95 });
  let stream: THREE.Mesh | null = null;

  // spirits
  const starShape = (R: number) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.62 : R; const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.95; if (i) s.lineTo(x, y); else s.moveTo(x, y); } s.closePath(); return s; };
  const spirits: Spirit[] = [];
  const buildSpirits = (R: number) => {
    for (const s of spirits) { scene.remove(s.group); s.body.geometry.dispose(); }
    spirits.length = 0;
    for (let k = 0; k < SLOTS; k++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(R), { depth: R * 0.35, bevelEnabled: true, bevelThickness: R * 0.16, bevelSize: R * 0.14, bevelSegments: 4, curveSegments: 4 }), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.35 }));
      body.position.z = -R * 0.18;
      group.add(body);
      const eyes: THREE.Object3D[] = [];
      for (const sx of [-1, 1]) {
        const eye = new THREE.Group();
        const white = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
        white.scale.set(1, 1.2, 0.5);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.2 }));
        pupil.position.set(R * 0.02, -R * 0.01, R * 0.06);
        eye.add(white, pupil);
        eye.position.set(sx * R * 0.24, R * 0.02, R * 0.36);
        group.add(eye); eyes.push(eye);
        const blush = new THREE.Mesh(new THREE.CircleGeometry(R * 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xff7aa8, transparent: true, opacity: 0.6 }));
        blush.position.set(sx * R * 0.42, -R * 0.16, R * 0.34); blush.scale.y = 0.55;
        group.add(blush);
      }
      const smile = new THREE.Mesh(new THREE.TorusGeometry(R * 0.11, R * 0.025, 6, 16, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: 0x1a1030 }));
      smile.rotation.z = Math.PI + Math.PI * 0.1; smile.position.set(0, -R * 0.12, R * 0.37);
      group.add(smile);
      const flask = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.15 }));
      flask.position.set(R * 0.98, -R * 0.45, R * 0.2);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.1, R * 0.12, R * 0.25, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
      neck.position.set(R * 0.98, -R * 0.1, R * 0.2);
      group.add(flask, neck);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(R * 3.6, R * 3.6, 1); halo.position.z = -R * 0.6;
      group.add(halo);
      const empty = new THREE.Mesh(new THREE.RingGeometry(R * 0.7, R * 0.76, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
      scene.add(empty);
      scene.add(group);
      spirits.push({ group, body, flask, halo, eyes, color: -1, inAt: 0, hop: 0, R, empty });
    }
  };
  let spiritR = 0;

  // ------------------------------------------------------------ layout (CSS pixels, y down)
  const layout = () => {
    const g = get().game;
    const shelfV = g.vials.filter((v) => !v.gone);
    const n = Math.max(1, shelfV.length);
    const band = Math.min(150, Math.max(96, H * 0.19));
    const perRow = n <= 5 ? n : n <= 10 ? Math.ceil(n / 2) : Math.ceil(n / 3);
    const rows = Math.ceil(n / perRow);
    const cap = g.vials[0]?.cap ?? 4;
    const availH = H - band - 16;
    let vw = Math.min(66, ((W - 24) / perRow) * 0.62);
    const vhOf = (x: number) => x * 0.42 + x * 0.68 * cap + x * 0.22;
    while (vw > 22 && rows * (vhOf(vw) * 1.26) + (rows - 1) * 8 > availH) vw -= 1;
    const vh = vhOf(vw);
    const rowH = vh * 1.26 + 8;
    const top = band + 12 + Math.max(0, (availH - rows * rowH) / 2) + vh * 0.16;
    const pos = new Map<number, { x: number; y: number }>();
    shelfV.forEach((v, i) => {
      const r = Math.floor(i / perRow), inRow = Math.min(perRow, n - r * perRow), c = i % perRow;
      const gap = (W - 16) / inRow;
      pos.set(v.id, { x: 8 + gap * (c + 0.5), y: top + r * rowH });
    });
    return { band, vw, vh, pos, cap, rows, rowH, top };
  };
  const slotPos = (s: number, band: number) => ({ x: (W / (SLOTS + 1)) * (s + 1), y: band * 0.5 });
  /** CSS pixel (x, y-down) → world on the z = 0 plane */
  const toW = (x: number, y: number) => new THREE.Vector3(x - W / 2, H / 2 - y, 0);

  const geoFor = (vw: number, vh: number) => {
    const key = `${Math.round(vw * 2)}:${Math.round(vh * 2)}`;
    let g = geoCache.get(key);
    if (!g) {
      const glass = new THREE.LatheGeometry(vialProfile(vw, vh), 36);
      const liquid = new THREE.LatheGeometry(vialProfile(vw, vh, Math.max(1.5, vw * 0.06)), 32);
      const lip = new THREE.TorusGeometry(vw * 0.3, Math.max(1.2, vw * 0.05), 8, 32);
      const cork = new THREE.CylinderGeometry(vw * 0.25, vw * 0.21, vw * 0.36, 20);
      g = { glass, liquid, lip, cork };
      geoCache.set(key, g);
    }
    return { ...g, key };
  };

  const makeVial = (v: PVial, vw: number, vh: number): VialGfx => {
    const geo = geoFor(vw, vh);
    const group = new THREE.Group(); const inner = new THREE.Group();
    inner.position.y = -vh / 2; group.add(inner);
    const liquid = new THREE.Mesh(geo.liquid, new THREE.ShaderMaterial({
      vertexShader: LIQ_VERT, fragmentShader: LIQ_FRAG, side: THREE.DoubleSide, transparent: true,
      uniforms: { uBottom: { value: 0 }, uBand: { value: 1 }, uLevel: { value: -1e4 }, uTime: { value: 0 }, uSlosh: { value: 0 }, uFade: { value: 1 }, uCam: { value: new THREE.Vector3() }, uAx: { value: 1 },
        uCol: { value: Array.from({ length: MAXL }, () => new THREE.Color()) }, uHid: { value: new Array(MAXL).fill(0) } },
    }));
    liquid.renderOrder = 1;
    const glass = new THREE.Mesh(geo.glass, new THREE.ShaderMaterial({
      vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, transparent: true, depthWrite: false, side: THREE.FrontSide,
      uniforms: { uCam: { value: new THREE.Vector3() }, uFade: { value: 1 }, uFrost: { value: 0 }, uGlow: { value: new THREE.Color() }, uSel: { value: 0 }, uR: { value: vw / 2 } },
    }));
    glass.renderOrder = 3;
    const lip = new THREE.Mesh(geo.lip, new THREE.MeshStandardMaterial({ color: 0xe8f2ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    lip.rotation.x = Math.PI / 2; lip.position.y = vh; lip.renderOrder = 4;
    const cork = new THREE.Mesh(geo.cork, new THREE.MeshStandardMaterial({ color: 0xc48a52, roughness: 0.8 }));
    cork.position.y = vh + vw * 0.08; cork.visible = false;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(vw * 2.6, vh * 1.5, 1); halo.position.set(0, vh / 2, -vw * 0.8); halo.renderOrder = 0;
    const lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: lockTex(1), transparent: true, depthTest: false }));
    lock.scale.set(vw * 0.62, vw * 0.72, 1); lock.position.set(0, vh * 0.5, vw * 0.6); lock.visible = false; lock.renderOrder = 6;
    inner.add(halo, liquid, glass, lip, cork, lock);
    group.rotation.x = TILT;
    scene.add(group);
    return { group, inner, glass, liquid, lip, cork, halo, qs: [], lock, lockN: 0, key: geo.key, x: 0, y: 0, lift: 0, shake: 0, slosh: 0, tilt: 0 };
  };

  const dropVial = (g: VialGfx) => {
    scene.remove(g.group);
    g.liquid.material.dispose(); g.glass.material.dispose();
    (g.lip.material as THREE.Material).dispose(); (g.cork.material as THREE.Material).dispose();
    g.halo.material.dispose(); g.lock.material.map?.dispose(); g.lock.material.dispose();
    g.qs.forEach((q) => q.material.dispose());
  };

  // ------------------------------------------------------------ per-frame liquid uniforms
  const tmpUp = new THREE.Vector3(), tmpO = new THREE.Vector3();
  const setLiquid = (gx: VialGfx, v: PVial, count: number, pourColor: number, vw: number, now: number) => {
    const u = gx.liquid.material.uniforms;
    const layerH = vw * 0.68;
    const inset = Math.max(1.5, vw * 0.06);
    // the axis in world space: from the inner bottom point upward
    gx.inner.updateWorldMatrix(true, false);
    tmpO.set(0, inset, 0).applyMatrix4(gx.inner.matrixWorld);
    tmpUp.set(0, 1, 0).transformDirection(gx.inner.matrixWorld);
    const cos = Math.max(0.25, tmpUp.y);
    u.uBottom.value = tmpO.y;
    u.uBand.value = layerH * cos;
    u.uLevel.value = count > 0.001 ? tmpO.y + count * layerH * cos : -1e5;
    u.uTime.value = now / 1000;
    u.uSlosh.value = gx.slosh * vw * 0.06;
    u.uAx.value = Math.max(0.6, vw / 40);
    const cols = u.uCol.value as THREE.Color[], hid = u.uHid.value as number[];
    for (let i = 0; i < MAXL; i++) {
      const c = i < v.layers.length ? v.layers[i] : pourColor || v.layers[v.layers.length - 1] || 1;
      cols[i].set(LIQUID[(c - 1 + LIQUID.length) % LIQUID.length][0]);
      hid[i] = i < v.layers.length && v.hidden[i] ? 1 : 0;
    }
  };

  // ------------------------------------------------------------ frame
  const frame = (now: number) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const { game: gm, selected: sel, glow } = get();
    const L = layout();
    let busy = !!pourA || sparks.length > 0 || drops.length > 0;
    const glowC = new THREE.Color(glow);
    const camPos = camera.position;

    // spirits
    const R = Math.min(L.band * 0.28, 34);
    if (Math.abs(R - spiritR) > 0.5) { spiritR = R; buildSpirits(R); }
    spirits.forEach((sp, s) => {
      const want = s < gm.orders.length ? gm.orders[s] ?? 0 : 0;
      if (!flying[s] && sp.color !== want) { sp.color = want; sp.inAt = now; if (want) { const [m, l] = LIQUID[want - 1]; sp.body.material.color.set(l); sp.body.material.emissive.set(m); sp.flask.material.color.set(m); sp.flask.material.emissive.set(m); sp.halo.material.color.set(m); } }
      const p = slotPos(s, L.band), w = toW(p.x, p.y - 4);
      const k = Math.min(1, (now - sp.inAt) / 420), e = 1 - Math.pow(1 - k, 3);
      if (k < 1) busy = true;
      const hop = sp.hop && now - sp.hop < 520 ? Math.sin(((now - sp.hop) / 520) * Math.PI) * R * 0.55 : 0;
      if (hop) busy = true;
      sp.group.visible = !!sp.color && s < gm.orders.length;
      sp.group.position.set(w.x, w.y + Math.sin(now / 520 + s) * R * 0.06 + hop - (1 - e) * R * 2.2, 30);
      sp.group.rotation.y = Math.sin(now / 900 + s * 2) * 0.35;
      sp.group.rotation.z = Math.sin(now / 1100 + s) * 0.06;
      sp.group.scale.setScalar(0.6 + 0.4 * e);
      const blink = Math.sin(now / 1700 + s * 3) > 0.97 ? 0.15 : 1;
      sp.eyes.forEach((ey) => { ey.scale.y = blink; });
      sp.empty.visible = !sp.group.visible && s < gm.orders.length;
      sp.empty.position.set(w.x, w.y, 0);
    });

    // vials: make, move, draw state
    const seen = new Set<number>();
    for (const v of gm.vials) {
      let gx = vials.get(v.id);
      const target = L.pos.get(v.id);
      if (v.gone && !gx?.fly) { if (gx) { dropVial(gx); vials.delete(v.id); } continue; }
      seen.add(v.id);
      const geo = geoFor(L.vw, L.vh);
      if (gx && gx.key !== geo.key && !gx.fly) { dropVial(gx); vials.delete(v.id); gx = undefined; }
      if (!gx) { gx = makeVial(v, L.vw, L.vh); const t = target ?? { x: W / 2, y: H }; gx.x = t.x; gx.y = t.y; vials.set(v.id, gx); }
      if (target && !gx.fly) {
        const dx = target.x - gx.x, dy = target.y - gx.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) { gx.x += dx * Math.min(1, dt * 10); gx.y += dy * Math.min(1, dt * 10); busy = true; } else { gx.x = target.x; gx.y = target.y; }
      }
      const liftTo = v.id === sel ? L.vh * 0.16 : 0;
      if (Math.abs(gx.lift - liftTo) > 0.3) { gx.lift += (liftTo - gx.lift) * Math.min(1, dt * 14); busy = true; } else gx.lift = liftTo;
      if (gx.shake > 0) { gx.shake = Math.max(0, gx.shake - dt); busy = true; }
      if (gx.slosh > 0.01) { gx.slosh *= Math.pow(0.12, dt); busy = true; } else gx.slosh = 0;

      let x = gx.x + (gx.shake ? Math.sin(gx.shake * 60) * 6 * gx.shake * 3 : 0), y = gx.y - gx.lift + L.vh / 2;
      let rotZ = 0, sc = 1, fade = 1, count = v.layers.length, pc = 0;
      if (pourA && v.id === pourA.b) { const f = pourFrac(now, pourA); count = pourA.dstBefore + pourA.amount * f; pc = pourA.color; gx.slosh = Math.max(gx.slosh, f > 0 && f < 1 ? 0.8 : gx.slosh); }
      if (pourA && v.id === pourA.a) {
        const dB = vials.get(pourA.b)!;
        const t = Math.min(1, (now - pourA.t0) / pourMs());
        const side = gx.x <= dB.x ? -1 : 1;
        // park the tipped vial so its mouth sits right above the target's opening: the stream falls in from the top
        const hx = dB.x + side * Math.sin(1.2) * (L.vh / 2), hy = dB.y - dB.lift - L.vw * 0.5 + Math.cos(1.2) * (L.vh / 2);
        const go = t < 0.25 ? easeOut(t / 0.25) : t > 0.8 ? 1 - easeOut((t - 0.8) / 0.2) : 1;
        x = gx.x + (hx - gx.x) * go; y = gx.y + L.vh / 2 - gx.lift * (1 - go) + (hy - gx.y - L.vh / 2) * go;
        rotZ = side * go * 1.2;
        const f = pourFrac(now, pourA);
        count = pourA.srcBefore - pourA.amount * f; pc = pourA.color;
        gx.slosh = Math.max(gx.slosh, 0.5 * go);
        if (t >= 1) { const fin = pourA.done; pourA = null; removeStream(); fin(); }
      }
      if (gx.fly) {
        const k = Math.min(1, (now - gx.fly.t0) / FLY_MS), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const p = slotPos(gx.fly.slot, L.band);
        x = gx.fly.x0 + (p.x - gx.fly.x0) * e; y = gx.fly.y0 + (p.y - gx.fly.y0) * e - Math.sin(k * Math.PI) * 70;
        sc = 1 - 0.6 * e; fade = k > 0.82 ? (1 - k) / 0.18 : 1; rotZ = Math.sin(k * Math.PI) * 0.5;
        busy = true;
      }
      const w = toW(x, y);
      gx.group.position.set(w.x, w.y, gx.fly ? 40 : pourA && v.id === pourA.a ? 2 : v.id === sel ? 20 : 0);
      gx.group.rotation.set(TILT, 0, rotZ);
      gx.group.scale.setScalar(sc);
      // looks
      const lockLeft = Math.max(0, (v.lock ?? 0) - corkedCount(gm));
      setLiquid(gx, v, count, pc, L.vw, now);
      gx.liquid.material.uniforms.uCam.value.copy(camPos);
      gx.liquid.material.uniforms.uFade.value = fade;
      const gu = gx.glass.material.uniforms;
      gu.uCam.value.copy(camPos); gu.uFade.value = fade; gu.uFrost.value = lockLeft ? 1 : 0;
      gu.uSel.value = v.id === sel ? 1 : 0; gu.uGlow.value.copy(glowC);
      gx.halo.material.opacity = (v.id === sel ? 0.55 : 0.14) * fade;
      gx.halo.material.color.copy(v.id === sel ? glowC : new THREE.Color(v.layers.length ? LIQUID[v.layers[v.layers.length - 1] - 1][0] : "#8899ff"));
      gx.cork.visible = v.corked;
      gx.lock.visible = lockLeft > 0;
      if (lockLeft && gx.lockN !== lockLeft) { gx.lock.material.map?.dispose(); gx.lock.material.map = lockTex(lockLeft); gx.lock.material.needsUpdate = true; gx.lockN = lockLeft; }
      // "?" marks on hidden layers
      const want = v.hidden.map((h, i) => (h && i < Math.floor(count) ? i : -1)).filter((i) => i >= 0);
      while (gx.qs.length < want.length) { const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.q, transparent: true, depthTest: false })); q.renderOrder = 5; gx.inner.add(q); gx.qs.push(q); }
      gx.qs.forEach((q, i) => {
        q.visible = i < want.length && !(pourA && v.id === pourA.a);
        if (!q.visible) return;
        const layerH = L.vw * 0.68, inset = Math.max(1.5, L.vw * 0.06);
        q.position.set(0, inset + (want[i] + 0.5) * layerH, L.vw * 0.5);
        q.scale.set(layerH * 0.8, layerH * 0.8, 1);
      });
    }
    for (const [id, gx] of vials) if (!seen.has(id)) { dropVial(gx); vials.delete(id); }

    // planks under the rows
    const wantPlanks = L.rows;
    while (planks.length < wantPlanks) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), plankMat); scene.add(m); planks.push(m); }
    planks.forEach((m, i) => {
      m.visible = i < wantPlanks;
      if (!m.visible) return;
      const y = L.top + i * L.rowH + L.vh + 4, w = toW(W / 2, y);
      m.position.set(w.x, w.y - 4, -L.vw * 0.2); m.scale.set(W - 20, 8, L.vw * 1.3);
    });

    // stream + droplets
    if (pourA) updateStream(now, L);
    if (drops.length) {
      const m = new THREE.Matrix4();
      let n = 0;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life -= dt; d.v.y -= 900 * dt; d.p.addScaledVector(d.v, dt);
        if (d.life <= 0) { drops.splice(i, 1); continue; }
        if (n < DR) { const s = Math.max(0.6, L.vw * 0.05) * Math.min(1, d.life * 3); m.makeScale(s, s, s).setPosition(d.p); dropMesh.setMatrixAt(n++, m); }
      }
      dropMesh.count = n; dropMesh.instanceMatrix.needsUpdate = true;
    } else dropMesh.count = 0;

    // sparkles
    const pa = spGeo.getAttribute("position") as THREE.BufferAttribute, ca = spGeo.getAttribute("color") as THREE.BufferAttribute;
    let n = 0;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.life -= dt; s.v.y -= 160 * dt; s.p.addScaledVector(s.v, dt);
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      if (n < SP) { pa.setXYZ(n, s.p.x, s.p.y, s.p.z); const a = s.life / s.max; ca.setXYZ(n, s.c.r * a, s.c.g * a, s.c.b * a); n++; }
    }
    spGeo.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
    (spPts.material as THREE.PointsMaterial).size = Math.max(10, L.vw * 0.32);

    renderer.render(scene, camera);
    if (sel >= 0) busy = true;
    // full speed while something moves; afterwards a gentle idle rate keeps the spirits alive
    idleFrames = busy ? 0 : idleFrames + 1;
    raf = requestAnimationFrame(busy ? frame : (t) => { if (idleFrames % 3 === 0 || disposed) frame(t); else { idleFrames++; raf = requestAnimationFrame(frame); } });
  };

  const removeStream = () => { if (stream) { scene.remove(stream); stream.geometry.dispose(); stream = null; } };
  const updateStream = (now: number, L: ReturnType<typeof layout>) => {
    const pa = pourA!;
    const t = Math.min(1, (now - pa.t0) / pourMs());
    removeStream();
    if (t < 0.25 || t > 0.84) return;
    const A = vials.get(pa.a), B = vials.get(pa.b);
    if (!A || !B) return;
    A.inner.updateWorldMatrix(true, false); B.inner.updateWorldMatrix(true, false);
    const mouth = new THREE.Vector3(0, L.vh, 0).applyMatrix4(A.inner.matrixWorld);
    const f = pourFrac(now, pa);
    const lvl = B.liquid.material.uniforms.uLevel.value as number;
    const top = new THREE.Vector3(0, L.vh, 0).applyMatrix4(B.inner.matrixWorld);
    const end = new THREE.Vector3(top.x, Math.max(lvl > -1e4 ? lvl : top.y - L.vh, top.y - L.vh * 0.9), top.z);
    // the stream drops from the mouth straight down through the opening to the potion's surface
    end.x = top.x * 0.7 + mouth.x * 0.3; end.z = top.z;
    const curve = new THREE.QuadraticBezierCurve3(mouth, new THREE.Vector3(mouth.x * 0.6 + end.x * 0.4, (mouth.y + top.y) / 2, (mouth.z + top.z) / 2), end);
    const thick = L.vw * 0.075 * (t < 0.3 ? (t - 0.25) / 0.05 : t > 0.78 ? Math.max(0.05, (0.84 - t) / 0.06) : 1) * (1 - f * 0.25);
    stream = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, Math.max(0.8, thick), 8, false), streamMat);
    const [m, l] = LIQUID[pa.color - 1];
    streamMat.color.set(l); streamMat.emissive.set(m);
    dropMat.color.set(l); dropMat.emissive.set(m);
    stream.renderOrder = 2;
    scene.add(stream);
    // droplets splash where the stream lands
    if (Math.random() < 0.8) for (let i = 0; i < 2; i++) drops.push({ p: end.clone().add(new THREE.Vector3(0, 2, L.vw * 0.2)), v: new THREE.Vector3((Math.random() - 0.5) * 140, 80 + Math.random() * 120, (Math.random() - 0.2) * 60), life: 0.35 + Math.random() * 0.2 });
  };

  const burst = (p: THREE.Vector3, color: string, n: number) => {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 170;
      sparks.push({ p: p.clone().add(new THREE.Vector3(0, 0, 30)), v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp + 60, (Math.random() - 0.5) * 80), life: 0.85, max: 0.85, c: Math.random() < 0.35 ? new THREE.Color(1, 1, 1) : c, s: 1 });
    }
    kick();
  };

  const kick = () => { if (!disposed) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } };

  const resize = () => {
    W = el.clientWidth || 360; H = el.clientHeight || 600;
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = `${W}px`; renderer.domElement.style.height = `${H}px`;
    camera.aspect = W / H;
    camera.position.set(0, 0, (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.near = 10; camera.far = camera.position.z * 3;
    camera.updateProjectionMatrix();
    const L = layout();
    for (const [id, p] of L.pos) { const gx = vials.get(id); if (gx && !gx.fly) { gx.x = p.x; gx.y = p.y; } }
    kick();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el); resize();

  return {
    kick,
    reset: () => { for (const gx of vials.values()) dropVial(gx); vials.clear(); spirits.forEach((s) => { s.color = -1; }); kick(); },
    pour: (a: number, b: number, amount: number, color: number, srcBefore: number, dstBefore: number) => new Promise<void>((done) => { pourA = { a, b, amount, color, srcBefore, dstBefore, t0: performance.now(), done }; kick(); }),
    deliver: (vial: number, slot: number, color: number) => new Promise<void>((res) => {
      const gx = vials.get(vial);
      flying[slot]++;
      if (gx) gx.fly = { t0: performance.now(), slot, x0: gx.x, y0: gx.y - gx.lift + layout().vh / 2 };
      kick();
      setTimeout(() => {
        flying[slot]--;
        const sp = spirits[slot]; if (sp) sp.hop = performance.now();
        const L = layout(), p = slotPos(slot, L.band);
        burst(toW(p.x, p.y), LIQUID[color - 1][1], 20);
        if (gx) gx.fly = undefined;
        kick(); res();
      }, FLY_MS);
    }),
    shake: (vial: number) => { const gx = vials.get(vial); if (gx) gx.shake = 0.35; kick(); },
    sparkle: (vial: number, color: number, big?: boolean) => {
      const gx = vials.get(vial); if (!gx) return;
      const L = layout();
      burst(toW(gx.x, gx.y + (big ? 0 : L.vh * 0.3)), LIQUID[color - 1][1], big ? 18 : 9);
    },
    where: (vial: number) => { const gx = vials.get(vial); if (!gx) return null; const r = el.getBoundingClientRect(), L = layout(); return { x: r.left + gx.x, y: r.top + gx.y - gx.lift + L.vh * 0.6 }; },
    hit: (x: number, y: number) => {
      const L = layout();
      let hit = -1, best = 1e9;
      for (const v of get().game.vials) {
        if (v.gone) continue;
        const gx = vials.get(v.id); if (!gx) continue;
        const top = gx.y - gx.lift - L.vw * 0.3, bot = gx.y - gx.lift + L.vh + 8;
        if (x >= gx.x - L.vw * 0.75 && x <= gx.x + L.vw * 0.75 && y >= top - 10 && y <= bot) { const d = Math.abs(x - gx.x); if (d < best) { best = d; hit = v.id; } }
      }
      return hit;
    },
    dispose: () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect();
      for (const gx of vials.values()) dropVial(gx);
      for (const g of geoCache.values()) { g.glass.dispose(); g.liquid.dispose(); g.lip.dispose(); g.cork.dispose(); }
      removeStream();
      Object.values(T).forEach((t) => t.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
function pourFrac(now: number, pa: { t0: number }) {
  const t = (now - pa.t0) / pourMs();
  return Math.min(1, Math.max(0, (t - 0.28) / 0.48));
}
