# Puddo's Clayland — game plan and story

> **v2 is planned:** `docs/PUDDO_RAIN_RAID_PLAN.md` (run-and-gun rebuild: Rain Blaster, bombs, Dust Army, 40 stage
> concepts, 400 stages + Endless Storm). This file describes v1 as built.

> **Telugu lo short ga:** Kotha game — **side-scrolling platformer** (video lo unna laaga, Super Mario type): Puddo
> right ki parigeduthu, jump chestu, enemies ni tappinchukuntu, stage chivara goal ki veltadu. Mana own idea:
> **Kranky** (crab) world motham ni oka pedda beach cheyyalani **Rain Bells** dongilinchadu — varsham ledu, clay
> islands endipotunnayi. Puddo kuda clay — **Squish meter** taggutune untundi (endipotadu), **fruits, water drops**
> tho malli nindutundi (video lo energy meter laaga, kaani mana style). Puddo **clay ball (Splat)** visurutadu — enemy
> clay block ga maaripotundi, daani meeda nilabadochu leda tannochu. **Clay Pots** pagalakodithe friends vastaru:
> **Turbo** rocket shell ride, **Pip** ice slide/swim, **Hoot** glide, **Gloop** wall stick, **Bolt** double jump,
> **Noodle** bridge, **Zib** UFO hover. **Tiki** checkpoint signs pattukuntadu. **20 islands × 15 stages = 300
> designed stages**, prathi island ki own look, music, kotha idea, boss. 300 tarvata **Remix Isles** — unlimited,
> islands mix ayyi, twists tho, repeat feel lekunda; stages perige koladi slow ga tough avutundi. Prathi stage lo
> **"No-hit" medal** (video laaga "not one hit, start to goal").

> Inspiration: classic side-scrolling platformers in general (the attached video shows one). We make our own: the
> MOMOBLOBS hero, world, story, mechanics, art and music. No borrowed names, characters, level layouts, art, music or
> signature items from any existing game — the video's stage is not copied.

**Pitch (one line):** Puddo runs, jumps and splats across 20 drying clay islands and 300 stages to ring the stolen
Rain Bells and make it rain on Clayland again — then the islands remix forever.

**Slug / engine:** `puddo-clayland`, engine `clayland` (`src/clayland/`), a 2.5D three.js side-view platformer.

## 0. What we take from the video — and what we make our own

| In the video | In Puddo's Clayland |
|---|---|
| Run right, jump over gaps and up brick steps | Same core feel, tuned for touch: coyote time, jump buffer, variable jump height |
| An energy meter that drains; fruit refills it | **Squish meter**: Puddo is clay and slowly dries in Kranky's sun; fruit, juice and water drops keep him squishy. Low meter = Puddo gets paler and cracks show |
| A thrown weapon | **Clay Splat**: an arcing clay ball that wraps an enemy in clay — it becomes a block you can stand on for a few seconds, or kick to bowl other enemies |
| Eggs that hide items | **Clay Pots**: crack them to free a friend helper, a splat type, a juice jar… or Kranky's Pinch Pot |
| A ride that speeds you up and takes one hit | **Turbo's rocket shell** (plus six more friend helpers, each with its own move) |
| Numbered checkpoint signs | **Tiki** pops up holding the checkpoint sign and cheers |
| Moving lifts over pits, brick stairs, cave rooms | **Pebble Caves** island (torch-lit caves, stone lifts, crumbly floors) — one of 20 islands |
| Bonfires, birds, rolling rocks | Each island has its own hazards and enemies (§7) |
| "Not one hit, start to goal" | **No-hit medal** on every stage ("Perfect Clay") |

## 1. Story

Clayland is a ring of 20 clay islands. Every island has a **Rain Bell**; each morning the bells ring, a warm rain falls
and everything stays soft, colourful and squishy. **Kranky** — the red crab in a top hat — loves sand more than
anything and wants the whole world to be one giant beach. He steals all 20 Rain Bells and switches on his
**Dry-O-Matic**, a huge sun lamp on top of his castle. The rain stops. The islands start to dry, crack and turn to sand.

**Puddo** wakes up with a crack in his leaf. He grabs his bucket of clay and sets off. **Tiki** flies ahead and holds up
the signs. On each island Puddo frees a friend from Kranky's pots, beats the island's boss (one of Kranky's crew) and
rings the island's Rain Bell — rain pours, the dry brown island turns green and colourful again (the big payoff
moment of every island).

