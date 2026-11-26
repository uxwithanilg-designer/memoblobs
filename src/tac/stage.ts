// Neon Tac Duel stages. 600 designed stages, then the remix: stage n is built from its number (same board for everyone).
//
//   • 12 neon worlds × 50 stages, each with its own rule twist, colours and music: classic boards, bigger boards, pillars,
//     gravity drops, Infinity marks (only a few marks each — your oldest vanishes) and mixes of them all.
//   • Most stages are "win in N" puzzles: a position where you (X) can force a win in exactly N moves against a rival
//     that always blocks and always takes its own win. The solver (engine.ts) proves the win and that nothing shorter
//     works; among several positions the builder keeps the one with the most tempting wrong threats. N grows from 2 to 5.
//   • Every 10th stage is a duel: a whole game against the world's rival from an empty board. Win it to go on.
//   • After 600 the stages keep coming as remixes of every world's rules that stay hard.
import { rngFrom } from "../sudoku/rng";
import { clone, forcedWin, lineAt, playable, put, threats, X, O, PILLAR, type Rules, type State } from "./engine";

export interface World { id: string; name: string; rule: string; c1: string; c2: string; grid: string; music: string }
export const WORLDS: World[] = [
  { id: "city", name: "Neon City", rule: "classic", c1: "#ff3ec8", c2: "#22e4ff", grid: "#b44cff", music: "city" },
  { id: "lagoon", name: "Laser Lagoon", rule: "big", c1: "#ff5a8a", c2: "#3affd4", grid: "#38a0ff", music: "lagoon" },
  { id: "arcade", name: "Arcade Alley", rule: "pillars", c1: "#ffd23a", c2: "#38c8ff", grid: "#ff5ab0", music: "arcade" },
  { id: "drop", name: "Cyber Drop", rule: "gravity", c1: "#ff3e6a", c2: "#ffd23a", grid: "#4a7aff", music: "drop" },
  { id: "loop", name: "Synth Loop", rule: "infinity", c1: "#ff7a3a", c2: "#7affb4", grid: "#c04cff", music: "loop" },
  { id: "plaza", name: "Pixel Plaza", rule: "bigpillars", c1: "#ff3ec8", c2: "#a8ff3a", grid: "#30d0ff", music: "plaza" },
  { id: "highway", name: "Hyper Highway", rule: "gravitypillars", c1: "#ff4a4a", c2: "#38e8ff", grid: "#ff9a2a", music: "highway" },
  { id: "rink", name: "Retro Rink", rule: "biginfinity", c1: "#ff8ad8", c2: "#5ad8ff", grid: "#8a5aff", music: "rink" },
  { id: "vault", name: "Volt Vault", rule: "five", c1: "#fff03a", c2: "#ff3ec8", grid: "#3affb0", music: "vault" },
  { id: "garden", name: "Glow Garden", rule: "mix", c1: "#7aff5a", c2: "#ff5ad0", grid: "#2ad8a0", music: "garden" },
  { id: "port", name: "Star Port", rule: "mix", c1: "#5ab4ff", c2: "#ffb43a", grid: "#ff4ab0", music: "port" },
  { id: "core", name: "Ultra Core", rule: "mix", c1: "#ff2a6a", c2: "#2affea", grid: "#ffea2a", music: "core" },
];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 600;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef {
  stage: number; seed: string; rules: Rules; start: State; kind: "puzzle" | "duel";
  /** puzzle: X moves allowed (= the shortest forced win); duel: 0 */
  moves: number; path: number[]; boss: boolean; showcase: boolean; skill: number; traps: number; ruleName: string;
}

