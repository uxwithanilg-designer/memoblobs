# MOMOBLOBS — Blob Brigade (crowd shooter) plan

> **Telugu lo short ga:** Reel lo game = okka soldier tho start, side lane lo **+1 tiles** collect chesi army penchali,
> mundu nunchi vasthunna pedda **red army** ni shoot chesi aapali, chivara **boss**. Manam same game cheyyam —
> mana **Momo blobs** tho, **bubbles** shoot chesi, **Grumpies** (Kranky pampina kopam blobs) ni confetti ga pop chestham.
> Kotha twists: **math gates (+10, ×2, −5)**, **cages lo blobs rescue**, **10 blobs = 1 Big Blob merge**, 11 characters
> leaders ga, 10 worlds × 10 stages = 100 stages, tarvatha **unlimited** (Remix Loop + Endless Waves + Daily Challenge).

## 1. What the reel shows (reference only — we do not copy it)

The reel is a "Top War" ad mini-game, ~48 s, portrait, 3D, tilted top-down camera:

| Moment | What happens |
|---|---|
| 0–4 s | One blue soldier at the bottom of a long path. Left side: a conveyor of blue **+1** tiles sliding down. Right side: a lane of yellow **+99** tiles, blocked by a giant branded tube. Middle: a huge carpet of **red soldiers** marching down. |
| 4–10 s | The tube falls over the right lane. The player slides left onto the **+1** tiles; the army grows to ~20. |
| 10–25 s | The blue crowd **auto-fires** straight up. Wherever it stands, that column of the red carpet melts. The player moves left/right to stop the front rows and to shoot the tube that blocks the **+99** lane. |
| 25–44 s | A **boss** with an HP bar (299 → 42) walks down the middle while the carpet keeps coming. |
| 46 s | The horde reaches the crowd → **DEFEAT**, retry button. |

**Why it's fun:** one finger, constant feedback (numbers going up, enemies melting), and one real decision every
second: *grow* (go to the recruit lane) or *defend* (stand in front of the horde) — and a jackpot to break open.

**What we change so it is our own game:** our characters and world, no soldiers/guns/fire (bubbles, confetti,
"Oops!" instead of "Defeat"), math gates for number sense, rescue cages, merging into Big Blobs, leaders with powers,
power-ups, enemy variety, designed stage types, bosses with phases, and unlimited modes.

## 2. The game

| | |
|---|---|
| **Title / slug** | **Blob Brigade** — `blob-brigade` |
| **Tagline** | "From one little blob to a mighty brigade!" |
| **Host / story** | **Momo** leads the brigade. **Kranky** the crab is grumpy again: he has turned the town's blobs into grey **Grumpies** and sends them marching. Every bubble that hits a Grumpy pops its grump — it bursts into confetti (bosses get *cheered up* and wave goodbye). |
| **Ages / categories** | 6+ · action, numbers, strategy |
| **Engine** | New 3D crowd engine `src/crowd/` (three.js, instanced meshes), same app shell ideas as the racing games (menus, save, skins, audio). |

### Core loop (one stage, 40–90 s)

1. Start with **1 blob** (+ upgrades) at the bottom of a lane-board; the camera looks down the board like the reel.
2. **Drag** left/right (anywhere on screen, relative drag) — the brigade follows. It **auto-shoots bubbles** straight
   ahead; more blobs = more bubbles.
3. **Grow** on recruit tiles and gates; **break** jars/gift boxes to open bonus lanes; **rescue** caged blobs.
4. **Defend**: Grumpies that reach the brigade pop one blob each (both vanish in a puff). Zero blobs = "Oops!".
5. Clear the horde (and the boss, if there is one) → **Hooray!** → stars, coins, next stage.

### The brigade

