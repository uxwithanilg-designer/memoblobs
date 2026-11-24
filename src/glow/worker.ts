// Glowfold worker: builds puzzles off the main thread.
import { generatePuzzle, type GenRequest } from "./generator";

type Msg = { id: number; kind: "gen"; req: GenRequest };

self.onmessage = (m: MessageEvent<Msg>) => {
  const d = m.data;
  try {
    (self as unknown as Worker).postMessage({ id: d.id, puzzle: generatePuzzle(d.req) });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: d.id, error: String(e) });
  }
};
