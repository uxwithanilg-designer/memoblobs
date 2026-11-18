// Infinite Fusion (Journey level 201 → ∞), Daily Fusion, Endless Roll, Concept Lab and Boss Rush recipes.
// Fusion levels mix 2–4 concept atoms chosen for novelty (pairs/triples the player has never played score highest),
// set them in one or two worlds' moods (hybrid themes), pick fresh music styles, and get a generated name.
// Every cleared fusion becomes a Concept Dex entry (#218, #219, …) and can be picked again later as a whole —
// so new concepts keep being born from old ones.
import { CONCEPT, CONCEPTS } from "./data/concepts";
import { compile, JOURNEY_LEN, type LevelRecipe } from "./levels";
import { Rng, hash32 } from "./rng";
import { WORLDS } from "./themes";

const PLAY = CONCEPTS.filter((c) => "FTHACR".includes(c.id[0]) && !["C01", "C11", "R21"].includes(c.id)).map((c) => c.id);
const FLOORS = PLAY.filter((id) => id[0] === "F" || id[0] === "T");
const HAZARDS = PLAY.filter((id) => id[0] === "H");
const SPICE = PLAY.filter((id) => "ACR".includes(id[0]));
export const BOSS_CONCEPTS = CONCEPTS.filter((c) => c.cat === "boss").map((c) => c.id);
const STYLES = Array.from({ length: 20 }, (_, i) => `M${String(i + 1).padStart(2, "0")}`);

const ADJ: Record<string, string> = {
  F02: "Tightrope", F03: "Zigzag", F04: "Wiggly", F05: "Hoppy", F06: "Holey", F07: "Combed", F08: "Forked", F09: "Triple", F10: "Squeezy", F11: "Wide",
  F12: "Tumbling", F13: "Climbing", F14: "Flying", F15: "Wavy", F16: "Tilty", F17: "Twisty", F18: "Swooshy", F19: "Drifting", F20: "Bobbing", F21: "Spinny",
  F22: "Conveyor", F23: "Mazy", F24: "Ladder", F25: "Loopy", T02: "Mega", T03: "Turbo", T04: "Muddy", T05: "Frosty", T06: "Sticky", T07: "Bouncy",
  T08: "Crumbly", T09: "Glassy", T10: "Blinky", T11: "Ghostly", T12: "Rainbow", T13: "Painted", T14: "Mirror", T15: "Zappy", T16: "Upside", T17: "Tiny",
  T18: "Giant", T19: "Magnetic", T20: "Pushy", T21: "Bridgy", T22: "Wobbly", T23: "Musical", T24: "Bumpy", T25: "Floaty",
  R05: "Midnight", R06: "Backwards", R07: "Speedy", R16: "Secret", R17: "Teeny", R18: "Mighty", R19: "Topsy", R25: "Silent", C04: "Reverse", C09: "Flipped",
};
const NOUN: Record<string, string> = {
  H01: "Mallet", H02: "Windmill", H03: "Hammers", H04: "Blocks", H05: "Crusher", H06: "Pillars", H07: "Crystals", H08: "Barrels", H09: "Pins", H10: "Laser",
  H11: "Gates", H12: "Rockfall", H13: "Cannons", H14: "Bouncers", H15: "Axes", H16: "Saws", H17: "Tops", H18: "Doors", H19: "Turnstile", H20: "Brooms",
  H21: "Gale", H22: "Jets", H23: "Geysers", H24: "Snowballs", H25: "Boulder", H26: "Lightning", H27: "Fireworks", H28: "Flood", H29: "Shadows", H30: "Fog",
  H31: "Claws", H32: "Gloops", H33: "Beam", H34: "Stompers", H35: "Rockets", H36: "Penguins", H37: "Books", H38: "Cakes", H39: "Noodle", H40: "Signs",
};
const STYLE_WORD: Record<string, string> = {
  M01: "Pop", M02: "Drop", M03: "Lo-fi", M04: "Phonk", M05: "Hyper", M06: "Dance", M07: "Masala", M08: "Tabla", M09: "Bleeps", M10: "Synth",
  M11: "Breaks", M12: "Trap", M13: "Saga", M14: "Swing", M15: "Ritmo", M16: "Groove", M17: "March", M18: "Lullaby", M19: "Wobble", M20: "House",
};

