// The figures, built from skinned pixel boxes (art/voxel.ts) and posed every frame:
//  - Ace, the hero, in one of six outfits (helmet with a glowing visor, suit, straps, jetpack), and the two squad
//    mates: Juno (a scout with a headset and a ponytail) and Brick (a heavy in a bandana and shades);
//  - the robot army: scouts with one big eye, troopers with visor slits, rolling ball bots, quad-rotor drones, hulking
//    brutes with an arm cannon, lanky snipers with a long lens, four-legged mortar spiders, and the three bosses (a
//    titan walker with missile pods, a hive carrier, the crowned overlord);
//  - each a group of parts (body, head, arms, legs, extras) turned around their joints: walk cycles, aiming, recoil,
//    rotors and wheels, jetpack flames, and a white hit flash. Geometry and skins are made once per kind; each figure
//    gets its own material so it can flash on its own.
import * as THREE from "three";
import type { Outfit } from "../gear";
import type { BossKind, RobotKind } from "../worlds";
import { makeRng, shade } from "../util";
import { Builder, C, pixelTexture, skinBox, skinLayout, type Face, type Rect } from "./voxel";

const SKIN = 64;
type P2 = CanvasRenderingContext2D;

// ---------------------------------------------------------------- painting helpers
function fill(c: P2, r: Rect, col: string) { c.fillStyle = col; c.fillRect(r.x, r.y, r.w, r.h); }
function noise(c: P2, r: Rect, col: string, amt: number, seed: number) {
  const rng = makeRng(seed);
  fill(c, r, col);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const v = rng(); if (v < 0.18) { c.fillStyle = shade(col, -amt); c.fillRect(r.x + x, r.y + y, 1, 1); } else if (v > 0.9) { c.fillStyle = shade(col, amt); c.fillRect(r.x + x, r.y + y, 1, 1); } }
}
function all(c: P2, rects: Record<Face, Rect>, col: string, amt = 0.06, seed = 1) { for (const f of Object.keys(rects) as Face[]) noise(c, rects[f], col, amt, seed + f.length * 7 + f.charCodeAt(1)); }
function row(c: P2, r: Rect, y: number, h: number, col: string) { c.fillStyle = col; c.fillRect(r.x, r.y + y, r.w, h); }
function dot(c: P2, r: Rect, x: number, y: number, w: number, h: number, col: string) { c.fillStyle = col; c.fillRect(r.x + x, r.y + y, w, h); }
function sides(rects: Record<Face, Rect>): Rect[] { return [rects.pz, rects.px, rects.nz, rects.nx]; }

// ---------------------------------------------------------------- humans
// px size and part sizes (pixels): a chunky toy soldier about 1.9 m tall
const HP = 0.07;
const HEAD = [8, 8, 8], BODY = [8, 10, 5], ARM = [3, 10, 3], LEG = [4, 9, 4], PACK = [6, 7, 3];
const L_HEAD = [0, 0], L_BODY = [32, 0], L_ARM = [0, 16], L_LEG = [12, 16], L_PACK = [28, 16];

export type HumanLook = "ace" | "juno" | "brick";

