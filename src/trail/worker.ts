// Trailfold worker: builds puzzles and finds hints off the main thread.
import { generatePuzzle, type GenRequest } from "./generator";
import { solve, type Clues } from "./solver";

type Msg = { id: number; kind: "gen"; req: GenRequest } | { id: number; kind: "hint"; clues: Clues; prefix: number[] };

self.onmessage = (m: MessageEvent<Msg>) => {
  const d = m.data;
  try {
    if (d.kind === "gen") (self as unknown as Worker).postMessage({ id: d.id, puzzle: generatePuzzle(d.req) });
    else { const r = solve(d.clues, 1, 200000, d.prefix); (self as unknown as Worker).postMessage({ id: d.id, path: r.paths[0] ?? null }); }
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: d.id, error: String(e) });
  }
};
