// The shapes a game takes outside its full entry in src/lib/games.ts (types only, plus the list of card fields).
import type { Game as FullGame } from "./games";

/** the fields a game card needs (tiles, rows, search, the game page's player box) */
export const CARD_KEYS = ["slug", "title", "short", "tagline", "category", "accent", "accent2", "hero", "engine"] as const;
/** a game on a card: what lists and search show. `isNew` = it came out on the latest release day */
export type GameCard = Pick<FullGame, (typeof CARD_KEYS)[number]> & { isNew?: boolean };

/** the long text only a game's own page shows (built on the server from games.ts) */
export type PageOnlyKeys = "description" | "howTo" | "controls" | "faq" | "skills";
/** a game without its long text */
export type Game = Omit<FullGame, PageOnlyKeys> & { isNew?: boolean };
/** a game's how-to and controls (the player's help panel and loading tips) */
export interface GameAbout { howTo: FullGame["howTo"]; controls: FullGame["controls"] }
/** everything the player needs for one game: public/games/<slug>/game.json */
export type PlayerGame = Game & GameAbout;
