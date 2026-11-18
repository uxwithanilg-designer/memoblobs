# Puddo's Clayland v2 — "Rain Raid": the run-and-gun rebuild (plan)

> **Telugu lo short ga:** Game concept motham marustunnam. Ippudu Puddo daggara **Rain Blaster** untundi (X key /
> phone lo **FIRE** button — hold chesthe auto-fire): rain pellets shoot chestadu. **Storm Bombs** kuda (C key /
> **BOMB** button) — pedda blast, shields and walls break chestayi. Kranky ippudu **Dust Engine** tho varsham motham
> taagesi, endipoyina matti tho **Dust Army** (Dusties) ni tayaru chesadu — 60 rakala enemies, chala ekkuva sankhya
> lo vastaru. Prathi stage oka **concept** (40 concepts: tower climb, mine cart, train top, glider shooter, rescue,
> bomb squad, defend the well, escape, boss…) — prathi stage design, goal, look veru. **20 zones × 20 stages = 400
> stages**, prathi stage 2–3 retlu peddadi (3–6 minutes). Stage 10 = general machine (mini-boss), stage 20 = zone
> boss. 5 acts story. Enemies champithe **coins** padathayi (combo tho ekkuva) — **Blaster Shop** lo upgrades
> konochu. Game **tough** ga untundi (zone 3 nunchi). 400 tarvata **Endless Storm**: looks, armies, concepts and 16
> mutators mix avuthayi, history save chesi repeat avvakunda chustundi. Build: Phase A → B → C → D.

**Pitch (one line):** Puddo blasts Kranky's Dust Army back into mud with his Rain Blaster and Storm Bombs — running,
climbing, riding carts, rafts, trains and gliders through 20 zones and 400 stages to take back the Rain Bells — then
the Endless Storm mixes everything, forever.

**Name / slug:** keeps **Puddo's Clayland** (`puddo-clayland`, engine `clayland`), with the subtitle **Rain Raid**
on the logo. Inspiration: the run-and-gun platformer genre in general; every name, character, stage, art and sound
is our own — no layouts, characters or signature items from any existing game.

---

## 0. Why we rebuild (the playtest)

The owner's playtest of v1 (300 stages):

| What the owner felt | Why it happens in v1 | What v2 does |
|---|---|---|
| "All stages feel the same" | Every stage is one flat lane 20 tiles tall, built by the same loop (basic piece → feature piece → rest → checkpoint); one island = one look for 15 stages; the only goal is "reach the gong". | A stage is built from a **concept** (layout + goal + set piece), the look changes every 5 stages (districts) and with time of day and weather, stages can be tall, and goals change (destroy, defend, rescue, escape, ride…). |
| "Too easy, too few enemies" | 1–3 enemies per group every 9–26 tiles; Splat wraps enemies, nothing really fights back. | The Dust Army: 60 types, waves, ambush gates, turrets, snipers, spawners; 3–20 on screen; enemy shots with patterns. |
| "Puddo should shoot" | Only the arcing Clay Splat. | **Rain Blaster** (hold to auto-fire, 6 weapon pickups) + **Storm Bombs** + a **Super Rain**. |
| "Stages should be bigger" | 120–330 tiles, 1–2 minutes. | 350–900 tiles wide or up to 160 tall, 3–6 minutes, 5–8 rooms each. |
| "400+ stages, then loop without repeat feel" | 300 + Remix Isles (rotations only). | 400 designed + the **Endless Storm** with mutators and a saved no-repeat history. |
| "More coins" | Coin rows only. | Enemies drop coins, combos multiply, end-of-stage tally; coins buy Blaster upgrades. |

---

## 1. Story — "Rain Raid"

**Prologue (comic, 4 panels):** Kranky the crab stole the 20 Rain Bells — and that was only the start. Deep in his
castle he built the **Dust Engine**, a machine that drinks the rain out of the sky. From the dry dust it bakes the
**Dust Army**: grey, cracked clay soldiers called **Dusties**. Wherever they march, the land splits and dries.
Under Sprout Shore, in the old Rain Temple, Puddo finds the **Rain Blaster** — his clay bucket turned into a cannon
that fires rain pellets. One good soak and a Dustie softens back into wet clay, flops into a puddle and pops out
coins. Packed thunderclouds in clay pots — **Storm Bombs** — do the rest.

No gore anywhere: Dusties **melt to mud** (a splash, a puddle, coins), machines **crack and fizzle**.

**Five acts, four generals, one engine.** Each act has a general who fights Puddo at **stage 10** of every zone in
that act, each time in a different war machine; the zone's own boss guards the Rain Bell at **stage 20**.