function paintHuman(look: HumanLook, o: Outfit) {
  const cv = document.createElement("canvas"); cv.width = cv.height = SKIN;
  const c = cv.getContext("2d")!;
  const head = skinLayout(L_HEAD[0], L_HEAD[1], HEAD[0], HEAD[1], HEAD[2]);
  const body = skinLayout(L_BODY[0], L_BODY[1], BODY[0], BODY[1], BODY[2]);
  const arm = skinLayout(L_ARM[0], L_ARM[1], ARM[0], ARM[1], ARM[2]);
  const leg = skinLayout(L_LEG[0], L_LEG[1], LEG[0], LEG[1], LEG[2]);
  const pack = skinLayout(L_PACK[0], L_PACK[1], PACK[0], PACK[1], PACK[2]);
  const suit = look === "ace" ? o.suit : look === "juno" ? "#E8ECF4" : "#6A6A3A";
  const trim = look === "ace" ? o.trim : look === "juno" ? "#3EB8E8" : "#C8402A";
  const skin = look === "brick" ? "#8A5A3E" : look === "juno" ? "#F2C9A0" : "#E8B48A";
  // the body: suit, a chest plate, a belt, straps
  all(c, body, suit, 0.07, 11);
  for (const r of sides(body)) row(c, r, 7, 1, shade(suit, -0.35));
  dot(c, body.pz, 1, 1, 6, 4, shade(suit, 0.12)); dot(c, body.pz, 1, 1, 6, 1, shade(suit, 0.3));
  dot(c, body.pz, 3, 2, 2, 2, trim);
  dot(c, body.pz, 0, 6, 8, 1, "#2A2A30"); dot(c, body.pz, 3, 6, 2, 1, "#F2C14E");
  dot(c, body.nz, 1, 0, 1, 7, "#2A2A30"); dot(c, body.nz, 6, 0, 1, 7, "#2A2A30");
  for (const r of [body.px, body.nx]) dot(c, r, 0, 0, r.w, 2, trim);
  fill(c, body.py, shade(suit, 0.1)); fill(c, body.ny, shade(suit, -0.3));
  // arms: sleeves, a trim band, gloves
  all(c, arm, suit, 0.07, 21);
  for (const r of sides(arm)) { row(c, r, 2, 1, trim); row(c, r, 8, 2, "#2A2A30"); }
  fill(c, arm.ny, "#2A2A30");
  // legs: trousers, knee pads, boots
  all(c, leg, shade(suit, -0.12), 0.07, 31);
  for (const r of sides(leg)) { row(c, r, 3, 2, shade(suit, 0.08)); row(c, r, 6, 3, "#2A2A30"); row(c, r, 6, 1, "#4A4A55"); }
  fill(c, leg.ny, "#1E1E24");
  // the jetpack: two tanks and a nozzle plate
  all(c, pack, o.pack, 0.08, 41);
  dot(c, pack.nz, 0, 0, 2, 7, shade(o.pack, 0.15)); dot(c, pack.nz, 4, 0, 2, 7, shade(o.pack, 0.15));
  dot(c, pack.nz, 2, 1, 2, 1, trim); dot(c, pack.nz, 0, 6, 6, 1, "#1E1E24");
  // the head
  if (look === "ace") {
    all(c, head, o.suit, 0.05, 51); // helmet
    fill(c, head.py, shade(o.suit, 0.1)); dot(c, head.py, 3, 0, 2, 8, o.trim);
    for (const r of sides(head)) row(c, r, 0, 1, shade(o.suit, 0.2));
    // the visor band all round the front and sides, then the chin
    dot(c, head.pz, 0, 3, 8, 3, o.visor); dot(c, head.pz, 1, 3, 3, 1, shade(o.visor, 0.6)); dot(c, head.pz, 0, 5, 8, 1, shade(o.visor, -0.3));
    dot(c, head.pz, 1, 6, 6, 2, skin); dot(c, head.pz, 3, 7, 2, 1, shade(skin, -0.3));
    dot(c, head.px, 0, 3, 3, 3, o.visor); dot(c, head.nx, 5, 3, 3, 3, o.visor);
    dot(c, head.px, 4, 4, 2, 2, o.trim); dot(c, head.nx, 2, 4, 2, 2, o.trim);
    fill(c, head.ny, skin);
  } else if (look === "juno") {
    all(c, head, skin, 0.04, 61);
    const hair = "#5A2A1A";
    fill(c, head.py, hair); for (const r of sides(head)) row(c, r, 0, 2, hair);
    dot(c, head.nz, 0, 0, 8, 6, hair); dot(c, head.nz, 3, 6, 2, 2, hair);
    dot(c, head.px, 0, 0, 8, 4, hair); dot(c, head.nx, 0, 0, 8, 4, hair);
    dot(c, head.pz, 1, 3, 2, 2, "#FFFFFF"); dot(c, head.pz, 5, 3, 2, 2, "#FFFFFF"); dot(c, head.pz, 2, 3, 1, 2, "#2A3A6A"); dot(c, head.pz, 5, 3, 1, 2, "#2A3A6A");
    dot(c, head.pz, 3, 6, 2, 1, "#C85A5A");
    dot(c, head.px, 3, 3, 2, 3, "#3A3E52"); dot(c, head.nx, 3, 3, 2, 3, "#3A3E52"); dot(c, head.px, 4, 4, 1, 1, "#3EB8E8");
  } else {
    all(c, head, skin, 0.05, 71);
    const band = "#C8402A";
    fill(c, head.py, band); for (const r of sides(head)) row(c, r, 0, 2, band);
    dot(c, head.nz, 2, 2, 4, 1, band);
    dot(c, head.pz, 0, 3, 8, 2, "#14141C"); dot(c, head.pz, 1, 3, 2, 1, "#5A5A6A"); dot(c, head.pz, 5, 3, 2, 1, "#5A5A6A");
    dot(c, head.pz, 1, 6, 6, 2, "#3A2418"); dot(c, head.pz, 3, 6, 2, 1, "#E8E0D0");
  }
  return cv;
}

// ---------------------------------------------------------------- robots
const RP = 0.075;
const ROBOT_STEEL = "#7A8296", ROBOT_DARK = "#3A3E4E", ROBOT_EYE = "#FF3A3A", ROBOT_TRIM = "#FF8A2A";

interface PartDef { name: string; size: [number, number, number]; uv: [number, number]; at: [number, number, number]; pivot: [number, number, number] }
interface KindDef { px: number; parts: PartDef[]; paint: (c: P2, part: (n: string) => Record<Face, Rect>, elite: boolean) => void }

function panel(c: P2, rects: Record<Face, Rect>, col: string, seed: number) {
  all(c, rects, col, 0.05, seed);
  for (const r of Object.values(rects)) { c.fillStyle = shade(col, 0.22); c.fillRect(r.x, r.y, r.w, 1); c.fillStyle = shade(col, -0.3); c.fillRect(r.x, r.y + r.h - 1, r.w, 1); }
}
function eye(c: P2, r: Rect, x: number, y: number, w: number, h: number, col = ROBOT_EYE) { dot(c, r, x, y, w, h, col); dot(c, r, x, y, Math.max(1, Math.floor(w / 2)), 1, shade(col, 0.6)); }