- **Act 1 (islands 1–7):** "The Dry Spell" — Puddo learns what Kranky did and frees the first friends.
- **Act 2 (islands 8–14):** "Kranky's Crew" — wind, night, heat and factories; Kranky sends bigger bosses.
- **Act 3 (islands 15–20):** "The Dry Castle" — the road to the Dry-O-Matic.
- **Stage 300 — The Last Rain Bell:** Puddo rings it; a rainbow storm washes over every island; Kranky gets soaked,
  sulks… and then builds a sandcastle in the rain with everyone.
- **After 300 — Remix Isles:** the rain makes new islands grow every day (§5).

Short comic cards between islands (3–4 panels, skippable), Kranky's taunts before bosses, Tiki's cheers.

## 2. Puddo and the controls

**Puddo** (the hero made for this game — not Momo): a little sprite of rain-soaked riverbank clay. A soft terracotta
bean (`#D9824A`) with a cream belly patch, big glossy eyes, rosy cheeks, small clay brows and fingerprint dents — he's
hand-made. On his head sits a **broad leaf that catches the rain** (a raindrop rests on it); on his back a **clay
bucket full of fresh clay** on a strap — that's where his Splats come from. Stubby feet with toe bumps, mitten arms.
Wet clay is glossy; as the Squish meter runs low he pales and dulls. His voice: three short clay-squelch sounds
(`sfx_clay_puddo_happy/wow/sad`). Model: `puddoRig()` in `src/clayland/models.ts` (face parts sit on the body's
surface); portrait art: `public/games/puddo-clayland/puddo.webp`. Momo can still visit as a paid guest in the wardrobe.

Squash and stretch on every jump and landing, dust puffs, a "phew" when the meter is refilled, cracks and a pale tint
when it runs low.

Puddo's moves:
- **Run and jump** — hold to jump higher; a little hang time at the top; coyote time (0.1 s) and a jump buffer (0.12 s)
  so jumps never feel eaten.
- **Clay Splat** — throw a clay ball in an arc. A hit wraps the enemy in clay: a **clay block** for 4 s (stand on it,
  or kick it to send it sliding and knock over other enemies). Some enemies need two splats; bosses need splats on
  their weak spot.
- **Squish Stomp** — press down in the air: Puddo slams down, flattens springy enemies, breaks cracked floors and
  bounces high off boing pads.
- **Squeeze** — hold down on the ground: Puddo flattens to slip under low gaps and rolling hazards.

**Phone (landscape recommended, portrait works):** left thumb: **◀ ▶ with ▲ above them** (one touch surface: slide
between arrows; the spot between ▲ and ◀/▶ presses both, so a running jump needs one thumb; ▲ = jump, hold for higher,
and it climbs vines). Right thumb: **▼** (stomp / squeeze) and a big **SPLAT**. There is no separate JUMP button (the
owner asked for ▲ instead, 2026-11-18). **Easy Run** setting: Puddo runs on his own (▶ hides), ▲ jumps. In portrait
the camera zooms out and the buttons sit at the bottom.
**Keyboard:** arrows/WASD (↑ jumps too, and climbs vines), Space or Z = jump, X or J = splat, ↓ = stomp/squeeze, Esc/P = pause. Gamepad supported.

## 3. The 20 islands (15 stages each = 300 stages)

Each island brings one new idea, its own look, music, enemies and a boss. Stage 15 of each island is the boss.

