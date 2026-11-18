# MOMOBLOBS — Momo Escape (one-tap wall-run escape) plan

> **Telugu lo short ga:** Reel lo game = white rooms, thick black walls, chinna runner **floor, wall, ceiling meeda
> parigeduthu** untadu, **tap chesthe opposite wall ki jump** chesthadu. Pink lasers, spikes, turrets, crushers ni
> dodge chesi diamonds collect chesi **EXIT** ki reach avvali; timer + restarts count. Manam same genre cheyyam kani
> **mana Momo**, mana **risograph print look** (paper + 2 fluorescent inks per building — black/white kaadu), mana
> **original music**, **continuous escape** (stage screens levu — room exit nunchi next room loki direct ga), lives,
> coins, boosters, speed rush. **212 concepts** → **24 buildings × 10 floors = 240 designed floors** → floor **241 nunchi
> Infinite Fusion**: 2–4 concepts kalisi kotha concept puttuthundi (#213, #214…), Dex lo save ayyi malli inko concept
> tho kalusthundi → **unlimited, repeat feeling raadu**, prathi room ki **solver proof** (fair ga solvable).

Working title **Momo Escape** (slug `momo-escape`). Other name options: *Momo Lockdown*, *Wall Dash Momo*, *Blob Breakout*.

---

## 1. What the reel shows (reference only — we do not copy it)

A portrait, ultra-minimal escape platformer, one 31 s level ("Series 01 – 1/3"):

| Moment | What happens |
|---|---|
| 0–6 s | White rooms with thick black walls and soft grey drop shadows. A tiny grey runner runs along the floor, up the walls and across the ceiling of a tall corridor. Pink laser beams stretch between small black emitter blocks. A diamond floats mid-room. HUD: series tag, timer, diamond slot, a ×3 counter, pause. A huge faded transit-style sign sits in the background. |
| 6–12 s | The runner leaps straight across the room from wall to wall (dust puffs on take-off and landing), grabs the diamond (the HUD slot fills), and works down to the bottom: a laser line on the floor next to a hazard-striped gate. |
| 12–17 s | Runs along the bottom floor through the gate into the next part of the level; the camera pans. Stacked zig-zag corridors with pink spike strips on floors and ceilings. |
| 17–24 s | Wall turrets fire red blocks down the corridors (red splats when they hit); the runner leaps floor ↔ ceiling to dodge; one restart. |
| 24–27 s | Exit pit with a green-lit door → "SUCCESSFUL EXIT": level time 31.19, bonus diamonds 1/1, restarts ×1, series progress, retry / continue, green diamond confetti. |

What makes it fun: **one-touch control**, **the runner sticks to every surface** (rooms turn into 360° playgrounds),
**readable minimal art**, **instant retries**, **speed + timer**. What we do better is in §3. We take *the genre and
the feel* only — not its name, hero, signage theme, art, levels or UI.

## 2. The game in one screen

- **Run the walls.** Momo runs by himself along whatever surface he is on — floor, wall, ceiling. Inner corners carry
  him up the next wall, outer corners wrap him around the edge. He never stops.
- **Tap to leap.** One tap = leap straight off the surface to the opposite side of the room; he lands and keeps running.
  That is the whole control — one thumb, perfect on phones, works the same in mirror / upside-down rooms.
- **Escape upward, forever.** Every room is one floor of a building Kranky has locked down. Its **EXIT hatch** in the
  ceiling opens straight into the next floor — no "level complete" screens, no stage numbers, the run just continues.
  Every 10 floors the building changes (look, ink colours, music, hazards); floor 10 of each building is a finale.
- **Security wakes up when you enter.** A room's hazards power on the moment Momo comes through the hatch (lights flick
  on, lasers hum up) — so every room is a fresh, fair puzzle.
- **Hearts, coins, boosters.** 3 hearts (max 5). A hit = lose a heart and respawn at the room's hatch. Coin trails,
  3 diamonds per floor (risky spots), heart pickups, ⚡ boosters (30 s of ×1.5 speed, coins ×2), shields, slow-mo.
- **Speed rushes.** Some floors run at ×1.5 / ×2 speed (music speeds up too), then calm floors let you breathe.
- **Out of hearts?** "Caught!" — keep going for coins (cost doubles each time) or start again.

## 3. What makes ours better (and trending)

1. **Risograph-print look** (very in right now): warm paper, two fluorescent spot inks per building with slight
   misregistration, halftone shadows, grain, chunky stamp typography — not black & white.
