# Slurp Lab — game plan (3D brain puzzle)

> Working name **Slurp Lab** (slug `slurp-lab`, engine `slurp`, 3D three.js). Host: **Prof. Hoot**, the sleepy genius
> owl. Stars: the **Gloopies** — Gloop's little jelly cousins, who escaped all over the lab. Prof. Hoot's glowing
> glass **Slurpers** collect them.
>
> Reference: the owner's video (a 7×10 board of coloured jelly blobs and glowing neon shapes, 52 s). We keep the core
> idea that makes it a good brain game and build our own game around it: our characters, our 3D lab look, 30 new
> mechanics, 600 graded stages and an endless lab that never repeats.

---

## 0. What the video shows (the mechanic we start from)

- A grid board full of round jelly blobs in 7 colours. Some cells hold **glowing neon shapes** (1–5 cells: square,
  bar, L, T, cross…) in a colour, each with a **number**.
- You **drag** a shape. It follows your finger cell by cell. It can move only over empty cells and over blobs **of its
  own colour**; it **eats** each own-colour blob it moves onto and its number counts down. Other colours, other shapes
  and the walls block it.
- At **0** the shape is full and vanishes, which opens space for the others.
- A bar at the top counts the blobs left per colour. The numbers always add up exactly: the shapes of a colour can eat
  exactly as many blobs as there are. Clear the board to win.
- Why it works as a brain game: every blob needs the right shape, eaten in the right order, along a path that is open
  at that moment. Eat with the wrong shape, or block a lane, and the board is stuck. You must think ahead.

**What we change:** our story, characters, names and 3D look; drag that feels physical (the Slurper glows, the
Gloopies stretch and get slurped in); exact puzzles made by a generator that proves every stage can be solved and
measures how hard it is; 30 lab mechanics on top of the core; stars by moves; hints from the solver; daily and endless
modes.

## 1. Core loop (the first 10 seconds)

1. The lab tray lights up. Gloopies blink and wobble. Prof. Hoot: "Each Slurper drinks its own colour. Exactly its
   number."
2. Drag the green Slurper into the two green Gloopies → *slurp, slurp* → its number goes 2 → 1 → 0 → it seals with a
   pop of sparkles.
3. The last Slurper clears the tray → Gloopies cheer → stars by moves → next stage.

Stage 1 can be won in 3 drags. By stage 60 the player is planning 10+ drags ahead.

## 2. The rules (exact, so the solver and the game agree)

- Board: `W × H` cells (5×6 at the start, up to 9×12), with optional **walls** and **odd board shapes** (masks).
- **Gloopy:** one per cell, a colour (2–8 colours). Variants come later (§4).
- **Slurper:** a polyomino (1–5 cells, 21 shapes), a colour and a **need** (the number). Need ≥ 1.
- **Drag:** a Slurper moves one cell at a time (up, down, left, right). A step is allowed when every cell it newly
  covers is (a) on the board and not a wall, (b) not covered by another Slurper, and (c) empty or holding a Gloopy of
  the Slurper's colour, and the Gloopies it would eat ≤ its need. Moving onto own-colour Gloopies eats them.
- At need 0 the Slurper **seals** and is removed (its cells become empty).
- **One drag = one move**, however far it goes. Undo is free; stars count the moves of your final path.
- **Win:** no Gloopies left. Every stage is built so the needs of each colour add up to its Gloopies, so a win means
  every Slurper sealed.
- **Stuck:** no Slurper can reach any Gloopy it may eat (the game checks after each move). Prof. Hoot offers Undo,
  Restart or a Hint.

## 3. The five big ideas (what makes it ours)

1. **Perfect-fit math.** Every number on the board matters: two yellow Slurpers (3 and 1) and four yellow Gloopies
   means you must pick which Gloopies the 1 takes. Counting is part of the puzzle.
2. **Order matters.** Gloopies of one colour are the walls of another. Clearing red first opens the lane blue needs;
   the generator builds these chains on purpose (§6).
