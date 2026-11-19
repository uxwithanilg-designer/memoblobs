// Slurp Lab: the 30 labs and the recipe for every campaign stage (1–600). Each lab is a theme (tray, backdrop, music)
// and a new mechanic; later stages of a lab mix in earlier mechanics. Inside a lab the stages ramp up, with breathers
// at 5 and 15, a Big Tray at 10 and Hoot's Exam at 20; from lab to lab everything grows: board, colours, twins,
// fewer Gloopies per trip (more turn-taking), denser trays.
import { POOL_BIG, POOL_MID, POOL_SMALL } from "./shapes";
import type { Recipe } from "./generator";

export interface Lab {
  n: number; name: string; idea: string; tip: string;
  /** music key (file music_slurp_<music>_action) */
  music: string;
  tray: string; tile: string; tileB: string; sky: [string, string]; fog: string;
  float: "bubbles" | "sprinkles" | "leaves" | "crystals" | "fish" | "snow" | "stars" | "gears" | "planets" | "drops";
  /** the mechanic this lab adds */
  mech: string;
}

const L = (n: number, name: string, idea: string, mech: string, tip: string, music: string, tray: string, tile: string, tileB: string, sky: [string, string], float: Lab["float"]): Lab =>
  ({ n, name, idea, mech, tip, music, tray, tile, tileB, sky, fog: sky[0], float });

