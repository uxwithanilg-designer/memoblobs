// Kiko's Jungle Quest chunk library: hand-made 3-lane pieces of forest. Each row is 3 cells (left, centre, right), rows
// are read NEAR → FAR, one row = ROW metres (stretched by difficulty). The generator mirrors them, fills empty lanes with
// banana lines and reskins every piece for the region, so a few dozen pieces make thousands of different-feeling runs.
// Forest floor:
//   .  empty           o  bananas         F  a fruit             J  fallen log (jump)       T  thorn bush (jump)
//   X  poison mushrooms (jump)            S  low branch / bee hive (slide under)            B  big rock or stump (dodge)
//   K  rolling coconut (comes at you)     C  falling coconut (drops in front — watch the shadow)
//   P  banana peel (jump it — or WHEEE!)  _  pit (jump it)       U  bouncy mushroom (BOING — big jump)
// River (raft rides):  r  river rock (dodge)   L  floating log (jump)   g  crocodile (jump — or hop on its back)   S  low branch
// Lily pads:  l  pad   ~  water (jump it)        Rope bridges:  =  plank   ~  nothing (jump it or switch)
// Rule of thumb: every row leaves at least one lane free of B / r, and rows that force a lane change sit two rows apart.
export interface Chunk { id: string; tier: number; rows: string[] }

const C = (id: string, tier: number, rows: string): Chunk => ({ id, tier, rows: rows.split("/") });

export const GROUND: Chunk[] = [
  // ---- tier 1: one thing at a time, bananas to follow
  C("bn-l", 1, "o../o../o../o../o.."),
  C("bn-c", 1, ".o./.o./.o./.o./.o./.o."),
  C("bn-zig", 1, "o../o../.o./.o./..o/..o"),
  C("bn-fr", 1, ".o./.o./.F./.o./.o."),
  C("rk-1", 1, "B../.o./.o./.o."),
  C("rk-2", 1, ".B./o.o/o.o/o.o"),
  C("rk-3", 1, "..B/o../o../o.."),
  C("rk-4", 1, "B.B/.o./.o./.o./.o."),
  C("lg-1", 1, "J../o../o../o.."),
  C("lg-2", 1, ".J./.o./.o./.o."),
  C("lw-1", 1, ".S./.o./.o./.o."),
  C("lw-2", 1, "S../o../o.."),
  C("th-1", 1, ".T./o.o/o.o"),
  C("sh-1", 1, "X../.o./.o."),
  C("pl-1", 1, ".P./o.o/o.o"),
  C("co-1", 1, ".C./o.o/o.o"),
  // ---- tier 2: one free lane, or everyone jumps / slides
  C("rk-5", 2, "BB./.../..o/..o/..o"),
  C("rk-6", 2, ".BB/.../o../o../o.."),
  C("lg-3", 2, "JJJ/.../ooo"),
  C("lw-3", 2, "SSS/.../.o./.o."),
  C("lw-4", 2, ".SS/.../o../o.."),
  C("mx-1", 2, "J.S/.o./.o./.o."),
  C("mx-2", 2, "S.J/.o./.o./.o."),
  C("mx-3", 2, "B.J/.../.o./.o."),
  C("th-2", 2, "T.T/.o./.F./.o."),
  C("sh-2", 2, "XX./.../..o/..o"),
  C("rl-1", 2, "K../.o./.o./.o."),
  C("rl-2", 2, "..K/.o./.o./.o."),
  C("pt-1", 2, "._./o.o/o.o"),
  C("pt-2", 2, "_../.o./.o./.o."),
  C("co-2", 2, "C.C/.o./.o."),
  C("pl-2", 2, "P.P/.o./.o."),
  C("bo-1", 2, "U../.../o../o.."),
  C("bo-2", 2, ".U./.../.o./.o."),
  // ---- tier 3: weaves, rhythms, coconuts in a row
  C("wv-1", 3, "B.B/.../.B./.../B.B"),
  C("wv-2", 3, "BB./.../.BB/.../BB."),
  C("ry-1", 3, "JJJ/.../.../SSS"),
  C("ry-2", 3, "SSS/.../.../JJJ"),
  C("mx-4", 3, "J.B/.../B.S/.../.J."),
  C("mx-5", 3, "S.S/.J./.../B.B/.o."),
  C("rl-3", 3, "K../.../.K./.../..K"),
  C("rl-4", 3, "KK./.../..K/..."),
  C("pt-3", 3, "_._/.../.../._."),
  C("pt-4", 3, "__./.../..o/..o"),
  C("th-3", 3, "TXT/.../.o./.o."),
  C("co-3", 3, "C.C/.../.C./.o."),
  C("pl-3", 3, "P.P/.../.P./.o."),
  C("bo-3", 3, "U.U/.../._./.o."),
  // ---- tier 4: quick decisions
  C("wv-3", 4, "B../.../.B./..S/..B"),
  C("mx-6", 4, "JS./.../..B/.../BJ."),
  C("mx-7", 4, "S.B/.../B.J/.../.SB"),
  C("rl-5", 4, "K.K/.../.../.K."),
  C("pt-5", 4, "_B./.../.._/B../..."),
  C("mx-8", 4, "XSX/.../.../B.B/.J."),
  C("rk-7", 4, "B.B/.J./.../BB./..."),
  C("co-4", 4, "CPC/.../.../.C./P.P"),
  // ---- tier 5: everything at once
  C("x-1", 5, "BJ./..S/.B./J../..B"),
  C("x-2", 5, "_S_/.../B.B/.J./SBS"),
  C("x-3", 5, "K.B/.../B.K/.../.K."),
  C("x-4", 5, "T.T/.S./.../_B_/..."),
  C("x-5", 5, "PBP/.../S.X/.../.CB"),
  // ---- region hazards: webs (W), mud (M), geysers / lightning puddles (G), wind gusts ({ }), ice (I)
  C("wb-1", 1, "W../.o./.o."),
  C("wb-2", 2, ".W./o.o/o.o"),
  C("wb-3", 2, "WW./.../..o/..o"),
  C("wb-4", 3, "W.W/.../.W./.o."),
  C("wb-5", 4, "J.W/.../.S./W.B"),
  C("md-1", 1, "M../M../o.."),
  C("md-2", 2, ".M./.M./.o./.o."),
  C("md-3", 2, "MM./MM./..o/..o"),
  C("md-4", 3, "M.M/M.M/.J./..."),
  C("md-5", 4, "MMM/.../B.J/.../.S."),
  C("gy-1", 1, "G../.o./.o."),
  C("gy-2", 2, ".G./o.o/o.o"),
  C("gy-3", 3, "G.G/.../.G./.o."),
  C("gy-4", 4, "GGG/.../.../B.G"),
  C("gy-5", 5, "G.B/.G./.../B.G/.G."),
  C("gs-1", 2, "{../.o./.o./.o."),
  C("gs-2", 2, "..}/.o./.o./.o."),
  C("gs-3", 3, "{.}/.../.o./.J."),
  C("gs-4", 4, ".{./.../B../..}/.B."),
  C("ic-1", 1, "III/III/.o./.o."),
  C("ic-2", 2, "I.I/I.I/.B./..."),
  C("ic-3", 3, "III/III/B.B/.../.K."),
  C("ic-4", 4, "I.I/IBI/.../K.K"),
];