| # | Island | New idea | Friend freed | Look / weather | Boss (holds a Rain Bell) |
|---|--------|----------|--------------|----------------|--------------------------|
| 1 | **Sprout Shore** | run, jump, splat, Squish meter, Clay Pots, Tiki checkpoints | — | sunny beach morning | Captain Clack (hermit crab in a teapot) |
| 2 | **Fruitpop Grove** | clay blocks as platforms, rolling coconuts, first ride | **Turbo** — rocket shell (fast, takes one hit) | bright orchard | Big Bonk the coconut crab |
| 3 | **Pebble Caves** | stone lifts over pits, crumbly floors, Squish Stomp, bonfires, drips | — | torch-lit caves | Mole Major |
| 4 | **Bubble Lagoon** | swimming, currents, air bubbles refill the meter | **Pip** — belly slide on ice and water | turquoise shallows | Puffer Pete |
| 5 | **Windy Kite Cliffs** | wind gusts push Puddo, cloud ledges | **Hoot** — glide down slowly | breezy afternoon | Gale Gull |
| 6 | **Sugarcrumb Hills** | sticky caramel slows, marshmallow bounces, melting candy steps | — | pastel candy land | Gummy Grump |
| 7 | **Toybox Town** | springs, ribbon conveyors, ON/OFF switch blocks | **Bolt** — spring boots (double jump) | toy-room lamp light | Jack-in-the-Crab |
| 8 | **Mushroom Mire** | bouncy caps, poison puddles, fog | **Gloop** — stick to walls, wall jump | misty dusk | Spore Lord |
| 9 | **Frostbite Peaks** | slippery ice, icicles, snowball rollers | (Pip returns) | snowfall | Walrus Wally |
| 10 | **Dusty Dunes** | sun heat (meter drains 2× outside shade), quicksand, sand geysers | — | blazing noon | Sandy Scorpion |
| 11 | **Lantern Woods** | darkness: lanterns and fireflies light the way, spiders drop | — | moonlit night | Moth Mama |
| 12 | **Gearworks Factory** | crushers, pistons, timed laser fences, magnets | (Bolt returns) | factory glow | Mecha Pinch |
| 13 | **Vine Temple Ruins** | swinging rope platforms, arrow walls, rolling stones | **Noodle** — stretches into a bridge over one gap | jungle haze | Stone Guardian |
| 14 | **Cloud Castle Gardens** | clouds that puff away, beanstalk climbs, rain clouds refill the meter | **Zib** — UFO hover with a little fuel | blue sky | Nimbus Knight |
| 15 | **Neon Night City** | rooftops, platforms that blink to the music's beat | — | neon night | DJ Lobster |
| 16 | **Volcano Vents** | lava, geysers, falling rocks, **Hot Splat** (melts ice, lights fuses) | — | smoky red sky | Magma Crab |
| 17 | **Crystal Mines** | light beams and mirrors open doors, crystal lifts | — | glittering dark | Crystal Clam Queen |
| 18 | **Pirate Storm Sea** | rocking ship decks, cannons, storm rain (meter drains slower) | — | thunderstorm | Admiral Snap |
| 19 | **Moon Base Isle** | low gravity, meteor showers, airlocks | (Zib returns) | starry space | Robo Lobster |
| 20 | **Kranky's Dry Castle** | every idea mixed, the Dry-O-Matic beam chases Puddo | all friends | blazing sunset | **Kranky** in the Dry-O-Matic |

### The 300 stages

Inside every island: stages 1–4 teach and build the island's idea, **stage 5 is a friend stage** (a long ride or a
bonus sky run), 6–9 mix it with older ideas, **stage 10 is a chase** (something follows Puddo — the Dry-O-Matic
beam, a boulder, a wave, a crab tank), 11–14 are the island's hardest stages, 15 is the boss.