export const LABS: Lab[] = [
  L(1, "Bubble Lab", "Slurpers", "", "Drag a Slurper over Gloopies of its colour. Its number is how many it still drinks — exactly.", "bubble", "#3B5BDB", "#C9D6FF", "#B3C5FF", ["#2C3FB8", "#6F8CFF"], "bubbles"),
  L(2, "Candy Lab", "Walls & odd trays", "walls", "Glass walls and odd-shaped trays: plan the whole route before you drag.", "candy", "#D6336C", "#FFC9DE", "#FFB0CE", ["#9C1F52", "#FF6FA8"], "sprinkles"),
  L(3, "Garden Lab", "Twin colours", "twins", "Two Slurpers of one colour: decide which one drinks which Gloopies — the numbers must add up.", "garden", "#2B8A3E", "#C8F0D0", "#AEE6BA", ["#1E6B30", "#5BD27A"], "leaves"),
  L(4, "Crystal Cave", "Big shapes", "big", "Big Slurpers turn badly in tight spots. Clear room for them first.", "crystal", "#7048E8", "#DCD2FF", "#C8B9FF", ["#4B2DB0", "#9C7DFF"], "crystals"),
  L(5, "Ocean Lab", "Colour gates", "gate", "A glowing gate lets only its own colour through.", "ocean", "#0C8599", "#BDEFF5", "#A0E5EE", ["#0A6475", "#3CC9DE"], "fish"),
  L(6, "Ice Lab", "Ice floors", "ice", "On ice a Slurper keeps sliding until something stops it.", "ice", "#1C7ED6", "#D0EBFF", "#B8E0FF", ["#155FA8", "#5CB8FF"], "snow"),
  L(7, "Honey Lab", "Sticky goo", "goo", "Goo stops a Slurper — your drag ends there. Every move counts.", "honey", "#E8890C", "#FFE3A8", "#FFD58A", ["#A85F05", "#FFB833"], "drops"),
  L(8, "Vault Lab", "Padlocks", "lock", "A padlocked Slurper opens when every Gloopy of its key colour is gone.", "vault", "#5F3DC4", "#DCD2FF", "#CBBDFF", ["#3D2590", "#8A6BFF"], "gears"),
  L(9, "Soap Lab", "Bubbled Gloopies", "bubble", "A bubbled Gloopy blocks everyone until a Gloopy next to it is slurped.", "soap", "#0CA678", "#C3FAE8", "#A6F2D8", ["#08805C", "#38D9A9"], "bubbles"),
  L(10, "Rainbow Lab", "Rainbow Gloopies", "rainbow", "Any Slurper may drink a rainbow Gloopy — but it uses up one of its number.", "rainbow", "#C2255C", "#FFD8E8", "#FFC2DA", ["#7B1E8C", "#FF7EB6"], "stars"),
  L(11, "Jelly Lab", "Double Gloopies", "double", "A double Gloopy counts 2: the Slurper needs 2 left to drink it.", "jelly", "#E64980", "#FFD0E1", "#FFB8D2", ["#A61E56", "#FF7AA8"], "drops"),
  L(12, "Paint Lab", "Paint pads", "paint", "Crossing a paint pad repaints the Slurper — now it drinks the new colour.", "paint", "#F08C00", "#FFE8C2", "#FFDBA3", ["#B36200", "#FFB13D"], "sprinkles"),
  L(13, "Wind Lab", "One-way arrows", "arrow", "Arrow tiles can only be crossed the way they point.", "wind", "#3BC9DB", "#D3F9FF", "#B8F2FA", ["#1A8FA3", "#6EE3F5"], "leaves"),
  L(14, "Space Lab", "Portals", "portal", "Step into a portal and come out of its twin.", "space", "#4C3DC4", "#D6D1FF", "#C2BBFF", ["#2A1F80", "#7A6BFF"], "planets"),
  L(15, "Spin Lab", "Turn pads", "turn", "A turn pad turns the Slurper a quarter turn — if there's room.", "spin", "#AE3EC9", "#F3D9FA", "#EAC2F5", ["#7A2591", "#DA77F2"], "gears"),
  L(16, "Clockwork Lab", "Linked twins", "link", "Linked Slurpers move together, the same way. Both must have room.", "clock", "#B8860B", "#FFF0BF", "#FFE699", ["#7A5A08", "#F2C94C"], "gears"),
  L(17, "Toy Lab", "Crates", "crate", "Push a crate one cell. Crates block Slurpers — and can't be pulled back.", "toy", "#E03131", "#FFD6D6", "#FFC0C0", ["#A61E1E", "#FF6B6B"], "crystals"),
  L(18, "Bridge Lab", "Glass bridges", "crumble", "A glass bridge falls away once a Slurper has left it. One way across!", "bridge", "#1098AD", "#C5F6FA", "#A5EEF5", ["#0B6E80", "#3BC9DB"], "crystals"),
  L(19, "Factory Lab", "Conveyor belts", "belt", "A belt carries a Slurper along to its end.", "factory", "#495057", "#E3E7EC", "#D2D8DE", ["#2F353B", "#868E96"], "gears"),
  L(20, "Fireworks Lab", "Bomb Gloopies", "bomb", "Slurp a bomb Gloopy to blast the cracked glass around it.", "fireworks", "#D9480F", "#FFDCC7", "#FFC8A8", ["#8F2E07", "#FF8A4C"], "stars"),
  L(21, "Mirror Lab", "Mirror pairs", "mirror", "Mirror Slurpers move the opposite way when you drag the other.", "mirror", "#7950F2", "#E5DBFF", "#D3C4FF", ["#4E2FB8", "#9775FA"], "crystals"),
  L(22, "Glass Lab", "Cracked glass", "glass", "Only a big Slurper (4+ cells) can break through cracked glass.", "glass", "#228BE6", "#D0EBFF", "#BADFFF", ["#155FA8", "#4DABF7"], "crystals"),
  L(23, "Kitchen Lab", "Hungry Slurpers", "hungry", "A hungry Slurper also drinks its colour from the cells around it — careful!", "kitchen", "#F76707", "#FFE3CC", "#FFD2AD", ["#B34A05", "#FF922B"], "sprinkles"),
  L(24, "Snow Lab", "Frosted Gloopies", "frost", "Frosted Gloopies hide their colour until a Gloopy next to them is slurped.", "snow", "#4DABF7", "#E7F5FF", "#D0EBFF", ["#2479C2", "#8CCBFF"], "snow"),
  L(25, "Robot Lab", "Switch walls", "switch", "Step on the switch to swap the red and blue walls.", "robot", "#5C7CFA", "#DBE4FF", "#C5D3FF", ["#3B4FB8", "#91A7FF"], "gears"),
  L(26, "Fuse Lab", "Fuse Gloopies", "fuse", "A fuse Gloopy must be slurped before its drag runs out.", "fuse", "#E8590C", "#FFE0CC", "#FFCCAD", ["#9C3A06", "#FF8F4F"], "stars"),
  L(27, "Maze Garden", "Glass fences", "fence", "Thin glass fences block the way between two cells.", "maze", "#37B24D", "#D3F9D8", "#B9F2C2", ["#237A33", "#69DB7C"], "leaves"),
  L(28, "Dream Lab", "Sleepy Slurpers", "sleep", "A sleepy Slurper wakes when a Gloopy next to it is slurped.", "dream", "#9C36B5", "#F3D9FA", "#E8C2F5", ["#5F1F70", "#CC5DE8"], "stars"),
  L(29, "Sky Tower", "Mega trays", "mega", "Mega trays: many colours, many twins and three lab ideas at once.", "sky", "#1C7ED6", "#D0EBFF", "#B8DEFF", ["#1659A6", "#4DABF7"], "planets"),
  L(30, "Grand Lab", "Everything", "grand", "Prof. Hoot's grand finale: every idea of every lab.", "grand", "#F59F00", "#FFF3BF", "#FFEC99", ["#A86B00", "#FCC419"], "stars"),
];
export const CAMPAIGN = LABS.length * 20;
/** stages available in this build (the whole campaign) */
export const PHASE_STAGES = CAMPAIGN;
export const labOf = (n: number) => LABS[Math.min(LABS.length - 1, Math.max(0, Math.floor((n - 1) / 20)))];
export const stageIn = (n: number) => ((n - 1) % 20) + 1;

