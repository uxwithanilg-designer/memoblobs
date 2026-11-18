# MOMOBLOBS — Momo Sky Roll (rolling-ball music runner) plan

> **Telugu lo short ga:** Reel lo game = sky lo float avuthunna tiles meeda okka ball auto ga roll avuthundi, manam
> **drag chesi left/right** steer chestham, music beat ki sync ga hammers, lasers, jump pads, falling tiles vasthayi,
> prathi ~15 s ki **theme maruthundi** (forest → neon → purple → lava), chivara **100% + 3 crowns + gems**.
> Manam same genre cheyyam — kani **mana Momo** (orange clay blob) ball ga roll avuthadu, mana **clay-toy look**, mana
> **original music**, mana 11 characters hazards ga. **217 concepts** (floors, tiles, hazards, abilities, camera, rules,
> themes, music, bosses, collectibles) → **20 worlds × 10 = 200 designed levels** → level **201 nunchi Infinite Fusion**:
> concepts 2–3 kalisi kotha concept puttuthundi, adi kuda **Concept #201, #202…** ga Concept Dex lo save ayyi malli
> inko concept tho kalusthundi → **game eppatiki aagadu, repeat feeling raadu** (anti-repeat memory + par-bot fairness).

Working title **Momo Sky Roll** (slug `sky-roll`). Other name options: *Roll Momo Roll*, *Beat Roll*, *Blob Roll*.

---

## 1. What the reel shows (reference only — we do not copy it)

The clip is a portrait 3D rolling-ball music runner, one ~95 s level played 0 → 100 %:

| Moment | What happens |
|---|---|
| 0–17 s | Green low-poly forest. A ball rolls forward by itself on floating square tiles; the player drags left/right. Gaps, zigzag turns, narrow planks, swinging hammers, a big jump-pad launch, blue glass tiles, orange arrow tiles. Gems float over risky spots. |
| 18–48 s | Theme cuts to a dark neon grid: yellow jump tiles, pink pop-up blocks, sliding spiky crystals, sweeping laser beams, rolling striped drums, hazard-striped falling tiles, a crown on a side path. "Check Point" banners between zones. |
| 49–63 s | Purple dream world, the ball turns purple: turrets, rotating arms, fragile white tiles. |
| 64–79 s | Back to the forest (ball orange again): propeller arms, spiky crystals, stepping stones. |
| 80–95 s | Lava castle: towers with glowing eyes, crushers, fire cannons, a final fire beam, finish portal. |
| Results | 100 %, 3 crowns, 20/20 gems, ×3 stars, next / retry. (Plus ad-style cross-promos — we never do this.) |

What makes it fun: **one-finger control**, **music-synced obstacles**, **theme changes on the drop**, **checkpoints**,
**risky side routes for crowns/gems**, **clear % progress**. What we do better is in §3.

**Our rules:** our own name, our own hero (Momo), our own clay-toy art, our own procedurally composed music, our own
levels from our own generator. No ads, no purchases, no cross-promo, kid-safe.

---

## 2. The game in one screen

- **Momo curls into a clay ball** (his sprout stays on top and wobbles) and rolls forward on a floating tile path.
- **Drag anywhere** to steer (1:1 sideways). Keyboard ← → / A D, gamepad stick. Some sections hand you an ability
  (tap / ↑ / W to jump, swipe to dash…).
- The path is **built on the music's beat grid**: every hazard moves on a beat, every jump lands on a kick drum.
- A level is **60–120 s**, shown as **0–100 %**, split into **5–7 zones**. Every zone change happens on a musical drop
  with a **Clay Morph** (the world squishes into the next theme) and a **checkpoint**.
- Per level: **20 beads** (collectibles), **3 Golden Sprouts** (hidden on risky routes), **stars** (1 = finish,
  2 = 15+ beads, 3 = all sprouts).
- Fall or get hit → respawn at the last checkpoint (free, always — no ads, no revive currency). Kid Mode adds edge
  bumpers.

---

## 3. What makes ours better (and trending)