| Act | Zones | General | What happens |
|---|---|---|---|
| 1 · The Dry Coast | 1–4 | **Sergeant Grit** — a sandpaper armadillo-bot | Puddo finds the Blaster, frees the coast, learns Kranky's plan. Grit escapes with a stolen tank of rain. |
| 2 · Dust Rising | 5–8 | **Major Rasp** — a file-armed beetle in a walker | The army grows; Puddo rescues the Rain Squad (Turbo, Pip, Hoot, Bolt, Gloop, Noodle, Zib) from Dust camps. |
| 3 · The Great Drought | 9–12 | **Colonel Clinker** — a furnace-bellied robot | The Dust factories: Puddo shuts them down one by one. Clinker's forge explodes and lights up Kranky's sky road. |
| 4 · Storm Front | 13–16 | **Admiral Static** — a storm ray on an airship | Static steals lightning to power the Engine; Puddo turns the storm back on him. |
| 5 · Dust Fortress | 17–20 | Kranky's own machines | Through the mines, the sea, the moon base, into the castle: a rematch with all four generals, then **Kranky + the Dust Engine** (3 phases). |

**Ending (stage 400):** the Engine bursts, every stolen raindrop falls at once — a rainbow storm over Clayland.
Kranky, soaked, finally laughs. **But** the Engine's last sparks blew far away, and somewhere new Dusties keep
baking: the **Endless Storm** opens (401+).

Comic cards: one at the start of each act (5), a two-panel card when a general is beaten (20), and the ending.

---

## 2. Controls

| Action | Keyboard | Phone |
|---|---|---|
| Run | ← → / A D | ◀ ▶ |
| Jump (hold = higher) | ↑ / W / Space | ▲ (above ◀ ▶, already built) |
| **Fire the Rain Blaster** (hold = auto-fire) | **X** or **J** | **FIRE** (big, right thumb; hold) |
| **Storm Bomb** | **C** or **K** | **BOMB** (with the count on it) |
| Super Rain (when the Storm meter is full) | **V** or **L** | **SUPER** (appears over FIRE) |
| Crouch on the ground · stomp in the air | ↓ / S | ▼ |
| Pause | P / Esc | ⏸ |

- Shots fly straight the way Puddo faces. **Aim assist** bends a shot up to 35° toward the nearest enemy in front, so
  flyers and ledge snipers can be hit without an aim stick (on phone and keyboard alike).
- ↓ + fire on the ground = low shot under shields; ↓ + fire in the air = shoot straight down (deep-dive stages).
- Phone layout: left thumb ◀ ▲ ▶; right thumb FIRE (biggest), BOMB above-left of it, ▼ small beside.

---

## 3. Weapons

**Rain Blaster — Drizzle** (always): 6 shots/s, 1 damage, 14 tiles range.

**Weapon pickups** (from crates and elite Dusties; kept until Puddo gets hit — then back to Drizzle):

| Pickup | What it does | Best against |
|---|---|---|
| **Sprinkler** | 3-way spread | swarms, flyers |
| **Downpour** | 12 shots/s | heavies, bosses |
| **Hailstone** | pierces, 2 damage | lines of Dusties, shields from the side |
| **Thunder** | each hit chains to 3 nearby | packs |
| **Rainbow** | homing pellets | snipers, turrets out of reach |
| **Geyser** | short-range burst, 4 damage | close rushes, armored |

**Storm Bombs:** start with 3, carry 5 (shop: up to 9). Thrown in an arc, a 3-tile thunder-splash for 6 damage;
breaks cracked walls, shields, Dust Pumps and spawner hives. Crates drop +1.