const ADJ = ["Wobbly", "Twisty", "Sleepy", "Fizzy", "Sticky", "Glossy", "Tiny", "Secret", "Tricky", "Busy", "Quiet", "Lucky", "Bouncy", "Crisscross", "Hidden", "Shiny", "Narrow", "Giggly", "Sneaky", "Dizzy", "Gooey", "Zigzag", "Puzzling", "Velvet", "Clever", "Tangled", "Frosty", "Sparkly", "Mighty", "Puzzled", "Curly", "Breezy"];
const NOUN = ["Corner", "Bridge", "Lanes", "Shelf", "Maze", "Crossing", "Queue", "Knot", "Loop", "Pantry", "Hallway", "Window", "Spiral", "Ladder", "Corridor", "Party", "Riddle", "Garden", "Market", "Station", "Jam", "Parade", "Shuffle", "Detour", "Puzzle", "Tangle", "Workshop", "Courtyard", "Junction", "Gallery", "Tunnel", "Labyrinth"];

export function stageName(n: number): string {
  const s = stageIn(n);
  if (s === 1) return `First ${labOf(n).idea.split(" ").slice(-1)[0]}`;
  if (s === 10) return "Big Tray";
  if (s === 20) return "Hoot's Exam";
  const a = (n * 7 + Math.floor(n / 32)) % ADJ.length, b = (n * 11 + 5 + Math.floor(n / 96)) % NOUN.length;
  return `${ADJ[a]} ${NOUN[b]}`;
}

export function kindOf(n: number): "big" | "exam" | "breather" | undefined {
  if (n < 1 || n > CAMPAIGN) return undefined;
  const s = stageIn(n);
  return s === 10 ? "big" : s === 20 ? "exam" : s === 5 || s === 15 ? "breather" : undefined;
}

export const MASKS = ["full", "corners", "notch", "ring", "diamond", "plus", "steps", "bigcorners", "split", "pillars", "hall", "heart", "islands"];
/** how much of a mechanic a stage gets (scaled a little by how far in the game it is) */
export function mechAmount(key: string, g: number): Record<string, number> {
  const k = (a: number, b: number) => Math.round(a + (b - a) * g);
  switch (key) {
    case "gate": return { gate: k(2, 5) };
    case "ice": return { ice: k(2, 3) };
    case "goo": return { goo: k(3, 6) };
    case "lock": return { lock: k(1, 2) };
    case "bubble": return { bubble: k(3, 5) };
    case "rainbow": return { rainbow: k(2, 3) };
    case "double": return { double: k(2, 3) };
    case "paint": return { paint: k(2, 3) };
    case "arrow": return { arrow: k(4, 8) };
    case "portal": return { portal: k(1, 2) };
    case "turn": return { turn: k(2, 3) };
    case "link": return { link: 1 };
    case "crate": return { crate: k(2, 4) };
    case "crumble": return { crumble: k(4, 7) };
    case "belt": return { belt: k(2, 3) };
    case "bomb": return { bomb: 1, glass: k(4, 7) };
    case "mirror": return { mirror: 1 };
    case "glass": return { glass: k(4, 7) };
    case "hungry": return { hungry: k(1, 2) };
    case "frost": return { frost: k(3, 5) };
    case "switch": return { switch: k(2, 4) };
    case "fuse": return { fuse: k(2, 3) };
    case "fence": return { fence: k(6, 12) };
    case "sleep": return { sleep: k(1, 2) };
    default: return {};
  }
}
/** mechanics that move a lone Slurper on by themselves don't mix with linked / mirrored pairs */
const RIDES = new Set(["ice", "belt", "portal", "turn"]);
export const MIXABLE = LABS.map((l) => l.mech).filter((m) => m && !["walls", "twins", "big", "mega", "grand"].includes(m));
export function mixMechs(keys: string[], g: number): Record<string, number> {
  const out: Record<string, number> = {};
  const pairs = keys.some((k) => k === "link" || k === "mirror");
  for (const key of keys) { if (pairs && RIDES.has(key)) continue; Object.assign(out, mechAmount(key, g)); }
  return out;
}

