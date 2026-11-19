// Slurp Lab worker: Prof. Hoot's hints are solved here, and Endless / Daily stages are made here, off the main thread.
import { decodeStage, encodeStage, type StageRow } from "./stagefile";
import { hint } from "./solver";
import { makeStage } from "./generator";
import { depthOf, scoreOf, trapRate, twinsOf } from "./grader";
import { initState } from "./rules";
import type { Recipe } from "./generator";
import type { SlurperState, State } from "./types";

type Msg =
  | { id: number; kind: "hint"; row: StageRow; state: { blobs: number[]; cnt: number[]; bub: number[]; tiles: number[]; crates: number[]; sw: number; moves: number; sl: SlurperState[] } }
  | { id: number; kind: "gen"; rc: Recipe; name: string };

self.onmessage = (m: MessageEvent<Msg>) => {
  const d = m.data;
  if (d.kind === "hint") {
    const st = decodeStage(d.row);
    const x = d.state;
    const s: State = { blobs: Int8Array.from(x.blobs), cnt: Int8Array.from(x.cnt), bub: Uint8Array.from(x.bub), tiles: Uint8Array.from(x.tiles), crates: Uint8Array.from(x.crates), sw: x.sw, moves: x.moves, sl: x.sl.map((q) => ({ ...q, cells: q.cells.map((c) => [c[0], c[1]] as [number, number]) })) };
    (self as unknown as Worker).postMessage({ id: d.id, ...hint(st, s, 9000) });
    return;
  }
  // an Endless / Daily stage: a few seeds until one comes out; graded light (par = the planted solution)
  for (let k = 0; k < 40; k++) {
    const st = makeStage(d.rc, d.rc.n * 7919 + k * 104729, k > 12 ? 1 : 0) ?? (k > 25 ? makeStage({ ...d.rc, mech: {} }, d.rc.n * 31 + k, 2) : null);
    if (!st) continue;
    st.name = d.name;
    const start = initState(st);
    const trap = trapRate(st, 12, st.n);
    const depth = depthOf(st, start, st.solution);
    const m = { par: st.solution.length, planted: st.solution.length, events: st.solution.reduce((a, g) => a + g.dirs.length, 0), depth, trap, twins: twinsOf(st) };
    st.m = { ...m, score: scoreOf(m, st.colors, st.blobs.filter((b) => b >= 0).length, st.mech?.length ?? 0) };
    (self as unknown as Worker).postMessage({ id: d.id, row: encodeStage(st) });
    return;
  }
  (self as unknown as Worker).postMessage({ id: d.id, row: null });
};
