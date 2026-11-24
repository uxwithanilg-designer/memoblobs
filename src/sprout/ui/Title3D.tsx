"use client";
// The Sproutpop title in 3D: chunky glossy letters (Lilita One, extruded, clear-coat) in the six bubble colours on a
// leafy green base layer, little seedlings sprouting from the tops of some letters, and iridescent bubbles (a few with
// seedlings inside) floating around them. The
// letters drop in one by one with a bounce, then sway in a gentle wave; now and then one does a jelly squish, the
// whole title leans toward your finger or mouse, and a tap makes the letters hop with a burst of sparkles. Runs only
// while on screen; without WebGL (or if the font can't load) the flat title is shown instead.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { antialiasFor, autoQuality, pixelRatioFor } from "@/lib/perf";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { cdn } from "@/lib/cdn";

const WORD = "SPROUTPOP";
const CANDY = ["#3fd36b", "#3ea8ff", "#ff4f6d", "#ffc531", "#a565ff", "#ff8b2e", "#3fd36b", "#ff4f6d", "#3ea8ff"];

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
    scene.add(new THREE.HemisphereLight(0xf4fff0, 0x7ac06a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 5, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8fc8, 1.4); rim.position.set(4, 2, -4); rim.color.set(0xb8ff9a); scene.add(rim);
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
      const stemGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.28, 6), leafGeo = new THREE.SphereGeometry(1, 12, 8);
      const stemMat = new THREE.MeshStandardMaterial({ color: "#2f8a34", roughness: 0.6 }), leafMat = new THREE.MeshPhysicalMaterial({ color: "#6fe05a", roughness: 0.35, clearcoat: 0.6 });
      disposables.push(stemGeo, leafGeo, stemMat, leafMat);
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
        const ch = WORD[i];
        const g = new THREE.Group();
        const mat = new THREE.MeshPhysicalMaterial({ color: CANDY[i % CANDY.length], roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.3, sheenColor: new THREE.Color("#ffffff") });
        const face = new THREE.Mesh(geo, mat);
        // the leafy base behind each letter: same shape, deep green, a little bigger and lower
        const base = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#1f6a3a", roughness: 0.55 }));
        base.position.set(0.035, -0.07, -0.2); base.scale.set(1.04, 1.04, 1);
        g.add(base, face);
        disposables.push(mat, base.material as THREE.Material, geo);
        // a glossy highlight streak on the face
        face.updateMatrixWorld(true);
        const b = geo.boundingBox!;
        // seedlings sprouting from the top of every other letter (found by casting down onto the letter)
        if (i % 2 === 0 || ch === "O") {
          const px = (b.min.x + b.max.x) / 2 + (Math.random() - 0.5) * 0.1;
          ray.set(new THREE.Vector3(px, 3, 0), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(face, false)[0];
          if (hit) {
            const sp = new THREE.Group();
            const stem = new THREE.Mesh(stemGeo, stemMat); stem.position.y = 0.13; sp.add(stem);
            for (const side of [-1, 1]) { const lf = new THREE.Mesh(leafGeo, leafMat); lf.scale.set(0.17, 0.06, 0.09); lf.position.set(side * 0.13, 0.3, 0); lf.rotation.z = side * 0.5; sp.add(lf); }
            sp.position.set(px, hit.point.y - 0.02, 0);
            sp.rotation.z = (Math.random() - 0.5) * 0.4;
            sp.userData.seed = true;
            g.add(sp);
          }
        }
        g.position.set(x + w / 2, 0, 0);
        root.add(g);
        letters.push({ g, baseX: x + w / 2, delay: 0.15 + i * 0.09, hop: -1, squish: -1 });
        x += w + gap;
      });
      // bubbles from the game, floating around the title (some with a seedling inside)
      const L = -textW / 2, R = textW / 2;
      const sph = new THREE.SphereGeometry(1, 32, 20);
      disposables.push(sph);
      const spots: [number, number, number, number, boolean][] = [
        [2, L + 0.2, 1.7, 0.42, false], [1, L + 1.6, 1.95, 0.32, true], [4, R - 1.5, 1.9, 0.36, false],
        [0, R - 0.1, 1.6, 0.44, true], [3, L + 1.0, -0.85, 0.34, false], [5, R - 0.9, -0.9, 0.38, true],
      ];
      spots.forEach(([ci, px, py, s, sprout], k) => {
        const bm = new THREE.MeshPhysicalMaterial({ color: CANDY[ci + 1] ?? CANDY[ci], roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.7, iridescenceIOR: 1.3, transparent: sprout, opacity: sprout ? 0.55 : 1, depthWrite: !sprout });
        disposables.push(bm);
        const m = new THREE.Mesh(sph, bm);
        m.scale.setScalar(s); m.position.set(px, py, -0.3 - (k % 2) * 0.4);
        if (sprout) {
          const sp = new THREE.Group();
          const stem = new THREE.Mesh(stemGeo, stemMat); stem.scale.setScalar(2.2); stem.position.y = 0.05; sp.add(stem);
          for (const side of [-1, 1]) { const lf = new THREE.Mesh(leafGeo, leafMat); lf.scale.set(0.34, 0.12, 0.18); lf.position.set(side * 0.27, 0.4, 0); lf.rotation.z = side * 0.5; sp.add(lf); }
          sp.position.y = -0.25; m.add(sp); m.renderOrder = 2;
        }
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
        f.m.rotation.z = Math.sin(t * f.sp + f.ph) * 0.15;
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

    new FontLoader().loadAsync(cdn("/fonts/sprout-title.typeface.json"))
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
  return <div ref={host} className="spp-title3d" role="img" aria-label="Sproutpop" />;
}