const KINDS: Record<RobotKind | BossKind | "tower", KindDef> = {
  // the robot beacon: a armoured base and a glowing core column that calls robots in
  tower: {
    px: RP * 2.2, parts: [
      { name: "body", size: [8, 6, 8], uv: [0, 0], at: [0, 0, 0], pivot: [0, 0, 0] },
      { name: "head", size: [4, 9, 4], uv: [32, 0], at: [0, 0.99, 0], pivot: [0, 0, 0] },
    ],
    paint: (c, p) => {
      const b = p("body"); panel(c, b, "#3A3E4E", 40);
      for (const r of [b.pz, b.nz, b.px, b.nx]) { for (let k = 0; k < r.w; k += 2) dot(c, r, k, 0, 1, 1, "#FFD23F"); dot(c, r, 0, 1, r.w, 1, "#1A1A22"); dot(c, r, 2, 3, r.w - 4, 2, "#14141C"); eye(c, r, 3, 3, r.w - 6, 1, "#FF3A6A"); }
      dot(c, b.py, 1, 1, 6, 6, "#2A2D3A");
      const h = p("head"); all(c, h, "#FF3A6A", 0.12, 41);
      for (const r of [h.pz, h.nz, h.px, h.nx]) { for (let y = 1; y < r.h; y += 3) dot(c, r, 0, y, r.w, 1, "#FFD0DC"); dot(c, r, 1, 0, r.w - 2, r.h, "rgba(255,255,255,0.12)"); }
      dot(c, h.py, 0, 0, 4, 4, "#FFE0E8");
    },
  },
  scout: {
    px: RP, parts: [
      { name: "body", size: [6, 6, 4], uv: [0, 0], at: [0, 0.48, 0], pivot: [0, 0, 0] },
      { name: "head", size: [6, 5, 6], uv: [20, 0], at: [0, 0.45, 0], pivot: [0, 0, 0] },
      { name: "armL", size: [2, 5, 2], uv: [0, 12], at: [0.3, 0.42, 0], pivot: [0, 5, 0] },
      { name: "armR", size: [2, 5, 2], uv: [8, 12], at: [-0.3, 0.42, 0], pivot: [0, 5, 0] },
      { name: "legL", size: [2, 6, 2], uv: [16, 12], at: [0.12, 0.48, 0], pivot: [0, 6, 0] },
      { name: "legR", size: [2, 6, 2], uv: [24, 12], at: [-0.12, 0.48, 0], pivot: [0, 6, 0] },
    ],
    paint: (c, p, elite) => {
      const steel = elite ? "#C8A040" : "#9AA4B8";
      panel(c, p("body"), steel, 1); panel(c, p("head"), steel, 2);
      for (const n of ["armL", "armR", "legL", "legR"]) panel(c, p(n), ROBOT_DARK, 3);
      const h = p("head"); dot(c, h.pz, 1, 1, 4, 3, "#14141C"); eye(c, h.pz, 2, 2, 2, 2);
      dot(c, p("body").pz, 2, 2, 2, 2, ROBOT_TRIM);
    },
  },
  trooper: {
    px: RP, parts: [
      { name: "body", size: [8, 9, 5], uv: [0, 0], at: [0, 0.7, 0], pivot: [0, 0, 0] },
      { name: "head", size: [7, 6, 6], uv: [26, 0], at: [0, 0.68, 0], pivot: [0, 0, 0] },
      { name: "armL", size: [3, 9, 3], uv: [0, 14], at: [0.41, 0.62, 0], pivot: [0, 9, 0] },
      { name: "armR", size: [3, 9, 3], uv: [12, 14], at: [-0.41, 0.62, 0], pivot: [0, 9, 0] },
      { name: "legL", size: [3, 9, 3], uv: [24, 14], at: [0.15, 0.7, 0], pivot: [0, 9, 0] },
      { name: "legR", size: [3, 9, 3], uv: [36, 14], at: [-0.15, 0.7, 0], pivot: [0, 9, 0] },
    ],
    paint: (c, p, elite) => {
      const steel = elite ? "#C8A040" : ROBOT_STEEL;
      panel(c, p("body"), steel, 4); panel(c, p("head"), steel, 5);
      for (const n of ["armL", "armR"]) panel(c, p(n), shade(steel, -0.15), 6);
      for (const n of ["legL", "legR"]) panel(c, p(n), ROBOT_DARK, 7);
      const h = p("head"); dot(c, h.pz, 0, 2, 7, 2, "#14141C"); eye(c, h.pz, 1, 2, 2, 1); eye(c, h.pz, 4, 2, 2, 1);
      const b = p("body"); dot(c, b.pz, 2, 2, 4, 3, ROBOT_DARK); dot(c, b.pz, 3, 3, 2, 1, ROBOT_TRIM); dot(c, b.pz, 0, 7, 8, 1, ROBOT_TRIM);
    },
  },
  roller: {
    px: RP, parts: [
      { name: "body", size: [8, 8, 8], uv: [0, 0], at: [0, 0.3, 0], pivot: [0, 4, 0] },
      { name: "head", size: [4, 3, 4], uv: [32, 0], at: [0, 0.6, 0], pivot: [0, 0, 0] },
    ],
    paint: (c, p, elite) => {
      const b = p("body");
      panel(c, b, elite ? "#C8A040" : "#5A606E", 8);
      for (const r of Object.values(b)) { dot(c, r, 0, 3, r.w, 2, ROBOT_TRIM); dot(c, r, 3, 0, 2, r.h, ROBOT_DARK); }
      const h = p("head"); panel(c, h, ROBOT_DARK, 9); eye(c, h.pz, 1, 1, 2, 1);
    },
  },
  drone: {
    px: RP, parts: [
      { name: "body", size: [8, 4, 8], uv: [0, 0], at: [0, 0, 0], pivot: [0, 2, 0] },
      { name: "head", size: [4, 3, 3], uv: [32, 0], at: [0, -0.18, 0.28], pivot: [0, 0, 0] },
    ],
    paint: (c, p, elite) => {
      const b = p("body"); panel(c, b, elite ? "#C8A040" : "#8A92A6", 10);
      dot(c, b.py, 3, 0, 2, 8, ROBOT_TRIM); dot(c, b.py, 0, 3, 8, 2, ROBOT_TRIM);
      const h = p("head"); panel(c, h, ROBOT_DARK, 11); eye(c, h.pz, 1, 1, 2, 1);
    },
  },
  brute: {
    px: RP, parts: [
      { name: "body", size: [12, 10, 8], uv: [0, 0], at: [0, 0.6, 0], pivot: [0, 0, 0] },
      { name: "head", size: [6, 5, 6], uv: [40, 0], at: [0, 0.72, 0.05], pivot: [0, 0, 0] },
      { name: "armL", size: [5, 10, 5], uv: [0, 18], at: [0.64, 0.62, 0], pivot: [0, 10, 0] },
      { name: "armR", size: [5, 10, 5], uv: [20, 18], at: [-0.64, 0.62, 0], pivot: [0, 10, 0] },
      { name: "legL", size: [5, 8, 5], uv: [40, 18], at: [0.24, 0.6, 0], pivot: [0, 8, 0] },
      { name: "legR", size: [5, 8, 5], uv: [40, 36], at: [-0.24, 0.6, 0], pivot: [0, 8, 0] },
    ],
    paint: (c, p, elite) => {
      const steel = elite ? "#C8A040" : "#6A7086";
      panel(c, p("body"), steel, 12); panel(c, p("head"), shade(steel, -0.1), 13);
      for (const n of ["armL", "armR"]) panel(c, p(n), shade(steel, -0.1), 14);
      for (const n of ["legL", "legR"]) panel(c, p(n), ROBOT_DARK, 15);
      const b = p("body"); dot(c, b.pz, 1, 1, 10, 3, ROBOT_TRIM); dot(c, b.pz, 2, 2, 8, 1, "#1A1A22"); dot(c, b.pz, 4, 6, 4, 3, "#2A2D3A"); eye(c, b.pz, 5, 7, 2, 1, "#FFB03A");
      const h = p("head"); dot(c, h.pz, 1, 2, 4, 1, "#14141C"); eye(c, h.pz, 1, 2, 4, 1);
    },
  },
  sniper: {
    px: RP, parts: [
      { name: "body", size: [6, 10, 4], uv: [0, 0], at: [0, 0.9, 0], pivot: [0, 0, 0] },
      { name: "head", size: [5, 5, 5], uv: [20, 0], at: [0, 0.75, 0], pivot: [0, 0, 0] },
      { name: "armL", size: [2, 9, 2], uv: [0, 14], at: [0.3, 0.7, 0], pivot: [0, 9, 0] },
      { name: "armR", size: [2, 9, 2], uv: [8, 14], at: [-0.3, 0.7, 0], pivot: [0, 9, 0] },
      { name: "legL", size: [2, 12, 2], uv: [16, 14], at: [0.12, 0.9, 0], pivot: [0, 12, 0] },
      { name: "legR", size: [2, 12, 2], uv: [24, 14], at: [-0.12, 0.9, 0], pivot: [0, 12, 0] },
    ],
    paint: (c, p, elite) => {
      const steel = elite ? "#C8A040" : "#4A5A6A";
      panel(c, p("body"), steel, 16); panel(c, p("head"), ROBOT_DARK, 17);
      for (const n of ["armL", "armR", "legL", "legR"]) panel(c, p(n), shade(steel, -0.2), 18);
      const h = p("head"); dot(c, h.pz, 1, 1, 3, 3, "#14141C"); eye(c, h.pz, 2, 2, 1, 1, "#FF5AF0");
      dot(c, p("body").pz, 2, 1, 2, 6, "#5AF0FF");
    },
  },
  spider: {
    px: RP, parts: [
      { name: "body", size: [10, 5, 10], uv: [0, 0], at: [0, 0.62, 0], pivot: [0, 0, 0] },
      { name: "head", size: [4, 4, 4], uv: [40, 0], at: [0, 0.36, 0], pivot: [0, 0, 0] },
      { name: "legL", size: [2, 9, 2], uv: [0, 16], at: [0.42, 0.66, 0.36], pivot: [0, 9, 0] },
      { name: "legR", size: [2, 9, 2], uv: [8, 16], at: [-0.42, 0.66, 0.36], pivot: [0, 9, 0] },
      { name: "legL2", size: [2, 9, 2], uv: [16, 16], at: [0.42, 0.66, -0.36], pivot: [0, 9, 0] },
      { name: "legR2", size: [2, 9, 2], uv: [24, 16], at: [-0.42, 0.66, -0.36], pivot: [0, 9, 0] },
    ],
    paint: (c, p, elite) => {
      const b = p("body"); panel(c, b, elite ? "#C8A040" : "#5A6A5A", 19);
      dot(c, b.py, 2, 2, 6, 6, ROBOT_DARK); dot(c, b.py, 4, 4, 2, 2, ROBOT_TRIM);
      eye(c, b.pz, 2, 1, 2, 1); eye(c, b.pz, 6, 1, 2, 1);
      panel(c, p("head"), ROBOT_DARK, 20); dot(c, p("head").py, 1, 1, 2, 2, "#14141C");
      for (const n of ["legL", "legR", "legL2", "legR2"]) panel(c, p(n), ROBOT_DARK, 21);
    },
  },
  titan: {
    px: RP * 2.2, parts: [
      { name: "body", size: [12, 10, 8], uv: [0, 0], at: [0, 1.25, 0], pivot: [0, 0, 0] },
      { name: "head", size: [6, 5, 6], uv: [40, 0], at: [0, 1.5, 0.1], pivot: [0, 0, 0] },
      { name: "armL", size: [5, 10, 5], uv: [0, 18], at: [1.4, 1.3, 0], pivot: [0, 10, 0] },
      { name: "armR", size: [5, 10, 5], uv: [20, 18], at: [-1.4, 1.3, 0], pivot: [0, 10, 0] },
      { name: "legL", size: [5, 8, 5], uv: [40, 18], at: [0.5, 1.25, 0], pivot: [0, 8, 0] },
      { name: "legR", size: [5, 8, 5], uv: [40, 36], at: [-0.5, 1.25, 0], pivot: [0, 8, 0] },
    ],
    paint: (c, p) => {
      panel(c, p("body"), "#5A6070", 22); panel(c, p("head"), "#4A5060", 23);
      for (const n of ["armL", "armR"]) panel(c, p(n), "#5A6070", 24);
      for (const n of ["legL", "legR"]) panel(c, p(n), ROBOT_DARK, 25);
      const b = p("body"); dot(c, b.pz, 0, 0, 12, 2, "#FFD23F"); for (let k = 0; k < 12; k += 3) dot(c, b.pz, k, 0, 1, 2, "#1A1A22");
      dot(c, b.pz, 3, 4, 6, 4, "#2A2D3A"); eye(c, b.pz, 4, 5, 4, 2, "#FF3A3A");
      const h = p("head"); dot(c, h.pz, 0, 2, 6, 2, "#14141C"); eye(c, h.pz, 1, 2, 4, 1);
    },
  },
  carrier: {
    px: RP * 2.6, parts: [
      { name: "body", size: [14, 6, 12], uv: [0, 0], at: [0, 0, 0], pivot: [0, 3, 0] },
      { name: "head", size: [6, 4, 4], uv: [0, 18], at: [0, -0.5, 1.2], pivot: [0, 0, 0] },
    ],
    paint: (c, p) => {
      const b = p("body"); panel(c, b, "#6A7086", 26);
      dot(c, b.ny, 3, 3, 8, 6, "#14141C"); dot(c, b.ny, 4, 4, 6, 4, "#FF8A2A");
      for (const r of [b.pz, b.nz, b.px, b.nx]) { dot(c, r, 0, 2, r.w, 1, ROBOT_TRIM); }
      const h = p("head"); panel(c, h, ROBOT_DARK, 27); eye(c, h.pz, 1, 1, 4, 2);
    },
  },
  overlord: {
    px: RP * 2.6, parts: [
      { name: "body", size: [8, 9, 5], uv: [0, 0], at: [0, 1.75, 0], pivot: [0, 0, 0] },
      { name: "head", size: [7, 6, 6], uv: [26, 0], at: [0, 1.7, 0], pivot: [0, 0, 0] },
      { name: "armL", size: [3, 9, 3], uv: [0, 14], at: [1.05, 1.55, 0], pivot: [0, 9, 0] },
      { name: "armR", size: [3, 9, 3], uv: [12, 14], at: [-1.05, 1.55, 0], pivot: [0, 9, 0] },
      { name: "legL", size: [3, 9, 3], uv: [24, 14], at: [0.38, 1.75, 0], pivot: [0, 9, 0] },
      { name: "legR", size: [3, 9, 3], uv: [36, 14], at: [-0.38, 1.75, 0], pivot: [0, 9, 0] },
    ],
    paint: (c, p) => {
      const gold = "#E8B030", dark = "#2A2030";
      panel(c, p("body"), dark, 28); panel(c, p("head"), dark, 29);
      for (const n of ["armL", "armR"]) panel(c, p(n), "#4A3A5A", 30);
      for (const n of ["legL", "legR"]) panel(c, p(n), dark, 31);
      const h = p("head"); dot(c, h.py, 0, 0, 7, 6, gold); for (const r of [h.pz, h.nz, h.px, h.nx]) { row(c, r, 0, 1, gold); for (let k = 0; k < r.w; k += 2) dot(c, r, k, 0, 1, 1, "#FFF0A0"); }
      dot(c, h.pz, 0, 3, 7, 2, "#14141C"); eye(c, h.pz, 1, 3, 2, 1, "#FF2A6A"); eye(c, h.pz, 4, 3, 2, 1, "#FF2A6A");
      const b = p("body"); dot(c, b.pz, 2, 1, 4, 4, gold); dot(c, b.pz, 3, 2, 2, 2, "#FF2A6A"); dot(c, b.pz, 0, 7, 8, 1, gold);
    },
  },
};