const RULESETS: Record<string, (nd: number, big: number) => Rules & { pillars: number }> = {
  classic: (nd, big) => nd < 6 && !big ? { cols: 3, rows: 3, k: 3, gravity: false, keep: 0, pillars: 0 } : nd < 14 ? { cols: 4, rows: 4, k: 3, gravity: false, keep: 0, pillars: 1 } : { cols: 5, rows: 5, k: 4, gravity: false, keep: 0, pillars: big },
  big: (nd, big) => ({ cols: 5 + big, rows: 5 + big, k: 4, gravity: false, keep: 0, pillars: 0 }),
  pillars: (nd, big) => ({ cols: 5, rows: 5, k: 4, gravity: false, keep: 0, pillars: 3 + big * 2 }),
  gravity: (nd, big) => ({ cols: 6 + big, rows: 5 + big, k: 4, gravity: true, keep: 0, pillars: 0 }),
  infinity: (nd, big) => ({ cols: 4, rows: 4, k: 3, gravity: false, keep: 3 + big, pillars: 0 }),
  bigpillars: (nd, big) => ({ cols: 6, rows: 6, k: 4, gravity: false, keep: 0, pillars: 4 + big * 2 }),
  gravitypillars: (nd, big) => ({ cols: 7, rows: 6, k: 4, gravity: true, keep: 0, pillars: 2 + big }),
  biginfinity: (nd, big) => ({ cols: 5, rows: 5, k: 4, gravity: false, keep: 4 + big, pillars: 0 }),
  five: (nd, big) => ({ cols: 7, rows: 7, k: 5, gravity: false, keep: 0, pillars: big * 3 }),
};
const MIXABLE = ["big", "pillars", "gravity", "infinity", "bigpillars", "gravitypillars", "biginfinity", "five"];
export const RULE_LABEL: Record<string, string> = {
  classic: "Classic", big: "Big board", pillars: "Pillars", gravity: "Gravity drop", infinity: "Infinity marks",
  bigpillars: "Pillar maze", gravitypillars: "Gravity + pillars", biginfinity: "Big Infinity", five: "Five in a row",
};

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 300 + (n % 300)) : n;
  const w = Math.floor((n - 1) / STAGES_PER_WORLD);
  const rng = rngFrom(`tac-rule:${stage}`);
  let rule = pass || WORLDS[w].rule === "mix" ? MIXABLE[rng.int(MIXABLE.length)] : WORLDS[w].rule;
  // the classic world eases in, then shows the other rules early on as a taste
  if (!pass && w === 0 && inG >= 30 && inG % 10 === 5) rule = ["pillars", "infinity"][Math.floor(inG / 10) % 2];
  const duel = !tutorial && (inG % 10 === 9);
  // duels use a board where the first player can really win (Five in a row on 7×7 and pillar boards end in draws)
  if (duel) rule = ({ five: "bigpillars", pillars: "big", gravitypillars: "gravity" } as Record<string, string>)[rule] ?? rule;
  const big = boss || showcase ? 1 : 0;
  // the forced win: 2 moves early, 3 from stage 8, 4 later (more and more often), 5 on late finales
  const depth = tutorial || nd < 14 ? 2 : nd < 60 ? 3 : Math.min(5, 3 + (nd > 160 && (rng.next() < Math.min(0.85, nd / 500)) ? 1 : 0) + (big && nd > 300 ? 1 : 0));
  // rival threats to answer first (from stage 120), the rival's duel skill
  const counter = nd > 120 && rng.next() < 0.35;
  const skill = Math.min(0.97, 0.55 + nd / 900);
  return { n, nd, pass, boss, showcase, tutorial, rule, duel, big, depth, counter, skill, rng };
}

