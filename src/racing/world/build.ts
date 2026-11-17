// Builds a complete race world for a theme + track: baked sky (clouds, moon, planets, aurora), fog, lights,
// reflections, layered distant backdrops, terrain + water, road surface, kerbs, run-off, barriers, start gantry,
// overhead arches, tunnels, lamps with fake light pools, instanced scenery, grass, god rays and weather.
import * as THREE from "three";
import type { GfxQuality, ThemeSpec, Weather } from "../types";
import type { Track } from "../track";
import { mulberry } from "../track";
import type { ThemeLook, BackdropLayer } from "./themes";
import * as TX from "./textures";
import { buildSky } from "./sky";
import { makeGround, buildTerrain } from "./terrain";
import { buildRoad, buildBarriers, buildOverheads, buildTunnels, buildLamps, pickTunnelRanges, tickProps } from "./roadside";
import { scatterProps, scatterGrass, buildShafts, updateSpinners } from "./scatter";
import { particles, type Particles } from "./weather";
import { PROP_UNIFORMS } from "./props";
import { THEMES } from "./themes";
import { Track as TrackClass } from "../track";

export { fbm } from "./terrain";

export interface World {
  root: THREE.Group;
  sun: THREE.DirectionalLight;
  fog: THREE.Fog;
  background: THREE.Color;
  envMap: THREE.Texture | null;
  night: boolean;
  /** terrain height at x,z (for placing things) */
  heightAt(x: number, z: number): number;
  update(dt: number, focus: THREE.Vector3, camera: THREE.Camera): void;
  dispose(): void;
}

export interface WorldOptions { quality: GfxQuality; night: boolean; weather: Weather }

// dev-only hook so QA scripts can build/profile every world without loading a race
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __nrWorlds?: unknown }).__nrWorlds = { THEMES, Track: TrackClass, build: (...a: Parameters<typeof buildWorld>) => buildWorld(...a), THREE };
}

// ---------------------------------------------------------------- look resolution (forced night/day, weather)
const mixHex = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
const scaleHex = (a: string, k: number) => `#${new THREE.Color(a).multiplyScalar(k).getHexString()}`;

export function resolveLook(theme: ThemeSpec, night: boolean, weather: Weather): ThemeLook {
  const base = theme.look as unknown as ThemeLook;
  let l: ThemeLook = { ...base, sun: { ...base.sun }, ground: { ...base.ground }, road: { ...base.road }, barrier: { ...base.barrier } };
  if (night !== theme.night) {
    const o = night ? base.night : base.day;
    if (o) l = { ...l, ...o };
    else if (night) {
      l = {
        ...l,
        sky: [mixHex("#03060F", theme.accent, 0.06), mixHex("#16213A", base.sky[1], 0.12), "#0A1020"],
        sun: { color: "#AFC4FF", dir: [base.sun.dir[0], Math.max(0.45, base.sun.dir[1]), base.sun.dir[2]], intensity: 0.6, glow: 0.15 },
        hemi: ["#33446E", scaleHex(base.hemi[1], 0.3), 0.6],
        fog: [base.fog[0] * 0.55, base.fog[1] * 0.62],
        stars: !base.underwater, moon: !base.underwater, clouds: (base.clouds ?? 0) * 0.6, cloudColor: "#262C40",
        lamps: base.lamps ?? (base.underwater || base.floating ? undefined : { kind: "street", color: "#FFD08A", every: 46 }),
        shafts: undefined,
      };
    } else {
      l = {
        ...l,
        sky: ["#3A78D0", "#BFD8F0", "#DCE8F4"],
        sun: { color: "#FFF4E0", dir: [base.sun.dir[0], Math.max(0.5, base.sun.dir[1]), base.sun.dir[2]], intensity: 2.5, glow: 0.6 },
        hemi: ["#D6E6FF", base.ground.colors[0], 1.0],
        fog: [base.fog[0] * 1.6, base.fog[1] * 1.5], stars: false, moon: false, aurora: undefined, milkyWay: false, clouds: 0.4, cloudColor: undefined,
      };
    }
  }
  if (weather !== theme.weather) {
    if (weather === "rain") {
      const grey = night ? "#10141C" : "#5E6874";
      l = { ...l, sky: [mixHex(l.sky[0], grey, 0.7), mixHex(l.sky[1], grey, 0.55), mixHex(l.sky[2], grey, 0.6)], sun: { ...l.sun, intensity: l.sun.intensity * 0.4, glow: l.sun.glow * 0.2 }, fog: [l.fog[0] * 0.5, l.fog[1] * 0.55], clouds: 1, cloudColor: night ? "#1A2028" : "#8A929C", hemi: [l.hemi[0], l.hemi[1], l.hemi[2] * 0.85], stars: false, moon: false, milkyWay: false };
    } else if (weather === "snow") {
      const white = night ? "#1A2230" : "#C9D2DC";
      l = { ...l, sky: [mixHex(l.sky[0], white, 0.5), mixHex(l.sky[1], white, 0.5), mixHex(l.sky[2], white, 0.5)], sun: { ...l.sun, intensity: l.sun.intensity * 0.65 }, fog: [l.fog[0] * 0.6, l.fog[1] * 0.6], clouds: 0.9, ground: { ...l.ground, colors: l.ground.colors.map((c) => mixHex(c, "#F2F6FB", 0.65)), verge: mixHex(l.ground.verge ?? l.ground.colors[0], "#F2F6FB", 0.6), snowCaps: true, fields: undefined }, shoulder: mixHex(l.shoulder, "#E8EEF5", 0.5), grass: undefined };
    } else if (weather === "sand") {
      l = { ...l, sky: [mixHex(l.sky[0], "#D9B27A", 0.5), mixHex(l.sky[1], "#E2BE8A", 0.5), mixHex(l.sky[2], "#D9B27A", 0.5)], fog: [l.fog[0] * 0.5, l.fog[1] * 0.55], sun: { ...l.sun, intensity: l.sun.intensity * 0.75 } };
    }
  }
  return l;
}