// ---------------------------------------------------------------- the rig
export interface Rig {
  root: THREE.Group;
  /** the figure, turned to face where it walks / aims */
  pose: THREE.Group;
  parts: Record<string, THREE.Object3D>;
  mat: THREE.MeshLambertMaterial;
  /** where the muzzle is, in the figure's own space */
  muzzle: THREE.Vector3;
  height: number;
  jet: THREE.Mesh | null;
  extra: THREE.Object3D[];
}

const geomCache = new Map<string, Record<string, THREE.BufferGeometry>>();
const texCache = new Map<string, THREE.Texture>();

function buildParts(key: string, defs: PartDef[], px: number) {
  let g = geomCache.get(key);
  if (g) return g;
  g = {};
  for (const d of defs) {
    const b = new Builder();
    // the part's geometry sits with its pivot at the origin
    skinBox(b, d.size[0], d.size[1], d.size[2], px, d.uv[0], d.uv[1], SKIN, [0, 0, 0], d.pivot);
    g[d.name] = b.geometry();
  }
  geomCache.set(key, g);
  return g;
}

function mount(defs: PartDef[], geo: Record<string, THREE.BufferGeometry>, mat: THREE.Material, px: number) {
  const pose = new THREE.Group();
  const parts: Record<string, THREE.Object3D> = {};
  // body first; head on the body's top; arms at the shoulders; legs under the hips
  for (const d of defs) {
    const m = new THREE.Mesh(geo[d.name], mat);
    m.castShadow = true;
    const holder = new THREE.Group();
    holder.add(m);
    parts[d.name] = holder;
  }
  const body = parts.body, bodyDef = defs.find((d) => d.name === "body")!;
  body.position.set(bodyDef.at[0], bodyDef.at[1], bodyDef.at[2]);
  pose.add(body);
  for (const d of defs) {
    if (d.name === "body") continue;
    const h = parts[d.name];
    if (d.name === "head") { h.position.set(d.at[0], d.at[1], d.at[2]); body.add(h); }
    else if (d.name.startsWith("arm")) { h.position.set(d.at[0], d.at[1], d.at[2]); body.add(h); }
    else { h.position.set(d.at[0], d.at[1], d.at[2]); pose.add(h); }
  }
  void px;
  return { pose, parts };
}

