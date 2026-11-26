// The blocks everything is built from (0.5 m cubes). Each has a hardness — what it takes to break it: the hammer
// smashes wood, glass, plaster and brick, the drill bores steel, and only dynamite (or a top-level drill or rocket)
// cracks vault steel — a colour from the district's palette, a pixel tile in the atlas, and the sound it makes.
export const AIR = 0, GROUND = 1, ROAD = 2, WOOD = 3, GLASS = 4, BRICK = 5, PLASTER = 6, STONE = 7, ROOF = 8, TILE = 9, CARPET = 10,
  STEEL = 11, VAULT = 12, GOLD = 13, LEAF = 14, TRUNK = 15, FENCE = 16, MARBLE = 17, NEON = 18, TRIM = 19, CRATE = 20, SAFE = 21,
  DIRT = 22, METAL = 23, PAINT = 24;
export const MATERIALS = 25;

export type Breaks = "wood" | "glass" | "brick" | "stone" | "metal";
export interface Mat {
  name: string;
  /** 0 = can't be broken (the lot's ground) */
  hard: number;
  /** atlas tile */
  tile: number;
  sound: Breaks;
  /** see-through: drawn in the glass pass */
  clear?: boolean;
  /** glows (unlit) */
  glow?: boolean;
  /** breaking it pays out */
  loot?: "gold" | "cash";
}
export const MAT: Mat[] = [];
MAT[AIR] = { name: "air", hard: 0, tile: 0, sound: "wood" };
MAT[GROUND] = { name: "ground", hard: 0, tile: 0, sound: "stone" };
MAT[ROAD] = { name: "road", hard: 0, tile: 1, sound: "stone" };
MAT[WOOD] = { name: "wood", hard: 1, tile: 2, sound: "wood" };
MAT[GLASS] = { name: "glass", hard: 1, tile: 3, sound: "glass", clear: true };
MAT[BRICK] = { name: "brick", hard: 2, tile: 4, sound: "brick" };
MAT[PLASTER] = { name: "plaster", hard: 1, tile: 5, sound: "brick" };
MAT[STONE] = { name: "stone", hard: 3, tile: 6, sound: "stone" };
MAT[ROOF] = { name: "roof", hard: 2, tile: 7, sound: "brick" };
MAT[TILE] = { name: "floor", hard: 2, tile: 8, sound: "stone" };
MAT[CARPET] = { name: "carpet", hard: 1, tile: 9, sound: "wood" };
MAT[STEEL] = { name: "steel", hard: 4, tile: 10, sound: "metal" };
MAT[VAULT] = { name: "vault steel", hard: 5, tile: 11, sound: "metal" };
MAT[GOLD] = { name: "gold", hard: 2, tile: 12, sound: "metal", loot: "gold" };
MAT[LEAF] = { name: "leaves", hard: 1, tile: 13, sound: "wood" };
MAT[TRUNK] = { name: "trunk", hard: 1, tile: 14, sound: "wood" };
MAT[FENCE] = { name: "fence", hard: 1, tile: 15, sound: "wood" };
MAT[MARBLE] = { name: "marble", hard: 3, tile: 16, sound: "stone" };
MAT[NEON] = { name: "neon", hard: 1, tile: 17, sound: "glass", glow: true };
MAT[TRIM] = { name: "trim", hard: 2, tile: 18, sound: "brick" };
MAT[CRATE] = { name: "crate", hard: 1, tile: 19, sound: "wood" };
MAT[SAFE] = { name: "safe", hard: 2, tile: 20, sound: "metal", loot: "cash" };
MAT[DIRT] = { name: "earth", hard: 0, tile: 21, sound: "stone" };
MAT[METAL] = { name: "metal floor", hard: 3, tile: 22, sound: "metal" };
MAT[PAINT] = { name: "paint", hard: 1, tile: 23, sound: "brick" };

/** the breaking power of each way of hitting: hammer 2 (3 upgraded), blaster 1, drill 4 (5 at the top level), grenade 3,
 *  rocket 4 (5 upgraded), dynamite 5 */
export const canBreak = (mat: number, power: number) => mat !== AIR && MAT[mat].hard > 0 && MAT[mat].hard <= power;
