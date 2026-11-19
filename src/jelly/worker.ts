// Builds Momo Jelly Jam stages (and hints) off the main thread, so the next stage is ready before you finish this one.
import { buildMode, buildStage, recipeFor, type FusionMemory, type ModeSpec } from "./gen";
import { hint } from "./solver";
import type { Level, Move, State } from "./types";

export type JamAsk =
  | { kind: "build"; id: number; n: number; salt: number; mem: FusionMemory }
  | { kind: "mode"; id: number; spec: ModeSpec; known: string[] }
  | { kind: "hint"; id: number; level: Level; state: State };
export type JamReply =
  | { kind: "build"; id: number; level: Level }
  | { kind: "hint"; id: number; move: Move | null };

const ctx = self as unknown as { onmessage: ((ev: MessageEvent<JamAsk>) => void) | null; postMessage: (m: JamReply) => void };
ctx.onmessage = (ev) => {
  const a = ev.data;
  if (a.kind === "build") ctx.postMessage({ kind: "build", id: a.id, level: buildStage(recipeFor(a.n, a.salt, a.mem)) });
  else if (a.kind === "mode") ctx.postMessage({ kind: "build", id: a.id, level: buildMode(a.spec, a.known) });
  else ctx.postMessage({ kind: "hint", id: a.id, move: hint(a.level, a.state) });
};