2. **Infinite & never repeating**: hand-tuned building schedule for 240 floors, then the Fusion Director mixes concepts
   into brand-new named concepts forever, with anti-repeat memory.
3. **Always fair**: every generated room is proven solvable by a time-aware solver before you see it; an autopilot plays
   thousands of rooms in QA.
4. **Continuous flow** (no stage screens) + **lives / coins / boosters / speed rushes** — the things that kept Sky Roll
   from feeling boring.
5. **Kid-friendly**: hits are an ink-splat "boing", never blood; Kid Mode slows everything and gives more hearts.
6. **Story & characters**: Momo escaping Kranky's 24 locked buildings, rescuing buddy blobs, 11 playable rollers shared
   with the rest of MOMOBLOBS.
7. **Original music per building** with intensity layers; speed rushes speed the song up.

## 4. Concept library — 212 concepts

Every concept is a real thing in the game: an engine archetype + parameters + a look. The Dex lists them all; fusions
get numbers after #212.

### S — Surfaces & movement (25)
- S01 · Stick-run — Momo runs on floors, walls and ceilings
- S02 · Corner climb — inner corners carry Momo up the next wall
- S03 · Edge wrap — outer corners wrap Momo around the block
- S04 · Leap — tap to jump straight across to the opposite surface
- S05 · Pillar hop — floating blocks in mid-room to leap between
- S06 · Ice wall — slippery: Momo runs twice as fast
- S07 · Honey wall — sticky: Momo runs at half speed
- S08 · Speed strip — arrow strip that makes Momo sprint
- S09 · Conveyor — belt that speeds you up one way, slows you the other
- S10 · Bounce wall — springy face that makes Momo leap by itself
- S11 · Turn-around bumper — reverses Momo's running direction
- S12 · Teleport pads — step on one, pop out of its twin
- S13 · Long hall — wide rooms with long leaps
- S14 · Tall shaft — narrow rooms that climb fast
- S15 · Zig-zag halls — stacked corridors you snake through
- S16 · Chamber maze — rooms split by partitions with gaps
- S17 · Pocket ledges — small shelves on the walls
- S18 · Crumble bricks — shaky bricks drawn with cracks (stay off them)
- S19 · One-way hatch — the exit only opens upward
- S20 · Twin hatches — two possible exits, one is safer
- S21 · Wind tunnel — fans make the room hum (speed rush room)
- S22 · Water room — bubbly slow-motion room
- S23 · Low-gravity room — floaty music, slower hazards
- S24 · Launch pad — bounce pad on a floor that fires Momo upward
- S25 · Spiral room — rooms that wind around a central core

### O — Objects & devices (30)
- O01 · Exit hatch — the way to the next floor
- O02 · Key & lock — the hatch stays shut until you grab the key
- O03 · Keycard door — a coloured door inside the room
- O04 · Laser switch — run over it and a laser group shuts down
- O05 · Power lever — flips a whole room's security off
- O06 · Coin vault — a pocket packed with coins
- O07 · Diamond cage — diamonds in a risky spot
- O08 · Heart capsule — a heart in a hard-to-reach place
- O09 · Booster bolt — 30 s of ×1.5 speed and double coins
- O10 · Bubble shield — blocks one hit
- O11 · Slow-mo watch — everything slows for 8 s
- O12 · Coin magnet — pulls coins to Momo
- O13 · Ghost mode — pass through hazards for 4 s
- O14 · Buddy cage — rescue a buddy blob by touching the cage
- O15 · Mirror panel — a laser reflected around a corner
- O16 · Emitter post — the little blocks lasers hang between
- O17 · Pressure plate — lights up as you run over it (score bonus)
- O18 · Alarm light — spins when security is armed
- O19 · Vent fan — decorative airflow in wind rooms
- O20 · Fake wall — a secret pocket with coins
- O21 · Vending nook — rest floor: spend coins on a heart or shield
- O22 · Elevator floor — the rest floor between buildings
- O23 · Kranky screen — Kranky taunts you from a wall monitor
- O24 · Hack terminal — a terminal that powers lasers down
- O25 · Security door — slams shut behind you
- O26 · Cargo crates — stacked crates to run around
- O27 · Pipes — chunky pipes as walls and ledges
- O28 · Sign boards — building signs and arrows on the walls
- O29 · Trophy shelf — a showcase of your medals on rest floors
- O30 · Self-destruct button — Kranky's finale floors collapse behind you