| Idea | Why it matters |
|---|---|
| **Infinite Fusion engine** (§6) | Levels never run out *and* never feel repeated — new concepts keep being born from old ones. |
| **Concept Dex** | Every mechanic and every fusion you discover gets a card (#001 … #217 … #2,304 …). Collect-them-all motivation. |
| **The path is the song** | Piano-key tiles, drum pads and beat-blink tiles play the melody as you roll — very "satisfying", made for short clips. |
| **Clay Morph transitions** | Signature look: at each drop the world melts like clay into the next theme instead of a hard cut. |
| **Beat-reactive world** | Trees, props, tiles and sky pulse with the bass; haptics on the kick (phones). |
| **11 MOMOBLOBS characters** | Play as any of them, each with a small perk (§8), and they appear as hazards (Kranky's claw, Gloop copies, Zib's beam…). |
| **Fever mode** | 16 beats rolled on perfect timing → Momo glows, beads ×2, trail turns rainbow. |
| **Concept Lab + share codes** | Pick 2–3 discovered concepts, generate your own level, share a code like `MOMO-7F3K` — a friend types it and gets the same level (seeded, no server). |
| **Trending music styles** | 20 original style packs: phonk, hyperpop, K-pop-style dance, Bollywood-style dance, tabla fusion, lo-fi, synthwave, EDM… (all composed by our generator, no copied songs). |
| **Ghost run** | Race your own best run (local ghost). |
| **Kid-safe by design** | Free respawns, Kid Mode, no chat, no ads, no purchases, progress saved on the device. |

---

## 4. Concept library — 217 concepts

Every concept is a card with tags (category, verbs, cost 1–3, needs/blocks). IDs are stable — the generator, the
Concept Dex and share codes all use them.

### F — Floors & paths (25)

- `F01` **Wide Road** — 7 lanes, straight, the safe teaching floor.
- `F02` **Plank** — 1-lane bridge.
- `F03` **Zigzag** — the lane jumps left/right in 90° steps.
- `F04` **Snake** — smooth S-curves.
- `F05` **Stepping Stones** — single tiles with gaps.
- `F06` **Checker Holes** — checkerboard of holes.
- `F07` **Comb** — long teeth with gaps; pick a tooth.
- `F08` **Fork** — two routes: safe-and-long vs risky-with-sprout.
- `F09` **Triple Fork** — three routes, one secret.
- `F10` **Funnel** — wide narrows to one lane.
- `F11` **Fan** — one lane opens wide.
- `F12` **Stairs Down** — drops one step per beat.
- `F13` **Stairs Up** — climb with jump pads.
- `F14` **Ramp & Air** — launch ramp over a canyon.
- `F15` **Wave Floor** — floor rises and falls like a sine wave.
- `F16` **Tilt Board** — the whole floor tilts; Momo drifts downhill.
- `F17` **Corkscrew** — spiral path; camera rolls with it.
- `F18` **Half-pipe** — curved sides you can ride up.
- `F19` **Moving Islands** — platforms slide sideways.
- `F20` **Elevator Tiles** — tiles rise/sink on the beat.
- `F21` **Turntable** — a rotating round platform.
- `F22` **Conveyor** — the floor pushes sideways or backwards.
- `F23` **Maze Corridor** — walls; find the open lane.
- `F24` **Ladder** — rungs with a gap every other row.
- `F25` **Loop-the-Loop** — a vertical loop.

### T — Tiles (25)

- `T01` **Jump Pad** — launches over a gap.
- `T02` **Mega Pad** — huge arc; camera pulls out.
- `T03` **Boost Arrow** — speed burst.
- `T04` **Mud** — slows you down.
- `T05` **Ice** — low grip, slides.
- `T06` **Sticky Jelly** — high grip, slow steering.
- `T07` **Bouncy Jelly** — auto-bounce on every tile.
- `T08` **Crumble** — falls 0.5 s after you touch it.
- `T09` **Glass** — cracks on the first touch, breaks on the second.
- `T10` **Beat Blink** — on/off with the beat.
- `T11` **Ghost Tile** — invisible until its music note plays.
- `T12` **Colour Tile** — only tiles of your colour are solid.
- `T13` **Paint Splash** — changes Momo's colour.
- `T14` **Mirror Tile** — flips left/right steering for a while.
- `T15` **Teleport Pair** — in at A, out at B.
- `T16` **Gravity Flip** — roll on the ceiling.
- `T17` **Shrink** — Momo gets tiny (fits tiny lanes).
- `T18` **Grow** — Momo gets huge (crushes small things, wider body).
- `T19` **Magnet Strip** — pulls to the centre lane.
- `T20` **Push Arrow** — shoves you sideways.
- `T21` **Pressure Plate** — opens a bridge ahead.
- `T22` **Seesaw** — tips when you roll onto it.
- `T23` **Piano Key** — each tile plays the next melody note.
- `T24` **Bumper Wall** — side walls bounce you back in.
- `T25` **Updraft** — hover for a moment.

### H — Hazards (40)

- `H01` **Swing Hammer** · `H02` **Windmill Arms** · `H03` **Twin Hammers** (alternate) · `H04` **Sliding Block**
- `H05` **Crusher** (piston from above) · `H06` **Pop-up Pillar** (from the floor, on the beat)
- `H07` **Crystal Slider** (spiky crystal crosses the lane) · `H08` **Rolling Barrel** (comes towards you)
- `H09` **Bowling Pins** (knocking them slows you) · `H10` **Laser Sweep** · `H11` **Laser Gate** (pulses on the beat)
- `H12` **Falling Rocks** (shadow marks the spot) · `H13` **Side Cannon** · `H14` **Bouncing Ball**
- `H15` **Pendulum Axe** · `H16` **Saw Groove** (saw slides along a track) · `H17` **Spinning Top**
- `H18` **Closing Doors** · `H19` **Revolving Door** · `H20` **Sweeper Arm** · `H21` **Wind Fan** (pushes sideways)
- `H22` **Water Jet** · `H23` **Geyser** (launches up — helper or hazard) · `H24` **Snowball Roll**
- `H25` **Boulder Chase** (from behind) · `H26` **Lightning Mark** (warned one beat early) · `H27` **Firework Burst**
- `H28` **Rising Flood** (lava/tide/slime from behind) · `H29` **Shadow Zone** (lit only on beats) · `H30` **Fog Bank**
- `H31` **Kranky's Claw** (grabs a lane) · `H32` **Gloop Copies** (hop across lanes) · `H33` **Zib's Beam** (pulls sideways)
- `H34` **Bolt Stomper** (robot foot) · `H35` **Turbo Rocket** (snail zooms across) · `H36` **Pip Penguin Slide**
- `H37` **Hoot's Book Drop** · `H38` **Bonbon Cake Wall** (breaks if boosted) · `H39` **Noodle Wall** (long dog slides by)
- `H40` **Tiki Sign Swing**

### A — Abilities (15) — handed out by pickups for a section

- `A01` **Tap Jump** · `A02` **Double Jump** · `A03` **Dash** (swipe up) · `A04` **Balloon Glide** · `A05` **Shield Bubble**
- `A06` **Slow-mo Bell** · `A07` **Bead Magnet** · `A08` **Twin Roll** (two Momos, mirrored) · `A09` **Rail Grind**
- `A10` **Wall Ride** · `A11` **Ceiling Roll** · `A12` **Rocket Shell** · `A13` **Ghost Mode** (pass through for 2 s)
- `A14` **Stretch Bridge** (Noodle bridges one gap) · `A15` **Super Squash** (smash down through crumble)

### C — Camera (12)

- `C01` **Chase** (default) · `C02` **High Top-down** · `C03` **Side View** (2.5D) · `C04` **Reverse Run** (rolling at the camera)
- `C05` **Dutch Tilt** · `C06` **Wide Pull-out** · `C07` **Low Hero** · `C08` **Quarter Turn** (rotates 90° mid-run)
- `C09` **Upside-down** · `C10` **Mirror World** · `C11` **Split Screen** (with Twin Roll) · `C12` **Fly-by** (on drops)

### R — Rules & twists (25)

- `R01` **Beat Steps** (tiles appear on the beat) · `R02` **Colour Match** · `R03` **Gold Only** (bonus for gold tiles)
- `R04` **No Edges** · `R05` **Lights Out** · `R06` **Mirror Controls** · `R07` **Speed-up Chorus** · `R08` **Tempo Shift**
- `R09` **Rhythm Tap** (tap on the beat to jump) · `R10` **Red Light / Green Light** · `R11` **Follow the Ghost**
- `R12` **Chase** (something behind you) · `R13` **Crumbling Run** (path collapses behind) · `R14` **Bead Rain**
- `R15` **No-Touch Lines** · `R16` **Memory Path** (shown, then hidden) · `R17` **Tiny Momo** · `R18` **Giant Momo**
- `R19` **Gravity Swaps** · `R20` **Speed Lanes** (left fast, right slow) · `R21` **One Life** (no checkpoints)
- `R22` **Time Gates** · `R23` **Rescue Run** (pick up baby blobs) · `R24` **Boss Dodge** · `R25` **Silence** (music drops; visual metronome)

### W — Themes (30)

- `W01` Clay Garden · `W02` Candy Kitchen · `W03` Ice Floe · `W04` Neon Night · `W05` Slime Swamp · `W06` Toy Box
- `W07` Space Port · `W08` Robot Factory · `W09` Floating Library · `W10` Coral Reef · `W11` Desert Pyramids
- `W12` Jungle Ruins · `W13` Cloud Kingdom · `W14` Festival of Lights · `W15` Music Hall · `W16` Haunted Castle
- `W17` Volcano Forge · `W18` Crystal Caves · `W19` Dream Dimension · `W20` Rainbow Summit
- Bonus themes for Fusion/Daily: `W21` Cherry Blossom · `W22` Autumn Woods · `W23` Snowy Village · `W24` Pixel Arcade
  · `W25` Paper Craft · `W26` Bubble Sea · `W27` Moon Base · `W28` Circus Tent · `W29` Holi Colour Fest · `W30` Rainy Night City

### M — Music styles (20, all original compositions)

- `M01` Clay Pop · `M02` EDM Drop · `M03` Lo-fi · `M04` Phonk · `M05` Hyperpop · `M06` K-pop-style Dance
- `M07` Bollywood-style Dance · `M08` Tabla Fusion · `M09` Chiptune · `M10` Synthwave · `M11` Drum & Bass · `M12` Trap
- `M13` Epic Orchestra · `M14` Jazz Swing · `M15` Reggaeton · `M16` Afrobeats · `M17` Marching Band · `M18` Music Box
- `M19` Dubstep · `M20` House

### B — Set pieces & bosses (15)

- `B01` **Kranky Crab Chase** · `B02` **Gloop King** · `B03` **Zib's Mothership** · `B04` **Bolt's Mega Robot**
- `B05` **Eruption!** · `B06` **Tidal Wave** · `B07` **Avalanche** · `B08` **Collapsing Tower** · `B09` **Train Chase**
- `B10` **Dragon Kite Race** · `B11` **Storm Machine** · `B12` **Mirror Momo Duel** · `B13` **Clock Tower Gears**
- `B14` **Giant Pinball** · `B15` **Giant Piano**

### X — Collectibles & meta (10)

- `X01` Beads (20/level) · `X02` Golden Sprouts (3/level) · `X03` Letters M-O-M-O · `X04` Stars · `X05` Hidden Key → secret level
- `X06` Golden Momo Statue (photo spot) · `X07` Music Notes (unlock a remix) · `X08` Baby Blobs · `X09` Mystery Box · `X10` Perfect-Beat streak → Fever

**Total: 25 + 25 + 40 + 15 + 12 + 25 + 30 + 20 + 15 + 10 = 217.**

---

## 5. Journey — 20 worlds × 10 levels = 200 designed levels

Pattern inside every world (teach → test → twist → finale):
**L1** teach the world's new idea · **L2–L4** develop it · **L5** first mix with an older idea · **L6–L8** new twists ·
**L9** world remix (hardest) · **L10** set piece / boss.
Each level is still built by the generator from its recipe + a fixed seed, so the designed 200 never change.

| World | Host · music | New ideas |
|---|---|---|
| 1 Clay Garden | Momo · `M01` | steering, gaps, jump pads, forks, hammers |
| 2 Candy Kitchen | Bonbon · `M20` | jelly, bouncing, rolling donuts, conveyors |
| 3 Ice Floe | Pip · `M14` | ice, glass, snowballs, wind |
| 4 Neon Night | — · `M10` | beat steps, lasers, blink tiles, pop-ups |
| 5 Slime Swamp | Gloop · `M12` | sticky, copies, shrink & grow |
| 6 Toy Box | Tiki · `M17` | pins, tops, mazes, loops |
| 7 Space Port | Zib · `M09` | jumps, teleports, beams, ceiling rolls |
| 8 Robot Factory | Bolt · `M02` | conveyors, crushers, saws, rails |
| 9 Floating Library | Hoot · `M03` | memory, darkness, silence, tilt |
| 10 Coral Reef | Kranky · `M15` | water jets, claws, tides, rescues |
| 11 Desert Pyramids | Turbo · `M08` | doors, mirages, sand slides |
| 12 Jungle Ruins | Noodle · `M16` | axes, boulders, crumbling bridges |
| 13 Cloud Kingdom | Tiki · `M13` | glide, updrafts, lightning |
| 14 Festival of Lights | Momo · `M07` | colour tiles, fireworks, rhythm |
| 15 Music Hall | Bolt · `M11` | piano keys, tempo shifts, silence |
| 16 Haunted Castle | Hoot · `M04` | shadows, ghosts, mirrors |
| 17 Volcano Forge | Kranky · `M19` | rising lava, cannons, smashing |
| 18 Crystal Caves | Zib · `M18` | prisms, gravity, twin roll, wall ride |
| 19 Dream Dimension | Noodle · `M05` | camera tricks, reverse, giant & tiny |
| 20 Rainbow Summit | everyone · `M06` | everything, final boss |

### World 1 — Clay Garden
1. First Roll `F01` · 2. Hop Hop `F05 T01` · 3. Zigzag Garden `F03` · 4. Plank Walk `F02 F04` · 5. Fork in the Flowers `F08 X02`
· 6. Boost Bloom `T03 F10 F11` · 7. Hammer Time `H01` · 8. Windmill Hill `H02 F04` · 9. Garden Remix `F03 T01 H01` · 10. **Kranky's Lawn Chase** `R12 B01`

### World 2 — Candy Kitchen
1. Jelly Roll `T06` · 2. Bouncy Pudding `T07` · 3. Donut Alley `H08` · 4. Cake Wall Crash `H38 T03` · 5. Sprinkle Stairs `F12 T01`
· 6. Mixer Arms `H02 F21` · 7. Bakery Belt `F22 H04` · 8. Melting Choco `T08 F06` · 9. Sweet Remix `T07 H08 F03` · 10. **Cake Tower Collapse** `B08`

### World 3 — Ice Floe
1. Slippery Start `T05` · 2. Penguin Parade `H36` · 3. Snowball Alley `H24` · 4. Ice Plank `T05 F02` · 5. Crack the Glass `T09 F05`
· 6. Frozen Fork `F08 T05` · 7. Glacier Launch `F14 T02` · 8. Blizzard `H21 H30` · 9. Pip's Lost Map `R16 T05` · 10. **Avalanche!** `B07`

### World 4 — Neon Night
1. Beat Steps `R01` · 2. Laser Sweep `H10` · 3. Blink City `T10` · 4. Pop-up Pillars `H06` · 5. Laser Gates `H11 R09`
· 6. Neon Stairs `F12 T10 R04` · 7. Lights Out `R05 H29` · 8. Speed Lanes `R20 T03` · 9. Neon Remix `H10 T10 F03` · 10. **Neon Train Chase** `B09`

### World 5 — Slime Swamp
1. Sticky Swamp `T06 T04` · 2. Gloop Copies `H32` · 3. Bounce Stones `T07 F05` · 4. Lily Islands `F19 F05` · 5. Slime Geysers `H23 T02`
· 6. Shrink Down `T17 F02` · 7. Grow Big `T18 H09` · 8. Bubble Fog `H30 R16` · 9. Swamp Remix `H32 T17 F19` · 10. **Gloop King** `B02 R24`

### World 6 — Toy Box
1. Bowling Lane `H09 X09` · 2. Spinning Tops `H17` · 3. Domino Run `R13` · 4. Toy Car Traffic `H04 H35` · 5. Block Maze `F23 C02`
· 6. Jack-in-the-Box `H06 R10` · 7. Bumper Pipe `T24 F18` · 8. Toy Train Loop `F25 T03` · 9. Toy Remix `H17 F23 R13` · 10. **Giant Pinball** `B14`

### World 7 — Space Port
1. Moon Hop `A01 F05` · 2. Teleport Pads `T15` · 3. Zib's Beam `H33` · 4. Asteroid Rain `H12` · 5. Ceiling Roll `T16 A11`
· 6. Orbit Turntable `F21 F17` · 7. UFO Parking Lot `H04 H33` · 8. Gravity Swaps `R19` · 9. Space Remix `T15 T16 H12` · 10. **Zib's Mothership** `B03`

### World 8 — Robot Factory
1. Conveyor Line `F22 T20` · 2. Crusher Row `H05` · 3. Saw Grooves `H16 A03` · 4. Bolt Stompers `H34` · 5. Elevator Floors `F20 H05`
· 6. Magnet Rails `T19 A09` · 7. Pressure Plates `T21 F23` · 8. Assembly Rhythm `R09 H05` · 9. Factory Remix `F22 H16 H34` · 10. **Bolt's Mega Robot** `B04`

### World 9 — Floating Library
1. Page Bridge `F02 F04` · 2. Book Drop `H37` · 3. Ink Dark `R05` · 4. Memory Path `R16` · 5. Shelf Maze `F23 H37`
· 6. Tilting Pages `F16` · 7. Quiet Please `R25` · 8. Letter Hunt `X03 F08` · 9. Library Remix `H37 R16 F23` · 10. **Clock Tower Gears** `B13`

### World 10 — Coral Reef
1. Tide Pools `T04 F05` · 2. Water Jets `H22` · 3. Bubble Lift `T25` · 4. Claw Snap `H31` · 5. Wave Floor `F15 H22`
· 6. Coral Comb `F07` · 7. Baby Blob Rescue `R23 X08` · 8. Rising Tide `H28` · 9. Reef Remix `H22 H31 F15` · 10. **Giant Kranky & the Wave** `B01 B06`

### World 11 — Desert Pyramids
1. Sand Slide `F14 T03` · 2. Sliding Stones `H04 F23` · 3. Sandstorm `H21 H30` · 4. Pyramid Stairs `F13 T01` · 5. Tomb Doors `H18 H19`
· 6. Scarab Rollers `H08 F04` · 7. Mirage Tiles `T11` · 8. Sunbeams `R15 F06` · 9. Desert Remix `H18 T11 H21` · 10. **Pyramid Collapse** `B08 R13`

### World 12 — Jungle Ruins
1. Rope Bridge `F02 T22` · 2. Rolling Boulders `H08 H25` · 3. Temple Axes `H15` · 4. Crumble Bridge `T08 A14` · 5. Monkey Fork `F09 H39`
· 6. River Rapids `F22 F15` · 7. Vine Grind `A09` · 8. Boulder Chase `H25 R12` · 9. Jungle Remix `H15 T08 F09` · 10. **Temple Escape** `R13 H25 C04`

### World 13 — Cloud Kingdom
1. Cloud Hop `A02 F05` · 2. Balloon Glide `A04` · 3. Lightning Marks `H26` · 4. Tiki Signs `H40` · 5. Updraft Canyon `T25 F14`
· 6. Rainbow Bridge `F04 R14 A07` · 7. Storm Fans `H21 H26` · 8. Sky Fork `F09 X02` · 9. Cloud Remix `A04 H26 T25` · 10. **Dragon Kite Race** `B10`

### World 14 — Festival of Lights
1. Lantern Path `R05` · 2. Firework Beats `H27 R01` · 3. Rangoli Colours `T12 T13` · 4. Sparkler Gates `H11` · 5. Colour Match `R02 F06`
· 6. Dhol Bounce `T07 R09` · 7. Diya Ghost Tiles `T11` · 8. Golden Night `R03` · 9. Festival Remix `H27 T12 R09` · 10. **Grand Firework Finale** `H27 R07 C12`

### World 15 — Music Hall
1. Piano Keys `T23 X07` · 2. Drum Pads `T07 R01` · 3. Metronome Axes `H15 A06` · 4. Tempo Shift `R08` · 5. Rhythm Tap `R09 A01`
· 6. Speaker Wind `H21 R07` · 7. Bass Drop `F12 C06` · 8. Silent Section `R25 T10` · 9. Music Remix `T23 R08 H15` · 10. **Giant Piano** `B15`

### World 16 — Haunted Castle
1. Shadow Halls `H29` · 2. Ghost Tiles `T11 R11` · 3. Swinging Axes `H15 H03` · 4. Bat Bounce `H14` · 5. Ghost Mode `A13 H20`
· 6. Mirror Hall `T14 C10` · 7. Trap Doors `T08 H18` · 8. Phantom Carriage `R12 H25` · 9. Castle Remix `H29 T14 H15` · 10. **Mirror Momo Duel** `B12`

### World 17 — Volcano Forge
1. Lava Rise `H28` · 2. Fire Cannons `H13` · 3. Crumble Rock `T08 F05` · 4. Forge Crushers `H05 F22` · 5. Magma Geysers `H23 T02`
· 6. Super Squash `A15 T08` · 7. Ember Rain `H12 H27 A05` · 8. Obsidian Ice `T05 H28` · 9. Volcano Remix `H28 H13 T08` · 10. **Eruption!** `B05`

### World 18 — Crystal Caves
1. Prism Tiles `T12 T13` · 2. Light Beams `H10 C05` · 3. Gravity Caves `T16 R19` · 4. Shrink Tunnels `T17 F23` · 5. Echo Memory `R16 R25`
· 6. Crystal Glass `T09 H07` · 7. Twin Roll `A08 C11` · 8. Wall Ride `A10 F18` · 9. Crystal Remix `T16 A08 H10` · 10. **Crystal Corkscrew** `F17 F25 C08`

### World 19 — Dream Dimension
1. Upside Down `C09` · 2. Reverse Run `C04` · 3. Side Scroll `C03 A01` · 4. Quarter Turns `C08 F03` · 5. Morphing World `R07 C12`
· 6. Dream Mirror `R06 C10` · 7. Giant Momo `R18 H09` · 8. Tiny Momo `R17 F24` · 9. Dream Remix `C04 R06 T16` · 10. **Dream Collapse** `R13 C12 F17`

### World 20 — Rainbow Summit
1. Rainbow Road `F04 A12 R07` · 2. Hazard Parade `H01 H10 H05 C07` · 3. Tile Gauntlet `T10 T15 T16` · 4. One-Life Climb `R21` · 5. Time Gates `R22`
· 6. Everyone's Here `H31 H32 H33 H34` · 7. Perfect Beat `X10 R09` · 8. Summit Fork `F09 X05 X06` · 9. Grand Remix (a zone from every world) · 10. **Kranky's Storm Machine** `B11 B01 R24`

Worlds unlock by Golden Sprouts (World 2 = 3 sprouts … World 20 = 300 of the 600 available). Secret levels behind `X05` keys: one per world.

---

## 6. Infinite Fusion — level 201 → ∞, never repeating

### 6.1 Building blocks

- A **level** = 5–7 **zones** laid on the music's beat grid. A **zone** (8–16 bars) = one **floor** + one or two
  **mechanics** (tile / hazard / ability / rule) + optional **camera** move, in one **theme**, with one **music** style.
- Every concept card carries: `cost` (1–3), `verbs` (steer, time, jump, read, remember), `needs` (e.g. `T16` needs a
  closed floor), `blocks` (e.g. `C09` blocks `C04`), `teach` (a safe intro pattern) and `params` (speed, count, spacing,
  beat offset) with safe ranges.

### 6.2 The Fusion Director (how a level 201+ is made)

1. **Seed** = hash(level number) → same level for everyone (fair for Daily and share codes).
2. **Pick 2–3 atoms** for the level's headline fusion, scored by:
   `novelty` (pairs/triples the player has never seen score highest) − `recency` (seen in the last 10 levels) +
   `fit` (verbs that mix well, e.g. *time + steer*) − `clash` (blocked pairs are never picked).
3. **Mutate** the fusion: change params (speed, spacing, beat offset, direction), mirror or reverse it, swap the
   timing source (beat / half-beat / off-beat / triplet), or move it into a new theme/music pair.
4. **Lay out zones** with the pacing curve **calm → build → drop → breather → twist → climax → finish**; a new atom
   always appears first in a safe *teach* pattern, never two new atoms in one zone.
5. **Par-bot check** (like Blob Brigade's): a simulated player with human reaction time must clear every zone at the
   target skill; failing zones are re-rolled. Every hazard is visible ≥ 0.6 s (≥ 0.9 s in Kid Mode) before it matters.
6. **Name it**: adjective from atom A + noun from atom B + music word → *"Frosty Laser Waltz"*, *"Sticky Gravity Phonk"*.

### 6.3 New concepts are born (the "200 tarvata kotha concepts" rule)

- When you clear a fusion it becomes **Concept #218, #219, …** in your **Concept Dex**, with its name, recipe and a
  thumbnail.
- **Promoted fusions become atoms themselves**: a later level can fuse *"Frosty Laser Waltz"* with *Gloop Copies*.
  A **complexity budget** (max active cost per zone, slowly rising and then capped) keeps it readable and fair, so
  depth grows without becoming impossible.
- **Property mixing** makes genuinely new tiles/hazards, not just two things side by side: tiles are property bundles
  (grip, bounce, lifetime, visibility, colour, push), hazards are *shape × motion × timing × placement*, so
  *Ice + Blink* = "a slippery tile that only exists on the off-beat", *Hammer + Teleport* = "a hammer that blinks
  across lanes".
- **Hybrid themes**: two themes blend into a new look (*Candy Volcano*, *Neon Jungle*, *Paper Moon Base*), with a
  palette generator and prop swaps.

### 6.4 Anti-repeat rules (hard rules, checked by the generator)

1. An exact fusion is never served twice to the same player (played fusions kept in a small bloom filter, ~8 KB).
2. No headline atom repeats within 10 levels; no theme + music pair within 20 levels.
3. Every level has at least one thing the player hasn't seen in the last 5 levels.
4. Every 10th level is a set piece (boss, chase, collapse) with remixed phases.
5. Tempo alternates slow / medium / fast; time signatures rotate (4/4, 3/4 waltz, 6/8 swing).
6. One **surprise moment** per level (camera flip, gravity swap, Clay Morph mid-zone, bead rain).
7. Adaptive mix: zone types you fail a lot appear a bit less (and in their *teach* form first); types you breeze
   through get faster variants.

### 6.5 Why it never runs out

217 atoms → about 9,000 compatible pairs and 300,000+ compatible triples, × 30 themes × 20 music styles × param
mutations → billions of distinct levels before counting promoted fusions. At 2 minutes a level nobody can exhaust it.
Difficulty doesn't climb forever: after level 200 it moves in a **sawtooth band**, and **Prestige loops**
(Bronze → Silver → Gold → Rainbow) add +3 % speed each, capped.

---

## 7. Modes

| Mode | What it is |
|---|---|
| **Journey** | Levels 1–200 (§5), then continues as Infinite Fusion 201 → ∞ on the same map (spiral path). |
| **Endless Roll** | One never-ending run; the world morphs on every drop; score = distance + beat streak. No checkpoints. |
| **Daily Fusion** | One seeded level per date, the same for everyone, with a named "Fusion of the Day" and a streak counter. |
| **Concept Lab** | Choose 2–3 discovered concepts + theme + music → instant level. Share code `MOMO-XXXX` (seed + atoms). |
| **Boss Rush** | All 15 set pieces back to back (after World 20). |
| **Practice** | Start any cleared level from any checkpoint. |

---

## 8. Characters, rewards, progress

- **Play as any MOMOBLOBS character** (unlock with beads; Momo is free). Each has a small perk:
  Momo — balanced · Gloop — extra grip on ice · Pip — slides faster on ice · Bolt — bead magnet range +
  · Zib — short hover over a 1-tile gap · Turbo — longer boosts · Hoot — Slow-mo Bell lasts longer
  · Bonbon — breaks cake walls without a boost · Noodle — stretches over one gap per zone · Kranky — quicker sideways
  · Tiki — longer glides. Kid Mode can turn perks into "always help" mode.
- **Beads** buy skins, trails, roll sounds and tile skins. **Golden Sprouts** unlock worlds. **Stars** and **Fever**
  give coins to the site-wide wallet (`useProfile.earnCoins`).
- **Trophies**: first 100 %, all sprouts in a world, 50 Concept Dex entries, Daily streak 7, Fever ×10, no-respawn clear…
- Saved on the device only, like every MOMOBLOBS game.

---

## 9. Look, sound, feel

- **Clay-toy look** (not low-poly): soft rounded tiles with thumbprint texture, chunky outlines, pastel-to-neon
  palettes per theme, Momo's sprout bobbing on top of the ball, squash & stretch on landings.
- **Clay Morph** transition on every drop; **beat pulse** on props, tiles and sky; confetti bursts on checkpoints.
- **Music**: 20 style packs from our audio generator (`scripts/gen_roll_audio.py`), each with intro / verse / chorus /
  drop / breather stems and a beat-map JSON (BPM, bars, drops) that the level generator reads. Tile sounds are tuned to
  the song's key, so rolling sounds musical.
- **Haptics** on kicks and landings (respects the Vibration setting), camera shake respects the shared setting.
- **Portrait first** like the reel; landscape centres the path with a wider view.
- **Kid Mode** (uses the shared `speedAssist` setting): 0.8× speed, bumpers on edges, wider tiles, longer warnings.

---

## 10. Tech plan

| Part | Plan |
|---|---|
| Engine | `src/roll/` — `types.ts`; `concepts/` (one file per category, the 217 cards); `gen/` (`beatmap.ts`, `zone.ts`, `level.ts`, `fusion.ts`, `novelty.ts`, `parbot.ts`, `names.ts`); `sim.ts` (pure TS, **fixed 120 Hz step**, seeded RNG — fully deterministic); `render.ts` (three.js, `InstancedMesh` per tile type, pooled hazards, chunk streaming 2 zones ahead / dispose behind); `camera.ts`; `session.ts`; `save.ts`; `ui/RollApp.tsx` |
| Clock | The music's `AudioContext.currentTime` is the master clock; distance = speed × beats. Latency calibration slider in Settings. |
| Reuse | `GamePlayer` (pause, settings, fullscreen), `lib/audio`, `useProfile` coins & trophies, racing sky/texture helpers, Momo's clay material (`games/momo-shuffle/engine/clay.js`) |
| Site | Catalog entry in `src/lib/games.ts` (`engine: "roll"`), `/play/sky-roll`, card / hero / OG art from real renders |
| QA | `window.__roll` dev hooks (jump to level, autopilot, dump zone); `scripts/roll_sweep.mjs` runs the par-bot over all 200 levels + 1,000 fusions; headless Playwright with muted audio |

**Lessons from the code review (do these from day one):**

- Dispose every geometry/material/texture, call `forceContextLoss()`, and cancel `init()` if the view unmounts
  mid-load.
- Allocation-free frame loop (reuse vectors/colours).
- Validate and `migrate` the save (never a blank screen on a bad save).
- Resume audio on exit.
- No Space-bar jump until the GamePlayer Space-pause bug is fixed (jump = tap / ↑ / W).
- Kid Mode and reduced-motion actually honoured.
- Clear pending timers on restart.

---

## 11. Build phases

1. **Core prototype** — roll physics, drag steering, tile grid, 10 atoms (`F01–F05`, `T01 T03 T08`, `H01 H02`),
   Clay Garden theme, chase camera, % bar, checkpoints, results, save. Playable at `/play/sky-roll`.
2. **Concept system** — card registry with tags, zone/level generator, beat-map sync, par-bot, Clay Morph,
   3 worlds (30 levels), 3 music packs.
3. **Full Journey** — all 217 concepts, 20 worlds / 200 levels, 15 set pieces, characters & perks, beads/sprouts/stars,
   trophies.
4. **Infinite** — Fusion Director, novelty memory, promoted concepts + Concept Dex, Daily Fusion, Endless Roll,
   Concept Lab share codes, Prestige loops.
5. **Polish** — all 20 music packs, Fever, ghost runs, Kid Mode tuning, performance pass on low-end phones, cover /
   hero / OG art, catalog + sitemap.

### Build status (2026-11-18)

- **Phases 1–5 built.**
  - 20 worlds / 200 Journey levels, compiled from §5 by `src/roll/levels.ts`.
  - Infinite Fusion from level 201 (`src/roll/fusion.ts`), plus Daily Fusion, Endless Roll, Concept Lab share codes and Boss Rush.
  - All 217 concepts are implemented through 7 hazard archetypes, 29 tile kinds, forces, rules, 12 camera modes, 15 abilities and 15 bosses.
  - Concept Dex, with promoted fusions numbered #218 and up.
  - 11 rollers with perks, Fever, ghost runs.
  - 20 live music styles (`src/roll/music.ts`) and 30 themes with 93 moods (`src/roll/data/worlds.ts`, `src/roll/art/props.ts`).
  - Hazard, boss and character models in `src/roll/art/skins.ts`.
- **Feedback applied:**
  - Speed is 3 rows per beat, about 5–6.5 rows/s.
  - Paths are narrower and harder.
  - Levels run about 1.5–2.5 min.
  - Levels flow into the next one automatically.
- **QA:** the autopilot clears all 200 Journey levels, the title level, 100 fusion levels, Daily, Endless, Lab and Rush with 0 deaths. Every skin builds in the browser. Typecheck, lint and the production build pass.
- **Not yet verified:**
  - Played on a real phone.
  - The audio mix checked by ear.