export const RIVER: Chunk[] = [
  C("rf-1", 1, "r../.o./.o./.o."),
  C("rf-2", 1, ".r./o.o/o.o"),
  C("rf-3", 1, "..L/o../o.."),
  C("rf-4", 1, "o../o../.o./.o./..o/..o"),
  C("rf-5", 2, "LLL/.../ooo"),
  C("rf-6", 2, "g../.o./.o."),
  C("rf-7", 2, ".S./.o./.o."),
  C("rf-8", 2, "rr./.../..o/..o"),
  C("rf-9", 3, "r.r/.../.g./.o."),
  C("rf-10", 3, "L.S/.../.r./..."),
  C("rf-11", 3, "SSS/.../.../LLL"),
  C("rf-12", 4, "g.g/.../.r./.../g.."),
  C("rf-13", 4, "r.L/.../L.r/.../.g."),
  C("rf-14", 5, "rg./.../..r/.S./gr."),
];

export const LILY: Chunk[] = [
  C("ly-1", 1, "lll/~~~/lll/lll/~~~/lll"),
  C("ly-2", 1, "lll/lll/~l~/~l~/lll"),
  C("ly-3", 2, "l~l/l~l/~l~/~l~/l~l"),
  C("ly-4", 2, "lll/l~~/l~~/lll/~~l/~~l/lll"),
  C("ly-5", 3, "~l~/~l~/~~~/~l~/~l~/lll"),
  C("ly-6", 3, "ll~/~ll/~~l/~ll/ll~"),
  C("ly-7", 4, "l~~/l~~/~~~/~~l/~~l/~ll"),
  C("ly-8", 5, "~l~/~~~/l~l/~~~/~l~/lll"),
];

export const BRIDGE: Chunk[] = [
  C("br-1", 1, "~=~/~=~/~=~/~=~/~=~/~=~"),
  C("br-2", 1, "=~=/=~=/=~=/=~=/=~="),
  C("br-3", 2, "===/=~=/===/~=~/==="),
  C("br-4", 2, "~=~/~=~/~~~/~=~/~=~"),
  C("br-5", 3, "=~~/=~~/==~/~=~/~==/~~=/~~="),
  C("br-6", 4, "=~=/~~~/=~=/=~=/~~~/=~="),
  C("br-7", 5, "~=~/~~~/=~~/=~~/~~~/~~=/~~="),
];

export const isBananaOnly = (c: Chunk) => /^[.oF/]+$/.test(c.rows.join("/"));