// ---------------------------------------------------------------- humans
const HUMAN_DEFS: PartDef[] = [
  { name: "body", size: BODY as [number, number, number], uv: L_BODY as [number, number], at: [0, LEG[1] * HP, 0], pivot: [0, 0, 0] },
  { name: "head", size: HEAD as [number, number, number], uv: L_HEAD as [number, number], at: [0, BODY[1] * HP, 0], pivot: [0, 0, 0] },
  { name: "armL", size: ARM as [number, number, number], uv: L_ARM as [number, number], at: [(BODY[0] + ARM[0]) * 0.5 * HP, (BODY[1] - 0.5) * HP, 0], pivot: [0, ARM[1] - 1, 0] },
  { name: "armR", size: ARM as [number, number, number], uv: L_ARM as [number, number], at: [-(BODY[0] + ARM[0]) * 0.5 * HP, (BODY[1] - 0.5) * HP, 0], pivot: [0, ARM[1] - 1, 0] },
  { name: "legL", size: LEG as [number, number, number], uv: L_LEG as [number, number], at: [LEG[0] * 0.5 * HP, LEG[1] * HP, 0], pivot: [0, LEG[1], 0] },
  { name: "legR", size: LEG as [number, number, number], uv: L_LEG as [number, number], at: [-LEG[0] * 0.5 * HP, LEG[1] * HP, 0], pivot: [0, LEG[1], 0] },
  { name: "pack", size: PACK as [number, number, number], uv: L_PACK as [number, number], at: [0, 3 * HP, -(BODY[2] + PACK[2]) * 0.5 * HP], pivot: [0, 0, 0] },
];

