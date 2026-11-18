// Builds the next piece of the endless run off the main thread (the par-line solver can take 50–300 ms), so the
// game never stutters when new track is glued on. Messages: { id, k, mem } → { id, L } (L = null if it failed).
import { fusionRecipe, type FusionMemory } from "./fusion";
import { JOURNEY_LEN, journeyRecipe, runChunk } from "./levels";
import type { Level } from "./types";

export interface RunWorkerAsk { id: number; k: number; mem: { seen: string[]; recent: string[]; promoted: string[][] } }
export interface RunWorkerReply { id: number; L: Level | null }

const ctx = self as unknown as { onmessage: ((ev: MessageEvent<RunWorkerAsk>) => void) | null; postMessage: (m: RunWorkerReply) => void };

ctx.onmessage = (ev) => {
  const { id, k, mem } = ev.data;
  const memory: FusionMemory = { seen: new Set(mem.seen), recent: mem.recent, promoted: mem.promoted };
  for (let i = 0; i < 3; i++) {
    const n = k + i;
    try {
      const rec = n <= JOURNEY_LEN ? journeyRecipe(n) : fusionRecipe(n, memory);
      ctx.postMessage({ id, L: runChunk(rec, String(n)) });
      return;
    } catch { /* try the next piece */ }
  }
  ctx.postMessage({ id, L: null });
};
