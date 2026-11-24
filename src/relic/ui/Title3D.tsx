"use client";
// The Bubble Relics title in 3D: "RELICS" in big gold letters carved over a dark stone base, "BUBBLE" above in
// glossy bubble colours, a warm torch light sweeping across the gold, and glossy bubbles and golden relic gems floating
// around. The letters drop in one by one with a bounce, then sway in a gentle wave; now and then one does a squish,
// the whole title leans toward your finger or mouse, and a tap makes the letters hop with a burst of sparkles. Runs
// only while on screen; without WebGL (or if the font can't load) the flat title is shown instead.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { cdn } from "@/lib/cdn";

const TOP = "BUBBLE", WORD = "RELICS";
const CANDY = ["#ff2a3d", "#ffd31a", "#22a6ff", "#36cf4a", "#b24dff", "#ff7a14"];

export function Title3D({ fallback, onTap }: { fallback: React.ReactNode; onTap?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const tapRef = useRef(onTap);
  useEffect(() => { tapRef.current = onTap; }, [onTap]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false, raf = 0, visible = true;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: antialiasFor(autoQuality()), alpha: true, powerPreference: "high-performance" });
    } catch { setTimeout(() => setFailed(true), 0); return; }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(pixelRatioFor(autoQuality()));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "manipulation", cursor: "pointer" });

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2418, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 5, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8fc8, 1.4); rim.position.set(4, 2, -4); rim.color.set(0xff9a3c); scene.add(rim);
    const under = new THREE.PointLight(0xffb060, 9, 20); under.position.set(0, -2.2, 3); scene.add(under);

    const root = new THREE.Group(); scene.add(root);
    interface Letter { g: THREE.Group; baseX: number; baseY: number; delay: number; hop: number; squish: number }
    const letters: Letter[] = [];
    const floaters: { m: THREE.Mesh; base: THREE.Vector3; ph: number; sp: number }[] = [];
    const disposables: { dispose: () => void }[] = [];
    let textW = 6;

    // sparkles for the tap burst
    const SP = 90;
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
    spGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SP * 3), 3));
    const starC = document.createElement("canvas"); starC.width = starC.height = 64;
    { const g = starC.getContext("2d")!; g.translate(32, 32); g.fillStyle = "#fff"; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 30, a = (i * Math.PI) / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
    const starT = new THREE.CanvasTexture(starC);
    const spMat = new THREE.PointsMaterial({ size: 0.28, map: starT, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sparks = new THREE.Points(spGeo, spMat); sparks.frustumCulled = false; scene.add(sparks);
    disposables.push(spGeo, spMat, starT);
    const parts: { p: THREE.Vector3; v: THREE.Vector3; life: number; c: THREE.Color }[] = [];
    const burst = (at: THREE.Vector3, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3.5;
        parts.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s + 2, (Math.random() - 0.3) * 2), life: 0.9, c: new THREE.Color(CANDY[i % CANDY.length]).lerp(new THREE.Color(1, 1, 1), 0.35) });
      }
    };

    const build = (font: Awaited<ReturnType<FontLoader["loadAsync"]>>) => {
      const gold = new THREE.MeshPhysicalMaterial({ color: "#ffc93a", metalness: 0.85, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.1, emissive: "#5a3000", emissiveIntensity: 0.3 });
      const stone = new THREE.MeshStandardMaterial({ color: "#3a2c26", roughness: 0.8 });
      disposables.push(gold, stone);
      const line = (word: string, size: number, y: number, first: number, glossy: boolean) => {
        const shapes = [...word].map((ch) => {
          const geo = new TextGeometry(ch, { font, size, height: size * 0.34, curveSegments: 8, bevelEnabled: true, bevelThickness: size * 0.07, bevelSize: size * 0.05, bevelSegments: 4 });
          geo.computeBoundingBox();
          const b = geo.boundingBox!;
          geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -size * 0.17);
          disposables.push(geo);
          return { geo, w: b.max.x - b.min.x };
        });
        const gap = size * 0.05;
        const lw = shapes.reduce((s2, x2) => s2 + x2.w, 0) + gap * (shapes.length - 1);
        let x = -lw / 2;
        shapes.forEach(({ geo, w }, i) => {
          const g = new THREE.Group();
          const mat = glossy ? new THREE.MeshPhysicalMaterial({ color: CANDY[i % CANDY.length], roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.15 }) : gold;
          if (glossy) disposables.push(mat);
          const face = new THREE.Mesh(geo, mat);
          // the dark stone base behind each letter: same shape, a little bigger and lower
          const base = new THREE.Mesh(geo, stone);
          base.position.set(size * 0.04, -size * 0.08, -size * 0.2); base.scale.set(1.05, 1.05, 1);
          g.add(base, face);
          g.position.set(x + w / 2, y, 0);
          root.add(g);
          letters.push({ g, baseX: x + w / 2, baseY: y, delay: first + i * 0.09, hop: -1, squish: -1 });
          x += w + gap;
        });
        return lw;
      };
      const w1 = line(WORD, 1, 0, 0.55, false);
      line(TOP, 0.52, 1.12, 0.1, true);
      textW = w1;
      // glossy bubbles and golden relic gems floating around the title
      const L = -textW / 2, R = textW / 2;
      const sph = new THREE.SphereGeometry(1, 32, 20), gem = new THREE.OctahedronGeometry(1, 0);
      disposables.push(sph, gem);
      const spots: [number, number, number, number, boolean][] = [
        [0, L - 0.25, 1.55, 0.34, false], [2, L + 0.55, 2.05, 0.24, false], [5, R - 0.35, 2.0, 0.27, false],
        [1, R + 0.2, 1.35, 0.33, false], [3, L + 0.6, -0.65, 0.26, true], [4, R - 0.7, -0.7, 0.3, false],
      ];
      spots.forEach(([ci, px, py, s2, isGem], k) => {
        let m: THREE.Mesh;
        if (isGem) { m = new THREE.Mesh(gem, gold); m.scale.set(s2 * 0.8, s2 * 1.05, s2 * 0.8); }
        else {
          const bm = new THREE.MeshPhysicalMaterial({ color: CANDY[ci], roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.15 });
          disposables.push(bm);
          m = new THREE.Mesh(sph, bm); m.scale.setScalar(s2);
        }
        m.position.set(px, py, -0.3 - (k % 2) * 0.4);
        root.add(m);
        floaters.push({ m, base: m.position.clone(), ph: k * 1.3, sp: 0.8 + (k % 3) * 0.25 });
      });
      fit();
    };

    const fit = () => {
      const w = el.clientWidth || 360, h = el.clientHeight || 160;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // fit the word (plus a little room for the floating treats) to the width, and keep it tall enough
      const needW = textW + 1.2, needH = 3.4;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dW = needW / 2 / Math.tan(fov / 2) / camera.aspect, dH = needH / 2 / Math.tan(fov / 2);
      camera.position.set(0, 0.95, Math.max(dW, dH));
      camera.lookAt(0, 0.7, 0);
      camera.updateProjectionMatrix();
    };

    const t0 = performance.now();
    const tilt = { x: 0, y: 0 };
    let tiltTo = { x: 0, y: 0 }, nextSquish = 3;
    const bounce = (k: number) => { // ease-out bounce
      const n = 7.5625, d = 2.75;
      if (k < 1 / d) return n * k * k;
      if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
      if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
      return n * (k -= 2.625 / d) * k + 0.984375;
    };
    const frame = (now: number) => {
      if (disposed) return;
      raf = 0;
      const t = (now - t0) / 1000;
      letters.forEach((L, i) => {
        const k = Math.min(1, Math.max(0, (t - L.delay) / 0.75));
        const drop = (1 - bounce(k)) * 3.2;
        const wave = reduce ? 0 : Math.sin(t * 2.2 - i * 0.55) * 0.06 * Math.min(1, Math.max(0, t - 1.4));
        let hop = 0;
        if (L.hop >= 0) { const h = (t - L.hop) / 0.5; if (h >= 1) L.hop = -1; else if (h > 0) hop = Math.sin(h * Math.PI) * 0.45; }
        let sy = 1, sxz = 1;
        if (L.squish >= 0) { const q = (t - L.squish) / 0.6; if (q >= 1) L.squish = -1; else { sy = 1 - Math.sin(q * Math.PI * 2) * 0.12 * (1 - q); sxz = 1 + Math.sin(q * Math.PI * 2) * 0.08 * (1 - q); } }
        L.g.position.set(L.baseX, L.baseY + drop + wave + hop, 0);
        L.g.rotation.set(-drop * 0.25, 0, (reduce ? 0 : Math.sin(t * 1.6 + i) * 0.035) + (k < 1 ? (1 - k) * (i % 2 ? 0.4 : -0.4) : 0));
        L.g.scale.set(sxz, sy * (k < 0.02 ? 0.01 : 1), sxz);
        L.g.visible = k > 0;
      });
      if (!reduce && letters.length && t > nextSquish) { letters[Math.floor(Math.random() * letters.length)].squish = t; nextSquish = t + 2.5 + Math.random() * 2.5; }
      floaters.forEach((f) => {
        const appear = Math.min(1, Math.max(0, (t - 0.9) / 0.6));
        f.m.position.set(f.base.x, f.base.y + Math.sin(t * f.sp + f.ph) * 0.12 - (1 - appear) * 0.8, f.base.z);
        f.m.rotation.y = t * 0.7 * f.sp + f.ph;
        f.m.visible = appear > 0;
      });
      under.position.x = Math.sin(t * 0.7) * 4; under.intensity = 8 + Math.sin(t * 11) * 0.6 + Math.sin(t * 17) * 0.4;
      tilt.x += (tiltTo.x - tilt.x) * 0.06; tilt.y += (tiltTo.y - tilt.y) * 0.06;
      root.rotation.set(tilt.y * 0.12, tilt.x * 0.25 + (reduce ? 0 : Math.sin(t * 0.5) * 0.06), 0);
      // sparkles
      const pa = spGeo.getAttribute("position") as THREE.BufferAttribute, ca = spGeo.getAttribute("color") as THREE.BufferAttribute;
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= 1 / 60; p.v.y -= 6 / 60; p.p.addScaledVector(p.v, 1 / 60);
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        if (n < SP) { pa.setXYZ(n, p.p.x, p.p.y, p.p.z); ca.setXYZ(n, p.c.r * p.life, p.c.g * p.life, p.c.b * p.life); n++; }
      }
      spGeo.setDrawRange(0, n); pa.needsUpdate = true; ca.needsUpdate = true;
      renderer.render(scene, camera);
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && !disposed && visible && !document.hidden) raf = requestAnimationFrame(frame); };

    const onMove = (e: PointerEvent) => { const r = el.getBoundingClientRect(); tiltTo = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 }; };
    const onLeave = () => { tiltTo = { x: 0, y: 0 }; };
    const onDown = () => {
      const t = (performance.now() - t0) / 1000;
      letters.forEach((L, i) => { L.hop = t + i * 0.06; });
      letters.forEach((L, i) => { if (i % 2 === 0) setTimeout(() => burst(new THREE.Vector3(L.baseX, L.baseY + 0.6, 0.4), 8), i * 60); });
      tapRef.current?.();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; wake(); });
    io.observe(el);
    const onVis = () => wake();
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => { fit(); wake(); });
    ro.observe(el);

    new FontLoader().loadAsync(cdn("/fonts/relic-title.typeface.json"))
      .then((font) => { if (disposed) return; build(font); wake(); })
      .catch(() => { if (!disposed) setFailed(true); });

    return () => {
      disposed = true; cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown);
      disposables.forEach((d) => d.dispose());
      scene.environment?.dispose(); pmrem.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return <div ref={host} className="rlc-title3d" role="img" aria-label="Bubble Relics" />;
}