### H — Hazards (45)
- H01 · Laser beam — a fixed beam between two posts
- H02 · Blink laser — on/off on a rhythm
- H03 · Sweeping laser — slides up and down a track
- H04 · Spinning laser — rotates around a pivot
- H05 · Laser gate — a pair of beams that blink in turn
- H06 · Spike strip — spikes on a floor, wall or ceiling
- H07 · Pop-up spikes — spikes that pop out on the beat
- H08 · Crusher — a block that slams down and lifts
- H09 · Side crusher — slams sideways across a corridor
- H10 · Double crusher — two crushers taking turns
- H11 · Turret — fires ink blocks along a corridor
- H12 · Fast turret — quick small bullets
- H13 · Twin turret — fires from both walls in turn
- H14 · Sawblade — a saw rolling on a track
- H15 · Saw pair — two saws on one track, opposite phase
- H16 · Orbit saw — a saw circling a block
- H17 · Patrol bot — a little robot pacing a ledge
- H18 · Flame jet — fire bursts out of a wall
- H19 · Steam vent — hissing steam column
- H20 · Electric floor — a face that sparks on a timer
- H21 · Tesla arc — lightning between two coils
- H22 · Pendulum — swinging spiked ball
- H23 · Spinning mace — rotating arm with a spiked ball
- H24 · Grumpy — spiky purple ball that sits still (never touch!)
- H25 · Grumpy pair — two grumpies guarding a gap
- H26 · Bobbing grumpy — floats up and down
- H27 · Mine — glowing mine that pulses
- H28 · Searchlight — a sweeping beam of light
- H29 · Meteor drop — a warned spot gets hit
- H30 · Lightning strike — a cloud zaps a marked spot
- H31 · Drone — flies a figure-eight route
- H32 · Drone pair — two drones crossing
- H33 · Rolling barrel — rolls along a floor and back
- H34 · Piston — punches out of a wall
- H35 · Fan blade — huge spinning blades (spinning laser look)
- H36 · Rising slime — the room floods from below — climb!
- H37 · Rising lava — faster flood in the volcano
- H38 · Ink splatter cannon — wide slow shots
- H39 · Paint bomb — a blob that bursts on a timer
- H40 · Clock hand — a giant rotating clock hand
- H41 · Snapping trap — jaws that snap shut on the beat
- H42 · Bubble trap — drifting bubbles (pop = hit)
- H43 · Glitch block — flickers between safe and danger
- H44 · Cricket ball machine — fires fast balls (stadium)
- H45 · Film spotlight rig — swinging lamp (film studio)

### A — Rules & twists (25)
- A01 · Lights out — only a glow around Momo
- A02 · Fog — far parts of the room fade
- A03 · Mirror room — the room is shown flipped
- A04 · Upside-down — the room is shown upside down
- A05 · Tilted cam — the camera leans
- A06 · Speed rush ×1.5 — the floor runs fast
- A07 · Speed rush ×2 — the floor runs very fast
- A08 · Calm floor — slow and easy, breathing room
- A09 · Flood chase — slime rises behind you
- A10 · Key hunt — the hatch needs the key
- A11 · Rescue — a buddy blob waits to be freed
- A12 · Coin rain — coins everywhere
- A13 · Diamond dash — diamonds in risky spots
- A14 · Rhythm room — every hazard moves on the beat
- A15 · Memory room — the walls fade after a moment
- A16 · Big room — the camera pulls back
- A17 · Tiny room — tight and quick
- A18 · Strobe — lights flash on the beat
- A19 · Kranky watching — Kranky's face on the wall screens
- A20 · Alarm — red lights spin, hazards faster
- A21 · Twin rooms — two halves mirror each other
- A22 · Gauntlet — hazard after hazard, no rest
- A23 · Treasure floor — a rest floor full of coins
- A24 · Silent — the music drops out, only the hum
- A25 · Boss floor — a set piece at the top of a building

### C — Camera & feel (12)
- C01 · Follow cam — smooth follow with look-ahead
- C02 · Room reveal — the camera shows the room as you enter
- C03 · Near-miss slow-mo — a tiny slow-down when you just make it
- C04 · Shake — impacts and slams shake the room
- C05 · Zoom punch — the camera punches in on pickups
- C06 · Pull back — big rooms zoom out
- C07 · Leap trail — ink trail behind every leap
- C08 · Dust puffs — take-off and landing puffs
- C09 · Ink splat — hits splat ink confetti, not blood
- C10 · Squash & stretch — Momo squashes on landing
- C11 · Parallax print — the building's poster art drifts behind
- C12 · Stamp transition — a big stamp when a new building starts

