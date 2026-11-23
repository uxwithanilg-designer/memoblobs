// The rules of play on one board, as plain functions: placing numbers and pencil notes, undo, erase, hints, mistakes
// and which rows / columns / boxes a move just completed. The UI keeps a Game in state and turns the events into
// sound and animation.
import { geometry, type Puzzle } from "./boards";

export interface Step { cells: number[]; values: number[]; notes: number[] }
export interface Game {
  p: Puzzle;
  values: number[];
  notes: number[];
  undo: Step[];
  mistakes: number;
  hints: number;
}
export type PlayEvent =
  | { kind: "place"; cell: number; value: number; units: number[][]; solved: boolean }
  | { kind: "wrong"; cell: number; value: number }
  | { kind: "note"; cell: number }
  | { kind: "erase"; cell: number }
  | { kind: "undo"; cell: number }
  | { kind: "hint"; cell: number; value: number; units: number[][]; solved: boolean }
  | { kind: "none" };

export function newGame(p: Puzzle, saved?: { values: number[]; notes: number[]; mistakes: number; hints: number }): Game {
  return {
    p,
    values: saved?.values.slice() ?? p.givens.map((v) => (v > 0 ? v : 0)),
    notes: saved?.notes.slice() ?? new Array(p.givens.length).fill(0),
    undo: [],
    mistakes: saved?.mistakes ?? 0,
    hints: saved?.hints ?? 0,
  };
}

export const isGiven = (g: Game, i: number) => g.p.givens[i] > 0;
export const isWrong = (g: Game, i: number) => g.values[i] > 0 && g.values[i] !== g.p.solution[i];
export const solved = (g: Game) => g.values.every((v, i) => g.p.givens[i] < 0 || v === g.p.solution[i]);

function snapshot(g: Game, cells: number[]): Step { return { cells, values: cells.map((c) => g.values[c]), notes: cells.map((c) => g.notes[c]) }; }

/** the units (rows, columns, boxes, diagonals) through a cell that are now completely and correctly filled */
function completedUnits(g: Game, cell: number): number[][] {
  const geo = geometry(g.p.board);
  return geo.units.filter((u) => u.includes(cell) && u.every((c) => g.values[c] === g.p.solution[c]));
}

export function place(g: Game, cell: number, v: number, notesMode: boolean): { g: Game; e: PlayEvent } {
  if (cell < 0 || isGiven(g, cell) || g.p.givens[cell] < 0) return { g, e: { kind: "none" } };
  if (g.values[cell] === g.p.solution[cell] && g.values[cell] > 0) return { g, e: { kind: "none" } };
  if (notesMode) {
    if (g.values[cell]) return { g, e: { kind: "none" } };
    const step = snapshot(g, [cell]);
    const notes = g.notes.slice();
    notes[cell] ^= 1 << (v - 1);
    return { g: { ...g, notes, undo: [...g.undo, step].slice(-200) }, e: { kind: "note", cell } };
  }
  if (g.values[cell] === v) return { g, e: { kind: "none" } };
  const geo = geometry(g.p.board);
  const right = g.p.solution[cell] === v;
  const touched = right ? [cell, ...geo.peers[cell].filter((p) => g.notes[p] & (1 << (v - 1)))] : [cell];
  const step = snapshot(g, touched);
  const values = g.values.slice(), notes = g.notes.slice();
  values[cell] = v; notes[cell] = 0;
  if (right) for (const p of touched) if (p !== cell) notes[p] &= ~(1 << (v - 1));
  const next: Game = { ...g, values, notes, undo: [...g.undo, step].slice(-200), mistakes: g.mistakes + (right ? 0 : 1) };
  if (!right) return { g: next, e: { kind: "wrong", cell, value: v } };
  return { g: next, e: { kind: "place", cell, value: v, units: completedUnits(next, cell), solved: solved(next) } };
}

export function erase(g: Game, cell: number): { g: Game; e: PlayEvent } {
  if (cell < 0 || isGiven(g, cell) || g.p.givens[cell] < 0) return { g, e: { kind: "none" } };
  if (!g.values[cell] && !g.notes[cell]) return { g, e: { kind: "none" } };
  if (g.values[cell] && g.values[cell] === g.p.solution[cell]) return { g, e: { kind: "none" } };
  const step = snapshot(g, [cell]);
  const values = g.values.slice(), notes = g.notes.slice();
  if (values[cell]) values[cell] = 0; else notes[cell] = 0;
  return { g: { ...g, values, notes, undo: [...g.undo, step].slice(-200) }, e: { kind: "erase", cell } };
}

export function undo(g: Game): { g: Game; e: PlayEvent } {
  const step = g.undo[g.undo.length - 1];
  if (!step) return { g, e: { kind: "none" } };
  const values = g.values.slice(), notes = g.notes.slice();
  step.cells.forEach((c, k) => { values[c] = step.values[k]; notes[c] = step.notes[k]; });
  return { g: { ...g, values, notes, undo: g.undo.slice(0, -1) }, e: { kind: "undo", cell: step.cells[0] } };
}

/** candidates a cell still has given the numbers on the board (for hints and auto notes) */
export function candidates(g: Game, cell: number): number {
  const geo = geometry(g.p.board);
  let m = (1 << g.p.n) - 1;
  for (const p of geo.peers[cell]) if (g.values[p] > 0 && g.values[p] === g.p.solution[p]) m &= ~(1 << (g.values[p] - 1));
  return m;
}

/** reveal one cell: the selected one if it's open or wrong, else the open cell with the fewest candidates */
export function hint(g: Game, sel: number): { g: Game; e: PlayEvent } {
  let cell = -1;
  if (sel >= 0 && !isGiven(g, sel) && g.p.givens[sel] >= 0 && g.values[sel] !== g.p.solution[sel]) cell = sel;
  if (cell < 0) {
    let best = 99;
    for (let i = 0; i < g.values.length; i++) {
      if (g.p.givens[i] !== 0 || g.values[i] === g.p.solution[i]) continue;
      let c = 0;
      for (let m = candidates(g, i); m; m &= m - 1) c++;
      if (c < best) { best = c; cell = i; }
    }
  }
  if (cell < 0) return { g, e: { kind: "none" } };
  const r = place({ ...g }, cell, g.p.solution[cell], false);
  const next = { ...r.g, hints: g.hints + 1, mistakes: g.mistakes };
  const e = r.e.kind === "place" ? { ...r.e, kind: "hint" as const } : r.e;
  return { g: next, e };
}

/** pencil in every candidate for every open cell */
export function autoNotes(g: Game): Game {
  const notes = g.notes.slice();
  const cells: number[] = [];
  for (let i = 0; i < g.values.length; i++) if (g.p.givens[i] === 0 && !g.values[i]) { cells.push(i); notes[i] = candidates(g, i); }
  return { ...g, notes, undo: [...g.undo, snapshot(g, cells)].slice(-200) };
}

/** how many of each value are correctly on the board (the number pad greys out a finished value) */
export function valueCounts(g: Game): { have: number[]; need: number } {
  const have = new Array(g.p.n + 1).fill(0);
  let cells = 0;
  g.values.forEach((v, i) => { if (g.p.givens[i] >= 0) cells++; if (v > 0 && v === g.p.solution[i]) have[v]++; });
  return { have, need: cells / g.p.n };
}
