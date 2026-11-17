# MOMOBLOBS — website + Momo Shuffle

Next.js 16 (App Router, Turbopack, Cache Components) gaming site for the MOMOBLOBS clay characters,
with the first game **Momo Shuffle** — the real-time version of the "Track Momo" videos.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Set `NEXT_PUBLIC_SITE_URL` (default `https://momoblobs.com`) for canonical URLs, sitemap and JSON-LD.

## What's inside

| Path | What |
|---|---|
| `src/games/momo-shuffle/engine/*.js` | The original clay toolkit, characters, rigs and stage from `../momo/src` (plus a quality switch) |
| `src/games/momo-shuffle/track.ts` | Cup choreography for 3 / 4 / 6 cups (row or 3×2 grid on portrait phones) |
| `src/games/momo-shuffle/game.ts` | Real-time game: hide → shuffle → pick → reveal, endless levels, twists, coins |
| `src/games/momo-shuffle/MomoShuffle.tsx` | Lobby (Easy/Medium/Hard), HUD, banners, cup buttons, keyboard & gamepad |
| `src/components/player/GamePlayer.tsx` | Global player for every game: loading, pause menu, settings, fullscreen, wake lock, auto-pause |
| `src/lib/audio.ts` | Web Audio engine: original SFX + music loops, buses, ducking |
| `src/lib/store.ts` | Settings + profile (coins, levels, trophies, cup skins) saved in localStorage |
| `src/lib/games.ts` | Game catalogue — add a game here and it appears in menus, search, sitemap and JSON-LD |

## Regenerating assets

```bash
# images (logo, characters, covers, icons) from ../momo/renders
python scripts/build_assets.py "../momo/renders"
# sounds from the original audio.py (then encode WAV → MP3 with ffmpeg into public/audio)
python scripts/export_audio.py "../momo/tools" ./audio_wav
```

The transparent clay cut-outs are rendered by `../momo/src/web_assets.js` (run through `../momo/tools/run.py`).