export function buildStage(stage: number): StageDef {
  const p = paramsOf(stage);
  const seed = `tac:${stage}`;
  const rng = rngFrom(seed);
  const { pillars, ...rules } = RULESETS[p.rule](p.nd, p.big);
  const R: Rules = rules;
  const cells = R.cols * R.rows;
  const blank = (): State => {
    const s: State = { cells: new Int8Array(cells), order: [[], []] };
    for (let i = 0, t = 0; i < pillars && t < 200; t++) {
      const c = rng.int(cells);
      // gravity pillars sit low (a pillar high in the air would leave the column above it unreachable for long)
      if (s.cells[c] || (R.gravity && Math.floor(c / R.cols) < R.rows - 2)) continue;
      s.cells[c] = PILLAR; i++;
    }
    return s;
  };
  const base = { stage, seed, rules: R, boss: p.boss, showcase: p.showcase, skill: p.skill, ruleName: p.rule };
  if (p.duel) return { ...base, start: blank(), kind: "duel", moves: 0, path: [], traps: 0 };

  let best: { s: State; path: number[]; traps: number; score: number } | null = null;
  const want = p.depth;
  for (let attempt = 0, found = 0; attempt < 900 && found < (p.tutorial ? 1 : 5); attempt++) {
    // relax the depth if this board refuses to give one (rare)
    const depth = attempt > 600 ? Math.max(2, want - 1) : want;
    const s = blank();
    // X's marks gather round a spot, O's mix close and wide; equal counts, X to move
    const cap = Math.max(2, Math.floor((cells - pillars - 2 * depth - 1) / 2));
    const nx = R.keep ? R.keep : Math.max(2, Math.min(cap, R.k - 2 + depth + rng.int(2)));
    const no = R.keep ? R.keep : nx;
    const cx = rng.int(R.cols), cy = rng.int(R.rows);
    const near = (rad: number) => { const x = Math.max(0, Math.min(R.cols - 1, cx + rng.int(rad * 2 + 1) - rad)), y = Math.max(0, Math.min(R.rows - 1, cy + rng.int(rad * 2 + 1) - rad)); return y * R.cols + x; };
    let ok = true;
    const turns: [number, 1 | 2][] = [];
    for (let i = 0; i < Math.max(nx, no); i++) { if (i < nx) turns.push([0, X]); if (i < no) turns.push([0, O]); }
    for (const t of turns) {
      let placed = -1;
      for (let tries = 0; tries < 30 && placed < 0; tries++) {
        let c = t[1] === X ? near(2) : rng.next() < 0.6 ? near(2) : rng.int(cells);
        if (R.gravity) { const col = c % R.cols; c = -1; for (let y = R.rows - 1; y >= 0; y--) { const j = y * R.cols + col; if (s.cells[j] === 0) { c = j; break; } } if (c < 0) continue; }
        if (s.cells[c]) continue;
        put(R, s, c, t[1]);
        // nobody may already have a line
        if (lineAt(R, s, c, t[1])) { s.cells[c] = 0; s.order[t[1] - 1].pop(); continue; }
        placed = c;
      }
      if (placed < 0) { ok = false; break; }
    }
    if (!ok || playable(R, s).length < 4) continue;
    if (threats(R, s, X).length) continue;                    // no win in one
    const their = threats(R, s, O).length;
    if (their > 1 || (their === 1 && !p.counter)) continue;   // a rival threat only when the stage wants one
    const path = forcedWin(R, s, depth, { n: 40000 });
    if (!path) continue;
    const moves = Math.ceil(path.length / 2);
    if (moves !== depth) continue;
    found++;
    // traps: your threat moves that look good but don't win in time
    let traps = 0, tries = 0;
    for (const c of playable(R, s)) {
      const t = clone(s); put(R, t, c, X);
      if (!threats(R, t, X).length || c === path[0]) continue;
      tries++;
      const T = threats(R, t, X);
      if (T.length >= 2) continue;
      const u = clone(t); put(R, u, T[0], O);
      if (!forcedWin(R, u, depth - 1, { n: 8000 })) traps++;
      if (tries > 12) break;
    }
    const score = traps * 3 + rng.next();
    if (!best || score > best.score) best = { s, path, traps, score };
  }
  if (!best) { if (stage <= 1) throw new Error("tac: stage 1 failed"); return { ...buildStage(stage - 1), stage, seed }; }
  return { ...base, start: best.s, kind: "puzzle", moves: Math.ceil(best.path.length / 2), path: best.path, traps: best.traps };
}