**Storm meter** (replaces v1's draining Squish meter): fills with every melt, faster with combos. Full → **Super
Rain**: 3 seconds of downpour that hits everything on screen.

**Blaster Shop** (site coins, permanent): Fire rate ×5, Damage ×5, Bomb bag 5→9, Max hearts 3→6, Coin magnet ×3,
Starting pickup (choose one), Squad Call (call a freed friend once per stage). Prices from 300 to 5,000 coins.

---

## 4. The Dust Army — 60 enemy types

Every type has a clear look, a tell before it attacks (0.35–0.5 s flash or wind-up) and a counter.

| Family | Types (examples) | Counter |
|---|---|---|
| Grunts | Dustie (walks, shoots), Dust Runner (charges), Dust Hopper | Drizzle |
| Gunners | Pebble Gunner (3-shot burst), Crouch Gunner, Mortar Dustie (lobs) | jump the burst, shoot in the gap |
| Shields | Shield Dustie, Tower Shield, Spinning Shield | jump over and shoot the back, low shot, bomb |
| Heavies | Brick Brute (8 hp), Kiln Knight (armored, 14 hp) | bomb, Hailstone, Downpour |
| Flyers | Dust Drone, Dive Hawk, Bomb Gull, Copter Dustie | aim assist, Sprinkler, Rainbow |
| Turrets | Wall Turret, Ceiling Turret, Cannon Nest | stay out of the arc, bomb |
| Spawners | Dust Hive (spawns every 3 s until bombed), Drop Pod | bomb first |
| Snipers | Laser Sniper (shows a line, then fires) | step out of the line |
| Vehicles | Dust Cart, Mini Tank, Hover Sled, Dust Train car | bombs, Downpour |
| Hazard makers | Mine Layer, Sand Blower, Smoke Dustie (hides others) | shoot first |
| Elites | gold-cracked versions of any type: more hp, faster, drop a pickup | everything you have |
| Wild creatures | the 36 v1 island creatures, now "dusted" (grey, +1 hp, some shoot) | Drizzle |

**How many** (on screen / per stage): zones 1–2: 3–6 / 60–100 · zones 3–8: 6–10 / 100–160 · zones 9–16: 8–14 /
150–220 · zones 17–20 and Endless: 12–20 / 200–260. Enemy shots on screen capped at 60.

---

## 5. Stage concepts — why no two stages feel alike

A stage is **zone look + district + concept + goal + set piece + time of day/weather + enemy mix + seed**. The
concept decides the shape and the goal; the intro card says it in one line, e.g. *"Bomb Squad · Destroy 4 Dust
Pumps before the well dries — 3:00"*.

**The 40 concepts**

| | Concept | Shape / goal | What makes it hard |
|---|---|---|---|
| **Runs** | 1 Frontline | horizontal, waves | steady pressure |
| | 2 Ambush Alley | gates lock, 3 waves, gates open | crossfire from both sides |
| | 3 Rooftops | gaps between roofs, drones | jumping while shooting |
| | 4 Collapse Bridge | the bridge falls behind you | no stopping |
| | 5 Searchlight | lights sweep; seen = alarm waves | timing |
| | 6 Switch Factory | conveyors, switch gates, crushers | puzzle under fire |
| | 7 Ice Slide | downhill, slippery | speed |
| | 8 Night Lantern | dark; enemies glow | sight |
| | 9 Dust Storm | low visibility, gusts | surprise |
| | 10 Gauntlet | short, no checkpoints | pure skill |
| **Vertical** | 11 Tower Climb | climb up, enemies at windows | falling back |
| | 12 Deep Dive | go down, shoot through floors | shooting down |
| | 13 Elevator Siege | a big lift rises, waves board it | small space |
| | 14 Rising Flood / Lava | climb before it reaches you | speed + enemies |
| | 15 Chimney | wall jumps up a shaft | precision |
| | 16 Vine Climb | climb vines, flyers | exposed |
| **Rides** | 17 Mine Cart | rails, auto-scroll, jump tracks | reactions |
| | 18 Raft River | auto-scroll on water, bank gunners | dodging |
| | 19 Train Top | fight on a moving Dust train, car to car | wind + tunnels |
| | 20 Glider Sky | Hoot glider: a side-scrolling shooter | bullet patterns |
| | 21 Mud Tank | Puddo drives a tank (big shots) | heavy armies |
| | 22 Clay Mech | stomping mech suit | bosses on foot |
| | 23 Rocket Shell | Turbo's rocket: fast auto-run | speed |
| | 24 Balloon Drift | floating up, wind | slow and exposed |
| **Missions** | 25 Rescue | free 5 caged Sprouts, then exit | finding them |
| | 26 Bomb Squad | destroy N Dust Pumps | bombs are limited |
| | 27 Hold the Well | defend a Rain Well 90 s, both sides | priority |
| | 28 Escort | protect a slow Rain Cart | it can't dodge |
| | 29 Key Hunt | maze with 3 keys and a locked exit | routes |
| | 30 Bell Tower | ring 4 bells while waves come | split attention |
| | 31 Hunt | beat N elite Dusties hiding in the stage | elites |
| | 32 Escape | the stage collapses / floods behind you | no way back |
| **Special** | 33 Coin Vault | 60 s bonus: coins and coin-Dusties | greed vs time |
| | 34 Arena Survival | small arena, 6 waves | everything at once |
| | 35 Portal Maze | teleport pads | orientation |
| | 36 Gravity Switch | floors flip | thinking upside down |
| | 37 Underwater | swim; pellets slower, bombs float | movement |
| | 38 Mirror Run | the stage runs leftward, mirrored | habits |
| | 39 General's Machine | stage 10 mini-boss | patterns |
| | 40 Zone Boss | stage 20 | patterns + phases |

**Schedule rules** (the "director"):
- In a zone's 20 stages: stage 1 = Frontline (with the zone's new trick), stage 10 = General's Machine, stage 20 =
  Zone Boss, one Coin Vault, at least 1 vertical, 1 ride, 2 missions, and **at least 14 different concepts**.
