// The game lists server-built pages show (home rows, top picks, new games, categories, "play next"), as game cards.
// Server code only: it reads the full src/lib/games.ts. Browser code gets the same lists from /data/catalog.json
// (src/lib/catalog-data.ts), which scripts/gen-game-index.mjs writes from these.
import { GAMES, LIVE_GAMES, type Game } from "./games";
import type { Category } from "./categories";
import { is3D } from "./catalog";
import { CARD_KEYS, type GameCard } from "./game-types";

/** hand-picked order for "Top picks" and the default sort (best and biggest first) */
const PICKS = [
  "orbi-gp", "rollo-rush", "momo-jelly-jam", "kiko-jungle-quest", "momo-escape", "momo-dash", "nitro-rush", "blob-brigade", "sky-roll", "momo-boing", "momo-shuffle", "drift-kings", "moto-rush",
  "highway-heat", "whack-a-gloop", "fish-watch", "turbo-dash", "maze-munch", "spot-the-sneak", "memory-bridge", "count-fast",
];
const listed = new Map(GAMES.map((g, i) => [g.slug, i]));
const rank = (g: Game) => { const i = PICKS.indexOf(g.slug); return i < 0 ? PICKS.length + (listed.get(g.slug) ?? 0) : i; };
const newestFirst = [...LIVE_GAMES].sort((a, b) => (b.released ?? "").localeCompare(a.released ?? "") || rank(a) - rank(b));
const NEW_DAY = newestFirst[0]?.released;
/** NEW badge: everything from the latest release day */
export const isNewGame = (g: { released?: string }) => !!NEW_DAY && g.released === NEW_DAY;

/** a game as a card: only what tiles, rows and search need (keeps pages and the browser's list small) */
export function toCard(g: Game): GameCard {
  const card = {} as Record<string, unknown>;
  for (const k of CARD_KEYS) if (g[k] !== undefined) card[k] = g[k];
  if (isNewGame(g)) card.isNew = true;
  return card as GameCard;
}

export const ALL_PLAYABLE: GameCard[] = [...LIVE_GAMES].sort((a, b) => rank(a) - rank(b)).map(toCard);
export const TOP_PICKS = ALL_PLAYABLE.slice(0, 12);
export const NEW_GAMES: GameCard[] = newestFirst.map(toCard);
export const GAMES_3D = ALL_PLAYABLE.filter(is3D);
export const inCategory = (c: Category) => ALL_PLAYABLE.filter((g) => g.category === c);

/** "Play next" picks for a game: same category first, then the top picks */
export function similarTo(g: { slug: string; category: string }, n = 12) {
  const same = ALL_PLAYABLE.filter((x) => x.slug !== g.slug && x.category === g.category);
  const rest = ALL_PLAYABLE.filter((x) => x.slug !== g.slug && x.category !== g.category);
  return [...same, ...rest].slice(0, n);
}