const jetGeo = (() => { const b = new Builder(); b.box(0, -0.12, 0, 0.12, 0.24, 0.12, 0xffd27a, undefined, undefined, false); b.box(0, -0.3, 0, 0.07, 0.2, 0.07, 0xfff6d0, undefined, undefined, false); return b.geometry(); })();
const jetMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.9 });

export function humanRig(look: HumanLook, o: Outfit): Rig {
  const key = `h-${look}-${look === "ace" ? o.id : ""}`;
  let tex = texCache.get(key);
  if (!tex) { tex = pixelTexture(paintHuman(look, o)); texCache.set(key, tex); }
  const geo = buildParts("human", HUMAN_DEFS, HP);
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  const { pose, parts } = mount(HUMAN_DEFS, geo, mat, HP);
  // the jetpack hangs on the body's back; flames under it
  const pack = parts.pack;
  pose.remove(pack); parts.body.add(pack);
  pack.position.set(0, 3 * HP, -(BODY[2] + PACK[2]) * 0.5 * HP);
  const jet = new THREE.Mesh(jetGeo, jetMat);
  jet.position.set(0, -0.02, 0); jet.visible = false;
  pack.add(jet);
  const root = new THREE.Group();
  root.add(pose);
  return { root, pose, parts, mat, muzzle: new THREE.Vector3(-0.27, 1.25, 0.95), height: (LEG[1] + BODY[1] + HEAD[1]) * HP, jet, extra: [] };
}

// rotor blades for drones and the carrier
function rotorGeo(r: number) { const b = new Builder(); b.box(0, 0, 0, r * 2, 0.03, r * 0.22, 0x2a2d3a); b.box(0, 0, 0, r * 0.22, 0.03, r * 2, 0x2a2d3a); b.box(0, -0.03, 0, 0.06, 0.08, 0.06, 0x8a92a6); return b.geometry(); }
const extrasMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });

export function robotRig(kind: RobotKind | BossKind | "tower", elite: boolean): Rig {
  const def = KINDS[kind];
  const key = `r-${kind}-${elite ? 1 : 0}`;
  let tex = texCache.get(key);
  if (!tex) {
    const cv = document.createElement("canvas"); cv.width = cv.height = SKIN;
    const c = cv.getContext("2d")!;
    const rects = new Map<string, Record<Face, Rect>>();
    for (const d of def.parts) rects.set(d.name, skinLayout(d.uv[0], d.uv[1], d.size[0], d.size[1], d.size[2]));
    def.paint(c, (n) => rects.get(n)!, elite);
    tex = pixelTexture(cv); texCache.set(key, tex);
  }
  const geo = buildParts(`r-${kind}`, def.parts, def.px);
  const mat = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true });
  const { pose, parts } = mount(def.parts, geo, mat, def.px);
  const extra: THREE.Object3D[] = [];
  let muzzle = new THREE.Vector3(-0.3, 1.0, 0.6), height = 1.4;
  if (kind === "drone" || kind === "carrier") {
    const big = kind === "carrier", rg = rotorGeo(big ? 0.9 : 0.32);
    const off = big ? 1.6 : 0.42;
    for (const [x, z] of [[off, off], [-off, off], [off, -off], [-off, -off]]) { const m = new THREE.Mesh(rg, extrasMat); m.position.set(x, big ? 0.6 : 0.2, z); parts.body.add(m); extra.push(m); }
    muzzle = new THREE.Vector3(0, -0.2, big ? 1.8 : 0.45); height = big ? 1.6 : 0.5;
  } else if (kind === "brute" || kind === "titan") {
    // an arm cannon on the right arm, missile pods on the titan's shoulders
    const s = kind === "titan" ? 2.2 : 1;
    const b = new Builder(); b.box(0, -0.75 * s, 0.25 * s, 0.32 * s, 0.32 * s, 0.7 * s, 0x2a2d3a); b.box(0, -0.75 * s, 0.62 * s, 0.22 * s, 0.22 * s, 0.1 * s, 0xff8a2a);
    const cannon = new THREE.Mesh(b.geometry(), extrasMat); parts.armR.add(cannon); extra.push(cannon);
    if (kind === "titan") for (const x of [1.0, -1.0]) { const p = new Builder(); p.box(0, 0, 0, 0.9, 0.6, 0.8, 0x4a5060); for (let i = 0; i < 3; i++) p.box(-0.25 + i * 0.25, 0, 0.41, 0.16, 0.16, 0.02, 0xff3a3a); const m = new THREE.Mesh(p.geometry(), extrasMat); m.position.set(x, 0.95, 0); parts.body.add(m); extra.push(m); }
    muzzle = new THREE.Vector3(-0.64 * s, 0.8 * s + (kind === "titan" ? 1.3 : 0), 0.9 * s); height = kind === "titan" ? 5.4 : 2.2;
  } else if (kind === "spider") {
    const b = new Builder(); b.box(0, 0.2, 0, 0.28, 0.4, 0.28, 0x2a2d3a); b.box(0, 0.42, 0.02, 0.2, 0.06, 0.2, 0xff8a2a);
    const tube = new THREE.Mesh(b.geometry(), extrasMat); tube.position.set(0, 0.36, -0.1); tube.rotation.x = -0.4; parts.body.add(tube); extra.push(tube);
    muzzle = new THREE.Vector3(0, 1.2, 0.1); height = 1.1;
  } else if (kind === "roller") {
    muzzle = new THREE.Vector3(0, 0.3, 0.3); height = 0.7;
  } else if (kind === "tower") {
    // a spinning ring of plates around the core, and an antenna
    const b = new Builder();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.box(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62, 0.22, 0.12, 0.22, k % 2 ? 0xffd23f : 0x3a3e4e); }
    const ring = new THREE.Mesh(b.geometry(), extrasMat); ring.position.set(0, 1.55, 0); parts.body.add(ring); extra.push(ring);
    const an = new Builder(); an.box(0, 0.5, 0, 0.06, 1, 0.06, 0x8a92a6); an.box(0, 1.05, 0, 0.16, 0.16, 0.16, 0xff3a6a);
    const ant = new THREE.Mesh(an.geometry(), extrasMat); ant.position.set(0, 1.49, 0); parts.head.add(ant); extra.push(ant);
    muzzle = new THREE.Vector3(0, 2.2, 0.36); height = 2.6;
  } else {
    // a blaster in the right hand
    const long = kind === "sniper", big = kind === "overlord";
    const s = big ? 2.6 / 1 : 1;
    const b = new Builder(); b.box(0, -0.55 * (big ? 2.4 : 1), 0.2 * s * (big ? 0.9 : 1), 0.1 * s, 0.12 * s, (long ? 0.9 : 0.45) * s, 0x2a2d3a); b.box(0, -0.55 * (big ? 2.4 : 1), (long ? 0.66 : 0.44) * s, 0.06 * s, 0.06 * s, 0.06 * s, long ? 0xff5af0 : 0xff3a3a);
    const gun = new THREE.Mesh(b.geometry(), extrasMat); parts.armR.add(gun); extra.push(gun);
    const sc = kind === "scout" ? 0.75 : 1;
    muzzle = new THREE.Vector3(-0.35 * sc * (big ? 2.6 : 1), (kind === "scout" ? 0.75 : kind === "sniper" ? 1.3 : 1.05) * (big ? 2.4 : 1), (long ? 0.95 : 0.6) * (big ? 2.4 : 1));
    height = kind === "scout" ? 1.05 : kind === "sniper" ? 1.9 : big ? 5.2 : 1.75;
  }
  if (kind === "overlord") {
    // a cape of dark plates down the back
    const b = new Builder(); b.box(0, -0.4, -0.05, 1.3, 1.9, 0.08, 0x4a1a2a); b.box(0, 0.45, -0.05, 1.4, 0.15, 0.1, 0xe8b030);
    const cape = new THREE.Mesh(b.geometry(), extrasMat); cape.position.set(0, 0.2, -0.38); parts.body.add(cape); extra.push(cape);
  }
  const root = new THREE.Group();
  root.add(pose);
  return { root, pose, parts, mat, muzzle, height, jet: null, extra };
}