### W — Buildings (24)
- W01 · Toy Factory
- W02 · Candy Lab
- W03 · Ice Vault
- W04 · Neon Arcade
- W05 · Night Museum
- W06 · Space Station
- W07 · Robot Works
- W08 · Haunted Mansion
- W09 · Jungle Temple
- W10 · Underwater Base
- W11 · Volcano Forge
- W12 · Cloud Palace
- W13 · Pyramid Tomb
- W14 · Clock Tower
- W15 · Pirate Ship
- W16 · Circus Big Top
- W17 · Library of Echoes
- W18 · Server Core
- W19 · Film Studio
- W20 · Cricket Stadium
- W21 · Mega Mall
- W22 · Dino Park
- W23 · Star Observatory
- W24 · Kranky HQ

### M — Building soundtracks (24, all original procedural music)
- M01 · Toy Pop
- M02 · Candy Hyperpop
- M03 · Vault Lo-fi
- M04 · Arcade Synthwave
- M05 · Museum Jazz
- M06 · Station House
- M07 · Robot Drum & Bass
- M08 · Haunted Music Box
- M09 · Temple Afrobeats
- M10 · Deep-sea Dubstep
- M11 · Forge Phonk
- M12 · Palace Orchestra
- M13 · Tomb Trap
- M14 · Tower Marching Band
- M15 · Ship Reggaeton
- M16 · Big Top Swing
- M17 · Library Music Box
- M18 · Server Chiptune
- M19 · Studio Bollywood-style Dance
- M20 · Stadium Tabla Fusion
- M21 · Mall K-pop-style Dance
- M22 · Dino EDM
- M23 · Star Synthwave
- M24 · HQ Phonk Finale

### B — Finales & bosses (15)
- B01 · Wind-up Crusher — a giant toy press stomps the shaft
- B02 · Frost Laser Eye — a spinning eye with four beams
- B03 · Drone Queen — drones swarm in rings
- B04 · Orbit Core — saws orbit a reactor
- B05 · Magnet Titan — crushers on every side
- B06 · Ghost Projector — glitch blocks everywhere
- B07 · Kraken Arms — swinging tentacle maces
- B08 · Lava Golem — rising lava + flame jets
- B09 · Mummy Mech — meteor drops in the tomb
- B10 · Clockwork Owl — two giant clock hands
- B11 · Clown Bot — bouncing barrels and paint bombs
- B12 · Cyber Worm — turrets on every wall
- B13 · Director Bot — searchlights and lamp rigs
- B14 · Mega Vacuum — a flood that sucks upward
- B15 · Kranky Mech — everything at once

### X — Collectibles & meta (12)
- X01 · Coins — trails along the safe route
- X02 · Diamonds — 3 per floor, in risky spots
- X03 · Hearts — +1 life, up to 5
- X04 · Buddy blobs — rescued friends cheer at the end
- X05 · Medals — bronze / silver / gold run medals
- X06 · Stickers — a sticker for every building escaped
- X07 · Rollers — 11 playable characters
- X08 · Concept Dex — every concept and fusion you met
- X09 · Daily Heist stamp — one per day
- X10 · Best floor — your highest floor ever
- X11 · Speed medals — beat the par time
- X12 · Fusion cards — every new fusion gets a card

## 5. Journey — 24 buildings × 10 floors

Each building introduces new concepts in order, mixes them with older ones, has its own inks and soundtrack, and ends
with a finale floor. Difficulty rises inside a building (floors 1→9) and across buildings.

