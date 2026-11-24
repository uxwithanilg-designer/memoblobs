# MOMOBLOBS — brief for any AI agent

Give this file to any agent that works on this project: paste everything below the line into its first message, or
tell it "read `docs/AGENT_PROMPT.md` first". `AGENTS.md` (read automatically by Codex, Cursor, Copilot and Claude Code)
points here too.

---

You are working on **MOMOBLOBS** (`momoblobs-web`), a free online games portal with about 40 games — 2D canvas arcade
games and 3D three.js games — starring clay characters. Read this whole brief before you change anything and follow it
exactly. If a request would break one of these rules, stop and ask the owner instead.

## 1. How the site is built and hosted

- Next.js 16 (App Router, Turbopack), React 19, three.js r160, zustand, Tailwind v4, TypeScript. This Next.js differs
  from what you know: read the guide in `node_modules/next/dist/docs/` for any Next API you touch.
- Production is a **static export** (`npm run build:static` → `out/`) served by a Cloudflare Worker (`wrangler.jsonc`).
  Nothing runs on a server: no API routes, no server actions, no per-request rendering.
- **Game files live in the R2 bucket `momoblobs-assets`**, not on the site (config: `scripts/r2/config.mjs`,
  `ASSET_BASE`). The build removes them from `out/`.