// ---------------------------------------------------------------- blasters (in hand, and in the armory)
const gunCache = new Map<string, THREE.BufferGeometry>();
export function gunGeometry(id: string, color: string) {
  const hit = gunCache.get(id);
  if (hit) return hit;
  const b = new Builder(), p = 0.035;
  const col = C(color), dark = 0x2a2d3a, mid = 0x5a5e6e, light = 0xb8bccb;
  // every blaster: a grip, a body and a barrel along +z, built from 1-pixel (3.5 cm) voxels
  const v = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number) => b.box((x + sx / 2) * p, (y + sy / 2) * p, (z + sz / 2) * p, sx * p, sy * p, sz * p, c);
  v(-1, -4, -2, 2, 4, 2, dark); // grip
  switch (id) {
    case "zapper": v(-1.5, 0, -3, 3, 3, 8, mid); v(-1, 1, 5, 2, 2, 3, dark); v(-1.5, 3, -2, 3, 1, 4, col); v(-0.5, 1.5, 8, 1, 1, 1, C("#B8F6FF")); break;
    case "pulse": v(-1.5, 0, -6, 3, 3, 14, mid); v(-1, 0.5, 8, 2, 2, 5, dark); v(-1.5, 3, -4, 3, 1, 8, col); v(-1.5, -3, 1, 3, 3, 2, dark); v(-1, -1, -9, 2, 3, 3, mid); break;
    case "scatter": v(-2, 0, -5, 4, 3, 12, mid); v(-2, 0.5, 7, 4, 2, 3, dark); v(-1.5, -2, 1, 3, 2, 5, C("#8A5A36")); v(-2, 3, -3, 4, 1, 6, col); break;
    case "rail": v(-1.5, 0, -7, 3, 3, 12, mid); v(-0.5, 1, 5, 1, 1, 12, light); v(-1, 0.5, 5, 2, 2, 2, col); v(-1, 0.5, 10, 2, 2, 2, col); v(-1, 3, -2, 2, 2, 5, dark); v(-1.5, -1, -10, 3, 4, 3, mid); break;
    case "boom": v(-2.5, 0, -6, 5, 5, 16, mid); v(-2, 0.5, 10, 4, 4, 1, col); v(-1.5, 5, -2, 3, 1, 6, dark); v(-2.5, 1, -7, 5, 3, 1, dark); break;
    case "arc": v(-1.5, 0, -4, 3, 3, 9, mid); for (let k = 0; k < 3; k++) v(-2, -0.5, 5 + k * 2, 4, 4, 1, col); v(-0.5, 1, 11, 1, 1, 2, C("#E8DCFF")); v(-1.5, 3, -3, 3, 1, 5, dark); break;
    case "twin": v(-1.5, 0, -3, 3, 3, 9, mid); v(-1, 1, 6, 2, 2, 3, dark); v(-1.5, 3, -2, 3, 1, 5, col); v(2.5, 0, -2, 3, 3, 8, mid); v(3, 1, 6, 2, 2, 2, dark); v(2.5, 3, -1, 3, 1, 4, col); break;
    case "minigun": case "omega": { const body = id === "omega" ? C("#E8B030") : mid; v(-3, -1, -6, 6, 5, 10, body); for (const [x, y] of [[-2, 0], [1, 0], [-2, 2.5], [1, 2.5], [-0.5, 3.5], [-0.5, -1]]) v(x, y, 4, 1.4, 1.4, 12, id === "omega" ? C("#FFF0A0") : light); v(-3.5, 1, 15, 7, 3, 1, col); v(-1.5, 4, -4, 3, 2, 6, dark); break; }
    case "laser": v(-1.5, 0, -6, 3, 4, 13, C("#3A3E4E")); v(-1, 1, 7, 2, 2, 6, col); v(-0.5, 1.5, 13, 1, 1, 1, C("#FFC0D0")); v(-2, 4, -3, 4, 1, 8, col); v(-1, -2, -2, 2, 2, 4, dark); break;
    case "plasma": case "nova": { const c2 = id === "nova" ? C("#9AF0FF") : col; v(-3, -1, -6, 6, 6, 12, mid); v(-2.5, -0.5, 6, 5, 5, 3, c2); v(-2, 0, 9, 4, 4, 1, C("#FFFFFF")); v(-3.5, 5, -3, 7, 1, 6, c2); v(-1, -4, -1, 2, 3, 2, dark); break; }
    case "swarm": v(-3, -1, -5, 6, 6, 12, C("#4A5A3A")); for (const [x, y] of [[-2, 0], [0.5, 0], [-2, 2.5], [0.5, 2.5]]) v(x, y, 7, 2, 2, 1, C("#FF3A3A")); v(-3.5, 5, -2, 7, 1, 6, col); break;
    case "storm": v(-1.5, 0, -7, 3, 3, 12, C("#3A2A4A")); v(-0.5, 1, 5, 1, 1, 14, C("#FFC8FA")); for (let k = 0; k < 4; k++) v(-1.5, 0, 5 + k * 3, 3, 3, 1, col); v(-1, 3, -2, 2, 2, 5, dark); break;
    case "inferno": v(-2, -1, -6, 4, 5, 10, C("#5A3A2A")); v(-1.5, 0, 4, 3, 3, 8, mid); v(-2, -0.5, 12, 4, 4, 1, col); v(-1.5, -6, -4, 3, 5, 3, C("#D8302A")); v(-1.5, 4, -3, 3, 1, 5, col); break;
    default: v(-1.5, 0, -3, 3, 3, 8, mid);
  }
  const g = b.geometry();
  gunCache.set(id, g);
  return g;
}
export const gunMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });

