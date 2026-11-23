// One entry point for stages: the director with the fairness robot installed as its judge.
import { botRun } from "./bot";
import { Track } from "./track";
import { buildStage, recipeFor, setValidator, type CourseOpts, type RemixMemory } from "./gen";
import type { Stage } from "./types";

// the track is built once per stage and kept while the robot re-drives it (clearing trouble only changes its floor)
let lastSt: Stage | null = null, lastTr: Track | null = null;
setValidator((st, from) => { if (st !== lastSt || !lastTr) { lastSt = st; lastTr = new Track(st.segs); } return botRun(st, lastTr, from); });

/** journey stage n (1–500), then the Remix Grand Prix forever */
export function makeStage(n: number, salt: number, mem?: RemixMemory, opts?: CourseOpts): Stage { return buildStage(recipeFor(n, salt, mem, opts)); }
