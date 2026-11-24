// Puzzle supply for the UI: the worker makes puzzles (main-thread fallback), results are remembered by request, and
// the next endless puzzle of the kind you're playing is always made ahead.
import type { KindId, Level, Puzzle } from "./kinds";
import type { GenRequest } from "./generator";
import { randomSeed } from "../sudoku/rng";

let worker: Worker | null = null, broken = false, nextId = 0;
const waits = new Map<number, { ok: (v: unknown) => void; fail: (e: Error) => void }>();

function ask<T>(msg: Record<string, unknown>): Promise<T> {
  return new Promise((ok, fail) => {
    try {
      if (!worker) {
        worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (m: MessageEvent<{ id: number; error?: string }>) => {
          const w = waits.get(m.data.id);
          if (!w) return;
          waits.delete(m.data.id);
          if (m.data.error) w.fail(new Error(m.data.error)); else w.ok(m.data);
        };
        worker.onerror = () => { broken = true; for (const w of waits.values()) w.fail(new Error("worker")); waits.clear(); worker = null; };
      }
      const id = ++nextId;
      waits.set(id, { ok: ok as (v: unknown) => void, fail });
      worker.postMessage({ id, ...msg });
    } catch (e) { broken = true; fail(e as Error); }
  });
}

async function genMain(req: GenRequest): Promise<Puzzle> {
  const { generatePuzzle } = await import("./generator");
  await new Promise((r) => setTimeout(r, 0));
  return generatePuzzle(req);
}

const made = new Map<string, Promise<Puzzle>>();
export function getPuzzle(req: GenRequest): Promise<Puzzle> {
  const k = `${req.kind}|${req.level}|${req.seed}`;
  let p = made.get(k);
  if (!p) {
    p = broken ? genMain(req) : ask<{ puzzle: Puzzle }>({ kind: "gen", req }).then((r) => r.puzzle).catch(() => genMain(req));
    p.catch(() => made.delete(k));
    made.set(k, p);
    if (made.size > 24) made.delete(made.keys().next().value as string);
  }
  return p;
}

const ahead = new Map<string, GenRequest>();
export function nextEndless(kind: KindId, level: Level): Promise<Puzzle> {
  const k = `${kind}|${level}`;
  const req = ahead.get(k) ?? { kind, level, seed: randomSeed() };
  ahead.delete(k);
  const p = getPuzzle(req);
  void p.then(() => prepareEndless(kind, level)).catch(() => {});
  return p;
}
export function prepareEndless(kind: KindId, level: Level) {
  const k = `${kind}|${level}`;
  if (ahead.has(k)) return;
  const req = { kind, level, seed: randomSeed() };
  ahead.set(k, req);
  void getPuzzle(req).catch(() => ahead.delete(k));
}
