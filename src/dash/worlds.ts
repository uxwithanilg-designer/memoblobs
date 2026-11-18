// Momo Dash! world looks: for each of the 12 worlds, its sky and light, road, houses, lamps, near props and far
// landmarks, water (sea, lava, clouds or space), and how its obstacles look. The renderer builds a world from this
// when the run enters it (behind a white flash) — remix worlds take the road and obstacles from one world and the
// scenery and sky from another, with their own time of day.
import * as THREE from "three";
import * as M from "./models";
import * as X from "./models2";
import type { Part } from "./models";
import type { TimeOfDay, WorldId } from "./types";

type G = THREE.BufferGeometry;
export interface Theme {
  sky: [string, string, string]; sun: string; sunDir: [number, number, number];
  fog: string; fogNear: number; fogFar: number;
  hemiSky: string; hemiGround: string; hemiI: number; key: string; keyI: number; rim: string; rimI: number;
  exposure: number; bloom: number; envGlow: string;
  bulbs: string[]; windowGlow: number; stars: boolean;
}
export interface Far { g: G; glow?: G; x: [number, number]; every: number; s: [number, number]; y: number; both?: boolean }
export interface WorldStyle {
  theme: Theme;
  road: { tex: () => THREE.Texture; v: number; rough: number; edge: string; lane: string; dash: boolean; side: () => THREE.Texture; posts?: string; w: number };
  water?: { color: string; glint: string; both: boolean; y: number; rough: number };
  houses: { build: (v: number) => Part[]; both: boolean; walls: string[]; x: number; spacing: number; glow: string };
  lamp: string; strings: boolean;
  near: () => G[];
  far: () => Far[];
  skin: { fence: string; bar: string; block: string; kart: [string, string]; roller: string; tram: string[]; jelly?: boolean; gapLip: string };
  cloud: string; cloudGlow: number;
}

const T = (o: Partial<Theme> & Pick<Theme, "sky" | "fog">): Theme => ({
  sun: "#FFF4D6", sunDir: [0.4, 0.4, -1], fogNear: 70, fogFar: 230, hemiSky: "#EAF6FF", hemiGround: "#8A6A7A", hemiI: 1.0, key: "#FFF1E0", keyI: 2.0,
  rim: "#FFFFFF", rimI: 0.6, exposure: 0.95, bloom: 0.4, envGlow: "#FFFFFF", bulbs: ["#FFE08A", "#FF9FC8", "#9FE6FF", "#FFFFFF"], windowGlow: 0.6, stars: false, ...o,
});

// ------------------------------------------------------------------ road textures
const tex = M.canvasTex;
const tiles = (base: string, line: string, n = 4, jitter = 0) => () => tex(256, 256, (c) => {
  c.fillStyle = line; c.fillRect(0, 0, 256, 256);
  const s = 256 / n;
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
    const off = r % 2 ? s / 2 : 0;
    c.fillStyle = base; c.globalAlpha = 0.85 + ((r * 7 + k * 3) % 5) * 0.03;
    c.fillRect(k * s + off + 3 + (((r + k) * 13) % 5) * jitter, r * s + 3, s - 6, s - 6);
    c.fillRect(k * s + off - 256 + 3, r * s + 3, s - 6, s - 6);
  }
  c.globalAlpha = 1;
});
const speckle = (base: string, dots: string[], n = 300, size = 3) => () => tex(256, 256, (c) => {
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) { c.fillStyle = dots[i % dots.length]; c.globalAlpha = 0.35 + rnd() * 0.5; c.beginPath(); c.arc(rnd() * 256, rnd() * 256, size * (0.4 + rnd()), 0, 7); c.fill(); }
  c.globalAlpha = 1;
});
const grate = (base: string, line: string, glow?: string) => () => tex(256, 256, (c) => {
  c.fillStyle = base; c.fillRect(0, 0, 256, 256);
  c.strokeStyle = line; c.lineWidth = 6;
  for (let i = 0; i <= 256; i += 64) { c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); }
  if (glow) { c.fillStyle = glow; for (let i = 0; i < 4; i++) c.fillRect(20 + i * 64, 30 + (i % 2) * 64, 24, 4); }
});