1. **Sprout Shore:** Sprout Beach, Sandcastle Steps, Tide Pool Path, Coconut Cove, Shell Hill, Driftwood Docks, Seagull Rocks, Palm Hop, Clay Pot Bay, Wave Break, Crabwalk Coast, Lighthouse Lane, Sunny Sandbar, Pinch Point, Captain Clack's Cove.
2. **Fruitpop Grove:** Orchard Gate, Apple Ladder, Berry Bramble, Plum Path, Turbo's Garage, Melon Meadow, Cherry Hills, Peach Pond, Grape Vine Bridge, Rolling Coconut Road, Juice Falls, Fig Tree Fort, Lemon Lane, Harvest Ridge, Big Bonk's Orchard.
3. **Pebble Caves:** Cave Mouth, Torch Tunnel, Drip Drop Hall, Stone Lift Shaft, Glowworm Gallery, Bonfire Bend, Bat Belfry, Crumbly Floor, Pebble Slide, Boulder Run, Echo Steps, Underground Spring, Brick Maze, Deep Lift Ride, Mole Major's Den.
4. **Bubble Lagoon:** Lagoon Shallows, Bubble Reef, Kelp Curtain, Clam Garden, Pip's Pier, Current Cove, Jelly Drift, Sunken Boat, Coral Arches, Tide Rush, Turtle Rock, Whirlpool Way, Seahorse Stables, Pearl Grotto, Puffer Pete's Reef.
5. **Windy Kite Cliffs:** Breezy Ledge, Kite Hill, Gust Gap, Pinwheel Path, Hoot's Lookout, Feather Falls, Cliffside Stairs, Updraft Canyon, Windmill Rise, Tailwind Dash, Cloud Shelf, Sky Rope Bridge, Storm Gust, Eagle Rocks, Gale Gull's Nest.
6. **Sugarcrumb Hills:** Candy Gate, Gumdrop Garden, Caramel Creek, Marshmallow Bounce, Sprinkle Slopes, Lollipop Lane, Cookie Crumble Cliffs, Jelly Jiggle, Choco River, Sugar Rush, Taffy Twist, Cupcake Castle, Licorice Ladders, Frosting Falls, Gummy Grump's Bakery.
7. **Toybox Town:** Toy Shelf, Block Tower, Wind-Up Walk, Spring Street, Bolt's Workshop, Switch Block Square, Ribbon Belts, Marble Run, Puzzle Box, Domino Drop, Teddy Trampolines, Rocket Ride, Train Track Tricks, Clockwork Climb, Jack-in-the-Crab's Box.
8. **Mushroom Mire:** Mire Entrance, Bouncecap Bridge, Fog Hollow, Poison Puddle Path, Gloop's Swamp, Spore Cloud Steps, Toadstool Towers, Sticky Root Walls, Glowshroom Grotto, Rising Mud Chase, Lily Log Leap, Fungus Fair, Moss Ladders, Mire Maze, Spore Lord's Ring.
9. **Frostbite Peaks:** Frosty Gate, Slippy Slopes, Icicle Alley, Snowball Hill, Pip's Ice Rink, Frozen Falls, Igloo Hop, Blizzard Bridge, Glacier Crack, Avalanche Alley, Snow Cloud Steps, Crystal Ice Cave, Hot Cocoa Hut, Summit Climb, Walrus Wally's Peak.
10. **Dusty Dunes:** Dune Gate, Cactus Corner, Shady Palm Stop, Mirage Mile, Oasis Hop, Quicksand Pit, Sand Geyser Gulch, Tumbleweed Trail, Pyramid Steps, Sandstorm Chase, Sunbaked Canyon, Scarab Run, Camel Bridge, Heatwave Highway, Sandy Scorpion's Tomb.
11. **Lantern Woods:** Lantern Gate, Firefly Path, Moonlit Glade, Owl Hollow, Paper Lantern Bridge, Spider Drop, Shadow Steps, Glowing Pond, Midnight Market, Moth Swarm Chase, Hollow Tree Climb, Star Lantern Hill, Whisper Woods, Dawn Run, Moth Mama's Lamp.
12. **Gearworks Factory:** Factory Gate, Conveyor Corridor, Crusher Hall, Piston Pass, Bolt's Boiler Room, Laser Lattice, Steam Pipes, Assembly Line, Magnet Bay, Press Line Chase, Cog Climb, Oil Slick Slide, Spark Tunnel, Furnace Floor, Mecha Pinch's Plant.
13. **Vine Temple Ruins:** Temple Steps, Rope Swing Hall, Arrow Wall Way, Moss Pillars, Noodle's Gap, Idol Room, Crumbling Bridge, Snake Statue Steps, Hidden Chamber, Rolling Stone Run, Spike Floor Dance, Golden Doors, Trap Corridor, Sunbeam Shrine, Stone Guardian's Hall.
14. **Cloud Castle Gardens:** Cloud Gate, Puffy Path, Beanstalk Climb, Raincloud Ride, Zib's Landing, Rainbow Bridge, Sky Fountain, Cloud Hedge Maze, Sunbeam Stairs, Thunder Chase, Balloon Garden, Floating Isles, Feather Fields, Castle Ramparts, Nimbus Knight's Tower.
15. **Neon Night City:** Neon Gate, Rooftop Run, Billboard Bounce, Beat Blocks, Taxi Tops, Subway Steam, Crane Climb, Laser Show, Fire Escape, Midnight Express, Arcade Alley, Bass Drop Bridge, Glow Sign Steps, Skyline Sprint, DJ Lobster's Club.
16. **Volcano Vents:** Ember Gate, Ash Trail, Lava Stepping Stones, Geyser Jumps, Hot Splat Hollow, Magma Lifts, Obsidian Steps, Smoke Stacks, Fire Flower Field, Eruption Run, Rock Rain, Lava Fall Bridge, Crater Rim, Cinder Climb, Magma Crab's Crater.
17. **Crystal Mines:** Mine Gate, Gem Lift, Mirror Hall, Light Beam Bridge, Shimmer Shaft, Prism Puzzle, Crystal Bats, Quartz Quake, Ruby Ropeway, Collapse Chase, Sapphire Springs, Diamond Drop, Echo Crystals, Deep Vein, Crystal Clam Queen's Throne.
18. **Pirate Storm Sea:** Harbor Gate, Plank Walk, Rocking Deck, Cannon Cove, Crow's Nest Climb, Rope Rigging, Barrel Bounce, Anchor Drop, Treasure Island, Tidal Wave Chase, Shark Fin Shallows, Lightning Mast, Stormy Waves, Whirlpool Wreck, Admiral Snap's Flagship.
19. **Moon Base Isle:** Launch Pad, Low-G Leaps, Crater Hop, Moon Rover Road, Zib's Hangar, Star Dust Steps, Antenna Array, Orbit Ring, Space Garden, Meteor Shower Chase, Comet Tail, Airlock Run, UFO Parking Lot, Black Sky Bridge, Robo Lobster's Station.
20. **Kranky's Dry Castle:** Castle Moat, Dry Drawbridge, Sun Lamp Hall, Pinch Patrol, Sand Clock Tower, Trap Kitchen, Cracked Courtyard, Crab Cannon Wall, Hall of Mirrors, Dry-O-Matic Chase, Throne Stairs, Rain Bell Vault, Last Lift, Rooftop Rumble, **The Last Rain Bell** (stage 300, Kranky).

