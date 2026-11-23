# Orbi GP — Marble Sky Grand Prix (game plan)

> Working title. Other names to choose from: **Marble Blitz**, **Roll Royale**, **Orbi Rally**.
> Status: **plan only** — nothing is built yet. This is the design to agree on before development starts.

## 1. The idea in one breath

A **3D marble racing game** in the sky. You are **Orbi**, a glossy glass marble with a glowing swirl inside, racing
**up to 11 rival marbles** (the MOMOBLOBS gang rolled up into marbles) on **giant floating circuits**. You keep your
balance on narrow beams, seesaws and rolling logs, fly off jump pads between floating islands, dodge hammers and
lasers, grab coins, speed orbs and powers — and race for the podium.

It takes the **feeling** of the reference video (balls racing on sky tracks with no rails, jump pads, islands, a race
position, a finish arch) and makes it **bigger, richer and endless**:

| The reference video | Orbi GP |
| --- | --- |
| Short sprints, one look (grey track, white sky) | **Big laps** (1.2–3 km a lap, 2–3 laps) and long **Sky Rallies**, in **25 different worlds** |
| Plain grey road | Designed tracks: candy stripes, glass tubes, neon, crystal, lava rock, moon dust… |
| A few obstacle types | **500 ideas**, each taught on its own stage, then **mixed forever** |
| Roll and steer | Roll, steer, **balance**, **jump**, **boost**, use **25 powers**, ride machines, do tricks |
| Rivals just race | Rivals bump, draft, take shortcuts, use powers, and have personalities |
| Ends after its levels | **Unlimited stages**: after stage 500 the Remix Grand Prix never repeats a mix |

How it differs from our own ball games:
- **Momo Sky Roll** is a solo, endless music run on lanes.
- **Rollo Rush** is a runner.
- **Orbi GP is a race**: free 3D marble physics (no lanes), real balance pieces, laps, rival marbles, positions and
  podiums.

## 2. Story (light, for kids)

