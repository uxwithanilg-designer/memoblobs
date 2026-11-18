// Momo Dash! chunk library: hand-made 3-lane track pieces. Each row is 3 cells (left, centre, right), rows are read
// NEAR → FAR, one row = ROW metres (stretched by difficulty). The generator mirrors them, fills empty lanes with coin
// lines and reskins every piece for the world, so a few dozen pieces make thousands of different-feeling sections.
//   .  empty          o  coin               J  low fence (jump)       S  high bar (squish under)
//   B  block (switch) C  oncoming cart       G  Grumpy (bonk or dodge) T  tram (ramp up to run on the roof)
//   R  ramp up to a tram roof   _  gap (jump it)   K  rolling boulder / snowball   I  ice (slow lane changes)
//   < >  conveyor belt (pushes you)   H  ghost block (blinks in and out)   =  rail (jump on and grind)
//   L  slow traffic driving away   Z  zoom pad   ^  lava geyser (erupts on a beat)   { }  wind gust (pushes a lane)
//   M  morph gate (Ball, Split, Giant or Stretch — whichever the world has)
// Rule of thumb: every row leaves at least one lane free of B/C/T, and rows that force a lane change sit two rows
// apart (tier 4–5 may ask for a quick one-lane hop).
export interface Chunk { id: string; tier: number; rows: string[] }

const C = (id: string, tier: number, rows: string): Chunk => ({ id, tier, rows: rows.split("/") });