// ---------------------------------------------------------------- distant backdrop rings
function backdrops(l: ThemeLook, night: boolean, q: GfxQuality, accent: string, cx: number, cz: number, baseY: number) {
  const layers: BackdropLayer[] = l.backdrop ?? [{ kind: "mountains", color: l.ground.mountain, height: 320 * (0.4 + l.ground.hills) }, { kind: "hills", color: l.ground.colors[0], height: 120 }];
  const used = q === "low" ? layers.slice(-1) : layers;
  const hor = new THREE.Color(l.sky[1]);
  const group = new THREE.Group();
  const bottom = l.floating ? baseY - 170 : baseY - 28;
  used.forEach((layer, i) => {
    const idx = layers.indexOf(layer), nL = layers.length;
    const R = 2750 - (idx / Math.max(1, nL - 1)) * 650;
    const glowy = layer.kind === "grid" || layer.kind === "city";
    let c = new THREE.Color(layer.color);
    if (night && !glowy) c.multiplyScalar(0.28);
    const haze = (l.underwater ? 0.55 : 0.18) + (1 - idx / Math.max(1, nL - 1)) * (l.underwater ? 0.3 : 0.32);
    if (layer.kind !== "grid") c = c.lerp(hor, haze);
    const hex = `#${c.getHexString()}`;
    const tex = TX.backdrop(layer, idx, hex, accent, `#${hor.getHexString()}`, night, q === "high");
    tex.repeat.set(idx === 0 ? 2 : 3, 1);
    const H = layer.height * (R / 2000) * 1.15;
    const geo = new THREE.CylinderGeometry(R, R, H, 72, 1, true).translate(cx, bottom + H / 2, cz);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }));
    m.renderOrder = -8 + i; m.frustumCulled = false;
    group.add(m);
    void i;
  });
  return group;
}