## 4. A stage

- **Length:** about 60–80 s at the start, growing to 120–150 s by the late islands.
- **Four parts**, each ending at a **Tiki checkpoint** (2 checkpoints early, 3–4 later):
  1. **Teach** — the stage's main idea in a safe spot (a pit-free gap first, a slow enemy first).
  2. **Test** — the same idea with a real consequence.
  3. **Twist** — the idea mixed with one or two older ones, or a friend helper section.
  4. **Finale** — a sprint to the **Splash Gong**: jump into it; the higher the hit, the more coins.
- **Collect:** fruit and water drops (meter), coins, **3 Rain Drops** hidden in each stage (secret rooms behind
  cracked walls, hidden pots, a cloud reached by a hidden spring).
- **Medals:** finish · all 3 Rain Drops · **No-hit** (Perfect Clay — finish without a single hit).
- **Rhythm:** every stage alternates tension and rest (a hard jump section is followed by a calm fruit run); no blind
  jumps (the landing is always on screen); a new hazard is always shown safely first.

## 5. 300 designed stages — and then forever

**How the 300 are made (designed, the same for every player):**
- A **chunk library** of about 500 hand-made pieces (12–40 tiles wide), tagged by island, mechanic, difficulty
  (1–10), entry/exit height, length and intensity (rest / tension).
- A **stage table** (300 rows): island, stage type (teach / mix / friend / chase / gauntlet / boss), length, target
  difficulty, featured idea, enemy and hazard set, pot plan, secrets, time of day / weather, music.
- An **assembler** builds each stage from its row: picks chunks that fit the rhythm and difficulty, sets gap widths,
  enemy speeds and lift timings, places fruit so the meter always has spare (at least 25% with good play), places
  pots, Rain Drops and checkpoints.
- A **checker bot** plays every stage with the real physics: every jump reachable with margin, the meter survivable,
  no unavoidable hit, no blind leap, every Rain Drop reachable. Stages that fail are rebuilt.
- **Freshness:** neighbouring stages never share their main chunks; a chunk appears at most a few times in all 300
  and never twice within 5 stages; each stage gets a "fingerprint" and stages too similar to recent ones are rebuilt.
- The finished 300 are fixed (seeded), so stage 57 is always the same stage — they can be reviewed and tuned.

**After stage 300 — Remix Isles (unlimited):**
- Every remix stage blends two islands (the look and music of one, the enemies and hazards of another) and adds a
  twist: night, wind, storm rain, low gravity, heat, fog, mirror, double fruit, beat platforms, a chase.
- Generated names ("Frosty Candy Caves", "Neon Lagoon Rush"), chunks mutated (flipped, stretched, re-skinned, enemies
  swapped) and checked by the same bot.
