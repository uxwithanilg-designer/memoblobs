// Flutter Pairs stages. 1000 designed stages, then the remix: stage n is built from its number (same for everyone).
//
//   • 20 felt worlds × 50 stages, each with its own felt colours and music.
//   • Every level is built from a PLAN: start from the stacks, then for each belt block choose a stack and either
//     pop its top (the block matches) or push a new colour onto it (below the rope); the plan ends with every stack
//     empty. The belt is the plan's blocks in order, so every level has a way through.
//   • To make it a puzzle, pushes often use a colour that sits on top of ANOTHER stack (a tempting pop that ruins
//     the plan), stacks run close to the rope, and the builder keeps, among several plans, the one where a careless
//     player (pop whenever you can, else the shortest stack) fails most. Two tutorial levels, then it ramps.
//   • Erase balls join around stage 10. After 1000 the stages keep coming as remixes that stay hard.
import { rngFrom } from "../sudoku/rng";
import { careless, thoughtful, ERASE, type Level } from "./engine";

export interface World { id: string; name: string; felt: [string, string]; ground: string; music: string }
export const WORLDS: World[] = [
  { id: "meadow", name: "Felt Meadow", felt: ["#bfe6f0", "#8fd0e0"], ground: "#8fcf6a", music: "meadow" },
  { id: "orchard", name: "Button Orchard", felt: ["#ffe2c8", "#f4b890"], ground: "#9ad06a", music: "orchard" },
  { id: "pond", name: "Lily Pond", felt: ["#c8ecf8", "#7ac4e0"], ground: "#6ac0a0", music: "pond" },
  { id: "garden", name: "Thimble Garden", felt: ["#ffe0ec", "#f4a8c4"], ground: "#a0d47a", music: "garden" },
  { id: "forest", name: "Woolly Woods", felt: ["#d8ecc8", "#9cc880"], ground: "#6aa858", music: "forest" },
  { id: "dunes", name: "Patchwork Dunes", felt: ["#fff0c8", "#f0cc80"], ground: "#e0b870", music: "dunes" },
  { id: "cliffs", name: "Stitch Cliffs", felt: ["#e0e8f8", "#a8b8e0"], ground: "#9ab0a0", music: "cliffs" },
  { id: "berry", name: "Berry Bramble", felt: ["#f4dcf0", "#d8a0d8"], ground: "#8ac07a", music: "berry" },
  { id: "snow", name: "Fleece Peaks", felt: ["#eef6ff", "#c4dcf4"], ground: "#e8f0f8", music: "snow" },
  { id: "autumn", name: "Yarn Autumn", felt: ["#ffe4c4", "#f0a070"], ground: "#d89a50", music: "autumn" },
  { id: "lagoon", name: "Bobbin Lagoon", felt: ["#c8f4ec", "#6ad4c4"], ground: "#5ac0a0", music: "lagoon" },
  { id: "night", name: "Moonlit Quilt", felt: ["#5a5a9a", "#2e2e60"], ground: "#4a6a70", music: "night" },
  { id: "sunset", name: "Sunset Seams", felt: ["#ffd0b8", "#f08a7a"], ground: "#c8905a", music: "sunset" },
  { id: "mint", name: "Mint Mitten", felt: ["#d8f8e8", "#90e0b8"], ground: "#7ad090", music: "mint" },
  { id: "lavender", name: "Lavender Loom", felt: ["#ece0fc", "#c0a8f0"], ground: "#9ab880", music: "lavender" },
  { id: "honey", name: "Honey Hollow", felt: ["#fff4c0", "#f8d060"], ground: "#c8b050", music: "honey" },
  { id: "coral", name: "Coral Cushion", felt: ["#ffe0dc", "#f8a8a0"], ground: "#e09a7a", music: "coral" },
  { id: "storm", name: "Storm Stitches", felt: ["#c8d0dc", "#8a98b0"], ground: "#7a8a8a", music: "storm" },
  { id: "rainbow", name: "Rainbow Ribbon", felt: ["#fce8f8", "#c8d8fc"], ground: "#a8d888", music: "rainbow" },
  { id: "starry", name: "Starry Spindle", felt: ["#3a3a7a", "#16163a"], ground: "#3a5a6a", music: "starry" },
];
/** felt block colours */
export const BLOCK_COLS = ["#ff5a5a", "#3a9aff", "#ffc83a", "#4ac86a", "#b06aff", "#ff8a3a", "#ff7ac8", "#3ad0d0", "#8a6a4a"];
export const BLOCK_NAMES = ["red", "blue", "yellow", "green", "purple", "orange", "pink", "teal", "brown"];
export const STAGES_PER_WORLD = 50;
export const DESIGNED = 1000;
export const worldOf = (stage: number) => WORLDS[Math.floor((stage - 1) / STAGES_PER_WORLD) % WORLDS.length];
export const passOf = (stage: number) => Math.floor((stage - 1) / DESIGNED);