| # | Building | Inks | New concepts | Finale |
|---|---|---|---|---|
| 1 | Toy Factory | fluoro pink + blue | S01–S05, H01, H06, H24, O01, X01–X03 | B01 Wind-up Crusher |
| 2 | Candy Lab | orange + teal | S06–S08, H02, H07, H08, O09 | A09 Gummy flood chase |
| 3 | Ice Vault | sky + violet | S09, H03, H11, O02, A10 | B02 Frost Laser Eye |
| 4 | Neon Arcade | yellow + magenta (night paper) | H04, H05, H31, A14, A18 | B03 Drone Queen |
| 5 | Night Museum | gold + navy | H28, A01, O04, O20 | A20 Alarm escape |
| 6 | Space Station | mint + purple | S23, H16, S12, O10 | B04 Orbit Core |
| 7 | Robot Works | red + steel | H09, H10, H17, H34, O05 | B05 Magnet Titan |
| 8 | Haunted Mansion | green + plum | H43, A15, A02, O13 | B06 Ghost Projector |
| 9 | Jungle Temple | lime + brown | H22, H23, H33, S10 | A09 Boulder chase |
| 10 | Underwater Base | aqua + coral | S22, H42, H36 | B07 Kraken Arms |
| 11 | Volcano Forge | orange + charcoal | H18, H19, H37, H20 | B08 Lava Golem |
| 12 | Cloud Palace | white + gold | S24, S10, A04, H30 | Sky shaft climb |
| 13 | Pyramid Tomb | sand + teal | H29, H41, A15 | B09 Mummy Mech |
| 14 | Clock Tower | brass + crimson | H40, A14, S11 | B10 Clockwork Owl |
| 15 | Pirate Ship | navy + red | H13, H38, H33, A03 | Sinking-ship flood |
| 16 | Circus Big Top | red + yellow | H39, H26, S24 | B11 Clown Bot |
| 17 | Library of Echoes | burgundy + cream | A15, O15, H21 | Page-storm gauntlet |
| 18 | Server Core | green + black | H43, H12, O24 | B12 Cyber Worm |
| 19 | Film Studio | gold + pink | H45, A03, A05 | B13 Director Bot |
| 20 | Cricket Stadium | grass + blue | H44, A07, H12 | Super-over sprint |
| 21 | Mega Mall | pink + mint | S09, O14, H27 | B14 Mega Vacuum |
| 22 | Dino Park | olive + orange | H31, H32, A09 | Dino chase |
| 23 | Star Observatory | ice + indigo | H21, H04, A01 | Telescope laser maze |
| 24 | Kranky HQ | black + every ink | everything | B15 Kranky Mech |

## 6. Infinite Fusion — floor 241 → ∞, never repeating

**Building blocks.** ~150 mechanic atoms (S, O, H, A) + 24 buildings + 24 soundtracks + room shapes.

**The Fusion Director (how floor 241+ is made).**
1. Pick a building + soundtrack pair it has not used recently.
2. Pick 2–4 atoms with a novelty score (atoms and pairs seen recently score low; promoted fusions can come back whole).
3. Check compatibility (e.g. no flood in a Memory room, at most 2 turret types, one camera twist).
4. Build the room from the shape grammar, place the atoms where the solver path goes, then **prove it solvable** with
   the time-aware solver (hazards inflated by a safety margin). Retry with a new seed if not.
5. Name it from the atoms ("Strobe Saw Spiral", "Frosty Turret Chase", "Ghost Laser Gauntlet").