export const fusionKey = (atoms: string[]) => [...atoms].sort().join("+");
export function fusionName(atoms: string[], style: string) {
  const adj = atoms.map((a) => ADJ[a]).find(Boolean) ?? CONCEPT[atoms[0]]?.name.split(" ")[0] ?? "Mystery";
  const noun = atoms.map((a) => NOUN[a]).find(Boolean) ?? CONCEPT[atoms[atoms.length - 1]]?.name.split(" ").slice(-1)[0] ?? "Roll";
  return `${adj} ${noun} ${STYLE_WORD[style] ?? "Roll"}`;
}

export interface FusionMemory {
  /** fusion keys already played */
  seen: Set<string>;
  /** atoms used in the last ~10 levels */
  recent: string[];
  /** promoted fusions (Concept Dex) that can come back as a whole */
  promoted: string[][];
}

function pick(rng: Rng, mem: FusionMemory, size: number): string[] {
  let best: string[] = [], bestScore = -1e9;
  for (let t = 0; t < 48; t++) {
    let atoms: string[];
    if (mem.promoted.length && rng.chance(0.25)) {
      // a promoted fusion + one fresh atom = a concept of concepts
      atoms = [...rng.pick(mem.promoted).slice(0, 3), rng.pick(SPICE.concat(HAZARDS))];
    } else {
      atoms = [rng.pick(FLOORS), rng.pick(HAZARDS)];
      if (size >= 3) atoms.push(rng.pick(SPICE));
      if (size >= 4) atoms.push(rng.pick(HAZARDS));
    }
    atoms = [...new Set(atoms)].slice(0, 4);
    const key = fusionKey(atoms);
    let score = rng.next() * 0.5;
    if (!mem.seen.has(key)) score += 6;
    for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) if (!mem.seen.has(fusionKey([atoms[i], atoms[j]]))) score += 1;
    for (const a of atoms) if (mem.recent.includes(a)) score -= 2.5;
    if (score > bestScore) { bestScore = score; best = atoms; }
  }
  return best;
}

/** Infinite Fusion: Journey level n > 200 */
export function fusionRecipe(n: number, mem: FusionMemory): LevelRecipe {
  const rng = new Rng(hash32(0xf05, n));
  const k = n - JOURNEY_LEN;
  const loop = Math.floor((k - 1) / 50);
  const d = Math.min(1, 0.72 + 0.22 * (((k - 1) % 10) / 10) + loop * 0.02);
  const size = 2 + (k % 3 === 0 ? 2 : k % 2 === 0 ? 1 : 0);
  const atoms = pick(rng, mem, size);
  const boss = k % 10 === 0 ? rng.pick(BOSS_CONCEPTS) : null;
  const wA = rng.pick(WORLDS);
  const others = WORLDS.filter((w) => w.id !== wA.id);
  const wB = others.length ? rng.pick(others) : wA;
  const moods = [wA.moods[0], wA.moods[1] ?? wA.moods[0], wB.moods[0], wA.moods[2] ?? wA.moods[0], wB.moods[1] ?? wB.moods[0]];
  const style = rng.pick(STYLES.filter((s) => !mem.recent.includes(s)));
  const style2 = rng.pick(STYLES);
  const name = fusionName(atoms, style);
  return compile({
    id: n, kind: "fusion", world: wA.id, name, concepts: boss ? [...atoms, boss] : atoms, d, bpm: 112 + Math.round(d * 20) + rng.int(-3, 3),
    seed: hash32(0xf05, n, 7), moods, styles: [style, style, style2, style, style2], zones: boss ? 6 : 5,
    blurb: `Fusion #${217 + k}: ${atoms.map((a) => CONCEPT[a]?.name).join(" + ")}`,
    fusion: { name, atoms, key: fusionKey(atoms) },
  });
}

