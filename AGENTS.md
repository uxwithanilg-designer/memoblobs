<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## MOMOBLOBS: read `docs/AGENT_PROMPT.md` first

Before you add or change a game, read `docs/AGENT_PROMPT.md`: the full brief on hosting, R2 game files, loading,
performance, the new-game checklist, the checks to run and the deploy rules. The hard rule is repeated below.

## Hosting budget — every game, every agent (MOMOBLOBS rule)

The site is a static export on a Cloudflare Worker (free plan: 20,000 files per deploy) and every game file lives in
the R2 bucket. To keep room for thousands of games, **each game may use only 6–9 files on the site**. Today a game
uses 7: its page `/games/<slug>` (`.html` + `.txt`) and the 5 data files Next writes for it.

- **No per-game routes.** All games play on one shared page, `/play?g=<slug>` — build links with `playHref()` from
  `src/lib/catalog.ts`. Never add `/play/<slug>`, `/games/<slug>/<anything>` or any other page per game; put extra
  content inside the game's existing page or inside the game itself.
- **Game files go to R2, never to the site.** Put a game's art, sounds, music, fonts and data in
  `public/games/<slug>/`, `public/audio/`, `public/brand/` or `public/fonts/` (the folders in `scripts/r2/config.mjs`).
  `npm run upload:r2` sends them to R2 and `npm run build:static` leaves them out of the site deploy.
- **Load them through the R2 helpers.** `next/image` does it automatically. Everything else — `<img>`, `new Image()`,
  `fetch`, three.js loaders — must use `cdn(path)` from `src/lib/cdn.ts`; full URLs for SEO and link previews use
  `absAsset(path)` from `src/lib/site.ts`. Don't `import` media files into JavaScript.
- **Enforced.** `npm run build:static` runs `scripts/check-game-budget.mjs`; it fails when a game is outside 6–9 site
  files or a game file would ship with the site. Fix the game — don't skip the check or change its limits (that is
  the owner's decision).
- **Deploy** with `npm run deploy` (build → upload to R2 → `wrangler deploy`). Never deploy without the R2 upload:
  the site has no copy of the game files. A push to `main` also deploys, through `.github/workflows/deploy.yml`.
- **Games list:** write a game only in `src/lib/games.ts` / `src/lib/arcade-catalog.ts`. Browser code imports the
  generated light list `@/lib/game-index` (run `npm run gen:index`, commit `src/lib/game-index.ts`); only server-built
  pages import `@/lib/games`.

## Mobile performance — every game, every agent (MOMOBLOBS rule)

Phones (Android above all) must stay smooth and cool in every game. Use the shared kit in `src/lib/perf.ts`:
`autoQuality()`, `pixelRatioFor(q)`, `antialiasFor(q)`, `shadowsFor(q)` and a `FrameGovernor` in every 3D renderer; play
sound only through `@/lib/audio`; allocate nothing per frame; drive games with `requestAnimationFrame`. The player
already caps the frame rate and turns off CSS blur on phones. `npm run build:static` runs `scripts/check-perf.mjs`, which
fails the build when a game breaks these rules. Full brief: `docs/AGENT_PROMPT.md` §5.
