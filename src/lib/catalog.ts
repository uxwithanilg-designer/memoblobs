// Lists the portal pages are built from: featured order, new games, 3D games, per-category lists and links.
import { CATEGORIES, GAMES, LIVE_GAMES, type Category, type Game } from "./games";

/** hand-picked order for "Top picks" and the default sort (best and biggest first) */
const PICKS = [
  "kiko-jungle-quest", "momo-escape", "momo-dash", "nitro-rush", "blob-brigade", "sky-roll", "momo-boing", "momo-shuffle", "drift-kings", "moto-rush",
  "highway-heat", "whack-a-gloop", "fish-watch", "turbo-dash", "maze-munch", "spot-the-sneak", "memory-bridge", "count-fast",
];
const rank = (g: Game) => { const i = PICKS.indexOf(g.slug); return i < 0 ? PICKS.length + GAMES.indexOf(g) : i; };

export const ALL_PLAYABLE = [...LIVE_GAMES].sort((a, b) => rank(a) - rank(b));
export const TOP_PICKS = ALL_PLAYABLE.slice(0, 12);
export const NEW_GAMES = [...LIVE_GAMES].sort((a, b) => (b.released ?? "").localeCompare(a.released ?? "") || rank(a) - rank(b));
const ENGINES_3D = new Set(["momo", "racing", "brigade", "boing", "dash", "jungle", "roll"]);
export const is3D = (g: Game) => g.engine !== undefined && ENGINES_3D.has(g.engine);
export const GAMES_3D = ALL_PLAYABLE.filter(is3D);
/** NEW = everything from the latest release day */
const NEW_SLUGS = new Set(NEW_GAMES.filter((g) => g.released === NEW_GAMES[0]?.released).map((g) => g.slug));
export const isNew = (g: Game) => NEW_SLUGS.has(g.slug);

export const inCategory = (c: Category) => ALL_PLAYABLE.filter((g) => g.categories.includes(c));
export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id);
export const categoryHref = (id: string) => `/c/${id}`;
export const gameHref = (g: Game | string) => `/games/${typeof g === "string" ? g : g.slug}`;
export const playHref = (g: Game | string) => `/play/${typeof g === "string" ? g : g.slug}`;
/** the 16:9 thumbnail every card uses */
export const thumbOf = (g: Game) => g.hero;

/** "Play next" picks for a game: same category first, then the top picks */
export function similarTo(g: Game, n = 12) {
  const same = ALL_PLAYABLE.filter((x) => x.slug !== g.slug && x.categories.some((c) => g.categories.includes(c)));
  const rest = ALL_PLAYABLE.filter((x) => x.slug !== g.slug && !same.includes(x));
  return [...same, ...rest].slice(0, n);
}

/** the "mood" tiles at the top of the home page */
export const MOODS: { id: string; label: string; href: string; img: string; from: string; to: string; text: string }[] = [
  { id: "race", label: "Race & drift", href: "/c/racing", img: "/brand/chars/turbo-happy.webp", from: "#1D3B8F", to: "#0E1B44", text: "#7FC4FF" },
  { id: "adventure", label: "Big adventures", href: "/c/adventure", img: "/games/kiko-jungle-quest/kiko.webp", from: "#1F6B3A", to: "#0D2E1A", text: "#8CF08F" },
  { id: "brain", label: "Train your brain", href: "/c/brain", img: "/brand/chars/hoot-happy.webp", from: "#5B2E9E", to: "#25124A", text: "#D2A8FF" },
  { id: "quick", label: "Quick reflexes", href: "/c/speed", img: "/brand/chars/bolt-happy.webp", from: "#8F3B1D", to: "#40170A", text: "#FFB37F" },
  { id: "memory", label: "Memory masters", href: "/c/memory", img: "/brand/chars/pip-happy.webp", from: "#17707A", to: "#0A3035", text: "#7FF0E6" },
  { id: "action", label: "Action packed", href: "/c/action", img: "/brand/chars/gloop-happy.webp", from: "#8A1F4A", to: "#3A0B20", text: "#FF9AC3" },
  { id: "numbers", label: "Number fun", href: "/c/numbers", img: "/brand/chars/bonbon-happy.webp", from: "#7A6514", to: "#332A07", text: "#FFE27F" },
  { id: "puzzle", label: "Puzzles", href: "/c/puzzle", img: "/brand/chars/zib-happy.webp", from: "#2E4F9E", to: "#121F45", text: "#9FB8FF" },
  { id: "focus", label: "Sharp focus", href: "/c/focus", img: "/brand/chars/noodle-happy.webp", from: "#8A2F2F", to: "#3A1010", text: "#FFA8A8" },
];
