// Kiko's Jungle Quest — how each region looks: the path and the ground beside it, water at the sides, the big trees and
// their canopies, plants and props in layers, far landmarks, and which obstacle skins the region uses.
import type { ObKind, RegionId } from "./types";

export interface PathLook { base: [string, string, string]; stones: string; litter: string[]; edge: string; planks?: boolean; cracks?: string }
export interface GroundLook { base: string; blades: string[]; dots: string[] }
export interface RegionStyle {
  path: PathLook; ground: GroundLook;
  water: "none" | "left" | "both"; waterColor: string;
  /** big trees (3 kinds, repeats allowed): "jungle" or a models2 tree kind */
  trees: string[]; treeSides: "both" | "right"; treeX: number; treeY: number; treeScale: number;
  /** mid plants (4 kinds) and near props (up to 8 kinds) */
  plants: string[]; near: string[];
  /** far landmarks: hill, waterfall, mountain, volcano, mesa, pinesFar, palm */
  far: string[]; hillColor: string;
  hang: boolean; tunnel?: boolean; lava?: boolean;
  /** obstacle skin variants this region uses */
  skins: Partial<Record<ObKind | "gapLook" | "geyserLook", number[]>>;
}

const base: RegionStyle = {
  path: { base: ["#9A6A3E", "#8A5A32", "#A8774A"], stones: "#B7A48A", litter: ["#C98A2A", "#7A9A3A", "#B5652B"], edge: "#4F9A3A" },
  ground: { base: "#3E8A3A", blades: ["#2F7A32", "#4F9A40", "#5FAE4A", "#357F35"], dots: ["#FFFFFF", "#FFD23F", "#FF8FC7"] },
  water: "none", waterColor: "#9ADFEE",
  trees: ["jungle", "jungle", "jungle"], treeSides: "both", treeX: 8.6, treeY: 0, treeScale: 1,
  plants: ["banana", "banana", "palm", "palm"], near: ["fern", "fern", "flowers:#FF4F7E", "flowers:#FFB020", "mossRock", "mossRock", "grass", "grass"],
  far: ["hill", "waterfall", "palm"], hillColor: "#4F9A6A", hang: true,
  skins: { rock: [0, 0, 2], log: [0], low: [0, 0, 2], roller: [0, 1], coco: [0], bounce: [0], thorn: [0], shroom: [0], lily: [0, 1], gapLook: [0], geyserLook: [1] },
};
const S = (o: Partial<RegionStyle>): RegionStyle => ({ ...base, ...o, skins: { ...base.skins, ...o.skins } });