3. **Proven puzzles.** A solver checks every stage, finds the fewest moves (par) and counts the traps. No stage is
   impossible and no stage is "lucky".
4. **Prof. Hoot's hints.** A hint shows the next good drag *from where you are now* (the solver runs live in a worker).
   If the board is already stuck, Hoot says how many undos bring it back.
5. **A shiny 3D lab.** Glossy jelly Gloopies with faces, glowing glass Slurpers, a lacquered lab tray, soft
   reflections and sparkles (§10).

## 4. The 30 lab mechanics (one new idea per world)

Each world adds one idea and keeps mixing the earlier ones, so stage 400 plays nothing like stage 40.

| # | Mechanic | What it does / why it makes you think |
|---|---|---|
| 1 | Slurpers | The core rules (§2). 2–3 colours, small boards. |
| 2 | Lab walls | Fixed blocks and odd tray shapes (rings, letters, hearts): routes get narrow. |
| 3 | Twin colours | Two or more Slurpers of one colour: decide which one eats which Gloopies. |
| 4 | Big shapes | T, S, Z, U, cross and long bars: big shapes turn badly in tight lanes. |
| 5 | Colour gates | A gate only its colour's Slurper may pass (Gloopies never move). |
| 6 | Ice floor | A Slurper let go on ice keeps sliding until something stops it. |
| 7 | Goo cells | A Slurper entering goo stops there (the drag ends): count your moves. |
| 8 | Padlocks | A locked Slurper opens when its key colour is cleared: forced order. |
| 9 | Bubbled Gloopies | A bubble blocks everyone until a Gloopy next to it is slurped (pop). |
| 10 | Rainbow Gloopies | Any Slurper may eat it — but it uses one of that Slurper's count. |
| 11 | Double Gloopies | A stacked pair counts 2: the Slurper must have 2 left. |
| 12 | Paint pads | Crossing a pad repaints the Slurper's colour. |
| 13 | One-way arrows | Cells you may cross only in the arrow's direction. |
| 14 | Portals | Paired rings: step in one, come out of the other. |
| 15 | Turn pads | A Slurper turns 90° when it crosses one (shape-fitting gets real). |
| 16 | Linked twins | Two Slurpers joined by a glowing link move together. |
| 17 | Crates | Push a crate one cell; crates block Gloopies' lanes. |
| 18 | Hopper Gloopies | After each move a Hopper jumps one cell along its arrow path (fixed, no luck). |
| 19 | Conveyor rows | After each move, a belt shifts its Gloopies one cell. |
| 20 | Gravity trays | After each move, Gloopies fall down to fill gaps. |
| 21 | Mirror pairs | Drag one Slurper; its mirror moves the opposite way. |
| 22 | Cracked glass | A glass wall breaks when a Slurper of 4+ cells bumps it. |
| 23 | Hungry Slurpers | When it stops, it also eats every own-colour Gloopy touching it (if it has room). |
| 24 | Frosted cells | A Gloopy under frost shows its colour only after a neighbour is cleared. |
| 25 | Switch tiles | Stepping on a switch swaps A walls and B walls. |
| 26 | Fuse Gloopies | Must be slurped within N moves (planning, not speed). |
| 27 | Split pads | A Slurper of 2+ cells splits into two halves (needs split too). |
| 28 | Merge | Two same-colour Slurpers that touch merge (needs add up). |
| 29 | Two-floor trays | Two stacked boards with lifts: a real 3D puzzle. |
| 30 | Grand Lab | Everything mixes; Prof. Hoot's final exams. |

Accessibility: every colour also has a symbol on the Gloopy's belly (circle, triangle, square, star, heart, moon, drop,
leaf) and on its Slurper, so colour-blind players can play every stage.

## 5. Worlds and stages: 30 labs × 20 = 600 stages

Each lab is a theme (look + music) and a mechanic:

