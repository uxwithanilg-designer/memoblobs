# Prompt: add a new game to MOMOBLOBS

Give this to any agent that should make a new game: paste everything below the line into its first message, or tell
it "follow `docs/NEW_GAME_PROMPT.md`". It is the step-by-step recipe; the full rules are in `docs/AGENT_PROMPT.md`.

---

You are adding one new game to **MOMOBLOBS** (`momoblobs-web`, https://momoblobs.com), a free online games site:
Next.js 16 static export on a Cloudflare Worker, game files (art, sounds) on the R2 bucket, deployed by GitHub Actions
on every push to `main`. Follow these steps in order. Don't skip a check, and don't push if one fails.

## 0. Before you start

1. Read `AGENTS.md` and `docs/AGENT_PROMPT.md` (the full rules: hosting, loading, phone performance, copy). This
   Next.js differs from what you know: read `node_modules/next/dist/docs/` for any Next API you touch.
2. Get the latest code: `git pull --rebase origin main`, then `npm ci` if `node_modules` is missing (Node 24).
3. Decide, and check that nothing else uses them (search `src/lib/games.ts` and `src/lib/arcade-catalog.ts`):
   - **slug**: lowercase with dashes, e.g. `marble-merge-2048`. It is the page address `/games/<slug>`.
   - **engine**: a short id, e.g. `marble` (its code folder is `src/<engine>/`).
   - **sound family**: usually the engine id (`marble` → `sfx_marble_*.mp3`).
   - **category**: one of `runner adventure racing puzzle brain memory focus reflex numbers`
     (`src/lib/categories.ts`). No new racing games.
   - Its own look, characters, colours, sounds and music: never reuse another game's skin.

## 1. Write the game

Most new games get their **own engine**; the model to copy is Marble Merge 2048 in `src/marble/`. (Small 2D
round-based games can instead use the shared arcade engine; see "Arcade games" at the end.)

- `src/<engine>/ui/<Name>App.tsx`, default export `function <Name>App({ slug, title }: { slug: string; title: string })`.
  The engine gets the game as these props; it never looks the game up from a list.
- Use the player's API: `const { setLoading } = usePlayer()` from `@/components/player/PlayerContext`. On mount,
  preload the menu's sounds with `audio.preload([...])` and start the menu music with `audio.playMusic(...)`. Call
  `setLoading(null)` when the first screen is built.
- Sound and music only through `audio` from `@/lib/audio`. Never create your own `AudioContext`.
- Save progress on the device in a zustand persist store, as `src/marble/save.ts` does.
- Heavy work (level generation, solving) goes in a Web Worker with a main-thread fallback, as `src/marble/worker.ts`
  and `src/marble/factory.ts` do.
- Phones first: it must work one-handed on a 390×844 phone in portrait (big buttons, safe areas), then on desktop
  with keyboard and mouse. Drive it with `requestAnimationFrame`, and create no objects in the per-frame loop.
- three.js (3D) games must use `autoQuality()`, `pixelRatioFor(q)`, `antialiasFor(q)`, `shadowsFor(q)` and a
  `FrameGovernor` from `@/lib/perf` (see `docs/AGENT_PROMPT.md` §5 and `src/dash/render.ts`).
- Load every picture or sound through `next/image` or `cdn(path)` from `@/lib/cdn`, e.g.
  `cdn("/games/<slug>/x.webp")`. Never `import` a media file, and never write the R2 address in code.
- Difficulty starts gentle and ramps slowly. Levels must not repeat noticeably.

## 2. Register it (exactly these places)

1. **`src/lib/games.ts`**
   - Add the engine id to the `engine?:` list in `interface Game`.
   - Add the game at the end of `GAMES`. Copy the shape of the `marble-merge-2048` entry and fill in every field:
     `slug, title, short, tagline, description, status: "live", category, ages: "", accent, accent2`,
     `cover: "/games/<slug>/card.webp"`, `hero: "/games/<slug>/cover.webp"`, `character, shots, modes, howTo,
     controls, faq, skills, released: "<YYYY-MM-DD, today>", art: "cover", engine`.
   - The copy is neutral, CrazyGames-style. Never write "no ads", never say "for kids", no age wording anywhere.
2. **`src/lib/seo.ts`**: add an entry to `GAME_SEO` (title, description and keywords; the rules are at the top of
   that file).
3. **`src/components/player/GameView.tsx`**, three lines:
   `const <Name>App = dynamic(() => import("@/<engine>/ui/<Name>App"), { ssr: false });`,
   `<engine>: () => import("@/<engine>/ui/<Name>App"),` in `ENGINE_CODE`, and
   `case "<engine>": return <<Name>App slug={slug} title={g.title} />;` in `GameView`.
4. **`src/lib/catalog.ts`**
   - Add `<engine>: "<family>"` to `SOUND_FAMILY`.
   - Add the engine to `ENGINES_3D` only if it is a three.js game.
5. **`src/lib/audio.ts`**
   - Add every new sound name (`"<family>_<name>"`) to the `ArcadeSfx` list.
   - Add every music track's loop length to `MUSIC_META`: `"a:<family>_<name>": { loop: <seconds> }`.
6. Run `npm run gen:index`. It regenerates `src/lib/game-index.ts`, which you commit; never edit that file by hand.

Rules the build enforces:
- Browser code (`"use client"` files, the engine) never imports `@/lib/games` or `@/lib/lists`.
- Add no new page, route or site file for the game. It gets exactly one page, `/games/<slug>`, built for you.
- Link to a game's page with a plain `<a href={gameHref(g)}>`, never `next/link`. Link to the player with
  `playHref(slug)`.

## 3. Add the files

Everything goes under `public/` and is committed to git. When you push, GitHub uploads it to R2.

- `public/games/<slug>/`, made from real screenshots of the game (copy the approach of `scripts/art/marble_art.py`):

  | File | Size | Used for |
  |---|---|---|
  | `cover.webp` | 1280×720 | every card and row (`hero`) |
  | `card.webp` | 600×800 | the tall card (`cover`) |
  | `poster.webp` | 1000×1500 | the game page |
  | `og.jpg` | 1200×630 | link previews when the page is shared |

  The build fails if `cover.webp`, `poster.webp` or `og.jpg` is missing for a live game. Save the `.webp` files at
  quality ~80 (WebP works in every browser and in Android and iOS apps); keep `og.jpg` a JPEG for link previews.
  `npm run build:static` then writes `cover-sm.webp` and `poster-sm.webp` (640 px wide) next to them: the small
  copies that cards and the poster load. Commit them with the rest of the folder.
- `public/audio/arcade/sfx_<family>_<name>.mp3` and `music_<family>_<name>.mp3`, from a
  `scripts/gen_<family>_audio.py` (copy `scripts/gen_marble_audio.py`). Don't change any other game's files. If a
  generator rewrote some, restore them with `git checkout -- <file>`.

## 4. Test it

1. Start the site with `npm run dev -- -p 3001` (port 3000 is the owner's). Open `http://localhost:3001/games/<slug>`
   and `http://localhost:3001/play?g=<slug>`, at 390×844 and on desktop. Check that:
   - the loading splash goes away on its own;
   - the console has no errors;
   - every screen, button and level works with touch and with keyboard/mouse;
   - the music stops when you leave the game;
   - with `?perf=1` and 4× CPU slowdown in DevTools, play stays smooth with no long pauses.
2. Run these checks; all must pass:
   - `npm run check:types`: no errors.
   - `npm run lint:changed`: no errors.
   - `npm run build:static`: it must end with the `site code:`, `game budget: … 1–1 site file each …` and
     `mobile performance:` lines and no `FAILED`.
3. Don't run `npm run upload:r2` or `npm run deploy`: they need the owner's Cloudflare login, and GitHub does both
   on push. (The static build loads game files from R2, where a new game's files appear only after the push, so judge
   the new game's look in `npm run dev`.)

## 5. Commit and push (this deploys the game)

This prompt is the owner's OK to commit and push this game to `main` once every check above passes. If a check
fails and you can't fix it, stop and report; don't push half-working work.

1. `git status`, then add:
   - the game's code;
   - the changed shared files from step 2;
   - `src/lib/game-index.ts`;
   - `public/games/<slug>/` (with the `-sm.webp` copies the build made) and the new
     `public/audio/arcade/*_<family>_*` files;
   - your art and audio scripts.

   Never add `.claude/`, `out/`, `.r2-uploaded.json` or anything with a secret. Generated JSON files are already
   ignored.
2. Commit as the owner's GitHub no-reply identity (never anyone's personal email):
   `git -c user.name=uxwithanilg-designer -c user.email=272440351+uxwithanilg-designer@users.noreply.github.com commit -m "Add <Title>: <one line on what it is>"`
3. `git pull --rebase origin main`. If `src/lib/game-index.ts` conflicts (another game landed first), run
   `npm run gen:index`, then `git add src/lib/game-index.ts` and `git rebase --continue`. Fix any other conflict by
   keeping both games.
4. `git push origin main`. Never force-push and never rewrite history. If the push is rejected, pull with rebase again
   and push again.

## 6. Check that it's live

1. The push starts the **Deploy** workflow on GitHub Actions. It lints, builds with every check, uploads the new
   files to R2 and publishes the site, which takes about 2 minutes. Follow it with `gh run list --limit 1` and
   `gh run watch <id> --exit-status`, or at https://github.com/uxwithanilg-designer/memoblobs/actions.
2. If it fails, read `gh run view <id> --log-failed`, fix the cause, commit and push again.
3. When it's green:
   - Open https://momoblobs.com/games/<slug> and https://momoblobs.com/play?g=<slug>: the page loads, the game
     starts, and the console has no errors.
   - `curl -I https://assets.momoblobs.com/games/<slug>/cover.webp` answers `200`.
4. Report to the owner:
   - what you made;
   - the two live links;
   - the check results;
   - anything you couldn't finish.

## Arcade games (the other kind)

A small 2D round-based game can use the shared arcade engine instead of its own; the model is
`src/arcade/games/maze-munch.ts`.

- `src/arcade/games/<slug>.ts`: a class extending `ArcadeGame`, with `meta`: slug, title, host character, music
  `{ calm, action }` and its sounds.
- `src/arcade/registry.ts`: add `"<slug>": () => import("./games/<slug>"),`.
- `src/lib/arcade-catalog.ts`: add `A({ slug, title, host, live: true, category, accent, accent2, short, tagline,
  description, modes, howTo, skills, controls })`.
- `src/lib/seo.ts`: add an entry. `src/lib/audio.ts`: add new sound names and music loops.
- Files in `public/games/<slug>/`: `cover.webp` (1280×720), `poster.webp` (1000×1500) and `og.jpg` (1200×630),
  plus the `cover-sm.webp` / `poster-sm.webp` copies `npm run build:static` makes.

Then test, commit, push and check exactly as in steps 4–6.

## Never

- Edit `src/lib/game-index.ts` by hand, or change the limits of any check (`scripts/check-*.mjs`,
  `scripts/build-static.mjs`). Those are the owner's call.
- Add pages, routes or site files per game; put a game's files anywhere outside `public/games`, `public/audio`,
  `public/brand` or `public/fonts`.
- Touch Cloudflare settings, other R2 buckets, or GitHub secrets; type passwords or tokens. The owner does
  sign-ins.
- Push with a failing check, or force-push.
