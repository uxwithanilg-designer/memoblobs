// Builds Orbi GP stages off the main thread (the fairness robot drives each one first, which takes a moment).
import type { CourseOpts, RemixMemory } from "./gen";
import { makeStage } from "./stages";
import type { Stage } from "./types";

export interface OrbiAsk { id: number; n: number; salt: number; mem: RemixMemory; opts?: CourseOpts }
export interface OrbiReply { id: number; n: number; st: Stage }

self.onmessage = (e: MessageEvent<OrbiAsk>) => {
  const { id, n, salt, mem, opts } = e.data;
  const st = makeStage(n, salt, mem, opts);
  (self as unknown as Worker).postMessage({ id, n, st } satisfies OrbiReply);
};