- **Count** is always shown big over the crowd (like the reel's numbers).
- **Merging (our "nothing → power" moment):** every 10 small blobs auto-merge into **1 Big Blob** (shoots big
  bubbles, takes 10 hits); 10 Big Blobs → **1 Giant Blob**. It looks great, keeps the crowd readable and keeps the
  instance count low on phones (≤ ~150 meshes even at 5,000 power).
- **Formation:** a tight round blob-cluster that squeezes through narrow gaps and spreads in open areas.
- **Shots:** fire rate per blob, bubble damage per tier (1 / 12 / 150), bubbles fly straight; Big Blobs have a little
  splash.

### Recruit tiles, gates and jackpots

| Thing | Effect |
|---|---|
| **+1 tiles** (blue, on a conveyor) | +1 blob each — the steady, safe supply |
| **+5 / +10 / +25 tiles** | Bigger tiles, placed where it's risky |
| **Math gates** (two side by side, slide down the board) | `+10` vs `×2`, `−5` vs `+3`, `÷2` vs `+20`… pick the bigger result. **Math mode** setting: *Off* (only + gates) · *Easy* (+, −) · *Plus* (+, −, ×, ÷). Ties into MOMOBLOBS' number games. |
| **Jars / gift boxes** (HP number on them) | Block a bonus lane (the reel's tube) — shoot them open to release **+50 / +99** tiles, coins or a power-up |
| **Rescue cages** (bubble cages inside the horde) | Pop the cage → 5–30 blobs run back and join you |
| **Thorn tiles** (red, −3) | Mild bad tiles, always avoidable, never in World 1 |

### Grumpies (enemies) — introduced one per world

| Grumpy | Behaviour | Counter |
|---|---|---|
| **Grump** | 1 HP, marches in the carpet | Anything |
| **Helmet Grump** | 3–5 HP, pot on its head | Stay on it, Big Blobs |
| **Speedy** | Runs ahead of the carpet | Watch the edges |
| **Bouncer** | Hops 2 rows forward every few seconds | Kill it before the hop |
| **Splitter** | Pops into 2 mini Grumps | Splash damage |
| **Shield Grump** | Wooden shield blocks bubbles from straight ahead | Shoot from the side lane at an angle |
| **Balloon Grump** | Floats over walls, drops a tile when popped (good!) | Free bonus |
| **Goo Cannon** | Lobs goo at a marked circle (1.5 s warning) — blobs in it are stuck for 2 s | Step out of the circle |

### Hazards and board pieces

Conveyors, moving walls, spinning fans (push the brigade sideways), sticky goo puddles (slow), jump pads (skip a
section), narrow bridges (crowd squeezes, merges help), sliding ice (World 3), lantern light (World 6), rolling
boulders (World 7, telegraphed with a shadow), teleport pads (World 9).

### Power-ups (picked up from jars/balloons; 1 button, bottom right)

**Rainbow Beam** (3 s laser column) · **Freeze** (horde stops 4 s) · **Magnet** (pulls nearby tiles in) ·
**Bubble Bomb** (clears a circle) · **Pillow Wall** (blocks the horde in one column for 5 s) · **Double Up** (×2 count, once).

### Leaders (the 11 MOMOBLOBS characters) — 3 free, the rest unlock by stars

| Leader | Passive / power |
|---|---|
| **Momo** (free) | Balanced · Power: *Cheer Wave* (pushes the front rows back) |
| **Pip** (free) | Snowball bubbles slow Grumpies |
| **Gloop** (free) | Starts with +3; every 20 s splits off a free blob |
| **Bolt** | Faster fire rate |
| **Bonbon** | Every 5 s a cake-bomb lands in the horde |
| **Prof. Hoot** | Slow-mo button (all Grumpies 50% for 4 s) |
| **Turbo** | Moves twice as fast across the board |
| **Zib** | UFO beam pulls a rescue cage to you |
| **Noodle** | Wide formation — shoots three columns at once |
| **Tiki** | Gates show +50% of their value |
| **Kranky** (last, after beating him) | Collects coins ×2, laughs at Grumpies |

### Bosses (world finales) — HP bar, phases, cute "cheered up" ending

1 Mega Grump (Garden) · 2 Jelly King (splits into 4 smaller jellies) · 3 Snow Grump Giant (throws snowballs at marked
circles) · 4 Wind-up Robo Grump (armour plates fall off) · 5 Captain Kranky's Crab Boat (first meeting) · 6 Grumpy
Ghost (fades out, only visible in lantern light) · 7 Stone Golem (shoot the glowing weak spots) · 8 Magma Grump
(drops lava puddles) · 9 UFO Mothership (beams Grumpies down) · 10 **King Kranky Mech** (3 phases, final boss).

## 3. Stages — 10 worlds × 10 stages = 100 designed stages

### Worlds (each one adds one new idea)

| # | World | New idea | Look | Music mood |
|---|---|---|---|---|
| 1 | **Garden Path** | +1 conveyors, jars, the basics | Grass, mushrooms, clover (like the reel's garden) | Bouncy marching band |
| 2 | **Candy Kitchen** | Math gates, Helmet Grumps | Cake floors, sprinkles, Bonbon's shop | Toy-box polka |
| 3 | **Snowy Peaks** | Ice floor (brigade slides), Speedy | Snow, igloos, Pip's camp | Sleigh-bell march |
| 4 | **Toy Room** | Moving walls, Bouncers | Wooden blocks, train tracks | Wind-up chiptune |
| 5 | **Beach Day** | Waves wash tiles, Balloon Grumps | Sand, buckets, crabs | Steel-drum march |
| 6 | **Spooky Night** | Darkness + lanterns, Splitters | Pumpkins, friendly ghosts | Spooky-silly swing |
| 7 | **Jungle Ruins** | Rescue cages, boulders, Shield Grumps | Vines, stone heads | Jungle drums |
| 8 | **Lava Land** | Goo Cannons, hot tiles | Basalt, glowing rivers | Big brass |
| 9 | **Space Station** | Teleport pads, low gravity bubbles | Zib's base, stars | Synth march |
| 10 | **Kranky's Castle** | Everything mixed | Red castle, crab flags | Epic finale |

### Stage pattern inside every world

| Stage | Type | Notes |
|---|---|---|
| 1 | **Learn** | The world's new idea, small horde, lots of recruits |
| 2 | **Classic Horde** | Normal mix |
| 3 | **Gate Dash** | Gates first, then one big horde — plan your count |
| 4 | **Bonus: Piñata Party** | No enemies; break piñatas for coins (a breather) |
| 5 | **Mini-boss** | A big Grumpy with an HP bar inside the horde |
| 6 | **Rescue Run** | Free as many caged blobs as you can before they march past |
| 7 | **Split Lanes** | A wall down the middle; two hordes; switch sides in time |
| 8 | **Hold the Line** | Survive 45 s of endless trickle |
| 9 | **Big Horde** | The largest horde of the world |
| 10 | **Boss** | World boss with phases |

### Stars (every stage)

- ★ win · ★★ win with ≥ 50% of your peak brigade still alive · ★★★ win + the stage goal (all cages / no thorn tiles /
  under par time — shown before the start).
- Next stage opens with ★; the next world opens at a gentle star count (World 2: 12★ … World 10: 200★).

### Difficulty ramp (gentle, numbers for the generator)

- Stage `n` (1–100), world `w`, stage-in-world `s`: horde size `H = 30 + 11·(n − 1)` (30 → ~1,120),
  horde speed `1.1 → 1.9 m/s`, average Grumpy HP `1 → 4`, new types weighted in slowly.
- **Fairness check:** the generator runs a quick "par bot" simulation of every stage and adds recruits until the bot
  wins with ~35% spare brigade. No stage can ship that the bot can't beat.
- After an "Oops!": **Momo's Helpers** (+20 blobs, continue where you were) once per stage for coins.

## 4. Unlimited play

1. **Remix Loop (stage 101 → ∞):** after stage 100 the map keeps going. Stage `n` replays world `((n − 1) mod 10) + 1`
   with a new random layout (seed = `n`), a new palette tier (Gold → Rainbow → Galaxy), harder by +4% per loop
   (capped so it never becomes impossible), new hats as rewards. The stage number keeps climbing forever.
2. **Endless Waves:** one board, waves never stop. Wave `k`: horde `40 + 15k`, a new Grumpy type every few waves,
   a boss every 5th wave, and a 10 s **Recruit Run** between waves. Score = Grumpies popped + 100 × wave. Best wave saved.
3. **Daily Challenge:** the same seeded stage for everyone each day with one modifier (Giant Bubbles, Only ×-gates,
   Speedy Horde, Tiny Brigade…). Coins, a streak counter, a weekly hat.
4. **Boss Rush** (unlocks after World 10): all bosses in a row, best time.

## 5. Progress, coins, upgrades

- **Coins** from popped Grumpies, coin tiles, piñatas, stars.
- **Upgrades** (coins, levels 1–20, gentle cost curve): Starting Brigade (+1 per level), Fire Rate, Bubble Power,
  Merge Speed, Coin Bonus.
- **Leaders** unlock by stars; **hats & bubble colours** for the brigade from Remix Loop and Daily streaks.
- Saved per game in local storage like the other games (best stage, stars, coins, upgrades, endless best).

## 6. Screens, look and sound

- **Screens:** Title (3D brigade marching on the board, Play / Endless / Daily / Leaders / Upgrades / Settings) →
  World map (10 islands, stage dots with stars, Remix Loop continues as a spiral) → Stage card (type, goal, stars) →
  Game → Results (Hooray! / Oops!, stars, coins, "next stage" big button).
- **HUD:** brigade count (big, over the crowd), horde left %, boss HP bar, coins, power-up button, pause. Portrait
  first; landscape centres the board with side panels.
- **Own look (not the racing skins):** soft clay-toy style — round shapes, pastel boards, chunky outlined numbers,
  wobbly bouncy UI; grey Grumpies pop to colourful confetti.
- **Own sound:** marching-band / toy-orchestra music packs per world (generated like the other packs), bubble shots
  layered so 200 blobs sound like a fizzing stream (not 200 clicks), satisfying pop/coin/merge chimes, Grumpy
  "hmph!" voices, boss cheer-up jingle. Tested muted in QA.
- **Settings:** music / SFX volume, vibration, graphics (auto / low / medium / high), Math mode, drag sensitivity,
  left-handed power button, reduce motion, colour-blind friendly tiles.

## 7. Tech plan

| Part | Plan |
|---|---|
| Engine | `src/crowd/` — `sim.ts` (fixed 60 Hz step: board, brigade, horde grid, bubbles, tiles, gates, bosses), `render.ts` (three.js; `InstancedMesh` for Grumpies ≤ 1,500 visible, brigade ≤ 150 merged meshes, pooled bubble instances; far rows as a cheap carpet), `camera.ts`, `audio.ts`, `levels.ts` (world recipes + seeded generator + par-bot check), `save.ts`, `ui/` (React screens + DOM HUD like the racing games) |
| Collisions | Column/row grid for the horde (no physics engine): a bubble only tests the grid cell it is in; cheap even with 1,000+ Grumpies |
| Performance | 60 fps target on mid phones; auto quality (shadows, confetti count, far carpet); merges cap meshes |
| Art | Clay Grumpy + blob models built in code (like the bikes); leader portraits rendered from `momo/src/cast2.js`; card / hero / OG art from a real game render (same rule as the racing cards) |
| Site | Catalog entry in `src/lib/games.ts`, `/play/blob-brigade`, `llms.txt`, card art |
| QA | Dev hooks `window.__crowd.debugAdvance(sec)` / `debugAutopilot()` / `debugState()`; headless Playwright with `--mute-audio`; par-bot sweep over all 100 stages + 30 Remix stages |

## 8. Build phases

1. **Core** — engine, brigade, merging, Grumpies (3 types), +1/jars/gates, World 1 + 2, results, save, Endless Waves.
   **Done (2026-11-17):** live at `/play/blob-brigade`. Code in `src/crowd/` — `sim.ts` (pure TS simulation + par bot),
   `levels.ts` (worlds, stage generator, Endless waves sized from your brigade), `render.ts` + `models.ts` (three.js,
   instanced crowds), `session.ts` (loop, drag input, sounds, DOM labels), `save.ts`, `ui/BrigadeApp.tsx`. Also built
   early: cages (Rescue Run), piñatas, split lanes, Hold the Line, both bosses with phases. Balance sweep:
   `node scripts/brigade_sweep.mjs [math] [runs] [skill]`; music `scripts/gen_brigade_audio.py` (march, polka, boss);
   cover art `scripts/build_brigade_art.py`.
   **Tougher + faster (2026-11-17, after the first playtest: "chala easy, chala slow"):** the march walks 1.45 → 2.4 m/s
   and starts close; bubbles fire 1.8×/s; new Grumpies — Spitters (lob goo at a red target circle), Chunky (6 hits) —
   and red thorn tiles (−3) on the conveyor; **every stage ends with a villain** (`STAGE_VILLAIN` in `levels.ts`):
   Sir Spikes (rolls in bursts), Balloon Baron (paratroopers), Kranky Krab (two goo balls + claw shield), Storm Grump
   (lightning), Chef Grumble (cakes, cooks jellies), Mega Grump (calls friends, then throws goo), Jelly King (splits).
   Villain HP is sized from the blobs a stage hands out. Par bot wins every stage; a careless bot (skill 0.3) loses
   the later ones about a third of the time.
2. **Content** — Worlds 3–10, all Grumpy types, hazards, power-ups, 10 bosses, leaders, upgrades.
   **Done (2026-11-17):** 100 stages over 10 worlds (`WORLDS`, `mechanicsOf`, `STAGE_VILLAIN` in `levels.ts`); world
   mechanics in `sim.ts` (ice slide, toy blockers, surf waves, darkness, boulders, lava vents/puddles, meteors); new
   Grumpies (Bouncer, Splitter, Shield, Balloon); 8 world bosses (Snow Grump Giant, Robo Grump with armour, Captain
   Kranky's Boat, Grumpy Ghost that fades, Stone Golem with a core, Magma Grump with lava puddles, UFO Mothership with a
   tractor beam, King Kranky Mech in 3 phases); 11 leaders + POWER button and 5 coin upgrades (`leaders.ts`); 6
   power-up tiles; 8 new music styles. Later worlds scale HP to the upgrades a player has by then (`upF` in
   `buildStage`); sweep with `UP=1 node scripts/brigade_sweep.mjs plus 3 0.3`.
3. **Unlimited & polish** — Remix Loop, Daily Challenge, Boss Rush, hats, music packs, catalog art, full QA sweep.
   **Done (2026-11-17):** Remix Loop (`remixSpec`: stage 101+ cycles the worlds with new seeds, gold/rainbow/galaxy
   palettes, +6% toughness per loop), Daily Challenge (`dailySpec`: seeded by date, one twist from `DAILY_MODS`, streaks),
   Boss Rush (`rushSpec`/`rushWave`: 15 villains, each sized from the brigade's real firepower), Wardrobe (`HATS`,
   `BUBBLES` in `leaders.ts`, `hatGeo` in `models.ts`) unlocked by stars, streaks, Remix and Boss Rush. Hold the Line now
   sends waves and bubbles pop on screen (`BUBBLE_END` −31) after a playtest found the stage looked empty.
   Sweep the modes with `MODE=remix|daily|rush UP_LEVEL=8 node scripts/brigade_sweep.mjs plus 3 0.3`.
   **Tougher for skilled players (playtest: 2-9 "too easy, few enemies"):** marches are ~1.5× bigger from stage 5,
   back rows get tougher (`PRESSURE_BASE`), and adaptive difficulty (`spec.expect`, `adaptK` in `sim.ts`) softens
   bubbles when the brigade is bigger than a good player's expected size. Bubbles are now bold solid colours.
   **Second toughness pass (playtest: "still easy", "the crowd should look like the ad"):**
   - Crowds grow every stage as a dense red-carpet march (`SPACING` 0.44): ~200 Grumpies in Garden → 3,000
     (`CROWD_MAX`) in the Castle. Later worlds no longer thin the crowd; past 3,000 the extra HP goes into each Grumpy
     (fractional HP, so a big bubble pops a whole row).
   - Adaptive difficulty follows a live expectation `Sim.ex` (what a good player could hold right now: 70% of the
     offered tiles, jars and cages plus the best gate at each row). A bigger brigade hits softer *and* takes bigger
     bites (`adaptK` also scales contact, villain smash and bomb damage), so a huge crowd still has to fight.
   - Every stage has an HP trim in `STAGE_TUNE`, measured by `node scripts/brigade_tune.mjs [worlds] [runs] [refine]`:
     the better of the par and kid bots wins ~65–90% and keeps about half its biggest brigade. Re-run it after any
     balance change. `scripts/brigade_sweep.mjs` takes `HUMAN=1.3` for a player who grabs more blobs than the bot.
   **Powers from World 3 (playtest at 3-1: "a bit hard, add powers and more bubbles"):** bubble powers Triple Shot
   (3 bubbles per shot, fanned), Rapid Fire and Mega Bubbles (bigger, 1.6× damage), 5–6 s each. Power tiles now look
   like powers (colour + emoji badge), up to 3 more drop down the conveyor mid-fight, and 2–4 Grumpies per march carry
   a power badge (pop them to get it). Power dice use their own seed so stage layouts stay as tuned. World 3+ tunes
   were re-refined with `LO=0.65 HI=0.9` after a second 3-1 playtest ("now a bit easy"); 3-1 itself is hand-set to 2.85.

## 9. Sister games on the same crowd engine (later, only when asked)

| Game | Idea |
|---|---|
| **Blob Rush** | The brigade *runs forward* through math gates and traps, meets rival crowds head-on, and ends at a finish tower that multiplies coins by how many blobs reach it. Unlimited generated runs. |
| **Blob Fort** | Defend Momo's fort on 3 lanes: move the brigade between lanes, spend recruits between waves on pillow walls and bubble towers. Endless waves. |