- The same concept never comes twice within 5 stages; a concept and a district never pair twice in the campaign.
- Each zone **introduces 2 new enemy types and 1–2 new concepts** and teaches them in its first 3 stages.
- Each stage also has one **set piece** from its zone's kit (e.g. lighthouse beam, harbor crane fight, kiln furnace
  doors, avalanche, sand-worm crossing, crashing chandelier), so even two Frontlines feel different.

---

## 6. The 20 zones (20 stages each = 400)

The look changes every 5 stages (4 districts per zone) and time of day/weather rotate within a district. The v1
island art, palettes and props carry over and get district variants.

| # | Zone | Districts (every 5 stages) | New in this zone | Stage-10 machine | Stage-20 boss |
|---|---|---|---|---|---|
| 1 | Sprout Shore | Beach · Palm Village · Harbor · Lighthouse | Blaster, bombs, crates, Dustie, Runner · Frontline, Ambush, Rescue, Coin Vault | Grit's Dust Crawler (tank) | Captain Clack |
| 2 | Fruitpop Grove | Orchard · Juice Mill · Treetops · Fruit Market | Shield Dustie, Bomb Gull · Tower Climb, Raft River | Grit's Saw Copter | Big Bonk |
| 3 | Pebble Caves | Crystal Tunnels · Mine Rails · Underground Lake · Glow Caverns | Wall/Ceiling Turret, Dust Hive · Mine Cart, Deep Dive, Key Hunt | Grit's Drill Worm | Mole Major |
| 4 | Bubble Lagoon | Reef · Sunken Ship · Kelp Forest · Bubble Works | Dive Hawk, Mortar · Underwater, Escort | Grit's Bubble Sub | Puffer Pete — **Act 1 ends** |
| 5 | Windy Kite Cliffs | Cliff Path · Kite Fields · Windmills · Eagle Peak | Laser Sniper, Copter · Glider Sky, Elevator Siege | Rasp's Gyro Walker | Gale Gull |
| 6 | Sugarcrumb Hills | Gumdrop Fields · Candy Factory · Caramel Swamp · Cake Tower | Brick Brute · Bomb Squad, Switch Factory | Rasp's Candy Crusher | Gummy Grump |
| 7 | Toybox Town | Playroom · Train Set · Block City · Robot Workshop | wind-up swarms, Dust Cart · Train Top, Clay Mech | Rasp's Toy Express | Jack-in-the-Crab |
| 8 | Mushroom Mire | Spore Marsh · Glow Grove · Root Caves · Witch Hut | Smoke Dustie, spore clouds · Night Lantern, Searchlight | Rasp's Spore Walker | Spore Lord — **Act 2 ends** |
| 9 | Frostbite Peaks | Snowfield · Ice Caves · Ski Slope · Summit Fort | ice shots, Hover Sled · Ice Slide, Escape (avalanche) | Clinker's Snow Plow | Walrus Wally |
| 10 | Dusty Dunes | Desert Road · Oasis · Sand Ruins · Dust Factory | Sand Blower, Mini Tank · Dust Storm, Mud Tank | Clinker's Worm Rig | Sandy Scorpion |
| 11 | Lantern Woods | Night Forest · Firefly Bog · Haunted Mill · Moth Tower | dark, Kiln Knight · Hunt, Chimney | Clinker's Lantern Walker | Moth Mama |
| 12 | Gearworks Factory | Assembly · Furnace · Conveyor Halls · Smokestacks | lasers, crushers, Mine Layer · Rising Lava, Arena Survival | Clinker's Forge Mech | Mecha Pinch — **Act 3 ends** |
| 13 | Vine Temple Ruins | Jungle Gate · Trap Halls · Idol Room · Sky Shrine | arrow traps, Tower Shield · Portal Maze, Bell Tower, Vine Climb | Static's Stone Drone | Stone Guardian |
| 14 | Cloud Castle Gardens | Cloud Docks · Rainbow Bridge · Sky Gardens · Storm Keep | lightning, Drop Pod · Balloon Drift, Gravity Switch | Static's Thunder Barge | Nimbus Knight |
| 15 | Neon Night City | Streets · Rooftops · Subway · Club Tower | drone swarms, Spinning Shield · Rooftops, Train Top (subway) | Static's Hover Cruiser | DJ Lobster |
| 16 | Volcano Vents | Ash Fields · Lava Falls · Magma Core · Fire Fort | magma Dusties, Cannon Nest · Rising Lava, Escape | Static's Magma Tank | Magma Crab — **Act 4 ends** |
| 17 | Crystal Mines | Gem Halls · Mirror Lake · Laser Vault · Prism Peak | bouncing lasers · Mirror Run, Key Hunt | Kranky's Crystal Driller | Crystal Clam Queen |
| 18 | Pirate Storm Sea | Docks · Ship Deck · Storm Waves · Skull Cove | ship cannons · Raft River (storm), ship-to-ship battle | Kranky's Dust Galleon | Admiral Snap |
| 19 | Moon Base Isle | Landing Pad · Low-G Craters · Lab · Rocket Silo | low gravity, alien Dusties · Rocket Shell, Gravity Switch | Kranky's Moon Walker | Robo Lobster |
| 20 | Kranky's Dry Castle | Outer Walls · Engine Halls · Throne Tower · Engine Core | everything; stage 19 = generals' rematch | the four generals | **Kranky + the Dust Engine** |