const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** the recipe for campaign stage n */
export function recipeFor(n: number): Recipe {
  const lab = labOf(n), L0 = lab.n, s = stageIn(n), k = kindOf(n);
  const t = (s - 1) / 19; // 0..1 inside the lab
  const g = (n - 1) / (CAMPAIGN - 1); // 0..1 over the campaign
  const gp = Math.pow(g, 0.55);
  // the board grows quickly at first, then slowly up to 9×12
  let w = clamp(Math.round(lerp(5.6, 9, gp) + (t > 0.6 ? 0.4 : 0)), 5, 9);
  let h = clamp(Math.round(w + lerp(1, 3, gp) + (t > 0.5 ? 0.5 : 0)), 6, 12);
  if (s <= 2) { w = Math.max(5, w - 1); h = Math.max(6, h - 1); }
  const colors = clamp(Math.round(lerp(2.4, 7.2, gp) + t * 1.2), 2, 8);
  // twins from the 4th stage on: more Slurpers than colours means choosing who drinks what
  const twins = n <= 3 ? 0 : Math.round(lerp(1, colors * 0.9, gp) + t * 1.5);
  let slurpers = colors + twins;
  const fill = clamp(lerp(0.7, 0.86, gp) + t * 0.04, 0.6, 0.9);
  const needMax = Math.round(lerp(4, 8, gp));
  const perTrip = n <= 3 ? 4 : 3;
  let pool = g < 0.06 ? POOL_SMALL : g < 0.12 ? POOL_MID : [...POOL_MID, ...POOL_BIG];
  let mask = L0 === 1 && s < 8 ? "full" : MASKS[(n * 7 + L0) % MASKS.length];
  let walls = L0 === 1 ? (s > 6 ? 2 : 0) : Math.round(lerp(1, 5, t) + gp * 2);
  // this lab's idea, plus earlier ideas mixed in as the lab goes on
  const keys: string[] = [];
  const own = lab.mech;
  if (own === "walls") { walls += 3; }
  else if (own === "big") pool = POOL_BIG;
  else if (own === "mega") { w = 9; h = 12; }
  if (MIXABLE.includes(own)) keys.push(own);
  const earlier = MIXABLE.filter((m) => LABS.findIndex((l) => l.mech === m) < L0 - 1);
  const extra = own === "grand" ? 4 : own === "mega" ? 3 : s === 1 ? 0 : s < 8 ? (L0 > 6 ? 1 : 0) : L0 > 8 ? 2 : 1;
  for (let e = 0; e < extra && earlier.length; e++) { const m = earlier[(n * (13 + e * 7) + e * 5) % earlier.length]; if (!keys.includes(m)) keys.push(m); }
  if (keys.includes("glass") || keys.includes("bomb")) pool = [...new Set([...pool, "bar4", "square", "ell", "tee", "zig", "cross"])];
  if (s === 1) { mask = "full"; walls = Math.min(walls, 2); }
  // how hard a candidate to keep (most labs keep a hard one; breathers and first stages keep an easier one)
  let pick = lerp(0.62, 1, t);
  if (k === "breather") { slurpers = Math.max(2, slurpers - 2); pick = 0.35; }
  if (k === "big") { w = Math.min(9, w + 1); h = Math.min(12, h + 1); pick = 0.7; }
  if (k === "exam") { slurpers += 1; pick = 1; }
  if (s === 1) { pick = 0.2; slurpers = Math.max(2, slurpers - 1); }
  if (n <= 2) { slurpers = 2; pick = 0.3; }
  return {
    n, lab: L0, s, w, h, colors: Math.min(colors, slurpers), slurpers, pool, mask, walls,
    mech: mixMechs(keys, g), needMax, fill, perTrip, fuseSlack: g < 0.85 ? 2 : 1,
    tries: k === "exam" ? 12 : 7, pick: Math.min(1, pick), budget: 4000,
  };
}