export const CHUNKS: Chunk[] = [
  // ---- tier 1: one thing at a time, coins to follow
  C("coins-l", 1, "o../o../o../o../o.."),
  C("coins-c", 1, ".o./.o./.o./.o./.o./.o."),
  C("coins-zig", 1, "o../o../.o./.o./..o/..o"),
  C("blk-1", 1, "B../.o./.o./.o."),
  C("blk-2", 1, ".B./o.o/o.o/o.o"),
  C("blk-3", 1, "..B/o../o../o.."),
  C("blk-4", 1, "B.B/.o./.o./.o./.o."),
  C("fen-1", 1, "J../o../o../o.."),
  C("fen-2", 1, ".J./.o./.o./.o."),
  C("bar-1", 1, ".S./.o./.o./.o."),
  C("bar-2", 1, "S../o../o.."),
  C("grp-1", 1, ".G./o.o/o.o"),
  C("crt-1", 1, "..C/.o./.o./.o."),
  C("crt-2", 1, "C../.o./.o./.o."),
  C("tram-1", 1, "R../T../T../T../T../o.."),
  C("tram-2", 1, "..R/..T/..T/..T/.o./.o."),
  // ---- tier 2: one free lane, or everyone jumps / squishes
  C("blk-5", 2, "BB./.../..o/..o/..o"),
  C("blk-6", 2, ".BB/.../o../o../o.."),
  C("blk-7", 2, "B.B/.../.../.B./o.o"),
  C("fen-3", 2, "JJJ/.../ooo"),
  C("fen-4", 2, "JJ./.../..o/..o"),
  C("bar-3", 2, "SSS/.../.o./.o."),
  C("bar-4", 2, ".SS/.../o../o.."),
  C("mix-1", 2, "J.S/.o./.o./.o."),
  C("mix-2", 2, "S.J/.o./.o./.o."),
  C("mix-3", 2, "B.J/.../.o./.o."),
  C("crt-3", 2, "C.C/.o./.o./.o./.o."),
  C("grp-2", 2, "G.G/.../.G./.../G.G"),
  C("tram-3", 2, "T.T/T.T/T.T/.o./.o."),
  C("tram-4", 2, ".R./.T./.T./.T./.T./..."),
  // ---- tier 3: weaves, rhythms, carts in a row, rooftop runs
  C("weave-1", 3, "B.B/.../.B./.../B.B"),
  C("weave-2", 3, "BB./.../.BB/.../BB."),
  C("rhy-1", 3, "JJJ/.../.../SSS"),
  C("rhy-2", 3, "SSS/.../.../JJJ"),
  C("mix-4", 3, "J.B/.../B.S/.../.J."),
  C("mix-5", 3, "S.S/.J./.../B.B/.o."),
  C("crt-4", 3, "C../.../.C./.../..C"),
  C("crt-5", 3, "CC./.../..C/..."),
  C("crt-6", 3, ".C./.../B.B/.o."),
  C("grp-3", 3, "G.B/.../B.G/.../.G."),
  C("roof-1", 3, "T.T/TRT/TTT/TTT/..."),
  C("roof-2", 3, "R.B/T../T.B/T../..."),
  // ---- tier 4: two things close together
  C("w-1", 4, "BB./..J/.BB/S../.B."),
  C("w-2", 4, "J.J/.C./.../SSS/.../B.B"),
  C("w-3", 4, "C.B/.../B.C/.../.C."),
  C("w-4", 4, "JJJ/.../SSS/.../JJJ"),
  C("w-5", 4, "G.G/.S./G.G/.J./G.G"),
  C("w-6", 4, "C.C/.../.../.C./.../C.C"),
  C("roof-3", 4, "R.T/T.T/T.T/T.B/T.."),
  // ---- tier 5: corridors and fast mixes
  C("x-1", 5, "B.B/.J./B.B/.S./B.B/.C."),
  C("x-2", 5, "JS./..B/S.J/B../.SJ"),
  C("x-3", 5, "C.C/.../JJJ/.../C.C/.../SSS"),
  C("x-4", 5, "BB./.../..S/.J./B../.../.BB"),
  C("x-5", 5, "T.T/T.T/TRT/TTT/TTT/.../S.S"),
  // ---- Jungle Ruins: gaps and rolling boulders
  C("gap-1", 1, "_../o../o../o.."),
  C("gap-2", 1, ".o./._./.o./.o./.o."),
  C("roll-1", 1, "..K/.o./.o./.o."),
  C("gap-3", 2, "___/.../ooo"),
  C("gap-4", 2, "__./.../..o/..o"),
  C("roll-2", 2, "K.K/.o./.o./.o."),
  C("gap-5", 3, "___/.../B.B/.../___"),
  C("roll-3", 3, "K../.../.K./.../..K"),
  C("jung-1", 3, "_.K/.../K._/.../.J."),
  C("gap-6", 4, "_B_/.../B_B/.../_._"),
  C("jung-2", 5, "___/.K./.../K.K/.../SSS"),
  // ---- Snowy Village: ice
  C("ice-1", 1, "I../I../I../o.."),
  C("ice-2", 2, "III/III/.../ooo"),
  C("ice-3", 3, "I.I/IBI/I.I/.o."),
  C("snow-1", 3, "I.K/I../K.I/.../.S."),
  C("ice-4", 4, "IIB/III/BII/III/IIB"),
  // ---- Toy Factory: conveyor belts and morph gates
  C("belt-1", 1, ">../>../>../.o."),
  C("belt-2", 1, ".>./.>./..o/..o"),
  C("belt-3", 3, "<<</<<</.../B.."),
  C("belt-4", 4, ">>>/>>>/B../.../<<</<<</..B"),
  C("morph-1", 1, ".M./.o./.o./.o./.o./.o."),
  C("morph-2", 2, "M.M/.../ooo/ooo"),
  C("morph-3", 3, "M../.../.B./B.B/.o."),
  // ---- Spooky Fair: ghost blocks
  C("ghost-1", 1, "H../.o./.o./.o."),
  C("ghost-2", 2, ".H./o.o/o.o"),
  C("ghost-3", 3, "H.H/.../.H./.../H.H"),
  C("ghost-4", 4, "HH./.../.HH/.../HH."),
  // ---- Canyon Mines: rails to grind
  C("rail-1", 1, "=../=../=../o.."),
  C("rail-2", 2, ".=./.=./.=./.=."),
  C("rail-3", 3, "=.=/=.=/=.=/.../.B."),
  C("rail-4", 4, "===/===/===/.../BB."),
  // ---- Neon City: slow traffic and zoom pads
  C("traf-1", 1, "L../.o./.o./.o."),
  C("zoom-1", 1, ".Z./.o./.o./.o."),
  C("traf-2", 2, "L.L/.o./.o./.o."),
  C("traf-3", 3, ".L./.../L.L/..."),
  C("neon-1", 4, "Z.C/.../C.Z/.../.L."),
  // ---- Lava Works: geysers
  C("gey-1", 1, "^../.o./.o."),
  C("gey-2", 2, ".^./o.o/o.o"),
  C("gey-3", 3, "^.^/.../.^./.../^.^"),
  C("gey-4", 4, "^^./.../.^^/.../^.^"),
  // ---- Sky Islands: wind gusts
  C("gust-1", 2, "}}}/.../..o/..o"),
  C("gust-2", 2, "{{{/.../o../o.."),
  C("gust-3", 3, "}}}/.../B../.../{{{/.../..B"),
  C("sky-1", 3, "_._/.../._./.../_._"),
];

/** a chunk with only coins — used for breathers */
export const isCoinOnly = (c: Chunk) => c.rows.every((r) => /^[o.]{3}$/.test(r));
