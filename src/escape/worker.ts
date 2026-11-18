// Builds Momo Escape floors off the main thread (room generation + solver proofs can take a moment).
import { buildRoom, recipeFor, type EscapeMode, type FusionMemory, type ModeParams } from "./gen";
import type { Room } from "./types";

export interface EscapeAsk { id: number; mode: EscapeMode; n: number; params: ModeParams; inX: number; mem: FusionMemory }
export interface EscapeReply { id: number; room: Room | null }

const ctx = self as unknown as { onmessage: ((ev: MessageEvent<EscapeAsk>) => void) | null; postMessage: (m: EscapeReply) => void };
ctx.onmessage = (ev) => {
  const a = ev.data;
  try { ctx.postMessage({ id: a.id, room: buildRoom(recipeFor(a.mode, a.n, a.params, a.mem), a.inX) }); }
  catch { ctx.postMessage({ id: a.id, room: null }); }
};