**New concepts are born.** Every fusion you clear gets the next Dex number (#213, #214 …) and a card. Every third
promoted fusion can be chosen *as an atom* later, so fusions fuse again — the library grows by itself.

**Anti-repeat rules.** No atom pair twice in 30 floors · building+music combo rotates · room-shape hash memory rejects
near-duplicate layouts · hazards never repeat their exact rhythm in a row · difficulty never drops more than one step.

**Why it never runs out.** C(150,2) = 11,175 pairs, C(150,3) ≈ 551,000 triples, × 24 × 24 × shapes × seeds — and the
fusions themselves become new atoms.

## 7. Modes

- **Escape Run** (main) — the endless continuous climb: 3 hearts, coins, boosters, speed rushes, building after building.
  Start from any building you have reached.
- **Daily Heist** — the same 10 floors for everyone today; best time and a daily stamp.
- **Speed Series** — 3-floor series against the clock with par times and medals (for speedrunners).
- **Room Lab** — mix up to 3 discovered concepts into your own building; share a code.
- **Kid Mode** (Settings → speed assist) — slower, 5 hearts, softer hazards.

## 8. Characters, rewards, progress

Coins buy the 11 rollers (shared roster with Sky Roll). Stickers per building, medals, best floor, Dex completion,
fusion cards. Rest floors between buildings have a vending nook (spend coins on a heart or a shield).

## 9. Look, sound, feel

- **Look:** risograph print — paper grain, 2 fluorescent inks per building + ink-black, misregistered offset shadows,
  halftone dots, stamp lettering, sticker-outlined Momo. Night buildings use dark paper with neon inks.
- **Juice:** squash & stretch, dust puffs, leap ink trail, near-miss slow-mo, screen shake on slams, coin chime that
  climbs in pitch on a streak, ink-splat confetti on a hit, room power-up flicker on entry.
- **Sound:** original procedural soundtrack per building (layers rise with intensity, speed rushes speed it up);
  every moment has a sound — footsteps, leap whoosh, landing thud, coin/diamond/heart/booster, laser hum when near,
  turret charge, crusher slam, saw whirr, hatch open, finale fanfare; stereo panned by position.
- **Phone first:** portrait, one thumb anywhere on screen, safe areas, haptics, 60 fps, landscape works too.

## 10. Tech plan

- `src/escape/` — `types`, `data/concepts` (this list), `data/buildings`, `sim` (fixed 60 Hz, everything a pure
  function of time → deterministic), `hazards` (shapes + collision), `gen` (room grammar + concept placement +
  **time-aware solver**: state = cell · surface · direction · tick mod period; actions = run / leap), `director`
  (difficulty curve, buildings, fusion, anti-repeat memory), `worker` (rooms built off the main thread), `render`
  (Canvas 2D, rooms pre-printed to off-screen canvases, riso shader-style effects), `sfx`, `session`, `save`,
  `ui/EscapeApp`.
- Reuses the MOMOBLOBS procedural music engine (Sky Roll), the site audio library, player shell and wallet.
- QA: the autopilot follows solver paths through thousands of generated rooms; node sweeps + browser tests on phone
  sizes; production build.

## 11. Build phases

1. Engine: runner, leap, surfaces, hazards, collisions, solver.
2. Generator: room grammar, concept placement, buildings, difficulty, fusion director, worker.
3. Renderer, music, sound effects, juice.
4. App: title, Escape Run, HUD, game over / continue, building picker, Daily Heist, Speed Series, Room Lab, Dex,
   rollers, save, site entry + art.
5. Test sweeps, phone tests, production build.

### Build status (2026-11-18)

All five phases are built (`src/escape/`, slug `momo-escape`, engine `escape`):

- **Engine** — `sim.ts` one tick-aligned step function (run, corner climb, edge wrap, leap, bounce, bumper, teleport
  pads, conveyor/ice/honey/speed faces) shared by the game, the solver and the autopilot; `hazards.ts` 7 archetypes
  (laser, spikes, crusher, turret, mover, pulse, flood) as pure functions of time; `solver.ts` time-aware search with
  rhythm folding (T = LCM of the room's periods ≤ 120 ticks) and hazard bounding boxes.
- **Generator** — `gen.ts` room grammar (zig-zag, maze, stairs, split levels, shaft, spiral, twin, finale, calm),
  every placement re-checked (cheap replay first, full solve if needed), both hatch entries proven (the hatch catches a
  leaping Momo, so there are only two ways in), coins on the route, diamonds on proven alternative routes, building
  schedule for floors 1–240, Fusion Director after that, per-mode recipes (run, Daily Heist, Speed Series, Room Lab).
  Floors are built in a Web Worker three ahead.
- **Look & sound** — `render.ts` Canvas 2D risograph print (paper grain, misregistered halftone shadows, stamps,
  night buildings), rule overlays (dark, fog, mirror, flip, tilt, strobe, alarm, memory); procedural soundtrack per
  building on the MOMOBLOBS music engine (tempo follows speed rushes); sound for every moment, panned by position.
- **App** — `ui/EscapeApp.tsx` title (live attract demo), Buildings start picker, Modes (Daily Heist, Speed Series with
  medals, Room Lab with share codes), Concept Dex + fusion cards, Rollers (shared roster and coin jar with Sky Roll),
  HUD, toasts, Caught sheet with paid continue, results sheet; `save.ts` progress store; site entry + art.
- **QA** — autopilot sweeps: floors 1–240 and 241–340 built and cleared with **0 hits**; builds average ~1.3 s
  (p95 ~3.5 s) while a floor takes ~5–6 s to play; production build passes.

Known gaps: S20 (twin hatches) and S21 (wind tunnel) are named only (no mechanic yet); bosses are hazard set pieces
without boss characters; a small share of floors (~2–6 %) still fall back to a calm room when the generator cannot
place their concepts.