The **Sky Cup** is the biggest race in the Marble Isles: 25 floating worlds joined by sky roads. Orbi is the
newest, smallest racer. Kranky wants the cup for himself, so in every world he builds a giant cheating machine (the
world's boss).
- **The goal:** win all 25 cups, beat Kranky's machines, then race the **Remix Grand Prix** forever to climb the
  leagues: Bronze → Silver → Gold → Diamond → Legend.

The rival marbles:
- **Turbo** (speedy), **Zib** (jumper), **Gloop** (heavy and bumpy), **Pip** (sneaky shortcuts), **Tiki** (power-up
  lover);
- **Kranky's robot marble Klonk** and 5 more, each with its own driving style.

## 3. Controls (phone first)

Players drive themselves, with no auto-roll by default (the lesson from the racing games).

| Action | Touch | Keyboard |
| --- | --- | --- |
| Roll forward | **hold a finger anywhere** — Orbi rolls toward where you push | ▲ / W |
| Steer | slide the finger left / right (analog, like a joystick that follows your thumb) | ← → / A D |
| Slow down / balance | lift the finger (Orbi coasts) or pull the finger back (brake) | ▼ / S |
| Jump (taught in world 1) | **swipe up** | Space |
| Use power | **tap the power button** (bottom-right) | Shift |
| Boost (when the meter is full) | **double-tap** | E |

Options:
- **Tilt steering** — tilt the phone to roll, like a real marble maze.
- **Classic buttons** — arrow buttons plus a ROLL pedal, with the same thumb layout as our racing games.
- **Assist roll** — off by default; it rolls forward for you while you steer.
- **Big buttons**, and a **left-handed** layout.

## 4. Core loop

1. **Pick a race.** On the journey the next stage is ready, with no menus, like Rollo Rush.
2. **Start.** Twelve marbles on the grid, a countdown, and a **perfect-start boost** for rolling right at GO.
3. **Race.** Roll, balance, jump, collect and use powers, with your position, lap and gap shown live.
4. **Checkpoint gates.** Falling off respawns you at the last gate: you lose time, not the race.
5. **Finish.** You get the podium, stars (top 3, all 3 hidden stars, gold time), coins and new ideas for the Dex.
6. **Next stage.** It's built while you race, so it starts straight away.

## 5. Stages: what one stage looks like

Every stage is generated from a **recipe**: its kind, its world, the idea it teaches, a difficulty, and a seed.

- **Kinds**, rotated so two stages in a row never feel alike:
  - **Circuit** — 2–3 laps of a 1.2–3 km loop; ~70–120 s a lap at kid speed.
  - **Sky Rally** — point to point, 2.5–5 km from a mountain top down through the world.
  - **Sprint** — short and intense.
  - **Knockout** — the last marble is out each lap.
  - **Royale** — 24 marbles; platforms fall away.
  - **Time Trial** — race the gold ghost.
  - **Boss** — Kranky's machine attacks the race.
- **Sections:**
  - a **sign** section shows the new idea safely;
  - **practice** and **mix** sections pair it with older ideas;
  - a **set piece** (a big themed moment);
  - the **finish**.
- **Laps change:**
  - lap 2 opens a **shortcut**, and lap 3 adds a **hazard twist** (e.g. the hammers speed up);
  - "Final lap!" brings a music change and the camera swoop.
- **Every stage is fair:** a **robot marble** with human reaction time drives each stage before you see it, just
  like Rollo Rush's fairness bot. Stages it can't finish are rebuilt.

## 6. Getting harder (and never boring)

- **Difficulty** climbs quickly at first, then keeps rising slowly forever. It drives:
  - track width and rail cover (wide with rails → narrow ribbons with no edges);
  - gap length and landing size;
  - obstacle speed and how they sync together;
  - rival skill, lap count, hazard density, and how many ideas mix at once.
- **Breathers:** every 5th stage is a breather or a show stage, and every 10th is a **burner** (extra hard).
- **New ideas never stop:** stage n always brings one idea you have not seen; after 500 the remix brings a mix you
  have not seen.

## 7. Collect, power up, speed up

**Collectibles** on every stage:
- **Coins**, for the shared MOMOBLOBS wallet;
- **gem lines** on the risky lines, worth 5 coins each;
- **speed orbs** that fill the boost meter;
- **power capsules**, which give one random power from the ones learned so far (fair: there's no "blue shell");
- **hearts**, which save a fall in Rally and Royale;
- **3 hidden stars** per stage;
- **O-R-B-I letters**, for a bonus vault;
- **keys** that open secret shortcuts.

**Speed:**
- boost pads and **slipstream** behind rivals;
- **speed gates**, downhill momentum and **slingshot pads**;
- the **boost meter** (double-tap), which also fills from tricks and near misses.

**25 powers** (family P below), taught one per world:
- **Easy ones:** Turbo, Magnet, Shield bubble, Super Jump.
- **Shape and weight:** Giant marble that bumps rivals away, Tiny marble that fits small pipes, Heavy iron that
  stops wind from pushing you, Feather float.
- **Bridges and ghosts:** Glide wings, Ghost (pass through walls), and **Rainbow Bridge**, which builds a road over a
  gap.
- **Time tricks:** Freeze trail, **Rewind** (undo the last 3 seconds after a fall) and Time slow.
- **Big finishes:** Rocket, Drill, Star (invincible), Black Hole (pulls in coins) and Twin (split into two marbles).

## 8. Modes

- **Grand Prix (the journey):**
  - 25 worlds × 20 stages = 500 stages, then the **Remix Grand Prix** forever.
  - It picks up exactly where you left off.
- **Endless Sky Run:** one marble run that never ends; the score is distance.
- **Daily Cup:** three races, the same for everyone that day, with a streak.
- **Time Trial:** race your own ghost on any cleared stage.
- **Knockout Royale:** 24 marbles, 3 rounds; the floor breaks away.
- **Boss Rush:** Kranky's machines back to back.
- **Marble Lab (later):** pick 2–3 ideas and build your own stage to share as a code.

## 9. Collection

All of it is just for looks: no paid boosts and no ads. Coins and play unlock everything.

- **Marbles (200+):** glass swirls, metal, lava, ice, candy, planets, gems, galaxy, emoji faces, animals.
  - **Skins look different but drive the same** — a fair race.
- **Trails:** sparkles, flames, rainbow, music notes, bubbles…
- **Finishes:** confetti, fireworks, a crowd wave…
- **Concept Dex:** all 500 ideas plus every remix you discover.

## 10. Look and feel (better than the reference)

- **Marbles:**
  - real reflections of the world;
  - a glowing swirl core that spins faster with speed;
  - a soft shadow, sparks when bumping, and a glow trail at high speed.
- **Tracks:**
  - every world has its own track material and edge style: candy stripes, bamboo, glass, neon, ice, gold rails;
  - roads twist, bank and loop through the scenery instead of floating plain and grey.
- **Worlds:**
  - floating islands with waterfalls, big landmarks (a giant cake, a pyramid, a moon base);
  - crowds of cute critters cheering at the turns, flags and big screens showing the race.
- **Camera:**
  - smooth chase, slow motion on big jumps, a swoop on the last lap;
  - a photo finish replay, and a drone shot of the whole circuit at the start.
- **Effects:** bloom on the glows, speed lines, dust, splashes, confetti; day, night, sunset and weather per world.
- **Sound:** every world has its own music style (in the same engine as our other games); rolling sounds change
  with the surface: glass clinks, wood rumbles, ice hisses.
- **Phones first:** three quality levels, low draw calls (merged scenery, instanced coins), and 60 fps targets.

## 11. The 25 worlds

| # | World | Look | Its theme ideas |
| --- | --- | --- | --- |
| 1 | Cloud Meadows | green sky islands, windmills, daisies | breezes, first jumps, first rival |
| 2 | Candy Canyon | candy-stripe roads, caramel rivers, jelly | sticky caramel, jelly pits |
| 3 | Coral Lagoon | beaches, water slides, coral arches | flumes, crabs, waves |
| 4 | Toybox Town | giant toy blocks, dominoes, wind-up cars | domino runs, bath bubbles |
| 5 | Bamboo Temple | bamboo bridges, lanterns, koi ponds | lily pads, bamboo spikes |
| 6 | Crystal Caves | glowing crystals, an underground lake | dark caves, crystal shards |
| 7 | Neon Arcade | pinball tables, neon, arcade machines | flippers, lasers, neon rain |
| 8 | Frost Peak | snow, ice tunnels, aurora | ice, snowballs, avalanches |
| 9 | Desert Mirage | dunes, pyramids, oases | sandstorms, quicksand, sandworm |
| 10 | Volcano Forge | lava rivers, obsidian, forges | lava pools, eruption escape |
| 11 | Jungle Ruins | vines, temples, waterfalls | vine swings, temple collapse |
| 12 | Pirate Skies | airships, cannons, cloud seas | cannonballs, airship battle |
| 13 | Clockwork Tower | gears, pendulums, springs | gears, the clock strike |
| 14 | Haunted Manor | fog, lanterns, ghost lights | ghost hands, ghost train |
| 15 | Glow-Shroom Forest | bouncy mushrooms, fireflies | spores, mushroom bounce |
| 16 | Deep Sea Tubes | glass tubes under the sea, whales | currents, jellyfish, whale ride |
| 17 | Thunder Plains | storms, tesla towers | lightning, storm chase |
| 18 | Robot Factory | conveyors, presses, sorting machines | presses, the factory line |
| 19 | Rainbow Road | light roads through the clouds | prism barriers, rainbow slide |
| 20 | Moon Base | craters, low gravity, domes | moon dust, meteor rain |
| 21 | Orbit Ring | planets, asteroid belts | gravity wells, comet chase |
| 22 | Cyber Grid | glowing wireframe world | laser grids, system crash |
| 23 | Dragon Peaks | cherry blossoms, temples, kites | dragon fire, dragon flight |
| 24 | Dream Carnival | circus tents, coasters, fireworks | firework rockets, roller coaster |
| 25 | Kranky's Sky Fortress | stormy fortress, everything mixed | fortress defenses, the final cup |

## 12. The 500 ideas

The 500 ideas are 18 families of 25, plus 25 world openers and 25 bosses. Every family is listed **easiest first**.

**How the journey teaches them:** world *w* has 20 stages:
- **stage 1** is the world opener (**W**);
- **stage 20** is the boss (**K**);
- **stages 2–19** each teach the *w*-th idea of one family, so world 1 teaches every family's first (easiest) idea
  and world 25 teaches every family's hardest.

The order of the families **rotates** each world, so no two worlds run in the same rhythm. The **N** (nature) and
**D** (danger) families follow the worlds' themes: idea 10 of each belongs to Volcano Forge, and so on.

Stage number n = (w − 1) × 20 + s. So stage 1 = W01, stage 20 = K01, stage 500 = K25.

### T — Track shapes (25)
- T01 Wide Runway — a wide road with low edges, to learn rolling.
- T02 Gentle Curves — soft S-bends.
- T03 Banked Turn — a tilted corner that holds you in.
- T04 Rail-less Edge — the side walls vanish: stay in the middle.
- T05 Hairpin — a tight U-turn; slow down or fly off.
- T06 Roller Hills — bumps that make you light at the top.
- T07 The Fork — short and risky, or long and safe.
- T08 Half-pipe — swing up the curved sides.
- T09 Funnel — a wide bowl that narrows into a chute.
- T10 Spiral Down — a corkscrew down round a tower.
- T11 Spiral Up — climb a spiral; keep your speed or roll back.
- T12 Loop-the-loop — a full vertical loop that needs speed.
- T13 Wall Ride — a sideways wall you stay on by speed.
- T14 Figure-8 Crossover — the track crosses itself; rivals come from the side.
- T15 Narrowing Road — it gets thinner as you go.
- T16 Chicane Gates — quick left-right posts.
- T17 Bowl Plaza — a round bowl with several exits.
- T18 Glass Tube — an enclosed tube; roll up its walls.
- T19 Ski-jump Slope — a long downhill into a big jump.
- T20 Helix Tower — two spiral strands; jump between them.
- T21 Twisted Ribbon — the road twists 90° onto its side.
- T22 Upside-down Run — an inverted stretch held by speed.
- T23 Split Strands — the road splits into thin strands.
- T24 Sky Ribbon — a thin floating ribbon with no edges at all.
- T25 Möbius Loop — a twisting loop that drops you onto its other side.

### J — Jumps and gaps (25)
- J01 Little Gap — a small gap you roll straight over.
- J02 Jump Pad — a glowing pad that launches you.
- J03 Kicker Ramp — a ramp to the next island.
- J04 Stepping Stones — a line of little round platforms.
- J05 Drop Ledge — fall down to the level below.
- J06 Trampoline — bounce up to a ledge.
- J07 Long Jump — needs a boost pad first.
- J08 Island Hops — a chain of floating islands.
- J09 Moving Platforms — platforms that slide sideways.
- J10 Elevator Pads — platforms that rise and fall.
- J11 Falling Tiles — tiles drop a moment after you touch them.
- J12 Bounce Caps — springy mushroom caps in a chain.
- J13 Cannon Shot — a cannon fires you across.
- J14 Ring Jump — fly through rings for a boost.
- J15 Spinning Landing — land on a turning disc.
- J16 Cloud Puffs — clouds that vanish a second after you land.
- J17 Catapult — an arm flings you.
- J18 Swing Platforms — hanging platforms that swing.
- J19 Boost Gap — a boost pad, then a huge gap.
- J20 Bounce Walls — bounce up between two walls.
- J21 Bullseye Landing — land on the target for a bonus.
- J22 Sky Stairs — floating steps up.
- J23 Double Launch — pad to pad, without touching the ground.
- J24 Blind Jump — the landing appears only while you fly.
- J25 Leap of Faith — the longest gap; only a perfect line makes it.

### B — Balance and narrow paths (25)
- B01 Narrow Bridge — a thin bridge with low rails.
- B02 Plank Path — planks with gaps between them.
- B03 Tightrope Rail — a round rail; stay on top.
- B04 Seesaw — it tips the moment you cross the middle.
- B05 Tilting Platform — it leans under your weight.
- B06 Wobble Bridge — a rope bridge that sways.
- B07 Rocking Boat — a floor that rocks side to side.
- B08 Rolling Log — a log that spins under you.
- B09 Spinning Drum — roll across a turning drum.
- B10 Tipping Tiles — tiles that flip if you stop.
- B11 Balance Scales — two pans that go up and down.
- B12 Zigzag Beam — a thin beam that turns corners.
- B13 Roof Ridge — roll along the top of a ridge.
- B14 Pendulum Bridge — the whole bridge swings.
- B15 Tilt Maze — a maze table that tips with you.
- B16 Holey Board — a board full of holes.
- B17 Barrel Ride — ride on top of a rolling barrel.
- B18 Swaying Tower — a path up a tower that sways.
- B19 Floating Pontoons — they sink if you stay.
- B20 Clock-hand Beam — a beam that turns like a clock hand.
- B21 Gyro Rings — turning rings to roll through.
- B22 Side Belt — a narrow belt that pulls you sideways.
- B23 Needle Path — exactly one marble wide.
- B24 Plate Spinners — a chain of spinning plates.
- B25 Balance Gauntlet — every balance trick in one run.

### H — Hitters and moving obstacles (25)
- H01 Bumper Posts — bouncy posts to weave through.
- H02 Sliding Blocks — blocks gliding across the road.
- H03 Swinging Hammer — a big soft hammer.
- H04 Sweeper Arm — an arm turning across the track.
- H05 Side Pistons — pistons that push from the side.
- H06 Punch Gloves — boxing gloves that pop out.
- H07 Pinball Flippers — flippers that bat you back.
- H08 Spinning Tops — giant tops wandering about.
- H09 Pendulum Blade — a blunt pendulum swing.
- H10 Rolling Boulders — boulders rolling down at you.
- H11 Crushers — blocks that slam down.
- H12 Windmill Blades — giant turning sails.
- H13 Clapping Walls — walls that clap shut.
- H14 Pop-up Blocks — blocks rising from the floor.
- H15 Wrecking Ball — a huge swinging ball.
- H16 Turning Crosses — gates turning like turnstiles.
- H17 Kicker Boots — boots that kick across the road.
- H18 Bowling Pins — pins to knock down (or be knocked by).
- H19 Spring Walls — walls that bounce you back.
- H20 Swatter Fans — big paddles that swat.
- H21 Door Slams — doors that slam in turn.
- H22 Flip Plates — floor plates that flip over.
- H23 Twin Hammers — two hammers in sync.
- H24 Arm Maze — turning arms everywhere.
- H25 Obstacle Storm — everything moving in one pattern.

### F — Floors and surfaces (25)
- F01 Speed Arrows — arrows that push you faster.
- F02 Grass and Road — grass is slower than the road.
- F03 Ice — slippery and fast.
- F04 Sticky Honey — slow and sticky.
- F05 Rubber Floor — bouncy.
- F06 Conveyor — a belt that carries you forward.
- F07 Reverse Conveyor — a belt that pulls you back.
- F08 Sand Drag — slows you down.
- F09 Mud Splash — slows you and splashes rivals.
- F10 Oil Slick — no grip for a moment.
- F11 Crumbling Tiles — they break after a moment.
- F12 Glass Floor — it cracks if you land hard.
- F13 Magnet Floor — pulls you down (no bouncing).
- F14 Rumble Strips — shake but go.
- F15 Slow Pads — big pads that slow you.
- F16 Soap Slide — super slippery downhill.
- F17 Checker Traps — every other tile drops.
- F18 Colour Floor — only one colour is safe right now.
- F19 Pressure Plates — roll over them to raise bridges.
- F20 Beat Floor — tiles that vanish on the beat.
- F21 Lava Cracks — cracks that glow, then burst.
- F22 Pinball Floor — a sloped floor with bumpers.
- F23 Tread Wheels — giant turning floors.
- F24 Sloped Gutter — the floor leans toward a drop.
- F25 Surface Gauntlet — every surface in a row.

### A — Air and gravity (25)
- A01 Updraft Vents — warm air lifts you.
- A02 Side Fans — fans push you sideways.
- A03 Low Gravity — floaty jumps.
- A04 Bubble Float — a bubble carries you up.
- A05 Geyser Lift — a water jet lifts you.
- A06 Heavy Gravity — short jumps, strong grip.
- A07 Glide Zone — float down slowly.
- A08 Vacuum Tube — sucked through a pipe.
- A09 Air Cannons — puffs of air that knock you.
- A10 Tornado Spin — a whirl that spins you round.
- A11 Gravity Flip — roll on the ceiling.
- A12 Magnet Rails — rails that hold you.
- A13 Magnet Walls — stick to the walls.
- A14 Zero-G Bubble — float freely inside a bubble.
- A15 Black Hole — a pull toward the middle.
- A16 Tiny Planet — roll all the way round a little planet.
- A17 Moon Sling — slingshot round a moon.
- A18 Gravity Wells — pulls between islands.
- A19 Headwind Tunnel — a strong wind pushing you back.
- A20 Drifting Islands — islands that float about.
- A21 Gravity Loop — a loop where gravity switches.
- A22 Anti-grav Rings — rings that make you float.
- A23 Planet Hops — jump from planet to planet.
- A24 Meteor Ride — ride on a falling meteor.
- A25 Gravity Maze — a maze where down keeps changing.

### M — Machines and transport (25)
- M01 Checkpoint Gates — gates that save your place.
- M02 Lift Platform — a lift carries you up.
- M03 Pipe Slide — whoosh through a pipe.
- M04 Portals — go in one, come out another.
- M05 Switch Bridge — hit a switch to raise a bridge.
- M06 Timed Doors — doors that open and close.
- M07 Drawbridge — a bridge that goes up and down.
- M08 Marble Elevator — a lift with cups that never stops.
- M09 Big Wheel Buckets — ride a Ferris wheel up.
- M10 Rail Cart — a cart carries you along a rail.
- M11 Spiral Drain — round and round, then down.
- M12 Turnstile — a gate you push round.
- M13 Washing Drum — tumble through a turning drum.
- M14 Gear Wheels — roll across turning gears.
- M15 Zip-line Cup — slide along a wire in a cup.
- M16 Piston Stairs — steps that go up and down.
- M17 Sorting Machine — colour chutes send you different ways.
- M18 Balloon Lift — a balloon carries you up.
- M19 Turning Cylinders — rollers in a row.
- M20 Clock Pendulum — ride a giant pendulum.
- M21 Turning Maze — a maze that rotates.
- M22 Junction Switches — switches change the route.
- M23 Catapult Chain — catapult to catapult.
- M24 Domino Machine — knock a domino chain to open the way.
- M25 Giant Machine — a whole marble machine to ride through.

### N — Nature and weather (follow the worlds, 25)
- N01 Breezy Meadow — gentle wind gusts.
- N02 Caramel River — a slow, sticky river.
- N03 Water Flume — a water slide.
- N04 Bath Bubbles — toy-bath bubbles float you.
- N05 Lily Pads — koi-pond pads that bob.
- N06 Cave Lake — dark water at the road's edge.
- N07 Neon Rain — rain makes the road slippery.
- N08 Snowballs — snow piles; roll in them to grow.
- N09 Sandstorm — you can't see far.
- N10 Ash Clouds — volcanic ash and falling embers.
- N11 Vine Swing — swing on a vine.
- N12 Cloud Sea — roll across a sea of clouds.
- N13 Steam Vents — jets of steam.
- N14 Fog Lanterns — follow the lanterns through fog.
- N15 Spore Puffs — spores bounce you up.
- N16 Sea Currents — water pushes you along the tube.
- N17 Storm Gusts — strong, changing wind.
- N18 Factory Smoke — puffs that hide the road.
- N19 Rainbow Rain — rain that paints a road.
- N20 Moon Dust — slow, floaty dust.
- N21 Solar Wind — a shining wind from the sun.
- N22 Digital Rain — falling code you can't see through.
- N23 Blossom Storm — petals and swirling wind.
- N24 Firework Night — bright bursts light the way.
- N25 All-season Storm — rain, snow, sun and wind in turns.

### D — Danger zones (follow the worlds, 25)
- D01 Fall Edges — red edges show where you can fall.
- D02 Jelly Pits — wobbly goo that slows you.
- D03 Crab Pinchers — crabs snap at the road.
- D04 Domino Fall — dominoes topple across your path.
- D05 Bamboo Spikes — spikes pop up in rows.
- D06 Crystal Shards — shards fall from the ceiling.
- D07 Laser Beams — beams that blink on and off.
- D08 Ice Cracks — cracks open under you.
- D09 Quicksand — stop and you sink.
- D10 Lava Pools — pools beside and across the road.
- D11 Snapping Plants — plants that bite.
- D12 Cannonballs — shots across the road.
- D13 Saw Gears — spinning gear blades.
- D14 Ghost Hands — hands that grab and slow you.
- D15 Poison Spores — clouds that slow you.
- D16 Jellyfish — shocks that bounce you.
- D17 Lightning — strikes with a warning glow.
- D18 Presses — factory presses slamming down.
- D19 Prism Barriers — light walls that only let one colour through.
- D20 Meteor Rain — meteors with warning circles.
- D21 Space Debris — tumbling rocks.
- D22 Laser Grid — a moving grid of lasers.
- D23 Dragon Fire — fire breath sweeps the road.
- D24 Firework Rockets — rockets zipping across.
- D25 Fortress Defenses — Kranky's cannons, lasers and walls together.

### S — Speed and momentum (25)
- S01 Boost Pads — glowing pads for a burst.
- S02 Downhill Speed — let gravity do the work.
- S03 Uphill Rollback — keep your speed up, or roll back.
- S04 Slipstream — roll behind a rival for free speed.
- S05 Speed Orbs — fill your boost meter.
- S06 Boost Meter — double-tap for a boost when full.
- S07 Momentum Jumps — the faster you go, the farther you fly.
- S08 Brake Zones — slow down or fly off.
- S09 Speed Gates — gates that only open if you're fast.
- S10 Turbo Rings — big rings to roll through.
- S11 Perfect Line — the glowing line is fastest.
- S12 High Bank — the high line round a bend is quicker.
- S13 Swing Pipes — roll up and down to gain speed.
- S14 Slingshot Pads — pads that sling you round a bend.
- S15 Speed Trap — a zone that slows everyone.
- S16 Overdrive — the top boost level.
- S17 Boost Chain — boost pads in a perfect rhythm.
- S18 Air Boost — boost in mid-air.
- S19 Keep It Up — a stretch where slowing down drops you.
- S20 Gravity Assist — dive to gain speed.
- S21 Tunnel Rush — a long, fast tunnel.
- S22 Rocket Lanes — lanes that rocket you along.
- S23 Hyper Loop — a super-fast tube loop.
- S24 Speed Ladder — every pad faster than the last.
- S25 Light Speed — the fastest stretch in the game.

### R — Rivals and racing (25)
- R01 First Rival — one friendly marble to race.
- R02 Pack Race — six marbles.
- R03 Bump and Shove — marbles bump each other.
- R04 Overtake Bonus — coins for passing.
- R05 Lead Crown — the leader wears a crown (and gets coins).
- R06 Rival Shortcuts — rivals know a secret way.
- R07 Rivals with Powers — rivals use powers too.
- R08 Cup Points — a 3-race cup with points.
- R09 Elimination Lap — the last marble is out.
- R10 Duel — one-on-one.
- R11 Chase the Leader — catch a runaway leader.
- R12 Escape — stay ahead of a chaser.
- R13 Team Relay — your team swaps marbles each lap.
- R14 Big Pack — twelve marbles.
- R15 Rolling Start — start on the move.
- R16 Photo Finish — always a close finish.
- R17 Ghost Rival — race a ghost marble.
- R18 Rival Rush — tough, aggressive rivals.
- R19 Pole Position — qualify first, then race.
- R20 Knockout Royale — 24 marbles.
- R21 Rival Traps — rivals drop slow-goo behind them.
- R22 The Champion — the world champion marble.
- R23 Night Race — racing under lights.
- R24 Endurance — five laps.
- R25 Grand Final — the hardest rivals, the biggest cup.

### P — Powers (25)
- P01 Turbo — a burst of speed.
- P02 Magnet — pulls coins in.
- P03 Shield Bubble — one free bump or fall.
- P04 Super Jump — a giant hop.
- P05 Giant Marble — grow big and push rivals away.
- P06 Tiny Marble — shrink to fit small pipes.
- P07 Heavy Iron — wind and bumps can't move you.
- P08 Feather — float on every jump.
- P09 Glide Wings — glide across gaps.
- P10 Ghost — pass through walls and rivals.
- P11 Rubber Bounce — bounce off everything.
- P12 Rainbow Bridge — builds a road over a gap.
- P13 Freeze Trail — leaves ice behind you.
- P14 Bumper Blast — a ring that pushes rivals away.
- P15 Rewind — undo the last 3 seconds after a fall.
- P16 Sticky Grip — stick to walls and ceilings.
- P17 Rocket — fly forward for a moment.
- P18 Time Slow — everything slows except you.
- P19 Fireball — melt ice and burn through vines.
- P20 Lightning Dash — zap forward along the road.
- P21 Twin — split into two marbles; keep the leader.
- P22 Drill — dig through walls.
- P23 Star — invincible and fast.
- P24 Black Hole — pulls in every coin nearby.
- P25 Power Combo — two powers at once.

### C — Collectibles (25)
- C01 Coins — gold coins for the wallet.
- C02 Gem Lines — gems on the risky lines.
- C03 Hearts — save a fall.
- C04 Speed Orbs — fill the boost meter.
- C05 Three Stars — hidden in every stage.
- C06 Power Capsules — a random power you have learned.
- C07 Coin Rings — rings of coins in the air.
- C08 O-R-B-I Letters — spell ORBI for a bonus vault.
- C09 Time Coins — coins that add seconds in trials.
- C10 Secret Chests — chests on secret paths.
- C11 Golden Marble — a rare gold coin worth 100.
- C12 Combo Chains — collect without a miss for a multiplier.
- C13 Keys and Gates — keys open shortcut gates.
- C14 Crown Bonus — coins for every second in the lead.
- C15 Sticker Cards — collectable cards for the Dex.
- C16 Map Pieces — find all four for a secret stage.
- C17 Lucky Clover — better powers for a lap.
- C18 Paint Drops — new colours for your marble.
- C19 Rival Chips — earned by passing rivals.
- C20 Trophy Tokens — for the trophy room.
- C21 Bonus Vault — a gate into a coin room.
- C22 Power Cells — charge a super power.
- C23 Treasure Run — a coin-packed bonus road.
- C24 Lucky Wheel — spin for a prize at the finish.
- C25 Legendary Orb — one ultra-rare orb per world.

### Q — Goals and rules (25)
- Q01 Reach the Finish — just get there.
- Q02 Podium — finish in the top 3.
- Q03 Beat the Clock — finish before time runs out.
- Q04 Coin Goal — collect 50 coins.
- Q05 No-Fall Run — don't fall even once.
- Q06 Ring Run — roll through every ring.
- Q07 Star Hunt — find all three stars.
- Q08 Win — first place only.
- Q09 Mirror Track — the track is flipped.
- Q10 Reverse Track — race it backwards.
- Q11 One Life — one fall and you're out.
- Q12 No Powers — no powers allowed.
- Q13 Power Play — use three powers.
- Q14 Size Gates — be tiny or giant to pass.
- Q15 Weight Gates — be heavy or light to pass.
- Q16 Colour Gates — match the gate's colour.
- Q17 Speed Limit — stay under the limit in town.
- Q18 Perfect Landings — land five jumps perfectly.
- Q19 Checkpoint Clock — every gate adds time.
- Q20 Escort — push a little friend marble to the finish.
- Q21 Survive — survive the shrinking arena.
- Q22 Relay — finish with all your team.
- Q23 Lead Every Lap — lead at every lap line.
- Q24 Gold Time — beat the gold ghost.
- Q25 Perfect Race — win, no falls, all three stars.

### V — View twists (25)
- V01 Drone Reveal — the whole circuit shown from above at the start.
- V02 Side View — a stretch filmed from the side.
- V03 Top-down — a stretch filmed from above.
- V04 Marble Cam — see from inside the marble.
- V05 Slow-mo Jump — big jumps in slow motion.
- V06 Spotlight — dark, with only a spotlight.
- V07 Mirror World — left and right swap.
- V08 Tilted Horizon — the world leans.
- V09 Fog Wall — you can only see close up.
- V10 Glass Floor — see far down through the road.
- V11 Upside-down — the camera flips.
- V12 Fisheye Speed — the view stretches at top speed.
- V13 Strobe Beat — lights flash with the music.
- V14 Neon Blackout — only the neon lines show.
- V15 Speed Tunnel — a streaky tunnel view.
- V16 Leader Cam — see the leader for a moment.
- V17 Front Cam — the camera faces you; a chaser comes from behind.
- V18 Retro Pixels — a pixel-art stretch.
- V19 Cinematic Reveal — a big landmark shown first.
- V20 Rewind Replay — your best moment replayed.
- V21 Split Routes — two routes shown side by side.
- V22 Night Vision — a green glow in the dark.
- V23 Kaleidoscope — a spinning, mirrored view.
- V24 Shrinking View — the view narrows.
- V25 Director's Cut — every twist in one stage.

### X — Tricks and style (25)
- X01 Air Time — points for time in the air.
- X02 Spin Trick — swipe sideways in the air to spin.
- X03 Perfect Landing — land flat for a boost.
- X04 Near Miss — pass close to a hazard.
- X05 Rail Grind — roll along a rail.
- X06 Wall Ride Bonus — points for wall rides.
- X07 Loop Bonus — points for loops.
- X08 Style Meter — style fills your boost.
- X09 Flip Trick — a front flip off a ramp.
- X10 Combo Chain — tricks in a row multiply.
- X11 Double Spin — two spins in one jump.
- X12 Bounce Trick — tricks off trampolines.
- X13 Ring Trick — a trick through a ring.
- X14 Slalom Style — weave the posts.
- X15 Skid Spin — a spinning skid round a corner.
- X16 Hang Time — the longest jump.
- X17 Big Air Zone — a huge ramp to show off.
- X18 Trick Gates — gates that want a trick.
- X19 Style Duel — beat a rival's style score.
- X20 Crowd Cheer — the crowd cheers your tricks.
- X21 Freestyle Park — an open trick park.
- X22 Signature Trick — every marble has its own trick.
- X23 Perfect Trail — stay on the glowing trail.
- X24 Trick Rush — score attack.
- X25 Superstar Show — the ultimate trick stage.

### E — Set pieces (follow the worlds, 25)
- E01 Grand Opening — fireworks and a big start.
- E02 Candy Avalanche — sweets tumble after you.
- E03 Tidal Wave — race a wave down the beach.
- E04 Domino Collapse — the toy town falls behind you.
- E05 Dragon Kite — chase a kite across the temple roofs.
- E06 Cave-in — rocks fall as you race out.
- E07 Pinball Table — race across a giant pinball table.
- E08 Avalanche — snow rolls after you.
- E09 Sandworm — a sand worm bursts from the dunes.
- E10 Eruption — escape the volcano.
- E11 Temple Collapse — the ruins crumble around you.
- E12 Airship Battle — race across warring airships.
- E13 Clock Strike — the giant clock strikes twelve.
- E14 Ghost Train — race a ghost train.
- E15 Mushroom Bloom — mushrooms pop up as bounce pads.
- E16 Whale Ride — ride on a whale's back.
- E17 Storm Chase — a tornado follows you.
- E18 Factory Line — ride the production line.
- E19 Rainbow Slide — slide down a rainbow.
- E20 Moon Landing — land on the moon.
- E21 Comet Chase — chase a comet's tail.
- E22 System Crash — the digital world glitches apart.
- E23 Dragon Flight — ride the dragon.
- E24 Roller Coaster — ride the coaster track.
- E25 Fortress Siege — storm Kranky's fortress.

### Y — Rhythm and music (25)
- Y01 Beat Pads — boost when you hit a pad on the beat.
- Y02 Drum Bridges — bridges appear on the beat.
- Y03 Music Doors — doors that open on the beat.
- Y04 Note Coins — coins that play notes.
- Y05 Bass Drop — jump on the drop.
- Y06 Piano Keys — a floor of piano keys.
- Y07 Rhythm Hammers — hammers that swing to the music.
- Y08 Tempo Up — the music and the track speed up.
- Y09 Silent Zone — the music stops; listen for the hazards.
- Y10 Chorus Rush — the chorus brings a speed rush.
- Y11 Light Path — the safe path lights up with the music.
- Y12 Scratch Rewind — the DJ scratch rewinds the hazards.
- Y13 Xylophone Bridge — a bridge that plays a tune.
- Y14 Echo Platforms — platforms copy the beat.
- Y15 Off-beat Traps — traps on the off-beat.
- Y16 Choir Lift — the choir lifts you up.
- Y17 Beat Drop Jump — the biggest jump on the drop.
- Y18 Song Medley — the stage changes songs.
- Y19 Conductor — a giant baton conducts the obstacles.
- Y20 Space Synth — floaty space music sets the gravity.
- Y21 Glitch Beat — glitchy music, glitchy road.
- Y22 Taiko Drums — drum hits launch you.
- Y23 Carnival Band — the band plays the obstacles.
- Y24 Rhythm Royale — the floor drops to the beat.
- Y25 Final Anthem — the whole stage plays the cup's song.

### W — World openers (25)
Stage 1 of each world, W01–W25, is a **showcase**:
- the world's widest, most beautiful circuit;
- a drone reveal of the landmark;
- a gentle race against the world's racers, with no new hard idea — a breather that says "welcome".

### K — Kranky's machines (25)
Stage 20 of each world is a **boss race**: you race the pack while Kranky's machine attacks the track. You win by
finishing first **and** knocking the machine's weak spot three times, rolling into its glowing core from a jump pad.

| # | Boss | # | Boss |
| --- | --- | --- | --- |
| K01 | the Windmill Giant | K14 | the Ghost Lantern |
| K02 | the Gumball Crusher | K15 | the Spore King |
| K03 | the Crab Dozer | K16 | the Kraken Tube |
| K04 | the Toy Robot Titan | K17 | the Tesla Tower |
| K05 | the Lantern Dragon | K18 | the Mega Press |
| K06 | the Crystal Golem | K19 | the Prism Eye |
| K07 | the Pinball Wizard machine | K20 | the Moon Rover |
| K08 | the Snow Plough | K21 | the Comet Catcher |
| K09 | the Sand Sphinx | K22 | the Virus Cube |
| K10 | the Lava Hammer | K23 | the Iron Dragon |
| K11 | the Temple Idol | K24 | the Big Top Clown Cannon |
| K12 | the Pirate Galleon | K25 | Kranky's Sky Fortress (a three-part final race) |
| K13 | the Clock Giant | | |

## 13. After stage 500: the Remix Grand Prix (unlimited, never the same)

After the journey, every stage is a **remix**:
- **2–4 learned ideas mixed** into one track (from 450 learnable ideas there are over 100 000 pairs and 15 million
  triples);
- **a blended look**: one world's track style in another world's sky;
- **its own name**, e.g. "Ice Seesaw Rally", "Lava Loop Royale", "Ghost Cannon Sprint".

**Freshness memory**, so it never feels repeated:
- no idea comes back within 3 stages;
- no mix within its last 400 uses;
- no world look twice in a row;
- the stage kind rotates;
- set pieces wait at least 10 stages before coming back.

**It keeps getting harder:**
- difficulty keeps rising slowly;
- every 10th remix is a **burner**, and every 25th is a **Remix Boss** (two machines at once);
- the leagues (Bronze → Legend) raise rival skill and the gold time.

**It keeps changing:**
- **weekly mutators**: Low-Gravity Week, Giant Marble Week, Mirror Week…;
- **seasonal cups** (snow in winter, kites in summer).

Every remix is still checked by the fairness bot, so it is always possible.

## 14. Tech plan (same shape as our other 3D games)

A new engine in `src/orbi/`, following the patterns from Rollo Rush and the racing games:

| File | What it does |
| --- | --- |
| `data/concepts.ts`, `data/worlds.ts` | the 500 ideas and the 25 worlds with their teaching order |
| `track.ts` | spline circuits and rallies: banking, twists, loops, tubes, pieces placed along them |
| `physics.ts` | marble physics: rolling, spin, grip per surface, bumps between marbles, moving and tilting pieces |
| `gen.ts`, `sections.ts` | the stage director (recipes, sections per idea, laps and shortcuts, the remix director with freshness memory) |
| `bot.ts` | the fairness robot marble (human reaction time) that must finish every stage |
| `ai.ts` | rival marbles with personalities and fair skill tiers |
| `render3d.ts`, `three/` | marbles (reflective glass shader, swirl core), worlds, tracks, crowds, effects, cameras |
| `session.ts`, `worker.ts` | input, race flow, music and sound; the next stage built in a worker |
| `save.ts`, `ui/` | progress, Dex, collection, modes; HUD and menus; phone first |

**Physics choice:** real 3D marble physics is the heart of the game (balance, seesaws, bumping, tilting floors).
- **Plan A:** a hand-made sphere-versus-track physics, like our other games: light, deterministic and easy to run in
  the worker for the fairness bot.
- **Plan B:** add a physics library (Rapier) for the moving and tilting pieces.
- The decision is made in Phase 1 by building both test stages and comparing feel and speed on a phone.

## 15. Build phases

1. **Phase 1 — the core:**
   - marble physics and controls, the track builder, the fairness bot, rival AI and the race flow;
   - worlds 1–2 (stages 1–40) with their 36 ideas and 2 bosses;
   - coins, speed orbs, the first powers, and a phone-first HUD.
2. **Phase 2 — worlds 3–10** (stages 41–200).
3. **Phase 3 — worlds 11–25** (stages 201–500), all the bosses and the final cup.
4. **Phase 4 — endless and modes:** the Remix Grand Prix, Endless Sky Run, Daily Cup, Time Trial, Knockout Royale,
   the Dex and the marble collection.
5. **Phase 5 — polish and QA:**
   - a headless sweep of 1000 stages that the bot must finish;
   - a phone performance pass, the sound mix, store art and the site page.

## 16. Status

**All five phases are built** (Phase 1 on 2026-11-22, Phases 2–5 on 2026-11-23). Play at `/play?g=orbi-gp`.

**Phase 1 — the core:**
- **Engine** (`src/orbi/`):
  - `track.ts`: the ribbon track builder (turns, climbs, twists, sideways shifts; loops work);
  - `sim.ts`: hand-made marble physics (Plan A; no physics library needed);
  - `ai.ts`: rival drivers; `bot.ts`: the fairness robot; `gen.ts`: the stage director.
- **Progress:** stages, stars, best times and coins are saved locally (`momoblobs:orbigp`); the road map shows all 500
  stops plus the remix stops.
- **Phone first:** hold-and-drag, swipe or tilt controls, or on-screen buttons; portrait chase camera; safe areas.

**Phases 2–3 — worlds 3–25, bosses and the final cup:**
- `more.ts` adds 43 new pieces of road:
  - loops, glass tubes, wall rides and corkscrews held on by a magnet road;
  - forks and split strands, cannons/catapults/drums, air rings, spinning discs, swings on ropes;
  - rolling boulders, flippers, doors, presses, clapping walls, cannonballs, lightning, laser grids, spore clouds;
  - portals, switch bridges, holey boards, pontoons, beat floors timed to the music, piano keys that sing;
  - black holes, gusts, chasers (boulders, candy avalanches, dominoes, sandworms, ghost trains, tornadoes, comets);
  - collapsing floors, colour gates, speed traps and limits, treasure roads, double launches, bullseye and blind landings;
  - trick parks, rumble strips, side belts and glass roads;
  - weather stretches (rain, snow, fog, sandstorm, smoke, petals, falling code, fireworks, the dark);
  - camera twists (side, top, low, tilted, fisheye, far, front, slow-mo, mirror, upside-down, pixel, strobe, night vision,
    kaleidoscope, narrowing view).
- **Ideas:** 423 of the 500 now have their own piece or rule (`EXACT` in `gen.ts`, plus `IDEA2` and `IDEA_RULES` in
  `more.ts`, plus all openers and bosses). The rest borrow the closest mechanic, and the road map shows its name.
- **Rule ideas:**
  - coin goals, star hunts, ring runs, escape the chaser, lead at every checkpoint, power plays, trick goals and no powers;
  - elimination checkpoints, rolling starts, duels, a runaway leader, the champion, a ghost rival and rival rush.
- **Pickups:** hearts (save a fall), O-R-B-I letters (+40 coins), chests, gold coins.
- **Tricks:** combos and near misses fill the boost meter.
- **Bosses:**
  - every 20th stage, one of Kranky's 25 machines (five body types in each world's colours) stands over the road 3 times;
  - win the race and roll over all 3 glowing cores to pass;
  - stage 500 is the final cup: 4 extra sections, the hardest rivals and Kranky himself racing.

**Phase 4 — modes and collection** (Modes button on the home screen; `/play?g=orbi-gp&mode=endless` and the other
modes link straight in):
- **Endless Sky Run:** courses back to back on 3 lives, each harder; best distance saved.
- **Daily Cup:** 3 races, the same for everybody that day, points per place, a day streak.
- **Time Trial:** any cleared stage, no rivals, your best run's ghost replayed; 30 ghosts kept.
- **Knockout Royale:** 16 → 8 → 4 marbles over 3 short rounds with collapsing floors.
- **Boss Rush:** every boss you've beaten, back to back.
- **Marbles:** 39 marbles (tinted glass, metals, planets, candy, animals, galaxy…), bought with coins; they all roll
  the same.
- **Idea Dex:** all 500 ideas by family, lit up when you meet them; tap to read one.

**Phase 5 — polish and QA:**
- **Fairness sweep:** the headless robot drove stages 1–1000.
  - All 1000 pass; 44 needed trimming (4.4%) and 104 a rebuild.
  - A stage builds in 0.13 s on average.
  - Fixed along the way: swings, boulders, cannonballs, lightning, holey boards, bumpers and lava.
- **Performance:** a phone-size race renders in roughly 16–100 draw calls.
  - Zones are laid along the road's curve; the glass tube is a light shell.
  - Name tags hide on the home shot.
- **Sound:** new sounds for rings, portals, switches, hearts, letters, chests, cores, near misses, knock-outs and paint.
  - Piano keys play a scale.
  - Vibration waits for the first tap.

**Speed, tough roads and long stages** (2026-11-23, after playtesting):
- **Speed:**
  - cruising top speed is 113–160 km/h (by difficulty); turbo and boosts reach 1.5× that;
  - boost pads and flaming **rocket boosters** blast you up to **350 km/h**;
  - a speedometer (0–350) sits in the HUD, with speed lines and a wider view at speed;
  - the push stays strong until close to top speed, and climbs keep about 95% of it while you roll;
  - the physics takes two sub-steps when fast, so nothing tunnels through.
- **Tough roads (Sky Roll style):**
  - between sections, the course never runs plain;
  - joiners: cambered (tilted) roads, narrow zig-zags, funnels, stairs, hops, crests, rounded ledges, minefields and slaloms;
  - speed runs (with a braking hint before they end);
  - roads are narrower (8.4 m down to 4.6 m base) and rails are rare later on.
- **Don't-touch mines:** red spiky orbs; a touch zaps you back to the last checkpoint (a shield saves you once).
- **Length:**
  - every stage (and remix) is about 15 minutes for a player (the robot takes 12–15), which means 20–30 km;
  - (first set to 20+ minutes, then shortened to about 15 on request);
  - the stage is checked by the robot from checkpoint to checkpoint (average 2.5 s to build);
  - the last few stages are cached, so a retry starts at once, and the next stage is built while you race.
- **Long-course streaming:** the cloud sea, sun and stars follow the camera; islands and puffs are built in 500 m
  chunks ahead; object loops binary-search to the camera's stretch.
- **Controls:** a joystick (the new default on phones): push forward to roll, left/right to steer, back to brake;
  tap the right side to jump. Keyboard ↓ / S brakes, and the game's keys never scroll the page. Buttons mode has a
  brake button.
- **Win to go on:** only 1st place unlocks the next stage. ⭐ win · ⭐⭐ no falls · ⭐⭐⭐ also under gold (or 3 stars).

**Still open (ideas for later):**
- lapped circuits and figure-8 crossings;
- the 17 powers beyond the first 8 (tiny, ghost, rewind, drill…);
- the Marble Lab;
- saving a half-finished 20-minute stage to resume later;
- trails and finish effects for the collection.