| World | Lab | New idea | World | Lab | New idea |
|---|---|---|---|---|---|
| 1 | Bubble Lab | Slurpers | 16 | Clockwork Lab | Linked twins |
| 2 | Candy Lab | Walls & odd trays | 17 | Toy Lab | Crates |
| 3 | Garden Lab | Twin colours | 18 | Frog Pond Lab | Hopper Gloopies |
| 4 | Crystal Cave | Big shapes | 19 | Factory Lab | Conveyor rows |
| 5 | Ocean Lab | Colour gates | 20 | Waterfall Lab | Gravity trays |
| 6 | Ice Lab | Ice floor | 21 | Mirror Lab | Mirror pairs |
| 7 | Honey Lab | Goo cells | 22 | Glass Lab | Cracked glass |
| 8 | Vault Lab | Padlocks | 23 | Kitchen Lab | Hungry Slurpers |
| 9 | Soap Lab | Bubbled Gloopies | 24 | Snow Lab | Frosted cells |
| 10 | Rainbow Lab | Rainbow Gloopies | 25 | Robot Lab | Switch tiles |
| 11 | Jelly Lab | Double Gloopies | 26 | Firework Lab | Fuse Gloopies |
| 12 | Paint Lab | Paint pads | 27 | Cell Lab | Split pads |
| 13 | Wind Lab | One-way arrows | 28 | Magnet Lab | Merge |
| 14 | Space Lab | Portals | 29 | Sky Tower | Two-floor trays |
| 15 | Spin Lab | Turn pads | 30 | Grand Lab | Everything |

Inside every lab (20 stages):

- **Stage 1** shows the new idea in a small, clear board with a Prof. Hoot tip.
- **Stages 2–9** ramp up and mix the new idea with 1–2 earlier ones.
- **Stage 5 and 15** are short breathers (a little easier, fast to clear).
- **Stage 10 — Big Tray:** a bigger board with many Gloopies (a satisfying long clear).
- **Stages 11–19** ramp again, adding a second earlier idea.
- **Stage 20 — Hoot's Exam:** the hardest stage of the lab; it unlocks the next lab and gives a Lab Badge.

Every stage gets a **name** from its lab ("Bubble Lab 7 · The Narrow Bridge") and a distinct board shape: the
generator has 120+ tray masks (rings, steps, hearts, arrows, letters, islands…) and never reuses a mask, colour set and
mechanic mix within 40 stages.

## 6. The algorithm — "Plant and Prove"

Good puzzles are not random boards. We **plan the solution first, then plant the Gloopies along it**, then **prove**
the stage with a solver and grade it.

### 6.1 Make (Plant)

1. **Recipe** for stage `n` (deterministic, seeded by `n`): board size, mask, colours, Slurper count and shapes,
   active mechanics, target difficulty band (§7).
2. **Place the Slurpers** on the empty board (no overlap; spread out; mechanics placed: gates, ice, pads, portals…).
3. **Walk the intended solution.** Repeat until every Slurper's plan is done: pick a Slurper (weighted to create
   order chains), give it a target region, and walk it there by a path through currently free cells (other Slurpers are
   obstacles). Record, for every cell, **which Slurper reaches it first**.
4. **Plant the Gloopies.** In cells first reached by Slurper `S`, plant Gloopies of `S`'s colour — exactly `need(S)` of
   them, chosen to (a) form clusters that are reachable only late in its walk, (b) wall off lanes another colour uses
   later (this creates "clear red before blue" chains), (c) sit next to *other* same-colour Slurpers as decoys. After a
   Slurper's last planted Gloopy, its walk ends (it seals there), so later Slurpers may pass where it was.
5. Because each Gloopy is planted only where its own Slurper arrives first, and other colours never cross a cell before
   it is eaten, **the intended solution always works**: every stage is solvable by construction.

### 6.2 Prove and grade