// ------------------------------------------------------------------ the worlds
const S: Record<WorldId, () => WorldStyle> = {
  pier: () => ({
    theme: T({ sky: ["#1C1956", "#6E4AA6", "#FF9A6A"], sun: "#FFB070", sunDir: [0.55, 0.07, -1], fog: "#B07AA8", hemiSky: "#B9A6FF", hemiGround: "#6A3A4A", hemiI: 1.05, key: "#FFC290", keyI: 2.2, rim: "#8FA8FF", rimI: 1.1, exposure: 1.05, bloom: 0.75, envGlow: "#FFB070", bulbs: ["#FFD58A", "#FF9FC8", "#9FE6FF", "#FFE08A", "#C8A6FF"], windowGlow: 2.2, stars: true }),
    road: { tex: () => M.woodTex("#B06A43", "#5E3420"), v: 3.6, rough: 0.7, edge: "#6E3E26", lane: "#E8C27A", dash: false, side: tiles("#7C78A8", "#5A567E"), posts: "#5E3420", w: 9.6 },
    water: { color: "#2A2F86", glint: "#FFB070", both: false, y: -1.1, rough: 0.22 },
    houses: { build: M.shop, both: false, walls: ["#2FA8B8", "#3D6FD8", "#FF7A6B", "#5FC9A0", "#8F6BE8", "#F2B84B"], x: 5.6, spacing: 7.4, glow: "#FFB050" },
    lamp: "pier", strings: true,
    near: () => [M.bench(), M.barrel(), M.railing(4), M.boat()],
    far: () => { const fw = M.ferris(), lh = M.lighthouse(); return [{ g: fw.g, glow: fw.glow, x: [48, 58], every: 300, s: [1.25, 1.25], y: -1 }, { g: lh.g, glow: lh.glow, x: [85, 85], every: 420, s: [1.4, 1.4], y: -1 }, { g: M.skylineBlock(0), x: [-38, -63], every: 16, s: [1, 2.4], y: -2 }]; },
    skin: { fence: "barrier", bar: "sign", block: "crates", kart: ["#2FB5A8", "#FFFFFF"], roller: "barrel", tram: ["#2FB5A8", "#FF7A6B", "#3D6FD8", "#F2B84B"], gapLip: "#E8C27A" },
    cloud: "#FF9A8A", cloudGlow: 0.35,
  }),
  candy: () => ({
    theme: T({ sky: ["#2E8BFF", "#7CC4FF", "#FFC2E2"], sunDir: [-0.45, 0.42, -1], fog: "#F7C6E6", fogNear: 70, fogFar: 240, hemiSky: "#DCEEFF", hemiGround: "#C9709E", hemiI: 0.85, key: "#FFF1E0", keyI: 1.9, rim: "#FFB3E0", rimI: 0.55, exposure: 0.88, bloom: 0.3, bulbs: ["#FFE08A", "#7FE0D0", "#FF9FC8", "#B9A6FF", "#FFFFFF"], windowGlow: 0.5 }),
    road: { tex: () => M.frostingTex(), v: 2.2, rough: 0.45, edge: "#FFFFFF", lane: "#FFFFFF", dash: true, side: speckle("#9FEBD3", ["#FFFFFF", "#FF9FC8", "#FFE08A", "#B9A6FF"], 70, 2), w: 8.6 },
    houses: { build: M.candyHouse, both: true, walls: ["#C98A55", "#B9774A", "#D99A66", "#C07A4A", "#E0A878", "#B06A40"], x: 5.3, spacing: 7.4, glow: "#FFB050" },
    lamp: "candy", strings: true,
    near: () => [M.lollipop(0), M.lollipop(2), M.gumdrop("#FF5F7E"), M.gumdrop("#7FE0D0")],
    far: () => [{ g: M.cupcakeTower(), x: [32, 54], every: 110, s: [0.9, 1.5], y: -1, both: true }, { g: M.candyMountain("#C9A6FF"), x: [80, 130], every: 150, s: [1, 1.8], y: -2, both: true }],
    skin: { fence: "candy", bar: "arch", block: "gifts", kart: ["#FF5FA2", "#FFE14D"], roller: "gumball", tram: ["#7CFF6B", "#FF5F9E", "#6BB8FF", "#FFB347"], jelly: true, gapLip: "#FFFFFF" },
    cloud: "#FFFFFF", cloudGlow: 0.25,
  }),
  jungle: () => ({
    theme: T({ sky: ["#2E9BE0", "#8ED4F0", "#E6F7D8"], sunDir: [0.4, 0.5, -1], fog: "#BFE3C8", fogNear: 55, fogFar: 200, hemiSky: "#E8FFE8", hemiGround: "#4A7A3A", hemiI: 0.95, key: "#FFF1D6", keyI: 2.1, rim: "#B8FFB8", rimI: 0.5, bloom: 0.3, windowGlow: 0.4 }),
    road: { tex: tiles("#A8A08A", "#6E6A58", 4, 1), v: 3, rough: 0.85, edge: "#6E735E", lane: "#C9C2A6", dash: false, side: speckle("#4FA84A", ["#2E8A38", "#6FC45A", "#FFE08A"], 220, 3), w: 9 },
    houses: { build: X.ruin, both: true, walls: ["#B8B49A", "#A8A48A", "#C2BEA4", "#9DA28C"], x: 5.4, spacing: 8.2, glow: "#FFB050" },
    lamp: "torch", strings: false,
    near: () => [X.crowd.jungleTree().scale(1.6, 1.6, 1.6), X.crowd.fern().scale(1.8, 1.8, 1.8), X.crowd.stoneHead().scale(1.3, 1.3, 1.3), X.crowd.mushroom().scale(2, 2, 2)],
    far: () => [{ g: X.boing.mountain("#5A8A4A", "#7AB85A"), x: [70, 110], every: 140, s: [3, 5], y: -2, both: true }, { g: X.crowd.jungleTree().scale(4, 5, 4), x: [16, 30], every: 18, s: [0.8, 1.4], y: -1, both: true }],
    skin: { fence: "log", bar: "branch", block: "stones", kart: ["#3FA84A", "#FFC23D"], roller: "boulder", tram: ["#8B5A2B", "#3FA84A", "#C98A55", "#6E735E"], gapLip: "#6E735E" },
    cloud: "#FFFFFF", cloudGlow: 0.2,
  }),
  snow: () => ({
    theme: T({ sky: ["#4A8FE0", "#A8D4F5", "#FFE8D6"], sunDir: [-0.5, 0.3, -1], sun: "#FFE8C8", fog: "#DCEBF8", fogNear: 50, fogFar: 200, hemiSky: "#F0F8FF", hemiGround: "#8FB1CC", hemiI: 0.95, key: "#FFF0E0", keyI: 1.9, rim: "#BFE6FF", rimI: 0.6, exposure: 0.88, bloom: 0.35, windowGlow: 1.0 }),
    road: { tex: speckle("#E8F2FA", ["#FFFFFF", "#C8DDF0"], 260, 3), v: 2, rough: 0.6, edge: "#FFFFFF", lane: "#9FC6E8", dash: true, side: speckle("#F4F9FF", ["#FFFFFF", "#DCEBF8"], 160, 4), w: 9 },
    houses: { build: X.chalet, both: true, walls: ["#C98A55", "#B9774A", "#E8504F", "#3D6FD8", "#2FB86B"], x: 5.4, spacing: 7.8, glow: "#FFB050" },
    lamp: "snow", strings: true,
    near: () => [X.crowd.pineTree().scale(2, 2.4, 2), X.crowd.snowman().scale(1.3, 1.3, 1.3), X.crowd.igloo().scale(1.4, 1.4, 1.4), X.crowd.pineTree().scale(1.4, 1.6, 1.4)],
    far: () => [{ g: X.boing.mountain("#8FA8C8", "#FFFFFF"), x: [70, 120], every: 120, s: [3.5, 6], y: -2, both: true }, { g: X.crowd.pineTree().scale(5, 7, 5), x: [18, 34], every: 12, s: [0.7, 1.3], y: -1, both: true }],
    skin: { fence: "snow", bar: "branch", block: "ice", kart: ["#E8504F", "#FFFFFF"], roller: "snowball", tram: ["#E8504F", "#3D6FD8", "#2FB86B", "#FFC23D"], gapLip: "#9FC6E8" },
    cloud: "#FFFFFF", cloudGlow: 0.3,
  }),
  toy: () => ({
    theme: T({ sky: ["#5FA8FF", "#B9DCFF", "#FFF2D8"], sunDir: [0.3, 0.5, -1], fog: "#FFE8D0", hemiSky: "#FFF6E8", hemiGround: "#C98A6A", hemiI: 0.95, key: "#FFF2DD", keyI: 2.0, rim: "#FFD3A8", rimI: 0.6, bloom: 0.3, windowGlow: 0.5 }),
    road: { tex: tiles("#E9E1D2", "#C9BFA8", 4), v: 3, rough: 0.5, edge: "#FFC21A", lane: "#3D8BFF", dash: false, side: tiles("#7FB2FF", "#5A8FE0", 2), w: 9 },
    houses: { build: X.toyHouse, both: true, walls: ["#FF8A8A", "#7FB2FF", "#FFE07A", "#7FE0B5", "#C8A6FF"], x: 5.4, spacing: 7.6, glow: "#FFB050" },
    lamp: "toy", strings: true,
    near: () => [X.crowd.toyBlocks().scale(1.4, 1.4, 1.4), X.crowd.toyBall("#FF5F5F", "#FFFFFF").scale(1.6, 1.6, 1.6), X.crowd.toyBall("#3D8BFF", "#FFC21A").scale(1.2, 1.2, 1.2), X.crowd.toyBlocks()],
    far: () => [{ g: X.crowd.roboGeo().scale(6, 6, 6), x: [45, 70], every: 220, s: [1, 1.4], y: -1, both: true }, { g: X.crowd.toyBlocks().scale(6, 8, 6), x: [28, 50], every: 60, s: [0.8, 1.4], y: -1, both: true }],
    skin: { fence: "candy", bar: "arch", block: "gifts", kart: ["#3D8BFF", "#FFC21A"], roller: "ball", tram: ["#FF5F5F", "#3D8BFF", "#FFC21A", "#2FCB8B"], gapLip: "#FFC21A" },
    cloud: "#FFFFFF", cloudGlow: 0.25,
  }),
  spooky: () => ({
    theme: T({ sky: ["#0E0A26", "#2E1E5A", "#6A3A7A"], sun: "#FFF0C0", sunDir: [0.3, 0.35, -1], fog: "#3A2A5A", fogNear: 40, fogFar: 170, hemiSky: "#8F7BFF", hemiGround: "#2A1A3A", hemiI: 0.75, key: "#B9A6FF", keyI: 1.3, rim: "#FF9A3D", rimI: 1.0, exposure: 1.15, bloom: 0.9, envGlow: "#FF9A3D", bulbs: ["#FF9A3D", "#B58CFF", "#7CFFB2", "#FFE08A"], windowGlow: 2.4, stars: true }),
    road: { tex: tiles("#5A4A7A", "#3A2C55", 5, 1), v: 3, rough: 0.8, edge: "#3A2C55", lane: "#B58CFF", dash: true, side: speckle("#2E2A3A", ["#4A3A5A", "#3A5A3A"], 160, 3), w: 9 },
    houses: { build: X.tent, both: true, walls: ["#5A3E7A", "#4A3A6A", "#6A3E5A", "#3E4A6A"], x: 5.4, spacing: 7.6, glow: "#FF9A3D" },
    lamp: "spooky", strings: true,
    near: () => [X.crowd.pumpkin().scale(1.6, 1.6, 1.6), X.crowd.gravestone().scale(1.4, 1.4, 1.4), X.crowd.deadTree().scale(1.8, 1.8, 1.8), X.crowd.pumpkin()],
    far: () => { const fw = M.ferris(); return [{ g: fw.g, glow: fw.glow, x: [48, 60], every: 260, s: [1.1, 1.1], y: -1 }, { g: X.crowd.deadTree().scale(5, 6, 5), x: [20, 40], every: 22, s: [0.8, 1.3], y: -1, both: true }, { g: X.crowd.castleTower().scale(5, 6, 5), x: [70, 90], every: 300, s: [1, 1.3], y: -1, both: true }]; },
    skin: { fence: "log", bar: "branch", block: "spooky", kart: ["#7A3FCB", "#FF9A3D"], roller: "pumpkin", tram: ["#7A3FCB", "#3A2C8F", "#C2306F", "#2FB5A8"], gapLip: "#B58CFF" },
    cloud: "#5A4A8A", cloudGlow: 0.15,
  }),
  canyon: () => ({
    theme: T({ sky: ["#3A4A9F", "#E07A5A", "#FFC27A"], sun: "#FFB070", sunDir: [0.5, 0.12, -1], fog: "#E8A880", hemiSky: "#FFD8B0", hemiGround: "#9A5A3A", hemiI: 1.0, key: "#FFB070", keyI: 2.2, rim: "#8FA8FF", rimI: 0.8, exposure: 1.0, bloom: 0.5, envGlow: "#FFB070", windowGlow: 1.4 }),
    road: { tex: speckle("#C9884A", ["#A86A3A", "#E0A060", "#8A5A2A"], 260, 3), v: 2.5, rough: 0.9, edge: "#8A5A2A", lane: "#E0A060", dash: true, side: speckle("#D99A5A", ["#B97A4A", "#E8B070"], 200, 3), w: 9 },
    houses: { build: X.adobe, both: true, walls: ["#E0A06A", "#D98A5A", "#E8B880", "#C97A4A"], x: 5.4, spacing: 8, glow: "#FFB050" },
    lamp: "mine", strings: true,
    near: () => [X.cactus(), X.crowd.basaltRock().scale(1.6, 1.6, 1.6), M.barrel(), X.cactus().scale(0.7, 0.8, 0.7)],
    far: () => [{ g: X.mesa("#C9603A"), x: [70, 120], every: 130, s: [0.8, 1.4], y: -2, both: true }, { g: X.cactus().scale(3, 3, 3), x: [18, 36], every: 25, s: [0.8, 1.4], y: -1, both: true }],
    skin: { fence: "log", bar: "sign", block: "crates", kart: ["#C9603A", "#FFD23F"], roller: "boulder", tram: ["#8A5A2A", "#C9603A", "#5A5E6E", "#FFD23F"], gapLip: "#8A5A2A" },
    cloud: "#FFC8A8", cloudGlow: 0.3,
  }),
  neon: () => ({
    theme: T({ sky: ["#060818", "#1A1650", "#5A2A8A"], sun: "#FF3DCB", sunDir: [0, 0.2, -1], fog: "#2A1A5A", fogNear: 50, fogFar: 200, hemiSky: "#5A6AFF", hemiGround: "#1A1030", hemiI: 0.65, key: "#9FB8FF", keyI: 1.3, rim: "#FF3DCB", rimI: 1.4, exposure: 1.15, bloom: 1.0, envGlow: "#FF3DCB", bulbs: ["#3DE0FF", "#FF3DCB", "#FFE14D", "#7CFFB2"], windowGlow: 3.0, stars: true }),
    road: { tex: speckle("#2A2E3A", ["#3A3E4A", "#1E222E"], 220, 2), v: 2, rough: 0.35, edge: "#FF3DCB", lane: "#3DE0FF", dash: true, side: tiles("#3A3E4A", "#24283A", 4), w: 9 },
    houses: { build: X.skyscraper, both: true, walls: ["#3A3E6A", "#2E3A5A", "#4A3A6A", "#2A4A5A"], x: 5.6, spacing: 6.8, glow: "#3DE0FF" },
    lamp: "neon", strings: false,
    near: () => [X.hydrant(), M.barrel(), X.hydrant(), M.bench()],
    far: () => [{ g: M.skylineBlock(0), x: [25, 55], every: 9, s: [1.4, 4], y: -2, both: true }],
    skin: { fence: "barrier", bar: "sign", block: "tech", kart: ["#FF3DCB", "#3DE0FF"], roller: "barrel", tram: ["#3DE0FF", "#FF3DCB", "#FFE14D", "#7CFFB2"], gapLip: "#3DE0FF" },
    cloud: "#3A2A6A", cloudGlow: 0.15,
  }),
  lava: () => ({
    theme: T({ sky: ["#1A0A0A", "#4A1A14", "#C2401F"], sun: "#FF7A1F", sunDir: [0.2, 0.15, -1], fog: "#5A2018", fogNear: 45, fogFar: 180, hemiSky: "#FF9A6A", hemiGround: "#2A0A08", hemiI: 0.8, key: "#FFB080", keyI: 1.6, rim: "#FF5A1F", rimI: 1.2, exposure: 1.1, bloom: 0.9, envGlow: "#FF5A1F", bulbs: ["#FF7A1F", "#FFC23D", "#FF5A1F"], windowGlow: 2.0 }),
    road: { tex: grate("#3A3448", "#24202E", "#FF7A1F"), v: 3, rough: 0.5, edge: "#FF7A1F", lane: "#FFC23D", dash: true, side: speckle("#2E2624", ["#3A302C", "#FF5A1F"], 120, 3), w: 9 },
    water: { color: "#FF4A1A", glint: "#FFD23F", both: true, y: -1.4, rough: 0.6 },
    houses: { build: X.factory, both: true, walls: ["#4A4458", "#5A5468", "#3A3448", "#6E6478"], x: 5.6, spacing: 8, glow: "#FF7A1F" },
    lamp: "lava", strings: false,
    near: () => [X.crowd.basaltRock().scale(1.8, 1.8, 1.8), X.crowd.crystal("#FF7A1F").scale(1.6, 1.6, 1.6), X.pipeStack(), X.crowd.basaltRock()],
    far: () => [{ g: X.boing.volcano(), x: [60, 100], every: 200, s: [6, 9], y: -2, both: true }, { g: X.crowd.basaltRock().scale(8, 10, 8), x: [20, 40], every: 24, s: [0.7, 1.3], y: -2, both: true }],
    skin: { fence: "rock", bar: "pipe", block: "basalt", kart: ["#4A4458", "#FF7A1F"], roller: "boulder", tram: ["#4A4458", "#6E6478", "#3A3448", "#FF7A1F"], gapLip: "#FF7A1F" },
    cloud: "#5A2018", cloudGlow: 0.2,
  }),
  sky: () => ({
    theme: T({ sky: ["#2E8BFF", "#8FD0FF", "#FFFFFF"], sunDir: [0.3, 0.6, -1], fog: "#E8F6FF", fogNear: 70, fogFar: 260, hemiSky: "#FFFFFF", hemiGround: "#9FC6E8", hemiI: 1.0, key: "#FFF4E0", keyI: 2.0, rim: "#FFFFFF", rimI: 0.6, exposure: 0.92, bloom: 0.35, windowGlow: 0.5 }),
    road: { tex: () => M.woodTex("#C98A55", "#7A4A2A"), v: 3.6, rough: 0.75, edge: "#E8C27A", lane: "#7A4A2A", dash: false, side: speckle("#FFFFFF", ["#EAF6FF", "#DCEBF8"], 120, 6), posts: "#E8C27A", w: 8 },
    water: { color: "#FFFFFF", glint: "#FFFFFF", both: true, y: -3, rough: 0.9 },
    houses: { build: X.floatHouse, both: true, walls: ["#FFF4DC", "#FFE0E8", "#E0F0FF", "#E8FFE0"], x: 6.5, spacing: 9, glow: "#FFB050" },
    lamp: "sky", strings: true,
    near: () => [X.windmill(), X.boing.balloon("#FF5F7E"), X.boing.balloon("#3D8BFF"), X.boing.balloon("#FFC21A")],
    far: () => [{ g: X.boing.island("#8B6A4A", "#5CC452", 5).scale(8, 6, 8), x: [40, 90], every: 90, s: [0.8, 1.6], y: 6, both: true }, { g: M.cloudPuff().scale(3, 2, 3), x: [30, 70], every: 40, s: [0.8, 1.6], y: -4, both: true }],
    skin: { fence: "cloud", bar: "arch", block: "hay", kart: ["#FFC21A", "#FFFFFF"], roller: "barrel", tram: ["#FF5F7E", "#3D8BFF", "#FFC21A", "#2FCB8B"], gapLip: "#E8C27A" },
    cloud: "#FFFFFF", cloudGlow: 0.35,
  }),
  space: () => ({
    theme: T({ sky: ["#02020A", "#0E0A30", "#3A1A6A"], sun: "#9F8AFF", sunDir: [-0.3, 0.3, -1], fog: "#1A1040", fogNear: 60, fogFar: 260, hemiSky: "#9F8AFF", hemiGround: "#1A1030", hemiI: 0.75, key: "#E0E8FF", keyI: 1.6, rim: "#3DE0FF", rimI: 1.2, exposure: 1.1, bloom: 0.9, envGlow: "#3DE0FF", bulbs: ["#3DE0FF", "#B58CFF", "#FFFFFF"], windowGlow: 2.2, stars: true }),
    road: { tex: grate("#4A4E6A", "#2A2E4A", "#3DE0FF"), v: 3, rough: 0.35, edge: "#3DE0FF", lane: "#B58CFF", dash: true, side: speckle("#2A2840", ["#3A3858", "#5A5878"], 160, 4), w: 9 },
    water: { color: "#0A0820", glint: "#FFFFFF", both: true, y: -6, rough: 0.9 },
    houses: { build: X.dome, both: true, walls: ["#D9DEEA", "#C8D0E8", "#E0E8F8", "#B8C0D8"], x: 5.8, spacing: 9, glow: "#3DE0FF" },
    lamp: "space", strings: false,
    near: () => [X.crowd.antenna().scale(1.6, 1.6, 1.6), X.crowd.crystal("#B58CFF").scale(1.6, 1.6, 1.6), X.crowd.crystal("#3DE0FF").scale(1.2, 1.2, 1.2), X.crowd.antenna()],
    far: () => [{ g: X.boing.ringPlanet("#B58CFF").scale(8, 8, 8), x: [80, 140], every: 260, s: [1, 2], y: 30, both: true }, { g: X.rocket(), x: [30, 50], every: 150, s: [1, 1.4], y: -1, both: true }],
    skin: { fence: "barrier", bar: "sign", block: "tech", kart: ["#8F6BFF", "#3DE0FF"], roller: "barrel", tram: ["#D9DEEA", "#8F6BFF", "#3DE0FF", "#FF5F7E"], gapLip: "#3DE0FF" },
    cloud: "#2A2060", cloudGlow: 0.15,
  }),
  castle: () => ({
    theme: T({ sky: ["#2A2470", "#9A5AA8", "#FFB070"], sun: "#FFB070", sunDir: [0.5, 0.1, -1], fog: "#C88A9A", hemiSky: "#FFD8C8", hemiGround: "#6A4A5A", hemiI: 0.95, key: "#FFC290", keyI: 2.1, rim: "#9FA8FF", rimI: 0.9, exposure: 1.02, bloom: 0.7, envGlow: "#FFB070", bulbs: ["#FFD58A", "#FF9A3D", "#FFE08A"], windowGlow: 1.8 }),
    road: { tex: tiles("#A89A8A", "#7A6A5A", 5, 1), v: 3, rough: 0.85, edge: "#7A6A5A", lane: "#FFC23D", dash: false, side: speckle("#5A8A4A", ["#4A7A3A", "#6A9A5A"], 160, 3), w: 9 },
    houses: { build: X.castleWall, both: true, walls: ["#B9A99A", "#C8B8A8", "#A8988A", "#D0C0B0"], x: 5.4, spacing: 7.6, glow: "#FFB050" },
    lamp: "castle", strings: true,
    near: () => [X.crowd.banner().scale(1.6, 1.6, 1.6), M.barrel(), X.crowd.castleTower().scale(0.8, 0.8, 0.8), X.crowd.banner()],
    far: () => [{ g: X.crowd.castleTower().scale(8, 10, 8), x: [40, 80], every: 90, s: [0.8, 1.5], y: -1, both: true }, { g: X.boing.mountain("#6A5A7A", "#FFFFFF"), x: [100, 150], every: 160, s: [3, 5], y: -2, both: true }],
    skin: { fence: "rock", bar: "arch", block: "bricks", kart: ["#9F6BFF", "#FFC23D"], roller: "boulder", tram: ["#9F6BFF", "#FFC23D", "#E8504F", "#3D6FD8"], gapLip: "#FFC23D" },
    cloud: "#FFB8A8", cloudGlow: 0.3,
  }),
};
const cache = new Map<WorldId, WorldStyle>();
/** the look of a world (built once; geometries are shared, the renderer must not dispose them) */
export function styleOf(id: WorldId): WorldStyle {
  let s = cache.get(id);
  if (!s) { s = S[id](); cache.set(id, s); }
  return s;
}
/** remix worlds pick their own time of day */
export function withTod(t: Theme, tod: TimeOfDay, native: TimeOfDay): Theme {
  if (tod === native) return t;
  switch (tod) {
    case "day": return { ...t, sky: ["#3FA2FF", "#9ED4FF", "#FFF2E0"], fog: "#DCEEFA", hemiI: Math.max(t.hemiI, 1.0), keyI: Math.max(t.keyI, 2.0), exposure: 0.92, bloom: 0.35, windowGlow: 0.4, stars: false, key: "#FFF1E0", sun: "#FFF4D6", sunDir: [0.4, 0.5, -1] };
    case "morning": return { ...t, sky: ["#6AA8F0", "#FFC8A8", "#FFE8C8"], fog: "#F8DCC8", hemiI: 0.95, keyI: 1.9, exposure: 0.95, bloom: 0.4, windowGlow: 0.8, stars: false, key: "#FFE0C0", sun: "#FFE0B0", sunDir: [-0.5, 0.2, -1] };
    case "sunset": return { ...t, sky: ["#2A2470", "#9A5AA8", "#FF9A6A"], fog: "#C88AA0", hemiI: 1.0, keyI: 2.1, exposure: 1.04, bloom: 0.7, windowGlow: 1.9, stars: true, key: "#FFC290", sun: "#FFB070", sunDir: [0.55, 0.08, -1] };
    case "night": return { ...t, sky: ["#080A24", "#1E1A50", "#4A2A6A"], fog: "#2A2050", fogNear: 45, fogFar: 180, hemiI: 0.65, keyI: 1.2, exposure: 1.15, bloom: 0.95, windowGlow: 2.6, stars: true, key: "#B9C8FF", sun: "#FFF0C0", sunDir: [0.3, 0.35, -1] };
    case "aurora": return { ...t, sky: ["#0A1A3A", "#1A6A6A", "#3A2A6A"], fog: "#1E3A50", fogNear: 50, fogFar: 200, hemiI: 0.7, keyI: 1.3, exposure: 1.12, bloom: 0.95, windowGlow: 2.4, stars: true, key: "#B9FFE8", sun: "#7CFFB2", sunDir: [0, 0.4, -1] };
  }
}
export type { Part };
