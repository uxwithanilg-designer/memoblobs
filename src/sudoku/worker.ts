// Sudoku Ninefold worker: builds puzzles off the main thread so the game never stutters while the next one is made.
import { generatePuzzle, type GenRequest } from "./generator";

self.onmessage = (m: MessageEvent<{ id: number; req: GenRequest }>) => {
  const { id, req } = m.data;
  try {
    (self as unknown as Worker).postMessage({ id, puzzle: generatePuzzle(req) });
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, error: String(e) });
  }
};