- A **freshness memory** saved on the device keeps recently seen chunks, twists and fingerprints out, so it never
  feels repeated. Every 15th remix stage is a **remix boss** (two boss patterns combined).
- **Daily Island** (the same remix island for everyone that day) and a daily **No-hit challenge**.

## 6. Difficulty — gentle start, slow climb

- **Stages 1–5:** no bottomless pits, slow enemies, a generous meter, wide platforms. The first ten stages should
  feel easy and fun.
- Difficulty rises in **waves**: up inside each island, a small step back at the start of the next island (each
  island starts a bit easier than the previous one ended), a breather stage after each boss.
- What ramps (stage 1 → 150 → 300 → Remix cap):

| Knob | Stage 1 | Stage 150 | Stage 300 | Remix cap |
|---|---|---|---|---|
| Full meter lasts | 60 s | 45 s | 36 s | 32 s |
| Widest gap (tiles; Puddo can jump 6.5) | 2 | 4.5 | 5.5 | 6 |
| Gaps that are pits | 0% | 40% | 60% | 65% |
| Enemies per screen | 0.5 | 2 | 3 | 3.5 |
| Enemy speed | 60% | 95% | 115% | 125% |
| Shortest reaction window | 1.0 s | 0.65 s | 0.5 s | 0.45 s |
| Hazards combined at once | 1 | 2 | 3 | 3 |
| Vanishing platform time | 2.0 s | 1.3 s | 1.0 s | 0.9 s |

- The checker bot plays every stage at three skill levels; stages are tuned so a casual player clears early islands
  first try and later islands in a few tries.

## 7. Hearts, hazards and enemies

- **Hearts:** start with 3. A hit costs one heart (Puddo blinks, safe for 1.5 s). An empty meter costs one heart and
  refills the meter to half. No hearts left → back to the last Tiki checkpoint with full hearts (no game-over
  screens, no lives counter). Heart fruit in secrets and hard spots; the heart limit grows 3 → 4 (island 5) → 5
  (island 12).
- **Hazards (by island):** pits, spikes, bonfires, drips, crumbly floors, falling rocks, currents, wind, sticky
  caramel, switch blocks, poison puddles, ice, icicles, quicksand, heat, darkness, crushers, lasers, arrow walls,
  rolling stones, lava, geysers, light beams, cannons, meteors, the Dry-O-Matic beam.
- **Enemies:** Kranky's **Pinchers** (crab guards on every island) plus island locals — beach snails, coconut crabs,
  cave bats, puffer fish, gulls, gumdrop hoppers, wind-up mice, mushroom puffers, snowball penguins, scorpions, moths,
  sentry bots, stone heads, thunder ducks, neon drones, magma blobs, crystal bats, pirate gulls, moon rovers. Each has
  one clear pattern; later islands combine patterns, never invent unfair ones.

## 8. Clay Pots and power-ups

Pots sit in the open or hide (jump at the right spot to reveal one). Crack one with a stomp or a splat:

- **Splats:** Clay Splat (default) · **Rubber Splat** (bounces along the ground) · **Hot Splat** (fast, melts ice,
  lights fuses; from island 16).
- **Friend helpers** (one at a time, each takes one hit before leaving):
  - **Turbo** — rocket shell: fast, smashes small enemies.
  - **Pip** — belly slide on ice and water.
  - **Hoot** — glide.
  - **Bolt** — spring boots, double jump.
  - **Gloop** — stick to walls, wall jump.
  - **Noodle** — stretches into a bridge over one gap.
  - **Zib** — UFO hover with a little fuel; its beam lifts clay blocks.
- **Juice Jar** (full meter) · **Heart Fruit** · **Golden Sprout** (8 s of invincibility, its own music).
- **Kranky's Pinch Pot** (the bad one): a little crab clamps onto Puddo's leaf and the meter drains fast until Puddo
  shakes it off with three stomps. Funny, never deadly on its own.

## 9. Around the game

- **Island map:** the 20 islands in a ring; Puddo sails between them on a clay boat. Progress is saved on the device;
  **Continue** goes straight to the next stage; cleared stages can be replayed for Rain Drops and No-hit medals.
- **Coins** go to the site's coins (the coin pill) and buy hats and trails for Puddo (shared wardrobe style with
  Brigade/Boing).
- **Bonbon's Snack Stop** after every boss: spend coins on a starting helper or an extra heart for the next stage.
- **Playable friends** unlocked later (same moves, their own jump feel and voice): Pip, Gloop, Zib.
- Stats per island: Rain Drops found, No-hit medals, best times.

