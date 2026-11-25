// The games list in the browser. It isn't part of the site's code (that would grow with every game): it's loaded from
// /data/catalog.json the first time something needs the whole list — search, "Show more", recently played, a random
// game — and kept for the visit. One game's player data comes from /games/<slug>/game.json on R2.
// Both files are written by scripts/gen-game-index.mjs from src/lib/games.ts.
import { useEffect, useState } from "react";
import { CATALOG_VERSION, type GameCard, type PlayerGame } from "./game-index";
import { cdn } from "./cdn";
import { is3D } from "./catalog";

export interface Catalog {
  /** every live game, in "top picks" order */
  games: GameCard[];
  /** newest first */
  newest: GameCard[];
  bySlug: Map<string, GameCard>;
}

let catalog: Promise<Catalog> | null = null;
let ready: Catalog | null = null;

/** the whole list (fetched once per visit; the URL carries its version, so the browser may keep it) */
export function loadCatalog(): Promise<Catalog> {
  catalog ??= fetch(`/data/catalog.json?v=${CATALOG_VERSION}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog ${r.status}`))))
    .then((d: { games: GameCard[]; newest: number[] }) => {
      ready = { games: d.games, newest: d.newest.map((i) => d.games[i]).filter(Boolean), bySlug: new Map(d.games.map((g) => [g.slug, g])) };
      return ready;
    })
    .catch((e) => { catalog = null; throw e; });
  return catalog;
}

/** the list for a component: null until it has loaded (pass `false` to wait until it's needed) */
export function useCatalog(want = true): Catalog | null {
  const [c, setC] = useState<Catalog | null>(ready);
  useEffect(() => {
    if (!want || c) return;
    let live = true;
    loadCatalog().then((x) => { if (live) setC(x); }).catch(() => {});
    return () => { live = false; };
  }, [want, c]);
  return c;
}

/** the lists list pages show: top picks, newest first, 3D games, or one category */
export type ListName = "top" | "new" | "3d" | `c:${string}`;
const lists = new WeakMap<Catalog, Map<ListName, GameCard[]>>();
/** the latest release first in a category, as src/lib/lists.ts does (browser code can't import that file) */
const newFirst = (l: GameCard[]) => [...l.filter((g) => g.isNew), ...l.filter((g) => !g.isNew)];
/** a named list, in the same order the server-built page shows it (src/lib/lists.ts) */
export function listOf(c: Catalog, name: ListName): GameCard[] {
  let m = lists.get(c);
  if (!m) lists.set(c, (m = new Map()));
  let l = m.get(name);
  if (!l) {
    l = name === "top" ? c.games : name === "new" ? c.newest : name === "3d" ? c.games.filter(is3D) : newFirst(c.games.filter((g) => g.category === name.slice(2)));
    m.set(name, l);
  }
  return l;
}

/** cards for these slugs, in this order (unknown or retired games left out) */
export const cardsOf = (c: Catalog, slugs: string[]) => slugs.map((s) => c.bySlug.get(s)).filter((g): g is GameCard => !!g);

const games = new Map<string, Promise<PlayerGame | null>>();
/** one game for the player: null when there's no such game; rejects when it couldn't be loaded (offline…) */
export function loadGame(slug: string): Promise<PlayerGame | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return Promise.resolve(null);
  let p = games.get(slug);
  if (!p) {
    p = fetch(cdn(`/games/${slug}/game.json`))
      .then((r) => {
        if (r.status === 404 || r.status === 403) return null;
        if (!r.ok) throw new Error(`game ${slug}: ${r.status}`);
        return r.json() as Promise<PlayerGame>;
      })
      .then((g) => (g && g.slug === slug ? g : null));
    p.catch(() => games.delete(slug));
    games.set(slug, p);
  }
  return p;
}
