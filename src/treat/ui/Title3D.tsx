"use client";
// The Treatrio title in 3D: chunky candy letters (Lilita One, extruded, glossy clear-coat) in eight sweet colours on a
// chocolate base layer, sprinkles stuck to their faces, and real treats from the game floating around them. The
// letters drop in one by one with a bounce, then sway in a gentle wave; now and then one does a jelly squish, the
// whole title leans toward your finger or mouse, and a tap makes the letters hop with a burst of sparkles. Runs only
// while on screen; without WebGL (or if the font can't load) the flat title is shown instead.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { cdn } from "@/lib/cdn";
import { treatGeometry } from "./models";

const WORD = "TREATRIO";
const CANDY = ["#ff5fa8", "#2fcf9a", "#ffc23d", "#9a6bff", "#ff8a3d", "#3fa2f5", "#ff4f7a", "#7edc4a"];
const SPRINKLES = ["#ffffff", "#ffe066", "#ff8fc8", "#7fd8ff", "#b8f08a", "#ffffff"];

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
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfff4fb, 0xffb07a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 5, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8fc8, 1.4); rim.position.set(4, 2, -4); scene.add(rim);
    const under = new THREE.PointLight(0xfff0c0, 6, 20); under.position.set(0, -2.5, 3); scene.add(under);

    const root = new THREE.Group(); scene.add(root);
    interface Letter { g: THREE.Group; baseX: number; delay: number; hop: number; squish: number }
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
      const ray = new THREE.Raycaster();
      const shapes = [...WORD].map((ch) => {
        const geo = new TextGeometry(ch, { font, size: 1, height: 0.34, curveSegments: 8, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 4 });
        geo.computeBoundingBox();
        const b = geo.boundingBox!;
        geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -0.17);
        return { geo, w: b.max.x - b.min.x };
      });
      const gap = 0.05;
      textW = shapes.reduce((s, x) => s + x.w, 0) + gap * (shapes.length - 1);
      let x = -textW / 2;
      shapes.forEach(({ geo, w }, i) => {
        const g = new THREE.Group();
        const mat = new THREE.MeshPhysicalMaterial({ color: CANDY[i % CANDY.length], roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color("#ffffff") });
        const face = new THREE.Mesh(geo, mat);
        // the chocolate base behind each letter: same shape, darker, a little bigger and lower
        const choc = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#6b3a22", roughness: 0.55 }));
        choc.position.set(0.035, -0.07, -0.2); choc.scale.set(1.04, 1.04, 1);
        g.add(choc, face);
        // sprinkles that land on the letter's front face only
        face.updateMatrixWorld(true);
        const b = geo.boundingBox!;
        const sprGeo = new THREE.CapsuleGeometry(0.022, 0.09, 3, 6);
        disposables.push(sprGeo, mat, choc.material as THREE.Material, geo);
        for (let k = 0, placed = 0; k < 40 && placed < 6; k++) {
          const px = (Math.random() - 0.5) * (b.max.x - b.min.x) * 0.9, py = 0.08 + Math.random() * 0.85;
          ray.set(new THREE.Vector3(px, py, 2), new THREE.Vector3(0, 0, -1));
          const hit = ray.intersectObject(face, false)[0];
          if (!hit || hit.point.z < 0.2) continue;
          const s = new THREE.Mesh(sprGeo, new THREE.MeshStandardMaterial({ color: SPRINKLES[(k + i) % SPRINKLES.length], roughness: 0.35 }));
          disposables.push(s.material as THREE.Material);
          s.position.set(px, py, hit.point.z + 0.015);
          s.rotation.set(0, 0, Math.random() * Math.PI); // lying flat on the face, any angle
          g.add(s); placed++;
        }
        g.position.set(x + w / 2, 0, 0);
        root.add(g);
        letters.push({ g, baseX: x + w / 2, delay: 0.15 + i * 0.09, hop: -1, squish: -1 });
        x += w + gap;
      });
      // treats from the game, floating around the title
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
      disposables.push(mat);
      // [type, x, y, size, tilt]: above and below the word, never over it
      const L = -textW / 2, R = textW / 2;
      const spots: [number, number, number, number, number][] = [
        [1, L + 0.2, 1.75, 0.95, 0.25], [7, L + 1.5, 1.95, 0.75, -0.3], [6, R - 1.4, 1.85, 0.8, 0.2],
        [3, R - 0.15, 1.65, 0.9, -0.2], [4, L + 0.9, -0.95, 0.75, 0.1], [11, R - 0.9, -0.95, 0.8, -0.25],
      ];
      spots.forEach(([t, px, py, s, r], k) => {
        const m = new THREE.Mesh(treatGeometry(t), mat);
        m.scale.setScalar(s); m.position.set(px, py, -0.3 - (k % 2) * 0.4); m.rotation.z = r;
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
      const needW = textW + 0.6, needH = 3.6;
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dW = needW / 2 / Math.tan(fov / 2) / camera.aspect, dH = needH / 2 / Math.tan(fov / 2);
      camera.position.set(0, 0.9, Math.max(dW, dH));
      camera.lookAt(0, 0.55, 0);
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
        L.g.position.set(L.baseX, drop + wave + hop, 0);
        L.g.rotation.set(-drop * 0.25, 0, (reduce ? 0 : Math.sin(t * 1.6 + i) * 0.035) + (k < 1 ? (1 - k) * (i % 2 ? 0.4 : -0.4) : 0));
        L.g.scale.set(sxz, sy * (k < 0.02 ? 0.01 : 1), sxz);
        L.g.visible = k > 0;
      });
      if (!reduce && letters.length && t > nextSquish) { letters[Math.floor(Math.random() * letters.length)].squish = t; nextSquish = t + 2.5 + Math.random() * 2.5; }
      floaters.forEach((f) => {
        const appear = Math.min(1, Math.max(0, (t - 0.9) / 0.6));
        f.m.position.set(f.base.x, f.base.y + Math.sin(t * f.sp + f.ph) * 0.12 - (1 - appear) * 0.8, f.base.z);
        f.m.rotation.y = t * 0.6 * f.sp + f.ph;
        f.m.visible = appear > 0;
      });
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
      letters.forEach((L, i) => { if (i % 2 === 0) setTimeout(() => burst(new THREE.Vector3(L.baseX, 0.9, 0.4), 8), i * 60); });
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

    new FontLoader().loadAsync(cdn("/fonts/lilita-title.typeface.json"))
      .then((font) => { if (disposed) return; build(font); wake(); })
      .catch(() => { if (!disposed) setFailed(true); });

    return () => {
      disposed = true; cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect(); document.removeEventListener("visibilitychange", onVis);
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown);
      disposables.forEach((d) => d.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  if (failed) return <>{fallback}</>;
  return <div ref={host} className="trt-title3d" role="img" aria-label="Treatrio" />;
}
