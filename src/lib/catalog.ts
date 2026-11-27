// Links and small helpers for games — no games list in here, so any page or component can use them without pulling
// every game into the browser's code. The lists (top picks, new games, categories) are in src/lib/lists.ts (server
// pages) and in /data/catalog.json (browser code, see src/lib/catalog-data.ts).
import { CATEGORIES } from "./categories";

/** what the helpers need from a game: a game card, the player's game or the full game all fit */
type G = { slug: string; hero?: string; engine?: string; category?: string; isNew?: boolean };

/** a page of games on list pages (/games, /new, /top, /c/<category>); "Show more" loads the next one */
export const PAGE_SIZE = 60;
/** at most this many games in a sideways row (home page, game page); "See all" opens the full list */
export const ROW_SIZE = 24;

const ENGINES_3D = new Set(["momo", "racing", "brigade", "boing", "dash", "jungle", "roll", "escape", "clayland", "slurp", "vine", "jelly", "rush", "orbi", "storm", "vanguard", "wake", "clash", "crumble", "band", "tac", "bead", "wiggle", "skyrift"]);
export const is3D = (g: Pick<G, "engine">) => g.engine !== undefined && ENGINES_3D.has(g.engine);
/** the sound files a game's engine uses (audio/arcade/{sfx,music,voice}_<family>_*.mp3), for background loading */
const SOUND_FAMILY: Record<string, string> = { dash: "dash", jungle: "kiko", racing: "race", boing: "boing", brigade: "brigade", clayland: "clay", slurp: "slurp", vine: "vine", sudoku: "sudoku", trail: "trail", quilt: "quilt", glow: "glow", crown: "crown", tide: "tide", vial: "vial", treat: "treat", sprout: "sprout", relic: "relic", breeze: "breeze", picnic: "picnic", jade: "jade", nova: "nova", marble: "marble", rover: "rover", haul: "haul", gizmo: "gizmo", wake: "wake", rumble: "rumble", storm: "storm", vanguard: "vanguard", clash: "clash", crumble: "crumble", melon: "melon", unveil: "unveil", pups: "pups", plank: "plank", splash: "splash", rope: "rope", band: "band", tac: "tac", bead: "bead", wiggle: "wiggle", skyrift: "skyrift" };
export const soundFamily = (g: Pick<G, "engine">) => (g.engine ? SOUND_FAMILY[g.engine] ?? "" : "");
/** NEW badge: the game came out on the latest release day (worked out when the lists are made) */
export const isNew = (g: Pick<G, "isNew">) => g.isNew === true;

export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id);
/** the label of the one category a game sits in ("Runner", "Puzzle"…) */
export const categoryLabel = (g: { category: string }) => categoryOf(g.category)?.label ?? "Game";
export const categoryHref = (id: string) => `/c/${id}`;
/**
 * A game's own page. Game pages are plain pages (one file each, no data files for in-app navigation), so link to them
 * with a normal <a href> (or `goToGame`), never next/link or router.push — those would ask for data files that don't
 * exist.
 */
export const gameHref = (g: Pick<G, "slug"> | string) => `/games/${typeof g === "string" ? g : g.slug}`;
/** open a game's page (a normal page load, see gameHref) */
export const goToGame = (g: Pick<G, "slug"> | string) => { window.location.assign(gameHref(g)); };
/** the shared player page: one page for every game, the game in the address (/play?g=<slug>&mode=…) */
export const playHref = (g: Pick<G, "slug"> | string, extra: Record<string, string> = {}) =>
  `/play?${new URLSearchParams({ g: typeof g === "string" ? g : g.slug, ...extra })}`;
/** the 16:9 thumbnail every card uses */
export const thumbOf = (g: { hero: string }) => g.hero;
/** the game's 2:3 poster (its own art style; shown on the game page) */
export const posterOf = (g: Pick<G, "slug">) => `/games/${g.slug}/poster.webp`;
/** the game's 3D title logo on a transparent background */
export const titleArtOf = (g: Pick<G, "slug">) => `/games/${g.slug}/title.webp`;

/** the "mood" tiles at the top of the home page */
export const MOODS: { id: string; label: string; href: string; img: string; from: string; to: string; text: string }[] = [
  { id: "runner", label: "Run & dash", href: "/c/runner", img: "/games/kiko-jungle-quest/kiko.webp", from: "#8A1F4A", to: "#3A0B20", text: "#FF9AC3" },
  { id: "adventure", label: "Big adventures", href: "/c/adventure", img: "/games/puddo-clayland/puddo.webp", from: "#1F6B3A", to: "#0D2E1A", text: "#8CF08F" },
  { id: "race", label: "Race & drift", href: "/c/racing", img: "/brand/chars/turbo-happy.webp", from: "#1D3B8F", to: "#0E1B44", text: "#7FC4FF" },
  { id: "shoot", label: "Blast & shoot", href: "/c/shoot", img: "/games/blockstorm/hero.webp", from: "#8F1D2E", to: "#3A0B14", text: "#FF9AA8" },
  { id: "puzzle", label: "Puzzles", href: "/c/puzzle", img: "/brand/chars/zib-happy.webp", from: "#2E4F9E", to: "#121F45", text: "#9FB8FF" },
  { id: "brain", label: "Train your brain", href: "/c/brain", img: "/brand/chars/hoot-happy.webp", from: "#5B2E9E", to: "#25124A", text: "#D2A8FF" },
  { id: "memory", label: "Memory masters", href: "/c/memory", img: "/brand/chars/pip-happy.webp", from: "#17707A", to: "#0A3035", text: "#7FF0E6" },
  { id: "focus", label: "Sharp focus", href: "/c/focus", img: "/brand/chars/noodle-happy.webp", from: "#8A2F2F", to: "#3A1010", text: "#FFA8A8" },
  { id: "reflex", label: "Quick reflexes", href: "/c/reflex", img: "/brand/chars/gloop-happy.webp", from: "#8F3B1D", to: "#40170A", text: "#FFB37F" },
  { id: "numbers", label: "Number fun", href: "/c/numbers", img: "/brand/chars/bonbon-happy.webp", from: "#7A6514", to: "#332A07", text: "#FFE27F" },
];