Bosses get bullet patterns (2–3 phases each, faster and denser per act); generals' machines have weak points that
open after a pattern.

---

## 7. Stage size, rooms and checkpoints

- **Horizontal stages: 350–900 tiles** (3–6 minutes); **vertical stages up to 160 tiles tall**; the stage grid height
  becomes variable (v1 is fixed at 20) and the camera follows both ways.
- A stage = **5–8 rooms**, each with a mini-goal (clear the gate, reach the lift, find the key…), plus the set piece.
- Checkpoints: 4–6 (Gauntlet 0–1), always just before a set piece or a boss door.
- Secrets per stage: 3 Rain Drops + one hidden Coin Vault door.

---

## 8. Difficulty — tough, but fair

| | Zones 1–2 | 3–8 | 9–16 | 17–20 | Endless |
|---|---|---|---|---|---|
| Feel | learning (already busier than v1) | tough | very tough | brutal | brutal + mutators |
| Enemy hp × | 1 | 1.2 | 1.5 | 1.8 | 1.8 → 2.4 |
| Enemy shots / min (per enemy) | 10 | 14 | 18 | 22 | 22 → 30 |
| Shot speed (tiles/s) | 7 | 8.5 | 10 | 11 | 11 → 12.5 |
| Checkpoints | 6 | 5 | 4–5 | 4 | 3–4 |

- **Hearts 3** (shop up to 6). A hit costs 1 heart **and the weapon pickup**. Falling costs 1 heart.
- **3 lives per stage**: out of hearts → back to the last checkpoint with full hearts; after 3 lives → the stage
  restarts. (Snack Stop sells an extra life.)
- **Medals per stage:** Clear · 3 Rain Drops · No-hit · Par time. Stars unlock the shop's top levels.
- **Fairness rules:** every attack has a tell; no hits from off-screen; checkpoints before set pieces; the bot must
  clear every stage in the sweep; a tuner keeps a "skilled bot" first-try clear rate at about 55–75% in late zones.
  (Lesson from Blob Brigade: the owner plays far better than bots, so tune by playtests too.)
- Assists in settings (off by default): Easy Run, bigger buttons.

---

## 9. Coins and rewards