export interface StageDef { stage: number; seed: string; level: Level; plan: number[]; boss: boolean; showcase: boolean; carelessWins: number; thoughtfulWins: number }

export function paramsOf(stage: number) {
  const pass = passOf(stage), n = ((stage - 1) % DESIGNED) + 1;
  const inG = (n - 1) % STAGES_PER_WORLD;
  const boss = inG === STAGES_PER_WORLD - 1, showcase = !boss && inG === 24;
  const tutorial = n <= 2 && !pass;
  const nd = pass ? Math.max(n, 500 + (n % 500)) : n;
  const big = boss || showcase ? 1 : 0;
  return {
    n, nd, pass, boss, showcase, tutorial,
    stacks: tutorial ? 3 : Math.min(5, 3 + Math.floor(nd / 120) + big),
    cap: tutorial ? 4 : nd < 40 ? 4 : nd < 300 ? 5 : 6,
    colors: tutorial ? 3 : Math.min(9, 4 + Math.floor(nd / 70) + big),
    pushes: tutorial ? [5, 8][n - 1] : Math.min(34, 9 + Math.floor(nd / 28) + big * 6),
    prefill: tutorial ? 1 : Math.min(4, 1 + Math.floor(nd / 150)),
    decoy: tutorial ? 0 : Math.min(0.55, 0.12 + nd / 1000),
    tight: tutorial ? 0 : Math.min(0.7, 0.2 + nd / 1000),   // how often the plan pushes onto the tallest stack
    erase: !tutorial && nd >= 10 ? Math.min(3, 1 + Math.floor(nd / 300)) : 0,
    local: tutorial ? 0.9 : Math.max(0.6, 0.88 - nd / 1800),
  };
}

export function buildStage(stage: number): StageDef {
  // a level a belt-reading player can't finish is eased (fewer decoys, lower stacks, fewer colours) and built again
  for (let ease = 0; ease < 5; ease++) {
    const d = buildWith(stage, ease);
    if (d && (d.thoughtfulWins || ease === 4)) return d;
  }
  return buildWith(1, 0)!;
}

