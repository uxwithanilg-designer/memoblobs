// Puzzle supply for the UI: asks the worker (main-thread fallback if workers aren't available), remembers results by
// request, and keeps the next endless puzzle of the board you're playing already made.
import type { BoardId, Level, Puzzle } from "./boards";
import type { GenRequest } from "./generator";
import { randomSeed } from "./rng";

let worker: Worker | null = null, broken = false, nextId = 0;
const waits = new Map<number, { ok: (p: Puzzle) => void; fail: (e: Error) => void }>();
const made = new Map<string, Promise<Puzzle>>();
const keyOf = (r: GenRequest) => `${r.board}|${r.level}|${r.seed}`;

function viaWorker(req: GenRequest): Promise<Puzzle> {
  return new Promise((ok, fail) => {
    try {
      if (!worker) {
        worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (m: MessageEvent<{ id: number; puzzle?: Puzzle; error?: string }>) => {
          const w = waits.get(m.data.id);
          if (!w) return;
          waits.delete(m.data.id);
          if (m.data.puzzle) w.ok(m.data.puzzle); else w.fail(new Error(m.data.error ?? "generator failed"));
        };
        worker.onerror = () => { broken = true; for (const w of waits.values()) w.fail(new Error("worker")); waits.clear(); worker = null; };
      }
      const id = ++nextId;
      waits.set(id, { ok, fail });
      worker.postMessage({ id, req });
    } catch (e) { broken = true; fail(e as Error); }
  });
}

async function onMain(req: GenRequest): Promise<Puzzle> {
  const { generatePuzzle } = await import("./generator");
  await new Promise((r) => setTimeout(r, 0));
  return generatePuzzle(req);
}

export function getPuzzle(req: GenRequest): Promise<Puzzle> {
  const k = keyOf(req);
  let p = made.get(k);
  if (!p) {
    p = (broken ? onMain(req) : viaWorker(req).catch(() => onMain(req)));
    p.catch(() => made.delete(k));
    made.set(k, p);
    if (made.size > 24) made.delete(made.keys().next().value as string);
  }
  return p;
}

// one ready-made endless puzzle per board + level
const ahead = new Map<string, GenRequest>();
export function nextEndless(board: BoardId, level: Level): Promise<Puzzle> {
  const k = `${board}|${level}`;
  const req = ahead.get(k) ?? { board, level, seed: randomSeed() };
  ahead.delete(k);
  const p = getPuzzle(req);
  // as soon as this one exists, start the one after it
  void p.then(() => prepareEndless(board, level)).catch(() => {});
  return p;
}
export function prepareEndless(board: BoardId, level: Level) {
  const k = `${board}|${level}`;
  if (ahead.has(k)) return;
  const req = { board, level, seed: randomSeed() };
  ahead.set(k, req);
  void getPuzzle(req).catch(() => ahead.delete(k));
}