- Coin trails and coin blocks in every room; **every melted Dustie drops coins** (grunt 1–2, heavy 8, elite 15,
  general's machine 100, boss 250).
- **Combo:** melts within 2 s chain ×1 → ×5; the counter shows on screen.
- End-of-stage tally: coins + combo bonus + time bonus + no-hit bonus. A good stage pays **150–600 coins**.
- Spend: Blaster Shop, Wardrobe, Bonbon's Snack Stop (bombs, an extra heart or life before a stage).
- Coins are the site's shared coins; prices are set so one good stage ≈ one cheap upgrade.

---

## 10. After 400 — the Endless Storm (401+)

- Each Endless stage = **look** (zone A + district) + **army** (zone B's enemies) + **concept** C + **mutator** M
  (a second mutator from Endless 200) + seed.
- **16 mutators:** Double Army · Giant Dusties · Night · Fog · Low Gravity · Mirror · Speed Run · Bombs Only · One
  Heart · Rising Water · Windstorm · Bomb Rain (sky bombers) · Elite Squad · Coin Frenzy · Turbo Enemies · Shield Wall.
- **No-repeat history** (saved): the same concept not within 6 stages, the same look not within 4, the same
  concept + look not within 120, the same concept + look + mutator never until the ~46,000 combinations run out.
- Every 10th Endless stage: **Boss Remix** (a boss in another zone's arena, with a mutator); every 25th: **General
  Rematch**.
- Difficulty starts at zone-16 level, rises to a cap around Endless 300; after that, mutators stack.
- **Daily Storm** (today's Daily Island, upgraded): one Endless stage per day, the same for everyone, streak rewards.

---

## 11. Look and sound

- Each district: its own palette shift, props and backdrop layers; time of day (morning, noon, sunset, night, storm)
  and weather particles rotate, so neighbouring stages never look alike.
- New build kits: tower interiors, mine rails, train cars, ship decks, factory machines, rooftops, temple halls.
- Effects: rain-pellet muzzle splash, mud-melt pop with a coin burst, thunder-splash bombs, Super Rain downpour, hit
  flash, combo counter, light screen shake (setting).
- Sound: shots per weapon, bomb thunder, melt plop, coin burst, combo chime, ambush alarm, gate slam; music per
  concept mood (run, ride, defend, stealth, boss) in each zone's instrument flavour.

---

## 12. Technical plan (`src/clayland/`, follows AGENTS.md / docs/AGENT_PROMPT.md)

- **Stage builder rewrite:** `concepts/*.ts` — one module per concept builds rooms on a variable-height grid; a
  **director** picks each stage's concept, district, set piece and enemy mix from the zone's schedule and the rules in
  §5; v1's pieces stay as filler inside rooms. Builds on demand (target < 20 ms), seeded, never stored.
- **Sim:** player shots, weapons, bombs, Storm meter, aim assist; enemy hp, damage, drops, waves and triggers
  (lock gates, timed spawns, hives); goals (destroy / defend / rescue / escort / survive / collect / escape);
  vehicles as player modes (cart, raft, train, glider, tank, mech, rocket, balloon).
- **Renderer:** chunked tile meshes (only near the camera) for big stages; two-axis camera; a Dust Army model kit
  (shared bodies + gear per type); pooled, instanced bullets and effects (up to 20 enemies + 60 shots on screen at
  60 fps desktop, 50+ on mid phones).
- **Bot:** fires, bombs, handles ambush/defend/escort; `clay_sweep.mjs` and a new tuner per concept.
- **Save v4:** campaign 1–400 + Endless position and history, shop levels, medals; keeps coins, wardrobe, daily
  streak. v1 was never deployed, so v2 starts a fresh campaign.
- **Hosting:** still 7 site files; new sounds and art go to R2; deploy only with `npm run deploy` and the owner's OK.

---

## 13. Build phases

| Phase | What gets built | Stages |
|---|---|---|
| **A — Combat core** | Rain Blaster + 6 pickups, Storm Bombs, Storm meter + Super Rain, FIRE / BOMB / SUPER buttons and X / C / V keys, enemy hp and coin drops, combos, 14 Dust Army types, the concept director with 14 concepts (Frontline, Ambush, Rooftops, Collapse Bridge, Tower Climb, Deep Dive, Mine Cart, Raft River, Rescue, Bomb Squad, Hold the Well, Key Hunt, Coin Vault, Arena Survival), tall stages + chunked renderer, Grit's 4 machines, 4 bosses reworked, Blaster Shop v1, Act 1 comics, sounds | zones 1–4 = **1–80** |
| **B — The army grows** | 16 more concepts (Train Top, Glider Sky, Mud Tank, Clay Mech, Elevator Siege, Rising Flood/Lava, Chimney, Searchlight, Night Lantern, Dust Storm, Switch Factory, Ice Slide, Escort, Hunt, Escape, Gauntlet), 24 more enemy types, Rasp's and Clinker's machines, 8 bosses, Acts 2–3 comics | zones 5–12 = **81–240** |
| **C — To the castle** | the last 10 concepts (Portal Maze, Gravity Switch, Underwater, Mirror Run, Balloon Drift, Rocket Shell, Bell Tower, Vine Climb, ship battle, generals' rematch), the rest of the army, Static's machines, Kranky + the Dust Engine, Acts 4–5 + ending, full shop | zones 13–20 = **241–400** |
| **D — Endless Storm** | 401+ with mutators and the no-repeat history, Boss Remix, General Rematch, Daily Storm, final tuning on phone and desktop, new cover art, ready to deploy | **401 → ∞** |

Each phase ends with: tsc + lint, the bot sweep for every stage of that phase, headless QA on 1280×800, 844×390 and
390×844 (`--mute-audio`), `npm run build:static` — then the owner's playtest before the next phase.

---

## 14. What stays, what changes

- **Stays:** Puddo, the Wardrobe, the Daily (→ Daily Storm), Bonbon's Snack Stop, Rain Drops and No-hit medals, the
  island looks and props (→ zone districts), the friends (pot powers, rescues, Squad Call), the music engine, the
  ◀ ▲ ▶ phone pad.
- **Changes:** Clay Splat → Rain Blaster (X still fires); the draining Squish meter → the Storm meter (fills by
  fighting); 300 stages → 400; Remix Isles → the Endless Storm.
- **Goes:** v1's one-loop stage builder as the main builder (its pieces live on inside rooms).

## 15. Decisions for the owner (recommendation first)

1. **Name:** keep *Puddo's Clayland* with the subtitle *Rain Raid* — or rename to *Puddo: Rain Raid*.
2. **Shots:** rain pellets; enemies melt to mud and pop coins (fits the story and the site).
3. **Difficulty:** tough by default; assists stay in settings, off.
4. **Start:** Phase A (zones 1–4, stages 1–80), then the owner's playtest.

---

## 16. Built — Phase A (2026-11-18)

- **Combat** (`sim.ts`, `weapons.ts`): Rain Blaster with aim assist (bends up to ~50° toward the nearest enemy, boss
  or target in front), ↓ + FIRE shoots down in the air, crouch-shots go under shields; 6 pickups from crates and elite
  Dusties (lost on a hit); Storm Bombs (3 to start, 5 to carry, thunder-splash r 2.8: enemies, bosses, pumps, cracked
  blocks, mines, enemy shots); Storm meter → Super Rain (3.2 s, everything on screen); combos ×1–×5 on coins; dropped
  coins with a magnet; 3 hearts × 3 lives a stage (the boss keeps its damage between lives).
- **Dust Army** (`bestiary.ts`): the 14 Phase A types (Dustie, Dust Runner, Dust Hopper, Pebble Gunner, Mortar, Shield
  Dustie, Brick Brute, Dust Drone, Bomb Gull, Dive Hawk, Wall/Ceiling Turret, Dust Hive, Mine Layer), every attack with
  a 0.42 s tell; elites (gold sash, ×2.2 hp, drop a pickup); the 36 wild creatures are "dusted" (+1 hp). Models in
  `models2.ts`.
- **Stages** (`stages.ts`): the director + the 14 concepts (Frontline, Ambush Alley, Rooftops, Collapse Bridge, Tower
  Climb, Deep Dive, Mine Cart, Raft River, Rescue, Bomb Squad, Hold the Well, Key Hunt, Coin Vault, Arena) plus the
  general's machine and the boss; variable stage height (towers and shafts 96–150 tall); ambush gates with waves;
  pumps, cages, keys + the exit door, the Rain Well, the vault timer; set pieces (barricade, watchtower, turret nest,
  hive yard, sky raid, mine field, crate stack). Zones 1–4 have hand-made 20-stage schedules and names
  (`islands.ts` `SCHEDULE` / `NAMED`); zones 5–20 are drafted from the same 14 concepts (no repeat within 4) and get
  their own concepts, armies and machines in Phases B–C.
- **Fights** (`bossai.ts`): Grit's Dust Crawler, Saw Copter, Drill Worm and Bubble Sub (water arena); Captain Clack,
  Big Bonk, Mole Major and Puffer Pete reworked with telegraphed patterns and a second phase; the other 16 bosses use
  the sharpened v1 patterns until Phases B–C. Cooldowns stretch up to 30% in the first zones.
- **Look** (`render.ts`): district palettes and time of day (day / sunset / night / storm), district props, chunked
  tile meshes (only near the camera), a two-axis camera with parallax on tall stages, tower windows, the cart and the
  raft, gates and the door, coin loot, crates, pumps, cages with Sprouts, the well, bomb flashes, enemy tells and
  hit pops, Puddo's Rain Blaster (aims and kicks back).
- **Front-end** (`ui/ClaylandApp.tsx`): HUD (hearts × lives, Rain Drops, Storm meter, goal tracker, boss bar, weapon,
  bombs, combo), phone controls (◀ ▲ ▶ · ▼ · BOMB · FIRE · SUPER when ready; smaller on narrow phones), stage card
  (zone · district · concept · brief), the Act 1 comic and Grit's escape panels, zone map by district with concept
  icons, clear tally (melted, best combo, coins), the Blaster Shop (5 upgrades), Snack Stop (+heart / +2 bombs /
  friend). Save v4 (`momoblobs-clayland`): a fresh campaign; wardrobe, daily streak and settings stay.
- **Sound** (`scripts/gen_clay_audio.py sfx`): 27 new effects — a shot per weapon, bomb throw, thunder boom, mud melt,
  pellet hit, shield clank, pickup, combo, Super Rain, Storm full, enemy shot, spawn puff, gate slam, door, alarm,
  pump blast, cage, key, well hit, life lost, crate.
- **QA**: `node scripts/clay_sweep.mjs 1 80` — the bot clears 72–73 of the 80 zone 1–4 stages (all frontlines,
  ambushes, rescues, bomb squads, collapses, vaults, arenas, towers, rafts, key hunts; most machines, bosses, dives,
  carts and wells — the rest are lost lives, not dead ends). Zones 5–20 drafts: ~54% (tougher; refined in B–C).
  Headless QA (`--mute-audio`) on 1280×760, 844×390 and 390×844: title, comic, play with the blaster, machine, tower,
  cart, dive, boss, shop — no console errors.
- **Phase A notes**: in zone 1 the schedule uses 10 concepts and zones 2–4 use 12–14 (the 40-concept rule in §5 applies
  once all concepts exist); zone 4's Underwater and Escort arrive in Phase B and replace two of its slots.

## 17. Built — Phase B (2026-11-18)

Zones 5–12 (stages 81–240): Act 2 (Major Rasp) and Act 3 (Colonel Clinker).

- **First-time tutorial** (`ui/Tutorial.tsx`): five pages with keyboard and phone mock-ups (Keyboard / Phone tabs),
  shown before a new player's first stage and from the title `?` button and Settings → How to play; stage 1 adds a
  step-by-step coach (fire at a Dustie, grab coins, open a crate, throw a bomb, fill the Storm meter).
- **16 new concepts** (`stages.ts`): Train Top, Glider Sky (Hoot carries Puddo; steer up/down), Mud Tank and Clay Mech
  (driven rides with armour that soaks every other hit), Elevator Siege (a lift that restarts from the last third
  reached), Rising Flood / Lava, Chimney (wall-jumps), Searchlight (the beam's alarm calls in Dusties), Night
  Lantern, Dust Storm, Switch Factory, Ice Slide, Escort (walk the Rain Cart home), Hunt (melt the marked elites to
  open the exit), Escape (chase pieces you can take at full speed), Gauntlet. Zone 4 slot 13 is now the Coral Cart
  Escort; Underwater stays for Phase C.
- **24 new enemies** (`bestiary.ts`, `models2.ts`): Laser Sniper (a red aiming line, then a fast shot), Copter Dustie,
  Kite Rider, Tower Shield, Gum Bouncer, Candy Cannon, Dust Cart, Wind-up Swarm, Toy Tank, Spore Thrower, Root
  Grabber, Witch Moth, Ice Shooter, Hover Sled, Snow Brute, Sand Blower, Sand Shark, Drop Pod, Kiln Knight, Lantern
  Ghost, Spider Dustie, Laser Turret, Forge Bot, Crusher Bot — each with its own model, shot and tell.
- **8 machines** with the general at the controls: Rasp's Gyro Copter, Candy Crusher, Toy Express and Root Borer;
  Clinker's Snow Plow, Worm Rig, Lantern Blimp and Forge Mech. **8 reworked bosses** (Gale Gull, Gummy Grump,
  Jack-in-the-Crab, Spore Lord, Walrus Wally, Sandy Scorpion, Moth Mama, Mecha Pinch) with two-phase patterns.
- **Look**: the tank and mech around Puddo, Hoot on the glider, the Rain Cart, the rising flood, searchlight poles
  and beams (red on alarm), sniper aim lines, mounds for buried enemies, train speed lines, dust-storm haze, new enemy
  shots (spores, orbs, ice, flame, tank shells).
- **Story**: Act 2 and Act 3 comics open zones 5 and 9; Rasp's and Clinker's escape panels after each machine.
  Toasts for the alarm, the cart being hit and elites down; HUD goal chips for Cart and Elites. Sounds reuse the
  Rain Raid set (alarm, well hit, combo, laser) — no new files.
- **Fairness fixes found by the sweep**: shots only switch a lever on; elevators get no bombers; a respawn puts the
  lift back; elites that fall still count; the searchlight stands on a pole (not a wall); wide rock gaps get a third
  rock; headwinds guard only 2-tile gaps; Puddo can't jump into a low ceiling while ducked, and a wall behind him no
  longer pulls him back through it (the train-beam bug); boss HP for Acts 2–3 eased and zones 9–12 use ×1.35.
- **QA**: `node scripts/clay_sweep.mjs 81 240 1 3 up` (with the shop upgrades a player usually owns by then) — the bot
  clears 146/160 (91%: every escape, boss, train, mech, glider, flood); with no upgrades 117/160 (73%; the Act 2–3
  bosses need the shop). Zones 1–4: 74/80. 420-stage smoke test: no crashes. Headless QA (`--mute-audio`, 1280×760
  and 844×390): the Act 2 comic, glider, elevator, tank, escort, flood, train, mech, searchlight, ice slide, dust
  storm, hunt, lantern and all 8 machines render with no console errors. Machines mirror (not turn) when they face
  left so the general and front details stay toward the camera. Escapes keep floating planks out (chase pieces and
  secret rooms only); the bot walks off step-downs instead of hopping over them.