export const STYLES: Record<RegionId, RegionStyle> = {
  grove: base,
  river: S({
    path: { base: ["#E3C58E", "#D2B07A", "#EED6A6"], stones: "#C9AE80", litter: [], edge: "#C9AE80" },
    ground: { base: "#C9B07A", blades: ["#B89A66", "#D8C08E", "#A88A5A"], dots: [] },
    water: "left", trees: ["jungle", "jungle", "jungle"], treeSides: "right", plants: ["mango", "mango", "palm", "palm"],
    near: ["fern", "fern", "flowers:#FF4F7E", "flowers:#FFB020", "mossRock", "mossRock", "grass", "reeds"],
    skins: { rock: [0, 2], log: [0, 1], roller: [0, 1] },
  }),
  bamboo: S({
    path: { base: ["#8A9A8A", "#7A8A7A", "#9AAA98"], stones: "#B8C0B0", litter: ["#7CC44A", "#5FA845"], edge: "#4F9A4A" },
    ground: { base: "#4F9A4A", blades: ["#3F8A3A", "#5FAE4A", "#7CC44A"], dots: ["#FF8FC7", "#FFFFFF"] },
    trees: ["bamboo", "bamboo", "jungle"], plants: ["bambooShoot", "bambooShoot", "lantern", "bambooShoot"],
    near: ["bambooShoot", "lantern", "stone", "fern", "flowers:#FF8FC7", "grass", "stone", "fern"], far: ["hill", "pinesFar", "waterfall"], hillColor: "#5FA88A",
    skins: { rock: [3, 3, 0], log: [2], low: [3, 6], roller: [4, 0], bounce: [2] },
  }),
  falls: S({
    path: { base: ["#7A8A9A", "#6A7A8A", "#8A9AAA"], stones: "#AAB8C8", litter: ["#5FAE4A"], edge: "#5F8A7A" },
    ground: { base: "#3E8A5A", blades: ["#2F7A4A", "#4F9A5A", "#5FAE6A"], dots: ["#FFFFFF", "#7AD3FF"] },
    water: "left", trees: ["jungle", "jungle", "bamboo"], treeSides: "right", plants: ["palm", "fern", "palm", "fern"],
    near: ["stone", "fern", "flowers:#7AD3FF", "mossRock", "stone", "grass", "reeds", "fern"], far: ["waterfall", "waterfall", "hill"], hillColor: "#5F8A9A",
    skins: { rock: [0, 1, 2], log: [1], low: [0, 5], roller: [4] },
  }),
  mushroom: S({
    path: { base: ["#7A5A7A", "#6A4A6A", "#8A6A8A"], stones: "#C8A8D8", litter: ["#FF8FC7", "#9CFF6B"], edge: "#6A9A4A" },
    ground: { base: "#4A7A4A", blades: ["#3A6A3A", "#5A8A4A", "#7A9A5A"], dots: ["#FF4F5E", "#FFFFFF", "#B58CFF"] },
    trees: ["toadstool", "toadstool", "jungle"], plants: ["shrooms", "glowShrooms", "shrooms", "fern"],
    near: ["shrooms", "glowShrooms", "mossRock", "fern", "shrooms", "grass", "glowShrooms", "mossRock"], far: ["hill", "hill", "pinesFar"], hillColor: "#6A5A8A",
    skins: { rock: [8, 8, 2], low: [0, 2], roller: [3], coco: [5], bounce: [0, 1], shroom: [0, 1] },
  }),
  marsh: S({
    path: { base: ["#6A5A3E", "#5A4A30", "#7A6A48"], stones: "#8A7A5A", litter: ["#5A7A3A"], edge: "#4A6A3A" },
    ground: { base: "#3E6A3E", blades: ["#2F5A32", "#4F7A40", "#3A6A3A"], dots: ["#7AD3FF"] },
    water: "both", waterColor: "#7ABFCF", trees: ["mangrove", "jungle", "mangrove"], plants: ["reeds", "fern", "reeds", "puddle"],
    near: ["reeds", "puddle", "fern", "stone", "reeds", "grass", "puddle", "fern"], far: ["hill", "pinesFar", "hill"], hillColor: "#4A6A5A",
    skins: { rock: [0, 2], log: [1], low: [5, 0], roller: [4], coco: [6], geyserLook: [1] },
  }),
  canopy: S({
    path: { base: ["#B9774A", "#A8693E", "#C98A55"], stones: "#7A4A26", litter: ["#5FAE4A"], edge: "#6B4226", planks: true },
    ground: { base: "#3FAE4A", blades: ["#2F8F3E", "#4FBF55", "#5FC85A", "#3A9A45"], dots: ["#FFD23F", "#FF8FC7"] },
    trees: ["jungle", "jungle", "jungle"], treeY: -11, treeX: 9, plants: ["palm", "banana", "palm", "banana"],
    near: ["fern", "flowers:#FF4F7E", "fern", "flowers:#FFD23F", "grass", "fern", "grass", "fern"], far: ["hill", "palm", "hill"], hillColor: "#5FAE6A",
    skins: { rock: [2], log: [0], low: [0, 2], roller: [0], coco: [5] },
  }),
  night: S({
    path: { base: ["#3A3A4A", "#2E2E3E", "#4A4A5A"], stones: "#8A8AAA", litter: ["#9CFF6B", "#3DE0FF"], edge: "#2A4A3A" },
    ground: { base: "#1E3A2E", blades: ["#16302A", "#24483A", "#2A503E"], dots: ["#9CFF6B", "#3DE0FF", "#FFE07A"] },
    trees: ["night", "night", "pine"], plants: ["glowShrooms", "fern", "glowFlowers", "lantern"],
    near: ["glowFlowers", "glowShrooms", "fern", "stone", "glowFlowers", "grass", "lantern", "fern"], far: ["hill", "pinesFar", "pinesFar"], hillColor: "#24304A",
    skins: { rock: [0, 2], low: [6, 0], roller: [4], coco: [5], shroom: [1], bounce: [1] },
  }),
  blossom: S({
    path: { base: ["#C89A7A", "#B88A6A", "#D8AA8A"], stones: "#E8C8B8", litter: ["#FF8FC7", "#FFC2E2", "#FFFFFF"], edge: "#7CD35A" },
    ground: { base: "#7CC45A", blades: ["#6AB44A", "#8AD36A", "#9AE07A"], dots: ["#FF8FC7", "#FFFFFF", "#FFD23F", "#B58CFF"] },
    trees: ["blossom", "blossom", "jungle"], plants: ["tulips", "blossomTree", "tulips", "palm"],
    near: ["tulips", "flowers:#FF8FC7", "tulips", "flowers:#FFD23F", "grass", "tulips", "flowers:#B58CFF", "stone"], far: ["hill", "hill", "pinesFar"], hillColor: "#8AC86A",
    skins: { rock: [0, 10], low: [2, 0], roller: [1, 0], coco: [3] },
  }),
  caves: S({
    path: { base: ["#4A3E5A", "#3A2E4A", "#5A4E6A"], stones: "#8A7AAA", litter: ["#3DE0FF", "#B58CFF"], edge: "#3A2E4A" },
    ground: { base: "#2A2238", blades: ["#221A30", "#30283E", "#3A3048"], dots: ["#3DE0FF", "#B58CFF"] },
    trees: ["crystal", "crystal", "crystal"], plants: ["crystalSmall", "glowShrooms", "crystalSmall", "stone"],
    near: ["crystalSmall", "stone", "glowShrooms", "crystalSmall", "stone", "glowShrooms", "crystalSmall", "stone"], far: [], hillColor: "#2A2238", hang: false, tunnel: true,
    skins: { rock: [4, 4, 7], log: [6], low: [5], roller: [5], coco: [1], shroom: [1], bounce: [1] },
  }),
  autumn: S({
    path: { base: ["#A8774A", "#98673E", "#B8875A"], stones: "#C8A88A", litter: ["#FF6A2A", "#FF9A2A", "#E8432A", "#FFC23D"], edge: "#C8783A" },
    ground: { base: "#B8783A", blades: ["#C8883A", "#A86A2A", "#D8984A"], dots: ["#FF4F2A", "#FFC23D"] },
    trees: ["maple", "maple", "pine"], plants: ["pumpkin", "hay", "maple", "leafPile"],
    near: ["leafPile", "pumpkin", "hay", "stone", "leafPile", "shrooms", "pumpkin", "grass"], far: ["hill", "pinesFar", "hill"], hillColor: "#C88A4A", hang: false,
    skins: { rock: [10, 2], log: [4, 0], roller: [2], coco: [3], gapLook: [1] },
  }),
  plains: S({
    path: { base: ["#C8945A", "#B8844A", "#D8A46A"], stones: "#E8C89A", litter: ["#E8C86A"], edge: "#D9A84A" },
    ground: { base: "#D9B060", blades: ["#E8C86A", "#C8A050", "#D9A84A"], dots: ["#FF8A3D"] },
    trees: ["acacia", "baobab", "acacia"], treeX: 10, plants: ["termite", "dryGrass", "acacia", "dryGrass"],
    near: ["dryGrass", "dryGrass", "stone", "termite", "dryGrass", "stone", "dryGrass", "flowers:#FF8A3D"], far: ["mesa", "hill", "mesa"], hillColor: "#C8945A", hang: false,
    skins: { rock: [6, 6, 0], low: [0], roller: [4] },
  }),
  mangrove: S({
    path: { base: ["#9A7A5A", "#8A6A4A", "#AA8A6A"], stones: "#6B4A2E", litter: ["#5A7A4A"], edge: "#5A4A3A", planks: true },
    ground: { base: "#3E5A4A", blades: ["#2F4A3A", "#4A6A50", "#3A5A44"], dots: [] },
    water: "both", waterColor: "#7AB8A8", trees: ["mangrove", "mangrove", "mangrove"], treeX: 8, plants: ["reeds", "reeds", "mangrove", "dock"],
    near: ["reeds", "dock", "lilyFlower", "reeds", "lilyFlower", "reeds", "dock", "reeds"], far: ["hill", "pinesFar", "hill"], hillColor: "#4A6A5A",
    skins: { rock: [0, 1], log: [1], low: [5], roller: [0] },
  }),
  snow: S({
    path: { base: ["#E8F0FA", "#D8E4F2", "#F4F8FF"], stones: "#B8C8DA", litter: ["#BFE0FF"], edge: "#FFFFFF" },
    ground: { base: "#F2F6FC", blades: ["#E2ECF8", "#FFFFFF", "#D8E4F2"], dots: ["#BFE0FF"] },
    trees: ["pine", "pine", "pine"], plants: ["snowBush", "pine", "snowman", "iceRock"],
    near: ["snowBush", "iceRock", "snowBush", "snowman", "iceRock", "snowBush", "stone", "snowBush"], far: ["mountain", "mountain", "pinesFar"], hillColor: "#DDE8F4", hang: false,
    skins: { rock: [5, 9, 5], log: [3], low: [4], roller: [3], coco: [2], thorn: [2], bounce: [1] },
  }),
  volcano: S({
    path: { base: ["#3A302E", "#2E2624", "#4A3E3A"], stones: "#5A4A44", litter: ["#FF6A1A"], edge: "#2A2220", cracks: "#FF6A1A" },
    ground: { base: "#3A3230", blades: ["#2E2826", "#4A3E3A", "#3E3634"], dots: ["#FF6A1A", "#FFC23D"] },
    trees: ["dead", "dead", "jungle"], plants: ["lavaRock", "fireFlower", "dead", "lavaRock"],
    near: ["lavaRock", "fireFlower", "stone", "lavaRock", "fireFlower", "stone", "lavaRock", "fireFlower"], far: ["volcano", "hill", "volcano"], hillColor: "#3A2A2A", hang: false, lava: true,
    skins: { rock: [7, 7, 0], log: [5], low: [0], roller: [6], coco: [4], thorn: [1], lily: [2], gapLook: [2], geyserLook: [0] },
  }),
};