// ---------------------------------------------------------------- main
export function buildWorld(theme: ThemeSpec, track: Track, renderer: THREE.WebGLRenderer, o: WorldOptions): World {
  const night = o.night, q = o.quality;
  const l = resolveLook(theme, night, o.weather);
  const texScope = TX.beginTextureScope();
  const t0 = performance.now(), marks: string[] = [];
  const mark = (label: string) => marks.push(`${label} ${(performance.now() - t0).toFixed(0)}`);
  const root = new THREE.Group();
  const rnd = mulberry(track.seed * 31 + 7);

  // ground & height function (spatial grid → O(1) nearest-track lookups)
  const G = makeGround(track, l, q);
  const { cx, cz, baseY } = G;
  mark("ground");

  // sky, fog, lights
  const groundCol = new THREE.Color(l.ground.colors[0]).multiplyScalar(night ? 0.12 : 0.55);
  const sky = buildSky(l, night, renderer, q, groundCol);
  root.add(sky.dome);
  if (sky.aurora) root.add(sky.aurora);
  const horizon = new THREE.Color(l.sky[1]);
  const fog = new THREE.Fog(horizon, l.fog[0], l.fog[1]);
  const hemi = new THREE.HemisphereLight(l.hemi[0], l.hemi[1], l.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(l.sun.color, l.sun.intensity);
  const sunDir = new THREE.Vector3(...l.sun.dir).normalize();
  if (sunDir.y < 0.25) sunDir.y = 0.25; // keep low suns from casting endless shadows
  sunDir.normalize();
  sun.position.copy(sunDir).multiplyScalar(120);
  if (q !== "low") {
    sun.castShadow = true;
    const sz = q === "high" ? 2048 : 1024;
    sun.shadow.mapSize.set(sz, sz);
    const cam = sun.shadow.camera as THREE.OrthographicCamera;
    const e = q === "high" ? 55 : 42;
    cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e; cam.near = 10; cam.far = 320;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  }
  root.add(sun, sun.target);
  mark("sky");

  // distant silhouettes
  root.add(backdrops(l, night, q, theme.accent, cx, cz, baseY));

  // terrain + water
  const terrain = buildTerrain(track, l, G, q, night, theme.accent);
  root.add(terrain.mesh);
  if (terrain.water) root.add(terrain.water);
  mark("terrain");

  // tunnels decide where arches / lamps / props must not go
  const tunnelRanges = l.tunnels ? pickTunnelRanges(track, l.tunnels.count, l.tunnels.length, rnd) : [];
  const avoid: [number, number][] = [[track.length - 40, track.length], [0, 40], ...tunnelRanges];

  // road, kerbs, run-off, start line, gantry, barriers
  root.add(buildRoad(track, l, theme, q, o.weather, night, renderer));
  mark("surface");
  root.add(buildBarriers(track, l, q, night));
  mark("barriers");
  const over = buildOverheads(track, l, night, rnd, avoid);
  if (over) root.add(over);
  if (l.tunnels?.kind === "neon" && tunnelRanges.length) {
    // neon tunnels are a dense run of glowing arches
    const neon = buildOverheads(track, { ...l, overhead: { kind: "neon", every: 9, color: l.overhead?.color ?? theme.accent, color2: l.overhead?.color2 ?? "#FF3FD8" } }, night, () => 0.5, [[0, tunnelRanges[0][0]], [tunnelRanges[0][1], track.length]]);
    if (neon) root.add(neon);
  }
  const tunnels = buildTunnels(track, l, tunnelRanges, q, night);
  if (tunnels) root.add(tunnels);
  const lamps = buildLamps(track, l, night, q, tunnelRanges);
  if (lamps) root.add(lamps);
  mark("road");

  // scenery
  PROP_UNIFORMS.uNight.value = night ? 1 : 0;
  const props = scatterProps(track, l, G, q, night, rnd, tunnelRanges);
  root.add(props.root);
  const grass = scatterGrass(track, l, G, q, rnd, tunnelRanges);
  if (grass) root.add(grass);
  const shafts = buildShafts(track, l, G, q, rnd);
  if (shafts) root.add(shafts);

  // weather + ambient particles
  const fx: Particles[] = [];
  if (o.weather !== "clear") fx.push(particles(o.weather, q, l));
  if (l.ambient && l.ambient !== o.weather && !(l.ambient === "fireflies" && o.weather === "fireflies")) {
    if (l.ambient === "fireflies") { if (night) fx.push(particles("fireflies", q, l)); } else fx.push(particles(l.ambient, q, l));
  }
  for (const p of fx) root.add(p.obj);
  TX.endTextureScope();
  mark("props");
  if (process.env.NODE_ENV !== "production") console.debug(`[world] ${theme.id} ${q}: ${marks.join(" | ")} ms`);

  // lightning for night storms
  const storm = o.weather === "rain";
  let flashT = 6 + Math.random() * 8, flash = 0;
  const hemiBase = l.hemi[2];
  const buf = new THREE.Vector2();
  let t = 0;

  return {
    root, sun, fog, background: horizon, envMap: sky.envMap, night,
    heightAt: G.heightAt,
    update(dt, focus, camera) {
      t += dt;
      sun.position.copy(focus).addScaledVector(sunDir, 120);
      sun.target.position.copy(focus);
      sky.update(dt, focus);
      terrain.update(dt);
      tickProps(dt);
      if (props.spinners.length) updateSpinners(props.spinners, t);
      if (fx.length) {
        renderer.getDrawingBufferSize(buf);
        const fov = (camera as THREE.PerspectiveCamera).fov ?? 60;
        const pixel = buf.y / 2 / Math.tan((fov * Math.PI) / 360);
        for (const p of fx) p.update(dt, camera.position, pixel);
      }
      if (storm) {
        flashT -= dt;
        if (flashT < 0) { flash = 1; flashT = 7 + Math.random() * 12; }
        flash = Math.max(0, flash - dt * 5);
        const k = flash > 0.6 || (flash > 0.2 && flash < 0.35) ? flash : 0;
        hemi.intensity = hemiBase * (1 + k * (night ? 5 : 1.5));
      }
    },
    dispose() {
      root.traverse((ob) => {
        const m = ob as THREE.Mesh;
        if (m.isMesh || (ob as THREE.Points).isPoints || (ob as THREE.LineSegments).isLineSegments) {
          m.geometry?.dispose();
          const mm = m.material;
          (Array.isArray(mm) ? mm : [mm]).forEach((x) => x?.dispose());
          if ((ob as THREE.InstancedMesh).isInstancedMesh) (ob as THREE.InstancedMesh).dispose();
        }
      });
      for (const p of fx) p.dispose();
      sky.dispose();
      TX.releaseTextureScope(texScope);
    },
  };
}