export const dailyKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Daily Fusion: the same level for everyone on a date */
export function dailyRecipe(key: string): LevelRecipe {
  const seed = hash32(...key.split("-").map(Number), 0xda1);
  const rng = new Rng(seed);
  const atoms = pick(rng, { seen: new Set(), recent: [], promoted: [] }, 3);
  const w = rng.pick(WORLDS);
  const style = rng.pick(STYLES);
  const name = fusionName(atoms, style);
  return compile({
    id: 9000 + (seed % 1000), kind: "daily", world: w.id, name, concepts: atoms, d: 0.66, bpm: 118, seed, styles: [style], zones: 5,
    blurb: `Today's fusion: ${atoms.map((a) => CONCEPT[a]?.name).join(" + ")}`, fusion: { name, atoms, key: fusionKey(atoms) },
  });
}

/** Endless Roll: one very long run through every kind of world; no checkpoints */
export function endlessRecipe(seed: number): LevelRecipe {
  const rng = new Rng(seed ^ 0xe0d1);
  const atoms = [...new Set(Array.from({ length: 12 }, (_, i) => (i % 2 ? rng.pick(HAZARDS) : rng.pick(FLOORS))))];
  const worlds = Array.from({ length: 4 }, () => rng.pick(WORLDS));
  const moods = worlds.flatMap((w) => w.moods.slice(0, 2));
  const rec = compile({
    id: 8000, kind: "endless", world: worlds[0].id, name: "Endless Roll", concepts: atoms, d: 0.7, bpm: 124, seed, moods,
    styles: Array.from({ length: 6 }, () => rng.pick(STYLES)), zones: 14, blurb: "How far can Momo roll?",
  });
  rec.oneLife = true;
  return rec;
}

/** Concept Lab: build your own level from up to 3 discovered concepts */
export function labRecipe(atoms: string[], world: number, style: string, seed: number): LevelRecipe {
  const name = fusionName(atoms, style);
  return compile({
    id: 7000, kind: "lab", world, name, concepts: atoms, d: 0.6, bpm: 116, seed, styles: [style], zones: 4,
    blurb: atoms.map((a) => CONCEPT[a]?.name).join(" + "), fusion: { name, atoms, key: fusionKey(atoms) },
  });
}

/** MOMO-XXXXXX share codes: seed + world + style + up to 3 atoms, base-36 */
export function encodeLab(atoms: string[], world: number, style: string, seed: number) {
  const ids = CONCEPTS.map((c) => c.id);
  const parts = [seed % 1296, world, Number(style.slice(1)), ...atoms.slice(0, 3).map((a) => ids.indexOf(a) + 1)];
  while (parts.length < 6) parts.push(0);
  return "MOMO-" + parts.map((p) => p.toString(36).padStart(2, "0")).join("").toUpperCase();
}
export function decodeLab(code: string): { atoms: string[]; world: number; style: string; seed: number } | null {
  const m = code.trim().toUpperCase().replace(/^MOMO-?/, "");
  if (!/^[0-9A-Z]{12}$/.test(m)) return null;
  const nums = (m.match(/.{2}/g) ?? []).map((p) => parseInt(p, 36));
  const ids = CONCEPTS.map((c) => c.id);
  const [seed, world, st, ...a] = nums;
  const atoms = a.filter((x) => x > 0 && x <= ids.length).map((x) => ids[x - 1]);
  if (!atoms.length || world < 1 || world > WORLDS.length || st < 1 || st > 20) return null;
  return { atoms, world, style: `M${String(st).padStart(2, "0")}`, seed };
}

/** Boss Rush: every set piece back to back */
export function rushRecipe(): LevelRecipe {
  const rng = new Rng(0xb055);
  const zonesRec = compile({ id: 6000, kind: "rush", world: 20, name: "Boss Rush", concepts: ["F01"], d: 0.8, bpm: 126, seed: 0xb055, zones: 1 });
  const all = BOSS_CONCEPTS.map((b, i) => {
    const r = compile({ id: 6000, kind: "rush", world: (i % 20) + 1, name: "Boss Rush", concepts: [b], d: 0.8, bpm: 126, seed: 0xb055 + i, zones: 2 });
    return { ...r.zones[1], mood: WORLDS[(i * 7) % WORLDS.length].moods[0], style: STYLES[(i * 3) % 20] };
  });
  return { ...zonesRec, zones: [zonesRec.zones[0], ...all], concepts: BOSS_CONCEPTS, blurb: "All 15 bosses in a row!", oneLife: false, extras: [], news: [] , root: [57, 60, 62][rng.int(0, 2)] };
}
