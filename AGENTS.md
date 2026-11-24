<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MOMOBLOBS: read `docs/AGENT_PROMPT.md` first

Before you add or change a game, read `docs/AGENT_PROMPT.md`: the full brief on hosting, R2 game files, loading,
performance, the new-game checklist, the checks to run and the deploy rules. To make a new game, follow
`docs/NEW_GAME_PROMPT.md` step by step (write, register, files, test, commit, push, check it's live). The hard rule is
repeated below.

## Hosting budget — every game, every agent (MOMOBLOBS rule)

The site is a static export on a Cloudflare Worker (free plan: 20,000 files per deploy) and every game file lives in
the R2 bucket. To keep room for thousands of games, **each game uses exactly one file on the site**: its page,
`games/<slug>.html` (room for ~19,000 games). The site's code must not grow with the games either.

- **No per-game routes or files.** All games play on one shared page, `/play?g=<slug>` — build links with `playHref()`
  from `src/lib/catalog.ts`. Never add `/play/<slug>`, `/games/<slug>/<anything>` or any other page per game; put extra
  content inside the game's existing page or inside the game itself.
- **Link to a game's page with a plain `<a href={gameHref(g)}>`** (or `goToGame()`), never `next/link` or
  `router.push`: game pages have no in-app navigation data files.
- **Game files go to R2, never to the site.** Put a game's art, sounds, music, fonts and data in
  `public/games/<slug>/`, `public/audio/`, `public/brand/` or `public/fonts/` (the folders in `scripts/r2/config.mjs`).
  `npm run upload:r2` sends them to R2 and `npm run build:static` leaves them out of the site deploy.
- **Load them through the R2 helpers.** `next/image` does it automatically. Everything else — `<img>`, `new Image()`,
  `fetch`, three.js loaders — must use `cdn(path)` from `src/lib/cdn.ts`; full URLs for SEO and link previews use
  `absAsset(path)` from `src/lib/site.ts`. Don't `import` media files into JavaScript.
- **Games list:** write a game only in `src/lib/games.ts` / `src/lib/arcade-catalog.ts`. Server-built pages take lists
  from `src/lib/lists.ts` (game cards, capped with `ROW_SIZE` / `PAGE_SIZE`). Browser code never imports
  `@/lib/games` or `@/lib/lists`: it loads the list with `loadCatalog()` / `useCatalog()` and one game with
  `loadGame()` (`src/lib/catalog-data.ts`). `npm run gen:index` (also run by dev and the build) writes the files;
  commit `src/lib/game-index.ts`.
- **Enforced.** `npm run build:static` runs `scripts/check-game-budget.mjs`; it fails when a game has more than its one
  site file, a game file would ship with the site, or the code every page loads carries the games list or three.js.
  Fix the game — don't skip the check or change its limits (that is the owner's decision).
- **Deploy** happens on every push to `main` (`.github/workflows/deploy.yml`), or with `npm run deploy` (build → upload
  to R2 → `wrangler deploy`). Never deploy without the R2 upload: the site has no copy of the game files.

## Mobile performance — every game, every agent (MOMOBLOBS rule)

Phones (Android above all) must stay smooth and cool in every game. Use the shared kit in `src/lib/perf.ts`:
`autoQuality()`, `pixelRatioFor(q)`, `antialiasFor(q)`, `shadowsFor(q)` and a `FrameGovernor` in every 3D renderer; play
sound only through `@/lib/audio`; allocate nothing per frame; drive games with `requestAnimationFrame`. The player
already caps the frame rate and turns off CSS blur on phones. `npm run build:static` runs `scripts/check-perf.mjs`, which
fails the build when a game breaks these rules. Full brief: `docs/AGENT_PROMPT.md` §5.
