# Game art pipeline: 3D titles, posters, thumbnails

Every game has three pieces of key art, all made from code in `scripts/art/`:

| Piece | File (R2, via `public/games/<slug>/`) | Size | Used on |
|---|---|---|---|
| 3D title logo | `title.webp` (transparent) | ≤1600 px wide | posters, thumbnails |
| Poster | `poster.webp` | 1000×1500 (2:3) | the game page ("Official … poster"), JSON-LD images |
| Thumbnail | `cover.webp` | 1280×720 (16:9) | every game card (`hero` in the catalogue) |
| Link preview | `og.jpg` | 1200×630 | Open Graph / Twitter |

These are game files: they live on R2 (`npm run upload:r2`) and never count toward the 6–9 site files per game.

## Run it

Needs Python with Pillow, numpy and fontTools (`pip install fonttools`), Blender 5.2 at its default Windows path, and
`next dev` on :3000 for the captures.

```bash
python scripts/art/get_fonts.py            # once: ~55 OFL display fonts from github.com/google/fonts -> scripts/art/fonts/
python scripts/art/capture.py arcade       # gameplay frames of the canvas games (2000x1520)
python scripts/art/capture.py title        # 3D title screens, canvas only (wide + tall)
python scripts/art/capture.py portraits    # keyed hero cut-outs (Puddo, Tondu)
python scripts/art/make_titles.py [slug]   # Blender: 3D title logos (--fast for a quick preview)
python scripts/art/posters.py [slug]       # posters
python scripts/art/thumbs.py [slug]        # thumbnails + og.jpg
```

Review sheets: `python scripts/art/sheet.py <out.jpg> slug…` (titles), `python scripts/art/psheet.py posters|thumbs <out.jpg> slug…`.

## How it is built

- **Titles** (`title_specs.py` → `make_titles.py` → `title3d.py` in Blender/Eevee): real extruded, bevelled type, one
  typeface per game (no two games share a font), per-letter colours/bounce/arcs, outline slabs ("plates") grown with a
  round bevel (an outline offset makes spikes on sharp corners), materials (gloss, painted chrome, gold, clay, jelly,
  neon, holo, wood, stone, stripes), small 3D ornaments, optional neon glow added afterwards. Each title renders in its
  own Blender process (a reused process gave blank frames); Eevee drops the whole frame if text uses transmission, so
  "jelly" is deep gloss + subsurface + a little emission. On this laptop (integrated GPU) a title takes ~1.5 min.
- **Posters** (`posters.py`): one function per game, each in its own style (paper-cut ocean, Swiss Stroop board,
  film noir, neon club, travel poster, CRT, diner menu, comic page, case file, game show, risograph, notebook, pop-art,
  magazine cover, sweet mesh, wanted poster, pizzeria, ink scroll, candy shop, blueprint, plumbing, night storybook,
  hedge maze, movie one-sheet, Y2K stickers, synthwave, street, police split, recruitment poster…). Toolkit in `kit.py`.
- **Thumbnails** (`thumbs.py`): built to read at card size — the 3D title big on one side, a big character or hero shot
  on the other, the game's own scene graded behind. Racing games use their text-free chase shot (`card.webp`).
- Characters come from the clay cast renders in `../momo/renders/web_assets` (Momo, Kranky, Tiki and the arcade hosts).
