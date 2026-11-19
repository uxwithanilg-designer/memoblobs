# Tondu's Vine Climb — a 3D garden-lizard climbing game (plan)

> **Telugu lo short ga:** Mana kotha hero **Tondu** — oka nijamaina **garden lizard (తొండ)** shape lo: trikona tala,
> meda nunchi veepu varaku mullula crest, chala podavaina sanna tail, sanna kaallu-podavaina vellu, kopam/santosham
> lo erra ga maare meda. Tondu **winding green vines** meeda auto ga paiki ekkutadu. **Tap** chesthe vine rendo
> vaipu ki **flip** avutadu (mullu unna vaipu nunchi tappinchukovadaniki), **hold** chesthe vine ni gattiga pattukuni
> nemmadi avutadu (**Cling**), **swipe up** chesthe pakka vine ki **Leap**. Bugs ni **snap** chesi tintadu (golden
> beetles = coins). Thorn tagilithe Tondu **tail vadilestadu** (nijamaina lizard la) — adi oka extra life, malli
> perugutundi. **30 green worlds × 20 = 600 stages**, stages **okati tarvata okati continuous ga** vastayi — stage
> ayyaka "next stage" screen ledu, flower gate dati climb continue avutundi. Prati stage oka **concept** (42
> concepts: crow chase, spiral trunk, waterfall, night fireflies, camouflage, rival race, fruit fall…). Stage 20 =
> world **guardian**. Game motham **3D, greenery**. 600 tarvata **Wild Canopy** — anni mix ayyi, repeat feel lekunda
> forever. Build: Phase 1 → 2 → 3.

**Pitch (one line):** Tondu the garden lizard races up endless winding vines through 30 green worlds — flipping
around thorns, snapping bugs, dropping his tail to survive — to bring the stolen Sun Seeds back to the top of the
Great Banyan.

**Name / slug:** **Tondu's Vine Climb** (`tondu-vine-climb`, engine `vine`). "Tondu" comes from *tonda* (తొండ), the
Telugu word for the garden lizard. **Inspiration:** the vine-climbing mini-game genre in the owner's reference video
(a character climbs a winding vine and taps to switch sides to dodge thorns). Every name, character, world, stage,
art and sound here is our own — nothing from the game in the video (no ducks, planets, training/racing meta, names,
art or music).

---

## 0. What the video shows (the mechanic we start from)

- A character climbs a single **winding vine** that snakes up the screen (straights, S-bends, U-turns, zigzags,
  diagonals); the camera scrolls up with it.
- **Spiky burrs** sit on one side of the vine; **gold coins** float on one side.
- One input: **tap to switch to the other side of the vine** (the character swings around it) — a swoosh shows the
  switch. Hit a burr and the run ends.
- Flat 2D, one look, one verb, a short mini-game. Our game keeps that clean, readable core and builds a full 3D
  game on it.

## 1. Core loop (the first 10 seconds)

1. Tondu is already climbing — no menu between you and the vine. A thorn ahead on his side → **tap** → he swings
   under/over the vine (a quick 0.18 s spin, tail whipping) and the thorn passes by.
2. A line of bugs on the other side → flip into them → **snap snap snap** (combo sound climbs in pitch).
3. A **flower gate** across the vine: "Stage 2" blooms for a moment, a soft chime — and the climb simply goes on.
4. Hit a thorn → **Tondu drops his tail** (it wiggles away), he blinks for 1.5 s and keeps climbing. Without a tail,
   the next hit = he falls → one tap and he's back at the last flower gate, already climbing.

## 2. The hero — Tondu, 100% garden lizard

Modelled on the **Oriental garden lizard** (*Calotes versicolor*), stylised only a little (head and eyes ~15%
bigger for appeal). He never stands up, never wears clothes by default, always moves like a lizard.