## 10. Look, sound and feel

- **2.5D clay diorama:** side view with a gentle perspective, layered parallax (near leaves, the island, far islands
  and sky), soft blob shadows, squash and stretch, dust puffs, clay splat particles. A dry island looks pale and
  cracked; ringing its Rain Bell turns it lush and colourful in a rain shower.
- **Every island has its own palette and music genre:** beach ukulele, orchard folk, cave marimba echoes, lagoon steel
  drums, windy flutes, candy pop, toybox music box, swampy banjo, icy bells, desert strings, night lullaby, factory
  funk, temple drums, sky harp, neon synthwave, volcano taiko, crystal chimes, sea shanty, space synth, castle
  orchestra. Each has a calm (map/menu) and an action (stage) track, plus boss, chase, ride and invincible tracks.
- **Sounds:** springy jump, splat, squish stomp, pot crack, fruit chomp, water slurp, a drippy low-meter warning, Tiki
  cheer at checkpoints, the gong at the goal, a rain shower at every bell. Short funny voice lines for Puddo and Kranky.
- **Copy:** neutral "About game" text; never "no ads", never "for kids".

## 11. Technical plan (follows AGENTS.md / docs/AGENT_PROMPT.md)

- **Engine** `src/clayland/`: fixed-step physics at 120 Hz (tile grid, slopes, one-way platforms, moving platforms
  that carry Puddo), a camera with look-ahead and a vertical dead zone, three.js rendering with instanced clay tiles per
  material and only ~3 screens of the stage built at a time.
- **Site budget:** only the game page `/games/puddo-clayland` (7 site files); played on `/play?g=puddo-clayland`.
- **Files on R2:** art in `public/games/puddo-clayland/`, audio family `clay` (`sfx_clay_*`, `music_clay_*`,
  `voice_*`), generated by `scripts/gen_clay_audio.py`; art by `scripts/build_clay_art.py`.
- **Loading:** the map screen preloads the next stage's sounds; `audio.prepareMusic()` for the next island's track;
  `audio.warmMusic()` for boss, chase, ride and invincible tracks; `soundFamily` entry `clayland: "clay"`.
- **No stalls:** the next stage is assembled and checked in a **Web Worker** while the current one plays; tiles and
  enemies are pooled; `FrameGovernor` on the renderer; a portrait and a landscape camera.
- **Tuning:** `scripts/clay_sweep.mjs` (the checker bot at three skill levels over stage ranges, like
  `brigade_sweep.mjs`), headless QA at 390×844 and desktop with `--mute-audio`.

## 12. Build plan

1. **Phase 1 — the core (islands 1–4, stages 1–60):**
   - engine, physics and controls (touch, keys, pad), Puddo's rig and moves;
   - Squish meter, Clay Pots, Tiki checkpoints, Splash Gong, hearts;
   - Turbo and Pip helpers;
   - island map and save;
   - chunk library and assembler for these islands, plus the checker bot;
   - bosses 1–4;
   - art and music for these islands.
2. **Phase 2 — islands 5–12 (stages 61–180):** wind, candy, switch blocks, mushrooms, ice, heat, darkness, the
   factory; Hoot, Bolt and Gloop; Rubber Splat; bosses 5–12; Bonbon's Snack Stop.
3. **Phase 3 — islands 13–20 (stages 181–300):** temple, clouds, neon beat platforms, lava, mirrors, the pirate ship,
   low gravity, Kranky's castle; Noodle and Zib; Hot Splat; bosses 13–20 and the ending.
4. **Phase 4 — forever:** Remix Isles, Daily Island and No-hit challenge, wardrobe, playable friends.

Each phase ships playable and tested (bot sweeps + phone screenshots) before the next starts.

## 13. Decisions for the owner

- **Name:** "Puddo's Clayland" (slug `puddo-clayland`) — or another name you like.
- **Progress:** saved on the device with an island map and Continue (recommended for a 300-stage platformer), instead
  of restarting from stage 1 like Puddo Dash.
- **Screen:** landscape recommended on phones (portrait still works with a zoomed-out camera).

## 14. Built — Phases 1–3 and Remix Isles (2026-11-18)

Everything in §1–§11 is live in one go: all 20 islands, 300 stages, bosses, friends, the ending and Remix Isles.

