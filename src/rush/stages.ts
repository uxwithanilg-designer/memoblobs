// One entry point for stages: the builder with the fairness bot installed as its validator.
import { installValidator } from "./bot";
import { buildStage, knownAt, recipeFor, type RemixMemory } from "./gen";
import { modeRecipe, parkify, type ModeRun } from "./modes";
import type { Stage } from "./types";

installValidator((st) => knownAt(st.n));

/** journey stage n — or, with a mode, stage n (1, 2, 3…) of that mode's run */
export function makeStage(n: number, salt: number, mem?: RemixMemory, y0?: number, mode?: ModeRun): Stage {
  if (mode) { const st = buildStage({ ...modeRecipe(mode, n), y0 }); return mode.id === "park" ? parkify(st) : st; }
  return buildStage({ ...recipeFor(n, salt, mem), y0 });
}
export { knownAt, recipeFor };