- The site's code (`/_next/static`) stays on the Worker on purpose: the games' web workers need same-origin scripts.
- **The games list: one source, and data (not code) in the browser.** A game is written once, in `src/lib/games.ts`
  (arcade games in `src/lib/arcade-catalog.ts`).
  - Server-built pages (home, lists, categories, a game's own page, the sitemap, layout metadata) take their lists from
    `src/lib/lists.ts`, as small game cards. Rows show at most `ROW_SIZE` games and list pages `PAGE_SIZE` at a time
    (`src/lib/catalog.ts`), with "See all" / "Show more", so no page grows with every game.
  - Browser code never imports `@/lib/games` or `@/lib/lists` (that would put every game into the code every visitor
    downloads). It uses `src/lib/catalog-data.ts`: `loadCatalog()` / `useCatalog()` for the whole list
    (`/data/catalog.json`, fetched only when needed: search, "Show more", recently played, a random game) and
    `loadGame(slug)` for one game (`/games/<slug>/game.json` on R2: the player's data, how-to and controls included).
  - `scripts/gen-game-index.mjs` writes those two files and `src/lib/game-index.ts` (types, categories, aliases, the
    catalog's version). It runs by itself in `npm run dev`, `npm run build:static` and `npm run upload:r2` (or
    `npm run gen:index`). Commit `src/lib/game-index.ts`; git ignores the JSON files.

## 2. Hosting budget: one site file per game (hard rule)

- Each game uses exactly one file on the site: its page, `games/<slug>.html`. With ~600 files for the site itself
  that leaves room for about 19,000 games under the free plan's 20,000 files.
- Next writes 6 data files per page for in-app navigation; the build leaves them out for game pages. So **link to a
  game's page with a plain `<a href={gameHref(g)}>`** (or `goToGame(g)`), never `next/link` or `router.push`.
- All games share **one player page: `/play?g=<slug>`** (plus `&mode=easy|medium|hard`, `&embed=1` inside a game
  page's frame). Build every player link with `playHref(game, extra)` from `src/lib/catalog.ts`.
- Never create `/play/<slug>`, `/games/<slug>/<anything>` or any other page or site file per game. Extra content for a
  game goes inside its existing page or inside the game; extra data goes to R2.
- `npm run build:static` runs `scripts/check-game-budget.mjs`. It fails when a game has more than its one site file, a
  game file would ship with the site, or the code every page loads (home, a game page, the player) carries the games
  list or three.js. Fix your change; never skip the check or change its limits (that's the owner's call).
- Each game's code is already its own file: engines and arcade games are dynamic imports (`GameView.tsx`,
  `src/arcade/registry.ts`), loaded only when that game opens, and the Turbopack build cache recompiles only what
  changed. Keep it that way: never import a game's code statically from shared code.

## 3. Game files: art, sounds, music, fonts, data

- Put them in:
  - `public/games/<slug>/` — arcade games: `thumb.webp`, `og.jpg`; 3D games: `card.webp`, `hero.webp`, `og.jpg`,
    `shot-*.webp`
  - `public/audio/` — sounds and music
  - `public/brand/` — characters, logos
  - `public/fonts/`

  Files anywhere else never reach R2; adding a folder to `ASSET_DIRS` is the owner's decision.
- Load them only through the helpers, so they come from R2:
  - `next/image` (`<Image src="/games/…">`) does it automatically.
  - Everything else uses `cdn(path)` from `src/lib/cdn.ts`: `<img src={cdn(p)}>`, `new Image()`, `fetch`, three.js
    loaders. Set `crossOrigin = "anonymous"` on images whose pixels you read.
  - Full URLs for metadata, JSON-LD, sitemap and link previews use `absAsset(path)` from `src/lib/site.ts`.
  - Never `import` image or audio files into JavaScript, and never hard-code the R2 URL.
- `npm run upload:r2` uploads new and changed files. The site has no copy of game files, so changed files must be
  uploaded before the deploy (a push to `main` does it for you).
  - It knows what's already there from the bucket's own list, `_meta/uploaded.json` (every file's git blob hash and
    size), so any machine — this PC, another PC, GitHub Actions — sends only what changed. GitHub Actions doesn't
    even download the unchanged game files: their fingerprints come from git. `.r2-uploaded.json` is the local copy it
    falls back on when the bucket's list can't be read; `-- --all` sends everything again.
  - URLs carry a version (`?v=…`, `src/lib/asset-bundle.ts`): files are grouped into bundles (each game folder, sound
    family, brand and font folder) and bundles into 256 buckets, each with its own version. Browsers keep files for a
    year, a change in one game re-versions only its own buckets (not every game's files), and the version table in
    the site's code stays ~1.5 KB however many games there are.
  - Each sound family's file list is `audio/families/<family>.json` (generated; the audio code prefetches from it).
- Audio files and names:
  - Files: `public/audio/arcade/sfx_<family>_<name>.mp3`, `music_<family>_<name>.mp3`,
    `voice_<character>_<mood>.mp3`.
  - In code they are `"a:<family>_<name>"`. Add new sound names to `ArcadeSfx` in `src/lib/audio.ts` and each music
    loop length to `MUSIC_META`.
  - Packs are generated by `scripts/gen_*_audio.py`. Regenerating can change other files in the same pack (shared
    noise seed): restore any file you didn't mean to change.

## 4. Loading: a game must never stall or feel like it's loading

The loading layer is `src/lib/preload.ts` (download queue with NOW / NEXT / LATER priority), `src/lib/audio.ts` and
`src/components/player/GamePlayer.tsx`.

- **First screen:** every game runs inside `<GamePlayer>`; get its API with `usePlayer()`. The loading splash stays up
  until your engine calls `setLoading(null)` **and** every file asked for at NOW priority has arrived (at most 7 s
  more). On mount:
  - preload the menu's sounds with `audio.preload(UI_SOUNDS)`;
  - start the menu music with `audio.playMusic(...)` (both count as NOW);
  - call `setLoading(null)` once your first screen is built.

  For a long setup, report real progress with `setLoading(p, label)`.
- **Next level:** when a level starts, everything it needs must already be downloading. Preload a run's sounds when
  the menu opens, not when the run starts.
- **Look ahead:**
  - Call `audio.prepareMusic(nextMusic)` as soon as you know the next level or world (see `nextMusicAfter` in
    `src/dash/ui/DashApp.tsx`).
  - Call `audio.warmMusic([...])` for tracks that can start at any moment: boost, chase, boss, results.
- **Background loading:** a game with its own sound family gets the rest of its files in the background. Add its
  engine to `SOUND_FAMILY` in `src/lib/catalog.ts` (e.g. `dash: "dash"`).
- **Heavy work:** never download, decode or build anything big at the moment play needs it. Heavy level generation
  goes in a Web Worker: `new Worker(new URL("./worker.ts", import.meta.url))` inside `try/catch`, with a main-thread
  fallback. Examples: `src/roll/runWorker.ts`, `src/escape/worker.ts`.
- **Memory:** `audio` keeps only a few music tracks decoded at once. Don't hold your own copies of `AudioBuffer`s.

## 5. Smooth on phones — Android above all (every game; enforced)

Android phones hung and broke up the sound in every game until the shared kit in `src/lib/perf.ts` (2026-11-23). Every
game uses it, and `npm run check:perf` (part of `npm run build:static`) fails the build when one doesn't.
- **Quality:** "auto" graphics come from `autoQuality()` in `src/lib/perf.ts` (a device tier worked out once). Set the
  renderer with `pixelRatioFor(q)` (phones 1 / 1.25 / 1.5, computers 1 / 1.5 / 2), `antialiasFor(q)` (phones: high
  only) and `shadowsFor(q)` (phones: high only). Never set a pixel ratio from `window.devicePixelRatio`.
- **FrameGovernor:** every 3D renderer gets one (constructor, `resize()`, `dispose()` — see `src/dash/render.ts`). It
  lowers the resolution when fps drops and keeps the step only if it helps.
- **Frame cap and lite UI (automatic):** the game player caps every animation loop at the frame-rate setting (60 by
  default; a 120 Hz phone screen would otherwise double the work) and, on phones, turns off CSS backdrop blur while a
  game runs (`html.perf-lite`). So: drive the game with `requestAnimationFrame` (never `setInterval`), and don't rely on
  blur for readability — give HUD panels a solid translucent background.
- **No garbage per frame:** build materials and geometry once (instancing), and in the per-frame loop reuse scratch
  vectors and matrices — no `new THREE.Vector3()`, `clone()` or array literals per object per frame (they cause
  garbage-collection pauses: the "hangs"). Dispose everything when the game exits.
- **Sound:** only through `audio` (one engine: a voice budget of 10 sounds on phones and 24 on computers, the same
  sound at most every 35 ms, no reverb on phones, a bigger buffer on Android). A procedural music engine schedules at
  least 0.5 s ahead on phones (see `src/roll/music.ts`), so a busy frame never drops notes.
- **Measure:** open a game with `?perf=1` for the overlay (fps, slowest frame, long pauses, memory, tier, resolution,
  cap). Test with Chrome DevTools at 4× CPU slowdown, and on a budget Android phone through `chrome://inspect`. Aim for
  a steady ~60 fps with no long pauses during play.

## 6. Adding a new game

1. **Code**
   - **Arcade (2D canvas):**
     - a class in `src/arcade/games/<slug>.ts` extending `ArcadeGame`, with `meta` (slug, title, host, music
       `{ calm, action }`, sounds);
     - register it in `ARCADE_MODULES` (`src/arcade/registry.ts`);
     - add an `A({...})` entry in `src/lib/arcade-catalog.ts`.
   - **3D / own engine:**
     - an engine folder `src/<engine>/`;
     - an entry in `GAMES` in `src/lib/games.ts` (add the engine to `Game["engine"]`), then `npm run gen:index`
       (or `npm run dev`) and commit the regenerated `src/lib/game-index.ts`;
     - engines get the game as props (`slug`, `title`); never look a game up from the list in browser code;
     - in `src/components/player/GameView.tsx`: a `case`, a `dynamic()` import and an `ENGINE_CODE` entry;
     - in `src/lib/catalog.ts`: entries in `ENGINES_3D` and `SOUND_FAMILY`.
2. **Files:** art goes in `public/games/<slug>/` (thumbnails from `scripts/build_arcade_thumbs.py`,
   `scripts/build_og.py`), sounds in `public/audio/arcade/`.
3. **Identity:** every game gets its own look, characters, UI sounds and music. Never reuse another game's skin.
4. **Copy:** neutral, CrazyGames-style "About game" text.
   - Never write "no ads".
   - Never say a game is "for kids": no age wording in titles, copy or metadata.
   - No new racing games.
5. **Mobile first:** it must work one-handed on a 390×844 phone (big buttons, safe areas, portrait), then on desktop
   with keyboard and mouse.
6. **Difficulty:** start gentle and ramp slowly. Levels must not repeat noticeably.

## 7. Before you say you're done

- `npm run check:types` (TypeScript, incremental) and `npm run lint:changed` (ESLint on the files changed since
  `origin/main`, plus anything uncommitted): no errors.
- `npm run build:static` passes, including its `game budget:` and `mobile performance:` lines.
- `?perf=1` on a phone-size, 4× CPU-slowed browser: steady fps, no long pauses while playing.
- `npm run upload:r2` if you added or changed game files.
- Test the static build with `npx --yes wrangler@4 dev --port 8787`. It serves `out/` like Cloudflare, including
  redirects and headers. Open `/games/<slug>` and `/play?g=<slug>` at 390×844 and on desktop. Run headless browsers
  with `--mute-audio`.
- Check that:
  - the splash goes away on its own;
  - the console has no errors;
  - no picture or sound comes from the site's own address (all from R2);
  - the music stops when you leave the game.

## 8. Git, deploy and accounts

- Don't commit, push or deploy without the owner's explicit OK for that step. Deploy only with `npm run deploy`
  (build → upload to R2 → `wrangler deploy`).
- **A push to `main` is a deploy.** `.github/workflows/deploy.yml` lints the changed files and runs `npm run deploy`
  on GitHub Actions for every push to `main` (and from the Actions tab), with the repository secret
  `CLOUDFLARE_API_TOKEN` (made by the owner in the MOMOBLOBS Cloudflare account; without it only the checks run). So
  ask before pushing to `main` just as you would before deploying, and don't deploy from a PC as well for the same
  push.
- Commit as `272440351+uxwithanilg-designer@users.noreply.github.com`. Never put the owner's personal email anywhere.
- Don't touch the account's other R2 buckets (`news-app-media`, `news-app-staging-media`) or any Cloudflare setting
  outside this project.
- Leave the owner's dev server on port 3000 running; run yours on another port.
- Never type passwords. The owner does sign-ins and OAuth approvals.