| Part | Spec |
|---|---|
| Head | Wedge / triangular, pointed snout, swollen **jowls** behind the jaw, long mouth line; ~35% of body length |
| Eyes | Big round eyes with a dark **eye ring** and dark lines radiating from it; blink every 3–6 s |
| Ear | Small round tympanum behind the eye, two tiny spines above it |
| Crest | **Saw-tooth spines** from the nape down the back, tallest at the neck, shrinking toward the hips |
| Body | Slim, slightly flattened sideways; keeled-scale look (normal-mapped bumps), pale stripe along each flank |
| Tail | **2.5–3× body length**, thin, round, tapering to a point, faint bands; counter-swings while climbing |
| Legs | Four slender legs, elbows out, **five long thin toes** with claws (hind 4th toe longest) |
| Colour | Olive / khaki-brown with darker crossbands; **head and throat flush orange-red** in Sun Rush and combos (real breeding colours) |
| Moves | Diagonal climbing gait (front-left + hind-right), body S-wave, **head-bob push-ups** when idle or after a guardian, real **tail drop** (autotomy) and regrowth (stub → full) |
| Eating | **Snaps** bugs with the jaws (garden lizards don't have a long tongue) |

Built in code like our other 3D heroes (`src/vine/lizard.ts`: lathe/tube bodies, instanced crest spines, a bone-less
rig of groups), with a portrait render for the site.

**Cast:** **Kaaki** the crow (stole the Sun Seeds; dives, chases, casts shadows), Tondu's rival **Zeeza** the green
chameleon-cousin (races on a parallel vine), and the world **guardians** (§6). **Pippi** the tailorbird is the
friendly guide who chirps tips.

**Story (light):** a storm night, Kaaki grabs the garden's glowing **Sun Seeds** — without them the garden fades. The
seeds are dropped across 30 worlds as Kaaki flies to the crown of the **Great Banyan**. Tondu climbs after him; every
world's guardian gives one seed back. Stage 600: the crown, the last seed, the garden glows — and the Wild Canopy opens.

## 3. Controls (one thumb)

| Verb | Phone | Keyboard | From |
|---|---|---|---|
| **Flip** — swing to the other side of the vine | tap anywhere | Space / ↑ / W | stage 1 |
| **Cling** — grip and slow down (grip meter) | hold | Shift / ↓ / S (hold) | World 3 |
| **Leap** — jump to a nearby vine at a glowing mark | swipe up | Enter / D | World 4 |

- Bugs are snapped automatically when Tondu passes them on their side (upgrade: Snap reach).
- **Powers** (pickups on the vine): **Sun Rush** (orange glow, fast and thorn-proof for 4 s), **Leaf Glide** (floats
  over a broken section), **Bug Magnet** (snaps both sides), **Moss Shield** (one free hit).
- Inputs are buffered 120 ms, a flip is never lost; a second tap mid-flip flips back (needed in late worlds).

## 4. Continuous stages — no "next stage" screen

- A stage is **one stretch of vine** (≈ 35–70 s of climbing, 150–420 m) that ends at a **flower gate**. Passing the
  gate shows "Stage 37 ✓ · 24 bugs" for 1.2 s over the play, saves progress, and the next stage's vine is already
  under Tondu's feet. **There is no results screen, no stage select and no Next button.**
- Every **10th stage** is a **Long Vine** (2× length, a moss checkpoint halfway); every **20th** is the world's
  **Crown Climb** with its guardian; stages 5 and 15 are **Gold Rush** breathers.
- **World change** every 20 stages: the vine climbs up through leaves / mist / clouds into the next world, a world
  card fades in over the play ("World 7 · Coconut Coast"), the music crossfades. No loading pause — the next world is
  built while you climb the guardian stage.
- **Fall** (hit without a tail, or off a broken vine) → a soft "Tondu fell!" card with one big **Climb again** button
  (or tap anywhere) → back at the last flower gate (or moss checkpoint). After 3 falls on one stage, Pippi offers a
  tip and a free Moss Shield.
- **Leaving** and coming back: the game opens straight onto the vine at your saved stage. Pause (top right) has
  Home, Wardrobe, Bug Book, Settings. Worlds already cleared can be replayed from the Bug Book's world pages
  (optional; never in the way of the main climb).

## 5. Stage concepts — why no two stages feel alike (42)

Each stage = **world look + one concept + a seeded vine shape + world twists**. Concepts unlock over the worlds and
then mix.

| # | Concept | What it asks of you |
|---|---|---|
| 1 | Classic Climb | Thorns alternate sides; read the vine early |
| 2 | Bug Feast | Long bug lines on both sides; keep the combo (no missed bug) for ×2 |
| 3 | Hairpin Hills | Tight U-turns and zigzags: the vine turns back on itself, read where it goes |
| 4 | Thorn Rhythm | Thorns on the music's beat; flip on the beat |
| 5 | Gold Rush | Breather: golden beetles everywhere, few thorns |
| 6 | Fork Choice | The vine splits — the side you're on at the fork picks the branch (one safe, one bug-rich) |
| 7 | Cling Corners | Thorns that open and close (thistle buds): hold to slow and time it |
| 8 | Bamboo Express | Straight bamboo poles, very fast, quick flip chains |
| 9 | Leap Gaps | Broken vine pieces: swipe up at the glowing mark |
| 10 | Long Vine | Double-length stage with a moss checkpoint |
| 11 | Rolling Burrs | Burrs roll down the vine toward you, on either side |
| 12 | Ant Highway | Ant columns march along one side, gaps open and close |
| 13 | Fruit Fall | Mangoes / coconuts drop; their shadows show the side |
| 14 | Bee Crossing | Bees fly across the vine in waves |
| 15 | Crow Chase | Kaaki chases from below: grab Sun Rush, never cling too long |
| 16 | Rival Race | Zeeza climbs a parallel vine; beat him to the gate for a bonus seed |
| 17 | Spider Drop | Spiders drop on silk across the vine on a timer |
| 18 | Web Maze | Sticky webs slow one side; plan flips around them |
| 19 | Lotus Hop | Leap from stem to stem over a pond |
| 20 | Flower Bounce | Big flower pads fling Tondu up to the next vine |
| 21 | Wind Sway | The vine sways; thorns ride the sway |
| 22 | Monsoon Slip | Rain: flips take longer, puddle drips |
| 23 | Lightning Canopy | A flash marks where lightning will hit |
| 24 | Night Fireflies | Night (still bright enough): fireflies light the thorns near you |
| 25 | Spiral Trunk | The vine spirals round a giant trunk; the camera orbits in true 3D |
| 26 | Tree Hole | The vine dives into a hollow trunk: glowing mushrooms, tight turns |
| 27 | Waterfall Wall | The vine runs behind a waterfall; the water side pushes you off |
| 28 | Growing Vine | The vine grows just ahead — cling so you don't outrun it |
| 29 | Withering Vine | The vine dries and drops behind you — no long clings |
| 30 | Camouflage | Kaaki's shadow sweeps the vine: be on the leafy side when it passes (Tondu turns leaf-green) |
| 31 | Sun Basking | Sun patches fill the Sun meter; shade slows you; time your Sun Rush |
| 32 | Seed Pods | Pods burst and grow small thorns a moment later |
| 33 | Caterpillar Ride | Ride a giant caterpillar along the vine; hop off before the thorn bush |
| 34 | Twin Vines | Two braided vines: flip *and* leap between them |
| 35 | Mirror Pippi | Pippi copies your flips on a second vine; keep both safe |
| 36 | Egg Escort | Carry a lost bird egg: a hit drops it, the gate gives a seed if it's safe |
| 37 | Fog Turns | Mist hides the vine; leaf arrows show the turns |
| 38 | Snail Lane | Slow snails on both sides: pass at the right time |
| 39 | Sap & Dew | Sticky sap slows, dew drops speed up |
| 40 | Thorn Storm | Dense, fast skill test (late worlds only) |
| 41 | Rope Swing | Swing on an aerial root and let go at the right moment (tap) |
| 42 | Crown Climb | The guardian stage (§6) |

## 6. The 30 green worlds (20 stages each = 600)

Everything is **greenery-first**: lush leaves, vines, moss, ferns, flowers as accents, soft sun rays. Each world adds
**one new idea** (concept or verb), **one new bug** for the Bug Book and a **guardian** at stage 20.

| # | World | New idea | New bug | Guardian (stage 20) |
|---|---|---|---|---|
| 1 | Backyard Garden | Flip, thorns, bugs, tail drop | Cricket | Kaaki's first dive |
| 2 | Mango Orchard | Bug Feast combos, Fruit Fall | Fruit fly | Mango Monkey (throws mangoes) |
| 3 | Bamboo Grove | **Cling**, Bamboo Express, Cling Corners | Grasshopper | Bamboo Beetle (rolls down) |
| 4 | Banana Grove | **Leap**, Leap Gaps | Leafhopper | Fruit Bat (swoops) |
| 5 | Tea Hills | Fork Choice, Hairpin Hills | Tea moth | Two crows |
| 6 | Lotus Pond | Lotus Hop, dragonflies | Dragonfly | Kingfisher (dives from the side) |
| 7 | Coconut Coast | Wind Sway, coconut fall | Palm weevil | Coconut Crab (throws coconuts) |
| 8 | Rose & Jasmine Garden | Bee Crossing, thorny stems | Honeybee | Queen Wasp |
| 9 | Fern Gully | Rolling Burrs, Web Maze | Ladybird | Spider Matriarch |
| 10 | Rainforest Canopy | Spiral Trunk, Tree Hole | Stick insect | Rat snake (slides down the vine) |
| 11 | Mushroom Glade | Flower Bounce, spore puffs | Glow beetle | Bullfrog (tongue lashes) |
| 12 | Monsoon Woods | Monsoon Slip, Lightning | Rain beetle | Storm Crow |
| 13 | Sunflower Fields | Sun Basking, Sun Rush meter | Bumblebee | Sparrow gang |
| 14 | Mossy Ruins | Withering Vine, stone pillars | Rove beetle | Zeeza race (rival) |
| 15 | Firefly Night Garden | Night Fireflies | Firefly | Owl (silent glides) |
| 16 | Waterfall Cliffs | Waterfall Wall, mist | Water strider | Grey Heron |
| 17 | Banyan Village | Rope Swing, Twin Vines | Cicada | Langur troop |
| 18 | Gourd Trellis | Caterpillar Ride, Snail Lane | Caterpillar | Squirrel (throws nuts) |
| 19 | Orchid Valley | **Camouflage** | Orchid mantis | Shrike |
| 20 | Mangrove Maze | Growing Vine (rising tide) | Mangrove cricket | Mud Crab King |
| 21 | Pine Highlands | Fog Turns, cold wind | Pine beetle | Eagle (giant shadow) |
| 22 | Spice Garden | Seed Pods, pepper vines | Pepper weevil | Mynah (mimics your flips) |
| 23 | Blossom Hills | Mirror Pippi, petal storm | Silk moth | Twin Crows |
| 24 | Jade Temple Garden | Thorn Rhythm with temple bells | Jewel beetle | Temple Monkey |
| 25 | Glowing Jungle | Bright neon-green night, Egg Escort | Glow-worm | Moth Queen (dust clouds) |
| 26 | Thorn Thicket | Thorn Storm | Treehopper | Hornbill |
| 27 | Storm Canopy | Lightning + wind + rain mixed | Rhino beetle | Thunder Kite |
| 28 | Cloud Forest | Big leaps above the clouds, Sap & Dew | Luna moth | Kaaki's flock |
| 29 | Sky Garden | Floating islands joined by vines; every idea mixes | Atlas moth | Raven Rex (Kaaki's big brother) |
| 30 | The Great Banyan | The finale: all ideas, the tallest climb | Golden scarab | **Kaaki** — stage 600 |

**Guardians** reuse ~10 behaviours with new looks and harder patterns: dive-bird (shadow shows the side), thrower
(fruit/nuts/coconuts on both sides), slider (snake or beetle coming down the vine — flip past at the gap), dropper
(spider), swarm (wasps, moths), shadow-hunter (camouflage), mimic (copies your last flips), racer (Zeeza), tongue
(frog), quake (monkeys shake the vine). A guardian stage is a 60–90 s climb with 3 phases; no health bars to grind —
you win by **reaching the crown**, and the guardian gives back a Sun Seed.

## 7. Difficulty — tougher every stage, always fair

Driven by one schedule (`stages.ts`), with a small sawtooth: the first stages of a world are a little easier while
you learn the new idea, then it climbs; stages 5/15 breathe; 10 and 20 peak.

| | Stage 1 | Stage 100 | Stage 300 | Stage 600 |
|---|---|---|---|---|
| Climb speed | 3.2 m/s | 4.4 m/s | 5.8 m/s | 7.2 m/s |
| Reaction window (decision → impact) | 1.10 s | 0.75 s | 0.52 s | 0.40 s |
| Hazards per 10 m | 0.8 | 1.6 | 2.4 | 3.2 |
| Actions per minute | 15 | 32 | 50 | 70 |
| Concepts mixed in one stage | 1 | 2 | 2–3 | 3–4 |
| Stage length | 150 m | 220 m | 300 m | 420 m |

**Fairness rules (checked by the bot sweep):**
- Every hazard pattern has a safe line, with at least the reaction window between decisions.
- The camera always shows ≥ 1.6 s of vine ahead; it pulls back as speed rises and leans into turns.
- Nothing appears from behind a turn without a warning (shadow, glow, sound).
- A **bot with human-like delay** (250 ms reaction, small timing noise) must clear every stage; a "good player" bot
  (180 ms) must clear it with a tail left on most stages; a 400 ms bot must fail late stages — that keeps it tough.
  `node scripts/vine_sweep.mjs [from] [to] [skill]` reports clear rate, falls and close calls per stage; a tune
  table nudges any stage outside its band.

## 8. After 600 — the Wild Canopy (unlimited, never repeated)

- Stage 601+ is made on the device from the stage number: **world look (30) × 2–3 concepts (42) × twist (16: night,
  rain, wind, fog, mirror, double speed bursts, thorn rhythm, petal storm, golden hour, low gravity leaps, …) ×
  guardian behaviour**, all seeded — in a **Web Worker**, the next stage ready before you reach the gate.
- **No repeats:** each stage has a fingerprint (look + concepts + twist + vine-shape family). The save keeps the last
  400 and skips any repeat; vine shapes come from a seeded grammar (straights, bends, U-turns, zigzags, spirals,
  loops, forks), so no two vines are the same.
- **Difficulty:** keeps climbing slowly in waves of 10 (a breather opens each wave) to a soft cap just above stage
  600; every 20th stage is still a Crown Climb.
- **Weekly Season:** one twist for the week everywhere (Monsoon Week, Firefly Week, Bamboo Week…).

## 9. Modes and meta

- **The Climb** — the main game: stages 1 → 600 → Wild Canopy, one by one, continuous.
- **Daily Vine** — one seeded stage per day, same for everyone, streak rewards.
- **Coins = golden beetles** (and every bug counts toward the Bug Book). Shop **upgrades**: tail regrow speed, Sun
  Rush time, Snap reach, Cling grip, Moss Shield start.
- **Bug Book** — 30 bugs × 3 variants (normal, shiny, rare) with a fun fact each; world pages show seeds found.
- **Wardrobe** (3D): real garden-lizard colour morphs — Classic olive, **Red-head** (breeding colours), Leaf-green,
  Sand, Night-blue, Gold — plus a few hats and vine trails, paid with site coins.
- **Missions:** 3 at a time ("flip 30 times without clinging", "snap 5 fireflies", "beat Zeeza").

## 10. Look and sound — 3D, green, bright

- **3D:** a thick, glossy **vine tube** with instanced leaves, tendrils, flowers and dew; Tondu, bugs, thorns,
  guardians and props are real 3D models. The camera is a **side-on follow cam** (best for reading the vine) that
  leans and swings in turns and orbits in Spiral Trunk stages; behind the vine, **layered 3D jungle** (near leaves,
  mid trees, far hills/canopy) with parallax and soft sun rays.
- **Greenery-first palette:** every world is mainly green (lime, jade, olive, emerald, moss) with one accent
  (mango orange, lotus pink, sunflower yellow, firefly gold). **Balanced light:** warm sun key + sky fill, no harsh
  glare, no dark corners; night worlds stay readable (moonlight + glow), never murky.
- **Juice:** leaf burst on flips, snap sparkle and combo numbers, tail-drop wiggle, Sun Rush orange trail, gate bloom,
  world-change cloud climb.
- **Music:** one track per world (30) + guardian theme + title; flips and snaps are pitched to the music's key;
  jungle ambience per world (birds, rain, frogs, water). Original, generated like our other games
  (`scripts/gen_vine_audio.py`).

## 11. Technical plan (`src/vine/`, follows AGENTS.md / docs/AGENT_PROMPT.md)

- `path.ts` — vine grammar → arc-length-parametrised spline (piece library: straight, bend, S, U-turn, zigzag, spiral,
  loop, fork, gap); `stages.ts` — the 600-stage schedule (world, concepts, params, seed) and `wild.ts` for 601+.
- `sim.ts` — pure TypeScript simulation (position along the vine, side, flip/cling/leap states, hazards, powers,
  tail) + `bot.ts`; the same code runs the game, the sweep and the worker.
- `lizard.ts` (Tondu rig + animation), `models.ts` (thorns, bugs, guardians, props), `world.ts` (30 world looks),
  `render.ts` (three.js, instancing, FrameGovernor, quality levels), `camera.ts`.
- `session.ts` (input → sim → render, sounds), `save.ts` (`momoblobs-vine`), `worker.ts` (Wild Canopy + Daily),
  `ui/VineApp.tsx` (HUD: stage chip, bugs, tail, Sun meter, gate cards, pause, wardrobe, Bug Book).
- **Stages are made from code + seeds — no big data files.** Game files on R2 are only music, sounds and art.
- **Site:** `games.ts` entry, `GameView` case / `dynamic()` / `ENGINE_CODE`, `ENGINES_3D` + `SOUND_FAMILY`; the
  game page stays at 7 site files; play on `/play?g=tondu-vine-climb`.
- **Checks each phase:** sweep report, headless QA with `--mute-audio` on 390×844, 844×390 and desktop, `npx tsc`,
  eslint, `npm run build:static`.

## 12. How it differs from the video

| The video | Tondu's Vine Climb |
|---|---|
| flat 2D, one jungle look | full 3D, 30 green worlds, orbiting camera moments |
| one verb (switch side) | Flip + Cling + Leap, powers, forks, swings |
| a short mini-game | 600 continuous stages + the never-repeating Wild Canopy |
| hit = over | real lizard **tail drop** as a shield that regrows |
| coins | 30 bug species to snap and collect, golden beetles as coins |
| no story | Kaaki, the Sun Seeds, 30 guardians, rival Zeeza |
| — | lizard-only ideas: camouflage, sun basking, head-bob, red-throat Sun Rush |

## 13. Build phases

- **Phase 1 — the core (stages 1–100, worlds 1–5):** vine grammar, sim + bot + sweep, Tondu model and animation,
  render with worlds 1–5, Flip / Cling / Leap, thorns, bugs, tail drop, powers, continuous stage flow and saving,
  concepts 1–10 + 13, guardians 1–5, HUD and pause, sounds + 5 world tracks, site entry and art.
- **Phase 2 — the worlds (stages 101–600):** worlds 6–30, the rest of the 42 concepts, guardians 6–30, world music,
  difficulty tuning across all 600 with the sweep.
- **Phase 3 — forever:** Wild Canopy 601+ (worker, fingerprints, weekly Season), Daily Vine, Bug Book, Wardrobe,
  upgrades shop, missions, polish from the owner's playtest.

Each phase ends with the sweep report, headless QA (`--mute-audio`), `npm run build:static`, and the owner's
playtest before the next phase.

## 14. Decisions for the owner (recommendation first)

1. **Name:** *Tondu's Vine Climb* (recommended) · *Tondu: Green Climb* · *Lizard Vine Run*.
2. **Camera:** side-on 3D follow cam that leans and orbits (recommended — reads like the video, looks 3D) · fully
   behind-the-lizard tube runner.
3. **On a fall:** back to the last flower gate / moss checkpoint (recommended) · back to the world's first stage.
4. **Controls:** tap Flip + hold Cling + swipe-up Leap, added over Worlds 1–4 (recommended) · tap only.
5. **Old worlds:** replay from the Bug Book only (recommended, keeps the "one by one" feel) · a world map.

## 15. Built — Phases 1, 2 and 3 (2026-11-19)

All three phases were built in one go, as the owner asked ("all phases one by one, don't stop").

- **Engine** `src/vine/`: `types`, `path` (vine grammar → sampled 3D path, spiral trunks, `XMAX` 2.4 m for portrait),
  `worlds` (30 worlds, 30 bugs, 30 guardians, 43 concepts), `stages` (campaign schedule, Wild Canopy `wildDef`,
  Daily `dailyDef`, the fair placer), `sim` (pure TS), `bot` (human-reaction bot), `lizard` (Tondu), `models`, `view`
  (one stage's 3D), `render` (lights, sky, particles, cinematic camera), `session`, `save` (`momoblobs-vine`),
  `ui/VineApp.tsx`. Site: `games.ts` entry `tondu-vine-climb` (engine `vine`, host `tondu`), `GameView`, `catalog`.
- **Stages are code + seeds** — no stage data files. Stage n is built from `stageDef(n)` in a few ms (on the main
  thread; it was fast enough that the worker in §11 wasn't needed). The next stage is built while you climb and
  placed where this one ends; the gate hands over without a stop.
- **Fairness** (`node scripts/vine_sweep.mjs 1 600`): the placer keeps the other side clear of every side-forcing
  hazard and two decisions that need different sides at least one reaction window apart; timed gates (buds, bees,
  spiders, tongues, caterpillars) leave room to wait one out; flower pads get their warning thorn a full window
  before; rope swings buffer a LEAP pressed while red and grab when green (inside a 1.5× mark); mirror thorns move to
  Pippi's vine on the other side so the danger stays the same; Kaaki chases slower on stages that make you wait.
  Sweep of all 600 (2026-11-19): the 0.18 s bot clears every stage (the one miss, stage 198 chase + buds, was fixed and
  re-checked), the 0.25 s and 0.40 s bots 598/600; Wild Canopy 601–616 all clear. Per world: W1 3.3 m/s · 166 m · 25
  hazards → W10 4.5 · 251 · 32 → W20 5.8 · 339 · 58 → W30 6.9 · 419 · 75. Bot look-ahead 1.9 s at the sim's own step;
  flips are tried before clinging, clinging only near timed things.
- **Difficulty:** speed 3.2 → 7.2 m/s, reaction window 1.10 → 0.42 s, stage length 150 → 420 m (Long Vine ×2,
  Gold Rush ×0.7, Crown ×1.15), concepts mixing 1 → 3–4, a small sawtooth inside each world.
- **Tondu** (`lizard.ts`): one CPU-skinned loft along a spine that follows the head's trail (so he wraps round the
  vine on flips, bends round curves and arcs through leaps), wedge head with jowls, eye rings with a few dark lines
  behind, ear, saw-tooth crest at the nape, bands and a pale flank stripe, a tail ~2× the body (shortened a little
  from 2.5–3× for the screen), four tapered legs with knee joints and five-toed clawed feet on two-bone IK gripping
  the vine in a diagonal gait, blinking, a head that flushes orange-red in Sun Rush, tail drop and regrowth.
  Scale 2.25 (he reads clearly at phone size); 6 colour morphs (Classic garden, Red-head, Leaf, Sand, Night, Gold).
- **Look:** canopy columns (tree trunks / bamboo clumps / stone) that run past the screen, smooth foliage clusters,
  hanging lianas, world accents (mangoes, flowers, mushrooms, clouds, islands…), foreground leaves, depth fog, god
  rays, pollen and fireflies, rain in storm worlds; warm sun key with soft shadows (medium/high), cool rim, leaf-green
  hemisphere fill; world colours blend into the next world over the last 45 m of a stage.
- **Camera:** follow cam that frames Tondu low with the vine ahead above him, leans with the vine, orbits the spiral
  trunks, moves in for tree holes, pushes in at gates, cranes round at a new world, looks to the guardian, shakes and
  slows time on a tail drop, widens in Sun Rush, holds on a fall; the title slowly orbits Tondu.
- **Controls (changed from §3):** tap anywhere = flip (instant, on press), **CLING pad** (hold) and **LEAP pad**
  (glows near a mark) instead of hold-anywhere / swipe-up, so a flip never waits to see if it's a hold. Keys: Space /
  ↑ / ← / → flip, Shift / ↓ hold to cling, Enter / D leap (the session listens in the capture phase so Space doesn't
  pause the shell).
- **Phase 3:** Wild Canopy 601+ (`wildDef`, fingerprint of world + concepts + guardian, last 400 kept, variants
  re-rolled), weekly Season (8 twists), Daily Vine (`DAILY_BASE` + day, streak coins), Bug Book (30 bugs + golden),
  Sun Seeds, Shop upgrades (Quick Tail, Sun Rush+, Long Snap, Strong Grip, Moss Start), Wardrobe (morphs + hats, live
  3D preview on the title scene), 3 rotating missions.
- **Sound:** `scripts/gen_vine_audio.py` — 30 world tracks + guardian + title, 26 effects (flip, snap pitched with
  the combo, gold, combo, tail, regrow, shield, smash, leap, land, hop, pick, rush, gate bloom, moss, fall, Kaaki's
  caw, falling whistle, thunder, pod pop, burr roll, cling, new-world fanfare, miss, bee buzz, splash), panned by
  side.
- **Art:** `python scripts/build_vine_art.py [card_stage] [hero_stage]` (dev server on :3000; autopilot climbs, HUD
  hidden) → `card.webp`, `hero.webp`, `og.jpg`, and `tondu.webp` (Tondu alone, keyed out).
- **Dev hooks:** `window.__vine` (`setAutopilot(true)`, `sim`, `st`, `r.artCam`), `window.__vineTitle`.
