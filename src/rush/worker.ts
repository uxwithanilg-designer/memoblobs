// Builds Rollo Rush stages off the main thread (the builder runs the fairness bot, which can take a moment).
import type { RemixMemory } from "./gen";
import type { ModeRun } from "./modes";
import { makeStage } from "./stages";
import type { Stage } from "./types";

export interface RushAsk { id: number; n: number; salt: number; mem: RemixMemory; y0?: number; mode?: ModeRun }
export interface RushReply { id: number; n: number; st: Stage }

self.onmessage = (e: MessageEvent<RushAsk>) => {
  const { id, n, salt, mem, y0, mode } = e.data;
  const st = makeStage(n, salt, mem, y0, mode);
  (self as unknown as Worker).postMessage({ id, n, st } satisfies RushReply);
};