- **Code** (`src/clayland/`):
  - `types.ts`, `islands.ts` (the 20 islands, 300 stage names, palettes, stories), `physics.ts` (Puddo's numbers and
    `reach()`), `bestiary.ts` (36 enemies, 20 bosses).
  - `stages.ts` builds any stage from its number: about 45 kinds of *parametric* pieces (gaps, floating steps, brick
    rows, lifts, crumble bridges, pools, wind gaps, switch gates, crushers, swings, vines, lava stones, cannons…)
    instead of 500 hand-drawn chunks. Every gap is sized from `reach()` with a 20% margin; each stage hides 3 Rain
    Drops; seeded, so stage 57 is always the same.
  - `sim.ts` (fixed 120 Hz), `bot.ts` (autopilot for the title demo and the sweep), `render.ts` (2.5D clay diorama),
    `session.ts`, `save.ts`, `ui/ClaylandApp.tsx`.
- **Remix Isles** (301+): the look island, the hazard island and the twist rotate on cycles of 20, 20 and 9, so
  neighbouring remix stages never share an island and a blend + twist repeats only after 180 stages. Difficulty
  sits at 0.86–1.08 in waves.
- **Sound**: `scripts/gen_clay_audio.py` → 25 tracks (20 island genres + map, boss, chase, bonus, Golden Sprout)
  and 42 effects (`sfx_clay_*`); loop lengths are in `MUSIC_META` in `src/lib/audio.ts`.
- **Art**: `scripts/build_clay_art.py` (dev server on :3000) → `card.webp`, `hero.webp`, `og.jpg`.
- **QA**:
  - `node scripts/clay_sweep.mjs [from] [to]`: the autopilot plays every stage. It clears 231 of 330 (stages 1–300
    plus 30 remix). It's a decent player, not a perfect one: it can't double-jump, wall-jump, glide or hover, so
    friend stages (3/10) and chases (9/20) are lower.
  - `node scripts/clay_ascii.mjs <n>` prints a stage as text, with where the bot got stuck.
  - Headless screenshots of every island, the boss arenas and the menus on 1280×720, 844×390 and 390×844.
- **Hosting rule**: the game page uses 7 site files; all sounds and art are game files for R2 (`npm run upload:r2`).

## 15. Built — Phase 4 and the new hero (2026-11-18)

- **Puddo** replaces Momo as the hero; the game is **Puddo's Clayland** (`/play?g=puddo-clayland`). Old saves move
  to Puddo (Momo stays theirs if they bought him). Save store `momoblobs-clayland` is now version 3.
- **Up arrow** jumps (and still climbs vines). On phones the JUMP button is gone: **▲ sits above ◀ ▶** (`ArrowPad` in
  `ui/ClaylandApp.tsx`, one touch surface with a ▲+▶ diagonal); the right thumb has ▼ and SPLAT.
- **Daily Island**: one stage a day, the same for everyone (stage number `DAILY_BASE` + UTC day, a remix blend at
  difficulty 0.42–0.58, 4 hearts). First clear pays 50 + 10 × streak (max +100); a no-hit clear adds +100 once a
  day. Streak and best streak show on the title. Daily runs don't touch island progress.
- **Wardrobe** (title → STYLE), paid with the site's coins: characters (Puddo free; Pip 400, Gloop 600, Zib 800 —
  each after you free them on their island; Momo the guest 1000), 10 hats (150–1000) and 7 trails (200–600). Pip,
  Gloop and Zib bring their own power as the hero. Tap a locked or unaffordable item to try it on. 3D preview with
  drag-to-turn (`src/clayland/wardrobe.ts`).
- **Bonbon's Snack Stop** on the boss clear card: +1 heart for the next stage (40 coins) or start the next stage with
  a freed friend (60 coins).
- **Island stats** on the island screen: stages cleared, Rain Drops x/42, no-hit stars, total clear time.
- Shared hats (`hatGeo`) are modelled at y≈1.5; Clayland drops them by `HAT_BASE × scale` so they sit on the head.
- Short landscape phones (height ≤ 520px): the title puts PLAY and MAP/DAILY/STYLE in one row and the clear card
  goes two-column.
- **QA**: headless run (`--mute-audio`) on 1280×800, 844×390 and 390×844: wardrobe buy and try-on, Daily (Up-arrow
  jump, reward, streak), Snack Stop (stage 16 starts with 4 hearts), no console errors. `build:static` passes.
