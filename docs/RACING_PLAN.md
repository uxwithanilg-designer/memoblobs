# MOMOBLOBS Racing — 6 big 3D racing games

Bigger than the arcade games: full 3D (three.js), a real racing-game menu flow, a garage with 30+ unlockable
vehicles, 25+ themed worlds, career + quick race + single-drive modes, and studio-style racing music & engine audio.
All six share one racing engine (`src/racing/`) so every game gets every feature.

## The six games

| # | Game | Type | Hook |
|---|---|---|---|
| 1 | **Nitro Rush** (`nitro-rush`) — *live* | Car circuit racing | 29 world themes, 34 cars & trucks, nitro, drift-to-boost, slipstream, takedowns, Coin Rush single mode |
| 2 | **Drift Kings** (`drift-kings`) — *live* | Car drift & rally | Drift-chain scoring (×5 multiplier, links, chain lost on walls), tandem Drift Battles vs an AI drifter, rally stages on dirt/sand/snow with co-driver pace notes; 27 venues, 33 cars (`src/racing/games.ts`, `drift.ts`, `cars/drift.ts`, `world/drift.ts`) |
| 3 | **Highway Heat** (`highway-heat`) — *live* | Car traffic & police chase | Kinematic highway traffic (`traffic.ts`), near-miss combos, nitro smashes, police AI (`cop` personality) with heat levels 1–5, roadblocks, BUSTED meter and damage; modes Heat Run / Escape / Takedown; road-sign skin, chase + big-beat music |
| 4 | **Moto Rush GP** (`moto-rush`) — *live* | Bike circuit racing | Procedural bikes + riders (`cars/bike.ts`, `CarModel.pose`), lean into bends with rider hang-off, wheelies (`Vehicle.style = "bike"`), Wheelie Challenge, Qualifying / GP / Title Duel career; paddock skin, racing metal + hardstyle music, bike engine voices |
| 5 | **Stunt Moto** (`stunt-moto`) | Motocross / stunts | Jumps, flips & tricks, mud and ramps, trick combos, freestyle arenas |
| 6 | **Traffic Rider X** (`traffic-rider`) | Endless bike highway | First/third-person, near misses, wheelies, missions, day/night/rain |

## Shared features (every racing game)

- **Front-end like a real 3D racer**: title screen → Career / Quick Race / Single Drive / Garage / Settings,
  world & track picker, car picker with a 3D turntable showroom, stats, paint, upgrades.
- **Unlocks**: 3 free vehicles; the rest unlock with career stars, level by level (`Unlock at ★ N`).
- **Career**: 26 worlds × 4 events = 104 levels (Race, Coin Rush, Elimination / Time Trial, Duel vs a boss rival),
  1–3 stars each; next event opens when the previous one earns a star.
- **Race mode settings**: opponents 1–7, laps 1–5, AI difficulty (Easy / Normal / Hard / Pro), track variant & reverse,
  weather and time of day, pickups and hazards on/off.
- **Single Drive (Coin Rush)**: solo drive with checkpoint timer, coins, nitro bottles, shields, magnets and ramps —
  and hazards (fire barrels, oil, spikes, rocks, cones) that cost a life or slow you down; 3 lives.
- **Racing feel**: nitro (with perfect-start, drift, slipstream, near-miss and takedown charges), drifting, slipstream,
  car-to-car bumps and takedowns, off-road slowdown, wall scrapes with sparks, jumps, speed FOV & camera shake,
  3 camera views, countdown, position / lap / time / best lap, minimap, wrong-way warning, results with stars.
- **Worlds**: city, neon night, desert canyon, snowy alps, tropical beach, jungle, volcano, autumn forest, cherry
  blossom, candy land, moon base, harbour, farm, Egyptian dunes, ice cave, rainy metro, sunset coast, Wild West,
  mushroom forest, cyber grid, safari, lavender fields, glacier, rainbow sky road, haunted town, savanna storm…
  each with its own sky, light, fog, road surface, barriers, scenery and weather.
- **Audio**: a real-time synthesized engine (RPM + gear shifts, per-car pitch), turbo/nitro, tyre screech, crashes,
  coins, countdown, crowd — panned in stereo around the camera — plus a racing music pack (rock, EDM, synthwave,
  drum & bass, trap, chiptune) with intense and calm mixes.
- **Controls**: phone buttons (steer / brake-drift / nitro, auto-gas), tilt steering, keyboard, gamepad.
- **Quality**: Low / Medium / High graphics, auto-downgrade when the frame rate drops, works in portrait & landscape.