function buildWith(stage: number, ease: number): StageDef | null {
  const p = paramsOf(stage);
  if (ease) {
    p.decoy *= Math.pow(0.65, ease); p.tight *= Math.pow(0.65, ease); p.local = Math.min(0.95, p.local + 0.08 * ease);
    p.pushes = Math.max(8, Math.round(p.pushes * (1 - 0.1 * ease))); p.colors = Math.max(4, p.colors - Math.floor(ease / 2));
  }
  const seed = `flutter:${stage}`;
  const rng = rngFrom(ease ? `${seed}:e${ease}` : seed);
  let best: { lv: Level; plan: number[]; wins: number; score: number; sharp: number } | null = null;
  for (let attempt = 0; attempt < (p.tutorial ? 1 : 5) && !(best && best.score > 23); attempt++) {
    const S = p.stacks, cap = p.cap, C = p.colors;
    // the stacks as you find them: a few blocks each, no two alike touching
    const stacks: number[][] = [];
    for (let i = 0; i < S; i++) {
      const s: number[] = [];
      const h = Math.min(cap - 1, p.prefill + (rng.next() < 0.4 ? 1 : 0) - (rng.next() < 0.3 ? 1 : 0));
      for (let k = 0; k < Math.max(0, h); k++) { let c = rng.int(C); if (s.length && s[s.length - 1] === c) c = (c + 1) % C; s.push(c); }
      stacks.push(s);
    }
    const start = stacks.map((s) => s.slice());
    const queue: number[] = [], plan: number[] = [];
    let pushes = p.pushes, erases = p.erase;
    const lastPushed: number[] = [];
    const tops = () => stacks.map((s) => (s.length ? s[s.length - 1] : -1));
    for (let guard = 0; guard < 2000; guard++) {
      const nonEmpty = stacks.map((s, i) => (s.length ? i : -1)).filter((i) => i >= 0);
      if (!pushes && !nonEmpty.length) break;
      const room = stacks.map((s, i) => (s.length < cap ? i : -1)).filter((i) => i >= 0);
      const wantPush = pushes > 0 && room.length && (nonEmpty.length === 0 || rng.next() < 0.58);
      if (wantPush) {
        // push: often onto the tallest stack with room (close to the rope), with a colour that tempts elsewhere
        const byHeight = room.slice().sort((a, b) => stacks[b].length - stacks[a].length);
        const i = rng.next() < p.tight ? byHeight[0] : room[rng.int(room.length)];
        const t = tops();
        let c = -1;
        if (rng.next() < p.decoy) { const others = t.filter((x, j) => j !== i && x >= 0 && x !== t[i]); if (others.length) c = others[rng.int(others.length)]; }
        if (c < 0) { c = rng.int(C); if (c === t[i]) c = (c + 1) % C; }
        stacks[i].push(c); queue.push(c); plan.push(i); pushes--; lastPushed.push(i);
      } else if (nonEmpty.length) {
        // pop: the block in hand matches a stack's top (or an erase ball takes it) — mostly the one pushed lately, so
        // the pairs sit close together on the belt and the preview lets you read them
        const recent = lastPushed.filter((j) => stacks[j].length);
        const i = recent.length && rng.next() < p.local ? recent[recent.length - 1] : nonEmpty[rng.int(nonEmpty.length)];
        const top = stacks[i].pop()!;
        { const k = lastPushed.lastIndexOf(i); if (k >= 0) lastPushed.splice(k, 1); }
        if (erases > 0 && rng.next() < 0.08) { queue.push(ERASE); erases--; } else queue.push(top);
        plan.push(i);
      }
    }
    if (stacks.some((s) => s.length)) continue;
    const lv: Level = { stacks: start, queue, cap, colors: C };
    // how often does a careless player get through? (lower = a better puzzle)
    let wins = 0;
    for (let r = 0; r < 8; r++) { let sd = (r + 1) * 7919 + attempt; if (careless(lv, () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; })) wins++; }
    // fair: a player reading the belt (the hand and the next four) must get through; hard: one who looks less mustn't
    const sharp = thoughtful(lv, 5) ? 1 : 0;
    const keen = sharp && p.nd >= 60 ? (thoughtful(lv, 3) ? 1 : 0) : 1;
    const score = (sharp ? 20 : 0) + (p.tutorial ? 0 : (8 - wins) * 0.6) + (keen ? 0 : 2) + rng.next() * 0.5;
    if (!best || score > best.score) best = { lv, plan, wins, score, sharp };
  }
  if (!best) return null;
  return { stage, seed, level: best.lv, plan: best.plan, boss: p.boss, showcase: p.showcase, carelessWins: best.wins, thoughtfulWins: best.sharp };
}
