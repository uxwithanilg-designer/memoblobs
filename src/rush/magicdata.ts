// Mayamma's spellbook as data: 11 elements × 20 spell forms = 220 named magics (the placement is in magic.ts).
import type { ObjKind, ZoneKind } from "./types";

export interface Element { id: string; name: string; col: string; col2: string; puddle: ZoneKind; drop: ObjKind }
export const ELEMENTS: Element[] = [
  { id: "fire", name: "Fire", col: "#FF6A2A", col2: "#FFD15A", puddle: "lava", drop: "bomb" },
  { id: "ice", name: "Ice", col: "#7FD8FF", col2: "#FFFFFF", puddle: "ice", drop: "faller" },
  { id: "poison", name: "Poison", col: "#7AE84A", col2: "#2A8A3A", puddle: "slow", drop: "bomb" },
  { id: "lightning", name: "Thunder", col: "#FFF26A", col2: "#9FD8FF", puddle: "zap", drop: "faller" },
  { id: "shadow", name: "Shadow", col: "#7A3AC8", col2: "#1A0A2A", puddle: "slow", drop: "bomb" },
  { id: "thorn", name: "Thorn", col: "#5A8A2A", col2: "#C8A05A", puddle: "web", drop: "faller" },
  { id: "water", name: "Tide", col: "#3A9AE8", col2: "#BFE8FF", puddle: "slow", drop: "bomb" },
  { id: "light", name: "Halo", col: "#FFE9A8", col2: "#FFFFFF", puddle: "zap", drop: "faller" },
  { id: "stone", name: "Stone", col: "#8A7A6A", col2: "#C8B8A0", puddle: "mud", drop: "faller" },
  { id: "star", name: "Star", col: "#C9A8FF", col2: "#FFFFFF", puddle: "lowg", drop: "faller" },
  { id: "rainbow", name: "Rainbow", col: "#FF5AD8", col2: "#5CF2C9", puddle: "bounce", drop: "bomb" },
];
export interface Form { id: string; name: string }
export const FORMS: Form[] = [
  { id: "rain", name: "Bomb Rain" }, { id: "curtain", name: "Curtain" }, { id: "rings", name: "Ring Wall" }, { id: "lowring", name: "Low Ring" },
  { id: "highring", name: "High Ring" }, { id: "orb", name: "Rolling Orb" }, { id: "wave", name: "Wave" }, { id: "puddle", name: "Puddle" },
  { id: "burst", name: "Ground Burst" }, { id: "bolt", name: "Side Bolt" }, { id: "meteors", name: "Meteors" }, { id: "ghost", name: "Chasing Ghost" },
  { id: "spiral", name: "Spiral" }, { id: "cross", name: "Cross" }, { id: "pillars", name: "Pillar Line" }, { id: "split", name: "Split Bomb" },
  { id: "spears", name: "Sky Spears" }, { id: "whirl", name: "Whirl Trap" }, { id: "double", name: "Double Curtain" }, { id: "halo", name: "Halo Trap" },
];
/** all 220 magics: id "element:form" */
export const MAGICS = ELEMENTS.flatMap((e) => FORMS.map((f) => ({ id: `${e.id}:${f.id}`, name: `${e.name} ${f.name}` })));
export const MAGIC_NAME: Record<string, string> = Object.fromEntries(MAGICS.map((m) => [m.id, m.name]));
export const elementOf = (id: string) => ELEMENTS.find((e) => e.id === id.split(":")[0]) ?? ELEMENTS[0];


// ---------------------------------------------------------------- the signature obstacle of every stage
export const SIGS = [
  "popLogs", "risingPillars", "sideLogs", "sideRams", "fallingBoulders", "fallingLogs", "giantHammers", "rollingWheels", "fireWheels", "windmills",
  "crushers", "slidingWalls", "spinningBars", "bouncingBoulders", "tumblingBarrels", "fallingTrees", "risingSpikes", "geysers", "stompingBoots", "giantFans",
  "snowballs", "mallets", "lavaJets", "spinningTops", "bumpers", "iceSlides", "thornHedges", "sawLines", "bombCarts", "flameRings",
];
export const sigOf = (n: number) => SIGS[(n * 7 + 3) % SIGS.length];