// ---------------------------------------------------------------- pickups
export type PickupKind = "coin" | "gem" | "heart" | "oil" | "rapid" | "damage" | "shield" | "magnet" | "speed" | "ammo" | "bombs" | "gun";
const pickCache = new Map<PickupKind, THREE.BufferGeometry>();
export const POWER_COL: Record<string, string> = { rapid: "#FFD23F", damage: "#FF4A4A", shield: "#5AB8FF", magnet: "#FF5AC8", speed: "#5CE07A" };
export function pickupGeometry(k: PickupKind) {
  const hit = pickCache.get(k);
  if (hit) return hit;
  const b = new Builder(), p = 0.06;
  const v = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number) => b.box((x + sx / 2) * p, (y + sy / 2) * p, (z + sz / 2) * p, sx * p, sy * p, sz * p, c);
  if (k === "coin" || k === "gem") {
    const gold = k === "gem" ? 0x34d3e8 : 0xffc93d, dark = k === "gem" ? 0x1a8fb0 : 0xc8861a, hi = k === "gem" ? 0xc8fbff : 0xfff0a0;
    // a round coin from pixel rows
    const rows = [[-2, 4], [-3, 6], [-4, 8], [-4, 8], [-4, 8], [-4, 8], [-3, 6], [-2, 4]];
    rows.forEach(([x0, w], i) => v(x0, i - 4, -1, w, 1, 2, dark));
    rows.forEach(([x0, w], i) => { if (i > 0 && i < 7) v(x0 + 1, i - 4, -1.2, w - 2, 1, 2.4, gold); });
    v(-1, -2, -1.4, 2, 4, 2.8, dark); v(-2, 1, -1.3, 1, 1, 2.6, hi);
  } else if (k === "heart") {
    const red = 0xff3d6e, hi = 0xffb8c8;
    const rows = [[-1, 2], [-2, 4], [-3, 6], [-4, 8], [-4, 8], [-4, 3], [1, 3]];
    rows.forEach(([x0, w], i) => v(x0, -3 + i, -1.5, w, 1, 3, red));
    v(-3, 2, -1.7, 1, 1, 3.4, hi);
  } else if (k === "oil") {
    v(-3, -4, -2, 6, 8, 4, 0xd8302a); v(-2, 4, -1, 2, 2, 2, 0xffd23f); v(-3, -1, -2.2, 6, 1, 4.4, 0x1e1e24); v(1, 4, -1, 2, 1, 2, 0x2a2d3a);
    v(-1, 0, -2.3, 2, 3, 0.3, 0xffffff);
  } else if (k === "ammo") {
    // a crate of bullets: olive box, a yellow band, brass rounds on top
    v(-4, -3, -3, 8, 5, 6, 0x5a6a3a); v(-4.2, -1, -3.2, 8.4, 1, 6.4, 0xffd23f); for (let x = -3; x <= 2; x += 1.6) v(x, 2, -1, 1, 2.2, 1, 0xe8b030);
  } else if (k === "bombs") {
    // a red crate with a round bomb on it
    v(-4, -3, -3, 8, 5, 6, 0xb8302a); v(-4.2, 1.5, -3.2, 8.4, 0.6, 6.4, 0x2a2d3a); v(-2, 2, -2, 4, 3, 4, 0x2a2d3a); v(-0.5, 5, -0.5, 1, 1.5, 1, 0xffd23f);
  } else if (k === "gun") {
    // a glowing gold-and-blue gun case
    v(-5, -3, -3, 10, 4, 6, 0x2a5ad8); v(-5.2, 0.6, -3.2, 10.4, 0.8, 6.4, 0xffd23f); v(-3, 1.5, -1, 6, 1.5, 2, 0xe8eef8); v(-1, -1, -3.4, 2, 2, 0.4, 0x9af0ff);
  } else {
    const col = C(POWER_COL[k]);
    v(-3, -3, -3, 6, 6, 6, col); v(-2, -2, -3.3, 4, 4, 6.6, 0xffffff); v(-3.3, -2, -2, 6.6, 4, 4, 0xffffff);
    v(-1.5, -1.5, -3.5, 3, 3, 7, col); v(-3.5, -1.5, -1.5, 7, 3, 3, col);
  }
  const g = b.geometry();
  pickCache.set(k, g);
  return g;
}

/** the squad mates' names and colours (for the HUD) */
export const SQUAD = { juno: { name: "Juno", color: "#3EB8E8" }, brick: { name: "Brick", color: "#C8402A" } };