- **Solver** (`solver.ts`): searches over *slurp events* (moves that eat), not single steps. From a state it finds,
  for every Slurper, the free-cell region it can reach without eating (BFS), then every step from that region that eats
  ≥ 1 Gloopy. Plus "make-room" moves (park a Slurper outside another's needed lane). A\* with state hashing and the
  heuristic "Slurpers still unsealed"; node budget per stage. It returns the **fewest moves (par)** and whether the
  stage has a much shorter "cheese" solution than intended (then the stage is rebuilt).
- **Trap test** (Monte Carlo): 200 quick playouts by a greedy player (always eats something if it can, random choice).
  `trapRate` = share that get stuck. This measures how much thinking a stage needs.
- **Metrics:** par moves, slurp events, dependency depth (longest chain of "X must clear before Y"), assignment
  ambiguity (same-colour Slurpers × Gloopy clusters), first-move choices that win, free space ratio, trapRate.
- **Difficulty score** = weighted sum of the metrics (weights fitted so a human playtest ranks stages correctly).
- A stage is **kept** only if its score falls in the band the curve wants for that stage; otherwise the generator tries
  the next seed until one fits (the forge report shows how many tries each stage took).

### 6.3 Campaign stages are forged offline

`node scripts/slurp_forge.mjs 1 600` builds, proves and grades all 600 stages and writes them as small data files in
`public/games/slurp-lab/stages-<n>.json` (100 stages per file, small JSON; uploaded to R2 like other game files). Same
stages on every device; the curve is checked by a report (`scripts/slurp_sweep.mjs`): par, trapRate and score per stage,
plus a bot that plays each one.

## 7. Difficulty curve: tougher every stage, gently

| Knob | Stage 1 | Stage 100 | Stage 300 | Stage 600 |
|---|---|---|---|---|
| Board | 5×6 | 7×9 | 8×10 | 9×12 |
| Colours | 2 | 4 | 6 | 8 |
| Slurpers | 2 | 7 | 11 | 16 |
| Gloopies | 4 | 30 | 50 | 75 |
| Par moves | 3 | 11 | 20 | 34 |
| Dependency depth | 0 | 2 | 4 | 7 |
| Trap rate | 0% | 35% | 60% | 85% |
| Mechanics on a stage | 0 | 1–2 | 2–3 | 3–4 |

- **Sawtooth:** each lab starts a little below the last lab's end (a new idea is enough to learn), then climbs past it.
- **No walls in the ramp:** a stage is never more than ~12% harder than the stage before (except Hoot's Exam).
- **Live check:** the game tracks undos, hints and restarts per stage; if a player is stuck many times in a row it
  quietly offers a free hint (the stage itself never changes).

## 8. After 600 — the Endless Lab (unlimited, never repeated)

- Stage 601+ are made on the device by the same Plant-and-Prove generator, in a **Web Worker** (`worker.ts`, budget
  ~300 ms per stage; the next stage is made while you play the current one).
- **Remix recipes:** a random mix of 2–4 mechanics from all 30, a lab theme, a tray mask, a colour set and a shape set,
  all seeded by the stage number.
- **No repeats:** each stage has a fingerprint (mask + mechanic mix + colours + Slurper multiset). The save keeps the
  last 300 fingerprints and the generator rejects any repeat.
- **Difficulty:** a slow climb with a sawtooth every 10 stages and a soft cap (stays at "very hard", never impossible).
- **Weekly Lab Mutation:** one twist for the week (all Slurpers hungry, or all floors ice, etc.).

## 9. Modes and meta

- **Campaign** (600 stages, map of 30 labs; replay any stage for stars).
- **Daily Brain Jar** — one stage a day for everyone (seeded by date), streak rewards.
- **Endless Lab** (after 600, or after Lab 10 as a side mode).
- **Exam Rush** — 5 of the Hoot's Exams in a row (unlocks after Lab 5).
- **Stars:** 3★ at par, 2★ at par + 3, 1★ for a clear. Stars open bonus labs.
- **Coins** for clears and stars → hints, the **Lab Wardrobe** (Slurper skins: crystal, gold, candy; Gloopy hats) and
  **sticker album** of Gloopy types.
- **Hints:** 3 free per lab, then coins. **Undo** is always free; **Restart** too.
- **Boosters** (optional, coins): *Shrink* (a Slurper's need −1 and a Gloopy of its colour vanishes), *Lift* (pick a
  Gloopy up and drop it on an empty cell). Exams can't use boosters.

## 10. Look and feel — "3D shine"

- **Gloopies:** glossy jelly drops (`MeshPhysicalMaterial`, clearcoat 1, high sheen, soft inner glow), big eyes and
  small mouths, squash-and-stretch idle wobble, blink, a happy hop when their Slurper comes near, a stretchy slurp into
  the glass when eaten.
- **Slurpers:** thick glowing glass outlines (emissive edges, a bright rim, glassy top), the number on a little
  glowing tag; they hum softly while dragged and burst into sparkles when sealed.
- **Tray:** a lacquered lab tray with rounded glossy tiles that catch the light; walls are frosted glass blocks.
- **Light:** an environment map (PMREM `RoomEnvironment`) for reflections on everything, a warm key light and a cool
  rim light; bloom-like glow on high quality only.
- **Colours:** 8 candy colours chosen to stay distinct (strawberry, tangerine, lemon, lime, aqua, cobalt, grape,
  bubblegum), each lab with its own tray and background palette.
- **Backdrop:** each lab has a softly moving 3D background (bubbles rising in the Bubble Lab, snow in the Ice Lab,
  planets in the Space Lab).
- **Camera:** tilted top-down (~55°), fits the board on phone portrait first; desktop shows the board bigger with the
  counter bar and Prof. Hoot beside it.
- **Juice:** counters bounce, numbers pop, combo sparkles when one drag eats 3+, a lab-wide cheer when the tray clears.
- **Performance:** instanced Gloopies, one material per colour, `FrameGovernor`, quality tiers (low drops bloom and
  reflections).

## 11. Sound

`scripts/gen_slurp_audio.py`: a calm, curious lab theme per world group (marimba, glass bells, soft synths — music for
thinking, not racing), a brighter Exam theme, and effects: pick up (glass clink), drag hum, slurp (pitch rises as the
need counts down), seal (pop + chime), blocked (soft bonk), stuck (gentle "hmm" from Hoot), undo (rewind), hint
(sparkle), clear (Gloopy cheer), stars.

## 12. Controls

- **Phone:** drag a Slurper with one finger (it follows cell by cell and stops where it's blocked). Buttons: Undo,
  Restart, Hint.
- **Mouse:** click and drag.
- **Keyboard:** Tab / Shift+Tab or number keys pick a Slurper; arrow keys or WASD move it one step (a pause of 0.6 s or
  Space ends the move); Z undo, R restart, H hint.

## 13. Technical plan (`src/slurp/`, follows `docs/AGENT_PROMPT.md`)

| File | What |
|---|---|
| `types.ts` | cells, colours, Slurper, Gloopy variants, mechanics, stage, state |
| `shapes.ts` | the 21 polyominoes, rotations, footprints |
| `rules.ts` | the pure game rules: legal step, eat, seal, mechanics' effects, stuck check, undo stack |
| `generator.ts` | Plant-and-Prove (§6.1), recipes, tray masks |
| `solver.ts` | A\* over slurp events, par, cheese check, hint from any state |
| `grader.ts` | trap test (Monte Carlo), metrics, difficulty score |
| `campaign.ts` | stage `n` → recipe and target band, lab table, names |
| `remix.ts` | Endless Lab recipes, fingerprints, weekly mutation |
| `worker.ts` | generator + solver off the main thread (hints, endless stages) |
| `render.ts` / `models.ts` | three.js tray, Gloopies, Slurpers, lab backdrops, effects; `FrameGovernor` |
| `session.ts` | input (drag / keys), animation timing, sounds |
| `save.ts` | progress, stars, coins, hints, wardrobe, fingerprints (`momoblobs-slurp`) |
| `ui/SlurpApp.tsx` | title, lab map, stage card, HUD (counter bar, moves / par, Undo / Restart / Hint), clear and stuck screens, tutorial |
| `scripts/slurp_forge.mjs` | forge and grade the 600 campaign stages |
| `scripts/slurp_sweep.mjs` | the curve report + bot play-through |

Site wiring: an entry in `GAMES` (`src/lib/games.ts`), a `case` + `dynamic()` import in `GameView.tsx`, `ENGINES_3D`
and `SOUND_FAMILY` in `catalog.ts`. Art (`card.webp`, `hero.webp`, `og.jpg`, screenshots) in `public/games/slurp-lab/`
from `scripts/build_slurp_art.py`; stage files and sounds go to R2. The game stays at 7 site files and plays on
`/play?g=slurp-lab`.

## 14. Build phases

- **Phase 1 — the core:** rules, solver, grader, Plant-and-Prove, the 3D tray look, Labs 1–5 (stages 1–100),
  tutorial, Undo / Restart / Hint, stars, coins, save, sounds, title and lab map, site entry and art.
- **Phase 2 — the labs:** mechanics 6–30 and Labs 6–30 (stages 101–600), Hoot's Exams, lab backdrops and music.
- **Phase 3 — forever:** Endless Lab (worker generation, fingerprints), Daily Brain Jar, Exam Rush, weekly mutation,
  wardrobe, sticker album, boosters, polish from playtests.

Each phase ends with the forge report, the bot play-through, headless QA on desktop and phone (`--mute-audio`),
`npm run build:static`, and a playtest by the owner before the next phase.

## 15. Decisions for the owner (recommendation first)

1. **Name:** *Slurp Lab* (recommended) · *Gloopy Gulp* · *Hoot's Brain Jars*.
2. **Board size on phones:** up to 9×12 (recommended; cells stay ≥ 36 px on a 390 px phone) · cap at 8×10.
3. **Boosters:** keep them small and off in Exams (recommended) · no boosters at all.
4. **Endless Lab unlock:** after Lab 10 as a side mode (recommended) · only after stage 600.

## 16. Built — Phase 1 (2026-11-19)

- **Engine** `src/slurp/`: `types`, `shapes` (21 polyominoes + rotations), `rules` (step, eat, seal, free region,
  eat options, stuck check), `solver` (0-1 BFS over slurp events + park moves → par, hints, dead-board check),
  `grader` (trap test, order depth, twins, score), `generator` (Plant and Prove + tray masks, walls, gates),
  `campaign` (Labs 1–5, recipes, names), `stagefile` (compact stage rows), `render` (three.js), `models`, `session`,
  `worker` (hints off the main thread), `save` (`momoblobs-slurp`), `ui/SlurpApp.tsx`.
- **Stages 1–100** forged offline with `node scripts/slurp_forge.mjs 1 100` into
  `public/games/slurp-lab/stages-1.json` (R2); `node scripts/slurp_sweep.mjs` replays every planted solution.
- **Mechanics live:** Slurpers, walls and odd trays (11 masks), twin colours, big shapes, colour gates.
- **Look:** glossy jelly Gloopies (teardrop bodies, belly symbols for colour-blind play, blinking eyes, cheeks, a slurp
  arc into the glass), glass Slurpers with neon rims and number tags, a lacquered tray per lab, frosted glass walls,
  gate arches, floating backdrop pieces per lab, Prof. Hoot on the tray's corner, sparkle bursts, the win ripple.
- **Phone app feel:** portrait first, safe-area padding, one-thumb bottom bar (Undo · Restart · Hint), counter bar of
  Gloopies left per colour, stage card, stuck banner, bottom-sheet clear screen and settings, haptics, the first-time
  coach (a hand shows the first drag).
- **Sound:** `scripts/gen_slurp_audio.py` — a calm title theme, one track per lab (Bubble, Candy, Garden, Crystal,
  Ocean) and an Exam track for every stage 20; 11 effects (pick, step, slurp rising in pitch, seal, bonk, stuck, undo,
  hint, win, star, drop), panned left / right by where they happen on the tray.
- **Check:** `node scripts/slurp_sweep.mjs 1 100` — every planted solution clears its tray. Curve (average per lab):
  Lab 1 par 3.5 / trap 0.04 / score 7.4 · Lab 2 par 6.1 / 0.08 / 12.5 · Lab 3 par 8.9 / 0.24 / 23.7 · Lab 4 par 7.2 /
  0.18 / 17.8 (a step back to learn big shapes) · Lab 5 par 10.6 / 0.36 / 27.6; Hoot's Exam 100: par 18, 11 Slurpers.
  Headless QA (`--mute-audio`) on 1280×760, 390×844 and 844×390: title, coach, real drags along the solution, clear
  sheet with stars and coins, Next, Hint, Undo, lab map, the Ocean Lab exam — no console errors. Tall phone screens get
  a steeper camera so the tray fills the width; fog only sits far behind the tray.
- **Art:** `python scripts/build_slurp_art.py [stage]` (dev server on :3000) renders the Garden Lab Big Tray half
  solved into `card.webp`, `hero.webp`, `og.jpg`.


## 17. Built — Phase 2 (2026-11-19): 30 labs, 600 stages, tougher everywhere

- **Owner's feedback on Phase 1:** too easy; the light was too bright in places and too dark in others; wanted
  better colours and much more thinking, on every stage, climbing all the way. So Phase 2 also **re-forged Labs 1–5**
  with the new, harder recipe.
- **Rules engine** (`rules.ts`, rewritten): one `move()` shared by the game, the solver, the generator and the sweep.
  It returns the steps, eats, seals and effects of one step (`MoveOut`), and handles every mechanic: ice slides and
  belts (follow-up moves), goo stops, gates, arrows, portals (`fits` check), turn pads (rotate 90° about the pad if
  the turned shape fits), glass walls (a Slurper of 4+ cells breaks them), crumble bridges (fall after you leave),
  switches (swap A/B blocks), paint pads, fences, crates (pushed by a single-cell front), locks (open when no Gloopy of
  the key colour is left), sleepers (wake when a neighbour Gloopy is slurped), linked and mirror pairs, hungry
  Slurpers, bubbled / double / rainbow / frosted / bomb / fuse Gloopies.
- **Mechanics that changed from §4** (they moved Gloopies after every move or changed the Slurper count, which breaks
  Plant and Prove — a planted Gloopy must stay where the walk planted it — and blows up the solver):
  18 Hopper Gloopies → **Glass bridges** (crumble) · 19 Conveyor Gloopies → **Conveyor belts that carry Slurpers** ·
  20 Gravity → **Bomb Gloopies** (blast the cracked glass around them) · 27 Split pads → **Glass fences** ·
  28 Merge → **Sleepy Slurpers** · 29 Two-floor trays → **Mega trays** (many colours and twins, three ideas at once).
- **Generator** (`generator.ts`): the walk uses the real `move(walk=true)`; Gloopies are planted on a cell's first
  visit with the Slurper's colour at that moment (so paint and rainbow work); short trips (`perTrip` 3) force the
  Slurpers to take turns, which is what makes the order matter. Twists (bubble, double, rainbow, frost, fuse) are added
  after the walk from the replay's eat times, and the final replay must win. Three relax levels keep every recipe
  makeable. The solver now only runs on trays with ≤ 4 Slurpers (on bigger ones it never beat the planted solution and
  took ~90% of the time), so the whole forge takes ~50 min on 6 processes and saves after every stage.
- **Curve** (`campaign.ts` `recipeFor`): boards 5.6→9 wide (up to 12 tall), colours 2.4→7.2, twins from stage 4,
  fill 0.70→0.86, the pick climbs toward the hardest of 7 candidates (12 for exams) with breathers at 5 and 15, and
  every lab mixes 1–2 earlier ideas into its own. `node scripts/slurp_sweep.mjs 1 600`: every planted solution clears.
  Average per lab (par / trap / score): Lab 1 9.6 / 0.32 / 25.0 (Phase 1 was 3.5 / 0.04 / 7.4) · Lab 5 11.8 / 0.33 /
  29.4 · Lab 10 14.2 / 0.83 / 44.1 · Lab 15 17.9 / 0.71 / 50.6 · Lab 20 21.4 / 0.79 / 58.8 · Lab 25 21.1 / 0.82 / 60.6 ·
  Lab 30 25.0 / 0.92 / 68.1. Stage 1 stays a 2-move lesson.
- **Look:** balanced light (hemisphere 1.2 with a lab-tinted ground, warm key 1.45, rim 0.6, exposure 1.05), sky
  edges lifted toward the lab's bright colour, less glare on the Gloopies, more vivid candy colours; per-lab trays,
  floaters (bubbles, sprinkles, leaves, crystals, fish, snow, stars, gears, planets, drops) and models for every new
  tile and Gloopy kind (rainbow, bubble shell, frost shell, bomb cap, double top, arrows, portals, turn pads, goo,
  paint splats, switches and A/B blocks, cracked glass, bridges, fences, crates, link bars, lock / Zz / hungry signs,
  fuse counters).
- **Sound:** `scripts/gen_slurp_audio.py` now has a thinking track for all 30 labs (25 new: ice … grand) and 13 new
  effects (pop, break, crumble, switch, paint, turn, crate, portal, unlock, bomb, slide, goo, burnt).
- **Input fix:** the player shell pauses on Space, so the session listens in the capture phase and keeps Space /
  Enter for "end the keyboard move" (also right after a seal or the winning move).

## 18. Built — Phase 3 (2026-11-19): forever

- **Endless Lab** (`endless.ts`, opens after Lab 10): stage 601+ is made on the device in the worker
  (`worker.ts` "gen") from `endlessRecipe(n)`: a lab look, 2–4 ideas from all labs plus the week's mutation, a tray
  mask, colours and twins, climbing in waves of 10 up to a cap. A recipe fingerprint (mask, ideas, colours, Slurpers,
  size) is remembered for the last 300 trays and a seen one is skipped. The next tray is made while you play.
- **Daily Brain Jar:** stage `DAILY_BASE + day` (same tray for everyone that day), streak coins
  (60 + 10 × streak up to 10 + 10 × stars), once a day.
- **Exam Rush:** 5 random passed Hoot's Exams in a row (opens after 5 exams), 40 coins each + 100 for all five.
- **Weekly Lab Mutation:** 10 twists that rotate by week (Ice, Goo, Wind, Fence, Bridge, Soap, Rainbow, Frost, Portal,
  Crate Week), on every Endless and Daily tray; shown on the title and in settings.
- **Lab Wardrobe:** 4 Slurper glasses (Lab glass, Crystal, Candy stripe, Gold) and 6 Gloopy hats, bought with site
  coins, shown on every tray. **Gloopy Album:** 14 stickers (8 colours, rainbow, double, bubbled, frosted, bomb, fuse),
  counted as you slurp them.
- **Boosters** (campaign stages that aren't exams, and Endless): Shrink (80 coins, a Slurper's need −1 and one of its
  Gloopies goes) and Lift (120 coins, move a Gloopy to an empty cell); a boosted clear gets 2 stars at most.
- **App:** title with PLAY + six mode tiles, 30-lab map with a lab strip, stage cards that name the tray's twists,
  fuse chip, stuck / burnt banner, H key = hint. Short landscape phones (≤ 520 px tall) put the counters on the left
  and the buttons on the right so the tray gets the whole height (`setInsets(top, bottom, left, right)`, a camera
  view offset centres it). The boot runs once per mount (the shell's `setLoading` changes identity on every
  re-render, which used to flash the splash and restart the title music on each stage start and clear).
- **Check:** headless QA (`--mute-audio`) on 1280×760, 390×844 and 844×390: stage 1 by real drags, one stage from
  every lab 6–30 played through the keyboard path (same `move()` as dragging) — all clear —, Daily, Endless and its
  next tray, Shrink, Exam Rush, Wardrobe (buy + wear), Album and the lab map; no console errors. `npx tsc`, eslint and
  `npm run build:static` pass.
